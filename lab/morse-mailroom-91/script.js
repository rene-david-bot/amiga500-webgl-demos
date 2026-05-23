const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..'
};

const WORD_BANK = [
  'BYTE', 'CACHE', 'CODE', 'DISK', 'FAX', 'GLITCH', 'LASER', 'MODEM', 'PACKET', 'PIXEL',
  'ROUTER', 'SIGNAL', 'STACK', 'STATIC', 'TERMINAL', 'TURBO', 'VECTOR', 'VOLT', 'WIRE', 'ZEROS'
];

const scoreEl = document.getElementById('score');
const roundEl = document.getElementById('round');
const livesEl = document.getElementById('lives');
const timeEl = document.getElementById('time');
const streakEl = document.getElementById('streak');
const statusEl = document.getElementById('status');
const morseReadoutEl = document.getElementById('morseReadout');
const lampEl = document.getElementById('lamp');

const startBtn = document.getElementById('startBtn');
const replayBtn = document.getElementById('replayBtn');
const skipBtn = document.getElementById('skipBtn');
const submitBtn = document.getElementById('submitBtn');
const guessForm = document.getElementById('guessForm');
const guessInput = document.getElementById('guessInput');

const state = {
  active: false,
  playing: false,
  round: 0,
  score: 0,
  streak: 0,
  lives: 3,
  currentWord: '',
  currentMorse: '',
  timeLeft: 0,
  timerId: null,
  audioCtx: null,
  usedWords: []
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(text) {
  return text.trim().toUpperCase().replace(/[^A-Z]/g, '');
}

function setStatus(message, kind = '') {
  statusEl.textContent = message;
  statusEl.classList.remove('ok', 'bad');
  if (kind) statusEl.classList.add(kind);
}

function updateHud() {
  scoreEl.textContent = state.score;
  roundEl.textContent = state.round;
  livesEl.textContent = state.lives;
  streakEl.textContent = state.streak;
  timeEl.textContent = state.active ? `${Math.max(0, state.timeLeft)}s` : '--';
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function flashLamp(on) {
  lampEl.classList.toggle('live', on);
}

function beep(durationMs) {
  if (!state.audioCtx) return;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.value = 760;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.02);
}

async function pulse(durationMs) {
  flashLamp(true);
  beep(durationMs);
  await sleep(durationMs);
  flashLamp(false);
}

async function playCurrentSignal() {
  if (!state.active || state.playing || !state.currentMorse) return;
  state.playing = true;
  replayBtn.disabled = true;
  skipBtn.disabled = true;

  for (const char of state.currentMorse) {
    if (!state.active) break;

    if (char === '.') {
      await pulse(110);
      await sleep(80);
    } else if (char === '-') {
      await pulse(280);
      await sleep(110);
    } else if (char === ' ') {
      await sleep(210);
    } else if (char === '/') {
      await sleep(340);
    }
  }

  flashLamp(false);
  state.playing = false;
  replayBtn.disabled = false;
  skipBtn.disabled = false;
}

function encodeWord(word) {
  return word
    .split('')
    .map((letter) => MORSE[letter])
    .join(' / ');
}

function nextWord() {
  const pool = WORD_BANK.filter((word) => !state.usedWords.includes(word));
  if (!pool.length) {
    state.usedWords = [];
    return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.usedWords.push(pick);
  return pick;
}

function setRoundTimer() {
  const base = 24;
  const decay = Math.floor(state.round / 2);
  state.timeLeft = Math.max(11, base - decay);
  updateHud();

  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.active) return;
    state.timeLeft -= 1;
    updateHud();

    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      failRound(`Timeout. Memo was ${state.currentWord}.`, true);
    }
  }, 1000);
}

async function startRound() {
  if (!state.active) return;
  state.round += 1;
  state.currentWord = nextWord();
  state.currentMorse = encodeWord(state.currentWord);

  guessInput.value = '';
  guessInput.disabled = false;
  submitBtn.disabled = false;
  replayBtn.disabled = false;
  skipBtn.disabled = false;

  morseReadoutEl.textContent = state.currentMorse;
  setRoundTimer();
  updateHud();
  setStatus(`Round ${state.round}: decode the memo.`, '');

  await playCurrentSignal();
  guessInput.focus();
}

function endGame() {
  state.active = false;
  state.playing = false;

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  flashLamp(false);

  guessInput.disabled = true;
  submitBtn.disabled = true;
  replayBtn.disabled = true;
  skipBtn.disabled = true;

  startBtn.disabled = false;
  startBtn.textContent = 'Restart Shift';
  timeEl.textContent = '--';

  setStatus(`Shift over. Final score ${state.score}. Press Restart Shift for another run.`, 'bad');
}

function rewardRound() {
  const bonus = Math.max(0, state.timeLeft) * 9;
  const streakBonus = state.streak * 24;
  const gained = 120 + bonus + streakBonus;

  state.score += gained;
  state.streak += 1;

  setStatus(`Correct: ${state.currentWord}. +${gained} points.`, 'ok');
  updateHud();

  setTimeout(() => {
    if (state.active) startRound();
  }, 560);
}

function failRound(message, timeout = false) {
  state.lives -= 1;
  state.streak = 0;
  if (!timeout) state.score = Math.max(0, state.score - 35);

  updateHud();

  if (state.lives <= 0) {
    setStatus(message, 'bad');
    endGame();
    return;
  }

  setStatus(`${message} ${state.lives} lives left.`, 'bad');
  setTimeout(() => {
    if (state.active) startRound();
  }, 620);
}

function startShift() {
  ensureAudio();

  state.active = true;
  state.playing = false;
  state.round = 0;
  state.score = 0;
  state.streak = 0;
  state.lives = 3;
  state.usedWords = [];

  startBtn.disabled = true;
  startBtn.textContent = 'Shift Running';

  updateHud();
  setStatus('Signal line opened. Incoming memo...', '');
  startRound();
}

function submitGuess(event) {
  event.preventDefault();
  if (!state.active || state.playing) return;

  const guess = normalize(guessInput.value);
  if (!guess) {
    setStatus('Type a word before submitting.', 'bad');
    return;
  }

  if (guess === state.currentWord) {
    rewardRound();
  } else {
    failRound(`Wrong decode (${guess}). Memo was ${state.currentWord}.`);
  }
}

startBtn.addEventListener('click', startShift);
replayBtn.addEventListener('click', () => {
  if (!state.active || state.playing) return;
  playCurrentSignal();
});

skipBtn.addEventListener('click', () => {
  if (!state.active || state.playing) return;
  failRound(`Skipped. Memo was ${state.currentWord}.`);
});

guessForm.addEventListener('submit', submitGuess);

guessInput.addEventListener('input', () => {
  guessInput.value = guessInput.value.toUpperCase().replace(/[^A-Z]/g, '');
});

updateHud();
