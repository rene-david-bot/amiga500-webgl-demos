const ui = {
  round: document.getElementById("round"),
  cash: document.getElementById("cash"),
  profit: document.getElementById("profit"),
  streak: document.getElementById("streak"),
  itemName: document.getElementById("itemName"),
  buyerMood: document.getElementById("buyerMood"),
  cost: document.getElementById("cost"),
  buzz: document.getElementById("buzz"),
  hint: document.getElementById("hint"),
  priceSlider: document.getElementById("priceSlider"),
  priceOut: document.getElementById("priceOut"),
  meterFill: document.getElementById("meterFill"),
  meterText: document.getElementById("meterText"),
  startBtn: document.getElementById("startBtn"),
  quoteBtn: document.getElementById("quoteBtn"),
  nextBtn: document.getElementById("nextBtn"),
  log: document.getElementById("log")
};

const goods = [
  { name: "Boxed joystick", base: 48 },
  { name: "Turbo Gamepad Pro", base: 62 },
  { name: "CRT service manual set", base: 56 },
  { name: "Pocket cassette recorder", base: 74 },
  { name: "Neon desk fan", base: 36 },
  { name: "Sealed floppy disk bundle", base: 52 },
  { name: "Vintage arcade marquee", base: 88 },
  { name: "Portable mini TV", base: 96 },
  { name: "Polaroid instant camera", base: 84 },
  { name: "Synth keytar stand", base: 66 },
  { name: "Collector VHS trilogy", base: 58 },
  { name: "Retro calculator watch", base: 44 }
];

const buyers = [
  { type: "Collector on a mission", demand: 1.18, tolerance: 0.92, buzz: "High" },
  { type: "Student bargain hunter", demand: 0.9, tolerance: 0.78, buzz: "Low" },
  { type: "Tourist impulse shopper", demand: 1.04, tolerance: 0.86, buzz: "Medium" },
  { type: "Reseller with sharp eyes", demand: 0.96, tolerance: 0.82, buzz: "Medium" },
  { type: "Nostalgia parent", demand: 1.12, tolerance: 0.9, buzz: "High" },
  { type: "Weekend tinkerer", demand: 1, tolerance: 0.84, buzz: "Medium" }
];

const game = {
  totalRounds: 10,
  round: 0,
  cash: 120,
  profit: 0,
  streak: 0,
  active: false,
  finished: false,
  quoted: false,
  current: null,
  usedItems: new Set(),
  audioCtx: null
};

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function pickOne(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function ensureAudio() {
  if (!game.audioCtx) {
    game.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (game.audioCtx.state === "suspended") game.audioCtx.resume();
}

function beep(freq = 620, dur = 0.08, type = "square", gain = 0.05) {
  if (!game.audioCtx) return;
  const now = game.audioCtx.currentTime;
  const osc = game.audioCtx.createOscillator();
  const amp = game.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp).connect(game.audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function pushLog(text, tone = "") {
  const li = document.createElement("li");
  li.textContent = text;
  if (tone) li.classList.add(tone);
  ui.log.prepend(li);
  while (ui.log.children.length > 8) {
    ui.log.removeChild(ui.log.lastChild);
  }
}

function updateHud() {
  ui.round.textContent = `${game.round} / ${game.totalRounds}`;
  ui.cash.textContent = `$${game.cash}`;
  ui.profit.textContent = `${game.profit >= 0 ? "+" : ""}$${game.profit}`;
  ui.streak.textContent = String(game.streak);
}

function priceMood(offer) {
  const { floor, maxPay, sweetLow, sweetHigh } = game.current;
  if (offer < floor) {
    return { meter: 14, text: "Too low. They may think it's broken.", color: "var(--danger)" };
  }
  if (offer > maxPay + 18) {
    return { meter: 96, text: "Way too spicy. Walk-away risk is high.", color: "var(--danger)" };
  }
  if (offer >= sweetLow && offer <= sweetHigh) {
    return { meter: 70, text: "Sweet spot. Confident close potential.", color: "var(--hot)" };
  }
  if (offer < sweetLow) {
    return { meter: 38, text: "Tempting price, but margin looks thin.", color: "var(--warn)" };
  }
  return { meter: 58, text: "Could work, but buyer may push back.", color: "var(--warn)" };
}

function refreshSliderLabel() {
  const offer = Number(ui.priceSlider.value);
  ui.priceOut.textContent = `$${offer}`;

  if (!game.current) return;
  const mood = priceMood(offer);
  ui.meterFill.style.width = `${mood.meter}%`;
  ui.meterFill.style.background = mood.color;
  ui.meterText.textContent = mood.text;
}

function nextItem() {
  if (game.usedItems.size >= goods.length) {
    game.usedItems.clear();
  }

  let item;
  do {
    item = pickOne(goods);
  } while (game.usedItems.has(item.name));

  game.usedItems.add(item.name);
  return item;
}

function setupRound() {
  const item = nextItem();
  const buyer = pickOne(buyers);
  const demand = buyer.demand + rnd(-0.08, 0.08);

  const floor = Math.round(item.base * buyer.tolerance);
  const maxPay = Math.round(item.base * demand);
  const cost = Math.round(item.base * rnd(0.48, 0.72));
  const sweetLow = Math.round(item.base * (demand - 0.12));
  const sweetHigh = Math.round(item.base * (demand - 0.03));

  game.current = { item, buyer, floor, maxPay, cost, sweetLow, sweetHigh };
  game.quoted = false;

  ui.itemName.textContent = item.name;
  ui.buyerMood.textContent = `${buyer.type} is checking your table.`;
  ui.cost.textContent = `$${cost}`;
  ui.buzz.textContent = buyer.buzz;
  ui.hint.textContent = demand > 1.08 ? "Hot crowd" : demand < 0.95 ? "Bargain mood" : "Balanced";

  const min = Math.max(8, Math.floor(floor * 0.75));
  const max = Math.max(min + 20, maxPay + 26);
  const start = Math.round((min + max) / 2);

  ui.priceSlider.min = String(min);
  ui.priceSlider.max = String(max);
  ui.priceSlider.value = String(start);

  ui.priceSlider.disabled = false;
  ui.quoteBtn.disabled = false;
  ui.nextBtn.disabled = true;

  refreshSliderLabel();
}

function openDay() {
  ensureAudio();

  game.round = 0;
  game.cash = 120;
  game.profit = 0;
  game.streak = 0;
  game.active = true;
  game.finished = false;
  game.quoted = false;
  game.usedItems.clear();

  ui.log.innerHTML = "";
  pushLog("Market shutters up. First customer incoming.");

  ui.startBtn.textContent = "Restart Day";
  ui.nextBtn.textContent = "Next Customer";
  updateHud();
  advanceRound();
}

function advanceRound() {
  if (!game.active) return;

  if (game.round >= game.totalRounds && game.quoted) {
    finishDay();
    return;
  }

  game.round += 1;
  updateHud();

  setupRound();
}

function closeDeal() {
  if (!game.active || game.quoted || !game.current) return;

  const offer = Number(ui.priceSlider.value);
  const { item, buyer, floor, maxPay, cost, sweetLow, sweetHigh } = game.current;

  game.quoted = true;
  ui.quoteBtn.disabled = true;
  ui.priceSlider.disabled = true;

  if (offer >= floor && offer <= maxPay) {
    const margin = offer - cost;
    let bonus = 0;
    game.streak += 1;

    if (offer >= sweetLow && offer <= sweetHigh) {
      bonus = Math.min(8, game.streak * 2);
    }

    const totalGain = margin + bonus;
    game.profit += totalGain;
    game.cash += totalGain;

    const badge = bonus > 0 ? ` +$${bonus} streak bonus` : "";
    pushLog(`Sold ${item.name} to ${buyer.type} for $${offer} (${totalGain >= 0 ? "+" : ""}$${totalGain}${badge}).`, "good");
    ui.meterText.textContent = totalGain >= 0
      ? `Deal closed. Profit ${totalGain >= 0 ? "+" : ""}$${totalGain}.`
      : `Deal closed, but you ate a loss of $${Math.abs(totalGain)}.`;

    beep(640, 0.08, "triangle", 0.06);
    beep(860, 0.07, "square", 0.045);
  } else {
    game.streak = 0;
    const reason = offer < floor
      ? `Too low. ${buyer.type} thinks it's not worth carrying home.`
      : `Too high. ${buyer.type} walks to the next booth.`;

    pushLog(`No sale on ${item.name}. ${reason}`, "bad");
    ui.meterText.textContent = reason;

    beep(180, 0.12, "sawtooth", 0.05);
  }

  updateHud();
  ui.nextBtn.disabled = false;

  if (game.round === game.totalRounds) {
    ui.nextBtn.textContent = "Close Booth";
  }
}

function finishDay() {
  game.active = false;
  game.finished = true;

  ui.itemName.textContent = "Market Day Complete";
  ui.buyerMood.textContent = game.profit >= 120
    ? "Legendary hustle. Other vendors are taking notes."
    : game.profit >= 60
      ? "Solid day. You kept margins healthy and shoppers happy."
      : game.profit >= 0
        ? "You survived the day. Tomorrow's strategy can be sharper."
        : "Rough day on the strip. Reset and try cleaner price reads.";

  ui.cost.textContent = "—";
  ui.buzz.textContent = game.profit >= 0 ? "Booth closed" : "Needs rebound";
  ui.hint.textContent = game.profit >= 100 ? "Hot seller" : "Try again";

  ui.quoteBtn.disabled = true;
  ui.nextBtn.disabled = true;
  ui.nextBtn.textContent = "Next Customer";
  ui.priceSlider.disabled = true;

  ui.meterFill.style.width = "100%";
  ui.meterFill.style.background = game.profit >= 0 ? "var(--hot)" : "var(--danger)";
  ui.meterText.textContent = `Final profit: ${game.profit >= 0 ? "+" : ""}$${game.profit}. Cash drawer: $${game.cash}.`;

  pushLog(`Shift ended with ${game.profit >= 0 ? "+" : ""}$${game.profit} total profit.`, game.profit >= 0 ? "good" : "bad");

  if (game.profit >= 0) {
    beep(520, 0.07, "triangle", 0.05);
    beep(780, 0.07, "square", 0.045);
    beep(980, 0.09, "triangle", 0.04);
  } else {
    beep(170, 0.16, "sawtooth", 0.05);
  }
}

ui.startBtn.addEventListener("click", openDay);
ui.quoteBtn.addEventListener("click", closeDeal);
ui.nextBtn.addEventListener("click", advanceRound);
ui.priceSlider.addEventListener("input", refreshSliderLabel);

updateHud();
pushLog("Tip: lock prices near the sweet spot for streak bonuses.");
