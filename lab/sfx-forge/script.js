const waveSelect = document.getElementById('wave');
const pitchInput = document.getElementById('pitch');
const sweepInput = document.getElementById('sweep');
const attackInput = document.getElementById('attack');
const decayInput = document.getElementById('decay');
const toneInput = document.getElementById('tone');
const crunchInput = document.getElementById('crunch');
const playButton = document.getElementById('play');
const randomButton = document.getElementById('random');
const soundButton = document.getElementById('sound');
const statusEl = document.getElementById('status');
const scopeCanvas = document.getElementById('scope');
const scopeCtx = scopeCanvas.getContext('2d');

let audioCtx = null;
let master = null;
let analyser = null;
let soundEnabled = false;
let noiseBuffer = null;

const presets = {
    coin: { wave: 'square', pitch: 920, sweep: -180, attack: 0.01, decay: 0.25, tone: 3200, crunch: 0.4 },
    zap: { wave: 'sawtooth', pitch: 780, sweep: -620, attack: 0.01, decay: 0.22, tone: 1200, crunch: 0.6 },
    alarm: { wave: 'triangle', pitch: 520, sweep: 240, attack: 0.04, decay: 0.55, tone: 3800, crunch: 0.25 },
    power: { wave: 'square', pitch: 260, sweep: 640, attack: 0.06, decay: 0.75, tone: 2100, crunch: 0.3 }
};

const valueDisplays = document.querySelectorAll('[data-display]');

function updateDisplay(target) {
    const id = target.dataset.display;
    if (!id) return;
    const output = document.getElementById(id);
    const value = parseFloat(target.value);
    if (target === pitchInput || target === toneInput) {
        output.textContent = `${Math.round(value)} Hz`;
        return;
    }
    if (target === sweepInput) {
        output.textContent = `${Math.round(value)} Hz`;
        return;
    }
    if (target === attackInput || target === decayInput) {
        output.textContent = `${value.toFixed(2)} s`;
        return;
    }
    if (target === crunchInput) {
        output.textContent = `${Math.round(value * 100)}%`;
    }
}

valueDisplays.forEach((input) => {
    updateDisplay(input);
    input.addEventListener('input', () => updateDisplay(input));
});

function setStatus(message) {
    statusEl.textContent = message;
}

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        master = audioCtx.createGain();
        master.gain.value = 0.7;
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        master.connect(analyser);
        analyser.connect(audioCtx.destination);
        drawScope();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!noiseBuffer) {
        noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
            data[i] = Math.random() * 2 - 1;
        }
    }
}

function createBitCrusher(context, bits, normFreq) {
    const node = context.createScriptProcessor(4096, 1, 1);
    const step = Math.pow(0.5, bits);
    let phaser = 0;
    let last = 0;
    node.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i += 1) {
            phaser += normFreq;
            if (phaser >= 1.0) {
                phaser -= 1.0;
                last = step * Math.floor(input[i] / step + 0.5);
            }
            output[i] = last;
        }
    };
    return node;
}

function playSfx() {
    ensureAudio();
    if (!soundEnabled) {
        setStatus('Sound is muted. Toggle Sound: On to play.');
        return;
    }

    const now = audioCtx.currentTime;
    const pitch = parseFloat(pitchInput.value);
    const sweep = parseFloat(sweepInput.value);
    const attack = parseFloat(attackInput.value);
    const decay = parseFloat(decayInput.value);
    const tone = parseFloat(toneInput.value);
    const crunch = parseFloat(crunchInput.value);
    const wave = waveSelect.value;

    const amp = audioCtx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(1, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

    const filter = audioCtx.createBiquadFilter();
    filter.type = wave === 'noise' ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(tone, now);

    let source;
    if (wave === 'noise') {
        source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        filter.frequency.setValueAtTime(Math.max(120, pitch), now);
        filter.frequency.linearRampToValueAtTime(Math.max(120, pitch + sweep), now + attack + decay);
    } else {
        source = audioCtx.createOscillator();
        source.type = wave;
        source.frequency.setValueAtTime(pitch, now);
        source.frequency.exponentialRampToValueAtTime(Math.max(80, pitch + sweep), now + attack + decay);
    }

    let crusher = null;
    if (crunch > 0.02) {
        const bits = Math.round(16 - crunch * 10);
        crusher = createBitCrusher(audioCtx, bits, 0.18 + crunch * 0.22);
    }

    source.connect(filter);
    if (crusher) {
        filter.connect(crusher);
        crusher.connect(amp);
    } else {
        filter.connect(amp);
    }
    amp.connect(master);

    source.start(now);
    source.stop(now + attack + decay + 0.08);

    setStatus(`Played ${wave} · Pitch ${Math.round(pitch)} Hz · Sweep ${Math.round(sweep)} Hz.`);
}

function randomize() {
    waveSelect.value = ['square', 'triangle', 'sawtooth', 'noise'][Math.floor(Math.random() * 4)];
    pitchInput.value = Math.floor(200 + Math.random() * 900);
    sweepInput.value = Math.floor(-800 + Math.random() * 1600);
    attackInput.value = (0.005 + Math.random() * 0.15).toFixed(3);
    decayInput.value = (0.08 + Math.random() * 1.1).toFixed(2);
    toneInput.value = Math.floor(400 + Math.random() * 7200);
    crunchInput.value = (Math.random() * 0.8).toFixed(2);

    [pitchInput, sweepInput, attackInput, decayInput, toneInput, crunchInput].forEach(updateDisplay);
    setStatus('Rolled a fresh preset. Hit Play to hear it.');
}

function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    waveSelect.value = preset.wave;
    pitchInput.value = preset.pitch;
    sweepInput.value = preset.sweep;
    attackInput.value = preset.attack;
    decayInput.value = preset.decay;
    toneInput.value = preset.tone;
    crunchInput.value = preset.crunch;
    [pitchInput, sweepInput, attackInput, decayInput, toneInput, crunchInput].forEach(updateDisplay);
    setStatus(`Loaded preset: ${name.toUpperCase()}.`);
}

function toggleSound() {
    ensureAudio();
    soundEnabled = !soundEnabled;
    soundButton.textContent = soundEnabled ? 'Sound: On' : 'Sound: Off';
    setStatus(soundEnabled ? 'Sound armed. Press Play to launch a zap.' : 'Sound muted.');
}

function drawScope() {
    if (!analyser) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        scopeCtx.fillStyle = '#07070b';
        scopeCtx.fillRect(0, 0, scopeCanvas.width, scopeCanvas.height);

        scopeCtx.lineWidth = 2;
        scopeCtx.strokeStyle = 'rgba(109, 242, 210, 0.9)';
        scopeCtx.shadowColor = 'rgba(109, 242, 210, 0.6)';
        scopeCtx.shadowBlur = 12;
        scopeCtx.beginPath();

        const sliceWidth = scopeCanvas.width / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i += 1) {
            const v = dataArray[i] / 128.0;
            const y = (v * scopeCanvas.height) / 2;
            if (i === 0) {
                scopeCtx.moveTo(x, y);
            } else {
                scopeCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        scopeCtx.lineTo(scopeCanvas.width, scopeCanvas.height / 2);
        scopeCtx.stroke();
        scopeCtx.shadowBlur = 0;
    };

    draw();
}

playButton.addEventListener('click', playSfx);
randomButton.addEventListener('click', randomize);
soundButton.addEventListener('click', toggleSound);

document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
});

randomize();
