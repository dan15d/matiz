import { ArrowRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { CASILLAS, COLORES } from "../juego/paleta";
import { modoLocal } from "../red/canal";
import { nuevoCodigo } from "../red/sesion";

interface Props {
  nombreInicial: string;
  codigoInicial: string;
  aviso: string | null;
  alEntrar: (codigo: string, anfitrion: boolean, nombre: string) => void;
}

export function Inicio({ nombreInicial, codigoInicial, aviso, alEntrar }: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [codigo, setCodigo] = useState(codigoInicial);
  const mosaico = useMemo(
    () => Array.from({ length: 48 }, (_, i) => COLORES[(i * 97 + Math.floor(Math.random() * 12)) % CASILLAS]),
    [],
  );
  const listoNombre = nombre.trim().length > 0;
  const listoCodigo = codigo.length === 4;

  return (
    <main className="inicio">
      <div className="mosaico" aria-hidden>
        {mosaico.map((c, i) => (
          <span key={i} style={{ background: c, animationDelay: `${(i % 12) * 0.08 + Math.floor(i / 12) * 0.12}s` }} />
        ))}
      </div>

      <header className="marca-juego">
        <h1>
          matiz<span className="punto">.</span>
        </h1>
        <p>Una palabra. Un color. ¿Quién se acerca más?</p>
      </header>

      {aviso && <p className="aviso-inicio">{aviso}</p>}

      <section className="tarjeta">
        <label className="campo">
          <span>Tu nombre</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={16}
            placeholder="¿Cómo te llamas?"
            autoComplete="nickname"
            enterKeyHint="done"
          />
        </label>

        <div className="unirse">
          <label className="campo">
            <span>Código de la sala</span>
            <input
              className="codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              enterKeyHint="go"
              onKeyDown={(e) => e.key === "Enter" && listoNombre && listoCodigo && alEntrar(codigo, false, nombre)}
            />
          </label>
          <button
            className="boton principal"
            disabled={!listoNombre || !listoCodigo}
            onClick={() => alEntrar(codigo, false, nombre)}
          >
            Unirme <ArrowRight size={18} />
          </button>
        </div>

        <div className="separador">
          <span>o</span>
        </div>

        <button className="boton secundario grande" disabled={!listoNombre} onClick={() => alEntrar(nuevoCodigo(), true, nombre)}>
          <Plus size={20} /> Crear partida
        </button>
        {!listoNombre && <p className="pista-campo">Pon tu nombre para jugar.</p>}
      </section>

      {modoLocal && (
        <p className="modo-local">
          Modo de prueba sin Supabase: la sala solo se comparte entre pestañas de este navegador.
        </p>
      )}
    </main>
  );
}
