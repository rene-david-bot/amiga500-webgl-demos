const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const livesEl = document.getElementById('lives');
const timeEl = document.getElementById('time');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const resetBtn = document.getElementById('reset');
const soundBtn = document.getElementById('sound');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const state = {
    running: false,
    score: 0,
    combo: 0,
    lives: 3,
    time: 60,
    best: 0,
    pods: [],
    spawnTimer: 0,
    spawnRate: 900,
    lastTime: 0,
    pointerX: WIDTH / 2,
    usePointer: false,
    pointerDown: false,
    pointerType: 'mouse',
    soundOn: false
};

const player = {
    x: WIDTH / 2,
    y: HEIGHT - 30,
    width: 60,
    height: 16,
    speed: 260
};

const keys = {
    left: false,
    right: false
};

let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function beep(type = 'good') {
    if (!state.soundOn || !audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type === 'good' ? 'triangle' : 'square';
    osc.frequency.value = type === 'good' ? 660 : 220;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
}

function formatScore(value) {
    return value.toString().padStart(5, '0');
}

function formatTime(value) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.max(0, Math.floor(value % 60));
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resetGame() {
    state.running = false;
    state.score = 0;
    state.combo = 0;
    state.lives = 3;
    state.time = 60;
    state.pods = [];
    state.spawnTimer = 0;
    state.spawnRate = 900;
    statusEl.textContent = 'Dock ready. Hit Start Shift.';
    updateHud();
    drawScene();
}

function startGame() {
    if (state.running) return;
    state.running = true;
    state.lastTime = performance.now();
    statusEl.textContent = 'Shift live. Keep those pods moving.';
    requestAnimationFrame(loop);
}

function endGame(message) {
    state.running = false;
    statusEl.textContent = message;
    if (state.score > state.best) {
        state.best = state.score;
        localStorage.setItem('starDockBest', String(state.best));
    }
    updateHud();
}

function spawnPod() {
    const isScrap = Math.random() < 0.28;
    const size = isScrap ? 18 : 20;
    state.pods.push({
        x: 20 + Math.random() * (WIDTH - 40),
        y: -20,
        vy: 60 + Math.random() * 80,
        size,
        scrap: isScrap
    });
}

function updatePods(dt) {
    state.spawnTimer += dt;
    const rate = Math.max(380, state.spawnRate - (60 - state.time) * 6);
    if (state.spawnTimer > rate) {
        state.spawnTimer = 0;
        spawnPod();
    }

    for (let i = state.pods.length - 1; i >= 0; i--) {
        const pod = state.pods[i];
        pod.y += pod.vy * (dt / 1000);
        if (pod.y - pod.size > HEIGHT) {
            state.pods.splice(i, 1);
            if (!pod.scrap) {
                state.lives -= 1;
                state.combo = 0;
                beep('bad');
                statusEl.textContent = 'Cargo lost! Dock crew not thrilled.';
                if (state.lives <= 0) {
                    endGame('Shift failed. Dock offline. Reset to try again.');
                }
            }
        }
    }
}

function updatePlayer(dt) {
    if (state.usePointer) {
        const target = Math.max(30, Math.min(WIDTH - 30, state.pointerX));
        if (state.pointerDown) {
            player.x = target;
        } else {
            player.x += (target - player.x) * 0.18;
        }
    } else {
        if (keys.left) player.x -= player.speed * (dt / 1000);
        if (keys.right) player.x += player.speed * (dt / 1000);
        player.x = Math.max(30, Math.min(WIDTH - 30, player.x));
    }
}

function checkCollisions() {
    const playerLeft = player.x - player.width / 2;
    const playerRight = player.x + player.width / 2;
    const playerTop = player.y - player.height / 2;
    const playerBottom = player.y + player.height / 2;

    for (let i = state.pods.length - 1; i >= 0; i--) {
        const pod = state.pods[i];
        const podLeft = pod.x - pod.size / 2;
        const podRight = pod.x + pod.size / 2;
        const podTop = pod.y - pod.size / 2;
        const podBottom = pod.y + pod.size / 2;
        const hit =
            podLeft < playerRight &&
            podRight > playerLeft &&
            podTop < playerBottom &&
            podBottom > playerTop;

        if (hit) {
            state.pods.splice(i, 1);
            if (pod.scrap) {
                state.lives -= 1;
                state.combo = 0;
                beep('bad');
                statusEl.textContent = 'Scrap hit! Shields down.';
                if (state.lives <= 0) {
                    endGame('Shift failed. Dock offline. Reset to try again.');
                }
            } else {
                state.combo += 1;
                const bonus = Math.min(6, state.combo);
                state.score += 120 + bonus * 18;
                beep('good');
                statusEl.textContent = 'Clean catch. Keep the line moving.';
            }
        }
    }
}

function updateHud() {
    scoreEl.textContent = formatScore(state.score);
    comboEl.textContent = `x${state.combo}`;
    livesEl.textContent = state.lives;
    timeEl.textContent = formatTime(state.time);
    bestEl.textContent = formatScore(state.best);
}

function drawBackground() {
    ctx.fillStyle = '#060912';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(126, 162, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
        const x = (i * 67) % WIDTH;
        const y = (i * 29) % HEIGHT;
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = 'rgba(95, 255, 226, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24);
}

function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = '#5fffe2';
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.strokeStyle = '#7ea2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.restore();
}

function drawPods() {
    state.pods.forEach((pod) => {
        ctx.save();
        ctx.translate(pod.x, pod.y);
        ctx.fillStyle = pod.scrap ? '#ff6b6b' : '#7ea2ff';
        ctx.fillRect(-pod.size / 2, -pod.size / 2, pod.size, pod.size);
        ctx.fillStyle = pod.scrap ? '#400c0c' : '#0f1425';
        ctx.fillRect(-pod.size / 4, -pod.size / 4, pod.size / 2, pod.size / 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-pod.size / 2, -pod.size / 2, pod.size, pod.size);
        ctx.restore();
    });
}

function drawScene() {
    drawBackground();
    drawPods();
    drawPlayer();

    if (!state.running) {
        ctx.fillStyle = 'rgba(6, 9, 18, 0.6)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#5fffe2';
        ctx.font = 'bold 16px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('SHIFT PAUSED', WIDTH / 2, HEIGHT / 2 - 10);
        ctx.fillStyle = '#92a2c8';
        ctx.font = '12px Courier New';
        ctx.fillText('Press Start Shift to play', WIDTH / 2, HEIGHT / 2 + 12);
    }
}

function loop(timestamp) {
    if (!state.running) {
        drawScene();
        return;
    }
    const dt = timestamp - state.lastTime;
    state.lastTime = timestamp;

    state.time -= dt / 1000;
    if (state.time <= 0) {
        state.time = 0;
        endGame('Shift complete. Dock secured. New grade posted.');
    }

    updatePlayer(dt);
    updatePods(dt);
    checkCollisions();
    updateHud();
    drawScene();

    requestAnimationFrame(loop);
}

function init() {
    const savedBest = Number(localStorage.getItem('starDockBest')) || 0;
    state.best = savedBest;
    updateHud();
    drawScene();
}

window.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.left = true;
        state.usePointer = false;
    }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.right = true;
        state.usePointer = false;
    }
    if (event.code === 'Space') {
        if (!state.running) startGame();
    }
});

window.addEventListener('keyup', (event) => {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
});

canvas.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    state.usePointer = true;
});

canvas.addEventListener('pointerdown', (event) => {
    initAudio();
    if (!state.running) startGame();
    state.pointerDown = true;
    state.pointerType = event.pointerType || 'mouse';
    canvas.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const target = Math.max(30, Math.min(WIDTH - 30, state.pointerX));
    player.x = target;
    state.usePointer = true;
});

canvas.addEventListener('pointerup', (event) => {
    state.pointerDown = false;
    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
        // no-op
    }
});

canvas.addEventListener('pointercancel', (event) => {
    state.pointerDown = false;
    try {
        canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
        // no-op
    }
});

startBtn.addEventListener('click', () => {
    initAudio();
    startGame();
});

resetBtn.addEventListener('click', () => {
    resetGame();
});

soundBtn.addEventListener('click', () => {
    initAudio();
    state.soundOn = !state.soundOn;
    soundBtn.textContent = `Sound: ${state.soundOn ? 'On' : 'Off'}`;
    if (state.soundOn) beep('good');
});

init();
