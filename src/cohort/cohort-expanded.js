/**
 * Connectify Cohort: expanded statistics cards
 *
 * With the Settings "Statistics Panels" option expanded (cohort-panel-view.js), a statistics panel is a card:
 * Score / Rank / Average (outcome meter beside them on task rows), the five boxplot values, and a footer with
 * SD, z-score and standing (Type dropdown on task rows). Overall rows hold the cohort size input under Rank
 * and the class prediction below a divider; unmarked rows show Low / Mid / High with what the prediction is
 * based on. Skeletons are built once per panel; fills only touch text and the Score colour step.
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

    /** The statistics card in a panel: the meter joins the header, the Type dropdown the footer. */
    function buildStats(box, { overall, meter, type, controls }) {
      box.classList.add('connectea-panel--expanded');
      if (overall) box.classList.add('connectea-xp-overall');
      const head = createElement('div', 'connectea-xp-head');
      const top = grid(HEAD, 'connectea-xp-grid--head');
      const [score, rank, average] = top.values;
      score.classList.add('connectea-xp-score');
      const rankValue = createElement('span', 'connectea-xp-rank-value');
      rank.append(rankValue);
      if (controls) rank.append(controls);
      head.append(top.dl);
      if (meter) head.append(meter);
      const quantiles = grid(QUANTILES, 'connectea-xp-grid--quantiles');
      const { foot, summary } = footer();
      if (type) foot.append(type);
      box.append(head, quantiles.dl, foot);
      let prediction = null;
      if (overall) {
        prediction = createElement('div', 'connectea-xp-prediction');
        prediction.hidden = true;
        box.append(prediction);
      }
      return { score, rankValue, average, quantiles: quantiles.values, foot, summary, prediction };
    }

    /** The prediction card on an unmarked row: Low / Mid / High, then the basis and the Type dropdown. */
    function buildForecast(box) {
      box.classList.add('connectea-panel--expanded');
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
        for (const el of [xp.rankValue, xp.average, ...xp.quantiles]) setText(el, DASH);
        parts.push('Cohort statistics unavailable');
      } else {
        xp.quantiles.forEach((el, i) => setText(el, percent(stats[i])));
        setText(xp.average, percent(data.mean));
        setText(xp.rankValue, rankText(data, isOverall, userSize, estimatedSize, cohortSize));
        parts.push(`SD ${math().formatPercentage(data.sd)}`, `Z-Score ${Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A'}`);
        const standing = math().standing(data.p);
        if (standing) parts.push(standing);
        if (data.rank === undefined) parts.push('Cohort size needed');
      }
      setText(xp.summary, parts.join(' · '));
    }

    /** Low / Mid / High cells in the Predictor's colours (cohort-forecast.css, cohort-upcoming.css). */
    function heroCells(p, digits) {
      const cell = (level, label) =>
        `<div class="connectea-xp-cell"><dt class="connectea-xp-label">${label}</dt>` +
        `<dd class="connectea-xp-value connectea-forecast-value connectea-forecast-value--${level}">${p[level].toFixed(digits)}%</dd></div>`;
      return `<dl class="connectea-xp-grid connectea-xp-grid--hero">${cell('low', 'Low')}${cell('mid', 'Mid')}${cell('high', 'High')}</dl>`;
    }

    /** What a prediction is based on (predictor-engine.js basis). */
    function basisText(prediction) {
      const type = prediction?.type || 'assessment';
      const basis = prediction?.basis;
      switch (basis?.source) {
        case 'type-history':
          return basis.count === 1 ? `From your earlier ${type} result` : `From your ${basis.count} earlier ${type} results`;
        case 'type-baseline': return `From your previous-year ${type} average`;
        case 'subject-history': return 'From your results in this subject';
        case 'subject-baseline': return 'From your previous-year subject result';
        default: return `Predicted from your ${type} results`;
      }
    }

    /** Fills the prediction card on an unmarked row, or says what the prediction needs. */
    function fillForecast(ui, prediction, predicted, needs) {
      const card = ui.xpForecast;
      placeType(ui, card.foot);
      if (predicted) setHTML(card.body, heroCells(prediction, 0));
      else setText(card.body, needs);
      setText(card.summary, predicted ? basisText(prediction) : '');
    }

    /** The overall card's class prediction section (hidden by the caller once the class has a letter). */
    function fillPrediction(section, p, needs) {
      const title = '<div class="connectea-xp-title">Predicted class result</div>';
      setHTML(section, p ? `${title}${heroCells(p, 1)}` : `${title}<div class="connectea-xp-needs">${needs}</div>`);
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
