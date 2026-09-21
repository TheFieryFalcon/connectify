/**
 * Connext Cohort Statistics & Rank Estimator
 *
 * Reads Highcharts 5-number boxplot statistics (min, Q1, median, Q3, max),
 * computes estimated cohort mean, standard deviation, z-score,
 * smooth PCHIP-interpolated percentile, and estimated rank.
 * Injects statistics panels directly into Connect assessment rows.
 */
(() => {
  'use strict';

  if (window.__connectTea141) return;
  window.__connectTea141 = true;

  const memory = new Map();
  const panels = new WeakMap();

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const toNumeric = value => {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  };

  const formatPercentage = value => (Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'unavailable');

  const validCohortSize = value => {
    const num = toNumeric(value);
    return Number.isSafeInteger(num) && num >= 1 ? num : undefined;
  };

  /**
   * Concatenates card innerText and separate Vaadin label elements.
   */
  function extractSchoolText(card) {
    return [card.innerText, ...Array.from(card.querySelectorAll('.v-label')).map(e => e.textContent)].join(' ');
  }

  /**
   * Preset cohort sizes for Willetton Senior High School Year 11 ATAR courses.
   */
  function automaticCohort(title, isYear11OnPage, schoolText) {
    if (!isYear11OnPage || !/\bWilletton\s+Senior\s+High\s*School\b/i.test(schoolText || '')) {
      return undefined;
    }

    // A mixed-year page must not apply Year 11 presets to an explicit Year 12 card
    const yearMatch = title.match(/\bYear\s*(\d{1,2})\b/i);
    if (yearMatch && Number(yearMatch[1]) !== 11) {
      return undefined;
    }

    const isEssentials = /\bmathematics essentials?\b/i.test(title);
    if (!isEssentials && !/\bATAR\b/i.test(title)) {
      return undefined;
    }
    if (isEssentials) return 117;

    const subject = normalize(title)
      .toLowerCase()
      .replace(/\s*[-–—]\s*semester\s+[12]\s*$/i, '')
      .replace(/\batar\b|\byear\s*11\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*:\s*$/, '');

    const defaults = {
      'mathematics specialist': 64,
      'mathematics methods': 219,
      'methods': 219,
      'japanese': 44,
      'japanese: second language': 44,
      'japanese second language': 44,
      'music': 10,
      'computer science': 11,
      'eald': 9,
      'english as an additional language or dialect': 9,
      'english as an additional language/dialect': 9,
      'english as an additional dialect': 9,
      'english as additional dialect': 9,
      'biology': 61,
      'human biology': 183,
      'french': 21,
      'french: second language': 21,
      'french second language': 21,
      'politics and law': 35,
      'business management and enterprise': 24,
      'physics': 111,
      'chemistry': 224,
      'literature': 52,
      'italian': 20,
      'italian: second language': 20,
      'italian second language': 20,
      'economics': 44,
      'modern history': 15,
      'mathematics applications': 189,
      'mathematics application': 189,
      'accounting': 36,
      'accounting and finance': 36
    };

    return defaults[subject];
  }

  /**
   * Validate that an array forms an ordered 5-number summary [min, Q1, median, Q3, max].
   */
  function validStats(stats) {
    return (
      Array.isArray(stats) &&
      stats.length === 5 &&
      stats.every(Number.isFinite) &&
      stats.every((v, i) => !i || v >= stats[i - 1])
    );
  }

  /**
   * Monotone Piecewise Cubic Hermite Interpolation (PCHIP) across the 5 published quantiles.
   * Enforces zero slopes at the minimum and maximum observed cohort scores to realistically
   * model bell-shaped score clustering and tail drop-off without overshooting or oscillation.
   *
   * @param {number[]} stats - [min, Q1, median, Q3, max]
   * @param {number} mark - Student percentage score
   * @param {number} [cohortSize] - Total students in subject
   * @returns {number|undefined} Estimated cumulative percentile in [0, 1]
   */
  function percentile(stats, mark, cohortSize) {
    if (!validStats(stats) || !Number.isFinite(mark)) return undefined;
    if (mark <= stats[0]) return 0;
    if (mark >= stats[4]) return 1;

    // Direct anchor hits: if the mark matches one or more quantiles, return their average rank
    const ties = [];
    for (let i = 0; i < 5; i++) {
      if (stats[i] === mark) ties.push(i);
    }
    if (ties.length > 0) {
      const qValues = [0, 0.25, 0.5, 0.75, 1];
      return (qValues[ties[0]] + qValues[ties[ties.length - 1]]) / 2;
    }

    const n = validCohortSize(cohortSize);
    const p0 = n ? 0.5 / n : 0.005;
    const p4 = n ? 1 - 0.5 / n : 0.995;
    const x = [stats[0], stats[1], stats[2], stats[3], stats[4]];
    const y = [p0, 0.25, 0.5, 0.75, p4];

    // Compute interval spans and secant slopes
    const h = [];
    const delta = [];
    for (let i = 0; i < 4; i++) {
      h[i] = x[i + 1] - x[i];
      delta[i] = h[i] > 0 ? (y[i + 1] - y[i]) / h[i] : 0;
    }

    // Compute interior slopes using Fritsch-Carlson harmonic means
    const d = [0, 0, 0, 0, 0];
    for (let i = 1; i < 4; i++) {
      if (delta[i - 1] > 0 && delta[i] > 0) {
        d[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
      } else {
        d[i] = 0;
      }
    }
    // Zero-slope boundary condition at observed extremes
    d[0] = 0;
    d[4] = 0;

    // Evaluate cubic Hermite polynomial within the containing quantile interval
    for (let i = 0; i < 4; i++) {
      if (mark >= x[i] && mark <= x[i + 1]) {
        if (h[i] === 0) return y[i];
        const t = (mark - x[i]) / h[i];
        const t2 = t * t;
        const t3 = t2 * t;
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

  /**
   * Computes sample statistics and estimated rank from the 5-number boxplot summary.
   */
  function summary(stats, mark, cohortSize) {
    if (!validStats(stats)) return null;

    // Weighted mean: (min + 2*Q1 + 2*Median + 2*Q3 + max) / 8
    const mean = (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;

    // Integrate variance across the estimated quantile intervals
    let variance = 0;
    for (let i = 0; i < 4; i++) {
      const a = stats[i] - mean;
      const b = stats[i + 1] - mean;
      variance += (a * a + a * b + b * b) / 12;
    }
    const sd = Math.sqrt(Math.max(0, variance));

    const p = percentile(stats, mark, cohortSize);
    const n = validCohortSize(cohortSize);
    const rank = Number.isFinite(p) && n ? Math.max(1, Math.min(n, Math.round(1 + (n - 1) * (1 - p)))) : undefined;

    return {
      mean,
      sd,
      p,
      rank,
      z: Number.isFinite(mark) && sd > 0 ? (mark - mean) / sd : undefined
    };
  }

  /**
   * Generates readable cohort standing text with decimal precision.
   */
  function standing(p) {
    if (!Number.isFinite(p)) return '';
    if (p >= 1) return "You're at the top of the cohort";
    if (p <= 0) return "You're at the bottom of the cohort";

    const side = p <= 0.5 ? 'bottom' : 'top';
    const pct = 100 * (p <= 0.5 ? p : 1 - p);

    let pctString;
    if (pct < 0.1) {
      pctString = '< 0.1%';
    } else if (pct < 10) {
      pctString = Number(pct.toFixed(1)) + '%';
    } else {
      pctString = (pct % 1 === 0 ? pct.toFixed(0) : Number(pct.toFixed(1))) + '%';
    }

    return `You're in the ${side} ${pctString} of the cohort`;
  }

  /**
   * Reads raw assessment score percentage from the task row.
   */
  function readMark(row) {
    const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark');
    const text = normalize(cell?.textContent);

    let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (match) return Number(match[1]);

    match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    return match && Number(match[2]) > 0 ? (100 * Number(match[1])) / Number(match[2]) : undefined;
  }

  /**
   * Reads 5-number boxplot summary from Highcharts on the task row.
   */
  function readStats(row) {
    const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
    if (!host) return null;

    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return null;

    for (const series of chart.series || []) {
      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        const stats = Array.isArray(pointData)
          ? pointData.slice(-5).map(toNumeric)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(toNumeric);

        if (validStats(stats)) return stats;
      }
    }

    return null;
  }

  function subjectKey(card) {
    const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
    if (!title) return null;

    const student = new URL(location.href).searchParams.get('coisp') || 'current';
    const subject = title.replace(/\s*[-–—]\s*Semester\s+[12]\s*$/i, '').trim();
    return `connectea:cohort:v3:${student}:${new Date().getFullYear()}:${subject}`;
  }

  function loadCohortSize(key) {
    if (!key) return undefined;
    if (memory.has(key)) return memory.get(key);

    try {
      let stored = localStorage.getItem(key);
      if (stored === null) {
        // Migrate v2 saved counts if available
        const oldKey = key.replace('connectea:cohort:v3:', 'connectea:cohort:v2:');
        const migrated =
          validCohortSize(localStorage.getItem(`${oldKey} - Semester 2`)) ??
          validCohortSize(localStorage.getItem(`${oldKey} - Semester 1`));

        if (migrated !== undefined) {
          stored = String(migrated);
          localStorage.setItem(key, stored);
        }
      }

      const size = validCohortSize(stored);
      memory.set(key, size);
      return size;
    } catch {
      return undefined;
    }
  }

  function saveCohortSize(key, size) {
    memory.set(key, size);
    try {
      if (size === undefined) {
        localStorage.setItem(key, '');
      } else {
        localStorage.setItem(key, String(size));
      }
      return true;
    } catch {
      return false;
    }
  }

  function setText(element, text) {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

  function createPanel(row, isOverall, key, autoSize) {
    const box = createElement('section', 'connectea-panel');
    box.setAttribute(
      'aria-label',
      isOverall ? 'Connext overall subject statistics' : 'Connext assessment statistics'
    );

    const distribution = createElement('div', 'connectea-distribution');
    const result = createElement('div', 'connectea-result');
    result.setAttribute('aria-live', 'polite');

    const resultRow = createElement('div', 'connectea-result-row');
    resultRow.append(result);
    box.append(distribution, resultRow);

    let input;
    let notice;

    if (isOverall && key && autoSize === undefined) {
      const label = createElement('label', 'connectea-controls', 'Students in this subject: ');
      input = createElement('input', 'connectea-subject-cohort-input');
      input.type = 'number';
      input.min = '1';
      input.step = '1';
      input.placeholder = 'e.g. 120';
      input.setAttribute('aria-label', 'Students in this subject');
      input.value = loadCohortSize(key) ?? '';
      label.append(input);

      notice = createElement(
        'span',
        'connectea-notice',
        loadCohortSize(key) ? 'Saved for both semesters.' : 'Enter once; shared across semesters 1 and 2.'
      );
      notice.setAttribute('aria-live', 'polite');

      const controls = createElement('div', 'connectea-subject-controls');
      controls.append(label, notice);
      box.append(controls);

      input.addEventListener('input', () => {
        const size = validCohortSize(input.value);
        const isInvalid = (input.value !== '' && !size) || input.validity.badInput;
        input.setAttribute('aria-invalid', String(Boolean(isInvalid)));

        const persisted = saveCohortSize(key, size);
        setText(
          notice,
          isInvalid
            ? 'Enter a whole number of students, at least 1.'
            : size
            ? persisted
              ? 'Saved for both semesters.'
              : 'Used for this visit; browser storage is unavailable.'
            : 'Enter once; shared across semesters 1 and 2.'
        );
        schedule();
      });

      for (const event of ['click', 'keydown']) {
        input.addEventListener(event, e => e.stopPropagation());
      }
    }

    const target = row.querySelector('.cvr-c-task__details') || row;
    target.append(box);

    const state = { box, distribution, result, input, key, isOverall, autoSize };
    panels.set(row, state);
    return state;
  }

  function render(row, isOverall, key, autoSize) {
    let ui = panels.get(row);
    const mark = readMark(row);

    if (!isOverall && !Number.isFinite(mark)) {
      ui?.box.remove();
      panels.delete(row);
      return;
    }

    if (
      ui &&
      (!ui.box.isConnected || ui.key !== key || ui.isOverall !== isOverall || ui.autoSize !== autoSize)
    ) {
      ui.box.remove();
      ui = null;
    }

    if (!ui) ui = createPanel(row, isOverall, key, autoSize);

    const cohortSize = autoSize ?? loadCohortSize(key);
    if (ui.input && document.activeElement !== ui.input && ui.input.getAttribute('aria-invalid') !== 'true') {
      const valStr = cohortSize === undefined ? '' : String(cohortSize);
      if (ui.input.value !== valStr) ui.input.value = valStr;
    }

    const stats = readStats(row);
    const data = summary(stats, mark, cohortSize);

    if (!data) {
      setText(ui.distribution, 'Cohort mean and boxplot statistics unavailable');
      setText(
        ui.result,
        Number.isFinite(mark) ? 'Rank and z-score unavailable' : 'Not marked · Rank and z-score unavailable'
      );
      return;
    }

    setText(
      ui.distribution,
      `Low ${formatPercentage(stats[0])}%  •  Q1 ${formatPercentage(stats[1])}%  •  Median (Q2) ${formatPercentage(
        stats[2]
      )}%  •  Q3 ${formatPercentage(stats[3])}%  •  High ${formatPercentage(stats[4])}%  •  Cohort mean ${formatPercentage(
        data.mean
      )}%  •  SD ${formatPercentage(data.sd)}`
    );

    const parts = [];
    if (Number.isFinite(mark)) {
      if (!isOverall) parts.push(`You scored ${formatPercentage(mark)}% in this test`);
      parts.push(`z-score ${Number.isFinite(data.z) ? '≈ ' + String(Number(data.z.toFixed(2))) : 'unavailable (zero SD)'}`);
      parts.push(standing(data.p));

      if (data.rank !== undefined) {
        parts.push(
          data.rank === 1
            ? `You're the top of the cohort for this ${isOverall ? 'subject' : 'test'}`
            : `Your estimated ${isOverall ? 'subject' : 'assessment'} rank is ${data.rank} out of ${cohortSize}`
        );
      } else {
        parts.push('Enter subject cohort size for rank');
      }
    } else {
      parts.push('Not marked · Rank and z-score unavailable');
    }

    setText(ui.result, parts.join('  •  '));
  }

  const styles = `
    .connectea-panel {
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      width: 100%;
      clear: both;
      margin: 8px 0;
      padding: 11px 13px;
      border: 1px solid #b9cbe1;
      border-radius: 8px;
      background: #f3f7fc;
      color: #253b53;
      font: 12px/1.6 system-ui, sans-serif;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .connectea-distribution {
      font-weight: 600;
    }
    .connectea-subject-controls {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #d3dfed;
    }
    .connectea-title {
      display: block;
      font-size: 13px;
      color: #203c5e;
    }
    .connectea-controls {
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: 4px 6px 3px 0;
      font-weight: 400;
    }
    .connectea-controls input {
      box-sizing: border-box;
      width: 72px;
      min-height: 24px;
      border: 1px solid #8599b1;
      border-radius: 5px;
      background: white;
      color: #203348;
      padding: 2px 5px;
      font: inherit;
    }
    .connectea-controls input:focus {
      outline: 2px solid #3575b9;
      outline-offset: 2px;
    }
    .connectea-controls input[aria-invalid="true"] {
      border-color: #b62727;
    }
    .connectea-notice {
      display: block;
      color: #4e6076;
      font-size: 11px;
    }
    .connectea-result-row {
      display: flex;
      align-items: baseline;
      gap: 8px 14px;
      flex-wrap: wrap;
      margin-top: 5px;
    }
    .connectea-result {
      font-weight: 600;
      flex: 1 1 260px;
    }
  `;

  let queued = false;

  function pass() {
    if (!document.getElementById('connectea-style')) {
      const styleEl = createElement('style', '', styles);
      styleEl.id = 'connectea-style';
      document.head.append(styleEl);
    }

    const isYear11OnPage = /\bYear\s*11\b/i.test(document.body.innerText);

    for (const card of document.querySelectorAll('.eds-c-tile')) {
      if (!card.querySelector('.eds-c-tile__title')) continue;

      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile') === card
      );
      if (!rows.length) continue;

      const key = subjectKey(card);
      const autoSize = automaticCohort(
        normalize(card.querySelector('.eds-c-tile__title')?.textContent),
        isYear11OnPage,
        extractSchoolText(card)
      );

      for (const row of rows) {
        const isOverall = !row.closest('.cvr-c-tasks');
        try {
          render(row, isOverall, key, autoSize);
        } catch (error) {
          console.debug('Connext:', error);
        }
      }
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pass();
    });
  }

  const observer = new MutationObserver(records => {
    if (
      records.some(
        r =>
          !r.target.parentElement?.closest('.connectea-panel') &&
          !r.target.closest?.('.connectea-panel') &&
          r.target.id !== 'connectea-style'
      )
    ) {
      schedule();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-highcharts-chart']
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', e => {
    if (e.key?.startsWith('connectea:cohort:v3:')) {
      memory.delete(e.key);
      schedule();
    }
  });

  let timer = setInterval(schedule, 1500);

  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-highcharts-chart']
    });
    timer = setInterval(schedule, 1500);
    schedule();
  });

  schedule();
})();
