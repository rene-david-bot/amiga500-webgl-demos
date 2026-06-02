const timeLabel = document.getElementById('timeLabel');
const scoreLabel = document.getElementById('scoreLabel');
const qualityLabel = document.getElementById('qualityLabel');
const heatLabel = document.getElementById('heatLabel');
const strikesLabel = document.getElementById('strikesLabel');

const focusInput = document.getElementById('focusInput');
const lampInput = document.getElementById('lampInput');
const focusFill = document.getElementById('focusFill');
const lampFill = document.getElementById('lampFill');
const heatFill = document.getElementById('heatFill');

const focusTarget = document.getElementById('focusTarget');
const lampTarget = document.getElementById('lampTarget');
const focusHint = document.getElementById('focusHint');
const lampHint = document.getElementById('lampHint');
const heatHint = document.getElementById('heatHint');

const statusLabel = document.getElementById('statusLabel');
const logList = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const audioBtn = document.getElementById('audioBtn');

const state = {
  running: false,
  timeLeft: 75,
  score: 0,
  quality: 0,
  heat: 18,
  strikes: 0,
  focus: 50,
  lamp: 50,
  targetFocus: 50,
  targetLamp: 50,
  targetTimer: 0,
  badWindow: 0,
  ticker: 0,
  audioEnabled: false,
  audioCtx: null,
  lastTick: performance.now()
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rnd(min, max) {
  return Math.random() * (max - min) + min;
}

function addLog(text, kind = 'neutral') {
  const li = document.createElement('li');
  li.textContent = text;
  if (kind === 'good') li.classList.add('good');
  if (kind === 'bad') li.classList.add('bad');
  logList.prepend(li);
  while (logList.children.length > 12) {
    logList.removeChild(logList.lastChild);
  }
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function ensureAudio() {
  if (state.audioCtx) return;
  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq = 700, duration = 0.08, gain = 0.03, type = 'square') {
  if (!state.audioEnabled) return;
  ensureAudio();
  const t = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(amp).connect(state.audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function updateHud() {
  timeLabel.textContent = `${Math.max(0, state.timeLeft).toFixed(0)}s`;
  scoreLabel.textContent = `${Math.max(0, Math.floor(state.score))}`;
  qualityLabel.textContent = `${Math.max(0, Math.round(state.quality))}%`;
  heatLabel.textContent = `${Math.round(state.heat)}%`;
  strikesLabel.textContent = `${state.strikes} / 3`;

  focusFill.style.width = `${state.focus}%`;
  lampFill.style.width = `${state.lamp}%`;
  heatFill.style.width = `${clamp(state.heat, 0, 100)}%`;

  focusTarget.style.setProperty('--target-pos', `${state.targetFocus}%`);
  lampTarget.style.setProperty('--target-pos', `${state.targetLamp}%`);

  focusInput.value = `${state.focus}`;
  lampInput.value = `${state.lamp}`;
}

function evaluateHints(focusError, lampError) {
  if (focusError < 7) {
    focusHint.textContent = 'Sharp';
  } else if (state.focus < state.targetFocus) {
    focusHint.textContent = 'Too soft';
  } else {
    focusHint.textContent = 'Too harsh';
  }

  if (lampError < 7) {
    lampHint.textContent = 'Balanced';
  } else if (state.lamp < state.targetLamp) {
    lampHint.textContent = 'Too dim';
  } else {
    lampHint.textContent = 'Too bright';
  }

  if (state.heat < 45) {
    heatHint.textContent = 'Nominal';
  } else if (state.heat < 75) {
    heatHint.textContent = 'Warm';
  } else {
    heatHint.textContent = 'Critical';
  }
}

function changeTargets() {
  state.targetFocus = clamp(state.targetFocus + rnd(-22, 22), 12, 88);
  state.targetLamp = clamp(state.targetLamp + rnd(-20, 20), 14, 86);
  state.targetTimer = rnd(3.8, 6.2);
  addLog('Reel splice hit. Projection profile shifted.');
  beep(420, 0.05, 0.02, 'triangle');
}

function strike(reason) {
  state.strikes += 1;
  state.badWindow = 0;
  state.quality = 32;
  addLog(`Strike ${state.strikes}: ${reason}`, 'bad');
  setStatus(`⚠️ ${reason}`);
  beep(180, 0.14, 0.036, 'sawtooth');

  state.targetFocus = clamp(rnd(24, 76), 0, 100);
  state.targetLamp = clamp(rnd(24, 76), 0, 100);

  if (state.strikes >= 3) {
    endRun('Projection booth closed after 3 strikes.');
  }
}

function startRun() {
  state.running = true;
  state.timeLeft = 75;
  state.score = 0;
  state.quality = 75;
  state.heat = 18;
  state.strikes = 0;
  state.focus = 50;
  state.lamp = 50;
  state.targetFocus = 50;
  state.targetLamp = 50;
  state.badWindow = 0;
  state.ticker = 0;
  state.targetTimer = 1.8;

  logList.innerHTML = '';
  addLog('Screening started. Main hall packed.', 'good');
  setStatus('Keep focus and lamp aligned with the white target marks.');

  startBtn.disabled = true;
  updateHud();
}

function endRun(reason) {
  state.running = false;
  startBtn.disabled = false;
  setStatus(`${reason} Final score: ${Math.floor(state.score)}.`);

  if (state.strikes < 3 && state.timeLeft <= 0) {
    addLog('Crowd applauds. You saved the midnight show.', 'good');
    beep(880, 0.08, 0.03, 'triangle');
    beep(1180, 0.11, 0.024, 'sine');
  } else {
    addLog('Manager shuts down the booth for emergency cooldown.', 'bad');
  }
}

function tick(now) {
  const dt = Math.min(0.05, (now - state.lastTick) / 1000);
  state.lastTick = now;

  if (state.running) {
    state.ticker += dt;
    state.timeLeft -= dt;
    state.targetTimer -= dt;

    if (state.targetTimer <= 0) {
      changeTargets();
    }

    const focusError = Math.abs(state.focus - state.targetFocus);
    const lampError = Math.abs(state.lamp - state.targetLamp);
    state.quality = clamp(100 - (focusError * 1.25 + lampError * 1.1), 0, 100);

    if (state.lamp > 82) {
      state.heat += dt * (state.lamp - 80) * 0.95;
    } else {
      state.heat -= dt * 9.5;
    }

    state.heat = clamp(state.heat, 0, 110);

    if (state.quality < 40) {
      state.badWindow += dt;
    } else {
      state.badWindow = Math.max(0, state.badWindow - dt * 2.2);
      state.score += dt * (state.quality * 0.95 + 8);
    }

    if (state.badWindow > 3.6) {
      strike('Image quality crashed for too long.');
    }

    if (state.heat >= 100) {
      strike('Lamp overheated the projector head.');
      state.heat = 62;
    }

    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endRun('Screening wrapped cleanly.');
    }

    evaluateHints(focusError, lampError);
    updateHud();
  }

  requestAnimationFrame(tick);
}

focusInput.addEventListener('input', () => {
  state.focus = Number(focusInput.value);
});

lampInput.addEventListener('input', () => {
  state.lamp = Number(lampInput.value);
});

startBtn.addEventListener('click', startRun);

audioBtn.addEventListener('click', () => {
  state.audioEnabled = !state.audioEnabled;
  audioBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;
  if (state.audioEnabled) {
    beep(640, 0.06, 0.022, 'square');
    beep(900, 0.05, 0.018, 'triangle');
  }
});

document.addEventListener('keydown', (event) => {
  if (!state.running) return;

  const step = event.shiftKey ? 5 : 3;

  if (event.key.toLowerCase() === 'a') {
    state.focus = clamp(state.focus - step, 0, 100);
  } else if (event.key.toLowerCase() === 'd') {
    state.focus = clamp(state.focus + step, 0, 100);
  } else if (event.key.toLowerCase() === 'j') {
    state.lamp = clamp(state.lamp - step, 0, 100);
  } else if (event.key.toLowerCase() === 'l') {
    state.lamp = clamp(state.lamp + step, 0, 100);
  } else {
    return;
  }

  updateHud();
});

updateHud();
addLog('Booth idle. Press Start Screening.');
requestAnimationFrame(tick);
