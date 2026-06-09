// ============================================================
// CONFIG
// ============================================================
const TTS_WORKER = 'https://focus.sijialai1473.workers.dev/tts';

const VOICES = {
  us: { voice: 'en-US-Wavenet-F', languageCode: 'en-US' },
  uk: { voice: 'en-GB-Wavenet-A', languageCode: 'en-GB' },
  au: { voice: 'en-AU-Wavenet-A', languageCode: 'en-AU' },
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
// EXTRA ARTICLES (for 14-article plans)
// ============================================================
const extraArticles = [
  {
    emoji: '🌿', category: 'daily', categoryLabel: 'Daily Life',
    title: 'A Walk in the Park',
    wordCount: 120,
    text: `Every Sunday afternoon, Tom takes a long walk in the park near his home. He leaves his phone on silent and simply enjoys the surroundings. The park has a small lake, several benches, and tall trees that provide shade even on warm days.\n\nHe usually brings a bottle of water and sometimes a book. If the weather is nice, he sits by the lake and reads for an hour before heading back. He finds that these quiet walks help him reset and feel less stressed after a busy week.\n\nTom believes that taking time away from screens is important. He often notices small things during his walks — a duck with her ducklings, the sound of wind through the leaves, or an elderly couple feeding birds. These simple moments remind him to slow down.`
  },
  {
    emoji: '🏢', category: 'toeic', categoryLabel: 'TOEIC',
    title: 'A Business Meeting',
    wordCount: 155,
    text: `The quarterly review meeting begins at nine o'clock sharp. All team leads are seated around the conference table, each with a printed agenda in front of them. The department head opens the meeting by reviewing last quarter's performance numbers.\n\nThe sales team reports a twelve percent increase in revenue, driven mainly by new contracts in the Asia Pacific region. However, the operations team notes that supply chain delays have affected delivery times and customer satisfaction scores.\n\nAfter the presentations, the floor is opened for discussion. Several managers suggest investing in automated inventory systems to reduce delays. Others recommend hiring additional customer service staff ahead of the peak season.\n\nThe meeting wraps up with a list of action items assigned to each team. Everyone agrees to submit their progress reports by the end of the following week. The department head thanks the group and reminds them that collaboration is key to achieving the annual target.`
  },
  {
    emoji: '🌐', category: 'tech', categoryLabel: 'Technology',
    title: 'The Internet of Things',
    wordCount: 165,
    text: `The Internet of Things, or IoT, refers to the growing network of physical devices connected to the internet. These devices range from smart home appliances and wearable fitness trackers to industrial sensors and self-driving vehicles. They collect and share data in real time, often without requiring any human input.\n\nIn the home, IoT devices can automate everyday tasks. A smart thermostat learns your schedule and adjusts the temperature accordingly. A connected refrigerator can track food inventory and even place orders when supplies run low. These conveniences are designed to save time and reduce energy consumption.\n\nDespite the benefits, IoT raises significant security concerns. Many devices are manufactured with minimal security features, making them easy targets for hackers. A compromised device can serve as an entry point into a home or corporate network.\n\nAs the number of connected devices continues to grow — projected to reach over 30 billion by 2030 — the need for stronger security standards and privacy regulations becomes increasingly urgent.`
  },
  {
    emoji: '📚', category: 'daily', categoryLabel: 'Daily Life',
    title: 'Learning a New Language',
    wordCount: 145,
    text: `Learning a new language is one of the most rewarding challenges a person can take on. It opens doors to new cultures, strengthens the brain, and creates opportunities that would otherwise be impossible.\n\nThe most effective learners combine multiple methods: formal study, conversation practice, and immersion through music, films, and podcasts. Simply memorizing vocabulary lists is rarely enough. The key is to use the language actively and regularly, even if you make mistakes.\n\nConsistency matters more than intensity. Studying for thirty minutes every day produces better results than cramming for hours once a week. Finding a conversation partner or joining a language exchange program can also accelerate progress significantly.\n\nMost learners experience a period of frustration before things begin to click. This phase is completely normal. The breakthrough moment — when you suddenly understand a sentence without consciously translating it — makes all the effort worthwhile.`
  },
  {
    emoji: '💡', category: 'toeic', categoryLabel: 'TOEIC',
    title: 'Presenting Ideas at Work',
    wordCount: 150,
    text: `Presenting an idea clearly and persuasively is a valuable skill in any workplace. Whether you are pitching a new project, proposing a process change, or sharing research findings, the ability to communicate well can make or break your chances of getting buy-in.\n\nStart by understanding your audience. A presentation for senior executives should focus on business impact and return on investment, while a technical team may want more detailed specifications. Tailoring your message shows that you respect the listener's time and perspective.\n\nKeep your structure simple: state the problem, offer your solution, and explain the expected outcome. Support your points with data or concrete examples. Avoid jargon unless you are certain your audience understands it.\n\nPractice your delivery out loud before the actual presentation. Confidence comes from preparation. If you stumble during the real thing, stay calm, take a breath, and carry on. Most audiences are far more forgiving than presenters expect.`
  },
  {
    emoji: '🚀', category: 'tech', categoryLabel: 'Technology',
    title: 'Space Exploration Today',
    wordCount: 170,
    text: `Space exploration has entered a new era, driven not just by national space agencies but also by private companies. Firms like SpaceX, Blue Origin, and Rocket Lab have dramatically lowered the cost of launching satellites and sending cargo into orbit. The rise of commercial spaceflight has opened opportunities that once seemed decades away.\n\nOne of the most ambitious goals of the current era is establishing a sustained human presence on the Moon and eventually Mars. NASA's Artemis program aims to return astronauts to the lunar surface and use it as a stepping stone for deeper space missions.\n\nBeyond exploration, space technology has direct benefits for life on Earth. GPS navigation, weather forecasting, and global internet connectivity all depend on satellites. As more countries and companies enter the space industry, questions about regulation, debris management, and the use of resources become increasingly important.\n\nThe next decade promises to be the most active period in the history of space exploration, with multiple missions targeting the Moon, Mars, and even the asteroid belt.`
  },
];

// Merged pool for week plans
const allArticles = [...articles, ...extraArticles];

// ============================================================
// WEEK PLAN
// ============================================================
const WEEK_STORAGE_KEY = 'speaking_week_plan';

function getWeekPlan() {
  try {
    const raw = localStorage.getItem(WEEK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveWeekPlan(plan) {
  localStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify(plan));
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function getOrCreateWeekPlan() {
  const thisMonday = getMondayOf(new Date());
  let plan = getWeekPlan();
  if (!plan || plan.monday !== thisMonday || plan.mode !== undefined) {
    plan = {
      monday: thisMonday,
      days: Array.from({length: 7}, () => ({ articleIndices: [], done: [] }))
    };
    saveWeekPlan(plan);
  }
  return plan;
}

function setTodayArticles(count) {
  const plan = getOrCreateWeekPlan();
  const todayIdx = getTodayDayIndex();
  const usedIndices = new Set(plan.days.flatMap(d => d.articleIndices));
  const available = allArticles.map((_, i) => i).filter(i => !usedIndices.has(i));
  const selected = [];
  while (selected.length < count && available.length > 0) {
    const rand = Math.floor(Math.random() * available.length);
    selected.push(available[rand]);
    available.splice(rand, 1);
  }
  plan.days[todayIdx] = { articleIndices: selected, done: [] };
  saveWeekPlan(plan);
  renderWeekPlan();
}

function resetTodayPlan() {
  const plan = getOrCreateWeekPlan();
  const todayIdx = getTodayDayIndex();
  plan.days[todayIdx] = { articleIndices: [], done: [] };
  saveWeekPlan(plan);
  renderWeekPlan();
}

function getTodayDayIndex() {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function getDayLabel(offset) {
  return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][offset];
}

function getArticleByPoolIdx(idx) {
  return allArticles[idx];
}

function renderWeekPlan() {
  const container = document.getElementById('week-plan-container');
  if (!container) return;

  const plan = getOrCreateWeekPlan();
  const todayIdx = getTodayDayIndex();
  const todayDay = plan.days[todayIdx];
  const hasTodayPlan = todayDay.articleIndices.length > 0;

  let html = `<div class="week-header">
    <span class="week-title">本週練習紀錄</span>
    ${hasTodayPlan ? `<button class="week-reset-btn" onclick="resetTodayPlan()">重設今日</button>` : ''}
  </div>
  <div class="week-days">`;

  plan.days.forEach((day, dIdx) => {
    const isToday = dIdx === todayIdx;
    const hasPlan = day.articleIndices.length > 0;
    const allDone = hasPlan && day.articleIndices.every(ai => day.done.includes(ai));

    html += `<div class="week-day ${isToday ? 'today' : ''} ${allDone ? 'day-done' : ''}">
      <div class="day-label">${getDayLabel(dIdx)}</div>
      <div class="day-articles">`;

    if (dIdx > todayIdx) {
      html += `<div class="day-rest">—</div>`;
    } else if (!hasPlan) {
      html += `<div class="day-rest">${isToday ? '?' : '—'}</div>`;
    } else {
      day.articleIndices.forEach(ai => {
        const a = getArticleByPoolIdx(ai);
        if (!a) return;
        const done = day.done.includes(ai);
        html += `<div class="day-article ${done ? 'done' : ''}" ${isToday ? `onclick="openDayArticle(${ai})"` : ''} title="${a.title}">
          <span class="day-emoji">${a.emoji}</span>
          ${done ? '<span class="day-check">✓</span>' : ''}
        </div>`;
      });
    }

    html += `</div></div>`;
  });

  html += `</div>`;

  if (!hasTodayPlan) {
    html += `<div class="week-setup">
      <p class="week-setup-desc">今日練習計畫</p>
      <div class="week-setup-btns">
        <button class="btn-plan" onclick="setTodayArticles(1)">📖 練 1 篇<span>輕鬆練習</span></button>
        <button class="btn-plan" onclick="setTodayArticles(2)">🔥 練 2 篇<span>加強練習</span></button>
      </div>
    </div>`;
  } else {
    html += `<div class="today-tasks"><div class="today-label">今日練習</div>`;
    todayDay.articleIndices.forEach(ai => {
      const a = getArticleByPoolIdx(ai);
      if (!a) return;
      const done = todayDay.done.includes(ai);
      html += `<div class="today-article ${done ? 'done' : ''}">
        <span class="today-emoji">${a.emoji}</span>
        <div class="today-info">
          <div class="today-title">${a.title}</div>
          <div class="today-meta">${a.wordCount} words · ${a.categoryLabel}</div>
        </div>
        <div class="today-actions">
          <button class="btn-today-practice" onclick="startPracticeAndMark(${ai}, ${todayIdx})">▶ 練習</button>
          ${!done ? `<button class="btn-today-done" onclick="markDone(${ai}, ${todayIdx})">✓ 完成</button>` : '<span class="done-badge">✓ 完成</span>'}
        </div>
      </div>`;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
}

function openDayArticle(ai) {
  const a = getArticleByPoolIdx(ai);
  if (!a) return;
  if (ai >= articles.length) {
    while (articles.length <= ai) articles.push(allArticles[articles.length]);
  }
  showArticle(ai);
}

function startPracticeAndMark(ai, dayIdx) {
  markDone(ai, dayIdx);
  openDayArticle(ai);
  setTimeout(() => startPractice(ai), 100);
}

function markDone(ai, dayIdx) {
  const plan = getWeekPlan();
  if (!plan) return;
  if (!plan.days[dayIdx].done.includes(ai)) {
    plan.days[dayIdx].done.push(ai);
    saveWeekPlan(plan);
    renderWeekPlan();
  }
}
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
  const a = allArticles[idx] || articles[idx];
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

// Populate article switcher (use allArticles)
const switcher = document.getElementById('article-switcher-sel');
allArticles.forEach((a, i) => {
  const opt = document.createElement('option');
  opt.value = i; opt.textContent = a.emoji + ' ' + a.title;
  switcher.appendChild(opt);
});

// Init week plan
renderWeekPlan();

// ============================================================
// PRACTICE — SCROLL
// ============================================================
function loadPracticeArticle(idx) {
  const a = allArticles[idx] || articles[idx];
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
// TTS — Google Cloud Text-to-Speech
// ============================================================
function stopAudio() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  ttsLoading = false;
  document.getElementById('wave-indicator').classList.add('hidden');
  document.getElementById('btn-listen').disabled = false;
  document.getElementById('btn-listen').textContent = '🔊 聆聽朗讀';
  const wp = document.getElementById('wave-prac');
  if (wp) wp.classList.add('hidden');
  const ttsBtn = document.getElementById('btn-tts-prac');
  if (ttsBtn) { ttsBtn.disabled = false; ttsBtn.textContent = '🔊 朗讀範例'; }
  const status = document.getElementById('tts-status-prac');
  if (status) status.textContent = '';
}

async function callTTS(text, accentKey, onLoading, onReady, onEnd) {
  if (window.FocusAuth && window.FocusAuth.getCurrentUser() === null) {
    window.FocusAuth.showLoginRequired();
    onEnd();
    return;
  }
  stopAudio();
  ttsLoading = true;
  const voiceConfig = VOICES[accentKey] || VOICES['us'];
  onLoading();
  try {
    const resp = await fetch(TTS_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: voiceConfig.voice,
        languageCode: voiceConfig.languageCode
      })
    });
    if (!resp.ok) { alert('TTS 錯誤：' + resp.status); ttsLoading = false; onEnd(); return; }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    ttsLoading = false;
    onReady();
    currentAudio.play();
    currentAudio.onended = () => { onEnd(); };
  } catch(e) { alert('TTS 失敗，請確認 Worker 設定'); ttsLoading = false; onEnd(); }
}

function toggleListenTTS() {
  const btn = document.getElementById('btn-listen');
  const wave = document.getElementById('wave-indicator');

  if (ttsLoading) return;

  if (currentAudio && !currentAudio.ended) {
    if (currentAudio.paused) {
      currentAudio.play();
      wave.classList.remove('hidden');
      btn.textContent = '⏸ 暫停';
    } else {
      currentAudio.pause();
      wave.classList.add('hidden');
      btn.textContent = '▶ 繼續';
    }
    return;
  }

  const accent = document.getElementById('det-accent').value;
  const text = (allArticles[currentArticleIdx] || articles[currentArticleIdx]).text;
  callTTS(text, accent,
    () => { btn.disabled = true; btn.textContent = '載入中...'; },
    () => { btn.disabled = false; wave.classList.remove('hidden'); btn.textContent = '⏸ 暫停'; },
    () => { wave.classList.add('hidden'); btn.textContent = '🔊 聆聽朗讀'; }
  );
}

function toggleListenTTSPractice() {
  const btn = document.getElementById('btn-tts-prac');
  const wave = document.getElementById('wave-prac');
  const status = document.getElementById('tts-status-prac');

  if (ttsLoading) return;

  if (currentAudio && !currentAudio.ended) {
    if (currentAudio.paused) {
      currentAudio.play();
      wave.classList.remove('hidden');
      btn.textContent = '⏸ 暫停';
      status.textContent = '';
    } else {
      currentAudio.pause();
      wave.classList.add('hidden');
      btn.textContent = '▶ 繼續';
      status.textContent = '已暫停';
    }
    return;
  }

  const accent = document.getElementById('prac-accent').value;
  const text = allArticles[currentArticleIdx]?.text || articles[currentArticleIdx]?.text || '';
  callTTS(text, accent,
    () => { btn.disabled = true; btn.textContent = '載入中...'; status.textContent = '載入中...'; },
    () => { btn.disabled = false; wave.classList.remove('hidden'); btn.textContent = '⏸ 暫停'; status.textContent = ''; },
    () => { wave.classList.add('hidden'); btn.textContent = '🔊 朗讀範例'; status.textContent = ''; }
  );
}

// ============================================================
// MIXED PRACTICE
// ============================================================
function startRandomPractice() {
  const idx = Math.floor(Math.random() * allArticles.length);
  // Ensure allArticles[idx] is accessible via articles array
  if (idx >= articles.length) {
    while (articles.length <= idx) articles.push(allArticles[articles.length]);
  }
  startPractice(idx);
}

function startTodayMixed() {
  const plan = getWeekPlan();
  if (!plan) { startRandomPractice(); return; }
  const todayIdx = getTodayDayIndex();
  const todayArts = plan.days[todayIdx]?.articleIndices || [];
  if (todayArts.length === 0) { startRandomPractice(); return; }
  const ai = todayArts[Math.floor(Math.random() * todayArts.length)];
  if (ai >= articles.length) {
    while (articles.length <= ai) articles.push(allArticles[articles.length]);
  }
  startPractice(ai);
}

loadPracticeArticle(0);