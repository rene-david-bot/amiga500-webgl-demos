const canvas = document.getElementById("poster");
const ctx = canvas.getContext("2d");

const ui = {
  headline: document.getElementById("headline"),
  deck: document.getElementById("deck"),
  palette: document.getElementById("palette"),
  layout: document.getElementById("layout"),
  noise: document.getElementById("noise"),
  skew: document.getElementById("skew"),
  folds: document.getElementById("folds"),
  randomize: document.getElementById("randomize"),
  exportBtn: document.getElementById("exportBtn"),
  status: document.getElementById("status")
};

const PALETTES = {
  black: { ink: "#171717", soft: "#4d4d4d", accent: "#111" },
  cyan: { ink: "#07353f", soft: "#2d7f8f", accent: "#041f26" },
  magenta: { ink: "#461127", soft: "#9d3b65", accent: "#2b0917" }
};

const WORD_BANK = {
  headlines: [
    "MIDNIGHT BYTE SCENE",
    "SIDEWALK SIGNAL CLUB",
    "NEON COPY PANIC",
    "ROOFTOP TAPE RIOT",
    "AFTERHOURS DATA WAVE"
  ],
  decks: [
    "Issue #07 · Tape swaps, hacks, and rooftop gigs",
    "Special edition · Pirate radio maps and club flyers",
    "Late shift files · Public terminals, pager leaks, and code poetry",
    "Weekend print run · DIY circuits, zine routes, and alley interviews"
  ],
  blurbs: [
    "Parking-lot synth duo patches a dead boombox into a playable bass rig.",
    "Courier crews hide route hints in flyer halftones to dodge scanner checks.",
    "Night market coders trade tiny game builds on hand-labeled floppy disks.",
    "A rooftop projector battle ends with six blocks of synchronized loops.",
    "Two copy shops, one toner crate, and a citywide rumor board meltdown.",
    "Street photographers rank CRT glow quality by bus stop and weather code.",
    "Local hotline posts a challenge: build art using only office leftovers."
  ],
  stamps: ["HOTLINE", "LIVE SET", "PATCH NOTES", "MIDNIGHT", "NOISE DROP", "ISSUE"]
};

let seed = Date.now();

function rngFactory(initial) {
  let t = initial >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawPaperBase(rand) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#f3efe4");
  grad.addColorStop(1, "#e9e2d2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 130; i += 1) {
    ctx.fillStyle = `rgba(70, 56, 34, ${0.02 + rand() * 0.04})`;
    const w = 80 + rand() * 260;
    const h = 1 + rand() * 3;
    ctx.fillRect(rand() * canvas.width, rand() * canvas.height, w, h);
  }
}

function drawColumns(rand, theme) {
  const bodyX = 110;
  const bodyY = 370;
  const bodyW = canvas.width - 220;

  ctx.fillStyle = theme.ink;
  ctx.font = "600 22px 'Courier New', monospace";

  const layout = ui.layout.value;
  const lines = Array.from({ length: 16 }, () => pick(rand, WORD_BANK.blurbs));

  if (layout === "columns") {
    const colW = 200;
    for (let col = 0; col < 3; col += 1) {
      let y = bodyY;
      for (let i = 0; i < 5; i += 1) {
        const wrapped = wrapText(lines[col * 5 + i] || "", 20);
        for (const line of wrapped) {
          ctx.fillText(line, bodyX + col * (colW + 38), y);
          y += 28;
        }
        y += 14;
      }
    }
  } else if (layout === "flyer") {
    for (let i = 0; i < 6; i += 1) {
      const y = bodyY + i * 115;
      ctx.strokeStyle = theme.soft;
      ctx.lineWidth = 3;
      ctx.strokeRect(bodyX, y - 30, bodyW, 88);
      const wrapped = wrapText(lines[i], 56);
      ctx.fillText(wrapped[0] || "", bodyX + 16, y + 8);
      if (wrapped[1]) ctx.fillText(wrapped[1], bodyX + 16, y + 36);
    }
  } else {
    ctx.strokeStyle = theme.soft;
    ctx.lineWidth = 4;
    ctx.strokeRect(bodyX, bodyY - 42, bodyW, 510);

    ctx.font = "700 40px 'Courier New', monospace";
    ctx.fillText("FEATURE DROP", bodyX + 26, bodyY + 24);
    ctx.font = "600 22px 'Courier New', monospace";

    let y = bodyY + 84;
    for (let i = 0; i < 8; i += 1) {
      const wrapped = wrapText(lines[i], 52);
      for (const line of wrapped) {
        ctx.fillText(line, bodyX + 24, y);
        y += 32;
      }
      y += 9;
    }
  }
}

function drawStamps(rand, theme) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 22px 'Courier New', monospace";

  for (let i = 0; i < 3; i += 1) {
    const label = pick(rand, WORD_BANK.stamps);
    const x = 160 + rand() * (canvas.width - 320);
    const y = 220 + rand() * (canvas.height - 300);
    const w = 220 + rand() * 80;
    const h = 50;
    const angle = (-11 + rand() * 22) * (Math.PI / 180);

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = theme.soft;
    ctx.lineWidth = 4;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = theme.soft;
    ctx.fillText(label, 0, 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  ctx.restore();
}

function drawNoise(rand, amount) {
  const dots = 900 + amount * 55;
  for (let i = 0; i < dots; i += 1) {
    const alpha = rand() * (0.08 + amount * 0.0028);
    ctx.fillStyle = `rgba(12, 12, 12, ${alpha.toFixed(3)})`;
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const size = rand() < 0.92 ? 1 : 2;
    ctx.fillRect(x, y, size, size);
  }
}

function drawFolds(theme) {
  ctx.strokeStyle = theme.soft;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.globalAlpha = 0.28;

  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 40);
  ctx.lineTo(canvas.width / 2, canvas.height - 40);
  ctx.moveTo(40, canvas.height * 0.66);
  ctx.lineTo(canvas.width - 40, canvas.height * 0.66);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(30, 30, 30, 0.18)";
  ctx.fillRect(78, 72, 16, 7);
  ctx.fillRect(78, 87, 16, 7);
}

function render() {
  const rand = rngFactory(seed);
  const theme = PALETTES[ui.palette.value];
  const skew = Number(ui.skew.value) * (Math.PI / 180);
  const noise = Number(ui.noise.value);

  drawPaperBase(rand);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(skew);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillRect(70, 70, canvas.width - 140, canvas.height - 140);

  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(84, 84, canvas.width - 168, canvas.height - 168);

  ctx.fillStyle = theme.ink;
  ctx.font = "900 78px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(ui.headline.value.toUpperCase(), 112, 126);

  ctx.font = "600 27px 'Courier New', monospace";
  ctx.fillStyle = theme.soft;
  ctx.fillText(ui.deck.value, 116, 230);

  ctx.fillStyle = theme.accent;
  ctx.fillRect(108, 286, canvas.width - 216, 7);

  drawColumns(rand, theme);
  drawStamps(rand, theme);

  ctx.restore();

  if (ui.folds.checked) drawFolds(theme);
  drawNoise(rand, noise);

  ctx.globalAlpha = 0.08;
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.globalAlpha = 1;
}

function randomizeIssue() {
  const rand = rngFactory(Date.now());
  seed = Math.floor(rand() * 1e9);

  ui.headline.value = pick(rand, WORD_BANK.headlines);
  ui.deck.value = pick(rand, WORD_BANK.decks);
  ui.layout.value = pick(rand, ["columns", "flyer", "spotlight"]);
  ui.palette.value = pick(rand, ["black", "cyan", "magenta"]);
  ui.noise.value = String(25 + Math.floor(rand() * 65));
  ui.skew.value = (rand() * 10 - 5).toFixed(1);

  ui.status.textContent = "Fresh issue generated. Print it before the toner dies.";
  render();
}

function exportImage() {
  const link = document.createElement("a");
  link.download = `photocopier-zine-lab-93-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  ui.status.textContent = "PNG printed to your downloads tray.";
}

[
  ui.headline,
  ui.deck,
  ui.palette,
  ui.layout,
  ui.noise,
  ui.skew,
  ui.folds
].forEach((el) => el.addEventListener("input", () => {
  seed += 1;
  render();
}));

ui.randomize.addEventListener("click", randomizeIssue);
ui.exportBtn.addEventListener("click", exportImage);

render();
