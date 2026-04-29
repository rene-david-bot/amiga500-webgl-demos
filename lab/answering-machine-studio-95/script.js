const vibeSelect = document.getElementById('vibeSelect');
const nameInput = document.getElementById('nameInput');
const numberInput = document.getElementById('numberInput');
const availabilityInput = document.getElementById('availabilityInput');
const customLineInput = document.getElementById('customLineInput');
const scriptOutput = document.getElementById('scriptOutput');

const generateBtn = document.getElementById('generateBtn');
const randomBtn = document.getElementById('randomBtn');
const copyBtn = document.getElementById('copyBtn');
const previewBtn = document.getElementById('previewBtn');
const stopBtn = document.getElementById('stopBtn');

const statusEl = document.getElementById('status');
const deckEl = document.getElementById('deck');
const meterEl = document.getElementById('meter');

const vibes = {
  friendly: {
    label: 'Friendly Home Base',
    openings: [
      'Hey there, you reached',
      'Hi friend, this is',
      'Thanks for calling'
    ],
    closings: [
      'Talk soon and have a great day.',
      'Leave the details and we will call right back.',
      'Thanks for your patience, we got you.'
    ]
  },
  corporate: {
    label: 'Corporate Desk',
    openings: [
      'You have reached the office of',
      'Thank you for contacting',
      'This is the recorded line for'
    ],
    closings: [
      'Please include your name, number, and reason for calling.',
      'Your message will be returned in the next business window.',
      'We appreciate your call and will respond promptly.'
    ]
  },
  night: {
    label: 'Night Shift Neon',
    openings: [
      'Midnight line here, you found',
      'Neon after-hours reached',
      'Night desk active, this is'
    ],
    closings: [
      'Drop your signal after the beep and we will sync at sunrise.',
      'Leave a message and this line lights up again tomorrow.',
      'Transmit your callback and we will return your signal.'
    ]
  },
  vacation: {
    label: 'Vacation Postcard',
    openings: [
      'Aloha from the away line of',
      'Greetings traveler, you reached',
      'Postcard mode enabled for'
    ],
    closings: [
      'Leave a message and we will reply when sandals touch office carpet.',
      'Tell us what you need and we will call back after re-entry.',
      'Your message is safe in our cassette stack until we return.'
    ]
  },
  mysterious: {
    label: 'Mystery Hotline',
    openings: [
      'Static crackles... you have reached',
      'Encrypted line confirmed for',
      'Signal accepted. This recording belongs to'
    ],
    closings: [
      'State your mission after the tone.',
      'Leave coordinates and await callback.',
      'Your message enters the archive immediately.'
    ]
  }
};

const randomNames = [
  'Rene at Neon Systems',
  'Dave from Control Deck',
  'Reply Innovation Hub',
  'After-Hours Dispatch',
  'Project Hotline 88'
];

const randomAvailability = [
  'Mon-Fri, 09:00-17:00',
  'Weeknights after 18:30',
  'Daily except Sundays',
  'Next callback wave: tomorrow 10:00',
  'Office hours resume at 08:45 CET'
];

const randomCustomLines = [
  'Mention your project codename for priority routing.',
  'Keep it short, tape is running low.',
  'Leave your order ID so we can prep before callback.',
  'Bonus points if you whistle your favorite synth hook.',
  ''
];

let audioCtx = null;
let toneOscillators = [];
let meterTimer = null;
let isPreviewing = false;
let speechToken = null;

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function setStatus(text) {
  statusEl.textContent = text;
}

function populateVibes() {
  Object.entries(vibes).forEach(([key, vibe]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = vibe.label;
    vibeSelect.append(option);
  });
}

function composeGreeting() {
  const vibe = vibes[vibeSelect.value] || vibes.friendly;
  const name = nameInput.value.trim() || 'your favorite neon operator';
  const number = numberInput.value.trim() || 'your callback number';
  const availability = availabilityInput.value.trim() || 'the next available business window';
  const customLine = customLineInput.value.trim();

  const opening = `${pick(vibe.openings)} ${name}.`;
  const body = `We are currently away from the handset, but calls are reviewed during ${availability}.`;
  const callback = `Please leave your name, best callback at ${number}, and a short reason for your call.`;
  const custom = customLine ? `${customLine}` : '';
  const closing = pick(vibe.closings);

  return [opening, body, callback, custom, closing].filter(Boolean).join('\n');
}

function generateGreeting() {
  scriptOutput.value = composeGreeting();
  setStatus('Fresh script generated. Hit Preview Greeting to hear the tape deck come alive.');
}

function randomizeInputs() {
  const keys = Object.keys(vibes);
  vibeSelect.value = keys[Math.floor(Math.random() * keys.length)];
  nameInput.value = pick(randomNames);
  numberInput.value = '+49 351 ' + String(Math.floor(1000000 + Math.random() * 8999999));
  availabilityInput.value = pick(randomAvailability);
  customLineInput.value = pick(randomCustomLines);
  generateGreeting();
}

async function copyGreeting() {
  const text = scriptOutput.value.trim();
  if (!text) {
    setStatus('Nothing to copy yet. Generate a greeting first.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard. Paste it into your voicemail setup.');
  } catch (err) {
    setStatus('Clipboard blocked by browser. Select text and copy manually.');
  }
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function tone(freq, startAt, duration, type = 'triangle', gainValue = 0.02) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);

  toneOscillators.push(osc);
}

function startMeterAnimation() {
  clearInterval(meterTimer);
  meterTimer = setInterval(() => {
    const bars = meterEl.querySelectorAll('.meter-bar');
    bars.forEach((bar, index) => {
      const base = isPreviewing ? 24 : 8;
      const spread = isPreviewing ? 74 : 18;
      const wobble = Math.max(0, Math.sin((Date.now() / 220) + index) * 8);
      const height = Math.max(8, base + Math.random() * spread + wobble);
      bar.style.height = `${Math.min(100, height)}%`;
      bar.classList.toggle('hot', height > 79);
    });
  }, 90);
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  speechToken = null;
}

function stopPreview() {
  isPreviewing = false;
  deckEl.classList.remove('playing');

  toneOscillators.forEach((osc) => {
    try {
      osc.disconnect();
      osc.stop();
    } catch (err) {
      // no-op
    }
  });
  toneOscillators = [];

  stopSpeech();
  setStatus('Preview stopped.');
}

function speakScript(text) {
  if (!('speechSynthesis' in window)) {
    setTimeout(() => {
      if (isPreviewing) stopPreview();
    }, 5200);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text.replace(/\n+/g, ' '));
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 0.9;
  utterance.lang = 'en-US';

  utterance.onend = () => {
    if (speechToken === utterance) {
      speechToken = null;
      stopPreview();
      setStatus('Preview complete. Ready for another take.');
    }
  };

  utterance.onerror = () => {
    if (speechToken === utterance) {
      speechToken = null;
      stopPreview();
      setStatus('Voice preview unavailable on this browser, script is still ready to use.');
    }
  };

  speechToken = utterance;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function previewGreeting() {
  const text = scriptOutput.value.trim();
  if (!text) {
    setStatus('Generate a greeting before previewing.');
    return;
  }

  stopPreview();
  ensureAudio();

  isPreviewing = true;
  deckEl.classList.add('playing');
  setStatus('Recording line live... beep + playback in progress.');

  const now = audioCtx.currentTime + 0.04;
  tone(950, now, 0.08, 'square', 0.032);
  tone(780, now + 0.22, 0.08, 'square', 0.028);
  tone(180, now + 0.45, 3.8, 'triangle', 0.012);
  tone(360, now + 0.45, 3.8, 'sine', 0.008);

  setTimeout(() => {
    if (isPreviewing) speakScript(text);
  }, 560);
}

function buildMeter() {
  for (let i = 0; i < 18; i += 1) {
    const bar = document.createElement('div');
    bar.className = 'meter-bar';
    meterEl.append(bar);
  }
}

generateBtn.addEventListener('click', generateGreeting);
randomBtn.addEventListener('click', randomizeInputs);
copyBtn.addEventListener('click', copyGreeting);
previewBtn.addEventListener('click', previewGreeting);
stopBtn.addEventListener('click', () => {
  stopPreview();
  setStatus('Deck idle.');
});

window.addEventListener('beforeunload', stopPreview);

populateVibes();
buildMeter();
nameInput.value = 'Rene at Neon Systems';
numberInput.value = '+49 151 1167 0498';
availabilityInput.value = 'Mon-Fri, 09:00-17:00 CET';
customLineInput.value = 'Please mention your project codename after the beep.';
generateGreeting();
startMeterAnimation();
