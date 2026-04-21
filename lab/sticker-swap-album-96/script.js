const creditsEl = document.getElementById('credits');
const packsEl = document.getElementById('packs');
const collectionEl = document.getElementById('collection');
const sparkleEl = document.getElementById('sparkle');
const packResultEl = document.getElementById('packResult');
const inventoryEl = document.getElementById('inventory');
const albumEl = document.getElementById('album');
const messageEl = document.getElementById('message');

const openPackBtn = document.getElementById('openPackBtn');
const clearBtn = document.getElementById('clearBtn');

const stickers = [
  { id: 'rocket', icon: '🚀', name: 'Rocket Tag', rarity: 'rare', color: '#ff8bb9' },
  { id: 'skate', icon: '🛹', name: 'Street Skate', rarity: 'common', color: '#8ee1ff' },
  { id: 'laser', icon: '🛸', name: 'Laser Saucer', rarity: 'rare', color: '#ffd978' },
  { id: 'cat', icon: '🐾', name: 'Pixel Cat', rarity: 'common', color: '#c6b2ff' },
  { id: 'boombox', icon: '📻', name: 'Boombox', rarity: 'common', color: '#80ffd8' },
  { id: 'dino', icon: '🦖', name: 'Neon Dino', rarity: 'rare', color: '#ffb37a' },
  { id: 'joystick', icon: '🕹️', name: 'Joystick Ace', rarity: 'common', color: '#86c7ff' },
  { id: 'arcade', icon: '👾', name: 'Arcade Gremlin', rarity: 'common', color: '#b8ff9d' },
  { id: 'cassette', icon: '📼', name: 'Tape Attack', rarity: 'common', color: '#ffd1f6' },
  { id: 'sunset', icon: '🌇', name: 'Mall Sunset', rarity: 'common', color: '#ffbe8e' },
  { id: 'robot', icon: '🤖', name: 'Robo Buddy', rarity: 'rare', color: '#9df0ff' },
  { id: 'bolt', icon: '⚡', name: 'Turbo Bolt', rarity: 'common', color: '#ffe58e' },
  { id: 'holo-star', icon: '🌟', name: 'Holo Star', rarity: 'holo', color: '#fff49b' },
  { id: 'holo-heart', icon: '💖', name: 'Holo Heart', rarity: 'holo', color: '#ffd0ef' },
  { id: 'holo-gem', icon: '💎', name: 'Holo Gem', rarity: 'holo', color: '#bde8ff' },
  { id: 'floppy', icon: '💾', name: 'Floppy Save', rarity: 'common', color: '#9be0ff' },
  { id: 'pizza', icon: '🍕', name: 'Slice Club', rarity: 'common', color: '#ffc47a' },
  { id: 'walkman', icon: '🎧', name: 'Walkman Wave', rarity: 'rare', color: '#93ffcb' },
];

const rarityWeight = { common: 72, rare: 23, holo: 5 };
const rarityBonus = { common: 8, rare: 18, holo: 40 };

let credits = 12;
let packsOpened = 0;
let sparkle = 0;
let selectedId = null;

const owned = new Set();
const inventory = new Map();
const albumSlots = Array.from({ length: 18 }, () => null);

const BEST_KEY = 'retro_sticker_swap_best';

let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep(freq = 440, duration = 0.08, type = 'square', gain = 0.03) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function weightedDraw() {
  const total = stickers.reduce((sum, s) => sum + rarityWeight[s.rarity], 0);
  let roll = Math.random() * total;
  for (const sticker of stickers) {
    roll -= rarityWeight[sticker.rarity];
    if (roll <= 0) return sticker;
  }
  return stickers[0];
}

function getSticker(id) {
  return stickers.find((s) => s.id === id);
}

function setMessage(text) {
  messageEl.textContent = text;
}

function formatScore(v) {
  return String(v).padStart(4, '0');
}

function syncHud() {
  creditsEl.textContent = String(credits);
  packsEl.textContent = String(packsOpened);
  collectionEl.textContent = `${owned.size}/${stickers.length}`;
  sparkleEl.textContent = formatScore(sparkle);
}

function rarityTag(rarity) {
  if (rarity === 'holo') return 'HOLO';
  if (rarity === 'rare') return 'RARE';
  return 'COMMON';
}

function adjustInventory(id, delta) {
  const next = (inventory.get(id) || 0) + delta;
  if (next <= 0) {
    inventory.delete(id);
    if (selectedId === id) selectedId = null;
  } else {
    inventory.set(id, next);
  }
}

function renderInventory() {
  const entries = [...inventory.entries()].sort((a, b) => {
    const sa = getSticker(a[0]);
    const sb = getSticker(b[0]);
    return sa.name.localeCompare(sb.name);
  });

  if (!entries.length) {
    inventoryEl.innerHTML = '<p class="hint">No stickers in tray. Open a pack.</p>';
    return;
  }

  inventoryEl.innerHTML = '';
  for (const [id, count] of entries) {
    const sticker = getSticker(id);
    const btn = document.createElement('button');
    btn.className = 'sticker-btn';
    if (selectedId === id) btn.classList.add('active');
    btn.innerHTML = `
      <span class="sticker-icon" style="color:${sticker.color}">${sticker.icon}</span>
      <strong>${sticker.name}</strong>
      <span class="sticker-meta">${rarityTag(sticker.rarity)} · x${count}</span>
    `;
    btn.addEventListener('click', () => {
      selectedId = selectedId === id ? null : id;
      renderInventory();
      if (selectedId) setMessage(`Selected ${sticker.name}. Tap an album slot.`);
      else setMessage('Selection cleared.');
      initAudio();
      beep(420, 0.04, 'triangle', 0.02);
    });
    inventoryEl.appendChild(btn);
  }
}

function renderAlbum() {
  albumEl.innerHTML = '';
  albumSlots.forEach((id, idx) => {
    const slot = document.createElement('button');
    slot.className = 'slot';
    slot.type = 'button';
    slot.setAttribute('aria-label', `Album slot ${idx + 1}`);

    if (id) {
      const sticker = getSticker(id);
      slot.classList.add('filled');
      slot.style.borderColor = sticker.color;
      slot.innerHTML = `<span style="color:${sticker.color}">${sticker.icon}</span><span class="slot-label">${sticker.name}</span>`;
    } else {
      slot.innerHTML = '<span>+</span>';
    }

    slot.addEventListener('click', () => {
      initAudio();
      const existing = albumSlots[idx];
      if (existing) {
        adjustInventory(existing, 1);
        albumSlots[idx] = null;
        beep(260, 0.06, 'sawtooth', 0.025);
      }

      if (selectedId) {
        adjustInventory(selectedId, -1);
        albumSlots[idx] = selectedId;
        const sticker = getSticker(selectedId);
        setMessage(`Placed ${sticker.name}.`);
        beep(sticker.rarity === 'holo' ? 920 : sticker.rarity === 'rare' ? 760 : 620, 0.07, 'square', 0.03);
      } else if (existing) {
        setMessage('Sticker returned to tray.');
      } else {
        setMessage('Select a sticker first.');
      }

      renderInventory();
      renderAlbum();
    });

    albumEl.appendChild(slot);
  });
}

function openPack() {
  if (credits <= 0) {
    setMessage('No credits left. Clear page and keep curating.');
    packResultEl.textContent = 'Out of credits. Your collection remains saved in this run.';
    initAudio();
    beep(160, 0.12, 'sawtooth', 0.03);
    return;
  }

  credits -= 1;
  packsOpened += 1;
  initAudio();
  beep(300, 0.05, 'triangle', 0.03);
  beep(520, 0.08, 'triangle', 0.025);

  const pulls = [weightedDraw(), weightedDraw(), weightedDraw()];
  const lines = [];

  pulls.forEach((sticker) => {
    const wasNew = !owned.has(sticker.id);
    owned.add(sticker.id);
    adjustInventory(sticker.id, 1);

    if (!wasNew) {
      sparkle += rarityBonus[sticker.rarity];
    }

    lines.push(`${sticker.icon} ${sticker.name} (${rarityTag(sticker.rarity)}${wasNew ? ', NEW' : ''})`);

    if (sticker.rarity === 'holo') {
      beep(980, 0.08, 'square', 0.03);
      beep(1240, 0.09, 'triangle', 0.025);
    }
  });

  packResultEl.innerHTML = lines.join('<br>');

  const best = Number(localStorage.getItem(BEST_KEY) || 0);
  if (sparkle > best) {
    localStorage.setItem(BEST_KEY, String(sparkle));
  }

  if (owned.size === stickers.length) {
    setMessage('Full set complete! Neon legend status unlocked.');
  } else {
    setMessage('Pack opened. Place stickers in your album spread.');
  }

  syncHud();
  renderInventory();
}

function clearAlbum() {
  let returned = 0;
  for (let i = 0; i < albumSlots.length; i += 1) {
    const id = albumSlots[i];
    if (id) {
      adjustInventory(id, 1);
      albumSlots[i] = null;
      returned += 1;
    }
  }
  renderInventory();
  renderAlbum();
  setMessage(returned ? `Cleared page, returned ${returned} stickers.` : 'Album page already empty.');
  initAudio();
  beep(returned ? 420 : 220, 0.08, returned ? 'triangle' : 'sawtooth', 0.025);
}

openPackBtn.addEventListener('click', openPack);
clearBtn.addEventListener('click', clearAlbum);

syncHud();
renderInventory();
renderAlbum();
setMessage('Select a sticker from the tray.');
