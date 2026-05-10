const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const floorEl = document.getElementById('floor');
const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const hullEl = document.getElementById('hull');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startBtn');
const muteBtn = document.getElementById('muteBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const STORAGE_KEY = 'mallRampEscape94Best';
const FLOORS = ['P3', 'P2', 'P1', 'G', 'B1', 'B2', 'B3', 'B4', 'B5'];
const GOAL_DISTANCE = 3200;
const LANE_COUNT = 5;

let audioCtx = null;
let muted = false;
let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

const state = {
  active: false,
  won: false,
  lane: 2,
  targetLane: 2,
  laneAnim: 2,
  hull: 3,
  speed: 0,
  score: 0,
  distance: 0,
  boost: 0,
  time: 0,
  spawnCd: 0.8,
  invuln: 0,
  entities: [],
  lastTs: 0,
  raf: 0,
  stars: Array.from({ length: 70 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    z: 0.5 + Math.random() * 1.5
  }))
};

bestEl.textContent = String(bestScore);
renderHud();
renderFrame();

startBtn.addEventListener('click', () => {
  if (state.active) {
    finishRun(false, 'Run aborted. Garage reset.');
    return;
  }
  startRun();
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});

window.addEventListener('keydown', (event) => {
  if (!state.active) return;
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') {
    steer(-1);
    event.preventDefault();
  } else if (key === 'arrowright' || key === 'd') {
    steer(1);
    event.preventDefault();
  }
});

bindHold(leftBtn, () => steer(-1));
bindHold(rightBtn, () => steer(1));

function bindHold(button, action) {
  let holdTimer = null;

  const start = () => {
    if (!state.active) return;
    action();
    holdTimer = setInterval(action, 120);
  };

  const stop = () => {
    if (holdTimer) {
      clearInterval(holdTimer);
      holdTimer = null;
    }
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    start();
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
}

function startRun() {
  ensureAudio();

  state.active = true;
  state.won = false;
  state.lane = 2;
  state.targetLane = 2;
  state.laneAnim = 2;
  state.hull = 3;
  state.speed = 110;
  state.score = 0;
  state.distance = 0;
  state.boost = 0;
  state.time = 0;
  state.spawnCd = 0.65;
  state.invuln = 0;
  state.entities = [];
  state.lastTs = 0;

  startBtn.textContent = 'Abort Run';
  setStatus('Go! Reach B5 before lockout.');
  tone(280, 0.07, 'square', 0.03);
  tone(410, 0.09, 'square', 0.03, 0.08);

  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(loop);
}

function finishRun(completed, text) {
  state.active = false;
  state.won = completed;
  startBtn.textContent = 'Start Run';
  setStatus(text);

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(STORAGE_KEY, String(bestScore));
  }

  if (completed) {
    tone(520, 0.1, 'triangle', 0.035);
    tone(660, 0.1, 'triangle', 0.035, 0.1);
    tone(840, 0.14, 'triangle', 0.04, 0.21);
  } else {
    tone(180, 0.14, 'sawtooth', 0.04);
    tone(140, 0.16, 'sawtooth', 0.04, 0.12);
  }

  renderHud();
  renderFrame();
}

function loop(ts) {
  if (!state.active) return;

  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  update(dt);
  renderHud();
  renderFrame();

  if (state.active) {
    state.raf = requestAnimationFrame(loop);
  }
}

function update(dt) {
  state.time += dt;
  state.invuln = Math.max(0, state.invuln - dt);
  state.boost = Math.max(0, state.boost - dt);

  const progress = Math.min(1, state.distance / GOAL_DISTANCE);
  const targetSpeed = 140 + progress * 60 + (state.boost > 0 ? 70 : 0);
  state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 2.8);

  const meters = (state.speed * dt) * 0.72;
  state.distance += meters;
  state.score += Math.floor(meters * (state.boost > 0 ? 1.3 : 1));

  state.laneAnim += (state.targetLane - state.laneAnim) * Math.min(1, dt * 10);

  state.spawnCd -= dt;
  if (state.spawnCd <= 0) {
    spawnEntity();
    const density = 0.84 - progress * 0.32;
    state.spawnCd = density + Math.random() * 0.42;
  }

  const speedPx = 180 + state.speed * 1.45;
  for (let i = state.entities.length - 1; i >= 0; i -= 1) {
    const ent = state.entities[i];
    ent.y += speedPx * dt;

    if (ent.y > canvas.height + 70) {
      state.entities.splice(i, 1);
      continue;
    }

    if (collides(ent)) {
      handleCollision(ent);
      state.entities.splice(i, 1);
    }
  }

  if (state.distance >= GOAL_DISTANCE) {
    state.distance = GOAL_DISTANCE;
    const bonus = Math.max(0, state.hull) * 500;
    state.score += bonus;
    finishRun(true, `Gate breached. Basement B5 reached. Bonus +${bonus}. Final score ${state.score}.`);
  }
}

function spawnEntity() {
  const roll = Math.random();
  let kind = 'pillar';
  if (roll < 0.18) kind = 'ticket';
  else if (roll < 0.54) kind = 'barrier';

  const lane = Math.floor(Math.random() * LANE_COUNT);
  state.entities.push({
    kind,
    lane,
    y: -50,
    wobble: Math.random() * Math.PI * 2
  });
}

function collides(ent) {
  const playerX = laneX(state.laneAnim, 560);
  const playerY = 560;
  const ex = laneX(ent.lane, ent.y);
  const ey = ent.y;

  const eHalfW = ent.kind === 'pillar' ? 20 : ent.kind === 'barrier' ? 26 : 16;
  const eHalfH = ent.kind === 'pillar' ? 24 : ent.kind === 'barrier' ? 14 : 16;

  return Math.abs(playerX - ex) < (18 + eHalfW) && Math.abs(playerY - ey) < (26 + eHalfH);
}

function handleCollision(ent) {
  if (ent.kind === 'ticket') {
    state.score += 180;
    state.boost = Math.min(2.2, state.boost + 1.1);
    tone(620, 0.06, 'triangle', 0.03);
    tone(780, 0.07, 'triangle', 0.025, 0.05);
    return;
  }

  if (state.invuln > 0) return;

  state.hull -= 1;
  state.score = Math.max(0, state.score - 120);
  state.invuln = 0.9;
  tone(180, 0.11, 'square', 0.045);

  if (state.hull <= 0) {
    finishRun(false, `Wrecked on ${currentFloor()}. Score ${state.score}.`);
  } else {
    setStatus(`Impact! Hull down to ${state.hull}. Keep it clean to B5.`);
  }
}

function steer(dir) {
  if (!state.active) return;
  const next = Math.max(0, Math.min(LANE_COUNT - 1, state.targetLane + dir));
  if (next === state.targetLane) return;
  state.targetLane = next;
  state.lane = next;
  tone(240 + next * 40, 0.03, 'square', 0.017);
}

function laneX(lane, y) {
  const laneSpan = 52;
  const center = canvas.width / 2 + curveOffset(y);
  return center + (lane - (LANE_COUNT - 1) / 2) * laneSpan;
}

function curveOffset(y) {
  const p = y / canvas.height;
  const sweep = Math.sin(state.time * 1.2 + p * 5.4 + state.distance * 0.01) * 32;
  const drift = Math.sin(state.time * 0.47 + p * 2.3) * 18;
  return sweep + drift;
}

function currentFloor() {
  const idx = Math.min(FLOORS.length - 1, Math.floor((state.distance / GOAL_DISTANCE) * FLOORS.length));
  return FLOORS[idx];
}

function renderHud() {
  floorEl.textContent = currentFloor();
  distanceEl.textContent = `${Math.floor(state.distance)} m`;
  speedEl.textContent = `${Math.round(state.speed)} km/h`;
  hullEl.textContent = String(Math.max(0, state.hull));
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(bestScore);
}

function renderFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackdrop();
  drawRoad();
  drawEntities();
  drawPlayer();
  drawOverlay();
}

function drawBackdrop() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#0b1130');
  grad.addColorStop(0.55, '#070b1e');
  grad.addColorStop(1, '#04060f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of state.stars) {
    star.y += star.z * (state.active ? 1.6 : 0.25);
    if (star.y > canvas.height) {
      star.y = -3;
      star.x = Math.random() * canvas.width;
    }
    ctx.fillStyle = `rgba(140, 200, 255, ${0.22 + star.z * 0.16})`;
    ctx.fillRect(star.x, star.y, star.z, star.z);
  }
}

function drawRoad() {
  for (let y = 0; y < canvas.height; y += 6) {
    const p = y / canvas.height;
    const roadHalf = 80 + p * 90;
    const center = canvas.width / 2 + curveOffset(y);

    ctx.fillStyle = p < 0.6 ? '#1b2a58' : '#152148';
    ctx.fillRect(center - roadHalf, y, roadHalf * 2, 6);

    ctx.fillStyle = 'rgba(84, 133, 216, 0.22)';
    ctx.fillRect(center - roadHalf - 18, y, 14, 6);
    ctx.fillRect(center + roadHalf + 4, y, 14, 6);

    if ((y + Math.floor(state.time * 180)) % 36 < 18) {
      ctx.fillStyle = 'rgba(255, 216, 130, 0.72)';
      ctx.fillRect(center - 2, y, 4, 6);
    }
  }
}

function drawEntities() {
  for (const ent of state.entities) {
    const x = laneX(ent.lane, ent.y);
    const y = ent.y;

    if (ent.kind === 'ticket') {
      ctx.fillStyle = '#79ffb5';
      ctx.fillRect(x - 12, y - 8, 24, 16);
      ctx.fillStyle = '#1c7f53';
      ctx.fillRect(x - 8, y - 4, 16, 8);
      continue;
    }

    if (ent.kind === 'barrier') {
      ctx.fillStyle = '#ff7e6f';
      ctx.fillRect(x - 24, y - 8, 48, 16);
      ctx.fillStyle = '#ffd38e';
      ctx.fillRect(x - 24, y - 8, 48, 4);
      continue;
    }

    const wobble = Math.sin(state.time * 2 + ent.wobble) * 1.8;
    ctx.fillStyle = '#9ba8c7';
    ctx.fillRect(x - 16, y - 20 + wobble, 32, 40);
    ctx.fillStyle = '#5a657e';
    ctx.fillRect(x - 12, y - 16 + wobble, 24, 32);
  }
}

function drawPlayer() {
  const x = laneX(state.laneAnim, 560);
  const y = 560;
  const flashing = state.invuln > 0 && Math.floor(state.time * 24) % 2 === 0;
  if (flashing) return;

  ctx.fillStyle = '#4fdfff';
  ctx.fillRect(x - 16, y - 24, 32, 48);
  ctx.fillStyle = '#132447';
  ctx.fillRect(x - 10, y - 16, 20, 24);
  ctx.fillStyle = '#ff5fc7';
  ctx.fillRect(x - 14, y - 20, 28, 6);
  ctx.fillStyle = '#9fffe8';
  ctx.fillRect(x - 12, y + 16, 8, 4);
  ctx.fillRect(x + 4, y + 16, 8, 4);

  if (state.boost > 0 && state.active) {
    ctx.fillStyle = 'rgba(255, 180, 95, 0.9)';
    ctx.fillRect(x - 7, y + 24, 5, 8 + Math.random() * 6);
    ctx.fillRect(x + 2, y + 24, 5, 8 + Math.random() * 6);
  }
}

function drawOverlay() {
  const progress = Math.min(1, state.distance / GOAL_DISTANCE);

  ctx.fillStyle = 'rgba(7, 12, 28, 0.66)';
  ctx.fillRect(14, 12, 170, 28);
  ctx.strokeStyle = 'rgba(92, 246, 255, 0.5)';
  ctx.strokeRect(14, 12, 170, 28);
  ctx.fillStyle = '#77f8ff';
  ctx.fillRect(16, 14, 166 * progress, 24);

  ctx.fillStyle = '#dce8ff';
  ctx.font = 'bold 12px Trebuchet MS';
  ctx.fillText(`Ramp progress ${(progress * 100).toFixed(0)}%`, 21, 31);

  ctx.fillStyle = 'rgba(7, 12, 28, 0.55)';
  ctx.fillRect(292, 12, 114, 28);
  ctx.strokeStyle = 'rgba(255, 98, 214, 0.55)';
  ctx.strokeRect(292, 12, 114, 28);
  ctx.fillStyle = '#ffd891';
  ctx.fillText(`Floor ${currentFloor()}`, 311, 31);

  if (!state.active) {
    ctx.fillStyle = 'rgba(5, 8, 20, 0.62)';
    ctx.fillRect(76, 262, 268, 84);
    ctx.strokeStyle = 'rgba(92, 246, 255, 0.6)';
    ctx.strokeRect(76, 262, 268, 84);
    ctx.fillStyle = '#e2efff';
    ctx.font = 'bold 18px Trebuchet MS';
    ctx.fillText(state.won ? 'B5 Unlocked' : 'Mall Ramp Escape', 132, 295);
    ctx.font = '13px Trebuchet MS';
    ctx.fillStyle = '#aecaef';
    ctx.fillText('Start Run to launch a new midnight descent.', 95, 322);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tone(freq, duration, type = 'square', gain = 0.03, delay = 0) {
  if (muted || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  const now = audioCtx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}
