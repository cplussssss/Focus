/**
 * checklist.js — 每日檢核表頁面邏輯
 */

import { showToast, todayString, formatDate } from "./utils.js";
import { fetchChecklist, saveChecklist } from "./supabase.js";

// ── Task Templates ────────────────────────────────────────

const TASK_TEMPLATES = {
  listening: [
    {
      group: "暖身",
      icon: "🌅",
      tasks: [
        { id: "l_warm_1", label: "設定學習計時器（45 分鐘）", duration: "5 min" },
        { id: "l_warm_2", label: "複習昨日錯題筆記", duration: "10 min" },
      ]
    },
    {
      group: "聽力訓練",
      icon: "🎧",
      tasks: [
        { id: "l_s1", label: "影子跟讀練習（選一篇音檔）", duration: "20 min" },
        { id: "l_s2", label: "Part 1 照片描述 × 10 題", duration: "10 min" },
        { id: "l_s3", label: "Part 2 應答問題 × 15 題",  duration: "15 min" },
        { id: "l_s4", label: "Part 3/4 短對話與獨白 × 1 組", duration: "15 min" },
      ]
    },
    {
      group: "複習",
      icon: "📝",
      tasks: [
        { id: "l_r1", label: "記錄今日錯題到筆記", duration: "10 min" },
        { id: "l_r2", label: "查詢不懂的單字 × 5 個", duration: "5 min" },
      ]
    }
  ],

  reading: [
    {
      group: "暖身",
      icon: "🌅",
      tasks: [
        { id: "r_warm_1", label: "設定學習計時器（45 分鐘）", duration: "5 min" },
        { id: "r_warm_2", label: "單字卡複習 30 張", duration: "10 min" },
      ]
    },
    {
      group: "閱讀訓練",
      icon: "📖",
      tasks: [
        { id: "r_s1", label: "Part 5 文法填空 × 20 題", duration: "15 min" },
        { id: "r_s2", label: "Part 6 段落填空 × 1 篇",   duration: "10 min" },
        { id: "r_s3", label: "Part 7 閱讀理解 × 1–2 篇", duration: "20 min" },
      ]
    },
    {
      group: "複習",
      icon: "📝",
      tasks: [
        { id: "r_r1", label: "記錄今日錯題到筆記", duration: "10 min" },
        { id: "r_r2", label: "整理新學會的文法點", duration: "5 min" },
      ]
    }
  ],

  full: [
    {
      group: "考前準備",
      icon: "📋",
      tasks: [
        { id: "f_pre_1", label: "確認考試用具（耳機、計時器）", duration: "5 min" },
        { id: "f_pre_2", label: "清空桌面、禁止手機",           duration: "2 min" },
      ]
    },
    {
      group: "聽力全卷",
      icon: "🎧",
      tasks: [
        { id: "f_l1", label: "Part 1–4 全卷作答（不中斷）", duration: "45 min" },
      ]
    },
    {
      group: "閱讀全卷",
      icon: "📖",
      tasks: [
        { id: "f_r1", label: "Part 5–7 全卷作答（計時 75 分鐘）", duration: "75 min" },
      ]
    },
    {
      group: "考後分析",
      icon: "📊",
      tasks: [
        { id: "f_a1", label: "對答案、計算預估分數",           duration: "15 min" },
        { id: "f_a2", label: "記錄錯題（每個 Part 各挑 3 題）", duration: "20 min" },
        { id: "f_a3", label: "反思今日弱點，制定明日策略",      duration: "10 min" },
      ]
    }
  ]
};

// ── State ─────────────────────────────────────────────────

let currentMode  = null;
let taskState    = {};   // { taskId: boolean }
let savedRecord  = null; // 當前日期已存的 DB 資料

// ── DOM refs ──────────────────────────────────────────────

const clDate             = document.getElementById("cl-date");
const todayLabel         = document.getElementById("today-label");
const modeBtns           = document.querySelectorAll(".mode-btn");
const checklistContainer = document.getElementById("checklist-container");
const progressWrapper    = document.getElementById("progress-wrapper");
const progressFill       = document.getElementById("progress-fill");
const progressCount      = document.getElementById("progress-count");
const saveRow            = document.getElementById("save-row");
const saveHint           = document.getElementById("save-hint");
const btnSave            = document.getElementById("btn-save");

// ── Date Init ─────────────────────────────────────────────

function initDate() {
  const today = todayString();
  clDate.value = today;
  todayLabel.textContent = formatDate(today);
}

clDate.addEventListener("change", async () => {
  todayLabel.textContent = formatDate(clDate.value);
  savedRecord = null;
  await loadSavedRecord();
});

// ── Mode Select ───────────────────────────────────────────

modeBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;
    selectMode(mode);
  });
});

function selectMode(mode) {
  currentMode = mode;
  modeBtns.forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  buildTaskState(mode);
  renderChecklist();
  updateProgress();
  saveRow.style.display = "flex";
}

function buildTaskState(mode) {
  // 如果有已存記錄，且模式相符，載入已存狀態
  if (savedRecord && savedRecord.mode === mode && savedRecord.tasks) {
    taskState = {};
    savedRecord.tasks.forEach(t => { taskState[t.id] = t.done; });
    return;
  }

  // 否則全部初始化為 false
  taskState = {};
  TASK_TEMPLATES[mode].forEach(group => {
    group.tasks.forEach(t => { taskState[t.id] = false; });
  });
}

// ── Render Checklist ──────────────────────────────────────

function renderChecklist() {
  if (!currentMode) return;
  const groups = TASK_TEMPLATES[currentMode];

  const completionBanner = `
    <div class="completion-banner" id="completion-banner">
      <span class="completion-icon">🎉</span>
      <span class="completion-text">今日任務全部完成！繼續保持！</span>
    </div>`;

  const groupsHtml = groups.map(group => {
    const doneCount = group.tasks.filter(t => taskState[t.id]).length;

    const tasksHtml = group.tasks.map(t => `
      <div class="task-item ${taskState[t.id] ? "done" : ""}"
           data-task-id="${t.id}" onclick="toggleTask('${t.id}')">
        <div class="task-checkbox"></div>
        <span class="task-label">${t.label}</span>
        ${t.duration ? `<span class="task-duration">${t.duration}</span>` : ""}
      </div>
    `).join("");

    return `
      <div class="checklist-group">
        <div class="group-header">
          <span class="group-icon">${group.icon}</span>
          <span class="group-title">${group.group}</span>
          <span class="group-count">${doneCount}/${group.tasks.length}</span>
        </div>
        ${tasksHtml}
      </div>`;
  }).join("");

  checklistContainer.innerHTML = completionBanner + groupsHtml;
  updateCompletionBanner();
}

// ── Toggle Task ───────────────────────────────────────────

window.toggleTask = function(id) {
  taskState[id] = !taskState[id];

  // 更新單一項目 DOM（不需重繪全部）
  const item = document.querySelector(`[data-task-id="${id}"]`);
  if (item) item.classList.toggle("done", taskState[id]);

  // 更新 group count
  const groupEl = item?.closest(".checklist-group");
  if (groupEl) {
    const allItems = groupEl.querySelectorAll(".task-item");
    const doneItems = groupEl.querySelectorAll(".task-item.done");
    groupEl.querySelector(".group-count").textContent =
      `${doneItems.length}/${allItems.length}`;
  }

  updateProgress();
  updateCompletionBanner();
};

function updateProgress() {
  if (!currentMode) return;
  const allIds = TASK_TEMPLATES[currentMode].flatMap(g => g.tasks.map(t => t.id));
  const done   = allIds.filter(id => taskState[id]).length;
  const total  = allIds.length;
  const pct    = total ? Math.round((done / total) * 100) : 0;

  progressFill.style.width = pct + "%";
  progressCount.textContent = `${done} / ${total}`;
  progressWrapper.style.display = total ? "" : "none";
}

function updateCompletionBanner() {
  if (!currentMode) return;
  const allIds = TASK_TEMPLATES[currentMode].flatMap(g => g.tasks.map(t => t.id));
  const allDone = allIds.every(id => taskState[id]);
  const banner = document.getElementById("completion-banner");
  if (banner) banner.classList.toggle("show", allDone);
}

// ── Load Saved Record ─────────────────────────────────────

async function loadSavedRecord() {
  const date = clDate.value;
  try {
    savedRecord = await fetchChecklist(date);
    if (savedRecord) {
      selectMode(savedRecord.mode);
      saveHint.innerHTML = `<span class="saved-badge">✓ 已有記錄</span>`;
    } else {
      saveHint.textContent = "";
      // Reset UI if no record
      if (!currentMode) {
        modeBtns.forEach(b => b.classList.remove("active"));
        checklistContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">👆</div>
            <div class="empty-state-text">請先選擇今日學習模式</div>
          </div>`;
        saveRow.style.display = "none";
        progressWrapper.style.display = "none";
      }
    }
  } catch (err) {
    console.error("讀取記錄失敗", err);
  }
}

// ── Save ──────────────────────────────────────────────────

btnSave.addEventListener("click", async () => {
  if (!currentMode) { showToast("請先選擇學習模式", "error"); return; }

  const allIds = TASK_TEMPLATES[currentMode].flatMap(g => g.tasks.map(t => t.id));
  const tasks  = allIds.map(id => ({ id, done: !!taskState[id] }));

  // Add labels for readability in DB
  const tasksWithLabel = tasks.map(t => {
    const tpl = TASK_TEMPLATES[currentMode]
      .flatMap(g => g.tasks)
      .find(x => x.id === t.id);
    return { ...t, label: tpl?.label || t.id };
  });

  btnSave.disabled = true;
  btnSave.textContent = "儲存中…";

  try {
    await saveChecklist({
      date:  clDate.value,
      mode:  currentMode,
      tasks: tasksWithLabel,
    });
    showToast("今日記錄已儲存 ✓", "success");
    saveHint.innerHTML = `<span class="saved-badge">✓ 已儲存</span>`;
  } catch (err) {
    console.error(err);
    showToast("儲存失敗：" + err.message, "error");
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "💾 儲存今日記錄";
  }
});

// ── Init ──────────────────────────────────────────────────

initDate();
loadSavedRecord();
