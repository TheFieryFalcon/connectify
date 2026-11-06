/**
 * Connectify Backup: what each kind of saved data is
 *
 * The student's own data in this browser, split into the sections Settings' Backup lists (Goals, Task Types, Week
 * Overrides, Calibration and Calculators, Baselines, Categories, Past Years, Themes, Preferences). Each section names
 * the localStorage keys it owns (an allowlist: nothing else is ever exported or written), with the signed-in
 * student's account written as {account}, so a file moves between browsers where the same student has another account
 * key. A year's copy (year-capsule.js) keeps the same sections' keys. Values stay the raw stored strings; check()
 * says whether one has the shape its key needs. Exposes window.ConnectifyBackupSections.
 */
(() => {
  'use strict';
  if (window.ConnectifyBackupSections) return;

  const ACCOUNT = '{account}';
  const utils = () => window.ConnectifyUtils;
  const isObject = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const startsWithAny = (key, prefixes) => prefixes.some(p => key.startsWith(p));

  // A student's own settings under connectify:user:<account>: (ConnectifyUtils.userKey)
  const USER_EXACT = { types: ['connectea:task_type_overrides', 'connectify:weakness_disabled_subjects'], calibration: ['connectea:preferences'] };
  const USER_PREFIXES = { types: ['connectea:class_categories:'], weeks: ['connectea:time_override:', 'connectify:time_override:'] };
  const GLOBAL_PREFERENCES = [
    'connectify:auto_expand', 'connectify:general_cohort_size', 'connectify:atar_percentage', 'connectify:semester_filter',
    'connectify:panel_view', 'connectify:hide_course_stats', 'connectify:hide_early_meters', 'connectify:school_terms',
    'connectify:task_dates_view', 'connectify:progress_mode'
  ];

  // Saved custom themes, the Settings wallpaper and the theme in use (theme-custom-themes.js, theme-custom-tokens.js)
  const THEME_KEYS = ['connectea:custom_themes_list', 'connectea:custom_background', 'connectea:theme:id'];

  /** The section a stored key belongs to for account `acct`, or null (caches, flags and other students' keys). */
  function sectionOf(key, acct) {
    const user = `connectify:user:${acct}:`;
    if (key.startsWith(user)) {
      const rest = key.slice(user.length);
      for (const id of ['types', 'weeks', 'calibration']) {
        if ((USER_EXACT[id] || []).includes(rest) || startsWithAny(rest, USER_PREFIXES[id] || [])) return id;
      }
      return null;
    }
    if (key === `connectify:goals:${acct}` || key === `connectify:goal_verdicts:${acct}`) return 'goals';
    if (key.startsWith(`connectea:atar:2025:${acct}:`)) return 'calibration';
    if (key === `connectify:baseline_backup:${acct}` || utils().baselineKeys('types', acct).concat(utils().baselineKeys('subjects', acct)).includes(key)) return 'baselines';
    if (key === 'cx-categories' || key === 'connectea:categories') return 'categories';
    if (THEME_KEYS.includes(key)) return 'themes';
    if ([`connectify:year_archive:${acct}`, `connectify:year_snapshot:${acct}`, `connectify:new_year_at:${acct}`, `connectify:outline_records:${acct}`,
      `connectify:subjects_cache:${acct}`, `connectify:grade_cache:${acct}`, `connectify:class_semesters:${acct}`].includes(key)) return 'archive';
    if (GLOBAL_PREFERENCES.includes(key) || key.startsWith(`connectea:cohort:v3:${acct}:`) || key === `connectify:calendar_export:${acct}`) return 'preferences';
    return null;
  }

  // Legacy untagged baseline keys hold no account, so only tagged ones are templated
  const template = (key, acct) => key.replace(new RegExp(`:${acct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=:|$)`), `:${ACCOUNT}`);
  const untemplate = (key, acct) => key.split(ACCOUNT).join(acct);

  /** Every stored key of the given sections for `acct`, as { templatedKey: raw value }. */
  function collect(ids, acct = utils().accountKey()) {
    const wanted = new Set(ids);
    const out = {};
    for (const key of utils().storageKeys(k => wanted.has(sectionOf(k, acct)))) {
      const raw = localStorage.getItem(key);
      if (raw !== null) out[template(key, acct)] = raw;
    }
    return out;
  }

  const json = raw => { try { return JSON.parse(raw); } catch { return undefined; } };
  const isNumberText = raw => raw === '' || Number.isFinite(Number(raw));

  /** Whether a raw value has the shape its key needs (anything unreadable is never written). */
  function check(key, raw) {
    if (typeof raw !== 'string' || raw.length > 64 * 1024 * 1024) return false;
    if (key === 'connectea:custom_themes_list') return Array.isArray(json(raw));
    if (key === 'connectea:custom_background') return /^data:image\/[a-z0-9.+-]+[;,]/i.test(raw);
    if (key === 'connectea:theme:id') return /^[\w-]{1,64}$/.test(raw);
    if (key.startsWith('connectify:goals:')) { const v = json(raw); return isObject(v) && Array.isArray(v.goals); }
    if (key.startsWith('connectify:year_archive:')) return Array.isArray(json(raw));
    if (key.startsWith('connectify:outline_records:')) { const v = json(raw); return isObject(v) && Array.isArray(v.records); }
    if (/time_override:/.test(key)) return /^(w?\d{1,2}|t\d\s*w\d{1,2})?$/i.test(raw.trim());
    if (key.startsWith('connectea:cohort:v3:') || key.startsWith('connectify:new_year_at:') ||
      ['connectify:general_cohort_size', 'connectify:atar_percentage'].includes(key)) return isNumberText(raw);
    if (['connectify:auto_expand', 'connectify:hide_course_stats', 'connectify:hide_early_meters'].includes(key)) return raw === 'true' || raw === 'false';
    if (['connectify:panel_view', 'connectify:progress_mode'].includes(key)) return /^[a-z-]{1,20}$/.test(raw);
    if (key.endsWith('weakness_disabled_subjects') || key.includes(':class_categories:')) return Array.isArray(json(raw));
    return isObject(json(raw));
  }

  const SECTIONS = [
    { id: 'goals', label: 'Goals' },
    { id: 'types', label: 'Task Types' },
    { id: 'weeks', label: 'Week Overrides' },
    { id: 'calibration', label: 'Calibration and Calculators' },
    { id: 'baselines', label: 'Baselines' },
    { id: 'categories', label: 'Categories' },
    { id: 'archive', label: 'Past Years' },
    { id: 'themes', label: 'Themes' },
    { id: 'preferences', label: 'Preferences' }
  ];

  window.ConnectifyBackupSections = { ACCOUNT, SECTIONS, GLOBAL_PREFERENCES, THEME_KEYS, sectionOf, template, untemplate, collect, check, isObject };
})();
