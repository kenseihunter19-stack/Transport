import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Bus,
  Check,
  CheckCircle2,
  ClipboardList,
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
  Minus,
  Pencil,
  Phone,
  Plus,
  Presentation,
  Radio,
  RefreshCw,
  RotateCcw,
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
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { LuandaMap } from "@/components/LuandaMap";
import { AuthGatePanel } from "@/components/AuthGatePanel";
import { ROLE_LABELS, useAuth, type MoBussRole } from "@/contexts/AuthContext";
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket";
import { downloadCsv, downloadDocument } from "@/lib/operations";
import { LUANDA_ROUTES } from "@/lib/route-luanda";
import {
  clearHazardForBus,
  DEFAULT_PRICING,
  exportAgtReceipt,
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
    pinPolicy: string;
    busesAllocated: number;
    studentsCovered: number;
    monthlyValueAoa: number;
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
    monthlySettlementAoa: number;
    verificationStatus: string;
  }>;
  vehicles: Array<{
    id: number;
    fleetNumber: number;
    plate: string;
    ownerId: number;
    ownerName: string;
    assignedDriverId: number | null;
    driverName: string;
    routeCode: string;
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
    verificationStatus: string;
    ratingAvg: string;
    availabilityStatus: string;
    monthlyCompensationAoa: number;
    tripsCompleted: number;
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
    state: string;
    gpsStatus: string;
    emptyBusSweepVerified: boolean;
  }>;
  incidents: Array<{
    id: number;
    tripId: number | null;
    busNumber: number | null;
    routeCode: string | null;
    category: string;
    severity: string;
    description: string;
    reporterName: string;
    reporterRole: string;
    status: string;
    assignedToName: string | null;
    resolutionNotes: string | null;
    createdAt: string;
  }>;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
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
    schoolBusSingleShiftAoa: number;
    schoolBusDoubleShiftAoa: number;
    ivaPercent: number;
    companyName: string;
    companyNif: string;
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
}

const PAYER_LABELS: Record<string, string> = {
  school: "Escola Paga",
  parent: "Encarregados Pagam",
  mixed: "Misto (Escola + Pais)",
  configurable: "A Configurar",
};

interface AdminViewProps {
  onNavigate: (view: "mockup" | "admin" | "deck" | "landing" | "client" | "driver" | "school") => void;
}

export function AdminView({ onNavigate }: AdminViewProps) {
  const { isAuthenticated, dbUser, capabilities, loading: authLoading, apiFetch, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>("Painel");
  const [search, setSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route_a");
  const [progress, setProgress] = useState(0.42);

  // Real DB state & Health Probe
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [health, setHealth] = useState<{ dbConnected: boolean; latencyMs?: number }>({ dbConnected: false });

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
  const [newBuses, setNewBuses] = useState(2);
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("+244 923 000 000");
  const [newMonthlyAoa, setNewMonthlyAoa] = useState(700000);

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
    ownerId: "" as number | "",
    routeCode: "ROTA-A",
    capacity: 22,
    dnvtExpiry: "2027-12-31",
    dnvtStatus: "valid" as "valid" | "expiring_soon" | "expired",
    insuranceProvider: "ENSA Seguros de Angola",
    insuranceStatus: "valid" as "valid" | "pending" | "expired",
    status: "available",
  });
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Admin Edit Driver Modal
  const [editingDriver, setEditingDriver] = useState<{
    id: number;
    fullName: string;
    phone: string;
    licenceCategory: string;
    licenceNumber: string;
    licenceExpiry: string;
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
      setHealth({ dbConnected: Boolean(data.dbConnected), latencyMs: data.latencyMs });
    } catch {
      setHealth({ dbConnected: false });
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
          schoolBusSingleShift: data.pricing.schoolBusSingleShiftAoa,
          schoolBusDoubleShift: data.pricing.schoolBusDoubleShiftAoa,
          ivaPercent: data.pricing.ivaPercent,
          companyName: data.pricing.companyName,
          companyNif: data.pricing.companyNif,
          multicaixaEntityCode: data.pricing.multicaixaEntityCode || "00845",
          agtCertCode:
            data.pricing.fiscalIntegrationStatus === "sandbox_pending_agt_certification"
              ? "HOMOLOGAÇÃO / NÃO FISCAL AGT"
              : data.pricing.fiscalIntegrationStatus,
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
      const activeCfg = LUANDA_ROUTES[selectedRouteId] || LUANDA_ROUTES.route_a;
      if (routeCode === activeCfg.code) {
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
      event.type === "incident:created"
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
    const activeRoute = LUANDA_ROUTES[selectedRouteId] || LUANDA_ROUTES.route_a;
    try {
      const res = await apiFetch<{ simulation: { running: boolean; routeCode: string; progress: number; nearestStopName: string }; connectedClients: number }>(
        `/api/v1/simulation/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ routeCode: activeRoute.code }),
        }
      );
      setSimStatus(res.simulation);
      setSimConnectedClients(res.connectedClients);
      setProgress(res.simulation.progress);
      showToast(
        action === "start"
          ? `Simulação PostgreSQL + WebSocket iniciada na ${activeRoute.code}.`
          : action === "pause"
          ? "Simulação em pausa."
          : action === "step"
          ? `Autocarro avançou para ${res.simulation.nearestStopName}.`
          : `Simulação reiniciada na ${activeRoute.code}.`
      );
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao controlar simulação.");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink grid place-items-center text-xs text-slide-dim">
        A verificar sessão administrativa MôBuss...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGatePanel
        title="MôBuss Admin · Central de Operações"
        subtitle="Acesso exclusivo à equipa operacional, financeira e de segurança da MôBuss. Inicie sessão para gerir contratos, frota, proprietários parceiros e auditoria."
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
            O seu perfil atual (<strong>{dbUser ? ROLE_LABELS[dbUser.primaryRole] : "Utilizador"}</strong>) não possui permissões da equipa central MôBuss.
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
  const vehiclesList = (overview?.vehicles ?? []).filter(
    (v) =>
      v.plate.toLowerCase().includes(q) ||
      v.driverName.toLowerCase().includes(q) ||
      v.ownerName.toLowerCase().includes(q) ||
      v.routeCode.toLowerCase().includes(q)
  );
  const driversList = (overview?.drivers ?? []).filter(
    (d) => d.fullName.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q)
  );
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
  const openIncidentsCount = (overview?.incidents ?? []).filter(
    (i) => i.status !== "resolved" && i.status !== "closed"
  ).length;
  const pendingLeadsCount = (overview?.contractRequests ?? []).filter(
    (r) => r.status === "request_received" || r.status === "under_review"
  ).length;
  const activeContractsCount = (overview?.contracts ?? []).filter((c) => c.status === "active").length;
  const busesOnRoadCount = (overview?.vehicles ?? []).filter((v) => v.status === "assigned").length;

  async function handleSavePricing() {
    try {
      await apiFetch("/api/v1/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({
          studentMonthlyFeeAoa: pricingDraft.studentMonthlyFee,
          schoolBusSingleShiftAoa: pricingDraft.schoolBusSingleShift,
          schoolBusDoubleShiftAoa: pricingDraft.schoolBusDoubleShift,
          ivaPercent: pricingDraft.ivaPercent,
          companyName: pricingDraft.companyName,
          companyNif: pricingDraft.companyNif,
          multicaixaEntityCode: pricingDraft.multicaixaEntityCode || "00845",
        }),
      });
      updatePricingConfig(pricingDraft);
      showToast(`Tarifário guardado em PostgreSQL: ${formatAOA(pricingDraft.studentMonthlyFee)}/mês.`);
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
          busesAllocated: newBuses,
          studentsCovered: newBuses * 25,
          monthlyValueAoa: newMonthlyAoa,
          contactName: newContact.trim() || "Direcção Escolar",
          contactPhone: newPhone.trim(),
        }),
      });
      setContractModalOpen(false);
      setNewSchool("");
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
          schoolId: newUserRole === "school_admin" && newUserSchoolId ? Number(newUserSchoolId) : null,
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
    const resolvedOwnerId = Number(vehicleForm.ownerId || overview?.vehicleOwners[0]?.id || 0);
    if (!resolvedOwnerId) {
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
            ownerId: resolvedOwnerId,
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
            ownerId: resolvedOwnerId,
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

  function handleDownloadReport(name: string) {
    if (name === "Pauta Diária de Presenças e Desembarque") {
      downloadCsv("mobuss-pauta-presencas-oficial.csv", [
        ["Aluno", "Escola", "Corredor", "Paragem", "Encarregado", "Política PIN", "PIN", "Estado"],
        ...(overview?.students ?? []).map((s) => [
          s.fullName,
          s.schoolName,
          s.routeCode,
          s.stopName,
          s.guardianName,
          "Embarque + Desembarque",
          "•••• (Mascarado)",
          s.currentJourneyState,
        ]),
      ]);
    } else if (name === "Livro de Faturas Multicaixa Express (Homologação)") {
      downloadCsv("mobuss-faturas-homologacao.csv", [
        ["Nº Documento", "Aluno", "Encarregado", "Valor (Kz)", "Ref. Provedor", "Estado", "Estado Fiscal"],
        ...(overview?.invoices ?? []).map((inv) => [
          inv.invoiceNumber,
          inv.studentName,
          inv.guardianName,
          inv.amountAoa,
          inv.providerReference ?? "A aguardar provedor",
          inv.status,
          inv.fiscalStatus,
        ]),
      ]);
    } else if (name === "Relatório de folha de salários (Motoristas)") {
      downloadCsv("mobuss-folha-salarios.csv", [
        ["Motorista", "Contacto", "Habilitação", "Avaliação", "Viagens Mês", "Salário Bruto (Kz)", "Estado"],
        ...(overview?.drivers ?? []).map((d) => [
          d.fullName,
          d.phone,
          d.licenceCategory,
          d.ratingAvg,
          d.tripsCompleted,
          d.monthlyCompensationAoa,
          d.availabilityStatus,
        ]),
      ]);
    } else if (name === "Relatório mensal de viagens") {
      downloadCsv("mobuss-viagens-ativas.csv", [
        ["Código Viagem", "Rota", "Turno", "Estado", "GPS", "Inspeção Anti-Esquecimento"],
        ...(overview?.trips ?? []).map((t) => [
          t.tripCode,
          t.routeName,
          t.legType,
          t.state,
          t.gpsStatus,
          t.emptyBusSweepVerified ? "Confirmada" : "Pendente",
        ]),
      ]);
    } else {
      downloadDocument(
        "Relatorio_Emergencias_MoBuss",
        (overview?.incidents ?? [])
          .map(
            (i) =>
              `• [${i.createdAt}] ${i.category} (${i.severity}) — Estado: ${i.status}\n  Descrição: ${i.description}\n  Reportado por: ${i.reporterName}`
          )
          .join("\n\n")
      );
    }
    showToast(`Ficheiro "${name}" exportado sem exposição de segredos.`);
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
              src="/assets/aistudio/20261117_030824_57b8de0b.jpg"
              alt="MôBuss Logo"
              className="w-9 h-9 rounded-lg object-cover bg-black border border-white/10"
            />
            <div>
              <div className="font-extrabold text-sm tracking-tight leading-none" style={{ fontFamily: "var(--font-display)" }}>
                MôBuss Admin
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

                  {id === "Emergências" && (openIncidentsCount + activeHazards.length > 0) && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-white/15 text-white">
                      {openIncidentsCount + activeHazards.length}
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

      {/* Mobile Tab Strip */}
      <div className="lg:hidden border-b border-white/10 bg-slide-paper-ink px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
        {ADMIN_TABS.map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition ${
              tab === id ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white bg-white/5"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{id}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-5 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-medium text-slide-dim flex items-center gap-2 flex-wrap">
              <span>Angola · Luanda</span>
              <span aria-hidden="true">·</span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${health.dbConnected ? "text-slide-ok" : "text-amber-400"}`}>
                <Database className="w-3.5 h-3.5" />
                <span>
                  {health.dbConnected
                    ? `PostgreSQL Online (${health.latencyMs ?? 0}ms)`
                    : "A verificar PostgreSQL..."}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className={`inline-flex items-center gap-1.5 font-semibold ${wsConnected ? "text-emerald-300" : "text-amber-300"}`}>
                <Radio className="w-3.5 h-3.5" />
                <span>{wsConnected ? `WS Ao Vivo (${simConnectedClients} cliente(s))` : "A ligar WS..."}</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slide-paper mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {tab}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slide-dim absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar frota, alunos, contratos..."
                className="rounded-xl bg-slide-surface pl-9 pr-4 py-2 text-xs text-slide-paper placeholder:text-slide-dim outline-none w-52 sm:w-64 border border-white/10 focus:border-slide-accent"
              />
            </div>

            <button
              onClick={() => {
                void checkHealth();
                void loadOverview();
              }}
              className="rounded-xl bg-slide-surface border border-white/10 px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-white/10"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </button>

            <div className="flex items-center gap-2 bg-slide-surface px-3 py-1.5 rounded-xl border border-white/10">
              <div className="w-7 h-7 rounded-lg bg-slide-accent text-white grid place-items-center font-black text-xs">
                {(dbUser?.fullName || "MB").slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-[11px] font-bold text-slide-paper leading-none">{dbUser?.fullName}</div>
                <div className="text-[10px] text-slide-dim mt-0.5">{dbUser ? ROLE_LABELS[dbUser.primaryRole] : ""}</div>
              </div>
            </div>
          </div>
        </header>

        <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
          {/* ================= PAINEL ================= */}
          {tab === "Painel" && (
            <div className="space-y-6">
              {activeHazards.length > 0 && (
                <div className="rounded-2xl bg-slide-accent/15 border border-slide-accent/40 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-slide-accent shrink-0" />
                    <div>
                      <div className="text-xs font-extrabold text-white">
                        Alerta de Via Reportado ({activeHazards[0]!.label})
                      </div>
                      <div className="text-xs text-slide-dim">
                        {activeHazards[0]!.driver} · {activeHazards[0]!.routeCode} · Autocarro {activeHazards[0]!.busNumber}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      clearHazardForBus(activeHazards[0]!.busNumber);
                      showToast("Alerta de via limpo.");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slide-surface text-xs font-semibold border border-white/10 cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat
                  label="Contratos Escolares Ativos"
                  value={activeContractsCount}
                  sub={pendingLeadsCount > 0 ? `${pendingLeadsCount} pedido(s) públicos por rever` : "Carteira PostgreSQL ativa"}
                />
                <Stat
                  label="Viaturas Alocadas"
                  value={`${busesOnRoadCount}/${overview?.vehicles.length ?? 0}`}
                  sub={`${overview?.vehicleOwners.length ?? 0} proprietário(s) registados`}
                  accent
                />
                <Stat
                  label="Educandos Monitorizados"
                  value={overview?.students.length ?? 0}
                  sub="Política PIN: Embarque + Desembarque"
                />
                <Stat
                  label="Ocorrências em Aberto"
                  value={openIncidentsCount}
                  sub={openIncidentsCount > 0 ? "Requer atenção" : "Sem incidentes abertos"}
                  danger={openIncidentsCount > 0}
                />
              </div>

              {/* Server-Backed Live Simulation Bar */}
              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <Radio className={`w-4 h-4 ${simStatus?.running ? "text-slide-ok animate-pulse" : "text-slide-accent"}`} />
                    <span>Simulação de Rota Real em PostgreSQL + WebSocket</span>
                  </div>
                  <div className="text-[11px] text-slide-dim mt-0.5">
                    {simStatus
                      ? `Rota ${simStatus.routeCode} · Progresso ${Math.round(simStatus.progress * 100)}% · Paragem próxima: ${simStatus.nearestStopName}`
                      : "Movimenta a viatura real no PostgreSQL e transmite GPS + alertas de 500m em tempo real a todas as apps."}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {simStatus?.running ? (
                    <button
                      onClick={() => void handleSimulationAction("pause")}
                      className="rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-1.5 font-bold cursor-pointer"
                    >
                      Pausar Simulação
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleSimulationAction("start")}
                      className="rounded-xl bg-slide-ok text-white px-3 py-1.5 font-bold cursor-pointer"
                    >
                      Iniciar Simulação Ao Vivo
                    </button>
                  )}
                  <button
                    onClick={() => void handleSimulationAction("step")}
                    className="rounded-xl bg-slide-bg border border-white/15 px-3 py-1.5 font-semibold cursor-pointer hover:bg-white/10"
                  >
                    +1 Passo (500m)
                  </button>
                  <button
                    onClick={() => void handleSimulationAction("reset")}
                    className="rounded-xl bg-slide-bg border border-white/15 px-3 py-1.5 font-semibold cursor-pointer hover:bg-white/10"
                  >
                    Reiniciar Rota
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
                <Card
                  title="Corredores de Luanda"
                  action={
                    <div className="flex items-center gap-1.5">
                      {Object.values(LUANDA_ROUTES).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRouteId(r.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            selectedRouteId === r.id
                              ? "bg-slide-accent text-white"
                              : "bg-slide-bg text-slide-dim border border-white/10"
                          }`}
                        >
                          {r.code}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <LuandaMap progress={progress} routeId={selectedRouteId} className="h-[360px] rounded-xl border border-white/10" />
                </Card>

                <Card title="Registo de Auditoria Recente (PostgreSQL)">
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {(overview?.auditLogs ?? []).slice(0, 10).map((log) => (
                      <div key={log.id} className="rounded-xl bg-slide-bg p-3 text-xs border border-white/10 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-slide-dim">
                          <span className="text-slide-accent font-bold">{log.action}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString("pt-AO")}</span>
                        </div>
                        <div className="text-slide-paper leading-snug">{log.summary}</div>
                      </div>
                    ))}
                  </div>
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
                  onClick={() => setContractModalOpen(true)}
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
              <Table head={["Contrato / Escola", "Município", "Modelo Pagador", "Política PIN", "Frota / Alunos", "Valor Mensal", "Estado"]}>
                {contractsList.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{c.schoolName}</div>
                      <div className="text-[11px] font-mono text-slide-dim">{c.contractNumber}</div>
                    </td>
                    <td className="p-3.5 text-slide-dim">{c.municipality}</td>
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
                      {formatAOA(c.monthlyValueAoa)}
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
                          {owner.ownerType === "mobuss_owned" ? "Frota MôBuss" : "Parceiro Independente"}
                        </span>
                      </div>
                      <div className="text-slide-dim font-mono text-[11px]">{owner.phone}</div>
                      <div className="text-[11px] text-slide-ok font-semibold">
                        Acerto: {formatAOA(owner.monthlySettlementAoa)} ({owner.settlementModel})
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex flex-wrap justify-between items-center gap-3">
                <span className="text-xs text-slide-dim">
                  Frota registada e alocação de motoristas verificados ({vehiclesList.length} viatura(s)).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicleId(null);
                    setVehicleForm({
                      fleetNumber: String((overview?.vehicles.length ?? 0) + 1),
                      plate: "",
                      ownerId: overview?.vehicleOwners[0]?.id ?? "",
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

              <Table head={["Autocarro", "Matrícula", "Proprietário", "Corredor", "Motorista Alocado", "DNVT / Seguro", "Ações"]}>
                {vehiclesList.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-bold text-white">
                      <div>Autocarro {v.fleetNumber}</div>
                      <div className="text-[10px] text-slide-dim font-normal">{v.capacity} lugares · {v.status}</div>
                    </td>
                    <td className="p-3.5 font-mono font-bold">{v.plate}</td>
                    <td className="p-3.5 text-slide-dim">{v.ownerName}</td>
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
                              ownerId: v.ownerId,
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

          {/* ================= MOTORISTAS ================= */}
          {tab === "Motoristas" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-xs text-slide-dim">
                <span>Motoristas verificados com habilitação profissional Categoria D</span>
                <button
                  onClick={() => handleDownloadReport("Relatório de folha de salários (Motoristas)")}
                  className="bg-slide-surface border border-white/10 text-slide-paper px-3.5 py-2 rounded-xl font-semibold cursor-pointer inline-flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Folha Salarial CSV</span>
                </button>
              </div>

              <Table head={["Motorista", "Contacto", "Categoria", "Avaliação", "Viagens Mês", "Salário Bruto", "Estado", "Ações"]}>
                {driversList.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.03] text-xs">
                    <td className="p-3.5 font-bold text-white">{d.fullName}</td>
                    <td className="p-3.5 font-mono text-slide-dim">{d.phone}</td>
                    <td className="p-3.5 text-slide-dim">
                      <div>{d.licenceCategory}</div>
                      <div className="text-[10px] font-mono">{d.licenceNumber} · val. {d.licenceExpiry}</div>
                    </td>
                    <td className="p-3.5 text-amber-400 font-bold tabular-nums">★ {d.ratingAvg}</td>
                    <td className="p-3.5 font-mono tabular-nums">{d.tripsCompleted}</td>
                    <td className="p-3.5 font-mono font-bold">{formatAOA(d.monthlyCompensationAoa)}</td>
                    <td className="p-3.5">
                      <StatusBadge
                        s={
                          d.availabilityStatus === "in_service"
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
                            availabilityStatus: (
                              d.availabilityStatus === "in_service" || d.availabilityStatus === "off_duty"
                                ? d.availabilityStatus
                                : "available"
                            ),
                            monthlyCompensationAoa: d.monthlyCompensationAoa,
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
                    onClick={() => handleDownloadReport("Pauta Diária de Presenças e Desembarque")}
                    className="bg-slide-surface border border-white/10 text-slide-paper px-3.5 py-2 rounded-xl font-semibold cursor-pointer inline-flex items-center gap-2"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Exportar Pauta Segura CSV</span>
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
                      <span>Mensalidade por Aluno (AOA)</span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slide-accent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPricingDraft((p) => ({ ...p, studentMonthlyFee: Math.max(5000, p.studentMonthlyFee - 1000) }))}
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
                        onClick={() => setPricingDraft((p) => ({ ...p, studentMonthlyFee: p.studentMonthlyFee + 1000 }))}
                        className="w-9 h-9 rounded-lg bg-slide-surface border border-white/10 grid place-items-center cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slide-bg p-4 border border-white/10 space-y-2">
                    <div className="text-slide-dim font-semibold">Autocarro Contratual (Turno Único / Duplo)</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={pricingDraft.schoolBusSingleShift}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, schoolBusSingleShift: Number(e.target.value) || 0 }))}
                        className="rounded-lg bg-slide-surface px-2.5 py-2 font-mono font-bold border border-white/10 outline-none"
                      />
                      <input
                        type="number"
                        value={pricingDraft.schoolBusDoubleShift}
                        onChange={(e) => setPricingDraft((p) => ({ ...p, schoolBusDoubleShift: Number(e.target.value) || 0 }))}
                        className="rounded-lg bg-slide-surface px-2.5 py-2 font-mono font-bold border border-white/10 outline-none"
                      />
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
                    <div className="text-[11px] text-amber-300 font-semibold">
                      Entidade MCX configurável ({pricingDraft.multicaixaEntityCode || "00845"}) · Estado AGT: Homologação
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
                        onClick={() => {
                          exportAgtReceipt(
                            {
                              invoice: inv.invoiceNumber,
                              student: inv.studentName,
                              guardian: inv.guardianName,
                              phone: inv.phone,
                              amountValue: inv.amountAoa,
                              date: new Date(inv.createdAt).toLocaleDateString("pt-AO"),
                              emisRef: inv.providerReference ?? "PENDENTE",
                              agtCert: inv.fiscalStatus,
                              status: inv.status === "confirmed" ? "Validado" : "Pendente",
                            },
                            pricingDraft
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Nota Provisória</span>
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
              {(overview?.incidents ?? []).map((inc) => (
                <div
                  key={inc.id}
                  className={`rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 border ${
                    inc.status === "resolved" || inc.status === "closed"
                      ? "bg-slide-surface border-white/10"
                      : "bg-slide-accent/15 border-slide-accent/50"
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-[240px]">
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <HeartPulse className="w-4 h-4 text-slide-accent" />
                      <span>{inc.category}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slide-bg border border-white/10">
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slide-paper">{inc.description}</p>
                    <div className="text-[11px] text-slide-dim">
                      Reportado por {inc.reporterName} ({inc.reporterRole}) · Estado: <strong>{inc.status}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inc.status !== "resolved" && inc.status !== "closed" ? (
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
                    ) : (
                      <StatusBadge s="Resolvida" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= RELATÓRIOS ================= */}
          {tab === "Relatórios" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: "Relatório mensal de viagens", desc: "Viagens separadas por turno com estado de inspeção.", format: "CSV", Icon: Bus },
                { title: "Livro de Faturas Multicaixa Express (Homologação)", desc: "Registo contabilístico com referências e estado fiscal.", format: "CSV", Icon: FileSpreadsheet },
                { title: "Pauta Diária de Presenças e Desembarque", desc: "Lista nominal mascarada sem exposição de códigos PIN.", format: "CSV", Icon: ClipboardList },
                { title: "Relatório de folha de salários (Motoristas)", desc: "Equipa verificada e processamento salarial.", format: "CSV", Icon: UserCheck },
                { title: "Relatório de Emergências e Ocorrências SOS MôBuss", desc: "Auditoria de incidentes e resoluções.", format: "TXT", Icon: Radio },
              ].map((r) => {
                const ReportIcon = r.Icon;
                return (
                  <button
                    key={r.title}
                    onClick={() => handleDownloadReport(r.title)}
                    className="rounded-2xl bg-slide-surface p-5 text-left hover:border-slide-accent/60 transition cursor-pointer border border-white/10 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-slide-bg border border-white/10 text-slide-accent grid place-items-center mb-3">
                        <ReportIcon className="w-5 h-5" />
                      </div>
                      <div className="text-sm font-bold text-white">{r.title}</div>
                      <div className="text-xs text-slide-dim mt-2">{r.desc}</div>
                    </div>
                    <div className="text-xs mt-4 pt-3 border-t border-white/10 flex justify-between text-slide-accent font-bold">
                      <span>Descarregar</span>
                      <span className="font-mono">{r.format}</span>
                    </div>
                  </button>
                );
              })}
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

              <Card title="Trilha de Auditoria Imutável (PostgreSQL)">
                <div className="space-y-2 max-h-[380px] overflow-y-auto">
                  {(overview?.auditLogs ?? []).map((log) => (
                    <div key={log.id} className="rounded-xl bg-slide-bg border border-white/10 p-3 text-xs flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-mono text-slide-accent font-bold mr-2">{log.action}</span>
                        <span className="text-white">{log.summary}</span>
                        <div className="text-[11px] text-slide-dim mt-0.5">
                          Ator: {log.actorEmail || "sistema"} ({log.actorRole}) · Alvo: {log.targetEntity} #{log.targetId ?? "—"}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-slide-dim">
                        {new Date(log.createdAt).toLocaleString("pt-AO")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
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
              <div className="grid grid-cols-2 gap-3">
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={1}
                  value={newBuses}
                  onChange={(e) => {
                    const b = Number(e.target.value) || 1;
                    setNewBuses(b);
                    setNewMonthlyAoa(b * pricingDraft.schoolBusDoubleShift);
                  }}
                  placeholder="Autocarros"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
                <input
                  type="number"
                  min={50000}
                  value={newMonthlyAoa}
                  onChange={(e) => setNewMonthlyAoa(Number(e.target.value) || 0)}
                  placeholder="Valor Mensal (Kz)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                />
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
              placeholder="Ex: MCX-849201-EMIS"
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
              <h3 className="text-lg font-black">Criar Conta Oficial MôBuss</h3>
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
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Corredor / Rota</label>
                  <input
                    required
                    value={vehicleForm.routeCode}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, routeCode: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3.5 py-2.5 text-white font-mono outline-none"
                  />
                </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Categoria Carta</label>
                  <input
                    value={editingDriver.licenceCategory}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceCategory: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Nº Carta</label>
                  <input
                    value={editingDriver.licenceNumber}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceNumber: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slide-dim font-semibold block mb-1">Validade Carta</label>
                  <input
                    value={editingDriver.licenceExpiry}
                    onChange={(e) => setEditingDriver({ ...editingDriver, licenceExpiry: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
    </div>
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
