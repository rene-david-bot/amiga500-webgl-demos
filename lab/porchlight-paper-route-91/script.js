const BEST_KEY = 'retro_porchlight_paper_route_91_best';
const DAY_LENGTH = 75;
const MAX_SATCHEL = 30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const repEl = document.getElementById('rep');
const comboEl = document.getElementById('combo');
const satchelEl = document.getElementById('satchel');
const accuracyEl = document.getElementById('accuracy');
const timeEl = document.getElementById('time');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');
const throwBtn = document.getElementById('throwBtn');

const laneY = [108, 182, 256, 330, 404];

const state = {
  running: false,
  paused: false,
  timeLeft: DAY_LENGTH,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  rep: 6,
  combo: 0,
  satchel: 18,
  throws: 0,
  hits: 0,
  lastTime: 0,
  houseTimer: 0,
  obstacleTimer: 0,
  bundleTimer: 0,
  flashTimer: 0,
  messageTimer: 0,
  invuln: 0,
  scroll: 175,
  throwCooldown: 0,
  playerLane: 2,
  houses: [],
  obstacles: [],
  bundles: [],
  shots: [],
  stars: []
};

const player = {
  x: 132,
  w: 44,
  h: 26
};

let audioCtx = null;
let muted = false;

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function laneToY(index) {
  return laneY[index];
}

function setStatus(text, seconds = 1.6) {
  statusEl.textContent = text;
  state.messageTimer = seconds;
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  repEl.textContent = String(state.rep);
  comboEl.textContent = `x${Math.max(1, state.combo + 1)}`;
  satchelEl.textContent = String(state.satchel);
  const acc = state.throws ? Math.round((state.hits / state.throws) * 100) : 0;
  accuracyEl.textContent = `${acc}%`;
  timeEl.textContent = `${state.timeLeft.toFixed(1)}s`;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(freq = 440, dur = 0.06, type = 'square', gainValue = 0.03, start = 0) {
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

function resetGame() {
  state.running = true;
  state.paused = false;
  state.timeLeft = DAY_LENGTH;
  state.score = 0;
  state.rep = 6;
  state.combo = 0;
  state.satchel = 18;
  state.throws = 0;
  state.hits = 0;
  state.houseTimer = 0.2;
  state.obstacleTimer = 1.4;
  state.bundleTimer = 5;
  state.flashTimer = 0;
  state.messageTimer = 0;
  state.invuln = 0;
  state.scroll = 175;
  state.throwCooldown = 0;
  state.playerLane = 2;
  state.houses = [];
  state.obstacles = [];
  state.bundles = [];
  state.shots = [];
  state.lastTime = performance.now();

  setStatus('Route live! Hit every mailbox you can.', 1.6);
  updateHud();
}

function spawnHouse() {
  const lane = randInt(0, laneY.length - 1);
  state.houses.push({
    lane,
    x: canvas.width + rand(30, 120),
    w: rand(86, 118),
    h: rand(72, 96),
    mailboxOffset: rand(16, 28),
    served: false,
    color: `hsl(${randInt(185, 320)} 62% 56%)`,
    roof: `hsl(${randInt(200, 290)} 48% 24%)`
  });
}

function spawnObstacle() {
  const lane = randInt(0, laneY.length - 1);
  const kind = Math.random() < 0.5 ? 'dog' : 'cone';
  state.obstacles.push({
    lane,
    x: canvas.width + rand(24, 120),
    w: kind === 'dog' ? 34 : 24,
    h: kind === 'dog' ? 20 : 28,
    kind
  });
}

function spawnBundle() {
  const lane = randInt(0, laneY.length - 1);
  state.bundles.push({
    lane,
    x: canvas.width + rand(40, 120),
    w: 20,
    h: 20,
    spin: rand(0, Math.PI * 2)
  });
}

function moveLane(direction) {
  if (!state.running || state.paused) return;
  const next = Math.max(0, Math.min(laneY.length - 1, state.playerLane + direction));
  if (next !== state.playerLane) {
    state.playerLane = next;
    beep(420 + next * 40, 0.04, 'triangle', 0.02);
  }
}

function throwPaper() {
  if (!state.running || state.paused) return;
  if (state.throwCooldown > 0) return;

  if (state.satchel <= 0) {
    state.combo = 0;
    setStatus('Satchel empty, catch a refill bundle!', 1.2);
    beep(160, 0.08, 'sawtooth', 0.028);
    return;
  }

  const lane = state.playerLane;
  state.shots.push({
    lane,
    x: player.x + 22,
    y: laneToY(lane),
    vx: 520
  });

  state.satchel -= 1;
  state.throws += 1;
  state.throwCooldown = 0.2;
  beep(620, 0.05, 'square', 0.022);
  updateHud();
}

function registerHit(house) {
  house.served = true;
  state.hits += 1;
  state.combo += 1;

  const bonus = 90 + state.combo * 18;
  state.score += bonus;

  setStatus(`Mailbox hit! +${bonus} points`, 0.9);

  beep(650, 0.05, 'triangle', 0.026);
  beep(820, 0.07, 'square', 0.022, 0.06);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }
}

function loseReputation(reason) {
  state.rep -= 1;
  state.combo = 0;
  state.flashTimer = 0.2;
  setStatus(reason, 1.2);
  beep(180, 0.09, 'sawtooth', 0.03);
  updateHud();

  if (state.rep <= 0) {
    finishRun(false);
  }
}

function finishRun(success) {
  if (!state.running) return;
  state.running = false;
  state.paused = false;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }

  if (success) {
    const clearBonus = 200 + state.rep * 40;
    state.score += clearBonus;
    setStatus(`Route complete! Shift bonus +${clearBonus}.`, 4);
    beep(520, 0.1, 'triangle', 0.03);
    beep(680, 0.1, 'square', 0.03, 0.1);
    beep(860, 0.12, 'triangle', 0.03, 0.2);
  } else {
    setStatus('Route failed. Reputation collapsed.', 4);
    beep(170, 0.11, 'sawtooth', 0.03);
    beep(130, 0.1, 'triangle', 0.03, 0.1);
  }

  updateHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.timeLeft -= dt;
  state.scroll = 175 + (DAY_LENGTH - state.timeLeft) * 1.25;
  state.throwCooldown = Math.max(0, state.throwCooldown - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.flashTimer = Math.max(0, state.flashTimer - dt);

  state.houseTimer -= dt;
  state.obstacleTimer -= dt;
  state.bundleTimer -= dt;

  if (state.houseTimer <= 0) {
    spawnHouse();
    const elapsed = DAY_LENGTH - state.timeLeft;
    state.houseTimer = Math.max(0.55, 1.25 - elapsed * 0.006);
  }

  if (state.obstacleTimer <= 0) {
    spawnObstacle();
    const elapsed = DAY_LENGTH - state.timeLeft;
    state.obstacleTimer = Math.max(0.9, 2.1 - elapsed * 0.01);
  }

  if (state.bundleTimer <= 0) {
    spawnBundle();
    state.bundleTimer = rand(5.6, 8.8);
  }

  const playerY = laneToY(state.playerLane);

  for (const shot of state.shots) {
    shot.x += shot.vx * dt;
  }

  for (const house of state.houses) {
    house.x -= state.scroll * dt;
  }

  for (const obstacle of state.obstacles) {
    obstacle.x -= (state.scroll + 40) * dt;
  }

  for (const bundle of state.bundles) {
    bundle.x -= (state.scroll + 20) * dt;
    bundle.spin += dt * 8;
  }

  for (const shot of state.shots) {
    for (const house of state.houses) {
      if (house.served || shot.lane !== house.lane) continue;
      const mailboxX = house.x + house.mailboxOffset;
      const mailboxY = laneToY(house.lane) - 14;
      if (shot.x >= mailboxX && shot.x <= mailboxX + 18 && shot.y >= mailboxY && shot.y <= mailboxY + 28) {
        shot.hit = true;
        registerHit(house);
      }
    }
  }

  for (const house of state.houses) {
    if (!house.served && house.x + house.w < player.x - 26) {
      house.missed = true;
      loseReputation('Missed porch. Word travels fast.', 1.1);
    }
  }

  for (const obstacle of state.obstacles) {
    if (obstacle.lane !== state.playerLane) continue;
    const ox1 = obstacle.x - obstacle.w * 0.5;
    const ox2 = obstacle.x + obstacle.w * 0.5;
    const px1 = player.x - player.w * 0.4;
    const px2 = player.x + player.w * 0.5;
    if (ox2 > px1 && ox1 < px2 && state.invuln <= 0) {
      state.invuln = 1.1;
      loseReputation(obstacle.kind === 'dog' ? 'Mailbox dog clipped you.' : 'Pothole slam, route slowed.', 1.2);
    }
  }

  for (const bundle of state.bundles) {
    if (bundle.lane !== state.playerLane) continue;
    const bx1 = bundle.x - bundle.w * 0.5;
    const bx2 = bundle.x + bundle.w * 0.5;
    const px1 = player.x - player.w * 0.4;
    const px2 = player.x + player.w * 0.5;
    if (bx2 > px1 && bx1 < px2) {
      bundle.caught = true;
      state.satchel = Math.min(MAX_SATCHEL, state.satchel + 8);
      setStatus('Caught paper bundle +8!', 0.85);
      beep(530, 0.06, 'triangle', 0.02);
      beep(720, 0.07, 'square', 0.02, 0.05);
    }
  }

  const before = state.shots.length;
  state.shots = state.shots.filter((shot) => !shot.hit && shot.x < canvas.width + 30);
  const expired = before - state.shots.length;
  if (expired > 0 && state.hits < state.throws) {
    state.combo = Math.max(0, state.combo - 1);
  }

  state.houses = state.houses.filter((house) => !(house.missed || house.x + house.w < -90));
  state.obstacles = state.obstacles.filter((obs) => obs.x > -70);
  state.bundles = state.bundles.filter((bundle) => !bundle.caught && bundle.x > -70);

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    finishRun(true);
  }

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0 && state.running) {
      statusEl.textContent = 'Arrow keys move lanes, Space throws papers.';
    }
  }

  updateHud();

  if (!state.running && state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0b1130');
  gradient.addColorStop(1, '#060a1f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 150; i += 1) {
    const x = (i * 67 + (performance.now() * 0.02)) % canvas.width;
    const y = (i * 47) % 140;
    ctx.fillStyle = 'rgba(170,210,255,0.35)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = '#101635';
  ctx.fillRect(0, 70, canvas.width, 30);

  ctx.fillStyle = '#112347';
  ctx.fillRect(0, 90, canvas.width, 380);

  for (let i = 0; i < laneY.length; i += 1) {
    const y = laneToY(i);
    ctx.strokeStyle = 'rgba(108, 153, 255, 0.27)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 24);
    ctx.lineTo(canvas.width, y + 24);
    ctx.stroke();

    for (let x = -40; x < canvas.width + 40; x += 44) {
      const drift = (performance.now() * 0.13) % 44;
      ctx.fillStyle = 'rgba(136, 205, 255, 0.22)';
      ctx.fillRect(x - drift, y + 10, 24, 3);
    }
  }

  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function drawPlayer() {
  const y = laneToY(state.playerLane);
  const blink = state.invuln > 0 && Math.floor(state.invuln * 18) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(player.x, y);

  ctx.fillStyle = '#7ef4ff';
  ctx.fillRect(-18, -10, 36, 20);

  ctx.fillStyle = '#ffd58a';
  ctx.fillRect(-6, -16, 12, 8);

  ctx.fillStyle = '#ff97cd';
  ctx.fillRect(10, -22, 16, 12);

  ctx.fillStyle = '#1d2a57';
  ctx.beginPath();
  ctx.arc(-12, 13, 9, 0, Math.PI * 2);
  ctx.arc(12, 13, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(122, 236, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-20, -12, 40, 24);

  ctx.restore();
}

function drawHouses() {
  for (const house of state.houses) {
    const y = laneToY(house.lane);

    ctx.fillStyle = house.roof;
    ctx.fillRect(house.x - 4, y - house.h * 0.58 - 8, house.w + 8, 10);

    ctx.fillStyle = house.served ? '#3dbb7c' : house.color;
    ctx.fillRect(house.x, y - house.h * 0.55, house.w, house.h * 0.55 + 34);

    ctx.fillStyle = '#ffd980';
    ctx.fillRect(house.x + house.w * 0.62, y - 20, 14, 24);

    const mailboxX = house.x + house.mailboxOffset;
    ctx.fillStyle = house.served ? '#86ffd0' : '#ff8ec6';
    ctx.fillRect(mailboxX, y - 13, 18, 28);

    ctx.fillStyle = '#101634';
    ctx.fillRect(mailboxX + 7, y + 15, 4, 9);
  }
}

function drawObstacles() {
  for (const obs of state.obstacles) {
    const y = laneToY(obs.lane);
    if (obs.kind === 'dog') {
      ctx.fillStyle = '#f9c17d';
      ctx.fillRect(obs.x - 16, y - 11, 30, 16);
      ctx.fillRect(obs.x + 10, y - 7, 9, 12);
      ctx.fillStyle = '#2f2252';
      ctx.fillRect(obs.x - 12, y + 5, 4, 7);
      ctx.fillRect(obs.x + 2, y + 5, 4, 7);
    } else {
      ctx.fillStyle = '#ffb46c';
      ctx.beginPath();
      ctx.moveTo(obs.x, y - 14);
      ctx.lineTo(obs.x - 12, y + 14);
      ctx.lineTo(obs.x + 12, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff7f7f';
      ctx.fillRect(obs.x - 10, y, 20, 4);
    }
  }
}

function drawBundles() {
  for (const bundle of state.bundles) {
    const y = laneToY(bundle.lane);
    ctx.save();
    ctx.translate(bundle.x, y);
    ctx.rotate(bundle.spin);
    ctx.fillStyle = '#7bffc7';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.strokeStyle = '#0b4e42';
    ctx.lineWidth = 2;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.restore();
  }
}

function drawShots() {
  for (const shot of state.shots) {
    ctx.save();
    ctx.translate(shot.x, shot.y);
    ctx.rotate(shot.x * 0.02);
    ctx.fillStyle = '#fff5d0';
    ctx.fillRect(-7, -4, 14, 8);
    ctx.strokeStyle = '#b79548';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, -4, 14, 8);
    ctx.restore();
  }
}

function drawOverlay() {
  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 94, 150, ${0.18 + state.flashTimer * 0.35})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (!state.running) {
    ctx.fillStyle = 'rgba(4, 7, 20, 0.64)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#78f7ff';
    ctx.font = '700 36px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText("Porchlight Paper Route '91", canvas.width / 2, canvas.height / 2 - 22);

    ctx.fillStyle = '#d6e8ff';
    ctx.font = '600 18px Trebuchet MS';
    ctx.fillText('Press Start Route to run another delivery shift.', canvas.width / 2, canvas.height / 2 + 16);
  }

  if (state.paused) {
    ctx.fillStyle = 'rgba(8, 13, 32, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffd98f';
    ctx.font = '700 30px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
  }
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - state.lastTime) / 1000 || 0);
  state.lastTime = ts;

  update(dt);

  drawBackground();
  drawHouses();
  drawObstacles();
  drawBundles();
  drawShots();
  drawPlayer();
  drawOverlay();

  requestAnimationFrame(frame);
}

function startGame() {
  initAudio();
  resetGame();
  pauseBtn.textContent = 'Pause';
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  setStatus(state.paused ? 'Route paused.' : 'Route resumed.', 0.8);
}

startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  togglePause();
});
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});
upBtn.addEventListener('click', () => moveLane(-1));
downBtn.addEventListener('click', () => moveLane(1));
throwBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  throwPaper();
});

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
    event.preventDefault();
    moveLane(-1);
  }

  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
    event.preventDefault();
    moveLane(1);
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (!audioCtx) initAudio();
    throwPaper();
  }

  if (event.key.toLowerCase() === 'p') {
    event.preventDefault();
    togglePause();
  }
});

updateHud();
requestAnimationFrame((ts) => {
  state.lastTime = ts;
  frame(ts);
});
