const BEST_KEY = 'retro_coin_pusher_panic_96_best';
const LANES = 7;
const ROWS = 13;
const ROUND_TIME = 90;
const START_CREDITS = 42;
const PUSH_INTERVAL = 1.25;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const bankedEl = document.getElementById('banked');
const prizesEl = document.getElementById('prizes');
const creditsEl = document.getElementById('credits');
const multiplierEl = document.getElementById('multiplier');
const pushEl = document.getElementById('push');
const timeEl = document.getElementById('time');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const dropBtn = document.getElementById('dropBtn');

let audioCtx = null;
let muted = false;

const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0),
  banked: 0,
  prizes: 0,
  credits: START_CREDITS,
  timeLeft: ROUND_TIME,
  selectedLane: Math.floor(LANES / 2),
  streak: 0,
  multiplier: 1,
  lastPushPayout: 0,
  dropCooldown: 0,
  pushTimer: PUSH_INTERVAL,
  bonusCreditMilestone: 12,
  prizeSpawnTimer: 9,
  msgTimer: 0,
  lastTime: 0,
  grid: [],
  sparkles: []
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCoin() {
  return { kind: 'coin', hue: randInt(42, 52), wobble: Math.random() * Math.PI * 2 };
}

function createPrize() {
  return { kind: 'prize', hue: randInt(285, 325), wobble: Math.random() * Math.PI * 2 };
}

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array.from({ length: LANES }, () => null));
}

function setStatus(text, seconds = 1.5) {
  statusEl.textContent = text;
  state.msgTimer = seconds;
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function beep(freq = 440, dur = 0.06, type = 'square', gainValue = 0.028, start = 0) {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function updateHud() {
  scoreEl.textContent = String(Math.floor(state.score)).padStart(6, '0');
  bestEl.textContent = String(Math.floor(state.best)).padStart(6, '0');
  bankedEl.textContent = String(state.banked);
  prizesEl.textContent = String(state.prizes);
  creditsEl.textContent = String(state.credits);
  multiplierEl.textContent = `x${state.multiplier.toFixed(1)}`;
  pushEl.textContent = `${Math.max(0, state.pushTimer).toFixed(2)}s`;
  timeEl.textContent = `${Math.max(0, state.timeLeft).toFixed(1)}s`;
}

function seedBoard() {
  state.grid = createEmptyGrid();
  for (let row = 4; row < ROWS - 1; row += 1) {
    for (let lane = 0; lane < LANES; lane += 1) {
      const roll = Math.random();
      if (roll < 0.35) {
        state.grid[row][lane] = createCoin();
      } else if (roll < 0.39) {
        state.grid[row][lane] = createPrize();
      }
    }
  }
}

function pushTokenForward(row, lane, token) {
  if (row >= ROWS) {
    payoutToken(token, 'drop');
    return;
  }
  const displaced = state.grid[row][lane];
  state.grid[row][lane] = token;
  if (displaced) {
    pushTokenForward(row + 1, lane, displaced);
  }
}

function addSparkle(lane, amount = 1, color = '#ffd277') {
  for (let i = 0; i < amount; i += 1) {
    state.sparkles.push({
      lane,
      y: ROWS - 0.2,
      vx: rand(-0.55, 0.55),
      vy: rand(-1.9, -1.1),
      life: rand(0.45, 0.9),
      color
    });
  }
}

function payoutToken(token, source = 'push') {
  if (token.kind === 'coin') {
    const gain = Math.round((source === 'push' ? 12 : 8) * state.multiplier);
    state.score += gain;
    state.banked += 1;
    state.lastPushPayout += gain;
    addSparkle(randInt(0, LANES - 1), 2, '#ffd277');
    beep(640, 0.035, 'triangle', 0.018);

    if (state.banked % state.bonusCreditMilestone === 0) {
      state.credits += 1;
      setStatus('Bonus credit earned for solid payout flow!', 1.2);
      beep(880, 0.06, 'square', 0.02);
      beep(990, 0.05, 'triangle', 0.018, 0.05);
    }
  } else {
    const gain = Math.round((180 + state.streak * 28) * state.multiplier);
    state.score += gain;
    state.prizes += 1;
    state.lastPushPayout += gain;
    state.credits += 2;
    addSparkle(randInt(0, LANES - 1), 5, '#ff8be6');
    setStatus(`JACKPOT CHIP! +${gain} and +2 credits`, 1.3);
    beep(520, 0.08, 'sawtooth', 0.02);
    beep(720, 0.1, 'triangle', 0.02, 0.08);
    beep(960, 0.12, 'square', 0.018, 0.17);
  }

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }
}

function advancePushCycle() {
  state.lastPushPayout = 0;
  const nextGrid = createEmptyGrid();

  for (let row = ROWS - 1; row >= 0; row -= 1) {
    for (let lane = 0; lane < LANES; lane += 1) {
      const token = state.grid[row][lane];
      if (!token) continue;

      const targetRow = row + 1;
      const drift = Math.random() < 0.28 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      const options = [lane + drift, lane, lane - drift].filter(
        (value, index, arr) => value >= 0 && value < LANES && arr.indexOf(value) === index
      );

      let placed = false;
      for (const targetLane of options) {
        if (targetRow >= ROWS) {
          payoutToken(token, 'push');
          placed = true;
          break;
        }
        if (!nextGrid[targetRow][targetLane]) {
          nextGrid[targetRow][targetLane] = token;
          placed = true;
          break;
        }
      }

      if (!placed) {
        if (!nextGrid[row][lane]) {
          nextGrid[row][lane] = token;
          placed = true;
        } else {
          for (const side of [lane - 1, lane + 1]) {
            if (side >= 0 && side < LANES && !nextGrid[row][side]) {
              nextGrid[row][side] = token;
              placed = true;
              break;
            }
          }
        }
      }

      if (!placed) {
        nextGrid[row][lane] = token;
      }
    }
  }

  state.grid = nextGrid;
  beep(130, 0.09, 'sawtooth', 0.03);

  if (state.lastPushPayout > 0) {
    state.streak = clamp(state.streak + 1, 0, 9);
    state.multiplier = 1 + state.streak * 0.15;
    if (state.lastPushPayout >= 100) {
      setStatus(`Hot streak payout +${state.lastPushPayout} (x${state.multiplier.toFixed(1)})`, 1.1);
    }
  } else {
    state.streak = clamp(state.streak - 1, 0, 9);
    state.multiplier = 1 + state.streak * 0.15;
  }
}

function dropCoin() {
  if (!state.running || state.paused || state.dropCooldown > 0) return;
  if (state.credits <= 0) {
    setStatus('Out of credits. Wait for payout or round end.', 1);
    beep(170, 0.08, 'sawtooth', 0.024);
    return;
  }

  state.credits -= 1;
  pushTokenForward(0, state.selectedLane, createCoin());
  state.dropCooldown = 0.11;
  beep(610, 0.05, 'triangle', 0.02);
  beep(480, 0.04, 'square', 0.012, 0.04);
}

function spawnPrizeChip() {
  const lane = randInt(0, LANES - 1);
  pushTokenForward(0, lane, createPrize());
  setStatus('Prize chip loaded into the machine!', 1);
  beep(760, 0.07, 'triangle', 0.017);
}

function startRound() {
  state.running = true;
  state.paused = false;
  state.score = 0;
  state.banked = 0;
  state.prizes = 0;
  state.credits = START_CREDITS;
  state.timeLeft = ROUND_TIME;
  state.selectedLane = Math.floor(LANES / 2);
  state.streak = 0;
  state.multiplier = 1;
  state.lastPushPayout = 0;
  state.dropCooldown = 0;
  state.pushTimer = PUSH_INTERVAL;
  state.prizeSpawnTimer = rand(7.5, 10.5);
  state.msgTimer = 0;
  state.sparkles.length = 0;
  state.lastTime = performance.now();
  seedBoard();

  setStatus('Round live! Feed the lanes and ride the push rhythm.', 1.4);
  updateHud();
}

function finishRound() {
  state.running = false;
  state.paused = false;

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(BEST_KEY, String(Math.floor(state.best)));
  }

  const headline = state.prizes > 0
    ? `Round over. ${state.prizes} jackpot chip${state.prizes === 1 ? '' : 's'} banked!`
    : 'Round over. No jackpot chip this time.';

  setStatus(`${headline} Final score ${Math.floor(state.score)}.`, 2.4);
  beep(250, 0.1, 'triangle', 0.02);
  beep(180, 0.12, 'sawtooth', 0.018, 0.1);
  updateHud();
}

function update(dt) {
  if (!state.running || state.paused) return;

  state.timeLeft -= dt;
  state.pushTimer -= dt;
  state.prizeSpawnTimer -= dt;
  state.dropCooldown = Math.max(0, state.dropCooldown - dt);

  if (state.pushTimer <= 0) {
    advancePushCycle();
    state.pushTimer += PUSH_INTERVAL;
  }

  if (state.prizeSpawnTimer <= 0) {
    spawnPrizeChip();
    state.prizeSpawnTimer = rand(8.5, 12.5);
  }

  if (state.credits <= 0 && state.lastPushPayout <= 0) {
    state.timeLeft = Math.min(state.timeLeft, 4.5);
  }

  if (state.timeLeft <= 0) {
    finishRound();
  }

  for (let i = state.sparkles.length - 1; i >= 0; i -= 1) {
    const spark = state.sparkles[i];
    spark.life -= dt;
    spark.y += spark.vy * dt * 10;
    spark.vx *= 0.99;
    spark.vy += 0.05;
    if (spark.life <= 0) {
      state.sparkles.splice(i, 1);
    }
  }

  if (state.msgTimer > 0) {
    state.msgTimer -= dt;
    if (state.msgTimer <= 0 && state.running) {
      setStatus('Keep feeding lanes and watch the payout edge.', 2.2);
      state.msgTimer = 999;
    }
  }

  updateHud();
}

function drawToken(x, y, radius, token, t) {
  const bob = Math.sin(t * 2.2 + token.wobble) * 1.2;
  const yy = y + bob;

  if (token.kind === 'coin') {
    const grad = ctx.createRadialGradient(x - 2, yy - 2, 2, x, yy, radius + 2);
    grad.addColorStop(0, '#fff4b8');
    grad.addColorStop(1, `hsl(${token.hue} 86% 50%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, yy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 232, 149, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(x, yy);
    ctx.rotate(t * 0.8 + token.wobble);
    ctx.fillStyle = `hsl(${token.hue} 90% 64%)`;
    ctx.strokeStyle = '#ffd4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function render(nowMs) {
  const t = nowMs * 0.001;
  const width = canvas.width;
  const height = canvas.height;

  const boardX = 86;
  const boardY = 70;
  const boardW = width - 172;
  const boardH = 372;
  const laneW = boardW / LANES;
  const rowH = boardH / ROWS;

  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#081737');
  bg.addColorStop(1, '#04080f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(89, 184, 255, 0.08)';
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 137 + nowMs * 0.03) % (width + 30) - 15;
    const y = (i * 71) % height;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = 'rgba(12, 21, 46, 0.95)';
  ctx.strokeStyle = 'rgba(127, 170, 255, 0.62)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(boardX, boardY, boardW, boardH, 18);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(124, 200, 255, 0.16)';
  ctx.lineWidth = 1;
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = boardX + lane * laneW;
    ctx.beginPath();
    ctx.moveTo(x, boardY + 8);
    ctx.lineTo(x, boardY + boardH - 8);
    ctx.stroke();
  }

  for (let row = 1; row < ROWS; row += 1) {
    const y = boardY + row * rowH;
    ctx.beginPath();
    ctx.moveTo(boardX + 8, y);
    ctx.lineTo(boardX + boardW - 8, y);
    ctx.stroke();
  }

  const pulse = state.running ? 1 - Math.abs((state.pushTimer / PUSH_INTERVAL) * 2 - 1) : 0;
  const pusherY = boardY + 8 + pulse * 12;
  ctx.fillStyle = 'rgba(255, 121, 221, 0.7)';
  ctx.fillRect(boardX + 6, pusherY, boardW - 12, 12);
  ctx.fillStyle = 'rgba(255, 187, 241, 0.9)';
  ctx.fillRect(boardX + 14, pusherY + 2, boardW - 28, 3);

  const laneX = boardX + state.selectedLane * laneW;
  ctx.fillStyle = 'rgba(124, 242, 255, 0.18)';
  ctx.fillRect(laneX + 2, boardY + 6, laneW - 4, boardH - 12);

  for (let row = 0; row < ROWS; row += 1) {
    for (let lane = 0; lane < LANES; lane += 1) {
      const token = state.grid[row]?.[lane];
      if (!token) continue;
      const x = boardX + lane * laneW + laneW / 2;
      const y = boardY + row * rowH + rowH / 2;
      drawToken(x, y, Math.min(16, rowH * 0.33), token, t);
    }
  }

  for (const spark of state.sparkles) {
    const x = boardX + (spark.lane + 0.5) * laneW + spark.vx * 14;
    const y = boardY + spark.y * rowH;
    ctx.globalAlpha = Math.max(0, spark.life);
    ctx.fillStyle = spark.color;
    ctx.fillRect(x, y, 4, 4);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(17, 29, 63, 0.96)';
  ctx.fillRect(boardX, boardY + boardH + 8, boardW, 52);
  ctx.strokeStyle = 'rgba(129, 173, 255, 0.45)';
  ctx.strokeRect(boardX, boardY + boardH + 8, boardW, 52);
  ctx.fillStyle = '#8de8ff';
  ctx.font = '700 18px Trebuchet MS';
  ctx.fillText('PAYOUT TRAY', boardX + 16, boardY + boardH + 39);

  ctx.fillStyle = '#a5bbec';
  ctx.font = '600 14px Trebuchet MS';
  ctx.fillText('Drop lane', laneX + 12, boardY - 12);

  ctx.fillStyle = '#f4d58f';
  ctx.font = '700 15px Trebuchet MS';
  ctx.fillText(`Credits: ${state.credits}`, width - 172, boardY + boardH + 39);
}

function frame(now) {
  if (!state.lastTime) state.lastTime = now;
  const dt = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;

  update(dt);
  render(now);
  requestAnimationFrame(frame);
}

function nudgeLane(direction) {
  if (!state.running || state.paused) return;
  const next = clamp(state.selectedLane + direction, 0, LANES - 1);
  if (next !== state.selectedLane) {
    state.selectedLane = next;
    beep(380 + next * 40, 0.045, 'triangle', 0.018);
  }
}

document.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
    event.preventDefault();
    nudgeLane(-1);
  } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
    event.preventDefault();
    nudgeLane(1);
  } else if (event.code === 'Space' || event.code === 'Enter') {
    event.preventDefault();
    dropCoin();
  } else if (event.code === 'KeyP') {
    event.preventDefault();
    if (state.running) {
      state.paused = !state.paused;
      setStatus(state.paused ? 'Paused.' : 'Back in play.', 0.8);
    }
  }
});

leftBtn.addEventListener('click', () => {
  initAudio();
  nudgeLane(-1);
});
rightBtn.addEventListener('click', () => {
  initAudio();
  nudgeLane(1);
});
dropBtn.addEventListener('click', () => {
  initAudio();
  dropCoin();
});

startBtn.addEventListener('click', () => {
  initAudio();
  startRound();
});

pauseBtn.addEventListener('click', () => {
  if (!state.running) return;
  state.paused = !state.paused;
  setStatus(state.paused ? 'Paused.' : 'Back in play.', 0.8);
});

muteBtn.addEventListener('click', () => {
  muted = !muted;
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  setStatus(muted ? 'Audio muted.' : 'Audio unmuted.', 0.8);
});

seedBoard();
updateHud();
requestAnimationFrame(frame);
