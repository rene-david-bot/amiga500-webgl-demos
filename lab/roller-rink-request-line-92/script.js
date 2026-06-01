const GENRES = ['freestyle', 'italo', 'synth-pop', 'electro-funk', 'new jack'];
const ENERGIES = ['chill', 'cruise', 'hype'];
const BPM_BANDS = ['slow', 'mid', 'fast'];
const SYNTH_LEVELS = ['low synth', 'neon synth'];

const statusLabel = document.getElementById('statusLabel');
const requestText = document.getElementById('requestText');
const requestHint = document.getElementById('requestHint');
const choicesWrap = document.getElementById('choices');
const logList = document.getElementById('log');

const timeLabel = document.getElementById('timeLabel');
const scoreLabel = document.getElementById('scoreLabel');
const hypeLabel = document.getElementById('hypeLabel');
const streakLabel = document.getElementById('streakLabel');
const handledLabel = document.getElementById('handledLabel');
const hypeFill = document.getElementById('hypeFill');

const startBtn = document.getElementById('startBtn');
const skipBtn = document.getElementById('skipBtn');
const audioBtn = document.getElementById('audioBtn');

const state = {
  running: false,
  timeLeft: 90,
  score: 0,
  hype: 50,
  streak: 0,
  handled: 0,
  request: null,
  choices: [],
  ticker: 0,
  nextRequestAt: 0,
  audioEnabled: false,
  audioCtx: null,
  lastTick: performance.now()
};

function randOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chance(prob) {
  return Math.random() < prob;
}

function createTrack() {
  return {
    genre: randOf(GENRES),
    energy: randOf(ENERGIES),
    bpm: randOf(BPM_BANDS),
    synth: randOf(SYNTH_LEVELS)
  };
}

function createRequest() {
  const names = ['Skate captain', 'Snack bar crew', 'Birthday lane', 'Back-wall duo', 'Night manager'];
  const mood = randOf([
    'wants the floor packed',
    'needs a smooth glide round',
    'is calling for a huge speed burst',
    'asked for a mirrorball classic'
  ]);

  return {
    caller: randOf(names),
    genre: randOf(GENRES),
    energy: randOf(ENERGIES),
    bpm: randOf(BPM_BANDS),
    synth: chance(0.55) ? 'neon synth' : 'low synth',
    mood
  };
}

function requestToText(req) {
  return `${req.caller} ${req.mood}: ${req.genre}, ${req.energy} energy, ${req.bpm} tempo, ${req.synth}.`;
}

function trackToTags(track) {
  return `${track.genre} · ${track.energy} · ${track.bpm} · ${track.synth}`;
}

function scorePick(req, track) {
  const genreHit = req.genre === track.genre;
  const energyHit = req.energy === track.energy;
  const bpmHit = req.bpm === track.bpm;
  const synthHit = req.synth === track.synth;

  const hits = [genreHit, energyHit, bpmHit, synthHit].filter(Boolean).length;

  if (genreHit && energyHit && bpmHit && synthHit) {
    return { points: 120, hype: 13, label: 'Perfect spin!', good: true };
  }

  if (genreHit && hits >= 3) {
    return { points: 80, hype: 8, label: 'Crowd erupts!', good: true };
  }

  if (genreHit || hits >= 2) {
    return { points: 35, hype: 3, label: 'Solid blend.', good: true };
  }

  return { points: -40, hype: -14, label: 'Wrong vibe. Floor thins out.', good: false };
}

function ensureAudio() {
  if (state.audioCtx) return;
  state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(freq = 640, duration = 0.08, gain = 0.03, type = 'square') {
  if (!state.audioEnabled) return;
  ensureAudio();
  const t = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const amp = state.audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(amp).connect(state.audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function pushLog(text, kind = 'neutral') {
  const li = document.createElement('li');
  li.textContent = text;
  if (kind === 'good') li.classList.add('good');
  if (kind === 'bad') li.classList.add('bad');
  logList.prepend(li);
  while (logList.children.length > 12) {
    logList.removeChild(logList.lastChild);
  }
}

function updateHud() {
  timeLabel.textContent = `${Math.max(0, state.timeLeft).toFixed(0)}s`;
  scoreLabel.textContent = `${Math.max(0, state.score)}`;
  hypeLabel.textContent = `${Math.max(0, state.hype).toFixed(0)}%`;
  streakLabel.textContent = `${state.streak}`;
  handledLabel.textContent = `${state.handled}`;
  hypeFill.style.width = `${Math.max(0, Math.min(100, state.hype))}%`;
}

function renderChoices() {
  choicesWrap.innerHTML = '';

  state.choices.forEach((track, index) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.type = 'button';
    btn.disabled = !state.running || !state.request;

    btn.innerHTML = `
      <span class="deck-name">Deck ${String.fromCharCode(65 + index)}</span>
      <span class="meta">${track.genre} / ${track.energy}</span>
      <span class="tags">${trackToTags(track)}</span>
    `;

    btn.addEventListener('click', () => handleChoice(index));
    choicesWrap.appendChild(btn);
  });
}

function spawnRound() {
  state.request = createRequest();
  state.choices = [createTrack(), createTrack(), createTrack()];

  if (chance(0.28)) {
    const perfectSlot = Math.floor(Math.random() * state.choices.length);
    state.choices[perfectSlot] = { ...state.request };
  }

  requestText.textContent = requestToText(state.request);
  requestHint.textContent = 'Tip: genre match matters most, then energy + tempo + synth flavor.';
  renderChoices();
  state.nextRequestAt = state.ticker + 6.2;
}

function applyResult(result, deckIndex) {
  state.handled += 1;
  state.score += result.points + Math.max(0, state.streak - 1) * 4;
  state.hype = Math.max(0, Math.min(100, state.hype + result.hype));

  if (result.good) {
    state.streak += 1;
    beep(760, 0.06, 0.03, 'triangle');
    beep(980, 0.08, 0.02, 'square');
    pushLog(`Deck ${String.fromCharCode(65 + deckIndex)}: ${result.label} (+${result.points})`, 'good');
  } else {
    state.streak = 0;
    beep(210, 0.12, 0.035, 'sawtooth');
    pushLog(`Deck ${String.fromCharCode(65 + deckIndex)}: ${result.label} (${result.points})`, 'bad');
  }

  state.request = null;
  requestText.textContent = 'Caller line re-routing...';
  requestHint.textContent = 'Next caller in a moment.';
  setStatus(result.label);
  updateHud();
  renderChoices();
}

function handleChoice(index) {
  if (!state.running || !state.request) return;
  const track = state.choices[index];
  const result = scorePick(state.request, track);
  applyResult(result, index);
}

function skipRequest() {
  if (!state.running || !state.request) return;

  state.handled += 1;
  state.hype = Math.max(0, state.hype - 12);
  state.streak = 0;
  state.score = Math.max(0, state.score - 18);
  pushLog('Skipped caller. Booth manager is glaring at you.', 'bad');
  setStatus('Caller skipped. Keep the floor alive.');
  beep(280, 0.08, 0.03, 'sawtooth');

  state.request = null;
  requestText.textContent = 'Line temporarily idle...';
  requestHint.textContent = 'Next request incoming.';
  updateHud();
  renderChoices();
}

function endShift(reason) {
  state.running = false;
  setStatus(reason);
  startBtn.disabled = false;
  skipBtn.disabled = true;

  requestText.textContent = `Shift complete. Final score ${Math.max(0, state.score)} with ${state.handled} callers handled.`;
  requestHint.textContent = 'Press Start Shift to run another night.';
  renderChoices();

  if (reason.includes('saved')) {
    pushLog('Shift cleared. The rink owner hands you the golden skate key.', 'good');
    beep(900, 0.08, 0.03, 'triangle');
    beep(1200, 0.12, 0.026, 'sine');
  } else {
    pushLog('Crowd emptied before closing. Better luck next shift.', 'bad');
    beep(180, 0.16, 0.038, 'sawtooth');
  }
}

function startShift() {
  state.running = true;
  state.timeLeft = 90;
  state.score = 0;
  state.hype = 50;
  state.streak = 0;
  state.handled = 0;
  state.ticker = 0;
  state.request = null;
  state.choices = [createTrack(), createTrack(), createTrack()];
  state.nextRequestAt = 0;

  logList.innerHTML = '';
  pushLog('Hotline open. Neon wheels are rolling.');

  startBtn.disabled = true;
  skipBtn.disabled = false;

  setStatus('Shift live. Match every caller to keep hype high.');
  updateHud();
  renderChoices();
}

function tick(now) {
  const dt = Math.min(0.05, (now - state.lastTick) / 1000);
  state.lastTick = now;

  if (state.running) {
    state.ticker += dt;
    state.timeLeft -= dt;

    if (!state.request && state.ticker >= state.nextRequestAt) {
      spawnRound();
    }

    if (state.request) {
      state.hype = Math.max(0, state.hype - dt * 1.6);
      if (state.ticker > state.nextRequestAt + 2.6) {
        state.streak = 0;
        state.hype = Math.max(0, state.hype - 6);
        pushLog('Caller hung up after waiting too long.', 'bad');
        setStatus('Too slow, line dropped.');
        beep(260, 0.07, 0.03, 'sawtooth');
        state.request = null;
        requestText.textContent = 'Line cooling down...';
        requestHint.textContent = 'Next caller soon. Keep pace.';
        renderChoices();
      }
    }

    if (state.timeLeft <= 0) {
      updateHud();
      endShift(state.hype > 0 ? 'Shift saved! The rink stays open all night.' : 'Timer hit zero and hype collapsed. Shift lost.');
    } else if (state.hype <= 0) {
      updateHud();
      endShift('Crowd hype flatlined. Shift over.');
    }

    updateHud();
  }

  requestAnimationFrame(tick);
}

startBtn.addEventListener('click', startShift);
skipBtn.addEventListener('click', skipRequest);
audioBtn.addEventListener('click', () => {
  state.audioEnabled = !state.audioEnabled;
  audioBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;
  if (state.audioEnabled) {
    beep(660, 0.07, 0.02, 'triangle');
    beep(880, 0.06, 0.02, 'square');
  }
});

skipBtn.disabled = true;
updateHud();
renderChoices();
requestAnimationFrame(tick);
