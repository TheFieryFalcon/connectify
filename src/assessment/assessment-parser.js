/**
 * Connectify Assessment Parser
 *
 * Extracts tasks, dates, weights, and syllabus structures from Connect DOM cards.
 * Exposes window.ConnectifyParser.
 */
(() => {
  'use strict';

  try {
  const { normalize, customWeekOrder, readTimeOverride } = window.ConnectifyUtils;

    const getTaskStats = (...args) => (window.ConnectifyCache?.getTaskStats || function() { return null; })(...args);
  const { orderHint, cohortMean, cardTaskIds } = window.ConnectifyParseHelpers;

  /**
   * Return task caption without hardcoded subject overrides.
   */
  function correctedCaption(title, task, caption) {
    return caption;
  }

  function parseSemester(card) {
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    const match = title.match(/Semester\s*([12])/i) || title.match(/Sem\s*([12])/i);
    return match ? +match[1] : 1;
  }

  function setTaskRow(task, rowEl) {
    if (!task) return;
    try {
      Object.defineProperty(task, 'row', {
        value: rowEl,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch {
      task.row = rowEl;
    }
  }

  /** Weight from a Weighted Mark cell ("5 Out of 5", "12%", "- Out of 30"), or null. */
  function weightFromText(weightText) {
    let weight = null;
    const weightFracMatch = weightText.match(/^(\d+(?:\.\d+)?|[-–—])\s*(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)$/i);
    if (weightFracMatch) {
      const den = Number(weightFracMatch[2]);
      const num = (weightFracMatch[1] === '-' || weightFracMatch[1] === '–' || weightFracMatch[1] === '—')
        ? null
        : Number(weightFracMatch[1]);
      if (den === 0) {
        weight = 0;
      } else if (den === 100) {
        weight = num !== null ? num : 100;
      } else if (den > 0 && den < 100) {
        weight = den;
      } else {
        weight = (num !== null && den > 0) ? (num / den) * 100 : den;
      }
    } else {
      const weightMatch = weightText.match(/(\d+(?:\.\d+)?)\s*%/i) ||
                          weightText.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i) ||
                          weightText.match(/^(\d+(?:\.\d+)?)$/i);
      weight = weightMatch ? Number(weightMatch[1]) : null;
    }
    return weight !== null && !Number.isFinite(weight) ? null : weight;
  }

  const subjectOf = title => title
    .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
    .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
    .trim();

  /**
   * One cached task record from a task's id entry (ConnectifyParseHelpers.assignTaskIds), its Weighted
   * Mark text and its boxplot (stats; else the stats cache) and cohort mean. Card rows and Connect's API
   * records (assessment-api-parse.js) both build tasks here, so either gives the same cache.
   */
  function taskRecord({ title, subjectName, cardSemester, entry, weightText, stats, mean, sequence }) {
    const { id, occurrence, labels, statsKey } = entry;
    const { score, isCompleted } = entry.mark;
    const taskName = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${sequence + 1}`;
    const caption = correctedCaption(title, taskName, labels[1] || '');
    const overrideOrder = customWeekOrder(readTimeOverride([subjectName, title], [id, occurrence === 0 ? taskName : null]));
    const record = {
      id,
      name: taskName,
      caption,
      // Every label, as the Type dropdown keys overrides and detects types, so cached tasks need no row
      labelsKey: labels.join('::'),
      // Boxplot stats cache key: a repeated name ("Close reading" in both exams) is keyed by its id
      statsKey,
      score: isCompleted ? score : null,
      pending: !isCompleted,
      weight: weightFromText(normalize(weightText)),
      mean: Number.isFinite(mean) ? mean : null,
      // Semester 2 outlines list the Semester 1 tasks too: the task's own week decides, not the card
      semester: window.ConnectifyParseHelpers.taskSemester(cardSemester, caption, overrideOrder),
      // A week override typed in the Progress Graph wins; the generic name key only applies to the first occurrence
      order: overrideOrder ?? orderHint(caption),
      sequence
    };
    const cached = Array.isArray(stats) && stats.length === 5 ? stats : getTaskStats(subjectName, statsKey);
    if (cached) record.stats = cached;
    return record;
  }

  // The bridged boxplot stamped on a row's chart, or null
  function rowStats(row) {
    const chartHost = row.querySelector('[data-highcharts-chart], .cvr-c-task__chart');
    try {
      const parsed = JSON.parse(chartHost?.dataset?.connectifyStats || 'null');
      return Array.isArray(parsed) && parsed.length === 5 ? parsed : null;
    } catch { return null; }
  }

  /**
   * Parses tasks from a single subject card into records without modifying cache or DOM. A card drawn from
   * Connect's API (legacy-outlines.js) or an API record itself is read from the API data, never its rows.
   */
  function parseCardSubjectTasks(card) {
    if (!card) return null;
    const fromApi = window.ConnectifyOutlineApi?.recordOf?.(card);
    if (fromApi) return window.ConnectifyApiParse?.parse?.(fromApi, card.apiOutline ? null : card) ?? null;
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    if (!title) return null;
    const subjectName = subjectOf(title);
    if (!subjectName) return null;

    const taskRows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
    if (taskRows.length === 0) return null;

    const parsedTasks = [];
    const ids = cardTaskIds(card);
    const cardSemester = parseSemester(card);
    for (const row of taskRows) {
      const entry = ids.get(row);
      if (!entry) continue;
      const weightText = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1]?.textContent;
      const record = taskRecord({
        title, subjectName, cardSemester, entry, weightText, stats: rowStats(row), mean: cohortMean(row), sequence: parsedTasks.length
      });
      setTaskRow(record, row);
      parsedTasks.push(record);
    }

    return { title, subjectName, tasks: parsedTasks };
  }


    window.ConnectifyParser = {
      orderHint,
      correctedCaption,
      parseSemester,
      setTaskRow,
      cohortMean,
      weightFromText,
      subjectOf,
      taskRecord,
      parseCardSubjectTasks
    };
  } catch (err) {
    console.error('Connectify error in assessment-parser.js:', err);
  }
})();
