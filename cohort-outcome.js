/**
 * Connectify Cohort Outcome Bar & Floating Tooltips
 *
 * Renders the multi-segment outcome meter and floating tooltip for assessment tasks.
 * Exposes window.ConnectifyCohortOutcome.
 */
(() => {
  'use strict';

  try {
    const createElement = (tag, className, textContent) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    };

    const clearChildren = el => {
      if (!el) return;
      if (typeof el.replaceChildren === 'function') {
        el.replaceChildren();
      } else {
        while (el.firstChild) el.removeChild(el.firstChild);
      }
    };

    let floatingTooltipEl = null;
    function getFloatingTooltip() {
      if (!floatingTooltipEl || !floatingTooltipEl.isConnected) {
        floatingTooltipEl = document.getElementById('connectea-outcome-tooltip');
        if (!floatingTooltipEl) {
          floatingTooltipEl = createElement('div', '');
          floatingTooltipEl.id = 'connectea-outcome-tooltip';
          floatingTooltipEl.setAttribute('role', 'tooltip');
          document.body.append(floatingTooltipEl);
        }
      }
      return floatingTooltipEl;
    }

    function showFloatingTooltip(e, text) {
      if (!text) return;
      const tooltip = getFloatingTooltip();
      tooltip.textContent = text;
      tooltip.classList.add('connectea-tooltip-visible');

      const pad = 14;
      let left = e.clientX + pad;
      let top = e.clientY - 12;

      const width = 340;
      const height = 180;
      if (left + width > window.innerWidth - 10) {
        left = Math.max(10, e.clientX - width - pad);
      }
      if (top + height > window.innerHeight - 10) {
        top = Math.max(10, window.innerHeight - height - 10);
      }
      if (top < 10) top = 10;

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function hideFloatingTooltip() {
      if (floatingTooltipEl) {
        floatingTooltipEl.classList.remove('connectea-tooltip-visible');
      }
    }

    function renderOutcomeBar(bar, outcome) {
      if (!bar) return;
      if (!outcome || !Number.isFinite(outcome.segments)) {
        bar.hidden = true;
        bar.style.setProperty('display', 'none', 'important');
        return;
      }

      const tooltipText = outcome.details || outcome.label || '';
      bar.dataset.connecteaTooltip = tooltipText;
      bar.removeAttribute('title');
      bar.setAttribute('aria-label', tooltipText);
      bar.classList.toggle('connectea-outcome-broken', Boolean(outcome.broken));
      bar.classList.toggle('connectea-outcome-critical', Boolean(outcome.critical));

      if (!bar._tooltipBound) {
        bar._tooltipBound = true;
        bar.addEventListener('mouseenter', (e) => {
          showFloatingTooltip(e, bar.dataset.connecteaTooltip);
        });
        bar.addEventListener('mousemove', (e) => {
          showFloatingTooltip(e, bar.dataset.connecteaTooltip);
        });
        bar.addEventListener('mouseleave', () => {
          hideFloatingTooltip();
        });
      }

      // Memoize rendered outcome segments to avoid destroying and recreating DOM nodes on scroll
      const outcomeKey = `${outcome.segments}:${outcome.colors ? outcome.colors.join(',') : ''}:${Boolean(outcome.broken)}:${Boolean(outcome.critical)}`;
      if (bar._renderedKey === outcomeKey && bar.children.length > 0) {
        bar.hidden = false;
        bar.style.setProperty('display', 'inline-flex', 'important');
        return;
      }
      bar._renderedKey = outcomeKey;

      clearChildren(bar);

      const baseColors = ['red', 'orange', 'yellow', 'green'];
      for (const colorName of baseColors) {
        const seg = createElement('div', 'connectea-outcome-segment');
        if (outcome.colors && outcome.colors.includes(colorName)) {
          seg.classList.add(`connectea-active-${colorName}`);
        }
        bar.append(seg);
      }

      if (outcome.broken) {
        const purpleSeg = createElement('div', 'connectea-outcome-segment connectea-active-purple');
        bar.append(purpleSeg);
      }

      bar.hidden = false;
      bar.style.setProperty('display', 'inline-flex', 'important');
    }

    window.ConnectifyCohortOutcome = {
      getFloatingTooltip,
      showFloatingTooltip,
      hideFloatingTooltip,
      renderOutcomeBar
    };
  } catch (err) {
    console.error('Connectify error in cohort-outcome.js:', err);
  }
})();
