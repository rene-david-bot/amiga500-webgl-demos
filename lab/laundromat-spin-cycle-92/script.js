const gaugesEl = document.getElementById('gauges');
const ticketTitle = document.getElementById('ticket-title');
const ticketSub = document.getElementById('ticket-sub');
const resultText = document.getElementById('result-text');

const ticketsEl = document.getElementById('tickets');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');

const newTicketBtn = document.getElementById('new-ticket');
const resetBtn = document.getElementById('reset');

const LOADS = [
    'denim jackets',
    'arcade uniforms',
    'roller rink towels',
    'night-shift aprons',
    'neon gym socks',
    'food court hoodies',
    'cinema seat covers',
    'garage overalls'
];

const STAINS = [
    'cola spill',
    'printer ink',
    'ketchup streaks',
    'grease spots',
    'marker graffiti',
    'mud splash',
    'syrup stains'
];

const URGENCY = ['Relaxed', 'Busy', 'Rush'];

const CONFIG = [
    { id: 'temp', label: 'Water Temp', hint: 'Cold ← → Hot', baseSpeed: 0.46 },
    { id: 'spin', label: 'Spin RPM', hint: 'Gentle ← → Turbo', baseSpeed: 0.62 },
    { id: 'soap', label: 'Detergent Mix', hint: 'Light ← → Heavy', baseSpeed: 0.54 }
];

const state = {
    gauges: [],
    active: false,
    ticketCount: 0,
    score: 0,
    streak: 0,
    ticket: null,
    raf: null,
    lastTs: 0,
    audioCtx: null
};

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function chirp(freq = 480, duration = 0.08, type = 'square', volume = 0.05) {
    if (!state.audioCtx) return;
    const now = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.82, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
}

function renderStats() {
    ticketsEl.textContent = String(state.ticketCount);
    scoreEl.textContent = String(state.score);
    streakEl.textContent = String(state.streak);
}

function setResult(text, tone = '') {
    resultText.textContent = text;
    resultText.classList.remove('good', 'warn', 'bad');
    if (tone) resultText.classList.add(tone);
}

function buildGaugeDom(g) {
    const container = document.createElement('article');
    container.className = 'gauge';

    const head = document.createElement('div');
    head.className = 'gauge-head';

    const title = document.createElement('h3');
    title.className = 'gauge-title';
    title.textContent = g.label;

    const meta = document.createElement('p');
    meta.className = 'gauge-meta';
    meta.textContent = g.hint;

    const track = document.createElement('div');
    track.className = 'track';

    const target = document.createElement('div');
    target.className = 'target';

    const marker = document.createElement('div');
    marker.className = 'marker';

    track.append(target, marker);

    const lockBtn = document.createElement('button');
    lockBtn.textContent = 'Lock';

    head.append(title, meta);
    container.append(head, track, lockBtn);

    g.dom = { container, target, marker, lockBtn };

    lockBtn.addEventListener('click', () => lockGauge(g.id));
    return container;
}

function initGauges() {
    state.gauges = CONFIG.map((cfg, idx) => ({
        ...cfg,
        value: 10 + Math.random() * 80,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: cfg.baseSpeed + Math.random() * 0.34 + idx * 0.04,
        locked: false,
        targetCenter: 50,
        targetWidth: 18,
        dom: null
    }));

    gaugesEl.innerHTML = '';
    state.gauges.forEach((g) => gaugesEl.appendChild(buildGaugeDom(g)));
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickTicket() {
    const urgency = URGENCY[randomInt(0, URGENCY.length - 1)];
    const widthByUrgency = { Relaxed: 20, Busy: 16, Rush: 12 };
    const streakPenalty = Math.min(5, state.streak) * 1.3;

    const ticket = {
        load: LOADS[randomInt(0, LOADS.length - 1)],
        stain: STAINS[randomInt(0, STAINS.length - 1)],
        urgency,
        ticketNo: randomInt(120, 988),
        width: Math.max(8, widthByUrgency[urgency] - streakPenalty)
    };

    state.gauges.forEach((g) => {
        g.targetCenter = randomInt(16, 84);
        g.targetWidth = ticket.width;
        g.locked = false;
        g.dom.container.classList.remove('locked');
        g.dom.lockBtn.disabled = false;
        g.dom.lockBtn.textContent = 'Lock';
    });

    state.ticket = ticket;
    ticketTitle.textContent = `Ticket #${ticket.ticketNo} · ${ticket.load}`;
    ticketSub.textContent = `${ticket.stain} · Urgency: ${ticket.urgency}`;

    setResult('Load ready. Lock all gauges in their cyan target windows.');
}

function renderGauge(g) {
    const left = Math.max(0, g.targetCenter - g.targetWidth / 2);
    const width = Math.min(100 - left, g.targetWidth);

    g.dom.target.style.left = `${left}%`;
    g.dom.target.style.width = `${width}%`;
    g.dom.marker.style.left = `calc(${g.value}% - 5px)`;
}

function update(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(34, ts - state.lastTs);
    state.lastTs = ts;

    state.gauges.forEach((g) => {
        if (!g.locked) {
            g.value += g.dir * g.speed * (dt / 16);
            if (g.value <= 0) {
                g.value = 0;
                g.dir = 1;
            } else if (g.value >= 100) {
                g.value = 100;
                g.dir = -1;
            }
        }
        renderGauge(g);
    });

    state.raf = requestAnimationFrame(update);
}

function lockGauge(id) {
    if (!state.active) return;
    const gauge = state.gauges.find((g) => g.id === id);
    if (!gauge || gauge.locked) return;

    ensureAudio();
    gauge.locked = true;
    gauge.dom.container.classList.add('locked');
    gauge.dom.lockBtn.disabled = true;
    gauge.dom.lockBtn.textContent = 'Locked';

    chirp(560 + Math.random() * 120, 0.09, 'square', 0.045);

    if (state.gauges.every((g) => g.locked)) {
        resolveTicket();
    }
}

function distanceToWindow(value, center, width) {
    const half = width / 2;
    const min = center - half;
    const max = center + half;
    if (value >= min && value <= max) return 0;
    return value < min ? min - value : value - max;
}

function resolveTicket() {
    state.active = false;
    state.ticketCount += 1;

    let points = 0;
    let nearMisses = 0;

    state.gauges.forEach((g) => {
        const dist = distanceToWindow(g.value, g.targetCenter, g.targetWidth);
        if (dist === 0) {
            points += 30;
        } else if (dist <= 6) {
            points += 14;
            nearMisses += 1;
        } else if (dist <= 12) {
            points += 6;
            nearMisses += 1;
        }
    });

    const bonus = Math.min(60, state.streak * 6);
    let tone = 'warn';
    let line = 'Load finished. Acceptable clean. +';

    if (points >= 80) {
        state.streak += 1;
        points += bonus;
        tone = 'good';
        line = `Perfect cycle! Customer tipped you. +${points}`;
        ensureAudio();
        chirp(760, 0.08, 'triangle', 0.05);
        setTimeout(() => chirp(980, 0.1, 'triangle', 0.045), 70);
    } else if (points >= 58) {
        state.streak += 1;
        points += Math.floor(bonus * 0.6);
        line = `Solid wash job. +${points}`;
        ensureAudio();
        chirp(640, 0.08, 'triangle', 0.045);
    } else {
        state.streak = 0;
        tone = points >= 40 ? 'warn' : 'bad';
        line = points >= 40
            ? `Wrinkles survived, but passable. +${points}`
            : `Soap chaos. Rewash requested. +${points}`;
        ensureAudio();
        chirp(280, 0.14, 'sawtooth', 0.04);
    }

    state.score += points;
    renderStats();

    const hint = nearMisses
        ? ` (${nearMisses} near miss${nearMisses > 1 ? 'es' : ''})`
        : '';

    setResult(`${line}${hint}. Hit New Ticket for the next rush.`, tone);
}

function startTicket() {
    ensureAudio();
    pickTicket();
    state.active = true;
    state.lastTs = 0;
    chirp(500, 0.07, 'triangle', 0.04);
}

function resetShift() {
    state.active = false;
    state.ticketCount = 0;
    state.score = 0;
    state.streak = 0;
    state.ticket = null;

    state.gauges.forEach((g) => {
        g.locked = false;
        g.value = 10 + Math.random() * 80;
        g.dir = Math.random() > 0.5 ? 1 : -1;
        g.dom.container.classList.remove('locked');
        g.dom.lockBtn.disabled = true;
        g.dom.lockBtn.textContent = 'Lock';
        g.targetCenter = 50;
        g.targetWidth = 0;
        renderGauge(g);
    });

    ticketTitle.textContent = 'Night shift reset.';
    ticketSub.textContent = 'Press New Ticket to take your next customer load.';
    setResult('Shift reset complete. Laundry drums are idle.');
    renderStats();
}

newTicketBtn.addEventListener('click', () => {
    state.gauges.forEach((g) => {
        g.dom.lockBtn.disabled = false;
        g.dom.lockBtn.textContent = 'Lock';
    });
    startTicket();
});

resetBtn.addEventListener('click', () => {
    ensureAudio();
    chirp(330, 0.08, 'sawtooth', 0.035);
    resetShift();
});

initGauges();
state.gauges.forEach((g) => renderGauge(g));
renderStats();

state.raf = requestAnimationFrame(update);
