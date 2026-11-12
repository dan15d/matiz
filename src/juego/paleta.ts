/**
 * Paleta propia del juego, calculada en OKLCH para que los pasos de luz se vean iguales en todos los
 * tonos. 18 × 36 = 648 colores: cada fila es un tono (la vuelta entera a la rueda de
 * color de arriba abajo) y cada columna, de claro a oscuro.
 */
export const COLUMNAS = 18;
export const FILAS = 36;
export const CASILLAS = COLUMNAS * FILAS;

const LETRAS = "ABCDEFGHJKLMNPQRST"; // sin la I ni la O para no confundirlas con el 1 y el 0

export const columnaDe = (celda: number) => celda % COLUMNAS;
export const filaDe = (celda: number) => Math.floor(celda / COLUMNAS);
export const celdaEn = (columna: number, fila: number) => fila * COLUMNAS + columna;

/** Nombre de la casilla para decirlo en voz alta: «F12». */
export const nombreCasilla = (celda: number) => `${LETRAS[columnaDe(celda)]}${filaDe(celda) + 1}`;
export const letraColumna = (columna: number) => LETRAS[columna];

/** Distancia en casillas (un paso en diagonal cuenta como uno): 0 es la casilla exacta. */
export const distancia = (a: number, b: number) =>
  Math.max(Math.abs(columnaDe(a) - columnaDe(b)), Math.abs(filaDe(a) - filaDe(b)));

function oklchARgbLineal(l: number, c: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const dentro = (rgb: number[]) => rgb.every((x) => x >= -0.0005 && x <= 1.0005);
const gamma = (x: number) => {
  const v = Math.min(1, Math.max(0, x));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};
const hex = (x: number) => Math.round(gamma(x) * 255).toString(16).padStart(2, "0");

/** Color OKLCH llevado a sRGB: si no cabe en la pantalla, se le baja la saturación hasta que cabe. */
function oklchAHex(l: number, c: number, h: number): string {
  let lo = 0;
  let hi = c;
  if (!dentro(oklchARgbLineal(l, c, h))) {
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (dentro(oklchARgbLineal(l, mid, h))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  const [r, g, b] = oklchARgbLineal(l, c, h);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function calcular(): string[] {
  const colores: string[] = [];
  for (let fila = 0; fila < FILAS; fila++) {
    const tono = (fila * 360) / FILAS + 15;
    for (let col = 0; col < COLUMNAS; col++) {
      const t = col / (COLUMNAS - 1);
      const luz = 0.96 - t * 0.7;
      const croma = 0.26 * Math.sin(Math.PI * (0.13 + 0.77 * t));
      colores.push(oklchAHex(luz, croma, tono));
    }
  }
  return colores;
}

export const COLORES: readonly string[] = calcular();

/** Si el color es claro, lo que va encima se escribe en oscuro. */
export function esClaro(celda: number): boolean {
  const h = COLORES[celda];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
