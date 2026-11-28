import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { count, eq, sql } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { auditLogs, guardians, schools, users } from '../db/schema.ts';

export type MoBussRole =
  | 'mobuss_super_admin'
  | 'operations_manager'
  | 'fleet_manager'
  | 'school_account_manager'
  | 'finance_officer'
  | 'safety_support_agent'
  | 'school_admin'
  | 'driver'
  | 'vehicle_owner'
  | 'parent_guardian';

export interface DbUserRecord {
  id: number;
  uid: string;
  username: string | null;
  email: string;
  fullName: string;
  phone: string | null;
  primaryRole: string;
  active: boolean;
  schoolId: number | null;
  driverId: number | null;
  ownerId: number | null;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: DbUserRecord;
}

function readAuthSecret(name: 'MOBUSS_PIN_PEPPER' | 'MOBUSS_AUTH_SECRET'): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[MôBuss Startup Error] Missing required environment variable ${name}. Please configure ${name} before starting the server.`
    );
  }

  console.warn(
    `[MôBuss Startup Warning] ${name} is not set; using an ephemeral in-memory development secret. Configure ${name} before running in production.`
  );
  return crypto.randomBytes(32).toString('hex');
}

const PIN_PEPPER = readAuthSecret('MOBUSS_PIN_PEPPER');
const SESSION_SECRET = readAuthSecret('MOBUSS_AUTH_SECRET');

if (SESSION_SECRET === PIN_PEPPER) {
  throw new Error(
    '[MôBuss Startup Error] MOBUSS_AUTH_SECRET must be separate and distinct from MOBUSS_PIN_PEPPER.'
  );
}
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function toSafeDbUser(row: typeof users.$inferSelect): DbUserRecord {
  return {
    id: row.id,
    uid: row.uid,
    username: row.username ?? null,
    email: row.email,
    fullName: row.fullName,
    phone: row.phone ?? null,
    primaryRole: row.primaryRole,
    active: row.active,
    schoolId: row.schoolId ?? null,
    driverId: row.driverId ?? null,
    ownerId: row.ownerId ?? null,
  };
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (candidate.length !== expected.length) return false;
    return crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function issueSessionToken(user: DbUserRecord): string {
  const payload = {
    sub: user.id,
    uid: user.uid,
    role: user.primaryRole,
    typ: 'mobuss_session',
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `mb1.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): { sub: number; uid: string; role: string } | null {
  if (!token.startsWith('mb1.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const encoded = parts[1]!;
  const sig = parts[2]!;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      sub?: number;
      uid?: string;
      role?: string;
      typ?: string;
      exp?: number;
    };
    if (payload.typ !== 'mobuss_session' || !payload.sub || !payload.uid || !payload.exp) {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return { sub: payload.sub, uid: payload.uid, role: payload.role || 'parent_guardian' };
  } catch {
    return null;
  }
}

export function hashPin(pin: string, salt: string): string {
  return crypto
    .createHmac('sha256', PIN_PEPPER)
    .update(`${salt}:${pin}`)
    .digest('hex');
}

export function generateSecurePin(): { pin: string; salt: string; hash: string } {
  const pin = String(crypto.randomInt(1000, 10000));
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    pin,
    salt,
    hash: hashPin(pin, salt),
  };
}

export async function writeAuditLog(entry: {
  actorUid: string;
  actorEmail?: string | null;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId?: string | number | null;
  summary: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await db.insert(auditLogs).values({
      actorUid: entry.actorUid,
      actorEmail: entry.actorEmail ?? null,
      actorRole: entry.actorRole,
      action: entry.action,
      targetEntity: entry.targetEntity,
      targetId: entry.targetId != null ? String(entry.targetId) : null,
      summary: entry.summary,
      beforeJson: entry.before !== undefined ? JSON.stringify(entry.before) : null,
      afterJson: entry.after !== undefined ? JSON.stringify(entry.after) : null,
    });
  } catch (err) {
    console.error('Audit log insert failed:', err);
  }
}

export class AccountNotProvisionedError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'ACCOUNT_NOT_PROVISIONED';

  constructor(message = 'Conta não autorizada. As contas MôBuss são criadas exclusivamente pelo Administrador no Painel Central.') {
    super(message);
    this.name = 'AccountNotProvisionedError';
  }
}

export async function resolveProvisionedDbUser(decoded: DecodedIdToken): Promise<DbUserRecord> {
  const email = (decoded.email || '').trim().toLowerCase();
  const displayName =
    (typeof decoded.name === 'string' && decoded.name.trim()) ||
    (email ? email.split('@')[0] : '') ||
    'Utilizador MôBuss';

  const existingByUid = await db
    .select()
    .from(users)
    .where(eq(users.uid, decoded.uid))
    .limit(1);

  if (existingByUid[0]) {
    const updated = await db
      .update(users)
      .set({
        ...(email ? { email } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.uid, decoded.uid))
      .returning();
    return toSafeDbUser(updated[0]!);
  }

  // Match an account pre-created / pre-authorized by an Admin via email (e.g., pending:<uuid> UID)
  if (email) {
    const allMatchingEmail = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    if (allMatchingEmail[0]) {
      const bound = await db
        .update(users)
        .set({
          uid: decoded.uid,
          email,
          fullName: allMatchingEmail[0].fullName || displayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, allMatchingEmail[0].id))
        .returning();

      const boundUser = bound[0]!;
      if (boundUser.primaryRole === 'parent_guardian') {
        const existingGuardian = await db
          .select()
          .from(guardians)
          .where(eq(guardians.email, email))
          .limit(1);
        if (existingGuardian[0]) {
          await db
            .update(guardians)
            .set({ userId: boundUser.id, verificationStatus: 'verified' })
            .where(eq(guardians.id, existingGuardian[0].id));
        } else {
          await db
            .insert(guardians)
            .values({
              userId: boundUser.id,
              fullName: boundUser.fullName,
              phone: boundUser.phone || '+244 923 000 000',
              email,
              verificationStatus: 'verified',
            })
            .catch(() => null);
        }
      }

      await writeAuditLog({
        actorUid: boundUser.uid,
        actorEmail: boundUser.email,
        actorRole: boundUser.primaryRole,
        action: 'user.provisioned_activated',
        targetEntity: 'users',
        targetId: boundUser.id,
        summary: `Acesso pré-criado pelo Administrador ativado no primeiro login (${boundUser.primaryRole}).`,
      });

      return toSafeDbUser(boundUser);
    }
  }

  // Bootstrap exception ONLY when database has zero users so initial owner can initialize Admin Panel
  const totalUsersRes = await db.select({ total: count() }).from(users);
  const totalUsers = Number(totalUsersRes[0]?.total ?? 0);
  if (totalUsers === 0) {
    const firstSchool = await db.select().from(schools).limit(1);
    const bootstrapEmail = email || `${decoded.uid}@mobuss.ao`;
    const inserted = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        email: bootstrapEmail,
        fullName: displayName,
        primaryRole: 'mobuss_super_admin',
        schoolId: firstSchool[0]?.id ?? null,
        active: true,
      })
      .returning();

    const adminUser = inserted[0]!;
    await writeAuditLog({
      actorUid: adminUser.uid,
      actorEmail: adminUser.email,
      actorRole: adminUser.primaryRole,
      action: 'user.bootstrap_super_admin',
      targetEntity: 'users',
      targetId: adminUser.id,
      summary: 'Primeiro utilizador do sistema registado automaticamente como mobuss_super_admin.',
    });
    return toSafeDbUser(adminUser);
  }

  await writeAuditLog({
    actorUid: decoded.uid,
    actorEmail: email || null,
    actorRole: 'unprovisioned',
    action: 'access.unprovisioned_blocked',
    targetEntity: 'auth',
    targetId: email || decoded.uid,
    summary: `Tentativa de início de sessão bloqueada: conta (${email || decoded.uid}) não criada pelo Administrador.`,
  });

  throw new AccountNotProvisionedError();
}

export async function resolveDbUserFromToken(token: string): Promise<{
  dbUser: DbUserRecord;
  decodedFirebase?: DecodedIdToken;
}> {
  if (token.startsWith('mb1.')) {
    const session = verifySessionToken(token);
    if (!session) {
      throw new Error('Token de sessão MôBuss inválido ou expirado.');
    }
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, session.sub))
      .limit(1);
    const found = rows[0];
    if (!found || found.uid !== session.uid) {
      throw new Error('Sessão não encontrada.');
    }
    return { dbUser: toSafeDbUser(found) };
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  const dbUser = await resolveProvisionedDbUser(decodedToken);
  return { dbUser, decodedFirebase: decodedToken };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autenticação obrigatória. Inicie sessão com a sua conta.' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token de sessão ausente.' });
  }

  try {
    const { dbUser, decodedFirebase } = await resolveDbUserFromToken(token);
    if (decodedFirebase) req.user = decodedFirebase;
    if (!dbUser.active) {
      return res.status(403).json({
        code: 'ACCOUNT_DISABLED',
        error: 'Conta desativada pelo administrador MôBuss.',
      });
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    if (error instanceof AccountNotProvisionedError) {
      return res.status(403).json({
        code: error.code,
        error: error.message,
      });
    }
    console.error('Error verifying auth token:', error);
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
};

export function requireRoles(allowedRoles: MoBussRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.dbUser?.primaryRole as MoBussRole | undefined;
    if (!role || !allowedRoles.includes(role)) {
      if (req.dbUser) {
        void writeAuditLog({
          actorUid: req.dbUser.uid,
          actorEmail: req.dbUser.email,
          actorRole: req.dbUser.primaryRole,
          action: 'access.denied',
          targetEntity: 'api_route',
          targetId: req.originalUrl,
          summary: `Tentativa de acesso negada à rota ${req.method} ${req.originalUrl}.`,
        });
      }
      return res.status(403).json({
        error: 'Sem permissão para aceder a este recurso.',
        requiredRoles: allowedRoles,
        currentRole: role ?? 'none',
      });
    }
    next();
  };
}
