const KEY_LAYOUT = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""]
];

const DTMF = {
  "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
  "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
  "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
  "*": [941, 1209], "0": [941, 1336], "#": [941, 1477]
};

const state = {
  running: false,
  score: 0,
  streak: 0,
  lives: 3,
  time: 45,
  currentKey: null,
  timerId: null,
  ctx: null,
  master: null
};

const el = {
  keypad: document.getElementById("keypad"),
  start: document.getElementById("start"),
  replay: document.getElementById("replay"),
  prompt: document.getElementById("prompt"),
  score: document.getElementById("score"),
  streak: document.getElementById("streak"),
  lives: document.getElementById("lives"),
  time: document.getElementById("time"),
  history: document.getElementById("history")
};

function initAudio() {
  if (state.ctx) return;
  state.ctx = new (window.AudioContext || window.webkitAudioContext)();
  state.master = state.ctx.createGain();
  state.master.gain.value = 0.22;
  state.master.connect(state.ctx.destination);
}

function blip(freq, duration = 0.45) {
  const osc = state.ctx.createOscillator();
  const gain = state.ctx.createGain();
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, state.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, state.ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, state.ctx.currentTime + duration);
  osc.connect(gain).connect(state.master);
  osc.start();
  osc.stop(state.ctx.currentTime + duration + 0.02);
}

function playTone(key, duration = 0.55) {
  if (!state.ctx) return;
  const [f1, f2] = DTMF[key];
  [f1, f2].forEach((f) => blip(f, duration));
}

function beep(ok = true) {
  if (!state.ctx) return;
  const osc = state.ctx.createOscillator();
  const gain = state.ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = ok ? 980 : 180;
  gain.gain.setValueAtTime(0.0001, state.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, state.ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, state.ctx.currentTime + 0.15);
  osc.connect(gain).connect(state.master);
  osc.start();
  osc.stop(state.ctx.currentTime + 0.16);
}

function pickNext() {
  const keys = Object.keys(DTMF);
  state.currentKey = keys[Math.floor(Math.random() * keys.length)];
  el.prompt.textContent = "Incoming tone... identify the key.";
  playTone(state.currentKey);
}

function updateHud() {
  el.score.textContent = String(state.score);
  el.streak.textContent = String(state.streak);
  el.lives.textContent = String(state.lives);
  el.time.textContent = String(state.time);
}

function appendLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  el.history.prepend(item);
  while (el.history.children.length > 6) {
    el.history.removeChild(el.history.lastChild);
  }
}

function flashButton(key, className) {
  const btn = el.keypad.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (!btn) return;
  btn.classList.add(className);
  setTimeout(() => btn.classList.remove(className), 220);
}

function answer(key) {
  if (!state.running || !state.currentKey) return;

  if (key === state.currentKey) {
    state.streak += 1;
    const bonus = 10 * Math.min(state.streak, 6);
    state.score += 100 + bonus;
    beep(true);
    flashButton(key, "correct");
    appendLog(`✓ ${key} matched (+${100 + bonus})`);
  } else {
    state.streak = 0;
    state.lives -= 1;
    state.score = Math.max(0, state.score - 40);
    beep(false);
    flashButton(key, "wrong");
    appendLog(`✗ picked ${key}, tone was ${state.currentKey}`);
  }

  updateHud();

  if (state.lives <= 0) {
    endGame("Line dropped — all operator lives lost.");
    return;
  }

  state.currentKey = null;
  setTimeout(() => {
    if (state.running) pickNext();
  }, 380);
}

function endGame(reason) {
  state.running = false;
  clearInterval(state.timerId);
  el.replay.disabled = true;
  el.start.disabled = false;
  el.start.textContent = "Start Shift";
  const rank = state.score >= 2200 ? "Elite Operator" : state.score >= 1300 ? "Senior Operator" : "Trainee";
  el.prompt.innerHTML = `${reason} Final score: <strong>${state.score}</strong> · ${rank}.`;
}

function tick() {
  state.time -= 1;
  updateHud();
  if (state.time <= 0) {
    endGame("Shift complete.");
  }
}

function startGame() {
  initAudio();
  state.ctx.resume();

  state.running = true;
  state.score = 0;
  state.streak = 0;
  state.lives = 3;
  state.time = 45;
  state.currentKey = null;
  el.history.innerHTML = "";

  el.start.disabled = true;
  el.replay.disabled = false;
  el.start.textContent = "Running";

  updateHud();
  pickNext();
  clearInterval(state.timerId);
  state.timerId = setInterval(tick, 1000);
}

function buildPad() {
  const fragment = document.createDocumentFragment();

  KEY_LAYOUT.forEach(([key, letters]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.key = key;
    btn.innerHTML = `${key}${letters ? `<small>${letters}</small>` : ""}`;
    btn.addEventListener("click", () => answer(key));
    fragment.appendChild(btn);
  });

  el.keypad.appendChild(fragment);
}

document.addEventListener("keydown", (event) => {
  const key = event.key;
  if (/^[0-9]$/.test(key)) {
    answer(key);
  } else if (key === "*" || key === "#") {
    answer(key);
  }
});

el.start.addEventListener("click", startGame);
el.replay.addEventListener("click", () => {
  if (state.running && state.currentKey) playTone(state.currentKey);
});

buildPad();
updateHud();
