const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const rackEl = document.getElementById('rack');
const ballsLeftEl = document.getElementById('balls-left');
const streakEl = document.getElementById('streak');
const clockEl = document.getElementById('clock');
const shotsEl = document.getElementById('shots');
const messageEl = document.getElementById('message');

const newSessionBtn = document.getElementById('new-session');
const rerackBtn = document.getElementById('rerack');
const audioToggleBtn = document.getElementById('audio-toggle');

const table = {
    left: 96,
    top: 64,
    width: 768,
    height: 412,
    rail: 24,
    pocketRadius: 24
};

const pocketCenters = [
    { x: table.left, y: table.top },
    { x: table.left + table.width / 2, y: table.top },
    { x: table.left + table.width, y: table.top },
    { x: table.left, y: table.top + table.height },
    { x: table.left + table.width / 2, y: table.top + table.height },
    { x: table.left + table.width, y: table.top + table.height }
];

const rackPalette = ['#ff6fbe', '#5fe9ff', '#ffd76d', '#8effbc', '#b896ff', '#ffa97f', '#89d1ff', '#ff8fe9', '#6dffea', '#ffe389'];

const state = {
    balls: [],
    score: 0,
    rack: 1,
    streak: 0,
    shots: 0,
    timeLeft: 90,
    maxTime: 120,
    running: true,
    aiming: false,
    aimPointer: { x: table.left + 140, y: table.top + table.height / 2 },
    chargeStart: 0,
    chargePower: 0,
    awaitingRest: false,
    turnPocketed: false,
    lastTs: 0,
    flash: 0,
    messageCooldown: 0,
    audioEnabled: false,
    audioCtx: null
};

function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('good', 'warn', 'bad');
    if (kind) messageEl.classList.add(kind);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function beep({ type = 'triangle', freq = 420, dur = 0.08, vol = 0.035, glide = 0.96 } = {}) {
    if (!state.audioEnabled) return;
    ensureAudio();

    const now = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(70, freq * glide), now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function shotSound(powerRatio) {
    const freq = 190 + powerRatio * 330;
    beep({ type: 'square', freq, dur: 0.09, vol: 0.04, glide: 0.94 });
}

function pocketSound() {
    [620, 830, 1020].forEach((freq, index) => {
        setTimeout(() => beep({ type: 'triangle', freq, dur: 0.08, vol: 0.038, glide: 1.02 }), index * 45);
    });
}

function foulSound() {
    beep({ type: 'sawtooth', freq: 160, dur: 0.16, vol: 0.048, glide: 0.66 });
}

function rackSound() {
    [480, 640, 800, 980].forEach((freq, index) => {
        setTimeout(() => beep({ type: 'triangle', freq, dur: 0.07, vol: 0.034, glide: 1.03 }), index * 40);
    });
}

function createCueBall() {
    return {
        id: 'cue',
        type: 'cue',
        x: table.left + 180,
        y: table.top + table.height / 2,
        vx: 0,
        vy: 0,
        r: 11,
        color: '#f3f6ff',
        label: 'C',
        pocketed: false
    };
}

function rackBalls() {
    const balls = [createCueBall()];

    const startX = table.left + table.width - 220;
    const startY = table.top + table.height / 2;
    const spacing = 24;

    let idx = 0;

    for (let row = 0; row < 4; row += 1) {
        const count = row + 1;
        for (let col = 0; col < count; col += 1) {
            if (idx >= 10) break;

            const x = startX + row * spacing;
            const y = startY - (count - 1) * spacing * 0.5 + col * spacing;

            balls.push({
                id: `o-${idx + 1}`,
                type: 'object',
                x,
                y,
                vx: 0,
                vy: 0,
                r: 11,
                color: rackPalette[idx % rackPalette.length],
                label: String(idx + 1),
                value: 120 + idx * 10,
                pocketed: false
            });

            idx += 1;
        }
    }

    state.balls = balls;
}

function resetForNewSession() {
    state.score = 0;
    state.rack = 1;
    state.streak = 0;
    state.shots = 0;
    state.timeLeft = 90;
    state.running = true;
    state.awaitingRest = false;
    state.turnPocketed = false;
    state.flash = 0;
    state.aiming = false;
    state.chargePower = 0;

    rackBalls();

    setMessage('Fresh night, fresh felt. Clear all stripes before the clock dies.', 'warn');
    rackSound();
    updateStats();
}

function rerack() {
    if (!state.running) return;
    state.streak = 0;
    state.awaitingRest = false;
    state.turnPocketed = false;
    rackBalls();
    setMessage('Re-rack complete. Streak reset, table ready.', 'warn');
    rackSound();
    updateStats();
}

function getCueBall() {
    return state.balls.find((ball) => ball.type === 'cue');
}

function activeObjectBalls() {
    return state.balls.filter((ball) => ball.type === 'object' && !ball.pocketed);
}

function allBallsAtRest() {
    return state.balls.every((ball) => Math.hypot(ball.vx, ball.vy) < 4 || ball.pocketed);
}

function canShoot() {
    const cue = getCueBall();
    return Boolean(cue && !cue.pocketed && state.running && !state.awaitingRest && allBallsAtRest());
}

function cueRespot() {
    const cue = getCueBall();
    if (!cue) return;

    cue.pocketed = false;
    cue.x = table.left + 180;
    cue.y = table.top + table.height / 2;
    cue.vx = 0;
    cue.vy = 0;
}

function registerPocket(ball) {
    if (ball.pocketed) return;

    ball.pocketed = true;
    ball.vx = 0;
    ball.vy = 0;

    if (ball.type === 'cue') {
        state.streak = 0;
        state.score = Math.max(0, state.score - 180);
        state.timeLeft = Math.max(0, state.timeLeft - 3.5);
        state.flash = 0.28;
        foulSound();
        setMessage('Scratch foul! Cue ball respotted, points and time lost.', 'bad');
        cueRespot();
        return;
    }

    state.turnPocketed = true;
    state.streak += 1;

    const bonus = ball.value + state.streak * 26;
    state.score += bonus;
    state.timeLeft = Math.min(state.maxTime, state.timeLeft + 1.25);
    pocketSound();

    setMessage(`Pocket clean! +${bonus} points · streak x${state.streak}.`, 'good');
}

function resolveWallCollision(ball) {
    if (ball.pocketed) return;

    const minX = table.left + table.rail + ball.r;
    const maxX = table.left + table.width - table.rail - ball.r;
    const minY = table.top + table.rail + ball.r;
    const maxY = table.top + table.height - table.rail - ball.r;

    if (ball.x < minX) {
        ball.x = minX;
        ball.vx = Math.abs(ball.vx) * 0.9;
    } else if (ball.x > maxX) {
        ball.x = maxX;
        ball.vx = -Math.abs(ball.vx) * 0.9;
    }

    if (ball.y < minY) {
        ball.y = minY;
        ball.vy = Math.abs(ball.vy) * 0.9;
    } else if (ball.y > maxY) {
        ball.y = maxY;
        ball.vy = -Math.abs(ball.vy) * 0.9;
    }
}

function resolveBallCollisions() {
    const liveBalls = state.balls.filter((ball) => !ball.pocketed);

    for (let i = 0; i < liveBalls.length; i += 1) {
        for (let j = i + 1; j < liveBalls.length; j += 1) {
            const a = liveBalls[i];
            const b = liveBalls[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;

            if (dist <= 0 || dist >= minDist) continue;

            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const normalSpeed = rvx * nx + rvy * ny;
            if (normalSpeed > 0) continue;

            const restitution = 0.94;
            const impulse = -(1 + restitution) * normalSpeed * 0.5;

            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
        }
    }
}

function detectPockets() {
    state.balls.forEach((ball) => {
        if (ball.pocketed) return;

        for (const pocket of pocketCenters) {
            if (distance(ball, pocket) < table.pocketRadius - 2) {
                registerPocket(ball);
                break;
            }
        }
    });
}

function updatePhysics(dt) {
    const decay = Math.pow(0.992, dt * 60);

    state.balls.forEach((ball) => {
        if (ball.pocketed) return;

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vx *= decay;
        ball.vy *= decay;

        if (Math.abs(ball.vx) < 2) ball.vx = 0;
        if (Math.abs(ball.vy) < 2) ball.vy = 0;

        resolveWallCollision(ball);
    });

    resolveBallCollisions();
    detectPockets();
}

function finishRack() {
    state.score += 500 + Math.floor(state.timeLeft * 4);
    state.timeLeft = Math.min(state.maxTime, state.timeLeft + 8);
    state.rack += 1;
    state.streak += 1;
    state.awaitingRest = false;
    state.turnPocketed = false;

    rackBalls();
    rackSound();
    setMessage(`Rack cleared! Bonus awarded. Welcome to rack ${state.rack}.`, 'good');
}

function endSession(reason) {
    state.running = false;
    state.awaitingRest = false;
    state.aiming = false;
    setMessage(`${reason} Final score: ${state.score}. Tap New Session for another run.`, 'bad');
    foulSound();
}

function update(dt) {
    if (!state.running) return;

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
        endSession('Table lights out.');
        return;
    }

    state.flash = Math.max(0, state.flash - dt);
    state.messageCooldown = Math.max(0, state.messageCooldown - dt);

    updatePhysics(dt);

    if (state.awaitingRest && allBallsAtRest()) {
        state.awaitingRest = false;
        if (!state.turnPocketed) {
            state.streak = 0;
            if (state.messageCooldown === 0) {
                setMessage('No sink on that shot. Streak reset — line up the next angle.', 'warn');
                state.messageCooldown = 1.4;
            }
        }
    }

    if (activeObjectBalls().length === 0) {
        finishRack();
    }

    updateStats();
}

function updateStats() {
    scoreEl.textContent = String(state.score);
    rackEl.textContent = String(state.rack);
    ballsLeftEl.textContent = String(activeObjectBalls().length);
    streakEl.textContent = String(state.streak);
    clockEl.textContent = `${state.timeLeft.toFixed(1)}s`;
    shotsEl.textContent = String(state.shots);

    clockEl.style.color = state.timeLeft < 12 ? '#ffd56a' : '#eaf2ff';
    streakEl.style.color = state.streak >= 3 ? '#86ffbd' : '#eaf2ff';
}

function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0a1a2f');
    g.addColorStop(0.52, '#081426');
    g.addColorStop(1, '#060f1d');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 80; i += 1) {
        const x = (i * 137) % canvas.width;
        const y = (i * 89) % 120;
        ctx.fillStyle = `rgba(170, 218, 255, ${0.02 + (i % 4) * 0.015})`;
        ctx.fillRect(x, y, 2, 2);
    }

    if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 120, 150, ${state.flash * 0.5})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function drawTable() {
    const { left, top, width, height, rail } = table;

    ctx.fillStyle = '#3d2216';
    ctx.fillRect(left, top, width, height);

    ctx.fillStyle = '#7d4a2c';
    ctx.fillRect(left + 8, top + 8, width - 16, height - 16);

    ctx.fillStyle = '#0a5a52';
    ctx.fillRect(left + rail, top + rail, width - rail * 2, height - rail * 2);

    const felt = ctx.createLinearGradient(left, top + rail, left, top + height - rail);
    felt.addColorStop(0, 'rgba(32, 154, 141, 0.92)');
    felt.addColorStop(1, 'rgba(11, 102, 95, 0.9)');
    ctx.fillStyle = felt;
    ctx.fillRect(left + rail, top + rail, width - rail * 2, height - rail * 2);

    ctx.strokeStyle = '#7bf5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(left + rail + 1, top + rail + 1, width - rail * 2 - 2, height - rail * 2 - 2);

    pocketCenters.forEach((pocket) => {
        const radial = ctx.createRadialGradient(pocket.x, pocket.y, 2, pocket.x, pocket.y, table.pocketRadius);
        radial.addColorStop(0, '#000000');
        radial.addColorStop(1, '#1b130f');
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, table.pocketRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(130, 237, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    ctx.fillStyle = '#dbf6ff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText("NEON POOL HUSTLE '89", left + 18, top - 18);

    ctx.fillStyle = '#9ec6cf';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Hold + release to shoot • Sink stripes • Beat the clock', left + 18, top + height + 28);
}

function drawBall(ball) {
    if (ball.pocketed) return;

    const gloss = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.4, 2, ball.x, ball.y, ball.r);
    gloss.addColorStop(0, '#ffffff');
    gloss.addColorStop(0.2, ball.color);
    gloss.addColorStop(1, '#1d2439');

    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e5f8ff';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = '#0a1022';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.label, ball.x, ball.y + 0.5);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

function drawAimGuide() {
    if (!canShoot()) return;

    const cue = getCueBall();
    if (!cue) return;

    const dx = state.aimPointer.x - cue.x;
    const dy = state.aimPointer.y - cue.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const maxGuide = 180;

    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(222, 251, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(cue.x + ux * maxGuide, cue.y + uy * maxGuide);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255, 214, 112, 0.86)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cue.x - ux * 16, cue.y - uy * 16);
    ctx.lineTo(cue.x - ux * (16 + state.chargePower * 46), cue.y - uy * (16 + state.chargePower * 46));
    ctx.stroke();

    ctx.fillStyle = 'rgba(8, 18, 34, 0.84)';
    ctx.fillRect(24, canvas.height - 44, 180, 16);

    ctx.strokeStyle = '#8fe8ff';
    ctx.strokeRect(24, canvas.height - 44, 180, 16);

    ctx.fillStyle = '#ffd56a';
    ctx.fillRect(24, canvas.height - 44, 180 * state.chargePower, 16);

    ctx.fillStyle = '#e7f3ff';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('SHOT POWER', 24, canvas.height - 50);
}

function drawGameOverOverlay() {
    if (state.running) return;

    ctx.fillStyle = 'rgba(5, 8, 20, 0.7)';
    ctx.fillRect(236, 198, 488, 128);

    ctx.strokeStyle = '#6ce9ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(236, 198, 488, 128);

    ctx.fillStyle = '#f0f7ff';
    ctx.font = 'bold 28px "Courier New", monospace';
    ctx.fillText('HALL CLOSED', 376, 246);

    ctx.fillStyle = '#88ffc0';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText(`Score ${state.score}`, 418, 283);
}

function draw() {
    drawBackdrop();
    drawTable();
    state.balls.forEach(drawBall);
    drawAimGuide();
    drawGameOverOverlay();
}

function shoot() {
    if (!canShoot()) return;

    const cue = getCueBall();
    if (!cue) return;

    const dx = state.aimPointer.x - cue.x;
    const dy = state.aimPointer.y - cue.y;
    const len = Math.hypot(dx, dy);

    if (len < 8) {
        setMessage('Aim farther from the cue ball before shooting.', 'warn');
        return;
    }

    const ux = dx / len;
    const uy = dy / len;
    const powerRatio = clamp(state.chargePower, 0.08, 1);
    const speed = 280 + powerRatio * 560;

    cue.vx = ux * speed;
    cue.vy = uy * speed;

    state.shots += 1;
    state.awaitingRest = true;
    state.turnPocketed = false;
    state.chargePower = 0;

    shotSound(powerRatio);
}

function pointerToCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    return {
        x: clamp(x, table.left + table.rail, table.left + table.width - table.rail),
        y: clamp(y, table.top + table.rail, table.top + table.height - table.rail)
    };
}

function bindPointerEvents() {
    canvas.addEventListener('pointermove', (event) => {
        state.aimPointer = pointerToCanvas(event);

        if (state.aiming) {
            const charge = (performance.now() - state.chargeStart) / 1300;
            state.chargePower = clamp(charge, 0.05, 1);
        }
    });

    canvas.addEventListener('pointerdown', (event) => {
        if (!canShoot()) return;

        canvas.setPointerCapture(event.pointerId);
        state.aiming = true;
        state.chargeStart = performance.now();
        state.chargePower = 0.05;
        state.aimPointer = pointerToCanvas(event);
    });

    canvas.addEventListener('pointerup', (event) => {
        if (!state.aiming) return;

        state.aimPointer = pointerToCanvas(event);
        const charge = (performance.now() - state.chargeStart) / 1300;
        state.chargePower = clamp(charge, 0.05, 1);
        state.aiming = false;
        shoot();
    });

    canvas.addEventListener('pointercancel', () => {
        state.aiming = false;
        state.chargePower = 0;
    });
}

function toggleAudio() {
    state.audioEnabled = !state.audioEnabled;
    audioToggleBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;

    if (state.audioEnabled) {
        ensureAudio();
        rackSound();
        setMessage('Audio online. Retro hall ambience engaged.', 'good');
    } else {
        setMessage('Audio muted. Silent table mode.', 'warn');
    }
}

function bindUI() {
    newSessionBtn.addEventListener('click', () => {
        beep({ type: 'triangle', freq: 580, dur: 0.08, vol: 0.04, glide: 0.98 });
        resetForNewSession();
    });

    rerackBtn.addEventListener('click', () => {
        beep({ type: 'triangle', freq: 460, dur: 0.07, vol: 0.033, glide: 0.96 });
        rerack();
    });

    audioToggleBtn.addEventListener('click', toggleAudio);
}

function loop(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(40, ts - state.lastTs) / 1000;
    state.lastTs = ts;

    if (state.aiming) {
        const charge = (performance.now() - state.chargeStart) / 1300;
        state.chargePower = clamp(charge, 0.05, 1);
    }

    update(dt);
    draw();
    requestAnimationFrame(loop);
}

function init() {
    bindPointerEvents();
    bindUI();
    resetForNewSession();
    requestAnimationFrame(loop);
}

init();
