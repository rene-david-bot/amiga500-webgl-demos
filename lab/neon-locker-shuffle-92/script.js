const GRID = 5;
const START_TIME = 90;
const STORAGE_KEY = 'neonLockerShuffle92Best';

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const levelEl = document.getElementById('level');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const parEl = document.getElementById('par');
const hintsEl = document.getElementById('hints');

const startBtn = document.getElementById('startBtn');
const hintBtn = document.getElementById('hintBtn');
const muteBtn = document.getElementById('muteBtn');

const lockerButtons = [];
let audioCtx = null;
let muted = false;
let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);

const state = {
  active: false,
  level: 1,
  score: 0,
  moves: 0,
  par: 14,
  hintsLeft: 3,
  timeLeft: START_TIME,
  board: Array(GRID * GRID).fill(1),
  hintIndex: -1,
  tickId: null
};

bestEl.textContent = String(bestScore);
buildBoard();
render();
setStatus('Press Start Shift to generate a scramble. Goal: open every locker.');

startBtn.addEventListener('click', () => {
  if (state.active) {
    endShift('Shift aborted. Board reset for a clean retry.', false);
    return;
  }
  startShift();
});

hintBtn.addEventListener('click', () => {
  if (!state.active || state.hintsLeft <= 0) return;
  const solution = findSolution(state.board);
  if (!solution || solution.length === 0) {
    setStatus('No hint needed. This board is already clear.');
    return;
  }

  state.hintsLeft -= 1;
  state.hintIndex = solution[0];
  flashHint(solution[0]);
  setStatus(`Hint: tap locker ${labelFor(solution[0])}.`);
  playTone(510, 0.08, 'triangle', 0.03);
  render();
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});

function buildBoard() {
  for (let i = 0; i < GRID * GRID; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'locker';
    btn.setAttribute('role', 'gridcell');
    btn.dataset.index = String(i);
    btn.addEventListener('click', () => handlePress(i));
    boardEl.appendChild(btn);
    lockerButtons.push(btn);
  }
}

function startShift() {
  ensureAudio();
  state.active = true;
  state.level = 1;
  state.score = 0;
  state.hintsLeft = 3;
  state.timeLeft = START_TIME;
  setupLevel();

  startBtn.textContent = 'Abort Shift';
  hintBtn.disabled = false;
  if (state.tickId) clearInterval(state.tickId);
  state.tickId = setInterval(tick, 1000);

  playTone(340, 0.08, 'square', 0.03);
  playTone(520, 0.08, 'square', 0.03, 0.08);
}

function setupLevel() {
  state.moves = 0;
  state.hintIndex = -1;
  state.par = 12 + state.level * 2;
  state.board = Array(GRID * GRID).fill(1);

  const scrambleMoves = 7 + state.level * 2;
  for (let i = 0; i < scrambleMoves; i += 1) {
    const idx = Math.floor(Math.random() * GRID * GRID);
    flipCross(state.board, idx);
  }

  if (isSolved(state.board)) {
    flipCross(state.board, Math.floor(Math.random() * GRID * GRID));
  }

  setStatus(`Level ${state.level}: clear the locker wall in ${state.par} moves or less for bonus.`);
  render();
}

function handlePress(index) {
  if (!state.active) return;

  flipCross(state.board, index);
  state.moves += 1;
  state.hintIndex = -1;

  const solved = isSolved(state.board);
  playTone(solved ? 690 : 250 + ((index % GRID) * 36), solved ? 0.12 : 0.06, solved ? 'triangle' : 'square', 0.025);

  if (solved) {
    clearLevel();
  }

  render();
}

function clearLevel() {
  const parDelta = Math.max(0, state.par - state.moves);
  const levelScore = 130 + (state.level * 45) + (parDelta * 22);
  const timeBonus = 4 + Math.min(9, parDelta);

  state.score += levelScore;
  state.timeLeft = Math.min(120, state.timeLeft + timeBonus);
  state.level += 1;

  playTone(470, 0.1, 'triangle', 0.035);
  playTone(610, 0.1, 'triangle', 0.035, 0.1);
  playTone(790, 0.14, 'triangle', 0.04, 0.22);

  if (state.level > 12) {
    endShift(`Perfect run! You cleared all 12 levels. Final score: ${state.score}.`, true);
    return;
  }

  setStatus(`Level clear! +${levelScore} score, +${timeBonus}s bonus. Get ready for level ${state.level}.`);
  setupLevel();
}

function endShift(message, completed) {
  state.active = false;
  startBtn.textContent = 'Start Shift';
  hintBtn.disabled = true;

  if (state.tickId) {
    clearInterval(state.tickId);
    state.tickId = null;
  }

  state.hintIndex = -1;

  if (state.score > bestScore) {
    bestScore = state.score;
    localStorage.setItem(STORAGE_KEY, String(bestScore));
  }

  if (!completed) {
    playTone(220, 0.15, 'sawtooth', 0.04);
    playTone(170, 0.16, 'sawtooth', 0.04, 0.12);
  }

  setStatus(message);
  render();
}

function tick() {
  if (!state.active) return;

  state.timeLeft -= 1;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endShift(`Shift over. Final score: ${state.score}. Highest level: ${state.level}.`, true);
    return;
  }

  if (state.timeLeft <= 12) {
    playTone(790, 0.03, 'square', 0.015);
  }

  render();
}

function flipCross(board, index) {
  const row = Math.floor(index / GRID);
  const col = index % GRID;

  toggle(board, row, col);
  toggle(board, row - 1, col);
  toggle(board, row + 1, col);
  toggle(board, row, col - 1);
  toggle(board, row, col + 1);
}

function toggle(board, row, col) {
  if (row < 0 || row >= GRID || col < 0 || col >= GRID) return;
  const idx = row * GRID + col;
  board[idx] = board[idx] ? 0 : 1;
}

function isSolved(board) {
  return board.every((cell) => cell === 1);
}

function render() {
  levelEl.textContent = String(state.level);
  movesEl.textContent = String(state.moves);
  timeEl.textContent = `${state.timeLeft}s`;
  bestEl.textContent = String(bestScore);
  parEl.textContent = String(state.par);
  hintsEl.textContent = String(state.hintsLeft);

  lockerButtons.forEach((btn, idx) => {
    const open = state.board[idx] === 1;
    btn.classList.toggle('open', open);
    btn.classList.toggle('hint', state.hintIndex === idx);
    btn.disabled = !state.active;
    btn.textContent = open ? 'OPEN' : 'LOCK';
    btn.setAttribute('aria-label', `Locker ${labelFor(idx)} ${open ? 'open' : 'locked'}`);
  });
}

function labelFor(index) {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function findSolution(board) {
  const target = board.slice();
  let best = null;

  for (let mask = 0; mask < (1 << GRID); mask += 1) {
    const work = target.slice();
    const presses = [];

    for (let c = 0; c < GRID; c += 1) {
      if ((mask >> c) & 1) {
        const idx = c;
        presses.push(idx);
        flipCross(work, idx);
      }
    }

    for (let r = 1; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const above = (r - 1) * GRID + c;
        if (work[above] === 0) {
          const idx = r * GRID + c;
          presses.push(idx);
          flipCross(work, idx);
        }
      }
    }

    const solved = work.slice((GRID - 1) * GRID).every((cell) => cell === 1);
    if (solved && (!best || presses.length < best.length)) {
      best = presses;
    }
  }

  return best;
}

function flashHint(index) {
  state.hintIndex = index;
  render();
  setTimeout(() => {
    if (!state.active) return;
    state.hintIndex = -1;
    render();
  }, 900);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'square', gain = 0.03, delay = 0) {
  if (muted || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  const now = audioCtx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}
