/**
 * Connectify Assessment: the old Assessment Outlines look
 *
 * Connect replaced its Vaadin outlines (October 2026) with Angular cards (cnt-sao-card) and canvas boxplots.
 * Each card Connect shows is drawn again in the old markup (legacy-outlines-markup.js) from Connect's API
 * record (outline-api.js) inside #cx-legacy-outlines, in Connect's order, and Connect's own card is hidden
 * (.cx-legacy-hidden); Connect's filter menu still decides which cards are shown. Connect renders nothing
 * until it has fetched every boxplot one by one (~13s), so until its cards or filter bar appear every outline
 * is drawn in the API's order (Connect's own) into Connect's zone, boxplots filling in as they arrive
 * (ConnectifyOutlineApi.drawable). Show / Hide Details adds
 * and removes the task rows as Vaadin did, so Expand All, Jump To, the cohort panels and every other
 * outline feature work on them unchanged. Clicking a teacher or school forwards to Connect's own link.
 * Cards without a record, or a page where the API failed, keep Connect's new look.
 * Exposes window.ConnectifyLegacyOutlines.
 */
(() => {
  'use strict';

  if (window.ConnectifyLegacyOutlines) return;

  const { normalize } = window.ConnectifyUtils;
  const HOST_ID = 'cx-legacy-outlines';
  const HIDDEN = 'cx-legacy-hidden';
  const markup = () => window.ConnectifyLegacyMarkup;
  const outlineApi = () => window.ConnectifyOutlineApi;
  // Titles of expanded tiles, kept when a tile is drawn again (a filter change, an API refresh)
  const expanded = new Set();

  const angularCards = () => Array.from(document.querySelectorAll('cnt-sao-card'));
  const titleOf = card => normalize(card.querySelector('mat-card-title')?.textContent);
  // Angular's "col-12 mb-3" wrapper around each card
  const slotOf = card => card.closest('.col-12') || card;
  // Connect shows only its progress bar until its cards arrive, with the filter bar above them
  const connectPending = () => !document.querySelector('cnt-sao-card, cnt-category-bar');
  const zone = () => document.getElementById('ng-zone__student-assessment-outline') || document.querySelector('cnt-progress-bar')?.parentElement || null;

  /** The host, placed in parent before the given node (or last). */
  function ensureHost(parent, before) {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      // Vaadin's app classes: Connect's connect-vr theme styles everything under .connect-vr
      host.className = 'v-app connect-vr assessmentoutlinesui';
      host.innerHTML = '<div class="v-ui"><div class="v-csslayout v-layout v-widget">' +
        '<div class="v-csslayout v-layout v-widget cvr-u-padding--md v-csslayout-cvr-u-padding--md eds-s-is-last v-csslayout-eds-s-is-last">' +
        '<div class="v-csslayout v-layout v-widget eds-s-is-first v-csslayout-eds-s-is-first cvr-u-margin-bottom--xs v-csslayout-cvr-u-margin-bottom--xs cx-legacy-list">' +
        '</div></div></div></div>';
    }
    if (host.parentElement !== parent || host.nextElementSibling !== before) parent.insertBefore(host, before);
    return host;
  }

  function buildSlot(record) {
    const slot = document.createElement('div');
    slot.className = 'v-csslayout v-layout v-widget cv-soa-course v-csslayout-cv-soa-course';
    slot.dataset.cxOutline = record.title;
    slot.innerHTML = markup().tile(record, false);
    slot.firstElementChild._cxOutline = record;
    return slot;
  }

  /**
   * Draws every card Connect shows that has an API record, in Connect's order, and hides Connect's copy;
   * before Connect has rendered, every record in the API's order.
   */
  let retry = null;
  function sync() {
    const records = outlineApi()?.drawable?.() || [];
    if (!records.length || !markup() || !window.ConnectifyUtils.isOutlinesPage()) return;
    let shown = [];
    let parent = null;
    let before = null;
    if (connectPending()) {
      parent = zone();
      if (!parent) return;
      shown = records;
    } else {
      const byTitle = new Map(records.map(r => [r.title, r]));
      for (const card of angularCards()) {
        const record = byTitle.get(titleOf(card));
        const slot = slotOf(card);
        if (slot.classList.contains(HIDDEN) !== Boolean(record)) slot.classList.toggle(HIDDEN, Boolean(record));
        if (!record) continue;
        if (!before) { before = slot; parent = slot.parentElement; }
        shown.push(record);
      }
    }
    if (!shown.length) { document.getElementById(HOST_ID)?.remove(); return; }
    const list = ensureHost(parent, before).querySelector('.cx-legacy-list');
    const existing = new Map(Array.from(list.children, el => [el.dataset.cxOutline, el]));
    // Expand All holds the headings it is about to click: a changed tile waits until it has finished
    const holding = Boolean(window.ConnectifyIsBulkExpanding);
    let previous = null;
    for (const record of shown) {
      let slot = existing.get(record.title);
      existing.delete(record.title);
      // A changed record (a boxplot arriving, a refresh) is drawn afresh; an unchanged one keeps its panels and state
      if (slot && slot.firstElementChild?._cxOutline !== record) {
        if (holding) { clearTimeout(retry); retry = setTimeout(sync, 500); } else { slot.remove(); slot = null; }
      }
      if (!slot) {
        slot = buildSlot(record);
        if (expanded.has(record.title)) { expanded.delete(record.title); queueMicrotask(() => setExpanded(slot.firstElementChild, true)); }
      }
      const wanted = previous ? previous.nextSibling : list.firstChild;
      if (slot !== wanted) list.insertBefore(slot, wanted);
      previous = slot;
    }
    existing.forEach(el => el.remove());
  }

  /** Expands (adds the task rows) or collapses (removes them) a drawn tile. */
  function setExpanded(tile, open) {
    const record = tile?._cxOutline;
    const section = tile?.querySelector('.eds-c-accordion__section');
    if (!record || !section) return;
    const panel = section.querySelector(':scope > .eds-c-accordion__panel');
    if (open === Boolean(panel)) return;
    if (open) expanded.add(record.title); else expanded.delete(record.title);
    section.classList.toggle('eds-s-is-active', open);
    section.classList.toggle('v-csslayout-eds-s-is-active', open);
    const trigger = section.querySelector('.eds-c-accordion__trigger');
    trigger?.classList.toggle('eds-s-is-active', open);
    trigger?.classList.toggle('v-button-eds-s-is-active', open);
    trigger?.setAttribute('aria-expanded', String(open));
    const icon = trigger?.querySelector('.v-icon');
    if (icon) icon.className = `v-icon cvr-c-icon--${open ? 'collapse' : 'expand'}`;
    const label = section.querySelector('.eds-c-accordion__section-label');
    if (label) label.textContent = open ? 'Hide Details' : 'Show Details';
    if (open) section.insertAdjacentHTML('beforeend', markup().detailsPanel(record));
    else panel.remove();
  }

  // A teacher or school name: Connect's own link on its hidden card opens the same profile
  function forwardLink(target) {
    const link = target.closest?.(`#${HOST_ID} .cvr-c-data-nav-link`);
    const title = link?.closest('.eds-c-tile')?._cxOutline?.title;
    if (!title) return;
    const card = angularCards().find(c => titleOf(c) === title);
    const text = normalize(link.textContent);
    Array.from(card?.querySelectorAll('a') || []).find(a => normalize(a.textContent) === text)?.click();
  }

  // Registered after assessment-accordion-watch.js, so it reads "Show Details" before the tile toggles
  document.addEventListener('click', e => {
    const heading = e.target.closest?.(`#${HOST_ID} .eds-c-accordion__section-heading`);
    if (!heading) { forwardLink(e.target); return; }
    const tile = heading.closest('.eds-c-tile');
    setExpanded(tile, !tile.querySelector('.eds-c-accordion__panel'));
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const trigger = e.target.closest?.(`#${HOST_ID} .eds-c-accordion__trigger`);
    if (!trigger) return;
    e.preventDefault();
    trigger.click();
  });

  /** The drawn tile for an API record (or its title), or null while Connect does not show it. */
  function tileFor(record) {
    const title = typeof record === 'string' ? record : record?.title;
    const slot = Array.from(document.querySelectorAll(`#${HOST_ID} .cv-soa-course`)).find(el => el.dataset.cxOutline === title);
    return slot?.firstElementChild || null;
  }

  // Connect adding, removing or filtering its cards (or dropping the host while re-rendering)
  const touchesCards = m => m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 &&
    (n.id === HOST_ID || n.matches?.('cnt-sao-card, cnt-category-bar, .col-12') || n.querySelector?.('cnt-sao-card, cnt-category-bar')));
  window.ConnectifyScheduler?.onMutations?.(sync, { filter: touchesCards, mute: false });
  window.addEventListener('connectify-outlines-preview', sync);
  window.addEventListener('connectify-outlines-loaded', sync);
  sync();

  window.ConnectifyLegacyOutlines = { HOST_ID, HIDDEN, sync, setExpanded, tileFor };
})();
