const canvas = document.getElementById("sorter");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const timerEl = document.getElementById("timer");
const sortedEl = document.getElementById("sorted");
const accuracyEl = document.getElementById("accuracy");
const scoreEl = document.getElementById("score");
const audioBtn = document.getElementById("audio");
const resetBtn = document.getElementById("reset");
const gateButtons = Array.from(document.querySelectorAll("[data-gate]"));

const palette = {
    ember: "#ff6b6b",
    ion: "#5cc8ff",
    solar: "#ffd166",
    laneGlow: "rgba(255, 123, 220, 0.35)",
    panel: "#0b1020",
    grid: "rgba(255, 255, 255, 0.06)",
};

const bins = [
    { name: "Ember", color: palette.ember },
    { name: "Ion", color: palette.ion },
    { name: "Solar", color: palette.solar },
];

let gates = [
    { dir: -1 },
    { dir: 1 },
    { dir: -1 },
];

let parcels = [];
let lastTime = 0;
let spawnTimer = 0;
let running = true;
let shiftTime = 60;
let score = 0;
let sorted = 0;
let missed = 0;
let streak = 0;
let audioEnabled = false;
let audioCtx = null;

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function laneCenters(width) {
    const laneWidth = width / 3;
    return [laneWidth * 0.5, laneWidth * 1.5, laneWidth * 2.5];
}

function gateYs(height) {
    return [height * 0.28, height * 0.52, height * 0.76];
}

function toggleGate(index) {
    gates[index].dir *= -1;
    updateGateLabels();
    playTone(320, 0.08);
}

function updateGateLabels() {
    gateButtons.forEach((button) => {
        const index = Number(button.dataset.gate);
        const dir = gates[index].dir;
        button.textContent = `Gate ${String.fromCharCode(65 + index)}: ${dir < 0 ? "◀" : "▶"}`;
    });
}

function spawnParcel(width) {
    const targetLane = Math.floor(Math.random() * 3);
    const colors = [palette.ember, palette.ion, palette.solar];
    const centers = laneCenters(width);
    parcels.push({
        lane: 1,
        x: centers[1],
        y: -20,
        targetLane,
        color: colors[targetLane],
        speed: 70 + Math.random() * 30,
        gateIndex: 0,
        targetX: centers[1],
        size: 12 + Math.random() * 4,
    });
}

function updateParcel(parcel, dt, width, height) {
    const centers = laneCenters(width);
    const gatesY = gateYs(height);
    parcel.y += parcel.speed * dt;

    if (parcel.gateIndex < gatesY.length && parcel.y > gatesY[parcel.gateIndex]) {
        const dir = gates[parcel.gateIndex].dir;
        parcel.lane = Math.min(2, Math.max(0, parcel.lane + dir));
        parcel.targetX = centers[parcel.lane];
        parcel.gateIndex += 1;
        playTone(dir < 0 ? 260 : 380, 0.05);
    }

    parcel.x += (parcel.targetX - parcel.x) * 0.12;

    if (parcel.y > height - 36) {
        const correct = parcel.lane === parcel.targetLane;
        if (correct) {
            score += 120 + streak * 10;
            sorted += 1;
            streak += 1;
            statusEl.textContent = `Clean sort! Streak ${streak}.`;
            playTone(520, 0.12, "sine");
        } else {
            score = Math.max(0, score - 90);
            missed += 1;
            streak = 0;
            statusEl.textContent = "Mis-sort! Bay alarm triggered.";
            playTone(120, 0.18, "sawtooth");
        }
        return false;
    }

    return true;
}

function drawLanes(width, height) {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 2;
    const laneWidth = width / 3;
    for (let i = 1; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(laneWidth * i, 20);
        ctx.lineTo(laneWidth * i, height - 60);
        ctx.stroke();
    }

    const gatesY = gateYs(height);
    gatesY.forEach((y, index) => {
        const dir = gates[index].dir;
        ctx.strokeStyle = palette.laneGlow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();

        ctx.fillStyle = palette.laneGlow;
        ctx.font = "14px 'Courier New', monospace";
        ctx.fillText(`Gate ${String.fromCharCode(65 + index)} ${dir < 0 ? "◀" : "▶"}`, 24, y - 8);
    });
}

function drawBins(width, height) {
    const laneWidth = width / 3;
    bins.forEach((bin, index) => {
        const x = laneWidth * index;
        ctx.fillStyle = "rgba(8, 10, 18, 0.8)";
        ctx.fillRect(x + 6, height - 52, laneWidth - 12, 42);
        ctx.strokeStyle = bin.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, height - 52, laneWidth - 12, 42);
        ctx.fillStyle = bin.color;
        ctx.font = "13px 'Courier New', monospace";
        ctx.fillText(bin.name, x + 16, height - 26);
    });
}

function drawParcels() {
    parcels.forEach((parcel) => {
        ctx.beginPath();
        ctx.fillStyle = parcel.color;
        ctx.shadowBlur = 14;
        ctx.shadowColor = parcel.color;
        ctx.arc(parcel.x, parcel.y, parcel.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(parcel.x - parcel.size * 0.4, parcel.y - parcel.size * 0.5, parcel.size * 0.2, parcel.size * 0.4);
    });
}

function drawHUD(width) {
    ctx.fillStyle = "rgba(8, 12, 24, 0.85)";
    ctx.fillRect(14, 12, 190, 34);
    ctx.strokeStyle = palette.laneGlow;
    ctx.strokeRect(14, 12, 190, 34);
    ctx.fillStyle = palette.laneGlow;
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`Parcels: ${parcels.length}`, 24, 34);
}

function updateMetrics() {
    const total = sorted + missed;
    const accuracy = total === 0 ? 100 : Math.round((sorted / total) * 100);
    sortedEl.textContent = sorted.toString();
    accuracyEl.textContent = `${accuracy}%`;
    scoreEl.textContent = score.toString();
}

function animate(timestamp) {
    if (!running) return;
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.03, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.panel;
    ctx.fillRect(0, 0, width, height);

    drawLanes(width, height);
    drawBins(width, height);

    parcels = parcels.filter((parcel) => updateParcel(parcel, dt, width, height));
    drawParcels();
    drawHUD(width);

    spawnTimer += dt;
    if (shiftTime > 0 && spawnTimer > 1.8) {
        spawnParcel(width);
        spawnTimer = 0;
    }

    shiftTime = Math.max(0, shiftTime - dt);
    timerEl.textContent = `${Math.ceil(shiftTime)}s`;

    if (shiftTime === 0 && parcels.length === 0) {
        statusEl.textContent = `Shift complete · Final score ${score}`;
        running = false;
    }

    updateMetrics();
    requestAnimationFrame(animate);
}

function resetShift() {
    parcels = [];
    spawnTimer = 0;
    running = true;
    shiftTime = 60;
    score = 0;
    sorted = 0;
    missed = 0;
    streak = 0;
    statusEl.textContent = "Shift restarted · parcels inbound";
    lastTime = 0;
    requestAnimationFrame(animate);
}

function setupAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration = 0.1, type = "square") {
    if (!audioEnabled) return;
    if (!audioCtx) setupAudio();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    audioBtn.textContent = `Audio: ${audioEnabled ? "On" : "Off"}`;
    audioBtn.classList.toggle("ghost", !audioEnabled);
    if (audioEnabled) {
        setupAudio();
        playTone(440, 0.12, "triangle");
    }
}

window.addEventListener("resize", () => {
    resizeCanvas();
});

window.addEventListener("keydown", (event) => {
    if (event.key === "1") toggleGate(0);
    if (event.key === "2") toggleGate(1);
    if (event.key === "3") toggleGate(2);
});

gateButtons.forEach((button) => {
    button.addEventListener("click", () => {
        toggleGate(Number(button.dataset.gate));
    });
});

audioBtn.addEventListener("click", toggleAudio);
resetBtn.addEventListener("click", resetShift);

resizeCanvas();
updateGateLabels();
requestAnimationFrame(animate);
