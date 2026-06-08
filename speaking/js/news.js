// ============================================================
// CONFIG
// ============================================================
const SUPABASE_URL = 'https://ujpwqxxriimtxsjconfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcHdxeHhyaWltdHhzamNvbmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDM5NjIsImV4cCI6MjA5NjExOTk2Mn0.PW8o1O7-kTC_Nl1wN39sqMOwN2H_CNtEKORmEe_u-rA';
const NEWS_WORKER  = 'https://focus.sijialai1473.workers.dev/news';
const GROQ_WORKER  = 'https://focus.sijialai1473.workers.dev/groq-vocab';
const FETCH_WORKER = 'https://focus.sijialai1473.workers.dev/fetch-article';

// ============================================================
// STATE
// ============================================================
let currentArticle = null;
let currentMode = 'normal';
let annotatedHTML = null;
let currentCat = 'technology';
let fullArticleText = null;   // 抓取原文後的完整內容
let fetchingFull = false;     // 防止重複 fetch

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ============================================================
// FETCH NEWS
// ============================================================
async function fetchNews() {
  const btn = document.getElementById('fetch-btn');
  btn.disabled = true; btn.textContent = '載入中...';
  document.getElementById('news-list').innerHTML = '<div class="loading-spinner"><div class="spinner"></div>抓取新聞中...</div>';

  try {
    const res = await fetch(`${NEWS_WORKER}?q=${currentCat}&max=10`);
    const data = await res.json();
    if (!data.articles || data.articles.length === 0) {
      document.getElementById('news-list').innerHTML = '<div class="empty-state"><div class="big">暫無新聞</div><p>請稍後再試或切換分類</p></div>';
      return;
    }
    renderNewsList(data.articles);
  } catch(e) {
    document.getElementById('news-list').innerHTML = `<div class="empty-state"><div class="big">載入失敗</div><p>${e.message}</p></div>`;
  } finally {
    btn.disabled = false; btn.textContent = '重新載入';
  }
}

function renderNewsList(articles) {
  const list = document.getElementById('news-list');
  list.innerHTML = '<div class="news-grid">' + articles.map((a, i) => `
    <div class="news-item" onclick="openArticle(${i})">
      <div class="news-item-meta">
        <span class="news-cat-badge">${currentCat}</span>
        <span class="news-source">${a.source?.name || ''}</span>
        <span class="news-date">${formatDate(a.publishedAt)}</span>
      </div>
      <div class="news-title">${a.title}</div>
      <div class="news-desc">${a.description || ''}</div>
    </div>`).join('') + '</div>';
  list._articles = articles;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
}

// ============================================================
// OPEN ARTICLE
// ============================================================
function openArticle(idx) {
  const articles = document.getElementById('news-list')._articles;
  currentArticle = articles[idx];
  annotatedHTML = null;
  fullArticleText = null;
  fetchingFull = false;
  currentMode = 'normal';

  document.getElementById('r-cat').textContent = currentCat;
  document.getElementById('r-title').textContent = currentArticle.title;
  document.getElementById('r-source').textContent = currentArticle.source?.name || '';
  document.getElementById('r-date').textContent = formatDate(currentArticle.publishedAt);
  document.getElementById('r-link').href = currentArticle.url;
  document.getElementById('r-link2').href = currentArticle.url;

  renderArticleBody('normal');
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'normal'));
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('reader').style.display = 'block';
  window.scrollTo(0,0);

  // 背景抓取完整原文
  fetchFullArticle(currentArticle.url);
}

function showList() {
  document.getElementById('list-view').style.display = 'block';
  document.getElementById('reader').style.display = 'none';
  currentArticle = null; annotatedHTML = null;
  fullArticleText = null; fetchingFull = false;
}

// ============================================================
// FETCH FULL ARTICLE TEXT
// ============================================================
async function fetchFullArticle(url) {
  if (fetchingFull || !url) return;
  fetchingFull = true;

  // 顯示「抓取完整原文中」提示
  const bodyEl = document.getElementById('article-body');
  const indicator = document.createElement('div');
  indicator.id = 'full-fetch-indicator';
  indicator.style.cssText = 'font-size:0.82rem;color:var(--text2);display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0 0;';
  indicator.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:1.5px;"></div> 抓取完整原文中...';
  bodyEl.after(indicator);

  try {
    const res = await fetch(`${FETCH_WORKER}?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const text = data.text || data.content || '';

    if (text && text.length > 200) {
      fullArticleText = text;
      // 只在目前仍是這篇文章的情況下更新畫面
      if (currentArticle?.url === url) {
        annotatedHTML = null; // 清掉舊的標註，讓 vocab 模式重新分析完整文章
        renderArticleBody(currentMode);
      }
    }
  } catch(e) {
    console.warn('Full article fetch failed, using fallback:', e.message);
  } finally {
    document.getElementById('full-fetch-indicator')?.remove();
  }
}

// ============================================================
// DISPLAY MODES
// ============================================================
function getArticleText() {
  if (!currentArticle) return '';
  // 優先使用完整抓取的原文
  if (fullArticleText) return fullArticleText;
  // 降級：用 API 回傳的欄位拼湊
  const parts = [];
  if (currentArticle.title) parts.push(currentArticle.title + '.');
  if (currentArticle.description) parts.push(currentArticle.description);
  if (currentArticle.content) parts.push(currentArticle.content.replace(/\[\d+ chars\].*$/, ''));
  return parts.join('\n\n');
}

function renderArticleBody(mode) {
  const el = document.getElementById('article-body');
  const text = getArticleText();
  el.className = 'article-content';

  if (mode === 'normal') {
    el.innerHTML = text.split('\n\n').map(p => `<p>${p}</p>`).join('');
  } else if (mode === 'highlight') {
    el.classList.add('mode-highlight');
    const highlighted = text.replace(/\b([A-Z][a-z]{3,}|[0-9]+[%$]?|"[^"]+"|'[^']+')\b/g, '<span class="hl">$1</span>');
    el.innerHTML = highlighted.split('\n\n').map(p => `<p>${p}</p>`).join('');
  } else if (mode === 'caps') {
    el.classList.add('mode-caps');
    el.innerHTML = text.split('\n\n').map(p => `<p>${p}</p>`).join('');
  } else if (mode === 'vocab') {
    if (annotatedHTML) {
      el.innerHTML = annotatedHTML;
    } else {
      el.innerHTML = text.split('\n\n').map(p => `<p>${p}</p>`).join('');
      annotateVocab();
    }
  }
}

function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  renderArticleBody(mode);
}

// ============================================================
// AI VOCAB ANNOTATION — Groq
// ============================================================
async function annotateVocab() {
  const statusEl = document.getElementById('annotate-status');
  statusEl.style.display = 'flex';
  const text = getArticleText();

  try {
    const prompt = `You are a vocabulary assistant for English learners preparing for TOEIC.

Given the following English article, identify 8-12 advanced or useful vocabulary words.
Return ONLY a JSON array (no markdown, no explanation) like:
[
  {"word": "infrastructure", "definition_en": "the basic physical systems of a country", "definition_zh": "基礎設施", "example": "The city needs to improve its infrastructure."},
  ...
]

Article:
${text.substring(0, 1500)}`;

    const res = await fetch(GROQ_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 1500) })
    });

    const data = await res.json();
    const raw = data.choices[0].message.content.trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const words = JSON.parse(cleaned);

    buildAnnotatedHTML(text, words);
  } catch(e) {
    showToast('AI 標註失敗，請確認 Groq API key');
    console.error(e);
  } finally {
    statusEl.style.display = 'none';
  }
}

function buildAnnotatedHTML(text, words) {
  let html = text;
  words.sort((a,b) => b.word.length - a.word.length);
  const replaced = new Set();

  words.forEach(w => {
    if (replaced.has(w.word.toLowerCase())) return;
    replaced.add(w.word.toLowerCase());
    const regex = new RegExp(`\\b(${w.word})\\b`, 'gi');
    html = html.replace(regex, (match) =>
      `<span class="vword" data-word="${w.word}" data-en="${w.definition_en}" data-zh="${w.definition_zh}" data-ex="${w.example}">${match}<span class="vtip"><strong>${w.word}</strong>${w.definition_en}<br><span class="zh">${w.definition_zh}</span><br><em style="font-size:0.75rem;color:var(--text2)">${w.example}</em></span><button class="add-word-btn" onclick="saveWord(this,'${w.word.replace(/'/g,"\\'")}','${w.definition_en.replace(/'/g,"\\'")}','${w.definition_zh.replace(/'/g,"\\'")}','${w.example.replace(/'/g,"\\'")}')">+ 加入單字庫</button></span>`
    );
  });

  annotatedHTML = html.split('\n\n').map(p => `<p>${p}</p>`).join('');
  document.getElementById('article-body').innerHTML = annotatedHTML;
}

// ============================================================
// SAVE WORD — Supabase
// ============================================================
async function saveWord(btn, word, def_en, def_zh, example) {
  if (btn.classList.contains('saved')) return;
  btn.textContent = '儲存中...'; btn.disabled = true;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vocabulary`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        word, definition_en: def_en, definition_zh: def_zh,
        example_sentence: example,
        source_title: currentArticle?.title || '',
        source_url: currentArticle?.url || ''
      })
    });
    if (res.ok || res.status === 201) {
      btn.textContent = '✓ 已加入';
      btn.classList.add('saved');
      showToast(`「${word}」已加入單字庫`);
    } else {
      throw new Error(res.status);
    }
  } catch(e) {
    btn.textContent = '+ 加入單字庫'; btn.disabled = false;
    showToast('儲存失敗，請確認 Supabase 設定');
  }
}

// ============================================================
// CATEGORY TABS
// ============================================================
document.getElementById('cat-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.cat-tab');
  if (!tab) return;
  currentCat = tab.dataset.q;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t === tab));
  fetchNews();
});

// Auto-load on page open
fetchNews();