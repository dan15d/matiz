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
/** Sin noticias de la sala en este tiempo (con la app delante), la conexión se da por perdida. */
const SILENCIO_MS = 9000;
/** Entre dos reconexiones por silencio, como poco. */
const RECONECTAR_MS = 15000;
/** Si la app ha estado escondida más que esto, al volver se abre una conexión nueva. */
const ESCONDIDA_MS = 2000;
/** Una acción sin confirmar se deja de reenviar pasado este tiempo. */
const CADUCA_MS = 2 * 60 * 1000;

interface Pendiente {
  n: number;
  accion: Accion;
}

/**
 * Conecta con la sala. El anfitrión lleva las reglas y reparte el estado (y lo guarda por si se le
 * recarga la página); el resto manda sus acciones y pinta lo que le llega.
 *
 * Minimizar la app no rompe nada: cada acción se reenvía hasta que el anfitrión la confirma, al volver
 * se abre una conexión nueva y, si el anfitrión no da señales, se avisa de que se le está esperando.
 */
export function useSala(codigo: string, anfitrion: boolean, yo: Yo) {
  const [estado, setEstado] = useState<Estado | null>(() =>
    anfitrion ? (leerSala(codigo) ?? nuevaSala(codigo, yo.id, yo.nombre)) : null,
  );
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [anfitrionFuera, setAnfitrionFuera] = useState(false);
  const estadoRef = useRef(estado);
  const canalRef = useRef<Canal | null>(null);
  const vistos = useRef(new Map<string, number>());
  const estuve = useRef(false);
  const pendientes = useRef<Pendiente[]>([]);
  // Con la hora como base, el número sigue creciendo aunque se recargue la página.
  const ultimoNumero = useRef(0);

  const avisar = useCallback((motivo: Aviso["motivo"]) => setAviso((a) => ({ motivo, n: (a?.n ?? 0) + 1 })), []);

  const publicar = useCallback((e: Estado) => {
    estadoRef.current = e;
    setEstado(e);
    guardarSala(e);
    canalRef.current?.enviar({ t: "estado", estado: e });
  }, []);

  /** Solo en el anfitrión: aplica una acción (suya o de otro) y reparte el resultado. */
  const resolver = useCallback(
    (accion: Accion, n?: number) => {
      const actual = estadoRef.current;
      if (!actual) return;
      if (n != null && n <= (actual.hechas?.[accion.id] ?? 0)) {
        // Repetida: ya estaba hecha, pero a quien la manda no le llegó la confirmación.
        canalRef.current?.enviar({ t: "estado", estado: actual });
        return;
      }
      const r = aplicar(actual, accion);
      if (r.rechazo) {
        if (accion.id === yo.id) avisar(r.rechazo);
        else canalRef.current?.enviar({ t: "rechazo", para: accion.id, motivo: r.rechazo });
      }
      if (n != null) {
        // Aunque no cambie nada (rechazada), se apunta y se reparte: es la confirmación.
        publicar({ ...r.estado, version: actual.version + 1, hechas: { ...actual.hechas, [accion.id]: n } });
      } else if (r.estado !== actual) publicar(r.estado);
    },
    [avisar, publicar, yo.id],
  );

  useEffect(() => {
    let ultimaNoticia = Date.now();
    let ultimaReconexion = Date.now();
    let escondidaDesde: number | null = null;

    const hayNoticias = () => {
      ultimaNoticia = Date.now();
      setAnfitrionFuera(false);
    };

    const reenviarPendientes = () => {
      // Un anfitrión sin `hechas` (versión vieja de la app) aplicaría cada reenvío otra vez.
      if (!estadoRef.current?.hechas) return;
      // Lo que lleva mucho sin confirmarse ya no tiene sentido (otro turno, otra partida…).
      const limite = Date.now() - CADUCA_MS;
      pendientes.current = pendientes.current.filter((p) => p.n > limite);
      for (const p of pendientes.current) canalRef.current?.enviar({ t: "accion", accion: p.accion, n: p.n });
    };

    const recibir = (m: Mensaje) => {
      if (anfitrion) {
        if (m.t === "accion") {
          vistos.current.set(m.accion.id, Date.now());
          ultimaNoticia = Date.now();
          resolver(m.accion, m.n);
        } else if (m.t === "pedir" || m.t === "hola") {
          vistos.current.set(m.id, Date.now());
          ultimaNoticia = Date.now();
          if (m.t === "pedir" && estadoRef.current) canalRef.current?.enviar({ t: "estado", estado: estadoRef.current });
        }
        return;
      }
      if (m.t === "estado" && m.estado.codigo === codigo) {
        hayNoticias();
        const actual = estadoRef.current;
        if (actual && m.estado.anfitrion === actual.anfitrion && m.estado.version < actual.version) return;
        const hecho = m.estado.hechas?.[yo.id] ?? 0;
        pendientes.current = pendientes.current.filter((p) => p.n > hecho);
        const dentro = m.estado.jugadores.some((j) => j.id === yo.id);
        if (dentro) estuve.current = true;
        else if (estuve.current) {
          estuve.current = false;
          avisar("expulsado");
        }
        estadoRef.current = m.estado;
        setEstado(m.estado);
      } else if (m.t === "latido") {
        hayNoticias();
        // Se ha perdido algún estado por el camino: se pide el último.
        if (estadoRef.current && m.version > estadoRef.current.version) canalRef.current?.enviar({ t: "pedir", id: yo.id });
      } else if (m.t === "rechazo" && m.para === yo.id) {
        hayNoticias();
        avisar(m.motivo);
      }
    };

    const conectar = () => {
      if (anfitrion) {
        const e = estadoRef.current!;
        // Al volver (página recargada), el anfitrión sigue con su nombre de ahora. Con `hechas` los
        // demás saben que este anfitrión confirma las acciones y que pueden reenviarlas.
        const r = aplicar(e, { t: "unirse", id: yo.id, nombre: yo.nombre }).estado;
        publicar(r.hechas ? r : { ...r, version: r.version + 1, hechas: {} });
      } else {
        canalRef.current?.enviar({ t: "accion", accion: { t: "unirse", id: yo.id, nombre: yo.nombre } });
        canalRef.current?.enviar({ t: "pedir", id: yo.id });
        reenviarPendientes();
      }
    };

    const canal = abrirCanal(codigo, recibir, conectar);
    canalRef.current = canal;

    const reconectar = () => {
      ultimaReconexion = Date.now();
      canal.reconectar();
    };

    const latido = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const ahora = Date.now();
      if (anfitrion) {
        const e = estadoRef.current;
        if (!e) return;
        canal.enviar({ t: "latido", version: e.version });
        const enLinea = new Set([yo.id]);
        for (const [id, t] of vistos.current) if (ahora - t < FUERA_MS) enLinea.add(id);
        const nuevo = marcarEnLinea(e, enLinea);
        if (nuevo !== e) publicar(nuevo);
        // Hay gente en la sala y no se oye a nadie: lo raro es que se haya caído la conexión propia.
        const hayOtros = e.jugadores.some((j) => j.id !== yo.id);
        if (hayOtros && ahora - ultimaNoticia > SILENCIO_MS && ahora - ultimaReconexion > RECONECTAR_MS) reconectar();
      } else {
        canal.enviar(estadoRef.current ? { t: "hola", id: yo.id } : { t: "pedir", id: yo.id });
        reenviarPendientes();
        if (estadoRef.current && ahora - ultimaNoticia > SILENCIO_MS) {
          setAnfitrionFuera(true);
          if (ahora - ultimaReconexion > RECONECTAR_MS) reconectar();
        }
      }
    }, LATIDO_MS);

    // Si en unos segundos nadie contesta, la sala no está abierta.
    const espera = anfitrion ? undefined : setTimeout(() => !estadoRef.current && avisar("no-existe"), 6000);

    // Al volver a la app tras minimizarla o bloquear el móvil.
    const alCambiarVisibilidad = () => {
      if (document.visibilityState !== "visible") {
        escondidaDesde = Date.now();
        return;
      }
      const fuera = escondidaDesde == null ? 0 : Date.now() - escondidaDesde;
      escondidaDesde = null;
      // Mientras estaba escondida no se oía nada: se empieza a contar el silencio desde ahora.
      ultimaNoticia = Date.now();
      if (anfitrion) {
        // Tampoco se oía a los demás: se les da margen antes de verlos desconectados.
        for (const id of vistos.current.keys()) vistos.current.set(id, Date.now());
      }
      if (fuera > ESCONDIDA_MS) {
        // Al suscribirse de nuevo se vuelve a pedir el estado (o a repartirlo, si es el anfitrión).
        reconectar();
      } else if (anfitrion) {
        if (estadoRef.current) canal.enviar({ t: "estado", estado: estadoRef.current });
      } else {
        canal.enviar({ t: "pedir", id: yo.id });
        reenviarPendientes();
      }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      clearInterval(latido);
      clearTimeout(espera);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      canal.cerrar();
      canalRef.current = null;
    };
  }, [anfitrion, avisar, codigo, publicar, resolver, yo.id, yo.nombre]);

  const enviar = useCallback(
    (accion: Accion) => {
      if (anfitrion) {
        resolver(accion);
        return;
      }
      const n = (ultimoNumero.current = Math.max(Date.now(), ultimoNumero.current + 1));
      pendientes.current.push({ n, accion });
      canalRef.current?.enviar({ t: "accion", accion, n });
    },
    [anfitrion, resolver],
  );

  return { estado, enviar, aviso, anfitrionFuera };
}
