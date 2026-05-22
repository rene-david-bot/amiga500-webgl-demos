const GRID = 24;
const CELL = 24;
const SLUG = "pixel-tattoo-parlor-94";

const board = document.getElementById("board");
const boardCtx = board.getContext("2d");
boardCtx.imageSmoothingEnabled = false;

const preview = document.getElementById("preview");
const previewCtx = preview.getContext("2d");
previewCtx.imageSmoothingEnabled = false;

const colorPicker = document.getElementById("colorPicker");
const zoneSelect = document.getElementById("zoneSelect");
const mirrorCheck = document.getElementById("mirrorCheck");
const clearBtn = document.getElementById("clearBtn");
const motifBtn = document.getElementById("motifBtn");
const stampBtn = document.getElementById("stampBtn");
const exportBtn = document.getElementById("exportBtn");
const statusEl = document.getElementById("status");

const pixels = new Array(GRID * GRID).fill(null);
let painting = false;
let erasing = false;
let stampSnapshot = null;

const zones = {
  arm: { x: 398, y: 350, w: 95, h: 170, rotate: -0.25, label: "Arm" },
  chest: { x: 270, y: 280, w: 170, h: 130, rotate: -0.02, label: "Chest" },
  back: { x: 270, y: 258, w: 175, h: 155, rotate: 0.02, label: "Back" }
};

const motifPalette = ["#4bf0ff", "#ff4fd8", "#ffd34b", "#8eff7a", "#ff6b6b"];

function idx(x, y) {
  return y * GRID + x;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}

function clearGrid() {
  pixels.fill(null);
  renderBoard();
}

function setPixel(x, y, color) {
  if (!inBounds(x, y)) return;
  pixels[idx(x, y)] = color;
}

function paintAt(x, y, color) {
  if (!inBounds(x, y)) return;
  setPixel(x, y, color);

  if (mirrorCheck.checked) {
    const mx = GRID - 1 - x;
    setPixel(mx, y, color);
  }

  renderBoard();
}

function getCellFromEvent(event) {
  const rect = board.getBoundingClientRect();
  const scaleX = board.width / rect.width;
  const scaleY = board.height / rect.height;
  const x = Math.floor(((event.clientX - rect.left) * scaleX) / CELL);
  const y = Math.floor(((event.clientY - rect.top) * scaleY) / CELL);
  return { x, y };
}

function applyStroke(event) {
  const { x, y } = getCellFromEvent(event);
  paintAt(x, y, erasing ? null : colorPicker.value);
}

function renderBoard() {
  boardCtx.fillStyle = "#080a13";
  boardCtx.fillRect(0, 0, board.width, board.height);

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const color = pixels[idx(x, y)];
      if (!color) continue;
      boardCtx.fillStyle = color;
      boardCtx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  boardCtx.strokeStyle = "rgba(147, 159, 200, 0.24)";
  boardCtx.lineWidth = 1;
  for (let i = 0; i <= GRID; i += 1) {
    const p = i * CELL + 0.5;
    boardCtx.beginPath();
    boardCtx.moveTo(p, 0);
    boardCtx.lineTo(p, board.height);
    boardCtx.stroke();

    boardCtx.beginPath();
    boardCtx.moveTo(0, p);
    boardCtx.lineTo(board.width, p);
    boardCtx.stroke();
  }
}

function makeTattooCanvas() {
  const c = document.createElement("canvas");
  c.width = GRID;
  c.height = GRID;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const color = pixels[idx(x, y)];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return c;
}

function drawBodyShape() {
  const g = previewCtx.createLinearGradient(0, 180, 0, preview.height);
  g.addColorStop(0, "#2a314f");
  g.addColorStop(1, "#181c2f");
  previewCtx.fillStyle = g;

  previewCtx.beginPath();
  previewCtx.arc(270, 120, 64, 0, Math.PI * 2);
  previewCtx.fill();

  previewCtx.beginPath();
  previewCtx.roundRect(185, 185, 170, 285, 48);
  previewCtx.fill();

  previewCtx.beginPath();
  previewCtx.roundRect(108, 216, 66, 225, 35);
  previewCtx.fill();

  previewCtx.beginPath();
  previewCtx.roundRect(366, 216, 66, 225, 35);
  previewCtx.fill();

  previewCtx.beginPath();
  previewCtx.roundRect(205, 452, 55, 150, 25);
  previewCtx.fill();

  previewCtx.beginPath();
  previewCtx.roundRect(282, 452, 55, 150, 25);
  previewCtx.fill();
}

function drawZoneHighlight(zone) {
  previewCtx.save();
  previewCtx.translate(zone.x, zone.y);
  previewCtx.rotate(zone.rotate);

  previewCtx.fillStyle = "rgba(75, 240, 255, 0.12)";
  previewCtx.strokeStyle = "rgba(75, 240, 255, 0.75)";
  previewCtx.lineWidth = 2;

  previewCtx.beginPath();
  previewCtx.roundRect(-zone.w / 2, -zone.h / 2, zone.w, zone.h, 16);
  previewCtx.fill();
  previewCtx.stroke();
  previewCtx.restore();
}

function drawTattoo(zone, tattooCanvas) {
  previewCtx.save();
  previewCtx.translate(zone.x, zone.y);
  previewCtx.rotate(zone.rotate);
  previewCtx.globalAlpha = 0.88;
  previewCtx.drawImage(tattooCanvas, -zone.w / 2, -zone.h / 2, zone.w, zone.h);
  previewCtx.globalAlpha = 1;
  previewCtx.restore();
}

function drawCrtOverlay() {
  previewCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let y = 0; y < preview.height; y += 4) {
    previewCtx.fillRect(0, y, preview.width, 1);
  }

  const vignette = previewCtx.createRadialGradient(270, 320, 120, 270, 320, 360);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.48)");
  previewCtx.fillStyle = vignette;
  previewCtx.fillRect(0, 0, preview.width, preview.height);
}

function renderPreview() {
  const zone = zones[zoneSelect.value];
  previewCtx.fillStyle = "#090b16";
  previewCtx.fillRect(0, 0, preview.width, preview.height);

  drawBodyShape();
  drawZoneHighlight(zone);

  const current = stampSnapshot || makeTattooCanvas();
  drawTattoo(zone, current);

  previewCtx.fillStyle = "#4bf0ff";
  previewCtx.font = "600 16px 'Trebuchet MS', sans-serif";
  previewCtx.fillText(`Zone: ${zone.label}`, 18, 30);
  previewCtx.fillStyle = "#9aa4c8";
  previewCtx.font = "14px 'Trebuchet MS', sans-serif";
  previewCtx.fillText("Pixel Tattoo Parlor '94", 18, 54);

  drawCrtOverlay();
}

function line(x0, y0, x1, y1, color) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    setPixel(x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function circle(cx, cy, r, color) {
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (Math.abs(d - r) < 0.7) setPixel(x, y, color);
    }
  }
}

function randomMotif() {
  clearGrid();
  const color = motifPalette[Math.floor(Math.random() * motifPalette.length)];
  const pick = Math.floor(Math.random() * 4);

  if (pick === 0) {
    line(11, 2, 13, 7, color);
    line(13, 7, 9, 13, color);
    line(9, 13, 14, 21, color);
    line(8, 14, 16, 14, color);
  } else if (pick === 1) {
    circle(12, 12, 8, color);
    circle(12, 12, 4, color);
    line(12, 4, 12, 20, color);
    line(4, 12, 20, 12, color);
  } else if (pick === 2) {
    line(12, 3, 12, 19, color);
    line(8, 7, 16, 7, color);
    line(9, 19, 15, 19, color);
    line(9, 19, 12, 23, color);
    line(15, 19, 12, 23, color);
  } else {
    for (let y = 4; y <= 20; y += 1) {
      const wobble = Math.round(Math.sin(y * 0.85) * 3);
      setPixel(12 + wobble, y, color);
      setPixel(11 + wobble, y, color);
      if (y % 3 === 0) setPixel(13 + wobble, y, color);
    }
  }

  renderBoard();
  stampSnapshot = makeTattooCanvas();
  renderPreview();
  statusEl.textContent = "Random flash generated and stamped.";
}

function exportCard() {
  const out = document.createElement("canvas");
  out.width = 1320;
  out.height = 760;
  const ctx = out.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, out.width, out.height);
  bg.addColorStop(0, "#0a1025");
  bg.addColorStop(1, "#09060f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);

  ctx.strokeStyle = "#2f3d75";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, out.width - 40, out.height - 40);

  ctx.fillStyle = "#4bf0ff";
  ctx.font = "700 40px 'Trebuchet MS', sans-serif";
  ctx.fillText("Pixel Tattoo Parlor '94", 48, 76);

  ctx.fillStyle = "#a9b2d8";
  ctx.font = "22px 'Trebuchet MS', sans-serif";
  ctx.fillText("Retro Lab flash card", 50, 112);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(board, 52, 148, 560, 560);
  ctx.drawImage(preview, 708, 78, 560, 664);

  const link = document.createElement("a");
  link.download = `${SLUG}-${Date.now()}.png`;
  link.href = out.toDataURL("image/png");
  link.click();

  statusEl.textContent = "PNG exported to your downloads.";
}

board.addEventListener("contextmenu", (event) => event.preventDefault());

board.addEventListener("pointerdown", (event) => {
  painting = true;
  erasing = event.button === 2 || event.shiftKey;
  board.setPointerCapture(event.pointerId);
  applyStroke(event);
});

board.addEventListener("pointermove", (event) => {
  if (!painting) return;
  applyStroke(event);
});

function stopPaint(event) {
  if (!painting) return;
  painting = false;
  stampSnapshot = makeTattooCanvas();
  renderPreview();
  if (event?.pointerId !== undefined && board.hasPointerCapture(event.pointerId)) {
    board.releasePointerCapture(event.pointerId);
  }
}

board.addEventListener("pointerup", stopPaint);
board.addEventListener("pointercancel", stopPaint);
board.addEventListener("pointerleave", (event) => {
  if (painting && event.buttons === 0) stopPaint(event);
});

clearBtn.addEventListener("click", () => {
  clearGrid();
  stampSnapshot = makeTattooCanvas();
  renderPreview();
  statusEl.textContent = "Board cleared.";
});

motifBtn.addEventListener("click", randomMotif);

stampBtn.addEventListener("click", () => {
  stampSnapshot = makeTattooCanvas();
  renderPreview();
  statusEl.textContent = `Stamped on ${zones[zoneSelect.value].label.toLowerCase()} zone.`;
});

zoneSelect.addEventListener("change", () => {
  renderPreview();
  statusEl.textContent = `Preview switched to ${zones[zoneSelect.value].label.toLowerCase()} zone.`;
});

mirrorCheck.addEventListener("change", () => {
  statusEl.textContent = mirrorCheck.checked ? "Mirror mode on." : "Mirror mode off.";
});

exportBtn.addEventListener("click", exportCard);

randomMotif();
