/**
 * Connectify Cohort: prediction panel for unmarked task rows
 *
 * An unmarked assessment shows one compact line in the statistics panel's style next to its Type
 * dropdown: the task's Low / Mid / High prediction in the Predictor's colours (cached chronological
 * prediction, computed by precacheUpcoming when missing), or what the prediction still needs. The breakout
 * threshold is never shown. The panel is hidden again once the row is marked. With expanded task cards it is a
 * Low / Mid / High card with the prediction's basis and the Type dropdown (cohort-expanded.js).
 * Exposes window.ConnectifyCohortForecast.
 */
(() => {
  'use strict';

  try {
    const { createElement, setText, setHTML } = window.ConnectifyCohortRows;
    const NEEDS = 'No prediction yet: needs a marked result or a subject baseline in Settings';

    /** The forecast panel after the (hidden) statistics panel, created once per row. */
    function forecastBox(ui) {
      if (ui.forecast?.isConnected) return ui.forecast;
      const box = createElement('section', 'connectea-panel connectea-forecast');
      box.setAttribute('aria-label', 'Connectify predicted result');
      ui.box.insertAdjacentElement('afterend', box);
      ui.forecast = box;
      // An expanded statistics card gets an expanded prediction card (cohort-expanded.js)
      ui.xpForecast = ui.xp ? window.ConnectifyCohortExpanded.buildForecast(box) : null;
      return box;
    }

    const isPredicted = p => Boolean(p) && !p.unpredicted && [p.low, p.mid, p.high].every(Number.isFinite);

    function show(ui, prediction) {
      if (!ui?.box) return;
      const box = forecastBox(ui);
      const predicted = isPredicted(prediction);
      box.classList.toggle('connectea-forecast--empty', !predicted);
      if (ui.xpForecast) {
        window.ConnectifyCohortExpanded.fillForecast(ui, prediction, predicted, NEEDS);
      } else if (predicted) {
        // Coloured like the Predictor's Low / Mid / High pills (cohort-forecast.css)
        const value = (level, text, v) => {
          const tag = level === 'mid' ? 'strong' : 'span';
          return `<${tag} class="connectea-forecast-value connectea-forecast-value--${level}">${text} ${Math.round(v)}%</${tag}>`;
        };
        setHTML(
          box,
          `${value('low', 'Low', prediction.low)}  •  ${value('mid', 'Mid', prediction.mid)}  •  ${value('high', 'High', prediction.high)}`
        );
      } else {
        setText(box, NEEDS);
      }
      box.hidden = false;
      // The stylesheet decides how it shows (the expanded card is a flex row), never an inline display
      box.style.removeProperty('display');
    }

    function hide(ui) {
      const box = ui?.forecast;
      if (!box) return;
      box.hidden = true;
      box.style.setProperty('display', 'none', 'important');
    }

    window.ConnectifyCohortForecast = { show, hide, isPredicted, NEEDS };
  } catch (err) {
    console.error('Connectify error in cohort-forecast.js:', err);
  }
})();
