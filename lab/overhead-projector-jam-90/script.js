const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

const controlsEl = document.getElementById('controls');
const headlineInput = document.getElementById('headline');
const statusEl = document.getElementById('status');
const randomizeBtn = document.getElementById('randomizeBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');

const BASE_LAYERS = [
  { name: 'Sheet A · Bars', color: '#00e7ff', opacity: 0.55, x: -20, y: -10, rot: -5, scale: 1 },
  { name: 'Sheet B · Headline', color: '#ff5bd7', opacity: 0.8, x: 0, y: 10, rot: 2, scale: 1 },
  { name: 'Sheet C · Arrows', color: '#ffe066', opacity: 0.6, x: 24, y: -4, rot: 8, scale: 1 }
];

const state = {
  layers: structuredClone(BASE_LAYERS),
  headline: headlineInput.value.trim() || 'TONIGHT 9PM',
  flashMs: 0,
  lastMs: performance.now()
};

const RANGES = {
  opacity: [0.1, 1, 0.01],
  x: [-180, 180, 1],
  y: [-140, 140, 1],
  rot: [-40, 40, 1],
  scale: [0.6, 1.35, 0.01]
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function toAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function setStatus(text, flash = false) {
  statusEl.textContent = text;
  if (flash) state.flashMs = 220;
}

function createControl(labelText, type, value, min, max, step, onInput) {
  const label = document.createElement('label');
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  if (type === 'range') {
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
  }
  input.value = String(value);
  input.addEventListener('input', () => onInput(input.value));

  return { label, input };
}

function rebuildControls() {
  controlsEl.innerHTML = '';

  state.layers.forEach((layer, idx) => {
    const card = document.createElement('article');
    card.className = 'layer-card';

    const title = document.createElement('h2');
    title.textContent = layer.name;
    title.style.color = layer.color;
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'layer-grid';

    const addControl = (txt, type, value, key) => {
      const spec = RANGES[key];
      const control = createControl(
        txt,
        type,
        value,
        spec ? spec[0] : undefined,
        spec ? spec[1] : undefined,
        spec ? spec[2] : undefined,
        (raw) => {
          layer[key] = type === 'color' ? raw : Number(raw);
          setStatus(`${layer.name} updated.`);
        }
      );
      grid.append(control.label, control.input);
    };

    addControl('Color', 'color', layer.color, 'color');
    addControl('Opacity', 'range', layer.opacity, 'opacity');
    addControl('X Shift', 'range', layer.x, 'x');
    addControl('Y Shift', 'range', layer.y, 'y');
    addControl('Rotation', 'range', layer.rot, 'rot');
    addControl('Scale', 'range', layer.scale, 'scale');

    card.appendChild(grid);
    controlsEl.appendChild(card);
  });
}

function drawProjectorScreen() {
  const w = stage.width;
  const h = stage.height;

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1a1732');
  bg.addColorStop(1, '#090a18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#05060f';
  ctx.fillRect(40, 40, w - 80, h - 80);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 70, w * 0.5, h * 0.5, 430);
  glow.addColorStop(0, 'rgba(255,255,245,0.21)');
  glow.addColorStop(1, 'rgba(255,255,245,0.01)');
  ctx.fillStyle = glow;
  ctx.fillRect(40, 40, w - 80, h - 80);

  ctx.strokeStyle = 'rgba(134,149,232,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, w - 80, h - 80);
}

function drawBarsLayer(layer) {
  ctx.save();
  ctx.translate(stage.width * 0.5 + layer.x, stage.height * 0.5 + layer.y);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const tint = toAlpha(layer.color, layer.opacity);
  for (let i = -8; i <= 8; i += 1) {
    ctx.fillStyle = tint;
    ctx.fillRect(-350 + i * 40, -230, 18, 460);
  }

  ctx.fillStyle = toAlpha(layer.color, layer.opacity * 0.55);
  for (let y = -200; y <= 200; y += 40) {
    ctx.fillRect(-330, y, 660, 14);
  }

  ctx.restore();
}

function drawHeadlineLayer(layer) {
  ctx.save();
  ctx.translate(stage.width * 0.5 + layer.x, stage.height * 0.5 + layer.y);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const line = state.headline || 'TONIGHT 9PM';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 100px "Arial Black", "Impact", sans-serif';
  ctx.fillStyle = toAlpha(layer.color, layer.opacity * 0.95);
  ctx.shadowBlur = 22;
  ctx.shadowColor = toAlpha(layer.color, 0.7);
  ctx.fillText(line, 0, -18);

  ctx.font = '700 34px "Courier New", monospace';
  ctx.fillStyle = toAlpha('#e7ebff', layer.opacity * 0.9);
  ctx.shadowBlur = 0;
  ctx.fillText('OVERHEAD PROJECTOR NIGHT', 0, 72);
  ctx.restore();
}

function drawArrowLayer(layer) {
  ctx.save();
  ctx.translate(stage.width * 0.5 + layer.x, stage.height * 0.5 + layer.y);
  ctx.rotate((layer.rot * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const tint = toAlpha(layer.color, layer.opacity);
  ctx.strokeStyle = tint;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  for (let i = -2; i <= 2; i += 1) {
    const y = i * 72;
    ctx.beginPath();
    ctx.moveTo(-300, y);
    ctx.lineTo(220, y);
    ctx.lineTo(178, y - 24);
    ctx.moveTo(220, y);
    ctx.lineTo(178, y + 24);
    ctx.stroke();
  }

  ctx.fillStyle = toAlpha(layer.color, layer.opacity * 0.75);
  for (let x = -240; x <= 240; x += 120) {
    ctx.beginPath();
    ctx.arc(x, -190, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 50, 190, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawOverlays() {
  for (let y = 44; y < stage.height - 44; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.065)';
    ctx.fillRect(40, y, stage.width - 80, 1);
  }

  ctx.fillStyle = '#cbd4ff';
  ctx.font = '700 20px "Courier New", monospace';
  ctx.fillText('OHP-90 STACK MODE', 58, 72);

  ctx.fillStyle = '#9aa6df';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('TIP: offset each sheet for analog print misregistration.', 58, stage.height - 52);

  if (state.flashMs > 0) {
    const a = Math.min(0.4, state.flashMs / 300);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(40, 40, stage.width - 80, stage.height - 80);
  }
}

function draw() {
  drawProjectorScreen();
  drawBarsLayer(state.layers[0]);
  drawHeadlineLayer(state.layers[1]);
  drawArrowLayer(state.layers[2]);
  drawOverlays();
}

function randomIn(min, max) {
  return min + Math.random() * (max - min);
}

function randomColor() {
  const palette = ['#00e7ff', '#ff5bd7', '#ffe066', '#7dff7d', '#ff7f66', '#a78bff'];
  return palette[Math.floor(Math.random() * palette.length)];
}

function randomize() {
  state.layers.forEach((layer) => {
    layer.color = randomColor();
    layer.opacity = Number(randomIn(0.35, 0.95).toFixed(2));
    layer.x = Math.round(randomIn(-130, 130));
    layer.y = Math.round(randomIn(-95, 95));
    layer.rot = Math.round(randomIn(-25, 25));
    layer.scale = Number(randomIn(0.78, 1.22).toFixed(2));
  });

  const lines = ['TONIGHT 9PM', 'NEON CLASS', 'LIVE MIX', 'PIXEL CLUB', 'AFTER HOURS', 'CITY SIGNAL'];
  state.headline = lines[Math.floor(Math.random() * lines.length)];
  headlineInput.value = state.headline;

  rebuildControls();
  setStatus('Fresh acetate stack generated.', true);
}

function reset() {
  state.layers = structuredClone(BASE_LAYERS);
  state.headline = 'TONIGHT 9PM';
  headlineInput.value = state.headline;
  rebuildControls();
  setStatus('Factory alignment restored.');
}

function exportPNG() {
  const link = document.createElement('a');
  const file = `overhead-projector-jam-${Date.now()}.png`;
  link.download = file;
  link.href = stage.toDataURL('image/png');
  link.click();
  setStatus(`Exported ${file}`, true);
}

headlineInput.addEventListener('input', () => {
  state.headline = headlineInput.value.trim().toUpperCase().slice(0, 22);
  setStatus('Headline layer updated.');
});

randomizeBtn.addEventListener('click', randomize);
resetBtn.addEventListener('click', reset);
exportBtn.addEventListener('click', exportPNG);

function tick(now) {
  const dt = now - state.lastMs;
  state.lastMs = now;
  state.flashMs = clamp(state.flashMs - dt, 0, 9999);
  draw();
  requestAnimationFrame(tick);
}

rebuildControls();
requestAnimationFrame((t) => {
  state.lastMs = t;
  tick(t);
});
