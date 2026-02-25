const canvas = document.getElementById('pet-canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const statEls = {
    hunger: document.getElementById('stat-hunger'),
    joy: document.getElementById('stat-joy'),
    energy: document.getElementById('stat-energy')
};
const statusEl = document.getElementById('status');
const moodEl = document.getElementById('mood');
const cycleEl = document.getElementById('cycle');

const soundButton = document.getElementById('sound');

const state = {
    hunger: 78,
    joy: 72,
    energy: 64,
    cycle: 0,
    mood: 'Curious',
    status: 'Byte Buddy online. Run a check-in.',
    lastMessageAt: 0,
    sparkles: []
};

const defaults = { hunger: 78, joy: 72, energy: 64 };
let audioOn = false;
let audioCtx = null;
let masterGain = null;
const bootTime = Date.now();

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.18;
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration = 0.12, type = 'square', offset = 0, volume = 0.4) {
    if (!audioOn) return;
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const startTime = audioCtx.currentTime + offset;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}

function playFeed() {
    playTone(220, 0.12, 'square', 0);
    playTone(330, 0.12, 'square', 0.14);
}

function playPlay() {
    playTone(440, 0.08, 'triangle', 0);
    playTone(660, 0.08, 'triangle', 0.1);
    playTone(520, 0.12, 'triangle', 0.2);
}

function playTune() {
    playTone(740, 0.06, 'sawtooth', 0);
    playTone(820, 0.06, 'sawtooth', 0.08);
    playTone(920, 0.08, 'sawtooth', 0.16);
}

function playRecharge() {
    playTone(160, 0.35, 'triangle', 0, 0.3);
    playTone(200, 0.35, 'triangle', 0.05, 0.2);
}

function setStatus(message) {
    state.status = message;
    state.lastMessageAt = Date.now();
}

function updateMood() {
    const minStat = Math.min(state.hunger, state.joy, state.energy);
    if (minStat <= 8) {
        state.mood = 'Critical';
        setStatus('Warning: low reserves detected.');
        return;
    }
    if (state.hunger < 25) {
        state.mood = 'Hungry';
        return;
    }
    if (state.energy < 25) {
        state.mood = 'Sleepy';
        return;
    }
    if (state.joy < 25) {
        state.mood = 'Lonely';
        return;
    }
    if (minStat < 45) {
        state.mood = 'Uneasy';
        return;
    }
    if (state.joy > 70 && state.hunger > 60 && state.energy > 60) {
        state.mood = 'Cheerful';
        return;
    }
    state.mood = 'Calm';
}

function updateUI() {
    statEls.hunger.style.width = `${state.hunger}%`;
    statEls.joy.style.width = `${state.joy}%`;
    statEls.energy.style.width = `${state.energy}%`;

    const sinceMessage = Date.now() - state.lastMessageAt;
    if (sinceMessage > 4000) {
        statusEl.textContent = state.mood === 'Critical'
            ? 'Systems failing — stabilize the pod!'
            : `Status: ${state.mood}.`;
    } else {
        statusEl.textContent = state.status;
    }

    moodEl.textContent = `Mood: ${state.mood}`;
    cycleEl.textContent = `Cycle ${String(state.cycle).padStart(4, '0')}`;
}

function sparkleBurst() {
    for (let i = 0; i < 12; i += 1) {
        state.sparkles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 120,
            y: canvas.height / 2 + (Math.random() - 0.5) * 80,
            life: 40 + Math.random() * 20,
            vx: (Math.random() - 0.5) * 1.4,
            vy: (Math.random() - 0.5) * 1.2,
            size: 2 + Math.random() * 2
        });
    }
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0f1931');
    gradient.addColorStop(1, '#050812');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(94, 243, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(94, 243, 255, 0.05)';
    for (let x = 0; x < canvas.width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
    }
}

function drawPet(timestamp) {
    const bob = Math.sin(timestamp / 400) * 3;
    const blink = Math.floor(timestamp / 180) % 18 === 0;
    const minStat = Math.min(state.hunger, state.joy, state.energy);

    let body = '#6fe3ff';
    let accent = '#c9f8ff';
    if (minStat < 30) {
        body = '#ffb454';
        accent = '#ffe2a1';
    }
    if (minStat < 15) {
        body = '#ff6b6b';
        accent = '#ffb0b0';
    }

    const scale = 8;
    const cx = canvas.width / 2 - 6 * scale;
    const cy = canvas.height / 2 - 6 * scale + bob;

    ctx.fillStyle = 'rgba(8, 12, 24, 0.6)';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2 + 42, 56, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = body;
    ctx.fillRect(cx + 2 * scale, cy + 4 * scale, 8 * scale, 6 * scale);
    ctx.fillRect(cx + 1 * scale, cy + 2 * scale, 10 * scale, 4 * scale);
    ctx.fillRect(cx + 3 * scale, cy + 1 * scale, 6 * scale, 2 * scale);

    ctx.fillStyle = accent;
    ctx.fillRect(cx + 2 * scale, cy + 4 * scale, 8 * scale, 2 * scale);
    ctx.fillRect(cx + 3 * scale, cy + 2 * scale, 6 * scale, 1 * scale);

    ctx.fillStyle = '#0c0f1c';
    if (blink || state.energy < 20) {
        ctx.fillRect(cx + 3 * scale, cy + 5 * scale, 2 * scale, 1 * scale);
        ctx.fillRect(cx + 7 * scale, cy + 5 * scale, 2 * scale, 1 * scale);
    } else {
        ctx.fillRect(cx + 3 * scale, cy + 5 * scale, 2 * scale, 2 * scale);
        ctx.fillRect(cx + 7 * scale, cy + 5 * scale, 2 * scale, 2 * scale);
    }

    ctx.fillStyle = '#0c0f1c';
    if (state.mood === 'Cheerful') {
        ctx.fillRect(cx + 5 * scale, cy + 7 * scale, 2 * scale, 1 * scale);
    } else if (state.mood === 'Critical' || state.mood === 'Hungry') {
        ctx.fillRect(cx + 4 * scale, cy + 7 * scale, 4 * scale, 1 * scale);
    } else if (state.mood === 'Sleepy') {
        ctx.fillRect(cx + 4 * scale, cy + 7 * scale, 3 * scale, 1 * scale);
    } else {
        ctx.fillRect(cx + 4 * scale, cy + 7 * scale, 3 * scale, 1 * scale);
        ctx.fillRect(cx + 4 * scale, cy + 8 * scale, 3 * scale, 1 * scale);
    }

    ctx.fillStyle = accent;
    ctx.fillRect(cx + 5 * scale, cy - 1 * scale, 2 * scale, 2 * scale);
    ctx.fillRect(cx + 5 * scale, cy - 3 * scale, 2 * scale, 2 * scale);

    ctx.fillStyle = '#14203b';
    ctx.fillRect(cx + 5 * scale, cy - 5 * scale, 2 * scale, 2 * scale);
    ctx.fillStyle = accent;
    ctx.fillRect(cx + 5.5 * scale, cy - 4.5 * scale, scale, scale);

    if (state.joy > 70) {
        ctx.strokeStyle = 'rgba(94, 243, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawSparkles() {
    state.sparkles = state.sparkles.filter((sparkle) => sparkle.life > 0);
    state.sparkles.forEach((sparkle) => {
        sparkle.life -= 1;
        sparkle.x += sparkle.vx;
        sparkle.y += sparkle.vy;
        ctx.fillStyle = `rgba(94, 243, 255, ${sparkle.life / 60})`;
        ctx.fillRect(sparkle.x, sparkle.y, sparkle.size, sparkle.size);
    });
}

function render(timestamp) {
    drawBackground();
    drawPet(timestamp);
    drawSparkles();
    requestAnimationFrame(render);
}

function applyStats(delta) {
    state.hunger = clamp(state.hunger + (delta.hunger || 0));
    state.joy = clamp(state.joy + (delta.joy || 0));
    state.energy = clamp(state.energy + (delta.energy || 0));
    updateMood();
    updateUI();
}

function tick() {
    state.hunger = clamp(state.hunger - 0.35);
    state.joy = clamp(state.joy - 0.25);
    state.energy = clamp(state.energy - 0.2);
    state.cycle = Math.floor((Date.now() - bootTime) / 12000);
    updateMood();
    updateUI();
}

function bindActions() {
    document.getElementById('feed').addEventListener('click', () => {
        applyStats({ hunger: 28, joy: 4 });
        setStatus('Feeding sequence engaged.');
        sparkleBurst();
        playFeed();
    });

    document.getElementById('play').addEventListener('click', () => {
        applyStats({ joy: 24, energy: -10, hunger: -6 });
        setStatus('Playtime activated.');
        sparkleBurst();
        playPlay();
    });

    document.getElementById('tune').addEventListener('click', () => {
        applyStats({ joy: 12, energy: -4 });
        setStatus('Tuning the harmonics.');
        sparkleBurst();
        playTune();
    });

    document.getElementById('recharge').addEventListener('click', () => {
        applyStats({ energy: 30, hunger: -6 });
        setStatus('Recharge cycle started.');
        sparkleBurst();
        playRecharge();
    });

    document.getElementById('reset').addEventListener('click', () => {
        state.hunger = defaults.hunger;
        state.joy = defaults.joy;
        state.energy = defaults.energy;
        setStatus('Reset complete. Byte Buddy is steady.');
        updateMood();
        updateUI();
    });

    soundButton.addEventListener('click', () => {
        audioOn = !audioOn;
        if (audioOn) {
            ensureAudio();
        }
        soundButton.textContent = `Sound: ${audioOn ? 'On' : 'Off'}`;
    });
}

bindActions();
updateMood();
updateUI();

const params = new URLSearchParams(window.location.search);
if (params.has('selftest')) {
    audioOn = true;
    try {
        ensureAudio();
        soundButton.textContent = 'Sound: On';
        playTune();
        document.body.dataset.audioTest = 'on';
    } catch (error) {
        document.body.dataset.audioTest = 'error';
    }
}

setInterval(tick, 1000);
requestAnimationFrame(render);
