const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const app = express();
const port = process.argv[2] || 8090;

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
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// History API
app.get('/api/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  const entries = db.prepare(`
    SELECT j.*,
      (SELECT COUNT(*) FROM tasks WHERE date = j.date) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE date = j.date AND status = 'completed') as completed_tasks
    FROM journal_entries j
    ORDER BY j.date DESC
    LIMIT ?
  `).all(limit);
  res.json(entries);
});

app.listen(port, () => console.log(`Worklog running on port ${port}`));
