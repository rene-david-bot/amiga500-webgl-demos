const BEST_KEY = 'retro_zamboni_night_shift_94_best';
const SHIFT_SECONDS = 90;
const TARGET_CLEAN = 0.85;
const DIRT_COUNT = 130;
const SPILL_LIMIT = 100;

const RINK = { x: 60, y: 52, w: 840, h: 436 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const cleanedEl = document.getElementById('cleaned');
const spillEl = document.getElementById('spill');
const streakEl = document.getElementById('streak');
const timeEl = document.getElementById('time');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');

const upBtn = document.getElementById('upBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const downBtn = document.getElementById('downBtn');
const turboBtn = document.getElementById('turboBtn');

let audioCtx = null;
let muted = false;

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  turbo: false
};

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  cleaned: 0,
  spill: 0,
  streak: 0,
  timeLeft: SHIFT_SECONDS,
  totalDirt: DIRT_COUNT,
  dirt: [],
  skaters: [],
  particles: [],
  coffee: null,
  coffeeTimer: 6,
  collisionCooldown: 0,
  messageTimer: 0,
  player: {
    x: RINK.x + RINK.w * 0.5,
    y: RINK.y + RINK.h * 0.5,
    vx: 0,
    vy: 0,
    radius: 16
  },
  lastTime: 0
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(text, seconds = 1.1) {
  statusEl.textContent = text;
  state.messageTimer = seconds;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(freq = 440, dur = 0.05, type = 'square', gainValue = 0.02, start = 0) {
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

function spawnDirt() {
  const dirt = [];
  for (let i = 0; i < DIRT_COUNT; i += 1) {
    dirt.push({
      x: rand(RINK.x + 22, RINK.x + RINK.w - 22),
      y: rand(RINK.y + 22, RINK.y + RINK.h - 22),
      r: rand(8, 14),
      cleaned: false
    });
  }
  return dirt;
}

function spawnSkaters() {
  const skaters = [];
  for (let i = 0; i < 5; i += 1) {
    skaters.push({
      x: rand(RINK.x + 40, RINK.x + RINK.w - 40),
      y: rand(RINK.y + 40, RINK.y + RINK.h - 40),
      r: rand(12, 16),
      vx: rand(-130, 130),
      vy: rand(-130, 130),
      hue: rand(185, 325)
    });
  }
  return skaters;
}

function emit(x, y, color, count = 9) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: rand(-140, 140),
      vy: rand(-180, -60),
      life: rand(0.25, 0.72),
      size: rand(2, 5),
      color
    });
  }
}

function cleanedRatio() {
  return state.cleaned / state.totalDirt;
}

function updateHud() {
  const ratio = cleanedRatio();
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  cleanedEl.textContent = `${Math.floor(ratio * 100)}%`;
  spillEl.textContent = `${Math.floor(state.spill)} / ${SPILL_LIMIT}`;
  streakEl.textContent = `x${state.streak}`;
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
}

function resetShift() {
  state.score = 0;
  state.cleaned = 0;
  state.spill = 0;
  state.streak = 0;
  state.timeLeft = SHIFT_SECONDS;
  state.totalDirt = DIRT_COUNT;
  state.dirt = spawnDirt();
  state.skaters = spawnSkaters();
  state.particles.length = 0;
  state.coffee = null;
  state.coffeeTimer = rand(6, 10);
  state.collisionCooldown = 0;
  state.messageTimer = 0;

  state.player.x = RINK.x + RINK.w * 0.5;
  state.player.y = RINK.y + RINK.h * 0.5;
  state.player.vx = 0;
  state.player.vy = 0;
}

function startShift() {
  resetShift();
  state.running = true;
  state.paused = false;
  pauseBtn.textContent = 'Pause';
  state.lastTime = performance.now();

  setStatus('Shift started. Polish hard and dodge skaters.', 1.3);
  beep(620, 0.05, 'triangle', 0.02);
  beep(840, 0.05, 'square', 0.018, 0.06);
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

  if (success) {
    setStatus(`${reason} Final score ${Math.floor(state.score)}.`, 2.4);
    beep(740, 0.05, 'triangle', 0.02);
    beep(940, 0.07, 'square', 0.016, 0.05);
  } else {
    setStatus(`${reason} Final score ${Math.floor(state.score)}.`, 2.4);
    beep(220, 0.1, 'sawtooth', 0.022);
    beep(170, 0.12, 'triangle', 0.02, 0.1);
  }

  updateHud();
}

function spawnCoffee() {
  state.coffee = {
    x: rand(RINK.x + 28, RINK.x + RINK.w - 28),
    y: rand(RINK.y + 28, RINK.y + RINK.h - 28),
    r: 12,
    ttl: 8
  };
}

function updatePlayer(dt) {
  const player = state.player;
  let ax = 0;
  let ay = 0;

  if (input.left) ax -= 1;
  if (input.right) ax += 1;
  if (input.up) ay -= 1;
  if (input.down) ay += 1;

  if (ax || ay) {
    const len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;
  }

  const turbo = input.turbo ? 1.75 : 1;
  const accel = 640 * turbo;
  player.vx += ax * accel * dt;
  player.vy += ay * accel * dt;

  const friction = Math.pow(0.04, dt);
  player.vx *= friction;
  player.vy *= friction;

  const maxSpeed = 245 * turbo;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < RINK.x + player.radius) {
    player.x = RINK.x + player.radius;
    player.vx *= -0.2;
  }
  if (player.x > RINK.x + RINK.w - player.radius) {
    player.x = RINK.x + RINK.w - player.radius;
    player.vx *= -0.2;
  }
  if (player.y < RINK.y + player.radius) {
    player.y = RINK.y + player.radius;
    player.vy *= -0.2;
  }
  if (player.y > RINK.y + RINK.h - player.radius) {
    player.y = RINK.y + RINK.h - player.radius;
    player.vy *= -0.2;
  }
}

function updateDirt() {
  const player = state.player;

  for (const dirt of state.dirt) {
    if (dirt.cleaned) continue;

    const reach = player.radius + dirt.r + 3;
    if (Math.hypot(player.x - dirt.x, player.y - dirt.y) <= reach) {
      dirt.cleaned = true;
      state.cleaned += 1;
      state.streak += 1;
      const gain = 7 + Math.min(24, Math.floor(state.streak * 1.6));
      state.score += gain;
      emit(dirt.x, dirt.y, '#8affd1', 8);
      if (state.streak % 12 === 0) {
        setStatus(`Hot streak x${state.streak}!`, 0.8);
        beep(760, 0.035, 'triangle', 0.015);
      }
    }
  }
}

function updateSkaters(dt) {
  const player = state.player;
  const ratio = cleanedRatio();

  for (const skater of state.skaters) {
    const speedMul = 1 + ratio * 0.42;
    skater.x += skater.vx * dt * speedMul;
    skater.y += skater.vy * dt * speedMul;

    if (skater.x < RINK.x + skater.r || skater.x > RINK.x + RINK.w - skater.r) {
      skater.vx *= -1;
      skater.x = clamp(skater.x, RINK.x + skater.r, RINK.x + RINK.w - skater.r);
    }
    if (skater.y < RINK.y + skater.r || skater.y > RINK.y + RINK.h - skater.r) {
      skater.vy *= -1;
      skater.y = clamp(skater.y, RINK.y + skater.r, RINK.y + RINK.h - skater.r);
    }

    const hitDist = player.radius + skater.r - 2;
    if (Math.hypot(player.x - skater.x, player.y - skater.y) <= hitDist && state.collisionCooldown <= 0) {
      state.spill += 16;
      state.streak = 0;
      state.score = Math.max(0, state.score - 35);
      state.collisionCooldown = 0.7;

      const dx = player.x - skater.x;
      const dy = player.y - skater.y;
      const len = Math.hypot(dx, dy) || 1;
      player.vx += (dx / len) * 180;
      player.vy += (dy / len) * 180;

      emit(player.x, player.y, '#ff98d8', 13);
      setStatus('Skater impact! Spill meter climbing.', 1);
      beep(210, 0.08, 'sawtooth', 0.025);
    }
  }
}

function updateCoffee(dt) {
  if (state.coffee) {
    state.coffee.ttl -= dt;
    if (state.coffee.ttl <= 0) {
      state.coffee = null;
      state.coffeeTimer = rand(5, 10);
    } else {
      const reach = state.player.radius + state.coffee.r + 2;
      if (Math.hypot(state.player.x - state.coffee.x, state.player.y - state.coffee.y) <= reach) {
        state.spill = Math.max(0, state.spill - 24);
        state.score += 70;
        state.timeLeft = Math.min(SHIFT_SECONDS + 6, state.timeLeft + 1.8);
        emit(state.coffee.x, state.coffee.y, '#ffe68c', 14);
        setStatus('Coffee boost! Spill cooled and time extended.', 1.15);
        beep(560, 0.05, 'triangle', 0.018);
        state.coffee = null;
        state.coffeeTimer = rand(8, 13);
      }
    }
    return;
  }

  state.coffeeTimer -= dt;
  if (state.coffeeTimer <= 0) {
    spawnCoffee();
    setStatus('Coffee cup on the ice!', 1);
    beep(680, 0.045, 'square', 0.014);
  }
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
    const success = cleanedRatio() >= TARGET_CLEAN;
    finishShift(success ? 'Shift complete, rink shines.' : 'Shift ended, rink still too messy.', success);
    return;
  }

  state.collisionCooldown = Math.max(0, state.collisionCooldown - dt);

  updatePlayer(dt);
  updateDirt();
  updateSkaters(dt);
  updateCoffee(dt);
  updateParticles(dt);

  if (cleanedRatio() >= TARGET_CLEAN) {
    state.score += Math.floor(state.timeLeft * 20);
    finishShift('Perfect polish! Shift cleared early.', true);
    return;
  }

  if (state.spill >= SPILL_LIMIT) {
    state.spill = SPILL_LIMIT;
    finishShift('Spill meter maxed. Supervisor pulled the plug.', false);
    return;
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) {
      statusEl.textContent = 'Keep cleaning lanes and stay clear of skaters.';
    }
  }

  updateHud();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#07173a');
  g.addColorStop(0.48, '#0a1d47');
  g.addColorStop(1, '#05122e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(91, 203, 255, 0.08)';
  ctx.fillRect(RINK.x, RINK.y, RINK.w, RINK.h);

  ctx.strokeStyle = 'rgba(129, 183, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(RINK.x, RINK.y, RINK.w, RINK.h);

  ctx.strokeStyle = 'rgba(169, 109, 255, 0.28)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i += 1) {
    const x = RINK.x + (RINK.w / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, RINK.y + 8);
    ctx.lineTo(x, RINK.y + RINK.h - 8);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(110, 241, 255, 0.2)';
  for (let y = RINK.y + 22; y < RINK.y + RINK.h; y += 26) {
    ctx.beginPath();
    ctx.moveTo(RINK.x + 10, y);
    ctx.lineTo(RINK.x + RINK.w - 10, y);
    ctx.stroke();
  }
}

function drawDirt() {
  for (const dirt of state.dirt) {
    if (!dirt.cleaned) {
      ctx.fillStyle = 'rgba(200, 150, 110, 0.34)';
      ctx.beginPath();
      ctx.arc(dirt.x, dirt.y, dirt.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(122, 92, 72, 0.28)';
      ctx.beginPath();
      ctx.arc(dirt.x + 1.5, dirt.y - 1.5, dirt.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(121, 244, 255, 0.11)';
      ctx.beginPath();
      ctx.arc(dirt.x, dirt.y, dirt.r * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCoffee() {
  if (!state.coffee) return;
  const c = state.coffee;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(-8, -7, 16, 14);
  ctx.strokeStyle = '#8d5c22';
  ctx.lineWidth = 2;
  ctx.strokeRect(-8, -7, 16, 14);
  ctx.beginPath();
  ctx.arc(10, -1, 4, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#8e5e2f';
  ctx.fillRect(-6, -5, 12, 5);
  ctx.restore();
}

function drawSkaters(time) {
  for (const skater of state.skaters) {
    const pulse = 0.5 + Math.sin(time * 0.005 + skater.hue) * 0.2;
    ctx.fillStyle = `hsla(${skater.hue}, 90%, 68%, ${0.55 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.arc(skater.x, skater.y, skater.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `hsla(${skater.hue + 24}, 100%, 82%, 0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(skater.x, skater.y, skater.r - 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(time) {
  const p = state.player;
  const turboOn = input.turbo && state.running && !state.paused;

  ctx.save();
  ctx.translate(p.x, p.y);

  if (turboOn) {
    ctx.fillStyle = 'rgba(255, 241, 158, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-20, 0, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#8df6ff';
  ctx.fillRect(-18, -11, 32, 22);
  ctx.fillStyle = '#2f5670';
  ctx.fillRect(-6, -8, 16, 11);
  ctx.fillStyle = '#fff7c6';
  ctx.fillRect(11, -7, 6, 5);

  ctx.fillStyle = '#70ffbf';
  ctx.fillRect(-22, 8, 37, 5);
  ctx.fillStyle = 'rgba(128, 255, 219, 0.5)';
  ctx.fillRect(-24, 12, 41, 3);

  ctx.fillStyle = '#c8d9ff';
  ctx.beginPath();
  ctx.arc(-11, 14, 5, 0, Math.PI * 2);
  ctx.arc(7, 14, 5, 0, Math.PI * 2);
  ctx.fill();

  if (state.collisionCooldown > 0) {
    ctx.strokeStyle = `rgba(255, 120, 194, ${0.4 + Math.sin(time * 0.025) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-24, -16, 44, 35);
  }

  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.72);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawProgress() {
  const ratio = cleanedRatio();
  const w = 260;
  const h = 10;
  const x = canvas.width - w - 22;
  const y = 20;

  ctx.fillStyle = 'rgba(7, 14, 32, 0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ratio >= TARGET_CLEAN ? '#8dffca' : '#7ee9ff';
  ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = 'rgba(149, 189, 255, 0.55)';
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#d6e7ff';
  ctx.font = '600 13px "Trebuchet MS", sans-serif';
  ctx.fillText(`Clean target ${(TARGET_CLEAN * 100).toFixed(0)}%`, x, y - 5);
}

function drawOverlay(text, sub) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 9, 25, 0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9af5ff';
  ctx.font = '700 34px "Trebuchet MS", sans-serif';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#d6e4ff';
  ctx.font = '600 17px "Trebuchet MS", sans-serif';
  ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 23);
  ctx.restore();
}

function draw(time) {
  drawBackground();
  drawDirt();
  drawCoffee();
  drawSkaters(time);
  drawPlayer(time);
  drawParticles();
  drawProgress();

  ctx.fillStyle = '#9ec5ff';
  ctx.font = '700 13px "Trebuchet MS", sans-serif';
  ctx.fillText("ZAMBONI LANE GRID · '94", RINK.x + 8, RINK.y - 10);

  if (!state.running) {
    drawOverlay("Zamboni Night Shift '94", 'Start Shift to clean 85% of the rink before dawn.');
  } else if (state.paused) {
    drawOverlay('Paused', 'Press Pause again to resume your shift.');
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
    setStatus('Back to polishing.', 0.7);
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

bindHold(upBtn, 'up');
bindHold(leftBtn, 'left');
bindHold(rightBtn, 'right');
bindHold(downBtn, 'down');
bindHold(turboBtn, 'turbo');

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();

  if (key === 'arrowup' || key === 'w') input.up = true;
  if (key === 'arrowdown' || key === 's') input.down = true;
  if (key === 'arrowleft' || key === 'a') input.left = true;
  if (key === 'arrowright' || key === 'd') input.right = true;
  if (key === 'shift') input.turbo = true;

  if (
    key === 'arrowup' || key === 'w' || key === 'arrowdown' || key === 's' ||
    key === 'arrowleft' || key === 'a' || key === 'arrowright' || key === 'd' || key === 'shift'
  ) {
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

  if (key === 'arrowup' || key === 'w') input.up = false;
  if (key === 'arrowdown' || key === 's') input.down = false;
  if (key === 'arrowleft' || key === 'a') input.left = false;
  if (key === 'arrowright' || key === 'd') input.right = false;
  if (key === 'shift') input.turbo = false;
});

updateHud();
requestAnimationFrame(frame);
