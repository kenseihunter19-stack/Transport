import type http from 'node:http';
import { URL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { and, eq, inArray } from 'drizzle-orm';
import { adminMessaging, isPushCredentialsConfigured } from '../lib/firebase-admin.ts';
import {
  AccountNotProvisionedError,
  resolveDbUserFromToken,
  writeAuditLog,
  type DbUserRecord,
} from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import {
  devicePushTokens,
  guardians,
  guardianStudentLinks,
  students,
  trips,
} from '../db/schema.ts';
import { checkRouteStopGeofences, pointAtRoute } from '../lib/luanda-geofence.ts';
import { getRouteWithStopsByCode, loadRoutesWithStops } from './routes-repo.ts';

async function sendMulticastPush(
  userIds: number[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  if (userIds.length === 0 || !isPushCredentialsConfigured()) return;
  try {
    const tokenRows = await db
      .select()
      .from(devicePushTokens)
      .where(and(eq(devicePushTokens.active, true), inArray(devicePushTokens.userId, userIds)));
    const tokens = tokenRows.map((t) => t.token);
    if (tokens.length === 0) return;

    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data,
    });

    // Deactivate expired/unregistered device tokens automatically
    const staleTokens: string[] = [];
    result.responses.forEach((resp, idx) => {
      const code = resp.error?.code;
      if (
        !resp.success &&
        (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')
      ) {
        const tok = tokens[idx];
        if (tok) staleTokens.push(tok);
      }
    });
    if (staleTokens.length > 0) {
      await db
        .update(devicePushTokens)
        .set({ active: false, updatedAt: new Date() })
        .where(inArray(devicePushTokens.token, staleTokens));
    }
  } catch (err) {
    // Non-fatal when FCM credentials aren't active in dev sandbox
    console.warn('FCM push dispatch skipped:', err instanceof Error ? err.message : err);
  }
}

export async function dispatchGuardianPushByStudent(
  studentId: number,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    const links = await db
      .select()
      .from(guardianStudentLinks)
      .where(and(eq(guardianStudentLinks.studentId, studentId), eq(guardianStudentLinks.active, true)));
    if (links.length === 0) return;

    const gIds = links.map((l) => l.guardianId);
    const gRows = await db.select().from(guardians).where(inArray(guardians.id, gIds));
    const userIds = gRows.map((g) => g.userId).filter((id): id is number => id != null);
    await sendMulticastPush(userIds, title, body, data);
  } catch {
    // ignore push lookup errors
  }
}

export async function dispatchGuardianPushByRoute(
  routeCode: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<void> {
  try {
    const routeStudents = await db.select().from(students).where(eq(students.routeCode, routeCode));
    if (routeStudents.length === 0) return;
    const studentIds = routeStudents.map((s) => s.id);
    const links = await db
      .select()
      .from(guardianStudentLinks)
      .where(and(inArray(guardianStudentLinks.studentId, studentIds), eq(guardianStudentLinks.active, true)));
    if (links.length === 0) return;
    const gIds = links.map((l) => l.guardianId);
    const gRows = await db.select().from(guardians).where(inArray(guardians.id, gIds));
    const userIds = Array.from(new Set(gRows.map((g) => g.userId).filter((id): id is number => id != null)));
    await sendMulticastPush(userIds, title, body, data);
  } catch {
    // ignore push lookup errors
  }
}

export interface TelemetryClientMeta {
  ws: WebSocket;
  user: DbUserRecord;
}

export interface SimulationState {
  running: boolean;
  tripId: number | null;
  routeCode: string;
  routeName: string;
  progress: number;
  nearestStopName: string;
  lastLat: number | null;
  lastLng: number | null;
  lastTickAt: string | null;
}

export class TelemetryHub {
  private wss: WebSocketServer;
  private clients = new Set<TelemetryClientMeta>();

  constructor(httpServer: http.Server) {
    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', async (req, socket, head) => {
      try {
        const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (reqUrl.pathname !== '/ws/telemetry') {
          // Allow Vite HMR ('/') or other upgrade listeners to handle non-telemetry paths
          return;
        }

        const token = reqUrl.searchParams.get('token');
        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const { dbUser } = await resolveDbUserFromToken(token);
        if (!dbUser.active) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(req, socket, head, (ws) => {
          const meta: TelemetryClientMeta = { ws, user: dbUser };
          this.clients.add(meta);

          ws.on('close', () => {
            this.clients.delete(meta);
          });

          ws.send(
            JSON.stringify({
              type: 'connected',
              payload: {
                role: dbUser.primaryRole,
                schoolId: dbUser.schoolId,
                connectedClients: this.clients.size,
              },
              timestamp: new Date().toISOString(),
            })
          );
        });
      } catch (err) {
        if (err instanceof AccountNotProvisionedError) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
        console.error('WebSocket /ws/telemetry auth failed:', err);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public broadcast(
    type:
      | 'trip:location'
      | 'geofence:approach_500m'
      | 'trip:state'
      | 'attendance:updated'
      | 'pin:validated'
      | 'incident:created'
      | 'incident:updated'
      | 'simulation:status',
    payload: Record<string, unknown>,
    options?: { schoolId?: number | null }
  ) {
    const serialized = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Enforce strict school scoping for school_admin
      if (
        options?.schoolId &&
        client.user.primaryRole === 'school_admin' &&
        client.user.schoolId &&
        client.user.schoolId !== options.schoolId
      ) {
        continue;
      }

      client.ws.send(serialized);
    }
  }

  public sendToUsers(
    userIds: number[],
    type: 'notification:created',
    payload: Record<string, unknown>
  ): number {
    if (userIds.length === 0) return 0;
    const allowedIds = new Set(userIds);
    const serialized = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    for (const client of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;
      if (!allowedIds.has(client.user.id)) continue;
      client.ws.send(serialized);
      sentCount += 1;
    }
    return sentCount;
  }
}

export class TripSimulationRunner {
  private hub: TelemetryHub;
  private timer: ReturnType<typeof setInterval> | null = null;
  private state: SimulationState = {
    running: false,
    tripId: null,
    routeCode: 'ROTA-A',
    routeName: 'Rota A · Morro Bento',
    progress: 0.08,
    nearestStopName: 'Mutamba',
    lastLat: null,
    lastLng: null,
    lastTickAt: null,
  };

  constructor(hub: TelemetryHub) {
    this.hub = hub;
  }

  public getStatus(): SimulationState {
    return { ...this.state };
  }

  public async start(routeCode = 'ROTA-A', actor?: DbUserRecord): Promise<SimulationState> {
    const requested = await getRouteWithStopsByCode(routeCode, { includeInactive: true });
    const allRoutes = requested ? [requested] : await loadRoutesWithStops();
    const route = requested ?? allRoutes[0];
    if (!route) {
      throw new Error('Nenhuma rota configurada na base de dados para simular.');
    }

    const matchingTrips = await db.select().from(trips).where(eq(trips.routeCode, route.code));
    const targetTrip = matchingTrips[0] ?? (await db.select().from(trips).limit(1))[0];
    if (!targetTrip) {
      throw new Error('Nenhuma viagem disponível no PostgreSQL para simular.');
    }

    this.state.routeCode = route.code;
    this.state.routeName = route.name;
    this.state.tripId = targetTrip.id;
    this.state.running = true;

    if (targetTrip.state === 'scheduled' || targetTrip.state === 'driver_checked_in' || targetTrip.state === 'completed') {
      await db
        .update(trips)
        .set({ state: 'in_progress', gpsStatus: 'live', emptyBusSweepVerified: false, updatedAt: new Date() })
        .where(eq(trips.id, targetTrip.id));
    }

    if (this.timer) clearInterval(this.timer);
    await this.advanceStep(0.035);

    this.timer = setInterval(() => {
      void this.advanceStep(0.035);
    }, 1500);

    if (actor) {
      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'simulation.started',
        targetEntity: 'trips',
        targetId: targetTrip.id,
        summary: `Simulação PostgreSQL + WebSocket iniciada na rota ${route.code}.`,
      });
    }

    this.hub.broadcast('simulation:status', { ...this.state });
    return this.getStatus();
  }

  public pause(): SimulationState {
    this.state.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.hub.broadcast('simulation:status', { ...this.state });
    return this.getStatus();
  }

  public async stepOnce(delta = 0.08): Promise<SimulationState> {
    if (!this.state.tripId) {
      const firstTrip = (await db.select().from(trips).where(eq(trips.routeCode, this.state.routeCode)))[0];
      if (firstTrip) this.state.tripId = firstTrip.id;
    }
    await this.advanceStep(delta);
    return this.getStatus();
  }

  public async reset(routeCode = 'ROTA-A'): Promise<SimulationState> {
    this.pause();
    const requested = await getRouteWithStopsByCode(routeCode, { includeInactive: true });
    const route = requested ?? (await loadRoutesWithStops())[0];
    if (!route) {
      throw new Error('Nenhuma rota configurada na base de dados para reiniciar.');
    }
    const matchingTrips = await db.select().from(trips).where(eq(trips.routeCode, route.code));
    const targetTrip = matchingTrips[0];

    this.state.routeCode = route.code;
    this.state.routeName = route.name;
    this.state.progress = 0.02;
    const [lat, lng] = pointAtRoute(route.pathCoordinates, 0.02);
    this.state.lastLat = lat;
    this.state.lastLng = lng;
    this.state.nearestStopName = route.stops[0]?.name ?? 'Início';
    this.state.lastTickAt = new Date().toISOString();

    if (targetTrip) {
      this.state.tripId = targetTrip.id;
      await db
        .update(trips)
        .set({
          state: 'in_progress',
          lastLat: String(lat),
          lastLng: String(lng),
          lastLocationAt: new Date(),
          gpsStatus: 'live',
          emptyBusSweepVerified: false,
          updatedAt: new Date(),
        })
        .where(eq(trips.id, targetTrip.id));

      this.hub.broadcast('trip:state', {
        tripId: targetTrip.id,
        tripCode: targetTrip.tripCode,
        state: 'in_progress',
        emptyBusSweepVerified: false,
      });
    }

    this.hub.broadcast('trip:location', {
      tripId: this.state.tripId,
      routeCode: route.code,
      lat,
      lng,
      progress: 0.02,
      nearestStopName: this.state.nearestStopName,
      gpsStatus: 'live',
    });
    this.hub.broadcast('simulation:status', { ...this.state });
    return this.getStatus();
  }

  private async advanceStep(delta: number) {
    if (!this.state.tripId) return;
    const route = await getRouteWithStopsByCode(this.state.routeCode, { includeInactive: true });
    if (!route) return;
    let nextProgress = this.state.progress + delta;
    if (nextProgress >= 1) {
      nextProgress = 1;
      if (this.state.running) {
        this.pause();
      }
    }

    const [lat, lng] = pointAtRoute(route.pathCoordinates, nextProgress);
    const geofence = checkRouteStopGeofences(route.stops, lat, lng);
    const nearestStopName = geofence.nearestStop?.stopName ?? route.name;

    this.state.progress = nextProgress;
    this.state.lastLat = lat;
    this.state.lastLng = lng;
    this.state.nearestStopName = nearestStopName;
    this.state.lastTickAt = new Date().toISOString();

    try {
      const updatedRows = await db
        .update(trips)
        .set({
          lastLat: String(lat),
          lastLng: String(lng),
          lastLocationAt: new Date(),
          gpsStatus: 'live',
          updatedAt: new Date(),
        })
        .where(eq(trips.id, this.state.tripId))
        .returning();

      const updatedTrip = updatedRows[0];
      this.hub.broadcast(
        'trip:location',
        {
          tripId: this.state.tripId,
          routeCode: route.code,
          lat,
          lng,
          progress: nextProgress,
          nearestStopName,
          distanceToNextStopM: geofence.nearestStop?.distanceMeters ?? null,
          etaMinutes: geofence.nearestStop?.etaMinutes ?? null,
          gpsStatus: 'live',
        },
        { schoolId: updatedTrip?.schoolId }
      );

      if (geofence.approaching500m.length > 0) {
        const stopHit = geofence.approaching500m[0]!;
        this.hub.broadcast(
          'geofence:approach_500m',
          {
            tripId: this.state.tripId,
            routeCode: route.code,
            stopName: stopHit.stopName,
            distanceMeters: stopHit.distanceMeters,
            etaMinutes: stopHit.etaMinutes,
          },
          { schoolId: updatedTrip?.schoolId }
        );
        void dispatchGuardianPushByRoute(
          route.code,
          `MôBuss ${route.code} a aproximar-se`,
          `Autocarro a ${stopHit.distanceMeters}m de ${stopHit.stopName} (~${stopHit.etaMinutes} min).`,
          { type: 'geofence_500m', routeCode: route.code, stopName: stopHit.stopName }
        );
      }

      this.hub.broadcast('simulation:status', { ...this.state });
    } catch (err) {
      console.error('Simulation tick DB update failed:', err);
    }
  }
}
