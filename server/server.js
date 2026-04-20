import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

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
  return { id: row.id, email: row.email, name: row.name, level: row.level, xp: row.xp };
}

function issueToken(user) {
  return jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

// ── Routes ────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).run(email.toLowerCase(), hash, name.trim());

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: issueToken(user), user: userPublic(user) });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password' });

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
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

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
