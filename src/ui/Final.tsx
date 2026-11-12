import { LogOut, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { COLORES } from "../juego/paleta";
import type { Accion, Estado } from "../juego/reglas";
import type { Ficha } from "./util";

interface Props {
  estado: Estado;
  yo: string;
  fichas: Map<string, Ficha>;
  enviar: (a: Accion) => void;
  alSalir: () => void;
}

export function Final({ estado: e, yo, fichas, enviar, alSalir }: Props) {
  const ranking = useMemo(() => [...e.jugadores].sort((a, b) => b.puntos - a.puntos), [e.jugadores]);
  // Los empates comparten puesto.
  const puesto = (i: number) => ranking.findIndex((j) => j.puntos === ranking[i].puntos) + 1;
  const podio = [1, 0, 2].map((i) => ranking[i]).filter(Boolean);
  const confeti = useMemo(
    () =>
      e.usados.concat(e.usados).map((c, i) => ({
        color: COLORES[c],
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 9) * 0.25}s`,
        dur: `${2.8 + (i % 5) * 0.4}s`,
      })),
    [e.usados],
  );

  return (
    <div className="final">
      <div className="confeti" aria-hidden>
        {confeti.map((c, i) => (
          <span key={i} style={{ background: c.color, left: c.left, animationDelay: c.delay, animationDuration: c.dur }} />
        ))}
      </div>

      <h1>¡Fin de la partida!</h1>

      <div className="podio">
        {podio.map((j) => {
          const i = ranking.indexOf(j);
          const f = fichas.get(j.id)!;
          return (
            <div key={j.id} className={`escalon p${puesto(i)}`}>
              <span className="disco grande" style={{ ["--ficha" as string]: f.color }}>
                {f.iniciales}
              </span>
              <span className="nombre">{j.nombre}</span>
              <span className="pts">{j.puntos}</span>
              <span className="bloque">{puesto(i)}</span>
            </div>
          );
        })}
      </div>

      <ol className="marcador tarjeta">
        {ranking.slice(3).map((j, k) => {
          const f = fichas.get(j.id)!;
          return (
            <li key={j.id} className={j.id === yo ? "yo" : ""}>
              <span className="posicion">{puesto(k + 3)}</span>
              <span className="disco" style={{ ["--ficha" as string]: f.color }}>
                {f.iniciales}
              </span>
              <span className="nombre">{j.nombre}</span>
              <strong>{j.puntos}</strong>
            </li>
          );
        })}
      </ol>

      <div className="barra-accion">
        {e.anfitrion === yo ? (
          <button className="boton principal grande" onClick={() => enviar({ t: "otra", id: yo })}>
            <RotateCcw size={20} /> Otra partida
          </button>
        ) : (
          <p className="texto-suave centrado">El anfitrión puede empezar otra con los mismos jugadores.</p>
        )}
        <button className="boton fantasma" onClick={alSalir}>
          <LogOut size={18} /> Salir
        </button>
      </div>
    </div>
  );
}
