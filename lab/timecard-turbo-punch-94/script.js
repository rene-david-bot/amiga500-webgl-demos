const TOTAL_ROUNDS = 10;
const BEST_KEY = 'retro_timecard_turbo_punch_best';

const roundEl = document.getElementById('round');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const driftEl = document.getElementById('drift');
const bestEl = document.getElementById('best');
const targetTimeEl = document.getElementById('targetTime');
const targetWindowEl = document.getElementById('targetWindow');
const currentTimeEl = document.getElementById('currentTime');
const hourNeedleEl = document.getElementById('hourNeedle');
const minuteNeedleEl = document.getElementById('minuteNeedle');
const punchBtn = document.getElementById('punchBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const messageEl = document.getElementById('message');

let audioCtx = null;
let best = Number(localStorage.getItem(BEST_KEY) || 0);

let round = 1;
let score = 0;
let combo = 0;
let locked = false;
let finished = false;
let lastDrift = null;

let targetHour = 7;
let targetMinute = 30;
let tolerance = 3;

let hourPos = 0;
let minutePos = 0;
let hourSpeed = 0.25;
let minuteSpeed = 3.8;

let lastFrame = performance.now();

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq = 440, start = 0, dur = 0.11, type = 'square', gainValue = 0.04) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur);
}

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function setMessage(text) {
  messageEl.textContent = text;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function minuteDiff(a, b) {
  const raw = Math.abs(a - b);
  return Math.min(raw, 720 - raw);
}

function getCurrentHour() {
  return (Math.floor(hourPos) % 12) + 1;
}

function getCurrentMinute() {
  return Math.floor(minutePos) % 60;
}

function getCurrentTotalMinutes() {
  const h = getCurrentHour();
  const m = getCurrentMinute();
  return (h % 12) * 60 + m;
}

function getTargetTotalMinutes() {
  return (targetHour % 12) * 60 + targetMinute;
}

function renderHud() {
  roundEl.textContent = `${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;
  scoreEl.textContent = String(score).padStart(4, '0');
  comboEl.textContent = `${combo}x`;
  driftEl.textContent = lastDrift === null ? '--' : `${lastDrift} min`;
  bestEl.textContent = String(best).padStart(4, '0');
  targetTimeEl.textContent = formatTime(targetHour, targetMinute);
  targetWindowEl.textContent = `±${tolerance} min`;
}

function renderReels() {
  hourNeedleEl.style.left = `${(hourPos / 12) * 100}%`;
  minuteNeedleEl.style.left = `${(minutePos / 60) * 100}%`;
  currentTimeEl.textContent = formatTime(getCurrentHour(), getCurrentMinute());
}

function setupRound() {
  locked = false;
  nextBtn.disabled = true;
  punchBtn.disabled = false;

  targetHour = randomInt(1, 12);
  targetMinute = randomInt(0, 59);
  tolerance = randomInt(2, 5);

  hourPos = randomRange(0, 12);
  minutePos = randomRange(0, 60);
  hourSpeed = randomRange(0.16, 0.38);
  minuteSpeed = randomRange(3.1, 6.6);

  renderHud();
  renderReels();
  setMessage('Reels are drifting. Slam Punch Clock inside the target window.');
}

function handlePunch() {
  if (locked || finished) return;
  initAudio();
  locked = true;
  punchBtn.disabled = true;

  const diff = minuteDiff(getCurrentTotalMinutes(), getTargetTotalMinutes());
  lastDrift = diff;

  let gain = 20;

  if (diff <= 1) {
    gain = 140 + combo * 8;
    combo += 1;
    tone(659, 0, 0.08, 'triangle');
    tone(880, 0.09, 0.11, 'square');
    setMessage(`Perfect punch! Drift ${diff} minute. Payroll loves you. +${gain}`);
  } else if (diff <= tolerance) {
    gain = 95 + combo * 6;
    combo += 1;
    tone(523, 0, 0.08, 'triangle');
    tone(659, 0.09, 0.1, 'triangle');
    setMessage(`Clean punch. Drift ${diff} minutes inside window. +${gain}`);
  } else if (diff <= tolerance + 4) {
    gain = 58;
    combo = 0;
    tone(392, 0, 0.11, 'sine');
    setMessage(`Close call. Drift ${diff} minutes, barely salvageable. +${gain}`);
  } else {
    gain = 18;
    combo = 0;
    tone(196, 0, 0.16, 'sawtooth', 0.03);
    setMessage(`Late stamp. Drift ${diff} minutes. Supervisor is glaring. +${gain}`);
  }

  score += gain;
  renderHud();

  if (round >= TOTAL_ROUNDS) {
    finishShift();
  } else {
    nextBtn.disabled = false;
  }
}

function finishShift() {
  finished = true;
  nextBtn.disabled = true;
  punchBtn.disabled = true;

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  let rank = 'Punch Rookie';
  if (score >= 1100) rank = 'Payroll Legend';
  else if (score >= 900) rank = 'Shift Closer';
  else if (score >= 700) rank = 'Clock Ace';

  renderHud();
  setMessage(`Shift complete: ${score} points. Rank: ${rank}. Run a fresh shift to chase a new high score.`);
}

function nextRound() {
  if (finished || !locked) return;
  round += 1;
  setupRound();
}

function resetShift() {
  round = 1;
  score = 0;
  combo = 0;
  locked = false;
  finished = false;
  lastDrift = null;
  setupRound();
}

function animate(now) {
  const delta = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (!locked && !finished) {
    hourPos = (hourPos + hourSpeed * delta) % 12;
    minutePos = (minutePos + minuteSpeed * delta) % 60;
    renderReels();
  }

  requestAnimationFrame(animate);
}

punchBtn.addEventListener('click', handlePunch);
nextBtn.addEventListener('click', nextRound);
resetBtn.addEventListener('click', resetShift);

renderHud();
setupRound();
requestAnimationFrame((ts) => {
  lastFrame = ts;
  animate(ts);
});
