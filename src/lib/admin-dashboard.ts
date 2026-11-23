import { ROLE_LABELS, type MoBussRole } from "@/contexts/AuthContext";
import { checkStopGeofences } from "@/lib/luanda-geofence";
import { LUANDA_ROUTES } from "@/lib/route-luanda";

export interface AdminRolePermissions {
  canManageContracts: boolean;
  canManageVehicles: boolean;
  canManageRouteSchedules: boolean;
  canEditDrivers: boolean;
  canCreateStudents: boolean;
  canEditStudents: boolean;
  canManageIncidents: boolean;
  canCreateUsers: boolean;
  canManageRbac: boolean;
  canManagePricing: boolean;
}

export function getAdminRolePermissions(role?: MoBussRole): AdminRolePermissions {
  if (!role) {
    return {
      canManageContracts: false,
      canManageVehicles: false,
      canManageRouteSchedules: false,
      canEditDrivers: false,
      canCreateStudents: false,
      canEditStudents: false,
      canManageIncidents: false,
      canCreateUsers: false,
      canManageRbac: false,
      canManagePricing: false,
    };
  }

  return {
    canManageContracts: role === "mobuss_super_admin" || role === "school_account_manager",
    canManageVehicles: role === "mobuss_super_admin" || role === "fleet_manager" || role === "operations_manager",
    canManageRouteSchedules:
      role === "mobuss_super_admin" ||
      role === "operations_manager" ||
      role === "fleet_manager" ||
      role === "school_account_manager",
    canEditDrivers: role === "mobuss_super_admin" || role === "fleet_manager" || role === "operations_manager",
    canCreateStudents:
      role === "mobuss_super_admin" || role === "operations_manager" || role === "school_account_manager",
    canEditStudents:
      role === "mobuss_super_admin" ||
      role === "operations_manager" ||
      role === "school_account_manager" ||
      role === "safety_support_agent",
    canManageIncidents:
      role === "mobuss_super_admin" || role === "operations_manager" || role === "safety_support_agent",
    canCreateUsers:
      role === "mobuss_super_admin" || role === "operations_manager" || role === "school_account_manager",
    canManageRbac: role === "mobuss_super_admin",
    canManagePricing: role === "mobuss_super_admin" || role === "finance_officer",
  };
}

export type AuditSeverity = "info" | "success" | "warn" | "critical";
export type AuditCategory = "Segurança" | "Frota" | "Contratos" | "Alunos" | "Operações" | "Finanças" | "Sistema";

export interface RawAuditLogItem {
  id: number;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string | null;
  summary: string;
  createdAt: string;
}

export interface FormattedAuditActivity {
  id: number;
  title: string;
  category: AuditCategory;
  severity: AuditSeverity;
  summary: string;
  actorDisplay: string;
  actorRoleDisplay: string;
  targetDisplay: string;
  rawAction: string;
  dateLabel: string;
  timeLabel: string;
  fullDateTimeLabel: string;
}

const AUDIT_ACTION_META: Record<string, { title: string; category: AuditCategory; severity: AuditSeverity }> = {
  "auth.login_success": { title: "Sessão iniciada com sucesso", category: "Segurança", severity: "info" },
  "auth.login_failed": { title: "Falha no início de sessão", category: "Segurança", severity: "warn" },
  "auth.deletion_requested": { title: "Pedido de eliminação de conta", category: "Segurança", severity: "warn" },
  "access.denied": { title: "Acesso negado por permissão RBAC", category: "Segurança", severity: "critical" },
  "access.unprovisioned_blocked": {
    title: "Acesso bloqueado — conta não provisionada",
    category: "Segurança",
    severity: "critical",
  },
  "user.provisioned_activated": { title: "Conta ativada no primeiro acesso", category: "Sistema", severity: "success" },
  "user.bootstrap_super_admin": { title: "Super Administrador inicializado", category: "Sistema", severity: "info" },
  "system.user_created": { title: "Nova conta de utilizador criada", category: "Sistema", severity: "success" },
  "system.user_updated": { title: "Conta de utilizador atualizada", category: "Sistema", severity: "info" },
  "system.user_deleted": { title: "Conta de utilizador eliminada", category: "Sistema", severity: "warn" },
  "system.user_enabled": { title: "Conta de utilizador reativada", category: "Sistema", severity: "success" },
  "system.user_disabled": { title: "Conta de utilizador desativada", category: "Segurança", severity: "warn" },
  "system.user_password_updated": {
    title: "Palavra-passe redefinida pelo Admin",
    category: "Segurança",
    severity: "warn",
  },
  "system.role_updated": { title: "Perfil de acesso RBAC alterado", category: "Segurança", severity: "warn" },
  "system.seed_staging": { title: "Base de dados inicializada", category: "Sistema", severity: "info" },
  "contract_request.submitted": {
    title: "Novo pedido público de contrato submetido",
    category: "Contratos",
    severity: "info",
  },
  "contract_request.approved": {
    title: "Pedido aprovado e contrato escolar criado",
    category: "Contratos",
    severity: "success",
  },
  "contract_request.rejected": { title: "Pedido de contrato recusado", category: "Contratos", severity: "warn" },
  "contract_request.under_review": { title: "Pedido de contrato em análise", category: "Contratos", severity: "info" },
  "contract.created": { title: "Novo contrato escolar registado", category: "Contratos", severity: "success" },
  "school.student_submitted": {
    title: "Educando submetido pelo Portal Escolar",
    category: "Alunos",
    severity: "info",
  },
  "school.transport_change_requested": {
    title: "Pedido de alteração submetido pela escola",
    category: "Contratos",
    severity: "info",
  },
  "school_request.approved": { title: "Pedido operacional escolar aprovado", category: "Contratos", severity: "success" },
  "school_request.rejected": { title: "Pedido operacional escolar recusado", category: "Contratos", severity: "warn" },
  "vehicle_owner.created": { title: "Proprietário parceiro registado", category: "Frota", severity: "success" },
  "vehicle.created": { title: "Viatura registada na frota", category: "Frota", severity: "success" },
  "vehicle.updated": { title: "Dados da viatura atualizados", category: "Frota", severity: "info" },
  "fleet.driver_assigned": { title: "Motorista alocado à viatura", category: "Frota", severity: "info" },
  "route_schedule.created": { title: "Escala de rota recorrente agendada", category: "Operações", severity: "success" },
  "route_schedule.updated": { title: "Escala de rota recorrente atualizada", category: "Operações", severity: "info" },
  "route_schedule.deleted": { title: "Escala de rota recorrente removida", category: "Operações", severity: "warn" },
  "driver.updated": { title: "Dados do motorista atualizados", category: "Frota", severity: "info" },
  "student.created_by_admin": { title: "Educando registado pelo Admin", category: "Alunos", severity: "success" },
  "student.updated": { title: "Dados do educando modificados", category: "Alunos", severity: "info" },
  "student.deleted": { title: "Educando removido da pauta", category: "Alunos", severity: "warn" },
  "student.pin_revoked_and_reissued": {
    title: "PIN do educando revogado e reemitido",
    category: "Segurança",
    severity: "warn",
  },
  "pin.rotated_by_guardian": {
    title: "PIN rotacionado pelo encarregado",
    category: "Segurança",
    severity: "info",
  },
  "guardian.linked_to_student": {
    title: "Encarregado associado ao educando",
    category: "Alunos",
    severity: "info",
  },
  "handover.pin_validated_boarding": {
    title: "Embarque confirmado via PIN seguro",
    category: "Operações",
    severity: "success",
  },
  "handover.pin_validated_dropoff": {
    title: "Desembarque confirmado via PIN seguro",
    category: "Operações",
    severity: "success",
  },
  "handover.pin_failed": { title: "Tentativa de PIN inválido registada", category: "Segurança", severity: "critical" },
  "attendance.absence_reported": {
    title: "Falta comunicada pelo encarregado",
    category: "Operações",
    severity: "info",
  },
  "trip.state_changed": { title: "Estado operacional da viagem atualizado", category: "Operações", severity: "info" },
  "trip.empty_bus_sweep": {
    title: "Inspeção anti-esquecimento confirmada",
    category: "Operações",
    severity: "success",
  },
  "incident.created": { title: "Nova ocorrência operacional reportada", category: "Operações", severity: "critical" },
  "incident.acknowledged": { title: "Ocorrência reconhecida pela central", category: "Operações", severity: "info" },
  "incident.assigned": { title: "Ocorrência atribuída a técnico", category: "Operações", severity: "info" },
  "incident.in_progress": { title: "Ocorrência em tratamento ativo", category: "Operações", severity: "warn" },
  "incident.resolved": { title: "Ocorrência encerrada como resolvida", category: "Operações", severity: "success" },
  "incident.closed": { title: "Ocorrência fechada", category: "Operações", severity: "success" },
  "pricing.updated": { title: "Tarifário atualizado em PostgreSQL", category: "Finanças", severity: "info" },
  "invoice.reconciled": { title: "Fatura conciliada manualmente", category: "Finanças", severity: "success" },
  "payment.entity_pin_generated": {
    title: "Referência Multicaixa Express gerada",
    category: "Finanças",
    severity: "info",
  },
  "simulation.started": {
    title: "Simulação de rota iniciada (Teste Hub)",
    category: "Sistema",
    severity: "info",
  },
};

export function formatAuditActivity(log: RawAuditLogItem): FormattedAuditActivity {
  const mapped = AUDIT_ACTION_META[log.action];
  const created = new Date(log.createdAt);
  const validDate = !Number.isNaN(created.getTime());

  const actorRoleKey = log.actorRole as MoBussRole;
  const actorRoleDisplay = ROLE_LABELS[actorRoleKey] ?? (log.actorRole || "Sistema");
  const actorDisplay = log.actorEmail?.trim() || "Sistema MôBuss";

  const fallbackTitle = log.action
    .split(/[._]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    id: log.id,
    title: mapped?.title ?? fallbackTitle,
    category: mapped?.category ?? "Sistema",
    severity: mapped?.severity ?? "info",
    summary: log.summary,
    actorDisplay,
    actorRoleDisplay,
    targetDisplay: log.targetId ? `${log.targetEntity} #${log.targetId}` : log.targetEntity,
    rawAction: log.action,
    dateLabel: validDate ? created.toLocaleDateString("pt-AO", { day: "2-digit", month: "short" }) : "—",
    timeLabel: validDate ? created.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" }) : "—",
    fullDateTimeLabel: validDate ? created.toLocaleString("pt-AO") : "—",
  };
}

export const ACTIVE_TRIP_STATES = new Set([
  "driver_checked_in",
  "in_progress",
  "at_stop",
  "boarding",
  "at_school",
  "return_in_progress",
  "handover_pending",
]);

export interface LiveTripSnapshot {
  id: number;
  tripCode: string;
  routeCode: string;
  routeName: string;
  legType: string;
  serviceDate: string;
  schoolId: number | null;
  vehicleId: number | null;
  driverId: number | null;
  state: string;
  lastLat: string | null;
  lastLng: string | null;
  lastLocationAt: string | null;
  gpsStatus: string;
  emptyBusSweepVerified: boolean;
}

export interface RecurringRouteScheduleItem {
  id: number;
  schoolId: number;
  schoolName: string;
  vehicleId: number | null;
  vehicleFleetNumber: number | null;
  vehiclePlate: string | null;
  driverId: number | null;
  driverName: string;
  routeCode: string;
  routeName: string;
  daysOfWeek: string;
  shiftType: string;
  departureTime: string;
  arrivalTime: string;
  active: boolean;
  notes: string | null;
}

export interface LiveFleetVehicleItem {
  id: number;
  fleetNumber: number;
  plate: string;
  ownerName: string;
  assignedSchoolId: number | null;
  associatedSchoolIds: number[];
  associatedSchoolNames: string[];
  primarySchoolName: string;
  routeCode: string;
  routeName: string;
  routeId: string | null;
  driverName: string;
  driverPhone: string | null;
  driverAvailability: string | null;
  status: string;
  capacity: number;
  studentsAssignedCount: number;
  studentsBoardedCount: number;
  studentsAwaitingCount: number;
  activeTrip: LiveTripSnapshot | null;
  tripFilterCategory: "active" | "delayed" | "idle";
  hasLiveGps: boolean;
  hasCoordinates: boolean;
  lat: number | null;
  lng: number | null;
  lastLocationAt: string | null;
  gpsStatus: "live" | "stale" | "unavailable";
  locationLabel: string;
  dnvtStatus: string;
}

export const ROUTE_CODE_TO_ID: Record<string, string> = {
  "ROTA-A": "route_a",
  "ROTA-B": "route_b",
  "ROTA-C": "route_c",
  "ROTA-D": "route_d",
};

export const WEEKDAY_OPTIONS: Array<{ id: string; short: string; label: string }> = [
  { id: "mon", short: "Seg", label: "Segunda" },
  { id: "tue", short: "Ter", label: "Terça" },
  { id: "wed", short: "Qua", label: "Quarta" },
  { id: "thu", short: "Qui", label: "Quinta" },
  { id: "fri", short: "Sex", label: "Sexta" },
  { id: "sat", short: "Sáb", label: "Sábado" },
  { id: "sun", short: "Dom", label: "Domingo" },
];

export function formatWeekdaysPt(daysOfWeek: string): string {
  const days = daysOfWeek
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (days.length === 5 && ["mon", "tue", "wed", "thu", "fri"].every((d) => days.includes(d))) {
    return "Seg–Sex";
  }
  if (days.length === 6 && ["mon", "tue", "wed", "thu", "fri", "sat"].every((d) => days.includes(d))) {
    return "Seg–Sáb";
  }
  if (days.length === 7) return "Todos os dias";
  const map = new Map(WEEKDAY_OPTIONS.map((w) => [w.id, w.short]));
  return days.map((d) => map.get(d) ?? d).join(", ") || "—";
}

export function translateVehicleStatus(status: string): string {
  switch (status) {
    case "on_trip":
      return "Em Rota";
    case "assigned":
      return "Alocada";
    case "available":
      return "Disponível";
    case "reserve":
      return "Reserva";
    case "maintenance":
      return "Manutenção";
    case "out_of_service":
      return "Fora de Serviço";
    case "suspended":
      return "Suspensa";
    default:
      return status;
  }
}

export function translateTripState(state: string): string {
  switch (state) {
    case "scheduled":
      return "Agendada";
    case "driver_checked_in":
      return "Motorista Check-in";
    case "in_progress":
      return "Em Curso";
    case "at_stop":
      return "Na Paragem";
    case "boarding":
      return "Em Embarque";
    case "at_school":
      return "Na Escola";
    case "return_in_progress":
      return "Regresso em Curso";
    case "handover_pending":
      return "Entrega Pendente";
    case "completed":
      return "Concluída";
    case "delayed":
      return "Atrasada";
    case "cancelled":
      return "Cancelada";
    case "incident":
      return "Ocorrência";
    default:
      return state;
  }
}

export function buildLiveFleetVehicles(params: {
  schools: Array<{ id: number; name: string }>;
  vehicles: Array<{
    id: number;
    fleetNumber: number;
    plate: string;
    ownerName: string;
    assignedDriverId: number | null;
    assignedSchoolId?: number | null;
    driverName: string;
    routeCode: string | null;
    routeName?: string | null;
    capacity: number;
    dnvtStatus: string;
    status: string;
  }>;
  drivers: Array<{
    id: number;
    phone: string;
    availabilityStatus: string;
  }>;
  students: Array<{
    schoolId: number;
    routeCode: string;
    currentJourneyState: string;
    enrollmentStatus: string;
  }>;
  trips: LiveTripSnapshot[];
  routeSchedules?: RecurringRouteScheduleItem[];
}): LiveFleetVehicleItem[] {
  const driverMap = new Map(params.drivers.map((d) => [d.id, d]));
  const schoolMap = new Map(params.schools.map((s) => [s.id, s]));

  return params.vehicles.map((v) => {
    const driver = v.assignedDriverId ? driverMap.get(v.assignedDriverId) : undefined;
    const routeCode = v.routeCode || "—";
    const routeId = ROUTE_CODE_TO_ID[routeCode] ?? null;
    const routeCfg = routeId ? LUANDA_ROUTES[routeId] : undefined;

    const matchingTrips = params.trips.filter(
      (t) => t.vehicleId === v.id || (t.vehicleId == null && t.routeCode === routeCode)
    );
    const activeTrip =
      matchingTrips.find((t) => ACTIVE_TRIP_STATES.has(t.state) || t.state === "delayed" || t.state === "incident") ??
      matchingTrips.find((t) => t.lastLat != null && t.lastLng != null) ??
      matchingTrips[0] ??
      null;

    // Collect real associated schools from vehicle assignment, trips, recurring schedules, and route students
    const schoolIdSet = new Set<number>();
    if (v.assignedSchoolId != null && schoolMap.has(v.assignedSchoolId)) {
      schoolIdSet.add(v.assignedSchoolId);
    }
    matchingTrips.forEach((t) => {
      if (t.schoolId != null && schoolMap.has(t.schoolId)) schoolIdSet.add(t.schoolId);
    });
    (params.routeSchedules ?? []).forEach((sch) => {
      if (sch.vehicleId === v.id && sch.active && schoolMap.has(sch.schoolId)) {
        schoolIdSet.add(sch.schoolId);
      }
    });
    if (schoolIdSet.size === 0 && routeCode !== "—" && routeCode !== "RESERVA") {
      params.students.forEach((st) => {
        if (st.routeCode === routeCode && st.enrollmentStatus === "active" && schoolMap.has(st.schoolId)) {
          schoolIdSet.add(st.schoolId);
        }
      });
    }

    const associatedSchoolIds = Array.from(schoolIdSet);
    const associatedSchoolNames = associatedSchoolIds
      .map((id) => schoolMap.get(id)?.name)
      .filter((name): name is string => Boolean(name));

    const parsedLat = activeTrip?.lastLat != null ? Number(activeTrip.lastLat) : NaN;
    const parsedLng = activeTrip?.lastLng != null ? Number(activeTrip.lastLng) : NaN;
    const hasCoordinates = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
    const rawGps = activeTrip?.gpsStatus ?? "unavailable";
    const gpsStatus: "live" | "stale" | "unavailable" =
      hasCoordinates && rawGps === "live"
        ? "live"
        : hasCoordinates || rawGps === "stale"
        ? "stale"
        : "unavailable";
    const hasLiveGps = gpsStatus === "live" && hasCoordinates;

    let locationLabel = "Localização indisponível";
    if (hasCoordinates) {
      const geo = routeCode !== "—" && routeCode !== "RESERVA" ? checkStopGeofences(routeCode, parsedLat, parsedLng) : null;
      const coordText = `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`;
      locationLabel = geo
        ? `${geo.nearestStop.stopName} (${coordText})`
        : coordText;
    }

    const routeStudents = params.students.filter(
      (s) =>
        s.routeCode === routeCode &&
        s.enrollmentStatus === "active" &&
        (associatedSchoolIds.length === 0 || associatedSchoolIds.includes(s.schoolId))
    );
    const studentsBoardedCount = routeStudents.filter(
      (s) => s.currentJourneyState === "boarded" || s.currentJourneyState === "in_transit"
    ).length;
    const studentsAwaitingCount = routeStudents.filter(
      (s) => s.currentJourneyState === "expected" || s.currentJourneyState === "present"
    ).length;

    const tripFilterCategory: "active" | "delayed" | "idle" =
      activeTrip && (activeTrip.state === "delayed" || activeTrip.state === "incident")
        ? "delayed"
        : activeTrip && ACTIVE_TRIP_STATES.has(activeTrip.state)
        ? "active"
        : "idle";

    return {
      id: v.id,
      fleetNumber: v.fleetNumber,
      plate: v.plate,
      ownerName: v.ownerName,
      assignedSchoolId: v.assignedSchoolId ?? null,
      associatedSchoolIds,
      associatedSchoolNames,
      primarySchoolName: associatedSchoolNames[0] ?? "Sem escola atribuída",
      routeCode,
      routeName: v.routeName || routeCfg?.name || routeCode,
      routeId,
      driverName: v.driverName,
      driverPhone: driver?.phone ?? null,
      driverAvailability: driver?.availabilityStatus ?? null,
      status: v.status,
      capacity: v.capacity,
      studentsAssignedCount: routeStudents.length,
      studentsBoardedCount,
      studentsAwaitingCount,
      activeTrip,
      tripFilterCategory,
      hasLiveGps,
      hasCoordinates,
      lat: hasCoordinates ? parsedLat : null,
      lng: hasCoordinates ? parsedLng : null,
      lastLocationAt: activeTrip?.lastLocationAt ?? null,
      gpsStatus,
      locationLabel,
      dnvtStatus: v.dnvtStatus,
    };
  });
}

export interface LiveOperationsSummary {
  activeTripsCount: number;
  scheduledTripsCount: number;
  vehiclesMovingCount: number;
  driversOnDutyCount: number;
  totalDriversCount: number;
  delayedTripsCount: number;
  studentsAwaitingPickupCount: number;
  studentsOnBoardCount: number;
  activeAlertsCount: number;
  hasAnyActiveOperations: boolean;
}

export function deriveLiveOperationsSummary(params: {
  trips: LiveTripSnapshot[];
  vehicles: Array<{ id: number; status: string }>;
  drivers: Array<{ id: number; availabilityStatus: string }>;
  students: Array<{ enrollmentStatus: string; currentJourneyState: string }>;
  openIncidentsCount: number;
  activeHazardsCount: number;
}): LiveOperationsSummary {
  const activeTrips = params.trips.filter((t) => ACTIVE_TRIP_STATES.has(t.state));
  const scheduledTrips = params.trips.filter((t) => t.state === "scheduled");
  const delayedTrips = params.trips.filter((t) => t.state === "delayed" || t.state === "incident");

  const tripVehicleIdsWithLiveGps = new Set(
    activeTrips.filter((t) => t.gpsStatus === "live" && t.vehicleId != null).map((t) => t.vehicleId!)
  );
  const vehiclesMovingCount = params.vehicles.filter(
    (v) => v.status === "on_trip" || tripVehicleIdsWithLiveGps.has(v.id)
  ).length;

  const driversOnDutyCount = params.drivers.filter((d) => d.availabilityStatus === "in_service").length;

  const activeStudents = params.students.filter((s) => s.enrollmentStatus === "active");
  const studentsAwaitingPickupCount = activeStudents.filter(
    (s) => s.currentJourneyState === "expected" || s.currentJourneyState === "present"
  ).length;
  const studentsOnBoardCount = activeStudents.filter(
    (s) => s.currentJourneyState === "boarded" || s.currentJourneyState === "in_transit"
  ).length;

  const activeAlertsCount = params.openIncidentsCount + params.activeHazardsCount;

  return {
    activeTripsCount: activeTrips.length,
    scheduledTripsCount: scheduledTrips.length,
    vehiclesMovingCount,
    driversOnDutyCount,
    totalDriversCount: params.drivers.length,
    delayedTripsCount: delayedTrips.length,
    studentsAwaitingPickupCount,
    studentsOnBoardCount,
    activeAlertsCount,
    hasAnyActiveOperations:
      activeTrips.length > 0 || vehiclesMovingCount > 0 || delayedTrips.length > 0 || activeAlertsCount > 0,
  };
}
