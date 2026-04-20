const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

const WATERLINE = 110;
const FLOOR = canvas.height - 28;
const GAME_SECONDS = 60;

const keys = { left: false, right: false };
const entities = [];

const player = {
  x: canvas.width * 0.5,
  speed: 370,
  hookY: WATERLINE + 8,
  state: 'ready', // ready | dropping | reeling | cooldown
  cooldown: 0,
  caught: null,
};

let score = 0;
let combo = 1;
let timeLeft = GAME_SECONDS;
let running = false;
let spawnTimer = 0;
let ripplePhase = 0;
let lastTs = 0;
let msgTimer = 0;

const BEST_KEY = 'retro_boardwalk_trawler_best';
let best = Number(localStorage.getItem(BEST_KEY) || 0);
bestEl.textContent = pad(best);

let audioCtx = null;

function pad(value) {
  return String(Math.max(0, Math.floor(value))).padStart(4, '0');
}

function setMessage(text, seconds = 0) {
  messageEl.textContent = text;
  msgTimer = seconds;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(freq = 440, dur = 0.08, type = 'square', gain = 0.03) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function syncHud() {
  scoreEl.textContent = pad(score);
  comboEl.textContent = `x${combo}`;
  timeEl.textContent = Math.max(0, Math.ceil(timeLeft)).toString();
  bestEl.textContent = pad(best);
}

function createEntity() {
  const fish = Math.random() > 0.25;
  const size = fish ? 15 + Math.random() * 11 : 12 + Math.random() * 8;
  const y = WATERLINE + 85 + Math.random() * (canvas.height - WATERLINE - 140);
  const speed = (fish ? 55 : 42) + Math.random() * 80;
  const dir = Math.random() > 0.5 ? 1 : -1;

  entities.push({
    kind: fish ? 'fish' : 'junk',
    x: dir > 0 ? -40 : canvas.width + 40,
    y,
    baseY: y,
    size,
    vx: speed * dir,
    wobble: Math.random() * Math.PI * 2,
    value: fish ? (size > 22 ? 180 : size > 18 ? 130 : 90) : -60,
    color: fish
      ? Math.random() > 0.5
        ? '#67f3ff'
        : '#ff73c8'
      : Math.random() > 0.5
      ? '#8a93b8'
      : '#ad7f5d',
  });
}

function resetRound() {
  entities.length = 0;
  score = 0;
  combo = 1;
  timeLeft = GAME_SECONDS;
  spawnTimer = 0;
  player.x = canvas.width * 0.5;
  player.hookY = WATERLINE + 8;
  player.state = 'ready';
  player.cooldown = 0;
  player.caught = null;
  for (let i = 0; i < 8; i += 1) createEntity();
  syncHud();
  setMessage('Shift ready. Catch fish, skip junk.');
}

function startRound() {
  initAudio();
  resetRound();
  running = true;
  beep(520, 0.07, 'triangle', 0.045);
  beep(780, 0.09, 'triangle', 0.03);
  setMessage('Go go go! Drop that hook.', 1.7);
}

function endRound() {
  running = false;
  player.state = 'ready';
  player.caught = null;
  player.hookY = WATERLINE + 8;

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
    setMessage(`Shift over. New high score: ${pad(score)}!`, 4);
    beep(910, 0.1, 'square', 0.05);
    beep(1220, 0.14, 'square', 0.04);
  } else {
    setMessage(`Shift over. Final: ${pad(score)}. Hit START for another run.`, 4);
    beep(260, 0.12, 'sawtooth', 0.03);
  }
  syncHud();
}

function tryDropHook() {
  if (!running || player.state !== 'ready') return;
  player.state = 'dropping';
  beep(460, 0.04, 'triangle', 0.022);
}

function handleCatch(caught) {
  if (!caught) {
    combo = Math.max(1, combo - 1);
    setMessage('No catch. Reposition and drop again.', 1.2);
    return;
  }

  if (caught.kind === 'fish') {
    const gained = Math.round(caught.value * combo);
    score += gained;
    combo += 1;
    setMessage(`+${gained} points! Combo climbing.`, 1.2);
    beep(700 + combo * 25, 0.07, 'square', 0.04);
  } else {
    score = Math.max(0, score + caught.value);
    combo = 1;
    setMessage('Junk on the line. Combo reset.', 1.2);
    beep(180, 0.08, 'sawtooth', 0.035);
  }

  syncHud();
}

function updateEntities(dt) {
  for (let i = entities.length - 1; i >= 0; i -= 1) {
    const e = entities[i];
    e.x += e.vx * dt;
    e.wobble += dt * (e.kind === 'fish' ? 2.6 : 1.4);
    e.y = e.baseY + Math.sin(e.wobble) * (e.kind === 'fish' ? 9 : 5);

    if (e.vx > 0 && e.x > canvas.width + 50) {
      entities.splice(i, 1);
      createEntity();
    } else if (e.vx < 0 && e.x < -50) {
      entities.splice(i, 1);
      createEntity();
    }
  }

  if (!running) return;
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    createEntity();
    spawnTimer = 0.65 + Math.random() * 0.55;
  }
}

function hookCollides(entity) {
  const dx = entity.x - player.x;
  const dy = entity.y - player.hookY;
  const radius = entity.size + 8;
  return dx * dx + dy * dy <= radius * radius;
}

function updateHook(dt) {
  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const speed = player.state === 'ready' ? player.speed : player.speed * 0.55;
  player.x += move * speed * dt;
  player.x = Math.max(34, Math.min(canvas.width - 34, player.x));

  if (player.state === 'dropping') {
    player.hookY += 430 * dt;
    for (let i = entities.length - 1; i >= 0; i -= 1) {
      if (hookCollides(entities[i])) {
        player.caught = entities[i];
        entities.splice(i, 1);
        player.state = 'reeling';
        beep(560, 0.045, 'triangle', 0.03);
        break;
      }
    }
    if (player.hookY >= FLOOR) {
      player.hookY = FLOOR;
      player.state = 'reeling';
    }
  } else if (player.state === 'reeling') {
    player.hookY -= 520 * dt;
    if (player.hookY <= WATERLINE + 8) {
      player.hookY = WATERLINE + 8;
      handleCatch(player.caught);
      player.caught = null;
      player.state = 'cooldown';
      player.cooldown = 0.18;
    }
  } else if (player.state === 'cooldown') {
    player.cooldown -= dt;
    if (player.cooldown <= 0) player.state = 'ready';
  }
}

function update(dt) {
  ripplePhase += dt * 2.1;
  if (msgTimer > 0) msgTimer -= dt;

  updateEntities(dt);
  updateHook(dt);

  if (!running) return;
  timeLeft -= dt;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endRound();
  }
  syncHud();
}

function drawFish(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.vx < 0) ctx.scale(-1, 1);

  if (e.kind === 'fish') {
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.size * 1.2, e.size * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-e.size * 1.2, 0);
    ctx.lineTo(-e.size * 1.85, -e.size * 0.55);
    ctx.lineTo(-e.size * 1.85, e.size * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#081130';
    ctx.beginPath();
    ctx.arc(e.size * 0.45, -e.size * 0.18, Math.max(2.3, e.size * 0.14), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = e.color;
    ctx.fillRect(-e.size * 0.6, -e.size * 0.45, e.size * 1.2, e.size * 0.95);
    ctx.strokeStyle = '#2f3653';
    ctx.lineWidth = 2;
    ctx.strokeRect(-e.size * 0.6, -e.size * 0.45, e.size * 1.2, e.size * 0.95);
  }

  ctx.restore();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, WATERLINE);
  sky.addColorStop(0, '#180f38');
  sky.addColorStop(1, '#0b2f60');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, WATERLINE);

  // moon
  ctx.fillStyle = '#ffe3a4';
  ctx.beginPath();
  ctx.arc(canvas.width - 120, 52, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(11,47,96,0.85)';
  ctx.beginPath();
  ctx.arc(canvas.width - 109, 45, 18, 0, Math.PI * 2);
  ctx.fill();

  // pier lights
  for (let i = 0; i < 24; i += 1) {
    const x = i * 42 + ((i % 2) * 6);
    ctx.fillStyle = i % 2 ? '#ff72c7' : '#67f3ff';
    ctx.fillRect(x, WATERLINE - 6, 8, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 2, WATERLINE, 4, 15);
  }

  // ocean
  const sea = ctx.createLinearGradient(0, WATERLINE, 0, canvas.height);
  sea.addColorStop(0, '#104a7d');
  sea.addColorStop(0.5, '#0a2e5c');
  sea.addColorStop(1, '#08183d');
  ctx.fillStyle = sea;
  ctx.fillRect(0, WATERLINE, canvas.width, canvas.height - WATERLINE);

  for (let y = WATERLINE + 12; y < canvas.height; y += 20) {
    const amp = 6 + ((y - WATERLINE) / 90);
    ctx.strokeStyle = `rgba(103,243,255,${0.18 - (y - WATERLINE) / 2800})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 24) {
      const wave = Math.sin((x * 0.015) + ripplePhase + y * 0.02) * amp;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

function drawBoatAndHook() {
  const bx = player.x;

  // boat
  ctx.fillStyle = '#2d3d79';
  ctx.fillRect(bx - 30, WATERLINE - 21, 60, 14);
  ctx.fillStyle = '#ff6bc6';
  ctx.fillRect(bx - 24, WATERLINE - 25, 48, 4);

  // mast
  ctx.strokeStyle = '#9ec9ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, WATERLINE - 21);
  ctx.lineTo(bx, WATERLINE + 2);
  ctx.stroke();

  // line
  ctx.strokeStyle = '#d7e7ff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bx, WATERLINE + 2);
  ctx.lineTo(bx, player.hookY - 8);
  ctx.stroke();

  // hook
  ctx.strokeStyle = '#ffe793';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx, player.hookY, 7, Math.PI * 0.2, Math.PI * 1.65);
  ctx.stroke();

  if (player.caught) {
    const c = player.caught;
    c.x = bx;
    c.y = player.hookY + 20;
    drawFish(c);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  for (const entity of entities) drawFish(entity);

  drawBoatAndHook();

  if (!running) {
    ctx.fillStyle = 'rgba(2, 8, 24, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#67f3ff';
    ctx.font = 'bold 42px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOARDWALK TRAWLER', canvas.width / 2, canvas.height / 2 - 30);

    ctx.fillStyle = '#ffe3a4';
    ctx.font = 'bold 26px Trebuchet MS, sans-serif';
    ctx.fillText('Press START SHIFT', canvas.width / 2, canvas.height / 2 + 16);
  }
}

function tick(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.033);
  lastTs = ts;

  update(dt);
  draw();

  requestAnimationFrame(tick);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    keys.left = true;
    event.preventDefault();
  } else if (event.key === 'ArrowRight') {
    keys.right = true;
    event.preventDefault();
  } else if (event.code === 'Space') {
    if (!event.repeat) {
      initAudio();
      tryDropHook();
    }
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft') keys.left = false;
  if (event.key === 'ArrowRight') keys.right = false;
});

startBtn.addEventListener('click', () => {
  startRound();
});

resetBtn.addEventListener('click', () => {
  running = false;
  resetRound();
  setMessage('Reset complete. Press START SHIFT.', 2);
});

resetRound();
requestAnimationFrame(tick);
