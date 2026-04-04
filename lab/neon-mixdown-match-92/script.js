const els = {
  bass: document.getElementById('bass'),
  mid: document.getElementById('mid'),
  treble: document.getElementById('treble'),
  bassValue: document.getElementById('bass-value'),
  midValue: document.getElementById('mid-value'),
  trebleValue: document.getElementById('treble-value'),
  round: document.getElementById('round'),
  streak: document.getElementById('streak'),
  total: document.getElementById('total'),
  hint: document.getElementById('hint'),
  result: document.getElementById('result'),
  target: document.getElementById('target'),
  lockIn: document.getElementById('lock-in'),
  newRound: document.getElementById('new-round'),
  auditionCurrent: document.getElementById('audition-current'),
  auditionTarget: document.getElementById('audition-target'),
  meterWrap: document.getElementById('meter-wrap'),
};

const state = {
  round: 1,
  streak: 0,
  total: 0,
  revealed: false,
  target: randomTarget(),
  bars: [],
};

let audioCtx = null;

function randomTarget() {
  return {
    bass: randomBetween(12, 88),
    mid: randomBetween(12, 88),
    treble: randomBetween(12, 88),
  };
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCurrentMix() {
  return {
    bass: Number(els.bass.value),
    mid: Number(els.mid.value),
    treble: Number(els.treble.value),
  };
}

function describeBand(name, value) {
  if (value < 27) return `${name} cut hard`;
  if (value < 43) return `${name} trimmed`;
  if (value < 58) return `${name} neutral`;
  if (value < 74) return `${name} boosted`;
  return `${name} boosted hard`;
}

function targetHint(target) {
  const notes = [
    describeBand('Low-end', target.bass),
    describeBand('Midrange', target.mid),
    describeBand('Top-end', target.treble),
  ];
  return `Secret engineer note: ${notes.join(' · ')}.`;
}

function updateSliderLabels() {
  els.bassValue.textContent = els.bass.value;
  els.midValue.textContent = els.mid.value;
  els.trebleValue.textContent = els.treble.value;
}

function computeScore(guess, target) {
  const avgDiff = (Math.abs(guess.bass - target.bass) + Math.abs(guess.mid - target.mid) + Math.abs(guess.treble - target.treble)) / 3;
  return Math.max(0, Math.round(100 - avgDiff * 1.35));
}

function grade(score) {
  if (score >= 95) return 'Studio Master';
  if (score >= 85) return 'Tape Wizard';
  if (score >= 70) return 'Good Ears';
  if (score >= 55) return 'Rough Mix';
  return 'Needs Rewind';
}

function createMeter() {
  const count = 24;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = '10px';
    frag.appendChild(bar);
    state.bars.push(bar);
  }
  els.meterWrap.appendChild(frag);
}

function animateMeter() {
  const mix = getCurrentMix();
  const base = (mix.bass + mix.mid + mix.treble) / 3;

  state.bars.forEach((bar, index) => {
    const wave = Math.sin((Date.now() / 180) + index * 0.6) * 9;
    const tilt = (index / state.bars.length) * (mix.treble - mix.bass) * 0.2;
    const level = Math.max(8, Math.min(72, 14 + base * 0.48 + wave + tilt + Math.random() * 8));
    bar.style.height = `${level}px`;
    if (level > 58) {
      bar.style.background = 'linear-gradient(to top, #ff4fd8, #ffc4f3)';
    } else {
      bar.style.background = 'linear-gradient(to top, #45f7d7, #a2fff2)';
    }
  });

  requestAnimationFrame(animateMeter);
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
}

function levelToDb(level) {
  return (level - 50) * 0.44;
}

function playPreview(mix) {
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  const duration = 0.92;

  const noiseBuffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * duration), audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.22;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;

  const tone = audioCtx.createOscillator();
  tone.type = 'sawtooth';
  tone.frequency.setValueAtTime(120 + mix.bass * 1.6, now);

  const toneGain = audioCtx.createGain();
  toneGain.gain.setValueAtTime(0.05, now);

  const low = audioCtx.createBiquadFilter();
  low.type = 'lowshelf';
  low.frequency.value = 220;
  low.gain.value = levelToDb(mix.bass);

  const mid = audioCtx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1200;
  mid.Q.value = 0.9;
  mid.gain.value = levelToDb(mix.mid);

  const high = audioCtx.createBiquadFilter();
  high.type = 'highshelf';
  high.frequency.value = 3200;
  high.gain.value = levelToDb(mix.treble);

  const output = audioCtx.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.9, now + 0.04);
  output.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(low);
  tone.connect(toneGain).connect(low);
  low.connect(mid).connect(high).connect(output).connect(audioCtx.destination);

  noise.start(now);
  tone.start(now);
  noise.stop(now + duration);
  tone.stop(now + duration);
}

function lockInGuess() {
  const guess = getCurrentMix();
  const score = computeScore(guess, state.target);
  state.total += score;
  state.streak = score >= 85 ? state.streak + 1 : 0;
  state.revealed = true;

  els.result.innerHTML = `Score: <strong>${score}</strong> / 100 — ${grade(score)}.`;
  els.target.textContent = `Secret mix was B:${state.target.bass} · M:${state.target.mid} · T:${state.target.treble}.`;

  els.total.textContent = state.total;
  els.streak.textContent = state.streak;
}

function nextRound() {
  state.round += 1;
  state.target = randomTarget();
  state.revealed = false;

  els.round.textContent = state.round;
  els.hint.textContent = targetHint(state.target);
  els.result.innerHTML = 'Dial in a mix and hit <strong>Lock In Guess</strong>.';
  els.target.textContent = '';

  [els.bass, els.mid, els.treble].forEach((input) => {
    input.value = randomBetween(38, 62);
  });
  updateSliderLabels();
}

function boot() {
  createMeter();
  updateSliderLabels();
  els.hint.textContent = targetHint(state.target);

  [els.bass, els.mid, els.treble].forEach((input) => {
    input.addEventListener('input', updateSliderLabels);
  });

  els.lockIn.addEventListener('click', lockInGuess);

  els.newRound.addEventListener('click', () => {
    nextRound();
  });

  els.auditionCurrent.addEventListener('click', () => {
    playPreview(getCurrentMix());
  });

  els.auditionTarget.addEventListener('click', () => {
    playPreview(state.target);
    if (!state.revealed) {
      els.result.innerHTML = 'Cheeky move. You can audition it, but you still have to <strong>Lock In Guess</strong>.';
    }
  });

  animateMeter();
}

boot();
