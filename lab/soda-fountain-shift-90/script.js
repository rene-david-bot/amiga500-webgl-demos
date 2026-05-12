const ticketEl = document.getElementById('ticket');
const statusEl = document.getElementById('status');
const targetBandEl = document.getElementById('targetBand');
const sodaFillEl = document.getElementById('sodaFill');
const foamFillEl = document.getElementById('foamFill');

const orderStatEl = document.getElementById('orderStat');
const scoreStatEl = document.getElementById('scoreStat');
const bestStatEl = document.getElementById('bestStat');
const liquidStatEl = document.getElementById('liquidStat');
const foamStatEl = document.getElementById('foamStat');
const fillStatEl = document.getElementById('fillStat');

const pourBtn = document.getElementById('pourBtn');
const serveBtn = document.getElementById('serveBtn');
const nextBtn = document.getElementById('nextBtn');
const muteBtn = document.getElementById('muteBtn');

const TOTAL_ORDERS = 8;
const BEST_KEY = 'retro-soda-fountain-best-v1';

const flavors = [
  { name: 'Cherry Cola', tint: 'cherry red' },
  { name: 'Root Beer', tint: 'amber brown' },
  { name: 'Electric Lime', tint: 'neon green' },
  { name: 'Blue Raspberry', tint: 'arcade blue' },
  { name: 'Cream Soda', tint: 'gold fizz' },
  { name: 'Orange Burst', tint: 'sunset orange' }
];

const sizes = [
  { name: 'Small', flow: 23 },
  { name: 'Medium', flow: 28 },
  { name: 'Large', flow: 33 }
];

const state = {
  order: 1,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  liquid: 0,
  foam: 0,
  pouring: false,
  served: false,
  shiftDone: false,
  muted: false,
  activeOrder: null,
  lastTime: performance.now()
};

const audio = {
  ctx: null
};

function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[rng(0, list.length - 1)];
}

function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
}

function beep(freq = 520, len = 0.08, type = 'square', gain = 0.03) {
  if (state.muted) return;
  ensureAudio();
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const amp = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + len);
  osc.connect(amp).connect(audio.ctx.destination);
  osc.start(now);
  osc.stop(now + len + 0.01);
}

function setStatus(text, mood = '') {
  statusEl.textContent = text;
  statusEl.classList.remove('good', 'warn');
  if (mood) statusEl.classList.add(mood);
}

function makeOrder() {
  const flavor = pick(flavors);
  const size = pick(sizes);
  const center = rng(54, 88);
  const halfWindow = rng(5, 8);
  const min = Math.max(18, center - halfWindow);
  const max = Math.min(96, center + halfWindow);

  return {
    booth: rng(1, 19),
    flavor,
    size,
    min,
    max,
    center: Math.round((min + max) / 2)
  };
}

function resetCup() {
  state.liquid = 0;
  state.foam = 0;
  state.pouring = false;
  state.served = false;
  serveBtn.disabled = false;
  nextBtn.disabled = true;
  pourBtn.disabled = false;
}

function startOrder() {
  state.activeOrder = makeOrder();
  resetCup();
  setStatus('Hold Pour, release near the target, then hit Serve.');
  render();
}

function totalFill() {
  return Math.min(100, state.liquid + state.foam * 0.72);
}

function updateCup(dt) {
  if (state.shiftDone || state.served) return;

  const target = state.activeOrder;
  if (!target) return;

  if (state.pouring) {
    state.liquid += target.size.flow * dt;
    state.foam += (8 + target.size.flow * 0.21) * dt;
  } else {
    state.foam -= 17 * dt;
  }

  state.foam = Math.max(0, Math.min(45, state.foam));
  state.liquid = Math.max(0, Math.min(100, state.liquid));

  if (state.liquid >= 100) {
    state.liquid = 100;
    state.pouring = false;
    setStatus('Cup maxed out. Serve now before it sloshes over.', 'warn');
    beep(210, 0.1, 'triangle', 0.032);
  }
}

function evaluateServe() {
  if (state.served || state.shiftDone) return;

  const total = totalFill();
  const { min, max, center } = state.activeOrder;
  const inRange = total >= min && total <= max;
  const distance = inRange ? Math.abs(total - center) : Math.min(Math.abs(total - min), Math.abs(total - max));

  let points;
  if (inRange) {
    points = Math.max(65, Math.round(130 - distance * 6));
    if (state.foam < 7) points += 12;
  } else {
    points = Math.max(0, Math.round(55 - distance * 4));
  }

  if (total >= 98) points = Math.max(0, points - 18);

  state.score += points;
  state.served = true;
  state.pouring = false;
  serveBtn.disabled = true;
  nextBtn.disabled = false;
  pourBtn.disabled = true;

  if (inRange) {
    setStatus(`Perfect pour window hit (${total.toFixed(1)}%). +${points} points.`, 'good');
    beep(860, 0.08, 'square', 0.03);
    setTimeout(() => beep(1180, 0.11, 'square', 0.03), 80);
  } else {
    setStatus(`Off target at ${total.toFixed(1)}%. +${points} points, tighten the release timing.`, 'warn');
    beep(300, 0.1, 'sawtooth', 0.028);
  }

  render();
}

function nextOrder() {
  if (!state.served && !state.shiftDone) return;

  if (state.shiftDone) {
    state.order = 1;
    state.score = 0;
    state.shiftDone = false;
    nextBtn.textContent = 'Next Order';
    startOrder();
    beep(620, 0.07, 'square', 0.025);
    return;
  }

  if (state.order >= TOTAL_ORDERS) {
    finishShift();
    return;
  }

  state.order += 1;
  startOrder();
  beep(620, 0.07, 'square', 0.025);
}

function finishShift() {
  state.shiftDone = true;
  state.served = true;
  state.pouring = false;
  serveBtn.disabled = true;
  pourBtn.disabled = true;
  nextBtn.disabled = false;
  nextBtn.textContent = 'Restart Shift';

  const final = state.score;
  const wasBest = final > state.best;
  if (wasBest) {
    state.best = final;
    localStorage.setItem(BEST_KEY, String(final));
  }

  const grade = final >= 860 ? 'A+' : final >= 740 ? 'A' : final >= 620 ? 'B' : final >= 500 ? 'C' : 'D';
  setStatus(`Shift complete. Score ${final} (${grade}). ${wasBest ? 'New diner high score.' : 'One more run to beat your best.'}`, 'good');
  beep(930, 0.09, 'square', 0.03);
  setTimeout(() => beep(1280, 0.12, 'square', 0.03), 95);
  render();
}

function renderTicket() {
  const order = state.activeOrder;
  if (!order) return;

  ticketEl.innerHTML = `
    <div><b>Booth #${order.booth}</b> · ${order.size.name}</div>
    <div><b>Flavor:</b> ${order.flavor.name} (${order.flavor.tint})</div>
    <div><b>Target fill:</b> ${order.min}% - ${order.max}%</div>
    <div><b>Center mark:</b> ${order.center}%</div>
  `;
}

function renderTargetBand() {
  const { min, max } = state.activeOrder;
  targetBandEl.style.bottom = `${min}%`;
  targetBandEl.style.height = `${Math.max(2, max - min)}%`;
}

function render() {
  orderStatEl.textContent = `${state.order} / ${TOTAL_ORDERS}`;
  scoreStatEl.textContent = state.score;
  bestStatEl.textContent = state.best;

  liquidStatEl.textContent = `${state.liquid.toFixed(1)}%`;
  foamStatEl.textContent = `${state.foam.toFixed(1)}%`;
  fillStatEl.textContent = `${totalFill().toFixed(1)}%`;

  sodaFillEl.style.height = `${state.liquid}%`;
  foamFillEl.style.height = `${Math.min(100, state.liquid + state.foam * 0.72)}%`;

  renderTicket();
  renderTargetBand();
}

function onPourStart() {
  if (state.served || state.shiftDone) return;
  state.pouring = true;
  beep(520, 0.05, 'square', 0.018);
}

function onPourStop() {
  state.pouring = false;
}

pourBtn.addEventListener('mousedown', onPourStart);
pourBtn.addEventListener('touchstart', (event) => {
  event.preventDefault();
  onPourStart();
}, { passive: false });

['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((evt) => {
  pourBtn.addEventListener(evt, onPourStop);
});

serveBtn.addEventListener('click', evaluateServe);
nextBtn.addEventListener('click', nextOrder);

muteBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  muteBtn.textContent = state.muted ? 'Unmute' : 'Mute';
  muteBtn.setAttribute('aria-pressed', String(state.muted));
  if (!state.muted) beep(560, 0.06, 'square', 0.024);
});

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    onPourStart();
  } else if (event.code === 'Enter') {
    event.preventDefault();
    if (!nextBtn.disabled && (state.served || state.shiftDone)) nextOrder();
    else evaluateServe();
  }
});

document.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    onPourStop();
  }
});

function tick(now) {
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  updateCup(dt);
  render();
  requestAnimationFrame(tick);
}

bestStatEl.textContent = state.best;
startOrder();
requestAnimationFrame(tick);
