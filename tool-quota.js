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
    vocab:     3,   // SRS + 快速背單字 共用(每張答完算 1)
    shadow:    3,   // 跟讀(每句念完算 1)
    conjugate: 3,   // 動詞變化練習(每題答完算 1)
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
    badge.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${tag} · 今日額度</div>
      <div>單字: ${(c.vocab || 0)}/${LIMITS.vocab} · 跟讀: ${(c.shadow || 0)}/${LIMITS.shadow}</div>
      <div>動詞: ${(c.conjugate || 0)}/${LIMITS.conjugate}</div>
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

  function applyGating() {
    // ── SRS / 快速背單字 共用 vocab bucket ──
    if (typeof window.SRS !== 'undefined') {
      wrapStart(window.SRS, 'start', 'vocab');
      wrapAction(window.SRS, 'rate', 'vocab');     // 每張答完計 1
      wrapAction(window.SRS, 'recordGrade', 'vocab');
    }
    if (typeof window.FlashCard !== 'undefined') {
      wrapStart(window.FlashCard, 'start', 'vocab');
      wrapStart(window.FlashCard, 'beginToday', 'vocab');
      wrapAction(window.FlashCard, 'answer', 'vocab');  // 每張答完計 1
    }

    // ── 跟讀 ──
    if (typeof window.Shadow !== 'undefined') {
      wrapStart(window.Shadow, 'start', 'shadow');
      wrapStart(window.Shadow, 'startCurrent', 'shadow');
      wrapStart(window.Shadow, 'startFavs', 'shadow');
      // playOnce / step 不在 export 內,改在 index.html 內 playOnce 直接呼 ToolQuota.consume
    }

    // ── 動詞變化練習 ──
    if (typeof window.GrammarDrill !== 'undefined') {
      wrapStart(window.GrammarDrill, 'start', 'conjugate');
      wrapAction(window.GrammarDrill, 'rate', 'conjugate');       // SRS-style drill
      wrapAction(window.GrammarDrill, 'answerQuiz', 'conjugate'); // quiz-style drill
    }

    // ── 模考 ──
    if (typeof window.MockExam !== 'undefined' && window.MockExam.startSection) {
      const key = 'MockExam.startSection';
      if (!wrapped.has(key)) {
        const orig = window.MockExam.startSection;
        window.MockExam.startSection = function(...args) {
          const lv = (window.MockExam.currentLevel || args[0] || 'n5').toLowerCase();
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
