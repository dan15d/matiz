import { useEffect, useMemo, useState } from "react";
import { guardarNombre, guardarSesion, leerSesion, miId, miNombre, type Sesion } from "./red/sesion";
import { Inicio } from "./ui/Inicio";
import { Sala } from "./ui/Sala";
import { useNuevaVersion } from "./ui/useNuevaVersion";

/** Con el enlace o el QR se llega a «#/unirse/ABCD» y el código ya viene puesto. */
const codigoDelEnlace = () => /^#\/unirse\/([A-Z]{4})$/i.exec(location.hash)?.[1]?.toUpperCase() ?? "";

export function App() {
  const id = useMemo(miId, []);
  const [nombre, setNombre] = useState(miNombre);
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);
  const [aviso, setAviso] = useState<string | null>(null);
  const [codigoEnlace, setCodigoEnlace] = useState(codigoDelEnlace);
  const hayNueva = useNuevaVersion();

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

  return (
    <>
      {sesion ? (
        <Sala key={sesion.codigo} codigo={sesion.codigo} anfitrion={sesion.anfitrion} yo={{ id, nombre }} alSalir={salir} />
      ) : (
        <Inicio key={codigoEnlace} nombreInicial={nombre} codigoInicial={codigoEnlace} aviso={aviso} alEntrar={entrar} />
      )}
      {hayNueva && (
        // Recargar no saca de la partida: la sala y el color secreto están guardados en el móvil.
        <div className="version-nueva" role="status">
          <span>Hay una versión nueva de matiz</span>
          <button className="boton principal" onClick={() => location.reload()}>
            Actualizar
          </button>
        </div>
      )}
    </>
  );
}
