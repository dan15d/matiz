import { Eye, EyeOff, LogOut, MoreVertical, SkipForward, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORES, nombreCasilla } from "../juego/paleta";
import { opcionesDeColor, quienDaPista, type Accion, type Estado } from "../juego/reglas";
import { guardarSecreto, leerSecreto, type Secreto } from "../red/sesion";
import { Lupa } from "./Lupa";
import { Tablero } from "./Tablero";
import { vibrar, type Ficha } from "./util";

interface Props {
  estado: Estado;
  yo: string;
  fichas: Map<string, Ficha>;
  enviar: (a: Accion) => void;
  alSalir: () => void;
}

/** El color secreto de quien da la pista, guardado solo en su móvil y atado a este turno. */
function useSecreto(e: Estado, esPista: boolean) {
  const [secreto, setSecreto] = useState<Secreto | null>(() => leerSecreto());
  const vale = secreto && secreto.codigo === e.codigo && secreto.turno === e.turno ? secreto : null;

  useEffect(() => {
    if (e.fase === "final" || e.fase === "sala" || (e.fase === "eligiendo" && !esPista)) {
      if (leerSecreto()) {
        guardarSecreto(null);
        setSecreto(null);
      }
      return;
    }
    if (esPista && e.fase === "eligiendo" && !vale) {
      const nuevo: Secreto = { codigo: e.codigo, turno: e.turno, opciones: opcionesDeColor(e.usados), elegido: null };
      guardarSecreto(nuevo);
      setSecreto(nuevo);
      vibrar([80, 60, 80]);
    }
  }, [e.codigo, e.fase, e.turno, e.usados, esPista, vale]);

  const elegir = (celda: number) => {
    if (!vale) return;
    const s = { ...vale, elegido: celda };
    guardarSecreto(s);
    setSecreto(s);
  };
  return { secreto: vale, elegir };
}

export function Partida({ estado: e, yo, fichas, enviar, alSalir }: Props) {
  const pista = quienDaPista(e);
  const esPista = pista === yo;
  const soyAnfitrion = e.anfitrion === yo;
  const nombrePista = (pista && fichas.get(pista)?.jugador.nombre) || "Alguien";
  const { secreto, elegir } = useSecreto(e, esPista);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [centroLupa, setCentroLupa] = useState(0);
  const [verColor, setVerColor] = useState(false);
  const [panel, setPanel] = useState<"marcador" | "menu" | null>(null);
  const yoJugador = fichas.get(yo)?.jugador;
  const ronda = e.fase === "ronda2" ? 2 : 1;
  const enRonda = e.fase === "ronda1" || e.fase === "ronda2";

  // Cada fase empieza limpia: sin lupa abierta y con el color tapado.
  useEffect(() => {
    setSeleccion(null);
    setVerColor(false);
  }, [e.fase, e.turno]);

  // Al revelar, una vibración para que todos miren.
  useEffect(() => {
    if (e.fase === "revelado") vibrar(120);
  }, [e.fase]);

  const miMarca = e.marcas.find((m) => m.jugador === yo && m.ronda === ronda);
  const hanMarcado = e.marcas.filter((m) => m.ronda === ronda).length;
  const adivinan = e.jugadores.length - 1;

  const objetivoVisible =
    e.fase === "revelado" ? e.objetivo : esPista && enRonda && verColor ? (secreto?.elegido ?? null) : null;

  const ranking = useMemo(() => [...e.jugadores].sort((a, b) => b.puntos - a.puntos), [e.jugadores]);

  const tocar =
    enRonda && !esPista
      ? (c: number) => {
          setCentroLupa(c);
          setSeleccion(c);
        }
      : undefined;

  const confirmar = () => {
    if (seleccion == null) return;
    enviar({ t: "marcar", id: yo, celda: seleccion });
    vibrar(30);
    setSeleccion(null);
  };

  return (
    <div className="partida">
      <header className="barra">
        <span className="chip codigo-chip">{e.codigo}</span>
        <span className="turno">
          Turno <strong>{Math.min(e.turno + 1, e.orden.length)}</strong> de {e.orden.length}
        </span>
        <button className="chip puntos-chip" onClick={() => setPanel("marcador")}>
          <Trophy size={15} /> {yoJugador?.puntos ?? 0}
        </button>
        <button className="icono" onClick={() => setPanel("menu")} aria-label="Menú">
          <MoreVertical size={20} />
        </button>
      </header>

      <EstadoTurno e={e} esPista={esPista} nombrePista={nombrePista} pista={pista} fichas={fichas} />

      <Tablero
        marcas={e.marcas}
        fichas={fichas}
        yo={yo}
        objetivo={objetivoVisible}
        revelado={e.fase === "revelado"}
        seleccion={seleccion}
        apagado={e.fase === "eligiendo"}
        enfocar={objetivoVisible}
        alTocar={tocar}
      />

      {/* Panel de abajo según el papel de cada uno */}
      {esPista && enRonda && (
        <div className="panel">
          {secreto?.elegido != null ? (
            <button className={`mi-color${verColor ? " visible" : ""}`} onClick={() => setVerColor((v) => !v)}>
              <span className="muestra" style={{ background: verColor ? COLORES[secreto.elegido] : undefined }}>
                {!verColor && <EyeOff size={22} />}
              </span>
              <span className="mi-color-texto">
                <strong>{verColor ? `Tu color: ${nombreCasilla(secreto.elegido)}` : "Tu color está tapado"}</strong>
                <small>{verColor ? "Toca para taparlo" : "Toca para verlo (que no mire nadie)"}</small>
              </span>
              {verColor ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          ) : (
            <p className="texto-suave">Este móvil no recuerda tu color. Pide al anfitrión que salte el turno.</p>
          )}
          <p className="progreso">
            <span className="barra-progreso">
              <span style={{ width: `${adivinan ? (hanMarcado / adivinan) * 100 : 0}%` }} />
            </span>
            {hanMarcado} de {adivinan} han marcado
          </p>
          <div className="botones">
            {e.fase === "ronda1" && (
              <button className="boton secundario" onClick={() => enviar({ t: "segunda", id: yo })}>
                Segunda pista
              </button>
            )}
            <button
              className={`boton principal${hanMarcado >= adivinan ? " late" : ""}`}
              disabled={secreto?.elegido == null}
              onClick={() => secreto?.elegido != null && enviar({ t: "revelar", id: yo, objetivo: secreto.elegido })}
            >
              Revelar color
            </button>
          </div>
        </div>
      )}

      {!esPista && enRonda && seleccion == null && (
        <div className="panel panel-compacto">
          {miMarca ? (
            <p>
              Has marcado <strong>{nombreCasilla(miMarca.celda)}</strong>
              <span className="muestra-mini" style={{ background: COLORES[miMarca.celda] }} /> · toca otra para cambiarla
            </p>
          ) : (
            <p className="llamada">Toca el tablero para marcar tu casilla</p>
          )}
        </div>
      )}

      {e.fase === "revelado" && e.objetivo != null && (
        <div className="panel revelado-panel">
          <div className="era">
            <span className="muestra grande" style={{ background: COLORES[e.objetivo] }} />
            <div>
              <small>{nombrePista} pensaba en</small>
              <strong>{nombreCasilla(e.objetivo)}</strong>
            </div>
          </div>
          <ul className="reparto">
            {[...e.reparto]
              .sort((a, b) => b.puntos - a.puntos)
              .map((r, i) => {
                const f = fichas.get(r.jugador);
                if (!f) return null;
                return (
                  <li key={r.jugador} style={{ animationDelay: `${i * 70}ms` }}>
                    <span className="disco" style={{ ["--ficha" as string]: f.color }}>
                      {f.iniciales}
                    </span>
                    <span className="nombre">
                      {f.jugador.nombre}
                      {r.jugador === pista && <em> · pista</em>}
                    </span>
                    <span className={`suma${r.puntos ? "" : " cero"}`}>+{r.puntos}</span>
                    <span className="total">{f.jugador.puntos}</span>
                  </li>
                );
              })}
          </ul>
          {esPista || soyAnfitrion ? (
            <button className="boton principal grande" onClick={() => enviar({ t: "siguiente", id: yo })}>
              {e.turno + 1 >= e.orden.length ? "Ver resultados" : "Siguiente turno"}
            </button>
          ) : (
            <p className="texto-suave centrado">Esperando a que {nombrePista} pase el turno…</p>
          )}
        </div>
      )}

      {seleccion != null && enRonda && !esPista && (
        <>
          <div className="velo" onClick={() => setSeleccion(null)} />
          <Lupa
            celda={seleccion}
            centro={centroLupa}
            marcas={e.marcas}
            fichas={fichas}
            yo={yo}
            ronda={ronda}
            alCambiar={setSeleccion}
            alConfirmar={confirmar}
            alCerrar={() => setSeleccion(null)}
          />
        </>
      )}

      {esPista && e.fase === "eligiendo" && secreto && (
        <EligeColor
          opciones={secreto.opciones}
          elegido={secreto.elegido}
          alElegir={elegir}
          alConfirmar={() => enviar({ t: "elegido", id: yo })}
        />
      )}

      {panel === "marcador" && (
        <>
          <div className="velo" onClick={() => setPanel(null)} />
          <div className="hoja" role="dialog" aria-label="Marcador">
            <div className="hoja-cabecera">
              <h2>Marcador</h2>
              <button className="icono" onClick={() => setPanel(null)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>
            <ol className="marcador">
              {ranking.map((j) => {
                const f = fichas.get(j.id)!;
                return (
                  <li key={j.id} className={j.id === yo ? "yo" : ""}>
                    <span className="disco" style={{ ["--ficha" as string]: f.color }}>
                      {f.iniciales}
                    </span>
                    <span className="nombre">
                      {j.nombre}
                      {!j.enLinea && <small className="desconectado"> sin conexión</small>}
                    </span>
                    <strong>{j.puntos}</strong>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}

      {panel === "menu" && (
        <>
          <div className="velo" onClick={() => setPanel(null)} />
          <div className="hoja" role="dialog" aria-label="Menú">
            {soyAnfitrion && (e.fase === "eligiendo" || enRonda) && (
              <button
                className="opcion"
                onClick={() => {
                  if (confirm(`¿Saltar el turno de ${nombrePista}? No se reparten puntos.`)) enviar({ t: "saltar", id: yo });
                  setPanel(null);
                }}
              >
                <SkipForward size={20} /> Saltar el turno de {nombrePista}
              </button>
            )}
            <button
              className="opcion peligro"
              onClick={() => {
                const texto = soyAnfitrion
                  ? "Si sales, la partida se para: tu móvil hace de mesa. ¿Salir?"
                  : "¿Salir de la partida? Puedes volver con el mismo código.";
                if (confirm(texto)) alSalir();
              }}
            >
              <LogOut size={20} /> Salir
            </button>
            <button className="opcion" onClick={() => setPanel(null)}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EstadoTurno({
  e,
  esPista,
  nombrePista,
  pista,
  fichas,
}: {
  e: Estado;
  esPista: boolean;
  nombrePista: string;
  pista: string | null;
  fichas: Map<string, Ficha>;
}) {
  const f = pista ? fichas.get(pista) : undefined;
  const disco = f && (
    <span className="disco" style={{ ["--ficha" as string]: f.color }}>
      {f.iniciales}
    </span>
  );
  let texto: React.ReactNode = null;
  if (e.fase === "eligiendo") texto = esPista ? "Elige tu color" : <>{nombrePista} está eligiendo un color…</>;
  else if (e.fase === "ronda1")
    texto = esPista ? (
      <>
        Di <b>una palabra</b> en voz alta
      </>
    ) : (
      <>Escucha la pista de {nombrePista} y marca</>
    );
  else if (e.fase === "ronda2")
    texto = esPista ? (
      <>
        Ahora di <b>dos palabras</b>
      </>
    ) : (
      <>Segunda pista de {nombrePista}: marca otra</>
    );
  else if (e.fase === "revelado") texto = "¡Color revelado!";

  return (
    <div className={`estado-turno fase-${e.fase}${esPista ? " mio" : ""}`} key={`${e.turno}-${e.fase}`}>
      {disco}
      <span>{texto}</span>
      {(e.fase === "ronda1" || e.fase === "ronda2") && <span className="chip ronda">Ronda {e.fase === "ronda1" ? 1 : 2}</span>}
    </div>
  );
}

function EligeColor({
  opciones,
  elegido,
  alElegir,
  alConfirmar,
}: {
  opciones: number[];
  elegido: number | null;
  alElegir: (c: number) => void;
  alConfirmar: () => void;
}) {
  const [destapado, setDestapado] = useState(false);
  return (
    <div className="elige">
      {!destapado ? (
        <div className="elige-aviso">
          <span className="es-tu-turno">Es tu turno</span>
          <h2>Te toca dar la pista</h2>
          <p>Que nadie mire tu pantalla.</p>
          <button className="boton principal grande" onClick={() => setDestapado(true)}>
            <Eye size={20} /> Ver mis colores
          </button>
        </div>
      ) : (
        <div className="elige-colores">
          <h2>Elige uno</h2>
          <p className="texto-suave">Luego tendrás que describirlo con una palabra.</p>
          <div className="cartas">
            {opciones.map((c, i) => (
              <button
                key={c}
                className={`carta${elegido === c ? " elegida" : ""}`}
                style={{ background: COLORES[c], animationDelay: `${i * 90}ms` }}
                onClick={() => alElegir(c)}
              >
                <span className="carta-nombre">{nombreCasilla(c)}</span>
              </button>
            ))}
          </div>
          <button className="boton principal grande" disabled={elegido == null} onClick={alConfirmar}>
            {elegido == null ? "Toca un color" : `Jugar con ${nombreCasilla(elegido)}`}
          </button>
        </div>
      )}
    </div>
  );
}
