const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const callerEl = document.getElementById('caller');
const targetEl = document.getElementById('target');
const totalEl = document.getElementById('total');
const dropsEl = document.getElementById('drops');
const savedEl = document.getElementById('saved');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const bonusListEl = document.getElementById('bonus-list');

const newShiftBtn = document.getElementById('new-shift');
const dropBtn = document.getElementById('drop');
const nextCallBtn = document.getElementById('next-call');
const coinButtons = [...document.querySelectorAll('.coin')];

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const TOP_DROP_Y = 56;
const BUCKET_TOP = 560;
const TOTAL_CALLERS = 6;
const MAX_DROPS = 5;

const bucketBonuses = [-15, -10, -5, 0, 5, 10, 15];
const pegs = [];

let audioCtx;

const state = {
    caller: 1,
    saved: 0,
    score: 0,
    targetFare: 0,
    totalFare: 0,
    dropsLeft: MAX_DROPS,
    selectedCoin: 10,
    dropX: WIDTH * 0.5,
    activeCoin: null,
    resolving: false,
    shiftOver: false
};

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function beep(freq, duration = 0.08, type = 'square', gain = 0.06) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(g);
    g.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

function updateMeters() {
    callerEl.textContent = `${state.caller} / ${TOTAL_CALLERS}`;
    targetEl.textContent = `${state.targetFare}¢`;
    totalEl.textContent = `${state.totalFare}¢`;
    dropsEl.textContent = String(state.dropsLeft);
    savedEl.textContent = String(state.saved);
    scoreEl.textContent = String(state.score);
}

function resetCaller() {
    state.targetFare = randInt(14, 36) * 5;
    state.totalFare = 0;
    state.dropsLeft = MAX_DROPS;
    state.activeCoin = null;
    state.resolving = false;
    state.dropX = WIDTH * 0.5;

    updateMeters();
    setStatus('Caller connected. Match the exact fare or land within ±10¢.');
}

function startShift() {
    state.caller = 1;
    state.saved = 0;
    state.score = 0;
    state.shiftOver = false;
    dropBtn.disabled = false;
    nextCallBtn.disabled = false;

    resetCaller();
    buildBonusLegend();
}

function finishShift() {
    state.shiftOver = true;
    state.activeCoin = null;
    dropBtn.disabled = true;
    nextCallBtn.disabled = true;

    const rank = state.saved >= 5 ? 'Legendary operator!' : state.saved >= 3 ? 'Solid shift.' : 'Rough night.';
    setStatus(`Shift complete — ${state.saved}/${TOTAL_CALLERS} callers saved. ${rank}`, state.saved >= 3 ? 'good' : 'bad');
}

function nextCaller() {
    state.caller += 1;
    if (state.caller > TOTAL_CALLERS) {
        finishShift();
        return;
    }
    resetCaller();
}

function settleCaller(skip = false) {
    if (state.shiftOver || state.resolving) return;

    const diff = state.targetFare - state.totalFare;
    const absDiff = Math.abs(diff);
    const bust = state.totalFare > state.targetFare + 20;

    state.resolving = true;

    if (!skip && state.totalFare === state.targetFare) {
        const gain = 300 + state.dropsLeft * 35;
        state.saved += 1;
        state.score += gain;
        setStatus(`Perfect fare! +${gain} score.`, 'good');
        beep(620, 0.08, 'triangle', 0.07);
        beep(880, 0.1, 'triangle', 0.07);
    } else if (!skip && (absDiff <= 10) && (state.dropsLeft <= 0 || bust)) {
        const gain = 130 + Math.max(0, 10 - absDiff) * 8;
        state.saved += 1;
        state.score += gain;
        setStatus(`Close enough (${absDiff}¢ off). Caller stays on. +${gain} score.`, 'good');
        beep(520, 0.07, 'triangle', 0.06);
        beep(740, 0.08, 'triangle', 0.06);
    } else if (skip) {
        setStatus('Caller skipped. Next booth ringing…', 'bad');
        beep(180, 0.16, 'sawtooth', 0.08);
    } else if (bust) {
        setStatus('Overpaid hard — caller slammed the handset.', 'bad');
        beep(160, 0.2, 'sawtooth', 0.09);
    } else if (state.dropsLeft <= 0) {
        setStatus(`No drops left (${absDiff}¢ off). Caller lost.`, 'bad');
        beep(170, 0.18, 'sawtooth', 0.09);
    } else {
        state.resolving = false;
        return;
    }

    updateMeters();

    setTimeout(() => {
        state.resolving = false;
        nextCaller();
    }, 1000);
}

function dropCoin() {
    if (state.shiftOver || state.resolving || state.activeCoin || state.dropsLeft <= 0) return;

    ensureAudio();

    state.activeCoin = {
        x: state.dropX,
        y: TOP_DROP_Y,
        vx: (Math.random() - 0.5) * 1.4,
        vy: 0,
        r: 11,
        value: state.selectedCoin,
        spin: Math.random() * Math.PI * 2
    };

    setStatus(`Coin dropped: ${state.selectedCoin}¢. Guide it into the right lane.`);
    beep(420, 0.04, 'square', 0.04);
}

function resolveBucketLanding(index) {
    const coin = state.activeCoin;
    if (!coin) return;

    const bonus = bucketBonuses[index] ?? 0;
    const landedValue = Math.max(0, coin.value + bonus);

    state.totalFare += landedValue;
    state.dropsLeft -= 1;
    state.activeCoin = null;

    setStatus(`Lane ${index + 1}: ${coin.value}¢ ${bonus >= 0 ? '+' : ''}${bonus}¢ = ${landedValue}¢`);
    beep(460 + (index * 40), 0.07, 'triangle', 0.05);

    updateMeters();

    const bust = state.totalFare > state.targetFare + 20;
    if (state.totalFare === state.targetFare || bust || state.dropsLeft <= 0) {
        settleCaller(false);
    }
}

function updateCoinPhysics() {
    const coin = state.activeCoin;
    if (!coin) return;

    coin.vy += 0.18;
    coin.x += coin.vx;
    coin.y += coin.vy;
    coin.spin += 0.22;

    if (coin.x < coin.r) {
        coin.x = coin.r;
        coin.vx *= -0.92;
    }
    if (coin.x > WIDTH - coin.r) {
        coin.x = WIDTH - coin.r;
        coin.vx *= -0.92;
    }

    for (const peg of pegs) {
        const dx = coin.x - peg.x;
        const dy = coin.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = coin.r + peg.r;

        if (dist > 0 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;

            coin.x += nx * overlap;
            coin.y += ny * overlap;

            const dot = coin.vx * nx + coin.vy * ny;
            coin.vx = (coin.vx - 2 * dot * nx) * 0.88 + (Math.random() - 0.5) * 0.12;
            coin.vy = (coin.vy - 2 * dot * ny) * 0.88;

            break;
        }
    }

    if (coin.y + coin.r >= BUCKET_TOP) {
        const bucketWidth = WIDTH / bucketBonuses.length;
        const index = clamp(Math.floor(coin.x / bucketWidth), 0, bucketBonuses.length - 1);
        resolveBucketLanding(index);
    }
}

function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#071127');
    grad.addColorStop(1, '#04070f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 90; i++) {
        const x = (i * 113) % WIDTH;
        const y = (i * 61) % 240;
        ctx.fillStyle = 'rgba(120, 170, 255, 0.06)';
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawDropRail() {
    ctx.fillStyle = '#0f1f46';
    ctx.fillRect(0, 12, WIDTH, 54);
    ctx.strokeStyle = '#4f6fc0';
    ctx.strokeRect(0.5, 12.5, WIDTH - 1, 53);

    ctx.fillStyle = '#f9da89';
    ctx.beginPath();
    ctx.moveTo(state.dropX, 26);
    ctx.lineTo(state.dropX - 12, 44);
    ctx.lineTo(state.dropX + 12, 44);
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#cfe0ff';
    ctx.textAlign = 'left';
    ctx.fillText('Drop zone', 12, 45);
}

function drawPegs() {
    for (const peg of pegs) {
        ctx.fillStyle = '#234282';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#5b7fcc';
        ctx.lineWidth = 1.2;
        ctx.stroke();
    }
}

function drawBuckets() {
    const bucketWidth = WIDTH / bucketBonuses.length;

    for (let i = 0; i < bucketBonuses.length; i++) {
        const x = i * bucketWidth;
        const bonus = bucketBonuses[i];

        ctx.fillStyle = bonus < 0 ? 'rgba(143, 42, 87, 0.5)' : bonus > 0 ? 'rgba(31, 110, 124, 0.5)' : 'rgba(62, 74, 102, 0.5)';
        ctx.fillRect(x + 1, BUCKET_TOP, bucketWidth - 2, HEIGHT - BUCKET_TOP);

        ctx.strokeStyle = '#4767af';
        ctx.strokeRect(x + 0.5, BUCKET_TOP + 0.5, bucketWidth - 1, HEIGHT - BUCKET_TOP - 1);

        ctx.fillStyle = '#e4edff';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${bonus >= 0 ? '+' : ''}${bonus}¢`, x + bucketWidth * 0.5, BUCKET_TOP + 28);

        ctx.fillStyle = '#90a8dc';
        ctx.font = '12px monospace';
        ctx.fillText(`L${i + 1}`, x + bucketWidth * 0.5, BUCKET_TOP + 48);
    }
}

function drawFareGuide() {
    const panelX = 18;
    const panelY = 82;
    const panelW = 270;
    const panelH = 76;

    ctx.fillStyle = 'rgba(8, 14, 31, 0.75)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = '#4a6eba';
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9dbff';
    ctx.font = '13px monospace';
    ctx.fillText(`Target: ${state.targetFare}¢`, panelX + 10, panelY + 20);
    ctx.fillText(`Current: ${state.totalFare}¢`, panelX + 10, panelY + 40);
    ctx.fillText(`Tolerance: ±10¢`, panelX + 10, panelY + 60);

    const progressW = panelW - 24;
    const ratio = clamp(state.totalFare / Math.max(state.targetFare, 1), 0, 1);
    ctx.fillStyle = '#1f315f';
    ctx.fillRect(panelX + 12, panelY + panelH - 14, progressW, 6);
    ctx.fillStyle = ratio >= 1 ? '#ff6a93' : '#3df4ff';
    ctx.fillRect(panelX + 12, panelY + panelH - 14, progressW * ratio, 6);
}

function drawCoin() {
    const coin = state.activeCoin;
    if (!coin) return;

    const shimmer = 0.35 + Math.sin(coin.spin) * 0.12;
    ctx.fillStyle = `rgba(255, 214, 126, ${0.75 + shimmer * 0.2})`;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fff1c5';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#5a4216';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(coin.value), coin.x, coin.y + 4);
}

function render() {
    drawBackground();
    drawDropRail();
    drawPegs();
    drawBuckets();
    drawFareGuide();
    drawCoin();
}

function loop() {
    updateCoinPhysics();
    render();
    requestAnimationFrame(loop);
}

function updateDropX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * WIDTH;
    state.dropX = clamp(px, 14, WIDTH - 14);
}

function buildPegs() {
    pegs.length = 0;

    const rows = 9;
    const cols = 10;
    const spacingX = WIDTH / (cols + 1);
    const spacingY = (BUCKET_TOP - 120) / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const offset = row % 2 === 0 ? spacingX * 0.5 : 0;
            const x = spacingX + col * spacingX + offset;
            if (x < 24 || x > WIDTH - 24) continue;

            const y = 110 + row * spacingY;
            pegs.push({ x, y, r: 8 });
        }
    }
}

function buildBonusLegend() {
    bonusListEl.innerHTML = '';

    bucketBonuses.forEach((bonus, idx) => {
        const li = document.createElement('li');

        const lane = document.createElement('span');
        lane.className = 'lane';

        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = bonus < 0 ? '#ab3c73' : bonus > 0 ? '#2a8f95' : '#59688f';

        const name = document.createElement('span');
        name.textContent = `Lane ${idx + 1}`;

        lane.append(dot, name);

        const value = document.createElement('strong');
        value.textContent = `${bonus >= 0 ? '+' : ''}${bonus}¢`;

        li.append(lane, value);
        bonusListEl.appendChild(li);
    });
}

canvas.addEventListener('mousemove', (event) => {
    updateDropX(event.clientX);
});

canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length) {
        updateDropX(event.touches[0].clientX);
        event.preventDefault();
    }
}, { passive: false });

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    if (y < 90) dropCoin();
});

newShiftBtn.addEventListener('click', () => {
    startShift();
    if (audioCtx) beep(500, 0.06, 'square', 0.04);
});

dropBtn.addEventListener('click', dropCoin);
nextCallBtn.addEventListener('click', () => settleCaller(true));

coinButtons.forEach((button) => {
    button.addEventListener('click', () => {
        coinButtons.forEach((node) => node.classList.remove('active'));
        button.classList.add('active');
        state.selectedCoin = Number(button.dataset.value);
        setStatus(`Coin selected: ${state.selectedCoin}¢.`);

        if (audioCtx) beep(300 + state.selectedCoin * 4, 0.05, 'triangle', 0.05);
    });
});

buildPegs();
startShift();
loop();
