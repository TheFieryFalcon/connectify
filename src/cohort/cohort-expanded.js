/**
 * Connectify Cohort: expanded statistics cards
 *
 * With the Settings "Statistics Panels" option expanded (cohort-panel-view.js), a statistics panel is a wide,
 * short card: one row of Score / Rank / Average beside the five boxplot values (outcome meter at its end on
 * task rows), then a footer with SD, z-score and standing (Type dropdown, or the cohort size input on overall
 * rows). The quantile the result has reached is faintly tinted. Overall rows hold SD as a sixth cell beside
 * the quantiles (footer: z-score and standing) and put the class prediction's Low / Mid / High under Score /
 * Rank / Average, the quantiles then in two rows beside them; unmarked rows are one line of Low / Mid / High
 * beside what the prediction is based on. Skeletons are built once per
 * panel; fills only touch text and the Score colour step.
 * Exposes window.ConnectifyCohortExpanded.
 */
(() => {
  'use strict';

  try {
    const { createElement, setText, setHTML, math } = window.ConnectifyCohortRows;
    const DASH = '—';
    const HEAD = ['Score', 'Rank', 'Average'];
    const QUANTILES = ['Minimum', 'Lower Quartile', 'Median', 'Upper Quartile', 'Maximum'];
    const SCORE_NOTE = 'The Score colour grows more vivid the further your result sits above your predicted range.';

    /** A <dl> of labelled cells; returns the list and each cell's <dd>. */
    function grid(labels, modifier) {
      const dl = createElement('dl', `connectea-xp-grid ${modifier}`);
      const values = labels.map(label => {
        const cell = createElement('div', 'connectea-xp-cell');
        const value = createElement('dd', 'connectea-xp-value');
        cell.append(createElement('dt', 'connectea-xp-label', label), value);
        dl.append(cell);
        return value;
      });
      return { dl, values };
    }

    function footer() {
      const foot = createElement('div', 'connectea-xp-foot');
      const summary = createElement('span', 'connectea-xp-summary');
      foot.append(summary);
      return { foot, summary };
    }

    /** The statistics card in a panel: one row of values (meter at its end), then the footer. */
    function buildStats(box, { overall, meter, type, controls }) {
      box.classList.add('connectea-panel--expanded', 'connectea-xp-stats');
      if (overall) box.classList.add('connectea-xp-overall');
      const head = createElement('div', 'connectea-xp-head');
      const top = grid(HEAD, 'connectea-xp-grid--head');
      const [score, rank, average] = top.values;
      score.classList.add('connectea-xp-score');
      const rankValue = createElement('span', 'connectea-xp-rank-value');
      rank.append(rankValue);
      const quantiles = grid(overall ? [...QUANTILES, 'SD'] : QUANTILES, 'connectea-xp-grid--quantiles');
      const sd = overall ? quantiles.values.pop() : null;
      head.append(top.dl, quantiles.dl);
      if (meter) head.append(meter);
      const { foot, summary } = footer();
      if (type) foot.append(type);
      if (controls) foot.append(controls);
      box.append(head);
      let prediction = null;
      if (overall) {
        prediction = createElement('div', 'connectea-xp-prediction');
        prediction.hidden = true;
        box.append(prediction);
      }
      box.append(foot);
      return { score, rankValue, average, quantiles: quantiles.values, sd, foot, summary, prediction };
    }

    /** The prediction card on an unmarked row: Low / Mid / High beside the basis and the Type dropdown. */
    function buildForecast(box) {
      box.classList.add('connectea-panel--expanded', 'connectea-xp-forecast');
      const body = createElement('div', 'connectea-xp-body');
      const { foot, summary } = footer();
      box.append(body, foot);
      return { body, foot, summary };
    }

    /** The Type dropdown follows whichever card the row shows. */
    function placeType(ui, foot) {
      if (ui.typeContainer && foot && ui.typeContainer.parentNode !== foot) foot.append(ui.typeContainer);
    }

    /** Colour step for the Score: 0-10 between Low and High, 5 without a range, 'breakout' on task breakouts. */
    function scoreStep(score, low, high, broken = false) {
      if (!Number.isFinite(score)) return null;
      if (broken) return 'breakout';
      if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return '5';
      const t = Math.min(1, Math.max(0, (score - low) / (high - low)));
      return String(Math.round(t * 10));
    }

    function setStep(el, step) {
      if (step === null) el.removeAttribute('data-cx-score-step');
      else if (el.getAttribute('data-cx-score-step') !== step) el.setAttribute('data-cx-score-step', step);
    }

    /** Tints the highest quantile the mark has reached (none below the minimum or without statistics). */
    function markReached(cells, mark, stats) {
      let reached = -1;
      if (Number.isFinite(mark) && stats) stats.forEach((v, i) => { if (Number.isFinite(v) && mark >= v) reached = i; });
      cells.forEach((el, i) => el.parentElement.classList.toggle('connectea-xp-cell--reached', i === reached));
    }

    const percent = v => (Number.isFinite(v) ? `${math().formatPercentage(v)}%` : DASH);

    function rankText(data, isOverall, userSize, estimatedSize, cohortSize) {
      if (data.rank === undefined) return DASH;
      if (data.rank === 1) return `Top of ${isOverall ? 'subject' : 'assessment'}`;
      const estimated = userSize === undefined && estimatedSize !== undefined;
      return `${data.rank} / ${estimated ? '~' : ''}${cohortSize}`;
    }

    /** Fills a statistics card; unavailable values read as a dash, with the compact view's wording below. */
    function fillStats(ui, { mark, stats, data, isOverall, userSize, estimatedSize, cohortSize, step }) {
      const xp = ui.xp;
      if (!isOverall) placeType(ui, xp.foot);
      setText(xp.score, percent(mark));
      setStep(xp.score, Number.isFinite(mark) ? step : null);
      const parts = Number.isFinite(mark) ? [] : ['Not marked'];
      if (!data) {
        for (const el of [xp.rankValue, xp.average, ...xp.quantiles, xp.sd]) if (el) setText(el, DASH);
        markReached(xp.quantiles, NaN, null);
        parts.push('Cohort statistics unavailable');
      } else {
        xp.quantiles.forEach((el, i) => setText(el, percent(stats[i])));
        markReached(xp.quantiles, mark, stats);
        setText(xp.average, percent(data.mean));
        setText(xp.rankValue, rankText(data, isOverall, userSize, estimatedSize, cohortSize));
        // Overall cards show SD as a cell beside the quantiles
        if (xp.sd) setText(xp.sd, math().formatPercentage(data.sd));
        else parts.push(`SD ${math().formatPercentage(data.sd)}`);
        parts.push(`Z-Score ${Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A'}`);
        const standing = math().standing(data.p);
        if (standing) parts.push(standing);
        if (data.rank === undefined) parts.push('Cohort size needed');
      }
      setText(xp.summary, parts.join(' · '));
    }

    /** Low / Mid / High cells in the Predictor's colours (cohort-forecast.css, cohort-upcoming.css). */
    function heroCells(p, digits, prefix = '') {
      const cell = (level, name) => {
        const label = prefix ? `${prefix} ${name}` : name;
        return `<div class="connectea-xp-cell"><dt class="connectea-xp-label">${label}</dt>` +
          `<dd class="connectea-xp-value connectea-forecast-value connectea-forecast-value--${level}">${p[level].toFixed(digits)}%</dd></div>`;
      };
      return `<dl class="connectea-xp-grid connectea-xp-grid--hero">${cell('low', 'Low')}${cell('mid', 'Mid')}${cell('high', 'High')}</dl>`;
    }

    /** "Literature" from "12 Literature ATAR": no year level or course type. */
    const shortSubject = name => String(name || '')
      .replace(/^\s*(?:Year\s*)?\d{1,2}\s+/i, '')
      .replace(/\s+(?:ATAR|General|Foundation|Preliminary)\s*$/i, '')
      .trim() || 'subject';

    /** "a, b and c" */
    const listJoin = items => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

    /**
     * What a prediction is based on (predictor-engine.js basis), naming only what fed it: e.g. "From your
     * previous-year Exam and Literature averages", "From your 3 previous Exam results and your 5 previous
     * Literature results". A baseline and this year's results never both feed the same average.
     */
    function basisText(prediction, subjectName) {
      const type = prediction?.type || 'assessment';
      const basis = prediction?.basis;
      if (!basis?.subjectSource) return `Predicted from your ${type} results`;
      const subject = shortSubject(subjectName || prediction.subjectName);
      const averages = [];
      if (basis.typeSource === 'baseline') averages.push(type);
      if (basis.subjectSource === 'baseline') averages.push(subject);
      const items = [];
      if (averages.length) items.push(`your previous-year ${listJoin(averages)} average${averages.length > 1 ? 's' : ''}`);
      const results = (n, name) => `your ${n} previous ${name} result${n === 1 ? '' : 's'}`;
      if (basis.typeSource === 'history' && basis.typeCount > 0) items.push(results(basis.typeCount, type));
      if (basis.subjectSource === 'history' && basis.subjectCount > 0) items.push(results(basis.subjectCount, subject));
      return items.length ? `From ${listJoin(items)}` : `Predicted from your ${type} results`;
    }

    /** Fills the prediction card on an unmarked row, or says what the prediction needs. */
    function fillForecast(ui, prediction, predicted, needs) {
      const card = ui.xpForecast;
      placeType(ui, card.foot);
      if (predicted) setHTML(card.body, heroCells(prediction, 0));
      else setText(card.body, needs);
      setText(card.summary, predicted ? basisText(prediction) : '');
    }

    /** The overall card's class prediction: Predicted Low / Mid / High under Score / Rank / Average (hidden
     *  by the caller once the class has a letter). */
    function fillPrediction(section, p, needs) {
      setHTML(section, p ? heroCells(p, 1, 'Predicted') : `<div class="connectea-xp-needs">${needs}</div>`);
      section.hidden = false;
    }

    const withScoreNote = details => (details ? `${details}\n\n${SCORE_NOTE}` : SCORE_NOTE);

    window.ConnectifyCohortExpanded = {
      QUANTILES,
      SCORE_NOTE,
      buildStats,
      buildForecast,
      placeType,
      scoreStep,
      fillStats,
      fillForecast,
      fillPrediction,
      basisText,
      withScoreNote
    };
  } catch (err) {
    console.error('Connectify error in cohort-expanded.js:', err);
  }
})();
