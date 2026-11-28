export interface RouteStopDto {
  id?: number;
  routeId?: number;
  position: number;
  name: string;
  latitude: number;
  longitude: number;
  scheduledTime: string;
  geofenceRadiusM: number;
}

export interface RouteDto {
  id: number;
  code: string;
  name: string;
  corridor: string | null;
  schoolId: number | null;
  schoolName?: string | null;
  pathCoordinates: [number, number][];
  active: boolean;
  stops: RouteStopDto[];
}

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

export function pointAtRoute(path: [number, number][], t: number): [number, number] {
  if (!path || path.length === 0) return [-8.8383, 13.2344];
  if (path.length === 1) return path[0]!;
  const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]));
  const sum = segs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return path[0]!;
  let d = Math.min(Math.max(t, 0), 1) * sum;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]!) {
      const a = path[i]!,
        b = path[i + 1]!,
        f = segs[i]! ? d / segs[i]! : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    d -= segs[i]!;
  }
  return path[path.length - 1]!;
}

export function resolveRouteByCode<T extends { code: string }>(
  routes: T[],
  routeCode?: string | null
): T | null {
  if (!routes || routes.length === 0) return null;
  const normalized = (routeCode || '').toUpperCase().trim();
  if (!normalized) return null;
  return routes.find((r) => r.code.toUpperCase().trim() === normalized) ?? null;
}

export function estimateRouteProgressFromPath(
  path: [number, number][],
  lat: number,
  lng: number
): number {
  if (!path || path.length === 0) return 0;
  if (path.length === 1) return 0;
  let bestT = 0;
  let bestDist = Infinity;
  const samples = 40;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const [pLat, pLng] = pointAtRoute(path, t);
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
  geofenceRadiusM: number;
  within500m: boolean;
  etaMinutes: number;
}

export function checkRouteStopGeofences(
  stops: Array<{
    name: string;
    position?: number;
    latitude: number;
    longitude: number;
    geofenceRadiusM?: number;
  }>,
  lat: number,
  lng: number
): {
  nearestStop: StopProximityResult | null;
  approaching500m: StopProximityResult[];
} {
  if (!stops || stops.length === 0) {
    return { nearestStop: null, approaching500m: [] };
  }

  const ordered = [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const results: StopProximityResult[] = ordered.map((stop, idx) => {
    const dist = haversineMeters(lat, lng, stop.latitude, stop.longitude);
    const radius = stop.geofenceRadiusM && stop.geofenceRadiusM > 0 ? stop.geofenceRadiusM : 500;
    const etaMinutes = Math.max(1, Math.round(dist / 350)); // ~21 km/h Luanda school traffic
    return {
      stopName: stop.name,
      stopIndex: stop.position ?? idx,
      distanceMeters: dist,
      geofenceRadiusM: radius,
      within500m: dist <= radius,
      etaMinutes,
    };
  });

  const sorted = [...results].sort((a, b) => a.distanceMeters - b.distanceMeters);
  return {
    nearestStop: sorted[0] ?? null,
    approaching500m: results.filter((r) => r.within500m),
  };
}

export const DELAY_REASONS = [
  'trânsito intenso',
  'estrada cortada',
  'acidente na via',
  'avaria',
  'outro',
] as const;

export type DelayReason = (typeof DELAY_REASONS)[number];

export const DELAY_REASON_LABELS: Record<DelayReason, string> = {
  'trânsito intenso': 'Trânsito intenso',
  'estrada cortada': 'Estrada cortada',
  'acidente na via': 'Acidente na via',
  avaria: 'Avaria',
  outro: 'Outro',
};

export interface RemainingStopsEtaResult {
  etaMinutes: number;
  arrivalHHMM: string;
  remainingDistanceMeters: number;
  remainingStopsCount: number;
  targetStopName: string;
}

export function computeRemainingStopsEta(
  stops: RouteStopDto[],
  pathCoordinates: [number, number][],
  busLat: number,
  busLng: number,
  options?: {
    targetStopName?: string | null;
    targetStopIndex?: number | null;
    destinationIsFinalStop?: boolean;
    delayed?: boolean;
    nowMs?: number;
  }
): RemainingStopsEtaResult | null {
  if (!Number.isFinite(busLat) || !Number.isFinite(busLng)) return null;
  if (!stops || stops.length === 0) return null;

  const ordered = [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const pathCoords =
    pathCoordinates && pathCoordinates.length >= 2
      ? pathCoordinates
      : ordered.map((s) => [s.latitude, s.longitude] as [number, number]);

  let destIdx = ordered.length - 1;
  if (!options?.destinationIsFinalStop) {
    const nameNorm = (options?.targetStopName ?? '').trim().toLowerCase();
    const byName = nameNorm ? ordered.findIndex((s) => s.name.trim().toLowerCase() === nameNorm) : -1;
    if (byName >= 0) {
      destIdx = byName;
    } else if (
      options?.targetStopIndex != null &&
      options.targetStopIndex >= 0 &&
      options.targetStopIndex < ordered.length
    ) {
      destIdx = options.targetStopIndex;
    } else {
      destIdx = 0;
    }
  }

  const targetStop = ordered[destIdx] ?? ordered[ordered.length - 1]!;
  const busProgress = estimateRouteProgressFromPath(pathCoords, busLat, busLng);

  const candidateStops = ordered.slice(0, destIdx + 1).filter((s) => {
    const stopProg = estimateRouteProgressFromPath(pathCoords, s.latitude, s.longitude);
    return stopProg >= busProgress - 0.02;
  });

  const remainingStops =
    candidateStops.length > 0 && candidateStops[candidateStops.length - 1] === targetStop
      ? candidateStops
      : [...candidateStops.filter((s) => s !== targetStop), targetStop];

  let totalDistanceMeters = 0;
  let prevLat = busLat;
  let prevLng = busLng;
  for (const stop of remainingStops) {
    totalDistanceMeters += haversineMeters(prevLat, prevLng, stop.latitude, stop.longitude);
    prevLat = stop.latitude;
    prevLng = stop.longitude;
  }

  // Luanda school corridor speed: ~15 km/h (250 m/min) when delayed, ~21 km/h (350 m/min) normally,
  // plus ~1 min dwell per intermediate stop ahead.
  const metersPerMin = options?.delayed ? 250 : 350;
  const intermediateStopDwellMin = Math.max(0, remainingStops.length - 1);
  const etaMinutes = Math.max(1, Math.round(totalDistanceMeters / metersPerMin) + intermediateStopDwellMin);

  const baseMs = options?.nowMs && Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const etaDate = new Date(baseMs + etaMinutes * 60_000);
  const arrivalHHMM = etaDate.toLocaleTimeString('pt-AO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    etaMinutes,
    arrivalHHMM,
    remainingDistanceMeters: totalDistanceMeters,
    remainingStopsCount: remainingStops.length,
    targetStopName: targetStop.name,
  };
}

