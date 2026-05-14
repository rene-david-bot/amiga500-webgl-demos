const canvas = document.getElementById('bannerCanvas');
const ctx = canvas.getContext('2d');

const textInput = document.getElementById('textInput');
const styleSelect = document.getElementById('styleSelect');
const bgSelect = document.getElementById('bgSelect');
const glowSlider = document.getElementById('glowSlider');
const sparkleSlider = document.getElementById('sparkleSlider');
const speedSlider = document.getElementById('speedSlider');

const glowValue = document.getElementById('glowValue');
const sparkleValue = document.getElementById('sparkleValue');
const speedValue = document.getElementById('speedValue');

const randomBtn = document.getElementById('randomBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

const slogans = [
  'WELCOME TO MY PAGE',
  'UNDER CONSTRUCTION',
  'BEST VIEWED IN 800x600',
  'SURF THE WEB RING',
  'SIGN MY GUESTBOOK',
  'POWERED BY PIXELS',
  'RETRO RULES FOREVER',
  'NEON NOSTALGIA ZONE',
  'YOU HAVE MAIL',
  'BEEP BOOP PARADISE'
];

const presets = {
  cyber: {
    font: '900 98px Impact, Arial Black, sans-serif',
    colors: ['#58f6ff', '#88ffdc', '#f4f8ff'],
    stroke: '#001f3d',
    glow: '#58f6ff'
  },
  bubble: {
    font: '900 92px "Trebuchet MS", "Comic Sans MS", sans-serif',
    colors: ['#ff69e6', '#ffc4f8', '#fff6ff'],
    stroke: '#4c0f53',
    glow: '#ff69e6'
  },
  chrome: {
    font: '900 94px "Arial Black", Impact, sans-serif',
    colors: ['#f4f8ff', '#dbe4f5', '#95b0da'],
    stroke: '#25324c',
    glow: '#7ec7ff'
  },
  arcade: {
    font: '900 96px "Verdana", "Arial Black", sans-serif',
    colors: ['#ffdd6e', '#ff9a3c', '#ff4d6d'],
    stroke: '#4f1b16',
    glow: '#ffd05d'
  }
};

const state = {
  text: textInput.value.trim(),
  style: styleSelect.value,
  bg: bgSelect.value,
  glow: Number(glowSlider.value),
  sparkle: Number(sparkleSlider.value),
  speed: Number(speedSlider.value),
  time: 0,
  sparkles: []
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function createSparkle() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: 1 + Math.random() * 3,
    pulse: Math.random() * Math.PI * 2,
    twinkle: 0.5 + Math.random() * 2.2,
    driftX: (Math.random() * 2 - 1) * 0.14,
    driftY: (Math.random() * 2 - 1) * 0.08
  };
}

function resetSparkles() {
  const count = Math.round(80 + (state.sparkle / 100) * 150);
  state.sparkles = Array.from({ length: count }, createSparkle);
}

function updateReadout() {
  glowValue.textContent = `${state.glow}%`;
  sparkleValue.textContent = `${state.sparkle}%`;
  speedValue.textContent = `${state.speed}%`;
}

function randomSlogan() {
  const pick = slogans[Math.floor(Math.random() * slogans.length)];
  state.text = pick;
  textInput.value = pick;
  setStatus('Dropped a random web-era slogan into the banner.');
}

function shuffleStyle() {
  const styles = Object.keys(presets);
  const bgs = ['nebula', 'sunset', 'matrix', 'club'];

  state.style = styles[Math.floor(Math.random() * styles.length)];
  state.bg = bgs[Math.floor(Math.random() * bgs.length)];
  state.glow = 24 + Math.floor(Math.random() * 68);
  state.sparkle = 30 + Math.floor(Math.random() * 66);
  state.speed = 28 + Math.floor(Math.random() * 68);

  styleSelect.value = state.style;
  bgSelect.value = state.bg;
  glowSlider.value = String(state.glow);
  sparkleSlider.value = String(state.sparkle);
  speedSlider.value = String(state.speed);

  resetSparkles();
  updateReadout();
  setStatus('Style and backdrop shuffled. This one screams 1998.');
}

function setStatus(message) {
  statusEl.textContent = message;
}

function drawBackdrop() {
  switch (state.bg) {
    case 'sunset': {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, '#2a1142');
      g.addColorStop(0.52, '#b73877');
      g.addColorStop(1, '#281022');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
    case 'matrix': {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, '#061613');
      g.addColorStop(1, '#040a09');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(89, 255, 198, 0.18)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      break;
    }
    case 'club': {
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, '#100c29');
      g.addColorStop(0.5, '#260f58');
      g.addColorStop(1, '#0a1630');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 0.22;
      for (let i = 0; i < 5; i += 1) {
        const y = (i * 55 + state.time * (0.4 + i * 0.08)) % canvas.height;
        const line = ctx.createLinearGradient(0, 0, canvas.width, 0);
        line.addColorStop(0, 'rgba(255, 99, 201, 0)');
        line.addColorStop(0.5, 'rgba(255, 99, 201, 1)');
        line.addColorStop(1, 'rgba(255, 99, 201, 0)');
        ctx.fillStyle = line;
        ctx.fillRect(0, y, canvas.width, 5);
      }
      ctx.globalAlpha = 1;
      break;
    }
    default: {
      const g = ctx.createRadialGradient(canvas.width * 0.3, canvas.height * 0.2, 20, canvas.width * 0.5, canvas.height * 0.65, canvas.width * 0.9);
      g.addColorStop(0, '#321f74');
      g.addColorStop(0.45, '#1b1c49');
      g.addColorStop(1, '#080b1b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      break;
    }
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function drawSparkles(delta) {
  const speedBoost = 0.55 + state.speed / 100;
  const alphaBase = 0.2 + state.sparkle / 160;

  for (const star of state.sparkles) {
    star.x += star.driftX * speedBoost * delta * 0.08;
    star.y += star.driftY * speedBoost * delta * 0.08;
    star.pulse += star.twinkle * delta * 0.0023;

    if (star.x < -8) star.x = canvas.width + 8;
    if (star.x > canvas.width + 8) star.x = -8;
    if (star.y < -8) star.y = canvas.height + 8;
    if (star.y > canvas.height + 8) star.y = -8;

    const blink = 0.45 + Math.sin(star.pulse + state.time * 0.0025) * 0.55;
    const alpha = clamp(blink * alphaBase, 0.05, 0.95);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(star.x - star.size * 2, star.y);
    ctx.lineTo(star.x + star.size * 2, star.y);
    ctx.moveTo(star.x, star.y - star.size * 2);
    ctx.lineTo(star.x, star.y + star.size * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawText() {
  const style = presets[state.style] || presets.cyber;
  const text = (state.text || '').trim() || 'WELCOME TO MY PAGE';

  const shimmer = (Math.sin(state.time * (0.002 + state.speed * 0.00002)) + 1) * 0.5;
  const glowBoost = 0.6 + (state.glow / 100) * 1.4;
  const floatY = Math.sin(state.time * 0.0016) * 3;

  const gradient = ctx.createLinearGradient(0, canvas.height * 0.18, 0, canvas.height * 0.82);
  gradient.addColorStop(0, style.colors[0]);
  gradient.addColorStop(0.5, style.colors[1]);
  gradient.addColorStop(1, style.colors[2]);

  ctx.save();
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const x = canvas.width / 2;
  const y = canvas.height / 2 + floatY;

  ctx.shadowColor = style.glow;
  ctx.shadowBlur = 14 + state.glow * 0.5 + shimmer * 18;
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);

  ctx.shadowBlur = 0;
  ctx.lineWidth = 8;
  ctx.strokeStyle = style.stroke;
  ctx.strokeText(text, x, y);

  ctx.globalAlpha = 0.35 + shimmer * 0.25;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeText(text, x, y - 2);

  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.fillStyle = `rgba(255,255,255,${0.04 + glowBoost * 0.02})`;
  ctx.fillRect(0, canvas.height * 0.72, canvas.width, 3);
}

let lastTs = performance.now();
function animate(ts) {
  const delta = Math.min(33, ts - lastTs || 16.6);
  lastTs = ts;
  state.time = ts;

  drawBackdrop();
  drawSparkles(delta);
  drawText();

  requestAnimationFrame(animate);
}

function savePng() {
  const safeName = (state.text || 'geocities-banner')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'geocities-banner';

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${safeName}.png`;
  link.click();
  setStatus('PNG exported. Ready for your glorious homepage.');
}

function syncStateFromInputs() {
  state.text = textInput.value.toUpperCase();
  textInput.value = state.text;
  state.style = styleSelect.value;
  state.bg = bgSelect.value;
  state.glow = Number(glowSlider.value);
  state.sparkle = Number(sparkleSlider.value);
  state.speed = Number(speedSlider.value);
  updateReadout();
}

textInput.addEventListener('input', () => {
  syncStateFromInputs();
});

styleSelect.addEventListener('change', syncStateFromInputs);
bgSelect.addEventListener('change', syncStateFromInputs);

glowSlider.addEventListener('input', syncStateFromInputs);
speedSlider.addEventListener('input', syncStateFromInputs);

sparkleSlider.addEventListener('input', () => {
  syncStateFromInputs();
  resetSparkles();
});

randomBtn.addEventListener('click', () => {
  randomSlogan();
  syncStateFromInputs();
});

shuffleBtn.addEventListener('click', () => {
  shuffleStyle();
});

saveBtn.addEventListener('click', savePng);

updateReadout();
resetSparkles();
requestAnimationFrame(animate);
