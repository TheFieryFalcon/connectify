/**
 * Connectify Bulk Accordion Expansion & Animation Guard
 *
 * Controls expandAll, collapseAll, and accordion animation frame timing.
 * Exposes window.ConnectifyExpand.
 */
(() => {
  'use strict';

  try {
  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

    const collect = (...args) => (window.ConnectifyData?.collect || function() { return []; })(...args);
    const getStaleSubjects = () => (window.ConnectifyCache?.getStaleSubjects ? window.ConnectifyCache.getStaleSubjects() : new Set());
    const notifyResultsUpdated = (card) => (window.ConnectifyData?.notifyResultsUpdated || function() {})(card);
  let isBulkExpanding = false;
  let bulkExpandTimer = null;

  /**
   * Programmatically click the accordion headers to expand or collapse details.
   * Staggered across animation frames to eliminate thread blocking and extreme lag.
   * On first bulk expansion, mounts an animated progress pill (#cx-expand-progress)
   * and pre-caches chronological predictions across all tasks.
   */
  function expandAll(expand = true) {
    if (isBulkExpanding && window.ConnectifyIsBulkExpanding) return;
    isBulkExpanding = Boolean(window.ConnectifyIsBulkExpanding);
    const pattern = expand ? /show details/i : /hide details/i;
    const rawHeadings = Array.from(
      document.querySelectorAll(
        '.eds-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .cvr-c-accordion__section-heading, .eds-c-accordion__section-heading, .cvr-c-accordion__section-heading'
      )
    ).filter(h => pattern.test(h.textContent));

    // Deduplicate by card: each card must only have its single canonical accordion heading clicked once
    const seenCards = new Set();
    const headings = [];
    for (const h of rawHeadings) {
      const card = typeof h.closest === 'function'
        ? (h.closest('.eds-c-accordion__section, .cvr-c-accordion__section') ||
           h.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile'))
        : null;
      if (card && seenCards.has(card)) continue;
      if (card) seenCards.add(card);
      headings.push(h);
    }

    if (headings.length === 0) return;

    const initialScrollY = (typeof window.pageYOffset !== 'undefined') ? window.pageYOffset : (document.documentElement?.scrollTop || document.body?.scrollTop || 0);

    if (!expand) {
      isBulkExpanding = true;
      window.ConnectifyIsBulkExpanding = true;
      window.ConnectifyIsAccordionAnimating = true;

      for (const heading of headings) {
        if (pattern.test(heading.textContent)) {
          const btn = (typeof heading.querySelector === 'function' ? heading.querySelector('button, .v-button, [role="button"]') : null) ||
            (typeof heading.closest === 'function' ? heading.closest('button, [role="button"]') : null) ||
            (typeof heading.matches === 'function' && heading.matches('button, [role="button"]') ? heading : null);
          if (btn) {
            btn.click();
          } else {
            heading.click();
          }
        }
      }

      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, initialScrollY);
      }

      isBulkExpanding = false;
      window.ConnectifyIsBulkExpanding = false;
      setTimeout(() => {
        window.ConnectifyIsAccordionAnimating = false;
      }, 450);
      return;
    }

    isBulkExpanding = true;
    window.ConnectifyIsBulkExpanding = true;
    window.ConnectifyIsAccordionAnimating = true;
    clearTimeout(bulkExpandTimer);
    const bulkExpandSafetyTimer = setTimeout(() => {
      if (isBulkExpanding) {
        isBulkExpanding = false;
        window.ConnectifyIsBulkExpanding = false;
        window.ConnectifyIsAccordionAnimating = false;
        finishProgress();
      }
    }, 10000);
    let clickedAny = false;
    let index = 0;
    const total = headings.length;

    // Progress bar initialization for expanding outlines
    let progressPill = null;
    let progressBar = null;
    let progressText = null;

    function unlockScroll() {
      document.documentElement.classList.remove('cx-freeze-scroll');
      document.body.classList.remove('cx-freeze-scroll');
    }

    if (expand) {
      document.documentElement.classList.add('cx-freeze-scroll');
      document.body.classList.add('cx-freeze-scroll');

      progressPill = document.getElementById('cx-expand-progress');
      if (!progressPill) {
        progressPill = document.createElement('div');
        progressPill.id = 'cx-expand-progress';
        progressPill.className = 'cx-expand-progress-pill';
        progressPill.innerHTML = `
          <div class="cx-expand-spinner"></div>
          <span class="cx-expand-label">Expanding outlines... 0%</span>
          <div class="cx-expand-track"><div class="cx-expand-bar" style="width: 0%"></div></div>
        `;
        document.body.appendChild(progressPill);
      }
      progressBar = progressPill.querySelector('.cx-expand-bar');
      progressText = progressPill.querySelector('.cx-expand-label');
      updateProgress(0, 'Expanding outlines... 0%');
    }

    function updateProgress(pct, msg) {
      if (!progressPill) return;
      if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      if (progressText && msg) progressText.textContent = msg;
    }

    function finishProgress() {
      unlockScroll();
      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, initialScrollY);
      }
      if (!progressPill) return;
      updateProgress(100, '✓ Outlines expanded & statistics updated');
      setTimeout(() => {
        if (progressPill) {
          progressPill.style.opacity = '0';
          progressPill.style.transform = 'translate(-50%, -10px)';
          setTimeout(() => progressPill?.remove(), 350);
        }
      }, 600);
    }

    function clickNext() {
      if (index >= total) {
        clearTimeout(bulkExpandTimer);

        function finalizeExpansion() {
          try {
            if (expand && clickedAny) {
              updateProgress(90, 'Caching predictions... 90%');
              setTimeout(() => {
                try {
                  const hasValidCache = Boolean(window.ConnectifyPredictorMath?.isPredictionCacheCurrent?.());
                  if (!hasValidCache) {
                    const all = collect(true);
                    if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
                      window.ConnectifyPredictorMath.populateChronologicalPredictions(all, true);
                    }
                  }
                } catch (e) {
                  console.warn('Prediction pre-cache error:', e);
                }

                updateProgress(95, 'Rendering statistics & outcome bars... 95%');
                setTimeout(() => {
                  try {
                    clearTimeout(notifyUpdateTimer);
                    if (window.ConnectifyCohort?.pass) {
                      window.ConnectifyCohort.pass();
                    } else if (window.ConnectifyCohort?.schedule) {
                      window.ConnectifyCohort.schedule(true);
                    }
                  } catch (e) {
                    console.warn('Cohort pass error:', e);
                  }

                  updateProgress(98, 'Updating progress bars... 98%');
                  setTimeout(() => {
                    try {
                      if (window.ConnectifyCompoundProgress?.update) {
                        window.ConnectifyCompoundProgress.update();
                      }
                      if (window.ConnectifyDataSyncCharts) {
                        window.ConnectifyDataSyncCharts();
                      }
                      // Defer stale-subjects re-scrape off the critical path
                      setTimeout(() => {
                        try {
                          const staleSet = getStaleSubjects();
                          if (staleSet.size > 0) {
                            collect(true, true);
                          }
                        } catch (e) {}
                      }, 200);
                    } catch (e) {}

                    const completeFinalize = () => {
                      try {
                        updateProgress(100, 'Ready! 100%');
                      } finally {
                        isBulkExpanding = false;
                        window.ConnectifyIsBulkExpanding = false;
                        window.ConnectifyIsAccordionAnimating = false;
                        finishProgress();
                      }
                    };

                    if (typeof requestAnimationFrame === 'function') {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(completeFinalize);
                      });
                    } else {
                      completeFinalize();
                    }
                  }, 20);
                }, 20);
              }, 20);
            } else {
              isBulkExpanding = false;
              window.ConnectifyIsBulkExpanding = false;
              finishProgress();
              setTimeout(() => {
                window.ConnectifyIsAccordionAnimating = false;
              }, 350);
            }
          } catch (err) {
            console.error('finalizeExpansion error:', err);
            isBulkExpanding = false;
            window.ConnectifyIsBulkExpanding = false;
            window.ConnectifyIsAccordionAnimating = false;
            finishProgress();
          }
        }

        if (!clickedAny || !expand) {
          bulkExpandTimer = setTimeout(finalizeExpansion, 150);
          return;
        }

        // Active readiness polling: wait for all opened cards to mount their task rows
        const startTime = Date.now();
        const pollTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const allSettled = headings.every(h => {
            const card = (typeof h.closest === 'function' ? h.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') : null) || h.parentElement;
            if (!card) return true;
            if (/show details/i.test(h.textContent)) return false;
            return (typeof card.querySelectorAll === 'function' && card.querySelectorAll('.cvr-c-task').length > 0) || elapsed > 1500;
          });

          if (allSettled || elapsed > 1500) {
            clearInterval(pollTimer);
            finalizeExpansion();
          }
        }, 50);
        return;
      }

      const heading = headings[index++];
      const pct = Math.round((index / total) * (expand ? 85 : 100));
      if (progressPill) {
        updateProgress(pct, `Expanding outlines... ${index}/${total} (${pct}%)`);
      }

      if (pattern.test(heading.textContent)) {
        const btn = (typeof heading.querySelector === 'function' ? heading.querySelector('button, .v-button, [role="button"]') : null) ||
          (typeof heading.closest === 'function' ? heading.closest('button, [role="button"]') : null) ||
          (typeof heading.matches === 'function' && heading.matches('button, [role="button"]') ? heading : null);
        if (btn) {
          btn.click();
          clickedAny = true;
        } else {
          heading.click();
          clickedAny = true;
        }
        if (typeof window.scrollTo === 'function') {
          window.scrollTo(0, initialScrollY);
        }
      }
      setTimeout(clickNext, 65);
    }

    clickNext();
  }

  let animGuardTimer = null;
  const pendingCardsToUpdate = new Set();
  function triggerAccordionAnimationGuard(duration = 380, cardToUpdate = null) {
    window.ConnectifyIsAccordionAnimating = true;
    if (cardToUpdate) {
      pendingCardsToUpdate.add(cardToUpdate);
    }
    const effectiveDuration = cardToUpdate ? duration : Math.max(duration, 450);
    clearTimeout(animGuardTimer);
    animGuardTimer = setTimeout(() => {
      window.ConnectifyIsAccordionAnimating = false;
      const cards = Array.from(pendingCardsToUpdate);
      pendingCardsToUpdate.clear();
      for (const card of cards) {
        if (!isBulkExpanding) {
          notifyResultsUpdated(card);
        }
      }
      if (cards.length > 0) {
        if (window.ConnectifyCohort?.schedule) {
          window.ConnectifyCohort.schedule(true);
        }
        if (window.ConnectifyCompoundProgress?.update) {
          window.ConnectifyCompoundProgress.update();
        }
        if (window.ConnectifyDataSyncCharts) {
          window.ConnectifyDataSyncCharts();
        }
      }
    }, effectiveDuration);
  }
  window.ConnectifyTriggerAccordionAnimationGuard = triggerAccordionAnimationGuard;

  // Listen for user clicks on subject accordion headers to update results cache immediately upon expansion
  document.addEventListener('click', e => {
    const heading = e.target.closest('.eds-c-accordion__section-heading, .cvr-c-accordion__section-heading');
    if (!heading) return;

    if (isBulkExpanding) return;
    const card = heading.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');

    // Detect intent immediately at click time:
    const wasCollapsed = /show details/i.test(heading.textContent);
    if (!wasCollapsed) {
      // User is collapsing the accordion, trigger guard to suppress background observer churn
      triggerAccordionAnimationGuard(450, null);
      return;
    }

    // User is expanding: register card for guaranteed update pass when animation completes
    triggerAccordionAnimationGuard(380, card);
  });

  // Observe DOM additions inside subject tiles when expanded
  const expandMutationObserver = new MutationObserver(mutations => {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    let expandedCard = null;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')) {
              expandedCard = node.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
              if (expandedCard) break;
            }
          }
        }
      }
      if (expandedCard) break;
    }
    if (expandedCard) {
      if (window.ConnectifyIsAccordionAnimating) {
        pendingCardsToUpdate.add(expandedCard);
      } else if (!isBulkExpanding) {
        notifyResultsUpdated(expandedCard);
      }
    }
  });

  if (document.body) {
    expandMutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      expandMutationObserver.observe(document.body, { childList: true, subtree: true });
    });
  }


    window.ConnectifyExpand = {
      expandAll,
      collapseAll: () => expandAll(false),
      triggerAccordionAnimationGuard
    };
  } catch (err) {
    console.error('Connectify error in assessment-expand.js:', err);
  }
})();
