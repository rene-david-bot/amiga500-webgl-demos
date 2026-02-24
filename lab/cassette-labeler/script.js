const canvas = document.getElementById('cassette');
const ctx = canvas.getContext('2d');

const titleInput = document.getElementById('title');
const artistInput = document.getElementById('artist');
const sideAInput = document.getElementById('sideA');
const sideBInput = document.getElementById('sideB');
const catalogInput = document.getElementById('catalog');
const styleSelect = document.getElementById('style');
const tapeTypeSelect = document.getElementById('tapeType');
const statusEl = document.getElementById('status');

const printBtn = document.getElementById('print');
const downloadBtn = document.getElementById('download');
const soundBtn = document.getElementById('sound');

const styles = {
    sunburst: {
        bg: '#0b0d16',
        grid: 'rgba(255, 173, 92, 0.12)',
        body: '#2a2f3c',
        bodyEdge: '#b8c4dd',
        bodyShadow: 'rgba(0,0,0,0.35)',
        label: '#f6efe4',
        labelEdge: '#d4c3ae',
        accent: '#ff7a38',
        accent2: '#ffc866',
        text: '#1b1b1f',
        window: '#10151f',
        reel: '#cfd7e6',
        reelShadow: '#5b6475',
        sticker: '#ff7f6b'
    },
    grid: {
        bg: '#090f1b',
        grid: 'rgba(90, 144, 212, 0.2)',
        body: '#1f2a3b',
        bodyEdge: '#95a7c4',
        bodyShadow: 'rgba(0,0,0,0.4)',
        label: '#e1e8f4',
        labelEdge: '#a7b6d1',
        accent: '#7bd6ff',
        accent2: '#9afad6',
        text: '#1b2233',
        window: '#0e131b',
        reel: '#dfe8f7',
        reelShadow: '#5b6a84',
        sticker: '#7bd6ff'
    },
    slate: {
        bg: '#0a0b0f',
        grid: 'rgba(130, 138, 156, 0.18)',
        body: '#2b2d34',
        bodyEdge: '#a2a9b8',
        bodyShadow: 'rgba(0,0,0,0.45)',
        label: '#dfe3ea',
        labelEdge: '#a9b2c3',
        accent: '#9aa6b8',
        accent2: '#c2c9d6',
        text: '#1b1e25',
        window: '#12151b',
        reel: '#cfd5e1',
        reelShadow: '#616879',
        sticker: '#ffc866'
    },
    citrus: {
        bg: '#0b0c16',
        grid: 'rgba(255, 213, 104, 0.16)',
        body: '#283042',
        bodyEdge: '#c4d0e6',
        bodyShadow: 'rgba(0,0,0,0.36)',
        label: '#fff4db',
        labelEdge: '#d6c7a8',
        accent: '#ffc84f',
        accent2: '#ff7d6a',
        text: '#1f1d1c',
        window: '#0e131c',
        reel: '#dce4f2',
        reelShadow: '#616b7a',
        sticker: '#ff7d6a'
    },
    ocean: {
        bg: '#070d18',
        grid: 'rgba(109, 240, 220, 0.14)',
        body: '#1f2c37',
        bodyEdge: '#8fc0c3',
        bodyShadow: 'rgba(0,0,0,0.4)',
        label: '#e2f4f3',
        labelEdge: '#a8cbc6',
        accent: '#6df0dc',
        accent2: '#4c9bff',
        text: '#11202a',
        window: '#0a1218',
        reel: '#d1f0ee',
        reelShadow: '#5a7e85',
        sticker: '#4c9bff'
    }
};

let soundEnabled = false;
let audioCtx;

const fit = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const roundedRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const drawScrew = (x, y, palette) => {
    ctx.fillStyle = palette.reelShadow;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.reel;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 2, y);
    ctx.stroke();
};

const drawSpool = (cx, cy, palette) => {
    ctx.fillStyle = palette.reel;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.window;
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.reelShadow;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * 26, cy + Math.sin(angle) * 26);
        ctx.stroke();
    }
    ctx.fillStyle = palette.reel;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
};

const render = (flash = false) => {
    const palette = styles[styleSelect.value];
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = 0; y < h; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    const body = { x: 90, y: 80, w: 540, h: 250, r: 22 };
    ctx.fillStyle = palette.bodyShadow;
    roundedRect(body.x + 8, body.y + 10, body.w, body.h, body.r);
    ctx.fill();

    ctx.fillStyle = palette.body;
    roundedRect(body.x, body.y, body.w, body.h, body.r);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.bodyEdge;
    ctx.stroke();

    const label = { x: 130, y: 102, w: 460, h: 110 };
    ctx.fillStyle = palette.label;
    ctx.fillRect(label.x, label.y, label.w, label.h);
    ctx.strokeStyle = palette.labelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(label.x, label.y, label.w, label.h);

    ctx.fillStyle = palette.accent;
    ctx.fillRect(label.x, label.y, label.w, 8);
    ctx.fillStyle = palette.accent2;
    ctx.fillRect(label.x, label.y + label.h - 10, label.w, 6);

    ctx.fillStyle = palette.sticker;
    ctx.beginPath();
    ctx.arc(label.x + label.w - 26, label.y + 26, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.text;
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText(fit(titleInput.value, 22), label.x + 16, label.y + 36);
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(fit(artistInput.value, 22), label.x + 16, label.y + 60);
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText(`Side A: ${fit(sideAInput.value, 14)}`, label.x + 16, label.y + 84);
    ctx.fillText(`Side B: ${fit(sideBInput.value, 14)}`, label.x + 16, label.y + 104);
    ctx.textAlign = 'right';
    ctx.fillText(fit(catalogInput.value, 10), label.x + label.w - 16, label.y + 84);
    ctx.fillText(tapeTypeSelect.value, label.x + label.w - 16, label.y + 104);
    ctx.textAlign = 'left';

    const windowRect = { x: body.x + body.w / 2 - 95, y: body.y + 150, w: 190, h: 44 };
    ctx.fillStyle = palette.window;
    ctx.fillRect(windowRect.x, windowRect.y, windowRect.w, windowRect.h);
    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(windowRect.x, windowRect.y, windowRect.w, windowRect.h);
    ctx.strokeStyle = palette.reelShadow;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(windowRect.x + 12, windowRect.y + windowRect.h / 2);
    ctx.lineTo(windowRect.x + windowRect.w - 12, windowRect.y + windowRect.h / 2);
    ctx.stroke();

    drawSpool(body.x + 165, body.y + 170, palette);
    drawSpool(body.x + body.w - 165, body.y + 170, palette);

    ctx.fillStyle = palette.window;
    ctx.fillRect(body.x + 40, body.y + 210, 70, 22);
    ctx.fillRect(body.x + body.w - 110, body.y + 210, 70, 22);

    drawScrew(body.x + 18, body.y + 20, palette);
    drawScrew(body.x + body.w - 18, body.y + 20, palette);
    drawScrew(body.x + 18, body.y + body.h - 20, palette);
    drawScrew(body.x + body.w - 18, body.y + body.h - 20, palette);

    ctx.strokeStyle = palette.bodyEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(body.x + 110, body.y + 40);
    ctx.lineTo(body.x + body.w - 110, body.y + 40);
    ctx.stroke();

    if (flash) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 0, w, h);
    }
};

const ensureAudio = async () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
};

const playTone = (freq, duration, startAt = 0) => {
    if (!soundEnabled || !audioCtx) return;
    const now = audioCtx.currentTime + startAt;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
};

const playPrint = () => {
    if (!soundEnabled) return;
    playTone(260, 0.08, 0);
    playTone(200, 0.08, 0.1);
    playTone(160, 0.1, 0.22);
};

const updateStatus = (message) => {
    statusEl.textContent = message;
};

const handleInput = () => {
    render();
    updateStatus('Label updated. Ready to print.');
};

[titleInput, artistInput, sideAInput, sideBInput, catalogInput, styleSelect, tapeTypeSelect].forEach((el) => {
    el.addEventListener('input', handleInput);
    el.addEventListener('change', handleInput);
});

printBtn.addEventListener('click', async () => {
    if (soundEnabled) {
        await ensureAudio();
        playPrint();
    }
    render(true);
    updateStatus('Printing label…');
    setTimeout(() => {
        render(false);
        updateStatus('Label printed. Export when ready.');
    }, 320);
});

downloadBtn.addEventListener('click', async () => {
    if (soundEnabled) {
        await ensureAudio();
        playTone(320, 0.08, 0);
        playTone(260, 0.08, 0.1);
    }
    const link = document.createElement('a');
    link.download = `${titleInput.value.trim().replace(/\s+/g, '-').toLowerCase() || 'cassette-label'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    updateStatus('PNG downloaded. Slide it into the tape case.');
});

soundBtn.addEventListener('click', async () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
    if (soundEnabled) {
        await ensureAudio();
        playTone(420, 0.08, 0);
    }
});

render();

const params = new URLSearchParams(window.location.search);
if (params.has('autoplay')) {
    soundEnabled = true;
    soundBtn.textContent = 'Sound: On';
    ensureAudio().then(() => {
        playPrint();
        render(true);
        updateStatus('Audio test pinged.');
        setTimeout(() => render(false), 280);
    });
}
