(() => {
  const canvas = document.getElementById("rackCanvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("startBtn");
  const checkBtn = document.getElementById("checkBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const muteBtn = document.getElementById("muteBtn");

  const timeEl = document.getElementById("timeValue");
  const roundEl = document.getElementById("roundValue");
  const scoreEl = document.getElementById("scoreValue");
  const streakEl = document.getElementById("streakValue");
  const correctEl = document.getElementById("correctValue");
  const bestEl = document.getElementById("bestValue");
  const statusEl = document.getElementById("status");

  const targetNameEl = document.getElementById("targetName");
  const targetDescEl = document.getElementById("targetDesc");
  const targetPinsEl = document.getElementById("targetPins");
  const pinButtonsEl = document.getElementById("pinButtons");
  const legendEl = document.getElementById("legend");

  const COLORS = [
    { key: "WG", label: "White/Green", hex: "#d6ffe3" },
    { key: "G", label: "Green", hex: "#33d56d" },
    { key: "WO", label: "White/Orange", hex: "#ffe6cd" },
    { key: "B", label: "Blue", hex: "#52a8ff" },
    { key: "WB", label: "White/Blue", hex: "#d9efff" },
    { key: "O", label: "Orange", hex: "#ff9d3c" },
    { key: "WBr", label: "White/Brown", hex: "#f1e0d2" },
    { key: "Br", label: "Brown", hex: "#9d6642" }
  ];

  const PATTERNS = [
    {
      name: "T568A Office",
      desc: "Legacy office cabling with voice/data split roots.",
      sequence: ["WG", "G", "WO", "B", "WB", "O", "WBr", "Br"]
    },
    {
      name: "T568B LAN Party",
      desc: "Most common patch order for late 90s Ethernet installs.",
      sequence: ["WO", "O", "WG", "B", "WB", "G", "WBr", "Br"]
    },
    {
      name: "Console Rollover",
      desc: "Fully mirrored order for old-school console cabling.",
      sequence: ["Br", "WBr", "G", "WB", "B", "WG", "O", "WO"]
    }
  ];

  const colorByKey = new Map(COLORS.map((color) => [color.key, color]));

  const state = {
    running: false,
    muted: false,
    transitioning: false,
    round: 0,
    score: 0,
    streak: 0,
    timer: 95,
    maxRounds: 8,
    best: Number(localStorage.getItem("retro.patchPanelPanic97.best") || 0),
    selectedPin: null,
    currentPattern: PATTERNS[0],
    pins: PATTERNS[0].sequence.slice(),
    lastFrame: 0
  };

  let audioCtx = null;

  function ensureAudio() {
    if (audioCtx || state.muted) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function beep(type = "tap") {
    if (state.muted) return;
    ensureAudio();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let start = 320;
    let end = 240;
    let dur = 0.08;
    let wave = "square";
    let vol = 0.05;

    if (type === "swap") {
      start = 390;
      end = 540;
      dur = 0.06;
      wave = "triangle";
    } else if (type === "good") {
      start = 420;
      end = 920;
      dur = 0.14;
      wave = "triangle";
      vol = 0.07;
    } else if (type === "bad") {
      start = 210;
      end = 120;
      dur = 0.2;
      wave = "sawtooth";
      vol = 0.07;
    } else if (type === "end") {
      start = 260;
      end = 90;
      dur = 0.3;
      wave = "triangle";
      vol = 0.08;
    }

    osc.type = wave;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.04);
  }

  function randomPattern(prevName = "") {
    const options = PATTERNS.filter((pattern) => pattern.name !== prevName);
    return options[Math.floor(Math.random() * options.length)] || PATTERNS[0];
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function isSolved() {
    return state.pins.every((key, i) => key === state.currentPattern.sequence[i]);
  }

  function countCorrect() {
    let n = 0;
    for (let i = 0; i < state.pins.length; i += 1) {
      if (state.pins[i] === state.currentPattern.sequence[i]) n += 1;
    }
    return n;
  }

  function scramblePins() {
    let attempt = shuffle(state.currentPattern.sequence);
    while (attempt.every((key, i) => key === state.currentPattern.sequence[i])) {
      attempt = shuffle(state.currentPattern.sequence);
    }
    state.pins = attempt;
  }

  function startRound(initial = false) {
    if (!initial) {
      state.round += 1;
    }

    state.currentPattern = randomPattern(state.currentPattern.name);
    scramblePins();
    state.selectedPin = null;
    state.transitioning = false;

    statusEl.textContent = `Ticket ${state.round}/${state.maxRounds}: Wire to ${state.currentPattern.name}.`;
    render();
  }

  function startShift() {
    ensureAudio();
    state.running = true;
    state.transitioning = false;
    state.round = 1;
    state.score = 0;
    state.streak = 0;
    state.timer = 95;
    state.selectedPin = null;
    state.currentPattern = randomPattern();
    scramblePins();
    state.lastFrame = performance.now();
    statusEl.textContent = `Shift live. Ticket 1/${state.maxRounds} loaded.`;
    render();
  }

  function endShift(reason) {
    state.running = false;
    state.transitioning = false;
    state.selectedPin = null;

    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("retro.patchPanelPanic97.best", String(state.best));
    }

    statusEl.textContent = `${reason} Final score ${state.score}. Press Start Shift for another run.`;
    beep("end");
    render();
  }

  function onPinClick(index) {
    if (!state.running || state.transitioning) return;

    if (state.selectedPin === null) {
      state.selectedPin = index;
      beep("tap");
      render();
      return;
    }

    if (state.selectedPin === index) {
      state.selectedPin = null;
      render();
      return;
    }

    const other = state.selectedPin;
    [state.pins[other], state.pins[index]] = [state.pins[index], state.pins[other]];
    state.selectedPin = null;
    beep("swap");
    render();
  }

  function testCrimp() {
    if (!state.running || state.transitioning) return;

    const correct = countCorrect();
    if (correct === 8) {
      const bonus = 180 + Math.floor(state.timer * 2) + state.streak * 35;
      state.score += bonus;
      state.streak += 1;
      state.timer = Math.min(120, state.timer + 7);
      state.transitioning = true;

      if (state.round >= state.maxRounds) {
        statusEl.textContent = `Perfect lock! +${bonus} points. All tickets cleared.`;
        beep("good");
        render();
        setTimeout(() => endShift("Rack stabilized."), 900);
        return;
      }

      statusEl.textContent = `Perfect crimp! +${bonus} points. Loading next ticket...`;
      beep("good");
      render();

      setTimeout(() => {
        if (!state.running) return;
        state.round += 1;
        startRound(true);
      }, 850);
      return;
    }

    const penalty = (8 - correct) * 11;
    state.score = Math.max(0, state.score - penalty);
    state.streak = 0;
    statusEl.textContent = `${correct}/8 pins correct. Signal failed, -${penalty} points. Rewire and retest.`;
    beep("bad");
    render();
  }

  function shuffleLeads() {
    if (!state.running || state.transitioning) return;
    state.pins = shuffle(state.pins);
    state.selectedPin = null;
    state.score = Math.max(0, state.score - 15);
    statusEl.textContent = "Leads reshuffled (-15 score).";
    beep("tap");
    render();
  }

  function renderTarget() {
    targetNameEl.textContent = state.currentPattern.name;
    targetDescEl.textContent = state.currentPattern.desc;

    targetPinsEl.innerHTML = "";
    state.currentPattern.sequence.forEach((key, i) => {
      const chip = document.createElement("div");
      chip.className = "target-chip";
      const color = colorByKey.get(key);
      chip.innerHTML = `<strong>Pin ${i + 1}</strong>${color.label}`;
      targetPinsEl.appendChild(chip);
    });
  }

  function renderPins() {
    pinButtonsEl.innerHTML = "";
    const correctNow = countCorrect();

    state.pins.forEach((key, i) => {
      const color = colorByKey.get(key);
      const expected = state.currentPattern.sequence[i];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pin-btn";
      if (state.selectedPin === i) btn.classList.add("selected");
      if (key === expected) btn.classList.add("good");

      btn.innerHTML = `
        <span class="left">
          <span class="pin-no">Pin ${i + 1}</span>
          <span class="swatch" style="background:${color.hex}"></span>
          <span>${color.label}</span>
        </span>
        <span>${key === expected ? "LOCK" : "SWAP"}</span>
      `;

      btn.addEventListener("click", () => onPinClick(i));
      pinButtonsEl.appendChild(btn);
    });

    correctEl.textContent = `${correctNow}/8`;
  }

  function renderLegend() {
    legendEl.innerHTML = "";
    COLORS.forEach((color) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `<span class="swatch" style="background:${color.hex}"></span>${color.label}`;
      legendEl.appendChild(item);
    });
  }

  function drawBackground(now) {
    const w = canvas.width;
    const h = canvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#081126");
    grad.addColorStop(1, "#04070f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(100, 140, 230, 0.1)";
    for (let y = 24; y < h; y += 28) {
      ctx.fillRect(0, y, w, 1);
    }

    const glow = 0.13 + Math.sin(now * 0.002) * 0.04;
    ctx.fillStyle = `rgba(124, 236, 255, ${glow.toFixed(3)})`;
    ctx.fillRect(20, 24, w - 40, 16);

    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  function drawRack(now) {
    const w = canvas.width;
    const h = canvas.height;

    const topY = 90;
    const bottomY = 370;
    const sourceXs = [];
    const pinXs = [];

    for (let i = 0; i < 8; i += 1) {
      sourceXs.push(120 + i * 95);
      pinXs.push(130 + i * 90);
    }

    ctx.fillStyle = "#17223f";
    ctx.fillRect(82, 40, 738, 70);
    ctx.strokeStyle = "rgba(140,168,245,0.65)";
    ctx.strokeRect(82.5, 40.5, 737, 69);

    ctx.fillStyle = "#1f2e56";
    ctx.fillRect(72, 360, 758, 110);
    ctx.strokeStyle = "rgba(161,186,255,0.72)";
    ctx.strokeRect(72.5, 360.5, 757, 109);

    COLORS.forEach((color, sourceIndex) => {
      const sx = sourceXs[sourceIndex];
      const pinIndex = state.pins.indexOf(color.key);
      const tx = pinXs[pinIndex >= 0 ? pinIndex : sourceIndex];
      const sway = Math.sin(now * 0.0017 + sourceIndex * 0.9) * 12;

      ctx.strokeStyle = color.hex;
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, topY);
      ctx.bezierCurveTo(
        sx + sway,
        170,
        tx - sway,
        290,
        tx,
        bottomY
      );
      ctx.stroke();

      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 2, topY);
      ctx.bezierCurveTo(
        sx + sway + 2,
        170,
        tx - sway + 2,
        290,
        tx + 2,
        bottomY
      );
      ctx.stroke();

      ctx.fillStyle = color.hex;
      ctx.fillRect(sx - 12, topY - 16, 24, 12);
      ctx.fillRect(tx - 13, bottomY, 26, 16);
    });

    ctx.fillStyle = "#dce7ff";
    ctx.font = "700 16px 'Trebuchet MS', sans-serif";
    ctx.fillText("Patch Source", 92, 30);
    ctx.fillText("RJ45 Connector", 92, 350);

    ctx.font = "600 14px 'Trebuchet MS', sans-serif";
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = "#b9caf6";
      ctx.fillText(String(i + 1), pinXs[i] - 4, 407);
    }

    if (!state.running) {
      ctx.fillStyle = "rgba(5, 10, 22, 0.72)";
      ctx.fillRect(180, 188, 540, 120);
      ctx.strokeStyle = "rgba(255, 214, 128, 0.86)";
      ctx.strokeRect(180.5, 188.5, 539, 119);

      ctx.fillStyle = "#ffeab5";
      ctx.font = "700 34px 'Trebuchet MS', sans-serif";
      ctx.fillText("Patch Panel Panic '97", 232, 242);
      ctx.fillStyle = "#dfe7ff";
      ctx.font = "600 18px 'Trebuchet MS', sans-serif";
      ctx.fillText("Swap pin rows, match the target standard, clear all tickets.", 203, 273);
    }
  }

  function renderHud() {
    timeEl.textContent = Math.max(0, Math.ceil(state.timer));
    roundEl.textContent = state.running ? `${state.round}/${state.maxRounds}` : "0";
    scoreEl.textContent = state.score;
    streakEl.textContent = state.streak;
    bestEl.textContent = state.best;
    muteBtn.textContent = `Sound: ${state.muted ? "Off" : "On"}`;
  }

  function render() {
    renderHud();
    renderTarget();
    renderPins();
  }

  function tick(now) {
    if (!state.lastFrame) state.lastFrame = now;
    const dt = Math.min(0.033, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    if (state.running && !state.transitioning) {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.timer = 0;
        endShift("Rack timer expired.");
      }
    }

    drawBackground(now);
    drawRack(now);
    renderHud();

    requestAnimationFrame(tick);
  }

  startBtn.addEventListener("click", startShift);
  checkBtn.addEventListener("click", testCrimp);
  shuffleBtn.addEventListener("click", shuffleLeads);
  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    if (!state.muted) {
      ensureAudio();
      beep("tap");
    }
    renderHud();
  });

  renderLegend();
  render();
  requestAnimationFrame(tick);
})();
