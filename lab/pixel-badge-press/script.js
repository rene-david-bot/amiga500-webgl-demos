const canvas = document.getElementById('badgeCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const ui = {
  headline: document.getElementById('headline'),
  subline: document.getElementById('subline'),
  shape: document.getElementById('shape'),
  palette: document.getElementById('palette'),
  dither: document.getElementById('dither'),
  randomize: document.getElementById('randomize'),
  download: document.getElementById('download'),
  audioToggle: document.getElementById('audioToggle')
};

const palettes = [
  { name: 'Synthwave', colors: ['#120d26', '#2f2aa0', '#ff4bc2', '#fff5b7'] },
  { name: 'Ocean Chip', colors: ['#091427', '#004f8c', '#00adc7', '#c5f6ff'] },
  { name: 'Amber CRT', colors: ['#150f08', '#603316', '#cf7e1a', '#ffe08a'] },
  { name: 'Mono Mint', colors: ['#04100f', '#0f4a3a', '#2ec987', '#d9ffe9'] },
  { name: 'Night Arcade', colors: ['#090812', '#4a2abf', '#28ccff', '#fef28f'] }
];

const icons = ['★', '◎', '✦', '◉', '⬢', '⬡'];

const state = {
  paletteIndex: 0,
  audioOn: false,
  audioCtx: null,
  ticker: 0
};

for (const [i, p] of palettes.entries()) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = p.name;
  ui.palette.appendChild(option);
}

function beep(freq = 520, duration = 0.06, type = 'square', volume = 0.012) {
  if (!state.audioOn) return;
  try {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(state.audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch {
    // optional audio
  }
}

function drawPixelText(text, x, y, size, color, align = 'center') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.font = `700 ${size}px "Courier New", monospace`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function shapePath(shape, cx, cy, size) {
  ctx.beginPath();
  if (shape === 'disk') {
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
    return;
  }

  if (shape === 'ticket') {
    const r = size * 0.1;
    const w = size * 0.95;
    const h = size * 0.72;
    const left = cx - w / 2;
    const top = cy - h / 2;
    const right = cx + w / 2;
    const bottom = cy + h / 2;

    ctx.moveTo(left + r, top);
    ctx.lineTo(right - r, top);
    ctx.quadraticCurveTo(right, top, right, top + r);
    ctx.lineTo(right, bottom - r);
    ctx.quadraticCurveTo(right, bottom, right - r, bottom);

    ctx.arc(cx + w / 2, cy, r, Math.PI / 2, -Math.PI / 2, true);

    ctx.lineTo(left + r, top);
    ctx.arc(cx - w / 2, cy, r, -Math.PI / 2, Math.PI / 2, true);
    return;
  }

  const top = cy - size * 0.5;
  const midX = cx;
  const left = cx - size * 0.36;
  const right = cx + size * 0.36;
  const bottom = cy + size * 0.46;

  ctx.moveTo(midX, top);
  ctx.lineTo(right, cy - size * 0.1);
  ctx.lineTo(right * 0.92 + cx * 0.08, bottom);
  ctx.lineTo(midX, cy + size * 0.36);
  ctx.lineTo(left * 0.92 + cx * 0.08, bottom);
  ctx.lineTo(left, cy - size * 0.1);
  ctx.closePath();
}

function drawDither(width, height, strength, colorA, colorB) {
  const intensity = strength / 100;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const threshold = ((x ^ y) & 8) ? 0.58 : 0.42;
      if (Math.random() < intensity * threshold) {
        ctx.fillStyle = Math.random() > 0.5 ? colorA : colorB;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
}

function drawBadge() {
  const pal = palettes[state.paletteIndex];
  const [bg, low, mid, hi] = pal.colors;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#02040a';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, low);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawDither(w, h, Number(ui.dither.value), low, bg);

  const pulse = (Math.sin(state.ticker * 0.002) + 1) * 0.5;
  const centerX = w / 2;
  const centerY = h / 2;
  const size = 220;

  shapePath(ui.shape.value, centerX, centerY, size);
  ctx.fillStyle = mid;
  ctx.fill();

  shapePath(ui.shape.value, centerX, centerY, size - 20);
  ctx.fillStyle = bg;
  ctx.fill();

  shapePath(ui.shape.value, centerX, centerY, size - 34);
  ctx.fillStyle = `rgba(255,255,255,${0.08 + pulse * 0.15})`;
  ctx.fill();

  ctx.strokeStyle = hi;
  ctx.lineWidth = 4;
  shapePath(ui.shape.value, centerX, centerY, size - 20);
  ctx.stroke();

  ctx.fillStyle = hi;
  for (let i = 0; i < 12; i += 1) {
    const a = (Math.PI * 2 * i) / 12 + state.ticker * 0.001;
    const px = centerX + Math.cos(a) * 112;
    const py = centerY + Math.sin(a) * 112;
    ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
  }

  const icon = icons[Math.floor((state.ticker / 400) % icons.length)];
  drawPixelText(icon, centerX, 120, 30, hi);

  const headline = ui.headline.value.trim().toUpperCase() || 'BYTE JAM';
  const subline = ui.subline.value.trim().toUpperCase() || 'DRESDEN 86';

  drawPixelText(headline.slice(0, 14), centerX, 176, 24, hi);
  drawPixelText(subline.slice(0, 18), centerX, 208, 16, hi);

  ctx.fillStyle = hi;
  ctx.fillRect(86, 236, 148, 4);
  drawPixelText('ADMIT ONE', centerX, 259, 14, hi);

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 30; x < 290; x += 8) {
    ctx.fillRect(x, 34 + ((x / 8) % 2 ? 0 : 2), 4, 2);
  }
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomizeBadge() {
  const wordsA = ['BYTE', 'PIXEL', 'MEGA', 'NOVA', 'GLITCH', 'COSMO', 'PHOSPHOR', 'TURBO'];
  const wordsB = ['JAM', 'FEST', 'CREW', 'NIGHT', 'FORCE', 'CLUB', 'ZONE', 'WAVE'];
  const places = ['DRESDEN', 'HAMBURG', 'KIEL', 'PARIS', 'TOKYO', 'OSAKA', 'MILANO', 'BREMEN'];

  ui.headline.value = `${randomFrom(wordsA)} ${randomFrom(wordsB)}`.slice(0, 14);
  ui.subline.value = `${randomFrom(places)} '${80 + Math.floor(Math.random() * 10)}`;
  ui.shape.value = randomFrom(['shield', 'ticket', 'disk']);
  state.paletteIndex = Math.floor(Math.random() * palettes.length);
  ui.palette.value = String(state.paletteIndex);
  ui.dither.value = String(8 + Math.floor(Math.random() * 72));

  beep(660, 0.06, 'triangle');
  setTimeout(() => beep(900, 0.07, 'square', 0.009), 70);
}

function exportPng() {
  const link = document.createElement('a');
  const safe = (ui.headline.value || 'pixel-badge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.download = `${safe || 'pixel-badge'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  beep(1080, 0.08, 'square');
}

function bind() {
  ui.palette.addEventListener('change', () => {
    state.paletteIndex = Number(ui.palette.value);
    beep(530, 0.05, 'triangle');
  });

  ui.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    ui.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) {
      beep(420, 0.05, 'triangle');
      setTimeout(() => beep(620, 0.05, 'square'), 65);
    }
  });

  [ui.headline, ui.subline, ui.shape, ui.dither].forEach((el) => {
    el.addEventListener('input', () => beep(430, 0.035, 'square', 0.006));
    el.addEventListener('change', () => beep(460, 0.045, 'triangle', 0.006));
  });

  ui.randomize.addEventListener('click', randomizeBadge);
  ui.download.addEventListener('click', exportPng);
}

function frame(ts) {
  state.ticker = ts;
  drawBadge();
  requestAnimationFrame(frame);
}

function init() {
  ui.palette.value = String(state.paletteIndex);
  bind();
  requestAnimationFrame(frame);
}

init();
