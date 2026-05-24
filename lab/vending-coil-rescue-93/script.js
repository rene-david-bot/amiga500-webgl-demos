const MAX_SHIFT = 10;
const MACHINE_SLOTS = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4'
];

const ACTIONS = {
  tap: { release: [12, 20], tilt: [8, 14], pitch: 230 },
  kick: { release: [20, 32], tilt: [17, 28], pitch: 170 },
  slam: { release: [34, 48], tilt: [30, 46], pitch: 130 }
};

const shiftEl = document.getElementById('shift');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const streakEl = document.getElementById('streak');
const timerEl = document.getElementById('timer');
const orderEl = document.getElementById('order');
const difficultyEl = document.getElementById('difficulty');
const releaseFillEl = document.getElementById('releaseFill');
const tiltFillEl = document.getElementById('tiltFill');
const targetMarkEl = document.getElementById('targetMark');
const statusEl = document.getElementById('status');
const machineEl = document.getElementById('machine');

const startBtn = document.getElementById('startBtn');
const tapBtn = document.getElementById('tapBtn');
const kickBtn = document.getElementById('kickBtn');
const slamBtn = document.getElementById('slamBtn');

const state = {
  running: false,
  shift: 0,
  score: 0,
  lives: 3,
  streak: 0,
  timer: 0,
  release: 0,
  tilt: 0,
  targetRelease: 80,
  targetSlot: '',
  currentDifficulty: '',
  activeSlotEl: null,
  lockInput: false,
  timerInterval: null,
  decayInterval: null,
  audioCtx: null
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.classList.remove('ok', 'bad');
  if (kind) statusEl.classList.add(kind);
}

function updateHud() {
  shiftEl.textContent = `${state.shift} / ${MAX_SHIFT}`;
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  streakEl.textContent = String(state.streak);
  timerEl.textContent = state.running ? `${Math.max(0, state.timer)}s` : '--';

  releaseFillEl.style.width = `${Math.min(100, state.release)}%`;
  tiltFillEl.style.width = `${Math.min(100, state.tilt)}%`;
  targetMarkEl.style.left = `${Math.min(97, Math.max(3, state.targetRelease))}%`;
}

function buildMachine() {
  machineEl.innerHTML = '';

  MACHINE_SLOTS.forEach((slot) => {
    const cell = document.createElement('div');
    cell.className = 'slot';
    cell.dataset.slot = slot;
    cell.textContent = slot;
    machineEl.appendChild(cell);
  });
}

function clearSlotState() {
  machineEl.querySelectorAll('.slot').forEach((slot) => {
    slot.classList.remove('target', 'success', 'fail');
  });
}

function pickRoundProfile() {
  const slot = MACHINE_SLOTS[randInt(0, MACHINE_SLOTS.length - 1)];
  const hardness = randInt(0, 3);
  let targetRelease;
  let difficulty;

  if (hardness === 0) {
    targetRelease = randInt(58, 68);
    difficulty = 'Loose coil';
  } else if (hardness === 1) {
    targetRelease = randInt(69, 79);
    difficulty = 'Stubborn coil';
  } else if (hardness === 2) {
    targetRelease = randInt(80, 89);
    difficulty = 'Jammed lane';
  } else {
    targetRelease = randInt(90, 96);
    difficulty = 'Nightmare jam';
  }

  return { slot, targetRelease, difficulty };
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function synthTone(freq, duration = 0.12, gain = 0.08, type = 'square') {
  if (!state.audioCtx) return;

  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playActionFx(actionKey) {
  const action = ACTIONS[actionKey];
  synthTone(action.pitch, 0.08, 0.055);
  synthTone(action.pitch / 2, 0.12, 0.045, 'triangle');
}

function playSuccessFx() {
  synthTone(392, 0.08, 0.07, 'triangle');
  setTimeout(() => synthTone(523, 0.09, 0.08, 'triangle'), 90);
  setTimeout(() => synthTone(659, 0.12, 0.08, 'triangle'), 190);
}

function playFailFx() {
  synthTone(110, 0.16, 0.09, 'sawtooth');
  setTimeout(() => synthTone(82, 0.18, 0.08, 'sawtooth'), 120);
}

function stopIntervals() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.decayInterval) {
    clearInterval(state.decayInterval);
    state.decayInterval = null;
  }
}

function disableActionButtons(disabled) {
  tapBtn.disabled = disabled;
  kickBtn.disabled = disabled;
  slamBtn.disabled = disabled;
}

function startRound() {
  const profile = pickRoundProfile();

  state.release = 0;
  state.tilt = Math.max(0, Math.floor(state.tilt * 0.45));
  state.targetRelease = profile.targetRelease;
  state.targetSlot = profile.slot;
  state.currentDifficulty = profile.difficulty;
  state.timer = Math.max(7, 16 - Math.floor(state.shift / 2));
  state.lockInput = false;

  clearSlotState();
  state.activeSlotEl = machineEl.querySelector(`[data-slot="${state.targetSlot}"]`);
  if (state.activeSlotEl) {
    state.activeSlotEl.classList.add('target');
  }

  orderEl.textContent = `Order ${state.shift + 1}: free slot ${state.targetSlot}`;
  difficultyEl.textContent = `${state.currentDifficulty} · Target ${state.targetRelease}%`;
  setStatus('Keep thumping, but do not tilt the cabinet.', '');

  disableActionButtons(false);
  updateHud();
}

function successRound() {
  if (!state.running) return;

  state.lockInput = true;
  disableActionButtons(true);
  stopIntervals();

  state.shift += 1;
  state.streak += 1;

  const points = 130 + state.timer * 18 + state.streak * 24;
  state.score += points;

  if (state.activeSlotEl) {
    state.activeSlotEl.classList.remove('target');
    state.activeSlotEl.classList.add('success');
  }

  playSuccessFx();
  setStatus(`Snack dropped! +${points} points.`, 'ok');
  updateHud();

  if (state.shift >= MAX_SHIFT) {
    finishShift(true);
    return;
  }

  setTimeout(() => {
    if (!state.running) return;
    runIntervals();
    startRound();
  }, 720);
}

function failRound(reason) {
  if (!state.running) return;

  state.lockInput = true;
  disableActionButtons(true);
  stopIntervals();

  state.lives -= 1;
  state.streak = 0;

  if (state.activeSlotEl) {
    state.activeSlotEl.classList.remove('target');
    state.activeSlotEl.classList.add('fail');
  }

  playFailFx();
  setStatus(`${reason} ${state.lives > 0 ? `${state.lives} lives left.` : ''}`.trim(), 'bad');
  updateHud();

  if (state.lives <= 0) {
    finishShift(false);
    return;
  }

  setTimeout(() => {
    if (!state.running) return;
    runIntervals();
    startRound();
  }, 820);
}

function runIntervals() {
  stopIntervals();

  state.timerInterval = setInterval(() => {
    if (!state.running) return;
    state.timer -= 1;

    if (state.timer <= 0) {
      state.timer = 0;
      updateHud();
      failRound('Customer walked away.');
      return;
    }

    updateHud();
  }, 1000);

  state.decayInterval = setInterval(() => {
    if (!state.running) return;

    state.tilt = Math.max(0, state.tilt - randInt(4, 7));
    state.release = Math.max(0, state.release - randInt(1, 2));

    updateHud();
  }, 800);
}

function finishShift(won) {
  state.running = false;
  state.lockInput = true;
  stopIntervals();
  disableActionButtons(true);

  startBtn.disabled = false;
  startBtn.textContent = 'Restart Shift';
  timerEl.textContent = '--';

  if (won) {
    orderEl.textContent = 'Shift cleared';
    difficultyEl.textContent = 'Breakroom legend status unlocked';
    setStatus(`Perfect night. Final score ${state.score}.`, 'ok');
    playSuccessFx();
  } else {
    orderEl.textContent = 'Machine locked';
    difficultyEl.textContent = 'Security called the supervisor';
    setStatus(`Shift failed. Final score ${state.score}.`, 'bad');
  }
}

function performAction(actionKey) {
  if (!state.running || state.lockInput) return;

  const action = ACTIONS[actionKey];
  const releaseGain = randInt(action.release[0], action.release[1]);
  const tiltGain = randInt(action.tilt[0], action.tilt[1]);

  state.release = Math.min(100, state.release + releaseGain);
  state.tilt = Math.min(130, state.tilt + tiltGain);

  playActionFx(actionKey);

  if (state.activeSlotEl) {
    state.activeSlotEl.style.transform = `translateX(${randInt(-2, 2)}px)`;
    setTimeout(() => {
      if (state.activeSlotEl && !state.activeSlotEl.classList.contains('success')) {
        state.activeSlotEl.style.transform = '';
      }
    }, 90);
  }

  if (state.tilt >= 100) {
    updateHud();
    failRound('Tilt lockout triggered.');
    return;
  }

  if (state.release >= state.targetRelease) {
    updateHud();
    successRound();
    return;
  }

  setStatus(`${actionKey.toUpperCase()} landed: +${releaseGain}% release, +${tiltGain}% tilt.`, '');
  updateHud();
}

function startShift() {
  ensureAudio();

  state.running = true;
  state.shift = 0;
  state.score = 0;
  state.lives = 3;
  state.streak = 0;
  state.tilt = 0;
  state.release = 0;
  state.lockInput = false;

  startBtn.disabled = true;
  startBtn.textContent = 'Shift Running';

  runIntervals();
  startRound();
  updateHud();
}

startBtn.addEventListener('click', startShift);
tapBtn.addEventListener('click', () => performAction('tap'));
kickBtn.addEventListener('click', () => performAction('kick'));
slamBtn.addEventListener('click', () => performAction('slam'));

window.addEventListener('keydown', (event) => {
  if (!state.running) return;

  if (event.key === '1') performAction('tap');
  if (event.key === '2') performAction('kick');
  if (event.key === '3') performAction('slam');
});

buildMachine();
updateHud();
