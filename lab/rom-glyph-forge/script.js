const glyphCanvas = document.getElementById("glyph");
const glyphCtx = glyphCanvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");

const hexOutput = document.getElementById("hex");
const statusOutput = document.getElementById("status");
const slotOutput = document.getElementById("slot");

const paintBtn = document.getElementById("mode-paint");
const eraseBtn = document.getElementById("mode-erase");
const audioToggle = document.getElementById("audio-toggle");

const clearBtn = document.getElementById("clear");
const invertBtn = document.getElementById("invert");
const randomBtn = document.getElementById("random");
const mirrorXBtn = document.getElementById("mirror-x");
const mirrorYBtn = document.getElementById("mirror-y");
const shiftLeftBtn = document.getElementById("shift-left");
const shiftRightBtn = document.getElementById("shift-right");
const shiftUpBtn = document.getElementById("shift-up");
const shiftDownBtn = document.getElementById("shift-down");
const exportBtn = document.getElementById("export");
const copyBtn = document.getElementById("copy");

const paletteButtons = Array.from(document.querySelectorAll(".swatch"));

const size = 8;
const cells = Array.from({ length: size }, () => Array(size).fill(0));
let paintMode = "paint";
let ink = "#7bffea";
let isPointerDown = false;

let audioEnabled = false;
let audioCtx = null;
let lastTick = 0;

const palette = {
    background: "#0b111a",
    grid: "rgba(130, 160, 210, 0.2)",
    off: "#0d1422",
};

const glyphSize = glyphCanvas.width;
const cellSize = glyphSize / size;

slotOutput.textContent = String(Math.floor(Math.random() * 32) + 1).padStart(2, "0");

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function tick(freq = 420, duration = 0.05) {
    if (!audioEnabled) return;
    ensureAudio();
    const now = audioCtx.currentTime;
    if (now - lastTick < 0.02) return;
    lastTick = now;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

function setStatus(text) {
    statusOutput.textContent = text;
}

function renderGlyph() {
    glyphCtx.fillStyle = palette.off;
    glyphCtx.fillRect(0, 0, glyphCanvas.width, glyphCanvas.height);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (cells[y][x]) {
                glyphCtx.fillStyle = ink;
                glyphCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    glyphCtx.strokeStyle = palette.grid;
    glyphCtx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
        const pos = i * cellSize;
        glyphCtx.beginPath();
        glyphCtx.moveTo(pos, 0);
        glyphCtx.lineTo(pos, glyphCanvas.height);
        glyphCtx.stroke();
        glyphCtx.beginPath();
        glyphCtx.moveTo(0, pos);
        glyphCtx.lineTo(glyphCanvas.width, pos);
        glyphCtx.stroke();
    }
}

function drawPreview() {
    previewCtx.fillStyle = "#08121e";
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    const cols = 10;
    const rows = 4;
    const cell = 20;
    const originX = 40;
    const originY = 32;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            drawGlyph(previewCtx, originX + col * cell, originY + row * cell, 2);
        }
    }

    previewCtx.fillStyle = "rgba(155, 176, 209, 0.6)";
    previewCtx.font = "14px 'IBM Plex Mono', monospace";
    previewCtx.fillText("ROM SLOT ACTIVE", 20, 18);
    previewCtx.fillText("VECTOR TABLE READY", 20, previewCanvas.height - 14);
}

function drawGlyph(ctx, x, y, scale = 1) {
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (cells[row][col]) {
                ctx.fillStyle = ink;
                ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
            }
        }
    }
}

function updateHex() {
    const bytes = cells.map((row) => {
        let value = 0;
        row.forEach((bit, idx) => {
            if (bit) {
                value |= 1 << (7 - idx);
            }
        });
        return `0x${value.toString(16).padStart(2, "0").toUpperCase()}`;
    });
    hexOutput.textContent = bytes.join(", ");

    const count = cells.flat().reduce((sum, bit) => sum + bit, 0);
    setStatus(`${count} pixels lit · ${bytes.length} bytes`);
}

function refresh() {
    renderGlyph();
    drawPreview();
    updateHex();
}

function applyPaint(x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const nextValue = paintMode === "paint" ? 1 : 0;
    if (cells[y][x] === nextValue) return;
    cells[y][x] = nextValue;
    tick(520);
    refresh();
}

function pointerToCell(event) {
    const rect = glyphCanvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size);
    return { x, y };
}

glyphCanvas.addEventListener("pointerdown", (event) => {
    isPointerDown = true;
    const { x, y } = pointerToCell(event);
    applyPaint(x, y);
});

glyphCanvas.addEventListener("pointermove", (event) => {
    if (!isPointerDown) return;
    const { x, y } = pointerToCell(event);
    applyPaint(x, y);
});

window.addEventListener("pointerup", () => {
    isPointerDown = false;
});

glyphCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

paintBtn.addEventListener("click", () => {
    paintMode = "paint";
    paintBtn.classList.add("active");
    eraseBtn.classList.remove("active");
    tick(640, 0.04);
});

eraseBtn.addEventListener("click", () => {
    paintMode = "erase";
    eraseBtn.classList.add("active");
    paintBtn.classList.remove("active");
    tick(360, 0.04);
});

function transform(action, label) {
    action();
    tick(520, 0.06);
    refresh();
    setStatus(label);
}

clearBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                cells[y][x] = 0;
            }
        }
    }, "Grid cleared");
});

invertBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                cells[y][x] = cells[y][x] ? 0 : 1;
            }
        }
    }, "Pixels inverted");
});

randomBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                cells[y][x] = Math.random() > 0.7 ? 1 : 0;
            }
        }
    }, "Noise applied");
});

mirrorXBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size / 2; x++) {
                cells[y][size - 1 - x] = cells[y][x];
            }
        }
    }, "Mirrored on X");
});

mirrorYBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size / 2; y++) {
            for (let x = 0; x < size; x++) {
                cells[size - 1 - y][x] = cells[y][x];
            }
        }
    }, "Mirrored on Y");
});

shiftLeftBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            const row = cells[y].slice(1);
            row.push(0);
            cells[y] = row;
        }
    }, "Shifted left");
});

shiftRightBtn.addEventListener("click", () => {
    transform(() => {
        for (let y = 0; y < size; y++) {
            const row = [0, ...cells[y].slice(0, size - 1)];
            cells[y] = row;
        }
    }, "Shifted right");
});

shiftUpBtn.addEventListener("click", () => {
    transform(() => {
        cells.push(Array(size).fill(0));
        cells.shift();
    }, "Shifted up");
});

shiftDownBtn.addEventListener("click", () => {
    transform(() => {
        cells.unshift(Array(size).fill(0));
        cells.pop();
    }, "Shifted down");
});

paletteButtons.forEach((button) => {
    button.addEventListener("click", () => {
        paletteButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        ink = button.dataset.color;
        tick(760, 0.04);
        refresh();
        setStatus("Ink color updated");
    });
});

exportBtn.addEventListener("click", () => {
    const exportCanvas = document.createElement("canvas");
    const scale = 16;
    exportCanvas.width = size * scale;
    exportCanvas.height = size * scale;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#0b111a";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (cells[y][x]) {
                exportCtx.fillStyle = ink;
                exportCtx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = "rom-glyph.png";
    link.click();
    tick(900, 0.08);
    setStatus("PNG exported");
});

copyBtn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(hexOutput.textContent);
        setStatus("Hex bytes copied to clipboard");
        tick(820, 0.07);
    } catch (error) {
        setStatus("Clipboard blocked — select and copy manually");
    }
});

audioToggle.addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    audioToggle.textContent = audioEnabled ? "Audio: On" : "Audio: Off";
    if (audioEnabled) {
        ensureAudio();
        tick(520, 0.06);
        setStatus("Audio enabled — taps trigger ticks");
    } else {
        setStatus("Audio muted");
    }
});

refresh();
