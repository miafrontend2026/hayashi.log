#!/usr/bin/env node
// 一次性 / 重複可跑：把所有靜態內容 JS 檔的資料抽出來，pack 成一個 master JSON
// 寫進 Firestore content/master 文件。前端 + App 都拉這份。
//
// 內容源：
//   vocab-n5..n1.js      → VOCAB_N5..N1
//   grammar-n3..n1.js    → N3..N1
//   index.html (inline)  → N5, N4 (grammar 陣列直接在 HTML 裡)
//   confusables.js       → CONFUSABLES
//   listening.js         → items array (在 IIFE 內、用 regex 摳)
//   reading.js           → passages array (同上)
//
// 必填環境變數：
//   GCP_SA_KEY  service account JSON 整段（jpnote-1bdd6 內 Cloud Datastore User）
// 可選：
//   DRY_RUN=1   只 print 不寫

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');

const isDryRun = !!process.env.DRY_RUN;
if (!isDryRun && !process.env.GCP_SA_KEY) { console.error('Missing GCP_SA_KEY (or set DRY_RUN=1 to skip write)'); process.exit(1); }
const sa = process.env.GCP_SA_KEY ? JSON.parse(process.env.GCP_SA_KEY) : null;
const projectId = sa?.project_id;

function evalJs(src, name) {
  const fn = new Function(src + `; return typeof ${name} !== 'undefined' ? ${name} : null;`);
  return fn();
}

function readJs(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

// 收集所有資料
const data = {};
data.vocab = {};
for (const lv of ['n5','n4','n3','n2','n1']) {
  data.vocab[lv] = evalJs(readJs(`vocab-${lv}.js`), `VOCAB_${lv.toUpperCase()}`);
  if (!data.vocab[lv]) throw new Error(`vocab-${lv} 抽取失敗`);
}
data.grammar = {};
for (const lv of ['n5','n4','n3','n2','n1']) {
  data.grammar[lv] = evalJs(readJs(`grammar-${lv}.js`), lv.toUpperCase());
  if (!data.grammar[lv]) throw new Error(`grammar-${lv} 抽取失敗`);
}

// CONFUSABLES
data.confusables = evalJs(readJs('confusables.js').replace(/if \(typeof module[\s\S]*$/, ''), 'CONFUSABLES');
if (!data.confusables) throw new Error('confusables 抽取失敗');

// listening items / reading passages：抽出來放獨立資料檔（listening.js / reading.js
// IIFE 內部結構不適合 migration 讀，獨立 SRC 檔當 source of truth）
data.listening_items = evalJs(readJs('listening-items.js'), 'LISTENING_ITEMS_SRC');
if (!data.listening_items) throw new Error('listening-items.js 抽取失敗');
data.reading_passages = evalJs(readJs('reading-passages.js'), 'READING_PASSAGES_SRC');
if (!data.reading_passages) throw new Error('reading-passages.js 抽取失敗');

const json = JSON.stringify(data);
const version = crypto.createHash('sha1').update(json).digest('hex').slice(0, 12);

console.log('=== 統計 ===');
console.log(`vocab: n5=${data.vocab.n5.length} n4=${data.vocab.n4.length} n3=${data.vocab.n3.length} n2=${data.vocab.n2.length} n1=${data.vocab.n1.length}`);
console.log(`grammar: n5=${data.grammar.n5.length} n4=${data.grammar.n4.length} n3=${data.grammar.n3.length} n2=${data.grammar.n2.length} n1=${data.grammar.n1.length}`);
console.log(`confusables: ${data.confusables.length}`);
console.log(`listening_items: ${data.listening_items.length}`);
console.log(`reading_passages: ${data.reading_passages.length}`);
console.log(`JSON size: ${json.length} bytes (限 1048576)`);
console.log(`version: ${version}`);

if (isDryRun) { console.log('DRY_RUN=1，不寫 Firestore'); process.exit(0); }

// SA JWT → access_token
function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const now = Math.floor(Date.now() / 1000);
const jwtHeader = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const jwtClaim = b64u(JSON.stringify({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/datastore',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now, exp: now + 3600,
}));
const unsigned = `${jwtHeader}.${jwtClaim}`;
const signer = crypto.createSign('RSA-SHA256');
signer.update(unsigned);
const jwt = `${unsigned}.${b64u(signer.sign(sa.private_key))}`;

const tokRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }),
});
if (!tokRes.ok) { console.error('SA JWT exchange failed:', await tokRes.text()); process.exit(1); }
const accessToken = (await tokRes.json()).access_token;

// PATCH content/master
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/content/master?updateMask.fieldPaths=payload&updateMask.fieldPaths=version&updateMask.fieldPaths=updatedAt`;
const r = await fetch(url, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fields: {
      payload: { stringValue: json },
      version: { stringValue: version },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  }),
});
if (!r.ok) { console.error('Firestore PATCH failed:', r.status, await r.text()); process.exit(1); }
console.log(`Firestore content/master 寫入完成 (version=${version})`);
