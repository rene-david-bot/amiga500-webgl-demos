const grid = document.getElementById("grid");
const playBtn = document.getElementById("play");
const clearBtn = document.getElementById("clear");
const tempoSlider = document.getElementById("tempo");
const tempoValue = document.getElementById("tempo-value");
const statusEl = document.getElementById("status");
const bankButtons = document.getElementById("bank-buttons");

const tracks = [
    { name: "Kick", color: "#4fe3ff", type: "kick" },
    { name: "Snare", color: "#ff6ad5", type: "snare" },
    { name: "Hat", color: "#7dffb1", type: "hat" },
    { name: "Open Hat", color: "#6afff7", type: "openhat" },
    { name: "Clap", color: "#ffd166", type: "clap" },
    { name: "Rim", color: "#ff9f3f", type: "rim" },
];

const steps = 16;
const bankCount = 4;
let patterns = Array.from({ length: bankCount }, () => tracks.map(() => Array(steps).fill(false)));
let currentBank = 0;
let currentStep = 0;
let tempo = Number(tempoSlider.value);
let isPlaying = false;
let timer = null;
let audioCtx = null;
let noiseBuffer = null;
let stepEls = [];

function buildGrid() {
    grid.innerHTML = "";
    stepEls = tracks.map(() => []);

    tracks.forEach((track, trackIndex) => {
        const row = document.createElement("div");
        row.className = "track-row";

        const label = document.createElement("div");
        label.className = "track-label";
        label.textContent = track.name;

        const stepsWrap = document.createElement("div");
        stepsWrap.className = "steps";

        for (let i = 0; i < steps; i += 1) {
            const step = document.createElement("button");
            step.className = "step";
            if (i % 4 === 0) {
                step.classList.add("beat");
            }
            step.dataset.track = String(trackIndex);
            step.dataset.step = String(i);
            stepsWrap.appendChild(step);
            stepEls[trackIndex][i] = step;
        }

        row.appendChild(label);
        row.appendChild(stepsWrap);
        grid.appendChild(row);
    });
}

function ensureAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const duration = 0.5;
    noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function triggerKick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(55, time + 0.2);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

    click.type = "square";
    click.frequency.setValueAtTime(800, time);
    clickGain.gain.setValueAtTime(0.25, time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

    osc.connect(gain).connect(audioCtx.destination);
    click.connect(clickGain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.3);
    click.start(time);
    click.stop(time + 0.03);
}

function triggerSnare(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1900, time);
    filter.Q.value = 0.8;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(time);
    source.stop(time + 0.22);

    const tone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(180, time);
    toneGain.gain.setValueAtTime(0.35, time);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    tone.connect(toneGain).connect(audioCtx.destination);
    tone.start(time);
    tone.stop(time + 0.2);
}

function triggerHat(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(8000, time);
    filter.Q.value = 0.9;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(time);
    source.stop(time + 0.06);
}

function triggerOpenHat(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, time);
    filter.Q.value = 0.8;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.22, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(time);
    source.stop(time + 0.24);
}

function triggerClap(time) {
    const bursts = [0, 0.012, 0.024, 0.036];
    bursts.forEach((offset) => {
        const source = audioCtx.createBufferSource();
        source.buffer = getNoiseBuffer();
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1500, time + offset);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.38, time + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.07);
        source.connect(filter).connect(gain).connect(audioCtx.destination);
        source.start(time + offset);
        source.stop(time + offset + 0.08);
    });
}

function triggerRim(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(900, time);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
}

function playSound(trackType, time) {
    if (!audioCtx) return;
    switch (trackType) {
        case "kick":
            triggerKick(time);
            break;
        case "snare":
            triggerSnare(time);
            break;
        case "hat":
            triggerHat(time);
            break;
        case "openhat":
            triggerOpenHat(time);
            break;
        case "clap":
            triggerClap(time);
            break;
        case "rim":
            triggerRim(time);
            break;
        default:
            break;
    }
}

function updatePlayhead() {
    stepEls.flat().forEach((step) => step.classList.remove("active"));
    tracks.forEach((_, trackIndex) => {
        const stepEl = stepEls[trackIndex][currentStep];
        if (stepEl) stepEl.classList.add("active");
    });
}

function renderBank() {
    stepEls.flat().forEach((step) => step.classList.remove("on"));
    patterns[currentBank].forEach((trackPattern, trackIndex) => {
        trackPattern.forEach((on, stepIndex) => {
            if (on) stepEls[trackIndex][stepIndex].classList.add("on");
        });
    });
}

function setActiveBank(bankIndex) {
    currentBank = bankIndex;
    if (bankButtons) {
        Array.from(bankButtons.querySelectorAll(".bank-button")).forEach((btn) => {
            btn.classList.toggle("is-active", Number(btn.dataset.bank) === bankIndex);
        });
    }
    renderBank();
}

function tick() {
    const now = audioCtx ? audioCtx.currentTime : 0;
    tracks.forEach((track, trackIndex) => {
        if (patterns[currentBank][trackIndex][currentStep]) {
            playSound(track.type, now + 0.01);
        }
    });
    updatePlayhead();
    currentStep = (currentStep + 1) % steps;
}

function start() {
    ensureAudio();
    audioCtx.resume();
    if (timer) clearInterval(timer);
    const interval = (60 / tempo) / 4 * 1000;
    timer = setInterval(tick, interval);
    isPlaying = true;
    playBtn.textContent = "Pause";
    statusEl.textContent = "Audio running — 909‑style kit engaged.";
}

function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    isPlaying = false;
    playBtn.textContent = "Play";
    statusEl.textContent = "Audio off — press Play.";
    stepEls.flat().forEach((step) => step.classList.remove("active"));
}

function toggleStep(trackIndex, stepIndex) {
    const bank = patterns[currentBank];
    bank[trackIndex][stepIndex] = !bank[trackIndex][stepIndex];
    const stepEl = stepEls[trackIndex][stepIndex];
    stepEl.classList.toggle("on", bank[trackIndex][stepIndex]);
}

function clearPattern() {
    patterns[currentBank] = tracks.map(() => Array(steps).fill(false));
    renderBank();
}

function setDefaultPattern() {
    patterns = Array.from({ length: bankCount }, () => tracks.map(() => Array(steps).fill(false)));
    patterns[0][0][0] = true;
    patterns[0][0][8] = true;
    patterns[0][1][4] = true;
    patterns[0][1][12] = true;
    patterns[0][2][2] = true;
    patterns[0][2][6] = true;
    patterns[0][2][10] = true;
    patterns[0][2][14] = true;
    patterns[0][3][14] = true;
    patterns[0][4][12] = true;
    patterns[0][5][4] = true;
    renderBank();
}

buildGrid();
setDefaultPattern();
setActiveBank(0);

playBtn.addEventListener("click", () => {
    if (isPlaying) {
        stop();
    } else {
        start();
    }
});

clearBtn.addEventListener("click", () => {
    clearPattern();
});

grid.addEventListener("click", (event) => {
    const target = event.target;
    if (!target.classList.contains("step")) return;
    const trackIndex = Number(target.dataset.track);
    const stepIndex = Number(target.dataset.step);
    toggleStep(trackIndex, stepIndex);
});

if (bankButtons) {
    bankButtons.addEventListener("click", (event) => {
        const target = event.target;
        if (!target.classList.contains("bank-button")) return;
        const bankIndex = Number(target.dataset.bank);
        setActiveBank(bankIndex);
    });
}

tempoSlider.addEventListener("input", (event) => {
    tempo = Number(event.target.value);
    tempoValue.textContent = String(tempo);
    if (isPlaying) {
        start();
    }
});
