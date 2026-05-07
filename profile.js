'use strict';

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDeAM6lR-NcH--3avA1fqnA620DX2ktsNM',
  authDomain:        'focus-e5f62.firebaseapp.com',
  projectId:         'focus-e5f62',
  storageBucket:     'focus-e5f62.firebasestorage.app',
  messagingSenderId: '1075734057431',
  appId:             '1:1075734057431:web:add0bd3e6f1069ac317b92',
};

/* ── Achievement definitions ── */
const ACHIEVEMENTS = [
  {
    id: 'first',
    icon: '🍅',
    name: '番茄新手',
    desc: '第 1 輪',
    check: (r, s) => r.length >= 1,
  },
  {
    id: 'streak3',
    icon: '🔥',
    name: '三日不斷',
    desc: '連續 3 天',
    check: (r, s) => s.maxStreak >= 3,
  },
  {
    id: 'streak7',
    icon: '🔥🔥',
    name: '週週在線',
    desc: '連續 7 天',
    check: (r, s) => s.maxStreak >= 7,
  },
  {
    id: 'streak30',
    icon: '💪',
    name: '月度鐵人',
    desc: '連續 30 天',
    check: (r, s) => s.maxStreak >= 30,
  },
  {
    id: 'rounds10',
    icon: '⏱️',
    name: '初段班',
    desc: '累計 10 輪',
    check: (r, s) => r.length >= 10,
  },
  {
    id: 'rounds50',
    icon: '⏱️⏱️',
    name: '中段班',
    desc: '累計 50 輪',
    check: (r, s) => r.length >= 50,
  },
  {
    id: 'rounds100',
    icon: '⏱️⏱️⏱️',
    name: '高段班',
    desc: '累計 100 輪',
    check: (r, s) => r.length >= 100,
  },
  {
    id: 'deep',
    icon: '🌟',
    name: '深度專注',
    desc: '單日 120 分+',
    check: (r, s) => s.maxDayMinutes >= 120,
  },
  {
    id: 'perfect',
    icon: '🎯',
    name: '完美達成',
    desc: '完成率 100%（5 筆以上）',
    check: (r, s) => r.length >= 5 && r.every(rec => rec.status === 'done'),
  },
  {
    id: 'fullmonth',
    icon: '📅',
    name: '全勤月份',
    desc: '某月每天有紀錄',
    check: (r, s) => s.hasFullMonth,
  },
];

/* ── Global state ── */
let db, allRecords = [];
let selYear  = new Date().getFullYear();
let selMonth = new Date().getMonth() + 1; // 1-12
const NOW_YEAR  = new Date().getFullYear();
const NOW_MONTH = new Date().getMonth() + 1;

/* ============================================================
   Entry point
   ============================================================ */
async function main() {
  const username = new URLSearchParams(location.search).get('user');
  if (!username) { showError('缺少用戶名稱參數，請使用正確的分享連結。'); return; }

  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();

  try {
    // 1. username → uid
    const unameDoc = await db.collection('usernames').doc(username.toLowerCase()).get();
    if (!unameDoc.exists) { showError(`找不到用戶「${username}」`); return; }
    const uid = unameDoc.data().uid;

    // 2. User profile
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data().isPublic) {
      showError('此用戶的紀錄目前設為私密。'); return;
    }
    const userData = userDoc.data();

    // 3. All records
    const snap = await db.collection('users').doc(uid)
      .collection('records')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
    allRecords = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

    // 4. Render
    renderIdentity(userData, username);
    renderGlobalStats();
    renderAchievements();
    renderMonth();
    initMonthNav();

  } catch (err) {
    console.error(err);
    showError('載入失敗：' + err.message);
  }
}

/* ============================================================
   Helpers
   ============================================================ */
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showError(msg) {
  document.getElementById('profileIdentity').innerHTML =
    `<div class="error-msg">${escapeHTML(msg)}</div>`;
}

// Returns "YYYY-MM-DD" from a Firestore record
function dateStr(record) {
  return record.createdAt?.toDate
    ? record.createdAt.toDate().toISOString().slice(0, 10)
    : null;
}

function recordsForMonth(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return allRecords.filter(r => (dateStr(r) || '').startsWith(prefix));
}

/* ── Aggregate stats over ALL records ── */
function calcGlobalStats() {
  // Current streak (from today backward)
  const dateCounts = {};
  for (const r of allRecords) {
    const d = dateStr(r);
    if (d) dateCounts[d] = (dateCounts[d] || 0) + (r.actualMinutes || 0);
  }
  const allDates = Object.keys(dateCounts).sort();

  // Current streak
  let curStreak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startCheck = dateCounts[today] ? today : (dateCounts[yesterday] ? yesterday : null);
  if (startCheck) {
    const d = new Date(startCheck);
    while (dateCounts[d.toISOString().slice(0, 10)]) {
      curStreak++;
      d.setDate(d.getDate() - 1);
    }
  }

  // Max streak
  let maxStreak = 0, run = 0;
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) { run = 1; }
    else {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      run = (curr - prev) / 86400000 === 1 ? run + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, run);
  }

  // Max single-day minutes
  const maxDayMinutes = Math.max(0, ...Object.values(dateCounts));

  // Full-month check: any calendar month where every day has a record
  let hasFullMonth = false;
  const monthGroups = {};
  for (const iso of allDates) {
    const ym = iso.slice(0, 7); // "YYYY-MM"
    if (!monthGroups[ym]) monthGroups[ym] = new Set();
    monthGroups[ym].add(Number(iso.slice(8, 10)));
  }
  for (const [ym, days] of Object.entries(monthGroups)) {
    const [y, m] = ym.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    if (days.size === daysInMonth) { hasFullMonth = true; break; }
  }

  // This month's minutes
  const thisMonthMin = (allRecords)
    .filter(r => (dateStr(r) || '').startsWith(`${NOW_YEAR}-${String(NOW_MONTH).padStart(2, '0')}`))
    .reduce((s, r) => s + (r.actualMinutes || 0), 0);

  // Overall completion rate
  const doneCount = allRecords.filter(r => r.status === 'done').length;
  const rate = allRecords.length > 0
    ? Math.round(doneCount / allRecords.length * 100)
    : null;

  return { curStreak, maxStreak, maxDayMinutes, hasFullMonth, thisMonthMin, rate };
}

/* ============================================================
   Render: identity
   ============================================================ */
function renderIdentity(userData, username) {
  const name     = userData.displayName || username;
  const photoURL = userData.photoURL || '';
  const avatarHtml = photoURL
    ? `<img src="${escapeHTML(photoURL)}" alt="頭像" class="profile-avatar" />`
    : `<div class="profile-avatar-placeholder">🍅</div>`;

  document.title = `${escapeHTML(name)} 的番茄鐘紀錄`;
  document.getElementById('profileIdentity').innerHTML = `
    ${avatarHtml}
    <div>
      <div class="profile-name">${escapeHTML(name)}</div>
      <div class="profile-username">@${escapeHTML(username)}</div>
    </div>`;
}

/* ============================================================
   Render: global stats row
   ============================================================ */
function renderGlobalStats() {
  const s = calcGlobalStats();
  document.getElementById('statStreak').textContent   = s.curStreak;
  document.getElementById('statMonthMin').textContent = s.thisMonthMin;
  document.getElementById('statRate').textContent     = s.rate !== null ? s.rate + '%' : '—';
}

/* ============================================================
   Render: achievements
   ============================================================ */
function renderAchievements() {
  const stats = calcGlobalStats();
  const grid  = document.getElementById('achievementsGrid');

  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(allRecords, stats);
    return `
      <div class="achievement-badge ${unlocked ? 'unlocked' : 'locked'}" title="${escapeHTML(a.desc)}">
        <div class="badge-icon">${a.icon}</div>
        <div class="badge-name">${escapeHTML(a.name)}</div>
        <div class="badge-desc">${escapeHTML(a.desc)}</div>
      </div>`;
  }).join('');
}

/* ============================================================
   Render: monthly view (heatmap + categories + records)
   ============================================================ */
function renderMonth() {
  updateMonthLabel();
  renderHeatmap();
  renderMonthCategories();
  renderMonthRecords();

  // Disable next-month button if already at current month
  document.getElementById('btnNextMonth').disabled =
    (selYear === NOW_YEAR && selMonth === NOW_MONTH);
}

function updateMonthLabel() {
  const d = new Date(selYear, selMonth - 1, 1);
  document.getElementById('monthLabel').textContent =
    d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });

  const title = `${selYear}年${selMonth}月`;
  document.getElementById('catSectionTitle').textContent = title + ' 分類分佈';
  document.getElementById('recSectionTitle').textContent = title + ' 紀錄';
}

/* ── Heatmap ── */
function renderHeatmap() {
  const grid       = document.getElementById('heatmapGrid');
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const firstDay   = new Date(selYear, selMonth - 1, 1).getDay(); // 0=Sun
  const todayISO   = new Date().toISOString().slice(0, 10);

  // Build per-day minute map
  const dayMap = {};
  const recs   = recordsForMonth(selYear, selMonth);
  for (const r of recs) {
    const iso = dateStr(r);
    if (iso) dayMap[iso] = (dayMap[iso] || 0) + (r.actualMinutes || 0);
  }

  const cells = [];
  // Empty cells before day 1
  for (let i = 0; i < firstDay; i++) {
    cells.push('<div class="hm-cell hm-empty"></div>');
  }
  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const iso     = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const minutes = dayMap[iso] || 0;
    const level   = heatLevel(minutes);
    const isToday = iso === todayISO ? ' hm-today' : '';
    const tip     = minutes > 0 ? `${d}日 ${minutes}分鐘` : `${d}日`;
    cells.push(`
      <div class="hm-cell hm-level-${level}${isToday}" data-tip="${escapeHTML(tip)}">
        <span class="hm-day">${d}</span>
      </div>`);
  }

  grid.innerHTML = cells.join('');
}

function heatLevel(minutes) {
  if (minutes === 0)   return 0;
  if (minutes < 30)    return 1;
  if (minutes < 60)    return 2;
  if (minutes < 120)   return 3;
  return 4;
}

/* ── Monthly categories ── */
function renderMonthCategories() {
  const el   = document.getElementById('profileCats');
  const recs = recordsForMonth(selYear, selMonth);

  if (recs.length === 0) {
    el.innerHTML = '<p class="empty-hint">本月無紀錄</p>';
    return;
  }

  const map = {};
  for (const r of recs) {
    const cat = r.category || '未分類';
    map[cat] = (map[cat] || 0) + (r.actualMinutes || 0);
  }
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);

  el.innerHTML = sorted.map(([name, min]) => {
    const pct = total > 0 ? Math.round(min / total * 100) : 0;
    return `
      <div class="cat-row">
        <span class="cat-name">${escapeHTML(name)}</span>
        <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
        <span class="cat-pct">${pct}%</span>
      </div>`;
  }).join('');
}

/* ── Monthly records list ── */
function renderMonthRecords() {
  const el   = document.getElementById('profileRecords');
  const recs = recordsForMonth(selYear, selMonth);

  if (recs.length === 0) {
    el.innerHTML = '<p class="empty-hint">本月無紀錄</p>';
    return;
  }

  const statusIcon = { done: '✅', partial: '🔶', incomplete: '❌' };

  el.innerHTML = recs.map(r => {
    const iso = dateStr(r) || '';
    const dayLabel = iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '—';
    const cat  = r.category || '未分類';
    const min  = r.actualMinutes || 0;
    const icon = statusIcon[r.status] || '—';
    return `
      <div class="record-row">
        <span class="record-date">${escapeHTML(dayLabel)}</span>
        <span class="record-cat">${escapeHTML(cat)}</span>
        <span class="record-min">${min} 分</span>
        <span class="record-status">${icon}</span>
      </div>`;
  }).join('');
}

/* ============================================================
   Month navigation
   ============================================================ */
function initMonthNav() {
  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    selMonth--;
    if (selMonth < 1) { selMonth = 12; selYear--; }
    renderMonth();
  });
  document.getElementById('btnNextMonth').addEventListener('click', () => {
    if (selYear === NOW_YEAR && selMonth === NOW_MONTH) return;
    selMonth++;
    if (selMonth > 12) { selMonth = 1; selYear++; }
    renderMonth();
  });
}

document.addEventListener('DOMContentLoaded', main);
