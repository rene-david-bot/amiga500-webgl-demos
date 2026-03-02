const canvas = document.getElementById("paper");
const ctx = canvas.getContext("2d");
const lineCountEl = document.getElementById("line-count");
const statusEl = document.getElementById("status");
const messageEl = document.getElementById("message");
const printBtn = document.getElementById("print");
const feedBtn = document.getElementById("feed");
const clearBtn = document.getElementById("clear");
const speedEl = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const audioToggle = document.getElementById("audio-toggle");

const FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
    "F": ["11111", "10000", "11110", "10000", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "11111", "10001", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "11100", "10010", "10001", "10001", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10010", "10001", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10001", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ",": ["00000", "00000", "00000", "00000", "00000", "01100", "01000"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    "?": ["01110", "10001", "00010", "00100", "00100", "00000", "00100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "#": ["01010", "11111", "01010", "01010", "11111", "01010", "01010"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"]
};

const cell = 4;
const glyphWidth = 5;
const glyphHeight = 7;
const charSpacing = 1;
const lineGap = 2;
const charWidth = (glyphWidth + charSpacing) * cell;
const lineHeight = (glyphHeight + lineGap) * cell;

const maxChars = Math.floor((canvas.width - 32) / charWidth);
const maxLines = Math.floor((canvas.height - 24) / lineHeight);
const marginX = Math.floor((canvas.width - maxChars * charWidth) / 2);
const marginY = Math.floor((canvas.height - maxLines * lineHeight) / 2);

const state = {
    lines: [],
    queue: [],
    activeLine: "",
    activeIndex: 0,
    printing: false,
    speed: 1,
    lastStep: 0
};

let audioCtx = null;
let audioEnabled = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function getGlyph(char) {
    return FONT[char] || FONT["?"];
}

function wrapLine(text) {
    const cleaned = text.toUpperCase();
    if (!cleaned.length) return [""];
    const segments = [];
    for (let i = 0; i < cleaned.length; i += maxChars) {
        segments.push(cleaned.slice(i, i + maxChars));
    }
    return segments;
}

function updateLineCount() {
    lineCountEl.textContent = state.lines.length.toString();
}

function setStatus(text) {
    statusEl.textContent = text;
}

function queueMessage() {
    const lines = messageEl.value.split("\n");
    const queue = [];
    lines.forEach((line) => {
        wrapLine(line.trim()).forEach((segment) => queue.push(segment));
    });
    if (queue.length === 0) queue.push("");
    state.queue.push(...queue);
}

function startPrint() {
    if (state.printing) return;
    if (!state.queue.length) {
        queueMessage();
    }
    if (!state.queue.length) return;
    state.printing = true;
    setStatus("Printing dispatch...");
    loadNextLine();
    requestAnimationFrame(tick);
}

function loadNextLine() {
    const next = state.queue.shift();
    if (typeof next !== "string") {
        state.printing = false;
        setStatus("Dispatch complete. Ready for another message.");
        return;
    }
    state.activeLine = next.slice(0, maxChars);
    state.activeIndex = 0;
}

function finalizeLine() {
    state.lines.push(state.activeLine);
    updateLineCount();
    if (state.lines.length > 200) {
        state.lines = state.lines.slice(-200);
    }
    loadNextLine();
}

function feedPaper(lines = 1) {
    for (let i = 0; i < lines; i += 1) {
        state.lines.push("");
    }
    updateLineCount();
    setStatus("Paper feed advanced.");
    playFeed();
    render();
}

function clearPaper() {
    state.lines = [];
    state.queue = [];
    state.printing = false;
    state.activeLine = "";
    state.activeIndex = 0;
    updateLineCount();
    setStatus("Paper cleared.");
    render();
}

function renderLine(text, lineIndex, partial) {
    const y = marginY + lineIndex * lineHeight;
    const limit = partial === null ? text.length : clamp(partial, 0, text.length);
    for (let i = 0; i < limit; i += 1) {
        const char = text[i] || " ";
        const glyph = getGlyph(char);
        const x = marginX + i * charWidth;
        for (let row = 0; row < glyphHeight; row += 1) {
            const rowData = glyph[row];
            for (let col = 0; col < glyphWidth; col += 1) {
                if (rowData[col] === "1") {
                    ctx.fillRect(x + col * cell, y + row * cell, cell - 1, cell - 1);
                }
            }
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f3edd7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(46, 55, 68, 0.85)";

    const displayLines = state.lines.map((line) => ({ text: line, partial: null }));
    if (state.printing) {
        displayLines.push({ text: state.activeLine, partial: state.activeIndex });
    }
    const start = Math.max(0, displayLines.length - maxLines);
    const visible = displayLines.slice(start);

    visible.forEach((line, index) => {
        renderLine(line.text.padEnd(maxChars, " "), index, line.partial);
    });

    if (state.printing) {
        const lineIndex = visible.length - 1;
        const headX = marginX + clamp(state.activeIndex, 0, maxChars) * charWidth + 1;
        const headY = marginY + lineIndex * lineHeight - 4;
        ctx.strokeStyle = "rgba(255, 115, 175, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(headX, headY + glyphHeight * cell + 8);
        ctx.stroke();
    }
}

function tick(timestamp) {
    if (!state.printing) {
        render();
        return;
    }
    const interval = 120 / state.speed;
    if (timestamp - state.lastStep >= interval) {
        state.lastStep = timestamp;
        state.activeIndex += 1;
        playTick();
        if (state.activeIndex > state.activeLine.length) {
            finalizeLine();
        }
    }
    render();
    requestAnimationFrame(tick);
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

function playTick() {
    if (!audioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 1600 + Math.random() * 400;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
}

function playFeed() {
    if (!audioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 320 + Math.random() * 40;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
}

function updateSpeed() {
    state.speed = parseFloat(speedEl.value);
    speedValue.textContent = `${state.speed.toFixed(1)}x`;
}

printBtn.addEventListener("click", () => {
    queueMessage();
    startPrint();
});

feedBtn.addEventListener("click", () => {
    initAudio();
    feedPaper(1);
});

clearBtn.addEventListener("click", () => {
    clearPaper();
});

speedEl.addEventListener("input", updateSpeed);

audioToggle.addEventListener("click", () => {
    initAudio();
    audioEnabled = !audioEnabled;
    audioToggle.textContent = audioEnabled ? "Audio: On" : "Audio: Off";
    if (audioEnabled) {
        playFeed();
    }
});

document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => {
        messageEl.value = button.dataset.preset || "";
        setStatus("Preset loaded. Ready to print.");
    });
});

updateSpeed();
render();
