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
    let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="margin:0">${t('stats_title')}</h3><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Stats.close()">✕</button></div>`;
    h += '<div style="display:flex;gap:4px;margin-bottom:14px;overflow-x:auto;scrollbar-width:none">';
    h += `<button class="qo-btn stat-tab on" data-tab="overview" onclick="Stats.switchTab('overview')">${t('tab_overview')}</button>`;
    h += `<button class="qo-btn stat-tab" data-tab="history" onclick="Stats.switchTab('history')">${t('tab_history')}</button>`;
    h += `<button class="qo-btn stat-tab" data-tab="notebook" onclick="Stats.switchTab('notebook')">${t('tab_notebook')}</button>`;
    h += `<button class="qo-btn stat-tab" data-tab="weak" onclick="Stats.switchTab('weak')">${t('tab_weak')}</button>`;
    h += '</div>';
    h += '<div id="statContent">';
    h += buildOverview();
    h += '</div>';
    return h;
  }

  function switchTab(tab) {
    document.querySelectorAll('.stat-tab').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    const c = document.getElementById('statContent');
    if (tab === 'overview') c.innerHTML = buildOverview();
    else if (tab === 'history') c.innerHTML = buildHistory();
    else if (tab === 'notebook') c.innerHTML = buildNotebook();
    else if (tab === 'weak') c.innerHTML = buildWeakWords();
  }

  function buildOverview() {
    return buildScoreChart() + buildProgress();
  }

  // ── 考試紀錄 ──
  function buildHistory() {
    const hist = getHistory();
    if (!hist.length) return `<div class="st-section"><div class="st-title">${t('tab_history')}</div><div class="st-empty">${t('history_empty')}</div></div>`;
    let h = `<div class="st-section"><div class="st-title">${t('history_title')}</div>`;
    h += '<div style="max-height:400px;overflow-y:auto">';
    const recent = hist.slice(-50).reverse();
    recent.forEach((r, i) => {
      const pct = Math.round(r.score / r.total * 100);
      const color = pct >= 80 ? 'var(--correct,#16a34a)' : pct >= 60 ? 'var(--ok-tx,#ca8a04)' : 'var(--wrong,#dc2626)';
      const date = new Date(r.date).toLocaleDateString('zh-TW', {month:'numeric',day:'numeric',hour:'numeric',minute:'numeric'});
      const typeMap = {word2meaning: t('type_ja_zh'), meaning2word: t('type_zh_ja'), reading: t('type_reading')};
      h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd);font-size:13px">';
      h += '<span style="min-width:35px;font-weight:700;color:'+color+'">'+pct+'%</span>';
      h += '<span style="min-width:28px;font-size:11px;color:var(--ac2);font-weight:600">'+r.level.toUpperCase()+'</span>';
      h += '<span style="flex:1;color:var(--tx2);font-size:12px">'+(typeMap[r.type]||r.type)+'</span>';
      h += '<span style="font-size:11px;color:var(--tx3)">'+r.score+'/'+r.total+'</span>';
      h += '<span style="font-size:10px;color:var(--tx3)">'+date+'</span>';
      h += '</div>';
    });
    h += '</div></div>';
    // 錯題重考按鈕
    h += `<button class="qstart" style="margin-top:12px" onclick="Stats.retryWrong()">${t('retry_wrong')}</button>`;
    return h;
  }

  // 錯題重考 — 從 SRS 中找答錯最多的
  function retryWrong() {
    const srs = getSRS();
    const wrong = [];
    Object.entries(srs).forEach(([key, val]) => {
      if (val.reviews > 0 && val.correct < val.reviews) {
        const parts = key.split(':');
        const lv = parts[0];
        const word = parts.slice(1).join(':');
        const vocab = getVocabData(lv).find(v => v.w === word);
        if (vocab) wrong.push({ vocab, lv, wrongCount: val.reviews - val.correct });
      }
    });
    if (!wrong.length) { alert(t('no_wrong')); return; }
    wrong.sort((a, b) => b.wrongCount - a.wrongCount);
    const picked = wrong.slice(0, 20);
    const allVocab = [...getVocabData('n5'), ...getVocabData('n4'), ...getVocabData('n3'), ...getVocabData('n2'), ...getVocabData('n1')];
    const qs = picked.map(({ vocab, lv }) => {
      const pool = allVocab.filter(d => d.m !== vocab.m).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [vocab, ...pool].sort(() => Math.random() - 0.5);
      return { word: vocab, options, correctIdx: options.indexOf(vocab), level: lv };
    });
    Stats._wqState = { questions: qs, cur: 0, score: 0, results: [] };
    _renderWQ();
  }

  // ── 生詞本 ──
  function getNotebook() {
    try { return JSON.parse(localStorage.getItem('word_notebook')) || []; } catch(e) { return []; }
  }
  function saveNotebook(nb) { localStorage.setItem('word_notebook', JSON.stringify(nb)); if (typeof saveAllCloud === 'function') saveAllCloud(); }

  function addToNotebook(w, r, m, lv) {
    const nb = getNotebook();
    if (nb.find(x => x.w === w && x.lv === lv)) return; // already exists
    nb.push({ w, r, m, lv, added: new Date().toISOString() });
    saveNotebook(nb);
    alert(t('added_to_notebook', { w }));
  }

  function removeFromNotebook(w, lv) {
    let nb = getNotebook();
    nb = nb.filter(x => !(x.w === w && x.lv === lv));
    saveNotebook(nb);
    switchTab('notebook');
  }

  function buildNotebook() {
    const nb = getNotebook();
    let h = `<div class="st-section"><div class="st-title">${t('notebook_title')} <span style="font-weight:400;font-size:12px;color:var(--tx2)">${t('notebook_count', { n: nb.length })}</span></div>`;
    if (!nb.length) {
      h += `<div class="st-empty">${t('notebook_empty').replace(/\n/g, '<br>')}</div>`;
    } else {
      h += '<div style="max-height:350px;overflow-y:auto">';
      nb.forEach(w => {
        h += '<div class="st-weak-item">';
        h += '<span class="st-weak-word">' + w.w + '</span>';
        h += '<span class="st-weak-reading">' + (w.w !== w.r ? w.r : '') + '</span>';
        h += '<span class="st-weak-meaning">' + (typeof cvt==='function'?cvt(w.m):w.m) + '</span>';
        h += '<span class="st-weak-lv">' + w.lv.toUpperCase() + '</span>';
        h += '<button style="background:none;border:none;color:var(--wrong,#dc2626);cursor:pointer;font-size:12px;padding:2px 4px" onclick="Stats.removeFromNotebook(\'' + w.w.replace(/'/g, "\\'") + '\',\'' + w.lv + '\')">✕</button>';
        h += '</div>';
      });
      h += '</div>';
      h += '<div style="display:flex;gap:8px;margin-top:12px">';
      h += `<button class="qstart" style="flex:1" onclick="Stats.quizNotebook()">${t('notebook_quiz')}</button>`;
      h += `<button class="qclose" style="flex:1" onclick="Stats.reviewNotebook()">${t('notebook_review')}</button>`;
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  function quizNotebook() {
    const nb = getNotebook();
    if (nb.length < 4) { alert(t('notebook_min')); return; }
    const allVocab = [...getVocabData('n5'), ...getVocabData('n4'), ...getVocabData('n3'), ...getVocabData('n2'), ...getVocabData('n1')];
    const picked = [...nb].sort(() => Math.random() - 0.5).slice(0, 20);
    const qs = picked.map(item => {
      const vocab = { w: item.w, r: item.r, m: item.m, c: '' };
      const pool = allVocab.filter(d => d.m !== vocab.m).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [vocab, ...pool].sort(() => Math.random() - 0.5);
      return { word: vocab, options, correctIdx: options.indexOf(vocab), level: item.lv };
    });
    Stats._wqState = { questions: qs, cur: 0, score: 0, results: [] };
    _renderWQ();
  }

  function reviewNotebook() {
    const nb = getNotebook();
    if (!nb.length) { alert(t('notebook_empty_alert')); return; }
    let cur = 0;
    function renderCard() {
      const item = nb[cur];
      document.getElementById('quizBox').innerHTML = `
        <div class="qhd"><span>${t('nb_progress', { cur: cur+1, total: nb.length })}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="Stats.close()">✕</button></div>
        <div class="srs-card" onclick="this.querySelector('#nbBack').style.display='';this.querySelector('#nbFront').style.display='none'">
          <div id="nbFront"><div class="qmain">${item.w}</div>${item.w!==item.r?'<div class="qsub">'+item.r+'</div>':''}<div class="srs-hint">${t('flip_hint')}</div></div>
          <div id="nbBack" style="display:none"><div class="qmain">${item.w}</div>${item.w!==item.r?'<div class="qsub">'+item.r+'</div>':''}<div class="srs-meaning">${typeof cvt==='function'?cvt(item.m):item.m}</div>
            <div class="srs-btns">
              <button class="srs-btn srs-hard" onclick="event.stopPropagation();Stats._nbNext()">${t('nb_next')}</button>
              <button class="srs-btn srs-ok" onclick="event.stopPropagation();Stats.removeFromNotebook('${item.w.replace(/'/g,"\\'")}','${item.lv}');Stats._nbNext()">${t('nb_remove')}</button>
            </div>
          </div>
        </div>`;
    }
    Stats._nbNext = function() { cur++; if (cur >= nb.length) { open(); } else { renderCard(); } };
    renderCard();
  }

  // ── 測驗成績走勢 ──
  function buildScoreChart() {
    const hist = getHistory();
    if (!hist.length) return `<div class="st-section"><div class="st-title">${t('score_title')}</div><div class="st-empty">${t('score_empty')}</div></div>`;

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

    return `<div class="st-section"><div class="st-title">${t('score_title')}</div>${bars}` +
      `<div class="st-row"><span>${t('score_recent', { n: recent })}</span><span>${t('score_avg', { n: avg })}</span><span>${t('score_high', { n: max })}</span><span>${t('score_total', { n: hist.length })}</span></div></div>`;
  }

  // ── 學習進度 ──
  function buildProgress() {
    const srs = getSRS();
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
    let h = `<div class="st-section"><div class="st-title">${t('progress_title')}</div>`;

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
        `<span class="st-dot st-dot-mastered"></span>${t('mastered', { n: mastered })}` +
        `<span class="st-dot st-dot-learning"></span>${t('learning', { n: learning })}` +
        `<span class="st-dot st-dot-new"></span>${t('unlearned', { n: total - learned })}` +
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
      return `<div class="st-section"><div class="st-title">${t('weak_title')}</div>` +
        `<div class="st-empty">${t('weak_empty')}</div></div>`;
    }

    let h = `<div class="st-section"><div class="st-title">${t('weak_title')} <span style="font-weight:400;font-size:12px;color:#64748B">${t('weak_subtitle')}</span></div>`;
    h += '<div class="st-weak-list">';
    top20.forEach(w => {
      const rateColor = w.rate < 40 ? '#dc2626' : '#ca8a04';
      h += '<div class="st-weak-item">' +
        '<span class="st-weak-word">' + w.w + '</span>' +
        '<span class="st-weak-reading">' + (w.w !== w.r ? w.r : '') + '</span>' +
        '<span class="st-weak-meaning">' + (typeof cvt==='function'?cvt(w.m):w.m) + '</span>' +
        '<span class="st-weak-rate" style="color:' + rateColor + '">' + w.rate + '%</span>' +
        '<span class="st-weak-lv">' + w.level.toUpperCase() + '</span></div>';
    });
    h += '</div>';

    if (weak.length > 0) {
      h += `<button class="qstart" style="margin-top:12px" onclick="Stats.quizWeak()">${t('weak_quiz', { n: Math.min(weak.length, 20) })}</button>`;
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
    if (!weak.length) { alert(t('weak_none')); return; }

    close();
    const count = Math.min(weak.length, 20);
    const picked = weak.sort(() => Math.random() - 0.5).slice(0, count);
    const allVocab = [...getVocabData('n5'), ...getVocabData('n4'), ...getVocabData('n3'), ...getVocabData('n2'), ...getVocabData('n1')];
    const qs = picked.map(({ vocab, lv }) => {
      const pool = allVocab.filter(d => d.m !== vocab.m).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [vocab, ...pool].sort(() => Math.random() - 0.5);
      return { word: vocab, options, correctIdx: options.indexOf(vocab), level: lv };
    });

    Stats._wqState = { questions: qs, cur: 0, score: 0, results: [] };
    document.getElementById('quizBg').classList.add('show');
    _renderWQ();
  }

  function _renderWQ() {
    const s = Stats._wqState;
    const q = s.questions[s.cur];
    document.getElementById('quizBox').innerHTML = `
      <div class="qhd"><span>${t('weak_progress', { cur: s.cur+1, total: s.questions.length })}</span><span>${t('quiz_score', { n: s.score })}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="document.getElementById('quizBg').classList.remove('show')">✕</button></div>
      <div class="qprompt"><div class="qmain">${q.word.r || q.word.w}</div></div>
      <div class="qopts">${q.options.map((o, i) => '<button class="qopt" onclick="Stats._answerWeak(' + i + ')">' + (typeof cvt==='function'?cvt(o.m):o.m) + '</button>').join('')}</div>`;
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
          <h3>${t('weak_result')}</h3>
          <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${s.score} / ${s.questions.length}（${pct}%）</div>
          <div class="qresults">${s.results.map(r => r.correct
            ? '<div class="qr ok"><span class="qrc">✓</span> '+r.word.w+' — '+r.word.m+'</div>'
            : `<div class="qr ng"><span class="qrc">✗</span> ${r.word.w} — ${t('quiz_you_chose', { chose: r.options[r.chosenIdx].m, correct: r.word.m })}</div>`
          ).join('')}</div>
          <div class="qactions"><button class="qstart" onclick="Stats.quizWeak()">${t('try_again')}</button><button class="qclose" onclick="Stats.open()">${t('back_to_stats')}</button></div>`;
      } else {
        _renderWQ();
      }
    }, correct ? 500 : 1000);
  }

  return { open, close, switchTab, quizWeak, retryWrong, _answerWeak, addToNotebook, removeFromNotebook, quizNotebook, reviewNotebook };
})();
