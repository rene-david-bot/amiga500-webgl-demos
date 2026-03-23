const levels = [
  {
    name: "Trainyard Warmup",
    map: [
      "#########",
      "#..T....#",
      "#..B....#",
      "#..P.BT.#",
      "#....B..#",
      "#..T....#",
      "#########"
    ]
  },
  {
    name: "Forklift Shuffle",
    map: [
      "##########",
      "#...T....#",
      "#.BBP....#",
      "#...##...#",
      "#...T..B.#",
      "#....T...#",
      "##########"
    ]
  },
  {
    name: "Signal Tangle",
    map: [
      "##########",
      "#..T..#..#",
      "#.B...#..#",
      "#..##...T#",
      "#..P.B...#",
      "#..#..B..#",
      "#..T.....#",
      "##########"
    ]
  },
  {
    name: "Night Cargo",
    map: [
      "###########",
      "#....T....#",
      "#.###.###.#",
      "#..B.B....#",
      "#..#P#..T.#",
      "#..B....T.#",
      "#.........#",
      "###########"
    ]
  },
  {
    name: "Yardmaster Final",
    map: [
      "###########",
      "#...T...T.#",
      "#.B.#.#.B.#",
      "#...#.#...#",
      "#.B..P..B.#",
      "#...#.#...#",
      "#.T.#.#.T.#",
      "###########"
    ]
  }
];

const board = document.getElementById("board");
const levelLabel = document.getElementById("levelLabel");
const movesLabel = document.getElementById("movesLabel");
const pushesLabel = document.getElementById("pushesLabel");
const bestLabel = document.getElementById("bestLabel");
const winBanner = document.getElementById("winBanner");
const winSummary = document.getElementById("winSummary");

const undoBtn = document.getElementById("undoBtn");
const restartBtn = document.getElementById("restartBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const continueBtn = document.getElementById("continueBtn");

let levelIndex = 0;
let state;
let history = [];
let audioCtx = null;

function cloneState(src) {
  return {
    width: src.width,
    height: src.height,
    walls: src.walls.map((row) => [...row]),
    targets: src.targets.map((row) => [...row]),
    crates: src.crates.map((row) => [...row]),
    player: { x: src.player.x, y: src.player.y },
    moves: src.moves,
    pushes: src.pushes,
    solved: src.solved
  };
}

function parseLevel(index) {
  const raw = levels[index].map;
  const height = raw.length;
  const width = raw[0].length;
  const walls = Array.from({ length: height }, () => Array(width).fill(false));
  const targets = Array.from({ length: height }, () => Array(width).fill(false));
  const crates = Array.from({ length: height }, () => Array(width).fill(false));
  let player = { x: 1, y: 1 };

  raw.forEach((line, y) => {
    [...line].forEach((char, x) => {
      if (char === "#") walls[y][x] = true;
      if (char === "T" || char === "+" || char === "*") targets[y][x] = true;
      if (char === "B" || char === "*") crates[y][x] = true;
      if (char === "P" || char === "+") player = { x, y };
    });
  });

  return { width, height, walls, targets, crates, player, moves: 0, pushes: 0, solved: false };
}

function loadLevel(index, keepBanner = false) {
  levelIndex = (index + levels.length) % levels.length;
  state = parseLevel(levelIndex);
  history = [];
  if (!keepBanner) winBanner.classList.add("hidden");
  render();
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function blip(freq = 380, duration = 0.06, type = "square", gain = 0.03) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function isInside(x, y) {
  return y >= 0 && y < state.height && x >= 0 && x < state.width;
}

function move(dx, dy) {
  if (state.solved) return;
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;

  if (!isInside(nx, ny) || state.walls[ny][nx]) {
    blip(150, 0.05, "sawtooth", 0.02);
    return;
  }

  const hasCrate = state.crates[ny][nx];
  if (hasCrate) {
    const cx = nx + dx;
    const cy = ny + dy;
    if (!isInside(cx, cy) || state.walls[cy][cx] || state.crates[cy][cx]) {
      blip(130, 0.05, "triangle", 0.02);
      return;
    }
    history.push(cloneState(state));
    state.crates[ny][nx] = false;
    state.crates[cy][cx] = true;
    state.player = { x: nx, y: ny };
    state.moves += 1;
    state.pushes += 1;
    blip(450, 0.05, "square", 0.03);
  } else {
    history.push(cloneState(state));
    state.player = { x: nx, y: ny };
    state.moves += 1;
    blip(300, 0.04, "square", 0.02);
  }

  checkSolved();
  render();
}

function checkSolved() {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (state.targets[y][x] && !state.crates[y][x]) return false;
    }
  }

  state.solved = true;
  saveBest();
  winSummary.textContent = `${levels[levelIndex].name} cleared in ${state.moves} moves · ${state.pushes} pushes.`;
  winBanner.classList.remove("hidden");
  blip(620, 0.1, "triangle", 0.04);
  setTimeout(() => blip(790, 0.12, "triangle", 0.04), 120);
  return true;
}

function bestKey() {
  return `crate-signal-yard-best-${levelIndex}`;
}

function saveBest() {
  const current = { moves: state.moves, pushes: state.pushes };
  const raw = localStorage.getItem(bestKey());
  if (!raw) {
    localStorage.setItem(bestKey(), JSON.stringify(current));
    return;
  }
  const best = JSON.parse(raw);
  const better = current.moves < best.moves || (current.moves === best.moves && current.pushes < best.pushes);
  if (better) localStorage.setItem(bestKey(), JSON.stringify(current));
}

function getBest() {
  const raw = localStorage.getItem(bestKey());
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function render() {
  board.style.setProperty("--cols", state.width);
  board.style.setProperty("--rows", state.height);
  board.innerHTML = "";

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (state.walls[y][x]) cell.classList.add("wall");
      if (state.targets[y][x]) cell.classList.add("target");
      if (state.crates[y][x]) cell.classList.add("crate");
      if (state.player.x === x && state.player.y === y) cell.classList.add("player");

      board.appendChild(cell);
    }
  }

  levelLabel.textContent = `${levelIndex + 1} / ${levels.length}`;
  movesLabel.textContent = String(state.moves);
  pushesLabel.textContent = String(state.pushes);

  const best = getBest();
  bestLabel.textContent = best ? `${best.moves}m · ${best.pushes}p` : "—";
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  state = prev;
  state.solved = false;
  winBanner.classList.add("hidden");
  blip(240, 0.05, "triangle", 0.02);
  render();
}

undoBtn.addEventListener("click", undo);
restartBtn.addEventListener("click", () => loadLevel(levelIndex));
prevBtn.addEventListener("click", () => loadLevel(levelIndex - 1));
nextBtn.addEventListener("click", () => loadLevel(levelIndex + 1));
continueBtn.addEventListener("click", () => loadLevel(levelIndex + 1));

document.querySelectorAll(".pad button[data-dir]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const dir = btn.dataset.dir;
    if (dir === "up") move(0, -1);
    if (dir === "down") move(0, 1);
    if (dir === "left") move(-1, 0);
    if (dir === "right") move(1, 0);
  });
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowup" || key === "w") move(0, -1);
  if (key === "arrowdown" || key === "s") move(0, 1);
  if (key === "arrowleft" || key === "a") move(-1, 0);
  if (key === "arrowright" || key === "d") move(1, 0);
  if (key === "z") undo();
  if (key === "r") loadLevel(levelIndex);
  if (key === "n") loadLevel(levelIndex + 1);
  if (key === "p") loadLevel(levelIndex - 1);
});

loadLevel(0);
