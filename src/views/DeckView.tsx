import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface DeckViewProps {
  onNavigate: (view: "mockup" | "admin" | "deck") => void;
  initialSlide?: number;
}

/* ---------- building blocks ---------- */
function Frame({ children, n }: { children: ReactNode; n: number }) {
  return (
    <div className="slide-content bg-slide-bg text-slide-ink select-none">
      {children}
      <div className="absolute bottom-10 left-24 right-24 flex justify-between slide-chrome text-slide-dim">
        <span className="font-semibold text-slide-accent">TransiGo Angola</span>
        <span>
          {n} / {SLIDES.length}
        </span>
      </div>
    </div>
  );
}

function Phone({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-[400px] h-[820px] rounded-[56px] bg-slide-paper-ink p-4 shadow-2xl ${className}`}>
      <div className="h-full w-full rounded-[44px] bg-slide-paper text-slide-paper-ink overflow-hidden relative">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 rounded-full bg-slide-paper-ink" />
        <div className="pt-14 px-6 h-full">{children}</div>
      </div>
    </div>
  );
}

function MapBox({ className = "" }: { className?: string }) {
  return (
    <div className={`relative rounded-3xl overflow-hidden bg-slide-line ${className}`}>
      <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <path d="M0 80 H300 M0 200 H300 M90 0 V300 M210 0 V300" stroke="var(--slide-paper)" strokeWidth="14" />
        <path
          d="M40 260 C 90 200, 120 210, 150 150 S 230 70, 260 40"
          fill="none"
          stroke="var(--slide-accent)"
          strokeWidth="8"
          strokeDasharray="2 14"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute left-[46%] top-[44%] w-12 h-12 rounded-full bg-slide-accent border-4 border-slide-paper grid place-items-center text-xl">
        🚌
      </div>
      <div className="absolute right-[10%] top-[8%] w-8 h-8 rounded-full bg-slide-paper-ink border-4 border-slide-paper" />
    </div>
  );
}

function Pill({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "ok" }) {
  return (
    <span
      className={`slide-chrome inline-block rounded-full px-5 py-2 font-bold ${
        tone === "ok" ? "bg-slide-ok text-slide-accent-ink" : "bg-slide-accent text-slide-accent-ink"
      }`}
    >
      {children}
    </span>
  );
}

/* ---------- slides ---------- */
const SLIDES: { title: string; render: (n: number) => ReactNode }[] = [
  {
    title: "TransiGo",
    render: (n) => (
      <Frame n={n}>
        <div className="absolute inset-0 grid grid-cols-2 items-center px-24 gap-16">
          <div>
            <div className="slide-kicker text-slide-accent mb-8">Conceito da app · Luanda 2026</div>
            <h1 className="slide-title-lg">
              Cada viagem,
              <br />
              visível.
              <br />
              <span className="text-slide-accent">Cada criança, segura.</span>
            </h1>
            <p className="slide-subtitle text-slide-dim mt-10 max-w-[800px]">
              A TransiGo liga empresas de transporte, colégios, motoristas e encarregados de educação numa só plataforma.
            </p>
          </div>
          <div className="flex items-center justify-center p-8 bg-slide-surface/40 rounded-[40px] border border-slide-surface">
            <img
              src="/transigo.png"
              alt="TransiGo"
              className="w-full max-h-[700px] object-contain drop-shadow-2xl rounded-3xl"
              onError={(e) => {
                // High-fidelity fallback badge if image is not present
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "O problema",
    render: (n) => (
      <Frame n={n}>
        <div className="px-24 pt-28">
          <div className="slide-kicker text-slide-accent mb-6">O problema</div>
          <h2 className="slide-title max-w-[1500px]">O transporte escolar ainda funciona à base de chamadas e adivinhas.</h2>
          <div className="grid grid-cols-3 gap-10 mt-20">
            {[
              [
                "Encarregados",
                "Esperam na paragem sem saber se o autocarro está atrasado — ou quem o conduz.",
              ],
              [
                "Escolas",
                "Gerem contratos, rotas e listas de alunos em papel e folhas de cálculo vulneráveis.",
              ],
              [
                "Empresas",
                "Têm dificuldade em ganhar, acompanhar e reportar contratos com vários clientes simultaneamente.",
              ],
            ].map(([h, b]) => (
              <div key={h} className="rounded-3xl bg-slide-surface p-12 min-h-[340px]">
                <div className="slide-subtitle font-bold text-slide-accent mb-6">{h}</div>
                <p className="slide-body text-slide-dim">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Como funciona",
    render: (n) => (
      <Frame n={n}>
        <div className="px-24 pt-28">
          <div className="slide-kicker text-slide-accent mb-6">Como funciona</div>
          <h2 className="slide-title">Um contrato. Três perfis interligados.</h2>
          <div className="flex items-stretch gap-6 mt-24">
            {[
              ["1", "A escola pede", "Envia um pedido de contrato: rotas, horários, número de alunos."],
              ["2", "A empresa aceita", "Atribui autocarros e motoristas e assina o contrato na app."],
              ["3", "O motorista conduz", "Segue a rota de Luanda e regista a entrada e saída dos alunos."],
              ["4", "Os encarregados acompanham", "Veem o autocarro ao vivo no mapa, o motorista e a hora exata de chegada."],
            ].map(([k, h, b], i) => (
              <div key={k} className="flex-1 flex items-center gap-6">
                <div className="flex-1 rounded-3xl bg-slide-surface p-10 min-h-[380px]">
                  <div className="w-16 h-16 rounded-full bg-slide-accent text-slide-accent-ink grid place-items-center slide-body font-bold mb-8">
                    {k}
                  </div>
                  <div className="slide-body font-bold mb-4">{h}</div>
                  <p className="slide-caption text-slide-dim">{b}</p>
                </div>
                {i < 3 && <div className="slide-subtitle text-slide-accent">→</div>}
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "App do encarregado",
    render: (n) => (
      <Frame n={n}>
        <div className="absolute inset-0 grid grid-cols-[1fr_auto] items-center px-24 gap-20">
          <div>
            <div className="slide-kicker text-slide-accent mb-6">App do encarregado</div>
            <h2 className="slide-title">Saiba exatamente onde está o autocarro.</h2>
            <ul className="slide-body text-slide-dim mt-12 space-y-6 max-w-[900px]">
              <li>• Localização do autocarro ao vivo no mapa de Luanda</li>
              <li>• Nome, foto e matrícula do motorista qualificado</li>
              <li>• Alertas automáticos: “Autocarro a 5 min”, “A Maria entrou”</li>
              <li>• Botão SOS para emergências com canais diretos</li>
            </ul>
          </div>
          <Phone>
            <div className="text-[15px] font-bold opacity-60">Bom dia, Sra. Luísa</div>
            <div className="text-[26px] font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Autocarro da Maria
            </div>
            <MapBox className="h-[300px]" />
            <div className="mt-4 rounded-2xl bg-slide-accent text-slide-accent-ink p-4 flex justify-between items-center">
              <div>
                <div className="text-[13px] font-bold opacity-70">CHEGA EM</div>
                <div className="text-[30px] font-extrabold">6 min</div>
              </div>
              <div className="text-[14px] font-bold text-right">Paragem: Mutamba</div>
            </div>
            <div className="mt-4 rounded-2xl border border-slide-line p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slide-paper-ink text-slide-paper grid place-items-center font-bold">
                JM
              </div>
              <div className="flex-1">
                <div className="font-bold text-[16px]">João Mateus</div>
                <div className="text-[13px] opacity-60">Motorista · Autocarro 12 · LD-24-61-AB</div>
              </div>
              <div className="text-[20px]">📞</div>
            </div>
            <div className="mt-3 text-[13px] rounded-xl bg-slide-line/60 p-3">✅ A Maria entrou às 07:42</div>
          </Phone>
        </div>
      </Frame>
    ),
  },
  {
    title: "App do motorista",
    render: (n) => (
      <Frame n={n}>
        <div className="absolute inset-0 grid grid-cols-[auto_1fr] items-center px-24 gap-20">
          <Phone>
            <div className="text-[26px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
              Rota A · Manhã
            </div>
            <div className="text-[14px] opacity-60 mb-4">Escola Primária do Morro Bento · 18 alunos</div>
            <div className="rounded-2xl bg-slide-ok text-slide-accent-ink p-4 font-bold text-[18px] mb-4 text-center">
              ● Viagem em curso
            </div>
            {[
              ["Maria D.", true],
              ["Edson M.", true],
              ["Ana K.", false],
              ["Bruno N.", false],
              ["Sofia P.", false],
            ].map(([name, on]) => (
              <div
                key={name as string}
                className="flex justify-between items-center py-3 border-b border-slide-line text-[17px]"
              >
                <span className="font-semibold">{name}</span>
                <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${on ? "bg-slide-ok" : "bg-slide-line"}`}>
                  {on ? "A bordo" : "Registar"}
                </span>
              </div>
            ))}
            <div className="absolute bottom-8 left-6 right-6 rounded-2xl bg-slide-paper-ink text-slide-paper text-center py-4 font-bold text-[18px]">
              Próxima paragem · 2 min
            </div>
          </Phone>
          <div>
            <div className="slide-kicker text-slide-accent mb-6">App do motorista</div>
            <h2 className="slide-title">Tão simples que se usa num semáforo.</h2>
            <ul className="slide-body text-slide-dim mt-12 space-y-6 max-w-[900px]">
              <li>• Iniciar viagem — a localização é partilhada automaticamente</li>
              <li>• Um toque para registar cada aluno</li>
              <li>• Reportar atrasos no trânsito ou emergências à escola e encarregados</li>
            </ul>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Painel da empresa e da escola",
    render: (n) => (
      <Frame n={n}>
        <div className="px-24 pt-24">
          <div className="slide-kicker text-slide-accent mb-4">Painel da empresa e da escola</div>
          <h2 className="slide-title mb-12">Contratos, frota e rotas num só lugar.</h2>
          <div className="rounded-[32px] bg-slide-paper text-slide-paper-ink p-10 grid grid-cols-[300px_1fr_520px] gap-8 h-[640px]">
            <div className="space-y-3 text-[22px] font-semibold">
              {["Resumo", "Contratos", "Pedidos", "Frota", "Motoristas", "Rotas"].map((x, i) => (
                <div key={x} className={`rounded-xl px-5 py-3 ${i === 1 ? "bg-slide-accent" : ""}`}>
                  {x}
                </div>
              ))}
            </div>
            <div>
              <div className="text-[28px] font-bold mb-5">Contratos</div>
              {[
                ["Escola Primária do Morro Bento", "Ativo", "4 autocarros"],
                ["Colégio São Paulo", "Ativo", "2 autocarros"],
                ["Escola Internacional", "Pedido", "Novo"],
                ["Administração Municipal", "Rascunho", "—"],
              ].map(([s, st, b]) => (
                <div key={s} className="flex items-center justify-between border-b border-slide-line py-4 text-[20px]">
                  <span className="font-semibold">{s}</span>
                  <span className="opacity-60">{b}</span>
                  <Pill tone={st === "Ativo" ? "ok" : "accent"}>{st}</Pill>
                </div>
              ))}
            </div>
            <div className="flex flex-col">
              <div className="text-[28px] font-bold mb-5">Frota ao vivo</div>
              <MapBox className="flex-1" />
            </div>
          </div>
        </div>
      </Frame>
    ),
  },
  {
    title: "Próximos passos",
    render: (n) => (
      <Frame n={n}>
        <div className="absolute inset-0 flex flex-col justify-center px-24">
          <div className="slide-kicker text-slide-accent mb-6">Próximos passos</div>
          <h2 className="slide-title-lg max-w-[1500px]">
            Começar com uma escola. <span className="text-slide-accent">Crescer a partir daí.</span>
          </h2>
          <div className="flex gap-6 mt-16">
            <Pill>1 · Piloto com uma escola parceira</Pill>
            <Pill>2 · Criar as apps de encarregado e motorista</Pill>
            <Pill>3 · Abrir contratos a mais clientes</Pill>
          </div>
        </div>
      </Frame>
    ),
  },
];

/* ---------- deck shell ---------- */
function Scaled({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: 1920,
          height: 1080,
          marginLeft: -960,
          marginTop: -540,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function DeckView({ onNavigate, initialSlide = 1 }: DeckViewProps) {
  const [slide, setSlide] = useState(initialSlide);
  const idx = Math.min(Math.max(slide - 1, 0), SLIDES.length - 1);

  const go = useCallback(
    (d: number) => {
      setSlide((prev) => Math.min(Math.max(prev + d, 1), SLIDES.length));
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        go(1);
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "f" || e.key === "F5") {
        e.preventDefault();
        document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const touchX = useRef<number | null>(null);

  return (
    <div
      className="h-screen w-screen bg-slide-paper-ink flex flex-col overflow-hidden"
      onTouchStart={(e) => (touchX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0]!.clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Top quick navigation */}
      <header className="px-6 py-2.5 bg-slide-bg flex items-center justify-between border-b border-slide-surface text-xs z-20">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slide-accent">TransiGo Pitch Deck</span>
          <span className="text-slide-dim">· {SLIDES[idx]!.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("mockup")}
            className="px-3 py-1 rounded-lg bg-slide-surface text-slide-ink hover:bg-slide-dim hover:text-slide-paper-ink transition cursor-pointer font-semibold"
          >
            📱 Abrir Simulador Telemóvel
          </button>
          <button
            onClick={() => onNavigate("admin")}
            className="px-3 py-1 rounded-lg bg-slide-accent text-slide-accent-ink hover:opacity-90 transition cursor-pointer font-semibold"
          >
            🖥️ Abrir Painel Admin
          </button>
        </div>
      </header>

      {/* Slide Canvas */}
      <div className="flex-1 min-h-0 relative">
        <Scaled>{SLIDES[idx]!.render(idx + 1)}</Scaled>
      </div>

      {/* Deck Controls Bar */}
      <footer className="flex items-center justify-center gap-3 py-3 text-sm text-slide-dim bg-slide-bg/95 border-t border-slide-surface z-20">
        <button
          onClick={() => go(-1)}
          disabled={idx === 0}
          className="rounded-full px-4 py-1.5 bg-slide-surface hover:bg-slide-line/40 text-slide-ink disabled:opacity-30 cursor-pointer transition"
        >
          ← Anterior
        </button>
        <span className="font-mono text-slide-ink font-semibold">
          {idx + 1} / {SLIDES.length}
        </span>
        <button
          onClick={() => go(1)}
          disabled={idx === SLIDES.length - 1}
          className="rounded-full px-4 py-1.5 bg-slide-surface hover:bg-slide-line/40 text-slide-ink disabled:opacity-30 cursor-pointer transition"
        >
          Seguinte →
        </button>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.();
            } else {
              document.exitFullscreen?.();
            }
          }}
          className="rounded-full px-4 py-1.5 bg-slide-accent text-slide-accent-ink font-semibold hover:opacity-90 transition cursor-pointer"
        >
          Tela Cheia (F)
        </button>
      </footer>
    </div>
  );
}
