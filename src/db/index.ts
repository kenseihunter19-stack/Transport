import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function isTransientIdleDisconnect(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('Connection terminated') ||
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03'
  );
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 10000,
      maxLifetimeSeconds: 300,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      allowExitOnIdle: true,
    });

    global._postgresPool.on('error', (err) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'Unknown SQL pool error');
      if (isTransientIdleDisconnect(err)) {
        console.warn(`[SQL Pool] Idle connection closed (${msg}); pool will reconnect on next query.`);
        return;
      }
      console.error(`[SQL Pool] Error on idle SQL pool client: ${msg}`);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
