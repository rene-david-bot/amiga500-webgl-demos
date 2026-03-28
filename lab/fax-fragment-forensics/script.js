const STRIP_COUNT = 6;
const CHUNK_WIDTH = 8;

const CASES = [
  {
    title: "Case 01 · Midnight Delivery",
    clue: "Clue: A courier rerouted crate 7B through Gate North at exactly 23:40.",
    lines: [
      "FAX LOG 23:40  NIGHT SHIFT ROUTE UPDATE",
      "COURIER ID 17   VERIFIED BY DESK OPERATOR",
      "CRATE 7B REROUTED TO GATE NORTH PLATFORM",
      "HOLD ELEVATOR C   SECURITY BADGE CHECKED",
      "NOTE   HANDLE FRAGILE PARTS BEFORE SUNRISE"
    ]
  },
  {
    title: "Case 02 · Arcade Revenue",
    clue: "Clue: Two cabinets overperformed after 21:00 and changed the payout plan.",
    lines: [
      "ARCADE AUDIT  WEEKEND TURNOVER SUMMARY",
      "CAB 04 ASTRO PINBALL PEAKED AFTER 2100",
      "CAB 11 TURBO KART SOLD OUT TOKEN BANK",
      "MOVE EXTRA FLOAT TO REGISTER B IMMEDIATELY",
      "MANAGER APPROVED BONUS RUN FOR CREW TEAM"
    ]
  },
  {
    title: "Case 03 · Signal Intercept",
    clue: "Clue: The emergency channel switched to backup frequency 142.6.",
    lines: [
      "SIGINT MEMO  REPEATER FAILURE DETECTED",
      "PRIMARY CHANNEL LOST PACKET LOCK 03:12",
      "SWITCH CREW TO BACKUP FREQ 142.6 NOW",
      "LOG ALL TRANSMISSIONS UNDER CODE PHOSPHOR",
      "REPORT RESTORED LINK BEFORE FIRST LIGHT"
    ]
  }
];

const ui = {
  board: document.getElementById("strip-board"),
  rebuild: document.getElementById("rebuild"),
  clue: document.getElementById("clue-text"),
  status: document.getElementById("status-text"),
  case: document.getElementById("stat-case"),
  moves: document.getElementById("stat-moves"),
  time: document.getElementById("stat-time"),
  best: document.getElementById("stat-best"),
  newBtn: document.getElementById("btn-new"),
  shuffleBtn: document.getElementById("btn-shuffle")
};

const state = {
  caseIndex: -1,
  strips: [],
  order: [],
  selectedSlot: null,
  moves: 0,
  elapsed: 0,
  solved: false,
  running: false,
  timer: null,
  best: Number(localStorage.getItem("retro.faxFragmentForensics.best") || 0)
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

function beep({ freq = 440, duration = 0.08, type = "square", gain = 0.04, slide = 1 }) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(90, freq * slide), now + duration);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playShuffle() {
  beep({ freq: 280, duration: 0.06, type: "triangle", gain: 0.03, slide: 1.2 });
  setTimeout(() => beep({ freq: 360, duration: 0.06, type: "triangle", gain: 0.03, slide: 1.15 }), 60);
}

function playSwap() {
  beep({ freq: 320, duration: 0.05, type: "square", gain: 0.04, slide: 1.18 });
}

function playSuccess() {
  const notes = [420, 520, 680, 860];
  notes.forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.1, type: "triangle", gain: 0.05, slide: 1.03 }), i * 85);
  });
}

function playError() {
  beep({ freq: 190, duration: 0.12, type: "sawtooth", gain: 0.04, slide: 0.8 });
}

function padLines(lines) {
  const width = STRIP_COUNT * CHUNK_WIDTH;
  return lines.map((line) => line.padEnd(width, " ").slice(0, width));
}

function buildStrips(lines) {
  const padded = padLines(lines);
  const strips = [];

  for (let stripIndex = 0; stripIndex < STRIP_COUNT; stripIndex++) {
    const start = stripIndex * CHUNK_WIDTH;
    const end = start + CHUNK_WIDTH;
    const text = padded.map((line) => line.slice(start, end)).join("\n");
    strips.push({ id: stripIndex, text });
  }

  return strips;
}

function rebuildText() {
  const lines = [];
  const stripLines = state.order.map((stripId) => state.strips[stripId].text.split("\n"));
  if (stripLines.length === 0) return "";

  for (let row = 0; row < stripLines[0].length; row++) {
    let line = "";
    for (let slot = 0; slot < stripLines.length; slot++) {
      line += stripLines[slot][row] || "";
    }
    lines.push(line.trimEnd());
  }

  return lines.join("\n");
}

function shuffleOrder() {
  const arr = [...Array(STRIP_COUNT).keys()];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // avoid solved order right after shuffle
  if (arr.every((value, idx) => value === idx)) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

function setStatus(message, tone = "") {
  ui.status.classList.remove("ok", "alert");
  if (tone) ui.status.classList.add(tone);
  ui.status.innerHTML = message;
}

function resetTimer() {
  clearInterval(state.timer);
  state.timer = null;
  state.elapsed = 0;
}

function startTimer() {
  if (state.timer) return;
  state.timer = setInterval(() => {
    if (!state.running || state.solved) return;
    state.elapsed += 1;
    renderStats();
  }, 1000);
}

function currentCase() {
  return CASES[state.caseIndex];
}

function newCase() {
  ensureAudio();

  state.caseIndex = (state.caseIndex + 1) % CASES.length;
  const data = currentCase();

  state.strips = buildStrips(data.lines);
  state.order = shuffleOrder();
  state.selectedSlot = null;
  state.moves = 0;
  state.solved = false;
  state.running = true;
  resetTimer();
  startTimer();

  ui.case.textContent = data.title;
  ui.clue.textContent = data.clue;

  setStatus("Case file loaded. Rebuild the fax before the trail goes cold.");
  playShuffle();
  render();
}

function reshuffle() {
  if (state.caseIndex < 0) return;
  ensureAudio();

  state.order = shuffleOrder();
  state.selectedSlot = null;
  state.moves += 2;
  setStatus("Shred tray jolted. Order randomized again (-2 precision points).", "alert");
  playError();
  render();
}

function swapSlots(a, b) {
  [state.order[a], state.order[b]] = [state.order[b], state.order[a]];
  state.moves += 1;
  playSwap();

  if (isSolved()) {
    state.solved = true;
    state.running = false;
    clearInterval(state.timer);
    state.timer = null;

    const score = Math.max(100, 1400 - state.moves * 35 - state.elapsed * 9);
    if (score > state.best) {
      state.best = score;
      localStorage.setItem("retro.faxFragmentForensics.best", String(score));
    }

    setStatus(`✅ Fax restored. Score <strong>${score}</strong> · ${state.moves} moves in ${state.elapsed}s.`, "ok");
    playSuccess();
  }

  render();
}

function isSolved() {
  return state.order.every((stripId, index) => stripId === index);
}

function handleStripClick(slotIndex) {
  if (!state.running || state.solved) return;
  ensureAudio();

  if (state.selectedSlot === null) {
    state.selectedSlot = slotIndex;
    renderBoard();
    return;
  }

  if (state.selectedSlot === slotIndex) {
    state.selectedSlot = null;
    renderBoard();
    return;
  }

  const first = state.selectedSlot;
  state.selectedSlot = null;
  swapSlots(first, slotIndex);
}

function renderBoard() {
  ui.board.innerHTML = "";

  state.order.forEach((stripId, slotIndex) => {
    const btn = document.createElement("button");
    btn.className = "strip";
    btn.type = "button";
    btn.textContent = state.strips[stripId].text;
    btn.title = `Strip ${slotIndex + 1}`;

    if (state.selectedSlot === slotIndex) {
      btn.classList.add("selected");
    }

    if (state.solved && stripId === slotIndex) {
      btn.classList.add("correct");
    }

    btn.addEventListener("click", () => handleStripClick(slotIndex));
    ui.board.appendChild(btn);
  });
}

function renderStats() {
  ui.moves.textContent = String(state.moves);
  ui.time.textContent = `${state.elapsed}s`;
  ui.best.textContent = String(state.best);
}

function render() {
  renderBoard();
  ui.rebuild.textContent = rebuildText();
  renderStats();
}

ui.newBtn.addEventListener("click", newCase);
ui.shuffleBtn.addEventListener("click", reshuffle);

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "n") {
    newCase();
  }
  if (event.key.toLowerCase() === "r") {
    reshuffle();
  }
});

ui.best.textContent = String(state.best);
