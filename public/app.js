let currentDate = todayStr();
let tasks = [];
let longTasks = [];
let mediaRecorder = null;
let audioChunks = [];
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// API
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

// Tasks
async function loadTasks() {
  tasks = await api(`/api/tasks?date=${currentDate}`);
  renderTasks();
  updateJournalStats();
}

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

// Long-term tasks
async function loadLongTasks() {
  longTasks = await api('/api/long-tasks');
  renderLongTasks();
}

async function addLongTask() {
  const input = document.getElementById('long-task-input');
  const content = input.value.trim();
  if (!content) return;
  await api('/api/long-tasks', { method: 'POST', body: JSON.stringify({ content }) });
  input.value = '';
  loadLongTasks();
}

async function updateLongTask(id, status) {
  await api(`/api/long-tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  loadLongTasks();
}

async function deleteLongTask(id) {
  await api(`/api/long-tasks/${id}`, { method: 'DELETE' });
  loadLongTasks();
}

function renderLongTasks() {
  const list = document.getElementById('long-task-list');
  const empty = document.getElementById('long-task-empty');
  if (longTasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = longTasks.map(t => `
    <li class="task-item ${t.status}" data-id="${t.id}">
      <span class="task-text">${escapeHtml(t.content)}<span class="long-task-badge">长期</span></span>
      <div class="task-actions">
        ${t.status === 'pending' ? `
          <button class="task-btn complete-btn" onclick="updateLongTask(${t.id}, 'completed')">✓</button>
        ` : ''}
        <button class="task-btn delete-btn" onclick="deleteLongTask(${t.id})">×</button>
      </div>
    </li>
  `).join('');
}

// Journal
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

// Weather & Location
async function loadContext() {
  const ctx = await api(`/api/context?date=${currentDate}`);
  if (ctx.weather) {
    document.getElementById('weather-display').textContent = ctx.weather;
  }
  if (ctx.location) {
    document.getElementById('location-display').textContent = '📍 ' + ctx.location;
  }
}

async function fetchWeather() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    try {
      const weather = await api(`/api/weather?lat=${latitude}&lon=${longitude}`);
      let weatherText = '';
      if (weather.temp) weatherText += `${weather.temp}°C `;
      if (weather.desc) weatherText += weather.desc;
      if (weather.humidity) weatherText += ` | 湿度${weather.humidity}%`;
      document.getElementById('weather-display').textContent = weatherText;
      await api('/api/context', {
        method: 'PUT',
        body: JSON.stringify({
          date: currentDate,
          weather: weatherText,
          location: '',
          latitude,
          longitude
        })
      });
    } catch (e) { /* weather unavailable */ }
  }, () => { /* location denied */ }, { timeout: 10000 });
}

// Media
async function loadMedia() {
  const entries = await api(`/api/media?date=${currentDate}`);
  const gallery = document.getElementById('media-gallery');
  if (entries.length === 0) {
    gallery.innerHTML = '';
    return;
  }
  gallery.innerHTML = entries.map(e => {
    const isImage = e.type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(e.filename);
    return `
      <div class="media-thumb" onclick="openMedia('${e.filename}', '${e.type}')">
        ${isImage ? `<img src="/uploads/${e.filename}" alt="">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;">${e.type === 'audio' ? '🎙' : '🎬'}</div>`}
        <span class="media-type-label">${e.type}</span>
        <button class="delete-media" onclick="event.stopPropagation();deleteMedia(${e.id})">×</button>
      </div>
    `;
  }).join('');
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('date', currentDate);
  const ext = file.name.split('.').pop().toLowerCase();
  formData.append('type', ['mp3','wav','webm','ogg'].includes(ext) ? 'audio' : ['mp4','webm','mov'].includes(ext) ? 'video' : 'image');
  await fetch('/api/media', { method: 'POST', body: formData });
  loadMedia();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
      uploadFile(file);
      stream.getTracks().forEach(t => t.stop());
      document.getElementById('recording-status').style.display = 'none';
    };
    mediaRecorder.start();
    document.getElementById('recording-status').style.display = 'flex';
  } catch (e) { alert('无法访问麦克风: ' + e.message); }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function deleteMedia(id) {
  await api(`/api/media/${id}`, { method: 'DELETE' });
  loadMedia();
}

function openMedia(filename, type) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const ext = filename.split('.').pop().toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
  content.innerHTML = `
    <h3>${isImage ? '图片' : type}</h3>
    ${isImage ? `<img src="/uploads/${filename}" alt="">` : `<p style="text-align:center;font-size:48px;padding:40px 0;">${type === 'audio' ? '🎙' : '🎬'}</p><p style="text-align:center;color:var(--text-muted)">${filename}</p>`}
    <button class="modal-close" onclick="closeModal()">关闭</button>
  `;
  overlay.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

// History
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
      ${e.content ? `<div class="history-preview">${escapeHtml(e.content)}</div>` : '<div class="history-preview" style="color:var(--text-muted)">未写日志</div>'}
      <div class="history-meta">
        <span class="history-stats">${e.completed_tasks}/${e.total_tasks} 任务完成</span>
        ${e.weather ? `<span class="history-weather">${escapeHtml(e.weather)}</span>` : ''}
        ${e.location ? `<span class="history-location">📍${escapeHtml(e.location)}</span>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      currentDate = el.dataset.date;
      updateDateDisplay();
      loadTasks();
      loadJournal();
      loadContext();
      switchTab('journal');
    });
  });
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
  document.getElementById('next-day').style.opacity = currentDate === todayStr() ? '0.3' : '1';
}

// Event listeners
document.getElementById('add-btn').addEventListener('click', addTask);
document.getElementById('task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
document.getElementById('add-long-btn').addEventListener('click', addLongTask);
document.getElementById('long-task-input').addEventListener('keydown', e => { if (e.key === 'Enter') addLongTask(); });
document.getElementById('save-journal').addEventListener('click', saveJournal);
document.getElementById('prev-day').addEventListener('click', () => {
  currentDate = shiftDate(currentDate, -1);
  updateDateDisplay();
  loadTasks(); loadJournal(); loadContext(); loadMedia();
});
document.getElementById('next-day').addEventListener('click', () => {
  if (currentDate === todayStr()) return;
  currentDate = shiftDate(currentDate, 1);
  updateDateDisplay();
  loadTasks(); loadJournal(); loadContext(); loadMedia();
});
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
document.getElementById('journal-content').addEventListener('input', () => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveJournal, 2000);
});

// Media events
document.getElementById('record-btn').addEventListener('click', startRecording);
document.getElementById('stop-record').addEventListener('click', stopRecording);
document.getElementById('camera-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.capture = 'environment';
  input.onchange = () => { if (input.files[0]) uploadFile(input.files[0]); };
  input.click();
});
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', () => {
  if (document.getElementById('file-input').files[0]) {
    uploadFile(document.getElementById('file-input').files[0]);
  }
});
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Init
updateDateDisplay();
loadTasks();
loadJournal();
loadContext();
loadMedia();
loadHistory();
loadLongTasks();
fetchWeather();
