/**
 * Connectify Assessment: single accordion expand/collapse handling
 *
 * When the user opens or closes one subject accordion, background observers are muted for the length
 * of the animation (window.ConnectifyIsAccordionAnimating), and a card that was opened is scraped and
 * refreshed once the animation ends. Cards expanded by Connect itself are picked up by an observer.
 * Exposes window.ConnectifyTriggerAccordionAnimationGuard.
 */
(() => {
  'use strict';

  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const notifyResultsUpdated = card => window.ConnectifyData?.notifyResultsUpdated?.(card);
  const isBulkExpanding = () => Boolean(window.ConnectifyIsBulkExpanding);

  let animGuardTimer = null;
  const pendingCardsToUpdate = new Set();

  function triggerAccordionAnimationGuard(duration = 380, cardToUpdate = null) {
    window.ConnectifyIsAccordionAnimating = true;
    if (cardToUpdate) pendingCardsToUpdate.add(cardToUpdate);
    const effectiveDuration = cardToUpdate ? duration : Math.max(duration, 450);
    clearTimeout(animGuardTimer);
    animGuardTimer = setTimeout(() => {
      window.ConnectifyIsAccordionAnimating = false;
      const cards = Array.from(pendingCardsToUpdate);
      pendingCardsToUpdate.clear();
      if (!isBulkExpanding()) cards.forEach(notifyResultsUpdated);
      if (cards.length > 0) {
        window.ConnectifyCohort?.schedule?.(true);
        window.ConnectifyCompoundProgress?.update?.();
        window.ConnectifyDataSyncCharts?.();
      }
    }, effectiveDuration);
  }
  window.ConnectifyTriggerAccordionAnimationGuard = triggerAccordionAnimationGuard;

  // User clicks on a subject accordion header: mute observers while it animates
  document.addEventListener('click', e => {
    const heading = e.target.closest('.eds-c-accordion__section-heading, .cvr-c-accordion__section-heading');
    if (!heading || isBulkExpanding()) return;
    const wasCollapsed = /show details/i.test(heading.textContent);
    if (!wasCollapsed) {
      triggerAccordionAnimationGuard(450, null);
      return;
    }
    // Expanding: the card is scraped once the animation completes
    triggerAccordionAnimationGuard(380, heading.closest(CARD_SELECTOR));
  });

  // Task rows added outside an animation (e.g. Connect expanding a card itself)
  const expandMutationObserver = new MutationObserver(mutations => {
    if (window.ConnectifyIsAccordionAnimating || isBulkExpanding()) return;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1 || !(node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task'))) continue;
        const card = node.closest(CARD_SELECTOR);
        if (card) {
          notifyResultsUpdated(card);
          return;
        }
      }
    }
  });

  const observe = () => expandMutationObserver.observe(document.body, { childList: true, subtree: true });
  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe);

  window.ConnectifyAccordionWatch = { triggerAccordionAnimationGuard, pendingCardsToUpdate };
})();
