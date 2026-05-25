const canvas = document.getElementById('coverCanvas');
const ctx = canvas.getContext('2d');

const themeSelect = document.getElementById('themeSelect');
const titleInput = document.getElementById('titleInput');
const markerColorInput = document.getElementById('markerColor');
const randomizeBtn = document.getElementById('randomizeBtn');
const stickerBtn = document.getElementById('stickerBtn');
const clearInkBtn = document.getElementById('clearInkBtn');
const exportBtn = document.getElementById('exportBtn');

const THEMES = {
  'laser-sunset': {
    gradient: ['#ff4db8', '#ff8f3f', '#ffe46b'],
    accents: ['#00f7ff', '#ff2f92', '#fff37a', '#6efb8e']
  },
  'pool-party': {
    gradient: ['#24d4ff', '#2e74ff', '#9d4dff'],
    accents: ['#f8ff75', '#61ffef', '#ffffff', '#ff7adf']
  },
  'galaxy-gel': {
    gradient: ['#3f2aff', '#7f35ff', '#ff4da0'],
    accents: ['#78f8ff', '#ffa0ff', '#fff7b8', '#91ffb4']
  },
  'mint-static': {
    gradient: ['#5affcf', '#53c9ff', '#7b8cff'],
    accents: ['#ffffff', '#0f1c4b', '#ff6ac4', '#fff57e']
  }
};

const STICKERS = ['⚡', '★', '☯', '☼', '✦', '✱', '❖', '☢', '☾', '∞'];

const state = {
  title: titleInput.value,
  theme: themeSelect.value,
  stickers: [],
  inkPaths: [],
  drawing: false,
  currentPath: null,
  audioCtx: null
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function choose(list) {
  return list[randInt(0, list.length - 1)];
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function beep(freq = 340, duration = 0.08, gain = 0.04, type = 'square') {
  if (!state.audioCtx) return;

  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(state.audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function makeSticker() {
  const theme = THEMES[state.theme];
  return {
    x: randInt(70, canvas.width - 70),
    y: randInt(90, canvas.height - 90),
    size: randInt(26, 58),
    char: choose(STICKERS),
    color: choose(theme.accents),
    rotation: rand(-0.55, 0.55)
  };
}

function seedStickers(count = 8) {
  state.stickers = Array.from({ length: count }, () => makeSticker());
}

function drawBackground(theme) {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, theme.gradient[0]);
  grad.addColorStop(0.52, theme.gradient[1]);
  grad.addColorStop(1, theme.gradient[2]);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 28; i += 1) {
    const w = randInt(110, 260);
    const h = randInt(20, 60);
    const x = randInt(-40, canvas.width - 40);
    const y = randInt(-20, canvas.height - 20);

    ctx.fillStyle = `rgba(255,255,255,${rand(0.05, 0.14).toFixed(3)})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand(-0.5, 0.5));
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  for (let i = 0; i < 900; i += 1) {
    const alpha = rand(0.02, 0.09);
    ctx.fillStyle = `rgba(10,10,25,${alpha.toFixed(3)})`;
    ctx.fillRect(randInt(0, canvas.width), randInt(0, canvas.height), 1, 1);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.fillRect(18, 18, canvas.width - 36, canvas.height - 36);
}

function drawHeaderStrip(theme) {
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(36, 34, canvas.width - 72, 110);

  ctx.strokeStyle = choose(theme.accents);
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 34, canvas.width - 72, 110);

  ctx.fillStyle = '#f4f8ff';
  ctx.font = '700 48px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (state.title || 'MEGA BINDER').toUpperCase();
  ctx.fillText(title.slice(0, 24), canvas.width / 2, 88);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '700 16px "Trebuchet MS", sans-serif';
  ctx.fillText('PROPERTY OF THE COOLEST DESK IN HOMEROOM', canvas.width / 2, 124);
}

function drawSticker(sticker) {
  ctx.save();
  ctx.translate(sticker.x, sticker.y);
  ctx.rotate(sticker.rotation);

  ctx.fillStyle = 'rgba(8, 8, 20, 0.3)';
  ctx.fillRect(-sticker.size * 0.5, -sticker.size * 0.5, sticker.size, sticker.size);

  ctx.font = `${sticker.size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = sticker.color;
  ctx.fillText(sticker.char, 0, 0);

  ctx.restore();
}

function drawInk() {
  state.inkPaths.forEach((path) => {
    if (!path.points.length) return;

    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const first = path.points[0];
    ctx.moveTo(first.x, first.y);

    for (let i = 1; i < path.points.length; i += 1) {
      const p = path.points[i];
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
  });
}

function drawBinderHoles() {
  for (let i = 0; i < 6; i += 1) {
    const y = 170 + i * 110;
    ctx.beginPath();
    ctx.arc(18, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(18, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fill();
  }
}

function redraw() {
  const theme = THEMES[state.theme];
  drawBackground(theme);
  drawHeaderStrip(theme);

  state.stickers.forEach(drawSticker);
  drawInk();
  drawBinderHoles();
}

function canvasPos(event) {
  const rect = canvas.getBoundingClientRect();

  let clientX;
  let clientY;

  if (event.touches && event.touches.length) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;

  return { x, y };
}

function beginInk(event) {
  event.preventDefault();
  ensureAudio();

  state.drawing = true;
  const p = canvasPos(event);

  state.currentPath = {
    color: markerColorInput.value,
    width: randInt(4, 8),
    points: [p]
  };

  state.inkPaths.push(state.currentPath);
  beep(520, 0.05, 0.02, 'triangle');
  redraw();
}

function moveInk(event) {
  if (!state.drawing || !state.currentPath) return;

  event.preventDefault();
  const p = canvasPos(event);
  state.currentPath.points.push(p);
  redraw();
}

function endInk() {
  if (!state.drawing) return;
  state.drawing = false;
  state.currentPath = null;
}

function randomizeCover() {
  ensureAudio();
  state.theme = choose(Object.keys(THEMES));
  themeSelect.value = state.theme;

  seedStickers(randInt(8, 14));
  state.inkPaths = [];

  const labels = [
    'Homework Destroyer',
    'Laser Notes',
    'Mega Cool Stuff',
    'VIP Doodles',
    'After School Ops',
    'Totally Private'
  ];

  state.title = choose(labels);
  titleInput.value = state.title;

  redraw();
  beep(320, 0.07, 0.03);
  setTimeout(() => beep(480, 0.08, 0.03), 70);
}

function addSticker() {
  ensureAudio();
  state.stickers.push(makeSticker());
  redraw();
  beep(640, 0.08, 0.028, 'triangle');
}

function clearInk() {
  ensureAudio();
  state.inkPaths = [];
  redraw();
  beep(220, 0.09, 0.025, 'sawtooth');
}

function exportPng() {
  ensureAudio();
  redraw();

  const link = document.createElement('a');
  const safeTitle = (state.title || 'retro-cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  link.href = canvas.toDataURL('image/png');
  link.download = `${safeTitle || 'retro-cover'}-96.png`;
  link.click();

  beep(780, 0.08, 0.03, 'triangle');
}

themeSelect.addEventListener('change', () => {
  state.theme = themeSelect.value;
  redraw();
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  redraw();
});

randomizeBtn.addEventListener('click', randomizeCover);
stickerBtn.addEventListener('click', addSticker);
clearInkBtn.addEventListener('click', clearInk);
exportBtn.addEventListener('click', exportPng);

canvas.addEventListener('mousedown', beginInk);
canvas.addEventListener('mousemove', moveInk);
window.addEventListener('mouseup', endInk);

canvas.addEventListener('touchstart', beginInk, { passive: false });
canvas.addEventListener('touchmove', moveInk, { passive: false });
window.addEventListener('touchend', endInk);

seedStickers(10);
redraw();
