#!/usr/bin/env node
// 用 Gemini API 批次標 1901 個動詞的自/他動詞屬性
// 必填環境變數：GEMINI_API_KEY
//
// 輸出：scripts/verb-transitivity.tsv
// 格式：w<TAB>r<TAB>m<TAB>lv<TAB>t  (t: 自/他/両/? )
//
// 支援中斷重啟（已有的不會重抓）
// Rate limit: gemini-2.5-flash 免費 15 RPM、批次間 4.5 秒

import fs from 'node:fs';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'scripts/verb-transitivity.tsv');

function evalJs(src, name) {
  return new Function(`${src}; return typeof ${name} !== 'undefined' ? ${name} : null;`)();
}

// 收集所有動詞
const verbs = [];
for (const lv of ['n5','n4','n3','n2','n1']) {
  const arr = evalJs(fs.readFileSync(path.join(ROOT, `vocab-${lv}.js`), 'utf8'), `VOCAB_${lv.toUpperCase()}`) || [];
  for (const d of arr) {
    if (d.c === '動') verbs.push({ w: d.w, r: d.r, m: d.m, lv });
  }
}
console.log(`動詞總數: ${verbs.length}`);

// Resume support
const existing = new Map();
if (fs.existsSync(OUT)) {
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [w, r, , , t] = line.split('\t');
    if (w && t) existing.set(w + '|' + r, t);
  }
  console.log(`已有 ${existing.size} 條，跳過`);
} else {
  fs.writeFileSync(OUT, '# w\tr\tm\tlv\tt (自/他/両/?)\n');
}

const todo = verbs.filter(v => !existing.has(v.w + '|' + v.r));
if (!todo.length) { console.log('全部已標完'); process.exit(0); }
console.log(`待處理: ${todo.length}`);

const BATCH = 80;

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const prompt = `你是日語語法專家。對每個動詞判斷是「自動詞」(自)、「他動詞」(他)、還是「自他兩用」(両)。

回覆規則：
- 每行格式：w<TAB>r<TAB>t（t 只能是「自」「他」「両」）
- 不要解釋、不要 markdown、不要前後文字
- 順序跟輸入一致

範例：
死ぬ\tしぬ\t自
食べる\tたべる\t他
開く\tひらく\t両

動詞：
${batch.map(v => v.w + '\t' + v.r).join('\n')}`;

  console.log(`[${i + 1}-${i + batch.length} / ${todo.length}] calling Gemini...`);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
  });
  if (!r.ok) {
    console.error('Gemini error:', r.status, (await r.text()).slice(0, 200));
    console.error('已寫入結果保留在 scripts/verb-transitivity.tsv，重跑可斷點續傳');
    process.exit(1);
  }
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // 解析回應
  const lookup = new Map();
  for (const line of text.split('\n')) {
    const parts = line.trim().split('\t');
    if (parts.length >= 3 && ['自','他','両'].includes(parts[2])) {
      lookup.set(parts[0] + '|' + parts[1], parts[2]);
    }
  }

  const rows = [];
  let missing = 0;
  for (const v of batch) {
    const key = v.w + '|' + v.r;
    const t = lookup.get(key) || '?';
    if (t === '?') missing++;
    rows.push([v.w, v.r, v.m, v.lv, t].join('\t'));
  }
  fs.appendFileSync(OUT, rows.join('\n') + '\n');
  console.log(`  → 寫入 ${rows.length}（缺值 ${missing}）`);

  if (i + BATCH < todo.length) await new Promise((res) => setTimeout(res, 4500));
}

console.log('\n完成。下一步：');
console.log('  cat scripts/verb-transitivity.tsv | grep -c "?\\$"   # 看有多少缺值');
console.log('  node scripts/apply-verb-transitivity.mjs        # 灌進 vocab-n*.js');
console.log('  node scripts/migrate-content-to-firestore.mjs    # 推 Firestore');
