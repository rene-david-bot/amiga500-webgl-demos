const COLS = 8;
const ROWS = 14;
const CELL = 36;
const BEST_KEY = 'retro_night_shift_stacker_best';

const COLORS = [
  { fill: '#6ff4ff', glow: 'rgba(111, 244, 255, 0.5)' },
  { fill: '#ff7ec8', glow: 'rgba(255, 126, 200, 0.45)' },
  { fill: '#ffd883', glow: 'rgba(255, 216, 131, 0.45)' },
  { fill: '#89ffbc', glow: 'rgba(137, 255, 188, 0.42)' },
  { fill: '#b792ff', glow: 'rgba(183, 146, 255, 0.45)' }
];

const gameCanvas = document.getElementById('game');
const g = gameCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const ng = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

let audioCtx = null;
let muted = false;

let board = [];
let piece = null;
let nextPiece = null;

let score = 0;
let lines = 0;
let level = 1;
let best = Number(localStorage.getItem(BEST_KEY) || 0);
let dropMs = 580;
let specialCounter = 0;

let running = false;
let paused = false;
let gameOver = false;
let accumulator = 0;
let lastTime = performance.now();

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function blip(freq = 440, dur = 0.08, type = 'square', gainValue = 0.03, start = 0) {
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function makePiece() {
  specialCounter += 1;
  const special = specialCounter % 9 === 0;
  return {
    x: Math.floor(COLS / 2),
    y: -1,
    color: randInt(COLORS.length),
    special
  };
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropMs = 580;
  accumulator = 0;
  specialCounter = 0;
  paused = false;
  gameOver = false;
  running = true;

  piece = makePiece();
  nextPiece = makePiece();

  renderNext();
  updateHud();
  setStatus('Shift live. Keep the stack below the warning line.');
}

function canPlace(x, y) {
  if (x < 0 || x >= COLS || y >= ROWS) return false;
  if (y < 0) return true;
  return board[y][x] === null;
}

function lockPiece() {
  if (!piece) return;

  if (piece.special) {
    blast(piece.x, piece.y);
    blip(180, 0.08, 'sawtooth', 0.035);
    blip(120, 0.12, 'triangle', 0.03, 0.05);
  } else {
    if (piece.y < 0) {
      endGame();
      return;
    }
    board[piece.y][piece.x] = { color: piece.color, special: false };
    blip(320, 0.05, 'triangle', 0.02);
  }

  const cleared = clearRows();
  if (cleared > 0) {
    const bonusTable = [0, 120, 300, 520, 820];
    score += bonusTable[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 8) + 1;
    dropMs = Math.max(130, 580 - (level - 1) * 38);
    blip(620, 0.08, 'square', 0.03);
    blip(780, 0.1, 'triangle', 0.03, 0.08);
    setStatus(`Row clear x${cleared}. Conveyor speed increased.`);
  }

  piece = nextPiece;
  nextPiece = makePiece();
  renderNext();

  if (!canPlace(piece.x, piece.y + 1) && piece.y < 0) {
    endGame();
    return;
  }

  updateHud();
}

function blast(cx, cy) {
  let removed = 0;
  for (let y = cy - 1; y <= cy + 1; y += 1) {
    for (let x = cx - 1; x <= cx + 1; x += 1) {
      if (y < 0 || y >= ROWS || x < 0 || x >= COLS) continue;
      if (board[y][x]) {
        board[y][x] = null;
        removed += 1;
      }
    }
  }
  score += 70 + removed * 22;
  setStatus(`Volatile crate detonated. Cleared ${removed} cargo cells.`);
}

function clearRows() {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  return cleared;
}

function move(dx) {
  if (!running || paused || gameOver) return;
  const nx = piece.x + dx;
  if (canPlace(nx, piece.y)) {
    piece.x = nx;
    blip(440, 0.03, 'square', 0.012);
  }
}

function dropStep(manual = false) {
  if (!running || paused || gameOver) return;

  const ny = piece.y + 1;
  if (canPlace(piece.x, ny)) {
    piece.y = ny;
    if (manual) score += 1;
    return;
  }

  lockPiece();
}

function hardDrop() {
  if (!running || paused || gameOver) return;
  let travel = 0;
  while (canPlace(piece.x, piece.y + 1)) {
    piece.y += 1;
    travel += 1;
  }
  score += travel * 2;
  lockPiece();
}

function updateHud() {
  scoreEl.textContent = String(score).padStart(6, '0');
  levelEl.textContent = String(level);
  linesEl.textContent = String(lines);
  bestEl.textContent = String(best).padStart(6, '0');
}

function endGame() {
  gameOver = true;
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }
  updateHud();
  blip(160, 0.15, 'sawtooth', 0.03);
  blip(120, 0.2, 'triangle', 0.03, 0.1);
  setStatus('Stack overflow. Shift failed. Press Start Shift to run it back.');
}

function togglePause() {
  if (gameOver || !running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  setStatus(paused ? 'Shift paused. Press P or Resume.' : 'Shift resumed. Keep stacking.');
}

function drawCell(ctx, x, y, colorIndex, special = false, size = CELL) {
  const palette = COLORS[colorIndex] || COLORS[0];
  const px = x * size;
  const py = y * size;

  ctx.save();
  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = palette.fill;
  ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(15, 24, 52, 0.65)';
  ctx.strokeRect(px + 3, py + 3, size - 6, size - 6);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(px + 6, py + 6, size - 14, 4);

  if (special) {
    ctx.fillStyle = 'rgba(7, 13, 30, 0.78)';
    ctx.fillRect(px + 9, py + 9, size - 18, size - 18);
    ctx.fillStyle = '#ffef9a';
    ctx.font = `${Math.floor(size * 0.45)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', px + size / 2, py + size / 2 + 1);
  }
  ctx.restore();
}

function renderBoard() {
  g.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  const bg = g.createLinearGradient(0, 0, 0, gameCanvas.height);
  bg.addColorStop(0, '#0a1230');
  bg.addColorStop(1, '#060b1d');
  g.fillStyle = bg;
  g.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = board[y][x];
      if (cell) drawCell(g, x, y, cell.color, cell.special, CELL);
    }
  }

  if (piece && piece.y >= -1 && !gameOver) {
    if (piece.y >= 0) drawCell(g, piece.x, piece.y, piece.color, piece.special, CELL);

    let ghostY = piece.y;
    while (canPlace(piece.x, ghostY + 1)) ghostY += 1;
    if (ghostY >= 0) {
      g.save();
      g.fillStyle = 'rgba(170, 198, 255, 0.14)';
      g.fillRect(piece.x * CELL + 6, ghostY * CELL + 6, CELL - 12, CELL - 12);
      g.restore();
    }
  }

  g.strokeStyle = 'rgba(129, 161, 230, 0.15)';
  g.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    g.beginPath();
    g.moveTo(x * CELL + 0.5, 0);
    g.lineTo(x * CELL + 0.5, ROWS * CELL);
    g.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    g.beginPath();
    g.moveTo(0, y * CELL + 0.5);
    g.lineTo(COLS * CELL, y * CELL + 0.5);
    g.stroke();
  }

  const warnY = 2 * CELL;
  g.strokeStyle = 'rgba(255, 120, 200, 0.45)';
  g.setLineDash([6, 5]);
  g.beginPath();
  g.moveTo(0, warnY + 0.5);
  g.lineTo(COLS * CELL, warnY + 0.5);
  g.stroke();
  g.setLineDash([]);
}

function renderNext() {
  ng.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  ng.fillStyle = '#081329';
  ng.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) return;

  const size = 48;
  const x = 1;
  const y = 1;
  drawCell(ng, x, y, nextPiece.color, nextPiece.special, size);
}

function gameLoop(now) {
  const dt = Math.min(now - lastTime, 64);
  lastTime = now;

  if (running && !paused && !gameOver) {
    accumulator += dt;
    if (accumulator >= dropMs) {
      accumulator = 0;
      dropStep(false);
    }
  }

  renderBoard();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (event) => {
  const key = event.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'p', 'P', 'r', 'R'].includes(key)) {
    event.preventDefault();
  }

  if (key === 'ArrowLeft') move(-1);
  if (key === 'ArrowRight') move(1);
  if (key === 'ArrowDown') dropStep(true);
  if (key === ' ') hardDrop();
  if (key === 'p' || key === 'P') togglePause();
  if (key === 'r' || key === 'R') {
    initAudio();
    resetGame();
    pauseBtn.textContent = 'Pause';
  }

  if (running && !muted) initAudio();
});

startBtn.addEventListener('click', () => {
  initAudio();
  resetGame();
  pauseBtn.textContent = 'Pause';
  blip(520, 0.08, 'triangle', 0.03);
  blip(680, 0.08, 'square', 0.025, 0.08);
});

pauseBtn.addEventListener('click', () => {
  initAudio();
  togglePause();
  blip(paused ? 240 : 420, 0.05, 'square', 0.02);
});

resetBtn.addEventListener('click', () => {
  initAudio();
  resetGame();
  pauseBtn.textContent = 'Pause';
  blip(420, 0.06, 'triangle', 0.025);
});

bestEl.textContent = String(best).padStart(6, '0');
board = createBoard();
renderBoard();
renderNext();
requestAnimationFrame((ts) => {
  lastTime = ts;
  gameLoop(ts);
});
