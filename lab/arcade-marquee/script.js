const canvas = document.getElementById("marquee");
const ctx = canvas.getContext("2d");

const messageInput = document.getElementById("message");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const paletteButtons = document.querySelectorAll("[data-palette]");
const sparkleButton = document.getElementById("sparkle");
const invertButton = document.getElementById("invert");
const randomButton = document.getElementById("random");
const snapshotButton = document.getElementById("snapshot");
const audioButton = document.getElementById("audio");
const pauseButton = document.getElementById("pause");
const status = document.getElementById("status");

const grid = { cols: 64, rows: 16 };
const cellSize = canvas.width / grid.cols;
const dotRadius = cellSize * 0.32;

const palettes = {
    neon: {
        label: "Neon",
        bg: "#05060c",
        dim: "#0f1a2b",
        glow: "#5cf5ff",
        core: "#e7feff",
        shadow: "rgba(96, 245, 255, 0.35)",
    },
    amber: {
        label: "Amber",
        bg: "#080604",
        dim: "#2a1a10",
        glow: "#ffb454",
        core: "#fff2d1",
        shadow: "rgba(255, 180, 84, 0.35)",
    },
    ice: {
        label: "Ice",
        bg: "#06080e",
        dim: "#141d33",
        glow: "#8aa8ff",
        core: "#e9f0ff",
        shadow: "rgba(138, 168, 255, 0.35)",
    },
};

const FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    "F": ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    "•": ["00000", "00000", "01100", "01100", "00000", "00000", "00000"],
};

const slogans = [
    "INSERT COIN",
    "HI SCORE CLUB",
    "PRESS START",
    "POWER UP COMPLETE",
    "NEW HIGH SCORE",
    "PLAYER ONE READY",
    "READY FOR LAUNCH",
    "COSMIC ARCADE",
    "CABINET OPEN LATE",
    "RETRO WAVE NIGHT",
];

let currentPalette = "neon";
let sparkle = true;
let inverted = false;
let audioOn = false;
let paused = false;
let speed = Number(speedInput.value);
let messageColumns = [];
let messageWidth = 0;
let offset = 0;
let lastStep = 0;
let lastTime = 0;

let audioCtx = null;
let humOsc = null;
let humGain = null;

const blankColumn = () => Array(7).fill(false);

const sanitizeText = (text) => {
    const replacements = {
        "·": "•",
        "–": "-",
        "—": "-",
    };
    return text
        .toUpperCase()
        .split("")
        .map((char) => replacements[char] || char)
        .map((char) => (FONT[char] ? char : "?"))
        .join("");
};

const buildColumns = (text) => {
    const padded = [];
    for (let i = 0; i < grid.cols; i += 1) {
        padded.push(blankColumn());
    }

    const columns = [...padded];
    for (const char of text) {
        const glyph = FONT[char] || FONT["?"];
        for (let col = 0; col < 5; col += 1) {
            const column = [];
            for (let row = 0; row < 7; row += 1) {
                column.push(glyph[row][col] === "1");
            }
            columns.push(column);
        }
        columns.push(blankColumn());
    }

    for (let i = 0; i < grid.cols; i += 1) {
        columns.push(blankColumn());
    }

    return columns;
};

const updateStatus = () => {
    const paletteLabel = palettes[currentPalette].label;
    status.textContent = `Signal locked · Speed ${speed} · ${paletteLabel}`;
};

const updateMessage = () => {
    const sanitized = sanitizeText(messageInput.value || "INSERT COIN");
    messageInput.value = sanitized;
    messageColumns = buildColumns(sanitized);
    messageWidth = messageColumns.length;
    offset = 0;
    lastStep = 0;
};

const ensureAudio = async () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        await audioCtx.resume();
    }
};

const startHum = () => {
    if (!audioCtx || humOsc) return;

    humOsc = audioCtx.createOscillator();
    humGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    humOsc.type = "triangle";
    humOsc.frequency.value = 94;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    humGain.gain.value = 0.03;

    humOsc.connect(filter).connect(humGain).connect(audioCtx.destination);
    humOsc.start();
};

const stopHum = () => {
    if (humOsc) {
        humOsc.stop();
        humOsc.disconnect();
        humGain.disconnect();
        humOsc = null;
        humGain = null;
    }
};

const playTick = () => {
    if (!audioCtx || !audioOn) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.value = 720 + Math.random() * 140;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
};

const render = (time) => {
    const palette = palettes[currentPalette];
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseIndex = Math.floor(offset);
    const yOffset = Math.floor((grid.rows - 7) / 2);
    const pulse = 0.85 + 0.15 * Math.sin(time / 900);

    for (let col = 0; col < grid.cols; col += 1) {
        const columnData = messageColumns[baseIndex + col] || blankColumn();
        for (let row = 0; row < grid.rows; row += 1) {
            const messageRow = row - yOffset;
            let lit = false;
            if (messageRow >= 0 && messageRow < 7) {
                lit = columnData[messageRow];
            }

            if (inverted) {
                lit = !lit;
            }

            let sparkleBoost = 0;
            if (sparkle && !lit && Math.random() < 0.02) {
                sparkleBoost = 0.6;
            }

            const intensity = lit ? 1 : 0.18 + sparkleBoost;
            const glow = lit ? palette.glow : palette.dim;
            const core = lit ? palette.core : palette.dim;

            ctx.beginPath();
            ctx.shadowBlur = lit ? 10 : 0;
            ctx.shadowColor = palette.shadow;
            ctx.fillStyle = glow;
            ctx.globalAlpha = intensity * pulse;
            ctx.arc(
                col * cellSize + cellSize / 2,
                row * cellSize + cellSize / 2,
                dotRadius + (lit ? 0.6 : 0),
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.beginPath();
            ctx.shadowBlur = 0;
            ctx.fillStyle = core;
            ctx.globalAlpha = intensity;
            ctx.arc(
                col * cellSize + cellSize / 2,
                row * cellSize + cellSize / 2,
                dotRadius - 0.6,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
};

const animate = (time) => {
    if (!lastTime) lastTime = time;
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    if (!paused) {
        offset += delta * (speed * 1.1);
    }

    if (offset >= messageWidth - grid.cols) {
        offset = 0;
    }

    const step = Math.floor(offset);
    if (audioOn && step !== lastStep) {
        playTick();
        lastStep = step;
    }

    render(time);
    requestAnimationFrame(animate);
};

messageInput.addEventListener("input", updateMessage);

speedInput.addEventListener("input", () => {
    speed = Number(speedInput.value);
    speedValue.textContent = speed;
    updateStatus();
});

paletteButtons.forEach((button) => {
    button.addEventListener("click", () => {
        paletteButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        currentPalette = button.dataset.palette;
        updateStatus();
    });
});

sparkleButton.addEventListener("click", () => {
    sparkle = !sparkle;
    sparkleButton.textContent = `Sparkle: ${sparkle ? "On" : "Off"}`;
});

invertButton.addEventListener("click", () => {
    inverted = !inverted;
    invertButton.textContent = `Invert: ${inverted ? "On" : "Off"}`;
});

randomButton.addEventListener("click", () => {
    const slogan = slogans[Math.floor(Math.random() * slogans.length)];
    messageInput.value = slogan;
    updateMessage();
});

snapshotButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "arcade-marquee.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});

audioButton.addEventListener("click", async () => {
    audioOn = !audioOn;
    if (audioOn) {
        await ensureAudio();
        startHum();
    } else {
        stopHum();
    }
    audioButton.textContent = `Audio: ${audioOn ? "On" : "Off"}`;
});

pauseButton.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
});

updateMessage();
updateStatus();
render(0);
requestAnimationFrame(animate);
