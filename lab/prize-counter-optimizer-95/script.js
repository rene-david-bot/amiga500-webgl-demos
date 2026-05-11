const prizeListEl = document.getElementById('prizeList');
const roundStatEl = document.getElementById('roundStat');
const budgetStatEl = document.getElementById('budgetStat');
const spentStatEl = document.getElementById('spentStat');
const hypeStatEl = document.getElementById('hypeStat');
const scoreStatEl = document.getElementById('scoreStat');
const bestStatEl = document.getElementById('bestStat');
const statusEl = document.getElementById('status');
const lockBtn = document.getElementById('lockBtn');
const nextBtn = document.getElementById('nextBtn');
const muteBtn = document.getElementById('muteBtn');

const BEST_KEY = 'retro-prize-counter-best-v1';
const TOTAL_ROUNDS = 6;

const catalog = [
  { name: 'Glow Yo-Yo', cost: 120, joy: 95, max: 4 },
  { name: 'Pocket Puzzle Ring', cost: 180, joy: 140, max: 3 },
  { name: 'Laser Sticker Pack', cost: 220, joy: 165, max: 3 },
  { name: 'Cosmic Slime Tube', cost: 260, joy: 188, max: 3 },
  { name: 'Mini Skate Fingerboard', cost: 320, joy: 235, max: 2 },
  { name: 'Turbo Water Blaster', cost: 430, joy: 310, max: 2 },
  { name: 'Neon Handheld Fan', cost: 520, joy: 360, max: 2 },
  { name: 'Robo Bug Kit', cost: 640, joy: 452, max: 2 },
  { name: 'LCD Brick Game', cost: 780, joy: 560, max: 2 },
  { name: 'Arcade Plush Alien', cost: 940, joy: 662, max: 1 },
  { name: 'Skate Helmet Deluxe', cost: 1080, joy: 760, max: 1 },
  { name: 'Galaxy RC Hopper', cost: 1320, joy: 940, max: 1 }
];

const state = {
  round: 1,
  score: 0,
  budget: 0,
  items: [],
  choices: new Map(),
  locked: false,
  shiftComplete: false,
  muted: false,
  best: Number(localStorage.getItem(BEST_KEY) || 0)
};

const audio = {
  ctx: null,
  ready: false
};

function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(array, count) {
  const src = [...array];
  const out = [];
  while (out.length < count && src.length) {
    out.push(src.splice(rng(0, src.length - 1), 1)[0]);
  }
  return out;
}

function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.ready = true;
}

function beep(freq = 520, len = 0.08, type = 'square', gain = 0.04) {
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

function currentTotals() {
  let spent = 0;
  let hype = 0;
  for (const item of state.items) {
    const qty = state.choices.get(item.name) || 0;
    spent += qty * item.cost;
    hype += qty * item.joy;
  }
  return { spent, hype };
}

function computeOptimal(items, budget) {
  const dp = Array(budget + 1).fill(-1);
  dp[0] = 0;

  for (const item of items) {
    for (let copy = 0; copy < item.max; copy += 1) {
      for (let b = budget; b >= item.cost; b -= 1) {
        const prev = dp[b - item.cost];
        if (prev >= 0) {
          const candidate = prev + item.joy;
          if (candidate > dp[b]) {
            dp[b] = candidate;
          }
        }
      }
    }
  }

  return Math.max(...dp);
}

function setStatus(text, mood = '') {
  statusEl.textContent = text;
  statusEl.classList.remove('warn', 'good');
  if (mood) statusEl.classList.add(mood);
}

function updateHUD() {
  const { spent, hype } = currentTotals();
  roundStatEl.textContent = `${state.round} / ${TOTAL_ROUNDS}`;
  budgetStatEl.textContent = `${state.budget} tix`;
  spentStatEl.textContent = `${spent} tix`;
  hypeStatEl.textContent = hype;
  scoreStatEl.textContent = state.score;
  bestStatEl.textContent = state.best;
}

function makeRow(item) {
  const row = document.createElement('article');
  row.className = 'prize-card';
  row.setAttribute('role', 'listitem');

  const info = document.createElement('div');
  info.innerHTML = `<div class="prize-name">${item.name}</div><div class="prize-meta">${item.cost} tix · ${item.joy} hype · max ${item.max}</div>`;

  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'qty';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';

  const qtyValue = document.createElement('span');
  qtyValue.className = 'qty-value';
  qtyValue.textContent = '0';

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';

  minus.addEventListener('click', () => {
    if (state.locked) return;
    const q = state.choices.get(item.name) || 0;
    if (q <= 0) return;
    state.choices.set(item.name, q - 1);
    qtyValue.textContent = String(q - 1);
    beep(400, 0.06, 'square', 0.03);
    updateHUD();
  });

  plus.addEventListener('click', () => {
    if (state.locked) return;
    const q = state.choices.get(item.name) || 0;
    if (q >= item.max) {
      beep(160, 0.08, 'sawtooth', 0.03);
      return;
    }
    const { spent } = currentTotals();
    if (spent + item.cost > state.budget) {
      setStatus('Over budget blocked. Swap another prize out first.', 'warn');
      beep(180, 0.09, 'triangle', 0.03);
      return;
    }
    state.choices.set(item.name, q + 1);
    qtyValue.textContent = String(q + 1);
    beep(650, 0.06, 'square', 0.03);
    updateHUD();
  });

  qtyWrap.append(minus, qtyValue, plus);
  row.append(info, qtyWrap);
  return row;
}

function buildRound() {
  state.locked = false;
  state.shiftComplete = false;
  prizeListEl.innerHTML = '';
  state.choices.clear();

  const count = rng(6, 8);
  state.items = sample(catalog, count);
  state.budget = rng(1700, 3400);

  for (const item of state.items) {
    state.choices.set(item.name, 0);
    prizeListEl.appendChild(makeRow(item));
  }

  lockBtn.disabled = false;
  nextBtn.disabled = true;
  setStatus('Build your bundle, then lock your redemption pick.');
  updateHUD();
}

function closeRound() {
  if (state.locked) return;
  const { spent, hype } = currentTotals();
  if (spent <= 0) {
    setStatus('Pick at least one prize before locking.', 'warn');
    beep(170, 0.08, 'triangle');
    return;
  }

  const optimal = computeOptimal(state.items, state.budget);
  const ratio = Math.min(1, hype / optimal);
  const pct = Math.round(ratio * 100);

  let points = 35;
  if (pct >= 100) points = 140;
  else if (pct >= 97) points = 110;
  else if (pct >= 92) points = 85;
  else if (pct >= 84) points = 60;

  state.score += points;
  state.locked = true;
  lockBtn.disabled = true;
  nextBtn.disabled = false;

  const diff = optimal - hype;
  if (diff === 0) {
    setStatus(`Perfect counter run. ${hype}/${optimal} hype (${pct}%). +${points} points.`, 'good');
    beep(880, 0.08, 'square', 0.035);
    setTimeout(() => beep(1180, 0.11, 'square', 0.032), 90);
  } else {
    setStatus(`Nice pick: ${hype}/${optimal} hype (${pct}%). Left ${diff} hype on the shelf. +${points} points.`, pct >= 90 ? 'good' : 'warn');
    beep(pct >= 90 ? 720 : 300, 0.08, pct >= 90 ? 'square' : 'triangle', 0.03);
  }

  updateHUD();
}

function nextRound() {
  if (state.shiftComplete) {
    state.round = 1;
    state.score = 0;
    nextBtn.textContent = 'Next Round';
    buildRound();
    beep(610, 0.06, 'square', 0.028);
    return;
  }

  if (!state.locked) return;

  if (state.round >= TOTAL_ROUNDS) {
    const final = state.score;
    const wasBest = final > state.best;
    if (wasBest) {
      state.best = final;
      localStorage.setItem(BEST_KEY, String(state.best));
    }
    const grade = final >= 620 ? 'A+' : final >= 520 ? 'A' : final >= 430 ? 'B' : 'C';
    setStatus(`Shift complete. Final score ${final} (${grade}). ${wasBest ? 'New high score at the counter.' : 'Try another shift to beat your best.'}`, 'good');
    state.locked = false;
    state.shiftComplete = true;
    lockBtn.disabled = true;
    nextBtn.disabled = false;
    nextBtn.textContent = 'Restart Shift';
    updateHUD();
    beep(960, 0.09, 'square', 0.03);
    setTimeout(() => beep(1260, 0.12, 'square', 0.03), 95);
    return;
  }

  state.round += 1;
  buildRound();
  beep(610, 0.06, 'square', 0.028);
}

lockBtn.addEventListener('click', closeRound);
nextBtn.addEventListener('click', nextRound);
muteBtn.addEventListener('click', () => {
  state.muted = !state.muted;
  muteBtn.textContent = state.muted ? 'Unmute' : 'Mute';
  muteBtn.setAttribute('aria-pressed', String(state.muted));
  if (!state.muted) beep(520, 0.06, 'square', 0.025);
});

buildRound();
updateHUD();
