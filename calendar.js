// ========== STUDY CALENDAR (GitHub Heatmap Style) ==========
const Calendar = (() => {
  const SKEY = 'study_log';

  function getLog() {
    try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch(e) { return {}; }
  }
  function saveLog(log) { localStorage.setItem(SKEY, JSON.stringify(log)); }
  function today() { return new Date().toISOString().split('T')[0]; }

  // Record an activity: type = 'vocab' | 'grammar' | 'quiz'
  function logActivity(type) {
    const log = getLog();
    const d = today();
    if (!log[d]) log[d] = { vocab: 0, grammar: 0, quiz: 0, minutes: 0 };
    if (type === 'vocab') log[d].vocab++;
    else if (type === 'grammar') log[d].grammar++;
    else if (type === 'quiz') log[d].quiz++;
    saveLog(log);
    if (typeof saveAllCloud === 'function') saveAllCloud();
  }

  // Calculate streaks
  function getStreaks() {
    const log = getLog();
    const t = today();
    let current = 0;
    let longest = 0;
    let streak = 0;
    // Walk backwards from today
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = d.toISOString().split('T')[0];
      if (log[key] && (log[key].vocab > 0 || log[key].grammar > 0 || log[key].quiz > 0)) {
        streak++;
      } else {
        if (i === 0) { /* today has no activity yet, continue checking */ }
        else break;
      }
      d.setDate(d.getDate() - 1);
    }
    current = streak;

    // Longest streak: scan all dates
    const dates = Object.keys(log).filter(k =>
      log[k].vocab > 0 || log[k].grammar > 0 || log[k].quiz > 0
    ).sort();
    longest = 0;
    let run = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) { run = 1; }
      else {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        run = diff === 1 ? run + 1 : 1;
      }
      if (run > longest) longest = run;
    }

    return { current, longest };
  }

  // Get activity level for a date (0-3)
  function getLevel(dayData) {
    if (!dayData) return 0;
    const total = (dayData.vocab || 0) + (dayData.grammar || 0) + (dayData.quiz || 0);
    if (total === 0) return 0;
    if (total <= 5) return 1;
    if (total <= 15) return 2;
    return 3;
  }

  // Get today's summary
  function getTodaySummary() {
    const log = getLog();
    const d = log[today()];
    if (!d) return { vocab: 0, grammar: 0, quiz: 0, total: 0 };
    const total = (d.vocab || 0) + (d.grammar || 0) + (d.quiz || 0);
    return { vocab: d.vocab || 0, grammar: d.grammar || 0, quiz: d.quiz || 0, total };
  }

  // Build 90-day heatmap HTML
  function buildHeatmap() {
    const log = getLog();
    const DAYS = 91; // ~13 weeks
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - DAYS + 1);

    // Align startDate to Sunday (start of week)
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    // Recalculate total columns
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const weeks = Math.ceil(totalDays / 7);

    // Month labels
    const months = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + w * 7);
      const m = d.getMonth();
      if (m !== lastMonth) {
        const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
        months.push({ col: w, label: labels[m] });
        lastMonth = m;
      }
    }

    // Day-of-week labels
    const dayLabels = ['日','月','火','水','木','金','土'];

    // Build month label row
    let monthRow = '<div class="cal-row cal-months"><span class="cal-day-lbl"></span>';
    let mi = 0;
    for (let w = 0; w < weeks; w++) {
      if (mi < months.length && months[mi].col === w) {
        monthRow += `<span class="cal-month-lbl">${months[mi].label}</span>`;
        mi++;
      } else {
        monthRow += '<span class="cal-month-lbl"></span>';
      }
    }
    monthRow += '</div>';

    // Build day rows
    let gridHTML = '';
    for (let dow = 0; dow < 7; dow++) {
      gridHTML += '<div class="cal-row">';
      gridHTML += `<span class="cal-day-lbl">${dow % 2 === 1 ? dayLabels[dow] : ''}</span>`;
      for (let w = 0; w < weeks; w++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + w * 7 + dow);
        const key = d.toISOString().split('T')[0];
        const isFuture = d > endDate;
        if (isFuture) {
          gridHTML += '<span class="cal-cell" data-level="empty"></span>';
        } else {
          const level = getLevel(log[key]);
          const dayData = log[key];
          const tip = dayData
            ? `${key}：詞彙 ${dayData.vocab||0}・文法 ${dayData.grammar||0}・測驗 ${dayData.quiz||0}`
            : `${key}：無活動`;
          gridHTML += `<span class="cal-cell" data-level="${level}" title="${tip}"></span>`;
        }
      }
      gridHTML += '</div>';
    }

    return `<div class="cal-heatmap">
      <div class="cal-grid">
        ${monthRow}
        ${gridHTML}
      </div>
      <div class="cal-legend">
        <span class="cal-legend-tx">少</span>
        <span class="cal-cell cal-legend-cell" data-level="0"></span>
        <span class="cal-cell cal-legend-cell" data-level="1"></span>
        <span class="cal-cell cal-legend-cell" data-level="2"></span>
        <span class="cal-cell cal-legend-cell" data-level="3"></span>
        <span class="cal-legend-tx">多</span>
      </div>
    </div>`;
  }

  // Build progress bar
  function buildProgress() {
    const summary = getTodaySummary();
    const goal = 30; // daily goal: 30 activities
    const pct = Math.min(Math.round(summary.total / goal * 100), 100);
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `<div class="cal-progress">
      <span>今日目標：</span>
      <span class="cal-prog-bar">${bar}</span>
      <span class="cal-prog-pct">${pct}%</span>
    </div>`;
  }

  // Render full panel HTML (returns string)
  function getPanelHTML() {
    const streaks = getStreaks();
    const summary = getTodaySummary();
    const todayParts = [];
    if (summary.vocab > 0) todayParts.push(`${summary.vocab} 詞彙`);
    if (summary.grammar > 0) todayParts.push(`${summary.grammar} 文法`);
    if (summary.quiz > 0) todayParts.push(`${summary.quiz} 測驗`);
    const todayText = todayParts.length > 0 ? `已學 ${summary.total} 項` : '尚未開始';

    return `<div class="cal-panel">
      <div class="cal-streak">
        <span class="cal-streak-fire">🔥 連續 ${streaks.current} 天</span>
        <span class="cal-streak-sep">|</span>
        <span>最長 ${streaks.longest} 天</span>
        <span class="cal-streak-sep">|</span>
        <span>今日：${todayText}</span>
      </div>
      ${buildHeatmap()}
      ${buildProgress()}
    </div>`;
  }

  // Render panel into DOM (first child of main)
  function renderPanel() {
    let panel = document.getElementById('calPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'calPanel';
      const mn = document.getElementById('mn');
      if (mn) mn.prepend(panel);
    }
    panel.innerHTML = getPanelHTML();
  }

  return { logActivity, renderPanel, getStreaks, getTodaySummary };
})();
