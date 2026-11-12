import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Accion, Estado, Rechazo } from "../juego/reglas";

/** Lo que viaja por la sala: acciones de los jugadores al anfitrión y el estado del anfitrión a todos. */
export type Mensaje =
  | { t: "accion"; accion: Accion }
  | { t: "pedir"; id: string }
  | { t: "hola"; id: string }
  | { t: "estado"; estado: Estado }
  | { t: "rechazo"; para: string; motivo: Rechazo };

export interface Canal {
  enviar(m: Mensaje): void;
  cerrar(): void;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sin Supabase, la sala solo se oye entre pestañas del mismo navegador: sirve para probar. */
export const modoLocal = !url || !clave;

let cliente: SupabaseClient | null = null;

export function abrirCanal(codigo: string, alRecibir: (m: Mensaje) => void, alConectar: () => void): Canal {
  const nombre = `matiz-${codigo}`;
  if (modoLocal) {
    const bc = new BroadcastChannel(nombre);
    bc.onmessage = (ev) => alRecibir(ev.data as Mensaje);
    queueMicrotask(alConectar);
    return { enviar: (m) => bc.postMessage(m), cerrar: () => bc.close() };
  }

  cliente ??= createClient(url!, clave!, { auth: { persistSession: false } });
  const canal = cliente
    .channel(nombre, { config: { broadcast: { self: false, ack: false } } })
    .on("broadcast", { event: "m" }, ({ payload }) => alRecibir(payload as Mensaje))
    .subscribe((estado) => {
      if (estado === "SUBSCRIBED") alConectar();
    });
  return {
    enviar: (m) => void canal.send({ type: "broadcast", event: "m", payload: m }),
    cerrar: () => void cliente?.removeChannel(canal),
  };
}
