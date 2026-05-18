(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("startBtn");
  const muteBtn = document.getElementById("muteBtn");
  const statusEl = document.getElementById("status");
  const fareStatusEl = document.getElementById("fareStatus");

  const timeEl = document.getElementById("timeValue");
  const fuelEl = document.getElementById("fuelValue");
  const scoreEl = document.getElementById("scoreValue");
  const streakEl = document.getElementById("streakValue");
  const faresEl = document.getElementById("faresValue");
  const bestEl = document.getElementById("bestValue");

  const W = canvas.width;
  const H = canvas.height;

  const shiftDuration = 75;
  const roadWidth = 58;
  const streetX = [120, 300, 480, 660, 840];
  const streetY = [90, 210, 330, 450];

  const zones = ["ARCADE", "PIER", "TOWER", "MALL", "STATION", "CLUB", "LOUNGE", "PLAZA"];

  const state = {
    running: false,
    muted: false,
    keys: new Set(),
    timeLeft: shiftDuration,
    fuel: 100,
    score: 0,
    streak: 0,
    fares: 0,
    best: Number(localStorage.getItem("retro.taxiMeterMayhem.best") || 0),
    startedAt: 0,
    lastTick: 0,
    status: "Press Start Shift to clock in.",
    fareText: "No rider onboard. Grab the glowing pickup.",
    taxi: {
      x: 120,
      y: 90,
      size: 22,
      speed: 205,
      carrying: false
    },
    traffic: [],
    activeFare: null,
    pickupSpots: [],
    fuelCan: null,
    nextFuelSpawn: 10,
    hitCooldown: 0,
    flashRed: 0,
    particles: []
  };

  let audioCtx = null;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function buildBlocks() {
    const blocks = [];
    for (let cx = 0; cx < streetX.length - 1; cx += 1) {
      for (let cy = 0; cy < streetY.length - 1; cy += 1) {
        const x = streetX[cx] + roadWidth * 0.5 + 10;
        const y = streetY[cy] + roadWidth * 0.5 + 10;
        const w = streetX[cx + 1] - streetX[cx] - roadWidth - 20;
        const h = streetY[cy + 1] - streetY[cy] - roadWidth - 20;
        blocks.push({ x, y, w, h });
      }
    }
    return blocks;
  }

  const buildings = buildBlocks();

  function buildPickupSpots() {
    const points = [];
    for (const x of streetX) {
      for (const y of streetY) {
        points.push({ x, y });
      }
    }
    return points;
  }

  function randomSpot(avoid = null) {
    const options = state.pickupSpots.filter((spot) => {
      if (!avoid) {
        return true;
      }
      const dx = spot.x - avoid.x;
      const dy = spot.y - avoid.y;
      return Math.hypot(dx, dy) > 180;
    });
    const pool = options.length ? options : state.pickupSpots;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawnFare() {
    const pickup = randomSpot();
    const dropoff = randomSpot(pickup);
    const zone = zones[Math.floor(Math.random() * zones.length)];
    state.activeFare = {
      pickup: { ...pickup },
      dropoff: { ...dropoff },
      zone,
      carrying: false,
      pulse: rand(0, Math.PI * 2)
    };
    state.fareText = `Pickup ready. Rider wants ${zone}.`;
  }

  function spawnFuelCan() {
    const spot = randomSpot(state.taxi);
    state.fuelCan = {
      x: spot.x,
      y: spot.y,
      ttl: 12,
      pulse: rand(0, Math.PI * 2)
    };
  }

  function spawnTraffic() {
    state.traffic = [];

    for (const y of streetY) {
      for (let i = 0; i < 2; i += 1) {
        const dir = i % 2 === 0 ? 1 : -1;
        state.traffic.push({
          x: dir === 1 ? rand(-260, W - 40) : rand(80, W + 260),
          y,
          w: 34,
          h: 18,
          vx: rand(95, 160) * dir,
          vy: 0,
          color: dir === 1 ? "#69dcff" : "#ff83c7"
        });
      }
    }

    for (const x of streetX) {
      for (let i = 0; i < 2; i += 1) {
        const dir = i % 2 === 0 ? 1 : -1;
        state.traffic.push({
          x,
          y: dir === 1 ? rand(-220, H - 30) : rand(70, H + 220),
          w: 18,
          h: 34,
          vx: 0,
          vy: rand(92, 155) * dir,
          color: dir === 1 ? "#ffd979" : "#91ff9d"
        });
      }
    }
  }

  function resetRound() {
    state.running = true;
    state.timeLeft = shiftDuration;
    state.fuel = 100;
    state.score = 0;
    state.streak = 0;
    state.fares = 0;
    state.startedAt = performance.now();
    state.lastTick = 0;
    state.hitCooldown = 0;
    state.flashRed = 0;
    state.particles = [];
    state.pickupSpots = buildPickupSpots();
    state.taxi = {
      x: 120,
      y: 90,
      size: 22,
      speed: 205,
      carrying: false
    };
    state.fuelCan = null;
    state.nextFuelSpawn = rand(8, 13);
    state.status = "Meter live. Pick up and deliver fast for streak bonus.";

    spawnTraffic();
    spawnFare();
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

  function beep(kind) {
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

    let start = 360;
    let end = 220;
    let dur = 0.08;
    let type = "square";
    let volume = 0.05;

    if (kind === "pickup") {
      start = 430;
      end = 620;
      dur = 0.09;
      type = "triangle";
      volume = 0.06;
    } else if (kind === "drop") {
      start = 520;
      end = 880;
      dur = 0.14;
      type = "triangle";
      volume = 0.07;
    } else if (kind === "hit") {
      start = 180;
      end = 110;
      dur = 0.18;
      type = "sawtooth";
      volume = 0.08;
    } else if (kind === "fuel") {
      start = 350;
      end = 520;
      dur = 0.1;
      type = "square";
      volume = 0.055;
    } else if (kind === "end") {
      start = 250;
      end = 90;
      dur = 0.3;
      type = "triangle";
      volume = 0.07;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + dur);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  function taxiBox(x = state.taxi.x, y = state.taxi.y) {
    const s = state.taxi.size;
    return { x: x - s * 0.5, y: y - s * 0.5, w: s, h: s };
  }

  function boxesOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function collidesBuildings(x, y) {
    const box = taxiBox(x, y);
    return buildings.some((b) => boxesOverlap(box, b));
  }

  function moveTaxi(dt) {
    let dx = 0;
    let dy = 0;

    if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) dy -= 1;
    if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) dy += 1;
    if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) dx -= 1;
    if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) dx += 1;

    if (dx === 0 && dy === 0) {
      return;
    }

    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const speed = state.taxi.speed;

    let nextX = clamp(state.taxi.x + dx * speed * dt, 24, W - 24);
    if (!collidesBuildings(nextX, state.taxi.y)) {
      state.taxi.x = nextX;
    }

    let nextY = clamp(state.taxi.y + dy * speed * dt, 24, H - 24);
    if (!collidesBuildings(state.taxi.x, nextY)) {
      state.taxi.y = nextY;
    }
  }

  function spawnBurst(x, y, rgb, count = 14) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y,
        vx: rand(-140, 140),
        vy: rand(-130, 120),
        life: rand(0.28, 0.72),
        age: 0,
        rgb
      });
    }
  }

  function deliverFare() {
    const timeBonus = Math.floor(Math.max(0, state.timeLeft) * 2.2);
    const streakBonus = state.streak * 35;
    const fareValue = 140 + timeBonus + streakBonus;

    state.score += fareValue;
    state.fares += 1;
    state.streak += 1;
    state.fuel = Math.min(100, state.fuel + 8);
    state.status = `Fare delivered +${fareValue}. Keep the streak alive.`;
    state.fareText = "Drop complete. New rider pinging now.";

    spawnBurst(state.taxi.x, state.taxi.y, "255,215,121", 20);
    beep("drop");

    spawnFare();
  }

  function checkFareProgress() {
    if (!state.activeFare) {
      return;
    }

    const taxi = state.taxi;
    const fare = state.activeFare;

    if (!fare.carrying) {
      const dPickup = Math.hypot(taxi.x - fare.pickup.x, taxi.y - fare.pickup.y);
      if (dPickup <= 24) {
        fare.carrying = true;
        taxi.carrying = true;
        state.fareText = `Rider onboard. Destination: ${fare.zone}.`;
        state.status = `Passenger seated for ${fare.zone}.`;
        spawnBurst(fare.pickup.x, fare.pickup.y, "126,244,255");
        beep("pickup");
      }
      return;
    }

    const dDrop = Math.hypot(taxi.x - fare.dropoff.x, taxi.y - fare.dropoff.y);
    if (dDrop <= 24) {
      taxi.carrying = false;
      deliverFare();
    }
  }

  function updateFuelCan(dt) {
    if (state.fuelCan) {
      state.fuelCan.ttl -= dt;
      if (state.fuelCan.ttl <= 0) {
        state.fuelCan = null;
      } else {
        const d = Math.hypot(state.taxi.x - state.fuelCan.x, state.taxi.y - state.fuelCan.y);
        if (d <= 22) {
          state.fuel = Math.min(100, state.fuel + 28);
          state.status = "Fuel can secured. Tank topped up.";
          spawnBurst(state.fuelCan.x, state.fuelCan.y, "145,255,157", 18);
          state.fuelCan = null;
          beep("fuel");
        }
      }
    }

    if (!state.fuelCan && state.timeLeft <= state.nextFuelSpawn) {
      spawnFuelCan();
      state.nextFuelSpawn = Math.max(6, state.timeLeft - rand(10, 15));
    }
  }

  function updateTraffic(dt) {
    for (const car of state.traffic) {
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      if (car.vx > 0 && car.x > W + 80) car.x = -80;
      if (car.vx < 0 && car.x < -80) car.x = W + 80;
      if (car.vy > 0 && car.y > H + 80) car.y = -80;
      if (car.vy < 0 && car.y < -80) car.y = H + 80;
    }
  }

  function checkTrafficCollision(dt) {
    if (state.hitCooldown > 0) {
      state.hitCooldown = Math.max(0, state.hitCooldown - dt);
      return;
    }

    const cab = taxiBox();
    for (const car of state.traffic) {
      const carBox = {
        x: car.x - car.w * 0.5,
        y: car.y - car.h * 0.5,
        w: car.w,
        h: car.h
      };
      if (!boxesOverlap(cab, carBox)) {
        continue;
      }

      state.hitCooldown = 1.15;
      state.flashRed = 0.9;
      state.streak = 0;
      state.score = Math.max(0, state.score - 70);
      state.fuel = Math.max(0, state.fuel - 14);
      state.status = "Traffic hit. Meter reset and fuel spilled.";
      state.fareText = state.activeFare?.carrying
        ? `Rider still onboard. Get them to ${state.activeFare.zone}.`
        : "No rider onboard. Grab the glowing pickup.";

      state.taxi.x = clamp(state.taxi.x - Math.sign(car.vx || rand(-1, 1)) * 18, 24, W - 24);
      state.taxi.y = clamp(state.taxi.y - Math.sign(car.vy || rand(-1, 1)) * 18, 24, H - 24);

      spawnBurst(state.taxi.x, state.taxi.y, "255,121,153", 20);
      beep("hit");
      break;
    }
  }

  function updateParticles(dt) {
    const next = [];
    for (const p of state.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      next.push(p);
    }
    state.particles = next;
  }

  function endRound(reason) {
    state.running = false;
    state.status = `${reason} Shift over. Final score ${state.score}.`;
    state.fareText = "Clocked out. Press Start Shift for another run.";

    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("retro.taxiMeterMayhem.best", String(state.best));
    }

    beep("end");
    updateHud();
  }

  function updateGame(dt, nowSec) {
    moveTaxi(dt);
    updateTraffic(dt);
    checkTrafficCollision(dt);
    checkFareProgress();
    updateFuelCan(dt);
    updateParticles(dt);

    state.fuel = Math.max(0, state.fuel - dt * 0.62);
    state.timeLeft = shiftDuration - (performance.now() - state.startedAt) / 1000;

    if (state.flashRed > 0) {
      state.flashRed = Math.max(0, state.flashRed - dt * 1.7);
    }

    if (state.fuel <= 0) {
      endRound("Out of fuel");
    } else if (state.timeLeft <= 0) {
      endRound("Meter expired");
    }

    if (state.activeFare) {
      state.activeFare.pulse += dt * 4;
    }
    if (state.fuelCan) {
      state.fuelCan.pulse += dt * 3.7;
    }

    updateHud();
  }

  function drawBackdrop(nowSec) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0a1022");
    grad.addColorStop(1, "#060a15");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#1a2342";
    for (const y of streetY) {
      ctx.fillRect(0, y - roadWidth * 0.5, W, roadWidth);
    }
    for (const x of streetX) {
      ctx.fillRect(x - roadWidth * 0.5, 0, roadWidth, H);
    }

    const stripeShift = (nowSec * 110) % 32;
    ctx.fillStyle = "rgba(175, 194, 246, 0.34)";
    for (const y of streetY) {
      for (let x = -32 + stripeShift; x < W; x += 32) {
        ctx.fillRect(x, y - 2, 14, 4);
      }
    }
    for (const x of streetX) {
      for (let y = -32 + stripeShift; y < H; y += 32) {
        ctx.fillRect(x - 2, y, 4, 14);
      }
    }

    ctx.fillStyle = "#0f162d";
    for (const b of buildings) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(129, 157, 235, 0.35)";
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

      const windowRows = Math.max(2, Math.floor(b.h / 28));
      const windowCols = Math.max(2, Math.floor(b.w / 28));
      for (let r = 0; r < windowRows; r += 1) {
        for (let c = 0; c < windowCols; c += 1) {
          if ((r + c) % 2 !== 0) continue;
          const wx = b.x + 8 + c * 24;
          const wy = b.y + 8 + r * 24;
          ctx.fillStyle = "rgba(255, 221, 133, 0.16)";
          ctx.fillRect(wx, wy, 10, 6);
        }
      }
    }

    ctx.fillStyle = "rgba(126, 244, 255, 0.22)";
    ctx.fillRect(0, 0, W, 4);

    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    for (let y = 0; y < H; y += 3) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  function drawFareMarkers() {
    if (!state.activeFare) return;

    const fare = state.activeFare;

    if (!fare.carrying) {
      const r = 14 + Math.sin(fare.pulse) * 2;
      ctx.strokeStyle = "#7ef4ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fare.pickup.x, fare.pickup.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#7ef4ff";
      ctx.font = "700 14px 'Trebuchet MS', sans-serif";
      ctx.fillText("P", fare.pickup.x - 5, fare.pickup.y + 5);

      ctx.fillStyle = "rgba(255, 121, 205, 0.35)";
      ctx.beginPath();
      ctx.arc(fare.dropoff.x, fare.dropoff.y, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = 15 + Math.sin(fare.pulse) * 2;
      ctx.strokeStyle = "#ff79cd";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fare.dropoff.x, fare.dropoff.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ffd979";
      ctx.font = "700 14px 'Trebuchet MS', sans-serif";
      ctx.fillText("D", fare.dropoff.x - 5, fare.dropoff.y + 5);

      ctx.strokeStyle = "rgba(255, 217, 121, 0.5)";
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(state.taxi.x, state.taxi.y);
      ctx.lineTo(fare.dropoff.x, fare.dropoff.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawFuelCan() {
    if (!state.fuelCan) return;

    const c = state.fuelCan;
    const glow = 0.5 + Math.sin(c.pulse) * 0.2;

    ctx.fillStyle = `rgba(145, 255, 157, ${glow})`;
    ctx.fillRect(c.x - 10, c.y - 10, 20, 20);
    ctx.strokeStyle = "#96ff9f";
    ctx.strokeRect(c.x - 10, c.y - 10, 20, 20);

    ctx.fillStyle = "#0b1a0f";
    ctx.fillRect(c.x - 4, c.y - 6, 8, 12);
  }

  function drawTraffic() {
    for (const car of state.traffic) {
      ctx.save();
      ctx.translate(car.x, car.y);

      ctx.fillStyle = "rgba(3, 7, 16, 0.42)";
      ctx.fillRect(-car.w * 0.5, car.h * 0.45, car.w, 5);

      ctx.fillStyle = car.color;
      ctx.fillRect(-car.w * 0.5, -car.h * 0.5, car.w, car.h);

      ctx.fillStyle = "rgba(255,255,255,0.42)";
      if (car.w > car.h) {
        ctx.fillRect(-car.w * 0.3, -car.h * 0.25, car.w * 0.6, car.h * 0.2);
      } else {
        ctx.fillRect(-car.w * 0.25, -car.h * 0.3, car.w * 0.5, car.h * 0.22);
      }

      ctx.restore();
    }
  }

  function drawTaxi() {
    const t = state.taxi;

    ctx.save();
    ctx.translate(t.x, t.y);

    ctx.fillStyle = "rgba(0, 0, 0, 0.36)";
    ctx.fillRect(-13, 13, 26, 6);

    ctx.fillStyle = "#ffd44c";
    ctx.fillRect(-12, -12, 24, 24);

    ctx.fillStyle = "#1b222f";
    ctx.fillRect(-11, -2, 22, 5);

    ctx.fillStyle = "#a3e1ff";
    ctx.fillRect(-8, -10, 16, 6);

    if (t.carrying) {
      ctx.fillStyle = "#ff79cd";
      ctx.fillRect(-4, -16, 8, 4);
    }

    ctx.restore();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = 1 - p.age / p.life;
      ctx.fillStyle = `rgba(${p.rgb}, ${alpha.toFixed(3)})`;
      ctx.fillRect(p.x, p.y, 4, 4);
    }
  }

  function drawOverlay() {
    ctx.fillStyle = "rgba(7, 10, 20, 0.68)";
    ctx.fillRect(24, 18, 300, 84);
    ctx.strokeStyle = "rgba(126, 180, 255, 0.7)";
    ctx.strokeRect(24.5, 18.5, 299, 83);

    ctx.fillStyle = "#e4ebff";
    ctx.font = "700 20px 'Trebuchet MS', sans-serif";
    ctx.fillText(`$${state.score}`, 40, 48);

    ctx.fillStyle = "#ffd979";
    ctx.font = "700 16px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Fuel ${Math.round(state.fuel)}%`, 40, 74);

    ctx.fillStyle = "#9ee7ff";
    ctx.fillText(`Time ${Math.max(0, Math.ceil(state.timeLeft))}s`, 170, 74);

    ctx.fillStyle = "#ff9ed8";
    ctx.fillText(`Streak x${state.streak}`, 170, 48);

    if (state.flashRed > 0) {
      ctx.fillStyle = `rgba(255, 80, 114, ${Math.min(0.45, state.flashRed * 0.52)})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (!state.running) {
      ctx.fillStyle = "rgba(6, 12, 22, 0.78)";
      ctx.fillRect(258, 202, 446, 138);
      ctx.strokeStyle = "rgba(255, 217, 121, 0.8)";
      ctx.strokeRect(258.5, 202.5, 445, 137);

      ctx.fillStyle = "#ffeab0";
      ctx.font = "700 34px 'Trebuchet MS', sans-serif";
      ctx.fillText("Taxi Meter Mayhem", 316, 252);

      ctx.fillStyle = "#dce4ff";
      ctx.font = "600 18px 'Trebuchet MS', sans-serif";
      ctx.fillText("Start shift, pick up fares, avoid traffic, beat your best.", 286, 286);
      ctx.fillText("Fuel cans keep you alive. High streaks print huge fares.", 292, 314);
    }
  }

  function updateHud() {
    timeEl.textContent = Math.max(0, Math.ceil(state.timeLeft));
    fuelEl.textContent = `${Math.max(0, Math.round(state.fuel))}%`;
    scoreEl.textContent = state.score;
    streakEl.textContent = state.streak;
    faresEl.textContent = state.fares;
    bestEl.textContent = state.best;
    statusEl.textContent = state.status;
    fareStatusEl.textContent = state.fareText;
  }

  function animate(now) {
    if (!state.lastTick) {
      state.lastTick = now;
    }
    const dt = Math.min(0.033, (now - state.lastTick) / 1000);
    state.lastTick = now;
    const nowSec = now / 1000;

    if (state.running) {
      updateGame(dt, nowSec);
    } else {
      updateParticles(dt);
    }

    drawBackdrop(nowSec);
    drawFareMarkers();
    drawFuelCan();
    drawTraffic();
    drawTaxi();
    drawParticles();
    drawOverlay();

    requestAnimationFrame(animate);
  }

  document.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      event.preventDefault();
      state.keys.add(event.code);
    }
  });

  document.addEventListener("keyup", (event) => {
    state.keys.delete(event.code);
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
      beep("pickup");
    }
  });

  bestEl.textContent = state.best;
  updateHud();
  requestAnimationFrame(animate);
})();
