let currentDate = todayStr();
let tasks = [];
let saveTimeout = null;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  const today = new Date(todayStr() + 'T00:00:00');
  const diff = (today - d) / 86400000;
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (diff === -1) return '明天';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateFull(str) {
  const d = new Date(str + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${getWeekday(d)}`;
}

function getWeekday(d) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
}

function shiftDate(str, days) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// API calls
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

async function loadTasks() {
  tasks = await api(`/api/tasks?date=${currentDate}`);
  renderTasks();
  updateJournalStats();
}

async function loadJournal() {
  const entry = await api(`/api/journal?date=${currentDate}`);
  document.getElementById('journal-content').value = entry.content || '';
}

async function saveJournal() {
  const content = document.getElementById('journal-content').value;
  await api('/api/journal', { method: 'PUT', body: JSON.stringify({ date: currentDate, content }) });
  const msg = document.getElementById('journal-saved');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
}

async function loadHistory() {
  const entries = await api('/api/history?limit=30');
  const container = document.getElementById('history-list');
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>还没有历史日志</p><p class="hint">保存日志后会显示在这里</p></div>';
    return;
  }
  container.innerHTML = entries.map(e => `
    <div class="history-item" data-date="${e.date}">
      <div class="history-date">${formatDateFull(e.date)}</div>
      ${e.content ? `<div class="history-preview">${escapeHtml(e.content)}</div>` : '<div class="history-preview" style="color:var(--text-dim)">未写日志</div>'}
      <div class="history-stats">${e.completed_tasks}/${e.total_tasks} 任务完成</div>
    </div>
  `).join('');

  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      currentDate = el.dataset.date;
      updateDateDisplay();
      loadTasks();
      loadJournal();
      switchTab('journal');
    });
  });
}

// Rendering
function renderTasks() {
  const list = document.getElementById('task-list');
  const empty = document.getElementById('task-empty');

  if (tasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = tasks.map(t => `
    <li class="task-item ${t.status}" data-id="${t.id}">
      <span class="task-text">${escapeHtml(t.content)}</span>
      <div class="task-actions">
        ${t.status === 'pending' ? `
          <button class="task-btn complete-btn" onclick="updateTask(${t.id}, 'completed')">✓</button>
          <button class="task-btn skip-btn" onclick="updateTask(${t.id}, 'skipped')">⟳</button>
        ` : ''}
        <button class="task-btn delete-btn" onclick="deleteTask(${t.id})">×</button>
      </div>
    </li>
  `).join('');
}

function updateJournalStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'completed').length;
  const pending = total - done;
  document.getElementById('journal-stats').innerHTML = `
    <div class="stat-card total"><span class="num">${total}</span><span class="label">总任务</span></div>
    <div class="stat-card done"><span class="num">${done}</span><span class="label">已完成</span></div>
    <div class="stat-card pending"><span class="num">${pending}</span><span class="label">未完成</span></div>
  `;
}

// Actions
async function addTask() {
  const input = document.getElementById('task-input');
  const content = input.value.trim();
  if (!content) return;
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({ content, date: currentDate }) });
  input.value = '';
  loadTasks();
}

async function updateTask(id, status) {
  await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  loadTasks();
}

async function deleteTask(id) {
  await api(`/api/tasks/${id}`, { method: 'DELETE' });
  loadTasks();
}

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
}

function updateDateDisplay() {
  document.getElementById('current-date').textContent = formatDateFull(currentDate);
  const isToday = currentDate === todayStr();
  document.getElementById('next-day').style.opacity = isToday ? '0.3' : '1';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
document.getElementById('add-btn').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
document.getElementById('save-journal').addEventListener('click', saveJournal);
document.getElementById('prev-day').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, -1);
  updateDateDisplay();
  loadTasks();
  loadJournal();
});
document.getElementById('next-day').addEventListener('click', () => {
  if (currentDate === todayStr()) return;
  currentDate = shiftDate(currentDate, 1);
  updateDateDisplay();
  loadTasks();
  loadJournal();
});
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Auto-save journal with debounce
document.getElementById('journal-content').addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveJournal, 2000);
});

// Init
updateDateDisplay();
loadTasks();
loadJournal();
loadHistory();
