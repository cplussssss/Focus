'use strict';

(function () {
  const WORKER   = 'https://focus.sijialai1473.workers.dev';
  const TOKEN_KEY = 'focus_jwt';

  let _user = undefined; // undefined=初始化中, null=未登入, object=已登入
  const _listeners = [];

  function _notify(user) {
    _user = user;
    _listeners.slice().forEach(function (cb) { try { cb(user); } catch (e) {} });
  }

  // 解析 JWT payload（只看 exp，簽名由 Worker 驗）
  function _parseJWT(token) {
    try {
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      if (payload.exp && Date.now() / 1000 > payload.exp) return null;
      return payload;
    } catch { return null; }
  }

  function _init() {
    const params = new URLSearchParams(window.location.search);
    const urlToken   = params.get('token');
    const authError  = params.get('auth_error');

    // 清掉 URL 上的暫時參數
    if (urlToken || authError) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('token');
      clean.searchParams.delete('auth_error');
      window.history.replaceState({}, '', clean.toString());
    }

    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
    }

    if (authError) {
      // 延遲顯示，讓頁面先渲染完
      setTimeout(function () { _showLoginError(authError); }, 300);
    }

    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) { _notify(null); return; }

    const payload = _parseJWT(stored);
    if (!payload) {
      localStorage.removeItem(TOKEN_KEY);
      _notify(null);
    } else {
      _notify({
        email:   payload.email   || '',
        name:    payload.name    || payload.email || '',
        picture: payload.picture || '',
      });
    }
  }

  function _showLoginError(code) {
    const msgs = {
      no_code:        '登入被取消',
      token_exchange: '無法取得授權，請重試',
      no_email:       '無法取得 Google 帳號資訊',
      server_error:   '伺服器錯誤，請稍後重試',
    };
    const msg = msgs[code] || '登入失敗，請重試';
    // 用 toast 系統顯示（確保 style 已注入）
    if (!document.getElementById('focus-auth-toast-style')) {
      const s = document.createElement('style');
      s.id = 'focus-auth-toast-style';
      s.textContent = `
        #focus-auth-toast {
          position: fixed; bottom: 1.5rem; left: 50%;
          transform: translateX(-50%);
          background: #1a1917; color: #fff;
          border-radius: 10px; padding: 0.7rem 1.25rem;
          font-size: 0.88rem; z-index: 9999;
          display: flex; align-items: center; gap: 0.75rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          animation: fAuthIn 0.25s ease both;
          max-width: calc(100vw - 3rem);
        }
        #focus-auth-toast a {
          color: #d4a853; text-decoration: none; font-weight: 600; white-space: nowrap;
        }
        #focus-auth-toast a:hover { text-decoration: underline; }
        @keyframes fAuthIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(s);
    }
    const toast = document.createElement('div');
    toast.id = 'focus-auth-toast';
    toast.textContent = '⚠️ ' + msg;
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 4000);
  }

  function _getCurrentUser() { return _user; }
  function _getToken()       { return localStorage.getItem(TOKEN_KEY); }

  function _onAuthChange(cb) {
    _listeners.push(cb);
    if (_user !== undefined) cb(_user);
  }

  function _signInWithGoogle() {
    const back = encodeURIComponent(window.location.href.split('?')[0]);
    window.location.href = WORKER + '/auth/login?redirect=' + back;
  }

  function _signOut() {
    localStorage.removeItem(TOKEN_KEY);
    _notify(null);
  }

  // ── 子頁面 <nav> 注入登入狀態徽章 ──
  function _injectNavAuth() {
    const nav = document.querySelector('nav');
    if (!nav || document.getElementById('focus-nav-auth')) return;

    if (!document.getElementById('focus-auth-nav-style')) {
      const s = document.createElement('style');
      s.id = 'focus-auth-nav-style';
      s.textContent = `
        #focus-nav-auth {
          font-size: 0.78rem; font-weight: 500;
          color: var(--text2, #7a7570);
          padding: 0.25rem 0.65rem;
          border: 1px solid var(--border, #ddd9d0);
          border-radius: 99px; background: transparent;
          cursor: pointer; font-family: inherit;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        #focus-nav-auth:hover { color: var(--accent, #b8871e); border-color: var(--accent, #b8871e); }
        #focus-nav-auth.signed-in { color: var(--accent, #b8871e); border-color: currentColor; }
      `;
      document.head.appendChild(s);
    }

    const badge = document.createElement('button');
    badge.id    = 'focus-nav-auth';
    badge.type  = 'button';
    badge.title = '前往首頁登入';
    badge.textContent = '登入';
    badge.addEventListener('click', function () {
      window.location.href = 'https://cplussssss.github.io/Focus/';
    });
    nav.appendChild(badge);

    _onAuthChange(function (user) {
      if (user) {
        badge.textContent = user.name.split(' ')[0];
        badge.classList.add('signed-in');
        badge.title = user.email;
      } else {
        badge.textContent = '登入';
        badge.classList.remove('signed-in');
        badge.title = '前往首頁登入';
      }
    });
  }

  // ── 顯示「需要登入」Toast ──
  function _showLoginRequired() {
    const existing = document.getElementById('focus-auth-toast');
    if (existing) existing.remove();

    if (!document.getElementById('focus-auth-toast-style')) {
      const s = document.createElement('style');
      s.id = 'focus-auth-toast-style';
      s.textContent = `
        #focus-auth-toast {
          position: fixed; bottom: 1.5rem; left: 50%;
          transform: translateX(-50%);
          background: #1a1917; color: #fff;
          border-radius: 10px; padding: 0.7rem 1.25rem;
          font-size: 0.88rem; z-index: 9999;
          display: flex; align-items: center; gap: 0.75rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          animation: fAuthIn 0.25s ease both;
          max-width: calc(100vw - 3rem);
        }
        #focus-auth-toast a {
          color: #d4a853; text-decoration: none; font-weight: 600; white-space: nowrap;
        }
        #focus-auth-toast a:hover { text-decoration: underline; }
        @keyframes fAuthIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(s);
    }

    const toast = document.createElement('div');
    toast.id = 'focus-auth-toast';
    toast.innerHTML = 'AI 功能需要登入&nbsp;&nbsp;<a href="https://cplussssss.github.io/Focus/" target="_blank">前往登入 →</a>';
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 4000);
  }

  window.FocusAuth = {
    init:             _init,
    getCurrentUser:   _getCurrentUser,
    getToken:         _getToken,
    onAuthChange:     _onAuthChange,
    signInWithGoogle: _signInWithGoogle,
    signOut:          _signOut,
    injectNavAuth:    _injectNavAuth,
    showLoginRequired: _showLoginRequired,
  };

  document.addEventListener('DOMContentLoaded', function () {
    _init();
    _injectNavAuth();
  });
})();
