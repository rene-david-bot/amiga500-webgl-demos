const holeLabel = document.getElementById('holeLabel');
const currentValueEl = document.getElementById('currentValue');
const targetValueEl = document.getElementById('targetValue');
const parValueEl = document.getElementById('parValue');
const strokeValueEl = document.getElementById('strokeValue');
const maxValueEl = document.getElementById('maxValue');
const holeHintEl = document.getElementById('holeHint');
const statusLineEl = document.getElementById('statusLine');
const opPadEl = document.getElementById('opPad');
const scoreGridEl = document.getElementById('scoreGrid');
const totalLineEl = document.getElementById('totalLine');

const retryBtn = document.getElementById('retryBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');

const ops = {
  add2: { label: '+2', tone: 560, apply: (v) => v + 2 },
  add3: { label: '+3', tone: 600, apply: (v) => v + 3 },
  add5: { label: '+5', tone: 640, apply: (v) => v + 5 },
  sub1: { label: '-1', tone: 500, apply: (v) => v - 1 },
  sub4: { label: '-4', tone: 470, apply: (v) => v - 4 },
  mul2: { label: '×2', tone: 760, apply: (v) => v * 2 },
  mul3: { label: '×3', tone: 840, apply: (v) => v * 3 },
  div2: {
    label: '÷2',
    tone: 430,
    apply: (v) => (v % 2 === 0 ? v / 2 : null)
  },
  rev: {
    label: 'REV',
    tone: 690,
    apply: (v) => {
      const sign = v < 0 ? -1 : 1;
      const value = Number.parseInt(String(Math.abs(v)).split('').reverse().join(''), 10);
      return sign * value;
    }
  }
};

const holes = [
  { name: 'Warm-Up', start: 1, target: 16, par: 3, max: 6, hint: 'Quick doubles unlock this hole fast.', opIds: ['add3', 'mul2', 'sub1'] },
  { name: 'Food Court Bend', start: 4, target: 25, par: 4, max: 7, hint: 'Stay patient, then line up the final tap.', opIds: ['add3', 'mul2', 'sub1'] },
  { name: 'Copy Room Fade', start: 12, target: 7, par: 3, max: 6, hint: 'Drop before you divide.', opIds: ['sub4', 'div2', 'add5'] },
  { name: 'Mall Atrium Loop', start: 3, target: 81, par: 3, max: 6, hint: 'Pure multiplication pressure.', opIds: ['mul3', 'add2', 'sub1'] },
  { name: 'Pocket Pager', start: 18, target: 2, par: 4, max: 7, hint: 'Alternate cuts with clean even splits.', opIds: ['div2', 'sub4', 'add3'] },
  { name: 'Neon Stairwell', start: 7, target: 50, par: 6, max: 9, hint: 'REV can rescue dead ends.', opIds: ['mul2', 'add5', 'rev'] },
  { name: 'Office Tower 7', start: 21, target: 14, par: 4, max: 7, hint: 'You only need one divide, but at the right moment.', opIds: ['sub4', 'div2', 'add5'] },
  { name: 'CRT Overtime', start: 5, target: 41, par: 5, max: 8, hint: 'Build height first, then mirror.', opIds: ['mul3', 'add2', 'rev'] },
  { name: 'Final Ledger', start: 8, target: 64, par: 3, max: 6, hint: 'Finish strong. Keep it clean.', opIds: ['mul2', 'add3', 'sub1'] }
];

const state = {
  holeIndex: 0,
  value: 0,
  strokes: 0,
  solved: false,
  scores: holes.map(() => null),
  audio: null
};

function ensureAudio() {
  if (state.audio) return;
  state.audio = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq = 600, duration = 0.07, gain = 0.03, type = 'square') {
  if (!state.audio) return;
  const t = state.audio.currentTime;
  const osc = state.audio.createOscillator();
  const amp = state.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.connect(amp).connect(state.audio.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function formatRelative(delta) {
  if (delta === 0) return 'E';
  return delta > 0 ? `+${delta}` : String(delta);
}

function relativeLabel(delta) {
  if (delta <= -2) return 'Eagle vibes';
  if (delta === -1) return 'Birdie';
  if (delta === 0) return 'Par';
  if (delta === 1) return 'Bogey';
  return `${delta} over`;
}

function setStatus(text, tone = 'neutral') {
  statusLineEl.textContent = text;
  statusLineEl.classList.remove('ok', 'warn');
  if (tone === 'ok') statusLineEl.classList.add('ok');
  if (tone === 'warn') statusLineEl.classList.add('warn');
}

function renderOpPad() {
  const hole = holes[state.holeIndex];
  opPadEl.innerHTML = '';

  hole.opIds.forEach((opId) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'op-btn';
    btn.textContent = ops[opId].label;
    btn.addEventListener('click', () => swing(opId));
    opPadEl.append(btn);
  });
}

function renderScorecard() {
  scoreGridEl.innerHTML = '';

  holes.forEach((hole, index) => {
    const card = document.createElement('div');
    card.className = 'hole-card';

    if (index === state.holeIndex) card.classList.add('active');
    if (state.scores[index] !== null && state.scores[index] < 0) card.classList.add('done-under');
    if (state.scores[index] !== null && state.scores[index] > 0) card.classList.add('done-over');

    const num = document.createElement('div');
    num.className = 'n';
    num.textContent = `Hole ${index + 1}`;

    const par = document.createElement('div');
    par.className = 'p';
    par.textContent = `Par ${hole.par}`;

    const score = document.createElement('div');
    score.className = 's';
    score.textContent = state.scores[index] === null ? '—' : formatRelative(state.scores[index]);

    card.append(num, par, score);
    scoreGridEl.append(card);
  });

  const played = state.scores.filter((value) => value !== null);
  const total = played.reduce((sum, value) => sum + value, 0);
  const totalText = played.length ? formatRelative(total) : 'E';

  if (played.length === holes.length) {
    let verdict = 'Weekend hacker';
    if (total <= -5) verdict = 'Calculator legend';
    else if (total <= 0) verdict = 'Arcade club pro';
    else if (total >= 5) verdict = 'Needs fresh batteries';
    totalLineEl.textContent = `Final: ${totalText} · ${verdict}`;
  } else {
    totalLineEl.textContent = `Total so far: ${totalText} · Holes cleared: ${played.length}/${holes.length}`;
  }
}

function renderBoard() {
  const hole = holes[state.holeIndex];
  holeLabel.textContent = `${state.holeIndex + 1} / ${holes.length}`;
  currentValueEl.textContent = state.value;
  targetValueEl.textContent = hole.target;
  parValueEl.textContent = hole.par;
  strokeValueEl.textContent = state.strokes;
  maxValueEl.textContent = hole.max;
  holeHintEl.textContent = `${hole.name}: ${hole.hint}`;

  nextBtn.disabled = !state.solved;
  nextBtn.textContent = state.holeIndex === holes.length - 1 ? 'Finish Round' : 'Next Hole';
}

function loadHole(index) {
  state.holeIndex = index;
  state.value = holes[index].start;
  state.strokes = 0;
  state.solved = false;

  renderOpPad();
  renderBoard();
  renderScorecard();
  setStatus(`Hole ${index + 1} loaded. Hit ${holes[index].target} in ${holes[index].par} strokes for par.`);
}

function completeHole() {
  const hole = holes[state.holeIndex];
  const delta = state.strokes - hole.par;
  state.solved = true;
  state.scores[state.holeIndex] = delta;

  setStatus(`Hole clear in ${state.strokes} strokes (${relativeLabel(delta)}).`, 'ok');
  beep(1040, 0.09, 0.035, 'triangle');
  beep(1320, 0.1, 0.025, 'square');

  renderBoard();
  renderScorecard();
}

function swing(opId) {
  const hole = holes[state.holeIndex];
  if (state.solved) return;

  ensureAudio();

  const nextValue = ops[opId].apply(state.value);
  if (nextValue === null || Number.isNaN(nextValue) || Math.abs(nextValue) > 9999) {
    setStatus(`Invalid move for ${ops[opId].label}. Try another key.`, 'warn');
    beep(230, 0.08, 0.03, 'sawtooth');
    return;
  }

  state.value = nextValue;
  state.strokes += 1;
  beep(ops[opId].tone, 0.06, 0.028, 'square');

  if (state.value === hole.target) {
    completeHole();
    return;
  }

  if (state.strokes >= hole.max) {
    setStatus(`Max strokes reached. Retry this hole.`, 'warn');
    beep(210, 0.1, 0.03, 'sawtooth');
    renderBoard();
    return;
  }

  const diff = hole.target - state.value;
  const direction = diff > 0 ? 'below' : 'above';
  setStatus(`Current ${state.value}. You are ${Math.abs(diff)} ${direction} target.`);
  renderBoard();
}

function retryHole() {
  ensureAudio();
  if (state.scores[state.holeIndex] !== null) {
    state.scores[state.holeIndex] = null;
  }
  beep(480, 0.07, 0.028, 'triangle');
  loadHole(state.holeIndex);
}

function nextHole() {
  if (!state.solved) return;
  ensureAudio();

  if (state.holeIndex < holes.length - 1) {
    beep(740, 0.08, 0.03, 'triangle');
    loadHole(state.holeIndex + 1);
    return;
  }

  setStatus('Round complete. Tap Reset Round for another run.', 'ok');
  renderScorecard();
}

function resetRound() {
  ensureAudio();
  state.scores = holes.map(() => null);
  beep(560, 0.08, 0.028, 'triangle');
  loadHole(0);
}

retryBtn.addEventListener('click', retryHole);
nextBtn.addEventListener('click', nextHole);
resetBtn.addEventListener('click', resetRound);

document.addEventListener('pointerdown', ensureAudio, { once: true });

loadHole(0);
