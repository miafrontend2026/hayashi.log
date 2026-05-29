// ========================================================================
// tool-quota.js — Freemium 工具額度限制(按「實際使用」計數版本)
//
// 設計改版 (2026-05-29):
//   - 改成按 ACTION 計數(每答 1 張卡 / 念 1 句 / 答 1 題 = +1),不是 session
//   - 額度收緊讓用戶嚐到甜頭就被擋 → 引導付費
//   - 關掉重開不會 reset(localStorage 跟日期綁定,午夜 reset)
//
// 設計原則:
//   1. **不影響線上使用者** — 只對白名單 owner email 啟動 gating
//   2. 訂閱中 = unlimited
//   3. 免費版 SRS/快速背單字 共享 3 卡/天,跟讀 3 句/天,動詞 3 題/天,模考 1 套/等級 lifetime
//
// 等正式金流 ready + 想開放給所有 user 時,把 isOwner() 邏輯改成
// 「登入 user 且 not premium」即可。
// ========================================================================

(function() {
  const QUOTA_WHITELIST = new Set([
    'abc83327@gmail.com',
    'stayjpplan@gmail.com',
  ]);

  // 額度設定
  const LIMITS = {
    vocab:        3,   // SRS + 快速背單字 共用(每張答完算 1)
    shadow:       3,   // 跟讀(每句念完算 1)
    conjugate:    3,   // 動詞變化練習(每題答完算 1)
    quiz:         3,   // 文法 / 單字測驗(每次 start 算 1 session)
    reading:      1,   // 讀解練習(每天 1 篇)
    listening:    1,   // 聽力練習 + 收藏聽力測驗(共用,每天 1 題)
    daily_story:  1,   // 今日故事(每天 1 次預覽)
    audio_play:  10,   // 單字 / 例句語音點擊(每次喇叭 +1)
  };

  function dateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadCount() {
    try { return JSON.parse(localStorage.getItem('tool_usage_' + dateKey())) || {}; } catch (e) { return {}; }
  }
  function saveCount(d) {
    try { localStorage.setItem('tool_usage_' + dateKey(), JSON.stringify(d)); } catch (e) {}
  }

  // 訂閱快取 — 由 Firestore listener 更新
  let cachedSub = null;
  let cachedUserEmail = null;
  let authReady = false;

  function isPremium() {
    if (!cachedSub) return false;
    if (cachedSub.status !== 'active' && cachedSub.status !== 'trialing') return false;
    return (cachedSub.expiresAt || 0) > Date.now();
  }

  function shouldGate() {
    if (!authReady) return false;
    if (!cachedUserEmail) return false;
    if (!QUOTA_WHITELIST.has(cachedUserEmail)) return false;
    if (isPremium()) return false;
    return true;
  }

  function canUse(tool) {
    if (!shouldGate()) return true;
    if (tool.startsWith('mock_exam_')) {
      return localStorage.getItem('mock_completed_' + tool.replace('mock_exam_', '')) !== '1';
    }
    const limit = LIMITS[tool];
    if (!limit) return true; // 未知工具不擋
    return (loadCount()[tool] || 0) < limit;
  }

  function consume(tool) {
    if (!shouldGate()) return;
    if (tool.startsWith('mock_exam_')) return; // 模考另外標記
    const counts = loadCount();
    counts[tool] = (counts[tool] || 0) + 1;
    saveCount(counts);
    refreshBadge();
  }

  function used(tool) {
    if (tool.startsWith('mock_exam_')) {
      return localStorage.getItem('mock_completed_' + tool.replace('mock_exam_', '')) === '1' ? 1 : 0;
    }
    return loadCount()[tool] || 0;
  }

  function showPaywall(tool) {
    const labels = {
      vocab: '單字背誦(SRS / 快速背單字)',
      shadow: '跟讀練習',
      conjugate: '動詞變化練習',
      quiz: '測驗',
      reading: '讀解練習',
      listening: '聽力練習',
      daily_story: '今日故事',
      audio_play: '單字語音',
    };
    const label = tool.startsWith('mock_exam_')
      ? `${tool.replace('mock_exam_', '').toUpperCase()} 模擬考`
      : (labels[tool] || tool);
    const msg = tool.startsWith('mock_exam_')
      ? '免費版每等級只能試 1 套模考,你已經完成過了。\n升級 Premium 可無限做模考 + 詳解 + 錯題回顧。'
      : `免費版每天 ${LIMITS[tool]} 次,你用完了。\n升級 Premium 無限次使用,還能跨裝置同步。`;
    if (confirm(`🚫 ${label} 免費額度用完\n\n${msg}\n\n要看訂閱方案嗎?`)) {
      window.location.href = 'pricing.html';
    }
  }

  // ── UI badge ──
  function refreshBadge() {
    let badge = document.getElementById('quotaBadge');
    if (!shouldGate()) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'quotaBadge';
      badge.style.cssText = 'position:fixed;bottom:14px;left:14px;background:rgba(0,0,0,.78);color:#fff;padding:8px 12px;border-radius:10px;font-size:11px;font-family:-apple-system,sans-serif;line-height:1.5;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer;max-width:200px';
      badge.title = '免費版 quota 顯示(只 owner 看得到)。點擊看訂閱狀態。';
      badge.onclick = () => window.location.href = 'account.html';
      document.body.appendChild(badge);
    }
    const c = loadCount();
    const tag = isPremium() ? '✅ Premium' : '🆓 免費版';
    function row(label, key) {
      const used = c[key] || 0;
      const limit = LIMITS[key];
      const color = used >= limit ? '#EF4444' : (used >= limit - 1 ? '#F59E0B' : '#fff');
      return `<div style="color:${color}">${label}: ${used}/${limit}</div>`;
    }
    badge.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${tag} · 今日額度</div>
      ${row('單字', 'vocab')}
      ${row('跟讀', 'shadow')}
      ${row('動詞', 'conjugate')}
      ${row('測驗', 'quiz')}
      ${row('讀解', 'reading')}
      ${row('聽力', 'listening')}
      ${row('故事', 'daily_story')}
      ${row('語音', 'audio_play')}
    `;
  }

  // ── Firestore 訂閱監聽 ──
  function watchSubscription() {
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    firebase.auth().onAuthStateChanged(user => {
      authReady = true;
      if (!user) { cachedUserEmail = null; cachedSub = null; refreshBadge(); return; }
      cachedUserEmail = user.email || null;
      if (!QUOTA_WHITELIST.has(cachedUserEmail || '')) { refreshBadge(); return; }
      firebase.firestore().doc('users/' + user.uid).onSnapshot(snap => {
        cachedSub = snap.data()?.subscription || null;
        refreshBadge();
        applyGating();
      }, err => console.warn('[ToolQuota] sub watch error:', err));
    });
  }

  // ── 包 wrapper ──
  const wrapped = new Set();

  function wrapStart(obj, method, toolName) {
    // start 只做 pre-check(看開不開得了),不 consume
    if (!obj || typeof obj[method] !== 'function') return;
    const key = method + '@start@' + toolName;
    if (wrapped.has(key)) return;
    const orig = obj[method];
    obj[method] = function(...args) {
      if (!canUse(toolName)) { showPaywall(toolName); return; }
      return orig.apply(this, args);
    };
    wrapped.add(key);
  }

  function wrapAction(obj, method, toolName) {
    // action 每次呼叫 +1,超過就擋
    if (!obj || typeof obj[method] !== 'function') return;
    const key = method + '@action@' + toolName;
    if (wrapped.has(key)) return;
    const orig = obj[method];
    obj[method] = function(...args) {
      if (!canUse(toolName)) { showPaywall(toolName); return; }
      consume(toolName);
      return orig.apply(this, args);
    };
    wrapped.add(key);
  }

  // 重要:模組宣告用 `const FlashCard = ...` 不會掛 window.FlashCard,
  // 但 inline onclick="FlashCard.start()" 走 global scope chain 還是讀得到。
  // 我們用 eval 把那個 binding 抓出來(是物件 reference,改它的 method 就會影響 inline 呼叫)。
  function getGlobal(name) {
    try { return (0, eval)(name); } catch (e) { return undefined; }
  }

  function applyGating() {
    // ── SRS / 快速背單字 共用 vocab bucket ──
    const SRS_ = getGlobal('SRS');
    if (SRS_) {
      wrapStart(SRS_, 'start', 'vocab');
      wrapAction(SRS_, 'rate', 'vocab');
      wrapAction(SRS_, 'recordGrade', 'vocab');
    }
    const FlashCard_ = getGlobal('FlashCard');
    if (FlashCard_) {
      wrapStart(FlashCard_, 'start', 'vocab');
      wrapStart(FlashCard_, 'beginToday', 'vocab');
      wrapAction(FlashCard_, 'answer', 'vocab');
    }

    // ── 跟讀 ──
    const Shadow_ = getGlobal('Shadow');
    if (Shadow_) {
      wrapStart(Shadow_, 'start', 'shadow');
      wrapStart(Shadow_, 'startCurrent', 'shadow');
      wrapStart(Shadow_, 'startFavs', 'shadow');
      // playOnce 由 index.html 內注入呼叫 consumeShadowOrBlock
    }

    // ── 動詞變化練習 ──
    const GrammarDrill_ = getGlobal('GrammarDrill');
    if (GrammarDrill_) {
      wrapStart(GrammarDrill_, 'start', 'conjugate');
      wrapAction(GrammarDrill_, 'rate', 'conjugate');
      wrapAction(GrammarDrill_, 'answerQuiz', 'conjugate');
    }

    // ── 測驗 Quiz ──
    const Quiz_ = getGlobal('Quiz');
    if (Quiz_) wrapStart(Quiz_, 'start', 'quiz');

    // ── 讀解練習 ──
    const Reading_ = getGlobal('Reading');
    if (Reading_) wrapStart(Reading_, 'start', 'reading');

    // ── 聽力 + 收藏聽力測驗 ──
    const Listening_ = getGlobal('Listening');
    if (Listening_) wrapStart(Listening_, 'start', 'listening');
    const Stats_ = getGlobal('Stats');
    if (Stats_ && typeof Stats_.quizFavListening === 'function') {
      wrapStart(Stats_, 'quizFavListening', 'listening');
    }

    // ── 今日故事 ──
    const DailyStory_ = getGlobal('DailyStory');
    if (DailyStory_) wrapStart(DailyStory_, 'open', 'daily_story');

    // ── 單字 / 例句語音 ──
    // `function speak(...)` 是 function declaration,既在 global scope 也在 window 上。
    // HTML inline onclick="speak(...)" 透過 window 解析 → 覆蓋 window.speak 就會生效。
    // 模組內部呼叫 speak() 走 global binding(沒被覆寫)→ 不計數,正合我意:工具內的音不額外算。
    if (typeof window.speak === 'function' && !wrapped.has('window.speak')) {
      const origSpeak = window.speak;
      window.speak = function() {
        if (!canUse('audio_play')) { showPaywall('audio_play'); return; }
        consume('audio_play');
        return origSpeak.apply(this, arguments);
      };
      wrapped.add('window.speak');
    }

    // ── 模考 ──
    const MockExam_ = getGlobal('MockExam');
    if (MockExam_ && MockExam_.startSection) {
      const key = 'MockExam.startSection';
      if (!wrapped.has(key)) {
        const orig = MockExam_.startSection;
        MockExam_.startSection = function(...args) {
          const lv = (MockExam_.currentLevel || args[0] || 'n5').toLowerCase();
          if (!canUse('mock_exam_' + lv)) { showPaywall('mock_exam_' + lv); return; }
          return orig.apply(this, args);
        };
        wrapped.add(key);
      }
    }
  }

  function markMockCompleted(level) {
    if (!shouldGate()) return;
    localStorage.setItem('mock_completed_' + level.toLowerCase(), '1');
    refreshBadge();
  }

  // ── Shadow 跟讀 per-sentence 計數(由 index.html 內的 playOnce 主動呼)──
  function consumeShadowOrBlock() {
    // 給 Shadow.playOnce 在每句開始播之前呼;若回 false 表示已超額,Shadow 應停止
    if (!canUse('shadow')) { showPaywall('shadow'); return false; }
    consume('shadow');
    return true;
  }

  window.ToolQuota = {
    canUse, consume, used, showPaywall,
    shouldGate, isPremium,
    markMockCompleted,
    consumeShadowOrBlock,
    refreshBadge,
    _resetToday: () => { localStorage.removeItem('tool_usage_' + dateKey()); refreshBadge(); },
    _resetMock: () => {
      ['n5','n4','n3','n2','n1'].forEach(lv => localStorage.removeItem('mock_completed_' + lv));
      refreshBadge();
    },
  };

  function init() {
    watchSubscription();
    setTimeout(applyGating, 100);
    setTimeout(applyGating, 1000);
    setTimeout(refreshBadge, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
