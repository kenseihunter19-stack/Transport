import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  devicePushTokens,
  guardians,
  guardianStudentLinks,
  notifications,
  students,
  users,
} from '../db/schema.ts';
import { adminMessaging, isPushCredentialsConfigured } from '../lib/firebase-admin.ts';
import type { TelemetryHub } from './realtime.ts';

export const NOTIFICATION_TYPES = [
  'boarded',
  'handover_completed',
  'approaching_stop',
  'trip_delayed',
  'incident',
  'invoice',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function formatLuandaTimeHHMM(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function isCredentialOrConfigError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const haystack = `${code} ${msg}`.toLowerCase();
  return (
    haystack.includes('credential') ||
    haystack.includes('authentication-error') ||
    haystack.includes('third-party-auth-error') ||
    haystack.includes('unauthenticated') ||
    haystack.includes('permission_denied') ||
    haystack.includes('permission denied') ||
    haystack.includes('enoent')
  );
}

export async function getLinkedGuardianUserIds(studentId: number): Promise<number[]> {
  const links = await db
    .select({
      userId: guardians.userId,
    })
    .from(guardianStudentLinks)
    .innerJoin(guardians, eq(guardianStudentLinks.guardianId, guardians.id))
    .innerJoin(users, eq(guardians.userId, users.id))
    .where(
      and(
        eq(guardianStudentLinks.studentId, studentId),
        eq(guardianStudentLinks.active, true),
        eq(users.active, true)
      )
    );

  return Array.from(
    new Set(links.map((row) => row.userId).filter((id): id is number => id != null && id > 0))
  );
}

export async function dispatchNotificationToUsers(params: {
  telemetryHub: TelemetryHub;
  userIds: number[];
  type: NotificationType;
  title: string;
  body: string;
  tripId?: number | null;
  studentId?: number | null;
}) {
  const uniqueUserIds = Array.from(
    new Set(params.userIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  if (uniqueUserIds.length === 0) return [];

  const createdRows: Array<typeof notifications.$inferSelect> = [];

  for (const userId of uniqueUserIds) {
    // 1. Persist in DB inbox first with in_app_only (never mark delivered just because queued)
    const inserted = await db
      .insert(notifications)
      .values({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        tripId: params.tripId ?? null,
        studentId: params.studentId ?? null,
        deliveryStatus: 'in_app_only',
      })
      .returning();

    let notifRow = inserted[0];
    if (!notifRow) continue;

    // 2. Push through existing WebSocket strictly to this guardian's open app(s)
    params.telemetryHub.sendToUsers([userId], 'notification:created', {
      notification: notifRow,
    });

    // 3. Send push notification via firebase-admin messaging if credentials & tokens exist
    try {
      const tokenRows = await db
        .select()
        .from(devicePushTokens)
        .where(and(eq(devicePushTokens.active, true), eq(devicePushTokens.userId, userId)));
      const tokens = tokenRows.map((t) => t.token).filter(Boolean);

      if (tokens.length > 0 && isPushCredentialsConfigured()) {
        const result = await adminMessaging.sendEachForMulticast({
          tokens,
          notification: {
            title: params.title,
            body: params.body,
          },
          data: {
            notificationId: String(notifRow.id),
            type: params.type,
            ...(params.studentId != null ? { studentId: String(params.studentId) } : {}),
            ...(params.tripId != null ? { tripId: String(params.tripId) } : {}),
          },
        });

        const staleTokens: string[] = [];
        let sawCredentialError = false;
        result.responses.forEach((resp, idx) => {
          if (resp.success) return;
          const code = resp.error?.code ?? '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            const tok = tokens[idx];
            if (tok) staleTokens.push(tok);
          } else if (isCredentialOrConfigError(resp.error)) {
            sawCredentialError = true;
          }
        });

        if (staleTokens.length > 0) {
          await db
            .update(devicePushTokens)
            .set({ active: false, updatedAt: new Date() })
            .where(inArray(devicePushTokens.token, staleTokens));
        }

        const nextStatus =
          result.successCount > 0
            ? 'delivered'
            : sawCredentialError
            ? 'in_app_only'
            : 'push_failed';

        if (nextStatus !== notifRow.deliveryStatus) {
          const updated = await db
            .update(notifications)
            .set({ deliveryStatus: nextStatus })
            .where(eq(notifications.id, notifRow.id))
            .returning();
          if (updated[0]) notifRow = updated[0];
        }
      }
    } catch (err) {
      if (isCredentialOrConfigError(err)) {
        // Push credentials not configured/available -> skip push without crashing and keep in_app_only
        console.warn('FCM push skipped (credentials unavailable):', err instanceof Error ? err.message : err);
      } else {
        console.warn('FCM push dispatch failed:', err instanceof Error ? err.message : err);
        const updated = await db
          .update(notifications)
          .set({ deliveryStatus: 'push_failed' })
          .where(eq(notifications.id, notifRow.id))
          .returning();
        if (updated[0]) notifRow = updated[0];
      }
    }

    createdRows.push(notifRow);
  }

  return createdRows;
}

export async function notifyStudentLinkedGuardians(params: {
  telemetryHub: TelemetryHub;
  studentId: number;
  studentName?: string | null;
  tripId?: number | null;
  type: 'boarded' | 'handover_completed';
  occurredAt?: Date;
}) {
  let fullName = (params.studentName ?? '').trim();
  if (!fullName) {
    const rows = await db
      .select({ fullName: students.fullName })
      .from(students)
      .where(eq(students.id, params.studentId))
      .limit(1);
    fullName = rows[0]?.fullName?.trim() || 'Educando';
  }

  const firstName = fullName.split(/\s+/)[0] || fullName;
  const timeHHMM = formatLuandaTimeHHMM(params.occurredAt ?? new Date());

  const title =
    params.type === 'boarded'
      ? 'Embarque Confirmado'
      : 'Entrega Segura Confirmada';
  const body =
    params.type === 'boarded'
      ? `${firstName} subiu no autocarro às ${timeHHMM}`
      : `${firstName} foi entregue com segurança às ${timeHHMM}`;

  const guardianUserIds = await getLinkedGuardianUserIds(params.studentId);
  if (guardianUserIds.length === 0) return [];

  return dispatchNotificationToUsers({
    telemetryHub: params.telemetryHub,
    userIds: guardianUserIds,
    type: params.type,
    title,
    body,
    tripId: params.tripId ?? null,
    studentId: params.studentId,
  });
}
