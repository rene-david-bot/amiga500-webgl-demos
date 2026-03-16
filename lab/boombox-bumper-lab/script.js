const ui = {
  seedText: document.getElementById('seedText'),
  mood: document.getElementById('mood'),
  tempo: document.getElementById('tempo'),
  tempoValue: document.getElementById('tempoValue'),
  generate: document.getElementById('generate'),
  play: document.getElementById('play'),
  stop: document.getElementById('stop'),
  copy: document.getElementById('copy'),
  patternCode: document.getElementById('patternCode'),
  stepGrid: document.getElementById('stepGrid'),
  meter: document.getElementById('meter')
};

const moods = {
  sale: {
    name: 'Cyber Sale',
    rootMidi: 60,
    scale: [0, 4, 7, 9, 12],
    wave: 'square',
    color: '#ff67cd'
  },
  night: {
    name: 'Late Night Drive',
    rootMidi: 57,
    scale: [0, 3, 5, 7, 10, 12],
    wave: 'triangle',
    color: '#78f9ff'
  },
  sports: {
    name: 'Arcade Sports Flash',
    rootMidi: 55,
    scale: [0, 2, 4, 7, 9, 12],
    wave: 'sawtooth',
    color: '#afff9b'
  }
};

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const state = {
  pattern: [],
  code: '--',
  playing: false,
  stepTimer: null,
  stopTimer: null,
  currentStep: -1,
  audioCtx: null,
  master: null,
  analyser: null,
  noiseBuffer: null,
  meterFrame: 0,
  pulse: 0,
  seedHash: 0
};

const meterCtx = ui.meter.getContext('2d');

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return function random() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function midiToFreq(midi) {
  return 440 * (2 ** ((midi - 69) / 12));
}

function midiToLabel(midi) {
  const octave = Math.floor(midi / 12) - 1;
  return `${noteNames[midi % 12]}${octave}`;
}

function ensureAudio() {
  if (state.audioCtx) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.85;
  master.gain.value = 0.24;
  master.connect(analyser);
  analyser.connect(ctx.destination);

  state.audioCtx = ctx;
  state.master = master;
  state.analyser = analyser;
  state.noiseBuffer = createNoiseBuffer(ctx);
}

function createNoiseBuffer(ctx) {
  const length = ctx.sampleRate * 0.25;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return buffer;
}

function buildPattern() {
  const mood = moods[ui.mood.value];
  const seedText = `${ui.seedText.value.trim().toUpperCase()}|${ui.mood.value}`;
  const seedFactory = xmur3(seedText || 'RETRO');
  const rng = mulberry32(seedFactory());

  state.seedHash = seedFactory();

  const pattern = Array.from({ length: 16 }, (_, i) => {
    const strong = i % 4 === 0;
    const activeChance = strong ? 0.95 : 0.62;
    const active = rng() < activeChance;
    const scaleIndex = Math.floor(rng() * mood.scale.length);
    const octaveBoost = rng() > 0.72 ? 12 : 0;
    const midi = mood.rootMidi + mood.scale[scaleIndex] + octaveBoost;
    const accent = strong || rng() > 0.78;

    return {
      active,
      accent,
      midi
    };
  });

  pattern[0].active = true;
  pattern[8].active = true;

  state.pattern = pattern;
  state.code = `${state.seedHash.toString(36).slice(0, 4)}-${encodePattern(pattern)}`.toUpperCase();
  ui.patternCode.textContent = state.code;
  renderGrid();
}

function encodePattern(pattern) {
  const bits = pattern.map((step) => (step.active ? '1' : '0')).join('');
  return parseInt(bits, 2).toString(36).padStart(4, '0').slice(-4);
}

function renderGrid() {
  ui.stepGrid.innerHTML = '';
  state.pattern.forEach((step, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `step ${step.active ? 'active' : ''}`;
    btn.dataset.index = String(i);
    btn.innerHTML = `<span class="idx">Step ${i + 1}</span><span class="note">${step.active ? midiToLabel(step.midi) : '—'}</span>`;

    btn.addEventListener('click', (event) => {
      if (event.shiftKey) {
        cycleStepPitch(i);
      } else {
        state.pattern[i].active = !state.pattern[i].active;
      }
      ui.patternCode.textContent = `${state.code.split('-')[0]}-${encodePattern(state.pattern).toUpperCase()}`;
      renderGrid();
    });

    ui.stepGrid.appendChild(btn);
  });
}

function cycleStepPitch(index) {
  const mood = moods[ui.mood.value];
  const step = state.pattern[index];
  if (!step.active) {
    step.active = true;
    step.midi = mood.rootMidi + mood.scale[0];
    return;
  }

  const options = [];
  for (let octave = 0; octave <= 1; octave += 1) {
    for (const semitone of mood.scale) {
      options.push(mood.rootMidi + semitone + octave * 12);
    }
  }
  const current = options.indexOf(step.midi);
  step.midi = options[(current + 1) % options.length];
}

function playKick(time) {
  const { audioCtx, master } = state;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(126, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.12);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.38, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);

  osc.connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + 0.16);
}

function playClap(time) {
  const { audioCtx, master, noiseBuffer } = state;
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1600, time);
  filter.Q.value = 0.8;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.08, time + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

  source.connect(filter).connect(gain).connect(master);
  source.start(time);
  source.stop(time + 0.1);
}

function playLead(step, time, duration, moodKey) {
  const { audioCtx, master } = state;
  const mood = moods[moodKey];
  const freq = midiToFreq(step.midi);

  const oscA = audioCtx.createOscillator();
  const oscB = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  oscA.type = mood.wave;
  oscB.type = 'triangle';
  oscA.frequency.setValueAtTime(freq, time);
  oscB.frequency.setValueAtTime(freq * 2, time);
  oscB.detune.value = step.accent ? 9 : 3;

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(step.accent ? 2200 : 1400, time);

  const attack = 0.008;
  const release = Math.max(duration - 0.03, 0.06);
  const level = step.accent ? 0.15 : 0.1;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(level, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + release);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain).connect(master);

  oscA.start(time);
  oscB.start(time);
  oscA.stop(time + duration);
  oscB.stop(time + duration);
}

function clearTimers() {
  if (state.stepTimer) {
    clearInterval(state.stepTimer);
    state.stepTimer = null;
  }
  if (state.stopTimer) {
    clearTimeout(state.stopTimer);
    state.stopTimer = null;
  }
}

function setPlayingStep(index) {
  const nodes = ui.stepGrid.querySelectorAll('.step');
  nodes.forEach((node) => node.classList.remove('playing'));
  if (index >= 0 && nodes[index]) nodes[index].classList.add('playing');
}

function stopPlayback() {
  state.playing = false;
  state.currentStep = -1;
  clearTimers();
  setPlayingStep(-1);
}

async function playPattern() {
  ensureAudio();
  if (state.audioCtx.state === 'suspended') await state.audioCtx.resume();

  stopPlayback();
  state.playing = true;

  const bpm = Number(ui.tempo.value);
  const stepDuration = 60 / bpm / 4;
  const now = state.audioCtx.currentTime + 0.06;

  state.pattern.forEach((step, i) => {
    const when = now + i * stepDuration;

    if (i % 4 === 0) playKick(when);
    if (i % 8 === 4) playClap(when);

    if (step.active) {
      playLead(step, when, stepDuration * (step.accent ? 1.05 : 0.9), ui.mood.value);
    }
  });

  const startMs = performance.now();
  state.stepTimer = setInterval(() => {
    const elapsed = (performance.now() - startMs) / 1000;
    const idx = Math.min(15, Math.floor(elapsed / stepDuration));
    if (idx !== state.currentStep) {
      state.currentStep = idx;
      setPlayingStep(idx);
    }
  }, 28);

  state.stopTimer = setTimeout(() => {
    stopPlayback();
  }, stepDuration * 16 * 1000 + 120);
}

function drawMeter() {
  state.meterFrame = requestAnimationFrame(drawMeter);
  const w = ui.meter.width;
  const h = ui.meter.height;

  meterCtx.fillStyle = '#040813';
  meterCtx.fillRect(0, 0, w, h);

  const grad = meterCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#111f36');
  grad.addColorStop(1, '#060c1a');
  meterCtx.fillStyle = grad;
  meterCtx.fillRect(0, 0, w, h);

  const barCount = 30;
  const gap = 5;
  const barW = (w - gap * (barCount + 1)) / barCount;

  let levels;
  if (state.analyser && state.playing) {
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);
    levels = Array.from({ length: barCount }, (_, i) => data[Math.floor((i / barCount) * data.length)] / 255);
  } else {
    state.pulse += 0.05;
    levels = Array.from({ length: barCount }, (_, i) => 0.12 + Math.abs(Math.sin(state.pulse + i * 0.35)) * 0.18);
  }

  const moodColor = moods[ui.mood.value].color;

  levels.forEach((value, i) => {
    const x = gap + i * (barW + gap);
    const height = Math.max(6, value * (h - 26));
    const y = h - height - 8;

    meterCtx.fillStyle = moodColor;
    meterCtx.fillRect(x, y, barW, height);

    meterCtx.fillStyle = 'rgba(255,255,255,0.2)';
    meterCtx.fillRect(x, y, barW, 2);
  });

  meterCtx.fillStyle = '#80a3c8';
  meterCtx.font = '12px "Courier New", monospace';
  meterCtx.fillText(`${moods[ui.mood.value].name} • ${ui.tempo.value} BPM`, 10, 16);
}

function updateTempo() {
  ui.tempoValue.textContent = ui.tempo.value;
}

async function copyCode() {
  const code = ui.patternCode.textContent;
  try {
    await navigator.clipboard.writeText(code);
    ui.copy.textContent = 'Copied!';
    setTimeout(() => {
      ui.copy.textContent = 'Copy Code';
    }, 900);
  } catch {
    ui.copy.textContent = 'Copy failed';
    setTimeout(() => {
      ui.copy.textContent = 'Copy Code';
    }, 900);
  }
}

function bind() {
  ui.seedText.addEventListener('input', () => {
    if (ui.seedText.value.length > 22) ui.seedText.value = ui.seedText.value.slice(0, 22);
  });

  ui.tempo.addEventListener('input', updateTempo);

  ui.generate.addEventListener('click', () => {
    stopPlayback();
    buildPattern();
  });

  ui.mood.addEventListener('change', () => {
    stopPlayback();
    buildPattern();
  });

  ui.play.addEventListener('click', () => {
    playPattern();
  });

  ui.stop.addEventListener('click', stopPlayback);
  ui.copy.addEventListener('click', copyCode);
}

function init() {
  updateTempo();
  buildPattern();
  bind();
  drawMeter();
}

init();
