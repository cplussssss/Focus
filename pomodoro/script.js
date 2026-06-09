'use strict';

/* ============================================================
   設定
   ============================================================ */
const DEMO_EMAIL = 'demo@focus.app';
// Cloudflare Worker URL（Gemini API 中間層）
const GEMINI_WORKER_URL = 'https://focus.sijialai1473.workers.dev';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain: 'focus-e5f62.firebaseapp.com',
  projectId: 'focus-e5f62',
  storageBucket: 'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId: '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzKjukXmuP_2wt83HA_w3rdZjw_zKkfsQZXAnTzMimHQX0bhOoVCzbJErwOfLMuzVFi/exec';
const STORAGE_KEY = 'pomodoro_records_v2';

/* ============================================================
   專注度文字對照
   ============================================================ */
const FOCUS_LABELS = { 1: '很差', 2: '差', 3: '普通', 4: '不錯', 5: '很專注' };

/* ============================================================
   全域狀態
   ============================================================ */
const STATE = {
  lastRecord: null,
  mode: 'idle',   // 'idle'|'work'|'work-overtime'|'break'|'paused'
  pausedMode: null,

  intervalId: null,

  // 以目標結束時間計算剩餘 — 切分頁再回來也正確
  // 原因：setInterval 在背景分頁中可能被瀏覽器節流導致計時不準；
  //       改存 endTime (ms epoch)，每次 tick 重算 (endTime - now)，不受節流影響。
  endTime: 0,
  pauseRemaining: 0,

  workTotalSeconds: 0,
  breakTotalSeconds: 0,
  workStartTime: null,
  totalPausedMs: 0,
  lastPauseStart: null,

  records: [],
  pendingAction: null,

  // 本輪待確認的評分資料（在 Modal 關閉前暫存）
  pendingResult: 'done',       // 'done'|'partial'|'incomplete'
  pendingFocus: 5,            // 1-5
  pendingDistractions: [],          // string[]

  // 今日已完成的累計輪數（用於摘要面板輪數進度）
  todayActualRounds: 0,
};

let firebaseAuth = null;
let currentUser = null;
let firestoreDb = null;

/* ============================================================
   DOM 快取
   ============================================================ */
let EL = {};

function initElements() {
  EL = {
    btnDemoLogin: document.getElementById('btnDemoLogin'),
    modeBadge: document.getElementById('modeBadge'),
    timerDisplay: document.getElementById('timerDisplay'),
    statusText: document.getElementById('statusText'),
    progressBarFill: document.getElementById('progressBarFill'),

    workMinutes: document.getElementById('workMinutes'),
    breakMinutes: document.getElementById('breakMinutes'),
    estimatedRounds: document.getElementById('estimatedRounds'),

    taskCategory: document.getElementById('taskCategory'),
    taskProject: document.getElementById('taskProject'),
    taskName: document.getElementById('taskName'),
    taskReason: document.getElementById('taskReason'),
    taskNote: document.getElementById('taskNote'),

    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnEndRound: document.getElementById('btnEndRound'),
    btnReset: document.getElementById('btnReset'),
    btnBreak: document.getElementById('btnBreak'),
    btnClearHistory: document.getElementById('btnClearHistory'),
    historyList: document.getElementById('historyList'),
    syncState: document.getElementById('syncState'),
    syncResult: document.getElementById('syncResult'),

    // 摘要面板
    summaryDate: document.getElementById('summaryDate'),
    sumRounds: document.getElementById('sumRounds'),
    sumMinutes: document.getElementById('sumMinutes'),
    sumRate: document.getElementById('sumRate'),
    sumInterrupts: document.getElementById('sumInterrupts'),
    sumTopCategory: document.getElementById('sumTopCategory'),
    sumRoundProgress: document.getElementById('sumRoundProgress'),

    // Modal：結束原因
    modalEndReason: document.getElementById('modalEndReason'),
    endReasonInput: document.getElementById('endReasonInput'),
    btnConfirmEnd: document.getElementById('btnConfirmEnd'),
    btnCancelEnd: document.getElementById('btnCancelEnd'),
    resultChips: document.getElementById('resultChips'),
    focusStars: document.getElementById('focusStars'),
    focusHint: document.getElementById('focusHint'),
    distractionChips: document.getElementById('distractionChips'),
    distractionOther: document.getElementById('distractionOther'),

    // Modal：工作完成
    modalBreakSuggest: document.getElementById('modalBreakSuggest'),
    breakSuggestion: document.getElementById('breakSuggestion'),
    aiFeedbackBlock: document.getElementById('aiFeedbackBlock'),
    aiFeedbackText: document.getElementById('aiFeedbackText'),
    btnModalStartBreak: document.getElementById('btnModalStartBreak'),
    doneResultChips: document.getElementById('doneResultChips'),
    doneStars: document.getElementById('doneStars'),
    doneHint: document.getElementById('doneHint'),
    doneDistractionChips: document.getElementById('doneDistractionChips'),
    doneDistractionOther: document.getElementById('doneDistractionOther'),

    // Modal：休息結束
    modalBreakDone: document.getElementById('modalBreakDone'),
    btnModalNextRound: document.getElementById('btnModalNextRound'),
    btnModalStopRounds: document.getElementById('btnModalStopRounds'),
    breakDoneCountdown: document.getElementById('breakDoneCountdown'),

    // 跳過休息按鈕
    btnSkipBreak: document.getElementById('btnSkipBreak'),

    // 展開/收起介面按鈕
    btnExpandUI: document.getElementById('btnExpandUI'),

    // 狀態選擇 + AI 建議
    stateChips: document.getElementById('stateChips'),
    startTip: document.getElementById('startTip'),
    startTipText: document.getElementById('startTipText'),

    // Modal：登入
    modalLogin: document.getElementById('modalLogin'),
    btnGoogleLogin: document.getElementById('btnGoogleLogin'),
    btnCancelLogin: document.getElementById('btnCancelLogin'),
    btnMyRecords: document.getElementById('btnMyRecords'),  // ★ 新增
    btnProfilePage: document.getElementById('btnProfilePage'),
    userBadge: document.getElementById('userBadge'),
    btnLogoutMenu: document.getElementById('btnLogoutMenu'),
    btnSettings: document.getElementById('btnSettings'),
    settingsPopup: document.getElementById('settingsPopup'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    btnAccountName: document.getElementById('btnAccountName'),

    // 帳號設定 Modal
    modalAccount: document.getElementById('modalAccount'),
    btnAccount: document.getElementById('btnAccount'),
    btnLoginHeader: document.getElementById('btnLoginHeader'),
    btnCloseAccount: document.getElementById('btnCloseAccount'),
    btnLogout: document.getElementById('btnLogout'),
    btnSaveUsername: document.getElementById('btnSaveUsername'),
    usernameInput: document.getElementById('usernameInput'),
    usernameHint: document.getElementById('usernameHint'),
    togglePublic: document.getElementById('togglePublic'),
    publicLabel: document.getElementById('publicLabel'),
    shareUrlRow: document.getElementById('shareUrlRow'),
    shareUrlText: document.getElementById('shareUrlText'),
    btnCopyUrl: document.getElementById('btnCopyUrl'),
    accountEmail: document.getElementById('accountEmail'),
    accountAvatar: document.getElementById('accountAvatar'),
    accountUid: document.getElementById('accountUid'),

    // 今日目標 Modal
    modalDailyGoal: document.getElementById('modalDailyGoal'),
    dailyGoalInput: document.getElementById('dailyGoalInput'),
    btnSubmitGoal: document.getElementById('btnSubmitGoal'),
    btnSkipGoal: document.getElementById('btnSkipGoal'),
    dailyGoalTaskList: document.getElementById('dailyGoalTaskList'),
    taskShortcutArea: document.getElementById('taskShortcutArea'),

    // 編輯紀錄 Modal
    modalEditRecord: document.getElementById('modalEditRecord'),
    editCategory: document.getElementById('editCategory'),
    editProject: document.getElementById('editProject'),
    editTaskName: document.getElementById('editTaskName'),
    editTaskReason: document.getElementById('editTaskReason'),
    editTaskNote: document.getElementById('editTaskNote'),
    editActualMin: document.getElementById('editActualMin'),
    editRecordId: document.getElementById('editRecordId'),
    btnConfirmEdit: document.getElementById('btnConfirmEdit'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
  };
}

/* ============================================================
   開始前狀態建議
   ============================================================ */
const STATE_TIPS = {
  great: [
    '狀態絕佳！直接衝最難的核心任務，趁這股能量把最高價值的工作解決掉。',
    '能量滿點！把那個你一直拖延的硬骨頭排第一，別浪費這個黃金時段。',
    '今天狀態很好，把最需要腦力的任務放在最前面，讓峰值狀態發揮最大效益。',
  ],
  good: [
    '狀態不錯，直接開始主要任務即可，保持這個節奏就好。',
    '精神不錯！選一個你真正想推進的任務，這個時段做有品質的工作正好。',
    '狀態良好，選需要專注但不算最難的工作，穩穩推進就是今天的目標。',
  ],
  ok: [
    '你現在狀態一般，建議先做 15 分鐘的輕任務暖機，不要一開始就挑最難的。',
    '狀態普通，先選一個「低啟動門檻」的任務，讓自己慢慢進入狀態再說。',
    '狀態一般時最容易拖延，建議先定好這輪只做一件小事，完成就是進步。',
  ],
  tired: [
    '有點疲憊，只做一件最小可行的事就好，完成一個小動作也算勝利。',
    '感覺有點累，試著做整理、回覆或閱讀這類不需要高強度腦力的任務。',
    '能量偏低，把這輪當成「維持動能」的輕巡航，不用強迫自己全速衝。',
  ],
  exhausted: [
    '感覺很累了，先問自己：現在最重要的一件事是什麼？只做那一件就好。',
    '狀態很差時硬撐反而低效，建議先起來走動 2 分鐘再開始，或考慮短暫休息。',
    '真的很累的話，選一件最簡單的任務讓大腦有點事做，別給自己太大壓力。',
  ],
};

let _tipTimerId = null;

function showStateTip(state) {
  clearTimeout(_tipTimerId);
  EL.startTip.hidden = true;
  const tips = STATE_TIPS[state];
  if (!tips) return;
  _tipTimerId = setTimeout(() => {
    EL.startTipText.textContent = tips[Math.floor(Math.random() * tips.length)];
    EL.startTip.hidden = false;
  }, 900);
}

function clearStateTip() {
  clearTimeout(_tipTimerId);
  EL.startTip.hidden = true;
  if (EL.stateChips) {
    EL.stateChips.querySelectorAll('.state-chip').forEach(b => b.classList.remove('active'));
  }
}

/* ============================================================
   休息建議
   ============================================================ */
const BREAK_SUGGESTIONS = [
  '喝杯水，補充水分💧', '起來走走，活動一下雙腳🚶',
  '做幾個伸展動作，放鬆肩頸🧘', '閉上眼睛，讓眼睛休息一下😌',
  '看向遠方，緩解眼睛疲勞👀', '做幾次深呼吸，讓大腦充電🌬️',
  '隨意轉轉脖子與肩膀，舒展筋骨💆', '站起來抖一抖，甩掉疲勞！🕺',
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
function formatDuration(sec) {
  const m = Math.floor(sec / 60), r = sec % 60;
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
function getTodayPrefix() {
  return new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function getWeekday() {
  return ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];
}

/* ============================================================
   頁籤標題 & 閃爍
   ============================================================ */
let _tabFlashId = null;
let _tabFlashOn = false;
const TAB_ORIGINAL = document.title;

// 每次計時更新時同步頁籤標題
function updateTabTitle(timeStr) {
  if (_tabFlashId !== null) return; // 閃爍中不覆蓋
  const prefix = {
    'work': '⏱',
    'work-overtime': '⚠️',
    'break': '☕',
    'paused': '⏸',
    'stopwatch': '⏳',
  }[STATE.mode] || '';
  document.title = prefix ? `${prefix} ${timeStr} — 番茄` : TAB_ORIGINAL;
}

// 時間到時閃爍頁籤：在 alertText 和正常標題之間交替
function startTabFlash(alertText) {
  stopTabFlash();
  _tabFlashOn = true;
  document.title = alertText;
  _tabFlashId = setInterval(() => {
    _tabFlashOn = !_tabFlashOn;
    document.title = _tabFlashOn ? alertText : TAB_ORIGINAL;
  }, 800);
}

function stopTabFlash() {
  if (_tabFlashId !== null) {
    clearInterval(_tabFlashId);
    _tabFlashId = null;
  }
  document.title = TAB_ORIGINAL;
}

/* ============================================================
   UI 更新
   ============================================================ */
function updateTimerDisplay(seconds) {
  const str = formatTime(seconds);
  EL.timerDisplay.textContent = str;
  updateTabTitle(str);
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
  const text = { work: '工作模式', break: '休息模式', overtime: '超時工作', idle: '準備中', stopwatch: '持續工作中' };
  EL.modeBadge.textContent = text[mode] || '';
  EL.modeBadge.className = 'mode-badge';
  if (mode === 'break') EL.modeBadge.classList.add('break-mode');
  if (mode === 'overtime' || mode === 'stopwatch') EL.modeBadge.classList.add('overtime-mode');
  EL.timerDisplay.className = 'timer-display';
  if (mode === 'break') EL.timerDisplay.classList.add('break-mode');
  if (mode === 'overtime' || mode === 'stopwatch') EL.timerDisplay.classList.add('overtime-mode');
}

function setButtons(map) {
  const m = { start: EL.btnStart, pause: EL.btnPause, endRound: EL.btnEndRound, reset: EL.btnReset, break: EL.btnBreak };
  for (const [k, disabled] of Object.entries(map)) {
    if (m[k]) m[k].disabled = disabled;
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
   今日摘要面板
   ============================================================ */
function updateSummary() {
  const today = getTodayPrefix();
  const todayRecords = STATE.records.filter(r => r.timestamp && r.timestamp.startsWith(today));

  const doneRounds = todayRecords.filter(r => r.status === 'done' || r.status === 'partial').length;
  const totalRounds = todayRecords.length;
  const totalMin = Math.round(todayRecords.reduce((s, r) => s + (r.actualSec || 0), 0) / 60);
  const interrupts = todayRecords.filter(r => r.status === 'incomplete').length;
  const rate = totalRounds > 0 ? Math.round(doneRounds / totalRounds * 100) + '%' : '—';

  // 最常任務分類
  const catCount = {};
  todayRecords.forEach(r => { if (r.category) catCount[r.category] = (catCount[r.category] || 0) + 1; });
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];

  EL.sumRounds.textContent = doneRounds;
  EL.sumMinutes.textContent = totalMin;
  EL.sumRate.textContent = rate;
  EL.sumInterrupts.textContent = interrupts;
  EL.sumTopCategory.textContent = topCat ? `最常分類：${topCat[0]}` : '最常分類：—';

  // 輪數進度：預計 N 輪 / 已做 M 輪
  const estimated = parseInt(EL.estimatedRounds.value, 10) || 1;
  EL.sumRoundProgress.textContent = `預計 ${estimated} 輪 ／ 已做 ${totalRounds} 輪`;

  // 日期顯示
  const now = new Date();
  EL.summaryDate.textContent = `${now.getMonth() + 1}/${now.getDate()}（${getWeekday()}）`;
}

/* ============================================================
   Chip / Star 元件初始化
   ============================================================ */

// 初始化單選 chip 組（任務結果）
function initResultChips(groupEl, hintKey) {
  groupEl.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      groupEl.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE[hintKey] = btn.dataset.value;
    });
  });
}

// 初始化多選 chip 組（干擾來源）
function initDistractionChips(groupEl, otherInput) {
  groupEl.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const selected = [...groupEl.querySelectorAll('.chip.active')].map(b => b.dataset.value);
      otherInput.hidden = !selected.includes('其他');
    });
  });
}

// 初始化星等評分
function initStars(groupEl, hintEl, stateKey) {
  groupEl.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.dataset.val, 10);
      STATE[stateKey] = val;
      groupEl.querySelectorAll('.star-btn').forEach((b, i) => {
        b.classList.toggle('active', i < val);
      });
      hintEl.textContent = `${val} — ${FOCUS_LABELS[val] || ''}`;
    });
  });
}

// 讀取當前 chip/star 選值
function getChipValue(groupEl) {
  const active = groupEl.querySelector('.chip.active');
  return active ? active.dataset.value : null;
}
function getMultiChipValues(groupEl, otherInput) {
  const vals = [...groupEl.querySelectorAll('.chip.active')].map(b => b.dataset.value);
  if (vals.includes('其他') && otherInput.value.trim()) {
    const idx = vals.indexOf('其他');
    vals[idx] = `其他：${otherInput.value.trim()}`;
  }
  return vals;
}
function getStarValue(groupEl) {
  const active = [...groupEl.querySelectorAll('.star-btn.active')];
  return active.length;
}

// 重置 Modal 評分元件到預設值
function resetEndModal() {
  // 結果預設：未完成
  EL.resultChips.querySelectorAll('.chip').forEach(b => {
    b.classList.toggle('active', b.dataset.value === 'incomplete');
  });
  // 專注度預設：5
  EL.focusStars.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('active', i < 5));
  EL.focusHint.textContent = '5 — 很專注';
  // 干擾清空
  EL.distractionChips.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  EL.distractionOther.hidden = true;
  EL.distractionOther.value = '';
}
function resetDoneModal() {
  // 結果預設：完成
  EL.doneResultChips.querySelectorAll('.chip').forEach(b => {
    b.classList.toggle('active', b.dataset.value === 'done');
  });
  // 專注度預設：5
  EL.doneStars.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('active', i < 5));
  EL.doneHint.textContent = '5 — 很專注';
  // 干擾清空
  EL.doneDistractionChips.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
  EL.doneDistractionOther.hidden = true;
  EL.doneDistractionOther.value = '';
}

/* ============================================================
   計時器核心 — 以 endTime timestamp 計算（背景分頁不漂移）
   原因：setInterval 在背景分頁中可能被瀏覽器節流，
         改存目標結束時間，每次 tick 都重算 (endTime - now)，不受節流影響。
   ============================================================ */
function clearTimer() {
  if (STATE.intervalId !== null) { clearInterval(STATE.intervalId); STATE.intervalId = null; }
}

/* ── 休息結束後自動開始下一輪倒數 ── */
let _breakDoneTimerId = null;

function startBreakDoneCountdown() {
  let secs = 5;
  if (EL.breakDoneCountdown) EL.breakDoneCountdown.textContent = secs;
  _breakDoneTimerId = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearBreakDoneCountdown();
      doStartNextRound();
    } else {
      if (EL.breakDoneCountdown) EL.breakDoneCountdown.textContent = secs;
    }
  }, 1000);
}

function clearBreakDoneCountdown() {
  if (_breakDoneTimerId !== null) {
    clearInterval(_breakDoneTimerId);
    _breakDoneTimerId = null;
  }
}

function doStartNextRound() {
  clearBreakDoneCountdown();
  hideModal(EL.modalBreakDone);
  stopTabFlash();
  startWork();
}
function getWorkSeconds() {
  const v = parseInt(EL.workMinutes.value, 10);
  return (isNaN(v) || v < 1) ? 25 * 60 : v * 60;
}
function getBreakSeconds() {
  const v = parseInt(EL.breakMinutes.value, 10);
  return (isNaN(v) || v < 1) ? 5 * 60 : v * 60;
}

/* ── 開始工作 ── */
function startWork() {
  STATE.workTotalSeconds = getWorkSeconds();
  STATE.breakTotalSeconds = getBreakSeconds();
  STATE.workStartTime = new Date();
  STATE.totalPausedMs = 0;
  STATE.lastPauseStart = null;
  STATE.mode = 'work';
  STATE.endTime = Date.now() + STATE.workTotalSeconds * 1000;

  clearStateTip();
  setBadgeMode('work');
  updateTimerDisplay(STATE.workTotalSeconds);
  updateProgressBar(0, STATE.workTotalSeconds, 'work');
  setStatus('工作中...');
  setButtons({ start: true, pause: false, endRound: false, reset: false, break: true });
  EL.workMinutes.disabled = true;
  EL.breakMinutes.disabled = true;

  // 專注模式：計時中隱藏其他內容
  document.body.className = 'timer-active';
  if (EL.btnExpandUI) EL.btnExpandUI.textContent = '展開介面 ↓';

  STATE.intervalId = setInterval(tick, 500);
}

/* ── tick（500ms）：從 endTime 重算剩餘，不累積誤差 ── */
function tick() {
  const now = Date.now();
  const remaining = Math.ceil((STATE.endTime - now) / 1000);

  if (STATE.mode === 'work') {
    if (remaining > 0) {
      updateTimerDisplay(remaining);
      updateProgressBar(STATE.workTotalSeconds - remaining, STATE.workTotalSeconds, 'work');
    } else {
      clearTimer();
      playBeep('work-done');
      handleStartBreak();
    }
  } else if (STATE.mode === 'work-overtime') {
    updateTimerDisplay(-Math.floor((now - STATE.endTime) / 1000));
  } else if (STATE.mode === 'stopwatch') {
    const elapsed = Math.floor((now - STATE.endTime) / 1000);
    updateTimerDisplay(elapsed);
  } else if (STATE.mode === 'break') {
    if (remaining > 0) {
      updateTimerDisplay(remaining);
      updateProgressBar(STATE.breakTotalSeconds - remaining, STATE.breakTotalSeconds, 'break');
    } else {
      clearTimer();
      playBeep('break-done');
      setStatus('✅ 休息結束！準備下一輪？');
      showModal(EL.modalBreakDone);
      startTabFlash('🍅 休息結束！');
      startBreakDoneCountdown();
    }
  }
}

/* ── 暫停 / 繼續 ── */
function pauseTimer() {
  if (!['work', 'work-overtime', 'break', 'stopwatch'].includes(STATE.mode)) return;
  clearTimer();
  // stopwatch：endTime 是起點（過去），存負的已耗秒數讓 resume 公式通用
  STATE.pauseRemaining = STATE.mode === 'stopwatch'
    ? -(Date.now() - STATE.endTime)
    : Math.max(0, STATE.endTime - Date.now());
  STATE.lastPauseStart = Date.now();
  STATE.pausedMode = STATE.mode;
  STATE.mode = 'paused';
  EL.timerDisplay.classList.add('paused');
  setStatus('⏸ 已暫停');
  EL.btnPause.textContent = '▶ 繼續';
  setButtons({ start: true, endRound: false, reset: false, break: STATE.pausedMode !== 'break' });
  stopTabFlash();
  updateTabTitle(EL.timerDisplay.textContent);
}
function resumeTimer() {
  if (STATE.mode !== 'paused') return;
  if (STATE.lastPauseStart !== null) {
    STATE.totalPausedMs += Date.now() - STATE.lastPauseStart;
    STATE.lastPauseStart = null;
  }
  STATE.endTime = Date.now() + STATE.pauseRemaining;
  STATE.mode = STATE.pausedMode;
  STATE.pausedMode = null;
  EL.timerDisplay.classList.remove('paused');
  EL.btnPause.textContent = '⏸ 暫停';
  const s = STATE.mode === 'work-overtime' ? '⚠️ 工作時間已結束，超時進行中...'
    : STATE.mode === 'break' ? '☕ 休息中...'
      : STATE.mode === 'stopwatch' ? '⏳ 持續工作中...'
        : '工作中...';
  setStatus(s);
  STATE.intervalId = setInterval(tick, 500);
  if (STATE.mode === 'stopwatch') {
    setButtons({ start: true, pause: false, endRound: false, reset: false, break: false });
  } else {
    setButtons({ start: true, pause: false, endRound: STATE.mode === 'break', reset: false, break: STATE.mode !== 'break' });
  }
}

/* ── 結束本輪（中途） ── */
function triggerEndEarly(action) {
  if (STATE.mode === 'idle') { if (action === 'reset') doReset(); return; }
  STATE.pendingAction = action;
  clearTimer();
  EL.timerDisplay.classList.remove('paused');
  EL.endReasonInput.value = '';
  resetEndModal();
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
  const result = getChipValue(EL.resultChips) || 'incomplete';
  const focus = getStarValue(EL.focusStars) || 5;
  const distractions = getMultiChipValues(EL.distractionChips, EL.distractionOther);

  hideModal(EL.modalEndReason);
  saveRecord({ status: result, endReason: reason, focus, distractions });
  // 結束本輪後清空「做什麼」和「為什麼」；備註保留（方便跨輪重用）
  clearTaskFields();
  resetToIdle();
  STATE.pendingAction = null;
}

/* ── 重設 ── */
function handleReset() {
  if (STATE.mode === 'idle') { doReset(); return; }
  triggerEndEarly('reset');
}
function doReset() {
  clearTimer();
  stopTabFlash();
  clearBreakDoneCountdown();
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
function resetToIdle() {
  clearTimer();
  stopTabFlash();
  clearBreakDoneCountdown();
  clearStateTip();
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

/* ── 清空任務欄位 ──
   結束本輪 / 開始休息後清空「做什麼」和「為什麼」，
   避免進入下一輪時殘留上一輪資料。
   備註（taskNote）刻意保留，讓使用者可帶入下一輪繼續使用。 */
function clearTaskFields() {
  EL.taskName.value = '';
  EL.taskReason.value = '';
}

/* ── 開始休息 ──
   修正：tick 進入 overtime 模式時已主動 setButtons({ break:false }) 啟用按鈕，
   此函式只需確認 mode 合法即可觸發。 */
function handleStartBreak() {
  if (EL.aiFeedbackBlock) EL.aiFeedbackBlock.hidden = true;

  const okModes = ['work', 'work-overtime', 'stopwatch', 'paused'];
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

  // 顯示休息建議 + 評分 Modal
  EL.breakSuggestion.textContent = getRandomBreakSuggestion();
  resetDoneModal();
  showModal(EL.modalBreakSuggest);
  // ★ 新增：觸發 AI 回饋（非同步，不擋住 Modal 顯示）
  getAiFeedback(STATE.lastRecord || {});
  setButtons({ start: true, pause: true, endRound: true, reset: false, break: true });
}

function startBreakTimer() {
  stopTabFlash();
  // 讀取 done modal 的評分後存入紀錄
  const result = getChipValue(EL.doneResultChips) || 'done';
  const focus = getStarValue(EL.doneStars) || 5;
  const distractions = getMultiChipValues(EL.doneDistractionChips, EL.doneDistractionOther);

  hideModal(EL.modalBreakSuggest);
  saveRecord({ status: result, endReason: '', focus, distractions });
  // 工作完成後清空任務欄位，避免進入下一輪殘留上一輪資料
  clearTaskFields();

  STATE.mode = 'break';
  STATE.endTime = Date.now() + STATE.breakTotalSeconds * 1000;
  setBadgeMode('break');
  updateTimerDisplay(STATE.breakTotalSeconds);
  updateProgressBar(0, STATE.breakTotalSeconds, 'break');
  setStatus('☕ 休息中...');
  setButtons({ start: true, pause: false, endRound: true, reset: true, break: true });
  document.body.className = 'mode-break timer-active';
  if (EL.btnExpandUI) EL.btnExpandUI.textContent = '展開介面 ↓';
  STATE.intervalId = setInterval(tick, 500);
}

/* ── 跳過休息，以秒表模式繼續工作 ── */
function skipBreakContinueWork() {
  stopTabFlash();
  const result = getChipValue(EL.doneResultChips) || 'done';
  const focus = getStarValue(EL.doneStars) || 5;
  const distractions = getMultiChipValues(EL.doneDistractionChips, EL.doneDistractionOther);

  hideModal(EL.modalBreakSuggest);
  saveRecord({ status: result, endReason: '', focus, distractions });

  // 啟動秒表模式：計時往上跑，顯示已持續工作多久
  STATE.workStartTime = new Date();
  STATE.totalPausedMs = 0;
  STATE.lastPauseStart = null;
  STATE.mode = 'stopwatch';
  STATE.endTime = Date.now(); // elapsed = now - endTime（從 0 開始往上）

  setBadgeMode('stopwatch');
  updateTimerDisplay(0);
  updateProgressBar(0, 1, 'work'); // 清空進度條
  setStatus('⏳ 持續工作中，不計番茄鐘...');
  setButtons({ start: true, pause: false, endRound: false, reset: false, break: false });

  // 維持專注模式
  document.body.className = 'timer-active';
  if (EL.btnExpandUI) EL.btnExpandUI.textContent = '展開介面 ↓';

  STATE.intervalId = setInterval(tick, 500);
}

/* ============================================================
   紀錄邏輯
   ============================================================ */
function saveRecord({ status, endReason, focus = 5, distractions = [] }) {
  const now = new Date();
  const actualSec = STATE.workStartTime
    ? Math.round((Date.now() - STATE.workStartTime.getTime() - STATE.totalPausedMs) / 1000)
    : 0;

  const record = {
    id: Date.now(),
    timestamp: getNowString(),
    startTime: STATE.workStartTime ? STATE.workStartTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
    endTime: now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
    weekday: getWeekday(),
    category: EL.taskCategory.value || '',
    project: EL.taskProject.value.trim(),
    taskName: EL.taskName.value.trim() || '（未填寫）',
    taskReason: EL.taskReason.value.trim() || '（未填寫）',
    taskNote: EL.taskNote.value.trim(),
    plannedSec: STATE.workTotalSeconds,
    actualSec,
    status,          // 'done' | 'partial' | 'incomplete'
    endReason,
    focus,           // 1-5
    distractions,    // string[]
    synced: false,
  };
  STATE.lastRecord = record;  // ★ 暫存最新一筆，讓 getAiFeedback 可以取用
  STATE.records.unshift(record);
  saveToStorage();
  renderHistory();
  updateSummary();
  if (currentUser && firestoreDb) {
    saveRecordToFirestore(record)
      .then(() => {
        record.synced = true;
        saveToStorage();
        renderHistory();
      })
      .catch(e => console.warn('Firestore 寫入失敗：', e));
  }

}

function renderHistory(overrideRecords) {
  const records = overrideRecords || STATE.records;
  if (records.length === 0) {
    EL.historyList.innerHTML = '<p class="empty-hint">尚無紀錄，完成第一輪後會顯示在這裡。</p>';
    return;
  }

  const statusMap = { done: '✅ 完成', partial: '🔶 部分完成', incomplete: '❌ 未完成' };
  const statusClass = { done: 'done', partial: 'partial', incomplete: 'incomplete' };

  EL.historyList.innerHTML = records.map(r => {
    const timeRange = (r.startTime && r.endTime) ? `${r.startTime}–${r.endTime}` : r.timestamp;

    // 標籤列
    const catTag = r.category ? `<span class="record-tag cat">${escapeHTML(r.category)}</span>` : '';
    const projTag = r.project ? `<span class="record-tag proj">${escapeHTML(r.project)}</span>` : '';
    const focusTag = r.focus ? `<span class="record-tag focus">專注 ${r.focus}/5</span>` : '';
    const distrTag = r.distractions && r.distractions.length
      ? `<span class="record-tag">${escapeHTML(r.distractions.slice(0, 2).join('、'))}${r.distractions.length > 2 ? '…' : ''}</span>`
      : '';

    const endReasonHtml = r.endReason
      ? `<span><span class="meta-label">結束原因：</span>${escapeHTML(r.endReason)}</span>` : '';
    const noteHtml = r.taskNote
      ? `<span><span class="meta-label">備註：</span>${escapeHTML(r.taskNote)}</span>` : '';
    const reasonHtml = r.taskReason && r.taskReason !== '（未填寫）'
      ? `<span><span class="meta-label">為什麼：</span>${escapeHTML(r.taskReason)}</span>` : '';

    const deleteBtn = `<button type="button" class="btn-delete-record" data-id="${r.id}" title="刪除此筆紀錄">✕</button>`;

    const editBtn = `<button type="button" class="btn-edit-record" data-id="${r.id}" title="編輯此筆紀錄">✎</button>`;

    return `
    <div class="record-card ${statusClass[r.status] || 'incomplete'}">
      <div class="record-card-header">
        <span class="record-card-title">${escapeHTML(r.taskName)}</span>
        <span class="record-status ${statusClass[r.status] || 'incomplete'}">${statusMap[r.status] || r.status}</span>
        <span class="sync-badge ${r.synced ? 'synced' : 'not-synced'}">${r.synced ? '☁ 已同步' : '○ 未同步'}</span>
        ${editBtn}${deleteBtn}
      </div>
      <div class="record-tags">${catTag}${projTag}${focusTag}${distrTag}</div>
      <div class="record-meta">
        <span><span class="meta-label">時間：</span>${timeRange}</span>
        <span><span class="meta-label">預設：</span>${formatDuration(r.plannedSec)}</span>
        <span><span class="meta-label">實際：</span>${formatDuration(r.actualSec)}</span>
        ${reasonHtml}${endReasonHtml}${noteHtml}
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   編輯紀錄
   ============================================================ */
function openEditModal(rawId) {
  const id = Number(rawId) || rawId;
  const record = STATE.records.find(r => String(r.id) === String(id));
  if (!record) return;

  EL.editRecordId.value = id;
  EL.editCategory.value = record.category || '讀書';
  EL.editProject.value = record.project || '';
  EL.editTaskName.value = record.taskName !== '（未填寫）' ? (record.taskName || '') : '';
  EL.editTaskReason.value = record.taskReason !== '（未填寫）' ? (record.taskReason || '') : '';
  EL.editTaskNote.value = record.taskNote || '';
  EL.editActualMin.value = Math.max(1, Math.round((record.actualSec || 0) / 60));
  showModal(EL.modalEditRecord);
}

function confirmEdit() {
  const rawId = EL.editRecordId.value;
  const id = Number(rawId) || rawId;
  const record = STATE.records.find(r => String(r.id) === String(id));
  if (!record) { hideModal(EL.modalEditRecord); return; }

  record.category = EL.editCategory.value;
  record.project = EL.editProject.value.trim();
  record.taskName = EL.editTaskName.value.trim() || '（未填寫）';
  record.taskReason = EL.editTaskReason.value.trim() || '（未填寫）';
  record.taskNote = EL.editTaskNote.value.trim();
  record.actualSec = (parseInt(EL.editActualMin.value, 10) || 1) * 60;

  saveToStorage();
  renderHistory();
  updateSummary();
  hideModal(EL.modalEditRecord);

  if (currentUser && firestoreDb && record.synced) {
    saveRecordToFirestore(record).catch(e => console.warn('Firestore 更新失敗：', e));
  }
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
  } catch (e) { console.warn('localStorage 讀取失敗：', e); STATE.records = []; }
}

/* ============================================================
   事件綁定
   ============================================================ */
function initEventListeners() {
  EL.btnDemoLogin.addEventListener('click', handleDemoLogin);

  // 帳號設定按鈕
  if (EL.btnAccount) EL.btnAccount.addEventListener('click', openAccountModal);

  // 關閉帳號設定
  EL.btnCloseAccount.addEventListener('click', () => hideModal(EL.modalAccount));

  // 儲存用戶名稱
  EL.btnSaveUsername.addEventListener('click', handleSaveUsername);

  // 公開切換
  EL.togglePublic.addEventListener('change', handleTogglePublic);

  // 複製分享連結
  EL.btnCopyUrl.addEventListener('click', () => {
    navigator.clipboard?.writeText(EL.shareUrlText.textContent).then(() => {
      EL.btnCopyUrl.textContent = '已複製！';
      setTimeout(() => { EL.btnCopyUrl.textContent = '複製'; }, 2000);
    });
  });

  // 登出
  EL.btnLogout.addEventListener('click', async () => {
    await firebaseAuth.signOut();
    hideModal(EL.modalAccount);
  });

  // 狀態 chip 點擊 → 顯示 AI 建議
  EL.stateChips.querySelectorAll('.state-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      EL.stateChips.querySelectorAll('.state-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showStateTip(btn.dataset.state);
    });
  });

  EL.btnStart.addEventListener('click', () => { if (STATE.mode === 'idle') startWork(); });

  EL.btnPause.addEventListener('click', () => {
    if (STATE.mode === 'paused') resumeTimer(); else pauseTimer();
  });

  EL.btnEndRound.addEventListener('click', () => {
    if (STATE.mode === 'idle') return;
    if (STATE.mode === 'break') { clearTimer(); resetToIdle(); return; }
    if (STATE.mode === 'paused' && STATE.pausedMode === 'break') { clearTimer(); stopTabFlash(); resetToIdle(); return; }
    triggerEndEarly('endRound');
  });

  EL.btnReset.addEventListener('click', handleReset);
  EL.btnBreak.addEventListener('click', handleStartBreak);

  EL.btnConfirmEnd.addEventListener('click', confirmEndEarly);
  EL.btnCancelEnd.addEventListener('click', () => {
    hideModal(EL.modalEndReason);
    STATE.pendingAction = null;
    if (['work', 'work-overtime', 'break'].includes(STATE.mode)) {
      STATE.endTime = Date.now() + STATE.pauseRemaining;
      STATE.intervalId = setInterval(tick, 500);
      const s = STATE.mode === 'work-overtime' ? '⚠️ 工作時間已結束，超時進行中...'
        : STATE.mode === 'break' ? '☕ 休息中...' : '工作中...';
      setStatus(s);
    }
  });

  EL.endReasonInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEndEarly(); }
  });

  EL.btnModalStartBreak.addEventListener('click', startBreakTimer);

  EL.btnSkipBreak.addEventListener('click', skipBreakContinueWork);

  EL.btnModalNextRound.addEventListener('click', doStartNextRound);

  EL.btnModalStopRounds.addEventListener('click', () => {
    clearBreakDoneCountdown();
    hideModal(EL.modalBreakDone);
    stopTabFlash();
    resetToIdle();
  });

  EL.btnExpandUI.addEventListener('click', () => {
    document.body.classList.toggle('timer-expanded');
    EL.btnExpandUI.textContent = document.body.classList.contains('timer-expanded')
      ? '收起介面 ↑' : '展開介面 ↓';
  });

  EL.btnClearHistory.addEventListener('click', () => {
    if (confirm('確定要清除所有歷史紀錄嗎？')) {
      STATE.records = [];
      saveToStorage();
      renderHistory();
      updateSummary();
    }
  });

  // 單筆操作：事件委派，區分編輯 / 刪除
  EL.historyList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit-record');
    if (editBtn) { openEditModal(editBtn.dataset.id); return; }

    const deleteBtn = e.target.closest('.btn-delete-record');
    if (!deleteBtn) return;
    const id = Number(deleteBtn.dataset.id);
    const target = STATE.records.find(r => r.id === id);
    STATE.records = STATE.records.filter(r => r.id !== id);
    saveToStorage();
    renderHistory();
    updateSummary();
    if (target?.synced && currentUser && firestoreDb) {
      firestoreDb.collection('users').doc(currentUser.uid)
        .collection('records').doc(String(id))
        .delete()
        .catch(e => console.warn('Firestore 刪除失敗：', e));
    }
  });

  // 編輯紀錄 Modal
  EL.btnConfirmEdit.addEventListener('click', confirmEdit);
  EL.btnCancelEdit.addEventListener('click', () => hideModal(EL.modalEditRecord));

  EL.workMinutes.addEventListener('input', () => {
    if (STATE.mode === 'idle') {
      updateTimerDisplay(getWorkSeconds());
      updateProgressBar(0, getWorkSeconds(), 'work');
    }
  });

  EL.estimatedRounds.addEventListener('input', updateSummary);

  // 登入按鈕（header）
  EL.btnLoginHeader.addEventListener('click', () => showModal(EL.modalLogin));
  if (EL.btnProfilePage) EL.btnProfilePage.addEventListener('click', openPublicProfile);
  if (EL.btnAccountName) EL.btnAccountName.addEventListener('click', handleAccountNameClick);
  if (EL.userBadge) EL.userBadge.addEventListener('click', openAccountModal);
  if (EL.btnLogoutMenu) EL.btnLogoutMenu.addEventListener('click', async () => {
    try {
      await firebaseAuth.signOut();
    } catch (e) { console.warn('Logout failed', e); }
  });

  // 主題切換
  if (EL.btnThemeToggle) {
    EL.btnThemeToggle.addEventListener('click', function (e) {
      e.preventDefault();
      const current = document.documentElement.getAttribute('data-theme');
      if (current === 'light') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  // settings popup toggle
  if (EL.btnSettings && EL.settingsPopup) {
    EL.btnSettings.addEventListener('click', (e) => {
      const open = EL.settingsPopup.getAttribute('aria-hidden') === 'false';
      if (open) {
        EL.settingsPopup.setAttribute('aria-hidden', 'true');
        EL.settingsPopup.hidden = true;
      } else {
        EL.settingsPopup.setAttribute('aria-hidden', 'false');
        EL.settingsPopup.hidden = false;
      }
      if (EL.btnAccountName) refreshSettingsAccountName();
      e.stopPropagation();
    });

    // click outside to close
    document.addEventListener('click', (ev) => {
      if (!EL.settingsPopup) return;
      if (EL.settingsPopup.hidden) return;
      if (ev.target.closest && ev.target.closest('.settings-popup')) return;
      if (ev.target.closest && ev.target.closest('#btnSettings')) return;
      EL.settingsPopup.hidden = true;
      EL.settingsPopup.setAttribute('aria-hidden', 'true');
    });

    // ESC to close
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && EL.settingsPopup && !EL.settingsPopup.hidden) {
        EL.settingsPopup.hidden = true;
        EL.settingsPopup.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // 帳號設定
  if (EL.btnAccount) EL.btnAccount.addEventListener('click', openAccountModal);
  EL.btnCloseAccount.addEventListener('click', () => hideModal(EL.modalAccount));
  EL.btnSaveUsername.addEventListener('click', handleSaveUsername);
  EL.togglePublic.addEventListener('change', handleTogglePublic);
  EL.btnCopyUrl.addEventListener('click', () => {
    navigator.clipboard?.writeText(EL.shareUrlText.textContent).then(() => {
      EL.btnCopyUrl.textContent = '已複製！';
      setTimeout(() => { EL.btnCopyUrl.textContent = '複製'; }, 2000);
    });
  });
  EL.btnLogout.addEventListener('click', async () => {
    await firebaseAuth.signOut();
    hideModal(EL.modalAccount);
  });
  EL.btnMyRecords.addEventListener('click', handleMyRecords);

  // 登入 Modal
  EL.btnGoogleLogin.addEventListener('click', handleGoogleLogin);
  EL.btnCancelLogin.addEventListener('click', () => hideModal(EL.modalLogin));

  // 評分元件初始化（中途結束 Modal）
  initResultChips(EL.resultChips, 'pendingResult');
  initDistractionChips(EL.distractionChips, EL.distractionOther);
  initStars(EL.focusStars, EL.focusHint, 'pendingFocus');

  // 評分元件初始化（工作完成 Modal）
  initResultChips(EL.doneResultChips, 'pendingResult');
  initDistractionChips(EL.doneDistractionChips, EL.doneDistractionOther);
  initStars(EL.doneStars, EL.doneHint, 'pendingFocus');

  // 今日目標 Modal
  EL.btnSubmitGoal.addEventListener('click', submitDailyGoal);
  EL.btnSkipGoal.addEventListener('click', async () => {
    hideModal(EL.modalDailyGoal);
    if (currentUser && firestoreDb) {
      const today = new Date().toISOString().split('T')[0];
      await firestoreDb
        .collection('users').doc(currentUser.uid)
        .collection('dailyGoals').doc(today)
        .delete();
    }
    EL.taskShortcutArea.hidden = true;
    EL.taskShortcutArea.innerHTML = '';
  });
  EL.dailyGoalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitDailyGoal();
  });

  // 能量狀態按鈕
  document.querySelectorAll('.energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/* ============================================================
   Firebase 初始化 & 登入
   ============================================================ */
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebase.auth();
    firestoreDb = firebase.firestore();

    firebaseAuth.onAuthStateChanged(async (user) => {
      currentUser = user;
      if (user) {
        hideModal(EL.modalLogin);   // ★ 登入後關掉 Modal
        EL.syncState.textContent = user.email === DEMO_EMAIL ? '👀 訪客模式' : user.email;
        if (EL.btnMyRecords) EL.btnMyRecords.hidden = user.email === DEMO_EMAIL;
        if (EL.btnAccount) {
          EL.btnAccount.hidden = false;
          const fullName = user.displayName || user.email || '帳號';
          EL.btnAccount.textContent = '帳號';
          EL.btnAccount.title = fullName; // keep full name in tooltip
        }
        if (EL.userBadge) {
          const shortName = user.displayName || user.email || '帳號';
          EL.userBadge.textContent = shortName;
          EL.userBadge.title = shortName;
          EL.userBadge.hidden = false;
        }
        if (EL.btnLoginHeader) EL.btnLoginHeader.hidden = true;
        if (EL.btnLogoutMenu) EL.btnLogoutMenu.hidden = false;
        if (EL.btnAccountName) refreshSettingsAccountName();

        await firestoreDb.collection('users').doc(user.uid).set({
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // 清除本機舊資料，以 Firestore 為主
        STATE.records = [];
        await loadFromFirestore();
        if (user.email !== DEMO_EMAIL) {
          await checkDailyGoal();
        }
      } else {
        EL.syncState.textContent = '';
        if (EL.btnMyRecords) EL.btnMyRecords.hidden = true;
        if (EL.btnAccount) EL.btnAccount.hidden = true;
        if (EL.userBadge) EL.userBadge.hidden = true;
        if (EL.btnLoginHeader) EL.btnLoginHeader.hidden = false;
        if (EL.btnLogoutMenu) EL.btnLogoutMenu.hidden = true;
        if (EL.btnAccountName) refreshSettingsAccountName();
      }
    });
  } catch (err) { console.error('Firebase 初始化失敗：', err); }
}


/* ============================================================
   AI 個人化回饋（Gemini via Cloudflare Worker）
   ============================================================ */

async function getAiFeedback(record) {
  // 顯示載入狀態
  EL.aiFeedbackBlock.hidden = false;
  EL.aiFeedbackText.textContent = '分析中...';
  EL.aiFeedbackText.classList.add('loading');

  // 取得今日其他紀錄作為脈絡
  const todayPrefix = getTodayPrefix();
  const todayRecords = STATE.records.filter(r =>
    r.timestamp && r.timestamp.startsWith(todayPrefix)
  );

  // 組成 Prompt
  const focusLabel = { 5: '非常專注', 4: '蠻專注', 3: '普通', 2: '有點分心', 1: '很分心' };
  const distStr = Array.isArray(record.distractions) && record.distractions.length
    ? record.distractions.join('、')
    : '無';

  const prompt = `你是一個溫暖、簡短、不說教的學習夥伴。
使用者剛完成一輪番茄鐘，根據以下資料給一句個人化的回饋（繁體中文，40字以內，不要用emoji，語氣像朋友）：

本輪任務：${record.taskName || '未填寫'}
任務分類：${record.category || '未分類'}
預設時間：${Math.round((record.plannedSec || 0) / 60)} 分鐘
實際時間：${Math.round((record.actualSec || 0) / 60)} 分鐘
完成狀態：${record.status === 'done' ? '完成' : record.status === 'partial' ? '部分完成' : '未完成'}
專注度：${focusLabel[record.focus] || '未評分'}
干擾來源：${distStr}
今天已完成輪數：${todayRecords.filter(r => r.status === 'done').length} 輪

請根據這些資訊給一句有意義的回饋，不要只說「做得好」這種空泛的話。`;

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(GEMINI_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 200,
          temperature: 0.8,
          thinkingConfig: { thinkingBudget: 0 },
        }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.replace(/\*\*/g, '');

    if (text) {
      EL.aiFeedbackText.textContent = text;
      EL.aiFeedbackText.classList.remove('loading');
    } else {
      throw new Error('回應格式異常');
    }

  } catch (err) {
    console.warn('AI 回饋失敗：', err);
    // 失敗時靜默隱藏，不影響使用者操作
    EL.aiFeedbackBlock.hidden = true;
  }
}

async function syncUnsyncedRecords() {
  const unsynced = STATE.records.filter(r => !r.synced);
  if (unsynced.length === 0) return;
  let changed = false;
  for (const record of unsynced) {
    try {
      await saveRecordToFirestore(record);
      record.synced = true;
      changed = true;
    } catch (e) {
      console.warn('補同步失敗：', e);
    }
  }
  if (changed) {
    saveToStorage();
    renderHistory();
  }
}

async function handleMyRecords() {
  if (!currentUser) return;
  const url = `${location.origin}${location.pathname.replace('index.html', '')}dashboard.html`;
  window.open(url, '_blank');
}

function refreshSettingsAccountName() {
  if (!EL.btnAccountName) return;
  const nameLabel = currentUser
    ? (currentUser.displayName || currentUser.email || '帳號')
    : '訪客';
  EL.btnAccountName.textContent = `帳號名稱：${nameLabel}`;
  EL.btnAccountName.title = currentUser ? '管理帳號設定' : '請先登入';
}

function handleAccountNameClick() {
  if (currentUser) {
    openAccountModal();
  } else {
    showModal(EL.modalLogin);
  }
}


async function handleGoogleLogin() {
  try {
    hideModal(EL.modalLogin);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    await firebaseAuth.signInWithPopup(provider);
    // onAuthStateChanged 會自動處理後續
  } catch (err) {
    console.error('Google 登入失敗：', err);
    setSyncResult('登入失敗：' + (err.message || err.code), true);
  }
}

async function handleDemoLogin() {
  try {
    await firebaseAuth.signInWithEmailAndPassword('demo@focus.app', 'demo@focus.app');
    hideModal(EL.modalLogin);
  } catch (err) {
    console.error('訪客登入失敗：', err);
    setSyncResult('訪客登入失敗：' + (err.message || err.code), true);
  }
}

// 查看他人的公開紀錄
async function loadPublicUserRecords(userId) {
  if (!firestoreDb) {
    // 等 Firebase 初始化完成
    setTimeout(() => loadPublicUserRecords(userId), 800);
    return;
  }
  try {
    const userDoc = await firestoreDb.collection('users').doc(userId).get();
    if (!userDoc.exists || !userDoc.data().isPublic) {
      setSyncResult('此用戶的紀錄未公開或不存在', true);
      return;
    }
    const name = userDoc.data().displayName || userDoc.data().email || '匿名用戶';

    const snapshot = await firestoreDb
      .collection('users').doc(userId)
      .collection('records')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    // 暫時替換顯示（不影響本機資料）
    const publicRecords = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        timestamp: d.timestamp || '',
        taskName: d.task || '',
        taskReason: d.reason || '',
        taskNote: d.note || '',
        plannedSec: (d.plannedMinutes || 0) * 60,
        actualSec: (d.actualMinutes || 0) * 60,
        status: d.status || 'incomplete',
        endReason: d.stopReason || '',
        category: d.category || '',
        project: d.project || '',
        focus: d.focus || 0,
        distractions: d.distractions
          ? d.distractions.split('、').filter(Boolean) : [],
        synced: true,
      };
    });

    // 在頁面頂部顯示提示
    setSyncResult(`👤 正在查看 ${name} 的公開紀錄（共 ${publicRecords.length} 筆）`, false);

    // 暫時顯示公開紀錄（不存入 STATE）
    renderHistory(publicRecords);

  } catch (err) {
    setSyncResult('載入公開紀錄失敗：' + err.message, true);
  }
}

// 同步單筆：用 Image 請求繞過 CORS
// 密碼驗證：不依賴 Firebase token，簡單可靠
/* ============================================================
   Firestore 相關函式
   ============================================================ */

// 寫入單筆紀錄到 Firestore（訪客帳號不寫入）
async function saveRecordToFirestore(record) {
  if (!currentUser || !firestoreDb || currentUser.email === DEMO_EMAIL) return;
  await firestoreDb
    .collection('users').doc(currentUser.uid)
    .collection('records').doc(String(record.id))
    .set({
      timestamp: record.timestamp || '',
      task: record.taskName || '',
      reason: record.taskReason || '',
      plannedMinutes: Math.round((record.plannedSec || 0) / 60),
      actualMinutes: Math.round((record.actualSec || 0) / 60),
      status: record.status || 'incomplete',
      stopReason: record.endReason || '',
      note: record.taskNote || '',
      category: record.category || '',
      project: record.project || '',
      focus: record.focus || 0,
      distractions: Array.isArray(record.distractions)
        ? record.distractions.join('、') : '',
      synced: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/* ── 開啟帳號設定 Modal ── */
async function openAccountModal() {
  if (!currentUser) return;

  // 填入基本資訊
  EL.accountEmail.textContent = currentUser.email;
  if (currentUser.photoURL) {
    EL.accountAvatar.src = currentUser.photoURL;
    EL.accountAvatar.hidden = false;
  }

  // 讀取現有設定
  const userDoc = await firestoreDb.collection('users').doc(currentUser.uid).get();
  const data = userDoc.exists ? userDoc.data() : {};

  // 用戶名稱
  EL.usernameInput.value = data.username || '';

  // 公開狀態
  const isPublic = data.isPublic || false;
  EL.togglePublic.checked = isPublic;
  updatePublicUI(isPublic, data.username || '');

  showModal(EL.modalAccount);
}

/* ── 更新公開狀態 UI ── */
function updatePublicUI(isPublic, username) {
  EL.publicLabel.textContent = isPublic
    ? '公開（所有人可以透過分享連結查看）'
    : '私密（只有你自己可以看）';

  const isShared = isPublic && username;
  if (isShared) {
    const url = `${location.origin}${location.pathname.replace('index.html', '')}profile.html?user=${username}`;
    EL.shareUrlText.textContent = url;
    EL.shareUrlRow.hidden = false;
  } else {
    EL.shareUrlRow.hidden = true;
  }

  if (EL.btnProfilePage) EL.btnProfilePage.hidden = !isShared;
  if (EL.btnShareLink) EL.btnShareLink.hidden = !isShared;
}

function openPublicProfile() {
  const url = EL.shareUrlText.textContent;
  if (url) {
    window.open(url, '_blank');
    return;
  }
  openAccountModal();
}

/* ── 儲存用戶名稱 ── */
async function handleSaveUsername() {
  const raw = EL.usernameInput.value.trim().toLowerCase();
  const valid = /^[a-zA-Z0-9_]{3,20}$/.test(raw);

  if (!valid) {
    EL.usernameHint.textContent = '⚠ 只能使用英文、數字、底線，長度 3–20 字';
    EL.usernameHint.style.color = '#e85d3a';
    return;
  }

  EL.btnSaveUsername.disabled = true;
  EL.usernameHint.textContent = '檢查中...';
  EL.usernameHint.style.color = 'var(--text-muted)';

  try {
    // 讀取目前已有的用戶名稱（若有則先刪除舊的）
    const userDoc = await firestoreDb.collection('users').doc(currentUser.uid).get();
    const oldUsername = userDoc.exists ? (userDoc.data().username || '') : '';

    // 檢查新名稱是否已被使用
    if (raw !== oldUsername) {
      const existing = await firestoreDb.collection('usernames').doc(raw).get();
      if (existing.exists) {
        EL.usernameHint.textContent = '❌ 此名稱已被使用，請換一個';
        EL.usernameHint.style.color = '#e85d3a';
        EL.btnSaveUsername.disabled = false;
        return;
      }

      // 用 batch 同時寫入（原子操作，避免部分失敗）
      const batch = firestoreDb.batch();

      // 刪除舊名稱索引
      if (oldUsername) {
        batch.delete(firestoreDb.collection('usernames').doc(oldUsername));
      }

      // 新增新名稱索引
      batch.set(firestoreDb.collection('usernames').doc(raw), {
        uid: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // 更新用戶資料
      batch.update(firestoreDb.collection('users').doc(currentUser.uid), {
        username: raw
      });

      await batch.commit();
    }

    EL.usernameHint.textContent = '✅ 已儲存';
    EL.usernameHint.style.color = 'var(--break-green)';

    // 更新公開 UI（顯示新的分享連結）
    const isPublic = EL.togglePublic.checked;
    updatePublicUI(isPublic, raw);

  } catch (err) {
    EL.usernameHint.textContent = '❌ 儲存失敗：' + err.message;
    EL.usernameHint.style.color = '#e85d3a';
  }

  EL.btnSaveUsername.disabled = false;
}

/* ── 切換公開/私密 ── */
async function handleTogglePublic() {
  if (!currentUser) return;
  const isPublic = EL.togglePublic.checked;

  const userDoc = await firestoreDb.collection('users').doc(currentUser.uid).get();
  const username = userDoc.exists ? (userDoc.data().username || '') : '';

  await firestoreDb.collection('users').doc(currentUser.uid)
    .update({ isPublic });

  updatePublicUI(isPublic, username);
}

// 從 Firestore 載入紀錄，合併到本機（避免重複）
async function loadFromFirestore() {
  if (!currentUser || !firestoreDb) return;
  try {
    const snapshot = await firestoreDb
      .collection('users').doc(currentUser.uid)
      .collection('records')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    if (snapshot.empty) return;

    const localIds = new Set(STATE.records.map(r => String(r.id)));
    let added = 0;

    snapshot.docs.forEach(doc => {
      if (localIds.has(doc.id)) return; // 已有，跳過
      const d = doc.data();
      // 還原成本機格式
      STATE.records.push({
        id: Number(doc.id) || doc.id,
        timestamp: d.timestamp || '',
        taskName: d.task || '',
        taskReason: d.reason || '',
        taskNote: d.note || '',
        plannedSec: (d.plannedMinutes || 0) * 60,
        actualSec: (d.actualMinutes || 0) * 60,
        status: d.status || 'incomplete',
        endReason: d.stopReason || '',
        category: d.category || '',
        project: d.project || '',
        focus: d.focus || 0,
        distractions: d.distractions
          ? d.distractions.split('、').filter(Boolean) : [],
        synced: true,
      });
      added++;
    });

    if (added > 0) {
      // 依時間排序（最新在前）
      STATE.records.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      saveToStorage();
      renderHistory();
      updateSummary();
      setSyncResult(`✅ 從雲端載入 ${added} 筆紀錄`, false);
    }
  } catch (err) {
    console.warn('從 Firestore 載入失敗：', err);
  }
}

/* ============================================================
   今日啟動引導
   ============================================================ */
async function checkDailyGoal() {
  if (!currentUser || !firestoreDb) return;

  const today = new Date().toISOString().split('T')[0];
  const docRef = firestoreDb
    .collection('users').doc(currentUser.uid)
    .collection('dailyGoals').doc(today);

  const doc = await docRef.get();

  if (!doc.exists) {
    showModal(EL.modalDailyGoal);
  } else {
    renderTaskShortcuts(doc.data().tasks);
  }
}

async function submitDailyGoal() {
  const goal = EL.dailyGoalInput.value.trim();
  if (!goal) {
    EL.dailyGoalInput.focus();
    return;
  }

  const energy = getSelectedEnergy();

  showTaskSkeleton();
  EL.btnSubmitGoal.disabled = true;

  const recentRecords = STATE.records.slice(0, 10).map(r => ({
    task: r.taskName,
    category: r.category,
    status: r.status,
    actualMinutes: Math.round((r.actualSec || 0) / 60)
  }));

  const workMinutes = parseInt(EL.workMinutes.value) || 25;
  const energyLabel = { high: '狀態很好', mid: '普通', low: '有點累' };

  const today = new Date().toISOString().split('T')[0];
  const todayDoneCount = STATE.records.filter(r => {
    return r.timestamp && r.timestamp.includes(today.replace(/-/g, '/'));
  }).length;

  const prompt = `你是學習任務拆解助手。請幫使用者把今日大目標拆成番茄鐘任務。

今日大目標：「${goal}」
使用者當下狀態：${energyLabel[energy]}
每輪工作時間：${workMinutes} 分鐘
今天已完成輪數：${todayDoneCount} 輪

近期歷史紀錄（最近10筆）：
${JSON.stringify(recentRecords)}

拆解規則：
1. 每個任務必須能在 ${workMinutes} 分鐘內完成
2. 任務名稱要具體，有明確的完成標準
3. 狀態「有點累」時，任務要更小更容易開始
4. 根據歷史紀錄推測使用者的進度，避免重複建議已完成的內容
5. 產出 3~5 個任務

只回傳 JSON 陣列，不要其他文字：
[
  {"task": "任務名稱（具體、可執行）", "reason": "為什麼這輪先做這個（15字以內）"},
  ...
]`;

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(GEMINI_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } }
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) throw new Error('API 回傳空內容');
    raw = raw.replace(/```json|```/g, '').trim();
    const tasks = JSON.parse(raw);

    const docRef = firestoreDb
      .collection('users').doc(currentUser.uid)
      .collection('dailyGoals').doc(today);

    await docRef.set({
      goal,
      energy,
      tasks: tasks.map(t => ({ ...t, done: false })),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    renderDailyTasks(tasks);

  } catch (err) {
    console.error('任務拆解失敗：', err);
    hideTaskSkeleton();
    EL.dailyGoalTaskList.innerHTML = '<p class="goal-error">拆解失敗，請重試</p>';
  }

  EL.btnSubmitGoal.disabled = false;
}

function renderDailyTasks(tasks) {
  hideTaskSkeleton();
  EL.dailyGoalTaskList.innerHTML = tasks.map((t, i) => `
    <button type="button" class="task-card-btn" data-index="${i}"
            data-task="${escapeHTML(t.task)}"
            data-reason="${escapeHTML(t.reason)}">
      <span class="task-card-name">${escapeHTML(t.task)}</span>
      <span class="task-card-reason">${escapeHTML(t.reason)}</span>
    </button>
  `).join('');

  EL.dailyGoalTaskList.querySelectorAll('.task-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      EL.taskName.value = btn.dataset.task;
      EL.taskReason.value = btn.dataset.reason;
      hideModal(EL.modalDailyGoal);
      const details = document.getElementById('taskExtraDetails');
      if (details) details.open = true;
    });
  });
}

function renderTaskShortcuts(tasks) {
  if (!EL.taskShortcutArea || !tasks?.length) return;

  const remaining = tasks.filter(t => !t.done);
  EL.taskShortcutArea.hidden = false;

  if (remaining.length === 0) {
    EL.taskShortcutArea.innerHTML = `
      <div class="shortcut-all-done">
        🎉 今日任務全完成！
        <button type="button" class="shortcut-reset-btn">設定新目標</button>
      </div>
    `;
    EL.taskShortcutArea.querySelector('.shortcut-reset-btn')
      .addEventListener('click', openDailyGoalModal);
    return;
  }

  EL.taskShortcutArea.innerHTML = `
    <div class="shortcut-label">今日任務
      <button type="button" class="shortcut-reset-btn">重設目標</button>
    </div>
    ${remaining.map((t, i) => `
      <div class="shortcut-row">
        <button type="button" class="shortcut-btn"
                data-task="${escapeHTML(t.task)}"
                data-reason="${escapeHTML(t.reason)}">
          ${escapeHTML(t.task)}
        </button>
        <button type="button" class="shortcut-done-btn" data-task="${escapeHTML(t.task)}" title="標記完成">✓</button>
      </div>
    `).join('')}
  `;

  EL.taskShortcutArea.querySelector('.shortcut-reset-btn')
    .addEventListener('click', openDailyGoalModal);

  EL.taskShortcutArea.querySelectorAll('.shortcut-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      EL.taskName.value = btn.dataset.task;
      EL.taskReason.value = btn.dataset.reason;
    });
  });

  EL.taskShortcutArea.querySelectorAll('.shortcut-done-btn').forEach(btn => {
    btn.addEventListener('click', () => markTaskDone(btn.dataset.task));
  });
}

async function markTaskDone(taskName) {
  if (!currentUser || !firestoreDb) return;
  const today = new Date().toISOString().split('T')[0];
  const docRef = firestoreDb
    .collection('users').doc(currentUser.uid)
    .collection('dailyGoals').doc(today);

  const doc = await docRef.get();
  if (!doc.exists) return;

  const tasks = doc.data().tasks.map(t =>
    t.task === taskName ? { ...t, done: true } : t
  );
  await docRef.update({ tasks });
  renderTaskShortcuts(tasks);
}

function openDailyGoalModal() {
  EL.dailyGoalInput.value = '';
  EL.dailyGoalTaskList.innerHTML = '';
  showModal(EL.modalDailyGoal);
}

function showTaskSkeleton() {
  EL.dailyGoalTaskList.innerHTML = `
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
    <div class="skeleton-card"></div>
  `;
}
function hideTaskSkeleton() {
  EL.dailyGoalTaskList.innerHTML = '';
}

function getSelectedEnergy() {
  const active = document.querySelector('.energy-btn.active');
  return active ? active.dataset.energy : 'mid';
}

/* ============================================================
   初始化
   ============================================================ */
function init() {
  initElements();
  renderHistory();
  initEventListeners();
  initFirebase();

  setBadgeMode('idle');
  updateTimerDisplay(getWorkSeconds());
  updateProgressBar(0, getWorkSeconds(), 'work');
  setButtons({ start: false, pause: true, endRound: true, reset: false, break: true });
  setStatus('準備開始');
  updateSummary();
  // ★ 支援分享連結：?user=某人UID
  const viewUserId = new URLSearchParams(location.search).get('user');
  if (viewUserId) loadPublicUserRecords(viewUserId);
}

document.addEventListener('DOMContentLoaded', init);


/* ============================================================
   示範資料填入函式（只執行一次，執行後刪除）
   使用方式：登入訪客帳號後，在瀏覽器 console 輸入 seedDemoData()
   ============================================================ */
async function seedDemoData() {
  if (!currentUser || !firestoreDb) {
    console.error('請先登入訪客帳號再執行');
    return;
  }

  const DEMO_UID = currentUser.uid; // 自動抓當前登入的訪客帳號 UID

  const demoRecords = [
    {
      timestamp: '2026/04/18 上午09:00:00',
      task: '閱讀《深度工作力》第三章',
      reason: '提升專注力理論基礎',
      plannedMinutes: 25, actualMinutes: 25,
      status: 'done', stopReason: '', note: '重點：刻意練習的四個原則',
      category: '讀書', project: '自我成長', focus: 5,
      distractions: '',
      startTime: '09:00', endTime: '09:25', weekday: '五',
    },
    {
      timestamp: '2026/04/18 上午09:30:00',
      task: '寫讀書筆記',
      reason: '內化剛讀完的內容',
      plannedMinutes: 25, actualMinutes: 22,
      status: 'done', stopReason: '', note: '',
      category: '寫作', project: '自我成長', focus: 4,
      distractions: '訊息通知',
      startTime: '09:30', endTime: '09:52', weekday: '五',
    },
    {
      timestamp: '2026/04/18 下午02:00:00',
      task: '練習 LeetCode 題目',
      reason: '準備技術面試',
      plannedMinutes: 40, actualMinutes: 40,
      status: 'done', stopReason: '', note: 'Binary Search 專題',
      category: '程式', project: 'Side Project', focus: 5,
      distractions: '',
      startTime: '14:00', endTime: '14:40', weekday: '五',
    },
    {
      timestamp: '2026/04/18 下午03:00:00',
      task: '回覆工作信件',
      reason: '清空收件匣',
      plannedMinutes: 25, actualMinutes: 10,
      status: 'incomplete', stopReason: '臨時有會議需要先參加', note: '',
      category: '行政', project: '', focus: 3,
      distractions: '臨時插單',
      startTime: '15:00', endTime: '15:10', weekday: '五',
    },
    {
      timestamp: '2026/04/19 上午10:00:00',
      task: '研究 Firebase Firestore 架構',
      reason: '這個番茄鐘 App 的後端需要',
      plannedMinutes: 25, actualMinutes: 25,
      status: 'done', stopReason: '', note: 'Security Rules 需要再研究',
      category: '程式', project: 'Side Project', focus: 5,
      distractions: '',
      startTime: '10:00', endTime: '10:25', weekday: '六',
    },
    {
      timestamp: '2026/04/19 上午10:30:00',
      task: '撰寫 profile.html 頁面',
      reason: '讓用戶可以分享自己的紀錄',
      plannedMinutes: 25, actualMinutes: 28,
      status: 'done', stopReason: '', note: '超時 3 分鐘，下次注意',
      category: '程式', project: 'Side Project', focus: 4,
      distractions: '想滑手機',
      startTime: '10:30', endTime: '10:58', weekday: '六',
    },
    {
      timestamp: '2026/04/20 上午09:00:00',
      task: '英文單字複習',
      reason: '每天維持 25 分鐘英文練習',
      plannedMinutes: 25, actualMinutes: 25,
      status: 'done', stopReason: '', note: 'Anki 複習 80 張',
      category: '讀書', project: '英文', focus: 5,
      distractions: '',
      startTime: '09:00', endTime: '09:25', weekday: '一',
    },
    {
      timestamp: '2026/04/20 上午09:30:00',
      task: '英文聽力練習',
      reason: '提升聽力理解速度',
      plannedMinutes: 25, actualMinutes: 25,
      status: 'done', stopReason: '', note: 'BBC 6 Minutes English',
      category: '讀書', project: '英文', focus: 4,
      distractions: '環境吵',
      startTime: '09:30', endTime: '09:55', weekday: '一',
    },
  ];

  console.log(`開始寫入 ${demoRecords.length} 筆示範資料...`);

  // 先確保用戶文件存在
  await firestoreDb.collection('users').doc(DEMO_UID).set({
    email: 'demo@focus.app',
    displayName: '示範帳號',
    photoURL: '',
    isPublic: true,   // 訪客帳號設為公開
    username: 'demo',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // 建立 username 索引
  await firestoreDb.collection('usernames').doc('demo').set({
    uid: DEMO_UID,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 批次寫入紀錄
  const batch = firestoreDb.batch();
  demoRecords.forEach((r, i) => {
    const ref = firestoreDb
      .collection('users').doc(DEMO_UID)
      .collection('records').doc(`demo_${i + 1}`);
    batch.set(ref, {
      ...r,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  console.log('✅ 示範資料寫入完成！');
  console.log(`訪客個人頁面：${location.origin}${location.pathname.replace('index.html', '')}profile.html?user=demo`);
}
