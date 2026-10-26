import { useState } from "react";
import { NativeMobileApp, type Role } from "./NativeMobileApp";

interface MockupViewProps {
  onNavigate: (view: "mockup" | "admin" | "deck" | "landing") => void;
}

export function MockupView({ onNavigate }: MockupViewProps) {
  const [selectedRole, setSelectedRole] = useState<Role>("parent");
  const [islandExpanded, setIslandExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink selection:bg-slide-accent selection:text-slide-accent-ink" style={{ fontFamily: "var(--font-body)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 min-h-screen grid lg:grid-cols-[1.1fr_auto] gap-10 lg:gap-14 items-center">
        {/* Left Side Panel: Role Switcher & Scenario Controls */}
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slide-surface text-slide-accent text-xs font-black tracking-wider uppercase mb-3 border border-slide-line/20 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-slide-ok animate-pulse" />
              <span>Simulador iPhone 16 Pro · TransiGo Luanda</span>
            </div>

            <h1
              className="text-3xl sm:text-5xl font-black leading-tight tracking-tight text-slide-paper"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Ecossistema Completo.
              <br />
              <span className="text-slide-accent">Três Perfis Interligados.</span>
            </h1>

            <p className="mt-3 text-sm sm:text-base text-slide-dim max-w-xl leading-relaxed">
              O iPhone ao lado simula a aplicação em funcionamento real. Escolha o perfil que deseja operar aqui na barra lateral:
            </p>
          </div>

          {/* SIDE ROLE SWITCHER CARDS */}
          <div className="space-y-3 max-w-lg">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slide-accent flex items-center gap-2">
              <span>👤</span>
              <span>SELECIONE O PERFIL ATIVO NO IPHONE:</span>
            </div>

            {(
              [
                [
                  "parent",
                  "👩‍👧 Encarregado de Educação (Pais)",
                  "Acompanhamento GPS em tempo real, alerta antecipado a 500m da paragem, PIN de entrega segura, reporte de faltas e pagamento Multicaixa Express.",
                  "Sra. Luísa Domingos · Aluna: Maria",
                ],
                [
                  "driver",
                  "🧑‍✈️ Motorista Oficial (Condutor)",
                  "Início/pausa de viagem, chamada digital de alunos a bordo, validação por PIN no desembarque, reporte de trânsito e walkie-talkie rápido.",
                  "João Mateus · Autocarro 12",
                ],
                [
                  "company",
                  "🏢 Empresa de Transporte & Colégio",
                  "Monitorização da frota em Luanda, pauta diária de presenças para a secretaria e gestão de seguros/inspeções DNVT.",
                  "Central de Operações · Morro Bento",
                ],
              ] as const
            ).map(([r, title, desc, tag]) => {
              const active = selectedRole === r;
              return (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition cursor-pointer relative ${
                    active
                      ? "border-slide-accent bg-slide-surface shadow-xl ring-2 ring-slide-accent/30 scale-[1.01]"
                      : "border-slide-surface bg-slide-bg/80 hover:border-slide-dim/60 hover:bg-slide-surface/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-extrabold text-sm sm:text-base text-slide-paper">{title}</span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full transition ${
                        active
                          ? "bg-slide-accent text-slide-accent-ink shadow-xs"
                          : "bg-slide-line/40 text-slide-dim"
                      }`}
                    >
                      {active ? "Aberto no iPhone ✓" : "Mudar Perfil"}
                    </span>
                  </div>

                  <p className="text-xs text-slide-dim leading-relaxed mb-2">{desc}</p>

                  <div className="text-[10px] font-mono text-slide-accent flex items-center gap-1.5 opacity-90">
                    <span className="w-1.5 h-1.5 rounded-full bg-slide-ok" />
                    <span>Sessão: {tag}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick External Actions & Hub Links */}
          <div className="pt-4 border-t border-slide-surface max-w-lg flex flex-wrap gap-3 text-xs font-bold items-center">
            <button
              onClick={() => onNavigate("landing")}
              className="rounded-xl bg-slide-accent text-slide-accent-ink px-4 py-2.5 shadow hover:opacity-95 transition cursor-pointer flex items-center gap-2"
            >
              <span>📄</span>
              <span>Solicitar Contrato Escolar (Landing Page)</span>
            </button>

            <button
              onClick={() => onNavigate("admin")}
              className="rounded-xl bg-slide-surface text-slide-paper px-4 py-2.5 border border-slide-line/20 hover:bg-slide-surface/80 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>⚙️</span>
              <span>Painel Admin</span>
            </button>

            <button
              onClick={() => onNavigate("deck")}
              className="py-2.5 px-3 text-slide-dim hover:text-slide-paper underline transition cursor-pointer"
            >
              Ver Slides de Apresentação →
            </button>
          </div>
        </div>

        {/* ================= TRUE IPHONE 16 PRO HARDWARE FRAME ================= */}
        <div className="relative mx-auto select-none">
          {/* External Physical Side Buttons (Hardware) */}
          {/* Action Button (Top Left) */}
          <div className="hidden sm:block w-[4px] h-8 bg-[#3d424b] rounded-l-xs absolute -left-[4px] top-28 shadow-sm" />
          {/* Volume Up (Left) */}
          <div className="hidden sm:block w-[4px] h-12 bg-[#3d424b] rounded-l-xs absolute -left-[4px] top-40 shadow-sm" />
          {/* Volume Down (Left) */}
          <div className="hidden sm:block w-[4px] h-12 bg-[#3d424b] rounded-l-xs absolute -left-[4px] top-56 shadow-sm" />
          {/* Power / Siri Button (Right) */}
          <div className="hidden sm:block w-[4px] h-18 bg-[#3d424b] rounded-r-xs absolute -right-[4px] top-44 shadow-sm" />

          {/* Outer Titanium Chassis */}
          <div
            className="w-[395px] h-[820px] rounded-[56px] p-[11px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12)]"
            style={{
              background:
                "linear-gradient(135deg, #2e3239 0%, #17191d 40%, #111317 60%, #2e3239 100%)",
            }}
          >
            {/* Screen Bezel & Display Frame */}
            <div className="relative h-full w-full rounded-[46px] bg-black text-slide-paper-ink overflow-hidden flex flex-col border-[2px] border-[#0a0a0c]">
              {/* Speaker Ear-piece Slit */}
              <div className="w-16 h-1 bg-[#1a1c22] rounded-full mx-auto mt-1 absolute top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-none" />

              {/* iOS 18 Top Status Bar */}
              <div className="h-11 bg-slide-paper-ink text-slide-paper px-7 flex items-center justify-between text-xs font-semibold z-40 shrink-0 select-none">
                {/* Clock */}
                <span className="font-bold tracking-tight text-xs">9:41</span>

                {/* Right Status Icons: 4G/5G, WiFi, Battery with percentage */}
                <div className="flex items-center gap-1.5 text-[10px]">
                  {/* Cellular Bars */}
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-0.5 h-1 bg-white rounded-xs" />
                    <span className="w-0.5 h-1.5 bg-white rounded-xs" />
                    <span className="w-0.5 h-2 bg-white rounded-xs" />
                    <span className="w-0.5 h-2.5 bg-white rounded-xs" />
                  </div>

                  <span className="font-bold">5G</span>

                  {/* Battery Pill */}
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] font-mono font-bold">94%</span>
                    <div className="w-5 h-2.5 rounded-sm border border-white/70 p-0.5 flex items-center">
                      <div className="w-3.5 h-full bg-slide-ok rounded-xs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* DYNAMIC ISLAND PILL (APPLE REALISTIC) */}
              <div
                onClick={() => setIslandExpanded(!islandExpanded)}
                className={`absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-black text-white rounded-full flex items-center justify-between px-3 shadow-2xl transition-all duration-300 cursor-pointer ${
                  islandExpanded
                    ? "w-[260px] h-[48px] py-2"
                    : "w-[122px] h-[30px]"
                }`}
              >
                {islandExpanded ? (
                  <div className="w-full flex items-center justify-between text-xs px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base animate-pulse">🚌</span>
                      <div>
                        <div className="text-[10px] font-black text-slide-accent leading-none">TransiGo Ao Vivo</div>
                        <div className="text-[9px] opacity-70">Autocarro 12 · Morro Bento</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slide-ok font-bold">3 min</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px]">🚌</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slide-ok animate-pulse" />
                    </div>

                    {/* Camera Sensor Dot & FaceID */}
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0d0f14] border border-[#222] shadow-inner" />

                    <div className="text-[9px] font-mono text-slide-accent font-bold">3m</div>
                  </>
                )}
              </div>

              {/* Inside iPhone: Native App Screen Content */}
              <div className="flex-1 min-h-0 overflow-hidden relative bg-slide-paper flex flex-col">
                <NativeMobileApp
                  initialRole={selectedRole}
                  onOpenContractLanding={() => onNavigate("landing")}
                />
              </div>

              {/* iOS Home Indicator Bar */}
              <div className="h-5 bg-slide-paper-ink flex items-center justify-center shrink-0 z-40">
                <div className="w-36 h-1 bg-white/70 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
