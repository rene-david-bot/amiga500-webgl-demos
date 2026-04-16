const canvas = document.getElementById("disc");
const ctx = canvas.getContext("2d");

const ui = {
  timeLeft: document.getElementById("timeLeft"),
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  targetLabel: document.getElementById("targetLabel"),
  speedLabel: document.getElementById("speedLabel"),
  status: document.getElementById("status"),
  startBtn: document.getElementById("startBtn"),
  cueBtn: document.getElementById("cueBtn")
};

const state = {
  playing: false,
  timeLeft: 60,
  score: 0,
  streak: 0,
  level: 1,
  speed: 110,
  spinDir: 1,
  angle: 0,
  targetAngle: 0,
  targetChapter: 1,
  lastTick: performance.now(),
  scenePulse: 0,
  audioCtx: null
};

const CHAPTER_COUNT = 24;

function ensureAudioCtx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function beep(freq = 600, dur = 0.08, type = "square", gain = 0.05) {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp).connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickNextTarget() {
  state.targetChapter = randInt(1, CHAPTER_COUNT);
  state.targetAngle = ((state.targetChapter - 1) / CHAPTER_COUNT) * 360;
  ui.targetLabel.textContent = `CH-${String(state.targetChapter).padStart(2, "0")}`;
}

function circularDistance(a, b) {
  const diff = Math.abs((a - b + 180) % 360 - 180);
  return diff;
}

function updateHud() {
  ui.timeLeft.textContent = `${state.timeLeft.toFixed(1)}s`;
  ui.score.textContent = String(state.score);
  ui.streak.textContent = String(state.streak);
  ui.speedLabel.textContent = `${(Math.abs(state.speed) / 110).toFixed(2)}x`;
}

function setStatus(msg, good = false) {
  ui.status.textContent = msg;
  ui.status.classList.toggle("good", good);
}

function startGame() {
  ensureAudioCtx();
  state.playing = true;
  state.timeLeft = 60;
  state.score = 0;
  state.streak = 0;
  state.level = 1;
  state.speed = 110;
  state.spinDir = 1;
  state.angle = Math.random() * 360;
  state.lastTick = performance.now();
  pickNextTarget();
  updateHud();
  ui.cueBtn.disabled = false;
  ui.startBtn.textContent = "Restart Shift";
  setStatus("Shift live. Nail the chapter cue and build a streak.");
  beep(520, 0.09, "triangle", 0.06);
}

function endGame() {
  state.playing = false;
  ui.cueBtn.disabled = true;
  const rank = state.score >= 2600 ? "Legend" : state.score >= 1700 ? "Pro" : state.score >= 900 ? "Solid" : "Rookie";
  setStatus(`Shift complete. Score ${state.score} · Rank: ${rank}. Hit Start Shift for another run.`, true);
  beep(300, 0.14, "square", 0.06);
}

function cueShot() {
  if (!state.playing) return;
  ensureAudioCtx();

  const needleAngle = ((360 - (state.angle % 360)) + 360) % 360;
  const dist = circularDistance(needleAngle, state.targetAngle);

  let points = 0;
  let label = "MISS";

  if (dist <= 3.5) {
    points = 140 + state.streak * 12;
    label = "PERFECT";
    beep(1040, 0.08, "triangle", 0.07);
    beep(1560, 0.11, "square", 0.05);
    state.streak += 1;
  } else if (dist <= 8) {
    points = 90 + state.streak * 7;
    label = "GREAT";
    beep(820, 0.09, "triangle", 0.06);
    state.streak += 1;
  } else if (dist <= 13) {
    points = 45;
    label = "GOOD";
    beep(620, 0.06, "triangle", 0.05);
    state.streak = Math.max(0, state.streak - 1);
  } else {
    points = -35;
    label = "MISS";
    beep(170, 0.12, "sawtooth", 0.055);
    state.streak = 0;
  }

  state.score = Math.max(0, state.score + points);
  state.level += 1;

  if (Math.random() < 0.24) {
    state.spinDir *= -1;
  }

  state.speed = (110 + state.level * 3.8) * state.spinDir;

  setStatus(`${label} · Δ${dist.toFixed(1)}° · ${points >= 0 ? "+" : ""}${points} pts`, points >= 45);
  pickNextTarget();
  updateHud();
}

function drawDiscFace(now) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const r = 270;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 340);
  bg.addColorStop(0, "#1a2852");
  bg.addColorStop(0.6, "#0a1227");
  bg.addColorStop(1, "#04070f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.scenePulse = 0.5 + Math.sin(now * 0.003) * 0.5;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = `rgba(122, 247, 255, ${0.2 + state.scenePulse * 0.15})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r + 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.rotate((state.angle * Math.PI) / 180);

  const disc = ctx.createRadialGradient(-30, -30, 20, 0, 0, r);
  disc.addColorStop(0, "#d8dfec");
  disc.addColorStop(0.4, "#b8c3d9");
  disc.addColorStop(0.65, "#8794b5");
  disc.addColorStop(0.85, "#2a3350");
  disc.addColorStop(1, "#101a31");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < CHAPTER_COUNT; i += 1) {
    const a = (i / CHAPTER_COUNT) * Math.PI * 2;
    const inner = r - 42;
    const outer = r - 16;
    ctx.strokeStyle = i + 1 === state.targetChapter ? "#7af7ff" : "rgba(242,245,255,0.6)";
    ctx.lineWidth = i + 1 === state.targetChapter ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();

    if ((i + 1) % 2 === 0) {
      ctx.save();
      ctx.translate(Math.cos(a) * (r - 64), Math.sin(a) * (r - 64));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = "rgba(11, 18, 34, 0.75)";
      ctx.font = "700 15px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1).padStart(2, "0"), 0, 0);
      ctx.restore();
    }
  }

  ctx.fillStyle = "#0d162f";
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(12,20,42,0.7)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#dbe6ff";
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);

  const targetA = (state.targetAngle * Math.PI) / 180;
  const tx = Math.cos(targetA - Math.PI / 2) * (r + 28);
  const ty = Math.sin(targetA - Math.PI / 2) * (r + 28);

  ctx.fillStyle = "rgba(122, 247, 255, 0.2)";
  ctx.beginPath();
  ctx.arc(tx, ty, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7af7ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -(r + 60));
  ctx.lineTo(0, -(r - 4));
  ctx.stroke();

  ctx.fillStyle = "#ffe3a8";
  ctx.beginPath();
  ctx.moveTo(-11, -(r + 58));
  ctx.lineTo(11, -(r + 58));
  ctx.lineTo(0, -(r + 40));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(230,239,255,0.92)";
  ctx.font = "700 22px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("NEEDLE", 0, -(r + 85));

  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - state.lastTick) / 1000);
  state.lastTick = now;

  if (state.playing) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateHud();
      endGame();
    } else {
      state.angle = (state.angle + state.speed * dt) % 360;
      updateHud();
    }
  }

  drawDiscFace(now);
  requestAnimationFrame(frame);
}

ui.startBtn.addEventListener("click", startGame);
ui.cueBtn.addEventListener("click", cueShot);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    cueShot();
  }
});

updateHud();
requestAnimationFrame(frame);
