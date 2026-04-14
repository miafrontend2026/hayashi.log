// ========== QUIZ MODE ==========
const Quiz = (() => {
  let questions = [];
  let current = 0;
  let score = 0;
  let results = [];
  let quizType = 'word2meaning';
  let quizLevel = 'n5';

  function start() {
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3 style="margin-bottom:8px">單字測驗</h3>
      <div class="qf"><label>級別</label><div class="qo" id="qLevel">
        <button class="on" data-v="n5">N5</button><button data-v="n4">N4</button>
        <button data-v="n3">N3</button><button data-v="n2">N2</button>
      </div></div>
      <div class="qf"><label>題型</label><div class="qo" id="qType">
        <button class="on" data-v="word2meaning">看日選中</button>
        <button data-v="meaning2word">看中選日</button>
        <button data-v="reading">選讀音</button>
      </div></div>
      <div class="qf"><label>題數</label><div class="qo" id="qCount">
        <button data-v="10">10</button><button class="on" data-v="20">20</button><button data-v="50">50</button>
      </div></div>
      <button class="qstart" onclick="Quiz.begin()">開始測驗</button>
      <button class="qclose" onclick="Quiz.close()">取消</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    document.getElementById('quizBg').classList.add('show');
  }

  function begin() {
    quizLevel = document.querySelector('#qLevel .on').dataset.v;
    quizType = document.querySelector('#qType .on').dataset.v;
    const count = parseInt(document.querySelector('#qCount .on').dataset.v);
    const data = getVocabData(quizLevel);
    if (!data || !data.length) { alert('此級別無單字資料'); return; }
    score = 0; current = 0; results = [];
    questions = generate(data, count);
    renderQ();
  }

  function generate(data, count) {
    const shuffled = [...data].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, data.length));
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
    if (quizType === 'word2meaning') return item.m;
    if (quizType === 'meaning2word') return item.w + (item.w !== item.r ? '（' + item.r + '）' : '');
    return item.r;
  }

  function renderQ() {
    const q = questions[current];
    const box = document.getElementById('quizBox');
    let main, sub;
    if (quizType === 'word2meaning') { main = q.word.w; sub = q.word.w !== q.word.r ? q.word.r : ''; }
    else if (quizType === 'meaning2word') { main = q.word.m; sub = ''; }
    else { main = q.word.w; sub = '選出正確讀音'; }
    box.innerHTML = `
      <div class="qhd"><span>${current+1} / ${questions.length}</span><span>正確: ${score}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Quiz.close()">✕</button></div>
      <div class="qprompt"><div class="qmain">${main}</div>${sub?'<div class="qsub">'+sub+'</div>':''}</div>
      <div class="qopts">${q.options.map((o,i) => '<button class="qopt" onclick="Quiz.answer('+i+')">'+disp(o)+'</button>').join('')}</div>`;
  }

  function answer(idx) {
    const q = questions[current];
    const correct = idx === q.correctIdx;
    if (correct) score++;
    results.push({ word: q.word, correct, chosenIdx: idx, options: q.options, correctIdx: q.correctIdx });
    if (typeof SRS !== 'undefined' && SRS.record) SRS.record(quizLevel, q.word.w, correct);
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
    if (typeof saveQuizCloud === 'function') saveQuizCloud();
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <h3>測驗結果</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${score} / ${questions.length}（${pct}%）</div>
      <div class="qresults">${results.map(r => r.correct
        ? '<div class="qr ok"><span class="qrc">✓</span> '+r.word.w+' — '+r.word.m+'</div>'
        : '<div class="qr ng"><span class="qrc">✗</span> '+r.word.w+' — 你選: '+disp(r.options[r.chosenIdx])+' → 正確: '+r.word.m+'</div>'
      ).join('')}</div>
      <div class="qactions"><button class="qstart" onclick="Quiz.begin()">再來一次</button><button class="qclose" onclick="Quiz.close()">返回</button></div>`;
  }

  function close() { document.getElementById('quizBg').classList.remove('show'); }

  return { start, begin, answer, close };
})();
