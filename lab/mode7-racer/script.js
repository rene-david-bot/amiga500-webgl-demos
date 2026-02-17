const canvas = document.getElementById("road");
const ctx = canvas.getContext("2d");

const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");

const state = {
    width: 0,
    height: 0,
    horizon: 0,
    distance: 0,
    speed: 0,
    playerX: 0,
    lap: 1,
    lastLapDistance: 0,
};

const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
};

const ROAD = {
    width: 1600,
    segmentLength: 260,
    rumbleWidth: 0.12,
    laneWidth: 0.08,
};

function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
    state.horizon = rect.height * 0.45;
}

window.addEventListener("resize", resize);
resize();

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function curveAt(z) {
    return (
        Math.sin(z * 0.00055) * 0.9 +
        Math.sin(z * 0.0012 + 1.7) * 0.35
    );
}

function update(dt) {
    const accel = keys.up ? 1.45 : keys.down ? -2.2 : -0.6;
    state.speed += accel * dt;
    state.speed = clamp(state.speed, 0, 1.6);

    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    state.playerX += steer * dt * (1.1 + state.speed * 1.6);
    state.playerX = clamp(state.playerX, -1.1, 1.1);

    const drift = curveAt(state.distance + 1600) * 0.0012 * (0.3 + state.speed);
    state.playerX -= drift;

    const offRoad = Math.abs(state.playerX) > 1.0;
    if (offRoad) {
        state.speed *= 0.985;
    }

    state.distance += state.speed * dt * 900;

    if (state.distance - state.lastLapDistance > 12000) {
        state.lap += 1;
        state.lastLapDistance = state.distance;
        const lapEl = document.getElementById("lap");
        if (lapEl) lapEl.textContent = state.lap;
    }

    const kmh = Math.round(state.speed * 180);
    speedEl.textContent = kmh;
    gearEl.textContent = state.speed < 0.05 ? "N" : state.speed < 0.5 ? "2" : state.speed < 1.0 ? "3" : "4";
}

function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, state.height);
    grad.addColorStop(0, "#4b1d6b");
    grad.addColorStop(0.35, "#ff6aa2");
    grad.addColorStop(0.55, "#ffb25b");
    grad.addColorStop(1, "#132036");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);

    // Sun
    ctx.fillStyle = "rgba(255, 220, 140, 0.9)";
    ctx.beginPath();
    ctx.arc(state.width * 0.75, state.horizon - 30, 38, 0, Math.PI * 2);
    ctx.fill();
}

function drawRoad() {
    const yStart = state.horizon;
    const yEnd = state.height;
    const roadMax = state.width * 0.46;
    const roadMin = state.width * 0.012;
    const depth = 8200;

    for (let y = yStart; y < yEnd; y++) {
        const p = (y - yStart) / (yEnd - yStart); // 0..1
        const p2 = p * p;
        const p3 = p2 * p;
        const z = p * depth;
        const curve = curveAt(state.distance + z);

        const roadHalf = roadMin + (roadMax - roadMin) * p3;
        const rumble = roadHalf * ROAD.rumbleWidth;
        const lane = roadHalf * ROAD.laneWidth;

        let center =
            state.width / 2 +
            curve * 180 * (1 - p) -
            state.playerX * (120 * (1 - p * 0.4));

        const margin = roadHalf + rumble + 8;
        center = clamp(center, margin, state.width - margin);

        const segment = Math.floor((state.distance + z) / ROAD.segmentLength);
        const even = segment % 2 === 0;

        const baseR = 18 - p * 10 + (even ? 6 : 0);
        const baseG = 44 - p * 22 + (even ? 8 : 0);
        const baseB = 34 - p * 18 + (even ? 6 : 0);
        const grass = `rgb(${Math.max(0, baseR)}, ${Math.max(0, baseG)}, ${Math.max(0, baseB)})`;

        const leftEdge = center - roadHalf - rumble;
        const rightEdge = center + roadHalf + rumble;

        ctx.fillStyle = grass;
        if (leftEdge > 0) ctx.fillRect(0, y, leftEdge, 1);
        if (rightEdge < state.width) ctx.fillRect(rightEdge, y, state.width - rightEdge, 1);

        ctx.fillStyle = even ? "#5a2f44" : "#3a2431";
        ctx.fillRect(center - roadHalf - rumble, y, rumble, 1);
        ctx.fillRect(center + roadHalf, y, rumble, 1);

        ctx.fillStyle = even ? "#4c5058" : "#42464f";
        ctx.fillRect(center - roadHalf, y, roadHalf * 2, 1);

        if (segment % 3 === 0) {
            ctx.fillStyle = "rgba(220, 220, 240, 0.6)";
            ctx.fillRect(center - lane / 2, y, lane, 1);
            ctx.fillRect(center - roadHalf * 0.35 - lane / 2, y, lane, 1);
            ctx.fillRect(center + roadHalf * 0.35 - lane / 2, y, lane, 1);
        }
    }
}

function drawPlayer() {
    const baseY = state.height * 0.85;
    const x = state.width / 2 - state.playerX * 140;
    ctx.fillStyle = "#e5f4ff";
    ctx.fillRect(x - 18, baseY - 10, 36, 20);
    ctx.fillStyle = "#38d1ff";
    ctx.fillRect(x - 10, baseY - 6, 20, 12);
    ctx.fillStyle = "#1c223a";
    ctx.fillRect(x - 6, baseY - 4, 12, 8);
}

let last = performance.now();
function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    update(dt);
    ctx.clearRect(0, 0, state.width, state.height);
    drawSky();
    drawRoad();
    drawPlayer();

    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

function setKey(e, isDown) {
    if (e.key === "ArrowLeft" || e.key === "a") keys.left = isDown;
    if (e.key === "ArrowRight" || e.key === "d") keys.right = isDown;
    if (e.key === "ArrowUp" || e.key === "w") keys.up = isDown;
    if (e.key === "ArrowDown" || e.key === "s") keys.down = isDown;
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));
