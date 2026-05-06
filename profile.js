'use strict';

/* ============================================================
   profile.js — 公開個人紀錄頁面邏輯
   URL 格式：profile.html?user=用戶名稱
   ============================================================ */

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain:        'focus-e5f62.firebaseapp.com',
  projectId:         'focus-e5f62',
  storageBucket:     'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId:             '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

// DOM 節點
const profileHeader      = document.getElementById('profileHeader');
const profileSummary     = document.getElementById('profileSummary');
const profileHistoryList = document.getElementById('profileHistoryList');
const pTotalRounds       = document.getElementById('pTotalRounds');
const pTotalMinutes      = document.getElementById('pTotalMinutes');
const pDoneRate          = document.getElementById('pDoneRate');
const pAvgFocus          = document.getElementById('pAvgFocus');

/* ── 工具函式 ── */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(msg) {
  profileHeader.innerHTML = `<div class="error-hint">${escapeHTML(msg)}</div>`;
  profileHistoryList.innerHTML = '';
}

/* ── 主流程 ── */
async function main() {
  // 取得 URL 參數
  const username = new URLSearchParams(location.search).get('user');
  if (!username) {
    showError('缺少用戶名稱參數，請使用正確的分享連結。');
    return;
  }

  // 初始化 Firebase
  firebase.initializeApp(FIREBASE_CONFIG);
  const db = firebase.firestore();

  try {
    // 1. 用用戶名稱查 UID
    const usernameDoc = await db.collection('usernames').doc(username.toLowerCase()).get();
    if (!usernameDoc.exists) {
      showError(`找不到用戶「${username}」，請確認分享連結是否正確。`);
      return;
    }
    const uid = usernameDoc.data().uid;

    // 2. 讀取用戶資料
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      showError('此用戶資料不存在。');
      return;
    }
    const userData = userDoc.data();

    // 3. 確認是否公開
    if (!userData.isPublic) {
      showError('此用戶的紀錄目前設為私密。');
      return;
    }

    // 4. 渲染用戶資訊
    const displayName = userData.displayName || username;
    const photoURL    = userData.photoURL    || '';
    const avatarHtml  = photoURL
      ? `<img src="${escapeHTML(photoURL)}" alt="頭像" class="profile-avatar" />`
      : `<div class="profile-avatar-placeholder">🍅</div>`;

    document.title = `${displayName} 的番茄鐘紀錄`;
    profileHeader.innerHTML = `
      ${avatarHtml}
      <div>
        <div class="profile-name">${escapeHTML(displayName)}</div>
        <div class="profile-meta">@${escapeHTML(username)}</div>
      </div>
    `;

    // 5. 載入紀錄
    const snap = await db.collection('users').doc(uid)
      .collection('records')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const records = snap.docs.map(doc => doc.data());

    // 6. 計算統計
    const doneRecords = records.filter(r => r.status === 'done' || r.status === 'partial');
    const totalRounds  = doneRecords.length;
    const totalMinutes = doneRecords.reduce((sum, r) => sum + (r.actualMinutes || 0), 0);
    const doneRate     = records.length > 0
      ? Math.round((records.filter(r => r.status === 'done').length / records.length) * 100) + '%'
      : '—';
    const focusRecords = records.filter(r => r.focus > 0);
    const avgFocus     = focusRecords.length > 0
      ? (focusRecords.reduce((s, r) => s + r.focus, 0) / focusRecords.length).toFixed(1)
      : '—';

    pTotalRounds.textContent  = totalRounds;
    pTotalMinutes.textContent = totalMinutes;
    pDoneRate.textContent     = doneRate;
    pAvgFocus.textContent     = avgFocus;
    profileSummary.hidden     = false;

    // 7. 渲染紀錄列表
    if (records.length === 0) {
      profileHistoryList.innerHTML = '<p class="empty-hint">此用戶尚無公開紀錄。</p>';
      return;
    }

    const statusMap   = { done: '✅ 完成', partial: '🔶 部分完成', incomplete: '❌ 未完成' };
    const statusClass = { done: 'done', partial: 'partial', incomplete: 'incomplete' };

    profileHistoryList.innerHTML = records.map(r => {
      const catTag   = r.category ? `<span class="record-tag cat">${escapeHTML(r.category)}</span>` : '';
      const projTag  = r.project  ? `<span class="record-tag proj">${escapeHTML(r.project)}</span>`  : '';
      const focusTag = r.focus    ? `<span class="record-tag focus">專注 ${r.focus}/5</span>`         : '';

      const distrTag = r.distractions
        ? `<span class="record-tag">${escapeHTML(String(r.distractions).split('、').slice(0,2).join('、'))}</span>`
        : '';

      const reasonHtml = r.reason && r.reason !== '（未填寫）'
        ? `<span><span class="meta-label">為什麼：</span>${escapeHTML(r.reason)}</span>` : '';
      const noteHtml = r.note
        ? `<span><span class="meta-label">備註：</span>${escapeHTML(r.note)}</span>` : '';

      const sc = statusClass[r.status] || 'incomplete';

      return `
        <div class="record-card ${sc}">
          <div class="record-card-header">
            <span class="record-card-title">${escapeHTML(r.task || '（未填寫）')}</span>
            <span class="record-status ${sc}">${statusMap[r.status] || r.status}</span>
          </div>
          <div class="record-tags">${catTag}${projTag}${focusTag}${distrTag}</div>
          <div class="record-meta">
            <span><span class="meta-label">時間：</span>${escapeHTML(r.timestamp || '')}</span>
            <span><span class="meta-label">預設：</span>${r.plannedMinutes || 0} 分鐘</span>
            <span><span class="meta-label">實際：</span>${r.actualMinutes || 0} 分鐘</span>
            ${reasonHtml}${noteHtml}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    showError('載入失敗：' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', main);