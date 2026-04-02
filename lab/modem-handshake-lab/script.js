const scope = document.getElementById('scope');
const ctx = scope.getContext('2d');

const statusEl = document.getElementById('status');
const profileNameEl = document.getElementById('profile-name');
const countEl = document.getElementById('count');
const peakEl = document.getElementById('peak');
const logEl = document.getElementById('log');

const noiseInput = document.getElementById('noise');
const noiseValueEl = document.getElementById('noise-value');
const speedInput = document.getElementById('speed');
const speedValueEl = document.getElementById('speed-value');

const carrierBtn = document.getElementById('carrier-btn');
const handshakeBtn = document.getElementById('handshake-btn');
const burstBtn = document.getElementById('burst-btn');
const chips = [...document.querySelectorAll('.chip')];

const profiles = {
    bell103: {
        name: 'Bell 103 · 300',
        carrier: 1070,
        script: [
            { type: 'tone', from: 980, to: 1280, duration: 290, label: 'Originate tone sweep' },
            { type: 'tone', from: 2025, to: 2225, duration: 250, label: 'Answer carrier lock' },
            { type: 'burst', freq: 1270, duration: 230, label: 'Training burst A' },
            { type: 'burst', freq: 1070, duration: 230, label: 'Training burst B' },
            { type: 'burst', freq: 1170, duration: 220, label: 'Ready for payload' }
        ]
    },
    v22: {
        name: 'V.22 · 1200',
        carrier: 1200,
        script: [
            { type: 'tone', from: 1200, to: 2400, duration: 210, label: 'Quadrature sync' },
            { type: 'tone', from: 2400, to: 1200, duration: 210, label: 'Return sync' },
            { type: 'burst', freq: 2100, duration: 180, label: 'Phase calibration' },
            { type: 'burst', freq: 1500, duration: 160, label: 'Symbol timing' },
            { type: 'burst', freq: 1800, duration: 180, label: 'Link established' }
        ]
    },
    v32: {
        name: 'V.32 · 9600',
        carrier: 1800,
        script: [
            { type: 'tone', from: 900, to: 2500, duration: 220, label: 'Adaptive equalizer wake' },
            { type: 'tone', from: 2500, to: 1300, duration: 220, label: 'Echo canceller probe' },
            { type: 'burst', freq: 1950, duration: 140, label: 'Constellation training' },
            { type: 'burst', freq: 1450, duration: 140, label: 'Scrambler alignment' },
            { type: 'burst', freq: 2250, duration: 180, label: 'Speed shift request' },
            { type: 'burst', freq: 1820, duration: 210, label: 'Data channel open' }
        ]
    },
    sportster: {
        name: 'Sportster · 14.4k',
        carrier: 1710,
        script: [
            { type: 'tone', from: 980, to: 2780, duration: 260, label: 'X2 turbo probe' },
            { type: 'burst', freq: 2400, duration: 120, label: 'Rate negotiation' },
            { type: 'burst', freq: 2100, duration: 120, label: 'Fallback check' },
            { type: 'burst', freq: 2600, duration: 120, label: 'Trellis map push' },
            { type: 'burst', freq: 1850, duration: 150, label: 'CRC warmup' },
            { type: 'tone', from: 1900, to: 1300, duration: 240, label: 'Channel settle' },
            { type: 'burst', freq: 1710, duration: 220, label: 'Full link green' }
        ]
    }
};

let audioCtx;
let analyser;
let masterGain;
let noiseGain;
let noiseSource;
let carrierOsc;
let currentProfile = 'bell103';
let carrierOn = false;
let running = false;
let handshakeCount = 0;

const waveform = new Uint8Array(2048);

function ensureAudio() {
    if (audioCtx) return;

    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.22;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;

    const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const chan = noiseBuffer.getChannelData(0);
    for (let i = 0; i < chan.length; i++) {
        chan[i] = (Math.random() * 2 - 1) * (0.45 + Math.random() * 0.55);
    }

    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseSource.connect(noiseGain);

    noiseGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    noiseSource.start();
    log('Audio context armed. Insert coin and dial.');
}

function speedFactor() {
    return Number(speedInput.value) / 100;
}

function noiseAmount() {
    return Number(noiseInput.value) / 100;
}

function setStatus(text) {
    statusEl.textContent = text;
}

function log(text) {
    const stamp = new Date().toLocaleTimeString([], { hour12: false });
    logEl.innerHTML = `${stamp} · ${text}<br>` + logEl.innerHTML;
}

function setProfile(id) {
    currentProfile = id;
    profileNameEl.textContent = profiles[id].name;
    chips.forEach((chip) => chip.classList.toggle('active', chip.dataset.profile === id));
    log(`Profile set: ${profiles[id].name}`);

    if (carrierOn) {
        stopCarrier();
        startCarrier();
    }
}

function dbFromByte(byte) {
    const normalized = Math.max(0.0001, Math.abs((byte - 128) / 128));
    return 20 * Math.log10(normalized);
}

function drawScope() {
    requestAnimationFrame(drawScope);

    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, scope.width, scope.height);

    for (let i = 0; i < 12; i++) {
        const y = ((i + 1) / 13) * scope.height;
        ctx.strokeStyle = 'rgba(35, 95, 190, 0.17)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(scope.width, y);
        ctx.stroke();
    }

    if (!analyser) {
        ctx.fillStyle = '#6f8bc9';
        ctx.font = '20px monospace';
        ctx.fillText('Press Carrier or Run Handshake to arm audio.', 26, scope.height / 2);
        return;
    }

    analyser.getByteTimeDomainData(waveform);
    let peakDb = -120;

    ctx.beginPath();
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = '#33f2ff';

    for (let i = 0; i < waveform.length; i++) {
        const x = (i / (waveform.length - 1)) * scope.width;
        const y = (waveform[i] / 255) * scope.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        peakDb = Math.max(peakDb, dbFromByte(waveform[i]));
    }

    ctx.stroke();

    peakEl.textContent = `${peakDb.toFixed(1)} dB`;

    ctx.strokeStyle = 'rgba(255, 95, 210, 0.35)';
    ctx.beginPath();
    ctx.moveTo(0, scope.height / 2);
    ctx.lineTo(scope.width, scope.height / 2);
    ctx.stroke();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function playTone({ from, to, duration, shape = 'sine', gain = 0.2 }) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = shape;
    osc.frequency.setValueAtTime(from, audioCtx.currentTime);
    if (to !== undefined && to !== from) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), audioCtx.currentTime + duration / 1000);
    }

    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);

    osc.connect(g);
    g.connect(masterGain);

    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000 + 0.02);
}

function playBurst(freq, duration) {
    playTone({
        from: freq,
        duration,
        shape: Math.random() > 0.5 ? 'square' : 'triangle',
        gain: 0.14 + Math.random() * 0.08
    });
}

function noiseEnvelope(active) {
    if (!noiseGain || !audioCtx) return;
    const target = active ? noiseAmount() * 0.22 : 0;
    noiseGain.gain.cancelScheduledValues(audioCtx.currentTime);
    noiseGain.gain.linearRampToValueAtTime(target, audioCtx.currentTime + 0.07);
}

function startCarrier() {
    ensureAudio();
    if (carrierOsc) return;

    carrierOsc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    carrierOsc.type = 'sine';
    carrierOsc.frequency.value = profiles[currentProfile].carrier;

    g.gain.value = 0.08;
    carrierOsc.connect(g);
    g.connect(masterGain);

    carrierOsc.start();
    carrierOn = true;
    carrierBtn.textContent = 'Carrier Off';
    setStatus(running ? 'Handshake running' : 'Carrier live');
    log('Carrier enabled.');
}

function stopCarrier() {
    if (!carrierOsc) return;
    carrierOsc.stop();
    carrierOsc.disconnect();
    carrierOsc = null;
    carrierOn = false;
    carrierBtn.textContent = 'Carrier On';
    setStatus(running ? 'Handshake running' : 'Idle');
    log('Carrier muted.');
}

async function runHandshake() {
    if (running) return;
    ensureAudio();
    running = true;
    handshakeBtn.disabled = true;

    setStatus('Handshake running');
    noiseEnvelope(true);

    const profile = profiles[currentProfile];
    const k = 1 / speedFactor();

    log(`Dialing ${profile.name}...`);

    for (const step of profile.script) {
        const duration = step.duration * k;

        if (step.type === 'tone') {
            playTone({ from: step.from, to: step.to, duration, gain: 0.18 });
        } else {
            playBurst(step.freq, duration);
        }

        log(step.label);
        await sleep(duration + 55);
    }

    noiseEnvelope(carrierOn);
    handshakeCount += 1;
    countEl.textContent = handshakeCount;
    setStatus(carrierOn ? 'Carrier live' : 'Link ready');
    log('Handshake complete. Carrier stabilized.');

    running = false;
    handshakeBtn.disabled = false;
}

function randomBurst() {
    ensureAudio();
    const nowNoise = noiseAmount() * (0.16 + Math.random() * 0.2);
    noiseGain.gain.setTargetAtTime(nowNoise, audioCtx.currentTime, 0.02);

    for (let i = 0; i < 8; i++) {
        const freq = 700 + Math.random() * 2400;
        const dur = 45 + Math.random() * 120;
        setTimeout(() => playBurst(freq, dur), i * 60);
    }

    setTimeout(() => noiseEnvelope(carrierOn), 700);
    log('Injected random line burst.');
}

noiseInput.addEventListener('input', () => {
    noiseValueEl.textContent = `${noiseInput.value}%`;
    if (!audioCtx) return;
    if (running || carrierOn) noiseEnvelope(true);
});

speedInput.addEventListener('input', () => {
    speedValueEl.textContent = `${speedInput.value}%`;
});

carrierBtn.addEventListener('click', () => {
    if (!carrierOn) startCarrier();
    else stopCarrier();
});

handshakeBtn.addEventListener('click', runHandshake);
burstBtn.addEventListener('click', randomBurst);

chips.forEach((chip) => {
    chip.addEventListener('click', () => setProfile(chip.dataset.profile));
});

setProfile(currentProfile);
drawScope();
