import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSignature,
  GraduationCap,
  LayoutDashboard,
  Lock,
  LogOut,
  Plus,
  Route,
  Send,
  ShieldCheck,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { AuthGatePanel } from '@/components/AuthGatePanel';
import { APP_TARGET } from '@/lib/runtime-config';
import { useTelemetrySocket } from '@/hooks/useTelemetrySocket';
import { downloadCsv } from '@/lib/operations';
import { formatAOA } from '@/lib/mobuss-sync';

type SchoolTab =
  | 'Painel'
  | 'Alunos'
  | 'Pedidos'
  | 'Rotas & Presenças'
  | 'Contrato & Suporte';

const SCHOOL_TABS: Array<{ id: SchoolTab; Icon: LucideIcon }> = [
  { id: 'Painel', Icon: LayoutDashboard },
  { id: 'Alunos', Icon: GraduationCap },
  { id: 'Pedidos', Icon: Send },
  { id: 'Rotas & Presenças', Icon: ClipboardList },
  { id: 'Contrato & Suporte', Icon: FileSignature },
];

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
  const { isAuthenticated, dbUser, capabilities, loading: authLoading, apiFetch, signOut } = useAuth();
  const [tab, setTab] = useState<SchoolTab>('Painel');
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | ''>('');
  const [data, setData] = useState<SchoolPortalPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
        A verificar credenciais do Portal Escolar...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGatePanel
        title="Portal da Escola · MôBuss"
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
      showToast('Aluno submetido para aprovação da equipa MôBuss.');
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
      showToast('Pedido enviado à central de operações MôBuss.');
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
      showToast('Ocorrência enviada à equipa de suporte MôBuss.');
      await loadPortal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao submeter ocorrência.');
    } finally {
      setSubmitting(false);
    }
  }

  const school = data?.school;
  const studentsList = data?.students ?? [];
  const activeContract = data?.contracts[0];

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
            <div className="text-[10px] font-bold uppercase tracking-wider text-slide-accent">
              Portal da Escola
            </div>
            <div className="text-sm font-black text-slide-paper mt-1 leading-snug">
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
              A escola gere a sua pauta e solicita alterações; a MôBuss controla motoristas, viaturas e despacho.
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

      {/* Mobile Tabs */}
      <div className="lg:hidden border-b border-white/10 bg-slide-paper-ink px-4 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
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
        {APP_TARGET !== 'hub' && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer bg-red-500/15 text-red-300 hover:text-white ml-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-5 sm:p-7 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs text-slide-dim flex items-center gap-2 flex-wrap">
              <span>{school?.name ?? 'Escola'}</span>
              <span>·</span>
              <span className="text-slide-ok font-semibold">
                {activeContract ? `Contrato ${activeContract.contractNumber}` : 'Portal Autenticado'}
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
                    <div className="text-xs text-slide-dim">Estado do Contrato</div>
                    <div className="text-2xl font-black text-slide-ok mt-1">
                      {activeContract?.status === 'active' ? 'Ativo' : activeContract?.status ?? '—'}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1">
                      {activeContract ? PAYER_LABEL[activeContract.payerModel] : 'Sem contrato'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Alunos Inscritos</div>
                    <div className="text-2xl font-black mt-1 tabular-nums">{studentsList.length}</div>
                    <div className="text-[11px] text-slide-dim mt-1">
                      PIN: {PIN_POLICY_LABEL[activeContract?.pinPolicy || 'both']}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Viagens Hoje</div>
                    <div className="text-2xl font-black text-slide-accent mt-1 tabular-nums">
                      {data?.trips.length ?? 0}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1">Manhã e Regresso separados</div>
                  </div>

                  <div className="rounded-2xl bg-slide-surface border border-white/10 p-5">
                    <div className="text-xs text-slide-dim">Pedidos em Análise</div>
                    <div className="text-2xl font-black mt-1 tabular-nums">
                      {data?.changeRequests.filter((r) => r.status === 'pending').length ?? 0}
                    </div>
                    <div className="text-[11px] text-slide-dim mt-1">Submetidos à MôBuss</div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                      <Bus className="w-4 h-4 text-slide-accent" />
                      <span>Viagens Contratadas (Só Leitura)</span>
                    </h2>
                    <span className="text-[11px] text-slide-dim">Operação gerida pela MôBuss</span>
                  </div>
                  {(data?.trips ?? []).length === 0 ? (
                    <div className="text-xs text-slide-dim py-4">Sem viagens programadas para hoje.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data?.trips.map((t) => (
                        <div key={t.id} className="rounded-xl bg-slide-bg border border-white/10 p-3.5 text-xs flex justify-between items-center">
                          <div>
                            <div className="font-bold text-white">{t.routeName}</div>
                            <div className="text-[11px] text-slide-dim font-mono mt-0.5">
                              {t.tripCode} · {t.legType === 'morning' ? 'Turno Manhã' : 'Turno Regresso'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] font-bold">
                              {t.state}
                            </span>
                            <div className="text-[10px] text-slide-dim mt-1">
                              GPS: {t.gpsStatus === 'live' ? 'Ao vivo' : 'Sem sinal'}
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
                                ? 'Aguarda MôBuss'
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

            {tab === 'Pedidos' && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
                <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4">
                  <h2 className="text-sm font-bold">Pedir Alteração de Serviço à MôBuss</h2>
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
                      {submitting ? 'A enviar...' : 'Submeter Pedido à Central MôBuss'}
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
                  <button
                    onClick={() => {
                      downloadCsv('pauta-escolar-mobuss.csv', [
                        ['Evento', 'ID Aluno', 'Fase PIN', 'Data/Hora', 'Notas'],
                        ...(data?.attendance ?? []).map((a) => [
                          a.eventType,
                          a.studentId,
                          a.pinPhase ?? '—',
                          a.occurredAt,
                          a.notes ?? '',
                        ]),
                      ]);
                      showToast('Pauta de presenças exportada sem dados PIN.');
                    }}
                    className="rounded-xl bg-slide-surface border border-white/10 px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar Pauta CSV</span>
                  </button>
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
                    <span>Comunicar Ocorrência à MôBuss</span>
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
                      placeholder="Descreva a situação para a central MôBuss..."
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
                  <option value="ROTA-A">ROTA-A (Morro Bento)</option>
                  <option value="ROTA-B">ROTA-B (Talatona)</option>
                  <option value="ROTA-C">ROTA-C (Viana)</option>
                  <option value="ROTA-D">ROTA-D (Miramar)</option>
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
                <span>{submitting ? 'A guardar...' : 'Submeter para Aprovação MôBuss'}</span>
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
    </div>
  );
}
