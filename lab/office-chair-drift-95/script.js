const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const lapLabel = document.getElementById('lapLabel');
const checkpointLabel = document.getElementById('checkpointLabel');
const speedLabel = document.getElementById('speedLabel');
const timeLabel = document.getElementById('timeLabel');
const bestLapLabel = document.getElementById('bestLapLabel');
const statusLabel = document.getElementById('statusLabel');
const boostFill = document.getElementById('boostFill');
const boostLabel = document.getElementById('boostLabel');

const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

const TRACK = { x: 34, y: 34, w: 892, h: 492 };
const TARGET_LAPS = 3;
const RACE_TIME = 100;

const obstacles = [
  { x: 300, y: 180, w: 360, h: 200 },
  { x: 140, y: 110, w: 120, h: 110 },
  { x: 700, y: 105, w: 120, h: 95 },
  { x: 710, y: 360, w: 120, h: 95 },
  { x: 150, y: 360, w: 120, h: 95 }
];

const checkpoints = [
  { x: 125, y: 280, r: 22, name: 'Start Gate' },
  { x: 325, y: 90, r: 20, name: 'Top Lane' },
  { x: 770, y: 145, r: 20, name: 'East Bend' },
  { x: 835, y: 425, r: 20, name: 'South Curve' },
  { x: 310, y: 475, r: 20, name: 'Warehouse Cut' }
];

const pickupSlots = [
  { x: 260, y: 130 },
  { x: 590, y: 120 },
  { x: 815, y: 260 },
  { x: 620, y: 470 },
  { x: 235, y: 430 }
];

const pickups = pickupSlots.map((slot, index) => ({
  ...slot,
  active: true,
  phase: Math.random() * Math.PI * 2,
  respawnAt: 0,
  id: index
}));

const player = {
  x: checkpoints[0].x - 38,
  y: checkpoints[0].y,
  angle: 0,
  vx: 0,
  vy: 0,
  radius: 12
};

const state = {
  running: false,
  finished: false,
  success: false,
  raceTime: 0,
  lap: 0,
  nextCheckpoint: 1,
  lapStartAt: 0,
  bestLap: null,
  boost: 100,
  lastStatus: 'Ready for overtime drift.',
  statusColor: '#cfe2ff',
  skidMarks: [],
  crashCooldown: 0,
  audio: null,
  keys: Object.create(null)
};

let lastFrame = performance.now();

function ensureAudio() {
  if (state.audio) return;
  state.audio = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq = 600, duration = 0.08, gain = 0.03, type = 'square') {
  if (!state.audio) return;
  const t = state.audio.currentTime;
  const osc = state.audio.createOscillator();
  const amp = state.audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(amp).connect(state.audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function setStatus(text, color = '#cfe2ff') {
  state.lastStatus = text;
  state.statusColor = color;
}

function formatSec(value) {
  return `${value.toFixed(1)}s`;
}

function resetRace({ autoStart = false } = {}) {
  player.x = checkpoints[0].x - 38;
  player.y = checkpoints[0].y;
  player.angle = 0;
  player.vx = 0;
  player.vy = 0;

  state.running = autoStart;
  state.finished = false;
  state.success = false;
  state.raceTime = 0;
  state.lap = 0;
  state.nextCheckpoint = 1;
  state.lapStartAt = 0;
  state.boost = 100;
  state.skidMarks.length = 0;
  state.crashCooldown = 0;

  for (const pickup of pickups) {
    pickup.active = true;
    pickup.respawnAt = 0;
  }

  setStatus(autoStart ? 'Race live. Hit all gates in order.' : 'Reset ready. Press Start race.', '#cfe2ff');
  syncHud();
}

function collidesCircle(x, y, radius) {
  if (x - radius < TRACK.x || y - radius < TRACK.y || x + radius > TRACK.x + TRACK.w || y + radius > TRACK.y + TRACK.h) {
    return true;
  }

  for (const rect of obstacles) {
    if (
      x + radius > rect.x &&
      x - radius < rect.x + rect.w &&
      y + radius > rect.y &&
      y - radius < rect.y + rect.h
    ) {
      return true;
    }
  }

  return false;
}

function handleInput(dt) {
  const up = state.keys.ArrowUp || state.keys.KeyW;
  const down = state.keys.ArrowDown || state.keys.KeyS;
  const left = state.keys.ArrowLeft || state.keys.KeyA;
  const right = state.keys.ArrowRight || state.keys.KeyD;
  const handbrake = state.keys.Space;
  const boosting = (state.keys.ShiftLeft || state.keys.ShiftRight) && state.boost > 0;

  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const perpX = -dirY;
  const perpY = dirX;

  let forwardAcc = 0;
  if (up) forwardAcc += 420;
  if (down) forwardAcc -= 260;
  if (boosting) {
    forwardAcc += 360;
    state.boost = Math.max(0, state.boost - 36 * dt);
  }

  player.vx += dirX * forwardAcc * dt;
  player.vy += dirY * forwardAcc * dt;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > 1) {
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0) {
      const turnFactor = Math.min(1.7, 0.55 + speed / 170);
      player.angle += steer * turnFactor * dt;
    }
  }

  const forwardSpeed = player.vx * dirX + player.vy * dirY;
  let lateralSpeed = player.vx * perpX + player.vy * perpY;

  const lateralGrip = handbrake ? 0.18 : 0.42;
  const lateralDamp = Math.max(0, 1 - lateralGrip * dt * 8.5);
  lateralSpeed *= lateralDamp;

  player.vx = dirX * forwardSpeed + perpX * lateralSpeed;
  player.vy = dirY * forwardSpeed + perpY * lateralSpeed;

  const drag = handbrake ? 2.9 : 1.45;
  const dragScale = Math.max(0, 1 - drag * dt);
  player.vx *= dragScale;
  player.vy *= dragScale;

  const maxSpeed = boosting ? 410 : 320;
  const currentSpeed = Math.hypot(player.vx, player.vy);
  if (currentSpeed > maxSpeed) {
    const scale = maxSpeed / currentSpeed;
    player.vx *= scale;
    player.vy *= scale;
  }

  if (!boosting) {
    state.boost = Math.min(100, state.boost + 7.5 * dt);
  }

  if ((left || right) && speed > 100) {
    state.skidMarks.push({
      x: player.x - dirX * 10,
      y: player.y - dirY * 10,
      life: 0.5 + Math.random() * 0.25,
      radius: 1 + Math.random() * 2.3,
      hue: 190 + Math.random() * 40
    });
  }
}

function stepPhysics(dt) {
  const prevX = player.x;
  const prevY = player.y;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (collidesCircle(player.x, player.y, player.radius)) {
    player.x = prevX;
    player.y = prevY;
    player.vx *= -0.26;
    player.vy *= -0.26;

    if (state.crashCooldown <= 0) {
      state.crashCooldown = 0.22;
      setStatus('Spin-out! Watch the cubicle corners.', '#ffc2a4');
      beep(180, 0.12, 0.04, 'sawtooth');
    }
  }
}

function checkpointLogic() {
  const cp = checkpoints[state.nextCheckpoint];
  const dx = player.x - cp.x;
  const dy = player.y - cp.y;
  const hitRadius = cp.r + player.radius;

  if (dx * dx + dy * dy > hitRadius * hitRadius) return;

  beep(760, 0.05, 0.022, 'triangle');

  if (state.nextCheckpoint === 0) {
    state.lap += 1;
    const lapTime = state.raceTime - state.lapStartAt;
    state.lapStartAt = state.raceTime;

    if (state.bestLap === null || lapTime < state.bestLap) {
      state.bestLap = lapTime;
    }

    beep(980, 0.06, 0.028, 'triangle');
    beep(1280, 0.07, 0.02, 'square');

    if (state.lap >= TARGET_LAPS) {
      state.finished = true;
      state.running = false;
      state.success = true;
      setStatus(`Win! Cleared ${TARGET_LAPS} laps in ${state.raceTime.toFixed(1)}s.`, '#aef6c9');
      startBtn.textContent = 'Race again';
      return;
    }

    state.nextCheckpoint = 1;
    setStatus(`Lap ${state.lap} locked. Keep it tight.`, '#aee9ff');
    return;
  }

  state.nextCheckpoint += 1;
  if (state.nextCheckpoint >= checkpoints.length) {
    state.nextCheckpoint = 0;
    setStatus('Final gate hit. Cross start line to count the lap.', '#ffe2aa');
  } else {
    setStatus(`Checkpoint ${state.nextCheckpoint} armed.`, '#d2e2ff');
  }
}

function pickupLogic() {
  for (const pickup of pickups) {
    if (!pickup.active) {
      if (state.raceTime >= pickup.respawnAt) {
        pickup.active = true;
      }
      continue;
    }

    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;

    if (dx * dx + dy * dy < 24 * 24) {
      pickup.active = false;
      pickup.respawnAt = state.raceTime + 7 + Math.random() * 3;
      state.boost = Math.min(100, state.boost + 30);
      setStatus('Coffee pickup! Boost refilled.', '#ffd8a2');
      beep(1180, 0.05, 0.022, 'triangle');
      beep(1500, 0.05, 0.018, 'square');
    }
  }
}

function update(dt) {
  state.crashCooldown = Math.max(0, state.crashCooldown - dt);

  for (const mark of state.skidMarks) {
    mark.life -= dt;
  }
  state.skidMarks = state.skidMarks.filter((mark) => mark.life > 0);

  if (!state.running || state.finished) return;

  state.raceTime += dt;

  if (state.raceTime >= RACE_TIME) {
    state.finished = true;
    state.running = false;
    state.success = false;
    setStatus('Time up. Overtime won this round.', '#ffb8b8');
    beep(180, 0.14, 0.045, 'sawtooth');
    startBtn.textContent = 'Retry race';
    return;
  }

  handleInput(dt);
  stepPhysics(dt);
  pickupLogic();
  checkpointLogic();
}

function roundedRect(x, y, w, h, r = 8) {
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

function drawBackground() {
  ctx.fillStyle = '#040915';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = 'rgba(105, 180, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#2f5187';
  ctx.lineWidth = 4;
  roundedRect(TRACK.x, TRACK.y, TRACK.w, TRACK.h, 14);
  ctx.stroke();

  ctx.fillStyle = 'rgba(12, 21, 43, 0.66)';
  roundedRect(TRACK.x + 3, TRACK.y + 3, TRACK.w - 6, TRACK.h - 6, 12);
  ctx.fill();

  for (const rect of obstacles) {
    ctx.fillStyle = '#18294d';
    roundedRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();

    ctx.strokeStyle = '#4a6ca3';
    ctx.lineWidth = 2;
    roundedRect(rect.x, rect.y, rect.w, rect.h, 10);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCheckpoints(time) {
  for (let i = 0; i < checkpoints.length; i += 1) {
    const cp = checkpoints[i];
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + i);
    const isNext = i === state.nextCheckpoint;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.r + (isNext ? pulse * 3 : 0), 0, Math.PI * 2);
    ctx.fillStyle = isNext ? 'rgba(126, 247, 255, 0.24)' : 'rgba(120, 154, 220, 0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cp.x, cp.y, cp.r - 4, 0, Math.PI * 2);
    ctx.fillStyle = isNext ? '#8bf6ff' : '#5978af';
    ctx.fill();

    ctx.fillStyle = '#041426';
    ctx.font = 'bold 12px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), cp.x, cp.y + 0.5);
    ctx.restore();
  }
}

function drawPickups(time) {
  for (const pickup of pickups) {
    if (!pickup.active) continue;
    const bob = Math.sin(time * 4 + pickup.phase) * 4;

    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);

    ctx.fillStyle = '#ffd47d';
    roundedRect(-9, -9, 18, 14, 3);
    ctx.fill();

    ctx.fillStyle = '#2a1c07';
    ctx.fillRect(-6, -6, 12, 8);

    ctx.strokeStyle = '#ffd47d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 7, 4.9, 7.6);
    ctx.stroke();

    ctx.restore();
  }
}

function drawSkids() {
  for (const mark of state.skidMarks) {
    const alpha = Math.max(0, mark.life / 0.7);
    ctx.fillStyle = `hsla(${mark.hue}, 100%, 70%, ${alpha * 0.34})`;
    ctx.beginPath();
    ctx.arc(mark.x, mark.y, mark.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChair() {
  const speed = Math.hypot(player.vx, player.vy);
  const boosting = (state.keys.ShiftLeft || state.keys.ShiftRight) && state.boost > 0 && state.running && !state.finished;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  if (boosting && speed > 120) {
    ctx.fillStyle = 'rgba(255, 223, 147, 0.7)';
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(-27 - Math.random() * 6, 0);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff9de0';
  roundedRect(-14, -8, 28, 16, 6);
  ctx.fill();

  ctx.fillStyle = '#85f4ff';
  roundedRect(-9, -16, 18, 10, 5);
  ctx.fill();

  ctx.fillStyle = '#13294a';
  ctx.fillRect(-2, 2, 4, 12);

  ctx.fillStyle = '#9ec4ff';
  for (const wheel of [-11, 0, 11]) {
    ctx.beginPath();
    ctx.arc(wheel, 12, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawOverlayText() {
  if (!state.finished) return;

  ctx.save();
  ctx.fillStyle = 'rgba(4, 9, 20, 0.64)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = state.success ? '#8ef7bf' : '#ffbab9';
  ctx.font = 'bold 42px Trebuchet MS';
  ctx.fillText(state.success ? 'SHIFT CLEARED' : 'OVERTIME LOST', canvas.width / 2, canvas.height / 2 - 12);

  ctx.fillStyle = '#d6e5ff';
  ctx.font = '20px Trebuchet MS';
  ctx.fillText(state.success ? 'Office legend status unlocked.' : 'Reset and run it cleaner.', canvas.width / 2, canvas.height / 2 + 28);
  ctx.restore();
}

function render(timeMs) {
  const time = timeMs / 1000;
  drawBackground();
  drawSkids();
  drawCheckpoints(time);
  drawPickups(time);
  drawChair();
  drawOverlayText();
}

function syncHud() {
  lapLabel.textContent = `${state.lap} / ${TARGET_LAPS}`;

  const cpDisplay = state.nextCheckpoint === 0 ? checkpoints.length : state.nextCheckpoint;
  checkpointLabel.textContent = `${cpDisplay} / ${checkpoints.length}`;

  const speed = Math.hypot(player.vx, player.vy);
  speedLabel.textContent = `${Math.round(speed)} u/s`;

  const left = Math.max(0, RACE_TIME - state.raceTime);
  timeLabel.textContent = formatSec(left);

  bestLapLabel.textContent = state.bestLap === null ? '--' : formatSec(state.bestLap);
  statusLabel.textContent = state.lastStatus;
  statusLabel.style.color = state.statusColor;

  const boostPct = Math.round(state.boost);
  boostFill.style.width = `${boostPct}%`;
  boostLabel.textContent = `Boost ${boostPct}%`;
}

function tick(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;

  update(dt);
  render(now);
  syncHud();

  requestAnimationFrame(tick);
}

window.addEventListener('keydown', (event) => {
  state.keys[event.code] = true;
  if (event.code.startsWith('Arrow') || ['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
  }
  ensureAudio();
});

window.addEventListener('keyup', (event) => {
  state.keys[event.code] = false;
});

startBtn.addEventListener('click', () => {
  ensureAudio();

  if (!state.running || state.finished) {
    resetRace({ autoStart: true });
    startBtn.textContent = 'Restart race';
    beep(820, 0.06, 0.028, 'triangle');
    setStatus('Race live. Chase checkpoint 1.', '#b5e7ff');
  } else {
    resetRace({ autoStart: true });
    beep(690, 0.05, 0.024, 'triangle');
  }
});

resetBtn.addEventListener('click', () => {
  ensureAudio();
  resetRace({ autoStart: false });
  startBtn.textContent = 'Start race';
  beep(470, 0.06, 0.025, 'triangle');
});

document.addEventListener('pointerdown', ensureAudio, { once: true });

resetRace({ autoStart: false });
requestAnimationFrame((time) => {
  lastFrame = time;
  tick(time);
});
