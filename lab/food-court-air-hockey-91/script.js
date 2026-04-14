const canvas = document.getElementById("table");
const ctx = canvas.getContext("2d");

const ui = {
  playerScore: document.getElementById("playerScore"),
  cpuScore: document.getElementById("cpuScore"),
  timeLeft: document.getElementById("timeLeft"),
  bestWins: document.getElementById("bestWins"),
  status: document.getElementById("status"),
  startBtn: document.getElementById("startBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  resetBtn: document.getElementById("resetBtn")
};

const TABLE = {
  width: canvas.width,
  height: canvas.height,
  rail: 26,
  goalWidth: 210,
  lineY: canvas.height / 2
};

const state = {
  running: false,
  paused: false,
  timer: 75,
  playerScore: 0,
  cpuScore: 0,
  bestWins: Number(localStorage.getItem("food_court_air_hockey_91_best") || 0),
  winnerDeclared: false,
  lastTime: 0,
  audioCtx: null,
  audioReady: false,
  pointerX: TABLE.width / 2,
  pointerY: TABLE.height - 90,
  paddlePlayer: {
    x: TABLE.width / 2,
    y: TABLE.height - 88,
    r: 34,
    color: "#58e6ff"
  },
  paddleCPU: {
    x: TABLE.width / 2,
    y: 88,
    r: 34,
    color: "#ff5dd0"
  },
  puck: {
    x: TABLE.width / 2,
    y: TABLE.height / 2,
    vx: 0,
    vy: 0,
    r: 16
  }
};

function setStatus(text, kind = "") {
  ui.status.textContent = text;
  ui.status.classList.remove("good", "bad");
  if (kind) ui.status.classList.add(kind);
}

function renderHud() {
  ui.playerScore.textContent = state.playerScore;
  ui.cpuScore.textContent = state.cpuScore;
  ui.timeLeft.textContent = `${state.timer.toFixed(1)}s`;
  ui.bestWins.textContent = state.bestWins;
  ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetPuck(serveToCpu = false) {
  const angleBase = serveToCpu ? Math.PI * 1.5 : Math.PI * 0.5;
  const wobble = (Math.random() - 0.5) * 0.6;
  const speed = 390;
  state.puck.x = TABLE.width / 2;
  state.puck.y = TABLE.height / 2;
  state.puck.vx = Math.cos(angleBase + wobble) * speed;
  state.puck.vy = Math.sin(angleBase + wobble) * speed;
}

function restartRound() {
  state.timer = 75;
  state.playerScore = 0;
  state.cpuScore = 0;
  state.winnerDeclared = false;
  state.paddlePlayer.x = TABLE.width / 2;
  state.paddlePlayer.y = TABLE.height - 88;
  state.paddleCPU.x = TABLE.width / 2;
  state.paddleCPU.y = 88;
  resetPuck(Math.random() > 0.5);
  renderHud();
}

function ensureAudio() {
  if (state.audioReady) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioCtx = new AudioContext();
    state.audioReady = true;
  } catch {
    state.audioReady = false;
  }
}

function beep(type = "tap") {
  if (!state.audioReady || !state.audioCtx) return;
  if (state.audioCtx.state === "suspended") state.audioCtx.resume();

  const tones = {
    tap: [320, 0.045, "triangle"],
    rail: [210, 0.05, "square"],
    score: [640, 0.11, "sawtooth"],
    over: [150, 0.16, "square"]
  };

  const [freq, dur, typeOsc] = tones[type] || tones.tap;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = typeOsc;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function goalMouthRange() {
  const left = (TABLE.width - TABLE.goalWidth) / 2;
  return [left, left + TABLE.goalWidth];
}

function handleWallCollisions() {
  const p = state.puck;
  const [goalLeft, goalRight] = goalMouthRange();

  if (p.x - p.r <= TABLE.rail) {
    p.x = TABLE.rail + p.r;
    p.vx *= -1;
    beep("rail");
  }

  if (p.x + p.r >= TABLE.width - TABLE.rail) {
    p.x = TABLE.width - TABLE.rail - p.r;
    p.vx *= -1;
    beep("rail");
  }

  const inGoalMouth = p.x >= goalLeft && p.x <= goalRight;

  if (p.y - p.r <= TABLE.rail) {
    if (inGoalMouth) {
      state.playerScore += 1;
      beep("score");
      setStatus("Goal! You scored on the kiosk bot.", "good");
      resetPuck(true);
    } else {
      p.y = TABLE.rail + p.r;
      p.vy *= -1;
      beep("rail");
    }
  }

  if (p.y + p.r >= TABLE.height - TABLE.rail) {
    if (inGoalMouth) {
      state.cpuScore += 1;
      beep("score");
      setStatus("CPU scores. Tighten your defense.", "bad");
      resetPuck(false);
    } else {
      p.y = TABLE.height - TABLE.rail - p.r;
      p.vy *= -1;
      beep("rail");
    }
  }
}

function collidePaddle(paddle) {
  const puck = state.puck;
  const dx = puck.x - paddle.x;
  const dy = puck.y - paddle.y;
  const minDist = puck.r + paddle.r;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) return;

  const dist = Math.sqrt(distSq) || 0.0001;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  puck.x += nx * overlap;
  puck.y += ny * overlap;

  const relVx = puck.vx;
  const relVy = puck.vy;
  const relAlongNormal = relVx * nx + relVy * ny;

  if (relAlongNormal < 0) {
    const bounce = 1.06;
    puck.vx -= (1 + bounce) * relAlongNormal * nx;
    puck.vy -= (1 + bounce) * relAlongNormal * ny;
  }

  const maxSpeed = 690;
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > maxSpeed) {
    const factor = maxSpeed / speed;
    puck.vx *= factor;
    puck.vy *= factor;
  }

  beep("tap");
}

function updateCPU(dt) {
  const cpu = state.paddleCPU;
  const puck = state.puck;
  const tracking = puck.y < TABLE.lineY + 80;
  const targetX = tracking ? puck.x : TABLE.width / 2;
  const targetY = tracking ? clamp(puck.y - 95, 76, TABLE.lineY - 38) : 92;

  const speed = 300 + state.cpuScore * 16;
  const maxMove = speed * dt;

  const dx = targetX - cpu.x;
  const dy = targetY - cpu.y;
  const dist = Math.hypot(dx, dy);

  if (dist > 0.01) {
    const step = Math.min(maxMove, dist);
    cpu.x += (dx / dist) * step;
    cpu.y += (dy / dist) * step;
  }

  cpu.x = clamp(cpu.x, TABLE.rail + cpu.r, TABLE.width - TABLE.rail - cpu.r);
  cpu.y = clamp(cpu.y, TABLE.rail + cpu.r, TABLE.lineY - cpu.r - 12);
}

function updatePlayer(dt) {
  const p = state.paddlePlayer;
  const follow = 18;
  p.x += (state.pointerX - p.x) * clamp(follow * dt, 0, 1);
  p.y += (state.pointerY - p.y) * clamp(follow * dt, 0, 1);

  p.x = clamp(p.x, TABLE.rail + p.r, TABLE.width - TABLE.rail - p.r);
  p.y = clamp(p.y, TABLE.lineY + p.r + 12, TABLE.height - TABLE.rail - p.r);
}

function updatePuck(dt) {
  const puck = state.puck;

  puck.x += puck.vx * dt;
  puck.y += puck.vy * dt;

  puck.vx *= Math.pow(0.995, dt * 60);
  puck.vy *= Math.pow(0.995, dt * 60);

  handleWallCollisions();
  collidePaddle(state.paddlePlayer);
  collidePaddle(state.paddleCPU);
}

function checkEndConditions() {
  if (state.winnerDeclared) return;

  if (state.playerScore >= 7 || state.cpuScore >= 7 || state.timer <= 0) {
    state.running = false;
    state.paused = false;
    state.winnerDeclared = true;

    if (state.playerScore > state.cpuScore) {
      state.bestWins += 1;
      localStorage.setItem("food_court_air_hockey_91_best", String(state.bestWins));
      setStatus(`You win ${state.playerScore}-${state.cpuScore}. Mall crown secured.`, "good");
    } else if (state.cpuScore > state.playerScore) {
      setStatus(`CPU wins ${state.cpuScore}-${state.playerScore}. Another match?`, "bad");
    } else {
      setStatus(`Draw ${state.playerScore}-${state.cpuScore}. Sudden rematch ready.`, "good");
    }

    beep("over");
    ui.pauseBtn.disabled = true;
    renderHud();
  }
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.timer = Math.max(0, state.timer - dt);
  updatePlayer(dt);
  updateCPU(dt);
  updatePuck(dt);
  checkEndConditions();
  renderHud();
}

function drawGlowCircle(x, y, radius, color) {
  ctx.save();
  ctx.shadowBlur = 22;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTable() {
  const [goalLeft, goalRight] = goalMouthRange();

  ctx.clearRect(0, 0, TABLE.width, TABLE.height);

  const grad = ctx.createLinearGradient(0, 0, 0, TABLE.height);
  grad.addColorStop(0, "#0b1838");
  grad.addColorStop(0.5, "#0a1330");
  grad.addColorStop(1, "#11142a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TABLE.width, TABLE.height);

  ctx.strokeStyle = "#4f7fd3";
  ctx.lineWidth = TABLE.rail;
  ctx.strokeRect(TABLE.rail / 2, TABLE.rail / 2, TABLE.width - TABLE.rail, TABLE.height - TABLE.rail);

  ctx.strokeStyle = "#3ad7ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(TABLE.rail, TABLE.lineY);
  ctx.lineTo(TABLE.width - TABLE.rail, TABLE.lineY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(TABLE.width / 2, TABLE.lineY, 62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#ff73db";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(goalLeft, TABLE.rail - 1);
  ctx.lineTo(goalRight, TABLE.rail - 1);
  ctx.moveTo(goalLeft, TABLE.height - TABLE.rail + 1);
  ctx.lineTo(goalRight, TABLE.height - TABLE.rail + 1);
  ctx.stroke();

  ctx.fillStyle = "rgba(88, 230, 255, 0.1)";
  for (let i = 0; i < 20; i += 1) {
    const y = TABLE.rail + i * 24;
    ctx.fillRect(TABLE.rail + 8, y, TABLE.width - TABLE.rail * 2 - 16, 1);
  }

  drawGlowCircle(state.paddlePlayer.x, state.paddlePlayer.y, state.paddlePlayer.r, state.paddlePlayer.color);
  drawGlowCircle(state.paddleCPU.x, state.paddleCPU.y, state.paddleCPU.r, state.paddleCPU.color);
  drawGlowCircle(state.puck.x, state.puck.y, state.puck.r, "#ffd578");
}

function frame(ts) {
  if (!state.lastTime) state.lastTime = ts;
  const dt = Math.min(0.035, (ts - state.lastTime) / 1000);
  state.lastTime = ts;

  update(dt);
  drawTable();

  requestAnimationFrame(frame);
}

function pointerToTable(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * TABLE.width;
  const y = ((event.clientY - rect.top) / rect.height) * TABLE.height;
  state.pointerX = clamp(x, TABLE.rail + 24, TABLE.width - TABLE.rail - 24);
  state.pointerY = clamp(y, TABLE.lineY + 40, TABLE.height - TABLE.rail - 24);
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointerToTable(event);
});
canvas.addEventListener("pointermove", pointerToTable);

ui.startBtn.addEventListener("click", () => {
  ensureAudio();
  restartRound();
  state.running = true;
  state.paused = false;
  ui.pauseBtn.disabled = false;
  setStatus("Match live. Defend your lane and score 7.");
  renderHud();
});

ui.pauseBtn.addEventListener("click", () => {
  if (!state.running) return;
  state.paused = !state.paused;
  setStatus(state.paused ? "Paused." : "Back in play.");
  renderHud();
});

ui.resetBtn.addEventListener("click", () => {
  state.running = false;
  state.paused = false;
  restartRound();
  ui.pauseBtn.disabled = true;
  setStatus("Reset complete. Press Start Match.");
});

renderHud();
restartRound();
ui.pauseBtn.disabled = true;
requestAnimationFrame(frame);
