/**
 * Connectify Content: saving the files of one or more section headings as one download, so the browser never asks to
 * allow multiple downloads. One file saves as itself, one heading's files as a flat ZIP (<class> <heading>.zip), several
 * headings' as a ZIP with a folder per heading (<class>.zip). Exposes window.ConnectifyContentSave.
 */
(() => {
  'use strict';

  if (window.ConnectifyContentSave) return;

  const Files = window.ConnectifyContentFiles;
  const LIMIT = 4;

  const safeName = text => String(text || '').replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Runs fn over the items, a few at a time, and returns the results in the items' order. */
  async function pool(items, fn, limit = LIMIT) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  /** What [{ heading, urls }] saves as: { name, files: [{ url, path }], archive }; empty headings add nothing. */
  function plan(groups, className) {
    const filled = groups.filter(g => g.urls.length);
    const names = urls => Files.uniqueNames(urls.map(Files.fileName));
    if (filled.length === 1) {
      const [{ heading, urls }] = filled;
      const paths = names(urls);
      const files = urls.map((url, i) => ({ url, path: paths[i] }));
      if (urls.length === 1) return { name: paths[0], files, archive: false };
      return { name: `${safeName(`${className} ${heading}`) || 'Content'}.zip`, files, archive: true };
    }
    const folders = Files.uniqueNames(filled.map(g => safeName(g.heading) || 'Section'));
    const files = filled.flatMap((g, f) => {
      const paths = names(g.urls);
      return g.urls.map((url, i) => ({ url, path: `${folders[f]}/${paths[i]}` }));
    });
    return { name: `${safeName(className) || 'Content'}.zip`, files, archive: true };
  }

  function saveBytes(bytes, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /** Fetched rather than linked, since Connect's own header would name a file "Law+(2007).pdf". */
  async function fileBytes(url) {
    const res = await window.ConnectifyUtils.pageFetch(url, { credentials: 'same-origin' });
    // An expired session answers with the login page
    if (!res.ok || /text\/html/i.test(res.headers.get('content-type') || '')) throw new Error(`Connect returned HTTP ${res.status}`);
    return window.ConnectifyThemeCtme.readFile(await res.blob());
  }

  /** Saves the groups' files; those Connect refuses are left out and counted. Returns { total, failed }. */
  async function save(groups, onProgress = () => {}) {
    const className = document.querySelector('.cvr-c-location-bar__title')?.textContent.trim() || '';
    const { name, files, archive } = plan(groups, className);
    if (!files.length) return { total: 0, failed: 0 };
    let done = 0;
    onProgress(0, files.length);
    const fetched = await pool(files, async file => {
      let entry = null;
      try {
        entry = { name: file.path, bytes: await fileBytes(file.url) };
      } catch (err) {
        console.warn('[Connectify] A file could not be downloaded:', err);
      }
      onProgress(++done, files.length);
      return entry;
    });
    const entries = fetched.filter(Boolean);
    if (entries.length) saveBytes(archive ? window.ConnectifyThemeCtme.zip(entries) : entries[0].bytes, name);
    return { total: files.length, failed: files.length - entries.length };
  }

  window.ConnectifyContentSave = { pool, plan, save };
})();
