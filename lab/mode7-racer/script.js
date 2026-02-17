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
    width: 2200,
    cameraHeight: 1000,
    cameraDepth: 0.8,
    segmentLength: 220,
    rumbleWidth: 0.12,
    laneWidth: 0.06,
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
        Math.sin((z + state.distance) * 0.00055) * 0.9 +
        Math.sin((z + state.distance) * 0.0012 + 1.7) * 0.35
    );
}

function update(dt) {
    const accel = keys.up ? 1.45 : keys.down ? -2.2 : -0.6;
    state.speed += accel * dt;
    state.speed = clamp(state.speed, 0, 1.6);

    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    state.playerX += steer * dt * (1.1 + state.speed * 1.6);
    state.playerX = clamp(state.playerX, -1.1, 1.1);

    const drift = curveAt(state.distance) * 0.0015 * (0.3 + state.speed);
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
    const camDepth = state.height * ROAD.cameraDepth;
    for (let y = state.horizon; y < state.height; y++) {
        const perspective = camDepth / (y - state.horizon + 1);
        const z = perspective * ROAD.cameraHeight;
        const curve = curveAt(z);
        const roadHalf = perspective * ROAD.width;
        const rumble = roadHalf * ROAD.rumbleWidth;
        const lane = roadHalf * ROAD.laneWidth;

        const center = state.width / 2 + curve * roadHalf * 1.6 - state.playerX * roadHalf * 1.3;

        const segment = Math.floor((z + state.distance) / ROAD.segmentLength);
        const even = segment % 2 === 0;

        ctx.fillStyle = even ? "#0c3d24" : "#0a2d1b";
        ctx.fillRect(0, y, state.width, 1);

        ctx.fillStyle = even ? "#c23655" : "#f7e25f";
        ctx.fillRect(center - roadHalf - rumble, y, rumble, 1);
        ctx.fillRect(center + roadHalf, y, rumble, 1);

        ctx.fillStyle = even ? "#4c4f55" : "#585b61";
        ctx.fillRect(center - roadHalf, y, roadHalf * 2, 1);

        if (segment % 3 === 0) {
            ctx.fillStyle = "rgba(230, 230, 255, 0.85)";
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
