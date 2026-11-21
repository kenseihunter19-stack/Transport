import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Bus,
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CloudRain,
  Compass,
  Construction,
  Copy,
  CreditCard,
  FileText,
  Fuel,
  HelpCircle,
  KeyRound,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Navigation,
  Pause,
  Phone,
  Play,
  Radio,
  RotateCcw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Star,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { LuandaMap } from "@/components/LuandaMap";
import { LUANDA_ROUTES, type LuandaRouteConfig } from "@/lib/route-luanda";
import { MulticaixaModal } from "@/components/MulticaixaModal";
import { AttendanceReportModal } from "@/components/AttendanceReportModal";
import { VehicleDocumentsModal } from "@/components/VehicleDocumentsModal";
import {
  clearHazardForBus,
  exportAgtReceipt,
  formatAOA,
  publishHazardReport,
  publishSimulatorAlert,
  readMoBussSync,
  recordDriverRating,
  recordEmptyBusSweep,
  subscribeMoBussSync,
} from "@/lib/mobuss-sync";

export type Role = "parent" | "driver" | "company";

export type Student = {
  id: string;
  name: string;
  stop: number;
  school: string;
  guardian: string;
  phone: string;
  onBoard: boolean;
  droppedOff: boolean;
  absent: boolean;
  absenceReason?: string;
  pickupPin: string;
};

export type Contract = {
  id: string;
  client: string;
  buses: number;
  studentsCount: number;
  monthlyValue: string;
  contact: string;
  phone: string;
  status: "Ativo" | "Pedido" | "Recusado";
  date: string;
};

export type Emergency = {
  type: string;
  from: "Motorista" | "Encarregado" | "Escola";
  time: string;
  busNumber: number;
  details: string;
} | null;

export type QuickMessage = {
  id: string;
  sender: "driver" | "parent";
  senderName: string;
  text: string;
  time: string;
};

const EMERGENCY_TYPES = [
  { label: "Problema de saúde súbito de aluno", kind: "health" },
  { label: "Acidente de viação ligeiro", kind: "crash" },
  { label: "Avaria mecânica / Furo de pneu", kind: "mech" },
  { label: "Segurança pública / Bloqueio na via", kind: "sec" },
] as const;

const TUTORIAL_STEPS: Record<
  Role,
  Array<{ title: string; body: string; highlight: string }>
> = {
  parent: [
    {
      title: "Mapa ao Vivo & Corredores",
      body: "Acompanhe o autocarro em tempo real por Luanda, mude de corredor no topo e receba alertas a 500m antes da paragem.",
      highlight: "Sem esperas ao sol na paragem",
    },
    {
      title: "PIN de Recolha Segura",
      body: "O seu código de 4 dígitos aparece no cartão da gaveta e na aba PIN Seguro. O motorista só liberta a criança após validar.",
      highlight: "Entrega 100% verificada",
    },
    {
      title: "Walkie-Talkie & Multicaixa Express",
      body: "Envie mensagens pré-definidas com 1 toque, justifique faltas ou pague a mensalidade com recibo fiscal AGT.",
      highlight: "Tudo num só toque",
    },
  ],
  driver: [
    {
      title: "Cockpit Noturno Anti-Encandeamento",
      body: "Interface escura estilo Waze pensada para condução segura logo pela manhã, com HUD da próxima paragem sempre visível.",
      highlight: "Leitura rápida sem distrações",
    },
    {
      title: "Embarque & Validação por PIN",
      body: "Na gaveta inferior, registe os alunos que entraram e confirme o PIN de 4 dígitos dos encarregados no desembarque.",
      highlight: "Zero esquecimentos a bordo",
    },
    {
      title: "Walkie-Talkie 1-Toque & Pauta Digital",
      body: "Comunique trânsito ou chegada com 1 toque sem escrever ao volante e gere a Pauta Digital no fim da rota.",
      highlight: "Segurança ativa em rota",
    },
  ],
  company: [
    {
      title: "Monitorização de Frota em Luanda",
      body: "Visualize todos os corredores escolares ao vivo, troque de rota no mapa e acompanhe os autocarros em operação.",
      highlight: "Controlo operacional central",
    },
    {
      title: "Documentos DNVT & Inspeções",
      body: "Aceda rapidamente aos seguros ENSA, inspeção periódica e alvarás com alertas de expiração antes de multas.",
      highlight: "Frota sempre legalizada",
    },
    {
      title: "Pauta Diária & Novos Contratos",
      body: "Exporte a pauta diária para a secretaria e abra o Portal de Novos Clientes para receber pedidos de colégios.",
      highlight: "Gestão escolar integrada",
    },
  ],
};

const NUMBERS = [
  ["Polícia Nacional", "113"],
  ["Bombeiros de Luanda", "115"],
  ["INEM Emergência", "112"],
] as const;

interface NativeMobileAppProps {
  onExitNative?: () => void;
  onOpenContractLanding?: () => void;
  initialRole?: Role;
}

export function NativeMobileApp({
  onExitNative,
  onOpenContractLanding,
  initialRole = "parent",
}: NativeMobileAppProps) {
  const [role, setRole] = useState<Role>(initialRole);

  useEffect(() => {
    setRole(initialRole);
    setActiveTab("home");
    setSheetExpanded(false);
    setTutorialStep(0);
    try {
      const seen = localStorage.getItem(`mobuss_tutorial_seen_${initialRole}`);
      setTutorialOpen(!seen);
    } catch {
      setTutorialOpen(false);
    }
  }, [initialRole]);

  const [activeTab, setActiveTab] = useState<string>("home");
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(`mobuss_tutorial_seen_${initialRole}`);
    } catch {
      return true;
    }
  });
  const [tutorialStep, setTutorialStep] = useState(0);

  // Multi-route Luanda selector
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route_a");
  const currentRoute: LuandaRouteConfig = LUANDA_ROUTES[selectedRouteId] || LUANDA_ROUTES.route_a;

  // Route & simulation states
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [emergency, setEmergency] = useState<Emergency>(null);
  const [delay, setDelay] = useState<number | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [activeHazard, setActiveHazard] = useState<string | null>(null);
  const [emptyBusChecked, setEmptyBusChecked] = useState(false);

  // Proximity Geofencing Alert state
  const [proximityAlert, setProximityAlert] = useState<{
    visible: boolean;
    stopName: string;
    distanceMeters: number;
    minutesAway: number;
  }>({
    visible: false,
    stopName: "Largo do Kinaxixi",
    distanceMeters: 480,
    minutesAway: 3,
  });

  // Selected student for parent view
  const [selectedKidId, setSelectedKidId] = useState<string>("kid-1");

  // Modals & Safety Share / Rating
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("Motivo de saúde / Consulta médica");
  const [pinVerifyModalOpen, setPinVerifyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [verifyingStudent, setVerifyingStudent] = useState<Student | null>(null);
  const [multicaixaModalOpen, setMulticaixaModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [tripRating, setTripRating] = useState(0);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [syncPricing, setSyncPricing] = useState(() => readMoBussSync().pricing);

  useEffect(() => {
    setSyncPricing(readMoBussSync().pricing);
    return subscribeMoBussSync((s) => setSyncPricing(s.pricing));
  }, []);

  // Quick Preset Messages between Driver and Parent
  const [messages, setMessages] = useState<QuickMessage[]>([
    {
      id: "m1",
      sender: "driver",
      senderName: "João Mateus (Motorista)",
      text: "Viagem iniciada em Mutamba. A rota segue dentro do horário previsto.",
      time: "07:35",
    },
    {
      id: "m2",
      sender: "parent",
      senderName: "Sra. Luísa Domingos",
      text: "Bom dia! Já estamos na paragem à espera.",
      time: "07:40",
    },
    {
      id: "m3",
      sender: "driver",
      senderName: "João Mateus (Motorista)",
      text: "A Maria já está a bordo do autocarro. Seguimos para a paragem do Kinaxixi.",
      time: "07:43",
    },
  ]);

  // Notifications history log
  const [notifications, setNotifications] = useState<
    Array<{ id: string; time: string; text: string; type: "info" | "alert" | "success" }>
  >([
    { id: "1", time: "07:35", text: "Autocarro 12 iniciou a rota da manhã em Mutamba.", type: "info" },
    { id: "2", time: "07:42", text: "Maria Domingos registada a bordo com validação segura.", type: "success" },
    { id: "3", time: "Ontem 16:30", text: "Viagem da tarde concluída sem incidentes.", type: "info" },
  ]);

  // Students list
  const [students, setStudents] = useState<Student[]>([
    {
      id: "kid-1",
      name: "Maria Domingos",
      stop: 0,
      school: "Escola Primária do Morro Bento",
      guardian: "Sra. Luísa Domingos",
      phone: "+244 923 456 789",
      onBoard: false,
      droppedOff: false,
      absent: false,
      pickupPin: "8429",
    },
    {
      id: "kid-2",
      name: "Edson Manuel",
      stop: 1,
      school: "Escola Primária do Morro Bento",
      guardian: "Sr. Manuel Neto",
      phone: "+244 912 345 678",
      onBoard: false,
      droppedOff: false,
      absent: false,
      pickupPin: "3170",
    },
    {
      id: "kid-3",
      name: "Ana Kiala",
      stop: 2,
      school: "Escola Primária do Morro Bento",
      guardian: "Sra. Joana Kiala",
      phone: "+244 934 567 890",
      onBoard: false,
      droppedOff: false,
      absent: false,
      pickupPin: "5541",
    },
    {
      id: "kid-4",
      name: "Bruno Neto",
      stop: 3,
      school: "Escola Primária do Morro Bento",
      guardian: "Sr. Carlos Neto",
      phone: "+244 945 678 901",
      onBoard: false,
      droppedOff: false,
      absent: false,
      pickupPin: "9024",
    },
  ]);

  // Bus movement simulation & Proximity geofencing calculation
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(p + 0.004, 1);

        // Check if approaching parent's stop (stop 1: Largo do Kinaxixi, around at = 0.25)
        if (next > 0.18 && next < 0.28 && !proximityAlert.visible) {
          setProximityAlert({
            visible: true,
            stopName: currentRoute.stops[1]?.name || "Paragem",
            distanceMeters: 450,
            minutesAway: 2,
          });
          notify(
            `APROXIMAÇÃO: O autocarro ${currentRoute.busId} está a 450m de ${currentRoute.stops[1]?.name}!`,
            "alert"
          );
        }

        if (next >= 1) {
          setRunning(false);
          notify("O autocarro chegou à escola em segurança!", "success");
        }
        return next;
      });
    }, 120);
    return () => clearInterval(id);
  }, [running, proximityAlert.visible, currentRoute]);

  function notify(msg: string, type: "info" | "alert" | "success" = "info") {
    setToast(msg);
    const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
    setNotifications((prev) => [{ id: String(Date.now()), time: now, text: msg, type }, ...prev]);
    setTimeout(() => setToast(null), 3800);
  }

  function closeTutorial() {
    setTutorialOpen(false);
    try {
      localStorage.setItem(`mobuss_tutorial_seen_${role}`, "1");
    } catch {
      // ignore storage failure
    }
  }

  function sendQuickMessage(text: string) {
    const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
    const isDriver = role === "driver";
    const newMsg: QuickMessage = {
      id: String(Date.now()),
      sender: isDriver ? "driver" : "parent",
      senderName: isDriver ? `${currentRoute.driver} (Motorista)` : "Sra. Luísa Domingos",
      text,
      time: now,
    };
    setMessages((prev) => [...prev, newMsg]);
    notify(`Mensagem enviada: "${text}"`, "info");
  }

  function sendSos(type: string) {
    const from = role === "parent" ? "Encarregado" : role === "driver" ? "Motorista" : "Escola";
    const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
    setEmergency({
      type,
      from,
      time: now,
      busNumber: currentRoute.busId,
      details: `Alerta emitido no corredor ${currentRoute.name} de Luanda.`,
    });
    publishSimulatorAlert({
      time: now,
      bus: currentRoute.busId,
      route: `${currentRoute.code} · ${currentRoute.name}`,
      type,
      from: `${from} (${role === "driver" ? currentRoute.driver : currentKid.guardian})`,
      notes: `Alerta SOS emitido em tempo real a partir do simulador móvel.`,
    });
    setRunning(false);
    setSosOpen(false);
    notify(`SOS DISPARADO: ${type} transmitido aos serviços de emergência.`, "alert");
  }

  function handleVerifyPin() {
    if (!verifyingStudent) return;
    if (pinInput.trim() === verifyingStudent.pickupPin) {
      setStudents((all) =>
        all.map((s) => (s.id === verifyingStudent.id ? { ...s, droppedOff: true, onBoard: false } : s))
      );
      notify(`PIN validado! ${verifyingStudent.name} entregue em segurança.`, "success");
      setPinVerifyModalOpen(false);
      setPinInput("");
      setVerifyingStudent(null);
    } else {
      notify("PIN incorreto! Verifique o código no telemóvel do encarregado.", "alert");
    }
  }

  const currentKid = students.find((s) => s.id === selectedKidId) || students[0]!;
  const isMapView = activeTab === "home";
  const isDriverDark = role === "driver";
  const etaMinutes = Math.max(
    1,
    Math.round(((currentRoute.stops[currentKid.stop]?.at || 0.2) - progress) * 60)
  );
  const journeyStep = currentKid.droppedOff
    ? 4
    : currentKid.onBoard
    ? 3
    : running || progress > 0
    ? 2
    : 1;
  const activeTutorial = TUTORIAL_STEPS[role][tutorialStep] || TUTORIAL_STEPS[role][0];

  return (
    <div
      className={`h-full w-full flex flex-col relative overflow-hidden select-none font-sans transition-colors duration-300 ${
        isDriverDark ? "bg-[#09090b] text-zinc-50" : "bg-zinc-50 text-zinc-950"
      }`}
    >
      {/* Top App Header */}
      <header className="sticky top-0 z-40 bg-[#09090b] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <img
              src="/assets/aistudio/20261117_030824_57b8de0b.jpg"
              alt="MôBuss Logo"
              className="w-8 h-8 rounded-xl object-cover bg-black border border-white/15 shadow"
            />
            <div>
              <div className="font-extrabold text-sm tracking-tight leading-none flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)" }}>
                <span>MôBuss</span>
                {isDriverDark && (
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                    Noturno
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 font-medium flex items-center gap-1.5 mt-0.5 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span>Autocarro {currentRoute.busId} · {currentRoute.busPlate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Interactive Tutorial Trigger */}
            <button
              onClick={() => {
                setTutorialStep(0);
                setTutorialOpen(true);
              }}
              className="p-1.5 rounded-xl bg-zinc-800/90 text-zinc-200 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              title="Tutorial Interativo"
              aria-label="Abrir Tutorial"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Quick Walkie-Talkie Button */}
            <button
              onClick={() => setChatOpen(true)}
              className="relative p-1.5 rounded-xl bg-zinc-800/90 text-white hover:bg-zinc-700 transition cursor-pointer"
              title="Walkie-Talkie / Mensagens Rápidas"
              aria-label="Abrir Walkie-Talkie"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#e11d2e]" />
            </button>

            {/* Profile User Badge */}
            <div className="flex items-center gap-1 bg-zinc-800/90 px-2 py-1 rounded-xl border border-white/10">
              {role === "parent" ? (
                <Users className="w-3 h-3 text-[#e11d2e]" />
              ) : role === "driver" ? (
                <Compass className="w-3 h-3 text-[#e11d2e]" />
              ) : (
                <Building2 className="w-3 h-3 text-[#e11d2e]" />
              )}
              <span className="text-[10px] font-bold text-white">
                {role === "parent" ? "Sra. Luísa" : role === "driver" ? "João M." : "Operações"}
              </span>
            </div>

            <button
              onClick={() => setSosOpen(true)}
              className="w-7 h-7 rounded-full bg-[#e11d2e] text-white font-black text-[9px] grid place-items-center shadow hover:scale-105 transition cursor-pointer"
              title="Emergência SOS"
            >
              SOS
            </button>
          </div>
        </header>

        {/* Dynamic In-App Notification Toast with Spring Micro-Interaction */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="absolute top-14 left-3 right-3 z-50 max-w-sm mx-auto rounded-2xl bg-[#09090b]/95 backdrop-blur-md text-white p-3 text-xs font-semibold shadow-2xl border border-white/15"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-[#e11d2e]/20 text-[#e11d2e] grid place-items-center shrink-0 mt-0.5">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-[#e11d2e] font-bold uppercase tracking-wider">MôBuss Alerta</div>
                  <div>{toast}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN BODY CONTENT ACCORDING TO ROLE & ACTIVE TAB */}
        <main className={`flex-1 min-h-0 ${isMapView ? "relative overflow-hidden flex flex-col" : "p-4 overflow-y-auto"}`}>
          {/* Banners for non-map tabs */}
          {!isMapView && emergency && (
            <div className="mb-3 rounded-2xl bg-[#e11d2e] text-white px-3.5 py-2.5 text-xs font-bold flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldAlert className="w-4 h-4 animate-pulse shrink-0" />
                <span className="truncate">SOS: {emergency.type} (Autocarro {emergency.busNumber})</span>
              </div>
              <button
                onClick={() => setEmergency(null)}
                className="underline text-[11px] font-black ml-2 shrink-0 cursor-pointer"
              >
                Limpar
              </button>
            </div>
          )}

          {!isMapView && role === "parent" && proximityAlert.visible && (
            <div className="mb-3 rounded-2xl bg-[#09090b] text-white border border-[#e11d2e]/50 px-3.5 py-2.5 text-xs flex items-center justify-between shadow-md">
              <div className="min-w-0 pr-2">
                <div className="text-[10px] font-black text-[#e11d2e] uppercase tracking-wider flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  <span>Aproximação GPS · {proximityAlert.distanceMeters}m</span>
                </div>
                <div className="font-semibold truncate">Autocarro {currentRoute.busId} a {proximityAlert.minutesAway} min de {proximityAlert.stopName}</div>
              </div>
              <button
                onClick={() => setProximityAlert((p) => ({ ...p, visible: false }))}
                className="px-2 py-1 rounded-lg bg-white/10 text-[10px] font-bold shrink-0 cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          {/* ================= PARENT INTERFACE ================= */}
          {role === "parent" && (
            <>
              {activeTab === "home" && (
                <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Full-Screen Live Map */}
                  <div className="absolute inset-0 z-0">
                    <LuandaMap
                      progress={progress}
                      emergency={!!emergency}
                      routeId={selectedRouteId}
                      className="h-full w-full rounded-none"
                    />
                  </div>

                  {/* Floating Top Bar: Corridors + Kid Toggle + Live Alerts */}
                  <div className="relative z-10 px-2.5 pt-2.5 space-y-2 pointer-events-none">
                    <div className="flex items-center gap-1.5 justify-between pointer-events-auto">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        {Object.values(LUANDA_ROUTES).map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelectedRouteId(r.id);
                              setProgress(0);
                              setRunning(false);
                              setProximityAlert((p) => ({ ...p, visible: false }));
                              notify(`Corredor alterado para ${r.name}`, "info");
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-sm backdrop-blur-md ${
                              selectedRouteId === r.id
                                ? "bg-[#09090b] text-white ring-1 ring-white/20"
                                : "bg-white/90 text-zinc-900 border border-zinc-200/80 hover:bg-white"
                            }`}
                          >
                            {r.code}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 bg-white/90 backdrop-blur-md p-0.5 rounded-full border border-zinc-200/80 shadow-sm shrink-0">
                        {students.slice(0, 2).map((k) => (
                          <button
                            key={k.id}
                            onClick={() => setSelectedKidId(k.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                              selectedKidId === k.id
                                ? "bg-[#e11d2e] text-white shadow-xs"
                                : "text-zinc-600 hover:text-zinc-950"
                            }`}
                          >
                            {k.name.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Floating SOS Banner */}
                    {emergency && (
                      <div className="pointer-events-auto rounded-2xl bg-[#e11d2e]/95 backdrop-blur-md text-white px-3 py-2 text-xs font-bold flex items-center justify-between shadow-lg border border-white/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldAlert className="w-4 h-4 animate-pulse shrink-0" />
                          <span className="truncate">SOS: {emergency.type}</span>
                        </div>
                        <button
                          onClick={() => setEmergency(null)}
                          className="px-2 py-0.5 rounded-lg bg-black/25 text-[10px] font-black ml-2 shrink-0 cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    )}

                    {/* Floating Geofence 500m Proximity Alert */}
                    {proximityAlert.visible && (
                      <div className="pointer-events-auto rounded-2xl bg-[#09090b]/92 backdrop-blur-md text-white border border-[#e11d2e]/60 px-3 py-2 text-xs shadow-xl flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-[#e11d2e] flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            <span>A {proximityAlert.distanceMeters}m da Paragem</span>
                          </div>
                          <div className="font-semibold text-[11px] truncate">
                            Autocarro {currentRoute.busId} chega a {proximityAlert.stopName} em {proximityAlert.minutesAway} min
                          </div>
                        </div>
                        <button
                          onClick={() => setProximityAlert((p) => ({ ...p, visible: false }))}
                          className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    )}

                    {/* Floating Traffic Delay / Waze Hazard Alert */}
                    {(delay || activeHazard) && (
                      <div className="pointer-events-auto rounded-xl bg-red-950/90 backdrop-blur-md text-white border border-[#e11d2e]/50 px-3 py-1.5 text-[11px] font-bold flex items-center gap-2 shadow-md">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#e11d2e] shrink-0" />
                        <span className="truncate">
                          {activeHazard
                            ? `Alerta na via: ${activeHazard} (+5 min)`
                            : `Motorista reportou +${delay} min de atraso no corredor.`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Floating Map Actions: Geofence Test + Safety Share */}
                  <div className="mt-auto self-end mr-3 mb-2 relative z-10 flex items-center gap-1.5">
                    <button
                      onClick={() => setShareModalOpen(true)}
                      className="bg-white/95 backdrop-blur-md text-zinc-950 px-2.5 py-1.5 rounded-full text-[10px] font-bold shadow-lg border border-zinc-200 hover:bg-white active:scale-95 transition cursor-pointer inline-flex items-center gap-1"
                      title="Partilhar Viagem ao Vivo com Familiar"
                    >
                      <Share2 className="w-3 h-3 text-[#e11d2e]" />
                      <span>Partilhar</span>
                    </button>

                    <button
                      onClick={() => {
                        setProximityAlert({
                          visible: true,
                          stopName: currentRoute.stops[1]?.name || "Paragem",
                          distanceMeters: 450,
                          minutesAway: 2,
                        });
                        notify(`Teste: Autocarro a 450m da sua paragem!`, "alert");
                      }}
                      className="bg-[#09090b]/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-lg border border-white/15 hover:bg-[#e11d2e] active:scale-95 transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Bell className="w-3 h-3 text-[#e11d2e]" />
                      <span>Testar Geofence</span>
                    </button>
                  </div>

                  {/* Expandable Uber/Yango Bottom Sheet */}
                  <div
                    className={`relative z-20 bg-white text-zinc-950 rounded-t-[26px] shadow-[0_-12px_32px_rgba(0,0,0,0.22)] border-t border-zinc-200 flex flex-col transition-all duration-300 ${
                      sheetExpanded ? "max-h-[78%]" : "max-h-[48%]"
                    }`}
                  >
                    {/* Drag Handle */}
                    <button
                      type="button"
                      onClick={() => setSheetExpanded((v) => !v)}
                      className="w-full pt-2.5 pb-1.5 flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                      aria-label={sheetExpanded ? "Recolher painel" : "Expandir painel"}
                    >
                      <span className="w-10 h-1 rounded-full bg-zinc-300" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                        {sheetExpanded ? "Toque para recolher" : "Toque para expandir"}
                      </span>
                    </button>

                    {/* Pinned Peek Summary */}
                    <div className="px-4 pb-3 border-b border-zinc-100 shrink-0 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                emergency ? "bg-[#e11d2e] animate-ping" : running ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                              }`}
                            />
                            <span className="truncate">{currentKid.name} · {currentRoute.code}</span>
                          </div>
                          <div className="text-xl font-black tracking-tight tabular-nums text-zinc-950 leading-tight mt-0.5">
                            {emergency
                              ? "Em emergência"
                              : currentKid.absent
                              ? "Ausência justificada"
                              : currentKid.droppedOff
                              ? "Entregue em segurança"
                              : !running && progress === 0
                              ? "Ainda não partiu"
                              : progress >= 1
                              ? "Chegou à escola"
                              : currentKid.onBoard
                              ? "A bordo do autocarro"
                              : `Chega em ${etaMinutes} min`}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-medium truncate">
                            Paragem: <strong className="text-zinc-800">{currentRoute.stops[currentKid.stop]?.name || "Paragem Oficial"}</strong>
                          </div>
                        </div>

                        {/* Compact Secure Pickup PIN Badge */}
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-center shrink-0">
                          <div className="text-[8px] font-black uppercase tracking-wider text-emerald-700">PIN Seguro</div>
                          <div className="text-base font-mono font-black text-emerald-800 leading-tight tabular-nums">
                            {currentKid.pickupPin}
                          </div>
                        </div>
                      </div>

                      {/* 4-Stage Uber Journey Timeline */}
                      <div className="grid grid-cols-4 gap-1 pt-0.5">
                        {[
                          { step: 1, label: "Partida" },
                          { step: 2, label: "A caminho" },
                          { step: 3, label: "A bordo" },
                          { step: 4, label: "Escola" },
                        ].map((item) => {
                          const active = journeyStep >= item.step;
                          const isCurrent = journeyStep === item.step;
                          return (
                            <div key={item.step} className="flex flex-col gap-1">
                              <div
                                className={`h-1.5 rounded-full transition-colors ${
                                  active
                                    ? journeyStep === 4
                                      ? "bg-emerald-600"
                                      : isCurrent
                                      ? "bg-[#e11d2e]"
                                      : "bg-zinc-900"
                                    : "bg-zinc-200"
                                }`}
                              />
                              <span
                                className={`text-[9px] font-bold text-center truncate ${
                                  active ? "text-zinc-900" : "text-zinc-400"
                                }`}
                              >
                                {item.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Driver Safety Strip */}
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-2.5 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#09090b] text-white grid place-items-center font-black text-xs shrink-0">
                          {currentRoute.driver.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-xs text-zinc-950 truncate">{currentRoute.driver}</div>
                          <div className="text-[10px] text-zinc-500 font-medium truncate tabular-nums">
                            Autocarro {currentRoute.busId} · {currentRoute.busPlate}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setShareModalOpen(true)}
                            className="rounded-full bg-zinc-200/80 hover:bg-zinc-300 active:scale-95 text-zinc-900 w-8 h-8 grid place-items-center cursor-pointer transition"
                            title="Kit de Segurança & Partilha de Rota"
                            aria-label="Partilhar viagem"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setChatOpen(true)}
                            className="rounded-full bg-zinc-200/80 hover:bg-zinc-300 active:scale-95 text-zinc-900 w-8 h-8 grid place-items-center cursor-pointer transition"
                            title="Enviar mensagem rápida ao motorista"
                            aria-label="Mensagem rápida ao motorista"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <a
                            href={`tel:${currentRoute.driverPhone}`}
                            className="rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white w-8 h-8 grid place-items-center shadow-xs transition"
                            title="Ligar ao motorista"
                            aria-label="Ligar ao motorista"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Expanded Details */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
                      {/* Post-Trip Rating Card (Uber-style after delivery or school arrival) */}
                      {(progress >= 1 || currentKid.droppedOff) && (
                        <div className="rounded-2xl bg-zinc-950 text-white p-3.5 space-y-2.5 shadow-md">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-[9px] font-black uppercase tracking-wider text-[#e11d2e]">
                                Avaliação da Viagem
                              </div>
                              <div className="text-xs font-extrabold">
                                {ratingSubmitted
                                  ? "Obrigado pelo seu feedback!"
                                  : `Como foi a viagem com ${currentRoute.driver}?`}
                              </div>
                            </div>
                            {ratingSubmitted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                                <Check className="w-3 h-3" />
                                <span>{tripRating}/5</span>
                              </span>
                            )}
                          </div>

                          {!ratingSubmitted && (
                            <>
                              <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setTripRating(star)}
                                    className="p-1 cursor-pointer active:scale-90 transition"
                                    aria-label={`Avaliar com ${star} estrelas`}
                                  >
                                    <Star
                                      className={`w-5 h-5 transition-colors ${
                                        star <= tripRating
                                          ? "fill-amber-400 text-amber-400"
                                          : "text-zinc-600 hover:text-zinc-400"
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>

                              <div className="flex flex-wrap gap-1.5">
                                {["Pontual", "Condução Suave", "Simpatia", "PIN Ágil"].map((tag) => {
                                  const picked = ratingTags.includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      onClick={() =>
                                        setRatingTags((prev) =>
                                          picked ? prev.filter((x) => x !== tag) : [...prev, tag]
                                        )
                                      }
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                        picked
                                          ? "bg-[#e11d2e] text-white"
                                          : "bg-white/10 text-zinc-300 hover:bg-white/15"
                                      }`}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>

                              <button
                                disabled={tripRating === 0}
                                onClick={() => {
                                  setRatingSubmitted(true);
                                  recordDriverRating({
                                    driver: currentRoute.driver,
                                    routeCode: currentRoute.code,
                                    rating: tripRating,
                                    tags: ratingTags,
                                    parentName: currentKid.guardian,
                                  });
                                  notify(`Avaliação de ${tripRating} estrelas registada para ${currentRoute.driver}!`, "success");
                                }}
                                className="w-full py-2 rounded-xl bg-white text-zinc-950 text-xs font-black disabled:opacity-40 cursor-pointer active:scale-[0.98] transition"
                              >
                                Enviar Avaliação
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {currentKid.absent && (
                        <div className="rounded-xl bg-red-50 border border-[#e11d2e]/30 text-zinc-900 px-3 py-2 text-xs font-bold flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[#e11d2e]">
                              <CalendarOff className="w-3.5 h-3.5 shrink-0" />
                              <span>Aluno marcado como ausente hoje</span>
                            </div>
                            <div className="text-[10px] font-normal text-zinc-600 truncate">{currentKid.absenceReason}</div>
                          </div>
                          <button
                            onClick={() => {
                              setStudents((all) =>
                                all.map((s) => (s.id === currentKid.id ? { ...s, absent: false } : s))
                              );
                              notify(`Ausência cancelada para ${currentKid.name}. O autocarro passará na paragem.`, "info");
                            }}
                            className="underline text-xs font-bold text-[#e11d2e] cursor-pointer shrink-0"
                          >
                            Desfazer
                          </button>
                        </div>
                      )}

                      {/* Quick Preset Action Bar */}
                      <div className="rounded-2xl bg-zinc-50 p-2.5 border border-zinc-200">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-[#e11d2e]" />
                          <span>Walkie-Talkie Rápido para o Motorista</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Já estamos na paragem à espera.",
                            "A descer do prédio agora.",
                            "Recebemos a criança, obrigado!",
                          ].map((msg) => (
                            <button
                              key={msg}
                              onClick={() => sendQuickMessage(msg)}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-[11px] font-semibold text-zinc-900 hover:bg-[#e11d2e] hover:text-white hover:border-[#e11d2e] active:scale-95 transition cursor-pointer shadow-2xs"
                            >
                              {msg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setAbsenceModalOpen(true)}
                          className="rounded-xl border border-zinc-200 bg-white py-2.5 px-3 text-xs font-bold text-zinc-900 shadow-2xs hover:bg-zinc-50 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <CalendarOff className="w-3.5 h-3.5 text-[#e11d2e]" />
                          <span>Reportar Ausência</span>
                        </button>
                        <button
                          onClick={() => setActiveTab("billing")}
                          className="rounded-xl bg-[#09090b] py-2.5 px-3 text-xs font-bold text-white shadow-2xs hover:bg-zinc-800 active:scale-[0.98] transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Mensalidade (MCX)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Kids & Secure PIN */}
              {activeTab === "kids" && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                    Segurança & Crianças
                  </h2>

                  <div className="rounded-2xl bg-red-50 border border-[#e11d2e]/30 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs text-[#e11d2e] font-bold flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span>ALUNA ATIVA</span>
                        </div>
                        <div className="text-lg font-black text-zinc-950">{currentKid.name}</div>
                        <div className="text-xs text-zinc-600">{currentKid.school}</div>
                      </div>
                      <span className="text-xs font-mono font-bold bg-slide-paper px-2 py-1 rounded-lg border border-zinc-200">
                        Paragem {currentKid.stop + 1}
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-slide-paper text-center border border-slide-line">
                      <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1 inline-flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Código de Entrega Segura</span>
                      </div>
                      <div className="text-4xl font-mono font-black text-slide-paper-ink tracking-widest my-2 tabular-nums">
                        {currentKid.pickupPin}
                      </div>
                      <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                        O motorista só pode libertar a criança na paragem após introduzir este código de 4 dígitos.
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          const newPin = String(Math.floor(1000 + Math.random() * 9000));
                          setStudents((all) =>
                            all.map((s) => (s.id === currentKid.id ? { ...s, pickupPin: newPin } : s))
                          );
                          notify("Novo PIN de recolha gerado com sucesso!", "success");
                        }}
                        className="flex-1 py-2 text-xs font-bold bg-slide-paper-ink text-slide-paper rounded-xl shadow cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Gerar Novo PIN</span>
                      </button>
                      <button
                        onClick={() => setAbsenceModalOpen(true)}
                        className="flex-1 py-2 text-xs font-bold bg-slide-line text-slide-paper-ink rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <CalendarOff className="w-3.5 h-3.5" />
                        <span>{currentKid.absent ? "Editar Ausência" : "Marcar Falta"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slide-line p-3.5 bg-slide-paper">
                    <div className="font-bold text-sm mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Protocolo de Segurança em Luanda</span>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Para garantir a máxima proteção do seu educando, o motorista não fará entrega sem a validação prévia do PIN ou autorização expressa pelo encarregado de educação.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab: Payments & Tuition */}
              {activeTab === "billing" && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                    Mensalidade & Multicaixa Express
                  </h2>

                  <div className="rounded-2xl bg-slide-paper-ink text-slide-paper p-5 shadow-lg border border-slide-surface">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs text-slide-dim font-bold uppercase tracking-wider">MÊS CORRENTE</div>
                        <div className="text-3xl font-black text-slide-accent mt-1 tabular-nums">
                          {formatAOA(syncPricing.studentMonthlyFee)}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-orange-600 text-white font-black grid place-items-center text-xs shadow">
                        MCX
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slide-surface space-y-3">
                      <button
                        onClick={() => setMulticaixaModalOpen(true)}
                        className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 py-3 text-xs font-black text-white shadow-lg cursor-pointer transition flex items-center justify-center gap-2"
                      >
                        <Smartphone className="w-4 h-4" />
                        <span>Pagar com Multicaixa Express (Instantâneo)</span>
                      </button>

                      <p className="text-[10px] text-slide-dim text-center">
                        Receba a notificação no telemóvel e confirme com o seu PIN MCX de forma 100% segura.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold opacity-75">HISTÓRICO DE MENSALIDADES (HOMOLOGAÇÃO)</div>
                    {[
                      {
                        month: "Outubro 2026",
                        invoice: "PRO-MOB-2026/8192",
                        amountValue: syncPricing.studentMonthlyFee,
                        emisRef: "MCX-901824-EMIS",
                        cert: "HOMOLOGAÇÃO · NÃO FISCAL",
                      },
                      {
                        month: "Setembro 2026",
                        invoice: "PRO-MOB-2026/7741",
                        amountValue: syncPricing.studentMonthlyFee,
                        emisRef: "MCX-774102-EMIS",
                        cert: "HOMOLOGAÇÃO · NÃO FISCAL",
                      },
                    ].map((item) => (
                      <div
                        key={item.month}
                        className="rounded-xl border border-slide-line p-3 flex justify-between items-center gap-2 bg-slide-paper"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs">{item.month}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{item.cert}</div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-xs font-bold tabular-nums">{formatAOA(item.amountValue)}</div>
                            <span className="text-[10px] font-bold text-slide-ok inline-flex items-center gap-1 justify-end">
                              <span>Pago via MCX</span>
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              exportAgtReceipt(
                                {
                                  invoice: item.invoice,
                                  student: currentKid.name,
                                  guardian: currentKid.guardian,
                                  phone: currentKid.phone,
                                  amountValue: item.amountValue,
                                  date: item.month,
                                  emisRef: item.emisRef,
                                  agtCert: item.cert,
                                  status: "Validado",
                                  school: currentKid.school,
                                  routeLabel: currentRoute.name,
                                },
                                syncPricing
                              );
                              notify(`Nota provisória (${item.invoice}) descarregada.`, "success");
                            }}
                            className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 cursor-pointer transition"
                            title="Descarregar Comprovativo Provisório"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Activity Notifications */}
              {activeTab === "alerts" && (
                <div className="space-y-3">
                  <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                    Notificações da Rota
                  </h2>

                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-2xl p-3.5 border ${
                          n.type === "alert"
                            ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : n.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-950"
                            : "bg-slide-paper border-slide-line text-slide-paper-ink"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px] opacity-60 mb-1">
                          <span className="font-bold uppercase">MôBuss Angola</span>
                          <span className="font-mono">{n.time}</span>
                        </div>
                        <div className="text-xs font-semibold">{n.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================= DRIVER INTERFACE (WAZE DARK MODE) ================= */}
          {role === "driver" && (
            <>
              {activeTab === "home" && (
                <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
                  {/* Full-Screen Waze-Style Dark Route Map */}
                  <div className="absolute inset-0 z-0">
                    <LuandaMap
                      progress={progress}
                      emergency={!!emergency}
                      routeId={selectedRouteId}
                      darkMode={true}
                      className="h-full w-full rounded-none"
                    />
                  </div>

                  {/* Floating Top Bar: Corridors + Pauta + Carbon Next-Stop HUD */}
                  <div className="relative z-10 px-2.5 pt-2.5 space-y-2 pointer-events-none">
                    <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        {Object.values(LUANDA_ROUTES).map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setSelectedRouteId(r.id);
                              setProgress(0);
                              setRunning(false);
                              notify(`Corredor alterado para ${r.name}`, "info");
                            }}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-sm backdrop-blur-md ${
                              selectedRouteId === r.id
                                ? "bg-[#e11d2e] text-white ring-1 ring-white/25"
                                : "bg-[#09090b]/85 text-zinc-200 border border-white/15 hover:bg-[#14151a]"
                            }`}
                          >
                            {r.code}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setAttendanceModalOpen(true)}
                        className="bg-[#e11d2e] text-white px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer hover:opacity-90 shadow-md shrink-0 inline-flex items-center gap-1"
                      >
                        <ClipboardList className="w-3 h-3" />
                        <span>Pauta</span>
                      </button>
                    </div>

                    {/* Floating Carbon Next-Stop HUD */}
                    <div className="pointer-events-auto rounded-2xl bg-[#09090b]/92 backdrop-blur-md text-white px-3.5 py-2.5 flex items-center justify-between shadow-xl border border-white/15">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-[#e11d2e]/20 text-[#e11d2e] border border-[#e11d2e]/30 grid place-items-center shrink-0">
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#e11d2e] animate-pulse" />
                            <span>PRÓXIMA PARAGEM · {currentRoute.code}</span>
                          </div>
                          <div className="font-black text-sm text-white truncate mt-0.5">
                            {currentRoute.stops.find((s) => s.at > progress)?.name || currentRoute.school}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] text-zinc-400 uppercase font-bold">Chegada</div>
                        <div className="text-sm font-black text-[#e11d2e] font-mono tabular-nums">
                          ~{Math.max(1, Math.round((0.5 - progress) * 60))} min
                        </div>
                      </div>
                    </div>

                    {emergency && (
                      <div className="pointer-events-auto rounded-2xl bg-[#e11d2e]/95 backdrop-blur-md text-white px-3 py-2 text-xs font-bold flex items-center justify-between shadow-lg">
                        <span className="truncate flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span className="truncate">SOS: {emergency.type}</span>
                        </span>
                        <button
                          onClick={() => setEmergency(null)}
                          className="px-2 py-0.5 rounded-lg bg-black/25 text-[10px] font-black ml-2 cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    )}

                    {offlineMode && (
                      <div className="pointer-events-auto rounded-xl bg-amber-500/95 backdrop-blur-md text-zinc-950 px-3 py-1.5 text-[11px] font-bold flex items-center justify-between shadow-md">
                        <span className="flex items-center gap-1.5">
                          <WifiOff className="w-3.5 h-3.5 shrink-0" />
                          <span>Modo Offline Ativo — fila local</span>
                        </span>
                        <button onClick={() => setOfflineMode(false)} className="underline text-[10px] font-black cursor-pointer">
                          Reconectar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expandable Driver Dark-Mode Bottom Sheet */}
                  <div
                    className={`mt-auto relative z-20 bg-[#111318] text-zinc-50 rounded-t-[26px] shadow-[0_-12px_36px_rgba(0,0,0,0.65)] border-t border-white/10 flex flex-col transition-all duration-300 ${
                      sheetExpanded ? "max-h-[78%]" : "max-h-[50%]"
                    }`}
                  >
                    {/* Drag Handle */}
                    <button
                      type="button"
                      onClick={() => setSheetExpanded((v) => !v)}
                      className="w-full pt-2.5 pb-1.5 flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                      aria-label={sheetExpanded ? "Recolher painel do motorista" : "Expandir painel do motorista"}
                    >
                      <span className="w-10 h-1 rounded-full bg-zinc-600" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                        {sheetExpanded ? "Toque para recolher" : "Lista de alunos e walkie-talkie"}
                      </span>
                    </button>

                    {/* Pinned Thumb-Zone Drive Controls */}
                    <div className="px-4 pb-3 border-b border-white/10 shrink-0 space-y-2.5">
                      {/* Anti-Forgetting Empty Bus Sweep Check at End of Route */}
                      {progress >= 1 && (
                        <button
                          onClick={() => {
                            const next = !emptyBusChecked;
                            setEmptyBusChecked(next);
                            if (next) {
                              recordEmptyBusSweep({
                                busNumber: currentRoute.busId,
                                plate: currentRoute.busPlate,
                                driver: currentRoute.driver,
                                routeName: `${currentRoute.code} · ${currentRoute.name}`,
                              });
                              notify("Verificação anti-esquecimento concluída: 0 alunos no autocarro.", "success");
                            }
                          }}
                          className={`w-full rounded-2xl px-3 py-2.5 text-left border transition cursor-pointer flex items-center justify-between gap-2 active:scale-[0.98] ${
                            emptyBusChecked
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-[#e11d2e]/15 border-[#e11d2e]/40 text-white"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-black uppercase tracking-wider">
                              {emptyBusChecked ? "Verificação Concluída" : "Inspeção Obrigatória de Segurança"}
                            </div>
                            <div className="text-[11px] font-semibold truncate">
                              {emptyBusChecked
                                ? "Fila do fundo verificada · Autocarro vazio"
                                : "Toque após confirmar a fila do fundo vazia"}
                            </div>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${
                              emptyBusChecked ? "bg-emerald-500 text-white" : "bg-[#e11d2e] text-white"
                            }`}
                          >
                            {emptyBusChecked ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                      )}

                      <div className="flex gap-2">
                        {progress >= 1 ? (
                          <button
                            disabled={!emptyBusChecked}
                            onClick={() => {
                              setProgress(0);
                              setStudents((s) => s.map((x) => ({ ...x, onBoard: false, droppedOff: false })));
                              setDelay(null);
                              setActiveHazard(null);
                              setEmergency(null);
                              setEmptyBusChecked(false);
                              setRatingSubmitted(false);
                              setTripRating(0);
                              setRatingTags([]);
                              notify("Rota reiniciada com sucesso para nova viagem.", "info");
                            }}
                            className="flex-1 rounded-2xl bg-white text-zinc-950 py-3 font-extrabold text-sm shadow cursor-pointer hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>{emptyBusChecked ? "Recomeçar rota" : "Confirme acima"}</span>
                          </button>
                        ) : (
                          <button
                            disabled={!!emergency}
                            onClick={() => {
                              setRunning(!running);
                              if (!running)
                                notify(
                                  `Viagem iniciada por ${currentRoute.driver} — encarregados notificados.`,
                                  "info"
                                );
                            }}
                            className={`flex-1 rounded-2xl py-3 font-black text-sm shadow cursor-pointer active:scale-[0.98] transition inline-flex items-center justify-center gap-2 ${
                              running
                                ? "bg-zinc-800 text-zinc-100 border border-white/15"
                                : "bg-[#16a34a] text-white"
                            }`}
                          >
                            {running ? (
                              <>
                                <Pause className="w-4 h-4" />
                                <span>Pausar Viagem</span>
                              </>
                            ) : progress > 0 ? (
                              <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>Continuar Rota</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 fill-current" />
                                <span>Iniciar Viagem</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const newDelay = delay ? null : 10;
                            setDelay(newDelay);
                            if (newDelay) {
                              sendQuickMessage("Trânsito congestionado na via (+10 min de atraso).");
                              notify("Atraso de 10 min comunicado aos encarregados.", "alert");
                            } else {
                              notify("Atraso removido.", "info");
                            }
                          }}
                          className={`rounded-2xl px-3.5 py-3 font-bold text-xs cursor-pointer shadow active:scale-[0.98] transition inline-flex items-center gap-1.5 ${
                            delay
                              ? "bg-[#e11d2e] text-white"
                              : "bg-zinc-800/90 text-zinc-100 border border-white/10 hover:bg-zinc-800"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{delay ? "+10m Ativo" : "+10m Atraso"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Body: Waze Hazard Bar + Walkie-Talkie + Passenger Boarding Checklist */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                      {/* Waze-Style 1-Tap Hazard Reporting */}
                      <div className="rounded-2xl bg-[#181a20] p-2.5 border border-white/10">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Reportar na Via (estilo Waze)</span>
                          </span>
                          {activeHazard && (
                            <button
                              onClick={() => {
                                setActiveHazard(null);
                                clearHazardForBus(currentRoute.busId);
                                notify("Alerta de via removido.", "info");
                              }}
                              className="text-[10px] text-zinc-300 underline cursor-pointer"
                            >
                              Limpar
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: "Engarrafamento", Icon: Siren },
                            { label: "Chuva Forte", Icon: CloudRain },
                            { label: "Obras na Via", Icon: Construction },
                          ].map(({ label, Icon }) => {
                            const active = activeHazard === label;
                            return (
                              <button
                                key={label}
                                onClick={() => {
                                  const next = active ? null : label;
                                  setActiveHazard(next);
                                  if (next) {
                                    publishHazardReport({
                                      label,
                                      routeCode: currentRoute.code,
                                      routeName: currentRoute.name,
                                      driver: currentRoute.driver,
                                      busNumber: currentRoute.busId,
                                    });
                                    sendQuickMessage(`Alerta na via: ${label} no corredor ${currentRoute.code}.`);
                                    notify(`Alerta Waze publicado: ${label}`, "alert");
                                  } else {
                                    clearHazardForBus(currentRoute.busId);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition ${
                                  active
                                    ? "bg-[#e11d2e] border-[#e11d2e] text-white"
                                    : "bg-[#09090b] border-white/10 text-zinc-200 hover:border-white/25"
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="truncate max-w-full">{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Driver 1-Tap Walkie-Talkie Bar */}
                      <div className="rounded-2xl bg-[#181a20] p-2.5 border border-white/10">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                          <span className="flex items-center gap-1.5">
                            <Radio className="w-3 h-3 text-[#e11d2e]" />
                            <span>Walkie-Talkie Rápido</span>
                          </span>
                          <button onClick={() => setChatOpen(true)} className="text-[#e11d2e] font-bold underline text-[10px] cursor-pointer">
                            Histórico ({messages.length})
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Já cheguei à paragem.",
                            "Aguardando 2 minutos.",
                            "Trânsito intenso (+5 min).",
                          ].map((msg) => (
                            <button
                              key={msg}
                              onClick={() => sendQuickMessage(msg)}
                              className="px-2.5 py-1 rounded-xl bg-[#09090b] border border-white/15 text-[11px] font-semibold text-zinc-100 hover:bg-[#e11d2e] hover:text-white hover:border-[#e11d2e] active:scale-95 transition cursor-pointer"
                            >
                              {msg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Student Boarding & PIN Checklist */}
                      <div className="rounded-2xl border border-white/10 p-3 bg-[#181a20] space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-bold text-zinc-100">
                            PASSAGEIROS ({students.filter((s) => s.onBoard).length} a bordo / {students.length})
                          </div>
                          <div className="text-[10px] text-zinc-400">Toque para registar</div>
                        </div>

                        <div className="divide-y divide-white/10">
                          {students.map((s) => (
                            <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-xs flex items-center gap-1.5 text-white">
                                  <span className="truncate">{s.name}</span>
                                  {s.absent && (
                                    <span className="bg-[#e11d2e]/20 text-[#ff6b78] border border-[#e11d2e]/30 text-[9px] px-1.5 py-0.5 rounded-sm font-bold shrink-0">
                                      Ausente
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-zinc-400 truncate">
                                  {currentRoute.stops[s.stop]?.name || "Paragem Oficial"}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  disabled={s.absent || s.droppedOff}
                                  onClick={() => {
                                    setStudents((all) =>
                                      all.map((x) => (x.id === s.id ? { ...x, onBoard: !x.onBoard } : x))
                                    );
                                    if (!s.onBoard)
                                      notify(`${s.name.split(" ")[0]} registado(a) a bordo.`, "success");
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer transition inline-flex items-center gap-1 ${
                                    s.onBoard
                                      ? "bg-[#16a34a] text-white"
                                      : "bg-zinc-800 text-zinc-200 border border-white/15"
                                  }`}
                                >
                                  {s.onBoard ? (
                                    <>
                                      <span>A bordo</span>
                                      <Check className="w-3 h-3" />
                                    </>
                                  ) : (
                                    "Entrou"
                                  )}
                                </button>

                                <button
                                  disabled={s.absent || s.droppedOff || !s.onBoard}
                                  onClick={() => {
                                    setVerifyingStudent(s);
                                    setPinVerifyModalOpen(true);
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer transition inline-flex items-center gap-1 ${
                                    s.droppedOff
                                      ? "bg-emerald-600 text-white"
                                      : "border border-white/20 text-zinc-200 hover:bg-zinc-800 disabled:opacity-35"
                                  }`}
                                >
                                  {s.droppedOff ? (
                                    <>
                                      <span>Entregue</span>
                                      <Check className="w-3 h-3" />
                                    </>
                                  ) : (
                                    "Validar PIN"
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Driver Stops & Documents (DARK MODE) */}
              {activeTab === "stops" && (
                <div className="space-y-3.5 text-zinc-50">
                  <div className="flex justify-between items-center gap-2">
                    <h2 className="text-lg font-black truncate" style={{ fontFamily: "var(--font-display)" }}>
                      Paragens · {currentRoute.code}
                    </h2>
                    <button
                      onClick={() => setDocsModalOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#181a20] border border-white/15 text-zinc-100 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shrink-0 hover:bg-zinc-800"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#e11d2e]" />
                      <span>Documentos</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentRoute.stops.map((st, i) => (
                      <div
                        key={st.id}
                        className="rounded-2xl border border-white/10 p-3 bg-[#14151a] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#e11d2e] text-white grid place-items-center font-bold text-xs shrink-0">
                            {i + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate">{st.name}</div>
                            <div className="text-[10px] text-zinc-400">
                              {i === 0
                                ? "Partida Inicial · 07:30"
                                : i === currentRoute.stops.length - 1
                                ? `Destino (${currentRoute.school})`
                                : `Paragem intermédia (+${st.etaMinutes} min)`}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-white bg-white/10 border border-white/10 px-2 py-0.5 rounded-lg shrink-0">
                          {students.filter((s) => s.stop === i).length} alunos
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Fuel Quick-Log Card */}
                  <div className="rounded-2xl bg-[#14151a] p-3.5 border border-white/10">
                    <div className="text-xs font-bold mb-1 flex items-center gap-1.5 text-white">
                      <Fuel className="w-4 h-4 text-[#e11d2e]" />
                      <span>Registo de Abastecimento (Luanda)</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mb-2">Autocarro {currentRoute.busId} · Posto Pumangol</div>
                    <div className="flex gap-2">
                      <input
                        placeholder="Litros (ex: 45L)"
                        className="flex-1 rounded-xl bg-[#09090b] text-white placeholder:text-zinc-500 px-3 py-2 text-xs border border-white/15 outline-none focus:border-[#e11d2e]"
                      />
                      <button
                        onClick={() => notify("Registo de combustível guardado no sistema.", "success")}
                        className="px-4 py-2 bg-[#e11d2e] text-white rounded-xl text-xs font-bold cursor-pointer hover:opacity-90"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ================= COMPANY / SCHOOL INTERFACE ================= */}
          {role === "company" && (
            <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Full-Screen Fleet Map */}
              <div className="absolute inset-0 z-0">
                <LuandaMap
                  progress={progress}
                  emergency={!!emergency}
                  routeId={selectedRouteId}
                  className="h-full w-full rounded-none"
                />
              </div>

              {/* Floating Top Bar: Corridors + DNVT / Pauta Quick Actions */}
              <div className="relative z-10 px-2.5 pt-2.5 space-y-2 pointer-events-none">
                <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                    {Object.values(LUANDA_ROUTES).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRouteId(r.id);
                          setProgress(0);
                          setRunning(false);
                          notify(`Corredor alterado para ${r.name}`, "info");
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-sm backdrop-blur-md ${
                          selectedRouteId === r.id
                            ? "bg-[#09090b] text-white ring-1 ring-white/20"
                            : "bg-white/90 text-zinc-900 border border-zinc-200/80 hover:bg-white"
                        }`}
                      >
                        {r.code}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setDocsModalOpen(true)}
                      className="bg-[#09090b]/90 text-white backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md border border-white/15 cursor-pointer hover:bg-[#09090b] inline-flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>DNVT</span>
                    </button>
                    <button
                      onClick={() => setAttendanceModalOpen(true)}
                      className="bg-[#e11d2e] text-white px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md cursor-pointer hover:opacity-90 inline-flex items-center gap-1"
                    >
                      <ClipboardList className="w-3 h-3" />
                      <span>Pauta</span>
                    </button>
                  </div>
                </div>

                {emergency && (
                  <div className="pointer-events-auto rounded-2xl bg-[#e11d2e]/95 backdrop-blur-md text-white px-3 py-2 text-xs font-bold flex items-center justify-between shadow-lg">
                    <span className="truncate flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span className="truncate">SOS: {emergency.type}</span>
                    </span>
                    <button
                      onClick={() => setEmergency(null)}
                      className="px-2 py-0.5 rounded-lg bg-black/25 text-[10px] font-black ml-2 cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* Expandable Company Bottom Sheet */}
              <div
                className={`mt-auto relative z-20 bg-white text-zinc-950 rounded-t-[26px] shadow-[0_-12px_32px_rgba(0,0,0,0.22)] border-t border-zinc-200 flex flex-col transition-all duration-300 ${
                  sheetExpanded ? "max-h-[78%]" : "max-h-[46%]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSheetExpanded((v) => !v)}
                  className="w-full pt-2.5 pb-1.5 flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                  aria-label={sheetExpanded ? "Recolher painel da frota" : "Expandir painel da frota"}
                >
                  <span className="w-10 h-1 rounded-full bg-zinc-300" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                    {sheetExpanded ? "Toque para recolher" : "Frota e contratos escolares"}
                  </span>
                </button>

                {/* Pinned Fleet KPI Row */}
                <div className="px-4 pb-3 border-b border-zinc-100 shrink-0">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-2xl bg-[#09090b] text-white p-3 shadow-sm">
                      <div className="text-xl font-black text-white tabular-nums">4</div>
                      <div className="text-[11px] text-zinc-400 font-semibold">Contratos Ativos</div>
                    </div>
                    <div className="rounded-2xl bg-[#e11d2e] text-white p-3 shadow-sm">
                      <div className="text-xl font-black tabular-nums">{running ? 1 : 0}/6</div>
                      <div className="text-[11px] font-bold text-white/90">Autocarros em Rota</div>
                    </div>
                  </div>
                </div>

                {/* Scrollable Body: Contracts & New Client Portal */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">CONTRATOS ESCOLARES</span>
                    {onOpenContractLanding && (
                      <button
                        onClick={onOpenContractLanding}
                        className="text-[11px] font-bold text-[#e11d2e] underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Portal Novos Clientes</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-200 p-3 bg-zinc-50 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-950">Colégio São Francisco de Assis</span>
                      <span className="bg-[#e11d2e] text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                        Novo Pedido
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      3 autocarros dedicados · 75 alunos · 1 050 000 Kz/mês · Talatona
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 p-3 bg-white space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-950">{currentRoute.school}</span>
                      <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                        Em operação
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600">
                      {currentRoute.name} · Motorista: {currentRoute.driver} ({currentRoute.busPlate})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="shrink-0 w-full z-40 bg-[#09090b] text-white border-t border-white/10 px-1.5 py-1.5 flex items-center justify-around shadow-2xl select-none">
          {role === "parent" && (
            <>
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "home" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Acompanhar Viagem"
              >
                <MapIcon className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Acompanhar</span>
                {activeTab === "home" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => {
                  setActiveTab("kids");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "kids" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="PIN Seguro do Educando"
              >
                <ShieldCheck className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">PIN Seguro</span>
                {activeTab === "kids" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => {
                  setActiveTab("billing");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "billing" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Pagamento de Mensalidade"
              >
                <CreditCard className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Mensalidade</span>
                {activeTab === "billing" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => {
                  setActiveTab("alerts");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer relative ${
                  activeTab === "alerts" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Alertas e Proximidade"
              >
                <div className="relative leading-none">
                  <Bell className="w-[18px] h-[18px]" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-white text-[8px] font-black flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Alertas</span>
                {activeTab === "alerts" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>
            </>
          )}

          {role === "driver" && (
            <>
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "home" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Controlo da Viagem"
              >
                <Bus className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Viagem</span>
                {activeTab === "home" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => {
                  setActiveTab("stops");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "stops" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Lista de Paragens"
              >
                <MapPin className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Paragens</span>
                {activeTab === "stops" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => setAttendanceModalOpen(true)}
                className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slide-dim hover:text-slide-paper transition cursor-pointer"
                title="Pauta Diária de Presenças"
              >
                <ClipboardList className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Pauta</span>
              </button>

              <button
                onClick={() => setOfflineMode(!offlineMode)}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  offlineMode ? "text-amber-400 font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Alternar Modo Offline"
              >
                {offlineMode ? <WifiOff className="w-[18px] h-[18px]" /> : <Wifi className="w-[18px] h-[18px]" />}
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">
                  {offlineMode ? "Offline" : "Rede"}
                </span>
              </button>
            </>
          )}

          {role === "company" && (
            <>
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSheetExpanded(false);
                }}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer ${
                  activeTab === "home" ? "text-slide-accent font-black" : "text-slide-dim hover:text-slide-paper"
                }`}
                title="Visão Geral da Frota"
              >
                <Building2 className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Frota</span>
                {activeTab === "home" && <span className="w-1 h-1 rounded-full bg-slide-accent mt-0.5" />}
              </button>

              <button
                onClick={() => setDocsModalOpen(true)}
                className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slide-dim hover:text-slide-paper transition cursor-pointer"
                title="Documentos e Seguros DNVT"
              >
                <FileText className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Docs DNVT</span>
              </button>

              <button
                onClick={() => setAttendanceModalOpen(true)}
                className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-slide-dim hover:text-slide-paper transition cursor-pointer"
                title="Pauta Geral das Escolas"
              >
                <ClipboardList className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-bold tracking-tight mt-0.5 truncate max-w-full">Pauta</span>
              </button>
            </>
          )}

          {/* Universal SOS Emergency Button on Bottom Bar */}
          <button
            onClick={() => setSosOpen(true)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-1 rounded-xl text-destructive hover:opacity-90 active:scale-95 transition cursor-pointer select-none"
            title="Emergência SOS MôBuss"
          >
            <ShieldAlert className="w-[18px] h-[18px] animate-pulse" />
            <span className="text-[10px] font-black tracking-tight mt-0.5">SOS</span>
          </button>
        </nav>

        {/* INTERACTIVE ROLE TUTORIAL MODAL */}
        {tutorialOpen && activeTutorial && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border animate-in fade-in zoom-in-95 ${
                isDriverDark
                  ? "bg-[#14151a] text-zinc-50 border-white/15"
                  : "bg-white text-zinc-950 border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e11d2e]/15 text-[#e11d2e] text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  <span>
                    Guia · {role === "parent" ? "Encarregado" : role === "driver" ? "Motorista" : "Operações MôBuss"}
                  </span>
                </div>
                <button
                  onClick={closeTutorial}
                  className={`w-7 h-7 rounded-full grid place-items-center cursor-pointer ${
                    isDriverDark ? "bg-white/10 text-zinc-300 hover:text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                  aria-label="Fechar tutorial"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 tabular-nums">
                  Passo {tutorialStep + 1} de {TUTORIAL_STEPS[role].length}
                </div>
                <h3 className="text-lg font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {activeTutorial.title}
                </h3>
                <p className={`text-xs leading-relaxed ${isDriverDark ? "text-zinc-300" : "text-zinc-600"}`}>
                  {activeTutorial.body}
                </p>
                <div
                  className={`rounded-xl px-3 py-2 text-[11px] font-bold inline-flex items-center gap-1.5 ${
                    isDriverDark
                      ? "bg-[#09090b] text-emerald-400 border border-white/10"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{activeTutorial.highlight}</span>
                </div>
              </div>

              {/* Step Indicator Dots */}
              <div className="flex items-center gap-1.5 mb-4">
                {TUTORIAL_STEPS[role].map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTutorialStep(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === tutorialStep
                        ? "w-6 bg-[#e11d2e]"
                        : isDriverDark
                        ? "w-2 bg-zinc-700"
                        : "w-2 bg-zinc-200"
                    }`}
                    aria-label={`Ir para passo ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {tutorialStep > 0 ? (
                  <button
                    onClick={() => setTutorialStep((s) => Math.max(0, s - 1))}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1 ${
                      isDriverDark ? "bg-white/10 text-zinc-200" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                ) : (
                  <button
                    onClick={closeTutorial}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                      isDriverDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-500 hover:text-zinc-800"
                    }`}
                  >
                    Saltar
                  </button>
                )}

                {tutorialStep < TUTORIAL_STEPS[role].length - 1 ? (
                  <button
                    onClick={() => setTutorialStep((s) => s + 1)}
                    className="flex-1 py-2.5 rounded-xl bg-[#e11d2e] text-white text-xs font-black cursor-pointer inline-flex items-center justify-center gap-1.5 shadow hover:opacity-95"
                  >
                    <span>Seguinte</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={closeTutorial}
                    className="flex-1 py-2.5 rounded-xl bg-[#16a34a] text-white text-xs font-black cursor-pointer inline-flex items-center justify-center gap-1.5 shadow hover:opacity-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Começar a Usar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* QUICK WALKIE-TALKIE DRAWER MODAL */}
        {chatOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center">
            <div
              className={`w-full max-w-md rounded-t-3xl p-5 animate-in slide-in-from-bottom shadow-2xl border-t max-h-[85vh] flex flex-col ${
                isDriverDark
                  ? "bg-[#14151a] text-zinc-50 border-white/15"
                  : "bg-slide-paper text-zinc-950 border-slide-line/40"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-3 border-b ${
                  isDriverDark ? "border-white/10" : "border-slide-line"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#e11d2e]/15 text-[#e11d2e] grid place-items-center">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base leading-tight">Walkie-Talkie MôBuss</h3>
                    <p className={`text-[11px] ${isDriverDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {role === "driver" ? "Canal com os Encarregados" : `Canal com ${currentRoute.driver} (Motorista)`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className={`w-7 h-7 rounded-full grid place-items-center cursor-pointer ${
                    isDriverDark ? "bg-white/10 text-zinc-200" : "bg-slide-line text-zinc-700"
                  }`}
                  aria-label="Fechar Walkie-Talkie"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-4">
                {messages.map((m) => {
                  const isMe = (role === "driver" && m.sender === "driver") || (role === "parent" && m.sender === "parent");
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className={`text-[10px] mb-0.5 ${isDriverDark ? "text-zinc-400" : "text-zinc-500"}`}>
                        {m.senderName} · {m.time}
                      </div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs max-w-[85%] font-medium shadow-2xs ${
                          isMe
                            ? "bg-[#e11d2e] text-white rounded-br-xs"
                            : isDriverDark
                            ? "bg-[#09090b] text-zinc-100 border border-white/10 rounded-bl-xs"
                            : "bg-slide-line/60 text-slide-paper-ink rounded-bl-xs"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 1-Tap Preset Messages Bar */}
              <div className={`pt-2 border-t space-y-2 ${isDriverDark ? "border-white/10" : "border-slide-line"}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${isDriverDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Enviar Mensagem Pré-definida com 1 Toque:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(role === "driver"
                    ? [
                        "Já cheguei à paragem.",
                        "Aguardando 2 minutos.",
                        "Trânsito congestionado na via (+5 min).",
                        "Chegámos à escola em segurança.",
                      ]
                    : [
                        "Já estamos na paragem à espera.",
                        "A descer do prédio agora.",
                        "Recebemos a criança, obrigado!",
                        "O educando vai com a tia hoje.",
                      ]
                  ).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => sendQuickMessage(preset)}
                      className="px-2.5 py-1.5 rounded-xl bg-slide-accent text-slide-accent-ink text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-2xs"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REPORT ABSENCE (Parent) */}
        {absenceModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slide-paper p-5 shadow-2xl border border-slide-line">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <CalendarOff className="w-5 h-5 text-[#e11d2e]" />
                  <span>Reportar Ausência</span>
                </h3>
                <button
                  onClick={() => setAbsenceModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slide-line grid place-items-center cursor-pointer"
                  aria-label="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slide-paper-ink/70 mb-3">
                Ao reportar a falta com antecedência, o autocarro não fará a paragem de {currentRoute.stops[currentKid.stop]?.name || "Mutamba"}, poupando tempo para os restantes alunos.
              </p>

              <div className="space-y-2 mb-4">
                <label className="text-[11px] font-bold opacity-80">Motivo da ausência:</label>
                {[
                  "Motivo de saúde / Consulta médica",
                  "Viagem familiar / Fora de Luanda",
                  "Encarregado levará pessoalmente à escola",
                  "Outro motivo justificado",
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setAbsenceReason(reason)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                      absenceReason === reason
                        ? "border-[#e11d2e] bg-red-50 text-zinc-950 font-bold"
                        : "border-slide-line bg-slide-paper hover:bg-slide-line/30"
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStudents((all) =>
                      all.map((s) => (s.id === currentKid.id ? { ...s, absent: true, absenceReason } : s))
                    );
                    setAbsenceModalOpen(false);
                    notify(`Ausência registada para ${currentKid.name}. O motorista foi informado.`, "info");
                  }}
                  className="flex-1 rounded-xl bg-slide-paper-ink text-slide-paper py-2.5 font-bold text-xs cursor-pointer shadow"
                >
                  Confirmar Ausência
                </button>
                <button
                  onClick={() => setAbsenceModalOpen(false)}
                  className="rounded-xl bg-slide-line px-3 py-2.5 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: VERIFY PICKUP PIN (Driver) */}
        {pinVerifyModalOpen && verifyingStudent && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div
              className={`w-full max-w-sm rounded-3xl p-5 shadow-2xl border ${
                isDriverDark
                  ? "bg-[#14151a] text-zinc-50 border-white/15"
                  : "bg-slide-paper text-zinc-950 border-slide-line"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span>Validar PIN de Entrega</span>
                </h3>
                <button
                  onClick={() => {
                    setPinVerifyModalOpen(false);
                    setPinInput("");
                  }}
                  className={`w-7 h-7 rounded-full grid place-items-center cursor-pointer ${
                    isDriverDark ? "bg-white/10 text-zinc-200" : "bg-slide-line text-zinc-700"
                  }`}
                  aria-label="Fechar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className={`text-xs mb-3 ${isDriverDark ? "text-zinc-300" : "text-slide-paper-ink/70"}`}>
                Solicite o PIN de 4 dígitos ao encarregado na paragem para entregar o(a) aluno(a) <strong>{verifyingStudent.name}</strong>.
              </p>

              <div className="mb-4">
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="Introduza os 4 dígitos"
                  className={`w-full text-center text-3xl font-mono font-black tracking-widest rounded-2xl py-3 border outline-none focus:ring-2 ring-slide-accent ${
                    isDriverDark
                      ? "bg-[#09090b] text-white border-white/15"
                      : "bg-slide-line/40 text-zinc-950 border-slide-line"
                  }`}
                />
                <div className={`text-center text-[11px] mt-1.5 ${isDriverDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  (Dica do protótipo: o PIN desta criança é <strong>{verifyingStudent.pickupPin}</strong>)
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  disabled={pinInput.length !== 4}
                  onClick={handleVerifyPin}
                  className="flex-1 rounded-xl bg-slide-ok text-slide-accent-ink py-2.5 font-black text-xs cursor-pointer shadow disabled:opacity-40"
                >
                  Confirmar Entrega
                </button>
                <button
                  onClick={() => {
                    setPinVerifyModalOpen(false);
                    setPinInput("");
                  }}
                  className={`rounded-xl px-3 py-2.5 font-bold text-xs cursor-pointer ${
                    isDriverDark ? "bg-white/10 text-zinc-200" : "bg-slide-line text-zinc-800"
                  }`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MULTICAIXA EXPRESS PAYMENT */}
        <MulticaixaModal
          isOpen={multicaixaModalOpen}
          onClose={() => setMulticaixaModalOpen(false)}
          onSuccess={() => notify("Pagamento Multicaixa Express validado com sucesso!", "success")}
          studentName={currentKid.name}
          guardianName={currentKid.guardian}
          schoolName={currentKid.school}
          routeLabel={currentRoute.name}
          amountValue={syncPricing.studentMonthlyFee}
        />

        {/* MODAL: DIGITAL ATTENDANCE LOG */}
        <AttendanceReportModal
          isOpen={attendanceModalOpen}
          onClose={() => setAttendanceModalOpen(false)}
          students={students}
          routeName={currentRoute.name}
          busNumber={currentRoute.busId}
          driverName={currentRoute.driver}
          schoolName={currentRoute.school}
        />

        {/* MODAL: VEHICLE DOCUMENTS & DNVT */}
        <VehicleDocumentsModal
          isOpen={docsModalOpen}
          onClose={() => setDocsModalOpen(false)}
          busId={currentRoute.busId}
          busPlate={currentRoute.busPlate}
        />

        {/* SOS EMERGENCY MODAL */}
        {sosOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center">
            <div
              className={`w-full max-w-md rounded-t-3xl p-5 animate-in slide-in-from-bottom shadow-2xl border-t ${
                isDriverDark
                  ? "bg-[#14151a] text-zinc-50 border-white/15"
                  : "bg-slide-paper text-zinc-950 border-slide-line/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <ShieldAlert className="w-5 h-5 text-[#e11d2e]" />
                  <span>Emergência Escolar</span>
                </div>
                <button
                  onClick={() => setSosOpen(false)}
                  className={`w-7 h-7 rounded-full grid place-items-center cursor-pointer ${
                    isDriverDark ? "bg-white/10 text-zinc-200" : "bg-slide-line text-zinc-700"
                  }`}
                  aria-label="Fechar emergência"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className={`text-xs mb-4 leading-relaxed ${isDriverDark ? "text-zinc-300" : "text-slide-paper-ink/70"}`}>
                Ao selecionar o tipo de ocorrência, a localização GPS ao vivo do autocarro em Luanda é enviada imediatamente à central escolar, à empresa e aos encarregados.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {EMERGENCY_TYPES.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => sendSos(t.label)}
                    className="rounded-2xl bg-[#e11d2e]/15 border border-[#e11d2e]/30 text-[#e11d2e] font-bold text-xs p-3 hover:bg-[#e11d2e]/25 cursor-pointer transition text-left flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDriverDark ? "text-zinc-400" : "text-slide-paper-ink/60"}`}>
                Linhas Diretas de Emergência (Angola)
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {NUMBERS.map(([n, num]) => (
                  <a
                    key={num}
                    href={`tel:${num}`}
                    className={`rounded-xl border p-2 text-center transition ${
                      isDriverDark
                        ? "border-white/15 bg-[#09090b] hover:bg-white/10"
                        : "border-slide-line hover:bg-slide-line/40"
                    }`}
                  >
                    <div className={`font-black text-sm ${isDriverDark ? "text-white" : "text-slide-paper-ink"}`}>{num}</div>
                    <div className={`text-[10px] truncate ${isDriverDark ? "text-zinc-400" : "text-slide-paper-ink/60"}`}>{n}</div>
                  </a>
                ))}
              </div>

              <button
                onClick={() => setSosOpen(false)}
                className={`w-full rounded-xl py-3 font-bold text-sm cursor-pointer transition ${
                  isDriverDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-slide-line text-zinc-950 hover:bg-slide-line/80"
                }`}
              >
                Voltar à viagem
              </button>
            </div>
          </div>
        )}

        {/* MODAL: SAFETY TOOLKIT & LIVE TRIP SHARE (Parent) */}
        {shareModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="w-full max-w-md rounded-t-3xl bg-white text-zinc-950 p-5 shadow-2xl border-t border-zinc-200 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#e11d2e]/15 text-[#e11d2e] grid place-items-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                      Kit de Segurança · Partilhar Viagem
                    </h3>
                    <p className="text-[11px] text-zinc-500">Link temporário válido até à chegada à escola</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShareModalOpen(false);
                    setLinkCopied(false);
                  }}
                  className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-700 grid place-items-center cursor-pointer"
                  aria-label="Fechar partilha"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Link ao Vivo · {currentKid.name}
                  </div>
                  <div className="text-xs font-mono font-bold text-zinc-900 truncate">
                    https://mobuss.ao/track/LD-{currentRoute.busId}-{currentKid.pickupPin}
                  </div>
                </div>
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(
                        `https://mobuss.ao/track/LD-${currentRoute.busId}-${currentKid.pickupPin}`
                      );
                    } catch {
                      // ignore clipboard restrictions inside iframe
                    }
                    setLinkCopied(true);
                    notify("Link de rastreio ao vivo copiado para partilhar!", "success");
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer inline-flex items-center gap-1.5 transition active:scale-95 ${
                    linkCopied ? "bg-emerald-600 text-white" : "bg-[#09090b] text-white"
                  }`}
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{linkCopied ? "Copiado" : "Copiar"}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Enviar Acesso Rápido a Familiar Autorizado:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Sr. Domingos (Pai)", phone: "923 110 220" },
                    { name: "Tia Rosa (Recolha)", phone: "912 440 880" },
                  ].map((contact) => (
                    <button
                      key={contact.name}
                      onClick={() => {
                        setShareModalOpen(false);
                        notify(`Localização ao vivo enviada para ${contact.name}.`, "success");
                      }}
                      className="rounded-2xl border border-zinc-200 p-2.5 text-left hover:border-[#e11d2e] hover:bg-red-50/40 active:scale-[0.98] transition cursor-pointer"
                    >
                      <div className="font-bold text-xs text-zinc-950 truncate">{contact.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{contact.phone}</div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
  );
}
