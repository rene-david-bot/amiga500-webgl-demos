const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const soundBtn = document.getElementById('soundBtn');
const statusEl = document.getElementById('status');

const levelValue = document.getElementById('levelValue');
const scoreValue = document.getElementById('scoreValue');
const livesValue = document.getElementById('livesValue');
const lootValue = document.getElementById('lootValue');
const bestValue = document.getElementById('bestValue');

const TILE = 48;
const COLS = 20;
const ROWS = 14;
const PLAYER_RADIUS = 0.28;

const STORAGE_KEY = 'arcadeAisleHeistBest';

const levels = [
  {
    map: [
      '####################',
      '#P...C.....#....C..#',
      '#.####.###.#.##.##.#',
      '#....#...#.#..C....#',
      '###..###.#.#######.#',
      '#....#...#.....#...#',
      '#.####.#####.#.#.#.#',
      '#......C....#.#.#..#',
      '#.######.####.#.##.#',
      '#..C.....#....#....#',
      '##.#####.#.######..#',
      '#.....#..#....C....#',
      '#..C..#......#.....#',
      '####################'
    ],
    guards: [
      { path: [[10, 1], [17, 1], [17, 4], [10, 4]], speed: 2.4, vision: 5.5 },
      { path: [[2, 11], [7, 11], [7, 8], [2, 8]], speed: 2.1, vision: 4.7 }
    ]
  },
  {
    map: [
      '####################',
      '#P..C..#....C....C.#',
      '#.##.#.#.####.###..#',
      '#....#.#....#...#..#',
      '#.####.###..###.#..#',
      '#..C.....#......#..#',
      '###.###.#######.#..#',
      '#...#...#..C....#..#',
      '#.#.#.###.#####.##.#',
      '#.#...#....#...C...#',
      '#.#####.##.#.#####.#',
      '#...C...##.#....C..#',
      '#......C...#.......#',
      '####################'
    ],
    guards: [
      { path: [[1, 3], [8, 3], [8, 1], [1, 1]], speed: 2.4, vision: 5.2 },
      { path: [[14, 1], [18, 1], [18, 6], [14, 6]], speed: 2.2, vision: 5.1 },
      { path: [[5, 12], [12, 12], [12, 9], [5, 9]], speed: 2.5, vision: 4.6 }
    ]
  },
  {
    map: [
      '####################',
      '#P..C...#..C.....C.#',
      '#.###.#.#.###.###..#',
      '#.#...#.#...#...#..#',
      '#.#.###.###.#.#.##.#',
      '#...#..C..#.#.#....#',
      '###.#.#####.#.####.#',
      '#...#.....#.#..C.#.#',
      '#.#####.#.#.##.#.#.#',
      '#....C..#.#....#...#',
      '#.#######.###.###..#',
      '#..C....#..C#...#..#',
      '#.....C....#....C..#',
      '####################'
    ],
    guards: [
      { path: [[1, 1], [6, 1], [6, 4], [1, 4]], speed: 2.6, vision: 5.4 },
      { path: [[9, 1], [18, 1], [18, 4], [9, 4]], speed: 2.5, vision: 5.7 },
      { path: [[3, 9], [8, 9], [8, 12], [3, 12]], speed: 2.4, vision: 4.8 },
      { path: [[12, 11], [18, 11], [18, 7], [12, 7]], speed: 2.7, vision: 5.2 }
    ]
  }
];

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  touchUp: false,
  touchDown: false,
  touchLeft: false,
  touchRight: false
};

const state = {
  mode: 'idle',
  levelIndex: 0,
  score: 0,
  lives: 3,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  player: { x: 1.5, y: 1.5, speed: 4.2 },
  spawn: { x: 1.5, y: 1.5 },
  guards: [],
  collectibles: [],
  lastFrame: 0,
  stunTimer: 0,
  map: [],
  messagePulse: 0,
  soundOn: true,
  audioCtx: null
};

bestValue.textContent = String(state.best);

function setStatus(text) {
  statusEl.textContent = text;
}

function syncHud() {
  levelValue.textContent = String(state.levelIndex + 1);
  scoreValue.textContent = String(state.score);
  livesValue.textContent = String(state.lives);
  lootValue.textContent = String(state.collectibles.filter((c) => !c.taken).length);
  bestValue.textContent = String(state.best);
}

function ensureAudio() {
  if (!state.soundOn) return null;
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
  return state.audioCtx;
}

function playTone(freq, dur = 0.09, type = 'square', gain = 0.04) {
  const audio = ensureAudio();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur);
}

function playPickup() {
  playTone(820, 0.08, 'square', 0.035);
  setTimeout(() => playTone(1180, 0.07, 'square', 0.025), 40);
}

function playAlarm() {
  playTone(220, 0.14, 'sawtooth', 0.05);
  setTimeout(() => playTone(165, 0.12, 'sawtooth', 0.04), 120);
}

function playClear() {
  [520, 660, 880].forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.12, 'triangle', 0.03), i * 110);
  });
}

function resetPlayerToSpawn() {
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
}

function makeGuards(rawGuards) {
  return rawGuards.map((entry) => {
    const start = entry.path[0];
    const next = entry.path[1];
    const facing = {
      x: Math.sign(next[0] - start[0]),
      y: Math.sign(next[1] - start[1])
    };
    return {
      path: entry.path,
      speed: entry.speed,
      vision: entry.vision,
      x: start[0] + 0.5,
      y: start[1] + 0.5,
      segIndex: 0,
      facing
    };
  });
}

function loadLevel(index, keepProgress = true) {
  const level = levels[index];
  state.levelIndex = index;
  state.map = level.map.slice();
  state.collectibles = [];
  state.guards = makeGuards(level.guards);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = state.map[y][x];
      if (tile === 'P') {
        state.spawn = { x: x + 0.5, y: y + 0.5 };
      }
      if (tile === 'C') {
        state.collectibles.push({ x: x + 0.5, y: y + 0.5, taken: false });
      }
    }
  }

  resetPlayerToSpawn();
  state.stunTimer = 0;

  if (!keepProgress) {
    state.score = 0;
    state.lives = 3;
  }

  syncHud();
}

function restartCurrentLevel() {
  loadLevel(state.levelIndex, true);
  setStatus(`Level ${state.levelIndex + 1} reset. Move carefully through patrol lanes.`);
}

function isWall(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  return state.map[ty][tx] === '#';
}

function canOccupy(x, y) {
  const r = PLAYER_RADIUS;
  const points = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r]
  ];
  return points.every(([px, py]) => !isWall(Math.floor(px), Math.floor(py)));
}

function movePlayer(dt) {
  const up = input.up || input.touchUp;
  const down = input.down || input.touchDown;
  const left = input.left || input.touchLeft;
  const right = input.right || input.touchRight;

  let dx = (right ? 1 : 0) - (left ? 1 : 0);
  let dy = (down ? 1 : 0) - (up ? 1 : 0);

  if (!dx && !dy) return;

  const mag = Math.hypot(dx, dy) || 1;
  dx /= mag;
  dy /= mag;

  const speed = state.player.speed;
  const nextX = state.player.x + dx * speed * dt;
  const nextY = state.player.y + dy * speed * dt;

  if (canOccupy(nextX, state.player.y)) {
    state.player.x = nextX;
  }
  if (canOccupy(state.player.x, nextY)) {
    state.player.y = nextY;
  }
}

function updateGuards(dt) {
  state.guards.forEach((guard) => {
    let remaining = dt;
    while (remaining > 0) {
      const nextIdx = (guard.segIndex + 1) % guard.path.length;
      const target = guard.path[nextIdx];
      const tx = target[0] + 0.5;
      const ty = target[1] + 0.5;
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) {
        guard.segIndex = nextIdx;
        continue;
      }

      const step = guard.speed * remaining;
      if (step >= dist) {
        guard.x = tx;
        guard.y = ty;
        guard.segIndex = nextIdx;
        const upcomingIdx = (guard.segIndex + 1) % guard.path.length;
        const upcoming = guard.path[upcomingIdx];
        guard.facing = {
          x: Math.sign(upcoming[0] - target[0]),
          y: Math.sign(upcoming[1] - target[1])
        };
        remaining -= dist / guard.speed;
      } else {
        guard.x += (dx / dist) * step;
        guard.y += (dy / dist) * step;
        guard.facing = {
          x: Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0,
          y: Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0
        };
        remaining = 0;
      }
    }
  });
}

function isSightBlocked(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const step = 0.18;

  for (let t = step; t < distance; t += step) {
    const sx = x0 + (dx / distance) * t;
    const sy = y0 + (dy / distance) * t;
    if (isWall(Math.floor(sx), Math.floor(sy))) {
      return true;
    }
  }
  return false;
}

function isPlayerSpotted() {
  return state.guards.some((guard) => {
    const px = state.player.x;
    const py = state.player.y;

    if (guard.facing.x !== 0) {
      const dx = px - guard.x;
      const dy = Math.abs(py - guard.y);
      if (Math.sign(dx) !== guard.facing.x || dy > 0.5 || Math.abs(dx) > guard.vision) {
        return false;
      }
      return !isSightBlocked(guard.x, guard.y, px, py);
    }

    if (guard.facing.y !== 0) {
      const dy = py - guard.y;
      const dx = Math.abs(px - guard.x);
      if (Math.sign(dy) !== guard.facing.y || dx > 0.5 || Math.abs(dy) > guard.vision) {
        return false;
      }
      return !isSightBlocked(guard.x, guard.y, px, py);
    }

    return false;
  });
}

function collectLoot() {
  let changed = false;
  state.collectibles.forEach((item) => {
    if (item.taken) return;
    const dist = Math.hypot(state.player.x - item.x, state.player.y - item.y);
    if (dist < 0.43) {
      item.taken = true;
      state.score += 50;
      playPickup();
      changed = true;
    }
  });

  if (changed) {
    syncHud();
  }

  if (state.collectibles.every((item) => item.taken)) {
    state.score += 150 + state.lives * 20;
    const finalLevel = state.levelIndex === levels.length - 1;
    playClear();

    if (finalLevel) {
      state.mode = 'won';
      state.best = Math.max(state.best, state.score);
      localStorage.setItem(STORAGE_KEY, String(state.best));
      setStatus(`Vault clean! Final score ${state.score}. Hit Start Heist for a new run.`);
      syncHud();
      return;
    }

    loadLevel(state.levelIndex + 1, true);
    setStatus(`Floor clear. Escalating to level ${state.levelIndex + 1}.`);
  }
}

function loseLife() {
  state.lives -= 1;
  playAlarm();
  syncHud();

  if (state.lives <= 0) {
    state.mode = 'gameover';
    state.best = Math.max(state.best, state.score);
    localStorage.setItem(STORAGE_KEY, String(state.best));
    setStatus(`Busted. Final score ${state.score}. Press Start Heist to retry.`);
    return;
  }

  state.mode = 'stunned';
  state.stunTimer = 0.9;
  setStatus(`Spotted! Lives left: ${state.lives}. Re-entering floor...`);
}

function update(dt) {
  state.messagePulse += dt;

  if (state.mode === 'stunned') {
    state.stunTimer -= dt;
    if (state.stunTimer <= 0) {
      restartCurrentLevel();
      state.mode = 'running';
    }
    return;
  }

  if (state.mode !== 'running') return;

  movePlayer(dt);
  updateGuards(dt);
  collectLoot();

  if (state.mode === 'running' && isPlayerSpotted()) {
    loseLife();
  }
}

function drawBackground() {
  ctx.fillStyle = '#060912';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(95, 129, 214, 0.13)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * TILE, 0);
    ctx.lineTo(x * TILE, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE);
    ctx.lineTo(canvas.width, y * TILE);
    ctx.stroke();
  }
}

function drawWalls() {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!isWall(x, y)) continue;
      const px = x * TILE;
      const py = y * TILE;
      const grad = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
      grad.addColorStop(0, '#1a2140');
      grad.addColorStop(1, '#111731');
      ctx.fillStyle = grad;
      ctx.fillRect(px, py, TILE, TILE);

      ctx.strokeStyle = 'rgba(137, 172, 255, 0.22)';
      ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    }
  }
}

function drawCollectibles() {
  state.collectibles.forEach((item) => {
    if (item.taken) return;
    const px = item.x * TILE;
    const py = item.y * TILE;
    const glow = 6 + Math.sin(state.messagePulse * 6) * 3;

    ctx.fillStyle = `rgba(255, 196, 73, ${0.2 + (glow / 30)})`;
    ctx.beginPath();
    ctx.arc(px, py, 14 + glow * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd56b';
    ctx.fillRect(px - 11, py - 8, 22, 16);
    ctx.fillStyle = '#8b5d1a';
    ctx.fillRect(px - 9, py - 6, 18, 12);
    ctx.fillStyle = '#ffe8ad';
    ctx.fillRect(px - 5, py - 2, 10, 4);
  });
}

function drawVisionCone(guard) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ff5566';

  const x = guard.x * TILE;
  const y = guard.y * TILE;
  const length = guard.vision * TILE;
  const width = TILE * 1.15;

  if (guard.facing.x > 0) {
    ctx.fillRect(x, y - width / 2, length, width);
  } else if (guard.facing.x < 0) {
    ctx.fillRect(x - length, y - width / 2, length, width);
  } else if (guard.facing.y > 0) {
    ctx.fillRect(x - width / 2, y, width, length);
  } else if (guard.facing.y < 0) {
    ctx.fillRect(x - width / 2, y - length, width, length);
  }

  ctx.restore();
}

function drawGuards() {
  state.guards.forEach((guard) => {
    drawVisionCone(guard);

    const px = guard.x * TILE;
    const py = guard.y * TILE;

    ctx.fillStyle = '#f15f7b';
    ctx.beginPath();
    ctx.arc(px, py, TILE * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffbdd0';
    ctx.beginPath();
    ctx.arc(px, py - TILE * 0.18, TILE * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffe2ea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + guard.facing.x * 16, py + guard.facing.y * 16);
    ctx.stroke();
  });
}

function drawPlayer() {
  const px = state.player.x * TILE;
  const py = state.player.y * TILE;

  ctx.fillStyle = '#66f4ff';
  ctx.beginPath();
  ctx.arc(px, py, TILE * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d7ffff';
  ctx.beginPath();
  ctx.arc(px, py - TILE * 0.17, TILE * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1f9db6';
  ctx.lineWidth = 3;
  ctx.strokeRect(px - TILE * 0.2, py - TILE * 0.2, TILE * 0.4, TILE * 0.4);
}

function drawOverlay() {
  if (state.mode !== 'idle' && state.mode !== 'gameover' && state.mode !== 'won') {
    if (state.mode === 'stunned') {
      ctx.fillStyle = 'rgba(255, 70, 90, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }

  ctx.fillStyle = 'rgba(4, 8, 16, 0.66)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaf4ff';
  ctx.font = '700 42px "Segoe UI", sans-serif';
  const title = state.mode === 'idle' ? 'Arcade Aisle Heist' : state.mode === 'won' ? 'Heist Complete' : 'Busted';
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 24);

  ctx.font = '500 22px "Segoe UI", sans-serif';
  const subtitle = state.mode === 'idle'
    ? 'Press Start Heist to begin'
    : state.mode === 'won'
      ? 'All floors cleared. Run it back for a higher score.'
      : 'Press Start Heist to retry';
  ctx.fillStyle = '#bdd2ff';
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
}

function draw() {
  drawBackground();
  drawWalls();
  drawCollectibles();
  drawGuards();
  drawPlayer();
  drawOverlay();
}

function frame(ts) {
  if (!state.lastFrame) {
    state.lastFrame = ts;
  }

  const dt = Math.min((ts - state.lastFrame) / 1000, 0.05);
  state.lastFrame = ts;

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function startGame() {
  ensureAudio();
  state.mode = 'running';
  state.score = 0;
  state.lives = 3;
  loadLevel(0, false);
  setStatus('Floor 1 active. Clear the aisle while staying out of guard beams.');
  syncHud();
}

function setKey(dir, pressed) {
  if (dir === 'up') input.up = pressed;
  if (dir === 'down') input.down = pressed;
  if (dir === 'left') input.left = pressed;
  if (dir === 'right') input.right = pressed;
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') setKey('up', true);
  if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') setKey('down', true);
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') setKey('left', true);
  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') setKey('right', true);
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') setKey('up', false);
  if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') setKey('down', false);
  if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') setKey('left', false);
  if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') setKey('right', false);
});

for (const btn of document.querySelectorAll('.touch-grid button')) {
  const dir = btn.dataset.dir;
  const key = `touch${dir.charAt(0).toUpperCase()}${dir.slice(1)}`;

  const press = (value) => {
    input[key] = value;
    if (value) ensureAudio();
  };

  btn.addEventListener('pointerdown', () => press(true));
  btn.addEventListener('pointerup', () => press(false));
  btn.addEventListener('pointercancel', () => press(false));
  btn.addEventListener('pointerleave', () => press(false));
}

startBtn.addEventListener('click', () => {
  startGame();
});

resetBtn.addEventListener('click', () => {
  if (state.mode === 'idle' || state.mode === 'gameover' || state.mode === 'won') {
    startGame();
    return;
  }
  restartCurrentLevel();
  state.mode = 'running';
});

soundBtn.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  soundBtn.textContent = `Sound: ${state.soundOn ? 'On' : 'Off'}`;
  if (state.soundOn) {
    ensureAudio();
    playTone(660, 0.06, 'triangle', 0.025);
  }
});

loadLevel(0, false);
setStatus('Press Start Heist, then move with Arrow keys or WASD. Stay out of red patrol beams.');
syncHud();
requestAnimationFrame(frame);
