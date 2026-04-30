let currentDate = todayStr();
let tasks = [];
let longTasks = [];
let mediaRecorder = null;
let audioChunks = [];
let saveTimeout = null;
let modalEl = null;
let settingDateProgrammatically = false;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Tasks
async function loadTasks() {
  try {
    tasks = await api(`/api/tasks?date=${currentDate}`);
  } catch (e) { tasks = []; }
  renderTasks();
  updateJournalStats();
}

async function addTask() {
  const input = document.getElementById('task-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api('/api/tasks', { method: 'POST', body: JSON.stringify({ content, date: currentDate }) });
    loadTasks();
  } catch (e) { input.value = content; alert('添加失败: ' + e.message); }
}

window.updateTask = async function(id, status) {
  try {
    await api(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadTasks();
  } catch (e) { console.error(e); }
};

window.deleteTask = async function(id) {
  try {
    await api(`/api/tasks/${id}`, { method: 'DELETE' });
    loadTasks();
  } catch (e) { console.error(e); }
};

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
        <button class="task-btn complete-btn" onclick="updateTask(${t.id}, '${t.status === 'completed' ? 'pending' : 'completed'}')">${t.status === 'completed' ? '↩' : '✓'}</button>
        <button class="task-btn skip-btn" onclick="updateTask(${t.id}, '${t.status === 'skipped' ? 'pending' : 'skipped'}')">${t.status === 'skipped' ? '↩' : '⟳'}</button>
        <button class="task-btn delete-btn" onclick="deleteTask(${t.id})">×</button>
      </div>
    </li>
  `).join('');
}

// Long-term tasks
async function loadLongTasks() {
  try {
    longTasks = await api('/api/long-tasks');
  } catch (e) { longTasks = []; }
  renderLongTasks();
}

async function addLongTask() {
  const input = document.getElementById('long-task-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api('/api/long-tasks', { method: 'POST', body: JSON.stringify({ content }) });
    loadLongTasks();
  } catch (e) { input.value = content; alert('添加失败: ' + e.message); }
}

window.updateLongTask = async function(id, status) {
  try {
    await api(`/api/long-tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    loadLongTasks();
  } catch (e) { console.error(e); }
};

window.deleteLongTask = async function(id) {
  try {
    await api(`/api/long-tasks/${id}`, { method: 'DELETE' });
    loadLongTasks();
  } catch (e) { console.error(e); }
};

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
  try {
    const entry = await api(`/api/journal?date=${currentDate}`);
    document.getElementById('journal-content').value = entry.content || '';
  } catch (e) { document.getElementById('journal-content').value = ''; }
}

async function saveJournal() {
  const content = document.getElementById('journal-content').value;
  try {
    await api('/api/journal', { method: 'PUT', body: JSON.stringify({ date: currentDate, content }) });
    const msg = document.getElementById('journal-saved');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  } catch (e) { console.error(e); }
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

// Weather - Shanghai hardcoded
async function loadWeather() {
  try {
    const weather = await api('/api/weather?lat=31.2304&lon=121.4737');
    let weatherText = '';
    if (weather.desc) weatherText += weather.desc;
    if (weather.temp) weatherText += ` ${weather.temp}°C`;
    if (weather.humidity) weatherText += ` | 湿度${weather.humidity}%`;
    if (weather.wind) weatherText += ` | 风速${weather.wind}km/h`;
    document.getElementById('weather-display').textContent = weatherText || '🌤 上海';
  } catch (e) {
    document.getElementById('weather-display').textContent = '🌤 上海';
  }
}

// Media
async function loadMedia() {
  try {
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
          ${isImage ? `<img src="/uploads/${e.filename}" alt="" loading="lazy">` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;">${e.type === 'audio' ? '🎙' : '🎬'}</div>`}
          <span class="media-type-label">${e.type}</span>
          <button class="delete-media" onclick="event.stopPropagation();deleteMedia(${e.id})">×</button>
        </div>
      `;
    }).join('');
  } catch (e) { document.getElementById('media-gallery').innerHTML = ''; }
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

window.deleteMedia = async function(id) {
  try {
    await api(`/api/media/${id}`, { method: 'DELETE' });
    loadMedia();
  } catch (e) { console.error(e); }
};

// Modal (created dynamically to avoid overlay detection)
function createModal() {
  if (modalEl) return;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.id = 'modal-overlay';
  modalEl.innerHTML = '<div class="modal" id="modal-content"></div>';
  document.body.appendChild(modalEl);
  modalEl.addEventListener('click', e => {
    if (e.target === modalEl) closeModal();
  });
}

window.openMedia = function(filename, type) {
  createModal();
  const content = modalEl.querySelector('#modal-content');
  const ext = filename.split('.').pop().toLowerCase();
  const isImage = ['jpg','jpeg','png','gif','webp'].includes(ext);
  const isAudio = ['mp3','wav','webm','ogg'].includes(ext) || type === 'audio';
  const isVideo = ['mp4','webm','mov'].includes(ext) || type === 'video';
  let bodyHtml = '';
  if (isImage) {
    bodyHtml = `<h3>图片</h3><img src="/uploads/${filename}" alt="">`;
  } else if (isAudio) {
    bodyHtml = `<h3>录音</h3>
      <div style="padding:20px 0;text-align:center">
        <audio controls autoplay style="width:100%" src="/uploads/${filename}"></audio>
      </div>`;
  } else if (isVideo) {
    bodyHtml = `<h3>视频</h3><video controls style="width:100%" src="/uploads/${filename}"></video>`;
  } else {
    bodyHtml = `<h3>${type}</h3><p style="text-align:center;color:var(--text-muted)">${escapeHtml(filename)}</p>`;
  }
  content.innerHTML = bodyHtml + '<button class="modal-close" onclick="closeModal()">关闭</button>';
  modalEl.classList.add('show');
};

window.closeModal = function() {
  if (modalEl) modalEl.classList.remove('show');
};

// History
async function loadHistory() {
  try {
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
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        currentDate = el.dataset.date;
        updateDateDisplay();
        loadAll();
      });
    });
  } catch (e) { console.error(e); }
}

// Date
function updateDateDisplay() {
  const picker = document.getElementById('date-picker');
  settingDateProgrammatically = true;
  picker.value = currentDate;
  settingDateProgrammatically = false;
  document.getElementById('next-day').style.opacity = currentDate === todayStr() ? '0.3' : '1';
}

function onDateChange() {
  if (settingDateProgrammatically) return;
  const picker = document.getElementById('date-picker');
  if (picker.value) {
    currentDate = picker.value;
    updateDateDisplay();
    loadAll();
  }
}

function loadAll() {
  loadTasks();
  loadJournal();
  loadMedia();
  loadHistory();
}

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
}

// Event listeners
function setupEvents() {
  // Task input
  document.getElementById('add-btn').addEventListener('click', addTask);
  document.getElementById('task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTask(); }
  });

  // Long task input
  document.getElementById('add-long-btn').addEventListener('click', addLongTask);
  document.getElementById('long-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addLongTask(); }
  });

  // Date navigation
  document.getElementById('prev-day').addEventListener('click', () => {
    currentDate = shiftDate(currentDate, -1);
    updateDateDisplay();
    loadAll();
  });
  document.getElementById('next-day').addEventListener('click', () => {
    if (currentDate === todayStr()) return;
    currentDate = shiftDate(currentDate, 1);
    updateDateDisplay();
    loadAll();
  });
  document.getElementById('date-picker').addEventListener('change', onDateChange);

  // Journal
  document.getElementById('save-journal').addEventListener('click', saveJournal);
  document.getElementById('journal-content').addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveJournal, 2000);
  });

  // Tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Media
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
    const f = document.getElementById('file-input').files[0];
    if (f) uploadFile(f);
  });
}

// Init
updateDateDisplay();
loadWeather();
setupEvents();
loadAll();
