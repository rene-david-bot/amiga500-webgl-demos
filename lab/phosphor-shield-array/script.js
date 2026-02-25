const canvas = document.getElementById("shield");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");
const soundBtn = document.getElementById("sound");

const scoreEl = document.getElementById("score");
const waveEl = document.getElementById("wave");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");

const baseWidth = canvas.width;
const baseHeight = canvas.height;
let dpr = window.devicePixelRatio || 1;

const state = {
    running: false,
    paused: false,
    soundOn: false,
    score: 0,
    wave: 1,
    lives: 3,
    blocked: 0,
    best: Number(localStorage.getItem("shieldBest") || 0),
    shieldAngle: Math.PI * 0.5,
    shieldArc: Math.PI / 3.2,
    shieldRadius: 150,
    shieldThickness: 14,
    coreRadius: 38,
    spawnTimer: 0,
    spawnInterval: 1350,
    projectiles: [],
    particles: [],
    lastTime: 0
};

const keys = {
    left: false,
    right: false
};

const pointer = {
    active: false,
    x: 0,
    y: 0
};

const stars = Array.from({ length: 80 }).map(() => ({
    x: Math.random() * baseWidth,
    y: Math.random() * baseHeight,
    r: Math.random() * 1.4 + 0.4,
    alpha: Math.random() * 0.4 + 0.2
}));

let audioCtx = null;
let masterGain = null;

function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = baseWidth * dpr;
    canvas.height = baseHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

setupCanvas();
window.addEventListener("resize", setupCanvas);

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(audioCtx.destination);
}

function playTone(freq, duration, type = "sine", gain = 0.4) {
    if (!state.soundOn || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.value = 0;
    env.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(env);
    env.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.05);
}

function playBlock() {
    playTone(820 + Math.random() * 180, 0.12, "square", 0.35);
}

function playHit() {
    playTone(120, 0.2, "triangle", 0.5);
}

function playStart() {
    playTone(420, 0.15, "sawtooth", 0.25);
}

function updateReadouts() {
    scoreEl.textContent = state.score;
    waveEl.textContent = state.wave;
    livesEl.textContent = state.lives;
    bestEl.textContent = state.best;
}

function setStatus(text) {
    statusEl.textContent = text;
}

function resetGame() {
    state.running = false;
    state.paused = false;
    state.score = 0;
    state.wave = 1;
    state.lives = 3;
    state.blocked = 0;
    state.spawnTimer = 0;
    state.spawnInterval = 1350;
    state.projectiles = [];
    state.particles = [];
    state.shieldAngle = Math.PI * 0.5;
    updateReadouts();
    setStatus("Shield offline. Start the shift to power up the array.");
}

function startGame() {
    if (!state.running) {
        state.running = true;
        state.paused = false;
        state.lastTime = performance.now();
        setStatus("Array online. Hold the line.");
        playStart();
    } else if (state.paused) {
        state.paused = false;
        state.lastTime = performance.now();
        setStatus("Array online. Hold the line.");
        playStart();
    }
}

function pauseGame() {
    if (!state.running) return;
    state.paused = !state.paused;
    setStatus(state.paused ? "Shift paused. Keep the shield ready." : "Array online. Hold the line.");
}

function toggleSound() {
    state.soundOn = !state.soundOn;
    if (state.soundOn) {
        initAudio();
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        soundBtn.textContent = "Sound: On";
        playStart();
    } else {
        soundBtn.textContent = "Sound: Off";
    }
}

function spawnProjectile() {
    const angle = Math.random() * Math.PI * 2;
    const spawnDistance = Math.max(baseWidth, baseHeight) * 0.65 + Math.random() * 70;
    const cx = baseWidth / 2;
    const cy = baseHeight / 2;
    const x = cx + Math.cos(angle) * spawnDistance;
    const y = cy + Math.sin(angle) * spawnDistance;
    const dx = cx - x;
    const dy = cy - y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 70 + state.wave * 10 + Math.random() * 35;
    state.projectiles.push({
        x,
        y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        r: 6 + Math.random() * 4,
        hue: 170 + Math.random() * 40
    });
}

function emitBurst(x, y, hue) {
    for (let i = 0; i < 12; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 90;
        state.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.6 + Math.random() * 0.5,
            hue
        });
    }
}

function angleDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function updateWave() {
    const target = 6 + state.wave * 2;
    if (state.blocked >= target) {
        state.blocked = 0;
        state.wave += 1;
        state.spawnInterval = Math.max(480, 1350 - (state.wave - 1) * 110);
        setStatus(`Wave ${state.wave} incoming. Shield brace!`);
    }
}

function update(dt) {
    if (keys.left) {
        state.shieldAngle -= dt * 2.6;
    }
    if (keys.right) {
        state.shieldAngle += dt * 2.6;
    }

    if (pointer.active) {
        const cx = baseWidth / 2;
        const cy = baseHeight / 2;
        state.shieldAngle = Math.atan2(pointer.y - cy, pointer.x - cx);
    }

    state.spawnTimer += dt * 1000;
    while (state.spawnTimer >= state.spawnInterval) {
        spawnProjectile();
        state.spawnTimer -= state.spawnInterval;
    }

    const cx = baseWidth / 2;
    const cy = baseHeight / 2;

    state.projectiles = state.projectiles.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy);
        const hitShield = Math.abs(dist - state.shieldRadius) < p.r + state.shieldThickness * 0.55;
        const angleTo = Math.atan2(dy, dx);
        const diff = angleDiff(angleTo, state.shieldAngle);

        if (hitShield && Math.abs(diff) < state.shieldArc * 0.5) {
            state.score += 12 + state.wave * 2;
            state.blocked += 1;
            updateWave();
            emitBurst(p.x, p.y, p.hue);
            playBlock();
            return false;
        }

        if (dist < state.coreRadius + p.r) {
            state.lives -= 1;
            emitBurst(p.x, p.y, 20);
            playHit();
            if (state.lives <= 0) {
                state.running = false;
                state.paused = false;
                setStatus("Core breached. Reset to deploy again.");
                if (state.score > state.best) {
                    state.best = state.score;
                    localStorage.setItem("shieldBest", String(state.best));
                }
            }
            return false;
        }

        return dist < Math.max(baseWidth, baseHeight);
    });

    state.particles = state.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.life > 0;
    });

    if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem("shieldBest", String(state.best));
    }

    updateReadouts();
}

function drawBackground() {
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.save();
    ctx.fillStyle = "rgba(141, 246, 255, 0.15)";
    stars.forEach((star) => {
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawCore() {
    const cx = baseWidth / 2;
    const cy = baseHeight / 2;

    ctx.save();
    const gradient = ctx.createRadialGradient(cx, cy, 8, cx, cy, state.coreRadius * 1.3);
    gradient.addColorStop(0, "rgba(255, 214, 126, 0.9)");
    gradient.addColorStop(1, "rgba(255, 127, 64, 0.15)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, state.coreRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 176, 98, 0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255, 176, 98, 0.6)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, state.coreRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawRing() {
    const cx = baseWidth / 2;
    const cy = baseHeight / 2;

    ctx.save();
    ctx.strokeStyle = "rgba(141, 246, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, state.shieldRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawShield() {
    const cx = baseWidth / 2;
    const cy = baseHeight / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.shieldAngle);
    ctx.strokeStyle = "rgba(255, 176, 98, 0.9)";
    ctx.lineWidth = state.shieldThickness;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255, 176, 98, 0.7)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, state.shieldRadius, -state.shieldArc * 0.5, state.shieldArc * 0.5);
    ctx.stroke();
    ctx.restore();
}

function drawProjectiles() {
    ctx.save();
    state.projectiles.forEach((p) => {
        ctx.fillStyle = `hsla(${p.hue}, 80%, 70%, 0.9)`;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 70%, 0.6)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

function drawParticles() {
    ctx.save();
    state.particles.forEach((p) => {
        ctx.strokeStyle = `hsla(${p.hue}, 80%, 65%, ${Math.max(p.life, 0)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
    });
    ctx.restore();
}

function drawOverlay() {
    if (state.running) return;
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 14, 0.6)";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = "rgba(233, 247, 255, 0.9)";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PRESS START", baseWidth / 2, baseHeight / 2 - 16);
    ctx.font = "16px 'VT323'";
    ctx.fillStyle = "rgba(159, 180, 200, 0.9)";
    ctx.fillText("DEFEND THE CORE", baseWidth / 2, baseHeight / 2 + 18);
    ctx.restore();
}

function drawPaused() {
    if (!state.paused) return;
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 14, 0.6)";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = "rgba(233, 247, 255, 0.9)";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", baseWidth / 2, baseHeight / 2);
    ctx.restore();
}

function draw() {
    drawBackground();
    drawRing();
    drawProjectiles();
    drawShield();
    drawCore();
    drawParticles();
    drawOverlay();
    drawPaused();
}

function loop(now) {
    const dt = Math.min((now - state.lastTime) / 1000, 0.05) || 0;
    state.lastTime = now;
    if (state.running && !state.paused) {
        update(dt);
    }
    draw();
    requestAnimationFrame(loop);
}

startBtn.addEventListener("click", () => {
    if (!state.running) {
        resetGame();
    }
    startGame();
});

pauseBtn.addEventListener("click", pauseGame);

resetBtn.addEventListener("click", () => {
    resetGame();
});

soundBtn.addEventListener("click", toggleSound);

window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "KeyA"].includes(event.code)) keys.left = true;
    if (["ArrowRight", "KeyD"].includes(event.code)) keys.right = true;
    if (event.code === "Space") {
        event.preventDefault();
        if (!state.running) {
            resetGame();
            startGame();
        } else {
            pauseGame();
        }
    }
});

window.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "KeyA"].includes(event.code)) keys.left = false;
    if (["ArrowRight", "KeyD"].includes(event.code)) keys.right = false;
});

canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * baseWidth;
    pointer.y = ((event.clientY - rect.top) / rect.height) * baseHeight;
    pointer.active = true;
});

canvas.addEventListener("mouseleave", () => {
    pointer.active = false;
});

canvas.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((touch.clientX - rect.left) / rect.width) * baseWidth;
    pointer.y = ((touch.clientY - rect.top) / rect.height) * baseHeight;
    pointer.active = true;
});

canvas.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((touch.clientX - rect.left) / rect.width) * baseWidth;
    pointer.y = ((touch.clientY - rect.top) / rect.height) * baseHeight;
    pointer.active = true;
});

canvas.addEventListener("touchend", () => {
    pointer.active = false;
});

resetGame();
updateReadouts();
requestAnimationFrame(loop);
