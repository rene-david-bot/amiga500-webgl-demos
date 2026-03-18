const COLS = 60;
const ROWS = 28;

const themeMap = {
  amber: { bg: '#120d05', fg: '#ffcf70', accent: '#ff9f1c', dim: '#6f4f20' },
  cyan: { bg: '#041016', fg: '#8ff2ff', accent: '#4dcfff', dim: '#1c5f73' },
  magenta: { bg: '#130714', fg: '#ff9bf8', accent: '#ff5fe7', dim: '#6a2a66' },
  mono: { bg: '#0b0d0b', fg: '#d9dfd9', accent: '#9fb19f', dim: '#4b584b' }
};

const frameMap = {
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' }
};

const titlePool = [
  'NEON NETRUN',
  'PIXEL PARADE',
  'BYTE BAZAAR',
  'MIDNIGHT MODEM',
  'LASER SWAPMEET',
  'PHOSPHOR JAM'
];

const subtitlePool = [
  'FRIDAY 23:00 // NODE 88',
  'LIVE CHAT + ANSI BATTLES',
  'SYSOP SPECIAL EVENT',
  'JOIN THE AFTERHOURS CREW',
  'MODEM SPEED: 2400 BAUD',
  'BRING YOUR BEST HANDLE'
];

const el = {
  headline: document.getElementById('headline'),
  subline: document.getElementById('subline'),
  theme: document.getElementById('theme'),
  pattern: document.getElementById('pattern'),
  frame: document.getElementById('frame'),
  screen: document.getElementById('ansiScreen'),
  canvas: document.getElementById('posterCanvas'),
  status: document.getElementById('status'),
  randomBtn: document.getElementById('randomBtn'),
  copyBtn: document.getElementById('copyBtn'),
  pngBtn: document.getElementById('pngBtn')
};

const ctx = el.canvas.getContext('2d');
let currentText = '';

function seedFrom(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function noise(x, y, seed) {
  const n = Math.sin((x * 12.9898 + y * 78.233 + seed * 0.001) * 43758.5453);
  return n - Math.floor(n);
}

function centerText(line, width) {
  const trimmed = line.trim().slice(0, width);
  const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
  return ' '.repeat(pad) + trimmed + ' '.repeat(Math.max(0, width - trimmed.length - pad));
}

function makePattern(pattern, seed) {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (pattern === 'scan') {
        grid[y][x] = y % 2 === 0 ? '░' : ' ';
      } else if (pattern === 'chevron') {
        grid[y][x] = (x + y) % 8 < 4 ? '/' : '\\';
      } else if (pattern === 'circuit') {
        const n = noise(x, y, seed);
        grid[y][x] = n > 0.94 ? '*' : n > 0.9 ? '+' : n > 0.82 ? '·' : ' ';
      } else {
        const n = noise(x, y, seed);
        grid[y][x] = n > 0.972 ? '✦' : n > 0.958 ? '✶' : n > 0.945 ? '·' : ' ';
      }
    }
  }

  return grid;
}

function drawFrame(grid, frameChars) {
  const x0 = 6;
  const y0 = 7;
  const w = COLS - 12;
  const h = 12;

  grid[y0][x0] = frameChars.tl;
  grid[y0][x0 + w - 1] = frameChars.tr;
  grid[y0 + h - 1][x0] = frameChars.bl;
  grid[y0 + h - 1][x0 + w - 1] = frameChars.br;

  for (let x = x0 + 1; x < x0 + w - 1; x += 1) {
    grid[y0][x] = frameChars.h;
    grid[y0 + h - 1][x] = frameChars.h;
  }

  for (let y = y0 + 1; y < y0 + h - 1; y += 1) {
    grid[y][x0] = frameChars.v;
    grid[y][x0 + w - 1] = frameChars.v;
  }

  return { x0, y0, w, h };
}

function injectText(grid, box) {
  const headline = centerText(el.headline.value || 'UNTITLED BROADCAST', box.w - 4);
  const subline = centerText(el.subline.value || 'NODE STATUS: OPEN', box.w - 4);
  const divider = centerText(':: LIVE ANSI POSTER ::', box.w - 4);

  const startX = box.x0 + 2;
  [divider, headline, subline].forEach((line, i) => {
    const y = box.y0 + 3 + i * 3;
    for (let x = 0; x < line.length; x += 1) {
      grid[y][startX + x] = line[x];
    }
  });

  const footer = centerText('BBS POSTER FORGE // CTRL+S TO SAVE YOUR LEGEND', COLS - 2);
  for (let x = 0; x < footer.length; x += 1) {
    grid[ROWS - 2][1 + x] = footer[x];
  }
}

function renderCanvas(lines, theme) {
  const W = el.canvas.width;
  const H = el.canvas.height;
  const cellW = W / COLS;
  const cellH = H / ROWS;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = theme.dim;
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }

  ctx.font = `${Math.floor(cellH * 0.78)}px "Courier New", monospace`;
  ctx.textBaseline = 'top';

  for (let y = 0; y < lines.length; y += 1) {
    for (let x = 0; x < lines[y].length; x += 1) {
      const ch = lines[y][x];
      if (ch === ' ') continue;
      const glow = ch === '✦' || ch === '✶' || ch === '*' || ch === '+';
      ctx.fillStyle = glow ? theme.accent : theme.fg;
      ctx.fillText(ch, x * cellW, y * cellH + 2);
    }
  }

  ctx.globalCompositeOperation = 'screen';
  const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.12, W / 2, H / 2, W * 0.75);
  vignette.addColorStop(0, 'rgba(255,255,255,0.06)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

function render() {
  const theme = themeMap[el.theme.value] || themeMap.amber;
  const frame = frameMap[el.frame.value] || frameMap.double;
  const seed = seedFrom(`${el.headline.value}|${el.subline.value}|${el.pattern.value}`);

  const grid = makePattern(el.pattern.value, seed);
  const box = drawFrame(grid, frame);
  injectText(grid, box);

  const lines = grid.map((row) => row.join(''));
  currentText = lines.join('\n');
  el.screen.textContent = currentText;
  el.screen.style.setProperty('--accent', theme.fg);
  el.screen.style.color = theme.fg;

  renderCanvas(lines, theme);
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomizePoster() {
  el.headline.value = randomOf(titlePool);
  el.subline.value = randomOf(subtitlePool);
  el.theme.value = randomOf(Object.keys(themeMap));
  el.pattern.value = randomOf(['scan', 'chevron', 'circuit', 'stars']);
  el.frame.value = randomOf(Object.keys(frameMap));
  render();
  el.status.textContent = 'Randomized a fresh poster.';
}

async function copyAnsi() {
  try {
    await navigator.clipboard.writeText(currentText);
    el.status.textContent = 'ANSI text copied to clipboard.';
  } catch {
    el.status.textContent = 'Clipboard blocked — copy manually from the left panel.';
  }
}

function downloadPng() {
  const a = document.createElement('a');
  a.href = el.canvas.toDataURL('image/png');
  a.download = `bbs-poster-${Date.now()}.png`;
  a.click();
  el.status.textContent = 'PNG downloaded.';
}

['input', 'change'].forEach((eventName) => {
  [el.headline, el.subline, el.theme, el.pattern, el.frame].forEach((control) => {
    control.addEventListener(eventName, render);
  });
});

el.randomBtn.addEventListener('click', randomizePoster);
el.copyBtn.addEventListener('click', copyAnsi);
el.pngBtn.addEventListener('click', downloadPng);

window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    downloadPng();
  }
});

render();
