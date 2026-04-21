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
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">${t('gd_title')}</h3><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="qf"><label>${t('gd_mode')}</label><div class="qo" id="gdMode">
        <button class="on" data-v="flash">${t('gd_flip_mode')}</button>
        <button data-v="quiz">${t('gd_quiz_mode')}</button>
      </div></div>
      <div class="qf"><label>${t('quiz_level')}</label><div class="qo" id="gdLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button><button data-v="n1">N1</button>
      </div></div>
      <div class="qf"><label>${t('gd_range')}</label><div class="qo" id="gdRange">
        <button data-v="due" class="on">${t('gd_range_due')}</button>
        <button data-v="new">${t('gd_range_new')}</button>
        <button data-v="all">${t('gd_range_all')}</button>
      </div></div>
      <button class="qstart" onclick="GrammarDrill.begin()">${t('gd_start')}</button>
      <button class="qclose" onclick="GrammarDrill.close()">${t('gd_cancel')}</button>`;
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
    if (!data || !data.length) { alert(t('gd_no_data')); return; }
    const srs = getSRS();
    const todayStr = today();

    if (range === 'due') {
      queue = data.filter(d => { const e = srs[d.id]; return e && e.nextReview <= todayStr; });
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

    if (!queue.length) { alert(t('gd_no_match')); return; }
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
      <div class="qhd"><span>${t('grammar')} ${cur+1} / ${queue.length}</span><span>${isNew?t('gd_new'):t('gd_review')}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="srs-card" onclick="GrammarDrill.flip()">
        <div id="gdFront">
          <div class="qmain" style="font-size:22px">${g.t}</div>
          <div class="srs-hint">${t('gd_flip_hint')}</div>
        </div>
        <div id="gdBack" style="display:none">
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">${g.t}</div>
          <div style="background:#FEF3C7;border-radius:7px;padding:8px 12px;font-size:14px;font-weight:600;color:#92400E;border-left:3px solid #D97706;margin:8px 0">${g.p}</div>
          <div style="font-size:13px;color:#334155;margin:8px 0;line-height:1.7">${typeof cvt==='function'?cvt(g.ex):g.ex}</div>
          <div style="margin:8px 0;font-size:13px">${g.eg.map(e=>{
            const pureJ = e.j.replace(/<[^>]+>/g,'').replace(/'/g,"\\'");
            const spk = `<svg class="spk-inline" style="width:16px;height:16px;cursor:pointer;vertical-align:middle;margin-left:4px;stroke:#2563EB;fill:none;stroke-width:2;opacity:.7" onclick="event.stopPropagation();speak('${pureJ}')" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg>`;
            const z = typeof cvt==='function' ? cvt(e.z) : e.z;
            return '<div style="padding:3px 0"><span style="color:#2563EB">'+e.j+'</span>'+spk+'<br><span style="color:#64748B;font-size:12px">'+z+'</span></div>';
          }).join('')}</div>
          <div class="srs-btns">
            <button class="srs-btn srs-hard" onclick="event.stopPropagation();GrammarDrill.rate(false)">${t('gd_hard')}</button>
            <button class="srs-btn srs-ok" onclick="event.stopPropagation();GrammarDrill.rate(true)">${t('gd_ok')}</button>
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
      <h3>${t('gd_done')}</h3>
      <div class="srs-done-stats">
        <div>${t('gd_today', { n: queue.length })}</div>
        <div>${t('gd_motivate')}</div>
      </div>
      <div class="qactions"><button class="qstart" onclick="GrammarDrill.begin()">${t('gd_retry')}</button><button class="qclose" onclick="GrammarDrill.close()">${t('gd_back')}</button></div>`;
  }

  // ── Grammar Quiz Mode (fill-in-blank) ──
  // 正確做法：給例句挖空，選項是 4 個「真的可以填空的日文表達」，不是文法點名稱。
  // 正解取自當題文法例句的 <em>…</em>；誤答從同級別其他文法的 <em>…</em> 抽 3 個。
  let gqScore = 0, gqResults = [];
  function extractEm(j) {
    const m = j.match(/<em>(.*?)<\/em>/);
    return m ? m[1] : null;
  }
  function renderQuizQ() {
    const g = queue[cur];
    const eg = g.eg && g.eg[0];
    const answer = eg ? extractEm(eg.j) : null;
    // Fallback：若無 <em> 標記，退回用文法名稱當答案（少見）
    if (!answer) {
      cur++;
      if (cur >= queue.length) return showQuizResults();
      return renderQuizQ();
    }
    const allGrammar = getData(lvl);
    // 蒐集同級別其他文法的 <em> 片段，當誤答候選
    const distractPool = [];
    allGrammar.forEach(x => {
      if (x.id === g.id) return;
      x.eg && x.eg.forEach(e => {
        const s = extractEm(e.j);
        if (s && s !== answer && !distractPool.includes(s)) distractPool.push(s);
      });
    });
    const wrong = distractPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [answer, ...wrong].sort(() => Math.random() - 0.5);
    const correctIdx = options.indexOf(answer);
    const blanked = eg.j.replace(/<em>(.*?)<\/em>/, '＿＿＿＿');
    const pureJ = blanked.replace(/<[^>]+>/g, '').replace(/'/g, "\\'");
    const spk = `<svg class="spk-inline" style="width:18px;height:18px;cursor:pointer;vertical-align:middle;margin-left:6px;stroke:var(--ac2);fill:none;stroke-width:2" onclick="speak('${pureJ}')" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg>`;
    document.getElementById('quizBox').innerHTML = `
      <div class="qhd"><span>${t('gd_quiz_mode')} ${cur+1} / ${queue.length}</span><span>${t('quiz_score', { n: gqScore })}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="GrammarDrill.close()">✕</button></div>
      <div class="qprompt"><div style="font-size:16px;line-height:1.8;color:var(--tx)">${blanked}${spk}</div><div style="font-size:12px;color:var(--tx2);margin-top:4px">${typeof cvt==='function'?cvt(eg.z):eg.z}</div></div>
      <div class="qopts">${options.map((o, i) => '<button class="qopt" onclick="GrammarDrill.answerQuiz('+i+','+correctIdx+')">'+o+'</button>').join('')}</div>`;
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
      <h3>${t('gd_result')}</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${gqScore} / ${queue.length}（${pct}%）</div>
      <div class="qactions"><button class="qstart" onclick="GrammarDrill.begin()">${t('quiz_retry')}</button><button class="qclose" onclick="GrammarDrill.close()">${t('quiz_back')}</button></div>`;
  }

  function close() { document.getElementById('quizBg').classList.remove('show'); }

  return { start, begin, flip, rate, answerQuiz, close };
})();
