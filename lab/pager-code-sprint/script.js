const ui = {
  start: document.getElementById("btn-start"),
  restart: document.getElementById("btn-restart"),
  status: document.getElementById("status-text"),
  time: document.getElementById("stat-time"),
  score: document.getElementById("stat-score"),
  combo: document.getElementById("stat-combo"),
  solved: document.getElementById("stat-solved"),
  best: document.getElementById("stat-best"),
  code: document.getElementById("pager-code"),
  prompt: document.getElementById("pager-prompt"),
  choices: document.getElementById("choices"),
  feed: document.getElementById("traffic-feed"),
  pager: document.getElementById("pager-shell"),
  signal: document.getElementById("signal-bars")
};

const STORAGE_KEY = "retro.pagerCodeSprint.best";
const ROUND_TIME = 75;
const MAX_TIME = 95;

const wordBank = [
  "RETRO", "PIXEL", "LASER", "ARCADE", "NEON", "TURBO", "GROOVE", "MAGNET", "ROBOT", "QUARTZ",
  "VECTOR", "RADAR", "CIRCUIT", "CABINET", "ROCKET", "TUNNEL", "FLARE", "COSMIC", "MODULE", "BINARY",
  "PHASER", "SIGNAL", "REMOTE", "NEXUS", "ALPHA", "GAMMA", "DELTA", "ORBIT", "KIOSK", "SHIFT",
  "SPRITE", "BLASTER", "RACER", "PRINTER", "FLOPPY", "MEMORY", "NIGHT", "PLAYER", "SYNTH", "AURORA",
  "DYNAMO", "JACKPOT", "MEGABYTE", "GLITCH", "MOSAIC", "SYSTEM", "ACTIVE", "RHYTHM", "PAGER", "DECODE",
  "SPARK", "TRACK", "STATUS", "VECTOR", "BEACON", "SCREEN", "CABLING", "CARTRIDGE", "CASSETTE", "BUTTON",
  "CONTROL", "PROTOCOL", "PROGRAM", "SPECTRUM", "CRYSTAL", "RELAY", "DISPLAY", "NETWORK", "MISSION", "GADGET"
];

const t9 = {
  A: "2", B: "2", C: "2",
  D: "3", E: "3", F: "3",
  G: "4", H: "4", I: "4",
  J: "5", K: "5", L: "5",
  M: "6", N: "6", O: "6",
  P: "7", Q: "7", R: "7", S: "7",
  T: "8", U: "8", V: "8",
  W: "9", X: "9", Y: "9", Z: "9"
};

const state = {
  running: false,
  timeLeft: ROUND_TIME,
  score: 0,
  combo: 0,
  solved: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  lastWord: "",
  currentWord: "",
  currentCode: "",
  lastTick: 0,
  roundLock: false,
  feedItems: []
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

function beep({ freq = 440, duration = 0.09, type = "square", gain = 0.05, slide = 1 }) {
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

function playStart() {
  [420, 560, 740].forEach((n, i) => {
    setTimeout(() => beep({ freq: n, duration: 0.08, type: "triangle", gain: 0.045, slide: 1.06 }), i * 70);
  });
}

function playCorrect() {
  beep({ freq: 760, duration: 0.06, type: "square", gain: 0.04, slide: 1.14 });
  setTimeout(() => beep({ freq: 980, duration: 0.06, type: "triangle", gain: 0.036, slide: 1.08 }), 50);
}

function playWrong() {
  beep({ freq: 230, duration: 0.13, type: "sawtooth", gain: 0.045, slide: 0.72 });
}

function playEnd() {
  [660, 530, 440].forEach((n, i) => {
    setTimeout(() => beep({ freq: n, duration: 0.1, type: "triangle", gain: 0.04, slide: 0.96 }), i * 85);
  });
}

function setStatus(text, tone = "") {
  ui.status.classList.remove("ok", "alert");
  if (tone) ui.status.classList.add(tone);
  ui.status.innerHTML = text;
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickWord() {
  const candidates = wordBank.filter((w) => w !== state.lastWord);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function encode(word) {
  return word
    .split("")
    .map((c) => t9[c] || "")
    .join("");
}

function getDistractors(targetWord, targetCode) {
  const sameLength = wordBank.filter((w) => w.length === targetWord.length && w !== targetWord);
  const closeCode = sameLength.filter((w) => {
    const code = encode(w);
    let overlap = 0;
    for (let i = 0; i < Math.min(code.length, targetCode.length); i++) {
      if (code[i] === targetCode[i]) overlap += 1;
    }
    return overlap >= Math.max(1, Math.floor(targetCode.length * 0.35));
  });

  const source = closeCode.length >= 3 ? closeCode : sameLength;
  return shuffle(source).slice(0, 3);
}

function pushFeed(line) {
  state.feedItems.unshift(line);
  state.feedItems = state.feedItems.slice(0, 6);
  ui.feed.innerHTML = state.feedItems.map((item) => `<li>${item}</li>`).join("");
}

function renderChoices(options) {
  ui.choices.innerHTML = "";
  options.forEach((word, idx) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.innerHTML = `<small>${idx + 1}</small>${word}`;
    button.dataset.word = word;
    button.addEventListener("click", () => handleChoice(button, word));
    ui.choices.appendChild(button);
  });
}

function flashSignal() {
  const bars = ["▮▯▯", "▮▮▯", "▮▮▮"];
  let i = 0;
  const pulse = setInterval(() => {
    ui.signal.textContent = bars[i % bars.length];
    i += 1;
    if (i > 4) {
      clearInterval(pulse);
      ui.signal.textContent = "▮▮▮";
    }
  }, 80);
}

function nextRound() {
  if (!state.running) return;

  state.roundLock = false;
  const word = pickWord();
  const code = encode(word);
  const distractors = getDistractors(word, code);
  const options = shuffle([word, ...distractors]);

  state.currentWord = word;
  state.currentCode = code;
  state.lastWord = word;

  ui.code.textContent = code;
  ui.prompt.textContent = "Decode this burst and route it now.";
  renderChoices(options);
  flashSignal();
}

function handleChoice(button, selectedWord) {
  if (!state.running || state.roundLock) return;
  state.roundLock = true;

  const isCorrect = selectedWord === state.currentWord;

  if (isCorrect) {
    state.combo += 1;
    state.solved += 1;

    const gain = 90 + state.combo * 24 + Math.floor(Math.min(25, state.timeLeft * 0.35));
    state.score += gain;
    state.timeLeft = Math.min(MAX_TIME, state.timeLeft + 1.8);

    button.classList.add("good");
    setStatus(`Clean decode: <strong>${state.currentCode} → ${state.currentWord}</strong> (+${gain})`, "ok");
    pushFeed(`✔ ${state.currentCode} decoded as ${state.currentWord} (combo x${state.combo})`);
    playCorrect();
  } else {
    state.combo = 0;
    state.timeLeft = Math.max(0, state.timeLeft - 5.5);

    button.classList.add("bad");
    const rightButton = [...ui.choices.children].find((node) => node.dataset.word === state.currentWord);
    if (rightButton) rightButton.classList.add("good");

    setStatus(`Misroute. <strong>${state.currentCode}</strong> was <strong>${state.currentWord}</strong> (−5.5s).`, "alert");
    pushFeed(`✖ ${state.currentCode} misread as ${selectedWord}; correct was ${state.currentWord}`);
    playWrong();
  }

  renderStats();

  if (state.timeLeft <= 0) {
    endGame();
    return;
  }

  setTimeout(() => {
    nextRound();
  }, 380);
}

function renderStats() {
  ui.time.textContent = `${state.timeLeft.toFixed(1)}s`;
  ui.score.textContent = String(Math.floor(state.score));
  ui.combo.textContent = `x${state.combo}`;
  ui.solved.textContent = String(state.solved);
  ui.best.textContent = String(state.best);
}

function startGame() {
  ensureAudio();

  state.running = true;
  state.timeLeft = ROUND_TIME;
  state.score = 0;
  state.combo = 0;
  state.solved = 0;
  state.lastWord = "";
  state.feedItems = [];
  state.lastTick = 0;
  state.roundLock = false;

  ui.feed.innerHTML = "";
  ui.pager.classList.add("active");
  setStatus("Pager online. Decode fast and build a streak.");
  renderStats();
  nextRound();
  playStart();
}

function endGame() {
  if (!state.running) return;

  state.running = false;
  ui.pager.classList.remove("active");
  ui.code.textContent = "----";
  ui.prompt.textContent = "Shift complete.";

  const finalScore = Math.floor(state.score);
  if (finalScore > state.best) {
    state.best = finalScore;
    localStorage.setItem(STORAGE_KEY, String(finalScore));
  }

  setStatus(`Shift over. Final score <strong>${finalScore}</strong> with <strong>${state.solved}</strong> clean decodes.`, "ok");
  pushFeed(`☑ Shift closed at ${finalScore} points.`);
  playEnd();
  renderStats();
}

function loop(ts) {
  if (!state.lastTick) state.lastTick = ts;
  const dt = Math.min(0.05, (ts - state.lastTick) / 1000);
  state.lastTick = ts;

  if (state.running) {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      endGame();
    }
    renderStats();
  }

  requestAnimationFrame(loop);
}

ui.start.addEventListener("click", startGame);
ui.restart.addEventListener("click", () => {
  startGame();
});

window.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !state.running) {
    event.preventDefault();
    startGame();
    return;
  }

  const index = Number(event.key) - 1;
  if (index >= 0 && index <= 3 && state.running) {
    const button = ui.choices.children[index];
    if (button) {
      button.click();
    }
  }
});

renderStats();
requestAnimationFrame(loop);
