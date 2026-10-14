# SPEC 02 — Power-pellets y modo asustado

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-14
> **Objetivo:** 4 power-pellets en las esquinas activan 6s de modo en que los fantasmas huyen en blanco/parpadeando y Pacman puede comerlos.

## Alcance

**Incluye:**

- Sustituir el dot de cada esquina del mapa — (1,3), (26,3), (1,23), (26,23) — por una power-pellet (nuevo valor de tile `4`), dibujada más grande que un dot.
- Comer una pellet: +50 puntos, activa modo power durante 360 frames (6s a 60fps).
- En modo power: fantasmas activos huyen a la esquina fijada por su `kind`, van a `FRIGHTENED_SPEED` (0.08 celdas/frame, ~80%) y se dibujan blancos.
- Parpadeo (blanco ⇄ azul oscuro, cada 10 frames) solo en los últimos 120 frames (2s) del modo.
- Pacman puede comer fantasmas asustados: +200/400/800/1600 según orden dentro del mismo modo; el fantasma se teletransporta a su casilla de `GHOST_STARTS` y sale de nuevo tras 120 frames.
- Comer pellet con el modo activo reinicia los 360 frames y el contador de puntos doblados.
- Durante el modo power Pacman no puede morir: toda colisión con fantasma activo lo come.
- `dotsRemaining` cuenta también las pellets; el nivel solo se gana comiéndolas todas.

**Fuera del alcance (para specs futuras):**

- Animación de "ojos" volviendo a la pen.
- Fruta/bonus.
- Sirena de audio o cambios de sonido.
- Velocidad extra de Pacman durante el modo.

## Modelo de datos

```js
// maze.js — en MAZE_STR, los 4 dots de esquina pasan de '.' a 'P' (tile 4).
// Esquinas: (1,3), (26,3), (1,23), (26,23).

// game.js
const POWER_DURATION = 360;    // 6s a 60fps
const FRIGHTENED_SPEED = 0.08; // ~80% de GHOST_SPEED
const GHOST_SCORES = [200, 400, 800, 1600]; // por orden de comida en el modo
const RESPAWN_DELAY = 120;     // frames en pen tras ser comido

// Esquina de huida por kind (power mode):
const FRIGHTENED_CORNERS = {
  hunter  : { x: 26, y: 1 },
  ambusher: { x: 1 , y: 1 },
  flanker : { x: 26, y: 29 },
  shy     : { x: 1 , y: 29 },
};

/* game (nuevas propiedades):
  game.powerTimer  → frames restantes de modo; 0 = juego normal
  game.ghostsEaten → comidos en el modo actual (indexa GHOST_SCORES)
  Tile 4 en grid → power-pellet; movePacman la come como un dot.
  Un fantasma está asustado si powerTimer > 0 && frame >= releaseAt
  && no está esperando respawn. */
```

## Plan de implementación

1. `maze.js`: marcar las 4 esquinas con tile `4` (parseTile acepta `'P'`); `render.js` dibuja el tile 4 como pellet grande y `game.js` lo cuenta en `dotsRemaining`. Prueba: se ven 4 pellets grandes en las esquinas y se comen como dots (+10 aún).
2. `game.js`: en `movePacman`, comer tile 4 → +50 puntos, `powerTimer = 360`, `ghostsEaten = 0`; `update()` decrementa `powerTimer` hasta 0. Prueba: comer una pellet da 50 puntos y a los 6s no hay nada visible distinto aún.
3. `game.js`: fantasmas asustados — helper `isFrightened(game, g)`, `speed = FRIGHTENED_SPEED`, `GHOST_TARGETS.frightened(game, g)` devuelve `FRIGHTENED_CORNERS[g.kind]`, y `decideGhost()` lo usa. Prueba: tras comer pellet los fantasmas activos se van a sus esquinas, más lentos; a los 6s vuelven a perseguir.
4. `game.js`: colisiones en `update()` — con `powerTimer > 0`, colisión come fantasma: `score += GHOST_SCORES[min(ghostsEaten,3)]`, `ghostsEaten++`, teleport a su `GHOST_STARTS` con `releaseAt = frame + RESPAWN_DELAY`; sin muerte posible. Prueba: comer 2 fantasmas seguidos da 200 y 400; el fantasma reaparece a los 2s y sale por la puerta ya normal.
5. `render.js`: fantasma asustado en blanco; si `powerTimer <= 120`, parpadeo blanco/azul oscuro cada 10 frames. Prueba visual completa: partidas en `npx serve src`, comer pellet en cada esquina, encadenar dos pellets, comprobar respawn y expiración.

## Criterios de aceptación

- [ ] Se ven 4 pellets grandes, uno en cada esquina, y los dots de esquina ya no existen.
- [ ] Comer una pellet suma 50 puntos y dura exactamente ~6s el efecto.
- [ ] Durante el modo los fantasmas activos se dibujan blancos y huyen hacia su esquina fijada.
- [ ] Los fantasmas asustados se mueven a velocidad ~80% de la normal.
- [ ] En los últimos ~2s parpadean; antes no parpadean.
- [ ] Comer un fantasma asustado suma 200, y 400/800/1600 en los siguientes del mismo modo.
- [ ] El fantasma comido reaparece en la pen y sale de nuevo ~2s después, ya normal (aunque el modo siga activo).
- [ ] Comer una segunda pellet con el modo activo reinicia los 6s y la secuencia de puntos (siguiente comido vale 200).
- [ ] Durante el modo power Pacman no pierde vidas al tocar fantasmas activos.
- [ ] Expirado el modo, los fantasmas recuperan color y velocidad normales y persiguen de nuevo.
- [ ] El nivel solo se gana comiendo también las 4 pellets (cuentan en `dotsRemaining`).
- [ ] La consola no muestra errores durante una partida completa.

## Decisiones

- **Sí:** teletransportar el fantasma comido a su casilla de `GHOST_STARTS` con `releaseAt` nuevo. Reutiliza intacto el mecanismo de salida del pen de la spec 01, sin pathing interior ni ojos animados.
- **Sí:** huida por esquina fija por `kind`. Reutiliza el selector greedy de la spec 01 igual que la huida de `shy`; cero lógica nueva de pathfinding.
- **Sí:** el fantasma "revivido" sale ya normal aunque el modo siga activo. Es el comportamiento del arcade y evita el ciclo infinito de comérselos.
- **No:** congelar el juego al comer un fantasma. Exigiría tocar el bucle de `main.js`; decisión del usuario: sin pausa.
- **Sí:** velocidad de asustados ~80% (decisión del usuario): `FRIGHTENED_SPEED = 0.08` alinea cada 12.5 frames; se ajustará el pacing si se ve brusco.
- **Parpadeo blanco ⇄ azul oscuro (`#2121de`) cada 10 frames** solo en los últimos 2s: fiel al arcade; "blanco parpadeante" implementado así por legibilidad (blanco⇄invisible sería confuso).
- **No:** audio, fruta, ni ojos animados. Specs propias si aterrizan.
- **Nota:** el usuario aprobó la spec e indicó implementarla en el mismo turno ("ok, implementalo"), por lo que el estado se marca directamente `Aprobado`.
- **Sí (ambigüedad resuelta durante la implementación):** fantasma revivido = **normal de verdad** (velocidad, color) y puede matar a Pacman aunque el modo siga activo (opción 1, arcade fiel). Implementado con marca `revived` por fantasma; una pellet nueva reactiva a los revividos. El criterio 9 se interpreta como referido a los fantasmas asustados.
- **Ajuste de pacing:** `FRIGHTENED_SPEED` = 1/12 (~83%) en lugar de 0.08. La spec lo delegaba ("se ajustará el pacing si se ve brusco") y el bug detectado en pruebas lo hizo necesario: 0.08 no alinea cada celda, lo que saltaba el chequeo de muros y sacaba a los fantasmas del mapa al expirar el modo. Se añadió además un snap al centro de celda más cercano al cambiar de velocidad (entrar/salir del modo).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Comer pellet y fantasma el mismo frame (pellet y ghost en la misma casilla) | Orden en `update()`: primero movimiento/consumo de Pacman, luego decrecer `powerTimer`, luego colisiones; la pellet se aplica antes de evaluar el contacto. |
| Fantasma comido justo al agotarse el modo | El teleport a la pen se ejecuta igualmente; el respawn sale ya normal — comportamiento clásico, sin caso especial. |
| `ghostsEaten` sin reiniciar tras perder vida | No aplica: en modo power no se puede perder vida; al morir `powerTimer` ya es 0 y la siguiente pellet reinicia el contador. |
| Colisión con fantasma esperando respawn dentro de la pen | Los que esperan (`frame < releaseAt`) no se mueven ni colisionan, igual que en la spec 01. |

## Lo que **no** está en esta spec

- Animación de ojos volviendo a la pen.
- Fruta/bonus y sirena de audio.
- Velocidad extra de Pacman en modo power.
- Scatter/chase con temporizadores (sigue en su spec).

Cada uno de esos, si aterriza, va en su propia spec.
