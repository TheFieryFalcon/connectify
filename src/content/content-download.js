/**
 * Connectify Content: a Download button beside each section heading's View on a class's Content page. It saves every
 * file under that heading without leaving the list (content-save.js). Exposes window.ConnectifyContentDownload.
 */
(() => {
  'use strict';

  if (window.ConnectifyContentDownload) return;

  const Files = window.ConnectifyContentFiles;
  const Save = window.ConnectifyContentSave;
  const BUTTON = 'cx-content-download';
  const NOTICE_MS = 4000;

  const captionOf = button => button.querySelector('.v-button-caption');

  function setCaption(button, text, { disabled = false } = {}) {
    captionOf(button).textContent = text;
    button.classList.toggle('v-disabled', disabled);
    button.setAttribute('aria-disabled', String(disabled));
    button.tabIndex = disabled ? -1 : 0;
  }

  function notice(button, text, then = () => setCaption(button, 'Download')) {
    setCaption(button, text);
    setTimeout(then, NOTICE_MS);
  }

  const failedText = ({ total, failed }) => (failed === total ? 'Failed' : `${failed} Failed`);

  const headingOf = card => card.querySelector('.eds-c-heading')?.textContent.trim() || '';

  /** The cards' own order tells same-named headings apart. */
  function nthOfTitle(card) {
    const title = headingOf(card);
    const same = [...document.querySelectorAll(`${Files.APP} .eds-c-card`)].filter(c => headingOf(c) === title);
    return Math.max(0, same.indexOf(card));
  }

  async function download(button) {
    if (button.dataset.cxBusy) return;
    button.dataset.cxBusy = 'true';
    const card = button.closest('.eds-c-card'), heading = headingOf(card);
    setCaption(button, 'Preparing');
    try {
      const urls = await Files.list(heading, nthOfTitle(card));
      const result = await Save.save([{ heading, urls }], (i, n) => setCaption(button, `${i} of ${n}`));
      if (!result.total) setCaption(button, 'No Files', { disabled: true });
      else if (result.failed) notice(button, failedText(result));
      else setCaption(button, 'Download');
    } catch (err) {
      console.warn('[Connectify] Section files could not be read:', err);
      notice(button, 'Failed');
    } finally {
      delete button.dataset.cxBusy;
    }
  }

  /** One of Connect's standard buttons, pressed by click, Enter or Space unless disabled. */
  function createButton(caption, onPress, className) {
    const button = document.createElement('div');
    button.className = `v-button v-widget eds-o-button v-button-eds-o-button eds-c-standard-button v-button-eds-c-standard-button ${className}`;
    button.setAttribute('role', 'button');
    button.tabIndex = 0;
    button.innerHTML = '<span class="v-button-wrap"><span class="v-button-caption"></span></span>';
    captionOf(button).textContent = caption;
    const press = () => { if (!button.classList.contains('v-disabled')) onPress(button); };
    button.addEventListener('click', press);
    button.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      press();
    });
    return button;
  }

  /** The section cards with their View buttons; other cards have no View. */
  function rows() {
    const app = document.querySelector(Files.APP);
    if (!app) return [];
    return [...app.querySelectorAll('.eds-c-card')].map(card => ({
      card,
      view: [...card.querySelectorAll('.v-button')].find(b => b.textContent.trim() === 'View')
    })).filter(row => row.view);
  }

  function sync() {
    for (const { view } of rows()) {
      if (view.parentElement.querySelector(`.${BUTTON}`)) continue;
      view.parentElement.classList.add('cx-content-actions');
      view.before(createButton('Download', download, BUTTON));
    }
  }

  /** Page changes inside the app, never Connectify's own controls changing their captions. */
  const fromPage = record => record.type === 'childList' && record.addedNodes.length > 0 && record.target.closest?.(Files.APP)
    && !record.target.closest(`.${BUTTON}, .cx-content-bulk, .cx-content-check`);

  sync();
  window.ConnectifyScheduler.onMutations(sync, { filter: fromPage, mute: false });

  window.ConnectifyContentDownload = { sync, rows, fromPage, headingOf, nthOfTitle, createButton, setCaption, notice, failedText };
})();
