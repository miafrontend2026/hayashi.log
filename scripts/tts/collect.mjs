#!/usr/bin/env node
// Walk every data source on the site, gather every Japanese string we want spoken,
// and write a deduped list to texts.json.
//
// Sources:
//   index.html  — N5 + N4 grammar entries (inline)
//   grammar-n3.js / n2.js / n1.js — N3..N1 grammar
//   vocab-n5.js .. vocab-n1.js — vocab entries (use r||w for accuracy)
//   confusables.js — cf.words[].w + cf.eg[].j
//   verbs.html — hardcoded speak('xxx') call sites
//
// Each text is stored ONCE with the list of source labels that referenced it.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TEXTS_JSON, hashText, stripHtml } from './_lib.mjs';

const map = new Map(); // text -> Set<string source label>
function add(text, source) {
  const t = (text || '').trim();
  if (!t) return;
  if (!map.has(t)) map.set(t, new Set());
  map.get(t).add(source);
}

// ---- helpers ------------------------------------------------------------
function evalArrayFromFile(file, varName) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const fn = new Function(code + `; return typeof ${varName} !== 'undefined' ? ${varName} : null;`);
  return fn();
}

// Scan a chunk of source for {id:"<level>-N",...,eg:[{j:"...",z:"..."}, ...]} and emit each j.
function harvestInlineGrammar(src, levelPrefix, sourceLabel) {
  const entryRe = new RegExp(`\\{id:"(${levelPrefix}-\\d+)",.*?eg:\\[(.*?)\\](?:,n:"(?:\\\\.|[^"\\\\])*")?\\}`, 'g');
  const egRe = /\{j:"((?:\\.|[^"\\])*)",z:"(?:\\.|[^"\\])*"\}/g;
  let m;
  while ((m = entryRe.exec(src))) {
    const block = m[2];
    let e;
    egRe.lastIndex = 0;
    while ((e = egRe.exec(block))) {
      const j = stripHtml(e[1]);
      if (j) add(j, `${sourceLabel}#${m[1]}`);
    }
  }
}

// ---- collect ------------------------------------------------------------
console.log('Scanning sources...');

// Grammar:N5/N4 早期 inline 在 index.html,後來搬出去獨立檔(Firestore content/master 同步用)
// 兩處都掃,index.html 是歷史遺留,grammar-{n5,n4}.js 是當前真實 source of truth
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
harvestInlineGrammar(html, 'n5', 'grammar-n5-inline');
harvestInlineGrammar(html, 'n4', 'grammar-n4-inline');

// Grammar in standalone files (N5 N4 N3 N2 N1) — N5/N4 是 2026-05 後新增的 fallback 檔
for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1']) {
  const file = `grammar-${lv}.js`;
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  harvestInlineGrammar(src, lv, `grammar-${lv}`);
}

// Vocab — every file uses const VOCAB_<LEVEL> = [{w,r,m,c,...}, ...]
for (const lv of ['n5', 'n4', 'n3', 'n2', 'n1']) {
  const file = `vocab-${lv}.js`;
  const data = evalArrayFromFile(file, `VOCAB_${lv.toUpperCase()}`);
  if (!Array.isArray(data)) continue;
  for (const item of data) {
    const text = (item.r || item.w || '').trim();
    if (!text) continue;
    add(text, `vocab-${lv}`);
    // Example sentences (item.e[].j) — frontend FlashCard / vocab cards 點例句喇叭時讀 j 原文
    if (Array.isArray(item.e)) {
      for (const ex of item.e) {
        const j = stripHtml((ex && ex.j) || '');
        if (j) add(j, `vocab-${lv}#${item.w || text}`);
      }
    }
  }
}

// Confusables — cf.words[].w + cf.eg[].j
const confSrc = fs.readFileSync(path.join(ROOT, 'confusables.js'), 'utf8');
const CONFUSABLES = (new Function(confSrc + '; return typeof CONFUSABLES !== "undefined" ? CONFUSABLES : null;'))();
if (Array.isArray(CONFUSABLES)) {
  for (const cf of CONFUSABLES) {
    if (Array.isArray(cf.words)) {
      for (const w of cf.words) add(w.w, 'confusables-word');
    }
    if (Array.isArray(cf.eg)) {
      for (const e of cf.eg) add(stripHtml(e.j), 'confusables-eg');
    }
  }
}

// Verbs page — extract every speak('...') argument.
const verbsHtml = fs.readFileSync(path.join(ROOT, 'verbs.html'), 'utf8');
const verbRe = /speak\('([^']+)'\)/g;
let v;
while ((v = verbRe.exec(verbsHtml))) add(v[1], 'verbs');

// Listening — every script:"..." inside listening-items.js (LISTENING_ITEMS_SRC bank).
// Frontend (listening.js:234) feeds script.replace(/\n/g, '。') to speakText, so we mirror that.
// 2026-05-26:從 listening.js 改成 listening-items.js — 資料早就搬走了
const listenSrc = fs.readFileSync(path.join(ROOT, 'listening-items.js'), 'utf8');
const scriptRe = /script:"((?:\\.|[^"\\])*)"/g;
let ls;
while ((ls = scriptRe.exec(listenSrc))) {
  // Decode JS string escapes (\\n -> newline, \" -> ", etc.) then join with 。
  const raw = ls[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  add(raw.replace(/\n/g, '。'), 'listening');
}

// ---- write --------------------------------------------------------------
const out = [...map.entries()]
  .map(([text, sources]) => ({ text, hash: hashText(text), sources: [...sources] }))
  .sort((a, b) => a.text.localeCompare(b.text, 'ja'));

fs.writeFileSync(TEXTS_JSON, JSON.stringify(out, null, 2), 'utf8');

// Hash collision check (paranoia for 12-char SHA1 prefix at this scale).
const byHash = new Map();
for (const r of out) {
  if (byHash.has(r.hash)) {
    console.error(`HASH COLLISION: ${r.hash} -> "${byHash.get(r.hash)}" vs "${r.text}"`);
  }
  byHash.set(r.hash, r.text);
}

console.log(`Collected ${out.length} unique texts → ${path.relative(ROOT, TEXTS_JSON)}`);
console.log('Source breakdown:');
const buckets = {};
for (const r of out) {
  for (const s of r.sources) {
    const bucket = s.split('#')[0];
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
}
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}
