#!/usr/bin/env node
// Cross-verify our `t:"自"|"他"|"両"` markers against JMdict's vi/vt pos tags.
// Output JSON report: total / verified / mismatched / not_found + sample lists.
//
// JMdict is downloaded by the runner into scripts/.cache/JMdict_e (gunzipped).
// Source: https://www.edrdg.org/pub/Nihongo/JMdict_e.gz
//
// Heuristic: an <entry> is considered transitive (vt) and/or intransitive (vi)
// if ANY <sense> within it carries that pos tag. Entries with both are 両.
// This is permissive (favours 両) vs a strict per-sense reading — noted in
// commit message as a known caveat.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const JMDICT_PATH = path.join(ROOT, "scripts/.cache/JMdict_e");

if (!fs.existsSync(JMDICT_PATH)) {
  console.error("JMdict_e not found at", JMDICT_PATH);
  console.error("Run: curl -L https://www.edrdg.org/pub/Nihongo/JMdict_e.gz -o scripts/.cache/JMdict_e.gz && gunzip scripts/.cache/JMdict_e.gz");
  process.exit(1);
}

// --- 1. Parse JMdict ---------------------------------------------------------
const xml = fs.readFileSync(JMDICT_PATH, "utf8");
const jmdict = new Map(); // key (kanji or kana) -> { vi, vt }

const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
let entryCount = 0;
let m;
while ((m = entryRe.exec(xml)) !== null) {
  entryCount++;
  const body = m[1];
  const hasVi = body.includes("&vi;</pos>");
  const hasVt = body.includes("&vt;</pos>");
  if (!hasVi && !hasVt) continue;
  const kanjis = [...body.matchAll(/<keb>([^<]+)<\/keb>/g)].map(x => x[1]);
  const readings = [...body.matchAll(/<reb>([^<]+)<\/reb>/g)].map(x => x[1]);
  const tag = { vi: hasVi, vt: hasVt };
  // First-wins per key; multiple JMdict entries may share a surface form, but
  // overrides are rare enough that the first match is good enough.
  for (const k of kanjis) if (!jmdict.has(k)) jmdict.set(k, tag);
  for (const r of readings) if (!jmdict.has(r)) jmdict.set(r, tag);
}
console.error(`JMdict entries scanned: ${entryCount}, verb keys indexed: ${jmdict.size}`);

// --- 2. Parse our vocab files ------------------------------------------------
const ours = [];
for (const lv of ["n5", "n4", "n3", "n2", "n1"]) {
  const src = fs.readFileSync(path.join(ROOT, `vocab-${lv}.js`), "utf8");
  // Match objects: { w:"...", r:"...", m:"...", c:"動", ..., t:"自|他|両" }
  // c:"動" must appear; t may come before or after other fields.
  const re = /\{\s*w:"([^"]+)"\s*,\s*r:"([^"]+)"\s*,[^}]*?c:"動"[^}]*?t:"([自他両])"[^}]*\}/g;
  let mm;
  while ((mm = re.exec(src)) !== null) {
    ours.push({ level: lv, w: mm[1], r: mm[2], t: mm[3] });
  }
}
console.error(`Our verbs to verify: ${ours.length}`);

// --- 3. Cross-check ----------------------------------------------------------
function lookupTag(entry) {
  let tag = jmdict.get(entry.w) || jmdict.get(entry.r);
  if (tag) return { tag, via: "direct" };
  // Compound する verbs: JMdict usually stores the kanji compound separately.
  // Strip する/する trailing and retry.
  const stripSuru = (s) => s.endsWith("する") ? s.slice(0, -2) : null;
  const wStem = stripSuru(entry.w);
  const rStem = stripSuru(entry.r);
  if (wStem) { tag = jmdict.get(wStem); if (tag) return { tag, via: "suru-strip" }; }
  if (rStem) { tag = jmdict.get(rStem); if (tag) return { tag, via: "suru-strip" }; }
  return null;
}

const mismatches = [];
const notFound = [];
let verifiedCount = 0;
let suruStripCount = 0;
for (const entry of ours) {
  const hit = lookupTag(entry);
  if (!hit) { notFound.push(entry); continue; }
  if (hit.via === "suru-strip") suruStripCount++;
  const { vi, vt } = hit.tag;
  const expected = vi && vt ? "両" : vi ? "自" : "他";
  if (entry.t === expected) {
    verifiedCount++;
  } else {
    mismatches.push({ ...entry, jmdict: expected, via: hit.via });
  }
}

// --- 4. Emit report ----------------------------------------------------------
console.log(JSON.stringify({
  total: ours.length,
  verified: verifiedCount,
  mismatched: mismatches.length,
  not_found: notFound.length,
  resolved_via_suru_strip: suruStripCount,
  mismatches: mismatches.sort((a, b) =>
    a.level.localeCompare(b.level) || a.w.localeCompare(b.w)),
  not_found_all: notFound,
}, null, 2));
