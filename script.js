/**
 * script.js — 番茄鐘前端邏輯
 *
 * 架構說明：
 *  - STATE：集中管理所有狀態，方便除錯與後續擴充
 *  - initElements()：取得 DOM 節點，只執行一次
 *  - initEventListeners()：綁定所有事件
 *  - 計時相關：startWork / pauseTimer / resumeTimer / endRoundEarly / resetTimer / startBreak
 *  - UI 更新：updateTimerDisplay / updateProgressBar / setBadgeMode / setButtons
 *  - 紀錄相關：saveRecord / renderHistory / loadFromStorage / saveToStorage
 *  - Modal 操作：showModal / hideModal
 *  - 音效：playBeep
 */

'use strict';
// ============================================================
// 新增：後端串接設定
// ============================================================

// ★ 替換為你自己的 Firebase 設定
const firebaseConfig = {
    apiKey: "AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM",
    authDomain: "focus-e5f62.firebaseapp.com",
    projectId: "focus-e5f62",
    storageBucket: "focus-e5f62.firebasestorage.app",
    messagingSenderId: "1075734057431",
    appId: "1:1075734057431:web:add0bd3e6f1069ac317b92",
    measurementId: "G-5SKT3TEVHW"
};

// ★ 替換為你的 Apps Script Web App 部署 URL
const APPS_SCRIPT_URL = 'AKfycbw833GfMLZT-8IDmHh7aRLf_zAMYNnv8FMuXnCzOcByVMg-KuhwLHFzrPNZov9DgEuB';

// Firebase app 實例（init 後賦值）
let firebaseAuth = null;
let currentUser = null;
/* ============================================================
   1. 全域狀態 (STATE)
   ============================================================ */

const STATE = {
    mode: 'idle',       // 'idle' | 'work' | 'work-overtime' | 'break' | 'paused'
    pausedMode: null,   // 暫停前的 mode，用於恢復
    intervalId: null,   // setInterval 的 ID
    secondsLeft: 0,     // 目前倒數剩餘秒數（也用於正計時的已超時秒數）
    workTotalSeconds: 0,  // 本輪設定的工作秒數
    breakTotalSeconds: 0, // 本輪設定的休息秒數
    actualWorkSeconds: 0, // 本輪實際工作秒數（含超時）
    workStartTime: null,  // 工作開始的 Date 物件（用於記錄時間戳記）
    records: [],          // 紀錄陣列，後續可串接後端

    // 「結束本輪」對話框的觸發來源（'endRound' | 'reset'）
    pendingAction: null,
};

/* ============================================================
   2. DOM 節點快取
   ============================================================ */

let EL = {}; // 所有 DOM 節點存在此物件，方便管理

function initElements() {
    EL = {
        // 顯示
        modeBadge: document.getElementById('modeBadge'),
        timerDisplay: document.getElementById('timerDisplay'),
        statusText: document.getElementById('statusText'),
        progressBarFill: document.getElementById('progressBarFill'),

        // 設定輸入
        workMinutes: document.getElementById('workMinutes'),
        breakMinutes: document.getElementById('breakMinutes'),

        // 任務輸入
        taskName: document.getElementById('taskName'),
        taskReason: document.getElementById('taskReason'),
        taskNote: document.getElementById('taskNote'),

        // 按鈕
        btnStart: document.getElementById('btnStart'),
        btnPause: document.getElementById('btnPause'),
        btnEndRound: document.getElementById('btnEndRound'),
        btnReset: document.getElementById('btnReset'),
        btnBreak: document.getElementById('btnBreak'),
        btnClearHistory: document.getElementById('btnClearHistory'),

        // 歷史紀錄
        historyList: document.getElementById('historyList'),

        // Modal：中途結束原因
        modalEndReason: document.getElementById('modalEndReason'),
        endReasonInput: document.getElementById('endReasonInput'),
        btnConfirmEnd: document.getElementById('btnConfirmEnd'),
        btnCancelEnd: document.getElementById('btnCancelEnd'),

        // Modal：休息建議
        modalBreakSuggest: document.getElementById('modalBreakSuggest'),
        breakSuggestion: document.getElementById('breakSuggestion'),
        btnModalStartBreak: document.getElementById('btnModalStartBreak'),

        // Modal：休息結束
        modalBreakDone: document.getElementById('modalBreakDone'),
        btnModalNextRound: document.getElementById('btnModalNextRound'),
    };
}

/* ============================================================
   3. 休息建議清單
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

/**
 * 隨機取得一條休息建議
 * @returns {string}
 */
function getRandomBreakSuggestion() {
    return BREAK_SUGGESTIONS[Math.floor(Math.random() * BREAK_SUGGESTIONS.length)];
}

/* ============================================================
   4. 音效（用 Web Audio API 產生提示音，不需外部音效檔）
   ============================================================ */

/**
 * 播放簡單的提示音
 * @param {'work-done' | 'break-done'} type
 */
function playBeep(type) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // 建立音符序列
        const notes = type === 'work-done'
            ? [{ freq: 523, dur: 0.15 }, { freq: 659, dur: 0.15 }, { freq: 784, dur: 0.25 }]   // C E G 上行
            : [{ freq: 784, dur: 0.15 }, { freq: 659, dur: 0.15 }, { freq: 523, dur: 0.3 }];   // G E C 下行

        let t = ctx.currentTime;
        notes.forEach(({ freq, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
            osc.start(t);
            osc.stop(t + dur);
            t += dur + 0.04;
        });
    } catch (e) {
        // 部分瀏覽器政策不允許自動播放，靜默失敗
        console.warn('playBeep error:', e);
    }
}

/* ============================================================
   5. 格式化工具
   ============================================================ */

/**
 * 將秒數轉為 mm:ss 字串
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
    const abs = Math.abs(totalSeconds);
    const m = String(Math.floor(abs / 60)).padStart(2, '0');
    const s = String(abs % 60).padStart(2, '0');
    return `${m}:${s}`;
}

/**
 * 將秒數轉為 x分y秒 易讀格式
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m === 0) return `${s} 秒`;
    if (s === 0) return `${m} 分鐘`;
    return `${m} 分 ${s} 秒`;
}

/**
 * 取得目前時間的易讀字串
 * @returns {string}
 */
function getNowString() {
    return new Date().toLocaleString('zh-TW', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    });
}

/* ============================================================
   6. UI 更新函式
   ============================================================ */

/**
 * 更新計時器數字顯示
 * @param {number} seconds
 */
function updateTimerDisplay(seconds) {
    EL.timerDisplay.textContent = formatTime(seconds);
}

/**
 * 更新進度條寬度
 * @param {number} elapsed   - 已過去秒數
 * @param {number} total     - 總秒數
 * @param {'work'|'break'|'overtime'} type
 */
function updateProgressBar(elapsed, total, type) {
    let pct = total > 0 ? (elapsed / total) * 100 : 0;
    pct = Math.min(100, Math.max(0, pct));
    EL.progressBarFill.style.width = `${pct}%`;

    // 切換進度條顏色
    EL.progressBarFill.classList.remove('break-mode', 'overtime-mode');
    if (type === 'break') EL.progressBarFill.classList.add('break-mode');
    if (type === 'overtime') EL.progressBarFill.classList.add('overtime-mode');
}

/**
 * 設定模式徽章文字與樣式
 * @param {'work'|'break'|'overtime'|'idle'} mode
 */
function setBadgeMode(mode) {
    const text = { work: '工作模式', break: '休息模式', overtime: '超時工作', idle: '準備中' };
    EL.modeBadge.textContent = text[mode] || '';
    EL.modeBadge.className = 'mode-badge';
    if (mode === 'break') EL.modeBadge.classList.add('break-mode');
    if (mode === 'overtime') EL.modeBadge.classList.add('overtime-mode');

    // 計時顯示字色
    EL.timerDisplay.className = 'timer-display';
    if (mode === 'break') EL.timerDisplay.classList.add('break-mode');
    if (mode === 'overtime') EL.timerDisplay.classList.add('overtime-mode');
}

/**
 * 統一設定按鈕 disabled 狀態
 * @param {Object} map  - 按鈕名稱 → boolean(disabled)
 */
function setButtons(map) {
    const keyToEl = {
        start: EL.btnStart,
        pause: EL.btnPause,
        endRound: EL.btnEndRound,
        reset: EL.btnReset,
        break: EL.btnBreak,
    };
    for (const [key, disabled] of Object.entries(map)) {
        if (keyToEl[key]) keyToEl[key].disabled = disabled;
    }
}

/**
 * 設定狀態文字
 * @param {string} text
 */
function setStatus(text) {
    EL.statusText.textContent = text;
}

/* ============================================================
   7. Modal 操作
   ============================================================ */

/**
 * 顯示 Modal
 * @param {HTMLElement} modalEl
 */
function showModal(modalEl) {
    modalEl.hidden = false;
}

/**
 * 隱藏 Modal
 * @param {HTMLElement} modalEl
 */
function hideModal(modalEl) {
    modalEl.hidden = true;
}

/* ============================================================
   8. 計時器核心邏輯
   ============================================================ */

/**
 * 清除 setInterval
 */
function clearTimer() {
    if (STATE.intervalId !== null) {
        clearInterval(STATE.intervalId);
        STATE.intervalId = null;
    }
}

/**
 * 取得輸入框的工作秒數（帶預設值與邊界保護）
 * @returns {number}
 */
function getWorkSeconds() {
    const min = parseInt(EL.workMinutes.value, 10);
    return isNaN(min) || min < 1 ? 25 * 60 : min * 60;
}

/**
 * 取得輸入框的休息秒數
 * @returns {number}
 */
function getBreakSeconds() {
    const min = parseInt(EL.breakMinutes.value, 10);
    return isNaN(min) || min < 1 ? 5 * 60 : min * 60;
}

/* ────────────────────────────────────────────
   8-1. 開始工作模式
   ──────────────────────────────────────────── */
function startWork() {
    STATE.workTotalSeconds = getWorkSeconds();
    STATE.breakTotalSeconds = getBreakSeconds();
    STATE.secondsLeft = STATE.workTotalSeconds;
    STATE.actualWorkSeconds = 0;
    STATE.workStartTime = new Date();
    STATE.mode = 'work';

    setBadgeMode('work');
    updateTimerDisplay(STATE.secondsLeft);
    updateProgressBar(0, STATE.workTotalSeconds, 'work');
    setStatus('工作中...');
    setButtons({ start: true, pause: false, endRound: false, reset: false, break: true });

    // 工作期間隱藏設定欄位（選擇性：這裡改為鎖定輸入框）
    EL.workMinutes.disabled = true;
    EL.breakMinutes.disabled = true;

    STATE.intervalId = setInterval(tickWork, 1000);
}

/**
 * 工作模式每秒 tick
 */
function tickWork() {
    STATE.actualWorkSeconds++;

    if (STATE.secondsLeft > 0) {
        // 正常倒數
        STATE.secondsLeft--;
        const elapsed = STATE.workTotalSeconds - STATE.secondsLeft;
        updateTimerDisplay(STATE.secondsLeft);
        updateProgressBar(elapsed, STATE.workTotalSeconds, 'work');

    } else {
        // 倒數結束 → 進入超時正計時
        if (STATE.mode !== 'work-overtime') {
            // 只第一次進入超時時觸發
            STATE.mode = 'work-overtime';
            setBadgeMode('overtime');
            setStatus('⚠️ 工作時間已結束，超時進行中...');
            updateProgressBar(100, 100, 'overtime');
            playBeep('work-done');
            // 讓計時顯示閃一下
            EL.timerDisplay.classList.add('pulse');
            setTimeout(() => EL.timerDisplay.classList.remove('pulse'), 400);
        }

        // 超時：正向計時（STATE.secondsLeft 這裡當「已超時秒數」用）
        STATE.secondsLeft--; // 往負值走，formatTime 會取絕對值
        updateTimerDisplay(STATE.secondsLeft);
    }
}

/* ────────────────────────────────────────────
   8-2. 暫停 / 繼續
   ──────────────────────────────────────────── */
function pauseTimer() {
    if (STATE.mode !== 'work' && STATE.mode !== 'work-overtime' && STATE.mode !== 'break') return;
    clearTimer();
    STATE.pausedMode = STATE.mode;
    STATE.mode = 'paused';
    EL.timerDisplay.classList.add('paused');
    setStatus('⏸ 已暫停');
    EL.btnPause.textContent = '▶ 繼續';
    setButtons({ start: true, endRound: false, reset: false, break: STATE.pausedMode !== 'break' });
}

function resumeTimer() {
    if (STATE.mode !== 'paused') return;
    STATE.mode = STATE.pausedMode;
    STATE.pausedMode = null;
    EL.timerDisplay.classList.remove('paused');
    EL.btnPause.textContent = '⏸ 暫停';

    // 恢復對應的 tick
    if (STATE.mode === 'work' || STATE.mode === 'work-overtime') {
        setStatus(STATE.mode === 'work-overtime' ? '⚠️ 工作時間已結束，超時進行中...' : '工作中...');
        STATE.intervalId = setInterval(tickWork, 1000);
    } else if (STATE.mode === 'break') {
        setStatus('☕ 休息中...');
        STATE.intervalId = setInterval(tickBreak, 1000);
    }

    setButtons({ start: true, pause: false, endRound: STATE.mode === 'break', reset: false, break: STATE.mode !== 'break' });
}

/* ────────────────────────────────────────────
   8-3. 結束本輪（中途）
   ──────────────────────────────────────────── */
/**
 * 觸發「結束本輪」流程：先暫停計時，顯示原因輸入 Modal
 * @param {'endRound'|'reset'} action - 觸發來源
 */
function triggerEndEarly(action) {
    // 若計時尚未開始，直接處理 reset
    if (STATE.mode === 'idle') {
        if (action === 'reset') doReset();
        return;
    }

    STATE.pendingAction = action;

    // 暫停（不改 mode）
    clearTimer();
    EL.timerDisplay.classList.remove('paused');

    EL.endReasonInput.value = '';
    showModal(EL.modalEndReason);
}

/**
 * 使用者填好原因，按確認後執行
 */
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
    resetToIdle();

    // 若是「重設計時」觸發，不需額外動作；若是「結束本輪」，只需回到 idle
    STATE.pendingAction = null;
}

/* ────────────────────────────────────────────
   8-4. 重設計時
   ──────────────────────────────────────────── */
function handleReset() {
    if (STATE.mode === 'idle') {
        doReset();
        return;
    }
    // 計時進行中 → 同「結束本輪」流程
    triggerEndEarly('reset');
}

/**
 * 真正執行重設（UI 歸零，不儲存紀錄）
 */
function doReset() {
    clearTimer();
    STATE.mode = 'idle';
    STATE.secondsLeft = 0;
    STATE.actualWorkSeconds = 0;

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

/**
 * 結束本輪後回到 idle（不重設輸入框）
 */
function resetToIdle() {
    clearTimer();
    STATE.mode = 'idle';
    STATE.secondsLeft = 0;
    STATE.actualWorkSeconds = 0;
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

/* ────────────────────────────────────────────
   8-5. 開始休息
   ──────────────────────────────────────────── */
/**
 * 按下「開始休息」按鈕時：
 *  - 先儲存工作完成紀錄（status: done）
 *  - 顯示休息建議 Modal
 */
function handleStartBreak() {
    if (STATE.mode !== 'work' && STATE.mode !== 'work-overtime' && STATE.mode !== 'paused') return;

    clearTimer();
    EL.timerDisplay.classList.remove('paused');

    // 若暫停中，先取回 mode
    if (STATE.mode === 'paused') {
        STATE.mode = STATE.pausedMode;
        STATE.pausedMode = null;
    }

    // 儲存本輪工作紀錄（已完成）
    saveRecord({ status: 'done', endReason: '' });

    // 顯示休息建議
    EL.breakSuggestion.textContent = getRandomBreakSuggestion();
    showModal(EL.modalBreakSuggest);

    setButtons({ start: true, pause: true, endRound: true, reset: false, break: true });
}

/**
 * Modal 上按「開始休息計時」後，真正啟動休息倒數
 */
function startBreakTimer() {
    hideModal(EL.modalBreakSuggest);

    STATE.mode = 'break';
    STATE.secondsLeft = STATE.breakTotalSeconds;

    setBadgeMode('break');
    updateTimerDisplay(STATE.secondsLeft);
    updateProgressBar(0, STATE.breakTotalSeconds, 'break');
    setStatus('☕ 休息中...');
    setButtons({ start: true, pause: false, endRound: true, reset: true, break: true });

    document.body.className = 'mode-break';
    STATE.intervalId = setInterval(tickBreak, 1000);
}

/**
 * 休息模式每秒 tick
 */
function tickBreak() {
    if (STATE.secondsLeft > 0) {
        STATE.secondsLeft--;
        const elapsed = STATE.breakTotalSeconds - STATE.secondsLeft;
        updateTimerDisplay(STATE.secondsLeft);
        updateProgressBar(elapsed, STATE.breakTotalSeconds, 'break');
    } else {
        // 休息結束
        clearTimer();
        playBeep('break-done');
        setStatus('✅ 休息結束！準備下一輪？');
        showModal(EL.modalBreakDone);
    }
}

/* ============================================================
   9. 紀錄邏輯
   ============================================================ */

/**
 * 儲存一筆工作紀錄
 * @param {{ status: 'done'|'incomplete', endReason: string }} opts
 */
function saveRecord({ status, endReason }) {
    const record = {
        id: Date.now(),
        timestamp: getNowString(),
        taskName: EL.taskName.value.trim() || '（未填寫）',
        taskReason: EL.taskReason.value.trim() || '（未填寫）',
        taskNote: EL.taskNote.value.trim(),
        plannedSec: STATE.workTotalSeconds,
        actualSec: STATE.actualWorkSeconds,
        status: status,
        endReason: endReason,
        synced: false,
    };
    STATE.records.unshift(record); // 最新的排在最上面
    saveToStorage();
    renderHistory();
}

/**
 * 渲染歷史紀錄到頁面
 */
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

/**
 * 防 XSS：轉義 HTML 特殊字元
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* ============================================================
   10. localStorage 讀寫
   ============================================================ */

const STORAGE_KEY = 'pomodoro_records_v1';

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.records));
    } catch (e) {
        console.warn('localStorage 寫入失敗：', e);
    }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            STATE.records = JSON.parse(raw);
        }
    } catch (e) {
        console.warn('localStorage 讀取失敗：', e);
        STATE.records = [];
    }
}

/* ============================================================
   11. 事件綁定
   ============================================================ */

function initEventListeners() {

    /* ── 開始按鈕 ── */
    EL.btnStart.addEventListener('click', () => {
        if (STATE.mode === 'idle') {
            startWork();
        }
    });

    /* ── 暫停 / 繼續按鈕 ── */
    EL.btnPause.addEventListener('click', () => {
        if (STATE.mode === 'paused') {
            resumeTimer();
        } else {
            pauseTimer();
        }
    });

    /* ── 結束本輪按鈕 ── */
    EL.btnEndRound.addEventListener('click', () => {
        if (STATE.mode === 'idle') return;
        if (STATE.mode === 'break') {
            // 休息模式中結束 → 直接回 idle（不儲存工作紀錄，工作紀錄已在點休息時儲存）
            clearTimer();
            resetToIdle();
            return;
        }
        triggerEndEarly('endRound');
    });

    /* ── 重設計時按鈕 ── */
    EL.btnReset.addEventListener('click', handleReset);

    /* ── 開始休息按鈕 ── */
    EL.btnBreak.addEventListener('click', handleStartBreak);

    /* ── Modal：確認結束 ── */
    EL.btnConfirmEnd.addEventListener('click', confirmEndEarly);

    /* ── Modal：取消結束 ── */
    EL.btnCancelEnd.addEventListener('click', () => {
        hideModal(EL.modalEndReason);
        STATE.pendingAction = null;
        // 恢復計時
        if (STATE.mode === 'work' || STATE.mode === 'work-overtime') {
            STATE.intervalId = setInterval(tickWork, 1000);
            setStatus(STATE.mode === 'work-overtime' ? '⚠️ 工作時間已結束，超時進行中...' : '工作中...');
        } else if (STATE.mode === 'break') {
            STATE.intervalId = setInterval(tickBreak, 1000);
            setStatus('☕ 休息中...');
        }
    });

    /* ── Modal：開始休息計時 ── */
    EL.btnModalStartBreak.addEventListener('click', startBreakTimer);

    /* ── Modal：休息結束後開始下一輪 ── */
    EL.btnModalNextRound.addEventListener('click', () => {
        hideModal(EL.modalBreakDone);
        document.body.className = '';
        resetToIdle();
    });

    /* ── 清除歷史紀錄 ── */
    EL.btnClearHistory.addEventListener('click', () => {
        if (confirm('確定要清除所有歷史紀錄嗎？')) {
            STATE.records = [];
            saveToStorage();
            renderHistory();
        }
    });

    /* ── 工作時間輸入框同步更新計時顯示（只在 idle 時） ── */
    EL.workMinutes.addEventListener('input', () => {
        if (STATE.mode === 'idle') {
            updateTimerDisplay(getWorkSeconds());
            updateProgressBar(0, getWorkSeconds(), 'work');
        }
    });

    /* ── 按 Enter 關閉 Modal（中途結束原因） ── */
    EL.endReasonInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            confirmEndEarly();
        }
    });
}

/* ============================================================
   12. 初始化
   ============================================================ */

function init() {
    initElements();
    loadFromStorage();
    renderHistory();
    initEventListeners();

    // 初始顯示
    setBadgeMode('idle');
    updateTimerDisplay(getWorkSeconds());
    updateProgressBar(0, getWorkSeconds(), 'work');
    setButtons({ start: false, pause: true, endRound: true, reset: false, break: true });
    setStatus('準備開始');
    initFirebase();
}
// 在既有的 init() 函式最末尾呼叫 Firebase 初始化
// （確保 initElements() 已執行）

/* ============================================================
   新增：Firebase 登入 & Google Sheet 同步邏輯
   ============================================================ */

// ── Firebase 初始化 ──
function initFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();

        // 監聽登入狀態變化
        firebaseAuth.onAuthStateChanged(function (user) {
            currentUser = user;
            updateSyncUI(user);
        });

        document.getElementById('btnGoogleLogin').addEventListener('click', handleGoogleLogin);
        document.getElementById('btnGoogleLogout').addEventListener('click', handleGoogleLogout);
        document.getElementById('btnSyncAll').addEventListener('click', handleSyncAll);

    } catch (err) {
        console.error('Firebase 初始化失敗：', err);
    }
}
// ── 更新同步面板 UI ──
function updateSyncUI(user) {
    const loggedOut = document.getElementById('syncLoggedOut');
    const loggedIn = document.getElementById('syncLoggedIn');
    if (!loggedOut || !loggedIn) return;

    if (user) {
        loggedOut.hidden = true;
        loggedIn.hidden = false;
        document.getElementById('syncUserEmail').textContent = user.email || '';
        const avatar = document.getElementById('syncUserAvatar');
        if (user.photoURL) {
            avatar.src = user.photoURL;
            avatar.hidden = false;
        } else {
            avatar.hidden = true;
        }
    } else {
        loggedOut.hidden = false;
        loggedIn.hidden = true;
    }
    setSyncResult('', false);
}

// ── Google 登入 ──
async function handleGoogleLogin() {
    try {
        setSyncResult('登入中...', false);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        // GitHub Pages 上 signInWithRedirect 會因 COOP header 失敗，
        // 改用 signInWithPopup，COOP 的警告不影響實際登入功能
        const result = await firebaseAuth.signInWithPopup(provider);
        // 登入成功後 onAuthStateChanged 會自動更新 UI，不需要額外處理
        console.log('登入成功：', result.user.email);

    } catch (err) {
        console.error('Google 登入失敗：', err);
        // auth/popup-blocked：瀏覽器擋住 popup，提示使用者允許
        if (err.code === 'auth/popup-blocked') {
            setSyncResult('Popup 被瀏覽器封鎖，請允許此網站開啟彈出視窗後再試', true);
        } else if (err.code === 'auth/popup-closed-by-user') {
            setSyncResult('登入視窗已關閉', true);
        } else {
            setSyncResult('登入失敗：' + (err.message || err.code), true);
        }
    }
}

// ── Google 登出 ──
async function handleGoogleLogout() {
    try {
        await firebaseAuth.signOut();
    } catch (err) {
        console.error('登出失敗：', err);
    }
}

// ── 同步所有未同步紀錄 ──
async function handleSyncAll() {
    if (!currentUser) {
        setSyncResult('請先登入 Google 帳號', true);
        return;
    }

    // 篩選尚未同步的紀錄
    const unsynced = STATE.records.filter(r => !r.synced);
    if (unsynced.length === 0) {
        setSyncResult('✅ 所有紀錄都已同步過了', false);
        return;
    }

    const btn = document.getElementById('btnSyncAll');
    btn.disabled = true;
    setSyncResult(`正在同步 ${unsynced.length} 筆紀錄...`, false);

    let successCount = 0;
    let failCount = 0;

    for (const record of unsynced) {
        const result = await syncOneRecord(record);
        if (result.success) {
            // 標記為已同步（更新 STATE.records 中對應的項目）
            const idx = STATE.records.findIndex(r => r.id === record.id);
            if (idx !== -1) STATE.records[idx].synced = true;
            successCount++;
        } else {
            failCount++;
            console.error('同步失敗：', result.error, record);
        }
    }

    // 儲存更新後的 synced 狀態到 localStorage
    saveToStorage();
    renderHistory();

    if (failCount === 0) {
        setSyncResult(`✅ 成功同步 ${successCount} 筆紀錄`, false);
    } else {
        setSyncResult(`⚠️ 成功 ${successCount} 筆，失敗 ${failCount} 筆，請查看 console`, true);
    }

    btn.disabled = false;
}

// ── 同步單筆紀錄 ──
async function syncOneRecord(record) {
  try {
    const idToken = await currentUser.getIdToken(false);

    const payload = {
      timestamp:      record.timestamp  || '',
      task:           record.taskName   || '',
      reason:         record.taskReason || '',
      plannedMinutes: Math.round((record.plannedSec || 0) / 60),
      actualMinutes:  Math.round((record.actualSec  || 0) / 60),
      status:         record.status     || 'incomplete',
      stopReason:     record.endReason  || '',
      note:           record.taskNote   || ''
    };

    const url = APPS_SCRIPT_URL
      + '?idToken=' + encodeURIComponent(idToken)
      + '&record='  + encodeURIComponent(JSON.stringify(payload));

    // no-cors：瀏覽器允許送出但不給你讀回應（opaque response）
    // 這是 GitHub Pages → Apps Script 唯一穩定可行的方式
    await fetch(url, {
      method:   'GET',
      mode:     'no-cors',
      redirect: 'follow'
    });

    // no-cors 下無法判斷成功與否，採樂觀策略
    // 只要 fetch 沒有拋出例外，就視為送出成功
    return { success: true };

  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

// ── 設定同步結果文字 ──
function setSyncResult(text, isError) {
    const el = document.getElementById('syncResult');
    if (!el) return;
    el.textContent = text;
    el.className = 'sync-result' + (isError ? ' error' : '');
}
// DOM 載入完成後執行初始化
document.addEventListener('DOMContentLoaded', init);