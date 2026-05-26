const SHIFT_SECONDS = 90;
const MAX_MISSES = 6;
const LANES_Y = [74, 154, 234];
const ITEM_COLORS = ['#ff8aa6', '#8df1ff', '#ffd882', '#b3ff91', '#bba6ff', '#ffb97a'];
const ITEM_NAMES = ['SODA', 'CHIPS', 'PIZZA', 'SOAP', 'CEREAL', 'JUICE', 'GUM', 'NOODLES', 'COOKIES', 'RADIO'];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const timeEl = document.getElementById('time');
const scannedEl = document.getElementById('scanned');
const missedEl = document.getElementById('missed');
const comboEl = document.getElementById('combo');
const scoreEl = document.getElementById('score');
const shiftStateEl = document.getElementById('shiftState');
const paceEl = document.getElementById('pace');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startBtn');
const scanBtn = document.getElementById('scanBtn');

const state = {
  running: false,
  timeLeft: SHIFT_SECONDS,
  scanned: 0,
  missed: 0,
  combo: 0,
  score: 0,
  items: [],
  itemId: 0,
  spawnTimer: 0,
  beltOffset: 0,
  raf: null,
  lastTs: 0,
  audioCtx: null
};

const scanner = {
  x: canvas.width * 0.68,
  halfWindow: 44
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function setStatus(text, kind = '') {
  statusEl.innerHTML = text;
  statusEl.classList.remove('ok', 'bad');
  if (kind) statusEl.classList.add(kind);
}

function updateHud() {
  timeEl.textContent = `${Math.max(0, Math.ceil(state.timeLeft))}s`;
  scannedEl.textContent = String(state.scanned);
  missedEl.textContent = `${state.missed} / ${MAX_MISSES}`;
  comboEl.textContent = `x${state.combo}`;
  scoreEl.textContent = String(state.score);
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function tone(freq, duration = 0.09, gain = 0.06, type = 'square') {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playScanFx(accuracy) {
  const root = 240 + accuracy * 280;
  tone(root, 0.06, 0.05, 'square');
  setTimeout(() => tone(root * 1.26, 0.08, 0.055, 'triangle'), 55);
}

function playMissFx() {
  tone(120, 0.12, 0.07, 'sawtooth');
  setTimeout(() => tone(85, 0.14, 0.06, 'sawtooth'), 75);
}

function getPace() {
  const progress = 1 - state.timeLeft / SHIFT_SECONDS;
  return 1 + progress * 0.85;
}

function updatePaceLabel() {
  const pace = getPace();
  let label = "Lane pace: warm-up";
  if (pace > 1.2) label = 'Lane pace: dinner rush';
  if (pace > 1.45) label = 'Lane pace: panic mode';
  if (pace > 1.7) label = 'Lane pace: barcode storm';
  paceEl.textContent = label;
}

function spawnItem() {
  const pace = getPace();
  const width = randInt(94, 126);
  const height = 56;
  const laneY = LANES_Y[randInt(0, LANES_Y.length - 1)];
  const barcodeX = randInt(Math.floor(width * 0.42), Math.floor(width * 0.73));
  const barcodeWidth = randInt(18, 26);

  const item = {
    id: state.itemId++,
    x: canvas.width + randInt(10, 180),
    y: laneY,
    w: width,
    h: height,
    speed: rand(160, 210) * pace,
    color: ITEM_COLORS[randInt(0, ITEM_COLORS.length - 1)],
    label: ITEM_NAMES[randInt(0, ITEM_NAMES.length - 1)],
    sku: `${randInt(10, 99)}-${randInt(100, 999)}`,
    barcodeX,
    barcodeWidth
  };

  state.items.push(item);
}

function removeItemById(id) {
  const idx = state.items.findIndex((item) => item.id === id);
  if (idx >= 0) state.items.splice(idx, 1);
}

function registerMiss(reason, fromWhiff = false) {
  if (!state.running) return;

  state.missed += 1;
  state.combo = 0;
  if (fromWhiff) {
    state.score = Math.max(0, state.score - 20);
  }

  setStatus(reason, 'bad');
  updateHud();

  if (state.missed >= MAX_MISSES) {
    finishShift(false);
  }
}

function scanAttempt() {
  if (!state.running) return;
  ensureAudio();

  let best = null;

  for (const item of state.items) {
    const barcodeCenter = item.x + item.barcodeX + item.barcodeWidth / 2;
    const distance = Math.abs(barcodeCenter - scanner.x);
    if (distance <= scanner.halfWindow) {
      if (!best || distance < best.distance) {
        best = { item, distance };
      }
    }
  }

  if (!best) {
    playMissFx();
    registerMiss('Scanner whiffed. No barcode in lane.', true);
    return;
  }

  const accuracy = Math.max(0, 1 - best.distance / scanner.halfWindow);
  const points = Math.round(75 + accuracy * 125 + state.combo * 9);

  state.score += points;
  state.scanned += 1;
  state.combo += 1;

  removeItemById(best.item.id);
  playScanFx(accuracy);

  if (accuracy > 0.87) {
    setStatus(`Perfect beep! +${points} points.`, 'ok');
  } else if (accuracy > 0.55) {
    setStatus(`Clean scan +${points}. Keep it moving.`, 'ok');
  } else {
    setStatus(`Messy edge scan +${points}, but it counts.`, '');
  }

  updateHud();
}

function updateItems(dt) {
  for (const item of state.items) {
    item.x -= item.speed * dt;
  }

  const escaped = state.items.filter((item) => item.x + item.w < -8);
  if (escaped.length) {
    state.items = state.items.filter((item) => item.x + item.w >= -8);
    escaped.forEach(() => registerMiss('A product rolled past unscanned.'));
  }
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBackground(dt) {
  state.beltOffset = (state.beltOffset + dt * 160) % 44;

  ctx.fillStyle = '#0c152a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 44, 0, canvas.height - 30);
  gradient.addColorStop(0, '#1b2846');
  gradient.addColorStop(1, '#0b1121');
  ctx.fillStyle = gradient;
  ctx.fillRect(20, 40, canvas.width - 40, canvas.height - 80);

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let x = -44 + state.beltOffset; x < canvas.width; x += 44) {
    ctx.fillRect(x, 266, 22, 8);
  }

  ctx.fillStyle = 'rgba(99,242,255,0.17)';
  ctx.fillRect(scanner.x - scanner.halfWindow, 48, scanner.halfWindow * 2, canvas.height - 96);

  ctx.strokeStyle = '#63f2ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scanner.x, 48);
  ctx.lineTo(scanner.x, canvas.height - 48);
  ctx.stroke();

  ctx.fillStyle = '#98efff';
  ctx.font = 'bold 14px Trebuchet MS';
  ctx.fillText('SCAN LANE', scanner.x - 36, 38);
}

function drawItem(item) {
  drawRoundedRect(item.x, item.y, item.w, item.h, 9);
  ctx.fillStyle = item.color;
  ctx.fill();

  ctx.strokeStyle = 'rgba(8, 20, 36, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.fillRect(item.x + 8, item.y + 8, item.w - 16, 16);

  ctx.fillStyle = '#e6eeff';
  ctx.font = 'bold 12px Trebuchet MS';
  ctx.fillText(item.label, item.x + 12, item.y + 20);

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(item.x + item.barcodeX, item.y + 30, item.barcodeWidth, 20);

  for (let i = 0; i < 8; i += 1) {
    const xx = item.x + item.barcodeX + 2 + i * 2;
    const h = 14 + ((i * 7 + item.id) % 6);
    ctx.fillStyle = i % 2 ? '#f7f9ff' : '#111a2d';
    ctx.fillRect(xx, item.y + 32, 1, h);
  }

  ctx.fillStyle = '#111a2d';
  ctx.font = '10px "Courier New", monospace';
  ctx.fillText(item.sku, item.x + 8, item.y + item.h - 8);
}

function drawScene(dt) {
  drawBackground(dt);

  for (const item of state.items) {
    drawItem(item);
  }
}

function finishShift(laneSaved) {
  if (!state.running) return;

  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);

  scanBtn.disabled = true;
  startBtn.disabled = false;
  startBtn.textContent = 'Restart Shift';

  if (laneSaved) {
    shiftStateEl.textContent = 'Shift complete';
    paceEl.textContent = 'Lane pace: closed';
    setStatus(`Shift done. ${state.scanned} scans, score ${state.score}.`, 'ok');
    ensureAudio();
    tone(392, 0.08, 0.06, 'triangle');
    setTimeout(() => tone(523, 0.1, 0.07, 'triangle'), 90);
    setTimeout(() => tone(659, 0.12, 0.07, 'triangle'), 190);
  } else {
    shiftStateEl.textContent = 'Lane closed by manager';
    paceEl.textContent = 'Lane pace: meltdown';
    setStatus(`Too many misses. Final score ${state.score}.`, 'bad');
    ensureAudio();
    playMissFx();
  }

  updateHud();
}

function tick(ts) {
  if (!state.running) return;

  const dt = Math.min(0.05, (ts - state.lastTs) / 1000 || 0);
  state.lastTs = ts;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    drawScene(dt);
    finishShift(state.missed < MAX_MISSES);
    return;
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnItem();
    state.spawnTimer = rand(0.62, 1.05) / getPace();
  }

  updateItems(dt);
  updatePaceLabel();
  updateHud();
  drawScene(dt);

  state.raf = requestAnimationFrame(tick);
}

function startShift() {
  ensureAudio();

  state.running = true;
  state.timeLeft = SHIFT_SECONDS;
  state.scanned = 0;
  state.missed = 0;
  state.combo = 0;
  state.score = 0;
  state.items = [];
  state.spawnTimer = 0.4;
  state.lastTs = performance.now();

  shiftStateEl.textContent = 'Shift in progress';
  setStatus('Scan each barcode as it crosses the cyan line.', '');
  updatePaceLabel();

  startBtn.disabled = true;
  startBtn.textContent = 'Shift Running';
  scanBtn.disabled = false;

  updateHud();
  drawScene(0);
  state.raf = requestAnimationFrame(tick);
}

startBtn.addEventListener('click', startShift);
scanBtn.addEventListener('click', scanAttempt);
canvas.addEventListener('pointerdown', () => {
  if (state.running) scanAttempt();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    scanAttempt();
  }
});

updateHud();
drawScene(0);
