const canvas = document.getElementById('track');
const ctx = canvas.getContext('2d');

const timeEl = document.getElementById('time');
const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const deliveriesEl = document.getElementById('deliveries');
const crashesEl = document.getElementById('crashes');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');

const leftBtn = document.getElementById('left');
const rightBtn = document.getElementById('right');
const startBtn = document.getElementById('start');

const LANE_COUNT = 3;
const TRACK_LEFT = 170;
const TRACK_WIDTH = 420;
const LANE_WIDTH = TRACK_WIDTH / LANE_COUNT;
const PLAYER_Y = canvas.height - 72;
const ROUND_SECONDS = 45;

let audioCtx;
let lastTs = 0;

const state = {
    running: false,
    timeLeft: ROUND_SECONDS,
    distance: 0,
    speed: 96,
    lane: 1,
    targetLane: 1,
    laneSlide: 1,
    deliveries: 0,
    crashes: 0,
    tick: 0,
    nextObstacleIn: 1,
    nextPickupIn: 0.7,
    obstacles: [],
    pickups: []
};

const keys = { left: false, right: false };
const bestDistance = Number(localStorage.getItem('mall-atrium-rally-90-best') || 0);
bestEl.textContent = `${Math.round(bestDistance)} m`;

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function chirp(freq, duration = 0.08, type = 'square', gain = 0.055) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    amp.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function laneX(lane) {
    return TRACK_LEFT + lane * LANE_WIDTH + LANE_WIDTH * 0.5;
}

function resetRun() {
    state.running = true;
    state.timeLeft = ROUND_SECONDS;
    state.distance = 0;
    state.speed = 96;
    state.lane = 1;
    state.targetLane = 1;
    state.laneSlide = 1;
    state.deliveries = 0;
    state.crashes = 0;
    state.tick = 0;
    state.nextObstacleIn = 0.8;
    state.nextPickupIn = 0.55;
    state.obstacles = [];
    state.pickups = [];

    startBtn.textContent = 'Restart Run';
    setStatus('Mall gates open. Deliver every tape case you can grab.');
    updateHud();
}

function endRun() {
    state.running = false;
    const rounded = Math.round(state.distance);
    const prevBest = Number(localStorage.getItem('mall-atrium-rally-90-best') || 0);

    if (rounded > prevBest) {
        localStorage.setItem('mall-atrium-rally-90-best', String(rounded));
        bestEl.textContent = `${rounded} m`;
        setStatus(`Store closed! New best run: ${rounded} m with ${state.deliveries} deliveries.`, 'good');
        if (audioCtx) {
            chirp(580, 0.09, 'triangle', 0.06);
            setTimeout(() => chirp(760, 0.11, 'triangle', 0.06), 75);
        }
    } else {
        bestEl.textContent = `${Math.round(prevBest)} m`;
        setStatus(`Store closed! ${rounded} m, ${state.deliveries} deliveries, ${state.crashes} crashes.`, state.crashes <= 2 ? 'good' : 'bad');
    }
}

function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const types = [
        { name: 'Wet Floor Sign', color: '#ffce64' },
        { name: 'Planter', color: '#6fe0a4' },
        { name: 'Bench Cart', color: '#ff7b9e' }
    ];
    const type = types[Math.floor(Math.random() * types.length)];

    state.obstacles.push({
        lane,
        y: -38,
        h: 34,
        w: 74,
        color: type.color
    });
}

function spawnPickup() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    state.pickups.push({
        lane,
        y: -22,
        r: 12,
        pulse: Math.random() * Math.PI * 2
    });
}

function update(dt) {
    if (!state.running) return;

    state.tick += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);

    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (steer !== 0) {
        state.targetLane = clamp(state.targetLane + steer * dt * 4.5, 0, LANE_COUNT - 1);
    }

    state.laneSlide += (state.targetLane - state.laneSlide) * clamp(dt * 11, 0, 1);

    state.speed = clamp(state.speed + dt * 2.7, 92, 176);
    state.distance += state.speed * dt;

    state.nextObstacleIn -= dt;
    if (state.nextObstacleIn <= 0) {
        spawnObstacle();
        state.nextObstacleIn = clamp(0.95 - state.distance / 2300, 0.34, 0.95);
    }

    state.nextPickupIn -= dt;
    if (state.nextPickupIn <= 0) {
        spawnPickup();
        state.nextPickupIn = clamp(1.2 - state.distance / 2600, 0.44, 1.15);
    }

    const scroll = state.speed * 1.18 * dt;
    const playerX = laneX(state.laneSlide);

    state.obstacles.forEach((obs) => {
        obs.y += scroll;
    });

    state.pickups.forEach((item) => {
        item.y += scroll;
        item.pulse += dt * 7;
    });

    state.obstacles = state.obstacles.filter((obs) => {
        if (obs.y > canvas.height + 70) return false;

        const inY = obs.y + obs.h / 2 > PLAYER_Y - 20 && obs.y - obs.h / 2 < PLAYER_Y + 24;
        const inX = Math.abs(laneX(obs.lane) - playerX) < 41;
        if (inY && inX) {
            state.crashes += 1;
            state.speed = Math.max(88, state.speed - 26);
            state.timeLeft = Math.max(0, state.timeLeft - 2.4);
            state.targetLane = clamp(state.targetLane + (Math.random() > 0.5 ? 0.45 : -0.45), 0, LANE_COUNT - 1);
            setStatus('Crash! Lost 2.4s and speed.', 'bad');
            if (audioCtx) {
                chirp(180, 0.13, 'sawtooth', 0.08);
                setTimeout(() => chirp(140, 0.14, 'sawtooth', 0.07), 60);
            }
            return false;
        }

        return true;
    });

    state.pickups = state.pickups.filter((item) => {
        if (item.y > canvas.height + 60) return false;

        const inY = item.y > PLAYER_Y - 24 && item.y < PLAYER_Y + 20;
        const inX = Math.abs(laneX(item.lane) - playerX) < 38;
        if (inY && inX) {
            state.deliveries += 1;
            state.timeLeft = Math.min(ROUND_SECONDS, state.timeLeft + 1.9);
            state.speed = Math.min(182, state.speed + 5.5);
            setStatus(`Delivery locked in. +1.9s buffer. (${state.deliveries})`, 'good');
            if (audioCtx) {
                chirp(510, 0.06, 'triangle', 0.07);
                setTimeout(() => chirp(690, 0.07, 'triangle', 0.06), 45);
            }
            return false;
        }

        return true;
    });

    if (state.timeLeft <= 0) {
        endRun();
    }

    updateHud();
}

function drawTrackBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#081427');
    g.addColorStop(1, '#050910');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sideGlow = ctx.createLinearGradient(0, 0, canvas.width, 0);
    sideGlow.addColorStop(0, 'rgba(92,242,255,0.12)');
    sideGlow.addColorStop(0.2, 'rgba(92,242,255,0)');
    sideGlow.addColorStop(0.8, 'rgba(255,107,231,0)');
    sideGlow.addColorStop(1, 'rgba(255,107,231,0.15)');
    ctx.fillStyle = sideGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0d1f3f';
    ctx.fillRect(TRACK_LEFT, 0, TRACK_WIDTH, canvas.height);

    const stripeOffset = (state.tick * state.speed * 0.42) % 56;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (let y = -56 + stripeOffset; y < canvas.height + 56; y += 56) {
        ctx.fillRect(TRACK_LEFT + LANE_WIDTH - 2, y, 4, 34);
        ctx.fillRect(TRACK_LEFT + LANE_WIDTH * 2 - 2, y, 4, 34);
    }

    ctx.fillStyle = 'rgba(92,242,255,0.45)';
    ctx.fillRect(TRACK_LEFT - 3, 0, 3, canvas.height);
    ctx.fillStyle = 'rgba(255,107,231,0.45)';
    ctx.fillRect(TRACK_LEFT + TRACK_WIDTH, 0, 3, canvas.height);

    const tileOffset = (state.tick * state.speed * 0.58) % 34;
    for (let y = -34 + tileOffset; y < canvas.height + 34; y += 34) {
        ctx.fillStyle = 'rgba(255,206,100,0.1)';
        ctx.fillRect(TRACK_LEFT - 42, y, 18, 10);
        ctx.fillStyle = 'rgba(111,224,164,0.1)';
        ctx.fillRect(TRACK_LEFT + TRACK_WIDTH + 24, y + 12, 16, 10);
    }
}

function drawPlayer() {
    const x = laneX(state.laneSlide);

    ctx.save();
    ctx.translate(x, PLAYER_Y);

    ctx.fillStyle = '#76f4ff';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(28, 10);
    ctx.lineTo(0, 22);
    ctx.lineTo(-28, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff76e7';
    ctx.fillRect(-9, -6, 18, 12);

    ctx.fillStyle = 'rgba(124,255,174,0.75)';
    ctx.fillRect(-20, 16, 40, 3);

    ctx.restore();
}

function drawObstacles() {
    state.obstacles.forEach((obs) => {
        const x = laneX(obs.lane);
        ctx.fillStyle = obs.color;
        ctx.fillRect(x - obs.w / 2, obs.y - obs.h / 2, obs.w, obs.h);
        ctx.fillStyle = '#0a1430';
        ctx.fillRect(x - obs.w / 2 + 6, obs.y - 4, obs.w - 12, 8);
    });
}

function drawPickups() {
    state.pickups.forEach((item) => {
        const x = laneX(item.lane);
        const pulse = 1 + Math.sin(item.pulse) * 0.15;

        ctx.beginPath();
        ctx.arc(x, item.y, item.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(124,255,174,0.25)';
        ctx.fill();

        ctx.fillStyle = '#9cff77';
        ctx.fillRect(x - 10, item.y - 7, 20, 14);
        ctx.fillStyle = '#22325f';
        ctx.fillRect(x - 7, item.y - 4, 14, 8);
    });
}

function drawHudOverlay() {
    ctx.fillStyle = 'rgba(3, 8, 18, 0.58)';
    ctx.fillRect(12, 12, 214, 62);
    ctx.strokeStyle = 'rgba(92,242,255,0.5)';
    ctx.strokeRect(12, 12, 214, 62);

    ctx.fillStyle = '#dff5ff';
    ctx.font = '600 16px Inter, system-ui, sans-serif';
    ctx.fillText(`Atrium Sector: ${Math.floor(state.distance / 180) + 1}`, 22, 35);
    ctx.font = '500 14px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#a5b9e0';
    ctx.fillText(`Tape deliveries: ${state.deliveries}`, 22, 58);
}

function draw() {
    drawTrackBackground();
    drawObstacles();
    drawPickups();
    drawPlayer();
    drawHudOverlay();

    if (!state.running) {
        ctx.fillStyle = 'rgba(2, 5, 12, 0.62)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#e7f6ff';
        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("MALL ATRIUM RALLY '90", canvas.width / 2, canvas.height / 2 - 16);

        ctx.font = '500 17px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#b2c4e8';
        ctx.fillText('Grab tape cases, dodge obstacles, survive 45 seconds.', canvas.width / 2, canvas.height / 2 + 18);
        ctx.textAlign = 'start';
    }
}

function updateHud() {
    timeEl.textContent = `${state.timeLeft.toFixed(1)}s`;
    distanceEl.textContent = `${Math.round(state.distance)} m`;
    speedEl.textContent = `${Math.round(state.speed)} km/h`;
    deliveriesEl.textContent = String(state.deliveries);
    crashesEl.textContent = String(state.crashes);
}

function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

function movePress(dir, active) {
    if (dir === 'left') keys.left = active;
    if (dir === 'right') keys.right = active;
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') movePress('left', true);
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') movePress('right', true);
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') movePress('left', false);
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') movePress('right', false);
});

function bindHold(button, dir) {
    button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        movePress(dir, true);
    });

    button.addEventListener('pointerup', () => movePress(dir, false));
    button.addEventListener('pointerleave', () => movePress(dir, false));
    button.addEventListener('pointercancel', () => movePress(dir, false));
}

bindHold(leftBtn, 'left');
bindHold(rightBtn, 'right');

startBtn.addEventListener('click', () => {
    ensureAudio();
    resetRun();
    chirp(420, 0.06, 'triangle', 0.06);
});

updateHud();
draw();
requestAnimationFrame(loop);
