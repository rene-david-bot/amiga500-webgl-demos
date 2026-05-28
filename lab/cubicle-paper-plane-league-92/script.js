const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const windSlider = document.getElementById('windSlider');
const windValue = document.getElementById('windValue');
const fanMode = document.getElementById('fanMode');

const startBtn = document.getElementById('startBtn');
const layoutBtn = document.getElementById('layoutBtn');

const scoreValue = document.getElementById('scoreValue');
const comboValue = document.getElementById('comboValue');
const rateValue = document.getElementById('rateValue');
const timeValue = document.getElementById('timeValue');

const launchPad = { x: 114, y: 420 };

const state = {
  score: 0,
  combo: 0,
  hits: 0,
  throws: 0,
  timeLeft: 75,
  running: false,
  ended: false,
  plane: null,
  drag: null,
  fanPhase: Math.random() * Math.PI * 2,
  windBias: 0,
  raf: null,
  lastTick: 0,
  audioReady: false,
  audioCtx: null,
  bins: [],
  flash: 0,
  tip: 'Drag from launch pad to throw your first plane.'
};

const quality = {
  steady: 0.35,
  gusty: 0.95,
  chaos: 1.5
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function updateHud() {
  scoreValue.textContent = String(state.score);
  comboValue.textContent = `x${Math.max(1, state.combo)}`;
  const rate = state.throws ? Math.round((state.hits / state.throws) * 100) : 0;
  rateValue.textContent = `${rate}%`;
  timeValue.textContent = `${Math.max(0, Math.ceil(state.timeLeft))}s`;
  windValue.textContent = `${state.windBias >= 0 ? '+' : ''}${state.windBias.toFixed(1)}`;
}

function ensureAudio() {
  if (state.audioReady) return;
  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  state.audioReady = true;
}

function blip(freq = 280, duration = 0.1, type = 'square', gain = 0.05, glide = 0) {
  if (!state.audioReady || !state.audioCtx) return;
  const t0 = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq + glide), t0 + duration);
  }
  amp.gain.setValueAtTime(0.001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(amp).connect(state.audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function shuffleBins() {
  const baseX = [580, 710, 840];
  state.bins = baseX.map((x, i) => {
    const width = 64;
    const height = 52;
    const offsetY = i === 1 ? rand(-40, 15) : rand(-20, 24);
    return {
      id: i,
      x: x + rand(-24, 20),
      y: 350 + offsetY,
      w: width,
      h: height,
      points: 120 + i * 60
    };
  });
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.combo = 0;
  state.hits = 0;
  state.throws = 0;
  state.timeLeft = 75;
  state.running = true;
  state.ended = false;
  state.plane = null;
  state.drag = null;
  state.flash = 0;
  state.tip = 'Shift live. Hit trays to build combo.';
  shuffleBins();
  updateHud();
  blip(220, 0.13, 'sawtooth', 0.045, 120);
}

function currentWind(t) {
  const mode = fanMode.value;
  const wobble = Math.sin(t * 2.6 + state.fanPhase) * quality[mode];
  const jitter = (Math.random() - 0.5) * quality[mode] * 0.18;
  return state.windBias + wobble + jitter;
}

function launchPlane(vx, vy) {
  state.plane = {
    x: launchPad.x,
    y: launchPad.y,
    vx,
    vy,
    rot: -0.2,
    trail: []
  };
  state.throws += 1;
  state.tip = 'In flight...';
  blip(540, 0.14, 'triangle', 0.045, -260);
}

function resetComboMiss() {
  state.combo = 0;
  state.tip = 'Missed tray. Rebuild your streak.';
  blip(150, 0.16, 'square', 0.05, -20);
}

function scoreHit(bin) {
  state.hits += 1;
  state.combo += 1;
  const multi = 1 + Math.min(3, Math.floor(state.combo / 2)) * 0.5;
  const points = Math.round(bin.points * multi);
  state.score += points;
  state.flash = 0.22;
  state.tip = `Inbox hit! +${points}`;
  blip(880, 0.08, 'square', 0.06, 200);
  blip(1280, 0.09, 'triangle', 0.045, -140);
}

function updatePlane(dt, now) {
  if (!state.plane) return;

  const wind = currentWind(now);
  const p = state.plane;
  p.vx += wind * dt * 14;
  p.vy += 540 * dt;

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.rot = Math.atan2(p.vy, p.vx);

  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 22) p.trail.shift();

  const hit = state.bins.find((bin) => p.x > bin.x && p.x < bin.x + bin.w && p.y > bin.y && p.y < bin.y + bin.h);
  if (hit) {
    scoreHit(hit);
    state.plane = null;
    return;
  }

  if (p.y > canvas.height - 18 || p.x > canvas.width + 30 || p.x < -40 || p.y < -50) {
    state.plane = null;
    resetComboMiss();
  }
}

function drawBackdrop(now) {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#0d1732');
  g.addColorStop(1, '#090d1b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 4; i += 1) {
    const y = 78 + i * 86;
    ctx.fillStyle = i % 2 ? 'rgba(27,38,70,0.45)' : 'rgba(16,27,56,0.38)';
    ctx.fillRect(0, y, canvas.width, 48);
  }

  ctx.fillStyle = '#111b37';
  for (let x = 190; x < canvas.width; x += 145) {
    ctx.fillRect(x, 330, 98, 110);
    ctx.fillStyle = '#3d5f95';
    ctx.fillRect(x + 8, 338, 82, 6);
    ctx.fillStyle = '#111b37';
  }

  ctx.fillStyle = '#152646';
  ctx.fillRect(0, 438, canvas.width, 82);

  const pulse = 0.6 + Math.sin(now * 2.1) * 0.4;
  ctx.fillStyle = `rgba(97,234,255,${0.1 * pulse})`;
  ctx.fillRect(0, 438, canvas.width, 4);
}

function drawBins(now) {
  state.bins.forEach((bin, i) => {
    const glow = 0.2 + Math.sin(now * 4 + i) * 0.11 + state.flash;
    ctx.fillStyle = `rgba(97,234,255,${clamp(glow, 0.08, 0.48)})`;
    ctx.fillRect(bin.x - 3, bin.y - 3, bin.w + 6, bin.h + 6);

    ctx.fillStyle = '#0d1428';
    ctx.fillRect(bin.x, bin.y, bin.w, bin.h);
    ctx.strokeStyle = '#66eaff';
    ctx.lineWidth = 2;
    ctx.strokeRect(bin.x, bin.y, bin.w, bin.h);

    ctx.fillStyle = '#bfeeff';
    ctx.font = 'bold 14px Trebuchet MS';
    ctx.fillText(`INBOX ${String.fromCharCode(65 + i)}`, bin.x + 7, bin.y + 20);
    ctx.fillStyle = '#9dd0ff';
    ctx.font = '12px Trebuchet MS';
    ctx.fillText(`${bin.points} pts`, bin.x + 7, bin.y + 38);
  });
}

function drawLaunchPad() {
  ctx.fillStyle = '#1f2f58';
  ctx.fillRect(38, 382, 150, 86);
  ctx.strokeStyle = '#76ebff';
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 382, 150, 86);

  ctx.fillStyle = '#d8f4ff';
  ctx.font = 'bold 14px Trebuchet MS';
  ctx.fillText('LAUNCH PAD', 58, 407);

  ctx.beginPath();
  ctx.arc(launchPad.x, launchPad.y, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8be0';
  ctx.fill();
}

function drawPlane(plane) {
  if (!plane) return;

  for (let i = 0; i < plane.trail.length; i += 1) {
    const t = plane.trail[i];
    const a = i / plane.trail.length;
    ctx.fillStyle = `rgba(168,255,158,${a * 0.4})`;
    ctx.fillRect(t.x, t.y, 2, 2);
  }

  ctx.save();
  ctx.translate(plane.x, plane.y);
  ctx.rotate(plane.rot);
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -7);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 7);
  ctx.closePath();
  ctx.fillStyle = '#eff7ff';
  ctx.fill();

  ctx.strokeStyle = '#a8ff9e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(14, 0);
  ctx.stroke();
  ctx.restore();
}

function drawAimGuide() {
  if (!state.drag || state.plane || !state.running) return;
  const dx = state.drag.x - launchPad.x;
  const dy = state.drag.y - launchPad.y;
  const dist = clamp(Math.hypot(dx, dy), 16, 170);
  const nx = dx / (Math.hypot(dx, dy) || 1);
  const ny = dy / (Math.hypot(dx, dy) || 1);

  const ax = launchPad.x + nx * dist;
  const ay = launchPad.y + ny * dist;

  ctx.strokeStyle = 'rgba(255,139,224,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(launchPad.x, launchPad.y);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  const power = dist / 170;
  ctx.fillStyle = '#ff8be0';
  ctx.font = 'bold 13px Trebuchet MS';
  ctx.fillText(`Power ${(power * 100).toFixed(0)}%`, 38, 366);

  let px = launchPad.x;
  let py = launchPad.y;
  let vx = nx * dist * 2.2;
  let vy = ny * dist * 2.2;

  ctx.fillStyle = 'rgba(97,234,255,0.5)';
  for (let i = 0; i < 45; i += 1) {
    vx += state.windBias * 0.18;
    vy += 8;
    px += vx * 0.016;
    py += vy * 0.016;
    if (i % 3 === 0) {
      ctx.fillRect(px, py, 2, 2);
    }
    if (py > canvas.height) break;
  }
}

function drawHudOverlay(now, wind) {
  ctx.fillStyle = 'rgba(6,11,24,0.7)';
  ctx.fillRect(0, 0, canvas.width, 46);
  ctx.strokeStyle = '#325388';
  ctx.strokeRect(0, 0, canvas.width, 46);

  ctx.fillStyle = '#b9d8ff';
  ctx.font = 'bold 15px Trebuchet MS';
  ctx.fillText(`Wind ${wind >= 0 ? '+' : ''}${wind.toFixed(2)}`, 16, 28);
  ctx.fillText(`Best throw: ${state.hits ? Math.round(state.score / state.hits) : 0}`, 180, 28);
  ctx.fillText(state.tip, 420, 28);

  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, y, canvas.width, 1);
  }

  const v = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.5, 170, canvas.width * 0.5, canvas.height * 0.5, 640);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blink = 0.25 + Math.sin(now * 8) * 0.12;
  ctx.strokeStyle = `rgba(97,234,255,${blink})`;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
}

function drawEndBanner() {
  if (!state.ended) return;
  ctx.fillStyle = 'rgba(3,7,14,0.72)';
  ctx.fillRect(170, 180, 580, 170);
  ctx.strokeStyle = '#71ecff';
  ctx.lineWidth = 2;
  ctx.strokeRect(170, 180, 580, 170);

  ctx.fillStyle = '#e7f7ff';
  ctx.font = 'bold 36px Trebuchet MS';
  ctx.fillText('SHIFT COMPLETE', 304, 230);

  ctx.font = 'bold 24px Trebuchet MS';
  ctx.fillStyle = '#a8ff9e';
  ctx.fillText(`Final Score: ${state.score}`, 350, 270);

  const rate = state.throws ? Math.round((state.hits / state.throws) * 100) : 0;
  ctx.fillStyle = '#a9d0ff';
  ctx.font = '18px Trebuchet MS';
  ctx.fillText(`Throws: ${state.throws}   Hits: ${state.hits}   Hit Rate: ${rate}%`, 255, 304);
  ctx.fillText('Press Start Shift for another round.', 300, 332);
}

function frame(nowMs) {
  const now = nowMs * 0.001;
  if (!state.lastTick) state.lastTick = now;
  const dt = clamp(now - state.lastTick, 0, 0.033);
  state.lastTick = now;

  if (state.running) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.running = false;
      state.ended = true;
      state.plane = null;
      state.tip = 'Shift over. Nice throws.';
      blip(280, 0.2, 'triangle', 0.05, -110);
    }
    updatePlane(dt, now);
  }

  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.8);

  const wind = currentWind(now);
  drawBackdrop(now);
  drawBins(now);
  drawLaunchPad();
  drawAimGuide();
  drawPlane(state.plane);
  drawHudOverlay(now, wind);
  drawEndBanner();

  updateHud();
  state.raf = requestAnimationFrame(frame);
}

function pointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * canvas.width,
    y: ((evt.clientY - rect.top) / rect.height) * canvas.height
  };
}

canvas.addEventListener('pointerdown', (evt) => {
  if (!state.running || state.plane) return;
  const p = pointerPos(evt);
  const inPad = Math.hypot(p.x - launchPad.x, p.y - launchPad.y) < 44;
  if (!inPad) return;
  state.drag = p;
  canvas.setPointerCapture(evt.pointerId);
});

canvas.addEventListener('pointermove', (evt) => {
  if (!state.drag || state.plane || !state.running) return;
  state.drag = pointerPos(evt);
});

canvas.addEventListener('pointerup', (evt) => {
  if (!state.drag || state.plane || !state.running) return;
  const p = pointerPos(evt);
  const dx = p.x - launchPad.x;
  const dy = p.y - launchPad.y;
  const dist = clamp(Math.hypot(dx, dy), 14, 170);
  const n = Math.hypot(dx, dy) || 1;
  const nx = dx / n;
  const ny = dy / n;
  launchPlane(nx * dist * 2.35, ny * dist * 2.35);
  state.drag = null;
});

windSlider.addEventListener('input', () => {
  state.windBias = Number(windSlider.value);
  updateHud();
});

startBtn.addEventListener('click', startGame);
layoutBtn.addEventListener('click', () => {
  shuffleBins();
  state.tip = 'Cubicles reshuffled.';
  blip(430, 0.08, 'square', 0.04, 80);
});

shuffleBins();
updateHud();
state.raf = requestAnimationFrame(frame);
