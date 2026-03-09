const ROUNDS = 6;
const TRACK_LEN = 45;

const state = {
  round: 1,
  score: 0,
  streak: 0,
  position: 22,
  velocity: 0,
  target: 0,
  targetWidth: 2.8,
  running: true
};

const keys = {
  left: false,
  right: false
};

const el = {
  round: document.getElementById('round'),
  score: document.getElementById('score'),
  streak: document.getElementById('streak'),
  best: document.getElementById('best'),
  target: document.getElementById('target'),
  playhead: document.getElementById('playhead'),
  mark: document.getElementById('mark'),
  status: document.getElementById('status'),
  rewind: document.getElementById('rewind'),
  forward: document.getElementById('forward')
};

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function tone(freq = 440, ms = 80, type = 'square', gain = 0.018) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    // Audio optional
  }
}

function noiseBurst(ms = 70) {
  try {
    initAudio();
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * (ms / 1000)));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const amp = audioCtx.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    amp.gain.value = 0.012;
    src.buffer = buffer;
    src.connect(filter).connect(amp).connect(audioCtx.destination);
    src.start();
  } catch {
    // Audio optional
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadBest() {
  const best = JSON.parse(localStorage.getItem('cassette-cue-club-best') || 'null');
  if (!best) {
    el.best.textContent = '—';
    return;
  }
  el.best.textContent = `${best} pts`;
}

function saveBest() {
  const best = Number(localStorage.getItem('cassette-cue-club-best') || 0);
  if (state.score > best) {
    localStorage.setItem('cassette-cue-club-best', String(state.score));
    loadBest();
  }
}

function setStatus(text, mood = 'neutral') {
  el.status.textContent = text;
  el.status.classList.remove('good', 'bad');
  if (mood === 'good') el.status.classList.add('good');
  if (mood === 'bad') el.status.classList.add('bad');
}

function placeTarget() {
  state.target = 6 + Math.random() * 33;
  state.targetWidth = Math.max(1.3, 3.2 - state.round * 0.22);
}

function updateHud() {
  el.round.textContent = `${Math.min(state.round, ROUNDS)} / ${ROUNDS}`;
  el.score.textContent = state.score;
  el.streak.textContent = state.streak;
}

function updateTrack() {
  const toPercent = (seconds) => (seconds / TRACK_LEN) * 100;
  el.target.style.left = `${toPercent(state.target)}%`;
  el.target.style.width = `${toPercent(state.targetWidth)}%`;
  el.playhead.style.left = `${toPercent(state.position)}%`;
}

function applyInput() {
  const accel = 0.015;
  if (keys.left && !keys.right) state.velocity -= accel;
  if (keys.right && !keys.left) state.velocity += accel;
  state.velocity *= 0.96;
  state.velocity = clamp(state.velocity, -0.55, 0.55);

  state.position += state.velocity;

  if (state.position <= 0) {
    state.position = 0;
    state.velocity = 0;
    tone(180, 55, 'sawtooth', 0.012);
  }

  if (state.position >= TRACK_LEN) {
    state.position = TRACK_LEN;
    state.velocity = 0;
    tone(180, 55, 'sawtooth', 0.012);
  }
}

function markCue() {
  if (!state.running) return;

  const center = state.target + state.targetWidth / 2;
  const distance = Math.abs(state.position - center);
  const perfect = state.targetWidth * 0.18;
  const good = state.targetWidth * 0.5;

  if (distance <= perfect) {
    state.streak += 1;
    const bonus = 70 + state.streak * 12;
    state.score += bonus;
    setStatus(`Perfect drop! +${bonus}`, 'good');
    tone(980, 95, 'triangle', 0.025);
    setTimeout(() => tone(1320, 95, 'triangle', 0.02), 90);
  } else if (distance <= good) {
    state.streak = Math.max(0, state.streak - 1);
    const gain = 34;
    state.score += gain;
    setStatus(`Solid cue! +${gain}`, 'good');
    tone(760, 85, 'square', 0.018);
  } else {
    state.streak = 0;
    const miss = Math.round(distance * 4);
    state.score = Math.max(0, state.score - miss);
    setStatus(`Missed by ${distance.toFixed(2)}s · -${miss}`, 'bad');
    noiseBurst(100);
  }

  state.round += 1;
  if (state.round > ROUNDS) {
    finishRun();
    return;
  }

  placeTarget();
  state.position = clamp(state.position + (Math.random() * 4 - 2), 0, TRACK_LEN);
  updateHud();
  updateTrack();
}

function finishRun() {
  state.running = false;
  saveBest();
  const rank =
    state.score >= 500 ? 'Tape Wizard' :
    state.score >= 360 ? 'Club Resident' :
    state.score >= 220 ? 'Late-Night Selector' : 'Cue Rookie';

  setStatus(`Set complete — ${rank} (${state.score} pts). Refresh for a new set.`, 'good');
  el.mark.disabled = true;
  tone(620, 110, 'triangle', 0.022);
  setTimeout(() => tone(780, 110, 'triangle', 0.022), 120);
  setTimeout(() => tone(960, 140, 'triangle', 0.02), 230);
}

function loop() {
  if (state.running) {
    applyInput();
    updateTrack();
  }
  requestAnimationFrame(loop);
}

function keyState(event, active) {
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') keys.left = active;
  if (key === 'd' || key === 'arrowright') keys.right = active;
  if (active && key === ' ') {
    event.preventDefault();
    markCue();
  }
}

function bindHold(button, key) {
  button.addEventListener('pointerdown', () => {
    keys[key] = true;
    tone(key === 'left' ? 260 : 320, 50, 'sawtooth', 0.012);
  });

  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
    button.addEventListener(ev, () => {
      keys[key] = false;
    });
  });
}

function init() {
  placeTarget();
  loadBest();
  updateHud();
  updateTrack();

  bindHold(el.rewind, 'left');
  bindHold(el.forward, 'right');
  el.mark.addEventListener('click', markCue);

  window.addEventListener('keydown', (event) => keyState(event, true));
  window.addEventListener('keyup', (event) => keyState(event, false));

  loop();
}

init();
