const canvas = document.getElementById('playfield');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const ballsEl = document.getElementById('balls');
const audioStateEl = document.getElementById('audioState');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const launchBtn = document.getElementById('launchBtn');
const audioBtn = document.getElementById('audioBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

const W = canvas.width;
const H = canvas.height;

const bumpers = [
  { x: W * 0.26, y: H * 0.29, r: 44, color: '#61e7ff' },
  { x: W * 0.5, y: H * 0.22, r: 52, color: '#ff4cc8' },
  { x: W * 0.74, y: H * 0.3, r: 44, color: '#d1ff65' },
  { x: W * 0.5, y: H * 0.46, r: 38, color: '#8aa0ff' }
];

const lanes = [
  { x: 74, y: 78, w: 160, h: 26, lit: false, color: '#5ee5ff' },
  { x: 280, y: 68, w: 160, h: 26, lit: false, color: '#ff5cd8' },
  { x: 486, y: 78, w: 160, h: 26, lit: false, color: '#c9ff72' }
];

const flippers = {
  left: {
    pivot: { x: 228, y: 786 },
    length: 116,
    baseAngle: 0.48,
    activeAngle: -0.32,
    angle: 0.48,
    pressed: false,
    color: '#68e7ff'
  },
  right: {
    pivot: { x: 492, y: 786 },
    length: 116,
    baseAngle: Math.PI - 0.48,
    activeAngle: Math.PI + 0.32,
    angle: Math.PI - 0.48,
    pressed: false,
    color: '#ff66cc'
  }
};

const state = {
  score: 0,
  best: Number(localStorage.getItem('retro-pinball-best') || 0),
  balls: 3,
  running: false,
  ballInPlay: false,
  combo: 1,
  comboTimer: 0,
  sparks: [],
  ball: null,
  lastTime: 0,
  audioReady: false,
  audioCtx: null
};

bestEl.textContent = formatScore(state.best);

function formatScore(v) {
  return String(v).padStart(6, '0');
}

function resetBall() {
  state.ball = {
    x: W * 0.82,
    y: H * 0.81,
    vx: 0,
    vy: 0,
    r: 9,
    launched: false
  };
}

function startGame() {
  state.score = 0;
  state.balls = 3;
  state.combo = 1;
  state.comboTimer = 0;
  state.running = true;
  state.ballInPlay = true;
  lanes.forEach((lane) => (lane.lit = false));
  resetBall();
  updateHud();
  hideOverlay();
}

function endGame() {
  state.running = false;
  state.ballInPlay = false;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('retro-pinball-best', String(state.best));
  }
  updateHud();
  showOverlay('Shift Over', `Final score ${formatScore(state.score)}. Tap launch to clock in again.`);
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function updateHud() {
  scoreEl.textContent = formatScore(state.score);
  ballsEl.textContent = String(state.balls);
  bestEl.textContent = formatScore(state.best);
  audioStateEl.textContent = state.audioReady ? 'ON' : 'OFF';
}

function launchBall(force = false) {
  if (!state.running) {
    startGame();
  }

  if (!state.ball || !state.ballInPlay) {
    resetBall();
    state.ballInPlay = true;
  }

  if (!state.ball.launched || force) {
    hideOverlay();
    state.ball.vx = -150 - Math.random() * 70;
    state.ball.vy = -700 - Math.random() * 80;
    state.ball.launched = true;
    tone(240, 0.08, 'square', 0.045);
  }
}

function addScore(points) {
  state.score += points;
  if (state.score > state.best) {
    state.best = state.score;
  }
  updateHud();
}

function addSpark(x, y, color) {
  for (let i = 0; i < 14; i += 1) {
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.45;
    const speed = 60 + Math.random() * 180;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5 + Math.random() * 0.4,
      color
    });
  }
}

function reflect(vx, vy, nx, ny, bounce = 1) {
  const dot = vx * nx + vy * ny;
  return {
    vx: (vx - 2 * dot * nx) * bounce,
    vy: (vy - 2 * dot * ny) * bounce
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return { x: x1 + t * dx, y: y1 + t * dy, t };
}

function flipperTip(flipper) {
  return {
    x: flipper.pivot.x + Math.cos(flipper.angle) * flipper.length,
    y: flipper.pivot.y + Math.sin(flipper.angle) * flipper.length
  };
}

function updateFlippers(dt) {
  const speed = 17;
  for (const key of ['left', 'right']) {
    const f = flippers[key];
    const target = f.pressed ? f.activeAngle : f.baseAngle;
    const diff = target - f.angle;
    const step = clamp(diff, -speed * dt, speed * dt);
    f.angle += step;
  }
}

function hitFlippers(ball) {
  const thickness = 14;

  for (const key of ['left', 'right']) {
    const f = flippers[key];
    const tip = flipperTip(f);
    const cp = closestPointOnSegment(ball.x, ball.y, f.pivot.x, f.pivot.y, tip.x, tip.y);
    const dx = ball.x - cp.x;
    const dy = ball.y - cp.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + thickness;

    if (dist > 0 && dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const boost = f.pressed ? 1.16 : 0.96;
      const refl = reflect(ball.vx, ball.vy, nx, ny, boost);
      ball.vx = refl.vx;
      ball.vy = refl.vy;

      if (f.pressed) {
        const impulse = key === 'left' ? 180 : -180;
        ball.vx += impulse;
        ball.vy -= 170;
        tone(660, 0.05, 'triangle', 0.038);
      } else {
        tone(420, 0.03, 'triangle', 0.02);
      }
    }
  }
}

function hitBumpers(ball) {
  for (const bumper of bumpers) {
    const dx = ball.x - bumper.x;
    const dy = ball.y - bumper.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + bumper.r;
    if (dist > 0 && dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const refl = reflect(ball.vx, ball.vy, nx, ny, 1.08);
      ball.vx = refl.vx + nx * 72;
      ball.vy = refl.vy + ny * 72;

      state.combo += 1;
      state.comboTimer = 1.6;
      const points = 100 * state.combo;
      addScore(points);
      addSpark(bumper.x, bumper.y, bumper.color);
      tone(240 + Math.random() * 280, 0.05, 'sawtooth', 0.04);
    }
  }
}

function hitLanes(ball) {
  for (const lane of lanes) {
    if (ball.x > lane.x && ball.x < lane.x + lane.w && ball.y > lane.y && ball.y < lane.y + lane.h) {
      if (!lane.lit) {
        lane.lit = true;
        addScore(500);
        tone(820, 0.07, 'square', 0.045);
      }
    }
  }

  if (lanes.every((lane) => lane.lit)) {
    addScore(1500);
    lanes.forEach((lane) => (lane.lit = false));
    addSpark(W * 0.5, 130, '#fff0a0');
    tone(980, 0.09, 'square', 0.05);
  }
}

function updateBall(dt) {
  if (!state.ball || !state.ballInPlay) return;
  const b = state.ball;

  if (!b.launched) {
    b.x = W * 0.82;
    b.y = H * 0.81;
    b.vx = 0;
    b.vy = 0;
    return;
  }

  b.vy += 720 * dt;
  b.vx *= 0.999;

  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x < b.r + 20) {
    b.x = b.r + 20;
    b.vx = Math.abs(b.vx) * 0.92;
    tone(180, 0.02, 'square', 0.018);
  } else if (b.x > W - b.r - 20) {
    b.x = W - b.r - 20;
    b.vx = -Math.abs(b.vx) * 0.92;
    tone(180, 0.02, 'square', 0.018);
  }

  if (b.y < b.r + 18) {
    b.y = b.r + 18;
    b.vy = Math.abs(b.vy) * 0.9;
    tone(200, 0.02, 'square', 0.018);
  }

  if (b.y > H - 145 && b.x < 210) {
    b.x = 210;
    b.vx = Math.abs(b.vx) + 90;
    b.vy -= 140;
    tone(250, 0.03, 'triangle', 0.028);
  } else if (b.y > H - 145 && b.x > W - 210) {
    b.x = W - 210;
    b.vx = -Math.abs(b.vx) - 90;
    b.vy -= 140;
    tone(250, 0.03, 'triangle', 0.028);
  }

  const inDrain = b.y > H - 72 && b.x > 320 && b.x < 400;
  if (inDrain || b.y > H + 60) {
    state.balls -= 1;
    updateHud();
    tone(100, 0.16, 'sawtooth', 0.045);
    if (state.balls <= 0) {
      endGame();
      return;
    }
    state.ballInPlay = true;
    resetBall();
    showOverlay('Ball Lost', 'Quick reset. Hit launch and keep the shift alive.');
    return;
  }

  hitFlippers(b);
  hitBumpers(b);
  hitLanes(b);
}

function updateSparks(dt) {
  state.sparks = state.sparks.filter((s) => {
    s.life -= dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.95;
    s.vy = s.vy * 0.95 + 36 * dt;
    return s.life > 0;
  });
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0c0930');
  grad.addColorStop(0.4, '#0f1238');
  grad.addColorStop(1, '#170d21');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y, W, 1);
  }

  ctx.strokeStyle = '#6f4eb3';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.fillStyle = '#1b1634';
  ctx.fillRect(320, H - 95, 80, 80);
  ctx.strokeStyle = '#9b87d6';
  ctx.lineWidth = 2;
  ctx.strokeRect(320, H - 95, 80, 80);

  ctx.strokeStyle = 'rgba(190, 165, 255, 0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(190, H - 140);
  ctx.lineTo(280, H - 24);
  ctx.moveTo(W - 190, H - 140);
  ctx.lineTo(W - 280, H - 24);
  ctx.stroke();
}

function drawLanes() {
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  for (const lane of lanes) {
    ctx.fillStyle = lane.lit ? lane.color : 'rgba(130, 120, 180, 0.25)';
    ctx.fillRect(lane.x, lane.y, lane.w, lane.h);
    ctx.strokeStyle = lane.lit ? '#ffffff' : '#8f80be';
    ctx.lineWidth = 2;
    ctx.strokeRect(lane.x, lane.y, lane.w, lane.h);
    ctx.fillStyle = lane.lit ? '#130b2e' : '#d7ccff';
    ctx.fillText('SHIFT', lane.x + lane.w / 2, lane.y + 18);
  }
}

function drawBumpers() {
  for (const bumper of bumpers) {
    const glow = ctx.createRadialGradient(bumper.x, bumper.y, 4, bumper.x, bumper.y, bumper.r + 14);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.2, bumper.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0b0b1b';
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = bumper.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.r - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawFlipper(flipper) {
  const tip = flipperTip(flipper);
  ctx.lineCap = 'round';
  ctx.lineWidth = 24;
  ctx.strokeStyle = '#170f2f';
  ctx.beginPath();
  ctx.moveTo(flipper.pivot.x, flipper.pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  ctx.lineWidth = 18;
  ctx.strokeStyle = flipper.color;
  ctx.beginPath();
  ctx.moveTo(flipper.pivot.x, flipper.pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  ctx.fillStyle = '#ebdfff';
  ctx.beginPath();
  ctx.arc(flipper.pivot.x, flipper.pivot.y, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawSparks() {
  for (const s of state.sparks) {
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s.life)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall() {
  if (!state.ball || !state.ballInPlay) return;
  const b = state.ball;
  const g = ctx.createRadialGradient(b.x - 2, b.y - 4, 2, b.x, b.y, b.r + 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.4, '#d6e7ff');
  g.addColorStop(1, '#6f8fc8');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCombo() {
  if (state.comboTimer <= 0 || state.combo <= 1) return;
  ctx.fillStyle = '#fff58d';
  ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`COMBO x${state.combo}`, W / 2, H - 120);
}

function draw() {
  drawBackground();
  drawLanes();
  drawBumpers();
  drawFlipper(flippers.left);
  drawFlipper(flippers.right);
  drawSparks();
  drawBall();
  drawCombo();
}

function loop(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.033, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  updateFlippers(dt);

  if (state.running) {
    updateBall(dt);
    updateSparks(dt);

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
  }

  draw();
  requestAnimationFrame(loop);
}

function setFlipper(side, pressed) {
  flippers[side].pressed = pressed;
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || event.key === 'ArrowLeft') {
    setFlipper('left', true);
  }
  if (key === 'l' || event.key === 'ArrowRight') {
    setFlipper('right', true);
  }

  if (event.code === 'Space') {
    event.preventDefault();
    launchBall();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || event.key === 'ArrowLeft') {
    setFlipper('left', false);
  }
  if (key === 'l' || event.key === 'ArrowRight') {
    setFlipper('right', false);
  }
});

function bindTouchFlipper(button, side) {
  const down = (e) => {
    e.preventDefault();
    setFlipper(side, true);
  };
  const up = (e) => {
    e.preventDefault();
    setFlipper(side, false);
  };

  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
}

bindTouchFlipper(leftBtn, 'left');
bindTouchFlipper(rightBtn, 'right');

launchBtn.addEventListener('click', () => {
  launchBall();
});

audioBtn.addEventListener('click', async () => {
  await ensureAudio();
  updateHud();
});

function tone(freq, duration = 0.05, type = 'square', gain = 0.03) {
  if (!state.audioReady || !state.audioCtx) return;
  const now = state.audioCtx.currentTime;

  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

async function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state !== 'running') {
    await state.audioCtx.resume();
  }
  state.audioReady = true;
  audioBtn.textContent = 'Audio Enabled';
  tone(520, 0.08, 'triangle', 0.04);
}

updateHud();
resetBall();
requestAnimationFrame(loop);
