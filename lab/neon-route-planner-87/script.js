const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const deliveriesEl = document.getElementById('deliveries');
const fuelEl = document.getElementById('fuel');
const routeEl = document.getElementById('route');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const newMapBtn = document.getElementById('new-map');
const runRouteBtn = document.getElementById('run-route');
const undoBtn = document.getElementById('undo');
const clearBtn = document.getElementById('clear');

const COLS = 12;
const ROWS = 8;
const CELL = 80;
const PAD = 20;

let audioCtx;
let bestScore = 0;

const state = {
    depot: { x: 1, y: 1 },
    deliveries: [],
    blocks: new Set(),
    route: [],
    running: false,
    fuelBudget: 0,
    coveredDeliveries: 0,
    player: { x: 0, y: 0 }
};

function key(x, y) {
    return `${x},${y}`;
}

function parseKey(k) {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickEmptyCell(used) {
    let tries = 0;
    while (tries < 300) {
        const x = randInt(0, COLS - 1);
        const y = randInt(0, ROWS - 1);
        const k = key(x, y);
        if (!used.has(k)) return { x, y };
        tries += 1;
    }
    return { x: 0, y: 0 };
}

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function estimateMinimumRouteCost(depot, points) {
    if (!points.length) return 0;
    const nearest = Math.min(...points.map((p) => manhattan(depot, p)));
    const farthest = Math.max(...points.map((p) => manhattan(depot, p)));
    return nearest + farthest + points.length * 2;
}

function generateMap() {
    const used = new Set();

    state.depot = pickEmptyCell(used);
    used.add(key(state.depot.x, state.depot.y));

    state.deliveries = [];
    const deliveryCount = randInt(4, 6);
    for (let i = 0; i < deliveryCount; i++) {
        const p = pickEmptyCell(used);
        state.deliveries.push(p);
        used.add(key(p.x, p.y));
    }

    state.blocks = new Set();
    const blockCount = randInt(10, 15);
    for (let i = 0; i < blockCount; i++) {
        const b = pickEmptyCell(used);
        state.blocks.add(key(b.x, b.y));
        used.add(key(b.x, b.y));
    }

    state.route = [{ ...state.depot }];
    state.player = { ...state.depot };
    state.coveredDeliveries = 0;
    state.running = false;

    const baseline = estimateMinimumRouteCost(state.depot, state.deliveries);
    state.fuelBudget = Math.max(24, baseline + randInt(10, 16));

    setStatus('New city loaded. Plan a route touching every delivery and return to depot.');
    refreshStats();
    draw();
}

function refreshStats() {
    const covered = new Set(state.route.map((p) => key(p.x, p.y)));
    const delivered = state.deliveries.filter((d) => covered.has(key(d.x, d.y))).length;

    state.coveredDeliveries = delivered;

    deliveriesEl.textContent = `${delivered} / ${state.deliveries.length}`;
    fuelEl.textContent = `${Math.max(0, state.fuelBudget - (state.route.length - 1))} / ${state.fuelBudget}`;
    routeEl.textContent = `${Math.max(0, state.route.length - 1)} hops`;
    bestEl.textContent = String(bestScore);
}

function drawGrid() {
    ctx.fillStyle = '#04070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const px = PAD + x * CELL;
            const py = PAD + y * CELL;

            ctx.fillStyle = '#091024';
            ctx.fillRect(px, py, CELL - 2, CELL - 2);

            ctx.strokeStyle = 'rgba(61, 97, 171, 0.35)';
            ctx.strokeRect(px, py, CELL - 2, CELL - 2);
        }
    }
}

function drawBlocks() {
    for (const block of state.blocks) {
        const { x, y } = parseKey(block);
        const px = PAD + x * CELL;
        const py = PAD + y * CELL;

        ctx.fillStyle = '#252f4f';
        ctx.fillRect(px + 8, py + 8, CELL - 18, CELL - 18);

        ctx.strokeStyle = '#4b5e97';
        ctx.strokeRect(px + 8, py + 8, CELL - 18, CELL - 18);

        ctx.strokeStyle = '#6a7db5';
        ctx.beginPath();
        ctx.moveTo(px + 16, py + 16);
        ctx.lineTo(px + CELL - 26, py + CELL - 26);
        ctx.moveTo(px + CELL - 26, py + 16);
        ctx.lineTo(px + 16, py + CELL - 26);
        ctx.stroke();
    }
}

function drawDeliveries() {
    const routeSet = new Set(state.route.map((p) => key(p.x, p.y)));

    for (const drop of state.deliveries) {
        const px = PAD + drop.x * CELL + CELL / 2;
        const py = PAD + drop.y * CELL + CELL / 2;
        const delivered = routeSet.has(key(drop.x, drop.y));

        ctx.fillStyle = delivered ? '#7dff9e' : '#ffc867';
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = delivered ? '#3adb63' : '#ffdb8b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#04070f';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(delivered ? '✓' : 'D', px, py + 0.5);
    }
}

function drawDepot() {
    const px = PAD + state.depot.x * CELL + CELL / 2;
    const py = PAD + state.depot.y * CELL + CELL / 2;

    ctx.fillStyle = '#36f3ff';
    ctx.beginPath();
    ctx.arc(px, py, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#9af8ff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#032027';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEPOT', px, py + 3);
}

function drawRoute() {
    if (state.route.length < 2) return;

    ctx.strokeStyle = '#ff5fd7';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    state.route.forEach((cell, i) => {
        const px = PAD + cell.x * CELL + CELL / 2;
        const py = PAD + cell.y * CELL + CELL / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    });

    ctx.stroke();

    for (let i = 1; i < state.route.length; i++) {
        const cell = state.route[i];
        const px = PAD + cell.x * CELL + CELL / 2;
        const py = PAD + cell.y * CELL + CELL / 2;

        ctx.fillStyle = '#ffafea';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawCourier() {
    const px = PAD + state.player.x * CELL + CELL / 2;
    const py = PAD + state.player.y * CELL + CELL / 2;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#36f3ff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function draw() {
    drawGrid();
    drawRoute();
    drawBlocks();
    drawDeliveries();
    drawDepot();
    drawCourier();
}

function cellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = Math.floor(((event.clientX - rect.left) * scaleX - PAD) / CELL);
    const y = Math.floor(((event.clientY - rect.top) * scaleY - PAD) / CELL);

    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
    return { x, y };
}

function isAdjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

function handleCanvasClick(event) {
    if (state.running) return;

    const cell = cellFromPointer(event);
    if (!cell) return;
    if (state.blocks.has(key(cell.x, cell.y))) return;

    const last = state.route[state.route.length - 1];

    if (state.route.length > 1) {
        const prev = state.route[state.route.length - 2];
        if (prev.x === cell.x && prev.y === cell.y) {
            state.route.pop();
            state.player = { ...state.route[state.route.length - 1] };
            setStatus('Step removed. Keep plotting.');
            refreshStats();
            draw();
            return;
        }
    }

    if (!isAdjacent(last, cell)) {
        setStatus('Only neighboring cells are valid hops.', 'bad');
        return;
    }

    state.route.push(cell);
    state.player = { ...cell };

    const remaining = state.fuelBudget - (state.route.length - 1);
    if (remaining < 0) {
        setStatus('Fuel exceeded. Undo or clear route.', 'bad');
    } else {
        setStatus('Route extended. Hit every delivery, then return to depot.');
    }

    refreshStats();
    draw();
}

function ensureAudio() {
    if (audioCtx) return;
    audioCtx = new AudioContext();
}

function beep(freq, duration = 0.12, type = 'square', gain = 0.07) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(g);
    g.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRoute() {
    if (state.running || state.route.length < 2) return;

    ensureAudio();

    state.running = true;
    runRouteBtn.disabled = true;

    const routeSet = new Set(state.route.map((p) => key(p.x, p.y)));
    const allDelivered = state.deliveries.every((d) => routeSet.has(key(d.x, d.y)));
    const fuelUsed = state.route.length - 1;
    const fuelLeft = state.fuelBudget - fuelUsed;
    const returnedHome = state.route[state.route.length - 1].x === state.depot.x && state.route[state.route.length - 1].y === state.depot.y;

    for (let i = 0; i < state.route.length; i++) {
        state.player = { ...state.route[i] };
        draw();

        const k = key(state.player.x, state.player.y);
        if (state.deliveries.some((d) => key(d.x, d.y) === k)) {
            beep(960, 0.09, 'triangle', 0.06);
        } else {
            beep(460, 0.05, 'square', 0.03);
        }

        await sleep(105);
    }

    let message = '';
    if (!allDelivered) {
        message = 'Missed at least one delivery node. Redraw and retry.';
        setStatus(message, 'bad');
        beep(160, 0.24, 'sawtooth', 0.09);
    } else if (!returnedHome) {
        message = 'Route must end at depot to close shift.';
        setStatus(message, 'bad');
        beep(180, 0.24, 'sawtooth', 0.09);
    } else if (fuelLeft < 0) {
        message = 'Route worked, but fuel budget was blown.';
        setStatus(message, 'bad');
        beep(190, 0.22, 'sawtooth', 0.09);
    } else {
        const score = 500 + state.deliveries.length * 120 + fuelLeft * 25;
        bestScore = Math.max(bestScore, score);
        message = `Shift cleared! Score ${score}. Fuel left: ${fuelLeft}.`;
        setStatus(message, 'good');

        beep(620, 0.08, 'triangle', 0.06);
        await sleep(70);
        beep(820, 0.08, 'triangle', 0.06);
        await sleep(70);
        beep(1120, 0.12, 'triangle', 0.07);
    }

    refreshStats();
    runRouteBtn.disabled = false;
    state.running = false;
}

function undoStep() {
    if (state.running || state.route.length <= 1) return;
    state.route.pop();
    state.player = { ...state.route[state.route.length - 1] };
    setStatus('Last hop removed.');
    refreshStats();
    draw();
}

function clearRoute() {
    if (state.running) return;
    state.route = [{ ...state.depot }];
    state.player = { ...state.depot };
    setStatus('Route cleared. Start plotting again from depot.');
    refreshStats();
    draw();
}

canvas.addEventListener('click', handleCanvasClick);

newMapBtn.addEventListener('click', () => {
    generateMap();
    if (audioCtx) beep(500, 0.08, 'square', 0.04);
});
runRouteBtn.addEventListener('click', runRoute);
undoBtn.addEventListener('click', undoStep);
clearBtn.addEventListener('click', clearRoute);

generateMap();
