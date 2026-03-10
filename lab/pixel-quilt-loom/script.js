const SIZE = 16;
const CELL = 20;

const COLORS = [
  '#0f1222',
  '#203a78',
  '#2f7ec7',
  '#53d2db',
  '#ffe98e',
  '#ff9a6a',
  '#f35d8e',
  '#f3f6ff'
];

const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

const el = {
  editor: document.getElementById('editor'),
  preview: document.getElementById('preview'),
  symmetry: document.getElementById('symmetry'),
  palette: document.getElementById('palette'),
  randomize: document.getElementById('randomize'),
  clear: document.getElementById('clear'),
  invert: document.getElementById('invert'),
  export: document.getElementById('export'),
  filled: document.getElementById('filled'),
  colors: document.getElementById('colors'),
  score: document.getElementById('score'),
  status: document.getElementById('status'),
  audioToggle: document.getElementById('audioToggle')
};

const ctx = el.editor.getContext('2d');
const pctx = el.preview.getContext('2d');

const state = {
  color: 3,
  painting: false,
  erasing: false,
  audioOn: false,
  audioCtx: null,
  shimmer: 0
};

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem('pixel-quilt-loom-grid') || 'null');
    if (saved?.length === SIZE) {
      for (let y = 0; y < SIZE; y += 1) {
        if (!Array.isArray(saved[y]) || saved[y].length !== SIZE) return;
        for (let x = 0; x < SIZE; x += 1) {
          grid[y][x] = Number(saved[y][x]) || 0;
        }
      }
    }
  } catch {
    // ignore broken storage
  }
}

function saveGrid() {
  localStorage.setItem('pixel-quilt-loom-grid', JSON.stringify(grid));
}

function initAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 440, ms = 40, gain = 0.01) {
  if (!state.audioOn) return;
  try {
    initAudio();
    const osc = state.audioCtx.createOscillator();
    const amp = state.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, state.audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, state.audioCtx.currentTime + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + ms / 1000);
    osc.connect(amp).connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + ms / 1000 + 0.01);
  } catch {
    // optional audio
  }
}

function getTargets(x, y) {
  const mode = el.symmetry.value;
  const points = [[x, y]];

  if (mode === 'mirror-x' || mode === 'quad') {
    points.push([SIZE - 1 - x, y]);
  }
  if (mode === 'mirror-y' || mode === 'quad') {
    points.push([x, SIZE - 1 - y]);
  }
  if (mode === 'quad') {
    points.push([SIZE - 1 - x, SIZE - 1 - y]);
  }

  const seen = new Set();
  return points.filter(([px, py]) => {
    const key = `${px},${py}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function paintAt(x, y, erase = false) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const targets = getTargets(x, y);
  const value = erase ? 0 : state.color;

  targets.forEach(([tx, ty]) => {
    grid[ty][tx] = value;
  });

  beep(erase ? 180 : 250 + state.color * 60, 35, 0.009);
  saveGrid();
  drawEditor();
  drawPreview();
  updateStats();
}

function drawEditor() {
  ctx.clearRect(0, 0, el.editor.width, el.editor.height);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      ctx.fillStyle = COLORS[grid[y][x]];
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  ctx.strokeStyle = 'rgba(186, 213, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= SIZE; i += 1) {
    const p = i * CELL + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, SIZE * CELL);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(SIZE * CELL, p);
    ctx.stroke();
  }
}

function drawPreview() {
  const w = el.preview.width;
  const h = el.preview.height;
  const tile = 24;
  const step = tile;

  pctx.fillStyle = '#071021';
  pctx.fillRect(0, 0, w, h);

  for (let ty = 0; ty < h / step + 1; ty += 1) {
    for (let tx = 0; tx < w / step + 1; tx += 1) {
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          const px = tx * step + x * (tile / SIZE);
          const py = ty * step + y * (tile / SIZE);
          const idx = grid[y][x];
          pctx.fillStyle = COLORS[idx];
          pctx.fillRect(px, py, tile / SIZE + 0.4, tile / SIZE + 0.4);
        }
      }
    }
  }

  // subtle weave shimmer overlay
  state.shimmer += 0.04;
  for (let row = 0; row < h; row += 6) {
    const alpha = 0.05 + 0.03 * Math.sin(state.shimmer + row * 0.09);
    pctx.fillStyle = `rgba(190, 225, 255, ${Math.max(0, alpha)})`;
    pctx.fillRect(0, row, w, 1);
  }
}

function updateStats() {
  let filled = 0;
  const set = new Set([0]);

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const v = grid[y][x];
      if (v !== 0) filled += 1;
      set.add(v);
    }
  }

  const unique = set.size;
  const symmetryBonus = el.symmetry.value === 'quad' ? 60 : el.symmetry.value === 'none' ? 0 : 25;
  const score = Math.round(filled * 3 + unique * 18 + symmetryBonus);

  el.filled.textContent = filled;
  el.colors.textContent = unique;
  el.score.textContent = score;
}

function pointerToCell(event) {
  const rect = el.editor.getBoundingClientRect();
  const scaleX = el.editor.width / rect.width;
  const scaleY = el.editor.height / rect.height;
  const x = Math.floor((event.clientX - rect.left) * scaleX / CELL);
  const y = Math.floor((event.clientY - rect.top) * scaleY / CELL);
  return { x, y };
}

function handlePaint(event) {
  const { x, y } = pointerToCell(event);
  paintAt(x, y, state.erasing || event.shiftKey);
}

function clearGrid() {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      grid[y][x] = 0;
    }
  }
  saveGrid();
  drawEditor();
  drawPreview();
  updateStats();
  el.status.textContent = 'Cleared. Fresh fabric loaded.';
  beep(180, 70, 0.012);
}

function randomizeGrid() {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (Math.random() < 0.45) {
        grid[y][x] = 1 + Math.floor(Math.random() * (COLORS.length - 1));
      } else {
        grid[y][x] = 0;
      }
    }
  }
  saveGrid();
  drawEditor();
  drawPreview();
  updateStats();
  el.status.textContent = 'Random pattern woven. Tweak from here.';
  beep(520, 65, 0.012);
}

function invertGrid() {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const v = grid[y][x];
      grid[y][x] = v === 0 ? state.color : 0;
    }
  }
  saveGrid();
  drawEditor();
  drawPreview();
  updateStats();
  el.status.textContent = 'Inverted weave.';
  beep(680, 60, 0.014);
}

function exportPNG() {
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = el.preview.toDataURL('image/png');
  link.download = `pixel-quilt-${stamp}.png`;
  link.click();
  el.status.textContent = 'PNG exported to your downloads.';
  beep(900, 80, 0.015);
}

function makePalette() {
  COLORS.forEach((color, idx) => {
    const button = document.createElement('button');
    button.className = 'swatch';
    button.style.background = color;
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', `Color ${idx + 1}`);
    button.addEventListener('click', () => {
      state.color = idx;
      document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
      button.classList.add('active');
      el.status.textContent = `Ink switched to color #${idx + 1}.`;
      beep(280 + idx * 50, 28, 0.007);
    });
    if (idx === state.color) button.classList.add('active');
    el.palette.appendChild(button);
  });
}

function bindEvents() {
  el.editor.addEventListener('pointerdown', (event) => {
    state.painting = true;
    state.erasing = event.button === 2 || event.shiftKey;
    handlePaint(event);
  });

  el.editor.addEventListener('pointermove', (event) => {
    if (!state.painting) return;
    handlePaint(event);
  });

  ['pointerup', 'pointerleave', 'pointercancel'].forEach((name) => {
    el.editor.addEventListener(name, () => {
      state.painting = false;
      state.erasing = false;
    });
  });

  el.editor.addEventListener('contextmenu', (event) => event.preventDefault());

  el.symmetry.addEventListener('change', () => {
    el.status.textContent = `Symmetry set to ${el.symmetry.selectedOptions[0].textContent}.`;
    updateStats();
    beep(460, 45, 0.009);
  });

  el.randomize.addEventListener('click', randomizeGrid);
  el.clear.addEventListener('click', clearGrid);
  el.invert.addEventListener('click', invertGrid);
  el.export.addEventListener('click', exportPNG);

  el.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    el.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) {
      beep(660, 80, 0.01);
      setTimeout(() => beep(880, 80, 0.01), 70);
    }
  });
}

function animate() {
  drawPreview();
  requestAnimationFrame(animate);
}

function init() {
  loadSaved();
  makePalette();
  bindEvents();
  drawEditor();
  drawPreview();
  updateStats();
  animate();
}

init();
