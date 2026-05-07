'use strict';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain:        'focus-e5f62.firebaseapp.com',
  projectId:         'focus-e5f62',
  storageBucket:     'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId:             '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

const HF_MODEL = 'Qwen/Qwen2.5-7B-Instruct';

const EL = {
  userName:       document.getElementById('dashUserName'),
  avatar:         document.getElementById('dashAvatar'),
  todayMinutes:   document.getElementById('todayMinutes'),
  todayRounds:    document.getElementById('todayRounds'),
  todayRate:      document.getElementById('todayRate'),
  streakCount:    document.getElementById('streakCount'),
  aiText:         document.getElementById('aiInsightText'),
  weeklyChart:    document.getElementById('weeklyChart'),
  categoryList:   document.getElementById('categoryList'),
  historyList:    document.getElementById('dashHistoryList'),
};

let db, allRecords = [];

/* ============================================================
   Entry point
   ============================================================ */
async function main() {
  firebase.initializeApp(FIREBASE_CONFIG);
  const auth = firebase.auth();
  db = firebase.firestore();

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    renderUserInfo(user);
    await loadRecords();
    renderAll();
    loadAIInsights();
  });
}

function renderUserInfo(user) {
  EL.userName.textContent = user.displayName || user.email;
  if (user.photoURL) {
    EL.avatar.src = user.photoURL;
    EL.avatar.hidden = false;
  }
}

/* ============================================================
   Firestore
   ============================================================ */
async function loadRecords() {
  const snap = await db
    .collection('users').doc(firebase.auth().currentUser.uid)
    .collection('records')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
  allRecords = snap.docs.map(doc => ({ _docId: doc.id, ...doc.data() }));
}

/* ============================================================
   Statistics
   ============================================================ */
function dateStr(record) {
  return record.createdAt?.toDate
    ? record.createdAt.toDate().toISOString().slice(0, 10)
    : null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calcToday() {
  const today = todayISO();
  const recs  = allRecords.filter(r => dateStr(r) === today);
  const done  = recs.filter(r => r.status === 'done' || r.status === 'partial');
  return {
    minutes: recs.reduce((s, r) => s + (r.actualMinutes || 0), 0),
    rounds:  done.length,
    rate:    recs.length > 0
      ? Math.round(recs.filter(r => r.status === 'done').length / recs.length * 100)
      : null,
  };
}

function calcStreak() {
  const dates = new Set(allRecords.map(dateStr).filter(Boolean));
  let streak = 0;
  const d = new Date();
  // Start from today; if no record today, try yesterday
  if (!dates.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcWeekly() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const iso    = d.toISOString().slice(0, 10);
    const recs   = allRecords.filter(r => dateStr(r) === iso);
    const done   = recs.filter(r => r.status === 'done' || r.status === 'partial');
    return {
      iso,
      label:   ['日','一','二','三','四','五','六'][d.getDay()],
      minutes: recs.reduce((s, r) => s + (r.actualMinutes || 0), 0),
      rounds:  done.length,
      isToday: i === 6,
    };
  });
}

function calcCategories() {
  const map = {};
  for (const r of allRecords) {
    if (r.category) map[r.category] = (map[r.category] || 0) + (r.actualMinutes || 0);
  }
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, minutes]) => ({
      name,
      minutes,
      pct: total > 0 ? Math.round(minutes / total * 100) : 0,
    }));
}

function calcBestHour() {
  const counts = new Array(24).fill(0);
  for (const r of allRecords) {
    if (r.createdAt?.toDate) counts[r.createdAt.toDate().getHours()]++;
  }
  return counts.indexOf(Math.max(...counts));
}

/* ============================================================
   Rendering
   ============================================================ */
function renderAll() {
  const today      = calcToday();
  const streak     = calcStreak();
  const weekly     = calcWeekly();
  const categories = calcCategories();

  EL.todayMinutes.textContent = today.minutes;
  EL.todayRounds.textContent  = today.rounds;
  EL.todayRate.textContent    = today.rate !== null ? today.rate + '%' : '—';
  EL.streakCount.textContent  = streak;

  renderWeekly(weekly);
  renderCategories(categories);
  renderHistory();
}

function renderWeekly(weekly) {
  const maxMin = Math.max(...weekly.map(d => d.minutes), 1);
  EL.weeklyChart.innerHTML = weekly.map(d => {
    const alpha  = d.minutes === 0 ? 0 : Math.max(0.18, d.minutes / maxMin);
    const bg     = d.minutes === 0
      ? 'var(--bg-input)'
      : `rgba(230, 90, 56, ${alpha})`;
    const border = d.isToday ? 'border:2px solid var(--tomato)' : 'border:2px solid transparent';
    return `
      <div class="week-col">
        <div class="week-bar" style="background:${bg};${border}" title="${d.iso}: ${d.minutes} 分鐘"></div>
        <div class="week-label">${d.label}</div>
        <div class="week-min">${d.minutes > 0 ? d.minutes : '—'}</div>
      </div>`;
  }).join('');
}

function renderCategories(categories) {
  if (categories.length === 0) {
    EL.categoryList.innerHTML = '<p class="empty-hint">尚無分類資料</p>';
    return;
  }
  EL.categoryList.innerHTML = categories.map(c => `
    <div class="cat-row">
      <span class="cat-name">${escapeHTML(c.name)}</span>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${c.pct}%"></div></div>
      <span class="cat-pct">${c.pct}%</span>
    </div>`).join('');
}

function renderHistory() {
  if (allRecords.length === 0) {
    EL.historyList.innerHTML = '<p class="empty-hint">尚無紀錄</p>';
    return;
  }

  const groups = {};
  for (const r of allRecords) {
    const key = dateStr(r);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const statusMap   = { done: '✅ 完成', partial: '🔶 部分完成', incomplete: '❌ 未完成' };
  const statusClass = { done: 'done', partial: 'partial', incomplete: 'incomplete' };
  const weekdays    = ['日','一','二','三','四','五','六'];

  EL.historyList.innerHTML = Object.entries(groups).map(([iso, recs]) => {
    const d       = new Date(iso);
    const weekday = weekdays[d.getDay()];
    const total   = recs.reduce((s, r) => s + (r.actualMinutes || 0), 0);

    const cards = recs.map(r => {
      const sc = statusClass[r.status] || 'incomplete';
      const reasonHtml = r.reason && r.reason !== '（未填寫）'
        ? `<span><span class="meta-label">為什麼：</span>${escapeHTML(r.reason)}</span>` : '';
      return `
        <div class="record-card ${sc}">
          <div class="record-card-header">
            <span class="record-card-title">${escapeHTML(r.task || '（未填寫）')}</span>
            <span class="record-status ${sc}">${statusMap[r.status] || r.status}</span>
          </div>
          <div class="record-tags">
            ${r.category  ? `<span class="record-tag cat">${escapeHTML(r.category)}</span>`       : ''}
            ${r.project   ? `<span class="record-tag proj">${escapeHTML(r.project)}</span>`       : ''}
            ${r.focus     ? `<span class="record-tag focus">專注 ${r.focus}/5</span>`             : ''}
          </div>
          <div class="record-meta">
            <span>${r.actualMinutes || 0} 分鐘</span>
            ${reasonHtml}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="history-day-group">
        <div class="history-day-header">
          <span>${iso} (${weekday})</span>
          <span class="history-day-total">${total} 分鐘</span>
        </div>
        ${cards}
      </div>`;
  }).join('');
}

/* ============================================================
   AI Insights（Hugging Face Inference API）
   ============================================================ */
async function loadAIInsights() {
  const key = localStorage.getItem('hf_api_key');
  if (!key) {
    renderKeyInput();
    return;
  }
  await fetchInsights(key);
}

function renderKeyInput() {
  EL.aiText.innerHTML = `
    <div class="ai-key-row">
      <input type="password" id="hfKeyInput" class="hf-key-input" placeholder="貼上你的 Hugging Face API Key" />
      <button id="hfKeyBtn" class="btn btn-primary btn-sm">分析</button>
    </div>
    <p class="ai-key-hint">
      Key 只存在你的瀏覽器，不會上傳。
      <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener">取得 Key →</a>
    </p>`;

  document.getElementById('hfKeyBtn').addEventListener('click', async () => {
    const key = document.getElementById('hfKeyInput').value.trim();
    if (!key) return;
    localStorage.setItem('hf_api_key', key);
    await fetchInsights(key);
  });
}

async function fetchInsights(apiKey) {
  EL.aiText.innerHTML = '<span class="ai-loading">AI 分析中...</span>';

  try {
    const today      = calcToday();
    const streak     = calcStreak();
    const categories = calcCategories();
    const weekly     = calcWeekly();
    const weekTotal  = weekly.reduce((s, d) => s + d.minutes, 0);
    const bestHour   = calcBestHour();
    const timeLabel  = bestHour < 12 ? '上午' : bestHour < 18 ? '下午' : '晚上';
    const topCat     = categories[0]?.name || '無';

    const prompt = `你是一個習慣分析助理。請用繁體中文、像朋友一樣的語氣，用 2-3 句話分析以下學習數據，並給一個具體可執行的建議：
- 連續專注天數：${streak} 天
- 本週總專注：${weekTotal} 分鐘
- 今日：${today.minutes} 分鐘 / ${today.rounds} 輪 / 完成率 ${today.rate ?? '—'}%
- 最常見分類：${topCat}（${categories[0]?.pct ?? 0}%）
- 最常專注時段：${timeLabel}（${bestHour} 點附近）
- 總紀錄數：${allRecords.length} 筆`;

    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:       HF_MODEL,
          messages:    [{ role: 'user', content: prompt }],
          max_tokens:  250,
          temperature: 0.7,
        }),
      }
    );

    if (res.status === 401) {
      localStorage.removeItem('hf_api_key');
      EL.aiText.innerHTML = '<span class="ai-error">API Key 無效，請重新輸入。</span>';
      renderKeyInput();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '（無法取得洞察）';

    EL.aiText.innerHTML = `
      <span>${escapeHTML(text)}</span>
      <button class="ai-reset-btn" id="aiResetBtn">重新輸入 Key</button>`;
    document.getElementById('aiResetBtn').addEventListener('click', () => {
      localStorage.removeItem('hf_api_key');
      renderKeyInput();
    });

  } catch (err) {
    console.error(err);
    EL.aiText.innerHTML = `<span class="ai-error">分析失敗：${escapeHTML(err.message)}</span>
      <button class="ai-reset-btn" id="aiResetBtn">重新輸入 Key</button>`;
    document.getElementById('aiResetBtn').addEventListener('click', () => {
      localStorage.removeItem('hf_api_key');
      renderKeyInput();
    });
  }
}

/* ============================================================
   Utilities
   ============================================================ */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', main);
