/* Connext 1.4.1 — no requests, analytics, or changes to school records. */
(() => {
  'use strict';
  if (window.__connectTea141) return;
  window.__connectTea141 = true;
  const memory = new Map();
  const panels = new WeakMap();
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const numeric = x => x !== null && x !== undefined && x !== '' &&
    (typeof x === 'number' || typeof x === 'string') && Number.isFinite(Number(x)) ? Number(x) : undefined;
  const fmt = x => Number.isFinite(x) ? String(Math.round(x * 100) / 100) : 'unavailable';
  const validSize = value => Number.isSafeInteger(numeric(value)) && Number(value) >= 1 ? Number(value) : undefined;

  function schoolText(card) {
    // Vaadin lays out separate labels inline without spaces in innerText.
    return [card.innerText, ...Array.from(card.querySelectorAll('.v-label')).map(e=>e.textContent)].join(' ');
  }
  function automaticCohort(title, year11OnPage, school) {
    if (!year11OnPage || !/\bWilletton\s+Senior\s+High\s*School\b/i.test(school||'')) return undefined;
    // A mixed-year page must not apply Year 11 numbers to an explicit Year 12 card.
    const year = title.match(/\bYear\s*(\d{1,2})\b/i);
    if (year && Number(year[1]) !== 11) return undefined;
    const essentials = /\bmathematics essentials?\b/i.test(title);
    if (!essentials && !/\bATAR\b/i.test(title)) return undefined;
    if (essentials) return 117;
    const subject = norm(title).toLowerCase().replace(/\s*[-–—]\s*semester\s+[12]\s*$/i, '')
      .replace(/\batar\b|\byear\s*11\b/g, '').replace(/\s+/g, ' ').trim().replace(/\s*:\s*$/, '');
    const defaults = {
      'mathematics specialist':64, 'mathematics methods':219, 'methods':219,
      'japanese':44, 'japanese: second language':44, 'japanese second language':44,
      'music':10, 'computer science':11, 'eald':9, 'english as an additional language or dialect':9, 'english as an additional language/dialect':9, 'english as an additional dialect':9, 'english as additional dialect':9,
      'biology':61, 'human biology':183, 'french':21, 'french: second language':21, 'french second language':21, 'politics and law':35, 'business management and enterprise':24,
      'physics':111, 'chemistry':224, 'literature':52, 'italian':20, 'italian: second language':20,
      'italian second language':20, 'economics':44, 'modern history':15, 'mathematics applications':189, 'mathematics application':189, 'accounting':36, 'accounting and finance':36
    };
    return defaults[subject];
  }

  function validStats(s) {
    return Array.isArray(s) && s.length === 5 && s.every(Number.isFinite) && s.every((v, i) => !i || v >= s[i - 1]);
  }
  // Monotone cubic spline (PCHIP) through the 5 published quantiles with zero tail slopes.
  function percentile(s, mark, n) {
    if (!validStats(s) || !Number.isFinite(mark)) return undefined;
    if (mark <= s[0]) return 0;
    if (mark >= s[4]) return 1;

    const ties = [];
    for (let i = 0; i < 5; i++) if (s[i] === mark) ties.push(i);
    if (ties.length > 0) {
      const qValues = [0, 0.25, 0.50, 0.75, 1];
      return (qValues[ties[0]] + qValues[ties[ties.length - 1]]) / 2;
    }

    const p0 = validSize(n) ? 0.5 / n : 0.005;
    const p4 = validSize(n) ? 1 - 0.5 / n : 0.995;
    const x = [s[0], s[1], s[2], s[3], s[4]];
    const y = [p0, 0.25, 0.50, 0.75, p4];

    const h = [];
    const delta = [];
    for (let i = 0; i < 4; i++) {
      h[i] = x[i + 1] - x[i];
      delta[i] = h[i] > 0 ? (y[i + 1] - y[i]) / h[i] : 0;
    }

    const d = [0, 0, 0, 0, 0];
    for (let i = 1; i < 4; i++) {
      if (delta[i - 1] > 0 && delta[i] > 0) {
        d[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
      } else {
        d[i] = 0;
      }
    }
    d[0] = 0;
    d[4] = 0;

    for (let i = 0; i < 4; i++) {
      if (mark >= x[i] && mark <= x[i + 1]) {
        if (h[i] === 0) return y[i];
        const t = (mark - x[i]) / h[i];
        const t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        const val = y[i] * h00 + h[i] * d[i] * h10 + y[i + 1] * h01 + h[i] * d[i + 1] * h11;
        return Math.max(0, Math.min(1, val));
      }
    }
    return 0.5;
  }
  function summary(s, mark, n) {
    if (!validStats(s)) return null;
    // Approximate the mean by integrating the piecewise-linear quantile curve.
    const mean = (s[0] + 2*s[1] + 2*s[2] + 2*s[3] + s[4]) / 8;
    // Integrate variance over the SAME estimated quantile distribution as the mean.
    // Each quartile is a uniform interval with probability 1/4.
    let variance = 0;
    for (let i = 0; i < 4; i++) {
      const a = s[i] - mean, b = s[i + 1] - mean;
      variance += (a*a + a*b + b*b) / 12;
    }
    const sd = Math.sqrt(Math.max(0, variance));
    const p = percentile(s, mark, n);
    const rank = Number.isFinite(p) && validSize(n) ? Math.max(1, Math.min(n, Math.round(1 + (n - 1) * (1 - p)))) : undefined;
    return { mean, sd, p, rank, z: Number.isFinite(mark) && sd > 0 ? (mark - mean) / sd : undefined };
  }
  function standing(p) {
    if (!Number.isFinite(p)) return '';
    if (p >= 1) return "You're at the top of the cohort";
    if (p <= 0) return "You're at the bottom of the cohort";
    const side = p <= 0.5 ? 'bottom' : 'top';
    const pct = 100 * (p <= 0.5 ? p : 1 - p);
    let str;
    if (pct < 0.1) str = '< 0.1%';
    else if (pct < 10) str = Number(pct.toFixed(1)) + '%';
    else str = (pct % 1 === 0 ? pct.toFixed(0) : Number(pct.toFixed(1))) + '%';
    return `You're in the ${side} ${str} of the cohort`;
  }
  function readMark(row) {
    // Read only the raw score cell: never the task week or weighted mark.
    const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark');
    const text = norm(cell?.textContent);
    let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (match) return Number(match[1]);
    match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    return match && Number(match[2]) > 0 ? 100 * Number(match[1]) / Number(match[2]) : undefined;
  }
  function readStats(row) {
    const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
    if (!host) return null;
    const chart = window.Highcharts?.charts?.[Number(host.getAttribute('data-highcharts-chart'))];
    // A destroyed chart index must not accidentally select another subject's chart.
    if (!chart || (chart.container && !host.contains(chart.container))) return null;
    for (const series of chart.series || []) {
      for (const point of [...(series.points || []), ...(series.options?.data || [])]) {
        const p = point?.options || point;
        const s = Array.isArray(p) ? p.slice(-5).map(numeric) : [p?.low, p?.q1, p?.median, p?.q3, p?.high].map(numeric);
        if (validStats(s)) return s;
      }
    }
    return null;
  }
  function subjectKey(card) {
    const title = norm(card.querySelector('.eds-c-tile__title')?.textContent);
    if (!title) return null;
    // Share a subject count across semesters, while separating students and years.
    const student = new URL(location.href).searchParams.get('coisp') || 'current';
    const subject = title.replace(/\s*[-–—]\s*Semester\s+[12]\s*$/i, '').trim();
    return `connectea:cohort:v3:${student}:${new Date().getFullYear()}:${subject}`;
  }
  function load(key) {
    if (!key) return undefined;
    if (memory.has(key)) return memory.get(key);
    try {
      let stored = localStorage.getItem(key);
      if (stored === null) {
        // Migrate an existing saved count. Semester 2 wins if older entries conflict.
        const old = key.replace('connectea:cohort:v3:', 'connectea:cohort:v2:');
        const migrated = validSize(localStorage.getItem(old + ' - Semester 2')) ?? validSize(localStorage.getItem(old + ' - Semester 1'));
        if (migrated !== undefined) { stored = String(migrated); localStorage.setItem(key, stored); }
      }
      const n = validSize(stored); memory.set(key, n); return n;
    }
    catch { return undefined; }
  }
  function save(key, n) {
    memory.set(key, n);
    try {
      if (n === undefined) localStorage.setItem(key, "");
      else localStorage.setItem(key, String(n));
      return true;
    } catch { return false; }
  }
  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
  function element(tag, cls, text) {
    const el = document.createElement(tag); el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
  function createPanel(row, overall, key, autoSize) {
    const box = element('section', 'connectea-panel');
    box.setAttribute('aria-label', overall ? 'Connext overall subject statistics' : 'Connext assessment statistics');
    const distribution = element('div', 'connectea-distribution');
    const result = element('div', 'connectea-result');
    result.setAttribute('aria-live', 'polite');
    const resultRow = element('div', 'connectea-result-row');
    resultRow.append(result);
    box.append(distribution, resultRow);
    let input;
    let notice;
    if (overall && key && autoSize === undefined) {
      const label = element('label', 'connectea-controls', 'Students in this subject: ');
      input = element('input', 'connectea-subject-cohort-input');
      input.type = 'number'; input.min = '1'; input.step = '1'; input.placeholder = 'e.g. 120';
      input.setAttribute('aria-label', 'Students in this subject');
      input.value = load(key) ?? '';
      label.append(input);
      notice = element('span', 'connectea-notice', load(key) ? 'Saved for both semesters.' : 'Enter once; shared across semesters 1 and 2.');
      notice.setAttribute('aria-live', 'polite');
      const controls = element('div', 'connectea-subject-controls');
      controls.append(label, notice);
      box.append(controls);
      input.addEventListener('input', () => {
        const n = validSize(input.value);
        const invalid = input.value !== '' && !n || input.validity.badInput;
        input.setAttribute('aria-invalid', String(Boolean(invalid)));
        const persisted = save(key, n);
        setText(notice, invalid ? 'Enter a whole number of students, at least 1.' : n ? (persisted ? 'Saved for both semesters.' : 'Used for this visit; browser storage is unavailable.') : 'Enter once; shared across semesters 1 and 2.');
        schedule();
      });
      // Keep Connect’s card click handlers from capturing editing interactions.
      for (const event of ['click', 'keydown']) input.addEventListener(event, e => e.stopPropagation());
    }
    const target = row.querySelector('.cvr-c-task__details') || row;
    target.append(box);
    const state = {box, distribution, result, input, key, overall, autoSize};
    panels.set(row, state);
    return state;
  }
  function render(row, overall, key, autoSize) {
    let ui = panels.get(row);
    const mark = readMark(row);
    if (!overall && !Number.isFinite(mark)) {
      ui?.box.remove();
      panels.delete(row);
      return;
    }
    if (ui && (!ui.box.isConnected || ui.key !== key || ui.overall !== overall || ui.autoSize !== autoSize)) { ui.box.remove(); ui = null; }
    if (!ui) ui = createPanel(row, overall, key, autoSize);
    const n = autoSize ?? load(key);
    if (ui.input && document.activeElement !== ui.input && ui.input.getAttribute('aria-invalid') !== 'true') {
      const value = n === undefined ? '' : String(n);
      if (ui.input.value !== value) ui.input.value = value;
    }
    const s = readStats(row);
    const data = summary(s, mark, n);
    if (!data) {
      setText(ui.distribution, 'Cohort mean and boxplot statistics unavailable');
      setText(ui.result, Number.isFinite(mark) ? 'Rank and z-score unavailable' : 'Not marked · Rank and z-score unavailable');
      return;
    }
    setText(ui.distribution, `Low ${fmt(s[0])}%  •  Q1 ${fmt(s[1])}%  •  Median (Q2) ${fmt(s[2])}%  •  Q3 ${fmt(s[3])}%  •  High ${fmt(s[4])}%  •  Cohort mean ${fmt(data.mean)}%  •  SD ${fmt(data.sd)}`);
    const parts = [];
    if (Number.isFinite(mark)) {
      if (!overall) parts.push(`You scored ${fmt(mark)}% in this test`);
      parts.push(`z-score ${Number.isFinite(data.z) ? '≈ ' + String(Number(data.z.toFixed(2))) : 'unavailable (zero SD)'}`);
      parts.push(standing(data.p));
      if (data.rank !== undefined) parts.push(data.rank===1 ? `You're the top of the cohort for this ${overall?'subject':'test'}` : `Your estimated ${overall ? 'subject' : 'assessment'} rank is ${data.rank} out of ${n}`);
      else parts.push('Enter subject cohort size for rank');
    } else parts.push('Not marked · Rank and z-score unavailable');
    setText(ui.result, parts.join('  •  '));
  }
  const css = `.connectea-panel{box-sizing:border-box;min-width:0;max-width:100%;width:100%;clear:both;margin:8px 0;padding:11px 13px;border:1px solid #b9cbe1;border-radius:8px;background:#f3f7fc;color:#253b53;font:12px/1.6 system-ui,sans-serif;white-space:normal;overflow-wrap:anywhere}.connectea-distribution{font-weight:600}.connectea-subject-controls{margin-top:8px;padding-top:8px;border-top:1px solid #d3dfed}.connectea-title{display:block;font-size:13px;color:#203c5e}.connectea-controls{font-size:10px;display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px;margin:4px 6px 3px 0;font-weight:400}.connectea-controls input{box-sizing:border-box;width:72px;min-height:24px;border:1px solid #8599b1;border-radius:5px;background:white;color:#203348;padding:2px 5px;font:inherit}.connectea-controls input:focus{outline:2px solid #3575b9;outline-offset:2px}.connectea-controls input[aria-invalid=true]{border-color:#b62727}.connectea-notice{display:block;color:#4e6076;font-size:11px}.connectea-result-row{display:flex;align-items:baseline;gap:8px 14px;flex-wrap:wrap;margin-top:5px}.connectea-result{font-weight:600;flex:1 1 260px}`;
  let queued = false;
  function pass() {
    if (!document.getElementById('connectea-style')) {
      const style = element('style', ''); style.id = 'connectea-style'; style.textContent = css; document.head.append(style);
    }
    const year11OnPage = /\bYear\s*11\b/i.test(document.body.innerText);
    for (const card of document.querySelectorAll('.eds-c-tile')) {
      if (!card.querySelector('.eds-c-tile__title')) continue;
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(row => row.closest('.eds-c-tile') === card);
      if (!rows.length) continue;
      const key = subjectKey(card);
      const autoSize = automaticCohort(norm(card.querySelector('.eds-c-tile__title')?.textContent), year11OnPage, schoolText(card));
      for (const row of rows) {
        // Summary row has no task details and sits outside the assessments accordion.
        const overall = !row.closest('.cvr-c-tasks');
        try { render(row, overall, key, autoSize); } catch (error) { console.debug('Connext:', error); }
      }
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; pass(); });
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => !r.target.parentElement?.closest('.connectea-panel') && !r.target.closest?.('.connectea-panel') && r.target.id !== 'connectea-style')) schedule();
  });
  observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['data-highcharts-chart']});
  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', e => { if (e.key?.startsWith('connectea:cohort:v3:')) { memory.delete(e.key); schedule(); } });
  // Charts can populate their data after their DOM shell has appeared.
  let timer = setInterval(schedule, 1500);
  window.addEventListener('pagehide', () => { clearInterval(timer); observer.disconnect(); });
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    observer.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['data-highcharts-chart']});
    timer = setInterval(schedule, 1500);
    schedule();
  });
  schedule();
})();
