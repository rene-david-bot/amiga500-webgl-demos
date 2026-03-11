const el = {
  currentBits: document.getElementById('currentBits'),
  targetBits: document.getElementById('targetBits'),
  currentHex: document.getElementById('currentHex'),
  targetHex: document.getElementById('targetHex'),
  level: document.getElementById('level'),
  moves: document.getElementById('moves'),
  score: document.getElementById('score'),
  streak: document.getElementById('streak'),
  feed: document.getElementById('feed'),
  newRound: document.getElementById('newRound'),
  audioToggle: document.getElementById('audioToggle'),
  opButtons: [...document.querySelectorAll('[data-op]')]
};

const state = {
  current: 0,
  target: 0,
  level: 1,
  movesLeft: 6,
  score: 0,
  streak: 0,
  roundOver: false,
  audioOn: false,
  audioCtx: null
};

const operationMap = {
  xor0f: {
    label: 'XOR 0x0F',
    run: value => value ^ 0x0f
  },
  xorf0: {
    label: 'XOR 0xF0',
    run: value => value ^ 0xf0
  },
  rol: {
    label: 'ROL 1',
    run: value => ((value << 1) | (value >> 7)) & 0xff
  },
  ror: {
    label: 'ROR 1',
    run: value => ((value >> 1) | ((value & 1) << 7)) & 0xff
  },
  not: {
    label: 'NOT',
    run: value => (~value) & 0xff
  },
  inc: {
    label: '+1',
    run: value => (value + 1) & 0xff
  },
  dec: {
    label: '-1',
    run: value => (value - 1 + 256) & 0xff
  }
};

const keyOps = ['xor0f', 'xorf0', 'rol', 'ror', 'not', 'inc', 'dec'];

function randomByte() {
  return Math.floor(Math.random() * 256);
}

function toBits(value) {
  return value.toString(2).padStart(8, '0');
}

function toHex(value) {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 440, ms = 70, gain = 0.016, type = 'square') {
  if (!state.audioOn) return;
  try {
    ensureAudio();
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
    // optional audio only
  }
}

function pushFeed(text, type = '') {
  const item = document.createElement('li');
  item.textContent = text;
  if (type) item.classList.add(type);
  el.feed.prepend(item);

  while (el.feed.children.length > 9) {
    el.feed.removeChild(el.feed.lastChild);
  }
}

function updateUI() {
  el.currentBits.textContent = toBits(state.current);
  el.targetBits.textContent = toBits(state.target);
  el.currentHex.textContent = toHex(state.current);
  el.targetHex.textContent = toHex(state.target);
  el.level.textContent = state.level;
  el.moves.textContent = state.movesLeft;
  el.score.textContent = state.score;
  el.streak.textContent = state.streak;
}

function setOpsDisabled(disabled) {
  el.opButtons.forEach(button => {
    button.disabled = disabled;
  });
}

function startRound() {
  state.roundOver = false;
  state.movesLeft = Math.max(4, 7 - Math.floor((state.level - 1) / 2));
  state.current = randomByte();

  do {
    state.target = randomByte();
  } while (state.target === state.current);

  updateUI();
  setOpsDisabled(false);
  pushFeed(`Round ${state.level}: transform ${toHex(state.current)} → ${toHex(state.target)}.`);
}

function winRound() {
  state.roundOver = true;
  const bonus = 55 + state.level * 8 + state.movesLeft * 14;
  state.score += bonus;
  state.streak += 1;
  pushFeed(`Linked! +${bonus} pts (${state.movesLeft} moves left).`, 'good');
  beep(880, 120, 0.02, 'triangle');
  setOpsDisabled(true);

  state.level += 1;
  updateUI();

  setTimeout(() => {
    startRound();
  }, 700);
}

function loseRound() {
  state.roundOver = true;
  state.streak = 0;
  const penalty = Math.min(40, Math.floor(state.score * 0.12));
  state.score = Math.max(0, state.score - penalty);
  pushFeed(`Link failed. Signal dropped. -${penalty} pts.`, 'danger');
  beep(140, 180, 0.02, 'sawtooth');
  setOpsDisabled(true);
  updateUI();

  setTimeout(() => {
    startRound();
  }, 900);
}

function applyOperation(opKey) {
  if (state.roundOver || state.movesLeft <= 0) return;

  const operation = operationMap[opKey];
  if (!operation) return;

  state.current = operation.run(state.current);
  state.movesLeft -= 1;

  pushFeed(`${operation.label} → ${toHex(state.current)} (${toBits(state.current)})`);
  beep(230 + (state.current / 255) * 450, 65, 0.012);
  updateUI();

  if (state.current === state.target) {
    winRound();
    return;
  }

  if (state.movesLeft <= 0) {
    loseRound();
    return;
  }

  const diffBits = (state.current ^ state.target).toString(2).split('1').length - 1;
  if (diffBits <= 2) {
    pushFeed(`Hot! Only ${diffBits} bit${diffBits === 1 ? '' : 's'} away.`, 'warn');
  }
}

function initEvents() {
  el.opButtons.forEach(button => {
    button.addEventListener('click', () => {
      applyOperation(button.dataset.op);
    });
  });

  el.newRound.addEventListener('click', () => {
    pushFeed('Manual reset requested.', 'warn');
    beep(300, 80, 0.012);
    startRound();
  });

  el.audioToggle.addEventListener('click', () => {
    state.audioOn = !state.audioOn;
    el.audioToggle.textContent = `Audio: ${state.audioOn ? 'On' : 'Off'}`;
    if (state.audioOn) {
      beep(540, 80, 0.012, 'triangle');
      pushFeed('Beep bus online.', 'good');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.repeat) return;

    const n = Number(event.key);
    if (n >= 1 && n <= keyOps.length) {
      applyOperation(keyOps[n - 1]);
    }

    if (event.key.toLowerCase() === 'r') {
      startRound();
    }
  });
}

function boot() {
  initEvents();
  pushFeed('Byte-Lab firmware v1.3 booted.');
  pushFeed('Keys 1-7 = operations · R = reset target.');
  startRound();
}

boot();
