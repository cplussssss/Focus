const SUPABASE_URL = 'https://ujpwqxxriimtxsjconfk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqcHdxeHhyaWltdHhzamNvbmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NDM5NjIsImV4cCI6MjA5NjExOTk2Mn0.PW8o1O7-kTC_Nl1wN39sqMOwN2H_CNtEKORmEe_u-rA';
const ALLOWED_EMAIL = 'sijialai1473@gmail.com';

document.getElementById('yr').textContent = new Date().getFullYear();

function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-status').className = 'modal-status';
  document.getElementById('modal-status').textContent = '';
  document.getElementById('login-btn').disabled = false;
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

let supabase;
try {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Supabase 載入失敗，請確認網路連線或 CDN 是否可存取。', e);
}

document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

async function signInWithGoogle() {
  const btn = document.getElementById('login-btn');
  const status = document.getElementById('modal-status');

  if (!supabase) {
    status.className = 'modal-status error';
    status.textContent = '服務暫時無法連線，請重新整理頁面後再試。';
    return;
  }

  btn.disabled = true;
  status.className = 'modal-status loading';
  status.textContent = '正在跳轉到 Google 登入…';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname
    }
  });

  if (error) {
    btn.disabled = false;
    status.className = 'modal-status error';
    status.textContent = '登入失敗，請稍後再試。';
  }
}

if (supabase) supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    const email = session.user.email;

    if (email === ALLOWED_EMAIL) {
      window.location.href = './toeicprep/';
    } else {
      await supabase.auth.signOut();
      openModal();

      const status = document.getElementById('modal-status');
      const subtitle = document.getElementById('modal-subtitle');
      const btn = document.getElementById('login-btn');
      const note = document.getElementById('modal-note');

      subtitle.textContent = '這個工具目前是私人使用的備考網站。';
      status.className = 'modal-status error';
      status.textContent = '如果有需要，可以跟我聯繫並製作個人化的備考網站 ✉️';
      btn.disabled = false;
      note.innerHTML = '聯繫方式：<a href="mailto:sijialai1473@gmail.com">sijialai1473@gmail.com</a>';
    }
  }
});
