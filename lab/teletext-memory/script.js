const grid = document.getElementById('grid');
const movesEl = document.getElementById('moves');
const timeEl = document.getElementById('time');
const pairsEl = document.getElementById('pairs');
const messageEl = document.getElementById('message');
const newGameBtn = document.getElementById('new-game');
const soundToggle = document.getElementById('sound-toggle');

const symbols = ['▲', '■', '●', '◆', '★', '☀', '☂', '☯'];

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let matches = 0;
let timer = 0;
let timerId = null;
let started = false;
let soundEnabled = false;
let audioContext = null;

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function formatTime(seconds) {
    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

function updateStats() {
    movesEl.textContent = moves;
    pairsEl.textContent = `${matches}/${symbols.length}`;
    timeEl.textContent = formatTime(timer);
}

function setMessage(text, accent = 'neutral') {
    messageEl.textContent = text;
    messageEl.dataset.state = accent;
}

function startTimer() {
    if (started) return;
    started = true;
    timerId = setInterval(() => {
        timer += 1;
        timeEl.textContent = formatTime(timer);
    }, 1000);
}

function stopTimer() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
}

function playTone(freq, duration = 0.08, type = 'square', gainLevel = 0.04) {
    if (!soundEnabled || !audioContext) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainLevel;
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    osc.stop(audioContext.currentTime + duration);
}

function resetBoard() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
}

function handleMatch() {
    firstCard.classList.add('matched');
    secondCard.classList.add('matched');
    matches += 1;
    playTone(880, 0.12, 'square', 0.05);
    resetBoard();

    if (matches === symbols.length) {
        stopTimer();
        setMessage(`All clear! ${moves} moves in ${formatTime(timer)}.`, 'win');
    } else {
        setMessage('Nice! Keep hunting.', 'good');
    }
    updateStats();
}

function handleMiss() {
    playTone(160, 0.12, 'sawtooth', 0.04);
    lockBoard = true;
    setMessage('No match. Try a new pair.', 'warn');
    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');
        resetBoard();
    }, 650);
}

function flipCard(card) {
    if (lockBoard) return;
    if (card === firstCard || card.classList.contains('matched')) return;

    startTimer();
    card.classList.add('flipped');
    playTone(520, 0.05, 'square', 0.03);

    if (!firstCard) {
        firstCard = card;
        return;
    }

    secondCard = card;
    moves += 1;
    updateStats();

    if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
        handleMatch();
    } else {
        handleMiss();
    }
}

function buildBoard() {
    grid.innerHTML = '';
    const deck = shuffle([...symbols, ...symbols]);

    deck.forEach((symbol, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card';
        card.dataset.symbol = symbol;
        card.setAttribute('aria-label', `Card ${index + 1}`);
        card.innerHTML = `
            <span class="card-face card-front">✳</span>
            <span class="card-face card-back">${symbol}</span>
        `;
        card.addEventListener('click', () => flipCard(card));
        grid.appendChild(card);
    });
}

function resetGame() {
    stopTimer();
    timer = 0;
    moves = 0;
    matches = 0;
    started = false;
    resetBoard();
    updateStats();
    setMessage('Flip two cards to begin.', 'neutral');
    buildBoard();
}

soundToggle.addEventListener('click', async () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    soundEnabled = !soundEnabled;
    soundToggle.textContent = `Sound: ${soundEnabled ? 'On' : 'Off'}`;
    playTone(740, 0.08, 'square', 0.05);
});

newGameBtn.addEventListener('click', resetGame);

resetGame();
