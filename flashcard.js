// ========== FLASHCARD MODE (類 26秒 快速背單字) ==========
// 倒數自動翻面 + 手勢左右滑 + 自動播音 + 記錄 SRS
const FlashCard = (() => {
  const EXAM_KEY = 'exam_date';
  const COUNTDOWN_SEC = 20;

  let queue = [];
  let cur = 0;
  let score = { known: 0, unknown: 0 };
  let level = 'n5';
  let timerId = null;
  let timeLeft = COUNTDOWN_SEC;
  let flipped = false;
  let touchStartX = 0;
  let touchStartY = 0;

  // ── Exam date ──
  function getExamDate() { return localStorage.getItem(EXAM_KEY) || ''; }
  function setExamDate(d) {
    if (d) localStorage.setItem(EXAM_KEY, d);
    else localStorage.removeItem(EXAM_KEY);
    if (typeof saveAllCloud === 'function') saveAllCloud();
  }
  function daysUntilExam() {
    const d = getExamDate();
    if (!d) return null;
    const exam = new Date(d); exam.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((exam - today) / 86400000);
  }

  // ── Vocab source ──
  function getData(lv) {
    if (typeof getVocabData === 'function') return getVocabData(lv);
    return [];
  }

  // ── Start panel ──
  function start() {
    const box = document.getElementById('quizBox');
    const curLv = typeof currentLevel !== 'undefined' ? currentLevel : 'n5';
    const exam = getExamDate();
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">⚡ 快速背單字</h3>
        <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="FlashCard.close()">✕</button>
      </div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:14px;line-height:1.7">
        每張卡 ${COUNTDOWN_SEC} 秒自動翻面。手機可<strong>左滑（不會）</strong>或<strong>右滑（會）</strong>，桌機按按鈕。答題紀錄會同步到複習系統。
      </div>
      <div class="qf"><label>級別</label><div class="qo" id="fcLevel">
        <button data-v="n5" class="${curLv==='n5'?'on':''}">N5</button>
        <button data-v="n4" class="${curLv==='n4'?'on':''}">N4</button>
        <button data-v="n3" class="${curLv==='n3'?'on':''}">N3</button>
        <button data-v="n2" class="${curLv==='n2'?'on':''}">N2</button>
        <button data-v="n1" class="${curLv==='n1'?'on':''}">N1</button>
      </div></div>
      <div class="qf"><label>張數</label><div class="qo" id="fcCount">
        <button data-v="10">10</button><button data-v="20" class="on">20</button><button data-v="50">50</button>
      </div></div>
      <div class="qf"><label>範圍</label><div class="qo" id="fcRange">
        <button data-v="new" class="on">新詞為主</button>
        <button data-v="due">複習待複習</button>
        <button data-v="random">全部隨機</button>
      </div></div>
      <div class="qf"><label>考試日期</label>
        <input type="date" id="fcExam" value="${exam}" style="padding:8px 12px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--tx);font-family:inherit;font-size:14px;width:100%">
        <div id="fcExamInfo" style="font-size:12px;color:var(--tx2);margin-top:4px"></div>
      </div>
      <button class="qstart" onclick="FlashCard.begin()">開始</button>
      <button class="qclose" onclick="FlashCard.close()">取消</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => { g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); };
      });
    });
    const examInput = document.getElementById('fcExam');
    const info = document.getElementById('fcExamInfo');
    function updateExamInfo() {
      const v = examInput.value;
      if (!v) { info.textContent = '（選填）設定後會顯示倒數天數'; return; }
      const d = new Date(v); d.setHours(0,0,0,0);
      const t = new Date(); t.setHours(0,0,0,0);
      const days = Math.ceil((d - t) / 86400000);
      info.textContent = days >= 0 ? `距離考試還有 ${days} 天` : `考試日期已過 ${-days} 天`;
      info.style.color = days < 30 && days >= 0 ? 'var(--ac)' : 'var(--tx2)';
    }
    examInput.addEventListener('change', () => { setExamDate(examInput.value); updateExamInfo(); });
    updateExamInfo();
    document.getElementById('quizBg').classList.add('show');
  }

  function begin() {
    const lvEl = document.querySelector('#fcLevel .on');
    const ctEl = document.querySelector('#fcCount .on');
    const rgEl = document.querySelector('#fcRange .on');
    if (lvEl) level = lvEl.dataset.v;
    const count = ctEl ? parseInt(ctEl.dataset.v) : 20;
    const range = rgEl ? rgEl.dataset.v : 'new';
    const data = getData(level);
    if (!data || !data.length) { alert('此級別無單字資料'); return; }
    const srs = typeof SRS !== 'undefined' ? JSON.parse(localStorage.getItem('srs_data') || '{}') : {};
    const pf = level + ':';
    const today = new Date().toISOString().split('T')[0];
    const learned = new Set(Object.keys(srs).filter(k => k.startsWith(pf)).map(k => k.slice(pf.length)));
    let pool;
    if (range === 'new') {
      pool = data.filter(d => !learned.has(d.w));
      if (pool.length < count) pool = data; // 學完所有新詞就回到全部
    } else if (range === 'due') {
      pool = data.filter(d => {
        const e = srs[pf + d.w];
        return e && e.nextReview <= today;
      });
      if (!pool.length) pool = data.filter(d => !learned.has(d.w));
      if (!pool.length) pool = data;
    } else {
      pool = data;
    }
    queue = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
    cur = 0;
    score = { known: 0, unknown: 0 };
    renderCard();
  }

  function renderCard() {
    if (cur >= queue.length) return showResults();
    flipped = false;
    timeLeft = COUNTDOWN_SEC;
    const item = queue[cur];
    const box = document.getElementById('quizBox');
    box.innerHTML = `
      <div class="qhd">
        <span>${cur+1} / ${queue.length}</span>
        <span style="color:var(--ac);font-weight:600">✓${score.known} ✗${score.unknown}</span>
        <button class="qclose" style="width:auto;margin:0;padding:2px 10px" onclick="FlashCard.close()">✕</button>
      </div>
      <div class="fc-bar"><div class="fc-bar-fill" id="fcBarFill"></div></div>
      <div class="fc-card" id="fcCard" onclick="FlashCard.flip()">
        <div class="fc-face" id="fcFront">
          <div class="fc-word">${item.w}</div>
          <div class="fc-hint">點卡翻面，或等 ${COUNTDOWN_SEC} 秒自動翻</div>
        </div>
        <div class="fc-face" id="fcBack" style="display:none">
          <div class="fc-word" style="font-size:28px">${item.w}</div>
          ${item.w!==item.r?`<div class="fc-reading">${item.r}</div>`:''}
          <div class="fc-meaning">${typeof cvt==='function'?cvt(item.m):item.m}</div>
          <div class="fc-btns">
            <button class="fc-btn fc-no" onclick="event.stopPropagation();FlashCard.answer(false)">✗ 不會</button>
            <button class="fc-btn fc-yes" onclick="event.stopPropagation();FlashCard.answer(true)">✓ 會</button>
          </div>
          <div class="fc-hint">手機可左滑（不會）／右滑（會）</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:10px">
        <button onclick="event.stopPropagation();speak('${(item.r||item.w).replace(/'/g,"\\'")}')" style="background:var(--bg3);border:1px solid var(--bd);border-radius:20px;padding:6px 16px;cursor:pointer;color:var(--ac2);font-size:13px">🔊 播音</button>
      </div>`;
    // auto play 發音
    if (typeof speak === 'function') setTimeout(() => speak(item.r || item.w), 200);
    // 倒數
    startTimer();
    // 綁手勢
    bindSwipe();
  }

  function startTimer() {
    clearInterval(timerId);
    const fill = document.getElementById('fcBarFill');
    const startTime = Date.now();
    timerId = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      timeLeft = Math.max(0, COUNTDOWN_SEC - elapsed);
      const pct = (timeLeft / COUNTDOWN_SEC) * 100;
      if (fill) fill.style.width = pct + '%';
      if (timeLeft <= 0) {
        clearInterval(timerId);
        if (!flipped) flip();
      }
    }, 100);
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    clearInterval(timerId);
    const front = document.getElementById('fcFront');
    const back = document.getElementById('fcBack');
    if (front) front.style.display = 'none';
    if (back) back.style.display = '';
  }

  function answer(known) {
    const item = queue[cur];
    if (known) score.known++; else score.unknown++;
    // 記 SRS
    if (typeof SRS !== 'undefined' && SRS.record) SRS.record(level, item.w, known);
    if (typeof Calendar !== 'undefined') Calendar.logActivity('vocab');
    cur++;
    clearInterval(timerId);
    setTimeout(renderCard, 120);
  }

  function bindSwipe() {
    const card = document.getElementById('fcCard');
    if (!card) return;
    card.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    card.addEventListener('touchend', e => {
      if (!flipped) return; // 沒翻面時不接受滑動
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        answer(dx > 0); // 右滑 = 會，左滑 = 不會
      }
    }, { passive: true });
  }

  function showResults() {
    clearInterval(timerId);
    const total = score.known + score.unknown;
    const pct = total ? Math.round(score.known / total * 100) : 0;
    // 計算考試倒數 + 進度
    const days = daysUntilExam();
    const data = getData(level);
    const srs = JSON.parse(localStorage.getItem('srs_data') || '{}');
    const pf = level + ':';
    const learned = Object.keys(srs).filter(k => k.startsWith(pf)).length;
    const total_vocab = data.length;
    const remaining = total_vocab - learned;
    const perDaySug = days && days > 0 && remaining > 0 ? Math.ceil(remaining / days) : null;

    document.getElementById('quizBox').innerHTML = `
      <h3>本輪結束</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${score.known} / ${total}（${pct}%）</div>
      <div style="background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:14px;margin:14px 0;font-size:13px;line-height:1.9;color:var(--tx)">
        <div><strong>${level.toUpperCase()} 進度：</strong>${learned} / ${total_vocab}（已學 ${Math.round(learned/total_vocab*100)}%）</div>
        <div><strong>還要背：</strong>${remaining} 個</div>
        ${days !== null ? `<div><strong>考試倒數：</strong>${days >= 0 ? days + ' 天' : '已過 ' + (-days) + ' 天'}</div>` : ''}
        ${perDaySug ? `<div style="color:var(--ac);font-weight:600;margin-top:4px">💡 建議每天背 ${perDaySug} 個才背得完</div>` : ''}
      </div>
      <div class="qactions">
        <button class="qstart" onclick="FlashCard.begin()">下一輪</button>
        <button class="qclose" onclick="FlashCard.close()">返回</button>
      </div>`;
  }

  function close() {
    clearInterval(timerId);
    document.getElementById('quizBg').classList.remove('show');
  }

  return { start, begin, flip, answer, close, getExamDate, setExamDate, daysUntilExam };
})();
