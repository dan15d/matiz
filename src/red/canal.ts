import { RealtimeClient, type RealtimeChannel } from "@supabase/realtime-js";
import type { Accion, Estado, Rechazo } from "../juego/reglas";

/** Lo que viaja por la sala: acciones de los jugadores al anfitrión y el estado del anfitrión a todos. */
export type Mensaje =
  /** `n` numera las acciones de cada jugador para poder reenviarlas sin que cuenten dos veces. */
  | { t: "accion"; accion: Accion; n?: number }
  | { t: "pedir"; id: string }
  | { t: "hola"; id: string }
  /** El anfitrión dice que sigue ahí y por qué versión va. */
  | { t: "latido"; version: number }
  | { t: "estado"; estado: Estado }
  | { t: "rechazo"; para: string; motivo: Rechazo };

export interface Canal {
  enviar(m: Mensaje): void;
  /** Tira la conexión y abre otra: al volver a la app, el móvil suele haber cortado la vieja. */
  reconectar(): void;
  cerrar(): void;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sin Supabase, la sala solo se oye entre pestañas del mismo navegador: sirve para probar. */
export const modoLocal = !url || !clave;

export function abrirCanal(codigo: string, alRecibir: (m: Mensaje) => void, alConectar: () => void): Canal {
  const nombre = `matiz-${codigo}`;
  if (modoLocal) {
    const bc = new BroadcastChannel(nombre);
    bc.onmessage = (ev) => alRecibir(ev.data as Mensaje);
    queueMicrotask(alConectar);
    return { enviar: (m) => bc.postMessage(m), reconectar: () => queueMicrotask(alConectar), cerrar: () => bc.close() };
  }

  // Cada conexión lleva su propio cliente: así una nueva no hereda nada de la que se quedó colgada.
  let actual: { cliente: RealtimeClient; canal: RealtimeChannel } | null = null;

  const abrir = () => {
    const cliente = new RealtimeClient(`${url}/realtime/v1`, {
      params: { apikey: clave },
      accessToken: async () => clave!,
      heartbeatIntervalMs: 10000,
    });
    const canal = cliente.channel(nombre, { config: { broadcast: { self: false, ack: false } } });
    const esta = { cliente, canal };
    canal
      .on("broadcast", { event: "m" }, ({ payload }) => {
        if (actual === esta) alRecibir(payload as Mensaje);
      })
      .subscribe((estado) => {
        if (estado === "SUBSCRIBED" && actual === esta) alConectar();
      });
    actual = esta;
  };

  const tirar = () => {
    const vieja = actual;
    actual = null;
    void vieja?.cliente.disconnect().catch(() => undefined);
  };

  abrir();
  return {
    enviar: (m) => void actual?.canal.send({ type: "broadcast", event: "m", payload: m }).catch(() => undefined),
    reconectar: () => {
      tirar();
      abrir();
    },
    cerrar: tirar,
  };
}
