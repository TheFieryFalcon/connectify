/**
 * Connectify Content: the Download button on the Published Sections bar. It toggles in place on the same list: ticks
 * appear in the left margin of each section heading and the bar gains Select All and Cancel, with Download staying where
 * it was to save the ticked headings as one download (content-save.js). Exposes window.ConnectifyContentBulk.
 */
(() => {
  'use strict';

  if (window.ConnectifyContentBulk) return;

  const Files = window.ConnectifyContentFiles;
  const Save = window.ConnectifyContentSave;
  const Rows = window.ConnectifyContentDownload;
  const BULK = 'cx-content-bulk';
  const CHECK = 'cx-content-check';
  const SELECTABLE = 'cx-content-selectable';
  const HOST = 'cx-content-bulk-host';

  let selecting = false;
  let busy = false;
  let bar = null; // { root, selectAll, cancel, download }

  const checks = () => Rows.rows().map(({ card }) => card.querySelector(`.${CHECK} input`)).filter(Boolean);

  function paint() {
    if (!bar) return;
    bar.root.classList.toggle('cx-content-bulk--selecting', selecting);
    bar.selectAll.hidden = bar.cancel.hidden = !selecting;
    if (busy) return;
    const boxes = checks(), ticked = boxes.filter(b => b.checked).length;
    Rows.setCaption(bar.selectAll, boxes.length && ticked === boxes.length ? 'Select None' : 'Select All');
    Rows.setCaption(bar.cancel, 'Cancel');
    Rows.setCaption(bar.download, selecting && ticked ? `Download (${ticked})` : 'Download', { disabled: selecting && !ticked });
  }

  function addCheck(card) {
    if (card.querySelector(`.${CHECK}`)) return;
    const label = document.createElement('label');
    label.className = CHECK;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.setAttribute('aria-label', `Select ${Rows.headingOf(card)}`);
    box.addEventListener('change', paint);
    label.appendChild(box);
    card.classList.add(SELECTABLE);
    card.appendChild(label);
  }

  function removeCheck(card) {
    card.querySelector(`.${CHECK}`)?.remove();
    card.classList.remove(SELECTABLE);
  }

  function setSelecting(on) {
    selecting = on;
    for (const { card } of Rows.rows()) (on ? addCheck : removeCheck)(card);
    paint();
  }

  function toggleAll() {
    const boxes = checks(), tick = !boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = tick; });
    paint();
  }

  /** The ticked headings' links; a heading that cannot be read is counted as one failure. */
  async function lookUp(cards) {
    let unread = 0;
    const groups = await Save.pool(cards, async card => {
      const heading = Rows.headingOf(card);
      try {
        return { heading, urls: await Files.list(heading, Rows.nthOfTitle(card)) };
      } catch (err) {
        console.warn('[Connectify] Section files could not be read:', err);
        unread++;
        return { heading, urls: [] };
      }
    });
    return { groups, unread };
  }

  function finish() {
    busy = false;
    setSelecting(false);
    sync(); // A section opened meanwhile drops the bar now
  }

  async function downloadTicked() {
    const cards = Rows.rows().map(r => r.card).filter(card => card.querySelector(`.${CHECK} input`)?.checked);
    busy = true;
    Rows.setCaption(bar.selectAll, bar.selectAll.textContent, { disabled: true });
    Rows.setCaption(bar.cancel, 'Cancel', { disabled: true });
    Rows.setCaption(bar.download, 'Preparing', { disabled: true });
    const button = bar.download;
    const progress = (i, n) => Rows.setCaption(button, `${i} of ${n}`, { disabled: true });
    try {
      const { groups, unread } = await lookUp(cards);
      const saved = await Save.save(groups, progress);
      const result = { total: saved.total + unread, failed: saved.failed + unread };
      if (!result.total) Rows.notice(button, 'No Files', finish);
      else if (result.failed) Rows.notice(button, Rows.failedText(result), finish);
      else finish();
    } catch (err) {
      console.warn('[Connectify] Sections could not be downloaded:', err);
      Rows.notice(button, 'Failed', finish);
    }
  }

  function createBar() {
    const root = document.createElement('div');
    root.className = BULK;
    const selectAll = Rows.createButton('Select All', toggleAll, 'cx-content-bulk__select');
    const cancel = Rows.createButton('Cancel', () => setSelecting(false), 'cx-content-bulk__cancel');
    const download = Rows.createButton('Download', () => {
      if (selecting) downloadTicked();
      else setSelecting(true);
    }, 'cx-content-bulk__download');
    root.append(selectAll, cancel, download);
    return { root, selectAll, cancel, download };
  }

  /** On the list only: opening a section drops the bar's controls, the ticks and the mode. */
  function sync() {
    const rows = Rows.rows();
    const host = document.querySelector(`${Files.APP} .cvr-c-category-toolbar__title`)?.parentElement;
    if (!rows.length || !host) {
      if (busy) return;
      bar?.root.remove();
      bar = null;
      selecting = false;
      return;
    }
    if (!bar) bar = createBar();
    if (bar.root.parentElement !== host) {
      host.classList.add(HOST);
      host.appendChild(bar.root);
      paint();
    }
    if (selecting) {
      rows.forEach(({ card }) => addCheck(card));
      paint();
    }
  }

  sync();
  window.ConnectifyScheduler.onMutations(sync, { filter: Rows.fromPage, mute: false });

  window.ConnectifyContentBulk = { sync, setSelecting };
})();
