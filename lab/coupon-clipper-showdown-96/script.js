const basketLabel = document.getElementById('basketLabel');
const weekLabel = document.getElementById('weekLabel');
const savingsLabel = document.getElementById('savingsLabel');
const targetLabel = document.getElementById('targetLabel');
const leftLabel = document.getElementById('leftLabel');
const originalTotal = document.getElementById('originalTotal');
const checkoutTotal = document.getElementById('checkoutTotal');
const cartList = document.getElementById('cartList');
const couponRack = document.getElementById('couponRack');
const receipt = document.getElementById('receipt');
const statusLabel = document.getElementById('statusLabel');
const newWeekBtn = document.getElementById('newWeekBtn');
const checkoutBtn = document.getElementById('checkoutBtn');
const audioBtn = document.getElementById('audioBtn');

const PRODUCT_POOL = [
  { name: 'Milk Carton', category: 'dairy', min: 1.4, max: 2.4 },
  { name: 'Cheddar Block', category: 'dairy', min: 2.8, max: 4.1 },
  { name: 'Butter Pack', category: 'dairy', min: 1.9, max: 3.2 },
  { name: 'Cereal Box', category: 'pantry', min: 2.7, max: 4.9 },
  { name: 'Tomato Soup', category: 'pantry', min: 1.2, max: 2.6 },
  { name: 'Pasta Bundle', category: 'pantry', min: 1.1, max: 2.1 },
  { name: 'Soda 6-Pack', category: 'beverage', min: 3.8, max: 6.3 },
  { name: 'Orange Juice', category: 'beverage', min: 2.2, max: 3.8 },
  { name: 'Sparkling Water', category: 'beverage', min: 1.5, max: 3.1 },
  { name: 'Frozen Pizza', category: 'frozen', min: 3.4, max: 5.8 },
  { name: 'Fish Sticks', category: 'frozen', min: 2.9, max: 4.8 },
  { name: 'Veggie Mix', category: 'frozen', min: 2.1, max: 3.7 },
  { name: 'Laundry Pods', category: 'household', min: 4.8, max: 7.2 },
  { name: 'Paper Towels', category: 'household', min: 2.6, max: 4.4 },
  { name: 'Dish Soap', category: 'household', min: 1.8, max: 3.3 },
  { name: 'Chips Family Bag', category: 'snacks', min: 2.2, max: 3.9 },
  { name: 'Chocolate Bar Set', category: 'snacks', min: 1.8, max: 3.1 },
  { name: 'Cracker Box', category: 'snacks', min: 1.6, max: 2.9 }
];

const COUPON_TEMPLATES = [
  { title: 'Dairy Dive 25%', desc: '25% off all dairy items.', kind: 'category', category: 'dairy', pct: 0.25 },
  { title: 'Pantry Punch 20%', desc: '20% off pantry staples.', kind: 'category', category: 'pantry', pct: 0.2 },
  { title: 'Freezer Flash 22%', desc: '22% off frozen picks.', kind: 'category', category: 'frozen', pct: 0.22 },
  { title: 'Snack Slash 30%', desc: '30% off all snack items.', kind: 'category', category: 'snacks', pct: 0.3 },
  { title: 'Household Helper 18%', desc: '18% off household goods.', kind: 'category', category: 'household', pct: 0.18 },
  { title: 'Fizz Frenzy 24%', desc: '24% off beverages.', kind: 'category', category: 'beverage', pct: 0.24 },
  { title: 'Mega Basket 10%', desc: '10% off whole basket over DM 28.', kind: 'cart', pct: 0.1, minSubtotal: 28 },
  { title: 'Jumbo Basket 14%', desc: '14% off whole basket over DM 38.', kind: 'cart', pct: 0.14, minSubtotal: 38 },
  { title: 'Big Ticket 35%', desc: '35% off your priciest line item.', kind: 'max-item', pct: 0.35 },
  { title: 'Twin Pack Bonus', desc: 'DM 1.30 off each item with quantity 2+.', kind: 'qty-bonus', minQty: 2, amount: 1.3 },
  { title: 'Flat DM 4 Saver', desc: 'Straight DM 4 off baskets over DM 24.', kind: 'flat', amount: 4, minSubtotal: 24 },
  { title: 'Manager Markdown', desc: 'DM 2.50 off if basket has 4+ categories.', kind: 'category-count', amount: 2.5, minCategories: 4 }
];

const state = {
  week: 1,
  cart: [],
  coupons: [],
  applied: [],
  couponsLeft: 4,
  targetPct: 25,
  checkedOut: false,
  audioOn: false,
  audioCtx: null
};

function dm(value) {
  return `DM ${value.toFixed(2)}`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(source, count) {
  const pool = [...source];
  const picked = [];
  while (pool.length && picked.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function buildWeek(incrementWeek = false) {
  if (incrementWeek) state.week += 1;
  state.checkedOut = false;
  state.applied = [];
  state.couponsLeft = 4;

  const selectedProducts = pickRandom(PRODUCT_POOL, 8);
  state.cart = selectedProducts.map((product, i) => {
    const qty = 1 + Math.floor(Math.random() * 3);
    const unit = randomBetween(product.min, product.max);
    return {
      id: `${product.name}-${i}`,
      name: product.name,
      category: product.category,
      qty,
      unit: Number(unit.toFixed(2))
    };
  });

  state.coupons = pickRandom(COUPON_TEMPLATES, 6).map((coupon, idx) => ({
    ...coupon,
    id: `coupon-${idx}`,
    used: false
  }));

  state.targetPct = 18 + Math.floor(Math.random() * 14);
  render();
  setStatus('Clip up to four coupons and hit the target savings before checkout.', 'info');
}

function subtotal() {
  return state.cart.reduce((sum, item) => sum + item.qty * item.unit, 0);
}

function categoryTotals() {
  const map = new Map();
  for (const item of state.cart) {
    map.set(item.category, (map.get(item.category) || 0) + item.qty * item.unit);
  }
  return map;
}

function evaluateCoupon(coupon) {
  const base = subtotal();
  const byCategory = categoryTotals();

  if (coupon.kind === 'category') {
    return (byCategory.get(coupon.category) || 0) * coupon.pct;
  }

  if (coupon.kind === 'cart') {
    if (base < coupon.minSubtotal) return 0;
    return base * coupon.pct;
  }

  if (coupon.kind === 'max-item') {
    const highestLine = state.cart.reduce((max, item) => Math.max(max, item.qty * item.unit), 0);
    return highestLine * coupon.pct;
  }

  if (coupon.kind === 'qty-bonus') {
    return state.cart
      .filter((item) => item.qty >= coupon.minQty)
      .reduce((sum, item) => sum + coupon.amount, 0);
  }

  if (coupon.kind === 'flat') {
    return base >= coupon.minSubtotal ? coupon.amount : 0;
  }

  if (coupon.kind === 'category-count') {
    const uniqueCategories = new Set(state.cart.map((item) => item.category)).size;
    return uniqueCategories >= coupon.minCategories ? coupon.amount : 0;
  }

  return 0;
}

function currentDiscount() {
  const raw = state.applied.reduce((sum, row) => sum + row.amount, 0);
  return Math.min(raw, subtotal() * 0.85);
}

function savingsPct() {
  const base = subtotal();
  if (base <= 0) return 0;
  return (currentDiscount() / base) * 100;
}

function applyCoupon(couponId) {
  if (state.checkedOut) return;

  const coupon = state.coupons.find((entry) => entry.id === couponId);
  if (!coupon || coupon.used) return;

  if (state.couponsLeft <= 0) {
    setStatus('No coupons left. Hit checkout or start a new week.', 'bad');
    chirp(180, 0.08, 'sawtooth');
    return;
  }

  const amount = Number(evaluateCoupon(coupon).toFixed(2));
  if (amount <= 0) {
    setStatus(`"${coupon.title}" has no match in this basket.`, 'bad');
    chirp(190, 0.06, 'triangle');
    return;
  }

  coupon.used = true;
  state.applied.push({
    title: coupon.title,
    amount
  });
  state.couponsLeft -= 1;

  chirp(420, 0.05, 'square');
  chirp(590, 0.06, 'square', 0.012, 0.03);

  const pct = savingsPct();
  if (pct >= state.targetPct) {
    setStatus(`Target met already (${pct.toFixed(1)}%). You can still optimize before checkout.`, 'good');
  } else {
    setStatus(`Coupon clipped: ${coupon.title} (-${dm(amount)}).`, 'info');
  }

  render();
}

function checkout() {
  if (state.checkedOut) return;
  state.checkedOut = true;

  const pct = savingsPct();
  const diff = pct - state.targetPct;

  if (diff >= 0) {
    const score = Math.round(pct * 11 + state.couponsLeft * 45);
    setStatus(`Checkout complete. Target crushed by ${diff.toFixed(1)}% · Score ${score}`, 'good');
    chirp(660, 0.08, 'square');
    chirp(880, 0.09, 'square', 0.01, 0.05);
  } else {
    setStatus(`Checkout complete. Missed target by ${Math.abs(diff).toFixed(1)}%. Try another week.`, 'bad');
    chirp(220, 0.1, 'sawtooth');
  }

  render();
}

function renderCart() {
  cartList.innerHTML = '';
  for (const item of state.cart) {
    const lineTotal = item.qty * item.unit;
    const row = document.createElement('li');
    row.className = 'cart-row';
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="cart-meta">${item.category.toUpperCase()} · Qty ${item.qty} · ${dm(item.unit)} each</div>
      </div>
      <strong>${dm(lineTotal)}</strong>
    `;
    cartList.appendChild(row);
  }
}

function renderCoupons() {
  couponRack.innerHTML = '';
  for (const coupon of state.coupons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `coupon${coupon.used ? ' used' : ''}`;
    btn.disabled = coupon.used || state.checkedOut || state.couponsLeft <= 0;
    btn.innerHTML = `
      <span class="coupon-title">${coupon.title}</span>
      <span class="coupon-desc">${coupon.desc}</span>
    `;
    btn.addEventListener('click', () => applyCoupon(coupon.id));
    couponRack.appendChild(btn);
  }
}

function renderReceipt() {
  const base = subtotal();
  const discount = currentDiscount();
  const finalTotal = Math.max(0, base - discount);
  const pct = savingsPct();

  const lines = [];
  lines.push('COUPON CLIPPER SHOWDOWN 96');
  lines.push(`WEEK ${String(state.week).padStart(2, '0')}  ·  TARGET ${state.targetPct}%`);
  lines.push('--------------------------------');
  for (const item of state.cart) {
    const lineTotal = item.qty * item.unit;
    lines.push(`${item.name.slice(0, 21).padEnd(21, ' ')} ${dm(lineTotal)}`);
  }
  lines.push('--------------------------------');
  if (state.applied.length === 0) {
    lines.push('NO COUPONS CLIPPED');
  } else {
    for (const applied of state.applied) {
      lines.push(`${applied.title.slice(0, 21).padEnd(21, ' ')} -${dm(applied.amount)}`);
    }
  }
  lines.push('--------------------------------');
  lines.push(`ORIGINAL TOTAL          ${dm(base)}`);
  lines.push(`YOU SAVED               ${dm(discount)}`);
  lines.push(`CHECKOUT TOTAL          ${dm(finalTotal)}`);
  lines.push(`SAVINGS RATE            ${pct.toFixed(1)}%`);

  if (state.checkedOut) {
    lines.push('--------------------------------');
    lines.push(pct >= state.targetPct ? 'RESULT: TARGET BEAT ✅' : 'RESULT: TRY NEXT WEEK ❌');
  }

  receipt.textContent = lines.join('\n');
}

function renderStats() {
  const base = subtotal();
  const discount = currentDiscount();
  const finalTotal = Math.max(0, base - discount);

  weekLabel.textContent = String(state.week).padStart(2, '0');
  basketLabel.textContent = dm(base);
  savingsLabel.textContent = dm(discount);
  targetLabel.textContent = `${state.targetPct}%`;
  leftLabel.textContent = String(state.couponsLeft);
  originalTotal.textContent = dm(base);
  checkoutTotal.textContent = dm(finalTotal);

  checkoutBtn.disabled = state.checkedOut;
}

function render() {
  renderCart();
  renderCoupons();
  renderReceipt();
  renderStats();
}

function setStatus(message, tone = 'info') {
  statusLabel.textContent = message;
  statusLabel.classList.remove('good', 'bad');
  if (tone === 'good') statusLabel.classList.add('good');
  if (tone === 'bad') statusLabel.classList.add('bad');
}

function ensureAudioContext() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function chirp(freq, duration, type = 'square', gain = 0.016, delay = 0) {
  if (!state.audioOn) return;
  ensureAudioContext();

  const now = state.audioCtx.currentTime + delay;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

newWeekBtn.addEventListener('click', () => {
  buildWeek(true);
  chirp(320, 0.05, 'triangle');
  chirp(520, 0.07, 'triangle', 0.011, 0.04);
});

checkoutBtn.addEventListener('click', checkout);

audioBtn.addEventListener('click', () => {
  state.audioOn = !state.audioOn;
  if (state.audioOn) {
    ensureAudioContext();
    chirp(510, 0.06, 'square');
    setStatus('Audio enabled. Clip rhythmically for bonus vibes.', 'info');
    audioBtn.textContent = 'Audio: On';
  } else {
    audioBtn.textContent = 'Audio: Off';
    setStatus('Audio muted. Silent coupon warfare engaged.', 'info');
  }
});

buildWeek(false);
