const canvas = document.getElementById('orbit');
const ctx = canvas.getContext('2d');

const satCountEl = document.getElementById('satCount');
const trailCountEl = document.getElementById('trailCount');
const speedValueEl = document.getElementById('speedValue');
const gravityValueEl = document.getElementById('gravityValue');
const speedRange = document.getElementById('speedRange');
const gravityRange = document.getElementById('gravityRange');
const statusEl = document.getElementById('status');

const rosetteBtn = document.getElementById('rosetteBtn');
const ringsBtn = document.getElementById('ringsBtn');
const chaosBtn = document.getElementById('chaosBtn');
const clearBtn = document.getElementById('clearBtn');
const newColorsBtn = document.getElementById('newColorsBtn');

const center = { x: canvas.width / 2, y: canvas.height / 2 };
const planetRadius = 42;
const baseGravity = 6500;
let simSpeed = Number(speedRange.value);
let gravityScale = Number(gravityRange.value);
let satellites = [];
let palette = ['#7de9ff', '#ff8ce5', '#8dffcc', '#ffd88b', '#9da7ff'];
let glowPulse = 0;

let audioCtx = null;
let muted = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 500, dur = 0.06, type = 'triangle', gainValue = 0.018, start = 0) {
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

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pickColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function orbitVelocity(pos, strength = 1) {
  const dx = pos.x - center.x;
  const dy = pos.y - center.y;
  const r = Math.max(40, Math.hypot(dx, dy));
  const tangentX = -dy / r;
  const tangentY = dx / r;
  const circular = Math.sqrt((baseGravity * gravityScale) / r);
  const speed = circular * strength;
  return { vx: tangentX * speed, vy: tangentY * speed };
}

function createSatellite(x, y, speedFactor = 1, customColor = pickColor()) {
  const vel = orbitVelocity({ x, y }, speedFactor);
  satellites.push({
    x,
    y,
    vx: vel.vx,
    vy: vel.vy,
    color: customColor,
    size: rand(2.2, 3.9),
    trail: []
  });
}

function setStatus(text) {
  statusEl.textContent = text;
}

function clearTrails() {
  satellites.forEach((sat) => {
    sat.trail.length = 0;
  });
  setStatus('Trails cleared. Keep sculpting fresh paths.');
}

function randomPalette() {
  palette = Array.from({ length: 5 }, () => `hsl(${Math.floor(rand(0, 360))} 95% ${Math.floor(rand(62, 76))}%)`);
  satellites.forEach((sat) => {
    sat.color = pickColor();
  });
  setStatus('Palette remapped. Neon inks refreshed.');
  beep(700, 0.06, 'square', 0.015);
  beep(820, 0.08, 'triangle', 0.014, 0.06);
}

function seedRosette() {
  satellites = [];
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const radius = 120 + (i % 2) * 38;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    createSatellite(x, y, 0.92 + (i % 3) * 0.09);
  }
  setStatus('Rosette preset loaded. Click map to add custom satellites.');
}

function seedTwinRings() {
  satellites = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    createSatellite(center.x + Math.cos(a) * 110, center.y + Math.sin(a) * 110, 1.02);
  }
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * 2 * i) / 10 + 0.2;
    createSatellite(center.x + Math.cos(a) * 205, center.y + Math.sin(a) * 205, 0.88);
  }
  setStatus('Twin Rings preset loaded. Stable loops with subtle drift.');
}

function seedChaos() {
  satellites = [];
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const r = rand(95, 250);
    const a = rand(0, Math.PI * 2);
    const x = center.x + Math.cos(a) * r;
    const y = center.y + Math.sin(a) * r;
    createSatellite(x, y, rand(0.75, 1.25));
  }
  setStatus('Chaos preset loaded. Expect interceptions and wild spirals.');
}

function updateHud() {
  satCountEl.textContent = String(satellites.length);
  trailCountEl.textContent = String(
    satellites.reduce((sum, sat) => sum + sat.trail.length, 0)
  );
  speedValueEl.textContent = `${simSpeed.toFixed(2)}x`;
  gravityValueEl.textContent = gravityScale.toFixed(2);
}

function update(dt) {
  const step = dt * simSpeed;
  const g = baseGravity * gravityScale;

  satellites.forEach((sat) => {
    const dx = center.x - sat.x;
    const dy = center.y - sat.y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);

    if (r < planetRadius + 6) {
      const angle = rand(0, Math.PI * 2);
      const spawnR = rand(120, 250);
      sat.x = center.x + Math.cos(angle) * spawnR;
      sat.y = center.y + Math.sin(angle) * spawnR;
      const vel = orbitVelocity({ x: sat.x, y: sat.y }, rand(0.9, 1.15));
      sat.vx = vel.vx;
      sat.vy = vel.vy;
      sat.trail.length = 0;
      beep(190, 0.05, 'sawtooth', 0.012);
      return;
    }

    const accel = g / Math.max(2200, r2);
    sat.vx += (dx / r) * accel * step;
    sat.vy += (dy / r) * accel * step;

    sat.x += sat.vx * step;
    sat.y += sat.vy * step;

    if (sat.x < -120 || sat.x > canvas.width + 120 || sat.y < -120 || sat.y > canvas.height + 120) {
      const angle = rand(0, Math.PI * 2);
      const spawnR = rand(170, 260);
      sat.x = center.x + Math.cos(angle) * spawnR;
      sat.y = center.y + Math.sin(angle) * spawnR;
      const vel = orbitVelocity({ x: sat.x, y: sat.y }, rand(0.85, 1.1));
      sat.vx = vel.vx;
      sat.vy = vel.vy;
      sat.trail.length = 0;
      return;
    }

    sat.trail.push({ x: sat.x, y: sat.y });
    if (sat.trail.length > 220) sat.trail.shift();
  });

  glowPulse += dt * 2.1;
}

function drawBackdrop() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#071634');
  bg.addColorStop(1, '#02060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(124, 185, 255, 0.12)';
  for (let i = 0; i < 120; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = (i * 53 + glowPulse * 17) % canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }

  for (let r = 80; r <= 260; r += 60) {
    ctx.strokeStyle = 'rgba(122, 168, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlanet() {
  const pulse = 0.85 + Math.sin(glowPulse) * 0.14;
  const grad = ctx.createRadialGradient(
    center.x - 8,
    center.y - 10,
    6,
    center.x,
    center.y,
    planetRadius + 40
  );
  grad.addColorStop(0, '#eef6ff');
  grad.addColorStop(0.45, '#78b8ff');
  grad.addColorStop(1, 'rgba(47, 86, 160, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center.x, center.y, planetRadius + 36 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#122a62';
  ctx.beginPath();
  ctx.arc(center.x, center.y, planetRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(156, 209, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center.x, center.y, planetRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSatellites() {
  satellites.forEach((sat) => {
    if (sat.trail.length > 1) {
      ctx.beginPath();
      sat.trail.forEach((point, idx) => {
        if (idx === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = sat.color;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = sat.color;
    ctx.shadowColor = sat.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, sat.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  update(dt);
  drawBackdrop();
  drawSatellites();
  drawPlanet();
  updateHud();

  requestAnimationFrame(frame);
}

canvas.addEventListener('click', (event) => {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const speed = rand(0.8, 1.2);
  createSatellite(x, y, speed);
  setStatus('Satellite launched. Keep clicking to layer new trails.');
  beep(560, 0.05, 'square', 0.014);
});

speedRange.addEventListener('input', () => {
  simSpeed = Number(speedRange.value);
  updateHud();
});

gravityRange.addEventListener('input', () => {
  gravityScale = Number(gravityRange.value);
  satellites.forEach((sat) => {
    const vel = orbitVelocity({ x: sat.x, y: sat.y }, rand(0.9, 1.1));
    sat.vx = vel.vx;
    sat.vy = vel.vy;
  });
  updateHud();
});

rosetteBtn.addEventListener('click', () => {
  initAudio();
  seedRosette();
  beep(470, 0.06, 'triangle', 0.015);
});

ringsBtn.addEventListener('click', () => {
  initAudio();
  seedTwinRings();
  beep(620, 0.06, 'triangle', 0.015);
});

chaosBtn.addEventListener('click', () => {
  initAudio();
  seedChaos();
  beep(320, 0.08, 'sawtooth', 0.014);
});

clearBtn.addEventListener('click', clearTrails);
newColorsBtn.addEventListener('click', () => {
  initAudio();
  randomPalette();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') {
    muted = !muted;
    setStatus(muted ? 'Audio muted.' : 'Audio unmuted.');
  }
});

seedRosette();
updateHud();
requestAnimationFrame(frame);
