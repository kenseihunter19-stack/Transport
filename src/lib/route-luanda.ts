// Real road coordinates across key Luanda school corridors in Angola

export interface RouteStop {
  id: string;
  name: string;
  at: number; // 0 to 1 along the path
  etaMinutes: number;
}

export interface LuandaRouteConfig {
  id: string;
  name: string;
  code: string;
  corridor: string;
  busId: number;
  busPlate: string;
  driver: string;
  driverPhone: string;
  school: string;
  path: [number, number][];
  stops: RouteStop[];
}

// 1. Rota A: Mutamba → Kinaxixi → Maianga → Alvalade → Morro Bento
const PATH_A: [number, number][] = [
  [-8.81362, 13.23511],
  [-8.81301, 13.23506],
  [-8.81304, 13.23384],
  [-8.81582, 13.23327],
  [-8.81833, 13.24128],
  [-8.81885, 13.24275],
  [-8.82145, 13.24113],
  [-8.82493, 13.23764],
  [-8.82549, 13.23835],
  [-8.82683, 13.23902],
  [-8.82794, 13.23907],
  [-8.82886, 13.23871],
  [-8.83133, 13.23753],
  [-8.83226, 13.23948],
  [-8.83337, 13.23936],
  [-8.83326, 13.24008],
  [-8.83424, 13.24212],
  [-8.83717, 13.24069],
  [-8.83803, 13.24205],
  [-8.83992, 13.24128],
  [-8.83976, 13.2419],
  [-8.84232, 13.24267],
  [-8.84626, 13.23254],
  [-8.84485, 13.23196],
  [-8.84465, 13.23268],
  [-8.84591, 13.23321],
  [-8.846, 13.233],
];

// 2. Rota B: Kilamba → Camama → Belas Shopping → Talatona → Morro Bento
const PATH_B: [number, number][] = [
  [-8.98972, 13.23861], // Kilamba Quarteirão K
  [-8.97541, 13.22983], // Av. Imperial Santana
  [-8.95820, 13.22015], // Camama / Rotunda
  [-8.94110, 13.21200], // Via Expressa Fidel Castro
  [-8.92750, 13.19500], // Belas Shopping
  [-8.91890, 13.18740], // Centro de Convenções de Talatona
  [-8.90500, 13.19200], // SIAC Talatona
  [-8.88500, 13.20500], // Av. Pedro de Castro Van-Dúnem Loy
  [-8.86500, 13.22000], // Gamek
  [-8.84600, 13.23300], // Morro Bento
];

// 3. Rota C: Zango → Viana → Estalagem → Grafanil → Maianga
const PATH_C: [number, number][] = [
  [-8.97200, 13.34200], // Zango 3
  [-8.94500, 13.32800], // Viana Vila (Ponte)
  [-8.92100, 13.30500], // Robaldina
  [-8.89800, 13.28700], // Estalagem
  [-8.87900, 13.27100], // Grafanil Bar
  [-8.86200, 13.25400], // Palanca / Golfe
  [-8.84100, 13.24500], // Rocha Pinto
  [-8.82886, 13.23871], // Maianga
];

// 4. Rota D: Ilha de Luanda → Marginal → Miramar → Cidade Alta → Ingombota
const PATH_D: [number, number][] = [
  [-8.78500, 13.22600], // Ponto Final Ilha do Cabo
  [-8.79900, 13.23600], // Chicala
  [-8.80800, 13.23950], // Porto de Luanda
  [-8.81200, 13.23400], // Baía / Marginal de Luanda
  [-8.80700, 13.24500], // Miramar
  [-8.81500, 13.24900], // Sambizanga / Maculusso
  [-8.81900, 13.23500], // Cidade Alta / Palácio Presidencial
  [-8.81400, 13.23300], // Ingombota
];

function buildRoute(
  id: string,
  name: string,
  code: string,
  corridor: string,
  busId: number,
  busPlate: string,
  driver: string,
  driverPhone: string,
  school: string,
  path: [number, number][],
  stopNames: string[]
): LuandaRouteConfig {
  const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]));
  const sum = segs.reduce((a, b) => a + b, 0);

  const stops: RouteStop[] = stopNames.map((stName, idx) => {
    const fraction = idx === 0 ? 0.001 : idx === stopNames.length - 1 ? 1 : idx / (stopNames.length - 1);
    return {
      id: `${id}-s${idx}`,
      name: stName,
      at: fraction,
      etaMinutes: Math.round(fraction * 45),
    };
  });

  return {
    id,
    name,
    code,
    corridor,
    busId,
    busPlate,
    driver,
    driverPhone,
    school,
    path,
    stops,
  };
}

export const LUANDA_ROUTES: Record<string, LuandaRouteConfig> = {
  route_a: buildRoute(
    "route_a",
    "Rota A · Morro Bento",
    "ROTA-A",
    "Eixo Mutamba – Kinaxixi – Maianga – Morro Bento",
    12,
    "LD-24-61-AB",
    "João Mateus",
    "+244 923 456 789",
    "Escola Primária do Morro Bento",
    PATH_A,
    ["Mutamba", "Largo do Kinaxixi", "Maianga", "Alvalade", "Escola Primária do Morro Bento"]
  ),
  route_b: buildRoute(
    "route_b",
    "Rota B · Talatona Express",
    "ROTA-B",
    "Eixo Kilamba – Belas Shopping – Talatona",
    7,
    "LD-31-02-CK",
    "Paulo Cassoma",
    "+244 912 345 678",
    "Colégio São Paulo (Maianga)",
    PATH_B,
    ["Centralidade do Kilamba", "Camama Rotunda", "Belas Shopping", "SIAC Talatona", "Colégio São Paulo"]
  ),
  route_c: buildRoute(
    "route_c",
    "Rota C · Viana Sul",
    "ROTA-C",
    "Eixo Zango – Viana – Estalagem – Maianga",
    9,
    "LD-05-49-HM",
    "Adão Bento",
    "+244 934 567 890",
    "Complexo Escolar do Kilamba",
    PATH_C,
    ["Zango 3", "Vila de Viana", "Estalagem", "Grafanil Bar", "Maianga Sul"]
  ),
  route_d: buildRoute(
    "route_d",
    "Rota D · Baixa & Miramar",
    "ROTA-D",
    "Eixo Ilha de Luanda – Marginal – Miramar – Ingombota",
    4,
    "LD-22-88-PL",
    "Teresa Lunda",
    "+244 945 678 901",
    "Liceu Francês de Luanda",
    PATH_D,
    ["Ponto Final da Ilha", "Chicala", "Marginal de Luanda", "Miramar", "Ingombota Centro"]
  ),
};

// Backwards compatibility for existing imports
export const PATH = LUANDA_ROUTES.route_a.path;
export const STOPS = LUANDA_ROUTES.route_a.stops;

export function pointAtRoute(path: [number, number][], t: number): [number, number] {
  const segs = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]));
  const sum = segs.reduce((a, b) => a + b, 0);
  let d = Math.min(Math.max(t, 0), 1) * sum;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]!) {
      const a = path[i]!,
        b = path[i + 1]!,
        f = segs[i]! ? d / segs[i]! : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    d -= segs[i]!;
  }
  return path[path.length - 1]!;
}

export function pointAt(t: number): [number, number] {
  return pointAtRoute(PATH, t);
}
