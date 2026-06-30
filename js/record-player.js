const deck  = document.getElementById('playerDeck');
const audio = document.getElementById('playerAudio');
const btn   = document.getElementById('playerBtn');
const icon  = document.getElementById('playerIcon');

let isPlaying = false;
let pendingTimers = [];

function clearTimers() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers = [];
}

function startPlaying() {
  clearTimers();
  icon.textContent = '■';
  isPlaying = true;

  // Step 1: record drops onto deck
  deck.classList.add('record-on');

  // Step 2: tonearm swings in
  pendingTimers.push(setTimeout(() => {
    deck.classList.add('tonearm-on');
  }, 500));

  // Step 3: record spins and music starts (tonearm done at ~2000ms, 1s pause after)
  pendingTimers.push(setTimeout(() => {
    deck.classList.add('is-playing');
    audio.play().catch(err => console.log('Audio play failed:', err));
  }, 3000));
}

function stopPlaying() {
  clearTimers();
  icon.textContent = '▶';
  isPlaying = false;

  // Step 1: record stops spinning
  deck.classList.remove('is-playing');
  audio.pause();

  // Step 2: tonearm lifts off
  pendingTimers.push(setTimeout(() => {
    deck.classList.remove('tonearm-on');
  }, 300));

  // Step 3: record lifts off (after tonearm has returned)
  pendingTimers.push(setTimeout(() => {
    deck.classList.remove('record-on');
  }, 1900));
}

btn.addEventListener('click', () => {
  if (isPlaying) { stopPlaying(); } else { startPlaying(); }
});

deck.addEventListener('click', () => {
  if (isPlaying) { stopPlaying(); } else { startPlaying(); }
});

const albums = document.querySelectorAll('.player__album');

audio.addEventListener('play', () => {
  albums.forEach((a, i) => {
    a.style.borderLeft = i === 0 ? '2px solid var(--color-accent)' : '';
  });
});

audio.addEventListener('pause', () => {
  albums.forEach(a => { a.style.borderLeft = ''; });
});
