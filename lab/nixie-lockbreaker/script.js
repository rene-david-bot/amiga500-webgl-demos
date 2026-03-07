const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 8;
const ROUND_SECONDS = 180;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7"];

const state = {
  secret: [],
  input: [],
  attemptsUsed: 0,
  remainingSeconds: ROUND_SECONDS,
  gameOver: false,
  timerId: null
};

const el = {
  attempts: document.getElementById("attempts"),
  timer: document.getElementById("timer"),
  status: document.getElementById("status"),
  best: document.getElementById("best"),
  hint: document.getElementById("hint"),
  tubeRow: document.getElementById("tube-row"),
  digitGrid: document.getElementById("digit-grid"),
  clear: document.getElementById("clear"),
  backspace: document.getElementById("backspace"),
  submit: document.getElementById("submit"),
  logBody: document.getElementById("log-body"),
  newRun: document.getElementById("new-run")
};

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq = 640, ms = 80, type = "square", gain = 0.028) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);

    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    // Audio is optional.
  }
}

function randDigit() {
  return DIGITS[Math.floor(Math.random() * DIGITS.length)];
}

function buildSecret() {
  return Array.from({ length: CODE_LENGTH }, () => randDigit());
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function getBest() {
  return JSON.parse(localStorage.getItem("nixie-lockbreaker-best") || "null");
}

function saveBest(payload) {
  localStorage.setItem("nixie-lockbreaker-best", JSON.stringify(payload));
}

function updateBestLabel() {
  const best = getBest();
  if (!best) {
    el.best.textContent = "—";
    return;
  }
  el.best.textContent = `${best.attempts} tries · ${best.time}s`;
}

function updateTubes() {
  const tubes = [...el.tubeRow.children];
  tubes.forEach((tube, idx) => {
    tube.textContent = state.input[idx] ?? "_";
    tube.classList.toggle("active", idx === state.input.length && state.input.length < CODE_LENGTH);
  });
}

function updateHud() {
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - state.attemptsUsed);
  el.attempts.textContent = `${attemptsLeft} left`;
  el.timer.textContent = formatTime(state.remainingSeconds);

  if (state.gameOver) return;

  if (attemptsLeft <= 2 || state.remainingSeconds <= 30) {
    el.status.textContent = "Critical";
    el.status.className = "bad";
  } else {
    el.status.textContent = "Armed";
    el.status.className = "good";
  }
}

function setHint(text, mood = "normal") {
  el.hint.textContent = text;
  el.hint.classList.remove("good", "bad");
  if (mood === "good") el.hint.classList.add("good");
  if (mood === "bad") el.hint.classList.add("bad");
}

function appendLog(guess, exact, near) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${state.attemptsUsed}</td>
    <td>${guess.join("")}</td>
    <td>${exact}</td>
    <td>${near}</td>
  `;
  el.logBody.prepend(row);
}

function evaluateGuess(secret, guess) {
  let exact = 0;
  const secretCounts = {};
  const guessCounts = {};

  for (let i = 0; i < CODE_LENGTH; i += 1) {
    if (guess[i] === secret[i]) {
      exact += 1;
    } else {
      secretCounts[secret[i]] = (secretCounts[secret[i]] || 0) + 1;
      guessCounts[guess[i]] = (guessCounts[guess[i]] || 0) + 1;
    }
  }

  let near = 0;
  for (const digit of Object.keys(guessCounts)) {
    near += Math.min(guessCounts[digit], secretCounts[digit] || 0);
  }

  return { exact, near };
}

function endRound(win) {
  state.gameOver = true;
  clearInterval(state.timerId);
  state.timerId = null;

  const submitDisabled = true;
  el.submit.disabled = submitDisabled;
  el.clear.disabled = submitDisabled;
  el.backspace.disabled = submitDisabled;
  [...el.digitGrid.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = submitDisabled;
  });

  if (win) {
    const used = state.attemptsUsed;
    const elapsed = ROUND_SECONDS - state.remainingSeconds;
    const best = getBest();
    const better = !best || used < best.attempts || (used === best.attempts && elapsed < best.time);
    if (better) {
      saveBest({ attempts: used, time: elapsed });
      updateBestLabel();
    }

    el.status.textContent = "Unlocked";
    el.status.className = "good";
    setHint(`Vault cracked in ${used} tries.`, "good");
    beep(880, 120, "triangle");
    setTimeout(() => beep(1175, 120, "triangle"), 120);
  } else {
    el.status.textContent = "Locked";
    el.status.className = "bad";
    setHint(`Access denied. Code was ${state.secret.join("")}.`, "bad");
    beep(240, 210, "sawtooth", 0.032);
  }
}

function submitGuess() {
  if (state.gameOver) return;
  if (state.input.length < CODE_LENGTH) {
    setHint("Need 4 digits before submit.", "bad");
    beep(230, 100, "sawtooth", 0.02);
    return;
  }

  const guess = [...state.input];
  const { exact, near } = evaluateGuess(state.secret, guess);
  state.attemptsUsed += 1;
  appendLog(guess, exact, near);
  state.input = [];
  updateTubes();
  updateHud();

  if (exact === CODE_LENGTH) {
    endRound(true);
    return;
  }

  const attemptsLeft = MAX_ATTEMPTS - state.attemptsUsed;
  setHint(`No lock yet. Exact ${exact}, Near ${near}.`, attemptsLeft <= 2 ? "bad" : "normal");
  beep(480, 85, "square", 0.024);

  if (attemptsLeft <= 0) {
    endRound(false);
  }
}

function pushDigit(digit) {
  if (state.gameOver || state.input.length >= CODE_LENGTH) return;
  state.input.push(digit);
  updateTubes();
  setHint("Signal buffered. Submit when ready.");
  beep(620 + Number(digit) * 30, 60);
}

function clearInput() {
  if (state.gameOver) return;
  state.input = [];
  updateTubes();
  setHint("Input cleared.");
  beep(350, 70, "triangle", 0.02);
}

function backspaceInput() {
  if (state.gameOver || state.input.length === 0) return;
  state.input.pop();
  updateTubes();
  setHint("Removed last digit.");
  beep(300, 65, "triangle", 0.02);
}

function tick() {
  if (state.gameOver) return;
  state.remainingSeconds -= 1;
  updateHud();

  if (state.remainingSeconds <= 0) {
    state.remainingSeconds = 0;
    updateHud();
    endRound(false);
  }
}

function bindEvents() {
  el.submit.addEventListener("click", submitGuess);
  el.clear.addEventListener("click", clearInput);
  el.backspace.addEventListener("click", backspaceInput);
  el.newRun.addEventListener("click", init);

  el.digitGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-digit]");
    if (!button) return;
    pushDigit(button.dataset.digit);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key >= "0" && event.key <= "7") {
      pushDigit(event.key);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      backspaceInput();
      return;
    }

    if (event.key === "Escape") {
      clearInput();
      return;
    }

    if (event.key === "Enter") {
      submitGuess();
    }
  });
}

function renderDigitButtons() {
  el.digitGrid.innerHTML = DIGITS.map((digit) => (
    `<button data-digit="${digit}" aria-label="Digit ${digit}">${digit}</button>`
  )).join("");
}

function init() {
  clearInterval(state.timerId);
  state.secret = buildSecret();
  state.input = [];
  state.attemptsUsed = 0;
  state.remainingSeconds = ROUND_SECONDS;
  state.gameOver = false;
  el.logBody.innerHTML = "";

  el.submit.disabled = false;
  el.clear.disabled = false;
  el.backspace.disabled = false;
  [...el.digitGrid.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = false;
  });

  updateTubes();
  updateHud();
  setHint("Enter 4 digits (0–7), then submit.");

  state.timerId = setInterval(tick, 1000);
}

renderDigitButtons();
updateBestLabel();
bindEvents();
init();
