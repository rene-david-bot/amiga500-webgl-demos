const canvas = document.getElementById("road");
const ctx = canvas.getContext("2d");

const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const audioBtn = document.getElementById("audio-toggle");

const state = {
    width: 0,
    height: 0,
    horizon: 0,
    position: 0,
    speed: 0,
    playerX: 0,
    lap: 1,
    lastLapDistance: 0,
};

const keys = { left: false, right: false, up: false, down: false };

const config = {
    segmentLength: 200,
    rumbleLength: 3,
    roadWidth: 2000,
    lanes: 3,
    cameraHeight: 1000,
    fov: 70,
    drawDistance: 240,
};

const cameraDepth = 1 / Math.tan((config.fov / 2) * (Math.PI / 180));

const colors = {
    light: { road: "#6b6b6b", grass: "#2f5c2f", rumble: "#d44", lane: "#fff" },
    dark: { road: "#5e5e5e", grass: "#2f5c2f", rumble: "#b22", lane: "#ccc" },
};

let segments = [];
let trackLength = 0;
let lastY = 0;

function easeIn(a, b, p) {
    return a + (b - a) * p * p;
}

function easeOut(a, b, p) {
    return a + (b - a) * (1 - (1 - p) * (1 - p));
}

function easeInOut(a, b, p) {
    return a + (b - a) * ((-Math.cos(p * Math.PI) / 2) + 0.5);
}

function addSegment(curve, y) {
    const n = segments.length;
    segments.push({
        index: n,
        p1: { world: { x: 0, y: lastY, z: n * config.segmentLength }, camera: {}, screen: {} },
        p2: { world: { x: 0, y, z: (n + 1) * config.segmentLength }, camera: {}, screen: {} },
        curve,
        color: Math.floor(n / config.rumbleLength) % 2 ? colors.dark : colors.light,
    });
    lastY = y;
}

function addRoad(enter, hold, leave, curve, hill) {
    const startY = lastY;
    const endY = lastY + hill * config.segmentLength;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++)
        addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++)
        addSegment(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++)
        addSegment(easeOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
}

function buildTrack() {
    segments = [];
    lastY = 0;
    addRoad(60, 80, 60, 0, 0);
    addRoad(40, 80, 40, 0.25, 0);
    addRoad(40, 80, 40, -0.25, 0);
    addRoad(40, 60, 40, 0, 0.3);
    addRoad(40, 60, 40, 0, -0.3);
    addRoad(60, 100, 60, 0.18, 0.15);
    addRoad(60, 100, 60, -0.18, 0.1);
    addRoad(80, 120, 80, 0, 0);
    trackLength = segments.length * config.segmentLength;
}

buildTrack();

function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
    state.horizon = rect.height * 0.47;
}

window.addEventListener("resize", resize);
resize();

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function findSegment(z) {
    return segments[Math.floor(z / config.segmentLength) % segments.length];
}

function project(p, cameraX, cameraY, cameraZ) {
    const dz = p.world.z - cameraZ;
    p.camera.x = p.world.x - cameraX;
    p.camera.y = p.world.y - cameraY;
    p.camera.z = dz;

    p.screen.scale = cameraDepth / dz;
    p.screen.x = Math.round((state.width / 2) + (p.screen.scale * p.camera.x * state.width / 2));
    p.screen.y = Math.round(state.horizon - (p.screen.scale * p.camera.y * state.height / 2));
    p.screen.w = Math.round(p.screen.scale * config.roadWidth * state.width / 2);
}

function update(dt) {
    const maxSpeed = config.segmentLength * 6;
    const accel = keys.up ? maxSpeed * 0.5 : 0;
    const brake = keys.down ? maxSpeed * 0.7 : 0;
    const drag = maxSpeed * 0.3;

    state.speed += (accel - brake - drag * (state.speed / maxSpeed)) * dt;
    state.speed = clamp(state.speed, 0, maxSpeed);

    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    state.playerX += steer * dt * (1.2 + state.speed / maxSpeed * 1.6);
    state.playerX = clamp(state.playerX, -1, 1);

    state.position += state.speed * dt;
    if (state.position >= trackLength) state.position -= trackLength;
    if (state.position < 0) state.position += trackLength;

    const kmh = Math.round((state.speed / maxSpeed) * 220);
    speedEl.textContent = kmh;
    gearEl.textContent = kmh < 5 ? "N" : kmh < 40 ? "1" : kmh < 80 ? "2" : kmh < 120 ? "3" : kmh < 170 ? "4" : "5";

    if (audio.playing) {
        const target = 80 + (state.speed / maxSpeed) * 240;
        audio.engine.frequency.setTargetAtTime(target, audio.ctx.currentTime, 0.05);
    }
}

function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, state.height);
    grad.addColorStop(0, "#4b1d6b");
    grad.addColorStop(0.35, "#ff6aa2");
    grad.addColorStop(0.55, "#ffb25b");
    grad.addColorStop(1, "#132036");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, state.width, state.height);

    ctx.fillStyle = "rgba(255, 220, 140, 0.9)";
    ctx.beginPath();
    ctx.arc(state.width * 0.75, state.horizon - 28, 36, 0, Math.PI * 2);
    ctx.fill();
}

function drawPolygon(color, x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
}

function drawSegment(seg, p1, p2) {
    const rumble1 = p1.w * 0.12;
    const rumble2 = p2.w * 0.12;
    const laneCount = config.lanes;

    ctx.fillStyle = seg.color.grass;
    ctx.fillRect(0, p2.y, state.width, p1.y - p2.y);

    drawPolygon(seg.color.rumble, p1.x - p1.w - rumble1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - rumble2, p2.y);
    drawPolygon(seg.color.rumble, p1.x + p1.w + rumble1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + rumble2, p2.y);

    drawPolygon(seg.color.road, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y);

    if (seg.index % 6 < 3) {
        const laneW1 = (p1.w * 2) / laneCount;
        const laneW2 = (p2.w * 2) / laneCount;
        const lineW1 = p1.w * 0.02;
        const lineW2 = p2.w * 0.02;
        for (let lane = 1; lane < laneCount; lane++) {
            const lanex1 = p1.x - p1.w + laneW1 * lane;
            const lanex2 = p2.x - p2.w + laneW2 * lane;
            drawPolygon(seg.color.lane, lanex1 - lineW1 / 2, p1.y, lanex1 + lineW1 / 2, p1.y, lanex2 + lineW2 / 2, p2.y, lanex2 - lineW2 / 2, p2.y);
        }
    }
}

function drawRoad() {
    const baseSegment = findSegment(state.position);
    const baseIndex = baseSegment.index;
    const playerY = baseSegment.p1.world.y + config.cameraHeight;
    let x = 0;
    let dx = 0;
    let maxY = state.height;

    for (let n = 0; n < config.drawDistance; n++) {
        const seg = segments[(baseIndex + n) % segments.length];
        const looped = seg.index < baseIndex;
        const z1 = seg.index * config.segmentLength + (looped ? trackLength : 0);
        const z2 = z1 + config.segmentLength;

        seg.p1.world.z = z1;
        seg.p2.world.z = z2;
        seg.p1.world.x = x;
        seg.p2.world.x = x + dx;

        project(seg.p1, state.playerX * config.roadWidth, playerY, state.position);
        project(seg.p2, state.playerX * config.roadWidth, playerY, state.position);

        x += dx;
        dx += seg.curve;

        if (seg.p1.screen.y >= maxY) continue;
        drawSegment(seg, seg.p1.screen, seg.p2.screen);
        maxY = seg.p2.screen.y;
    }
}

function drawPlayer() {
    const baseY = state.height * 0.83;
    const x = state.width / 2 + state.playerX * 200;
    const carW = 58;
    const carH = 26;

    ctx.save();
    ctx.translate(x, baseY);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-carW / 2 + 6, carH * 0.55, carW - 12, 6);

    ctx.fillStyle = "#2a3d6b";
    ctx.fillRect(-carW / 2, -carH / 2, carW, carH);

    ctx.fillStyle = "#1e2c4e";
    ctx.fillRect(-carW / 2 + 6, -carH / 2 + 4, carW - 12, 7);

    ctx.fillStyle = "#3bd1ff";
    ctx.fillRect(-carW / 4, -carH / 2 + 6, carW / 2, 9);

    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(-carW / 2 + 5, carH / 2 - 4, 12, 4);
    ctx.fillRect(carW / 2 - 17, carH / 2 - 4, 12, 4);

    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(-carW / 2 + 8, -carH / 2 + 2, 7, 3);
    ctx.fillRect(carW / 2 - 15, -carH / 2 + 2, 7, 3);

    ctx.restore();
}

// Audio
const audio = {
    ctx: null,
    master: null,
    engine: null,
    playing: false,
    timer: null,
    step: 0,
    tempo: 120,
};

function initAudio() {
    if (audio.ctx) return;
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.18;
    audio.master.connect(audio.ctx.destination);

    audio.engine = audio.ctx.createOscillator();
    audio.engine.type = "sawtooth";
    const engineGain = audio.ctx.createGain();
    engineGain.gain.value = 0.12;
    audio.engine.connect(engineGain).connect(audio.master);
    audio.engine.start();
}

function playNote(midi, duration, gain, type) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    osc.frequency.value = freq;
    g.gain.value = 0.0001;
    osc.connect(g).connect(audio.master);
    osc.start();
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration + 0.02);
}

function audioStep() {
    if (!audio.playing) return;
    const step = audio.step++;
    const scale = [0, 3, 5, 7, 10, 12];
    const root = 57; // A3
    const note = root + scale[step % scale.length];
    playNote(note, 0.12, 0.12, "square");
    if (step % 4 === 0) playNote(root - 12, 0.16, 0.14, "triangle");
}

function startAudio() {
    initAudio();
    audio.ctx.resume();
    if (audio.playing) return;
    audio.playing = true;
    audio.timer = setInterval(audioStep, (60 / audio.tempo / 2) * 1000);
    updateAudioLabel();
}

function stopAudio() {
    audio.playing = false;
    if (audio.timer) clearInterval(audio.timer);
    updateAudioLabel();
}

function toggleAudio() {
    if (!audio.playing) startAudio();
    else stopAudio();
}

function updateAudioLabel() {
    if (!audioBtn) return;
    audioBtn.textContent = audio.playing ? "Audio: On" : "Audio: Off";
    audioBtn.classList.toggle("is-on", audio.playing);
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
    if ((e.key === "m" || e.key === "M") && isDown) toggleAudio();
    if (isDown && !audio.playing) startAudio();
}

window.addEventListener("keydown", (e) => setKey(e, true));
window.addEventListener("keyup", (e) => setKey(e, false));

if (audioBtn) {
    audioBtn.addEventListener("click", () => toggleAudio());
    updateAudioLabel();
}

canvas.addEventListener("click", () => {
    if (!audio.playing) startAudio();
});
