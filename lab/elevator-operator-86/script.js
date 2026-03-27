const FLOORS = 8;
const ROUND_SECONDS = 100;
const MAX_WAIT_SECONDS = 18;
const CABIN_CAPACITY = 3;

const ui = {
  shaft: document.getElementById("shaft"),
  waitingList: document.getElementById("waiting-list"),
  onboardList: document.getElementById("onboard-list"),
  startBtn: document.getElementById("btn-start"),
  restartBtn: document.getElementById("btn-restart"),
  upBtn: document.getElementById("btn-up"),
  downBtn: document.getElementById("btn-down"),
  openBtn: document.getElementById("btn-open"),
  time: document.getElementById("stat-time"),
  score: document.getElementById("stat-score"),
  combo: document.getElementById("stat-combo"),
  best: document.getElementById("stat-best"),
  load: document.getElementById("stat-load"),
  status: document.getElementById("status-text")
};

const state = {
  running: false,
  currentFloor: 1,
  timeLeft: ROUND_SECONDS,
  score: 0,
  combo: 0,
  waiting: [],
  onboard: [],
  nextId: 1,
  tickHandle: null,
  best: Number(localStorage.getItem("retro.elevatorOperator86.best") || 0)
};

let audioCtx = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomFloor(exceptFloor) {
  let floor = 1 + Math.floor(Math.random() * FLOORS);
  while (floor === exceptFloor) {
    floor = 1 + Math.floor(Math.random() * FLOORS);
  }
  return floor;
}

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

function playMove() {
  beep({ freq: 160 + state.currentFloor * 28, duration: 0.07, type: "square", gain: 0.045 });
}

function playCall() {
  beep({ freq: 620, duration: 0.06, type: "triangle", gain: 0.035, slide: 1.02 });
  setTimeout(() => beep({ freq: 750, duration: 0.06, type: "triangle", gain: 0.03, slide: 1.04 }), 70);
}

function playPickup() {
  beep({ freq: 330, duration: 0.06, type: "square", gain: 0.05, slide: 1.15 });
  setTimeout(() => beep({ freq: 420, duration: 0.06, type: "square", gain: 0.045, slide: 1.15 }), 65);
}

function playDrop() {
  beep({ freq: 520, duration: 0.08, type: "square", gain: 0.055, slide: 1.08 });
  setTimeout(() => beep({ freq: 700, duration: 0.1, type: "triangle", gain: 0.04, slide: 1.03 }), 75);
}

function playMiss() {
  beep({ freq: 170, duration: 0.18, type: "sawtooth", gain: 0.05, slide: 0.72 });
}

function playEnd() {
  const notes = [520, 415, 310];
  notes.forEach((freq, index) => {
    setTimeout(() => beep({ freq, duration: 0.13, type: "triangle", gain: 0.045, slide: 0.95 }), index * 130);
  });
}

function updateStatus(text) {
  ui.status.innerHTML = text;
}

function resetShift(autostart = false) {
  state.running = false;
  clearInterval(state.tickHandle);
  state.tickHandle = null;

  state.currentFloor = 1;
  state.timeLeft = ROUND_SECONDS;
  state.score = 0;
  state.combo = 0;
  state.waiting = [];
  state.onboard = [];
  state.nextId = 1;

  render();
  updateStatus("Press <strong>Start Shift</strong> to begin your watch.");

  if (autostart) {
    startShift();
  }
}

function startShift() {
  if (state.running) return;
  ensureAudio();

  state.running = true;
  if (state.timeLeft <= 0) {
    state.timeLeft = ROUND_SECONDS;
  }

  updateStatus("Night shift live. Keep waits below <strong>18s</strong> and chain clean drop-offs.");

  if (!state.tickHandle) {
    state.tickHandle = setInterval(tick, 1000);
  }

  if (state.waiting.length === 0 && state.onboard.length === 0) {
    spawnRequest();
  }

  render();
}

function stopShift(finalMessage) {
  state.running = false;
  clearInterval(state.tickHandle);
  state.tickHandle = null;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("retro.elevatorOperator86.best", String(state.best));
  }

  playEnd();
  updateStatus(finalMessage);
  render();
}

function spawnRequest() {
  const from = randomFloor(state.currentFloor);
  const to = randomFloor(from);
  state.waiting.push({
    id: state.nextId++,
    from,
    to,
    wait: 0
  });
  playCall();
}

function tick() {
  if (!state.running) return;

  state.timeLeft -= 1;

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    stopShift(`Shift complete. Final score: <strong>${state.score}</strong>. Hit reset for another run.`);
    return;
  }

  const totalRiders = state.waiting.length + state.onboard.length;
  const spawnChance = totalRiders < 4 ? 0.45 : totalRiders < 7 ? 0.28 : 0.12;
  if (state.waiting.length < 6 && Math.random() < spawnChance) {
    spawnRequest();
  }

  let missed = 0;
  state.waiting = state.waiting.filter((req) => {
    req.wait += 1;
    if (req.wait > MAX_WAIT_SECONDS) {
      missed += 1;
      return false;
    }
    return true;
  });

  if (missed > 0) {
    state.combo = 0;
    state.score = Math.max(0, state.score - missed * 6);
    playMiss();
    updateStatus(`⚠️ ${missed} call${missed > 1 ? "s" : ""} timed out. Combo lost.`);
  }

  render();
}

function moveLift(step) {
  if (!state.running) return;
  ensureAudio();

  const target = clamp(state.currentFloor + step, 1, FLOORS);
  if (target === state.currentFloor) return;

  state.currentFloor = target;
  playMove();
  render();
}

function openDoors() {
  if (!state.running) return;
  ensureAudio();

  let dropped = 0;
  let picked = 0;

  state.onboard = state.onboard.filter((rider) => {
    if (rider.to === state.currentFloor) {
      dropped += 1;
      return false;
    }
    return true;
  });

  if (dropped > 0) {
    const bonus = dropped * (10 + state.combo * 2);
    state.score += bonus;
    state.combo += dropped;
    playDrop();
    updateStatus(`✅ Dropped ${dropped} rider${dropped > 1 ? "s" : ""} on floor ${state.currentFloor}. +${bonus} points.`);
  }

  const stillWaiting = [];
  for (const request of state.waiting) {
    if (request.from === state.currentFloor && state.onboard.length < CABIN_CAPACITY) {
      state.onboard.push({ id: request.id, from: request.from, to: request.to });
      picked += 1;
    } else {
      stillWaiting.push(request);
    }
  }
  state.waiting = stillWaiting;

  if (picked > 0) {
    playPickup();
    if (dropped === 0) {
      updateStatus(`Boarded ${picked} rider${picked > 1 ? "s" : ""}. Deliver fast to keep your streak climbing.`);
    }
  }

  if (picked === 0 && dropped === 0) {
    state.combo = Math.max(0, state.combo - 1);
    beep({ freq: 240, duration: 0.05, type: "triangle", gain: 0.03, slide: 0.96 });
    updateStatus(`No rider action on floor ${state.currentFloor}.`);
  }

  render();
}

function renderShaft() {
  const waitingByFloor = new Map();
  const dropByFloor = new Map();

  for (const req of state.waiting) {
    waitingByFloor.set(req.from, (waitingByFloor.get(req.from) || 0) + 1);
  }

  for (const rider of state.onboard) {
    dropByFloor.set(rider.to, (dropByFloor.get(rider.to) || 0) + 1);
  }

  ui.shaft.innerHTML = "";

  for (let floor = FLOORS; floor >= 1; floor--) {
    const row = document.createElement("div");
    row.className = "floor-row";

    const waitingCount = waitingByFloor.get(floor) || 0;
    const dropCount = dropByFloor.get(floor) || 0;

    if (waitingCount > 0) row.classList.add("has-calls");
    if (dropCount > 0) row.classList.add("has-drops");

    const label = document.createElement("div");
    label.className = "floor-label";
    label.textContent = `F${floor}`;

    const calls = document.createElement("div");
    calls.className = "floor-calls";

    for (let i = 0; i < waitingCount; i++) {
      const dot = document.createElement("span");
      dot.className = "call-dot";
      calls.appendChild(dot);
    }

    for (let i = 0; i < dropCount; i++) {
      const dot = document.createElement("span");
      dot.className = "drop-dot";
      calls.appendChild(dot);
    }

    const lane = document.createElement("div");
    lane.className = "elevator-lane";
    if (state.currentFloor === floor) {
      const car = document.createElement("div");
      car.className = "elevator-car";
      lane.appendChild(car);
    }

    row.append(label, calls, lane);
    ui.shaft.appendChild(row);
  }
}

function renderQueue(listEl, items, formatter) {
  listEl.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No entries";
    listEl.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    if (item.wait && item.wait > 13) {
      li.classList.add("warning");
    }
    listEl.appendChild(li);
  });
}

function render() {
  renderShaft();

  renderQueue(
    ui.waitingList,
    state.waiting,
    (req) => `#${req.id} · F${req.from} → F${req.to} · waiting ${req.wait}s`
  );

  renderQueue(
    ui.onboardList,
    state.onboard,
    (rider) => `#${rider.id} onboard · heading to F${rider.to}`
  );

  ui.time.textContent = `${state.timeLeft}s`;
  ui.score.textContent = String(state.score);
  ui.combo.textContent = `x${state.combo}`;
  ui.best.textContent = String(state.best);
  ui.load.textContent = `${state.onboard.length}/${CABIN_CAPACITY}`;

  const controlsLocked = !state.running;
  ui.upBtn.disabled = controlsLocked;
  ui.downBtn.disabled = controlsLocked;
  ui.openBtn.disabled = controlsLocked;

  ui.startBtn.disabled = state.running;
}

ui.startBtn.addEventListener("click", () => {
  if (state.timeLeft <= 0) {
    resetShift(true);
  } else {
    startShift();
  }
});

ui.restartBtn.addEventListener("click", () => {
  ensureAudio();
  resetShift(true);
});

ui.upBtn.addEventListener("click", () => moveLift(1));
ui.downBtn.addEventListener("click", () => moveLift(-1));
ui.openBtn.addEventListener("click", openDoors);

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", " "].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === "ArrowUp") {
    moveLift(1);
  } else if (event.key === "ArrowDown") {
    moveLift(-1);
  } else if (event.key === " ") {
    openDoors();
  }
});

render();
updateStatus("Press <strong>Start Shift</strong> to begin your watch.");
