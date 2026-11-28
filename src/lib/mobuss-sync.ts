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
  driverMonthlyFee: number;
  schoolBusSingleShift: number;
  schoolBusDoubleShift: number;
  ivaPercent: number;
  companyName: string;
  companyNif: string;
  companyAddress?: string;
  multicaixaEntityCode?: string;
}

export interface MoBussSyncState {
  contracts: SyncedContract[];
  hazards: SyncedHazardReport[];
  sweepLogs: SyncedSweepLog[];
  ratings: SyncedDriverRating[];
  alerts: SyncedAlert[];
  pricing: SyncedPricingConfig;
}

const STORAGE_KEY = "mobuss_platform_sync_v3";
const SYNC_EVENT = "mobuss:sync";

export function formatAOA(amount: number): string {
  return `${Math.round(amount).toLocaleString("pt-AO")} Kz`;
}

export const DEFAULT_PRICING: SyncedPricingConfig = {
  studentMonthlyFee: 3000,
  driverMonthlyFee: 33000,
  schoolBusSingleShift: 33000,
  schoolBusDoubleShift: 33000,
  ivaPercent: 14,
  companyName: "MôBuss Angola Transporte Escolar Lda.",
  companyNif: "5417209418",
  companyAddress: "Av. Comandante Valódia, Luanda, Angola",
  multicaixaEntityCode: "00845",
};

export const INITIAL_CONTRACTS: SyncedContract[] = [
  {
    id: "cnt-1",
    client: "Escola Primária do Morro Bento",
    location: "Morro Bento, Luanda",
    buses: 4,
    students: 90,
    value: "402 000 Kz",
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
    value: "201 000 Kz",
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
    value: "324 000 Kz",
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
    value: "339 000 Kz",
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
    value: "525 000 Kz",
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
    value: "186 000 Kz",
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
};

export function readMoBussSync(): MoBussSyncState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SYNC_STATE;
    const parsed = JSON.parse(raw) as Partial<MoBussSyncState>;
    return {
      contracts: Array.isArray(parsed.contracts) && parsed.contracts.length > 0 ? parsed.contracts : INITIAL_CONTRACTS,
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
      sweepLogs: Array.isArray(parsed.sweepLogs) ? parsed.sweepLogs : DEFAULT_SYNC_STATE.sweepLogs,
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings : DEFAULT_SYNC_STATE.ratings,
      alerts: Array.isArray(parsed.alerts) && parsed.alerts.length > 0 ? parsed.alerts : INITIAL_ALERTS,
      pricing: parsed.pricing ? { ...DEFAULT_PRICING, ...parsed.pricing } : DEFAULT_PRICING,
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
