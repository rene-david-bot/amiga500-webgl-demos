const BEST_KEY = 'retro_vhs_rewind_rush_96_best';
const TOTAL_TAPES = 5;
const SHIFT_SECONDS = 95;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const roundEl = document.getElementById('round');
const timeEl = document.getElementById('time');
const tensionEl = document.getElementById('tension');
const decksEl = document.getElementById('decks');
const streakEl = document.getElementById('streak');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');

const rewindBtn = document.getElementById('rewindBtn');
const featherBtn = document.getElementById('featherBtn');
const brakeBtn = document.getElementById('brakeBtn');

const input = {
  rewind: false,
  feather: false,
  brake: false
};

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  round: 1,
  streak: 0,
  decks: 3,
  shiftTime: SHIFT_SECONDS,
  tapeStart: 100,
  tapeRemaining: 100,
  speed: 0,
  targetSpeed: 0,
  tension: 0,
  jitterTimer: 3,
  jitterLeft: 0,
  statusTimer: 0,
  spoolSpin: 0,
  flash: 0,
  lastTime: 0
};

let audioCtx = null;
let muted = false;

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

function setStatus(text, seconds = 1.2) {
  statusEl.textContent = text;
  state.statusTimer = seconds;
}

function setupTape() {
  state.tapeStart = rand(86, 132);
  state.tapeRemaining = state.tapeStart;
  state.speed = 0;
  state.targetSpeed = 0;
  state.tension = 8;
  state.jitterTimer = rand(3.4, 5.7);
  state.jitterLeft = 0;
}

function startShift() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.round = 1;
  state.streak = 0;
  state.decks = 3;
  state.shiftTime = SHIFT_SECONDS;
  state.flash = 0;
  pauseBtn.textContent = 'Pause';

  setupTape();
  updateHud();

  initAudio();
  beep(620, 0.05, 'triangle', 0.02);
  beep(840, 0.05, 'square', 0.016, 0.06);

  setStatus('Shift live. Rewind hard, but cool down before the tape snaps.', 1.6);
  state.lastTime = performance.now();
}

function finishShift(message, success) {
  state.running = false;
  state.paused = false;
  pauseBtn.textContent = 'Pause';

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }

  if (success) {
    beep(760, 0.05, 'triangle', 0.02);
    beep(980, 0.07, 'square', 0.018, 0.06);
  } else {
    beep(220, 0.12, 'sawtooth', 0.02);
    beep(160, 0.12, 'triangle', 0.016, 0.11);
  }

  setStatus(`${message} Final score ${Math.floor(state.score)}.`, 2.6);
  updateHud();
}

function snapTape() {
  state.decks -= 1;
  state.streak = 0;
  state.score = Math.max(0, state.score - 240);
  state.flash = 0.8;

  beep(160, 0.1, 'sawtooth', 0.024);
  beep(120, 0.12, 'triangle', 0.016, 0.08);

  if (state.decks <= 0) {
    state.decks = 0;
    finishShift('All decks blown. Counter closed early.', false);
    return;
  }

  setupTape();
  setStatus(`Tape snapped! Deck ${state.decks} left.`, 1.4);
  updateHud();
}

function completeTape() {
  const speedBonus = Math.round(clamp(state.speed, 0.5, 1.9) * 80);
  const tensionBonus = Math.round((100 - state.tension) * 3.4);
  const streakBonus = state.streak * 65;
  const timeBonus = Math.round(state.shiftTime * 4.2);
  const gain = 360 + speedBonus + tensionBonus + streakBonus + timeBonus;

  state.score += gain;
  state.streak += 1;

  beep(700 + state.streak * 12, 0.05, 'triangle', 0.016);
  beep(920 + state.streak * 14, 0.06, 'square', 0.012, 0.05);

  if (state.round >= TOTAL_TAPES) {
    finishShift('All tapes rewound. Night shift cleared.', true);
    return;
  }

  state.round += 1;
  setupTape();
  setStatus(`Tape ${state.round - 1} complete. +${gain} points.`, 1.2);
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  roundEl.textContent = `${state.round} / ${TOTAL_TAPES}`;
  timeEl.textContent = `${Math.max(0, state.shiftTime).toFixed(1)}s`;
  tensionEl.textContent = `${Math.round(state.tension)}%`;
  decksEl.textContent = String(state.decks);
  streakEl.textContent = `x${state.streak}`;
}

function updateJitter(dt) {
  state.jitterTimer -= dt;

  if (state.jitterTimer <= 0 && state.jitterLeft <= 0) {
    state.jitterLeft = rand(0.9, 1.8);
    state.jitterTimer = rand(4.3, 7.2);
    setStatus('Tracking jitter spike. Brake or feather now!', 0.8);
    beep(460, 0.035, 'square', 0.012);
  }

  if (state.jitterLeft > 0) {
    state.jitterLeft -= dt;
    if (state.jitterLeft <= 0) {
      setStatus('Tracking stable. Push rewind again.', 0.7);
    }
  }
}

function updateShift(dt) {
  if (!state.running || state.paused) return;

  state.shiftTime -= dt;
  if (state.shiftTime <= 0) {
    state.shiftTime = 0;
    finishShift('Closing bell. Shift time expired.', false);
    return;
  }

  updateJitter(dt);

  let intent = 0.08;
  if (input.rewind) intent = 1.95;
  if (input.feather) intent = 1.06;
  if (input.brake) intent = 0;

  const accel = input.brake ? 6.8 : 3.7;
  state.targetSpeed = intent;
  state.speed += (state.targetSpeed - state.speed) * Math.min(1, dt * accel);

  state.spoolSpin += state.speed * dt * 9;

  const rewindRate = state.speed * 18;
  state.tapeRemaining = Math.max(0, state.tapeRemaining - rewindRate * dt);

  let tensionUp = 0;
  if (state.speed > 1.15) {
    tensionUp += (state.speed - 1.15) * 36;
  }
  if (state.jitterLeft > 0 && state.speed > 0.75) {
    tensionUp += (state.speed - 0.65) * 40;
  }

  let tensionDown = 14;
  if (input.brake) tensionDown += 38;
  if (input.feather) tensionDown += 7;
  if (state.speed < 0.5) tensionDown += 4;

  state.tension += (tensionUp - tensionDown) * dt;
  state.tension = clamp(state.tension, 0, 100);

  if (state.tension >= 100) {
    snapTape();
    return;
  }

  if (state.tapeRemaining <= 0) {
    completeTape();
  }

  if (state.statusTimer > 0) {
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) {
      statusEl.textContent = 'Ride fast in the green, feather in yellow, brake in red.';
    }
  }

  if (state.flash > 0) {
    state.flash = Math.max(0, state.flash - dt * 2.2);
  }

  updateHud();
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

function drawBackground(time) {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#08183b');
  g.addColorStop(0.5, '#0a1d46');
  g.addColorStop(1, '#041128');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(120, 174, 255, 0.11)';
  ctx.lineWidth = 1;
  for (let y = 26; y < canvas.height; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const pulse = (Math.sin(time * 0.0023) + 1) * 0.5;
  ctx.fillStyle = `rgba(74, 140, 255, ${0.07 + pulse * 0.06})`;
  ctx.fillRect(80, 52, 800, 430);
}

function drawCassette(time) {
  const x = 172;
  const y = 120;
  const w = 616;
  const h = 300;

  drawRoundedRect(x, y, w, h, 18);
  ctx.fillStyle = 'rgba(18, 31, 78, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(149, 201, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawRoundedRect(x + 36, y + 54, w - 72, 116, 14);
  ctx.fillStyle = 'rgba(7, 16, 43, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(128, 181, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const progress = clamp(1 - state.tapeRemaining / state.tapeStart, 0, 1);
  const leftRadius = 18 + progress * 34;
  const rightRadius = 18 + (1 - progress) * 34;

  const leftX = x + 194;
  const rightX = x + w - 194;
  const spoolY = y + 112;

  drawSpool(leftX, spoolY, leftRadius, time, '#8bf5ff');
  drawSpool(rightX, spoolY, rightRadius, -time, '#ffacd7');

  ctx.strokeStyle = 'rgba(196, 230, 255, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftX + leftRadius, spoolY);
  ctx.bezierCurveTo(x + 292, y + 110, x + 324, y + 110, x + w / 2, y + 112);
  ctx.bezierCurveTo(x + w - 324, y + 114, x + w - 292, y + 114, rightX - rightRadius, spoolY);
  ctx.stroke();

  drawCounterWindow(x + 242, y + 205, 130, 56);
  drawTensionBar(x + 402, y + 205, 170, 56);

  ctx.fillStyle = '#d2e6ff';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VHS REWIND RUSH 96', x + 44, y + 30);

  ctx.textAlign = 'right';
  ctx.fillText(`Speed ${state.speed.toFixed(2)}x`, x + w - 42, y + 30);

  ctx.fillStyle = 'rgba(160, 196, 255, 0.42)';
  for (let i = 0; i < 4; i += 1) {
    const screwX = x + 26 + (i % 2) * (w - 52);
    const screwY = y + 24 + Math.floor(i / 2) * (h - 48);
    ctx.beginPath();
    ctx.arc(screwX, screwY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpool(x, y, radius, time, color) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(5, 12, 30, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(145, 188, 255, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const spin = state.spoolSpin * 3 + time * 0.0012;
  ctx.rotate(spin);
  ctx.strokeStyle = 'rgba(9, 24, 59, 0.95)';
  ctx.lineWidth = 3;

  for (let i = 0; i < 6; i += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(radius * 0.86, 0);
    ctx.stroke();
  }

  ctx.fillStyle = '#cfe6ff';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCounterWindow(x, y, w, h) {
  drawRoundedRect(x, y, w, h, 10);
  ctx.fillStyle = 'rgba(9, 18, 45, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(124, 176, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const remaining = Math.max(0, state.tapeRemaining * 4.8);
  const text = String(Math.floor(remaining)).padStart(4, '0');

  ctx.fillStyle = '#9ef7ff';
  ctx.font = '700 28px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w * 0.5, y + 37);

  ctx.fillStyle = '#c7dcff';
  ctx.font = '600 11px "Trebuchet MS", sans-serif';
  ctx.fillText('COUNTER', x + w * 0.5, y + 51);
}

function drawTensionBar(x, y, w, h) {
  drawRoundedRect(x, y, w, h, 10);
  ctx.fillStyle = 'rgba(9, 18, 45, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(124, 176, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const meter = clamp(state.tension / 100, 0, 1);
  const fillW = (w - 20) * meter;

  let color = '#7ef8bf';
  if (meter > 0.65) color = '#ffd76f';
  if (meter > 0.84) color = '#ff87bc';

  drawRoundedRect(x + 10, y + 22, w - 20, 18, 8);
  ctx.fillStyle = 'rgba(24, 36, 74, 0.92)';
  ctx.fill();

  drawRoundedRect(x + 10, y + 22, fillW, 18, 8);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = '#d6e8ff';
  ctx.font = '600 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TENSION', x + 10, y + 15);
}

function drawOverlay(title, subtitle) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 10, 26, 0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#9bf6ff';
  ctx.font = '700 34px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, canvas.width * 0.5, canvas.height * 0.5 - 14);

  ctx.fillStyle = '#d5e6ff';
  ctx.font = '600 17px "Trebuchet MS", sans-serif';
  ctx.fillText(subtitle, canvas.width * 0.5, canvas.height * 0.5 + 22);
  ctx.restore();
}

function drawNoise(time) {
  const jitter = state.jitterLeft > 0 ? 0.16 : 0.06;
  ctx.globalAlpha = jitter;
  ctx.fillStyle = '#d2e8ff';

  for (let i = 0; i < 22; i += 1) {
    const x = ((i * 113 + time * 0.09) % canvas.width);
    const y = ((i * 59 + time * 0.14) % canvas.height);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.globalAlpha = 1;
}

function drawFlash() {
  if (state.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 110, 176, ${state.flash * 0.28})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw(time) {
  drawBackground(time);
  drawCassette(time);
  drawNoise(time);
  drawFlash();

  ctx.fillStyle = '#cce2ff';
  ctx.font = '700 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NIGHT SHIFT · VIDEO COUNTER 3', 94, 42);

  ctx.textAlign = 'right';
  ctx.fillText(`Decks ${state.decks} · Streak x${state.streak}`, canvas.width - 94, 42);

  if (!state.running) {
    drawOverlay("VHS Rewind Rush '96", 'Press Start Shift and clear all five tapes before the lights cut.');
  } else if (state.paused) {
    drawOverlay('Paused', 'Press Pause again to resume rewind control.');
  }
}

function frame(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.05, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  updateShift(dt);
  draw(ts);

  requestAnimationFrame(frame);
}

function bindHold(button, key) {
  const setValue = (value) => {
    input[key] = value;
    if (value) initAudio();
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setValue(true);
  });
  button.addEventListener('pointerup', () => setValue(false));
  button.addEventListener('pointerleave', () => setValue(false));
  button.addEventListener('pointercancel', () => setValue(false));
}

startBtn.addEventListener('click', () => {
  initAudio();
  startShift();
});

pauseBtn.addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';

  if (!state.paused) {
    state.lastTime = performance.now();
    setStatus('Back on spool control.', 0.7);
  } else {
    setStatus('Shift paused.', 0.7);
  }
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  if (!muted) {
    initAudio();
    beep(620, 0.04, 'triangle', 0.015);
  }
});

bindHold(rewindBtn, 'rewind');
bindHold(featherBtn, 'feather');
bindHold(brakeBtn, 'brake');

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  const key = event.key.toLowerCase();
  if (key === ' ') {
    event.preventDefault();
    input.rewind = true;
    initAudio();
  }
  if (key === 'shift') {
    input.feather = true;
    initAudio();
  }
  if (key === 'b') {
    input.brake = true;
    initAudio();
  }
  if (key === 'p' && state.running) {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    if (!state.paused) state.lastTime = performance.now();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === ' ') input.rewind = false;
  if (key === 'shift') input.feather = false;
  if (key === 'b') input.brake = false;
});

updateHud();
requestAnimationFrame(frame);
