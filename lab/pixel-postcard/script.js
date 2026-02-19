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
    crt: {
        bgTop: '#160024',
        bgMid: '#6f2bff',
        bgBottom: '#ff5aa5',
        sun: '#ffe26f',
        sunStripe: '#ff9d5c',
        ground: '#0a0016',
        grid: '#38ffe7',
        border: '#ffe26f',
        borderSoft: '#5d2b86',
        stamp: '#38ffe7',
        stampText: 'SCORE',
        text: '#fff6d6',
        textSoft: '#ffd1f0'
    },
    riso: {
        paper: '#f4efe7',
        layer1: '#ff6b6b',
        layer2: '#4ecdc4',
        layer3: '#1a535c',
        border: '#1a535c',
        stamp: '#ff6b6b',
        stampText: 'RISO',
        text: '#1a535c',
        textSoft: '#3a6f6f'
    },
    blueprint: {
        paper: '#0c2b52',
        line: '#8fd2ff',
        lineSoft: '#5fb0e5',
        border: '#8fd2ff',
        stamp: '#8fd2ff',
        stampStyle: 'circle',
        stampText: 'APP',
        text: '#e8f7ff',
        textSoft: '#9bd6ff'
    },
    thermal: {
        paper: '#f6f1e7',
        ink: '#2c2c2c',
        inkSoft: '#5d5d5d',
        border: '#2c2c2c',
        borderStyle: 'dashed',
        stamp: '#d94b3c',
        stampText: 'PAID',
        text: '#2c2c2c',
        textSoft: '#5d5d5d'
    },
    kintsugi: {
        paper: '#f3e7d3',
        tile: '#ead7bf',
        tileAlt: '#f7eddc',
        gold: '#d4a647',
        border: '#b79c79',
        stamp: '#d4a647',
        stampStyle: 'circle',
        stampText: 'SEAL',
        text: '#3c2e23',
        textSoft: '#6b5944'
    },
    topo: {
        bgTop: '#0d3b2e',
        bgBottom: '#1e7b5a',
        line: '#b3f7cf',
        trail: '#ffd166',
        border: '#b3f7cf',
        stamp: '#ffd166',
        stampText: 'TREK',
        text: '#e6fff1',
        textSoft: '#aee8c9'
    },
    mars: {
        bgTop: '#14080f',
        bgMid: '#4a0f1a',
        bgBottom: '#c1442e',
        planet: '#ff6f59',
        dust: '#6b1e1e',
        orbit: '#ffd166',
        border: '#ffb347',
        stamp: '#ffd166',
        stampText: 'MARS',
        text: '#ffe9d5',
        textSoft: '#ffcfad'
    },
    collage: {
        paper: '#f5f2ea',
        shape1: '#ffadad',
        shape2: '#ffd6a5',
        shape3: '#caffbf',
        shape4: '#9bf6ff',
        shadow: '#c8c1b6',
        border: '#5f5447',
        stamp: '#ffadad',
        stampText: 'CUT',
        text: '#2b2620',
        textSoft: '#5f5447'
    },
    vhs: {
        bgTop: '#2b0a3d',
        bgMid: '#8b2f6a',
        bgBottom: '#ff8b5e',
        sun: '#ffd27d',
        ground: '#13051e',
        border: '#ffd27d',
        stamp: '#ff4d6d',
        stampText: 'REC',
        text: '#ffe9d5',
        textSoft: '#ffd1b3'
    },
    circuit: {
        paper: '#0b2b1e',
        land: '#1f5b3a',
        trace: '#7fffd4',
        node: '#ffd166',
        border: '#7fffd4',
        stamp: '#ffd166',
        stampText: 'SYS',
        text: '#e3fff5',
        textSoft: '#9fead1'
    }
};

let stars = [];
let speckles = [];
let noiseLines = [];
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

function makeTextures() {
    speckles = Array.from({ length: 110 }, () => ({
        x: Math.floor(Math.random() * W),
        y: Math.floor(Math.random() * H),
        size: Math.random() > 0.8 ? 2 : 1
    }));
    noiseLines = Array.from({ length: 18 }, () => ({
        y: Math.floor(Math.random() * H),
        alpha: Math.random() * 0.18 + 0.05,
        width: Math.random() * 40 + 40
    }));
}

function drawGradientHorizon(theme) {
    for (let y = 0; y < horizon; y++) {
        const t = y / horizon;
        let color;
        if (theme.bgMid) {
            if (t < 0.5) {
                color = lerpColor(theme.bgTop, theme.bgMid, t * 2);
            } else {
                color = lerpColor(theme.bgMid, theme.bgBottom, (t - 0.5) * 2);
            }
        } else {
            color = lerpColor(theme.bgTop, theme.bgBottom, t);
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, y, W, 1);
    }
    if (theme.ground) {
        ctx.fillStyle = theme.ground;
        ctx.fillRect(0, horizon, W, H - horizon);
    }
}

function drawGradientFull(theme) {
    for (let y = 0; y < H; y++) {
        const t = y / H;
        let color;
        if (theme.bgMid) {
            if (t < 0.5) {
                color = lerpColor(theme.bgTop, theme.bgMid, t * 2);
            } else {
                color = lerpColor(theme.bgMid, theme.bgBottom, (t - 0.5) * 2);
            }
        } else {
            color = lerpColor(theme.bgTop, theme.bgBottom, t);
        }
        ctx.fillStyle = color;
        ctx.fillRect(0, y, W, 1);
    }
}

function fillSolid(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
}

function drawStars(theme) {
    ctx.fillStyle = theme.star || theme.text;
    stars.forEach((star) => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
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

    ctx.fillStyle = theme.sunStripe || theme.sun;
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

function drawStamp(theme) {
    const stampText = theme.stampText || 'AIR';
    const x = W - 46;
    const y = 10;

    ctx.fillStyle = theme.stamp;
    ctx.strokeStyle = theme.border || theme.stamp;

    if (theme.stampStyle === 'circle') {
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = theme.paper || theme.ground || '#000';
        ctx.font = '7px "Courier New", monospace';
        ctx.fillText(stampText, x + 6, y + 19);
        return;
    }

    ctx.fillRect(x, y, 34, 26);
    ctx.strokeRect(x + 2, y + 2, 30, 22);

    ctx.fillStyle = theme.ground || theme.paper || '#111';
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText(stampText, x + 5, y + 16);
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
    ctx.strokeStyle = theme.border || theme.text;
    ctx.lineWidth = 2;
    if (theme.borderStyle === 'dashed') {
        ctx.setLineDash([3, 2]);
    }
    ctx.strokeRect(2, 2, W - 4, H - 4);
    if (theme.borderStyle === 'double') {
        ctx.strokeRect(6, 6, W - 12, H - 12);
    }
    ctx.setLineDash([]);
}

function drawArcadeBezel(theme) {
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.strokeStyle = theme.borderSoft;
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    ctx.fillStyle = theme.border;
    [[6, 6], [W - 9, 6], [6, H - 9], [W - 9, H - 9]].forEach(([x, y]) => {
        ctx.fillRect(x, y, 3, 3);
    });
}

function drawRiso() {
    const theme = themes.riso;
    fillSolid(theme.paper);

    ctx.globalAlpha = 0.4;
    speckles.forEach((dot) => {
        ctx.fillStyle = theme.layer3;
        ctx.fillRect(dot.x, dot.y, dot.size, dot.size);
    });
    ctx.globalAlpha = 1;

    const drawLayer = (color, offsetX, offsetY) => {
        ctx.fillStyle = color;
        ctx.fillRect(-10 + offsetX, horizon + offsetY, W + 20, H - horizon);
        ctx.beginPath();
        ctx.arc(70 + offsetX, 54 + offsetY, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(30 + offsetX, horizon + offsetY);
        ctx.lineTo(120 + offsetX, 70 + offsetY);
        ctx.lineTo(200 + offsetX, horizon + offsetY);
        ctx.closePath();
        ctx.fill();
    };

    drawLayer(theme.layer1, 0, 0);
    drawLayer(theme.layer2, 2, 2);
    drawLayer(theme.layer3, -2, 1);
}

function drawBlueprint() {
    const theme = themes.blueprint;
    fillSolid(theme.paper);

    ctx.strokeStyle = theme.lineSoft;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let x = 0; x < W; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
    }
    for (let y = 0; y < H; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 40, 60, 50);
    ctx.strokeRect(110, 30, 45, 60);
    ctx.strokeRect(170, 50, 50, 70);

    ctx.beginPath();
    ctx.moveTo(18, 40);
    ctx.lineTo(18, 130);
    ctx.stroke();
    for (let y = 45; y < 130; y += 10) {
        ctx.beginPath();
        ctx.moveTo(14, y);
        ctx.lineTo(22, y);
        ctx.stroke();
    }

    ctx.fillStyle = theme.line;
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText('BLOCK A', 34, 38);
    ctx.fillText('BLOCK B', 114, 28);
}

function drawThermal() {
    const theme = themes.thermal;
    fillSolid(theme.paper);

    for (let y = Math.floor(H * 0.65); y < H; y += 2) {
        const alpha = (y - H * 0.65) / (H * 0.35) * 0.25;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(0, y, W, 1);
    }

    ctx.strokeStyle = theme.inkSoft;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(12, 36);
    ctx.lineTo(W - 12, 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 120);
    ctx.lineTo(W - 12, 120);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = theme.inkSoft;
    for (let y = 6; y < H - 6; y += 10) {
        ctx.fillRect(4, y, 2, 2);
        ctx.fillRect(W - 6, y, 2, 2);
    }
}

function drawKintsugi() {
    const theme = themes.kintsugi;
    fillSolid(theme.paper);

    for (let y = 0; y < H; y += 32) {
        for (let x = 0; x < W; x += 32) {
            ctx.fillStyle = (x + y) % 64 === 0 ? theme.tile : theme.tileAlt;
            ctx.fillRect(x, y, 32, 32);
        }
    }

    ctx.strokeStyle = theme.gold;
    ctx.lineWidth = 2;
    const cracks = [
        [
            { x: 20, y: 18 },
            { x: 90, y: 40 },
            { x: 130, y: 26 },
            { x: 200, y: 48 }
        ],
        [
            { x: 40, y: 90 },
            { x: 80, y: 120 },
            { x: 140, y: 110 },
            { x: 210, y: 140 }
        ]
    ];

    cracks.forEach((path) => {
        ctx.beginPath();
        path.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    });
}

function drawTopo() {
    const theme = themes.topo;
    drawGradientFull(theme);

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 8; i++) {
        const base = 18 + i * 16;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 2) {
            const y = base + Math.sin((x / 12) + i) * (3 + i * 0.3) + Math.sin((x / 5) + i) * 1.5;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = theme.trail;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 95);
    ctx.lineTo(90, 70);
    ctx.lineTo(150, 80);
    ctx.lineTo(210, 62);
    ctx.stroke();

    ctx.fillStyle = theme.trail;
    ctx.fillRect(28, 93, 4, 4);
    ctx.fillRect(208, 60, 4, 4);

    ctx.fillStyle = theme.textSoft;
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText('ALT 620m', 160, 100);
}

function drawMars() {
    const theme = themes.mars;
    drawGradientFull(theme);
    drawStars({ text: '#ffd4b0' });

    ctx.fillStyle = theme.dust;
    for (let x = 0; x < W; x += 12) {
        ctx.fillRect(x, horizon + 20 + (x % 3), 10, 6);
    }

    ctx.strokeStyle = theme.orbit;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(170, 70, 46, Math.PI * 1.1, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(120, 90, 70, Math.PI * 0.95, Math.PI * 1.4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.planet;
    ctx.beginPath();
    ctx.arc(190, 52, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.dust;
    ctx.fillRect(182, 44, 4, 4);
    ctx.fillRect(196, 58, 3, 3);
}

function drawCollage() {
    const theme = themes.collage;
    fillSolid(theme.paper);

    const shadow = (draw) => {
        ctx.save();
        ctx.translate(2, 2);
        ctx.fillStyle = theme.shadow;
        draw();
        ctx.restore();
    };

    shadow(() => {
        ctx.fillRect(20, 70, 120, 50);
    });
    ctx.fillStyle = theme.shape1;
    ctx.fillRect(20, 70, 120, 50);

    shadow(() => {
        ctx.beginPath();
        ctx.arc(190, 55, 26, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = theme.shape2;
    ctx.beginPath();
    ctx.arc(190, 55, 26, 0, Math.PI * 2);
    ctx.fill();

    shadow(() => {
        ctx.beginPath();
        ctx.moveTo(40, 40);
        ctx.lineTo(100, 30);
        ctx.lineTo(120, 70);
        ctx.closePath();
        ctx.fill();
    });
    ctx.fillStyle = theme.shape3;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(100, 30);
    ctx.lineTo(120, 70);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.shape4;
    ctx.fillRect(150, 95, 70, 35);

    ctx.fillStyle = '#f0d9a8';
    ctx.fillRect(24, 66, 18, 6);
    ctx.fillRect(86, 116, 18, 6);
    ctx.fillStyle = '#d8c48b';
    ctx.fillRect(26, 68, 2, 2);
    ctx.fillRect(90, 118, 2, 2);
}

function drawVHS() {
    const theme = themes.vhs;
    drawGradientHorizon(theme);
    drawSun(theme);

    ctx.fillStyle = theme.text;
    ctx.font = '8px "Courier New", monospace';
    ctx.fillText('REC', 10, 14);
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(34, 9, 4, 4);

    ctx.fillStyle = theme.textSoft;
    ctx.fillText('00:32:18', W - 70, 14);

    noiseLines.forEach((line) => {
        ctx.fillStyle = `rgba(255,255,255,${line.alpha})`;
        ctx.fillRect(0, line.y, line.width, 1);
    });

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, H - 22, W, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, H - 18, W, 2);
}

function drawCircuit() {
    const theme = themes.circuit;
    fillSolid(theme.paper);

    ctx.fillStyle = theme.land;
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(40, 70);
    ctx.lineTo(90, 80);
    ctx.lineTo(140, 60);
    ctx.lineTo(210, 72);
    ctx.lineTo(W, 62);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = theme.trace;
    ctx.lineWidth = 1;
    const paths = [
        [
            { x: 20, y: 30 },
            { x: 70, y: 30 },
            { x: 70, y: 60 },
            { x: 120, y: 60 }
        ],
        [
            { x: 140, y: 20 },
            { x: 190, y: 20 },
            { x: 190, y: 50 },
            { x: 220, y: 50 }
        ],
        [
            { x: 50, y: 110 },
            { x: 90, y: 110 },
            { x: 90, y: 90 },
            { x: 130, y: 90 }
        ]
    ];
    paths.forEach((path) => {
        ctx.beginPath();
        path.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    });

    ctx.fillStyle = theme.node;
    [
        [70, 30],
        [120, 60],
        [190, 20],
        [90, 110],
        [130, 90]
    ].forEach(([x, y]) => {
        ctx.fillRect(x - 2, y - 2, 4, 4);
    });
}

function render() {
    const key = themeSelect.value;
    const theme = themes[key] || themes.crt;
    ctx.clearRect(0, 0, W, H);

    switch (key) {
        case 'crt':
            drawGradientHorizon(theme);
            drawStars(theme);
            drawSun(theme);
            drawGrid(theme);
            drawArcadeBezel(theme);
            drawStamp(theme);
            drawText(theme);
            break;
        case 'riso':
            drawRiso();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'blueprint':
            drawBlueprint();
            drawStamp(theme);
            drawText(theme);
            drawBorder({ ...theme, borderStyle: 'double' });
            break;
        case 'thermal':
            drawThermal();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'kintsugi':
            drawKintsugi();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'topo':
            drawTopo();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'mars':
            drawMars();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'collage':
            drawCollage();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'vhs':
            drawVHS();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        case 'circuit':
            drawCircuit();
            drawStamp(theme);
            drawText(theme);
            drawBorder(theme);
            break;
        default:
            drawGradientHorizon(themes.crt);
            drawStars(themes.crt);
            drawSun(themes.crt);
            drawGrid(themes.crt);
            drawArcadeBezel(themes.crt);
            drawStamp(themes.crt);
            drawText(themes.crt);
    }
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
    makeTextures();
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
makeTextures();
render();
