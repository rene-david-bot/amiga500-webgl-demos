const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreLabel = document.getElementById('scoreLabel');
const ballsLabel = document.getElementById('ballsLabel');
const streakLabel = document.getElementById('streakLabel');
const highLabel = document.getElementById('highLabel');
const powerFill = document.getElementById('powerFill');
const statusLabel = document.getElementById('status');
const newGameBtn = document.getElementById('newGameBtn');
const audioBtn = document.getElementById('audioBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const START_X = WIDTH / 2;
const START_Y = HEIGHT - 36;

const rings = [
  { x: 180, y: 110, radius: 30, value: 10 },
  { x: 290, y: 98, radius: 27, value: 20 },
  { x: 400, y: 86, radius: 24, value: 30 },
  { x: 510, y: 98, radius: 27, value: 40 },
  { x: 620, y: 110, radius: 30, value: 50 }
];

const state = {
  score: 0,
  ballsLeft: 10,
  streak: 0,
  highScore: Number(localStorage.getItem('retroSkeeHigh') || 0),
  aimX: 400,
  charging: false,
  charge: 0.1,
  chargeDir: 1,
  activeShot: null,
  bonusIndex: Math.floor(Math.random() * rings.length),
  gameOver: false,
  audioOn: false,
  audioCtx: null
};

function setStatus(text) {
  statusLabel.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function beep(freq, duration = 0.06, type = 'square', gain = 0.016, delay = 0) {
  if (!state.audioOn) return;
  ensureAudio();
  const t = state.audioCtx.currentTime + delay;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(amp);
  amp.connect(state.audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.03);
}

function resetGame() {
  state.score = 0;
  state.ballsLeft = 10;
  state.streak = 0;
  state.aimX = WIDTH / 2;
  state.charge = 0.1;
  state.chargeDir = 1;
  state.activeShot = null;
  state.gameOver = false;
  state.bonusIndex = Math.floor(Math.random() * rings.length);
  setStatus('New round started. Hold and release to roll your first ball.');
  updateHud();
}

function startCharge() {
  if (state.gameOver || state.activeShot || state.charging || state.ballsLeft <= 0) return;
  state.charging = true;
}

function releaseShot() {
  if (!state.charging || state.activeShot || state.gameOver) return;
  state.charging = false;

  const power = state.charge;
  const spread = (1 - power) * 52;
  const drift = (Math.random() * 2 - 1) * spread;
  const targetX = clamp(state.aimX + drift, 110, WIDTH - 110);
  const apexY = 190 - power * 110;

  state.activeShot = {
    t: 0,
    speed: 0.011 + power * 0.022,
    startX: START_X,
    startY: START_Y,
    controlX: (START_X + targetX) * 0.5,
    controlY: apexY,
    endX: targetX,
    endY: 132,
    power
  };

  state.ballsLeft -= 1;
  beep(300 + power * 200, 0.07, 'triangle');
  updateHud();
}

function scoreShot(x, y) {
  let gained = 0;
  let hitIndex = -1;

  rings.forEach((ring, i) => {
    const d = Math.hypot(x - ring.x, y - ring.y);
    if (d <= ring.radius && ring.value > gained) {
      gained = ring.value;
      hitIndex = i;
    }
  });

  if (hitIndex !== -1) {
    if (hitIndex === state.bonusIndex) {
      gained *= 2;
      setStatus(`Bonus ring hit! ${gained} points.`);
      beep(780, 0.08, 'square', 0.02);
      beep(980, 0.09, 'square', 0.02, 0.03);
    } else {
      setStatus(`Clean sink: ${gained} points.`);
      beep(560, 0.07, 'square');
    }

    if (gained >= 30) {
      state.streak += 1;
      if (state.streak >= 2) {
        const combo = state.streak * 5;
        gained += combo;
        setStatus(`Combo streak +${combo}! Total ${gained} points.`);
        beep(650 + state.streak * 20, 0.06, 'triangle', 0.014, 0.04);
      }
    } else {
      state.streak = 0;
    }
  } else {
    state.streak = 0;
    setStatus('No score. Adjust aim and power.');
    beep(180, 0.09, 'sawtooth');
  }

  state.score += gained;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem('retroSkeeHigh', String(state.highScore));
  }

  state.bonusIndex = Math.floor(Math.random() * rings.length);

  if (state.ballsLeft <= 0) {
    state.gameOver = true;
    setStatus(`Game over. Final score ${state.score}. ${state.score >= state.highScore ? 'New high score!' : 'Hit New Game to run it back.'}`);
    beep(420, 0.08, 'triangle');
    beep(620, 0.09, 'triangle', 0.015, 0.05);
  }

  updateHud();
}

function updateHud() {
  scoreLabel.textContent = String(state.score);
  ballsLabel.textContent = String(state.ballsLeft);
  streakLabel.textContent = String(state.streak);
  highLabel.textContent = String(state.highScore);
  powerFill.style.width = `${Math.round(state.charge * 100)}%`;
}

function update() {
  if (state.charging) {
    state.charge += state.chargeDir * 0.015;
    if (state.charge >= 1) {
      state.charge = 1;
      state.chargeDir = -1;
    } else if (state.charge <= 0.08) {
      state.charge = 0.08;
      state.chargeDir = 1;
    }
    updateHud();
  }

  if (state.activeShot) {
    state.activeShot.t += state.activeShot.speed;
    if (state.activeShot.t >= 1) {
      const shot = state.activeShot;
      state.activeShot = null;
      scoreShot(shot.endX, shot.endY);
    }
  }
}

function drawLaneBackground() {
  const grad = ctx.createLinearGradient(0, HEIGHT, 0, 0);
  grad.addColorStop(0, '#0f1d3f');
  grad.addColorStop(0.35, '#162b56');
  grad.addColorStop(1, '#1f2853');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(190,210,255,0.16)';
  ctx.lineWidth = 1;
  for (let y = 120; y < HEIGHT; y += 28) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(WIDTH - 90, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#0a1430';
  ctx.fillRect(70, 55, WIDTH - 140, 110);
  ctx.strokeStyle = 'rgba(131, 189, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(70, 55, WIDTH - 140, 110);
}

function drawRings() {
  rings.forEach((ring, i) => {
    const lit = i === state.bonusIndex;

    ctx.beginPath();
    ctx.fillStyle = lit ? 'rgba(255, 112, 208, 0.36)' : 'rgba(99, 230, 255, 0.18)';
    ctx.arc(ring.x, ring.y, ring.radius + 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#070f22';
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = lit ? '#ff70d0' : '#63e6ff';
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = lit ? '#ffd27e' : '#cde7ff';
    ctx.font = 'bold 14px Trebuchet MS';
    ctx.textAlign = 'center';
    ctx.fillText(String(ring.value), ring.x, ring.y + 5);
  });
}

function drawAimGuide() {
  if (state.activeShot || state.gameOver || state.ballsLeft <= 0) return;
  ctx.strokeStyle = 'rgba(255, 210, 126, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(START_X, START_Y);
  ctx.lineTo(state.aimX, 138);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 210, 126, 0.9)';
  ctx.fillRect(state.aimX - 3, 132, 6, 12);
}

function getShotPosition(shot) {
  const t = shot.t;
  const inv = 1 - t;
  const x = inv * inv * shot.startX + 2 * inv * t * shot.controlX + t * t * shot.endX;
  const y = inv * inv * shot.startY + 2 * inv * t * shot.controlY + t * t * shot.endY;
  return { x, y };
}

function drawBall() {
  let x = START_X;
  let y = START_Y;

  if (state.activeShot) {
    const pos = getShotPosition(state.activeShot);
    x = pos.x;
    y = pos.y;
  }

  const radius = state.activeShot ? 9 : 10;
  const glow = ctx.createRadialGradient(x - 2, y - 2, 2, x, y, radius + 6);
  glow.addColorStop(0, '#ffffff');
  glow.addColorStop(0.45, '#d9ecff');
  glow.addColorStop(1, 'rgba(99,230,255,0.1)');

  ctx.beginPath();
  ctx.fillStyle = glow;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = '#6ba6d8';
  ctx.lineWidth = 1.5;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawOverlayText() {
  ctx.textAlign = 'left';
  ctx.font = 'bold 14px Trebuchet MS';
  ctx.fillStyle = '#9fc2ff';
  ctx.fillText(`BONUS: ${rings[state.bonusIndex].value}x2`, 16, 26);

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(6, 12, 25, 0.72)';
    ctx.fillRect(0, HEIGHT / 2 - 48, WIDTH, 96);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcf82';
    ctx.font = 'bold 28px Trebuchet MS';
    ctx.fillText('GAME OVER', WIDTH / 2, HEIGHT / 2 - 8);
    ctx.font = 'bold 18px Trebuchet MS';
    ctx.fillStyle = '#dce9ff';
    ctx.fillText(`Final Score ${state.score}`, WIDTH / 2, HEIGHT / 2 + 20);
  }
}

function draw() {
  drawLaneBackground();
  drawRings();
  drawAimGuide();
  drawBall();
  drawOverlayText();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  state.aimX = clamp((event.clientX - rect.left) * scaleX, 100, WIDTH - 100);
});

canvas.addEventListener('pointerdown', () => startCharge());
canvas.addEventListener('pointerup', () => releaseShot());
canvas.addEventListener('pointerleave', () => {
  if (state.charging) releaseShot();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'ArrowLeft') {
    state.aimX = clamp(state.aimX - 14, 100, WIDTH - 100);
  } else if (event.code === 'ArrowRight') {
    state.aimX = clamp(state.aimX + 14, 100, WIDTH - 100);
  } else if (event.code === 'Space') {
    event.preventDefault();
    startCharge();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    releaseShot();
  }
});

newGameBtn.addEventListener('click', () => {
  resetGame();
  beep(500, 0.06, 'triangle');
  beep(660, 0.08, 'triangle', 0.013, 0.04);
});

audioBtn.addEventListener('click', () => {
  state.audioOn = !state.audioOn;
  if (state.audioOn) {
    ensureAudio();
    audioBtn.textContent = 'Audio: On';
    beep(540, 0.07, 'square');
    setStatus('Audio enabled. Ring hits now fire arcade chimes.');
  } else {
    audioBtn.textContent = 'Audio: Off';
    setStatus('Audio muted. Silent league mode active.');
  }
});

updateHud();
setStatus('Move aim with mouse or arrow keys. Hold and release space (or tap/hold on mobile) to shoot.');
loop();
