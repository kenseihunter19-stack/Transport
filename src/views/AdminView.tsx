import { useEffect, useState, type ReactNode } from "react";
import { LuandaMap } from "@/components/LuandaMap";
import { downloadCsv, downloadDocument } from "@/lib/operations";
import { LUANDA_ROUTES, type LuandaRouteConfig } from "@/lib/route-luanda";

export type AdminTab =
  | "Painel"
  | "Contratos"
  | "Frota"
  | "Motoristas"
  | "Alunos"
  | "Finanças"
  | "DNVT"
  | "Emergências"
  | "Relatórios";

const ADMIN_TABS: [AdminTab, string, string][] = [
  ["Painel", "📊", "Visão Geral das Operações"],
  ["Contratos", "📄", "Acordos Escolares & Parcerias"],
  ["Frota", "🚌", "Autocarros & Telemetria"],
  ["Motoristas", "🧑‍✈️", "Equipa & Folha Salarial"],
  ["Alunos", "🎒", "Diretório de Alunos & PIN"],
  ["Finanças", "💳", "Multicaixa Express & AGT"],
  ["DNVT", "🛡️", "Inspeções & Licenças Oficiais"],
  ["Emergências", "🚨", "Ocorrências SOS & Suporte"],
  ["Relatórios", "📈", "Auditoria & Exportação"],
];

interface BusInfo {
  id: number;
  plate: string;
  driver: string;
  routeId: string;
  routeName: string;
  status: "Na estrada" | "Parado" | "Manutenção" | "Reserva";
  students: number;
  capacity: number;
  fuel: string;
  inspection: string;
  insurance: string;
}

const BUSES_INITIAL: BusInfo[] = [
  {
    id: 12,
    plate: "LD-24-61-AB",
    driver: "João Mateus",
    routeId: "route_a",
    routeName: "Rota A · Mutamba → Morro Bento",
    status: "Na estrada",
    students: 18,
    capacity: 22,
    fuel: "78%",
    inspection: "Válida (DNVT Mar 2027)",
    insurance: "ENSA Angola (Válido)",
  },
  {
    id: 7,
    plate: "LD-31-02-CK",
    driver: "Paulo Cassoma",
    routeId: "route_b",
    routeName: "Rota B · Talatona Express",
    status: "Na estrada",
    students: 22,
    capacity: 25,
    fuel: "64%",
    inspection: "Válida (DNVT Jul 2027)",
    insurance: "Fidelidade Angola (Válido)",
  },
  {
    id: 9,
    plate: "LD-05-49-HM",
    driver: "Adão Bento",
    routeId: "route_c",
    routeName: "Rota C · Viana Sul",
    status: "Na estrada",
    students: 20,
    capacity: 25,
    fuel: "42%",
    inspection: "A renovar (DNVT 18 dias)",
    insurance: "ENSA Angola (Válido)",
  },
  {
    id: 4,
    plate: "LD-22-88-PL",
    driver: "Teresa Lunda",
    routeId: "route_d",
    routeName: "Rota D · Baixa & Miramar",
    status: "Na estrada",
    students: 16,
    capacity: 20,
    fuel: "82%",
    inspection: "Válida (DNVT Ago 2027)",
    insurance: "Nossa Seguros (Válido)",
  },
  {
    id: 3,
    plate: "LD-18-77-FE",
    driver: "Rosa Tchissola",
    routeId: "route_a",
    routeName: "Reserva Central · Morro Bento",
    status: "Reserva",
    students: 0,
    capacity: 22,
    fuel: "95%",
    inspection: "Válida (DNVT Jan 2027)",
    insurance: "ENSA Angola (Válido)",
  },
  {
    id: 15,
    plate: "LD-40-13-QZ",
    driver: "—",
    routeId: "route_c",
    routeName: "Oficina Central · Viana",
    status: "Manutenção",
    students: 0,
    capacity: 22,
    fuel: "15%",
    inspection: "Revisão Mecânica Preventiva",
    insurance: "ENSA Angola (Válido)",
  },
];

interface DriverInfo {
  name: string;
  phone: string;
  category: string;
  rating: string;
  bus: string;
  status: "Em serviço" | "Disponível" | "De folga";
  trips: number;
  salary: string;
  checkInTime: string;
}

const DRIVERS_INITIAL: DriverInfo[] = [
  {
    name: "João Mateus",
    phone: "+244 923 112 233",
    category: "Pesados Profissional D",
    rating: "4,9",
    bus: "Autocarro 12",
    status: "Em serviço",
    trips: 44,
    salary: "220 000 Kz",
    checkInTime: "06:45",
  },
  {
    name: "Paulo Cassoma",
    phone: "+244 912 334 455",
    category: "Pesados Profissional D",
    rating: "4,8",
    bus: "Autocarro 7",
    status: "Em serviço",
    trips: 42,
    salary: "210 000 Kz",
    checkInTime: "06:50",
  },
  {
    name: "Teresa Lunda",
    phone: "+244 945 667 788",
    category: "Pesados Profissional D",
    rating: "4,9",
    bus: "Autocarro 4",
    status: "Em serviço",
    trips: 45,
    salary: "225 000 Kz",
    checkInTime: "06:40",
  },
  {
    name: "Adão Bento",
    phone: "+244 934 889 900",
    category: "Pesados Profissional D",
    rating: "4,7",
    bus: "Autocarro 9",
    status: "Em serviço",
    trips: 40,
    salary: "200 000 Kz",
    checkInTime: "06:55",
  },
  {
    name: "Rosa Tchissola",
    phone: "+244 928 445 566",
    category: "Pesados Profissional D",
    rating: "4,8",
    bus: "Autocarro 3 (Reserva)",
    status: "Disponível",
    trips: 38,
    salary: "190 000 Kz",
    checkInTime: "07:00",
  },
  {
    name: "Manuel Kiala",
    phone: "+244 918 223 344",
    category: "Pesados Profissional D",
    rating: "4,6",
    bus: "—",
    status: "De folga",
    trips: 20,
    salary: "100 000 Kz",
    checkInTime: "—",
  },
];

interface StudentInfo {
  name: string;
  school: string;
  corridor: string;
  stop: string;
  guardian: string;
  phone: string;
  pin: string;
  status: "A bordo" | "Entregue" | "À espera" | "Ausente";
}

const STUDENTS_INITIAL: StudentInfo[] = [
  {
    name: "Maria Domingos",
    school: "Escola Primária do Morro Bento",
    corridor: "Rota A",
    stop: "Largo do Kinaxixi",
    guardian: "Sra. Luísa Domingos",
    phone: "+244 923 456 789",
    pin: "4821",
    status: "A bordo",
  },
  {
    name: "Edson Manuel",
    school: "Escola Primária do Morro Bento",
    corridor: "Rota A",
    stop: "Largo do Kinaxixi",
    guardian: "Sr. Manuel Neto",
    phone: "+244 912 345 678",
    pin: "3170",
    status: "A bordo",
  },
  {
    name: "Ana Kiala",
    school: "Escola Primária do Morro Bento",
    corridor: "Rota A",
    stop: "Maianga (Cruzamento)",
    guardian: "Sra. Joana Kiala",
    phone: "+244 934 567 890",
    pin: "5541",
    status: "À espera",
  },
  {
    name: "Bruno Neto",
    school: "Escola Primária do Morro Bento",
    corridor: "Rota A",
    stop: "Alvalade (Av. Revolução)",
    guardian: "Sr. Carlos Neto",
    phone: "+244 945 678 901",
    pin: "9024",
    status: "À espera",
  },
  {
    name: "Sofia Pedro",
    school: "Colégio São Francisco de Assis",
    corridor: "Rota B",
    stop: "Belas Shopping",
    guardian: "Sra. Isabel Pedro",
    phone: "+244 923 888 777",
    pin: "1983",
    status: "A bordo",
  },
  {
    name: "Hélder Cunha",
    school: "Complexo Escolar do Kilamba",
    corridor: "Rota C",
    stop: "Viana Vila",
    guardian: "Sr. Rui Cunha",
    phone: "+244 919 444 333",
    pin: "7721",
    status: "Ausente",
  },
  {
    name: "Beatriz Cassoma",
    school: "Colégio São Paulo",
    corridor: "Rota D",
    stop: "Miramar (Rotunda)",
    guardian: "Sra. Teresa Cassoma",
    phone: "+244 924 555 666",
    pin: "6412",
    status: "Entregue",
  },
];

interface McxPayment {
  id: string;
  invoice: string;
  student: string;
  guardian: string;
  phone: string;
  amount: string;
  date: string;
  time: string;
  status: "Validado" | "Pendente";
  emisRef: string;
  agtCert: string;
}

const MCX_PAYMENTS_INITIAL: McxPayment[] = [
  {
    id: "pay-1",
    invoice: "FT-TRANSIGO-2026/8192",
    student: "Maria Domingos",
    guardian: "Sra. Luísa Domingos",
    phone: "+244 923 456 789",
    amount: "45 000 Kz",
    date: "27 Out 2026",
    time: "07:15",
    status: "Validado",
    emisRef: "MCX-901824-EMIS",
    agtCert: "AGT-CERT/2026/8192-VALID",
  },
  {
    id: "pay-2",
    invoice: "FT-TRANSIGO-2026/8193",
    student: "Edson Manuel",
    guardian: "Sr. Manuel Neto",
    phone: "+244 912 345 678",
    amount: "45 000 Kz",
    date: "27 Out 2026",
    time: "07:22",
    status: "Validado",
    emisRef: "MCX-482019-EMIS",
    agtCert: "AGT-CERT/2026/8193-VALID",
  },
  {
    id: "pay-3",
    invoice: "FT-TRANSIGO-2026/8194",
    student: "Sofia Pedro",
    guardian: "Sra. Isabel Pedro",
    phone: "+244 923 888 777",
    amount: "45 000 Kz",
    date: "26 Out 2026",
    time: "18:40",
    status: "Validado",
    emisRef: "MCX-194029-EMIS",
    agtCert: "AGT-CERT/2026/8194-VALID",
  },
  {
    id: "pay-4",
    invoice: "FT-TRANSIGO-2026/8195",
    student: "Bruno Neto",
    guardian: "Sr. Carlos Neto",
    phone: "+244 945 678 901",
    amount: "45 000 Kz",
    date: "26 Out 2026",
    time: "20:05",
    status: "Pendente",
    emisRef: "MCX-582910-EMIS",
    agtCert: "AGT-CERT/2026/8195-AWAIT",
  },
];

interface AlertItem {
  id: string;
  time: string;
  bus: number;
  route: string;
  type: string;
  from: string;
  notes?: string;
  open: boolean;
}

const ALERTS_INITIAL: AlertItem[] = [
  {
    id: "al-1",
    time: "07:52",
    bus: 7,
    route: "Rota B · Talatona Express",
    type: "🔧 Avaria mecânica ligeira (furo de pneu)",
    from: "Paulo Cassoma (Motorista)",
    notes: "Equipa de apoio técnico despachada com pneu suplente.",
    open: true,
  },
  {
    id: "al-2",
    time: "07:35",
    bus: 9,
    route: "Rota C · Viana Sul",
    type: "🚦 Trânsito muito congestionado na Estalagem (+10 min)",
    from: "Adão Bento (Motorista)",
    notes: "Notificação push automática enviada a todos os 20 encarregados.",
    open: false,
  },
  {
    id: "al-3",
    time: "Ontem 15:10",
    bus: 12,
    route: "Rota A · Morro Bento",
    type: "🚑 Aluno indisposto com febre súbita",
    from: "João Mateus (Motorista)",
    notes: "Encarregado contactado imediatamente, recebido na paragem da Maianga.",
    open: false,
  },
];

interface AdminViewProps {
  onNavigate: (view: "mockup" | "admin" | "deck" | "landing" | "native") => void;
}

export function AdminView({ onNavigate }: AdminViewProps) {
  const [tab, setTab] = useState<AdminTab>("Painel");
  const [search, setSearch] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string>("route_a");
  const [progress, setProgress] = useState(0.42);

  // Contracts state
  const [contracts, setContracts] = useState([
    {
      id: "cnt-1",
      client: "Escola Primária do Morro Bento",
      location: "Morro Bento, Luanda",
      buses: 4,
      students: 90,
      value: "1 200 000 Kz",
      status: "Ativo",
      contact: "Director Pedagógico Alberto",
      phone: "+244 923 111 222",
    },
    {
      id: "cnt-2",
      client: "Colégio São Paulo (Maianga)",
      location: "Maianga, Luanda",
      buses: 2,
      students: 45,
      value: "650 000 Kz",
      status: "Ativo",
      contact: "Irmã Graça (Secretaria)",
      phone: "+244 912 333 444",
    },
    {
      id: "cnt-3",
      client: "Colégio São Francisco de Assis",
      location: "Talatona, Luanda",
      buses: 3,
      students: 75,
      value: "1 050 000 Kz",
      status: "Pedido",
      contact: "Dr. Manuel Ferreira",
      phone: "+244 934 555 666",
    },
    {
      id: "cnt-4",
      client: "Complexo Escolar do Kilamba",
      location: "Cidade do Kilamba",
      buses: 3,
      students: 80,
      value: "900 000 Kz",
      status: "Pedido",
      contact: "Prof. António Luvualu",
      phone: "+244 945 777 888",
    },
    {
      id: "cnt-5",
      client: "Escola Internacional de Talatona",
      location: "Talatona Sul",
      buses: 5,
      students: 120,
      value: "1 600 000 Kz",
      status: "Ativo",
      contact: "Dra. Nicole Santos",
      phone: "+244 928 999 000",
    },
    {
      id: "cnt-6",
      client: "Liceu Francês de Luanda",
      location: "Miramar, Luanda",
      buses: 2,
      students: 40,
      value: "700 000 Kz",
      status: "Recusado",
      contact: "Secretariat de Gestion",
      phone: "+244 918 000 111",
    },
  ]);

  const [buses, setBuses] = useState(BUSES_INITIAL);
  const [drivers] = useState(DRIVERS_INITIAL);
  const [students, setStudents] = useState(STUDENTS_INITIAL);
  const [payments, setPayments] = useState(MCX_PAYMENTS_INITIAL);
  const [alerts, setAlerts] = useState(ALERTS_INITIAL);

  // New Contract Modal state
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [newSchool, setNewSchool] = useState("");
  const [newLocation, setNewLocation] = useState("Talatona, Luanda");
  const [newBuses, setNewBuses] = useState(2);
  const [newContact, setNewContact] = useState("");
  const [newPhone, setNewPhone] = useState("+244 923 000 000");
  const [newValue, setNewValue] = useState("650 000 Kz");

  // Dispatch Backup Bus Modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<AlertItem | null>(null);

  // Success Toast
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setProgress((p) => (p + 0.002 > 1 ? 0 : p + 0.002)), 350);
    return () => clearInterval(id);
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  }

  const openAlerts = alerts.filter((a) => a.open).length;

  function setContractStatus(index: number, status: string) {
    setContracts((all) =>
      all.map((c, i) => (i === index ? { ...c, status } : c))
    );
    showToast(`Estado do contrato com ${contracts[index]?.client} alterado para: ${status}`);
  }

  function handleDispatchBackupBus(alertId: string) {
    setBuses((prev) =>
      prev.map((b) => (b.id === 3 ? { ...b, status: "Na estrada", students: 15 } : b))
    );
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              open: false,
              notes: `${a.notes || ""} | Autocarro Suplente 3 despachado às ${new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}.`,
            }
          : a
      )
    );
    setDispatchModalOpen(false);
    showToast("🚌 Autocarro Suplente 3 despachado com sucesso!");
  }

  function handleDownloadReport(name: string) {
    if (name === "Relatório mensal de viagens") {
      downloadCsv("transigo-viagens-mensal.csv", [
        ["Data", "Autocarro", "Matrícula", "Motorista", "Corredor", "Alunos", "Estado", "Pontualidade"],
        ["2026-10-27", "12", "LD-24-61-AB", "João Mateus", "Rota A · Morro Bento", 18, "Concluída", "98%"],
        ["2026-10-27", "7", "LD-31-02-CK", "Paulo Cassoma", "Rota B · Talatona Express", 22, "Concluída", "94%"],
        ["2026-10-27", "9", "LD-05-49-HM", "Adão Bento", "Rota C · Viana Sul", 20, "Concluída", "91%"],
        ["2026-10-27", "4", "LD-22-88-PL", "Teresa Lunda", "Rota D · Baixa & Miramar", 16, "Concluída", "99%"],
        ["2026-10-27", "3", "LD-18-77-FE", "Rosa Tchissola", "Reserva Central", 0, "Disponível", "100%"],
      ]);
    } else if (name === "Livro de Faturas Multicaixa Express (AGT)") {
      downloadCsv("transigo-faturas-mcx-agt.csv", [
        ["Nº Factura", "Aluno", "Encarregado", "Telemóvel MCX", "Valor (Kz)", "Data", "Referência EMIS", "Certificação AGT", "Estado"],
        ...payments.map((p) => [
          p.invoice,
          p.student,
          p.guardian,
          p.phone,
          p.amount,
          p.date,
          p.emisRef,
          p.agtCert,
          p.status,
        ]),
      ]);
    } else if (name === "Pauta Diária de Presenças e Desembarque") {
      downloadCsv("transigo-pauta-presencas-oficial.csv", [
        ["Aluno", "Instituição Escolar", "Corredor", "Paragem Oficial", "Encarregado", "PIN Validação", "Estado Hoje"],
        ...students.map((s) => [s.name, s.school, s.corridor, s.stop, s.guardian, s.pin, s.status]),
      ]);
    } else if (name === "Relatório de folha de salários (Motoristas)") {
      downloadCsv("transigo-folha-salarios.csv", [
        ["Motorista", "Categoria", "Avaliação Pais", "Autocarro", "Viagens Mês", "Salário Bruto", "Segurança Social (3%)", "Líquido"],
        ["João Mateus", "Cat. D", "4.9", "Autocarro 12", 44, "220 000 Kz", "6 600 Kz", "213 400 Kz"],
        ["Paulo Cassoma", "Cat. D", "4.8", "Autocarro 7", 42, "210 000 Kz", "6 300 Kz", "203 700 Kz"],
        ["Teresa Lunda", "Cat. D", "4.9", "Autocarro 4", 45, "225 000 Kz", "6 750 Kz", "218 250 Kz"],
        ["Adão Bento", "Cat. D", "4.7", "Autocarro 9", 40, "200 000 Kz", "6 000 Kz", "194 000 Kz"],
        ["Rosa Tchissola", "Cat. D", "4.8", "Autocarro 3", 38, "190 000 Kz", "5 700 Kz", "184 300 Kz"],
        ["Manuel Kiala", "Cat. D", "4.6", "Reserva", 20, "100 000 Kz", "3 000 Kz", "97 000 Kz"],
      ]);
    } else {
      downloadDocument(
        "Relatório de Emergências e Ocorrências SOS TransiGo",
        `TRANSIGO LUANDA — AUDITORIA DE SEGURANÇA E OCORRÊNCIAS\n` +
          `Data de Emissão: ${new Date().toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" })}\n\n` +
          alerts
            .map(
              (a) =>
                `• [${a.time}] Autocarro ${a.bus} (${a.route})\n  Tipo: ${a.type}\n  Origem: ${a.from}\n  Estado: ${a.open ? "ABERTO (EM CURSO)" : "RESOLVIDO"}\n  Notas: ${a.notes || "Sem notas adicionais"}\n`
            )
            .join("\n")
      );
    }
    showToast(`Ficheiro "${name}" exportado com sucesso!`);
  }

  // Filtered queries
  const filteredBuses = buses.filter(
    (b) =>
      b.driver.toLowerCase().includes(search.toLowerCase()) ||
      b.plate.toLowerCase().includes(search.toLowerCase()) ||
      b.routeName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.school.toLowerCase().includes(search.toLowerCase()) ||
      s.stop.toLowerCase().includes(search.toLowerCase()) ||
      s.guardian.toLowerCase().includes(search.toLowerCase())
  );

  const filteredContracts = contracts.filter(
    (c) =>
      c.client.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPayments = payments.filter(
    (p) =>
      p.student.toLowerCase().includes(search.toLowerCase()) ||
      p.guardian.toLowerCase().includes(search.toLowerCase()) ||
      p.invoice.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink flex select-none" style={{ fontFamily: "var(--font-body)" }}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 rounded-2xl bg-slide-paper-ink text-slide-paper px-4 py-3 shadow-2xl border border-slide-surface flex items-center gap-3 animate-in slide-in-from-top-4">
          <span className="text-lg">🔔</span>
          <div className="text-xs font-semibold">{toast}</div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slide-paper-ink text-slide-paper flex flex-col justify-between p-5 shrink-0 border-r border-slide-surface shadow-xl">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slide-surface/80">
            <div className="w-10 h-10 rounded-2xl bg-slide-accent text-slide-accent-ink grid place-items-center font-black text-xl shadow">
              T
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight leading-none" style={{ fontFamily: "var(--font-display)" }}>
                TransiGo
              </div>
              <div className="text-[11px] text-slide-dim font-medium mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slide-ok inline-block" />
                <span>Central de Luanda</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="space-y-1">
            {ADMIN_TABS.map(([t, icon, desc]) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 font-bold text-xs transition cursor-pointer text-left ${
                    active
                      ? "bg-slide-accent text-slide-accent-ink shadow-sm"
                      : "text-slide-dim hover:text-slide-paper hover:bg-slide-surface/60"
                  }`}
                  title={desc}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className="text-base">{icon}</span>
                    <span className="truncate">{t}</span>
                  </span>

                  {t === "Emergências" && openAlerts > 0 && (
                    <span className="rounded-full bg-destructive text-white px-2 py-0.5 text-[10px] font-black animate-pulse shadow-xs">
                      {openAlerts}
                    </span>
                  )}
                  {t === "Contratos" && contracts.filter((c) => c.status === "Pedido").length > 0 && (
                    <span className="rounded-full bg-slide-accent text-slide-accent-ink px-1.5 py-0.5 text-[9px] font-black">
                      {contracts.filter((c) => c.status === "Pedido").length} novos
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* External View Switchers & PWA Info */}
        <div className="space-y-2 pt-4 border-t border-slide-surface/80 text-xs">
          <div className="text-[10px] uppercase font-bold text-slide-dim tracking-wider mb-1">Atalhos do Sistema:</div>
          <button
            onClick={() => onNavigate("mockup")}
            className="w-full flex items-center gap-2 text-slide-accent font-bold hover:underline transition cursor-pointer text-left py-1"
          >
            <span>📱</span>
            <span>Simulador iPhone (App)</span>
          </button>
          <button
            onClick={() => onNavigate("landing")}
            className="w-full flex items-center gap-2 text-slide-paper hover:text-slide-accent transition cursor-pointer text-left py-1"
          >
            <span>📄</span>
            <span>Portal Escolas (Landing Page)</span>
          </button>
          <button
            onClick={() => onNavigate("deck")}
            className="w-full flex items-center gap-2 text-slide-dim hover:text-slide-paper transition cursor-pointer text-left py-1"
          >
            <span>📊</span>
            <span>Slides de Apresentação</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 overflow-y-auto">
        {/* Top Header */}
        <header className="flex flex-wrap justify-between items-center gap-4 mb-6 pb-4 border-b border-slide-surface/40">
          <div>
            <div className="text-xs font-semibold text-slide-dim flex items-center gap-1.5">
              <span>🇦🇴 Angola</span>
              <span>·</span>
              <span>Província de Luanda</span>
              <span>·</span>
              <span className="text-slide-ok font-bold">Sistema 100% Operacional</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slide-paper mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {tab}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar autocarros, alunos, faturas, motoristas..."
              className="rounded-xl bg-slide-surface px-4 py-2 text-xs text-slide-paper placeholder:text-slide-dim outline-none w-64 sm:w-80 border border-slide-line/20 focus:ring-2 ring-slide-accent"
            />
            <div className="flex items-center gap-2 bg-slide-surface px-3 py-1.5 rounded-xl border border-slide-line/20">
              <div className="w-7 h-7 rounded-lg bg-slide-accent text-slide-accent-ink grid place-items-center font-black text-xs">
                OP
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-[11px] font-bold text-slide-paper leading-none">Central DNVT</div>
                <div className="text-[9px] text-slide-dim">Operador Chefe</div>
              </div>
            </div>
          </div>
        </header>

        {/* ================= TAB 1: PAINEL GERAL (OVERVIEW) ================= */}
        {tab === "Painel" && (
          <div className="space-y-6">
            {/* Top Operational KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat
                label="Contratos Escolares Ativos"
                value={contracts.filter((c) => c.status === "Ativo").length}
                sub="+2 propostas em validação"
              />
              <Stat
                label="Autocarros em Rota"
                value={`${buses.filter((b) => b.status === "Na estrada").length}/${buses.length}`}
                sub="4 corredores cobertos"
                accent
              />
              <Stat
                label="Alunos Transportados Hoje"
                value="412"
                sub="97% com PIN validado"
              />
              <Stat
                label="Ocorrências SOS Abertas"
                value={openAlerts}
                sub={openAlerts > 0 ? "Requer intervenção" : "Nenhum incidente"}
                danger={openAlerts > 0}
              />
            </div>

            {/* Live Map & Real-Time Luanda Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
              <Card
                title="Frota Escolar em Tempo Real · Luanda"
                action={
                  <div className="flex items-center gap-1.5">
                    {Object.values(LUANDA_ROUTES).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRouteId(r.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          selectedRouteId === r.id
                            ? "bg-slide-accent text-slide-accent-ink"
                            : "bg-slide-bg text-slide-dim hover:text-slide-paper"
                        }`}
                      >
                        {r.code}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slide-dim pb-1">
                    <span>
                      Corredor: <strong className="text-slide-paper">{LUANDA_ROUTES[selectedRouteId]?.name}</strong>
                    </span>
                    <span className="font-mono text-slide-accent font-bold">
                      {LUANDA_ROUTES[selectedRouteId]?.driver} · {LUANDA_ROUTES[selectedRouteId]?.busPlate}
                    </span>
                  </div>
                  <LuandaMap progress={progress} routeId={selectedRouteId} className="h-[360px] rounded-2xl shadow-inner" />
                </div>
              </Card>

              <Card title="Feed Operacional em Tempo Real">
                <div className="space-y-2.5 max-h-[390px] overflow-y-auto pr-1">
                  {[
                    { t: "07:52", text: "🚨 Autocarro 7 reportou avaria mecânica na Rota B.", type: "alert" },
                    { t: "07:48", text: "🛡️ Maria Domingos desembarcou com PIN 4821 validado.", type: "ok" },
                    { t: "07:42", text: "💳 Multicaixa Express validado: 45 000 Kz (AGT Cert).", type: "mcx" },
                    { t: "07:38", text: "🔔 Alerta de proximidade 500m enviado a 12 pais no Kinaxixi.", type: "info" },
                    { t: "07:30", text: "🚌 Autocarro 12 iniciou a Rota A (Mutamba → Morro Bento).", type: "info" },
                    { t: "07:15", text: "📋 Pauta de presenças diária gerada para Colégio São Paulo.", type: "info" },
                    { t: "06:45", text: "🧑‍✈️ Check-in de 5 motoristas registado no posto central.", type: "ok" },
                  ].map((x, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slide-bg/90 p-3 text-xs border border-slide-line/10 flex items-start gap-2.5"
                    >
                      <span className="font-mono font-bold text-[10px] text-slide-dim shrink-0 mt-0.5">{x.t}</span>
                      <span className="leading-relaxed text-slide-paper">{x.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Quick Financial & Punctuality Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card title="Pontualidade dos Autocarros">
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl font-black text-slide-ok">94.8%</div>
                  <div className="text-xs text-slide-dim">média semanal</div>
                </div>
                <p className="text-xs text-slide-dim mt-2">
                  Rotas adaptadas dinamicamente para contornar estrangulamentos na Maianga e Via Expressa.
                </p>
                <div className="mt-3 h-2 rounded-full bg-slide-bg overflow-hidden">
                  <div className="h-full bg-slide-ok rounded-full" style={{ width: "94.8%" }} />
                </div>
              </Card>

              <Card title="Volume Mensal Multicaixa Express">
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl font-black text-slide-accent">3 450 000 Kz</div>
                  <div className="text-xs text-slide-dim">faturado</div>
                </div>
                <p className="text-xs text-slide-dim mt-2">
                  100% dos pagamentos de mensalidades integrados com faturas certificadas pela AGT.
                </p>
                <button
                  onClick={() => setTab("Finanças")}
                  className="mt-3 text-xs text-slide-accent font-bold underline cursor-pointer"
                >
                  Ver Faturas e Transações MCX →
                </button>
              </Card>

              <Card title="Conformidade & Vistoria DNVT">
                <div className="flex items-baseline gap-2">
                  <div className="text-4xl font-black text-slide-paper">6/6</div>
                  <div className="text-xs text-slide-ok font-bold">Autocarros Licenciados</div>
                </div>
                <p className="text-xs text-slide-dim mt-2">
                  Inspeções técnicas em dia junto da Direção Nacional de Viação e Trânsito de Angola.
                </p>
                <button
                  onClick={() => setTab("DNVT")}
                  className="mt-3 text-xs text-slide-accent font-bold underline cursor-pointer"
                >
                  Ver Documentos dos Veículos →
                </button>
              </Card>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CONTRATOS ESCOLARES ================= */}
        {tab === "Contratos" && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <span className="text-xs text-slide-dim">
                  Gestão formal de acordos de transporte escolar com colégios privados e instituições em Luanda
                </span>
              </div>
              <button
                onClick={() => setContractModalOpen(true)}
                className="rounded-xl bg-slide-accent text-slide-accent-ink px-4 py-2 font-black text-xs cursor-pointer shadow hover:opacity-90 transition flex items-center gap-2"
              >
                <span>➕</span>
                <span>Registar Novo Contrato Escolar</span>
              </button>
            </div>

            <Table head={["Instituição de Ensino", "Localização", "Autocarros", "Alunos", "Valor Mensal", "Contacto / Secretaria", "Estado", "Ações"]}>
              {filteredContracts.map((c, i) => (
                <tr key={c.id} className="border-t border-slide-bg hover:bg-slide-surface/50 transition text-xs">
                  <td className="p-4 font-bold text-slide-paper">{c.client}</td>
                  <td className="p-4 text-slide-dim">{c.location}</td>
                  <td className="p-4 font-semibold">{c.buses} autocarros</td>
                  <td className="p-4 font-semibold">{c.students} alunos</td>
                  <td className="p-4 font-mono font-bold text-slide-accent">{c.value}</td>
                  <td className="p-4">
                    <div className="font-medium text-slide-paper">{c.contact}</div>
                    <div className="text-[10px] text-slide-dim font-mono">{c.phone}</div>
                  </td>
                  <td className="p-4">
                    <Badge s={c.status} />
                  </td>
                  <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                    {c.status === "Pedido" && (
                      <>
                        <button
                          onClick={() => setContractStatus(i, "Ativo")}
                          className="rounded-lg bg-slide-ok text-slide-accent-ink px-2.5 py-1 text-xs font-bold cursor-pointer hover:opacity-90"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => setContractStatus(i, "Recusado")}
                          className="rounded-lg bg-slide-bg px-2.5 py-1 text-xs font-bold cursor-pointer hover:opacity-80"
                        >
                          Recusar
                        </button>
                      </>
                    )}
                    {c.status === "Ativo" && (
                      <button
                        onClick={() =>
                          handleDownloadReport("Relatório mensal de viagens")
                        }
                        className="rounded-lg bg-slide-surface px-2.5 py-1 text-xs font-medium text-slide-paper hover:bg-slide-line/40 transition cursor-pointer"
                      >
                        📄 Proposta
                      </button>
                    )}
                    {c.status === "Recusado" && (
                      <button
                        onClick={() => setContractStatus(i, "Pedido")}
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

        {/* ================= TAB 3: GESTÃO DE FROTA ================= */}
        {tab === "Frota" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slide-dim">
              <span>Frota oficial TransiGo autorizada pela Direção Nacional de Viação e Trânsito (DNVT)</span>
              <span>Total: {buses.length} autocarros</span>
            </div>

            <Table head={["Nº Frota", "Matrícula Luanda", "Motorista Alocado", "Corredor / Rota", "Lotação", "Combustível", "Inspeção DNVT", "Seguro", "Estado"]}>
              {filteredBuses.map((b) => (
                <tr key={b.id} className="border-t border-slide-bg hover:bg-slide-surface/50 transition text-xs">
                  <td className="p-4 font-black text-slide-paper">🚌 Autocarro {b.id}</td>
                  <td className="p-4 font-mono font-bold text-slide-paper">{b.plate}</td>
                  <td className="p-4 font-semibold">{b.driver}</td>
                  <td className="p-4 text-slide-dim">{b.routeName}</td>
                  <td className="p-4 font-mono">
                    {b.students}/{b.capacity} lugares
                  </td>
                  <td className="p-4 font-mono text-xs">{b.fuel}</td>
                  <td className="p-4 text-[11px] font-semibold text-slide-dim">{b.inspection}</td>
                  <td className="p-4 text-[11px] font-semibold text-slide-dim">{b.insurance}</td>
                  <td className="p-4">
                    <Badge s={b.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}

        {/* ================= TAB 4: MOTORISTAS ================= */}
        {tab === "Motoristas" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slide-dim">
              <span>Equipa de motoristas profissionais certificados com carta de pesados (Categoria D)</span>
              <button
                onClick={() => handleDownloadReport("Relatório de folha de salários (Motoristas)")}
                className="bg-slide-surface text-slide-paper px-3 py-1.5 rounded-xl font-bold cursor-pointer hover:bg-slide-surface/80 transition"
              >
                📥 Exportar Folha de Salários CSV
              </button>
            </div>

            <Table head={["Motorista", "Contacto", "Habilitação", "Avaliação Pais", "Autocarro", "Viagens Mês", "Salário Bruto", "Check-In", "Estado"]}>
              {drivers.map((d) => (
                <tr key={d.name} className="border-t border-slide-bg hover:bg-slide-surface/50 transition text-xs">
                  <td className="p-4 font-bold text-slide-paper">{d.name}</td>
                  <td className="p-4 font-mono text-[11px] text-slide-dim">{d.phone}</td>
                  <td className="p-4 text-[11px] font-semibold text-slide-dim">{d.category}</td>
                  <td className="p-4 text-slide-accent font-black">★ {d.rating}</td>
                  <td className="p-4 font-medium">{d.bus}</td>
                  <td className="p-4 font-mono">{d.trips}</td>
                  <td className="p-4 font-mono font-bold text-slide-paper">{d.salary}</td>
                  <td className="p-4 font-mono text-[11px] text-slide-ok font-bold">{d.checkInTime}</td>
                  <td className="p-4">
                    <Badge s={d.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}

        {/* ================= TAB 5: ALUNOS & PRESCENÇAS ================= */}
        {tab === "Alunos" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slide-dim">
              <span>Diretório de estudantes com validação por PIN de 4 dígitos na entrega</span>
              <button
                onClick={() => handleDownloadReport("Pauta Diária de Presenças e Desembarque")}
                className="bg-slide-surface text-slide-paper px-3 py-1.5 rounded-xl font-bold cursor-pointer hover:bg-slide-surface/80 transition"
              >
                📋 Exportar Pauta Diária CSV
              </button>
            </div>

            <Table head={["Aluno(a)", "Instituição Escolar", "Corredor", "Paragem de Embarque", "Encarregado(a)", "Contacto", "PIN de Segurança", "Estado Hoje"]}>
              {filteredStudents.map((s, idx) => (
                <tr key={idx} className="border-t border-slide-bg hover:bg-slide-surface/50 transition text-xs">
                  <td className="p-4 font-bold text-slide-paper">{s.name}</td>
                  <td className="p-4 text-slide-dim">{s.school}</td>
                  <td className="p-4 font-semibold text-slide-accent">{s.corridor}</td>
                  <td className="p-4 text-slide-dim">{s.stop}</td>
                  <td className="p-4 font-medium text-slide-paper">{s.guardian}</td>
                  <td className="p-4 font-mono text-[11px] text-slide-dim">{s.phone}</td>
                  <td className="p-4">
                    <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-slide-bg border border-slide-line/20 text-slide-paper">
                      {s.pin}
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge s={s.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}

        {/* ================= TAB 6: FINANÇAS & MULTICAIXA EXPRESS ================= */}
        {tab === "Finanças" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="Total Faturado no Mês" value="3 450 000 Kz" sub="Mensalidades escolares" accent />
              <Stat label="Pagamentos via Multicaixa Express" value="98.2%" sub="Liquidação instantânea EMIS" />
              <Stat label="Faturas Emitidas com AGT" value={`${payments.length} emitidas`} sub="Certificação fiscal regular" />
            </div>

            <div className="flex justify-between items-center text-xs text-slide-dim">
              <span>Livro de Faturação e Transações Multicaixa Express (MCX) certificadas</span>
              <button
                onClick={() => handleDownloadReport("Livro de Faturas Multicaixa Express (AGT)")}
                className="bg-slide-surface text-slide-paper px-3 py-1.5 rounded-xl font-bold cursor-pointer hover:bg-slide-surface/80 transition"
              >
                📥 Exportar Faturas AGT (CSV)
              </button>
            </div>

            <Table head={["Nº Factura", "Educando", "Encarregado", "Telemóvel MCX", "Valor", "Data & Hora", "Referência EMIS", "Certificação AGT", "Estado"]}>
              {filteredPayments.map((p) => (
                <tr key={p.id} className="border-t border-slide-bg hover:bg-slide-surface/50 transition text-xs">
                  <td className="p-4 font-mono font-bold text-slide-paper">{p.invoice}</td>
                  <td className="p-4 font-semibold">{p.student}</td>
                  <td className="p-4 text-slide-dim">{p.guardian}</td>
                  <td className="p-4 font-mono text-[11px]">{p.phone}</td>
                  <td className="p-4 font-mono font-bold text-slide-accent">{p.amount}</td>
                  <td className="p-4 text-slide-dim">
                    {p.date} · {p.time}
                  </td>
                  <td className="p-4 font-mono text-[11px] text-slide-dim">{p.emisRef}</td>
                  <td className="p-4 font-mono text-[10px] text-slide-ok font-semibold">{p.agtCert}</td>
                  <td className="p-4">
                    <Badge s={p.status} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}

        {/* ================= TAB 7: CONFORMIDADE LEGAL & DNVT ================= */}
        {tab === "DNVT" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="Inspeções DNVT Ativas" value="5/6 Válidas" sub="1 autocarro em renovação" />
              <Stat label="Seguros Obrigatórios ENSA / Fidelidade" value="6/6 Ativos" sub="Cobertura total de passageiros" accent />
              <Stat label="Licenças de Transporte GPL" value="100% Regular" sub="Governo Provincial de Luanda" />
            </div>

            <div className="rounded-2xl bg-slide-surface p-5 border border-slide-line/10 space-y-4">
              <h3 className="font-bold text-sm text-slide-paper">Documentação Obrigatória por Viatura (Regulamento de Luanda)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {[
                  {
                    doc: "Alvará de Transporte Coletivo Escolar",
                    issuer: "Governo Provincial de Luanda (GPL)",
                    validity: "Outubro 2027",
                    status: "Válido",
                  },
                  {
                    doc: "Ficha de Inspeção Periódica Obrigatória",
                    issuer: "Direção Nacional de Viação e Trânsito (DNVT)",
                    validity: "Março 2027",
                    status: "Válido",
                  },
                  {
                    doc: "Apólice de Seguro de Responsabilidade Civil de Ocupantes",
                    issuer: "ENSA Seguros de Angola / Fidelidade",
                    validity: "Dezembro 2026",
                    status: "Válido",
                  },
                  {
                    doc: "Certificado de Primeiros Socorros e Extintores",
                    issuer: "Serviço de Proteção Civil e Bombeiros de Luanda",
                    validity: "15 dias restantes",
                    status: "A renovar",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slide-bg border border-slide-surface flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slide-paper text-sm">{item.doc}</div>
                      <div className="text-[11px] text-slide-dim mt-0.5">Emissor: {item.issuer}</div>
                      <div className="text-[11px] text-slide-dim font-mono mt-1">Validade: {item.validity}</div>
                    </div>
                    <Badge s={item.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 8: EMERGÊNCIAS & SOS ================= */}
        {tab === "Emergências" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slide-dim">
              <span>Gestão central de chamadas de emergência, avarias mecânicas e incidentes de trânsito em Luanda</span>
              <span className="font-bold text-destructive">
                {openAlerts > 0 ? `🚨 ${openAlerts} ocorrência(s) em aberto` : "✅ Sem ocorrências pendentes"}
              </span>
            </div>

            <div className="space-y-3">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4 transition shadow-sm ${
                    a.open ? "bg-destructive/15 border-2 border-destructive" : "bg-slide-surface border border-slide-line/10"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-extrabold text-base text-slide-paper flex items-center gap-2">
                      <span>{a.type}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slide-bg text-slide-dim font-mono">
                        Autocarro {a.bus}
                      </span>
                    </div>
                    <div className="text-xs text-slide-dim">
                      {a.time} · {a.route} · Reportado por <strong>{a.from}</strong>
                    </div>
                    {a.notes && (
                      <div className="text-xs text-slide-paper/80 bg-slide-bg/60 p-2 rounded-lg mt-2 font-mono">
                        {a.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {a.open ? (
                      <>
                        <button
                          onClick={() => {
                            setSelectedIncident(a);
                            setDispatchModalOpen(true);
                          }}
                          className="rounded-xl bg-slide-accent text-slide-accent-ink px-4 py-2 font-bold text-xs cursor-pointer shadow hover:opacity-90"
                        >
                          🚌 Despachar Suplente
                        </button>

                        <button
                          onClick={() => {
                            setAlerts((all) =>
                              all.map((x) => (x.id === a.id ? { ...x, open: false } : x))
                            );
                            showToast("Ocorrência marcada como resolvida.");
                          }}
                          className="rounded-xl bg-slide-ok text-slide-accent-ink px-4 py-2 font-bold text-xs cursor-pointer hover:opacity-90"
                        >
                          Marcar Resolvida ✓
                        </button>
                      </>
                    ) : (
                      <Badge s="Resolvida" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency Hotline Assistance */}
            <div className="p-4 rounded-2xl bg-slide-surface border border-slide-line/10 mt-6">
              <div className="text-xs font-bold text-slide-dim uppercase tracking-wider mb-2">
                Linhas Diretas Oficiais de Intervenção Rápida (Luanda):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slide-bg flex justify-between items-center">
                  <div>
                    <div className="font-black text-sm text-slide-paper">113</div>
                    <div className="text-[11px] text-slide-dim">Polícia Nacional de Angola</div>
                  </div>
                  <a href="tel:113" className="px-3 py-1 bg-slide-accent text-slide-accent-ink font-bold rounded-lg text-xs">
                    Ligar
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-slide-bg flex justify-between items-center">
                  <div>
                    <div className="font-black text-sm text-slide-paper">115</div>
                    <div className="text-[11px] text-slide-dim">Serviço de Bombeiros</div>
                  </div>
                  <a href="tel:115" className="px-3 py-1 bg-slide-accent text-slide-accent-ink font-bold rounded-lg text-xs">
                    Ligar
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-slide-bg flex justify-between items-center">
                  <div>
                    <div className="font-black text-sm text-slide-paper">112</div>
                    <div className="text-[11px] text-slide-dim">INEM / Emergência Médica</div>
                  </div>
                  <a href="tel:112" className="px-3 py-1 bg-slide-accent text-slide-accent-ink font-bold rounded-lg text-xs">
                    Ligar
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 9: RELATÓRIOS & EXPORTAÇÃO ================= */}
        {tab === "Relatórios" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Stat label="Receita Mensal Contratada" value="5 400 000 Kz" sub="Total de 6 instituições" accent />
              <Stat label="Km Percorridos no Mês" value="12 450 km" sub="Média de 412 alunos/dia" />
              <Stat label="Folha de Pagamentos Mensal" value="1 145 000 Kz" sub="6 motoristas profissionais" />
            </div>

            <div className="text-xs text-slide-dim">
              Clique em qualquer relatório abaixo para descarregar o ficheiro em formato CSV ou TXT compatível com AGT e Excel:
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "Relatório mensal de viagens",
                  desc: "Histórico completo de viagens, quilómetros e pontualidade por autocarro em Luanda.",
                  format: "CSV",
                },
                {
                  title: "Livro de Faturas Multicaixa Express (AGT)",
                  desc: "Registo contabilístico de mensalidades com referência EMIS e validação tributária AGT.",
                  format: "CSV",
                },
                {
                  title: "Pauta Diária de Presenças e Desembarque",
                  desc: "Lista nominal de alunos, horários de recolha e validação de PIN de segurança.",
                  format: "CSV",
                },
                {
                  title: "Relatório de folha de salários (Motoristas)",
                  desc: "Processamento salarial, bónus de pontualidade e retenção na fonte da segurança social.",
                  format: "CSV",
                },
                {
                  title: "Relatório de Emergências e Ocorrências SOS TransiGo",
                  desc: "Auditoria de segurança, avarias, tempos de resposta e resolução técnica.",
                  format: "TXT",
                },
              ].map((r) => (
                <button
                  key={r.title}
                  onClick={() => handleDownloadReport(r.title)}
                  className="rounded-2xl bg-slide-surface p-5 text-left font-semibold hover:ring-2 ring-slide-accent transition cursor-pointer border border-slide-line/10 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-2xl mb-2">📑</div>
                    <div className="text-sm font-black text-slide-paper">{r.title}</div>
                    <div className="text-xs text-slide-dim mt-2 leading-relaxed">{r.desc}</div>
                  </div>
                  <div className="text-xs mt-4 pt-3 border-t border-slide-line/20 flex items-center justify-between text-slide-accent font-bold">
                    <span>Descarregar Relatório</span>
                    <span className="font-mono bg-slide-bg px-2 py-0.5 rounded text-[10px]">{r.format} ↓</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: NOVO CONTRATO ESCOLAR ================= */}
      {contractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slide-accent tracking-wider">
                  NOVA PARCERIA ESCOLAR
                </span>
                <h3 className="text-lg font-black text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
                  Registar Contrato de Transporte
                </h3>
              </div>
              <button
                onClick={() => setContractModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              className="space-y-3.5 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSchool.trim()) return;
                setContracts([
                  {
                    id: `cnt-${Date.now()}`,
                    client: newSchool.trim(),
                    location: newLocation.trim(),
                    buses: newBuses,
                    students: newBuses * 25,
                    value: newValue,
                    status: "Ativo",
                    contact: newContact.trim() || "Secretaria Escolar",
                    phone: newPhone.trim(),
                  },
                  ...contracts,
                ]);
                setContractModalOpen(false);
                setNewSchool("");
                showToast(`Novo contrato para "${newSchool}" registado com sucesso!`);
              }}
            >
              <div>
                <label className="block mb-1 font-bold text-slide-dim">Nome da Escola / Instituição Parceira:</label>
                <input
                  required
                  value={newSchool}
                  onChange={(e) => setNewSchool(e.target.value)}
                  placeholder="Ex: Colégio Sagrada Esperança (Kilamba)"
                  className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slide-dim">Município / Bairro (Luanda):</label>
                  <input
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Ex: Talatona / Maianga"
                    className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20"
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
                      setNewValue(`${(b * 350000).toLocaleString("pt-AO")} Kz`);
                    }}
                    className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-bold text-slide-dim">Pessoa de Contacto:</label>
                  <input
                    value={newContact}
                    onChange={(e) => setNewContact(e.target.value)}
                    placeholder="Ex: Diretor Manuel"
                    className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-bold text-slide-dim">Telefone:</label>
                  <input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+244 9xx xxx xxx"
                    className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slide-dim">Valor Mensal Previsto (AOA):</label>
                <input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full rounded-xl bg-slide-surface px-3 py-2.5 text-slide-paper outline-none border border-slide-line/20 font-mono font-black text-slide-accent"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-3 font-black cursor-pointer hover:opacity-90 shadow transition text-xs"
                >
                  Concluir e Registar Contrato
                </button>
                <button
                  type="button"
                  onClick={() => setContractModalOpen(false)}
                  className="rounded-xl bg-slide-surface px-4 py-3 font-bold cursor-pointer hover:bg-slide-surface/80 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DESPACHAR AUTOCARRO SUPLENTE ================= */}
      {dispatchModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black flex items-center gap-2">
                <span>🚌</span>
                <span>Despachar Viatura de Substituição</span>
              </h3>
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slide-dim mb-4 leading-relaxed">
              Ocorreu um incidente no <strong>Autocarro {selectedIncident.bus}</strong> ({selectedIncident.type}). O
              Autocarro Reserva 3 está pronto na Central do Morro Bento com a motorista Rosa Tchissola.
            </p>

            <div className="p-3 rounded-2xl bg-slide-bg border border-slide-surface mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slide-dim">Viatura Suplente:</span>
                <strong className="text-slide-paper">Autocarro 3 (LD-18-77-FE)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Motorista Designada:</span>
                <strong className="text-slide-paper">Rosa Tchissola (★ 4.8)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Combustível:</span>
                <strong className="text-slide-ok">95% (Pronto)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Tempo estimado de chegada:</span>
                <strong className="text-slide-accent font-mono">12 minutos</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleDispatchBackupBus(selectedIncident.id)}
                className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 font-black text-xs cursor-pointer shadow hover:opacity-90"
              >
                Confirmar e Despachar
              </button>
              <button
                onClick={() => setDispatchModalOpen(false)}
                className="rounded-xl bg-slide-surface px-4 py-2.5 text-xs font-bold cursor-pointer"
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
      className={`rounded-2xl p-5 shadow-sm border transition ${
        danger
          ? "bg-destructive text-destructive-foreground border-destructive/30"
          : accent
          ? "bg-slide-accent text-slide-accent-ink border-slide-accent/40"
          : "bg-slide-surface text-slide-paper border-slide-line/10"
      }`}
    >
      <div className="text-3xl font-black tracking-tight">{value}</div>
      <div className="text-xs font-bold opacity-80 mt-1 uppercase tracking-wider">{label}</div>
      {sub && <div className="text-[11px] opacity-70 mt-1 font-medium">{sub}</div>}
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slide-surface p-5 shadow-sm border border-slide-line/10">
      <div className="flex justify-between items-center mb-4">
        <div className="font-extrabold text-sm text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
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
    <div className="rounded-2xl bg-slide-surface overflow-x-auto shadow-sm border border-slide-line/10">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-xs text-slide-dim border-b border-slide-bg uppercase tracking-wider">
            {head.map((h) => (
              <th key={h} className="p-4 font-extrabold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slide-line/10">{children}</tbody>
      </table>
    </div>
  );
}

function Badge({ s }: { s: string }) {
  const ok = ["Ativo", "Na estrada", "Em serviço", "A bordo", "Resolvida", "Disponível", "Validado", "Válido"].includes(s);
  const warn = ["Pedido", "À espera", "Parado", "A renovar", "Pendente"].includes(s);
  const info = ["Reserva", "Entregue"].includes(s);

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black inline-block whitespace-nowrap ${
        ok
          ? "bg-slide-ok text-slide-accent-ink"
          : warn
          ? "bg-slide-accent text-slide-accent-ink"
          : info
          ? "bg-blue-600 text-white"
          : "bg-slide-bg text-slide-dim"
      }`}
    >
      {s}
    </span>
  );
}
