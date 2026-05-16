(() => {
  const seatGridEl = document.getElementById("seatGrid");
  const benchEl = document.getElementById("bench");
  const friendsListEl = document.getElementById("friendsList");
  const rivalsListEl = document.getElementById("rivalsList");
  const statusEl = document.getElementById("status");
  const handValueEl = document.getElementById("handValue");

  const startBtn = document.getElementById("startBtn");
  const scoreBtn = document.getElementById("scoreBtn");
  const nextBtn = document.getElementById("nextBtn");
  const muteBtn = document.getElementById("muteBtn");
  const dropBtn = document.getElementById("dropBtn");

  const roundValueEl = document.getElementById("roundValue");
  const targetValueEl = document.getElementById("targetValue");
  const totalValueEl = document.getElementById("totalValue");
  const bestValueEl = document.getElementById("bestValue");

  const MAX_ROUNDS = 4;
  const POWER_SEATS = new Set([0, 2, 6, 8]);
  const ADJACENT_PAIRS = [];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const index = row * 3 + col;
      if (col < 2) ADJACENT_PAIRS.push([index, index + 1]);
      if (row < 2) ADJACENT_PAIRS.push([index, index + 3]);
    }
  }

  const NAME_POOL = [
    "ByteMara", "CRTiger", "HexHawk", "NeonNora", "TurboTom", "PixelPia", "RogueRex", "LumaLex",
    "GigaGus", "ModemMia", "PatchPaul", "ScanSid", "NovaNix", "CipherCaro", "ArcadeAri", "RasterRay",
    "FloppyFlo", "VoxVera", "OrbitOli", "SpriteSam", "CometKai", "LaserLia", "SonicSven", "DeltaDee"
  ];

  const CLANS = ["FPS", "RTS", "RPG", "Racer"];

  const PREFS = [
    { id: "corner", label: "wants a corner", check: (seat) => isCorner(seat) },
    { id: "edge", label: "wants an edge", check: (seat) => isEdge(seat) },
    { id: "center", label: "wants center", check: (seat) => seat === 4 },
    { id: "left", label: "wants left wing", check: (seat) => seat % 3 === 0 },
    { id: "right", label: "wants right wing", check: (seat) => seat % 3 === 2 },
    { id: "top", label: "wants front row", check: (seat) => seat < 3 },
    { id: "bottom", label: "wants back row", check: (seat) => seat >= 6 },
    { id: "power", label: "needs power strip", check: (seat) => POWER_SEATS.has(seat) }
  ];

  const state = {
    round: 1,
    totalScore: 0,
    bestRun: Number(localStorage.getItem("retro.lanParty.best") || 0),
    runStarted: false,
    muted: false,
    selectedId: null,
    roundCleared: false,
    players: [],
    bench: [],
    seats: new Array(9).fill(null),
    friends: [],
    rivals: [],
    target: 0
  };

  let audioCtx = null;

  function isCorner(seat) {
    return seat === 0 || seat === 2 || seat === 6 || seat === 8;
  }

  function isEdge(seat) {
    return [1, 3, 5, 7].includes(seat);
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pairKey(a, b) {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  function createRound(round) {
    const pickedNames = shuffle(NAME_POOL).slice(0, 8);
    const prefBag = shuffle(PREFS);

    state.players = pickedNames.map((name, index) => ({
      id: index,
      name,
      clan: CLANS[randInt(0, CLANS.length - 1)],
      pref: prefBag[index % prefBag.length]
    }));

    state.bench = state.players.map((p) => p.id);
    state.seats = new Array(9).fill(null);
    state.selectedId = null;
    state.roundCleared = false;

    const allPairs = [];
    for (let i = 0; i < state.players.length; i += 1) {
      for (let j = i + 1; j < state.players.length; j += 1) {
        allPairs.push([i, j]);
      }
    }

    const shuffledPairs = shuffle(allPairs);
    state.friends = shuffledPairs.slice(0, 4);

    const friendKeys = new Set(state.friends.map(([a, b]) => pairKey(a, b)));
    state.rivals = [];
    for (const [a, b] of shuffledPairs) {
      if (state.rivals.length >= 3) break;
      if (friendKeys.has(pairKey(a, b))) continue;
      state.rivals.push([a, b]);
    }

    state.target = 44 + round * 8;
  }

  function getPlayer(id) {
    return state.players.find((player) => player.id === id) || null;
  }

  function getSeatOf(playerId) {
    return state.seats.findIndex((id) => id === playerId);
  }

  function areAdjacentSeat(a, b) {
    const ar = Math.floor(a / 3);
    const ac = a % 3;
    const br = Math.floor(b / 3);
    const bc = b % 3;
    return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
  }

  function ensureAudio() {
    if (state.muted || audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function playTone(kind) {
    if (state.muted) return;
    ensureAudio();
    if (!audioCtx) return;

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    let start = 420;
    let end = 330;
    let duration = 0.08;
    let type = "square";
    let volume = 0.05;

    if (kind === "place") {
      start = 520;
      end = 660;
      duration = 0.07;
      type = "triangle";
    } else if (kind === "pickup") {
      start = 400;
      end = 300;
      duration = 0.06;
    } else if (kind === "score") {
      start = 320;
      end = 700;
      duration = 0.12;
      type = "triangle";
      volume = 0.06;
    } else if (kind === "clear") {
      start = 460;
      end = 920;
      duration = 0.16;
      type = "triangle";
      volume = 0.07;
    } else if (kind === "bad") {
      start = 210;
      end = 140;
      duration = 0.16;
      type = "sawtooth";
      volume = 0.07;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function handleBenchClick(playerId) {
    if (state.roundCleared) return;
    if (state.selectedId === playerId) {
      state.selectedId = null;
      updateStatus("Selection cleared.");
      render();
      return;
    }
    state.selectedId = playerId;
    const p = getPlayer(playerId);
    updateStatus(`${p.name} selected. Click a seat to place.`);
    playTone("pickup");
    render();
  }

  function handleSeatClick(seatIndex) {
    if (state.roundCleared) return;

    const occupant = state.seats[seatIndex];

    if (state.selectedId === null) {
      if (occupant === null) {
        updateStatus("Seat is empty. Select a player first.");
        return;
      }
      state.seats[seatIndex] = null;
      state.bench.push(occupant);
      state.selectedId = occupant;
      updateStatus(`${getPlayer(occupant).name} picked up from Seat ${seatIndex + 1}.`);
      playTone("pickup");
      render();
      return;
    }

    const selected = state.selectedId;
    const benchPos = state.bench.indexOf(selected);
    if (benchPos !== -1) {
      state.bench.splice(benchPos, 1);
    }

    state.seats[seatIndex] = selected;

    if (occupant !== null) {
      state.bench.push(occupant);
      state.selectedId = occupant;
      updateStatus(`${getPlayer(selected).name} seated. ${getPlayer(occupant).name} moved to hand.`);
      playTone("place");
    } else {
      state.selectedId = null;
      updateStatus(`${getPlayer(selected).name} seated at Seat ${seatIndex + 1}.`);
      playTone("place");
    }

    render();
  }

  function returnHandToBench() {
    if (state.selectedId === null) {
      updateStatus("No player in hand.");
      return;
    }
    if (!state.bench.includes(state.selectedId)) {
      state.bench.push(state.selectedId);
    }
    const name = getPlayer(state.selectedId).name;
    state.selectedId = null;
    updateStatus(`${name} returned to bench.`);
    render();
  }

  function scoreLayout() {
    if (!state.runStarted) {
      updateStatus("Start a run first.");
      return;
    }

    if (state.selectedId !== null) {
      updateStatus("Place or return the player in hand before scoring.");
      playTone("bad");
      return;
    }

    const seatedCount = state.seats.filter((id) => id !== null).length;
    if (seatedCount !== 8) {
      updateStatus("Seat all 8 players first. Leave exactly one seat empty.");
      playTone("bad");
      return;
    }

    const placementScore = scorePreferences();
    const friendScore = scoreFriendRival();
    const clanScore = scoreClanAdjacency();
    const total = placementScore + friendScore + clanScore;

    const line = [
      `Layout score ${total} (prefs ${placementScore >= 0 ? "+" : ""}${placementScore}, pairs ${friendScore >= 0 ? "+" : ""}${friendScore}, clan ${clanScore >= 0 ? "+" : ""}${clanScore}).`
    ];

    if (total >= state.target) {
      state.roundCleared = true;
      state.totalScore += total;
      nextBtn.disabled = false;
      line.push(`Round cleared. Target ${state.target} reached.`);
      updateStatus(line.join(" "), "good");
      playTone("clear");

      if (state.round === MAX_ROUNDS) {
        finishRun();
      }
    } else {
      const need = state.target - total;
      nextBtn.disabled = true;
      line.push(`Need ${need} more points to clear.`);
      updateStatus(line.join(" "), "bad");
      playTone("score");
    }

    updateHud();
  }

  function scorePreferences() {
    let score = 0;
    for (const player of state.players) {
      const seat = getSeatOf(player.id);
      if (seat === -1) continue;
      score += player.pref.check(seat) ? 6 : -2;
    }
    return score;
  }

  function scoreFriendRival() {
    let score = 0;

    for (const [a, b] of state.friends) {
      const seatA = getSeatOf(a);
      const seatB = getSeatOf(b);
      if (seatA === -1 || seatB === -1) continue;
      score += areAdjacentSeat(seatA, seatB) ? 12 : 0;
    }

    for (const [a, b] of state.rivals) {
      const seatA = getSeatOf(a);
      const seatB = getSeatOf(b);
      if (seatA === -1 || seatB === -1) continue;
      score += areAdjacentSeat(seatA, seatB) ? -10 : 4;
    }

    return score;
  }

  function scoreClanAdjacency() {
    let score = 0;
    for (const [seatA, seatB] of ADJACENT_PAIRS) {
      const a = state.seats[seatA];
      const b = state.seats[seatB];
      if (a === null || b === null) continue;
      const playerA = getPlayer(a);
      const playerB = getPlayer(b);
      if (playerA && playerB && playerA.clan === playerB.clan) {
        score += 3;
      }
    }
    return score;
  }

  function finishRun() {
    if (state.totalScore > state.bestRun) {
      state.bestRun = state.totalScore;
      localStorage.setItem("retro.lanParty.best", String(state.bestRun));
    }
    updateStatus(`Run complete. Final total ${state.totalScore}. Best run ${state.bestRun}. Start New Run for a fresh lobby.`, "good");
    nextBtn.disabled = true;
  }

  function updateStatus(text, tone = "") {
    statusEl.textContent = text;
    statusEl.classList.remove("good", "bad");
    if (tone) {
      statusEl.classList.add(tone);
    }
  }

  function updateHud() {
    roundValueEl.textContent = `${state.round} / ${MAX_ROUNDS}`;
    targetValueEl.textContent = state.target;
    totalValueEl.textContent = state.totalScore;
    bestValueEl.textContent = state.bestRun;
    handValueEl.textContent = state.selectedId === null ? "None" : getPlayer(state.selectedId).name;
  }

  function renderRelations() {
    friendsListEl.innerHTML = "";
    rivalsListEl.innerHTML = "";

    for (const [a, b] of state.friends) {
      const li = document.createElement("li");
      li.textContent = `${getPlayer(a).name} ↔ ${getPlayer(b).name}`;
      friendsListEl.appendChild(li);
    }

    for (const [a, b] of state.rivals) {
      const li = document.createElement("li");
      li.textContent = `${getPlayer(a).name} ✕ ${getPlayer(b).name}`;
      rivalsListEl.appendChild(li);
    }
  }

  function renderBench() {
    const sortedBench = [...state.bench].sort((a, b) => {
      const nameA = getPlayer(a).name;
      const nameB = getPlayer(b).name;
      return nameA.localeCompare(nameB);
    });

    benchEl.innerHTML = "";
    for (const id of sortedBench) {
      const player = getPlayer(id);
      const btn = document.createElement("button");
      btn.className = `pill${state.selectedId === id ? " selected" : ""}`;
      btn.type = "button";
      btn.innerHTML = `${player.name} <small>(${player.clan}, ${player.pref.label})</small>`;
      btn.addEventListener("click", () => handleBenchClick(id));
      benchEl.appendChild(btn);
    }
  }

  function renderSeats() {
    seatGridEl.innerHTML = "";

    for (let index = 0; index < 9; index += 1) {
      const playerId = state.seats[index];
      const seatBtn = document.createElement("button");
      seatBtn.type = "button";
      seatBtn.className = `seat${POWER_SEATS.has(index) ? " power" : ""}${playerId === null ? " empty" : ""}${state.selectedId !== null && playerId === state.selectedId ? " selected" : ""}`;

      const slot = document.createElement("div");
      slot.className = "slot";
      slot.textContent = `Seat ${index + 1}${POWER_SEATS.has(index) ? " ⚡" : ""}`;

      const name = document.createElement("div");
      name.className = "name";

      const meta = document.createElement("div");
      meta.className = "meta";

      if (playerId === null) {
        name.textContent = "Empty station";
        meta.textContent = "Click to place selected player";
      } else {
        const player = getPlayer(playerId);
        name.textContent = player.name;
        meta.textContent = `${player.clan} · ${player.pref.label}`;
      }

      seatBtn.append(slot, name, meta);
      seatBtn.addEventListener("click", () => handleSeatClick(index));
      seatGridEl.appendChild(seatBtn);
    }
  }

  function render() {
    renderBench();
    renderSeats();
    renderRelations();
    updateHud();
  }

  function startNewRun() {
    state.round = 1;
    state.totalScore = 0;
    state.runStarted = true;
    nextBtn.disabled = true;
    createRound(state.round);
    updateStatus("Round 1 started. Select a player, then click a seat.");
    playTone("score");
    render();
  }

  function nextRound() {
    if (!state.roundCleared) {
      updateStatus("Clear the current round before moving on.", "bad");
      playTone("bad");
      return;
    }

    if (state.round >= MAX_ROUNDS) {
      finishRun();
      return;
    }

    state.round += 1;
    nextBtn.disabled = true;
    createRound(state.round);
    updateStatus(`Round ${state.round} loaded. Hit target ${state.target}.`);
    playTone("score");
    render();
  }

  startBtn.addEventListener("click", () => {
    ensureAudio();
    startNewRun();
  });

  scoreBtn.addEventListener("click", scoreLayout);
  nextBtn.addEventListener("click", nextRound);
  dropBtn.addEventListener("click", returnHandToBench);

  muteBtn.addEventListener("click", () => {
    state.muted = !state.muted;
    muteBtn.textContent = `Sound: ${state.muted ? "Off" : "On"}`;
    if (!state.muted) {
      ensureAudio();
      playTone("place");
    }
  });

  bestValueEl.textContent = state.bestRun;
  renderSeats();
})();
