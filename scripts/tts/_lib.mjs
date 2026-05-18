// Shared helpers for the site-wide TTS pipeline.
// Pipeline:
//   collect.mjs  -> texts.json
//   generate.mjs -> audio/tts/<hash>.mp3  +  audio/tts/manifest.js
// Frontend:
//   <script src="audio/tts/manifest.js"></script>  populates window.__TTS = { "<text>": "<hash>" }
//   speak(text) checks __TTS first, falls back to browser SpeechSynthesis.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const ENGINE = process.env.VOICEVOX_URL || 'http://127.0.0.1:50021';
export const SPEAKER = parseInt(process.env.VOICEVOX_SPEAKER || '2', 10); // 2 = 四国めたん ノーマル

export const TEXTS_JSON = path.join(here, 'texts.json');
export const OVERRIDES_JSON = path.join(here, 'overrides.json');
export const OUT_DIR = path.join(ROOT, 'audio/tts');
export const MANIFEST_JS = path.join(OUT_DIR, 'manifest.js');

export function hashText(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
}

export function stripHtml(s) {
  return String(s || '')
    .replace(/<\/?em>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\\"/g, '"')
    .trim();
}

export function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_JSON)) return [];
  const raw = JSON.parse(fs.readFileSync(OVERRIDES_JSON, 'utf8'));
  delete raw._comment;
  return Object.entries(raw).sort((a, b) => b[0].length - a[0].length);
}

export function applyOverrides(text, overrides) {
  let out = text;
  for (const [k, v] of overrides) out = out.split(k).join(v);
  return out;
}

// Per-request timeout — without this a stuck VOICEVOX request will hang forever
// (we hit this once already: 0% CPU, no progress for an hour).
async function fetchT(url, opts = {}, ms = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

export async function audioQuery(text) {
  // 支援 kana 強制重音模式：override 寫成 "kana:ハ'ガキ" 之類，跳過 VOICEVOX 自動分析
  if (text.startsWith('kana:')) {
    const kana = text.slice(5);
    const apUrl = `${ENGINE}/accent_phrases?text=${encodeURIComponent(kana)}&speaker=${SPEAKER}&is_kana=true`;
    const apRes = await fetchT(apUrl, { method: 'POST' });
    if (!apRes.ok) throw new Error(`accent_phrases ${apRes.status}: ${await apRes.text()}`);
    const accent_phrases = await apRes.json();
    // VOICEVOX speaker 2 (四国めたん) 的 h/k/s/t 起首子音偏弱、容易被聽成像沒子音。
    // kana: override 的詞通常就是因為這原因才被報修，自動把弱子音拉長 + 母音微長讓它清楚。
    const WEAK = new Set(['h', 'k', 's', 't']);
    for (const p of accent_phrases) {
      const m0 = p.moras && p.moras[0];
      if (m0 && WEAK.has(m0.consonant)) {
        m0.consonant_length = (m0.consonant_length || 0.05) * 2.5;
        m0.vowel_length = (m0.vowel_length || 0.07) * 1.3;
      }
    }
    return {
      accent_phrases,
      speedScale: 1.0, pitchScale: 0.0, intonationScale: 1.0, volumeScale: 1.0,
      prePhonemeLength: 0.1, postPhonemeLength: 0.1,
      pauseLength: null, pauseLengthScale: 1.0,
      outputSamplingRate: 24000, outputStereo: false,
      kana,
    };
  }
  const url = `${ENGINE}/audio_query?text=${encodeURIComponent(text)}&speaker=${SPEAKER}`;
  const res = await fetchT(url, { method: 'POST' });
  if (!res.ok) throw new Error(`audio_query ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function synthesis(query) {
  const url = `${ENGINE}/synthesis?speaker=${SPEAKER}`;
  const res = await fetchT(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`synthesis ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function checkEngine() {
  try {
    const r = await fetch(`${ENGINE}/version`);
    if (!r.ok) throw new Error('engine returned ' + r.status);
    return await r.text();
  } catch (e) {
    throw new Error(`VOICEVOX engine not reachable at ${ENGINE} — open the VOICEVOX app first. (${e.message})`);
  }
}

// Convert a raw VOICEVOX wav buffer to mp3 via ffmpeg, write to outPath.
// 64 kbps mono is plenty for spoken word and keeps file <30 KB per clip.
export function wavToMp3(wavBuf, outPath) {
  // Pipe wav into ffmpeg via stdin. Hard 15s timeout — without this a wedged ffmpeg
  // subprocess freezes the whole loop (we hit this on the first long run).
  execFileSync(
    'ffmpeg',
    ['-loglevel', 'error', '-y', '-f', 'wav', '-i', 'pipe:0',
      '-ac', '1', '-ar', '24000', '-b:a', '64k', outPath],
    { input: wavBuf, timeout: 15000, killSignal: 'SIGKILL' }
  );
}
