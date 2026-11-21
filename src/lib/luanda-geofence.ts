import { LUANDA_ROUTES, pointAtRoute, type LuandaRouteConfig } from './route-luanda.ts';

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function getRouteConfigByCode(routeCode?: string | null): LuandaRouteConfig {
  const normalized = (routeCode || '').toUpperCase().trim();
  const match = Object.values(LUANDA_ROUTES).find((r) => r.code.toUpperCase() === normalized);
  return match ?? LUANDA_ROUTES.route_a;
}

export function estimateRouteProgressFromCoords(
  routeCode: string | null | undefined,
  lat: number,
  lng: number
): number {
  const route = getRouteConfigByCode(routeCode);
  let bestT = 0;
  let bestDist = Infinity;
  const samples = 40;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const [pLat, pLng] = pointAtRoute(route.path, t);
    const d = haversineMeters(lat, lng, pLat, pLng);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return bestT;
}

export interface StopProximityResult {
  stopName: string;
  stopIndex: number;
  distanceMeters: number;
  within500m: boolean;
  etaMinutes: number;
}

export function checkStopGeofences(
  routeCode: string | null | undefined,
  lat: number,
  lng: number
): {
  nearestStop: StopProximityResult;
  approaching500m: StopProximityResult[];
} {
  const route = getRouteConfigByCode(routeCode);
  const results: StopProximityResult[] = route.stops.map((stop, idx) => {
    const [sLat, sLng] = pointAtRoute(route.path, stop.at);
    const dist = haversineMeters(lat, lng, sLat, sLng);
    const etaMinutes = Math.max(1, Math.round(dist / 350)); // ~21 km/h Luanda school traffic
    return {
      stopName: stop.name,
      stopIndex: idx,
      distanceMeters: dist,
      within500m: dist <= 500,
      etaMinutes,
    };
  });

  const sorted = [...results].sort((a, b) => a.distanceMeters - b.distanceMeters);
  return {
    nearestStop: sorted[0]!,
    approaching500m: results.filter((r) => r.within500m),
  };
}
