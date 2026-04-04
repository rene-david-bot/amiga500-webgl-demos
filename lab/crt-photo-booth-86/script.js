const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const uploadInput = document.getElementById('upload');
const presetButtons = [...document.querySelectorAll('.preset')];
const ditherInput = document.getElementById('dither');
const contrastInput = document.getElementById('contrast');
const brightnessInput = document.getElementById('brightness');
const noiseInput = document.getElementById('noise');
const scanlinesInput = document.getElementById('scanlines');
const stampInput = document.getElementById('stamp');
const shuffleBtn = document.getElementById('shuffle');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const scanOverlay = document.querySelector('.scan-overlay');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const offscreen = document.createElement('canvas');
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

const PALETTES = {
    kiosk: [
        [28, 22, 46],
        [83, 57, 94],
        [168, 106, 130],
        [240, 180, 154]
    ],
    amber: [
        [20, 12, 5],
        [95, 54, 15],
        [179, 116, 34],
        [255, 206, 99]
    ],
    neon: [
        [12, 18, 38],
        [26, 126, 145],
        [214, 79, 163],
        [249, 242, 255]
    ]
};

const bayer4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
];

const state = {
    preset: 'kiosk',
    imageLoaded: false,
    sourceImage: null
};

let audioCtx;

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function shutterSound() {
    if (!audioCtx) return;

    const t0 = audioCtx.currentTime;
    const noise = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.45;

    const src = audioCtx.createBufferSource();
    src.buffer = noise;

    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1300;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    src.connect(hp);
    hp.connect(g);
    g.connect(audioCtx.destination);

    src.start(t0);
    src.stop(t0 + 0.09);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function nearestColor(r, g, b, palette) {
    let best = palette[0];
    let bestDist = Infinity;

    for (const p of palette) {
        const dr = r - p[0];
        const dg = g - p[1];
        const db = b - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            best = p;
        }
    }

    return best;
}

function drawDemoPortrait() {
    const grad = offCtx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#1e103a');
    grad.addColorStop(1, '#101520');
    offCtx.fillStyle = grad;
    offCtx.fillRect(0, 0, WIDTH, HEIGHT);

    // Neon blobs
    for (let i = 0; i < 18; i++) {
        const x = (i * 61) % WIDTH;
        const y = 40 + ((i * 97) % (HEIGHT - 80));
        const r = 16 + (i % 5) * 10;
        const g = offCtx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(61,244,255,0.2)');
        g.addColorStop(1, 'rgba(61,244,255,0)');
        offCtx.fillStyle = g;
        offCtx.beginPath();
        offCtx.arc(x, y, r, 0, Math.PI * 2);
        offCtx.fill();
    }

    // Silhouette
    offCtx.fillStyle = '#dca8a8';
    offCtx.beginPath();
    offCtx.arc(180, 185, 76, 0, Math.PI * 2);
    offCtx.fill();

    offCtx.fillStyle = '#a36d6d';
    offCtx.fillRect(106, 255, 148, 180);

    offCtx.fillStyle = '#5a4ef4';
    offCtx.fillRect(88, 328, 184, 142);

    // Simple highlights
    offCtx.fillStyle = 'rgba(255,255,255,0.32)';
    offCtx.fillRect(126, 165, 28, 8);
    offCtx.fillRect(205, 165, 28, 8);
    offCtx.fillRect(170, 205, 20, 8);
}

function drawSourceToOffscreen() {
    offCtx.clearRect(0, 0, WIDTH, HEIGHT);

    if (!state.sourceImage) {
        drawDemoPortrait();
        return;
    }

    const img = state.sourceImage;
    const imgRatio = img.width / img.height;
    const targetRatio = WIDTH / HEIGHT;

    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (imgRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) * 0.5;
    } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) * 0.5;
    }

    offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
}

function applyRetroFilter() {
    drawSourceToOffscreen();

    const imageData = offCtx.getImageData(0, 0, WIDTH, HEIGHT);
    const data = imageData.data;

    const ditherAmount = Number(ditherInput.value) / 100;
    const contrast = Number(contrastInput.value) / 100;
    const brightness = Number(brightnessInput.value);
    const noiseLevel = Number(noiseInput.value);
    const palette = PALETTES[state.preset];

    for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const i = (y * WIDTH + x) * 4;

            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            r = ((r - 128) * contrast) + 128 + brightness;
            g = ((g - 128) * contrast) + 128 + brightness;
            b = ((b - 128) * contrast) + 128 + brightness;

            const threshold = (bayer4[y % 4][x % 4] - 7.5) * ditherAmount * 2.1;
            const grain = (Math.random() * 2 - 1) * noiseLevel;

            r = clamp(r + threshold + grain, 0, 255);
            g = clamp(g + threshold + grain, 0, 255);
            b = clamp(b + threshold + grain, 0, 255);

            const [nr, ng, nb] = nearestColor(r, g, b, palette);
            data[i] = nr;
            data[i + 1] = ng;
            data[i + 2] = nb;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    drawFrame();
}

function drawFrame() {
    const t = Date.now() * 0.001;

    const vignette = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.5, 120, WIDTH * 0.5, HEIGHT * 0.5, 320);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = 'rgba(228, 236, 255, 0.64)';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);

    ctx.strokeStyle = 'rgba(94, 126, 202, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, WIDTH - 28, HEIGHT - 28);

    if (stampInput.checked) {
        const d = new Date();
        const stamp = `PHOTO BOOTH 86  ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        ctx.fillStyle = 'rgba(8, 11, 18, 0.72)';
        ctx.fillRect(16, HEIGHT - 44, WIDTH - 32, 24);
        ctx.fillStyle = '#ffd799';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(stamp, 24, HEIGHT - 27);
    }

    // Tiny signal blip in corner
    ctx.fillStyle = 'rgba(61, 244, 255, 0.85)';
    const pulse = 5 + Math.sin(t * 4.8) * 1.6;
    ctx.beginPath();
    ctx.arc(WIDTH - 26, 24, pulse, 0, Math.PI * 2);
    ctx.fill();
}

function setPreset(name) {
    state.preset = name;
    presetButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.preset === name));
    applyRetroFilter();
    statusEl.textContent = `Preset loaded: ${presetButtons.find((b) => b.dataset.preset === name)?.textContent || name}.`;
}

function randomizeControls() {
    const presets = ['kiosk', 'amber', 'neon'];
    const pick = presets[Math.floor(Math.random() * presets.length)];

    ditherInput.value = String(30 + Math.floor(Math.random() * 65));
    contrastInput.value = String(90 + Math.floor(Math.random() * 70));
    brightnessInput.value = String(-20 + Math.floor(Math.random() * 41));
    noiseInput.value = String(3 + Math.floor(Math.random() * 22));
    scanlinesInput.checked = Math.random() > 0.25;
    stampInput.checked = Math.random() > 0.2;

    setPreset(pick);
    ensureAudio();
    shutterSound();
    statusEl.textContent = 'New surprise look generated — kiosk operator approves.';
}

async function loadFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            state.sourceImage = img;
            state.imageLoaded = true;
            applyRetroFilter();
            statusEl.textContent = `Loaded: ${file.name} · ready for print.`;
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function savePng() {
    ensureAudio();
    shutterSound();

    const link = document.createElement('a');
    link.download = `crt-photo-booth-86-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    statusEl.textContent = 'Saved PNG to your downloads.';
}

uploadInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    loadFile(file);
});

presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
        setPreset(button.dataset.preset);
    });
});

[ditherInput, contrastInput, brightnessInput, noiseInput, stampInput].forEach((input) => {
    input.addEventListener('input', applyRetroFilter);
});

scanlinesInput.addEventListener('change', () => {
    scanOverlay.style.opacity = scanlinesInput.checked ? '0.95' : '0';
    applyRetroFilter();
});

shuffleBtn.addEventListener('click', randomizeControls);
saveBtn.addEventListener('click', savePng);

// Boot
scanOverlay.style.opacity = '0.95';
setPreset('kiosk');
applyRetroFilter();
