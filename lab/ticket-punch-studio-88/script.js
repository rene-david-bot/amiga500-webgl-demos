const canvas = document.getElementById('ticketCanvas');
const ctx = canvas.getContext('2d');

const passengerInput = document.getElementById('passenger');
const routeInput = document.getElementById('route');
const destinationInput = document.getElementById('destination');
const fareInput = document.getElementById('fare');
const themeInput = document.getElementById('theme');

const cols = 26;
const rows = 7;
const punches = Array.from({ length: rows }, () => Array(cols).fill(false));

const grid = {
  x: 258,
  y: 212,
  w: 448,
  h: 150
};

grid.cellW = grid.w / cols;
grid.cellH = grid.h / rows;

const themes = {
  amber: { base: '#f4d59f', dark: '#7e5221', ink: '#1f160d', stamp: '#cc4f1a' },
  mint: { base: '#b6f0e5', dark: '#1f5a53', ink: '#071d20', stamp: '#0e8f7f' },
  magenta: { base: '#f7b4d8', dark: '#6f2859', ink: '#250e21', stamp: '#bc327b' },
  slate: { base: '#d6d7dd', dark: '#454b62', ink: '#12151f', stamp: '#4f5e97' }
};

const serial = () => {
  const p = Math.floor(Math.random() * 900000 + 100000);
  return `TK-${p}`;
};

const state = {
  serial: serial(),
  issued: nowStamp()
};

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function clearPunches() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      punches[y][x] = false;
    }
  }
}

function hashCode(str) {
  let h = 2166136261;
  for (const ch of str) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function autoPunchFromRoute() {
  clearPunches();
  const seed = hashCode(`${routeInput.value}|${destinationInput.value}`);
  let v = seed;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      v ^= v << 13;
      v ^= v >>> 17;
      v ^= v << 5;
      const bit = (v >>> 0) % 13;
      punches[y][x] = bit < 3 || (x + y) % 17 === (seed % 17);
    }
  }
  draw();
}

function luckyTicket() {
  const names = ['R. SCHULTE', 'N. VEGA', 'K. MYERS', 'A. KOVAC', 'S. LI'];
  const routes = ['D-42 NIGHT', 'U7 LOOP', 'S3 EXPRESS', 'TRAM 14B', 'CARGO 9'];
  const dest = ['NEON STATION', 'OLD TOWN HUB', 'DOCK TERMINAL', 'ARCADE DISTRICT', 'EAST YARD'];
  passengerInput.value = names[Math.floor(Math.random() * names.length)];
  routeInput.value = routes[Math.floor(Math.random() * routes.length)];
  destinationInput.value = dest[Math.floor(Math.random() * dest.length)];
  fareInput.value = (Math.random() * 4.5 + 1.2).toFixed(1);
  themeInput.selectedIndex = Math.floor(Math.random() * themeInput.options.length);
  state.serial = serial();
  state.issued = nowStamp();
  autoPunchFromRoute();
}

function draw() {
  const t = themes[themeInput.value] || themes.amber;

  // background vignette
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#201743');
  bg.addColorStop(1, '#0a0820');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ticket body
  roundRect(ctx, 98, 62, 764, 356, 20);
  const fill = ctx.createLinearGradient(98, 62, 862, 418);
  fill.addColorStop(0, t.base);
  fill.addColorStop(1, shade(t.base, -12));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = t.dark;
  ctx.stroke();

  // perforation dots top/bottom
  for (let i = 0; i < 46; i++) {
    const x = 114 + i * 16;
    hole(x, 62, 3.3, '#22162f');
    hole(x, 418, 3.3, '#22162f');
  }

  // header strip
  ctx.fillStyle = t.dark;
  roundRect(ctx, 116, 86, 728, 52, 8);
  ctx.fill();
  ctx.fillStyle = '#f8f5ef';
  ctx.font = '700 30px "Trebuchet MS", sans-serif';
  ctx.fillText('METRO ACCESS PASS', 136, 121);

  // info block
  ctx.fillStyle = t.ink;
  ctx.font = '700 18px "Trebuchet MS", sans-serif';
  ctx.fillText('PASSENGER', 136, 174);
  ctx.fillText('ROUTE', 136, 206);
  ctx.fillText('DESTINATION', 136, 238);
  ctx.fillText('ISSUED', 136, 270);
  ctx.fillText('FARE', 136, 302);
  ctx.fillText('SERIAL', 136, 334);

  ctx.font = '600 20px "Courier New", monospace';
  ctx.fillText((passengerInput.value || '---').toUpperCase(), 300, 174);
  ctx.fillText((routeInput.value || '---').toUpperCase(), 300, 206);
  ctx.fillText((destinationInput.value || '---').toUpperCase(), 300, 238);
  ctx.fillText(state.issued, 300, 270);
  ctx.fillText(`${Number(fareInput.value || 0).toFixed(2)} DM`, 300, 302);
  ctx.fillText(state.serial, 300, 334);

  // punch matrix frame
  ctx.lineWidth = 3;
  ctx.strokeStyle = shade(t.dark, -10);
  roundRect(ctx, grid.x - 18, grid.y - 18, grid.w + 36, grid.h + 36, 10);
  ctx.stroke();
  ctx.fillStyle = shade(t.base, -20);
  ctx.fillRect(grid.x, grid.y, grid.w, grid.h);

  // matrix cells
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cx = grid.x + x * grid.cellW + grid.cellW / 2;
      const cy = grid.y + y * grid.cellH + grid.cellH / 2;
      if (punches[y][x]) {
        hole(cx, cy, Math.min(grid.cellW, grid.cellH) * 0.26, '#2a1a14');
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(grid.cellW, grid.cellH) * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
      }
    }
  }

  // station stamp
  ctx.save();
  ctx.translate(736, 316);
  ctx.rotate(-0.24);
  ctx.lineWidth = 4;
  ctx.strokeStyle = t.stamp;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, -104, -48, 208, 96, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = t.stamp;
  ctx.font = '700 20px "Trebuchet MS", sans-serif';
  ctx.fillText('VALIDATED', -61, -8);
  ctx.font = '600 17px "Courier New", monospace';
  ctx.fillText(routeInput.value.toUpperCase().slice(0, 12), -62, 20);
  ctx.restore();

  // subtle scanlines
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
  ctx.globalAlpha = 1;
}

function roundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function hole(x, y, r, shadow) {
  ctx.beginPath();
  ctx.arc(x + 1.2, y + 1.2, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = shadow;
  ctx.fill();
}

function shade(hex, amt) {
  const n = hex.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(n.slice(0, 2), 16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(n.slice(2, 4), 16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(n.slice(4, 6), 16) + amt));
  return `rgb(${r}, ${g}, ${b})`;
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * sx;
  const y = (event.clientY - rect.top) * sy;

  if (x < grid.x || x > grid.x + grid.w || y < grid.y || y > grid.y + grid.h) return;
  const col = Math.floor((x - grid.x) / grid.cellW);
  const row = Math.floor((y - grid.y) / grid.cellH);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return;

  punches[row][col] = !punches[row][col];
  draw();
});

for (const el of [passengerInput, routeInput, destinationInput, fareInput, themeInput]) {
  el.addEventListener('input', draw);
}

document.getElementById('autoPunch').addEventListener('click', autoPunchFromRoute);
document.getElementById('clear').addEventListener('click', () => {
  clearPunches();
  draw();
});
document.getElementById('randomize').addEventListener('click', luckyTicket);
document.getElementById('download').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `ticket-punch-${state.serial.toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

clearPunches();
autoPunchFromRoute();
