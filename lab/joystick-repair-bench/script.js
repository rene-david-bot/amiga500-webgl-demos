const CHANNELS = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'FIRE A', 'FIRE B'];
const TEST_SEQUENCE = [
  [0],
  [1],
  [2],
  [3],
  [4],
  [5],
  [0, 4],
  [3, 5]
];

const el = {
  boardId: document.getElementById('boardId'),
  actionsLeft: document.getElementById('actionsLeft'),
  elapsed: document.getElementById('elapsed'),
  bestTime: document.getElementById('bestTime'),
  diagBody: document.getElementById('diagBody'),
  swapA: document.getElementById('swapA'),
  swapB: document.getElementById('swapB'),
  replaceSel: document.getElementById('replaceSel'),
  cleanSel: document.getElementById('cleanSel'),
  swapBtn: document.getElementById('swapBtn'),
  replaceBtn: document.getElementById('replaceBtn'),
  cleanBtn: document.getElementById('cleanBtn'),
  newBoardBtn: document.getElementById('newBoardBtn'),
  scanBtn: document.getElementById('scanBtn'),
  log: document.getElementById('log'),
  audioToggle: document.getElementById('audioToggle')
};

const state = {
  mapping: [],
  dead: -1,
  noisy: -1,
  actions: 6,
  solved: false,
  startedAt: 0,
  elapsed: 0,
  timer: null,
  audioOn: false,
  audioCtx: null,
  bestTime: Number(localStorage.getItem('joystickRepairBest') || 0)
};

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function boardLabel() {
  const id = Math.floor(Math.random() * 900 + 100);
  const suffix = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `A500-${id}${suffix}`;
}

function beep(freq = 420, ms = 80, gain = 0.015, type = 'square') {
  if (!state.audioOn) return;
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = state.audioCtx.createOscillator();
    const amp = state.audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, state.audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, state.audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + ms / 1000);
    osc.connect(amp).connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    // optional audio
  }
}

function logLine(text, cls = '') {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.textContent = text;
  el.log.prepend(li);
  while (el.log.children.length > 8) {
    el.log.removeChild(el.log.lastChild);
  }
}

function formatSet(indices) {
  if (!indices.length) return '—';
  return indices.map(i => CHANNELS[i]).join(', ');
}

function updateHud() {
  el.actionsLeft.textContent = String(state.actions);
  el.elapsed.textContent = `${state.elapsed.toFixed(1)}s`;
  el.bestTime.textContent = state.bestTime > 0 ? `${state.bestTime.toFixed(1)}s` : '--';
}

function tickTimer() {
  if (state.solved) return;
  state.elapsed = (performance.now() - state.startedAt) / 1000;
  updateHud();
}

function setActionsEnabled(enabled) {
  [el.swapBtn, el.replaceBtn, el.cleanBtn].forEach(btn => {
    btn.disabled = !enabled || state.actions <= 0 || state.solved;
  });
}

function applyHarnessSwap(lineA, lineB) {
  state.mapping = state.mapping.map(line => {
    if (line === lineA) return lineB;
    if (line === lineB) return lineA;
    return line;
  });
}

function useAction(reason) {
  if (state.actions <= 0 || state.solved) return false;
  state.actions -= 1;
  logLine(reason, 'warn');
  updateHud();
  if (state.actions <= 0) {
    logLine('No actions left. Spin up a fresh board to try again.', 'err');
    beep(130, 180, 0.02, 'sawtooth');
  }
  setActionsEnabled(true);
  return true;
}

function simulateSignals(testIndices, stepIndex) {
  const observed = new Set();

  for (const source of testIndices) {
    const routed = state.mapping[source];
    if (routed !== state.dead) {
      observed.add(routed);
    }
  }

  const noisePattern = [1, 4, 7];
  if (state.noisy !== -1 && noisePattern.includes(stepIndex)) {
    observed.add(state.noisy);
  }

  return [...observed].sort((a, b) => a - b);
}

function runDiagnostics() {
  const rows = [];
  let passCount = 0;

  TEST_SEQUENCE.forEach((test, idx) => {
    const observed = simulateSignals(test, idx);
    const expectedSorted = [...test].sort((a, b) => a - b);
    const pass = observed.length === expectedSorted.length && observed.every((v, i) => v === expectedSorted[i]);

    if (pass) passCount += 1;

    rows.push(`
      <tr>
        <td>${idx + 1}</td>
        <td>${formatSet(expectedSorted)}</td>
        <td>${formatSet(observed)}</td>
        <td class="${pass ? 'status-pass' : 'status-fail'}">${pass ? 'PASS' : 'FAIL'}</td>
      </tr>
    `);
  });

  el.diagBody.innerHTML = rows.join('');

  const allPass = passCount === TEST_SEQUENCE.length;
  if (allPass && !state.solved) {
    state.solved = true;
    clearInterval(state.timer);
    state.elapsed = (performance.now() - state.startedAt) / 1000;
    if (!state.bestTime || state.elapsed < state.bestTime) {
      state.bestTime = state.elapsed;
      localStorage.setItem('joystickRepairBest', String(state.bestTime));
      logLine(`Board fixed in ${state.elapsed.toFixed(1)}s — new best time.`, 'ok');
    } else {
      logLine(`Board fixed in ${state.elapsed.toFixed(1)}s.`, 'ok');
    }
    beep(780, 100, 0.012, 'triangle');
    setTimeout(() => beep(980, 120, 0.012, 'triangle'), 120);
    setActionsEnabled(false);
  } else if (!allPass) {
    logLine(`Diagnostics: ${passCount}/${TEST_SEQUENCE.length} tests passing.`, 'warn');
    beep(260, 55, 0.009, 'square');
  }

  updateHud();
}

function fillSelect(select) {
  select.innerHTML = CHANNELS.map((name, idx) => `<option value="${idx}">${name}</option>`).join('');
}

function resetBoard() {
  state.mapping = CHANNELS.map((_, i) => i);
  const swapA = Math.floor(Math.random() * CHANNELS.length);
  let swapB = Math.floor(Math.random() * CHANNELS.length);
  while (swapB === swapA) swapB = Math.floor(Math.random() * CHANNELS.length);
  applyHarnessSwap(swapA, swapB);

  const availableForDead = CHANNELS.map((_, i) => i);
  state.dead = randomChoice(availableForDead);

  const noisyChoices = CHANNELS.map((_, i) => i).filter(i => i !== state.dead);
  state.noisy = randomChoice(noisyChoices);

  state.actions = 6;
  state.solved = false;
  state.startedAt = performance.now();
  state.elapsed = 0;

  clearInterval(state.timer);
  state.timer = setInterval(tickTimer, 100);

  el.boardId.textContent = boardLabel();
  el.diagBody.innerHTML = '';
  logLine('New board mounted. Run diagnostics to inspect faults.', 'ok');
  updateHud();
  setActionsEnabled(true);
}

function bindEvents() {
  fillSelect(el.swapA);
  fillSelect(el.swapB);
  fillSelect(el.replaceSel);
  fillSelect(el.cleanSel);

  el.swapBtn.addEventListener('click', () => {
    const a = Number(el.swapA.value);
    const b = Number(el.swapB.value);
    if (a === b) {
      logLine('Swap canceled: choose two different channels.', 'err');
      beep(150, 100, 0.012, 'sawtooth');
      return;
    }
    if (!useAction(`Swapped harness lines ${CHANNELS[a]} ↔ ${CHANNELS[b]}.`)) return;
    applyHarnessSwap(a, b);
    beep(520, 70, 0.011, 'triangle');
  });

  el.replaceBtn.addEventListener('click', () => {
    const target = Number(el.replaceSel.value);
    if (!useAction(`Replaced switch on ${CHANNELS[target]}.`)) return;

    if (state.dead === target) {
      state.dead = -1;
      logLine(`Dead switch fixed on ${CHANNELS[target]}.`, 'ok');
      beep(720, 90, 0.012, 'triangle');
    } else {
      logLine('Switch was healthy — action spent with no gain.', 'err');
      beep(170, 100, 0.013, 'sawtooth');
    }
  });

  el.cleanBtn.addEventListener('click', () => {
    const target = Number(el.cleanSel.value);
    if (!useAction(`Cleaned contact lane ${CHANNELS[target]}.`)) return;

    if (state.noisy === target) {
      state.noisy = -1;
      logLine(`Noise removed from ${CHANNELS[target]}.`, 'ok');
      beep(680, 90, 0.011, 'triangle');
    } else {
      logLine('No noise on that lane — solvent wasted.', 'err');
      beep(170, 100, 0.013, 'sawtooth');
    }
  });

  el.scanBtn.addEventListener('click', runDiagnostics);
  el.newBoardBtn.addEventListener('click', resetBoard);

  el.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    el.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) beep(520, 70, 0.012, 'triangle');
  });
}

function boot() {
  bindEvents();
  resetBoard();
  runDiagnostics();
}

boot();
