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
    textureWidth: 512,
    textureHeight: 512,
    roadWidth: 210,
    rumbleWidth: 30,
    laneWidth: 10,
};

const roadTexture = document.createElement("canvas");
roadTexture.width = ROAD.textureWidth;
roadTexture.height = ROAD.textureHeight;
const tctx = roadTexture.getContext("2d");

function buildRoadTexture() {
    const w = roadTexture.width;
    const h = roadTexture.height;
    const roadLeft = Math.floor((w - ROAD.roadWidth) / 2);
    const roadRight = roadLeft + ROAD.roadWidth;

    for (let y = 0; y < h; y++) {
        const band = Math.floor(y / 8) % 2 === 0;
        tctx.fillStyle = band ? "#143726" : "#0f2c1f";
        tctx.fillRect(0, y, w, 1);

        const rumbleBand = Math.floor(y / 6) % 2 === 0;
        tctx.fillStyle = rumbleBand ? "#a7375b" : "#f6d552";
        tctx.fillRect(roadLeft - ROAD.rumbleWidth, y, ROAD.rumbleWidth, 1);
        tctx.fillRect(roadRight, y, ROAD.rumbleWidth, 1);

        const roadBand = Math.floor(y / 4) % 2 === 0;
        tctx.fillStyle = roadBand ? "#4b5058" : "#3f444c";
        tctx.fillRect(roadLeft, y, ROAD.roadWidth, 1);

        if (y % 28 < 10) {
            tctx.fillStyle = "rgba(220, 220, 240, 0.7)";
            tctx.fillRect(roadLeft + ROAD.roadWidth / 2 - ROAD.laneWidth / 2, y, ROAD.laneWidth, 1);
            tctx.fillRect(roadLeft + ROAD.roadWidth * 0.2 - ROAD.laneWidth / 2, y, ROAD.laneWidth, 1);
            tctx.fillRect(roadLeft + ROAD.roadWidth * 0.8 - ROAD.laneWidth / 2, y, ROAD.laneWidth, 1);
        }
    }
}

buildRoadTexture();

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
    state.playerX = clamp(state.playerX, -1.0, 1.0);

    const drift = curveAt(state.distance + 1600) * 0.0009 * (0.3 + state.speed);
    state.playerX -= drift;

    const offRoad = Math.abs(state.playerX) > 1.0;
    if (offRoad) {
        state.speed *= 0.985;
    }

    state.distance += state.speed * dt * 220;

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
    const yStart = state.horizon + 1;
    const yEnd = state.height;
    const camHeight = 120;
    const texW = roadTexture.width;
    const texH = roadTexture.height;

    for (let y = yStart; y < yEnd; y++) {
        const dy = y - yStart + 1;
        const perspective = camHeight / dy;
        const curve = curveAt(state.distance + dy * 60);
        const lateral = curve * 320 - state.playerX * 220;

        let lineWidth = texW * perspective;
        lineWidth = Math.min(lineWidth, state.width * 2.0);

        const lineX = (state.width - lineWidth) / 2 + lateral * perspective;
        const srcY = ((state.distance * 0.6 + dy * 8) % texH + texH) % texH;

        ctx.drawImage(roadTexture, 0, srcY, texW, 1, lineX, y, lineWidth, 1);
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
