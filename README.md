# matiz

Juego de pistas de color para jugar **en persona**, cada uno con su móvil (de 3 a 15 jugadores).

1. Alguien **crea la partida** y enseña el código o el QR; el resto **se une** con su nombre.
2. En cada turno, a quien le toca le sale «Es tu turno», destapa **4 colores** y elige uno en secreto.
3. Dice **una palabra** en voz alta y los demás marcan una casilla en el tablero. **Cada casilla es de uno solo**: si alguien llega antes, ya no se puede.
4. Si quiere, da una **segunda pista** (dos palabras) y cada uno pone otra marca.
5. Al **revelar**: 3 puntos en la casilla exacta, 2 en el cuadro de alrededor (3×3) y 1 en el siguiente (5×5). Quien da la pista gana 1 por cada marca en el 3×3. Los colores jugados no vuelven a salir.

El tablero es una paleta propia de 24 × 36 (864) colores, con columnas de la A a la Z, calculada en OKLCH (cada fila es un tono y cada columna va de claro a oscuro). Las casillas son cuadradas y el tablero se desplaza (las letras y los números se quedan fijos); al tocar se abre una **lupa** con las de alrededor en grande para confirmar.

## Cómo funciona por dentro

- Vite + React + TypeScript, como el Grimorio.
- **El móvil de quien crea la sala hace de mesa**: lleva las reglas (`src/juego/reglas.ts`) y reparte el estado. Los demás le mandan sus acciones por un canal de **Supabase Realtime (broadcast)**, sin tablas ni migraciones. Si se le recarga la página, recupera la partida.
- **Minimizar la app no rompe la partida**: cada acción va numerada y se reenvía hasta que el anfitrión la confirma (el estado lleva `hechas`, y lo repetido se descarta). Al volver a la app se abre una conexión nueva, y si el anfitrión deja de dar señales los demás ven «Esperando a …».
- El color secreto solo existe en el móvil de quien da la pista hasta que lo revela.
- **Sin Supabase** (sin `.env.local`), la sala funciona entre pestañas del mismo navegador, para probar. Con Supabase, para probar varias pestañas en un navegador, añade `?p=a`, `?p=b`… a la dirección: cada una hace de un móvil distinto.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # pon VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (sirve el proyecto del Grimorio)
npm run dev                  # con --host, para abrirlo desde el móvil en la misma wifi
npm test
```

## Publicar

El workflow `.github/workflows/deploy.yml` publica en GitHub Pages al subir a `main` (Pages con origen «GitHub Actions»). La URL y la clave pública de Supabase van en `.env.production`, en el repositorio: la clave anon es pública por diseño y acaba igualmente en el JS publicado.
