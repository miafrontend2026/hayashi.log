// 累計學員計數器 — 訪客只計 1 次，從 home/index/pricing/terms/... 任一頁進站都會 bump。
// 共用 localStorage flag 'learner_counted_v1' 跟 home.html / index.html 那邊的 firebase SDK 版本去重。
// 用 Firestore REST API（fieldTransforms.increment）避免每頁都載 250KB firebase SDK。
// 規則允許：stats/{doc} 公開 +1（在 firestore.rules 內有 allow update: learners == prev + 1）。
(function () {
  if (localStorage.getItem('learner_counted_v1')) return;
  // 已經有 SDK 載入（index.html / home.html）就讓他們處理，避免雙計
  if (typeof firebase !== 'undefined' && firebase.firestore) return;
  const PROJECT = 'jpnote-1bdd6';
  const DOC = `projects/${PROJECT}/databases/(default)/documents/stats/global`;
  const URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`;
  const body = {
    writes: [{
      transform: {
        document: DOC,
        fieldTransforms: [
          { fieldPath: 'learners', increment: { integerValue: '1' } },
        ],
      },
    }],
  };
  fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => {
    if (r.ok) localStorage.setItem('learner_counted_v1', '1');
  }).catch(() => { /* swallow */ });
})();
