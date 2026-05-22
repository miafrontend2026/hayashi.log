#!/usr/bin/env node
// Patch vocab-n*.js transitivity markers from /tmp/transitivity-report.json.
//
// Safety policy (after manual review of the raw report):
//   - Default mode: --dry-run (just preview, no writes).
//   - --apply must be passed to actually write.
//   - --include=swap (default): only patch strict 自↔他 swaps. JMdict's
//     "any-sense vi or vt" produces too many false-positive 両 promotions
//     (literary/archaic senses) to apply blindly.
//   - --include=all: also patch ours-vs-両 mismatches. NOT recommended
//     without spot-checking individual entries.
//   - --skip=<comma list of "level:w"> to exclude known bad matches.
//     Default skip list excludes kana-collision false positives like
//     いる/できる (JMdict hit 要る/射る/出来る is unrelated to our N5 sense).
//
// Idempotent: only rewrites lines whose current t:"..." matches the
// "ours" value recorded in the report. Re-running after apply is a no-op.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPORT = "/tmp/transitivity-report.json";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const include = [...args].find(a => a.startsWith("--include="))?.split("=")[1] ?? "swap";
const skipArg = [...args].find(a => a.startsWith("--skip="))?.split("=")[1] ?? "";

// Default skip list: kana-collision false positives spotted in manual review.
const DEFAULT_SKIP = new Set([
  "n5:いる",   // JMdict hit 要る/射る (他), but ours = 居る (自) — correct as-is
  "n5:できる", // JMdict hit ?, ours = 出来る (自) — correct as-is
]);
const skipSet = new Set([
  ...DEFAULT_SKIP,
  ...skipArg.split(",").map(s => s.trim()).filter(Boolean),
]);

if (!fs.existsSync(REPORT)) {
  console.error(`Report not found: ${REPORT}. Run verify-transitivity.mjs first.`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));

const isStrictSwap = (m) =>
  (m.t === "自" && m.jmdict === "他") || (m.t === "他" && m.jmdict === "自");

const candidates = report.mismatches.filter((m) => {
  if (skipSet.has(`${m.level}:${m.w}`)) return false;
  if (include === "swap") return isStrictSwap(m);
  return true; // "all"
});

console.error(`Mode: ${apply ? "APPLY" : "DRY-RUN"}, include=${include}, skipped=${skipSet.size}`);
console.error(`Candidates to patch: ${candidates.length} / ${report.mismatches.length} mismatches`);

// Group by level
const byLevel = new Map();
for (const c of candidates) {
  if (!byLevel.has(c.level)) byLevel.set(c.level, []);
  byLevel.get(c.level).push(c);
}

let totalPatched = 0;
const patchedDetail = [];
const failed = [];

for (const [level, entries] of byLevel) {
  const file = path.join(ROOT, `vocab-${level}.js`);
  let src = fs.readFileSync(file, "utf8");
  let levelPatched = 0;
  for (const e of entries) {
    // Build a regex that matches the exact entry line and captures the t:"X"
    // we expect to replace. Anchor by w:"..." and r:"..." to disambiguate.
    const wEsc = e.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rEsc = e.r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(\\{\\s*w:"${wEsc}"\\s*,\\s*r:"${rEsc}"\\s*,[^}]*?c:"動"[^}]*?t:")${e.t}("[^}]*\\})`,
      "g"
    );
    const before = src;
    src = src.replace(re, `$1${e.jmdict}$2`);
    if (src !== before) {
      levelPatched++;
      patchedDetail.push({ level, w: e.w, r: e.r, from: e.t, to: e.jmdict });
    } else {
      failed.push({ level, w: e.w, r: e.r, t: e.t, jmdict: e.jmdict, reason: "no match (already patched or regex miss)" });
    }
  }
  if (apply && levelPatched > 0) {
    fs.writeFileSync(file, src);
  }
  totalPatched += levelPatched;
  console.error(`  ${level}: ${levelPatched} patched${apply ? " (written)" : " (dry-run)"}`);
}

console.log(JSON.stringify({
  apply,
  include,
  candidates: candidates.length,
  patched: totalPatched,
  failed_count: failed.length,
  patched_detail: patchedDetail,
  failed,
  skip_list: [...skipSet],
}, null, 2));
