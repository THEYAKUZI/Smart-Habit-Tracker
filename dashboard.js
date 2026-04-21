// ── Theme ─────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('cadence-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? null : 'dark';
  if (next) {
    document.documentElement.dataset.theme = next;
    localStorage.setItem('cadence-theme', next);
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem('cadence-theme');
  }
});

// ── Auth gate + user state ────────────────────────────────────
const token = localStorage.getItem('cadence-token');
if (!token) { window.location.href = 'index.html'; }

let currentUser = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('cadence-token');
    localStorage.removeItem('cadence-user');
    window.location.href = 'index.html';
    throw new Error('Session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadUser() {
  const { user } = await api('/api/me');
  currentUser = user;
  paintUser();
  if (!currentUser.avatar) {
    openAvatarModal({ firstTime: true });
  }
}

function paintUser() {
  if (!currentUser) return;
  document.getElementById('userName').textContent = currentUser.name;
  document.getElementById('userAvatar').innerHTML = renderAvatar(currentUser.avatar);
  const handleEl = document.querySelector('.user-handle');
  if (handleEl) handleEl.textContent = currentUser.username ? '@' + currentUser.username : currentUser.email;

  const xpIntoLevel = currentUser.xp % 500;
  const pct = Math.min((xpIntoLevel / 500) * 100, 100);
  document.querySelector('.xp-level').textContent = `Lv. ${currentUser.level}`;
  document.querySelector('.xp-row .xp-fill').style.width = pct + '%';
  document.getElementById('xpCount').textContent = `${currentUser.xp} XP`;

  document.getElementById('greetingTitle').textContent =
    `Good ${hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'}, ${currentUser.name.split(' ')[0]}.`;
}

// ── Avatar rendering ──────────────────────────────────────────
const AVATAR_BG = {
  lime:   '#B9F23C',
  blue:   '#6FCFE7',
  pink:   '#E78FB8',
  orange: '#E78F5B',
  purple: '#9B8FE7',
  dark:   '#3C3F38',
};
const AVATAR_HAIR_COLOR = {
  black:  '#1A1A1A',
  brown:  '#5A3A1A',
  blonde: '#E8C770',
  red:    '#B74A1F',
  white:  '#E8E8E8',
  lime:   '#7AA52B',
};
const AVATAR_OUTFIT = {
  lime:   '#B9F23C',
  red:    '#D85555',
  blue:   '#5599D8',
  purple: '#9B7BD8',
  orange: '#E8945A',
  gray:   '#4A4D44',
};
const AVATAR_SKIN = {
  light:  '#F5D6B8',
  tan:    '#E0B690',
  medium: '#C89268',
  dark:   '#8A5A3A',
};
const AVATAR_HAIR_STYLE = ['short','long','bun','afro','mohawk','bald'];

const AVATAR_DEFAULT = {
  bg: 'lime', hair: 'short', hairColor: 'brown', outfit: 'lime', skin: 'light'
};

function hairSvg(style, color) {
  switch (style) {
    case 'short':
      return `<path d="M28 36 Q30 18 50 18 Q70 18 72 36 L72 44 Q72 36 65 34 Q58 32 50 32 Q42 32 35 34 Q28 36 28 44 Z" fill="${color}" />`;
    case 'long':
      return `<path d="M24 36 Q26 18 50 18 Q74 18 76 36 L76 74 L70 74 L70 42 Q70 36 65 34 Q58 32 50 32 Q42 32 35 34 Q30 36 30 42 L30 74 L24 74 Z" fill="${color}" />`;
    case 'bun':
      return `<circle cx="50" cy="14" r="9" fill="${color}" /><path d="M30 38 Q32 22 50 22 Q68 22 70 38 L70 44 Q70 36 65 34 Q58 32 50 32 Q42 32 35 34 Q30 36 30 44 Z" fill="${color}" />`;
    case 'afro':
      return `<circle cx="50" cy="32" r="26" fill="${color}" />`;
    case 'mohawk':
      return `<path d="M44 10 L56 10 L56 40 L44 40 Z" fill="${color}" />`;
    case 'bald':
    default:
      return '';
  }
}

function renderAvatar(cfg) {
  const c = { ...AVATAR_DEFAULT, ...(cfg || {}) };
  const bg      = c.bg === '__swatch' ? SWATCH_BG : (AVATAR_BG[c.bg] || AVATAR_BG.lime);
  const hc      = AVATAR_HAIR_COLOR[c.hairColor] || AVATAR_HAIR_COLOR.brown;
  const outfit  = AVATAR_OUTFIT[c.outfit]       || AVATAR_OUTFIT.lime;
  const skin    = AVATAR_SKIN[c.skin]           || AVATAR_SKIN.light;
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="50" r="50" fill="${bg}" />
      <rect x="18" y="80" width="64" height="20" fill="${outfit}" />
      <path d="M42 68 L58 68 L58 82 L42 82 Z" fill="${skin}" />
      <circle cx="50" cy="50" r="21" fill="${skin}" />
      ${hairSvg(c.hair, hc)}
      <circle cx="43" cy="50" r="1.8" fill="#1a1a1a" />
      <circle cx="57" cy="50" r="1.8" fill="#1a1a1a" />
      <path d="M45 58 Q50 61 55 58" stroke="#1a1a1a" fill="none" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  `;
}

// ── Avatar creator ────────────────────────────────────────────
const avatarModal = document.getElementById('avatarModal');
let avatarDraft = { ...AVATAR_DEFAULT };
let avatarFirstTime = false;

const SWATCH_BG = '#2A2D27'; // neutral backdrop for non-bg swatches

function swatchMarkup(cat, opt) {
  if (cat === 'bg') {
    return `<span style="display:block;width:100%;height:100%;background:${AVATAR_BG[opt]};"></span>`;
  }
  return renderAvatar({ ...avatarDraft, [cat]: opt, bg: '__swatch' });
}

function renderAvatarOptions() {
  const map = {
    bg:        Object.keys(AVATAR_BG),
    hair:      AVATAR_HAIR_STYLE,
    hairColor: Object.keys(AVATAR_HAIR_COLOR),
    outfit:    Object.keys(AVATAR_OUTFIT),
    skin:      Object.keys(AVATAR_SKIN),
  };
  for (const [cat, opts] of Object.entries(map)) {
    const wrap = avatarModal.querySelector(`.avatar-options[data-category="${cat}"]`);
    wrap.innerHTML = '';
    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'avatar-swatch' + (avatarDraft[cat] === opt ? ' active' : '');
      btn.innerHTML = swatchMarkup(cat, opt);
      btn.addEventListener('click', () => {
        avatarDraft[cat] = opt;
        document.getElementById('avatarPreview').innerHTML = renderAvatar(avatarDraft);
        renderAvatarOptions();
      });
      wrap.appendChild(btn);
    });
  }
}

function openAvatarModal({ firstTime = false } = {}) {
  avatarFirstTime = firstTime;
  avatarDraft = currentUser?.avatar ? { ...AVATAR_DEFAULT, ...currentUser.avatar } : { ...AVATAR_DEFAULT };

  document.getElementById('avatarTitle').textContent = firstTime ? 'Create avatar' : 'Customize';
  document.getElementById('avatarSub').textContent = '';
  document.getElementById('avatarClose').classList.toggle('hidden', firstTime);

  document.getElementById('avatarPreview').innerHTML = renderAvatar(avatarDraft);
  renderAvatarOptions();
  avatarModal.classList.add('open');
}

function closeAvatarModal() {
  if (avatarFirstTime) return;
  avatarModal.classList.remove('open');
}

document.getElementById('avatarClose').addEventListener('click', closeAvatarModal);
avatarModal.addEventListener('click', e => { if (e.target === avatarModal) closeAvatarModal(); });

document.getElementById('customizeAvatarBtn').addEventListener('click', () => {
  popover.classList.remove('open');
  openAvatarModal({ firstTime: false });
});

document.getElementById('avatarSave').addEventListener('click', async () => {
  const btn = document.getElementById('avatarSave');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const { user } = await api('/api/me/avatar', {
      method: 'PATCH',
      body: JSON.stringify({ avatar: avatarDraft })
    });
    currentUser = user;
    paintUser();
    avatarFirstTime = false;
    avatarModal.classList.remove('open');
    showToast('Avatar saved', 'Looking sharp.');
    // Refresh leaderboard so it picks up the new avatar
    if (document.getElementById('section-leaderboard').classList.contains('active')) loadLeaderboard();
  } catch (err) {
    showToast('Couldn\'t save avatar', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save avatar';
  }
});

// ── Habits (still local for now) ─────────────────────────────
// One-time wipe of the old seeded habits from earlier builds
if (!localStorage.getItem('cadence-habits-v2')) {
  localStorage.removeItem('cadence-habits');
  localStorage.setItem('cadence-habits-v2', '1');
}
let habits = JSON.parse(localStorage.getItem('cadence-habits')) || [];

// Migrate older habits that don't yet have a time-of-day.
{
  let dirty = false;
  habits.forEach(h => { if (!h.time) { h.time = '09:00'; dirty = true; } });
  if (dirty) localStorage.setItem('cadence-habits', JSON.stringify(habits));
}

// ── Date & greeting ───────────────────────────────────────────
const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const now    = new Date();
const hours  = now.getHours();
const greeting = hours < 12 ? 'Good morning.' : hours < 18 ? 'Good afternoon.' : 'Good evening.';

document.getElementById('todayDate').textContent =
  `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;
document.getElementById('greetingTitle').textContent = greeting;

// ── Navigation ────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    item.classList.add('active');
    const id = 'section-' + item.dataset.section;
    document.getElementById(id)?.classList.add('active');
    if (item.dataset.section === 'leaderboard') loadLeaderboard();
    if (item.dataset.section === 'stats')       renderStats();
    if (item.dataset.section === 'insights')    loadInsights();
    if (item.dataset.section === 'today')     { showTodayNudge(); scrollToNow(); }
    else                                        hideTodayNudge();
  });
});

// ── Leaderboard ───────────────────────────────────────────────
async function loadLeaderboard() {
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<div class="lb-loading">Loading…</div>';
  try {
    const { users, me } = await api('/api/leaderboard');
    if (!users.length) {
      list.innerHTML = '<div class="lb-empty">No one on the board yet.</div>';
      return;
    }
    list.innerHTML = '';
    users.forEach((u, i) => {
      const rank = i + 1;
      const row = document.createElement('div');
      const classes = ['lb-row'];
      if (u.id === me) classes.push('me');
      if (rank <= 3) classes.push(`top-${rank}`);
      row.className = classes.join(' ');
      row.innerHTML = `
        <span class="lb-rank">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank}</span>
        <div class="lb-avatar">${renderAvatar(u.avatar)}</div>
        <div class="lb-info">
          <div class="lb-name">${u.name}${u.id === me ? ' (you)' : ''}</div>
          <div class="lb-handle">@${u.username}</div>
        </div>
        <span class="lb-level">Lv. ${u.level}</span>
        <span class="lb-xp">${u.xp.toLocaleString()} XP</span>
      `;
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<div class="lb-empty">Couldn't load: ${err.message}</div>`;
  }
}

document.getElementById('refreshLeaderboard').addEventListener('click', loadLeaderboard);
document.getElementById('refreshInsights').addEventListener('click', () => loadInsights({ force: true }));

// ── Habit list ────────────────────────────────────────────────
function save() { localStorage.setItem('cadence-habits', JSON.stringify(habits)); }

// ── Check-in log (real data for stats + AI) ──────────────────
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadCheckins() {
  try { return JSON.parse(localStorage.getItem('cadence-checkins')) || []; }
  catch { return []; }
}
function saveCheckins(list) {
  localStorage.setItem('cadence-checkins', JSON.stringify(list));
}
function addCheckin(habit) {
  const list = loadCheckins();
  list.push({
    habitId: habit.id,
    habitName: habit.name,
    emoji: habit.emoji,
    ts: new Date().toISOString()
  });
  saveCheckins(list);
}
function removeLatestCheckinToday(habit) {
  const list = loadCheckins();
  const todayStr = toLocalDateStr(new Date());
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].habitId === habit.id && toLocalDateStr(new Date(list[i].ts)) === todayStr) {
      list.splice(i, 1);
      break;
    }
  }
  saveCheckins(list);
}

async function syncXP(newXp) {
  if (!currentUser) return;
  const prevLevel = currentUser.level;
  try {
    const { user } = await api('/api/me/xp', {
      method: 'PATCH',
      body: JSON.stringify({ xp: newXp })
    });
    currentUser = user;
    // Update level + bar width, but leave xpCount to the count-up animation
    document.querySelector('.xp-level').textContent = `Lv. ${user.level}`;
    const pct = Math.min(((user.xp % 500) / 500) * 100, 100);
    document.querySelector('.xp-row .xp-fill').style.width = pct + '%';

    if (user.level > prevLevel) showLevelUp(user.level);
  } catch (err) {
    console.error('XP sync failed:', err);
  }
}

// ── XP animations ─────────────────────────────────────────────
function showXpFloat(delta) {
  const anchor = document.querySelector('.xp-row');
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const float = document.createElement('div');
  float.className = 'xp-float' + (delta < 0 ? ' negative' : '');
  float.textContent = (delta > 0 ? '+' : '') + delta + ' XP';
  float.style.left = rect.left + 'px';
  float.style.top  = (rect.top - 4) + 'px';
  document.body.appendChild(float);
  requestAnimationFrame(() => float.classList.add('animate'));
  setTimeout(() => float.remove(), 1100);
}

function showHpFloat(delta) {
  const anchor = document.querySelector('.hp-row');
  if (!anchor) return;
  const rect = anchor.getBoundingClientRect();
  const float = document.createElement('div');
  float.className = 'xp-float' + (delta < 0 ? ' negative' : ' hp-positive');
  float.textContent = (delta > 0 ? '+' : '') + delta + ' HP';
  float.style.left = rect.left + 'px';
  float.style.top  = (rect.top - 4) + 'px';
  document.body.appendChild(float);
  requestAnimationFrame(() => float.classList.add('animate'));
  setTimeout(() => float.remove(), 1100);
}

function flashXpBar() {
  const fill = document.querySelector('.xp-fill');
  fill.classList.remove('flash');
  void fill.offsetWidth;
  fill.classList.add('flash');
}

let xpAnimHandle = null;
function animateXpCount(from, to) {
  const el = document.getElementById('xpCount');
  if (xpAnimHandle) cancelAnimationFrame(xpAnimHandle);
  const duration = 600;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * eased);
    el.textContent = val + ' XP';
    if (p < 1) xpAnimHandle = requestAnimationFrame(tick);
  }
  xpAnimHandle = requestAnimationFrame(tick);
}

function burstCheck(checkEl) {
  checkEl.classList.remove('burst');
  void checkEl.offsetWidth;
  checkEl.classList.add('burst');
}

// ── Sounds ────────────────────────────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, startTime, type = 'sine', peakGain = 0.18) {
  const ctx = getAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playXpSound(delta) {
  if (localStorage.getItem('cadence-mute') === '1') return;
  const ctx = getAudio();
  const t = ctx.currentTime;
  if (delta > 0) {
    playTone(659.25, 0.12, t,          'triangle', 0.18); // E5
    playTone(987.77, 0.18, t + 0.08,   'triangle', 0.22); // B5
  } else {
    playTone(440.00, 0.12, t,          'sine',     0.14); // A4
    playTone(329.63, 0.22, t + 0.08,   'sine',     0.12); // E4
  }
}

function playDamageSound() {
  if (localStorage.getItem('cadence-mute') === '1') return;
  const ctx = getAudio();
  const t = ctx.currentTime;
  playTone(110, 0.2, t, 'square', 0.18);  // A2 thud
  playTone(82,  0.25, t + 0.04, 'sawtooth', 0.1);
}

function playHealSound() {
  if (localStorage.getItem('cadence-mute') === '1') return;
  const ctx = getAudio();
  const t = ctx.currentTime;
  playTone(523.25, 0.08, t, 'sine', 0.08);       // C5
  playTone(783.99, 0.14, t + 0.05, 'sine', 0.1); // G5
}

function playLevelUpSound() {
  if (localStorage.getItem('cadence-mute') === '1') return;
  const ctx = getAudio();
  const t = ctx.currentTime;
  playTone(523.25, 0.14, t,        'triangle', 0.16); // C5
  playTone(659.25, 0.14, t + 0.09, 'triangle', 0.18); // E5
  playTone(783.99, 0.14, t + 0.18, 'triangle', 0.20); // G5
  playTone(1046.5, 0.5,  t + 0.28, 'triangle', 0.22); // C6 sustained
  playTone(783.99, 0.5,  t + 0.28, 'sine',     0.10); // G5 harmony
}

function showLevelUp(newLevel) {
  playLevelUpSound();
  const pop = document.createElement('div');
  pop.className = 'level-up-popup';
  pop.innerHTML = `
    <div class="level-up-inner">
      <div class="level-up-star">★</div>
      <div class="level-up-title">LEVEL UP</div>
      <div class="level-up-sub">You're now Level ${newLevel}</div>
    </div>
  `;
  document.body.appendChild(pop);
  requestAnimationFrame(() => pop.classList.add('show'));
  setTimeout(() => {
    pop.classList.remove('show');
    setTimeout(() => pop.remove(), 400);
  }, 2400);
}

function playDeathSound() {
  if (localStorage.getItem('cadence-mute') === '1') return;
  const ctx = getAudio();
  const t = ctx.currentTime;
  playTone(329.63, 0.25, t,         'sawtooth', 0.2); // E4
  playTone(261.63, 0.25, t + 0.2,   'sawtooth', 0.22); // C4
  playTone(196.00, 0.35, t + 0.4,   'sawtooth', 0.24); // G3
  playTone(130.81, 0.7,  t + 0.7,   'sawtooth', 0.28); // C3
}

// ── HP / Health system ────────────────────────────────────────
const MAX_HP = 100;
const HP_HEAL = 6;
const HP_DAMAGE = 20;

let hp = Math.max(0, Math.min(MAX_HP, parseInt(localStorage.getItem('cadence-hp')) || MAX_HP));
if (hp === 0) hp = MAX_HP;

function saveHp() { localStorage.setItem('cadence-hp', hp); }

function updateHpBar() {
  const fill  = document.getElementById('hpFill');
  const count = document.getElementById('hpCount');
  const pct = (hp / MAX_HP) * 100;
  fill.style.width = pct + '%';
  count.textContent = `${hp} HP`;
  fill.classList.toggle('low',  hp > 0 && hp <= 30);
  fill.classList.toggle('crit', hp > 0 && hp <= 15);
}

function flashHp(kind) {
  const fill = document.getElementById('hpFill');
  fill.classList.remove('hit', 'heal');
  void fill.offsetWidth;
  fill.classList.add(kind);
}

function damage(amount) {
  if (hp <= 0) return;
  hp = Math.max(0, hp - amount);
  saveHp();
  updateHpBar();
  flashHp('hit');
  playDamageSound();

  if (hp === 0) die();
}

function heal(amount) {
  if (hp >= MAX_HP || hp === 0) return;
  hp = Math.min(MAX_HP, hp + amount);
  saveHp();
  updateHpBar();
  flashHp('heal');
  playHealSound();
}

function die() {
  playDeathSound();

  const overlay = document.getElementById('deathOverlay');
  overlay.classList.add('active');

  if (currentUser) {
    const oldXp = currentUser.xp;
    const lostXp = Math.min(oldXp, 500);
    const newXp = Math.max(0, oldXp - lostXp);
    animateXpCount(oldXp, newXp);
    syncXP(newXp);
  }
}

document.getElementById('deathDismiss').addEventListener('click', () => {
  hp = MAX_HP;
  saveHp();
  updateHpBar();
  document.getElementById('deathOverlay').classList.remove('active');
});

function updateProgress() {
  const todays = habitsForToday();
  const done   = todays.filter(h => h.doneToday).length;
  const total  = todays.length;
  const pct    = total ? (done / total) * 100 : 0;

  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = `${done} / ${total} done`;

  const maxStreak = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  document.getElementById('overallStreak').textContent = maxStreak;
}

function habitsForToday() {
  const today = new Date().getDay();
  return habits.filter(h => !h.days || h.days.includes(today));
}

// ── Calendar (week view) ─────────────────────────────────────
const CAL_HOURS = []; // 1, 2, ..., 23  → 1am to 11pm
for (let h = 1; h <= 23; h++) CAL_HOURS.push(h);
const CAL_HOUR_PX  = 60;
const CAL_TOTAL_PX = CAL_HOURS.length * CAL_HOUR_PX;
const CAL_DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

let currentWeekStart = startOfWeek(new Date());
let editingHabitId = null;

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // back to Sunday
  return x;
}
function addDaysTo(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
function parseHHMM(str) {
  if (!str || typeof str !== 'string') return 9 * 60;
  const [h, m] = str.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function formatHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function formatTimeLabel(str) {
  const min = parseHHMM(str);
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h < 12 ? 'am' : 'pm';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2,'0')}${period}`;
}
function eventTopPx(timeStr) {
  return parseHHMM(timeStr) - CAL_HOURS[0] * 60;
}

function renderCalendar() {
  const head  = document.getElementById('calWeekHead');
  const grid  = document.getElementById('calGrid');
  const title = document.getElementById('calTitle');
  if (!head || !grid || !title) return;

  // Title
  const last = addDaysTo(currentWeekStart, 6);
  if (currentWeekStart.getMonth() === last.getMonth() && currentWeekStart.getFullYear() === last.getFullYear()) {
    title.textContent = currentWeekStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  } else {
    const a = currentWeekStart.toLocaleString('en-US', { month: 'short' });
    const b = last.toLocaleString('en-US', { month: 'short' });
    title.textContent = `${a} – ${b} ${last.getFullYear()}`;
  }

  const today = new Date();

  // Week head
  head.innerHTML = '<div class="cal-week-head-cell"></div>';
  for (let i = 0; i < 7; i++) {
    const d = addDaysTo(currentWeekStart, i);
    const isToday = sameDay(d, today);
    const cell = document.createElement('div');
    cell.className = 'cal-week-head-cell' + (isToday ? ' today' : '');
    cell.innerHTML = `${CAL_DAY_SHORT[d.getDay()]} <span class="cal-day-num">${d.getDate()}</span>`;
    head.appendChild(cell);
  }

  // Grid body
  grid.innerHTML = '';

  const hourCol = document.createElement('div');
  hourCol.className = 'cal-hour-col';
  hourCol.style.height = CAL_TOTAL_PX + 'px';
  CAL_HOURS.forEach(h => {
    const lbl = document.createElement('div');
    lbl.className = 'cal-hour-label';
    lbl.textContent = formatTimeLabel(`${String(h).padStart(2,'0')}:00`);
    hourCol.appendChild(lbl);
  });
  grid.appendChild(hourCol);

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < 7; i++) {
    const d = addDaysTo(currentWeekStart, i);
    const isToday = sameDay(d, today);
    const isPast  = d < todayMidnight;
    const dow = d.getDay();
    const col = document.createElement('div');
    col.className = 'cal-day-col' + (isToday ? ' today' : '');
    col.style.height = CAL_TOTAL_PX + 'px';
    col.dataset.dateStr = toLocalDateStr(d);
    col.dataset.dow = String(dow);

    habits.forEach(h => {
      const days = h.days || [0,1,2,3,4,5,6];
      if (!days.includes(dow)) return;
      const isDoneToday = isToday && h.doneToday;
      const block = document.createElement('div');
      block.className = 'cal-event'
        + (isDoneToday ? ' done' : '')
        + (isPast ? ' past' : '')
        + (isToday ? ' today-event' : '');
      block.style.top = eventTopPx(h.time || '09:00') + 'px';
      block.style.height = '50px';
      block.dataset.habitId = h.id;
      block.innerHTML = `
        <span class="cal-event-emoji">${h.emoji}</span>
        <span class="cal-event-name">${escapeHtml(h.name)}</span>
        <span class="cal-event-time">${formatTimeLabel(h.time || '09:00')}</span>
      `;
      block.addEventListener('click', e => {
        e.stopPropagation();
        openEventPop(h, block);
      });
      col.appendChild(block);
    });

    col.addEventListener('click', e => {
      if (e.target.closest('.cal-event')) return;
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minSinceTop = Math.max(0, Math.min(CAL_TOTAL_PX - 30, Math.round(y / 30) * 30));
      const totalMin = CAL_HOURS[0] * 60 + minSinceTop;
      openHabitModal({ day: dow, time: formatHHMM(totalMin) });
    });

    grid.appendChild(col);
  }

  updateNowLine();
  updateProgress();
  initHoverLines();
}

function updateNowLine() {
  document.querySelectorAll('.cal-now-line').forEach(el => el.remove());
  const today = new Date();
  document.querySelectorAll('.cal-day-col').forEach(col => {
    if (col.dataset.dateStr !== toLocalDateStr(today)) return;
    const min = today.getHours() * 60 + today.getMinutes();
    const top = min - CAL_HOURS[0] * 60;
    if (top < 0 || top > CAL_TOTAL_PX) return;
    const line = document.createElement('div');
    line.className = 'cal-now-line';
    line.style.top = top + 'px';
    col.appendChild(line);
  });
}

// ── Hover time indicator ──────────────────────────────────────
function initHoverLines() {
  document.querySelectorAll('.cal-day-col').forEach(col => {
    if (col.querySelector('.cal-hover-line')) return;
    const line = document.createElement('div');
    line.className = 'cal-hover-line';
    col.appendChild(line);

    col.addEventListener('mousemove', e => {
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const snapped = Math.round(y / 15) * 15;
      const clamped = Math.max(0, Math.min(CAL_TOTAL_PX, snapped));
      line.style.top = clamped + 'px';
      const totalMin = CAL_HOURS[0] * 60 + clamped;
      line.dataset.time = formatTimeLabel(formatHHMM(totalMin));
    });
  });
}

function scrollToNow() {
  const scrollEl = document.getElementById('calScroll');
  if (!scrollEl) return;
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes() - CAL_HOURS[0] * 60;
  scrollEl.scrollTop = Math.max(0, min - 200);
}

function prevWeek() { currentWeekStart = addDaysTo(currentWeekStart, -7); renderCalendar(); }
function nextWeek() { currentWeekStart = addDaysTo(currentWeekStart,  7); renderCalendar(); }
function goToToday() {
  currentWeekStart = startOfWeek(new Date());
  renderCalendar();
  scrollToNow();
}

// ── Habit toggle (called from event popover) ─────────────────
function toggleHabitDone(habit) {
  const wasDone = !!habit.doneToday;
  const isDone  = !wasDone;
  const dir     = isDone ? 1 : -1;
  habit.countToday = isDone ? 1 : 0;
  habit.doneToday  = isDone;
  if (!wasDone && isDone)      habit.streak += 1;
  else if (wasDone && !isDone) habit.streak  = Math.max(0, habit.streak - 1);

  if (dir > 0) addCheckin(habit);
  else         removeLatestCheckinToday(habit);

  const delta = dir * 10;
  const oldXp = currentUser?.xp ?? 0;
  const newXp = Math.max(0, oldXp + delta);

  save();
  renderCalendar();

  showXpFloat(delta);
  flashXpBar();
  animateXpCount(oldXp, newXp);
  playXpSound(delta);

  const hpDelta = dir > 0 ? HP_HEAL : -HP_DAMAGE;
  showHpFloat(hpDelta);
  if (dir > 0) heal(HP_HEAL);
  else         damage(HP_DAMAGE);

  syncXP(newXp);
}

// ── Event popover ─────────────────────────────────────────────
function openEventPop(habit, anchorEl) {
  const pop = document.getElementById('calEventPop');
  pop._habitId = habit.id;
  document.getElementById('calEventPopTitle').textContent = `${habit.emoji}  ${habit.name}`;
  document.getElementById('calEventPopMeta').textContent  =
    `${freqLabel(habit.days)} · ${formatTimeLabel(habit.time || '09:00')}`;
  const today = new Date();
  const blockDate = anchorEl.closest('.cal-day-col')?.dataset.dateStr;
  const isToday   = blockDate === toLocalDateStr(today);
  const toggleBtn = document.getElementById('calPopToggle');
  toggleBtn.disabled = !isToday;
  toggleBtn.style.opacity = isToday ? '1' : '0.4';
  toggleBtn.textContent = habit.doneToday ? '↶ Undo today' : '✓ Mark done';

  pop.classList.remove('hidden');
  const rect = anchorEl.getBoundingClientRect();
  const popW = 240, popH = 180;
  let left = rect.right + 8;
  if (left + popW > window.innerWidth - 8) left = rect.left - popW - 8;
  if (left < 8) left = 8;
  let top = rect.top;
  if (top + popH > window.innerHeight - 8) top = window.innerHeight - popH - 8;
  pop.style.left = left + 'px';
  pop.style.top  = top  + 'px';
}

function closeEventPop() {
  document.getElementById('calEventPop').classList.add('hidden');
}

document.getElementById('calPopToggle').addEventListener('click', () => {
  const habit = habits.find(h => h.id === document.getElementById('calEventPop')._habitId);
  if (habit) toggleHabitDone(habit);
  closeEventPop();
});
document.getElementById('calPopEdit').addEventListener('click', () => {
  const habit = habits.find(h => h.id === document.getElementById('calEventPop')._habitId);
  closeEventPop();
  if (habit) openHabitModal({ habit });
});
document.getElementById('calPopDelete').addEventListener('click', () => {
  const habit = habits.find(h => h.id === document.getElementById('calEventPop')._habitId);
  if (habit && confirm(`Delete "${habit.name}"?`)) {
    habits = habits.filter(x => x.id !== habit.id);
    saveCheckins(loadCheckins().filter(c => c.habitId !== habit.id));
    save();
    renderCalendar();
    showTodayNudge();
  }
  closeEventPop();
});
document.addEventListener('click', e => {
  const pop = document.getElementById('calEventPop');
  if (pop.classList.contains('hidden')) return;
  if (pop.contains(e.target) || e.target.closest('.cal-event')) return;
  closeEventPop();
});

// Calendar nav buttons
document.getElementById('calPrev').addEventListener('click', prevWeek);
document.getElementById('calNext').addEventListener('click', nextWeek);
document.getElementById('calToday').addEventListener('click', goToToday);

// ── Add habit modal ──────────────────────────────────────────
let selectedEmoji = '📚';
let selectedFreq  = 'daily';   // 'daily' | 'weekdays' | 'weekends' | 'custom'
let customDays    = [1,2,3,4,5];

function pickEmoji(emoji) {
  selectedEmoji = emoji;
  document.querySelectorAll('.emoji-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.emoji === emoji));
}

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => pickEmoji(btn.dataset.emoji));
});

function pickFreq(freq) {
  selectedFreq = freq;
  document.querySelectorAll('.freq-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.freq === freq));
  document.getElementById('dayPicker').classList.toggle('hidden', freq !== 'custom');
  if (freq === 'custom') renderDayPicker();
}

function renderDayPicker() {
  document.querySelectorAll('.day-btn').forEach(b => {
    const d = parseInt(b.dataset.day);
    b.classList.toggle('active', customDays.includes(d));
  });
}

document.querySelectorAll('.freq-btn').forEach(btn => {
  btn.addEventListener('click', () => pickFreq(btn.dataset.freq));
});

document.querySelectorAll('.day-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = parseInt(btn.dataset.day);
    if (customDays.includes(d)) customDays = customDays.filter(x => x !== d);
    else customDays.push(d);
    renderDayPicker();
  });
});

function daysForFreq(freq) {
  if (freq === 'weekdays') return [1,2,3,4,5];
  if (freq === 'weekends') return [0,6];
  if (freq === 'custom')   return [...customDays].sort();
  return [0,1,2,3,4,5,6];
}

function freqLabel(days) {
  if (!days || days.length === 7) return 'Daily';
  const set = days.slice().sort().join(',');
  if (set === '1,2,3,4,5') return 'Weekdays';
  if (set === '0,6')       return 'Weekends';
  const names = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days.slice().sort().map(d => names[d]).join(', ');
}

const habitModal = document.getElementById('addHabitPanel');

function openHabitModal({ day = null, time = null, habit = null } = {}) {
  editingHabitId = habit?.id || null;
  document.getElementById('habitModalTitle').textContent = habit ? 'Edit habit' : 'New habit';
  document.getElementById('saveHabit').textContent       = habit ? 'Save' : 'Add habit';
  document.getElementById('newHabitName').value          = habit?.name || '';
  pickEmoji(habit?.emoji || '📚');
  document.getElementById('newHabitTime').value          = habit?.time || time || '09:00';

  if (habit) {
    const days = habit.days || [0,1,2,3,4,5,6];
    const sorted = [...days].sort((a,b) => a - b).join(',');
    if (sorted === '0,1,2,3,4,5,6')      pickFreq('daily');
    else if (sorted === '1,2,3,4,5')     pickFreq('weekdays');
    else if (sorted === '0,6')           pickFreq('weekends');
    else { customDays = [...days]; pickFreq('custom'); }
  } else if (day !== null) {
    customDays = [day];
    pickFreq('custom');
  } else {
    customDays = [1,2,3,4,5];
    pickFreq('daily');
  }

  habitModal.classList.add('open');
  setTimeout(() => document.getElementById('newHabitName').focus(), 220);
}

function closeHabitModal() {
  habitModal.classList.remove('open');
  document.getElementById('newHabitName').value = '';
  editingHabitId = null;
}

document.getElementById('addHabitBtn').addEventListener('click', () => openHabitModal());
document.getElementById('cancelHabit').addEventListener('click', closeHabitModal);

habitModal.addEventListener('click', e => {
  if (e.target === habitModal) closeHabitModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && habitModal.classList.contains('open')) closeHabitModal();
});

document.getElementById('saveHabit').addEventListener('click', () => {
  const name = document.getElementById('newHabitName').value.trim();
  if (!name) return document.getElementById('newHabitName').focus();
  const days = daysForFreq(selectedFreq);
  if (!days.length) return;
  const time = document.getElementById('newHabitTime').value || '09:00';

  if (editingHabitId) {
    const h = habits.find(x => x.id === editingHabitId);
    if (h) { h.name = name; h.emoji = selectedEmoji; h.days = days; h.time = time; }
    save();
    renderCalendar();
    closeHabitModal();
    showToast('Habit updated', `${name} — ${freqLabel(days)} at ${formatTimeLabel(time)}`);
    return;
  }

  habits.push({ id: Date.now(), name, emoji: selectedEmoji, days, time, streak: 0, doneToday: false });
  save();
  renderCalendar();
  closeHabitModal();
  showToast('Habit added', `"${name}" — ${freqLabel(days)} at ${formatTimeLabel(time)}`);
  showTodayNudge();
});

document.getElementById('newHabitName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('saveHabit').click();
});

// ── AI Insights (Groq-backed) ────────────────────────────────
const INSIGHT_CACHE_MS = 60 * 60 * 1000; // 1 hour upper bound; also invalidated by state changes

function insightsStateKey() {
  // Anything that should invalidate the cache goes in here.
  const checkins = loadCheckins();
  return `${habits.length}|${checkins.length}|${new Date().toDateString()}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function renderInsightsList(insights) {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '';
  if (!insights?.length) {
    grid.innerHTML = '<div class="lb-empty">Check off a few habits over the next day or two — patterns need a little data to show up.</div>';
    return;
  }
  insights.forEach(i => {
    const row = document.createElement('div');
    row.className = 'insight-row';
    const ctaHtml = i.cta ? `<button class="insight-cta">${escapeHtml(i.cta.label)}</button>` : '';
    row.innerHTML = `
      <span class="insight-tag">${escapeHtml(i.tag)}</span>
      <div>
        <h3>${escapeHtml(i.title)}</h3>
        <p>${escapeHtml(i.body)}</p>
        ${ctaHtml}
      </div>
    `;
    const btn = row.querySelector('.insight-cta');
    if (btn) {
      btn._cta = i.cta;
      btn.addEventListener('click', () => {
        const cta = btn._cta;
        if (cta.action === 'adjust_habit') return applyAdjustHabit(cta);
        if (cta.section) document.querySelector(`.nav-item[data-section="${cta.section}"]`)?.click();
      });
    }
    grid.appendChild(row);
  });
}

async function fetchInsights({ force = false } = {}) {
  const stateKey = insightsStateKey();
  if (!force) {
    const cached = JSON.parse(localStorage.getItem('cadence-insights') || 'null');
    if (cached && cached.key === stateKey && Date.now() - cached.ts < INSIGHT_CACHE_MS) {
      return cached.data;
    }
  }
  const { insights } = await api('/api/insight', {
    method: 'POST',
    body: JSON.stringify({ habits, checkins: loadCheckins() })
  });
  localStorage.setItem('cadence-insights', JSON.stringify({ key: stateKey, ts: Date.now(), data: insights }));
  return insights;
}

async function loadInsights({ force = false } = {}) {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '<div class="lb-loading">Reading the tea leaves…</div>';
  try {
    const insights = await fetchInsights({ force });
    renderInsightsList(insights);
    refreshTodayNudge(insights);
  } catch (err) {
    grid.innerHTML = `<div class="lb-empty">Couldn't generate insights: ${escapeHtml(err.message)}</div>`;
  }
}

// ── AI Nudge (floating, slides in on Today) ──────────────────
let nudgeDismissedKey = null;

function refreshTodayNudge(insights) {
  const nudge   = document.getElementById('aiNudge');
  const textEl  = document.getElementById('aiNudgeText');
  const ctaBtn  = document.getElementById('nudgeCta');
  const top     = insights?.[0];
  if (!top) { nudge.classList.remove('show'); return; }

  textEl.textContent = top.body;
  if (top.cta) {
    ctaBtn.textContent = top.cta.label;
    ctaBtn._cta = top.cta;
    ctaBtn.classList.remove('hidden');
  } else {
    ctaBtn.classList.add('hidden');
    ctaBtn._cta = null;
  }
}

async function showTodayNudge() {
  const nudge = document.getElementById('aiNudge');
  const stateKey = insightsStateKey();
  if (nudgeDismissedKey === stateKey) return;
  try {
    const insights = await fetchInsights();
    if (!insights?.length) return;
    refreshTodayNudge(insights);
    requestAnimationFrame(() => nudge.classList.add('show'));
  } catch {
    // Silent — nudge is a nice-to-have, not a blocker.
  }
}

function hideTodayNudge() {
  document.getElementById('aiNudge').classList.remove('show');
}

document.getElementById('nudgeDismiss').addEventListener('click', () => {
  hideTodayNudge();
  nudgeDismissedKey = insightsStateKey();
});

document.getElementById('nudgeCta').addEventListener('click', e => {
  const cta = e.currentTarget._cta;
  if (!cta) return;
  if (cta.action === 'adjust_habit') {
    applyAdjustHabit(cta);
    return;
  }
  if (cta.section) {
    hideTodayNudge();
    document.querySelector(`.nav-item[data-section="${cta.section}"]`)?.click();
  }
});

function applyAdjustHabit(cta) {
  const habit = habits.find(h => h.id === cta.habitId);
  if (!habit || !Array.isArray(cta.suggestedDays) || !cta.suggestedDays.length) return;
  const oldLabel = freqLabel(habit.days);
  const newLabel = freqLabel(cta.suggestedDays);
  if (!confirm(`Switch ${habit.name}: ${oldLabel} → ${newLabel}?`)) return;
  habit.days = [...cta.suggestedDays].sort((a, b) => a - b);
  save();
  renderCalendar();
  hideTodayNudge();
  showToast('Schedule updated', `${habit.name} → ${newLabel}`);
  // Bust cache + refetch so the nudge reflects the new schedule.
  localStorage.removeItem('cadence-insights');
  showTodayNudge();
}

// ── Stats (computed from the check-in log) ───────────────────
function computeStats() {
  const checkins = loadCheckins();
  const today    = new Date();

  // Group check-ins by local date → Set of habit IDs
  const byDate = {};
  for (const c of checkins) {
    const ds = toLocalDateStr(new Date(c.ts));
    (byDate[ds] ||= new Set()).add(c.habitId);
  }

  // 30-day window: completion rate + active days
  let activeDays = 0, scheduled = 0, completed = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds  = toLocalDateStr(d);
    const dow = d.getDay();
    const set = byDate[ds];
    if (set && set.size) activeDays++;
    for (const h of habits) {
      if (!h.days || h.days.includes(dow)) {
        scheduled++;
        if (set && set.has(h.id)) completed++;
      }
    }
  }

  // This week (Mon..Sun of the current calendar week)
  const weekCounts = [0,0,0,0,0,0,0];
  const dowIdx  = (today.getDay() + 6) % 7; // 0=Mon
  const monday  = new Date(today);
  monday.setDate(today.getDate() - dowIdx);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekCounts[i] = byDate[toLocalDateStr(d)]?.size || 0;
  }

  const longestStreak  = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  const completionRate = scheduled ? Math.round((completed / scheduled) * 100) : null;

  return {
    longestStreak, completionRate, activeDays,
    weekCounts, todayIdx: dowIdx,
    totalCheckins: checkins.length, checkins, byDate
  };
}

function computeAchievements(stats) {
  const earlyBird = stats.checkins.some(c => new Date(c.ts).getHours() < 8);

  let perfectDay = false;
  for (const [ds, set] of Object.entries(stats.byDate)) {
    const [y, m, dd] = ds.split('-').map(Number);
    const dow = new Date(y, m - 1, dd).getDay();
    const scheduledThatDay = habits.filter(h => !h.days || h.days.includes(dow));
    if (scheduledThatDay.length && scheduledThatDay.every(h => set.has(h.id))) {
      perfectDay = true;
      break;
    }
  }

  return [
    { icon: '🔥', title: 'On Fire',      desc: '7-day streak',                    unlocked: stats.longestStreak >= 7 },
    { icon: '🌅', title: 'Early Bird',   desc: 'Complete a habit before 8 AM',    unlocked: earlyBird },
    { icon: '💯', title: 'Perfect Day',  desc: 'All habits done in one day',      unlocked: perfectDay },
    { icon: '🏔️', title: 'Summit',       desc: '30-day streak',                   unlocked: stats.longestStreak >= 30 },
    { icon: '⚡', title: 'Unstoppable',  desc: '100 habits completed',            unlocked: stats.totalCheckins >= 100 },
  ];
}

function renderStats() {
  const stats = computeStats();

  document.getElementById('statLongestStreak').textContent = stats.longestStreak;
  document.getElementById('statCompletionRate').textContent =
    stats.completionRate === null ? '—' : `${stats.completionRate}%`;
  document.getElementById('statActiveDays').textContent = stats.activeDays;

  const labels   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const max      = Math.max(1, ...stats.weekCounts);
  const barsEl   = document.getElementById('chartBars');
  const labelsEl = document.getElementById('chartLabels');
  barsEl.innerHTML = labelsEl.innerHTML = '';

  stats.weekCounts.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar' + (i === stats.todayIdx ? ' today' : '');
    bar.style.height = `${(v / max) * 100}%`;
    bar.title = `${v} check-in${v === 1 ? '' : 's'}`;
    barsEl.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.className = 'chart-day';
    lbl.textContent = labels[i];
    labelsEl.appendChild(lbl);
  });

  const achList = document.getElementById('achList');
  achList.innerHTML = '';
  computeAchievements(stats).forEach(a => {
    const row = document.createElement('div');
    row.className = 'ach-item' + (a.unlocked ? ' unlocked' : '');
    row.innerHTML = `
      <span class="ach-icon">${a.icon}</span>
      <div><strong>${a.title}</strong><p>${a.desc}</p></div>
      <span class="${a.unlocked ? 'ach-check' : 'ach-lock'}">${a.unlocked ? '✓' : '—'}</span>
    `;
    achList.appendChild(row);
  });
}

// ── Settings popover ─────────────────────────────────────────
const userBar = document.getElementById('userBar');
const popover = document.getElementById('settingsPopover');

userBar.addEventListener('click', e => {
  if (e.target.closest('#themeToggle')) return;
  popover.classList.toggle('open');
  if (popover.classList.contains('open') && currentUser) {
    document.getElementById('inputDisplayName').value = currentUser.name;
    document.getElementById('inputEmail').value       = currentUser.email;
  }
});

document.addEventListener('click', e => {
  if (!popover.contains(e.target) && !userBar.contains(e.target)) {
    popover.classList.remove('open');
  }
});

function showView(id) {
  document.querySelectorAll('.settings-view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

document.querySelectorAll('[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const map = { displayName: 'settingsDisplayName', email: 'settingsEmail', password: 'settingsPassword' };
    showView(map[btn.dataset.view]);
  });
});

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.back));
});

function showSettingsError(viewId, message) {
  const view = document.getElementById(viewId);
  view.querySelectorAll('.settings-error').forEach(e => e.remove());
  const err = document.createElement('p');
  err.className = 'settings-error';
  err.textContent = message;
  view.appendChild(err);
  setTimeout(() => err.remove(), 3000);
}

document.getElementById('saveDisplayName').addEventListener('click', async () => {
  const val = document.getElementById('inputDisplayName').value.trim();
  if (!val) return;
  const prev = currentUser?.name;
  try {
    const { user } = await api('/api/me/name', {
      method: 'PATCH',
      body: JSON.stringify({ name: val })
    });
    currentUser = user;
    paintUser();
    showSuccess();
    showToast('Display name updated', prev && prev !== user.name ? `${prev} → ${user.name}` : `Now showing as ${user.name}`);
  } catch (err) {
    showSettingsError('settingsDisplayName', err.message);
    showToast('Couldn\'t update name', err.message, 'error');
  }
});

document.getElementById('saveEmail').addEventListener('click', async () => {
  const val = document.getElementById('inputEmail').value.trim();
  if (!val || !val.includes('@')) return;
  try {
    const { user } = await api('/api/me/email', {
      method: 'PATCH',
      body: JSON.stringify({ email: val })
    });
    currentUser = user;
    paintUser();
    showSuccess();
    showToast('Email changed', `Sign in with ${user.email} from now on.`);
  } catch (err) {
    showSettingsError('settingsEmail', err.message);
    showToast('Couldn\'t update email', err.message, 'error');
  }
});

document.getElementById('savePassword').addEventListener('click', async () => {
  const current = document.getElementById('inputCurrentPass').value;
  const next    = document.getElementById('inputNewPass').value;
  if (!current || next.length < 8) {
    showSettingsError('settingsPassword', 'New password needs 8+ characters');
    return;
  }
  try {
    await api('/api/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword: current, newPassword: next })
    });
    document.getElementById('inputCurrentPass').value = '';
    document.getElementById('inputNewPass').value = '';
    showSuccess();
    showToast('Password changed', 'Use your new password next time you sign in.');
  } catch (err) {
    showSettingsError('settingsPassword', err.message);
    showToast('Couldn\'t change password', err.message, 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('cadence-token');
  localStorage.removeItem('cadence-user');
  window.location.href = 'index.html';
});

function showSuccess() {
  popover.classList.remove('open');
  setTimeout(() => showView('settingsMain'), 200);
}

// ── Toasts ────────────────────────────────────────────────────
function showToast(title, sub, kind = 'success') {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = 'toast' + (kind === 'error' ? ' error' : '');
  toast.innerHTML = `
    <div class="toast-icon">${kind === 'error' ? '!' : '✓'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${sub ? `<div class="toast-sub">${sub}</div>` : ''}
    </div>
  `;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

// ── Init ──────────────────────────────────────────────────────
// Drop check-ins for habits that no longer exist (cleanup from older builds).
{
  const ids = new Set(habits.map(h => h.id));
  const before = loadCheckins();
  const after  = before.filter(c => ids.has(c.habitId));
  if (after.length !== before.length) {
    saveCheckins(after);
    localStorage.removeItem('cadence-insights');
  }
}

renderCalendar();
scrollToNow();
setInterval(updateNowLine, 60 * 1000);
renderStats();
updateHpBar();
loadUser().catch(err => console.error('Load user failed:', err));
setTimeout(() => showTodayNudge(), 800);
