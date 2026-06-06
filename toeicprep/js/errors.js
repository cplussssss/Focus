/**
 * errors.js — 錯題筆記頁面邏輯
 */

import { showToast, partBadge, confirmDelete } from "./utils.js";
import { fetchErrors, addError, updateError, deleteError } from "./supabase.js";

// ── State ─────────────────────────────────────────────────

let allErrors  = [];   // 從 DB 讀回的完整資料
let editingId  = null; // 正在編輯的 id（null = 新增模式）

// ── DOM refs ──────────────────────────────────────────────

const errorList     = document.getElementById("error-list");
const filterPart    = document.getElementById("filter-part");
const filterType    = document.getElementById("filter-type");
const filterKeyword = document.getElementById("filter-keyword");
const filterStats   = document.getElementById("filter-stats");

const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle    = document.getElementById("modal-title");
const modalClose    = document.getElementById("modal-close");
const btnAdd        = document.getElementById("btn-add");
const btnCancel     = document.getElementById("btn-cancel");
const btnSubmit     = document.getElementById("btn-submit");

const fPart      = document.getElementById("f-part");
const fQno       = document.getElementById("f-qno");
const fErrorType = document.getElementById("f-error-type");
const fContent   = document.getElementById("f-content");
const fNote      = document.getElementById("f-note");

// ── Render ────────────────────────────────────────────────

function getFilteredErrors() {
  const part    = filterPart.value;
  const type    = filterType.value;
  const keyword = filterKeyword.value.trim().toLowerCase();

  return allErrors.filter(e => {
    if (part    && e.part       !== part)   return false;
    if (type    && e.error_type !== type)   return false;
    if (keyword) {
      const hay = [e.question_no, e.content, e.note, e.error_type]
        .join(" ").toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });
}

function renderList() {
  const data = getFilteredErrors();
  filterStats.textContent = `共 ${data.length} 筆`;

  if (data.length === 0) {
    errorList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">目前沒有符合條件的錯題</div>
      </div>`;
    return;
  }

  errorList.innerHTML = data.map(e => {
    const date = e.created_at
      ? new Date(e.created_at).toLocaleDateString("zh-TW")
      : "";

    const reviewBadge = e.reviewed
      ? `<span class="error-reviewed">✓ 已複習</span>` : "";

    const contentHtml = e.content
      ? `<div class="error-content">${escHtml(e.content)}</div>` : "";

    return `
      <div class="error-card" data-id="${e.id}">
        <div class="error-card-header">
          ${partBadge(e.part)}
          ${e.question_no ? `<span class="error-qno">${escHtml(e.question_no)}</span>` : ""}
          <span class="error-type-tag">${escHtml(e.error_type || "")}</span>
          ${reviewBadge}
          <span class="error-date">${date}</span>
        </div>
        ${contentHtml}
        <div class="error-note">${escHtml(e.note || "")}</div>
        <div class="error-card-footer">
          <button class="btn btn-ghost btn-sm" onclick="toggleReview('${e.id}', ${!e.reviewed})">
            ${e.reviewed ? "↩ 標記未讀" : "✓ 標記複習"}
          </button>
          <div class="ml-auto flex gap-2">
            <button class="btn btn-secondary btn-sm" onclick="openEdit('${e.id}')">編輯</button>
            <button class="btn btn-danger btn-sm" onclick="handleDelete('${e.id}')">刪除</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Load Data ─────────────────────────────────────────────

async function loadErrors() {
  errorList.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <span>載入錯題中…</span>
    </div>`;
  try {
    allErrors = await fetchErrors();
    renderList();
  } catch (err) {
    console.error(err);
    errorList.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-text">載入失敗：${err.message}</div>
    </div>`;
    showToast("載入失敗，請確認 Supabase 設定", "error");
  }
}

// ── Modal ─────────────────────────────────────────────────

function openModal(title) {
  modalTitle.textContent = title;
  modalBackdrop.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  fPart.focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  document.body.style.overflow = "";
  clearForm();
  editingId = null;
}

function clearForm() {
  fPart.value = "";
  fQno.value  = "";
  fErrorType.value = "";
  fContent.value   = "";
  fNote.value      = "";
}

function openAdd() {
  editingId = null;
  clearForm();
  openModal("新增錯題");
}

window.openEdit = function(id) {
  const e = allErrors.find(x => x.id === id);
  if (!e) return;

  editingId        = id;
  fPart.value      = e.part      || "";
  fQno.value       = e.question_no || "";
  fErrorType.value = e.error_type  || "";
  fContent.value   = e.content   || "";
  fNote.value      = e.note      || "";

  openModal("編輯錯題");
};

// ── Submit ────────────────────────────────────────────────

async function handleSubmit() {
  if (!fPart.value)      { showToast("請選擇 Part", "error"); fPart.focus(); return; }
  if (!fErrorType.value) { showToast("請選擇錯誤類型", "error"); fErrorType.focus(); return; }
  if (!fNote.value.trim()){ showToast("請填寫筆記", "error"); fNote.focus(); return; }

  const payload = {
    part:        fPart.value,
    question_no: fQno.value.trim() || null,
    error_type:  fErrorType.value,
    content:     fContent.value.trim() || null,
    note:        fNote.value.trim(),
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = "儲存中…";

  try {
    if (editingId) {
      const updated = await updateError(editingId, payload);
      allErrors = allErrors.map(e => e.id === editingId ? updated : e);
      showToast("錯題已更新", "success");
    } else {
      const created = await addError(payload);
      allErrors.unshift(created);
      showToast("錯題已新增", "success");
    }
    closeModal();
    renderList();
  } catch (err) {
    console.error(err);
    showToast("儲存失敗：" + err.message, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "儲存";
  }
}

// ── Delete ────────────────────────────────────────────────

window.handleDelete = async function(id) {
  if (!confirmDelete()) return;

  try {
    await deleteError(id);
    allErrors = allErrors.filter(e => e.id !== id);
    renderList();
    showToast("已刪除", "info");
  } catch (err) {
    showToast("刪除失敗：" + err.message, "error");
  }
};

// ── Toggle Reviewed ───────────────────────────────────────

window.toggleReview = async function(id, reviewed) {
  try {
    const updated = await updateError(id, { reviewed });
    allErrors = allErrors.map(e => e.id === id ? updated : e);
    renderList();
    showToast(reviewed ? "已標記複習 ✓" : "已取消複習", "info");
  } catch (err) {
    showToast("操作失敗", "error");
  }
};

// ── Event Listeners ───────────────────────────────────────

btnAdd.addEventListener("click",    openAdd);
btnCancel.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);
btnSubmit.addEventListener("click",  handleSubmit);

modalBackdrop.addEventListener("click", e => {
  if (e.target === modalBackdrop) closeModal();
});

[filterPart, filterType].forEach(el =>
  el.addEventListener("change", renderList)
);

filterKeyword.addEventListener("input", () => {
  clearTimeout(filterKeyword._t);
  filterKeyword._t = setTimeout(renderList, 250);
});

// ── Init ──────────────────────────────────────────────────

loadErrors();
