/**
 * utils.js — 共用工具函式
 */

// ── Toast 通知 ────────────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3000) {
  const container = getToastContainer();

  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

// ── 日期工具 ──────────────────────────────────────────────

export function todayString() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

export function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y} 年 ${parseInt(m)} 月 ${parseInt(d)} 日`;
}

// ── Part Badge ────────────────────────────────────────────

const PART_CLASS_MAP = {
  "Part 1": "badge-part1",
  "Part 2": "badge-part2",
  "Part 3": "badge-part3",
  "Part 4": "badge-part4",
  "Part 5": "badge-part5",
  "Part 6": "badge-part6",
  "Part 7": "badge-part7",
};

export function partBadge(part) {
  const cls = PART_CLASS_MAP[part] || "badge-default";
  return `<span class="badge ${cls}">${part}</span>`;
}

// ── 確認刪除對話框 ────────────────────────────────────────

export function confirmDelete(message = "確定要刪除這筆記錄嗎？") {
  return window.confirm(message);
}

// ── 錯誤類型選項 ─────────────────────────────────────────

export const ERROR_TYPES = [
  "聽力理解",
  "文法結構",
  "詞彙選擇",
  "閱讀理解",
  "答題速度",
  "生活常識",
  "商業用語",
  "其他",
];

export const PARTS = [
  "Part 1", "Part 2", "Part 3", "Part 4",
  "Part 5", "Part 6", "Part 7",
];
