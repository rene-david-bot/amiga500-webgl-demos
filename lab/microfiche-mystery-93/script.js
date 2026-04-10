const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

const caseIdEl = document.getElementById('caseId');
const scoreEl = document.getElementById('score');
const solvedEl = document.getElementById('solved');
const timerEl = document.getElementById('timer');
const clarityEl = document.getElementById('clarity');
const statusEl = document.getElementById('status');

const layerButtons = [...document.querySelectorAll('.layer-btn')];
const nudgeButtons = [...document.querySelectorAll('.nudge')];
const lockBtn = document.getElementById('lockBtn');
const scrambleBtn = document.getElementById('scrambleBtn');

const WORDS = [
  'NOVA', 'ORBIT', 'PHOTON', 'VECTOR', 'AURORA', 'GAMMA',
  'TITAN', 'CIPHER', 'LASER', 'ZENITH', 'COSMOS', 'CRYPT'
];
const LAYERS = [
  { name: 'Layer A', color: '#4cf0ff' },
  { name: 'Layer B', color: '#ff47f6' },
  { name: 'Layer C', color: '#ffd067' }
];

const state = {
  caseNo: 1,
  solved: 0,
  score: 0,
  timeLeft: 75,
  activeLayer: 0,
  word: 'NOVA',
  offsets: LAYERS.map(() => ({ x: 0, y: 0 })),
  caseStartMs: performance.now(),
  lastFrameMs: performance.now(),
  gameOver: false,
  pendingCaseTimer: null,
  flashMs: 0
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomOffset() {
  let x = 0;
  let y = 0;
  while (Math.abs(x) + Math.abs(y) < 4) {
    x = randInt(-8, 8);
    y = randInt(-8, 8);
  }
  return { x, y };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clarityPercent() {
  const error = state.offsets.reduce((sum, p) => sum + Math.abs(p.x) + Math.abs(p.y), 0);
  return clamp(100 - error * 4, 0, 100);
}

function isPerfectAlign() {
  return state.offsets.every((p) => p.x === 0 && p.y === 0);
}

function updateHUD() {
  caseIdEl.textContent = `#${String(state.caseNo).padStart(2, '0')}`;
  scoreEl.textContent = `${state.score}`;
  solvedEl.textContent = `${state.solved}`;
  timerEl.textContent = `${state.timeLeft.toFixed(1)}s`;
  clarityEl.textContent = `${Math.round(clarityPercent())}%`;

  timerEl.style.color = state.timeLeft <= 15 ? '#ff7f9f' : '#e9edff';
  clarityEl.style.color = clarityPercent() >= 85 ? '#98ffc7' : '#ffd067';

  layerButtons.forEach((btn, idx) => {
    btn.classList.toggle('active', idx === state.activeLayer);
  });
}

function setStatus(text, flash = false) {
  statusEl.textContent = text;
  if (flash) {
    state.flashMs = 260;
  }
}

function nextCase() {
  if (state.gameOver) return;
  const pick = WORDS[randInt(0, WORDS.length - 1)];
  state.word = pick;
  state.offsets = state.offsets.map(() => randomOffset());
  state.caseStartMs = performance.now();
  setStatus(`Case ${state.caseNo}: align all layers and lock the decode.`);
  updateHUD();
}

function drawBackground() {
  const { width: w, height: h } = stage;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0d1022');
  g.addColorStop(0.55, '#090b15');
  g.addColorStop(1, '#130a14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(92,108,170,0.17)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
}

function drawTextLayer(offset, color) {
  const cx = stage.width * 0.5;
  const cy = stage.height * 0.5;

  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 132px "Arial Black", "Impact", sans-serif';
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = `${color}cc`;
  ctx.fillText(state.word, cx, cy);
  ctx.restore();
}

function drawStage() {
  drawBackground();

  const cx = stage.width * 0.5;
  const cy = stage.height * 0.5;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 132px "Arial Black", "Impact", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillText(state.word, cx, cy);
  ctx.restore();

  LAYERS.forEach((layer, i) => {
    drawTextLayer(state.offsets[i], layer.color);
  });

  ctx.fillStyle = '#d9dfff';
  ctx.font = '700 22px "Courier New", monospace';
  ctx.fillText(`CASE ${String(state.caseNo).padStart(2, '0')}`, 20, 32);

  ctx.fillStyle = '#aeb8ff';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('MICROFICHE ALIGNMENT TERMINAL', 20, stage.height - 20);

  for (let y = 0; y < stage.height; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, stage.width, 1);
  }

  ctx.strokeStyle = 'rgba(130,150,240,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, stage.width - 20, stage.height - 20);

  if (state.flashMs > 0) {
    const a = Math.min(0.4, state.flashMs / 380);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(0, 0, stage.width, stage.height);
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(4,6,12,0.74)';
    ctx.fillRect(0, 0, stage.width, stage.height);
    ctx.fillStyle = '#ffd067';
    ctx.textAlign = 'center';
    ctx.font = '700 56px "Arial Black", sans-serif';
    ctx.fillText('ARCHIVE LOCKDOWN', cx, cy - 20);
    ctx.fillStyle = '#e9edff';
    ctx.font = '700 28px "Courier New", monospace';
    ctx.fillText(`Final Score: ${state.score}`, cx, cy + 28);
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Press Scramble Case to restart.', cx, cy + 62);
  }
}

function handleSolve() {
  const timeSpentMs = performance.now() - state.caseStartMs;
  const bonus = Math.max(80, Math.floor(260 - timeSpentMs / 18));
  state.score += bonus;
  state.solved += 1;
  state.caseNo += 1;
  state.timeLeft = Math.min(99, state.timeLeft + 10);
  setStatus(`Decode locked. +${bonus} score, +10s`, true);
  updateHUD();

  clearTimeout(state.pendingCaseTimer);
  state.pendingCaseTimer = setTimeout(() => {
    if (!state.gameOver) nextCase();
  }, 700);
}

function lockDecode() {
  if (state.gameOver) {
    restartGame();
    return;
  }
  if (isPerfectAlign()) {
    handleSolve();
  } else {
    state.timeLeft = Math.max(0, state.timeLeft - 5);
    setStatus('Signal drift detected. Lock rejected (-5s).', true);
    updateHUD();
  }
}

function scrambleCase() {
  if (state.gameOver) {
    restartGame();
    return;
  }
  state.timeLeft = Math.max(0, state.timeLeft - 3);
  state.offsets = state.offsets.map(() => randomOffset());
  setStatus('Case scrambled. Re-align layers (-3s).');
  updateHUD();
}

function nudge(dx, dy) {
  if (state.gameOver) return;
  const p = state.offsets[state.activeLayer];
  p.x = clamp(p.x + dx, -12, 12);
  p.y = clamp(p.y + dy, -12, 12);

  const clarity = Math.round(clarityPercent());
  if (clarity > 96) {
    setStatus('Clarity above 96%. Finalize with Lock Decode.');
  } else {
    setStatus('Fine-tune the active layer to sharpen the codename.');
  }
  updateHUD();
}

function restartGame() {
  clearTimeout(state.pendingCaseTimer);
  state.caseNo = 1;
  state.solved = 0;
  state.score = 0;
  state.timeLeft = 75;
  state.activeLayer = 0;
  state.gameOver = false;
  state.lastFrameMs = performance.now();
  setStatus('New shift started. Stabilize the first case.');
  nextCase();
}

function bind() {
  layerButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeLayer = Number(btn.dataset.layer);
      updateHUD();
    });
  });

  nudgeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      nudge(Number(btn.dataset.dx), Number(btn.dataset.dy));
    });
  });

  lockBtn.addEventListener('click', lockDecode);
  scrambleBtn.addEventListener('click', scrambleCase);

  window.addEventListener('keydown', (ev) => {
    if (ev.key === '1' || ev.key === '2' || ev.key === '3') {
      state.activeLayer = Number(ev.key) - 1;
      updateHUD();
      return;
    }

    if (ev.key === 'ArrowUp') { ev.preventDefault(); nudge(0, -1); }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); nudge(0, 1); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); nudge(-1, 0); }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); nudge(1, 0); }
    if (ev.key === 'Enter') { ev.preventDefault(); lockDecode(); }
  });
}

function tick(now) {
  const dt = (now - state.lastFrameMs) / 1000;
  state.lastFrameMs = now;

  if (!state.gameOver) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.gameOver = true;
      setStatus('Archive lockdown triggered. Scramble to restart.');
    }
  }

  if (state.flashMs > 0) {
    state.flashMs = Math.max(0, state.flashMs - (dt * 1000));
  }

  updateHUD();
  drawStage();
  requestAnimationFrame(tick);
}

bind();
nextCase();
requestAnimationFrame((ts) => {
  state.lastFrameMs = ts;
  tick(ts);
});
