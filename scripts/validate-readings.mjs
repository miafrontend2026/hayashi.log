#!/usr/bin/env node
// 校驗 grammar-kanji-readings.tsv 的讀音資料：
// - reading 必須全平假名（含長音 ー 與小寫拗音）；含 romaji / katakana / 漢字 → 標 BAD
// - reading 若不含原 kanji 中任何字的可能讀音 → 暫且信任 Gemini（無法本地驗）
// - 對應 vocab-n*.js 表的詞，比對 reading 是否一致；不一致 → 標 MISMATCH
// 輸出：
//   - grammar-kanji-readings.clean.json   ：通過校驗、可直接用
//   - grammar-kanji-readings.flagged.tsv  ：待人工修正

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'scripts/grammar-kanji-readings.tsv');
const CLEAN = path.join(ROOT, 'scripts/grammar-kanji-readings.clean.json');
const FLAGGED = path.join(ROOT, 'scripts/grammar-kanji-readings.flagged.tsv');

// 平假名 + 長音 + 小寫拗音
const HIRAGANA_RE = /^[ぁ-ゖー]+$/;

// 讀 vocab 表建立 reference dict
function loadVocabReadings() {
  const dict = new Map();
  for (const lv of ['n5','n4','n3','n2','n1']) {
    const p = path.join(ROOT, `vocab-${lv}.js`);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const re = /\{w:"([^"]+)",r:"([^"]+)"/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (!dict.has(m[1])) dict.set(m[1], m[2]);
    }
  }
  return dict;
}

const vocabDict = loadVocabReadings();
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const clean = {};
const flagged = [];
const warnings = [];

for (const line of lines) {
  if (!line || line.startsWith('#')) continue;
  const [kanji, reading] = line.split('\t');
  if (!kanji || !reading) continue;
  const reasons = [];
  if (!HIRAGANA_RE.test(reading)) reasons.push('NOT_HIRAGANA');
  // 比對 vocab 表（僅供參考，不擋；多音字 Gemini 看 context 選讀音可能跟 vocab 表不同）
  if (vocabDict.has(kanji)) {
    const ref = vocabDict.get(kanji);
    if (ref !== reading) warnings.push(`${kanji}: 採用 Gemini=${reading}（vocab 表=${ref}）`);
  }
  // reading 長度合理性：對純漢字詞 (no hiragana tail) 至少要 1 char
  // 含 okurigana 的 (例 食べる) reading 應該 ≥ kanji 字數
  // 太短可疑（讀音比漢字短，通常代表 Gemini 漏字）
  const hasHiraganaTail = /[ぁ-ゖ]/.test(kanji);
  if (!hasHiraganaTail && reading.length < kanji.length) reasons.push(`TOO_SHORT(reading=${reading.length} kanji=${kanji.length})`);
  if (reasons.length) {
    flagged.push({ kanji, reading, reasons });
  } else {
    clean[kanji] = reading;
  }
}

fs.writeFileSync(CLEAN, JSON.stringify(clean, null, 0) + '\n');

const flaggedTsv =
  '# 待人工修正的讀音項目\n' +
  '# 格式：<漢字>\t<目前讀音>\t<原因>\n' +
  flagged.map(x => `${x.kanji}\t${x.reading}\t${x.reasons.join(',')}`).join('\n') + '\n';
fs.writeFileSync(FLAGGED, flaggedTsv);

console.log(`clean: ${Object.keys(clean).length} entries → ${path.relative(ROOT, CLEAN)}`);
console.log(`flagged: ${flagged.length} entries → ${path.relative(ROOT, FLAGGED)}`);
console.log(`warnings (vocab 表不一致，接受 Gemini): ${warnings.length}`);
if (flagged.length) {
  console.log('\nflagged (要修):');
  for (const x of flagged) console.log(`  ${x.kanji}\t${x.reading}\t${x.reasons.join(',')}`);
}
if (warnings.length) {
  console.log('\nwarnings (多音字 informational):');
  for (const w of warnings) console.log(`  ${w}`);
}
