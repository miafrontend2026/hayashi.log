// ========== SPACED REPETITION SYSTEM ==========
const SRS = (() => {
  const KEY = 'srs_data';
  function getData() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function today() { return new Date().toISOString().split('T')[0]; }
  function k(lv, w) { return lv + ':' + w; }

  function record(level, word, correct) {
    const d = getData();
    const key = k(level, word);
    const e = d[key] || { interval: 0, ease: 2.5, nextReview: today(), reviews: 0, correct: 0 };
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
    d[key] = e;
    save(d);
    if (typeof saveSRSCloud === 'function') saveSRSCloud();
  }

  function getDue(level) {
    const d = getData(), t = today(), out = [];
    Object.entries(d).forEach(([key, e]) => {
      if (key.startsWith(level + ':') && e.nextReview <= t)
        out.push({ word: key.slice(level.length + 1), ...e });
    });
    return out.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  }

  function getDueCount() {
    const d = getData(), t = today();
    let c = 0; Object.values(d).forEach(e => { if (e.nextReview <= t) c++; });
    return c;
  }

  function getNew(level, count) {
    const d = getData();
    const learned = new Set(Object.keys(d).filter(x => x.startsWith(level + ':')).map(x => x.slice(level.length + 1)));
    return getVocabData(level).filter(v => !learned.has(v.w)).slice(0, count);
  }

  function getStats(level) {
    const d = getData(), pf = level + ':', t = today();
    const entries = Object.entries(d).filter(([x]) => x.startsWith(pf));
    return {
      total: entries.length,
      due: entries.filter(([, v]) => v.nextReview <= t).length,
      mastered: entries.filter(([, v]) => v.interval >= 21).length,
      learning: entries.filter(([, v]) => v.interval > 0 && v.interval < 21).length
    };
  }

  let queue = [], cur = 0, lvl = 'n5';

  function start(level) {
    lvl = level || (typeof currentLevel !== 'undefined' ? currentLevel : 'n5');
    const due = getDue(lvl);
    const nw = getNew(lvl, 10);
    queue = [];
    due.forEach(x => { const v = getVocabData(lvl).find(w => w.w === x.word); if (v) queue.push({ ...v, isNew: false }); });
    nw.forEach(v => queue.push({ ...v, isNew: true }));
    if (!queue.length) { alert('今天沒有需要複習的單字！你可以先去測驗模式學新詞。'); return; }
    cur = 0;
    renderCard();
    document.getElementById('quizBg').classList.add('show');
  }

  function renderCard() {
    const item = queue[cur], st = getStats(lvl);
    document.getElementById('quizBox').innerHTML = `
      <div class="qhd"><span>複習 ${cur+1} / ${queue.length}</span><span>${item.isNew?'🆕 新詞':'📖 複習'}</span><button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="SRS.close()">✕</button></div>
      <div class="srs-card" id="srsCard" onclick="SRS.flip()">
        <div class="srs-front" id="srsFront">
          <div class="qmain">${item.w}</div>
          ${item.w!==item.r?'<div class="qsub">'+item.r+'</div>':''}
          <div style="margin:8px 0"><svg class="spk" style="width:24px;height:24px;opacity:.6" onclick="event.stopPropagation();speak('${item.w.replace(/'/g,"\\'")}')" viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14"/></svg></div>
          <div class="srs-hint">點擊翻面查看答案</div>
        </div>
        <div class="srs-back" id="srsBack" style="display:none">
          <div class="qmain">${item.w}</div>
          ${item.w!==item.r?'<div class="qsub">'+item.r+'</div>':''}
          <div class="srs-meaning">${item.m}</div>
          <div class="srs-btns">
            <button class="srs-btn srs-hard" onclick="event.stopPropagation();SRS.rate(false)">不會</button>
            <button class="srs-btn srs-ok" onclick="event.stopPropagation();SRS.rate(true)">記得</button>
          </div>
        </div>
      </div>
      <div class="srs-stats">已學 ${st.total} ｜ 待複習 ${st.due} ｜ 已掌握 ${st.mastered}</div>`;
  }

  function flip() {
    document.getElementById('srsFront').style.display = 'none';
    document.getElementById('srsBack').style.display = '';
  }

  function rate(correct) {
    const item = queue[cur];
    record(lvl, item.w, correct);
    if (typeof Calendar !== 'undefined') Calendar.logActivity('vocab');
    cur++;
    if (cur >= queue.length) showDone(); else renderCard();
  }

  function showDone() {
    const st = getStats(lvl);
    document.getElementById('quizBox').innerHTML = `
      <h3>複習完成！</h3>
      <div class="srs-done-stats">
        <div>今日複習：${queue.length} 個</div>
        <div>累計已學：${st.total} 個</div>
        <div>已掌握：${st.mastered} 個</div>
        <div>學習中：${st.learning} 個</div>
      </div>
      <button class="qstart" onclick="SRS.close()">返回</button>`;
  }

  function close() {
    document.getElementById('quizBg').classList.remove('show');
    updateReviewCount();
  }

  function updateReviewCount() {
    const c = getDueCount();
    const btn = document.getElementById('reviewBtn');
    if (btn) btn.textContent = c ? '複習(' + c + ')' : '複習';
  }

  return { start, record, flip, rate, close, getDueCount, updateReviewCount, getStats };
})();
