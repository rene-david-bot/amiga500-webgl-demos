const canvas = document.getElementById('track');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const deliveriesEl = document.getElementById('deliveries');
const streakEl = document.getElementById('streak');
const hullEl = document.getElementById('hull');
const clockEl = document.getElementById('clock');
const speedEl = document.getElementById('speed');
const messageEl = document.getElementById('message');

const newRunBtn = document.getElementById('new-run');
const audioToggleBtn = document.getElementById('audio-toggle');

const LANE_COUNT = 5;
const PLAYER_Y = 442;

const state = {
    running: true,
    lane: 2,
    speed: 3,
    score: 0,
    deliveries: 0,
    streak: 0,
    hull: 100,
    timeLeft: 45,
    maxTime: 60,
    spawnTimer: 0,
    spawnInterval: 0.78,
    items: [],
    roadOffset: 0,
    lastTs: 0,
    raf: null,
    flash: 0,
    audioEnabled: false,
    audioCtx: null
};

function laneCenter(lane) {
    const base = 150;
    const width = 132;
    return base + lane * width;
}

function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('good', 'warn', 'bad');
    if (kind) messageEl.classList.add(kind);
}

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function beep({ type = 'square', freq = 400, dur = 0.08, vol = 0.035, glide = 0.94 } = {}) {
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

function collectChime() {
    [560, 770, 960].forEach((freq, i) => {
        setTimeout(() => beep({ type: 'triangle', freq, dur: 0.08, vol: 0.04, glide: 1.03 }), i * 45);
    });
}

function crashNoise() {
    beep({ type: 'sawtooth', freq: 140, dur: 0.18, vol: 0.052, glide: 0.63 });
    setTimeout(() => beep({ type: 'square', freq: 98, dur: 0.22, vol: 0.045, glide: 0.55 }), 35);
}

function engineTick() {
    const base = 160 + state.speed * 45;
    beep({ type: 'square', freq: base, dur: 0.045, vol: 0.018, glide: 0.97 });
}

function updateStats() {
    scoreEl.textContent = String(state.score);
    deliveriesEl.textContent = String(state.deliveries);
    streakEl.textContent = String(state.streak);
    hullEl.textContent = `${Math.max(0, Math.round(state.hull))}%`;
    clockEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
    speedEl.textContent = String(state.speed);

    hullEl.style.color = state.hull < 35 ? '#ff7d8f' : '#eaf1ff';
    clockEl.style.color = state.timeLeft < 8 ? '#ffd56a' : '#eaf1ff';
}

function spawnItem() {
    const type = Math.random() < 0.7 ? 'obstacle' : 'crate';
    const lane = randInt(0, LANE_COUNT - 1);

    state.items.push({
        lane,
        y: -80,
        type,
        w: 74,
        h: type === 'obstacle' ? 60 : 48,
        hit: false
    });
}

function resetRun() {
    state.running = true;
    state.lane = 2;
    state.speed = 3;
    state.score = 0;
    state.deliveries = 0;
    state.streak = 0;
    state.hull = 100;
    state.timeLeft = 45;
    state.spawnTimer = 0;
    state.spawnInterval = 0.8;
    state.items = [];
    state.flash = 0;

    setMessage('Shift started. Keep it smooth and stack those delivery combos.', 'warn');
    updateStats();
}

function moveLane(delta) {
    if (!state.running) return;
    const next = clamp(state.lane + delta, 0, LANE_COUNT - 1);
    if (next === state.lane) return;

    state.lane = next;
    beep({ type: 'square', freq: 260 + state.lane * 32, dur: 0.05, vol: 0.028, glide: 0.96 });
}

function boost() {
    if (!state.running) return;

    state.speed = clamp(state.speed + 2, 2, 8);
    state.timeLeft = Math.max(0, state.timeLeft - 0.55);
    beep({ type: 'triangle', freq: 840, dur: 0.08, vol: 0.04, glide: 0.92 });
}

function handleCrash(item) {
    if (item.hit) return;

    item.hit = true;
    state.hull -= 22;
    state.streak = 0;
    state.timeLeft = Math.max(0, state.timeLeft - 2.2);
    state.flash = 0.22;
    crashNoise();

    setMessage('Pallet clipped! Hull damage and time penalty.', 'bad');

    if (state.hull <= 0) {
        endRun('Forklift down. Shift failed.');
    }
}

function handleCrate(item) {
    if (item.hit) return;

    item.hit = true;
    state.deliveries += 1;
    state.streak += 1;

    const bonus = 90 + state.streak * 18 + state.speed * 12;
    state.score += bonus;
    state.timeLeft = Math.min(state.maxTime, state.timeLeft + 2.4);

    collectChime();
    setMessage(`Manifest delivered! +${bonus} points and +2.4s clock.`, 'good');
}

function endRun(reason) {
    if (!state.running) return;

    state.running = false;
    setMessage(`${reason} Final score: ${state.score}. Hit New Run to go again.`, 'bad');
    beep({ type: 'triangle', freq: 180, dur: 0.3, vol: 0.04, glide: 0.7 });
}

function update(dt) {
    if (!state.running) return;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        endRun('Clock out. Warehouse doors just shut.');
        return;
    }

    state.flash = Math.max(0, state.flash - dt);

    state.roadOffset = (state.roadOffset + dt * (120 + state.speed * 45)) % 64;

    state.spawnTimer += dt;
    state.spawnInterval = Math.max(0.33, 0.86 - state.speed * 0.06);

    if (state.spawnTimer >= state.spawnInterval) {
        state.spawnTimer = 0;
        spawnItem();
    }

    const travel = 180 + state.speed * 95;

    state.items.forEach((item) => {
        item.y += travel * dt;

        if (item.hit) return;

        const laneMatch = item.lane === state.lane;
        const nearPlayer = Math.abs(item.y - PLAYER_Y) < 44;

        if (laneMatch && nearPlayer) {
            if (item.type === 'obstacle') {
                handleCrash(item);
            } else {
                handleCrate(item);
            }
        }
    });

    state.items = state.items.filter((item) => item.y < canvas.height + 90);

    state.score += Math.floor((12 + state.speed * 4) * dt);

    if (Math.random() < dt * 6) {
        engineTick();
    }
}

function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0e1a44');
    g.addColorStop(0.55, '#071126');
    g.addColorStop(1, '#04070e');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 64; i += 1) {
        const x = (i * 151) % canvas.width;
        const y = (i * 97) % 180;
        ctx.fillStyle = `rgba(170, 212, 255, ${0.03 + (i % 4) * 0.018})`;
        ctx.fillRect(x, y, 2, 2);
    }

    if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 120, 146, ${state.flash * 0.45})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawWarehouse() {
    const roadLeft = 120;
    const roadWidth = 720;

    ctx.fillStyle = '#0a1330';
    ctx.fillRect(roadLeft, 0, roadWidth, canvas.height);

    for (let i = 0; i < LANE_COUNT + 1; i += 1) {
        const x = roadLeft + i * (roadWidth / LANE_COUNT);
        ctx.strokeStyle = i === 0 || i === LANE_COUNT ? '#4f66ab' : '#324a84';
        ctx.lineWidth = i === 0 || i === LANE_COUNT ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    ctx.strokeStyle = '#67e5ff';
    ctx.lineWidth = 2;

    for (let y = -64; y < canvas.height + 64; y += 64) {
        ctx.beginPath();
        ctx.moveTo(roadLeft + 8, y + state.roadOffset);
        ctx.lineTo(roadLeft + roadWidth - 8, y + state.roadOffset);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(27, 45, 94, 0.9)';
    ctx.fillRect(18, 24, 88, canvas.height - 48);
    ctx.fillRect(canvas.width - 106, 24, 88, canvas.height - 48);

    ctx.fillStyle = '#95b4ff';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText('STORAGE', 28, 52);
    ctx.fillText('DOCK 7', canvas.width - 94, 52);
}

function drawItem(item) {
    const x = laneCenter(item.lane) - item.w / 2;

    if (item.type === 'obstacle') {
        ctx.fillStyle = item.hit ? '#4f5875' : '#dd7f4e';
        ctx.fillRect(x, item.y - item.h / 2, item.w, item.h);

        ctx.strokeStyle = '#ffe6ba';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 4, item.y - item.h / 2 + 4, item.w - 8, item.h - 8);

        if (!item.hit) {
            ctx.fillStyle = '#fff2bf';
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillText('PALLET', x + 10, item.y + 4);
        }
        return;
    }

    ctx.fillStyle = item.hit ? '#32506d' : '#4bd3ff';
    ctx.fillRect(x, item.y - item.h / 2, item.w, item.h);
    ctx.strokeStyle = '#cdf5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 4, item.y - item.h / 2 + 4, item.w - 8, item.h - 8);

    if (!item.hit) {
        ctx.fillStyle = '#e9fbff';
        ctx.font = 'bold 11px "Courier New", monospace';
        ctx.fillText('MANIFEST', x + 4, item.y + 4);
    }
}

function drawForklift() {
    const x = laneCenter(state.lane);
    const y = PLAYER_Y;

    ctx.fillStyle = '#ff72c1';
    ctx.fillRect(x - 32, y - 24, 64, 46);

    ctx.fillStyle = '#ffc4e7';
    ctx.fillRect(x - 18, y - 36, 36, 16);

    ctx.fillStyle = '#211a2f';
    ctx.fillRect(x - 28, y + 6, 56, 14);

    ctx.fillStyle = '#111522';
    ctx.beginPath();
    ctx.arc(x - 22, y + 24, 10, 0, Math.PI * 2);
    ctx.arc(x + 22, y + 24, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#89eeff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 2);
    ctx.lineTo(x - 14, y + 46);
    ctx.moveTo(x + 14, y - 2);
    ctx.lineTo(x + 14, y + 46);
    ctx.stroke();

    ctx.fillStyle = '#70edff';
    ctx.fillRect(x - 24, y + 40, 48, 5);

    if (state.running) {
        const glow = 0.45 + Math.sin(performance.now() / 85) * 0.2;
        ctx.fillStyle = `rgba(113, 239, 255, ${glow})`;
        ctx.fillRect(x - 18, y - 14, 36, 6);
    }
}

function drawHUDOverlay() {
    ctx.fillStyle = '#eaf5ff';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText("FORKLIFT AISLE RUSH '91", 24, 30);

    ctx.fillStyle = '#9fb4ef';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Dodge PALLET crates • Collect MANIFEST crates • Keep hull above zero', 24, 50);

    if (!state.running) {
        ctx.fillStyle = 'rgba(5, 8, 18, 0.68)';
        ctx.fillRect(210, 205, 540, 120);

        ctx.strokeStyle = '#5fdfff';
        ctx.lineWidth = 2;
        ctx.strokeRect(210, 205, 540, 120);

        ctx.fillStyle = '#f2f8ff';
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.fillText('SHIFT COMPLETE', 338, 250);

        ctx.fillStyle = '#96ffcb';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillText(`Score ${state.score}`, 410, 284);
    }
}

function draw() {
    drawBackdrop();
    drawWarehouse();

    state.items.forEach(drawItem);

    drawForklift();
    drawHUDOverlay();
}

function toggleAudio() {
    state.audioEnabled = !state.audioEnabled;
    audioToggleBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;

    if (state.audioEnabled) {
        ensureAudio();
        beep({ type: 'triangle', freq: 640, dur: 0.1, vol: 0.042, glide: 0.99 });
        setMessage('Audio online. Warehouse beeps enabled.', 'good');
    } else {
        setMessage('Audio muted. Silent forklift mode.', 'warn');
    }
}

function bindEvents() {
    window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
            event.preventDefault();
            moveLane(-1);
            return;
        }

        if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
            event.preventDefault();
            moveLane(1);
            return;
        }

        if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
            event.preventDefault();
            state.speed = clamp(state.speed + 1, 2, 8);
            beep({ type: 'square', freq: 360 + state.speed * 40, dur: 0.06, vol: 0.03, glide: 0.97 });
            return;
        }

        if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') {
            event.preventDefault();
            state.speed = clamp(state.speed - 1, 2, 8);
            beep({ type: 'square', freq: 260 + state.speed * 38, dur: 0.06, vol: 0.03, glide: 0.92 });
            return;
        }

        if (event.code === 'Space') {
            event.preventDefault();
            boost();
        }
    });

    newRunBtn.addEventListener('click', () => {
        beep({ type: 'triangle', freq: 520, dur: 0.08, vol: 0.04, glide: 0.97 });
        resetRun();
    });

    audioToggleBtn.addEventListener('click', toggleAudio);
}

function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(50, ts - state.lastTs) / 1000;
    state.lastTs = ts;

    update(dt);
    updateStats();
    draw();

    state.raf = requestAnimationFrame(loop);
}

function init() {
    bindEvents();
    resetRun();
    state.raf = requestAnimationFrame(loop);
}

init();
