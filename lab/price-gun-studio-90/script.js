const canvas = document.getElementById('strip');
const ctx = canvas.getContext('2d');

const itemInput = document.getElementById('item-name');
const priceInput = document.getElementById('item-price');
const accentSelect = document.getElementById('accent');
const addBtn = document.getElementById('add');
const sampleBtn = document.getElementById('sample');
const clearBtn = document.getElementById('clear');
const exportBtn = document.getElementById('export');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');

const PALETTES = {
    sunset: { tape: '#ffb054', edge: '#8f3f11', ink: '#2b1305', glow: 'rgba(255, 176, 84, 0.35)' },
    mint: { tape: '#8dffbc', edge: '#246347', ink: '#062614', glow: 'rgba(141, 255, 188, 0.34)' },
    magenta: { tape: '#ff86df', edge: '#72245a', ink: '#2b0a21', glow: 'rgba(255, 134, 223, 0.32)' },
    ice: { tape: '#9be7ff', edge: '#245e81', ink: '#082234', glow: 'rgba(155, 231, 255, 0.31)' }
};

const SAMPLE_ITEMS = [
    'Laser Cola',
    'Turbo Cereal',
    'Pocket Joystick',
    'Pixel Beans',
    'Arcade Gum',
    'CRT Cleaner',
    'VHS Head Fluid',
    'Neon Socks',
    'After Midnight Chips',
    'Synthpop Battery'
];

const labels = [];
let audioCtx;

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function playStampSound() {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.06);

    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
}

function playExportChime() {
    if (!audioCtx) return;

    [420, 620, 840].forEach((freq, index) => {
        const now = audioCtx.currentTime + index * 0.06;
        const osc = audioCtx.createOscillator();
        const amp = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(0.045, now + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(amp);
        amp.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
    });
}

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function randomSku() {
    const a = Math.floor(Math.random() * 900) + 100;
    const b = Math.floor(Math.random() * 9000) + 1000;
    return `${a}-${b}`;
}

function formatPrice(value) {
    return `€${value.toFixed(2)}`;
}

function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#1a2d5a');
    grad.addColorStop(1, '#0d1b39');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
        ctx.fillRect(0, y, canvas.width, 1);
    }

    ctx.strokeStyle = 'rgba(114, 151, 236, 0.3)';
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
}

function drawPerforation(x, y, h, side) {
    ctx.fillStyle = 'rgba(16, 20, 40, 0.55)';
    for (let i = y + 8; i < y + h - 8; i += 12) {
        const dotX = side === 'left' ? x + 4 : x - 4;
        ctx.beginPath();
        ctx.arc(dotX, i, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawLabel(label, index) {
    const rows = 3;
    const cols = 3;
    const slot = 290;
    const w = 262;
    const h = 140;
    const gapX = 16;
    const gapY = 16;

    const col = index % cols;
    const row = Math.floor(index / cols);

    if (row >= rows) return;

    const x = 22 + col * (w + gapX);
    const y = 22 + row * (h + gapY);
    const palette = PALETTES[label.accent];

    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = palette.tape;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    drawPerforation(x, y, h, 'left');
    drawPerforation(x + w, y, h, 'right');

    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(x + 2, y + 2, w - 4, 14);

    ctx.fillStyle = palette.ink;
    ctx.font = '700 14px "Courier New", monospace';
    ctx.fillText('MARKDOWN SPECIAL', x + 12, y + 22);

    ctx.font = '700 22px "Courier New", monospace';
    ctx.fillText(label.name.toUpperCase().slice(0, 18), x + 12, y + 58);

    ctx.font = '900 44px "Courier New", monospace';
    ctx.fillText(formatPrice(label.price), x + 12, y + 106);

    ctx.font = '700 13px "Courier New", monospace';
    ctx.fillText(`#${label.sku}`, x + 172, y + 108);

    ctx.font = '700 12px "Courier New", monospace';
    ctx.fillText(label.stamp, x + 12, y + 126);
}

function render() {
    drawBackground();

    labels.slice(-9).forEach((label, idx) => drawLabel(label, idx));

    countEl.textContent = String(labels.length);

    if (!labels.length) {
        ctx.fillStyle = 'rgba(225, 238, 255, 0.8)';
        ctx.font = '700 22px "Courier New", monospace';
        ctx.fillText('NO LABELS STAMPED YET', 280, 245);
        ctx.font = '600 14px "Courier New", monospace';
        ctx.fillText('Add an item + price, then hit STAMP LABEL', 250, 276);
    }

    if (labels.length > 9) {
        ctx.fillStyle = 'rgba(225, 238, 255, 0.85)';
        ctx.font = '700 12px "Courier New", monospace';
        ctx.fillText(`Showing latest 9 of ${labels.length} labels`, 684, 505);
    }
}

function stampLabel(itemName, price, accent) {
    labels.push({
        name: itemName,
        price,
        accent,
        sku: randomSku(),
        stamp: new Date().toISOString().slice(0, 10)
    });

    render();
}

function readInputs() {
    const name = itemInput.value.trim();
    const price = Number(priceInput.value);

    if (!name) {
        setStatus('Item name missing — give the sticker a product.', 'bad');
        return null;
    }

    if (!Number.isFinite(price) || price <= 0 || price > 999.99) {
        setStatus('Price must be between 0.05 and 999.99.', 'bad');
        return null;
    }

    return {
        name,
        price: Number(price.toFixed(2)),
        accent: accentSelect.value
    };
}

addBtn.addEventListener('click', () => {
    const payload = readInputs();
    if (!payload) return;

    ensureAudio();
    playStampSound();

    stampLabel(payload.name, payload.price, payload.accent);
    setStatus(`Stamped: ${payload.name} at ${formatPrice(payload.price)}.`, 'good');
});

sampleBtn.addEventListener('click', () => {
    const name = SAMPLE_ITEMS[Math.floor(Math.random() * SAMPLE_ITEMS.length)];
    const price = Number((Math.random() * 11 + 0.79).toFixed(2));
    const accents = Object.keys(PALETTES);
    const accent = accents[Math.floor(Math.random() * accents.length)];

    itemInput.value = name;
    priceInput.value = price.toFixed(2);
    accentSelect.value = accent;

    ensureAudio();
    playStampSound();

    stampLabel(name, price, accent);
    setStatus(`Surprise label stamped: ${name}.`, 'good');
});

clearBtn.addEventListener('click', () => {
    if (!labels.length) {
        setStatus('Strip is already empty.', 'bad');
        return;
    }

    labels.length = 0;
    render();

    ensureAudio();
    playStampSound();
    setStatus('Label strip cleared. Ready for the next markdown wave.', 'good');
});

exportBtn.addEventListener('click', () => {
    if (!labels.length) {
        setStatus('Stamp at least one label before exporting.', 'bad');
        return;
    }

    const link = document.createElement('a');
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = canvas.toDataURL('image/png');
    link.download = `price-gun-strip-${safeDate}.png`;
    link.click();

    ensureAudio();
    playExportChime();
    setStatus('PNG exported. Shelf team approved.', 'good');
});

render();
