const grid = document.getElementById("grid");
const playBtn = document.getElementById("play");
const clearBtn = document.getElementById("clear");
const tempoSlider = document.getElementById("tempo");
const tempoValue = document.getElementById("tempo-value");
const statusEl = document.getElementById("status");

const tracks = [
    { name: "Kick", color: "#4fe3ff", type: "kick" },
    { name: "Snare", color: "#ff6ad5", type: "snare" },
    { name: "Hat", color: "#7dffb1", type: "hat" },
    { name: "Clap", color: "#ffd166", type: "clap" },
];

const steps = 16;
let pattern = tracks.map(() => Array(steps).fill(false));
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
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(time);
    osc.stop(time + 0.16);
}

function triggerSnare(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, time);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(time);
    source.stop(time + 0.16);

    const tone = audioCtx.createOscillator();
    const toneGain = audioCtx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(200, time);
    toneGain.gain.setValueAtTime(0.25, time);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    tone.connect(toneGain).connect(audioCtx.destination);
    tone.start(time);
    tone.stop(time + 0.14);
}

function triggerHat(time) {
    const source = audioCtx.createBufferSource();
    source.buffer = getNoiseBuffer();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(6500, time);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    source.connect(filter).connect(gain).connect(audioCtx.destination);
    source.start(time);
    source.stop(time + 0.07);
}

function triggerClap(time) {
    const bursts = [0, 0.015, 0.03];
    bursts.forEach((offset) => {
        const source = audioCtx.createBufferSource();
        source.buffer = getNoiseBuffer();
        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1500, time + offset);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.4, time + offset);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.08);
        source.connect(filter).connect(gain).connect(audioCtx.destination);
        source.start(time + offset);
        source.stop(time + offset + 0.09);
    });
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
        case "clap":
            triggerClap(time);
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

function tick() {
    const now = audioCtx ? audioCtx.currentTime : 0;
    tracks.forEach((track, trackIndex) => {
        if (pattern[trackIndex][currentStep]) {
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
    statusEl.textContent = "Audio running — loop engaged.";
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
    pattern[trackIndex][stepIndex] = !pattern[trackIndex][stepIndex];
    const stepEl = stepEls[trackIndex][stepIndex];
    stepEl.classList.toggle("on", pattern[trackIndex][stepIndex]);
}

function clearPattern() {
    pattern = tracks.map(() => Array(steps).fill(false));
    stepEls.flat().forEach((step) => step.classList.remove("on"));
}

function setDefaultPattern() {
    clearPattern();
    pattern[0][0] = true;
    pattern[0][8] = true;
    pattern[1][4] = true;
    pattern[1][12] = true;
    pattern[2][2] = true;
    pattern[2][6] = true;
    pattern[2][10] = true;
    pattern[2][14] = true;
    pattern[3][12] = true;

    tracks.forEach((_, trackIndex) => {
        pattern[trackIndex].forEach((on, stepIndex) => {
            if (on) stepEls[trackIndex][stepIndex].classList.add("on");
        });
    });
}

buildGrid();
setDefaultPattern();

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

tempoSlider.addEventListener("input", (event) => {
    tempo = Number(event.target.value);
    tempoValue.textContent = String(tempo);
    if (isPlaying) {
        start();
    }
});
