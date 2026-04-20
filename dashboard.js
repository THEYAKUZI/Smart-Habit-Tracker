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

// ── Data ──────────────────────────────────────────────────────
let habits = JSON.parse(localStorage.getItem('cadence-habits')) || [
  { id: 1, name: 'Morning run',       emoji: '🏃', streak: 14, doneToday: false },
  { id: 2, name: 'Read 20 minutes',   emoji: '📚', streak: 6,  doneToday: false },
  { id: 3, name: 'Meditate',          emoji: '🧘', streak: 9,  doneToday: false },
  { id: 4, name: 'Drink 2L water',    emoji: '💧', streak: 3,  doneToday: false },
  { id: 5, name: 'No screens at 9pm', emoji: '🛌', streak: 2,  doneToday: false },
];

let xp = parseInt(localStorage.getItem('cadence-xp') || '320');

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
function saveXP() { localStorage.setItem('cadence-xp', xp); }

function updateProgress() {
  const done  = habits.filter(h => h.doneToday).length;
  const total = habits.length;
  const pct   = total ? (done / total) * 100 : 0;

  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = `${done} / ${total} done`;
  document.getElementById('xpCount').textContent       = `${xp} XP`;
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
      xp += h.doneToday ? 10 : -10;
      if (xp < 0) xp = 0;
      save(); saveXP();
      renderHabits(); renderCards();
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

document.getElementById('saveDisplayName').addEventListener('click', () => {
  const val = document.getElementById('inputDisplayName').value.trim();
  if (!val) return;
  document.getElementById('userName').textContent   = val;
  document.getElementById('userAvatar').textContent = val.charAt(0).toUpperCase();
  document.getElementById('greetingTitle').textContent = `Good ${hours < 12 ? 'morning' : hours < 18 ? 'afternoon' : 'evening'}, ${val}.`;
  showSuccess();
});

document.getElementById('saveEmail').addEventListener('click', () => {
  const val = document.getElementById('inputEmail').value.trim();
  if (!val || !val.includes('@')) return;
  showSuccess();
});

document.getElementById('savePassword').addEventListener('click', () => {
  if (document.getElementById('inputCurrentPass').value !== 'admin') return;
  if (document.getElementById('inputNewPass').value.length < 4) return;
  showSuccess();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
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
