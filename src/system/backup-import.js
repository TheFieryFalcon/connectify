/**
 * Connectify Backup: what an import would change, and importing
 *
 * plan(parsed) compares a checked backup (ConnectifyBackup.parse) with this browser, section by section: what the file
 * holds, and whether importing adds to what is here, replaces it, or changes nothing. Past Years and Themes merge (a
 * year is never lost; a theme of the same name is updated); every other section replaces this browser's. A section
 * that would replace data here starts unticked. The file's year in progress joins the archive as a year of its own,
 * which Past Years lists once it is no longer this year. apply(parsed, ids) writes the ticked sections: localStorage
 * writes are undone together if one does not fit; modules with their own stores (baselines, categories, themes) save
 * through their own functions last. Exposes window.ConnectifyBackupImport.
 */
(() => {
  'use strict';
  if (window.ConnectifyBackupImport) return;

  const S = () => window.ConnectifyBackupSections;
  const utils = () => window.ConnectifyUtils;
  const archive = () => window.ConnectifyYearArchive;
  const json = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const plural = (n, word, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;
  const REPLACED = ['goals', 'types', 'weeks', 'calibration', 'preferences'];

  /** This browser's stored keys of a section, as the student's own keys. */
  function hereValues(id, acct) {
    const out = {};
    for (const [templated, raw] of Object.entries(S().collect([id], acct))) out[S().untemplate(templated, acct)] = raw;
    return out;
  }

  const valueOf = (values, prefix) => Object.entries(values).find(([k]) => k.startsWith(prefix))?.[1];

  function mergedBaselines(values, acct) {
    const merged = { types: {}, subjects: {} };
    for (const kind of ['types', 'subjects']) {
      for (const key of utils().baselineKeys(kind, acct)) Object.assign(merged[kind], S().isObject(json(values[key])) ? json(values[key]) : {});
    }
    return merged;
  }

  /** The year a backup was taken in, as an archive entry (null when the file holds no results). */
  function currentYear(parsed, acct) {
    const values = parsed.sections.archive?.values || {};
    const records = json(values[`connectify:outline_records:${acct}`])?.records || null;
    const registry = json(values[`connectify:class_semesters:${acct}`]) || {};
    const snapshot = json(values[`connectify:year_snapshot:${acct}`]);
    const classNames = snapshot?.classNames?.length ? snapshot.classNames : Object.keys(registry).length ? Object.keys(registry)
      : [...new Set((records || []).map(r => r?.subject).filter(Boolean))];
    if (!classNames.length) return null;
    const goals = json(parsed.sections.goals?.values?.[`connectify:goals:${acct}`]);
    const settings = {};
    for (const id of ['types', 'weeks', 'calibration', 'baselines']) {
      for (const [k, raw] of Object.entries(parsed.sections[id]?.values || {})) settings[S().template(k, acct)] = raw;
    }
    const entry = {
      classNames, averages: snapshot?.snapshot || {}, records,
      subjects: json(values[`connectify:subjects_cache:${acct}`]) || {}, grades: json(values[`connectify:grade_cache:${acct}`]) || {},
      classSemesters: registry, settings, goals: goals ? { goals: goals.goals || [], verdicts: json(parsed.sections.goals.values[`connectify:goal_verdicts:${acct}`]) || {} } : null,
      archivedAt: parsed.exportedAt || Date.now()
    };
    entry.year = archive().yearOf(entry);
    return entry;
  }

  const incomingYears = (parsed, acct) => [...(json(parsed.sections.archive?.values?.[`connectify:year_archive:${acct}`]) || []), currentYear(parsed, acct)].filter(Boolean);

  /** What a section holds, as a number and the words for it. */
  function describe(id, values, acct, parsed) {
    if (id === 'goals') return plural((json(values[`connectify:goals:${acct}`])?.goals || []).filter(g => !g.parent).length, 'goal');
    if (id === 'baselines') { const b = mergedBaselines(values, acct); return plural(Object.keys(b.types).length + Object.keys(b.subjects).length, 'baseline'); }
    if (id === 'categories') return plural(Object.keys(json(values['cx-categories'] || values['connectea:categories']) || {}).length, 'category', 'categories');
    if (id === 'themes') {
      const themes = json(values['connectea:custom_themes_list']) || [];
      return [themes.length ? plural(themes.length, 'theme') : '', values['connectea:custom_background'] ? 'a wallpaper' : '',
        values['connectea:theme:id'] ? 'the theme in use' : ''].filter(Boolean).join(', ').replace(/^t/, 'T');
    }
    if (id === 'archive') return (parsed ? incomingYears(parsed, acct) : archive().read()).map(e => archive().label(e)).join(', ');
    const words = { types: 'type', weeks: 'week', calibration: 'saved value', preferences: 'setting' };
    return plural(Object.keys(values).length, words[id]);
  }

  const themeName = t => String(t?.name || '').trim().toLowerCase();

  /** One row per section the file holds: { id, label, file, state ('adds' | 'replaces' | 'same' | 'invalid'), here, ticked }. */
  function plan(parsed, acct = utils().accountKey()) {
    const rows = [];
    for (const { id, label } of S().SECTIONS) {
      const section = parsed.sections[id];
      if (!section || (!Object.keys(section.values).length && !section.invalid)) continue;
      const row = { id, label, file: describe(id, section.values, acct, parsed), here: '', state: 'adds' };
      const here = hereValues(id, acct);
      if (section.invalid) row.state = 'invalid';
      else if (id === 'archive') {
        const before = JSON.stringify(archive().read());
        row.state = JSON.stringify(archive().merge(archive().read(), incomingYears(parsed, acct))) === before ? 'same' : 'adds';
      } else if (id === 'themes') {
        const mine = window.ConnectifyThemeRegistry?.getCustomThemes?.() || [];
        const theirs = json(section.values['connectea:custom_themes_list']) || [];
        const clashes = theirs.filter(t => mine.some(m => themeName(m) === themeName(t)));
        if (clashes.length) { row.state = 'replaces'; row.here = `Replaces ${plural(clashes.length, 'theme')} here`; }
      } else if (Object.keys(here).length) {
        const same = JSON.stringify(Object.entries(here).sort()) === JSON.stringify(Object.entries(section.values).sort());
        row.state = same ? 'same' : 'replaces';
        if (!same) row.here = `Replaces ${describe(id, here, acct)} here`;
      }
      row.ticked = row.state === 'adds';
      // Only caches of a year with no classes yet: nothing to name, nothing to import
      if (row.file || row.state === 'invalid') rows.push(row);
    }
    return rows;
  }

  const chosenValues = (parsed, ids) => id => (ids.includes(id) && !parsed.sections[id]?.invalid ? parsed.sections[id]?.values : null);

  /** Writes the ticked sections kept in localStorage, all or none: throws code 'full' when this browser has no room. */
  function applyStored(parsed, ids, acct = utils().accountKey()) {
    const values = chosenValues(parsed, ids);
    const before = new Map();
    const remember = k => { if (!before.has(k)) before.set(k, localStorage.getItem(k)); };
    const put = (k, v) => { remember(k); localStorage.setItem(k, v); };
    try {
      for (const id of REPLACED) {
        if (!values(id)) continue;
        for (const key of Object.keys(hereValues(id, acct))) { remember(key); localStorage.removeItem(key); }
        for (const [key, raw] of Object.entries(values(id))) put(key, raw);
      }
      if (values('archive')) {
        // A snapshot or new-year mark only where this browser has none: an older one would start a second rollover
        for (const key of [`connectify:year_snapshot:${acct}`, `connectify:new_year_at:${acct}`]) {
          if (values('archive')[key] !== undefined && localStorage.getItem(key) === null) put(key, values('archive')[key]);
        }
        remember(archive().key());
        archive().write(incomingYears(parsed, acct));
      }
    } catch (err) {
      for (const [key, raw] of before) { try { if (raw === null) localStorage.removeItem(key); else localStorage.setItem(key, raw); } catch {} }
      throw Object.assign(new Error('Not enough room'), { code: 'full', cause: err });
    }
  }

  /** Writes the ticked sections, localStorage first; rejects with code 'full' (nothing changed) when it has no room. */
  async function apply(parsed, ids, acct = utils().accountKey()) {
    applyStored(parsed, ids, acct);
    const values = chosenValues(parsed, ids);
    if (values('baselines')) {
      const backupKey = `connectify:baseline_backup:${acct}`;
      if (values('baselines')[backupKey]) try { localStorage.setItem(backupKey, values('baselines')[backupKey]); } catch {}
      window.ConnectifyPredictorBaselines?.saveBaselines?.(mergedBaselines(values('baselines'), acct));
    }
    if (values('categories')) window.ConnectifyCategoryStore?.saveCategories?.(json(values('categories')['cx-categories'] || values('categories')['connectea:categories']));
    if (values('themes')) await importThemes(values('themes'));
    window.ConnectifyCache?.clearPredictorCache?.();
  }

  // Each theme through the theme import's own checks; the theme in use follows it to its saved id
  async function importThemes(themeValues) {
    const reg = window.ConnectifyThemeRegistry;
    const importer = window.ConnectifyThemeImport;
    const savedIds = new Map();
    for (const theme of json(themeValues['connectea:custom_themes_list']) || []) {
      try {
        const saved = await importer?.saveTheme(theme);
        if (saved && theme?.id) savedIds.set(String(theme.id), saved.id);
      } catch (err) { console.warn('Connectify: a backed-up theme was not imported', err); }
    }
    const wallpaper = themeValues['connectea:custom_background'];
    if (wallpaper) window.ConnectifyTheme?.setCustomBackground?.(wallpaper);
    const active = themeValues['connectea:theme:id'];
    const id = savedIds.get(active) || active;
    if (!id || (id !== 'light' && !reg?.getThemeDefinition?.(id))) return;
    if (window.ConnectifyTheme?.setTheme) window.ConnectifyTheme.setTheme(id); else reg.setTheme(id);
  }

  window.ConnectifyBackupImport = { plan, apply, applyStored, currentYear, incomingYears, describe, mergedBaselines };
})();
