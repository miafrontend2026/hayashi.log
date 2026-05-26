// quota.js — Freemium 每日工具額度 + Premium 檢查
//
// Tools(每天每帳號額度,午夜重置):
//   srs:       3 張卡 / 天
//   shadow:    3 句 / 天
//   conjugate: 3 題 / 天
//   mock:      每等級 1 套(lifetime,沒每日重置)
//
// Premium 用戶完全不限額。
//
// 用法:
//   if (!Quota.check('srs')) { Quota.showPaywall('srs'); return; }
//   Quota.inc('srs');  // 完成 1 次,計數 +1
//
// localStorage key:
//   tool_usage_YYYY-MM-DD = { srs: 2, shadow: 1, conjugate: 0 }
//   mock_done = { n5: true, n4: false, ... } (lifetime)
//
// Premium cache (避免每次都 hit Firestore):
//   premium_cache = { isPremium: bool, expiresAt: timestamp, cached_at: timestamp }
//   cache TTL 5 分鐘
//
window.Quota = (function () {
  const DAILY_LIMIT = {
    srs: 3,
    shadow: 3,
    conjugate: 3,
  };
  const MOCK_FREE_PER_LEVEL = 1;
  const PREMIUM_CACHE_TTL = 5 * 60 * 1000;  // 5 分鐘

  // === Premium 檢查 ===
  function getPremiumCache() {
    try { return JSON.parse(localStorage.getItem('premium_cache')) || null; }
    catch (e) { return null; }
  }
  function setPremiumCache(isPremium, sub) {
    const data = {
      isPremium,
      plan: sub?.plan,
      expiresAt: sub?.expiresAt || null,
      is_early_bird: sub?.is_early_bird || false,
      cached_at: Date.now(),
    };
    localStorage.setItem('premium_cache', JSON.stringify(data));
  }

  /** Sync 讀 cache,不打 Firestore。前端 UI 用這個快速判斷。 */
  function cachedPremium() {
    const c = getPremiumCache();
    if (!c) return false;
    // 過期就視為非 premium
    if (c.expiresAt && c.expiresAt <= Date.now()) return false;
    return !!c.isPremium;
  }

  /** Async 從 Firestore 拉最新,更新 cache。callback 樣式避免依賴 promise。 */
  function refreshPremium() {
    // 如果 Firebase / firestore 還沒載入,直接回 false
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) {
      setPremiumCache(false, null);
      return Promise.resolve(false);
    }
    const user = firebase.auth().currentUser;
    if (!user) { setPremiumCache(false, null); return Promise.resolve(false); }

    return firebase.firestore().collection('users').doc(user.uid).get()
      .then(doc => {
        const sub = doc.data()?.subscription || null;
        const isPremium = sub
          && (sub.status === 'active' || sub.status === 'trialing')
          && (sub.plan === 'lifetime' || (sub.expiresAt && sub.expiresAt > Date.now()));
        setPremiumCache(!!isPremium, sub);
        return !!isPremium;
      })
      .catch(() => { setPremiumCache(false, null); return false; });
  }

  // === Daily quota ===
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function loadUsage() {
    const key = 'tool_usage_' + todayKey();
    try { return JSON.parse(localStorage.getItem(key)) || {}; }
    catch (e) { return {}; }
  }
  function saveUsage(data) {
    localStorage.setItem('tool_usage_' + todayKey(), JSON.stringify(data));
  }
  function getUsage(tool) {
    return loadUsage()[tool] || 0;
  }
  function getRemaining(tool) {
    if (cachedPremium()) return Infinity;
    const limit = DAILY_LIMIT[tool];
    if (!limit) return Infinity;
    return Math.max(0, limit - getUsage(tool));
  }

  // === Mock(每等級終身 1 套) ===
  function loadMockDone() {
    try { return JSON.parse(localStorage.getItem('mock_done')) || {}; }
    catch (e) { return {}; }
  }
  function isMockDone(level) {
    return !!loadMockDone()[level];
  }
  function markMockDone(level) {
    const d = loadMockDone();
    d[level] = true;
    localStorage.setItem('mock_done', JSON.stringify(d));
  }

  // === 公開 API ===
  /** check(tool, opts?): 能用回 true,額滿回 false。
   *  opts.level = 'n5'..'n1'(模考用) */
  function check(tool, opts) {
    if (cachedPremium()) return true;
    if (tool === 'mock') {
      const level = opts?.level;
      if (!level) return true;  // 未指定等級就放行
      return !isMockDone(level);
    }
    if (!DAILY_LIMIT[tool]) return true;
    return getUsage(tool) < DAILY_LIMIT[tool];
  }

  /** inc(tool, opts?): 計數 +1(免費用戶才計;Premium 不計)。 */
  function inc(tool, opts) {
    if (cachedPremium()) return;
    if (tool === 'mock') {
      const level = opts?.level;
      if (level) markMockDone(level);
      return;
    }
    if (!DAILY_LIMIT[tool]) return;
    const u = loadUsage();
    u[tool] = (u[tool] || 0) + 1;
    saveUsage(u);
  }

  /** Paywall modal:工具額滿時呼叫。 */
  function showPaywall(tool, opts) {
    const old = document.getElementById('qwPaywall');
    if (old) old.remove();

    const TOOL_LABELS = {
      srs:       { name: 'SRS 快速背單字', limit: '3 張卡' },
      shadow:    { name: '跟讀練習',       limit: '3 句'   },
      conjugate: { name: '動詞變化練習',   limit: '3 題'   },
      mock:      { name: '模擬考試',       limit: '每等級 1 套' },
    };
    const meta = TOOL_LABELS[tool] || { name: tool, limit: '-' };

    const mask = document.createElement('div');
    mask.id = 'qwPaywall';
    mask.className = 'cc-mask';
    mask.innerHTML = `
      <div class="cc-box" style="width:min(420px,calc(100vw - 32px));text-align:center">
        <div style="font-size:42px;line-height:1">💎</div>
        <div class="cc-title" style="font-size:18px;margin-top:8px;margin-bottom:6px">升級 Premium</div>
        <div class="cc-msg" style="margin-bottom:18px">
          ${meta.name} 免費版每天限 <strong>${meta.limit}</strong>。<br>
          今天的額度已用完。升級後無限次使用所有工具。
        </div>
        <div style="text-align:left;background:var(--bg3);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.9;margin-bottom:18px">
          ✓ 無限次 SRS / 跟讀 / 動詞變化練習<br>
          ✓ 完整模擬考 + 詳解 + 錯題回顧<br>
          ✓ 跨裝置雲端同步<br>
          ✓ 進階主題色 / 提醒時段<br>
          ✓ 無廣告
        </div>
        <div class="cc-btns" style="flex-direction:column;gap:8px">
          <a href="pricing.html" class="cc-btn primary" style="background:var(--ac);color:#fff;border-color:var(--ac);text-decoration:none;padding:12px;font-weight:700">查看方案 →</a>
          <button class="cc-btn" data-act="close">明天再來</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('on'));
    mask.addEventListener('click', e => {
      if (e.target === mask || e.target.dataset.act === 'close') {
        mask.classList.remove('on');
        setTimeout(() => mask.remove(), 250);
      }
    });

    // GA event
    if (typeof gtag === 'function') gtag('event', 'paywall_shown', { tool });
  }

  // === Init:頁面載入時 refresh 一次 premium 狀態 ===
  // 注意:auth 還沒 ready 時不會打,等 onAuthStateChanged 才會更新
  function init() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(user => {
        if (user) refreshPremium();
        else setPremiumCache(false, null);
      });
    }
  }
  // Auto-init when script loads(但 Firebase SDK 必須已載入)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    check, inc, showPaywall,
    cachedPremium, refreshPremium,
    getUsage, getRemaining, isMockDone,
    DAILY_LIMIT, MOCK_FREE_PER_LEVEL,
  };
})();
