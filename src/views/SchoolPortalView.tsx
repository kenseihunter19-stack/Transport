import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSignature,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Pencil,
  Plus,
  Power,
  Route,
  Send,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { AuthGatePanel } from '@/components/AuthGatePanel';
import { APP_TARGET } from '@/lib/runtime-config';
import { useTelemetrySocket } from '@/hooks/useTelemetrySocket';
import { downloadServerCsv } from '@/lib/csv-download';
import { formatAOA } from '@/lib/mobuss-sync';
import {
  formatWeekdaysPt,
  translateTripState,
  translateVehicleStatus,
  WEEKDAY_OPTIONS,
  type RecurringRouteScheduleItem,
} from '@/lib/admin-dashboard';
import type { RouteDto } from '@/lib/luanda-geofence';
import {
  computeOverviewSummary,
  getAdminOverviewVisibility,
  type OverviewSummary,
} from '@/lib/overview-types';

type SchoolTab =
  | 'Painel'
  | 'Alunos'
  | 'Motoristas'
  | 'Veículos'
  | 'Pedidos'
  | 'Rotas & Presenças'
  | 'Contrato & Suporte';

const SCHOOL_TABS: Array<{ id: SchoolTab; Icon: LucideIcon }> = [
  { id: 'Painel', Icon: LayoutDashboard },
  { id: 'Alunos', Icon: GraduationCap },
  { id: 'Motoristas', Icon: UserCheck },
  { id: 'Veículos', Icon: Bus },
  { id: 'Pedidos', Icon: Send },
  { id: 'Rotas & Presenças', Icon: ClipboardList },
  { id: 'Contrato & Suporte', Icon: FileSignature },
];

interface SchoolPortalDriverItem {
  id: number;
  fullName: string;
  phone: string;
  licenceCategory: string;
  licenceNumber: string;
  licenceExpiry: string;
  employerType: string;
  employerSchoolId: number | null;
  verificationStatus: string;
  availabilityStatus: string;
  ratingAvg: string;
  tripsCompleted: number;
  canManage: boolean;
  isReadOnly: boolean;
  hasLogin: boolean;
  loginUserId: number | null;
  loginUsername: string | null;
  loginEmail: string | null;
  loginActive: boolean | null;
  assignedVehicleId: number | null;
  assignedVehiclePlate: string | null;
  assignedVehicleFleetNumber: number | null;
  assignedRouteCode: string | null;
}

interface SchoolPortalVehicleItem {
  id: number;
  fleetNumber: number;
  plate: string;
  ownershipType: string;
  assignedSchoolId: number | null;
  assignedDriverId: number | null;
  driverName: string;
  driverEmployerType: string | null;
  routeCode: string | null;
  routeName: string | null;
  capacity: number;
  status: string;
  dnvtExpiry: string;
  dnvtStatus: string;
  insuranceProvider: string;
  insuranceStatus: string;
  verificationStatus: string;
  canManage: boolean;
  isReadOnly: boolean;
}

interface SchoolPortalPayload {
  school: {
    id: number;
    name: string;
    nif: string | null;
    province: string;
    municipality: string;
    address: string | null;
    contactName: string;
    contactPhone: string;
    contactEmail: string | null;
    operatingCalendar: string;
    status: string;
  } | null;
  availableSchools: Array<{ id: number; name: string; municipality: string }>;
  contracts: Array<{
    id: number;
    contractNumber: string;
    payerModel: string;
    pinPolicy: string;
    serviceModel?: 'software' | 'full_service';
    busesAllocated: number;
    studentsCovered: number;
    monthlyValueAoa: number;
    shiftRegime: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
  students: Array<{
    id: number;
    fullName: string;
    routeCode: string;
    stopName: string;
    shift: string;
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
    state: string;
    gpsStatus: string;
    lastLocationAt: string | null;
  }>;
  attendance: Array<{
    id: number;
    eventId: string;
    studentId: number;
    eventType: string;
    pinPhase: string | null;
    occurredAt: string;
    notes: string | null;
  }>;
  changeRequests: Array<{
    id: number;
    requestType: string;
    title: string;
    details: string;
    status: string;
    reviewNotes: string | null;
    createdAt: string;
  }>;
  incidents: Array<{
    id: number;
    category: string;
    severity: string;
    description: string;
    status: string;
    createdAt: string;
  }>;
  drivers?: SchoolPortalDriverItem[];
  vehicles?: SchoolPortalVehicleItem[];
  routes?: RouteDto[];
  routeSchedules?: RecurringRouteScheduleItem[];
  overviewSummary?: OverviewSummary;
}

const PAYER_LABEL: Record<string, string> = {
  school: 'Pago pela Escola',
  parent: 'Pago pelos Encarregados',
  mixed: 'Misto (Escola + Encarregados)',
};

const PIN_POLICY_LABEL: Record<string, string> = {
  both: 'Embarque + Desembarque',
  dropoff: 'Apenas Desembarque',
  boarding: 'Apenas Embarque',
};

export function SchoolPortalView() {
  const { isAuthenticated, dbUser, capabilities, loading: authLoading, apiFetch, getAuthToken, signOut } = useAuth();
  const [tab, setTab] = useState<SchoolTab>('Painel');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>('');
  const [data, setData] = useState<SchoolPortalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [exportingReport, setExportingReport] = useState<'attendance' | 'trips' | null>(null);

  // Add Student Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentRoute, setStudentRoute] = useState('ROTA-A');
  const [studentStop, setStudentStop] = useState('Largo do Kinaxixi');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('+244 9');
  const [submitting, setSubmitting] = useState(false);

  // Transport Change Request Form
  const [reqType, setReqType] = useState('stop_change');
  const [reqTitle, setReqTitle] = useState('');
  const [reqDetails, setReqDetails] = useState('');

  // Guardian Linking Modal
  const [linkStudentTarget, setLinkStudentTarget] = useState<{ id: number; fullName: string } | null>(null);
  const [linkGuardianName, setLinkGuardianName] = useState('');
  const [linkGuardianPhone, setLinkGuardianPhone] = useState('+244 9');
  const [linkGuardianEmail, setLinkGuardianEmail] = useState('');

  // School Incident Form
  const [incCategory, setIncCategory] = useState('schedule_concern');
  const [incDesc, setIncDesc] = useState('');

  // School Drivers CRUD + Login/Password Modals
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<number | null>(null);
  const [driverForm, setDriverForm] = useState({
    fullName: '',
    phone: '+244 9',
    licenceCategory: 'Pesados Profissional D',
    licenceNumber: '',
    licenceExpiry: '2028-12-31',
    availabilityStatus: 'available' as 'available' | 'in_service' | 'off_duty',
  });
  const [loginTargetDriver, setLoginTargetDriver] = useState<SchoolPortalDriverItem | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [resetPwdTargetDriver, setResetPwdTargetDriver] = useState<SchoolPortalDriverItem | null>(null);
  const [resetPwdInput, setResetPwdInput] = useState('');

  // School Vehicles CRUD Modal
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    fleetNumber: '',
    plate: '',
    capacity: 22,
    dnvtExpiry: '2027-12-31',
    dnvtStatus: 'valid' as 'valid' | 'expiring_soon' | 'expired',
    insuranceProvider: 'ENSA Seguros de Angola',
    insuranceStatus: 'valid' as 'valid' | 'pending' | 'expired',
    assignedDriverId: '' as number | '',
    routeCode: '',
  });

  // School Route Assignment & Schedules
  const [routeAssignDraft, setRouteAssignDraft] = useState<Record<number, { vehicleId: number | ''; driverId: number | '' }>>({});
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    routeCode: '',
    vehicleId: '' as number | '',
    driverId: '' as number | '',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
    shiftType: 'morning' as 'morning' | 'afternoon',
    departureTime: '06:30',
    arrivalTime: '07:30',
    active: true,
    notes: '',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadPortal = useCallback(async () => {
    if (!isAuthenticated || !capabilities.canAccessSchoolPortal) return;
    setLoading(true);
    setError(null);
    try {
      const qs = selectedSchoolId ? `?schoolId=${selectedSchoolId}` : '';
      const payload = await apiFetch<SchoolPortalPayload>(`/api/v1/school/portal${qs}`);
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar Portal Escolar.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, capabilities.canAccessSchoolPortal, selectedSchoolId, apiFetch]);

  const { connected: wsConnected } = useTelemetrySocket((event) => {
    if (
      event.type === 'attendance:updated' ||
      event.type === 'trip:state' ||
      event.type === 'pin:validated' ||
      event.type === 'incident:created'
    ) {
      void loadPortal();
    }
  });

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slide-bg text-slide-ink grid place-items-center p-8 text-xs text-slide-dim">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/mobus-logo-1024.png"
            alt="MôBus"
            className="w-16 h-16 rounded-2xl object-contain bg-black p-1.5 border border-white/15 shadow-lg"
          />
          <span>A verificar credenciais do Portal Escolar...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGatePanel
        title="Portal da Escola · MôBus"
        subtitle="Acesso autenticado para diretores, coordenadores de transporte e secretarias escolares acompanharem alunos, presenças e pedidos contratuais."
        badgeText="Acesso Institucional · Escolas Parceiras"
      />
    );
  }

  if (!capabilities.canAccessSchoolPortal) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slide-bg text-slide-ink grid place-items-center p-6">
        <div className="max-w-md rounded-2xl bg-slide-paper-ink border border-white/10 p-6 text-center space-y-3">
          <Lock className="w-8 h-8 text-slide-accent mx-auto" />
          <h2 className="text-lg font-black">Acesso Restrito ao Portal Escolar</h2>
          <p className="text-xs text-slide-dim leading-relaxed">
            O seu perfil atual (<strong>{dbUser ? ROLE_LABELS[dbUser.primaryRole] : 'Utilizador'}</strong>) não tem permissão para gerir uma instituição escolar.
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

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/school/students', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: data.school.id,
          fullName: studentName,
          routeCode: studentRoute,
          stopName: studentStop,
          guardianName,
          guardianPhone,
        }),
      });
      setStudentName('');
      setGuardianName('');
      setGuardianPhone('+244 9');
      setStudentModalOpen(false);
      showToast('Aluno submetido para aprovação da equipa MôBus.');
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao submeter aluno.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitChangeRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/school/transport-change-requests', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: data.school.id,
          requestType: reqType,
          title: reqTitle,
          details: reqDetails,
        }),
      });
      setReqTitle('');
      setReqDetails('');
      showToast('Pedido enviado à central de operações MôBus.');
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkGuardian(e: React.FormEvent) {
    e.preventDefault();
    if (!linkStudentTarget || !linkGuardianEmail.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/students/${linkStudentTarget.id}/link-guardian`, {
        method: 'POST',
        body: JSON.stringify({
          guardianName: linkGuardianName.trim(),
          guardianPhone: linkGuardianPhone.trim(),
          guardianEmail: linkGuardianEmail.trim().toLowerCase(),
        }),
      });
      setLinkStudentTarget(null);
      setLinkGuardianName('');
      setLinkGuardianPhone('+244 9');
      setLinkGuardianEmail('');
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao vincular encarregado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!incDesc.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/incidents', {
        method: 'POST',
        body: JSON.stringify({
          category: incCategory,
          severity: 'medium',
          description: incDesc.trim(),
        }),
      });
      setIncDesc('');
      showToast('Ocorrência enviada à equipa de suporte MôBus.');
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao submeter ocorrência.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExportSchoolReport(kind: 'attendance' | 'trips') {
    setExportingReport(kind);
    try {
      await downloadServerCsv({
        path: `/api/v1/school/reports/${kind}`,
        filename: kind === 'attendance' ? 'mobuss-escola-presencas.csv' : 'mobuss-escola-viagens.csv',
        query: {
          schoolId: data?.school?.id ?? (selectedSchoolId || undefined),
          from: reportFrom,
          to: reportTo,
        },
        getAuthToken,
      });
      showToast(
        kind === 'attendance'
          ? 'Relatório de presenças da escola exportado em CSV.'
          : 'Relatório de viagens da escola exportado em CSV.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao exportar relatório da escola.');
    } finally {
      setExportingReport(null);
    }
  }

  async function handleSaveSchoolDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school) return;
    setSubmitting(true);
    try {
      const payload = {
        schoolId: data.school.id,
        fullName: driverForm.fullName.trim(),
        phone: driverForm.phone.trim(),
        licenceCategory: driverForm.licenceCategory.trim(),
        licenceNumber: driverForm.licenceNumber.trim(),
        licenceExpiry: driverForm.licenceExpiry.trim(),
        availabilityStatus: driverForm.availabilityStatus,
      };
      const res = editingDriverId
        ? await apiFetch<{ message: string }>(`/api/v1/school/drivers/${editingDriverId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ message: string }>('/api/v1/school/drivers', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setDriverModalOpen(false);
      setEditingDriverId(null);
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar motorista da escola.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSchoolDriverStatus(d: SchoolPortalDriverItem) {
    if (!data?.school) return;
    const wantSuspended = d.verificationStatus !== 'suspended';
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/drivers/${d.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          schoolId: data.school.id,
          status: wantSuspended ? 'suspended' : 'active',
        }),
      });
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar estado do motorista.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateDriverLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school || !loginTargetDriver) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/drivers/${loginTargetDriver.id}/login`, {
        method: 'POST',
        body: JSON.stringify({
          schoolId: data.school.id,
          username: loginUsername.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      setLoginTargetDriver(null);
      setLoginUsername('');
      setLoginPassword('');
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar login de motorista.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetDriverPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school || !resetPwdTargetDriver) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/v1/school/drivers/${resetPwdTargetDriver.id}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({
            schoolId: data.school.id,
            password: resetPwdInput,
          }),
        }
      );
      setResetPwdTargetDriver(null);
      setResetPwdInput('');
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao redefinir palavra-passe.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveSchoolVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school) return;
    setSubmitting(true);
    try {
      const payload = {
        schoolId: data.school.id,
        fleetNumber: vehicleForm.fleetNumber ? Number(vehicleForm.fleetNumber) : undefined,
        plate: vehicleForm.plate.trim().toUpperCase(),
        capacity: Number(vehicleForm.capacity) || 22,
        dnvtExpiry: vehicleForm.dnvtExpiry.trim(),
        dnvtStatus: vehicleForm.dnvtStatus,
        insuranceProvider: vehicleForm.insuranceProvider.trim(),
        insuranceStatus: vehicleForm.insuranceStatus,
        assignedDriverId: vehicleForm.assignedDriverId ? Number(vehicleForm.assignedDriverId) : null,
        routeCode: vehicleForm.routeCode.trim() || null,
      };
      const res = editingVehicleId
        ? await apiFetch<{ message: string }>(`/api/v1/school/vehicles/${editingVehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ message: string }>('/api/v1/school/vehicles', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setVehicleModalOpen(false);
      setEditingVehicleId(null);
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao guardar viatura escolar.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSchoolVehicleStatus(v: SchoolPortalVehicleItem) {
    if (!data?.school) return;
    const wantSuspended = v.status !== 'suspended';
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/vehicles/${v.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          schoolId: data.school.id,
          status: wantSuspended ? 'suspended' : 'active',
        }),
      });
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar estado da viatura.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignSchoolRoute(route: RouteDto) {
    if (!data?.school) return;
    const draft = routeAssignDraft[route.id];
    const vehicleId = draft?.vehicleId ? Number(draft.vehicleId) : 0;
    if (!vehicleId) {
      showToast('Selecione uma viatura própria da escola para atribuir à rota.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/routes/${route.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({
          schoolId: data.school.id,
          vehicleId,
          driverId: draft?.driverId ? Number(draft.driverId) : null,
        }),
      });
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atribuir viatura à rota.');
    } finally {
      setSubmitting(false);
    }
  }

  function openNewSchoolScheduleModal() {
    const firstRoute = (data?.routes ?? [])[0];
    setEditingScheduleId(null);
    setScheduleError(null);
    setScheduleForm({
      routeCode: firstRoute?.code ?? '',
      vehicleId: '',
      driverId: '',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      shiftType: 'morning',
      departureTime: '06:30',
      arrivalTime: '07:30',
      active: true,
      notes: '',
    });
    setScheduleModalOpen(true);
  }

  function openEditSchoolScheduleModal(sch: RecurringRouteScheduleItem) {
    setEditingScheduleId(sch.id);
    setScheduleError(null);
    setScheduleForm({
      routeCode: sch.routeCode,
      vehicleId: sch.vehicleId ?? '',
      driverId: sch.driverId ?? '',
      days: sch.daysOfWeek
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
      shiftType: sch.shiftType === 'afternoon' ? 'afternoon' : 'morning',
      departureTime: sch.departureTime,
      arrivalTime: sch.arrivalTime,
      active: sch.active,
      notes: sch.notes ?? '',
    });
    setScheduleModalOpen(true);
  }

  async function handleSaveSchoolSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.school) return;
    setScheduleError(null);
    if (!scheduleForm.routeCode) {
      setScheduleError('Selecione uma rota desta escola.');
      return;
    }
    if (scheduleForm.days.length === 0) {
      setScheduleError('Selecione pelo menos um dia da semana.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        schoolId: data.school.id,
        routeCode: scheduleForm.routeCode,
        vehicleId: scheduleForm.vehicleId ? Number(scheduleForm.vehicleId) : null,
        driverId: scheduleForm.driverId ? Number(scheduleForm.driverId) : null,
        daysOfWeek: scheduleForm.days,
        shiftType: scheduleForm.shiftType,
        departureTime: scheduleForm.departureTime,
        arrivalTime: scheduleForm.arrivalTime,
        active: scheduleForm.active,
        notes: scheduleForm.notes.trim() || null,
      };
      const res = editingScheduleId
        ? await apiFetch<{ message: string }>(`/api/v1/school/route-schedules/${editingScheduleId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await apiFetch<{ message: string }>('/api/v1/school/route-schedules', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
      setScheduleModalOpen(false);
      setEditingScheduleId(null);
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao guardar escala da escola.';
      setScheduleError(msg);
      showToast(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSchoolSchedule(sch: RecurringRouteScheduleItem) {
    if (!data?.school) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>(`/api/v1/school/route-schedules/${sch.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ schoolId: data.school.id, active: !sch.active }),
      });
      showToast(res.message);
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar escala.');
    } finally {
      setSubmitting(false);
    }
  }

  const school = data?.school;
  const studentsList = data?.students ?? [];
  const schoolDriversList = data?.drivers ?? [];
  const manageableSchoolDrivers = schoolDriversList.filter((d) => d.canManage && d.verificationStatus !== 'suspended');
  const schoolVehiclesList = data?.vehicles ?? [];
  const manageableSchoolVehicles = schoolVehiclesList.filter((v) => v.canManage && v.status !== 'suspended');
  const schoolRoutesList = data?.routes ?? [];
  const schoolSchedulesList = data?.routeSchedules ?? [];
  const activeContract = data?.contracts[0];
  const schoolSummary: OverviewSummary =
    data?.overviewSummary ??
    computeOverviewSummary({
      scope: 'school',
      schoolId: school?.id ?? null,
      visibility: getAdminOverviewVisibility('school_admin'),
      dbReachable: Boolean(data),
      dbLatencyMs: null,
      contracts: data?.contracts ?? [],
      pendingContractRequestsCount: (data?.changeRequests ?? []).filter((r) => r.status === 'pending').length,
      students: studentsList,
      vehicles: schoolVehiclesList,
      drivers: schoolDriversList,
      trips: data?.trips ?? [],
      incidents: data?.incidents ?? [],
      invoices: [],
    });
  const schoolServiceStatus = schoolSummary.serviceStatus;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink flex flex-col lg:flex-row">
      {toast && (
        <div className="fixed top-20 right-6 z-50 rounded-xl bg-slide-paper-ink border border-white/15 px-4 py-3 text-xs font-semibold shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-slide-ok shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 bg-slide-paper-ink border-r border-white/10 p-5 flex-col justify-between shrink-0">
        <div>
          <div className="pb-4 mb-5 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/mobus-logo-1024.png"
                alt="MôBus Logo"
                className="w-9 h-9 rounded-lg object-contain bg-black p-0.5 border border-white/10 shrink-0"
              />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slide-accent leading-none">
                  Portal da Escola
                </div>
                <div className="font-extrabold text-sm tracking-tight text-slide-paper leading-none mt-1" style={{ fontFamily: 'var(--font-display)' }}>
                  MôBus
                </div>
              </div>
            </div>
            <div className="text-sm font-black text-slide-paper leading-snug">
              {school?.name ?? 'Instituição Parceira'}
            </div>
            <div className="text-[11px] text-slide-dim mt-0.5">
              {school?.municipality ?? 'Luanda'}
            </div>
          </div>

          <nav className="space-y-1">
            {SCHOOL_TABS.map(({ id, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer text-left ${
                    active
                      ? 'bg-slide-accent text-white shadow-xs'
                      : 'text-slide-dim hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{id}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl bg-slide-bg border border-white/10 p-3.5 text-[11px] text-slide-dim space-y-1.5">
            <div className="font-bold text-slide-paper flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slide-ok shrink-0" />
              <span>Limites de Operação</span>
            </div>
            <p className="leading-relaxed">
              A escola gere a pauta, motoristas e viaturas próprias; motoristas ou viaturas da MôBus aparecem em só leitura.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-300 hover:text-white hover:bg-red-500/10 transition cursor-pointer text-left"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Terminar Sessão (Sair)</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header & Tabs */}
      <div className="lg:hidden border-b border-white/10 bg-slide-paper-ink">
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/mobus-logo-1024.png"
              alt="MôBus Logo"
              className="w-7 h-7 rounded-lg object-contain bg-black p-0.5 border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-extrabold text-xs tracking-tight text-white truncate" style={{ fontFamily: 'var(--font-display)' }}>
                MôBus · Portal da Escola
              </div>
              <div className="text-[10px] text-slide-dim truncate">
                {school?.name ?? 'Instituição Parceira'}
              </div>
            </div>
          </div>
          {APP_TARGET !== 'hub' && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-red-500/15 text-red-300 hover:text-white"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          )}
        </div>
        <div className="px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {SCHOOL_TABS.map(({ id, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                tab === id ? 'bg-slide-accent text-white' : 'bg-white/5 text-slide-dim'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-5 sm:p-7 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs text-slide-dim flex items-center gap-2 flex-wrap">
              <span>{school?.name ?? 'Escola'}</span>
              <span>·</span>
              <span
                className={`font-semibold ${
                  schoolServiceStatus.tone === 'ok'
                    ? 'text-emerald-400'
                    : schoolServiceStatus.tone === 'warn'
                    ? 'text-amber-400'
                    : schoolServiceStatus.tone === 'danger'
                    ? 'text-slide-accent'
                    : 'text-slide-paper'
                }`}
                title={schoolServiceStatus.reason}
              >
                Serviço: {schoolServiceStatus.label}
              </span>
              <span>·</span>
              <span className="text-slide-ok font-semibold">
                {activeContract ? `Contrato ${activeContract.contractNumber}` : 'Sem contrato ativo'}
              </span>
              <span>·</span>
              <span className={wsConnected ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
                {wsConnected ? 'WebSocket Ao Vivo' : 'A sincronizar WS...'}
              </span>
            </div>
            <h1 className="text-2xl font-black mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {tab}
            </h1>
          </div>

          {data && data.availableSchools.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slide-dim">Instituição:</span>
              <select
                value={selectedSchoolId || school?.id || ''}
                onChange={(e) => setSelectedSchoolId(Number(e.target.value))}
                className="rounded-xl bg-slide-surface border border-white/10 px-3 py-1.5 text-xs text-white outline-none"
              >
                {data.availableSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {error && (
          <div className="rounded-xl bg-slide-accent/15 border border-slide-accent/40 p-4 text-xs text-red-200 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => void loadPortal()} className="underline font-bold cursor-pointer">
              Tentar novamente
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="rounded-2xl bg-slide-surface border border-white/10 p-8 text-center text-xs text-slide-dim">
            A carregar registos da escola em PostgreSQL...
          </div>
        ) : (
          <>
            {tab === 'Painel' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Contratos Ativos</div>
                    <div className="text-2xl font-black text-slide-ok mt-1 tabular-nums">
                      {schoolSummary.contracts && schoolSummary.contracts.total > 0
                        ? schoolSummary.contracts.active
                        : 'sem dados'}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1">
                      {activeContract
                        ? `${PAYER_LABEL[activeContract.payerModel] ?? activeContract.payerModel} · ${schoolSummary.contracts?.total ?? 0} contrato(s)`
                        : 'sem dados de contratos'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Alunos Inscritos</div>
                    <div className="text-2xl font-black mt-1 tabular-nums">
                      {schoolSummary.students && schoolSummary.students.total > 0
                        ? schoolSummary.students.enrolled
                        : 'sem dados'}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1">
                      {schoolSummary.students && schoolSummary.students.total > 0
                        ? `${schoolSummary.students.total} registados · PIN: ${PIN_POLICY_LABEL[activeContract?.pinPolicy || 'both']}`
                        : 'sem dados de alunos'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Viagens Hoje ({schoolSummary.referenceDate})</div>
                    <div className="text-2xl font-black text-slide-accent mt-1 tabular-nums">
                      {schoolSummary.tripsToday && schoolSummary.tripsToday.total > 0
                        ? schoolSummary.tripsToday.total
                        : 'sem dados'}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1 tabular-nums">
                      {schoolSummary.tripsToday && schoolSummary.tripsToday.total > 0
                        ? `${schoolSummary.tripsToday.active} em curso · ${schoolSummary.tripsToday.scheduled} agendadas · ${schoolSummary.delayedTripsCount ?? 0} atraso(s)`
                        : 'sem dados de viagens hoje'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Ocorrências em Aberto</div>
                    <div className="text-2xl font-black mt-1 tabular-nums">
                      {schoolSummary.incidents && schoolSummary.incidents.total > 0
                        ? schoolSummary.incidents.open
                        : 'sem dados'}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1 tabular-nums">
                      {schoolSummary.incidents && schoolSummary.incidents.total > 0
                        ? `${schoolSummary.incidents.criticalOpen} crítica(s) · ${schoolSummary.contracts?.pendingRequests ?? 0} pedido(s) pendente(s)`
                        : `${schoolSummary.contracts?.pendingRequests ?? 0} pedido(s) em análise`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold">Viagens Hoje por Estado (Escola)</h2>
                      <span className="text-[11px] text-slide-dim tabular-nums">
                        {schoolSummary.tripsToday && schoolSummary.tripsToday.total > 0
                          ? `${schoolSummary.tripsToday.total} viagem(ns)`
                          : 'sem dados'}
                      </span>
                    </div>
                    {!schoolSummary.tripsToday || schoolSummary.tripsToday.total === 0 ? (
                      <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-xs text-slide-dim">
                        sem dados
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {schoolSummary.tripsToday.stateSeries.map((item) => {
                          const pct = Math.round((item.count / schoolSummary.tripsToday!.total) * 100);
                          return (
                            <div key={item.key} className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="font-medium text-slide-paper">{item.label}</span>
                                <span className="font-mono font-bold text-white tabular-nums">
                                  {item.count} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slide-bg overflow-hidden border border-white/5">
                                <div
                                  className={`h-full rounded-full ${
                                    item.key === 'in_progress'
                                      ? 'bg-emerald-400'
                                      : item.key === 'scheduled'
                                      ? 'bg-sky-400'
                                      : item.key === 'delayed'
                                      ? 'bg-amber-400'
                                      : item.key === 'completed'
                                      ? 'bg-slide-ok'
                                      : 'bg-slide-accent'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold">Estado do Serviço · {school?.name ?? 'Escola'}</h2>
                      <span
                        className={`text-[11px] font-bold ${
                          schoolServiceStatus.tone === 'ok'
                            ? 'text-emerald-400'
                            : schoolServiceStatus.tone === 'warn'
                            ? 'text-amber-400'
                            : schoolServiceStatus.tone === 'danger'
                            ? 'text-slide-accent'
                            : 'text-slide-dim'
                        }`}
                      >
                        {schoolServiceStatus.label}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                        <span className="text-slide-dim">Base de Dados PostgreSQL</span>
                        <span className={`font-bold tabular-nums ${schoolServiceStatus.dbReachable ? 'text-emerald-400' : 'text-slide-accent'}`}>
                          {schoolServiceStatus.dbReachable
                            ? `Acessível (${schoolServiceStatus.dbLatencyMs ?? 0}ms)`
                            : 'Inacessível'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                        <span className="text-slide-dim">GPS Viagens da Escola</span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {schoolServiceStatus.liveGpsTripsCount === 0 && schoolServiceStatus.staleGpsTripsCount === 0
                            ? 'sem dados'
                            : `${schoolServiceStatus.liveGpsTripsCount} ao vivo / ${schoolServiceStatus.staleGpsTripsCount} desat.`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                        <span className="text-slide-dim">Ocorrências Críticas / Atrasos</span>
                        <span className="font-mono font-bold text-white tabular-nums">
                          {schoolSummary.incidents && schoolSummary.incidents.total === 0 && (schoolSummary.delayedTripsCount ?? 0) === 0
                            ? 'sem dados'
                            : `${schoolServiceStatus.openCriticalIncidentsCount} crítico(s) · ${schoolSummary.delayedTripsCount ?? 0} atraso(s)`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <Bus className="w-4 h-4 text-slide-accent" />
                      <span>Viagens Contratadas (Só Leitura)</span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slide-dim">Operação gerida pela MôBus</span>
                      <button
                        type="button"
                        disabled={exportingReport === 'trips'}
                        onClick={() => void handleExportSchoolReport('trips')}
                        className="rounded-lg bg-slide-bg border border-white/10 px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-white/5 disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" />
                        <span>{exportingReport === 'trips' ? 'A exportar...' : 'Exportar Viagens CSV'}</span>
                      </button>
                    </div>
                  </div>
                  {(data?.trips ?? []).length === 0 ? (
                    <div className="text-xs text-slide-dim py-4">sem dados · Sem viagens programadas para esta escola.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data?.trips.map((t) => (
                        <div key={t.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{t.routeName}</div>
                            <div className="text-[11px] text-slide-dim font-mono mt-0.5">
                              {t.tripCode} · {t.serviceDate} · {t.legType === 'morning' ? 'Turno Manhã' : 'Turno Regresso'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-bold">
                              {translateTripState(t.state)}
                            </span>
                            <div className="text-[10px] text-slide-dim mt-1">
                              GPS: {t.gpsStatus === 'live' ? 'Ao vivo' : t.gpsStatus === 'stale' ? 'Desatualizado' : 'Sem sinal'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'Alunos' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="text-xs text-slide-dim">
                    Lista nominal da escola. Códigos PIN são ocultados por segurança ({PIN_POLICY_LABEL.both}).
                  </div>
                  <button
                    onClick={() => setStudentModalOpen(true)}
                    className="rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Submeter Novo Aluno</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slide-surface overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slide-paper-ink text-slide-dim uppercase text-[10px] tracking-wider border-b border-white/10">
                        <th className="p-3.5">Aluno(a)</th>
                        <th className="p-3.5">Rota / Paragem</th>
                        <th className="p-3.5">Encarregado(a)</th>
                        <th className="p-3.5">Política PIN</th>
                        <th className="p-3.5">PIN</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {studentsList.map((st) => (
                        <tr key={st.id} className="hover:bg-white/[0.03]">
                          <td className="p-3.5 font-bold text-white">{st.fullName}</td>
                          <td className="p-3.5 text-slide-dim">
                            <span className="text-slide-accent font-semibold">{st.routeCode}</span> · {st.stopName}
                          </td>
                          <td className="p-3.5">
                            <div>{st.guardianName}</div>
                            <div className="text-[11px] font-mono text-slide-dim">{st.guardianPhone}</div>
                          </td>
                          <td className="p-3.5 text-[11px] text-slide-dim">
                            {PIN_POLICY_LABEL[st.pinPolicy] || st.pinPolicy}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slide-dim">{st.maskedPin}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-semibold">
                              {st.enrollmentStatus === 'pending_approval'
                                ? 'Aguarda MôBus'
                                : st.currentJourneyState}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => {
                                setLinkStudentTarget({ id: st.id, fullName: st.fullName });
                                setLinkGuardianName(st.guardianName === 'Por vincular' ? '' : st.guardianName);
                                setLinkGuardianPhone(st.guardianPhone === '—' ? '+244 9' : st.guardianPhone);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 text-[11px] font-semibold cursor-pointer"
                            >
                              Vincular App Pai
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'Motoristas' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="text-xs text-slide-dim">
                    Gira os motoristas contratados pela escola e crie credenciais de acesso à App Motorista. Motoristas da MôBus aparecem apenas em leitura.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDriverId(null);
                      setDriverForm({
                        fullName: '',
                        phone: '+244 9',
                        licenceCategory: 'Pesados Profissional D',
                        licenceNumber: '',
                        licenceExpiry: '2028-12-31',
                        availabilityStatus: 'available',
                      });
                      setDriverModalOpen(true);
                    }}
                    className="rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Registar Motorista</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slide-surface overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slide-paper-ink text-slide-dim uppercase text-[10px] tracking-wider border-b border-white/10">
                        <th className="p-3.5">Motorista</th>
                        <th className="p-3.5">Vínculo</th>
                        <th className="p-3.5">Carta de Condução</th>
                        <th className="p-3.5">Viatura / Rota</th>
                        <th className="p-3.5">Acesso App</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {schoolDriversList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slide-dim">
                            Sem motoristas registados ou alocados a esta escola.
                          </td>
                        </tr>
                      ) : (
                        schoolDriversList.map((d) => (
                          <tr key={d.id} className="hover:bg-white/[0.03]">
                            <td className="p-3.5">
                              <div className="font-bold text-white">{d.fullName}</div>
                              <div className="text-[11px] font-mono text-slide-dim">{d.phone}</div>
                            </td>
                            <td className="p-3.5">
                              {d.canManage ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                                  Empregador: Escola
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-white/10 text-slide-dim text-[10px] font-bold">
                                  MôBus · Só Leitura
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-slide-dim">
                              <div>{d.licenceCategory}</div>
                              <div className="text-[11px] font-mono">
                                {d.licenceNumber} · val. {d.licenceExpiry}
                              </div>
                            </td>
                            <td className="p-3.5 text-slide-dim">
                              {d.assignedVehiclePlate ? (
                                <div>
                                  <span className="text-white font-semibold">
                                    Autocarro {d.assignedVehicleFleetNumber} ({d.assignedVehiclePlate})
                                  </span>
                                  {d.assignedRouteCode && (
                                    <div className="text-[11px] font-mono text-slide-accent">{d.assignedRouteCode}</div>
                                  )}
                                </div>
                              ) : (
                                'Por alocar'
                              )}
                            </td>
                            <td className="p-3.5">
                              {d.hasLogin ? (
                                <div>
                                  <div className="font-mono font-bold text-white">
                                    @{d.loginUsername || d.loginEmail}
                                  </div>
                                  <div
                                    className={`text-[10px] font-semibold ${
                                      d.loginActive ? 'text-emerald-300' : 'text-red-300'
                                    }`}
                                  >
                                    {d.loginActive ? 'Login ativo' : 'Login suspenso'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slide-dim text-[11px]">Sem login</span>
                              )}
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  d.verificationStatus === 'suspended'
                                    ? 'bg-red-500/20 text-red-300'
                                    : d.availabilityStatus === 'in_service'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-white/10 text-white'
                                }`}
                              >
                                {d.verificationStatus === 'suspended'
                                  ? 'Suspenso'
                                  : d.availabilityStatus === 'in_service'
                                  ? 'Em serviço'
                                  : d.availabilityStatus === 'off_duty'
                                  ? 'De folga'
                                  : 'Ativo'}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              {d.canManage ? (
                                <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDriverId(d.id);
                                      setDriverForm({
                                        fullName: d.fullName,
                                        phone: d.phone,
                                        licenceCategory: d.licenceCategory,
                                        licenceNumber: d.licenceNumber,
                                        licenceExpiry: d.licenceExpiry,
                                        availabilityStatus:
                                          d.availabilityStatus === 'in_service' || d.availabilityStatus === 'off_duty'
                                            ? d.availabilityStatus
                                            : 'available',
                                      });
                                      setDriverModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-300" />
                                    <span>Editar</span>
                                  </button>
                                  {!d.hasLogin ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setLoginTargetDriver(d);
                                        setLoginUsername(
                                          d.fullName
                                            .toLowerCase()
                                            .normalize('NFD')
                                            .replace(/[\u0300-\u036f]/g, '')
                                            .replace(/[^a-z0-9]+/g, '.')
                                            .replace(/^\.+|\.+$/g, '')
                                        );
                                        setLoginPassword('');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slide-ok text-white text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <KeyRound className="w-3 h-3" />
                                      <span>Criar Login</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResetPwdTargetDriver(d);
                                        setResetPwdInput('');
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <KeyRound className="w-3 h-3 text-amber-300" />
                                      <span>Repor Senha</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => void handleToggleSchoolDriverStatus(d)}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                      d.verificationStatus === 'suspended'
                                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                                    }`}
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>{d.verificationStatus === 'suspended' ? 'Reativar' : 'Suspender'}</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slide-dim">Só leitura</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'Veículos' && (
              <div className="space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="text-xs text-slide-dim">
                    Viaturas próprias da escola e unidades atribuídas à instituição. Viaturas da MôBus ou parceiros são apresentadas apenas em leitura.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVehicleId(null);
                      setVehicleForm({
                        fleetNumber: '',
                        plate: '',
                        capacity: 22,
                        dnvtExpiry: '2027-12-31',
                        dnvtStatus: 'valid',
                        insuranceProvider: 'ENSA Seguros de Angola',
                        insuranceStatus: 'valid',
                        assignedDriverId: '',
                        routeCode: schoolRoutesList[0]?.code ?? '',
                      });
                      setVehicleModalOpen(true);
                    }}
                    className="rounded-xl bg-slide-accent text-white px-4 py-2 text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Registar Viatura Própria</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slide-surface overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slide-paper-ink text-slide-dim uppercase text-[10px] tracking-wider border-b border-white/10">
                        <th className="p-3.5">Autocarro</th>
                        <th className="p-3.5">Propriedade</th>
                        <th className="p-3.5">Rota</th>
                        <th className="p-3.5">Motorista Alocado</th>
                        <th className="p-3.5">DNVT / Seguro</th>
                        <th className="p-3.5">Estado</th>
                        <th className="p-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {schoolVehiclesList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slide-dim">
                            Sem viaturas registadas ou atribuídas a esta escola.
                          </td>
                        </tr>
                      ) : (
                        schoolVehiclesList.map((v) => (
                          <tr key={v.id} className="hover:bg-white/[0.03]">
                            <td className="p-3.5">
                              <div className="font-bold text-white">
                                Autocarro {v.fleetNumber} · <span className="font-mono">{v.plate}</span>
                              </div>
                              <div className="text-[11px] text-slide-dim">{v.capacity} lugares</div>
                            </td>
                            <td className="p-3.5">
                              {v.canManage ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                                  Própria da Escola
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-white/10 text-slide-dim text-[10px] font-bold">
                                  {v.ownershipType === 'partner_owned' ? 'Parceiro' : 'Frota MôBus'} · Só Leitura
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-slide-accent">
                              {v.routeCode || '—'}
                            </td>
                            <td className="p-3.5 text-slide-paper">{v.driverName}</td>
                            <td className="p-3.5 text-[11px] text-slide-dim">
                              <div>
                                DNVT: {v.dnvtStatus} ({v.dnvtExpiry})
                              </div>
                              <div>
                                {v.insuranceProvider} ({v.insuranceStatus})
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  v.status === 'suspended'
                                    ? 'bg-red-500/20 text-red-300'
                                    : v.status === 'on_trip' || v.status === 'assigned'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-white/10 text-white'
                                }`}
                              >
                                {translateVehicleStatus(v.status)}
                              </span>
                            </td>
                            <td className="p-3.5 text-right">
                              {v.canManage ? (
                                <div className="inline-flex flex-wrap justify-end items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingVehicleId(v.id);
                                      setVehicleForm({
                                        fleetNumber: String(v.fleetNumber),
                                        plate: v.plate,
                                        capacity: v.capacity,
                                        dnvtExpiry: v.dnvtExpiry,
                                        dnvtStatus:
                                          v.dnvtStatus === 'expiring_soon' || v.dnvtStatus === 'expired'
                                            ? v.dnvtStatus
                                            : 'valid',
                                        insuranceProvider: v.insuranceProvider,
                                        insuranceStatus:
                                          v.insuranceStatus === 'pending' || v.insuranceStatus === 'expired'
                                            ? v.insuranceStatus
                                            : 'valid',
                                        assignedDriverId: v.assignedDriverId ?? '',
                                        routeCode: v.routeCode ?? '',
                                      });
                                      setVehicleModalOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slide-bg border border-white/15 hover:bg-white/10 text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Pencil className="w-3 h-3 text-emerald-300" />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => void handleToggleSchoolVehicleStatus(v)}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 ${
                                      v.status === 'suspended'
                                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                        : 'bg-red-500/10 border-red-500/30 text-red-300'
                                    }`}
                                  >
                                    <Power className="w-3 h-3" />
                                    <span>{v.status === 'suspended' ? 'Reativar' : 'Suspender'}</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slide-dim">Só leitura</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* School Routes Assignment */}
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        <Route className="w-4 h-4 text-slide-accent" />
                        <span>Rotas da Escola — Alocação de Viatura & Motorista Próprios</span>
                      </h2>
                      <p className="text-[11px] text-slide-dim mt-0.5">
                        Atribua apenas viaturas e motoristas pertencentes a {school?.name ?? 'esta escola'} às respetivas rotas.
                      </p>
                    </div>
                  </div>

                  {schoolRoutesList.length === 0 ? (
                    <div className="text-xs text-slide-dim py-3">
                      Nenhuma rota exclusiva associada a esta escola ainda.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {schoolRoutesList.map((r) => {
                        const currentVeh = schoolVehiclesList.find((v) => v.routeCode === r.code && v.canManage);
                        const draft = routeAssignDraft[r.id] ?? {
                          vehicleId: currentVeh?.id ?? '',
                          driverId: currentVeh?.assignedDriverId ?? '',
                        };
                        return (
                          <div
                            key={r.id}
                            className="rounded-xl bg-slide-bg border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-[200px]">
                              <div className="font-bold text-white flex items-center gap-2">
                                <span className="font-mono text-slide-accent">{r.code}</span>
                                <span>· {r.name}</span>
                              </div>
                              <div className="text-[11px] text-slide-dim mt-0.5">
                                {r.stops.length} paragem(ns) ·{' '}
                                {currentVeh
                                  ? `Atual: Autocarro ${currentVeh.fleetNumber} (${currentVeh.plate}) · ${currentVeh.driverName}`
                                  : 'Sem viatura própria atribuída'}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={draft.vehicleId}
                                onChange={(e) =>
                                  setRouteAssignDraft((prev) => ({
                                    ...prev,
                                    [r.id]: {
                                      vehicleId: e.target.value ? Number(e.target.value) : '',
                                      driverId: draft.driverId,
                                    },
                                  }))
                                }
                                className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-white outline-none"
                              >
                                <option value="">Viatura própria...</option>
                                {manageableSchoolVehicles.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    Autocarro {v.fleetNumber} ({v.plate})
                                  </option>
                                ))}
                              </select>
                              <select
                                value={draft.driverId}
                                onChange={(e) =>
                                  setRouteAssignDraft((prev) => ({
                                    ...prev,
                                    [r.id]: {
                                      vehicleId: draft.vehicleId,
                                      driverId: e.target.value ? Number(e.target.value) : '',
                                    },
                                  }))
                                }
                                className="rounded-xl bg-slide-surface border border-white/15 px-3 py-1.5 text-white outline-none"
                              >
                                <option value="">Motorista da escola...</option>
                                {manageableSchoolDrivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.fullName}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => void handleAssignSchoolRoute(r)}
                                className="rounded-xl bg-slide-accent text-white px-3.5 py-1.5 font-bold cursor-pointer disabled:opacity-50"
                              >
                                Atribuir à Rota
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* School Recurring Route Schedules */}
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-bold flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-slide-accent" />
                        <span>Escalas Recorrentes da Escola ({schoolSchedulesList.length})</span>
                      </h2>
                      <p className="text-[11px] text-slide-dim mt-0.5">
                        Agende turnos recorrentes utilizando apenas rotas, viaturas e motoristas desta escola.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={schoolRoutesList.length === 0}
                      onClick={openNewSchoolScheduleModal}
                      className="rounded-xl bg-slide-ok text-white px-3.5 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agendar Escala</span>
                    </button>
                  </div>

                  {schoolSchedulesList.length === 0 ? (
                    <div className="text-xs text-slide-dim py-3">
                      Sem escalas recorrentes configuradas para esta escola ainda.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {schoolSchedulesList.map((sch) => (
                        <div
                          key={sch.id}
                          className="rounded-xl bg-slide-bg border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span className="font-mono text-slide-accent">{sch.routeCode}</span>
                              <span>· {sch.routeName}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sch.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slide-dim'
                                }`}
                              >
                                {sch.active ? 'Ativa' : 'Pausada'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slide-dim mt-0.5 font-mono">
                              {formatWeekdaysPt(sch.daysOfWeek)} · {sch.departureTime}–{sch.arrivalTime} ·{' '}
                              {sch.shiftType === 'afternoon' ? 'Tarde' : 'Manhã'}
                            </div>
                            <div className="text-[11px] text-slide-dim mt-0.5">
                              {sch.vehicleFleetNumber
                                ? `Autocarro ${sch.vehicleFleetNumber} (${sch.vehiclePlate}) · ${sch.driverName}`
                                : `Motorista: ${sch.driverName}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleToggleSchoolSchedule(sch)}
                              className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/15 hover:bg-white/10 font-semibold cursor-pointer"
                            >
                              {sch.active ? 'Pausar' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditSchoolScheduleModal(sch)}
                              className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/15 hover:bg-white/10 font-semibold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3 h-3 text-emerald-300" />
                              <span>Editar</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'Pedidos' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4">
                  <h2 className="text-sm font-bold">Pedir Alteração de Serviço à MôBus</h2>
                  <form onSubmit={handleSubmitChangeRequest} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slide-dim mb-1 font-semibold">Tipo de Pedido</label>
                      <select
                        value={reqType}
                        onChange={(e) => setReqType(e.target.value)}
                        className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                      >
                        <option value="stop_change">Alteração de Paragem</option>
                        <option value="new_student">Inclusão de Alunos</option>
                        <option value="schedule_change">Ajuste de Horário / Turno</option>
                        <option value="suspension">Suspensão Temporária (Férias)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slide-dim mb-1 font-semibold">Assunto</label>
                      <input
                        required
                        value={reqTitle}
                        onChange={(e) => setReqTitle(e.target.value)}
                        placeholder="Ex: Nova paragem no Benfica para 4 alunos"
                        className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slide-dim mb-1 font-semibold">Justificação e Detalhes</label>
                      <textarea
                        required
                        rows={3}
                        value={reqDetails}
                        onChange={(e) => setReqDetails(e.target.value)}
                        placeholder="Descreva os alunos afetados e datas pretendidas..."
                        className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-slide-accent text-white py-2.5 font-bold cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? 'A enviar...' : 'Submeter Pedido à Central MôBus'}
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3">
                  <h2 className="text-sm font-bold">Histórico de Pedidos da Escola</h2>
                  {(data?.changeRequests ?? []).length === 0 ? (
                    <div className="text-xs text-slide-dim py-4">Nenhum pedido submetido ainda.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {data?.changeRequests.map((r) => (
                        <div key={r.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-bold text-white">{r.title}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                r.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : r.status === 'rejected'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {r.status}
                            </span>
                          </div>
                          <p className="text-slide-dim text-[11px]">{r.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'Rotas & Presenças' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="text-xs text-slide-dim flex items-center gap-2">
                    <Route className="w-4 h-4 text-slide-accent" />
                    <span>Registo imutável de embarques e entregas (apenas alunos desta escola)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={reportFrom}
                      onChange={(e) => setReportFrom(e.target.value)}
                      aria-label="Data inicial"
                      className="rounded-xl bg-slide-surface border border-white/10 px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                    <input
                      type="date"
                      value={reportTo}
                      onChange={(e) => setReportTo(e.target.value)}
                      aria-label="Data final"
                      className="rounded-xl bg-slide-surface border border-white/10 px-2.5 py-1.5 text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      disabled={exportingReport === 'attendance'}
                      onClick={() => void handleExportSchoolReport('attendance')}
                      className="rounded-xl bg-slide-surface border border-white/10 px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingReport === 'attendance' ? 'A exportar...' : 'Exportar Presenças CSV'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingReport === 'trips'}
                      onClick={() => void handleExportSchoolReport('trips')}
                      className="rounded-xl bg-slide-surface border border-white/10 px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Bus className="w-3.5 h-3.5" />
                      <span>{exportingReport === 'trips' ? 'A exportar...' : 'Exportar Viagens CSV'}</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2">
                  {(data?.attendance ?? []).length === 0 ? (
                    <div className="text-xs text-slide-dim py-4">Sem eventos de presença registados ainda.</div>
                  ) : (
                    data?.attendance.map((ev) => (
                      <div key={ev.eventId} className="rounded-xl bg-slide-bg border border-white/10 p-3 text-xs flex justify-between items-center">
                        <div>
                          <div className="font-bold text-white">
                            Aluno #{ev.studentId} · Evento: {ev.eventType}
                          </div>
                          <div className="text-[11px] text-slide-dim">{ev.notes || 'Registo operacional'}</div>
                        </div>
                        <span className="text-[11px] font-mono text-slide-dim">
                          {new Date(ev.occurredAt).toLocaleString('pt-AO')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'Contrato & Suporte' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
                  <h2 className="text-sm font-bold">Termos do Contrato Ativo</h2>
                  {activeContract ? (
                    <div className="space-y-2 font-mono">
                      <div className="flex justify-between py-1.5 border-b border-white/10">
                        <span className="text-slide-dim">Contrato Nº:</span>
                        <span className="font-bold">{activeContract.contractNumber}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/10">
                        <span className="text-slide-dim">Modelo de Pagamento:</span>
                        <span className="font-bold text-slide-ok">{PAYER_LABEL[activeContract.payerModel]}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/10">
                        <span className="text-slide-dim">Modelo de Serviço:</span>
                        <span className="font-bold">
                          {activeContract.serviceModel === 'full_service'
                            ? 'Serviço Completo MôBus'
                            : 'Software (Frota Própria)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/10">
                        <span className="text-slide-dim">Política de PIN:</span>
                        <span className="font-bold">{PIN_POLICY_LABEL[activeContract.pinPolicy]}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-white/10">
                        <span className="text-slide-dim">Autocarros / Alunos:</span>
                        <span className="font-bold">{activeContract.busesAllocated} / {activeContract.studentsCovered}</span>
                      </div>
                      <div className="flex justify-between py-1.5">
                        <span className="text-slide-dim">Valor Contratual Mensal:</span>
                        <span className="font-bold text-slide-accent">{formatAOA(activeContract.monthlyValueAoa)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slide-dim">Nenhum contrato ativo associado.</div>
                  )}
                </div>

                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4 text-xs">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-slide-accent" />
                    <span>Comunicar Ocorrência à MôBus</span>
                  </h2>
                  <form onSubmit={handleSubmitIncident} className="space-y-3">
                    <select
                      value={incCategory}
                      onChange={(e) => setIncCategory(e.target.value)}
                      className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                    >
                      <option value="schedule_concern">Atraso / Horário Escolar</option>
                      <option value="roster_issue">Dúvida sobre Aluno / Encarregado</option>
                      <option value="safety_report">Ocorrência de Segurança</option>
                    </select>
                    <textarea
                      required
                      rows={3}
                      value={incDesc}
                      onChange={(e) => setIncDesc(e.target.value)}
                      placeholder="Descreva a situação para a central MôBus..."
                      className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-xl bg-slide-accent text-white py-2.5 font-bold cursor-pointer"
                    >
                      Registar Ocorrência Escolar
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal: Submit Student */}
      {studentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">Submeter Novo Educando</h3>
              <button onClick={() => setStudentModalOpen(false)} className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="space-y-3 text-xs">
              <input
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Nome completo do aluno"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <select
                  value={studentRoute}
                  onChange={(e) => setStudentRoute(e.target.value)}
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                >
                  {schoolRoutesList.length > 0 ? (
                    schoolRoutesList.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} ({r.name})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="ROTA-A">ROTA-A (Morro Bento)</option>
                      <option value="ROTA-B">ROTA-B (Talatona)</option>
                      <option value="ROTA-C">ROTA-C (Viana)</option>
                      <option value="ROTA-D">ROTA-D (Miramar)</option>
                    </>
                  )}
                </select>
                <input
                  required
                  value={studentStop}
                  onChange={(e) => setStudentStop(e.target.value)}
                  placeholder="Paragem"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                />
              </div>
              <input
                required
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                placeholder="Nome do Encarregado(a)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <input
                required
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                placeholder="Telefone (+244 9xx xxx xxx)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-accent text-white py-3 font-bold cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? 'A guardar...' : 'Submeter para Aprovação MôBus'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Link Guardian Email */}
      {linkStudentTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">Vincular App do Encarregado</h3>
              <button onClick={() => setLinkStudentTarget(null)} className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slide-dim">
              Aluno(a): <strong className="text-white">{linkStudentTarget.fullName}</strong>. O educando e o PIN ficam disponíveis após a Administração criar a conta deste e-mail e o encarregado iniciar sessão na App Cliente.
            </p>
            <form onSubmit={handleLinkGuardian} className="space-y-3 text-xs">
              <input
                required
                type="email"
                value={linkGuardianEmail}
                onChange={(e) => setLinkGuardianEmail(e.target.value)}
                placeholder="E-mail da conta criada pelo Admin"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <input
                value={linkGuardianName}
                onChange={(e) => setLinkGuardianName(e.target.value)}
                placeholder="Nome do Encarregado(a)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <input
                value={linkGuardianPhone}
                onChange={(e) => setLinkGuardianPhone(e.target.value)}
                placeholder="Telefone (+244 9xx xxx xxx)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer"
              >
                {submitting ? 'A vincular...' : 'Confirmar Vinculação'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Create / Edit School Driver */}
      {driverModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">
                {editingDriverId ? 'Editar Motorista da Escola' : 'Registar Motorista da Escola'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDriverModalOpen(false);
                  setEditingDriverId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSchoolDriver} className="space-y-3 text-xs">
              <input
                required
                value={driverForm.fullName}
                onChange={(e) => setDriverForm({ ...driverForm, fullName: e.target.value })}
                placeholder="Nome completo do motorista"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <input
                required
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                placeholder="Telefone (+244 9xx xxx xxx)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  required
                  value={driverForm.licenceNumber}
                  onChange={(e) => setDriverForm({ ...driverForm, licenceNumber: e.target.value })}
                  placeholder="Nº Carta (ex: LD-441200)"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                />
                <input
                  required
                  type="date"
                  value={driverForm.licenceExpiry}
                  onChange={(e) => setDriverForm({ ...driverForm, licenceExpiry: e.target.value })}
                  aria-label="Validade da carta"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={driverForm.licenceCategory}
                  onChange={(e) => setDriverForm({ ...driverForm, licenceCategory: e.target.value })}
                  placeholder="Categoria da carta"
                  className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                />
                {editingDriverId && (
                  <select
                    value={driverForm.availabilityStatus}
                    onChange={(e) =>
                      setDriverForm({
                        ...driverForm,
                        availabilityStatus: e.target.value as 'available' | 'in_service' | 'off_duty',
                      })
                    }
                    className="rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
                  >
                    <option value="available">Disponível</option>
                    <option value="in_service">Em serviço</option>
                    <option value="off_duty">De folga</option>
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'A guardar...'
                  : editingDriverId
                  ? 'Guardar Alterações do Motorista'
                  : 'Registar Motorista na Escola'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Driver Login */}
      {loginTargetDriver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">Criar Acesso de Motorista</h3>
              <button
                type="button"
                onClick={() => setLoginTargetDriver(null)}
                className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slide-dim">
              Motorista: <strong className="text-white">{loginTargetDriver.fullName}</strong>. Defina o utilizador e uma palavra-passe temporária para entrada na App Motorista.
            </p>
            <form onSubmit={handleCreateDriverLogin} className="space-y-3 text-xs">
              <input
                required
                autoCapitalize="none"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value.toLowerCase())}
                placeholder="Nome de utilizador (ex: joao.silva)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white font-mono outline-none"
              />
              <input
                required
                type="password"
                minLength={6}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Palavra-passe temporária (mín. 6 car.)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'A criar acesso...' : 'Criar Login de Motorista'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Driver Password */}
      {resetPwdTargetDriver && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">Repor Palavra-passe do Motorista</h3>
              <button
                type="button"
                onClick={() => setResetPwdTargetDriver(null)}
                className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slide-dim">
              Conta: <strong className="text-white">@{resetPwdTargetDriver.loginUsername || resetPwdTargetDriver.fullName}</strong>
            </p>
            <form onSubmit={handleResetDriverPassword} className="space-y-3 text-xs">
              <input
                required
                type="password"
                minLength={6}
                value={resetPwdInput}
                onChange={(e) => setResetPwdInput(e.target.value)}
                placeholder="Nova palavra-passe temporária (mín. 6 car.)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2.5 text-white outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-accent text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'A guardar...' : 'Atualizar Palavra-passe'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit School Vehicle */}
      {vehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">
                {editingVehicleId ? 'Editar Viatura Própria da Escola' : 'Registar Viatura Própria da Escola'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setVehicleModalOpen(false);
                  setEditingVehicleId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSchoolVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Nº Frota (opc.)</label>
                  <input
                    type="number"
                    min={1}
                    disabled={Boolean(editingVehicleId)}
                    value={vehicleForm.fleetNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fleetNumber: e.target.value })}
                    placeholder="Auto"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono outline-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Matrícula</label>
                  <input
                    required
                    value={vehicleForm.plate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                    placeholder="LD-11-22-ES"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Lugares</label>
                  <input
                    type="number"
                    min={8}
                    value={vehicleForm.capacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) || 22 })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Rota da Escola</label>
                  <select
                    value={vehicleForm.routeCode}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, routeCode: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="">Sem rota definida</option>
                    <option value="RESERVA">RESERVA (Reserva Escolar)</option>
                    {schoolRoutesList.map((r) => (
                      <option key={r.id} value={r.code}>
                        {r.code} · {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Motorista da Escola</label>
                  <select
                    value={vehicleForm.assignedDriverId}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        assignedDriverId: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="">Sem motorista</option>
                    {manageableSchoolDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Validade DNVT</label>
                  <input
                    required
                    type="date"
                    value={vehicleForm.dnvtExpiry}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, dnvtExpiry: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Estado DNVT</label>
                  <select
                    value={vehicleForm.dnvtStatus}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        dnvtStatus: e.target.value as 'valid' | 'expiring_soon' | 'expired',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="valid">Válido</option>
                    <option value="expiring_soon">A expirar</option>
                    <option value="expired">Expirado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Seguradora</label>
                  <input
                    value={vehicleForm.insuranceProvider}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceProvider: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Estado Seguro</label>
                  <select
                    value={vehicleForm.insuranceStatus}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        insuranceStatus: e.target.value as 'valid' | 'pending' | 'expired',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="valid">Válido</option>
                    <option value="pending">Pendente</option>
                    <option value="expired">Expirado</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting
                  ? 'A guardar...'
                  : editingVehicleId
                  ? 'Guardar Alterações da Viatura'
                  : 'Registar Viatura Própria'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit School Schedule */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-black">
                {editingScheduleId ? 'Editar Escala da Escola' : 'Agendar Escala Recorrente da Escola'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setScheduleModalOpen(false);
                  setEditingScheduleId(null);
                }}
                className="p-1.5 rounded-full bg-slide-surface text-slide-dim cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {scheduleError && (
              <div className="rounded-xl bg-red-500/15 border border-red-500/40 px-3 py-2 text-xs text-red-200">
                {scheduleError}
              </div>
            )}
            <form onSubmit={handleSaveSchoolSchedule} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slide-dim mb-1">Rota da Escola</label>
                <select
                  required
                  value={scheduleForm.routeCode}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, routeCode: e.target.value })}
                  className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                >
                  <option value="">Selecionar rota...</option>
                  {schoolRoutesList.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.code} · {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Viatura Própria</label>
                  <select
                    value={scheduleForm.vehicleId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        vehicleId: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="">Por alocar</option>
                    {manageableSchoolVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        Autocarro {v.fleetNumber} ({v.plate})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Motorista da Escola</label>
                  <select
                    value={scheduleForm.driverId}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        driverId: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="">Automático / Por alocar</option>
                    {manageableSchoolDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slide-dim mb-1">Dias da Semana</label>
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
                            days: checked
                              ? prev.days.filter((d) => d !== w.id)
                              : [...prev.days, w.id],
                          }))
                        }
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                          checked
                            ? 'bg-slide-accent text-white border-slide-accent'
                            : 'bg-slide-bg border-white/15 text-slide-dim'
                        }`}
                      >
                        {w.short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Turno</label>
                  <select
                    value={scheduleForm.shiftType}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        shiftType: e.target.value === 'afternoon' ? 'afternoon' : 'morning',
                      })
                    }
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
                  >
                    <option value="morning">Manhã</option>
                    <option value="afternoon">Tarde</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Partida</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.departureTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, departureTime: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slide-dim mb-1">Chegada</label>
                  <input
                    required
                    type="time"
                    value={scheduleForm.arrivalTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, arrivalTime: e.target.value })}
                    className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white font-mono outline-none"
                  />
                </div>
              </div>
              <input
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                placeholder="Notas operacionais (opcional)"
                className="w-full rounded-xl bg-slide-bg border border-white/15 px-3 py-2 text-white outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-slide-ok text-white py-3 font-bold cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'A guardar...' : editingScheduleId ? 'Guardar Escala' : 'Agendar Escala'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
