const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.argv[2] || 8090;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || '.webp';
    cb(null, Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const dbPath = path.join(__dirname, 'data', 'worklog.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    content TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS long_term_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS daily_context (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    weather TEXT DEFAULT '',
    location TEXT DEFAULT '',
    latitude REAL,
    longitude REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS media_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    filename TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json({ limit: '10mb' }));

// Serve static files with cache control
const publicPath = path.join(__dirname, 'public');
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.path.endsWith('.html') || req.path.endsWith('.css') || req.path.endsWith('.js')) {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});
app.use(express.static(publicPath));
app.use('/uploads', express.static(uploadsDir));

const getToday = () => new Date().toISOString().slice(0, 10);

// Tasks API
app.get('/api/tasks', (req, res) => {
  const date = req.query.date || getToday();
  const tasks = db.prepare('SELECT * FROM tasks WHERE date = ? ORDER BY created_at ASC').all(date);
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { content, date } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const stmt = db.prepare('INSERT INTO tasks (content, date) VALUES (?, ?)');
  const result = stmt.run(content, date || getToday());
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  db.prepare("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Journal API
app.get('/api/journal', (req, res) => {
  const date = req.query.date || getToday();
  const entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(date);
  res.json(entry || { id: null, date, content: '' });
});

app.put('/api/journal', (req, res) => {
  const { date, content } = req.body;
  const d = date || getToday();
  const existing = db.prepare('SELECT id FROM journal_entries WHERE date = ?').get(d);
  if (existing) {
    db.prepare('UPDATE journal_entries SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?').run(content, d);
  } else {
    db.prepare('INSERT INTO journal_entries (date, content) VALUES (?, ?)').run(d, content);
  }
  res.json(db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(d));
});

// Long-term tasks API
app.get('/api/long-tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM long_term_tasks ORDER BY created_at ASC').all();
  res.json(tasks);
});

app.post('/api/long-tasks', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const result = db.prepare('INSERT INTO long_term_tasks (content) VALUES (?)').run(content);
  res.json(db.prepare('SELECT * FROM long_term_tasks WHERE id = ?').get(result.lastInsertRowid));
});

app.patch('/api/long-tasks/:id', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  db.prepare("UPDATE long_term_tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  res.json(db.prepare('SELECT * FROM long_term_tasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/long-tasks/:id', (req, res) => {
  db.prepare('DELETE FROM long_term_tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Daily context (weather + location) API
app.get('/api/context', (req, res) => {
  const date = req.query.date || getToday();
  const ctx = db.prepare('SELECT * FROM daily_context WHERE date = ?').get(date);
  res.json(ctx || { id: null, date, weather: '', location: '', latitude: null, longitude: null });
});

app.put('/api/context', (req, res) => {
  const { date, weather, location, latitude, longitude } = req.body;
  const d = date || getToday();
  const lat = latitude ?? 0;
  const lon = longitude ?? 0;
  const existing = db.prepare('SELECT id FROM daily_context WHERE date = ?').get(d);
  if (existing) {
    db.prepare(
      'UPDATE daily_context SET weather=?, location=?, latitude=?, longitude=?, updated_at=CURRENT_TIMESTAMP WHERE date=?'
    ).run(weather || '', location || '', lat, lon, d);
  } else {
    db.prepare(
      'INSERT INTO daily_context (date, weather, location, latitude, longitude) VALUES (?, ?, ?, ?, ?)'
    ).run(d, weather || '', location || '', lat, lon);
  }
  res.json(db.prepare('SELECT * FROM daily_context WHERE date = ?').get(d));
});

// Weather fetch (uses wttr.in, no API key needed)
app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const url = lat && lon
      ? `https://wttr.in/${lat},${lon}?format=j1`
      : 'https://wttr.in/?format=j1';
    const resp = await fetch(url, { headers: { 'Accept-Language': 'zh-CN' } });
    const data = await resp.json();
    const current = data.current_condition?.[0];
    res.json({
      temp: current?.temp_C,
      desc: current?.lang_zh?.[0]?.value || current?.weatherDesc?.[0]?.value || '',
      humidity: current?.humidity,
      wind: current?.windspeedKmph,
      icon: current?.weatherCode
    });
  } catch (e) {
    res.json({ error: 'weather unavailable' });
  }
});

// Media upload API
app.post('/api/media', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const { date, type } = req.body;
  const entry = db.prepare(
    'INSERT INTO media_entries (date, filename, type) VALUES (?, ?, ?)'
  ).run(date || getToday(), req.file.filename, type || 'image');
  res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
});

app.get('/api/media', (req, res) => {
  const date = req.query.date || getToday();
  const entries = db.prepare('SELECT * FROM media_entries WHERE date = ? ORDER BY created_at ASC').all(date);
  res.json(entries);
});

app.delete('/api/media/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM media_entries WHERE id = ?').get(req.params.id);
  if (entry) {
    const filePath = path.join(uploadsDir, entry.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM media_entries WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

// History API
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const entries = db.prepare(`
    SELECT j.*,
      (SELECT COUNT(*) FROM tasks WHERE date = j.date) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE date = j.date AND status = 'completed') as completed_tasks,
      dc.weather, dc.location
    FROM journal_entries j
    LEFT JOIN daily_context dc ON j.date = dc.date
    ORDER BY j.date DESC
    LIMIT ?
  `).all(limit);
  res.json(entries);
});

app.listen(port, () => console.log(`Worklog running on port ${port}`));
