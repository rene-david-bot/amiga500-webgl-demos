const el = {
  canvas: document.getElementById('game'),
  score: document.getElementById('score'),
  lives: document.getElementById('lives'),
  combo: document.getElementById('combo'),
  best: document.getElementById('best'),
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn'),
  leftBtn: document.getElementById('leftBtn'),
  rightBtn: document.getElementById('rightBtn'),
  audioToggle: document.getElementById('audioToggle')
};

const ctx = el.canvas.getContext('2d');
const lanes = 4;
const playerY = 360;
const lanePad = 58;

const state = {
  running: false,
  lane: 1,
  score: 0,
  lives: 3,
  combo: 0,
  best: Number(localStorage.getItem('rollerDiscoBest') || 0),
  elapsed: 0,
  spawnClock: 0.4,
  objects: [],
  lastTs: 0,
  flash: 0,
  audioOn: false,
  audioCtx: null,
  beatClock: 0
};

el.best.textContent = state.best;

function laneX(index) {
  const width = el.canvas.width - lanePad * 2;
  const laneW = width / lanes;
  return lanePad + laneW * index + laneW / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 440, ms = 80, gain = 0.015, type = 'square') {
  if (!state.audioOn) return;
  try {
    ensureAudio();
    const osc = state.audioCtx.createOscillator();
    const amp = state.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, state.audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, state.audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + ms / 1000);
    osc.connect(amp).connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    // audio is optional
  }
}

function updateHud() {
  el.score.textContent = Math.floor(state.score);
  el.lives.textContent = state.lives;
  el.combo.textContent = `${state.combo}x`;
  el.best.textContent = state.best;
}

function showOverlay(title, detail) {
  el.overlay.innerHTML = `<div class="overlay-title">${title}</div><p>${detail}</p>`;
  el.overlay.classList.remove('hidden');
}

function hideOverlay() {
  el.overlay.classList.add('hidden');
}

function randomObject() {
  const isPickup = Math.random() < 0.34;
  return {
    lane: Math.floor(Math.random() * lanes),
    y: -26,
    type: isPickup ? 'pickup' : 'obstacle',
    resolved: false,
    wiggle: Math.random() * Math.PI * 2
  };
}

function startRun() {
  state.running = true;
  state.lane = 1;
  state.score = 0;
  state.lives = 3;
  state.combo = 0;
  state.elapsed = 0;
  state.spawnClock = 0.45;
  state.objects = [];
  state.flash = 0;
  state.beatClock = 0;
  hideOverlay();
  updateHud();
  beep(520, 80, 0.012, 'triangle');
}

function endRun() {
  state.running = false;
  if (state.score > state.best) {
    state.best = Math.floor(state.score);
    localStorage.setItem('rollerDiscoBest', String(state.best));
  }
  updateHud();
  showOverlay('Run Over', `Score ${Math.floor(state.score)} · Best ${state.best}<br/>Hit START for another skate.`);
  beep(130, 240, 0.02, 'sawtooth');
}

function moveLane(delta) {
  if (!state.running) return;
  const next = clamp(state.lane + delta, 0, lanes - 1);
  if (next !== state.lane) {
    state.lane = next;
    beep(260 + state.lane * 90, 45, 0.008, 'triangle');
  }
}

function hitObstacle() {
  state.lives -= 1;
  state.combo = 0;
  state.flash = 0.18;
  beep(170, 120, 0.018, 'sawtooth');
  if (state.lives <= 0) {
    endRun();
  }
}

function collectPickup() {
  state.combo += 1;
  state.score += 120 + state.combo * 16;
  beep(760 + Math.min(320, state.combo * 18), 70, 0.013, 'triangle');
}

function update(dt) {
  state.elapsed += dt;
  const speed = 180 + state.elapsed * 10;

  state.spawnClock -= dt;
  if (state.spawnClock <= 0) {
    state.objects.push(randomObject());
    const minGap = 0.24;
    const maxGap = 0.6;
    const pressure = Math.max(0, 1 - state.elapsed / 70);
    state.spawnClock = minGap + pressure * (maxGap - minGap) + Math.random() * 0.07;
  }

  state.beatClock += dt;
  if (state.audioOn && state.beatClock > 0.52) {
    state.beatClock = 0;
    beep(220, 22, 0.005, 'square');
  }

  for (const obj of state.objects) {
    obj.y += speed * dt;
    obj.wiggle += dt * 8;

    if (!obj.resolved && obj.y >= playerY - 20) {
      obj.resolved = true;
      if (obj.lane === state.lane) {
        if (obj.type === 'obstacle') {
          hitObstacle();
        } else {
          collectPickup();
        }
      } else if (obj.type === 'pickup') {
        state.combo = 0;
      } else {
        state.score += 18;
      }
    }
  }

  state.objects = state.objects.filter(obj => obj.y < el.canvas.height + 28);
  state.score += dt * (7 + state.combo * 0.7);
  state.flash = Math.max(0, state.flash - dt);
  updateHud();
}

function drawTrack() {
  const w = el.canvas.width;
  const h = el.canvas.height;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#0c1942');
  bgGrad.addColorStop(1, '#050812');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 52; i += 1) {
    const y = (i * 14 + state.elapsed * 120) % (h + 14);
    ctx.fillRect(0, y, w, 1);
  }

  const laneW = (w - lanePad * 2) / lanes;
  ctx.strokeStyle = 'rgba(115, 168, 255, 0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= lanes; i += 1) {
    const x = lanePad + i * laneW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 104, 213, 0.14)';
  ctx.fillRect(lanePad, playerY - 24, w - lanePad * 2, 48);

  for (let i = 0; i < lanes; i += 1) {
    const x = laneX(i);
    ctx.fillStyle = i === state.lane ? '#67ffe0' : 'rgba(126, 175, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(x, h - 14, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const x = laneX(state.lane);
  const y = playerY;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#f8f0ff';
  ctx.fillRect(-10, -14, 20, 18);
  ctx.fillStyle = '#ff6fcf';
  ctx.fillRect(-14, 0, 28, 8);

  ctx.fillStyle = '#6cd6ff';
  ctx.fillRect(-20, 7, 40, 3);

  ctx.fillStyle = '#0b1025';
  ctx.fillRect(-12, -10, 8, 4);
  ctx.fillRect(4, -10, 8, 4);

  ctx.restore();
}

function drawObjects() {
  for (const obj of state.objects) {
    const x = laneX(obj.lane);
    const bob = Math.sin(obj.wiggle) * 2.2;

    if (obj.type === 'obstacle') {
      ctx.fillStyle = '#ff5db6';
      ctx.beginPath();
      ctx.moveTo(x, obj.y - 14 + bob);
      ctx.lineTo(x - 14, obj.y + 12 + bob);
      ctx.lineTo(x + 14, obj.y + 12 + bob);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff1ff';
      ctx.fillRect(x - 3, obj.y + 2 + bob, 6, 4);
    } else {
      ctx.fillStyle = '#4dffb6';
      ctx.fillRect(x - 12, obj.y - 9 + bob, 24, 16);
      ctx.fillStyle = '#0b1630';
      ctx.fillRect(x - 7, obj.y - 6 + bob, 5, 4);
      ctx.fillRect(x + 2, obj.y - 6 + bob, 5, 4);
      ctx.fillStyle = '#d7fff1';
      ctx.fillRect(x - 2, obj.y + 2 + bob, 4, 3);
    }
  }
}

function drawFlash() {
  if (state.flash <= 0) return;
  ctx.fillStyle = `rgba(255, 97, 168, ${Math.min(0.45, state.flash * 2.2)})`;
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
}

function render() {
  drawTrack();
  drawObjects();
  drawPlayer();
  drawFlash();

  if (!state.running) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
  }
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - (state.lastTs || ts)) / 1000);
  state.lastTs = ts;

  if (state.running) {
    update(dt);
  }
  render();
  requestAnimationFrame(frame);
}

function bindEvents() {
  el.startBtn.addEventListener('click', startRun);
  el.leftBtn.addEventListener('click', () => moveLane(-1));
  el.rightBtn.addEventListener('click', () => moveLane(1));

  el.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    el.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) beep(520, 70, 0.012, 'triangle');
  });

  document.addEventListener('keydown', event => {
    if (event.repeat) return;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
      moveLane(-1);
    }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
      moveLane(1);
    }
    if (event.key === ' ' || event.key === 'Enter') {
      if (!state.running) startRun();
    }
  });
}

function boot() {
  bindEvents();
  showOverlay('Press START', 'Arrow keys or A / D to switch lanes.<br/>Survive the disco track.');
  updateHud();
  requestAnimationFrame(frame);
}

boot();
