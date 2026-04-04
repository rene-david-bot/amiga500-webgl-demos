const itemsEl = document.getElementById('items');
const trayListEl = document.getElementById('tray-list');

const customerCountEl = document.getElementById('customer-count');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const targetEl = document.getElementById('target');
const subtotalEl = document.getElementById('subtotal');
const customerNameEl = document.getElementById('customer-name');
const hintEl = document.getElementById('hint');
const timerBarEl = document.getElementById('timer-bar');
const statusEl = document.getElementById('status');

const undoBtn = document.getElementById('undo');
const clearBtn = document.getElementById('clear');
const serveBtn = document.getElementById('serve');
const newGameBtn = document.getElementById('new-game');

const TOTAL_CUSTOMERS = 8;
const START_LIVES = 3;

const MENU = [
    { id: 'popcorn', name: 'Butter Popcorn', cents: 180 },
    { id: 'soda', name: 'Cherry Soda', cents: 120 },
    { id: 'candy', name: 'Pixel Candy', cents: 90 },
    { id: 'nachos', name: 'Neon Nachos', cents: 210 },
    { id: 'hotdog', name: 'Turbo Hot Dog', cents: 240 },
    { id: 'pretzel', name: 'Arcade Pretzel', cents: 150 },
    { id: 'gum', name: 'Glitch Gum Pack', cents: 60 }
];

const callSigns = ['Seat A05', 'Seat C12', 'Balcony F03', 'Row J09', 'Back Row M02', 'VIP Box 2', 'Row H14', 'Seat D07', 'Balcony B11'];

let audioCtx;
let timerHandle;

const state = {
    customerIndex: 0,
    lives: START_LIVES,
    score: 0,
    combo: 0,
    shiftOver: false,
    tray: [],
    subtotal: 0,
    customer: null,
    timeLeft: 0,
    roundTime: 0
};

function fmt(cents) {
    return `€${(cents / 100).toFixed(2)}`;
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
}

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function chirp(freq, duration = 0.09, type = 'square', gain = 0.06) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    amp.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function updateHud() {
    const current = Math.min(state.customerIndex + 1, TOTAL_CUSTOMERS);
    customerCountEl.textContent = `${current} / ${TOTAL_CUSTOMERS}`;
    livesEl.textContent = String(state.lives);
    scoreEl.textContent = String(state.score);
    comboEl.textContent = `x${state.combo}`;
    targetEl.textContent = state.customer ? fmt(state.customer.target) : '€0.00';
    subtotalEl.textContent = fmt(state.subtotal);
}

function renderTray() {
    trayListEl.innerHTML = '';

    if (!state.tray.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'Tray is empty — tap snacks to add.';
        trayListEl.appendChild(li);
        return;
    }

    state.tray.forEach((item, idx) => {
        const li = document.createElement('li');

        const label = document.createElement('span');
        label.textContent = `${idx + 1}. ${item.name}`;

        const price = document.createElement('strong');
        price.textContent = fmt(item.cents);

        li.append(label, price);
        trayListEl.appendChild(li);
    });
}

function buildMenu() {
    itemsEl.innerHTML = '';

    MENU.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'item-btn';
        button.innerHTML = `<span class="name">${item.name}</span><span class="price">${fmt(item.cents)}</span>`;

        button.addEventListener('click', () => {
            if (state.shiftOver) return;
            ensureAudio();

            state.tray.push(item);
            state.subtotal += item.cents;

            updateHud();
            renderTray();
            setStatus(`${item.name} added to tray.`);
            chirp(260 + item.cents * 0.22, 0.05, 'triangle', 0.05);
        });

        itemsEl.appendChild(button);
    });
}

function makeCustomer() {
    const itemCount = randInt(2, 5);
    const solution = [];

    for (let i = 0; i < itemCount; i++) {
        solution.push(pick(MENU));
    }

    const target = solution.reduce((sum, item) => sum + item.cents, 0);
    const roundTime = Math.max(14, 26 - state.customerIndex);

    return {
        name: pick(callSigns),
        target,
        itemCount,
        roundTime,
        solution
    };
}

function updateTimerBar() {
    const ratio = state.roundTime > 0 ? Math.max(0, state.timeLeft / state.roundTime) : 0;
    timerBarEl.style.width = `${ratio * 100}%`;

    if (ratio > 0.45) {
        timerBarEl.style.background = 'linear-gradient(90deg, #42f3ff, #66ffa7)';
    } else if (ratio > 0.2) {
        timerBarEl.style.background = 'linear-gradient(90deg, #ffd56d, #ff9c59)';
    } else {
        timerBarEl.style.background = 'linear-gradient(90deg, #ff6f8e, #ff4f5d)';
    }
}

function clearTimer() {
    if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
    }
}

function timeoutCurrentCustomer() {
    if (state.shiftOver) return;

    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;
    setStatus('Too slow — customer stormed off to another kiosk.', 'bad');
    if (audioCtx) {
        chirp(180, 0.18, 'sawtooth', 0.08);
        setTimeout(() => chirp(145, 0.2, 'sawtooth', 0.08), 70);
    }

    advanceRound();
}

function startTimer() {
    clearTimer();
    state.timeLeft = state.roundTime;
    updateTimerBar();

    timerHandle = setInterval(() => {
        state.timeLeft -= 0.1;
        if (state.timeLeft <= 0) {
            state.timeLeft = 0;
            updateTimerBar();
            clearTimer();
            timeoutCurrentCustomer();
            return;
        }

        if (state.timeLeft <= 5 && Math.floor(state.timeLeft * 10) % 10 === 0 && audioCtx) {
            chirp(520, 0.03, 'square', 0.025);
        }

        updateTimerBar();
    }, 100);
}

function beginCustomer() {
    state.tray = [];
    state.subtotal = 0;
    state.customer = makeCustomer();
    state.roundTime = state.customer.roundTime;

    customerNameEl.textContent = state.customer.name;
    hintEl.textContent = `Receipt says ${fmt(state.customer.target)} for ${state.customer.itemCount} items.`;

    updateHud();
    renderTray();
    setStatus('Build the tray and hit Serve Tray before the timer drains.');
    startTimer();
}

function finishShift() {
    state.shiftOver = true;
    clearTimer();

    const wins = state.customerIndex;
    const mood = wins >= 7 ? 'Legendary concession run!' : wins >= 5 ? 'Solid crowd control.' : 'Rough rush hour.';

    setStatus(`Shift complete — served ${wins}/${TOTAL_CUSTOMERS}. ${mood}`, wins >= 5 ? 'good' : 'bad');
    customerNameEl.textContent = 'Shift Closed';
    hintEl.textContent = 'Press New Shift for another theater rush.';
    timerBarEl.style.width = '0%';

    [...itemsEl.querySelectorAll('button')].forEach((button) => {
        button.disabled = true;
    });

    undoBtn.disabled = true;
    clearBtn.disabled = true;
    serveBtn.disabled = true;
    updateHud();
}

function advanceRound() {
    clearTimer();

    if (state.lives <= 0) {
        finishShift();
        return;
    }

    state.customerIndex += 1;
    if (state.customerIndex >= TOTAL_CUSTOMERS) {
        finishShift();
        return;
    }

    setTimeout(() => {
        if (!state.shiftOver) beginCustomer();
    }, 550);

    updateHud();
}

function evaluateTray() {
    if (state.shiftOver || !state.customer) return;

    const diff = Math.abs(state.customer.target - state.subtotal);
    const exact = diff === 0;
    const close = diff <= 40;

    if (exact) {
        const bonus = Math.round(state.timeLeft * 6) + state.combo * 20 + 120;
        state.score += bonus;
        state.combo += 1;
        setStatus(`Perfect receipt! +${bonus} points.`, 'good');
        if (audioCtx) {
            chirp(620, 0.07, 'triangle', 0.07);
            setTimeout(() => chirp(880, 0.09, 'triangle', 0.07), 55);
        }
    } else if (close) {
        const bonus = 35 + Math.round((40 - diff) * 0.8);
        state.score += bonus;
        state.combo = 0;
        setStatus(`Close enough (${fmt(diff)} off). Crowd accepts it. +${bonus}`, 'good');
        if (audioCtx) chirp(480, 0.07, 'triangle', 0.06);
    } else {
        state.combo = 0;
        state.lives = Math.max(0, state.lives - 1);
        setStatus(`Bad tray (${fmt(diff)} off). Customer refunds and leaves.`, 'bad');
        if (audioCtx) chirp(170, 0.16, 'sawtooth', 0.09);
    }

    state.customerIndex += 1;

    if (state.lives <= 0 || state.customerIndex >= TOTAL_CUSTOMERS) {
        finishShift();
    } else {
        beginCustomer();
    }

    updateHud();
}

function startGame() {
    ensureAudio();

    state.customerIndex = 0;
    state.lives = START_LIVES;
    state.score = 0;
    state.combo = 0;
    state.shiftOver = false;
    state.tray = [];
    state.subtotal = 0;
    state.customer = null;
    state.timeLeft = 0;

    [...itemsEl.querySelectorAll('button')].forEach((button) => {
        button.disabled = false;
    });

    undoBtn.disabled = false;
    clearBtn.disabled = false;
    serveBtn.disabled = false;

    updateHud();
    renderTray();
    beginCustomer();
    chirp(420, 0.05, 'square', 0.05);
}

undoBtn.addEventListener('click', () => {
    if (state.shiftOver || !state.tray.length) return;
    const item = state.tray.pop();
    state.subtotal = Math.max(0, state.subtotal - item.cents);
    updateHud();
    renderTray();
    setStatus(`Removed ${item.name}.`);
    if (audioCtx) chirp(240, 0.04, 'square', 0.04);
});

clearBtn.addEventListener('click', () => {
    if (state.shiftOver || !state.tray.length) return;
    state.tray = [];
    state.subtotal = 0;
    updateHud();
    renderTray();
    setStatus('Tray cleared.');
    if (audioCtx) chirp(200, 0.06, 'square', 0.045);
});

serveBtn.addEventListener('click', () => {
    if (state.shiftOver) return;
    ensureAudio();
    evaluateTray();
});

newGameBtn.addEventListener('click', startGame);

buildMenu();
renderTray();
updateHud();
setStatus('Press New Shift to open the snack counter.');
