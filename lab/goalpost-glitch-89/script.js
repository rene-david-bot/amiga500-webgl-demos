const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");

const ui = {
  round: document.getElementById("round"),
  goals: document.getElementById("goals"),
  saves: document.getElementById("saves"),
  misses: document.getElementById("misses"),
  streak: document.getElementById("streak"),
  best: document.getElementById("best"),
  message: document.getElementById("message"),
  action: document.getElementById("action"),
  aimMarker: document.getElementById("aim-marker"),
  powerMarker: document.getElementById("power-marker"),
  aimLock: document.getElementById("aim-lock"),
  powerLock: document.getElementById("power-lock"),
  aimReadout: document.getElementById("aim-readout"),
  powerReadout: document.getElementById("power-readout")
};

const FIELD = {
  goalY: 68,
  goalWidth: 360,
  goalHeight: 122,
  shootX: canvas.width * 0.5,
  shootY: canvas.height - 56
};

const game = {
  round: 1,
  goals: 0,
  saves: 0,
  misses: 0,
  streak: 0,
  best: 0,
  phase: "aim",
  aim: 0,
  power: 0.5,
  aimDir: 1,
  powerDir: 1,
  lockedAim: null,
  lockedPower: null,
  shootProgress: 0,
  keeperX: canvas.width * 0.5,
  outcome: null,
  ball: { x: FIELD.shootX, y: FIELD.shootY, r: 9 },
  flash: 0
};

let audioCtx = null;
let lastTime = performance.now();

function toPercent(norm, min = -1, max = 1) {
  return ((norm - min) / (max - min)) * 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep(freq, duration = 0.08, type = "square", gainValue = 0.05, slideTo = null) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playKick() {
  beep(220, 0.08, "triangle", 0.08, 80);
  beep(700, 0.04, "square", 0.03, 400);
}

function playGoal() {
  beep(392, 0.09, "square", 0.06);
  setTimeout(() => beep(523, 0.09, "square", 0.06), 90);
  setTimeout(() => beep(784, 0.15, "triangle", 0.07), 180);
}

function playSave() {
  beep(160, 0.14, "sawtooth", 0.07, 90);
}

function playMiss() {
  beep(210, 0.1, "square", 0.05);
  setTimeout(() => beep(140, 0.14, "triangle", 0.05), 90);
}

function setMessage(text) {
  ui.message.textContent = text;
}

function updateHUD() {
  ui.round.textContent = String(game.round);
  ui.goals.textContent = String(game.goals);
  ui.saves.textContent = String(game.saves);
  ui.misses.textContent = String(game.misses);
  ui.streak.textContent = String(game.streak);
  ui.best.textContent = String(game.best);

  const aimPercent = clamp(toPercent(game.aim), 0, 100);
  const powerPercent = clamp(game.power * 100, 0, 100);
  ui.aimMarker.style.left = `calc(${aimPercent}% - 1px)`;
  ui.powerMarker.style.left = `calc(${powerPercent}% - 1px)`;

  if (game.lockedAim === null) {
    ui.aimLock.classList.remove("visible");
  } else {
    ui.aimLock.classList.add("visible");
    ui.aimLock.style.left = `calc(${clamp(toPercent(game.lockedAim), 0, 100)}% - 1px)`;
  }

  if (game.lockedPower === null) {
    ui.powerLock.classList.remove("visible");
  } else {
    ui.powerLock.classList.add("visible");
    ui.powerLock.style.left = `calc(${clamp(game.lockedPower * 100, 0, 100)}% - 1px)`;
  }

  const aimWord = game.aim < -0.35 ? "LEFT" : game.aim > 0.35 ? "RIGHT" : "CENTER";
  ui.aimReadout.textContent = aimWord;
  ui.powerReadout.textContent = `${Math.round(powerPercent)}%`;

  if (game.phase === "aim") {
    ui.action.textContent = "Lock Aim";
  } else if (game.phase === "power") {
    ui.action.textContent = "Kick Ball";
  } else if (game.phase === "result") {
    ui.action.textContent = "Next Shot";
  } else {
    ui.action.textContent = "Shooting...";
  }
}

function evaluateShot(aim, power) {
  const goalLeft = canvas.width * 0.5 - FIELD.goalWidth / 2;
  const goalTop = FIELD.goalY;

  const targetX = goalLeft + FIELD.goalWidth * (0.5 + aim * 0.44);
  const targetY = goalTop + FIELD.goalHeight * (0.86 - power * 0.74);

  const keeperGuess = (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.5);
  const keeperDiveX = goalLeft + FIELD.goalWidth * (0.5 + keeperGuess * 0.45);

  const wildMiss = power > 0.96 || power < 0.08 || Math.abs(aim) > 0.97;
  if (wildMiss) {
    return {
      type: "miss",
      targetX: targetX + (Math.random() * 40 - 20),
      targetY: goalTop - 18,
      keeperDiveX
    };
  }

  const closeness = 1 - Math.min(1, Math.abs(aim - keeperGuess) / 1.2);
  const centerBonus = Math.abs(power - 0.58) < 0.15 ? 0.08 : 0;
  const saveProbability = clamp(0.18 + closeness * 0.52 + centerBonus, 0.1, 0.82);

  if (Math.random() < saveProbability) {
    return { type: "save", targetX, targetY, keeperDiveX };
  }

  return { type: "goal", targetX, targetY, keeperDiveX };
}

function startShot() {
  game.phase = "shooting";
  game.shootProgress = 0;
  game.outcome = evaluateShot(game.lockedAim, game.lockedPower);
  setMessage("Ball away...");
  playKick();
}

function resetForNextRound() {
  game.phase = "aim";
  game.aim = 0;
  game.power = Math.random() * 0.5 + 0.25;
  game.lockedAim = null;
  game.lockedPower = null;
  game.outcome = null;
  game.shootProgress = 0;
  game.keeperX = canvas.width * 0.5;
  game.ball.x = FIELD.shootX;
  game.ball.y = FIELD.shootY;
  setMessage("Line up your shot and lock your direction.");
}

function finalizeShot() {
  game.phase = "result";
  game.round += 1;

  if (game.outcome.type === "goal") {
    game.goals += 1;
    game.streak += 1;
    game.best = Math.max(game.best, game.streak);
    game.flash = 1;
    playGoal();
    setMessage("GOAL! Clean strike past the keeper.");
  } else if (game.outcome.type === "save") {
    game.saves += 1;
    game.streak = 0;
    playSave();
    setMessage("Saved! The keeper guessed your lane.");
  } else {
    game.misses += 1;
    game.streak = 0;
    playMiss();
    setMessage("Miss! Too wild on that attempt.");
  }
}

function takeAction() {
  ensureAudio();

  if (game.phase === "aim") {
    game.lockedAim = game.aim;
    game.phase = "power";
    beep(540, 0.06, "square", 0.04);
    setMessage("Aim locked. Now time the power meter.");
  } else if (game.phase === "power") {
    game.lockedPower = game.power;
    beep(680, 0.06, "square", 0.04);
    startShot();
  } else if (game.phase === "result") {
    resetForNextRound();
  }
}

ui.action.addEventListener("click", takeAction);
canvas.addEventListener("pointerdown", takeAction);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    takeAction();
  }
});

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#11204f");
  grad.addColorStop(1, "#0a1227");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 24; i++) {
    const y = (i / 24) * canvas.height;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(0, y, canvas.width, 2);
  }
}

function drawGoal() {
  const gx = canvas.width * 0.5 - FIELD.goalWidth / 2;
  const gy = FIELD.goalY;

  ctx.strokeStyle = "#ecf5ff";
  ctx.lineWidth = 4;
  ctx.strokeRect(gx, gy, FIELD.goalWidth, FIELD.goalHeight);

  ctx.strokeStyle = "rgba(130, 180, 255, 0.45)";
  ctx.lineWidth = 1;
  for (let x = gx + 16; x < gx + FIELD.goalWidth; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + FIELD.goalHeight);
    ctx.stroke();
  }
  for (let y = gy + 14; y < gy + FIELD.goalHeight; y += 14) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + FIELD.goalWidth, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(69, 248, 212, 0.15)";
  ctx.fillRect(gx, gy + FIELD.goalHeight - 30, FIELD.goalWidth, 30);
}

function drawKeeper() {
  const x = game.keeperX;
  const y = FIELD.goalY + FIELD.goalHeight - 18;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "#ff58c8";
  ctx.fillRect(-16, -30, 32, 24);

  ctx.fillStyle = "#f6dc9f";
  ctx.fillRect(-8, -40, 16, 10);

  ctx.fillStyle = "#8ac5ff";
  ctx.fillRect(-28, -26, 12, 8);
  ctx.fillRect(16, -26, 12, 8);

  ctx.fillStyle = "#9dd2ff";
  ctx.fillRect(-10, -6, 8, 14);
  ctx.fillRect(2, -6, 8, 14);
  ctx.restore();
}

function drawBall() {
  ctx.save();
  ctx.translate(game.ball.x, game.ball.y);
  ctx.fillStyle = "#e7f4ff";
  ctx.beginPath();
  ctx.arc(0, 0, game.ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#6ea8df";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, game.ball.r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4, 0);
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 4);
  ctx.stroke();
  ctx.restore();
}

function drawReticle() {
  if (game.phase === "shooting" || game.phase === "result") return;

  const gx = canvas.width * 0.5 - FIELD.goalWidth / 2;
  const gy = FIELD.goalY;
  const tx = gx + FIELD.goalWidth * (0.5 + game.aim * 0.44);
  const ty = gy + FIELD.goalHeight * (0.86 - Math.max(game.power, 0.2) * 0.72);

  ctx.strokeStyle = game.phase === "aim" ? "#55f8d4" : "#ffc857";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tx, ty, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tx - 16, ty);
  ctx.lineTo(tx + 16, ty);
  ctx.moveTo(tx, ty - 16);
  ctx.lineTo(tx, ty + 16);
  ctx.stroke();
}

function updateSimulation(dt) {
  const aimSpeed = 0.00125;
  const powerSpeed = 0.0014;

  if (game.phase === "aim") {
    game.aim += game.aimDir * dt * aimSpeed;
    if (game.aim >= 1) {
      game.aim = 1;
      game.aimDir = -1;
    }
    if (game.aim <= -1) {
      game.aim = -1;
      game.aimDir = 1;
    }
  }

  if (game.phase === "power") {
    game.power += game.powerDir * dt * powerSpeed;
    if (game.power >= 1) {
      game.power = 1;
      game.powerDir = -1;
    }
    if (game.power <= 0) {
      game.power = 0;
      game.powerDir = 1;
    }
  }

  if (game.phase === "shooting" && game.outcome) {
    game.shootProgress = clamp(game.shootProgress + dt * 0.0014, 0, 1);
    const t = game.shootProgress;

    const sx = FIELD.shootX;
    const sy = FIELD.shootY;
    const tx = game.outcome.targetX;
    const ty = game.outcome.targetY;

    const arc = 150 + game.lockedPower * 90;
    const mx = (sx + tx) / 2;
    const my = Math.min(sy, ty) - arc;

    const inv = 1 - t;
    game.ball.x = inv * inv * sx + 2 * inv * t * mx + t * t * tx;
    game.ball.y = inv * inv * sy + 2 * inv * t * my + t * t * ty;

    const keeperEase = Math.pow(t, 0.72);
    game.keeperX += (game.outcome.keeperDiveX - game.keeperX) * keeperEase * 0.28;

    if (t >= 1) {
      finalizeShot();
    }
  }

  if (game.flash > 0) {
    game.flash = Math.max(0, game.flash - dt * 0.0025);
  }
}

function drawOverlay() {
  if (!game.flash) return;
  ctx.fillStyle = `rgba(85, 248, 212, ${0.25 * game.flash})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function frame(now) {
  const dt = now - lastTime;
  lastTime = now;

  updateSimulation(dt);

  drawBackground();
  drawGoal();
  drawReticle();
  drawKeeper();
  drawBall();
  drawOverlay();

  updateHUD();
  requestAnimationFrame(frame);
}

setMessage("Line up your shot and lock your direction.");
updateHUD();
requestAnimationFrame(frame);
