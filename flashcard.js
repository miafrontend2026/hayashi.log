// ========== FLASHCARD MODE (類 26秒 快速背單字) ==========
// 倒數自動翻面 + 手勢左右滑 + 自動播音 + 記錄 SRS
const FlashCard = (() => {
  const EXAM_KEY = 'exam_date';
  const BASE_KEY = 'base_level';    // 目前程度（這級以下視為已懂）'none'|'n5'|'n4'|'n3'|'n2'
  const GOAL_KEY = 'goal_level';    // 目標考級 'n5'|'n4'|'n3'|'n2'|'n1'
  const LEVELS = ['n5','n4','n3','n2','n1'];
  const COUNTDOWN_SEC = 20;

  // 評分規則由 SRS.GRADES 提供（單一來源），這裡只存「本輪內重現」的偏移
  const MAX_REAPPEAR = 2;         // 同一張卡本輪最多重現次數
  const REQUEUE_OFFSET = { soso: 5, unknown: 2 };
  function gradeLabel(grade) {
    return (typeof SRS !== 'undefined' && SRS.GRADES && SRS.GRADES[grade])
      ? SRS.GRADES[grade].label
      : '';
  }

  let queue = [];
  let cur = 0;
  let score = { known: 0, soso: 0, unknown: 0 };
  let reappearCount = {};   // word -> times reappeared
  let level = 'n5';
  let timerId = null;
  let timeLeft = COUNTDOWN_SEC;
  let flipped = false;
  let touchStartX = 0;
  let touchStartY = 0;

  // ── Exam date / 程度 / 目標 ──
  function getExamDate() { return localStorage.getItem(EXAM_KEY) || ''; }
  function setExamDate(d) {
    if (d) localStorage.setItem(EXAM_KEY, d);
    else localStorage.removeItem(EXAM_KEY);
    if (typeof saveAllCloud === 'function') saveAllCloud();
  }
  function getBaseLevel() { return localStorage.getItem(BASE_KEY) || 'none'; }
  function setBaseLevel(v) {
    if (v) localStorage.setItem(BASE_KEY, v);
    else localStorage.removeItem(BASE_KEY);
    if (typeof saveAllCloud === 'function') saveAllCloud();
  }
  function getGoalLevel() { return localStorage.getItem(GOAL_KEY) || ''; }
  function setGoalLevel(v) {
    if (v) localStorage.setItem(GOAL_KEY, v);
    else localStorage.removeItem(GOAL_KEY);
    if (typeof saveAllCloud === 'function') saveAllCloud();
  }
  // 需要學的級別區間：base 以上（不含）～ goal（含）。n5 最簡單，n1 最難。
  function scopeLevels(base, goal) {
    if (!goal) return [];
    const gi = LEVELS.indexOf(goal);
    if (gi < 0) return [];
    const bi = base === 'none' || !base ? -1 : LEVELS.indexOf(base);
    return LEVELS.slice(bi + 1, gi + 1);
  }
  // 真正「學會」= 至少一次標為「記得」。碰過但只打不熟/不會不算
  function countLearned(srs, lv) {
    const pf = lv + ':';
    let n = 0;
    for (const k in srs) if (k.startsWith(pf) && (srs[k].correct || 0) > 0) n++;
    return n;
  }
  function daysUntilExam() {
    const d = getExamDate();
    if (!d) return null;
    const exam = new Date(d); exam.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((exam - today) / 86400000);
  }

  // JLPT 一年兩次：7月 & 12月的第一個週日。算出未來幾場考試日期。
  function firstSundayOf(year, month) {
    for (let day = 1; day <= 7; day++) {
      const d = new Date(year, month - 1, day);
      if (d.getDay() === 0) return d;
    }
  }
  function getUpcomingJlptDates(count) {
    const today = new Date(); today.setHours(0,0,0,0);
    const out = [];
    let y = today.getFullYear();
    while (out.length < count) {
      [[7, '第 1 回 (7月)'], [12, '第 2 回 (12月)']].forEach(([m, label]) => {
        if (out.length >= count) return;
        const d = firstSundayOf(y, m);
        if (d >= today) out.push({ date: d, label: `${d.getFullYear()}/${String(m).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} JLPT ${label}`, iso: d.toISOString().split('T')[0] });
      });
      y++;
    }
    return out;
  }

  // ── Vocab source ──
  function getData(lv) {
    if (typeof getVocabData === 'function') return getVocabData(lv);
    return [];
  }

  // ── Styles (絲滑動效) ──
  function ensureStyles() {
    if (document.getElementById('fc-styles')) return;
    const s = document.createElement('style');
    s.id = 'fc-styles';
    s.textContent = `
      #quizBox .fc-card { animation: fcCardIn .24s cubic-bezier(.2,.8,.2,1); }
      #quizBox .fc-bar-fill { transition: width .1s linear; }
      #quizBox .fc-face { animation: fcFaceIn .22s ease; }
      @keyframes fcCardIn { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes fcFaceIn { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: scale(1); } }
      #quizBox .fc-btn, #quizBox .qstart, #quizBox .qclose, #quizBox .qo button { transition: transform .12s ease, background .15s ease, border-color .15s ease; }
      #quizBox .fc-btn:active, #quizBox .qstart:active, #quizBox .qo button:active { transform: scale(.96); }
      #quizBox .qo button.on { transition: background .2s ease; }
      #quizBox #fcExam { transition: border-color .15s ease, background .15s ease; }
      #quizBox #fcExam:hover { border-color: var(--ac) !important; }
    `;
    document.head.appendChild(s);
  }

  // ── Live info panel ──
  function renderStartInfo() {
    const infoEl = document.getElementById('fcInfo');
    if (!infoEl) return;
    const lvEl = document.querySelector('#fcLevel .on');
    const examEl = document.getElementById('fcExam');
    const baseEl = document.getElementById('fcBase');
    const goalEl = document.getElementById('fcGoal');
    const lv = lvEl ? lvEl.dataset.v : 'n5';
    const base = baseEl ? baseEl.value : getBaseLevel();
    const goal = goalEl ? goalEl.value : getGoalLevel();
    const data = getData(lv);
    const srs = JSON.parse(localStorage.getItem('srs_data') || '{}');

    let html = '';
    // 本輪級別的進度（已學 = 至少一次記得）
    if (data && data.length) {
      const pf = lv + ':';
      const learned = countLearned(srs, lv);
      const now = Date.now();
      const due = Object.keys(srs).filter(k => k.startsWith(pf) && SRS.isDue(srs[k], now)).length;
      html += `<div><strong>${lv.toUpperCase()} 進度：</strong>${learned} / ${data.length}（已學 ${Math.round(learned/data.length*100)}%）${due>0?`　<span style="color:var(--ac)">・今日待複習 ${due}</span>`:''}</div>`;
    } else {
      html += `<div style="color:var(--tx2)">此級別無單字資料</div>`;
    }

    // 目標：累計從 base+1 到 goal 的所有級別
    let scopeRemaining = null;
    if (goal) {
      const scope = scopeLevels(base, goal);
      if (!scope.length) {
        html += `<div style="color:var(--tx2);font-size:12px;margin-top:6px">目前程度已達目標，無需再背 🎉</div>`;
      } else {
        let totalTarget = 0, totalLearned = 0;
        const parts = scope.map(l => {
          const d = getData(l);
          const cnt = d ? d.length : 0;
          const lrn = countLearned(srs, l);
          totalTarget += cnt;
          totalLearned += lrn;
          return `${l.toUpperCase()} ${lrn}/${cnt}`;
        });
        scopeRemaining = totalTarget - totalLearned;
        const baseLabel = (!base || base === 'none') ? '零基礎' : base.toUpperCase();
        html += `<div style="margin-top:6px"><strong>${baseLabel} → ${goal.toUpperCase()} 目標：</strong>${totalLearned} / ${totalTarget}</div>`;
        html += `<div style="color:var(--tx2);font-size:12px">${parts.join('　')}</div>`;
        html += `<div><strong>還要背：</strong>${scopeRemaining} 個</div>`;
      }
    } else {
      html += `<div style="color:var(--tx2);font-size:12px;margin-top:6px">選「目前程度」和「目標級別」後會顯示累計還要背多少</div>`;
    }

    // 考試倒數 + 建議
    const examIso = examEl && examEl.value ? examEl.value : '';
    if (examIso) {
      const d = new Date(examIso); d.setHours(0,0,0,0);
      const t = new Date(); t.setHours(0,0,0,0);
      const days = Math.ceil((d - t) / 86400000);
      html += `<div><strong>考試倒數：</strong>${days >= 0 ? days + ' 天' : '已過 ' + (-days) + ' 天'}</div>`;
      if (days > 0 && scopeRemaining !== null && scopeRemaining > 0) {
        const perDay = Math.ceil(scopeRemaining / days);
        html += `<div style="color:var(--ac);font-weight:600;margin-top:4px">💡 建議每天背 ${perDay} 個才背得完</div>`;
      }
    } else {
      html += `<div style="color:var(--tx2);font-size:12px;margin-top:4px">選考試日期後可看到每日建議進度</div>`;
    }
    infoEl.innerHTML = html;
  }

  // ── Start panel ──
  function start() {
    ensureStyles();
    const box = document.getElementById('quizBox');
    const curLv = typeof currentLevel !== 'undefined' ? currentLevel : 'n5';
    const exam = getExamDate();
    const base = getBaseLevel();
    const goal = getGoalLevel();
    const upcoming = getUpcomingJlptDates(6);
    // 如果已存 exam 不在列表（舊資料 / 自訂），保留它
    const inList = upcoming.some(x => x.iso === exam);
    const customOpt = exam && !inList ? `<option value="${exam}" selected>${exam}（自訂）</option>` : '';
    const examOptions = [
      `<option value="" ${!exam?'selected':''}>不設定</option>`,
      customOpt,
      ...upcoming.map(x => `<option value="${x.iso}" ${x.iso===exam?'selected':''}>${x.label}</option>`)
    ].join('');
    const baseOptions = [
      `<option value="none" ${base==='none'?'selected':''}>零基礎</option>`,
      ...LEVELS.slice(0, 4).map(l => `<option value="${l}" ${base===l?'selected':''}>${l.toUpperCase()} 已學完</option>`)
    ].join('');
    const goalOptions = [
      `<option value="" ${!goal?'selected':''}>未設定</option>`,
      ...LEVELS.map(l => `<option value="${l}" ${goal===l?'selected':''}>${l.toUpperCase()}</option>`)
    ].join('');
    const selStyle = 'width:100%';
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
        <button data-v="due">待複習</button>
        <button data-v="random">全部隨機</button>
      </div></div>
      <div class="qf" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="display:block;font-size:13px;color:var(--tx2);margin-bottom:5px;font-weight:600">目前程度</label>
          <select id="fcBase" style="${selStyle}">${baseOptions}</select>
        </div>
        <div><label style="display:block;font-size:13px;color:var(--tx2);margin-bottom:5px;font-weight:600">目標級別</label>
          <select id="fcGoal" style="${selStyle}">${goalOptions}</select>
        </div>
      </div>
      <div class="qf"><label>考試日期</label>
        <select id="fcExam" style="${selStyle}">
          ${examOptions}
        </select>
      </div>
      <div id="fcInfo" style="background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:12px;margin:14px 0;font-size:13px;line-height:1.9;color:var(--tx)"></div>
      <button class="qstart" onclick="FlashCard.begin()">開始</button>
      <button class="qclose" onclick="FlashCard.close()">取消</button>`;
    box.querySelectorAll('.qo').forEach(g => {
      g.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          g.querySelectorAll('button').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          if (g.id === 'fcLevel') renderStartInfo();
        };
      });
    });
    const sel = document.getElementById('fcExam');
    sel.addEventListener('change', () => {
      setExamDate(sel.value);
      renderStartInfo();
    });
    const baseSel = document.getElementById('fcBase');
    baseSel.addEventListener('change', () => { setBaseLevel(baseSel.value); renderStartInfo(); });
    const goalSel = document.getElementById('fcGoal');
    goalSel.addEventListener('change', () => { setGoalLevel(goalSel.value); renderStartInfo(); });
    renderStartInfo();
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
    // 「已學」= 至少一次記得；只打過不熟/不會的不算，新詞模式仍會出現
    const learned = new Set(Object.keys(srs).filter(k => k.startsWith(pf) && (srs[k].correct || 0) > 0).map(k => k.slice(pf.length)));
    let pool;
    if (range === 'new') {
      pool = data.filter(d => !learned.has(d.w));
      if (pool.length < count) pool = data; // 學完所有新詞就回到全部
    } else if (range === 'due') {
      const now = Date.now();
      pool = data.filter(d => SRS.isDue(srs[pf + d.w], now));
      if (!pool.length) pool = data.filter(d => !learned.has(d.w));
      if (!pool.length) pool = data;
    } else {
      pool = data;
    }
    queue = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
    cur = 0;
    score = { known: 0, soso: 0, unknown: 0 };
    reappearCount = {};
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
        <span style="font-weight:600">
          <span style="color:var(--correct-bd)">✓${score.known}</span>
          <span style="color:var(--ac);margin-left:6px">◯${score.soso}</span>
          <span style="color:var(--wrong-bd);margin-left:6px">✗${score.unknown}</span>
        </span>
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
          ${Array.isArray(item.e)&&item.e.length?`<div class="fc-ex">${item.e.map(ex=>`<div class="fc-ex-row"><div class="fc-ex-j">${ex.j}<svg class="fc-ex-spk" onclick="event.stopPropagation();speak('${(ex.j||'').replace(/'/g,"\\'")}')" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg></div><div class="fc-ex-z">${typeof cvt==='function'?cvt(ex.z):ex.z}</div></div>`).join('')}</div>`:''}
          <div class="fc-btns">
            <button class="fc-btn fc-no" onclick="event.stopPropagation();FlashCard.answer('unknown')">✗ 不會<span class="fc-btn-hint">${gradeLabel('unknown')}</span></button>
            <button class="fc-btn fc-soso" onclick="event.stopPropagation();FlashCard.answer('soso')">◯ 不熟<span class="fc-btn-hint">${gradeLabel('soso')}</span></button>
            <button class="fc-btn fc-yes" onclick="event.stopPropagation();FlashCard.answer('known')">✓ 記得<span class="fc-btn-hint">${gradeLabel('known')}</span></button>
          </div>
          <div class="fc-hint">手機可左滑（不會）／右滑（記得）</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:10px">
        <button onclick="event.stopPropagation();speak('${(item.r||item.w).replace(/'/g,"\\'")}')" style="background:var(--bg3);border:1px solid var(--bd);border-radius:20px;padding:6px 16px;cursor:pointer;color:var(--ac2);font-size:13px">🔊 播音</button>
      </div>`;
    // 不自動播音，使用者要聽點 🔊 按鈕
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

  function answer(grade) {
    // 相容：舊呼叫 answer(true/false)
    if (grade === true) grade = 'known';
    else if (grade === false) grade = 'unknown';
    const valid = typeof SRS !== 'undefined' && SRS.GRADES && SRS.GRADES[grade];
    if (!valid) grade = 'unknown';
    const item = queue[cur];
    score[grade]++;
    // 單一寫入點：走 SRS 模組，不再繞過直寫 localStorage
    if (typeof SRS !== 'undefined' && SRS.recordGrade) SRS.recordGrade(level, item.w, grade);
    if (typeof Calendar !== 'undefined') Calendar.logActivity('vocab');

    // 本輪內重現（不熟/不會）
    if (grade !== 'known') {
      const tries = reappearCount[item.w] || 0;
      if (tries < MAX_REAPPEAR) {
        const offset = REQUEUE_OFFSET[grade] || 3;
        const insertAt = Math.min(queue.length, cur + 1 + offset);
        queue.splice(insertAt, 0, item);
        reappearCount[item.w] = tries + 1;
      }
    }

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
      if (!flipped) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        answer(dx > 0 ? 'known' : 'unknown');
      }
    }, { passive: true });
  }

  function showResults() {
    clearInterval(timerId);
    const total = score.known + score.soso + score.unknown;
    const pct = total ? Math.round(score.known / total * 100) : 0;
    const days = daysUntilExam();
    const srs = JSON.parse(localStorage.getItem('srs_data') || '{}');
    const base = getBaseLevel(), goal = getGoalLevel();

    // 本級進度
    const data = getData(level);
    const lvLearned = countLearned(srs, level);
    const lvTotal = data.length;

    // 目標累計
    let scopeHtml = '';
    let scopeRemaining = null;
    if (goal) {
      const scope = scopeLevels(base, goal);
      if (scope.length) {
        let totalTarget = 0, totalLearned = 0;
        scope.forEach(l => {
          const d = getData(l);
          totalTarget += d ? d.length : 0;
          totalLearned += countLearned(srs, l);
        });
        scopeRemaining = totalTarget - totalLearned;
        const baseLabel = (!base || base === 'none') ? '零基礎' : base.toUpperCase();
        scopeHtml = `<div style="margin-top:4px"><strong>${baseLabel} → ${goal.toUpperCase()} 目標：</strong>${totalLearned} / ${totalTarget}（還要背 ${scopeRemaining} 個）</div>`;
      }
    }
    const perDaySug = days && days > 0 && scopeRemaining !== null && scopeRemaining > 0
      ? Math.ceil(scopeRemaining / days)
      : (days && days > 0 && lvTotal - lvLearned > 0 ? Math.ceil((lvTotal - lvLearned) / days) : null);

    // 本輪評分明細 + 下次複習時間
    const breakdown = [];
    if (score.known) breakdown.push(`<div><span style="color:var(--correct-bd);font-weight:600">✓ 記得 ${score.known} 個</span>　<span style="color:var(--tx2)">${gradeLabel('known')}再複習</span></div>`);
    if (score.soso) breakdown.push(`<div><span style="color:var(--ac);font-weight:600">◯ 不熟 ${score.soso} 個</span>　<span style="color:var(--tx2)">${gradeLabel('soso')}再複習</span></div>`);
    if (score.unknown) breakdown.push(`<div><span style="color:var(--wrong-bd);font-weight:600">✗ 不會 ${score.unknown} 個</span>　<span style="color:var(--tx2)">${gradeLabel('unknown')}再複習</span></div>`);

    document.getElementById('quizBox').innerHTML = `
      <h3>本輪結束</h3>
      <div class="qscore ${pct>=80?'good':pct>=60?'ok':'bad'}">${score.known} / ${total}（${pct}%）</div>
      <div style="background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:12px 14px;margin:10px 0;font-size:13px;line-height:1.9;color:var(--tx)">
        ${breakdown.join('') || '<div style="color:var(--tx2)">（尚未作答）</div>'}
      </div>
      <div style="background:var(--bg3);border:1px solid var(--bd);border-radius:10px;padding:14px;margin:10px 0 14px;font-size:13px;line-height:1.9;color:var(--tx)">
        <div><strong>${level.toUpperCase()} 進度：</strong>${lvLearned} / ${lvTotal}（已學 ${Math.round(lvLearned/lvTotal*100)}%）</div>
        ${scopeHtml}
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

  // 快速背「今日批次」：吃 index.html 的 dailyMode 當前批次 (currentLevel + DAILY_NEW + getDailyProgress)
  function beginToday() {
    ensureStyles();
    const lv = typeof currentLevel !== 'undefined' ? currentLevel : 'n5';
    const data = getData(lv);
    if (!data || !data.length) { alert('此級別無單字資料'); return; }
    if (typeof getDailyProgress !== 'function' || typeof DAILY_NEW === 'undefined') {
      alert('今日批次功能未就緒'); return;
    }
    const prog = getDailyProgress(lv);
    const start = prog.totalOffset || 0;
    const end = Math.min(start + DAILY_NEW, data.length);
    const batch = data.slice(start, end);
    if (!batch.length) { alert('今日批次無單字'); return; }
    level = lv;
    queue = [...batch].sort(() => Math.random() - 0.5);
    cur = 0;
    score = { known: 0, soso: 0, unknown: 0 };
    reappearCount = {};
    document.getElementById('quizBg').classList.add('show');
    renderCard();
  }

  return { start, begin, beginToday, flip, answer, close, getExamDate, setExamDate, daysUntilExam };
})();
