const canvas = document.getElementById("scope");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const shuffleBtn = document.getElementById("shuffle");
const clearBtn = document.getElementById("clear");
const autoScanBtn = document.getElementById("autoscan");
const soundBtn = document.getElementById("sound");
const saveBtn = document.getElementById("save");

const STAR_COUNT = 28;
let stars = [];
let lines = [];
let lineKeys = new Set();
let selectedIndex = null;
let autoScan = false;
let soundOn = false;
let scanPhase = 0;
let lastTime = 0;
let audioCtx = null;

const palette = {
    glow: "#54ffb5",
    soft: "rgba(84, 255, 181, 0.15)",
    grid: "rgba(84, 255, 181, 0.12)",
    line: "rgba(140, 255, 220, 0.85)",
    star: "rgba(200, 255, 240, 0.95)",
    highlight: "rgba(120, 255, 210, 0.9)",
    bg: "#01040a"
};

const state = {
    dpr: window.devicePixelRatio || 1,
    width: 0,
    height: 0,
    rect: null
};

function updateStatus(message) {
    statusEl.textContent = message;
}

function resizeCanvas() {
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    state.dpr = dpr;
    state.width = Math.max(480, rect.width);
    state.height = Math.max(360, rect.height);
    canvas.width = Math.floor(state.width * dpr);
    canvas.height = Math.floor(state.height * dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    state.rect = canvas.getBoundingClientRect();
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function generateStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
        x: rand(0.08, 0.92),
        y: rand(0.1, 0.9),
        size: rand(1.3, 2.8),
        twinkle: rand(0, Math.PI * 2)
    }));
    lines = [];
    lineKeys.clear();
    selectedIndex = null;
    updateStatus(`${STAR_COUNT} stars online. Awaiting your constellation.`);
}

function toCanvasCoords(event) {
    const rect = state.rect || canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * state.dpr;
    const y = (event.clientY - rect.top) * state.dpr;
    return { x, y };
}

function pickStar(x, y) {
    const threshold = 18 * state.dpr;
    let pick = null;
    let bestDist = Infinity;
    stars.forEach((star, index) => {
        const sx = star.x * canvas.width;
        const sy = star.y * canvas.height;
        const dist = Math.hypot(x - sx, y - sy);
        if (dist < threshold && dist < bestDist) {
            bestDist = dist;
            pick = index;
        }
    });
    return pick;
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, duration, gain = 0.05) {
    if (!soundOn) return;
    ensureAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    amp.gain.value = 0.0001;
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
}

function addLine(a, b) {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (lineKeys.has(key)) return;
    lineKeys.add(key);
    lines.push({ a, b });
}

canvas.addEventListener("click", (event) => {
    const { x, y } = toCanvasCoords(event);
    const hit = pickStar(x, y);
    if (hit === null) return;

    if (selectedIndex === hit) {
        selectedIndex = null;
        updateStatus("Chain ended. Select a new star to begin again.");
        playTone(220, 0.12, 0.04);
        return;
    }

    if (selectedIndex !== null) {
        addLine(selectedIndex, hit);
        playTone(620, 0.1, 0.04);
    } else {
        playTone(420, 0.08, 0.03);
    }

    selectedIndex = hit;
    updateStatus(`Linked ${lines.length} segments. Continue the chain or stop on a star.`);
});

shuffleBtn.addEventListener("click", () => {
    generateStars();
    playTone(360, 0.1, 0.04);
});

clearBtn.addEventListener("click", () => {
    lines = [];
    lineKeys.clear();
    selectedIndex = null;
    updateStatus("Lines cleared. Plot a new constellation.");
    playTone(240, 0.12, 0.04);
});

autoScanBtn.addEventListener("click", () => {
    autoScan = !autoScan;
    autoScanBtn.textContent = `Auto‑Scan: ${autoScan ? "On" : "Off"}`;
    updateStatus(autoScan ? "Auto-scan enabled. Watch the sweep." : "Auto-scan disabled.");
    playTone(autoScan ? 520 : 180, 0.1, 0.04);
});

soundBtn.addEventListener("click", async () => {
    soundOn = !soundOn;
    soundBtn.textContent = `Sound: ${soundOn ? "On" : "Off"}`;
    if (soundOn) {
        ensureAudio();
        if (audioCtx.state === "suspended") {
            await audioCtx.resume();
        }
        playTone(520, 0.12, 0.05);
        updateStatus("Sound online. Plot your constellation.");
    } else {
        updateStatus("Sound muted. Plot your constellation.");
    }
});

saveBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "vector-constellation.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    updateStatus("PNG saved. Ready for another plot.");
    playTone(640, 0.1, 0.04);
});

window.addEventListener("resize", () => {
    resizeCanvas();
});

function drawGrid() {
    const step = 60 * state.dpr;
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1 * state.dpr;
    for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawStars(time) {
    stars.forEach((star, index) => {
        const x = star.x * canvas.width;
        const y = star.y * canvas.height;
        const pulse = Math.sin(time * 0.002 + star.twinkle) * 0.4 + 0.8;
        const size = star.size * state.dpr * pulse;

        ctx.beginPath();
        ctx.fillStyle = palette.star;
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = palette.soft;
        ctx.arc(x, y, size * 3.2, 0, Math.PI * 2);
        ctx.fill();

        if (selectedIndex === index) {
            ctx.beginPath();
            ctx.strokeStyle = palette.highlight;
            ctx.lineWidth = 2 * state.dpr;
            ctx.arc(x, y, size * 4.2, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

function drawLines() {
    ctx.lineWidth = 2 * state.dpr;
    ctx.strokeStyle = palette.line;
    lines.forEach(({ a, b }) => {
        const sa = stars[a];
        const sb = stars[b];
        if (!sa || !sb) return;
        ctx.beginPath();
        ctx.moveTo(sa.x * canvas.width, sa.y * canvas.height);
        ctx.lineTo(sb.x * canvas.width, sb.y * canvas.height);
        ctx.stroke();

        ctx.strokeStyle = "rgba(84, 255, 181, 0.2)";
        ctx.lineWidth = 6 * state.dpr;
        ctx.stroke();
        ctx.lineWidth = 2 * state.dpr;
        ctx.strokeStyle = palette.line;
    });
}

function drawScanline(time) {
    if (!autoScan) return;
    scanPhase = (scanPhase + 0.0006 * (time - lastTime)) % 1;
    const x = scanPhase * canvas.width;

    const gradient = ctx.createLinearGradient(x - 80 * state.dpr, 0, x + 80 * state.dpr, 0);
    gradient.addColorStop(0, "rgba(84, 255, 181, 0)");
    gradient.addColorStop(0.5, "rgba(84, 255, 181, 0.25)");
    gradient.addColorStop(1, "rgba(84, 255, 181, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(x - 100 * state.dpr, 0, 200 * state.dpr, canvas.height);
}

function render(time) {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawLines();
    drawScanline(time);
    drawStars(time);

    lastTime = time;
    requestAnimationFrame(render);
}

resizeCanvas();
generateStars();
requestAnimationFrame(render);
