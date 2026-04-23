const TOTAL_ROUNDS = 8;

const RECORDS = [
  { name: 'Neon Comet', genre: 'Synth Pop', dance: 88, soul: 46, weird: 38, wave: 'triangle', notes: [523, 659, 784, 659] },
  { name: 'Midnight Pager', genre: 'Electro Funk', dance: 74, soul: 63, weird: 49, wave: 'square', notes: [392, 440, 523, 440] },
  { name: 'Chrome Slow Jam', genre: 'Blue-Eyed Soul', dance: 42, soul: 86, weird: 22, wave: 'sine', notes: [330, 349, 392, 349] },
  { name: 'Back Alley Bongo', genre: 'Latin Breaks', dance: 65, soul: 58, weird: 62, wave: 'sawtooth', notes: [294, 349, 392, 466] },
  { name: 'Laser Romance', genre: 'Dreamwave', dance: 51, soul: 78, weird: 34, wave: 'triangle', notes: [349, 440, 523, 440] },
  { name: 'Static Hotline', genre: 'New Beat', dance: 81, soul: 40, weird: 71, wave: 'square', notes: [587, 523, 466, 415] },
  { name: 'Vinyl Thunder', genre: 'Garage Rock', dance: 59, soul: 52, weird: 68, wave: 'sawtooth', notes: [220, 277, 330, 392] },
  { name: 'Moonlight Shuffle', genre: 'Disco Noir', dance: 77, soul: 71, weird: 30, wave: 'triangle', notes: [440, 523, 587, 523] },
  { name: 'Tape Echo Tears', genre: 'Lo-Fi Ballad', dance: 35, soul: 80, weird: 50, wave: 'sine', notes: [262, 330, 392, 330] },
  { name: 'Parking Lot Prophet', genre: 'Indie Pulse', dance: 56, soul: 49, weird: 84, wave: 'square', notes: [311, 370, 466, 554] },
  { name: 'Skater Frequency', genre: 'Breakbeat', dance: 91, soul: 36, weird: 65, wave: 'sawtooth', notes: [659, 587, 523, 494] },
  { name: 'Sunrise Milkshake', genre: 'Retro R&B', dance: 48, soul: 88, weird: 28, wave: 'triangle', notes: [349, 392, 440, 392] },
];

const REQUESTS = [
  { title: 'Skaters took over booth 3', desc: 'They want speed, sparkle, and a little chaos.', dance: 84, soul: 42, weird: 60 },
  { title: 'Breakup table near the neon clock', desc: 'Keep it heartfelt, but avoid killing the vibe.', dance: 52, soul: 80, weird: 30 },
  { title: 'Arcade tournament winner lap', desc: 'The room needs hard momentum and weird flavor.', dance: 78, soul: 45, weird: 73 },
  { title: 'After-hours kitchen crew', desc: 'They want groove first and steady warmth second.', dance: 67, soul: 66, weird: 42 },
  { title: 'Poetry open-mic spillover', desc: 'Blend emotion with an offbeat edge.', dance: 48, soul: 75, weird: 65 },
  { title: 'Birthday booth in glitter jackets', desc: 'Big hooks, smile energy, no sleepy picks.', dance: 86, soul: 58, weird: 36 },
  { title: 'Roller team cooldown stop', desc: 'Keep feet moving, but not full chaos.', dance: 73, soul: 54, weird: 48 },
  { title: 'Last-call romantics', desc: 'Soulful and dreamy wins this one.', dance: 40, soul: 89, weird: 27 },
];

const roundEl = document.getElementById('round');
const crowdEl = document.getElementById('crowd');
const streakEl = document.getElementById('streak');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const requestTitleEl = document.getElementById('requestTitle');
const requestDescEl = document.getElementById('requestDesc');
const meterFillEl = document.getElementById('meterFill');
const choicesEl = document.getElementById('choices');
const messageEl = document.getElementById('message');
const nextBtn = document.getElementById('nextBtn');
const newSetBtn = document.getElementById('newSetBtn');

const BEST_KEY = 'retro_jukebox_bside_best';

let best = Number(localStorage.getItem(BEST_KEY) || 0);
let round = 1;
let score = 0;
let streak = 0;
let crowd = 50;
let chosen = false;
let currentRequest = null;
let currentChoices = [];

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq = 440, start = 0, dur = 0.12, wave = 'square', gain = 0.04) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur);
}

function playRecord(record) {
  initAudio();
  record.notes.forEach((note, idx) => {
    tone(note, idx * 0.13, 0.12, record.wave, 0.035);
  });
}

function sample(list, count) {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, count);
}

function scorePick(record, req) {
  const danceGap = Math.abs(record.dance - req.dance);
  const soulGap = Math.abs(record.soul - req.soul);
  const weirdGap = Math.abs(record.weird - req.weird);
  return Math.max(0, 100 - Math.round(danceGap * 0.45 + soulGap * 0.35 + weirdGap * 0.3));
}

function setMessage(text) {
  messageEl.textContent = text;
}

function renderHud() {
  roundEl.textContent = `${Math.min(round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}`;
  crowdEl.textContent = `${crowd}%`;
  streakEl.textContent = `${streak}x`;
  scoreEl.textContent = String(score).padStart(3, '0');
  bestEl.textContent = String(best).padStart(3, '0');
  meterFillEl.style.width = `${crowd}%`;
}

function renderRound() {
  chosen = false;
  nextBtn.disabled = true;

  currentRequest = REQUESTS[(round - 1) % REQUESTS.length];
  currentChoices = sample(RECORDS, 3);

  requestTitleEl.textContent = currentRequest.title;
  requestDescEl.textContent = currentRequest.desc;

  choicesEl.innerHTML = '';
  currentChoices.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'record';

    card.innerHTML = `
      <h3>${record.name}</h3>
      <div class="genre">${record.genre}</div>
      <div class="stats">
        ${barRow('Dance', record.dance)}
        ${barRow('Soul', record.soul)}
        ${barRow('Weird', record.weird)}
      </div>
      <div class="record-actions">
        <button class="preview-btn" type="button">Preview riff</button>
        <button class="choice-btn" type="button">Drop this B-side</button>
      </div>
    `;

    const [previewBtn, choiceBtn] = card.querySelectorAll('button');
    previewBtn.addEventListener('click', () => {
      playRecord(record);
      setMessage(`${record.name} preview spinning on booth speakers...`);
    });

    choiceBtn.addEventListener('click', () => chooseRecord(record, card));
    choicesEl.appendChild(card);
  });

  renderHud();
}

function barRow(label, value) {
  return `<div class="stat-row"><span>${label}</span><div class="stat-bar"><div class="stat-fill" style="width:${value}%"></div></div><strong>${value}</strong></div>`;
}

function chooseRecord(record, card) {
  if (chosen) return;
  chosen = true;
  initAudio();

  const roundScore = scorePick(record, currentRequest);
  score += roundScore;

  if (roundScore >= 70) streak += 1;
  else streak = 0;

  const crowdDelta = Math.round((roundScore - 55) / 5) + Math.min(streak, 4);
  crowd = Math.max(0, Math.min(100, crowd + crowdDelta));

  document.querySelectorAll('.record').forEach((node) => node.classList.remove('selected'));
  card.classList.add('selected');

  if (roundScore >= 80) {
    tone(659, 0, 0.09, 'triangle');
    tone(880, 0.1, 0.1, 'square');
    setMessage(`Perfect pull. ${record.name} hit hard. +${roundScore} points.`);
  } else if (roundScore >= 60) {
    tone(523, 0, 0.09, 'triangle');
    tone(659, 0.1, 0.09, 'triangle');
    setMessage(`Solid save. Crowd stays with you. +${roundScore} points.`);
  } else {
    tone(220, 0, 0.15, 'sawtooth', 0.03);
    setMessage(`Rough cut. Booth 7 is unimpressed. +${roundScore} points.`);
  }

  nextBtn.disabled = false;
  renderHud();
}

function finishGame() {
  nextBtn.disabled = true;
  choicesEl.innerHTML = '';

  let rank = 'Vinyl Rookie';
  if (score >= 520) rank = 'Neon Curator';
  else if (score >= 430) rank = 'Diner Hero';
  else if (score >= 340) rank = 'Crowd Keeper';

  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, String(best));
  }

  renderHud();
  requestTitleEl.textContent = 'Shift Complete';
  requestDescEl.textContent = `Final rank: ${rank}. Start a fresh shift to chase a higher score.`;
  setMessage(`Shift over. You landed ${score} points with ${crowd}% crowd heat.`);
}

nextBtn.addEventListener('click', () => {
  if (!chosen) return;
  round += 1;
  if (round > TOTAL_ROUNDS) {
    finishGame();
  } else {
    renderRound();
  }
});

newSetBtn.addEventListener('click', () => {
  round = 1;
  score = 0;
  streak = 0;
  crowd = 50;
  renderRound();
  setMessage('Fresh crowd, fresh crate. Pick the hottest B-side.');
});

renderHud();
renderRound();
