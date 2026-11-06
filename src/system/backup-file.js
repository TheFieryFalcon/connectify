/**
 * Connectify Backup: the backup file
 *
 * collect() gathers everything Settings' Backup exports into one object (build() once storage is read): { format: 'connectify-backup', version,
 * exportedAt, appVersion, user (Connect's user id), sections: { <section>: { <{account}-templated key>: raw string } } }
 * (backup-sections.js names the keys). Large values kept in extension storage (custom themes with their wallpapers,
 * the Settings wallpaper, categories, the year archive) are read from there, where they are whole. save() downloads it
 * as connectify_backup_<date>.json; readFile() reads a picked file as text (Firefox gives Manifest V3 content scripts
 * page-owned buffers they may not read; a string is always copied) and parse() checks it, keeping only allowlisted
 * keys whose values have the shape they need. Exposes window.ConnectifyBackup.
 */
(() => {
  'use strict';
  if (window.ConnectifyBackup) return;

  const FORMAT = 'connectify-backup';
  const VERSION = 1;
  const MAX_BYTES = 256 * 1024 * 1024;
  const sections = () => window.ConnectifyBackupSections;
  const utils = () => window.ConnectifyUtils;
  const storageApi = () => (typeof browser !== 'undefined' && browser?.storage ? browser : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null));

  /** Extension storage values for keys ({} without extension storage). */
  function extensionValues(keys) {
    return new Promise(resolve => {
      const api = storageApi();
      if (!api?.storage?.local) { resolve({}); return; }
      let done = false;
      const finish = res => { if (!done) { done = true; resolve(res || {}); } };
      try {
        const p = api.storage.local.get(keys, finish);
        if (p && typeof p.then === 'function') p.then(finish, () => finish({}));
      } catch { finish({}); }
    });
  }

  const asText = v => (v === undefined || v === null ? null : typeof v === 'string' ? v : JSON.stringify(v));

  /** The backup object from localStorage, the extension storage values `ext` and the archive as read from both stores. */
  function build(ext = {}, years = null) {
    const S = sections();
    const acct = utils().accountKey();
    const out = {};
    for (const { id } of S.SECTIONS) out[id] = S.collect([id], acct);
    if (ext['cx-categories']) out.categories['cx-categories'] = asText(ext['cx-categories']);
    for (const key of S.THEME_KEYS) if (asText(ext[key])) out.themes[key] = asText(ext[key]);
    const archive = window.ConnectifyYearArchive;
    if (archive && years) {
      const key = S.template(archive.key(), acct);
      if (years.length) out.archive[key] = JSON.stringify(years); else delete out.archive[key];
    }
    for (const id of Object.keys(out)) if (!Object.keys(out[id]).length) delete out[id];
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: Date.now(),
      appVersion: (typeof chrome !== 'undefined' && chrome?.runtime?.getManifest?.().version) || null,
      user: utils().signedInUserId?.() || null,
      sections: out
    };
  }

  /** Everything the student keeps in this browser, as one backup object. */
  async function collect() {
    const ext = await extensionValues(['cx-categories', ...sections().THEME_KEYS]);
    const archive = window.ConnectifyYearArchive;
    if (archive) await archive.ready();
    return build(ext, archive ? archive.read() : null);
  }

  const fileName = (at = new Date()) => {
    const pad = n => String(n).padStart(2, '0');
    return `connectify_backup_${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}.json`;
  };

  /** Downloads a backup object as its file. */
  function save(backup) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    a.download = fileName(new Date(backup.exportedAt || Date.now()));
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }

  /** A picked file's text. */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.size > MAX_BYTES) { reject(Object.assign(new Error('The file is too large'), { code: 'invalid' })); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(Object.assign(new Error('The file could not be read'), { code: 'unreadable' }));
      reader.readAsText(file);
    });
  }

  const fail = code => Object.assign(new Error(code), { code });

  /**
   * A checked backup from a file's text: { exportedAt, user, sections: { id: { values, invalid } } }, values keyed by
   * this student's own keys. Throws code 'invalid' (not a backup) or 'newer' (made by a newer Connectify).
   */
  function parse(text, acct = utils().accountKey()) {
    const S = sections();
    let raw;
    try { raw = JSON.parse(text); } catch { throw fail('invalid'); }
    if (!S.isObject(raw) || raw.format !== FORMAT || !Number.isInteger(raw.version) || !S.isObject(raw.sections)) throw fail('invalid');
    if (raw.version > VERSION) throw fail('newer');
    const out = {};
    for (const { id } of S.SECTIONS) {
      const given = raw.sections[id];
      if (given === undefined) continue;
      const values = {};
      let invalid = !S.isObject(given);
      for (const [templated, value] of Object.entries(S.isObject(given) ? given : {})) {
        const key = S.untemplate(templated, acct);
        // A key of another section, a cache or a flag is never written; a value of the wrong shape marks the section
        if (S.sectionOf(key, acct) !== id || !S.check(key, value)) { invalid = true; continue; }
        values[key] = value;
      }
      out[id] = { values, invalid };
    }
    return {
      exportedAt: Number.isFinite(raw.exportedAt) ? raw.exportedAt : null,
      user: typeof raw.user === 'string' || typeof raw.user === 'number' ? String(raw.user) : null,
      sections: out
    };
  }

  window.ConnectifyBackup = { FORMAT, VERSION, build, collect, save, fileName, readFile, parse, extensionValues };
})();
