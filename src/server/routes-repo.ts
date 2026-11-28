import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { routes, routeStops, schools } from '../db/schema.ts';
import type { RouteDto, RouteStopDto } from '../lib/luanda-geofence.ts';

function sanitizePathCoordinates(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const out: [number, number][] = [];
  for (const pt of raw) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lat = Number(pt[0]);
      const lng = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        out.push([lat, lng]);
      }
    }
  }
  return out;
}

export async function loadRoutesWithStops(options?: {
  includeInactive?: boolean;
}): Promise<RouteDto[]> {
  const includeInactive = options?.includeInactive ?? false;
  const [routeRows, stopRows, schoolRows] = await Promise.all([
    includeInactive
      ? db.select().from(routes).orderBy(asc(routes.code), asc(routes.id))
      : db.select().from(routes).where(eq(routes.active, true)).orderBy(asc(routes.code), asc(routes.id)),
    db.select().from(routeStops).orderBy(asc(routeStops.routeId), asc(routeStops.position), asc(routeStops.id)),
    db.select({ id: schools.id, name: schools.name }).from(schools),
  ]);

  const schoolNameById = new Map(schoolRows.map((s) => [s.id, s.name]));
  const stopsByRouteId = new Map<number, RouteStopDto[]>();

  for (const st of stopRows) {
    const arr = stopsByRouteId.get(st.routeId) ?? [];
    arr.push({
      id: st.id,
      routeId: st.routeId,
      position: st.position,
      name: st.name,
      latitude: st.latitude,
      longitude: st.longitude,
      scheduledTime: st.scheduledTime,
      geofenceRadiusM: st.geofenceRadiusM,
    });
    stopsByRouteId.set(st.routeId, arr);
  }

  return routeRows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    corridor: r.corridor ?? null,
    schoolId: r.schoolId ?? null,
    schoolName: r.schoolId ? schoolNameById.get(r.schoolId) ?? null : null,
    pathCoordinates: sanitizePathCoordinates(r.pathCoordinates),
    active: r.active,
    stops: stopsByRouteId.get(r.id) ?? [],
  }));
}

export async function getRouteWithStopsById(routeId: number): Promise<RouteDto | null> {
  const routeRows = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
  const r = routeRows[0];
  if (!r) return null;

  const [stopRows, schoolRows] = await Promise.all([
    db
      .select()
      .from(routeStops)
      .where(eq(routeStops.routeId, r.id))
      .orderBy(asc(routeStops.position), asc(routeStops.id)),
    r.schoolId
      ? db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, r.schoolId)).limit(1)
      : Promise.resolve([]),
  ]);

  return {
    id: r.id,
    code: r.code,
    name: r.name,
    corridor: r.corridor ?? null,
    schoolId: r.schoolId ?? null,
    schoolName: schoolRows[0]?.name ?? null,
    pathCoordinates: sanitizePathCoordinates(r.pathCoordinates),
    active: r.active,
    stops: stopRows.map((st) => ({
      id: st.id,
      routeId: st.routeId,
      position: st.position,
      name: st.name,
      latitude: st.latitude,
      longitude: st.longitude,
      scheduledTime: st.scheduledTime,
      geofenceRadiusM: st.geofenceRadiusM,
    })),
  };
}

export async function getRouteWithStopsByCode(
  routeCode: string | null | undefined,
  options?: { includeInactive?: boolean }
): Promise<RouteDto | null> {
  const normalized = (routeCode || '').trim().toUpperCase();
  if (!normalized) return null;
  const all = await loadRoutesWithStops(options);
  return all.find((r) => r.code.trim().toUpperCase() === normalized) ?? null;
}
