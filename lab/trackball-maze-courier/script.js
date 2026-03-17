const mazeEl = document.getElementById('maze');
const levelEl = document.getElementById('level');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const disksEl = document.getElementById('disks');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const WALL = { N: 1, E: 2, S: 4, W: 8 };
const DIRS = {
  ArrowUp: { dx: 0, dy: -1, bit: WALL.N, opp: WALL.S },
  ArrowRight: { dx: 1, dy: 0, bit: WALL.E, opp: WALL.W },
  ArrowDown: { dx: 0, dy: 1, bit: WALL.S, opp: WALL.N },
  ArrowLeft: { dx: -1, dy: 0, bit: WALL.W, opp: WALL.E },
  w: { dx: 0, dy: -1, bit: WALL.N, opp: WALL.S },
  d: { dx: 1, dy: 0, bit: WALL.E, opp: WALL.W },
  s: { dx: 0, dy: 1, bit: WALL.S, opp: WALL.N },
  a: { dx: -1, dy: 0, bit: WALL.W, opp: WALL.E }
};

let state = null;
let timerId = null;
let audio = null;

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function createMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(WALL.N | WALL.E | WALL.S | WALL.W));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [{ x: 0, y: 0 }];
  visited[0][0] = true;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const neighbors = [];

    for (const dir of [DIRS.ArrowUp, DIRS.ArrowRight, DIRS.ArrowDown, DIRS.ArrowLeft]) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        neighbors.push({ nx, ny, dir });
      }
    }

    if (!neighbors.length) {
      stack.pop();
      continue;
    }

    const { nx, ny, dir } = neighbors[randInt(neighbors.length)];
    grid[current.y][current.x] &= ~dir.bit;
    grid[ny][nx] &= ~dir.opp;
    visited[ny][nx] = true;
    stack.push({ x: nx, y: ny });
  }

  return grid;
}

function pickDisks(cols, rows, count) {
  const slots = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((x === 0 && y === 0) || (x === cols - 1 && y === rows - 1)) continue;
      slots.push(`${x},${y}`);
    }
  }

  const disks = new Set();
  while (disks.size < count && slots.length) {
    const idx = randInt(slots.length);
    disks.add(slots[idx]);
    slots.splice(idx, 1);
  }

  return disks;
}

function startRun(resetScore = true) {
  const best = Number(localStorage.getItem('trackball-best') || 0);
  bestEl.textContent = best;

  state = {
    level: 1,
    score: resetScore ? 0 : (state?.score || 0)
  };

  loadLevel();
}

function loadLevel() {
  const cols = Math.min(16, 9 + state.level);
  const rows = Math.min(12, 6 + Math.floor(state.level * 0.8));
  const disksTotal = Math.min(8, 2 + Math.floor(state.level / 1.5));
  const levelTime = 28 + state.level * 6;

  state.cols = cols;
  state.rows = rows;
  state.player = { x: 0, y: 0 };
  state.exit = { x: cols - 1, y: rows - 1 };
  state.grid = createMaze(cols, rows);
  state.disks = pickDisks(cols, rows, disksTotal);
  state.disksCollected = 0;
  state.levelTime = levelTime;
  state.deadline = performance.now() + levelTime * 1000;
  state.active = true;

  renderMaze();
  renderHud();
  setStatus(`Shift ${state.level} active — collect all ${state.disks.size} disks, then reach exit.`);

  clearInterval(timerId);
  timerId = setInterval(tick, 100);
}

function renderMaze() {
  mazeEl.innerHTML = '';
  mazeEl.style.setProperty('--cols', String(state.cols));

  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const cell = document.createElement('div');
      const walls = state.grid[y][x];
      cell.className = 'cell';

      if (walls & WALL.N) cell.classList.add('wall-n');
      if (walls & WALL.E) cell.classList.add('wall-e');
      if (walls & WALL.S) cell.classList.add('wall-s');
      if (walls & WALL.W) cell.classList.add('wall-w');

      if (x === state.exit.x && y === state.exit.y) cell.classList.add('exit');
      if (state.disks.has(`${x},${y}`)) cell.classList.add('disk');
      if (x === state.player.x && y === state.player.y) cell.classList.add('player');

      cell.dataset.x = x;
      cell.dataset.y = y;
      mazeEl.appendChild(cell);
    }
  }
}

function renderHud() {
  levelEl.textContent = state.level;
  scoreEl.textContent = state.score;
  disksEl.textContent = `${state.disksCollected}/${state.disks.size + state.disksCollected}`;

  const msLeft = Math.max(0, state.deadline - performance.now());
  timeEl.textContent = `${(msLeft / 1000).toFixed(1)}s`;
}

function setStatus(text) {
  statusEl.innerHTML = text;
}

function cellAt(x, y) {
  return mazeEl.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
}

function ping(freq = 420, dur = 0.05, type = 'square', gain = 0.03) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + dur);
  } catch {
    // silent fallback
  }
}

function move(dirKey) {
  if (!state?.active) return;
  const dir = DIRS[dirKey];
  if (!dir) return;

  const { x, y } = state.player;
  const walls = state.grid[y][x];
  if (walls & dir.bit) {
    ping(130, 0.03, 'sawtooth', 0.015);
    return;
  }

  const nx = x + dir.dx;
  const ny = y + dir.dy;
  state.player = { x: nx, y: ny };

  const oldCell = cellAt(x, y);
  const newCell = cellAt(nx, ny);
  oldCell?.classList.remove('player');
  newCell?.classList.add('player');

  const key = `${nx},${ny}`;
  if (state.disks.has(key)) {
    state.disks.delete(key);
    state.disksCollected += 1;
    state.score += 120;
    newCell?.classList.remove('disk');
    ping(760, 0.08, 'triangle', 0.05);
  } else {
    ping(320, 0.02, 'square', 0.015);
  }

  const done = state.disks.size === 0 && nx === state.exit.x && ny === state.exit.y;
  if (done) {
    completeLevel();
  } else if (state.disks.size === 0) {
    setStatus('All disks loaded — head for the glowing exit crate!');
  }

  renderHud();
}

function completeLevel() {
  const bonus = Math.floor(Math.max(0, state.deadline - performance.now()) / 120);
  state.score += 200 + bonus;
  state.active = false;
  clearInterval(timerId);
  ping(980, 0.08, 'square', 0.05);
  ping(1320, 0.1, 'triangle', 0.05);

  const best = Number(localStorage.getItem('trackball-best') || 0);
  if (state.score > best) {
    localStorage.setItem('trackball-best', String(state.score));
    bestEl.textContent = state.score;
  }

  setStatus(`Shift ${state.level} clear! +${200 + bonus} bonus. Preparing next maze...`);
  renderHud();

  state.level += 1;
  setTimeout(loadLevel, 900);
}

function failRun() {
  state.active = false;
  clearInterval(timerId);
  ping(110, 0.15, 'sawtooth', 0.04);

  const best = Number(localStorage.getItem('trackball-best') || 0);
  if (state.score > best) {
    localStorage.setItem('trackball-best', String(state.score));
    bestEl.textContent = state.score;
  }

  setStatus(`Time up. Final score: <b>${state.score}</b>. Hit <b>Restart Run</b> to try again.`);
}

function tick() {
  if (!state?.active) return;
  renderHud();
  if (performance.now() >= state.deadline) {
    timeEl.textContent = '0.0s';
    failRun();
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (!DIRS[key]) return;
  event.preventDefault();
  move(key);
});

startBtn.addEventListener('click', () => startRun(true));
restartBtn.addEventListener('click', () => startRun(true));

bestEl.textContent = Number(localStorage.getItem('trackball-best') || 0);
