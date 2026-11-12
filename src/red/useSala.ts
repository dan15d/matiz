import { useCallback, useEffect, useRef, useState } from "react";
import { aplicar, marcarEnLinea, nuevaSala, type Accion, type Estado, type Rechazo } from "../juego/reglas";
import { abrirCanal, type Canal, type Mensaje } from "./canal";
import { guardarSala, leerSala } from "./sesion";

export interface Yo {
  id: string;
  nombre: string;
}

export interface Aviso {
  motivo: Rechazo | "no-existe" | "expulsado";
  n: number;
}

const LATIDO_MS = 3000;
const FUERA_MS = 10000;

/**
 * Conecta con la sala. El anfitrión lleva las reglas y reparte el estado (y lo guarda por si se le
 * recarga la página); el resto manda sus acciones y pinta lo que le llega.
 */
export function useSala(codigo: string, anfitrion: boolean, yo: Yo) {
  const [estado, setEstado] = useState<Estado | null>(() =>
    anfitrion ? (leerSala(codigo) ?? nuevaSala(codigo, yo.id, yo.nombre)) : null,
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const estadoRef = useRef(estado);
  const canalRef = useRef<Canal | null>(null);
  const vistos = useRef(new Map<string, number>());
  const estuve = useRef(false);

  const avisar = useCallback((motivo: Aviso["motivo"]) => setAviso((a) => ({ motivo, n: (a?.n ?? 0) + 1 })), []);

  const publicar = useCallback(
    (e: Estado) => {
      estadoRef.current = e;
      setEstado(e);
      guardarSala(e);
      canalRef.current?.enviar({ t: "estado", estado: e });
    },
    [],
  );

  /** Solo en el anfitrión: aplica una acción (suya o de otro) y reparte el resultado. */
  const resolver = useCallback(
    (accion: Accion) => {
      const actual = estadoRef.current;
      if (!actual) return;
      const r = aplicar(actual, accion);
      if (r.rechazo) {
        if (accion.id === yo.id) avisar(r.rechazo);
        else canalRef.current?.enviar({ t: "rechazo", para: accion.id, motivo: r.rechazo });
      }
      if (r.estado !== actual) publicar(r.estado);
    },
    [avisar, publicar, yo.id],
  );

  useEffect(() => {
    const recibir = (m: Mensaje) => {
      if (anfitrion) {
        if (m.t === "accion") {
          vistos.current.set(m.accion.id, Date.now());
          resolver(m.accion);
        } else if (m.t === "pedir" || m.t === "hola") {
          vistos.current.set(m.id, Date.now());
          if (m.t === "pedir" && estadoRef.current) canalRef.current?.enviar({ t: "estado", estado: estadoRef.current });
        }
        return;
      }
      if (m.t === "estado" && m.estado.codigo === codigo) {
        const actual = estadoRef.current;
        if (actual && m.estado.anfitrion === actual.anfitrion && m.estado.version < actual.version) return;
        const dentro = m.estado.jugadores.some((j) => j.id === yo.id);
        if (dentro) estuve.current = true;
        else if (estuve.current) {
          estuve.current = false;
          avisar("expulsado");
        }
        estadoRef.current = m.estado;
        setEstado(m.estado);
      } else if (m.t === "rechazo" && m.para === yo.id) {
        avisar(m.motivo);
      }
    };

    const conectar = () => {
      if (anfitrion) {
        const e = estadoRef.current!;
        // Al volver (página recargada), el anfitrión sigue con su nombre de ahora.
        publicar(aplicar(e, { t: "unirse", id: yo.id, nombre: yo.nombre }).estado);
      } else {
        canalRef.current?.enviar({ t: "accion", accion: { t: "unirse", id: yo.id, nombre: yo.nombre } });
        canalRef.current?.enviar({ t: "pedir", id: yo.id });
      }
    };

    const canal = abrirCanal(codigo, recibir, conectar);
    canalRef.current = canal;

    const latido = setInterval(() => {
      if (anfitrion) {
        const e = estadoRef.current;
        if (!e) return;
        const ahora = Date.now();
        const enLinea = new Set([yo.id]);
        for (const [id, t] of vistos.current) if (ahora - t < FUERA_MS) enLinea.add(id);
        const nuevo = marcarEnLinea(e, enLinea);
        if (nuevo !== e) publicar(nuevo);
      } else {
        canal.enviar(estadoRef.current ? { t: "hola", id: yo.id } : { t: "pedir", id: yo.id });
      }
    }, LATIDO_MS);

    // Si en unos segundos nadie contesta, la sala no está abierta.
    const espera = anfitrion ? undefined : setTimeout(() => !estadoRef.current && avisar("no-existe"), 6000);

    // Al volver a la app tras bloquear el móvil, se pide el estado al momento.
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      if (anfitrion) {
        if (estadoRef.current) canal.enviar({ t: "estado", estado: estadoRef.current });
      } else {
        canal.enviar({ t: "accion", accion: { t: "unirse", id: yo.id, nombre: yo.nombre } });
        canal.enviar({ t: "pedir", id: yo.id });
      }
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      clearInterval(latido);
      clearTimeout(espera);
      document.removeEventListener("visibilitychange", alVolver);
      canal.cerrar();
      canalRef.current = null;
    };
  }, [anfitrion, avisar, codigo, publicar, resolver, yo.id, yo.nombre]);

  const enviar = useCallback(
    (accion: Accion) => {
      if (anfitrion) resolver(accion);
      else canalRef.current?.enviar({ t: "accion", accion });
    },
    [anfitrion, resolver],
  );

  return { estado, enviar, aviso };
}
