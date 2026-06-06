const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hookedLabel = document.getElementById('hookedLabel');
const scoreLabel = document.getElementById('scoreLabel');
const timerLabel = document.getElementById('timerLabel');
const bestLabel = document.getElementById('bestLabel');
const comboLabel = document.getElementById('comboLabel');
const medalLabel = document.getElementById('medalLabel');
const jetsLabel = document.getElementById('jetsLabel');
const statusEl = document.getElementById('status');

const leftPumpBtn = document.getElementById('leftPumpBtn');
const rightPumpBtn = document.getElementById('rightPumpBtn');
const resetBtn = document.getElementById('resetBtn');
const audioBtn = document.getElementById('audioBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TANK = { x: 120, y: 168, w: 480, h: 660 };
const RING_RADIUS = 24;
const ROUND_TIME = 45;
const STORAGE_KEY = 'retroPocketRingTossBest';

const pegLayout = [
  { x: TANK.x + 102, y: TANK.y + 138 },
  { x: TANK.x + 236, y: TANK.y + 118 },
  { x: TANK.x + 374, y: TANK.y + 138 },
  { x: TANK.x + 150, y: TANK.y + 290 },
  { x: TANK.x + 284, y: TANK.y + 314 },
  { x: TANK.x + 418, y: TANK.y + 290 }
];

const colorPairs = [
  ['#ff6a84', '#ffd6de'],
  ['#6fe0ff', '#dffcff'],
  ['#ffe26b', '#fff8c8'],
  ['#b38cff', '#ede0ff'],
  ['#7dff92', '#e7ffe9'],
  ['#ff9a57', '#ffe5c6']
];

const state = {
  rings: [],
  pegs: [],
  bubbles: [],
  ripples: [],
  score: 0,
  combo: 1,
  hooked: 0,
  jets: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  status: '',
  startTime: 0,
  timeLeft: ROUND_TIME,
  ended: false,
  won: false,
  lastFrame: 0,
  lastHookAt: -10,
  lastPumpAt: { left: -1000, right: -1000 },
  audioOn: false,
  audioCtx: null
};

function setStatus(text) {
  state.status = text;
  statusEl.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function beep(freq, duration = 0.08, type = 'triangle', gain = 0.018, delay = 0) {
  if (!state.audioOn) {
    return;
  }
  ensureAudio();
  const now = state.audioCtx.currentTime + delay;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function createRing(index) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const baseX = TANK.x + 138 + column * 102 + rand(-26, 26);
  const baseY = TANK.y + 510 + row * 74 + rand(-24, 18);
  const [fill, shine] = colorPairs[index % colorPairs.length];

  return {
    id: index,
    x: baseX,
    y: baseY,
    vx: rand(-0.4, 0.4),
    vy: rand(-0.2, 0.2),
    radius: RING_RADIUS,
    fill,
    shine,
    hooked: false,
    pegIndex: -1,
    spin: Math.random() * Math.PI * 2,
    bob: Math.random() * Math.PI * 2
  };
}

function resetRound() {
  state.pegs = pegLayout.map((peg) => ({ ...peg, occupied: false }));
  state.rings = Array.from({ length: 6 }, (_, index) => createRing(index));
  state.bubbles = [];
  state.ripples = [];
  state.score = 0;
  state.combo = 1;
  state.hooked = 0;
  state.jets = 0;
  state.startTime = performance.now();
  state.timeLeft = ROUND_TIME;
  state.ended = false;
  state.won = false;
  state.lastFrame = performance.now();
  state.lastHookAt = -10;
  state.lastPumpAt.left = -1000;
  state.lastPumpAt.right = -1000;
  updateHud();
  setStatus('Hook all six rings before the timer hits zero.');
}

function updateHud() {
  hookedLabel.textContent = `${state.hooked} / ${state.rings.length}`;
  scoreLabel.textContent = String(state.score);
  timerLabel.textContent = `${state.timeLeft.toFixed(1)}s`;
  bestLabel.textContent = String(state.best);
  comboLabel.textContent = `x${state.combo}`;
  jetsLabel.textContent = String(state.jets);
  medalLabel.textContent = medalForScore(state.score, state.hooked);
}

function medalForScore(score, hooked) {
  if (hooked === state.rings.length) {
    return score >= 1050 ? 'Gold' : 'Silver';
  }
  if (hooked >= 4 || score >= 520) {
    return 'Bronze';
  }
  return 'Starter';
}

function createJet(side) {
  const now = performance.now();
  if (state.ended || now - state.lastPumpAt[side] < 125) {
    return;
  }

  state.lastPumpAt[side] = now;
  state.jets += 1;
  const nozzleX = side === 'left' ? TANK.x + 72 : TANK.x + TANK.w - 72;
  const nozzleY = TANK.y + TANK.h - 58;
  const horizontal = side === 'left' ? 1 : -1;

  state.rings.forEach((ring) => {
    if (ring.hooked) {
      return;
    }
    const dx = ring.x - nozzleX;
    const dy = ring.y - nozzleY;
    const distance = Math.hypot(dx, dy);
    if (distance > 430) {
      return;
    }
    const strength = 1 - distance / 430;
    ring.vx += horizontal * (1.2 + strength * 2.8);
    ring.vy -= 1.3 + strength * 3.6;
  });

  for (let i = 0; i < 16; i += 1) {
    state.bubbles.push({
      x: nozzleX + rand(-12, 12),
      y: nozzleY + rand(-8, 8),
      vx: horizontal * rand(0.8, 2.1) + rand(-0.3, 0.3),
      vy: rand(-5.6, -2.2),
      size: rand(3, 8),
      life: rand(0.5, 1.05)
    });
  }

  state.ripples.push({
    side,
    age: 0
  });

  setStatus(side === 'left' ? 'Left jet fired. Rings pushed right.' : 'Right jet fired. Rings pushed left.');
  updateHud();
  pulsePump(side === 'left' ? leftPumpBtn : rightPumpBtn);
  beep(side === 'left' ? 410 : 520, 0.06, 'triangle', 0.015);
}

function pulsePump(button) {
  button.classList.add('active');
  window.setTimeout(() => button.classList.remove('active'), 110);
}

function maybeHookRing(ring, elapsedSeconds) {
  if (ring.hooked) {
    return;
  }

  for (let i = 0; i < state.pegs.length; i += 1) {
    const peg = state.pegs[i];
    if (peg.occupied) {
      continue;
    }
    const targetY = peg.y + 26;
    const nearX = Math.abs(ring.x - peg.x) < 24;
    const nearY = Math.abs(ring.y - targetY) < 22;
    const calm = Math.abs(ring.vx) < 2.3 && Math.abs(ring.vy) < 2.8;

    if (nearX && nearY && calm) {
      peg.occupied = true;
      ring.hooked = true;
      ring.pegIndex = i;
      ring.x = peg.x;
      ring.y = targetY;
      ring.vx = 0;
      ring.vy = 0;

      const chain = elapsedSeconds - state.lastHookAt < 3.8 ? state.combo + 1 : 1;
      state.combo = chain;
      state.lastHookAt = elapsedSeconds;
      state.hooked += 1;
      state.score += 120 + chain * 35 + Math.round(state.timeLeft * 2);
      setStatus(`Ring hooked clean. Combo x${chain}.`);

      beep(740, 0.08, 'square', 0.02);
      beep(980, 0.08, 'triangle', 0.015, 0.04);

      if (state.hooked === state.rings.length) {
        finishRound(true);
      }
      updateHud();
      return;
    }
  }
}

function finishRound(won) {
  if (state.ended) {
    return;
  }
  state.ended = true;
  state.won = won;
  state.timeLeft = Math.max(0, state.timeLeft);

  if (!won) {
    state.combo = 1;
    setStatus(`Time! You hooked ${state.hooked} of ${state.rings.length}. Hit Fresh Round for another try.`);
    beep(240, 0.1, 'sawtooth', 0.02);
  } else {
    state.score += Math.round(state.timeLeft * 18);
    setStatus(`Cabinet cleared! All six rings hooked with ${state.timeLeft.toFixed(1)}s left.`);
    beep(620, 0.08, 'triangle', 0.018);
    beep(820, 0.09, 'triangle', 0.018, 0.04);
    beep(1120, 0.11, 'square', 0.016, 0.09);
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }

  updateHud();
}

function update(deltaSeconds, elapsedSeconds) {
  if (!state.ended) {
    state.timeLeft = clamp(ROUND_TIME - elapsedSeconds, 0, ROUND_TIME);
    if (state.timeLeft <= 0) {
      finishRound(false);
    }
  }

  state.bubbles = state.bubbles.filter((bubble) => bubble.life > 0);
  state.bubbles.forEach((bubble) => {
    bubble.x += bubble.vx;
    bubble.y += bubble.vy;
    bubble.vy *= 0.99;
    bubble.vx *= 0.99;
    bubble.life -= deltaSeconds * 1.4;
  });

  state.ripples = state.ripples.filter((ripple) => ripple.age < 1.1);
  state.ripples.forEach((ripple) => {
    ripple.age += deltaSeconds * 2.1;
  });

  state.rings.forEach((ring) => {
    if (ring.hooked) {
      ring.spin += deltaSeconds * 0.8;
      return;
    }

    ring.bob += deltaSeconds;
    ring.vx += Math.sin(elapsedSeconds * 1.2 + ring.id) * 0.005;
    ring.vy += 0.09;
    ring.vx *= 0.992;
    ring.vy *= 0.994;
    ring.x += ring.vx;
    ring.y += ring.vy;

    const left = TANK.x + ring.radius;
    const right = TANK.x + TANK.w - ring.radius;
    const top = TANK.y + ring.radius;
    const bottom = TANK.y + TANK.h - ring.radius;

    if (ring.x < left) {
      ring.x = left;
      ring.vx *= -0.65;
    } else if (ring.x > right) {
      ring.x = right;
      ring.vx *= -0.65;
    }

    if (ring.y < top) {
      ring.y = top;
      ring.vy = Math.abs(ring.vy) * 0.35;
    } else if (ring.y > bottom) {
      ring.y = bottom;
      ring.vy *= -0.48;
      ring.vx *= 0.96;
    }

    maybeHookRing(ring, elapsedSeconds);
  });

  updateHud();
}

function drawBackground(elapsedSeconds) {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, '#2b1a2a');
  bg.addColorStop(0.3, '#1a244f');
  bg.addColorStop(1, '#110f1b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(50, 38, WIDTH - 100, 70);

  ctx.fillStyle = '#f0aa5f';
  ctx.fillRect(88, 118, WIDTH - 176, HEIGHT - 180);
  ctx.fillStyle = '#d45a2b';
  ctx.fillRect(96, 126, WIDTH - 192, HEIGHT - 196);

  const shellGlow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.18, 50, WIDTH * 0.5, HEIGHT * 0.18, 360);
  shellGlow.addColorStop(0, 'rgba(255, 250, 239, 0.16)');
  shellGlow.addColorStop(1, 'rgba(255, 250, 239, 0)');
  ctx.fillStyle = shellGlow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = '#f4d3a2';
  roundRect(104, 152, WIDTH - 208, HEIGHT - 264, 28, true);

  const water = ctx.createLinearGradient(0, TANK.y, 0, TANK.y + TANK.h);
  water.addColorStop(0, '#a2f4ff');
  water.addColorStop(0.34, '#57bbff');
  water.addColorStop(1, '#1452b8');
  ctx.fillStyle = water;
  roundRect(TANK.x, TANK.y, TANK.w, TANK.h, 24, true);

  ctx.save();
  roundRect(TANK.x, TANK.y, TANK.w, TANK.h, 24, false);
  ctx.clip();

  const sheen = ctx.createLinearGradient(TANK.x, TANK.y, TANK.x + TANK.w, TANK.y + TANK.h);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.3, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = sheen;
  ctx.fillRect(TANK.x, TANK.y, TANK.w, TANK.h);

  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 1;
  for (let y = TANK.y + 10; y < TANK.y + TANK.h; y += 14) {
    const wobble = Math.sin(elapsedSeconds * 3 + y * 0.04) * 8;
    ctx.beginPath();
    ctx.moveTo(TANK.x + 8, y);
    ctx.quadraticCurveTo(TANK.x + TANK.w * 0.5 + wobble, y + 6, TANK.x + TANK.w - 8, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(7, 18, 42, 0.35)';
  roundRect(166, 64, WIDTH - 332, 42, 14, true);
  ctx.fillStyle = '#fff0d0';
  ctx.font = '700 24px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("POCKET RING TOSS '91", WIDTH / 2, 92);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#5d2a00';
  ctx.font = '700 18px "Trebuchet MS", sans-serif';
  ctx.fillText('LEFT', 142, HEIGHT - 68);
  ctx.fillText('RIGHT', WIDTH - 220, HEIGHT - 68);
}

function drawPegs() {
  state.pegs.forEach((peg, index) => {
    ctx.strokeStyle = '#e7f5ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(peg.x, peg.y + 86);
    ctx.lineTo(peg.x, peg.y);
    ctx.stroke();

    ctx.fillStyle = '#fef9ee';
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(peg.x - 2, peg.y + 14, 4, 74);

    ctx.fillStyle = peg.occupied ? '#cbff5e' : 'rgba(255,255,255,0.4)';
    ctx.font = '700 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), peg.x, peg.y - 16);
  });
}

function drawRings(elapsedSeconds) {
  state.rings.forEach((ring) => {
    const x = ring.x;
    const y = ring.y + (ring.hooked ? Math.sin(ring.spin) * 1.2 : Math.sin(elapsedSeconds * 2 + ring.bob) * 1.4);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ring.hooked ? Math.sin(ring.spin) * 0.06 : ring.vx * 0.03);

    ctx.strokeStyle = ring.fill;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ring.shine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-3, -3, ring.radius - 1, Math.PI * 1.02, Math.PI * 1.72);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ring.radius - 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBubbles() {
  state.bubbles.forEach((bubble) => {
    ctx.globalAlpha = Math.max(0, bubble.life);
    ctx.fillStyle = '#e9fcff';
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRipples() {
  state.ripples.forEach((ripple) => {
    const nozzleX = ripple.side === 'left' ? TANK.x + 72 : TANK.x + TANK.w - 72;
    const nozzleY = TANK.y + TANK.h - 58;
    const spread = ripple.age * 110;
    ctx.strokeStyle = `rgba(255,255,255,${0.35 - ripple.age * 0.25})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(nozzleX, nozzleY, spread, Math.PI, Math.PI * 2);
    ctx.stroke();
  });
}

function drawOverlay() {
  if (!state.ended) {
    return;
  }

  ctx.fillStyle = 'rgba(5, 12, 24, 0.62)';
  roundRect(170, 330, WIDTH - 340, 188, 28, true);

  ctx.textAlign = 'center';
  ctx.fillStyle = state.won ? '#cbff5e' : '#ffe07a';
  ctx.font = '700 38px "Trebuchet MS", sans-serif';
  ctx.fillText(state.won ? 'CABINET CLEARED' : 'TIME CALLED', WIDTH / 2, 390);

  ctx.fillStyle = '#f6f8ff';
  ctx.font = '700 24px "Trebuchet MS", sans-serif';
  ctx.fillText(`Score ${state.score}`, WIDTH / 2, 432);

  ctx.font = '400 18px "Trebuchet MS", sans-serif';
  const line = state.won
    ? `All six rings hooked. Bonus time banked: ${state.timeLeft.toFixed(1)}s`
    : `You landed ${state.hooked} of ${state.rings.length}. Quick taps work better than panic blasts.`;
  ctx.fillText(line, WIDTH / 2, 468);
  ctx.fillText('Press Fresh Round or tap R to run it back.', WIDTH / 2, 498);
}

function draw() {
  const elapsedSeconds = (performance.now() - state.startTime) / 1000;
  drawBackground(elapsedSeconds);
  drawPegs();
  drawRipples();
  drawBubbles();
  drawRings(elapsedSeconds);
  drawOverlay();
}

function roundRect(x, y, width, height, radius, fill) {
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
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function animate(now) {
  if (!state.lastFrame) {
    state.lastFrame = now;
  }
  const deltaSeconds = clamp((now - state.lastFrame) / 1000, 0, 0.05);
  state.lastFrame = now;
  const elapsedSeconds = (now - state.startTime) / 1000;

  update(deltaSeconds, elapsedSeconds);
  draw();
  window.requestAnimationFrame(animate);
}

function bindPumpButton(button, side) {
  const start = (event) => {
    event.preventDefault();
    createJet(side);
  };
  button.addEventListener('pointerdown', start);
}

bindPumpButton(leftPumpBtn, 'left');
bindPumpButton(rightPumpBtn, 'right');

resetBtn.addEventListener('click', () => {
  resetRound();
  beep(520, 0.06, 'triangle', 0.014);
});

audioBtn.addEventListener('click', async () => {
  state.audioOn = !state.audioOn;
  audioBtn.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
  if (state.audioOn) {
    ensureAudio();
    beep(540, 0.07, 'square', 0.015);
    setStatus('Audio enabled. Tiny bubble synth engaged.');
  } else {
    setStatus('Audio muted. Cabinet still fully playable.');
  }
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    createJet('left');
  } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    createJet('right');
  } else if (event.key.toLowerCase() === 'r') {
    resetRound();
  }
});

resetRound();
window.requestAnimationFrame(animate);
