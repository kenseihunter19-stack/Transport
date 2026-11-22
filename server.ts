import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { and, desc, eq, ne, or, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  attendanceEvents,
  auditLogs,
  contracts,
  devicePushTokens,
  drivers,
  guardians,
  guardianStudentLinks,
  handoverCredentials,
  incidents,
  invoices,
  pricingConfigs,
  schoolContractRequests,
  schools,
  students,
  transportChangeRequests,
  trips,
  users,
  vehicleOwners,
  vehicles,
} from './src/db/schema.ts';
import { ensureDatabaseSeeded } from './src/db/seed.ts';
import {
  generateSecurePin,
  hashPassword,
  hashPin,
  issueSessionToken,
  requireAuth,
  requireRoles,
  toSafeDbUser,
  verifyPassword,
  writeAuditLog,
  type AuthRequest,
  type MoBussRole,
} from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import firebaseConfig from './firebase-applet-config.json';
import {
  dispatchGuardianPushByRoute,
  dispatchGuardianPushByStudent,
  TelemetryHub,
  TripSimulationRunner,
} from './src/server/realtime.ts';
import { checkStopGeofences, estimateRouteProgressFromCoords } from './src/lib/luanda-geofence.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_TRIP_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['driver_checked_in', 'cancelled', 'delayed', 'incident'],
  driver_checked_in: ['in_progress', 'delayed', 'cancelled', 'incident'],
  in_progress: ['at_stop', 'boarding', 'at_school', 'return_in_progress', 'handover_pending', 'completed', 'delayed', 'incident'],
  at_stop: ['boarding', 'in_progress', 'delayed', 'incident'],
  boarding: ['in_progress', 'at_school', 'delayed', 'incident'],
  at_school: ['return_in_progress', 'completed', 'delayed', 'incident'],
  return_in_progress: ['at_stop', 'handover_pending', 'completed', 'delayed', 'incident'],
  handover_pending: ['return_in_progress', 'completed', 'delayed', 'incident'],
  delayed: ['in_progress', 'at_stop', 'boarding', 'return_in_progress', 'handover_pending', 'completed', 'incident', 'cancelled'],
  incident: ['in_progress', 'delayed', 'cancelled', 'completed'],
  completed: [],
  cancelled: [],
};

const ADMIN_STAFF_ROLES: MoBussRole[] = [
  'mobuss_super_admin',
  'operations_manager',
  'fleet_manager',
  'school_account_manager',
  'finance_officer',
  'safety_support_agent',
];

const SCHOOL_PORTAL_ROLES: MoBussRole[] = [
  'school_admin',
  'mobuss_super_admin',
  'operations_manager',
  'school_account_manager',
];

const DRIVER_ROLES: MoBussRole[] = [
  'driver',
  'mobuss_super_admin',
  'operations_manager',
];

const OWNER_ROLES: MoBussRole[] = [
  'vehicle_owner',
  'mobuss_super_admin',
  'fleet_manager',
];

async function createApp() {
  const app = express();
  const httpServer = http.createServer(app);
  const telemetryHub = new TelemetryHub(httpServer);
  const simulationRunner = new TripSimulationRunner(telemetryHub);
  app.use(express.json({ limit: '1mb' }));

  // Allow Capacitor iOS (capacitor://localhost) and Android (https://localhost) WebView origins
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (
      origin &&
      (origin === 'capacitor://localhost' ||
        origin === 'ionic://localhost' ||
        origin === 'https://localhost' ||
        origin.startsWith('http://localhost') ||
        origin.endsWith('.run.app'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // ==========================================================================
  // 1. HEALTH & PUBLIC ENDPOINTS
  // ==========================================================================

  app.get('/api/v1/health', async (_req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      await ensureDatabaseSeeded();
      res.json({
        status: 'ok',
        dbConnected: true,
        latencyMs: Date.now() - startedAt,
        service: 'MôBuss Core API v1',
        timezone: 'Africa/Luanda',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Healthcheck DB probe failed:', error);
      res.status(503).json({
        status: 'degraded',
        dbConnected: false,
        latencyMs: Date.now() - startedAt,
        service: 'MôBuss Core API v1',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/api/v1/pricing/public', async (_req: Request, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const rows = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1);
      res.json({
        pricing: rows[0] ?? {
          studentMonthlyFeeAoa: 45000,
          schoolBusSingleShiftAoa: 250000,
          schoolBusDoubleShiftAoa: 350000,
          ivaPercent: 14,
          companyName: 'MôBuss Angola Transporte Escolar Lda.',
          companyNif: '5417209418',
          fiscalIntegrationStatus: 'sandbox_pending_agt_certification',
        },
        pricingNote:
          'Estimativa indicativa configurada pela MôBuss; sujeita a proposta formal e contrato aprovado.',
      });
    } catch (error) {
      console.error('Failed to fetch public pricing:', error);
      res.status(500).json({ error: 'Não foi possível carregar o tarifário.' });
    }
  });

  app.post('/api/v1/school-contract-requests', async (req: Request, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const body = req.body ?? {};
      const schoolName = String(body.schoolName ?? '').trim();
      const municipality = String(body.municipality ?? 'Luanda').trim();
      const shiftRegime = ['morning', 'afternoon', 'both'].includes(body.shiftRegime)
        ? String(body.shiftRegime)
        : 'both';
      const busesRequested = Math.max(1, Number(body.busesRequested) || 1);
      const studentsEstimate = Math.max(1, Number(body.studentsEstimate) || 20);
      const payerPreference = ['school', 'parent', 'mixed', 'configurable'].includes(body.payerPreference)
        ? String(body.payerPreference)
        : 'configurable';
      const contactName = String(body.contactName ?? '').trim();
      const contactPhone = String(body.contactPhone ?? '').trim();
      const contactEmail = body.contactEmail ? String(body.contactEmail).trim() : null;
      const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;

      if (!schoolName || schoolName.length < 3) {
        return res.status(400).json({ error: 'Indique o nome completo da instituição de ensino.' });
      }
      if (!contactName || contactPhone.length < 6) {
        return res.status(400).json({ error: 'Indique o responsável e um telefone válido.' });
      }

      const pricingRows = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1);
      const pricing = pricingRows[0];
      const perBus =
        shiftRegime === 'both'
          ? pricing?.schoolBusDoubleShiftAoa ?? 350000
          : pricing?.schoolBusSingleShiftAoa ?? 250000;
      const estimatedMonthlyAoa = busesRequested * perBus;
      const referenceCode = `REQ-2026-${crypto.randomInt(1000, 9999)}`;

      const inserted = await db
        .insert(schoolContractRequests)
        .values({
          referenceCode,
          schoolName,
          municipality,
          shiftRegime,
          busesRequested,
          studentsEstimate,
          estimatedMonthlyAoa,
          payerPreference,
          contactName,
          contactPhone,
          contactEmail,
          notes,
          status: 'request_received',
        })
        .returning();

      await writeAuditLog({
        actorUid: 'public_intake',
        actorEmail: contactEmail,
        actorRole: 'public',
        action: 'contract_request.submitted',
        targetEntity: 'school_contract_requests',
        targetId: inserted[0]?.id,
        summary: `Novo pedido público de contrato (${referenceCode}) submetido por ${schoolName}.`,
      });

      res.status(201).json({
        request: inserted[0],
        referenceCode,
        message: 'Pedido registado e encaminhado para a equipa comercial MôBuss.',
      });
    } catch (error) {
      console.error('Failed to submit contract request:', error);
      res.status(500).json({ error: 'Falha ao registar pedido de contrato.' });
    }
  });

  // ==========================================================================
  // 2. AUTH & PROFILE
  // ==========================================================================

  function buildCapabilities(role: string) {
    return {
      canAccessAdmin: ADMIN_STAFF_ROLES.includes(role as MoBussRole),
      canAccessSchoolPortal: SCHOOL_PORTAL_ROLES.includes(role as MoBussRole),
      canAccessDriverApp: DRIVER_ROLES.includes(role as MoBussRole),
      canManageRbac: role === 'mobuss_super_admin',
    };
  }

  app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const identifier = String(req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '')
        .trim()
        .toLowerCase();
      const password = String(req.body?.password ?? '');

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Indique o utilizador/e-mail e a palavra-passe.' });
      }

      const matched = await db
        .select()
        .from(users)
        .where(
          or(
            sql`lower(${users.username}) = ${identifier}`,
            sql`lower(${users.email}) = ${identifier}`,
            ...(identifier.includes('@') ? [] : [sql`lower(${users.email}) = ${`${identifier}@mobuss.ao`}`])
          )
        )
        .limit(1);

      const userRow = matched[0];
      if (!userRow || !userRow.passwordHash || !userRow.passwordSalt) {
        await writeAuditLog({
          actorUid: 'anonymous',
          actorEmail: identifier,
          actorRole: 'anonymous',
          action: 'auth.login_failed',
          targetEntity: 'auth',
          targetId: identifier,
          summary: `Tentativa de login falhada para identificador "${identifier}".`,
        });
        return res.status(401).json({ error: 'Utilizador ou palavra-passe inválidos.' });
      }

      if (!userRow.active) {
        return res.status(403).json({
          code: 'ACCOUNT_DISABLED',
          error: 'Conta desativada pelo administrador MôBuss.',
        });
      }

      const valid = verifyPassword(password, userRow.passwordSalt, userRow.passwordHash);
      if (!valid) {
        await writeAuditLog({
          actorUid: userRow.uid,
          actorEmail: userRow.email,
          actorRole: userRow.primaryRole,
          action: 'auth.login_failed',
          targetEntity: 'users',
          targetId: userRow.id,
          summary: `Palavra-passe incorreta para conta "${identifier}".`,
        });
        return res.status(401).json({ error: 'Utilizador ou palavra-passe inválidos.' });
      }

      const safeUser = toSafeDbUser(userRow);
      const token = issueSessionToken(safeUser);
      let school = null;
      if (safeUser.schoolId) {
        const sRows = await db.select().from(schools).where(eq(schools.id, safeUser.schoolId)).limit(1);
        school = sRows[0] ?? null;
      }

      await writeAuditLog({
        actorUid: safeUser.uid,
        actorEmail: safeUser.email,
        actorRole: safeUser.primaryRole,
        action: 'auth.login_success',
        targetEntity: 'users',
        targetId: safeUser.id,
        summary: `Sessão iniciada por credenciais (${safeUser.username || safeUser.email}).`,
      });

      res.json({
        token,
        user: safeUser,
        school,
        capabilities: buildCapabilities(safeUser.primaryRole),
      });
    } catch (error) {
      console.error('Credential login failed:', error);
      res.status(500).json({ error: 'Erro ao iniciar sessão.' });
    }
  });

  app.get('/api/v1/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const dbUser = req.dbUser!;
      let school = null;
      if (dbUser.schoolId) {
        const sRows = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
        school = sRows[0] ?? null;
      }
      res.json({
        user: dbUser,
        school,
        capabilities: buildCapabilities(dbUser.primaryRole),
      });
    } catch (error) {
      console.error('Failed to resolve /auth/me:', error);
      res.status(500).json({ error: 'Erro ao obter perfil autenticado.' });
    }
  });

  app.post('/api/v1/auth/deletion-request', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const reason = String(req.body?.reason ?? 'Pedido submetido na aplicação').trim().slice(0, 600);
      const referenceId = `DEL-${new Date().getFullYear()}-${crypto.randomInt(1000, 9999)}`;

      await db.insert(incidents).values({
        schoolId: dbUser.schoolId ?? null,
        category: 'account_deletion_request',
        severity: 'high',
        description: `[${referenceId}] Pedido de eliminação/desativação de conta (${dbUser.username || dbUser.email}): ${reason}`,
        reporterName: dbUser.fullName,
        reporterRole: dbUser.primaryRole,
        status: 'new',
      });

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'auth.deletion_requested',
        targetEntity: 'users',
        targetId: dbUser.id,
        summary: `Titular solicitou eliminação/desativação de conta (${referenceId}).`,
      });

      res.status(201).json({
        referenceId,
        message: 'Pedido de eliminação de conta registado e encaminhado à Administração MôBuss.',
      });
    } catch (error) {
      console.error('Failed to submit account deletion request:', error);
      res.status(500).json({ error: 'Falha ao registar pedido de eliminação.' });
    }
  });

  app.post('/api/v1/devices/push-token', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const token = String(req.body?.token ?? '').trim();
      const platform = ['ios', 'android', 'web'].includes(String(req.body?.platform))
        ? String(req.body.platform)
        : 'android';
      const appTarget = ['client', 'driver', 'hub'].includes(String(req.body?.appTarget))
        ? String(req.body.appTarget)
        : 'client';

      if (!token) {
        return res.status(400).json({ error: 'Token de notificação push obrigatório.' });
      }

      await db
        .insert(devicePushTokens)
        .values({
          userId: dbUser.id,
          platform,
          appTarget,
          token,
          active: true,
        })
        .onConflictDoUpdate({
          target: devicePushTokens.token,
          set: {
            userId: dbUser.id,
            platform,
            appTarget,
            active: true,
            updatedAt: new Date(),
          },
        });

      res.json({ registered: true, platform, appTarget });
    } catch (error) {
      console.error('Push token registration failed:', error);
      res.status(500).json({ error: 'Erro ao registar dispositivo push.' });
    }
  });

  // ==========================================================================
  // 3. GUARDIAN / CLIENT APP ENDPOINTS
  // ==========================================================================

  app.get('/api/v1/guardian/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const dbUser = req.dbUser!;
      const isSuperAdminPreview = dbUser.primaryRole === 'mobuss_super_admin';

      let linkedStudentsList = [] as typeof students.$inferSelect[];
      if (isSuperAdminPreview) {
        linkedStudentsList = await db.select().from(students).orderBy(students.id);
      } else {
        let guardianRows = await db
          .select()
          .from(guardians)
          .where(eq(guardians.userId, dbUser.id))
          .limit(1);

        // If school/admin invited this guardian by email earlier, bind their userId on login
        if (guardianRows.length === 0 && dbUser.email) {
          const emailMatch = await db
            .select()
            .from(guardians)
            .where(eq(guardians.email, dbUser.email))
            .limit(1);
          if (emailMatch[0]) {
            const bound = await db
              .update(guardians)
              .set({ userId: dbUser.id, verificationStatus: 'verified' })
              .where(eq(guardians.id, emailMatch[0].id))
              .returning();
            guardianRows = bound;
          }
        }

        if (guardianRows[0]) {
          const links = await db
            .select()
            .from(guardianStudentLinks)
            .where(and(eq(guardianStudentLinks.guardianId, guardianRows[0].id), eq(guardianStudentLinks.active, true)));
          const allSt = await db.select().from(students);
          const allowedIds = new Set(links.map((l) => l.studentId));
          linkedStudentsList = allSt.filter((s) => allowedIds.has(s.id));
        }
      }

      const allSchools = await db.select().from(schools);
      const schoolById = new Map(allSchools.map((s) => [s.id, s]));

      const activeTrips = await db.select().from(trips).orderBy(desc(trips.id));
      const allVehicles = await db.select().from(vehicles);
      const allDrivers = await db.select().from(drivers);
      const vehicleById = new Map(allVehicles.map((v) => [v.id, v]));
      const driverById = new Map(allDrivers.map((d) => [d.id, d]));

      const allCreds = await db
        .select()
        .from(handoverCredentials)
        .where(eq(handoverCredentials.status, 'active'))
        .orderBy(desc(handoverCredentials.id));

      const credByStudentId = new Map<number, typeof handoverCredentials.$inferSelect>();
      for (const c of allCreds) {
        if (!credByStudentId.has(c.studentId)) credByStudentId.set(c.studentId, c);
      }

      const enrichedStudents = linkedStudentsList.map((st) => {
        const cred = credByStudentId.get(st.id);
        const trip = activeTrips.find((t) => t.routeCode === st.routeCode) ?? null;
        const vehicle = trip?.vehicleId ? vehicleById.get(trip.vehicleId) ?? null : null;
        const driver = trip?.driverId ? driverById.get(trip.driverId) ?? null : null;
        return {
          id: st.id,
          fullName: st.fullName,
          schoolName: schoolById.get(st.schoolId)?.name ?? 'Escola Parceira',
          routeCode: st.routeCode,
          stopName: st.stopName,
          stopIndex: st.stopIndex,
          currentJourneyState: st.currentJourneyState,
          pinPolicy: st.pinPolicy,
          handoverCredential: cred
            ? {
                maskedDisplay: cred.maskedDisplay,
                status: cred.status,
                expiresAt: cred.expiresAt,
                tripScope: cred.tripScope,
                lockedUntil: cred.lockedUntil,
              }
            : null,
          activeTrip: trip
            ? {
                id: trip.id,
                tripCode: trip.tripCode,
                routeName: trip.routeName,
                legType: trip.legType,
                state: trip.state,
                gpsStatus: trip.gpsStatus,
                lastLat: trip.lastLat,
                lastLng: trip.lastLng,
                lastLocationAt: trip.lastLocationAt,
                vehiclePlate: vehicle?.plate ?? null,
                fleetNumber: vehicle?.fleetNumber ?? null,
                driverName: driver?.fullName ?? null,
              }
            : null,
        };
      });

      const pricingRows = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1);
      const invoiceRows = await db.select().from(invoices).orderBy(desc(invoices.id)).limit(15);
      const incidentRows = await db.select().from(incidents).orderBy(desc(incidents.id)).limit(10);

      res.json({
        students: enrichedStudents,
        pricing: pricingRows[0] ?? null,
        invoices: invoiceRows,
        incidents: incidentRows.filter((i) => i.status !== 'closed'),
      });
    } catch (error) {
      console.error('Guardian dashboard failed:', error);
      res.status(500).json({ error: 'Falha ao carregar painel do encarregado.' });
    }
  });

  app.post('/api/v1/guardian/handover-credentials/rotate', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentId = Number(req.body?.studentId);
      if (!studentId) {
        return res.status(400).json({ error: 'studentId é obrigatório.' });
      }

      // Verify ownership unless mobuss_super_admin
      if (dbUser.primaryRole !== 'mobuss_super_admin') {
        const gRows = await db.select().from(guardians).where(eq(guardians.userId, dbUser.id)).limit(1);
        const g = gRows[0];
        if (!g) {
          return res.status(403).json({ error: 'Acesso negado: perfil de encarregado não vinculado.' });
        }
        const links = await db
          .select()
          .from(guardianStudentLinks)
          .where(
            and(
              eq(guardianStudentLinks.guardianId, g.id),
              eq(guardianStudentLinks.studentId, studentId),
              eq(guardianStudentLinks.active, true)
            )
          );
        if (links.length === 0) {
          return res.status(403).json({ error: 'Não está autorizado a gerir o PIN deste educando.' });
        }
      }

      await db
        .update(handoverCredentials)
        .set({ status: 'revoked' })
        .where(and(eq(handoverCredentials.studentId, studentId), eq(handoverCredentials.status, 'active')));

      const { pin, salt, hash } = generateSecurePin();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

      await db.insert(handoverCredentials).values({
        studentId,
        tripScope: 'both',
        pinHash: hash,
        pinSalt: salt,
        maskedDisplay: '••••',
        status: 'active',
        failedAttempts: 0,
        expiresAt,
      });

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'pin.rotated_by_guardian',
        targetEntity: 'students',
        targetId: studentId,
        summary: `Encarregado gerou novo PIN criptografado (uso único, embarque e desembarque).`,
      });

      // Only returned once directly to the authenticated guardian session
      res.json({
        pin,
        tripScope: 'both',
        expiresAt: expiresAt.toISOString(),
        message: 'Novo PIN de segurança gerado. Partilhe apenas com o motorista no embarque/desembarque.',
      });
    } catch (error) {
      console.error('PIN rotation failed:', error);
      res.status(500).json({ error: 'Erro ao gerar novo PIN seguro.' });
    }
  });

  app.post('/api/v1/guardian/absences', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentId = Number(req.body?.studentId);
      const reason = String(req.body?.reason ?? 'Ausência comunicada pelo encarregado').trim();
      const eventId = String(req.body?.eventId || crypto.randomUUID());

      if (!studentId) {
        return res.status(400).json({ error: 'studentId obrigatório.' });
      }

      await db
        .insert(attendanceEvents)
        .values({
          eventId,
          studentId,
          actorUid: dbUser.uid,
          eventType: 'absent',
          occurredAt: new Date(),
          verificationResult: 'accepted',
          notes: reason,
        })
        .onConflictDoNothing({ target: attendanceEvents.eventId });

      await db
        .update(students)
        .set({ currentJourneyState: 'absent' })
        .where(eq(students.id, studentId));

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'attendance.absence_reported',
        targetEntity: 'students',
        targetId: studentId,
        summary: `Ausência registada pelo encarregado: ${reason}`,
      });

      telemetryHub.broadcast('attendance:updated', {
        studentId,
        eventType: 'absent',
        reason,
        occurredAt: new Date().toISOString(),
      });

      res.status(201).json({ status: 'accepted', eventId, message: 'Ausência registada na pauta oficial.' });
    } catch (error) {
      console.error('Absence submission failed:', error);
      res.status(500).json({ error: 'Não foi possível registar a ausência.' });
    }
  });

  app.post('/api/v1/guardian/payment-intents', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentName = String(req.body?.studentName ?? 'Maria Domingos').trim();
      const guardianName = String(req.body?.guardianName ?? dbUser.fullName).trim();
      const phone = String(req.body?.phone ?? dbUser.phone ?? '+244 923 456 789').trim();

      const pricingRows = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1);
      const amountAoa = pricingRows[0]?.studentMonthlyFeeAoa ?? 45000;
      const paymentEntity = (pricingRows[0]?.multicaixaEntityCode || '00845').trim();
      const p1 = String(crypto.randomInt(100, 999));
      const p2 = String(crypto.randomInt(100, 999));
      const p3 = String(crypto.randomInt(100, 999));
      const paymentReferencePin = `${p1} ${p2} ${p3}`;
      const invoiceNumber = `PRO-MOB-2026/${crypto.randomInt(1000, 9999)}`;
      const providerReference = `ENT-${paymentEntity}-PIN-${p1}${p2}${p3}`;

      const inserted = await db
        .insert(invoices)
        .values({
          invoiceNumber,
          studentName,
          guardianName,
          payerType: 'guardian',
          phone,
          amountAoa,
          paymentMethod: 'multicaixa_express_entity',
          paymentEntity,
          paymentReferencePin,
          status: 'pending_provider',
          providerReference,
          fiscalStatus: 'proforma_unverified',
        })
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'payment.entity_pin_generated',
        targetEntity: 'invoices',
        targetId: inserted[0]?.id,
        summary: `Referência Multicaixa Express gerada (${invoiceNumber} · Entidade ${paymentEntity} · PIN ${paymentReferencePin} · ${amountAoa} Kz).`,
      });

      res.status(201).json({
        invoice: inserted[0],
        paymentEntity,
        paymentReferencePin,
        amountAoa,
        message: `Referência gerada para Multicaixa Express: Entidade ${paymentEntity} · PIN ${paymentReferencePin}.`,
      });
    } catch (error) {
      console.error('Payment intent failed:', error);
      res.status(500).json({ error: 'Falha ao gerar PIN de pagamento.' });
    }
  });

  // ==========================================================================
  // 3B. VEHICLE OWNER (PROPRIETÁRIO PARCEIRO) ENDPOINT
  // ==========================================================================

  app.get('/api/v1/owner/dashboard', requireAuth, requireRoles(OWNER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const dbUser = req.dbUser!;
      const allOwners = await db.select().from(vehicleOwners).orderBy(vehicleOwners.id);
      const requestedOwnerId = Number(req.query.ownerId);

      let owner =
        dbUser.primaryRole === 'vehicle_owner'
          ? allOwners.find((o) => o.id === dbUser.ownerId) ??
            allOwners.find((o) => o.email && o.email.toLowerCase() === dbUser.email.toLowerCase()) ??
            allOwners.find((o) => o.fullName.toLowerCase() === dbUser.fullName.toLowerCase()) ??
            null
          : (requestedOwnerId ? allOwners.find((o) => o.id === requestedOwnerId) : null) ??
            allOwners.find((o) => o.ownerType === 'independent') ??
            allOwners[0] ??
            null;

      if (!owner) {
        return res.json({
          owner: null,
          vehicles: [],
          summary: {
            totalVehicles: 0,
            activeVehicles: 0,
            dnvtValidCount: 0,
            insuranceValidCount: 0,
            estimatedMonthlySettlementAoa: 0,
          },
        });
      }

      const ownerVehicles = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.ownerId, owner.id))
        .orderBy(vehicles.fleetNumber);

      const allDrivers = await db.select().from(drivers);
      const allTrips = await db.select().from(trips).orderBy(desc(trips.id));
      const driverMap = new Map(allDrivers.map((d) => [d.id, d]));

      const enrichedVehicles = ownerVehicles.map((v) => {
        const assignedDriver = v.assignedDriverId ? driverMap.get(v.assignedDriverId) : null;
        const activeTrip =
          allTrips.find((t) => t.vehicleId === v.id) ??
          (v.routeCode ? allTrips.find((t) => t.routeCode === v.routeCode) : null) ??
          null;

        return {
          id: v.id,
          fleetNumber: v.fleetNumber,
          plate: v.plate,
          ownershipType: v.ownershipType,
          routeCode: v.routeCode ?? '—',
          routeName: v.routeName ?? 'Sem rota atribuída',
          capacity: v.capacity,
          status: v.status,
          fuelPercent: v.fuelPercent,
          dnvtExpiry: v.dnvtExpiry,
          dnvtStatus: v.dnvtStatus,
          insuranceProvider: v.insuranceProvider,
          insuranceStatus: v.insuranceStatus,
          verificationStatus: v.verificationStatus,
          assignedDriverName: assignedDriver?.fullName ?? 'Por alocar',
          assignedDriverPhone: assignedDriver?.phone ?? '—',
          activeTripCode: activeTrip?.tripCode ?? null,
          activeTripState: activeTrip?.state ?? null,
        };
      });

      const activeVehicles = enrichedVehicles.filter((v) =>
        ['assigned', 'on_trip', 'available'].includes(v.status)
      ).length;
      const dnvtValidCount = enrichedVehicles.filter((v) => v.dnvtStatus === 'valid').length;
      const insuranceValidCount = enrichedVehicles.filter((v) =>
        ['valid', 'active'].includes(v.insuranceStatus)
      ).length;
      const estimatedMonthlySettlementAoa =
        enrichedVehicles.length === 0
          ? 0
          : owner.monthlySettlementAoa > 0
          ? owner.monthlySettlementAoa * enrichedVehicles.length
          : enrichedVehicles.length * 350000;

      res.json({
        owner,
        vehicles: enrichedVehicles,
        summary: {
          totalVehicles: enrichedVehicles.length,
          activeVehicles,
          dnvtValidCount,
          insuranceValidCount,
          estimatedMonthlySettlementAoa,
        },
      });
    } catch (error) {
      console.error('Owner dashboard failed:', error);
      res.status(500).json({ error: 'Erro ao carregar portal do proprietário parceiro.' });
    }
  });

  // ==========================================================================
  // 4. DRIVER APP ENDPOINTS (Trips State Machine, Real GPS, Server-Side PIN)
  // ==========================================================================

  app.get('/api/v1/driver/dashboard', requireAuth, requireRoles(DRIVER_ROLES), async (_req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const allTrips = await db.select().from(trips).orderBy(trips.id);
      const allVehicles = await db.select().from(vehicles);
      const allDrivers = await db.select().from(drivers);
      const allStudents = await db.select().from(students).orderBy(students.id);
      const activeEvents = await db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.id)).limit(50);

      // NEVER return pickupPin plaintext in manifest!
      const safeManifest = allStudents.map((st) => ({
        id: st.id,
        fullName: st.fullName,
        routeCode: st.routeCode,
        stopName: st.stopName,
        stopIndex: st.stopIndex,
        currentJourneyState: st.currentJourneyState,
        pinPolicy: st.pinPolicy,
      }));

      res.json({
        trips: allTrips,
        vehicles: allVehicles,
        drivers: allDrivers,
        manifest: safeManifest,
        recentEvents: activeEvents,
      });
    } catch (error) {
      console.error('Driver dashboard failed:', error);
      res.status(500).json({ error: 'Erro ao carregar consola do motorista.' });
    }
  });

  app.post('/api/v1/driver/trips/:id/transition', requireAuth, requireRoles(DRIVER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const tripId = Number(req.params.id);
      const nextState = String(req.body?.nextState ?? '');
      const existingRows = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
      const trip = existingRows[0];
      if (!trip) {
        return res.status(404).json({ error: 'Viagem não encontrada.' });
      }

      const allowed = ALLOWED_TRIP_TRANSITIONS[trip.state] ?? [];
      if (!allowed.includes(nextState)) {
        return res.status(400).json({
          error: `Transição inválida de "${trip.state}" para "${nextState}".`,
          allowedTransitions: allowed,
        });
      }

      if (nextState === 'completed' && !trip.emptyBusSweepVerified) {
        return res.status(400).json({
          error: 'Inspeção anti-esquecimento obrigatória antes de concluir a viagem.',
        });
      }

      const updated = await db
        .update(trips)
        .set({ state: nextState, updatedAt: new Date() })
        .where(eq(trips.id, tripId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'trip.state_changed',
        targetEntity: 'trips',
        targetId: tripId,
        summary: `Estado da viagem ${trip.tripCode} alterado: ${trip.state} → ${nextState}.`,
        before: { state: trip.state },
        after: { state: nextState },
      });

      res.json({ trip: updated[0] });

      telemetryHub.broadcast(
        'trip:state',
        {
          tripId,
          tripCode: trip.tripCode,
          state: nextState,
          emptyBusSweepVerified: updated[0]?.emptyBusSweepVerified ?? false,
        },
        { schoolId: trip.schoolId }
      );
    } catch (error) {
      console.error('Trip transition error:', error);
      res.status(500).json({ error: 'Erro ao atualizar estado da viagem.' });
    }
  });

  app.post('/api/v1/driver/location-batches', requireAuth, requireRoles(DRIVER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const tripId = Number(req.body?.tripId);
      const lat = String(req.body?.latitude ?? '');
      const lng = String(req.body?.longitude ?? '');
      if (!tripId || !lat || !lng) {
        return res.status(400).json({ error: 'tripId, latitude e longitude são obrigatórios.' });
      }

      const updated = await db
        .update(trips)
        .set({
          lastLat: lat,
          lastLng: lng,
          lastLocationAt: new Date(),
          gpsStatus: 'live',
          updatedAt: new Date(),
        })
        .where(eq(trips.id, tripId))
        .returning();

      const updatedTrip = updated[0];
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (updatedTrip && Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        const progress = estimateRouteProgressFromCoords(updatedTrip.routeCode, latNum, lngNum);
        const geofence = checkStopGeofences(updatedTrip.routeCode, latNum, lngNum);

        telemetryHub.broadcast(
          'trip:location',
          {
            tripId: updatedTrip.id,
            routeCode: updatedTrip.routeCode,
            lat: latNum,
            lng: lngNum,
            progress,
            nearestStopName: geofence.nearestStop.stopName,
            distanceToNextStopM: geofence.nearestStop.distanceMeters,
            etaMinutes: geofence.nearestStop.etaMinutes,
            gpsStatus: 'live',
          },
          { schoolId: updatedTrip.schoolId }
        );

        if (geofence.approaching500m.length > 0) {
          const stopHit = geofence.approaching500m[0]!;
          telemetryHub.broadcast(
            'geofence:approach_500m',
            {
              tripId: updatedTrip.id,
              routeCode: updatedTrip.routeCode,
              stopName: stopHit.stopName,
              distanceMeters: stopHit.distanceMeters,
              etaMinutes: stopHit.etaMinutes,
            },
            { schoolId: updatedTrip.schoolId }
          );
          void dispatchGuardianPushByRoute(
            updatedTrip.routeCode,
            `MôBuss ${updatedTrip.routeCode} a aproximar-se`,
            `Autocarro a ${stopHit.distanceMeters}m de ${stopHit.stopName} (~${stopHit.etaMinutes} min).`,
            { type: 'geofence_500m', routeCode: updatedTrip.routeCode, stopName: stopHit.stopName }
          );
        }
      }

      res.json({ trip: updatedTrip });
    } catch (error) {
      console.error('GPS batch update failed:', error);
      res.status(500).json({ error: 'Erro ao gravar telemetria GPS.' });
    }
  });

  app.post('/api/v1/driver/trips/:id/attendance-events', requireAuth, requireRoles(DRIVER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const tripId = Number(req.params.id);
      const studentId = Number(req.body?.studentId);
      const eventType = String(req.body?.eventType ?? '');
      const eventId = String(req.body?.eventId || crypto.randomUUID());
      const offlineSequence = req.body?.offlineSequence != null ? Number(req.body.offlineSequence) : null;

      if (!studentId || !eventType) {
        return res.status(400).json({ error: 'studentId e eventType obrigatórios.' });
      }

      await db
        .insert(attendanceEvents)
        .values({
          eventId,
          tripId,
          studentId,
          actorUid: dbUser.uid,
          eventType,
          occurredAt: req.body?.occurredAt ? new Date(req.body.occurredAt) : new Date(),
          offlineSequence,
          latitude: req.body?.latitude ? String(req.body.latitude) : null,
          longitude: req.body?.longitude ? String(req.body.longitude) : null,
          verificationResult: 'accepted',
          notes: req.body?.notes ? String(req.body.notes) : null,
        })
        .onConflictDoNothing({ target: attendanceEvents.eventId });

      await db
        .update(students)
        .set({ currentJourneyState: eventType })
        .where(eq(students.id, studentId));

      telemetryHub.broadcast('attendance:updated', {
        tripId,
        studentId,
        eventType,
        occurredAt: new Date().toISOString(),
      });

      res.status(201).json({ status: 'accepted', eventId });
    } catch (error) {
      console.error('Attendance event failed:', error);
      res.status(500).json({ error: 'Erro ao registar evento de presença.' });
    }
  });

  // Server-side PIN validation for BOTH boarding and drop-off (rate-limited + audited, NEVER returns expected PIN!)
  app.post('/api/v1/driver/handover/validate', requireAuth, requireRoles(DRIVER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentId = Number(req.body?.studentId);
      const tripId = req.body?.tripId ? Number(req.body.tripId) : null;
      const enteredPin = String(req.body?.pin ?? '').trim();
      const pinPhase = req.body?.pinPhase === 'boarding' ? 'boarding' : 'dropoff';

      if (!studentId || !/^\d{4}$/.test(enteredPin)) {
        return res.status(400).json({ valid: false, error: 'Indique o aluno e um código PIN de 4 dígitos.' });
      }

      const creds = await db
        .select()
        .from(handoverCredentials)
        .where(and(eq(handoverCredentials.studentId, studentId), eq(handoverCredentials.status, 'active')))
        .orderBy(desc(handoverCredentials.id))
        .limit(1);

      const cred = creds[0];
      if (!cred) {
        return res.status(404).json({
          valid: false,
          error: 'Nenhum PIN ativo encontrado para este educando. Solicite rotação ao encarregado ou contacte Operações.',
        });
      }

      if (cred.lockedUntil && new Date(cred.lockedUntil).getTime() > Date.now()) {
        return res.status(429).json({
          valid: false,
          locked: true,
          error: 'PIN temporariamente bloqueado após várias tentativas. Escalado para Operações MôBuss.',
        });
      }

      if (new Date(cred.expiresAt).getTime() < Date.now()) {
        await db.update(handoverCredentials).set({ status: 'expired' }).where(eq(handoverCredentials.id, cred.id));
        return res.status(400).json({
          valid: false,
          error: 'PIN expirado. O encarregado deve gerar um novo código na app.',
        });
      }

      const candidateHash = hashPin(enteredPin, cred.pinSalt);
      const isMatch = crypto.timingSafeEqual(Buffer.from(candidateHash, 'hex'), Buffer.from(cred.pinHash, 'hex'));

      if (!isMatch) {
        const nextAttempts = cred.failedAttempts + 1;
        const lockTrigger = nextAttempts >= 5;
        const lockedUntil = lockTrigger ? new Date(Date.now() + 15 * 60 * 1000) : null;

        await db
          .update(handoverCredentials)
          .set({ failedAttempts: nextAttempts, lockedUntil })
          .where(eq(handoverCredentials.id, cred.id));

        await db.insert(attendanceEvents).values({
          eventId: crypto.randomUUID(),
          tripId,
          studentId,
          actorUid: dbUser.uid,
          eventType: 'pin_failed',
          pinPhase,
          occurredAt: new Date(),
          verificationResult: 'invalid',
          notes: `Tentativa de PIN inválida (${pinPhase}) — tentativa ${nextAttempts}/5.`,
        });

        if (lockTrigger) {
          await db.insert(incidents).values({
            tripId,
            category: 'pin_failure',
            severity: 'high',
            description: `Bloqueio de segurança: 5 tentativas de PIN falhadas para aluno #${studentId} (${pinPhase}).`,
            reporterName: dbUser.fullName,
            reporterRole: dbUser.primaryRole,
            status: 'new',
          });
        }

        await writeAuditLog({
          actorUid: dbUser.uid,
          actorEmail: dbUser.email,
          actorRole: dbUser.primaryRole,
          action: 'handover.pin_failed',
          targetEntity: 'students',
          targetId: studentId,
          summary: `Validação de PIN falhada na fase ${pinPhase} (tentativa ${nextAttempts}/5).`,
        });

        return res.status(lockTrigger ? 429 : 400).json({
          valid: false,
          locked: lockTrigger,
          remainingAttempts: Math.max(0, 5 - nextAttempts),
          error: lockTrigger
            ? 'Limite de tentativas excedido. Caso escalado para a Central MôBuss.'
            : 'Código PIN inválido. Verifique com o encarregado autorizado.',
        });
      }

      // Single-use success: mark credential used & record append-only attendance event
      await db
        .update(handoverCredentials)
        .set({ status: 'used', usedAt: new Date() })
        .where(eq(handoverCredentials.id, cred.id));

      // Because policy is BOTH boarding and drop-off, auto-issue next single-use credential after boarding!
      let rotatedForDropoff = false;
      if (pinPhase === 'boarding') {
        const nextCred = generateSecurePin();
        await db.insert(handoverCredentials).values({
          studentId,
          tripScope: 'dropoff',
          pinHash: nextCred.hash,
          pinSalt: nextCred.salt,
          maskedDisplay: '••••',
          status: 'active',
          failedAttempts: 0,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        });
        rotatedForDropoff = true;
      }

      const nextJourneyState = pinPhase === 'boarding' ? 'boarded' : 'handed_over';
      await db.insert(attendanceEvents).values({
        eventId: crypto.randomUUID(),
        tripId,
        studentId,
        actorUid: dbUser.uid,
        eventType: nextJourneyState,
        pinPhase,
        occurredAt: new Date(),
        verificationResult: 'valid',
        notes:
          pinPhase === 'boarding'
            ? 'Embarque validado com PIN de segurança.'
            : 'Entrega segura confirmada com PIN de uso único.',
      });

      await db
        .update(students)
        .set({ currentJourneyState: nextJourneyState })
        .where(eq(students.id, studentId));

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: `handover.pin_validated_${pinPhase}`,
        targetEntity: 'students',
        targetId: studentId,
        summary: `PIN validado com sucesso na fase ${pinPhase}. Estado atualizado para ${nextJourneyState}.`,
      });

      telemetryHub.broadcast('pin:validated', {
        tripId,
        studentId,
        pinPhase,
        journeyState: nextJourneyState,
        rotatedForDropoff,
      });

      telemetryHub.broadcast('attendance:updated', {
        tripId,
        studentId,
        eventType: nextJourneyState,
        pinPhase,
        occurredAt: new Date().toISOString(),
      });

      void dispatchGuardianPushByStudent(
        studentId,
        pinPhase === 'boarding' ? 'Embarque Confirmado · MôBuss' : 'Entrega Segura Confirmada · MôBuss',
        pinPhase === 'boarding'
          ? 'O seu educando embarcou com PIN validado. Novo código de entrega disponível na app.'
          : 'Entrega do educando confirmada em segurança com PIN de uso único.',
        { type: 'pin_validated', studentId: String(studentId), pinPhase }
      );

      res.json({
        valid: true,
        pinPhase,
        journeyState: nextJourneyState,
        rotatedForDropoff,
        message:
          pinPhase === 'boarding'
            ? 'PIN de embarque validado! Novo código de entrega gerado para o encarregado.'
            : 'PIN de entrega validado! Educando entregue em segurança.',
      });
    } catch (error) {
      console.error('Server PIN validation failed:', error);
      res.status(500).json({ valid: false, error: 'Erro ao validar PIN no servidor.' });
    }
  });

  app.post('/api/v1/driver/trips/:id/empty-sweep', requireAuth, requireRoles(DRIVER_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const tripId = Number(req.params.id);
      const updated = await db
        .update(trips)
        .set({
          emptyBusSweepVerified: true,
          emptyBusSweepAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trips.id, tripId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'trip.empty_bus_sweep',
        targetEntity: 'trips',
        targetId: tripId,
        summary: `Inspeção anti-esquecimento confirmada pelo motorista na viagem #${tripId}.`,
      });

      telemetryHub.broadcast('trip:state', {
        tripId,
        tripCode: updated[0]?.tripCode,
        state: updated[0]?.state,
        emptyBusSweepVerified: true,
      });

      res.json({ trip: updated[0] });
    } catch (error) {
      console.error('Empty bus sweep failed:', error);
      res.status(500).json({ error: 'Erro ao registar inspeção anti-esquecimento.' });
    }
  });

  // ==========================================================================
  // 5. SHARED INCIDENTS / SOS / WAZE ROAD REPORTS
  // ==========================================================================

  app.post('/api/v1/incidents', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const category = String(req.body?.category ?? 'general_sos').trim();
      const severity = ['low', 'medium', 'high', 'critical'].includes(req.body?.severity)
        ? String(req.body.severity)
        : 'high';
      const description = String(req.body?.description ?? '').trim();
      const routeCode = req.body?.routeCode ? String(req.body.routeCode) : null;
      const busNumber = req.body?.busNumber ? Number(req.body.busNumber) : null;

      if (!description) {
        return res.status(400).json({ error: 'Descrição da ocorrência obrigatória.' });
      }

      const inserted = await db
        .insert(incidents)
        .values({
          tripId: req.body?.tripId ? Number(req.body.tripId) : null,
          schoolId: dbUser.schoolId ?? null,
          busNumber,
          routeCode,
          category,
          severity,
          description,
          reporterName: dbUser.fullName,
          reporterRole: dbUser.primaryRole,
          status: 'new',
        })
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'incident.created',
        targetEntity: 'incidents',
        targetId: inserted[0]?.id,
        summary: `Nova ocorrência (${category}/${severity}) reportada por ${dbUser.fullName}.`,
      });

      telemetryHub.broadcast(
        'incident:created',
        { incident: inserted[0] },
        { schoolId: dbUser.schoolId }
      );

      res.status(201).json({ incident: inserted[0] });
    } catch (error) {
      console.error('Create incident failed:', error);
      res.status(500).json({ error: 'Erro ao criar ocorrência no servidor.' });
    }
  });

  // ==========================================================================
  // 6. SCHOOL PORTAL ENDPOINTS (Strictly School-Scoped, Zero Fleet Control!)
  // ==========================================================================

  app.get('/api/v1/school/portal', requireAuth, requireRoles(SCHOOL_PORTAL_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const dbUser = req.dbUser!;
      const allSchools = await db.select().from(schools).orderBy(schools.id);
      const requestedSchoolId = Number(req.query.schoolId);

      // Strict isolation: school_admin ALWAYS gets ONLY their assigned schoolId
      const targetSchoolId =
        dbUser.primaryRole === 'school_admin'
          ? dbUser.schoolId ?? allSchools[0]?.id
          : requestedSchoolId || dbUser.schoolId || allSchools[0]?.id;

      const school = allSchools.find((s) => s.id === targetSchoolId) ?? allSchools[0] ?? null;
      if (!school) {
        return res.json({ school: null, contracts: [], students: [], trips: [], attendance: [], changeRequests: [], incidents: [], availableSchools: [] });
      }

      const schoolContracts = await db.select().from(contracts).where(eq(contracts.schoolId, school.id));
      const schoolStudents = await db.select().from(students).where(eq(students.schoolId, school.id)).orderBy(students.id);
      const schoolTrips = await db.select().from(trips).where(eq(trips.schoolId, school.id)).orderBy(trips.id);
      const schoolChangeReqs = await db
        .select()
        .from(transportChangeRequests)
        .where(eq(transportChangeRequests.schoolId, school.id))
        .orderBy(desc(transportChangeRequests.id));
      const schoolIncidents = await db
        .select()
        .from(incidents)
        .where(eq(incidents.schoolId, school.id))
        .orderBy(desc(incidents.id));

      const studentIds = new Set(schoolStudents.map((s) => s.id));
      const allEvents = await db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.id)).limit(100);
      const schoolAttendance = allEvents.filter((ev) => studentIds.has(ev.studentId));

      // Also resolve guardian names for school's students (WITHOUT revealing PINs!)
      const allLinks = await db.select().from(guardianStudentLinks);
      const allGuardians = await db.select().from(guardians);
      const guardianMap = new Map(allGuardians.map((g) => [g.id, g]));

      const safeStudents = schoolStudents.map((st) => {
        const link = allLinks.find((l) => l.studentId === st.id && l.active);
        const g = link ? guardianMap.get(link.guardianId) : null;
        return {
          id: st.id,
          fullName: st.fullName,
          routeCode: st.routeCode,
          stopName: st.stopName,
          shift: st.shift,
          enrollmentStatus: st.enrollmentStatus,
          currentJourneyState: st.currentJourneyState,
          pinPolicy: st.pinPolicy,
          maskedPin: '••••', // NEVER reveal raw PIN to school!
          guardianName: g?.fullName ?? 'Por vincular',
          guardianPhone: g?.phone ?? '—',
        };
      });

      res.json({
        school,
        availableSchools: dbUser.primaryRole === 'school_admin' ? [school] : allSchools,
        contracts: schoolContracts,
        students: safeStudents,
        trips: schoolTrips,
        attendance: schoolAttendance,
        changeRequests: schoolChangeReqs,
        incidents: schoolIncidents,
      });
    } catch (error) {
      console.error('School portal GET failed:', error);
      res.status(500).json({ error: 'Erro ao carregar dados do Portal Escolar.' });
    }
  });

  app.post('/api/v1/school/students', requireAuth, requireRoles(SCHOOL_PORTAL_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const schoolId =
        dbUser.primaryRole === 'school_admin'
          ? dbUser.schoolId
          : Number(req.body?.schoolId) || dbUser.schoolId;

      if (!schoolId) {
        return res.status(400).json({ error: 'Escola não vinculada ao utilizador.' });
      }

      const fullName = String(req.body?.fullName ?? '').trim();
      const routeCode = String(req.body?.routeCode ?? 'ROTA-A').trim();
      const stopName = String(req.body?.stopName ?? 'Largo do Kinaxixi').trim();
      const guardianName = String(req.body?.guardianName ?? '').trim();
      const guardianPhone = String(req.body?.guardianPhone ?? '').trim();

      if (!fullName || !guardianName || !guardianPhone) {
        return res.status(400).json({ error: 'Nome do aluno, encarregado e telefone são obrigatórios.' });
      }

      // Duplicate check inside same school
      const existing = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.fullName, fullName)));
      if (existing.length > 0) {
        return res.status(409).json({ error: `O aluno "${fullName}" já existe na pauta desta escola.` });
      }

      const insertedStudent = await db
        .insert(students)
        .values({
          fullName,
          schoolId,
          routeCode,
          stopName,
          stopIndex: 1,
          shift: 'both',
          enrollmentStatus: 'pending_approval',
          currentJourneyState: 'expected',
          pinPolicy: 'both',
        })
        .returning();

      const insertedGuardian = await db
        .insert(guardians)
        .values({
          fullName: guardianName,
          phone: guardianPhone,
          verificationStatus: 'invited',
        })
        .returning();

      await db.insert(guardianStudentLinks).values({
        guardianId: insertedGuardian[0]!.id,
        studentId: insertedStudent[0]!.id,
        relationship: 'Encarregado(a)',
        isPrimary: true,
        canViewPin: true,
        active: true,
      });

      const { salt, hash } = generateSecurePin();
      await db.insert(handoverCredentials).values({
        studentId: insertedStudent[0]!.id,
        tripScope: 'both',
        pinHash: hash,
        pinSalt: salt,
        maskedDisplay: '••••',
        status: 'active',
        failedAttempts: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'school.student_submitted',
        targetEntity: 'students',
        targetId: insertedStudent[0]!.id,
        summary: `Escola submeteu novo aluno "${fullName}" para aprovação operacional MôBuss.`,
      });

      res.status(201).json({
        student: insertedStudent[0],
        message: 'Aluno submetido para aprovação MôBuss e convite de verificação do encarregado.',
      });
    } catch (error) {
      console.error('School add student failed:', error);
      res.status(500).json({ error: 'Erro ao registar aluno na escola.' });
    }
  });

  app.post('/api/v1/school/transport-change-requests', requireAuth, requireRoles(SCHOOL_PORTAL_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const schoolId =
        dbUser.primaryRole === 'school_admin'
          ? dbUser.schoolId
          : Number(req.body?.schoolId) || dbUser.schoolId;

      if (!schoolId) {
        return res.status(400).json({ error: 'Escola não identificada.' });
      }

      const requestType = String(req.body?.requestType ?? 'stop_change');
      const title = String(req.body?.title ?? '').trim();
      const details = String(req.body?.details ?? '').trim();

      if (!title || !details) {
        return res.status(400).json({ error: 'Título e detalhes do pedido são obrigatórios.' });
      }

      const inserted = await db
        .insert(transportChangeRequests)
        .values({
          schoolId,
          requestedByUid: dbUser.uid,
          requestedByName: dbUser.fullName,
          requestType,
          title,
          details,
          status: 'pending',
        })
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'school.transport_change_requested',
        targetEntity: 'transport_change_requests',
        targetId: inserted[0]!.id,
        summary: `Escola submeteu pedido de alteração de serviço: ${title}.`,
      });

      res.status(201).json({ request: inserted[0] });
    } catch (error) {
      console.error('Transport change request failed:', error);
      res.status(500).json({ error: 'Erro ao submeter pedido à equipa MôBuss.' });
    }
  });

  app.post('/api/v1/school/students/:id/link-guardian', requireAuth, requireRoles(SCHOOL_PORTAL_ROLES), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentId = Number(req.params.id);
      const guardianName = String(req.body?.guardianName ?? '').trim();
      const guardianPhone = String(req.body?.guardianPhone ?? '').trim();
      const guardianEmail = String(req.body?.guardianEmail ?? '').trim().toLowerCase();

      if (!studentId || !guardianEmail) {
        return res.status(400).json({ error: 'E-mail do encarregado obrigatório para vinculação.' });
      }

      const stRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      const student = stRows[0];
      if (!student) {
        return res.status(404).json({ error: 'Aluno não encontrado.' });
      }
      if (dbUser.primaryRole === 'school_admin' && dbUser.schoolId && student.schoolId !== dbUser.schoolId) {
        return res.status(403).json({ error: 'Sem permissão para alterar alunos de outra escola.' });
      }

      const existingUserRows = await db.select().from(users).where(eq(users.email, guardianEmail)).limit(1);
      const existingGuardianRows = await db.select().from(guardians).where(eq(guardians.email, guardianEmail)).limit(1);

      let guardianRecord = existingGuardianRows[0];
      if (!guardianRecord) {
        const inserted = await db
          .insert(guardians)
          .values({
            userId: existingUserRows[0]?.id ?? null,
            fullName: guardianName || existingUserRows[0]?.fullName || guardianEmail.split('@')[0] || 'Encarregado',
            phone: guardianPhone || existingUserRows[0]?.phone || '+244 923 000 000',
            email: guardianEmail,
            verificationStatus: existingUserRows[0] ? 'verified' : 'invited',
          })
          .returning();
        guardianRecord = inserted[0]!;
      } else if (existingUserRows[0] && !guardianRecord.userId) {
        const updated = await db
          .update(guardians)
          .set({ userId: existingUserRows[0].id, verificationStatus: 'verified' })
          .where(eq(guardians.id, guardianRecord.id))
          .returning();
        guardianRecord = updated[0]!;
      }

      const existingLinks = await db
        .select()
        .from(guardianStudentLinks)
        .where(and(eq(guardianStudentLinks.guardianId, guardianRecord.id), eq(guardianStudentLinks.studentId, studentId)));

      if (existingLinks.length === 0) {
        await db.insert(guardianStudentLinks).values({
          guardianId: guardianRecord.id,
          studentId,
          relationship: 'Encarregado(a)',
          isPrimary: true,
          canViewPin: true,
          active: true,
        });
      } else {
        await db
          .update(guardianStudentLinks)
          .set({ active: true })
          .where(eq(guardianStudentLinks.id, existingLinks[0]!.id));
      }

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'guardian.linked_to_student',
        targetEntity: 'students',
        targetId: studentId,
        summary: `Encarregado (${guardianEmail}) vinculado ao educando "${student.fullName}".`,
      });

      res.json({
        guardian: guardianRecord,
        message: existingUserRows[0]
          ? `Encarregado (${guardianEmail}) vinculado com sucesso à conta ativa.`
          : `Encarregado (${guardianEmail}) vinculado ao educando. Crie a conta deste e-mail no Admin → Sistema & Acessos para ativar o acesso à app.`,
      });
    } catch (error) {
      console.error('Link guardian failed:', error);
      res.status(500).json({ error: 'Erro ao vincular encarregado ao aluno.' });
    }
  });

  // ==========================================================================
  // 7. MÔBUSS ADMIN PANEL ENDPOINTS (RBAC + Owner Fleet + Audit + Pricing)
  // ==========================================================================

  app.get('/api/v1/admin/overview', requireAuth, requireRoles(ADMIN_STAFF_ROLES), async (_req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSeeded();
      const [
        allSchools,
        allContracts,
        allRequests,
        allOwners,
        allVehicles,
        allDrivers,
        allStudents,
        allGuardians,
        allLinks,
        allTrips,
        allIncidents,
        allInvoices,
        allPricing,
        allChangeReqs,
        allAuditLogs,
        allUsers,
        allAttendance,
      ] = await Promise.all([
        db.select().from(schools).orderBy(schools.id),
        db.select().from(contracts).orderBy(desc(contracts.id)),
        db.select().from(schoolContractRequests).orderBy(desc(schoolContractRequests.id)),
        db.select().from(vehicleOwners).orderBy(vehicleOwners.id),
        db.select().from(vehicles).orderBy(vehicles.fleetNumber),
        db.select().from(drivers).orderBy(drivers.id),
        db.select().from(students).orderBy(students.id),
        db.select().from(guardians),
        db.select().from(guardianStudentLinks),
        db.select().from(trips).orderBy(trips.id),
        db.select().from(incidents).orderBy(desc(incidents.id)),
        db.select().from(invoices).orderBy(desc(invoices.id)),
        db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1),
        db.select().from(transportChangeRequests).orderBy(desc(transportChangeRequests.id)),
        db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(40),
        db.select().from(users).orderBy(users.id),
        db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.id)).limit(30),
      ]);

      const schoolMap = new Map(allSchools.map((s) => [s.id, s]));
      const guardianMap = new Map(allGuardians.map((g) => [g.id, g]));
      const ownerMap = new Map(allOwners.map((o) => [o.id, o]));
      const driverMap = new Map(allDrivers.map((d) => [d.id, d]));

      // Strictly mask PIN values in general Admin directory!
      const safeStudents = allStudents.map((st) => {
        const link = allLinks.find((l) => l.studentId === st.id && l.active);
        const guardian = link ? guardianMap.get(link.guardianId) : null;
        return {
          id: st.id,
          fullName: st.fullName,
          schoolId: st.schoolId,
          schoolName: schoolMap.get(st.schoolId)?.name ?? '—',
          routeCode: st.routeCode,
          stopName: st.stopName,
          shift: st.shift,
          enrollmentStatus: st.enrollmentStatus,
          currentJourneyState: st.currentJourneyState,
          pinPolicy: st.pinPolicy,
          maskedPin: '••••',
          guardianName: guardian?.fullName ?? '—',
          guardianPhone: guardian?.phone ?? '—',
        };
      });

      const enrichedContracts = allContracts.map((c) => ({
        ...c,
        schoolName: schoolMap.get(c.schoolId)?.name ?? 'Instituição',
        municipality: schoolMap.get(c.schoolId)?.municipality ?? 'Luanda',
        contactName: schoolMap.get(c.schoolId)?.contactName ?? 'Direcção',
        contactPhone: schoolMap.get(c.schoolId)?.contactPhone ?? '—',
      }));

      const enrichedVehicles = allVehicles.map((v) => ({
        ...v,
        ownerName: ownerMap.get(v.ownerId)?.fullName ?? 'Proprietário',
        driverName: v.assignedDriverId ? driverMap.get(v.assignedDriverId)?.fullName ?? '—' : 'Sem motorista',
      }));

      const enrichedChangeRequests = allChangeReqs.map((r) => ({
        ...r,
        schoolName: schoolMap.get(r.schoolId)?.name ?? `Escola #${r.schoolId}`,
      }));

      res.json({
        schools: allSchools,
        contracts: enrichedContracts,
        contractRequests: allRequests,
        vehicleOwners: allOwners,
        vehicles: enrichedVehicles,
        drivers: allDrivers,
        students: safeStudents,
        trips: allTrips,
        incidents: allIncidents,
        invoices: allInvoices,
        pricing: allPricing[0] ?? null,
        transportChangeRequests: enrichedChangeRequests,
        auditLogs: allAuditLogs,
        staffUsers: allUsers.map(toSafeDbUser),
        attendanceEvents: allAttendance,
      });
    } catch (error) {
      console.error('Admin overview failed:', error);
      res.status(500).json({ error: 'Erro ao carregar dados do painel administrativo.' });
    }
  });

  app.put('/api/v1/admin/pricing', requireAuth, requireRoles(['mobuss_super_admin', 'finance_officer']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentMonthlyFeeAoa = Math.max(1000, Number(req.body?.studentMonthlyFeeAoa) || 45000);
      const schoolBusSingleShiftAoa = Math.max(50000, Number(req.body?.schoolBusSingleShiftAoa) || 250000);
      const schoolBusDoubleShiftAoa = Math.max(50000, Number(req.body?.schoolBusDoubleShiftAoa) || 350000);
      const ivaPercent = Math.max(0, Math.min(30, Number(req.body?.ivaPercent ?? 14)));
      const companyNif = String(req.body?.companyNif ?? '5417209418').trim();
      const companyName = String(req.body?.companyName ?? 'MôBuss Angola Transporte Escolar Lda.').trim();
      const multicaixaEntityCode = String(req.body?.multicaixaEntityCode ?? '00845').trim() || '00845';

      const existing = await db.select().from(pricingConfigs).orderBy(desc(pricingConfigs.id)).limit(1);
      let updated;
      if (existing[0]) {
        const resRows = await db
          .update(pricingConfigs)
          .set({
            studentMonthlyFeeAoa,
            schoolBusSingleShiftAoa,
            schoolBusDoubleShiftAoa,
            ivaPercent,
            companyNif,
            companyName,
            multicaixaEntityCode,
            updatedByUid: dbUser.uid,
            updatedAt: new Date(),
          })
          .where(eq(pricingConfigs.id, existing[0].id))
          .returning();
        updated = resRows[0];
      } else {
        const resRows = await db
          .insert(pricingConfigs)
          .values({
            studentMonthlyFeeAoa,
            schoolBusSingleShiftAoa,
            schoolBusDoubleShiftAoa,
            ivaPercent,
            companyNif,
            companyName,
            multicaixaEntityCode,
            updatedByUid: dbUser.uid,
          })
          .returning();
        updated = resRows[0];
      }

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'pricing.updated',
        targetEntity: 'pricing_configs',
        targetId: updated?.id,
        summary: `Tarifário atualizado: mensalidade aluno ${studentMonthlyFeeAoa} Kz, autocarro duplo ${schoolBusDoubleShiftAoa} Kz.`,
        before: existing[0] ?? null,
        after: updated,
      });

      res.json({ pricing: updated });
    } catch (error) {
      console.error('Pricing update failed:', error);
      res.status(500).json({ error: 'Erro ao guardar tarifário em PostgreSQL.' });
    }
  });

  app.patch('/api/v1/admin/contract-requests/:id', requireAuth, requireRoles(['mobuss_super_admin', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const requestId = Number(req.params.id);
      const action = String(req.body?.action ?? ''); // approve | reject | review
      const payerModel = ['school', 'parent', 'mixed'].includes(req.body?.payerModel)
        ? String(req.body.payerModel)
        : 'school';

      const reqRows = await db
        .select()
        .from(schoolContractRequests)
        .where(eq(schoolContractRequests.id, requestId))
        .limit(1);
      const lead = reqRows[0];
      if (!lead) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }

      if (action === 'approve') {
        const createdSchool = await db
          .insert(schools)
          .values({
            name: lead.schoolName,
            municipality: lead.municipality,
            contactName: lead.contactName,
            contactPhone: lead.contactPhone,
            contactEmail: lead.contactEmail,
            status: 'active',
          })
          .returning();

        const contractNumber = `CT-MOB-2026-${crypto.randomInt(100, 999)}`;
        const createdContract = await db
          .insert(contracts)
          .values({
            contractNumber,
            schoolId: createdSchool[0]!.id,
            payerModel,
            pinPolicy: 'both',
            busesAllocated: lead.busesRequested,
            studentsCovered: lead.studentsEstimate,
            monthlyValueAoa: lead.estimatedMonthlyAoa,
            shiftRegime: lead.shiftRegime,
            status: 'active',
            notes: `Convertido a partir do pedido ${lead.referenceCode}.`,
          })
          .returning();

        await db
          .update(schoolContractRequests)
          .set({
            status: 'accepted',
            reviewedByUid: dbUser.uid,
            convertedContractId: createdContract[0]!.id,
          })
          .where(eq(schoolContractRequests.id, requestId));

        await writeAuditLog({
          actorUid: dbUser.uid,
          actorEmail: dbUser.email,
          actorRole: dbUser.primaryRole,
          action: 'contract_request.approved',
          targetEntity: 'contracts',
          targetId: createdContract[0]!.id,
          summary: `Pedido ${lead.referenceCode} (${lead.schoolName}) aprovado como contrato ${contractNumber} (pagador: ${payerModel}).`,
        });

        return res.json({ contract: createdContract[0], school: createdSchool[0] });
      }

      const nextStatus = action === 'reject' ? 'rejected' : 'under_review';
      const updated = await db
        .update(schoolContractRequests)
        .set({ status: nextStatus, reviewedByUid: dbUser.uid })
        .where(eq(schoolContractRequests.id, requestId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: `contract_request.${nextStatus}`,
        targetEntity: 'school_contract_requests',
        targetId: requestId,
        summary: `Estado do pedido ${lead.referenceCode} alterado para ${nextStatus}.`,
      });

      res.json({ request: updated[0] });
    } catch (error) {
      console.error('Contract request patch failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar pedido de contrato.' });
    }
  });

  app.post('/api/v1/admin/contracts', requireAuth, requireRoles(['mobuss_super_admin', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const body = req.body ?? {};
      const schoolName = String(body.schoolName ?? '').trim();
      const municipality = String(body.municipality ?? 'Luanda').trim();
      const payerModel = ['school', 'parent', 'mixed'].includes(body.payerModel)
        ? String(body.payerModel)
        : 'school';
      const busesAllocated = Math.max(1, Number(body.busesAllocated) || 2);
      const studentsCovered = Math.max(1, Number(body.studentsCovered) || busesAllocated * 25);
      const monthlyValueAoa = Math.max(50000, Number(body.monthlyValueAoa) || busesAllocated * 350000);
      const contactName = String(body.contactName ?? 'Secretaria Escolar').trim();
      const contactPhone = String(body.contactPhone ?? '+244 923 000 000').trim();

      if (!schoolName) {
        return res.status(400).json({ error: 'Nome da instituição é obrigatório.' });
      }

      const createdSchool = await db
        .insert(schools)
        .values({
          name: schoolName,
          municipality,
          contactName,
          contactPhone,
          status: 'active',
        })
        .returning();

      const contractNumber = `CT-MOB-2026-${crypto.randomInt(100, 999)}`;
      const created = await db
        .insert(contracts)
        .values({
          contractNumber,
          schoolId: createdSchool[0]!.id,
          payerModel,
          pinPolicy: 'both',
          busesAllocated,
          studentsCovered,
          monthlyValueAoa,
          shiftRegime: 'both',
          status: 'active',
          notes: body.notes ? String(body.notes) : null,
        })
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'contract.created',
        targetEntity: 'contracts',
        targetId: created[0]!.id,
        summary: `Novo contrato ${contractNumber} criado para ${schoolName} (pagador: ${payerModel}, PIN: embarque + desembarque).`,
      });

      res.status(201).json({ contract: created[0], school: createdSchool[0] });
    } catch (error) {
      console.error('Contract creation failed:', error);
      res.status(500).json({ error: 'Erro ao criar contrato.' });
    }
  });

  app.post('/api/v1/admin/vehicle-owners', requireAuth, requireRoles(['mobuss_super_admin', 'fleet_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const fullName = String(req.body?.fullName ?? '').trim();
      const phone = String(req.body?.phone ?? '').trim();
      const nif = req.body?.nif ? String(req.body.nif).trim() : null;
      const settlementModel = req.body?.settlementModel === 'per_trip' ? 'per_trip' : 'monthly_fixed';
      const monthlySettlementAoa = Math.max(0, Number(req.body?.monthlySettlementAoa) || 350000);

      if (!fullName || !phone) {
        return res.status(400).json({ error: 'Nome e telefone do proprietário parceiro são obrigatórios.' });
      }

      const inserted = await db
        .insert(vehicleOwners)
        .values({
          fullName,
          ownerType: 'independent',
          nif,
          phone,
          settlementModel,
          monthlySettlementAoa,
          verificationStatus: 'verified',
        })
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'vehicle_owner.created',
        targetEntity: 'vehicle_owners',
        targetId: inserted[0]!.id,
        summary: `Proprietário parceiro independente registado: ${fullName}.`,
      });

      res.status(201).json({ owner: inserted[0] });
    } catch (error) {
      console.error('Create vehicle owner failed:', error);
      res.status(500).json({ error: 'Erro ao registar proprietário parceiro.' });
    }
  });

  app.patch('/api/v1/admin/vehicles/:id/assign', requireAuth, requireRoles(['mobuss_super_admin', 'fleet_manager', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const vehicleId = Number(req.params.id);
      const driverId = Number(req.body?.driverId);
      const routeCode = req.body?.routeCode ? String(req.body.routeCode) : undefined;

      const vRows = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
      const vehicle = vRows[0];
      if (!vehicle) return res.status(404).json({ error: 'Viatura não encontrada.' });
      if (vehicle.verificationStatus !== 'verified' || vehicle.dnvtStatus === 'expired') {
        return res.status(400).json({ error: 'Viatura inelegível: inspeção DNVT expirada ou não verificada.' });
      }

      const dRows = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
      const driver = dRows[0];
      if (!driver || driver.verificationStatus !== 'verified') {
        return res.status(400).json({ error: 'Motorista não verificado ou indisponível para atribuição.' });
      }

      const updated = await db
        .update(vehicles)
        .set({
          assignedDriverId: driver.id,
          ...(routeCode ? { routeCode } : {}),
          status: 'assigned',
        })
        .where(eq(vehicles.id, vehicleId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'fleet.driver_assigned',
        targetEntity: 'vehicles',
        targetId: vehicleId,
        summary: `Motorista ${driver.fullName} alocado à viatura ${vehicle.plate} (Autocarro ${vehicle.fleetNumber}).`,
      });

      res.json({ vehicle: updated[0] });
    } catch (error) {
      console.error('Vehicle assignment failed:', error);
      res.status(500).json({ error: 'Erro ao atribuir motorista à viatura.' });
    }
  });

  app.post('/api/v1/admin/vehicles', requireAuth, requireRoles(['mobuss_super_admin', 'fleet_manager', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const fleetNumber = Number(req.body?.fleetNumber);
      const plate = String(req.body?.plate ?? '').trim().toUpperCase();
      const ownerId = Number(req.body?.ownerId);
      const routeCode = String(req.body?.routeCode ?? 'ROTA-A').trim();
      const routeName = String(req.body?.routeName ?? routeCode).trim();
      const capacity = Math.max(8, Number(req.body?.capacity) || 22);
      const dnvtExpiry = String(req.body?.dnvtExpiry ?? '2027-12-31').trim();
      const dnvtStatus = ['valid', 'expiring_soon', 'expired'].includes(req.body?.dnvtStatus)
        ? String(req.body.dnvtStatus)
        : 'valid';
      const insuranceProvider = String(req.body?.insuranceProvider ?? 'ENSA Seguros de Angola').trim();
      const insuranceStatus = ['valid', 'expired', 'pending'].includes(req.body?.insuranceStatus)
        ? String(req.body.insuranceStatus)
        : 'valid';

      if (!Number.isInteger(fleetNumber) || fleetNumber <= 0) {
        return res.status(400).json({ error: 'Número de frota inválido.' });
      }
      if (plate.length < 4) {
        return res.status(400).json({ error: 'Matrícula da viatura obrigatória.' });
      }

      const ownerRows = await db.select().from(vehicleOwners).where(eq(vehicleOwners.id, ownerId)).limit(1);
      const owner = ownerRows[0];
      if (!owner) {
        return res.status(400).json({ error: 'Proprietário da viatura não encontrado.' });
      }

      const dup = await db
        .select()
        .from(vehicles)
        .where(or(eq(vehicles.fleetNumber, fleetNumber), eq(vehicles.plate, plate)))
        .limit(1);
      if (dup[0]) {
        return res.status(409).json({ error: 'Já existe uma viatura com este número de frota ou matrícula.' });
      }

      const inserted = await db
        .insert(vehicles)
        .values({
          fleetNumber,
          plate,
          ownershipType: owner.ownerType === 'mobuss' ? 'mobuss_owned' : 'partner_owned',
          ownerId: owner.id,
          routeCode,
          routeName,
          capacity,
          status: 'available',
          fuelPercent: 90,
          dnvtExpiry,
          dnvtStatus,
          insuranceProvider,
          insuranceStatus,
          verificationStatus: 'verified',
        })
        .returning();

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'vehicle.created',
        targetEntity: 'vehicles',
        targetId: inserted[0]!.id,
        summary: `Nova viatura registada: Autocarro ${fleetNumber} (${plate}) · Proprietário ${owner.fullName}.`,
      });

      res.status(201).json({
        vehicle: inserted[0],
        message: `Autocarro ${fleetNumber} (${plate}) registado na frota.`,
      });
    } catch (error) {
      console.error('Create vehicle failed:', error);
      res.status(500).json({ error: 'Erro ao registar nova viatura.' });
    }
  });

  app.patch('/api/v1/admin/vehicles/:id', requireAuth, requireRoles(['mobuss_super_admin', 'fleet_manager', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const vehicleId = Number(req.params.id);
      if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
        return res.status(400).json({ error: 'ID de viatura inválido.' });
      }

      const existingRows = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Viatura não encontrada.' });
      }

      const plate = String(req.body?.plate ?? existing.plate).trim().toUpperCase();
      const ownerId = req.body?.ownerId != null ? Number(req.body.ownerId) : existing.ownerId;
      const routeCode = String(req.body?.routeCode ?? existing.routeCode ?? 'ROTA-A').trim();
      const capacity = Math.max(8, Number(req.body?.capacity ?? existing.capacity) || existing.capacity);
      const dnvtExpiry = String(req.body?.dnvtExpiry ?? existing.dnvtExpiry).trim();
      const dnvtStatus = ['valid', 'expiring_soon', 'expired'].includes(req.body?.dnvtStatus)
        ? String(req.body.dnvtStatus)
        : existing.dnvtStatus;
      const insuranceProvider = String(req.body?.insuranceProvider ?? existing.insuranceProvider).trim();
      const insuranceStatus = ['valid', 'expired', 'pending'].includes(req.body?.insuranceStatus)
        ? String(req.body.insuranceStatus)
        : existing.insuranceStatus;
      const status = ['available', 'assigned', 'on_trip', 'reserve', 'maintenance', 'out_of_service', 'suspended'].includes(req.body?.status)
        ? String(req.body.status)
        : existing.status;

      const ownerRows = await db.select().from(vehicleOwners).where(eq(vehicleOwners.id, ownerId)).limit(1);
      if (!ownerRows[0]) {
        return res.status(400).json({ error: 'Proprietário não encontrado.' });
      }

      const updated = await db
        .update(vehicles)
        .set({
          plate,
          ownerId,
          ownershipType: ownerRows[0].ownerType === 'mobuss' ? 'mobuss_owned' : 'partner_owned',
          routeCode,
          capacity,
          dnvtExpiry,
          dnvtStatus,
          insuranceProvider,
          insuranceStatus,
          status,
        })
        .where(eq(vehicles.id, vehicleId))
        .returning();

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'vehicle.updated',
        targetEntity: 'vehicles',
        targetId: vehicleId,
        summary: `Viatura Autocarro ${existing.fleetNumber} (${plate}) atualizada (DNVT: ${dnvtStatus}).`,
      });

      res.json({
        vehicle: updated[0],
        message: `Viatura ${plate} atualizada com sucesso.`,
      });
    } catch (error) {
      console.error('Update vehicle failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar viatura.' });
    }
  });

  app.patch('/api/v1/admin/drivers/:id', requireAuth, requireRoles(['mobuss_super_admin', 'fleet_manager', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const driverId = Number(req.params.id);
      if (!Number.isInteger(driverId) || driverId <= 0) {
        return res.status(400).json({ error: 'ID de motorista inválido.' });
      }

      const existingRows = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Motorista não encontrado.' });
      }

      const fullName = String(req.body?.fullName ?? existing.fullName).trim();
      const phone = String(req.body?.phone ?? existing.phone).trim();
      const licenceCategory = String(req.body?.licenceCategory ?? existing.licenceCategory).trim();
      const licenceNumber = String(req.body?.licenceNumber ?? existing.licenceNumber).trim();
      const licenceExpiry = String(req.body?.licenceExpiry ?? existing.licenceExpiry).trim();
      const availabilityStatus = ['in_service', 'available', 'off_duty'].includes(req.body?.availabilityStatus)
        ? String(req.body.availabilityStatus)
        : existing.availabilityStatus;
      const monthlyCompensationAoa = Math.max(0, Number(req.body?.monthlyCompensationAoa ?? existing.monthlyCompensationAoa) || 0);

      if (fullName.length < 2 || !phone) {
        return res.status(400).json({ error: 'Nome e telefone do motorista são obrigatórios.' });
      }

      const updated = await db
        .update(drivers)
        .set({
          fullName,
          phone,
          licenceCategory,
          licenceNumber,
          licenceExpiry,
          availabilityStatus,
          monthlyCompensationAoa,
        })
        .where(eq(drivers.id, driverId))
        .returning();

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'driver.updated',
        targetEntity: 'drivers',
        targetId: driverId,
        summary: `Dados do motorista ${fullName} (#${driverId}) atualizados (${availabilityStatus}).`,
      });

      res.json({
        driver: updated[0],
        message: `Motorista ${fullName} atualizado com sucesso.`,
      });
    } catch (error) {
      console.error('Update driver failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar motorista.' });
    }
  });

  app.post('/api/v1/admin/students', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const fullName = String(req.body?.fullName ?? '').trim();
      const schoolId = Number(req.body?.schoolId);
      const routeCode = String(req.body?.routeCode ?? 'ROTA-A').trim();
      const stopName = String(req.body?.stopName ?? 'Largo do Kinaxixi').trim();
      const shift = ['morning', 'afternoon', 'both'].includes(req.body?.shift)
        ? String(req.body.shift)
        : 'both';
      const pinPolicy = ['boarding', 'dropoff', 'both'].includes(req.body?.pinPolicy)
        ? String(req.body.pinPolicy)
        : 'both';
      const guardianName = req.body?.guardianName ? String(req.body.guardianName).trim() : '';
      const guardianPhone = req.body?.guardianPhone ? String(req.body.guardianPhone).trim() : '';

      if (fullName.length < 2 || !schoolId) {
        return res.status(400).json({ error: 'Nome do educando e escola são obrigatórios.' });
      }

      const schoolRows = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
      if (!schoolRows[0]) {
        return res.status(400).json({ error: 'Escola selecionada não encontrada.' });
      }

      const dup = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.fullName, fullName)))
        .limit(1);
      if (dup[0]) {
        return res.status(409).json({ error: `O aluno "${fullName}" já está registado nesta escola.` });
      }

      const insertedStudent = await db
        .insert(students)
        .values({
          fullName,
          schoolId,
          routeCode,
          stopName,
          stopIndex: 1,
          shift,
          enrollmentStatus: 'active',
          currentJourneyState: 'expected',
          pinPolicy,
        })
        .returning();

      const student = insertedStudent[0]!;

      if (guardianName) {
        const gIns = await db
          .insert(guardians)
          .values({
            fullName: guardianName,
            phone: guardianPhone || '+244 923 000 000',
            verificationStatus: 'verified',
          })
          .returning();
        if (gIns[0]) {
          await db.insert(guardianStudentLinks).values({
            guardianId: gIns[0].id,
            studentId: student.id,
            relationship: 'Encarregado(a)',
            isPrimary: true,
            canViewPin: true,
            active: true,
          });
        }
      }

      const { salt, hash } = generateSecurePin();
      await db.insert(handoverCredentials).values({
        studentId: student.id,
        tripScope: 'both',
        pinHash: hash,
        pinSalt: salt,
        maskedDisplay: '••••',
        status: 'active',
        failedAttempts: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'student.created_by_admin',
        targetEntity: 'students',
        targetId: student.id,
        summary: `Educando "${fullName}" registado pelo Admin na escola ${schoolRows[0].name} (${routeCode}).`,
      });

      res.status(201).json({
        student,
        message: `Educando ${fullName} registado com credencial PIN segura.`,
      });
    } catch (error) {
      console.error('Admin create student failed:', error);
      res.status(500).json({ error: 'Erro ao registar educando.' });
    }
  });

  app.post('/api/v1/admin/students/:id/reset-pin', requireAuth, requireRoles(['mobuss_super_admin', 'safety_support_agent', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const studentId = Number(req.params.id);
      await db
        .update(handoverCredentials)
        .set({ status: 'revoked' })
        .where(and(eq(handoverCredentials.studentId, studentId), eq(handoverCredentials.status, 'active')));

      const { salt, hash } = generateSecurePin();
      await db.insert(handoverCredentials).values({
        studentId,
        tripScope: 'both',
        pinHash: hash,
        pinSalt: salt,
        maskedDisplay: '••••',
        status: 'active',
        failedAttempts: 0,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'student.pin_revoked_and_reissued',
        targetEntity: 'students',
        targetId: studentId,
        summary: `PIN do aluno #${studentId} revogado e regenerado em segurança (hash armazenado; valor ocultado).`,
      });

      res.json({ status: 'ok', maskedPin: '••••', message: 'PIN anterior revogado e nova credencial gerada com segurança.' });
    } catch (error) {
      console.error('Admin reset PIN failed:', error);
      res.status(500).json({ error: 'Erro ao regenerar PIN.' });
    }
  });

  app.patch('/api/v1/admin/students/:id', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'school_account_manager', 'safety_support_agent']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const studentId = Number(req.params.id);
      if (!Number.isInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: 'ID de educando inválido.' });
      }

      const existingRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Educando não encontrado.' });
      }

      const fullName = String(req.body?.fullName ?? existing.fullName).trim();
      const schoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : existing.schoolId;
      const routeCode = String(req.body?.routeCode ?? existing.routeCode).trim();
      const stopName = String(req.body?.stopName ?? existing.stopName).trim();
      const shift = ['morning', 'afternoon', 'both'].includes(req.body?.shift)
        ? String(req.body.shift)
        : existing.shift;
      const enrollmentStatus = ['active', 'pending_approval', 'suspended'].includes(req.body?.enrollmentStatus)
        ? String(req.body.enrollmentStatus)
        : existing.enrollmentStatus;
      const pinPolicy = ['boarding', 'dropoff', 'both'].includes(req.body?.pinPolicy)
        ? String(req.body.pinPolicy)
        : existing.pinPolicy;

      if (fullName.length < 2) {
        return res.status(400).json({ error: 'Nome do educando deve ter pelo menos 2 caracteres.' });
      }
      if (!routeCode || !stopName) {
        return res.status(400).json({ error: 'Rota e paragem são obrigatórias.' });
      }

      const schoolRows = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
      if (!schoolRows[0]) {
        return res.status(400).json({ error: 'Escola selecionada não encontrada.' });
      }

      const updatedRows = await db
        .update(students)
        .set({
          fullName,
          schoolId,
          routeCode,
          stopName,
          shift,
          enrollmentStatus,
          pinPolicy,
        })
        .where(eq(students.id, studentId))
        .returning();

      const guardianName = req.body?.guardianName != null ? String(req.body.guardianName).trim() : null;
      const guardianPhone = req.body?.guardianPhone != null ? String(req.body.guardianPhone).trim() : null;
      if (guardianName || guardianPhone) {
        const activeLinks = await db
          .select()
          .from(guardianStudentLinks)
          .where(and(eq(guardianStudentLinks.studentId, studentId), eq(guardianStudentLinks.active, true)))
          .limit(1);

        if (activeLinks[0]) {
          await db
            .update(guardians)
            .set({
              ...(guardianName ? { fullName: guardianName } : {}),
              ...(guardianPhone ? { phone: guardianPhone } : {}),
            })
            .where(eq(guardians.id, activeLinks[0].guardianId));
        } else if (guardianName) {
          const gIns = await db
            .insert(guardians)
            .values({
              fullName: guardianName,
              phone: guardianPhone || '+244 923 000 000',
              verificationStatus: 'verified',
            })
            .returning();
          if (gIns[0]) {
            await db.insert(guardianStudentLinks).values({
              guardianId: gIns[0].id,
              studentId,
              relationship: 'Encarregado(a)',
              isPrimary: true,
              canViewPin: true,
              active: true,
            });
          }
        }
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'student.updated',
        targetEntity: 'students',
        targetId: studentId,
        summary: `Dados do educando "${fullName}" (#${studentId}) atualizados (${routeCode} · ${stopName}).`,
      });

      res.json({
        student: updatedRows[0],
        message: `Dados de ${fullName} atualizados com sucesso.`,
      });
    } catch (error) {
      console.error('Admin update student failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar dados do educando.' });
    }
  });

  app.delete('/api/v1/admin/students/:id', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const studentId = Number(req.params.id);
      if (!Number.isInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: 'ID de educando inválido.' });
      }

      const existingRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Educando não encontrado.' });
      }

      await db.transaction(async (tx) => {
        await tx.delete(attendanceEvents).where(eq(attendanceEvents.studentId, studentId));
        await tx.delete(handoverCredentials).where(eq(handoverCredentials.studentId, studentId));
        await tx.delete(guardianStudentLinks).where(eq(guardianStudentLinks.studentId, studentId));
        await tx.delete(students).where(eq(students.id, studentId));
      });

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'student.deleted',
        targetEntity: 'students',
        targetId: studentId,
        summary: `Educando "${existing.fullName}" (#${studentId}) removido da pauta pelo Admin.`,
      });

      res.json({
        deletedId: studentId,
        message: `Educando ${existing.fullName} removido com sucesso.`,
      });
    } catch (error) {
      console.error('Admin delete student failed:', error);
      res.status(500).json({ error: 'Erro ao remover educando.' });
    }
  });

  app.patch('/api/v1/admin/transport-requests/:id', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const reqId = Number(req.params.id);
      const status = req.body?.status === 'approved' ? 'approved' : 'rejected';
      const reviewNotes = req.body?.reviewNotes ? String(req.body.reviewNotes) : null;

      const updated = await db
        .update(transportChangeRequests)
        .set({ status, reviewedByUid: dbUser.uid, reviewNotes })
        .where(eq(transportChangeRequests.id, reqId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: `school_request.${status}`,
        targetEntity: 'transport_change_requests',
        targetId: reqId,
        summary: `Pedido escolar #${reqId} marcado como ${status}.`,
      });

      res.json({ request: updated[0] });
    } catch (error) {
      console.error('Transport request review failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar pedido escolar.' });
    }
  });

  app.patch('/api/v1/admin/incidents/:id', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'safety_support_agent']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const incidentId = Number(req.params.id);
      const status = ['acknowledged', 'assigned', 'in_progress', 'resolved', 'closed'].includes(req.body?.status)
        ? String(req.body.status)
        : 'resolved';
      const resolutionNotes = req.body?.resolutionNotes ? String(req.body.resolutionNotes) : undefined;

      const updated = await db
        .update(incidents)
        .set({
          status,
          assignedToName: dbUser.fullName,
          ...(resolutionNotes ? { resolutionNotes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(incidents.id, incidentId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: `incident.${status}`,
        targetEntity: 'incidents',
        targetId: incidentId,
        summary: `Ocorrência #${incidentId} atualizada para ${status}${resolutionNotes ? ` (${resolutionNotes})` : ''}.`,
      });

      res.json({ incident: updated[0] });
    } catch (error) {
      console.error('Incident update failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar ocorrência.' });
    }
  });

  app.post('/api/v1/admin/invoices/:id/reconcile', requireAuth, requireRoles(['mobuss_super_admin', 'finance_officer']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const invoiceId = Number(req.params.id);
      const providerReference = String(req.body?.providerReference ?? '').trim();

      if (!providerReference) {
        return res.status(400).json({ error: 'Indique a referência de conciliação bancária/EMIS.' });
      }

      const updated = await db
        .update(invoices)
        .set({
          status: 'confirmed',
          providerReference,
          confirmedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'invoice.reconciled',
        targetEntity: 'invoices',
        targetId: invoiceId,
        summary: `Fatura #${invoiceId} conciliada manualmente com ref. ${providerReference}.`,
      });

      res.json({ invoice: updated[0] });
    } catch (error) {
      console.error('Invoice reconcile failed:', error);
      res.status(500).json({ error: 'Erro ao conciliar fatura.' });
    }
  });

  app.post('/api/v1/admin/system/users', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager', 'school_account_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const rawEmailOrUser = String(req.body?.email ?? req.body?.username ?? '').trim().toLowerCase();
      const explicitUsername = req.body?.username ? String(req.body.username).trim().toLowerCase() : null;
      const username = explicitUsername || (!rawEmailOrUser.includes('@') && rawEmailOrUser ? rawEmailOrUser : null);
      const email = rawEmailOrUser.includes('@')
        ? rawEmailOrUser
        : username
        ? `${username}@mobuss.ao`
        : '';
      const fullName = String(req.body?.fullName ?? '').trim();
      const phone = req.body?.phone ? String(req.body.phone).trim() : null;
      const password = req.body?.password ? String(req.body.password) : '';
      const primaryRole = String(req.body?.primaryRole ?? 'parent_guardian') as MoBussRole;
      const schoolId = req.body?.schoolId ? Number(req.body.schoolId) : null;
      const studentId = req.body?.studentId ? Number(req.body.studentId) : null;

      const validRoles: MoBussRole[] = [
        'mobuss_super_admin',
        'operations_manager',
        'fleet_manager',
        'school_account_manager',
        'finance_officer',
        'safety_support_agent',
        'school_admin',
        'driver',
        'vehicle_owner',
        'parent_guardian',
      ];
      if (!validRoles.includes(primaryRole)) {
        return res.status(400).json({ error: 'Perfil RBAC inválido.' });
      }

      const operationalOnlyRoles: MoBussRole[] = ['parent_guardian', 'driver', 'school_admin', 'vehicle_owner'];
      if (actor.primaryRole !== 'mobuss_super_admin' && !operationalOnlyRoles.includes(primaryRole)) {
        return res.status(403).json({ error: 'Apenas Super Admin pode criar contas administrativas da equipa central.' });
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Indique um utilizador (ex: joao.silva) ou endereço de e-mail válido.' });
      }
      if (fullName.length < 2) {
        return res.status(400).json({ error: 'Indique o nome completo do utilizador.' });
      }
      if (password && password.length < 6) {
        return res.status(400).json({ error: 'A palavra-passe inicial deve ter pelo menos 6 caracteres.' });
      }

      const existingEmail = await db
        .select()
        .from(users)
        .where(
          username
            ? or(sql`lower(${users.email}) = ${email}`, sql`lower(${users.username}) = ${username}`)
            : sql`lower(${users.email}) = ${email}`
        )
        .limit(1);
      if (existingEmail[0]) {
        return res.status(409).json({ error: 'Já existe uma conta registada com este utilizador ou e-mail.' });
      }

      let resolvedUid = password ? `cred:${crypto.randomUUID()}` : `pending:${crypto.randomUUID()}`;
      let authMode: 'credentials_password' | 'google_preauthorized' = password
        ? 'credentials_password'
        : 'google_preauthorized';
      let pwFields: { passwordHash: string | null; passwordSalt: string | null } = {
        passwordHash: null,
        passwordSalt: null,
      };

      if (password) {
        const { hash, salt } = hashPassword(password);
        pwFields = { passwordHash: hash, passwordSalt: salt };

        // Also mirror into Firebase Auth if enabled/available; non-blocking if Email/Password isn't active in Firebase Console
        try {
          const fbUser = await adminAuth.createUser({
            email,
            password,
            displayName: fullName,
            emailVerified: true,
          });
          resolvedUid = fbUser.uid;
        } catch {
          try {
            const fbRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, returnSecureToken: false }),
              }
            );
            const fbJson = (await fbRes.json().catch(() => ({}))) as { localId?: string };
            if (fbRes.ok && fbJson.localId) {
              resolvedUid = fbJson.localId;
            }
          } catch {
            // PostgreSQL credential auth still succeeds cleanly
          }
        }
      }

      let createdDriverId: number | null = null;
      if (primaryRole === 'driver') {
        const dIns = await db
          .insert(drivers)
          .values({
            fullName,
            phone: phone || '+244 923 000 000',
            licenceCategory: 'Pesados Profissional D',
            licenceNumber: `LD-${crypto.randomInt(100000, 999999)}`,
            licenceExpiry: '2028-12-31',
            engagementType: 'employed',
            verificationStatus: 'verified',
            availabilityStatus: 'available',
          })
          .returning();
        createdDriverId = dIns[0]?.id ?? null;
      }

      let createdOwnerId: number | null = null;
      if (primaryRole === 'vehicle_owner') {
        const requestedOwnerId = req.body?.ownerId ? Number(req.body.ownerId) : null;
        if (requestedOwnerId) {
          const matchedById = await db
            .select()
            .from(vehicleOwners)
            .where(eq(vehicleOwners.id, requestedOwnerId))
            .limit(1);
          createdOwnerId = matchedById[0]?.id ?? null;
        }
        if (!createdOwnerId) {
          const existingOwners = await db
            .select()
            .from(vehicleOwners)
            .where(
              or(
                sql`lower(coalesce(${vehicleOwners.email}, '')) = ${email}`,
                sql`lower(${vehicleOwners.fullName}) = ${fullName.toLowerCase()}`
              )
            )
            .limit(1);
          if (existingOwners[0]) {
            createdOwnerId = existingOwners[0].id;
            await db
              .update(vehicleOwners)
              .set({
                email: existingOwners[0].email || email,
                ...(phone ? { phone } : {}),
              })
              .where(eq(vehicleOwners.id, existingOwners[0].id));
          } else {
            const oIns = await db
              .insert(vehicleOwners)
              .values({
                fullName,
                ownerType: 'independent',
                phone: phone || '+244 923 000 000',
                email,
                settlementModel: 'monthly_fixed',
                monthlySettlementAoa: 350000,
                verificationStatus: 'verified',
              })
              .returning();
            createdOwnerId = oIns[0]?.id ?? null;
          }
        }
      }

      const inserted = await db
        .insert(users)
        .values({
          uid: resolvedUid,
          username,
          email,
          fullName,
          phone,
          passwordHash: pwFields.passwordHash,
          passwordSalt: pwFields.passwordSalt,
          primaryRole,
          schoolId: primaryRole === 'school_admin' ? schoolId : null,
          driverId: createdDriverId,
          ownerId: createdOwnerId,
          active: true,
        })
        .returning();

      const createdUser = toSafeDbUser(inserted[0]!);

      if (primaryRole === 'parent_guardian') {
        const existingGuardian = await db.select().from(guardians).where(eq(guardians.email, email)).limit(1);
        let guardianId: number;
        if (existingGuardian[0]) {
          await db
            .update(guardians)
            .set({ userId: createdUser.id, fullName, ...(phone ? { phone } : {}), verificationStatus: 'verified' })
            .where(eq(guardians.id, existingGuardian[0].id));
          guardianId = existingGuardian[0].id;
        } else {
          const gIns = await db
            .insert(guardians)
            .values({
              userId: createdUser.id,
              fullName,
              phone: phone || '+244 923 000 000',
              email,
              verificationStatus: 'verified',
            })
            .returning();
          guardianId = gIns[0]!.id;
        }

        if (studentId) {
          const existingLinks = await db
            .select()
            .from(guardianStudentLinks)
            .where(and(eq(guardianStudentLinks.guardianId, guardianId), eq(guardianStudentLinks.studentId, studentId)));
          if (existingLinks.length === 0) {
            await db.insert(guardianStudentLinks).values({
              guardianId,
              studentId,
              relationship: 'Encarregado(a)',
              isPrimary: true,
              canViewPin: true,
              active: true,
            });
          } else {
            await db
              .update(guardianStudentLinks)
              .set({ active: true })
              .where(eq(guardianStudentLinks.id, existingLinks[0]!.id));
          }
        }
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'system.user_created',
        targetEntity: 'users',
        targetId: createdUser.id,
        summary: `Conta criada pelo Admin para ${fullName} (${email}) com perfil ${primaryRole} (${authMode}).`,
      });

      res.status(201).json({
        user: createdUser,
        authMode,
        message:
          authMode === 'credentials_password'
            ? `Conta criada com credenciais (${username || email}) e palavra-passe. O utilizador já pode iniciar sessão na app.`
            : `Conta pré-autorizada para ${email}. O utilizador já pode entrar via Google na app.`,
      });
    } catch (error) {
      console.error('Admin user creation failed:', error);
      res.status(500).json({ error: 'Erro ao criar conta de utilizador.' });
    }
  });

  app.patch('/api/v1/admin/system/users/:id/status', requireAuth, requireRoles(['mobuss_super_admin']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const targetUserId = Number(req.params.id);
      const active = Boolean(req.body?.active);

      if (targetUserId === actor.id && !active) {
        return res.status(400).json({ error: 'Não pode desativar a sua própria conta Super Admin.' });
      }

      const updated = await db
        .update(users)
        .set({ active, updatedAt: new Date() })
        .where(eq(users.id, targetUserId))
        .returning();

      const targetUser = updated[0];
      if (!targetUser) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      if (!targetUser.uid.startsWith('pending:') && !targetUser.uid.startsWith('cred:')) {
        await adminAuth.updateUser(targetUser.uid, { disabled: !active }).catch(() => null);
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: active ? 'system.user_enabled' : 'system.user_disabled',
        targetEntity: 'users',
        targetId: targetUserId,
        summary: `Conta ${targetUser.email} ${active ? 'reativada' : 'desativada'} pelo Super Admin.`,
      });

      res.json({ user: toSafeDbUser(targetUser) });
    } catch (error) {
      console.error('User status update failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar estado da conta.' });
    }
  });

  app.patch('/api/v1/admin/system/users/:id/password', requireAuth, requireRoles(['mobuss_super_admin']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const targetUserId = Number(req.params.id);
      const newPassword = String(req.body?.password ?? '');
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova palavra-passe deve ter pelo menos 6 caracteres.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      const updated = await db
        .update(users)
        .set({ passwordHash: hash, passwordSalt: salt, updatedAt: new Date() })
        .where(eq(users.id, targetUserId))
        .returning();

      const targetUser = updated[0];
      if (!targetUser) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      if (!targetUser.uid.startsWith('pending:') && !targetUser.uid.startsWith('cred:')) {
        await adminAuth.updateUser(targetUser.uid, { password: newPassword }).catch(() => null);
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'system.user_password_updated',
        targetEntity: 'users',
        targetId: targetUserId,
        summary: `Palavra-passe atualizada pelo Super Admin para ${targetUser.username || targetUser.email}.`,
      });

      res.json({
        user: toSafeDbUser(targetUser),
        message: `Palavra-passe atualizada para ${targetUser.username || targetUser.email}.`,
      });
    } catch (error) {
      console.error('User password update failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar palavra-passe.' });
    }
  });

  app.patch('/api/v1/admin/system/users/:id/role', requireAuth, requireRoles(['mobuss_super_admin']), async (req: AuthRequest, res: Response) => {
    try {
      const dbUser = req.dbUser!;
      const targetUserId = Number(req.params.id);
      const primaryRole = String(req.body?.primaryRole ?? 'parent_guardian');
      const schoolId = req.body?.schoolId != null ? Number(req.body.schoolId) : null;

      const updated = await db
        .update(users)
        .set({
          primaryRole,
          ...(schoolId ? { schoolId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))
        .returning();

      await writeAuditLog({
        actorUid: dbUser.uid,
        actorEmail: dbUser.email,
        actorRole: dbUser.primaryRole,
        action: 'system.role_updated',
        targetEntity: 'users',
        targetId: targetUserId,
        summary: `Perfil RBAC do utilizador #${targetUserId} alterado para ${primaryRole}.`,
      });

      res.json({ user: updated[0] ? toSafeDbUser(updated[0]) : null });
    } catch (error) {
      console.error('Role update failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar perfil RBAC.' });
    }
  });

  app.patch('/api/v1/admin/system/users/:id', requireAuth, requireRoles(['mobuss_super_admin']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const targetUserId = Number(req.params.id);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'ID de utilizador inválido.' });
      }

      const existingRows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      const fullName = String(req.body?.fullName ?? existing.fullName).trim();
      const rawEmail = String(req.body?.email ?? existing.email).trim().toLowerCase();
      const rawUsername = req.body?.username !== undefined
        ? (req.body.username ? String(req.body.username).trim().toLowerCase() : null)
        : existing.username;
      const phone = req.body?.phone !== undefined
        ? (req.body.phone ? String(req.body.phone).trim() : null)
        : existing.phone;
      const primaryRole = String(req.body?.primaryRole ?? existing.primaryRole) as MoBussRole;
      const schoolId = req.body?.schoolId !== undefined
        ? (req.body.schoolId ? Number(req.body.schoolId) : null)
        : existing.schoolId;
      const active = req.body?.active !== undefined ? Boolean(req.body.active) : existing.active;

      const validRoles: MoBussRole[] = [
        'mobuss_super_admin',
        'operations_manager',
        'fleet_manager',
        'school_account_manager',
        'finance_officer',
        'safety_support_agent',
        'school_admin',
        'driver',
        'vehicle_owner',
        'parent_guardian',
      ];
      if (!validRoles.includes(primaryRole)) {
        return res.status(400).json({ error: 'Perfil RBAC inválido.' });
      }
      if (fullName.length < 2) {
        return res.status(400).json({ error: 'O nome completo deve ter pelo menos 2 caracteres.' });
      }
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        return res.status(400).json({ error: 'Indique um endereço de e-mail válido.' });
      }
      if (targetUserId === actor.id && !active) {
        return res.status(400).json({ error: 'Não pode desativar a sua própria conta Super Admin.' });
      }
      if (targetUserId === actor.id && primaryRole !== 'mobuss_super_admin') {
        return res.status(400).json({ error: 'Não pode remover o seu próprio perfil de Super Admin.' });
      }

      const duplicate = await db
        .select()
        .from(users)
        .where(
          and(
            ne(users.id, targetUserId),
            rawUsername
              ? or(sql`lower(${users.email}) = ${rawEmail}`, sql`lower(${users.username}) = ${rawUsername}`)
              : sql`lower(${users.email}) = ${rawEmail}`
          )
        )
        .limit(1);
      if (duplicate[0]) {
        return res.status(409).json({ error: 'Já existe outra conta com este e-mail ou nome de utilizador.' });
      }

      const updatedRows = await db
        .update(users)
        .set({
          fullName,
          email: rawEmail,
          username: rawUsername,
          phone,
          primaryRole,
          schoolId: primaryRole === 'school_admin' ? schoolId : null,
          active,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId))
        .returning();

      const updatedUser = updatedRows[0]!;

      if (!updatedUser.uid.startsWith('pending:') && !updatedUser.uid.startsWith('cred:')) {
        await adminAuth
          .updateUser(updatedUser.uid, {
            email: rawEmail,
            displayName: fullName,
            disabled: !active,
          })
          .catch(() => null);
      }

      if (updatedUser.primaryRole === 'parent_guardian') {
        await db
          .update(guardians)
          .set({ fullName, email: rawEmail, ...(phone ? { phone } : {}) })
          .where(eq(guardians.userId, targetUserId));
      } else if (updatedUser.primaryRole === 'driver' && updatedUser.driverId) {
        await db
          .update(drivers)
          .set({ fullName, ...(phone ? { phone } : {}) })
          .where(eq(drivers.id, updatedUser.driverId));
      } else if (updatedUser.primaryRole === 'vehicle_owner' && updatedUser.ownerId) {
        await db
          .update(vehicleOwners)
          .set({ fullName, email: rawEmail, ...(phone ? { phone } : {}) })
          .where(eq(vehicleOwners.id, updatedUser.ownerId));
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'system.user_updated',
        targetEntity: 'users',
        targetId: targetUserId,
        summary: `Conta #${targetUserId} (${rawUsername || rawEmail}) atualizada pelo Super Admin.`,
      });

      res.json({
        user: toSafeDbUser(updatedUser),
        message: `Conta de ${fullName} atualizada com sucesso.`,
      });
    } catch (error) {
      console.error('Admin user update failed:', error);
      res.status(500).json({ error: 'Erro ao atualizar conta de utilizador.' });
    }
  });

  app.delete('/api/v1/admin/system/users/:id', requireAuth, requireRoles(['mobuss_super_admin']), async (req: AuthRequest, res: Response) => {
    try {
      const actor = req.dbUser!;
      const targetUserId = Number(req.params.id);
      if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'ID de utilizador inválido.' });
      }
      if (targetUserId === actor.id) {
        return res.status(400).json({ error: 'Não pode eliminar a sua própria conta Super Admin.' });
      }

      const targetRows = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
      const targetUser = targetRows[0];
      if (!targetUser) {
        return res.status(404).json({ error: 'Utilizador não encontrado.' });
      }

      if (targetUser.primaryRole === 'mobuss_super_admin' && targetUser.active) {
        const otherActiveAdmins = await db
          .select()
          .from(users)
          .where(and(ne(users.id, targetUserId), eq(users.primaryRole, 'mobuss_super_admin'), eq(users.active, true)));
        if (otherActiveAdmins.length === 0) {
          return res.status(400).json({ error: 'Não é possível eliminar o único Super Admin ativo do sistema.' });
        }
      }

      await db.transaction(async (tx) => {
        await tx.update(guardians).set({ userId: null }).where(eq(guardians.userId, targetUserId));
        await tx.delete(users).where(eq(users.id, targetUserId));
      });

      if (!targetUser.uid.startsWith('pending:') && !targetUser.uid.startsWith('cred:')) {
        await adminAuth.deleteUser(targetUser.uid).catch(() => null);
      }

      await writeAuditLog({
        actorUid: actor.uid,
        actorEmail: actor.email,
        actorRole: actor.primaryRole,
        action: 'system.user_deleted',
        targetEntity: 'users',
        targetId: targetUserId,
        summary: `Conta #${targetUserId} (${targetUser.username || targetUser.email}) eliminada pelo Super Admin.`,
      });

      res.json({
        deletedId: targetUserId,
        message: `Conta ${targetUser.username || targetUser.email} eliminada permanentemente.`,
      });
    } catch (error) {
      console.error('Admin user deletion failed:', error);
      res.status(500).json({ error: 'Erro ao eliminar conta de utilizador.' });
    }
  });

  // ==========================================================================
  // 7B. POSTGRESQL-BACKED LIVE TRIP SIMULATION ENDPOINTS (ADMIN / OPS)
  // ==========================================================================

  app.get('/api/v1/simulation/status', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager']), (_req: AuthRequest, res: Response) => {
    res.json({
      simulation: simulationRunner.getStatus(),
      connectedClients: telemetryHub.getConnectedCount(),
    });
  });

  app.post('/api/v1/simulation/start', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const routeCode = String(req.body?.routeCode ?? 'ROTA-A');
      const status = await simulationRunner.start(routeCode, req.dbUser);
      res.json({ simulation: status, connectedClients: telemetryHub.getConnectedCount() });
    } catch (error) {
      console.error('Simulation start failed:', error);
      res.status(500).json({ error: 'Falha ao iniciar simulação no PostgreSQL.' });
    }
  });

  app.post('/api/v1/simulation/pause', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager']), (_req: AuthRequest, res: Response) => {
    const status = simulationRunner.pause();
    res.json({ simulation: status, connectedClients: telemetryHub.getConnectedCount() });
  });

  app.post('/api/v1/simulation/step', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const delta = Number(req.body?.delta ?? 0.08);
      const status = await simulationRunner.stepOnce(delta);
      res.json({ simulation: status, connectedClients: telemetryHub.getConnectedCount() });
    } catch (error) {
      console.error('Simulation step failed:', error);
      res.status(500).json({ error: 'Falha ao avançar passo da simulação.' });
    }
  });

  app.post('/api/v1/simulation/reset', requireAuth, requireRoles(['mobuss_super_admin', 'operations_manager']), async (req: AuthRequest, res: Response) => {
    try {
      const routeCode = String(req.body?.routeCode ?? 'ROTA-A');
      const status = await simulationRunner.reset(routeCode);
      res.json({ simulation: status, connectedClients: telemetryHub.getConnectedCount() });
    } catch (error) {
      console.error('Simulation reset failed:', error);
      res.status(500).json({ error: 'Falha ao reiniciar simulação.' });
    }
  });

  // ==========================================================================
  // 8. VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
  // ==========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`MôBuss Full-Stack Server listening on http://0.0.0.0:${port}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start MôBuss server:', err);
  process.exit(1);
});
