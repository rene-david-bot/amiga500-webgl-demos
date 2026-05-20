(() => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const soundBtn = document.getElementById("soundBtn");
  const leftBtn = document.getElementById("leftBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const rightBtn = document.getElementById("rightBtn");

  const scoreEl = document.getElementById("scoreValue");
  const bestEl = document.getElementById("bestValue");
  const comboEl = document.getElementById("comboValue");
  const speedEl = document.getElementById("speedValue");
  const statusEl = document.getElementById("status");

  const W = canvas.width;
  const H = canvas.height;

  const keys = {
    left: false,
    right: false,
    jumpQueued: false
  };

  const stars = Array.from({ length: 110 }, () => ({
    x: Math.random() * W,
    y: Math.random() * (H * 0.62),
    r: Math.random() * 1.6 + 0.3,
    phase: Math.random() * Math.PI * 2
  }));

  const bestStorageKey = "retro.rooftopRelay92.best";

  const state = {
    running: false,
    paused: false,
    muted: false,
    score: 0,
    best: Number(localStorage.getItem(bestStorageKey) || 0),
    combo: 1,
    comboCooldown: 0,
    speed: 220,
    elapsed: 0,
    distance: 0,
    message: "Press Start Run, then use left/right and Space (or tap buttons) to keep the courier moving.",
    lastTs: 0
  };

  const world = {
    platforms: [],
    hazards: [],
    disks: []
  };

  const player = {
    x: 180,
    y: 0,
    w: 38,
    h: 52,
    vx: 0,
    vy: 0,
    onGround: false,
    color: "#7fe8ff"
  };

  const skyLayers = [
    makeSkylineLayer(32, 44, 116, 36, 108, "#0f1938", "#3f5da7"),
    makeSkylineLayer(28, 70, 148, 70, 170, "#17264f", "#6892ff")
  ];

  let audioCtx = null;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeSkylineLayer(count, minW, maxW, minH, maxH, base, glow) {
    const blocks = [];
    let total = 0;
    for (let i = 0; i < count; i += 1) {
      const w = Math.floor(rand(minW, maxW));
      const h = Math.floor(rand(minH, maxH));
      const gap = Math.floor(rand(8, 20));
      blocks.push({ w, h, gap, base, glow });
      total += w + gap;
    }
    return { blocks, total };
  }

  function ensureAudio() {
    if (audioCtx || state.muted) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function playTone(type = "jump") {
    if (state.muted) return;
    ensureAudio();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let start = 330;
    let end = 220;
    let dur = 0.08;
    let wave = "square";
    let vol = 0.05;

    if (type === "coin") {
      start = 560;
      end = 980;
      dur = 0.11;
      wave = "triangle";
      vol = 0.06;
    } else if (type === "land") {
      start = 220;
      end = 250;
      dur = 0.06;
      wave = "square";
      vol = 0.03;
    } else if (type === "crash") {
      start = 200;
      end = 90;
      dur = 0.22;
      wave = "sawtooth";
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

  function resetWorld() {
    world.platforms = [];
    world.hazards = [];
    world.disks = [];

    const first = { x: -240, y: 428, w: 520, h: 18, visited: true };
    world.platforms.push(first);

    while (world.platforms[world.platforms.length - 1].x + world.platforms[world.platforms.length - 1].w < W + 700) {
      spawnPlatform();
    }

    player.x = 170;
    player.y = first.y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
  }

  function spawnPlatform() {
    const prev = world.platforms[world.platforms.length - 1];
    const gap = rand(95, 175);
    const width = rand(150, 305);
    const y = clamp(prev.y + rand(-80, 80), 250, 458);
    const platform = {
      x: prev.x + prev.w + gap,
      y,
      w: width,
      h: 18,
      visited: false
    };

    world.platforms.push(platform);

    if (Math.random() < 0.42 && width > 170) {
      world.hazards.push({
        x: platform.x + rand(26, width - 26),
        y: platform.y - 30,
        w: 22,
        h: 30
      });
    }

    if (Math.random() < 0.63) {
      world.disks.push({
        x: platform.x + rand(26, width - 26),
        y: platform.y - rand(26, 54),
        r: 10,
        taken: false
      });
    }
  }

  function startRun() {
    ensureAudio();
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.combo = 1;
    state.comboCooldown = 0;
    state.speed = 220;
    state.elapsed = 0;
    state.distance = 0;
    state.message = "Courier online. Keep moving.";

    resetWorld();
    updateHUD();
  }

  function endRun(message) {
    state.running = false;
    state.paused = false;
    state.message = `${message} Final score ${Math.floor(state.score)}.`;

    if (state.score > state.best) {
      state.best = Math.floor(state.score);
      localStorage.setItem(bestStorageKey, String(state.best));
    }

    playTone("crash");
    updateHUD();
  }

  function intersects(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function circleRectHit(circle, rect) {
    const nx = clamp(circle.x, rect.x, rect.x + rect.w);
    const ny = clamp(circle.y, rect.y, rect.y + rect.h);
    const dx = circle.x - nx;
    const dy = circle.y - ny;
    return dx * dx + dy * dy <= circle.r * circle.r;
  }

  function queueJump() {
    keys.jumpQueued = true;
  }

  function handleJump() {
    if (keys.jumpQueued && player.onGround) {
      player.vy = -760;
      player.onGround = false;
      playTone("jump");
      state.comboCooldown = Math.max(state.comboCooldown, 1.4);
    }
    keys.jumpQueued = false;
  }

  function update(dt) {
    state.elapsed += dt;

    if (!state.running || state.paused) return;

    state.speed = 220 + Math.min(250, state.elapsed * 5.2);
    state.distance += state.speed * dt;
    state.score += state.speed * dt * 0.23;

    state.comboCooldown -= dt;
    if (state.comboCooldown <= 0 && state.combo > 1) {
      state.combo -= 1;
      state.comboCooldown = 1.6;
    }

    const scroll = state.speed * dt;
    world.platforms.forEach((p) => {
      p.x -= scroll;
    });
    world.hazards.forEach((h) => {
      h.x -= scroll;
    });
    world.disks.forEach((d) => {
      d.x -= scroll;
    });

    const targetVx = (keys.right ? 205 : 0) - (keys.left ? 205 : 0);
    player.vx += (targetVx - player.vx) * Math.min(1, dt * 10);
    player.x += player.vx * dt;
    player.x = clamp(player.x, 95, 470);

    handleJump();

    const prevBottom = player.y + player.h;
    player.vy += 1880 * dt;
    player.y += player.vy * dt;

    player.onGround = false;

    for (const platform of world.platforms) {
      const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
      const crossedTop = prevBottom <= platform.y + 6 && player.y + player.h >= platform.y;
      if (overlapX && crossedTop && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;

        if (!platform.visited) {
          platform.visited = true;
          state.score += 28 * state.combo;
          state.combo = Math.min(10, state.combo + 1);
          state.comboCooldown = 2.3;
          playTone("land");
        }
        break;
      }
    }

    const playerRect = { x: player.x + 5, y: player.y + 4, w: player.w - 10, h: player.h - 6 };

    for (const hazard of world.hazards) {
      if (intersects(playerRect, hazard)) {
        endRun("Antenna hit.");
        return;
      }
    }

    for (const disk of world.disks) {
      if (disk.taken) continue;
      if (circleRectHit(disk, playerRect)) {
        disk.taken = true;
        const gain = 120 + state.combo * 26;
        state.score += gain;
        state.combo = Math.min(12, state.combo + 1);
        state.comboCooldown = 3.2;
        playTone("coin");
      }
    }

    if (player.y > H + 130) {
      endRun("You missed the roofline.");
      return;
    }

    world.platforms = world.platforms.filter((p) => p.x + p.w > -120);
    world.hazards = world.hazards.filter((h) => h.x + h.w > -120);
    world.disks = world.disks.filter((d) => !d.taken && d.x + d.r > -80);

    while (world.platforms.length && world.platforms[world.platforms.length - 1].x + world.platforms[world.platforms.length - 1].w < W + 560) {
      spawnPlatform();
    }

    updateHUD();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#071022");
    sky.addColorStop(0.55, "#111e3f");
    sky.addColorStop(1, "#221a2d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const moonY = 88 + Math.sin(state.elapsed * 0.16) * 3;
    ctx.fillStyle = "rgba(232, 244, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(804, moonY, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(8, 16, 34, 0.9)";
    ctx.beginPath();
    ctx.arc(818, moonY - 8, 30, 0, Math.PI * 2);
    ctx.fill();

    for (const star of stars) {
      const alpha = 0.32 + Math.sin(state.elapsed * 2 + star.phase) * 0.25;
      ctx.fillStyle = `rgba(220, 234, 255, ${Math.max(0.08, alpha)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkyline(layer, baseY, speedMul) {
    const offset = (state.distance * speedMul) % layer.total;
    let x = -offset;

    while (x < W + layer.total) {
      for (const block of layer.blocks) {
        const bx = x;
        const by = baseY - block.h;

        ctx.fillStyle = block.base;
        ctx.fillRect(bx, by, block.w, block.h);

        ctx.fillStyle = "rgba(167, 203, 255, 0.08)";
        for (let wx = bx + 7; wx < bx + block.w - 4; wx += 11) {
          for (let wy = by + 8; wy < by + block.h - 5; wy += 12) {
            if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 4, 5);
          }
        }

        ctx.fillStyle = block.glow;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(bx, by, block.w, 3);
        ctx.globalAlpha = 1;

        x += block.w + block.gap;
        if (x > W + layer.total) break;
      }
    }
  }

  function drawPlatforms() {
    for (const platform of world.platforms) {
      ctx.fillStyle = "#1f2b58";
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

      ctx.fillStyle = "#6ec6ff";
      ctx.fillRect(platform.x, platform.y, platform.w, 3);

      ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
      ctx.fillRect(platform.x, platform.y + platform.h - 4, platform.w, 4);

      for (let i = 0; i < platform.w; i += 30) {
        ctx.fillStyle = "rgba(150, 174, 224, 0.16)";
        ctx.fillRect(platform.x + i + 3, platform.y + 5, 9, 2);
      }
    }
  }

  function drawHazards() {
    for (const hazard of world.hazards) {
      ctx.fillStyle = "#7f1e2e";
      ctx.fillRect(hazard.x + 8, hazard.y + 8, 6, hazard.h - 8);

      ctx.fillStyle = "#ff6c7f";
      ctx.beginPath();
      ctx.moveTo(hazard.x + hazard.w / 2, hazard.y);
      ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h - 8);
      ctx.lineTo(hazard.x, hazard.y + hazard.h - 8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 220, 150, 0.65)";
      ctx.fillRect(hazard.x + 9, hazard.y + 12, 4, 4);
    }
  }

  function drawDisks() {
    for (const disk of world.disks) {
      ctx.fillStyle = "#5fd8ff";
      ctx.beginPath();
      ctx.arc(disk.x, disk.y, disk.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#0f1d37";
      ctx.beginPath();
      ctx.arc(disk.x, disk.y, 3.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(194, 236, 255, 0.88)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(disk.x, disk.y, disk.r - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const bob = player.onGround ? Math.sin(state.elapsed * 30) * 0.8 : 0;
    const px = player.x;
    const py = player.y + bob;

    ctx.fillStyle = "#1f1f31";
    ctx.fillRect(px + 8, py + 4, 22, 18);

    ctx.fillStyle = player.color;
    ctx.fillRect(px + 6, py + 19, 26, 22);

    ctx.fillStyle = "#ffc277";
    ctx.fillRect(px + 13, py + 6, 10, 10);

    ctx.fillStyle = "#fa5fb3";
    ctx.fillRect(px + 2, py + 22, 7, 15);

    ctx.fillStyle = "#1b2745";
    ctx.fillRect(px + 9, py + 41, 7, 11);
    ctx.fillRect(px + 22, py + 41, 7, 11);

    ctx.fillStyle = "rgba(127, 232, 255, 0.32)";
    ctx.fillRect(px + 4, py + 20, 3, 20);
  }

  function drawHudOverlay() {
    ctx.fillStyle = "rgba(9, 15, 34, 0.74)";
    ctx.fillRect(12, 12, 232, 56);
    ctx.strokeStyle = "rgba(117, 183, 255, 0.7)";
    ctx.strokeRect(12, 12, 232, 56);

    ctx.fillStyle = "#dcebff";
    ctx.font = "700 14px 'Trebuchet MS', sans-serif";
    ctx.fillText(state.paused ? "PAUSED" : state.running ? "RUNNING" : "READY", 24, 33);

    ctx.fillStyle = "#9fb6e8";
    ctx.font = "12px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Speed ${ (state.speed / 220).toFixed(2)}x`, 24, 51);
    ctx.fillText(`Combo x${state.combo}`, 132, 51);

    if (!state.running) {
      ctx.fillStyle = "rgba(8, 12, 24, 0.72)";
      ctx.fillRect(145, 190, 670, 148);
      ctx.strokeStyle = "rgba(126, 199, 255, 0.7)";
      ctx.strokeRect(145, 190, 670, 148);

      ctx.fillStyle = "#ecf4ff";
      ctx.font = "700 28px 'Trebuchet MS', sans-serif";
      ctx.fillText("Rooftop Relay '92", 177, 242);

      ctx.fillStyle = "#b9c9ef";
      ctx.font = "17px 'Trebuchet MS', sans-serif";
      ctx.fillText("Dash, jump, and survive the skyline shift.", 177, 276);
      ctx.fillText("Press Start Run to launch another courier night.", 177, 305);
    }
  }

  function draw() {
    drawSky();
    drawSkyline(skyLayers[0], 350, 0.15);
    drawSkyline(skyLayers[1], 420, 0.28);

    drawPlatforms();
    drawHazards();
    drawDisks();
    drawPlayer();
    drawHudOverlay();
  }

  function updateHUD() {
    scoreEl.textContent = Math.floor(state.score).toString();
    bestEl.textContent = Math.floor(state.best).toString();
    comboEl.textContent = `x${state.combo}`;
    speedEl.textContent = `${(state.speed / 220).toFixed(1)}x`;
    statusEl.textContent = state.message;

    pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    soundBtn.textContent = `Sound: ${state.muted ? "Off" : "On"}`;
  }

  function frame(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.033, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function bindHold(button, key) {
    const down = (event) => {
      event.preventDefault();
      keys[key] = true;
    };
    const up = (event) => {
      event.preventDefault();
      keys[key] = false;
    };

    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointerleave", up);
    button.addEventListener("pointercancel", up);
  }

  startBtn.addEventListener("click", () => {
    startRun();
  });

  pauseBtn.addEventListener("click", () => {
    if (!state.running) return;
    state.paused = !state.paused;
    state.message = state.paused ? "Run paused." : "Run resumed.";
    updateHUD();
  });

  soundBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    if (!state.muted) ensureAudio();
    updateHUD();
  });

  canvas.addEventListener("pointerdown", () => {
    queueJump();
  });

  jumpBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    queueJump();
  });

  bindHold(leftBtn, "left");
  bindHold(rightBtn, "right");

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "KeyA", "KeyD", "KeyW"].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = true;
    if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyW") queueJump();

    if (event.code === "KeyP" && state.running) {
      state.paused = !state.paused;
      state.message = state.paused ? "Run paused." : "Run resumed.";
      updateHUD();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") keys.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") keys.right = false;
  });

  updateHUD();
  draw();
  requestAnimationFrame(frame);
})();
