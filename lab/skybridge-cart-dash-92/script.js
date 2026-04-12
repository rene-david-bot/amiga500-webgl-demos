const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const fuelEl = document.getElementById('fuel');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const LANES = 5;
const PLAYER_Y = canvas.height - 96;
const ROUND_SECONDS = 75;
const BEST_KEY = 'skybridge-cart-dash-92-best';

const keys = new Set();
let audioCtx;

const state = {
  running: false,
  ended: false,
  lane: 2,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  fuel: 100,
  timeLeft: ROUND_SECONDS,
  scroll: 0,
  speed: 180,
  spawnObstacleIn: 0.65,
  spawnPickupIn: 1.35,
  hitFlash: 0,
  combo: 0,
  obstacles: [],
  pickups: [],
  lastMs: performance.now()
};

bestEl.textContent = String(state.best);

function laneCenter(lane) {
  const laneW = canvas.width / LANES;
  return laneW * lane + laneW * 0.5;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 440, dur = 0.07, type = 'square', gain = 0.03) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.start(now);
  o.stop(now + dur);
}

function resetRound() {
  state.running = false;
  state.ended = false;
  state.lane = 2;
  state.score = 0;
  state.fuel = 100;
  state.timeLeft = ROUND_SECONDS;
  state.scroll = 0;
  state.speed = 180;
  state.spawnObstacleIn = 0.5;
  state.spawnPickupIn = 1.2;
  state.hitFlash = 0;
  state.combo = 0;
  state.obstacles.length = 0;
  state.pickups.length = 0;
  updateHud();
  setStatus('Service cart calibrated. Ready to dash.');
}

function startRound() {
  ensureAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  if (!state.ended && state.running) return;
  if (state.ended) resetRound();
  state.running = true;
  setStatus('Shift live. Deliver passes and dodge baggage carts.');
  beep(680, 0.08);
  beep(920, 0.1, 'triangle', 0.02);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANES);
  const type = Math.random() < 0.5 ? 'cart' : 'cone';
  state.obstacles.push({ lane, y: -70, type });
}

function spawnPickup() {
  const lane = Math.floor(Math.random() * LANES);
  const type = Math.random() < 0.76 ? 'pass' : 'battery';
  state.pickups.push({ lane, y: -60, type });
}

function movePlayer(step) {
  const nextLane = clamp(state.lane + step, 0, LANES - 1);
  if (nextLane !== state.lane) {
    state.lane = nextLane;
    beep(280 + state.lane * 45, 0.04, 'square', 0.016);
  }
}

function update(dt) {
  if (!state.running) return;

  state.timeLeft -= dt;
  state.fuel -= dt * 6.4;
  state.speed = Math.min(340, state.speed + dt * 3.2);
  state.scroll += dt * state.speed;
  state.hitFlash = Math.max(0, state.hitFlash - dt * 2.8);

  state.score += dt * (state.speed * 0.28) + state.combo * dt * 4;

  state.spawnObstacleIn -= dt;
  if (state.spawnObstacleIn <= 0) {
    spawnObstacle();
    state.spawnObstacleIn = rand(0.38, 0.92);
  }

  state.spawnPickupIn -= dt;
  if (state.spawnPickupIn <= 0) {
    spawnPickup();
    state.spawnPickupIn = rand(0.85, 1.7);
  }

  const speedFactor = dt * state.speed;
  state.obstacles.forEach((o) => {
    o.y += speedFactor * 0.92;
  });
  state.pickups.forEach((p) => {
    p.y += speedFactor * 0.86;
  });

  const laneW = canvas.width / LANES;
  const playerX = laneCenter(state.lane);

  state.obstacles = state.obstacles.filter((o) => {
    const ox = laneCenter(o.lane);
    const dy = Math.abs(o.y - PLAYER_Y);
    const dx = Math.abs(ox - playerX);
    if (dy < 40 && dx < laneW * 0.34) {
      state.fuel -= o.type === 'cart' ? 30 : 18;
      state.combo = 0;
      state.hitFlash = 1;
      setStatus(o.type === 'cart' ? 'Crash! Heavy baggage impact.' : 'Cone hit. Keep it clean.');
      beep(120, 0.13, 'sawtooth', 0.05);
      return false;
    }
    return o.y < canvas.height + 90;
  });

  state.pickups = state.pickups.filter((p) => {
    const px = laneCenter(p.lane);
    const dy = Math.abs(p.y - PLAYER_Y);
    const dx = Math.abs(px - playerX);
    if (dy < 38 && dx < laneW * 0.32) {
      if (p.type === 'pass') {
        state.score += 130;
        state.combo += 1;
        setStatus(`Pass delivered. Combo x${Math.min(9, state.combo)}.`);
        beep(760, 0.06, 'triangle', 0.02);
      } else {
        state.fuel = Math.min(100, state.fuel + 26);
        state.score += 80;
        setStatus('Battery pickup secured.');
        beep(540, 0.08, 'square', 0.02);
      }
      return false;
    }
    return p.y < canvas.height + 80;
  });

  if (state.fuel <= 0 || state.timeLeft <= 0) {
    endRound();
  }

  updateHud();
}

function endRound() {
  if (state.ended) return;
  state.running = false;
  state.ended = true;
  state.timeLeft = Math.max(0, state.timeLeft);
  state.fuel = Math.max(0, state.fuel);

  const final = Math.floor(state.score);
  if (final > state.best) {
    state.best = final;
    localStorage.setItem(BEST_KEY, String(final));
    setStatus(`New terminal record: ${final}.`);
    beep(980, 0.08, 'triangle', 0.03);
    beep(1240, 0.12, 'triangle', 0.03);
  } else {
    setStatus(final >= 1500 ? `Shift complete: ${final}. Push for the leaderboard.` : `Shift failed at ${final}. Try a cleaner line.`);
    beep(250, 0.12, 'square', 0.02);
  }
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score));
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
  fuelEl.textContent = `${Math.max(0, Math.round(state.fuel))}%`;
  bestEl.textContent = String(state.best);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#10203b');
  g.addColorStop(0.4, '#11162c');
  g.addColorStop(1, '#090a16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const laneW = canvas.width / LANES;

  for (let i = 0; i <= LANES; i += 1) {
    const x = i * laneW;
    ctx.strokeStyle = i === 0 || i === LANES ? '#94e7ff66' : '#7b89cc44';
    ctx.lineWidth = i === 0 || i === LANES ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  const dashH = 32;
  const gap = 24;
  const track = dashH + gap;
  const offset = state.scroll % track;

  ctx.fillStyle = '#d6e1ff55';
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = lane * laneW - 3;
    for (let y = -track; y < canvas.height + track; y += track) {
      ctx.fillRect(x, y + offset, 6, dashH);
    }
  }

  ctx.fillStyle = '#8df8ff';
  ctx.font = '700 20px "Courier New", monospace';
  ctx.fillText('SKYBRIDGE SERVICE CORRIDOR', 24, 34);
}

function drawPlayer() {
  const x = laneCenter(state.lane);
  const y = PLAYER_Y;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#f3f7ff';
  ctx.fillRect(-34, -18, 68, 36);

  ctx.fillStyle = '#34dcff';
  ctx.fillRect(-26, -12, 52, 18);

  ctx.fillStyle = '#f84f7a';
  ctx.fillRect(-30, 8, 60, 8);

  ctx.fillStyle = '#161b33';
  ctx.fillRect(-24, -2, 10, 10);
  ctx.fillRect(14, -2, 10, 10);

  ctx.fillStyle = '#ffec86';
  ctx.fillRect(-8, -6, 16, 6);

  ctx.restore();
}

function drawObstacle(o) {
  const x = laneCenter(o.lane);
  ctx.save();
  ctx.translate(x, o.y);

  if (o.type === 'cart') {
    ctx.fillStyle = '#ff576f';
    ctx.fillRect(-30, -20, 60, 40);
    ctx.fillStyle = '#ffd2dc';
    ctx.fillRect(-22, -12, 44, 16);
    ctx.fillStyle = '#2f1322';
    ctx.fillRect(-26, 10, 12, 8);
    ctx.fillRect(14, 10, 12, 8);
  } else {
    ctx.fillStyle = '#ff9f40';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-18, 20);
    ctx.lineTo(18, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3d1';
    ctx.fillRect(-6, 5, 12, 5);
  }

  ctx.restore();
}

function drawPickup(p) {
  const x = laneCenter(p.lane);
  ctx.save();
  ctx.translate(x, p.y);

  if (p.type === 'pass') {
    ctx.fillStyle = '#ffe56c';
    ctx.fillRect(-20, -15, 40, 30);
    ctx.fillStyle = '#7a5a14';
    ctx.fillRect(-14, -7, 28, 4);
    ctx.fillRect(-14, 1, 18, 4);
  } else {
    ctx.fillStyle = '#66ffb3';
    ctx.fillRect(-16, -18, 32, 36);
    ctx.fillStyle = '#123b2a';
    ctx.fillRect(-4, -8, 8, 16);
    ctx.fillStyle = '#c9ffe4';
    ctx.fillRect(-7, -22, 14, 6);
  }

  ctx.restore();
}

function drawOverlay() {
  ctx.fillStyle = '#c7cff8';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('TIP: PASS = points, BATTERY = energy', 24, canvas.height - 24);

  if (!state.running && !state.ended) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.68)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9af3ff';
    ctx.font = '700 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS START SHIFT', canvas.width * 0.5, canvas.height * 0.46);
    ctx.font = '20px "Courier New", monospace';
    ctx.fillStyle = '#ffe186';
    ctx.fillText('Move with LEFT/RIGHT or A/D', canvas.width * 0.5, canvas.height * 0.54);
    ctx.textAlign = 'left';
  }

  if (state.ended) {
    ctx.fillStyle = 'rgba(5, 8, 18, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9af3ff';
    ctx.font = '700 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHIFT COMPLETE', canvas.width * 0.5, canvas.height * 0.45);
    ctx.font = '22px "Courier New", monospace';
    ctx.fillStyle = '#ffe186';
    ctx.fillText(`Final Score ${Math.floor(state.score)}`, canvas.width * 0.5, canvas.height * 0.53);
    ctx.fillStyle = '#d8e2ff';
    ctx.fillText('Press Start Shift for a new run', canvas.width * 0.5, canvas.height * 0.61);
    ctx.textAlign = 'left';
  }

  if (state.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 80, 105, ${state.hitFlash * 0.2})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function draw() {
  drawBackground();
  state.pickups.forEach(drawPickup);
  state.obstacles.forEach(drawObstacle);
  drawPlayer();
  drawOverlay();
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastMs) / 1000);
  state.lastMs = now;

  if (state.running) {
    if (keys.has('ArrowLeft') || keys.has('KeyA')) {
      movePlayer(-1);
      keys.delete('ArrowLeft');
      keys.delete('KeyA');
    }
    if (keys.has('ArrowRight') || keys.has('KeyD')) {
      movePlayer(1);
      keys.delete('ArrowRight');
      keys.delete('KeyD');
    }
  }

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
    e.preventDefault();
  }
  keys.add(e.code);

  if (e.code === 'Space') {
    e.preventDefault();
    startRound();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

startBtn.addEventListener('click', startRound);
restartBtn.addEventListener('click', () => {
  resetRound();
  startRound();
});

resetRound();
requestAnimationFrame((t) => {
  state.lastMs = t;
  loop(t);
});
