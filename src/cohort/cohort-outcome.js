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
        floatingTooltipEl = document.getElementById('connectify-outcome-tooltip');
        if (!floatingTooltipEl) {
          floatingTooltipEl = createElement('div', '');
          floatingTooltipEl.id = 'connectify-outcome-tooltip';
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
      tooltip.classList.add('connectify-tooltip-visible');

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

    /** The tooltip for a keyboard focus: beside the element, as a pointer there would place it. */
    function focusTooltip(el, text) {
      const r = el.getBoundingClientRect();
      showFloatingTooltip({ clientX: r.right, clientY: r.top }, text);
    }

    function hideFloatingTooltip() {
      if (floatingTooltipEl) {
        floatingTooltipEl.classList.remove('connectify-tooltip-visible');
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
      bar.dataset.connectifyTooltip = tooltipText;
      bar.removeAttribute('title');
      bar.setAttribute('aria-label', tooltipText);
      bar.classList.toggle('connectify-outcome-broken', Boolean(outcome.broken));
      bar.classList.toggle('connectify-outcome-critical', Boolean(outcome.critical));

      if (!bar._tooltipBound) {
        bar._tooltipBound = true;
        bar.addEventListener('mouseenter', (e) => {
          showFloatingTooltip(e, bar.dataset.connectifyTooltip);
        });
        bar.addEventListener('mousemove', (e) => {
          showFloatingTooltip(e, bar.dataset.connectifyTooltip);
        });
        bar.addEventListener('mouseleave', () => {
          hideFloatingTooltip();
        });
        bar.tabIndex = 0;
        bar.setAttribute('role', 'img');
        bar.addEventListener('focus', () => focusTooltip(bar, bar.dataset.connectifyTooltip));
        bar.addEventListener('blur', hideFloatingTooltip);
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
        const seg = createElement('div', 'connectify-outcome-segment');
        if (outcome.colors && outcome.colors.includes(colorName)) {
          seg.classList.add(`connectify-active-${colorName}`);
        }
        bar.append(seg);
      }

      if (outcome.broken) {
        const purpleSeg = createElement('div', 'connectify-outcome-segment connectify-active-purple');
        bar.append(purpleSeg);
      }

      bar.hidden = false;
      bar.style.setProperty('display', 'inline-flex', 'important');
    }

    window.ConnectifyCohortOutcome = {
      getFloatingTooltip,
      showFloatingTooltip,
      focusTooltip,
      hideFloatingTooltip,
      renderOutcomeBar
    };
  } catch (err) {
    console.error('Connectify error in cohort-outcome.js:', err);
  }
})();
