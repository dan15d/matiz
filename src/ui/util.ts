import { useEffect } from "react";
import type { Jugador } from "../juego/reglas";

/** Cada jugador tiene su color de ficha, repartidos por la rueda para que no se parezcan. */
export const colorJugador = (indice: number) => `hsl(${(indice * 137.5 + 200) % 360} 75% 62%)`;

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (partes[0] ?? "?").slice(0, 2).toUpperCase();
}

export interface Ficha {
  jugador: Jugador;
  color: string;
  iniciales: string;
}

export function fichas(jugadores: Jugador[]): Map<string, Ficha> {
  return new Map(jugadores.map((j, i) => [j.id, { jugador: j, color: colorJugador(i), iniciales: iniciales(j.nombre) }]));
}

export function vibrar(patron: number | number[]) {
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* no todos los móviles vibran */
  }
}

/** Mantiene la pantalla encendida durante la partida (se pide otra vez al volver a la app). */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let activo = true;
    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (!activo) void lock.release();
      } catch {
        /* sin permiso o sin batería: la pantalla se apaga como siempre */
      }
    };
    void pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      activo = false;
      document.removeEventListener("visibilitychange", pedir);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

export const enlaceUnirse = (codigo: string) => `${location.origin}${import.meta.env.BASE_URL}#/unirse/${codigo}`;
