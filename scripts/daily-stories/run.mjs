#!/usr/bin/env node
/**
 * 每日故事 批量生成 pipeline
 *
 * Pipeline:
 *   1. 讀 vocab-n{lv}.js → 切 20 字 batch
 *   2. Gemini 2.5 Pro 生成故事
 *   3. Gemini 2.5 Flash 驗證(20 詞 + 文法 + 「方」+ 連貫 + 中譯)
 *   4. 失敗 → 把問題當 hint 重生,最多 3 retry
 *   5. 還 fail → 標 manual_review,不擋 pipeline
 *   6. 寫 output/{lv}_{batchIdx}.json
 *
 * 用法:
 *   node scripts/daily-stories/run.mjs --level n5 --range 0:5
 *   node scripts/daily-stories/run.mjs --level n5         # 全跑
 *   node scripts/daily-stories/run.mjs --level n5 --force # 覆寫已生成
 *
 * 需要環境變數:
 *   GEMINI_API_KEY
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT_DIR = path.join(import.meta.dirname, 'output');
const PROMPTS = path.join(import.meta.dirname, 'prompts');

const GEN_MODEL = 'gemini-2.5-flash';        // Pro 需付費 tier,Flash 免費額度夠
const VERIFY_MODEL = 'gemini-2.5-flash-lite'; // 驗證更輕量,差不多免費 tier
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('需要 GEMINI_API_KEY 環境變數(check ~/.zshrc)'); process.exit(1); }

const DAILY_NEW = 20;
const MAX_RETRY = 3;
const SLEEP_BETWEEN_CALLS = 1500;  // 避免 rate limit

// === arg parsing ===
const argv = process.argv.slice(2);
function arg(name, def) { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; }
const level = arg('level');
const range = arg('range', '');  // "0:5" → 跑 batch 0-4
const force = argv.includes('--force');
if (!level) { console.error('需要 --level n5/n4/n3/n2/n1'); process.exit(1); }

// === load vocab ===
function loadVocab(lv) {
  const src = fs.readFileSync(path.join(ROOT, `vocab-${lv}.js`), 'utf8');
  const VAR = 'VOCAB_' + lv.toUpperCase();
  const fn = new Function(src + `; return ${VAR};`);
  return fn();
}

// === call Gemini ===
async function callGemini(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: model === GEN_MODEL ? 0.7 : 0.2,
    },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gemini ${model} ${r.status}: ${t.slice(0, 300)}`);
  }
  const j = await r.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty response: ' + JSON.stringify(j).slice(0, 300));
  try { return JSON.parse(text); }
  catch (e) {
    // Sometimes wrapped in ```json ... ```
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
    throw new Error('Gemini bad JSON: ' + text.slice(0, 300));
  }
}

const GEN_PROMPT = fs.readFileSync(path.join(PROMPTS, 'gen.md'), 'utf8');
const VERIFY_PROMPT = fs.readFileSync(path.join(PROMPTS, 'verify.md'), 'utf8');

function fmt(tmpl, vars) {
  let s = tmpl;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll('{' + k + '}', v);
  return s;
}

async function generate(level, vocab, hint = '') {
  const vocabLines = vocab.map((v, i) => `${i + 1}. ${v.w}${v.r && v.r !== v.w ? ` (${v.r})` : ''} ${v.m || ''}`).join('\n');
  let prompt = fmt(GEN_PROMPT, { LEVEL: level.toUpperCase(), VOCAB_LIST: vocabLines });
  if (hint) prompt += '\n\n【上次失敗的修正提示】\n' + hint;
  return callGemini(GEN_MODEL, prompt);
}

async function verify(level, story, vocab) {
  const vocabLines = vocab.map(v => v.w).join('、');
  const prompt = fmt(VERIFY_PROMPT, {
    LEVEL: level.toUpperCase(),
    STORY_JSON: JSON.stringify(story, null, 2),
    VOCAB_LIST: vocabLines,
  });
  return callGemini(VERIFY_MODEL, prompt);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// === main ===
const vocab = loadVocab(level);
const totalBatches = Math.ceil(vocab.length / DAILY_NEW);
let [start, end] = range
  ? range.split(':').map(Number)
  : [0, totalBatches];
if (isNaN(end)) end = totalBatches;
console.log(`📚 ${level.toUpperCase()}:${vocab.length} 詞 → ${totalBatches} batches,跑 ${start}-${end - 1}`);

const stats = { ok: 0, fail: 0, skip: 0 };

for (let b = start; b < end; b++) {
  const outPath = path.join(OUT_DIR, `${level}_${b}.json`);
  if (fs.existsSync(outPath) && !force) {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    if (existing.pass) { stats.skip++; console.log(`⏭  ${level}_${b} 已存在 ✓`); continue; }
  }

  const batch = vocab.slice(b * DAILY_NEW, (b + 1) * DAILY_NEW);
  if (batch.length < DAILY_NEW * 0.5) { console.log(`⏭  ${level}_${b} batch 太小(${batch.length}),跳`); continue; }

  console.log(`\n🎯 ${level}_${b}(${batch.map(v => v.w).slice(0, 5).join(',')}...)`);

  let story, audit, hint = '';
  let pass = false;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      console.log(`   gen attempt ${attempt}/${MAX_RETRY}`);
      story = await generate(level, batch, hint);
      await sleep(SLEEP_BETWEEN_CALLS);

      audit = await verify(level, story, batch);
      if (audit.pass) {
        pass = true;
        console.log(`   ✅ pass`);
        break;
      }
      hint = audit.suggested_fix || JSON.stringify({
        missing: audit.missing_vocab,
        grammar: audit.grammar_issues,
        fang: audit.fang_issue,
        coherence: audit.coherence_issue,
      });
      console.log(`   ❌ fail: ${hint.slice(0, 100)}...`);
      await sleep(SLEEP_BETWEEN_CALLS);
    } catch (e) {
      console.log(`   ⚠️ error: ${e.message.slice(0, 200)}`);
      await sleep(SLEEP_BETWEEN_CALLS * 2);
    }
  }

  const result = {
    level, batchIdx: b,
    vocab: batch.map(v => v.w),
    story,
    audit,
    pass,
    generated_at: new Date().toISOString(),
  };
  if (!pass) result.manual_review = true;
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

  if (pass) stats.ok++; else stats.fail++;
  console.log(`   → ${path.relative(ROOT, outPath)} ${pass ? '✓' : '⚠ manual_review'}`);
}

console.log(`\n📊 完成:✅ ${stats.ok} 過 / ⚠ ${stats.fail} 需 review / ⏭ ${stats.skip} 跳`);
