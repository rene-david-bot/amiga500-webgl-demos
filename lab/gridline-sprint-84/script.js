const canvas = document.getElementById("track");
const ctx = canvas.getContext("2d");

const stateEl = document.getElementById("state");
const lapEl = document.getElementById("lap-time");
const bestEl = document.getElementById("best-time");
const speedEl = document.getElementById("speed");
const boostEl = document.getElementById("boost");
const restartBtn = document.getElementById("restart");
const audioBtn = document.getElementById("audio");

const TAU = Math.PI * 2;
const CENTER = { x: canvas.width * 0.5, y: canvas.height * 0.52 };
const TRACK = {
    inner: 128,
    outer: 232,
    lane: 180,
    wobble: 12
};

const START_ANGLE = -Math.PI * 0.5;
const CHECKPOINTS = [-1.0, -0.2, 0.55, 1.25, 2.05, 2.8].map((a) => a);
const BOOST_PAD_ANGLES = [-0.55, 0.85, 2.45];
const BOOST_DURATION = 2.6;

const keys = { left: false, right: false, up: false, down: false };
const particles = [];

const car = {
    x: 0,
    y: 0,
    heading: START_ANGLE,
    speed: 0,
    boost: 0,
    checkpointIndex: 0,
    lapActive: false,
    lapStartMs: 0,
    lapMs: 0,
    lastGateMs: -9999,
    lastCheckpointMs: -9999
};

const boosts = BOOST_PAD_ANGLES.map((angle) => ({ angle, nextReady: 0 }));
const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    twinkle: Math.random() * TAU
}));

const BEST_KEY = "retro.gridlineSprint84.best";
let bestLap = Number(localStorage.getItem(BEST_KEY)) || null;
let audioEnabled = false;
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let toneBus = null;
let lastFrame = performance.now();
let statusMessage = "Cross the gate to start the timer.";

function fmtSeconds(value) {
    return value.toFixed(3).padStart(6, "0");
}

function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function laneAt(theta) {
    const wobble = Math.sin(theta * 3 + 0.8) * TRACK.wobble;
    return {
        inner: TRACK.inner + wobble,
        outer: TRACK.outer + wobble,
        mid: TRACK.lane + wobble
    };
}

function polar(angle, radius) {
    return {
        x: CENTER.x + Math.cos(angle) * radius,
        y: CENTER.y + Math.sin(angle) * radius
    };
}

function kartSpawn() {
    const angle = START_ANGLE + 0.18;
    const r = laneAt(angle).mid;
    const pos = polar(angle, r);
    car.x = pos.x;
    car.y = pos.y;
    car.heading = angle + Math.PI * 0.5;
    car.speed = 0;
    car.boost = 0;
    car.checkpointIndex = 0;
    car.lapActive = false;
    car.lapMs = 0;
    car.lastGateMs = -9999;
    car.lastCheckpointMs = -9999;
}

function resetRun(message = "Run reset. Cross the gate to start.") {
    kartSpawn();
    statusMessage = message;
}

function isOnTrack(x, y) {
    const dx = x - CENTER.x;
    const dy = y - CENTER.y;
    const theta = Math.atan2(dy, dx);
    const lane = laneAt(theta);
    const dist = Math.hypot(dx, dy);
    return dist > lane.inner && dist < lane.outer;
}

function nearGate() {
    const theta = Math.atan2(car.y - CENTER.y, car.x - CENTER.x);
    const lane = laneAt(theta);
    const dist = Math.hypot(car.x - CENTER.x, car.y - CENTER.y);
    const closeAngle = Math.abs(angleDiff(theta, START_ANGLE)) < 0.11;
    const closeLane = Math.abs(dist - lane.mid) < 22;
    return closeAngle && closeLane;
}

function tryCheckpoint(nowMs) {
    if (!car.lapActive || car.checkpointIndex >= CHECKPOINTS.length) return;
    if (nowMs - car.lastCheckpointMs < 400) return;

    const theta = Math.atan2(car.y - CENTER.y, car.x - CENTER.x);
    const target = CHECKPOINTS[car.checkpointIndex];
    if (Math.abs(angleDiff(theta, target)) < 0.14) {
        car.checkpointIndex += 1;
        car.lastCheckpointMs = nowMs;
        popTone(680 + car.checkpointIndex * 45, 0.07, 0.045);

        if (car.checkpointIndex >= CHECKPOINTS.length) {
            statusMessage = "All checkpoints green. Bring it home.";
        } else {
            statusMessage = `Checkpoint ${car.checkpointIndex}/${CHECKPOINTS.length}`;
        }
    }
}

function handleGate(nowMs) {
    if (!nearGate() || car.speed < 45) return;
    if (nowMs - car.lastGateMs < 800) return;
    car.lastGateMs = nowMs;

    if (!car.lapActive) {
        car.lapActive = true;
        car.lapStartMs = nowMs;
        car.lapMs = 0;
        car.checkpointIndex = 0;
        statusMessage = "Lap started. Hit every checkpoint.";
        popTone(520, 0.09, 0.08);
        return;
    }

    if (car.checkpointIndex < CHECKPOINTS.length) {
        statusMessage = `Missed checkpoints (${car.checkpointIndex}/${CHECKPOINTS.length}).`;
        popTone(180, 0.11, 0.06);
        return;
    }

    const lapSeconds = (nowMs - car.lapStartMs) / 1000;
    car.lapMs = 0;
    car.lapStartMs = nowMs;
    car.checkpointIndex = 0;
    statusMessage = `Lap locked: ${fmtSeconds(lapSeconds)}s`;
    popTone(880, 0.11, 0.09);

    if (!bestLap || lapSeconds < bestLap) {
        bestLap = lapSeconds;
        localStorage.setItem(BEST_KEY, String(bestLap));
        statusMessage = `New best lap: ${fmtSeconds(lapSeconds)}s`;
        popTone(1040, 0.12, 0.12);
    }
}

function updateBoosts(nowMs) {
    boosts.forEach((pad) => {
        const lane = laneAt(pad.angle);
        const pos = polar(pad.angle, lane.mid);
        const hit = Math.hypot(car.x - pos.x, car.y - pos.y) < 18;
        if (hit && nowMs >= pad.nextReady) {
            car.boost = BOOST_DURATION;
            pad.nextReady = nowMs + 3600;
            statusMessage = "Boost pad hit. Nitro engaged.";
            popTone(920, 0.12, 0.08);
        }
    });
}

function emitTrail(dt) {
    if (Math.abs(car.speed) < 55) return;
    const laneHit = isOnTrack(car.x, car.y);
    const base = laneHit ? "126,255,244" : "255,124,201";
    particles.push({
        x: car.x - Math.cos(car.heading) * 14,
        y: car.y - Math.sin(car.heading) * 14,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: laneHit ? 0.35 : 0.55,
        ttl: laneHit ? 0.35 : 0.55,
        color: base
    });

    for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function updateCar(dt, nowMs) {
    const accelerate = keys.up ? 1 : 0;
    const brake = keys.down ? 1 : 0;
    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    const boostFactor = car.boost > 0 ? 1.45 : 1;
    const accelForce = accelerate * 248 * boostFactor - brake * 172;
    const drag = Math.abs(car.speed) < 8 ? 4.4 : 1.9;

    car.speed += accelForce * dt;
    car.speed -= car.speed * drag * dt;
    const maxSpeed = 278 * boostFactor;
    car.speed = clamp(car.speed, -92, maxSpeed);

    const steerScale = clamp(Math.abs(car.speed) / 145, 0, 1);
    const turnRate = 2.65 * steerScale;
    car.heading += steer * turnRate * dt * (car.speed >= 0 ? 1 : -0.65);

    car.x += Math.cos(car.heading) * car.speed * dt;
    car.y += Math.sin(car.heading) * car.speed * dt;

    const onTrack = isOnTrack(car.x, car.y);
    if (!onTrack) {
        car.speed *= 1 - 1.7 * dt;
        statusMessage = car.lapActive ? "Off track. Get back on lane." : statusMessage;
    }

    if (car.boost > 0) {
        car.boost = Math.max(0, car.boost - dt);
    }

    const dist = Math.hypot(car.x - CENTER.x, car.y - CENTER.y);
    if (dist > TRACK.outer + 70) {
        const theta = Math.atan2(car.y - CENTER.y, car.x - CENTER.x);
        const safe = polar(theta, laneAt(theta).mid);
        car.x = (car.x + safe.x) * 0.5;
        car.y = (car.y + safe.y) * 0.5;
        car.speed *= 0.6;
    }

    if (car.lapActive) {
        car.lapMs = nowMs - car.lapStartMs;
    }

    tryCheckpoint(nowMs);
    handleGate(nowMs);
    updateBoosts(nowMs);
    emitTrail(dt);
    updateEngine();
}

function drawBackground(timeMs) {
    ctx.fillStyle = "#050910";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star, i) => {
        const t = timeMs * 0.0015 + star.twinkle + i * 0.03;
        const glow = 0.35 + Math.sin(t) * 0.25;
        ctx.fillStyle = `rgba(126, 255, 244, ${glow.toFixed(3)})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    ctx.strokeStyle = "rgba(126,255,244,0.06)";
    ctx.lineWidth = 1;
    const cell = 28;
    for (let x = 0; x < canvas.width; x += cell) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += cell) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawTrack() {
    const steps = 220;
    const outerPts = [];
    const innerPts = [];

    for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * TAU;
        const lane = laneAt(a);
        outerPts.push(polar(a, lane.outer));
        innerPts.push(polar(a, lane.inner));
    }

    ctx.save();
    ctx.beginPath();
    outerPts.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    innerPts.reverse().forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 40, 0, canvas.height - 40);
    grad.addColorStop(0, "#13223b");
    grad.addColorStop(1, "#0d1728");
    ctx.fillStyle = grad;
    ctx.fill("evenodd");

    ctx.strokeStyle = "rgba(126,255,244,0.34)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.setLineDash([11, 16]);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
        const a = (i / steps) * TAU;
        const p = polar(a, laneAt(a).mid);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    drawGate();
    drawCheckpoints();
    drawBoostPads();
}

function drawGate() {
    const lane = laneAt(START_ANGLE);
    const inPos = polar(START_ANGLE, lane.inner + 7);
    const outPos = polar(START_ANGLE, lane.outer - 7);

    ctx.strokeStyle = "rgba(255,124,201,0.95)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(inPos.x, inPos.y);
    ctx.lineTo(outPos.x, outPos.y);
    ctx.stroke();

    const steps = 8;
    for (let i = 0; i < steps; i += 1) {
        const t = i / (steps - 1);
        const x = inPos.x + (outPos.x - inPos.x) * t;
        const y = inPos.y + (outPos.y - inPos.y) * t;
        ctx.fillStyle = i % 2 === 0 ? "#fff" : "#181b21";
        ctx.fillRect(x - 4, y - 4, 8, 8);
    }
}

function drawCheckpoints() {
    CHECKPOINTS.forEach((angle, idx) => {
        const lane = laneAt(angle);
        const inPos = polar(angle, lane.inner + 12);
        const outPos = polar(angle, lane.outer - 12);
        const passed = idx < car.checkpointIndex;

        ctx.strokeStyle = passed ? "rgba(126,255,244,0.8)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = passed ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(inPos.x, inPos.y);
        ctx.lineTo(outPos.x, outPos.y);
        ctx.stroke();
    });
}

function drawBoostPads() {
    const now = performance.now();
    boosts.forEach((pad) => {
        const lane = laneAt(pad.angle);
        const pos = polar(pad.angle, lane.mid);
        const ready = now >= pad.nextReady;
        const pulse = 0.5 + Math.sin(now * 0.008 + pad.angle * 4) * 0.3;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 11, 0, TAU);
        ctx.fillStyle = ready ? `rgba(126,255,244,${0.45 + pulse * 0.4})` : "rgba(90,120,150,0.35)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 18, 0, TAU);
        ctx.strokeStyle = ready ? "rgba(126,255,244,0.55)" : "rgba(120,140,160,0.24)";
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

function drawParticles() {
    particles.forEach((p) => {
        const alpha = clamp(p.life / p.ttl, 0, 1);
        ctx.fillStyle = `rgba(${p.color}, ${Math.max(0, alpha * 0.8).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, TAU);
        ctx.fill();
    });
}

function drawKart() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);

    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(126,255,244,0.6)";

    ctx.fillStyle = "#7efff4";
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-12, 9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#ff7cc9";
    ctx.fillRect(-10, -4, 8, 8);

    ctx.restore();
}

function updateHud() {
    stateEl.textContent = statusMessage;
    lapEl.textContent = car.lapActive ? fmtSeconds(car.lapMs / 1000) : "00.000";
    bestEl.textContent = bestLap ? `${fmtSeconds(bestLap)}s` : "--.---";
    speedEl.textContent = `${Math.round(Math.abs(car.speed) * 0.9)} km/h`;
    boostEl.textContent = `${Math.round((car.boost / BOOST_DURATION) * 100)}%`;
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        toneBus = audioCtx.createGain();
        toneBus.gain.value = 0.2;
        toneBus.connect(audioCtx.destination);

        engineOsc = audioCtx.createOscillator();
        engineGain = audioCtx.createGain();
        engineOsc.type = "sawtooth";
        engineOsc.frequency.value = 70;
        engineGain.gain.value = 0.0001;
        engineOsc.connect(engineGain).connect(toneBus);
        engineOsc.start();
    }

    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function updateEngine() {
    if (!audioEnabled || !audioCtx || !engineOsc || !engineGain) return;
    const now = audioCtx.currentTime;
    const speedNorm = clamp(Math.abs(car.speed) / 280, 0, 1);
    const freq = 80 + speedNorm * 240 + (car.boost > 0 ? 40 : 0);
    const gain = 0.015 + speedNorm * 0.035;

    engineOsc.frequency.setTargetAtTime(freq, now, 0.03);
    engineGain.gain.setTargetAtTime(gain, now, 0.04);
}

function muteEngine() {
    if (!engineGain || !audioCtx) return;
    engineGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.05);
}

function popTone(freq = 720, duration = 0.08, level = 0.07) {
    if (!audioEnabled || !audioCtx || !toneBus) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(level, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(toneBus);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function frame(now) {
    const dt = clamp((now - lastFrame) / 1000, 0, 0.04);
    lastFrame = now;

    updateCar(dt, now);
    drawBackground(now);
    drawTrack();
    drawParticles();
    drawKart();
    updateHud();

    requestAnimationFrame(frame);
}

function onKey(event, down) {
    const code = event.code;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(code)) {
        event.preventDefault();
    }

    if (code === "ArrowLeft" || code === "KeyA") keys.left = down;
    if (code === "ArrowRight" || code === "KeyD") keys.right = down;
    if (code === "ArrowUp" || code === "KeyW") keys.up = down;
    if (code === "ArrowDown" || code === "KeyS") keys.down = down;
}

window.addEventListener("keydown", (e) => onKey(e, true));
window.addEventListener("keyup", (e) => onKey(e, false));

restartBtn.addEventListener("click", () => {
    resetRun();
    popTone(440, 0.1, 0.06);
});

audioBtn.addEventListener("click", () => {
    initAudio();
    audioEnabled = !audioEnabled;
    audioBtn.textContent = audioEnabled ? "Audio: On" : "Audio: Off";
    if (!audioEnabled) {
        muteEngine();
    } else {
        popTone(620, 0.08, 0.06);
    }
});

resetRun("Cross the gate to start the timer.");
updateHud();
requestAnimationFrame(frame);
