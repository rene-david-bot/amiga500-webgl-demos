const BEST_KEY = 'retro_neon_pinsetter_panic_93_best';
const LANES = 5;
const ROUND_TIME = 75;
const JAM_LIMIT = 8;
const SWEEP_Y = 468;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const clearedEl = document.getElementById('cleared');
const jamEl = document.getElementById('jam');
const comboEl = document.getElementById('combo');
const timeEl = document.getElementById('time');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const sweepBtn = document.getElementById('sweepBtn');

let audioCtx = null;
let muted = false;

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  cleared: 0,
  jam: 0,
  combo: 0,
  lane: Math.floor(LANES / 2),
  timeLeft: ROUND_TIME,
  sweepTimer: 0,
  spawnTimer: 0.8,
  spawnEvery: 0.8,
  messageTimer: 0,
  objects: [],
  sparks: [],
  lastTime: 0
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function laneCenter(lane) {
  const laneW = canvas.width / LANES;
  return lane * laneW + laneW * 0.5;
}

function setStatus(text, seconds = 1.2) {
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

function beep(freq = 440, dur = 0.06, type = 'square', gainValue = 0.028, start = 0) {
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

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  clearedEl.textContent = String(state.cleared);
  jamEl.textContent = `${state.jam.toFixed(1)} / ${JAM_LIMIT}`;
  comboEl.textContent = `x${state.combo}`;
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
}

function addSparks(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    state.sparks.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-190, -70),
      life: rand(0.25, 0.7),
      size: rand(2, 5),
      color
    });
  }
}

function spawnObject() {
  const lane = randInt(0, LANES - 1);
  const difficulty = 1 + (ROUND_TIME - state.timeLeft) / ROUND_TIME;
  const speedBase = 170 + difficulty * 56;
  const roll = Math.random();

  let type = 'pin';
  if (roll > 0.72 && roll <= 0.93) type = 'ball';
  if (roll > 0.93) type = 'gold';

  state.objects.push({
    lane,
    x: laneCenter(lane),
    y: -34,
    speed: speedBase + rand(-35, 55),
    type,
    spin: rand(-3.5, 3.5)
  });
}

function startShift() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.cleared = 0;
  state.jam = 0;
  state.combo = 0;
  state.lane = Math.floor(LANES / 2);
  state.timeLeft = ROUND_TIME;
  state.sweepTimer = 0;
  state.spawnTimer = 0.7;
  state.spawnEvery = 0.78;
  state.messageTimer = 0;
  state.objects.length = 0;
  state.sparks.length = 0;
  state.lastTime = performance.now();

  pauseBtn.textContent = 'Pause';
  setStatus('Shift started. Sweep smart and protect the pinsetter.', 1.6);
  beep(640, 0.06, 'triangle', 0.02);
  beep(880, 0.05, 'square', 0.018, 0.06);
  updateHud();
}

function finishShift(reason) {
  state.running = false;
  state.paused = false;
  pauseBtn.textContent = 'Pause';

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }

  setStatus(`${reason} Final score ${Math.floor(state.score)}.`, 2.3);
  beep(230, 0.11, 'triangle', 0.02);
  beep(170, 0.12, 'sawtooth', 0.018, 0.1);
  updateHud();
}

function moveLane(dir) {
  if (!state.running || state.paused) return;
  state.lane = clamp(state.lane + dir, 0, LANES - 1);
  beep(420 + state.lane * 35, 0.03, 'square', 0.012);
}

function attemptSweep() {
  if (!state.running || state.paused || state.sweepTimer > 0) return;

  state.sweepTimer = 0.24;
  const lane = state.lane;
  let hits = 0;
  let ballHit = false;

  for (let i = state.objects.length - 1; i >= 0; i -= 1) {
    const obj = state.objects[i];
    if (obj.lane !== lane || Math.abs(obj.y - SWEEP_Y) > 42) continue;

    if (obj.type === 'ball') {
      state.jam += 2;
      state.combo = 0;
      ballHit = true;
      addSparks(obj.x, obj.y, '#ff8a8a', 10);
      state.objects.splice(i, 1);
      continue;
    }

    const isGold = obj.type === 'gold';
    const gain = isGold ? 140 + state.combo * 12 : 38 + state.combo * 6;
    state.score += gain;
    state.cleared += 1;
    state.combo += isGold ? 2 : 1;
    state.jam = Math.max(0, state.jam - (isGold ? 0.9 : 0.35));
    if (isGold) {
      state.timeLeft = Math.min(ROUND_TIME + 8, state.timeLeft + 1.4);
      addSparks(obj.x, obj.y, '#ffe180', 12);
    } else {
      addSparks(obj.x, obj.y, '#89ffcf', 8);
    }

    state.objects.splice(i, 1);
    hits += 1;
  }

  if (ballHit) {
    setStatus('Ouch. You clipped a bowling ball and stressed the machine!', 1.2);
    beep(190, 0.1, 'sawtooth', 0.025);
  } else if (hits > 0) {
    setStatus(`Clean sweep! ${hits} pin${hits === 1 ? '' : 's'} cleared.`, 0.95);
    beep(650, 0.04, 'triangle', 0.02);
    beep(830, 0.035, 'square', 0.015, 0.04);
  } else {
    state.combo = Math.max(0, state.combo - 1);
    setStatus('Sweep missed the timing window.', 0.7);
    beep(300, 0.05, 'triangle', 0.012);
  }

  if (state.jam >= JAM_LIMIT) {
    state.jam = JAM_LIMIT;
    finishShift('Machine jammed out');
  }

  updateHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    finishShift('Shift complete');
    return;
  }

  state.spawnEvery = Math.max(0.34, 0.82 - ((ROUND_TIME - state.timeLeft) / ROUND_TIME) * 0.4);
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnObject();
    state.spawnTimer = state.spawnEvery;
  }

  state.sweepTimer = Math.max(0, state.sweepTimer - dt);

  for (let i = state.objects.length - 1; i >= 0; i -= 1) {
    const obj = state.objects[i];
    obj.y += obj.speed * dt;

    if (obj.y > 508) {
      if (obj.type === 'pin' || obj.type === 'gold') {
        const jamGain = obj.type === 'gold' ? 1.7 : 0.9;
        state.jam += jamGain;
        state.combo = 0;
        addSparks(obj.x, 503, '#ff9bbd', obj.type === 'gold' ? 11 : 7);
        if (obj.type === 'gold') {
          setStatus('Missed gold pin, heavy jam spike!', 0.9);
          beep(180, 0.09, 'sawtooth', 0.024);
        }
      } else {
        state.score += 4;
      }
      state.objects.splice(i, 1);
    }
  }

  for (let i = state.sparks.length - 1; i >= 0; i -= 1) {
    const p = state.sparks[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 360 * dt;
    p.life -= dt;
    if (p.life <= 0) state.sparks.splice(i, 1);
  }

  if (state.jam >= JAM_LIMIT) {
    state.jam = JAM_LIMIT;
    finishShift('Machine jammed out');
    return;
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) {
      statusEl.textContent = 'Keep lanes moving. Sweep pins, avoid bowling balls.';
    }
  }

  updateHud();
}

function drawBackdrop() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#071233');
  grad.addColorStop(0.52, '#0a183f');
  grad.addColorStop(1, '#041126');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = '#7ce9ff';
  ctx.lineWidth = 1;
  for (let y = 20; y < canvas.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + ((performance.now() * 0.02) % 24));
    ctx.lineTo(canvas.width, y + ((performance.now() * 0.02) % 24));
    ctx.stroke();
  }
  ctx.restore();

  const laneW = canvas.width / LANES;
  for (let lane = 0; lane < LANES; lane += 1) {
    const x = lane * laneW;
    ctx.fillStyle = lane === state.lane ? 'rgba(114, 245, 255, 0.13)' : 'rgba(116, 146, 220, 0.08)';
    ctx.fillRect(x + 8, 44, laneW - 16, 460);

    ctx.strokeStyle = 'rgba(132, 170, 255, 0.3)';
    ctx.strokeRect(x + 8, 44, laneW - 16, 460);
  }

  ctx.fillStyle = 'rgba(255, 130, 205, 0.26)';
  ctx.fillRect(0, SWEEP_Y + 20, canvas.width, 16);
  ctx.fillStyle = 'rgba(123, 247, 255, 0.4)';
  ctx.fillRect(0, SWEEP_Y + 36, canvas.width, 3);
}

function drawPin(obj, gold = false) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(Math.sin(performance.now() * 0.002 + obj.spin) * 0.05);

  ctx.fillStyle = gold ? '#ffe08f' : '#f2f7ff';
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = gold ? '#ffb54f' : '#ff7cb7';
  ctx.fillRect(-8, 4, 16, 4);
  ctx.fillRect(-7, 0, 14, 3);
  ctx.restore();
}

function drawBall(obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate((performance.now() * 0.004 + obj.spin) % (Math.PI * 2));

  const ballGrad = ctx.createRadialGradient(-4, -5, 2, 0, 0, 20);
  ballGrad.addColorStop(0, '#ffbdf0');
  ballGrad.addColorStop(1, '#c14e9f');
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(65, 12, 47, 0.55)';
  ctx.beginPath();
  ctx.arc(5, -5, 3, 0, Math.PI * 2);
  ctx.arc(2, 0, 2.6, 0, Math.PI * 2);
  ctx.arc(7, 1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSweepArm() {
  const laneW = canvas.width / LANES;
  const x = laneW * state.lane + 10;
  const width = laneW - 20;
  const active = state.sweepTimer > 0;

  ctx.fillStyle = active ? 'rgba(145, 255, 218, 0.85)' : 'rgba(130, 230, 255, 0.48)';
  ctx.fillRect(x, SWEEP_Y - 4, width, active ? 14 : 10);

  ctx.strokeStyle = active ? '#fff3a0' : '#7fe7ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, SWEEP_Y - 4, width, active ? 14 : 10);
}

function drawObjects() {
  for (const obj of state.objects) {
    if (obj.type === 'ball') drawBall(obj);
    if (obj.type === 'pin') drawPin(obj, false);
    if (obj.type === 'gold') drawPin(obj, true);
  }
}

function drawSparks() {
  for (const p of state.sparks) {
    ctx.globalAlpha = Math.max(0, p.life / 0.7);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackdrop();
  drawObjects();
  drawSweepArm();
  drawSparks();

  ctx.fillStyle = '#9dc3ff';
  ctx.font = '700 14px "Trebuchet MS", sans-serif';
  ctx.fillText('PINSETTER LIP', 12, SWEEP_Y + 16);

  if (!state.running) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 10, 24, 0.56)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9ef8ff';
    ctx.font = '700 33px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Neon Pinsetter Panic '93", canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = '#d2e2ff';
    ctx.font = '600 17px "Trebuchet MS", sans-serif';
    ctx.fillText('Start Shift to run the bowling alley machine.', canvas.width / 2, canvas.height / 2 + 24);
    ctx.restore();
  } else if (state.paused) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 10, 24, 0.48)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff4a4';
    ctx.font = '700 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

function frame(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.05, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  update(dt);
  draw();

  requestAnimationFrame(frame);
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
    setStatus('Shift paused.', 0.8);
  } else {
    setStatus('Back on shift. Keep it clean.', 0.8);
    state.lastTime = performance.now();
  }
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  if (!muted) {
    initAudio();
    beep(640, 0.05, 'triangle', 0.015);
  }
});

leftBtn.addEventListener('click', () => moveLane(-1));
rightBtn.addEventListener('click', () => moveLane(1));
sweepBtn.addEventListener('click', () => {
  initAudio();
  attemptSweep();
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    moveLane(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    moveLane(1);
  } else if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    initAudio();
    attemptSweep();
  } else if (event.key.toLowerCase() === 'p') {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  }
});

updateHud();
requestAnimationFrame(frame);
