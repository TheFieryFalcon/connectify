/**
 * Connectify Assessment Parser
 *
 * Extracts tasks, dates, weights, and syllabus structures from Connect DOM cards.
 * Exposes window.ConnectifyParser.
 */
(() => {
  'use strict';

  try {
  const { normalize } = window.ConnectifyUtils;

    const getTaskStats = (...args) => (window.ConnectifyCache?.getTaskStats || function() { return null; })(...args);
  const { orderHint, cohortMean } = window.ConnectifyParseHelpers;

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
    const occurrences = new Map();

    for (const row of taskRows) {
      if (!row.closest('.cvr-c-tasks')) continue;

      const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
        .map(e => normalize(e.textContent))
        .filter(Boolean);
      if (labels.length === 0) continue;

      const rawMarkText = normalize(row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const scoreMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
      const slashMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      const percentMatch = rawMarkText.match(/^(-?\d+(?:\.\d+)?)\s*%$/i) || rawMarkText.match(/(-?\d+(?:\.\d+)?)\s*%/i);
      const isPending = /^[-–—]\s*(?:Out\s+of|\/)\s*\d/i.test(rawMarkText) ||
                        /^[-–—\s]+$/i.test(rawMarkText) ||
                        /pending|not\s*marked/i.test(rawMarkText);

      let score = null;
      let maxScore = null;
      let isCompleted = false;

      if (scoreMatch && +scoreMatch[2] > 0) {
        if (+scoreMatch[1] <= +scoreMatch[2]) {
          score = (+scoreMatch[1] / +scoreMatch[2]) * 100;
          maxScore = +scoreMatch[2];
          isCompleted = true;
        }
      } else if (slashMatch && +slashMatch[2] > 0) {
        if (+slashMatch[1] <= +slashMatch[2]) {
          score = (+slashMatch[1] / +slashMatch[2]) * 100;
          maxScore = +slashMatch[2];
          isCompleted = true;
        }
      } else if (percentMatch) {
        score = Number(percentMatch[1]);
        maxScore = 100;
        isCompleted = true;
      }

      if (!isCompleted && !isPending) continue;

      if (!maxScore) {
        maxScore = Number(rawMarkText.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i)?.[1]) || 100;
      }

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

      const identityKey = JSON.stringify([labels, maxScore]);
      const occurrenceCount = occurrences.get(identityKey) || 0;
      occurrences.set(identityKey, occurrenceCount + 1);

      const id = `${identityKey}:${occurrenceCount}`;

      const record = {
        id,
        name: taskName,
        caption,
        score: isCompleted ? score : null,
        pending: !isCompleted,
        weight,
        mean: cohortMean(row),
        semester: parseSemester(card),
        order: (() => {
           let customOrder = null;
           if (id) {
              customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${id}`) ||
                            localStorage.getItem(`connectea:time_override:${title}:${id}`) ||
                            localStorage.getItem(`connectify:time_override:${subjectName}:${id}`);
           }
           if ((customOrder === null || customOrder === '') && occurrenceCount === 0 && taskName) {
              customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${taskName}`) ||
                            localStorage.getItem(`connectea:time_override:${title}:${taskName}`) ||
                            localStorage.getItem(`connectify:time_override:${subjectName}:${taskName}`);
           }
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
        const cached = getTaskStats(subjectName, taskName);
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
