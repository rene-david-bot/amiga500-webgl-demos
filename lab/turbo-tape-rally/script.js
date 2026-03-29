const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  start: document.getElementById("btn-start"),
  restart: document.getElementById("btn-restart"),
  status: document.getElementById("status-text"),
  time: document.getElementById("stat-time"),
  score: document.getElementById("stat-score"),
  speed: document.getElementById("stat-speed"),
  tapes: document.getElementById("stat-tapes"),
  best: document.getElementById("stat-best"),
  left: document.getElementById("touch-left"),
  right: document.getElementById("touch-right")
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const PLAYER_Y = HEIGHT - 105;
const STORAGE_KEY = "retro.turboTapeRally.best";

const LANES = [-1, 0, 1];

const input = {
  left: false,
  right: false
};

const state = {
  running: false,
  timeLeft: 60,
  score: 0,
  tapes: 0,
  distance: 0,
  speed: 0,
  targetSpeed: 0,
  lanePos: 0,
  roadPhase: 0,
  entities: [],
  spawnCooldown: 0,
  boostTimer: 0,
  crashFlash: 0,
  crashes: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  lastTs: 0
};

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep({ freq = 440, duration = 0.08, type = "square", gain = 0.05, slide = 1 }) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * slide), now + duration);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playStart() {
  [330, 440, 620].forEach((n, i) => {
    setTimeout(() => beep({ freq: n, duration: 0.08, type: "triangle", gain: 0.05, slide: 1.06 }), i * 75);
  });
}

function playTape() {
  beep({ freq: 760, duration: 0.06, type: "square", gain: 0.045, slide: 1.14 });
  setTimeout(() => beep({ freq: 980, duration: 0.05, type: "triangle", gain: 0.04, slide: 1.1 }), 55);
}

function playCrash() {
  beep({ freq: 210, duration: 0.12, type: "sawtooth", gain: 0.05, slide: 0.72 });
}

function playFinish() {
  [540, 680, 860, 1030].forEach((n, i) => {
    setTimeout(() => beep({ freq: n, duration: 0.09, type: "triangle", gain: 0.05, slide: 1.02 }), i * 85);
  });
}

function setStatus(text, tone = "") {
  ui.status.classList.remove("ok", "alert");
  if (tone) ui.status.classList.add(tone);
  ui.status.innerHTML = text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRoadMetrics(y) {
  const t = y / HEIGHT;
  const center = WIDTH / 2 + Math.sin(state.roadPhase + (1 - t) * 2.25) * 95;
  const halfWidth = 72 + t * 160;
  const laneWidth = halfWidth * 0.57;
  return { center, halfWidth, laneWidth };
}

function spawnEntity() {
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  const type = Math.random() < 0.27 ? "tape" : "cone";

  state.entities.push({
    type,
    lane,
    y: -40,
    wobble: Math.random() * Math.PI * 2
  });
}

function startRun() {
  ensureAudio();

  state.running = true;
  state.timeLeft = 60;
  state.score = 0;
  state.tapes = 0;
  state.distance = 0;
  state.speed = 0;
  state.targetSpeed = 190;
  state.lanePos = 0;
  state.roadPhase = 0;
  state.entities = [];
  state.spawnCooldown = 0.25;
  state.boostTimer = 0;
  state.crashFlash = 0;
  state.crashes = 0;

  setStatus("Tape deck locked in. Keep the van centered and grab every boost tape.");
  playStart();
  renderStats();
}

function endRun() {
  state.running = false;
  const finalScore = Math.max(0, Math.floor(state.score));
  if (finalScore > state.best) {
    state.best = finalScore;
    localStorage.setItem(STORAGE_KEY, String(finalScore));
  }

  setStatus(`🏁 Shift complete. Final score <strong>${finalScore}</strong> with <strong>${state.tapes}</strong> tapes recovered.`, "ok");
  playFinish();
  renderStats();
}

function handleCrash() {
  state.crashes += 1;
  state.crashFlash = 0.32;
  state.boostTimer = 0;
  state.speed *= 0.55;
  state.score = Math.max(0, state.score - 90);
  setStatus("Cone impact! Stabilize and rebuild speed.", "alert");
  playCrash();
}

function handleTape() {
  state.tapes += 1;
  state.boostTimer = Math.min(6, state.boostTimer + 2.15);
  state.score += 120;
  setStatus("Turbo tape secured — boost active.");
  playTape();
}

function update(dt) {
  if (!state.running) return;

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.timeLeft <= 0) {
    endRun();
    return;
  }

  state.boostTimer = Math.max(0, state.boostTimer - dt);
  state.crashFlash = Math.max(0, state.crashFlash - dt);

  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  state.lanePos = clamp(state.lanePos + steer * dt * 2.6, -1.35, 1.35);

  const elapsed = 60 - state.timeLeft;
  const base = 175 + elapsed * 2.25;
  const boost = state.boostTimer > 0 ? 110 : 0;
  state.targetSpeed = base + boost;
  state.speed += (state.targetSpeed - state.speed) * Math.min(1, dt * 4.2);

  state.distance += state.speed * dt;
  state.roadPhase = state.distance * 0.006;

  state.spawnCooldown -= dt;
  const spawnDelay = clamp(0.62 - state.speed / 620, 0.23, 0.62);
  if (state.spawnCooldown <= 0) {
    spawnEntity();
    state.spawnCooldown = spawnDelay;
  }

  const playerMetrics = getRoadMetrics(PLAYER_Y);
  const playerX = playerMetrics.center + state.lanePos * playerMetrics.laneWidth;

  for (let i = state.entities.length - 1; i >= 0; i--) {
    const e = state.entities[i];
    const drift = Math.sin(state.roadPhase + e.wobble + e.y * 0.015) * 0.02;
    e.y += (state.speed * 0.85 + 140) * dt;

    const metrics = getRoadMetrics(e.y);
    const ex = metrics.center + (e.lane + drift) * metrics.laneWidth;

    const dx = ex - playerX;
    const dy = e.y - PLAYER_Y;
    if (Math.abs(dx) < 34 && Math.abs(dy) < 30) {
      if (e.type === "cone") {
        handleCrash();
      } else {
        handleTape();
      }
      state.entities.splice(i, 1);
      continue;
    }

    if (e.y > HEIGHT + 60) {
      state.entities.splice(i, 1);
    }
  }

  state.score = Math.max(
    0,
    Math.floor(state.distance * 0.12 + state.tapes * 140 - state.crashes * 45)
  );
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#091126");
  grad.addColorStop(0.55, "#12172b");
  grad.addColorStop(1, "#05070f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 42; i++) {
    const x = (i * 113 + Math.sin(state.roadPhase * 0.6 + i) * 28) % WIDTH;
    const y = ((i * 79 - state.distance * 0.24) % HEIGHT + HEIGHT) % HEIGHT;
    ctx.fillStyle = i % 4 === 0 ? "#9fd5ff" : "#6f82bc";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();
}

function drawRoad() {
  ctx.save();

  const step = 10;
  ctx.beginPath();
  for (let y = 0; y <= HEIGHT; y += step) {
    const { center, halfWidth } = getRoadMetrics(y);
    if (y === 0) ctx.moveTo(center - halfWidth, y);
    else ctx.lineTo(center - halfWidth, y);
  }
  for (let y = HEIGHT; y >= 0; y -= step) {
    const { center, halfWidth } = getRoadMetrics(y);
    ctx.lineTo(center + halfWidth, y);
  }
  ctx.closePath();

  const roadGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  roadGrad.addColorStop(0, "#1f2437");
  roadGrad.addColorStop(1, "#2f2a23");
  ctx.fillStyle = roadGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 187, 125, 0.72)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  for (let y = 0; y <= HEIGHT; y += 12) {
    const { center } = getRoadMetrics(y);
    if (y === 0) ctx.moveTo(center, y);
    else ctx.lineTo(center, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255, 206, 141, 0.55)";
  ctx.lineWidth = 2;
  [0.33, -0.33].forEach((lane) => {
    ctx.beginPath();
    for (let y = 0; y <= HEIGHT; y += 12) {
      const m = getRoadMetrics(y);
      const x = m.center + lane * m.laneWidth * 1.95;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.restore();
}

function drawEntity(entity) {
  const metrics = getRoadMetrics(entity.y);
  const x = metrics.center + entity.lane * metrics.laneWidth;

  ctx.save();
  ctx.translate(x, entity.y);

  if (entity.type === "cone") {
    ctx.fillStyle = "#ff8b53";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 14);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff1da";
    ctx.fillRect(-8, -1, 16, 4);
    ctx.fillRect(-10, 9, 20, 3);
  } else {
    ctx.fillStyle = "#58f0cc";
    ctx.fillRect(-15, -10, 30, 20);
    ctx.fillStyle = "#041c19";
    ctx.fillRect(-8, -6, 16, 12);
    ctx.strokeStyle = "#c5fff0";
    ctx.lineWidth = 2;
    ctx.strokeRect(-15, -10, 30, 20);
  }

  ctx.restore();
}

function drawPlayer() {
  const metrics = getRoadMetrics(PLAYER_Y);
  const x = metrics.center + state.lanePos * metrics.laneWidth;

  ctx.save();
  ctx.translate(x, PLAYER_Y);

  if (state.crashFlash > 0) {
    ctx.globalAlpha = 0.25 + Math.sin(performance.now() * 0.05) * 0.15;
    ctx.fillStyle = "#ff4f88";
    ctx.fillRect(-28, -32, 56, 64);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#75f7d7";
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(20, -6);
  ctx.lineTo(16, 26);
  ctx.lineTo(-16, 26);
  ctx.lineTo(-20, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#06312b";
  ctx.fillRect(-9, -16, 18, 18);
  ctx.fillStyle = "#ffe082";
  ctx.fillRect(-10, 17, 20, 6);

  ctx.fillStyle = "#1a233f";
  ctx.fillRect(-22, -6, 6, 15);
  ctx.fillRect(16, -6, 6, 15);
  ctx.fillRect(-22, 12, 6, 15);
  ctx.fillRect(16, 12, 6, 15);

  if (state.boostTimer > 0) {
    ctx.fillStyle = "rgba(255, 187, 76, 0.95)";
    ctx.beginPath();
    ctx.moveTo(-8, 28);
    ctx.lineTo(0, 42 + Math.random() * 8);
    ctx.lineTo(8, 28);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawHud() {
  ctx.save();
  const w = 148;
  const h = 11;
  const x = WIDTH - w - 16;
  const y = 14;

  ctx.fillStyle = "rgba(8, 14, 30, 0.72)";
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = "#1a2445";
  ctx.fillRect(x, y, w, h);

  const p = clamp(state.boostTimer / 6, 0, 1);
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "#6ff6d3");
  grad.addColorStop(1, "#ffb45e");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w * p, h);

  ctx.strokeStyle = "rgba(193, 212, 255, 0.65)";
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#dce8ff";
  ctx.font = "12px Trebuchet MS";
  ctx.fillText("BOOST", x - 54, y + 9);

  ctx.restore();
}

function renderStats() {
  ui.time.textContent = `${state.timeLeft.toFixed(1)}s`;
  ui.score.textContent = String(Math.floor(state.score));
  ui.speed.textContent = String(Math.floor(state.speed));
  ui.tapes.textContent = String(state.tapes);
  ui.best.textContent = String(state.best);
}

function render() {
  drawBackground();
  drawRoad();
  state.entities.forEach(drawEntity);
  drawPlayer();
  drawHud();
  renderStats();
}

function loop(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(0.032, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function bindHold(button, key) {
  const down = (event) => {
    event.preventDefault();
    input[key] = true;
  };
  const up = (event) => {
    event.preventDefault();
    input[key] = false;
  };

  button.addEventListener("pointerdown", down);
  button.addEventListener("pointerup", up);
  button.addEventListener("pointerleave", up);
  button.addEventListener("pointercancel", up);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "a", "A"].includes(event.key)) {
    input.left = true;
  }
  if (["ArrowRight", "d", "D"].includes(event.key)) {
    input.right = true;
  }
});

window.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "a", "A"].includes(event.key)) {
    input.left = false;
  }
  if (["ArrowRight", "d", "D"].includes(event.key)) {
    input.right = false;
  }
});

ui.start.addEventListener("click", startRun);
ui.restart.addEventListener("click", startRun);

bindHold(ui.left, "left");
bindHold(ui.right, "right");

ui.best.textContent = String(state.best);
render();
requestAnimationFrame(loop);
