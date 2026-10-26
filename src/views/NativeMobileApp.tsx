import { useEffect, useState, type ReactNode } from "react";
import { LuandaMap } from "@/components/LuandaMap";
import { LUANDA_ROUTES, type LuandaRouteConfig } from "@/lib/route-luanda";
import { MulticaixaModal } from "@/components/MulticaixaModal";
import { AttendanceReportModal } from "@/components/AttendanceReportModal";
import { VehicleDocumentsModal } from "@/components/VehicleDocumentsModal";

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
  "🚑 Problema de saúde súbito de aluno",
  "💥 Acidente de viação ligeiro",
  "🔧 Avaria mecânica / Furo de pneu",
  "🛡️ Segurança pública / Bloqueio na via",
];

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
  }, [initialRole]);

  const [activeTab, setActiveTab] = useState<string>("home");

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

  // Modals
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("Motivo de saúde / Consulta médica");
  const [pinVerifyModalOpen, setPinVerifyModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [verifyingStudent, setVerifyingStudent] = useState<Student | null>(null);
  const [multicaixaModalOpen, setMulticaixaModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Quick Preset Messages between Driver and Parent
  const [messages, setMessages] = useState<QuickMessage[]>([
    {
      id: "m1",
      sender: "driver",
      senderName: "João Mateus (Motorista)",
      text: "🚌 Viagem iniciada em Mutamba. A rota segue dentro do horário previsto.",
      time: "07:35",
    },
    {
      id: "m2",
      sender: "parent",
      senderName: "Sra. Luísa Domingos",
      text: "👨‍👩‍👧 Bom dia! Já estamos na paragem à espera.",
      time: "07:40",
    },
    {
      id: "m3",
      sender: "driver",
      senderName: "João Mateus (Motorista)",
      text: "✅ A Maria já está a bordo do autocarro. Seguimos para a paragem do Kinaxixi.",
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
            `🔔 APROXIMAÇÃO: O autocarro ${currentRoute.busId} está a 450m de ${currentRoute.stops[1]?.name}!`,
            "alert"
          );
        }

        if (next >= 1) {
          setRunning(false);
          notify("🏫 O autocarro chegou à escola em segurança!", "success");
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
    setRunning(false);
    setSosOpen(false);
    notify(`🚨 SOS DISPARADO: ${type} transmitido aos serviços de emergência.`, "alert");
  }

  function handleVerifyPin() {
    if (!verifyingStudent) return;
    if (pinInput.trim() === verifyingStudent.pickupPin) {
      setStudents((all) =>
        all.map((s) => (s.id === verifyingStudent.id ? { ...s, droppedOff: true, onBoard: false } : s))
      );
      notify(`✅ PIN validado! ${verifyingStudent.name} entregue em segurança.`, "success");
      setPinVerifyModalOpen(false);
      setPinInput("");
      setVerifyingStudent(null);
    } else {
      notify("❌ PIN incorreto! Verifique o código no telemóvel do encarregado.", "alert");
    }
  }

  const currentKid = students.find((s) => s.id === selectedKidId) || students[0]!;

  return (
    <div className="min-h-screen bg-slide-bg flex justify-center text-slide-ink antialiased select-none font-sans">
      <div className="w-full max-w-md min-h-screen bg-slide-paper text-slide-paper-ink flex flex-col relative shadow-2xl overflow-hidden pb-20">
        {/* Top App Header */}
        <header className="sticky top-0 z-40 bg-slide-paper-ink text-slide-paper px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slide-accent text-slide-accent-ink grid place-items-center font-black text-lg shadow">
              T
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight leading-none" style={{ fontFamily: "var(--font-display)" }}>
                TransiGo
              </div>
              <div className="text-[11px] text-slide-dim font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slide-ok inline-block" />
                <span>Autocarro {currentRoute.busId} · {currentRoute.busPlate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Walkie-Talkie Button */}
            <button
              onClick={() => setChatOpen(true)}
              className="relative p-1.5 rounded-xl bg-slide-surface text-slide-paper hover:bg-slide-surface/80 transition cursor-pointer"
              title="Walkie-Talkie / Mensagens Rápidas"
            >
              <span className="text-sm">💬</span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-slide-accent animate-ping" />
            </button>

            {/* Profile User Badge (Role is selected from outside the phone) */}
            <div className="flex items-center gap-1.5 bg-slide-surface/90 px-2.5 py-1 rounded-xl border border-slide-line/20 shadow-xs">
              <span className="text-xs">
                {role === "parent" ? "👩‍👧" : role === "driver" ? "🧑‍✈️" : "🏢"}
              </span>
              <span className="text-[11px] font-bold text-slide-paper">
                {role === "parent" ? "Sra. Luísa" : role === "driver" ? "João M." : "Empresa"}
              </span>
            </div>

            <button
              onClick={() => setSosOpen(true)}
              className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground font-black text-xs grid place-items-center shadow hover:scale-105 transition cursor-pointer"
              title="Emergência SOS"
            >
              SOS
            </button>
          </div>
        </header>

        {/* Multi-Route Corridor Bar */}
        <div className="bg-slide-paper-ink/95 text-slide-paper px-3 py-2 flex items-center justify-between border-b border-slide-surface text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {Object.values(LUANDA_ROUTES).map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedRouteId(r.id);
                  setProgress(0);
                  notify(`Corredor alterado para ${r.name}`, "info");
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedRouteId === r.id
                    ? "bg-slide-accent text-slide-accent-ink shadow-xs"
                    : "bg-slide-surface text-slide-dim hover:text-slide-paper"
                }`}
              >
                {r.code}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slide-dim font-mono ml-2 shrink-0">Luanda AO</span>
        </div>

        {/* Global Emergency Alert Banner */}
        {emergency && (
          <div className="bg-destructive text-destructive-foreground px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2 truncate">
              <span className="animate-pulse">🚨</span>
              <span className="truncate">
                {emergency.type} · {emergency.from} ({emergency.time})
              </span>
            </div>
            <button
              onClick={() => {
                setEmergency(null);
                notify("✅ Ocorrência de emergência resolvida com sucesso.", "success");
              }}
              className="underline shrink-0 cursor-pointer text-white font-extrabold text-[11px]"
            >
              Resolver
            </button>
          </div>
        )}

        {/* Proximity Geofencing Alert Banner (500m away) */}
        {proximityAlert.visible && (
          <div className="bg-amber-500 text-slate-950 px-4 py-3 text-xs font-black flex items-start justify-between gap-2 shadow-lg animate-in slide-in-from-top-2 border-b-2 border-amber-600">
            <div className="flex items-start gap-2">
              <span className="text-xl animate-bounce">🔔</span>
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-black">
                  ALERTA DE PROXIMIDADE (500 METROS)
                </div>
                <div className="text-sm font-black leading-tight">
                  O autocarro está a ~{proximityAlert.minutesAway} min de {proximityAlert.stopName}!
                </div>
                <div className="text-[11px] font-medium opacity-90 mt-0.5">
                  Por favor, dirija-se à paragem com o seu educando para embarque seguro.
                </div>
              </div>
            </div>
            <button
              onClick={() => setProximityAlert((p) => ({ ...p, visible: false }))}
              className="text-xs bg-amber-600/30 hover:bg-amber-600/50 px-2 py-1 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Offline Simulation Indicator */}
        {offlineMode && (
          <div className="bg-amber-500 text-black px-4 py-1.5 text-xs font-bold flex items-center justify-between">
            <span>📡 Modo Offline ativo · Ações guardadas localmente</span>
            <button onClick={() => setOfflineMode(false)} className="underline text-[10px]">
              Reconectar
            </button>
          </div>
        )}

        {/* Dynamic In-App Notification Toast */}
        {toast && (
          <div className="fixed top-24 left-4 right-4 z-50 max-w-sm mx-auto rounded-2xl bg-slide-paper-ink text-slide-paper p-3.5 text-sm font-semibold shadow-2xl border border-slide-surface animate-in fade-in slide-in-from-top-3">
            <div className="flex items-start gap-2.5">
              <span className="text-base">🔔</span>
              <div className="flex-1">
                <div className="text-[10px] text-slide-accent font-bold uppercase tracking-wider">TransiGo Alerta</div>
                <div>{toast}</div>
              </div>
            </div>
          </div>
        )}

        {/* MAIN BODY CONTENT ACCORDING TO ROLE & ACTIVE TAB */}
        <main className="flex-1 p-4 overflow-y-auto">
          {/* ================= PARENT INTERFACE ================= */}
          {role === "parent" && (
            <>
              {activeTab === "home" && (
                <div className="space-y-4">
                  {/* Child Selector */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold opacity-60">Encarregada de Educação · {currentRoute.name}</div>
                      <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                        {currentKid.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {students.slice(0, 2).map((k) => (
                        <button
                          key={k.id}
                          onClick={() => setSelectedKidId(k.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            selectedKidId === k.id
                              ? "bg-slide-accent text-slide-accent-ink shadow-xs"
                              : "bg-slide-line/40 text-slide-paper-ink opacity-70"
                          }`}
                        >
                          {k.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Map with Multi-Route */}
                  <div className="relative">
                    <LuandaMap
                      progress={progress}
                      emergency={!!emergency}
                      routeId={selectedRouteId}
                      className="h-60 shadow-md rounded-2xl"
                    />
                    <div className="absolute top-2.5 left-2.5 z-10 bg-slide-paper/90 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slide-ok animate-pulse" />
                      <span>{currentRoute.code} · GPS ao Vivo</span>
                    </div>

                    {/* Geofence Proximity Test Trigger */}
                    <button
                      onClick={() => {
                        setProximityAlert({
                          visible: true,
                          stopName: currentRoute.stops[1]?.name || "Paragem",
                          distanceMeters: 450,
                          minutesAway: 2,
                        });
                        notify(`🔔 Teste: Autocarro a 450m da sua paragem!`, "alert");
                      }}
                      className="absolute bottom-2.5 right-2.5 z-10 bg-slide-paper-ink text-slide-paper px-2.5 py-1 rounded-full text-[10px] font-bold shadow hover:bg-slide-surface cursor-pointer"
                    >
                      🔔 Testar Geofence
                    </button>
                  </div>

                  {/* Traffic delay notification */}
                  {delay && (
                    <div className="rounded-xl bg-destructive/15 text-destructive border border-destructive/30 px-3.5 py-2.5 text-xs font-bold flex items-center gap-2">
                      <span>⚠️</span>
                      <span>O motorista reportou +{delay} min de atraso devido ao trânsito na via.</span>
                    </div>
                  )}

                  {/* Absence notification if marked */}
                  {currentKid.absent && (
                    <div className="rounded-xl bg-amber-500/20 border border-amber-500 text-amber-900 px-3.5 py-2.5 text-xs font-bold flex items-center justify-between">
                      <div>
                        <div>🚫 Aluno marcado como ausente hoje</div>
                        <div className="text-[10px] font-normal opacity-80">{currentKid.absenceReason}</div>
                      </div>
                      <button
                        onClick={() => {
                          setStudents((all) =>
                            all.map((s) => (s.id === currentKid.id ? { ...s, absent: false } : s))
                          );
                          notify(`Ausência cancelada para ${currentKid.name}. O autocarro passará na paragem.`, "info");
                        }}
                        className="underline text-xs font-bold cursor-pointer"
                      >
                        Desfazer
                      </button>
                    </div>
                  )}

                  {/* Status Card */}
                  <div
                    className={`rounded-2xl p-4 flex justify-between items-center shadow-sm ${
                      emergency
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-slide-accent text-slide-accent-ink"
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider opacity-80">ESTADO DA ROTA</div>
                      <div className="text-2xl font-black tracking-tight">
                        {emergency
                          ? "Em emergência"
                          : currentKid.absent
                          ? "Ausência justificada"
                          : currentKid.droppedOff
                          ? "Entregue em segurança"
                          : !running && progress === 0
                          ? "Ainda não partiu"
                          : progress >= 1
                          ? "Na escola"
                          : currentKid.onBoard
                          ? "A bordo do autocarro"
                          : `Chega em ${Math.max(
                              1,
                              Math.round(((currentRoute.stops[currentKid.stop]?.at || 0.2) - progress) * 60)
                            )} min`}
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold">
                      <div className="opacity-75">Paragem</div>
                      <div className="text-sm font-black">
                        {currentRoute.stops[currentKid.stop]?.name || "Paragem Oficial"}
                      </div>
                    </div>
                  </div>

                  {/* Secure Pickup PIN Box */}
                  <div className="rounded-2xl border-2 border-emerald-600/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-800">
                        🛡️ PIN DE RECOLHA SEGURA
                      </div>
                      <div className="text-xs text-emerald-950 font-medium">Apresente ao motorista para entrega</div>
                    </div>
                    <div className="text-2xl font-mono font-black text-emerald-800 bg-white px-3 py-1 rounded-xl shadow-xs border border-emerald-200">
                      {currentKid.pickupPin}
                    </div>
                  </div>

                  {/* Driver Card & Quick Walkie-Talkie */}
                  <div className="rounded-2xl border border-slide-line p-3.5 flex items-center gap-3 bg-slide-paper shadow-2xs">
                    <div className="w-12 h-12 rounded-2xl bg-slide-paper-ink text-slide-paper grid place-items-center font-black text-base shadow">
                      {currentRoute.driver.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="font-extrabold text-sm">{currentRoute.driver}</div>
                      <div className="text-[11px] opacity-65 font-medium">
                        Motorista Oficial · Autocarro {currentRoute.busId}
                      </div>
                      <div className="text-[10px] font-mono opacity-50">{currentRoute.busPlate}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setChatOpen(true)}
                        className="rounded-full bg-slide-line text-slide-paper-ink w-10 h-10 grid place-items-center font-bold text-sm shadow hover:bg-slide-line/70 cursor-pointer"
                        title="Enviar mensagem rápida ao motorista"
                      >
                        💬
                      </button>
                      <a
                        href={`tel:${currentRoute.driverPhone}`}
                        className="rounded-full bg-slide-ok text-slide-accent-ink w-10 h-10 grid place-items-center font-bold text-base shadow hover:opacity-90 transition"
                        title="Ligar ao motorista"
                      >
                        📞
                      </a>
                    </div>
                  </div>

                  {/* Quick Preset Action Bar */}
                  <div className="rounded-2xl bg-slide-line/20 p-3 border border-slide-line">
                    <div className="text-[11px] font-bold text-slide-dim uppercase tracking-wider mb-2">
                      💬 Walkie-Talkie Rápido para o Motorista
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "👨‍👩‍👧 Já estamos na paragem à espera.",
                        "🏃‍♂️ A descer do prédio agora.",
                        "✅ Recebemos a criança, obrigado!",
                      ].map((msg) => (
                        <button
                          key={msg}
                          onClick={() => sendQuickMessage(msg)}
                          className="px-2.5 py-1.5 rounded-xl bg-slide-paper border border-slide-line text-[11px] font-semibold text-slide-paper-ink hover:bg-slide-accent hover:text-slide-accent-ink transition cursor-pointer shadow-2xs"
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
                      className="rounded-xl border border-slide-line bg-slide-paper py-2.5 px-3 text-xs font-bold text-slide-paper-ink shadow-2xs hover:bg-slide-line/30 transition cursor-pointer"
                    >
                      📅 Reportar Ausência
                    </button>
                    <button
                      onClick={() => setActiveTab("billing")}
                      className="rounded-xl border border-slide-line bg-slide-paper py-2.5 px-3 text-xs font-bold text-slide-paper-ink shadow-2xs hover:bg-slide-line/30 transition cursor-pointer"
                    >
                      💳 Pagar Mensalidade (MCX)
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Kids & Secure PIN */}
              {activeTab === "kids" && (
                <div className="space-y-4">
                  <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                    Segurança & Crianças
                  </h2>

                  <div className="rounded-2xl bg-slide-accent/20 border border-slide-accent p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs text-slide-accent-ink/70 font-bold">ALUNA ATIVA</div>
                        <div className="text-lg font-black">{currentKid.name}</div>
                        <div className="text-xs opacity-75">{currentKid.school}</div>
                      </div>
                      <span className="text-xs font-mono font-bold bg-slide-paper px-2 py-1 rounded-lg">
                        Paragem {currentKid.stop + 1}
                      </span>
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-slide-paper text-center border border-slide-line">
                      <div className="text-xs text-slide-dim font-bold uppercase tracking-wider mb-1">
                        Código de Entrega Segura
                      </div>
                      <div className="text-4xl font-mono font-black text-slide-paper-ink tracking-widest my-2">
                        {currentKid.pickupPin}
                      </div>
                      <p className="text-[11px] text-slide-dim max-w-xs mx-auto">
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
                        className="flex-1 py-2 text-xs font-bold bg-slide-paper-ink text-slide-paper rounded-xl shadow cursor-pointer"
                      >
                        🔄 Gerar Novo PIN
                      </button>
                      <button
                        onClick={() => setAbsenceModalOpen(true)}
                        className="flex-1 py-2 text-xs font-bold bg-slide-line text-slide-paper-ink rounded-xl cursor-pointer"
                      >
                        {currentKid.absent ? "Editar Ausência" : "Marcar Falta"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slide-line p-3.5 bg-slide-paper">
                    <div className="font-bold text-sm mb-1">Protocolo de Segurança em Luanda</div>
                    <p className="text-xs text-slide-dim leading-relaxed">
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
                        <div className="text-3xl font-black text-slide-accent mt-1">45 000 Kz</div>
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
                        <span>📲</span>
                        <span>Pagar com Multicaixa Express (Instantâneo)</span>
                      </button>

                      <p className="text-[10px] text-slide-dim text-center">
                        Receba a notificação no telemóvel e confirme com o seu PIN MCX de forma 100% segura.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold opacity-75">HISTÓRICO FISCAL AGT</div>
                    {[
                      ["Outubro 2026", "45 000 Kz", "Pago via MCX", "AGT-CERT/2026/VALID"],
                      ["Setembro 2026", "45 000 Kz", "Pago via MCX", "AGT-CERT/2026/VALID"],
                    ].map(([m, val, st, cert]) => (
                      <div
                        key={m}
                        className="rounded-xl border border-slide-line p-3 flex justify-between items-center bg-slide-paper"
                      >
                        <div>
                          <div className="font-bold text-xs">{m}</div>
                          <div className="text-[10px] text-slide-dim font-mono">{cert}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs font-bold">{val}</div>
                          <span className="text-[10px] font-bold text-slide-ok">{st} ✓</span>
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
                          <span className="font-bold uppercase">TransiGo Angola</span>
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

          {/* ================= DRIVER INTERFACE ================= */}
          {role === "driver" && (
            <>
              {activeTab === "home" && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs font-semibold opacity-60">{currentRoute.name}</div>
                      <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                        Painel do Motorista
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAttendanceModalOpen(true)}
                        className="bg-slide-accent text-slide-accent-ink px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer hover:opacity-90 shadow-2xs"
                      >
                        📋 Pauta
                      </button>
                    </div>
                  </div>

                  {/* Route Map */}
                  <LuandaMap
                    progress={progress}
                    emergency={!!emergency}
                    routeId={selectedRouteId}
                    className="h-52 shadow-md rounded-2xl"
                  />

                  {/* Drive controls */}
                  <div className="flex gap-2">
                    {progress >= 1 ? (
                      <button
                        onClick={() => {
                          setProgress(0);
                          setStudents((s) => s.map((x) => ({ ...x, onBoard: false, droppedOff: false })));
                          setDelay(null);
                          setEmergency(null);
                          notify("🔄 Rota reiniciada com sucesso para nova viagem.", "info");
                        }}
                        className="flex-1 rounded-2xl bg-slide-paper-ink text-slide-paper py-3 font-extrabold text-sm shadow cursor-pointer hover:opacity-90 transition"
                      >
                        Recomeçar rota
                      </button>
                    ) : (
                      <button
                        disabled={!!emergency}
                        onClick={() => {
                          setRunning(!running);
                          if (!running)
                            notify(
                              `🚌 Viagem iniciada por ${currentRoute.driver} — encarregados notificados.`,
                              "info"
                            );
                        }}
                        className={`flex-1 rounded-2xl py-3.5 font-black text-sm shadow cursor-pointer transition ${
                          running ? "bg-slide-line text-slide-paper-ink" : "bg-slide-ok text-slide-accent-ink"
                        }`}
                      >
                        {running ? "⏸ Pausar Viagem" : progress > 0 ? "▶ Continuar Rota" : "▶ Iniciar Viagem"}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const newDelay = delay ? null : 10;
                        setDelay(newDelay);
                        if (newDelay) {
                          sendQuickMessage("🚦 Trânsito congestionado na via (+10 min de atraso).");
                          notify("⚠️ Atraso de 10 min comunicado aos encarregados.", "alert");
                        } else {
                          notify("Atraso removido.", "info");
                        }
                      }}
                      className={`rounded-2xl px-4 py-3.5 font-bold text-sm cursor-pointer shadow transition ${
                        delay ? "bg-destructive text-destructive-foreground" : "bg-slide-line text-slide-paper-ink"
                      }`}
                    >
                      {delay ? "+10m Ativo" : "+10m Atraso"}
                    </button>
                  </div>

                  {/* Driver 1-Tap Walkie-Talkie Bar */}
                  <div className="rounded-2xl bg-slide-line/20 p-2.5 border border-slide-line">
                    <div className="text-[10px] font-bold text-slide-dim uppercase tracking-wider mb-1.5 flex justify-between items-center">
                      <span>📢 Walkie-Talkie Rápido para Encarregados</span>
                      <button onClick={() => setChatOpen(true)} className="text-slide-accent underline text-[10px]">
                        Ver Histórico ({messages.length})
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "🚌 Já cheguei à paragem.",
                        "⏳ Aguardando 2 minutos.",
                        "🚦 Trânsito intenso (+5 min).",
                      ].map((msg) => (
                        <button
                          key={msg}
                          onClick={() => sendQuickMessage(msg)}
                          className="px-2.5 py-1 rounded-xl bg-slide-paper border border-slide-line text-[11px] font-semibold hover:bg-slide-accent hover:text-slide-accent-ink transition cursor-pointer shadow-2xs"
                        >
                          {msg}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Next stop indicator */}
                  <div className="rounded-xl bg-slide-paper-ink text-slide-paper p-3 flex items-center justify-between shadow">
                    <div>
                      <div className="text-[10px] text-slide-dim uppercase tracking-wider font-bold">PRÓXIMA PARAGEM</div>
                      <div className="font-black text-sm text-slide-accent">
                        {currentRoute.stops.find((s) => s.at > progress)?.name || currentRoute.school}
                      </div>
                    </div>
                    <div className="text-right text-xs font-bold text-slide-dim font-mono">
                      ~{Math.max(1, Math.round((0.5 - progress) * 60))} min
                    </div>
                  </div>

                  {/* Student Boarding & PIN Checklist */}
                  <div className="rounded-2xl border border-slide-line p-3.5 bg-slide-paper shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold opacity-80">
                        PASSAGEIROS (
                        {students.filter((s) => s.onBoard).length} a bordo / {students.length})
                      </div>
                      <div className="text-[11px] text-slide-dim">Toque para registar</div>
                    </div>

                    <div className="divide-y divide-slide-line">
                      {students.map((s) => (
                        <div key={s.id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-xs flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {s.absent && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-sm font-bold">
                                  Ausente
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] opacity-55">
                              {currentRoute.stops[s.stop]?.name || "Paragem Oficial"}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Board button */}
                            <button
                              disabled={s.absent || s.droppedOff}
                              onClick={() => {
                                setStudents((all) =>
                                  all.map((x) => (x.id === s.id ? { ...x, onBoard: !x.onBoard } : x))
                                );
                                if (!s.onBoard)
                                  notify(`✅ ${s.name.split(" ")[0]} registado(a) a bordo.`, "success");
                              }}
                              className={`rounded-full px-3 py-1 text-xs font-bold cursor-pointer transition ${
                                s.onBoard ? "bg-slide-ok text-slide-accent-ink" : "bg-slide-line text-slide-paper-ink"
                              }`}
                            >
                              {s.onBoard ? "A bordo ✓" : "Entrou"}
                            </button>

                            {/* Drop off with PIN button */}
                            <button
                              disabled={s.absent || s.droppedOff || !s.onBoard}
                              onClick={() => {
                                setVerifyingStudent(s);
                                setPinVerifyModalOpen(true);
                              }}
                              className={`rounded-full px-2.5 py-1 text-xs font-bold cursor-pointer transition ${
                                s.droppedOff
                                  ? "bg-emerald-600 text-white"
                                  : "border border-slide-line text-slide-paper-ink hover:bg-slide-line/40"
                              }`}
                            >
                              {s.droppedOff ? "Entregue ✓" : "Validar PIN"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Driver Stops & Documents */}
              {activeTab === "stops" && (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                      Paragens · {currentRoute.name}
                    </h2>
                    <button
                      onClick={() => setDocsModalOpen(true)}
                      className="px-2.5 py-1 rounded-xl bg-slide-line text-slide-paper-ink text-xs font-bold cursor-pointer"
                    >
                      📄 Documentos Autocarro
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentRoute.stops.map((st, i) => (
                      <div
                        key={st.id}
                        className="rounded-2xl border border-slide-line p-3 bg-slide-paper flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slide-paper-ink text-slide-paper grid place-items-center font-bold text-xs">
                            {i + 1}
                          </div>
                          <div>
                            <div className="font-bold text-xs">{st.name}</div>
                            <div className="text-[10px] text-slide-dim">
                              {i === 0
                                ? "Partida Inicial · 07:30"
                                : i === currentRoute.stops.length - 1
                                ? `Destino (${currentRoute.school})`
                                : `Paragem intermédia (+${st.etaMinutes} min)`}
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-slide-accent-ink bg-slide-accent px-2 py-0.5 rounded-lg">
                          {students.filter((s) => s.stop === i).length} alunos
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Fuel Quick-Log Card */}
                  <div className="rounded-2xl bg-slide-line/30 p-3.5 border border-slide-line">
                    <div className="text-xs font-bold mb-1">⛽ Registo de Abastecimento (Luanda)</div>
                    <div className="text-[11px] opacity-70 mb-2">Autocarro {currentRoute.busId} · Posto Pumangol</div>
                    <div className="flex gap-2">
                      <input
                        placeholder="Litros (ex: 45L)"
                        className="flex-1 rounded-xl bg-slide-paper px-3 py-2 text-xs border border-slide-line outline-none"
                      />
                      <button
                        onClick={() => notify("Registo de combustível guardado no sistema.", "success")}
                        className="px-4 py-2 bg-slide-paper-ink text-slide-paper rounded-xl text-xs font-bold cursor-pointer"
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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xs font-semibold opacity-60">TransiGo Empresas & Colégios</div>
                  <h2 className="text-xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                    Gestão Operacional
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setDocsModalOpen(true)}
                    className="bg-slide-surface text-slide-paper px-2.5 py-1.5 rounded-xl text-xs font-bold shadow cursor-pointer hover:opacity-90"
                  >
                    📄 DNVT / Docs
                  </button>
                  <button
                    onClick={() => setAttendanceModalOpen(true)}
                    className="bg-slide-accent text-slide-accent-ink px-2.5 py-1.5 rounded-xl text-xs font-bold shadow cursor-pointer hover:opacity-90"
                  >
                    📋 Pauta Diária
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-slide-paper-ink text-slide-paper p-3.5 shadow">
                  <div className="text-2xl font-black text-slide-accent">4</div>
                  <div className="text-xs opacity-75 font-semibold">Contratos Ativos</div>
                </div>
                <div className="rounded-2xl bg-slide-accent text-slide-accent-ink p-3.5 shadow">
                  <div className="text-2xl font-black">{running ? 1 : 0}/6</div>
                  <div className="text-xs font-bold opacity-80">Autocarros em Rota</div>
                </div>
              </div>

              {/* Live Map Preview with Route Switcher */}
              <div className="rounded-2xl border border-slide-line p-3 bg-slide-paper shadow-2xs">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold opacity-80">MONITORIZAÇÃO DA FROTA AO VIVO</div>
                  <span className="text-[10px] font-mono text-slide-dim">{currentRoute.name}</span>
                </div>
                <LuandaMap
                  progress={progress}
                  emergency={!!emergency}
                  routeId={selectedRouteId}
                  className="h-44 rounded-xl"
                />
              </div>

              {/* Contracts section & Action to open Landing page */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold opacity-80">CONTRATOS ESCOLARES</span>
                  {onOpenContractLanding && (
                    <button
                      onClick={onOpenContractLanding}
                      className="text-xs font-bold text-slide-accent underline cursor-pointer"
                    >
                      Abrir Portal de Novos Clientes →
                    </button>
                  )}
                </div>

                <div className="rounded-2xl border border-slide-line p-3.5 bg-slide-paper shadow-2xs space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold">Colégio São Francisco de Assis</span>
                    <span className="bg-slide-accent text-slide-accent-ink font-bold px-2 py-0.5 rounded-full text-[10px]">
                      Novo Pedido
                    </span>
                  </div>
                  <div className="text-[11px] opacity-70">
                    3 autocarros dedicados · 75 alunos · 1 050 000 Kz/mês · Talatona
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* BOTTOM NAVIGATION BAR */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-slide-paper-ink text-slide-paper border-t border-slide-surface/50 px-2 py-2 flex items-center justify-around shadow-2xl">
          {role === "parent" && (
            <>
              <button
                onClick={() => setActiveTab("home")}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === "home" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">🗺️</span>
                <span className="text-[10px]">Acompanhar</span>
              </button>
              <button
                onClick={() => setActiveTab("kids")}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === "kids" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">🎒</span>
                <span className="text-[10px]">PIN Seguro</span>
              </button>
              <button
                onClick={() => setActiveTab("billing")}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === "billing" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">💳</span>
                <span className="text-[10px]">Mensalidade</span>
              </button>
              <button
                onClick={() => setActiveTab("alerts")}
                className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer ${
                  activeTab === "alerts" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">🔔</span>
                <span className="text-[10px]">Alertas</span>
              </button>
            </>
          )}

          {role === "driver" && (
            <>
              <button
                onClick={() => setActiveTab("home")}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                  activeTab === "home" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">🚌</span>
                <span className="text-[10px]">Viagem</span>
              </button>
              <button
                onClick={() => setActiveTab("stops")}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition cursor-pointer ${
                  activeTab === "stops" ? "text-slide-accent font-bold" : "text-slide-dim hover:text-slide-paper"
                }`}
              >
                <span className="text-base">⏱️</span>
                <span className="text-[10px]">Paragens</span>
              </button>
              <button
                onClick={() => setAttendanceModalOpen(true)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slide-dim hover:text-slide-paper cursor-pointer"
              >
                <span className="text-base">📋</span>
                <span className="text-[10px]">Pauta</span>
              </button>
              <button
                onClick={() => setOfflineMode(!offlineMode)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slide-dim hover:text-slide-paper cursor-pointer"
              >
                <span className="text-base">{offlineMode ? "📡" : "📶"}</span>
                <span className="text-[10px]">{offlineMode ? "Offline" : "Rede"}</span>
              </button>
            </>
          )}

          {role === "company" && (
            <>
              <button
                onClick={() => setActiveTab("home")}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slide-accent font-bold cursor-pointer"
              >
                <span className="text-base">🏢</span>
                <span className="text-[10px]">Frota</span>
              </button>
              <button
                onClick={() => setDocsModalOpen(true)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slide-dim hover:text-slide-paper cursor-pointer"
              >
                <span className="text-base">📄</span>
                <span className="text-[10px]">Documentos</span>
              </button>
              <button
                onClick={() => setAttendanceModalOpen(true)}
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-slide-dim hover:text-slide-paper cursor-pointer"
              >
                <span className="text-base">📋</span>
                <span className="text-[10px]">Pauta</span>
              </button>
            </>
          )}

          {/* Universal SOS Button on Bottom Bar */}
          <button
            onClick={() => setSosOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-destructive hover:opacity-90 transition cursor-pointer"
          >
            <span className="text-base">🚨</span>
            <span className="text-[10px] font-bold">SOS</span>
          </button>
        </nav>

        {/* QUICK WALKIE-TALKIE DRAWER MODAL */}
        {chatOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center">
            <div className="w-full max-w-md rounded-t-3xl bg-slide-paper p-5 animate-in slide-in-from-bottom shadow-2xl border-t border-slide-line/40 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slide-line">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <div>
                    <h3 className="font-extrabold text-base leading-tight">Walkie-Talkie TransiGo</h3>
                    <p className="text-[11px] text-slide-dim">
                      {role === "driver" ? "Canal com os Encarregados" : `Canal com ${currentRoute.driver} (Motorista)`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="w-7 h-7 rounded-full bg-slide-line text-xs font-bold grid place-items-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-4">
                {messages.map((m) => {
                  const isMe = (role === "driver" && m.sender === "driver") || (role === "parent" && m.sender === "parent");
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      <div className="text-[10px] text-slide-dim mb-0.5">{m.senderName} · {m.time}</div>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs max-w-[85%] font-medium shadow-2xs ${
                          isMe
                            ? "bg-slide-paper-ink text-slide-paper rounded-br-xs"
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
              <div className="pt-2 border-t border-slide-line space-y-2">
                <div className="text-[10px] font-bold text-slide-dim uppercase tracking-wider">
                  Enviar Mensagem Pré-definida com 1 Toque:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(role === "driver"
                    ? [
                        "🚌 Já cheguei à paragem.",
                        "⏳ Aguardando 2 minutos.",
                        "🚦 Trânsito congestionado na via (+5 min).",
                        "🏫 Chegámos à escola em segurança.",
                      ]
                    : [
                        "👨‍👩‍👧 Já estamos na paragem à espera.",
                        "🏃‍♂️ A descer do prédio agora.",
                        "✅ Recebemos a criança, obrigado!",
                        "⚠️ O educando vai com a tia hoje.",
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
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slide-paper p-5 shadow-2xl border border-slide-line">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black" style={{ fontFamily: "var(--font-display)" }}>
                  📅 Reportar Ausência
                </h3>
                <button
                  onClick={() => setAbsenceModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slide-line text-xs font-bold grid place-items-center cursor-pointer"
                >
                  ✕
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
                        ? "border-slide-accent bg-slide-accent/20 font-bold"
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
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slide-paper p-5 shadow-2xl border border-slide-line">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-black" style={{ fontFamily: "var(--font-display)" }}>
                  🛡️ Validar PIN de Entrega
                </h3>
                <button
                  onClick={() => {
                    setPinVerifyModalOpen(false);
                    setPinInput("");
                  }}
                  className="w-7 h-7 rounded-full bg-slide-line text-xs font-bold grid place-items-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slide-paper-ink/70 mb-3">
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
                  className="w-full text-center text-3xl font-mono font-black tracking-widest rounded-2xl bg-slide-line/40 py-3 border border-slide-line outline-none focus:ring-2 ring-slide-accent"
                />
                <div className="text-center text-[11px] text-slide-dim mt-1.5">
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
                  className="rounded-xl bg-slide-line px-3 py-2.5 font-bold text-xs cursor-pointer"
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
          amount="45 000 Kz"
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
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end justify-center">
            <div className="w-full max-w-md rounded-t-3xl bg-slide-paper p-5 animate-in slide-in-from-bottom shadow-2xl border-t border-slide-line/40">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <span>🚨</span>
                  <span>Emergência Escolar</span>
                </div>
                <button
                  onClick={() => setSosOpen(false)}
                  className="w-7 h-7 rounded-full bg-slide-line text-sm font-bold grid place-items-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slide-paper-ink/70 mb-4 leading-relaxed">
                Ao selecionar o tipo de ocorrência, a localização GPS ao vivo do autocarro em Luanda é enviada imediatamente à central escolar, à empresa e aos encarregados.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-4">
                {EMERGENCY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => sendSos(t)}
                    className="rounded-2xl bg-destructive/10 text-destructive font-bold text-xs p-3 hover:bg-destructive/20 cursor-pointer transition text-left"
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-slide-paper-ink/60 uppercase tracking-wider mb-2">
                Linhas Diretas de Emergência (Angola)
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {NUMBERS.map(([n, num]) => (
                  <a
                    key={num}
                    href={`tel:${num}`}
                    className="rounded-xl border border-slide-line p-2 text-center hover:bg-slide-line/40 transition"
                  >
                    <div className="font-black text-sm text-slide-paper-ink">{num}</div>
                    <div className="text-[10px] text-slide-paper-ink/60 truncate">{n}</div>
                  </a>
                ))}
              </div>

              <button
                onClick={() => setSosOpen(false)}
                className="w-full rounded-xl bg-slide-line py-3 font-bold text-sm cursor-pointer hover:bg-slide-line/80 transition"
              >
                Voltar à viagem
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
