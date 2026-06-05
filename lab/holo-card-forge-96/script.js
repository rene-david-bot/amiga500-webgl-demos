const canvas = document.getElementById('cardCanvas');
const ctx = canvas.getContext('2d');

const nameInput = document.getElementById('nameInput');
const divisionSelect = document.getElementById('divisionSelect');
const raritySelect = document.getElementById('raritySelect');
const foilSelect = document.getElementById('foilSelect');
const paletteSelect = document.getElementById('paletteSelect');
const moveInput = document.getElementById('moveInput');
const speedInput = document.getElementById('speedInput');
const techInput = document.getElementById('techInput');
const styleInput = document.getElementById('styleInput');
const luckInput = document.getElementById('luckInput');

const speedValue = document.getElementById('speedValue');
const techValue = document.getElementById('techValue');
const styleValue = document.getElementById('styleValue');
const luckValue = document.getElementById('luckValue');

const randomBtn = document.getElementById('randomBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const saveBtn = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

const palettes = {
  cyanmagenta: {
    bg1: '#07152b',
    bg2: '#152b63',
    bg3: '#321056',
    accent: '#63e6ff',
    accent2: '#ff72d2',
    ink: '#f5f9ff'
  },
  sunfire: {
    bg1: '#210b0a',
    bg2: '#5a1e14',
    bg3: '#241845',
    accent: '#ffb347',
    accent2: '#ff4f7d',
    ink: '#fff7ec'
  },
  violetstorm: {
    bg1: '#0f1027',
    bg2: '#312666',
    bg3: '#4d1460',
    accent: '#9c88ff',
    accent2: '#5ef2ff',
    ink: '#f6f6ff'
  },
  acidmint: {
    bg1: '#051714',
    bg2: '#123e31',
    bg3: '#26324f',
    accent: '#86ffbf',
    accent2: '#ffe66d',
    ink: '#f3fff8'
  }
};

const rarityStyles = {
  Rookie: { border: '#7da6ff', glow: 'rgba(125,166,255,0.34)' },
  Rare: { border: '#63e6ff', glow: 'rgba(99,230,255,0.34)' },
  'All-Star': { border: '#ffd76a', glow: 'rgba(255,215,106,0.36)' },
  Legend: { border: '#ff84d8', glow: 'rgba(255,132,216,0.38)' },
  'Glitch Holo': { border: '#9dff7a', glow: 'rgba(157,255,122,0.34)' }
};

const heroPrefixes = ['LASER', 'TURBO', 'PIXEL', 'NOVA', 'GLITCH', 'MEGA', 'NIGHT', 'HYPER', 'NEON', 'CYBER'];
const heroSuffixes = ['LYNX', 'VIPER', 'JET', 'PUMA', 'MANTIS', 'PHANTOM', 'COMET', 'RAVEN', 'BLADE', 'ORBIT'];
const moves = ['PIXEL POUNCE', 'GRID SLASH', 'STATIC BURST', 'MIDNIGHT DASH', 'HYPER SPIN', 'ARCADE ROAR', 'LASER SNAP', 'NEON JAM'];
const divisions = ['Arcade League', 'Mall Circuit', 'Midnight Crew', 'Street Grid', 'Signal Club'];
const rarities = ['Rookie', 'Rare', 'All-Star', 'Legend', 'Glitch Holo'];
const foils = ['prism', 'grid', 'sunset', 'lightning'];
const paletteKeys = Object.keys(palettes);

const sparkles = Array.from({ length: 34 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  size: 1 + Math.random() * 3,
  phase: Math.random() * Math.PI * 2,
  speed: 0.7 + Math.random() * 1.5
}));

const state = {
  name: nameInput.value.trim(),
  division: divisionSelect.value,
  rarity: raritySelect.value,
  foil: foilSelect.value,
  palette: paletteSelect.value,
  move: moveInput.value.trim(),
  speed: Number(speedInput.value),
  tech: Number(techInput.value),
  style: Number(styleInput.value),
  luck: Number(luckInput.value),
  time: 0,
  serial: makeSerial()
};

function makeSerial() {
  return `${Math.floor(100 + Math.random() * 900)}-${Math.floor(10 + Math.random() * 90)}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message) {
  statusEl.textContent = message;
}

function syncState() {
  state.name = (nameInput.value || 'LASER LYNX').toUpperCase().slice(0, 22);
  state.division = divisionSelect.value;
  state.rarity = raritySelect.value;
  state.foil = foilSelect.value;
  state.palette = paletteSelect.value;
  state.move = (moveInput.value || 'PIXEL POUNCE').toUpperCase().slice(0, 28);
  state.speed = Number(speedInput.value);
  state.tech = Number(techInput.value);
  state.style = Number(styleInput.value);
  state.luck = Number(luckInput.value);

  nameInput.value = state.name;
  moveInput.value = state.move;
  speedValue.textContent = String(state.speed);
  techValue.textContent = String(state.tech);
  styleValue.textContent = String(state.style);
  luckValue.textContent = String(state.luck);
}

function totalRating() {
  return Math.round((state.speed + state.tech + state.style + state.luck) / 4);
}

function shuffleFinish() {
  state.foil = foils[Math.floor(Math.random() * foils.length)];
  state.palette = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
  foilSelect.value = state.foil;
  paletteSelect.value = state.palette;
  setStatus('Foil and palette remixed. Fresh pack energy achieved.');
}

function randomHero() {
  state.name = `${heroPrefixes[Math.floor(Math.random() * heroPrefixes.length)]} ${heroSuffixes[Math.floor(Math.random() * heroSuffixes.length)]}`;
  state.move = moves[Math.floor(Math.random() * moves.length)];
  state.division = divisions[Math.floor(Math.random() * divisions.length)];
  state.rarity = rarities[Math.floor(Math.random() * rarities.length)];
  state.foil = foils[Math.floor(Math.random() * foils.length)];
  state.palette = paletteKeys[Math.floor(Math.random() * paletteKeys.length)];
  state.speed = 45 + Math.floor(Math.random() * 55);
  state.tech = 45 + Math.floor(Math.random() * 55);
  state.style = 45 + Math.floor(Math.random() * 55);
  state.luck = 45 + Math.floor(Math.random() * 55);
  state.serial = makeSerial();

  nameInput.value = state.name;
  moveInput.value = state.move;
  divisionSelect.value = state.division;
  raritySelect.value = state.rarity;
  foilSelect.value = state.foil;
  paletteSelect.value = state.palette;
  speedInput.value = String(state.speed);
  techInput.value = String(state.tech);
  styleInput.value = String(state.style);
  luckInput.value = String(state.luck);
  syncState();
  setStatus('Random hero generated. Smells like a fresh foil pull.');
}

function drawRoundedRect(x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawBackground(palette) {
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, palette.bg1);
  bg.addColorStop(0.45, palette.bg2);
  bg.addColorStop(1, palette.bg3);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(canvas.width * 0.25, canvas.height * 0.22, 20, canvas.width * 0.25, canvas.height * 0.22, 280);
  glow.addColorStop(0, 'rgba(255,255,255,0.18)');
  glow.addColorStop(0.6, 'rgba(255,255,255,0.04)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawFoil(palette) {
  ctx.save();
  ctx.globalAlpha = 0.2;

  if (state.foil === 'grid') {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 1;
    for (let x = -40; x < canvas.width + 40; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x + (state.time * 0.02) % 36, 0);
      ctx.lineTo(x + (state.time * 0.02) % 36, canvas.height);
      ctx.stroke();
    }
    for (let y = -40; y < canvas.height + 40; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y + (state.time * 0.015) % 28);
      ctx.lineTo(canvas.width, y + (state.time * 0.015) % 28);
      ctx.stroke();
    }
  } else if (state.foil === 'sunset') {
    for (let i = 0; i < 12; i += 1) {
      const band = ctx.createLinearGradient(0, 0, canvas.width, 0);
      band.addColorStop(0, 'rgba(255,130,87,0)');
      band.addColorStop(0.5, i % 2 ? 'rgba(255,209,102,0.95)' : 'rgba(255,97,169,0.95)');
      band.addColorStop(1, 'rgba(82,238,255,0)');
      ctx.fillStyle = band;
      const y = ((i * 84) + state.time * (0.08 + i * 0.01)) % (canvas.height + 120) - 60;
      ctx.fillRect(0, y, canvas.width, 8);
    }
  } else if (state.foil === 'lightning') {
    ctx.strokeStyle = palette.accent2;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      let x = 60 + i * 80 + Math.sin(state.time * 0.001 + i) * 18;
      let y = -20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < canvas.height + 20) {
        x += (Math.sin(y * 0.04 + i + state.time * 0.0012) * 10);
        y += 34;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else {
    for (let i = -canvas.height; i < canvas.width + canvas.height; i += 42) {
      const band = ctx.createLinearGradient(i, 0, i + 140, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = band;
      ctx.save();
      ctx.translate((state.time * 0.14) % 42, 0);
      ctx.rotate(-0.5);
      ctx.fillRect(i, -120, 30, canvas.height + 240);
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawFrame(palette, rarity) {
  ctx.save();
  drawRoundedRect(32, 32, canvas.width - 64, canvas.height - 64, 28, 'rgba(4,8,18,0.18)', rarity.border);
  ctx.lineWidth = 4;
  ctx.shadowColor = rarity.glow;
  ctx.shadowBlur = 22;
  drawRoundedRect(50, 50, canvas.width - 100, canvas.height - 100, 24, 'rgba(255,255,255,0.02)', palette.accent);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 1;
  for (let y = 74; y < canvas.height - 74; y += 6) {
    ctx.beginPath();
    ctx.moveTo(62, y);
    ctx.lineTo(canvas.width - 62, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRibbon(palette) {
  ctx.save();
  const ribbon = ctx.createLinearGradient(76, 0, canvas.width - 76, 0);
  ribbon.addColorStop(0, palette.accent2);
  ribbon.addColorStop(0.5, palette.accent);
  ribbon.addColorStop(1, palette.accent2);
  drawRoundedRect(86, 78, canvas.width - 172, 68, 18, ribbon, 'rgba(255,255,255,0.28)');
  ctx.fillStyle = '#09121f';
  ctx.font = '900 34px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.rarity.toUpperCase(), canvas.width / 2, 112);
  ctx.restore();
}

function drawPortrait(palette) {
  const left = 82;
  const top = 178;
  const width = canvas.width - 164;
  const height = 412;
  drawRoundedRect(left, top, width, height, 24, 'rgba(6,10,19,0.34)', 'rgba(255,255,255,0.15)');

  const burst = ctx.createRadialGradient(canvas.width / 2, top + 170, 30, canvas.width / 2, top + 170, 220);
  burst.addColorStop(0, palette.accent2);
  burst.addColorStop(0.45, palette.accent);
  burst.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = burst;
  ctx.fillRect(left, top, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(canvas.width / 2, top + 192 + Math.sin(state.time * 0.0016) * 6);

  ctx.shadowColor = palette.accent;
  ctx.shadowBlur = 26;
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(0, -62, 78, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.accent2;
  ctx.fillRect(-62, 18, 124, 128);

  ctx.fillStyle = '#0b1220';
  ctx.fillRect(-70, -78, 140, 38);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-50, -67, 100, 16);

  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-88, 138);
  ctx.lineTo(-28, 86);
  ctx.lineTo(0, 126);
  ctx.lineTo(28, 80);
  ctx.lineTo(88, 138);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-110, -8);
  ctx.lineTo(-36, -38);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(110, -8);
  ctx.lineTo(36, -38);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(canvas.width / 2, top + 204, 110 + i * 22 + Math.sin(state.time * 0.001 + i) * 6, -Math.PI * 0.2, Math.PI * 1.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSparkles() {
  ctx.save();
  ctx.globalAlpha = 0.85;
  sparkles.forEach((star, index) => {
    const x = star.x;
    const y = star.y;
    const pulse = 0.45 + Math.sin(state.time * 0.002 * star.speed + star.phase) * 0.55;
    const size = star.size + pulse * 1.3;
    ctx.fillStyle = index % 2 ? 'rgba(255,255,255,0.88)' : 'rgba(255,230,154,0.82)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.48)';
    ctx.beginPath();
    ctx.moveTo(x - size * 2.4, y);
    ctx.lineTo(x + size * 2.4, y);
    ctx.moveTo(x, y - size * 2.4);
    ctx.lineTo(x, y + size * 2.4);
    ctx.stroke();
  });
  ctx.restore();
}

function drawTextPanels(palette) {
  ctx.fillStyle = palette.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.font = '900 48px Trebuchet MS';
  ctx.fillText(state.name, 84, 654);

  ctx.font = '700 22px Trebuchet MS';
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText(state.division.toUpperCase(), 86, 692);

  const badge = `${totalRating()} OVR`;
  const badgeWidth = ctx.measureText(badge).width + 34;
  drawRoundedRect(canvas.width - badgeWidth - 86, 624, badgeWidth, 52, 18, 'rgba(6,14,24,0.62)', palette.accent);
  ctx.fillStyle = palette.ink;
  ctx.font = '900 28px Trebuchet MS';
  ctx.fillText(badge, canvas.width - badgeWidth - 68, 658);

  drawRoundedRect(82, 722, canvas.width - 164, 86, 18, 'rgba(8,14,26,0.56)', 'rgba(255,255,255,0.14)');
  ctx.fillStyle = palette.accent2;
  ctx.font = '700 18px Trebuchet MS';
  ctx.fillText('SIGNATURE MOVE', 104, 752);
  ctx.fillStyle = palette.ink;
  ctx.font = '900 32px Trebuchet MS';
  ctx.fillText(state.move, 104, 791);
}

function drawStats(palette) {
  const stats = [
    ['SPD', state.speed],
    ['TEC', state.tech],
    ['STY', state.style],
    ['LCK', state.luck]
  ];

  let y = 844;
  ctx.textAlign = 'left';
  stats.forEach(([label, value], index) => {
    const barY = y + index * 42;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 20px Trebuchet MS';
    ctx.fillText(label, 92, barY + 18);

    drawRoundedRect(152, barY, 412, 22, 11, 'rgba(6,14,24,0.7)', 'rgba(255,255,255,0.1)');
    const fill = ctx.createLinearGradient(152, 0, 564, 0);
    fill.addColorStop(0, palette.accent);
    fill.addColorStop(1, palette.accent2);
    drawRoundedRect(152, barY, Math.round((value / 99) * 412), 22, 11, fill, null);

    ctx.fillStyle = palette.ink;
    ctx.font = '900 22px Trebuchet MS';
    ctx.fillText(String(value), 584, barY + 19);
  });
}

function drawFooter(palette) {
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '700 16px Trebuchet MS';
  ctx.fillText(`NO. ${state.serial}`, 84, 960);
  ctx.textAlign = 'right';
  ctx.fillText('DAVE RETRO LAB · 1996 PACK', canvas.width - 84, 960);
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(76, 972, canvas.width - 152, 4);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(76, 972, Math.round((totalRating() / 99) * (canvas.width - 152)), 4);
}

function drawCard() {
  const palette = palettes[state.palette] || palettes.cyanmagenta;
  const rarity = rarityStyles[state.rarity] || rarityStyles.Rare;

  drawBackground(palette);
  drawFoil(palette);
  drawFrame(palette, rarity);
  drawRibbon(palette);
  drawPortrait(palette);
  drawSparkles();
  drawTextPanels(palette);
  drawStats(palette);
  drawFooter(palette);
}

let lastTime = performance.now();
function animate(now) {
  const delta = now - lastTime;
  lastTime = now;
  state.time += delta;
  drawCard();
  requestAnimationFrame(animate);
}

function savePng() {
  const safeName = (state.name || 'holo-card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'holo-card';
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `${safeName}.png`;
  link.click();
  setStatus('PNG exported. Straight to the lunchbox collection.');
}

[nameInput, divisionSelect, raritySelect, foilSelect, paletteSelect, moveInput, speedInput, techInput, styleInput, luckInput].forEach((element) => {
  element.addEventListener('input', syncState);
  element.addEventListener('change', syncState);
});

randomBtn.addEventListener('click', randomHero);
shuffleBtn.addEventListener('click', shuffleFinish);
saveBtn.addEventListener('click', savePng);

syncState();
requestAnimationFrame(animate);
