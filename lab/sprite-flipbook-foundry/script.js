const GRID = 16;
const FRAME_COUNT = 8;
const EDITOR_SCALE = 20;

const PALETTE = [
  { name: "Transparent", color: "#00000000" },
  { name: "Phosphor", color: "#45f0df" },
  { name: "Magenta", color: "#ff4fbf" },
  { name: "Amber", color: "#ffc24b" },
  { name: "Sky", color: "#66b5ff" },
  { name: "Lime", color: "#9cfb64" },
  { name: "Coral", color: "#ff7466" },
  { name: "Ivory", color: "#eef6ff" }
];

const frames = Array.from({ length: FRAME_COUNT }, () => new Uint8Array(GRID * GRID));

const editorCanvas = document.getElementById("editor");
const editorCtx = editorCanvas.getContext("2d");
const previewCanvas = document.getElementById("preview");
const previewCtx = previewCanvas.getContext("2d");

const paletteEl = document.getElementById("palette");
const framesEl = document.getElementById("frames");
const activeFrameLabel = document.getElementById("active-frame-label");
const previewState = document.getElementById("preview-state");
const fpsInput = document.getElementById("fps");
const fpsValue = document.getElementById("fps-value");

const penBtn = document.getElementById("tool-pen");
const eraserBtn = document.getElementById("tool-eraser");
const onionBtn = document.getElementById("onion-toggle");
const playBtn = document.getElementById("play-toggle");
const clearFrameBtn = document.getElementById("clear-frame");
const clearAllBtn = document.getElementById("clear-all");
const randomizeBtn = document.getElementById("randomize");
const exportBtn = document.getElementById("export-sheet");

let currentFrame = 0;
let selectedColor = 1;
let tool = "pen";
let onionSkin = true;
let isDrawing = false;
let isPlaying = true;
let previewFrame = 0;
let fps = Number(fpsInput.value);
let lastTick = performance.now();

editorCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

function cellIndex(x, y) {
  return y * GRID + x;
}

function drawChecker(ctx, width, height, cell = 8) {
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const odd = ((x / cell) + (y / cell)) % 2 === 0;
      ctx.fillStyle = odd ? "#0e1430" : "#131b3c";
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function paintPixel(frameIndex, x, y, colorIndex) {
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return;
  frames[frameIndex][cellIndex(x, y)] = colorIndex;
}

function drawEditor() {
  drawChecker(editorCtx, editorCanvas.width, editorCanvas.height, 16);

  if (onionSkin && currentFrame > 0) {
    const previous = frames[currentFrame - 1];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const colorIndex = previous[cellIndex(x, y)];
        if (!colorIndex) continue;
        editorCtx.fillStyle = `${PALETTE[colorIndex].color}55`;
        editorCtx.fillRect(x * EDITOR_SCALE, y * EDITOR_SCALE, EDITOR_SCALE, EDITOR_SCALE);
      }
    }
  }

  const active = frames[currentFrame];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const colorIndex = active[cellIndex(x, y)];
      if (!colorIndex) continue;
      editorCtx.fillStyle = PALETTE[colorIndex].color;
      editorCtx.fillRect(x * EDITOR_SCALE, y * EDITOR_SCALE, EDITOR_SCALE, EDITOR_SCALE);
    }
  }

  editorCtx.strokeStyle = "rgba(180, 200, 255, 0.2)";
  editorCtx.lineWidth = 1;
  for (let x = 0; x <= GRID; x++) {
    const px = x * EDITOR_SCALE + 0.5;
    editorCtx.beginPath();
    editorCtx.moveTo(px, 0);
    editorCtx.lineTo(px, editorCanvas.height);
    editorCtx.stroke();
  }
  for (let y = 0; y <= GRID; y++) {
    const py = y * EDITOR_SCALE + 0.5;
    editorCtx.beginPath();
    editorCtx.moveTo(0, py);
    editorCtx.lineTo(editorCanvas.width, py);
    editorCtx.stroke();
  }
}

function drawFrameToContext(frameData, ctx, xOffset, yOffset, scale) {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const colorIndex = frameData[cellIndex(x, y)];
      if (!colorIndex) continue;
      ctx.fillStyle = PALETTE[colorIndex].color;
      ctx.fillRect(xOffset + x * scale, yOffset + y * scale, scale, scale);
    }
  }
}

function drawPreview() {
  drawChecker(previewCtx, previewCanvas.width, previewCanvas.height, 12);

  const frameData = frames[previewFrame];
  const spriteScale = Math.floor(previewCanvas.width / GRID);
  const offsetX = Math.floor((previewCanvas.width - GRID * spriteScale) / 2);
  const offsetY = Math.floor((previewCanvas.height - GRID * spriteScale) / 2);

  drawFrameToContext(frameData, previewCtx, offsetX, offsetY, spriteScale);
}

function renderFrameThumb(thumbCanvas, frameIndex) {
  const ctx = thumbCanvas.getContext("2d");
  drawChecker(ctx, thumbCanvas.width, thumbCanvas.height, 4);
  drawFrameToContext(frames[frameIndex], ctx, 0, 0, thumbCanvas.width / GRID);
}

function buildPalette() {
  paletteEl.innerHTML = "";
  PALETTE.forEach((swatch, index) => {
    const btn = document.createElement("button");
    btn.className = "color-swatch";
    btn.title = swatch.name;
    btn.style.background = index === 0 ? "repeating-conic-gradient(#1f2b4f 0% 25%, #101a33 0% 50%) 50% / 12px 12px" : swatch.color;
    if (index === selectedColor) btn.classList.add("active");
    btn.addEventListener("click", () => {
      selectedColor = index;
      tool = index === 0 ? "eraser" : "pen";
      refreshToolButtons();
      buildPalette();
    });
    paletteEl.appendChild(btn);
  });
}

function buildFrameButtons() {
  framesEl.innerHTML = "";
  for (let i = 0; i < FRAME_COUNT; i++) {
    const btn = document.createElement("button");
    btn.className = "frame-btn";
    if (i === currentFrame) btn.classList.add("active");

    const thumb = document.createElement("canvas");
    thumb.width = 48;
    thumb.height = 48;
    renderFrameThumb(thumb, i);

    const label = document.createElement("div");
    label.textContent = `F${i + 1}`;

    btn.appendChild(thumb);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      currentFrame = i;
      activeFrameLabel.textContent = `Frame ${currentFrame + 1} / ${FRAME_COUNT}`;
      buildFrameButtons();
      drawEditor();
    });

    framesEl.appendChild(btn);
  }
}

function refreshToolButtons() {
  penBtn.classList.toggle("active", tool === "pen");
  eraserBtn.classList.toggle("active", tool === "eraser");
  onionBtn.textContent = `Onion Skin: ${onionSkin ? "On" : "Off"}`;
  playBtn.textContent = isPlaying ? "Pause" : "Play";
  previewState.textContent = isPlaying ? "Playing" : "Paused";
}

function getCellFromPointer(event) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / (rect.width / GRID));
  const y = Math.floor((event.clientY - rect.top) / (rect.height / GRID));
  return { x, y };
}

function drawAtPointer(event) {
  const { x, y } = getCellFromPointer(event);
  const colorIndex = tool === "eraser" || event.buttons === 2 ? 0 : selectedColor;
  paintPixel(currentFrame, x, y, colorIndex);
  drawEditor();
  buildFrameButtons();
}

editorCanvas.addEventListener("pointerdown", (event) => {
  isDrawing = true;
  editorCanvas.setPointerCapture(event.pointerId);
  drawAtPointer(event);
});

editorCanvas.addEventListener("pointermove", (event) => {
  if (!isDrawing) return;
  drawAtPointer(event);
});

editorCanvas.addEventListener("pointerup", () => {
  isDrawing = false;
});

editorCanvas.addEventListener("pointerleave", () => {
  isDrawing = false;
});

penBtn.addEventListener("click", () => {
  tool = "pen";
  if (selectedColor === 0) selectedColor = 1;
  buildPalette();
  refreshToolButtons();
});

eraserBtn.addEventListener("click", () => {
  tool = "eraser";
  refreshToolButtons();
});

onionBtn.addEventListener("click", () => {
  onionSkin = !onionSkin;
  refreshToolButtons();
  drawEditor();
});

playBtn.addEventListener("click", () => {
  isPlaying = !isPlaying;
  refreshToolButtons();
});

fpsInput.addEventListener("input", () => {
  fps = Number(fpsInput.value);
  fpsValue.textContent = String(fps);
});

clearFrameBtn.addEventListener("click", () => {
  frames[currentFrame].fill(0);
  drawEditor();
  buildFrameButtons();
});

clearAllBtn.addEventListener("click", () => {
  frames.forEach((frame) => frame.fill(0));
  previewFrame = 0;
  drawEditor();
  buildFrameButtons();
});

randomizeBtn.addEventListener("click", () => {
  frames.forEach((frame, i) => {
    frame.fill(0);
    const centerX = 7 + Math.sin(i * 0.9) * 3;
    const centerY = 7 + Math.cos(i * 0.7) * 3;

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius < 3.5) {
          const color = (i + x + y) % (PALETTE.length - 1) + 1;
          frame[cellIndex(x, y)] = color;
        }
      }
    }
  });

  drawEditor();
  buildFrameButtons();
});

exportBtn.addEventListener("click", () => {
  const scale = 8;
  const sheet = document.createElement("canvas");
  sheet.width = GRID * FRAME_COUNT * scale;
  sheet.height = GRID * scale;
  const ctx = sheet.getContext("2d");

  ctx.clearRect(0, 0, sheet.width, sheet.height);

  frames.forEach((frame, frameIdx) => {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const colorIndex = frame[cellIndex(x, y)];
        if (!colorIndex) continue;
        ctx.fillStyle = PALETTE[colorIndex].color;
        ctx.fillRect((frameIdx * GRID + x) * scale, y * scale, scale, scale);
      }
    }
  });

  const link = document.createElement("a");
  link.href = sheet.toDataURL("image/png");
  link.download = "sprite-flipbook-sheet.png";
  link.click();
});

function loop(now) {
  const frameDuration = 1000 / fps;
  if (isPlaying && now - lastTick >= frameDuration) {
    previewFrame = (previewFrame + 1) % FRAME_COUNT;
    lastTick = now;
  }

  drawPreview();
  requestAnimationFrame(loop);
}

function boot() {
  fpsValue.textContent = String(fps);
  activeFrameLabel.textContent = `Frame ${currentFrame + 1} / ${FRAME_COUNT}`;
  buildPalette();
  buildFrameButtons();
  refreshToolButtons();
  drawEditor();
  requestAnimationFrame(loop);
}

boot();
