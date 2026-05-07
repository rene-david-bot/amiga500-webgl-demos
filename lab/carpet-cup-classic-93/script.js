const BEST_KEY = 'retro_carpet_cup_classic_93_best';
const TOTAL_HOLES = 5;
const ROUND_SECONDS = 150;
const PAR_TOTAL = 15;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const holeEl = document.getElementById('hole');
const strokesEl = document.getElementById('strokes');
const totalEl = document.getElementById('total');
const parEl = document.getElementById('par');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const muteBtn = document.getElementById('muteBtn');

let audioCtx = null;
let muted = false;

const state = {
  running: false,
  hole: 1,
  strokes: 0,
  totalStrokes: 0,
  timeLeft: ROUND_SECONDS,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  ball: { x: 150, y: 430, vx: 0, vy: 0, r: 11 },
  cup: { x: 790, y: 150, r: 16 },
  obstacles: [],
  movers: [],
  aiming: false,
  aimPoint: { x: 0, y: 0 },
  pointerId: null,
  justSank: false,
  messageTimer: 0,
  lastTs: 0,
  flash: 0
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(freq = 440, dur = 0.06, type = 'square', gainValue = 0.02, start = 0) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function setStatus(text, seconds = 1.4) {
  statusEl.textContent = text;
  state.messageTimer = seconds;
}

function updateHud() {
  holeEl.textContent = `${state.hole} / ${TOTAL_HOLES}`;
  strokesEl.textContent = String(state.strokes);
  totalEl.textContent = String(state.totalStrokes);
  parEl.textContent = String(PAR_TOTAL);
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
  bestEl.textContent = state.best > 0 ? `${state.best} strokes` : '--';
}

function circleRectCollision(ball, rect) {
  const nearestX = clamp(ball.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > ball.r * ball.r) return false;

  if (Math.abs(dx) > Math.abs(dy)) {
    ball.vx *= -0.84;
    ball.x = dx > 0 ? rect.x + rect.w + ball.r + 0.1 : rect.x - ball.r - 0.1;
  } else {
    ball.vy *= -0.84;
    ball.y = dy > 0 ? rect.y + rect.h + ball.r + 0.1 : rect.y - ball.r - 0.1;
  }

  return true;
}

function moveBall(dt) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  const friction = Math.pow(0.985, dt * 60);
  b.vx *= friction;
  b.vy *= friction;

  const speed = Math.hypot(b.vx, b.vy);
  if (speed < 4) {
    b.vx = 0;
    b.vy = 0;
  }

  const left = 44 + b.r;
  const right = 916 - b.r;
  const top = 74 + b.r;
  const bottom = 498 - b.r;

  if (b.x < left) {
    b.x = left;
    b.vx *= -0.82;
    beep(380, 0.02, 'triangle', 0.01);
  }
  if (b.x > right) {
    b.x = right;
    b.vx *= -0.82;
    beep(380, 0.02, 'triangle', 0.01);
  }
  if (b.y < top) {
    b.y = top;
    b.vy *= -0.82;
    beep(380, 0.02, 'triangle', 0.01);
  }
  if (b.y > bottom) {
    b.y = bottom;
    b.vy *= -0.82;
    beep(380, 0.02, 'triangle', 0.01);
  }

  for (const rect of state.obstacles) {
    circleRectCollision(b, rect);
  }

  for (const mover of state.movers) {
    mover.t += dt * mover.speed;
    mover.x = mover.baseX + Math.sin(mover.t) * mover.swing;
    circleRectCollision(b, mover);
  }
}

function canShoot() {
  return state.running && !state.justSank && Math.hypot(state.ball.vx, state.ball.vy) < 0.5;
}

function generateHole(index) {
  state.ball.x = 130;
  state.ball.y = 430;
  state.ball.vx = 0;
  state.ball.vy = 0;

  const laneY = [130, 190, 260, 330, 395];
  const cupY = laneY[(index * 2 + 1) % laneY.length];

  state.cup.x = 820;
  state.cup.y = cupY;

  const blockers = [];
  const count = 3 + Math.min(2, index);

  for (let i = 0; i < count; i += 1) {
    const w = rand(54, 120);
    const h = rand(26, 64);
    const x = rand(250, 730 - w);
    const y = rand(104, 454 - h);

    const nearBall = Math.hypot(x - state.ball.x, y - state.ball.y) < 140;
    const nearCup = Math.hypot(x - state.cup.x, y - state.cup.y) < 130;

    if (!nearBall && !nearCup) {
      blockers.push({ x, y, w, h });
    }
  }

  state.obstacles = blockers;

  state.movers = [
    {
      x: 430,
      y: 130 + (index * 60) % 250,
      w: 110,
      h: 18,
      baseX: 430,
      swing: 130,
      t: index * 0.8,
      speed: 1.05 + index * 0.08
    }
  ];

  state.justSank = false;
  state.aiming = false;
  state.pointerId = null;
  state.strokes = 0;
  state.flash = 0;

  updateHud();
}

function startRound() {
  initAudio();
  state.running = true;
  state.hole = 1;
  state.totalStrokes = 0;
  state.timeLeft = ROUND_SECONDS;
  generateHole(1);
  beep(640, 0.05, 'triangle', 0.02);
  beep(840, 0.05, 'square', 0.014, 0.06);
  setStatus('Round live. Drag from the ball to line up your first putt.', 1.8);
}

function resetHole() {
  if (!state.running) return;
  generateHole(state.hole);
  setStatus('Hole reset. Fresh lie on the carpet.', 1.2);
}

function finishRound(win) {
  state.running = false;
  state.aiming = false;
  state.pointerId = null;

  if (win && (state.best === 0 || state.totalStrokes < state.best)) {
    state.best = state.totalStrokes;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  updateHud();

  if (win) {
    const diff = state.totalStrokes - PAR_TOTAL;
    const label = diff <= 0 ? `${Math.abs(diff)} under par` : `${diff} over par`;
    setStatus(`Round cleared in ${state.totalStrokes} strokes, ${label}.`, 3.2);
    beep(760, 0.06, 'triangle', 0.022);
    beep(980, 0.08, 'square', 0.018, 0.07);
  } else {
    setStatus(`Time up. Final score ${state.totalStrokes} strokes.`, 2.8);
    beep(200, 0.12, 'sawtooth', 0.024);
    beep(160, 0.12, 'triangle', 0.016, 0.11);
  }
}

function sinkCup() {
  state.justSank = true;
  state.flash = 0.9;

  beep(720, 0.05, 'triangle', 0.016);
  beep(930, 0.07, 'square', 0.014, 0.04);

  if (state.hole >= TOTAL_HOLES) {
    finishRound(true);
    return;
  }

  const previousHole = state.hole;
  state.hole += 1;
  setStatus(`Cup sunk. Hole ${previousHole} complete.`, 1.1);

  setTimeout(() => {
    if (!state.running) return;
    generateHole(state.hole);
    setStatus(`Hole ${state.hole}. New lane, same pressure.`, 1.2);
  }, 800);
}

function checkCup() {
  if (state.justSank || !state.running) return;

  const b = state.ball;
  const c = state.cup;
  const dx = b.x - c.x;
  const dy = b.y - c.y;
  const dist = Math.hypot(dx, dy);
  const speed = Math.hypot(b.vx, b.vy);

  if (dist < c.r - 2 && speed < 120) {
    b.vx = 0;
    b.vy = 0;
    b.x = c.x;
    b.y = c.y;
    sinkCup();
  }
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * sx,
    y: (event.clientY - rect.top) * sy
  };
}

function handlePointerDown(event) {
  if (!canShoot()) return;

  const p = pointerToCanvas(event);
  const dx = p.x - state.ball.x;
  const dy = p.y - state.ball.y;

  if (Math.hypot(dx, dy) > state.ball.r + 14) return;

  event.preventDefault();
  initAudio();
  state.aiming = true;
  state.pointerId = event.pointerId;
  state.aimPoint.x = p.x;
  state.aimPoint.y = p.y;
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.aiming || event.pointerId !== state.pointerId) return;
  const p = pointerToCanvas(event);
  state.aimPoint.x = p.x;
  state.aimPoint.y = p.y;
}

function shootFromAim() {
  const dx = state.ball.x - state.aimPoint.x;
  const dy = state.ball.y - state.aimPoint.y;
  const pull = Math.hypot(dx, dy);
  if (pull < 6) return;

  const power = clamp(pull, 0, 170);
  const scale = 3.6;

  state.ball.vx = (dx / power) * power * scale;
  state.ball.vy = (dy / power) * power * scale;
  state.strokes += 1;
  state.totalStrokes += 1;

  updateHud();
  beep(300 + power * 1.2, 0.045, 'triangle', 0.014);

  if (state.strokes === 1) {
    setStatus('Good launch. Read the bounce and finish in two.', 1.2);
  }
}

function handlePointerUp(event) {
  if (!state.aiming || event.pointerId !== state.pointerId) return;
  shootFromAim();
  state.aiming = false;
  state.pointerId = null;
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScene(ts) {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#0a1a3e');
  g.addColorStop(1, '#07122b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawRoundedRect(44, 74, 872, 424, 24);
  ctx.fillStyle = '#214f4e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(157, 248, 222, 0.44)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180, 255, 236, 0.12)';
  for (let y = 94; y <= 478; y += 24) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(896, y);
    ctx.stroke();
  }

  for (const rect of state.obstacles) {
    drawRoundedRect(rect.x, rect.y, rect.w, rect.h, 8);
    ctx.fillStyle = 'rgba(17, 38, 76, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(141, 196, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  for (const mover of state.movers) {
    drawRoundedRect(mover.x, mover.y, mover.w, mover.h, 8);
    ctx.fillStyle = 'rgba(49, 18, 84, 0.96)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 152, 226, 0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const pulse = (Math.sin(ts * 0.007) + 1) * 0.5;
  ctx.beginPath();
  ctx.arc(state.cup.x, state.cup.y, state.cup.r + pulse * 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 16, 64, 0.96)';
  ctx.fill();
  ctx.strokeStyle = '#ffd87d';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(state.cup.x, state.cup.y, 5 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = '#ffecc1';
  ctx.fill();

  if (state.aiming) {
    const dx = state.ball.x - state.aimPoint.x;
    const dy = state.ball.y - state.aimPoint.y;
    const pull = clamp(Math.hypot(dx, dy), 0, 170);
    const nx = dx / (pull || 1);
    const ny = dy / (pull || 1);

    ctx.strokeStyle = 'rgba(140, 246, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.ball.x, state.ball.y);
    ctx.lineTo(state.ball.x + nx * (pull * 0.9), state.ball.y + ny * (pull * 0.9));
    ctx.stroke();

    ctx.fillStyle = '#95f7ff';
    for (let i = 1; i <= 4; i += 1) {
      const t = i / 5;
      ctx.beginPath();
      ctx.arc(state.ball.x + nx * pull * t, state.ball.y + ny * pull * t, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const speed = Math.hypot(state.ball.vx, state.ball.vy);
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
  ctx.fillStyle = '#ecf8ff';
  ctx.fill();
  ctx.strokeStyle = '#9fd9ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (speed > 10) {
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, state.ball.r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(132, 246, 255, ${Math.min(0.5, speed / 260)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(230, 244, 255, 0.9)';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText("CARPET CUP CLASSIC '93", 62, 54);

  ctx.textAlign = 'right';
  ctx.fillText(`HOLE PAR 3 · STROKES ${state.strokes}`, 898, 54);

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 237, 144, ${state.flash * 0.22})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = 'rgba(205, 225, 255, 0.08)';
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  if (!state.running) {
    drawOverlay("Carpet Cup Classic '93", 'Press Start Round and sink all five office cups before time runs out.');
  }
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = 'rgba(3, 9, 24, 0.56)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#9cf6ff';
  ctx.font = '700 34px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width * 0.5, canvas.height * 0.5 - 16);

  ctx.fillStyle = '#d5e6ff';
  ctx.font = '600 17px "Trebuchet MS", sans-serif';
  ctx.fillText(subtitle, canvas.width * 0.5, canvas.height * 0.5 + 22);
}

function update(dt) {
  if (!state.running) return;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    finishRound(false);
    return;
  }

  moveBall(dt);
  checkCup();

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) {
      statusEl.textContent = 'Aim clean, play the bounce, finish near par.';
    }
  }

  if (state.flash > 0) {
    state.flash = Math.max(0, state.flash - dt * 2.4);
  }

  updateHud();
}

function frame(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.05, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  update(dt);
  drawScene(ts);
  requestAnimationFrame(frame);
}

startBtn.addEventListener('click', startRound);
resetBtn.addEventListener('click', resetHole);

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  if (!muted) {
    initAudio();
    beep(600, 0.04, 'triangle', 0.014);
  }
});

canvas.addEventListener('pointerdown', handlePointerDown);
canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', handlePointerUp);
canvas.addEventListener('pointercancel', handlePointerUp);
canvas.addEventListener('pointerleave', (event) => {
  if (!state.aiming || event.pointerId !== state.pointerId) return;
  state.aiming = false;
  state.pointerId = null;
});

window.addEventListener('keydown', (event) => {
  if (!state.running || !canShoot()) return;

  if (event.key.toLowerCase() === 'r') {
    resetHole();
  }
});

updateHud();
requestAnimationFrame(frame);
