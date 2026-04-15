#!/usr/bin/env node
/**
 * md-to-json.js
 * Converts markdown grammar notes to the website's JS data format.
 *
 * Usage: node scripts/md-to-json.js <input.md> <level>
 *   level: n2, n3, n4, n5
 *
 * Input format (markdown):
 *   # N3 文法
 *   ## ～において
 *   - 接続: 名詞＋において
 *   - 意味: 在～
 *   - 例文: 大阪において会議が行われた。(在大阪舉行了會議。)
 *   - 例文: 現代社会における問題は複雑だ。(現代社會中的問題很複雜。)
 *
 * Output: Appends to the appropriate grammar-<level>.js file.
 */

const fs = require('fs');
const path = require('path');

// --------------- helpers ---------------

function usage() {
  console.error('Usage: node scripts/md-to-json.js <input.md> <level>');
  console.error('  level: n2 | n3 | n4 | n5');
  process.exit(1);
}

function slugify(title) {
  // Remove leading ～ and special chars for a simple slug
  return title.replace(/[～〜・]/g, '').trim();
}

/**
 * Parse a single example line.
 * Format: "日本語の文。(中文翻譯。)"
 * Returns {j, z} or null.
 */
function parseExample(line) {
  // Try to match: Japanese sentence (Chinese translation)
  const m = line.match(/^(.+?)[（(](.+?)[）)]$/);
  if (m) {
    return { j: m[1].trim(), z: m[2].trim() };
  }
  // Fallback: treat the whole line as Japanese with empty Chinese
  if (line.trim()) {
    return { j: line.trim(), z: '' };
  }
  return null;
}

/**
 * Auto-wrap grammar point in <em> tags inside an example sentence.
 * Tries to find the grammar pattern (without ～) in the sentence.
 */
function autoHighlight(sentence, grammarTitle) {
  // Extract core pattern(s) from title like ～において・～における
  const patterns = grammarTitle
    .split(/[・／]/)
    .map(p => p.replace(/[～〜]/g, '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first

  let result = sentence;
  for (const pat of patterns) {
    if (result.includes(pat) && !result.includes('<em>')) {
      result = result.replace(pat, `<em>${pat}</em>`);
      break;
    }
  }
  return result;
}

// --------------- main parse logic ---------------

function parseMarkdown(mdContent) {
  const lines = mdContent.split('\n');
  const entries = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();

    // ## heading = new grammar point
    if (line.startsWith('## ')) {
      if (current) entries.push(current);
      current = {
        title: line.slice(3).trim(),
        connection: '',
        meaning: '',
        category: '',
        examples: [],
      };
      continue;
    }

    if (!current) continue;

    // - 接続: ...
    if (line.match(/^-\s*接続[:：]/)) {
      current.connection = line.replace(/^-\s*接続[:：]\s*/, '').trim();
    }
    // - 意味: ...
    else if (line.match(/^-\s*意味[:：]/)) {
      current.meaning = line.replace(/^-\s*意味[:：]\s*/, '').trim();
    }
    // - カテゴリ: ...
    else if (line.match(/^-\s*(カテゴリ|分類|cat)[:：]/i)) {
      current.category = line.replace(/^-\s*(カテゴリ|分類|cat)[:：]\s*/i, '').trim();
    }
    // - 例文: ...
    else if (line.match(/^-\s*例文[:：]/)) {
      const exText = line.replace(/^-\s*例文[:：]\s*/, '').trim();
      const ex = parseExample(exText);
      if (ex) current.examples.push(ex);
    }
  }

  if (current) entries.push(current);
  return entries;
}

function entriesToJS(entries, level) {
  const varName = level.toUpperCase(); // N3, N2, etc.

  // Read existing file to determine next ID number
  const targetFile = path.join(__dirname, '..', `grammar-${level}.js`);
  let nextId = 1;

  if (fs.existsSync(targetFile)) {
    const existing = fs.readFileSync(targetFile, 'utf8');
    const idPattern = new RegExp(`"${level}-(\\d+)"`, 'g');
    let m;
    while ((m = idPattern.exec(existing)) !== null) {
      const num = parseInt(m[1], 10);
      if (num >= nextId) nextId = num + 1;
    }
  }

  const jsEntries = entries.map((entry, idx) => {
    const id = `${level}-${nextId + idx}`;
    const cat = entry.category || 'その他';
    const t = entry.title;
    const p = entry.connection;
    const ex = entry.meaning ? `「${entry.meaning}」。` : '';

    // Build eg array with auto-highlighting
    const eg = entry.examples.map(e => {
      const highlighted = autoHighlight(e.j, t);
      return `{j:"${highlighted}",z:"${e.z}"}`;
    });

    return `{id:"${id}",cat:"${cat}",t:"${t}",p:"${p}",ex:"${ex}",eg:[${eg.join(',')}]}`;
  });

  return jsEntries;
}

// --------------- main ---------------

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const inputFile = args[0];
  const level = args[1].toLowerCase();

  if (!['n2', 'n3', 'n4', 'n5'].includes(level)) {
    console.error(`Error: level must be n2, n3, n4, or n5. Got: ${level}`);
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: input file not found: ${inputFile}`);
    process.exit(1);
  }

  const mdContent = fs.readFileSync(inputFile, 'utf8');
  const entries = parseMarkdown(mdContent);

  if (entries.length === 0) {
    console.error('No grammar entries found in the markdown file.');
    process.exit(1);
  }

  console.log(`Parsed ${entries.length} grammar entries from ${inputFile}`);

  const jsEntries = entriesToJS(entries, level);
  const targetFile = path.join(__dirname, '..', `grammar-${level}.js`);

  if (!fs.existsSync(targetFile)) {
    console.error(`Error: target file not found: ${targetFile}`);
    console.error('Please create the grammar file first.');
    process.exit(1);
  }

  // Read existing file content
  let content = fs.readFileSync(targetFile, 'utf8');

  // Find the closing ]; of the array and insert before it
  const varName = level.toUpperCase();
  const arrayClosePattern = /\n\];\s*\n/;
  const match = content.match(arrayClosePattern);

  if (!match) {
    console.error('Error: could not find array closing ]; in target file.');
    process.exit(1);
  }

  const insertPos = content.indexOf(match[0]);
  const newEntries = jsEntries.map(e => ',' + '\n' + e).join('');

  content = content.slice(0, insertPos) + newEntries + content.slice(insertPos);

  fs.writeFileSync(targetFile, content, 'utf8');
  console.log(`Appended ${jsEntries.length} entries to ${targetFile}`);

  // Show what was added
  jsEntries.forEach((e, i) => {
    console.log(`  [${i + 1}] ${entries[i].title}`);
  });
}

main();
