import './style.css';
import { CATEGORIZED_WORDS } from './words.js';

const $ = (id) => document.getElementById(id);
const WORDS = CATEGORIZED_WORDS.flatMap((c) => c.words.map((word) => ({ word, category: c.category })));

const state = {
  players: 4,
  impostors: 1,
  cats: new Set(CATEGORIZED_WORDS.filter((c) => !c.category.includes('18+')).map((c) => c.category)),
  jester: { on: false, p: 5 },
  chaos: { on: false, p: 5 },
  other: false,
  roles: [],
  word: '',
  category: '',
  idx: 0,
  start: 0,
  holding: false,
};

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function pop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

let current = 'screen-setup';
function show(id) {
  if (id === current) return;
  const from = $(current);
  const to = $(id);
  from.classList.add('leaving');
  setTimeout(() => {
    from.classList.remove('active', 'leaving');
    to.classList.add('active');
    current = id;
    window.scrollTo(0, 0);
  }, 200);
}

addEventListener(
  'pointermove',
  (e) => {
    const s = document.documentElement.style;
    s.setProperty('--mx', (e.clientX / innerWidth) * 100 + '%');
    s.setProperty('--my', (e.clientY / innerHeight) * 100 + '%');
  },
  { passive: true }
);

function setError(msg) {
  const el = $('error-msg');
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
  if (msg) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

function setNum(id, v) {
  const el = $(id);
  if (el.textContent !== String(v)) {
    el.textContent = v;
    pop(el);
  }
}

document.querySelectorAll('[data-step]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const [key, d] = btn.dataset.step.split(':');
    const delta = Number(d);
    if (key === 'players') {
      const v = state.players + delta;
      if (v >= 3 && v <= 20) state.players = v;
      if (state.impostors >= state.players) state.impostors = state.players - 1;
    } else {
      const v = state.impostors + delta;
      if (v >= 1 && v < state.players) state.impostors = v;
    }
    setNum('players-count', state.players);
    setNum('impostors-count', state.impostors);
    setError('');
  })
);

const seg = document.querySelector('.seg');
seg.querySelectorAll('button').forEach((b, i) =>
  b.addEventListener('click', () => {
    state.other = b.dataset.mode === 'other';
    seg.dataset.i = i;
    seg.querySelectorAll('button').forEach((x) => {
      const on = x === b;
      x.classList.toggle('on', on);
      x.setAttribute('aria-selected', String(on));
    });
  })
);

function setupFeature(key, id, text) {
  const box = $(id);
  const row = box.querySelector('.row');
  const range = box.querySelector('input');
  const fill = () => range.style.setProperty('--fill', ((range.value - range.min) / (range.max - range.min)) * 100 + '%');
  fill();
  row.addEventListener('click', () => {
    state[key].on = !state[key].on;
    box.classList.toggle('open', state[key].on);
    row.setAttribute('aria-checked', String(state[key].on));
  });
  range.addEventListener('input', () => {
    state[key].p = Number(range.value);
    $(`${key}-val`).textContent = range.value + '%';
    $(`${key}-desc`).textContent = `${range.value}% szans: ${text}`;
    fill();
  });
}
setupFeature('jester', 'f-jester', 'wszyscy to impostorzy!');
setupFeature('chaos', 'f-chaos', 'każdy ma inne hasło!');

function updateBadge() {
  $('cat-badge').textContent = `${state.cats.size} / ${CATEGORIZED_WORDS.length}`;
}

function renderCats() {
  const list = $('cat-list');
  list.replaceChildren();
  CATEGORIZED_WORDS.forEach((cat) => {
    const adult = cat.category.includes('18+');
    const b = h('button', 'cat' + (state.cats.has(cat.category) ? ' on' : '') + (adult ? ' adult' : ''));
    const t = h('span');
    t.append(h('b', '', cat.category));
    if (adult) t.append(h('small', '', 'Pikantne słowa (NSFW)'));
    const sw = h('span', 'switch');
    sw.append(h('i'));
    b.append(t, sw);
    b.addEventListener('click', () => {
      if (state.cats.has(cat.category)) {
        if (state.cats.size > 1) state.cats.delete(cat.category);
      } else state.cats.add(cat.category);
      b.classList.toggle('on', state.cats.has(cat.category));
      updateBadge();
    });
    list.append(b);
  });
}

const sheet = $('sheet-root');
function openSheet() {
  sheet.hidden = false;
  void sheet.offsetWidth;
  sheet.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  sheet.classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => (sheet.hidden = true), 550);
}
$('open-cats').addEventListener('click', openSheet);
['sheet-backdrop', 'sheet-close', 'sheet-done'].forEach((id) => $(id).addEventListener('click', closeSheet));
addEventListener('keydown', (e) => e.key === 'Escape' && !sheet.hidden && closeSheet());

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startGame() {
  if (state.impostors >= state.players) return setError('Musi być co najmniej jeden zwykły gracz!');
  const pool = WORDS.filter((w) => state.cats.has(w.category));
  if (!pool.length) return setError('Wybierz co najmniej jedną kategorię!');
  setError('');

  const pick = pool[Math.floor(Math.random() * pool.length)];
  state.word = pick.word;
  state.category = pick.category;
  state.roles = Array.from({ length: state.players }, () => ({ isImpostor: false, word: state.word }));

  const jester = state.jester.on && Math.random() < state.jester.p / 100;
  const chaos = !jester && state.chaos.on && Math.random() < state.chaos.p / 100;

  if (jester) {
    state.roles.forEach((r) => ((r.isImpostor = true), (r.word = null)));
  } else if (chaos) {
    const words = shuffle([...pool]);
    state.roles.forEach((r, i) => ((r.word = words[i % words.length].word), (r.isChaos = true)));
    state.word = 'TRYB CHAOS';
  } else {
    const candidates = shuffle(
      state.other
        ? Array.from({ length: state.players }, (_, i) => i)
        : Array.from({ length: state.players - 1 }, (_, i) => i + 1)
    ).slice(0, state.impostors);
    if (state.other) {
      const same = pool.filter((w) => w.category === state.category && w.word !== state.word);
      const alts = same.length ? same : pool.filter((w) => w.word !== state.word);
      candidates.forEach((i) => {
        const alt = alts.length ? alts[Math.floor(Math.random() * alts.length)].word : state.word;
        state.roles[i] = { isImpostor: true, isOtherImpostor: true, word: alt };
      });
    } else {
      candidates.forEach((i) => (state.roles[i] = { isImpostor: true, word: null }));
    }
  }

  state.start = Math.floor(Math.random() * state.players);
  state.idx = 0;
  renderPassing();
  show('screen-passing');
}

function renderPassing() {
  $('player-title').textContent = `Gracz ${state.idx + 1}`;
  $('hold-text').textContent = 'PRZYTRZYMAJ, ABY ZOBACZYĆ';
  $('next').classList.remove('show');
  $('next').textContent = state.idx === state.players - 1 ? 'ROZPOCZNIJ DYSKUSJĘ' : 'PRZEKAŻ DALEJ';
  const dots = $('dots');
  dots.replaceChildren();
  for (let i = 0; i < state.players; i++) dots.append(h('i', i < state.idx ? 'done' : i === state.idx ? 'now' : ''));
  $('stack').classList.remove('revealing');
}

function fillRole(role) {
  const L = $('role-layer');
  L.replaceChildren();
  const av = h('div', 'avatar glass-in');
  if (role.isImpostor && !role.isOtherImpostor) {
    av.classList.add('imp');
    av.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
    L.append(av, h('h2', 'imp-title', 'IMPOSTOR'), h('p', 'lead', 'Twoim zadaniem jest wtopić się w tłum. Zgadnij jakie jest hasło!'));
  } else {
    av.classList.add('civ');
    av.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    L.append(av, h('p', 'muted', 'Hasło to:'), h('h2', 'word', role.word));
  }
}

const hold = $('hold');
hold.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  state.holding = true;
  fillRole(state.roles[state.idx]);
  $('stack').classList.add('revealing');
});
function release() {
  if (!state.holding) return;
  state.holding = false;
  $('stack').classList.remove('revealing');
  $('next').classList.add('show');
  $('hold-text').textContent = 'PRZYTRZYMAJ PONOWNIE';
}
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
hold.addEventListener('contextmenu', (e) => e.preventDefault());

$('next').addEventListener('click', () => {
  if (state.idx < state.players - 1) {
    state.idx++;
    renderPassing();
  } else {
    $('starting-player').textContent = `Gracz ${state.start + 1}`;
    show('screen-playing');
  }
});

function burst() {
  const box = $('confetti');
  box.replaceChildren();
  const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#4ade80', '#fbbf24'];
  for (let i = 0; i < 30; i++) {
    const p = h('i');
    p.style.setProperty('--x', (Math.random() * 2 - 1) * 150 + 'px');
    p.style.setProperty('--y', -50 - Math.random() * 170 + 'px');
    p.style.setProperty('--r', Math.random() * 720 - 360 + 'deg');
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.2 + 's';
    box.append(p);
  }
}

function showResult() {
  const isJester = state.roles.every((r) => r.isImpostor);
  const isChaos = state.roles.every((r) => r.isChaos);
  const sub = $('result-subtitle');
  const word = $('result-word');
  const header = $('result-header');
  const list = $('result-list');
  list.replaceChildren();
  list.classList.toggle('col', isChaos);
  sub.style.color = '';
  sub.style.fontWeight = '';
  word.textContent = state.word;

  if (isJester) {
    sub.textContent = 'TRYB JESTER! Wszyscy byli oszustami!';
    sub.style.color = '#f472b6';
    sub.style.fontWeight = '700';
    word.textContent = 'BRAK HASŁA';
    header.textContent = 'Wszyscy gracze:';
    state.roles.forEach((_, i) => {
      const p = h('span', 'pill pink', `Gracz ${i + 1}`);
      p.style.setProperty('--i', i);
      list.append(p);
    });
  } else if (isChaos) {
    sub.textContent = 'TRYB CHAOS! Każdy miał inne hasło!';
    sub.style.color = '#4ade80';
    sub.style.fontWeight = '700';
    word.textContent = 'SZALEŃSTWO';
    header.textContent = 'Hasła graczy:';
    state.roles.forEach((r, i) => {
      const row = h('div', 'chaos-row');
      row.style.setProperty('--i', i);
      row.append(h('b', '', `Gracz ${i + 1}`), h('span', '', r.word));
      list.append(row);
    });
  } else {
    sub.textContent = 'Poprawne hasło to:';
    header.textContent = 'Impostorzy:';
    let n = 0;
    state.roles.forEach((r, i) => {
      if (!r.isImpostor) return;
      const p = h('span', 'pill', r.isOtherImpostor ? `Gracz ${i + 1} (inne hasło: ${r.word})` : `Gracz ${i + 1}`);
      p.style.setProperty('--i', n++);
      list.append(p);
    });
  }
  burst();
  show('screen-result');
}

$('start').addEventListener('click', startGame);
$('show-result').addEventListener('click', showResult);
document.querySelectorAll('[data-reset]').forEach((b) =>
  b.addEventListener('click', () => {
    state.idx = 0;
    show('screen-setup');
  })
);

renderCats();
updateBadge();
