import { CASILLAS, distancia } from "./paleta";

/**
 * Las reglas viven en el móvil de quien crea la sala (el anfitrión): los demás le mandan acciones y él
 * reparte el estado. El color secreto nunca pasa por aquí hasta que quien da la pista lo revela.
 */
export const MAX_JUGADORES = 15;
export const MIN_JUGADORES = 3;

export type Fase = "sala" | "eligiendo" | "ronda1" | "ronda2" | "revelado" | "final";

export interface Jugador {
  id: string;
  nombre: string;
  puntos: number;
  enLinea: boolean;
}

export interface Marca {
  jugador: string;
  celda: number;
  ronda: 1 | 2;
}

export interface Reparto {
  jugador: string;
  puntos: number;
}

export interface Estado {
  codigo: string;
  version: number;
  anfitrion: string;
  jugadores: Jugador[];
  fase: Fase;
  vueltas: number;
  /** Quién da la pista en cada turno (los jugadores en orden, tantas veces como vueltas). */
  orden: string[];
  turno: number;
  marcas: Marca[];
  /** Colores ya jugados: no vuelven a salir en la partida. */
  usados: number[];
  objetivo: number | null;
  reparto: Reparto[];
}

export type Accion =
  | { t: "unirse"; id: string; nombre: string }
  | { t: "expulsar"; id: string; quien: string }
  | { t: "vueltas"; id: string; vueltas: number }
  | { t: "empezar"; id: string }
  | { t: "elegido"; id: string }
  | { t: "marcar"; id: string; celda: number }
  | { t: "segunda"; id: string }
  | { t: "revelar"; id: string; objetivo: number }
  | { t: "siguiente"; id: string }
  | { t: "saltar"; id: string }
  | { t: "otra"; id: string };

export type Rechazo = "llena" | "empezada" | "ocupada";

export interface Resultado {
  estado: Estado;
  rechazo?: Rechazo;
}

export function nuevaSala(codigo: string, anfitrion: string, nombre: string): Estado {
  return {
    codigo,
    version: 1,
    anfitrion,
    jugadores: [{ id: anfitrion, nombre, puntos: 0, enLinea: true }],
    fase: "sala",
    vueltas: 1,
    orden: [],
    turno: 0,
    marcas: [],
    usados: [],
    objetivo: null,
    reparto: [],
  };
}

export const quienDaPista = (e: Estado): string | null =>
  e.fase === "sala" || e.fase === "final" ? null : e.orden[e.turno] ?? null;

export const casillaOcupada = (e: Estado, celda: number) => e.marcas.some((m) => m.celda === celda);

/** 3 en la casilla exacta, 2 en el cuadro de alrededor (3×3) y 1 en el siguiente (5×5). */
export function puntosMarca(celda: number, objetivo: number): number {
  return Math.max(0, 3 - distancia(celda, objetivo));
}

export function calcularReparto(marcas: Marca[], objetivo: number, pista: string, jugadores: string[]): Reparto[] {
  const puntos = new Map(jugadores.map((id) => [id, 0]));
  let cerca = 0;
  for (const m of marcas) {
    const p = puntosMarca(m.celda, objetivo);
    puntos.set(m.jugador, (puntos.get(m.jugador) ?? 0) + p);
    if (p >= 2) cerca++;
  }
  // Quien da la pista gana 1 por cada marca dentro del cuadro 3×3.
  puntos.set(pista, (puntos.get(pista) ?? 0) + cerca);
  return [...puntos].map(([jugador, p]) => ({ jugador, puntos: p }));
}

const igual = (e: Estado): Resultado => ({ estado: e });
const cambia = (e: Estado, cambios: Partial<Estado>): Resultado => ({
  estado: { ...e, ...cambios, version: e.version + 1 },
});

export function aplicar(e: Estado, a: Accion): Resultado {
  const esAnfitrion = a.id === e.anfitrion;
  const pista = quienDaPista(e);
  const existe = e.jugadores.some((j) => j.id === a.id);

  switch (a.t) {
    case "unirse": {
      const nombre = a.nombre.trim().slice(0, 16) || "Sin nombre";
      if (existe) {
        const jugadores = e.jugadores.map((j) => (j.id === a.id ? { ...j, nombre, enLinea: true } : j));
        return cambia(e, { jugadores });
      }
      if (e.fase !== "sala") return { estado: e, rechazo: "empezada" };
      if (e.jugadores.length >= MAX_JUGADORES) return { estado: e, rechazo: "llena" };
      return cambia(e, { jugadores: [...e.jugadores, { id: a.id, nombre, puntos: 0, enLinea: true }] });
    }
    case "expulsar":
      if (!esAnfitrion || e.fase !== "sala" || a.quien === e.anfitrion) return igual(e);
      return cambia(e, { jugadores: e.jugadores.filter((j) => j.id !== a.quien) });
    case "vueltas":
      if (!esAnfitrion || e.fase !== "sala") return igual(e);
      return cambia(e, { vueltas: Math.min(3, Math.max(1, Math.round(a.vueltas))) });
    case "empezar": {
      if (!esAnfitrion || e.fase !== "sala" || e.jugadores.length < MIN_JUGADORES) return igual(e);
      const ids = e.jugadores.map((j) => j.id);
      const orden = Array.from({ length: e.vueltas }, () => ids).flat();
      return cambia(e, {
        fase: "eligiendo",
        orden,
        turno: 0,
        marcas: [],
        objetivo: null,
        reparto: [],
        jugadores: e.jugadores.map((j) => ({ ...j, puntos: 0 })),
      });
    }
    case "elegido":
      if (e.fase !== "eligiendo" || a.id !== pista) return igual(e);
      return cambia(e, { fase: "ronda1" });
    case "marcar": {
      if (e.fase !== "ronda1" && e.fase !== "ronda2") return igual(e);
      if (!existe || a.id === pista || !Number.isInteger(a.celda) || a.celda < 0 || a.celda >= CASILLAS) return igual(e);
      const ronda = e.fase === "ronda1" ? 1 : 2;
      const propia = e.marcas.find((m) => m.jugador === a.id && m.ronda === ronda);
      if (propia?.celda === a.celda) return igual(e);
      if (casillaOcupada(e, a.celda)) return { estado: e, rechazo: "ocupada" };
      const marcas = e.marcas.filter((m) => !(m.jugador === a.id && m.ronda === ronda));
      return cambia(e, { marcas: [...marcas, { jugador: a.id, celda: a.celda, ronda }] });
    }
    case "segunda":
      if (e.fase !== "ronda1" || (a.id !== pista && !esAnfitrion)) return igual(e);
      return cambia(e, { fase: "ronda2" });
    case "revelar": {
      if ((e.fase !== "ronda1" && e.fase !== "ronda2") || a.id !== pista || pista === null) return igual(e);
      if (!Number.isInteger(a.objetivo) || a.objetivo < 0 || a.objetivo >= CASILLAS) return igual(e);
      const reparto = calcularReparto(e.marcas, a.objetivo, pista, e.jugadores.map((j) => j.id));
      const jugadores = e.jugadores.map((j) => ({
        ...j,
        puntos: j.puntos + (reparto.find((r) => r.jugador === j.id)?.puntos ?? 0),
      }));
      return cambia(e, { fase: "revelado", objetivo: a.objetivo, reparto, jugadores, usados: [...e.usados, a.objetivo] });
    }
    case "siguiente":
      if (e.fase !== "revelado" || (a.id !== pista && !esAnfitrion)) return igual(e);
      return cambia(e, siguienteTurno(e));
    case "saltar":
      if (!esAnfitrion || e.fase === "sala" || e.fase === "final" || e.fase === "revelado") return igual(e);
      return cambia(e, siguienteTurno(e));
    case "otra":
      if (!esAnfitrion || e.fase !== "final") return igual(e);
      return cambia(e, {
        fase: "sala",
        orden: [],
        turno: 0,
        marcas: [],
        usados: [],
        objetivo: null,
        reparto: [],
        jugadores: e.jugadores.map((j) => ({ ...j, puntos: 0 })),
      });
  }
}

function siguienteTurno(e: Estado): Partial<Estado> {
  const turno = e.turno + 1;
  const limpio = { marcas: [], objetivo: null, reparto: [] };
  if (turno >= e.orden.length) return { ...limpio, turno: e.turno, fase: "final" };
  return { ...limpio, turno, fase: "eligiendo" };
}

/** Las cuatro opciones de color para quien da la pista, sin repetir las ya jugadas y separadas entre sí. */
export function opcionesDeColor(usados: number[], azar: () => number = Math.random): number[] {
  const libres = Array.from({ length: CASILLAS }, (_, i) => i).filter((i) => !usados.includes(i));
  const elegidas: number[] = [];
  for (let intento = 0; elegidas.length < 4 && intento < 500; intento++) {
    const c = libres[Math.floor(azar() * libres.length)];
    if (c === undefined) break;
    const lejos = intento > 300 || elegidas.every((o) => distancia(o, c) >= 4);
    if (!elegidas.includes(c) && lejos) elegidas.push(c);
  }
  return elegidas;
}

export function marcarEnLinea(e: Estado, enLinea: Set<string>): Estado {
  const cambia = e.jugadores.some((j) => j.enLinea !== enLinea.has(j.id));
  if (!cambia) return e;
  return {
    ...e,
    version: e.version + 1,
    jugadores: e.jugadores.map((j) => ({ ...j, enLinea: enLinea.has(j.id) })),
  };
}
