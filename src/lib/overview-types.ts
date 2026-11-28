export type MoBussRoleSlug =
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

export interface OverviewVisibility {
  canViewContractsKpi: boolean;
  canViewContractFinancials: boolean;
  canViewStudentsKpi: boolean;
  canViewFleetKpi: boolean;
  canViewDriversKpi: boolean;
  canViewTripsKpi: boolean;
  canViewIncidentsKpi: boolean;
  canViewFinanceKpi: boolean;
  canViewDocumentsKpi: boolean;
  canViewAuditLogs: boolean;
  canViewStaffUsers: boolean;
}

export function getAdminOverviewVisibility(role?: string | null): OverviewVisibility {
  switch (role) {
    case 'mobuss_super_admin':
      return {
        canViewContractsKpi: true,
        canViewContractFinancials: true,
        canViewStudentsKpi: true,
        canViewFleetKpi: true,
        canViewDriversKpi: true,
        canViewTripsKpi: true,
        canViewIncidentsKpi: true,
        canViewFinanceKpi: true,
        canViewDocumentsKpi: true,
        canViewAuditLogs: true,
        canViewStaffUsers: true,
      };
    case 'finance_officer':
      return {
        canViewContractsKpi: true,
        canViewContractFinancials: true,
        canViewStudentsKpi: true,
        canViewFleetKpi: false,
        canViewDriversKpi: false,
        canViewTripsKpi: false,
        canViewIncidentsKpi: false,
        canViewFinanceKpi: true,
        canViewDocumentsKpi: false,
        canViewAuditLogs: true,
        canViewStaffUsers: false,
      };
    case 'operations_manager':
      return {
        canViewContractsKpi: true,
        canViewContractFinancials: false,
        canViewStudentsKpi: true,
        canViewFleetKpi: true,
        canViewDriversKpi: true,
        canViewTripsKpi: true,
        canViewIncidentsKpi: true,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: true,
        canViewAuditLogs: true,
        canViewStaffUsers: true,
      };
    case 'fleet_manager':
      return {
        canViewContractsKpi: false,
        canViewContractFinancials: false,
        canViewStudentsKpi: false,
        canViewFleetKpi: true,
        canViewDriversKpi: true,
        canViewTripsKpi: true,
        canViewIncidentsKpi: false,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: true,
        canViewAuditLogs: false,
        canViewStaffUsers: false,
      };
    case 'school_account_manager':
      return {
        canViewContractsKpi: true,
        canViewContractFinancials: true,
        canViewStudentsKpi: true,
        canViewFleetKpi: false,
        canViewDriversKpi: false,
        canViewTripsKpi: true,
        canViewIncidentsKpi: false,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: false,
        canViewAuditLogs: false,
        canViewStaffUsers: true,
      };
    case 'safety_support_agent':
      return {
        canViewContractsKpi: false,
        canViewContractFinancials: false,
        canViewStudentsKpi: true,
        canViewFleetKpi: false,
        canViewDriversKpi: false,
        canViewTripsKpi: true,
        canViewIncidentsKpi: true,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: true,
        canViewAuditLogs: true,
        canViewStaffUsers: false,
      };
    case 'school_admin':
      return {
        canViewContractsKpi: true,
        canViewContractFinancials: true,
        canViewStudentsKpi: true,
        canViewFleetKpi: false,
        canViewDriversKpi: false,
        canViewTripsKpi: true,
        canViewIncidentsKpi: true,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: false,
        canViewAuditLogs: false,
        canViewStaffUsers: false,
      };
    default:
      return {
        canViewContractsKpi: false,
        canViewContractFinancials: false,
        canViewStudentsKpi: false,
        canViewFleetKpi: false,
        canViewDriversKpi: false,
        canViewTripsKpi: false,
        canViewIncidentsKpi: false,
        canViewFinanceKpi: false,
        canViewDocumentsKpi: false,
        canViewAuditLogs: false,
        canViewStaffUsers: false,
      };
  }
}

export interface ServiceStatusSummary {
  state: 'operational' | 'attention' | 'degraded' | 'outage' | 'no_data';
  label: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  reason: string;
  dbReachable: boolean;
  dbLatencyMs: number | null;
  liveGpsTripsCount: number;
  staleGpsTripsCount: number;
  unavailableGpsActiveTripsCount: number;
  openCriticalIncidentsCount: number;
  delayedTripsCount: number;
  checkedAt: string;
}

export interface StatusBreakdownItem {
  key: string;
  label: string;
  count: number;
}

export interface ExpiringDocumentItem {
  entityType: 'vehicle' | 'driver';
  entityId: number;
  title: string;
  subtitle: string;
  documentType: string;
  expiryDate: string;
  daysRemaining: number;
  status: 'expired' | 'expiring_30d';
}

export interface OverviewSummary {
  scope: 'global' | 'school';
  schoolId: number | null;
  referenceDate: string;
  referenceMonth: string;
  serviceStatus: ServiceStatusSummary;
  contracts: {
    total: number;
    active: number;
    pendingRequests: number;
  } | null;
  students: {
    total: number;
    enrolled: number;
    pendingApproval: number;
    suspended: number;
    awaitingPickup: number;
    onBoard: number;
  } | null;
  vehicles: {
    total: number;
    byStatus: Record<string, number>;
    statusSeries: StatusBreakdownItem[];
  } | null;
  drivers: {
    total: number;
    onDuty: number;
    available: number;
    offDuty: number;
  } | null;
  tripsToday: {
    total: number;
    active: number;
    scheduled: number;
    completed: number;
    delayed: number;
    cancelled: number;
    incident: number;
    byState: Record<string, number>;
    stateSeries: StatusBreakdownItem[];
  } | null;
  delayedTripsCount: number | null;
  incidents: {
    total: number;
    open: number;
    criticalOpen: number;
    delayReportsOpen: number;
    resolvedOrClosed: number;
  } | null;
  finance: {
    month: string;
    totalInvoicesThisMonth: number;
    pendingThisMonthCount: number;
    pendingThisMonthAoa: number;
    paidThisMonthCount: number;
    paidThisMonthAoa: number;
    pendingAllTimeCount: number;
    pendingAllTimeAoa: number;
  } | null;
  documents: {
    checkedCount: number;
    expiringNext30DaysTotal: number;
    vehiclesDnvtExpiring30Days: number;
    driversLicenceExpiring30Days: number;
    expiredTotal: number;
    items: ExpiringDocumentItem[];
  } | null;
}

export const OVERVIEW_ACTIVE_TRIP_STATES = new Set([
  'driver_checked_in',
  'in_progress',
  'at_stop',
  'boarding',
  'at_school',
  'return_in_progress',
  'handover_pending',
]);

const GPS_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function getLuandaTodayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function getLuandaCurrentMonthPrefix(now: Date = new Date()): string {
  return getLuandaTodayDateString(now).slice(0, 7);
}

export function getLuandaDateString(dateLike: Date | string | null | undefined): string | null {
  if (!dateLike) return null;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return getLuandaTodayDateString(d);
}

export function diffCalendarDays(fromYmd: string, toYmd: string): number | null {
  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromYmd.trim());
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toYmd.trim());
  if (!fromMatch || !toMatch) return null;
  const fromMs = Date.UTC(Number(fromMatch[1]), Number(fromMatch[2]) - 1, Number(fromMatch[3]));
  const toMs = Date.UTC(Number(toMatch[1]), Number(toMatch[2]) - 1, Number(toMatch[3]));
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function resolveEffectiveGpsStatus(
  gpsStatus: string | null | undefined,
  lastLocationAt: Date | string | null | undefined,
  now: Date = new Date()
): 'live' | 'stale' | 'unavailable' {
  const normalized = String(gpsStatus ?? 'unavailable').toLowerCase();
  if (!lastLocationAt) {
    return normalized === 'stale' ? 'stale' : 'unavailable';
  }
  const ts = lastLocationAt instanceof Date ? lastLocationAt.getTime() : new Date(lastLocationAt).getTime();
  if (Number.isNaN(ts)) {
    return normalized === 'stale' ? 'stale' : 'unavailable';
  }
  const ageMs = now.getTime() - ts;
  if (normalized === 'live' && ageMs <= GPS_STALE_THRESHOLD_MS) {
    return 'live';
  }
  if (normalized === 'live' || normalized === 'stale') {
    return 'stale';
  }
  return 'unavailable';
}

const VEHICLE_STATUS_LABELS_PT: Array<{ key: string; label: string }> = [
  { key: 'on_trip', label: 'Em Rota' },
  { key: 'assigned', label: 'Alocada' },
  { key: 'available', label: 'Disponível' },
  { key: 'reserve', label: 'Reserva' },
  { key: 'maintenance', label: 'Manutenção' },
  { key: 'out_of_service', label: 'Fora de Serviço' },
  { key: 'suspended', label: 'Suspensa' },
];

const TRIP_GROUP_LABELS_PT: Array<{ key: string; label: string }> = [
  { key: 'in_progress', label: 'Em Curso' },
  { key: 'scheduled', label: 'Agendadas' },
  { key: 'delayed', label: 'Atrasadas' },
  { key: 'completed', label: 'Concluídas' },
  { key: 'incident', label: 'Ocorrência' },
  { key: 'cancelled', label: 'Canceladas' },
];

export interface ComputeOverviewInput {
  scope: 'global' | 'school';
  schoolId: number | null;
  visibility: OverviewVisibility;
  dbReachable: boolean;
  dbLatencyMs: number | null;
  now?: Date;
  contracts: Array<{ status: string }>;
  pendingContractRequestsCount?: number;
  students: Array<{ enrollmentStatus: string; currentJourneyState: string }>;
  vehicles: Array<{
    id: number;
    fleetNumber: number;
    plate: string;
    status: string;
    dnvtExpiry: string;
  }>;
  drivers: Array<{
    id: number;
    fullName: string;
    licenceNumber: string;
    licenceExpiry: string;
    availabilityStatus: string;
  }>;
  trips: Array<{
    id: number;
    serviceDate: string;
    state: string;
    delayReason?: string | null;
    gpsStatus: string;
    lastLocationAt: Date | string | null;
  }>;
  incidents: Array<{
    id: number;
    status: string;
    severity: string;
    category: string;
  }>;
  invoices: Array<{
    status: string;
    amountAoa: number;
    createdAt: Date | string;
    confirmedAt: Date | string | null;
  }>;
}

export function computeOverviewSummary(input: ComputeOverviewInput): OverviewSummary {
  const now = input.now ?? new Date();
  const referenceDate = getLuandaTodayDateString(now);
  const referenceMonth = referenceDate.slice(0, 7);
  const { visibility } = input;

  // 1. Service Status Signals (DB reachable, Live vs Stale GPS on operational trips, Open critical incidents)
  const operationalTrips = input.trips.filter(
    (t) => OVERVIEW_ACTIVE_TRIP_STATES.has(t.state) || t.state === 'delayed' || t.state === 'incident'
  );
  let liveGpsTripsCount = 0;
  let staleGpsTripsCount = 0;
  let unavailableGpsActiveTripsCount = 0;

  for (const t of operationalTrips) {
    const eff = resolveEffectiveGpsStatus(t.gpsStatus, t.lastLocationAt, now);
    if (eff === 'live') {
      liveGpsTripsCount += 1;
    } else if (eff === 'stale') {
      staleGpsTripsCount += 1;
    } else {
      unavailableGpsActiveTripsCount += 1;
    }
  }

  const openIncidentsList = input.incidents.filter(
    (inc) => inc.status !== 'resolved' && inc.status !== 'closed'
  );
  const openCriticalIncidentsCount = openIncidentsList.filter(
    (inc) => inc.severity === 'critical'
  ).length;

  const tripsTodayList = input.trips.filter((t) => t.serviceDate === referenceDate);
  const delayedTripsList = input.trips.filter(
    (t) =>
      (t.serviceDate === referenceDate && (t.state === 'delayed' || Boolean(t.delayReason))) ||
      ((OVERVIEW_ACTIVE_TRIP_STATES.has(t.state) || t.state === 'delayed') && t.state === 'delayed')
  );
  const delayedTripsCountAll = new Set(delayedTripsList.map((t) => t.id)).size;

  let serviceState: ServiceStatusSummary['state'] = 'no_data';
  let serviceLabel = 'Sem Telemetria Ativa';
  let serviceTone: ServiceStatusSummary['tone'] = 'neutral';
  let serviceReason = 'Base de dados acessível · sem viagens ativas com GPS';

  if (!input.dbReachable) {
    serviceState = 'outage';
    serviceLabel = 'Indisponível';
    serviceTone = 'danger';
    serviceReason = 'Base de dados PostgreSQL inacessível';
  } else if (openCriticalIncidentsCount > 0) {
    serviceState = 'degraded';
    serviceLabel = 'Degradado';
    serviceTone = 'danger';
    serviceReason = `${openCriticalIncidentsCount} ocorrência(s) crítica(s) em aberto · GPS ${liveGpsTripsCount} ao vivo / ${staleGpsTripsCount} desatualizado`;
  } else if (
    operationalTrips.length > 0 &&
    liveGpsTripsCount === 0 &&
    (staleGpsTripsCount > 0 || unavailableGpsActiveTripsCount > 0)
  ) {
    serviceState = 'degraded';
    serviceLabel = 'Degradado';
    serviceTone = 'danger';
    serviceReason = `${staleGpsTripsCount + unavailableGpsActiveTripsCount} viagem(ns) ativa(s) sem sinal GPS ao vivo`;
  } else if (staleGpsTripsCount > 0 || unavailableGpsActiveTripsCount > 0 || delayedTripsCountAll > 0) {
    serviceState = 'attention';
    serviceLabel = 'Atenção';
    serviceTone = 'warn';
    const parts: string[] = [];
    if (staleGpsTripsCount > 0) parts.push(`${staleGpsTripsCount} GPS desatualizado`);
    if (unavailableGpsActiveTripsCount > 0) parts.push(`${unavailableGpsActiveTripsCount} sem GPS`);
    if (delayedTripsCountAll > 0) parts.push(`${delayedTripsCountAll} viagem(ns) com atraso`);
    parts.push(`${liveGpsTripsCount} GPS ao vivo`);
    serviceReason = parts.join(' · ');
  } else if (liveGpsTripsCount > 0) {
    serviceState = 'operational';
    serviceLabel = 'Operacional';
    serviceTone = 'ok';
    serviceReason = `BD online · ${liveGpsTripsCount} viagem(ns) com GPS ao vivo · 0 críticos`;
  }

  const serviceStatus: ServiceStatusSummary = {
    state: serviceState,
    label: serviceLabel,
    tone: serviceTone,
    reason: serviceReason,
    dbReachable: input.dbReachable,
    dbLatencyMs: input.dbLatencyMs,
    liveGpsTripsCount,
    staleGpsTripsCount,
    unavailableGpsActiveTripsCount,
    openCriticalIncidentsCount,
    delayedTripsCount: delayedTripsCountAll,
    checkedAt: now.toISOString(),
  };

  // 2. Contracts
  const contractsSummary = visibility.canViewContractsKpi
    ? {
        total: input.contracts.length,
        active: input.contracts.filter((c) => c.status === 'active').length,
        pendingRequests: input.pendingContractRequestsCount ?? 0,
      }
    : null;

  // 3. Students Enrolled
  const activeStudents = input.students.filter((s) => s.enrollmentStatus === 'active');
  const studentsSummary = visibility.canViewStudentsKpi
    ? {
        total: input.students.length,
        enrolled: activeStudents.length,
        pendingApproval: input.students.filter((s) => s.enrollmentStatus === 'pending_approval').length,
        suspended: input.students.filter((s) => s.enrollmentStatus === 'suspended').length,
        awaitingPickup: activeStudents.filter(
          (s) => s.currentJourneyState === 'expected' || s.currentJourneyState === 'present'
        ).length,
        onBoard: activeStudents.filter(
          (s) => s.currentJourneyState === 'boarded' || s.currentJourneyState === 'in_transit'
        ).length,
      }
    : null;

  // 4. Vehicles by status
  let vehiclesSummary: OverviewSummary['vehicles'] = null;
  if (visibility.canViewFleetKpi) {
    const byStatus: Record<string, number> = {};
    for (const v of input.vehicles) {
      const key = v.status || 'available';
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    const seenKeys = new Set<string>();
    const statusSeries: StatusBreakdownItem[] = [];
    for (const item of VEHICLE_STATUS_LABELS_PT) {
      seenKeys.add(item.key);
      const count = byStatus[item.key] ?? 0;
      if (count > 0 || ['on_trip', 'assigned', 'available', 'maintenance'].includes(item.key)) {
        statusSeries.push({ key: item.key, label: item.label, count });
      }
    }
    for (const [k, count] of Object.entries(byStatus)) {
      if (!seenKeys.has(k) && count > 0) {
        statusSeries.push({ key: k, label: k, count });
      }
    }
    vehiclesSummary = {
      total: input.vehicles.length,
      byStatus,
      statusSeries,
    };
  }

  // 5. Drivers on duty
  const driversSummary = visibility.canViewDriversKpi
    ? {
        total: input.drivers.length,
        onDuty: input.drivers.filter((d) => d.availabilityStatus === 'in_service').length,
        available: input.drivers.filter((d) => d.availabilityStatus === 'available').length,
        offDuty: input.drivers.filter((d) => d.availabilityStatus === 'off_duty').length,
      }
    : null;

  // 6. Trips today by state + delayed trips
  let tripsTodaySummary: OverviewSummary['tripsToday'] = null;
  if (visibility.canViewTripsKpi) {
    const byState: Record<string, number> = {};
    let active = 0;
    let scheduled = 0;
    let completed = 0;
    let delayed = 0;
    let cancelled = 0;
    let incident = 0;

    for (const t of tripsTodayList) {
      byState[t.state] = (byState[t.state] ?? 0) + 1;
      if (t.state === 'scheduled') scheduled += 1;
      else if (t.state === 'completed') completed += 1;
      else if (t.state === 'cancelled') cancelled += 1;
      else if (t.state === 'delayed') delayed += 1;
      else if (t.state === 'incident') incident += 1;
      else if (OVERVIEW_ACTIVE_TRIP_STATES.has(t.state)) active += 1;
    }

    const groupedCounts: Record<string, number> = {
      in_progress: active,
      scheduled,
      delayed,
      completed,
      incident,
      cancelled,
    };
    const stateSeries: StatusBreakdownItem[] = TRIP_GROUP_LABELS_PT.map((item) => ({
      key: item.key,
      label: item.label,
      count: groupedCounts[item.key] ?? 0,
    })).filter((row) => row.count > 0 || ['in_progress', 'scheduled', 'delayed', 'completed'].includes(row.key));

    tripsTodaySummary = {
      total: tripsTodayList.length,
      active,
      scheduled,
      completed,
      delayed,
      cancelled,
      incident,
      byState,
      stateSeries,
    };
  }

  const delayedTripsCount = visibility.canViewTripsKpi ? delayedTripsCountAll : null;

  // 7. Open incidents
  const incidentsSummary = visibility.canViewIncidentsKpi
    ? {
        total: input.incidents.length,
        open: openIncidentsList.length,
        criticalOpen: openCriticalIncidentsCount,
        delayReportsOpen: openIncidentsList.filter((i) => i.category === 'traffic_delay').length,
        resolvedOrClosed: input.incidents.length - openIncidentsList.length,
      }
    : null;

  // 8. Invoices pending & paid this month with total in Kz (STRICTLY finance & super admin)
  let financeSummary: OverviewSummary['finance'] = null;
  if (visibility.canViewFinanceKpi) {
    let totalInvoicesThisMonth = 0;
    let pendingThisMonthCount = 0;
    let pendingThisMonthAoa = 0;
    let paidThisMonthCount = 0;
    let paidThisMonthAoa = 0;
    let pendingAllTimeCount = 0;
    let pendingAllTimeAoa = 0;

    for (const inv of input.invoices) {
      const amount = Number(inv.amountAoa) || 0;
      const isPaid = inv.status === 'confirmed';
      const isPending = inv.status === 'draft' || inv.status === 'initiated' || inv.status === 'pending_provider';
      const createdDay = getLuandaDateString(inv.createdAt);
      const paidDay = getLuandaDateString(inv.confirmedAt ?? inv.createdAt);
      const createdThisMonth = createdDay != null && createdDay.startsWith(referenceMonth);
      const paidThisMonth = paidDay != null && paidDay.startsWith(referenceMonth);

      if (isPending) {
        pendingAllTimeCount += 1;
        pendingAllTimeAoa += amount;
        if (createdThisMonth) {
          pendingThisMonthCount += 1;
          pendingThisMonthAoa += amount;
          totalInvoicesThisMonth += 1;
        }
      } else if (isPaid) {
        if (paidThisMonth) {
          paidThisMonthCount += 1;
          paidThisMonthAoa += amount;
          totalInvoicesThisMonth += 1;
        }
      } else if (createdThisMonth) {
        totalInvoicesThisMonth += 1;
      }
    }

    financeSummary = {
      month: referenceMonth,
      totalInvoicesThisMonth,
      pendingThisMonthCount,
      pendingThisMonthAoa,
      paidThisMonthCount,
      paidThisMonthAoa,
      pendingAllTimeCount,
      pendingAllTimeAoa,
    };
  }

  // 9. Documents expiring in the next 30 days (vehicles DNVT + drivers licences)
  let documentsSummary: OverviewSummary['documents'] = null;
  if (visibility.canViewDocumentsKpi) {
    const items: ExpiringDocumentItem[] = [];
    let vehiclesDnvtExpiring30Days = 0;
    let driversLicenceExpiring30Days = 0;
    let expiredTotal = 0;

    for (const v of input.vehicles) {
      const diff = diffCalendarDays(referenceDate, v.dnvtExpiry);
      if (diff == null) continue;
      if (diff < 0) {
        expiredTotal += 1;
        items.push({
          entityType: 'vehicle',
          entityId: v.id,
          title: `Autocarro ${v.fleetNumber} · ${v.plate}`,
          subtitle: 'Inspeção DNVT',
          documentType: 'DNVT',
          expiryDate: v.dnvtExpiry,
          daysRemaining: diff,
          status: 'expired',
        });
      } else if (diff <= 30) {
        vehiclesDnvtExpiring30Days += 1;
        items.push({
          entityType: 'vehicle',
          entityId: v.id,
          title: `Autocarro ${v.fleetNumber} · ${v.plate}`,
          subtitle: 'Inspeção DNVT',
          documentType: 'DNVT',
          expiryDate: v.dnvtExpiry,
          daysRemaining: diff,
          status: 'expiring_30d',
        });
      }
    }

    for (const d of input.drivers) {
      const diff = diffCalendarDays(referenceDate, d.licenceExpiry);
      if (diff == null) continue;
      if (diff < 0) {
        expiredTotal += 1;
        items.push({
          entityType: 'driver',
          entityId: d.id,
          title: d.fullName,
          subtitle: `Carta ${d.licenceNumber}`,
          documentType: 'Carta de Condução',
          expiryDate: d.licenceExpiry,
          daysRemaining: diff,
          status: 'expired',
        });
      } else if (diff <= 30) {
        driversLicenceExpiring30Days += 1;
        items.push({
          entityType: 'driver',
          entityId: d.id,
          title: d.fullName,
          subtitle: `Carta ${d.licenceNumber}`,
          documentType: 'Carta de Condução',
          expiryDate: d.licenceExpiry,
          daysRemaining: diff,
          status: 'expiring_30d',
        });
      }
    }

    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    documentsSummary = {
      checkedCount: input.vehicles.length + input.drivers.length,
      expiringNext30DaysTotal: vehiclesDnvtExpiring30Days + driversLicenceExpiring30Days,
      vehiclesDnvtExpiring30Days,
      driversLicenceExpiring30Days,
      expiredTotal,
      items: items.slice(0, 10),
    };
  }

  return {
    scope: input.scope,
    schoolId: input.schoolId,
    referenceDate,
    referenceMonth,
    serviceStatus,
    contracts: contractsSummary,
    students: studentsSummary,
    vehicles: vehiclesSummary,
    drivers: driversSummary,
    tripsToday: tripsTodaySummary,
    delayedTripsCount,
    incidents: incidentsSummary,
    finance: financeSummary,
    documents: documentsSummary,
  };
}

export function formatCountOrNoData(value: number | null | undefined, hasData: boolean): string | number {
  if (!hasData || value == null) return 'sem dados';
  return value;
}
