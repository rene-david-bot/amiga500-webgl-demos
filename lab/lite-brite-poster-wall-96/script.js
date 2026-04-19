const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const paletteEl = document.getElementById('palette');
const brushEl = document.getElementById('brush');
const brushValueEl = document.getElementById('brushValue');
const statsEl = document.getElementById('stats');
const modeBtn = document.getElementById('modeBtn');
const surpriseBtn = document.getElementById('surpriseBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const stampBtn = document.getElementById('stampBtn');
const messageEl = document.getElementById('message');

const cols = 40;
const rows = 25;
const spacing = 22;
const boardPad = 48;

const colors = [
  '#ff5a70', '#ff8b3d', '#ffd93d', '#d3ff4f',
  '#59ff8e', '#5af7ff', '#62a0ff', '#a372ff',
  '#ff67df', '#ffffff', '#ff2f4f', '#2fe3ff'
];

const pegs = Array.from({ length: cols * rows }, () => null);
let currentColor = colors[0];
let brush = 1;
let sprayMode = false;
let pointerDown = false;

const boardW = boardPad * 2 + (cols - 1) * spacing;
const boardH = boardPad * 2 + (rows - 1) * spacing;

let audioCtx;

function ping() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = 140 + Math.random() * 240;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.016, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

function iFromRC(r, c) {
  return r * cols + c;
}

function getBoardRect() {
  return {
    x: (canvas.width - boardW) * 0.5,
    y: (canvas.height - boardH) * 0.5,
  };
}

function rcFromPoint(x, y) {
  const { x: x0, y: y0 } = getBoardRect();
  const c = Math.round((x - x0 - boardPad) / spacing);
  const r = Math.round((y - y0 - boardPad) / spacing);
  return { r, c };
}

function inRange(r, c) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

function paint(r, c, doSound = true) {
  if (!inRange(r, c)) return;

  const spread = brush - 1;
  let painted = 0;

  for (let dr = -spread; dr <= spread; dr += 1) {
    for (let dc = -spread; dc <= spread; dc += 1) {
      const rr = r + dr;
      const cc = c + dc;
      if (!inRange(rr, cc)) continue;

      const dist = Math.hypot(dr, dc);
      if (dist > spread + 0.35) continue;

      if (sprayMode && Math.random() > 0.64) continue;

      pegs[iFromRC(rr, cc)] = {
        color: currentColor,
        sparkle: Math.random() * Math.PI * 2,
      };
      painted += 1;
    }
  }

  if (painted && doSound) ping();
  updateStats();
}

function clearBoard() {
  pegs.fill(null);
  updateStats();
}

function surprise() {
  clearBoard();

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const wave = Math.sin((r * 0.8) + (c * 0.45));
      if (wave > 0.45 || Math.random() > 0.94) {
        const color = colors[(r + c + Math.floor(Math.random() * colors.length)) % colors.length];
        pegs[iFromRC(r, c)] = { color, sparkle: Math.random() * Math.PI * 2 };
      }
    }
  }

  updateStats();
}

function stampText(text) {
  if (!text.trim()) return;

  const off = document.createElement('canvas');
  off.width = cols;
  off.height = rows;
  const ox = off.getContext('2d');

  ox.clearRect(0, 0, off.width, off.height);
  ox.fillStyle = '#fff';
  ox.textAlign = 'center';
  ox.textBaseline = 'middle';

  const upper = text.toUpperCase().slice(0, 18);
  const size = Math.max(8, Math.floor((cols * 1.55) / Math.max(upper.length, 5)));
  ox.font = `900 ${size}px monospace`;
  ox.fillText(upper, cols / 2, rows / 2);

  const image = ox.getImageData(0, 0, cols, rows).data;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const idx = (r * cols + c) * 4;
      if (image[idx + 3] > 32) {
        pegs[iFromRC(r, c)] = { color: currentColor, sparkle: Math.random() * Math.PI * 2 };
      }
    }
  }

  ping();
  updateStats();
}

function updateStats() {
  const lit = pegs.reduce((count, peg) => count + (peg ? 1 : 0), 0);
  statsEl.textContent = `${lit} pegs lit`;
}

function draw(t = 0) {
  const time = t * 0.001;

  const bw = boardW;
  const bh = boardH;
  const { x: x0, y: y0 } = getBoardRect();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#121129');
  bg.addColorStop(1, '#07040f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#09070f';
  roundRect(ctx, x0, y0, bw, bh, 28);
  ctx.fill();

  ctx.strokeStyle = '#2f2554';
  ctx.lineWidth = 3;
  roundRect(ctx, x0 + 1.5, y0 + 1.5, bw - 3, bh - 3, 26);
  ctx.stroke();

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const px = x0 + boardPad + c * spacing;
      const py = y0 + boardPad + r * spacing;
      const peg = pegs[iFromRC(r, c)];

      ctx.beginPath();
      ctx.arc(px, py, 4.4, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1630';
      ctx.fill();

      if (!peg) continue;

      const pulse = 0.78 + 0.22 * Math.sin(time * 2.5 + peg.sparkle);
      const glow = ctx.createRadialGradient(px, py, 0, px, py, 15 + brush * 2);
      glow.addColorStop(0, hexToRgba(peg.color, 0.96 * pulse));
      glow.addColorStop(0.58, hexToRgba(peg.color, 0.22 * pulse));
      glow.addColorStop(1, hexToRgba(peg.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 15 + brush * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 5.2, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(peg.color, 0.98);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px - 1.6, py - 1.4, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fill();
    }
  }

  requestAnimationFrame(draw);
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function hexToRgba(hex, alpha) {
  const c = hex.replace('#', '');
  const bigint = parseInt(c, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(alpha, 1))})`;
}

function clientToCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function onPointer(clientX, clientY, doSound = true) {
  const { x, y } = clientToCanvas(clientX, clientY);
  const { r, c } = rcFromPoint(x, y);
  paint(r, c, doSound);
}

function buildPalette() {
  colors.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.style.background = color;
    btn.title = color;
    if (i === 0) btn.classList.add('active');

    btn.addEventListener('click', () => {
      currentColor = color;
      document.querySelectorAll('.swatch').forEach((el) => el.classList.remove('active'));
      btn.classList.add('active');
      ping();
    });

    paletteEl.appendChild(btn);
  });
}

canvas.addEventListener('pointerdown', (event) => {
  pointerDown = true;
  canvas.setPointerCapture(event.pointerId);
  onPointer(event.clientX, event.clientY, true);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerDown) return;
  onPointer(event.clientX, event.clientY, false);
});

canvas.addEventListener('pointerup', () => {
  pointerDown = false;
});

canvas.addEventListener('pointerleave', () => {
  pointerDown = false;
});

brushEl.addEventListener('input', () => {
  brush = Number(brushEl.value);
  brushValueEl.textContent = String(brush);
});

modeBtn.addEventListener('click', () => {
  sprayMode = !sprayMode;
  modeBtn.textContent = `Mode: ${sprayMode ? 'Spray' : 'Dot'}`;
  ping();
});

surpriseBtn.addEventListener('click', surprise);
clearBtn.addEventListener('click', clearBoard);
exportBtn.addEventListener('click', () => {
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = canvas.toDataURL('image/png');
  a.download = `lite-brite-poster-${stamp}.png`;
  a.click();
});

stampBtn.addEventListener('click', () => {
  stampText(messageEl.value);
});

messageEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    stampText(messageEl.value);
  }
});

buildPalette();
surprise();
requestAnimationFrame(draw);
