/**
 * Connectify Assessment: outlines from Connect's API
 *
 * Connect's Assessment Outlines page (Angular since October 2026) loads everything from
 * /connectapi/rest/api/v1/app/student/: default_student (the signed-in student), assessmentOutlines (each
 * class's Semester 1 and 2 groups: staff, overall mark and grade, outlines and their tasks) and
 * assessmentOutlines/chart (one call per group: the class's boxplot and each task's). Requests carry the
 * CONNECT_XSRF cookie as X-XSRF-TOKEN, as Connect's own do. The response becomes one record per outline
 * card ({ apiOutline: true, title, subject, semester, ... }): the caches read these instead of the page
 * (assessment-api-parse.js) and the old outline markup is drawn from them (legacy-outlines.js).
 * Loads once per outlines page; fires connectify-outlines-loaded / connectify-outlines-failed.
 * Exposes window.ConnectifyOutlineApi.
 */
(() => {
  'use strict';

  if (window.ConnectifyOutlineApi) return;

  const { normalize } = window.ConnectifyUtils;
  const BASE = '/connectapi/rest/api/v1/app/student/';

  const xsrfToken = () => {
    const match = String(document.cookie || '').match(/(?:^|;\s*)CONNECT_XSRF=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  // Firefox runs a content script's own fetch as the extension; content.fetch is the page's (its cookies)
  function pageFetch(url, init) {
    try {
      if (typeof content !== 'undefined' && typeof content?.fetch === 'function') return content.fetch(url, init);
    } catch {}
    return fetch(url, init);
  }

  async function post(path, body) {
    const res = await pageFetch(BASE + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Connect ${path.split('?')[0]} returned HTTP ${res.status}`);
    const json = await res.json();
    if (json?.status && json.status !== 'SUCCESS') throw new Error(`Connect ${path.split('?')[0]}: ${json.message || json.status}`);
    return json;
  }

  // Quantiles arrive as floats ("56.00000000000001"); 4 places keeps Connect's own values (79.05)
  const round = v => Math.round(Number(v) * 10000) / 10000;
  const text = v => (v === null || v === undefined ? '' : normalize(String(v)));

  /** [min, Q1, median, Q3, max] and the student's percent from one chart entry, or null. */
  function boxplot(data) {
    if (!data) return null;
    const stats = [data.minValue, data.quartile1, data.median, data.quartile3, data.maxValue].map(round);
    if (!stats.every(Number.isFinite) || stats.some((v, i) => i && v < stats[i - 1])) return null;
    return { stats, mark: Number.isFinite(Number(data.mark)) ? round(data.mark) : null };
  }

  // Task groups nest (groups inside groups); the tasks keep Connect's order
  const flatten = groups => (groups || []).flatMap(g => [...(g.tasks || []), ...flatten(g.groups)]);

  function taskOf(t, charts) {
    const chart = charts.get(String(t.taskId)) || null;
    return {
      taskId: t.taskId,
      type: text(t.taskType),
      when: text(t.taskWhen),
      name: text(t.taskDescription),
      mark: text(t.mark),
      max: text(t.maximumMark),
      weighted: text(t.weightedMark),
      weightedMax: text(t.weightedMaximumMark),
      showChart: t.showTaskChart !== false,
      stats: chart?.stats || null,
      percent: chart?.mark ?? null
    };
  }

  function cardRecord(group, chartFor, taskCharts) {
    const semester = Number(group.semester) === 2 ? 2 : 1;
    const subject = text(group.name);
    const results = group.groupResultsData || {};
    const chart = chartFor.get(`${group.assessmentGroupId}:${group.chartAssessmentOutlineId}`) || null;
    return {
      apiOutline: true,
      title: `${subject} - Semester ${semester}`,
      subject,
      semester,
      statusLine: text(group.statusLine),
      staff: (group.staff || []).map(s => text(s.fullName)).filter(Boolean),
      school: text(group.school?.name),
      mark: text(results.mark),
      grade: text(results.grade),
      showChart: results.showGroupChart !== false,
      stats: chart?.stats || null,
      percent: chart?.mark ?? null,
      outlines: (group.outlines || []).filter(o => !o.noData).map(o => ({
        id: o.assessmentOutlineId,
        code: text(o.description),
        tasks: flatten(o.taskGroups).map(t => taskOf(t, taskCharts))
      }))
    };
  }

  let records = null;
  let version = 0;
  let pending = null;
  let failed = null;

  async function fetchRecords() {
    const me = await post('default_student');
    const studentId = me?.items?.[0]?.entityId;
    if (!studentId) throw new Error('Connect named no student');
    const data = await post(`assessmentOutlines?studentId=${encodeURIComponent(studentId)}`);
    const item = data?.items?.[0] || {};
    const groups = [...(item.semester1Groups || []), ...(item.semester2Groups || [])];
    // One chart call per group; a Semester 2 outline lists Semester 1 tasks whose boxplots come with Semester 1's
    const chartFor = new Map();
    const taskCharts = new Map();
    await Promise.all(groups.map(async group => {
      if (!group.assessmentGroupId || !group.chartAssessmentOutlineId) return;
      try {
        const res = await post(`assessmentOutlines/chart?studentId=${encodeURIComponent(studentId)}`,
          { assessmentGroupId: group.assessmentGroupId, assessmentOutlineId: group.chartAssessmentOutlineId });
        const chart = res?.items?.[0] || {};
        chartFor.set(`${group.assessmentGroupId}:${group.chartAssessmentOutlineId}`, boxplot(chart.groupChartData));
        for (const [taskId, entry] of Object.entries(chart.tasksChartData || {})) {
          const plot = boxplot(entry);
          if (plot) taskCharts.set(String(taskId), plot);
        }
      } catch (err) {
        console.warn('Connectify: a boxplot request failed', err);
      }
    }));
    return groups.map(g => cardRecord(g, chartFor, taskCharts)).filter(r => r.subject);
  }

  /** Loads (or with force, reloads) every outline; resolves to the records, or null when Connect refused. */
  function load({ force = false } = {}) {
    if (pending) return pending;
    if (records && !force) return Promise.resolve(records);
    pending = fetchRecords().then(list => {
      records = list;
      failed = null;
      version++;
      window.dispatchEvent(new CustomEvent('connectify-outlines-loaded', { detail: { version } }));
      return records;
    }, err => {
      failed = err;
      console.warn('Connectify could not read Connect\'s assessment outlines:', err);
      window.dispatchEvent(new CustomEvent('connectify-outlines-failed'));
      return null;
    }).finally(() => { pending = null; });
    return pending;
  }

  /** The API record for a record, or for a tile drawn from one (legacy-outlines.js), else null. */
  const recordOf = card => (card?.apiOutline ? card : card?._cxOutline || null);

  window.ConnectifyOutlineApi = {
    load,
    refresh: () => load({ force: true }),
    records: () => records || [],
    isLoaded: () => Boolean(records),
    // Loaded or given up: the grade check waits for this instead of the page's summary marks
    isSettled: () => Boolean(records || failed),
    version: () => version,
    recordOf,
    boxplot,
    xsrfToken
  };

  if (window.ConnectifyUtils.isOutlinesPage?.() && !window.ConnectifyThemeAuth?.isAuthDisabled?.()) load();
})();
