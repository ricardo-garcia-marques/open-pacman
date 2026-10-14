// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Casilla de la puerta de la pen: los fantasmas liberados aparecen aqui.
const GHOST_DOOR = { x: 13, y: 12 };

// Rectangulo del interior de la pen (filas 13-15, cols 11-16).
const PEN_RECT = { x0: 11, x1: 16, y0: 13, y1: 15 };

function isPenTile( x, y ) {
  return x >= PEN_RECT.x0 && x <= PEN_RECT.x1 && y >= PEN_RECT.y0 && y <= PEN_RECT.y1;
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frame: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      releaseAt: g.exitDelay,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Zona de no re-entrada para fantasmas ya liberados: interior de la pen
// + las dos baldosas de puerta (13,12) y (14,12). Un fantasma fuera no
// puede volver a pisarlas. Un fantasma dentro (sin liberar o recien
// colocado en la puerta) ignora esto: asi puede salir por la puerta.
function penIsWall( g, x, y ) {
  if ( isPenTile( Math.round( g.x ), Math.round( g.y ) ) ) return false;
  if ( x === GHOST_DOOR.x && y === GHOST_DOOR.y ) return true;
  if ( x === GHOST_DOOR.x + 1 && y === GHOST_DOOR.y ) return true;
  return isPenTile( x, y );
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
// g (opcional) es el fantasma concreto: aplica la regla de no re-entrada a la pen.
function canMove( grid, x, y, dir, actor, g ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  if ( actor === 'ghost' && g && penIsWall( g, tx, ty ) ) return false;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objeto compartido con helpers usados por las distintas IAs.
const GHOST_TARGETS = {
  // Hunter (rojo): persigue la casilla de Pacman.
  hunter( game ) {
    const p = game.pacman;
    return { x: Math.round( p.x ), y: Math.round( p.y ) };
  },

  // Ambusher (rosa): apunta ~4 casillas por delante de Pacman en su dir.
  ambusher( game ) {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    return { x: Math.round( p.x ) + d.x * 4, y: Math.round( p.y ) + d.y * 4 };
  },

  // Flanker (cian): doble del vector rojo -> (2 casillas delante de Pacman).
  flanker( game ) {
    const p = game.pacman;
    const d = DIRS[ p.dir ];
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    const pivot = { x: px + d.x * 2, y: py + d.y * 2 };
    const red = game.ghosts.find( ( o ) => o.kind === 'hunter' );
    if ( !red ) return pivot;
    return {
      x: pivot.x + Math.round( pivot.x - Math.round( red.x ) ),
      y: pivot.y + Math.round( pivot.y - Math.round( red.y ) ),
    };
  },

  // Shy (naranja): persigue si dist >= 8; si no, huye a la esquina (1,29).
  shy( game, g ) {
    const p = game.pacman;
    const px = Math.round( p.x );
    const py = Math.round( p.y );
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    if ( dist < 8 ) return { x: 1, y: 29 };
    return { x: px, y: py };
  },
};

function chooseDirTowards( game, g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  // Sobre una baldosa de puerta (3): forzar 'up' (cruce vertical del clasico,
  // excepcion local al selector greedy; solo los fantasmas pueden pisar aqui).
  if ( grid[ Math.round( g.y ) ] && grid[ Math.round( g.y ) ][ Math.round( g.x ) ] === 3 ) {
    g.dir = 'up';
    return;
  }

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost', g )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const targetFn = GHOST_TARGETS[ g.kind ] || GHOST_TARGETS.hunter;
  const target = targetFn( game, g );
  g.dir = chooseDirTowards( game, g, choices, target.x, target.y );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost', g ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.releaseAt = game.frame + GHOST_STARTS[ i ].exitDelay;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;
  movePacman( game );

  // Liberacion escalonada del pen: si frame < releaseAt no se mueve ni
  // colisiona; al llegar su frame se coloca en la puerta y sale hacia arriba.
  game.ghosts.forEach( ( g, i ) => {
    if ( game.frame < g.releaseAt ) return;
    const s = GHOST_STARTS[ i ];
    if ( g.x === s.x && g.y === s.y ) {
      g.x = GHOST_DOOR.x;
      g.y = GHOST_DOOR.y;
      g.dir = 'up';
    }
    moveGhost( game, g );
  } );

  const active = game.ghosts.filter( ( g ) => game.frame >= g.releaseAt );
  for ( const g of active ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
