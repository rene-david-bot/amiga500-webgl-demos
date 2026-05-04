const BEST_KEY = 'retro_baggage_carousel_control_95_best';
const SHIFT_SECONDS = 90;
const JAM_LIMIT = 5;
const MAX_BAGS = 18;
const INFEED_ANGLE = 5.35;

const EXITS = [
  { key: 'w', name: 'Top', angle: Math.PI * 1.5, letter: 'A', color: '#7dfed6' },
  { key: 'd', name: 'Right', angle: 0, letter: 'B', color: '#79e8ff' },
  { key: 's', name: 'Bottom', angle: Math.PI * 0.5, letter: 'C', color: '#ff9fea' },
  { key: 'a', name: 'Left', angle: Math.PI, letter: 'D', color: '#ffe48f' }
];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const accuracyEl = document.getElementById('accuracy');
const jamsEl = document.getElementById('jams');
const timeEl = document.getElementById('time');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');

const slowBtn = document.getElementById('slowBtn');
const fastBtn = document.getElementById('fastBtn');

const topBtn = document.getElementById('topBtn');
const rightBtn = document.getElementById('rightBtn');
const bottomBtn = document.getElementById('bottomBtn');
const leftBtn = document.getElementById('leftBtn');

let audioCtx = null;
let muted = false;

const input = {
  slow: false,
  fast: false
};

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  combo: 0,
  jams: 0,
  attempts: 0,
  hits: 0,
  timeLeft: SHIFT_SECONDS,
  bags: [],
  particles: [],
  spawnTimer: 1.2,
  beltSpeed: 0.7,
  targetBeltSpeed: 0.7,
  statusTimer: 0,
  lastTime: 0
};

const ring = {
  cx: canvas.width * 0.5,
  cy: canvas.height * 0.53,
  r: 170,
  lane: 56
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value) {
  let a = value % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

function angleDistance(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function setStatus(text, seconds = 1.1) {
  statusEl.textContent = text;
  state.statusTimer = seconds;
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

function emit(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-160, 160),
      vy: rand(-170, -40),
      life: rand(0.28, 0.75),
      size: rand(2, 5),
      color
    });
  }
}

function accuracy() {
  if (!state.attempts) return 0;
  return Math.round((state.hits / state.attempts) * 100);
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  comboEl.textContent = `x${state.combo}`;
  accuracyEl.textContent = `${accuracy()}%`;
  jamsEl.textContent = `${state.jams} / ${JAM_LIMIT}`;
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
}

function createBag() {
  const route = Math.floor(Math.random() * EXITS.length);
  const gold = Math.random() < 0.1;
  return {
    angle: INFEED_ANGLE,
    route,
    lap: 0,
    age: 0,
    gold,
    wobble: rand(-0.22, 0.22)
  };
}

function canSpawn() {
  if (state.bags.length >= MAX_BAGS) return false;
  return !state.bags.some((bag) => angleDistance(bag.angle, INFEED_ANGLE) < 0.34);
}

function resetShift() {
  state.score = 0;
  state.combo = 0;
  state.jams = 0;
  state.attempts = 0;
  state.hits = 0;
  state.timeLeft = SHIFT_SECONDS;
  state.bags = [];
  state.particles = [];
  state.spawnTimer = 1;
  state.beltSpeed = 0.7;
  state.targetBeltSpeed = 0.7;
  state.statusTimer = 0;
}

function startShift() {
  resetShift();
  state.running = true;
  state.paused = false;
  pauseBtn.textContent = 'Pause';
  state.lastTime = performance.now();

  setStatus('Shift started. Match route letters to exit letters.', 1.2);
  beep(600, 0.05, 'triangle', 0.02);
  beep(820, 0.05, 'square', 0.017, 0.06);
  updateHud();
}

function finishShift(reason, success) {
  state.running = false;
  state.paused = false;
  pauseBtn.textContent = 'Pause';

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }

  setStatus(`${reason} Final score ${Math.floor(state.score)}.`, 2.6);

  if (success) {
    beep(760, 0.05, 'triangle', 0.02);
    beep(940, 0.07, 'square', 0.018, 0.06);
  } else {
    beep(240, 0.12, 'sawtooth', 0.02);
    beep(180, 0.12, 'triangle', 0.018, 0.1);
  }

  updateHud();
}

function jamBag(bag, message) {
  state.combo = 0;
  state.jams += 1;
  state.score = Math.max(0, state.score - 35);

  const x = ring.cx + Math.cos(bag.angle) * ring.r;
  const y = ring.cy + Math.sin(bag.angle) * ring.r;
  emit(x, y, '#ff8ccf', 14);
  beep(220, 0.09, 'sawtooth', 0.023);

  setStatus(message, 1);

  if (state.jams >= JAM_LIMIT) {
    state.jams = JAM_LIMIT;
    finishShift('Terminal jammed. Belt shut down by control tower.', false);
  }
}

function dispatch(exitIndex) {
  if (!state.running || state.paused) return;
  initAudio();

  const exit = EXITS[exitIndex];
  const captureWindow = 0.2;

  let bestIdx = -1;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < state.bags.length; i += 1) {
    const delta = angleDistance(state.bags[i].angle, exit.angle);
    if (delta < bestDelta && delta <= captureWindow) {
      bestDelta = delta;
      bestIdx = i;
    }
  }

  state.attempts += 1;

  if (bestIdx === -1) {
    state.combo = 0;
    state.score = Math.max(0, state.score - 20);
    setStatus(`${exit.name} exit whiff. No bag in range.`, 0.9);
    beep(280, 0.05, 'square', 0.015);
    updateHud();
    return;
  }

  const bag = state.bags.splice(bestIdx, 1)[0];
  const hitX = ring.cx + Math.cos(exit.angle) * ring.r;
  const hitY = ring.cy + Math.sin(exit.angle) * ring.r;

  if (bag.route === exitIndex) {
    state.hits += 1;
    state.combo += 1;

    let gain = 80 + state.combo * 16;
    if (bag.gold) {
      gain += 120;
      state.timeLeft = Math.min(SHIFT_SECONDS + 8, state.timeLeft + 1);
      setStatus(`Gold cargo routed! +${gain} and +1.0s`, 1);
    } else {
      setStatus(`Perfect route lock. +${gain}`, 0.9);
    }

    state.score += gain;
    emit(hitX, hitY, bag.gold ? '#ffe48f' : exit.color, bag.gold ? 18 : 12);

    beep(640 + state.combo * 8, 0.04, 'triangle', 0.016);
    beep(860 + state.combo * 10, 0.045, 'square', 0.012, 0.05);
  } else {
    jamBag(bag, `Wrong chute. ${EXITS[bag.route].letter} cargo misrouted.`, 1);
  }

  updateHud();
}

function updateBags(dt) {
  for (let i = state.bags.length - 1; i >= 0; i -= 1) {
    const bag = state.bags[i];
    const prev = bag.angle;

    bag.angle = normalizeAngle(bag.angle + state.beltSpeed * dt);
    bag.age += dt;

    if (prev > bag.angle) {
      bag.lap += 1;
    }

    if (bag.lap >= 2 || bag.age > 26) {
      state.bags.splice(i, 1);
      jamBag(bag, 'Bag timed out and jammed the carousel.');
    }
  }
}

function updateSpawn(dt) {
  const progress = 1 - state.timeLeft / SHIFT_SECONDS;
  const spawnEvery = Math.max(0.6, 1.45 - progress * 0.72);

  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;

  state.spawnTimer = spawnEvery;

  if (canSpawn()) {
    const bag = createBag();
    state.bags.push(bag);
    if (bag.gold) {
      setStatus('Gold cargo entered the belt!', 0.9);
      beep(760, 0.04, 'triangle', 0.014);
    }
  }
}

function updateBeltSpeed(dt) {
  const progress = 1 - state.timeLeft / SHIFT_SECONDS;
  const base = 0.72 + progress * 0.5;
  const nudge = (input.fast ? 0.98 : 0) - (input.slow ? 0.98 : 0);

  state.targetBeltSpeed = clamp(base + nudge, 0.28, 2.1);
  state.beltSpeed += (state.targetBeltSpeed - state.beltSpeed) * Math.min(1, dt * 4.4);
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 360 * dt;
    p.life -= dt;

    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    const success = state.jams < JAM_LIMIT;
    finishShift(success ? 'Shift complete. Terminal survived the rush.' : 'Shift over in chaos.', success);
    return;
  }

  updateBeltSpeed(dt);
  updateSpawn(dt);
  updateBags(dt);
  updateParticles(dt);

  if (state.statusTimer > 0) {
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) {
      statusEl.textContent = 'Keep matching route letters. Do not let bags age out.';
    }
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

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#07173b');
  g.addColorStop(0.45, '#0a1d48');
  g.addColorStop(1, '#04112d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(116, 171, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let y = 22; y < canvas.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(12, 24, 62, 0.84)';
  ctx.fillRect(90, 52, 780, 430);
  ctx.strokeStyle = 'rgba(130, 185, 255, 0.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(90, 52, 780, 430);
}

function drawRing(time) {
  ctx.save();
  ctx.translate(ring.cx, ring.cy);

  ctx.strokeStyle = 'rgba(109, 179, 255, 0.55)';
  ctx.lineWidth = ring.lane;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
  ctx.stroke();

  const glow = 0.16 + (Math.sin(time * 0.002) + 1) * 0.05;
  ctx.strokeStyle = `rgba(132, 247, 255, ${glow})`;
  ctx.lineWidth = ring.lane - 18;
  ctx.beginPath();
  ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(195, 225, 255, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 32; i += 1) {
    const angle = (Math.PI * 2 * i) / 32;
    const x1 = Math.cos(angle) * (ring.r - ring.lane * 0.45);
    const y1 = Math.sin(angle) * (ring.r - ring.lane * 0.45);
    const x2 = Math.cos(angle) * (ring.r + ring.lane * 0.45);
    const y2 = Math.sin(angle) * (ring.r + ring.lane * 0.45);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawInfeed() {
  const x = ring.cx + Math.cos(INFEED_ANGLE) * (ring.r + 84);
  const y = ring.cy + Math.sin(INFEED_ANGLE) * (ring.r + 84);

  ctx.fillStyle = 'rgba(19, 39, 90, 0.95)';
  drawRoundedRect(x - 48, y - 18, 96, 36, 8);
  ctx.fill();

  ctx.strokeStyle = 'rgba(116, 188, 255, 0.65)';
  ctx.lineWidth = 2;
  drawRoundedRect(x - 48, y - 18, 96, 36, 8);
  ctx.stroke();

  ctx.fillStyle = '#d4e7ff';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INFEED', x, y + 5);
}

function drawExits() {
  for (const exit of EXITS) {
    const x = ring.cx + Math.cos(exit.angle) * (ring.r + 84);
    const y = ring.cy + Math.sin(exit.angle) * (ring.r + 84);

    ctx.fillStyle = 'rgba(17, 34, 84, 0.95)';
    drawRoundedRect(x - 58, y - 22, 116, 44, 9);
    ctx.fill();

    ctx.strokeStyle = exit.color;
    ctx.lineWidth = 2;
    drawRoundedRect(x - 58, y - 22, 116, 44, 9);
    ctx.stroke();

    ctx.fillStyle = exit.color;
    ctx.font = '700 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${exit.letter} EXIT`, x, y - 2);

    ctx.fillStyle = '#cfe0ff';
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`Key ${exit.key.toUpperCase()}`, x, y + 13);
  }
}

function drawBags(time) {
  for (const bag of state.bags) {
    const x = ring.cx + Math.cos(bag.angle) * ring.r;
    const y = ring.cy + Math.sin(bag.angle) * ring.r;

    const route = EXITS[bag.route];
    const pulse = 0.5 + Math.sin(time * 0.005 + bag.wobble * 10) * 0.2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bag.angle + Math.PI * 0.5 + bag.wobble);

    ctx.fillStyle = bag.gold ? '#ffe48f' : route.color;
    ctx.globalAlpha = bag.gold ? 0.9 : 0.72 + pulse * 0.14;
    drawRoundedRect(-16, -12, 32, 24, 6);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = bag.gold ? '#fff4cb' : 'rgba(10, 20, 45, 0.76)';
    ctx.lineWidth = 2;
    drawRoundedRect(-16, -12, 32, 24, 6);
    ctx.stroke();

    ctx.fillStyle = '#102243';
    ctx.font = '700 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(route.letter, 0, 5);

    if (bag.gold) {
      ctx.strokeStyle = 'rgba(255, 242, 176, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-7, -16);
      ctx.lineTo(0, -24);
      ctx.lineTo(7, -16);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.75);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawOverlay(text, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 9, 25, 0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#9af5ff';
  ctx.font = '700 33px "Trebuchet MS", sans-serif';
  ctx.fillText(text, canvas.width * 0.5, canvas.height * 0.5 - 12);

  ctx.fillStyle = '#d6e4ff';
  ctx.font = '600 17px "Trebuchet MS", sans-serif';
  ctx.fillText(sub, canvas.width * 0.5, canvas.height * 0.5 + 22);

  ctx.restore();
}

function drawInfo() {
  ctx.fillStyle = '#cde2ff';
  ctx.font = '700 13px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText("BAGGAGE CAROUSEL CONTROL · '95", 102, 42);

  ctx.textAlign = 'right';
  ctx.fillText(`Belt ${state.beltSpeed.toFixed(2)}x`, canvas.width - 104, 42);
}

function draw(time) {
  drawBackground();
  drawRing(time);
  drawInfeed();
  drawExits();
  drawBags(time);
  drawParticles();
  drawInfo();

  if (!state.running) {
    drawOverlay("Baggage Carousel Control '95", 'Press Start Shift to route cargo and avoid 5 jams.');
  } else if (state.paused) {
    drawOverlay('Paused', 'Press Pause again to resume belt operations.');
  }
}

function frame(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.05, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  update(dt);
  draw(ts);

  requestAnimationFrame(frame);
}

function bindHold(button, key) {
  const setKey = (value) => {
    input[key] = value;
    if (value) initAudio();
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    setKey(true);
  });
  button.addEventListener('pointerup', () => setKey(false));
  button.addEventListener('pointerleave', () => setKey(false));
  button.addEventListener('pointercancel', () => setKey(false));
}

function bindDispatch(button, exitIndex) {
  button.addEventListener('click', () => dispatch(exitIndex));
}

startBtn.addEventListener('click', () => {
  initAudio();
  startShift();
});

pauseBtn.addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';

  if (state.paused) {
    setStatus('Shift paused.', 0.7);
  } else {
    state.lastTime = performance.now();
    setStatus('Back on belt control.', 0.7);
  }
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  if (!muted) {
    initAudio();
    beep(650, 0.05, 'triangle', 0.015);
  }
});

bindHold(slowBtn, 'slow');
bindHold(fastBtn, 'fast');

bindDispatch(topBtn, 0);
bindDispatch(rightBtn, 1);
bindDispatch(bottomBtn, 2);
bindDispatch(leftBtn, 3);

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (key === 'arrowleft') input.slow = true;
  if (key === 'arrowright') input.fast = true;

  const exitIndex = EXITS.findIndex((exit) => exit.key === key);
  if (exitIndex !== -1) {
    event.preventDefault();
    dispatch(exitIndex);
  }

  if (key === 'arrowleft' || key === 'arrowright') {
    event.preventDefault();
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
  if (key === 'arrowleft') input.slow = false;
  if (key === 'arrowright') input.fast = false;
});

updateHud();
requestAnimationFrame(frame);
