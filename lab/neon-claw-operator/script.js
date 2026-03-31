const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const streakEl = document.getElementById('streak');
const bestEl = document.getElementById('best');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const LANE_DATA = [
    { y: 248, dir: 1, speed: 52 },
    { y: 302, dir: -1, speed: 68 },
    { y: 356, dir: 1, speed: 78 }
];

const ITEM_TYPES = [
    { key: 'cart', label: 'Cartridge', color: '#63f0ff', points: 35, weight: 0.55, w: 44, h: 20 },
    { key: 'chip', label: 'Gold Chip', color: '#ffd062', points: 70, weight: 0.23, w: 26, h: 18 },
    { key: 'junk', label: 'Junk Disk', color: '#ff5dd1', points: -30, weight: 0.22, w: 34, h: 16 }
];

const keys = { left: false, right: false };

let game;
let audioCtx;

function boot() {
    const best = Number(localStorage.getItem('neonClawOperatorBest') || 0);
    bestEl.textContent = best;
    resetGame();
    requestAnimationFrame(loop);
}

function resetGame() {
    game = {
        running: false,
        duration: 70,
        timeLeft: 70,
        score: 0,
        streak: 0,
        spawnTimer: 0,
        items: [],
        particles: [],
        messages: [],
        claw: {
            x: WIDTH / 2,
            y: 78,
            cable: 0,
            maxCable: 280,
            state: 'idle',
            carry: null,
            dropOrigin: WIDTH / 2,
            targetX: WIDTH / 2
        }
    };

    scoreEl.textContent = '0';
    timeEl.textContent = String(game.duration);
    streakEl.textContent = '0';
}

function startGame() {
    unlockAudio();
    resetGame();
    game.running = true;
    overlay.classList.add('hidden');
}

function endGame() {
    game.running = false;
    overlay.classList.remove('hidden');
    overlayTitle.textContent = game.score >= 900 ? 'Shift Cleared' : 'Shift Complete';
    overlayText.textContent = `Score ${game.score}. ${game.score >= 900 ? 'Arcade manager impressed.' : 'One more run for a cleaner haul.'}`;
    startBtn.textContent = 'Run Again';

    const best = Number(localStorage.getItem('neonClawOperatorBest') || 0);
    if (game.score > best) {
        localStorage.setItem('neonClawOperatorBest', String(game.score));
        bestEl.textContent = String(game.score);
    }
}

function pickType() {
    const total = ITEM_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * total;
    for (const type of ITEM_TYPES) {
        roll -= type.weight;
        if (roll <= 0) return type;
    }
    return ITEM_TYPES[0];
}

function spawnItem() {
    const laneIndex = Math.floor(Math.random() * LANE_DATA.length);
    const lane = LANE_DATA[laneIndex];
    const type = pickType();
    const fromLeft = lane.dir > 0;
    game.items.push({
        laneIndex,
        x: fromLeft ? -60 : WIDTH + 60,
        y: lane.y,
        wobble: Math.random() * Math.PI * 2,
        type,
        caught: false
    });
}

function activateClaw() {
    const claw = game.claw;
    if (claw.state !== 'idle') return;
    claw.state = 'dropping';
    claw.dropOrigin = claw.x;
    playBeep(440, 0.08, 'square', 0.035);
}

function findCatchCandidate() {
    const claw = game.claw;
    const tipY = claw.y + claw.cable;
    let candidate = null;
    let bestDist = Infinity;

    for (const item of game.items) {
        if (item.caught) continue;
        const distX = Math.abs(item.x - claw.x);
        const distY = Math.abs(item.y - tipY);
        if (distX < 26 && distY < 22) {
            const score = distX + distY;
            if (score < bestDist) {
                bestDist = score;
                candidate = item;
            }
        }
    }

    return candidate;
}

function scoreCatch(item) {
    const points = item.type.points;
    game.score += points;

    if (points > 0) {
        game.streak += 1;
        if (game.streak > 0 && game.streak % 3 === 0) {
            game.score += 25;
            pushMessage('+25 COMBO', '#b3ff74', 1.1);
            burst(item.x, 80, '#b3ff74', 18);
            playBeep(880, 0.06, 'triangle', 0.04);
        }
    } else {
        game.streak = 0;
    }

    scoreEl.textContent = String(game.score);
    streakEl.textContent = String(game.streak);

    const sign = points > 0 ? `+${points}` : `${points}`;
    pushMessage(`${sign} ${item.type.label.toUpperCase()}`, item.type.color, 1.2);

    if (points > 0) {
        playBeep(640 + Math.random() * 120, 0.07, 'square', 0.05);
    } else {
        playBeep(180, 0.15, 'sawtooth', 0.045);
    }

    burst(item.x, 82, item.type.color, points > 0 ? 14 : 10);
}

function pushMessage(text, color, life = 1) {
    game.messages.push({
        text,
        color,
        life,
        x: 84,
        y: 106
    });
}

function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 24 + Math.random() * 120;
        game.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.45 + Math.random() * 0.4,
            color
        });
    }
}

function update(dt) {
    if (!game.running) return;

    game.timeLeft = Math.max(0, game.timeLeft - dt);
    timeEl.textContent = game.timeLeft.toFixed(1);

    if (game.timeLeft <= 0) {
        endGame();
        return;
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
        spawnItem();
        game.spawnTimer = 0.54 + Math.random() * 0.52;
    }

    for (const item of game.items) {
        if (item.caught) continue;
        const lane = LANE_DATA[item.laneIndex];
        item.wobble += dt * 4;
        item.x += lane.dir * lane.speed * dt;

        if (lane.dir > 0 && item.x > WIDTH + 70) item.x = -70;
        if (lane.dir < 0 && item.x < -70) item.x = WIDTH + 70;
    }

    const claw = game.claw;

    if (claw.state === 'idle') {
        const move = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
        claw.x += move * 270 * dt;
        claw.x = Math.max(60, Math.min(WIDTH - 60, claw.x));
    } else if (claw.state === 'dropping') {
        claw.cable += 345 * dt;
        if (claw.cable >= claw.maxCable) {
            claw.cable = claw.maxCable;
            const candidate = findCatchCandidate();
            if (candidate) {
                candidate.caught = true;
                claw.carry = candidate;
            }
            claw.state = 'rising';
        }
    } else if (claw.state === 'rising') {
        claw.cable -= 360 * dt;
        if (claw.cable <= 0) {
            claw.cable = 0;
            claw.state = claw.carry ? 'delivering' : 'idle';
            claw.targetX = 78;
        }
    } else if (claw.state === 'delivering') {
        const dx = claw.targetX - claw.x;
        const step = Math.sign(dx) * 260 * dt;
        if (Math.abs(dx) <= Math.abs(step)) {
            claw.x = claw.targetX;
            if (claw.carry) {
                const caught = claw.carry;
                const idx = game.items.indexOf(caught);
                if (idx >= 0) game.items.splice(idx, 1);
                scoreCatch(caught);
                claw.carry = null;
            }
            claw.state = 'returning';
            claw.targetX = claw.dropOrigin;
        } else {
            claw.x += step;
        }
    } else if (claw.state === 'returning') {
        const dx = claw.targetX - claw.x;
        const step = Math.sign(dx) * 240 * dt;
        if (Math.abs(dx) <= Math.abs(step)) {
            claw.x = claw.targetX;
            claw.state = 'idle';
        } else {
            claw.x += step;
        }
    }

    if (claw.carry) {
        claw.carry.x = claw.x;
        claw.carry.y = claw.y + claw.cable;
    }

    game.messages = game.messages.filter((msg) => {
        msg.life -= dt;
        msg.y -= 18 * dt;
        return msg.life > 0;
    });

    game.particles = game.particles.filter((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        return particle.life > 0;
    });
}

function drawBackdrop() {
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#091427');
    grad.addColorStop(1, '#03050d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 44; i += 1) {
        const x = (i * 97) % WIDTH;
        const y = (i * 59) % 150;
        const alpha = 0.07 + ((i % 3) * 0.04);
        ctx.fillStyle = `rgba(129, 180, 255, ${alpha})`;
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = '#10183a';
    ctx.fillRect(0, 192, WIDTH, HEIGHT - 192);

    for (const lane of LANE_DATA) {
        ctx.fillStyle = 'rgba(99, 240, 255, 0.12)';
        ctx.fillRect(0, lane.y - 22, WIDTH, 44);
        ctx.strokeStyle = 'rgba(99, 240, 255, 0.36)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, lane.y + 20);
        ctx.lineTo(WIDTH, lane.y + 20);
        ctx.stroke();
    }

    ctx.fillStyle = '#18295f';
    ctx.fillRect(44, 24, 68, 148);
    ctx.strokeStyle = '#63f0ff';
    ctx.strokeRect(44, 24, 68, 148);

    ctx.fillStyle = '#bff8ff';
    ctx.font = 'bold 16px Trebuchet MS';
    ctx.fillText('DROP', 56, 66);
    ctx.font = 'bold 14px Trebuchet MS';
    ctx.fillText('ZONE', 56, 88);
}

function drawItem(item) {
    const bob = Math.sin(item.wobble) * 2;
    const x = item.x;
    const y = item.y + bob;

    ctx.save();
    ctx.translate(x, y);

    if (item.type.key === 'cart') {
        ctx.fillStyle = '#1e2d63';
        ctx.fillRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.strokeStyle = item.type.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.fillStyle = item.type.color;
        ctx.fillRect(-14, -5, 28, 10);
    } else if (item.type.key === 'chip') {
        ctx.fillStyle = '#604500';
        ctx.fillRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.strokeStyle = item.type.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.fillStyle = item.type.color;
        for (let i = -10; i <= 10; i += 5) {
            ctx.fillRect(i, -11, 2, 3);
            ctx.fillRect(i, 8, 2, 3);
        }
    } else {
        ctx.fillStyle = '#5a104b';
        ctx.fillRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.strokeStyle = item.type.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-item.type.w / 2, -item.type.h / 2, item.type.w, item.type.h);
        ctx.strokeStyle = '#ffd8ff';
        ctx.beginPath();
        ctx.moveTo(-11, -6);
        ctx.lineTo(11, 6);
        ctx.moveTo(11, -6);
        ctx.lineTo(-11, 6);
        ctx.stroke();
    }

    ctx.restore();
}

function drawClaw() {
    const claw = game.claw;

    ctx.strokeStyle = '#8ee8ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(claw.x, 0);
    ctx.lineTo(claw.x, claw.y + claw.cable);
    ctx.stroke();

    ctx.fillStyle = '#2a3d7c';
    ctx.fillRect(claw.x - 48, 34, 96, 28);
    ctx.strokeStyle = '#63f0ff';
    ctx.strokeRect(claw.x - 48, 34, 96, 28);

    const tipY = claw.y + claw.cable;
    ctx.strokeStyle = '#bff8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(claw.x - 18, tipY - 2);
    ctx.lineTo(claw.x - 5, tipY + 16);
    ctx.moveTo(claw.x + 18, tipY - 2);
    ctx.lineTo(claw.x + 5, tipY + 16);
    ctx.stroke();

    ctx.fillStyle = '#bff8ff';
    ctx.fillRect(claw.x - 5, tipY - 4, 10, 8);

    if (claw.carry) {
        drawItem(claw.carry);
    }
}

function drawFX() {
    for (const particle of game.particles) {
        ctx.globalAlpha = Math.max(0, particle.life * 1.5);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    for (const msg of game.messages) {
        ctx.globalAlpha = Math.max(0, msg.life);
        ctx.fillStyle = msg.color;
        ctx.font = 'bold 20px Trebuchet MS';
        ctx.fillText(msg.text, msg.x, msg.y);
    }
    ctx.globalAlpha = 1;
}

function draw() {
    drawBackdrop();
    for (const item of game.items) {
        if (!item.caught || item === game.claw.carry) drawItem(item);
    }
    drawClaw();
    drawFX();
}

let last = performance.now();

function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
}

function unlockAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
}

function playBeep(freq, dur, type = 'square', gain = 0.03) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.value = gain;
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        keys.left = true;
        event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
        keys.right = true;
        event.preventDefault();
    }
    if (event.code === 'Space') {
        if (!game.running && !overlay.classList.contains('hidden')) {
            startGame();
        } else {
            activateClaw();
        }
        event.preventDefault();
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') keys.left = false;
    if (event.key === 'ArrowRight') keys.right = false;
});

startBtn.addEventListener('click', startGame);

boot();
