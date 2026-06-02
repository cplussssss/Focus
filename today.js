/* ============================================================
   today.js — 今日計畫 v3（Firestore 版）
   ・登入後資料存 Firestore：users/{uid}/dailyGoals/{YYYY-MM-DD}
   ・未登入降為 localStorage 暫存
   ・列表模式 + 四象限模式
   ・計時器（同時只能一個）
   ============================================================ */

const STORAGE_KEY  = 'today-plan-v2';
const THEME_KEY    = 'focus-theme';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain: 'focus-e5f62.firebaseapp.com',
  projectId: 'focus-e5f62',
  storageBucket: 'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId: '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

// ── 狀態 ──────────────────────────────────────────────────────
let goals      = [];
let activeId   = null;
let tickTimer  = null;
let draggedId  = null;
let activeTab  = 'list';
let showDoneList   = false;
let showDoneMatrix = false;
let editingId      = null;

// ── Firebase ──────────────────────────────────────────────────
let firebaseAuth = null;
let firestoreDb  = null;
let currentUser  = null;
let _saveTimer   = null;   // debounce 計時器

// ── 象限定義 ──────────────────────────────────────────────────
const QUADS = [
  { key:'q1', urgent:true,  important:true,  icon:'🔴', label:'緊急 ＋ 重要'     },
  { key:'q2', urgent:false, important:true,  icon:'🔵', label:'不緊急 ＋ 重要'   },
  { key:'q3', urgent:true,  important:false, icon:'🟡', label:'緊急 ＋ 不重要'   },
  { key:'q4', urgent:false, important:false, icon:'⚫', label:'不緊急 ＋ 不重要' },
];

function getQ(g) {
  if (g.urgent  && g.important)  return 'q1';
  if (!g.urgent && g.important)  return 'q2';
  if (g.urgent  && !g.important) return 'q3';
  return 'q4';
}

// ── 工具函式 ──────────────────────────────────────────────────
function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function pad(n)     { return String(n).padStart(2, '0'); }

function fmtSec(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtMin(min) {
  if (!min) return '0m';
  if (min >= 60) { const h = Math.floor(min/60); const r = min%60; return r ? `${h}h ${r}m` : `${h}h`; }
  return `${min}m`;
}

function fmtDeadline(dateStr) {
  if (!dateStr) return null;
  const today   = new Date(todayStr());
  const due     = new Date(dateStr);
  const diffDay = Math.round((due - today) / 86400000);
  if (diffDay < 0)   return { text: `逾期 ${-diffDay} 天`, cls: 'dl-over' };
  if (diffDay === 0) return { text: '今天截止',             cls: 'dl-today' };
  if (diffDay <= 2)  return { text: `還有 ${diffDay} 天`,   cls: 'dl-soon' };
  return { text: `${due.getMonth()+1}/${due.getDate()}`,    cls: 'dl-ok' };
}

function isNearDeadline(deadline) {
  if (!deadline) return false;
  const today   = new Date(todayStr());
  const due     = new Date(deadline);
  const diffDay = Math.round((due - today) / 86400000);
  return diffDay < 3;
}

function fmtDeadlineMx(dateStr) {
  if (!dateStr) return null;
  const today   = new Date(todayStr());
  const due     = new Date(dateStr);
  const diffDay = Math.round((due - today) / 86400000);
  const label   = `${due.getMonth()+1}/${due.getDate()}  D: ${diffDay}`;
  let cls = 'dl-ok';
  if (diffDay < 0)        cls = 'dl-over';
  else if (diffDay === 0) cls = 'dl-today';
  else if (diffDay <= 2)  cls = 'dl-soon';
  return { text: label, cls };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── 同步狀態顯示 ──────────────────────────────────────────────
function setSyncBadge(text) {
  const el = document.getElementById('todaySyncBadge');
  if (el) el.textContent = text;
}

// ── 資料：localStorage（本地備份 / 未登入用）─────────────────
function loadLocal() {
  try { goals = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { goals = []; }
  upgradeGoals();
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function upgradeGoals() {
  goals = goals.map(g => {
    if (!('urgent' in g)) {
      const map = { high:[true,true], mid:[false,true], low:[false,false] };
      const [u, i] = map[g.priority] || [false, false];
      g.urgent = u; g.important = i;
    }
    if (!('deadline' in g))   g.deadline   = null;
    if (!('sessions' in g))   g.sessions   = [];
    if (!('actualSec' in g))  g.actualSec  = 0;
    if (!('createdAt' in g))  g.createdAt  = Date.now();
    return g;
  });
}

// ── 資料：Firestore ───────────────────────────────────────────
// 跨天共用同一份文件：users/{uid}/todayPlan/main
function getPlanRef() {
  if (!firestoreDb || !currentUser) return null;
  return firestoreDb
    .collection('users').doc(currentUser.uid)
    .collection('todayPlan').doc('main');
}

async function loadFromFirestore() {
  const ref = getPlanRef();
  if (!ref) return;
  try {
    setSyncBadge('☁ 同步中…');

    // 先載入本地資料作為基底
    loadLocal();
    const localGoals = [...goals];

    const doc = await ref.get();
    if (doc.exists && Array.isArray(doc.data().goals)) {
      const remoteGoals = doc.data().goals;

      // 合併：以 id 為 key，取 updatedAt 或 actualSec 較新的那筆
      // 本地沒有的 → 從雲端補；雲端沒有的 → 從本地補
      const merged = new Map();
      localGoals.forEach(g  => merged.set(g.id, g));
      remoteGoals.forEach(g => {
        const local = merged.get(g.id);
        if (!local) {
          merged.set(g.id, g);          // 本地沒有，用雲端
        } else {
          // 比較 actualSec（計時器跑的），取較大的
          const useRemote = (g.actualSec || 0) >= (local.actualSec || 0);
          if (useRemote) merged.set(g.id, g);
        }
      });

      // 保留本地的順序（新增的排在後面）
      const localIds  = localGoals.map(g => g.id);
      const remoteIds = remoteGoals.map(g => g.id);
      const allIds    = [...new Set([...localIds, ...remoteIds])];
      goals = allIds.map(id => merged.get(id)).filter(Boolean);

      upgradeGoals();
      saveLocal();
    }
    // 若 Firestore 沒有資料，保持 loadLocal() 的結果

    setSyncBadge('✅ 已同步');
  } catch (err) {
    console.warn('Firestore 載入失敗，使用本地資料：', err);
    // 已在前面 loadLocal()，直接繼續
    setSyncBadge('⚠ 雲端載入失敗，使用本地資料');
  }
}

// debounce：避免每秒 tick 都寫 Firestore（最快 3 秒寫一次）
function scheduleSave() {
  saveLocal();
  if (!firestoreDb || !currentUser) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveToFirestore(), 1000);
}

async function saveToFirestore() {
  const ref = getPlanRef();
  if (!ref) return;
  try {
    setSyncBadge('☁ 儲存中…');
    await ref.set(
      { goals, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    setSyncBadge('✅ 已同步');
  } catch (err) {
    console.warn('Firestore 儲存失敗：', err);
    setSyncBadge('⚠ 儲存失敗');
  }
}

// 舊版相容的統一介面
function loadData()  { loadLocal(); }
function saveData()  { scheduleSave(); render(); }

// ── 計時器 ────────────────────────────────────────────────────
function startTimer(id) {
  if (activeId && activeId !== id) pauseTimer(activeId);
  const g = goals.find(g => g.id === id);
  if (!g || g.done) return;
  g.sessions.push({ start: Date.now(), end: null });
  activeId = id;
  if (!tickTimer) tickTimer = setInterval(tick, 1000);
  scheduleSave(); render();
}

function pauseTimer(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;
  const last = g.sessions[g.sessions.length - 1];
  if (last && !last.end) {
    last.end    = Date.now();
    g.actualSec = calcActualSec(g);
  }
  if (activeId === id) {
    activeId = null;
    clearInterval(tickTimer);
    tickTimer = null;
  }
  scheduleSave(); render();
}

function stopTimer(id) {
  pauseTimer(id);
  const g = goals.find(g => g.id === id);
  if (g) { g.done = true; scheduleSave(); }
  render();
}

function calcActualSec(g) {
  if (!g.sessions?.length) return 0;
  return g.sessions.reduce((acc, s) =>
    acc + Math.floor(((s.end || Date.now()) - s.start) / 1000), 0);
}

function tick() {
  if (!activeId) return;
  const g = goals.find(g => g.id === activeId);
  if (!g) return;
  g.actualSec = calcActualSec(g);
  scheduleSave();
  patchTimer(activeId);
  updateSummary();
}

// ── CRUD ──────────────────────────────────────────────────────
function addGoal() {
  const name      = document.getElementById('fName').value.trim();
  const estMin    = parseInt(document.getElementById('fTime').value) || 0;
  const deadline  = document.getElementById('fDeadline').value || null;
  const note      = document.getElementById('fNote').value.trim();
  const urgent    = document.getElementById('fUrgent').classList.contains('on');
  const important = document.getElementById('fImportant').classList.contains('on');

  if (!name) { document.getElementById('fName').focus(); return; }

  goals.push({
    id: uid(), name, estMin, urgent, important,
    deadline, note, done: false, actualSec: 0,
    sessions: [], createdAt: Date.now()
  });

  document.getElementById('fName').value     = '';
  document.getElementById('fTime').value     = '';
  document.getElementById('fDeadline').value = '';
  document.getElementById('fNote').value     = '';
  document.getElementById('fUrgent').classList.remove('on');
  document.getElementById('fImportant').classList.remove('on');

  scheduleSave(); render();
  document.getElementById('fName').focus();
}

function toggleDone(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;
  if (!g.done && activeId === id) pauseTimer(id);
  g.done = !g.done;
  scheduleSave(); render();
}

function deleteGoal(id) {
  if (activeId === id) {
    clearInterval(tickTimer); tickTimer = null; activeId = null;
  }
  goals = goals.filter(g => g.id !== id);
  scheduleSave(); render();
}

function moveToQuad(id, urgent, important) {
  const g = goals.find(g => g.id === id);
  if (!g) return;
  g.urgent = urgent; g.important = important;
  scheduleSave(); render();
}

// ── 渲染主入口 ────────────────────────────────────────────────
function render() {
  if (activeTab === 'list') renderList();
  else                      renderMatrix();
  updateSummary();
}

// ── 列表模式 ──────────────────────────────────────────────────
function renderList() {
  const list   = document.getElementById('goalsList');
  const done   = goals.filter(g =>  g.done);
  const active = goals.filter(g => !g.done);

  list.innerHTML = '';
  list.classList.toggle('editing-active', editingId !== null);
  if (active.length === 0) {
    list.innerHTML = `<div class="empty-hint"><div class="ei">📭</div>還沒有進行中的目標，從上方新增吧！</div>`;
  } else {
    active.forEach(g => list.appendChild(buildListCard(g)));
  }

  const sec = document.getElementById('completedSec');
  sec.innerHTML = '';
  if (done.length === 0) return;

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'btn-completed';
  btn.innerHTML = `已完成（${done.length}）${showDoneList ? ' ▲' : ' ▼'}`;
  btn.addEventListener('click', () => { showDoneList = !showDoneList; renderList(); });
  sec.appendChild(btn);

  if (showDoneList) {
    const wrap = document.createElement('div');
    wrap.className = 'completed-list';
    done.forEach(g => wrap.appendChild(buildListCard(g)));
    sec.appendChild(wrap);
  }
}

function buildListCard(g) {
  if (editingId === g.id) return buildEditCard(g);

  const isRunning  = (activeId === g.id);
  const actualSec  = g.actualSec || 0;
  const estSec     = (g.estMin || 0) * 60;
  const isOver     = actualSec > estSec && estSec > 0;
  const q          = getQ(g);
  const qNames     = { q1:'緊急重要', q2:'重要', q3:'緊急', q4:'一般' };
  const dl         = fmtDeadline(g.deadline);
  const autoUrgent = !g.urgent && isNearDeadline(g.deadline);

  const div = document.createElement('div');
  div.className = `goal-card${isRunning ? ' is-running' : ''}${g.done ? ' is-done' : ''}`;
  div.dataset.id = g.id;
  div.dataset.q  = q;

  div.innerHTML = `
    <button type="button" class="btn-del" data-action="delete" title="刪除">✕</button>
    ${!g.done ? `<button type="button" class="btn-edit" data-action="edit" title="修改">✏</button>` : ''}
    <div class="goal-top">
      <div class="goal-check" data-action="toggle">${g.done ? '✓' : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="goal-name">${escHtml(g.name)}</div>
        <div class="goal-meta">
          <span class="q-badge ${q}">${qNames[q]}</span>
          ${autoUrgent ? `<span class="q-badge q3">⚡ 緊急</span>` : ''}
          ${g.estMin ? `<span style="font-size:.7rem;color:var(--text-muted);font-family:var(--font-mono)">預計 ${fmtMin(g.estMin)}</span>` : ''}
          ${dl ? `<span class="dl-tag ${dl.cls}">📅 ${dl.text}</span>` : ''}
        </div>
      </div>
    </div>
    ${g.note ? `<div class="goal-note">${escHtml(g.note)}</div>` : ''}
    <div class="goal-timer-row">
      <div class="timer-sm" data-timer="${g.id}">${fmtSec(actualSec)}</div>
      <div class="time-info">
        ${g.estMin ? `<div class="tb"><span class="tb-l">預計</span><span class="tb-v">${fmtMin(g.estMin)}</span></div>` : ''}
        <div class="tb">
          <span class="tb-l">實際</span>
          <span class="tb-v${isOver ? ' over' : ''}">${fmtSec(actualSec)}</span>
        </div>
      </div>
      <div class="timer-btns">
        ${!g.done && !isRunning
          ? `<button type="button" class="btn-t start" data-action="start">▶ 開始</button>` : ''}
        ${isRunning
          ? `<button type="button" class="btn-t pause" data-action="pause">⏸ 暫停</button>` : ''}
        ${(isRunning || (actualSec > 0 && !g.done))
          ? `<button type="button" class="btn-t stop"  data-action="stop">✓ 完成</button>`  : ''}
      </div>
    </div>`;

  div.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const id = div.dataset.id;
    if (action === 'start')  startTimer(id);
    if (action === 'pause')  pauseTimer(id);
    if (action === 'stop')   stopTimer(id);
    if (action === 'toggle') toggleDone(id);
    if (action === 'delete') deleteGoal(id);
    if (action === 'edit')   { editingId = id; render(); }
  });

  return div;
}

function buildEditCard(g) {
  const div = document.createElement('div');
  div.className = 'goal-card editing';
  div.dataset.id = g.id;
  div.dataset.q  = getQ(g);

  div.innerHTML = `
    <div class="edit-card-inner">
      <div class="goal-name" style="margin-bottom:8px">${escHtml(g.name)}</div>
      <div class="edit-row">
        <div style="flex:1;min-width:90px">
          <label style="font-size:.67rem;color:var(--text-label);font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">預計（分）</label>
          <input type="number" class="edit-estMin" value="${g.estMin || ''}" min="1" max="999" placeholder="30" />
        </div>
        <div style="flex:1;min-width:130px">
          <label style="font-size:.67rem;color:var(--text-label);font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">截止日期</label>
          <input type="date" class="edit-deadline" value="${g.deadline || ''}" />
        </div>
      </div>
      <div class="edit-row edit-row--compact" style="gap:8px">
        <span style="font-size:.67rem;color:var(--text-label);font-weight:600;text-transform:uppercase;letter-spacing:.06em">緊急 / 重要</span>
        <button type="button" class="toggle-btn edit-urgent${g.urgent ? ' on' : ''}">⚡ 緊急</button>
        <button type="button" class="toggle-btn edit-important${g.important ? ' on' : ''}">⭐ 重要</button>
      </div>
      <div class="edit-row">
        <div style="flex:1">
          <label style="font-size:.67rem;color:var(--text-label);font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">備註說明</label>
          <input type="text" class="edit-note" value="${escHtml(g.note || '')}" placeholder="補充說明（可省略）" />
        </div>
      </div>
      <div class="edit-actions">
        <button type="button" class="btn-add" style="flex:1;padding:8px;margin:0" data-action="save">儲存</button>
        <button type="button" class="btn btn-secondary" style="flex:1;padding:8px" data-action="cancel">取消</button>
      </div>
    </div>`;

  div.querySelector('.edit-urgent').addEventListener('click', function () { this.classList.toggle('on'); });
  div.querySelector('.edit-important').addEventListener('click', function () { this.classList.toggle('on'); });

  div.querySelector('[data-action="save"]').addEventListener('click', () => {
    const estMin    = parseInt(div.querySelector('.edit-estMin').value) || 0;
    const deadline  = div.querySelector('.edit-deadline').value         || null;
    const urgent    = div.querySelector('.edit-urgent').classList.contains('on');
    const important = div.querySelector('.edit-important').classList.contains('on');
    const note      = div.querySelector('.edit-note').value.trim();
    Object.assign(g, { estMin, deadline, urgent, important, note });
    editingId = null;
    scheduleSave(); render();
  });

  div.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    editingId = null;
    render();
  });

  return div;
}

// ── 四象限模式 ────────────────────────────────────────────────
function renderMatrix() {
  const cross = document.getElementById('matrixCross');
  cross.querySelectorAll('.quadrant').forEach(el => el.remove());

  QUADS.forEach(qDef => {
    const items = goals.filter(g => !g.done && getQ(g) === qDef.key);

    const qDiv = document.createElement('div');
    qDiv.className = `quadrant ${qDef.key}`;
    qDiv.dataset.urgent    = qDef.urgent;
    qDiv.dataset.important = qDef.important;

    if (items.length === 0) {
      qDiv.innerHTML = `<span class="mx-empty">拖曳任務至此</span>`;
    } else {
      items.forEach(g => qDiv.appendChild(buildMatrixCard(g)));
    }

    qDiv.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      qDiv.classList.add('drag-over');
    });
    qDiv.addEventListener('dragleave', e => {
      if (!qDiv.contains(e.relatedTarget)) qDiv.classList.remove('drag-over');
    });
    qDiv.addEventListener('drop', e => {
      e.preventDefault();
      qDiv.classList.remove('drag-over');
      if (!draggedId) return;
      const u = qDiv.dataset.urgent    === 'true';
      const i = qDiv.dataset.important === 'true';
      moveToQuad(draggedId, u, i);
      draggedId = null;
    });

    cross.appendChild(qDiv);
  });

  const sec = document.getElementById('completedSecMx');
  sec.innerHTML = '';
  const done = goals.filter(g => g.done);
  if (done.length === 0) return;

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'btn-completed';
  btn.innerHTML = `已完成（${done.length}）${showDoneMatrix ? ' ▲' : ' ▼'}`;
  btn.addEventListener('click', () => { showDoneMatrix = !showDoneMatrix; renderMatrix(); });
  sec.appendChild(btn);

  if (showDoneMatrix) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;';
    done.forEach(g => {
      const card = buildMatrixCard(g);
      card.draggable = false;
      wrap.appendChild(card);
    });
    sec.appendChild(wrap);
  }
}

function buildMatrixCard(g) {
  const isRunning = (activeId === g.id);
  const dl        = fmtDeadlineMx(g.deadline);

  const div = document.createElement('div');
  div.className = `mx-card${isRunning ? ' is-running' : ''}${g.done ? ' is-done' : ''}`;
  div.dataset.id = g.id;
  div.draggable  = !g.done;

  const dlCls  = dl ? dl.cls : 'dl-none';
  const dlText = dl ? escHtml(dl.text) : '&nbsp;';

  const timerHtml = (isRunning || g.actualSec > 0)
    ? `<div class="mc-sub">
         ${isRunning ? '<span class="mc-run-dot"></span>' : ''}
         <span data-timer="${g.id}">${fmtSec(g.actualSec || 0)}</span>
       </div>`
    : `<span data-timer="${g.id}" hidden></span>`;

  div.innerHTML = `
    <button type="button" class="mc-check-btn" title="${g.done ? '取消完成' : '標記完成'}">${g.done ? '✓' : ''}</button>
    <div class="mc-dl ${dlCls}">${dlText}</div>
    <div class="mc-name">${escHtml(g.name)}</div>
    ${timerHtml}`;

  div.querySelector('.mc-check-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleDone(g.id);
  });

  div.addEventListener('dragstart', e => {
    draggedId = g.id;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', g.id);
  });
  div.addEventListener('dragend', () => div.classList.remove('dragging'));

  return div;
}

// ── 局部更新計時器 ────────────────────────────────────────────
function patchTimer(id) {
  const g = goals.find(g => g.id === id);
  if (!g) return;
  const sec    = g.actualSec || 0;
  const estSec = (g.estMin || 0) * 60;
  const isOver = sec > estSec && estSec > 0;

  document.querySelectorAll(`[data-timer="${id}"]`).forEach(el => {
    el.textContent = fmtSec(sec);
    el.hidden = false;
  });

  const card = document.querySelector(`.goal-card[data-id="${id}"]`);
  if (card) {
    const tbvs = card.querySelectorAll('.tb-v');
    const lastTbv = tbvs[tbvs.length - 1];
    if (lastTbv) {
      lastTbv.textContent = fmtSec(sec);
      lastTbv.classList.toggle('over', isOver);
    }
  }
}

// ── 統計摘要 ──────────────────────────────────────────────────
function updateSummary() {
  const total     = goals.length;
  const doneCount = goals.filter(g => g.done).length;
  const planned   = goals.reduce((a, g) => a + (g.estMin || 0), 0);
  const actualSec = goals.reduce((a, g) => a + (g.actualSec || 0), 0);
  const actualMin = Math.round(actualSec / 60);

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = doneCount;
  document.getElementById('statPlanned').textContent = fmtMin(planned);
  const actEl = document.getElementById('statActual');
  actEl.textContent = fmtMin(actualMin);
  actEl.classList.toggle('warn', actualMin > planned && planned > 0);
}

// ── 頁籤切換 ──────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('viewList').hidden   = (tab !== 'list');
  document.getElementById('viewMatrix').hidden = (tab !== 'matrix');
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab));
  render();
}

// ── 主題 ──────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.getElementById('btnTheme').textContent = theme === 'light' ? '🌙' : '☀️';
}
function toggleTheme() {
  const next = (document.documentElement.dataset.theme || 'dark') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

// ── 日期顯示 ──────────────────────────────────────────────────
function renderDate() {
  const now  = new Date();
  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('todayDate').textContent =
    `${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} （週${days[now.getDay()]}）`;
}

// ── Firebase 初始化 ───────────────────────────────────────────
function initFirebase() {
  try {
    // 避免重複初始化（index.html 也載入同一個 firebase SDK）
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    firebaseAuth = firebase.auth();
    firestoreDb  = firebase.firestore();

    firebaseAuth.onAuthStateChanged(async (user) => {
      currentUser = user;
      const badge = document.getElementById('todaySyncBadge');

      if (user) {
        if (badge) badge.textContent = `☁ ${user.email}`;
        // 從 Firestore 載入今天的資料（以雲端為主）
        await loadFromFirestore();
        render();
        // 恢復計時器
        resumeRunningTimer();
      } else {
        if (badge) badge.textContent = '未登入（本地模式）';
        // 未登入：用 localStorage
        loadLocal();
        render();
        resumeRunningTimer();
      }
    });
  } catch (err) {
    console.error('Firebase 初始化失敗：', err);
    // 降為本地模式
    loadLocal();
    render();
    resumeRunningTimer();
  }
}

// ── 恢復計時（重整後） ────────────────────────────────────────
function resumeRunningTimer() {
  const running = goals.find(g =>
    !g.done &&
    g.sessions?.length &&
    g.sessions[g.sessions.length - 1].end === null
  );
  if (running) {
    activeId  = running.id;
    tickTimer = setInterval(tick, 1000);
    render();
  }
}

// ── 初始化 ────────────────────────────────────────────────────
function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);

  renderDate();

  // 頁籤
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // 新增
  document.getElementById('btnAdd').addEventListener('click', addGoal);
  document.getElementById('fName').addEventListener('keydown', e => {
    if (e.key === 'Enter') addGoal();
  });

  // 緊急 / 重要 toggle
  ['fUrgent', 'fImportant'].forEach(id => {
    document.getElementById(id).addEventListener('click', function () {
      this.classList.toggle('on');
    });
  });

  // Firebase 初始化（會觸發 onAuthStateChanged → 載入資料 → render）
  initFirebase();
}

document.addEventListener('DOMContentLoaded', init);

// 頁面關閉 / 重整前強制存一次（清掉 debounce，立即寫）
window.addEventListener('beforeunload', () => {
  clearTimeout(_saveTimer);
  saveLocal(); // localStorage 一定存得到
  // Firestore 用 navigator.sendBeacon 無法用，改用同步 fetch 也不可靠
  // 所以這裡只保證 localStorage，Firestore 靠載入時的合併邏輯補回來
  saveToFirestore();
});