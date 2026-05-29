const peopleGrid = document.getElementById('peopleGrid');
const taxInput = document.getElementById('taxInput');
const tipInput = document.getElementById('tipInput');
const taxLabel = document.getElementById('taxLabel');
const tipLabel = document.getElementById('tipLabel');
const itemList = document.getElementById('itemList');
const totalsGrid = document.getElementById('totalsGrid');
const summaryLine = document.getElementById('summaryLine');
const receiptOutput = document.getElementById('receiptOutput');

const rebalanceBtn = document.getElementById('rebalanceBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const clearBtn = document.getElementById('clearBtn');

const menuSets = [
  [
    ['Pepperoni Slice', 4.8],
    ['Veggie Slice', 4.6],
    ['Garlic Knots', 5.4],
    ['Mozzarella Sticks', 6.1],
    ['Arcade Cola Pitcher', 7.2],
    ['Cherry Soda', 3.2],
    ['Jukebox Fries', 4.1],
    ['Midnight Brownie', 3.9]
  ],
  [
    ['Mega Cheese Pie', 15.5],
    ['Mushroom Pie', 14.9],
    ['Hot Honey Drizzle', 2.7],
    ['Neon Lemonade', 3.4],
    ['Root Beer Float', 4.2],
    ['Onion Ring Tower', 6.8],
    ['Pinball Popcorn', 4.8]
  ],
  [
    ['Combo Slice x2', 8.9],
    ['BBQ Chicken Slice x2', 9.4],
    ['Pesto Bites', 5.1],
    ['Buffalo Wings', 8.6],
    ['Vanilla Shake', 4.7],
    ['Cabinet Credits Pack', 6.5],
    ['Cookie Plate', 4.4]
  ]
];

const state = {
  people: ['Rene', 'Mina', 'Kai', 'Jules'],
  menu: [],
  assignments: [],
  taxPct: Number(taxInput.value),
  tipPct: Number(tipInput.value),
  audio: null
};

function money(value) {
  return `€${value.toFixed(2)}`;
}

function ensureAudio() {
  if (state.audio) return;
  state.audio = new (window.AudioContext || window.webkitAudioContext)();
}

function blip(freq = 420, duration = 0.07, type = 'square', gain = 0.03) {
  if (!state.audio) return;
  const t0 = state.audio.currentTime;
  const osc = state.audio.createOscillator();
  const amp = state.audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(0.001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(amp).connect(state.audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function pickMenu() {
  const selection = menuSets[Math.floor(Math.random() * menuSets.length)];
  state.menu = selection.map(([name, price]) => ({ name, price }));
  state.assignments = new Array(state.menu.length).fill(-1);
}

function renderPeople() {
  peopleGrid.innerHTML = '';
  state.people.forEach((name, index) => {
    const wrap = document.createElement('label');
    wrap.className = 'name-card';

    const caption = document.createElement('span');
    caption.textContent = `Player ${index + 1}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.value = name;
    input.addEventListener('input', () => {
      state.people[index] = input.value.trim() || `Player ${index + 1}`;
      renderItems();
      updateTotals();
    });

    wrap.append(caption, input);
    peopleGrid.append(wrap);
  });
}

function nextAssignee(current) {
  return current === state.people.length - 1 ? -1 : current + 1;
}

function renderItems() {
  itemList.innerHTML = '';

  state.menu.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;

    const price = document.createElement('div');
    price.className = 'item-price';
    price.textContent = money(item.price);

    const btn = document.createElement('button');
    const assignee = state.assignments[index];
    btn.className = `assign-btn ${assignee === -1 ? 'unassigned' : `p${assignee}`}`;
    btn.textContent = assignee === -1 ? 'Unassigned' : state.people[assignee];
    btn.type = 'button';
    btn.addEventListener('click', () => {
      ensureAudio();
      state.assignments[index] = nextAssignee(state.assignments[index]);
      blip(assignee === -1 ? 660 : 380, 0.06, 'triangle', 0.028);
      renderItems();
      updateTotals();
    });

    row.append(name, price, btn);
    itemList.append(row);
  });
}

function buildBreakdown() {
  const personTotals = state.people.map(() => ({
    subtotal: 0,
    tax: 0,
    tip: 0,
    total: 0,
    items: []
  }));

  let unassigned = 0;

  state.menu.forEach((item, idx) => {
    const person = state.assignments[idx];
    if (person === -1) {
      unassigned += item.price;
      return;
    }
    const entry = personTotals[person];
    entry.subtotal += item.price;
    entry.items.push(item);
  });

  const taxRate = state.taxPct / 100;
  const tipRate = state.tipPct / 100;

  personTotals.forEach((entry) => {
    entry.tax = entry.subtotal * taxRate;
    entry.tip = entry.subtotal * tipRate;
    entry.total = entry.subtotal + entry.tax + entry.tip;
  });

  return { personTotals, unassigned };
}

function updateTotals() {
  taxLabel.textContent = `${state.taxPct}%`;
  tipLabel.textContent = `${state.tipPct}%`;

  const { personTotals, unassigned } = buildBreakdown();
  totalsGrid.innerHTML = '';

  personTotals.forEach((entry, index) => {
    const card = document.createElement('div');
    card.className = 'total-card';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = state.people[index];

    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = money(entry.total);

    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = `${money(entry.subtotal)} + tax ${money(entry.tax)} + tip ${money(entry.tip)}`;

    card.append(name, value, detail);
    totalsGrid.append(card);
  });

  const totals = personTotals.map((p) => p.total);
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  const spread = max - min;

  summaryLine.textContent = `Unassigned: ${money(unassigned)} · Fairness spread: ${money(spread)} · Grand total: ${money(totals.reduce((a, b) => a + b, 0) + unassigned * (1 + state.taxPct / 100 + state.tipPct / 100))}`;

  updateReceipt(personTotals, unassigned);
}

function updateReceipt(personTotals, unassigned) {
  const lines = [];
  lines.push('PIZZA PARLOR SPLITTER 97');
  lines.push('------------------------------');
  lines.push(`Tax ${state.taxPct}%  Tip ${state.tipPct}%`);
  lines.push('');

  personTotals.forEach((entry, index) => {
    lines.push(`${state.people[index].toUpperCase()}`);
    if (!entry.items.length) {
      lines.push('  (no assigned items)');
    } else {
      entry.items.forEach((item) => lines.push(`  ${item.name.padEnd(20, '.')} ${money(item.price)}`));
    }
    lines.push(`  SUBTOTAL ${money(entry.subtotal)}`);
    lines.push(`  TAX      ${money(entry.tax)}`);
    lines.push(`  TIP      ${money(entry.tip)}`);
    lines.push(`  TOTAL    ${money(entry.total)}`);
    lines.push('');
  });

  if (unassigned > 0) {
    lines.push(`UNASSIGNED ITEMS: ${money(unassigned)}`);
    lines.push('Assign all rows for a perfect split.');
    lines.push('');
  }

  const finalTotal = personTotals.reduce((sum, p) => sum + p.total, 0);
  lines.push('------------------------------');
  lines.push(`PAID TOTAL ${money(finalTotal)}`);
  lines.push('Thanks for playing accountant.');

  receiptOutput.textContent = lines.join('\n');
}

function clearAssignments() {
  state.assignments.fill(-1);
  renderItems();
  updateTotals();
}

function autoBalance() {
  ensureAudio();
  const { personTotals } = buildBreakdown();

  const unassignedIdx = state.assignments
    .map((value, idx) => ({ value, idx }))
    .filter((entry) => entry.value === -1)
    .map((entry) => entry.idx)
    .sort((a, b) => state.menu[b].price - state.menu[a].price);

  unassignedIdx.forEach((itemIdx) => {
    let lowest = 0;
    for (let i = 1; i < personTotals.length; i += 1) {
      if (personTotals[i].subtotal < personTotals[lowest].subtotal) {
        lowest = i;
      }
    }
    state.assignments[itemIdx] = lowest;
    personTotals[lowest].subtotal += state.menu[itemIdx].price;
  });

  blip(920, 0.08, 'square', 0.033);
  blip(1240, 0.09, 'triangle', 0.02);
  renderItems();
  updateTotals();
}

function newMenu() {
  ensureAudio();
  pickMenu();
  blip(540, 0.08, 'sawtooth', 0.026);
  renderItems();
  updateTotals();
}

taxInput.addEventListener('input', () => {
  state.taxPct = Number(taxInput.value);
  updateTotals();
});

tipInput.addEventListener('input', () => {
  state.tipPct = Number(tipInput.value);
  updateTotals();
});

rebalanceBtn.addEventListener('click', autoBalance);
shuffleBtn.addEventListener('click', newMenu);
clearBtn.addEventListener('click', clearAssignments);

document.addEventListener('pointerdown', ensureAudio, { once: true });

pickMenu();
renderPeople();
renderItems();
updateTotals();
