import { useEffect, useMemo, useState } from "react";
import { guardarNombre, guardarSesion, leerSesion, miId, miNombre, type Sesion } from "./red/sesion";
import { Inicio } from "./ui/Inicio";
import { Sala } from "./ui/Sala";

/** Con el enlace o el QR se llega a «#/unirse/ABCD» y el código ya viene puesto. */
const codigoDelEnlace = () => /^#\/unirse\/([A-Z]{4})$/i.exec(location.hash)?.[1]?.toUpperCase() ?? "";

export function App() {
  const id = useMemo(miId, []);
  const [nombre, setNombre] = useState(miNombre);
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);
  const [aviso, setAviso] = useState<string | null>(null);
  const [codigoEnlace, setCodigoEnlace] = useState(codigoDelEnlace);

  useEffect(() => {
    const cambio = () => setCodigoEnlace(codigoDelEnlace());
    window.addEventListener("hashchange", cambio);
    return () => window.removeEventListener("hashchange", cambio);
  }, []);

  // Si llega un enlace a otra sala, manda el enlace.
  useEffect(() => {
    if (codigoEnlace && sesion && sesion.codigo !== codigoEnlace) {
      guardarSesion(null);
      setSesion(null);
    }
  }, [codigoEnlace]); // solo al llegar un enlace nuevo

  const entrar = (codigo: string, anfitrion: boolean, n: string) => {
    guardarNombre(n);
    setNombre(n.trim());
    const s = { codigo, anfitrion };
    guardarSesion(s);
    setSesion(s);
    setAviso(null);
    history.replaceState(null, "", location.pathname + location.search);
  };

  const salir = (motivo?: string) => {
    guardarSesion(null);
    setSesion(null);
    setAviso(motivo ?? null);
    setCodigoEnlace("");
  };

  if (sesion) {
    return <Sala key={sesion.codigo} codigo={sesion.codigo} anfitrion={sesion.anfitrion} yo={{ id, nombre }} alSalir={salir} />;
  }
  return <Inicio key={codigoEnlace} nombreInicial={nombre} codigoInicial={codigoEnlace} aviso={aviso} alEntrar={entrar} />;
}
