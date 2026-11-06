/**
 * Connectify Past Years: opening a past year
 *
 * view(id) writes the archived year's copy under the student's account plus `~p<id>` (past-year-mode.js) and opens
 * Assessment Outlines on it: Connect's outline records of the year's last load, the results cache, class registry,
 * marks and goals as the rollover left them, and the year's settings (only keys the backup sections allow, in the
 * shape they need). The page then runs as usual on the copy, so the outlines and every tool show that year's end and
 * nothing written there reaches this year. Years archived before their records were kept get records rebuilt from
 * the cached tasks (recordsFrom: each task's id names its labels and out-of mark, so ids, overrides and caches still
 * match). A copy is replaced on the next view and removed on Back to This Year. Exposes window.ConnectifyPastYearOpen.
 */
(() => {
  'use strict';
  if (window.ConnectifyPastYearOpen) return;

  const utils = window.ConnectifyUtils;
  const mode = () => window.ConnectifyPastYearMode;
  const copyAccount = id => `${utils.liveAccountKey()}${mode().SUFFIX}${id}`;
  const round = n => Math.round(n * 10000) / 10000;

  /** Removes every past year's copy (keys under the student's account + `~p`). */
  const clearCopies = () => utils.removeStorageKeys(k => k.includes(`${utils.liveAccountKey()}${mode().SUFFIX}`));

  // A task id is JSON [labels, out-of mark] + ":<occurrence>" (ConnectifyParseHelpers.assignTaskIds)
  function identityOf(task) {
    try {
      const [labels, max] = JSON.parse(String(task.id).replace(/:\d+$/, ''));
      return Array.isArray(labels) && labels.length ? { labels, max } : null;
    } catch {
      return null;
    }
  }

  /** An API task (as outline-api.js builds them) for a cached task, with the same labels and texts. */
  function apiTask(task) {
    const identity = identityOf(task);
    if (!identity) return null;
    const { labels, max } = identity;
    const [type, when, name] = labels.length >= 3 ? labels : labels.length === 2 ? [labels[0], '', labels[1]] : ['', '', labels[0]];
    const marked = !task.pending && Number.isFinite(task.score);
    const outOf = Number.isFinite(max) && max > 0 ? max : null;
    const weight = Number.isFinite(task.weight) && task.weight > 0 ? task.weight : null;
    return {
      taskId: task.id, type, when, name,
      mark: marked ? String(round((task.score / 100) * (outOf || 100))) : '',
      max: outOf ? String(outOf) : (marked ? '100' : ''),
      weighted: marked && weight ? String(round((task.score / 100) * weight)) : '',
      weightedMax: weight ? String(weight) : '',
      showChart: Array.isArray(task.stats),
      stats: Array.isArray(task.stats) ? task.stats : null,
      percent: marked ? task.score : null
    };
  }

  /** Outline records rebuilt from a year archived without them: one per class and semester its registry lists. */
  function recordsFrom(entry) {
    const records = [];
    const registry = entry.classSemesters || {};
    for (const [subject, tasks] of Object.entries(entry.subjects || {})) {
      const byId = new Map((Array.isArray(tasks) ? tasks : []).map(t => [t.id, t]));
      const outlines = registry[subject] || { 1: { tasks: [...byId.keys()].map(id => [id]) } };
      for (const semester of [1, 2]) {
        const info = outlines[semester];
        if (!info) continue;
        const listed = (info.tasks || []).map(([id]) => byId.get(id)).filter(Boolean).map(apiTask).filter(Boolean);
        records.push({
          apiOutline: true, title: info.title || `${subject} - Semester ${semester}`, subject, semester,
          statusLine: '', staff: [], school: '', mark: Number.isFinite(info.mark) ? `${info.mark}%` : '', grade: '',
          showChart: false, stats: null, percent: null, outlines: listed.length ? [{ id: semester, code: '', tasks: listed }] : []
        });
      }
    }
    return records;
  }

  /** The keys and values of a year's copy under `acct`. */
  function copyOf(entry, acct) {
    const sections = window.ConnectifyBackupSections;
    const records = Array.isArray(entry.records) && entry.records.length ? entry.records : recordsFrom(entry);
    const values = {
      [`connectify:outline_records:${acct}`]: JSON.stringify({ classNames: entry.classNames, records, savedAt: entry.archivedAt || null }),
      [`connectify:subjects_cache:${acct}`]: JSON.stringify(entry.subjects || {}),
      [`connectify:grade_cache:${acct}`]: JSON.stringify(entry.grades || {}),
      [`connectify:class_semesters:${acct}`]: JSON.stringify(entry.classSemesters || {}),
      [`connectify:year_snapshot:${acct}`]: JSON.stringify({ classNames: entry.classNames, seen: [], snapshot: null })
    };
    if (entry.goals) {
      values[`connectify:goals:${acct}`] = JSON.stringify({ version: 1, goals: Array.isArray(entry.goals.goals) ? entry.goals.goals : [] });
      values[`connectify:goal_verdicts:${acct}`] = JSON.stringify(sections.isObject(entry.goals.verdicts) ? entry.goals.verdicts : {});
    }
    for (const [templated, raw] of Object.entries(entry.settings || {})) {
      const key = sections.untemplate(templated, acct);
      if (sections.sectionOf(key, acct) && sections.check(key, raw)) values[key] = raw;
    }
    return values;
  }

  /** Writes a year's copy; false (and nothing left behind) when it does not fit. */
  function materialize(entry, id) {
    clearCopies();
    try {
      for (const [key, raw] of Object.entries(copyOf(entry, copyAccount(id)))) localStorage.setItem(key, raw);
      return true;
    } catch (err) {
      console.warn('Connectify could not open the past year:', err);
      clearCopies();
      return false;
    }
  }

  /** Opens Assessment Outlines on a past year: 'opening', 'full' (no room for its copy) or 'missing'. */
  function view(id) {
    const year = window.ConnectifyYearArchive.find(id);
    if (!year) return 'missing';
    if (!materialize(year.entry, id)) return 'full';
    if (!mode().enter({ id, year: year.year, label: year.label, savedAt: year.entry.archivedAt })) { clearCopies(); return 'full'; }
    if (utils.isOutlinesPage()) location.reload();
    else location.href = utils.OUTLINES_URL;
    return 'opening';
  }

  /** Back to this year: the copy is removed and the outlines reload on the student's own data. */
  function back() {
    mode().exit();
    clearCopies();
    location.reload();
  }

  window.ConnectifyPastYearOpen = { view, back, materialize, copyOf, recordsFrom, apiTask, clearCopies };
})();
