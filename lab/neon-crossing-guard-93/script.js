const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const phaseEl = document.getElementById('phase');
const pressureFill = document.getElementById('pressure-fill');

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const toggleBtn = document.getElementById('toggle-btn');
const resetBtn = document.getElementById('reset-btn');

const W = canvas.width;
const H = canvas.height;
const centerX = W * 0.5;
const centerY = H * 0.5;
const ix1 = centerX - 78;
const ix2 = centerX + 78;
const iy1 = centerY - 78;
const iy2 = centerY + 78;

let cars = [];
let peds = [];
let score = 0;
let pressure = 0;
let running = false;
let gameOver = false;
let phase = 'cars';
let lastSwitch = 0;
let lastTime = performance.now();
let carSpawnTimer = 0;
let pedSpawnTimer = 0;
let carSpawnEvery = randRange(550, 980);
let pedSpawnEvery = randRange(800, 1300);

const bestKey = 'retro_neon_crossing_guard_best';
let best = Number(localStorage.getItem(bestKey) || 0);
bestEl.textContent = best;

let audioCtx = null;
let unlockedAudio = false;

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function beep(freq = 440, length = 0.08, type = 'square', gain = 0.04) {
  if (!audioCtx || !unlockedAudio) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audioCtx.destination);
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.start(t);
  osc.stop(t + length);
}

function unlockAudio() {
  if (unlockedAudio) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  unlockedAudio = true;
}

function resetState() {
  cars = [];
  peds = [];
  score = 0;
  pressure = 0;
  gameOver = false;
  phase = 'cars';
  lastSwitch = 0;
  carSpawnTimer = 0;
  pedSpawnTimer = 0;
  carSpawnEvery = randRange(550, 980);
  pedSpawnEvery = randRange(800, 1300);
  updateHud();
}

function spawnCar() {
  const lane = Math.random() < 0.5 ? -26 : 26;
  const dir = Math.random() < 0.5 ? 1 : -1;
  cars.push({
    type: 'car',
    x: dir === 1 ? -82 : W + 82,
    y: centerY + lane,
    w: 54,
    h: 30,
    dir,
    speed: randRange(150, 230),
    entered: false
  });
}

function spawnPed() {
  const lane = Math.random() < 0.5 ? -24 : 24;
  const dir = Math.random() < 0.5 ? 1 : -1;
  peds.push({
    type: 'ped',
    x: centerX + lane,
    y: dir === 1 ? -30 : H + 30,
    w: 16,
    h: 16,
    dir,
    speed: randRange(88, 126),
    entered: false
  });
}

function canCarMove(car) {
  if (car.entered || phase === 'cars') return true;
  if (car.dir === 1) return car.x + car.w < ix1 - 10;
  return car.x > ix2 + 10;
}

function canPedMove(ped) {
  if (ped.entered || phase === 'walk') return true;
  if (ped.dir === 1) return ped.y + ped.h < iy1 - 10;
  return ped.y > iy2 + 10;
}

function inIntersection(a) {
  return a.x < ix2 && a.x + a.w > ix1 && a.y < iy2 && a.y + a.h > iy1;
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function toggleSignal() {
  const now = performance.now();
  if (now - lastSwitch < 700 || gameOver) return;
  phase = phase === 'cars' ? 'walk' : 'cars';
  lastSwitch = now;
  beep(phase === 'cars' ? 660 : 360, 0.12, 'square', 0.05);
  updateHud();
}

function update(dt) {
  if (!running || gameOver) return;

  carSpawnTimer += dt;
  pedSpawnTimer += dt;

  if (carSpawnTimer > carSpawnEvery) {
    carSpawnTimer = 0;
    carSpawnEvery = randRange(550, 980);
    spawnCar();
  }
  if (pedSpawnTimer > pedSpawnEvery) {
    pedSpawnTimer = 0;
    pedSpawnEvery = randRange(820, 1380);
    spawnPed();
  }

  for (const car of cars) {
    if (canCarMove(car)) car.x += car.speed * car.dir * dt / 1000;
    if (!car.entered && inIntersection(car)) car.entered = true;
  }

  for (const ped of peds) {
    if (canPedMove(ped)) ped.y += ped.speed * ped.dir * dt / 1000;
    if (!ped.entered && inIntersection(ped)) ped.entered = true;
  }

  for (const car of cars) {
    for (const ped of peds) {
      if (hit(car, ped)) {
        gameOver = true;
        running = false;
        beep(120, 0.24, 'sawtooth', 0.07);
        beep(90, 0.3, 'triangle', 0.06);
      }
    }
  }

  cars = cars.filter((car) => {
    const out = car.x < -120 || car.x > W + 120;
    if (out) {
      score += 2;
      beep(820, 0.03, 'square', 0.02);
    }
    return !out;
  });

  peds = peds.filter((ped) => {
    const out = ped.y < -60 || ped.y > H + 60;
    if (out) {
      score += 3;
      beep(940, 0.03, 'square', 0.02);
    }
    return !out;
  });

  const blockedCars = cars.filter((c) => !c.entered && phase !== 'cars').length;
  const blockedPeds = peds.filter((p) => !p.entered && phase !== 'walk').length;
  const queue = blockedCars + blockedPeds;

  const overload = Math.max(0, queue - 6);
  pressure += overload * dt * 0.0022;
  pressure -= dt * 0.011;
  pressure = clamp(pressure, 0, 100);

  if (pressure >= 100) {
    gameOver = true;
    running = false;
    beep(100, 0.2, 'sawtooth', 0.07);
  }

  if (score > best) {
    best = score;
    localStorage.setItem(bestKey, String(best));
  }

  updateHud();
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  phaseEl.textContent = phase === 'cars' ? 'Cars GO' : 'Walk GO';
  phaseEl.style.color = phase === 'cars' ? '#7cff8b' : '#1df2ff';
  pressureFill.style.width = `${pressure}%`;
}

function drawRoadGrid() {
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, W, 1);
  }

  ctx.fillStyle = '#141b2e';
  ctx.fillRect(0, centerY - 65, W, 130);
  ctx.fillRect(centerX - 65, 0, 130, H);

  ctx.fillStyle = 'rgba(29,242,255,0.15)';
  ctx.fillRect(ix1, iy1, ix2 - ix1, iy2 - iy1);

  // lane marks
  ctx.strokeStyle = 'rgba(173, 184, 217, 0.22)';
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(W, centerY);
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // stop bars
  ctx.fillStyle = phase === 'cars' ? '#7cff8b' : '#ff5d8f';
  ctx.fillRect(ix1 - 8, centerY - 70, 4, 56);
  ctx.fillRect(ix1 - 8, centerY + 14, 4, 56);
  ctx.fillRect(ix2 + 4, centerY - 70, 4, 56);
  ctx.fillRect(ix2 + 4, centerY + 14, 4, 56);

  ctx.fillStyle = phase === 'walk' ? '#1df2ff' : '#ff5d8f';
  ctx.fillRect(centerX - 70, iy1 - 8, 56, 4);
  ctx.fillRect(centerX + 14, iy1 - 8, 56, 4);
  ctx.fillRect(centerX - 70, iy2 + 4, 56, 4);
  ctx.fillRect(centerX + 14, iy2 + 4, 56, 4);
}

function drawSignals() {
  const carLight = phase === 'cars' ? '#7cff8b' : '#ff3e6a';
  const walkLight = phase === 'walk' ? '#1df2ff' : '#ff3e6a';

  glowDot(ix1 - 24, centerY - 82, carLight);
  glowDot(ix2 + 24, centerY + 82, carLight);
  glowDot(centerX + 82, iy1 - 22, walkLight);
  glowDot(centerX - 82, iy2 + 22, walkLight);
}

function glowDot(x, y, color) {
  ctx.shadowBlur = 14;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCars() {
  for (const car of cars) {
    ctx.fillStyle = car.dir === 1 ? '#ff5fa7' : '#9f7bff';
    ctx.fillRect(car.x, car.y, car.w, car.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(car.x + 8, car.y + 7, car.w - 16, 9);
    ctx.fillStyle = '#0d1328';
    ctx.fillRect(car.x + 5, car.y + 22, car.w - 10, 5);
  }
}

function drawPeds() {
  for (const ped of peds) {
    ctx.fillStyle = ped.dir === 1 ? '#ffe06a' : '#5cf8ff';
    ctx.fillRect(ped.x, ped.y, ped.w, ped.h);
    ctx.fillStyle = '#11182e';
    ctx.fillRect(ped.x + 5, ped.y + 3, 6, 4);
    ctx.fillRect(ped.x + 4, ped.y + 10, 8, 4);
  }
}

function drawOverlay() {
  if (!gameOver) return;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6f9f';
  ctx.font = 'bold 52px Trebuchet MS, sans-serif';
  ctx.fillText('SHIFT OVER', W / 2, H / 2 - 18);
  ctx.fillStyle = '#d7e2ff';
  ctx.font = '22px Trebuchet MS, sans-serif';
  ctx.fillText(`Score: ${score}  •  Best: ${best}`, W / 2, H / 2 + 24);
  ctx.font = '18px Trebuchet MS, sans-serif';
  ctx.fillText('Press Reset to run another night shift.', W / 2, H / 2 + 58);
}

function render() {
  drawRoadGrid();
  drawSignals();
  drawCars();
  drawPeds();
  drawOverlay();
}

function tick(now) {
  const dt = now - lastTime;
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

startBtn.addEventListener('click', () => {
  unlockAudio();
  running = true;
  if (gameOver) {
    resetState();
    running = true;
  }
  beep(520, 0.1, 'square', 0.04);
});

pauseBtn.addEventListener('click', () => {
  unlockAudio();
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
  beep(running ? 440 : 260, 0.08, 'triangle', 0.04);
});

toggleBtn.addEventListener('click', () => {
  unlockAudio();
  toggleSignal();
});

resetBtn.addEventListener('click', () => {
  unlockAudio();
  resetState();
  running = false;
  pauseBtn.textContent = 'Pause';
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    unlockAudio();
    toggleSignal();
  } else if (event.key.toLowerCase() === 'r') {
    unlockAudio();
    resetState();
    running = false;
    pauseBtn.textContent = 'Pause';
  }
});

resetState();
requestAnimationFrame(tick);
