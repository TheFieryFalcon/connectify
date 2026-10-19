/**
 * Connectify Assessment: Expand All / Collapse All
 *
 * Clicks every subject accordion heading, one per 65ms so the page never blocks, then waits for the
 * task rows to mount and finalises in stages (predictions 90% -> statistics 95% -> progress bars 98% ->
 * 100%). Observers stay muted while it runs. Progress pill: assessment-expand-progress.js; single
 * accordion handling: assessment-accordion-watch.js. Exposes window.ConnectifyExpand.
 */
(() => {
  'use strict';

  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const HEADING_SELECTOR = '.eds-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .cvr-c-accordion__section-heading, .eds-c-accordion__section-heading, .cvr-c-accordion__section-heading';

  const collect = (...args) => (window.ConnectifyData?.collect || (() => []))(...args);
  const getStaleSubjects = () => (window.ConnectifyCache?.getStaleSubjects ? window.ConnectifyCache.getStaleSubjects() : new Set());
  let isBulkExpanding = false;
  let bulkExpandTimer = null;

  const setFlags = (bulk, animating) => {
    isBulkExpanding = bulk;
    window.ConnectifyIsBulkExpanding = bulk;
    if (animating !== undefined) window.ConnectifyIsAccordionAnimating = animating;
  };

  function clickHeading(heading) {
    const btn = heading.querySelector?.('button, .v-button, [role="button"]') ||
      heading.closest?.('button, [role="button"]') ||
      (heading.matches?.('button, [role="button"]') ? heading : null);
    (btn || heading).click();
  }

  // One heading per card: each card's canonical accordion heading is clicked once
  function collectHeadings(pattern) {
    const seenCards = new Set();
    const headings = [];
    for (const h of document.querySelectorAll(HEADING_SELECTOR)) {
      if (!pattern.test(h.textContent)) continue;
      // The other semester's tiles are hidden by "Show [Semester N] classes only"
      if (h.closest?.('.cx-semester-hidden')) continue;
      const card = h.closest?.('.eds-c-accordion__section, .cvr-c-accordion__section') || h.closest?.(CARD_SELECTOR) || null;
      if (card && seenCards.has(card)) continue;
      if (card) seenCards.add(card);
      headings.push(h);
    }
    return headings;
  }

  const currentScrollY = () => (typeof window.pageYOffset !== 'undefined') ? window.pageYOffset : (document.documentElement?.scrollTop || document.body?.scrollTop || 0);

  function collapseAll(headings, pattern, initialScrollY) {
    setFlags(true, true);
    for (const heading of headings) if (pattern.test(heading.textContent)) clickHeading(heading);
    if (typeof window.scrollTo === 'function') window.scrollTo(0, initialScrollY);
    setFlags(false);
    setTimeout(() => { window.ConnectifyIsAccordionAnimating = false; }, 450);
  }

  // After the clicks: 90% predictions, 95% statistics, 98% progress bars, then 100% two frames later
  function finalizeStages(progress, endRun) {
    progress.update(90, 'Caching predictions... 90%');
    setTimeout(() => {
      try {
        if (!window.ConnectifyPredictorMath?.isPredictionCacheCurrent?.()) {
          window.ConnectifyPredictorMath?.populateChronologicalPredictions?.(collect(true), true);
        }
      } catch (e) {
        console.warn('Prediction pre-cache error:', e);
      }
      progress.update(95, 'Rendering statistics & outcome bars... 95%');
      setTimeout(() => {
        try {
          window.ConnectifyData?.cancelPendingNotify?.();
          if (window.ConnectifyCohort?.pass) window.ConnectifyCohort.pass();
          else window.ConnectifyCohort?.schedule?.(true);
        } catch (e) {
          console.warn('Cohort pass error:', e);
        }
        progress.update(98, 'Updating progress bars... 98%');
        setTimeout(() => {
          try {
            window.ConnectifyCompoundProgress?.update?.();
            window.ConnectifyDataSyncCharts?.();
            // Stale subjects and cards that mounted after the statistics pass are re-scraped off the critical path
            setTimeout(() => {
              try { collect(true, getStaleSubjects().size > 0); } catch {}
            }, 200);
          } catch {}
          const complete = () => {
            try { progress.update(100, 'Ready! 100%'); } finally { endRun(); }
          };
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(complete));
          else complete();
        }, 20);
      }, 20);
    }, 20);
  }

  /** Expands (or collapses) every subject outline; only one Expand All runs at a time. */
  function expandAll(expand = true) {
    if (isBulkExpanding && window.ConnectifyIsBulkExpanding) return;
    isBulkExpanding = Boolean(window.ConnectifyIsBulkExpanding);
    const pattern = expand ? /show details/i : /hide details/i;
    const headings = collectHeadings(pattern);
    if (headings.length === 0) return;
    const initialScrollY = currentScrollY();

    if (!expand) {
      collapseAll(headings, pattern, initialScrollY);
      return;
    }

    setFlags(true, true);
    clearTimeout(bulkExpandTimer);
    const progress = window.ConnectifyExpandProgress.start(initialScrollY);
    let safetyTimer = null;
    // Every exit path ends the run exactly once and cancels the safety timer, so a stale timer from an
    // earlier run can never reset the flags in the middle of a new one
    const endRun = () => {
      clearTimeout(safetyTimer);
      setFlags(false, false);
      progress.finish();
    };
    safetyTimer = setTimeout(() => { if (isBulkExpanding) endRun(); }, 10000);

    let clickedAny = false;
    let index = 0;
    const total = headings.length;

    function finalize() {
      try {
        if (clickedAny) {
          finalizeStages(progress, endRun);
        } else {
          clearTimeout(safetyTimer);
          setFlags(false);
          progress.finish();
          setTimeout(() => { window.ConnectifyIsAccordionAnimating = false; }, 350);
        }
      } catch (err) {
        console.error('finalizeExpansion error:', err);
        endRun();
      }
    }

    function clickNext() {
      if (index >= total) {
        clearTimeout(bulkExpandTimer);
        if (!clickedAny) {
          bulkExpandTimer = setTimeout(finalize, 150);
          return;
        }
        // Wait (up to 1.5s) until every opened card has mounted its task rows
        const startTime = Date.now();
        const pollTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const allSettled = headings.every(h => {
            const card = h.closest?.(CARD_SELECTOR) || h.parentElement;
            if (!card) return true;
            if (/show details/i.test(h.textContent)) return false;
            return (typeof card.querySelectorAll === 'function' && card.querySelectorAll('.cvr-c-task').length > 0) || elapsed > 1500;
          });
          if (allSettled || elapsed > 1500) {
            clearInterval(pollTimer);
            finalize();
          }
        }, 50);
        return;
      }

      const heading = headings[index++];
      const pct = Math.round((index / total) * 85);
      progress.update(pct, `Expanding outlines... ${index}/${total} (${pct}%)`);
      if (pattern.test(heading.textContent)) {
        clickHeading(heading);
        clickedAny = true;
        if (typeof window.scrollTo === 'function') window.scrollTo(0, initialScrollY);
      }
      setTimeout(clickNext, 65);
    }

    clickNext();
  }

  window.ConnectifyExpand = {
    expandAll,
    collapseAll: () => expandAll(false),
    triggerAccordionAnimationGuard: (...args) => window.ConnectifyTriggerAccordionAnimationGuard?.(...args)
  };
})();
