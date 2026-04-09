const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');

const plateText = document.getElementById('plateText');
const stencilStyle = document.getElementById('stencilStyle');
const intensity = document.getElementById('intensity');
const scanlines = document.getElementById('scanlines');
const mirrorBtn = document.getElementById('mirrorBtn');
const newGrainBtn = document.getElementById('newGrainBtn');
const downloadBtn = document.getElementById('downloadBtn');

let mirror = false;
let seed = Math.random() * 9999;

function rng(n) {
  const x = Math.sin(n * 912.31 + seed * 0.1) * 43758.5453;
  return x - Math.floor(x);
}

function draw() {
  const w = stage.width;
  const h = stage.height;
  const burn = Number(intensity.value);
  const lines = Number(scanlines.value);

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#3d2a16');
  grad.addColorStop(0.5, '#7c5a2a');
  grad.addColorStop(1, '#2c1d10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    const n = 0.93 + rng(y) * 0.16;
    ctx.fillStyle = `rgba(${80*n}, ${58*n}, ${28*n}, 0.18)`;
    ctx.fillRect(0, y, w, 2);
  }

  for (let i = 0; i < 250; i++) {
    const x = rng(i + 1) * w;
    const y = rng(i + 2000) * h;
    const r = 0.8 + rng(i + 4000) * 2.2;
    ctx.fillStyle = `rgba(255,220,150,${0.03 + rng(i + 8000) * 0.09})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  const fontMap = {
    block: 'bold 96px Impact, Arial Black, sans-serif',
    script: 'italic 84px "Brush Script MT", cursive',
    mono: 'bold 88px "Courier New", monospace'
  };

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = fontMap[stencilStyle.value] || fontMap.block;

  const text = (plateText.value || '').toUpperCase().slice(0, 24);

  ctx.shadowBlur = 22 + burn * 2;
  ctx.shadowColor = `rgba(255, 110, 70, ${0.45 + burn * 0.04})`;
  ctx.fillStyle = `rgba(54, 24, 8, ${0.78 + burn * 0.02})`;
  ctx.fillText(text, w / 2, h / 2);

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = `rgba(255, 190, 120, ${0.32 + burn * 0.03})`;
  ctx.strokeText(text, w / 2, h / 2);

  ctx.restore();

  const lineGap = Math.max(3, 24 - lines);
  ctx.fillStyle = 'rgba(10, 4, 20, 0.18)';
  for (let y = 0; y < h; y += lineGap) {
    ctx.fillRect(0, y, w, 1);
  }

  ctx.strokeStyle = '#0008';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
}

function bind() {
  [plateText, stencilStyle, intensity, scanlines].forEach(el => {
    el.addEventListener('input', draw);
  });

  mirrorBtn.addEventListener('click', () => {
    mirror = !mirror;
    mirrorBtn.textContent = mirror ? 'Unmirror Stencil' : 'Mirror Stencil';
    draw();
  });

  newGrainBtn.addEventListener('click', () => {
    seed = Math.random() * 9999;
    draw();
  });

  downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = stage.toDataURL('image/png');
    a.download = `laser-etch-${Date.now()}.png`;
    a.click();
  });
}

bind();
draw();
