import { downloadDocument } from "@/lib/operations";

export interface SyncedContract {
  id: string;
  client: string;
  location: string;
  buses: number;
  students: number;
  value: string;
  status: "Ativo" | "Pedido" | "Recusado";
  contact: string;
  phone: string;
  createdAt?: string;
}

export interface SyncedHazardReport {
  id: string;
  label: string;
  routeCode: string;
  routeName: string;
  driver: string;
  busNumber: number;
  time: string;
  active: boolean;
}

export interface SyncedSweepLog {
  id: string;
  busNumber: number;
  plate: string;
  driver: string;
  routeName: string;
  time: string;
  verified: boolean;
}

export interface SyncedDriverRating {
  id: string;
  driver: string;
  routeCode: string;
  rating: number;
  tags: string[];
  parentName: string;
  time: string;
}

export interface SyncedAlert {
  id: string;
  time: string;
  bus: number;
  route: string;
  type: string;
  from: string;
  notes?: string;
  open: boolean;
  source?: "simulator" | "system";
}

export interface SyncedPricingConfig {
  studentMonthlyFee: number;
  schoolBusSingleShift: number;
  schoolBusDoubleShift: number;
  ivaPercent: number;
  companyName: string;
  companyNif: string;
  multicaixaEntityCode?: string;
  agtCertCode: string;
}

export interface SyncedPayment {
  id: string;
  invoice: string;
  student: string;
  guardian: string;
  phone: string;
  amount: string;
  amountValue: number;
  date: string;
  time: string;
  status: "Validado" | "Pendente";
  emisRef: string;
  agtCert: string;
  hashFiscal: string;
}

export interface MoBussSyncState {
  contracts: SyncedContract[];
  hazards: SyncedHazardReport[];
  sweepLogs: SyncedSweepLog[];
  ratings: SyncedDriverRating[];
  alerts: SyncedAlert[];
  pricing: SyncedPricingConfig;
  payments: SyncedPayment[];
}

const STORAGE_KEY = "mobuss_platform_sync_v2";
const SYNC_EVENT = "mobuss:sync";

export function formatAOA(amount: number): string {
  return `${Math.round(amount).toLocaleString("pt-AO")} Kz`;
}

export const DEFAULT_PRICING: SyncedPricingConfig = {
  studentMonthlyFee: 45000,
  schoolBusSingleShift: 250000,
  schoolBusDoubleShift: 350000,
  ivaPercent: 14,
  companyName: "MôBuss Angola Transporte Escolar Lda.",
  companyNif: "5417209418",
  multicaixaEntityCode: "00845",
  agtCertCode: "AGT-CERT/2026/MOBUSS",
};

export const INITIAL_PAYMENTS: SyncedPayment[] = [
  {
    id: "pay-1",
    invoice: "FT-MOBUSS-2026/8192",
    student: "Maria Domingos",
    guardian: "Sra. Luísa Domingos",
    phone: "+244 923 456 789",
    amount: "45 000 Kz",
    amountValue: 45000,
    date: "27 Out 2026",
    time: "07:15",
    status: "Validado",
    emisRef: "MCX-901824-EMIS",
    agtCert: "AGT-CERT/2026/8192-VALID",
    hashFiscal: "e7a9-90b1-4f12-88ca",
  },
  {
    id: "pay-2",
    invoice: "FT-MOBUSS-2026/8193",
    student: "Edson Manuel",
    guardian: "Sr. Manuel Neto",
    phone: "+244 912 345 678",
    amount: "45 000 Kz",
    amountValue: 45000,
    date: "27 Out 2026",
    time: "07:22",
    status: "Validado",
    emisRef: "MCX-482019-EMIS",
    agtCert: "AGT-CERT/2026/8193-VALID",
    hashFiscal: "b3c4-11d8-7a92-31ef",
  },
  {
    id: "pay-3",
    invoice: "FT-MOBUSS-2026/8194",
    student: "Sofia Pedro",
    guardian: "Sra. Isabel Pedro",
    phone: "+244 923 888 777",
    amount: "45 000 Kz",
    amountValue: 45000,
    date: "26 Out 2026",
    time: "18:40",
    status: "Validado",
    emisRef: "MCX-194029-EMIS",
    agtCert: "AGT-CERT/2026/8194-VALID",
    hashFiscal: "91f0-52a6-6e04-19cd",
  },
  {
    id: "pay-4",
    invoice: "FT-MOBUSS-2026/8195",
    student: "Bruno Neto",
    guardian: "Sr. Carlos Neto",
    phone: "+244 945 678 901",
    amount: "45 000 Kz",
    amountValue: 45000,
    date: "26 Out 2026",
    time: "20:05",
    status: "Pendente",
    emisRef: "MCX-582910-EMIS",
    agtCert: "AGT-CERT/2026/8195-AWAIT",
    hashFiscal: "40d2-88e1-2b77-05aa",
  },
];

export const INITIAL_CONTRACTS: SyncedContract[] = [
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
];

export const INITIAL_ALERTS: SyncedAlert[] = [
  {
    id: "al-1",
    time: "07:52",
    bus: 7,
    route: "Rota B · Talatona Express",
    type: "Avaria mecânica ligeira (furo de pneu)",
    from: "Paulo Cassoma (Motorista)",
    notes: "Equipa de apoio técnico despachada com pneu suplente.",
    open: true,
    source: "system",
  },
  {
    id: "al-2",
    time: "07:35",
    bus: 9,
    route: "Rota C · Viana Sul",
    type: "Trânsito muito congestionado na Estalagem (+10 min)",
    from: "Adão Bento (Motorista)",
    notes: "Notificação push automática enviada a todos os 20 encarregados.",
    open: false,
    source: "system",
  },
  {
    id: "al-3",
    time: "Ontem 15:10",
    bus: 12,
    route: "Rota A · Morro Bento",
    type: "Aluno indisposto com febre súbita",
    from: "João Mateus (Motorista)",
    notes: "Encarregado contactado imediatamente, recebido na paragem da Maianga.",
    open: false,
    source: "system",
  },
];

const DEFAULT_SYNC_STATE: MoBussSyncState = {
  contracts: INITIAL_CONTRACTS,
  hazards: [],
  sweepLogs: [
    {
      id: "swp-seed-1",
      busNumber: 4,
      plate: "LD-22-88-PL",
      driver: "Teresa Lunda",
      routeName: "Rota D · Baixa & Miramar",
      time: "07:58",
      verified: true,
    },
  ],
  ratings: [
    {
      id: "rat-seed-1",
      driver: "João Mateus",
      routeCode: "Rota A",
      rating: 5,
      tags: ["Pontual", "PIN Ágil"],
      parentName: "Sra. Luísa Domingos",
      time: "07:49",
    },
  ],
  alerts: INITIAL_ALERTS,
  pricing: DEFAULT_PRICING,
  payments: INITIAL_PAYMENTS,
};

export function readMoBussSync(): MoBussSyncState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("mobuss_platform_sync_v1");
    if (!raw) return DEFAULT_SYNC_STATE;
    const parsed = JSON.parse(raw) as Partial<MoBussSyncState>;
    return {
      contracts: Array.isArray(parsed.contracts) && parsed.contracts.length > 0 ? parsed.contracts : INITIAL_CONTRACTS,
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
      sweepLogs: Array.isArray(parsed.sweepLogs) ? parsed.sweepLogs : DEFAULT_SYNC_STATE.sweepLogs,
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings : DEFAULT_SYNC_STATE.ratings,
      alerts: Array.isArray(parsed.alerts) && parsed.alerts.length > 0 ? parsed.alerts : INITIAL_ALERTS,
      pricing: parsed.pricing ? { ...DEFAULT_PRICING, ...parsed.pricing } : DEFAULT_PRICING,
      payments: Array.isArray(parsed.payments) && parsed.payments.length > 0 ? parsed.payments : INITIAL_PAYMENTS,
    };
  } catch {
    return DEFAULT_SYNC_STATE;
  }
}

export function writeMoBussSync(updater: (prev: MoBussSyncState) => MoBussSyncState): MoBussSyncState {
  const next = updater(readMoBussSync());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function subscribeMoBussSync(listener: (state: MoBussSyncState) => void): () => void {
  const onCustom = (e: Event) => {
    const custom = e as CustomEvent<MoBussSyncState>;
    listener(custom.detail ?? readMoBussSync());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener(readMoBussSync());
  };
  window.addEventListener(SYNC_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SYNC_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function updatePricingConfig(partial: Partial<SyncedPricingConfig>) {
  return writeMoBussSync((prev) => ({
    ...prev,
    pricing: {
      ...prev.pricing,
      ...partial,
    },
  }));
}

export function recordSyncedPayment(payment: Omit<SyncedPayment, "id" | "hashFiscal">) {
  const hashFiscal = `${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}`;
  return writeMoBussSync((prev) => ({
    ...prev,
    payments: [
      {
        ...payment,
        id: `pay-${Date.now()}`,
        hashFiscal,
      },
      ...prev.payments,
    ],
  }));
}

export function exportAgtReceipt(payment: {
  invoice: string;
  student: string;
  guardian: string;
  phone: string;
  amountValue: number;
  date: string;
  time?: string;
  emisRef: string;
  agtCert: string;
  hashFiscal?: string;
  status?: string;
  school?: string;
  routeLabel?: string;
}, pricing: SyncedPricingConfig) {
  const ivaRate = Math.max(0, pricing.ivaPercent) / 100;
  const baseValue = ivaRate > 0 ? Math.round(payment.amountValue / (1 + ivaRate)) : payment.amountValue;
  const ivaAmount = Math.max(0, payment.amountValue - baseValue);

  const isVerifiedFiscal = payment.status === "Validado" && !payment.invoice.startsWith("PRO-");

  const content = `=====================================================
COMPROVATIVO DE PAGAMENTO / DOCUMENTO PROVISÓRIO
${pricing.companyName}
NIF Emitente: ${pricing.companyNif} · Luanda, Angola
=====================================================
Documento: ${isVerifiedFiscal ? "Factura-Recibo" : "Nota Provisória"} nº ${payment.invoice}
Data de Emissão: ${payment.date}${payment.time ? ` às ${payment.time}` : ""}
Estado: ${payment.status === "Pendente" ? "AGUARDA CONFIRMAÇÃO DO PROVEDOR" : isVerifiedFiscal ? "LIQUIDADO / CONCILIADO" : "LIQUIDADO (SANDBOX — NÃO FISCAL)"}
Canal de Pagamento: Multicaixa Express (EMIS / GPO)
Referência: ${payment.emisRef}

DADOS DO ADQUIRENTE / ENCARREGADO:
Encarregado: ${payment.guardian}
Educando: ${payment.student}
Escola / Corredor: ${payment.school || "Rede Escolar Luanda"}${payment.routeLabel ? ` · ${payment.routeLabel}` : ""}
Telefone Registado: ${payment.phone}

RESUMO DE SERVIÇO (AOA):
- Serviço: Transporte Escolar Mensal (Ida e Volta)
- Valor Base: ${formatAOA(baseValue)}
- IVA (${pricing.ivaPercent}%): ${formatAOA(ivaAmount)}
-----------------------------------------------------
TOTAL: ${formatAOA(payment.amountValue)}
-----------------------------------------------------
Configuração Fiscal: ${pricing.agtCertCode}
Aviso: Documento emitido em ambiente de homologação/staging.
A emissão fiscal certificada AGT requer integração de produção aprovada.
=====================================================`;

  downloadDocument(`Comprovativo_MoBuss_${payment.invoice.replace(/[\/\s]+/g, "_")}`, content);
}

export function addSyncedContract(contract: Omit<SyncedContract, "id" | "status">) {
  const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  return writeMoBussSync((prev) => ({
    ...prev,
    contracts: [
      {
        ...contract,
        id: `cnt-${Date.now()}`,
        status: "Pedido",
        createdAt: `Hoje · ${now}`,
      },
      ...prev.contracts,
    ],
  }));
}

export function publishHazardReport(report: Omit<SyncedHazardReport, "id" | "time" | "active">) {
  const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  return writeMoBussSync((prev) => ({
    ...prev,
    hazards: [
      {
        ...report,
        id: `haz-${Date.now()}`,
        time: now,
        active: true,
      },
      ...prev.hazards.map((h) =>
        h.busNumber === report.busNumber ? { ...h, active: false } : h
      ),
    ].slice(0, 12),
  }));
}

export function clearHazardForBus(busNumber: number) {
  return writeMoBussSync((prev) => ({
    ...prev,
    hazards: prev.hazards.map((h) =>
      h.busNumber === busNumber ? { ...h, active: false } : h
    ),
  }));
}

export function recordEmptyBusSweep(log: Omit<SyncedSweepLog, "id" | "time" | "verified">) {
  const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  return writeMoBussSync((prev) => ({
    ...prev,
    sweepLogs: [
      {
        ...log,
        id: `swp-${Date.now()}`,
        time: now,
        verified: true,
      },
      ...prev.sweepLogs,
    ].slice(0, 15),
  }));
}

export function recordDriverRating(rating: Omit<SyncedDriverRating, "id" | "time">) {
  const now = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });
  return writeMoBussSync((prev) => ({
    ...prev,
    ratings: [
      {
        ...rating,
        id: `rat-${Date.now()}`,
        time: now,
      },
      ...prev.ratings,
    ].slice(0, 20),
  }));
}

export function publishSimulatorAlert(alert: Omit<SyncedAlert, "id" | "open" | "source">) {
  return writeMoBussSync((prev) => ({
    ...prev,
    alerts: [
      {
        ...alert,
        id: `al-sim-${Date.now()}`,
        open: true,
        source: "simulator",
      },
      ...prev.alerts,
    ],
  }));
}
