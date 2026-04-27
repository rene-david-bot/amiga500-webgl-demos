const BEST_KEY = 'retro_cash_register_change_jam_best';
const MAX_ROUNDS = 10;

const DENOMS = [
  { cents: 5000, label: '€50', kind: 'Bill' },
  { cents: 2000, label: '€20', kind: 'Bill' },
  { cents: 1000, label: '€10', kind: 'Bill' },
  { cents: 500, label: '€5', kind: 'Bill' },
  { cents: 200, label: '€2', kind: 'Coin' },
  { cents: 100, label: '€1', kind: 'Coin' },
  { cents: 50, label: '50c', kind: 'Coin' },
  { cents: 20, label: '20c', kind: 'Coin' },
  { cents: 10, label: '10c', kind: 'Coin' },
  { cents: 5, label: '5c', kind: 'Coin' }
];

const totalEl = document.getElementById('total');
const paidEl = document.getElementById('paid');
const dueEl = document.getElementById('due');
const trayEl = document.getElementById('tray');
const timerBarEl = document.getElementById('timerBar');
const statusEl = document.getElementById('status');

const roundEl = document.getElementById('round');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const bestEl = document.getElementById('best');

const drawerEl = document.getElementById('drawer');

const startBtn = document.getElementById('startBtn');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const undoBtn = document.getElementById('undoBtn');
const muteBtn = document.getElementById('muteBtn');

let audioCtx = null;
let muted = false;

let running = false;
let round = 0;
let score = 0;
let streak = 0;
let best = Number(localStorage.getItem(BEST_KEY) || 0);

let total = 0;
let paid = 0;
let due = 0;
let tray = 0;

let history = [];

let roundDuration = 0;
let roundStartTs = 0;
let timerId = null;

function euros(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateHud() {
  totalEl.textContent = euros(total);
  paidEl.textContent = euros(paid);
  dueEl.textContent = euros(due);
  trayEl.textContent = euros(tray);
  roundEl.textContent = `${round} / ${MAX_ROUNDS}`;
  scoreEl.textContent = String(score).padStart(4, '0');
  streakEl.textContent = String(streak);
  bestEl.textContent = String(best).padStart(4, '0');
}

function setStatus(text) {
  statusEl.textContent = text;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 440, dur = 0.08, type = 'square', gainValue = 0.03, start = 0) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function buildDrawer() {
  const frag = document.createDocumentFragment();
  for (const denom of DENOMS) {
    const btn = document.createElement('button');
    btn.className = 'denom';
    btn.type = 'button';
    btn.dataset.cents = String(denom.cents);
    btn.innerHTML = `${denom.label}<small>${denom.kind}</small>`;
    btn.addEventListener('click', () => addDenomination(denom.cents));
    frag.append(btn);
  }
  drawerEl.append(frag);
}

function addDenomination(cents) {
  if (!running) return;
  tray += cents;
  history.push(cents);
  updateHud();
  beep(620, 0.04, 'triangle', 0.018);
}

function clearTray() {
  if (!running) return;
  tray = 0;
  history = [];
  updateHud();
  beep(260, 0.05, 'sawtooth', 0.018);
}

function undoLast() {
  if (!running || history.length === 0) return;
  const last = history.pop();
  tray = Math.max(0, tray - last);
  updateHud();
  beep(300, 0.03, 'triangle', 0.018);
}

function samplePaid(totalCents) {
  const tenders = [500, 1000, 2000, 5000, 10000];
  const valid = tenders.filter((v) => v >= totalCents);
  const pick = valid[randInt(0, valid.length - 1)];

  if (Math.random() < 0.18) {
    const near = Math.ceil(totalCents / 100) * 100;
    return Math.max(near, valid[0]);
  }

  return pick;
}

function nextRound() {
  round += 1;

  if (round > MAX_ROUNDS) {
    finishShift(true);
    return;
  }

  tray = 0;
  history = [];

  total = randInt(149, 3899);
  paid = samplePaid(total);
  due = paid - total;

  roundDuration = Math.max(10, 22 - (round - 1));
  roundStartTs = performance.now();

  setStatus(`Round ${round}: build exact change before the queue gets angry.`);
  updateHud();
  updateTimer();

  beep(430, 0.05, 'square', 0.02);
  beep(560, 0.07, 'triangle', 0.02, 0.05);
}

function updateTimer() {
  if (!running) return;

  const elapsed = (performance.now() - roundStartTs) / 1000;
  const left = Math.max(0, roundDuration - elapsed);
  const ratio = left / roundDuration;

  timerBarEl.style.width = `${Math.max(0, ratio * 100)}%`;

  if (ratio > 0.5) {
    timerBarEl.style.background = 'linear-gradient(90deg, #6cf6ff, #84ffcf)';
  } else if (ratio > 0.25) {
    timerBarEl.style.background = 'linear-gradient(90deg, #ffd98a, #ffad7c)';
  } else {
    timerBarEl.style.background = 'linear-gradient(90deg, #ff8bbf, #ff6f91)';
  }

  if (left <= 0) {
    streak = 0;
    score = Math.max(0, score - 60);
    updateHud();
    setStatus('Too slow. Customer bailed.');
    beep(180, 0.12, 'sawtooth', 0.03);
    beep(130, 0.13, 'triangle', 0.03, 0.08);
    setTimeout(nextRound, 900);
  }
}

function submitChange() {
  if (!running) return;

  const delta = tray - due;
  if (delta === 0) {
    const elapsed = (performance.now() - roundStartTs) / 1000;
    const left = Math.max(0, roundDuration - elapsed);
    const bonus = 110 + Math.floor(left * 7) + streak * 20;
    score += bonus;
    streak += 1;
    setStatus(`Perfect! +${bonus} pts. Lane flowing.`);
    beep(620, 0.07, 'square', 0.03);
    beep(780, 0.09, 'triangle', 0.028, 0.08);

    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }

    updateHud();
    setTimeout(nextRound, 720);
    return;
  }

  streak = 0;
  score = Math.max(0, score - 35);

  if (delta < 0) {
    setStatus(`Short by ${euros(Math.abs(delta))}. Add more change.`);
    beep(220, 0.07, 'sawtooth', 0.024);
  } else {
    setStatus(`Over by ${euros(delta)}. Clear or undo tray.`);
    beep(200, 0.08, 'sawtooth', 0.024);
  }

  roundStartTs -= 2000;
  updateHud();
}

function finishShift(completed) {
  running = false;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }

  timerBarEl.style.width = '0%';

  if (completed) {
    setStatus(`Shift complete. Final score ${score}. Tap Start Shift for another rush.`);
    beep(520, 0.1, 'triangle', 0.03);
    beep(680, 0.1, 'square', 0.03, 0.1);
    beep(840, 0.12, 'triangle', 0.03, 0.2);
  } else {
    setStatus(`Shift ended. Final score ${score}. Tap Start Shift to retry.`);
  }

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  updateHud();
}

function startShift() {
  initAudio();

  if (timerId) clearInterval(timerId);

  running = true;
  round = 0;
  score = 0;
  streak = 0;
  total = 0;
  paid = 0;
  due = 0;
  tray = 0;
  history = [];

  updateHud();
  timerBarEl.style.width = '100%';
  timerBarEl.style.background = 'linear-gradient(90deg, #6cf6ff, #84ffcf)';

  nextRound();

  timerId = setInterval(() => {
    if (running) updateTimer();
  }, 90);
}

startBtn.addEventListener('click', startShift);
submitBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  submitChange();
});
clearBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  clearTray();
});
undoBtn.addEventListener('click', () => {
  if (!audioCtx) initAudio();
  undoLast();
});
muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitChange();
  }
  if (event.key.toLowerCase() === 'c') {
    event.preventDefault();
    clearTray();
  }
  if (event.key.toLowerCase() === 'u') {
    event.preventDefault();
    undoLast();
  }
});

buildDrawer();
updateHud();
