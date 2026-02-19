const canvas = document.getElementById('postcard');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const themeSelect = document.getElementById('theme');
const locationInput = document.getElementById('location');
const taglineInput = document.getElementById('tagline');
const printBtn = document.getElementById('print');
const downloadBtn = document.getElementById('download');
const soundBtn = document.getElementById('sound');
const statusEl = document.getElementById('status');

const themes = {
    sunset: {
        skyTop: '#2b1055',
        skyMid: '#ff1e56',
        skyBottom: '#ffb86c',
        sun: '#ffd27d',
        sunStripe: '#ff7b54',
        ground: '#20152b',
        grid: '#8f43ee',
        border: '#f9e65e',
        stamp: '#ffd27d',
        text: '#fff6d6',
        textSoft: '#ffe7a7'
    },
    ocean: {
        skyTop: '#0a2f5f',
        skyMid: '#1e6dd9',
        skyBottom: '#4dd6ff',
        sun: '#ffe5a6',
        sunStripe: '#ffb347',
        ground: '#04182c',
        grid: '#54c3ff',
        border: '#a6f3ff',
        stamp: '#ffe5a6',
        text: '#e6fbff',
        textSoft: '#bfeaff'
    },
    neon: {
        skyTop: '#1b0038',
        skyMid: '#7b2cff',
        skyBottom: '#ff5f9e',
        sun: '#ffe26f',
        sunStripe: '#ff9f5a',
        ground: '#0b0018',
        grid: '#39ffea',
        border: '#ffe26f',
        stamp: '#39ffea',
        text: '#fff4d1',
        textSoft: '#ffd1f0'
    },
    forest: {
        skyTop: '#0b2e2f',
        skyMid: '#1b6b5a',
        skyBottom: '#5fd6a7',
        sun: '#f6d878',
        sunStripe: '#f4a95f',
        ground: '#0b1c17',
        grid: '#7af6c5',
        border: '#f6d878',
        stamp: '#f6d878',
        text: '#ecfff2',
        textSoft: '#c5f6df'
    }
};

let stars = [];
let soundOn = false;
let audioCtx = null;

const W = canvas.width;
const H = canvas.height;
const horizon = Math.floor(H * 0.56);

function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return { r, g, b };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(a, b, t) {
    const c1 = hexToRgb(a);
    const c2 = hexToRgb(b);
    const r = Math.round(lerp(c1.r, c2.r, t));
    const g = Math.round(lerp(c1.g, c2.g, t));
    const bVal = Math.round(lerp(c1.b, c2.b, t));
    return `rgb(${r}, ${g}, ${bVal})`;
}

function makeStars() {
    stars = Array.from({ length: 28 }, () => ({
        x: Math.floor(Math.random() * W),
        y: Math.floor(Math.random() * (horizon - 10)),
        size: Math.random() > 0.8 ? 2 : 1
    }));
}

function drawGradient(theme) {
    for (let y = 0; y < horizon; y++) {
        const t = y / horizon;
        let color;
        if (t < 0.5) {
            color = lerpColor(theme.skyTop, theme.skyMid, t * 2);
        } else {
            color = lerpColor(theme.skyMid, theme.skyBottom, (t - 0.5) * 2);
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, y, W, 1);
    }
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, horizon, W, H - horizon);
}

function drawSun(theme) {
    const sunX = Math.floor(W * 0.3);
    const sunY = Math.floor(H * 0.35);
    const radius = 28;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = theme.sun;
    ctx.fillRect(sunX - radius, sunY - radius, radius * 2, radius * 2);

    ctx.fillStyle = theme.sunStripe;
    for (let y = sunY - radius; y < sunY + radius; y += 6) {
        ctx.fillRect(sunX - radius, y, radius * 2, 2);
    }
    ctx.restore();
}

function drawGrid(theme) {
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;

    const depth = H - horizon - 6;
    for (let i = 0; i < 11; i++) {
        const t = (i + 1) / 11;
        const y = horizon + Math.pow(t, 2.2) * depth;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }

    for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * W;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.lineTo(W / 2, horizon);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function drawStars(theme) {
    ctx.fillStyle = theme.text;
    stars.forEach((star) => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
}

function drawStamp(theme) {
    const stampW = 34;
    const stampH = 26;
    const x = W - stampW - 10;
    const y = 10;
    ctx.fillStyle = theme.stamp;
    ctx.fillRect(x, y, stampW, stampH);
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(x + 2, y + 2, stampW - 4, stampH - 4);

    ctx.fillStyle = theme.ground;
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText('AIR', x + 8, y + 16);
}

function fitText(text, maxChars) {
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function drawText(theme) {
    const location = fitText(locationInput.value.trim().toUpperCase() || 'DRESDEN', 18);
    const tagline = fitText(taglineInput.value.trim() || 'Wish you were here', 26);

    ctx.fillStyle = theme.text;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(location, 12, 22);

    ctx.fillStyle = theme.textSoft;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(tagline, 12, H - 10);
}

function drawBorder(theme) {
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, W - 4, H - 4);
}

function render() {
    const theme = themes[themeSelect.value] || themes.sunset;
    ctx.clearRect(0, 0, W, H);
    drawGradient(theme);
    drawStars(theme);
    drawSun(theme);
    drawGrid(theme);
    drawStamp(theme);
    drawText(theme);
    drawBorder(theme);
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playPrintSound() {
    if (!soundOn) return;
    ensureAudio();
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(170, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(620, now);
    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click.connect(clickGain).connect(audioCtx.destination);
    click.start(now);
    click.stop(now + 0.06);
}

function setStatus(text) {
    statusEl.textContent = text;
}

printBtn.addEventListener('click', () => {
    makeStars();
    render();
    playPrintSound();
    setStatus('Printed! Try another theme or change the text.');
});

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `pixel-postcard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    playPrintSound();
    setStatus('PNG downloaded. Send it to a friend.');
});

soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn) {
        ensureAudio();
    }
    soundBtn.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
    setStatus(soundOn ? 'Printer audio enabled.' : 'Printer audio muted.');
});

themeSelect.addEventListener('change', render);
locationInput.addEventListener('input', render);
taglineInput.addEventListener('input', render);

makeStars();
render();
