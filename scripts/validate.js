#!/usr/bin/env node
/**
 * validate.js
 * Validates all data files for the deguchi-n5-notes website.
 *
 * Checks:
 *   1. All JS files have valid syntax
 *   2. No duplicate entries (by id or word)
 *   3. All required fields exist
 *      - Vocab: w, r, m, c
 *      - Grammar: id, cat, t, p, ex, eg
 *   4. Readings are hiragana only (no katakana or kanji in `r` field)
 *   5. Statistics (total counts per level)
 *
 * Usage: node scripts/validate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let totalErrors = 0;
let totalWarnings = 0;

function error(msg) {
  console.error(`  ERROR: ${msg}`);
  totalErrors++;
}

function warn(msg) {
  console.warn(`  WARN:  ${msg}`);
  totalWarnings++;
}

function info(msg) {
  console.log(`  ${msg}`);
}

// --------------- helpers ---------------

/**
 * Check if a string contains only hiragana (+ prolonged sound mark).
 * Allows: hiragana (\u3040-\u309F), prolonged sound mark (ー),
 *         common punctuation (・、), spaces
 */
function isHiraganaOnly(str) {
  // Match characters that are NOT hiragana/allowed
  const nonHiragana = str.replace(/[\u3040-\u309F\u30FCー・、\s]/g, '');
  return nonHiragana.length === 0;
}

/**
 * Safely load a JS data file and return its exported variables.
 */
function loadJSFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    const fn = new Function(content + `
      ; const __exports = {};
      try { __exports.N2 = typeof N2 !== 'undefined' ? N2 : undefined; } catch(e) {}
      try { __exports.N3 = typeof N3 !== 'undefined' ? N3 : undefined; } catch(e) {}
      try { __exports.VOCAB_N2 = typeof VOCAB_N2 !== 'undefined' ? VOCAB_N2 : undefined; } catch(e) {}
      try { __exports.VOCAB_N3 = typeof VOCAB_N3 !== 'undefined' ? VOCAB_N3 : undefined; } catch(e) {}
      try { __exports.VOCAB_N4 = typeof VOCAB_N4 !== 'undefined' ? VOCAB_N4 : undefined; } catch(e) {}
      try { __exports.VOCAB_N5 = typeof VOCAB_N5 !== 'undefined' ? VOCAB_N5 : undefined; } catch(e) {}
      try { __exports.CATS_N2 = typeof CATS_N2 !== 'undefined' ? CATS_N2 : undefined; } catch(e) {}
      try { __exports.CATS_N3 = typeof CATS_N3 !== 'undefined' ? CATS_N3 : undefined; } catch(e) {}
      return __exports;
    `);
    return fn();
  } catch (e) {
    return { __error: e.message };
  }
}

// --------------- validators ---------------

function validateVocab(data, level, fileName) {
  console.log(`\n--- Vocab: ${fileName} ---`);

  if (!data || !Array.isArray(data)) {
    error(`${fileName}: data is not an array`);
    return 0;
  }

  const requiredFields = ['w', 'r', 'm', 'c'];
  const seenWords = new Map(); // word -> index for duplicate check
  let errorCount = 0;

  data.forEach((entry, idx) => {
    // Check required fields
    for (const field of requiredFields) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
        error(`${fileName}[${idx}]: missing required field "${field}" (word: ${entry.w || '?'})`);
        errorCount++;
      }
    }

    // Check for duplicates by word
    if (entry.w) {
      const key = entry.w;
      if (seenWords.has(key)) {
        warn(`${fileName}[${idx}]: duplicate word "${key}" (first at index ${seenWords.get(key)})`);
      } else {
        seenWords.set(key, idx);
      }
    }

    // Check readings are hiragana only
    if (entry.r && !isHiraganaOnly(entry.r)) {
      error(`${fileName}[${idx}]: reading "${entry.r}" contains non-hiragana characters (word: ${entry.w})`);
      errorCount++;
    }
  });

  info(`Total entries: ${data.length}`);
  if (errorCount === 0) {
    info(`All entries valid`);
  }

  return data.length;
}

function validateGrammar(data, level, fileName) {
  console.log(`\n--- Grammar: ${fileName} ---`);

  if (!data || !Array.isArray(data)) {
    error(`${fileName}: data is not an array`);
    return 0;
  }

  const requiredFields = ['id', 'cat', 't', 'p', 'ex', 'eg'];
  const seenIds = new Map(); // id -> index for duplicate check
  let errorCount = 0;

  data.forEach((entry, idx) => {
    // Check required fields
    for (const field of requiredFields) {
      if (entry[field] === undefined || entry[field] === null) {
        error(`${fileName}[${idx}]: missing required field "${field}" (id: ${entry.id || '?'})`);
        errorCount++;
      }
    }

    // Check eg is an array with at least 1 example
    if (entry.eg) {
      if (!Array.isArray(entry.eg)) {
        error(`${fileName}[${idx}]: "eg" is not an array (id: ${entry.id})`);
        errorCount++;
      } else if (entry.eg.length === 0) {
        warn(`${fileName}[${idx}]: "eg" is empty (id: ${entry.id})`);
      } else {
        // Check each example has j and z
        entry.eg.forEach((ex, exIdx) => {
          if (!ex.j) {
            error(`${fileName}[${idx}].eg[${exIdx}]: missing "j" (Japanese) (id: ${entry.id})`);
            errorCount++;
          }
          if (ex.z === undefined || ex.z === null) {
            error(`${fileName}[${idx}].eg[${exIdx}]: missing "z" (Chinese) (id: ${entry.id})`);
            errorCount++;
          }
        });
      }
    }

    // Check for duplicate IDs
    if (entry.id) {
      if (seenIds.has(entry.id)) {
        error(`${fileName}[${idx}]: duplicate id "${entry.id}" (first at index ${seenIds.get(entry.id)})`);
        errorCount++;
      } else {
        seenIds.set(entry.id, idx);
      }
    }
  });

  // Count examples
  const totalExamples = data.reduce((sum, g) => sum + (g.eg ? g.eg.length : 0), 0);
  info(`Total grammar points: ${data.length}`);
  info(`Total examples: ${totalExamples}`);
  info(`Average examples per grammar: ${(totalExamples / data.length).toFixed(1)}`);

  if (errorCount === 0) {
    info(`All entries valid`);
  }

  return data.length;
}

// --------------- main ---------------

function main() {
  console.log('=== Deguchi N5 Notes - Data Validation ===\n');

  const stats = {
    vocab: {},
    grammar: {},
  };

  // --- Vocab files ---
  const vocabFiles = [
    { file: 'vocab-n5.js', varName: 'VOCAB_N5', level: 'N5' },
    { file: 'vocab-n4.js', varName: 'VOCAB_N4', level: 'N4' },
    { file: 'vocab-n3.js', varName: 'VOCAB_N3', level: 'N3' },
    { file: 'vocab-n2.js', varName: 'VOCAB_N2', level: 'N2' },
  ];

  for (const { file, varName, level } of vocabFiles) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.log(`\n--- Vocab: ${file} --- (not found, skipping)`);
      continue;
    }

    const exports = loadJSFile(filePath);

    if (exports.__error) {
      console.log(`\n--- Vocab: ${file} ---`);
      error(`Syntax error: ${exports.__error}`);
      continue;
    }

    const data = exports[varName];
    if (!data) {
      console.log(`\n--- Vocab: ${file} ---`);
      error(`Variable "${varName}" not found in file`);
      continue;
    }

    stats.vocab[level] = validateVocab(data, level, file);
  }

  // --- Grammar files ---
  const grammarFiles = [
    { file: 'grammar-n3.js', varName: 'N3', level: 'N3' },
    { file: 'grammar-n2.js', varName: 'N2', level: 'N2' },
  ];

  for (const { file, varName, level } of grammarFiles) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.log(`\n--- Grammar: ${file} --- (not found, skipping)`);
      continue;
    }

    const exports = loadJSFile(filePath);

    if (exports.__error) {
      console.log(`\n--- Grammar: ${file} ---`);
      error(`Syntax error: ${exports.__error}`);
      continue;
    }

    const data = exports[varName];
    if (!data) {
      console.log(`\n--- Grammar: ${file} ---`);
      error(`Variable "${varName}" not found in file`);
      continue;
    }

    stats.grammar[level] = validateGrammar(data, level, file);
  }

  // --- Summary ---
  console.log('\n=== Summary ===');
  console.log('\nVocabulary:');
  for (const [level, count] of Object.entries(stats.vocab)) {
    console.log(`  ${level}: ${count} words`);
  }
  const totalVocab = Object.values(stats.vocab).reduce((a, b) => a + b, 0);
  console.log(`  Total: ${totalVocab} words`);

  console.log('\nGrammar:');
  for (const [level, count] of Object.entries(stats.grammar)) {
    console.log(`  ${level}: ${count} grammar points`);
  }
  const totalGrammar = Object.values(stats.grammar).reduce((a, b) => a + b, 0);
  console.log(`  Total: ${totalGrammar} grammar points`);

  console.log(`\nErrors: ${totalErrors}`);
  console.log(`Warnings: ${totalWarnings}`);

  if (totalErrors > 0) {
    console.log('\nValidation FAILED');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED');
    process.exit(0);
  }
}

main();
