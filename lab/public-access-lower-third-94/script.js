const showTitleInput = document.getElementById('show-title');
const hostNameInput = document.getElementById('host-name');
const tickerInput = document.getElementById('ticker-text');
const themeSelect = document.getElementById('theme-select');
const speedInput = document.getElementById('speed');
const noiseInput = document.getElementById('noise');

const titleLine = document.getElementById('title-line');
const hostLine = document.getElementById('host-line');
const tickerTrack = document.getElementById('ticker-track');
const frame = document.getElementById('frame');
const noiseLayer = document.getElementById('noise-layer');
const timestampEl = document.getElementById('timestamp');
const recordDot = document.getElementById('record-dot');
const statusEl = document.getElementById('status');

const randomizeBtn = document.getElementById('randomize');
const stingerBtn = document.getElementById('stinger');
const freezeBtn = document.getElementById('freeze');

const THEMES = {
    "Neon Nightline": {
        frameBg: 'linear-gradient(180deg, #0d1438, #070a20 58%, #040512)',
        titleBg: 'linear-gradient(90deg, #1d5bff, #6f22d2)',
        hostBg: 'linear-gradient(90deg, #172f6d, #2c145e)',
        tickerBg: 'linear-gradient(90deg, #230b45, #4e0d63)',
        text: '#eaf2ff',
        accent: '#62e8ff'
    },
    "Sports Cable": {
        frameBg: 'linear-gradient(180deg, #0f1e26, #061017 60%, #05080d)',
        titleBg: 'linear-gradient(90deg, #177551, #1ea668)',
        hostBg: 'linear-gradient(90deg, #194235, #122e25)',
        tickerBg: 'linear-gradient(90deg, #0f3e30, #19784f)',
        text: '#e8fff5',
        accent: '#95ffce'
    },
    "Music Hour": {
        frameBg: 'linear-gradient(180deg, #1a0f2f, #0f0920 62%, #070611)',
        titleBg: 'linear-gradient(90deg, #ff3e95, #8f2fff)',
        hostBg: 'linear-gradient(90deg, #59218a, #2f1453)',
        tickerBg: 'linear-gradient(90deg, #4c1c83, #8b2557)',
        text: '#ffeefd',
        accent: '#ffb6e8'
    },
    "Public Affairs": {
        frameBg: 'linear-gradient(180deg, #15161f, #0a0b11 66%, #05060a)',
        titleBg: 'linear-gradient(90deg, #606d92, #7a89b0)',
        hostBg: 'linear-gradient(90deg, #384364, #232a42)',
        tickerBg: 'linear-gradient(90deg, #2d3756, #505c83)',
        text: '#f0f3ff',
        accent: '#d9e1ff'
    }
};

const SEGMENT_SEEDS = [
    {
        title: 'MIDNIGHT BYTE REPORT',
        host: 'HOST: DAVE // LIVE IN DRESDEN',
        ticker: 'BREAKING: ARCADE HIGHSCORE BOARD OVERHEATED • TAPE STOCK UP 4% • MODEM CAFE REOPENED UNTIL 02:00'
    },
    {
        title: 'CITY AFTER HOURS',
        host: 'SEGMENT: STREETCAM DISTRICT 7',
        ticker: 'TRAFFIC UPDATE: SKATE LANE PACKED • COMMUNITY THEATER RUNS CYBER-MUSICAL AT 21:00 • PAYPHONE QUEUE CLEARED'
    },
    {
        title: 'PIXEL MARKET WATCH',
        host: 'ANALYST: R. SCHULTE',
        ticker: 'CARTRIDGE FUTURES RALLY • FLOPPY RECYCLERS MISS TARGET • SYNTH REPAIR SHOPS REPORT RECORD WEEK'
    },
    {
        title: 'RETRO SPORTS WIRE',
        host: 'COMMENTARY: NIGHT CREW DESK',
        ticker: 'ROLLER DERBY FINAL ENTERS OVERTIME • LASER-TAG LEAGUE SEEKS NEW REFEREES • COURT LIGHTS UPGRADED TO RGB'
    }
];

const state = {
    tickerX: 0,
    tickerWidth: 0,
    speedPx: 72,
    noiseAmount: 42,
    raf: null,
    lastTs: 0,
    blinkTimer: 0,
    audioCtx: null
};

function applyTheme(name) {
    const theme = THEMES[name] || THEMES['Neon Nightline'];

    frame.style.background = theme.frameBg;
    titleLine.parentElement.style.borderColor = `${theme.accent}88`;
    titleLine.style.background = theme.titleBg;
    titleLine.style.color = theme.text;

    hostLine.style.background = theme.hostBg;
    hostLine.style.color = theme.text;

    tickerTrack.parentElement.style.background = theme.tickerBg;
    tickerTrack.style.color = theme.text;

    recordDot.style.color = theme.accent;

    setStatus(`Theme loaded: ${name}.`);
}

function setStatus(text) {
    statusEl.textContent = text;
}

function buildThemeSelect() {
    Object.keys(THEMES).forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        themeSelect.appendChild(option);
    });
    themeSelect.value = 'Neon Nightline';
}

function refreshText() {
    titleLine.textContent = (showTitleInput.value || 'UNTITLED SEGMENT').toUpperCase();
    hostLine.textContent = (hostNameInput.value || 'HOST: UNKNOWN').toUpperCase();

    const ticker = tickerInput.value.trim() || 'NO BULLETINS. STAY TUNED.';
    tickerTrack.textContent = `${ticker.toUpperCase()}  •  ${ticker.toUpperCase()}  •`;

    state.tickerWidth = tickerTrack.getBoundingClientRect().width;
    state.tickerX = frame.getBoundingClientRect().width;
}

function refreshNoise() {
    const amount = Number(noiseInput.value);
    state.noiseAmount = amount;
    const alpha = (amount / 100) * 0.55;

    noiseLayer.style.opacity = `${0.08 + alpha}`;
    noiseLayer.style.backgroundImage = `
        radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, rgba(255,255,255,0.4), transparent 22%),
        radial-gradient(circle at ${Math.random() * 100}% ${Math.random() * 100}%, rgba(255,255,255,0.22), transparent 30%),
        repeating-radial-gradient(circle, rgba(255,255,255,0.12) 0 1px, transparent 1px 2px)
    `;
}

function updateTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    timestampEl.textContent = `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec} CET`;
}

function animate(ts) {
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(48, ts - state.lastTs);
    state.lastTs = ts;

    const frameW = frame.getBoundingClientRect().width;
    const px = (state.speedPx * dt) / 1000;
    state.tickerX -= px;

    if (state.tickerX < -state.tickerWidth) {
        state.tickerX = frameW;
    }

    tickerTrack.style.transform = `translateX(${state.tickerX}px)`;

    state.blinkTimer += dt;
    if (state.blinkTimer > 560) {
        recordDot.style.opacity = recordDot.style.opacity === '0.35' ? '1' : '0.35';
        state.blinkTimer = 0;
    }

    state.raf = requestAnimationFrame(animate);
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function stinger() {
    ensureAudio();
    const now = state.audioCtx.currentTime;

    const notes = [
        { f: 392, t: 0.09, type: 'square', v: 0.05 },
        { f: 523.25, t: 0.08, type: 'triangle', v: 0.05 },
        { f: 659.25, t: 0.12, type: 'sawtooth', v: 0.04 }
    ];

    notes.forEach((n, i) => {
        const start = now + i * 0.07;
        const osc = state.audioCtx.createOscillator();
        const gain = state.audioCtx.createGain();

        osc.type = n.type;
        osc.frequency.setValueAtTime(n.f, start);
        osc.frequency.exponentialRampToValueAtTime(n.f * 0.92, start + n.t);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(n.v, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.t);

        osc.connect(gain);
        gain.connect(state.audioCtx.destination);

        osc.start(start);
        osc.stop(start + n.t + 0.02);
    });

    setStatus('Stinger played. Export the frame while it is live.');
}

function randomizeSegment() {
    const pick = SEGMENT_SEEDS[Math.floor(Math.random() * SEGMENT_SEEDS.length)];
    showTitleInput.value = pick.title;
    hostNameInput.value = pick.host;
    tickerInput.value = pick.ticker;

    const names = Object.keys(THEMES);
    themeSelect.value = names[Math.floor(Math.random() * names.length)];
    speedInput.value = String(40 + Math.floor(Math.random() * 90));
    noiseInput.value = String(20 + Math.floor(Math.random() * 70));

    state.speedPx = Number(speedInput.value);

    applyTheme(themeSelect.value);
    refreshText();
    refreshNoise();
    updateTimestamp();

    setStatus('Randomized a fresh cable segment package.');
}

function exportFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    const theme = THEMES[themeSelect.value] || THEMES['Neon Nightline'];

    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, theme.frameBg.includes('#1a0f2f') ? '#1a0f2f' : '#0b1230');
    g.addColorStop(0.62, '#070a20');
    g.addColorStop(1, '#040512');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.18 + state.noiseAmount / 250;
    for (let i = 0; i < 1400; i += 1) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const b = Math.floor(Math.random() * 255);
        ctx.fillStyle = `rgb(${b},${b},${b})`;
        ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    const titleY = 520;
    ctx.fillStyle = theme.titleBg.includes('#177551') ? '#1f8d63' : theme.titleBg.includes('#ff3e95') ? '#c3359f' : '#2f4ec9';
    ctx.fillRect(60, titleY, 760, 54);

    ctx.fillStyle = theme.hostBg.includes('#194235') ? '#204735' : theme.hostBg.includes('#59218a') ? '#4c2478' : '#1c2d63';
    ctx.fillRect(60, titleY + 54, 760, 42);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(titleLine.textContent.slice(0, 34), 82, titleY + 36);

    ctx.font = '24px "Courier New", monospace';
    ctx.fillText(hostLine.textContent.slice(0, 48), 82, titleY + 82);

    ctx.fillStyle = theme.tickerBg.includes('#0f3e30') ? '#17553f' : theme.tickerBg.includes('#4c1c83') ? '#6a2f85' : '#2b1d5a';
    ctx.fillRect(60, 620, 1160, 52);

    ctx.fillStyle = '#f3fbff';
    ctx.font = 'bold 23px "Courier New", monospace';
    const ticker = (tickerInput.value || 'NO BULLETIN').toUpperCase();
    ctx.fillText(`${ticker} • ${ticker}`, 74, 653);

    ctx.fillStyle = '#fff5b8';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText(timestampEl.textContent, 64, 42);

    ctx.fillStyle = '#ff9db3';
    ctx.fillText('● LIVE', 1160, 42);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 1);
    }

    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `public-access-lower-third-${stamp}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();

    setStatus('Exported freeze-frame PNG to your downloads.');
}

function bind() {
    [showTitleInput, hostNameInput, tickerInput].forEach((el) => {
        el.addEventListener('input', refreshText);
    });

    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

    speedInput.addEventListener('input', () => {
        state.speedPx = Number(speedInput.value);
        setStatus(`Ticker speed set to ${state.speedPx}px/s.`);
    });

    noiseInput.addEventListener('input', () => {
        refreshNoise();
        setStatus(`Noise intensity set to ${noiseInput.value}%.`);
    });

    randomizeBtn.addEventListener('click', randomizeSegment);
    stingerBtn.addEventListener('click', stinger);
    freezeBtn.addEventListener('click', exportFrame);

    window.addEventListener('resize', refreshText);
}

function init() {
    buildThemeSelect();
    bind();
    applyTheme(themeSelect.value);
    refreshText();
    refreshNoise();
    updateTimestamp();

    state.speedPx = Number(speedInput.value);

    setInterval(updateTimestamp, 1000);
    setInterval(() => {
        if (Math.random() > 0.6) refreshNoise();
    }, 500);

    state.raf = requestAnimationFrame(animate);
}

init();
