const SIZE = 4;
const FILES = [
    { id: "A", name: "System", className: "file-a" },
    { id: "B", name: "Graphics", className: "file-b" },
    { id: "C", name: "Audio", className: "file-c" }
];
const TOTAL_BLOCKS = FILES.length * SIZE;

const gridEl = document.getElementById("grid");
const movesEl = document.getElementById("moves");
const timeEl = document.getElementById("time");
const passesEl = document.getElementById("passes");
const defragPercentEl = document.getElementById("defrag-percent");
const progressFill = document.getElementById("progress-fill");
const statusEl = document.getElementById("status");
const audioToggle = document.getElementById("audio-toggle");
const reshuffleBtn = document.getElementById("reshuffle");
const resetBtn = document.getElementById("reset");

let cells = [];
let moves = 0;
let solved = false;
let startTime = null;
let timerId = null;

let audioOn = false;
let audioCtx = null;

const buildSolved = () => {
    const layout = [];
    FILES.forEach((file) => {
        for (let i = 1; i <= SIZE; i += 1) {
            layout.push({ file: file.id, fragment: i });
        }
    });
    for (let i = 0; i < SIZE; i += 1) {
        layout.push({ file: null, fragment: null });
    }
    return layout;
};

const getAdjacent = (index) => {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const neighbors = [];
    if (row > 0) neighbors.push(index - SIZE);
    if (row < SIZE - 1) neighbors.push(index + SIZE);
    if (col > 0) neighbors.push(index - 1);
    if (col < SIZE - 1) neighbors.push(index + 1);
    return neighbors;
};

const getEmptyNeighbors = (index) =>
    getAdjacent(index).filter((neighbor) => !cells[neighbor].file);

const moveBlock = (index, { countMove = true, playSound = true } = {}) => {
    const cell = cells[index];
    if (!cell.file) return false;
    const emptyNeighbors = getEmptyNeighbors(index);
    if (!emptyNeighbors.length) return false;

    const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
    cells[target] = cell;
    cells[index] = { file: null, fragment: null };

    if (countMove) {
        moves += 1;
        if (!startTime) startTimer();
        if (playSound) playMove();
    }

    return true;
};

const shuffle = (steps = 140) => {
    for (let i = 0; i < steps; i += 1) {
        const movable = cells
            .map((cell, idx) => (cell.file ? idx : null))
            .filter((idx) => idx !== null && getEmptyNeighbors(idx).length > 0);
        if (!movable.length) continue;
        const pick = movable[Math.floor(Math.random() * movable.length)];
        moveBlock(pick, { countMove: false, playSound: false });
    }
};

const computeDefrag = () => {
    let correct = 0;
    cells.forEach((cell, idx) => {
        if (!cell.file) return;
        const row = Math.floor(idx / SIZE);
        const targetRow = FILES.findIndex((file) => file.id === cell.file);
        if (row === targetRow) correct += 1;
    });
    return Math.round((correct / TOTAL_BLOCKS) * 100);
};

const render = () => {
    gridEl.innerHTML = "";
    cells.forEach((cell, idx) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.index = idx;

        if (!cell.file) {
            button.classList.add("empty");
            button.textContent = "";
        } else {
            const fileMeta = FILES.find((file) => file.id === cell.file);
            button.classList.add(fileMeta.className);
            const label = document.createElement("span");
            label.className = "label";
            label.textContent = fileMeta.id;
            const frag = document.createElement("span");
            frag.className = "frag";
            frag.textContent = `0${cell.fragment}`;
            button.append(label, frag);
        }

        gridEl.appendChild(button);
    });
};

const updateTimer = () => {
    if (!startTime) {
        timeEl.textContent = "00:00";
        return;
    }
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const mins = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    timeEl.textContent = `${mins}:${secs}`;
};

const startTimer = () => {
    startTime = Date.now();
    timerId = setInterval(updateTimer, 250);
};

const stopTimer = () => {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
};

const updateStats = () => {
    const percent = computeDefrag();
    defragPercentEl.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    movesEl.textContent = moves;
    passesEl.textContent = Math.floor(moves / 4);
    updateTimer();
    return percent;
};

const updateStatus = (percent) => {
    if (percent === 100) {
        statusEl.textContent = `Drive optimized in ${moves} moves.`;
        statusEl.style.color = "#7bffea";
    } else if (percent >= 70) {
        statusEl.textContent = "Almost compacted. Keep nudging the fragments.";
        statusEl.style.color = "#ffd166";
    } else if (percent >= 40) {
        statusEl.textContent = "Defrag in progress — keep clustering the rows.";
        statusEl.style.color = "#ffd166";
    } else {
        statusEl.textContent = "Slide blocks into matching rows to compact the disk.";
        statusEl.style.color = "#ffd166";
    }
};

const resetGame = ({ doShuffle = true } = {}) => {
    cells = buildSolved();
    if (doShuffle) shuffle();
    moves = 0;
    solved = false;
    startTime = null;
    stopTimer();
    render();
    const percent = updateStats();
    updateStatus(percent);
};

const ensureAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
};

const playTone = (frequency, duration = 0.1, type = "square", gainValue = 0.08) => {
    if (!audioOn) return;
    ensureAudio();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
};

const playMove = () => {
    playTone(520, 0.08, "square", 0.06);
};

const playSuccess = () => {
    playTone(660, 0.08, "triangle", 0.08);
    setTimeout(() => playTone(880, 0.1, "triangle", 0.09), 120);
    setTimeout(() => playTone(990, 0.12, "triangle", 0.1), 240);
};

gridEl.addEventListener("click", (event) => {
    const button = event.target.closest(".cell");
    if (!button || solved) return;
    const index = Number(button.dataset.index);
    if (Number.isNaN(index)) return;
    const moved = moveBlock(index);
    if (!moved) return;
    render();
    const percent = updateStats();
    updateStatus(percent);
    if (percent === 100 && !solved) {
        solved = true;
        stopTimer();
        playSuccess();
    }
});

audioToggle.addEventListener("click", () => {
    if (!audioOn) {
        audioOn = true;
        audioToggle.textContent = "Audio: On";
        audioToggle.classList.remove("ghost");
        playTone(740, 0.08, "triangle", 0.06);
    } else {
        audioOn = false;
        audioToggle.textContent = "Audio: Off";
        audioToggle.classList.add("ghost");
    }
});

reshuffleBtn.addEventListener("click", () => {
    resetGame({ doShuffle: true });
    if (audioOn) playTone(320, 0.12, "square", 0.05);
});

resetBtn.addEventListener("click", () => {
    resetGame({ doShuffle: false });
    if (audioOn) playTone(420, 0.1, "square", 0.05);
});

resetGame({ doShuffle: true });
