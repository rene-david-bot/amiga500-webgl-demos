const MAX_DAYS = 7;
const SHELF_CAP = 60;

const genres = [
  { id: "action", name: "Action", baseDemand: 1.2, buy: 6, rent: 10 },
  { id: "horror", name: "Horror", baseDemand: 0.95, buy: 4, rent: 8 },
  { id: "scifi", name: "Sci‑Fi", baseDemand: 1.05, buy: 5, rent: 9 },
  { id: "romance", name: "Romance", baseDemand: 0.8, buy: 3, rent: 7 },
  { id: "anime", name: "Anime", baseDemand: 0.85, buy: 4, rent: 10 },
  { id: "martial", name: "Martial Arts", baseDemand: 0.9, buy: 4, rent: 9 }
];

const events = [
  {
    text: "Rainstorm hits town. Indoor crowds swarm tape racks.",
    boosts: { horror: 0.4, scifi: 0.25 }
  },
  {
    text: "School break starts. Teens chase explosions and kicks.",
    boosts: { action: 0.35, martial: 0.3 }
  },
  {
    text: "Date night rush. Soft focus romances move early.",
    boosts: { romance: 0.5, action: -0.2 }
  },
  {
    text: "Cult club meetup. Weird sci‑fi and anime fly off shelves.",
    boosts: { scifi: 0.35, anime: 0.35 }
  },
  {
    text: "Normal traffic. Balanced demand with no major spikes.",
    boosts: {}
  }
];

const state = {
  day: 1,
  cash: 180,
  buzz: 50,
  inventory: Object.fromEntries(genres.map((g) => [g.id, 0])),
  order: Object.fromEntries(genres.map((g) => [g.id, 0])),
  market: {},
  event: events[events.length - 1],
  gameOver: false
};

const el = {
  day: document.getElementById("day"),
  cash: document.getElementById("cash"),
  buzz: document.getElementById("buzz"),
  shelf: document.getElementById("shelf"),
  best: document.getElementById("best"),
  eventCopy: document.getElementById("event-copy"),
  marketBody: document.getElementById("market-body"),
  orderMeta: document.getElementById("order-meta"),
  runNight: document.getElementById("run-night"),
  hint: document.getElementById("hint"),
  logList: document.getElementById("log-list")
};

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function blip(freq = 500, ms = 70, type = "square", gain = 0.018) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000 + 0.02);
  } catch {
    // Audio is optional.
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function weightedPick(weightMap) {
  const entries = Object.entries(weightMap);
  const total = entries.reduce((sum, [, val]) => sum + val, 0);
  const roll = Math.random() * total;
  let cursor = 0;
  for (const [key, value] of entries) {
    cursor += value;
    if (roll <= cursor) return key;
  }
  return entries[0][0];
}

function getBestRun() {
  return JSON.parse(localStorage.getItem("video-rental-rush-best") || "null");
}

function setBestRun(payload) {
  localStorage.setItem("video-rental-rush-best", JSON.stringify(payload));
}

function updateBestLabel() {
  const best = getBestRun();
  if (!best) {
    el.best.textContent = "—";
    return;
  }
  el.best.textContent = `$${best.cash} (${best.day} days)`;
}

function inventoryCount() {
  return Object.values(state.inventory).reduce((sum, value) => sum + value, 0);
}

function orderCount() {
  return Object.values(state.order).reduce((sum, value) => sum + value, 0);
}

function orderCost() {
  return genres.reduce((sum, genre) => {
    const qty = state.order[genre.id];
    const marketBuy = state.market[genre.id]?.buy ?? genre.buy;
    return sum + qty * marketBuy;
  }, 0);
}

function setHint(text, mood = "normal") {
  el.hint.textContent = text;
  el.hint.classList.remove("bad", "good");
  if (mood === "bad") el.hint.classList.add("bad");
  if (mood === "good") el.hint.classList.add("good");
}

function buildMarket() {
  state.event = pick(events);

  for (const genre of genres) {
    const randomDrift = (Math.random() * 0.8) - 0.2;
    const boost = state.event.boosts[genre.id] || 0;
    const buzzBoost = (state.buzz - 50) / 200;
    const demand = clamp(genre.baseDemand + randomDrift + boost + buzzBoost, 0.25, 2.4);
    const buyPrice = clamp(genre.buy + Math.round((Math.random() * 4) - 2), 2, 10);

    state.market[genre.id] = {
      demand,
      buy: buyPrice,
      rent: genre.rent
    };
  }

  state.order = Object.fromEntries(genres.map((genre) => [genre.id, 0]));
}

function canRunNight() {
  const cost = orderCost();
  const count = orderCount();
  const shelfAfter = inventoryCount() + count;
  return cost <= state.cash && shelfAfter <= SHELF_CAP && !state.gameOver;
}

function renderHud() {
  el.day.textContent = `${Math.min(state.day, MAX_DAYS)} / ${MAX_DAYS}`;
  el.cash.textContent = `$${state.cash}`;
  el.buzz.textContent = `${state.buzz}%`;
  el.shelf.textContent = `${inventoryCount()} / ${SHELF_CAP}`;
  el.eventCopy.textContent = state.event.text;

  const cost = orderCost();
  const count = orderCount();
  el.orderMeta.textContent = `Order: $${cost} · ${count} tapes`;

  el.runNight.disabled = !canRunNight();

  if (state.gameOver) {
    el.runNight.textContent = "Campaign Complete";
    return;
  }

  el.runNight.textContent = "Run Night Shift";
}

function renderMarket() {
  el.marketBody.innerHTML = genres.map((genre) => {
    const market = state.market[genre.id];
    const demandPct = Math.round((market.demand / 2.4) * 100);
    return `
      <tr>
        <td>${genre.name}</td>
        <td>
          <div class="demand-meter" title="Demand ${market.demand.toFixed(2)}">
            <span style="width:${demandPct}%"></span>
          </div>
        </td>
        <td>$${market.buy}</td>
        <td>$${market.rent}</td>
        <td>${state.inventory[genre.id]}</td>
        <td>
          <div class="order-controls">
            <button class="qty-btn" data-action="down" data-genre="${genre.id}">−</button>
            <span class="qty">${state.order[genre.id]}</span>
            <button class="qty-btn" data-action="up" data-genre="${genre.id}">+</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function pushLog(text) {
  const li = document.createElement("li");
  li.innerHTML = text;
  el.logList.prepend(li);
}

function adjustOrder(genreId, delta) {
  if (state.gameOver) return;
  const current = state.order[genreId];
  const next = Math.max(0, current + delta);

  state.order[genreId] = next;
  if (!canRunNight() && delta > 0) {
    state.order[genreId] = current;
    setHint("Cannot exceed cash or shelf capacity.", "bad");
    blip(220, 80, "sawtooth", 0.02);
    return;
  }

  setHint("Order adjusted. Build your night inventory.");
  blip(delta > 0 ? 640 : 420, 55);
  render();
}

function simulateNight() {
  const purchaseCost = orderCost();
  const purchasedUnits = orderCount();
  const startingCash = state.cash;

  if (!canRunNight()) {
    setHint("Order is invalid. Check budget and shelf.", "bad");
    return;
  }

  for (const genre of genres) {
    state.inventory[genre.id] += state.order[genre.id];
  }

  state.cash -= purchaseCost;

  const customerCount = 26 + Math.floor(Math.random() * 10) + Math.floor(state.buzz / 18);
  const weights = Object.fromEntries(
    genres.map((genre) => [genre.id, state.market[genre.id].demand])
  );

  let served = 0;
  let missed = 0;
  const rentals = Object.fromEntries(genres.map((genre) => [genre.id, 0]));

  for (let i = 0; i < customerCount; i += 1) {
    const wanted = weightedPick(weights);
    if (state.inventory[wanted] > 0) {
      state.inventory[wanted] -= 1;
      state.cash += state.market[wanted].rent;
      rentals[wanted] += 1;
      served += 1;
    } else {
      missed += 1;
    }
  }

  const satisfaction = served / customerCount;
  if (satisfaction >= 0.85) {
    state.buzz = clamp(state.buzz + 7, 10, 100);
  } else if (satisfaction >= 0.7) {
    state.buzz = clamp(state.buzz + 3, 10, 100);
  } else if (satisfaction < 0.5) {
    state.buzz = clamp(state.buzz - 8, 10, 100);
  } else {
    state.buzz = clamp(state.buzz - 3, 10, 100);
  }

  const dayProfit = state.cash - startingCash;
  const topGenre = Object.entries(rentals).sort((a, b) => b[1] - a[1])[0];
  const topName = genres.find((g) => g.id === topGenre[0]).name;

  pushLog(
    `<strong>Day ${state.day}:</strong> ${served}/${customerCount} served, ${missed} walkouts, ` +
    `profit <strong>$${dayProfit}</strong>, hottest shelf: ${topName} (${topGenre[1]} rentals).`
  );

  if (dayProfit >= 60) {
    setHint("Huge night. Register is singing.", "good");
    blip(880, 110, "triangle", 0.024);
    setTimeout(() => blip(1100, 110, "triangle", 0.024), 110);
  } else if (dayProfit < 0) {
    setHint("Rough shift. Rebalance demand tomorrow.", "bad");
    blip(200, 180, "sawtooth", 0.024);
  } else {
    setHint("Shift complete. Reorder for tomorrow.");
    blip(560, 80, "square", 0.018);
  }

  state.day += 1;
  if (state.day > MAX_DAYS) {
    finishCampaign();
    return;
  }

  buildMarket();
  render();
}

function finishCampaign() {
  state.gameOver = true;

  const best = getBestRun();
  if (!best || state.cash > best.cash) {
    setBestRun({ cash: state.cash, day: MAX_DAYS });
    updateBestLabel();
  }

  let rank = "Tape Intern";
  if (state.cash >= 360) rank = "Mall Legend";
  else if (state.cash >= 300) rank = "District Favorite";
  else if (state.cash >= 240) rank = "Trusted Clerk";

  pushLog(`<strong>Campaign clear:</strong> finished with <strong>$${state.cash}</strong> · Rank: ${rank}.`);
  setHint(`Run complete — ${rank}. Refresh to start a new week.`, "good");
  render();
}

function bindEvents() {
  el.marketBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-genre]");
    if (!button) return;

    const delta = button.dataset.action === "up" ? 1 : -1;
    adjustOrder(button.dataset.genre, delta);
  });

  el.runNight.addEventListener("click", simulateNight);
}

function render() {
  renderHud();
  renderMarket();
}

function init() {
  buildMarket();
  updateBestLabel();
  bindEvents();
  render();
  pushLog("<strong>Boot:</strong> Neon Rewind Video opens for business.");
}

init();
