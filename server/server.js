import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;

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

// Migrations
const cols = () => db.prepare('PRAGMA table_info(users)').all();
if (!cols().some(c => c.name === 'username')) {
  db.exec('ALTER TABLE users ADD COLUMN username TEXT');
  const rows = db.prepare('SELECT id, name FROM users').all();
  const upd = db.prepare('UPDATE users SET username = ? WHERE id = ?');
  for (const r of rows) {
    const base = (r.name || `user${r.id}`).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || `user${r.id}`;
    upd.run(base, r.id);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)');
}
if (!cols().some(c => c.name === 'verified')) {
  db.exec('ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 1');
}
if (!cols().some(c => c.name === 'verify_code')) {
  db.exec('ALTER TABLE users ADD COLUMN verify_code TEXT');
  db.exec('ALTER TABLE users ADD COLUMN verify_code_expires INTEGER');
}

// Resend
const resend    = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_MAIL = process.env.RESEND_FROM    || 'Cadence <onboarding@resend.dev>';
if (!resend) console.warn('[warn] RESEND_API_KEY not set — codes will print to console');

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerifyEmail(to, name, code) {
  if (!resend) {
    console.log(`[dev] verification code for ${to}: ${code}`);
    return;
  }
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:32px;background:#0E100D;color:#E4E8DF;border:1px solid #1C1F19">
      <h1 style="font-size:20px;margin:0 0 8px;letter-spacing:0.04em">Cadence</h1>
      <p style="color:#888E85;margin:0 0 24px;font-size:14px">Verify your email to finish signing up.</p>
      <p style="font-size:15px;margin:0 0 16px">Hi ${name}, your code is:</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:0.3em;color:#B9F23C;padding:16px;background:#080A07;text-align:center;margin:0 0 20px">${code}</div>
      <p style="font-size:13px;color:#535950;margin:0">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>
  `;
  try {
    await resend.emails.send({ from: FROM_MAIL, to, subject: 'Your Cadence verification code', html });
  } catch (err) {
    console.error('[resend] failed:', err?.message || err);
    console.log(`[fallback] code for ${to}: ${code}`);
  }
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
  return { id: row.id, email: row.email, username: row.username, name: row.name, level: row.level, xp: row.xp };
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
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(mail)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  const code = genCode();
  const expires = Date.now() + 10 * 60 * 1000;
  db.prepare(
    'INSERT INTO users (email, username, password_hash, name, verified, verify_code, verify_code_expires) VALUES (?, ?, ?, ?, 0, ?, ?)'
  ).run(mail, uname, hash, name.trim(), code, expires);

  await sendVerifyEmail(mail, name.trim(), code);
  res.json({ pendingVerification: true, email: mail });
});

app.post('/api/verify-email', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Missing fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (user.verified) return res.status(400).json({ error: 'Already verified' });
  if (!user.verify_code || !user.verify_code_expires) return res.status(400).json({ error: 'No code pending — request a new one' });
  if (Date.now() > user.verify_code_expires) return res.status(400).json({ error: 'Code expired — request a new one' });
  if (String(code).trim() !== user.verify_code) return res.status(400).json({ error: 'Incorrect code' });

  db.prepare('UPDATE users SET verified = 1, verify_code = NULL, verify_code_expires = NULL WHERE id = ?').run(user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ token: issueToken(fresh), user: userPublic(fresh) });
});

app.post('/api/resend-code', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Missing email' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (user && !user.verified) {
    const code = genCode();
    const expires = Date.now() + 10 * 60 * 1000;
    db.prepare('UPDATE users SET verify_code = ?, verify_code_expires = ? WHERE id = ?').run(code, expires, user.id);
    await sendVerifyEmail(user.email, user.name, code);
  }
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const id = (identifier || email || '').trim().toLowerCase();
  if (!id || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = id.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(id)
    : db.prepare('SELECT * FROM users WHERE username = ?').get(id);
  if (!user) return res.status(401).json({ error: 'Incorrect credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect credentials' });

  if (!user.verified) {
    return res.status(403).json({ error: 'Email not verified', needsVerification: true, email: user.email });
  }

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
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(email.toLowerCase(), req.user.uid);
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.toLowerCase(), req.user.uid);
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

app.patch('/api/me/xp', auth, (req, res) => {
  const { xp } = req.body || {};
  if (typeof xp !== 'number' || xp < 0) return res.status(400).json({ error: 'Invalid xp' });
  const level = 1 + Math.floor(xp / 500);
  db.prepare('UPDATE users SET xp = ?, level = ? WHERE id = ?').run(xp, level, req.user.uid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.uid);
  res.json({ user: userPublic(user) });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cadence running on port ${PORT}`);
});
