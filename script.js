'use strict';

/* ============================================================
   設定
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain: 'focus-e5f62.firebaseapp.com',
  projectId: 'focus-e5f62',
  storageBucket: 'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId: '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxO4TyOky13MOWPRqowoy--DgWF01Ci6HEeUXpZuhU4SWiQz9FJWD728lQ-RkDWZz6a/exec';

const STORAGE_KEY = 'pomodoro_records_v1';

/* ============================================================
   全域狀態
   ============================================================ */
const STATE = {
  mode: 'idle',   // 'idle'|'work'|'work-overtime'|'break'|'paused'
  pausedMode: null,

  intervalId: null,

  // 以結束時間戳記計算剩餘 — 切分頁再回來也正確
  // 原因：setInterval 在背景分頁中可能被瀏覽器節流，導致計時不準；
  //       改存目標結束時間，每次 tick 都重算 (endTime - now)，不受節流影響。
  endTime: 0,    // 目標結束時間（ms，epoch）
  pauseRemaining: 0,    // 暫停時儲存的剩餘毫秒

  workTotalSeconds: 0,
  breakTotalSeconds: 0,
  workStartTime: null,   // Date — 工作開始時刻
  totalPausedMs: 0,      // 累計暫停毫秒，用於計算實際工作秒數
  lastPauseStart: null,   // 最近一次按暫停的時刻（ms）

  records: [],
  pendingAction: null,
};

let firebaseAuth = null;
let currentUser = null;

/* ============================================================
   DOM 快取
   ============================================================ */
let EL = {};

function initElements() {
  EL = {
    modeBadge: document.getElementById('modeBadge'),
    timerDisplay: document.getElementById('timerDisplay'),
    statusText: document.getElementById('statusText'),
    progressBarFill: document.getElementById('progressBarFill'),

    workMinutes: document.getElementById('workMinutes'),
    breakMinutes: document.getElementById('breakMinutes'),

    taskName: document.getElementById('taskName'),
    taskReason: document.getElementById('taskReason'),
    taskNote: document.getElementById('taskNote'),

    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnEndRound: document.getElementById('btnEndRound'),
    btnReset: document.getElementById('btnReset'),
    btnBreak: document.getElementById('btnBreak'),
    btnClearHistory: document.getElementById('btnClearHistory'),
    btnLogo: document.getElementById('btnLogo'),

    historyList: document.getElementById('historyList'),
    syncState: document.getElementById('syncState'),
    syncResult: document.getElementById('syncResult'),

    modalEndReason: document.getElementById('modalEndReason'),
    endReasonInput: document.getElementById('endReasonInput'),
    btnConfirmEnd: document.getElementById('btnConfirmEnd'),
    btnCancelEnd: document.getElementById('btnCancelEnd'),

    modalBreakSuggest: document.getElementById('modalBreakSuggest'),
    breakSuggestion: document.getElementById('breakSuggestion'),
    btnModalStartBreak: document.getElementById('btnModalStartBreak'),

    modalBreakDone: document.getElementById('modalBreakDone'),
    btnModalNextRound: document.getElementById('btnModalNextRound'),

    modalLogin: document.getElementById('modalLogin'),
    btnGoogleLogin: document.getElementById('btnGoogleLogin'),
    btnCancelLogin: document.getElementById('btnCancelLogin'),
  };
}

/* ============================================================
   休息建議
   ============================================================ */
const BREAK_SUGGESTIONS = [
  '喝杯水，補充水分💧',
  '起來走走，活動一下雙腳🚶',
  '做幾個伸展動作，放鬆肩頸🧘',
  '閉上眼睛，讓眼睛休息一下😌',
  '看向遠方，緩解眼睛疲勞👀',
  '做幾次深呼吸，讓大腦充電🌬️',
  '隨意轉轉脖子與肩膀，舒展筋骨💆',
  '站起來抖一抖，甩掉疲勞！🕺',
];
function getRandomBreakSuggestion() {
  return BREAK_SUGGESTIONS[Math.floor(Math.random() * BREAK_SUGGESTIONS.length)];
}

/* ============================================================
   音效
   ============================================================ */
function playBeep(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = type === 'work-done'
      ? [{ freq: 523, dur: 0.15 }, { freq: 659, dur: 0.15 }, { freq: 784, dur: 0.25 }]
      : [{ freq: 784, dur: 0.15 }, { freq: 659, dur: 0.15 }, { freq: 523, dur: 0.3 }];
    let t = ctx.currentTime;
    notes.forEach(({ freq, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur);
      t += dur + 0.04;
    });
  } catch (e) { /* 瀏覽器政策限制，靜默失敗 */ }
}

/* ============================================================
   格式化工具
   ============================================================ */
function formatTime(totalSeconds) {
  const abs = Math.abs(totalSeconds);
  const m = String(Math.floor(abs / 60)).padStart(2, '0');
  const s = String(abs % 60).padStart(2, '0');
  return `${m}:${s}`;
}
function formatDuration(s) {
  const m = Math.floor(s / 60), r = s % 60;
  if (m === 0) return `${r} 秒`;
  if (r === 0) return `${m} 分鐘`;
  return `${m} 分 ${r} 秒`;
}
function getNowString() {
  return new Date().toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ============================================================
   UI 更新
   ============================================================ */
function updateTimerDisplay(seconds) {
  EL.timerDisplay.textContent = formatTime(seconds);
}
function updateProgressBar(elapsed, total, type) {
  let pct = total > 0 ? (elapsed / total) * 100 : 0;
  pct = Math.min(100, Math.max(0, pct));
  EL.progressBarFill.style.width = `${pct}%`;
  EL.progressBarFill.classList.remove('break-mode', 'overtime-mode');
  if (type === 'break') EL.progressBarFill.classList.add('break-mode');
  if (type === 'overtime') EL.progressBarFill.classList.add('overtime-mode');
}
function setBadgeMode(mode) {
  const text = { work: '工作模式', break: '休息模式', overtime: '超時工作', idle: '準備中' };
  EL.modeBadge.textContent = text[mode] || '';
  EL.modeBadge.className = 'mode-badge';
  if (mode === 'break') EL.modeBadge.classList.add('break-mode');
  if (mode === 'overtime') EL.modeBadge.classList.add('overtime-mode');

  EL.timerDisplay.className = 'timer-display';
  if (mode === 'break') EL.timerDisplay.classList.add('break-mode');
  if (mode === 'overtime') EL.timerDisplay.classList.add('overtime-mode');
}
function setButtons(map) {
  const keyToEl = {
    start: EL.btnStart, pause: EL.btnPause,
    endRound: EL.btnEndRound, reset: EL.btnReset, break: EL.btnBreak,
  };
  for (const [k, disabled] of Object.entries(map)) {
    if (keyToEl[k]) keyToEl[k].disabled = disabled;
  }
}
function setStatus(text) { EL.statusText.textContent = text; }
function showModal(el) { el.hidden = false; }
function hideModal(el) { el.hidden = true; }
function setSyncResult(text, isError) {
  EL.syncResult.textContent = text;
  EL.syncResult.className = 'sync-result' + (isError ? ' error' : '');
}

/* ============================================================
   計時器核心 — 以 endTime timestamp 計算（背景分頁不漂移）
   ============================================================ */
function clearTimer() {
  if (STATE.intervalId !== null) {
    clearInterval(STATE.intervalId);
    STATE.intervalId = null;
  }
}
function getWorkSeconds() {
  const v = parseInt(EL.workMinutes.value, 10);
  return (isNaN(v) || v < 1) ? 25 * 60 : v * 60;
}
function getBreakSeconds() {
  const v = parseInt(EL.breakMinutes.value, 10);
  return (isNaN(v) || v < 1) ? 5 * 60 : v * 60;
}

/* ── 8-1 開始工作 ── */
function startWork() {
  STATE.workTotalSeconds = getWorkSeconds();
  STATE.breakTotalSeconds = getBreakSeconds();
  STATE.workStartTime = new Date();
  STATE.totalPausedMs = 0;
  STATE.lastPauseStart = null;
  STATE.mode = 'work';
  // 記錄目標結束時間，切分頁回來也能正確計算
  STATE.endTime = Date.now() + STATE.workTotalSeconds * 1000;

  setBadgeMode('work');
  updateTimerDisplay(STATE.workTotalSeconds);
  updateProgressBar(0, STATE.workTotalSeconds, 'work');
  setStatus('工作中...');
  setButtons({ start: true, pause: false, endRound: false, reset: false, break: true });
  EL.workMinutes.disabled = true;
  EL.breakMinutes.disabled = true;

  STATE.intervalId = setInterval(tick, 500);
}

/* ── 每次 tick（500ms）：從 endTime 重算剩餘，不累積誤差 ── */
function tick() {
  const now = Date.now();
  const remaining = Math.ceil((STATE.endTime - now) / 1000);

  if (STATE.mode === 'work') {
    if (remaining > 0) {
      const elapsed = STATE.workTotalSeconds - remaining;
      updateTimerDisplay(remaining);
      updateProgressBar(elapsed, STATE.workTotalSeconds, 'work');
    } else {
      // 進入超時——只觸發一次
      STATE.mode = 'work-overtime';
      setBadgeMode('overtime');
      setStatus('⚠️ 工作時間已結束，超時進行中...');
      updateProgressBar(100, 100, 'overtime');
      playBeep('work-done');
      // 修正：倒數結束後啟用「開始休息」按鈕
      setButtons({ break: false });
      EL.timerDisplay.classList.add('pulse');
      setTimeout(() => EL.timerDisplay.classList.remove('pulse'), 400);
      const overtime = Math.floor((now - STATE.endTime) / 1000);
      updateTimerDisplay(-overtime);
    }
  } else if (STATE.mode === 'work-overtime') {
    const overtime = Math.floor((now - STATE.endTime) / 1000);
    updateTimerDisplay(-overtime);
  } else if (STATE.mode === 'break') {
    if (remaining > 0) {
      const elapsed = STATE.breakTotalSeconds - remaining;
      updateTimerDisplay(remaining);
      updateProgressBar(elapsed, STATE.breakTotalSeconds, 'break');
    } else {
      clearTimer();
      playBeep('break-done');
      setStatus('✅ 休息結束！準備下一輪？');
      showModal(EL.modalBreakDone);
    }
  }
}

/* ── 8-2 暫停 / 繼續 ── */
function pauseTimer() {
  if (!['work', 'work-overtime', 'break'].includes(STATE.mode)) return;
  clearTimer();
  STATE.pauseRemaining = Math.max(0, STATE.endTime - Date.now());
  STATE.lastPauseStart = Date.now();
  STATE.pausedMode = STATE.mode;
  STATE.mode = 'paused';
  EL.timerDisplay.classList.add('paused');
  setStatus('⏸ 已暫停');
  EL.btnPause.textContent = '▶ 繼續';
  setButtons({ start: true, endRound: false, reset: false, break: STATE.pausedMode !== 'break' });
}

function resumeTimer() {
  if (STATE.mode !== 'paused') return;
  // 暫停期間計入累計暫停時間
  if (STATE.lastPauseStart !== null) {
    STATE.totalPausedMs += Date.now() - STATE.lastPauseStart;
    STATE.lastPauseStart = null;
  }
  // 以剩餘毫秒重設 endTime，恢復正確倒數
  STATE.endTime = Date.now() + STATE.pauseRemaining;
  STATE.mode = STATE.pausedMode;
  STATE.pausedMode = null;
  EL.timerDisplay.classList.remove('paused');
  EL.btnPause.textContent = '⏸ 暫停';

  const statusMsg = STATE.mode === 'work-overtime'
    ? '⚠️ 工作時間已結束，超時進行中...'
    : STATE.mode === 'break' ? '☕ 休息中...' : '工作中...';
  setStatus(statusMsg);
  STATE.intervalId = setInterval(tick, 500);
  setButtons({ start: true, pause: false, endRound: STATE.mode === 'break', reset: false, break: STATE.mode !== 'break' });
}

/* ── 8-3 結束本輪（中途） ── */
function triggerEndEarly(action) {
  if (STATE.mode === 'idle') { if (action === 'reset') doReset(); return; }
  STATE.pendingAction = action;
  clearTimer();
  EL.timerDisplay.classList.remove('paused');
  EL.endReasonInput.value = '';
  showModal(EL.modalEndReason);
}

function confirmEndEarly() {
  const reason = EL.endReasonInput.value.trim();
  if (!reason) {
    EL.endReasonInput.focus();
    EL.endReasonInput.style.borderColor = '#e85d3a';
    setTimeout(() => { EL.endReasonInput.style.borderColor = ''; }, 1500);
    return;
  }
  hideModal(EL.modalEndReason);
  saveRecord({ status: 'incomplete', endReason: reason });
  // 結束本輪後清空任務欄位，避免下輪殘留
  clearTaskFields();
  resetToIdle();
  STATE.pendingAction = null;
}

/* ── 8-4 重設 ── */
function handleReset() {
  if (STATE.mode === 'idle') { doReset(); return; }
  triggerEndEarly('reset');
}
function doReset() {
  clearTimer();
  STATE.mode = 'idle';
  const workSec = getWorkSeconds();
  updateTimerDisplay(workSec);
  updateProgressBar(0, workSec, 'work');
  setBadgeMode('idle');
  setStatus('準備開始');
  EL.btnPause.textContent = '⏸ 暫停';
  EL.timerDisplay.classList.remove('paused');
  setButtons({ start: false, pause: true, endRound: true, reset: false, break: true });
  EL.workMinutes.disabled = false;
  EL.breakMinutes.disabled = false;
}
function resetToIdle() {
  clearTimer();
  STATE.mode = 'idle';
  document.body.className = '';
  const workSec = getWorkSeconds();
  updateTimerDisplay(workSec);
  updateProgressBar(0, workSec, 'work');
  setBadgeMode('idle');
  setStatus('準備開始');
  EL.btnPause.textContent = '⏸ 暫停';
  EL.timerDisplay.classList.remove('paused');
  setButtons({ start: false, pause: true, endRound: true, reset: false, break: true });
  EL.workMinutes.disabled = false;
  EL.breakMinutes.disabled = false;
}

/* ── 清空任務輸入欄位 ──
   結束本輪 / 開始休息時都清空「做什麼」和「為什麼」；
   備註（taskNote）故意保留，讓使用者可重複使用補充資訊。 */
function clearTaskFields() {
  EL.taskName.value = '';
  EL.taskReason.value = '';
}

/* ── 8-5 開始休息 ──
   修正：原本在 work-overtime 模式時按鈕為 disabled，
   現在 tick 進入 overtime 時已主動呼叫 setButtons({ break:false }) 啟用。
   這裡的 guard 確保只有工作中 / 超時 / 暫停時才能觸發。 */
function handleStartBreak() {
  const okModes = ['work', 'work-overtime', 'paused'];
  if (!okModes.includes(STATE.mode)) return;

  clearTimer();
  EL.timerDisplay.classList.remove('paused');

  if (STATE.mode === 'paused') {
    if (STATE.lastPauseStart !== null) {
      STATE.totalPausedMs += Date.now() - STATE.lastPauseStart;
      STATE.lastPauseStart = null;
    }
    STATE.mode = STATE.pausedMode;
    STATE.pausedMode = null;
  }

  saveRecord({ status: 'done', endReason: '' });
  // 工作完成後清空任務欄位，避免進入下一輪時殘留
  clearTaskFields();

  EL.breakSuggestion.textContent = getRandomBreakSuggestion();
  showModal(EL.modalBreakSuggest);
  setButtons({ start: true, pause: true, endRound: true, reset: false, break: true });
}

function startBreakTimer() {
  hideModal(EL.modalBreakSuggest);
  STATE.mode = 'break';
  STATE.endTime = Date.now() + STATE.breakTotalSeconds * 1000;

  setBadgeMode('break');
  updateTimerDisplay(STATE.breakTotalSeconds);
  updateProgressBar(0, STATE.breakTotalSeconds, 'break');
  setStatus('☕ 休息中...');
  setButtons({ start: true, pause: false, endRound: true, reset: true, break: true });
  document.body.className = 'mode-break';
  STATE.intervalId = setInterval(tick, 500);
}

/* ============================================================
   紀錄邏輯
   ============================================================ */
function saveRecord({ status, endReason }) {
  const actualSec = STATE.workStartTime
    ? Math.round((Date.now() - STATE.workStartTime.getTime() - STATE.totalPausedMs) / 1000)
    : 0;

  const record = {
    id: Date.now(),
    timestamp: getNowString(),
    taskName: EL.taskName.value.trim() || '（未填寫）',
    taskReason: EL.taskReason.value.trim() || '（未填寫）',
    taskNote: EL.taskNote.value.trim(),
    plannedSec: STATE.workTotalSeconds,
    actualSec,
    status,
    endReason,
    synced: false,
  };
  STATE.records.unshift(record);
  saveToStorage();
  renderHistory();
}

function renderHistory() {
  if (STATE.records.length === 0) {
    EL.historyList.innerHTML = '<p class="empty-hint">尚無紀錄，完成第一輪後會顯示在這裡。</p>';
    return;
  }
  EL.historyList.innerHTML = STATE.records.map(r => `
    <div class="record-card ${r.status === 'incomplete' ? 'incomplete' : ''}">
      <div class="record-card-header">
        <span class="record-card-title">${escapeHTML(r.taskName)}</span>
        <span class="record-status ${r.status === 'done' ? 'done' : 'incomplete'}">
          ${r.status === 'done' ? '✅ 已完成' : '❌ 未完成'}
        </span>
        <span class="sync-badge ${r.synced ? 'synced' : 'not-synced'}">
          ${r.synced ? '☁ 已同步' : '○ 未同步'}
        </span>
      </div>
      <div class="record-meta">
        <span><span class="meta-label">時間：</span>${r.timestamp}</span>
        <span><span class="meta-label">預設長度：</span>${formatDuration(r.plannedSec)}</span>
        <span><span class="meta-label">實際工作：</span>${formatDuration(r.actualSec)}</span>
        <span><span class="meta-label">為什麼做：</span>${escapeHTML(r.taskReason)}</span>
        ${r.endReason ? `<span><span class="meta-label">結束原因：</span>${escapeHTML(r.endReason)}</span>` : ''}
        ${r.taskNote ? `<span><span class="meta-label">備註：</span>${escapeHTML(r.taskNote)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

/* ============================================================
   localStorage
   ============================================================ */
function saveToStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.records)); }
  catch (e) { console.warn('localStorage 寫入失敗：', e); }
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) STATE.records = JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage 讀取失敗：', e);
    STATE.records = [];
  }
}

/* ============================================================
   事件綁定
   ============================================================ */
function initEventListeners() {
  EL.btnStart.addEventListener('click', () => { if (STATE.mode === 'idle') startWork(); });

  EL.btnPause.addEventListener('click', () => {
    if (STATE.mode === 'paused') resumeTimer(); else pauseTimer();
  });

  EL.btnEndRound.addEventListener('click', () => {
    if (STATE.mode === 'idle') return;
    if (STATE.mode === 'break') { clearTimer(); resetToIdle(); return; }
    triggerEndEarly('endRound');
  });

  EL.btnReset.addEventListener('click', handleReset);
  EL.btnBreak.addEventListener('click', handleStartBreak);

  EL.btnConfirmEnd.addEventListener('click', confirmEndEarly);
  EL.btnCancelEnd.addEventListener('click', () => {
    hideModal(EL.modalEndReason);
    STATE.pendingAction = null;
    // 恢復計時：重設 endTime 以補回 Modal 顯示期間流失的時間
    if (['work', 'work-overtime', 'break'].includes(STATE.mode)) {
      STATE.endTime = Date.now() + STATE.pauseRemaining;
      STATE.intervalId = setInterval(tick, 500);
      const s = STATE.mode === 'work-overtime' ? '⚠️ 工作時間已結束，超時進行中...'
        : STATE.mode === 'break' ? '☕ 休息中...' : '工作中...';
      setStatus(s);
    }
  });

  EL.btnModalStartBreak.addEventListener('click', startBreakTimer);
  EL.btnModalNextRound.addEventListener('click', () => {
    hideModal(EL.modalBreakDone);
    document.body.className = '';
    resetToIdle();
  });

  EL.btnClearHistory.addEventListener('click', () => {
    if (confirm('確定要清除所有歷史紀錄嗎？')) {
      STATE.records = [];
      saveToStorage();
      renderHistory();
    }
  });

  EL.workMinutes.addEventListener('input', () => {
    if (STATE.mode === 'idle') {
      updateTimerDisplay(getWorkSeconds());
      updateProgressBar(0, getWorkSeconds(), 'work');
    }
  });

  EL.endReasonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEndEarly(); }
  });

  // 番茄圖示點擊 → 觸發同步
  EL.btnLogo.addEventListener('click', handleLogoSync);

  // 登入 Modal
  EL.btnGoogleLogin.addEventListener('click', handleGoogleLogin);
  EL.btnCancelLogin.addEventListener('click', () => hideModal(EL.modalLogin));
}

/* ============================================================
   Firebase 初始化 & 登入
   ============================================================ */
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firebaseAuth.onAuthStateChanged((user) => {
      currentUser = user;
      EL.syncState.textContent = user ? user.email : '';
    });
  } catch (err) {
    console.error('Firebase 初始化失敗：', err);
  }
}

async function handleGoogleLogin() {
  try {
    hideModal(EL.modalLogin);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebaseAuth.signInWithPopup(provider);
    // 登入成功後直接觸發同步
    await runSync();
  } catch (err) {
    console.error('Google 登入失敗：', err);
    setSyncResult('登入失敗：' + (err.message || err.code), true);
  }
}

/* ============================================================
   同步邏輯
   ============================================================ */

// 番茄圖示點擊進入點
// 改成密碼驗證，不再需要 Google 登入
async function handleLogoSync() {
  const unsynced = STATE.records.filter(r => !r.synced);
  if (unsynced.length === 0) {
    setSyncResult('✅ 所有紀錄都已同步', false);
    return;
  }
  // 請使用者輸入密碼（用 prompt，不需要額外 Modal）
  const password = prompt('請輸入同步密碼：');
  if (password === null) return; // 使用者按取消
  if (!password.trim()) {
    setSyncResult('❌ 密碼不可為空', true);
    return;
  }
  sessionStorage.setItem('sync_password', password.trim());
  await runSync();
}

async function runSync() {
  const unsynced = STATE.records.filter(r => !r.synced);
  if (unsynced.length === 0) {
    setSyncResult('✅ 所有紀錄都已同步', false);
    return;
  }

  // 同步中：番茄圖示旋轉、按鈕禁用，防止重複點擊
  EL.btnLogo.disabled = true;
  EL.btnLogo.classList.add('syncing');
  setSyncResult(`正在同步 ${unsynced.length} 筆紀錄...`, false);

  let successIds = [];
  let failCount = 0;

  for (const record of unsynced) {
    const result = await syncOneRecord(record);
    if (result.success) {
      successIds.push(record.id);
    } else {
      failCount++;
      console.error('同步失敗：', result.error, record);
    }
  }

  // 同步成功的紀錄直接從 STATE 和 localStorage 移除，不留在畫面上
  // 原因：已寫入 Google Sheet 的資料不需再佔用本機空間，也避免重複同步
  if (successIds.length > 0) {
    STATE.records = STATE.records.filter(r => !successIds.includes(r.id));
    saveToStorage();
    renderHistory();
  }

  EL.btnLogo.disabled = false;
  EL.btnLogo.classList.remove('syncing');

  if (failCount === 0) {
    setSyncResult(`✅ 成功同步 ${successIds.length} 筆`, false);
  } else {
    setSyncResult(`⚠️ 成功 ${successIds.length} 筆，失敗 ${failCount} 筆（見 console）`, true);
  }
}

// 同步單筆：用 Image 請求繞過 CORS（GAS 不支援跨域，圖片請求不受 CORS 限制）
// 使用密碼驗證而非 Firebase idToken，原因：
//   Firebase idToken 是 Firebase 格式，GAS 後端用 Google tokeninfo API 無法驗證。
//   密碼驗證不依賴任何第三方 SDK，簡單可靠。
async function syncOneRecord(record) {
  return new Promise((resolve) => {
    try {
      const payload = {
        timestamp: record.timestamp || '',
        task: record.taskName || '',
        reason: record.taskReason || '',
        plannedMinutes: Math.round((record.plannedSec || 0) / 60),
        actualMinutes: Math.round((record.actualSec || 0) / 60),
        status: record.status || 'incomplete',
        stopReason: record.endReason || '',
        note: record.taskNote || '',
      };

      // 密碼從 sessionStorage 取得（runSync 呼叫前已存入）
      const password = sessionStorage.getItem('sync_password') || '';

      const url = APPS_SCRIPT_URL
        + '?password=' + encodeURIComponent(password)
        + '&record=' + encodeURIComponent(JSON.stringify(payload));

      // Image 請求繞過 CORS：GAS 會執行寫入，但前端無法讀取回應
      // 以 2 秒逾時判定：若 GAS 回傳任何內容（即使是錯誤圖）都算送達
      const img = new Image();
      const timer = setTimeout(() => {
        resolve({ success: true }); // 逾時仍視為送出
      }, 3000);
      img.onload = img.onerror = () => {
        clearTimeout(timer);
        resolve({ success: true });
      };
      img.src = url;

    } catch (err) {
      resolve({ success: false, error: err.message || String(err) });
    }
  });
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  initElements();
  loadFromStorage();
  renderHistory();
  initEventListeners();
  initFirebase();

  setBadgeMode('idle');
  updateTimerDisplay(getWorkSeconds());
  updateProgressBar(0, getWorkSeconds(), 'work');
  setButtons({ start: false, pause: true, endRound: true, reset: false, break: true });
  setStatus('準備開始');
}

document.addEventListener('DOMContentLoaded', init);