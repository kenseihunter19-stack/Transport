import { useEffect, useState, type ReactNode } from "react";
import { LuandaMap } from "@/components/LuandaMap";
import { downloadCsv, downloadDocument } from "@/lib/operations";

type Tab = "Painel" | "Contratos" | "Frota" | "Motoristas" | "Alunos" | "Emergências" | "Relatórios";

const TABS: [Tab, string][] = [
  ["Painel", "📊"],
  ["Contratos", "📄"],
  ["Frota", "🚌"],
  ["Motoristas", "🧑‍✈️"],
  ["Alunos", "🎒"],
  ["Emergências", "🚨"],
  ["Relatórios", "📈"],
];

const BUSES_INITIAL = [
  { id: 12, plate: "LD-24-61-AB", driver: "João Mateus", route: "Rota A · Morro Bento", status: "Na estrada", students: 18, fuel: "78%", inspection: "Válido (2027)" },
  { id: 7, plate: "LD-31-02-CK", driver: "Paulo Cassoma", route: "Rota B · Maianga", status: "Na estrada", students: 22, fuel: "64%", inspection: "Válido (2027)" },
  { id: 3, plate: "LD-18-77-FE", driver: "Rosa Tchissola", route: "Rota C · Talatona", status: "Parado", students: 0, fuel: "90%", inspection: "Válido (2027)" },
  { id: 9, plate: "LD-05-49-HM", driver: "Adão Bento", route: "Rota D · Kilamba", status: "Na estrada", students: 15, fuel: "42%", inspection: "A renovar (30 dias)" },
  { id: 15, plate: "LD-40-13-QZ", driver: "—", route: "—", status: "Manutenção", students: 0, fuel: "15%", inspection: "Na oficina" },
  { id: 4, plate: "LD-22-88-PL", driver: "Teresa Lunda", route: "Rota E · Viana", status: "Parado", students: 0, fuel: "85%", inspection: "Válido (2027)" },
];

const DRIVERS_INITIAL = [
  { name: "João Mateus", rating: "4,9", bus: "Autocarro 12", status: "Em serviço", trips: 44, salary: "220 000 Kz" },
  { name: "Paulo Cassoma", rating: "4,7", bus: "Autocarro 7", status: "Em serviço", trips: 42, salary: "210 000 Kz" },
  { name: "Rosa Tchissola", rating: "4,8", bus: "Autocarro 3", status: "Disponível", trips: 38, salary: "190 000 Kz" },
  { name: "Adão Bento", rating: "4,6", bus: "Autocarro 9", status: "Em serviço", trips: 40, salary: "200 000 Kz" },
  { name: "Teresa Lunda", rating: "4,9", bus: "Autocarro 4", status: "Disponível", trips: 45, salary: "225 000 Kz" },
  { name: "Manuel Kiala", rating: "4,5", bus: "—", status: "De folga", trips: 20, salary: "100 000 Kz" },
];

const STUDENTS = [
  ["Maria Domingos", "Escola Primária do Morro Bento", "Mutamba", "Sra. Luísa Domingos", "A bordo"],
  ["Edson Manuel", "Escola Primária do Morro Bento", "Kinaxixi", "Sr. Manuel Neto", "A bordo"],
  ["Ana Kiala", "Escola Primária do Morro Bento", "Maianga", "Sra. Joana Kiala", "À espera"],
  ["Bruno Neto", "Escola Primária do Morro Bento", "Alvalade", "Sr. Carlos Neto", "À espera"],
  ["Sofia Pedro", "Colégio São Paulo", "Maianga", "Sra. Isabel Pedro", "A bordo"],
  ["Hélder Cunha", "Colégio São Paulo", "Prenda", "Sr. Rui Cunha", "Ausente"],
];

const ALERTS_INITIAL = [
  { t: "07:52", bus: 7, type: "🔧 Avaria mecânica do autocarro", from: "Motorista", open: true },
  { t: "Ontem 15:10", bus: 12, type: "🚑 Problema de saúde súbito", from: "Encarregado", open: false },
  { t: "22 Out 07:30", bus: 9, type: "🛡️ Segurança pública / Trânsito", from: "Motorista", open: false },
];

interface AdminViewProps {
  onNavigate: (view: "mockup" | "admin" | "deck" | "native") => void;
}

export function AdminView({ onNavigate }: AdminViewProps) {
  const [tab, setTab] = useState<Tab>("Painel");
  const [search, setSearch] = useState("");
  const [contracts, setContracts] = useState([
    { client: "Escola Primária do Morro Bento", buses: 4, value: "1 200 000 Kz", status: "Ativo" },
    { client: "Colégio São Paulo (Maianga)", buses: 2, value: "650 000 Kz", status: "Ativo" },
    { client: "Complexo Escolar do Kilamba", buses: 3, value: "900 000 Kz", status: "Pedido" },
    { client: "Escola Internacional de Talatona", buses: 5, value: "1 600 000 Kz", status: "Pedido" },
    { client: "Liceu Francês de Luanda", buses: 2, value: "700 000 Kz", status: "Recusado" },
  ]);
  const [alerts, setAlerts] = useState(ALERTS_INITIAL);
  const [progress, setProgress] = useState(0.42);
  const [buses] = useState(BUSES_INITIAL);
  const [drivers] = useState(DRIVERS_INITIAL);

  // New contract modal
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [newSchool, setNewSchool] = useState("");
  const [newBuses, setNewBuses] = useState(2);
  const [newValue, setNewValue] = useState("600 000 Kz");

  useEffect(() => {
    const id = setInterval(() => setProgress((p) => (p + 0.002 > 1 ? 0 : p + 0.002)), 300);
    return () => clearInterval(id);
  }, []);

  const openAlerts = alerts.filter((a) => a.open).length;

  function setStatus(index: number, status: string) {
    setContracts((all) => all.map((c, i) => (i === index ? { ...c, status } : c)));
  }

  function handleDownloadReport(name: string) {
    if (name === "Relatório mensal de viagens") {
      downloadCsv("transigo-viagens-mensal.csv", [
        ["Data", "Autocarro", "Matrícula", "Motorista", "Rota", "Alunos", "Estado"],
        ["2026-10-24", "12", "LD-24-61-AB", "João Mateus", "Rota A · Morro Bento", 18, "Concluída"],
        ["2026-10-24", "7", "LD-31-02-CK", "Paulo Cassoma", "Rota B · Maianga", 22, "Concluída"],
        ["2026-10-24", "9", "LD-05-49-HM", "Adão Bento", "Rota D · Kilamba", 15, "Concluída"],
        ["2026-10-24", "4", "LD-22-88-PL", "Teresa Lunda", "Rota E · Viana", 19, "Concluída"],
      ]);
    } else if (name === "Relatório de folha de salários (Motoristas)") {
      downloadCsv("transigo-folha-salarios.csv", [
        ["Motorista", "Avaliação", "Autocarro", "Viagens Concluídas", "Taxa/Viagem (Kz)", "Total Bruto (Kz)"],
        ["João Mateus", "4.9", "12", "44", "5 000", "220 000 Kz"],
        ["Paulo Cassoma", "4.7", "7", "42", "5 000", "210 000 Kz"],
        ["Rosa Tchissola", "4.8", "3", "38", "5 000", "190 000 Kz"],
        ["Adão Bento", "4.6", "9", "40", "5 000", "200 000 Kz"],
        ["Teresa Lunda", "4.9", "4", "45", "5 000", "225 000 Kz"],
        ["Manuel Kiala", "4.5", "Reserva", "20", "5 000", "100 000 Kz"],
      ]);
    } else if (name === "Relatório de pontualidade") {
      downloadCsv("transigo-pontualidade.csv", [
        ["Dia", "Viagens Previstas", "Viagens a Horas", "Taxa Pontualidade"],
        ["Segunda-feira", "42", "40", "95.2%"],
        ["Terça-feira", "46", "43", "93.4%"],
        ["Quarta-feira", "44", "41", "93.1%"],
        ["Quinta-feira", "48", "46", "95.8%"],
        ["Sexta-feira", "45", "42", "93.3%"],
        ["Sábado", "12", "12", "100.0%"],
      ]);
    } else {
      downloadDocument(
        "Relatório de Emergências e Ocorrências",
        `TRANSIGO LUANDA - RELATÓRIO OPERACIONAL DE OCORRÊNCIAS\n\nTotal de Alertas: ${alerts.length}\nAbertos: ${openAlerts}\n\nDetalhes:\n` +
          alerts.map((a) => `- ${a.t} | Autocarro ${a.bus} | ${a.type} | Reportado por: ${a.from} | Status: ${a.open ? "ABERTO" : "RESOLVIDO"}`).join("\n")
      );
    }
  }

  const filteredBuses = buses.filter(
    (b) =>
      b.driver.toLowerCase().includes(search.toLowerCase()) ||
      b.plate.toLowerCase().includes(search.toLowerCase()) ||
      b.route.toLowerCase().includes(search.toLowerCase())
  );

  const filteredStudents = STUDENTS.filter(
    ([name, school, stop, guardian]) =>
      name.toLowerCase().includes(search.toLowerCase()) ||
      school.toLowerCase().includes(search.toLowerCase()) ||
      stop.toLowerCase().includes(search.toLowerCase()) ||
      guardian.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink flex" style={{ fontFamily: "var(--font-body)" }}>
      {/* Sidebar */}
      <aside className="w-64 bg-slide-paper-ink text-slide-paper flex flex-col justify-between p-6 shrink-0 border-r border-slide-surface">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-slide-accent text-slide-accent-ink grid place-items-center font-extrabold text-xl shadow">
              T
            </div>
            <div>
              <div className="font-bold text-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                TransiGo
              </div>
              <div className="text-xs text-slide-dim">Painel de Gestão</div>
            </div>
          </div>
          <nav className="space-y-1">
            {TABS.map(([t, icon]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full flex items-center justify-between rounded-xl px-4 py-2.5 font-semibold text-sm transition cursor-pointer ${
                  tab === t ? "bg-slide-accent text-slide-accent-ink" : "text-slide-dim hover:bg-slide-surface"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{icon}</span>
                  {t}
                </span>
                {t === "Emergências" && openAlerts > 0 && (
                  <span className="rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 text-xs font-bold animate-pulse">
                    {openAlerts}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="space-y-3 pt-6 border-t border-slide-surface text-sm">
          <button
            onClick={() => onNavigate("native")}
            className="block text-slide-accent font-bold hover:underline transition cursor-pointer"
          >
            📱 Abrir App Telemóvel (APK)
          </button>
          <button
            onClick={() => onNavigate("deck")}
            className="block text-slide-dim underline hover:text-slide-paper transition cursor-pointer"
          >
            Ver apresentação (Slides)
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-8 overflow-y-auto">
        <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <div className="text-sm text-slide-dim">Luanda · Transporte Escolar Integrado</div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {tab}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar frota, alunos, motoristas…"
              className="rounded-xl bg-slide-surface px-4 py-2 text-sm text-slide-ink outline-none w-72 focus:ring-2 ring-slide-accent"
            />
            <div className="w-10 h-10 rounded-full bg-slide-accent text-slide-accent-ink grid place-items-center font-bold">
              AD
            </div>
          </div>
        </header>

        {tab === "Painel" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Contratos ativos" value={contracts.filter((c) => c.status === "Ativo").length} />
              <Stat
                label="Autocarros na estrada"
                value={`${buses.filter((b) => b.status === "Na estrada").length}/${buses.length}`}
                accent
              />
              <Stat label="Alunos transportados hoje" value="412" />
              <Stat label="Emergências abertas" value={openAlerts} danger={openAlerts > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
              <Card title="Frota ao vivo · Luanda">
                <LuandaMap progress={progress} className="h-[380px]" />
              </Card>
              <Card title="Atividade recente da rota">
                <ul className="space-y-3 text-sm">
                  {[
                    "07:52 · 🚨 Autocarro 7 reportou avaria mecânica",
                    "07:48 · ✅ Maria Domingos entrou no autocarro 12 com PIN validado",
                    "07:40 · 🚌 Autocarro 9 iniciou a Rota D (Kilamba)",
                    "07:35 · 🚌 Autocarro 12 iniciou a Rota A (Morro Bento)",
                    "07:10 · 📨 Novo pedido: Complexo Escolar do Kilamba",
                  ].map((x) => (
                    <li key={x} className="rounded-xl bg-slide-bg px-3 py-2 text-slide-ink">
                      {x}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Viagens por dia (esta semana)">
                <div className="flex items-end gap-4 h-40 pt-4">
                  {[
                    ["Seg", 42],
                    ["Ter", 46],
                    ["Qua", 44],
                    ["Qui", 48],
                    ["Sex", 45],
                    ["Sáb", 12],
                  ].map(([d, v]) => (
                    <div key={d} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div
                        className="w-full rounded-t-lg bg-slide-accent transition-all duration-500"
                        style={{ height: `${(Number(v) / 48) * 100}%` }}
                      />
                      <span className="text-xs text-slide-dim">{d}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Pontualidade">
                <div className="text-5xl font-extrabold text-slide-accent">94%</div>
                <p className="text-slide-dim mt-2">das viagens chegaram a horas esta semana em Luanda.</p>
                <div className="mt-4 h-3 rounded-full bg-slide-bg overflow-hidden">
                  <div className="h-full bg-slide-ok" style={{ width: "94%" }} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "Contratos" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slide-dim">Gestão de acordos com colégios e escolas parceiras</span>
              <button
                onClick={() => setContractModalOpen(true)}
                className="rounded-xl bg-slide-accent text-slide-accent-ink px-4 py-2 font-bold text-sm cursor-pointer shadow hover:opacity-90"
              >
                + Novo Contrato
              </button>
            </div>

            <Table head={["Cliente", "Autocarros", "Valor mensal", "Estado", "Ações"]}>
              {contracts.map((c, i) => (
                <tr key={c.client} className="border-t border-slide-bg hover:bg-slide-surface/50 transition">
                  <td className="p-4 font-semibold">{c.client}</td>
                  <td className="p-4">{c.buses}</td>
                  <td className="p-4 font-mono">{c.value}</td>
                  <td className="p-4">
                    <Badge s={c.status} />
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {c.status === "Pedido" && (
                      <>
                        <button
                          onClick={() => setStatus(i, "Ativo")}
                          className="rounded-lg bg-slide-ok text-slide-accent-ink px-3 py-1 text-sm font-bold cursor-pointer hover:opacity-90"
                        >
                          Aceitar
                        </button>
                        <button
                          onClick={() => setStatus(i, "Recusado")}
                          className="rounded-lg bg-slide-bg px-3 py-1 text-sm font-bold cursor-pointer hover:opacity-80"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {c.status === "Ativo" && (
                      <span className="text-xs text-slide-dim">Contrato em vigor</span>
                    )}
                    {c.status === "Recusado" && (
                      <button
                        onClick={() => setStatus(i, "Pedido")}
                        className="text-xs text-slide-accent underline cursor-pointer"
                      >
                        Reabrir
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}

        {tab === "Frota" && (
          <Table head={["Autocarro", "Matrícula", "Motorista", "Rota", "Combustível", "Inspeção", "Estado"]}>
            {filteredBuses.map((b) => (
              <tr key={b.id} className="border-t border-slide-bg hover:bg-slide-surface/50 transition">
                <td className="p-4 font-bold">🚌 {b.id}</td>
                <td className="p-4 font-mono text-sm">{b.plate}</td>
                <td className="p-4">{b.driver}</td>
                <td className="p-4">{b.route}</td>
                <td className="p-4 font-mono text-xs">{b.fuel}</td>
                <td className="p-4 text-xs font-semibold">{b.inspection}</td>
                <td className="p-4">
                  <Badge s={b.status} />
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "Motoristas" && (
          <Table head={["Nome", "Avaliação", "Autocarro", "Viagens (Mês)", "Salário Bruto", "Estado"]}>
            {drivers.map((d) => (
              <tr key={d.name} className="border-t border-slide-bg hover:bg-slide-surface/50 transition">
                <td className="p-4 font-semibold">{d.name}</td>
                <td className="p-4 text-slide-accent font-bold">★ {d.rating}</td>
                <td className="p-4">{d.bus}</td>
                <td className="p-4 font-mono">{d.trips}</td>
                <td className="p-4 font-mono font-bold">{d.salary}</td>
                <td className="p-4">
                  <Badge s={d.status} />
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "Alunos" && (
          <Table head={["Aluno", "Escola", "Paragem", "Encarregado", "Hoje"]}>
            {filteredStudents.map(([n, e, p, g, s]) => (
              <tr key={n} className="border-t border-slide-bg hover:bg-slide-surface/50 transition">
                <td className="p-4 font-semibold">{n}</td>
                <td className="p-4">{e}</td>
                <td className="p-4">{p}</td>
                <td className="p-4">{g}</td>
                <td className="p-4">
                  <Badge s={s!} />
                </td>
              </tr>
            ))}
          </Table>
        )}

        {tab === "Emergências" && (
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 transition ${
                  a.open ? "bg-destructive/15 border border-destructive" : "bg-slide-surface"
                }`}
              >
                <div>
                  <div className="font-bold text-lg">
                    {a.type} · Autocarro {a.bus}
                  </div>
                  <div className="text-sm text-slide-dim">
                    {a.t} · Reportado por {a.from} · Rota de Luanda
                  </div>
                </div>
                {a.open ? (
                  <button
                    onClick={() =>
                      setAlerts((x) => x.map((y, j) => (j === i ? { ...y, open: false } : y)))
                    }
                    className="rounded-xl bg-slide-ok text-slide-accent-ink px-4 py-2 font-bold cursor-pointer hover:opacity-90"
                  >
                    Marcar resolvida
                  </button>
                ) : (
                  <Badge s="Resolvida" />
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "Relatórios" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="Receita mensal contratada" value="1 850 000 Kz" accent />
              <Stat label="Km percorridos (mês)" value="8 420 km" />
              <Stat label="Folha de Pagamentos" value="1 145 000 Kz" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                "Relatório mensal de viagens",
                "Relatório de folha de salários (Motoristas)",
                "Relatório de pontualidade",
                "Relatório de emergências",
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => handleDownloadReport(r)}
                  className="rounded-2xl bg-slide-surface p-5 text-left font-semibold hover:ring-2 ring-slide-accent transition cursor-pointer"
                >
                  <div className="text-xl mb-1">📄</div>
                  <div className="text-sm font-bold">{r}</div>
                  <div className="text-xs text-slide-dim mt-2 flex items-center justify-between">
                    <span>Exportar</span>
                    <span className="text-slide-accent font-bold">CSV / TXT ↓</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Contract Modal */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Adicionar Novo Contrato de Transporte</h3>
              <button onClick={() => setContractModalOpen(false)} className="text-sm font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form
              className="space-y-3 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSchool.trim()) return;
                setContracts([
                  {
                    client: newSchool.trim(),
                    buses: newBuses,
                    value: newValue,
                    status: "Ativo",
                  },
                  ...contracts,
                ]);
                setContractModalOpen(false);
                setNewSchool("");
              }}
            >
              <div>
                <label className="block mb-1 font-bold text-slide-dim">Nome da Escola / Instituição:</label>
                <input
                  required
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  placeholder="Ex: Escola Primária de Luanda Sul"
                  className="w-full rounded-xl bg-slide-surface px-3 py-2 text-slide-paper outline-none border border-slide-line/20"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slide-dim">Número de Autocarros:</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newBuses}
                  onChange={(e) => {
                    const b = Number(e.target.value);
                    setNewBuses(b);
                    setNewValue(`${(b * 300000).toLocaleString("pt-AO")} Kz`);
                  }}
                  className="w-full rounded-xl bg-slide-surface px-3 py-2 text-slide-paper outline-none border border-slide-line/20"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slide-dim">Valor Mensal (AOA):</label>
                <input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-xl bg-slide-surface px-3 py-2 text-slide-paper outline-none border border-slide-line/20 font-mono"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 font-bold cursor-pointer hover:opacity-90"
                >
                  Registar Contrato
                </button>
                <button
                  type="button"
                  onClick={() => setContractModalOpen(false)}
                  className="rounded-xl bg-slide-surface px-4 py-2.5 font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
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
  accent,
  danger,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 shadow-sm ${
        danger
          ? "bg-destructive text-destructive-foreground"
          : accent
          ? "bg-slide-accent text-slide-accent-ink"
          : "bg-slide-surface text-slide-ink"
      }`}
    >
      <div className="text-3xl font-extrabold">{value}</div>
      <div className="text-sm opacity-80 mt-1">{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slide-surface p-5 shadow-sm border border-slide-line/10">
      <div className="font-bold mb-4 text-slide-ink">{title}</div>
      {children}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slide-surface overflow-x-auto shadow-sm border border-slide-line/10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-sm text-slide-dim border-b border-slide-bg">
            {head.map((h) => (
              <th key={h} className="p-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Badge({ s }: { s: string }) {
  const ok = ["Ativo", "Na estrada", "Em serviço", "A bordo", "Resolvida", "Disponível"].includes(s);
  const warn = ["Pedido", "À espera", "Parado"].includes(s);
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold inline-block ${
        ok
          ? "bg-slide-ok text-slide-accent-ink"
          : warn
          ? "bg-slide-accent text-slide-accent-ink"
          : "bg-slide-bg text-slide-dim"
      }`}
    >
      {s}
    </span>
  );
}
