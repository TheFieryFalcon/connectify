/**
 * Connectify Assessment Data Scraper
 *
 * Extracts assessment outlines, tasks, raw marks, weights, and cohort boxplot statistics
 * from Connect DOM cards. Provides `window.ConnectifyData`.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyDataInitialized && window.ConnectifyData) return;
    window.__connectifyDataInitialized = true;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  /**
   * Parse a chronological order index from a date/week caption.
   * Maps Term/Week into a numeric sequence (e.g. Term 2 Week 3 -> 13.0).
   *
   * @param {string} text - Raw date or week caption from Connect
   * @returns {number|null} Sequence number for sorting, or null if unreadable
   */
  function orderHint(text) {
    // Matches "Term 3, Week 5" or "Term 3 Week 5"
    let match = text.match(/term\s*(\d).*?week[s]?\s*(\d+)/i);
    if (match) {
      return (+match[1] - 1) * 12 + (+match[2]);
    }

    // Matches "Week 5, Term 3"
    match = text.match(/weeks?\s*(\d+)(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*(\d)/i);
    if (match) {
      return (+match[2] - 1) * 12 + (+match[1]);
    }

    // Matches bare "Week 4" or "Week 4/5"
    match = text.match(/^(?:week[s]?\s*)?(\d{1,2})(?:\s*[\/–-]\s*\d{1,2})?$/i);
    if (match) {
      return +match[1];
    }

    // Fallback: parse month/day date string
    const cleaned = text
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*\s+/i, '');

    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleaned)) {
      const year = new Date().getFullYear();
      const parsedDate = Date.parse(`${cleaned} ${year}`);
      if (Number.isFinite(parsedDate)) {
        // Convert to school week starting from late January
        return (parsedDate - Date.UTC(year, 0, 26)) / 604800000 + 1;
      }
    }

    return null;
  }

  /**
   * Return task caption without hardcoded subject overrides.
   */
  function correctedCaption(title, task, caption) {
    return caption;
  }

  const subjectsCache = new Map();

  function parseSemester(card) {
    const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
    const match = title.match(/Semester\s*([12])/i);
    return match ? +match[1] : 1;
  }

  /**
   * Scrapes tasks from a single subject card and updates subjectsCache.
   */
  function scrapeSubjectTasks(card) {
    if (!card) return;
    const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
    if (!/Semester\s*[12]/i.test(title)) return;

    const subjectName = title.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '');
    const taskRows = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
    if (taskRows.length === 0) return;

    if (!subjectsCache.has(subjectName)) {
      subjectsCache.set(subjectName, new Map());
    }
    const tasks = subjectsCache.get(subjectName);
    const occurrences = new Map();

    for (const row of taskRows) {
      const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
        .map(e => normalize(e.textContent))
        .filter(Boolean);

      const rawMarkText = normalize(row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const scoreMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
      const isPending = /^[-–—]\s*Out\s+of\s+\d/i.test(rawMarkText);

      if (!scoreMatch && !isPending) continue;
      if (scoreMatch && (+scoreMatch[2] <= 0 || +scoreMatch[1] > +scoreMatch[2])) continue;

      const maxScore = scoreMatch ? +scoreMatch[2] : Number(rawMarkText.match(/Out\s+of\s+(\d+(?:\.\d+)?)/i)?.[1]);

      const weightElement = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1];
      const weightMatch = normalize(weightElement?.textContent).match(/Out\s+of\s+(\d+(?:\.\d+)?)/i);
      const weight = weightMatch ? Number(weightMatch[1]) : null;

      const taskName = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${tasks.size + 1}`;
      const caption = correctedCaption(title, taskName, labels[1] || '');

      const identityKey = JSON.stringify([labels, maxScore]);
      const occurrenceCount = occurrences.get(identityKey) || 0;
      occurrences.set(identityKey, occurrenceCount + 1);

      const id = `${identityKey}:${occurrenceCount}`;
      const existingTask = tasks.get(id);

      const record = {
        id,
        name: taskName,
        caption,
        score: scoreMatch ? (+scoreMatch[1] / +scoreMatch[2]) * 100 : null,
        pending: isPending,
        weight,
        mean: cohortMean(row),
        semester: Math.min(parseSemester(card), existingTask?.semester ?? 2),
        order: (() => {
           const customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${taskName}`) ||
                               localStorage.getItem(`connectea:time_override:${title}:${taskName}`);
           if (customOrder !== null && customOrder !== '') {
              const num = Number(customOrder);
              if (Number.isFinite(num) && num > 0) {
                 const term = Math.floor((num - 1) / 10) + 1;
                 const week = ((num - 1) % 10) + 1;
                 return (term - 1) * 12 + week;
              }
           }
           return orderHint(caption);
        })(),
        sequence: existingTask?.sequence ?? tasks.size
      };

      Object.defineProperty(record, 'row', { value: row });
      tasks.set(id, record);
    }
  }

  /**
   * Scrape all subject assessment cards currently present in the DOM.
   * Caches results so data persists even when cards are collapsed by the user.
   *
   * @param {boolean} includePending - Whether to include pending/unmarked assessments
   * @returns {Array<{name: string, tasks: Array<Object>}>} Array of subject records
   */
  function collect(includePending = false) {
    const cards = Array.from(document.querySelectorAll('.eds-c-tile'))
      .sort((a, b) => parseSemester(a) - parseSemester(b));

    for (const card of cards) {
      scrapeSubjectTasks(card);
    }

    return Array.from(subjectsCache, ([name, tasks]) => ({
      name,
      tasks: Array.from(tasks.values())
        .filter(t => includePending || !t.pending)
        .sort((a, b) => {
          if (a.order !== null && b.order !== null) return a.order - b.order;
          return a.sequence - b.sequence;
        })
    }));
  }

  /**
   * Dispatches updates to dependent modules whenever a subject is expanded.
   */
  let notifyUpdateTimer = null;
  function notifyResultsUpdated(card) {
    clearTimeout(notifyUpdateTimer);
    notifyUpdateTimer = setTimeout(() => {
      if (card) {
        scrapeSubjectTasks(card);
      } else {
        collect(true);
      }

      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
      if (window.ConnectifyWeakness?.renderChart) {
        window.ConnectifyWeakness.renderChart();
      }
      if (window.ConnectifyCohort?.schedule) {
        window.ConnectifyCohort.schedule();
      }
      if (window.ConnectifyAtar?.refreshData) {
        window.ConnectifyAtar.refreshData();
      }
      if (window.ConnectifyProgress?.update) {
        window.ConnectifyProgress.update();
      }

      window.dispatchEvent(new CustomEvent('connectify-results-updated', { detail: { card } }));
    }, 180);
  }

  /**
   * Extract estimated cohort mean from Highcharts boxplot series on a task row.
   *
   * @param {Element} row - The task row DOM node
   * @returns {number|null} Estimated cohort mean percentage, or null
   */
  function cohortMean(row) {
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (!host) return null;

    if (host.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      } catch {}
    }

    const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
    if (hostWithDataset?.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      } catch {}
    }

    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return null;

    for (const series of chart.series || []) {
      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        const stats = Array.isArray(pointData)
          ? pointData.slice(-5)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high];

        const isCompleteBoxplot =
          stats.length === 5 &&
          stats.every(v => typeof v === 'number' && Number.isFinite(v)) &&
          stats.every((v, i) => !i || v >= stats[i - 1]);

        if (isCompleteBoxplot) {
          // Weighted 5-number summary mean estimation: (min + 2*Q1 + 2*Median + 2*Q3 + max) / 8
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      }
    }

    return null;
  }

  /**
   * Programmatically click the accordion headers to expand or collapse details.
   */
  function expandAll(expand = true) {
    const pattern = expand ? /show details/i : /hide details/i;
    let clickedAny = false;
    for (const heading of document.querySelectorAll('.eds-c-tile .eds-c-accordion__section-heading')) {
      if (pattern.test(heading.textContent)) {
        heading.querySelector('button, .v-button, [role="button"]')?.click();
        clickedAny = true;
      }
    }
    if (expand && clickedAny) {
      setTimeout(() => notifyResultsUpdated(), 260);
    }
  }

  // Listen for user clicks on subject accordion headers to update results cache immediately upon expansion
  document.addEventListener('click', e => {
    const heading = e.target.closest('.eds-c-accordion__section-heading');
    if (!heading) return;
    const card = heading.closest('.eds-c-tile');
    if (!card) return;

    setTimeout(() => {
      if (card.querySelector('.cvr-c-tasks .cvr-c-task') || /hide details/i.test(heading.textContent)) {
        notifyResultsUpdated(card);
      }
    }, 220);
  }, true);

  // Observe DOM additions inside subject tiles when expanded
  const expandMutationObserver = new MutationObserver(mutations => {
    let expandedCard = null;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')) {
              expandedCard = node.closest('.eds-c-tile');
              if (expandedCard) break;
            }
          }
        }
      }
      if (expandedCard) break;
    }
    if (expandedCard) {
      notifyResultsUpdated(expandedCard);
    }
  });

  if (document.body) {
    expandMutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      expandMutationObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Publish public API
  window.ConnectifyData = {
    collect,
    cohortMean,
    orderHint,
    correctedCaption,
    expandAll,
    scrapeSubjectTasks,
    notifyResultsUpdated
  };
  } catch (err) {
    console.error('Connectify error in assessment-data.js:', err);
  }
})();
