import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  Bus,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudRain,
  Construction,
  CreditCard,
  Database,
  Download,
  FileSignature,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Minus,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Power,
  Presentation,
  Radio,
  RefreshCw,
  RotateCcw,
  Route as RouteIcon,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Smartphone,
  Star,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { LuandaMap, type LuandaFleetMarker } from "@/components/LuandaMap";
import { AuthGatePanel } from "@/components/AuthGatePanel";
import { ROLE_LABELS, useAuth, type MoBussRole } from "@/contexts/AuthContext";
import { APP_TARGET } from "@/lib/runtime-config";
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket";
import { downloadServerCsv } from "@/lib/csv-download";
import { type RouteDto, type RouteStopDto } from "@/lib/luanda-geofence";
import {
  ACTIVE_TRIP_STATES,
  buildLiveFleetVehicles,
  computeOverviewSummary,
  deriveLiveOperationsSummary,
  formatAuditActivity,
  formatWeekdaysPt,
  getAdminRolePermissions,
  translateTripState,
  translateVehicleStatus,
  WEEKDAY_OPTIONS,
  type OverviewSummary,
  type RecurringRouteScheduleItem,
} from "@/lib/admin-dashboard";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import {
  clearHazardForBus,
  DEFAULT_PRICING,
  formatAOA,
  readMoBussSync,
  subscribeMoBussSync,
  updatePricingConfig,
  type MoBussSyncState,
  type SyncedPricingConfig,
} from "@/lib/mobuss-sync";

export type AdminTab =
  | "Painel"
  | "Contratos"
  | "Frota"
  | "Rotas & Escalas"
  | "Motoristas"
  | "Alunos"
  | "Finanças"
  | "DNVT"
  | "Emergências"
  | "Relatórios"
  | "Sistema & Acessos";

const ADMIN_TABS: Array<{ id: AdminTab; Icon: LucideIcon; desc: string }> = [
  { id: "Painel", Icon: LayoutDashboard, desc: "Visão Geral das Operações" },
  { id: "Contratos", Icon: FileSignature, desc: "Pedidos, Escolas & Contratos" },
  { id: "Frota", Icon: Bus, desc: "Proprietários, Autocarros & Alocação" },
  { id: "Rotas & Escalas", Icon: CalendarClock, desc: "Corredores, Paragens & Escalas" },
  { id: "Motoristas", Icon: UserCheck, desc: "Equipa & Verificação" },
  { id: "Alunos", Icon: GraduationCap, desc: "Diretório & Segurança PIN" },
  { id: "Finanças", Icon: CreditCard, desc: "Tarifário, Faturas & Parceiros" },
  { id: "DNVT", Icon: ShieldCheck, desc: "Inspeções & Anti-Esquecimento" },
  { id: "Emergências", Icon: Siren, desc: "Ocorrências SOS & Via" },
  { id: "Relatórios", Icon: BarChart3, desc: "Auditoria & Exportação" },
  { id: "Sistema & Acessos", Icon: KeyRound, desc: "RBAC & Registos de Auditoria" },
];

interface AdminOverviewData {
  schools: Array<{
    id: number;
    name: string;
    municipality: string;
    contactName: string;
    contactPhone: string;
    status: string;
  }>;
  contracts: Array<{
    id: number;
    contractNumber: string;
    schoolId: number;
    schoolName: string;
    municipality: string;
    contactName: string;
    contactPhone: string;
    payerModel: "school" | "parent" | "mixed";
    serviceModel?: "software" | "full_service";
    pinPolicy: string;
    busesAllocated: number;
    studentsCovered: number;
    monthlyValueAoa: number | null;
    shiftRegime: string;
    status: string;
  }>;
  contractRequests: Array<{
    id: number;
    referenceCode: string;
    schoolName: string;
    municipality: string;
    shiftRegime: string;
    busesRequested: number;
    studentsEstimate: number;
    estimatedMonthlyAoa: number;
    payerPreference: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
    status: string;
    createdAt: string;
  }>;
  vehicleOwners: Array<{
    id: number;
    fullName: string;
    ownerType: string;
    nif: string | null;
    phone: string;
    settlementModel: string;
    monthlySettlementAoa: number | null;
    verificationStatus: string;
  }>;
  vehicles: Array<{
    id: number;
    fleetNumber: number;
    plate: string;
    ownershipType?: string;
    ownerId: number | null;
    ownerName: string;
    assignedDriverId: number | null;
    assignedSchoolId: number | null;
    schoolName: string | null;
    driverName: string;
    routeCode: string;
    routeName?: string | null;
    capacity: number;
    dnvtStatus: string;
    dnvtExpiry: string;
    insuranceProvider: string;
    insuranceStatus: string;
    verificationStatus: string;
    status: string;
  }>;
  drivers: Array<{
    id: number;
    fullName: string;
    phone: string;
    licenceCategory: string;
    licenceNumber: string;
    licenceExpiry: string;
    employerType?: string;
    employerSchoolId?: number | null;
    employerSchoolName?: string | null;
    verificationStatus: string;
    ratingAvg: string;
    availabilityStatus: string;
    monthlyCompensationAoa: number | null;
    tripsCompleted: number;
    hasLogin?: boolean;
    loginUsername?: string | null;
    loginActive?: boolean | null;
  }>;
  students: Array<{
    id: number;
    fullName: string;
    schoolId: number;
    schoolName: string;
    routeCode: string;
    stopName: string;
    shift?: string;
    enrollmentStatus: string;
    currentJourneyState: string;
    pinPolicy: string;
    maskedPin: string;
    guardianName: string;
    guardianPhone: string;
  }>;
  trips: Array<{
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
    delayReason?: string | null;
  }>;
  incidents: Array<{
    id: number;
    tripId: number | null;
    tripCode?: string | null;
    schoolId: number | null;
    busNumber: number | null;
    routeCode: string | null;
    routeName?: string | null;
    category: string;
    severity: string;
    description: string;
    reporterName: string;
    reporterRole: string;
    driverName?: string | null;
    reason?: string | null;
    notes?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
    assignedToName: string | null;
    acknowledgedAt?: string | null;
    resolutionNotes: string | null;
    createdAt: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    schoolId?: number | null;
    studentName: string;
    guardianName: string;
    payerType: string;
    phone: string;
    amountAoa: number;
    paymentMethod: string;
    paymentEntity?: string | null;
    paymentReferencePin?: string | null;
    status: string;
    providerReference: string | null;
    fiscalStatus: string;
    createdAt: string;
    confirmedAt: string | null;
  }>;
  pricing: {
    id: number;
    studentMonthlyFeeAoa: number;
    driverMonthlyFeeAoa?: number;
    schoolBusSingleShiftAoa: number;
    schoolBusDoubleShiftAoa: number;
    ivaPercent: number;
    companyName: string;
    companyNif: string;
    companyAddress?: string;
    multicaixaEntityCode?: string;
    fiscalIntegrationStatus: string;
  } | null;
  transportChangeRequests: Array<{
    id: number;
    schoolId: number;
    schoolName: string;
    requestedByName: string;
    requestType: string;
    title: string;
    details: string;
    status: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorEmail: string | null;
    actorRole: string;
    action: string;
    targetEntity: string;
    targetId: string | null;
    summary: string;
    createdAt: string;
  }>;
  staffUsers: Array<{
    id: number;
    uid: string;
    username?: string | null;
    email: string;
    fullName: string;
    phone?: string | null;
    primaryRole: MoBussRole;
    schoolId: number | null;
    active: boolean;
  }>;
  routeSchedules: RecurringRouteScheduleItem[];
  routes?: RouteDto[];
  overviewSummary?: OverviewSummary;
}

const PAYER_LABELS: Record<string, string> = {
  school: "Escola Paga",
  parent: "Encarregados Pagam",
  mixed: "Misto (Escola + Pais)",
  configurable: "A Configurar",
};

interface AdminViewProps {
  onNavigate?: (view: "mockup" | "admin" | "deck" | "landing" | "client" | "driver" | "school") => void;
}

export function AdminView({ onNavigate }: AdminViewProps) {
  const { isAuthenticated, dbUser, capabilities, loading: authLoading, apiFetch, getAuthToken, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>("Painel");
  const [search, setSearch] = useState("");
  const [selectedSimRouteCode, setSelectedSimRouteCode] = useState<string>("ROTA-A");
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<"all" | number>("all");
  const [fleetStatusFilter, setFleetStatusFilter] = useState<"all" | "active" | "available" | "maintenance">("all");
  const [fleetTripFilter, setFleetTripFilter] = useState<"all" | "active" | "delayed" | "idle">("all");
  const [fleetRouteFilter, setFleetRouteFilter] = useState<string>("all");
  const [fleetOwnershipFilter, setFleetOwnershipFilter] = useState<"all" | "school_owned" | "mobuss_owned" | "partner_owned">("all");
  const [fleetAdminSchoolFilter, setFleetAdminSchoolFilter] = useState<"all" | number>("all");
  const [driverEmployerFilter, setDriverEmployerFilter] = useState<"all" | "school" | "mobuss">("all");
  const [driverSchoolFilter, setDriverSchoolFilter] = useState<"all" | number>("all");
  const [selectedFleetVehicleId, setSelectedFleetVehicleId] = useState<number | null>(null);
  const [showTechnicalAudit, setShowTechnicalAudit] = useState(false);
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportSchoolId, setReportSchoolId] = useState<"all" | number>("all");
  const [downloadingReportKey, setDownloadingReportKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.42);

  // Real DB state & Health Probe
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [health, setHealth] = useState<{ checked: boolean; dbConnected: boolean; latencyMs?: number }>({
    checked: false,
    dbConnected: false,
  });

  // Simulator cross-sync (hazards, sweeps, ratings) + pricing form draft
  const [syncState, setSyncState] = useState<MoBussSyncState>(() => readMoBussSync());
  const [pricingDraft, setPricingDraft] = useState<SyncedPricingConfig>(() => readMoBussSync().pricing);

  // Per-lead payer model selection for approval
  const [leadPayerSelection, setLeadPayerSelection] = useState<Record<number, "school" | "parent" | "mixed">>({});

  // New Contract Modal
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [newSchool, setNewSchool] = useState("");
  const [newLocation, setNewLocation] = useState("Talatona, Luanda");
  const [newPayerModel, setNewPayerModel] = useState<"school" | "parent" | "mixed">("school");
  const [newServiceModel, setNewServiceModel] = useState<"software" | "full_service">("software");
  const [newBuses, setNewBuses] = useState(2);
  const [newStudents, setNewStudents] = useState(50);
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("+244 923 000 000");
  const [newMonthlyAoa, setNewMonthlyAoa] = useState(216000);

  // New Partner Vehicle Owner Modal
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("+244 9");
  const [ownerNif, setOwnerNif] = useState("");
  const [ownerSettlementModel, setOwnerSettlementModel] = useState<"monthly_fixed" | "per_trip">("monthly_fixed");
  const [ownerMonthlyAoa, setOwnerMonthlyAoa] = useState(350000);

  // Invoice Reconcile Modal
  const [reconcileInvoiceId, setReconcileInvoiceId] = useState<number | null>(null);
  const [reconcileRef, setReconcileRef] = useState("");

  // Driver assignment selections per vehicle
  const [assignDriverSelection, setAssignDriverSelection] = useState<Record<number, number>>({});

  // Admin-only User Provisioning Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("+244 9");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<MoBussRole>("parent_guardian");
  const [newUserSchoolId, setNewUserSchoolId] = useState<number | "">("");
  const [newUserDriverEmployer, setNewUserDriverEmployer] = useState<"school" | "mobuss">("school");
  const [newUserStudentId, setNewUserStudentId] = useState<number | "">("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Admin Password Reset Modal
  const [passwordTargetUser, setPasswordTargetUser] = useState<{ id: number; label: string } | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin Edit & Delete User Account Modals
  const [editingUser, setEditingUser] = useState<{
    id: number;
    fullName: string;
    username: string;
    email: string;
    phone: string;
    primaryRole: MoBussRole;
    schoolId: number | "";
    active: boolean;
  } | null>(null);
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: number; label: string; email: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Admin Edit & Remove Student Modals
  const [editingStudent, setEditingStudent] = useState<{
    id: number;
    fullName: string;
    schoolId: number;
    routeCode: string;
    stopName: string;
    shift: "morning" | "afternoon" | "both";
    enrollmentStatus: "active" | "pending_approval" | "suspended";
    pinPolicy: "boarding" | "dropoff" | "both";
    guardianName: string;
    guardianPhone: string;
  } | null>(null);
  const [savingStudent, setSavingStudent] = useState(false);
  const [deleteStudentTarget, setDeleteStudentTarget] = useState<{ id: number; fullName: string; schoolName: string } | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Admin Create Student Modal
  const [newStudentModalOpen, setNewStudentModalOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    fullName: "",
    schoolId: "" as number | "",
    routeCode: "ROTA-A",
    stopName: "Largo do Kinaxixi",
    shift: "both" as "morning" | "afternoon" | "both",
    pinPolicy: "both" as "boarding" | "dropoff" | "both",
    guardianName: "",
    guardianPhone: "+244 9",
  });
  const [creatingStudent, setCreatingStudent] = useState(false);

  // Admin Create / Edit Vehicle Modal
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    fleetNumber: "",
    plate: "",
    ownershipType: "mobuss_owned" as "school_owned" | "mobuss_owned" | "partner_owned",
    ownerId: "" as number | "",
    assignedSchoolId: "" as number | "",
    routeCode: "ROTA-A",
    capacity: 22,
    dnvtExpiry: "2027-12-31",
    dnvtStatus: "valid" as "valid" | "expiring_soon" | "expired",
    insuranceProvider: "ENSA Seguros de Angola",
    insuranceStatus: "valid" as "valid" | "pending" | "expired",
    status: "available",
  });
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Admin Create / Edit Recurring Route Schedule Modal
  const [routeScheduleModalOpen, setRouteScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSchoolFilter, setScheduleSchoolFilter] = useState<"all" | number>("all");
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<RecurringRouteScheduleItem | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    schoolId: "" as number | "",
    vehicleId: "" as number | "",
    driverId: "" as number | "",
    routeCode: "ROTA-A",
    routeName: "Rota A · Morro Bento",
    days: ["mon", "tue", "wed", "thu", "fri"] as string[],
    shiftType: "morning" as "morning" | "afternoon",
    departureTime: "06:30",
    arrivalTime: "07:30",
    active: true,
    notes: "",
  });

  // Admin DB Routes & Stops Editor State (operations_manager / fleet_manager / super admin)
  const [rotasSubView, setRotasSubView] = useState<"routes" | "schedules">("routes");
  const [selectedAdminRouteId, setSelectedAdminRouteId] = useState<number | null>(null);
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeFormError, setRouteFormError] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({
    code: "",
    name: "",
    corridor: "",
    schoolId: "" as number | "",
    active: true,
    pathText: "",
  });
  const [mapClickMode, setMapClickMode] = useState<"pick_stop" | "append_path">("pick_stop");
  const [savingStop, setSavingStop] = useState(false);
  const [stopFormError, setStopFormError] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState({
    id: null as number | null,
    name: "",
    latitude: "",
    longitude: "",
    scheduledTime: "07:00",
    geofenceRadiusM: 500,
    appendToPath: true,
  });

  // Admin Edit Driver Modal
  const [editingDriver, setEditingDriver] = useState<{
    id: number;
    fullName: string;
    phone: string;
    licenceCategory: string;
    licenceNumber: string;
    licenceExpiry: string;
    employerType: "school" | "mobuss";
    employerSchoolId: number | "";
    verificationStatus: "verified" | "suspended" | "pending";
    availabilityStatus: "in_service" | "available" | "off_duty";
    monthlyCompensationAoa: number;
  } | null>(null);
  const [savingDriver, setSavingDriver] = useState(false);

  const [simStatus, setSimStatus] = useState<{
    running: boolean;
    routeCode: string;
    progress: number;
    nearestStopName: string;
  } | null>(null);
  const [simConnectedClients, setSimConnectedClients] = useState(0);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setSyncState(readMoBussSync());
    return subscribeMoBussSync((next) => setSyncState(next));
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/health");
      const data = await res.json();
      setHealth({ checked: true, dbConnected: Boolean(data.dbConnected), latencyMs: data.latencyMs });
    } catch {
      setHealth({ checked: true, dbConnected: false });
    }
  }, []);

  const loadOverview = useCallback(async () => {
    if (!isAuthenticated || !capabilities.canAccessAdmin) return;
    setLoadingOverview(true);
    try {
      const data = await apiFetch<AdminOverviewData>("/api/v1/admin/overview");
      setOverview(data);
      if (data.pricing) {
        const syncedPricing: SyncedPricingConfig = {
          studentMonthlyFee: data.pricing.studentMonthlyFeeAoa,
          driverMonthlyFee: data.pricing.driverMonthlyFeeAoa ?? DEFAULT_PRICING.driverMonthlyFee,
          schoolBusSingleShift: data.pricing.schoolBusSingleShiftAoa,
          schoolBusDoubleShift: data.pricing.schoolBusDoubleShiftAoa,
          ivaPercent: data.pricing.ivaPercent,
          companyName: data.pricing.companyName,
          companyNif: data.pricing.companyNif,
          companyAddress: data.pricing.companyAddress ?? DEFAULT_PRICING.companyAddress,
          multicaixaEntityCode: data.pricing.multicaixaEntityCode || "00845",
        };
        setPricingDraft(syncedPricing);
        updatePricingConfig(syncedPricing);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao sincronizar painel com PostgreSQL.");
    } finally {
      setLoadingOverview(false);
    }
  }, [isAuthenticated, capabilities.canAccessAdmin, apiFetch]);

  const { connected: wsConnected } = useTelemetrySocket((event) => {
    if (event.type === "trip:location") {
      const routeCode = String(event.payload.routeCode ?? "");
      if (routeCode.toUpperCase() === selectedSimRouteCode.toUpperCase()) {
        setProgress(Number(event.payload.progress ?? 0));
      }
      return;
    }
    if (event.type === "simulation:status") {
      setSimStatus({
        running: Boolean(event.payload.running),
        routeCode: String(event.payload.routeCode ?? "ROTA-A"),
        progress: Number(event.payload.progress ?? 0),
        nearestStopName: String(event.payload.nearestStopName ?? "—"),
      });
      return;
    }
    if (
      event.type === "trip:state" ||
      event.type === "attendance:updated" ||
      event.type === "pin:validated" ||
      event.type === "incident:created" ||
      event.type === "incident:updated"
    ) {
      void loadOverview();
    }
  });

  useEffect(() => {
    void checkHealth();
    void loadOverview();
    if (isAuthenticated && capabilities.canAccessAdmin) {
      void apiFetch<{ simulation: { running: boolean; routeCode: string; progress: number; nearestStopName: string }; connectedClients: number }>("/api/v1/simulation/status")
        .then((res) => {
          setSimStatus(res.simulation);
          setSimConnectedClients(res.connectedClients);
        })
        .catch(() => null);
    }
  }, [checkHealth, loadOverview, isAuthenticated, capabilities.canAccessAdmin, apiFetch]);

  async function handleSimulationAction(action: "start" | "pause" | "step" | "reset") {
    const activeRoute =
      (overview?.routes ?? []).find((r) => r.code.toUpperCase() === selectedSimRouteCode.toUpperCase()) ??
      (overview?.routes ?? [])[0];
    const targetCode = activeRoute?.code ?? (selectedSimRouteCode || "ROTA-A");
    try {
      const res = await apiFetch<{ simulation: { running: boolean; routeCode: string; progress: number; nearestStopName: string }; connectedClients: number }>(
        `/api/v1/simulation/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ routeCode: targetCode }),
        }
      );
      setSimStatus(res.simulation);
      setSimConnectedClients(res.connectedClients);
      setProgress(res.simulation.progress);
      showToast(
        action === "start"
          ? `Simulação PostgreSQL + WebSocket iniciada na ${targetCode}.`
          : action === "pause"
          ? "Simulação em pausa."
          : action === "step"
          ? `Autocarro avançou para ${res.simulation.nearestStopName}.`
          : `Simulação reiniciada na ${targetCode}.`
      );
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao controlar simulação.");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink grid place-items-center text-xs text-slide-dim">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/mobus-logo-1024.png"
            alt="MôBus"
            className="w-16 h-16 rounded-2xl object-contain bg-black p-1.5 border border-white/15 shadow-lg"
          />
          <span>A verificar sessão administrativa MôBus...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGatePanel
        title="MôBus Admin · Central de Operações"
        subtitle="Acesso exclusivo à equipa operacional, financeira e de segurança da MôBus. Inicie sessão para gerir contratos, frota, proprietários parceiros e auditoria."
        badgeText="PostgreSQL + RBAC · Central Luanda"
      />
    );
  }

  if (!capabilities.canAccessAdmin) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink grid place-items-center p-6">
        <div className="max-w-md rounded-2xl bg-slide-paper-ink border border-white/10 p-6 text-center space-y-3">
          <Lock className="w-8 h-8 text-slide-accent mx-auto" />
          <h2 className="text-lg font-black">Acesso Administrativo Restrito</h2>
          <p className="text-xs text-slide-dim leading-relaxed">
            O seu perfil atual (<strong>{dbUser ? ROLE_LABELS[dbUser.primaryRole] : "Utilizador"}</strong>) não possui permissões da equipa central MôBus.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Terminar Sessão (Sair)</span>
          </button>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const contractsList = (overview?.contracts ?? []).filter(
    (c) =>
      c.schoolName.toLowerCase().includes(q) ||
      c.contractNumber.toLowerCase().includes(q) ||
      c.municipality.toLowerCase().includes(q)
  );
  const requestsList = (overview?.contractRequests ?? []).filter(
    (r) =>
      r.schoolName.toLowerCase().includes(q) ||
      r.referenceCode.toLowerCase().includes(q) ||
      r.municipality.toLowerCase().includes(q)
  );
  const vehiclesList = (overview?.vehicles ?? []).filter((v) => {
    const matchesSearch =
      !q ||
      v.plate.toLowerCase().includes(q) ||
      v.driverName.toLowerCase().includes(q) ||
      v.ownerName.toLowerCase().includes(q) ||
      v.routeCode.toLowerCase().includes(q) ||
      (v.schoolName ?? "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (fleetOwnershipFilter !== "all" && (v.ownershipType || "mobuss_owned") !== fleetOwnershipFilter) return false;
    if (fleetAdminSchoolFilter !== "all" && v.assignedSchoolId !== fleetAdminSchoolFilter) return false;
    return true;
  });
  const driversList = (overview?.drivers ?? []).filter((d) => {
    const matchesSearch =
      !q ||
      d.fullName.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      (d.employerSchoolName ?? "").toLowerCase().includes(q) ||
      (d.loginUsername ?? "").toLowerCase().includes(q);
    if (!matchesSearch) return false;
    const emp = d.employerType === "mobuss" ? "mobuss" : "school";
    if (driverEmployerFilter !== "all" && emp !== driverEmployerFilter) return false;
    if (driverSchoolFilter !== "all" && d.employerSchoolId !== driverSchoolFilter) return false;
    return true;
  });
  const studentsList = (overview?.students ?? []).filter(
    (s) =>
      s.fullName.toLowerCase().includes(q) ||
      s.schoolName.toLowerCase().includes(q) ||
      s.stopName.toLowerCase().includes(q) ||
      s.guardianName.toLowerCase().includes(q)
  );
  const invoicesList = (overview?.invoices ?? []).filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.studentName.toLowerCase().includes(q) ||
      inv.guardianName.toLowerCase().includes(q)
  );

  const activeHazards = syncState.hazards.filter((h) => h.active);
  const rolePerms = getAdminRolePermissions(dbUser?.primaryRole);

  // Contracted / Active Schools Selector Options (real records only)
  const activeContractSchoolIds = new Set(
    (overview?.contracts ?? []).filter((c) => c.status === "active").map((c) => c.schoolId)
  );
  const selectableSchools = (overview?.schools ?? []).filter(
    (s) => s.status === "active" || activeContractSchoolIds.has(s.id)
  );
  const selectedSchoolObj =
    selectedSchoolFilter === "all"
      ? null
      : selectableSchools.find((s) => s.id === selectedSchoolFilter) ??
        (overview?.schools ?? []).find((s) => s.id === selectedSchoolFilter) ??
        null;

  const allRoutes = overview?.routes ?? [];
  const selectedAdminRoute =
    allRoutes.find((r) => r.id === selectedAdminRouteId) ?? allRoutes[0] ?? null;
  const allSchedules = overview?.routeSchedules ?? [];
  const allLiveFleetVehicles = buildLiveFleetVehicles({
    schools: overview?.schools ?? [],
    vehicles: overview?.vehicles ?? [],
    drivers: overview?.drivers ?? [],
    students: overview?.students ?? [],
    trips: overview?.trips ?? [],
    routeSchedules: allSchedules,
    routes: allRoutes,
  });

  // School-scoped records (All Schools vs Individual School)
  const scopedVehicles =
    selectedSchoolFilter === "all"
      ? allLiveFleetVehicles
      : allLiveFleetVehicles.filter((v) => v.associatedSchoolIds.includes(selectedSchoolFilter));
  const scopedVehicleIds = new Set(scopedVehicles.map((v) => v.id));
  const scopedVehicleRouteCodes = new Set(scopedVehicles.map((v) => v.routeCode).filter((c) => c && c !== "—"));
  const scopedVehicleFleetNumbers = new Set(scopedVehicles.map((v) => v.fleetNumber));

  const scopedSchedules =
    selectedSchoolFilter === "all"
      ? allSchedules
      : allSchedules.filter((s) => s.schoolId === selectedSchoolFilter);

  const scopedTrips =
    selectedSchoolFilter === "all"
      ? overview?.trips ?? []
      : (overview?.trips ?? []).filter(
          (t) => t.schoolId === selectedSchoolFilter || (t.vehicleId != null && scopedVehicleIds.has(t.vehicleId))
        );

  const scopedStudents =
    selectedSchoolFilter === "all"
      ? overview?.students ?? []
      : (overview?.students ?? []).filter((s) => s.schoolId === selectedSchoolFilter);

  const scopedContracts =
    selectedSchoolFilter === "all"
      ? overview?.contracts ?? []
      : (overview?.contracts ?? []).filter((c) => c.schoolId === selectedSchoolFilter);

  const scopedIncidents =
    selectedSchoolFilter === "all"
      ? overview?.incidents ?? []
      : (overview?.incidents ?? []).filter(
          (inc) =>
            inc.schoolId === selectedSchoolFilter ||
            (inc.busNumber != null && scopedVehicleFleetNumbers.has(inc.busNumber)) ||
            (inc.routeCode != null && scopedVehicleRouteCodes.has(inc.routeCode))
        );

  const scopedHazards =
    selectedSchoolFilter === "all"
      ? activeHazards
      : activeHazards.filter(
          (h) => scopedVehicleFleetNumbers.has(h.busNumber) || scopedVehicleRouteCodes.has(h.routeCode)
        );

  const openIncidentsCount = (overview?.incidents ?? []).filter(
    (i) => i.status !== "resolved" && i.status !== "closed"
  ).length;
  const scopedOpenIncidentsCount = scopedIncidents.filter(
    (i) => i.status !== "resolved" && i.status !== "closed"
  ).length;
  const pendingLeadsCount = (overview?.contractRequests ?? []).filter(
    (r) => r.status === "request_received" || r.status === "under_review"
  ).length;
  const activeContractsCount = scopedContracts.filter((c) => c.status === "active").length;
  const busesOnRoadCount = scopedVehicles.filter(
    (v) => v.status === "assigned" || v.status === "on_trip"
  ).length;

  const scopedDriversMap = new Map((overview?.drivers ?? []).map((d) => [d.id, d]));
  const scopedDriverList =
    selectedSchoolFilter === "all"
      ? overview?.drivers ?? []
      : (overview?.vehicles ?? [])
          .filter((v) => scopedVehicleIds.has(v.id) && v.assignedDriverId != null)
          .map((v) => scopedDriversMap.get(v.assignedDriverId!))
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .filter((d, idx, arr) => arr.findIndex((x) => x.id === d.id) === idx);

  const liveOps = deriveLiveOperationsSummary({
    trips: scopedTrips,
    vehicles: scopedVehicles.map((v) => ({ id: v.id, status: v.status })),
    drivers: scopedDriverList,
    students: scopedStudents,
    openIncidentsCount: scopedOpenIncidentsCount,
    activeHazardsCount: 0,
  });

  const dbReachableSignal = health.checked ? health.dbConnected : (overview?.overviewSummary?.serviceStatus.dbReachable ?? true);
  const dbLatencySignal = health.latencyMs ?? overview?.overviewSummary?.serviceStatus.dbLatencyMs ?? null;
  const scopedRawVehicles =
    selectedSchoolFilter === "all"
      ? overview?.vehicles ?? []
      : (overview?.vehicles ?? []).filter((v) => scopedVehicleIds.has(v.id));
  const scopedInvoices =
    selectedSchoolFilter === "all"
      ? overview?.invoices ?? []
      : (overview?.invoices ?? []).filter((inv) => inv.schoolId === selectedSchoolFilter);

  const scopedSummary: OverviewSummary =
    selectedSchoolFilter === "all" && overview?.overviewSummary
      ? {
          ...overview.overviewSummary,
          serviceStatus: dbReachableSignal
            ? overview.overviewSummary.serviceStatus
            : {
                ...overview.overviewSummary.serviceStatus,
                state: "outage",
                label: "Indisponível",
                tone: "danger",
                reason: "Base de dados PostgreSQL inacessível",
                dbReachable: false,
                dbLatencyMs: dbLatencySignal,
              },
        }
      : computeOverviewSummary({
          scope: selectedSchoolFilter === "all" ? "global" : "school",
          schoolId: selectedSchoolFilter === "all" ? null : selectedSchoolFilter,
          visibility: rolePerms,
          dbReachable: dbReachableSignal,
          dbLatencyMs: dbLatencySignal,
          contracts: scopedContracts,
          pendingContractRequestsCount: selectedSchoolFilter === "all" ? pendingLeadsCount : 0,
          students: scopedStudents,
          vehicles: scopedRawVehicles,
          drivers: scopedDriverList,
          trips: scopedTrips,
          incidents: scopedIncidents,
          invoices: rolePerms.canViewFinance ? scopedInvoices : [],
        });

  const serviceStatus = scopedSummary.serviceStatus;

  const availableRouteFilterOptions = Array.from(
    new Set(
      [
        ...scopedVehicles.map((v) => v.routeCode),
        ...scopedTrips.map((t) => t.routeCode),
        ...scopedSchedules.filter((s) => s.active).map((s) => s.routeCode),
      ].filter((code) => Boolean(code) && code !== "—" && code !== "RESERVA")
    )
  ).sort();

  const filteredLiveFleet = scopedVehicles.filter((v) => {
    const matchesSearch =
      !q ||
      v.plate.toLowerCase().includes(q) ||
      v.driverName.toLowerCase().includes(q) ||
      v.routeCode.toLowerCase().includes(q) ||
      v.primarySchoolName.toLowerCase().includes(q) ||
      String(v.fleetNumber).includes(q);
    if (!matchesSearch) return false;
    if (fleetStatusFilter === "active" && v.status !== "on_trip" && !(v.activeTrip && v.hasLiveGps)) return false;
    if (fleetStatusFilter === "available" && v.status !== "available" && v.status !== "assigned") return false;
    if (
      fleetStatusFilter === "maintenance" &&
      v.status !== "maintenance" &&
      v.status !== "out_of_service" &&
      v.status !== "suspended"
    ) {
      return false;
    }
    if (fleetTripFilter !== "all" && v.tripFilterCategory !== fleetTripFilter) return false;
    if (fleetRouteFilter !== "all" && v.routeCode !== fleetRouteFilter) return false;
    return true;
  });

  const fleetMapMarkers: LuandaFleetMarker[] = filteredLiveFleet
    .filter((v): v is typeof v & { lat: number; lng: number } => v.hasCoordinates && v.lat != null && v.lng != null)
    .map((v) => ({
      id: v.id,
      fleetNumber: v.fleetNumber,
      plate: v.plate,
      routeCode: v.routeCode,
      driverName: v.driverName,
      schoolName: v.primarySchoolName,
      statusLabel: translateVehicleStatus(v.status),
      lat: v.lat,
      lng: v.lng,
      isLiveGps: v.hasLiveGps,
      gpsStatus: v.gpsStatus,
    }));

  // Derive relevant real routes on the monitoring map without ever inventing routes for idle schools
  const knownRouteCodes = new Set(allRoutes.map((r) => r.code.trim().toUpperCase()));
  const activeRouteCodesOnMap = Array.from(
    new Set(
      [
        ...scopedTrips
          .filter((t) => ACTIVE_TRIP_STATES.has(t.state) || t.state === "delayed" || t.state === "incident" || t.lastLat != null)
          .map((t) => t.routeCode),
        ...filteredLiveFleet
          .filter((v) => v.hasCoordinates || v.status === "on_trip" || v.status === "assigned")
          .map((v) => v.routeCode),
        ...scopedSchedules.filter((s) => s.active).map((s) => s.routeCode),
      ]
        .map((code) => code.trim().toUpperCase())
        .filter((code) => Boolean(code) && knownRouteCodes.has(code))
        .filter((code) => fleetRouteFilter === "all" || code === fleetRouteFilter.trim().toUpperCase())
    )
  );

  const inspectedVehicle =
    filteredLiveFleet.find((v) => v.id === selectedFleetVehicleId) ??
    scopedVehicles.find((v) => v.id === selectedFleetVehicleId) ??
    filteredLiveFleet[0] ??
    null;

  const formattedAuditLogs = (overview?.auditLogs ?? [])
    .map(formatAuditActivity)
    .filter(
      (item) =>
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.actorDisplay.toLowerCase().includes(q) ||
        item.rawAction.toLowerCase().includes(q)
    );

  const schedulesTabList = allSchedules.filter((sch) => {
    if (scheduleSchoolFilter !== "all" && sch.schoolId !== scheduleSchoolFilter) return false;
    if (!q) return true;
    return (
      sch.schoolName.toLowerCase().includes(q) ||
      sch.routeCode.toLowerCase().includes(q) ||
      sch.routeName.toLowerCase().includes(q) ||
      sch.driverName.toLowerCase().includes(q) ||
      (sch.vehiclePlate ?? "").toLowerCase().includes(q)
    );
  });

  async function handleSavePricing() {
    try {
      await apiFetch("/api/v1/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({
          studentMonthlyFeeAoa: pricingDraft.studentMonthlyFee,
          driverMonthlyFeeAoa: pricingDraft.driverMonthlyFee,
          schoolBusSingleShiftAoa: pricingDraft.driverMonthlyFee,
          schoolBusDoubleShiftAoa: pricingDraft.driverMonthlyFee,
          ivaPercent: pricingDraft.ivaPercent,
          companyName: pricingDraft.companyName,
          companyNif: pricingDraft.companyNif,
          companyAddress: pricingDraft.companyAddress ?? DEFAULT_PRICING.companyAddress,
          multicaixaEntityCode: pricingDraft.multicaixaEntityCode || "00845",
        }),
      });
      updatePricingConfig(pricingDraft);
      showToast(
        `Tarifário guardado em PostgreSQL: ${formatAOA(pricingDraft.studentMonthlyFee)}/aluno · ${formatAOA(pricingDraft.driverMonthlyFee)}/motorista.`
      );
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sem permissão para editar tarifário.");
    }
  }

  async function handleReviewLead(requestId: number, action: "approve" | "reject") {
    try {
      const payerModel = leadPayerSelection[requestId] || "school";
      await apiFetch(`/api/v1/admin/contract-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, payerModel }),
      });
      showToast(
        action === "approve"
          ? `Pedido aprovado e convertido em contrato (${PAYER_LABELS[payerModel]}).`
          : "Pedido marcado como recusado."
      );
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao processar pedido.");
    }
  }

  async function handleReviewTransportRequest(reqId: number, status: "approved" | "rejected") {
    try {
      await apiFetch(`/api/v1/admin/transport-requests/${reqId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(`Pedido escolar marcado como ${status === "approved" ? "aprovado" : "recusado"}.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar pedido escolar.");
    }
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!newSchool.trim()) return;
    try {
      await apiFetch("/api/v1/admin/contracts", {
        method: "POST",
        body: JSON.stringify({
          schoolName: newSchool.trim(),
          municipality: newLocation.trim(),
          payerModel: newPayerModel,
          serviceModel: newServiceModel,
          busesAllocated: newBuses,
          driversAllocated: newBuses,
          studentsCovered: newStudents,
          monthlyValueAoa: newMonthlyAoa,
          contactName: newContact.trim() || "Direcção Escolar",
          contactPhone: newPhone.trim(),
        }),
      });
      setContractModalOpen(false);
      setNewSchool("");
      setNewServiceModel("software");
      showToast("Contrato registado em PostgreSQL com política de PIN duplo.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao registar contrato.");
    }
  }

  async function handleCreateVehicleOwner(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/api/v1/admin/vehicle-owners", {
        method: "POST",
        body: JSON.stringify({
          fullName: ownerName,
          phone: ownerPhone,
          nif: ownerNif || null,
          settlementModel: ownerSettlementModel,
          monthlySettlementAoa: ownerMonthlyAoa,
        }),
      });
      setOwnerModalOpen(false);
      setOwnerName("");
      setOwnerNif("");
      showToast("Proprietário parceiro independente registado.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao criar proprietário.");
    }
  }

  async function handleAssignDriver(vehicleId: number, fallbackDriverId: number) {
    const driverId = assignDriverSelection[vehicleId] || fallbackDriverId;
    if (!driverId) {
      showToast("Selecione um motorista verificado.");
      return;
    }
    try {
      await apiFetch(`/api/v1/admin/vehicles/${vehicleId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ driverId }),
      });
      showToast("Motorista verificado alocado à viatura.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Falha na alocação.");
    }
  }

  async function handleResetStudentPin(studentId: number, studentName: string) {
    try {
      await apiFetch(`/api/v1/admin/students/${studentId}/reset-pin`, { method: "POST" });
      showToast(`PIN de ${studentName} revogado e regenerado com hash seguro.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sem permissão para regenerar PIN.");
    }
  }

  async function handleIncidentStatus(incidentId: number, status: "acknowledged" | "in_progress" | "resolved") {
    try {
      await apiFetch(`/api/v1/admin/incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast(`Ocorrência #${incidentId} atualizada para "${status}".`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar ocorrência.");
    }
  }

  async function handleReconcileInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!reconcileInvoiceId || !reconcileRef.trim()) return;
    try {
      await apiFetch(`/api/v1/admin/invoices/${reconcileInvoiceId}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ providerReference: reconcileRef.trim() }),
      });
      setReconcileInvoiceId(null);
      setReconcileRef("");
      showToast("Fatura conciliada manualmente com referência bancária.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao conciliar fatura.");
    }
  }

  async function handleUpdateUserRole(targetUserId: number, primaryRole: MoBussRole, schoolId?: number | null) {
    try {
      await apiFetch(`/api/v1/admin/system/users/${targetUserId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ primaryRole, schoolId }),
      });
      showToast("Perfil RBAC atualizado no servidor.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Apenas Super Admin pode alterar perfis.");
    }
  }

  async function handleToggleUserStatus(targetUserId: number, nextActive: boolean) {
    try {
      await apiFetch(`/api/v1/admin/system/users/${targetUserId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive }),
      });
      showToast(nextActive ? "Conta reativada com sucesso." : "Conta desativada no servidor.");
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Apenas Super Admin pode alterar estado da conta.");
    }
  }

  async function handleResetUserPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordTargetUser || resetPasswordInput.length < 6) return;
    setSavingPassword(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/system/users/${passwordTargetUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPasswordInput }),
      });
      setPasswordTargetUser(null);
      setResetPasswordInput("");
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar palavra-passe.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCreateUserAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserFullName.trim() || !newUserEmail.trim()) return;
    setCreatingUser(true);
    try {
      const res = await apiFetch<{ message: string }>("/api/v1/admin/system/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: newUserFullName.trim(),
          email: newUserEmail.trim().toLowerCase(),
          phone: newUserPhone.trim() || null,
          password: newUserPassword.trim() || undefined,
          primaryRole: newUserRole,
          schoolId:
            (newUserRole === "school_admin" || (newUserRole === "driver" && newUserDriverEmployer === "school")) &&
            newUserSchoolId
              ? Number(newUserSchoolId)
              : null,
          employerType: newUserRole === "driver" ? newUserDriverEmployer : undefined,
          studentId: newUserRole === "parent_guardian" && newUserStudentId ? Number(newUserStudentId) : null,
        }),
      });
      setUserModalOpen(false);
      setNewUserFullName("");
      setNewUserEmail("");
      setNewUserPhone("+244 9");
      setNewUserPassword("");
      setNewUserRole("parent_guardian");
      setNewUserSchoolId("");
      setNewUserDriverEmployer("school");
      setNewUserStudentId("");
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao criar conta.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSaveUserEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUserEdit(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/system/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editingUser.fullName.trim(),
          username: editingUser.username.trim() || null,
          email: editingUser.email.trim().toLowerCase(),
          phone: editingUser.phone.trim() || null,
          primaryRole: editingUser.primaryRole,
          schoolId: editingUser.primaryRole === "school_admin" && editingUser.schoolId ? Number(editingUser.schoolId) : null,
          active: editingUser.active,
        }),
      });
      setEditingUser(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar conta.");
    } finally {
      setSavingUserEdit(false);
    }
  }

  async function handleConfirmDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/system/users/${deleteUserTarget.id}`, {
        method: "DELETE",
      });
      setDeleteUserTarget(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao eliminar conta.");
    } finally {
      setDeletingUser(false);
    }
  }

  async function handleSaveStudentEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    setSavingStudent(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/students/${editingStudent.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editingStudent.fullName.trim(),
          schoolId: editingStudent.schoolId,
          routeCode: editingStudent.routeCode.trim(),
          stopName: editingStudent.stopName.trim(),
          shift: editingStudent.shift,
          enrollmentStatus: editingStudent.enrollmentStatus,
          pinPolicy: editingStudent.pinPolicy,
          guardianName: editingStudent.guardianName.trim(),
          guardianPhone: editingStudent.guardianPhone.trim(),
        }),
      });
      setEditingStudent(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar dados do aluno.");
    } finally {
      setSavingStudent(false);
    }
  }

  async function handleConfirmDeleteStudent() {
    if (!deleteStudentTarget) return;
    setDeletingStudent(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/students/${deleteStudentTarget.id}`, {
        method: "DELETE",
      });
      setDeleteStudentTarget(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao remover aluno.");
    } finally {
      setDeletingStudent(false);
    }
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    const resolvedSchoolId = Number(newStudentForm.schoolId || overview?.schools[0]?.id || 0);
    if (!resolvedSchoolId || !newStudentForm.fullName.trim()) {
      showToast("Indique o nome do educando e selecione uma escola.");
      return;
    }
    setCreatingStudent(true);
    try {
      const res = await apiFetch<{ message: string }>("/api/v1/admin/students", {
        method: "POST",
        body: JSON.stringify({
          fullName: newStudentForm.fullName.trim(),
          schoolId: resolvedSchoolId,
          routeCode: newStudentForm.routeCode.trim(),
          stopName: newStudentForm.stopName.trim(),
          shift: newStudentForm.shift,
          pinPolicy: newStudentForm.pinPolicy,
          guardianName: newStudentForm.guardianName.trim(),
          guardianPhone: newStudentForm.guardianPhone.trim(),
        }),
      });
      setNewStudentModalOpen(false);
      setNewStudentForm({
        fullName: "",
        schoolId: "",
        routeCode: "ROTA-A",
        stopName: "Largo do Kinaxixi",
        shift: "both",
        pinPolicy: "both",
        guardianName: "",
        guardianPhone: "+244 9",
      });
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao registar educando.");
    } finally {
      setCreatingStudent(false);
    }
  }

  async function handleSaveVehicle(e: React.FormEvent) {
    e.preventDefault();
    const isSchoolOwned = vehicleForm.ownershipType === "school_owned";
    const assignedSchoolId = vehicleForm.assignedSchoolId ? Number(vehicleForm.assignedSchoolId) : null;
    const resolvedOwnerId = isSchoolOwned
      ? null
      : Number(vehicleForm.ownerId || overview?.vehicleOwners[0]?.id || 0);
    if (isSchoolOwned && !assignedSchoolId) {
      showToast("Selecione a escola proprietária da viatura.");
      return;
    }
    if (!isSchoolOwned && !resolvedOwnerId) {
      showToast("Selecione um proprietário da viatura.");
      return;
    }
    setSavingVehicle(true);
    try {
      if (editingVehicleId) {
        const res = await apiFetch<{ message: string }>(`/api/v1/admin/vehicles/${editingVehicleId}`, {
          method: "PATCH",
          body: JSON.stringify({
            plate: vehicleForm.plate.trim().toUpperCase(),
            ownershipType: vehicleForm.ownershipType,
            ownerId: resolvedOwnerId,
            assignedSchoolId,
            routeCode: vehicleForm.routeCode.trim(),
            capacity: Number(vehicleForm.capacity) || 22,
            dnvtExpiry: vehicleForm.dnvtExpiry,
            dnvtStatus: vehicleForm.dnvtStatus,
            insuranceProvider: vehicleForm.insuranceProvider.trim(),
            insuranceStatus: vehicleForm.insuranceStatus,
            status: vehicleForm.status,
          }),
        });
        showToast(res.message);
      } else {
        const res = await apiFetch<{ message: string }>("/api/v1/admin/vehicles", {
          method: "POST",
          body: JSON.stringify({
            fleetNumber: Number(vehicleForm.fleetNumber),
            plate: vehicleForm.plate.trim().toUpperCase(),
            ownershipType: vehicleForm.ownershipType,
            ownerId: resolvedOwnerId,
            assignedSchoolId,
            routeCode: vehicleForm.routeCode.trim(),
            capacity: Number(vehicleForm.capacity) || 22,
            dnvtExpiry: vehicleForm.dnvtExpiry,
            dnvtStatus: vehicleForm.dnvtStatus,
            insuranceProvider: vehicleForm.insuranceProvider.trim(),
            insuranceStatus: vehicleForm.insuranceStatus,
          }),
        });
        showToast(res.message);
      }
      setVehicleModalOpen(false);
      setEditingVehicleId(null);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao guardar viatura.");
    } finally {
      setSavingVehicle(false);
    }
  }

  function openNewRouteScheduleModal(preselectedSchoolId?: number) {
    const defaultSchoolId =
      preselectedSchoolId ??
      (selectedSchoolFilter !== "all" ? selectedSchoolFilter : selectableSchools[0]?.id ?? overview?.schools[0]?.id ?? "");
    setEditingScheduleId(null);
    setScheduleError(null);
    setScheduleForm({
      schoolId: defaultSchoolId,
      vehicleId: "",
      driverId: "",
      routeCode: allRoutes[0]?.code ?? "ROTA-A",
      routeName: allRoutes[0]?.name ?? "Rota A · Morro Bento",
      days: ["mon", "tue", "wed", "thu", "fri"],
      shiftType: "morning",
      departureTime: "06:30",
      arrivalTime: "07:30",
      active: true,
      notes: "",
    });
    setRouteScheduleModalOpen(true);
  }

  function openEditRouteScheduleModal(sch: RecurringRouteScheduleItem) {
    setEditingScheduleId(sch.id);
    setScheduleError(null);
    setScheduleForm({
      schoolId: sch.schoolId,
      vehicleId: sch.vehicleId ?? "",
      driverId: sch.driverId ?? "",
      routeCode: sch.routeCode,
      routeName: sch.routeName,
      days: sch.daysOfWeek
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      shiftType: sch.shiftType === "afternoon" ? "afternoon" : "morning",
      departureTime: sch.departureTime,
      arrivalTime: sch.arrivalTime,
      active: sch.active,
      notes: sch.notes ?? "",
    });
    setRouteScheduleModalOpen(true);
  }

  async function handleSaveRouteSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleError(null);
    const resolvedSchoolId = Number(scheduleForm.schoolId);
    if (!resolvedSchoolId) {
      setScheduleError("Selecione uma escola contratada.");
      return;
    }
    if (scheduleForm.days.length === 0) {
      setScheduleError("Selecione pelo menos um dia da semana.");
      return;
    }
    setSavingSchedule(true);
    try {
      const payload = {
        schoolId: resolvedSchoolId,
        vehicleId: scheduleForm.vehicleId ? Number(scheduleForm.vehicleId) : null,
        driverId: scheduleForm.driverId ? Number(scheduleForm.driverId) : null,
        routeCode: scheduleForm.routeCode.trim().toUpperCase(),
        routeName: scheduleForm.routeName.trim() || scheduleForm.routeCode.trim().toUpperCase(),
        daysOfWeek: scheduleForm.days,
        shiftType: scheduleForm.shiftType,
        departureTime: scheduleForm.departureTime,
        arrivalTime: scheduleForm.arrivalTime,
        active: scheduleForm.active,
        notes: scheduleForm.notes.trim() || null,
      };
      const res = editingScheduleId
        ? await apiFetch<{ message: string }>(`/api/v1/admin/route-schedules/${editingScheduleId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ message: string }>("/api/v1/admin/route-schedules", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setRouteScheduleModalOpen(false);
      setEditingScheduleId(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao guardar escala de rota.";
      setScheduleError(msg);
      showToast(msg);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleToggleRouteSchedule(sch: RecurringRouteScheduleItem) {
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/route-schedules/${sch.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !sch.active }),
      });
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar estado da escala.");
    }
  }

  async function handleConfirmDeleteSchedule() {
    if (!deleteScheduleTarget) return;
    setDeletingSchedule(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/route-schedules/${deleteScheduleTarget.id}`, {
        method: "DELETE",
      });
      setDeleteScheduleTarget(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao remover escala de rota.");
    } finally {
      setDeletingSchedule(false);
    }
  }

  function parsePathTextToCoords(raw: string): [number, number][] {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(Number(pt[0])) && Number.isFinite(Number(pt[1])))
          .map((pt) => [Number(Number(pt[0]).toFixed(6)), Number(Number(pt[1]).toFixed(6))]);
      }
    }
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\s]+/).map(Number);
        return parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])
          ? ([Number(parts[0]!.toFixed(6)), Number(parts[1]!.toFixed(6))] as [number, number])
          : null;
      })
      .filter((pt): pt is [number, number] => pt !== null);
  }

  function openNewRouteModal() {
    setEditingRouteId(null);
    setRouteFormError(null);
    setRouteForm({
      code: "",
      name: "",
      corridor: "",
      schoolId: selectedSchoolFilter !== "all" ? selectedSchoolFilter : "",
      active: true,
      pathText: "",
    });
    setRouteModalOpen(true);
  }

  function openEditRouteModal(route: RouteDto) {
    setEditingRouteId(route.id);
    setRouteFormError(null);
    setRouteForm({
      code: route.code,
      name: route.name,
      corridor: route.corridor ?? "",
      schoolId: route.schoolId ?? "",
      active: route.active,
      pathText: route.pathCoordinates.map(([lat, lng]) => `${lat}, ${lng}`).join("\n"),
    });
    setRouteModalOpen(true);
  }

  async function handleSaveRoute(e: React.FormEvent) {
    e.preventDefault();
    setRouteFormError(null);
    let pathCoordinates: [number, number][] = [];
    try {
      pathCoordinates = parsePathTextToCoords(routeForm.pathText);
    } catch {
      setRouteFormError("Formato inválido na lista de coordenadas do traçado. Utilize uma linha por ponto: latitude, longitude");
      return;
    }

    setSavingRoute(true);
    try {
      const payload = {
        code: routeForm.code.trim().toUpperCase(),
        name: routeForm.name.trim(),
        corridor: routeForm.corridor.trim() || null,
        schoolId: routeForm.schoolId ? Number(routeForm.schoolId) : null,
        active: routeForm.active,
        pathCoordinates,
      };
      const res = editingRouteId
        ? await apiFetch<{ route: RouteDto; message: string }>(`/api/v1/admin/routes/${editingRouteId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ route: RouteDto; message: string }>("/api/v1/admin/routes", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setRouteModalOpen(false);
      setEditingRouteId(null);
      if (res.route?.id) {
        setSelectedAdminRouteId(res.route.id);
      }
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao guardar rota.";
      setRouteFormError(msg);
      showToast(msg);
    } finally {
      setSavingRoute(false);
    }
  }

  async function handleToggleRouteActive(route: RouteDto) {
    try {
      const res = await apiFetch<{ route: RouteDto; message: string }>(`/api/v1/admin/routes/${route.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !route.active }),
      });
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao alterar estado da rota.");
    }
  }

  function resetStopForm() {
    setStopFormError(null);
    setStopForm({
      id: null,
      name: "",
      latitude: "",
      longitude: "",
      scheduledTime: "07:00",
      geofenceRadiusM: 500,
      appendToPath: true,
    });
  }

  function startEditStop(stop: RouteStopDto) {
    setMapClickMode("pick_stop");
    setStopFormError(null);
    setStopForm({
      id: stop.id ?? null,
      name: stop.name,
      latitude: String(stop.latitude),
      longitude: String(stop.longitude),
      scheduledTime: stop.scheduledTime || "07:00",
      geofenceRadiusM: stop.geofenceRadiusM || 500,
      appendToPath: false,
    });
  }

  async function handleAdminRouteMapClick(lat: number, lng: number) {
    if (!selectedAdminRoute || !rolePerms.canManageRoutes) return;
    if (mapClickMode === "append_path") {
      try {
        const nextPath: [number, number][] = [...selectedAdminRoute.pathCoordinates, [lat, lng]];
        const res = await apiFetch<{ message: string }>(`/api/v1/admin/routes/${selectedAdminRoute.id}`, {
          method: "PATCH",
          body: JSON.stringify({ pathCoordinates: nextPath }),
        });
        showToast(`Ponto (${lat.toFixed(5)}, ${lng.toFixed(5)}) adicionado ao traçado. ${res.message}`);
        await loadOverview();
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Erro ao atualizar traçado no mapa.");
      }
      return;
    }

    setStopForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }

  async function handleSyncRoutePathFromStops(route: RouteDto) {
    if (route.stops.length < 2) {
      showToast("Adicione pelo menos 2 paragens para gerar a linha do traçado.");
      return;
    }
    try {
      const pathCoordinates = route.stops.map((st) => [st.latitude, st.longitude] as [number, number]);
      await apiFetch(`/api/v1/admin/routes/${route.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pathCoordinates }),
      });
      showToast(`Traçado da rota ${route.code} atualizado a partir das ${route.stops.length} paragens.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao gerar traçado pelas paragens.");
    }
  }

  async function handleSaveRouteStop(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAdminRoute) return;
    setStopFormError(null);
    const lat = Number(stopForm.latitude);
    const lng = Number(stopForm.longitude);
    if (!stopForm.name.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setStopFormError("Indique o nome da paragem e coordenadas válidas (toque no mapa ou escreva latitude/longitude).");
      return;
    }
    setSavingStop(true);
    try {
      const payload = {
        name: stopForm.name.trim(),
        latitude: lat,
        longitude: lng,
        scheduledTime: stopForm.scheduledTime.trim() || "07:00",
        geofenceRadiusM: Number(stopForm.geofenceRadiusM) || 500,
        appendToPath: stopForm.appendToPath,
      };
      const res = stopForm.id
        ? await apiFetch<{ message: string }>(
            `/api/v1/admin/routes/${selectedAdminRoute.id}/stops/${stopForm.id}`,
            { method: "PATCH", body: JSON.stringify(payload) }
          )
        : await apiFetch<{ message: string }>(
            `/api/v1/admin/routes/${selectedAdminRoute.id}/stops`,
            { method: "POST", body: JSON.stringify(payload) }
          );
      resetStopForm();
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao guardar paragem.";
      setStopFormError(msg);
      showToast(msg);
    } finally {
      setSavingStop(false);
    }
  }

  async function handleDeleteRouteStop(routeId: number, stopId: number, stopName: string) {
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/routes/${routeId}/stops/${stopId}`, {
        method: "DELETE",
      });
      if (stopForm.id === stopId) {
        resetStopForm();
      }
      showToast(res.message || `Paragem "${stopName}" removida.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao remover paragem.");
    }
  }

  async function handleMoveRouteStop(route: RouteDto, index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= route.stops.length) return;
    const reordered = [...route.stops];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved!);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/routes/${route.id}/stops/reorder`, {
        method: "PUT",
        body: JSON.stringify({ stopIds: reordered.map((s) => s.id) }),
      });
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao reordenar paragens.");
    }
  }

  async function handleSaveDriverEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDriver) return;
    setSavingDriver(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/admin/drivers/${editingDriver.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editingDriver.fullName.trim(),
          phone: editingDriver.phone.trim(),
          licenceCategory: editingDriver.licenceCategory.trim(),
          licenceNumber: editingDriver.licenceNumber.trim(),
          licenceExpiry: editingDriver.licenceExpiry.trim(),
          employerType: editingDriver.employerType,
          employerSchoolId:
            editingDriver.employerType === "school" && editingDriver.employerSchoolId
              ? Number(editingDriver.employerSchoolId)
              : null,
          verificationStatus: editingDriver.verificationStatus,
          availabilityStatus: editingDriver.availabilityStatus,
          monthlyCompensationAoa: Number(editingDriver.monthlyCompensationAoa) || 0,
        }),
      });
      setEditingDriver(null);
      showToast(res.message);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao atualizar motorista.");
    } finally {
      setSavingDriver(false);
    }
  }

  async function handleDownloadReport(
    reportKey: "students" | "trips" | "attendance" | "invoices" | "incidents" | "vehicles-drivers" | "payroll",
    label: string,
    options?: { useReportFilters?: boolean }
  ) {
    setDownloadingReportKey(reportKey);
    try {
      const useFilters = options?.useReportFilters ?? true;
      await downloadServerCsv({
        path: `/api/v1/admin/reports/${reportKey}`,
        filename: `mobuss-relatorio-${reportKey}.csv`,
        query: useFilters
          ? {
              from: reportFromDate,
              to: reportToDate,
              schoolId: reportSchoolId === "all" ? null : reportSchoolId,
            }
          : undefined,
        getAuthToken,
      });
      showToast(`Relatório "${label}" exportado em CSV com sucesso.`);
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Não foi possível exportar "${label}".`);
    } finally {
      setDownloadingReportKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink flex flex-col lg:flex-row" style={{ fontFamily: "var(--font-body)" }}>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="fixed top-20 right-6 z-50 rounded-xl bg-slide-paper-ink text-slide-paper px-4 py-3 shadow-2xl border border-white/15 flex items-center gap-3 max-w-sm"
          >
            <Bell className="w-4 h-4 text-slide-accent shrink-0" />
            <div className="text-xs font-semibold">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slide-paper-ink text-slide-paper flex-col justify-between p-5 shrink-0 border-r border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
            <img
              src="/mobus-logo-1024.png"
              alt="MôBus Logo"
              className="w-9 h-9 rounded-lg object-contain bg-black p-0.5 border border-white/10"
            />
            <div>
              <div className="font-extrabold text-sm tracking-tight leading-none" style={{ fontFamily: "var(--font-display)" }}>
                MôBus Admin
              </div>
              <div className="text-[11px] text-slide-dim font-medium mt-1">
                Central de Luanda
              </div>
            </div>
          </div>

          <nav className="space-y-1">
            {ADMIN_TABS.map(({ id, Icon, desc }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  title={desc}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 font-semibold text-xs transition cursor-pointer text-left ${
                    active
                      ? "bg-slide-accent text-slide-accent-ink shadow-xs"
                      : "text-slide-dim hover:text-slide-paper hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate whitespace-nowrap">{id}</span>
                  </span>

                  {id === "Emergências" && openIncidentsCount > 0 && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-white/15 text-white">
                      {openIncidentsCount}
                    </span>
                  )}
                  {id === "Contratos" && pendingLeadsCount > 0 && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-white/15 text-white">
                      {pendingLeadsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1.5 pt-4 border-t border-white/10 text-xs">
          {APP_TARGET === "hub" && onNavigate && (
            <>
              <div className="text-[11px] font-semibold text-slide-dim mb-2">Atalhos da Plataforma</div>
              <button
                onClick={() => onNavigate("school")}
                className="w-full flex items-center gap-2 text-slide-paper hover:text-slide-accent font-semibold transition cursor-pointer text-left py-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-slide-accent shrink-0" />
                <span>Portal Escola</span>
              </button>
              <button
                onClick={() => onNavigate("mockup")}
                className="w-full flex items-center gap-2 text-slide-dim hover:text-slide-paper transition cursor-pointer text-left py-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                <span>Simulador iPhone</span>
              </button>
              <button
                onClick={() => onNavigate("deck")}
                className="w-full flex items-center gap-2 text-slide-dim hover:text-slide-paper transition cursor-pointer text-left py-1.5"
              >
                <Presentation className="w-3.5 h-3.5 shrink-0" />
                <span>Slides</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 text-red-300 hover:text-red-200 font-semibold transition cursor-pointer text-left py-1.5 mt-1"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Terminar Sessão (Sair)</span>
          </button>
        </div>
      </aside>

      {/* Mobile Responsive Top Bar & Navigation */}
      <div className="lg:hidden border-b border-white/10 bg-slide-paper-ink">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/mobus-logo-1024.png"
              alt="MôBus Logo"
              className="w-7 h-7 rounded-lg object-contain bg-black p-0.5 border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-xs tracking-tight text-white truncate" style={{ fontFamily: "var(--font-display)" }}>
                MôBus Admin
              </div>
              <div className="text-[10px] text-slide-dim truncate">
                {dbUser?.fullName} · {dbUser ? ROLE_LABELS[dbUser.primaryRole] : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-red-500/15 text-red-300 hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
        <div className="px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {ADMIN_TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition ${
                tab === id ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{id === "Painel" ? "Dashboard" : id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 pb-5 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slide-dim flex items-center gap-x-2.5 gap-y-1 flex-wrap">
              <span className="text-slide-paper/90 font-semibold">Angola · Luanda</span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  serviceStatus.tone === "ok"
                    ? "text-emerald-400"
                    : serviceStatus.tone === "warn"
                    ? "text-amber-400"
                    : serviceStatus.tone === "danger"
                    ? "text-slide-accent"
                    : "text-slide-paper"
                }`}
                title={serviceStatus.reason}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    serviceStatus.tone === "ok"
                      ? "bg-emerald-400"
                      : serviceStatus.tone === "warn"
                      ? "bg-amber-400"
                      : serviceStatus.tone === "danger"
                      ? "bg-slide-accent"
                      : "bg-slide-dim"
                  }`}
                />
                <span>Serviço: {serviceStatus.label}</span>
              </span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${dbReachableSignal ? "text-emerald-400" : "text-slide-accent"}`}>
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span className="tabular-nums">
                  {dbReachableSignal
                    ? `PostgreSQL Online (${dbLatencySignal ?? 0}ms)`
                    : health.checked
                    ? "PostgreSQL Indisponível"
                    : "A verificar PostgreSQL..."}
                </span>
              </span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${wsConnected ? "text-emerald-400" : "text-amber-400"}`}>
                <Radio className={`w-3.5 h-3.5 shrink-0 ${wsConnected ? "animate-pulse" : ""}`} />
                <span className="tabular-nums">
                  {wsConnected ? `WebSocket Ao Vivo (${simConnectedClients} ligação(ões))` : "WebSocket a ligar..."}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
                {tab === "Painel" ? "Dashboard" : tab}
              </h1>
              <span className="text-xs text-slide-dim font-medium">
                {tab === "Painel"
                  ? "Central Operacional de Transporte Escolar"
                  : ADMIN_TABS.find((item) => item.id === tab)?.desc}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 sm:flex-initial min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slide-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar frota, alunos, contratos..."
                aria-label="Pesquisa global no painel administrativo"
                className="rounded-xl bg-slide-surface pl-9 pr-8 py-2 text-xs text-slide-paper placeholder:text-slide-dim outline-none w-full sm:w-64 border border-white/10 focus:border-slide-accent transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar pesquisa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slide-dim hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void checkHealth();
                void loadOverview();
              }}
              className="rounded-xl bg-slide-surface border border-white/10 px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-white/[0.06] hover:border-white/20 transition whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? "animate-spin text-slide-accent" : ""}`} />
              <span>Atualizar</span>
            </button>

            <div className="hidden sm:flex items-center gap-2.5 bg-slide-surface px-3 py-1.5 rounded-xl border border-white/10">
              <div className="w-7 h-7 rounded-lg bg-slide-accent text-white grid place-items-center font-black text-xs shrink-0">
                {(dbUser?.fullName || "MB").slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <div className="text-xs font-bold text-slide-paper leading-tight truncate max-w-[160px]">
                  {dbUser?.fullName}
                </div>
                <div className="text-[11px] text-slide-dim leading-tight truncate">
                  {dbUser ? ROLE_LABELS[dbUser.primaryRole] : ""}
                </div>
              </div>
            </div>
          </div>
        </header>

        <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {/* ================= PAINEL (DASHBOARD) ================= */}
          {tab === "Painel" && (
            <div className="space-y-6">
              {/* Role-Scoped Real PostgreSQL Statistics Cards */}
              <section aria-label="Resumo operacional" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {rolePerms.canViewContractsKpi && scopedSummary.contracts && (
                  <DashboardKpiCard
                    title={selectedSchoolObj ? "Contratos da Escola" : "Contratos Escolares Ativos"}
                    value={scopedSummary.contracts.total > 0 ? scopedSummary.contracts.active : "sem dados"}
                    secondaryValue={
                      scopedSummary.contracts.total > 0 ? `${scopedSummary.contracts.total} total` : undefined
                    }
                    subtitle={
                      selectedSchoolObj
                        ? `${selectedSchoolObj.name} · ${selectedSchoolObj.municipality}`
                        : scopedSummary.contracts.total > 0
                        ? `${selectableSchools.length} escola(s) · ${scopedSummary.contracts.pendingRequests} pedido(s) por rever`
                        : "sem dados de contratos"
                    }
                    statusLabel={
                      scopedSummary.contracts.total === 0
                        ? "sem dados"
                        : scopedSummary.contracts.pendingRequests > 0 && !selectedSchoolObj
                        ? "Requer revisão"
                        : scopedSummary.contracts.active > 0
                        ? "Ativo"
                        : "Inativo"
                    }
                    statusTone={
                      scopedSummary.contracts.total === 0
                        ? "neutral"
                        : scopedSummary.contracts.pendingRequests > 0 && !selectedSchoolObj
                        ? "warn"
                        : scopedSummary.contracts.active > 0
                        ? "ok"
                        : "neutral"
                    }
                    Icon={FileSignature}
                    onClick={() => setTab("Contratos")}
                  />
                )}

                {rolePerms.canViewFleetKpi && scopedSummary.vehicles && (
                  <DashboardKpiCard
                    title={selectedSchoolObj ? "Viaturas Atribuídas" : "Frota & Motoristas"}
                    value={scopedSummary.vehicles.total > 0 ? scopedSummary.vehicles.total : "sem dados"}
                    secondaryValue={
                      scopedSummary.drivers && scopedSummary.drivers.total > 0
                        ? `${scopedSummary.drivers.onDuty}/${scopedSummary.drivers.total} mot.`
                        : undefined
                    }
                    subtitle={
                      scopedSummary.vehicles.total === 0
                        ? "sem dados de viaturas"
                        : `${(scopedSummary.vehicles.byStatus.on_trip ?? 0) + (scopedSummary.vehicles.byStatus.assigned ?? 0)} em operação · ${scopedSummary.vehicles.byStatus.available ?? 0} disp. · ${scopedSummary.vehicles.byStatus.maintenance ?? 0} manut.`
                    }
                    statusLabel={
                      scopedSummary.vehicles.total === 0
                        ? "sem dados"
                        : serviceStatus.label
                    }
                    statusTone={
                      scopedSummary.vehicles.total === 0
                        ? "neutral"
                        : serviceStatus.tone
                    }
                    Icon={Bus}
                    onClick={() => setTab("Frota")}
                  />
                )}

                {rolePerms.canViewStudentsKpi && scopedSummary.students && (
                  <DashboardKpiCard
                    title={selectedSchoolObj ? "Alunos Inscritos (Escola)" : "Alunos Inscritos"}
                    value={scopedSummary.students.total > 0 ? scopedSummary.students.enrolled : "sem dados"}
                    secondaryValue={
                      scopedSummary.students.total > 0 ? `${scopedSummary.students.total} registados` : undefined
                    }
                    subtitle={
                      scopedSummary.students.total === 0
                        ? "sem dados de educandos"
                        : `${scopedSummary.students.awaitingPickup} a aguardar · ${scopedSummary.students.onBoard} a bordo · ${scopedSummary.students.pendingApproval} por aprovar`
                    }
                    statusLabel={
                      scopedSummary.students.total === 0
                        ? "sem dados"
                        : scopedSummary.students.pendingApproval > 0
                        ? "Aprovações pend."
                        : "PIN Obrigatório"
                    }
                    statusTone={
                      scopedSummary.students.total === 0
                        ? "neutral"
                        : scopedSummary.students.pendingApproval > 0
                        ? "warn"
                        : "neutral"
                    }
                    Icon={GraduationCap}
                    onClick={() => setTab("Alunos")}
                  />
                )}

                {rolePerms.canViewIncidentsKpi && scopedSummary.incidents && (
                  <DashboardKpiCard
                    title={selectedSchoolObj ? "Ocorrências da Escola" : "Ocorrências em Aberto"}
                    value={scopedSummary.incidents.total > 0 ? scopedSummary.incidents.open : "sem dados"}
                    secondaryValue={
                      scopedSummary.incidents.total > 0 ? `${scopedSummary.incidents.total} total` : undefined
                    }
                    subtitle={
                      scopedSummary.incidents.total === 0
                        ? "sem dados de ocorrências"
                        : scopedSummary.incidents.criticalOpen > 0
                        ? `${scopedSummary.incidents.criticalOpen} crítica(s) · ${scopedSummary.incidents.delayReportsOpen} atraso(s)`
                        : scopedSummary.incidents.open > 0
                        ? `${scopedSummary.incidents.open} ocorrência(s) em tratamento`
                        : "Todas as ocorrências resolvidas"
                    }
                    statusLabel={
                      scopedSummary.incidents.total === 0
                        ? "sem dados"
                        : scopedSummary.incidents.criticalOpen > 0
                        ? "Crítico"
                        : scopedSummary.incidents.open > 0
                        ? "Atenção requerida"
                        : "Resolvidas"
                    }
                    statusTone={
                      scopedSummary.incidents.total === 0
                        ? "neutral"
                        : scopedSummary.incidents.criticalOpen > 0 || scopedSummary.incidents.open > 0
                        ? "danger"
                        : "ok"
                    }
                    Icon={Siren}
                    onClick={() => setTab("Emergências")}
                  />
                )}

                {rolePerms.canViewFinanceKpi && scopedSummary.finance && (
                  <DashboardKpiCard
                    title="Faturas Pagas (Mês)"
                    value={
                      scopedSummary.finance.totalInvoicesThisMonth > 0
                        ? formatAOA(scopedSummary.finance.paidThisMonthAoa)
                        : "sem dados"
                    }
                    secondaryValue={
                      scopedSummary.finance.totalInvoicesThisMonth > 0
                        ? `${scopedSummary.finance.paidThisMonthCount} paga(s)`
                        : undefined
                    }
                    subtitle={
                      scopedSummary.finance.totalInvoicesThisMonth === 0
                        ? "sem dados de faturação neste mês"
                        : `Pendentes mês: ${scopedSummary.finance.pendingThisMonthCount} (${formatAOA(scopedSummary.finance.pendingThisMonthAoa)})`
                    }
                    statusLabel={
                      scopedSummary.finance.totalInvoicesThisMonth === 0
                        ? "sem dados"
                        : scopedSummary.finance.pendingThisMonthCount > 0
                        ? "Por conciliar"
                        : "Conciliado"
                    }
                    statusTone={
                      scopedSummary.finance.totalInvoicesThisMonth === 0
                        ? "neutral"
                        : scopedSummary.finance.pendingThisMonthCount > 0
                        ? "warn"
                        : "ok"
                    }
                    Icon={CreditCard}
                    onClick={() => setTab("Finanças")}
                  />
                )}

                {rolePerms.canViewDocumentsKpi && scopedSummary.documents && (
                  <DashboardKpiCard
                    title="Documentos a Expirar (30d)"
                    value={
                      scopedSummary.documents.checkedCount > 0
                        ? scopedSummary.documents.expiringNext30DaysTotal
                        : "sem dados"
                    }
                    secondaryValue={
                      scopedSummary.documents.expiredTotal > 0
                        ? `${scopedSummary.documents.expiredTotal} expirado(s)`
                        : undefined
                    }
                    subtitle={
                      scopedSummary.documents.checkedCount === 0
                        ? "sem dados de documentação"
                        : `${scopedSummary.documents.vehiclesDnvtExpiring30Days} DNVT · ${scopedSummary.documents.driversLicenceExpiring30Days} carta(s)`
                    }
                    statusLabel={
                      scopedSummary.documents.checkedCount === 0
                        ? "sem dados"
                        : scopedSummary.documents.expiredTotal > 0
                        ? "Expirado"
                        : scopedSummary.documents.expiringNext30DaysTotal > 0
                        ? "Renovar em 30d"
                        : "Em dia"
                    }
                    statusTone={
                      scopedSummary.documents.checkedCount === 0
                        ? "neutral"
                        : scopedSummary.documents.expiredTotal > 0
                        ? "danger"
                        : scopedSummary.documents.expiringNext30DaysTotal > 0
                        ? "warn"
                        : "ok"
                    }
                    Icon={ShieldCheck}
                    onClick={() => setTab("DNVT")}
                  />
                )}
              </section>

              {/* Quick Actions (Authorized Only) + Live Operations Overview */}
              <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4 items-stretch">
                {/* Real Live Operations Overview */}
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 flex flex-col justify-between gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-sm text-slide-paper flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                        <Navigation className="w-4 h-4 text-slide-accent" />
                        <span>
                          {selectedSchoolObj ? `Operações Ao Vivo · ${selectedSchoolObj.name}` : "Operações Ao Vivo · Base de Dados"}
                        </span>
                      </h2>
                      <p className="text-xs text-slide-dim mt-0.5">
                        Telemetria operacional em tempo real ({scopedSummary.referenceDate}) proveniente do PostgreSQL e WebSocket.
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-slide-dim tabular-nums">
                      {scopedSummary.tripsToday && scopedSummary.tripsToday.total > 0
                        ? `${scopedSummary.tripsToday.total} viagem(ns) hoje`
                        : "Viagens hoje: sem dados"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 border border-white/10 rounded-xl bg-slide-bg overflow-hidden divide-x divide-y divide-white/10">
                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">Viagens Hoje</div>
                      <div className="text-xl font-black text-white tabular-nums mt-0.5">
                        {!rolePerms.canViewTripsKpi
                          ? "Restrito"
                          : scopedSummary.tripsToday && scopedSummary.tripsToday.total > 0
                          ? scopedSummary.tripsToday.total
                          : "sem dados"}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5 tabular-nums">
                        {!rolePerms.canViewTripsKpi
                          ? "Fora do âmbito do perfil"
                          : scopedSummary.tripsToday && scopedSummary.tripsToday.total > 0
                          ? `${scopedSummary.tripsToday.active} em curso · ${scopedSummary.tripsToday.scheduled} agendada(s)`
                          : "Sem viagens para hoje"}
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">Estado do Serviço</div>
                      <div
                        className={`text-xl font-black mt-0.5 ${
                          serviceStatus.tone === "ok"
                            ? "text-emerald-400"
                            : serviceStatus.tone === "warn"
                            ? "text-amber-400"
                            : serviceStatus.tone === "danger"
                            ? "text-slide-accent"
                            : "text-white"
                        }`}
                      >
                        {serviceStatus.label}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5 tabular-nums">
                        GPS: {serviceStatus.liveGpsTripsCount} ao vivo · {serviceStatus.staleGpsTripsCount} desat.
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">Motoristas em Serviço</div>
                      <div className="text-xl font-black text-white tabular-nums mt-0.5">
                        {!rolePerms.canViewDriversKpi
                          ? "Restrito"
                          : scopedSummary.drivers && scopedSummary.drivers.total > 0
                          ? (
                            <>
                              {scopedSummary.drivers.onDuty}
                              <span className="text-xs font-semibold text-slide-dim">/{scopedSummary.drivers.total}</span>
                            </>
                          )
                          : "sem dados"}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5">
                        {!rolePerms.canViewDriversKpi
                          ? "Fora do âmbito do perfil"
                          : scopedSummary.drivers && scopedSummary.drivers.total > 0
                          ? `${scopedSummary.drivers.available} disponível(is) · ${scopedSummary.drivers.offDuty} folga`
                          : "sem dados de motoristas"}
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">Viagens com Atraso</div>
                      <div
                        className={`text-xl font-black tabular-nums mt-0.5 ${
                          (scopedSummary.delayedTripsCount ?? 0) > 0 ? "text-amber-400" : "text-white"
                        }`}
                      >
                        {!rolePerms.canViewTripsKpi
                          ? "Restrito"
                          : scopedSummary.tripsToday && scopedSummary.tripsToday.total === 0 && (scopedSummary.delayedTripsCount ?? 0) === 0
                          ? "sem dados"
                          : scopedSummary.delayedTripsCount ?? "sem dados"}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5">
                        {!rolePerms.canViewTripsKpi
                          ? "Fora do âmbito do perfil"
                          : (scopedSummary.delayedTripsCount ?? 0) > 0
                          ? "Atrasos reportados em curso"
                          : scopedSummary.tripsToday && scopedSummary.tripsToday.total > 0
                          ? "Sem atrasos registados"
                          : "Sem viagens ativas"}
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">Alunos por Recolher</div>
                      <div className="text-xl font-black text-white tabular-nums mt-0.5">
                        {!rolePerms.canViewStudentsKpi
                          ? "Restrito"
                          : scopedSummary.students && scopedSummary.students.total > 0
                          ? scopedSummary.students.awaitingPickup
                          : "sem dados"}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5 tabular-nums">
                        {!rolePerms.canViewStudentsKpi
                          ? "Fora do âmbito do perfil"
                          : scopedSummary.students && scopedSummary.students.total > 0
                          ? `${scopedSummary.students.onBoard} a bordo · ${scopedSummary.students.enrolled} ativos`
                          : "sem dados de alunos"}
                      </div>
                    </div>

                    <div className="p-3.5">
                      <div className="text-[11px] font-medium text-slide-dim">
                        {rolePerms.canViewFinanceKpi ? "Faturas Pendentes (Mês)" : "Ocorrências Críticas"}
                      </div>
                      <div
                        className={`text-xl font-black tabular-nums mt-0.5 ${
                          rolePerms.canViewFinanceKpi
                            ? (scopedSummary.finance?.pendingThisMonthCount ?? 0) > 0
                              ? "text-amber-400"
                              : "text-white"
                            : serviceStatus.openCriticalIncidentsCount > 0
                            ? "text-slide-accent"
                            : "text-emerald-400"
                        }`}
                      >
                        {rolePerms.canViewFinanceKpi
                          ? scopedSummary.finance && scopedSummary.finance.totalInvoicesThisMonth > 0
                            ? formatAOA(scopedSummary.finance.pendingThisMonthAoa)
                            : "sem dados"
                          : rolePerms.canViewIncidentsKpi
                          ? scopedSummary.incidents && scopedSummary.incidents.total > 0
                            ? serviceStatus.openCriticalIncidentsCount
                            : "sem dados"
                          : "Restrito"}
                      </div>
                      <div className="text-[11px] text-slide-dim mt-0.5">
                        {rolePerms.canViewFinanceKpi
                          ? scopedSummary.finance && scopedSummary.finance.totalInvoicesThisMonth > 0
                            ? `${scopedSummary.finance.pendingThisMonthCount} fatura(s) pendente(s)`
                            : "sem dados este mês"
                          : rolePerms.canViewIncidentsKpi
                          ? `${scopedSummary.incidents?.open ?? 0} ocorrência(s) em aberto`
                          : "Fora do âmbito do perfil"}
                      </div>
                    </div>
                  </div>

                  {/* Real PostgreSQL Active / Scheduled Trips List or Honest Empty State */}
                  {!rolePerms.canViewTripsKpi ? (
                    <div className="rounded-xl bg-slide-bg border border-white/10 px-4 py-3 text-xs text-slide-dim">
                      O acompanhamento detalhado de viagens está reservado aos perfis operacionais, de frota e de segurança.
                    </div>
                  ) : scopedTrips.length === 0 ? (
                    <div className="rounded-xl bg-slide-bg border border-white/10 px-4 py-3 text-xs text-slide-dim flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {selectedSchoolObj
                          ? `sem dados · Sem viagens registadas para ${selectedSchoolObj.name}.`
                          : "sem dados · Sem viagens registadas no PostgreSQL."}
                      </span>
                      {rolePerms.canManageRouteSchedules && (
                        <button
                          type="button"
                          onClick={() => openNewRouteScheduleModal(selectedSchoolFilter !== "all" ? selectedSchoolFilter : undefined)}
                          className="text-[11px] font-bold text-slide-accent hover:underline cursor-pointer shrink-0"
                        >
                          + Agendar escala recorrente
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-slide-bg overflow-hidden">
                      {scopedTrips.slice(0, 4).map((trip) => (
                        <div key={trip.id} className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono font-bold text-white">{trip.tripCode}</span>
                            <span className="text-slide-accent font-semibold">{trip.routeCode}</span>
                            <span className="text-slide-dim truncate hidden sm:inline">· {trip.routeName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] tabular-nums">
                            <span className="font-semibold text-slide-paper">{translateTripState(trip.state)}</span>
                            <span className={trip.gpsStatus === "live" ? "text-emerald-400 font-semibold" : "text-slide-dim"}>
                              GPS: {trip.gpsStatus === "live" ? "Ao vivo" : trip.gpsStatus === "stale" ? "Desatualizado" : "Indisponível"}
                            </span>
                            {trip.lastLocationAt && (
                              <span className="text-slide-dim font-mono hidden md:inline">
                                {new Date(trip.lastLocationAt).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compact Authorized Quick Actions */}
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 flex flex-col justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-sm text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
                      Ações Rápidas
                    </h2>
                    <p className="text-xs text-slide-dim mt-0.5">
                      Atalhos autorizados para o perfil <span className="text-slide-paper font-semibold">{dbUser ? ROLE_LABELS[dbUser.primaryRole] : ""}</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                    {rolePerms.canManageRouteSchedules && (
                      <button
                        type="button"
                        onClick={() => openNewRouteScheduleModal()}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-slide-accent/60 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <CalendarClock className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Agendar Rota Recorrente</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    )}

                    {rolePerms.canManageVehicles && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVehicleId(null);
                          setVehicleForm({
                            fleetNumber: String((overview?.vehicles.length ?? 0) + 1),
                            plate: "",
                            ownershipType: "mobuss_owned",
                            ownerId: overview?.vehicleOwners[0]?.id ?? "",
                            assignedSchoolId: selectedSchoolFilter !== "all" ? selectedSchoolFilter : "",
                            routeCode: "ROTA-A",
                            capacity: 22,
                            dnvtExpiry: "2027-12-31",
                            dnvtStatus: "valid",
                            insuranceProvider: "ENSA Seguros de Angola",
                            insuranceStatus: "valid",
                            status: "available",
                          });
                          setVehicleModalOpen(true);
                        }}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-slide-accent/60 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Bus className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Registar Viatura</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    )}

                    {rolePerms.canCreateUsers ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewUserRole("driver");
                          setUserModalOpen(true);
                        }}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-slide-accent/60 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <UserPlus className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Registar Motorista</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    ) : rolePerms.canEditDrivers ? (
                      <button
                        type="button"
                        onClick={() => setTab("Motoristas")}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-white/25 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <UserCheck className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Gerir Motoristas</span>
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setTab("Contratos")}
                      className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-white/25 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileSignature className="w-4 h-4 text-slide-accent shrink-0" />
                        <span>Ver Contratos Escolares</span>
                      </span>
                      <span className="text-[11px] font-mono text-slide-dim tabular-nums">
                        {pendingLeadsCount > 0 ? `${pendingLeadsCount} pend.` : activeContractsCount}
                      </span>
                    </button>

                    {rolePerms.canCreateStudents ? (
                      <button
                        type="button"
                        onClick={() => {
                          setNewStudentForm((f) => ({
                            ...f,
                            schoolId:
                              selectedSchoolFilter !== "all"
                                ? selectedSchoolFilter
                                : f.schoolId || overview?.schools[0]?.id || "",
                          }));
                          setNewStudentModalOpen(true);
                        }}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-slide-accent/60 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <GraduationCap className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Registar / Gerir Alunos</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTab("Alunos")}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-white/25 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <GraduationCap className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>Gerir Alunos</span>
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slide-dim" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setTab("Emergências")}
                      className="w-full rounded-xl bg-slide-bg border border-white/10 hover:border-white/25 hover:bg-white/[0.04] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slide-paper transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Siren className="w-4 h-4 text-slide-accent shrink-0" />
                        <span>Ver Ocorrências</span>
                      </span>
                      <span className={`text-[11px] font-mono tabular-nums ${openIncidentsCount > 0 ? "text-slide-accent font-bold" : "text-slide-dim"}`}>
                        {openIncidentsCount} aberta(s)
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Database Charts & Role-Scoped Breakdown Row */}
              <section aria-label="Gráficos e indicadores da base de dados" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rolePerms.canViewFleetKpi && scopedSummary.vehicles && (
                  <Card
                    title="Frota por Estado (Base de Dados)"
                    action={
                      <span className="text-[11px] font-semibold text-slide-dim tabular-nums">
                        {scopedSummary.vehicles.total > 0 ? `${scopedSummary.vehicles.total} viatura(s)` : "sem dados"}
                      </span>
                    }
                  >
                    {scopedSummary.vehicles.total === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                        sem dados
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {scopedSummary.vehicles.statusSeries.map((item) => {
                          const pct = Math.round((item.count / scopedSummary.vehicles!.total) * 100);
                          return (
                            <div key={item.key} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slide-paper font-medium">{item.label}</span>
                                <span className="font-mono font-bold text-white tabular-nums">
                                  {item.count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slide-bg overflow-hidden border border-white/5">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    item.key === "on_trip"
                                      ? "bg-emerald-400"
                                      : item.key === "assigned"
                                      ? "bg-sky-400"
                                      : item.key === "available"
                                      ? "bg-slide-ok"
                                      : item.key === "maintenance"
                                      ? "bg-amber-400"
                                      : "bg-slide-accent"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                )}

                {rolePerms.canViewTripsKpi && scopedSummary.tripsToday && (
                  <Card
                    title={`Viagens Hoje por Estado (${scopedSummary.referenceDate})`}
                    action={
                      <span className="text-[11px] font-semibold text-slide-dim tabular-nums">
                        {scopedSummary.tripsToday.total > 0 ? `${scopedSummary.tripsToday.total} viagem(ns)` : "sem dados"}
                      </span>
                    }
                  >
                    {scopedSummary.tripsToday.total === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                        sem dados
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {scopedSummary.tripsToday.stateSeries.map((item) => {
                          const pct = Math.round((item.count / scopedSummary.tripsToday!.total) * 100);
                          return (
                            <div key={item.key} className="space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-slide-paper font-medium">{item.label}</span>
                                <span className="font-mono font-bold text-white tabular-nums">
                                  {item.count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slide-bg overflow-hidden border border-white/5">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    item.key === "in_progress"
                                      ? "bg-emerald-400"
                                      : item.key === "scheduled"
                                      ? "bg-sky-400"
                                      : item.key === "delayed"
                                      ? "bg-amber-400"
                                      : item.key === "completed"
                                      ? "bg-slide-ok"
                                      : "bg-slide-accent"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                )}

                {rolePerms.canViewFinanceKpi && scopedSummary.finance && (
                  <Card
                    title={`Faturação do Mês (${scopedSummary.finance.month})`}
                    action={
                      <button
                        type="button"
                        onClick={() => setTab("Finanças")}
                        className="text-[11px] font-bold text-slide-accent hover:underline cursor-pointer"
                      >
                        Abrir Finanças →
                      </button>
                    }
                  >
                    {scopedSummary.finance.totalInvoicesThisMonth === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                        sem dados
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {(() => {
                          const totalAoa =
                            scopedSummary.finance!.paidThisMonthAoa + scopedSummary.finance!.pendingThisMonthAoa;
                          const paidPct =
                            totalAoa > 0 ? Math.round((scopedSummary.finance!.paidThisMonthAoa / totalAoa) * 100) : 0;
                          const pendingPct =
                            totalAoa > 0 ? Math.round((scopedSummary.finance!.pendingThisMonthAoa / totalAoa) * 100) : 0;
                          return (
                            <>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-emerald-300 font-semibold">
                                    Pagas este mês ({scopedSummary.finance!.paidThisMonthCount})
                                  </span>
                                  <span className="font-mono font-bold text-white tabular-nums">
                                    {formatAOA(scopedSummary.finance!.paidThisMonthAoa)}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slide-bg overflow-hidden border border-white/5">
                                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${paidPct}%` }} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-amber-300 font-semibold">
                                    Pendentes este mês ({scopedSummary.finance!.pendingThisMonthCount})
                                  </span>
                                  <span className="font-mono font-bold text-white tabular-nums">
                                    {formatAOA(scopedSummary.finance!.pendingThisMonthAoa)}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slide-bg overflow-hidden border border-white/5">
                                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pendingPct}%` }} />
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </Card>
                )}

                <Card
                  title="Sinais do Estado de Serviço"
                  action={
                    <span
                      className={`text-[11px] font-bold ${
                        serviceStatus.tone === "ok"
                          ? "text-emerald-400"
                          : serviceStatus.tone === "warn"
                          ? "text-amber-400"
                          : serviceStatus.tone === "danger"
                          ? "text-slide-accent"
                          : "text-slide-dim"
                      }`}
                    >
                      {serviceStatus.label}
                    </span>
                  }
                >
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-slide-bg border border-white/10 px-3 py-2">
                      <span className="text-slide-dim">Base de Dados PostgreSQL</span>
                      <span className={`font-bold tabular-nums ${serviceStatus.dbReachable ? "text-emerald-400" : "text-slide-accent"}`}>
                        {serviceStatus.dbReachable ? `Acessível (${serviceStatus.dbLatencyMs ?? 0}ms)` : "Inacessível"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slide-bg border border-white/10 px-3 py-2">
                      <span className="text-slide-dim">Telemetria GPS Ativa vs Desat.</span>
                      <span className="font-mono font-bold text-white tabular-nums">
                        {serviceStatus.liveGpsTripsCount === 0 && serviceStatus.staleGpsTripsCount === 0
                          ? "sem dados"
                          : `${serviceStatus.liveGpsTripsCount} ao vivo / ${serviceStatus.staleGpsTripsCount} desat.`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slide-bg border border-white/10 px-3 py-2">
                      <span className="text-slide-dim">Ocorrências Críticas Abertas</span>
                      <span
                        className={`font-mono font-bold tabular-nums ${
                          serviceStatus.openCriticalIncidentsCount > 0 ? "text-slide-accent" : "text-emerald-400"
                        }`}
                      >
                        {rolePerms.canViewIncidentsKpi
                          ? scopedSummary.incidents && scopedSummary.incidents.total === 0
                            ? "sem dados"
                            : serviceStatus.openCriticalIncidentsCount
                          : "Restrito"}
                      </span>
                    </div>
                  </div>
                </Card>

                {rolePerms.canViewDocumentsKpi && scopedSummary.documents && (
                  <Card
                    title="Documentação a Expirar (Próx. 30 Dias)"
                    action={
                      <button
                        type="button"
                        onClick={() => setTab("DNVT")}
                        className="text-[11px] font-bold text-slide-accent hover:underline cursor-pointer"
                      >
                        Ver DNVT →
                      </button>
                    }
                  >
                    {scopedSummary.documents.checkedCount === 0 || scopedSummary.documents.items.length === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                        {scopedSummary.documents.checkedCount === 0
                          ? "sem dados"
                          : "sem dados · Nenhum documento expira nos próximos 30 dias."}
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs">
                        {scopedSummary.documents.items.slice(0, 4).map((doc) => (
                          <div
                            key={`${doc.entityType}-${doc.entityId}-${doc.documentType}`}
                            className="rounded-lg bg-slide-bg border border-white/10 px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">{doc.title}</div>
                              <div className="text-[11px] text-slide-dim truncate">
                                {doc.documentType} · Val. {doc.expiryDate}
                              </div>
                            </div>
                            <span
                              className={`text-[11px] font-bold shrink-0 tabular-nums ${
                                doc.status === "expired" ? "text-slide-accent" : "text-amber-300"
                              }`}
                            >
                              {doc.daysRemaining < 0 ? `Expirou há ${Math.abs(doc.daysRemaining)}d` : `${doc.daysRemaining}d`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </section>

              {/* Preserved Hub Route Simulator (Strict Separation from Real Live Operations) */}
              {APP_TARGET === "hub" && (
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                      <Radio className={`w-4 h-4 ${simStatus?.running ? "text-amber-400 animate-pulse" : "text-slide-dim"}`} />
                      <span>Modo de Simulação (Ambiente Hub · PostgreSQL + WebSocket)</span>
                      <span className="text-[11px] font-medium text-amber-300">
                        · Ferramenta de demonstração separada da monitorização real da frota
                      </span>
                    </div>
                    <div className="text-[11px] text-slide-dim mt-0.5 tabular-nums">
                      {simStatus
                        ? `Simulador: ${simStatus.routeCode} · Progresso ${Math.round(simStatus.progress * 100)}% · Paragem simulada: ${simStatus.nearestStopName}`
                        : "Controla o marcador de demonstração no simulador iPhone e emite eventos de teste de 500m."}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedSimRouteCode}
                      onChange={(e) => setSelectedSimRouteCode(e.target.value)}
                      aria-label="Rota de simulação"
                      className="rounded-xl bg-slide-bg border border-white/15 px-2.5 py-1.5 text-xs text-white outline-none"
                    >
                      {(allRoutes.filter((r) => r.active).length > 0 ? allRoutes.filter((r) => r.active) : allRoutes).map((r) => (
                        <option key={r.id} value={r.code}>
                          Simular {r.code}
                        </option>
                      ))}
                    </select>
                    {simStatus?.running ? (
                      <button
                        type="button"
                        onClick={() => void handleSimulationAction("pause")}
                        className="rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-1.5 font-bold cursor-pointer whitespace-nowrap"
                      >
                        Pausar Simulação
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSimulationAction("start")}
                        className="rounded-xl bg-slide-ok text-white px-3 py-1.5 font-bold cursor-pointer whitespace-nowrap"
                      >
                        Iniciar Simulação Hub
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSimulationAction("step")}
                      className="rounded-xl bg-slide-bg border border-white/15 px-3 py-1.5 font-semibold cursor-pointer hover:bg-white/10 whitespace-nowrap"
                    >
                      +1 Passo (500m)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSimulationAction("reset")}
                      className="rounded-xl bg-slide-bg border border-white/15 px-3 py-1.5 font-semibold cursor-pointer hover:bg-white/10 whitespace-nowrap"
                    >
                      Reiniciar Rota
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-School Fleet Monitoring Center + Recent Administrative Activity */}
              <div className="grid grid-cols-1 xl:grid-cols-[1.65fr_1fr] gap-6 items-start">
                <Card
                  title="Centro de Monitorização Multi-Escola · Luanda"
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>GPS Ao Vivo ({fleetMapMarkers.filter((m) => m.isLiveGps).length})</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Última Posição ({fleetMapMarkers.filter((m) => !m.isLiveGps).length})</span>
                      </span>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {/* Prominent School Selector + Multi-Criteria Fleet Filters */}
                    <div className="rounded-xl bg-slide-bg border border-white/10 p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="multi-school-selector"
                            className="text-[11px] font-bold text-slide-dim flex items-center gap-1.5 mb-1.5"
                          >
                            <Building2 className="w-3.5 h-3.5 text-slide-accent" />
                            <span>Selecionar Escola / Âmbito da Frota</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              id="multi-school-selector"
                              value={selectedSchoolFilter === "all" ? "all" : String(selectedSchoolFilter)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedSchoolFilter(val === "all" ? "all" : Number(val));
                                setFleetRouteFilter("all");
                                setSelectedFleetVehicleId(null);
                              }}
                              className="flex-1 min-w-[230px] rounded-xl bg-slide-surface border border-white/15 focus:border-slide-accent px-3 py-2 text-xs font-bold text-white outline-none"
                            >
                              <option value="all">
                                Todas as Escolas ({selectableSchools.length} parceira(s) · {allLiveFleetVehicles.length} viatura(s))
                              </option>
                              {selectableSchools.map((sc) => {
                                const schoolBusCount = allLiveFleetVehicles.filter((v) =>
                                  v.associatedSchoolIds.includes(sc.id)
                                ).length;
                                return (
                                  <option key={sc.id} value={sc.id}>
                                    {sc.name} · {sc.municipality} ({schoolBusCount} viatura(s))
                                  </option>
                                );
                              })}
                            </select>

                            {selectedSchoolFilter !== "all" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSchoolFilter("all");
                                  setFleetRouteFilter("all");
                                  setSelectedFleetVehicleId(null);
                                }}
                                className="rounded-xl bg-slide-surface border border-white/15 hover:border-white/30 px-3 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                              >
                                Todas as Escolas
                              </button>
                            )}
                          </div>
                        </div>

                        {selectedSchoolObj && (
                          <div className="rounded-xl bg-slide-surface border border-white/10 px-3.5 py-2 text-xs shrink-0">
                            <div className="font-bold text-white">{selectedSchoolObj.name}</div>
                            <div className="text-[11px] text-slide-dim tabular-nums mt-0.5">
                              {scopedVehicles.length} autocarro(s) · {scopedDriverList.length} motorista(s) · {scopedSchedules.filter((s) => s.active).length} escala(s)
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Vehicle Status, Trip Status & Active Corridor Filters */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { id: "all" as const, label: `Todas (${scopedVehicles.length})` },
                            {
                              id: "active" as const,
                              label: `Em Rota (${scopedVehicles.filter((v) => v.status === "on_trip" || Boolean(v.activeTrip && v.hasLiveGps)).length})`,
                            },
                            {
                              id: "available" as const,
                              label: `Alocadas / Disp. (${scopedVehicles.filter((v) => v.status === "available" || v.status === "assigned").length})`,
                            },
                            {
                              id: "maintenance" as const,
                              label: `Manutenção (${scopedVehicles.filter((v) => v.status === "maintenance" || v.status === "out_of_service" || v.status === "suspended").length})`,
                            },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setFleetStatusFilter(f.id)}
                              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition border ${
                                fleetStatusFilter === f.id
                                  ? "bg-white/15 text-white border-white/25"
                                  : "bg-slide-surface text-slide-dim border-white/10 hover:text-white"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={fleetTripFilter}
                            onChange={(e) => setFleetTripFilter(e.target.value as "all" | "active" | "delayed" | "idle")}
                            aria-label="Filtrar por estado da viagem"
                            className="rounded-lg bg-slide-surface border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white outline-none"
                          >
                            <option value="all">Viagens: Todas</option>
                            <option value="active">Viagens Ativas</option>
                            <option value="delayed">Viagens com Atraso</option>
                            <option value="idle">Sem Viagem Ativa</option>
                          </select>

                          {availableRouteFilterOptions.length > 0 && (
                            <select
                              value={fleetRouteFilter}
                              onChange={(e) => setFleetRouteFilter(e.target.value)}
                              aria-label="Filtrar por rota"
                              className="rounded-lg bg-slide-surface border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white outline-none"
                            >
                              <option value="all">Rotas: Todas ({availableRouteFilterOptions.length})</option>
                              {availableRouteFilterOptions.map((code) => (
                                <option key={code} value={code}>
                                  {code}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Empty State Banner when School has 0 vehicles or 0 GPS */}
                    {scopedVehicles.length === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-amber-500/30 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-amber-300">
                            Nenhuma viatura atribuída a {selectedSchoolObj?.name ?? "esta escola"}
                          </div>
                          <div className="text-slide-dim mt-0.5">
                            Atribua uma viatura na gestão de Frota ou agende uma rota recorrente para iniciar a monitorização neste campus.
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {rolePerms.canManageRouteSchedules && (
                            <button
                              type="button"
                              onClick={() => openNewRouteScheduleModal(selectedSchoolFilter !== "all" ? selectedSchoolFilter : undefined)}
                              className="rounded-xl bg-slide-accent text-white px-3 py-1.5 font-bold cursor-pointer whitespace-nowrap"
                            >
                              + Agendar Rota
                            </button>
                          )}
                          {rolePerms.canManageVehicles && (
                            <button
                              type="button"
                              onClick={() => setTab("Frota")}
                              className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 font-semibold text-white cursor-pointer whitespace-nowrap"
                            >
                              Ir para Frota
                            </button>
                          )}
                        </div>
                      </div>
                    ) : fleetMapMarkers.length === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs text-slide-dim flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Sinal GPS indisponível para as viaturas visíveis no filtro atual ({filteredLiveFleet.length} viatura(s)). Nenhuma coordenada artificial será exibida.
                        </span>
                        <span className="font-mono text-[11px] text-amber-300">GPS Indisponível</span>
                      </div>
                    ) : null}

                    {/* Multi-Route & Clustered Leaflet Map */}
                    <LuandaMap
                      progress={0}
                      multiRouteMode
                      routes={allRoutes}
                      visibleRouteCodes={activeRouteCodesOnMap}
                      enableClustering
                      scopeKey={`${selectedSchoolFilter}-${fleetRouteFilter}-${fleetStatusFilter}-${fleetTripFilter}`}
                      darkMode
                      showZoomControl
                      showBusMarker={false}
                      fleetMarkers={fleetMapMarkers}
                      selectedVehicleId={inspectedVehicle?.id ?? null}
                      onSelectVehicle={(vehicleId) => setSelectedFleetVehicleId(vehicleId)}
                      className="h-[360px] sm:h-[430px] rounded-xl border border-white/10"
                    />

                    {/* Selectable Fleet Strip & Detailed Vehicle Inspector */}
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slide-paper">
                          {selectedSchoolObj
                            ? `Viaturas de ${selectedSchoolObj.name} (${filteredLiveFleet.length})`
                            : `Frota Filtrada (${filteredLiveFleet.length})`}
                        </span>
                        <span className="text-[11px] text-slide-dim tabular-nums">
                          {fleetMapMarkers.filter((m) => m.isLiveGps).length} GPS ao vivo ·{" "}
                          {filteredLiveFleet.filter((v) => !v.hasCoordinates).length} sem coordenadas
                        </span>
                      </div>

                      {filteredLiveFleet.length === 0 ? (
                        <div className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs text-slide-dim">
                          {scopedVehicles.length === 0
                            ? "Esta escola ainda não tem viaturas alocadas nem viagens em curso."
                            : "Nenhuma viatura corresponde aos filtros de estado ou pesquisa selecionados."}
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {filteredLiveFleet.map((v) => {
                              const selected = inspectedVehicle?.id === v.id;
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => setSelectedFleetVehicleId(v.id)}
                                  className={`px-3 py-2 rounded-xl border text-left shrink-0 cursor-pointer transition ${
                                    selected
                                      ? "bg-slide-accent/15 border-slide-accent text-white"
                                      : "bg-slide-bg border-white/10 text-slide-dim hover:text-white hover:border-white/25"
                                  }`}
                                >
                                  <div className="text-xs font-bold flex items-center gap-2">
                                    <span>Autocarro {v.fleetNumber}</span>
                                    <span className="font-mono text-[10px] opacity-80">{v.plate}</span>
                                  </div>
                                  <div className="text-[11px] mt-0.5 flex items-center gap-1.5">
                                    <span
                                      className={
                                        v.gpsStatus === "live"
                                          ? "text-emerald-400 font-semibold"
                                          : v.gpsStatus === "stale"
                                          ? "text-amber-300 font-semibold"
                                          : "text-slide-dim"
                                      }
                                    >
                                      {v.gpsStatus === "live"
                                        ? "GPS Ao Vivo"
                                        : v.gpsStatus === "stale"
                                        ? "Última Posição"
                                        : "Sem GPS"}
                                    </span>
                                    <span>·</span>
                                    <span>{v.routeCode}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {inspectedVehicle && (
                            <div className="rounded-xl bg-slide-bg border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                              <div>
                                <div className="text-[11px] text-slide-dim">Viatura & Motorista</div>
                                <div className="font-bold text-white mt-0.5">
                                  Autocarro {inspectedVehicle.fleetNumber} · {inspectedVehicle.plate}
                                </div>
                                <div className="text-[11px] text-slide-dim mt-0.5">
                                  Motorista:{" "}
                                  <span className="text-slide-paper font-medium">{inspectedVehicle.driverName}</span>
                                  {inspectedVehicle.driverPhone ? ` · ${inspectedVehicle.driverPhone}` : ""}
                                </div>
                                <div className="text-[11px] text-slide-dim mt-0.5">
                                  Escola:{" "}
                                  <span className="text-slide-paper font-medium">
                                    {inspectedVehicle.associatedSchoolNames.join(", ") || "Sem escola atribuída"}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] text-slide-dim">Rota & Estado da Viagem</div>
                                <div className="font-bold text-slide-accent mt-0.5">
                                  {inspectedVehicle.routeCode}
                                  {inspectedVehicle.routeName && inspectedVehicle.routeName !== inspectedVehicle.routeCode
                                    ? ` · ${inspectedVehicle.routeName}`
                                    : ""}
                                </div>
                                <div className="text-[11px] text-slide-paper font-medium mt-0.5">
                                  {translateVehicleStatus(inspectedVehicle.status)}
                                  {inspectedVehicle.activeTrip
                                    ? ` · ${inspectedVehicle.activeTrip.tripCode} (${translateTripState(inspectedVehicle.activeTrip.state)})`
                                    : " · Sem viagem ativa"}
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] text-slide-dim">Ocupação de Alunos</div>
                                <div className="font-bold text-white mt-0.5 tabular-nums">
                                  {inspectedVehicle.studentsBoardedCount} a bordo ·{" "}
                                  {inspectedVehicle.studentsAssignedCount}/{inspectedVehicle.capacity} lugares
                                </div>
                                <div className="text-[11px] text-slide-dim mt-0.5 tabular-nums">
                                  {inspectedVehicle.studentsAwaitingCount} a aguardar embarque
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] text-slide-dim">Última Atualização & Localização GPS</div>
                                <div
                                  className={`font-bold mt-0.5 ${
                                    inspectedVehicle.gpsStatus === "live"
                                      ? "text-emerald-400"
                                      : inspectedVehicle.gpsStatus === "stale"
                                      ? "text-amber-300"
                                      : "text-slide-dim"
                                  }`}
                                >
                                  {inspectedVehicle.gpsStatus === "live"
                                    ? "GPS Ao Vivo"
                                    : inspectedVehicle.gpsStatus === "stale"
                                    ? "Última Localização (Desatualizado)"
                                    : "GPS Indisponível"}
                                </div>
                                <div className="text-[11px] text-slide-paper mt-0.5 truncate" title={inspectedVehicle.locationLabel}>
                                  {inspectedVehicle.locationLabel}
                                </div>
                                <div className="text-[10px] text-slide-dim mt-0.5 font-mono">
                                  {inspectedVehicle.lastLocationAt
                                    ? new Date(inspectedVehicle.lastLocationAt).toLocaleString("pt-AO")
                                    : "Sem registo de coordenadas"}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Upcoming Recurring Route Schedules inside School / Overview */}
                          <div className="rounded-xl bg-slide-bg border border-white/10 p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5 text-slide-accent" />
                                <span>
                                  Escalas Recorrentes {selectedSchoolObj ? `· ${selectedSchoolObj.name}` : "Ativas"} ({scopedSchedules.filter((s) => s.active).length})
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setTab("Rotas & Escalas")}
                                className="text-[11px] font-bold text-slide-accent hover:underline cursor-pointer"
                              >
                                Gerir escalas →
                              </button>
                            </div>
                            {scopedSchedules.length === 0 ? (
                              <div className="text-[11px] text-slide-dim">
                                Sem escalas recorrentes configuradas para este âmbito.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {scopedSchedules.slice(0, 4).map((sch) => (
                                  <div
                                    key={sch.id}
                                    className="rounded-lg bg-slide-surface border border-white/10 px-3 py-2 text-[11px] flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-white truncate">
                                        <span className="text-slide-accent">{sch.routeCode}</span> · {sch.schoolName}
                                      </div>
                                      <div className="text-slide-dim truncate">
                                        {formatWeekdaysPt(sch.daysOfWeek)} · {sch.departureTime}–{sch.arrivalTime} ·{" "}
                                        {sch.vehicleFleetNumber ? `Autocarro ${sch.vehicleFleetNumber}` : "Sem viatura"}
                                      </div>
                                    </div>
                                    <span
                                      className={`font-bold shrink-0 ${
                                        sch.active ? "text-emerald-400" : "text-slide-dim"
                                      }`}
                                    >
                                      {sch.active ? "Ativa" : "Pausada"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Recent Administrative Activity (Humanized PostgreSQL Audit Log) */}
                <Card
                  title="Atividade Administrativa Recente"
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTechnicalAudit((prev) => !prev)}
                        className="text-[11px] font-semibold text-slide-dim hover:text-white cursor-pointer whitespace-nowrap"
                      >
                        {showTechnicalAudit ? "Ocultar detalhes técnicos" : "Detalhes técnicos"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTab("Sistema & Acessos");
                          setTimeout(() => {
                            document.getElementById("admin-audit-log-section")?.scrollIntoView({ behavior: "smooth" });
                          }, 80);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slide-accent hover:underline cursor-pointer whitespace-nowrap"
                      >
                        <span>Auditoria completa</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  }
                >
                  {formattedAuditLogs.length === 0 ? (
                    <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                      Sem eventos de auditoria correspondentes ao filtro atual.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-slide-bg max-h-[540px] overflow-y-auto">
                      {formattedAuditLogs.slice(0, 12).map((item) => (
                        <div key={item.id} className="p-3.5 text-xs space-y-1.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-white leading-snug">{item.title}</div>
                            <span
                              className={`text-[10px] font-bold whitespace-nowrap shrink-0 ${
                                item.severity === "critical"
                                  ? "text-slide-accent"
                                  : item.severity === "warn"
                                  ? "text-amber-400"
                                  : item.severity === "success"
                                  ? "text-emerald-400"
                                  : "text-slide-dim"
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <div className="text-slide-dim leading-snug">{item.summary}</div>
                          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] text-slide-dim pt-0.5">
                            <span className="truncate">
                              <span className="text-slide-paper/90 font-medium">{item.actorDisplay}</span>
                              {" · "}
                              <span>{item.actorRoleDisplay}</span>
                            </span>
                            <span className="font-mono tabular-nums shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {item.dateLabel} · {item.timeLabel}
                              </span>
                            </span>
                          </div>
                          {showTechnicalAudit && (
                            <div className="text-[10px] font-mono text-slide-dim/80 pt-1">
                              {item.rawAction} · {item.targetDisplay}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ================= CONTRATOS ================= */}
          {tab === "Contratos" && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-slide-dim">
                  Pedidos públicos de contratação, alterações de escolas e contratos com modelo de pagamento configurável.
                </span>
                <button
                  onClick={() => {
                    setNewMonthlyAoa(
                      newStudents * pricingDraft.studentMonthlyFee + newBuses * pricingDraft.driverMonthlyFee
                    );
                    setContractModalOpen(true);
                  }}
                  className="rounded-xl bg-slide-accent text-white px-4 py-2 font-bold text-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registar Novo Contrato</span>
                </button>
              </div>

              {/* Public Contract Requests Queue */}
              <Card title={`Pedidos Públicos de Contrato (${requestsList.length})`}>
                {requestsList.length === 0 ? (
                  <div className="text-xs text-slide-dim">Sem pedidos submetidos.</div>
                ) : (
                  <div className="space-y-2.5">
                    {requestsList.map((r) => (
                      <div key={r.id} className="rounded-xl bg-slide-bg border border-white/10 p-4 flex flex-wrap justify-between items-center gap-3 text-xs">
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span className="font-mono text-slide-accent">{r.referenceCode}</span>
                            <span>· {r.schoolName}</span>
                          </div>
                          <div className="text-slide-dim mt-0.5">
                            {r.municipality} · {r.busesRequested} autocarros · {r.studentsEstimate} alunos · Est. {formatAOA(r.estimatedMonthlyAoa)}/mês · Pref: {PAYER_LABELS[r.payerPreference] ?? r.payerPreference}
                          </div>
                          <div className="text-[11px] text-slide-dim mt-0.5">
                            Contacto: {r.contactName} ({r.contactPhone})
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {r.status === "request_received" || r.status === "under_review" ? (
                            <>
                              <select
                                value={leadPayerSelection[r.id] || "school"}
                                onChange={(e) =>
                                  setLeadPayerSelection((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value as "school" | "parent" | "mixed",
                                  }))
                                }
                                className="rounded-lg bg-slide-surface border border-white/10 px-2.5 py-1.5 text-xs text-white"
                              >
                                <option value="school">Escola Paga</option>
                                <option value="parent">Pais Pagam</option>
                                <option value="mixed">Modelo Misto</option>
                              </select>
                              <button
                                onClick={() => void handleReviewLead(r.id, "approve")}
                                className="rounded-lg bg-slide-ok text-white px-3 py-1.5 font-bold cursor-pointer"
                              >
                                Aprovar & Criar Contrato
                              </button>
                              <button
                                onClick={() => void handleReviewLead(r.id, "reject")}
                                className="rounded-lg bg-slide-surface border border-white/10 px-3 py-1.5 font-semibold cursor-pointer"
                              >
                                Recusar
                              </button>
                            </>
                          ) : (
                            <StatusBadge s={r.status === "accepted" ? "Ativo" : "Recusado"} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Active Contracts Table */}
              <Table head={["Contrato / Escola", "Município", "Modelo Serviço", "Modelo Pagador", "Política PIN", "Frota / Alunos", "Valor Mensal", "Estado"]}>
                {contractsList.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{c.schoolName}</div>
                      <div className="text-[11px] font-mono text-slide-dim">{c.contractNumber}</div>
                    </td>
                    <td className="p-3.5 text-slide-dim">{c.municipality}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          c.serviceModel === "full_service"
                            ? "bg-slide-accent/20 text-slide-accent"
                            : "bg-emerald-500/15 text-emerald-300"
                        }`}
                      >
                        {c.serviceModel === "full_service" ? "Serviço Completo" : "Software"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-white/10 text-[11px] font-semibold">
                        {PAYER_LABELS[c.payerModel] ?? c.payerModel}
                      </span>
                    </td>
                    <td className="p-3.5 text-[11px] text-slide-ok font-semibold">
                      Embarque + Desembarque
                    </td>
                    <td className="p-3.5 font-mono tabular-nums">
                      {c.busesAllocated} bus · {c.studentsCovered} alunos
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slide-accent tabular-nums">
                      {c.monthlyValueAoa != null ? formatAOA(c.monthlyValueAoa) : "Restrito"}
                    </td>
                    <td className="p-3.5">
                      <StatusBadge s={c.status === "active" ? "Ativo" : c.status} />
                    </td>
                  </tr>
                ))}
              </Table>

              {/* School Portal Change Requests */}
              <Card title={`Pedidos de Alteração das Escolas (${overview?.transportChangeRequests.length ?? 0})`}>
                {(overview?.transportChangeRequests ?? []).length === 0 ? (
                  <div className="text-xs text-slide-dim">Sem pedidos pendentes das escolas.</div>
                ) : (
                  <div className="space-y-2.5">
                    {overview?.transportChangeRequests.map((req) => (
                      <div key={req.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 flex flex-wrap justify-between items-center gap-3 text-xs">
                        <div>
                          <div className="font-bold text-white">
                            {req.schoolName} · {req.title}
                          </div>
                          <div className="text-slide-dim text-[11px] mt-0.5">{req.details}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                onClick={() => void handleReviewTransportRequest(req.id, "approved")}
                                className="px-2.5 py-1 rounded-lg bg-slide-ok text-white font-bold cursor-pointer"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => void handleReviewTransportRequest(req.id, "rejected")}
                                className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/10 font-semibold cursor-pointer"
                              >
                                Recusar
                              </button>
                            </>
                          ) : (
                            <StatusBadge s={req.status === "approved" ? "Ativo" : "Recusado"} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ================= FROTA & PROPRIETÁRIOS ================= */}
          {tab === "Frota" && (
            <div className="space-y-6">
              <Card
                title={`Proprietários de Frota & Parceiros Independentes (${overview?.vehicleOwners.length ?? 0})`}
                action={
                  <button
                    onClick={() => setOwnerModalOpen(true)}
                    className="rounded-xl bg-slide-accent text-white px-3.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registar Proprietário Parceiro</span>
                  </button>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {(overview?.vehicleOwners ?? []).map((owner) => (
                    <div key={owner.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white">{owner.fullName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            owner.ownerType === "mobuss_owned"
                              ? "bg-white/15 text-white"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {owner.ownerType === "mobuss_owned" ? "Frota MôBus" : "Parceiro Independente"}
                        </span>
                      </div>
                      <div className="text-slide-dim font-mono text-[11px]">{owner.phone}</div>
                      <div className="text-[11px] text-slide-ok font-semibold">
                        Acerto: {owner.monthlySettlementAoa != null ? formatAOA(owner.monthlySettlementAoa) : "Restrito"} ({owner.settlementModel})
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slide-dim">
                    Frota registada ({vehiclesList.length} viatura(s)):
                  </span>
                  <select
                    value={fleetOwnershipFilter}
                    onChange={(e) =>
                      setFleetOwnershipFilter(
                        e.target.value as "all" | "school_owned" | "mobuss_owned" | "partner_owned"
                      )
                    }
                    aria-label="Filtrar viaturas por proprietário"
                    className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="all">Todos os Proprietários</option>
                    <option value="school_owned">Próprias da Escola</option>
                    <option value="mobuss_owned">Frota MôBus</option>
                    <option value="partner_owned">Parceiros Independentes</option>
                  </select>
                  <select
                    value={fleetAdminSchoolFilter === "all" ? "all" : String(fleetAdminSchoolFilter)}
                    onChange={(e) =>
                      setFleetAdminSchoolFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    aria-label="Filtrar viaturas por escola"
                    className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="all">Todas as Escolas</option>
                    {(overview?.schools ?? []).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicleId(null);
                    setVehicleForm({
                      fleetNumber: String((overview?.vehicles.length ?? 0) + 1),
                      plate: "",
                      ownershipType: "mobuss_owned",
                      ownerId: overview?.vehicleOwners[0]?.id ?? "",
                      assignedSchoolId: fleetAdminSchoolFilter !== "all" ? fleetAdminSchoolFilter : "",
                      routeCode: "ROTA-A",
                      capacity: 22,
                      dnvtExpiry: "2027-12-31",
                      dnvtStatus: "valid",
                      insuranceProvider: "ENSA Seguros de Angola",
                      insuranceStatus: "valid",
                      status: "available",
                    });
                    setVehicleModalOpen(true);
                  }}
                  className="rounded-xl bg-slide-accent text-white px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registar Nova Viatura</span>
                </button>
              </div>

              <Table head={["Autocarro", "Matrícula", "Escola Atribuída", "Proprietário", "Corredor", "Motorista Alocado", "DNVT / Seguro", "Ações"]}>
                {vehiclesList.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-bold text-white">
                      <div>Autocarro {v.fleetNumber}</div>
                      <div className="text-[10px] text-slide-dim font-normal">{v.capacity} lugares · {translateVehicleStatus(v.status)}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold">{v.plate}</td>
                    <td className="p-3.5 text-slide-dim">
                      {v.schoolName ? (
                        <span className="text-slide-paper font-medium">{v.schoolName}</span>
                      ) : (
                        <span className="text-slide-dim">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slide-dim">
                      <div className="font-medium text-white">{v.ownerName}</div>
                      <div className="text-[10px]">
                        {v.ownershipType === "school_owned"
                          ? "Própria da Escola"
                          : v.ownershipType === "partner_owned"
                          ? "Parceiro"
                          : "Frota MôBus"}
                      </div>
                    </td>
                    <td className="p-3.5 text-slide-accent font-semibold">{v.routeCode}</td>
                    <td className="p-3.5 font-medium">{v.driverName}</td>
                    <td className="p-3.5 text-[11px] text-slide-dim">
                      <div>DNVT: {v.dnvtStatus} ({v.dnvtExpiry})</div>
                      <div>{v.insuranceProvider}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={assignDriverSelection[v.id] ?? v.assignedDriverId ?? ""}
                          onChange={(e) =>
                            setAssignDriverSelection((prev) => ({
                              ...prev,
                              [v.id]: Number(e.target.value),
                            }))
                          }
                          className="rounded-lg bg-slide-bg border border-white/10 px-2 py-1 text-xs text-white"
                        >
                          <option value="">Selecionar...</option>
                          {(overview?.drivers ?? []).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.fullName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleAssignDriver(v.id, v.assignedDriverId ?? 0)}
                          className="px-2.5 py-1 rounded-lg bg-slide-accent text-white font-bold cursor-pointer"
                        >
                          Alocar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVehicleId(v.id);
                            setVehicleForm({
                              fleetNumber: String(v.fleetNumber),
                              plate: v.plate,
                              ownershipType:
                                v.ownershipType === "school_owned" || v.ownershipType === "partner_owned"
                                  ? v.ownershipType
                                  : "mobuss_owned",
                              ownerId: v.ownerId ?? "",
                              assignedSchoolId: v.assignedSchoolId ?? "",
                              routeCode: v.routeCode || "ROTA-A",
                              capacity: v.capacity,
                              dnvtExpiry: v.dnvtExpiry,
                              dnvtStatus: (v.dnvtStatus === "expiring_soon" || v.dnvtStatus === "expired" ? v.dnvtStatus : "valid"),
                              insuranceProvider: v.insuranceProvider,
                              insuranceStatus: (v.insuranceStatus === "pending" || v.insuranceStatus === "expired" ? v.insuranceStatus : "valid"),
                              status: v.status,
                            });
                            setVehicleModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3 text-emerald-300" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          {/* ================= ROTAS & ESCALAS RECORRENTES ================= */}
          {tab === "Rotas & Escalas" && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="inline-flex rounded-xl bg-slide-surface border border-white/10 p-1 gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setRotasSubView("routes")}
                    className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5 transition ${
                      rotasSubView === "routes" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white"
                    }`}
                  >
                    <RouteIcon className="w-3.5 h-3.5" />
                    <span>Corredores & Paragens ({allRoutes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotasSubView("schedules")}
                    className={`px-3.5 py-1.5 rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5 transition ${
                      rotasSubView === "schedules" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white"
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>Escalas Recorrentes ({schedulesTabList.length})</span>
                  </button>
                </div>

                {rotasSubView === "routes" && rolePerms.canManageRoutes && (
                  <button
                    type="button"
                    onClick={openNewRouteModal}
                    className="rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Rota</span>
                  </button>
                )}

                {rotasSubView === "schedules" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={scheduleSchoolFilter === "all" ? "all" : String(scheduleSchoolFilter)}
                      onChange={(e) => setScheduleSchoolFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                      aria-label="Filtrar escalas por escola"
                      className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-xs text-white outline-none"
                    >
                      <option value="all">Todas as Escolas</option>
                      {selectableSchools.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                    {rolePerms.canManageRouteSchedules && (
                      <button
                        type="button"
                        onClick={() => openNewRouteScheduleModal(scheduleSchoolFilter !== "all" ? scheduleSchoolFilter : undefined)}
                        className="rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agendar Rota Recorrente</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {rotasSubView === "routes" ? (
                <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.5fr] gap-6 items-start">
                  {/* Left: Route List */}
                  <Card title={`Rotas Configuradas (${allRoutes.length})`}>
                    <div className="space-y-2.5">
                      {allRoutes
                        .filter(
                          (r) =>
                            !q ||
                            r.code.toLowerCase().includes(q) ||
                            r.name.toLowerCase().includes(q) ||
                            (r.corridor ?? "").toLowerCase().includes(q) ||
                            (r.schoolName ?? "").toLowerCase().includes(q)
                        )
                        .map((r) => {
                          const isSelected = selectedAdminRoute?.id === r.id;
                          return (
                            <div
                              key={r.id}
                              onClick={() => {
                                setSelectedAdminRouteId(r.id);
                                resetStopForm();
                              }}
                              className={`rounded-xl p-3.5 border transition cursor-pointer space-y-2 ${
                                isSelected
                                  ? "bg-slide-bg border-slide-accent"
                                  : "bg-slide-bg/70 border-white/10 hover:border-white/25"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-xs text-slide-accent">{r.code}</span>
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        r.active
                                          ? "bg-emerald-500/15 text-emerald-300"
                                          : "bg-zinc-700/60 text-zinc-400"
                                      }`}
                                    >
                                      {r.active ? "Ativa" : "Desativada"}
                                    </span>
                                  </div>
                                  <div className="font-bold text-xs text-white mt-1 truncate">{r.name}</div>
                                  <div className="text-[11px] text-slide-dim mt-0.5 truncate">
                                    {r.schoolName ? `Escola: ${r.schoolName}` : "Corredor geral"} · {r.stops.length} paragem(ns) ·{" "}
                                    {r.pathCoordinates.length} pontos no traçado
                                  </div>
                                </div>
                              </div>

                              {rolePerms.canManageRoutes && (
                                <div
                                  className="flex flex-wrap gap-1.5 pt-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => openEditRouteModal(r)}
                                    className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/15 hover:bg-white/10 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-300" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleRouteActive(r)}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                      r.active
                                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                                    }`}
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>{r.active ? "Desativar" : "Reativar"}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </Card>

                  {/* Right: Selected Route Interactive Map & Stops Editor */}
                  <Card
                    title={
                      selectedAdminRoute
                        ? `${selectedAdminRoute.code} · ${selectedAdminRoute.name}`
                        : "Editor de Rota & Paragens"
                    }
                    action={
                      selectedAdminRoute && rolePerms.canManageRoutes ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setMapClickMode("pick_stop")}
                            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                              mapClickMode === "pick_stop"
                                ? "bg-slide-accent text-white border-slide-accent"
                                : "bg-slide-bg border-white/15 text-slide-dim"
                            }`}
                          >
                            Marcar Paragem no Mapa
                          </button>
                          <button
                            type="button"
                            onClick={() => setMapClickMode("append_path")}
                            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer border ${
                              mapClickMode === "append_path"
                                ? "bg-slide-accent text-white border-slide-accent"
                                : "bg-slide-bg border-white/15 text-slide-dim"
                            }`}
                          >
                            Desenhar Traçado
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSyncRoutePathFromStops(selectedAdminRoute)}
                            className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold text-white cursor-pointer"
                            title="Atualizar a linha da rota pela ordem atual das paragens"
                          >
                            Gerar Linha pelas Paragens
                          </button>
                        </div>
                      ) : null
                    }
                  >
                    {!selectedAdminRoute ? (
                      <div className="text-xs text-slide-dim py-6 text-center">
                        Selecione ou crie uma rota para gerir as respetivas paragens e traçado no mapa.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-[11px] text-slide-dim flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {rolePerms.canManageRoutes
                              ? mapClickMode === "pick_stop"
                                ? "Toque em qualquer ponto do mapa abaixo para preencher automaticamente latitude e longitude da paragem."
                                : "Toque no mapa para adicionar um vértice ao traçado (linha) desta rota."
                              : "Visualização só de leitura das paragens e traçado desta rota."}
                          </span>
                          <span className="font-mono text-white">
                            {selectedAdminRoute.stops.length} paragem(ns) · {selectedAdminRoute.pathCoordinates.length} pontos
                          </span>
                        </div>

                        {(() => {
                          const draftLat = Number(stopForm.latitude);
                          const draftLng = Number(stopForm.longitude);
                          const hasDraftPin =
                            stopForm.latitude.trim() !== "" &&
                            stopForm.longitude.trim() !== "" &&
                            Number.isFinite(draftLat) &&
                            Number.isFinite(draftLng);
                          return (
                            <LuandaMap
                              route={selectedAdminRoute}
                              routeCode={selectedAdminRoute.code}
                              progress={0}
                              showBusMarker={false}
                              showZoomControl
                              darkMode
                              scopeKey={`admin-route-${selectedAdminRoute.id}`}
                              onMapClick={rolePerms.canManageRoutes ? handleAdminRouteMapClick : undefined}
                              draftPin={
                                hasDraftPin
                                  ? {
                                      lat: draftLat,
                                      lng: draftLng,
                                      label: stopForm.name.trim() || "Paragem selecionada",
                                      radiusM: Number(stopForm.geofenceRadiusM) || 500,
                                    }
                                  : null
                              }
                              className="h-[300px] sm:h-[340px] rounded-xl border border-white/10"
                            />
                          );
                        })()}

                        {/* Add / Edit Stop Form */}
                        {rolePerms.canManageRoutes && (
                          <form
                            onSubmit={handleSaveRouteStop}
                            className="rounded-xl bg-slide-bg border border-white/10 p-3.5 space-y-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-slide-accent" />
                                <span>{stopForm.id ? "Editar Paragem Selecionada" : "Adicionar Paragem à Rota"}</span>
                              </div>
                              {stopForm.id && (
                                <button
                                  type="button"
                                  onClick={resetStopForm}
                                  className="text-[11px] text-slide-dim underline cursor-pointer"
                                >
                                  Cancelar edição
                                </button>
                              )}
                            </div>

                            {stopFormError && (
                              <div className="rounded-lg bg-red-500/15 border border-red-500/40 px-3 py-2 text-[11px] text-red-200">
                                {stopFormError}
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <input
                                required
                                value={stopForm.name}
                                onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                                placeholder="Nome da paragem (ex: Largo do Kinaxixi)"
                                className="sm:col-span-2 rounded-xl bg-slide-surface border border-white/15 px-3 py-2 text-white outline-none"
                              />
                              <input
                                required
                                type="time"
                                value={stopForm.scheduledTime}
                                onChange={(e) => setStopForm({ ...stopForm, scheduledTime: e.target.value })}
                                aria-label="Hora prevista da paragem"
                                className="rounded-xl bg-slide-surface border border-white/15 px-3 py-2 text-white font-mono outline-none"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              <div>
                                <label className="text-[10px] text-slide-dim block mb-1">Latitude</label>
                                <input
                                  required
                                  type="number"
                                  step="0.000001"
                                  value={stopForm.latitude}
                                  onChange={(e) => setStopForm({ ...stopForm, latitude: e.target.value })}
                                  placeholder="-8.838300"
                                  className="w-full rounded-xl bg-slide-surface border border-white/15 px-3 py-2 text-white font-mono outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slide-dim block mb-1">Longitude</label>
                                <input
                                  required
                                  type="number"
                                  step="0.000001"
                                  value={stopForm.longitude}
                                  onChange={(e) => setStopForm({ ...stopForm, longitude: e.target.value })}
                                  placeholder="13.234400"
                                  className="w-full rounded-xl bg-slide-surface border border-white/15 px-3 py-2 text-white font-mono outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slide-dim block mb-1">Raio Geofence (m)</label>
                                <input
                                  required
                                  type="number"
                                  min={50}
                                  max={5000}
                                  value={stopForm.geofenceRadiusM}
                                  onChange={(e) =>
                                    setStopForm({ ...stopForm, geofenceRadiusM: Number(e.target.value) || 500 })
                                  }
                                  className="w-full rounded-xl bg-slide-surface border border-white/15 px-3 py-2 text-white font-mono outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                              {!stopForm.id ? (
                                <label className="inline-flex items-center gap-2 text-[11px] text-slide-dim cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={stopForm.appendToPath}
                                    onChange={(e) => setStopForm({ ...stopForm, appendToPath: e.target.checked })}
                                  />
                                  <span>Incluir coordenada no traçado da rota</span>
                                </label>
                              ) : (
                                <span />
                              )}

                              <button
                                type="submit"
                                disabled={savingStop}
                                className="rounded-xl bg-slide-ok text-white px-4 py-2 font-bold cursor-pointer disabled:opacity-50"
                              >
                                {savingStop
                                  ? "A guardar..."
                                  : stopForm.id
                                  ? "Guardar Alterações"
                                  : "Adicionar Paragem"}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Ordered Stops List */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slide-dim">
                            Ordem das Paragens ({selectedAdminRoute.stops.length})
                          </div>
                          {selectedAdminRoute.stops.length === 0 ? (
                            <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                              Esta rota ainda não tem paragens registadas. Toque no mapa ou insira as coordenadas acima para adicionar.
                            </div>
                          ) : (
                            selectedAdminRoute.stops.map((st, idx) => (
                              <div
                                key={st.id}
                                className="rounded-xl bg-slide-bg border border-white/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-6 h-6 rounded-full bg-slide-accent text-white font-black text-[11px] grid place-items-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-white truncate">{st.name}</div>
                                    <div className="text-[11px] text-slide-dim font-mono">
                                      {st.scheduledTime} · {st.latitude.toFixed(5)}, {st.longitude.toFixed(5)} · Raio {st.geofenceRadiusM}m
                                    </div>
                                  </div>
                                </div>

                                {rolePerms.canManageRoutes && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => void handleMoveRouteStop(selectedAdminRoute, idx, -1)}
                                      className="p-1.5 rounded-lg bg-slide-surface border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                      title="Mover paragem para cima"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === selectedAdminRoute.stops.length - 1}
                                      onClick={() => void handleMoveRouteStop(selectedAdminRoute, idx, 1)}
                                      className="p-1.5 rounded-lg bg-slide-surface border border-white/10 text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                                      title="Mover paragem para baixo"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditStop(st)}
                                      className="px-2 py-1 rounded-lg bg-slide-surface border border-white/10 hover:bg-white/10 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Pencil className="w-3 h-3 text-emerald-300" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => st.id !== undefined && void handleDeleteRouteStop(selectedAdminRoute.id, st.id, st.name)}
                                      className="px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remover</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-slide-dim">
                    Agendamento recorrente de rotas escolares, faixas horárias e atribuição de viaturas ({schedulesTabList.length} escala(s)).
                  </div>

                  {schedulesTabList.length === 0 ? (
                    <div className="rounded-2xl bg-slide-surface border border-white/10 p-6 text-center space-y-2 text-xs">
                      <CalendarClock className="w-7 h-7 text-slide-accent mx-auto" />
                      <div className="font-bold text-white">Sem escalas recorrentes registadas para este filtro</div>
                      <p className="text-slide-dim">
                        Defina rotas recorrentes por escola com dias da semana, janela horária e viatura atribuída (com verificação automática de conflitos).
                      </p>
                    </div>
                  ) : (
                    <Table head={["Escola Contratada", "Rota", "Recorrência & Turno", "Horário", "Viatura & Motorista", "Estado", "Ações"]}>
                      {schedulesTabList.map((sch) => (
                        <tr key={sch.id} className="hover:bg-white/[0.03] text-xs">
                          <td className="p-3.5 font-bold text-white">{sch.schoolName}</td>
                          <td className="p-3.5">
                            <div className="text-slide-accent font-bold">{sch.routeCode}</div>
                            <div className="text-[11px] text-slide-dim">{sch.routeName}</div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-white">{formatWeekdaysPt(sch.daysOfWeek)}</div>
                            <div className="text-[11px] text-slide-dim">
                              {sch.shiftType === "afternoon" ? "Turno da Tarde" : "Turno da Manhã"}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-white tabular-nums">
                            {sch.departureTime} – {sch.arrivalTime}
                          </td>
                          <td className="p-3.5">
                            {sch.vehicleFleetNumber ? (
                              <div>
                                <span className="font-bold text-white">Autocarro {sch.vehicleFleetNumber}</span>{" "}
                                <span className="font-mono text-[11px] text-slide-dim">({sch.vehiclePlate})</span>
                                <div className="text-[11px] text-slide-dim">{sch.driverName}</div>
                              </div>
                            ) : (
                              <span className="text-amber-300 font-semibold">Sem viatura atribuída</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <StatusBadge s={sch.active ? "Ativo" : "Pausada"} />
                          </td>
                          <td className="p-3.5">
                            {rolePerms.canManageRouteSchedules ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleToggleRouteSchedule(sch)}
                                  className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer"
                                >
                                  {sch.active ? "Pausar" : "Ativar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditRouteScheduleModal(sch)}
                                  className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Pencil className="w-3 h-3 text-emerald-300" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteScheduleTarget(sch)}
                                  className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 font-semibold cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remover</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slide-dim">Só leitura</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= MOTORISTAS ================= */}
          {tab === "Motoristas" && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-slide-dim">
                <div className="flex flex-wrap items-center gap-2">
                  <span>Motoristas ({driversList.length}):</span>
                  <select
                    value={driverEmployerFilter}
                    onChange={(e) => setDriverEmployerFilter(e.target.value as "all" | "school" | "mobuss")}
                    aria-label="Filtrar motoristas por empregador"
                    className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="all">Todos os Empregadores</option>
                    <option value="school">Contratados pela Escola</option>
                    <option value="mobuss">Empregador: MôBus</option>
                  </select>
                  <select
                    value={driverSchoolFilter === "all" ? "all" : String(driverSchoolFilter)}
                    onChange={(e) =>
                      setDriverSchoolFilter(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    aria-label="Filtrar motoristas por escola"
                    className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="all">Todas as Escolas</option>
                    {(overview?.schools ?? []).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={downloadingReportKey === "payroll"}
                  onClick={() => void handleDownloadReport("payroll", "Folha Salarial (Motoristas)", { useReportFilters: false })}
                  className="bg-slide-surface border border-white/10 text-slide-paper px-3.5 py-2 rounded-xl font-semibold cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadingReportKey === "payroll" ? "A exportar..." : "Exportar Folha Salarial CSV"}</span>
                </button>
              </div>

              <Table head={["Motorista", "Empregador / Escola", "Contacto", "Categoria", "Avaliação", "Viagens Mês", "Salário Bruto", "Estado", "Ações"]}>
                {driversList.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{d.fullName}</div>
                      {d.hasLogin && d.loginUsername && (
                        <div className="text-[10px] font-mono text-emerald-300">
                          @{d.loginUsername} ({d.loginActive ? "ativo" : "suspenso"})
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      {d.employerType === "mobuss" ? (
                        <span className="px-2 py-0.5 rounded bg-slide-accent/20 text-slide-accent text-[11px] font-semibold">
                          MôBus
                        </span>
                      ) : (
                        <div>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold">
                            Escola
                          </span>
                          <div className="text-[10px] text-slide-dim mt-0.5">{d.employerSchoolName || "Sem escola"}</div>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slide-dim">{d.phone}</td>
                    <td className="p-3.5 text-slide-dim">
                      <div>{d.licenceCategory}</div>
                      <div className="text-[10px] font-mono">{d.licenceNumber} · val. {d.licenceExpiry}</div>
                    </td>
                    <td className="p-3.5 text-amber-400 font-bold tabular-nums">★ {d.ratingAvg}</td>
                    <td className="p-3.5 font-mono tabular-nums">{d.tripsCompleted}</td>
                    <td className="p-3.5 font-mono font-bold">
                      {d.monthlyCompensationAoa != null ? formatAOA(d.monthlyCompensationAoa) : "Restrito"}
                    </td>
                    <td className="p-3.5">
                      <StatusBadge
                        s={
                          d.verificationStatus === "suspended"
                            ? "Suspenso"
                            : d.availabilityStatus === "in_service"
                            ? "Em serviço"
                            : d.availabilityStatus === "available"
                            ? "Disponível"
                            : "De folga"
                        }
                      />
                    </td>
                    <td className="p-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDriver({
                            id: d.id,
                            fullName: d.fullName,
                            phone: d.phone,
                            licenceCategory: d.licenceCategory,
                            licenceNumber: d.licenceNumber,
                            licenceExpiry: d.licenceExpiry,
                            employerType: d.employerType === "mobuss" ? "mobuss" : "school",
                            employerSchoolId: d.employerSchoolId ?? "",
                            verificationStatus:
                              d.verificationStatus === "suspended" || d.verificationStatus === "pending"
                                ? d.verificationStatus
                                : "verified",
                            availabilityStatus: (
                              d.availabilityStatus === "in_service" || d.availabilityStatus === "off_duty"
                                ? d.availabilityStatus
                                : "available"
                            ),
                            monthlyCompensationAoa: d.monthlyCompensationAoa ?? 0,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3 text-emerald-300" />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          {/* ================= ALUNOS (MASKED PINS) ================= */}
          {tab === "Alunos" && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-slide-dim">
                <span>Diretório nominal de educandos. Códigos PIN são armazenados em hash e nunca são exibidos em texto simples.</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewStudentForm((f) => ({ ...f, schoolId: f.schoolId || overview?.schools[0]?.id || "" }));
                      setNewStudentModalOpen(true);
                    }}
                    className="bg-slide-accent text-white px-3.5 py-2 rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registar Novo Aluno</span>
                  </button>
                  <button
                    type="button"
                    disabled={downloadingReportKey === "students"}
                    onClick={() =>
                      void handleDownloadReport("students", "Alunos (Escola, Rota e Paragem)", {
                        useReportFilters: false,
                      })
                    }
                    className="bg-slide-surface border border-white/10 text-slide-paper px-3.5 py-2 rounded-xl font-semibold cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>{downloadingReportKey === "students" ? "A exportar..." : "Exportar Pauta Segura CSV"}</span>
                  </button>
                </div>
              </div>

              <Table head={["Aluno(a)", "Escola", "Rota / Paragem", "Encarregado", "PIN", "Estado", "Ações"]}>
                {studentsList.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-bold text-white">
                      <div>{s.fullName}</div>
                      <div className="text-[10px] text-slide-dim font-normal">
                        {s.enrollmentStatus === "active"
                          ? "Matrícula Ativa"
                          : s.enrollmentStatus === "pending_approval"
                          ? "Aprovação Pendente"
                          : "Suspenso"}
                      </div>
                    </td>
                    <td className="p-3.5 text-slide-dim">{s.schoolName}</td>
                    <td className="p-3.5">
                      <span className="text-slide-accent font-bold">{s.routeCode}</span> · {s.stopName}
                    </td>
                    <td className="p-3.5">
                      <div>{s.guardianName}</div>
                      <div className="text-[11px] font-mono text-slide-dim">{s.guardianPhone}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slide-dim">{s.maskedPin}</td>
                    <td className="p-3.5">
                      <StatusBadge s={s.currentJourneyState} />
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleResetStudentPin(s.id, s.fullName)}
                          className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3 text-slide-accent" />
                          <span>PIN</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingStudent({
                              id: s.id,
                              fullName: s.fullName,
                              schoolId: s.schoolId,
                              routeCode: s.routeCode,
                              stopName: s.stopName,
                              shift: (s.shift === "morning" || s.shift === "afternoon" ? s.shift : "both"),
                              enrollmentStatus: (
                                s.enrollmentStatus === "pending_approval" || s.enrollmentStatus === "suspended"
                                  ? s.enrollmentStatus
                                  : "active"
                              ),
                              pinPolicy: (
                                s.pinPolicy === "boarding" || s.pinPolicy === "dropoff" ? s.pinPolicy : "both"
                              ),
                              guardianName: s.guardianName === "—" ? "" : s.guardianName,
                              guardianPhone: s.guardianPhone === "—" ? "" : s.guardianPhone,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3 text-emerald-300" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteStudentTarget({
                              id: s.id,
                              fullName: s.fullName,
                              schoolName: s.schoolName,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remover</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          {/* ================= FINANÇAS ================= */}
          {tab === "Finanças" && (
            <div className="space-y-6">
              <Card
                title="Gestão de Tarifário (Persistência PostgreSQL)"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPricingDraft(DEFAULT_PRICING)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slide-bg border border-white/10 text-xs font-semibold text-slide-dim cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Repor</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePricing()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slide-accent text-white text-xs font-bold cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar no PostgreSQL</span>
                    </button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl bg-slide-bg p-4 border border-white/10 space-y-2">
                    <div className="text-slide-dim font-semibold flex justify-between">
                      <span>Taxa por Aluno (AOA)</span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slide-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPricingDraft((p) => ({ ...p, studentMonthlyFee: Math.max(500, p.studentMonthlyFee - 500) }))}
                        className="w-9 h-9 rounded-lg bg-slide-surface border border-white/10 grid place-items-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={pricingDraft.studentMonthlyFee}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, studentMonthlyFee: Number(e.target.value) || 0 }))}
                        className="w-full rounded-lg bg-slide-surface px-3 py-2 text-sm font-mono font-bold text-center border border-white/10 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setPricingDraft((p) => ({ ...p, studentMonthlyFee: p.studentMonthlyFee + 500 }))}
                        className="w-9 h-9 rounded-lg bg-slide-surface border border-white/10 grid place-items-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slide-bg p-4 border border-white/10 space-y-2">
                    <div className="text-slide-dim font-semibold flex justify-between">
                      <span>Taxa por Motorista (AOA)</span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slide-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPricingDraft((p) => ({ ...p, driverMonthlyFee: Math.max(1000, p.driverMonthlyFee - 1000) }))}
                        className="w-9 h-9 rounded-lg bg-slide-surface border border-white/10 grid place-items-center cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={pricingDraft.driverMonthlyFee}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, driverMonthlyFee: Number(e.target.value) || 0 }))}
                        className="w-full rounded-lg bg-slide-surface px-3 py-2 text-sm font-mono font-bold text-center border border-white/10 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setPricingDraft((p) => ({ ...p, driverMonthlyFee: p.driverMonthlyFee + 1000 }))}
                        className="w-9 h-9 rounded-lg bg-slide-surface border border-white/10 grid place-items-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] text-slide-dim tabular-nums">
                      Cálculo: (Alunos × {formatAOA(pricingDraft.studentMonthlyFee)}) + (Motoristas × {formatAOA(pricingDraft.driverMonthlyFee)})
                    </div>
                  </div>

                  <div className="rounded-xl bg-slide-bg p-4 border border-white/10 space-y-2">
                    <div className="text-slide-dim font-semibold">Emitente, Entidade MCX & IVA</div>
                    <div className="grid grid-cols-[1fr_92px_68px] gap-2">
                      <input
                        value={pricingDraft.companyNif}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, companyNif: e.target.value }))}
                        placeholder="NIF"
                        className="rounded-lg bg-slide-surface px-2.5 py-2 font-mono border border-white/10 outline-none"
                      />
                      <input
                        value={pricingDraft.multicaixaEntityCode ?? "00845"}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, multicaixaEntityCode: e.target.value }))}
                        placeholder="Entidade MCX"
                        title="Entidade Multicaixa Express"
                        className="rounded-lg bg-slide-surface px-2.5 py-2 font-mono font-bold text-orange-300 border border-white/10 outline-none"
                      />
                      <select
                        value={pricingDraft.ivaPercent}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, ivaPercent: Number(e.target.value) }))}
                        className="rounded-lg bg-slide-surface px-2 py-2 font-mono border border-white/10 outline-none"
                      >
                        <option value={14}>14%</option>
                        <option value={5}>5%</option>
                        <option value={0}>0%</option>
                      </select>
                    </div>
                    <input
                      value={pricingDraft.companyAddress ?? ""}
                      onChange={(e) => setPricingDraft((p) => ({ ...p, companyAddress: e.target.value }))}
                      placeholder="Morada da empresa (para faturas)"
                      className="w-full rounded-lg bg-slide-surface px-2.5 py-1.5 text-[11px] border border-white/10 outline-none"
                    />
                    <div className="text-[11px] text-amber-300 font-semibold">
                      Entidade MCX configurável ({pricingDraft.multicaixaEntityCode || "00845"}) · Estado fiscal: Proforma
                    </div>
                  </div>
                </div>
              </Card>

              <Table head={["Documento", "Educando / Encarregado", "Valor", "Entidade / PIN MCX", "Estado", "Ações"]}>
                {invoicesList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                    <td className="p-3.5">
                      <div className="font-semibold">{inv.studentName}</div>
                      <div className="text-[11px] text-slide-dim">{inv.guardianName}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slide-accent tabular-nums">{formatAOA(inv.amountAoa)}</td>
                    <td className="p-3.5 font-mono text-[11px] text-slide-dim">
                      {inv.paymentReferencePin ? (
                        <div>
                          <span className="text-orange-300 font-bold">Ent. {inv.paymentEntity || "00845"}</span>
                          {" · "}
                          <span className="text-white font-bold">{inv.paymentReferencePin}</span>
                        </div>
                      ) : (
                        inv.providerReference || "A aguardar provedor"
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          inv.status === "confirmed" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {inv.status === "confirmed" ? "Conciliado (Homologação)" : "Aguardando Provedor"}
                      </span>
                    </td>
                    <td className="p-3.5 space-x-1.5 whitespace-nowrap">
                      {inv.status !== "confirmed" && (
                        <button
                          onClick={() => {
                            setReconcileInvoiceId(inv.id);
                            setReconcileRef(
                              inv.providerReference ||
                                (inv.paymentReferencePin
                                  ? `MCX-${inv.paymentEntity || "00845"}-${inv.paymentReferencePin.replace(/\s+/g, "")}`
                                  : "")
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slide-ok text-white font-bold cursor-pointer"
                        >
                          Conciliar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await downloadInvoicePdf({
                              invoiceId: inv.id,
                              invoiceNumber: inv.invoiceNumber,
                              isPaid: inv.status === "confirmed",
                              getAuthToken,
                            });
                            showToast(
                              inv.status === "confirmed"
                                ? `Recibo PDF (${inv.invoiceNumber}) descarregado.`
                                : `Fatura proforma PDF (${inv.invoiceNumber}) descarregada.`
                            );
                          } catch (err) {
                            showToast(
                              err instanceof Error ? err.message : "Não foi possível descarregar o PDF da fatura."
                            );
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>{inv.status === "confirmed" ? "Recibo PDF" : "Proforma PDF"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          {/* ================= DNVT ================= */}
          {tab === "DNVT" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Stat
                  label="Inspeções DNVT Válidas"
                  value={`${(overview?.vehicles ?? []).filter((v) => v.dnvtStatus === "valid").length}/${overview?.vehicles.length ?? 0}`}
                  sub="Controlo por viatura"
                />
                <Stat
                  label="Viagens c/ Inspeção Vazio"
                  value={(overview?.trips ?? []).filter((t) => t.emptyBusSweepVerified).length + syncState.sweepLogs.length}
                  sub="Verificação anti-esquecimento"
                  accent
                />
                <Stat label="Proprietários Verificados" value={overview?.vehicleOwners.length ?? 0} sub="Frota própria & parceiros" />
              </div>

              <Table head={["Autocarro", "Matrícula", "Estado DNVT", "Validade DNVT", "Seguradora", "Estado Seguro"]}>
                {(overview?.vehicles ?? []).map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-bold text-white">Autocarro {v.fleetNumber}</td>
                    <td className="p-3.5 font-mono">{v.plate}</td>
                    <td className="p-3.5"><StatusBadge s={v.dnvtStatus === "valid" ? "Válido" : "A renovar"} /></td>
                    <td className="p-3.5 font-mono text-slide-dim">{v.dnvtExpiry}</td>
                    <td className="p-3.5 text-slide-dim">{v.insuranceProvider}</td>
                    <td className="p-3.5"><StatusBadge s={v.insuranceStatus === "valid" || v.insuranceStatus === "active" ? "Válido" : "Pendente"} /></td>
                  </tr>
                ))}
              </Table>
            </div>
          )}

          {/* ================= EMERGÊNCIAS ================= */}
          {tab === "Emergências" && (
            <div className="space-y-4">
              {(overview?.incidents ?? []).length === 0 ? (
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-6 text-center text-xs text-slide-dim">
                  Sem ocorrências ou desvios registados.
                </div>
              ) : (
                (overview?.incidents ?? []).map((inc) => {
                  const isClosed = inc.status === "resolved" || inc.status === "closed";
                  const isAcknowledged = inc.status === "acknowledged";
                  const formattedTime = (() => {
                    const ms = Date.parse(inc.createdAt);
                    if (!Number.isFinite(ms)) return "—";
                    return new Date(ms).toLocaleString("pt-AO", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  })();
                  const statusLabel =
                    inc.status === "new"
                      ? "Novo"
                      : inc.status === "acknowledged"
                      ? "Reconhecido"
                      : inc.status === "in_progress"
                      ? "Em Tratamento"
                      : isClosed
                      ? "Resolvida"
                      : inc.status;
                  return (
                    <div
                      key={inc.id}
                      className={`rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 border ${
                        isClosed
                          ? "bg-slide-surface border-white/10"
                          : isAcknowledged
                          ? "bg-slide-surface border-emerald-500/40"
                          : "bg-slide-accent/15 border-slide-accent/50"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-[260px]">
                        <div className="font-bold text-sm text-white flex flex-wrap items-center gap-2">
                          <HeartPulse className="w-4 h-4 text-slide-accent shrink-0" />
                          <span>{inc.reason ? `Desvio / Trânsito · ${inc.reason}` : inc.category}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slide-bg border border-white/10">
                            {inc.severity}
                          </span>
                          <StatusBadge s={statusLabel} />
                        </div>
                        <p className="text-xs text-slide-paper">
                          {inc.notes ? inc.notes : inc.description}
                        </p>
                        <div className="text-[11px] text-slide-dim flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Viagem: <strong className="text-white font-mono">{inc.tripCode || (inc.tripId ? `#${inc.tripId}` : "—")}</strong>
                          </span>
                          <span>
                            Rota: <strong className="text-white">{inc.routeCode || "—"}{inc.routeName ? ` (${inc.routeName})` : ""}</strong>
                          </span>
                          <span>
                            Motorista: <strong className="text-white">{inc.driverName || inc.reporterName}</strong>
                          </span>
                          <span>
                            Motivo: <strong className="text-white">{inc.reason || inc.category}</strong>
                          </span>
                          <span className="tabular-nums">
                            Hora: <strong className="text-white">{formattedTime}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {!isClosed ? (
                          <>
                            {inc.status === "new" && rolePerms.canManageIncidents && (
                              <button
                                onClick={() => void handleIncidentStatus(inc.id, "acknowledged")}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 text-xs font-bold cursor-pointer"
                              >
                                Reconhecer
                              </button>
                            )}
                            {rolePerms.canManageIncidents && (
                              <>
                                <button
                                  onClick={() => void handleIncidentStatus(inc.id, "in_progress")}
                                  className="px-3 py-1.5 rounded-xl bg-slide-surface border border-white/15 text-xs font-semibold cursor-pointer"
                                >
                                  Em Tratamento
                                </button>
                                <button
                                  onClick={() => void handleIncidentStatus(inc.id, "resolved")}
                                  className="px-3 py-1.5 rounded-xl bg-slide-ok text-white text-xs font-bold cursor-pointer"
                                >
                                  Resolver
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <StatusBadge s="Resolvida" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ================= RELATÓRIOS ================= */}
          {tab === "Relatórios" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slide-dim mb-1">Data inicial</label>
                  <input
                    type="date"
                    value={reportFromDate}
                    onChange={(e) => setReportFromDate(e.target.value)}
                    className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slide-dim mb-1">Data final</label>
                  <input
                    type="date"
                    value={reportToDate}
                    onChange={(e) => setReportToDate(e.target.value)}
                    className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                  />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="block text-[11px] font-semibold text-slide-dim mb-1">Filtrar por escola</label>
                  <select
                    value={reportSchoolId}
                    onChange={(e) =>
                      setReportSchoolId(e.target.value === "all" ? "all" : Number(e.target.value))
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                  >
                    <option value="all">Todas as escolas</option>
                    {(overview?.schools ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {(reportFromDate || reportToDate || reportSchoolId !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setReportFromDate("");
                      setReportToDate("");
                      setReportSchoolId("all");
                    }}
                    className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-xs font-semibold text-slide-dim hover:text-white cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(
                  [
                    {
                      key: "students",
                      title: "Alunos (Escola, Rota e Paragem)",
                      desc: "Diretório nominal com escola, corredor, paragem e encarregado (sem códigos PIN).",
                      Icon: GraduationCap,
                    },
                    {
                      key: "trips",
                      title: "Viagens e Atrasos",
                      desc: "Data do serviço, rota, motorista, viatura, estado operacional e desvios/atrasos.",
                      Icon: Bus,
                    },
                    {
                      key: "attendance",
                      title: "Presenças (Embarque e Desembarque)",
                      desc: "Eventos de embarque e entrega agrupados por aluno e por dia.",
                      Icon: ClipboardList,
                    },
                    {
                      key: "invoices",
                      title: "Faturas e Pagamentos",
                      desc: "Registo contabilístico com referências MCX, conciliação e estado fiscal.",
                      Icon: FileSpreadsheet,
                    },
                    {
                      key: "incidents",
                      title: "Ocorrências e Emergências",
                      desc: "Auditoria completa de incidentes, desvios, responsáveis e resoluções.",
                      Icon: Radio,
                    },
                    {
                      key: "vehicles-drivers",
                      title: "Viaturas e Motoristas (Validades)",
                      desc: "Frota e motoristas com datas de validade de DNVT, seguros e cartas de condução.",
                      Icon: UserCheck,
                    },
                    {
                      key: "payroll",
                      title: "Folha Salarial (Motoristas)",
                      desc: "Compensação mensal, viagens realizadas no período e estado operacional.",
                      Icon: CreditCard,
                    },
                  ] as const
                ).map((r) => {
                  const ReportIcon = r.Icon;
                  const isBusy = downloadingReportKey === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDownloadReport(r.key, r.title)}
                      className="rounded-2xl bg-slide-surface p-5 text-left hover:border-slide-accent/60 transition cursor-pointer border border-white/10 flex flex-col justify-between disabled:opacity-60"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slide-bg border border-white/10 text-slide-accent grid place-items-center mb-3">
                          <ReportIcon className="w-5 h-5" />
                        </div>
                        <div className="text-sm font-bold text-white">{r.title}</div>
                        <div className="text-xs text-slide-dim mt-2">{r.desc}</div>
                      </div>
                      <div className="text-xs mt-4 pt-3 border-t border-white/10 flex justify-between text-slide-accent font-bold">
                        <span>{isBusy ? "A gerar CSV no servidor..." : "Descarregar"}</span>
                        <span className="font-mono">CSV</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= SISTEMA & ACESSOS (NEW TAB 10) ================= */}
          {tab === "Sistema & Acessos" && (
            <div className="space-y-6">
              <Card
                title={`Utilizadores & Perfis RBAC (${overview?.staffUsers.length ?? 0})`}
                action={
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-slide-dim flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slide-accent" />
                      <span>{capabilities.canManageRbac ? "Super Admin: Edição Ativa" : "Registo Exclusivo Admin"}</span>
                    </span>
                    {(capabilities.canManageRbac ||
                      dbUser?.primaryRole === "operations_manager" ||
                      dbUser?.primaryRole === "school_account_manager") && (
                      <button
                        type="button"
                        onClick={() => setUserModalOpen(true)}
                        className="rounded-xl bg-slide-accent text-white px-3.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Criar Nova Conta</span>
                      </button>
                    )}
                  </div>
                }
              >
                <div className="mb-3 rounded-xl bg-slide-bg border border-white/10 p-3 text-[11px] text-slide-dim">
                  Registo fechado: utilizadores que descarregam a app não podem criar contas próprias. Apenas contas criadas aqui têm acesso autenticado ao sistema.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-[11px] text-slide-dim border-b border-white/10">
                        <th className="p-3">Utilizador</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Perfil RBAC</th>
                        <th className="p-3">Escola (se school_admin)</th>
                        <th className="p-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {(overview?.staffUsers ?? []).map((u) => (
                        <tr key={u.id}>
                          <td className="p-3 font-bold text-white">
                            <div>{u.fullName}</div>
                            {u.username && (
                              <div className="text-[10px] font-mono text-slide-accent font-semibold">@{u.username}</div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-slide-dim">{u.email}</td>
                          <td className="p-3">
                            <select
                              disabled={!capabilities.canManageRbac}
                              value={u.primaryRole}
                              onChange={(e) => void handleUpdateUserRole(u.id, e.target.value as MoBussRole, u.schoolId)}
                              className="rounded-lg bg-slide-bg border border-white/10 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                            >
                              {(Object.keys(ROLE_LABELS) as MoBussRole[]).map((roleKey) => (
                                <option key={roleKey} value={roleKey}>
                                  {ROLE_LABELS[roleKey]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            {u.primaryRole === "school_admin" ? (
                              <select
                                disabled={!capabilities.canManageRbac}
                                value={u.schoolId ?? ""}
                                onChange={(e) =>
                                  void handleUpdateUserRole(u.id, u.primaryRole, Number(e.target.value) || null)
                                }
                                className="rounded-lg bg-slide-bg border border-white/10 px-2.5 py-1.5 text-xs text-white"
                              >
                                <option value="">Selecionar escola...</option>
                                {(overview?.schools ?? []).map((sc) => (
                                  <option key={sc.id} value={sc.id}>
                                    {sc.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slide-dim">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  !u.active
                                    ? "bg-red-500/20 text-red-300"
                                    : u.uid.startsWith("pending:")
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {!u.active ? "Desativada" : u.uid.startsWith("pending:") ? "Aguarda 1º Login Google" : "Ativa"}
                              </span>
                              {capabilities.canManageRbac && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingUser({
                                      id: u.id,
                                      fullName: u.fullName,
                                      username: u.username ?? "",
                                      email: u.email,
                                      phone: u.phone ?? "",
                                      primaryRole: u.primaryRole,
                                      schoolId: u.schoolId ?? "",
                                      active: u.active,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-slide-bg border border-white/15 text-[10px] font-semibold cursor-pointer hover:bg-white/10 inline-flex items-center gap-1"
                                >
                                  <Pencil className="w-2.5 h-2.5 text-emerald-300" />
                                  <span>Editar</span>
                                </button>
                              )}
                              {capabilities.canManageRbac && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPasswordTargetUser({ id: u.id, label: u.username || u.email });
                                    setResetPasswordInput("");
                                  }}
                                  className="px-2 py-0.5 rounded bg-slide-bg border border-white/15 text-[10px] font-semibold cursor-pointer hover:bg-white/10"
                                >
                                  Senha
                                </button>
                              )}
                              {capabilities.canManageRbac && dbUser?.id !== u.id && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleUserStatus(u.id, !u.active)}
                                    className="px-2 py-0.5 rounded bg-slide-bg border border-white/15 text-[10px] font-semibold cursor-pointer hover:bg-white/10"
                                  >
                                    {u.active ? "Desativar" : "Reativar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteUserTarget({
                                        id: u.id,
                                        label: u.fullName,
                                        email: u.username ? `@${u.username} (${u.email})` : u.email,
                                      })
                                    }
                                    className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] font-semibold cursor-pointer hover:bg-red-500/20 inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>Eliminar</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div id="admin-audit-log-section">
                <Card title="Trilha de Auditoria Imutável (PostgreSQL)">
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {(overview?.auditLogs ?? []).map((log) => {
                      const formatted = formatAuditActivity(log);
                      return (
                        <div key={log.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs flex flex-wrap justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white">{formatted.title}</span>
                              <span className="font-mono text-[10px] text-slide-accent font-semibold">{log.action}</span>
                            </div>
                            <div className="text-slide-paper/90">{log.summary}</div>
                            <div className="text-[11px] text-slide-dim">
                              Ator: {formatted.actorDisplay} ({formatted.actorRoleDisplay}) · Alvo: {formatted.targetDisplay}
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-slide-dim tabular-nums whitespace-nowrap">
                            {formatted.fullDateTimeLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Modal: Novo Contrato */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Registar Novo Contrato Escolar</h3>
              <button onClick={() => setContractModalOpen(false)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateContract} className="space-y-3 text-xs">
              <input
                required
                value={newSchool}
                onChange={(e) => setNewSchool(e.target.value)}
                placeholder="Nome da Escola Parceira"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Município"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
                <select
                  value={newPayerModel}
                  onChange={(e) => setNewPayerModel(e.target.value as "school" | "parent" | "mixed")}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="school">Escola Paga</option>
                  <option value="parent">Encarregados Pagam</option>
                  <option value="mixed">Misto (Escola + Pais)</option>
                </select>
                <select
                  value={newServiceModel}
                  onChange={(e) => setNewServiceModel(e.target.value as "software" | "full_service")}
                  aria-label="Modelo de serviço"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="software">Software (Frota Escola)</option>
                  <option value="full_service">Serviço Completo MôBus</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim block mb-1">Autocarros / Motoristas</label>
                  <input
                    type="number"
                    min={1}
                    value={newBuses}
                    onChange={(e) => {
                      const b = Math.max(1, Number(e.target.value) || 1);
                      setNewBuses(b);
                      setNewMonthlyAoa(
                        newStudents * pricingDraft.studentMonthlyFee + b * pricingDraft.driverMonthlyFee
                      );
                    }}
                    placeholder="Autocarros"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim block mb-1">Alunos Cobertos</label>
                  <input
                    type="number"
                    min={1}
                    value={newStudents}
                    onChange={(e) => {
                      const s = Math.max(1, Number(e.target.value) || 1);
                      setNewStudents(s);
                      setNewMonthlyAoa(
                        s * pricingDraft.studentMonthlyFee + newBuses * pricingDraft.driverMonthlyFee
                      );
                    }}
                    placeholder="Alunos"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim block mb-1">Valor Mensal (Kz)</label>
                  <input
                    type="number"
                    min={1000}
                    value={newMonthlyAoa}
                    onChange={(e) => setNewMonthlyAoa(Number(e.target.value) || 0)}
                    placeholder="Valor Mensal (Kz)"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slide-dim font-mono tabular-nums">
                Cálculo automático: ({newStudents} alunos × {formatAOA(pricingDraft.studentMonthlyFee)}) + ({newBuses} motoristas × {formatAOA(pricingDraft.driverMonthlyFee)}) = {formatAOA(newStudents * pricingDraft.studentMonthlyFee + newBuses * pricingDraft.driverMonthlyFee)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="Contacto / Diretor"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Telefone"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <button type="submit" className="w-full rounded-xl bg-slide-accent text-white py-3 font-bold cursor-pointer">
                Guardar Contrato em PostgreSQL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Proprietário Parceiro */}
      {ownerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Novo Proprietário Parceiro</h3>
              <button onClick={() => setOwnerModalOpen(false)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateVehicleOwner} className="space-y-3 text-xs">
              <input
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Nome completo / Sociedade parceira"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
              />
              <input
                required
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Telefone (+244 9xx xxx xxx)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
              />
              <input
                value={ownerNif}
                onChange={(e) => setOwnerNif(e.target.value)}
                placeholder="NIF (Opcional)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={ownerSettlementModel}
                  onChange={(e) => setOwnerSettlementModel(e.target.value as "monthly_fixed" | "per_trip")}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                >
                  <option value="monthly_fixed">Mensalidade Fixa</option>
                  <option value="per_trip">Por Viagem</option>
                </select>
                <input
                  type="number"
                  value={ownerMonthlyAoa}
                  onChange={(e) => setOwnerMonthlyAoa(Number(e.target.value) || 0)}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <button type="submit" className="w-full rounded-xl bg-slide-accent text-white py-3 font-bold cursor-pointer">
                Registar Proprietário Parceiro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reconcile Invoice */}
      {reconcileInvoiceId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleReconcileInvoice}
            className="w-full max-w-sm rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4 text-xs"
          >
            <h3 className="text-base font-black text-white">Conciliar Pagamento Manualmente</h3>
            <p className="text-slide-dim">Introduza a referência confirmada pelo banco / EMIS para liquidar o documento:</p>
            <input
              required
              value={reconcileRef}
              onChange={(e) => setReconcileRef(e.target.value)}
              placeholder="Ex: CONC-00845-849201"
              className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-slide-ok text-white py-2.5 font-bold cursor-pointer">
                Confirmar Conciliação
              </button>
              <button
                type="button"
                onClick={() => setReconcileInvoiceId(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Criar Nova Conta (Exclusivo Admin) */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Criar Conta Oficial MôBus</h3>
              <button onClick={() => setUserModalOpen(false)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slide-dim">
              Indique uma palavra-passe inicial para acesso por E-mail/Palavra-passe ou deixe em branco para autorizar o acesso via Google com este e-mail.
            </p>
            <form onSubmit={handleCreateUserAccount} className="space-y-3 text-xs">
              <input
                required
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="Nome completo (ex: Ana Domingos)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  type="text"
                  autoCapitalize="none"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Utilizador ou e-mail oficial"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
                <input
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="Telefone (+244 9xx xxx xxx)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as MoBussRole)}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  {(Object.keys(ROLE_LABELS) as MoBussRole[])
                    .filter((roleKey) =>
                      capabilities.canManageRbac
                        ? true
                        : ["parent_guardian", "driver", "school_admin", "vehicle_owner"].includes(roleKey)
                    )
                    .map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {ROLE_LABELS[roleKey]}
                      </option>
                    ))}
                </select>
                <input
                  type="password"
                  minLength={6}
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Palavra-passe inicial (opcional p/ Google)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
              </div>

              {newUserRole === "school_admin" && (
                <select
                  value={newUserSchoolId}
                  onChange={(e) => setNewUserSchoolId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="">Selecionar escola associada...</option>
                  {(overview?.schools ?? []).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              )}

              {newUserRole === "driver" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={newUserDriverEmployer}
                    onChange={(e) => setNewUserDriverEmployer(e.target.value as "school" | "mobuss")}
                    className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="school">Empregador: Escola</option>
                    <option value="mobuss">Empregador: MôBus</option>
                  </select>
                  {newUserDriverEmployer === "school" && (
                    <select
                      required
                      value={newUserSchoolId}
                      onChange={(e) => setNewUserSchoolId(e.target.value ? Number(e.target.value) : "")}
                      className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="">Selecionar escola empregadora...</option>
                      {(overview?.schools ?? []).map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {newUserRole === "parent_guardian" && (
                <select
                  value={newUserStudentId}
                  onChange={(e) => setNewUserStudentId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="">Vincular a educando existente (opcional)...</option>
                  {(overview?.students ?? []).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} · {st.schoolName} ({st.routeCode})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="submit"
                disabled={creatingUser}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {creatingUser ? "A criar conta no servidor..." : "Criar Conta Autorizada"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Definir / Atualizar Palavra-passe (Super Admin) */}
      {passwordTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleResetUserPassword}
            className="w-full max-w-sm rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4 text-xs"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">Definir Palavra-passe</h3>
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="p-1.5 rounded-full bg-slide-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slide-dim">
              Introduza a nova palavra-passe para <strong className="text-white">{passwordTargetUser.label}</strong> (mínimo 6 caracteres):
            </p>
            <input
              required
              type="password"
              minLength={6}
              value={resetPasswordInput}
              onChange={(e) => setResetPasswordInput(e.target.value)}
              placeholder="Nova palavra-passe"
              className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex-1 rounded-xl bg-slide-ok text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? "A guardar..." : "Guardar Palavra-passe"}
              </button>
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Editar Conta de Utilizador (Super Admin) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Editar Conta de Utilizador</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUserEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nome Completo</label>
                <input
                  required
                  value={editingUser.fullName}
                  onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Utilizador (opcional)</label>
                  <input
                    autoCapitalize="none"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    placeholder="ex: admin"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">E-mail</label>
                  <input
                    required
                    type="email"
                    autoCapitalize="none"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Telefone</label>
                  <input
                    value={editingUser.phone}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    placeholder="+244 9xx xxx xxx"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Perfil RBAC</label>
                  <select
                    value={editingUser.primaryRole}
                    disabled={dbUser?.id === editingUser.id}
                    onChange={(e) => setEditingUser({ ...editingUser, primaryRole: e.target.value as MoBussRole })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none disabled:opacity-50"
                  >
                    {(Object.keys(ROLE_LABELS) as MoBussRole[]).map((roleKey) => (
                      <option key={roleKey} value={roleKey}>
                        {ROLE_LABELS[roleKey]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {editingUser.primaryRole === "school_admin" && (
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola Associada</label>
                  <select
                    value={editingUser.schoolId}
                    onChange={(e) => setEditingUser({ ...editingUser, schoolId: e.target.value ? Number(e.target.value) : "" })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="">Selecionar escola...</option>
                    {(overview?.schools ?? []).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-slide-dim cursor-pointer">
                <input
                  type="checkbox"
                  disabled={dbUser?.id === editingUser.id}
                  checked={editingUser.active}
                  onChange={(e) => setEditingUser({ ...editingUser, active: e.target.checked })}
                />
                <span>Conta ativa com acesso permitido</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingUserEdit}
                  className="flex-1 rounded-xl bg-slide-ok text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
                >
                  {savingUserEdit ? "A guardar..." : "Guardar Alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminação de Conta */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-red-500/35 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Eliminar Conta Permanentemente</span>
            </div>
            <p className="text-slide-dim leading-relaxed">
              Tem a certeza que pretende eliminar a conta de <strong className="text-white">{deleteUserTarget.label}</strong> ({deleteUserTarget.email})? O acesso será revogado de imediato.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deletingUser}
                onClick={() => void handleConfirmDeleteUser()}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingUser ? "A eliminar..." : "Confirmar Eliminação"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Detalhes do Educando */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Editar Dados do Educando</h3>
              <button type="button" onClick={() => setEditingStudent(null)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveStudentEdit} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nome Completo do Aluno</label>
                <input
                  required
                  value={editingStudent.fullName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, fullName: e.target.value })}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola</label>
                  <select
                    value={editingStudent.schoolId}
                    onChange={(e) => setEditingStudent({ ...editingStudent, schoolId: Number(e.target.value) })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    {(overview?.schools ?? []).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Corredor / Rota</label>
                  <input
                    required
                    value={editingStudent.routeCode}
                    onChange={(e) => setEditingStudent({ ...editingStudent, routeCode: e.target.value })}
                    placeholder="ROTA-A"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slide-dim font-semibold block mb-1">Paragem de Recolha / Entrega</label>
                <input
                  required
                  value={editingStudent.stopName}
                  onChange={(e) => setEditingStudent({ ...editingStudent, stopName: e.target.value })}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Turno</label>
                  <select
                    value={editingStudent.shift}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, shift: e.target.value as "morning" | "afternoon" | "both" })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="both">Manhã + Tarde</option>
                    <option value="morning">Manhã</option>
                    <option value="afternoon">Tarde</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Estado Matrícula</label>
                  <select
                    value={editingStudent.enrollmentStatus}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        enrollmentStatus: e.target.value as "active" | "pending_approval" | "suspended",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="active">Ativo</option>
                    <option value="pending_approval">Pendente</option>
                    <option value="suspended">Suspenso</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Política PIN</label>
                  <select
                    value={editingStudent.pinPolicy}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        pinPolicy: e.target.value as "boarding" | "dropoff" | "both",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="both">Embarque + Desembarque</option>
                    <option value="boarding">Só Embarque</option>
                    <option value="dropoff">Só Desembarque</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Encarregado</label>
                  <input
                    value={editingStudent.guardianName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardianName: e.target.value })}
                    placeholder="Nome do encarregado"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Telefone Encarregado</label>
                  <input
                    value={editingStudent.guardianPhone}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardianPhone: e.target.value })}
                    placeholder="+244 9xx xxx xxx"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingStudent}
                  className="flex-1 rounded-xl bg-slide-ok text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
                >
                  {savingStudent ? "A guardar..." : "Guardar Dados do Aluno"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Remoção de Educando */}
      {deleteStudentTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-red-500/35 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Remover Educando da Pauta</span>
            </div>
            <p className="text-slide-dim leading-relaxed">
              Tem a certeza que pretende remover <strong className="text-white">{deleteStudentTarget.fullName}</strong> ({deleteStudentTarget.schoolName})? Os registos de presença e credenciais PIN associados serão igualmente removidos.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deletingStudent}
                onClick={() => void handleConfirmDeleteStudent()}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingStudent ? "A remover..." : "Confirmar Remoção"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteStudentTarget(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registar Novo Educando (Admin) */}
      {newStudentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Registar Novo Educando</h3>
              <button type="button" onClick={() => setNewStudentModalOpen(false)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <input
                required
                value={newStudentForm.fullName}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, fullName: e.target.value })}
                placeholder="Nome completo do aluno"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  required
                  value={newStudentForm.schoolId}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, schoolId: Number(e.target.value) })}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="">Selecionar escola...</option>
                  {(overview?.schools ?? []).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  value={newStudentForm.routeCode}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, routeCode: e.target.value })}
                  placeholder="Rota (ex: ROTA-A)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <input
                required
                value={newStudentForm.stopName}
                onChange={(e) => setNewStudentForm({ ...newStudentForm, stopName: e.target.value })}
                placeholder="Paragem de embarque / entrega"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newStudentForm.shift}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, shift: e.target.value as "morning" | "afternoon" | "both" })}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="both">Manhã + Tarde</option>
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                </select>
                <select
                  value={newStudentForm.pinPolicy}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, pinPolicy: e.target.value as "boarding" | "dropoff" | "both" })}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                >
                  <option value="both">PIN Embarque + Desembarque</option>
                  <option value="boarding">Só Embarque</option>
                  <option value="dropoff">Só Desembarque</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={newStudentForm.guardianName}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, guardianName: e.target.value })}
                  placeholder="Nome do Encarregado (opcional)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                />
                <input
                  value={newStudentForm.guardianPhone}
                  onChange={(e) => setNewStudentForm({ ...newStudentForm, guardianPhone: e.target.value })}
                  placeholder="Telefone Encarregado"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={creatingStudent}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {creatingStudent ? "A registar..." : "Registar Educando & Gerar PIN"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Viatura */}
      {vehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">{editingVehicleId ? "Editar Viatura da Frota" : "Registar Nova Viatura"}</h3>
              <button
                type="button"
                onClick={() => {
                  setVehicleModalOpen(false);
                  setEditingVehicleId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nº Frota</label>
                  <input
                    required
                    type="number"
                    min={1}
                    disabled={Boolean(editingVehicleId)}
                    value={vehicleForm.fleetNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fleetNumber: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Matrícula</label>
                  <input
                    required
                    value={vehicleForm.plate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                    placeholder="LD-99-88-AB"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono uppercase outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Tipo de Propriedade</label>
                  <select
                    value={vehicleForm.ownershipType}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        ownershipType: e.target.value as "school_owned" | "mobuss_owned" | "partner_owned",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="school_owned">Própria da Escola</option>
                    <option value="mobuss_owned">Frota MôBus</option>
                    <option value="partner_owned">Parceiro Independente</option>
                  </select>
                </div>
                {vehicleForm.ownershipType === "school_owned" ? (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola Proprietária</label>
                    <select
                      required
                      value={vehicleForm.assignedSchoolId}
                      onChange={(e) =>
                        setVehicleForm({
                          ...vehicleForm,
                          assignedSchoolId: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="">Selecionar escola...</option>
                      {(overview?.schools ?? []).map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Proprietário</label>
                    <select
                      required
                      value={vehicleForm.ownerId}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, ownerId: Number(e.target.value) })}
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="">Selecionar proprietário...</option>
                      {(overview?.vehicleOwners ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Corredor / Rota</label>
                  <input
                    required
                    value={vehicleForm.routeCode}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, routeCode: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                {vehicleForm.ownershipType !== "school_owned" ? (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola Atribuída (opc.)</label>
                    <select
                      value={vehicleForm.assignedSchoolId}
                      onChange={(e) =>
                        setVehicleForm({
                          ...vehicleForm,
                          assignedSchoolId: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="">Sem escola fixa</option>
                      {(overview?.schools ?? []).map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : editingVehicleId ? (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Estado Operacional</label>
                    <select
                      value={vehicleForm.status}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="available">Disponível</option>
                      <option value="assigned">Alocada</option>
                      <option value="maintenance">Manutenção</option>
                      <option value="suspended">Suspensa</option>
                    </select>
                  </div>
                ) : (
                  <div />
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Lugares</label>
                  <input
                    type="number"
                    min={8}
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) || 22 })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Validade DNVT</label>
                  <input
                    required
                    value={vehicleForm.dnvtExpiry}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, dnvtExpiry: e.target.value })}
                    placeholder="2027-12-31"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Estado DNVT</label>
                  <select
                    value={vehicleForm.dnvtStatus}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, dnvtStatus: e.target.value as "valid" | "expiring_soon" | "expired" })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="valid">Válido</option>
                    <option value="expiring_soon">A expirar</option>
                    <option value="expired">Expirado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Seguradora</label>
                  <input
                    value={vehicleForm.insuranceProvider}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceProvider: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Estado Seguro</label>
                  <select
                    value={vehicleForm.insuranceStatus}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceStatus: e.target.value as "valid" | "pending" | "expired" })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="valid">Válido</option>
                    <option value="pending">Pendente</option>
                    <option value="expired">Expirado</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingVehicle}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {savingVehicle ? "A guardar..." : editingVehicleId ? "Guardar Alterações da Viatura" : "Registar Viatura"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Motorista */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">Editar Dados do Motorista</h3>
              <button type="button" onClick={() => setEditingDriver(null)} className="p-1.5 rounded-full bg-slide-surface cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveDriverEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nome Completo</label>
                  <input
                    required
                    value={editingDriver.fullName}
                    onChange={(e) => setEditingDriver({ ...editingDriver, fullName: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Telefone</label>
                  <input
                    required
                    value={editingDriver.phone}
                    onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Empregador</label>
                  <select
                    value={editingDriver.employerType}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        employerType: e.target.value as "school" | "mobuss",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="school">Escola</option>
                    <option value="mobuss">MôBus</option>
                  </select>
                </div>
                {editingDriver.employerType === "school" ? (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola Empregadora</label>
                    <select
                      required
                      value={editingDriver.employerSchoolId}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          employerSchoolId: e.target.value ? Number(e.target.value) : "",
                        })
                      }
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="">Selecionar escola...</option>
                      {(overview?.schools ?? []).map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-slide-dim font-semibold block mb-1">Verificação</label>
                    <select
                      value={editingDriver.verificationStatus}
                      onChange={(e) =>
                        setEditingDriver({
                          ...editingDriver,
                          verificationStatus: e.target.value as "verified" | "suspended" | "pending",
                        })
                      }
                      className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                    >
                      <option value="verified">Verificado / Ativo</option>
                      <option value="suspended">Suspenso</option>
                      <option value="pending">Pendente</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Categoria Carta</label>
                  <input
                    value={editingDriver.licenceCategory}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceCategory: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nº Carta</label>
                  <input
                    value={editingDriver.licenceNumber}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceNumber: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Validade Carta</label>
                  <input
                    value={editingDriver.licenceExpiry}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceExpiry: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Disponibilidade</label>
                  <select
                    value={editingDriver.availabilityStatus}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        availabilityStatus: e.target.value as "in_service" | "available" | "off_duty",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="in_service">Em serviço</option>
                    <option value="available">Disponível</option>
                    <option value="off_duty">De folga</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Verificação</label>
                  <select
                    value={editingDriver.verificationStatus}
                    onChange={(e) =>
                      setEditingDriver({
                        ...editingDriver,
                        verificationStatus: e.target.value as "verified" | "suspended" | "pending",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="verified">Verificado / Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="pending">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Compensação Mensal (Kz)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingDriver.monthlyCompensationAoa}
                    onChange={(e) =>
                      setEditingDriver({ ...editingDriver, monthlyCompensationAoa: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingDriver}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {savingDriver ? "A guardar..." : "Guardar Dados do Motorista"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar / Editar Rota */}
      {routeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">{editingRouteId ? "Editar Rota Escolar" : "Criar Nova Rota"}</h3>
              <button
                type="button"
                onClick={() => {
                  setRouteModalOpen(false);
                  setEditingRouteId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {routeFormError && (
              <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 text-xs text-red-200">
                {routeFormError}
              </div>
            )}

            <form onSubmit={handleSaveRoute} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Código da Rota</label>
                  <input
                    required
                    value={routeForm.code}
                    onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value.toUpperCase() })}
                    placeholder="ROTA-E"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono uppercase outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nome da Rota</label>
                  <input
                    required
                    value={routeForm.name}
                    onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                    placeholder="Ex: Rota E · Benfica → Talatona"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Corredor (Opcional)</label>
                  <input
                    value={routeForm.corridor}
                    onChange={(e) => setRouteForm({ ...routeForm, corridor: e.target.value })}
                    placeholder="Ex: Benfica · Talatona"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola (Opcional)</label>
                  <select
                    value={routeForm.schoolId === "" ? "" : String(routeForm.schoolId)}
                    onChange={(e) => setRouteForm({ ...routeForm, schoolId: e.target.value ? Number(e.target.value) : "" })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="">Sem escola específica (Opcional)</option>
                    {(overview?.schools ?? []).map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slide-dim font-semibold block mb-1">
                  Coordenadas da Linha no Mapa (Opcional — 1 ponto por linha: lat, lng)
                </label>
                <textarea
                  rows={4}
                  value={routeForm.pathText}
                  onChange={(e) => setRouteForm({ ...routeForm, pathText: e.target.value })}
                  placeholder={"-8.838300, 13.234400\n-8.855000, 13.230000"}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slide-paper cursor-pointer">
                <input
                  type="checkbox"
                  checked={routeForm.active}
                  onChange={(e) => setRouteForm({ ...routeForm, active: e.target.checked })}
                />
                <span>Rota ativa para operação</span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={savingRoute}
                  className="flex-1 rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
                >
                  {savingRoute ? "A guardar..." : editingRouteId ? "Guardar Alterações da Rota" : "Criar Rota na Base de Dados"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRouteModalOpen(false);
                    setEditingRouteId(null);
                  }}
                  className="rounded-xl bg-slide-surface px-4 py-3 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agendar / Editar Escala Recorrente */}
      {routeScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black">
                {editingScheduleId ? "Editar Escala Recorrente" : "Agendar Rota Recorrente"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRouteScheduleModalOpen(false);
                  setEditingScheduleId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {scheduleError && (
              <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 text-xs text-red-200">
                {scheduleError}
              </div>
            )}
            <form onSubmit={handleSaveRouteSchedule} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Escola Contratada</label>
                  <select
                    required
                    value={scheduleForm.schoolId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        schoolId: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="">Selecionar escola...</option>
                    {selectableSchools.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Rota</label>
                  <select
                    required
                    value={scheduleForm.routeCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const found = allRoutes.find((r) => r.code === code);
                      setScheduleForm({
                        ...scheduleForm,
                        routeCode: code,
                        routeName: found?.name ?? code,
                      });
                    }}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    {allRoutes.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Viatura</label>
                  <select
                    value={scheduleForm.vehicleId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        vehicleId: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="">Por alocar</option>
                    {(overview?.vehicles ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        Autocarro {v.fleetNumber} ({v.plate})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Motorista</label>
                  <select
                    value={scheduleForm.driverId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        driverId: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="">Automático / Por alocar</option>
                    {(overview?.drivers ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slide-dim font-semibold block mb-1">Dias da Semana</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((w) => {
                    const checked = scheduleForm.days.includes(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() =>
                          setScheduleForm((prev) => ({
                            ...prev,
                            days: checked ? prev.days.filter((d) => d !== w.id) : [...prev.days, w.id],
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                          checked
                            ? "bg-slide-accent text-white border-slide-accent"
                            : "bg-slide-bg border-white/15 text-slide-dim"
                        }`}
                      >
                        {w.short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Turno</label>
                  <select
                    value={scheduleForm.shiftType}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        shiftType: e.target.value === "afternoon" ? "afternoon" : "morning",
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="morning">Manhã</option>
                    <option value="afternoon">Tarde</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Partida</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.departureTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, departureTime: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Chegada</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.arrivalTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, arrivalTime: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {savingSchedule ? "A guardar..." : editingScheduleId ? "Guardar Alterações" : "Agendar Escala"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Remover Escala Recorrente */}
      {deleteScheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-red-500/35 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-red-400 font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>Remover Escala Recorrente</span>
            </div>
            <p className="text-slide-dim leading-relaxed">
              Confirmar remoção da escala <strong className="text-white">{deleteScheduleTarget.routeCode}</strong> ({deleteScheduleTarget.schoolName})?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deletingSchedule}
                onClick={() => void handleConfirmDeleteSchedule()}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingSchedule ? "A remover..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteScheduleTarget(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardKpiCard({
  title,
  value,
  secondaryValue,
  subtitle,
  statusLabel,
  statusTone = "neutral",
  Icon,
  onClick,
}: {
  title: string;
  value: ReactNode;
  secondaryValue?: string;
  subtitle: string;
  statusLabel: string;
  statusTone?: "ok" | "warn" | "danger" | "neutral";
  Icon: LucideIcon;
  onClick: () => void;
}) {
  const toneText =
    statusTone === "danger"
      ? "text-slide-accent"
      : statusTone === "warn"
      ? "text-amber-400"
      : statusTone === "ok"
      ? "text-emerald-400"
      : "text-slide-dim";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl bg-slide-surface border border-white/10 hover:border-white/25 hover:bg-[#191a21] p-5 transition-all cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-slide-accent flex flex-col justify-between gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-10 h-10 rounded-xl bg-slide-bg border border-white/10 text-slide-accent grid place-items-center shrink-0 group-hover:border-slide-accent/40 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className={toneText}>{statusLabel}</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slide-dim group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-2.5">
          <span className="text-3xl font-black tracking-tight text-white tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
            {value}
          </span>
          {secondaryValue && (
            <span className="text-xs font-semibold text-slide-dim tabular-nums">{secondaryValue}</span>
          )}
        </div>
        <div className="text-xs font-bold text-slide-paper mt-1">{title}</div>
        <div className="text-[11px] text-slide-dim mt-1 leading-snug">{subtitle}</div>
      </div>
    </button>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 border transition ${
        danger
          ? "bg-slide-accent text-white border-slide-accent"
          : accent
          ? "bg-slide-paper-ink text-slide-paper border-slide-accent/50"
          : "bg-slide-surface text-slide-paper border-white/10"
      }`}
    >
      <div className="text-3xl font-black tracking-tight tabular-nums">{value}</div>
      <div className="text-xs font-semibold opacity-80 mt-1">{label}</div>
      {sub && <div className="text-[11px] opacity-65 mt-1">{sub}</div>}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slide-surface p-5 border border-white/10">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="font-bold text-sm text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slide-surface overflow-x-auto border border-white/10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[11px] text-slide-dim border-b border-white/10 bg-white/[0.02]">
            {head.map((h) => (
              <th key={h} className="p-3.5 font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">{children}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const ok = ["Ativo", "Em serviço", "Disponível", "Válido", "Resolvida", "boarded", "handed_over", "active"].includes(s);
  const warn = ["Pedido", "Pendente", "A renovar", "expected", "pending"].includes(s);
  return (
    <span
      className={`text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
        ok ? "text-slide-ok" : warn ? "text-amber-400" : "text-slide-dim"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-slide-ok" : warn ? "bg-amber-400" : "bg-slide-dim"}`} />
      <span>{s}</span>
    </span>
  );
}
