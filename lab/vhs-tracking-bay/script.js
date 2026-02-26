const screen = document.getElementById('screen');
const ctx = screen.getContext('2d');
const buffer = document.createElement('canvas');
const bctx = buffer.getContext('2d');

buffer.width = screen.width;
buffer.height = screen.height;

const tracking = document.getElementById('tracking');
const age = document.getElementById('age');
const ageValue = document.getElementById('age-value');
const offsetValue = document.getElementById('offset-value');
const statusEl = document.getElementById('status');
const meter = document.getElementById('meter');

const audioBtn = document.getElementById('audio');
const cleanBtn = document.getElementById('clean');
const newTapeBtn = document.getElementById('new-tape');
const autoTrackBtn = document.getElementById('auto-track');

const skyline = buildSkyline();

let target = randomTarget();
let locked = false;
let cleanBoost = 0;
let cleanTimeout = null;

let audioOn = false;
let audioCtx = null;
let noiseSource = null;
let noiseGain = null;
let noiseFilter = null;

function buildSkyline() {
    const blocks = [];
    let x = 0;
    while (x < screen.width) {
        const width = randRange(28, 64);
        const height = randRange(20, 90);
        blocks.push({ x, width, height });
        x += width + randRange(8, 20);
    }
    return blocks;
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function randomTarget() {
    return Math.round(randRange(-40, 40));
}

function formatOffset(value) {
    const numeric = Number(value);
    return `${numeric > 0 ? '+' : ''}${numeric}`;
}

function updateReadouts() {
    ageValue.textContent = Math.round(age.value);
    offsetValue.textContent = formatOffset(tracking.value);
}

function getQuality() {
    const error = Math.abs(Number(tracking.value) - target) / 50;
    const wear = Number(age.value) / 100;
    const raw = 1 - (error * 0.9 + wear * 0.25 - cleanBoost);
    return Math.max(0, Math.min(1, raw));
}

function updateStatus(quality) {
    meter.style.width = `${Math.round(quality * 100)}%`;

    if (quality > 0.92) {
        statusEl.textContent = 'Lock stable · picture crisp';
        statusEl.style.color = 'var(--ok)';
        if (!locked) {
            locked = true;
            playLockChime();
        }
        return;
    }

    locked = false;

    if (quality > 0.75) {
        statusEl.textContent = 'Tracking stabilizing · shimmer low';
        statusEl.style.color = 'var(--warn)';
        return;
    }

    statusEl.textContent = 'Snowy picture · tracking drift';
    statusEl.style.color = 'var(--alert)';
}

function drawScene(time) {
    const w = buffer.width;
    const h = buffer.height;

    bctx.clearRect(0, 0, w, h);

    const sky = bctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#181c39');
    sky.addColorStop(0.5, '#2a2051');
    sky.addColorStop(1, '#0e0b1d');
    bctx.fillStyle = sky;
    bctx.fillRect(0, 0, w, h);

    const sunX = w * 0.68;
    const sunY = h * 0.42;
    bctx.beginPath();
    bctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
    bctx.fillStyle = 'rgba(255, 133, 196, 0.9)';
    bctx.fill();

    bctx.fillStyle = 'rgba(14, 10, 28, 0.4)';
    for (let i = -3; i < 6; i++) {
        bctx.fillRect(sunX - 85, sunY + i * 14, 170, 6);
    }

    bctx.fillStyle = '#0a0b18';
    bctx.fillRect(0, h * 0.62, w, h * 0.38);

    bctx.fillStyle = '#141833';
    skyline.forEach((block) => {
        bctx.fillRect(block.x, h * 0.62 - block.height, block.width, block.height);
    });

    bctx.strokeStyle = 'rgba(109, 247, 255, 0.14)';
    bctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
        const y = h * 0.62 + i * ((h * 0.38) / 8);
        bctx.beginPath();
        bctx.moveTo(0, y);
        bctx.lineTo(w, y);
        bctx.stroke();
    }

    for (let i = 1; i < 10; i++) {
        const x = i * (w / 10);
        bctx.beginPath();
        bctx.moveTo(x, h * 0.62);
        bctx.lineTo(w * 0.5 + (x - w * 0.5) * 0.6, h);
        bctx.stroke();
    }

    bctx.fillStyle = 'rgba(230, 240, 255, 0.75)';
    bctx.font = '20px "IBM Plex Mono", monospace';
    bctx.fillText('TRACKING BAY 84', 24, 36);
    bctx.font = '12px "IBM Plex Mono", monospace';
    bctx.fillText(`OFFSET ${formatOffset(tracking.value)}  •  WEAR ${Math.round(age.value)}%`, 24, 58);

    const pulse = 0.4 + Math.sin(time * 2) * 0.2;
    bctx.fillStyle = `rgba(102, 227, 255, ${pulse})`;
    bctx.fillRect(24, h - 28, 120, 6);
}

function addNoise(quality, time) {
    const w = screen.width;
    const h = screen.height;
    const noiseStrength = 1 - quality;
    const wear = Number(age.value) / 100;
    const lines = Math.floor(40 + noiseStrength * 160 + wear * 80);

    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + noiseStrength * 0.12})`;
    for (let i = 0; i < lines; i++) {
        const y = Math.random() * h;
        const width = Math.random() * w * (0.2 + noiseStrength);
        const height = Math.random() * 2 + 1;
        const x = Math.random() * (w - width);
        ctx.fillRect(x, y, width, height);
    }

    const roll = (time * 40) % h;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.03 + noiseStrength * 0.08})`;
    ctx.fillRect(0, roll, w, 12 + noiseStrength * 8);
}

function render(time) {
    const quality = getQuality();
    updateStatus(quality);

    drawScene(time);

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, screen.width, screen.height);

    const slices = 10;
    const sliceHeight = screen.height / slices;

    for (let i = 0; i < slices; i++) {
        const y = i * sliceHeight;
        const shift = (Math.random() - 0.5) * (1 - quality) * 18;
        ctx.drawImage(buffer, 0, y, screen.width, sliceHeight, shift, y, screen.width, sliceHeight);
    }

    addNoise(quality, time);
    updateAudio(quality);

    requestAnimationFrame((t) => render(t / 1000));
}

function loadNewTape() {
    target = randomTarget();
    locked = false;
}

function autoTrackBurst() {
    const current = Number(tracking.value);
    const delta = target - current;
    const nudge = delta * (0.45 + Math.random() * 0.2);
    tracking.value = Math.round(current + nudge);
    updateReadouts();
}

function cleanHeads() {
    cleanBoost = 0.2;
    cleanBtn.classList.add('ghost');
    if (cleanTimeout) {
        clearTimeout(cleanTimeout);
    }
    cleanTimeout = setTimeout(() => {
        cleanBoost = 0;
        cleanBtn.classList.remove('ghost');
    }, 6000);
}

function startAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 1.5, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1200;

    noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
    noiseSource.start();
}

function stopAudio() {
    if (!audioCtx) return;
    noiseSource.stop();
    noiseSource.disconnect();
    noiseFilter.disconnect();
    noiseGain.disconnect();
    audioCtx.close();
    audioCtx = null;
    noiseSource = null;
    noiseFilter = null;
    noiseGain = null;
}

function updateAudio(quality) {
    if (!audioOn || !audioCtx || !noiseGain || !noiseFilter) return;
    const now = audioCtx.currentTime;
    const wear = Number(age.value) / 100;
    const noiseLevel = 0.015 + (1 - quality) * 0.12 + wear * 0.04;
    noiseGain.gain.setTargetAtTime(noiseLevel, now, 0.05);
    noiseFilter.frequency.setTargetAtTime(600 + quality * 2000, now, 0.05);
}

function playLockChime() {
    if (!audioOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
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

tracking.addEventListener('input', updateReadouts);
age.addEventListener('input', updateReadouts);

newTapeBtn.addEventListener('click', loadNewTape);
autoTrackBtn.addEventListener('click', autoTrackBurst);
cleanBtn.addEventListener('click', cleanHeads);
audioBtn.addEventListener('click', toggleAudio);

updateReadouts();
requestAnimationFrame((t) => render(t / 1000));
