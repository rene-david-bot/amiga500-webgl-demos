const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');

const wallCountEl = document.getElementById('wallCount');
const stampCountEl = document.getElementById('stampCount');
const inkNameEl = document.getElementById('inkName');
const modeNameEl = document.getElementById('modeName');
const hintEl = document.getElementById('hint');

const wallToolBtn = document.getElementById('wallTool');
const eraseToolBtn = document.getElementById('eraseTool');
const stampBtns = [...document.querySelectorAll('.stampBtn')];

const inkSelect = document.getElementById('inkSelect');
const fxBtn = document.getElementById('fxBtn');
const undoBtn = document.getElementById('undoBtn');
const templateBtn = document.getElementById('templateBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');

const GRID = 32;
const HISTORY_LIMIT = 100;

const palettes = {
  cyan: { line: '#76f5ff', glow: 'rgba(118,245,255,0.45)', accent: '#cffeff' },
  mint: { line: '#96ffc1', glow: 'rgba(150,255,193,0.45)', accent: '#e5ffef' },
  amber: { line: '#ffd889', glow: 'rgba(255,216,137,0.45)', accent: '#fff1cf' },
  magenta: { line: '#ff87d2', glow: 'rgba(255,135,210,0.45)', accent: '#ffd7ee' }
};

let ink = 'cyan';
let mode = 'wall';
let stampType = 'desk';
let fxOn = true;

let walls = [];
let stamps = [];
let history = [];

let dragStart = null;
let dragEnd = null;
let pointerDown = false;
let lastEraseKey = '';

let audioCtx = null;

function snap(n) {
  return Math.max(0, Math.min(canvas.width, Math.round(n / GRID) * GRID));
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function normalizeWall(start, end, lockAxis = false) {
  let x1 = start.x;
  let y1 = start.y;
  let x2 = end.x;
  let y2 = end.y;

  if (lockAxis || Math.abs(x2 - x1) !== Math.abs(y2 - y1)) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    if (dx >= dy) y2 = y1;
    else x2 = x1;
  }

  return { x1, y1, x2, y2 };
}

function updateHud() {
  wallCountEl.textContent = String(walls.length);
  stampCountEl.textContent = String(stamps.length);
  inkNameEl.textContent = ink[0].toUpperCase() + ink.slice(1);
  modeNameEl.textContent = mode === 'wall' ? 'Wall' : mode === 'erase' ? 'Erase' : `Stamp: ${stampType}`;
  undoBtn.disabled = history.length === 0;
}

function setHint(text) {
  hintEl.textContent = text;
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 480, duration = 0.06, type = 'square', gainValue = 0.03, offset = 0) {
  if (!fxOn) return;
  initAudio();
  const now = audioCtx.currentTime + offset;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playSound(kind) {
  if (kind === 'draw') {
    beep(640, 0.05, 'square', 0.03);
    beep(860, 0.06, 'triangle', 0.02, 0.04);
  } else if (kind === 'stamp') {
    beep(500, 0.05, 'triangle', 0.03);
    beep(740, 0.05, 'square', 0.02, 0.03);
  } else if (kind === 'erase') {
    beep(260, 0.08, 'sawtooth', 0.02);
  } else if (kind === 'action') {
    beep(420, 0.05, 'triangle', 0.025);
    beep(560, 0.05, 'triangle', 0.02, 0.04);
  }
}

function deepCloneState() {
  return {
    walls: walls.map((w) => ({ ...w })),
    stamps: stamps.map((s) => ({ ...s }))
  };
}

function pushHistory() {
  history.push(deepCloneState());
  if (history.length > HISTORY_LIMIT) history.shift();
  updateHud();
}

function restoreState(state) {
  walls = state.walls.map((w) => ({ ...w }));
  stamps = state.stamps.map((s) => ({ ...s }));
  draw();
  updateHud();
}

function drawGrid() {
  ctx.fillStyle = '#060d22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(111, 149, 232, 0.2)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(142, 180, 255, 0.38)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}

function drawWalls() {
  const palette = palettes[ink];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  walls.forEach((wall) => {
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(18, 27, 57, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();
  });
}

function drawDesk(x, y, p) {
  ctx.fillStyle = p.line;
  ctx.fillRect(x - 18, y - 12, 36, 20);
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - 10, y + 10, 20, 8);
}

function drawTerminal(x, y, p) {
  ctx.fillStyle = p.line;
  ctx.fillRect(x - 15, y - 14, 30, 22);
  ctx.fillStyle = '#052934';
  ctx.fillRect(x - 11, y - 10, 22, 12);
  ctx.fillStyle = p.accent;
  ctx.fillRect(x - 6, y + 10, 12, 6);
}

function drawDoor(x, y, p) {
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 12);
  ctx.lineTo(x + 12, y + 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x - 12, y + 12, 24, Math.PI * 1.5, Math.PI * 2);
  ctx.stroke();
}

function drawPlant(x, y, p) {
  ctx.fillStyle = p.line;
  ctx.fillRect(x - 8, y + 7, 16, 10);
  ctx.beginPath();
  ctx.arc(x, y + 2, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(x - 4, y - 1, 3, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 1, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawStamps() {
  const p = palettes[ink];
  stamps.forEach((item) => {
    ctx.shadowColor = p.glow;
    ctx.shadowBlur = 10;
    if (item.type === 'desk') drawDesk(item.x, item.y, p);
    else if (item.type === 'terminal') drawTerminal(item.x, item.y, p);
    else if (item.type === 'door') drawDoor(item.x, item.y, p);
    else drawPlant(item.x, item.y, p);
    ctx.shadowBlur = 0;
  });
}

function drawPreview() {
  if (!dragStart || !dragEnd || mode !== 'wall') return;
  const p = palettes[ink];
  const wall = normalizeWall(dragStart, dragEnd, true);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(wall.x1, wall.y1);
  ctx.lineTo(wall.x2, wall.y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function draw() {
  drawGrid();
  drawWalls();
  drawStamps();
  drawPreview();
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const lx = x1 + t * dx;
  const ly = y1 + t * dy;
  return Math.hypot(px - lx, py - ly);
}

function removeAt(point) {
  for (let i = walls.length - 1; i >= 0; i -= 1) {
    const w = walls[i];
    if (pointToSegmentDistance(point.x, point.y, w.x1, w.y1, w.x2, w.y2) < 14) {
      pushHistory();
      walls.splice(i, 1);
      playSound('erase');
      draw();
      updateHud();
      return true;
    }
  }

  for (let i = stamps.length - 1; i >= 0; i -= 1) {
    const s = stamps[i];
    if (Math.abs(point.x - s.x) <= 16 && Math.abs(point.y - s.y) <= 16) {
      pushHistory();
      stamps.splice(i, 1);
      playSound('erase');
      draw();
      updateHud();
      return true;
    }
  }
  return false;
}

function placeStamp(point) {
  pushHistory();
  stamps.push({ x: point.x, y: point.y, type: stampType });
  playSound('stamp');
  draw();
  updateHud();
}

function setMode(nextMode) {
  mode = nextMode;
  wallToolBtn.classList.toggle('active', mode === 'wall');
  eraseToolBtn.classList.toggle('active', mode === 'erase');
  stampBtns.forEach((btn) => btn.classList.toggle('active', mode === 'stamp' && btn.dataset.stamp === stampType));

  if (mode === 'wall') setHint('Wall mode: drag to draw snapped lines. Hold Shift for horizontal/vertical lock.');
  else if (mode === 'erase') setHint('Erase mode: click or drag over walls/stamps to remove pieces.');
  else setHint(`Stamp mode: place ${stampType} icons on the grid. Click to stamp.`);

  updateHud();
}

function setStamp(type) {
  stampType = type;
  setMode('stamp');
}

function commitWall(start, end, forceLockAxis = false) {
  const wall = normalizeWall(start, end, forceLockAxis);
  if (wall.x1 === wall.x2 && wall.y1 === wall.y2) return false;
  pushHistory();
  walls.push(wall);
  playSound('draw');
  draw();
  updateHud();
  return true;
}

function createTemplate() {
  pushHistory();
  walls = [
    { x1: 96, y1: 96, x2: 864, y2: 96 },
    { x1: 864, y1: 96, x2: 864, y2: 544 },
    { x1: 864, y1: 544, x2: 96, y2: 544 },
    { x1: 96, y1: 544, x2: 96, y2: 96 },
    { x1: 352, y1: 96, x2: 352, y2: 544 },
    { x1: 608, y1: 96, x2: 608, y2: 544 },
    { x1: 96, y1: 320, x2: 864, y2: 320 }
  ];
  stamps = [
    { x: 224, y: 192, type: 'desk' },
    { x: 224, y: 256, type: 'desk' },
    { x: 224, y: 384, type: 'terminal' },
    { x: 480, y: 192, type: 'terminal' },
    { x: 480, y: 448, type: 'desk' },
    { x: 736, y: 192, type: 'plant' },
    { x: 736, y: 416, type: 'plant' },
    { x: 608, y: 320, type: 'door' },
    { x: 352, y: 320, type: 'door' }
  ];
  draw();
  updateHud();
  playSound('action');
  setHint('Template loaded: tweak walls, add stamps, then export your blueprint.');
}

function clearAll() {
  pushHistory();
  walls = [];
  stamps = [];
  draw();
  updateHud();
  playSound('action');
  setHint('Blueprint cleared. Build a new floor plan from scratch.');
}

function exportPng() {
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = canvas.toDataURL('image/png');
  a.download = `neon-blueprint-${stamp}.png`;
  a.click();
  playSound('action');
  setHint('Exported PNG to your downloads folder.');
}

canvas.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  canvas.setPointerCapture(e.pointerId);
  const point = getCanvasPoint(e);
  const snapped = { x: snap(point.x), y: snap(point.y) };

  if (mode === 'wall') {
    dragStart = snapped;
    dragEnd = snapped;
  } else if (mode === 'stamp') {
    placeStamp(snapped);
  } else if (mode === 'erase') {
    removeAt(point);
    lastEraseKey = `${snap(point.x)}:${snap(point.y)}`;
  }
  draw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerDown) return;
  const point = getCanvasPoint(e);
  const snapped = { x: snap(point.x), y: snap(point.y) };

  if (mode === 'wall' && dragStart) {
    dragEnd = snapped;
    draw();
    return;
  }

  if (mode === 'erase') {
    const key = `${snap(point.x)}:${snap(point.y)}`;
    if (key !== lastEraseKey) {
      removeAt(point);
      lastEraseKey = key;
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  pointerDown = false;
  canvas.releasePointerCapture(e.pointerId);

  if (mode === 'wall' && dragStart && dragEnd) {
    commitWall(dragStart, dragEnd, e.shiftKey);
  }

  dragStart = null;
  dragEnd = null;
  lastEraseKey = '';
  draw();
});

canvas.addEventListener('pointercancel', () => {
  pointerDown = false;
  dragStart = null;
  dragEnd = null;
  lastEraseKey = '';
  draw();
});

wallToolBtn.addEventListener('click', () => setMode('wall'));
eraseToolBtn.addEventListener('click', () => setMode('erase'));

stampBtns.forEach((btn) => {
  btn.addEventListener('click', () => setStamp(btn.dataset.stamp));
});

inkSelect.addEventListener('change', () => {
  ink = inkSelect.value;
  draw();
  updateHud();
});

fxBtn.addEventListener('click', () => {
  fxOn = !fxOn;
  fxBtn.textContent = fxOn ? 'FX On' : 'FX Off';
  playSound('action');
});

undoBtn.addEventListener('click', () => {
  const state = history.pop();
  if (!state) return;
  restoreState(state);
  playSound('action');
  setHint('Undo applied.');
});

templateBtn.addEventListener('click', createTemplate);
clearBtn.addEventListener('click', clearAll);
exportBtn.addEventListener('click', exportPng);

window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W') setMode('wall');
  else if (e.key === 'e' || e.key === 'E') setMode('erase');
  else if (e.key === '1') setStamp('desk');
  else if (e.key === '2') setStamp('terminal');
  else if (e.key === '3') setStamp('door');
  else if (e.key === '4') setStamp('plant');
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    const state = history.pop();
    if (state) restoreState(state);
  }
});

setMode('wall');
updateHud();
draw();
