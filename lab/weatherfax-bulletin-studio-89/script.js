const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');

const citySelect = document.getElementById('citySelect');
const conditionSelect = document.getElementById('conditionSelect');
const tempRange = document.getElementById('tempRange');
const windRange = document.getElementById('windRange');
const paletteSelect = document.getElementById('paletteSelect');
const tickerInput = document.getElementById('tickerInput');

const tempValue = document.getElementById('tempValue');
const windValue = document.getElementById('windValue');

const randomBtn = document.getElementById('randomBtn');
const powerBtn = document.getElementById('powerBtn');
const exportBtn = document.getElementById('exportBtn');

const cities = [
  { name: 'Neo Hamburg', x: 0.31, y: 0.24 },
  { name: 'Arcade Essen', x: 0.23, y: 0.4 },
  { name: 'Pixel Dresden', x: 0.47, y: 0.46 },
  { name: 'Vapor Munich', x: 0.5, y: 0.68 },
  { name: 'Signal Vienna', x: 0.63, y: 0.64 },
  { name: 'Grid Prague', x: 0.57, y: 0.5 }
];

const palettes = {
  teal: {
    skyA: '#072237',
    skyB: '#090d23',
    frame: '#57ecff',
    glow: 'rgba(101,245,255,0.22)',
    map: '#2be3ea',
    accent: '#a6ff8e',
    ticker: '#7af9ff'
  },
  violet: {
    skyA: '#21103d',
    skyB: '#0d0a21',
    frame: '#c58dff',
    glow: 'rgba(197,141,255,0.22)',
    map: '#bb7cff',
    accent: '#ffd18b',
    ticker: '#f2b8ff'
  },
  amber: {
    skyA: '#372004',
    skyB: '#121018',
    frame: '#ffc062',
    glow: 'rgba(255,192,98,0.2)',
    map: '#ffaf5a',
    accent: '#f9ff9f',
    ticker: '#ffe193'
  }
};

const conditionGlyph = {
  SUN: '☀',
  CLOUD: '☁',
  RAIN: '☂',
  STORM: '⚡',
  SNOW: '❄'
};

const state = {
  city: cities[2].name,
  condition: 'SUN',
  temp: 18,
  wind: 22,
  palette: 'teal',
  ticker: tickerInput.value,
  tickerX: canvas.width,
  running: true,
  phase: 0,
  sweep: 0,
  raf: null,
  forecast: [22, 19, 16, 21]
};

for (const city of cities) {
  const option = document.createElement('option');
  option.value = city.name;
  option.textContent = city.name;
  citySelect.append(option);
}
citySelect.value = state.city;

function syncLabels() {
  tempValue.textContent = `${state.temp}°C`;
  windValue.textContent = `${state.wind} km/h`;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomizeForecast(base = state.temp) {
  state.forecast = new Array(4).fill(0).map((_, i) => Math.max(-8, Math.min(39, Math.round(base + (Math.random() * 10 - 5) + i * 0.5))));
}

function drawMap(px) {
  const w = canvas.width;
  const h = canvas.height;
  const x = 80;
  const y = 95;
  const mw = w * 0.52;
  const mh = h * 0.64;

  ctx.save();
  ctx.translate(x, y);

  ctx.strokeStyle = px.map;
  ctx.fillStyle = 'rgba(18, 35, 58, 0.56)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mw * 0.08, mh * 0.1);
  ctx.lineTo(mw * 0.27, mh * 0.02);
  ctx.lineTo(mw * 0.44, mh * 0.08);
  ctx.lineTo(mw * 0.52, mh * 0.21);
  ctx.lineTo(mw * 0.67, mh * 0.26);
  ctx.lineTo(mw * 0.76, mh * 0.44);
  ctx.lineTo(mw * 0.7, mh * 0.65);
  ctx.lineTo(mw * 0.55, mh * 0.83);
  ctx.lineTo(mw * 0.42, mh * 0.88);
  ctx.lineTo(mw * 0.28, mh * 0.82);
  ctx.lineTo(mw * 0.12, mh * 0.7);
  ctx.lineTo(mw * 0.04, mh * 0.54);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const gy = (mh / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(mw, gy);
    ctx.stroke();
  }

  const selected = cities.find((c) => c.name === state.city);

  for (const city of cities) {
    const cx = city.x * mw;
    const cy = city.y * mh;
    const active = city.name === state.city;

    ctx.fillStyle = active ? px.accent : 'rgba(145, 238, 255, 0.68)';
    ctx.beginPath();
    ctx.arc(cx, cy, active ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();

    if (active) {
      const radius = 24 + (Math.sin(state.phase * 2) + 1) * 10;
      ctx.strokeStyle = 'rgba(166,255,142,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = active ? '#ecfff6' : 'rgba(228,242,255,0.84)';
    ctx.font = active ? 'bold 15px Trebuchet MS' : '12px Trebuchet MS';
    ctx.fillText(city.name, cx + 10, cy - 8);
  }

  if (selected) {
    const sx = selected.x * mw;
    const sy = selected.y * mh;
    const angle = state.sweep;
    const sweepRadius = 160;

    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sweepRadius);
    grad.addColorStop(0, 'rgba(122,249,255,0.22)');
    grad.addColorStop(1, 'rgba(122,249,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, sweepRadius, angle - 0.24, angle + 0.24);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function roundedRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRightPanel(px) {
  const x = canvas.width * 0.68;
  const y = 104;
  const w = canvas.width * 0.27;

  ctx.fillStyle = 'rgba(7, 14, 29, 0.7)';
  ctx.strokeStyle = px.frame;
  ctx.lineWidth = 2;
  roundedRectPath(x, y, w, 280, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d7ecff';
  ctx.font = 'bold 18px Trebuchet MS';
  ctx.fillText('NIGHT FORECAST', x + 18, y + 32);

  ctx.fillStyle = px.accent;
  ctx.font = 'bold 72px Trebuchet MS';
  ctx.fillText(conditionGlyph[state.condition], x + 24, y + 118);

  ctx.fillStyle = '#f0fbff';
  ctx.font = 'bold 46px Trebuchet MS';
  ctx.fillText(`${state.temp}°`, x + 105, y + 116);

  ctx.fillStyle = '#b4cbed';
  ctx.font = '16px Trebuchet MS';
  ctx.fillText(state.condition, x + 22, y + 154);
  ctx.fillText(`WIND ${state.wind} KM/H`, x + 22, y + 178);

  ctx.fillStyle = '#cfe4ff';
  ctx.font = 'bold 14px Trebuchet MS';
  ctx.fillText('4-DAY TREND', x + 20, y + 212);

  const barsX = x + 18;
  const barsY = y + 262;
  const maxT = Math.max(...state.forecast, state.temp);
  const minT = Math.min(...state.forecast, state.temp);
  const span = Math.max(1, maxT - minT);

  state.forecast.forEach((val, i) => {
    const normalized = (val - minT) / span;
    const bh = 24 + normalized * 42;
    const bx = barsX + i * 48;
    const by = barsY - bh;

    ctx.fillStyle = i % 2 ? px.map : px.accent;
    ctx.fillRect(bx, by, 26, bh);
    ctx.fillStyle = '#d8ecff';
    ctx.font = '12px Trebuchet MS';
    ctx.fillText(String(val), bx, by - 6);
  });
}

function drawTicker(px) {
  const text = ` ${state.ticker.toUpperCase()} `;
  ctx.fillStyle = 'rgba(7, 11, 21, 0.9)';
  ctx.fillRect(0, canvas.height - 54, canvas.width, 54);

  ctx.strokeStyle = px.frame;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 54);
  ctx.lineTo(canvas.width, canvas.height - 54);
  ctx.stroke();

  ctx.fillStyle = px.ticker;
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillText(text, state.tickerX, canvas.height - 20);

  const textWidth = ctx.measureText(text).width;
  state.tickerX -= 2.1;
  if (state.tickerX < -textWidth - 24) {
    state.tickerX = canvas.width + 20;
  }
}

function drawCrtOverlay(px) {
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y, canvas.width, 1);
  }

  const noise = 10 + Math.sin(state.phase * 18) * 4;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < noise; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 1, 1);
  }

  const vignette = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.24,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.72
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = px.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
}

function drawFrame() {
  const px = palettes[state.palette];
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, px.skyA);
  sky.addColorStop(1, px.skyB);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = px.glow;
  ctx.fillRect(0, 0, canvas.width, 84);

  ctx.fillStyle = '#d8eaff';
  ctx.font = 'bold 26px Trebuchet MS';
  ctx.fillText('WEATHERFAX 89', 28, 44);

  ctx.font = '15px "Courier New", monospace';
  ctx.fillStyle = px.accent;
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10)}  ${now.toISOString().slice(11, 19)} UTC`;
  ctx.fillText(stamp, 28, 68);

  drawMap(px);
  drawRightPanel(px);
  drawTicker(px);
  drawCrtOverlay(px);
}

function animate() {
  if (state.running) {
    state.phase += 0.016;
    state.sweep += 0.025;
    drawFrame();
  }
  state.raf = requestAnimationFrame(animate);
}

function applyFromControls() {
  state.city = citySelect.value;
  state.condition = conditionSelect.value;
  state.temp = Number(tempRange.value);
  state.wind = Number(windRange.value);
  state.palette = paletteSelect.value;
  state.ticker = tickerInput.value.trim() || 'NO BULLETIN MESSAGE';
  syncLabels();
}

citySelect.addEventListener('change', applyFromControls);
conditionSelect.addEventListener('change', applyFromControls);
tempRange.addEventListener('input', applyFromControls);
windRange.addEventListener('input', applyFromControls);
paletteSelect.addEventListener('change', applyFromControls);
tickerInput.addEventListener('input', applyFromControls);

randomBtn.addEventListener('click', () => {
  citySelect.value = pick(cities).name;
  conditionSelect.value = pick(Object.keys(conditionGlyph));
  tempRange.value = Math.floor(Math.random() * 44) - 5;
  windRange.value = Math.floor(Math.random() * 75) + 8;
  paletteSelect.value = pick(Object.keys(palettes));

  const tickerPool = [
    'late bulletin: thunder cells moving east, keep radios charged',
    'harbor fog advisory until 03:00, low visibility near ramps',
    'light snow bands expected after midnight across hill districts',
    'warm front incoming, sudden pressure drop around 21:30'
  ];
  tickerInput.value = pick(tickerPool);

  applyFromControls();
  randomizeForecast(state.temp);
});

powerBtn.addEventListener('click', () => {
  state.running = !state.running;
  powerBtn.textContent = state.running ? 'Broadcast: ON' : 'Broadcast: OFF';
  if (!state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8ca7d4';
    ctx.font = 'bold 36px Trebuchet MS';
    ctx.fillText('SIGNAL LOST', canvas.width * 0.37, canvas.height * 0.5);
  }
});

exportBtn.addEventListener('click', () => {
  drawFrame();
  const link = document.createElement('a');
  link.download = `weatherfax-bulletin-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

applyFromControls();
randomizeForecast();
animate();
