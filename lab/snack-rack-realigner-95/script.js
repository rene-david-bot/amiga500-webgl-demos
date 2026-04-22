const SIZE = 5;
const ICONS = [
  { emoji: '🍿', label: 'Popcorn' },
  { emoji: '🍫', label: 'Choco' },
  { emoji: '🥤', label: 'Soda' },
  { emoji: '🍪', label: 'Cookie' },
  { emoji: '🍬', label: 'Candy' },
];

const levelEl = document.getElementById('level');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const targetsEl = document.getElementById('targets');
const boardEl = document.getElementById('board');
const rowLeftEl = document.getElementById('rowLeft');
const rowRightEl = document.getElementById('rowRight');
const colUpEl = document.getElementById('colUp');
const colDownEl = document.getElementById('colDown');
const messageEl = document.getElementById('message');
const shuffleBtn = document.getElementById('shuffleBtn');
const nextBtn = document.getElementById('nextBtn');

const BEST_LEVEL_KEY = 'retro_snack_rack_best_level';
let bestLevel = Number(localStorage.getItem(BEST_LEVEL_KEY) || 1);

let board = [];
let level = 1;
let moves = 0;
let seconds = 0;
let score = 0;
let solved = false;
let timer = null;

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 520, duration = 0.06, type = 'square', gain = 0.028) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function formatTime(totalSeconds) {
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

function solvedBoard() {
  return Array.from({ length: SIZE }, () => ICONS.map((_, col) => col));
}

function shiftRow(index, dir) {
  const row = board[index];
  if (dir > 0) row.unshift(row.pop());
  else row.push(row.shift());
}

function shiftCol(index, dir) {
  const col = board.map((row) => row[index]);
  if (dir > 0) col.unshift(col.pop());
  else col.push(col.shift());
  for (let r = 0; r < SIZE; r += 1) {
    board[r][index] = col[r];
  }
}

function randomShift() {
  const axis = Math.random() < 0.5 ? 'row' : 'col';
  const idx = Math.floor(Math.random() * SIZE);
  const dir = Math.random() < 0.5 ? -1 : 1;
  if (axis === 'row') shiftRow(idx, dir);
  else shiftCol(idx, dir);
}

function isSolved() {
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] !== c) return false;
    }
  }
  return true;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function renderTargets() {
  targetsEl.innerHTML = '';
  ICONS.forEach((item) => {
    const target = document.createElement('div');
    target.className = 'target';
    target.innerHTML = `<span class="emoji">${item.emoji}</span><span class="label">${item.label}</span>`;
    targetsEl.appendChild(target);
  });
}

function renderControls() {
  rowLeftEl.innerHTML = '';
  rowRightEl.innerHTML = '';
  colUpEl.innerHTML = '';
  colDownEl.innerHTML = '';

  for (let i = 0; i < SIZE; i += 1) {
    const leftBtn = document.createElement('button');
    leftBtn.className = 'shift-btn';
    leftBtn.textContent = '◀';
    leftBtn.title = `Shift row ${i + 1} left`;
    leftBtn.disabled = solved;
    leftBtn.addEventListener('click', () => makeMove('row', i, -1));
    rowLeftEl.appendChild(leftBtn);

    const rightBtn = document.createElement('button');
    rightBtn.className = 'shift-btn';
    rightBtn.textContent = '▶';
    rightBtn.title = `Shift row ${i + 1} right`;
    rightBtn.disabled = solved;
    rightBtn.addEventListener('click', () => makeMove('row', i, 1));
    rowRightEl.appendChild(rightBtn);

    const upBtn = document.createElement('button');
    upBtn.className = 'shift-btn';
    upBtn.textContent = '▲';
    upBtn.title = `Shift column ${i + 1} up`;
    upBtn.disabled = solved;
    upBtn.addEventListener('click', () => makeMove('col', i, -1));
    colUpEl.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.className = 'shift-btn';
    downBtn.textContent = '▼';
    downBtn.title = `Shift column ${i + 1} down`;
    downBtn.disabled = solved;
    downBtn.addEventListener('click', () => makeMove('col', i, 1));
    colDownEl.appendChild(downBtn);
  }
}

function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = ICONS[board[r][c]].emoji;
      boardEl.appendChild(cell);
    }
  }

  boardEl.classList.toggle('solved', solved);
}

function renderHud() {
  levelEl.textContent = String(level);
  movesEl.textContent = String(moves);
  timeEl.textContent = formatTime(seconds);
  scoreEl.textContent = String(score).padStart(4, '0');
  bestEl.textContent = String(bestLevel);
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    seconds += 1;
    renderHud();
  }, 1000);
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function startLevel(newLevel = level) {
  level = newLevel;
  moves = 0;
  seconds = 0;
  solved = false;
  board = solvedBoard();

  const scrambleSteps = Math.min(56, 9 + level * 3);
  for (let i = 0; i < scrambleSteps; i += 1) {
    randomShift();
  }

  if (isSolved()) randomShift();

  nextBtn.disabled = true;
  setMessage(`Shift ${scrambleSteps} scramble lanes back into perfect vending columns.`);
  renderControls();
  renderBoard();
  renderHud();
  startTimer();
}

function completeLevel() {
  solved = true;
  stopTimer();

  const roundScore = Math.max(60, 260 - moves * 7 - seconds * 2 + level * 14);
  score += roundScore;

  if (level >= bestLevel) {
    bestLevel = level + 1;
    localStorage.setItem(BEST_LEVEL_KEY, String(bestLevel));
  }

  renderHud();
  renderControls();
  renderBoard();

  nextBtn.disabled = false;
  setMessage(`Rack realigned. +${roundScore} score. Ready for level ${level + 1}.`);

  initAudio();
  beep(620, 0.08, 'triangle', 0.03);
  beep(840, 0.09, 'square', 0.025);
  beep(1080, 0.1, 'triangle', 0.02);
}

function makeMove(axis, index, dir) {
  if (solved) return;

  initAudio();

  if (axis === 'row') shiftRow(index, dir);
  else shiftCol(index, dir);

  moves += 1;
  beep(axis === 'row' ? 420 : 520, 0.05, 'square', 0.025);

  if (isSolved()) {
    completeLevel();
  } else {
    renderBoard();
    renderHud();
  }
}

shuffleBtn.addEventListener('click', () => {
  initAudio();
  beep(300, 0.06, 'sawtooth', 0.024);
  startLevel(level);
});

nextBtn.addEventListener('click', () => {
  initAudio();
  beep(730, 0.07, 'triangle', 0.028);
  startLevel(level + 1);
});

renderTargets();
startLevel(1);
