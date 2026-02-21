const words = {
    short: [
        "BYTE",
        "NODE",
        "PORT",
        "SCAN",
        "SYNC",
        "TRACE",
        "CODE",
        "PULSE",
        "BOOT",
        "GRID",
        "LOCK",
        "RING",
        "ARC",
        "CORE",
        "VOLT",
        "SPARK",
        "WIRE",
        "LINK",
        "ECHO",
        "GLOW"
    ],
    medium: [
        "VIRTUAL",
        "STACK",
        "VECTOR",
        "CONSOLE",
        "PROTOCOL",
        "DRIVER",
        "PACKET",
        "MODEM",
        "SIGNAL",
        "PHOSPHOR",
        "KEYFRAME",
        "DISPLAY",
        "TRANSIT",
        "MONITOR",
        "ARCHIVE",
        "PROCESS",
        "FIRMWARE",
        "COMPILER"
    ],
    long: [
        "CALIBRATION",
        "RETROFITTED",
        "INTERLOCK",
        "MOTHERBOARD",
        "CRYPTOGRAPHY",
        "HYPERDRIVE",
        "RESONANCE",
        "THERMALCORE",
        "MULTIPLEXER",
        "RECONSTRUCTION",
        "OSCILLATION",
        "TRANSMISSION",
        "SUBROUTINES",
        "SPECTRUM"
    ]
};

const targetEl = document.getElementById("target");
const typedEl = document.getElementById("typed");
const statusEl = document.getElementById("status");
const timeEl = document.getElementById("time");
const wpmEl = document.getElementById("wpm");
const accuracyEl = document.getElementById("accuracy");
const streakEl = document.getElementById("streak");
const wordsEl = document.getElementById("words");
const startBtn = document.getElementById("start");
const resetBtn = document.getElementById("reset");
const soundBtn = document.getElementById("sound");
const difficultySelect = document.getElementById("difficulty");

let currentWord = "";
let typed = "";
let running = false;
let totalTyped = 0;
let totalErrors = 0;
let correctWords = 0;
let streak = 0;
let duration = 60;
let remaining = duration;
let timerId = null;
let startTime = null;
let soundOn = false;
let audioCtx = null;
let gainNode = null;

const caret = document.createElement("span");
caret.className = "caret";
caret.textContent = "█";

function pickWord() {
    const pool = words[difficultySelect.value];
    currentWord = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
    typed = "";
    renderTarget();
    renderTyped();
}

function renderTarget() {
    targetEl.innerHTML = "";
    currentWord.split("").forEach((char, index) => {
        const span = document.createElement("span");
        const typedChar = typed[index];
        if (!typedChar) {
            span.className = "ghost";
        } else if (typedChar === char) {
            span.className = "hit";
        } else {
            span.className = "miss";
        }
        span.textContent = char;
        targetEl.appendChild(span);
    });
}

function renderTyped() {
    typedEl.textContent = typed;
    typedEl.appendChild(caret);
}

function updateStats() {
    const elapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const wpm = Math.round((correctWords / elapsed) * 60);
    const accuracy = totalTyped === 0 ? 100 : Math.max(0, Math.round(((totalTyped - totalErrors) / totalTyped) * 100));

    wpmEl.textContent = Number.isFinite(wpm) ? wpm : 0;
    accuracyEl.textContent = `${accuracy}%`;
    streakEl.textContent = streak;
    wordsEl.textContent = correctWords;
}

function updateTime() {
    timeEl.textContent = `${remaining}s`;
}

function startSession() {
    if (running) return;
    running = true;
    startTime = Date.now();
    remaining = duration;
    updateTime();
    statusEl.textContent = "Range armed — lock onto the word.";
    timerId = setInterval(() => {
        remaining -= 1;
        updateTime();
        if (remaining <= 0) {
            endSession();
        }
    }, 1000);
}

function endSession() {
    running = false;
    clearInterval(timerId);
    timerId = null;
    statusEl.textContent = "Session complete. Press New Session to run it again.";
}

function resetSession() {
    running = false;
    clearInterval(timerId);
    timerId = null;
    totalTyped = 0;
    totalErrors = 0;
    correctWords = 0;
    streak = 0;
    startTime = Date.now();
    remaining = duration;
    updateTime();
    updateStats();
    pickWord();
    statusEl.textContent = "Press Start or begin typing to arm the range.";
}

function playTone(frequency, durationMs, type = "square") {
    if (!soundOn) return;
    if (!audioCtx) {
        audioCtx = new AudioContext();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.08;
        gainNode.connect(audioCtx.destination);
    }
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gainNode);
    const now = audioCtx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
}

function handleInput(key) {
    if (!running) {
        startSession();
    }

    if (key === "BACKSPACE") {
        typed = typed.slice(0, -1);
        renderTarget();
        renderTyped();
        return;
    }

    if (!/^[A-Z0-9]$/.test(key)) {
        return;
    }

    typed += key;
    totalTyped += 1;

    if (typed[typed.length - 1] !== currentWord[typed.length - 1]) {
        totalErrors += 1;
        statusEl.textContent = "Signal drift — recalibrate.";
        playTone(180, 90, "sawtooth");
    } else {
        playTone(480, 60, "square");
    }

    renderTarget();
    renderTyped();

    if (typed.length >= currentWord.length) {
        if (typed === currentWord) {
            correctWords += 1;
            streak += 1;
            statusEl.textContent = "Locked. Next target incoming.";
            playTone(720, 120, "triangle");
        } else {
            streak = 0;
            statusEl.textContent = "Missed. Resetting lock.";
            playTone(140, 140, "sawtooth");
        }
        pickWord();
    }

    updateStats();
}

startBtn.addEventListener("click", () => {
    startSession();
    statusEl.textContent = "Range armed — lock onto the word.";
});

resetBtn.addEventListener("click", () => {
    resetSession();
});

soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    if (soundOn) {
        if (!audioCtx) {
            audioCtx = new AudioContext();
            gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.08;
            gainNode.connect(audioCtx.destination);
        }
        playTone(440, 80, "square");
        soundBtn.textContent = "Sound: On";
        statusEl.textContent = "Audio online — pulses armed.";
    } else {
        soundBtn.textContent = "Sound: Off";
        statusEl.textContent = "Audio muted.";
    }
});

difficultySelect.addEventListener("change", () => {
    resetSession();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Backspace") {
        event.preventDefault();
        handleInput("BACKSPACE");
        return;
    }

    if (event.key.length === 1) {
        handleInput(event.key.toUpperCase());
    }
});

resetSession();
