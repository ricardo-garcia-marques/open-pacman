# SPEC 01 — Fantasmas con IA propia y salida escalonada

> **Estado:** Implementado
> **Depende de:** ninguna
> **Fecha:** 2026-10-14
> **Objetivo:** Los 4 fantasmas clásicos (rojo, rosa, cian, naranja) persiguen a Pacman cada uno con su propia IA y salen de la pen de forma escalonada.

## Alcance

**Incluye:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas con `kind` nuevo: `hunter` (rojo), `ambusher` (rosa), `flanker` (cian), `shy` (naranja).
- Refactorizar `decideGhost()` para que cada `kind` calcule una casilla objetivo y compartan el mismo selector greedy de dirección (mínimo Manhattan, sin reversa salvo callejón).
- Cian usa como objetivo el doble del vector rojo→(punto 2 casillas delante de Pacman).
- Naranja persigue a Pacman si distancia Manhattan ≥ 8 y huye hacia la esquina inferior izquierda (1,29) si < 8.
- Salida escalonada de la pen: cada fantasma tiene `exitDelay` en frames (0, 120, 240, 360); al liberarse se le coloca en la casilla de la puerta (13,12) con `dir: 'up'`.
- `update()` incrementa un contador `game.frame`; `resetPositions()` reprograma las liberaciones tras perder una vida.

**Fuera del alcance (para specs futuras):**

- Modo asustado / energizer / comer fantasmas.
- Velocidades distintas por fantasma (todos usan `GHOST_SPEED`).
- Modo scatter/chase con temporizadores (persecución constante).
- Pathfinding avanzado (A*), el objetivo es greedy por casilla vecina.
- Posiciones iniciales alternadas por nivel.

## Modelo de datos

```js
// maze.js — GHOST_STARTS ampliado (el orden define el color por índice en render.js)
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter'  , exitDelay: 0   }, // rojo
  { x: 14, y: 14, kind: 'ambusher', exitDelay: 120 }, // rosa
  { x: 12, y: 14, kind: 'flanker' , exitDelay: 240 }, // cian
  { x: 15, y: 14, kind: 'shy'     , exitDelay: 360 }, // naranja
];

/* game.js — propiedades nuevas:
  ghost.releaseAt → game.frame absoluto en el que sale de la pen
  game.frame      → contador de frames de la partida (incrementa en update())
  El fantasma con game.frame < releaseAt no se mueve (permanece en la pen).
  Al liberarse se coloca en (13,12) con dir 'up'. */
```

## Plan de implementación

1. `maze.js`: ampliar `GHOST_STARTS` a 4 entradas con `kind` y `exitDelay`. Prueba manual: abrir el juego; se ven 4 fantasmas quietos en la pen con colores rojo/cian/rosa/naranja.
2. `game.js`: añadir `game.frame` (incremento en `update()`), campo `releaseAt` en cada fantasma y bloqueo de movimiento en pen. `resetPositions()` recalcula `releaseAt = game.frame + exitDelay` (también en `createGame()` con el mismo desfase). Prueba: los 4 salen uno cada ~2s en el orden rojo→rosa→cian→naranja.
3. `game.js`: refactorizar `decideGhost()` con helper `chooseDirTowards(game, g, choices, tx, ty)` (el bucle greedy actual de `hunter`) y ramificar `kind` a las 4 IAs según el modelo de datos. Prueba: el rosa corta el paso anticipándose, el naranja se acerca y retrocede a corta distancia, el cian flanquea.
4. Verificación visual completa: jugar varias partidas en `npx serve src` (perder una vida y comprobar que la salida escalonada se repite; el rojo persigue directo).

## Criterios de aceptación

- [ ] Se ven 4 fantasmas en la pen al empezar la partida, con colores rojo, rosa, cian y naranja.
- [ ] Al pulsar comenzar, el rojo sale primero y los demás salen escalonados cada ~2s (120 frames ≈ 2s a 60fps), en orden rojo→rosa→cian→naranja.
- [ ] Un fantasma en pen no se mueve ni colisiona con Pacman (haría imposible jugar).
- [ ] El rojo elige siempre la dirección que minimiza la distancia a Pacman (comportamiento existente, sin cambios).
- [ ] El rosa apunta ~4 casillas por delante de Pacman en su dirección actual.
- [ ] El cian toma la dirección hacia el objetivo simétrico descrito (vector rojo→punto duplicado).
- [ ] El naranja persigue a Pacman cuando está a ≥ 8 casillas y se dirige a la esquina (1,29) cuando está a < 8.
- [ ] Ningún fantasma retrocede 180° salvo en callejón sin salida.
- [ ] Tras perder una vida, los 4 fantasmas vuelven a la pen y repiten la salida escalonada.
- [ ] Fantasma liberado cruza la puerta de la pen (3) y aparece en el pasillo superior.
- [ ] La consola no muestra errores durante una partida completa.

## Decisiones

- **Sí:** diseño por casilla objetivo + selector greedy compartido. Reutiliza la lógica existente de `hunter`; cada IA es solo una función que devuelve un target.
- **No:** A*/pathfinding. Sobredimensionado para este escenario; la heurística greedy da la sensación clásica de Pacman.
- **Sí:** salida escalonada del pen. Con 4 fantasmas a la vez el inicio es injugable.
- **Sí:** liberación teletransportando a la casilla puerta (13,12) en lugar de navegar dentro del pen. Evita programar pathing interior; visualmente el fantasma solo "sube" por la puerta.
- **No:** modo scatter/chase. Añade temporizadores y targets de esquina; persecución fija es suficiente para esta spec.
- **No:** modo asustado/energizer y velocidad distinta por fantasma. Van en specs propias.
- **No:** variante extra de `hunter` en lugar del 4º fantasma — decisión del usuario: los 4 comportamientos del clásico (rojo, rosa, cian, naranja).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El target del cian/naranja cae dentro de una pared | El selector greedy solo elige entre direcciones válidas; el objetivo fallido degrada a "acercarse lo máximo posible", nunca bloquea al fantasma. |
| El naranja oscila en el umbral de < 8 casillas | Consecuencia aceptable (se comporta como Clyde original); hysteresis solo si resulta molesta en pruebas. |
| Dos fantasmas coinciden en la puerta al liberarse | Los `exitDelay` separados 120 frames hacen imposible coincidir en la casilla puerta. |

## Lo que **no** está en esta spec

- Modo asustado/energizer y comer fantasmas.
- Velocidades distintas por fantasma.
- Scatter/chase con temporizador.
- Pathfinding A*.
- Niveles adicionales o bonus/fruta.

Cada uno de esos, si aterriza, va en su propia spec.
