const canvas = document.getElementById('petri');
const ctx = canvas.getContext('2d');

const generationEl = document.getElementById('generation');
const liveCellsEl = document.getElementById('live-cells');
const diversityEl = document.getElementById('diversity');
const simStateEl = document.getElementById('sim-state');

const runBtn = document.getElementById('run-btn');
const stepBtn = document.getElementById('step-btn');
const randomBtn = document.getElementById('random-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');

const speciesButtons = [...document.querySelectorAll('.chip')];
const presetButtons = [...document.querySelectorAll('.preset')];

const CELL = 12;
const GRID_W = Math.floor(canvas.width / CELL);
const GRID_H = Math.floor(canvas.height / CELL);
const STEP_MS = 90;
const MUTATION_RATE = 0.009;

const COLORS = {
    0: '#02040b',
    1: '#3cf0ff',
    2: '#ff57d8',
    3: '#ffcc47'
};

let grid = makeGrid();
let running = false;
let generation = 0;
let brushSpecies = 1;
let pointerDown = false;
let lastStep = 0;

function makeGrid() {
    return Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0));
}

function stampPattern(cells, originX, originY, species = 1) {
    cells.forEach(([dx, dy]) => {
        const x = originX + dx;
        const y = originY + dy;
        if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
            grid[y][x] = species;
        }
    });
}

function countNeighbors(x, y) {
    const speciesCount = [0, 0, 0, 0];
    let total = 0;

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
            const state = grid[ny][nx];
            if (state) {
                total++;
                speciesCount[state]++;
            }
        }
    }

    return { total, speciesCount };
}

function dominantSpecies(counts) {
    let bestSpecies = 1;
    let bestCount = -1;

    for (let s = 1; s <= 3; s++) {
        if (counts[s] > bestCount) {
            bestCount = counts[s];
            bestSpecies = s;
        }
    }

    return bestSpecies;
}

function stepSimulation() {
    const next = makeGrid();

    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const current = grid[y][x];
            const { total, speciesCount } = countNeighbors(x, y);

            if (current) {
                const sameNeighbors = speciesCount[current];
                if (sameNeighbors === 2 || sameNeighbors === 3) {
                    next[y][x] = current;
                    if (Math.random() < MUTATION_RATE) {
                        next[y][x] = 1 + ((current + Math.floor(Math.random() * 2)) % 3);
                    }
                }
            } else if (total === 3) {
                next[y][x] = dominantSpecies(speciesCount);
            }
        }
    }

    grid = next;
    generation++;
    updateHud();
}

function draw() {
    ctx.fillStyle = '#010204';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            const state = grid[y][x];
            if (!state) continue;

            const px = x * CELL;
            const py = y * CELL;

            ctx.fillStyle = COLORS[state];
            ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(px + 2, py + 2, CELL - 5, 2);
        }
    }

    ctx.strokeStyle = 'rgba(90, 120, 210, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID_W; x++) {
        const px = x * CELL + 0.5;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y <= GRID_H; y++) {
        const py = y * CELL + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
    }
}

function updateHud() {
    let alive = 0;
    const seen = new Set();

    for (const row of grid) {
        for (const cell of row) {
            if (cell) {
                alive++;
                seen.add(cell);
            }
        }
    }

    generationEl.textContent = generation;
    liveCellsEl.textContent = alive;
    diversityEl.textContent = seen.size;
    simStateEl.textContent = running ? 'Running' : 'Paused';
}

function getCellFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width / CELL);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height / CELL);

    if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) return null;
    return { x, y };
}

function paintAt(event) {
    const cell = getCellFromEvent(event);
    if (!cell) return;

    const { x, y } = cell;
    grid[y][x] = brushSpecies;

    if (brushSpecies && Math.random() < 0.22) {
        const nx = x + (Math.random() < 0.5 ? -1 : 1);
        const ny = y + (Math.random() < 0.5 ? -1 : 1);
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            grid[ny][nx] = brushSpecies;
        }
    }

    updateHud();
    draw();
}

function randomize() {
    grid = makeGrid();
    for (let y = 0; y < GRID_H; y++) {
        for (let x = 0; x < GRID_W; x++) {
            if (Math.random() < 0.2) {
                grid[y][x] = 1 + Math.floor(Math.random() * 3);
            }
        }
    }
    generation = 0;
    updateHud();
    draw();
}

function clearGrid() {
    grid = makeGrid();
    generation = 0;
    updateHud();
    draw();
}

function applyPreset(name) {
    clearGrid();

    const centerX = Math.floor(GRID_W / 2);
    const centerY = Math.floor(GRID_H / 2);

    if (name === 'glider') {
        const glider = [
            [1, 0],
            [2, 1],
            [0, 2], [1, 2], [2, 2]
        ];
        stampPattern(glider, centerX - 1, centerY - 1, 1);
    }

    if (name === 'lwss') {
        const lwss = [
            [1, 0], [4, 0],
            [0, 1],
            [0, 2], [4, 2],
            [0, 3], [1, 3], [2, 3], [3, 3]
        ];
        stampPattern(lwss, centerX - 2, centerY - 2, 2);
    }

    if (name === 'pulsar') {
        const pulsar = [
            [2, 0], [3, 0], [4, 0], [8, 0], [9, 0], [10, 0],
            [0, 2], [5, 2], [7, 2], [12, 2],
            [0, 3], [5, 3], [7, 3], [12, 3],
            [0, 4], [5, 4], [7, 4], [12, 4],
            [2, 5], [3, 5], [4, 5], [8, 5], [9, 5], [10, 5],
            [2, 7], [3, 7], [4, 7], [8, 7], [9, 7], [10, 7],
            [0, 8], [5, 8], [7, 8], [12, 8],
            [0, 9], [5, 9], [7, 9], [12, 9],
            [0, 10], [5, 10], [7, 10], [12, 10],
            [2, 12], [3, 12], [4, 12], [8, 12], [9, 12], [10, 12]
        ];
        stampPattern(pulsar, centerX - 6, centerY - 6, 3);
    }

    if (name === 'gosper-gun') {
        const gun = [
            [24, 0],
            [22, 1], [24, 1],
            [12, 2], [13, 2], [20, 2], [21, 2], [34, 2], [35, 2],
            [11, 3], [15, 3], [20, 3], [21, 3], [34, 3], [35, 3],
            [0, 4], [1, 4], [10, 4], [16, 4], [20, 4], [21, 4],
            [0, 5], [1, 5], [10, 5], [14, 5], [16, 5], [17, 5], [22, 5], [24, 5],
            [10, 6], [16, 6], [24, 6],
            [11, 7], [15, 7],
            [12, 8], [13, 8]
        ];
        stampPattern(gun, Math.max(1, centerX - 18), Math.max(1, centerY - 4), 1);
    }

    if (name === 'toad') {
        const toad = [
            [1, 0], [2, 0], [3, 0],
            [0, 1], [1, 1], [2, 1]
        ];
        stampPattern(toad, centerX - 2, centerY - 1, 2);
    }

    if (name === 'beacon') {
        const beacon = [
            [0, 0], [1, 0],
            [0, 1], [1, 1],
            [2, 2], [3, 2],
            [2, 3], [3, 3]
        ];
        stampPattern(beacon, centerX - 2, centerY - 2, 3);
    }

    if (name === 'pentadecathlon') {
        const penta = [
            [2, 0], [3, 0],
            [0, 1], [1, 1], [4, 1], [5, 1],
            [2, 2], [3, 2],
            [2, 3], [3, 3],
            [2, 4], [3, 4],
            [0, 5], [1, 5], [4, 5], [5, 5],
            [2, 6], [3, 6]
        ];
        stampPattern(penta, centerX - 3, centerY - 3, 1);
    }

    if (name === 'r-pentomino') {
        const rPento = [
            [1, 0], [2, 0],
            [0, 1], [1, 1],
            [1, 2]
        ];
        stampPattern(rPento, centerX - 1, centerY - 1, 2);
    }

    if (name === 'glider-rain') {
        for (let i = 0; i < 16; i++) {
            const x = 2 + i * 3;
            const y = 2 + (i % 3);
            const s = 1 + (i % 3);
            const pattern = [
                [1, 0],
                [2, 1],
                [0, 2], [1, 2], [2, 2]
            ];
            stampPattern(pattern, x, y, s);
        }
    }

    if (name === 'coral-bloom') {
        for (let r = 2; r < Math.min(GRID_W, GRID_H) / 2 - 2; r += 3) {
            for (let t = 0; t < Math.PI * 2; t += 0.3) {
                const x = Math.round(centerX + Math.cos(t) * r);
                const y = Math.round(centerY + Math.sin(t) * r * 0.65);
                if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
                    grid[y][x] = 1 + (r % 3);
                }
            }
        }
    }

    if (name === 'circuit-seeds') {
        for (let y = 4; y < GRID_H - 4; y += 4) {
            for (let x = 4; x < GRID_W - 4; x += 4) {
                const s = 1 + ((x + y) % 3);
                grid[y][x] = s;
                grid[y][x + 1] = s;
                grid[y + 1][x] = s;
            }
        }
    }

    updateHud();
    draw();
}

function exportPng() {
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `pixel-petri-lab-${stamp}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function setRunning(nextState) {
    running = nextState;
    runBtn.textContent = running ? 'Pause' : 'Run';
    updateHud();
}

speciesButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        brushSpecies = Number(btn.dataset.species);
        speciesButtons.forEach((other) => other.classList.toggle('active', other === btn));
    });
});

presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
    });
});

runBtn.addEventListener('click', () => {
    setRunning(!running);
});

stepBtn.addEventListener('click', () => {
    stepSimulation();
    draw();
});

randomBtn.addEventListener('click', randomize);
clearBtn.addEventListener('click', clearGrid);
exportBtn.addEventListener('click', exportPng);

canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    paintAt(event);
});

canvas.addEventListener('pointermove', (event) => {
    if (!pointerDown) return;
    paintAt(event);
});

window.addEventListener('pointerup', () => {
    pointerDown = false;
});

canvas.addEventListener('touchstart', (event) => {
    pointerDown = true;
    paintAt(event);
    event.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (!pointerDown) return;
    paintAt(event);
    event.preventDefault();
}, { passive: false });

function tick(time) {
    if (running && time - lastStep > STEP_MS) {
        stepSimulation();
        lastStep = time;
    }

    draw();
    requestAnimationFrame(tick);
}

applyPreset('coral-bloom');
setRunning(false);
requestAnimationFrame(tick);
