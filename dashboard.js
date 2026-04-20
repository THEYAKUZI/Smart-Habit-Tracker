// ── Theme ─────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('cadence-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

document.getElementById('themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? null : 'light';
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
}

function paintUser() {
  if (!currentUser) return;
  document.getElementById('userName').textContent   = currentUser.name;
  document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  const handleEl = document.querySelector('.user-handle');
  if (handleEl) handleEl.textContent = currentUser.username ? '@' + currentUser.username : currentUser.email;

  const xpIntoLevel = currentUser.xp % 500;
  const pct = Math.min((xpIntoLevel / 500) * 100, 100);
  document.querySelector('.xp-level').textContent = `Lv. ${currentUser.level}`;
  document.querySelector('.xp-fill').style.width  = pct + '%';
  document.getElementById('xpCount').textContent  = `${currentUser.xp} XP`;

  document.getElementById('greetingTitle').textContent =
    `Good ${hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'}, ${currentUser.name.split(' ')[0]}.`;
}

// ── Habits (still local for now) ─────────────────────────────
let habits = JSON.parse(localStorage.getItem('cadence-habits')) || [
  { id: 1, name: 'Morning run',       emoji: '🏃', streak: 14, doneToday: false },
  { id: 2, name: 'Read 20 minutes',   emoji: '📚', streak: 6,  doneToday: false },
  { id: 3, name: 'Meditate',          emoji: '🧘', streak: 9,  doneToday: false },
  { id: 4, name: 'Drink 2L water',    emoji: '💧', streak: 3,  doneToday: false },
  { id: 5, name: 'No screens at 9pm', emoji: '🛌', streak: 2,  doneToday: false },
];

const aiInsights = [
  { tag: 'Pattern detected',  title: 'You skip workouts on Tuesdays',       body: 'Your completion rate for Morning Run on Tuesdays is 28% — vs 81% on other days. Try shifting it to 7 AM. Your early-morning success rate is 3× higher.' },
  { tag: 'Streak at risk',    title: 'Meditation streak might break today',  body: 'You usually complete Meditate before 10 AM. It\'s past your typical window. A 5-minute session still counts — don\'t let the 9-day streak go.' },
  { tag: 'Goal adjustment',   title: 'Water goal is consistently hit',       body: 'You\'ve hit your 2L water goal 13 out of the last 14 days. Consider bumping it to 2.5L — your habit is solid enough to handle a new challenge.' },
  { tag: 'Best time insight', title: 'Reading is most consistent after dinner', body: 'Your read habit has a 94% completion rate when logged between 7–9 PM. That window is your sweet spot.' },
];

const nudges = [
  'You\'re halfway through today. Three habits left for a perfect day.',
  'Your streak is the longest it\'s been in 2 months. Protect it.',
  'You tend to be most productive before noon. Front-load the harder habits.',
];

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
  });
});

// ── Habit list ────────────────────────────────────────────────
function save() { localStorage.setItem('cadence-habits', JSON.stringify(habits)); }

async function syncXP(newXp) {
  if (!currentUser) return;
  try {
    const { user } = await api('/api/me/xp', {
      method: 'PATCH',
      body: JSON.stringify({ xp: newXp })
    });
    currentUser = user;
    paintUser();
  } catch (err) {
    console.error('XP sync failed:', err);
  }
}

function updateProgress() {
  const done  = habits.filter(h => h.doneToday).length;
  const total = habits.length;
  const pct   = total ? (done / total) * 100 : 0;

  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = `${done} / ${total} done`;
}

function renderHabits() {
  const list = document.getElementById('habitList');
  list.innerHTML = '';
  habits.forEach(h => {
    const el = document.createElement('div');
    el.className = 'habit-item' + (h.doneToday ? ' done' : '');
    el.innerHTML = `
      <div class="habit-check">${h.doneToday ? '✓' : ''}</div>
      <span class="habit-emoji">${h.emoji}</span>
      <div class="habit-body">
        <div class="habit-name">${h.name}</div>
        <div class="habit-streak">🔥 ${h.streak}-day streak</div>
      </div>
      <span class="habit-xp">+10 XP</span>
    `;
    el.addEventListener('click', () => {
      h.doneToday = !h.doneToday;
      h.streak   += h.doneToday ? 1 : -1;
      if (h.streak < 0) h.streak = 0;

      const delta = h.doneToday ? 10 : -10;
      const newXp = Math.max(0, (currentUser?.xp ?? 0) + delta);
      save();
      renderHabits();
      renderCards();
      syncXP(newXp);
    });
    list.appendChild(el);
  });
  updateProgress();
}

// ── Habit cards ───────────────────────────────────────────────
function renderCards() {
  const grid = document.getElementById('habitCardsGrid');
  grid.innerHTML = '';
  habits.forEach(h => {
    const pct  = Math.min((h.streak / 30) * 100, 100);
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.innerHTML = `
      <span class="habit-card-emoji">${h.emoji}</span>
      <div class="habit-card-name">${h.name}</div>
      <div class="habit-card-streak">🔥 ${h.streak} days</div>
      <div class="habit-card-bar"><div class="habit-card-fill" style="width:${pct}%"></div></div>
    `;
    grid.appendChild(card);
  });
}

// ── Add habit ─────────────────────────────────────────────────
let selectedEmoji = '📚';

document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedEmoji = btn.dataset.emoji;
  });
});

document.getElementById('addHabitBtn').addEventListener('click', () => {
  document.getElementById('addHabitPanel').classList.remove('hidden');
});

document.getElementById('cancelHabit').addEventListener('click', () => {
  document.getElementById('addHabitPanel').classList.add('hidden');
  document.getElementById('newHabitName').value = '';
});

document.getElementById('saveHabit').addEventListener('click', () => {
  const name = document.getElementById('newHabitName').value.trim();
  if (!name) return document.getElementById('newHabitName').focus();
  habits.push({ id: Date.now(), name, emoji: selectedEmoji, streak: 0, doneToday: false });
  save(); renderHabits(); renderCards();
  document.getElementById('addHabitPanel').classList.add('hidden');
  document.getElementById('newHabitName').value = '';
});

// ── AI Insights ───────────────────────────────────────────────
function renderInsights() {
  const grid = document.getElementById('insightsGrid');
  grid.innerHTML = '';
  aiInsights.forEach(i => {
    const row = document.createElement('div');
    row.className = 'insight-row';
    row.innerHTML = `
      <span class="insight-tag">${i.tag}</span>
      <div><h3>${i.title}</h3><p>${i.body}</p></div>
    `;
    grid.appendChild(row);
  });
}

// ── AI Nudge ──────────────────────────────────────────────────
document.getElementById('aiNudgeText').textContent = nudges[Math.floor(Math.random() * nudges.length)];
document.getElementById('nudgeDismiss').addEventListener('click', () => {
  document.getElementById('aiNudge').classList.add('hidden');
});

// ── Week chart ────────────────────────────────────────────────
function renderChart() {
  const vals      = [4, 3, 5, 5, 2, 4, 3];
  const labels    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const todayIdx  = (now.getDay() + 6) % 7;
  const max       = Math.max(...vals);
  const barsEl    = document.getElementById('chartBars');
  const labelsEl  = document.getElementById('chartLabels');
  barsEl.innerHTML = labelsEl.innerHTML = '';

  vals.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar' + (i === todayIdx ? ' today' : '');
    bar.style.height = `${(v / max) * 100}%`;
    barsEl.appendChild(bar);

    const lbl = document.createElement('div');
    lbl.className = 'chart-day';
    lbl.textContent = labels[i];
    labelsEl.appendChild(lbl);
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
  try {
    const { user } = await api('/api/me/name', {
      method: 'PATCH',
      body: JSON.stringify({ name: val })
    });
    currentUser = user;
    paintUser();
    showSuccess();
  } catch (err) {
    showSettingsError('settingsDisplayName', err.message);
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
  } catch (err) {
    showSettingsError('settingsEmail', err.message);
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
  } catch (err) {
    showSettingsError('settingsPassword', err.message);
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('cadence-token');
  localStorage.removeItem('cadence-user');
  window.location.href = 'index.html';
});

function showSuccess() {
  showView('settingsSuccess');
  setTimeout(() => {
    popover.classList.remove('open');
    setTimeout(() => showView('settingsMain'), 200);
  }, 1400);
}

// ── Init ──────────────────────────────────────────────────────
renderHabits();
renderCards();
renderInsights();
renderChart();
loadUser().catch(err => console.error('Load user failed:', err));
