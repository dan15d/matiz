import type { Estado } from "../juego/reglas";
import { modoLocal } from "./canal";

// En modo local (sin Supabase) cada pestaña hace de móvil distinto, así que cada una guarda lo suyo.
const almacen = () => (modoLocal ? sessionStorage : localStorage);

// Para probar con varias pestañas de un mismo navegador: «?p=b» hace de otro móvil.
const prefijo = (() => {
  try {
    return new URLSearchParams(location.search).get("p") ?? "";
  } catch {
    return "";
  }
})();
const k = (clave: string) => (prefijo ? clave.replace("matiz:", `matiz${prefijo}:`) : clave);

/** Todo lo que se recuerda en el móvil, envuelto para que un modo privado sin almacenamiento no rompa nada. */
function leer<T>(clave: string): T | null {
  try {
    const v = almacen().getItem(k(clave));
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown) {
  try {
    if (valor === null) almacen().removeItem(k(clave));
    else almacen().setItem(k(clave), JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: se juega igual, solo que no se recuerda */
  }
}

export function miId(): string {
  let id = leer<string>("matiz:id");
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    escribir("matiz:id", id);
  }
  return id;
}

export const miNombre = () => leer<string>("matiz:nombre") ?? "";
export const guardarNombre = (n: string) => escribir("matiz:nombre", n.trim());

export interface Sesion {
  codigo: string;
  anfitrion: boolean;
}

export const leerSesion = () => leer<Sesion>("matiz:sesion");
export const guardarSesion = (s: Sesion | null) => escribir("matiz:sesion", s);

export const leerSala = (codigo: string) => leer<Estado>(`matiz:sala:${codigo}`);
export const guardarSala = (e: Estado) => escribir(`matiz:sala:${e.codigo}`, e);

/** El color de quien da la pista: solo existe en su móvil hasta que lo revela. */
export interface Secreto {
  codigo: string;
  turno: number;
  opciones: number[];
  elegido: number | null;
}

export const leerSecreto = () => leer<Secreto>("matiz:secreto");
export const guardarSecreto = (s: Secreto | null) => escribir("matiz:secreto", s);

const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export const nuevoCodigo = () =>
  Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join("");
