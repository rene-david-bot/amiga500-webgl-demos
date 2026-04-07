const scoreEl = document.getElementById('score');
const clockEl = document.getElementById('clock');
const clearedEl = document.getElementById('cleared');
const queueEl = document.getElementById('queue');
const strikesEl = document.getElementById('strikes');
const flowEl = document.getElementById('flow');
const headlineEl = document.getElementById('headline');
const boardEl = document.getElementById('board');
const messageEl = document.getElementById('message');

const startBtn = document.getElementById('start');
const whistleBtn = document.getElementById('whistle');

const MAX_STRIKES = 5;
const SHIFT_TIME = 90;
const BOARD_HEIGHT = 460;

const state = {
    running: false,
    score: 0,
    clock: SHIFT_TIME,
    cleared: 0,
    strikes: 0,
    passengers: [],
    spawnTimer: 0,
    spawnEvery: 1.35,
    riderId: 0,
    lastFrame: 0,
    raf: null,
    whistleCooldown: 0,
    audioCtx: null,
    audioReady: false
};

function setMessage(text, tone = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('good', 'bad', 'warn');
    if (tone) messageEl.classList.add(tone);
}

function updateHUD() {
    scoreEl.textContent = String(state.score);
    clockEl.textContent = `${Math.max(0, state.clock).toFixed(1)}s`;
    clearedEl.textContent = String(state.cleared);

    const queue = state.passengers.filter((p) => p.type === 'walk' ? p.lane !== 0 : p.lane !== 1).length;
    queueEl.textContent = String(queue);

    strikesEl.textContent = `${state.strikes} / ${MAX_STRIKES}`;

    if (!state.running) {
        flowEl.textContent = 'Idle';
    } else if (queue <= 2) {
        flowEl.textContent = 'Smooth';
    } else if (queue <= 4) {
        flowEl.textContent = 'Busy';
    } else {
        flowEl.textContent = 'Jammed';
    }

    whistleBtn.textContent = state.whistleCooldown > 0
        ? `Whistle ${state.whistleCooldown.toFixed(1)}s`
        : 'Use Whistle';
    whistleBtn.disabled = !state.running || state.whistleCooldown > 0;
}

function laneX(lane) {
    return lane === 0 ? 25 : 75;
}

function preferredLane(type) {
    return type === 'walk' ? 0 : 1;
}

function speedFor(passenger) {
    const rightLane = passenger.lane === preferredLane(passenger.type);

    if (passenger.type === 'walk') {
        return rightLane ? 84 : 38;
    }

    return rightLane ? 52 : 27;
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
    state.audioReady = true;
}

function blip(freq = 620, duration = 0.1, level = 0.03) {
    if (!state.audioReady || !state.audioCtx) return;
    const now = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

function createPassenger() {
    const type = Math.random() < 0.52 ? 'walk' : 'stand';
    const idealLane = preferredLane(type);

    const passenger = {
        id: ++state.riderId,
        type,
        lane: Math.random() < 0.68 ? idealLane : 1 - idealLane,
        y: BOARD_HEIGHT + 32,
        frustration: 0,
        canSwapAt: 0,
        el: null
    };

    const el = document.createElement('button');
    el.className = 'rider';
    el.type = 'button';
    el.dataset.id = String(passenger.id);
    el.dataset.type = type;
    el.innerHTML = `
        <span class="chip ${type}">${type === 'walk' ? 'W' : 'S'}</span>
        <span class="id">#${String(passenger.id).padStart(2, '0')}</span>
        <span class="meter"><span></span></span>
    `;

    passenger.el = el;
    boardEl.appendChild(el);
    state.passengers.push(passenger);
}

function placePassenger(passenger) {
    passenger.el.dataset.lane = String(passenger.lane);
    passenger.el.style.top = `${passenger.y}px`;

    const level = Math.min(100, Math.round((passenger.frustration / 6) * 100));
    const meter = passenger.el.querySelector('.meter > span');
    meter.style.width = `${Math.max(8, level)}%`;

    passenger.el.classList.toggle('hot', passenger.frustration > 4.4);
}

function removePassenger(passenger) {
    passenger.el.remove();
    state.passengers = state.passengers.filter((p) => p.id !== passenger.id);
}

function swapLane(passenger) {
    passenger.lane = passenger.lane === 0 ? 1 : 0;
    passenger.canSwapAt = 0.28;
    placePassenger(passenger);

    const fixed = passenger.lane === preferredLane(passenger.type);
    if (fixed) {
        state.score += 8;
        setMessage(`Nice redirect. Rider #${passenger.id} moved to the correct lane.`, 'good');
        blip(820, 0.09, 0.026);
    } else {
        setMessage(`Rider #${passenger.id} is still in the wrong lane.`, 'warn');
        blip(420, 0.08, 0.025);
    }
}

function spendWhistle() {
    if (state.whistleCooldown > 0 || !state.running) return;

    const target = state.passengers
        .filter((p) => p.lane !== preferredLane(p.type))
        .sort((a, b) => b.frustration - a.frustration)[0];

    if (!target) {
        setMessage('Whistle blown. No violations to fix right now.', 'warn');
        state.whistleCooldown = 4;
        return;
    }

    target.lane = preferredLane(target.type);
    target.frustration = Math.max(0, target.frustration - 2.6);
    placePassenger(target);

    state.score += 14;
    state.whistleCooldown = 8.5;
    setMessage(`Whistle assist! Rider #${target.id} snapped into lane discipline.`, 'good');
    blip(960, 0.12, 0.03);
}

function endShift(reason) {
    state.running = false;

    if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = null;
    }

    headlineEl.textContent = 'Shift complete';

    if (reason === 'strikes') {
        setMessage(`Terminal jam. ${MAX_STRIKES} strikes reached with score ${state.score}.`, 'bad');
    } else {
        setMessage(`Clock out. Score ${state.score}, riders cleared ${state.cleared}, strikes ${state.strikes}.`, 'warn');
    }

    startBtn.textContent = 'Start New Shift';
    updateHUD();
}

function gameLoop(ts) {
    if (!state.running) return;

    if (!state.lastFrame) state.lastFrame = ts;
    const dt = Math.min(0.05, (ts - state.lastFrame) / 1000);
    state.lastFrame = ts;

    state.clock -= dt;
    state.spawnTimer -= dt;
    state.whistleCooldown = Math.max(0, state.whistleCooldown - dt);

    if (state.spawnTimer <= 0) {
        createPassenger();
        const loadFactor = Math.min(0.5, state.cleared / 120);
        state.spawnEvery = Math.max(0.56, state.spawnEvery - loadFactor * 0.03 + (Math.random() * 0.08 - 0.04));
        state.spawnTimer = state.spawnEvery;
    }

    const toRemove = [];

    state.passengers.forEach((passenger) => {
        passenger.canSwapAt = Math.max(0, passenger.canSwapAt - dt);

        const mismatch = passenger.lane !== preferredLane(passenger.type);
        if (mismatch) {
            passenger.frustration += dt * 1.35;
            state.score = Math.max(0, state.score - Math.floor(dt * 7));
        } else {
            passenger.frustration = Math.max(0, passenger.frustration - dt * 1.8);
        }

        passenger.y -= speedFor(passenger) * dt;

        if (passenger.frustration >= 6) {
            state.strikes += 1;
            setMessage(`Jam alert: rider #${passenger.id} melted down in the wrong lane.`, 'bad');
            blip(230, 0.18, 0.04);
            toRemove.push(passenger);
            return;
        }

        if (passenger.y < -36) {
            state.cleared += 1;
            const cleanRun = passenger.frustration < 1;
            state.score += cleanRun ? 26 : 12;
            if (cleanRun && Math.random() < 0.35) {
                setMessage('Flow bonus! Perfect lane etiquette boosts score.', 'good');
            }
            toRemove.push(passenger);
            return;
        }

        placePassenger(passenger);
    });

    toRemove.forEach(removePassenger);

    if (state.strikes >= MAX_STRIKES) {
        endShift('strikes');
        return;
    }

    if (state.clock <= 0) {
        endShift('clock');
        return;
    }

    updateHUD();
    state.raf = requestAnimationFrame(gameLoop);
}

function resetShift() {
    state.passengers.forEach((p) => p.el.remove());
    state.passengers = [];
    state.score = 0;
    state.clock = SHIFT_TIME;
    state.cleared = 0;
    state.strikes = 0;
    state.spawnTimer = 0.7;
    state.spawnEvery = 1.35;
    state.lastFrame = 0;
    state.whistleCooldown = 0;
    state.riderId = 0;
}

function startShift() {
    try {
        ensureAudio();
        if (state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
        }
    } catch (error) {
        // Audio is optional.
    }

    resetShift();
    state.running = true;
    startBtn.textContent = 'Restart Shift';
    headlineEl.textContent = 'Sort the crowd, keep lanes clean';
    setMessage('Rush hour live. Walkers left, standers right. Keep it moving.', 'warn');
    updateHUD();
    state.raf = requestAnimationFrame(gameLoop);
}

boardEl.addEventListener('click', (event) => {
    if (!state.running) return;

    const rider = event.target.closest('.rider');
    if (!rider) return;

    const id = Number(rider.dataset.id);
    const passenger = state.passengers.find((p) => p.id === id);
    if (!passenger || passenger.canSwapAt > 0) return;

    swapLane(passenger);
    updateHUD();
});

startBtn.addEventListener('click', startShift);
whistleBtn.addEventListener('click', () => {
    spendWhistle();
    updateHUD();
});

updateHUD();
