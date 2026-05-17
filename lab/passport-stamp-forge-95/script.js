(() => {
  const canvas = document.getElementById("passportCanvas");
  const ctx = canvas.getContext("2d");

  const cityInput = document.getElementById("cityInput");
  const countryInput = document.getElementById("countryInput");
  const typeInput = document.getElementById("typeInput");
  const inkInput = document.getElementById("inkInput");
  const tiltInput = document.getElementById("tiltInput");

  const stampBtn = document.getElementById("stampBtn");
  const tourBtn = document.getElementById("tourBtn");
  const undoBtn = document.getElementById("undoBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const muteBtn = document.getElementById("muteBtn");

  const stampCountEl = document.getElementById("stampCount");
  const countryCountEl = document.getElementById("countryCount");
  const styleValueEl = document.getElementById("styleValue");
  const statusEl = document.getElementById("status");
  const routeChips = document.getElementById("routeChips");

  const routes = [
    { city: "DRESDEN", country: "DE", type: "ENTRY", color: "#ec346f", style: "Neon Route" },
    { city: "TOKYO", country: "JP", type: "TRANSIT", color: "#33f3ff", style: "Cyber Transit" },
    { city: "RIO", country: "BR", type: "ENTRY", color: "#8bff62", style: "Carnival Trail" },
    { city: "CAIRO", country: "EG", type: "EXIT", color: "#ffd84d", style: "Amber Archive" },
    { city: "REYKJAVIK", country: "IS", type: "VISA OK", color: "#ffffff", style: "Frozen Signal" }
  ];

  const autoStops = [
    ["BERLIN", "DE"], ["OSLO", "NO"], ["LIMA", "PE"], ["SEOUL", "KR"], ["MEXICO", "MX"],
    ["NAIROBI", "KE"], ["DUBLIN", "IE"], ["ISTANBUL", "TR"], ["VIENNA", "AT"], ["BANGKOK", "TH"]
  ];

  const state = {
    stamps: [],
    muted: false,
    style: "Neon Route"
  };

  let audioCtx = null;

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function todayCompact() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${dd}.${mm}.${yy}`;
  }

  function sanitizeCode(text, max) {
    return text.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim().slice(0, max);
  }

  function updateHud() {
    stampCountEl.textContent = String(state.stamps.length);
    const countries = new Set(state.stamps.map((s) => s.country));
    countryCountEl.textContent = String(countries.size);
    styleValueEl.textContent = state.style;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function ensureAudio() {
    if (state.muted || audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function playStampSound() {
    if (state.muted) return;
    ensureAudio();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  function drawPassportBase() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1f2b48");
    bg.addColorStop(1, "#111a31");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.045)";
    for (let y = 58; y < h; y += 46) {
      ctx.fillRect(36, y, w - 72, 1);
    }

    ctx.strokeStyle = "rgba(120, 156, 255, 0.24)";
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, w - 52, h - 52);

    ctx.fillStyle = "rgba(223, 233, 255, 0.75)";
    ctx.font = "bold 34px 'Trebuchet MS', sans-serif";
    ctx.fillText("RETRO TRAVEL PASSPORT", 52, 76);

    ctx.font = "16px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = "rgba(209, 220, 255, 0.65)";
    ctx.fillText("NAME: NEON NOMAD", 52, 108);
    ctx.fillText("ISSUED: 1995", 52, 134);

    ctx.save();
    ctx.translate(w - 210, h - 70);
    ctx.rotate(-0.14);
    ctx.fillStyle = "rgba(140, 170, 255, 0.16)";
    ctx.font = "bold 52px 'Trebuchet MS', sans-serif";
    ctx.fillText("VOID", 0, 0);
    ctx.restore();
  }

  function drawStamp(stamp) {
    ctx.save();
    ctx.translate(stamp.x, stamp.y);
    ctx.rotate((stamp.angle * Math.PI) / 180);

    const outer = 74;
    const inner = 58;

    ctx.globalAlpha = 0.88;
    ctx.strokeStyle = stamp.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, outer, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, inner, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = stamp.color;
    ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stamp.city, 0, -4);

    ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    ctx.fillText(`${stamp.country} · ${stamp.type}`, 0, 18);
    ctx.fillText(stamp.date, 0, 36);

    for (let i = 0; i < 26; i += 1) {
      const px = randomBetween(-68, 68);
      const py = randomBetween(-68, 68);
      ctx.fillRect(px, py, 1.6, 1.6);
    }

    ctx.restore();
  }

  function redraw() {
    drawPassportBase();
    state.stamps.forEach(drawStamp);
    updateHud();
  }

  function makeStamp(partial = {}) {
    const city = sanitizeCode(partial.city ?? cityInput.value, 14) || "UNKNOWN";
    const country = sanitizeCode(partial.country ?? countryInput.value, 3) || "XX";
    const type = sanitizeCode(partial.type ?? typeInput.value, 9) || "ENTRY";
    const color = partial.color ?? inkInput.value;

    const chaos = Number(tiltInput.value);
    const angle = randomBetween(-chaos, chaos);

    return {
      city,
      country,
      type,
      color,
      date: todayCompact(),
      angle,
      x: randomBetween(130, canvas.width - 130),
      y: randomBetween(175, canvas.height - 95)
    };
  }

  function addStamp(stamp) {
    state.stamps.push(stamp);
    if (state.stamps.length > 28) {
      state.stamps.shift();
    }
    redraw();
    playStampSound();
    setStatus(`Stamped ${stamp.city}, ${stamp.country} (${stamp.type}).`);
  }

  function runAutoTour() {
    const types = ["ENTRY", "EXIT", "TRANSIT", "VISA OK"];
    const colors = ["#ec346f", "#33f3ff", "#8bff62", "#ffd84d", "#ffffff"];

    for (let i = 0; i < 5; i += 1) {
      const [city, country] = pick(autoStops);
      const stamp = makeStamp({
        city,
        country,
        type: pick(types),
        color: pick(colors)
      });
      state.stamps.push(stamp);
    }

    if (state.stamps.length > 28) {
      state.stamps = state.stamps.slice(-28);
    }

    redraw();
    playStampSound();
    setStatus("Auto Tour stamped 5 random checkpoints.");
  }

  function undoLast() {
    if (!state.stamps.length) {
      setStatus("No stamps to undo.");
      return;
    }
    const removed = state.stamps.pop();
    redraw();
    setStatus(`Removed ${removed.city}, ${removed.country}.`);
  }

  function clearAll() {
    state.stamps = [];
    redraw();
    setStatus("Passport reset. Fresh page ready.");
  }

  function exportPng() {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `passport-stamp-forge-${Date.now()}.png`;
    link.click();
    setStatus("PNG exported to your downloads.");
  }

  function applyRoute(route) {
    cityInput.value = route.city;
    countryInput.value = route.country;
    typeInput.value = route.type;
    inkInput.value = route.color;
    state.style = route.style;
    updateHud();
    setStatus(`Loaded preset: ${route.style}.`);
  }

  function mountRouteChips() {
    routeChips.innerHTML = "";
    routes.forEach((route) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${route.style} · ${route.city}`;
      btn.addEventListener("click", () => applyRoute(route));
      routeChips.appendChild(btn);
    });
  }

  stampBtn.addEventListener("click", () => addStamp(makeStamp()));
  tourBtn.addEventListener("click", runAutoTour);
  undoBtn.addEventListener("click", undoLast);
  clearBtn.addEventListener("click", clearAll);
  exportBtn.addEventListener("click", exportPng);

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    muteBtn.textContent = `Sound: ${state.muted ? "Off" : "On"}`;
    if (!state.muted) {
      ensureAudio();
      playStampSound();
    }
  });

  mountRouteChips();
  applyRoute(routes[0]);
  redraw();
})();
