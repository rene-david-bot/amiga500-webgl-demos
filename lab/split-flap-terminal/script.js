const board = document.getElementById("board");
const flipCountEl = document.getElementById("flip-count");
const statusEl = document.getElementById("status");
const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const lineInputs = [
    document.getElementById("line1"),
    document.getElementById("line2"),
    document.getElementById("line3"),
];

const rows = 3;
const cols = 22;
const alphabet = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;/-+&";

const cells = [];
const current = [];
let target = [];
let flipTimer = null;
let flipSpeed = parseInt(speedInput.value, 10);
let totalFlips = 0;

let audioEnabled = false;
let audioCtx = null;

board.style.setProperty("--cols", cols);

for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
        const cell = document.createElement("span");
        cell.className = "flap";
        cell.textContent = " ";
        board.appendChild(cell);
        cells.push(cell);
        current.push(0);
    }
}

const charIndex = (char) => {
    const idx = alphabet.indexOf(char);
    return idx === -1 ? 0 : idx;
};

const normalizeLine = (line) => {
    const upper = (line || "").toUpperCase();
    const trimmed = upper.slice(0, cols).padEnd(cols, " ");
    return [...trimmed].map((char) => (alphabet.includes(char) ? char : " ")).join("");
};

const buildTarget = (lines) => {
    const safeLines = [];
    for (let i = 0; i < rows; i += 1) {
        safeLines.push(normalizeLine(lines[i] || ""));
    }
    return safeLines.flatMap((line) => [...line].map(charIndex));
};

const updateCell = (index) => {
    const cell = cells[index];
    cell.textContent = alphabet[current[index]];
    cell.classList.remove("flip");
    void cell.offsetWidth;
    cell.classList.add("flip");
};

const playClick = () => {
    if (!audioEnabled || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = 900 + Math.random() * 140;
    gain.gain.value = 0.035;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.07);
};

const setStatus = (text) => {
    statusEl.textContent = text;
};

const step = () => {
    let changed = false;
    for (let i = 0; i < current.length; i += 1) {
        if (current[i] !== target[i]) {
            current[i] = (current[i] + 1) % alphabet.length;
            updateCell(i);
            changed = true;
        }
    }

    if (changed) {
        totalFlips += 1;
        flipCountEl.textContent = totalFlips.toString();
        playClick();
    } else {
        clearInterval(flipTimer);
        flipTimer = null;
        setStatus("Board synced. Standing by.");
    }
};

const startFlipping = () => {
    if (flipTimer) clearInterval(flipTimer);
    flipTimer = setInterval(step, flipSpeed);
};

const setTargetLines = (lines, message = "Flipping to new dispatch.") => {
    target = buildTarget(lines);
    setStatus(message);
    startFlipping();
};

const updateFromInputs = () => {
    const lines = lineInputs.map((input) => input.value);
    setTargetLines(lines, "Updating board...");
};

const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomLine = () => {
    const starters = ["DRESDEN HBF", "ORBITAL PORT", "SECTOR BAY", "RETRO LAB", "PLATFORM 04", "CRYSTAL LINE"]; 
    const actions = ["BOARDING", "DELAYED", "LAST CALL", "GATE OPEN", "READY", "CLEAR"]; 
    const tails = ["NOW", "IN 5 MIN", "14:20", "15:05", "TRACK 6", "EXPRESS"]; 
    return `${randomPick(starters)} ${randomPick(actions)} ${randomPick(tails)}`;
};

const shuffleBoard = () => {
    const lines = [randomLine(), randomLine(), randomLine()];
    lineInputs.forEach((input, idx) => {
        input.value = normalizeLine(lines[idx]).trimEnd();
    });
    setTargetLines(lines, "Shuffling arrivals...");
};

const setAudio = async (enabled) => {
    if (enabled && !audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx) {
        await audioCtx.resume();
    }
    audioEnabled = enabled;
    document.getElementById("audio-toggle").textContent = `Audio: ${enabled ? "On" : "Off"}`;
};

speedInput.addEventListener("input", () => {
    flipSpeed = parseInt(speedInput.value, 10);
    speedValue.textContent = `${flipSpeed} ms`;
    if (flipTimer) startFlipping();
});

document.getElementById("apply").addEventListener("click", updateFromInputs);
document.getElementById("shuffle").addEventListener("click", shuffleBoard);
document.getElementById("audio-toggle").addEventListener("click", () => {
    setAudio(!audioEnabled);
});

lineInputs.forEach((input) => {
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            updateFromInputs();
        }
    });
});

document.querySelectorAll("[data-lines]").forEach((button) => {
    button.addEventListener("click", () => {
        const lines = button.dataset.lines.split("|");
        lineInputs.forEach((input, idx) => {
            input.value = lines[idx] || "";
        });
        setTargetLines(lines, "Preset loaded. Rolling...");
    });
});

speedValue.textContent = `${flipSpeed} ms`;
setTargetLines(lineInputs.map((input) => input.value), "Boot sequence complete.");
