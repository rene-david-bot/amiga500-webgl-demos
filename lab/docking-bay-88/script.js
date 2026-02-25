const canvas = document.getElementById('dock');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const speedEl = document.getElementById('speed');
const angleEl = document.getElementById('angle');
const fuelEl = document.getElementById('fuel');
const timeEl = document.getElementById('time');
const dockCountEl = document.getElementById('dock-count');
const bestTimeEl = document.getElementById('best-time');
const launchBtn = document.getElementById('launch');
const resetBtn = document.getElementById('reset');
const soundBtn = document.getElementById('sound');

const width = canvas.width;
const height = canvas.height;

const keys = {
    left: false,
    right: false,
    thrust: false,
    brake: false
};

const state = {
    phase: 'idle',
    docked: 0,
    bestTime: null,
    missionStart: 0,
    messageTimer: 0,
    audioEnabled: false,
    muted: true
};

const ship = {
    x: 120,
    y: height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    fuel: 100
};

const dock = {
    x: width - 120,
    y: height / 2,
    width: 120,
    height: 70,
    angle: 0
};

const starfield = Array.from({ length: 120 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.6 + 0.4,
    a: Math.random() * 0.5 + 0.4
}));

let lastTime = 0;

let audioCtx;
let masterGain;
let thrusterOsc;
let thrusterGain;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(audioCtx.destination);

    thrusterOsc = audioCtx.createOscillator();
    thrusterOsc.type = 'sawtooth';
    thrusterGain = audioCtx.createGain();
    thrusterGain.gain.value = 0;
    thrusterOsc.frequency.value = 120;
    thrusterOsc.connect(thrusterGain).connect(masterGain);
    thrusterOsc.start();
}

function playBeep(freq, duration = 0.18, type = 'square', volume = 0.2) {
    if (!state.audioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration + 0.02);
}

function playDockChord() {
    playBeep(660, 0.2, 'triangle', 0.22);
    setTimeout(() => playBeep(880, 0.18, 'triangle', 0.18), 70);
    setTimeout(() => playBeep(990, 0.16, 'triangle', 0.16), 120);
}

function playCrash() {
    playBeep(140, 0.2, 'sawtooth', 0.25);
    setTimeout(() => playBeep(90, 0.2, 'square', 0.2), 80);
}

function setThrusterSound(active, strength, speed) {
    if (!state.audioEnabled || !thrusterGain) return;
    const target = active ? 0.12 + strength * 0.18 : 0;
    thrusterGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.04);
    thrusterOsc.frequency.setTargetAtTime(120 + strength * 140 + speed * 25, audioCtx.currentTime, 0.05);
}

function updateStatus(text) {
    statusEl.textContent = text;
}

function resetShip() {
    ship.x = 120;
    ship.y = height / 2 + (Math.random() * 160 - 80);
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = 0;
    ship.fuel = 100;
    state.phase = 'flying';
    state.missionStart = performance.now();
    updateStatus('Ship deployed. Slide into the bay.');
}

function resetDock() {
    dock.y = height / 2 + (Math.random() * 180 - 90);
}

function resetTimer() {
    state.missionStart = performance.now();
}

function formatTime(seconds) {
    return `${seconds.toFixed(1)}s`;
}

function normalizeAngle(angle) {
    let a = angle % (Math.PI * 2);
    if (a > Math.PI) a -= Math.PI * 2;
    if (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function updateHUD(timeSeconds) {
    const speed = Math.hypot(ship.vx, ship.vy);
    speedEl.textContent = speed.toFixed(2);
    angleEl.textContent = `${Math.round((ship.angle * 180) / Math.PI)}°`;
    fuelEl.textContent = `${Math.max(0, Math.round(ship.fuel))}%`;
    timeEl.textContent = formatTime(timeSeconds);
    dockCountEl.textContent = state.docked;
    bestTimeEl.textContent = state.bestTime ? formatTime(state.bestTime) : '--';
}

function checkDocking() {
    const speed = Math.hypot(ship.vx, ship.vy);
    const inside =
        ship.x > dock.x - dock.width / 2 &&
        ship.x < dock.x + dock.width / 2 &&
        ship.y > dock.y - dock.height / 2 &&
        ship.y < dock.y + dock.height / 2;

    if (!inside) return;

    const angleDiff = Math.abs(normalizeAngle(ship.angle - dock.angle));
    if (speed < 0.6 && angleDiff < (20 * Math.PI) / 180) {
        state.phase = 'docked';
        const elapsed = (performance.now() - state.missionStart) / 1000;
        state.docked += 1;
        if (!state.bestTime || elapsed < state.bestTime) {
            state.bestTime = elapsed;
            localStorage.setItem('dockBay88Best', state.bestTime.toFixed(2));
        }
        updateStatus(`Docking complete in ${elapsed.toFixed(1)}s. Prep for relaunch.`);
        playDockChord();
        setTimeout(() => {
            resetDock();
            resetShip();
        }, 1400);
    } else if (speed > 1.2) {
        state.phase = 'crashed';
        updateStatus('Hard contact! Hull breach. Relaunching...');
        playCrash();
        setTimeout(() => {
            resetDock();
            resetShip();
        }, 1400);
    }
}

function drawStars() {
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);

    starfield.forEach((star) => {
        const offsetX = (star.x - ship.x * 0.04 + width) % width;
        const offsetY = (star.y - ship.y * 0.04 + height) % height;
        ctx.fillStyle = `rgba(160, 200, 255, ${star.a})`;
        ctx.beginPath();
        ctx.arc(offsetX, offsetY, star.r, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawStation() {
    ctx.save();
    ctx.translate(dock.x, dock.y);
    ctx.fillStyle = '#0a1430';
    ctx.strokeStyle = 'rgba(103, 247, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-dock.width / 2 - 30, -dock.height, dock.width + 80, dock.height * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(103, 247, 255, 0.15)';
    ctx.fillRect(-dock.width / 2, -dock.height / 2, dock.width, dock.height);
    ctx.strokeStyle = 'rgba(103, 247, 255, 0.8)';
    ctx.strokeRect(-dock.width / 2, -dock.height / 2, dock.width, dock.height);

    ctx.fillStyle = 'rgba(138, 167, 255, 0.6)';
    ctx.fillRect(-dock.width / 2 - 20, -dock.height / 2 - 10, 12, dock.height + 20);
    ctx.restore();
}

function drawShip() {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    ctx.fillStyle = '#9ffcff';
    ctx.strokeStyle = '#5ed8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (keys.thrust && ship.fuel > 0) {
        ctx.fillStyle = '#ffb35c';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-20, -4);
        ctx.lineTo(-18, 0);
        ctx.lineTo(-20, 4);
        ctx.closePath();
        ctx.fill();
    }

    if (keys.brake && ship.fuel > 0) {
        ctx.fillStyle = '#8afcff';
        ctx.beginPath();
        ctx.moveTo(12, -2);
        ctx.lineTo(18, 0);
        ctx.lineTo(12, 2);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function clampToBounds() {
    const margin = 20;
    if (ship.x < margin) {
        ship.x = margin;
        ship.vx *= -0.4;
    }
    if (ship.x > width - margin) {
        ship.x = width - margin;
        ship.vx *= -0.4;
    }
    if (ship.y < margin) {
        ship.y = margin;
        ship.vy *= -0.4;
    }
    if (ship.y > height - margin) {
        ship.y = height - margin;
        ship.vy *= -0.4;
    }
}

function update(dt) {
    if (state.phase !== 'flying') return;
    const rotateSpeed = 2.1;
    const thrustPower = 1.6;
    const brakePower = 0.9;

    if (keys.left) ship.angle -= rotateSpeed * dt;
    if (keys.right) ship.angle += rotateSpeed * dt;

    let thrustStrength = 0;
    if (keys.thrust && ship.fuel > 0) {
        const ax = Math.cos(ship.angle) * thrustPower;
        const ay = Math.sin(ship.angle) * thrustPower;
        ship.vx += ax * dt;
        ship.vy += ay * dt;
        ship.fuel -= 18 * dt;
        thrustStrength = 1;
    }

    if (keys.brake && ship.fuel > 0) {
        ship.vx -= ship.vx * brakePower * dt;
        ship.vy -= ship.vy * brakePower * dt;
        ship.fuel -= 10 * dt;
    }

    ship.vx *= 0.995;
    ship.vy *= 0.995;

    ship.x += ship.vx * 40 * dt;
    ship.y += ship.vy * 40 * dt;

    clampToBounds();

    const speed = Math.hypot(ship.vx, ship.vy);
    setThrusterSound(thrustStrength > 0 || keys.brake, thrustStrength + (keys.brake ? 0.6 : 0), speed);

    checkDocking();
}

function drawHUDOverlay() {
    ctx.save();
    ctx.strokeStyle = 'rgba(138, 167, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(16, 16, width - 32, height - 32);
    ctx.restore();
}

function draw() {
    drawStars();
    drawStation();
    drawShip();
    drawHUDOverlay();

    if (state.phase === 'idle') {
        ctx.fillStyle = 'rgba(6, 10, 22, 0.6)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#9ffcff';
        ctx.font = '20px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press Launch to begin.', width / 2, height / 2);
    }
}

function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastTime) / 1000) || 0.016;
    lastTime = timestamp;

    update(dt);
    draw();

    const elapsed = state.phase === 'flying' ? (timestamp - state.missionStart) / 1000 : 0;
    updateHUD(elapsed);

    requestAnimationFrame(loop);
}

function handleKey(e, isDown) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(e.code)) {
        e.preventDefault();
    }

    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = isDown;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = isDown;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = isDown;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.brake = isDown;

    if (isDown && e.code === 'KeyR') {
        resetShip();
    }
    if (isDown && e.code === 'KeyM') {
        toggleSound();
    }
}

function toggleSound() {
    if (!audioCtx) initAudio();
    state.audioEnabled = !state.audioEnabled;
    if (state.audioEnabled) {
        audioCtx.resume();
        soundBtn.textContent = 'Sound: On';
        updateStatus('Audio engaged. Docking bay ambience online.');
    } else {
        soundBtn.textContent = 'Sound: Off';
        if (thrusterGain) {
            thrusterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        }
    }
}

function bindTouchControls() {
    document.querySelectorAll('.touch-btn').forEach((button) => {
        const action = button.dataset.action;
        const setAction = (value) => {
            if (action === 'left') keys.left = value;
            if (action === 'right') keys.right = value;
            if (action === 'thrust') keys.thrust = value;
            if (action === 'brake') keys.brake = value;
        };

        button.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            setAction(true);
        });
        button.addEventListener('pointerup', () => setAction(false));
        button.addEventListener('pointerleave', () => setAction(false));
        button.addEventListener('pointercancel', () => setAction(false));
    });
}

function loadBestTime() {
    const best = localStorage.getItem('dockBay88Best');
    if (best) {
        state.bestTime = parseFloat(best);
    }
}

launchBtn.addEventListener('click', () => {
    if (!audioCtx && state.audioEnabled) initAudio();
    resetDock();
    resetShip();
});

resetBtn.addEventListener('click', () => {
    resetTimer();
    updateStatus('Timer reset. Clean approach recommended.');
});

soundBtn.addEventListener('click', toggleSound);

document.addEventListener('keydown', (e) => handleKey(e, true));
document.addEventListener('keyup', (e) => handleKey(e, false));

bindTouchControls();
loadBestTime();
updateHUD(0);

const params = new URLSearchParams(window.location.search);
if (params.has('autoplay')) {
    toggleSound();
    resetDock();
    resetShip();
}

requestAnimationFrame(loop);
