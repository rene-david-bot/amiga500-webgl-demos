const shopNameInput = document.getElementById('shopName');
const themeInput = document.getElementById('theme');
const toneSelect = document.getElementById('tone');
const lengthInput = document.getElementById('length');
const lengthLabel = document.getElementById('lengthLabel');
const printBtn = document.getElementById('printBtn');
const remixBtn = document.getElementById('remixBtn');
const copyBtn = document.getElementById('copyBtn');
const receiptEl = document.getElementById('receipt');

const vocab = {
  sweet: {
    nouns: ['starlight', 'candy rain', 'summer tape', 'window fog', 'mint sky', 'bus-stop glow'],
    verbs: ['waits', 'hums', 'dances', 'lingers', 'leans', 'returns'],
    extras: ['with soft static', 'under arcade halos', 'near the late tram', 'inside warm neon']
  },
  moody: {
    nouns: ['payphone echo', 'wet asphalt', 'dead channel', 'empty kiosk', 'backlit smoke', 'night receipt'],
    verbs: ['flickers', 'fractures', 'drifts', 'whispers', 'curls', 'stalls'],
    extras: ['past closing time', 'under failing tubes', 'in blue rain', 'with low hum']
  },
  glitch: {
    nouns: ['checksum dream', 'pixel rust', 'ghost buffer', 'lagged heartbeat', 'error bloom', 'lost packet'],
    verbs: ['stutters', 'loops', 'desyncs', 'corrupts', 'reboots', 'mirrors'],
    extras: ['at line 404', 'between two frames', 'in static bursts', 'through cracked glass']
  },
  hopeful: {
    nouns: ['sunrise token', 'fresh tape', 'open shutter', 'quiet dawn', 'station light', 'new signal'],
    verbs: ['rises', 'opens', 'arrives', 'shines', 'unfolds', 'starts'],
    extras: ['after long rain', 'beyond the tunnel', 'for one more try', 'before first train']
  }
};

let audioCtx;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function toneBeep(freq = 620, dur = 0.06, type = 'square', gainValue = 0.018, offset = 0) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const t = audioCtx.currentTime + offset;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function makeLine(theme, toneKey) {
  const tone = vocab[toneKey];
  return `${pick(tone.nouns)} ${pick(tone.verbs)} ${pick(tone.extras)} (${theme})`;
}

function money(value) {
  return value.toFixed(2).padStart(7, ' ');
}

function wrapText(line, width = 32) {
  if (line.length <= width) return [line];
  const words = line.split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function barcode(id) {
  const chars = '▌▐▍▎█▊▉';
  let out = '';
  for (let i = 0; i < 28; i += 1) {
    const index = (id.charCodeAt(i % id.length) + i * 7) % chars.length;
    out += chars[index];
  }
  return out;
}

function buildReceipt(remixOnly = false) {
  const now = new Date();
  const toneKey = toneSelect.value;
  const themeWord = themeInput.value.trim() || 'midnight';
  const lineCount = Number(lengthInput.value);
  const shop = (shopNameInput.value.trim() || 'NEON CORNER MART').toUpperCase();

  const ticketId = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const merch = ['COFFEE', 'FILM ROLL', 'ARCADE TOKEN', 'MINT GUM', 'BUS TICKET', 'POSTCARD'];
  const items = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({
    name: pick(merch),
    price: 1 + Math.random() * 6
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const tax = subtotal * 0.07;
  const total = subtotal + tax;

  const lines = [];
  lines.push('--------------------------------');
  lines.push(shop.padStart(Math.floor((32 + shop.length) / 2), ' '));
  lines.push('TERMINAL 07 · CASHIER D4VE');
  lines.push(`RECEIPT ${ticketId}`);
  lines.push(`${now.toLocaleDateString('en-GB')} ${now.toLocaleTimeString('en-GB', { hour12: false })}`);
  lines.push('--------------------------------');

  items.forEach((item) => {
    const name = item.name.padEnd(22, '.');
    lines.push(`${name}${money(item.price)} €`);
  });

  lines.push('--------------------------------');
  lines.push(`SUBTOTAL${money(subtotal)} €`);
  lines.push(`TAX 7%  ${money(tax)} €`);
  lines.push(`TOTAL    ${money(total)} €`);
  lines.push('--------------------------------');
  lines.push('POEM MODE: ENABLED');

  for (let i = 0; i < lineCount; i += 1) {
    wrapText(makeLine(themeWord, toneKey)).forEach((l) => lines.push(l));
  }

  lines.push('--------------------------------');
  lines.push(barcode(ticketId));
  lines.push('THANK YOU FOR FEELING SOMETHING');

  receiptEl.textContent = lines.join('\n');

  if (!remixOnly) {
    toneBeep(560, 0.05, 'square', 0.018, 0);
    toneBeep(740, 0.05, 'triangle', 0.015, 0.07);
    toneBeep(980, 0.04, 'square', 0.012, 0.14);
  } else {
    toneBeep(700, 0.05, 'triangle', 0.015);
  }
}

async function copyReceipt() {
  try {
    await navigator.clipboard.writeText(receiptEl.textContent);
    copyBtn.textContent = 'Copied ✓';
    toneBeep(820, 0.05, 'triangle', 0.013);
    setTimeout(() => {
      copyBtn.textContent = 'Copy Text';
    }, 1200);
  } catch (error) {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => {
      copyBtn.textContent = 'Copy Text';
    }, 1200);
  }
}

lengthInput.addEventListener('input', () => {
  lengthLabel.textContent = `${lengthInput.value} lines`;
});

printBtn.addEventListener('click', () => buildReceipt(false));
remixBtn.addEventListener('click', () => buildReceipt(true));
copyBtn.addEventListener('click', copyReceipt);

window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    buildReceipt(false);
  }
});

buildReceipt(false);
