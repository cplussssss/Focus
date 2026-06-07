// ============================================================
// CONFIG
// ============================================================
const TTS_WORKER = 'https://toeic.sijialai1473.workers.dev/tts';

const VOICES = {
  us: 'EXAVITQu4vr4xnSDxMaL', // Sarah (American)
  uk: 'onwK4e9ZLuTAKqWW03F9', // Daniel (British)
  au: 'XB0fDUnXU5powFXDhCwa', // Charlotte (Australian)
};

const articles = [
  {
    emoji: '☕', category: 'daily', categoryLabel: 'Daily Life',
    title: 'Morning Coffee',
    wordCount: 110,
    text: `Every morning, Sarah wakes up at seven o'clock. The first thing she does is make a cup of coffee. She fills the kettle with water and puts it on the stove. While she waits, she opens the window to let in the fresh air.

She likes her coffee with just a little milk and no sugar. She sits by the window and takes her first sip. Outside, she can hear birds singing and cars passing by. The neighborhood is slowly waking up.

After finishing her coffee, Sarah feels ready for the day. She believes that a good morning routine helps her stay calm and focused. Small habits, she says, can make a big difference in life.`
  },
  {
    emoji: '🚂', category: 'daily', categoryLabel: 'Daily Life',
    title: 'Taking the Train',
    wordCount: 130,
    text: `Lisa commutes to work by train every weekday. The station is just a ten-minute walk from her apartment. She usually arrives a few minutes early and waits on the platform.

The train arrives at eight fifteen. She finds a seat near the window and puts in her earphones. During the thirty-minute ride, she listens to podcasts or reads articles on her phone.

When the train reaches downtown, she gets off and walks two blocks to her office. Most of her coworkers take buses or drive, but Lisa prefers the train. It is faster, cheaper, and she doesn't have to worry about parking. She has been using this route for three years and knows every stop by heart.`
  },
  {
    emoji: '💼', category: 'toeic', categoryLabel: 'TOEIC',
    title: 'A Job Interview',
    wordCount: 160,
    text: `David has a job interview this morning at a marketing company downtown. He woke up early, ironed his shirt, and reviewed his resume one more time. He wants to make a good first impression.

He arrives at the office five minutes before the scheduled time. The receptionist asks him to take a seat in the waiting area. A few minutes later, a woman in a dark blazer comes out and introduces herself as the hiring manager.

The interview lasts about forty minutes. She asks him about his previous work experience, his strengths, and how he handles challenges under pressure. David answers each question clearly and confidently.

At the end, she thanks him for coming in and says they will be in touch within the week. David shakes her hand, smiles, and heads toward the elevator feeling cautiously optimistic.`
  },
  {
    emoji: '📧', category: 'toeic', categoryLabel: 'TOEIC',
    title: 'Writing a Professional Email',
    wordCount: 150,
    text: `When writing a professional email, it is important to be clear and polite. Start with a proper greeting, such as "Dear Mr. Chen" or "Hello team." Avoid informal language like "Hey" unless you know the person well.

The subject line should be short and specific. Instead of writing "Question," try something like "Question about the project deadline." This helps the reader understand the purpose before opening the email.

Keep the body of the email focused. State your main point in the first or second sentence, then provide any necessary details. End with a polite closing such as "Best regards" or "Thank you for your time."

Before you send, always read the email once more to check for spelling mistakes. A well-written email shows that you respect the reader's time and take your work seriously.`
  },
  {
    emoji: '🤖', category: 'tech', categoryLabel: 'Technology',
    title: 'What Is Artificial Intelligence?',
    wordCount: 170,
    text: `Artificial intelligence, or AI, refers to computer systems that can perform tasks that normally require human intelligence. These tasks include recognizing speech, making decisions, translating languages, and identifying objects in images.

Modern AI systems learn from large amounts of data. The more data they process, the better they become at their tasks. This approach is called machine learning. A well-known example is the recommendation system used by streaming services, which suggests movies based on what you have watched before.

In recent years, AI has advanced rapidly. Tools like large language models can now write essays, answer questions, and even generate computer code. These developments are changing many industries, from healthcare to education to finance.

Despite its impressive capabilities, AI still has clear limitations. It can make mistakes, reflect biases present in its training data, and struggles with tasks that require common sense or emotional understanding. Researchers and engineers continue to work on making AI systems safer and more reliable.`
  },
  {
    emoji: '📱', category: 'tech', categoryLabel: 'Technology',
    title: 'Smartphones and Daily Life',
    wordCount: 175,
    text: `Smartphones have become one of the most important tools in modern life. People use them to communicate, navigate, shop, work, and entertain themselves — often all within the same hour.

The average person checks their phone dozens of times per day. Notifications from social media, messaging apps, and news services compete for our attention constantly. Some researchers are concerned that this level of connectivity is affecting our ability to focus for long periods of time.

On the other hand, smartphones have made many tasks much easier. You can translate a foreign menu in seconds, find directions in an unfamiliar city, or video call a friend on the other side of the world at no cost. For many people in developing countries, a smartphone is also their primary way of accessing the internet.

As these devices become more powerful, the line between smartphones and computers continues to blur. Today's phones have more processing power than the computers used to send astronauts to the moon.`
  },
  {
    emoji: '🔋', category: 'tech', categoryLabel: 'Technology',
    title: 'The Rise of Electric Vehicles',
    wordCount: 185,
    text: `Electric vehicles, commonly known as EVs, are becoming more popular around the world. Unlike traditional cars that run on gasoline, EVs are powered by rechargeable batteries and produce no direct emissions. Many governments are encouraging their citizens to switch to electric vehicles as part of efforts to reduce air pollution and slow down climate change.

One of the main concerns for potential EV buyers is charging. While charging at home overnight is convenient, finding a public charging station on a long trip can still be challenging in some areas. Automakers and governments are investing heavily in expanding charging infrastructure to address this problem.

Battery technology is also improving quickly. Early electric vehicles could only travel about 150 kilometers on a single charge. Today, many models can travel over 500 kilometers, making them practical for longer journeys.

The cost of electric vehicles has been falling steadily. As battery production scales up and competition increases, analysts expect EVs to reach the same price point as gasoline cars within the next few years.`
  },
  {
    emoji: '☁️', category: 'tech', categoryLabel: 'Technology',
    title: 'Understanding Cloud Computing',
    wordCount: 185,
    text: `Cloud computing allows individuals and businesses to store and access data and software over the internet, rather than on a local computer or physical server. When you save a photo to an online service or edit a document through a web browser, you are using the cloud.

The main advantage of cloud computing is flexibility. Companies no longer need to buy and maintain expensive hardware. Instead, they can rent computing resources from large providers and scale up or down based on their needs. This model has lowered the barrier to entry for startups and small businesses.

Security is one of the biggest concerns in cloud computing. Storing sensitive data on servers managed by third parties raises questions about privacy and vulnerability to cyberattacks. Major cloud providers invest billions of dollars each year to protect their systems, but no network is completely immune to threats.

Today, cloud computing powers much of the digital world. Social media platforms, streaming services, online banking, and remote work tools all depend on cloud infrastructure to operate at a global scale.`
  },
];

// ============================================================
// STATE
// ============================================================
let currentArticleIdx = 0;
let currentCat = 'all';
let raf = null, currentY = 0, maxScroll = 0, lastTs = null, scrollRunning = false, scrollDone = false;
let currentAudio = null;
const speedMap = { 1: 8, 2: 14, 3: 24, 4: 36, 5: 50 };
const stageH = 340;

// ============================================================
// NAVIGATION
// ============================================================
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

function showList() { showView('view-list'); }

function showArticle(idx) {
  currentArticleIdx = idx;
  const a = articles[idx];
  document.getElementById('det-cat').textContent = a.categoryLabel;
  document.getElementById('det-title').textContent = a.emoji + ' ' + a.title;
  document.getElementById('det-meta').textContent = a.wordCount + ' words · ' + a.categoryLabel;
  const bodyEl = document.getElementById('det-body');
  bodyEl.innerHTML = a.text.split('\n\n').map(p => `<p>${p}</p>`).join('');
  stopAudio();
  showView('view-article');
}

function startPractice(idx) {
  currentArticleIdx = idx;
  loadPracticeArticle(idx);
  showView('view-practice');
}

function switchArticle(idx) {
  currentArticleIdx = +idx;
  loadPracticeArticle(+idx);
}

// ============================================================
// LIST VIEW
// ============================================================
function renderList(cat) {
  currentCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  const filtered = cat === 'all' ? articles : articles.filter(a => a.category === cat);
  const grid = document.getElementById('article-grid');
  grid.innerHTML = filtered.map((a, i) => {
    const realIdx = articles.indexOf(a);
    return `<div class="article-card" onclick="showArticle(${realIdx})">
      <div class="card-emoji">${a.emoji}</div>
      <div class="card-category">${a.categoryLabel}</div>
      <div class="card-title">${a.title}</div>
      <div class="card-preview">${a.text.replace(/\n\n/g,' ')}</div>
      <div class="card-meta">
        <span>${a.wordCount} words</span>
        <span>▶ 練習</span>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('cat-tabs').addEventListener('click', e => {
  if (e.target.classList.contains('cat-tab')) renderList(e.target.dataset.cat);
});

renderList('all');

// Populate article switcher
const switcher = document.getElementById('article-switcher-sel');
articles.forEach((a, i) => {
  const opt = document.createElement('option');
  opt.value = i; opt.textContent = a.emoji + ' ' + a.title;
  switcher.appendChild(opt);
});

// ============================================================
// PRACTICE — SCROLL
// ============================================================
function loadPracticeArticle(idx) {
  const a = articles[idx];
  document.querySelector('.practice-title') && (document.querySelector('.practice-title').textContent = a.title);
  const scroller = document.getElementById('scroller');
  scroller.innerHTML = '<p>' + a.text.split('\n\n').join('</p><p style="margin-top:1.2em">') + '</p>';
  document.getElementById('article-switcher-sel').value = idx;
  resetScroll();
}

function applyPadding() {
  const s = document.getElementById('scroller');
  s.style.paddingTop = stageH * 0.4 + 'px';
  s.style.paddingBottom = stageH * 0.6 + 'px';
}

function computeMax() {
  const s = document.getElementById('scroller');
  return Math.max(0, s.scrollHeight - stageH);
}

function resetScroll() {
  cancelAnimationFrame(raf);
  scrollRunning = false; scrollDone = false; lastTs = null; currentY = 0;
  applyPadding();
  document.getElementById('scroller').style.transform = 'translateY(0)';
  document.getElementById('overlay').style.display = 'flex';
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-start').textContent = '開始';
  document.getElementById('btn-pause').disabled = true;
  document.getElementById('btn-pause').textContent = '暫停';
  document.getElementById('prog').style.width = '0%';
  document.getElementById('stat-time').textContent = '—';
  document.getElementById('stat-pct').textContent = '0%';
  document.getElementById('scroll-badge').className = 'badge';
  document.getElementById('scroll-badge').textContent = '等待中';
}

function startScroll() {
  if (scrollDone) { loadPracticeArticle(currentArticleIdx); return; }
  applyPadding();
  maxScroll = computeMax();
  document.getElementById('overlay').style.display = 'none';
  scrollRunning = true; lastTs = null;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  document.getElementById('scroll-badge').textContent = '進行中';
  raf = requestAnimationFrame(tick);
}

function pauseScroll() {
  const btn = document.getElementById('btn-pause');
  const badge = document.getElementById('scroll-badge');
  if (!scrollRunning) {
    scrollRunning = true; lastTs = null;
    btn.textContent = '暫停'; badge.textContent = '進行中';
    raf = requestAnimationFrame(tick);
  } else {
    scrollRunning = false; cancelAnimationFrame(raf);
    btn.textContent = '繼續'; badge.textContent = '暫停中';
  }
}

function tick(ts) {
  if (!scrollRunning) return;
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000; lastTs = ts;
  currentY = Math.min(currentY + speedMap[+document.getElementById('speed').value] * dt, maxScroll);
  document.getElementById('scroller').style.transform = 'translateY(-' + currentY.toFixed(1) + 'px)';
  const pct = maxScroll > 0 ? currentY / maxScroll : 0;
  document.getElementById('prog').style.width = Math.round(pct * 100) + '%';
  document.getElementById('stat-pct').textContent = Math.round(pct * 100) + '%';
  const spd = speedMap[+document.getElementById('speed').value];
  const secsLeft = maxScroll > 0 ? Math.round((maxScroll - currentY) / spd) : 0;
  document.getElementById('stat-time').textContent = secsLeft > 0 ? '剩餘約 ' + secsLeft + ' 秒' : '即將結束';
  if (currentY >= maxScroll) {
    scrollDone = true; scrollRunning = false;
    document.getElementById('prog').style.width = '100%';
    document.getElementById('stat-pct').textContent = '100%';
    document.getElementById('stat-time').textContent = '完成';
    document.getElementById('scroll-badge').className = 'badge done';
    document.getElementById('scroll-badge').textContent = '完成';
    document.getElementById('btn-pause').disabled = true;
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-start').textContent = '再練一次';
    return;
  }
  raf = requestAnimationFrame(tick);
}

// ============================================================
// TTS — ElevenLabs
// ============================================================
function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  document.getElementById('wave-indicator').classList.add('hidden');
  document.getElementById('btn-listen').disabled = false;
  document.getElementById('btn-listen').textContent = '🔊 聆聽朗讀';
  const wp = document.getElementById('wave-prac');
  if (wp) wp.classList.add('hidden');
  const ttsBtn = document.getElementById('btn-tts-prac');
  if (ttsBtn) { ttsBtn.disabled = false; ttsBtn.textContent = '🔊 朗讀範例'; }
}

async function callTTS(text, accentKey, onStart, onEnd) {
  stopAudio();
  const voiceId = VOICES[accentKey];
  onStart();
  try {
    const resp = await fetch(TTS_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId })
    });
    if (!resp.ok) { alert('TTS 錯誤：' + resp.status); onEnd(); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.play();
    currentAudio.onended = () => { onEnd(); };
  } catch(e) { alert('TTS 失敗，請確認 Worker 設定'); onEnd(); }
}

function listenTTS() {
  const accent = document.getElementById('det-accent').value;
  const text = articles[currentArticleIdx].text;
  const wave = document.getElementById('wave-indicator');
  const btn = document.getElementById('btn-listen');
  callTTS(text, accent,
    () => { wave.classList.remove('hidden'); btn.disabled = true; btn.textContent = '播放中...'; },
    () => { wave.classList.add('hidden'); btn.disabled = false; btn.textContent = '🔊 聆聽朗讀'; }
  );
}

function listenTTSPractice() {
  const accent = document.getElementById('prac-accent').value;
  const text = articles[currentArticleIdx].text;
  const wave = document.getElementById('wave-prac');
  const btn = document.getElementById('btn-tts-prac');
  const status = document.getElementById('tts-status-prac');
  callTTS(text, accent,
    () => { wave.classList.remove('hidden'); btn.disabled = true; btn.textContent = '播放中...'; status.textContent = '載入中...'; },
    () => { wave.classList.add('hidden'); btn.disabled = false; btn.textContent = '🔊 朗讀範例'; status.textContent = ''; }
  );
}

loadPracticeArticle(0);