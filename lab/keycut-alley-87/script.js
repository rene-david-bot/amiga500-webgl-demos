const TOOTH_COUNT = 8;
const MIN_HEIGHT = 1;
const MAX_HEIGHT = 5;

const canvas = document.getElementById('bench');
const ctx = canvas.getContext('2d');

const roundEl = document.getElementById('round');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const toothGrid = document.getElementById('tooth-grid');

const compareBtn = document.getElementById('compare');
const newShiftBtn = document.getElementById('new-shift');
const audioToggleBtn = document.getElementById('audio-toggle');

const state = {
    round: 1,
    score: 0,
    streak: 0,
    movesUsed: 0,
    maxMoves: 20,
    timeLeft: 30,
    timeLimit: 30,
    running: true,
    target: [],
    player: [],
    raf: null,
    lastTs: 0,
    audioEnabled: false,
    audioCtx: null
};

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomProfile() {
    return Array.from({ length: TOOTH_COUNT }, () => randInt(MIN_HEIGHT, MAX_HEIGHT));
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function beep({ type = 'square', freq = 440, dur = 0.08, vol = 0.035, glide = 0.9 } = {}) {
    if (!state.audioEnabled) return;

    ensureAudio();
    const now = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * glide), now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function successJingle() {
    if (!state.audioEnabled) return;

    const notes = [392, 523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
        setTimeout(() => beep({ type: 'triangle', freq: f, dur: 0.11, vol: 0.045, glide: 1.04 }), i * 70);
    });
}

function failBuzz() {
    if (!state.audioEnabled) return;
    beep({ type: 'sawtooth', freq: 160, dur: 0.18, vol: 0.05, glide: 0.6 });
    setTimeout(() => beep({ type: 'square', freq: 120, dur: 0.22, vol: 0.045, glide: 0.55 }), 40);
}

function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('good', 'warn', 'bad');
    if (kind) messageEl.classList.add(kind);
}

function updateStats() {
    roundEl.textContent = String(state.round);
    scoreEl.textContent = String(state.score);
    streakEl.textContent = String(state.streak);
    movesEl.textContent = `${state.movesUsed} / ${state.maxMoves}`;
    timerEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;

    if (state.timeLeft < 6 && state.running) {
        timerEl.style.color = '#ff7e98';
    } else {
        timerEl.style.color = '#eaf0ff';
    }
}

function drawKey(y, profile, options = {}) {
    const {
        label = 'KEY',
        bodyColor = '#89f0ff',
        edgeColor = '#d8f9ff',
        glow = '#64d8ff33'
    } = options;

    const x = 116;
    const shaftW = 700;
    const shaftH = 94;
    const toothW = shaftW / TOOTH_COUNT;
    const tip = 38;

    const mapDepth = (v) => 14 + (v - 1) * 12;

    ctx.save();
    ctx.translate(x, y);

    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(70, 0);
    for (let i = 0; i < TOOTH_COUNT; i += 1) {
        const x1 = 70 + i * toothW;
        const mid = x1 + toothW * 0.48;
        const x2 = x1 + toothW;
        const d = mapDepth(profile[i]);
        ctx.lineTo(x1, 0);
        ctx.lineTo(mid, d);
        ctx.lineTo(x2, 0);
    }

    const shaftEnd = 70 + shaftW;
    ctx.lineTo(shaftEnd, 0);
    ctx.lineTo(shaftEnd + tip, shaftH * 0.42);
    ctx.lineTo(shaftEnd, shaftH);
    ctx.lineTo(70, shaftH);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(24, shaftH * 0.52, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(24, shaftH * 0.52, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1431';
    ctx.fill();

    ctx.fillStyle = '#f4fbff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(label, 82, shaftH + 26);

    ctx.restore();
}

function drawOverlay() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#101b43');
    g.addColorStop(0.6, '#081024');
    g.addColorStop(1, '#05080f');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, y, canvas.width, 1);
    }

    for (let i = 0; i < 70; i += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillStyle = `rgba(180,220,255,${Math.random() * 0.16})`;
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawDiffHints() {
    const baseX = 186;
    const toothW = 700 / TOOTH_COUNT;

    for (let i = 0; i < TOOTH_COUNT; i += 1) {
        const match = state.player[i] === state.target[i];
        const x = baseX + i * toothW + toothW / 2;

        ctx.fillStyle = match ? '#7cffab' : '#ffad7e';
        ctx.beginPath();
        ctx.arc(x, 246, match ? 5.4 : 4.6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = '#b8c7f7';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Dots: green = matched tooth, orange = needs work', 24, 244);
}

function draw() {
    drawOverlay();

    drawKey(58, state.target, {
        label: 'TARGET CUT',
        bodyColor: '#7ee6ff',
        edgeColor: '#d8f8ff',
        glow: '#66dfff55'
    });

    drawDiffHints();

    drawKey(258, state.player, {
        label: 'YOUR CUT',
        bodyColor: '#ff89c4',
        edgeColor: '#ffd8ec',
        glow: '#ff7bc955'
    });

    ctx.fillStyle = '#f3f7ff';
    ctx.font = 'bold 17px "Courier New", monospace';
    ctx.fillText('KEYCUT ALLEY • NIGHT SHIFT', 22, 28);

    ctx.fillStyle = '#a8b9f4';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(`Tolerance: perfect profile only  |  Round ${state.round}`, 22, 46);
}

function profilesMatch() {
    return state.player.every((v, i) => v === state.target[i]);
}

function mismatchCount() {
    return state.player.reduce((acc, v, i) => acc + (v === state.target[i] ? 0 : 1), 0);
}

function updateToothControls() {
    toothGrid.querySelectorAll('.tooth').forEach((el, i) => {
        const val = el.querySelector('.value');
        val.textContent = String(state.player[i]);

        if (state.player[i] === state.target[i]) {
            el.style.borderColor = '#57d391';
            el.style.boxShadow = '0 0 0 1px rgba(87,211,145,0.3) inset';
        } else {
            el.style.borderColor = '#485da3';
            el.style.boxShadow = 'none';
        }
    });
}

function setTooth(index, delta) {
    if (!state.running) return;

    const next = clamp(state.player[index] + delta, MIN_HEIGHT, MAX_HEIGHT);
    if (next === state.player[index]) return;

    state.player[index] = next;
    state.movesUsed += 1;

    beep({ type: 'square', freq: 260 + next * 64, dur: 0.06, vol: 0.028, glide: 0.96 });

    updateToothControls();
    updateStats();

    if (profilesMatch()) {
        handleSuccess();
        return;
    }

    if (state.movesUsed >= state.maxMoves) {
        handleFail('Out of moves. The client walked out.');
    }
}

function buildToothControls() {
    toothGrid.innerHTML = '';

    for (let i = 0; i < TOOTH_COUNT; i += 1) {
        const card = document.createElement('div');
        card.className = 'tooth';
        card.innerHTML = `
            <div class="idx">TOOTH ${i + 1}</div>
            <button data-i="${i}" data-d="1">▲</button>
            <div class="value">3</div>
            <button data-i="${i}" data-d="-1">▼</button>
        `;
        toothGrid.appendChild(card);
    }

    toothGrid.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-i]');
        if (!btn) return;

        const index = Number(btn.dataset.i);
        const delta = Number(btn.dataset.d);
        setTooth(index, delta);
    });
}

function startRound(reset = false) {
    if (reset) {
        state.round = 1;
        state.score = 0;
        state.streak = 0;
    }

    state.timeLimit = Math.max(16, 30 - (state.round - 1) * 1.15);
    state.timeLeft = state.timeLimit;
    state.maxMoves = Math.max(12, 20 - Math.floor((state.round - 1) / 2));
    state.movesUsed = 0;
    state.running = true;

    state.target = randomProfile();
    state.player = randomProfile();

    while (profilesMatch()) {
        state.player = randomProfile();
    }

    setMessage(`Round ${state.round}: Match all 8 teeth. Precision beats speed.`, 'warn');

    updateToothControls();
    updateStats();
    draw();
}

function handleSuccess() {
    if (!state.running) return;
    state.running = false;

    const bonus = Math.round(state.timeLeft * 4) + state.streak * 25;
    const points = 120 + bonus;

    state.score += points;
    state.streak += 1;

    successJingle();

    setMessage(`Perfect cut! +${points} points. Loading next client…`, 'good');
    updateStats();

    setTimeout(() => {
        state.round += 1;
        startRound(false);
    }, 820);
}

function handleFail(reason) {
    if (!state.running) return;
    state.running = false;
    state.streak = 0;

    failBuzz();

    setMessage(`${reason} Final score: ${state.score}. Hit New Shift to run it again.`, 'bad');
    updateStats();
    draw();
}

function compareNow() {
    if (!state.running) return;

    if (profilesMatch()) {
        handleSuccess();
        return;
    }

    const miss = mismatchCount();
    state.timeLeft = Math.max(0, state.timeLeft - 2.5);

    beep({ type: 'triangle', freq: 190, dur: 0.11, vol: 0.036, glide: 0.8 });
    setMessage(`${miss} ${miss === 1 ? 'tooth' : 'teeth'} off. -2.5s penalty.`, 'warn');

    updateToothControls();
    updateStats();

    if (state.timeLeft <= 0) {
        handleFail('Time over. Bench closes at dawn.');
    }
}

function toggleAudio() {
    state.audioEnabled = !state.audioEnabled;
    audioToggleBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;

    if (state.audioEnabled) {
        ensureAudio();
        beep({ type: 'triangle', freq: 622, dur: 0.1, vol: 0.04, glide: 0.98 });
        setMessage('Audio online. Bench beeps enabled.', 'good');
    } else {
        setMessage('Audio muted. Visual play only.', 'warn');
    }
}

function gameLoop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(60, ts - state.lastTs) / 1000;
    state.lastTs = ts;

    if (state.running) {
        state.timeLeft = Math.max(0, state.timeLeft - dt);

        if (state.timeLeft <= 0) {
            handleFail('Time over. Bench closes at dawn.');
        }
    }

    updateStats();
    draw();

    state.raf = requestAnimationFrame(gameLoop);
}

function bindEvents() {
    compareBtn.addEventListener('click', compareNow);
    newShiftBtn.addEventListener('click', () => {
        beep({ type: 'square', freq: 280, dur: 0.07, vol: 0.03, glide: 0.95 });
        startRound(true);
    });
    audioToggleBtn.addEventListener('click', toggleAudio);

    window.addEventListener('keydown', (event) => {
        if (!state.running) return;

        if (event.key === 'Enter') {
            compareNow();
            return;
        }

        const idx = Number(event.key) - 1;
        if (idx >= 0 && idx < TOOTH_COUNT) {
            setTooth(idx, 1);
            return;
        }

        if (event.key.toLowerCase() === 'q') {
            setTooth(0, -1);
        }
    });
}

function init() {
    buildToothControls();
    bindEvents();
    startRound(true);
    state.raf = requestAnimationFrame(gameLoop);
}

init();
