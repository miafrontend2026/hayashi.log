#!/usr/bin/env node
// 把 scripts/verb-transitivity.tsv 的 t 欄灌進 vocab-n*.js 對應 entry 的 t 欄位
// 跳過 ? / 空值 / 重複 entry。
//
// 安全考量：只動 c='動' 且 w+r 完全匹配的 entry。修改前印 diff 統計。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TSV = path.join(ROOT, 'scripts/verb-transitivity.tsv');

if (!fs.existsSync(TSV)) {
  console.error('找不到 scripts/verb-transitivity.tsv，請先跑 label-verb-transitivity.mjs');
  process.exit(1);
}

// 讀 TSV → map
const map = new Map();
for (const line of fs.readFileSync(TSV, 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const [w, r, , , t] = line.split('\t');
  if (w && r && t && ['自','他','両'].includes(t)) map.set(w + '|' + r, t);
}
console.log(`TSV 有效標記: ${map.size}`);

let totalUpdated = 0;
let totalSkipped = 0;

for (const lv of ['n5','n4','n3','n2','n1']) {
  const file = path.join(ROOT, `vocab-${lv}.js`);
  let src = fs.readFileSync(file, 'utf8');
  let updated = 0, skipped = 0;
  // 對每個 entry 做正規表示式置換：{w:"X",r:"Y",m:"Z",c:"動"}  →  {w:"X",r:"Y",m:"Z",c:"動",t:"自/他/両"}
  // 若 entry 已經有 t 欄就 skip（不覆蓋既有手動標）
  const entryRe = /\{w:"([^"\\]+)",r:"([^"\\]+)",m:"([^"\\]*)",c:"動"(?:,t:"[^"]+")?\}/g;
  src = src.replace(entryRe, (m0, w, r, mm) => {
    const t = map.get(w + '|' + r);
    if (!t) { skipped++; return m0; }
    // 已經有 t? 看原 match 含不含 ,t:"
    if (m0.includes(',t:"')) { skipped++; return m0; }
    updated++;
    return `{w:"${w}",r:"${r}",m:"${mm}",c:"動",t:"${t}"}`;
  });
  fs.writeFileSync(file, src);
  console.log(`${lv}: 寫入 ${updated} 條 t、跳過 ${skipped} 條`);
  totalUpdated += updated;
  totalSkipped += skipped;
}

console.log(`\n總計: 更新 ${totalUpdated} / 跳過 ${totalSkipped}`);
console.log('下一步：node scripts/migrate-content-to-firestore.mjs');
