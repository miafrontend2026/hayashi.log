#!/usr/bin/env node
// 掃描所有 grammar 例句（grammar-n3/n2/n1.js + index.html 內嵌 N5/N4），
// 抽出含漢字的「最長連續漢字 + 可能尾巴 okurigana」單元，dedup 後輸出。
// 用途：餵 Gemini 補讀音 → 之後拿回來做 furigana ruby。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// 抓所有 `j:"...日文..."` 字串內容（不解析 JS，直接 regex 撈）
function extractJStrings(src) {
  const out = [];
  // j:"<内容>" 允許跳脫雙引號、跨行
  const re = /\bj\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    // 反跳脫
    const s = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    out.push(s);
  }
  return out;
}

// 移除 <em>…</em> 標記
function stripHtml(s) {
  return s.replace(/<\/?[a-z][^>]*>/gi, '');
}

const files = [
  'grammar-n1.js',
  'grammar-n2.js',
  'grammar-n3.js',
  'index.html', // N5/N4 文法 inline 在這裡
];

const sentences = [];
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  for (const j of extractJStrings(src)) {
    const clean = stripHtml(j).trim();
    if (clean && /[一-鿿]/.test(clean)) sentences.push({ src: f, j: clean });
  }
}

// 抓「最長連續漢字 + 可能緊跟的 hiragana okurigana（最多 3 個）」
// 例：食べる → 食べる、京都 → 京都、年齢 → 年齢
// 但若 okurigana 第一個是助詞（は/を/が/に/で/と/も/の/へ/や/か/ね/よ/さ/し）就剝掉
const PARTICLE_TAIL = /[はをがにでとものへやかねよさし]/;
const TOKEN_RE = /([一-鿿]+)([ぁ-ん]{0,3})/g;
const tokens = new Map(); // key: kanji-word, value: { count, examples: Set<sentence> }
for (const { j } of sentences) {
  const seen = new Set();
  let m;
  while ((m = TOKEN_RE.exec(j)) !== null) {
    const kanji = m[1];
    let tail = m[2] || '';
    // 第一個 hiragana 若是助詞，整段尾巴丟掉（彼は → 彼）
    if (tail && PARTICLE_TAIL.test(tail[0])) tail = '';
    const tk = kanji + tail;
    if (seen.has(tk)) continue;
    seen.add(tk);
    if (!tokens.has(tk)) tokens.set(tk, { count: 0, examples: new Set() });
    const rec = tokens.get(tk);
    rec.count++;
    if (rec.examples.size < 2) rec.examples.add(j);
  }
}

// 排序：高頻優先
const sorted = [...tokens.entries()].sort((a, b) => b[1].count - a[1].count);

console.log(`# Grammar 例句漢字抽詞表`);
console.log(`# 共 ${sentences.length} 句、${sorted.length} 個不同漢字詞`);
console.log(`# 格式：<漢字詞>\\t<出現次數>\\t<例句>`);
console.log(`# 餵 Gemini 提示詞建議：`);
console.log(`# 「請給每個漢字詞的標準東京音平假名讀音（含 okurigana），格式 漢字詞\\t讀音」`);
console.log('');
for (const [tk, { count, examples }] of sorted) {
  const eg = [...examples][0] || '';
  console.log(`${tk}\t${count}\t${eg}`);
}
