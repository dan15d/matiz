import { describe, expect, it } from "vitest";
import { CASILLAS, COLORES, celdaEn, distancia, nombreCasilla } from "./paleta";
import { aplicar, calcularReparto, nuevaSala, opcionesDeColor, quienDaPista, type Accion, type Estado } from "./reglas";

const jugar = (e: Estado, ...acciones: Accion[]) =>
  acciones.reduce((s, a) => aplicar(s, a).estado, e);

const conTres = () =>
  jugar(
    nuevaSala("ABCD", "ana", "Ana"),
    { t: "unirse", id: "bea", nombre: "Bea" },
    { t: "unirse", id: "carlos", nombre: "Carlos" },
  );

describe("paleta", () => {
  it("tiene un color válido y distinto en cada casilla", () => {
    expect(COLORES).toHaveLength(CASILLAS);
    expect(COLORES.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(new Set(COLORES).size).toBe(CASILLAS);
  });

  it("nombra las casillas por columna y fila", () => {
    expect(nombreCasilla(celdaEn(0, 0))).toBe("A1");
    expect(nombreCasilla(celdaEn(17, 35))).toBe("T36");
    expect(distancia(celdaEn(2, 2), celdaEn(3, 4))).toBe(2);
  });
});

describe("sala", () => {
  it("no deja entrar a más de 15 ni a nadie con la partida empezada", () => {
    let e = nuevaSala("ABCD", "j0", "J0");
    for (let i = 1; i < 15; i++) e = jugar(e, { t: "unirse", id: `j${i}`, nombre: `J${i}` });
    expect(e.jugadores).toHaveLength(15);
    expect(aplicar(e, { t: "unirse", id: "j15", nombre: "J15" }).rechazo).toBe("llena");

    const empezada = jugar(conTres(), { t: "empezar", id: "ana" });
    expect(aplicar(empezada, { t: "unirse", id: "nuevo", nombre: "Nuevo" }).rechazo).toBe("empezada");
    // Quien ya estaba puede volver a entrar (se le apagó el móvil).
    expect(aplicar(empezada, { t: "unirse", id: "bea", nombre: "Bea" }).rechazo).toBeUndefined();
  });

  it("solo empieza el anfitrión y con al menos 3", () => {
    const dos = jugar(nuevaSala("ABCD", "ana", "Ana"), { t: "unirse", id: "bea", nombre: "Bea" });
    expect(jugar(dos, { t: "empezar", id: "ana" }).fase).toBe("sala");
    expect(jugar(conTres(), { t: "empezar", id: "bea" }).fase).toBe("sala");
    const e = jugar(conTres(), { t: "vueltas", id: "ana", vueltas: 2 }, { t: "empezar", id: "ana" });
    expect(e.fase).toBe("eligiendo");
    expect(e.orden).toEqual(["ana", "bea", "carlos", "ana", "bea", "carlos"]);
  });
});

describe("turno", () => {
  const enRonda = () => jugar(conTres(), { t: "empezar", id: "ana" }, { t: "elegido", id: "ana" });

  it("una casilla solo la puede ocupar uno", () => {
    let e = enRonda();
    e = jugar(e, { t: "marcar", id: "bea", celda: 50 });
    const r = aplicar(e, { t: "marcar", id: "carlos", celda: 50 });
    expect(r.rechazo).toBe("ocupada");
    expect(r.estado.marcas).toHaveLength(1);
  });

  it("quien da la pista no marca y cada uno mueve su marca de la ronda", () => {
    let e = enRonda();
    e = jugar(e, { t: "marcar", id: "ana", celda: 10 }, { t: "marcar", id: "bea", celda: 10 }, { t: "marcar", id: "bea", celda: 11 });
    expect(e.marcas).toEqual([{ jugador: "bea", celda: 11, ronda: 1 }]);
  });

  it("en la segunda ronda la primera marca se queda y se añade otra", () => {
    let e = enRonda();
    e = jugar(e, { t: "marcar", id: "bea", celda: 10 }, { t: "segunda", id: "ana" }, { t: "marcar", id: "bea", celda: 20 });
    expect(e.marcas.map((m) => [m.celda, m.ronda])).toEqual([[10, 1], [20, 2]]);
  });

  it("reparte puntos al revelar y no repite el color", () => {
    const objetivo = celdaEn(5, 10);
    let e = enRonda();
    e = jugar(
      e,
      { t: "marcar", id: "bea", celda: objetivo },
      { t: "marcar", id: "carlos", celda: celdaEn(7, 12) },
      { t: "revelar", id: "ana", objetivo },
    );
    expect(e.fase).toBe("revelado");
    const puntos = Object.fromEntries(e.jugadores.map((j) => [j.id, j.puntos]));
    expect(puntos).toEqual({ ana: 1, bea: 3, carlos: 1 });
    expect(e.usados).toEqual([objetivo]);

    e = jugar(e, { t: "siguiente", id: "ana" });
    expect(quienDaPista(e)).toBe("bea");
    expect(e.marcas).toEqual([]);
  });

  it("acaba tras el último turno", () => {
    let e = jugar(conTres(), { t: "empezar", id: "ana" });
    for (const id of ["ana", "bea", "carlos"]) {
      e = jugar(e, { t: "elegido", id }, { t: "revelar", id, objetivo: 0 }, { t: "siguiente", id });
    }
    expect(e.fase).toBe("final");
  });

  it("el anfitrión puede saltar un turno atascado", () => {
    const e = jugar(conTres(), { t: "empezar", id: "ana" }, { t: "saltar", id: "ana" });
    expect(quienDaPista(e)).toBe("bea");
  });
});

describe("puntos", () => {
  it("3, 2, 1 según lo cerca; quien da la pista gana por cada marca en el 3×3", () => {
    const o = celdaEn(5, 5);
    const r = calcularReparto(
      [
        { jugador: "a", celda: o, ronda: 1 },
        { jugador: "b", celda: celdaEn(6, 6), ronda: 1 },
        { jugador: "b", celda: celdaEn(7, 3), ronda: 2 },
        { jugador: "c", celda: celdaEn(9, 5), ronda: 1 },
      ],
      o,
      "p",
      ["p", "a", "b", "c"],
    );
    expect(Object.fromEntries(r.map((x) => [x.jugador, x.puntos]))).toEqual({ p: 2, a: 3, b: 3, c: 0 });
  });
});

describe("opciones de color", () => {
  it("da cuatro colores distintos que no se han jugado", () => {
    const usados = Array.from({ length: 100 }, (_, i) => i);
    const o = opcionesDeColor(usados);
    expect(o).toHaveLength(4);
    expect(new Set(o).size).toBe(4);
    expect(o.some((c) => usados.includes(c))).toBe(false);
  });
});
