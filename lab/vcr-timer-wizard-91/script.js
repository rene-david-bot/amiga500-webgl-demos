const showsEl = document.getElementById('shows');
const nightEl = document.getElementById('night');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const streakEl = document.getElementById('streak');
const capacityEl = document.getElementById('capacity');
const bestEl = document.getElementById('best');
const selectedCountEl = document.getElementById('selected-count');
const selectedMinutesEl = document.getElementById('selected-minutes');
const selectedScoreEl = document.getElementById('selected-score');
const statusEl = document.getElementById('status');
const hintEl = document.getElementById('lineup-hint');
const clockEl = document.getElementById('clock');

const clearBtn = document.getElementById('clear');
const reshuffleBtn = document.getElementById('reshuffle');
const recordBtn = document.getElementById('record');
const newGameBtn = document.getElementById('new-game');

const TOTAL_NIGHTS = 6;
const START_LIVES = 3;
const START_HOUR = 18;
const SLOT_MINUTES = 15;
const WINDOW_SLOTS = 24; // 6 hours (18:00-00:00)

const SHOW_TITLES = [
    'Turbo Detective',
    'Laser League Live',
    'Neon Kitchen Wars',
    'Moonbase Report',
    'Galactic Soapline',
    'Cipher Hour',
    'Street Cartoons',
    'Night Circuit News',
    'Pixel Wrestling',
    'Arcade Review Zone',
    'Late Tape Theater',
    'Quantum Weather',
    'Scanline Stories',
    'Signal Patrol',
    'Bionic Sitcom',
    'VHS Vault Classics',
    'Robot Garden',
    'Midnight Motors'
];

const CHANNELS = ['CH-3', 'CH-7', 'CH-9', 'CH-12'];
const GENRES = ['Action', 'Sci-Fi', 'Comedy', 'Sports', 'Drama', 'News', 'Cult'];

const state = {
    night: 1,
    lives: START_LIVES,
    score: 0,
    streak: 0,
    shiftOver: false,
    capacity: 0,
    shows: [],
    selected: new Set(),
    bestPossible: 0
};

let audioCtx;
let clockTimer;

function ensureAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
}

function beep(freq, duration = 0.06, type = 'square', gain = 0.05) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    amp.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    amp.gain.exponentialRampToValueAtTime(gain, audioCtx.currentTime + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(amp);
    amp.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[randInt(0, arr.length - 1)];
}

function formatTime(slot) {
    const total = START_HOUR * 60 + slot * SLOT_MINUTES;
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function intervalsOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
}

function generateShows() {
    const count = randInt(7, 9);
    const durations = [2, 3, 4, 5, 6]; // in slots => 30..90 min
    const shows = [];
    const usedTitles = new Set();

    for (let i = 0; i < count; i++) {
        let title = pick(SHOW_TITLES);
        while (usedTitles.has(title)) title = pick(SHOW_TITLES);
        usedTitles.add(title);

        const duration = pick(durations);
        const start = randInt(0, WINDOW_SLOTS - duration);
        const end = start + duration;
        const minutes = duration * SLOT_MINUTES;

        const value = randInt(50, 95) + minutes;

        shows.push({
            id: `show-${i}`,
            title,
            channel: pick(CHANNELS),
            genre: pick(GENRES),
            start,
            end,
            minutes,
            value
        });
    }

    shows.sort((a, b) => a.start - b.start || b.value - a.value);
    return shows;
}

function bestSubset(shows, capacity) {
    const n = shows.length;
    let best = 0;

    for (let mask = 0; mask < (1 << n); mask++) {
        let minutes = 0;
        let value = 0;
        const picked = [];
        let valid = true;

        for (let i = 0; i < n; i++) {
            if (!(mask & (1 << i))) continue;
            const show = shows[i];
            minutes += show.minutes;
            if (minutes > capacity) {
                valid = false;
                break;
            }

            for (const prev of picked) {
                if (intervalsOverlap(show, prev)) {
                    valid = false;
                    break;
                }
            }
            if (!valid) break;

            picked.push(show);
            value += show.value;
        }

        if (valid && value > best) best = value;
    }

    return best;
}

function selectedShows() {
    return state.shows.filter((show) => state.selected.has(show.id));
}

function evaluateSelection() {
    const picks = selectedShows();

    let minutes = 0;
    let value = 0;
    let overlap = false;

    for (let i = 0; i < picks.length; i++) {
        const show = picks[i];
        minutes += show.minutes;
        value += show.value;

        for (let j = i + 1; j < picks.length; j++) {
            if (intervalsOverlap(show, picks[j])) {
                overlap = true;
                break;
            }
        }
        if (overlap) break;
    }

    return {
        picks,
        minutes,
        value,
        overlap,
        overCapacity: minutes > state.capacity
    };
}

function setStatus(text, tone = '') {
    statusEl.textContent = text;
    statusEl.classList.remove('good', 'bad');
    if (tone) statusEl.classList.add(tone);
}

function updateHud() {
    nightEl.textContent = `${Math.min(state.night, TOTAL_NIGHTS)} / ${TOTAL_NIGHTS}`;
    livesEl.textContent = String(state.lives);
    scoreEl.textContent = String(state.score);
    streakEl.textContent = `x${state.streak}`;
    capacityEl.textContent = `${state.capacity} min`;
    bestEl.textContent = `${state.bestPossible} pts`;

    const stats = evaluateSelection();
    selectedCountEl.textContent = String(stats.picks.length);
    selectedMinutesEl.textContent = `${stats.minutes} min`;
    selectedScoreEl.textContent = `${stats.value} pts`;
}

function updateClock() {
    if (clockTimer) clearInterval(clockTimer);

    let slot = 0;
    clockEl.textContent = formatTime(slot);
    clockTimer = setInterval(() => {
        slot = (slot + 1) % (WINDOW_SLOTS + 1);
        clockEl.textContent = formatTime(slot);
    }, 350);
}

function renderShows() {
    showsEl.innerHTML = '';

    state.shows.forEach((show) => {
        const card = document.createElement('article');
        card.className = 'show-card';
        if (state.selected.has(show.id)) card.classList.add('selected');

        const head = document.createElement('div');
        head.className = 'show-head';

        const name = document.createElement('div');
        name.className = 'show-name';
        name.textContent = show.title;

        const score = document.createElement('div');
        score.className = 'show-score';
        score.textContent = `${show.value} pts`;

        head.append(name, score);

        const metaA = document.createElement('div');
        metaA.className = 'show-meta';
        metaA.innerHTML = `<span>${formatTime(show.start)}–${formatTime(show.end)}</span><span>${show.minutes} min</span>`;

        const metaB = document.createElement('div');
        metaB.className = 'show-meta';
        metaB.innerHTML = `<span>${show.channel}</span><span>${show.genre}</span>`;

        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = state.selected.has(show.id) ? 'Queued on tape' : 'Tap to schedule';

        card.append(head, metaA, metaB, tag);

        card.addEventListener('click', () => {
            if (state.shiftOver) return;
            ensureAudio();

            if (state.selected.has(show.id)) {
                state.selected.delete(show.id);
                beep(220, 0.04, 'square', 0.04);
            } else {
                state.selected.add(show.id);
                beep(420, 0.05, 'triangle', 0.05);
            }

            renderShows();
            updateHud();
        });

        showsEl.appendChild(card);
    });
}

function nextNight() {
    if (state.lives <= 0 || state.night >= TOTAL_NIGHTS) {
        endWeek();
        return;
    }

    state.night += 1;
    buildNight();
}

function buildNight() {
    state.selected.clear();
    state.shows = generateShows();
    state.capacity = randInt(150, 210);
    state.bestPossible = bestSubset(state.shows, state.capacity);

    hintEl.textContent = `Stack up to ${state.capacity} tape minutes with no overlaps. Best possible tonight: ${state.bestPossible} pts.`;

    renderShows();
    updateHud();
    setStatus('Program your lineup and lock in the timer deck.');
}

function endWeek() {
    state.shiftOver = true;
    clearInterval(clockTimer);

    const completedNights = state.lives > 0 ? TOTAL_NIGHTS : Math.max(1, state.night);
    const verdict = state.score >= 2100
        ? 'Legendary couch commander run.'
        : state.score >= 1500
            ? 'Solid primetime programming.'
            : 'You survived the static storm.';

    setStatus(`Week complete — ${completedNights} night(s), ${state.score} total points. ${verdict}`, state.score >= 1500 ? 'good' : 'bad');
    hintEl.textContent = 'Press New Week to reroll a fresh TV schedule.';

    recordBtn.disabled = true;
    reshuffleBtn.disabled = true;
    clearBtn.disabled = true;
    renderShows();
}

function submitNight() {
    if (state.shiftOver) return;
    ensureAudio();

    const stats = evaluateSelection();

    if (!stats.picks.length) {
        setStatus('Timer deck is empty. Schedule at least one show first.', 'bad');
        beep(180, 0.08, 'sawtooth', 0.07);
        return;
    }

    if (stats.overlap || stats.overCapacity) {
        state.lives = Math.max(0, state.lives - 1);
        state.streak = 0;
        const reason = stats.overlap ? 'show overlap conflict' : 'tape overflow';
        setStatus(`Recording failed — ${reason}. Lost 1 life.`, 'bad');
        beep(170, 0.12, 'sawtooth', 0.08);
    } else {
        const ratio = state.bestPossible > 0 ? stats.value / state.bestPossible : 0;
        let gained = stats.value;

        if (ratio >= 1) {
            state.streak += 1;
            gained += 90 + state.streak * 22;
            setStatus(`Perfect tape night! ${stats.value}/${state.bestPossible} pts + streak bonus.`, 'good');
            beep(620, 0.06, 'triangle', 0.07);
            setTimeout(() => beep(840, 0.07, 'triangle', 0.07), 60);
        } else if (ratio >= 0.85) {
            state.streak += 1;
            gained += 35 + state.streak * 10;
            setStatus(`Great lineup — ${Math.round(ratio * 100)}% of best possible.`, 'good');
            beep(500, 0.06, 'triangle', 0.06);
        } else {
            state.streak = 0;
            if (ratio < 0.6) {
                state.lives = Math.max(0, state.lives - 1);
                setStatus(`Weak lineup (${Math.round(ratio * 100)}% efficiency). Lost 1 life.`, 'bad');
                beep(190, 0.1, 'square', 0.06);
            } else {
                setStatus(`Acceptable lineup (${Math.round(ratio * 100)}% efficiency).`, '');
                beep(300, 0.05, 'square', 0.05);
            }
        }

        state.score += gained;
    }

    updateHud();

    if (state.lives <= 0 || state.night >= TOTAL_NIGHTS) {
        endWeek();
    } else {
        setTimeout(nextNight, 480);
    }
}

function startGame() {
    ensureAudio();
    state.night = 1;
    state.lives = START_LIVES;
    state.score = 0;
    state.streak = 0;
    state.shiftOver = false;

    recordBtn.disabled = false;
    reshuffleBtn.disabled = false;
    clearBtn.disabled = false;

    updateClock();
    buildNight();
    beep(420, 0.05, 'square', 0.05);
}

clearBtn.addEventListener('click', () => {
    if (state.shiftOver) return;
    ensureAudio();
    state.selected.clear();
    renderShows();
    updateHud();
    setStatus('Selections cleared.');
    beep(230, 0.04, 'square', 0.04);
});

reshuffleBtn.addEventListener('click', () => {
    if (state.shiftOver) return;
    ensureAudio();
    state.shows = generateShows();
    state.selected.clear();
    state.bestPossible = bestSubset(state.shows, state.capacity);
    hintEl.textContent = `Lineup reshuffled. Best possible tonight: ${state.bestPossible} pts.`;
    renderShows();
    updateHud();
    setStatus('Fresh lineup loaded.');
    beep(360, 0.05, 'triangle', 0.05);
});

recordBtn.addEventListener('click', submitNight);
newGameBtn.addEventListener('click', startGame);

updateClock();
updateHud();
setStatus('Press New Week to begin your VCR programming run.');
