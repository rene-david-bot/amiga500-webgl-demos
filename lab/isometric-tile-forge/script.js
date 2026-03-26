const GRID_SIZE = 10;
const MAX_HEIGHT = 6;

const palette = [
  { name: "Mint", top: "#8ff6d7", left: "#57d2b5", right: "#3ca58f" },
  { name: "Coral", top: "#ff9aa5", left: "#e06b79", right: "#bb4658" },
  { name: "Azure", top: "#8dc6ff", left: "#5b98df", right: "#3f72b8" },
  { name: "Amber", top: "#ffd082", left: "#d7a552", right: "#af7f33" },
  { name: "Violet", top: "#ccb3ff", left: "#9f83df", right: "#7c60b7" },
  { name: "Lime", top: "#d6f787", left: "#a6ce54", right: "#7ba235" }
];

const editorCanvas = document.getElementById("editor");
const editorCtx = editorCanvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");

const ui = {
  palette: document.getElementById("palette"),
  selectedName: document.getElementById("selected-name"),
  blockCount: document.getElementById("block-count"),
  maxHeight: document.getElementById("max-height"),
  randomBtn: document.getElementById("btn-random"),
  plazaBtn: document.getElementById("btn-plaza"),
  clearBtn: document.getElementById("btn-clear"),
  exportBtn: document.getElementById("btn-export")
};

const state = {
  selectedColor: 0,
  cells: Array.from({ length: GRID_SIZE * GRID_SIZE }, () => ({ h: 0, c: 0 })),
  dragging: false,
  dragMode: "raise"
};

const editorCellSize = editorCanvas.width / GRID_SIZE;

function idx(x, y) {
  return y * GRID_SIZE + x;
}

function cellAt(x, y) {
  return state.cells[idx(x, y)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shade(hex, factor) {
  const clean = hex.replace("#", "");
  const int = Number.parseInt(clean, 16);
  const r = clamp(((int >> 16) & 255) * factor, 0, 255);
  const g = clamp(((int >> 8) & 255) * factor, 0, 255);
  const b = clamp((int & 255) * factor, 0, 255);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function setCell(x, y, mode) {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
  const cell = cellAt(x, y);

  if (mode === "raise") {
    cell.h = Math.min(MAX_HEIGHT, cell.h + 1);
    cell.c = state.selectedColor;
  } else if (mode === "lower") {
    cell.h = Math.max(0, cell.h - 1);
  } else if (mode === "paint") {
    if (cell.h === 0) {
      cell.h = 1;
    }
    cell.c = state.selectedColor;
  }
}

function updateStats() {
  let blocks = 0;
  let max = 0;
  for (const cell of state.cells) {
    blocks += cell.h;
    max = Math.max(max, cell.h);
  }
  ui.selectedName.textContent = palette[state.selectedColor].name;
  ui.blockCount.textContent = String(blocks);
  ui.maxHeight.textContent = String(max);
}

function drawEditor() {
  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  editorCtx.fillStyle = "#0b1230";
  editorCtx.fillRect(0, 0, editorCanvas.width, editorCanvas.height);

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const { h, c } = cellAt(x, y);
      const px = x * editorCellSize;
      const py = y * editorCellSize;

      if (h > 0) {
        const fill = shade(palette[c].top, 0.58 + h * 0.06);
        editorCtx.fillStyle = fill;
        editorCtx.fillRect(px + 1, py + 1, editorCellSize - 2, editorCellSize - 2);

        editorCtx.fillStyle = "rgba(11, 18, 42, 0.75)";
        editorCtx.font = "bold 11px Trebuchet MS";
        editorCtx.textAlign = "center";
        editorCtx.textBaseline = "middle";
        editorCtx.fillText(String(h), px + editorCellSize / 2, py + editorCellSize / 2);
      }

      editorCtx.strokeStyle = "rgba(130, 160, 231, 0.4)";
      editorCtx.lineWidth = 1;
      editorCtx.strokeRect(px + 0.5, py + 0.5, editorCellSize - 1, editorCellSize - 1);
    }
  }
}

function drawDiamond(ctx, x, y, halfW, halfH, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - halfH);
  ctx.lineTo(x + halfW, y);
  ctx.lineTo(x, y + halfH);
  ctx.lineTo(x - halfW, y);
  ctx.closePath();
  ctx.fill();
}

function drawPreview() {
  const tileW = 50;
  const tileH = 26;
  const blockH = 16;
  const originX = previewCanvas.width / 2;
  const originY = 82;

  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  const sky = previewCtx.createLinearGradient(0, 0, 0, previewCanvas.height);
  sky.addColorStop(0, "#1b2f67");
  sky.addColorStop(1, "#0a1228");
  previewCtx.fillStyle = sky;
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  for (let i = 0; i < 28; i++) {
    previewCtx.fillStyle = i % 2 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.04)";
    previewCtx.fillRect(0, i * 18, previewCanvas.width, 1);
  }

  for (let sum = 0; sum <= (GRID_SIZE - 1) * 2; sum++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const x = sum - y;
      if (x < 0 || x >= GRID_SIZE) continue;

      const cell = cellAt(x, y);
      if (cell.h === 0) continue;

      const isoX = originX + (x - y) * (tileW / 2);
      const isoY = originY + (x + y) * (tileH / 2);
      const colors = palette[cell.c];

      for (let level = 0; level < cell.h; level++) {
        const topY = isoY - level * blockH;

        drawDiamond(previewCtx, isoX, topY, tileW / 2, tileH / 2, colors.top);

        previewCtx.fillStyle = colors.left;
        previewCtx.beginPath();
        previewCtx.moveTo(isoX - tileW / 2, topY);
        previewCtx.lineTo(isoX, topY + tileH / 2);
        previewCtx.lineTo(isoX, topY + tileH / 2 + blockH);
        previewCtx.lineTo(isoX - tileW / 2, topY + blockH);
        previewCtx.closePath();
        previewCtx.fill();

        previewCtx.fillStyle = colors.right;
        previewCtx.beginPath();
        previewCtx.moveTo(isoX + tileW / 2, topY);
        previewCtx.lineTo(isoX, topY + tileH / 2);
        previewCtx.lineTo(isoX, topY + tileH / 2 + blockH);
        previewCtx.lineTo(isoX + tileW / 2, topY + blockH);
        previewCtx.closePath();
        previewCtx.fill();

        previewCtx.strokeStyle = "rgba(8, 14, 30, 0.25)";
        previewCtx.lineWidth = 1;
        previewCtx.beginPath();
        previewCtx.moveTo(isoX, topY - tileH / 2);
        previewCtx.lineTo(isoX + tileW / 2, topY);
        previewCtx.lineTo(isoX, topY + tileH / 2);
        previewCtx.lineTo(isoX - tileW / 2, topY);
        previewCtx.closePath();
        previewCtx.stroke();
      }
    }
  }

  previewCtx.fillStyle = "rgba(82, 242, 210, 0.8)";
  previewCtx.font = "12px Trebuchet MS";
  previewCtx.fillText("ISOMETRIC TILE FORGE • EXPORT READY", 18, previewCanvas.height - 18);
}

function render() {
  drawEditor();
  drawPreview();
  updateStats();
}

function getCellFromPointer(event) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE);
  return { x, y };
}

function pointerAction(event, mode) {
  const { x, y } = getCellFromPointer(event);
  setCell(x, y, mode);
  render();
}

editorCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

editorCanvas.addEventListener("pointerdown", (event) => {
  state.dragging = true;
  if (event.button === 2) {
    state.dragMode = "lower";
  } else if (event.shiftKey) {
    state.dragMode = "paint";
  } else {
    state.dragMode = "raise";
  }
  pointerAction(event, state.dragMode);
});

editorCanvas.addEventListener("pointermove", (event) => {
  if (!state.dragging) return;
  pointerAction(event, state.dragMode);
});

window.addEventListener("pointerup", () => {
  state.dragging = false;
});

function randomizeTerrain() {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = cellAt(x, y);
      const ridge = Math.sin((x / GRID_SIZE) * Math.PI * 2) + Math.cos((y / GRID_SIZE) * Math.PI * 1.6);
      const noise = Math.random() * 2.3;
      const base = Math.max(0, ridge + noise - 0.4);
      cell.h = clamp(Math.round(base * 1.8), 0, MAX_HEIGHT);
      if (cell.h > 0) {
        cell.c = Math.floor(Math.random() * palette.length);
      }
    }
  }
  render();
}

function buildPlaza() {
  for (const cell of state.cells) {
    cell.h = 0;
    cell.c = 0;
  }

  const center = (GRID_SIZE - 1) / 2;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = cellAt(x, y);
      const dist = Math.abs(x - center) + Math.abs(y - center);
      const h = clamp(5 - Math.round(dist), 0, MAX_HEIGHT);
      cell.h = h;
      if (h === 0) continue;
      if (h >= 4) {
        cell.c = 4;
      } else if (h >= 2) {
        cell.c = 2;
      } else {
        cell.c = 1;
      }
    }
  }
  render();
}

function flatten() {
  for (const cell of state.cells) {
    cell.h = 0;
  }
  render();
}

function exportPng() {
  const link = document.createElement("a");
  link.href = previewCanvas.toDataURL("image/png");
  link.download = "isometric-tile-forge.png";
  link.click();
}

function renderPalette() {
  ui.palette.innerHTML = "";
  palette.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    if (index === state.selectedColor) {
      button.classList.add("active");
    }

    const chip = document.createElement("div");
    chip.className = "swatch-chip";
    chip.style.background = `linear-gradient(90deg, ${entry.left}, ${entry.top}, ${entry.right})`;

    const name = document.createElement("div");
    name.className = "swatch-name";
    name.textContent = entry.name;

    button.append(chip, name);
    button.addEventListener("click", () => {
      state.selectedColor = index;
      renderPalette();
      updateStats();
    });
    ui.palette.appendChild(button);
  });
}

ui.randomBtn.addEventListener("click", randomizeTerrain);
ui.plazaBtn.addEventListener("click", buildPlaza);
ui.clearBtn.addEventListener("click", flatten);
ui.exportBtn.addEventListener("click", exportPng);

renderPalette();
buildPlaza();
