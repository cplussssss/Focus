// ============================================================
// CONFIG
// ============================================================
const NEWS_WORKER  = 'https://focus.sijialai1473.workers.dev/news';
const GROQ_WORKER  = 'https://focus.sijialai1473.workers.dev/groq-vocab';
const FETCH_WORKER = 'https://focus.sijialai1473.workers.dev/fetch-article';
const VOC_WORKER   = 'https://focus.sijialai1473.workers.dev/voc';
const TTS_WORKER   = 'https://focus.sijialai1473.workers.dev/tts';

// ============================================================
// STATE
// ============================================================
let currentArticle = null;
let currentMode = 'normal';
let annotatedHTML = null;
let currentCat = 'technology';
let fullArticleText = null;
let fetchingFull = false;
let _newsAudio = null;
let _newsTtsLoading = false;

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ============================================================
// TTS — 新聞語音播放
// ============================================================
function toggleNewsTTS() {
  if (window.FocusAuth && window.FocusAuth.getCurrentUser() === null) {
    window.FocusAuth.showLoginRequired();
    return;
  }
  const btn = document.getElementById('news-tts-btn');
  const wave = document.getElementById('news-tts-wave');
  if (_newsTtsLoading) return;

  // 已有音頻：暫停/繼續
  if (_newsAudio && !_newsAudio.ended) {
    if (_newsAudio.paused) {
      _newsAudio.play();
      wave.classList.remove('hidden');
      btn.textContent = '⏸ 暫停';
    } else {
      _newsAudio.pause();
      wave.classList.add('hidden');
      btn.textContent = '▶ 繼續';
    }
    return;
  }

  const text = getArticleText();
  if (!text) return;
  _newsTtsLoading = true;
  btn.disabled = true; btn.textContent = '載入中...';

  fetch(TTS_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.substring(0, 4000), voice: 'en-US-Wavenet-F', languageCode: 'en-US' })
  })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
  .then(blob => {
    const url = URL.createObjectURL(blob);
    _newsAudio = new Audio(url);
    _newsTtsLoading = false;
    btn.disabled = false; btn.textContent = '⏸ 暫停';
    wave.classList.remove('hidden');
    _newsAudio.play();
    _newsAudio.onended = () => {
      wave.classList.add('hidden');
      btn.textContent = '🔊 朗讀文章';
    };
  })
  .catch(() => {
    _newsTtsLoading = false;
    btn.disabled = false; btn.textContent = '🔊 朗讀文章';
    showToast('語音載入失敗');
  });
}

function stopNewsTTS() {
  if (_newsAudio) { _newsAudio.pause(); _newsAudio = null; }
  _newsTtsLoading = false;
  const btn = document.getElementById('news-tts-btn');
  const wave = document.getElementById('news-tts-wave');
  if (btn) { btn.disabled = false; btn.textContent = '🔊 朗讀文章'; }
  if (wave) wave.classList.add('hidden');
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

  stopNewsTTS();

  document.getElementById('r-cat').textContent = currentCat;
  document.getElementById('r-title').textContent = currentArticle.title;
  document.getElementById('r-source').textContent = currentArticle.source?.name || '';
  document.getElementById('r-date').textContent = formatDate(currentArticle.publishedAt);
  document.getElementById('r-link').href = currentArticle.url;
  document.getElementById('r-link2').href = currentArticle.url;

  // 清空並隱藏摘要
  const summaryEl = document.getElementById('article-summary');
  summaryEl.style.display = 'none';
  summaryEl.innerHTML = '';

  renderArticleBody('normal');
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'normal'));
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('reader').style.display = 'block';
  window.scrollTo(0,0);

  // 背景抓取完整原文
  fetchFullArticle(currentArticle.url);
}

function showList() {
  stopNewsTTS();
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
      if (currentArticle?.url === url) {
        annotatedHTML = null;
        renderArticleBody(currentMode);
        // 抓取完成後產生摘要
        generateSummary(text);
      }
    }
  } catch(e) {
    console.warn('Full article fetch failed, using fallback:', e.message);
  } finally {
    document.getElementById('full-fetch-indicator')?.remove();
  }
}

// ============================================================
// AI SUMMARY
// ============================================================
async function generateSummary(text) {
  if (window.FocusAuth && window.FocusAuth.getCurrentUser() === null) {
    window.FocusAuth.showLoginRequired();
    return;
  }
  const summaryEl = document.getElementById('article-summary');
  summaryEl.style.display = 'block';
  summaryEl.innerHTML = '<div class="summary-loading"><div class="spinner" style="width:14px;height:14px;border-width:1.5px;display:inline-block;"></div> AI 摘要生成中...</div>';

  try {
    const res = await fetch(GROQ_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.substring(0, 2000),
        mode: 'summary'
      })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // 嘗試解析 JSON，若失敗直接顯示文字
    let summaryHTML = '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      summaryHTML = `
        <div class="summary-points">
          ${(parsed.points || []).map(p => `<div class="summary-point">• ${p}</div>`).join('')}
        </div>
        ${parsed.keywords ? `<div class="summary-keywords">${parsed.keywords.map(k=>`<span class="summary-kw">${k}</span>`).join('')}</div>` : ''}
      `;
    } catch {
      summaryHTML = `<div class="summary-text">${raw}</div>`;
    }

    summaryEl.innerHTML = `
      <div class="summary-header">
        <span class="summary-label">📋 文章摘要</span>
      </div>
      ${summaryHTML}
    `;
  } catch(e) {
    summaryEl.style.display = 'none';
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

function toTitleCase(text) {
  // 小詞不大寫（介詞、冠詞、連接詞）
  const minor = new Set(['a','an','the','and','but','or','nor','for','so','yet','at','by','in','of','on','to','up','as','is','it']);
  return text.replace(/[^\n.!?]+[.!?\n]*/g, sentence => {
    return sentence.replace(/\b\w+/g, (word, offset) => {
      const lower = word.toLowerCase();
      if (offset === 0 || !minor.has(lower)) return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      return lower;
    });
  });
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
    const titleText = toTitleCase(text);
    el.innerHTML = titleText.split('\n\n').map(p => `<p>${p}</p>`).join('');
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
  if (window.FocusAuth && window.FocusAuth.getCurrentUser() === null) {
    window.FocusAuth.showLoginRequired();
    return;
  }
  const statusEl = document.getElementById('annotate-status');
  statusEl.style.display = 'flex';
  const text = getArticleText();

  try {
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
// SAVE WORD — 透過 Worker 儲存到 Supabase
// ============================================================
async function saveWord(btn, word, def_en, def_zh, example) {
  if (btn.classList.contains('saved')) return;
  btn.textContent = '儲存中...'; btn.disabled = true;

  try {
    const res = await fetch(VOC_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word,
        definition_en: def_en,
        definition_zh: def_zh,
        example_sentence: example,
        source_title: currentArticle?.title || '',
        source_url: currentArticle?.url || ''
      })
    });

    if (res.ok) {
      btn.textContent = '✓ 已加入';
      btn.classList.add('saved');
      showToast(`「${word}」已加入單字庫`);
    } else {
      throw new Error(res.status);
    }
  } catch(e) {
    btn.textContent = '+ 加入單字庫'; btn.disabled = false;
    showToast('儲存失敗，請稍後再試');
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