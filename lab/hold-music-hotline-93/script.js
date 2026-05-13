const moodSelect = document.getElementById('moodSelect');
const tempoSlider = document.getElementById('tempoSlider');
const wowSlider = document.getElementById('wowSlider');
const crushSlider = document.getElementById('crushSlider');
const staticSlider = document.getElementById('staticSlider');

const tempoValue = document.getElementById('tempoValue');
const wowValue = document.getElementById('wowValue');
const crushValue = document.getElementById('crushValue');
const staticValue = document.getElementById('staticValue');

const startBtn = document.getElementById('startBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const callerBtn = document.getElementById('callerBtn');

const queueStat = document.getElementById('queueStat');
const servedStat = document.getElementById('servedStat');
const holdStat = document.getElementById('holdStat');
const moodStat = document.getElementById('moodStat');
const statusEl = document.getElementById('status');
const vuBar = document.getElementById('vuBar');

const moods = {
  calm: {
    scale: [48, 52, 55, 59, 62, 64],
    bassPattern: [0, null, null, 0, null, null, 1, null, 0, null, null, 2, null, 1, null, null],
    progression: [0, 3, 4, 3],
    leadChance: 0.24,
    arrivalChance: 0.28,
    serviceBoost: 0.22
  },
  busy: {
    scale: [50, 53, 57, 60, 62, 65],
    bassPattern: [0, null, 1, null, 0, null, 2, null, 1, null, 0, null, 2, null, 1, null],
    progression: [0, 4, 1, 3],
    leadChance: 0.34,
    arrivalChance: 0.38,
    serviceBoost: 0.18
  },
  urgent: {
    scale: [47, 50, 54, 57, 59, 62],
    bassPattern: [0, null, 0, 1, null, 2, null, 1, 0, null, 2, null, 1, null, 2, null],
    progression: [0, 1, 4, 2],
    leadChance: 0.46,
    arrivalChance: 0.47,
    serviceBoost: 0.12
  },
  night: {
    scale: [45, 48, 52, 55, 57, 60],
    bassPattern: [0, null, null, 1, null, null, 2, null, 0, null, null, 3, null, null, 1, null],
    progression: [0, 2, 4, 1],
    leadChance: 0.2,
    arrivalChance: 0.24,
    serviceBoost: 0.26
  }
};

const state = {
  mood: 'calm',
  tempo: 94,
  wow: 18,
  crush: 22,
  noise: 20,
  playing: false,
  step: 0,
  queue: 4,
  served: 0,
  holdSeconds: 24,
  satisfaction: 92,
  vu: 0,
  seqTimer: null,
  queueTimer: null,
  uiTimer: null,
  ctx: null,
  master: null,
  compressor: null,
  color: null,
  noiseBuffer: null
};

const colorByMood = {
  calm: '#a9ff79',
  busy: '#55f8ff',
  urgent: '#ff6fd8',
  night: '#d5a2ff'
};

function midiToHz(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSec) {
  const sec = Math.max(0, Math.round(totalSec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function gradeFromSatisfaction(score) {
  if (score >= 95) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 78) return 'B';
  if (score >= 68) return 'C';
  if (score >= 56) return 'D';
  return 'F';
}

function setStatus(text, tone = '') {
  statusEl.textContent = text;
  statusEl.classList.remove('good', 'warn');
  if (tone) statusEl.classList.add(tone);
}

function updateReadout() {
  tempoValue.textContent = `${state.tempo} BPM`;
  wowValue.textContent = `${state.wow}%`;
  crushValue.textContent = `${state.crush}%`;
  staticValue.textContent = `${state.noise}%`;

  queueStat.textContent = String(state.queue);
  servedStat.textContent = String(state.served);
  holdStat.textContent = formatTime(state.holdSeconds);
  moodStat.textContent = gradeFromSatisfaction(state.satisfaction);

  document.documentElement.style.setProperty('--accent', colorByMood[state.mood] || '#55f8ff');
}

function setSliderValuesFromState() {
  moodSelect.value = state.mood;
  tempoSlider.value = String(state.tempo);
  wowSlider.value = String(state.wow);
  crushSlider.value = String(state.crush);
  staticSlider.value = String(state.noise);
}

function ensureAudio() {
  if (state.ctx) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    setStatus('WebAudio is unavailable in this browser.', 'warn');
    return false;
  }

  state.ctx = new Ctx();
  state.master = state.ctx.createGain();
  state.master.gain.value = 0.22;

  state.compressor = state.ctx.createDynamicsCompressor();
  state.compressor.threshold.value = -18;
  state.compressor.knee.value = 8;
  state.compressor.ratio.value = 3;

  const toneColor = state.ctx.createBiquadFilter();
  toneColor.type = 'lowpass';
  toneColor.frequency.value = 5400;
  toneColor.Q.value = 0.6;

  state.master.connect(toneColor);
  toneColor.connect(state.compressor);
  state.compressor.connect(state.ctx.destination);
  state.color = toneColor;

  const size = state.ctx.sampleRate * 0.7;
  const buffer = state.ctx.createBuffer(1, size, state.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  state.noiseBuffer = buffer;

  return true;
}

function refreshAudioColor() {
  if (!state.color) return;
  const cutoff = clamp(8200 - state.crush * 86, 900, 8200);
  state.color.frequency.setTargetAtTime(cutoff, state.ctx.currentTime, 0.08);
  state.color.Q.setTargetAtTime(0.55 + state.crush / 180, state.ctx.currentTime, 0.08);
}

function pulseVU(amount) {
  state.vu = clamp(state.vu + amount, 0, 1);
}

function playTone(midi, lengthSec, type, gainValue) {
  if (!state.ctx || !state.master) return;

  const now = state.ctx.currentTime;
  const osc = state.ctx.createOscillator();
  const amp = state.ctx.createGain();

  const wowRange = state.wow * 2.2;
  const wowDetune = (Math.random() * 2 - 1) * wowRange;
  const crushGlitch = Math.random() < state.crush / 180 ? (Math.random() < 0.5 ? -1 : 1) : 0;

  osc.type = type;
  osc.frequency.setValueAtTime(midiToHz(midi + crushGlitch), now);
  osc.detune.setValueAtTime(wowDetune, now);

  const snap = clamp(state.crush / 150, 0, 0.48);
  const body = Math.max(0.04, lengthSec * (1 - snap));

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + body);

  osc.connect(amp).connect(state.master);
  osc.start(now);
  osc.stop(now + body + 0.04);

  pulseVU(gainValue * 3.5);
}

function playStaticBurst() {
  if (!state.ctx || !state.noiseBuffer) return;
  const now = state.ctx.currentTime;

  const source = state.ctx.createBufferSource();
  source.buffer = state.noiseBuffer;

  const hp = state.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1700;

  const amp = state.ctx.createGain();
  const level = 0.002 + state.noise / 8200;

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(level, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  source.connect(hp).connect(amp).connect(state.master);
  source.start(now);
  source.stop(now + 0.1);

  pulseVU(0.17);
}

function playQueueChime() {
  if (!state.ctx) return;
  playTone(76, 0.12, 'square', 0.025);
  setTimeout(() => playTone(81, 0.12, 'square', 0.02), 80);
}

function runSequencerStep() {
  const profile = moods[state.mood];
  const step = state.step % 16;

  const bassIndex = profile.bassPattern[step];
  if (bassIndex !== null && bassIndex !== undefined) {
    playTone(profile.scale[bassIndex] - 12, 0.16, 'triangle', 0.036);
  }

  if (step % 4 === 0) {
    const bar = (state.step / 4) % profile.progression.length;
    const rootIndex = profile.progression[Math.floor(bar)];
    const root = profile.scale[rootIndex % profile.scale.length];

    playTone(root, 0.28, 'sine', 0.021);
    playTone(root + 4, 0.24, 'sine', 0.017);
    playTone(root + 7, 0.24, 'square', 0.012);
  }

  if (Math.random() < profile.leadChance) {
    const note = profile.scale[Math.floor(Math.random() * profile.scale.length)] + 12;
    playTone(note, 0.11, 'square', 0.017);
  }

  const staticChance = (state.noise / 100) * 0.2;
  if (Math.random() < staticChance) {
    playStaticBurst();
  }

  state.step += 1;
}

function applyQueueDynamics() {
  const profile = moods[state.mood];

  const arrivalChance = profile.arrivalChance + state.noise / 420;
  let newCallers = 0;
  if (Math.random() < arrivalChance) newCallers += 1;
  if (Math.random() < arrivalChance * 0.3) newCallers += 1;

  state.queue += newCallers;

  if (state.playing && state.queue > 0) {
    const tempoFactor = (state.tempo - 72) / 75;
    const analogPenalty = (state.wow + state.crush * 0.7 + state.noise * 0.5) / 210;
    const serviceChance = clamp(0.42 + tempoFactor + profile.serviceBoost - analogPenalty, 0.18, 0.93);

    let servedNow = 0;
    if (Math.random() < serviceChance) servedNow += 1;
    if (Math.random() < serviceChance * 0.25) servedNow += 1;

    servedNow = Math.min(servedNow, state.queue);
    if (servedNow > 0) {
      state.queue -= servedNow;
      state.served += servedNow;
      if (Math.random() < 0.3) playTone(67, 0.08, 'triangle', 0.012);
    }
  }

  const targetHold = 12 + state.queue * 9;
  state.holdSeconds += (targetHold - state.holdSeconds) * 0.22;

  if (state.queue > 8) state.satisfaction -= 2.1;
  else if (state.queue > 5) state.satisfaction -= 0.9;
  else state.satisfaction += 0.45;

  if (state.noise > 72) state.satisfaction -= 0.85;
  if (state.wow > 50) state.satisfaction -= 0.4;
  if (state.tempo > 124 && state.mood !== 'urgent') state.satisfaction -= 0.8;

  state.satisfaction = clamp(state.satisfaction, 18, 100);

  if (state.queue >= 12) {
    setStatus('Queue overload. Tighten the groove or incoming calls will churn.', 'warn');
  } else if (state.satisfaction >= 90 && state.queue <= 4) {
    setStatus('Smooth hotline flow. Callers are vibing with the hold loop.', 'good');
  }
}

function refreshTempoLoop() {
  if (!state.playing) return;
  if (state.seqTimer) clearInterval(state.seqTimer);
  const stepMs = (60000 / state.tempo) / 4;
  state.seqTimer = setInterval(runSequencerStep, stepMs);
}

function startHotline() {
  if (!ensureAudio()) return;

  state.ctx.resume();
  state.playing = true;
  startBtn.textContent = 'Stop Hotline';

  refreshAudioColor();
  refreshTempoLoop();

  if (!state.queueTimer) {
    state.queueTimer = setInterval(applyQueueDynamics, 1000);
  }

  setStatus('Hotline live. Synth board online and callers in queue.', 'good');
  playTone(60, 0.14, 'triangle', 0.03);
}

function stopHotline() {
  state.playing = false;
  startBtn.textContent = 'Start Hotline';

  if (state.seqTimer) {
    clearInterval(state.seqTimer);
    state.seqTimer = null;
  }

  setStatus('Hotline paused. Queue is holding steady.', 'warn');
}

function toggleHotline() {
  if (state.playing) stopHotline();
  else startHotline();
}

function syncStateFromControls() {
  state.mood = moodSelect.value;
  state.tempo = Number(tempoSlider.value);
  state.wow = Number(wowSlider.value);
  state.crush = Number(crushSlider.value);
  state.noise = Number(staticSlider.value);

  updateReadout();
  refreshAudioColor();
  if (state.playing) refreshTempoLoop();
}

function shufflePreset() {
  const moodKeys = Object.keys(moods);
  state.mood = moodKeys[Math.floor(Math.random() * moodKeys.length)];
  state.tempo = 78 + Math.floor(Math.random() * 52);
  state.wow = 6 + Math.floor(Math.random() * 52);
  state.crush = 8 + Math.floor(Math.random() * 56);
  state.noise = 4 + Math.floor(Math.random() * 62);

  setSliderValuesFromState();
  syncStateFromControls();

  setStatus(`Preset shuffled: ${moodSelect.options[moodSelect.selectedIndex].text}.`, 'good');
  if (state.playing) {
    playTone(64, 0.1, 'square', 0.017);
    setTimeout(() => playTone(67, 0.1, 'square', 0.017), 70);
  }
}

function addCaller() {
  state.queue += 1;
  state.holdSeconds += 4;
  state.satisfaction = clamp(state.satisfaction - 0.4, 18, 100);

  if (state.playing) playQueueChime();
  setStatus('New caller dropped into queue.', state.queue > 9 ? 'warn' : '');
}

function animateVU() {
  state.vu *= 0.9;
  const wobble = state.playing ? Math.random() * 0.04 : 0;
  const width = clamp((state.vu + wobble) * 100, 0, 100);
  vuBar.style.width = `${width.toFixed(1)}%`;
  requestAnimationFrame(animateVU);
}

function uiLoop() {
  updateReadout();
}

[moodSelect, tempoSlider, wowSlider, crushSlider, staticSlider].forEach((el) => {
  el.addEventListener('input', syncStateFromControls);
});

startBtn.addEventListener('click', toggleHotline);
shuffleBtn.addEventListener('click', shufflePreset);
callerBtn.addEventListener('click', addCaller);

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    toggleHotline();
  }
  if (event.key.toLowerCase() === 'c') {
    addCaller();
  }
});

setSliderValuesFromState();
syncStateFromControls();
state.uiTimer = setInterval(uiLoop, 150);
animateVU();
