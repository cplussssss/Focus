'use strict';

(function () {
  var FIREBASE_CONFIG = {
    apiKey:            '__FIREBASE_API_KEY__',
    authDomain:        '__FIREBASE_AUTH_DOMAIN__',
    projectId:         '__FIREBASE_PROJECT_ID__',
    storageBucket:     '__FIREBASE_STORAGE_BUCKET__',
    messagingSenderId: '__FIREBASE_MESSAGING_SENDER_ID__',
    appId:             '__FIREBASE_APP_ID__',
};

  var _user = undefined; // undefined=初始化中, null=未登入, object=已登入
  var _listeners = [];
  var _db = null;

  function _notify(user) {
    _user = user;
    _listeners.slice().forEach(function (cb) { try { cb(user); } catch (e) {} });
  }

  function _initFirebase() {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    firebase.auth().onAuthStateChanged(function (fbUser) {
      if (fbUser) {
        _notify({
          email:   fbUser.email   || '',
          name:    fbUser.displayName || fbUser.email || '',
          picture: fbUser.photoURL || '',
          uid:     fbUser.uid,
        });
      } else {
        _notify(null);
      }
    });
  }

  function _init() {
    if (typeof firebase !== 'undefined') {
      _initFirebase();
    } else {
      // 動態載入 Firebase SDK（給未預載的子頁面用）
      var srcs = [
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
      ];
      var done = 0;
      srcs.forEach(function (src) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () { if (++done === srcs.length) _initFirebase(); };
        document.head.appendChild(s);
      });
    }
  }

  function _getCurrentUser() { return _user; }
  function _getFirestore()   { return _db; }

  function _onAuthChange(cb) {
    _listeners.push(cb);
    if (_user !== undefined) cb(_user);
  }

  function _signInWithGoogle() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    return firebase.auth().signInWithPopup(provider);
  }

  function _signOut() {
    return firebase.auth().signOut();
  }

  // ── 子頁面 <nav> 注入登入狀態徽章 ──
  function _injectNavAuth() {
    var nav = document.querySelector('nav');
    if (!nav || document.getElementById('focus-nav-auth')) return;

    if (!document.getElementById('focus-auth-nav-style')) {
      var s = document.createElement('style');
      s.id = 'focus-auth-nav-style';
      s.textContent = '\n' +
        '#focus-nav-auth {\n' +
        '  font-size: 0.78rem; font-weight: 500;\n' +
        '  color: var(--text2, #7a7570);\n' +
        '  padding: 0.25rem 0.65rem;\n' +
        '  border: 1px solid var(--border, #ddd9d0);\n' +
        '  border-radius: 99px; background: transparent;\n' +
        '  cursor: pointer; font-family: inherit;\n' +
        '  transition: color 0.15s, border-color 0.15s;\n' +
        '  white-space: nowrap;\n' +
        '}\n' +
        '#focus-nav-auth:hover { color: var(--accent, #b8871e); border-color: var(--accent, #b8871e); }\n' +
        '#focus-nav-auth.signed-in { color: var(--accent, #b8871e); border-color: currentColor; }\n';
      document.head.appendChild(s);
    }

    var badge = document.createElement('button');
    badge.id    = 'focus-nav-auth';
    badge.type  = 'button';
    badge.title = '使用 Google 登入';
    badge.textContent = '登入';
    badge.addEventListener('click', function () {
      if (_user) {
        _signOut().catch(function (e) { console.warn('signOut failed', e); });
      } else {
        _signInWithGoogle().catch(function (e) { console.warn('signIn failed', e); });
      }
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
        badge.title = '使用 Google 登入';
      }
    });
  }

  // ── 顯示「需要登入」Toast ──
  function _showLoginRequired() {
    var existing = document.getElementById('focus-auth-toast');
    if (existing) existing.remove();

    if (!document.getElementById('focus-auth-toast-style')) {
      var s = document.createElement('style');
      s.id = 'focus-auth-toast-style';
      s.textContent = '\n' +
        '#focus-auth-toast {\n' +
        '  position: fixed; bottom: 1.5rem; left: 50%;\n' +
        '  transform: translateX(-50%);\n' +
        '  background: #1a1917; color: #fff;\n' +
        '  border-radius: 10px; padding: 0.7rem 1.25rem;\n' +
        '  font-size: 0.88rem; z-index: 9999;\n' +
        '  display: flex; align-items: center; gap: 0.75rem;\n' +
        '  box-shadow: 0 4px 20px rgba(0,0,0,0.3);\n' +
        '  animation: fAuthIn 0.25s ease both;\n' +
        '  max-width: calc(100vw - 3rem);\n' +
        '}\n' +
        '#focus-auth-toast a {\n' +
        '  color: #d4a853; text-decoration: none; font-weight: 600; white-space: nowrap;\n' +
        '}\n' +
        '#focus-auth-toast a:hover { text-decoration: underline; }\n' +
        '@keyframes fAuthIn {\n' +
        '  from { opacity: 0; transform: translateX(-50%) translateY(8px); }\n' +
        '  to   { opacity: 1; transform: translateX(-50%) translateY(0); }\n' +
        '}\n';
      document.head.appendChild(s);
    }

    var toast = document.createElement('div');
    toast.id = 'focus-auth-toast';
    toast.innerHTML = 'AI 功能需要登入&nbsp;&nbsp;<a href="#" id="focus-auth-toast-link">立即登入 →</a>';
    document.body.appendChild(toast);
    document.getElementById('focus-auth-toast-link').addEventListener('click', function (e) {
      e.preventDefault();
      _signInWithGoogle().catch(function () {});
    });
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 4000);
  }

  window.FocusAuth = {
    getCurrentUser:    _getCurrentUser,
    getFirestore:      _getFirestore,
    onAuthChange:      _onAuthChange,
    signInWithGoogle:  _signInWithGoogle,
    signOut:           _signOut,
    injectNavAuth:     _injectNavAuth,
    showLoginRequired: _showLoginRequired,
  };

  document.addEventListener('DOMContentLoaded', function () {
    _init();
    _injectNavAuth();
  });
})();
