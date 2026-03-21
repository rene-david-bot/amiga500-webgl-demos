const commands = [
  { id: "fuel", label: "Refuel", key: "1", note: "+2.5s service", color: "#ffd15e", freq: 220 },
  { id: "tires", label: "Swap Tires", key: "2", note: "+2.2s service", color: "#67b0ff", freq: 260 },
  { id: "wing", label: "Wing Adjust", key: "3", note: "+1.6s service", color: "#c88dff", freq: 320 },
  { id: "visor", label: "Visor Clean", key: "4", note: "+1.1s service", color: "#7bffba", freq: 420 },
  { id: "boost", label: "Turbo Prime", key: "5", note: "+1.8s service", color: "#ff87a4", freq: 510 }
];

const ui = {
  round: document.getElementById("round"),
  score: document.getElementById("score"),
  best: document.getElementById("best"),
  streak: document.getElementById("streak"),
  lives: document.getElementById("lives"),
  timerFill: document.getElementById("timerFill"),
  timerText: document.getElementById("timerText"),
  orderList: document.getElementById("orderList"),
  buttons: document.getElementById("buttons"),
  status: document.getElementById("status"),
  startBtn: document.getElementById("startBtn")
};

const BEST_KEY = "pitstop_protocol_best";

const state = {
  round: 1,
  score: 0,
  streak: 0,
  lives: 3,
  active: false,
  order: [],
  step: 0,
  roundMs: 7000,
  remainingMs: 7000,
  startedAt: 0,
  raf: null,
  best: Number(localStorage.getItem(BEST_KEY) || 0)
};

let audioCtx = null;

function setupButtons() {
  ui.buttons.innerHTML = "";
  for (const command of commands) {
    const btn = document.createElement("button");
    btn.className = "command-btn";
    btn.dataset.id = command.id;
    btn.innerHTML = `
      <span class="key">${command.key}</span>
      <span class="title">${command.label}</span>
      <span class="meta">${command.note}</span>
    `;
    btn.addEventListener("click", () => handleInput(command.id));
    ui.buttons.appendChild(btn);
  }
}

function randomOrder() {
  const length = Math.min(6, 3 + Math.floor((state.round - 1) / 2));
  const pool = [...commands];
  const output = [];

  for (let i = 0; i < length; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    output.push(pick.id);

    if (Math.random() < 0.38) {
      continue;
    }

    const idx = pool.findIndex(c => c.id === pick.id);
    if (idx >= 0) {
      pool.splice(idx, 1);
    }

    if (pool.length === 0) {
      pool.push(...commands);
    }
  }

  return output;
}

function renderOrder() {
  ui.orderList.innerHTML = "";
  state.order.forEach((commandId, index) => {
    const command = commands.find(c => c.id === commandId);
    const chip = document.createElement("div");
    chip.className = "order-chip";
    if (index < state.step) chip.classList.add("done");
    if (index === state.step && state.active) chip.classList.add("next");
    chip.textContent = `${index + 1}. ${command.label}`;
    ui.orderList.appendChild(chip);
  });
}

function updateHud() {
  ui.round.textContent = state.round;
  ui.score.textContent = state.score;
  ui.streak.textContent = state.streak;
  ui.lives.textContent = state.lives;
  ui.best.textContent = state.best;

  const pct = Math.max(0, Math.min(100, (state.remainingMs / state.roundMs) * 100));
  ui.timerFill.style.width = `${pct}%`;
  ui.timerText.textContent = `${(state.remainingMs / 1000).toFixed(1)}s`;
}

function setStatus(message, kind = "") {
  ui.status.className = `status ${kind}`.trim();
  ui.status.textContent = message;
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep(freq = 380, duration = 0.09, type = "square", gain = 0.05) {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function startRound() {
  state.order = randomOrder();
  state.step = 0;
  state.roundMs = Math.max(3300, 7000 - (state.round - 1) * 240);
  state.remainingMs = state.roundMs;
  state.startedAt = performance.now();
  state.active = true;

  renderOrder();
  updateHud();
  setStatus(`Car in bay! Execute ${state.order.length} commands in sequence.`, "");

  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(tick);
}

function tick(now) {
  if (!state.active) return;

  const elapsed = now - state.startedAt;
  state.remainingMs = state.roundMs - elapsed;

  if (state.remainingMs <= 0) {
    failRound("Pit window missed. Car lost in lane traffic.");
    return;
  }

  updateHud();
  state.raf = requestAnimationFrame(tick);
}

function handleInput(commandId) {
  if (!state.active) return;

  const expected = state.order[state.step];

  if (commandId === expected) {
    const command = commands.find(c => c.id === commandId);
    state.step += 1;
    state.score += 110 + Math.round(state.remainingMs / 95);

    beep(command.freq, 0.08, "square", 0.05);

    if (state.step >= state.order.length) {
      completeRound();
      return;
    }

    renderOrder();
    updateHud();
    setStatus(`Good call. Next: ${commands.find(c => c.id === state.order[state.step]).label}`, "good");
    return;
  }

  state.lives -= 1;
  state.streak = 0;
  state.remainingMs = Math.max(500, state.remainingMs - 1200);

  beep(120, 0.18, "sawtooth", 0.08);

  if (state.lives <= 0) {
    endGame("Crew integrity collapsed. Shift over.");
    return;
  }

  updateHud();
  setStatus(`Wrong command. Needed ${commands.find(c => c.id === expected).label}.`, "bad");
}

function completeRound() {
  state.active = false;
  state.streak += 1;
  state.score += 180 + state.streak * 35;
  state.round += 1;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  beep(650, 0.07, "triangle", 0.05);
  setTimeout(() => beep(820, 0.08, "triangle", 0.045), 80);

  renderOrder();
  updateHud();
  setStatus(`Perfect pit stop. Combo streak: ${state.streak}.`, "good");

  setTimeout(() => {
    if (state.lives > 0) startRound();
  }, 850);
}

function failRound(message) {
  state.active = false;
  state.lives -= 1;
  state.streak = 0;

  beep(110, 0.23, "sawtooth", 0.09);

  if (state.lives <= 0) {
    endGame(message);
    return;
  }

  updateHud();
  setStatus(`${message} Crew reset and next car is lining up.`, "bad");

  setTimeout(() => {
    if (state.lives > 0) startRound();
  }, 1100);
}

function endGame(reason) {
  state.active = false;
  if (state.raf) cancelAnimationFrame(state.raf);

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }

  updateHud();
  setStatus(`${reason} Final score: ${state.score}. Hit Launch Shift to restart.`, "bad");
  ui.startBtn.textContent = "Restart Shift";
}

function startGame() {
  ensureAudio();

  if (state.raf) cancelAnimationFrame(state.raf);

  state.round = 1;
  state.score = 0;
  state.streak = 0;
  state.lives = 3;
  state.active = false;

  ui.startBtn.textContent = "Shift Running";
  startRound();
}

window.addEventListener("keydown", event => {
  const command = commands.find(c => c.key === event.key);
  if (!command) return;
  event.preventDefault();
  handleInput(command.id);
});

ui.startBtn.addEventListener("click", startGame);

setupButtons();
renderOrder();
updateHud();
