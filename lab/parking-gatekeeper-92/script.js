const state = {
  running: false,
  score: 0,
  streak: 0,
  lives: 3,
  timeLeft: 75,
  best: Number(localStorage.getItem("parking_gatekeeper_92_best") || 0),
  ticket: null,
  timerId: null,
  audioReady: false,
  audioCtx: null
};

const ui = {
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  lives: document.getElementById("lives"),
  time: document.getElementById("time"),
  best: document.getElementById("best"),
  plate: document.getElementById("plate"),
  zone: document.getElementById("zone"),
  hours: document.getElementById("hours"),
  paid: document.getElementById("paid"),
  permit: document.getElementById("permit"),
  stamp: document.getElementById("stamp"),
  hint: document.getElementById("hint"),
  startBtn: document.getElementById("startBtn"),
  restartBtn: document.getElementById("restartBtn"),
  approveBtn: document.getElementById("approveBtn"),
  rejectBtn: document.getElementById("rejectBtn")
};

const BASE_ZONE_COST = { A: 4, B: 5, C: 6, D: 8 };
const ZONES = ["A", "B", "C", "D"];
const PERMITS = ["none", "none", "none", "monthly", "VIP"];
const STAMPS = ["day", "night"];

function renderHud() {
  ui.score.textContent = state.score;
  ui.streak.textContent = state.streak;
  ui.lives.textContent = state.lives;
  ui.time.textContent = `${state.timeLeft.toFixed(1)}s`;
  ui.best.textContent = state.best;
}

function randomPlate() {
  const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
  const pick = () => letters[Math.floor(Math.random() * letters.length)];
  const num = () => Math.floor(Math.random() * 10);
  return `${pick()}${pick()}-${num()}${num()}${num()}`;
}

function createTicket() {
  const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  const hours = 1 + Math.floor(Math.random() * 12);
  const permit = PERMITS[Math.floor(Math.random() * PERMITS.length)];
  const stamp = STAMPS[Math.floor(Math.random() * STAMPS.length)];

  let paid = 0;
  if (permit === "VIP") {
    paid = Math.floor(Math.random() * 4);
  } else if (permit === "monthly") {
    paid = Math.random() < 0.75 ? 0 : 1 + Math.floor(Math.random() * 4);
  } else {
    const baseline = BASE_ZONE_COST[zone] + (hours > 9 ? 4 : 0);
    const chaos = -2 + Math.floor(Math.random() * 7);
    paid = Math.max(0, baseline + chaos);
  }

  return {
    plate: randomPlate(),
    zone,
    hours,
    paid,
    permit,
    stamp
  };
}

function isTicketValid(ticket) {
  if (ticket.permit === "VIP") return true;

  if (ticket.permit === "monthly") {
    return ticket.paid === 0 && ticket.hours <= 10;
  }

  if (ticket.stamp === "night" && ticket.hours > 6) return false;
  if (ticket.zone === "D" && ticket.paid < 8) return false;
  if (ticket.hours > 9 && ticket.paid < 12) return false;

  return ticket.paid >= BASE_ZONE_COST[ticket.zone];
}

function renderTicket(ticket) {
  ui.plate.textContent = ticket.plate;
  ui.zone.textContent = ticket.zone;
  ui.hours.textContent = `${ticket.hours}h`;
  ui.paid.textContent = `${ticket.paid} DM`;
  ui.permit.textContent = ticket.permit;
  ui.stamp.textContent = ticket.stamp;
}

function setHint(text, kind = "") {
  ui.hint.textContent = text;
  ui.hint.classList.remove("good", "bad");
  if (kind) ui.hint.classList.add(kind);
}

function toggleActionButtons(enabled) {
  ui.approveBtn.disabled = !enabled;
  ui.rejectBtn.disabled = !enabled;
}

function makeBeep(type = "ok") {
  if (!state.audioReady || !state.audioCtx) return;
  const ctx = state.audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const tones = {
    ok: [520, 0.06],
    bad: [180, 0.1],
    combo: [760, 0.08],
    over: [120, 0.18]
  };

  const [freq, duration] = tones[type] || tones.ok;
  osc.type = type === "bad" || type === "over" ? "square" : "triangle";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.015);
}

async function initAudio() {
  if (state.audioReady) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audioCtx = new AudioContext();
    await state.audioCtx.resume();
    state.audioReady = true;
  } catch {
    state.audioReady = false;
  }
}

function nextTicket() {
  state.ticket = createTicket();
  renderTicket(state.ticket);
}

function endShift(reason = "Shift complete.") {
  state.running = false;
  clearInterval(state.timerId);
  toggleActionButtons(false);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("parking_gatekeeper_92_best", String(state.best));
  }

  makeBeep("over");
  setHint(`${reason} Final score: ${state.score}. Press Restart for another shift.`, "bad");
  renderHud();
}

function judgeDecision(playerApproved) {
  if (!state.running || !state.ticket) return;

  const valid = isTicketValid(state.ticket);
  const correct = playerApproved === valid;

  if (correct) {
    state.streak += 1;
    const bonus = Math.min(6, Math.floor(state.streak / 3));
    state.score += 10 + bonus * 2;
    const label = valid ? "Approved legit ticket." : "Blocked suspicious ticket.";
    setHint(`${label} +${10 + bonus * 2} pts`, "good");
    makeBeep(state.streak % 6 === 0 ? "combo" : "ok");
  } else {
    state.lives -= 1;
    state.streak = 0;
    const should = valid ? "APPROVE" : "REJECT";
    setHint(`Wrong call. That ticket should be ${should}.`, "bad");
    makeBeep("bad");
    if (state.lives <= 0) {
      renderHud();
      endShift("Booth security replaced you.");
      return;
    }
  }

  renderHud();
  nextTicket();
}

function tick() {
  if (!state.running) return;
  state.timeLeft = Math.max(0, state.timeLeft - 0.1);
  renderHud();

  if (state.timeLeft <= 0) {
    endShift("Shift over.");
  }
}

function startShift() {
  if (state.running) return;
  initAudio();

  state.running = true;
  state.score = 0;
  state.streak = 0;
  state.lives = 3;
  state.timeLeft = 75;

  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 100);

  setHint("Rush hour started. Keep the gate clean.");
  toggleActionButtons(true);
  nextTicket();
  renderHud();
}

function restartShift() {
  clearInterval(state.timerId);
  state.running = false;
  state.score = 0;
  state.streak = 0;
  state.lives = 3;
  state.timeLeft = 75;

  renderTicket({ plate: "--", zone: "-", hours: 0, paid: 0, permit: "none", stamp: "day" });
  setHint("Press Start Shift to begin. Approve (A) or Reject (R).", "");
  toggleActionButtons(false);
  renderHud();
}

ui.startBtn.addEventListener("click", startShift);
ui.restartBtn.addEventListener("click", restartShift);
ui.approveBtn.addEventListener("click", () => judgeDecision(true));
ui.rejectBtn.addEventListener("click", () => judgeDecision(false));

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if ((key === "a" || key === "r") && !state.running) return;

  if (key === "a") {
    event.preventDefault();
    judgeDecision(true);
  } else if (key === "r") {
    event.preventDefault();
    judgeDecision(false);
  } else if (key === "enter" && !state.running) {
    event.preventDefault();
    startShift();
  }
});

restartShift();
