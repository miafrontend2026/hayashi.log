// ========== QUIZ MODE ==========
const Quiz = (() => {
  let questions = [];
  let current = 0;
  let score = 0;
  let results = [];
  let quizType = 'word2meaning';
  let quizLevel = 'n5';
  let showKanji = false; // word2meaning 題型：預設隱藏漢字（較難、測真實能力）

  function start() {
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3 style="margin-bottom:8px">${t('quiz_title')}</h3>
      <div class="qf"><label>${t('quiz_level')}</label><div class="qo" id="qLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button><button data-v="n1">N1</button>
      </div></div>
      <div class="qf"><label>${t('quiz_type')}</label><div class="qo" id="qType">
        <button class="on" data-v="word2meaning">${t('type_ja_zh')}</button>
        <button data-v="meaning2word">${t('type_zh_ja')}</button>
        <button data-v="reading">${t('type_reading')}</button>
      </div></div>
      <div class="qf"><label>${t('quiz_count')}</label><div class="qo" id="qCount">
        <button data-v="10">10</button><button class="on" data-v="20">20</button><button data-v="50">50</button>
      </div></div>
      <button class="qstart" onclick="Quiz.begin()">${t('quiz_start')}</button>
      <button class="qclose" onclick="Quiz.close()">${t('quiz_cancel')}</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');
  }

  function begin() {
    const lvEl = document.querySelector('#qLevel .on');
    const tyEl = document.querySelector('#qType .on');
    const ctEl = document.querySelector('#qCount .on');
    // If called from results page (no selectors), reuse last settings
    if (lvEl) quizLevel = lvEl.dataset.v;
    if (tyEl) quizType = tyEl.dataset.v;
    const count = ctEl ? parseInt(ctEl.dataset.v) : (questions.length || 20);
    const data = getVocabData(quizLevel);
    if (!data || !data.length) { alert(t('quiz_no_data')); return; }
    score = 0; current = 0; results = [];
    questions = generate(data, count);
    renderQ();
  }

  function generate(data, count) {
    // 選讀音題型：排除純假名詞（w === r），否則題目和正解同形沒意義
    const source = quizType === 'reading' ? data.filter(d => d.w !== d.r) : data;
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, shuffled.length));
    return picked.map(word => {
      const pool = data.filter(d => {
        if (quizType === 'word2meaning') return d.m !== word.m;
        if (quizType === 'meaning2word') return d.w !== word.w;
        return d.r !== word.r;
      }).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [word, ...pool].sort(() => Math.random() - 0.5);
      return { word, options, correctIdx: options.indexOf(word) };
    });
  }

  function disp(item) {
    if (quizType === 'word2meaning') return typeof cvt==='function'?cvt(item.m):item.m;
    if (quizType === 'meaning2word') return item.w + (item.w !== item.r ? '（' + item.r + '）' : '');
    return item.r;
  }

  function renderQ() {
    const q = questions[current];
    const box = document.getElementById('quizBox');
    let main, sub;
    // 看日選中：可切換顯示/隱藏漢字（隱藏較難、避免華人用漢字字形直接猜中譯）
    if (quizType === 'word2meaning') {
      if (showKanji) { main = q.word.w; sub = q.word.w !== q.word.r ? q.word.r : ''; }
      else { main = q.word.r; sub = ''; }
    }
    else if (quizType === 'meaning2word') { main = typeof cvt==='function'?cvt(q.word.m):q.word.m; sub = ''; }
    else { main = q.word.w; sub = t('quiz_reading_sub'); }
    const kanjiToggle = quizType === 'word2meaning' ?
      `<button onclick="Quiz.toggleKanji()" style="margin-top:8px;font-size:11px;padding:4px 10px;border:1px solid var(--bd);border-radius:6px;background:var(--bg2);color:var(--tx2);cursor:pointer">${showKanji?'🙈 隱藏漢字':'👁 顯示漢字'}</button>` : '';
    box.innerHTML = `
      <div class="qhd"><span>${current+1} / ${questions.length}</span><span>${t('quiz_score', { n: score })}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Quiz.close()">✕</button></div>
      <div class="qprompt"><div class="qmain">${main}</div>${sub?'<div class="qsub">'+sub+'</div>':''}<div style="margin-top:6px"><svg class="spk" style="width:22px;height:22px;opacity:.5" onclick="speak('${(q.word.r || q.word.w).replace(/'/g,"\\'")}')" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg></div>${kanjiToggle}</div>
      <div class="qopts">${q.options.map((o,i) => '<button class="qopt" onclick="Quiz.answer('+i+')">'+disp(o)+'</button>').join('')}</div>`;
  }

  function answer(idx) {
    const q = questions[current];
    const correct = idx === q.correctIdx;
    if (correct) score++;
    results.push({ word: q.word, correct, chosenIdx: idx, options: q.options, correctIdx: q.correctIdx });
    if (typeof SRS !== 'undefined' && SRS.record) SRS.record(quizLevel, q.word.w, correct);
    if (!correct && typeof Stats !== 'undefined' && Stats.addToNotebook) Stats.addToNotebook(q.word.w, q.word.r, q.word.m, quizLevel);
    const opts = document.querySelectorAll('.qopt');
    opts.forEach((b, i) => { b.disabled = true; if (i === q.correctIdx) b.classList.add('qcorrect'); if (i === idx && !correct) b.classList.add('qwrong'); });
    setTimeout(() => { current++; current >= questions.length ? showResults() : renderQ(); }, correct ? 500 : 1000);
  }

  function showResults() {
    const pct = Math.round(score / questions.length * 100);
    const h = JSON.parse(localStorage.getItem('quiz_history') || '[]');
    h.push({ date: new Date().toISOString(), level: quizLevel, type: quizType, score, total: questions.length });
    if (h.length > 200) h.splice(0, h.length - 200);
    localStorage.setItem('quiz_history', JSON.stringify(h));
    if (typeof Calendar !== 'undefined') Calendar.logActivity('quiz');
    if (typeof saveQuizCloud === 'function') saveQuizCloud();
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3>${t('quiz_result')}</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${score} / ${questions.length}（${pct}%）</div>
      <div class="qresults">${results.map(r => {
        // 一律顯示完整三要素：漢字（讀音）— 中譯，讓使用者看到全貌
        const m = typeof cvt==='function' ? cvt(r.word.m) : r.word.m;
        const wFull = r.word.w + (r.word.w !== r.word.r ? '（'+r.word.r+'）' : '');
        const summary = wFull + ' — ' + m;
        if (r.correct) return '<div class="qr ok"><span class="qrc">✓</span> '+summary+'</div>';
        // 錯題：依題型顯示正確答案（讀音題→讀音、中選日→漢字、看日選中→中譯）
        const correctAnswer = disp(r.word);
        return `<div class="qr ng"><span class="qrc">✗</span> ${summary}　${t('quiz_you_chose', { chose: disp(r.options[r.chosenIdx]), correct: correctAnswer })}</div>`;
      }).join('')}</div>
      <div class="qactions"><button class="qstart" onclick="Quiz.begin()">${t('quiz_retry')}</button><button class="qclose" onclick="Quiz.close()">${t('quiz_back')}</button></div>`;
  }

  function close() { document.getElementById('quizBg').classList.remove('show'); }
  function toggleKanji() { showKanji = !showKanji; renderQ(); }

  return { start, begin, answer, close, toggleKanji };
})();
