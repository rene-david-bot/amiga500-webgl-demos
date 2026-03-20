const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const streakEl = document.getElementById('streak');
const strikesEl = document.getElementById('strikes');
const levelEl = document.getElementById('level');
const audioStateEl = document.getElementById('audioState');

const callNumberEl = document.getElementById('callNumber');
const callPrefixEl = document.getElementById('callPrefix');
const timerFillEl = document.getElementById('timerFill');

const ruleEls = [
  document.getElementById('rule1'),
  document.getElementById('rule2'),
  document.getElementById('rule3')
];

const lineButtons = [
  document.getElementById('line1'),
  document.getElementById('line2'),
  document.getElementById('line3')
];

const logList = document.getElementById('logList');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const audioBtn = document.getElementById('audioBtn');

const state = {
  score: 0,
  best: Number(localStorage.getItem('retro-switchboard-best') || 0),
  streak: 0,
  strikes: 0,
  level: 1,
  successCount: 0,
  running: false,
  currentCall: null,
  rules: [[], [], []],
  responseMs: 5200,
  callStartTs: 0,
  rafId: 0,
  audioCtx: null,
  audioReady: false,
  logs: []
};

bestEl.textContent = pad(state.best);
updateHud();
setRules(generateRules());

function pad(v) {
  return String(v).padStart(6, '0');
}

function addLog(text, kind = '') {
  const row = { text, kind };
  state.logs.unshift(row);
  if (state.logs.length > 6) state.logs.pop();

  logList.innerHTML = '';
  for (const item of state.logs) {
    const li = document.createElement('li');
    li.textContent = item.text;
    if (item.kind) li.classList.add(item.kind);
    logList.appendChild(li);
  }
}

function showOverlay(title, text, button = 'Start Shift') {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = button;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function updateHud() {
  scoreEl.textContent = pad(state.score);
  bestEl.textContent = pad(state.best);
  streakEl.textContent = String(state.streak);
  strikesEl.textContent = `${state.strikes} / 3`;
  levelEl.textContent = String(state.level);
  audioStateEl.textContent = state.audioReady ? 'ON' : 'OFF';
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRules() {
  const digits = shuffle(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 10)];
}

function setRules(newRules) {
  state.rules = newRules;
  state.rules.forEach((set, idx) => {
    ruleEls[idx].textContent = set.join(', ');
  });
}

function lineForPrefix(prefix) {
  const first = prefix[0];
  return state.rules.findIndex((set) => set.includes(first));
}

function randDigits(count) {
  let out = '';
  for (let i = 0; i < count; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}

function spawnCall() {
  const first = String(Math.floor(Math.random() * 10));
  const prefix = `${first}${randDigits(2)}`;
  const number = `${prefix}-${randDigits(4)}`;
  state.currentCall = { prefix, number, correctLine: lineForPrefix(prefix) };
  state.callStartTs = performance.now();

  callNumberEl.textContent = number;
  callPrefixEl.textContent = prefix;
}

function tone(freq, duration = 0.07, type = 'square', gain = 0.03) {
  if (!state.audioReady || !state.audioCtx) return;
  const now = state.audioCtx.currentTime;
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
  osc.stop(now + duration + 0.01);
}

async function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state !== 'running') {
    await state.audioCtx.resume();
  }
  state.audioReady = true;
  audioBtn.textContent = 'Audio Enabled';
  updateHud();
  tone(620, 0.08, 'triangle', 0.04);
}

function flashButton(index) {
  const btn = lineButtons[index];
  if (!btn) return;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 140);
}

function registerResult(chosenLine, timedOut = false) {
  if (!state.running || !state.currentCall) return;

  const { prefix, correctLine } = state.currentCall;
  const correct = !timedOut && chosenLine === correctLine;

  if (correct) {
    state.streak += 1;
    state.successCount += 1;
    const points = 120 + Math.max(0, state.streak - 1) * 35 + state.level * 10;
    state.score += points;
    if (state.score > state.best) state.best = state.score;
    state.responseMs = Math.max(2200, state.responseMs - 45);

    addLog(`✔ ${prefix} → Line ${correctLine + 1} (+${points})`, 'good');
    tone(520 + state.streak * 10, 0.06, 'square', 0.034);

    if (state.successCount % 8 === 0) {
      state.level += 1;
      setRules(generateRules());
      state.responseMs = Math.max(2000, state.responseMs - 90);
      addLog(`◆ Shift level ${state.level}: board remapped`, 'good');
      tone(900, 0.08, 'triangle', 0.04);
    }
  } else {
    state.strikes += 1;
    state.streak = 0;
    const reason = timedOut ? 'timeout' : `wrong line (needed ${correctLine + 1})`;
    addLog(`✖ ${prefix} ${reason}`, 'bad');
    tone(160, 0.12, 'sawtooth', 0.04);
  }

  updateHud();

  if (state.strikes >= 3) {
    endGame();
    return;
  }

  spawnCall();
}

function endGame() {
  state.running = false;
  cancelAnimationFrame(state.rafId);
  if (state.score > state.best) {
    state.best = state.score;
  }
  localStorage.setItem('retro-switchboard-best', String(state.best));
  updateHud();

  showOverlay(
    'Shift Complete',
    `Final score ${pad(state.score)} · reached level ${state.level}. Start again for a cleaner routing streak.`,
    'Run Another Shift'
  );
}

function loop(ts) {
  if (!state.running || !state.currentCall) return;

  const elapsed = ts - state.callStartTs;
  const ratio = Math.max(0, 1 - elapsed / state.responseMs);
  timerFillEl.style.transform = `scaleX(${ratio})`;

  if (ratio <= 0) {
    registerResult(-1, true);
  }

  state.rafId = requestAnimationFrame(loop);
}

function startGame() {
  state.score = 0;
  state.streak = 0;
  state.strikes = 0;
  state.level = 1;
  state.successCount = 0;
  state.responseMs = 5200;
  state.logs = [];
  setRules(generateRules());
  updateHud();
  addLog('Shift started — route by first prefix digit.');
  spawnCall();
  hideOverlay();
  state.running = true;
  state.rafId = requestAnimationFrame(loop);
}

lineButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    flashButton(index);
    registerResult(index, false);
  });
});

window.addEventListener('keydown', (event) => {
  if (event.key === '1' || event.key === '2' || event.key === '3') {
    const index = Number(event.key) - 1;
    flashButton(index);
    registerResult(index, false);
  }

  if (event.key.toLowerCase() === 'm') {
    ensureAudio();
  }
});

startBtn.addEventListener('click', () => {
  startGame();
});

audioBtn.addEventListener('click', async () => {
  await ensureAudio();
});

showOverlay(
  'Night Shift Ready',
  'Route calls with keys 1/2/3 (or tap buttons). Three misses and your shift is over.',
  'Start Shift'
);
