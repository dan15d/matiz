import { Check, X } from "lucide-react";
import { COLORES, COLUMNAS, FILAS, celdaEn, columnaDe, filaDe, nombreCasilla } from "../juego/paleta";
import type { Marca } from "../juego/reglas";
import type { Ficha } from "./util";

interface Props {
  celda: number;
  /** Casilla tocada en el tablero: la lupa se queda quieta alrededor de ella mientras se afina. */
  centro: number;
  marcas: Marca[];
  fichas: Map<string, Ficha>;
  yo: string;
  ronda: 1 | 2;
  alCambiar: (celda: number) => void;
  alConfirmar: () => void;
  alCerrar: () => void;
}

const LADO = 5;

/** Las casillas del tablero son pequeñas para el dedo: la lupa enseña las de alrededor en grande para afinar. */
export function Lupa({ celda, centro, marcas, fichas, yo, ronda, alCambiar, alConfirmar, alCerrar }: Props) {
  const c0 = Math.min(Math.max(0, columnaDe(centro) - 2), COLUMNAS - LADO);
  const f0 = Math.min(Math.max(0, filaDe(centro) - 2), FILAS - LADO);
  const ocupante = new Map(marcas.map((m) => [m.celda, m]));
  const ocupada = ocupante.get(celda);
  const ocupadaPorOtro = ocupada && !(ocupada.jugador === yo && ocupada.ronda === ronda);

  return (
    <div className="lupa hoja" role="dialog" aria-label="Elegir casilla">
      <div className="lupa-cabecera">
        <span className="muestra-mini" style={{ background: COLORES[celda] }} />
        <strong>{nombreCasilla(celda)}</strong>
        <button className="icono" onClick={alCerrar} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>
      <div className="lupa-rejilla">
        {Array.from({ length: LADO * LADO }, (_, i) => {
          const c = celdaEn(c0 + (i % LADO), f0 + Math.floor(i / LADO));
          const m = ocupante.get(c);
          const f = m && fichas.get(m.jugador);
          return (
            <button
              key={c}
              className={`lupa-casilla${c === celda ? " elegida" : ""}${m ? " ocupada" : ""}`}
              style={{ background: COLORES[c] }}
              onClick={() => alCambiar(c)}
              aria-label={nombreCasilla(c)}
            >
              {f && (
                <span className="disco" style={{ ["--ficha" as string]: f.color }}>
                  {f.iniciales}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button className="boton principal grande" disabled={!!ocupadaPorOtro} onClick={alConfirmar}>
        {ocupadaPorOtro ? (
          ocupada!.jugador === yo
            ? "Ahí ya tienes tu primera marca"
            : `${nombreCasilla(celda)} ya es de ${fichas.get(ocupada!.jugador)?.jugador.nombre ?? "otro"}`
        ) : (
          <>
            <Check size={20} /> Marcar {nombreCasilla(celda)}
          </>
        )}
      </button>
    </div>
  );
}
