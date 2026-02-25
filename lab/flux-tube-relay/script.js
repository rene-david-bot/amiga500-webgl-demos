const canvas = document.getElementById("relay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const scrambleBtn = document.getElementById("scramble");
const resetBtn = document.getElementById("reset");
const soundBtn = document.getElementById("sound");

const baseWidth = 720;
const baseHeight = 560;
const dpr = window.devicePixelRatio || 1;
canvas.width = baseWidth * dpr;
canvas.height = baseHeight * dpr;
canvas.style.width = `${baseWidth}px`;
canvas.style.height = `${baseHeight}px`;
ctx.scale(dpr, dpr);

const rows = 5;
const cols = 6;
const padding = 40;
const cell = Math.floor(Math.min((baseWidth - padding * 2) / cols, (baseHeight - padding * 2) / rows));
const boardWidth = cell * cols;
const boardHeight = cell * rows;
const offsetX = Math.round((baseWidth - boardWidth) / 2);
const offsetY = Math.round((baseHeight - boardHeight) / 2);

const t = (type, rotation = 0, options = {}) => ({
    type,
    rotation,
    solution: rotation,
    ...options
});

const baseLayout = [
    [null, t("elbow", 0), t("elbow", 1), t("straight", 0), t("elbow", 2), null],
    [t("straight", 1), t("elbow", 2), t("straight", 1), t("tee", 3), t("straight", 1), t("elbow", 1)],
    [t("cap", 0, { locked: true, role: "source", dir: 1 }), t("straight", 0), t("elbow", 3), t("straight", 1), t("elbow", 0), t("cap", 0, { locked: true, role: "core", dir: 3 })],
    [t("elbow", 0), t("straight", 1), t("tee", 1), t("elbow", 2), t("straight", 1), t("elbow", 3)],
    [null, t("elbow", 1), t("straight", 0), t("elbow", 0), null, null]
];

const baseConnectors = {
    straight: [false, true, false, true],
    elbow: [true, true, false, false],
    tee: [true, true, false, true],
    cross: [true, true, true, true]
};

const directions = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
];

let board = buildBoard();
let moves = 0;
let solved = false;
let connected = new Set();

let soundOn = false;
let audioCtx = null;

function buildBoard() {
    return baseLayout.map(row => row.map(tile => (tile ? { ...tile } : null)));
}

function rotateDirs(dirs, rotation) {
    const rotated = [false, false, false, false];
    for (let i = 0; i < 4; i += 1) {
        if (dirs[i]) {
            rotated[(i + rotation) % 4] = true;
        }
    }
    return rotated;
}

function getConnectors(tile) {
    if (!tile || tile.type === "empty") return null;
    if (tile.type === "cap") {
        const dirs = [false, false, false, false];
        dirs[tile.dir] = true;
        return dirs;
    }
    const base = baseConnectors[tile.type];
    if (!base) return null;
    return rotateDirs(base, tile.rotation % 4);
}

function findRole(role) {
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const tile = board[r][c];
            if (tile && tile.role === role) return { r, c, tile };
        }
    }
    return null;
}

function checkConnection() {
    connected = new Set();
    const start = findRole("source");
    const target = findRole("core");
    if (!start || !target) {
        solved = false;
        updateStatus();
        return;
    }

    const queue = [start];
    const visited = new Set();
    let reached = false;

    const key = (r, c) => `${r}-${c}`;

    while (queue.length) {
        const current = queue.shift();
        const { r, c } = current;
        const id = key(r, c);
        if (visited.has(id)) continue;
        visited.add(id);
        connected.add(id);

        if (r === target.r && c === target.c) {
            reached = true;
        }

        const tile = board[r][c];
        const connectors = getConnectors(tile);
        if (!connectors) continue;

        connectors.forEach((open, dirIndex) => {
            if (!open) return;
            const dir = directions[dirIndex];
            const nr = r + dir.dy;
            const nc = c + dir.dx;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return;
            const neighbor = board[nr][nc];
            const neighborConnectors = getConnectors(neighbor);
            if (!neighborConnectors) return;
            const opposite = (dirIndex + 2) % 4;
            if (!neighborConnectors[opposite]) return;
            queue.push({ r: nr, c: nc, tile: neighbor });
        });
    }

    const wasSolved = solved;
    solved = reached;
    updateStatus();

    if (solved && !wasSolved) {
        playSuccess();
    }
}

function updateStatus() {
    if (solved) {
        statusEl.textContent = `Relay online — power locked in ${moves} moves.`;
        statusEl.style.color = "#6ef3b1";
    } else {
        statusEl.textContent = `Signal offline. Rotate tubes to route power. Moves: ${moves}.`;
        statusEl.style.color = "#7f9bb3";
    }
}

function draw() {
    ctx.clearRect(0, 0, baseWidth, baseHeight);

    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const x = offsetX + c * cell;
            const y = offsetY + r * cell;
            const tile = board[r][c];
            const id = `${r}-${c}`;
            const isActive = connected.has(id);

            ctx.fillStyle = tile ? "#0f1724" : "#0a111b";
            ctx.fillRect(x, y, cell, cell);
            ctx.strokeStyle = "#1f2b3b";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);

            if (!tile) continue;

            const connectors = getConnectors(tile);
            if (!connectors) continue;

            const centerX = x + cell / 2;
            const centerY = y + cell / 2;
            const pipeColor = isActive ? "#6ef3b1" : "#4c5f72";

            ctx.save();
            ctx.lineCap = "round";
            ctx.lineWidth = 12;
            ctx.strokeStyle = pipeColor;
            ctx.shadowColor = isActive ? "#6ef3b1" : "transparent";
            ctx.shadowBlur = isActive ? 14 : 0;

            connectors.forEach((open, dirIndex) => {
                if (!open) return;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                if (dirIndex === 0) ctx.lineTo(centerX, y + 12);
                if (dirIndex === 1) ctx.lineTo(x + cell - 12, centerY);
                if (dirIndex === 2) ctx.lineTo(centerX, y + cell - 12);
                if (dirIndex === 3) ctx.lineTo(x + 12, centerY);
                ctx.stroke();
            });

            ctx.beginPath();
            ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
            ctx.fillStyle = pipeColor;
            ctx.fill();
            ctx.restore();

            if (tile.type === "cap") {
                ctx.fillStyle = tile.role === "source" ? "#4ecbff" : "#ffd27a";
                ctx.beginPath();
                ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#0a111b";
                ctx.font = "bold 16px 'IBM Plex Mono', monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(tile.role === "source" ? "S" : "C", centerX, centerY + 1);
            }
        }
    }
}

function playTone(freq, duration, type = "square", volume = 0.08) {
    if (!soundOn) return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
}

function playSuccess() {
    playTone(440, 0.08, "square", 0.09);
    setTimeout(() => playTone(660, 0.08, "square", 0.09), 110);
    setTimeout(() => playTone(880, 0.1, "square", 0.09), 220);
}

function rotateTile(tile) {
    tile.rotation = (tile.rotation + 1) % 4;
}

function scramble() {
    board = buildBoard();
    board.forEach(row =>
        row.forEach(tile => {
            if (!tile || tile.locked) return;
            tile.rotation = Math.floor(Math.random() * 4);
        })
    );
    moves = 0;
    solved = false;
    checkConnection();
    draw();
}

function resetAlignment() {
    board.forEach(row =>
        row.forEach(tile => {
            if (!tile || tile.locked) return;
            tile.rotation = tile.solution;
        })
    );
    moves = 0;
    solved = false;
    checkConnection();
    draw();
}

canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = baseWidth / rect.width;
    const scaleY = baseHeight / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    if (x < offsetX || x > offsetX + boardWidth || y < offsetY || y > offsetY + boardHeight) {
        return;
    }

    const col = Math.floor((x - offsetX) / cell);
    const row = Math.floor((y - offsetY) / cell);
    const tile = board[row][col];
    if (!tile || tile.locked) return;

    rotateTile(tile);
    moves += 1;
    playTone(320, 0.05, "square", 0.06);
    checkConnection();
    draw();
});

scrambleBtn.addEventListener("click", () => {
    scramble();
    playTone(280, 0.07, "square", 0.05);
});

resetBtn.addEventListener("click", () => {
    resetAlignment();
    playTone(520, 0.07, "square", 0.05);
});

soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = `Sound: ${soundOn ? "On" : "Off"}`;
    if (soundOn) {
        playTone(520, 0.08, "square", 0.06);
    }
});

scramble();
