// ========== LEARNING STATS ==========
const Stats = (() => {
  function getHistory() {
    try { return JSON.parse(localStorage.getItem('quiz_history')) || []; } catch(e) { return []; }
  }
  function getSRS() {
    try { return JSON.parse(localStorage.getItem('srs_data')) || {}; } catch(e) { return {}; }
  }

  function open() {
    const box = document.getElementById('quizBox');
    box.innerHTML = buildHTML();
    document.getElementById('quizBg').classList.add('show');
  }

  function close() {
    document.getElementById('quizBg').classList.remove('show');
  }

  function buildHTML() {
    let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="margin:0">學習統計</h3><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Stats.close()">✕</button></div>';
    h += buildScoreChart();
    h += buildProgress();
    h += buildWeakWords();
    return h;
  }

  // ── 測驗成績走勢 ──
  function buildScoreChart() {
    const hist = getHistory();
    if (!hist.length) return '<div class="st-section"><div class="st-title">測驗成績</div><div class="st-empty">還沒有測驗紀錄，去測驗看看吧！</div></div>';

    const last20 = hist.slice(-20);
    const pcts = last20.map(h => Math.round(h.score / h.total * 100));
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const max = Math.max(...pcts);
    const recent = pcts[pcts.length - 1];

    let bars = '<div class="st-bars">';
    pcts.forEach((p, i) => {
      const item = last20[i];
      const color = p >= 80 ? '#16a34a' : p >= 60 ? '#ca8a04' : '#dc2626';
      const date = new Date(item.date).toLocaleDateString('zh-TW', {month:'numeric',day:'numeric'});
      bars += '<div class="st-bar-wrap" title="' + date + ' ' + item.level.toUpperCase() + ' ' + p + '%">' +
        '<div class="st-bar" style="height:' + p + '%;background:' + color + '"></div>' +
        '<div class="st-bar-lbl">' + p + '</div></div>';
    });
    bars += '</div>';

    return '<div class="st-section"><div class="st-title">測驗成績</div>' + bars +
      '<div class="st-row"><span>最近：' + recent + '%</span><span>平均：' + avg + '%</span><span>最高：' + max + '%</span><span>共 ' + hist.length + ' 次</span></div></div>';
  }

  // ── 學習進度 ──
  function buildProgress() {
    const srs = getSRS();
    const levels = ['n5', 'n4', 'n3', 'n2'];
    let h = '<div class="st-section"><div class="st-title">學習進度</div>';

    levels.forEach(lv => {
      const total = getVocabData(lv).length;
      if (!total) return;
      const entries = Object.entries(srs).filter(([k]) => k.startsWith(lv + ':'));
      const learned = entries.length;
      const mastered = entries.filter(([, v]) => v.interval >= 21).length;
      const learning = entries.filter(([, v]) => v.interval > 0 && v.interval < 21).length;
      const pct = total ? Math.round(learned / total * 100) : 0;
      const masteredPct = total ? Math.round(mastered / total * 100) : 0;

      h += '<div class="st-prog">' +
        '<div class="st-prog-hd"><span class="st-prog-lv">' + lv.toUpperCase() + '</span>' +
        '<span class="st-prog-num">' + learned + ' / ' + total + '</span></div>' +
        '<div class="st-prog-bar"><div class="st-prog-fill st-prog-mastered" style="width:' + masteredPct + '%"></div>' +
        '<div class="st-prog-fill st-prog-learning" style="width:' + (pct - masteredPct) + '%"></div></div>' +
        '<div class="st-prog-legend">' +
        '<span class="st-dot st-dot-mastered"></span>已掌握 ' + mastered +
        '<span class="st-dot st-dot-learning"></span>學習中 ' + learning +
        '<span class="st-dot st-dot-new"></span>未學 ' + (total - learned) +
        '</div></div>';
    });

    h += '</div>';
    return h;
  }

  // ── 弱點單字 ──
  function buildWeakWords() {
    const srs = getSRS();
    const weak = [];

    Object.entries(srs).forEach(([key, val]) => {
      if (val.reviews >= 2) {
        const rate = Math.round(val.correct / val.reviews * 100);
        if (rate < 70) {
          const parts = key.split(':');
          const lv = parts[0];
          const word = parts.slice(1).join(':');
          const vocab = getVocabData(lv).find(v => v.w === word);
          if (vocab) weak.push({ ...vocab, level: lv, rate, reviews: val.reviews });
        }
      }
    });

    weak.sort((a, b) => a.rate - b.rate);
    const top20 = weak.slice(0, 20);

    if (!top20.length) {
      return '<div class="st-section"><div class="st-title">弱點單字</div>' +
        '<div class="st-empty">還沒有發現弱點單字。多做幾次測驗後這裡會顯示你最需要加強的詞！</div></div>';
    }

    let h = '<div class="st-section"><div class="st-title">弱點單字 <span style="font-weight:400;font-size:12px;color:#64748B">（正確率 &lt; 70%）</span></div>';
    h += '<div class="st-weak-list">';
    top20.forEach(w => {
      const rateColor = w.rate < 40 ? '#dc2626' : '#ca8a04';
      h += '<div class="st-weak-item">' +
        '<span class="st-weak-word">' + w.w + '</span>' +
        '<span class="st-weak-reading">' + (w.w !== w.r ? w.r : '') + '</span>' +
        '<span class="st-weak-meaning">' + w.m + '</span>' +
        '<span class="st-weak-rate" style="color:' + rateColor + '">' + w.rate + '%</span>' +
        '<span class="st-weak-lv">' + w.level.toUpperCase() + '</span></div>';
    });
    h += '</div>';

    if (weak.length > 0) {
      h += '<button class="qstart" style="margin-top:12px" onclick="Stats.quizWeak()">弱點單字測驗（' + Math.min(weak.length, 20) + ' 題）</button>';
    }
    h += '</div>';
    return h;
  }

  // 弱點測驗
  function quizWeak() {
    const srs = getSRS();
    const weak = [];
    Object.entries(srs).forEach(([key, val]) => {
      if (val.reviews >= 1) {
        const rate = val.reviews > 0 ? val.correct / val.reviews : 0;
        if (rate < 0.7) {
          const parts = key.split(':');
          const lv = parts[0];
          const word = parts.slice(1).join(':');
          const vocab = getVocabData(lv).find(v => v.w === word);
          if (vocab) weak.push({ vocab, lv });
        }
      }
    });
    if (!weak.length) { alert('沒有弱點單字！'); return; }

    // Build a custom quiz from weak words
    close();
    const count = Math.min(weak.length, 20);
    const picked = weak.sort(() => Math.random() - 0.5).slice(0, count);

    // Hijack Quiz to run custom words
    const allVocab = [...getVocabData('n5'), ...getVocabData('n4'), ...getVocabData('n3'), ...getVocabData('n2')];
    const questions = picked.map(({ vocab, lv }) => {
      const pool = allVocab.filter(d => d.m !== vocab.m).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [vocab, ...pool].sort(() => Math.random() - 0.5);
      return { word: vocab, options, correctIdx: options.indexOf(vocab), level: lv };
    });

    // Render directly using Quiz overlay
    document.getElementById('quizBg').classList.add('show');
    let cur = 0, score = 0, results = [];

    function renderWQ() {
      const q = questions[cur];
      document.getElementById('quizBox').innerHTML = `
        <div class="qhd"><span>弱點測驗 ${cur+1} / ${questions.length}</span><span>正確: ${score}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="document.getElementById('quizBg').classList.remove('show')">✕</button></div>
        <div class="qprompt"><div class="qmain">${q.word.w}</div>${q.word.w !== q.word.r ? '<div class="qsub">' + q.word.r + '</div>' : ''}</div>
        <div class="qopts">${q.options.map((o, i) => '<button class="qopt" onclick="Stats._answerWeak(' + i + ')">' + o.m + '</button>').join('')}</div>`;
    }

    Stats._wqState = { questions, cur: 0, score: 0, results: [] };
    Stats._renderWQ = renderWQ;
    renderWQ();
  }

  function _answerWeak(idx) {
    const s = Stats._wqState;
    const q = s.questions[s.cur];
    const correct = idx === q.correctIdx;
    if (correct) s.score++;
    s.results.push({ word: q.word, correct, chosenIdx: idx, correctIdx: q.correctIdx, options: q.options });
    if (typeof SRS !== 'undefined' && SRS.record) SRS.record(q.level, q.word.w, correct);

    const opts = document.querySelectorAll('.qopt');
    opts.forEach((b, i) => { b.disabled = true; if (i === q.correctIdx) b.classList.add('qcorrect'); if (i === idx && !correct) b.classList.add('qwrong'); });

    setTimeout(() => {
      s.cur++;
      if (s.cur >= s.questions.length) {
        const pct = Math.round(s.score / s.questions.length * 100);
        document.getElementById('quizBox').innerHTML = `
          <h3>弱點測驗結果</h3>
          <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${s.score} / ${s.questions.length}（${pct}%）</div>
          <div class="qresults">${s.results.map(r => r.correct
            ? '<div class="qr ok"><span class="qrc">✓</span> '+r.word.w+' — '+r.word.m+'</div>'
            : '<div class="qr ng"><span class="qrc">✗</span> '+r.word.w+' — 你選: '+r.options[r.chosenIdx].m+' → 正確: '+r.word.m+'</div>'
          ).join('')}</div>
          <div class="qactions"><button class="qstart" onclick="Stats.quizWeak()">再來一次</button><button class="qclose" onclick="Stats.open()">回統計</button></div>`;
      } else {
        Stats._renderWQ();
      }
    }, correct ? 500 : 1000);
  }

  return { open, close, quizWeak, _answerWeak };
})();
