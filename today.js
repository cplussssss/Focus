/* ============================================================
   today.js — 今日計畫頁面邏輯
   資料以 localStorage 儲存，以「今日日期」為 key，隔天自動清空
   ============================================================ */

// ── 常數 ──────────────────────────────────────────────────────
const STORAGE_KEY = 'today-plan';
const DATE_KEY    = 'today-plan-date';
const THEME_KEY   = 'focus-theme';

// ── 狀態 ──────────────────────────────────────────────────────
let goals = [];         // [{ id, name, estMin, priority, note, done, actualSec, sessions }]
let activeId  = null;   // 正在計時的目標 id
let tickTimer = null;   // setInterval handle

// ── 工具函式 ──────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtSec(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtMin(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${min}m`;
}

// ── 資料 I/O ──────────────────────────────────────────────────
function loadData() {
  const storedDate = localStorage.getItem(DATE_KEY);
  const today = todayStr();

  if (storedDate !== today) {
    // 日期不同 → 清空舊資料
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(DATE_KEY, today);
    goals = [];
  } else {
    try {
      goals = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      goals = [];
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  localStorage.setItem(DATE_KEY, todayStr());
}

// ── 計時器邏輯 ────────────────────────────────────────────────
function startTimer(id) {
  // 如果有其他目標在跑，先暫停它
  if (activeId && activeId !== id) {
    pauseTimer(activeId);
  }

  const g = goals.find(g => g.id === id);
  if (!g || g.done) return;

  // 記錄 session 開始時間（用於斷點續跑）
  g.sessions = g.sessions || [];
  g.sessions.push({ start: Date.now(), end: null });
  activeId = id;

  if (!tickTimer) {
    tickTimer = setInterval(tick, 1000);
  }

  saveData();
  render();
}

function pauseTimer(id) {
  const g = goals.find(g => g.id === id);
  if (!g || !g.sessions?.length) return;

  const last = g.sessions[g.sessions.length - 1];
  if (last && !last.end) {
    last.end = Date.now();
    g.actualSec = calcActualSec(g);
  }

  if (activeId === id) {
    activeId = null;
    clearInterval(tickTimer);
    tickTimer = null;
  }

  saveData();
  render();
}

function stopTimer(id) {
  pauseTimer(id);
  const g = goals.find(g => g.id === id);
  if (g) {
    g.done = true;
    saveData();
  }
  render();
}

function calcActualSec(g) {
  if (!g.sessions?.length) return 0;
  return g.sessions.reduce((acc, s) => {
    const start = s.start || 0;
    const end   = s.end || Date.now();
    return acc + Math.floor((end - start) / 1000);
  }, 0);
}

function tick() {
  if (!activeId) return;
  const g = goals.find(g => g.id === activeId);
  if (!g) return;
  g.actualSec = calcActualSec(g);
  saveData();
  renderTimerOnly(activeId); // 只更新計時器欄位，避免全重繪閃爍
  updateSummary();
}

// ── 渲染 ──────────────────────────────────────────────────────
function render() {
  const list = document.getElementById('goalsList');
  const empty = document.getElementById('emptyState');

  // 清除已有的 goal-card（保留 empty state）
  [...list.querySelectorAll('.goal-card')].forEach(el => el.remove());

  if (goals.length === 0) {
    empty.style.display = '';
  } else {
    empty.style.display = 'none';
    goals.forEach(g => {
      list.appendChild(buildCard(g));
    });
  }

  updateSummary();
}

function buildCard(g) {
  const isRunning = (activeId === g.id);
  const div = document.createElement('div');
  div.className = `goal-card${isRunning ? ' is-running' : ''}${g.done ? ' is-done' : ''}`;
  div.dataset.id = g.id;
  div.dataset.priority = g.priority;

  const priLabel = { high: '高', mid: '中', low: '低' }[g.priority] ?? '中';
  const actualSec = g.actualSec || 0;
  const estSec    = (g.estMin || 0) * 60;
  const isOver    = actualSec > estSec && estSec > 0;

  div.innerHTML = `
    <button class="btn-delete" data-action="delete" title="刪除">✕</button>
    <div class="goal-top">
      <div class="goal-done-check" data-action="toggle">${g.done ? '✓' : ''}</div>
      <div class="goal-info">
        <div class="goal-name">${escHtml(g.name)}</div>
        <div class="goal-meta">
          <span class="goal-pri-badge pri-${g.priority}">${priLabel}</span>
          <span class="goal-time-est">預計 ${fmtMin(g.estMin || 0)}</span>
        </div>
      </div>
    </div>
    ${g.note ? `<div class="goal-note">${escHtml(g.note)}</div>` : ''}
    <div class="goal-timer-row">
      <div class="timer-display-sm" data-timer="${g.id}">${fmtSec(actualSec)}</div>
      <div class="goal-time-info">
        <div class="time-block">
          <span class="t-label">預計</span>
          <span class="t-val">${fmtMin(g.estMin || 0)}</span>
        </div>
        <div class="time-block">
          <span class="t-label">實際</span>
          <span class="t-val ${isOver ? 'over' : ''}">${fmtSec(actualSec)}</span>
        </div>
      </div>
      <div class="timer-btns">
        ${!g.done && !isRunning
          ? `<button class="btn-timer start" data-action="start">▶ 開始</button>`
          : ''}
        ${isRunning
          ? `<button class="btn-timer pause" data-action="pause">⏸ 暫停</button>`
          : ''}
        ${(isRunning || (actualSec > 0 && !g.done))
          ? `<button class="btn-timer stop" data-action="stop">✓ 完成</button>`
          : ''}
      </div>
    </div>
  `;

  // 事件委派
  div.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const id = div.dataset.id;
    if (action === 'start')  startTimer(id);
    if (action === 'pause')  pauseTimer(id);
    if (action === 'stop')   stopTimer(id);
    if (action === 'toggle') toggleDone(id);
    if (action === 'delete') deleteGoal(id);
  });

  return div;
}

// 只更新計時器數字，不重繪整個卡片
function renderTimerOnly(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;

  const actualSec = g.actualSec || 0;
  const estSec    = (g.estMin || 0) * 60;
  const isOver    = actualSec > estSec && estSec > 0;

  const timerEl = document.querySelector(`[data-timer="${id}"]`);
  if (timerEl) timerEl.textContent = fmtSec(actualSec);

  // 也更新卡片內的「實際」欄位
  const card = document.querySelector(`.goal-card[data-id="${id}"]`);
  if (card) {
    const actualEl = card.querySelectorAll('.t-val')[1];
    if (actualEl) {
      actualEl.textContent = fmtSec(actualSec);
      actualEl.classList.toggle('over', isOver);
    }
  }
}

function updateSummary() {
  const total    = goals.length;
  const done     = goals.filter(g => g.done).length;
  const planned  = goals.reduce((a, g) => a + (g.estMin || 0), 0);
  const actualSec = goals.reduce((a, g) => a + (g.actualSec || 0), 0);
  const actualMin = Math.round(actualSec / 60);

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statPlanned').textContent = fmtMin(planned);

  const actEl = document.getElementById('statActual');
  actEl.textContent = fmtMin(actualMin);
  actEl.classList.toggle('warn', actualMin > planned && planned > 0);
}

// ── 操作 ──────────────────────────────────────────────────────
function addGoal() {
  const name = document.getElementById('fName').value.trim();
  const min  = parseInt(document.getElementById('fTime').value) || 0;
  const pri  = document.getElementById('fPri').value;
  const note = document.getElementById('fNote').value.trim();

  if (!name) {
    document.getElementById('fName').focus();
    return;
  }

  goals.push({
    id: uid(),
    name,
    estMin: min,
    priority: pri,
    note,
    done: false,
    actualSec: 0,
    sessions: []
  });

  // 清空表單
  document.getElementById('fName').value = '';
  document.getElementById('fTime').value = '';
  document.getElementById('fNote').value = '';
  document.getElementById('fPri').value  = 'mid';

  saveData();
  render();
  document.getElementById('fName').focus();
}

function toggleDone(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;

  if (g.done) {
    // 取消完成
    g.done = false;
  } else {
    // 標記完成（若正在計時先停止）
    if (activeId === id) pauseTimer(id);
    g.done = true;
  }
  saveData();
  render();
}

function deleteGoal(id) {
  if (activeId === id) {
    clearInterval(tickTimer);
    tickTimer = null;
    activeId = null;
  }
  goals = goals.filter(g => g.id !== id);
  saveData();
  render();
}

// ── 主題 ──────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('btnTheme');
  btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

// ── 日期顯示 ──────────────────────────────────────────────────
function renderDate() {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const str = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} （週${days[now.getDay()]}）`;
  document.getElementById('todayDate').textContent = str;
}

// ── 安全轉義 ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 初始化 ────────────────────────────────────────────────────
function init() {
  // 主題
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);

  // 日期
  renderDate();

  // 載入資料
  loadData();
  render();

  // 新增按鈕
  document.getElementById('btnAdd').addEventListener('click', addGoal);

  // Enter 快速新增（在名稱欄位按 Enter）
  document.getElementById('fName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addGoal();
  });

  // 優先順序下拉顏色
  const priSel = document.getElementById('fPri');
  function updatePriColor() {
    priSel.className = `pri-${priSel.value}`;
  }
  priSel.addEventListener('change', updatePriColor);
  updatePriColor();

  // 如果有正在計時的 session（例如頁面重整），恢復計時
  // （sessions 最後一個 end 為 null 代表還在跑）
  const running = goals.find(g =>
    !g.done &&
    g.sessions?.length &&
    g.sessions[g.sessions.length - 1].end === null
  );
  if (running) {
    activeId = running.id;
    tickTimer = setInterval(tick, 1000);
    render();
  }
}

document.addEventListener('DOMContentLoaded', init);
