import { memo, useEffect, useRef } from "react";
import { COLORES, COLUMNAS, FILAS, columnaDe, filaDe, letraColumna } from "../juego/paleta";
import { puntosMarca, type Marca } from "../juego/reglas";
import type { Ficha } from "./util";

interface Props {
  marcas: Marca[];
  fichas: Map<string, Ficha>;
  yo: string;
  /** Casilla secreta o revelada que se enmarca. */
  objetivo?: number | null;
  /** Al revelar se ven los marcos de puntos y lo que ha sacado cada marca. */
  revelado?: boolean;
  seleccion?: number | null;
  apagado?: boolean;
  /** Casilla que se lleva a la vista (el color revelado, el propio al destaparlo…). */
  enfocar?: number | null;
  alTocar?: (celda: number) => void;
}

// La primera fila y la primera columna de la rejilla son las etiquetas: las casillas empiezan en la 2.
const area = (celda: number, radio = 0) => {
  const c = columnaDe(celda);
  const f = filaDe(celda);
  const c0 = Math.max(0, c - radio);
  const c1 = Math.min(COLUMNAS - 1, c + radio);
  const f0 = Math.max(0, f - radio);
  const f1 = Math.min(FILAS - 1, f + radio);
  return { gridColumn: `${c0 + 2} / ${c1 + 3}`, gridRow: `${f0 + 2} / ${f1 + 3}` };
};

const Casillas = memo(function Casillas() {
  return (
    <>
      <span className="etiqueta esquina" style={{ gridColumn: 1, gridRow: 1 }} />
      {Array.from({ length: COLUMNAS }, (_, c) => (
        <span key={`c${c}`} className="etiqueta columna" style={{ gridColumn: c + 2, gridRow: 1 }}>
          {letraColumna(c)}
        </span>
      ))}
      {Array.from({ length: FILAS }, (_, f) => (
        <span key={`f${f}`} className="etiqueta fila" style={{ gridColumn: 1, gridRow: f + 2 }}>
          {f + 1}
        </span>
      ))}
      {COLORES.map((color, i) => (
        <span
          key={i}
          className="casilla"
          data-celda={i}
          style={{ background: color, gridColumn: columnaDe(i) + 2, gridRow: filaDe(i) + 2 }}
        />
      ))}
    </>
  );
});

export function Tablero({ marcas, fichas, yo, objetivo, revelado, seleccion, apagado, enfocar, alTocar }: Props) {
  const caja = useRef<HTMLDivElement>(null);

  // El tablero no cabe entero en el móvil: se desplaza solo hasta la casilla que importa.
  useEffect(() => {
    if (enfocar == null) return;
    const el = caja.current?.querySelector<HTMLElement>(`.casilla[data-celda="${enfocar}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [enfocar]);

  const tocar = (ev: React.MouseEvent<HTMLDivElement>) => {
    const celda = (ev.target as HTMLElement).closest<HTMLElement>("[data-celda]")?.dataset.celda;
    if (celda !== undefined && alTocar) alTocar(Number(celda));
  };

  return (
    <div className={`tablero-caja${apagado ? " apagado" : ""}`} ref={caja}>
    <div
      className={`tablero${alTocar ? " tocable" : ""}`}
      style={{
        gridTemplateColumns: `var(--etiqueta-fila) repeat(${COLUMNAS}, var(--lado))`,
        gridTemplateRows: `var(--etiqueta-columna) repeat(${FILAS}, var(--lado))`,
      }}
      onClick={tocar}
    >
      <Casillas />

      {objetivo != null && revelado && (
        <>
          <span className="marco marco-5" style={area(objetivo, 2)} />
          <span className="marco marco-3" style={area(objetivo, 1)} />
        </>
      )}
      {objetivo != null && <span className={`objetivo${revelado ? " revelado" : ""}`} style={area(objetivo)} />}
      {seleccion != null && <span className="seleccion" style={area(seleccion)} />}

      {marcas.map((m) => {
        const f = fichas.get(m.jugador);
        if (!f) return null;
        const puntos = revelado && objetivo != null ? puntosMarca(m.celda, objetivo) : null;
        return (
          <span
            key={`${m.jugador}-${m.ronda}`}
            className={`marca${m.jugador === yo ? " mia" : ""}${m.ronda === 2 ? " segunda" : ""}`}
            style={{ ...area(m.celda), ["--ficha" as string]: f.color }}
            data-celda={m.celda}
          >
            <span className="disco">{f.iniciales}</span>
            {puntos != null && puntos > 0 && <span className="puntos-marca">+{puntos}</span>}
          </span>
        );
      })}
    </div>
    </div>
  );
}
