const scales = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10]
};

const slogans = [
  "PIXELS NEVER SLEEP",
  "CODE LOUDER",
  "DRESDEN BIT CLUB",
  "NEON NIGHTS FOREVER",
  "SYNTHS IN THE ATTIC",
  "HELLO RETRO FUTURE"
];

const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ui = {
  phraseInput: document.getElementById("phraseInput"),
  tempoInput: document.getElementById("tempoInput"),
  tempoValue: document.getElementById("tempoValue"),
  scaleSelect: document.getElementById("scaleSelect"),
  waveSelect: document.getElementById("waveSelect"),
  playBtn: document.getElementById("playBtn"),
  stopBtn: document.getElementById("stopBtn"),
  randomBtn: document.getElementById("randomBtn"),
  status: document.getElementById("status"),
  stepsStat: document.getElementById("stepsStat"),
  lengthStat: document.getElementById("lengthStat"),
  notesStat: document.getElementById("notesStat"),
  sequenceGrid: document.getElementById("sequenceGrid"),
  scope: document.getElementById("scope")
};

const state = {
  sequence: [],
  audioCtx: null,
  analyser: null,
  raf: null,
  stopHandle: null,
  playing: false,
  activeStep: -1,
  drawTime: 0
};

const scopeCtx = ui.scope.getContext("2d");

function setStatus(message, mode = "") {
  ui.status.className = `status ${mode}`.trim();
  ui.status.innerHTML = message;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function midiToName(midi) {
  const note = noteNames[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function phraseToSequence(phrase, scaleKey) {
  const safe = (phrase || "").slice(0, 72);
  const scale = scales[scaleKey] || scales.minor;
  const root = 48; // C3
  const steps = [];

  for (const char of safe) {
    if (char === " ") {
      steps.push({ char: "␠", rest: true, beats: 0.5 });
      continue;
    }

    const code = char.charCodeAt(0);
    const idx = code % scale.length;
    const octaveShift = Math.floor((code % 24) / 8);
    const midi = root + scale[idx] + octaveShift * 12;
    const beats = 0.25 + ((code % 4) * 0.125);
    const accent = code % 7 === 0;

    steps.push({
      char,
      midi,
      freq: midiToFreq(midi),
      note: midiToName(midi),
      beats,
      accent
    });

    if (["!", "?", ",", ".", ":", ";"].includes(char)) {
      steps.push({ char: "•", rest: true, beats: 0.25 });
    }
  }

  return steps.slice(0, 64);
}

function renderSequence(sequence) {
  ui.sequenceGrid.innerHTML = "";

  sequence.forEach((step, idx) => {
    const card = document.createElement("div");
    card.className = `step ${step.rest ? "rest" : ""}`.trim();
    card.dataset.index = idx;

    if (step.rest) {
      card.innerHTML = `<span class="ch">${step.char}</span><span class="note">Rest</span><span class="dur">${step.beats.toFixed(2)} beat</span>`;
    } else {
      card.innerHTML = `<span class="ch">${escapeHtml(step.char)}</span><span class="note">${step.note}</span><span class="dur">${step.beats.toFixed(2)} beat</span>`;
    }

    ui.sequenceGrid.appendChild(card);
  });
}

function updateStats(sequence, bpm) {
  const totalBeats = sequence.reduce((sum, step) => sum + step.beats, 0);
  const sec = totalBeats * (60 / bpm);
  const noteSet = new Set(sequence.filter(step => !step.rest).map(step => step.note));

  ui.stepsStat.textContent = String(sequence.length);
  ui.lengthStat.textContent = `${sec.toFixed(1)}s`;
  ui.notesStat.textContent = String(noteSet.size);
}

function highlightStep(index) {
  if (state.activeStep === index) return;

  const prev = ui.sequenceGrid.querySelector(".step.active");
  if (prev) prev.classList.remove("active");

  const current = ui.sequenceGrid.querySelector(`.step[data-index='${index}']`);
  if (current) current.classList.add("active");

  state.activeStep = index;
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 128;
    state.analyser.smoothingTimeConstant = 0.82;
    state.analyser.connect(state.audioCtx.destination);
  }

  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function makePulseOsc(ctx, freq, now) {
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = "square";
  oscB.type = "square";
  oscA.frequency.setValueAtTime(freq, now);
  oscB.frequency.setValueAtTime(freq * 1.007, now);
  return [oscA, oscB];
}

function playSequence() {
  const phrase = ui.phraseInput.value.trim();
  if (!phrase) {
    setStatus("Type a phrase first — empty air sounds boring.", "warn");
    return;
  }

  const bpm = Number(ui.tempoInput.value);
  const wave = ui.waveSelect.value;
  const sequence = phraseToSequence(phrase.toUpperCase(), ui.scaleSelect.value);

  if (!sequence.length) {
    setStatus("No playable symbols found. Try letters, numbers, or punctuation.", "warn");
    return;
  }

  state.sequence = sequence;
  renderSequence(sequence);
  updateStats(sequence, bpm);

  stopPlayback();
  ensureAudio();

  const ctx = state.audioCtx;
  const beatSec = 60 / bpm;
  let t = ctx.currentTime + 0.04;

  sequence.forEach((step, idx) => {
    const dur = step.beats * beatSec;

    setTimeout(() => {
      highlightStep(idx);
    }, Math.max(0, (t - ctx.currentTime) * 1000));

    if (!step.rest) {
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(step.accent ? 2800 : 1900, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(step.accent ? 0.12 : 0.08, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.92);

      let oscillators = [];
      if (wave === "pulse") {
        oscillators = makePulseOsc(ctx, step.freq, t);
      } else {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(step.freq, t);
        oscillators = [osc];
      }

      for (const osc of oscillators) {
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + dur);
      }

      filter.connect(gain);
      gain.connect(state.analyser);
    }

    t += dur;
  });

  state.playing = true;
  state.drawTime = performance.now();
  drawScope();

  clearTimeout(state.stopHandle);
  state.stopHandle = setTimeout(() => {
    stopPlayback();
    setStatus("Hook complete. Tweak settings and run another take.", "good");
  }, (t - ctx.currentTime) * 1000 + 60);

  setStatus(`Live take: ${sequence.length} steps at ${bpm} BPM.`, "good");
}

function stopPlayback() {
  if (!state.playing) {
    highlightStep(-1);
    return;
  }

  state.playing = false;

  if (state.raf) {
    cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  if (state.stopHandle) {
    clearTimeout(state.stopHandle);
    state.stopHandle = null;
  }

  highlightStep(-1);
}

function drawScope() {
  const w = ui.scope.width;
  const h = ui.scope.height;

  scopeCtx.clearRect(0, 0, w, h);

  scopeCtx.fillStyle = "#050915";
  scopeCtx.fillRect(0, 0, w, h);

  scopeCtx.strokeStyle = "rgba(150, 195, 255, 0.15)";
  scopeCtx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = ((i + 1) / 7) * h;
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, y);
    scopeCtx.lineTo(w, y);
    scopeCtx.stroke();
  }

  const bars = 48;
  const barW = w / bars;

  if (state.analyser && state.playing) {
    const data = new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);

    for (let i = 0; i < bars; i++) {
      const v = data[i % data.length] / 255;
      const bh = Math.max(2, v * (h - 14));
      const x = i * barW + 1;
      const y = h - bh - 1;

      const grad = scopeCtx.createLinearGradient(0, y, 0, h);
      grad.addColorStop(0, "#8dd7ff");
      grad.addColorStop(1, "#7f63ff");
      scopeCtx.fillStyle = grad;
      scopeCtx.fillRect(x, y, barW - 2, bh);
    }
  } else {
    const now = performance.now() * 0.0025;
    for (let i = 0; i < bars; i++) {
      const wave = (Math.sin(now + i * 0.35) + 1) * 0.5;
      const bh = 8 + wave * 26;
      const x = i * barW + 1;
      const y = h - bh - 1;
      scopeCtx.fillStyle = "rgba(95, 133, 212, 0.4)";
      scopeCtx.fillRect(x, y, barW - 2, bh);
    }
  }

  if (state.playing || !state.raf) {
    state.raf = requestAnimationFrame(drawScope);
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

ui.tempoInput.addEventListener("input", () => {
  ui.tempoValue.textContent = `${ui.tempoInput.value} BPM`;
  updateStats(state.sequence, Number(ui.tempoInput.value));
});

ui.playBtn.addEventListener("click", playSequence);
ui.stopBtn.addEventListener("click", () => {
  stopPlayback();
  setStatus("Playback stopped. Ready for another take.");
});
ui.randomBtn.addEventListener("click", () => {
  const phrase = slogans[Math.floor(Math.random() * slogans.length)];
  ui.phraseInput.value = phrase;
  setStatus("Loaded a surprise phrase. Hit Play Hook.");
});

window.addEventListener("keydown", event => {
  if (event.code === "Space") {
    event.preventDefault();
    if (state.playing) {
      stopPlayback();
      setStatus("Playback stopped. Ready for another take.");
    } else {
      playSequence();
    }
  }
});

ui.tempoValue.textContent = `${ui.tempoInput.value} BPM`;
state.sequence = phraseToSequence(ui.phraseInput.value, ui.scaleSelect.value);
renderSequence(state.sequence);
updateStats(state.sequence, Number(ui.tempoInput.value));
drawScope();
