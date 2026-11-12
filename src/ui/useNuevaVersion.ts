import { useEffect, useState } from "react";

/** El script principal cambia de nombre en cada versión publicada (index-<hash>.js). */
const SCRIPT = /assets\/index-[\w-]+\.js/;

function scriptActual(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = SCRIPT.exec(s.src);
    if (m) return m[0];
  }
  return null;
}

/**
 * La app instalada puede quedarse días abierta en segundo plano con una versión vieja. Al volver a
 * ella (y cada pocos minutos) mira si hay otra publicada; si la hay, avisa para recargar.
 */
export function useNuevaVersion(): boolean {
  const [hayNueva, setHayNueva] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const actual = scriptActual();
    if (!actual) return;

    const mirar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: "no-store" });
        const publicado = SCRIPT.exec(await r.text())?.[0];
        if (publicado && publicado !== actual) setHayNueva(true);
      } catch {
        /* sin conexión: ya se mirará luego */
      }
    };

    void mirar();
    const cada = setInterval(mirar, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", mirar);
    return () => {
      clearInterval(cada);
      document.removeEventListener("visibilitychange", mirar);
    };
  }, []);

  return hayNueva;
}
