// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = 'https://ujpwqxxriimtxsjconfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcHdxeHhyaWltdHhzamNvbmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDM5NjIsImV4cCI6MjA5NjExOTk2Mn0.PW8o1O7-kTC_Nl1wN39sqMOwN2H_CNtEKORmEe_u-rA';

// ============================================================
// STATE
// ============================================================
let allWords = [];
let currentView = 'cards';

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ============================================================
// LOAD WORDS
// ============================================================
async function loadWords() {
  document.getElementById('word-container').innerHTML = '<div class="loading-state"><div class="spinner"></div> 載入單字庫...</div>';
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vocabulary?select=*&order=created_at.desc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    allWords = await res.json();
    document.getElementById('word-count').textContent = allWords.length + ' 個單字';
    renderWords();
  } catch(e) {
    document.getElementById('word-container').innerHTML = '<div class="empty-state"><div class="big">載入失敗</div><p>請確認 Supabase 設定</p></div>';
  }
}

// ============================================================
// FILTER + SORT
// ============================================================
function filterWords() { renderWords(); }

function getSortedFiltered() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  const sort = document.getElementById('sort-sel').value;
  let words = q ? allWords.filter(w =>
    w.word.toLowerCase().includes(q) ||
    (w.definition_zh || '').includes(q) ||
    (w.definition_en || '').toLowerCase().includes(q)
  ) : [...allWords];
  if (sort === 'newest') words.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  else if (sort === 'oldest') words.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  else if (sort === 'alpha') words.sort((a,b) => a.word.localeCompare(b.word));
  return words;
}

// ============================================================
// RENDER
// ============================================================
function setView(v) {
  currentView = v;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  renderWords();
}

function renderWords() {
  const words = getSortedFiltered();
  const container = document.getElementById('word-container');
  if (words.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="big">單字庫是空的</div><p>在新聞閱讀頁面選擇「標註單字」模式，點擊單字旁的「+ 加入單字庫」</p></div>';
    return;
  }
  if (currentView === 'cards') renderCardView(words, container);
  else renderFlipView(words, container);
}

function renderCardView(words, container) {
  container.innerHTML = '<div class="word-grid">' + words.map(w => `
    <div class="word-card" id="card-${w.id}">
      <button class="delete-btn" onclick="deleteWord('${w.id}')" title="刪除">✕</button>
      <div class="word-en">${w.word}</div>
      <div class="word-zh">${w.definition_zh || ''}</div>
      <div class="word-def">${w.definition_en || ''}</div>
      ${w.example_sentence ? `<div class="word-example">${w.example_sentence}</div>` : ''}
      <div class="word-source">
        ${w.source_title ? `<a href="${w.source_url || '#'}" target="_blank" title="${w.source_title}">來源: ${w.source_title.substring(0,30)}${w.source_title.length>30?'...':''}</a>` : '<span></span>'}
        <span class="word-date">${formatDate(w.created_at)}</span>
      </div>
    </div>`).join('') + '</div>';
}

function renderFlipView(words, container) {
  container.innerHTML = '<div style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text2)">點擊卡片翻面查看中文解釋</div><div class="flip-grid">' + words.map(w => `
    <div class="flip-card" onclick="this.classList.toggle('flipped')">
      <div class="flip-inner">
        <div class="flip-front">
          <div class="flip-word">${w.word}</div>
          <div class="flip-hint">點擊查看</div>
        </div>
        <div class="flip-back">
          <div class="flip-zh">${w.definition_zh || ''}</div>
          <div class="flip-def">${w.definition_en || ''}</div>
        </div>
      </div>
    </div>`).join('') + '</div>';
}

// ============================================================
// DELETE
// ============================================================
async function deleteWord(id) {
  if (!confirm('確定要刪除這個單字嗎？')) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vocabulary?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    if (res.ok || res.status === 204) {
      allWords = allWords.filter(w => w.id !== id);
      document.getElementById('word-count').textContent = allWords.length + ' 個單字';
      document.getElementById(`card-${id}`)?.remove();
      showToast('已刪除');
    }
  } catch(e) { showToast('刪除失敗'); }
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// INIT
// ============================================================
loadWords();
