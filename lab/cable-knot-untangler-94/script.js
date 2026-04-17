const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("level"),
  crossings: document.getElementById("crossings"),
  moves: document.getElementById("moves"),
  time: document.getElementById("time"),
  status: document.getElementById("status"),
  startBtn: document.getElementById("startBtn"),
  reshuffleBtn: document.getElementById("reshuffleBtn"),
  nextBtn: document.getElementById("nextBtn")
};

const state = {
  level: 1,
  nodes: [],
  edges: [],
  crossings: 0,
  crossingEdges: new Set(),
  moves: 0,
  running: false,
  solved: false,
  startTime: 0,
  elapsed: 0,
  dragId: null,
  dragMoved: false,
  pointerOffset: { x: 0, y: 0 },
  audioCtx: null,
  pulse: 0
};

function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function blip(freq = 540, dur = 0.07, type = "triangle", gain = 0.05) {
  if (!state.audioCtx) return;
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp).connect(state.audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function setStatus(text, good = false) {
  ui.status.innerHTML = text;
  ui.status.classList.toggle("good", good);
}

function updateHud() {
  ui.level.textContent = String(state.level);
  ui.crossings.textContent = String(state.crossings);
  ui.moves.textContent = String(state.moves);
  ui.time.textContent = `${state.elapsed.toFixed(1)}s`;
}

function getNodeCount(level) {
  return Math.min(12, 6 + level);
}

function solvedLayout(count) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radiusX = Math.min(canvas.width, canvas.height) * 0.34;
  const radiusY = radiusX * 0.82;
  const arr = [];

  for (let i = 0; i < count; i += 1) {
    const a = (-Math.PI / 2) + (Math.PI * 2 * i) / count;
    arr.push({
      x: cx + Math.cos(a) * radiusX,
      y: cy + Math.sin(a) * radiusY
    });
  }

  return arr;
}

function makeEdges(count) {
  const edges = [];

  for (let i = 0; i < count; i += 1) {
    edges.push([i, (i + 1) % count]);
  }

  for (let i = 2; i <= count - 2; i += 1) {
    edges.push([0, i]);
  }

  if (count >= 9) {
    for (let i = 2; i <= count - 3; i += 2) {
      edges.push([1, i]);
    }
  }

  return edges;
}

function shuffledIndices(count) {
  const arr = Array.from({ length: count }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function segmentCross(a, b, c, d) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const adx = d.x - a.x;
  const ady = d.y - a.y;

  const cdx = d.x - c.x;
  const cdy = d.y - c.y;
  const cax = a.x - c.x;
  const cay = a.y - c.y;
  const cbx = b.x - c.x;
  const cby = b.y - c.y;

  const d1 = abx * acy - aby * acx;
  const d2 = abx * ady - aby * adx;
  const d3 = cdx * cay - cdy * cax;
  const d4 = cdx * cby - cdy * cbx;

  return d1 * d2 < 0 && d3 * d4 < 0;
}

function recalcCrossings() {
  let total = 0;
  const crossingEdges = new Set();

  for (let i = 0; i < state.edges.length; i += 1) {
    const [a1, a2] = state.edges[i];
    for (let j = i + 1; j < state.edges.length; j += 1) {
      const [b1, b2] = state.edges[j];

      if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;

      const cross = segmentCross(state.nodes[a1], state.nodes[a2], state.nodes[b1], state.nodes[b2]);
      if (cross) {
        total += 1;
        crossingEdges.add(i);
        crossingEdges.add(j);
      }
    }
  }

  state.crossings = total;
  state.crossingEdges = crossingEdges;
}

function buildPuzzle() {
  const count = getNodeCount(state.level);
  const target = solvedLayout(count);
  const edges = makeEdges(count);

  let nodes = target.map((p, id) => ({ id, x: p.x, y: p.y, r: 16 }));
  let tries = 0;

  do {
    const map = shuffledIndices(count);
    nodes = nodes.map((node, i) => {
      const p = target[map[i]];
      return {
        ...node,
        x: p.x + (Math.random() - 0.5) * 24,
        y: p.y + (Math.random() - 0.5) * 24
      };
    });

    state.nodes = nodes;
    state.edges = edges;
    recalcCrossings();
    tries += 1;
  } while (state.crossings < Math.max(3, Math.floor(count / 2)) && tries < 50);

  state.moves = 0;
  state.elapsed = 0;
  state.dragId = null;
  state.dragMoved = false;
  state.running = false;
  state.solved = false;

  ui.nextBtn.disabled = true;
  ui.startBtn.textContent = "Start Shift";
  setStatus("Press <b>Start Shift</b> and drag the glowing nodes until no cable crossings remain.");
  updateHud();
}

function startShift() {
  ensureAudio();
  state.running = true;
  state.solved = false;
  state.startTime = performance.now() - state.elapsed * 1000;
  ui.startBtn.textContent = "Restart Shift";
  ui.nextBtn.disabled = true;
  setStatus("Shift live. Untangle every crossing before the supervisor comes back.");
  blip(500, 0.08, "triangle", 0.06);
}

function finishLevel() {
  state.running = false;
  state.solved = true;
  ui.nextBtn.disabled = false;
  const rank = state.moves <= 8 ? "Ace Tech" : state.moves <= 14 ? "Senior Tech" : "Bench Tech";
  setStatus(`Clean rack! <b>${state.elapsed.toFixed(1)}s</b> · <b>${state.moves}</b> moves · ${rank}.`, true);
  blip(760, 0.08, "triangle", 0.06);
  blip(1020, 0.11, "square", 0.05);
}

function toCanvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * sx,
    y: (evt.clientY - rect.top) * sy
  };
}

function pickNode(x, y) {
  for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
    const n = state.nodes[i];
    const dx = x - n.x;
    const dy = y - n.y;
    if (dx * dx + dy * dy <= (n.r + 6) ** 2) {
      return n.id;
    }
  }
  return null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function onPointerDown(evt) {
  const p = toCanvasPoint(evt);
  const nodeId = pickNode(p.x, p.y);
  if (nodeId == null) return;

  if (!state.running) {
    startShift();
  }

  const n = state.nodes[nodeId];
  state.dragId = nodeId;
  state.dragMoved = false;
  state.pointerOffset.x = p.x - n.x;
  state.pointerOffset.y = p.y - n.y;
  canvas.setPointerCapture(evt.pointerId);
}

function onPointerMove(evt) {
  if (state.dragId == null) return;
  const p = toCanvasPoint(evt);
  const n = state.nodes[state.dragId];
  const nx = clamp(p.x - state.pointerOffset.x, 28, canvas.width - 28);
  const ny = clamp(p.y - state.pointerOffset.y, 28, canvas.height - 28);

  if (Math.abs(nx - n.x) > 0.5 || Math.abs(ny - n.y) > 0.5) {
    state.dragMoved = true;
  }

  n.x = nx;
  n.y = ny;

  recalcCrossings();
  updateHud();

  if (state.running && state.crossings === 0) {
    finishLevel();
  }
}

function onPointerUp(evt) {
  if (state.dragId == null) return;

  if (state.dragMoved) {
    state.moves += 1;
    updateHud();
    if (state.running) {
      blip(260 + Math.random() * 120, 0.03, "square", 0.028);
    }
  }

  state.dragId = null;
  state.dragMoved = false;
  if (canvas.hasPointerCapture(evt.pointerId)) {
    canvas.releasePointerCapture(evt.pointerId);
  }
}

function drawBackground(now) {
  const grad = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.45, 20, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.7);
  grad.addColorStop(0, "#142348");
  grad.addColorStop(0.62, "#0a1328");
  grad.addColorStop(1, "#050913");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gridAlpha = 0.12 + Math.sin(now * 0.0018) * 0.03;
  ctx.strokeStyle = `rgba(124, 255, 246, ${gridAlpha.toFixed(3)})`;
  ctx.lineWidth = 1;

  for (let x = 0; x <= canvas.width; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= canvas.height; y += 44) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
}

function drawEdges(now) {
  state.pulse = 0.55 + Math.sin(now * 0.004) * 0.45;

  state.edges.forEach(([a, b], index) => {
    const n1 = state.nodes[a];
    const n2 = state.nodes[b];
    const hot = state.crossingEdges.has(index);

    ctx.lineWidth = hot ? 4 : 2.6;
    ctx.strokeStyle = hot
      ? `rgba(255, 127, 159, ${0.75 + state.pulse * 0.25})`
      : "rgba(128, 214, 255, 0.82)";
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke();
  });
}

function drawNodes() {
  state.nodes.forEach((n) => {
    const dragging = state.dragId === n.id;

    const glow = ctx.createRadialGradient(n.x - 4, n.y - 4, 2, n.x, n.y, n.r + 15);
    glow.addColorStop(0, dragging ? "rgba(255, 252, 179, 1)" : "rgba(124, 255, 246, 0.95)");
    glow.addColorStop(1, "rgba(124, 255, 246, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r + 15, 0, Math.PI * 2);
    ctx.fill();

    const fill = ctx.createRadialGradient(n.x - 4, n.y - 5, 1, n.x, n.y, n.r);
    fill.addColorStop(0, "#f7fcff");
    fill.addColorStop(0.45, dragging ? "#ffe894" : "#8ffdf4");
    fill.addColorStop(1, "#2f6d90");
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(220, 243, 255, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

function drawScanlines() {
  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.fillStyle = "#0a1327";
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.restore();
}

function frame(now) {
  if (state.running) {
    state.elapsed = (now - state.startTime) / 1000;
  }

  updateHud();

  drawBackground(now);
  drawEdges(now);
  drawNodes();
  drawScanlines();

  requestAnimationFrame(frame);
}

ui.startBtn.addEventListener("click", () => {
  buildPuzzle();
  startShift();
});

ui.reshuffleBtn.addEventListener("click", () => {
  buildPuzzle();
});

ui.nextBtn.addEventListener("click", () => {
  state.level += 1;
  buildPuzzle();
  startShift();
});

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);
canvas.addEventListener("pointerleave", onPointerUp);

buildPuzzle();
requestAnimationFrame(frame);
