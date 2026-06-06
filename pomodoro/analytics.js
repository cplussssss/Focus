// =====================================================
// 番茄鐘 訪客追蹤 — 加到 index.html 的 <script> 最頂端
// =====================================================
(function () {
  // 初始化 session
  var sid = sessionStorage.getItem('an_session_id');
  if (!sid) {
    sid = 'sid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem('an_session_id', sid);
    localStorage.setItem('an_session_id', sid);
  }

  function ts() {
    var d = new Date(), p = function(n) { return String(n).padStart(2,'0'); };
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
  }

  // 追蹤事件（公開）
  window.trackEvent = function(action, detail) {
    try {
      var events = JSON.parse(localStorage.getItem('an_events') || '[]');
      events.push({ t: ts(), sid: sid, action: action, detail: detail || '' });
      if (events.length > 2000) events.splice(0, events.length - 2000);
      localStorage.setItem('an_events', JSON.stringify(events));
    } catch(e) {}
  };

  // 記錄 Firestore 延遲（公開）
  window.logPerf = function(type, op, ms, err) {
    try {
      var data = JSON.parse(localStorage.getItem('an_perf') || '[]');
      data.push({ t: ts(), type: type, op: op || '', ms: Math.round(ms), err: !!err });
      if (data.length > 500) data.splice(0, data.length - 500);
      localStorage.setItem('an_perf', JSON.stringify(data));
    } catch(e) {}
  };

  // 記錄 Web Vitals
  if ('PerformanceObserver' in window) {
    try {
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) {
          if (e.name === 'first-contentful-paint')
            localStorage.setItem('an_vital_fcp', Math.round(e.startTime));
        });
      }).observe({ type: 'paint', buffered: true });

      new PerformanceObserver(function(list) {
        var entries = list.getEntries();
        if (entries.length)
          localStorage.setItem('an_vital_lcp', Math.round(entries[entries.length-1].startTime));
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      var cls = 0;
      new PerformanceObserver(function(list) {
        list.getEntries().forEach(function(e) { if (!e.hadRecentInput) cls += e.value; });
        localStorage.setItem('an_vital_cls', cls.toFixed(4));
      }).observe({ type: 'layout-shift', buffered: true });
    } catch(e) {}
  }

  // 記錄進站
  window.trackEvent('page_enter',
    document.referrer
      ? 'ref:' + (function(){ try { return new URL(document.referrer).hostname; } catch(e){ return document.referrer; }})()
      : 'direct'
  );
})();

// =====================================================
// 使用範例 — 在各功能觸發點加上：
// =====================================================
//
// 番茄鐘開始：
//   trackEvent('timer_start', currentTask || '');
//
// 番茄鐘完成：
//   trackEvent('timer_done', 'round_' + pomodoroCount);
//
// 番茄鐘暫停：
//   trackEvent('timer_pause', '');
//
// 今日計畫新增任務：
//   trackEvent('task_add', taskTitle);
//
// 任務完成：
//   trackEvent('task_done', taskTitle);
//
// AI 回饋點擊：
//   trackEvent('ai_feedback_open', '');
//
// Google 登入：
//   trackEvent('login', 'google');
//
// 主題切換：
//   trackEvent('theme_toggle', newTheme);
//
// Firestore read（在 getDoc 前後包一層）：
//   var t0 = Date.now();
//   getDoc(ref).then(function(snap) {
//     logPerf('read', 'getDoc', Date.now() - t0, false);
//   }).catch(function(err) {
//     logPerf('read', 'getDoc', Date.now() - t0, true);
//   });
//
// Firestore write（setDoc/addDoc 同理）：
//   var t0 = Date.now();
//   setDoc(ref, data).then(function() {
//     logPerf('write', 'setDoc', Date.now() - t0, false);
//   }).catch(function(err) {
//     logPerf('write', 'setDoc', Date.now() - t0, true);
//   });