const canvas = document.getElementById("road");
const ctx = canvas.getContext("2d");

const speedEl = document.getElementById("speed");
const gearEl = document.getElementById("gear");
const audioBtn = document.getElementById("audio-toggle");

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
    roadWidth: 200,
    rumbleWidth: 22,
    laneWidth: 6,
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
        const grassBand = Math.floor(y / 8) % 2 === 0;
        tctx.fillStyle = grassBand ? "#153728" : "#0f2b1f";
        tctx.fillRect(0, y, w, 1);

        const rumbleBand = Math.floor(y / 6) % 2 === 0;
        tctx.fillStyle = rumbleBand ? "#c0435f" : "#f7d85a";
        tctx.fillRect(roadLeft - ROAD.rumbleWidth, y, ROAD.rumbleWidth, 1);
        tctx.fillRect(roadRight, y, ROAD.rumbleWidth, 1);

        const roadBand = Math.floor(y / 4) % 2 === 0;
        tctx.fillStyle = roadBand ? "#4b5058" : "#3f444c";
        tctx.fillRect(roadLeft, y, ROAD.roadWidth, 1);

        if (y % 28 < 10) {
            tctx.fillStyle = "rgba(220, 220, 240, 0.8)";
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
    state.horizon = rect.height * 0.47;
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
    const maxSpeed = 1.5;
    const accel = keys.up ? 1.2 : 0;
    const brake = keys.down ? 1.8 : 0;
    const drag = 0.9;

    state.speed += (accel - brake - drag * state.speed) * dt;
    state.speed = clamp(state.speed, 0, maxSpeed);

    const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    state.playerX += steer * dt * (1.0 + state.speed * 1.2);
    state.playerX = clamp(state.playerX, -1.0, 1.0);

    const drift = curveAt(state.distance + 1200) * 0.0008 * (0.3 + state.speed);
    state.playerX -= drift;

    if (Math.abs(state.playerX) > 0.95) {
        state.speed *= 0.985;
    }

    state.distance += state.speed * dt * 320;

    if (state.distance - state.lastLapDistance > 12000) {
        state.lap += 1;
        state.lastLapDistance = state.distance;
        const lapEl = document.getElementById("lap");
        if (lapEl) lapEl.textContent = state.lap;
    }

    const kmh = Math.round((state.speed / maxSpeed) * 220);
    speedEl.textContent = kmh;
    const gear = kmh < 5 ? "N" : kmh < 40 ? "1" : kmh < 80 ? "2" : kmh < 120 ? "3" : kmh < 170 ? "4" : "5";
    gearEl.textContent = gear;
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

function drawRoad() {
    const yStart = state.horizon + 2;
    const yEnd = state.height;
    const camHeight = 70;
    const texW = roadTexture.width;
    const texH = roadTexture.height;

    for (let y = yStart; y < yEnd; y++) {
        const dy = y - yStart + 1;
        const perspective = camHeight / dy;
        const curve = curveAt(state.distance + dy * 80);
        const lateral = (curve * 260 - state.playerX * 240) * perspective;

        let lineWidth = texW * perspective;
        lineWidth = Math.min(lineWidth, state.width * 1.4);

        const lineX = (state.width - lineWidth) / 2 + lateral;
        const srcY = ((-state.distance * 0.8 + dy * 10) % texH + texH) % texH;

        ctx.drawImage(roadTexture, 0, srcY, texW, 1, lineX, y, lineWidth, 1);
    }
}

function drawPlayer() {
    const baseY = state.height * 0.83;
    const x = state.width / 2 + state.playerX * 80;
    const carW = 46;
    const carH = 22;

    ctx.save();
    ctx.translate(x, baseY);

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-carW / 2 + 4, carH * 0.55, carW - 8, 6);

    ctx.fillStyle = "#23345e";
    ctx.fillRect(-carW / 2, -carH / 2, carW, carH);

    ctx.fillStyle = "#1a253f";
    ctx.fillRect(-carW / 2 + 6, -carH / 2 + 4, carW - 12, 6);

    ctx.fillStyle = "#3bd1ff";
    ctx.fillRect(-carW / 4, -carH / 2 + 6, carW / 2, 8);

    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(-carW / 2 + 4, carH / 2 - 4, 10, 4);
    ctx.fillRect(carW / 2 - 14, carH / 2 - 4, 10, 4);

    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(-carW / 2 + 6, -carH / 2 + 2, 6, 3);
    ctx.fillRect(carW / 2 - 12, -carH / 2 + 2, 6, 3);

    ctx.restore();
}

// Audio
const audio = {
    ctx: null,
    master: null,
    timer: null,
    playing: false,
    step: 0,
    tempo: 118,
};

function initAudio() {
    if (audio.ctx) return;
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.18;
    audio.master.connect(audio.ctx.destination);
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
    if (step % 4 === 0) {
        playNote(root - 12, 0.16, 0.14, "triangle");
    }
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
