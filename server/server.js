import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT        = process.env.PORT || 3000;
const GROQ_KEY    = process.env.GROQ_API_KEY || '';
const GROQ_MODEL  = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ── AES-256 encryption for PII (emails) ─────────────────────
const ENCRYPT_KEY = process.env.ENCRYPT_KEY || crypto.createHash('sha256').update(JWT_SECRET).digest();
const ALGO = 'aes-256-cbc';

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, ENCRYPT_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(data) {
  const [ivHex, enc] = data.split(':');
  if (!ivHex || !enc) return data; // not encrypted (legacy row)
  try {
    const decipher = crypto.createDecipheriv(ALGO, ENCRYPT_KEY, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(enc, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return data; // plaintext fallback for old rows
  }
}

// Hash email for lookups (can't search encrypted text, so we index a hash)
function emailHash(email) {
  return crypto.createHmac('sha256', JWT_SECRET).update(email.toLowerCase()).digest('hex');
}

// ── DB ────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'cadence.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    level         INTEGER NOT NULL DEFAULT 1,
    xp            INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add username column for existing DBs
const cols = db.prepare('PRAGMA table_info(users)').all();
if (!cols.some(c => c.name === 'username')) {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  const rows = db.prepare('SELECT id, name FROM users').all();
  const upd = db.prepare('UPDATE users SET username = ? WHERE id = ?');
  for (const r of rows) {
    const base = (r.name || `user${r.id}`).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user${r.id}`;
    upd.run(base, r.id);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
}

if (!cols.some(c => c.name === 'avatar')) {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
}
if (!cols.some(c => c.name === 'email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
}
if (!cols.some(c => c.name === 'email_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN email_hash TEXT');
  // Backfill: hash existing plaintext emails
  const rows = db.prepare('SELECT id, email FROM users').all();
  const upd = db.prepare('UPDATE users SET email_hash = ? WHERE id = ?');
  for (const r of rows) upd.run(emailHash(r.email), r.id);
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)');
}

// Verification codes table
db.exec(`
  CREATE TABLE IF NOT EXISTS verification_codes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    code       TEXT    NOT NULL,
    expires_at TEXT    NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createVerificationCode(userId) {
  const code = generateCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  db.prepare('UPDATE verification_codes SET used = 1 WHERE user_id = ? AND used = 0').run(userId);
  db.prepare('INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, ?)').run(userId, code, expires);
  return code;
}

function sendVerificationEmail(email, code) {
  // Placeholder — in production this would call Resend/SendGrid/etc.
  console.log(`[EMAIL] Verification code for ${email}: ${code}`);
}

// ── Validation helpers ────────────────────────────────────────
const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain a letter';
  if (!/[0-9]/.test(pw))    return 'Password must contain a number';
  return null;
}

// ── App ───────────────────────────────────────────────────────
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // allow inline scripts for our SPA
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting on auth endpoints (brute-force prevention)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { error: 'Too many attempts — try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/verify-email', authLimiter);

app.use(express.json());
app.use(express.static(ROOT, { extensions: ['html'] }));

// ── Auth middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function userPublic(row) {
  let avatar = null;
  if (row.avatar) {
    try { avatar = JSON.parse(row.avatar); } catch {}
  }
  return {
    id: row.id, email: decrypt(row.email), username: row.username, name: row.name,
    level: row.level, xp: row.xp, avatar
  };
}

function issueToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Routes ────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, username, email, password } = req.body || {};
  if (!name?.trim() || !username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });

  const uname = username.trim().toLowerCase();
  if (!USERNAME_RE.test(uname)) {
    return res.status(400).json({ error: 'Username must be 3–20 chars (letters, numbers, underscore)' });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const mail = email.trim().toLowerCase();
  const mailHash = emailHash(mail);
  if (db.prepare('SELECT id FROM users WHERE email_hash = ?').get(mailHash)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const encryptedEmail = encrypt(mail);
  const info = db.prepare(
    'INSERT INTO users (email, email_hash, username, password_hash, name) VALUES (?, ?, ?, ?, ?)'
  ).run(encryptedEmail, mailHash, uname, hash, name.trim());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const code = createVerificationCode(user.id);
  sendVerificationEmail(mail, code);

  res.json({ token: issueToken(user), user: userPublic(user), requiresVerification: true, devCode: code });
});

app.post('/api/verify-email', auth, (req, res) => {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid code' });
  }

  const row = db.prepare(
    'SELECT * FROM verification_codes WHERE user_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
  ).get(req.user.uid);

  if (!row) return res.status(400).json({ error: 'No pending code — request a new one' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Code expired — request a new one' });
  }
  if (row.code !== code.trim()) {
    return res.status(400).json({ error: 'Wrong code' });
  }

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id);
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(req.user.uid);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ ok: true, user: userPublic(user) });
});

app.post('/api/resend-code', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email_verified) return res.json({ ok: true, message: 'Already verified' });

  const code = createVerificationCode(user.id);
  sendVerificationEmail(decrypt(user.email), code);
  res.json({ ok: true, devCode: code });
});

app.post('/api/login', async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const id = (identifier || email || '').trim().toLowerCase();
  if (!id || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = id.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email_hash = ?').get(emailHash(id))
    : db.prepare('SELECT * FROM users WHERE username = ?').get(id);
  if (!user) return res.status(401).json({ error: 'Incorrect credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect credentials' });

  res.json({ token: issueToken(user), user: userPublic(user) });
});

app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: userPublic(user) });
});

app.patch('/api/me/name', auth, (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.uid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: userPublic(user) });
});

app.patch('/api/me/email', auth, (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const newHash = emailHash(email.toLowerCase());
  const existing = db.prepare('SELECT id FROM users WHERE email_hash = ? AND id != ?')
    .get(newHash, req.user.uid);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  db.prepare('UPDATE users SET email = ?, email_hash = ? WHERE id = ?')
    .run(encrypt(email.toLowerCase()), newHash, req.user.uid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: userPublic(user) });
});

app.patch('/api/me/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields' });

  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is wrong' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.uid);
  res.json({ ok: true });
});

app.get('/api/leaderboard', auth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, username, name, level, xp, avatar FROM users ORDER BY xp DESC, id ASC LIMIT 50'
  ).all().map(r => ({
    ...r,
    avatar: r.avatar ? (() => { try { return JSON.parse(r.avatar); } catch { return null; } })() : null
  }));
  res.json({ users: rows, me: req.user.uid });
});

app.patch('/api/me/avatar', auth, (req, res) => {
  const { avatar } = req.body || {};
  if (!avatar || typeof avatar !== 'object') return res.status(400).json({ error: 'Invalid avatar' });
  const allowed = ['bg','hair','hairColor','outfit','skin'];
  const clean = {};
  for (const k of allowed) {
    if (typeof avatar[k] === 'string' && avatar[k].length < 20) clean[k] = avatar[k];
  }
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(JSON.stringify(clean), req.user.uid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: userPublic(user) });
});

app.patch('/api/me/xp', auth, (req, res) => {
  const { xp } = req.body || {};
  if (typeof xp !== 'number' || xp < 0) return res.status(400).json({ error: 'Invalid xp' });
  const level = 1 + Math.floor(xp / 500);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(xp, level, req.user.uid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: userPublic(user) });
});

// ── AI insights (rule-based detection + Groq phrasing) ───────
const DAYNAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYNAMES_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const BUCKET_LABELS = ['night(0-6)','morning(6-12)','afternoon(12-18)','evening(18-24)'];
const BUCKET_SHORT  = ['night','morning','afternoon','evening'];

function summarizeForAI(habits, checkins) {
  const now = Date.now();
  const DAY = 86400000;
  const habitIds = new Set((habits || []).map(h => h.id));
  const recent = (checkins || []).filter(c => {
    if (!habitIds.has(c.habitId)) return false;
    const t = new Date(c.ts).getTime();
    return Number.isFinite(t) && now - t <= 30 * DAY;
  });

  const byHabit = {};
  for (const c of recent) (byHabit[c.habitId] ||= []).push(c);

  const habitStats = (habits || []).map(h => {
    const his = byHabit[h.id] || [];
    const weekday = [0,0,0,0,0,0,0];
    const bucket  = [0,0,0,0];
    const dates   = new Set();
    for (const c of his) {
      const d = new Date(c.ts);
      weekday[d.getDay()]++;
      const hh = d.getHours();
      bucket[hh < 6 ? 0 : hh < 12 ? 1 : hh < 18 ? 2 : 3]++;
      dates.add(d.toISOString().slice(0, 10));
    }
    const sched = h.days || [0,1,2,3,4,5,6];
    let scheduledDays = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(now - i * DAY);
      if (sched.includes(d.getDay())) scheduledDays++;
    }
    return {
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      time: h.time || '09:00',
      current_streak: h.streak || 0,
      scheduled_day_indices: sched,
      scheduled_days: sched.map(d => DAYNAMES[d]),
      checkins_last_30: his.length,
      unique_days_done_last_30: dates.size,
      scheduled_days_last_30: scheduledDays,
      completion_rate_pct: scheduledDays ? Math.round((dates.size / scheduledDays) * 100) : null,
      checkins_by_weekday: Object.fromEntries(DAYNAMES.map((n, i) => [n, weekday[i]])),
      checkins_by_time: Object.fromEntries(BUCKET_LABELS.map((n, i) => [n, bucket[i]])),
    };
  });

  return {
    today: new Date().toISOString().slice(0, 10),
    habit_count: (habits || []).length,
    total_checkins_last_30: recent.length,
    habits: habitStats,
  };
}

// Detect patterns deterministically — the "what" to talk about.
function detectPatterns(summary) {
  const patterns = [];

  if (summary.habit_count === 0) {
    patterns.push({ type: 'no_habits' });
    return patterns;
  }

  if (summary.total_checkins_last_30 < 3) {
    patterns.push({ type: 'sparse', total_checkins: summary.total_checkins_last_30, habit_count: summary.habit_count });
    return patterns;
  }

  for (const h of summary.habits) {
    if (h.checkins_last_30 === 0) continue;

    // Time-of-day skew: one bucket accounts for ≥60% of check-ins (min 3)
    const byBucket = BUCKET_SHORT.map((name, i) => ({ name, count: h.checkins_by_time[BUCKET_LABELS[i]] || 0 }));
    byBucket.sort((a, b) => b.count - a.count);
    const top = byBucket[0];
    if (top.count >= 3 && top.count >= h.checkins_last_30 * 0.6 && h.checkins_last_30 >= 4) {
      const schedHour = parseInt(h.time?.split(':')[0]) || 9;
      const schedBucket = schedHour < 6 ? 'night' : schedHour < 12 ? 'morning' : schedHour < 18 ? 'afternoon' : 'evening';
      const BUCKET_MID = { night: '05:00', morning: '08:00', afternoon: '14:00', evening: '20:00' };
      if (schedBucket !== top.name) {
        patterns.push({
          type: 'shift_time',
          habit_id: h.id,
          habit: h.name, emoji: h.emoji,
          current_bucket: schedBucket,
          better_bucket: top.name,
          bucket_count: top.count,
          total_checkins: h.checkins_last_30,
          suggested_time: BUCKET_MID[top.name],
        });
      } else {
        patterns.push({
          type: 'time_of_day',
          habit: h.name, emoji: h.emoji,
          bucket: top.name,
          bucket_count: top.count,
          total_checkins: h.checkins_last_30
        });
      }
    }

    // Weekday slump: a scheduled weekday has ≤40% of the avg (and avg ≥ 2)
    if (h.scheduled_days.length >= 3) {
      const hits = h.scheduled_days.map(d => ({ day: d, n: h.checkins_by_weekday[d] || 0 }));
      hits.sort((a, b) => a.n - b.n);
      const avg = hits.reduce((s, x) => s + x.n, 0) / hits.length;
      const worst = hits[0];
      if (avg >= 2 && worst.n <= Math.floor(avg * 0.4) && worst.n <= 1) {
        const dayIdx = DAYNAMES.indexOf(worst.day);
        patterns.push({
          type: 'weekday_slump',
          habit: h.name, emoji: h.emoji,
          weekday: DAYNAMES_LONG[dayIdx] || worst.day,
          weekday_hits: worst.n,
          avg_per_scheduled_day: Math.round(avg * 10) / 10
        });
      }
    }

    // Consistent: completion ≥ 80% with ≥10 scheduled days
    if (h.completion_rate_pct !== null && h.completion_rate_pct >= 80 && h.scheduled_days_last_30 >= 10) {
      patterns.push({
        type: 'consistent',
        habit: h.name, emoji: h.emoji,
        completion_rate_pct: h.completion_rate_pct,
        days_done: h.unique_days_done_last_30,
        days_scheduled: h.scheduled_days_last_30
      });
    }

    // Adapt frequency: missing too often → suggest dropping to days they actually do it
    let adaptedThisHabit = false;
    if (h.scheduled_day_indices.length > 1
        && h.completion_rate_pct !== null
        && h.completion_rate_pct <= 40
        && h.scheduled_days_last_30 >= 7) {
      const successDays = [];
      DAYNAMES.forEach((d, i) => {
        if ((h.checkins_by_weekday[d] || 0) > 0) successDays.push(i);
      });
      if (successDays.length && successDays.length < h.scheduled_day_indices.length) {
        patterns.push({
          type: 'adapt_frequency',
          habit_id: h.id,
          habit: h.name, emoji: h.emoji,
          completion_rate_pct: h.completion_rate_pct,
          days_done: h.unique_days_done_last_30,
          days_scheduled: h.scheduled_days_last_30,
          current_freq_count: h.scheduled_day_indices.length,
          suggested_days: successDays,
          suggested_days_labels: successDays.map(i => DAYNAMES_LONG[i]),
        });
        adaptedThisHabit = true;
      }
    }

    // Struggling: completion ≤ 30% with ≥7 scheduled days (only if no adapt suggestion)
    if (!adaptedThisHabit && h.completion_rate_pct !== null && h.completion_rate_pct <= 30 && h.scheduled_days_last_30 >= 7) {
      patterns.push({
        type: 'struggling',
        habit: h.name, emoji: h.emoji,
        completion_rate_pct: h.completion_rate_pct,
        days_done: h.unique_days_done_last_30,
        days_scheduled: h.scheduled_days_last_30
      });
    }

    // Active streak ≥ 7 days
    if (h.current_streak >= 7) {
      patterns.push({
        type: 'streak',
        habit: h.name, emoji: h.emoji,
        streak_days: h.current_streak
      });
    }
  }

  // Too many habits: 6+ habits and overall completion ≤ 30%
  if (summary.habit_count >= 6) {
    const withData = summary.habits.filter(h => h.scheduled_days_last_30 >= 7);
    if (withData.length >= 6) {
      const avgCompletion = Math.round(
        withData.reduce((s, h) => s + (h.completion_rate_pct || 0), 0) / withData.length
      );
      if (avgCompletion <= 30) {
        const sorted = [...withData].sort((a, b) => (b.completion_rate_pct || 0) - (a.completion_rate_pct || 0));
        const topThree = sorted.slice(0, 3);
        patterns.push({
          type: 'too_many',
          habit_count: summary.habit_count,
          avg_completion_pct: avgCompletion,
          top_habits: topThree.map(h => ({ name: h.name, emoji: h.emoji, pct: h.completion_rate_pct })),
        });
      }
    }
  }

  // Best overall day: day with ≥1.5× average count and ≥4 check-ins
  const overall = [0,0,0,0,0,0,0];
  for (const h of summary.habits) {
    DAYNAMES.forEach((d, i) => { overall[i] += h.checkins_by_weekday[d] || 0; });
  }
  const dailyAvg = overall.reduce((s, x) => s + x, 0) / 7;
  const maxIdx = overall.indexOf(Math.max(...overall));
  if (overall[maxIdx] >= 4 && overall[maxIdx] >= dailyAvg * 1.5) {
    patterns.push({
      type: 'best_day',
      weekday: DAYNAMES_LONG[maxIdx],
      count: overall[maxIdx],
      daily_avg: Math.round(dailyAvg * 10) / 10
    });
  }

  // Nothing specific caught — give a general warming-up note
  if (patterns.length === 0) {
    patterns.push({
      type: 'general',
      total_checkins: summary.total_checkins_last_30,
      habit_count: summary.habit_count
    });
  }

  // Actionable / attention-grabbing patterns first; positive observations after.
  const PRIORITY = {
    too_many: 0, adapt_frequency: 1, shift_time: 2, struggling: 3, weekday_slump: 4,
    streak: 5, time_of_day: 6, consistent: 7, best_day: 8,
    sparse: 9, general: 10, no_habits: 11,
  };
  patterns.sort((a, b) => (PRIORITY[a.type] ?? 99) - (PRIORITY[b.type] ?? 99));

  return patterns.slice(0, 4);
}

// Template fallback — used if Groq fails so UI always renders something.
function patternToTemplate(p) {
  switch (p.type) {
    case 'no_habits':
      return { tag: 'Start here', title: 'No habits yet',
        body: 'Head over to My Habits and pick one or two to track. Insights start showing up after a few days of check-ins.',
        cta: { label: 'Go to My Habits', section: 'habits' } };
    case 'too_many': {
      const names = p.top_habits.map(h => `${h.emoji} ${h.name}`).join(', ');
      return { tag: 'Simplify', title: `${p.habit_count} habits might be too many right now`,
        body: `You're averaging ${p.avg_completion_pct}% across ${p.habit_count} habits. Your strongest ones are ${names}. Try focusing on just those for a while.` };
    }
    case 'sparse':
      return { tag: 'Getting started', title: 'Just warming up',
        body: p.habit_count === 1
          ? 'One habit in, a couple of check-ins in the last 30 days. Give it another week of checking in and patterns will start showing up here.'
          : `You've got ${p.habit_count} habits set up but only ${p.total_checkins} check-in${p.total_checkins === 1 ? '' : 's'} in the last 30 days. Keep at it — patterns need a bit more data.` };
    case 'shift_time':
      return { tag: 'Try shifting', title: `${p.habit} works better in the ${p.better_bucket}`,
        body: `It's scheduled for the ${p.current_bucket}, but ${p.bucket_count} of your last ${p.total_checkins} check-ins actually happen in the ${p.better_bucket}.`,
        cta: {
          label: `Move to ${p.better_bucket}`,
          action: 'shift_time',
          habitId: p.habit_id,
          suggestedTime: p.suggested_time,
        } };
    case 'time_of_day':
      return { tag: 'Best time', title: `${p.habit} is a ${p.bucket} thing`,
        body: `${p.bucket_count} of your last ${p.total_checkins} ${p.habit.toLowerCase()} check-ins happened in the ${p.bucket}.` };
    case 'weekday_slump':
      return { tag: 'Pattern', title: `${p.habit} slips on ${p.weekday}s`,
        body: `You average ${p.avg_per_scheduled_day} check-ins on a typical scheduled day, but only ${p.weekday_hits} on ${p.weekday}s.` };
    case 'consistent':
      return { tag: 'Consistency', title: `${p.habit} is locked in`,
        body: `You hit ${p.habit.toLowerCase()} on ${p.days_done} of ${p.days_scheduled} scheduled days (${p.completion_rate_pct}%).` };
    case 'struggling':
      return { tag: 'Heads up', title: `${p.habit} keeps slipping`,
        body: `${p.habit} is getting done on only ${p.days_done} of ${p.days_scheduled} scheduled days (${p.completion_rate_pct}%).` };
    case 'adapt_frequency': {
      const labels = p.suggested_days_labels;
      const dayList = labels.length === 1 ? `${labels[0]}s`
        : labels.length === 2 ? `${labels[0]} and ${labels[1]}`
        : labels.slice(0, -1).join(', ') + ', and ' + labels.slice(-1);
      const freq = labels.length === 1 ? 'once a week' : `${labels.length}× a week`;
      return {
        tag: 'Suggestion',
        title: `${p.habit} feels like a stretch`,
        body: `You're hitting ${p.habit.toLowerCase()} on only ${p.days_done} of ${p.days_scheduled} scheduled days (${p.completion_rate_pct}%). The days you actually do it are ${dayList} — try ${freq} instead so it sticks.`,
        cta: {
          label: `Switch to ${freq}`,
          action: 'adjust_habit',
          habitId: p.habit_id,
          suggestedDays: p.suggested_days,
        }
      };
    }
    case 'streak':
      return { tag: 'Streak', title: `${p.streak_days}-day streak on ${p.habit}`,
        body: `Don't be the one to break it.` };
    case 'best_day':
      return { tag: 'Best day', title: `${p.weekday}s are your strongest day`,
        body: `You log ${p.count} check-ins on ${p.weekday}s, well above your ${p.daily_avg}/day average.` };
    case 'general':
      return { tag: 'Warming up', title: `${p.total_checkins} check-ins so far`,
        body: `You've logged ${p.total_checkins} check-ins across ${p.habit_count} habit${p.habit_count === 1 ? '' : 's'}. Keep going and patterns will surface.` };
  }
  return null;
}

function buildPhrasingPrompt(patterns) {
  return `You turn structured habit-tracking observations into natural-sounding sentences for a user to read. You do NOT analyze or infer anything new — ONLY rephrase what's already in the data. Never invent numbers, habits, or days that aren't in the input.

Rules:
- Cite the specific numbers from the data (counts, percentages, days).
- Casual tone, like a friend noticing a pattern. No corporate language, no "Let's", no "You should", no motivational fluff.
- No em-dashes. No "Heads up" prefix in the body. No copywriter-style punchlines.
- 1 sentence per insight (2 max if truly needed).

For each observation return a JSON object with:
- "tag": a 1-3 word label that fits the pattern type (e.g. "Pattern", "Best time", "Streak", "Consistency", "Heads up", "Warming up")
- "title": short punchy headline (max ~55 chars)
- "body": the natural-sentence version citing the numbers

Return ONLY valid JSON in this exact shape:
{"insights":[{"tag":"...","title":"...","body":"..."}]}

The insights array MUST have exactly ${patterns.length} item${patterns.length === 1 ? '' : 's'}, one per observation, in the same order as given.

Observations to rephrase:
${JSON.stringify(patterns, null, 2)}`;
}

app.post('/api/insight', auth, async (req, res) => {
  const { habits = [], checkins = [] } = req.body || {};
  const summary  = summarizeForAI(habits, checkins);
  const patterns = detectPatterns(summary);
  const fallback = patterns.map(patternToTemplate).filter(Boolean);

  // No key, or patterns don't warrant an LLM call — just return templates.
  const skipAiTypes = new Set(['sparse', 'general', 'no_habits']);
  if (!GROQ_KEY || skipAiTypes.has(patterns[0]?.type)) {
    return res.json({ insights: fallback, source: 'template' });
  }

  try {
    const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: buildPhrasingPrompt(patterns) }],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      }),
    });
    const data = await gRes.json();
    if (!gRes.ok) return res.json({ insights: fallback, source: 'template' });

    const text = data.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return res.json({ insights: fallback, source: 'template' }); }

    const aiInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    if (aiInsights.length !== patterns.length) {
      return res.json({ insights: fallback, source: 'template' });
    }
    // CTAs come from our templates, not the LLM — re-attach them.
    const merged = aiInsights.map((ai, i) => fallback[i]?.cta ? { ...ai, cta: fallback[i].cta } : ai);
    res.json({ insights: merged, source: 'ai' });
  } catch {
    res.json({ insights: fallback, source: 'template' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cadence running on port ${PORT}`);
  if (!GROQ_KEY) console.log('  (GROQ_API_KEY not set — /api/insight will return 503)');
});
