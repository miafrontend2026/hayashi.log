// ========== GRAMMAR DRILL ==========
// Flashcard-style grammar review with spaced repetition
const GrammarDrill = (() => {
  const GKEY = 'grammar_srs';
  let queue = [], cur = 0, lvl = 'n5';

  function getData(lv) {
    if (lv === 'n5') return typeof N5 !== 'undefined' ? N5 : [];
    if (lv === 'n4') return typeof N4 !== 'undefined' ? N4 : [];
    if (lv === 'n3') return typeof N3 !== 'undefined' ? N3 : [];
    if (lv === 'n2') return typeof N2 !== 'undefined' ? N2 : [];
    return [];
  }

  function getSRS() { try { return JSON.parse(localStorage.getItem(GKEY)) || {}; } catch(e) { return {}; } }
  function saveSRS(d) { localStorage.setItem(GKEY, JSON.stringify(d)); if (typeof saveAllCloud === 'function') saveAllCloud(); }
  function today() { return new Date().toISOString().split('T')[0]; }

  function record(id, correct) {
    const d = getSRS();
    const e = d[id] || { interval: 0, ease: 2.5, nextReview: today(), reviews: 0, correct: 0 };
    e.reviews++;
    if (correct) {
      e.correct++;
      if (e.interval === 0) e.interval = 1;
      else if (e.interval === 1) e.interval = 3;
      else e.interval = Math.round(e.interval * e.ease);
      e.ease = Math.max(1.3, e.ease + 0.1);
    } else {
      e.interval = 1;
      e.ease = Math.max(1.3, e.ease - 0.2);
    }
    const nd = new Date(); nd.setDate(nd.getDate() + e.interval);
    e.nextReview = nd.toISOString().split('T')[0];
    e.lastReview = today();
    d[id] = e;
    saveSRS(d);
  }

  function start() {
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">文法練習</h3><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="qf"><label>模式</label><div class="qo" id="gdMode">
        <button class="on" data-v="flash">翻牌記憶</button>
        <button data-v="quiz">選擇題測驗</button>
      </div></div>
      <div class="qf"><label>級別</label><div class="qo" id="gdLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button><button data-v="n1">N1</button>
      </div></div>
      <div class="qf"><label>範圍</label><div class="qo" id="gdRange">
        <button data-v="due" class="on">待複習</button>
        <button data-v="new">新的</button>
        <button data-v="all">全部隨機</button>
      </div></div>
      <button class="qstart" onclick="GrammarDrill.begin()">開始</button>
      <button class="qclose" onclick="GrammarDrill.close()">取消</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');
  }

  let quizMode = 'flash';
  function begin() {
    const modeEl = document.querySelector('#gdMode .on');
    quizMode = modeEl ? modeEl.dataset.v : quizMode;
    const lvEl = document.querySelector('#gdLevel .on');
    if (lvEl) lvl = lvEl.dataset.v;
    const rangeEl = document.querySelector('#gdRange .on');
    const range = rangeEl ? rangeEl.dataset.v : 'all';
    const data = getData(lvl);
    if (!data || !data.length) { alert('此級別無文法資料'); return; }
    const srs = getSRS();
    const t = today();

    if (range === 'due') {
      queue = data.filter(d => { const e = srs[d.id]; return e && e.nextReview <= t; });
      if (!queue.length) {
        // Add some new ones if no due
        const learned = new Set(Object.keys(srs));
        const nw = data.filter(d => !learned.has(d.id)).slice(0, 10);
        queue = nw;
      }
    } else if (range === 'new') {
      const learned = new Set(Object.keys(srs));
      queue = data.filter(d => !learned.has(d.id)).slice(0, 15);
    } else {
      queue = [...data].sort(() => Math.random() - 0.5).slice(0, 20);
    }

    if (!queue.length) { alert('沒有符合條件的文法點！'); return; }
    cur = 0;
    gqScore = 0; gqResults = [];
    if (quizMode === 'quiz') { renderQuizQ(); return; }
    renderCard();
  }

  function renderCard() {
    const g = queue[cur];
    const srs = getSRS();
    const e = srs[g.id];
    const isNew = !e;
    document.getElementById('quizBox').innerHTML = `
      <div class="qhd"><span>文法 ${cur+1} / ${queue.length}</span><span>${isNew?'🆕 新文法':'📖 複習'}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="srs-card" onclick="GrammarDrill.flip()">
        <div id="gdFront">
          <div class="qmain" style="font-size:22px">${g.t}</div>
          <div class="srs-hint">看到文法名，試著回想接續和意思 → 點擊翻面</div>
        </div>
        <div id="gdBack" style="display:none">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">${g.t}</div>
          <div style="background:#FEF3C7;border-radius:7px;padding:8px 12px;font-size:14px;font-weight:600;color:#92400E;border-left:3px solid #D97706;margin:8px 0">${g.p}</div>
          <div style="font-size:13px;color:#334155;margin:8px 0;line-height:1.7">${g.ex}</div>
          <div style="margin:8px 0;font-size:13px">${g.eg.map(e=>'<div style="padding:3px 0"><span style="color:#2563EB">'+e.j+'</span><br><span style="color:#64748B;font-size:12px">'+e.z+'</span></div>').join('')}</div>
          <div class="srs-btns">
            <button class="srs-btn srs-hard" onclick="event.stopPropagation();GrammarDrill.rate(false)">不熟</button>
            <button class="srs-btn srs-ok" onclick="event.stopPropagation();GrammarDrill.rate(true)">記得</button>
          </div>
        </div>
      </div>`;
  }

  function flip() {
    document.getElementById('gdFront').style.display = 'none';
    document.getElementById('gdBack').style.display = '';
  }

  function rate(correct) {
    const g = queue[cur];
    record(g.id, correct);
    if (typeof Calendar !== 'undefined') Calendar.logActivity('grammar');
    cur++;
    if (cur >= queue.length) showDone(); else renderCard();
  }

  function showDone() {
    document.getElementById('quizBox').innerHTML = `
      <h3>文法練習完成！</h3>
      <div class="srs-done-stats">
        <div>今日練習：${queue.length} 個文法</div>
        <div>繼續每天複習，文法就不會忘！</div>
      </div>
      <div class="qactions"><button class="qstart" onclick="GrammarDrill.begin()">再來一輪</button><button class="qclose" onclick="GrammarDrill.close()">返回</button></div>`;
  }

  // ── Grammar Quiz Mode (multiple choice) ──
  let gqScore = 0, gqResults = [];
  function renderQuizQ() {
    const g = queue[cur];
    const allGrammar = getData(lvl);
    const wrong = allGrammar.filter(x => x.id !== g.id).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [g, ...wrong].sort(() => Math.random() - 0.5);
    const correctIdx = options.indexOf(g);
    // Show example sentence with grammar blanked out
    const eg = g.eg[0];
    const blanked = eg.j.replace(/<em>(.*?)<\/em>/, '＿＿＿＿');
    document.getElementById('quizBox').innerHTML = `
      <div class="qhd"><span>文法測驗 ${cur+1} / ${queue.length}</span><span>正確: ${gqScore}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="qprompt"><div style="font-size:16px;line-height:1.8;color:var(--tx)">${blanked}</div><div style="font-size:12px;color:var(--tx2);margin-top:4px">${eg.z}</div></div>
      <div class="qopts">${options.map((o, i) => '<button class="qopt" onclick="GrammarDrill.answerQuiz('+i+','+correctIdx+')">'+o.t+'</button>').join('')}</div>`;
  }
  function answerQuiz(idx, correctIdx) {
    const g = queue[cur];
    const correct = idx === correctIdx;
    if (correct) gqScore++;
    record(g.id, correct);
    if (typeof Calendar !== 'undefined') Calendar.logActivity('grammar');
    const opts = document.querySelectorAll('.qopt');
    opts.forEach((b, i) => { b.disabled = true; if (i === correctIdx) b.classList.add('qcorrect'); if (i === idx && !correct) b.classList.add('qwrong'); });
    setTimeout(() => { cur++; cur >= queue.length ? showQuizResults() : renderQuizQ(); }, correct ? 500 : 1000);
  }
  function showQuizResults() {
    const pct = Math.round(gqScore / queue.length * 100);
    document.getElementById('quizBox').innerHTML = `
      <h3>文法測驗結果</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${gqScore} / ${queue.length}（${pct}%）</div>
      <div class="qactions"><button class="qstart" onclick="GrammarDrill.begin()">再來一次</button><button class="qclose" onclick="GrammarDrill.close()">返回</button></div>`;
  }

  function close() { document.getElementById('quizBg').classList.remove('show'); }

  return { start, begin, flip, rate, answerQuiz, close };
})();
