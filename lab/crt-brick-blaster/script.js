const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const el = {
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  level: document.getElementById('level'),
  best: document.getElementById('best'),
  overlay: document.getElementById('overlay'),
  audioToggle: document.getElementById('audioToggle'),
  startBtn: document.getElementById('startBtn')
};

const BRICK_W = 68;
const BRICK_H = 22;
const BRICK_GAP = 8;
const BRICK_TOP = 70;
const BRICK_LEFT = 18;
const COLS = 10;

const state = {
  running: false,
  score: 0,
  lives: 3,
  level: 1,
  best: Number(localStorage.getItem('crtBrickBest') || 0),
  combo: 0,
  comboTimer: 0,
  lastTime: 0,
  audioOn: false,
  audioCtx: null,
  paddle: { x: canvas.width / 2 - 64, y: canvas.height - 34, w: 128, h: 12, speed: 580 },
  ball: { x: canvas.width / 2, y: canvas.height - 70, r: 7, vx: 230, vy: -230, trail: [] },
  keys: { left: false, right: false },
  bricks: [],
  particles: []
};

function beep(freq = 360, ms = 70, gain = 0.015, type = 'square') {
  if (!state.audioOn) return;
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const t = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const amp = state.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(amp).connect(state.audioCtx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    // audio is optional
  }
}

function showOverlay(text) {
  el.overlay.textContent = text;
  el.overlay.classList.remove('hidden');
}

function hideOverlay() {
  el.overlay.classList.add('hidden');
}

function updateHud() {
  el.score.textContent = String(state.score);
  el.lives.textContent = String(state.lives);
  el.level.textContent = String(state.level);
  el.best.textContent = String(state.best);
}

function spawnBricks(level) {
  const rows = Math.min(8, 4 + level);
  const bricks = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const hp = 1 + ((r + c + level) % 3 === 0 ? 1 : 0);
      bricks.push({
        x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        hp,
        maxHp: hp,
        hue: 190 + ((r * 21 + c * 13) % 130)
      });
    }
  }

  state.bricks = bricks;
}

function resetBallAndPaddle() {
  state.paddle.x = canvas.width / 2 - state.paddle.w / 2;
  state.ball.x = canvas.width / 2;
  state.ball.y = canvas.height - 70;
  const speed = 220 + state.level * 25;
  const angle = (Math.random() * 0.8 + 0.35) * (Math.random() > 0.5 ? 1 : -1);
  state.ball.vx = Math.sin(angle) * speed;
  state.ball.vy = -Math.cos(angle) * speed;
  state.ball.trail = [];
}

function newGame() {
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.particles = [];
  spawnBricks(state.level);
  resetBallAndPaddle();
  updateHud();
}

function levelUp() {
  state.level += 1;
  state.combo = 0;
  state.comboTimer = 0;
  spawnBricks(state.level);
  resetBallAndPaddle();
  showOverlay(`Level ${state.level}`);
  beep(780, 90, 0.013, 'triangle');
  setTimeout(() => beep(980, 110, 0.013, 'triangle'), 120);
  setTimeout(hideOverlay, 900);
  updateHud();
}

function loseLife() {
  state.lives -= 1;
  updateHud();
  beep(160, 220, 0.02, 'sawtooth');
  if (state.lives <= 0) {
    state.running = false;
    showOverlay(`Game Over · Score ${state.score}`);
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('crtBrickBest', String(state.best));
      updateHud();
    }
    return;
  }
  resetBallAndPaddle();
  showOverlay('Life Lost');
  setTimeout(hideOverlay, 700);
}

function brickHit(brick) {
  brick.hp -= 1;
  if (brick.hp <= 0) {
    const base = 35;
    state.combo += 1;
    state.comboTimer = 1.4;
    const bonus = Math.max(0, (state.combo - 1) * 10);
    state.score += base + bonus;
    for (let i = 0; i < 8; i += 1) {
      state.particles.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: (Math.random() - 0.5) * 190,
        vy: (Math.random() - 0.5) * 190,
        life: 0.45 + Math.random() * 0.3,
        hue: brick.hue
      });
    }
    beep(420 + Math.min(400, state.combo * 20), 70, 0.012, 'square');
  } else {
    state.score += 10;
    beep(310, 45, 0.01, 'triangle');
  }
  updateHud();
}

function rectCircleCollision(rect, circle) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function update(dt) {
  if (!state.running) return;

  if (state.keys.left) state.paddle.x -= state.paddle.speed * dt;
  if (state.keys.right) state.paddle.x += state.paddle.speed * dt;
  state.paddle.x = Math.max(8, Math.min(canvas.width - state.paddle.w - 8, state.paddle.x));

  state.ball.x += state.ball.vx * dt;
  state.ball.y += state.ball.vy * dt;

  state.ball.trail.push({ x: state.ball.x, y: state.ball.y });
  if (state.ball.trail.length > 10) state.ball.trail.shift();

  if (state.ball.x < state.ball.r) {
    state.ball.x = state.ball.r;
    state.ball.vx = Math.abs(state.ball.vx);
    beep(220, 35, 0.008);
  }
  if (state.ball.x > canvas.width - state.ball.r) {
    state.ball.x = canvas.width - state.ball.r;
    state.ball.vx = -Math.abs(state.ball.vx);
    beep(220, 35, 0.008);
  }
  if (state.ball.y < state.ball.r) {
    state.ball.y = state.ball.r;
    state.ball.vy = Math.abs(state.ball.vy);
    beep(250, 35, 0.008);
  }

  if (state.ball.y > canvas.height + 20) {
    loseLife();
  }

  const paddleRect = state.paddle;
  if (rectCircleCollision(paddleRect, state.ball) && state.ball.vy > 0) {
    const hitPoint = (state.ball.x - (state.paddle.x + state.paddle.w / 2)) / (state.paddle.w / 2);
    const speed = Math.hypot(state.ball.vx, state.ball.vy) * 1.02;
    const angle = hitPoint * 1.05;
    state.ball.vx = Math.sin(angle) * speed;
    state.ball.vy = -Math.cos(angle) * speed;
    state.ball.y = state.paddle.y - state.ball.r - 1;
    beep(290, 50, 0.009, 'triangle');
  }

  let aliveBricks = 0;
  for (const brick of state.bricks) {
    if (brick.hp <= 0) continue;
    aliveBricks += 1;
    if (rectCircleCollision(brick, state.ball)) {
      const prevX = state.ball.x - state.ball.vx * dt;
      const prevY = state.ball.y - state.ball.vy * dt;
      const hitFromSide = prevX < brick.x || prevX > brick.x + brick.w;
      if (hitFromSide) state.ball.vx *= -1;
      else state.ball.vy *= -1;
      brickHit(brick);
      break;
    }
  }

  if (aliveBricks === 0) {
    levelUp();
  }

  state.comboTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 0;

  state.particles = state.particles.filter(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;
    return p.life > 0;
  });
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#081024');
  g.addColorStop(1, '#050913');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(110, 171, 255, 0.14)';
  for (let x = 0; x < canvas.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
}

function drawBricks() {
  for (const brick of state.bricks) {
    if (brick.hp <= 0) continue;
    const light = brick.hp === 2 ? 62 : 52;
    ctx.fillStyle = `hsl(${brick.hue}, 88%, ${light}%)`;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1);

    if (brick.hp > 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('II', brick.x + brick.w / 2 - 8, brick.y + 15);
    }
  }
}

function drawPaddle() {
  const p = state.paddle;
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#7ff2ff');
  g.addColorStop(1, '#307fd1');
  ctx.fillStyle = g;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
}

function drawBall() {
  for (let i = 0; i < state.ball.trail.length; i += 1) {
    const t = state.ball.trail[i];
    const alpha = (i + 1) / state.ball.trail.length;
    ctx.fillStyle = `rgba(146, 225, 255, ${alpha * 0.22})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, state.ball.r * alpha * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f7fcff';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, state.ball.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${Math.max(0, p.life)})`;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
}

function drawCombo() {
  if (!state.combo || state.combo < 2) return;
  ctx.fillStyle = '#ffd789';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`COMBO x${state.combo}`, 16, canvas.height - 14);
}

function draw() {
  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawParticles();
  drawCombo();
}

function frame(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.033, (ts - state.lastTime) / 1000);
  state.lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function startGame() {
  if (!state.running && state.lives <= 0) {
    newGame();
  }
  if (!state.running) {
    state.running = true;
    hideOverlay();
    beep(520, 70, 0.012, 'triangle');
  }
}

function bind() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') state.keys.left = true;
    if (key === 'arrowright' || key === 'd') state.keys.right = true;
    if (key === ' ' || key === 'enter') startGame();
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') state.keys.left = false;
    if (key === 'arrowright' || key === 'd') state.keys.right = false;
  });

  const pointerMove = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const scale = canvas.width / rect.width;
    state.paddle.x = x * scale - state.paddle.w / 2;
    state.paddle.x = Math.max(8, Math.min(canvas.width - state.paddle.w - 8, state.paddle.x));
  };

  canvas.addEventListener('mousemove', (e) => pointerMove(e.clientX));
  canvas.addEventListener('touchmove', (e) => {
    if (!e.touches[0]) return;
    pointerMove(e.touches[0].clientX);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchstart', startGame, { passive: true });

  el.startBtn.addEventListener('click', () => {
    if (state.lives <= 0) newGame();
    startGame();
  });

  el.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    el.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) beep(610, 70, 0.012, 'triangle');
  });
}

function boot() {
  newGame();
  bind();
  updateHud();
  requestAnimationFrame(frame);
}

boot();
