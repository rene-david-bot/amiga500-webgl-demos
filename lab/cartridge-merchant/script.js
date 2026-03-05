const MAX_DAYS = 10;
const START_CREDITS = 1200;
const TARGET_WORTH = 5000;
const CAPACITY = 18;

const ITEMS = [
  { id: "blaster", name: "Orbit Blaster", base: 120, vol: 0.24 },
  { id: "quest", name: "Rune Quest III", base: 180, vol: 0.2 },
  { id: "racer", name: "Gridline GT", base: 95, vol: 0.28 },
  { id: "puzzler", name: "Hexa Puzzler", base: 70, vol: 0.32 },
  { id: "sports", name: "Turbo Sports", base: 140, vol: 0.22 }
];

const state = {
  day: 1,
  credits: START_CREDITS,
  holdings: {},
  multipliers: {},
  prices: {},
  previousPrices: {},
  pendingRumor: null,
  gameOver: false
};

const el = {
  day: document.getElementById("day"),
  credits: document.getElementById("credits"),
  inventory: document.getElementById("inventory"),
  networth: document.getElementById("networth"),
  target: document.getElementById("target"),
  status: document.getElementById("status"),
  rumor: document.getElementById("rumor"),
  marketBody: document.getElementById("market-body"),
  log: document.getElementById("log"),
  nextDay: document.getElementById("next-day"),
  liquidate: document.getElementById("liquidate"),
  newRun: document.getElementById("new-run")
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fmt(n) {
  return `₡${Math.round(n).toLocaleString("en-US")}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function inventoryUsed() {
  return Object.values(state.holdings).reduce((sum, qty) => sum + qty, 0);
}

function netWorth() {
  return state.credits + ITEMS.reduce((sum, item) => {
    return sum + state.holdings[item.id] * state.prices[item.id];
  }, 0);
}

function addLog(text) {
  const li = document.createElement("li");
  li.textContent = text;
  el.log.prepend(li);
  while (el.log.children.length > 9) {
    el.log.removeChild(el.log.lastChild);
  }
}

function seedState() {
  state.day = 1;
  state.credits = START_CREDITS;
  state.gameOver = false;
  state.pendingRumor = null;
  state.holdings = Object.fromEntries(ITEMS.map((item) => [item.id, 0]));
  state.multipliers = Object.fromEntries(ITEMS.map((item) => [item.id, 1]));
  state.previousPrices = Object.fromEntries(ITEMS.map((item) => [item.id, item.base]));
  el.log.innerHTML = "";
  addLog("Shop opened. Build your retro cartridge empire.");
}

function generateRumor() {
  const item = pick(ITEMS);
  const direction = Math.random() < 0.5 ? 1 : -1;
  const reliability = rand(0.72, 0.86);
  const magnitude = rand(0.18, 0.35);
  const wording = direction > 0 ? "spiking" : "cooling";
  return {
    itemId: item.id,
    itemName: item.name,
    direction,
    reliability,
    magnitude,
    line: `Rumor Terminal: "${item.name}" looks ${wording} tomorrow.`
  };
}

function applyRumorImpact() {
  if (!state.pendingRumor) return "No rumor impact today.";

  const rumor = state.pendingRumor;
  const truth = Math.random() < rumor.reliability;
  const appliedDirection = truth ? rumor.direction : rumor.direction * -1;
  const effect = 1 + appliedDirection * rumor.magnitude;

  state.multipliers[rumor.itemId] = clamp(state.multipliers[rumor.itemId] * effect, 0.45, 2.4);

  const move = appliedDirection > 0 ? "surged" : "dropped";
  return `${rumor.itemName} ${move} on open.`;
}

function driftMarket() {
  ITEMS.forEach((item) => {
    let mult = state.multipliers[item.id];
    mult *= 1 + rand(-0.06, 0.06);
    mult = 1 + (mult - 1) * 0.82;
    state.multipliers[item.id] = clamp(mult, 0.5, 2.2);
  });
}

function generatePrices() {
  const old = { ...state.prices };

  ITEMS.forEach((item) => {
    const noise = 1 + rand(-item.vol, item.vol);
    const raw = item.base * state.multipliers[item.id] * noise;
    const rounded = Math.max(25, Math.round(raw / 5) * 5);
    state.prices[item.id] = rounded;
  });

  if (Object.keys(old).length) {
    state.previousPrices = old;
  }
}

function renderHud() {
  const worth = netWorth();
  el.day.textContent = `${state.day} / ${MAX_DAYS}`;
  el.credits.textContent = fmt(state.credits);
  el.inventory.textContent = `${inventoryUsed()} / ${CAPACITY}`;
  el.networth.textContent = fmt(worth);
  el.target.textContent = `${fmt(TARGET_WORTH)} (${fmt(Math.max(0, TARGET_WORTH - worth))} left)`;

  if (state.gameOver) {
    el.status.textContent = "Closed";
  } else if (worth >= TARGET_WORTH) {
    el.status.textContent = "Ahead";
  } else {
    el.status.textContent = "Trading";
  }
}

function renderRumor() {
  if (state.gameOver) {
    el.rumor.textContent = "Market closed. Start a new run to trade again.";
    return;
  }

  if (state.day === MAX_DAYS) {
    el.rumor.textContent = "Final day: no future rumors. Make this session count.";
    return;
  }

  el.rumor.textContent = state.pendingRumor ? state.pendingRumor.line : "Rumor line is noisy today.";
}

function renderMarket() {
  const rows = ITEMS.map((item) => {
    const price = state.prices[item.id];
    const prev = state.previousPrices[item.id] ?? price;
    const trendClass = price > prev ? "price-up" : price < prev ? "price-down" : "";
    const delta = price - prev;
    const deltaTxt = delta === 0 ? "" : delta > 0 ? ` ▲${delta}` : ` ▼${Math.abs(delta)}`;

    const canBuy = !state.gameOver && inventoryUsed() < CAPACITY && state.credits >= price;
    const canSell = !state.gameOver && state.holdings[item.id] > 0;

    return `
      <tr>
        <td>${item.name}</td>
        <td class="${trendClass}">${fmt(price)}${deltaTxt}</td>
        <td>${state.holdings[item.id]}</td>
        <td>
          <div class="actions">
            <button data-action="buy" data-id="${item.id}" ${canBuy ? "" : "disabled"}>Buy 1</button>
            <button data-action="sell" data-id="${item.id}" class="ghost" ${canSell ? "" : "disabled"}>Sell 1</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  el.marketBody.innerHTML = rows;
  el.nextDay.textContent = state.day >= MAX_DAYS ? "Close Ledger" : "Advance Day";
  el.nextDay.disabled = state.gameOver;
  el.liquidate.disabled = state.gameOver || inventoryUsed() === 0;
}

function buy(id) {
  if (state.gameOver) return;
  const price = state.prices[id];
  if (inventoryUsed() >= CAPACITY) {
    addLog("Inventory full. Sell something first.");
    return;
  }
  if (state.credits < price) {
    addLog("Not enough credits.");
    return;
  }

  state.credits -= price;
  state.holdings[id] += 1;
  const item = ITEMS.find((entry) => entry.id === id);
  addLog(`Bought ${item.name} for ${fmt(price)}.`);
  renderAll();
}

function sell(id) {
  if (state.gameOver) return;
  if (state.holdings[id] <= 0) return;

  const price = state.prices[id];
  state.holdings[id] -= 1;
  state.credits += price;
  const item = ITEMS.find((entry) => entry.id === id);
  addLog(`Sold ${item.name} for ${fmt(price)}.`);
  renderAll();
}

function liquidateAll(logIt = true) {
  let total = 0;
  ITEMS.forEach((item) => {
    const qty = state.holdings[item.id];
    if (!qty) return;
    total += qty * state.prices[item.id];
    state.holdings[item.id] = 0;
  });
  state.credits += total;
  if (logIt && total > 0) {
    addLog(`Liquidated inventory for ${fmt(total)}.`);
  }
}

function closeGame() {
  liquidateAll(false);
  state.gameOver = true;
  const finalWorth = netWorth();
  const rank = finalWorth >= 7000
    ? "Silicon Shark"
    : finalWorth >= TARGET_WORTH
      ? "Mall Tycoon"
      : "Weekend Trader";

  addLog(`Run complete: ${fmt(finalWorth)} net worth · ${rank}.`);
  renderAll();
}

function advanceDay() {
  if (state.gameOver) return;

  if (state.day >= MAX_DAYS) {
    closeGame();
    return;
  }

  state.day += 1;
  const impactLine = applyRumorImpact();
  driftMarket();
  generatePrices();
  addLog(`Day ${state.day} opened — ${impactLine}`);
  state.pendingRumor = state.day < MAX_DAYS ? generateRumor() : null;
  renderAll();
}

function renderAll() {
  renderHud();
  renderRumor();
  renderMarket();
}

el.marketBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "buy") buy(id);
  if (action === "sell") sell(id);
});

el.nextDay.addEventListener("click", advanceDay);
el.liquidate.addEventListener("click", () => {
  liquidateAll(true);
  renderAll();
});
el.newRun.addEventListener("click", init);

function init() {
  seedState();
  generatePrices();
  state.pendingRumor = generateRumor();
  addLog("Rumor line active. Watch tomorrow's signal.");
  renderAll();
}

init();