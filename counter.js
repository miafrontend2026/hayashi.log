// 客戶端累計學員計數器已停用：每訪客寫 Firestore 一次會吃光 Spark 方案 20K 寫/日上限，
// 連帶 cron 同步也擋。改由 GitHub Actions 每天從 GA4 newUsers 覆寫 stats/global.learners。
// 保留檔案做 backwards-compat — 各 HTML 還在 <script src="counter.js">、沒人會壞。
(function () { /* no-op */ })();
