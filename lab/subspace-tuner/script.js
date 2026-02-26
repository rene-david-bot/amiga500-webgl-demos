const scope = document.getElementById('scope');
const ctx = scope.getContext('2d');

const freq = document.getElementById('freq');
const gain = document.getElementById('gain');
const phase = document.getElementById('phase');
const freqValue = document.getElementById('freq-value');
const gainValue = document.getElementById('gain-value');
const phaseValue = document.getElementById('phase-value');
const statusEl = document.getElementById('status');
const meter = document.getElementById('meter');
const decodedEl = document.getElementById('decoded');

const audioBtn = document.getElementById('audio');
const driftBtn = document.getElementById('drift');
const newSignalBtn = document.getElementById('new-signal');
const stabilizeBtn = document.getElementById('stabilize');

const messages = [
    'RETURN TO BAY 12',
    'ORBIT WINDOW 04:00',
    'CARGO SEAL FAILURE',
    'RELAY ONLINE PRIME',
    'HOLD POSITION OMEGA',
    'SYNC TO BEACON SIX',
    'LIFELINE CONFIRMED',
    'DEPLOY SOLAR NET',
    'STAND DOWN DRONES',
    'PROCEED TO DOCK 88'
];

let target = randomSignal();
let locked = false;
let lastQuality = 0;
let driftOn = true;
let driftSeed = Math.random() * 1000;
let stabilizeTimeout = null;

let audioOn = false;
let audioCtx = null;
let tone = null;
let toneGain = null;

function randomSignal() {
    return {
        freq: randRange(1.4, 7.6),
        gain: randRange(18, 92),
        phase: randRange(0, 360),
        message: messages[Math.floor(Math.random() * messages.length)]
    };
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function setReadouts() {
    freqValue.textContent = Number(freq.value).toFixed(1);
    gainValue.textContent = Math.round(gain.value);
    phaseValue.textContent = Math.round(phase.value);
}

function getEffectiveTarget(time) {
    if (!driftOn) {
        return { ...target };
    }
    const freqDrift = Math.sin(time * 0.15 + driftSeed) * 0.25;
    const gainDrift = Math.sin(time * 0.12 + driftSeed * 1.3) * 4.2;
    const phaseDrift = Math.sin(time * 0.1 + driftSeed * 1.9) * 10;
    return {
        freq: target.freq + freqDrift,
        gain: target.gain + gainDrift,
        phase: (target.phase + phaseDrift + 360) % 360,
        message: target.message
    };
}

function getQuality(signal) {
    const freqDiff = Math.abs(Number(freq.value) - signal.freq) / 7;
    const gainDiff = Math.abs(Number(gain.value) - signal.gain) / 90;
    const phaseDiffRaw = Math.abs(Number(phase.value) - signal.phase);
    const phaseDiff = Math.min(phaseDiffRaw, 360 - phaseDiffRaw) / 180;
    const score = 1 - (freqDiff * 0.45 + gainDiff * 0.3 + phaseDiff * 0.25);
    return Math.max(0, Math.min(1, score));
}

function updateStatus(quality) {
    meter.style.width = `${Math.round(quality * 100)}%`;

    if (quality > 0.93) {
        statusEl.textContent = 'Signal lock · transmission stable';
        statusEl.style.color = 'var(--ok)';
        if (!locked) {
            locked = true;
            decodedEl.textContent = target.message;
            playLockChime();
        }
        return;
    }

    if (locked && quality >= 0.88) {
        statusEl.textContent = 'Signal lock · holding steady';
        statusEl.style.color = 'var(--ok)';
        return;
    }

    if (locked && quality < 0.88) {
        locked = false;
        decodedEl.textContent = scramble(target.message);
    }

    statusEl.textContent = driftOn ? 'Signal hunt · drift detected' : 'Signal hunt · manual hold';
    statusEl.style.color = 'var(--warn)';
}

function scramble(text) {
    const chars = '█▓▒░<>/\\|~*#';
    return text
        .split('')
        .map((char) => (char === ' ' ? ' ' : chars[Math.floor(Math.random() * chars.length)]))
        .join('');
}

function drawScope(time) {
    const signal = getEffectiveTarget(time);
    lastQuality = getQuality(signal);
    updateStatus(lastQuality);

    ctx.clearRect(0, 0, scope.width, scope.height);
    ctx.fillStyle = '#050a12';
    ctx.fillRect(0, 0, scope.width, scope.height);

    drawGrid();

    const glow = ctx.createLinearGradient(0, 0, scope.width, 0);
    glow.addColorStop(0, 'rgba(100, 240, 255, 0.15)');
    glow.addColorStop(1, 'rgba(100, 240, 255, 0.45)');

    const color = lastQuality > 0.93 ? 'rgba(107, 255, 107, 0.9)' : 'rgba(100, 240, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    const mid = scope.height / 2;
    const amplitude = (Number(gain.value) / 100) * (scope.height * 0.35);
    const baseFreq = Number(freq.value) * 0.6;
    const phaseOffset = (Number(phase.value) * Math.PI) / 180;

    for (let x = 0; x <= scope.width; x += 2) {
        const t = (x / scope.width) * Math.PI * 2 * baseFreq;
        const noise = (1 - lastQuality) * Math.sin(t * 3.1 + time * 2) * 6;
        const y = mid + Math.sin(t + phaseOffset) * amplitude + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1;
    ctx.stroke();

    updateTone();
    requestAnimationFrame((t) => drawScope(t / 1000));
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(100, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    const stepX = scope.width / 10;
    const stepY = scope.height / 6;

    for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(stepX * i, 0);
        ctx.lineTo(stepX * i, scope.height);
        ctx.stroke();
    }

    for (let j = 1; j < 6; j++) {
        ctx.beginPath();
        ctx.moveTo(0, stepY * j);
        ctx.lineTo(scope.width, stepY * j);
        ctx.stroke();
    }
}

function resetSignal() {
    target = randomSignal();
    locked = false;
    decodedEl.textContent = scramble(target.message);
    driftSeed = Math.random() * 1000;
}

function toggleDrift() {
    driftOn = !driftOn;
    driftBtn.textContent = `Drift: ${driftOn ? 'On' : 'Off'}`;
    driftBtn.classList.toggle('ghost', !driftOn);
}

function stabilize() {
    driftOn = false;
    driftBtn.textContent = 'Drift: Off';
    driftBtn.classList.add('ghost');
    if (stabilizeTimeout) clearTimeout(stabilizeTimeout);
    stabilizeTimeout = setTimeout(() => {
        driftOn = true;
        driftBtn.textContent = 'Drift: On';
        driftBtn.classList.remove('ghost');
    }, 8000);
}

function startAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    tone = audioCtx.createOscillator();
    toneGain = audioCtx.createGain();
    tone.type = 'triangle';
    toneGain.gain.value = 0;
    tone.connect(toneGain).connect(audioCtx.destination);
    tone.start();
}

function stopAudio() {
    if (!audioCtx) return;
    tone.stop();
    tone.disconnect();
    toneGain.disconnect();
    audioCtx.close();
    audioCtx = null;
    tone = null;
    toneGain = null;
}

function updateTone() {
    if (!audioOn || !audioCtx || !tone || !toneGain) return;
    const now = audioCtx.currentTime;
    const base = 140 + Number(freq.value) * 55;
    const gainValue = 0.005 + (Number(gain.value) / 100) * 0.03;
    const clarity = lastQuality * 120;
    tone.frequency.setTargetAtTime(base + clarity, now, 0.05);
    toneGain.gain.setTargetAtTime(gainValue, now, 0.05);
}

function playLockChime() {
    if (!audioOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const chime = audioCtx.createOscillator();
    const chimeGain = audioCtx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(660, now);
    chime.frequency.exponentialRampToValueAtTime(980, now + 0.25);
    chimeGain.gain.setValueAtTime(0.0, now);
    chimeGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    chime.connect(chimeGain).connect(audioCtx.destination);
    chime.start(now);
    chime.stop(now + 0.45);
}

function toggleAudio() {
    audioOn = !audioOn;
    audioBtn.textContent = `Audio: ${audioOn ? 'On' : 'Off'}`;
    audioBtn.classList.toggle('ghost', !audioOn);
    if (audioOn) {
        startAudio();
        audioCtx.resume();
    } else {
        stopAudio();
    }
}

freq.addEventListener('input', setReadouts);
phase.addEventListener('input', setReadouts);
gain.addEventListener('input', setReadouts);

newSignalBtn.addEventListener('click', () => {
    resetSignal();
});

driftBtn.addEventListener('click', toggleDrift);

stabilizeBtn.addEventListener('click', stabilize);

audioBtn.addEventListener('click', toggleAudio);

setReadouts();
resetSignal();
requestAnimationFrame((t) => drawScope(t / 1000));
