import { Crown, Share2, UserX } from "lucide-react";
import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { MAX_JUGADORES, MIN_JUGADORES, type Accion, type Estado } from "../juego/reglas";
import { enlaceUnirse, type Ficha } from "./util";

interface Props {
  estado: Estado;
  yo: string;
  fichas: Map<string, Ficha>;
  enviar: (a: Accion) => void;
}

function Qr({ texto }: { texto: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [texto]);
  return <div className="qr" role="img" aria-label="Código QR para unirse" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Lobby({ estado, yo, fichas, enviar }: Props) {
  const soyAnfitrion = estado.anfitrion === yo;
  const enlace = enlaceUnirse(estado.codigo);
  const faltan = MIN_JUGADORES - estado.jugadores.length;
  const anfitrion = fichas.get(estado.anfitrion)?.jugador.nombre ?? "el anfitrión";

  const compartir = async () => {
    const datos = { title: "matiz", text: `Únete a mi partida de matiz con el código ${estado.codigo}`, url: enlace };
    try {
      if (navigator.share) await navigator.share(datos);
      else await navigator.clipboard.writeText(enlace);
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="lobby">
      <section className="tarjeta sala-codigo">
        <div>
          <span className="rotulo">Código de la sala</span>
          <strong className="codigo-grande">{estado.codigo}</strong>
          <button className="boton fantasma" onClick={compartir}>
            <Share2 size={18} /> Invitar
          </button>
        </div>
        <Qr texto={enlace} />
      </section>

      <section className="tarjeta">
        <h2>
          Jugadores <span className="contador">{estado.jugadores.length}/{MAX_JUGADORES}</span>
        </h2>
        <ul className="lista-jugadores">
          {estado.jugadores.map((j) => {
            const f = fichas.get(j.id)!;
            return (
              <li key={j.id} className={j.enLinea ? "" : "fuera"}>
                <span className="disco grande" style={{ ["--ficha" as string]: f.color }}>
                  {f.iniciales}
                </span>
                <span className="nombre">
                  {j.nombre}
                  {j.id === yo && <em> (tú)</em>}
                </span>
                {j.id === estado.anfitrion && <Crown size={18} className="corona" aria-label="Anfitrión" />}
                {!j.enLinea && <span className="desconectado">sin conexión</span>}
                {soyAnfitrion && j.id !== yo && (
                  <button className="icono" onClick={() => enviar({ t: "expulsar", id: yo, quien: j.id })} aria-label={`Sacar a ${j.nombre}`}>
                    <UserX size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {soyAnfitrion ? (
        <section className="tarjeta">
          <h2>Vueltas</h2>
          <p className="texto-suave">Cuántas veces da la pista cada jugador.</p>
          <div className="selector">
            {[1, 2, 3].map((v) => (
              <button
                key={v}
                className={v === estado.vueltas ? "activo" : ""}
                onClick={() => enviar({ t: "vueltas", id: yo, vueltas: v })}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="texto-suave">{estado.jugadores.length * estado.vueltas} turnos en total.</p>
        </section>
      ) : (
        <p className="esperando">
          <span className="puntos-espera" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          Esperando a que {anfitrion} empiece la partida
        </p>
      )}

      {soyAnfitrion && (
        <div className="barra-accion">
          <button className="boton principal grande" disabled={faltan > 0} onClick={() => enviar({ t: "empezar", id: yo })}>
            {faltan > 0 ? `Faltan ${faltan} para empezar` : "Empezar partida"}
          </button>
        </div>
      )}
    </div>
  );
}
