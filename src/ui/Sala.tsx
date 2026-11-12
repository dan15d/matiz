import { LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSala, type Aviso, type Yo } from "../red/useSala";
import { Final } from "./Final";
import { Lobby } from "./Lobby";
import { Partida } from "./Partida";
import { fichas as calcularFichas, useWakeLock, vibrar } from "./util";

interface Props {
  codigo: string;
  anfitrion: boolean;
  yo: Yo;
  alSalir: (aviso?: string) => void;
}

const TEXTOS: Record<Aviso["motivo"], string> = {
  ocupada: "Esa casilla ya es de otro. ¡Más rápido!",
  llena: "La sala está llena: caben 15.",
  empezada: "Esa partida ya ha empezado.",
  "no-existe": "No encuentro esa sala. ¿Está abierta en el móvil de quien la creó?",
  expulsado: "Te han sacado de la sala.",
};
const GRAVES: Aviso["motivo"][] = ["llena", "empezada", "no-existe", "expulsado"];

export function Sala({ codigo, anfitrion, yo, alSalir }: Props) {
  const { estado, enviar, aviso } = useSala(codigo, anfitrion, yo);
  const [toast, setToast] = useState<string | null>(null);
  const fichas = useMemo(() => calcularFichas(estado?.jugadores ?? []), [estado?.jugadores]);
  useWakeLock();

  useEffect(() => {
    if (!aviso) return;
    // Si no se puede entrar, de vuelta al inicio con el motivo.
    if (GRAVES.includes(aviso.motivo) && !(aviso.motivo === "no-existe" && estado)) {
      alSalir(TEXTOS[aviso.motivo]);
      return;
    }
    vibrar([40, 40, 40]);
    setToast(TEXTOS[aviso.motivo]);
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const dentro = estado?.jugadores.some((j) => j.id === yo.id);

  let contenido: React.ReactNode;
  if (!estado || !dentro) {
    contenido = (
      <div className="conectando">
        <div className="cargador" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} />
          ))}
        </div>
        <p>Entrando en la sala {codigo}…</p>
        <button className="boton fantasma" onClick={() => alSalir()}>
          <LogOut size={18} /> Cancelar
        </button>
      </div>
    );
  } else if (estado.fase === "sala") {
    contenido = (
      <>
        <header className="barra barra-sala">
          <span className="logo-mini">
            matiz<span className="punto">.</span>
          </span>
          <button className="boton fantasma" onClick={() => confirm("¿Salir de la sala?") && alSalir()}>
            <LogOut size={18} /> Salir
          </button>
        </header>
        <Lobby estado={estado} yo={yo.id} fichas={fichas} enviar={enviar} />
      </>
    );
  } else if (estado.fase === "final") {
    contenido = <Final estado={estado} yo={yo.id} fichas={fichas} enviar={enviar} alSalir={() => alSalir()} />;
  } else {
    contenido = <Partida estado={estado} yo={yo.id} fichas={fichas} enviar={enviar} alSalir={() => alSalir()} />;
  }

  return (
    <>
      {contenido}
      {toast && (
        <div className="toast" role="status" key={aviso?.n}>
          {toast}
        </div>
      )}
    </>
  );
}
