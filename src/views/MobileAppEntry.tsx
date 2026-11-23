import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  Compass,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
  Copy,
} from 'lucide-react';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { AuthGatePanel } from '@/components/AuthGatePanel';
import { LegalComplianceModal, type LegalTab } from '@/components/LegalComplianceModal';
import { LuandaMap } from '@/components/LuandaMap';
import { useTelemetrySocket } from '@/hooks/useTelemetrySocket';

const NativeMobileApp = lazy(() =>
  import('@/views/NativeMobileApp').then((m) => ({ default: m.NativeMobileApp }))
);
import { estimateRouteProgressFromCoords, getRouteConfigByCode } from '@/lib/luanda-geofence';
import {
  initNativeStatusBar,
  registerNativePush,
  watchDeviceLocation,
  watchDeviceNetwork,
} from '@/lib/native-bridge';
import { APP_TARGET, getDevicePlatform, isNativeCapacitor } from '@/lib/runtime-config';
import {
  enqueueOfflineEvent,
  flushOfflineQueue,
  getQueuedEvents,
  type QueuedAttendanceEvent,
} from '@/lib/offline-queue';
import { formatAOA } from '@/lib/mobuss-sync';

interface GuardianDashboardData {
  students: Array<{
    id: number;
    fullName: string;
    schoolName: string;
    routeCode: string;
    stopName: string;
    currentJourneyState: string;
    pinPolicy: string;
    handoverCredential: {
      maskedDisplay: string;
      status: string;
      expiresAt: string;
      tripScope: string;
      lockedUntil: string | null;
    } | null;
    activeTrip: {
      id: number;
      tripCode: string;
      routeName: string;
      legType: string;
      state: string;
      gpsStatus: string;
      lastLat: string | null;
      lastLng: string | null;
      lastLocationAt: string | null;
      vehiclePlate: string | null;
      fleetNumber: number | null;
      driverName: string | null;
    } | null;
  }>;
  pricing: {
    studentMonthlyFeeAoa: number;
    multicaixaEntityCode?: string;
  } | null;
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    studentName: string;
    amountAoa: number;
    paymentEntity?: string | null;
    paymentReferencePin?: string | null;
    status: string;
    fiscalStatus: string;
  }>;
}

interface DriverDashboardData {
  trips: Array<{
    id: number;
    tripCode: string;
    routeCode: string;
    routeName: string;
    legType: string;
    state: string;
    gpsStatus: string;
    lastLat: string | null;
    lastLng: string | null;
    lastLocationAt: string | null;
    emptyBusSweepVerified: boolean;
  }>;
  manifest: Array<{
    id: number;
    fullName: string;
    routeCode: string;
    stopName: string;
    currentJourneyState: string;
    pinPolicy: string;
  }>;
}

interface OwnerDashboardData {
  owner: {
    id: number;
    fullName: string;
    ownerType: string;
    nif: string | null;
    phone: string;
    email: string | null;
    settlementModel: string;
    monthlySettlementAoa: number;
    verificationStatus: string;
  } | null;
  vehicles: Array<{
    id: number;
    fleetNumber: number;
    plate: string;
    ownershipType: string;
    routeCode: string;
    routeName: string;
    capacity: number;
    status: string;
    fuelPercent: number;
    dnvtExpiry: string;
    dnvtStatus: string;
    insuranceProvider: string;
    insuranceStatus: string;
    verificationStatus: string;
    assignedDriverName: string;
    assignedDriverPhone: string;
    activeTripCode: string | null;
    activeTripState: string | null;
  }>;
  summary: {
    totalVehicles: number;
    activeVehicles: number;
    dnvtValidCount: number;
    insuranceValidCount: number;
    estimatedMonthlySettlementAoa: number;
  };
}

interface MobileAppEntryProps {
  mode: 'client' | 'driver';
}

export function MobileAppEntry({ mode }: MobileAppEntryProps) {
  const { isAuthenticated, dbUser, capabilities, loading: authLoading, apiFetch, signOut } = useAuth();
  const [clientProfile, setClientProfile] = useState<'parent' | 'company'>('parent');
  const [storeSingleScreenPreview, setStoreSingleScreenPreview] = useState(false);
  const [guardianData, setGuardianData] = useState<GuardianDashboardData | null>(null);
  const [ownerData, setOwnerData] = useState<OwnerDashboardData | null>(null);
  const [driverData, setDriverData] = useState<DriverDashboardData | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  // Driver live GPS + PIN validation + IndexedDB offline queue + WebSocket telemetry
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'unavailable' | 'watching' | 'error'>('unavailable');
  const [pinTargetStudentId, setPinTargetStudentId] = useState<number | null>(null);
  const [pinPhase, setPinPhase] = useState<'boarding' | 'dropoff'>('boarding');
  const [pinInput, setPinInput] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<QueuedAttendanceEvent[]>([]);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('Motivo de saúde / consulta');
  const [sosCategory, setSosCategory] = useState('traffic_delay');
  const [sosDescription, setSosDescription] = useState('');
  const [geofenceAlert, setGeofenceAlert] = useState<{
    routeCode: string;
    stopName: string;
    distanceMeters: number;
    etaMinutes: number;
  } | null>(null);
  const [liveRouteProgress, setLiveRouteProgress] = useState<Record<string, { progress: number; nearestStopName?: string; etaMinutes?: number }>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [activePaymentPin, setActivePaymentPin] = useState<{
    invoiceNumber: string;
    entity: string;
    pin: string;
    amountAoa: number;
  } | null>(null);

  const isVehicleOwner = mode === 'client' && dbUser?.primaryRole === 'vehicle_owner';

  const loadBackendState = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      if (mode === 'client') {
        if (dbUser?.primaryRole === 'vehicle_owner') {
          const res = await apiFetch<OwnerDashboardData>('/api/v1/owner/dashboard');
          setOwnerData(res);
        } else {
          const res = await apiFetch<GuardianDashboardData>('/api/v1/guardian/dashboard');
          setGuardianData(res);
          if (!selectedStudentId && res.students[0]) {
            setSelectedStudentId(res.students[0].id);
          }
        }
      } else if (capabilities.canAccessDriverApp) {
        const res = await apiFetch<DriverDashboardData>('/api/v1/driver/dashboard');
        setDriverData(res);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao sincronizar com servidor.');
    }
  }, [isAuthenticated, mode, dbUser?.primaryRole, capabilities.canAccessDriverApp, apiFetch, selectedStudentId]);

  const { connected: wsConnected } = useTelemetrySocket((event) => {
    if (event.type === 'trip:location') {
      const routeCode = String(event.payload.routeCode ?? '');
      const progress = Number(event.payload.progress ?? 0);
      const nearestStopName = event.payload.nearestStopName ? String(event.payload.nearestStopName) : undefined;
      const etaMinutes = event.payload.etaMinutes != null ? Number(event.payload.etaMinutes) : undefined;
      if (routeCode) {
        setLiveRouteProgress((prev) => ({
          ...prev,
          [routeCode]: { progress, nearestStopName, etaMinutes },
        }));
      }
      return;
    }

    if (event.type === 'geofence:approach_500m') {
      setGeofenceAlert({
        routeCode: String(event.payload.routeCode ?? ''),
        stopName: String(event.payload.stopName ?? ''),
        distanceMeters: Number(event.payload.distanceMeters ?? 0),
        etaMinutes: Number(event.payload.etaMinutes ?? 1),
      });
      return;
    }

    if (
      event.type === 'trip:state' ||
      event.type === 'attendance:updated' ||
      event.type === 'pin:validated' ||
      event.type === 'incident:created'
    ) {
      void loadBackendState();
    }
  });

  useEffect(() => {
    void loadBackendState();
  }, [loadBackendState]);

  const syncOfflineQueueNow = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await flushOfflineQueue(apiFetch);
    const remaining = await getQueuedEvents();
    setOfflineQueue(remaining);
    if (res.syncedCount > 0) {
      setStatusMessage(`${res.syncedCount} evento(s) da fila offline IndexedDB sincronizado(s) com o PostgreSQL.`);
      await loadBackendState();
    }
  }, [isAuthenticated, apiFetch, loadBackendState]);

  const devicePlatform = getDevicePlatform();

  useEffect(() => {
    initNativeStatusBar();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    return registerNativePush({
      onToken: (token, platform) => {
        void apiFetch('/api/v1/devices/push-token', {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform,
            appTarget: APP_TARGET === 'hub' ? mode : APP_TARGET,
          }),
        }).catch(() => null);
      },
      onNotification: (title, body) => {
        setStatusMessage(`${title}: ${body}`);
      },
    });
  }, [isAuthenticated, mode, apiFetch]);

  useEffect(() => {
    if (mode !== 'driver') return;
    void getQueuedEvents().then(setOfflineQueue);
    return watchDeviceNetwork((isOnline) => {
      if (isOnline && !simulateOffline) {
        void syncOfflineQueueNow();
      }
    });
  }, [mode, simulateOffline, syncOfflineQueueNow]);

  // Real Geolocation watcher for Driver App (Capacitor Native GPS on iOS/Android + Web fallback)
  useEffect(() => {
    if (mode !== 'driver' || !isAuthenticated || !capabilities.canAccessDriverApp) return;

    const activeTrip = driverData?.trips.find((t) => t.state === 'in_progress') ?? driverData?.trips[0];
    setGpsStatus('watching');

    return watchDeviceLocation(
      (pos) => {
        setGpsCoords({
          lat: pos.lat,
          lng: pos.lng,
          at: pos.at,
        });
        if (activeTrip) {
          void apiFetch('/api/v1/driver/location-batches', {
            method: 'POST',
            body: JSON.stringify({
              tripId: activeTrip.id,
              latitude: pos.lat,
              longitude: pos.lng,
            }),
          }).catch(() => null);
        }
      },
      () => {
        setGpsStatus('unavailable');
      }
    );
  }, [mode, isAuthenticated, capabilities.canAccessDriverApp, driverData?.trips, apiFetch]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink grid place-items-center text-xs text-slide-dim">
        A carregar sessão MôBuss...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthGatePanel
        title={mode === 'driver' ? 'MôBuss Motorista · App Oficial' : 'MôBuss Cliente · App Encarregado'}
        subtitle={
          mode === 'driver'
            ? 'Inicie sessão com a sua conta autorizada de motorista para aceder ao manifesto da rota, GPS real e validação de PIN no servidor.'
            : 'Inicie sessão para acompanhar em tempo real os seus educandos vinculados, gerar códigos PIN seguros e consultar faturas.'
        }
        badgeText={mode === 'driver' ? 'Entregável App Store / Play Store · Motorista' : 'Entregável App Store / Play Store · Cliente'}
      />
    );
  }

  if (mode === 'driver' && !capabilities.canAccessDriverApp) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-ink grid place-items-center p-6">
        <div className="max-w-md rounded-2xl bg-slide-paper-ink border border-white/10 p-6 text-center space-y-3">
          <Lock className="w-8 h-8 text-slide-accent mx-auto" />
          <h2 className="text-lg font-black">Acesso Exclusivo a Motoristas Autorizados</h2>
          <p className="text-xs text-slide-dim">
            O seu perfil atual ({dbUser ? ROLE_LABELS[dbUser.primaryRole] : 'Utilizador'}) não tem permissão de condução ativa.
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

  const activeKid =
    guardianData?.students.find((s) => s.id === selectedStudentId) ?? guardianData?.students[0] ?? null;

  async function handleRotatePin() {
    if (!activeKid) return;
    try {
      const res = await apiFetch<{ pin: string; message: string }>('/api/v1/guardian/handover-credentials/rotate', {
        method: 'POST',
        body: JSON.stringify({ studentId: activeKid.id }),
      });
      setRevealedPin(res.pin);
      setStatusMessage(res.message);
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao gerar PIN.');
    }
  }

  async function handleCreatePaymentIntent() {
    if (!activeKid) return;
    try {
      const res = await apiFetch<{
        message: string;
        paymentEntity: string;
        paymentReferencePin: string;
        amountAoa: number;
        invoice?: { invoiceNumber: string };
      }>('/api/v1/guardian/payment-intents', {
        method: 'POST',
        body: JSON.stringify({ studentName: activeKid.fullName }),
      });
      setActivePaymentPin({
        invoiceNumber: res.invoice?.invoiceNumber || 'PRO-MOB',
        entity: res.paymentEntity,
        pin: res.paymentReferencePin,
        amountAoa: res.amountAoa,
      });
      setStatusMessage(res.message);
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao gerar PIN de pagamento.');
    }
  }

  async function handleValidatePinServer(e: React.FormEvent) {
    e.preventDefault();
    if (!pinTargetStudentId) return;
    const activeTrip = driverData?.trips[0];
    try {
      const res = await apiFetch<{ valid: boolean; message: string }>('/api/v1/driver/handover/validate', {
        method: 'POST',
        body: JSON.stringify({
          studentId: pinTargetStudentId,
          tripId: activeTrip?.id,
          pin: pinInput.trim(),
          pinPhase,
        }),
      });
      setStatusMessage(res.message);
      setPinTargetStudentId(null);
      setPinInput('');
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'PIN inválido.');
    }
  }

  async function handleTransitionTrip(tripId: number, nextState: string) {
    try {
      await apiFetch(`/api/v1/driver/trips/${tripId}/transition`, {
        method: 'POST',
        body: JSON.stringify({ nextState }),
      });
      setStatusMessage(`Estado da viagem atualizado para "${nextState}".`);
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Transição bloqueada.');
    }
  }

  async function handleEmptySweep(tripId: number) {
    try {
      await apiFetch(`/api/v1/driver/trips/${tripId}/empty-sweep`, {
        method: 'POST',
      });
      setStatusMessage('Inspeção anti-esquecimento registada no PostgreSQL.');
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao registar inspeção.');
    }
  }

  async function handleReportAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!activeKid) return;
    try {
      const res = await apiFetch<{ message: string }>('/api/v1/guardian/absences', {
        method: 'POST',
        body: JSON.stringify({
          studentId: activeKid.id,
          reason: absenceReason.trim() || 'Ausência comunicada pelo encarregado',
          eventId: crypto.randomUUID(),
        }),
      });
      setStatusMessage(res.message);
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao registar ausência.');
    }
  }

  async function handleSubmitIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!sosDescription.trim()) return;
    const activeTrip = mode === 'driver' ? driverData?.trips[0] : activeKid?.activeTrip;
    try {
      await apiFetch('/api/v1/incidents', {
        method: 'POST',
        body: JSON.stringify({
          tripId: activeTrip?.id ?? null,
          routeCode: mode === 'driver' ? driverData?.trips[0]?.routeCode : activeKid?.routeCode ?? null,
          category: sosCategory,
          severity: sosCategory === 'general_sos' || sosCategory === 'medical' ? 'critical' : 'high',
          description: sosDescription.trim(),
        }),
      });
      setSosDescription('');
      setStatusMessage('Ocorrência SOS enviada em tempo real à Central MôBuss.');
      await loadBackendState();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Erro ao enviar ocorrência.');
    }
  }

  async function handleQueueOrSyncBoarding(studentId: number, studentName?: string) {
    const activeTrip = driverData?.trips[0];
    if (!activeTrip) return;
    const queuedItem: QueuedAttendanceEvent = {
      eventId: crypto.randomUUID(),
      tripId: activeTrip.id,
      studentId,
      studentName,
      eventType: 'boarded',
      occurredAt: new Date().toISOString(),
      offlineSequence: Date.now(),
      latitude: gpsCoords?.lat,
      longitude: gpsCoords?.lng,
    };

    if (!navigator.onLine || simulateOffline) {
      await enqueueOfflineEvent(queuedItem);
      const allQueued = await getQueuedEvents();
      setOfflineQueue(allQueued);
      setStatusMessage('Modo offline ativo: presença guardada no IndexedDB (será sincronizada ao reconectar).');
      return;
    }

    try {
      await apiFetch(`/api/v1/driver/trips/${activeTrip.id}/attendance-events`, {
        method: 'POST',
        body: JSON.stringify(queuedItem),
      });
      setStatusMessage('Presença sincronizada com o PostgreSQL e emitida via WebSocket.');
      await loadBackendState();
    } catch {
      await enqueueOfflineEvent(queuedItem);
      const allQueued = await getQueuedEvents();
      setOfflineQueue(allQueued);
      setStatusMessage('Falha de rede: evento guardado com segurança na fila offline IndexedDB.');
    }
  }

  const isStandaloneMobile = APP_TARGET !== 'hub' || isNativeCapacitor() || storeSingleScreenPreview;

  return (
    <div
      className={`bg-slide-bg text-slide-ink flex flex-col lg:flex-row ${
        APP_TARGET !== 'hub'
          ? 'min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
          : 'min-h-[calc(100vh-3.5rem)]'
      }`}
    >
      {/* Left Preview Frame: shown only on Desktop Hub when not previewing single-screen store binary */}
      {!isStandaloneMobile && (
        <div className="w-full lg:w-[440px] shrink-0 h-[calc(100vh-3.5rem)] border-r border-white/10 bg-black flex flex-col">
          {mode === 'client' && capabilities.canAccessAdmin && (
            <div className="bg-slide-paper-ink border-b border-white/10 px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-slide-dim font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-slide-ok" />
                <span>Perfil Operacional Autorizado:</span>
              </span>
              <div className="flex items-center gap-1 bg-slide-bg p-0.5 rounded-lg border border-white/10">
                <button
                  onClick={() => setClientProfile('parent')}
                  className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                    clientProfile === 'parent' ? 'bg-slide-accent text-white' : 'text-slide-dim'
                  }`}
                >
                  Encarregado
                </button>
                <button
                  onClick={() => setClientProfile('company')}
                  className={`px-2 py-1 rounded-md font-bold cursor-pointer ${
                    clientProfile === 'company' ? 'bg-slide-accent text-white' : 'text-slide-dim'
                  }`}
                >
                  Operações MôBuss
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="h-full grid place-items-center text-xs text-slide-dim">A carregar pré-visualização...</div>}>
              <NativeMobileApp initialRole={mode === 'driver' ? 'driver' : clientProfile} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Live PostgreSQL Mobile Screen (Single unified view in store binaries, companion panel on Hub) */}
      <div className={`flex-1 min-w-0 p-4 sm:p-7 overflow-y-auto space-y-6 ${isStandaloneMobile ? 'max-w-xl mx-auto w-full' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slide-accent flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              <span>
                {mode === 'driver'
                  ? 'MôBuss Motorista · App Oficial'
                  : isVehicleOwner
                  ? 'MôBuss Parceiro · Proprietário de Frota'
                  : 'MôBuss Cliente · App Encarregado'}
              </span>
            </div>
            <h2 className="text-xl font-black mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {mode === 'driver'
                ? 'GPS, Viagens & Validação PIN'
                : isVehicleOwner
                ? 'Frota Parceira, DNVT & Liquidação'
                : 'Educandos, PIN Seguro & Pagamentos'}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {APP_TARGET === 'hub' && !isNativeCapacitor() && (
              <button
                type="button"
                onClick={() => setStoreSingleScreenPreview((v) => !v)}
                className="rounded-xl bg-slide-bg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-slide-dim hover:text-white cursor-pointer"
              >
                {storeSingleScreenPreview ? 'Mostrar Demo Lado-a-Lado' : 'Modo Ecrã Único (App Loja)'}
              </button>
            )}
            <span className="rounded-xl px-2.5 py-1.5 text-[11px] font-mono font-bold bg-slide-surface border border-white/10 text-slide-dim">
              {devicePlatform === 'ios' ? 'iOS Nativo' : devicePlatform === 'android' ? 'Android Nativo' : 'Web / PWA'}
            </span>
            <span
              className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5 border ${
                wsConnected
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{wsConnected ? 'Ao Vivo' : 'A ligar...'}</span>
            </span>

            <button
              onClick={() => void loadBackendState()}
              className="rounded-xl bg-slide-surface border border-white/10 px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-white/10"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>

            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl bg-slide-surface border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-300 cursor-pointer hover:bg-red-500/15 inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {geofenceAlert && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/40 p-3.5 text-xs flex items-center justify-between gap-2">
            <span className="font-semibold text-emerald-200">
              Alerta 500m ({geofenceAlert.routeCode}): Autocarro a {geofenceAlert.distanceMeters}m de{' '}
              <strong>{geofenceAlert.stopName}</strong> · Chegada em ~{geofenceAlert.etaMinutes} min.
            </span>
            <button onClick={() => setGeofenceAlert(null)} className="text-emerald-300 underline cursor-pointer shrink-0">
              OK
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="rounded-xl bg-slide-surface border border-slide-accent/40 p-3.5 text-xs flex items-center justify-between gap-2">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-slide-dim underline cursor-pointer">
              Fechar
            </button>
          </div>
        )}

        {mode === 'client' && isVehicleOwner ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-1">
                <div className="text-slide-dim">Viaturas Vinculadas</div>
                <div className="text-2xl font-black text-white tabular-nums">
                  {ownerData?.summary.totalVehicles ?? 0}
                </div>
                <div className="text-[11px] text-slide-ok font-semibold">
                  {ownerData?.summary.activeVehicles ?? 0} em operação ativa
                </div>
              </div>

              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-1">
                <div className="text-slide-dim">Liquidação Mensal Prevista</div>
                <div className="text-2xl font-black text-slide-accent font-mono tabular-nums">
                  {formatAOA(ownerData?.summary.estimatedMonthlySettlementAoa ?? 0)}
                </div>
                <div className="text-[11px] text-slide-dim">
                  {ownerData?.owner?.settlementModel === 'per_trip' ? 'Modelo por viagem' : 'Mensalidade fixa por viatura'}
                </div>
              </div>

              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-1">
                <div className="text-slide-dim">Conformidade DNVT & Seguro</div>
                <div className="text-2xl font-black text-white tabular-nums">
                  {ownerData?.summary.dnvtValidCount ?? 0}/{ownerData?.summary.totalVehicles ?? 0}
                </div>
                <div className="text-[11px] text-slide-dim">
                  {ownerData?.summary.insuranceValidCount ?? 0} apólice(s) ENSA válidas
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Perfil de Parceiro Verificado</h3>
                  <p className="text-[11px] text-slide-dim">
                    {ownerData?.owner
                      ? `${ownerData.owner.fullName} · NIF: ${ownerData.owner.nif || 'A atualizar'} · Tel: ${ownerData.owner.phone}`
                      : 'Conta de proprietário parceiro aguardando alocação de viaturas pela Gestão de Frota.'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 font-bold text-[11px]">
                  {ownerData?.owner?.verificationStatus === 'verified' ? 'Parceiro Verificado' : 'Em Verificação'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bus className="w-4 h-4 text-slide-accent" />
                <span>As Minhas Viaturas & Motoristas Alocados ({ownerData?.vehicles.length ?? 0})</span>
              </h3>

              {(ownerData?.vehicles ?? []).length === 0 ? (
                <div className="rounded-xl bg-slide-bg border border-white/10 p-4 text-slide-dim">
                  Nenhuma viatura associada ao seu perfil ainda. A Gestão de Frota MôBuss pode alocar os seus autocarros no painel Admin.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(ownerData?.vehicles ?? []).map((v) => (
                    <div key={v.id} className="rounded-xl bg-slide-bg border border-white/10 p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-white">
                            Autocarro {v.fleetNumber} · <span className="font-mono text-slide-accent">{v.plate}</span>
                          </div>
                          <div className="text-[11px] text-slide-dim">
                            Rota: <strong className="text-white">{v.routeCode}</strong> ({v.routeName}) · Lotação: {v.capacity} lugares
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/10 font-mono text-[11px] text-white">
                          {v.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                        <div className="rounded-lg bg-slide-surface/60 px-3 py-2">
                          <div className="text-slide-dim">Motorista Alocado</div>
                          <div className="font-bold text-white">{v.assignedDriverName}</div>
                          <div className="text-slide-dim font-mono">{v.assignedDriverPhone}</div>
                        </div>
                        <div className="rounded-lg bg-slide-surface/60 px-3 py-2">
                          <div className="text-slide-dim">Inspeção DNVT</div>
                          <div className={`font-bold ${v.dnvtStatus === 'valid' ? 'text-slide-ok' : 'text-amber-300'}`}>
                            {v.dnvtStatus === 'valid' ? 'Válida' : v.dnvtStatus}
                          </div>
                          <div className="text-slide-dim font-mono">Validade: {v.dnvtExpiry}</div>
                        </div>
                        <div className="rounded-lg bg-slide-surface/60 px-3 py-2">
                          <div className="text-slide-dim">Seguro & Combustível</div>
                          <div className="font-bold text-white">
                            {v.insuranceProvider} ({['valid', 'active'].includes(v.insuranceStatus) ? 'Válido' : 'Pendente'})
                          </div>
                          <div className="text-slide-dim font-mono">Combustível: {v.fuelPercent}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitIncident} className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2.5 text-xs">
              <h3 className="font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-slide-accent" />
                <span>Comunicar Ocorrência / Manutenção à Gestão de Frota</span>
              </h3>
              <input
                required
                value={sosDescription}
                onChange={(e) => setSosDescription(e.target.value)}
                placeholder="Ex: Solicitação de revisão preventiva ou alteração de motorista..."
                className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-slide-accent text-white py-2 font-bold cursor-pointer"
              >
                Enviar Comunicação à Central
              </button>
            </form>
          </div>
        ) : mode === 'client' ? (
          <div className="space-y-6">
            {/* Guardian Linked Children */}
            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Educandos Autorizados ({guardianData?.students.length ?? 0})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {guardianData?.students.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudentId(s.id);
                        setRevealedPin(null);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                        activeKid?.id === s.id
                          ? 'bg-slide-accent text-white'
                          : 'bg-slide-bg border border-white/10 text-slide-dim'
                      }`}
                    >
                      {s.fullName}
                    </button>
                  ))}
                </div>
              </div>

              {activeKid ? (
                <div className="space-y-4">
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    {(() => {
                      const routeCfg = getRouteConfigByCode(activeKid.routeCode);
                      const wsLive = liveRouteProgress[activeKid.routeCode];
                      const dbLat = activeKid.activeTrip?.lastLat ? Number(activeKid.activeTrip.lastLat) : null;
                      const dbLng = activeKid.activeTrip?.lastLng ? Number(activeKid.activeTrip.lastLng) : null;
                      const progress =
                        wsLive?.progress ??
                        (dbLat && dbLng ? estimateRouteProgressFromCoords(activeKid.routeCode, dbLat, dbLng) : 0.05);
                      return (
                        <div>
                          <LuandaMap routeId={routeCfg.id} progress={progress} className="h-44 w-full" />
                          <div className="bg-slide-bg px-3 py-2 text-[11px] flex flex-wrap justify-between gap-2 border-t border-white/10">
                            <span className="text-slide-dim">
                              Próxima paragem:{' '}
                              <strong className="text-white">{wsLive?.nearestStopName ?? activeKid.stopName}</strong>
                            </span>
                            <span className="font-mono text-slide-ok font-semibold">
                              Estado aluno: {activeKid.currentJourneyState}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl bg-slide-bg border border-white/10 p-4 space-y-2">
                      <div className="text-slide-dim">Viagem Ativa & GPS</div>
                      <div className="font-bold text-sm text-white">
                        {activeKid.activeTrip?.routeName ?? activeKid.routeCode}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        {activeKid.activeTrip?.gpsStatus === 'live' ? (
                          <span className="text-slide-ok font-bold inline-flex items-center gap-1">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>GPS ao vivo</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold inline-flex items-center gap-1">
                            <WifiOff className="w-3.5 h-3.5" />
                            <span>Sinal GPS indisponível</span>
                          </span>
                        )}
                        {activeKid.activeTrip?.lastLocationAt && (
                          <span className="text-slide-dim font-mono">
                            · {new Date(activeKid.activeTrip.lastLocationAt).toLocaleTimeString('pt-AO')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slide-dim">
                        Escola: <strong className="text-white">{activeKid.schoolName}</strong> · Paragem: {activeKid.stopName}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slide-bg border border-white/10 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slide-dim font-semibold flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-slide-ok" />
                          <span>PIN Seguro (Embarque + Desembarque)</span>
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-bold">
                          {activeKid.handoverCredential?.status ?? 'active'}
                        </span>
                      </div>

                      <div className="text-2xl font-mono font-black tracking-widest text-white">
                        {revealedPin ?? activeKid.handoverCredential?.maskedDisplay ?? '••••'}
                      </div>
                      <p className="text-[11px] text-slide-dim">
                        Armazenado apenas em hash no servidor. Gere um novo código de uso único abaixo quando precisar:
                      </p>
                      <button
                        onClick={handleRotatePin}
                        className="w-full rounded-xl bg-slide-accent text-white py-2 font-bold cursor-pointer"
                      >
                        Gerar / Revelar Novo PIN Seguro
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slide-dim">Nenhum educando vinculado à sua conta ainda.</div>
              )}
            </div>

            {/* Parent Absence & Emergency Reporting */}
            {activeKid && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <form onSubmit={handleReportAbsence} className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2.5">
                  <h3 className="font-bold text-white">Comunicar Falta / Ausência</h3>
                  <input
                    required
                    value={absenceReason}
                    onChange={(e) => setAbsenceReason(e.target.value)}
                    placeholder="Motivo da ausência..."
                    className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-slide-bg border border-white/15 hover:bg-white/10 text-white py-2 font-bold cursor-pointer"
                  >
                    Registar Ausência de {activeKid.fullName}
                  </button>
                </form>

                <form onSubmit={handleSubmitIncident} className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2.5">
                  <h3 className="font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-slide-accent" />
                    <span>Alerta SOS / Suporte Central</span>
                  </h3>
                  <input
                    required
                    value={sosDescription}
                    onChange={(e) => setSosDescription(e.target.value)}
                    placeholder="Ex: Mudança urgente ou atraso na paragem..."
                    className="w-full rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-slide-accent text-white py-2 font-bold cursor-pointer"
                  >
                    Enviar Alerta à Central
                  </button>
                </form>
              </div>
            )}

            {/* Multicaixa Express Entity + Reference PIN Card */}
            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">Multicaixa Express · Pagamento por Entidade</h3>
                  <p className="text-[11px] text-slide-dim">
                    Gere uma referência/PIN para pagar na opção <strong>Pagamento por Referência / Entidade</strong> do Multicaixa Express.
                  </p>
                </div>
                <button
                  onClick={handleCreatePaymentIntent}
                  className="rounded-xl bg-slide-accent text-white px-4 py-2 font-bold cursor-pointer shrink-0"
                >
                  Gerar PIN Multicaixa ({formatAOA(guardianData?.pricing?.studentMonthlyFeeAoa ?? 3000)})
                </button>
              </div>

              {activePaymentPin && (
                <div className="rounded-2xl bg-orange-500/10 border border-orange-500/35 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300">
                      Dados para Multicaixa Express · {activePaymentPin.invoiceNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(activePaymentPin.pin.replace(/\s+/g, ''));
                        setStatusMessage(`PIN de pagamento ${activePaymentPin.pin} copiado.`);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/20 text-orange-200 font-bold text-[11px] cursor-pointer hover:bg-orange-500/30"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar PIN</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                    <div className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                      <div className="text-[10px] text-slide-dim">Entidade</div>
                      <div className="text-base font-black text-white">{activePaymentPin.entity}</div>
                    </div>
                    <div className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                      <div className="text-[10px] text-slide-dim">Referência / PIN</div>
                      <div className="text-base font-black text-orange-300 tracking-wider">{activePaymentPin.pin}</div>
                    </div>
                    <div className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2">
                      <div className="text-[10px] text-slide-dim">Montante</div>
                      <div className="text-base font-black text-white tabular-nums">{formatAOA(activePaymentPin.amountAoa)}</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slide-dim">
                    No Multicaixa Express, aceda a <strong>Pagamentos → Pagamento por Referência</strong>, introduza a Entidade e a Referência/PIN acima.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                {(guardianData?.invoices ?? []).slice(0, 4).map((inv) => (
                  <div key={inv.id} className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2.5 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <span className="font-mono font-bold text-white">{inv.invoiceNumber}</span>
                      <span className="text-slide-dim ml-2">· {inv.studentName}</span>
                      {inv.paymentReferencePin && (
                        <div className="text-[11px] font-mono text-orange-300 mt-0.5">
                          Entidade: <strong>{inv.paymentEntity || '00845'}</strong> · PIN/Ref: <strong>{inv.paymentReferencePin}</strong>
                        </div>
                      )}
                    </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {inv.paymentReferencePin && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(inv.paymentReferencePin!.replace(/\s+/g, ''));
                              setStatusMessage(
                                `PIN ${inv.paymentReferencePin} (Entidade ${inv.paymentEntity || '00845'}) copiado para Multicaixa Express.`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-200 font-bold text-[10px] cursor-pointer hover:bg-orange-500/25"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar PIN</span>
                          </button>
                        )}
                        <span className="font-mono font-bold tabular-nums">{formatAOA(inv.amountAoa)}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'confirmed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {inv.status === 'confirmed' ? 'Confirmado' : 'Aguarda Pagamento MCX'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Driver Real GPS & Offline Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-slide-accent" />
                  <span>Telemetria GPS Real do Dispositivo</span>
                </div>
                {gpsCoords ? (
                  <div className="font-mono text-slide-ok">
                    Ativo ({gpsCoords.lat.toFixed(5)}, {gpsCoords.lng.toFixed(5)}) · {new Date(gpsCoords.at).toLocaleTimeString('pt-AO')}
                  </div>
                ) : (
                  <div className="text-amber-300 font-semibold">
                    {gpsStatus === 'watching'
                      ? 'A aguardar permissão/sinal GPS do dispositivo...'
                      : 'GPS indisponível (sem posição simulada)'}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Bus className="w-4 h-4 text-slide-ok" />
                    <span>Fila Offline IndexedDB</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulateOffline((v) => !v)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      simulateOffline ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-slide-dim'
                    }`}
                  >
                    {simulateOffline ? 'Modo Offline Simulado ON' : 'Simular Offline'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-slide-dim">
                  <span>
                    Eventos em fila local: <strong className="text-white">{offlineQueue.length}</strong>
                  </span>
                  {offlineQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSimulateOffline(false);
                        void syncOfflineQueueNow();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slide-ok text-white font-bold cursor-pointer"
                    >
                      Sincronizar Agora
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Trips (Morning & Afternoon Separated) */}
            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Compass className="w-4 h-4 text-slide-accent" />
                <span>Viagens Atribuídas & Máquina de Estados</span>
              </h3>
              {driverData?.trips.map((t) => {
                const routeCfg = getRouteConfigByCode(t.routeCode);
                const wsLive = liveRouteProgress[t.routeCode];
                const dbLat = t.lastLat ? Number(t.lastLat) : null;
                const dbLng = t.lastLng ? Number(t.lastLng) : null;
                const progress =
                  wsLive?.progress ??
                  (dbLat && dbLng ? estimateRouteProgressFromCoords(t.routeCode, dbLat, dbLng) : 0.05);
                return (
                  <div key={t.id} className="rounded-xl bg-slide-bg border border-white/10 p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <div className="font-bold text-sm text-white">{t.routeName}</div>
                        <div className="text-[11px] font-mono text-slide-dim">
                          {t.tripCode} · Estado atual: <strong className="text-slide-accent">{t.state}</strong>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => void handleTransitionTrip(t.id, 'in_progress')}
                          className="px-2.5 py-1 rounded-lg bg-slide-ok text-white font-bold cursor-pointer"
                        >
                          Iniciar
                        </button>
                        <button
                          onClick={() => void handleEmptySweep(t.id)}
                          className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/15 text-white font-semibold cursor-pointer"
                        >
                          {t.emptyBusSweepVerified ? 'Inspeção Vazio ✓' : 'Confirmar Autocarro Vazio'}
                        </button>
                        <button
                          onClick={() => void handleTransitionTrip(t.id, 'completed')}
                          className="px-2.5 py-1 rounded-lg bg-slide-accent text-white font-bold cursor-pointer"
                        >
                          Concluir Viagem
                        </button>
                      </div>
                    </div>
                    {driverData?.trips[0]?.id === t.id && (
                      <div className="rounded-lg overflow-hidden border border-white/10">
                        <LuandaMap routeId={routeCfg.id} progress={progress} darkMode className="h-36 w-full" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Driver Road Hazard / SOS Quick Report */}
            <form onSubmit={handleSubmitIncident} className="rounded-2xl bg-slide-surface border border-white/10 p-4 space-y-2.5 text-xs">
              <div className="font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slide-accent" />
                <span>Reportar Trânsito / Avaria / SOS à Central</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={sosCategory}
                  onChange={(e) => setSosCategory(e.target.value)}
                  className="rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                >
                  <option value="traffic_delay">Engarrafamento / Trânsito</option>
                  <option value="breakdown">Avaria Mecânica</option>
                  <option value="medical">Emergência Médica</option>
                  <option value="general_sos">SOS Urgente</option>
                </select>
                <input
                  required
                  value={sosDescription}
                  onChange={(e) => setSosDescription(e.target.value)}
                  placeholder="Descreva o local ou ocorrência..."
                  className="flex-1 min-w-[180px] rounded-xl bg-slide-bg border border-white/10 px-3 py-2 text-white outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slide-accent text-white px-4 py-2 font-bold cursor-pointer"
                >
                  Enviar SOS
                </button>
              </div>
            </form>

            {/* Driver Manifest with Server-Side Dual PIN Validation */}
            <div className="rounded-2xl bg-slide-surface border border-white/10 p-5 space-y-3 text-xs">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slide-accent" />
                <span>Manifesto da Rota (Validação Server-Side de PIN: Embarque & Desembarque)</span>
              </h3>
              <div className="space-y-2">
                {driverData?.manifest.map((st) => (
                  <div key={st.id} className="rounded-xl bg-slide-bg border border-white/10 p-3 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <div className="font-bold text-white">{st.fullName}</div>
                      <div className="text-[11px] text-slide-dim flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" />
                        <span>{st.routeCode} · {st.stopName} · Estado: {st.currentJourneyState}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void handleQueueOrSyncBoarding(st.id, st.fullName)}
                        className="px-2.5 py-1 rounded-lg bg-slide-surface border border-white/15 font-semibold cursor-pointer"
                      >
                        Registar Presença
                      </button>
                      <button
                        onClick={() => {
                          setPinTargetStudentId(st.id);
                          setPinPhase('boarding');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slide-accent text-white font-bold cursor-pointer"
                      >
                        Validar PIN
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slide-dim">
          <span>MôBuss Angola · Acesso Restrito</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-white underline cursor-pointer"
            >
              Privacidade
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-white underline cursor-pointer"
            >
              Termos
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => setLegalTab('deletion')}
              className="hover:text-white underline cursor-pointer"
            >
              Eliminar Conta
            </button>
          </div>
        </footer>
      </div>

      {/* Driver PIN Validation Modal (Server-Side) */}
      {pinTargetStudentId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleValidatePinServer}
            className="w-full max-w-sm rounded-2xl bg-slide-paper-ink border border-white/15 p-6 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 text-slide-accent font-bold uppercase tracking-wider text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Validação Criptográfica no Servidor (Máx. 5 Tentativas)</span>
            </div>
            <h3 className="text-base font-black text-white">Validar Código PIN de 4 Dígitos</h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPinPhase('boarding')}
                className={`py-2 rounded-xl font-bold border cursor-pointer ${
                  pinPhase === 'boarding'
                    ? 'bg-slide-accent border-slide-accent text-white'
                    : 'bg-slide-bg border-white/10 text-slide-dim'
                }`}
              >
                Embarque (Recolha)
              </button>
              <button
                type="button"
                onClick={() => setPinPhase('dropoff')}
                className={`py-2 rounded-xl font-bold border cursor-pointer ${
                  pinPhase === 'dropoff'
                    ? 'bg-slide-accent border-slide-accent text-white'
                    : 'bg-slide-bg border-white/10 text-slide-dim'
                }`}
              >
                Desembarque (Entrega)
              </button>
            </div>

            <input
              required
              maxLength={4}
              pattern="\d{4}"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Introduza o PIN de 4 dígitos"
              className="w-full rounded-xl bg-slide-bg border border-white/15 px-4 py-3 text-center font-mono text-xl font-black tracking-widest text-white outline-none"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-slide-ok text-white py-2.5 font-bold cursor-pointer"
              >
                Validar PIN no Servidor
              </button>
              <button
                type="button"
                onClick={() => setPinTargetStudentId(null)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 font-semibold text-slide-dim cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Store Compliance Legal & Account Deletion Footer */}
      <LegalComplianceModal
        open={legalTab !== null}
        initialTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
