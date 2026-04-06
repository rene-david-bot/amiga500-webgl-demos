const scoreEl = document.getElementById('score');
const roundEl = document.getElementById('round');
const streakEl = document.getElementById('streak');
const accuracyEl = document.getElementById('accuracy');
const clockEl = document.getElementById('clock');
const rootEl = document.getElementById('root');
const messageEl = document.getElementById('message');
const challengeTitleEl = document.getElementById('challenge-title');

const startBtn = document.getElementById('start');
const replayBtn = document.getElementById('replay');
const audioToggleBtn = document.getElementById('audio-toggle');
const keyboardEl = document.getElementById('keyboard');
const answerButtons = Array.from(document.querySelectorAll('.answer'));

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const chordQualities = {
    major: { label: 'Major', intervals: [0, 4, 7] },
    minor: { label: 'Minor', intervals: [0, 3, 7] },
    sus4: { label: 'Sus4', intervals: [0, 5, 7] },
    diminished: { label: 'Diminished', intervals: [0, 3, 6] }
};

const state = {
    running: false,
    score: 0,
    round: 0,
    streak: 0,
    correct: 0,
    attempts: 0,
    timeLeft: 75,
    lastFrame: 0,
    audioEnabled: false,
    audioCtx: null,
    currentRound: null,
    frameHandle: null
};

function setMessage(text, kind = '') {
    messageEl.textContent = text;
    messageEl.classList.remove('good', 'bad', 'warn');
    if (kind) messageEl.classList.add(kind);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureAudio() {
    if (!state.audioCtx) {
        state.audioCtx = new AudioContext();
    }
}

function chipNote(freq, when, duration = 0.28, gainLevel = 0.035, detune = 0) {
    if (!state.audioEnabled) return;

    const ctx = state.audioCtx;
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscA.type = 'square';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freq, when);
    oscB.frequency.setValueAtTime(freq * (1 + detune), when);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, when);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainLevel, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(when);
    oscB.start(when);
    oscA.stop(when + duration + 0.03);
    oscB.stop(when + duration + 0.03);
}

function uiBlip(freq = 700, kind = 'good') {
    if (!state.audioEnabled || !state.audioCtx) return;

    const now = state.audioCtx.currentTime;
    if (kind === 'good') {
        chipNote(freq, now, 0.14, 0.03);
        chipNote(freq * 1.35, now + 0.08, 0.14, 0.028);
    } else {
        chipNote(freq * 0.7, now, 0.2, 0.038, -0.004);
    }
}

function flashKeys(noteIndexes = [], rootIndex = null) {
    const keys = keyboardEl.querySelectorAll('.key');
    keys.forEach((key) => {
        const idx = Number(key.dataset.index);
        key.classList.toggle('active', noteIndexes.includes(idx));
        key.classList.toggle('root', rootIndex === idx);
    });
}

function buildKeyboard() {
    keyboardEl.innerHTML = '';

    for (let i = 0; i < 12; i += 1) {
        const key = document.createElement('div');
        key.className = 'key';
        key.dataset.index = String(i);
        key.innerHTML = `<span class="n">${noteNames[i]}</span><span class="m">${i + 1}</span>`;
        keyboardEl.appendChild(key);
    }
}

function chooseRound() {
    const qualityKeys = Object.keys(chordQualities);
    const quality = qualityKeys[Math.floor(Math.random() * qualityKeys.length)];
    const root = Math.floor(Math.random() * 12);

    return {
        quality,
        root,
        notes: chordQualities[quality].intervals.map((interval) => (root + interval) % 12)
    };
}

function playCurrentRound() {
    if (!state.currentRound || !state.audioEnabled) return;

    ensureAudio();

    const { root, notes } = state.currentRound;
    const baseMidi = 60 + root;
    const now = state.audioCtx.currentTime + 0.02;

    // Arpeggio first, then hit the triad.
    notes.forEach((note, i) => {
        const midi = 60 + note;
        chipNote(midiToFreq(midi), now + i * 0.18, 0.2, 0.034);
    });

    const triadStart = now + 0.62;
    const triadNotes = [baseMidi, baseMidi + (notes[1] - root + 12) % 12, baseMidi + (notes[2] - root + 12) % 12];
    triadNotes.forEach((midi, i) => {
        chipNote(midiToFreq(midi), triadStart + i * 0.01, 0.38, 0.035, i === 2 ? 0.002 : 0);
    });

    flashKeys(notes, root);
    setTimeout(() => flashKeys([], root), 1100);
}

function updateStats() {
    scoreEl.textContent = String(state.score);
    roundEl.textContent = String(Math.max(1, state.round));
    streakEl.textContent = String(state.streak);
    const accuracy = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 0;
    accuracyEl.textContent = `${accuracy}%`;
    clockEl.textContent = `${state.timeLeft.toFixed(1)}s`;
    rootEl.textContent = state.currentRound ? noteNames[state.currentRound.root] : '--';
}

function setAnswersEnabled(enabled, clearState = false) {
    answerButtons.forEach((button) => {
        button.disabled = !enabled;
        if (clearState) {
            button.classList.remove('correct', 'wrong');
        }
    });
}

function setRunning(running) {
    state.running = running;
    setAnswersEnabled(running, true);
    replayBtn.disabled = !running;
}

function nextRound() {
    if (!state.running) return;

    state.round += 1;
    state.currentRound = chooseRound();

    challengeTitleEl.textContent = `Round ${state.round} · Root ${noteNames[state.currentRound.root]} · Identify the chord quality`;

    updateStats();
    playCurrentRound();
}

function finishSession() {
    setRunning(false);
    challengeTitleEl.textContent = 'Session complete';
    flashKeys([], null);

    const accuracy = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 0;
    setMessage(`Clock out. Final score ${state.score} with ${accuracy}% accuracy over ${state.attempts} guesses.`, 'warn');
    startBtn.textContent = 'Start New Session';
}

function handleGuess(guess) {
    if (!state.running || !state.currentRound) return;

    state.attempts += 1;

    const isCorrect = guess === state.currentRound.quality;
    const guessedButton = answerButtons.find((button) => button.dataset.quality === guess);
    const correctButton = answerButtons.find((button) => button.dataset.quality === state.currentRound.quality);

    if (isCorrect) {
        state.correct += 1;
        state.streak += 1;
        const bonus = 90 + state.streak * 26;
        state.score += bonus;
        state.timeLeft = clamp(state.timeLeft + 1.2, 0, 90);
        guessedButton?.classList.add('correct');
        setMessage(`Sharp ear. ${chordQualities[guess].label} locked in. +${bonus} points.`, 'good');
        uiBlip(760, 'good');
    } else {
        state.streak = 0;
        state.score = Math.max(0, state.score - 45);
        state.timeLeft = Math.max(0, state.timeLeft - 2.4);
        guessedButton?.classList.add('wrong');
        correctButton?.classList.add('correct');
        setMessage(`Close, but it was ${chordQualities[state.currentRound.quality].label}. Keep listening.`, 'bad');
        uiBlip(420, 'bad');
    }

    updateStats();

    setAnswersEnabled(false);
    setTimeout(() => {
        if (!state.running) return;
        setAnswersEnabled(true, true);
        nextRound();
    }, 760);
}

function tick(ts) {
    if (!state.running) return;

    if (!state.lastFrame) state.lastFrame = ts;
    const delta = (ts - state.lastFrame) / 1000;
    state.lastFrame = ts;

    state.timeLeft = Math.max(0, state.timeLeft - delta);
    updateStats();

    if (state.timeLeft <= 0) {
        finishSession();
        return;
    }

    state.frameHandle = requestAnimationFrame(tick);
}

function startSession() {
    if (state.frameHandle) cancelAnimationFrame(state.frameHandle);

    state.score = 0;
    state.round = 0;
    state.streak = 0;
    state.correct = 0;
    state.attempts = 0;
    state.timeLeft = 75;
    state.lastFrame = 0;
    state.currentRound = null;

    setRunning(true);
    startBtn.textContent = 'Restart Session';

    if (state.audioEnabled) {
        setMessage('Signal live. Decode triads and hold your streak.', 'warn');
    } else {
        setMessage('Audio is off. Toggle audio on, then identify each triad.', 'warn');
    }

    nextRound();
    state.frameHandle = requestAnimationFrame(tick);
}

startBtn.addEventListener('click', () => {
    startSession();
});

replayBtn.addEventListener('click', () => {
    if (!state.currentRound || !state.running) return;
    answerButtons.forEach((button) => button.classList.remove('correct', 'wrong'));
    playCurrentRound();
    setMessage(`Replaying ${noteNames[state.currentRound.root]} root clue. Focus on interval color.`, 'warn');
});

audioToggleBtn.addEventListener('click', async () => {
    try {
        ensureAudio();
        if (state.audioCtx.state === 'suspended') {
            await state.audioCtx.resume();
        }
        state.audioEnabled = !state.audioEnabled;
        audioToggleBtn.textContent = `Audio: ${state.audioEnabled ? 'On' : 'Off'}`;
        if (state.audioEnabled && state.currentRound) {
            playCurrentRound();
        }
    } catch (error) {
        setMessage('Audio blocked by browser. Tap again after user interaction.', 'bad');
    }
});

answerButtons.forEach((button) => {
    button.addEventListener('click', () => handleGuess(button.dataset.quality));
});

buildKeyboard();
setAnswersEnabled(false, true);
updateStats();
