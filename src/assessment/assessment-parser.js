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

  /**
   * Parses tasks from a single subject card into records without modifying cache or DOM.
   */
  function parseCardSubjectTasks(card) {
    if (!card) return null;
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    if (!title) return null;

    const subjectName = title
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .trim();
    if (!subjectName) return null;

    const taskRows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
    if (taskRows.length === 0) return null;

    const parsedTasks = [];
    const ids = cardTaskIds(card);

    for (const row of taskRows) {
      const entry = ids.get(row);
      if (!entry) continue;
      const { id, occurrence, labels, statsKey } = entry;
      const { score, isCompleted } = entry.mark;

      const weightElement = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1];
      const weightText = normalize(weightElement?.textContent);
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
      if (weight !== null && !Number.isFinite(weight)) {
        weight = null;
      }

      const taskName = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${parsedTasks.length + 1}`;
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
        weight,
        mean: cohortMean(row),
        // Semester 2 outlines list the Semester 1 tasks too: the task's own week decides, not the card
        semester: window.ConnectifyParseHelpers.taskSemester(parseSemester(card), caption, overrideOrder),
        // A week override typed in the Progress Graph wins; the generic name key only applies to the first occurrence
        order: overrideOrder ?? orderHint(caption),
        sequence: parsedTasks.length
      };

      const chartHost = row.querySelector('[data-highcharts-chart], .cvr-c-task__chart');
      if (chartHost?.dataset?.connectifyStats) {
        try {
          const parsed = JSON.parse(chartHost.dataset.connectifyStats);
          if (Array.isArray(parsed) && parsed.length === 5) {
            record.stats = parsed;
          }
        } catch {}
      }
      if (!record.stats) {
        const cached = getTaskStats(subjectName, statsKey);
        if (cached) record.stats = cached;
      }

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
      parseCardSubjectTasks
    };
  } catch (err) {
    console.error('Connectify error in assessment-parser.js:', err);
  }
})();
