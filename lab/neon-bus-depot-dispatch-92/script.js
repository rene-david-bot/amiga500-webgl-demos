const canvas = document.getElementById('depotCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const timeLeftEl = document.getElementById('timeLeft');
const reputationEl = document.getElementById('reputation');
const cooldownEl = document.getElementById('cooldown');
const bestScoreEl = document.getElementById('bestScore');
const streakEl = document.getElementById('streak');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const routeButtons = [...document.querySelectorAll('.route-btn')];

const ROUTE_CONFIG = [
  { id: 'A', color: '#5df8ff', laneY: 110, stationX: 760, growth: 5.2 },
  { id: 'B', color: '#ffc766', laneY: 235, stationX: 800, growth: 5.8 },
  { id: 'C', color: '#ff58ce', laneY: 360, stationX: 840, growth: 6.1 }
];

const SHIFT_DURATION = 120;
const MAX_QUEUE = 140;
const DISPATCH_COOLDOWN = 3.4;
const STORAGE_KEY = 'neonBusDepotDispatch92Best';

let state = null;
let lastTs = 0;
let tickAccumulator = 0;
let muted = false;
let audioCtx = null;
let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

bestScoreEl.textContent = String(bestScore);
resetState();
renderHud();
renderScene(0);

startBtn.addEventListener('click', () => {
  if (!state.active) {
    startShift();
  } else {
    endShift('Shift aborted. Depot reset for a clean rerun.', false);
  }
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});

routeButtons.forEach((btn) => {
  btn.addEventListener('click', () => dispatch(btn.dataset.route));
});

requestAnimationFrame(loop);

function resetState() {
  state = {
    active: false,
    ended: false,
    score: 0,
    reputation: 100,
    timeLeft: SHIFT_DURATION,
    cooldown: 0,
    streak: 0,
    routes: ROUTE_CONFIG.map((cfg) => ({
      ...cfg,
      queue: 16 + Math.random() * 14,
      surge: 1,
      busProgress: 0,
      busActive: false,
      flash: 0
    }))
  };
  startBtn.textContent = 'Start Shift';
}

function startShift() {
  ensureAudio();
  resetState();
  tickAccumulator = 0;
  state.active = true;
  state.ended = false;
  startBtn.textContent = 'Abort Shift';
  setStatus('Depot live. Pick your dispatches carefully.');
  playTone(320, 0.09, 'square', 0.03);
  playTone(480, 0.08, 'square', 0.025, 0.09);
}

function endShift(message, success) {
  state.active = false;
  state.ended = true;
  startBtn.textContent = 'Start Shift';
  setStatus(message);

  if (state.score > bestScore) {
    bestScore = Math.round(state.score);
    localStorage.setItem(STORAGE_KEY, String(bestScore));
    bestScoreEl.textContent = String(bestScore);
  }

  if (success) {
    playTone(520, 0.12, 'triangle', 0.04);
    playTone(680, 0.13, 'triangle', 0.04, 0.13);
    playTone(840, 0.16, 'triangle', 0.04, 0.27);
  } else {
    playTone(220, 0.2, 'sawtooth', 0.04);
    playTone(170, 0.24, 'sawtooth', 0.04, 0.12);
  }
}

function dispatch(routeId) {
  if (!state.active || state.cooldown > 0 || state.ended) return;

  const route = state.routes.find((entry) => entry.id === routeId);
  if (!route) return;

  ensureAudio();

  const capacity = 22 + Math.floor(Math.random() * 17);
  const served = Math.min(route.queue, capacity);
  route.queue = Math.max(0, route.queue - served);
  route.busActive = true;
  route.busProgress = 0;
  route.flash = 1;

  const occupancy = served / capacity;
  const queuePressure = Math.min(1.15, route.queue / 90);
  const gain = served * (3.2 + queuePressure) + (occupancy > 0.72 ? 45 : 10);

  state.score += gain;
  if (occupancy > 0.78) {
    state.streak += 1;
    state.score += state.streak * 12;
    state.reputation = Math.min(100, state.reputation + 1.9);
  } else {
    state.streak = Math.max(0, state.streak - 1);
  }

  if (served < 9) {
    state.reputation = Math.max(0, state.reputation - 2.4);
  }

  state.cooldown = DISPATCH_COOLDOWN;

  setStatus(
    `Route ${route.id} dispatched: ${Math.round(served)} riders moved (cap ${capacity}). ` +
    `${state.cooldown.toFixed(1)}s cooldown.`
  );

  playTone(280 + route.id.charCodeAt(0), 0.07, 'square', 0.03);
  playTone(360 + route.id.charCodeAt(0), 0.08, 'square', 0.03, 0.06);

  renderHud();
}

function updateSecond() {
  if (!state.active || state.ended) return;

  state.timeLeft -= 1;

  const elapsed = SHIFT_DURATION - state.timeLeft;
  const rushFactor = 1 + elapsed / 110;

  state.routes.forEach((route) => {
    const surgeRoll = Math.random();
    if (surgeRoll > 0.92) {
      route.surge = 1.95;
      route.flash = 1;
      setStatus(`Rush burst on Route ${route.id}. Queues spiking.`);
      playTone(560, 0.05, 'triangle', 0.03);
    } else {
      route.surge = Math.max(1, route.surge - 0.14);
    }

    route.queue += (Math.random() * route.growth + route.growth * 0.65) * rushFactor * route.surge;
    route.queue = Math.min(MAX_QUEUE, route.queue);

    if (route.queue > 102) {
      state.reputation -= 4.1;
      state.streak = 0;
    } else if (route.queue > 80) {
      state.reputation -= 2;
      state.streak = Math.max(0, state.streak - 1);
    } else if (route.queue < 45) {
      state.reputation = Math.min(100, state.reputation + 0.8);
    }

    route.flash = Math.max(0, route.flash - 0.18);
  });

  state.score += (state.routes.filter((route) => route.queue < 70).length * 5) + state.streak * 1.8;
  state.reputation = Math.max(0, Math.min(100, state.reputation));

  if (state.reputation <= 0) {
    endShift(`Depot meltdown. Final score: ${Math.round(state.score)}. Try again and keep queues under control.`, false);
  } else if (state.timeLeft <= 0) {
    endShift(`Shift cleared. Final score: ${Math.round(state.score)} with ${Math.round(state.reputation)}% reputation.`, true);
  }

  renderHud();
}

function renderHud() {
  scoreEl.textContent = Math.round(state.score).toString();
  timeLeftEl.textContent = `${Math.max(0, state.timeLeft)}s`;
  reputationEl.textContent = `${Math.round(state.reputation)}%`;
  cooldownEl.textContent = state.cooldown > 0 ? `${state.cooldown.toFixed(1)}s` : 'Ready';
  streakEl.textContent = `x${state.streak}`;

  routeButtons.forEach((btn) => {
    btn.disabled = !state.active || state.cooldown > 0 || state.ended;
  });

  if (!state.active && !state.ended) {
    routeButtons.forEach((btn) => {
      btn.disabled = true;
    });
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;

  if (state.active && !state.ended) {
    tickAccumulator += dt;
    if (state.cooldown > 0) {
      state.cooldown = Math.max(0, state.cooldown - dt);
      cooldownEl.textContent = state.cooldown > 0 ? `${state.cooldown.toFixed(1)}s` : 'Ready';
      routeButtons.forEach((btn) => {
        btn.disabled = state.cooldown > 0;
      });
    }

    while (tickAccumulator >= 1) {
      updateSecond();
      tickAccumulator -= 1;
    }

    state.routes.forEach((route) => {
      if (route.busActive) {
        route.busProgress = Math.min(1, route.busProgress + dt * 0.72);
        if (route.busProgress >= 1) {
          route.busProgress = 0;
          route.busActive = false;
        }
      }
      route.flash = Math.max(0, route.flash - dt * 0.7);
    });
  }

  renderScene(ts * 0.001);
  requestAnimationFrame(loop);
}

function renderScene(t) {
  const { width, height } = canvas;

  ctx.fillStyle = '#040711';
  ctx.fillRect(0, 0, width, height);

  drawScanlines(width, height);

  ctx.save();
  ctx.translate(48, 24);

  drawBackdrop(t);

  state.routes.forEach((route, i) => {
    const y = route.laneY;
    const queuePct = Math.min(1, route.queue / MAX_QUEUE);
    const laneLeft = 70;
    const laneRight = route.stationX;
    const laneWidth = laneRight - laneLeft;

    ctx.strokeStyle = 'rgba(143, 162, 215, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laneLeft, y);
    ctx.lineTo(laneRight, y);
    ctx.stroke();

    ctx.fillStyle = route.color;
    ctx.font = '700 16px Trebuchet MS';
    ctx.fillText(`Route ${route.id}`, 4, y + 6);

    const stationW = 126;
    const stationH = 60;
    ctx.fillStyle = 'rgba(10, 15, 38, 0.95)';
    ctx.strokeStyle = 'rgba(143, 162, 215, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(route.stationX, y - stationH / 2, stationW, stationH);
    ctx.strokeRect(route.stationX, y - stationH / 2, stationW, stationH);

    const barInset = 8;
    const barW = stationW - barInset * 2;
    const barH = 12;
    const barX = route.stationX + barInset;
    const barY = y + 9;

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, barY, barW, barH);

    const stressColor = queuePct > 0.72 ? '#ff6e86' : queuePct > 0.5 ? '#ffc766' : '#6eff9f';
    ctx.fillStyle = stressColor;
    ctx.fillRect(barX, barY, barW * queuePct, barH);

    ctx.fillStyle = queuePct > 0.75 ? '#ffd9df' : '#d8e5ff';
    ctx.font = '600 14px Trebuchet MS';
    ctx.fillText(`Queue ${Math.round(route.queue)}`, route.stationX + 8, y - 6);

    const pulse = route.flash > 0 ? route.flash * 10 : 0;
    if (pulse > 0) {
      ctx.strokeStyle = `rgba(255,110,134,${Math.min(0.8, route.flash)})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(route.stationX - 3 - pulse, y - stationH / 2 - 3 - pulse, stationW + pulse * 2 + 6, stationH + pulse * 2 + 6);
    }

    const busX = route.busActive ? laneLeft + laneWidth * route.busProgress : laneLeft - 28;
    drawBus(busX, y, route.color);

    if (i < state.routes.length - 1) {
      ctx.strokeStyle = 'rgba(93, 248, 255, 0.06)';
      ctx.beginPath();
      ctx.moveTo(0, y + 62);
      ctx.lineTo(920, y + 62);
      ctx.stroke();
    }
  });

  drawHeader(width - 96, t);

  ctx.restore();
}

function drawBackdrop(t) {
  const panelW = 960 - 96;
  const panelH = 480 - 48;

  const grad = ctx.createLinearGradient(0, 0, panelW, panelH);
  grad.addColorStop(0, '#071126');
  grad.addColorStop(1, '#040812');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, panelW, panelH);

  for (let i = 0; i < 32; i++) {
    const x = (i * 53 + (t * 26)) % (panelW + 80) - 40;
    const y = (i * 37) % panelH;
    ctx.fillStyle = 'rgba(93,248,255,0.06)';
    ctx.fillRect(x, y, 20, 2);
  }
}

function drawHeader(width, t) {
  ctx.fillStyle = '#d8e5ff';
  ctx.font = '700 20px Trebuchet MS';
  ctx.fillText('CITY TRANSIT OPS // NIGHT SHIFT', 12, 32);

  const wave = Math.sin(t * 2.7) * 0.5 + 0.5;
  const indicator = state.active ? '#6eff9f' : '#8fa2d7';
  ctx.fillStyle = indicator;
  ctx.fillRect(655, 16, 12 + wave * 16, 8);

  ctx.fillStyle = '#8fa2d7';
  ctx.font = '600 13px Trebuchet MS';
  ctx.fillText(state.active ? 'LIVE SERVICE' : 'DEPOT STANDBY', 678, 23);
}

function drawBus(x, y, color) {
  if (x < 0) return;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#0c162f';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-22, -12, 44, 24);
  ctx.strokeRect(-22, -12, 44, 24);

  ctx.fillStyle = 'rgba(93,248,255,0.5)';
  ctx.fillRect(-14, -8, 18, 8);
  ctx.fillRect(7, -8, 8, 8);

  ctx.fillStyle = '#0b0f1d';
  ctx.beginPath();
  ctx.arc(-10, 12, 4, 0, Math.PI * 2);
  ctx.arc(10, 12, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScanlines(width, height) {
  ctx.fillStyle = 'rgba(6, 10, 26, 0.32)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }
}

function ensureAudio() {
  if (muted) return;
  if (!audioCtx) {
    const AudioContextRef = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextRef) return;
    audioCtx = new AudioContextRef();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playTone(freq, duration = 0.08, type = 'square', gain = 0.03, delay = 0) {
  if (muted || !audioCtx) return;

  const now = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}
