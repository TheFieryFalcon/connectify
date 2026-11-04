/**
 * Connectify Content: a Download button beside each section heading's View on a class's Content page. It saves every
 * file under that heading without leaving the list: one file as itself, several as one ZIP named after the class and
 * the heading (one save, so the browser never asks to allow multiple downloads). Exposes window.ConnectifyContentDownload.
 */
(() => {
  'use strict';

  if (window.ConnectifyContentDownload) return;

  const Files = window.ConnectifyContentFiles;
  const BUTTON = 'cx-content-download';
  const NOTICE_MS = 4000;

  const safeName = text => String(text || '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

  /** "Mabey AEPAE T1 W1 (Semester 1).zip" */
  const archiveName = (className, heading) => `${safeName(`${className} ${heading}`) || 'Content'}.zip`;

  function saveLink(href, name) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function saveBytes(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    saveLink(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function fileBytes(url) {
    const res = await window.ConnectifyUtils.pageFetch(url, { credentials: 'same-origin' });
    // An expired session answers with the login page
    if (!res.ok || /text\/html/i.test(res.headers.get('content-type') || '')) throw new Error(`Connect returned HTTP ${res.status}`);
    return window.ConnectifyThemeCtme.readFile(await res.blob());
  }

  /** Fetched rather than linked, since Connect's own header would name it "Law+(2007).pdf". */
  const saveOne = async url => saveBytes(await fileBytes(url), Files.fileName(url));

  /** Fetches the files in turn; those Connect refuses are left out and counted. */
  async function archive(urls, name, onProgress) {
    const names = Files.uniqueNames(urls.map(Files.fileName));
    const entries = [];
    for (let i = 0; i < urls.length; i++) {
      onProgress(i + 1, urls.length);
      try {
        entries.push({ name: names[i], bytes: await fileBytes(urls[i]) });
      } catch (err) {
        console.warn('[Connectify] A file could not be downloaded:', err);
      }
    }
    if (entries.length) saveBytes(window.ConnectifyThemeCtme.zip(entries), name);
    return urls.length - entries.length;
  }

  const captionOf = button => button.querySelector('.v-button-caption');

  function setCaption(button, text, { disabled = false } = {}) {
    captionOf(button).textContent = text;
    button.classList.toggle('v-disabled', disabled);
    button.setAttribute('aria-disabled', String(disabled));
    button.tabIndex = disabled ? -1 : 0;
  }

  function notice(button, text) {
    setCaption(button, text);
    setTimeout(() => setCaption(button, 'Download'), NOTICE_MS);
  }

  const headingOf = card => card.querySelector('.eds-c-heading')?.textContent.trim() || '';

  /** The cards' own order tells same-named headings apart. */
  function nthOfTitle(card) {
    const title = headingOf(card);
    const same = [...document.querySelectorAll(`${Files.APP} .eds-c-card`)].filter(c => headingOf(c) === title);
    return Math.max(0, same.indexOf(card));
  }

  async function download(button) {
    if (button.dataset.cxBusy || button.classList.contains('v-disabled')) return;
    button.dataset.cxBusy = 'true';
    const card = button.closest('.eds-c-card'), heading = headingOf(card);
    setCaption(button, 'Preparing');
    try {
      const urls = await Files.list(heading, nthOfTitle(card));
      if (!urls.length) {
        setCaption(button, 'No Files', { disabled: true });
      } else if (urls.length === 1) {
        await saveOne(urls[0]);
        setCaption(button, 'Download');
      } else {
        const className = document.querySelector('.cvr-c-location-bar__title')?.textContent.trim() || '';
        const failed = await archive(urls, archiveName(className, heading), (i, n) => setCaption(button, `${i} of ${n}`));
        if (failed) notice(button, failed === urls.length ? 'Failed' : `${failed} Failed`);
        else setCaption(button, 'Download');
      }
    } catch (err) {
      console.warn('[Connectify] Section files could not be read:', err);
      notice(button, 'Failed');
    } finally {
      delete button.dataset.cxBusy;
    }
  }

  function createButton() {
    const button = document.createElement('div');
    button.className = `v-button v-widget eds-o-button v-button-eds-o-button eds-c-standard-button v-button-eds-c-standard-button ${BUTTON}`;
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.innerHTML = '<span class="v-button-wrap"><span class="v-button-caption">Download</span></span>';
    button.addEventListener('click', () => download(button));
    button.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      download(button);
    });
    return button;
  }

  /** Every section card's View gets its Download; other cards have no View. */
  function sync() {
    const app = document.querySelector(Files.APP);
    if (!app) return;
    for (const card of app.querySelectorAll('.eds-c-card')) {
      const view = [...card.querySelectorAll('.v-button')].find(b => b.textContent.trim() === 'View');
      if (!view || view.parentElement.querySelector(`.${BUTTON}`)) continue;
      view.parentElement.classList.add('cx-content-actions');
      view.before(createButton());
    }
  }

  const fromPage = record => record.type === 'childList' && record.addedNodes.length > 0 && record.target.closest?.(Files.APP)
    && !record.target.closest(`.${BUTTON}`);

  sync();
  window.ConnectifyScheduler.onMutations(sync, { filter: fromPage, mute: false });

  window.ConnectifyContentDownload = { archiveName, sync };
})();
