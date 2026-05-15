(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("startBtn");
  const muteBtn = document.getElementById("muteBtn");
  const statusEl = document.getElementById("status");
  const orderListEl = document.getElementById("orderList");

  const timeEl = document.getElementById("timeValue");
  const scoreEl = document.getElementById("scoreValue");
  const comboEl = document.getElementById("comboValue");
  const livesEl = document.getElementById("livesValue");
  const bestEl = document.getElementById("bestValue");

  const W = canvas.width;
  const H = canvas.height;
  const laneY = [170, 280, 390];
  const serviceX = 360;
  const serviceWindow = 42;
  const roundDuration = 60;

  const dishes = [
    { type: "salmon", label: "Salmon Nigiri", color: "#ff7b6e", rim: "#ffc3bc", points: 90 },
    { type: "tuna", label: "Tuna Roll", color: "#f04e7f", rim: "#ff9db8", points: 100 },
    { type: "egg", label: "Tamago", color: "#ffd95e", rim: "#fff3ae", points: 85 },
    { type: "shrimp", label: "Shrimp Bite", color: "#ffaf7a", rim: "#ffd7bf", points: 110 },
    { type: "cucumber", label: "Cucumber Maki", color: "#68de90", rim: "#b4f5ca", points: 95 }
  ];

  const keyToLane = {
    Digit1: 0,
    Digit2: 1,
    Digit3: 2,
    KeyQ: 0,
    KeyW: 1,
    KeyE: 2
  };

  const state = {
    running: false,
    muted: false,
    plates: [],
    particles: [],
    queue: [],
    score: 0,
    combo: 0,
    lives: 5,
    best: Number(localStorage.getItem("retro.sushiShift.best") || 0),
    timeLeft: roundDuration,
    startedAt: 0,
    lastSpawn: 0,
    lastTick: 0,
    message: "Press Start Shift to open service.",
    flash: 0
  };

  let audioCtx = null;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pickDish() {
    return dishes[Math.floor(Math.random() * dishes.length)];
  }

  function ensureQueue() {
    while (state.queue.length < 4) {
      state.queue.push(pickDish().type);
    }
  }

  function findDish(type) {
    return dishes.find((dish) => dish.type === type) || dishes[0];
  }

  function spawnPlate(forceLane = null, forceType = null) {
    const lane = forceLane ?? Math.floor(Math.random() * laneY.length);
    const type = forceType ?? pickDish().type;
    state.plates.push({
      lane,
      type,
      x: W + rand(40, 240),
      speed: rand(125, 195),
      wobble: rand(0, Math.PI * 2)
    });
  }

  function resetRound() {
    state.running = true;
    state.plates = [];
    state.particles = [];
    state.queue = [];
    state.score = 0;
    state.combo = 0;
    state.lives = 5;
    state.timeLeft = roundDuration;
    state.startedAt = performance.now();
    state.lastSpawn = 0;
    state.lastTick = 0;
    state.message = "Rush open. Match the first order in queue.";
    state.flash = 0;

    ensureQueue();
    for (let i = 0; i < 8; i++) {
      const lane = i % 3;
      spawnPlate(lane, pickDish().type);
    }
    updateHud();
    renderQueue();
  }

  function endRound(reason) {
    state.running = false;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("retro.sushiShift.best", String(state.best));
    }
    state.message = `${reason} Shift closed. Final score: ${state.score}.`;
    statusEl.textContent = state.message;
    bestEl.textContent = state.best;
    playTone("end");
  }

  function updateHud() {
    timeEl.textContent = Math.max(0, Math.ceil(state.timeLeft));
    scoreEl.textContent = state.score;
    comboEl.textContent = state.combo;
    livesEl.textContent = state.lives;
    bestEl.textContent = state.best;
    statusEl.textContent = state.message;
  }

  function renderQueue() {
    orderListEl.innerHTML = "";
    state.queue.slice(0, 4).forEach((type, index) => {
      const dish = findDish(type);
      const li = document.createElement("li");
      li.textContent = `${dish.label}${index === 0 ? "  ← serve now" : ""}`;
      if (index === 0) {
        li.style.color = "#ffd767";
        li.style.fontWeight = "700";
      }
      orderListEl.appendChild(li);
    });
  }

  function loseLife(text) {
    state.lives = Math.max(0, state.lives - 1);
    state.combo = 0;
    state.flash = 0.9;
    state.message = text;
    playTone("miss");
    if (state.lives <= 0) {
      endRound("Counter overload");
    }
  }

  function makeBurst(x, y, color) {
    for (let i = 0; i < 16; i++) {
      state.particles.push({
        x,
        y,
        vx: rand(-130, 130),
        vy: rand(-120, 100),
        life: rand(0.3, 0.75),
        age: 0,
        color
      });
    }
  }

  function attemptServe(lane) {
    if (!state.running) {
      return;
    }

    const zoneCandidates = state.plates
      .filter((plate) => plate.lane === lane && Math.abs(plate.x - serviceX) <= serviceWindow)
      .sort((a, b) => Math.abs(a.x - serviceX) - Math.abs(b.x - serviceX));

    if (!zoneCandidates.length) {
      loseLife("No plate in service window on that lane.");
      updateHud();
      return;
    }

    const picked = zoneCandidates[0];
    const targetType = state.queue[0];

    if (picked.type !== targetType) {
      loseLife(`Wrong dish. Needed ${findDish(targetType).label}.`);
      makeBurst(picked.x, laneY[picked.lane], "#ff789b");
      picked.x = -999;
      updateHud();
      return;
    }

    const dish = findDish(picked.type);
    state.combo += 1;
    const comboBonus = Math.min(220, state.combo * 14);
    state.score += dish.points + comboBonus;
    state.message = `${dish.label} served. Combo x${state.combo}.`;
    state.flash = 0;
    playTone("serve");
    makeBurst(picked.x, laneY[picked.lane], dish.color);

    picked.x = -999;
    state.queue.shift();
    ensureQueue();
    renderQueue();
    updateHud();
  }

  function ensureAudio() {
    if (audioCtx || state.muted) {
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return;
    }
    audioCtx = new Ctx();
  }

  function playTone(kind) {
    if (state.muted) {
      return;
    }
    ensureAudio();
    if (!audioCtx) {
      return;
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let startFreq = 420;
    let endFreq = 330;
    let duration = 0.08;
    let type = "square";
    let volume = 0.05;

    if (kind === "serve") {
      startFreq = 520;
      endFreq = 830;
      duration = 0.11;
      type = "triangle";
      volume = 0.06;
    } else if (kind === "miss") {
      startFreq = 210;
      endFreq = 130;
      duration = 0.16;
      type = "sawtooth";
      volume = 0.07;
    } else if (kind === "tick") {
      startFreq = 460;
      endFreq = 420;
      duration = 0.03;
      type = "square";
      volume = 0.028;
    } else if (kind === "end") {
      startFreq = 340;
      endFreq = 180;
      duration = 0.28;
      type = "triangle";
      volume = 0.07;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function drawBackdrop(nowSec) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a1226");
    grad.addColorStop(1, "#04070f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const glow = 0.24 + Math.sin(nowSec * 1.7) * 0.08;
    ctx.fillStyle = `rgba(90, 240, 255, ${glow.toFixed(3)})`;
    ctx.fillRect(0, 92, W, 8);

    for (let i = 0; i < laneY.length; i++) {
      const y = laneY[i];
      const beltGrad = ctx.createLinearGradient(0, y - 42, 0, y + 42);
      beltGrad.addColorStop(0, "#152347");
      beltGrad.addColorStop(1, "#0d1731");
      ctx.fillStyle = beltGrad;
      ctx.fillRect(30, y - 40, W - 60, 80);

      const stripeOffset = ((nowSec * 170) % 28);
      for (let x = 36 - stripeOffset; x < W - 60; x += 28) {
        ctx.fillStyle = "rgba(120, 153, 235, 0.26)";
        ctx.fillRect(x, y - 30, 12, 60);
      }
    }

    ctx.strokeStyle = "rgba(255, 215, 103, 0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(serviceX - serviceWindow, 118, serviceWindow * 2, 332);
    ctx.fillStyle = "rgba(255, 215, 103, 0.12)";
    ctx.fillRect(serviceX - serviceWindow, 118, serviceWindow * 2, 332);

    ctx.fillStyle = "#ffe8a2";
    ctx.font = "700 18px 'Trebuchet MS', sans-serif";
    ctx.fillText("SERVICE WINDOW", serviceX - 77, 108);

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 70, 110, ${Math.min(0.5, state.flash * 0.55)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPlate(plate, nowSec) {
    const y = laneY[plate.lane];
    const dish = findDish(plate.type);
    const bob = Math.sin(nowSec * 4 + plate.wobble) * 1.6;
    const x = plate.x;

    ctx.save();
    ctx.translate(x, y + bob);

    ctx.fillStyle = "#0e162e";
    ctx.beginPath();
    ctx.ellipse(0, 12, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dish.rim;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dish.color;
    ctx.beginPath();
    ctx.ellipse(0, -2, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.44)";
    ctx.beginPath();
    ctx.ellipse(-7, -4, 8, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles(dt) {
    const next = [];
    for (const p of state.particles) {
      p.age += dt;
      if (p.age >= p.life) {
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      const alpha = 1 - p.age / p.life;
      ctx.fillStyle = `${p.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.fillRect(p.x, p.y, 4, 4);
      next.push(p);
    }
    state.particles = next;
  }

  function drawHudOverlay() {
    ctx.fillStyle = "rgba(6, 10, 20, 0.75)";
    ctx.fillRect(30, 24, 288, 76);
    ctx.strokeStyle = "rgba(101, 145, 236, 0.7)";
    ctx.strokeRect(30, 24, 288, 76);

    ctx.fillStyle = "#dce4ff";
    ctx.font = "700 20px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Score ${state.score}`, 44, 52);
    ctx.fillText(`Combo x${state.combo}`, 44, 80);

    ctx.fillStyle = "#ffe39b";
    ctx.font = "700 17px 'Trebuchet MS', sans-serif";
    const nextDish = findDish(state.queue[0] || dishes[0].type);
    ctx.fillText(`Now: ${nextDish.label}`, 340, 52);

    ctx.fillStyle = "#9ce3ff";
    ctx.fillText(`Time ${Math.max(0, Math.ceil(state.timeLeft))}s`, 340, 80);
  }

  function animate(now) {
    const nowSec = now / 1000;
    if (!state.lastTick) {
      state.lastTick = now;
    }
    const dt = Math.min(0.033, (now - state.lastTick) / 1000);
    state.lastTick = now;

    if (state.running) {
      state.timeLeft = roundDuration - (now - state.startedAt) / 1000;

      const spawnEvery = Math.max(0.34, 0.84 - (roundDuration - state.timeLeft) * 0.006);
      if (nowSec - state.lastSpawn >= spawnEvery) {
        state.lastSpawn = nowSec;
        spawnPlate();
      }

      state.plates = state.plates.filter((plate) => {
        plate.x -= plate.speed * dt;
        if (plate.x < -60) {
          if (Math.random() < 0.22) {
            loseLife("Plate drifted away. Customer walked out.");
          }
          return false;
        }
        return true;
      });

      if (state.timeLeft <= 0) {
        endRound("Closing bell");
      }

      if (state.flash > 0) {
        state.flash = Math.max(0, state.flash - dt * 1.6);
      }

      if (Math.floor(state.timeLeft * 2) !== Math.floor((state.timeLeft + dt) * 2)) {
        playTone("tick");
      }

      updateHud();
    }

    drawBackdrop(nowSec);

    state.plates.sort((a, b) => a.lane - b.lane || a.x - b.x);
    state.plates.forEach((plate) => drawPlate(plate, nowSec));

    drawParticles(dt);
    drawHudOverlay();

    if (!state.running) {
      ctx.fillStyle = "rgba(6, 11, 21, 0.72)";
      ctx.fillRect(262, 196, 436, 150);
      ctx.strokeStyle = "rgba(255, 215, 103, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(262, 196, 436, 150);

      ctx.fillStyle = "#ffe9ad";
      ctx.font = "700 33px 'Trebuchet MS', sans-serif";
      ctx.fillText("Conveyor Sushi Shift", 307, 248);

      ctx.fillStyle = "#d5defd";
      ctx.font = "600 19px 'Trebuchet MS', sans-serif";
      ctx.fillText("Press Start Shift, then serve with lane keys.", 300, 285);
      ctx.fillText("Match the first order in queue for combo points.", 286, 314);
    }

    requestAnimationFrame(animate);
  }

  document.addEventListener("keydown", (event) => {
    const lane = keyToLane[event.code];
    if (lane === undefined) {
      return;
    }
    event.preventDefault();
    attemptServe(lane);
  });

  startBtn.addEventListener("click", () => {
    ensureAudio();
    resetRound();
  });

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    muteBtn.textContent = `Sound: ${state.muted ? "Off" : "On"}`;
    if (!state.muted) {
      ensureAudio();
      playTone("serve");
    }
  });

  bestEl.textContent = state.best;
  ensureQueue();
  renderQueue();
  updateHud();
  requestAnimationFrame(animate);
})();
