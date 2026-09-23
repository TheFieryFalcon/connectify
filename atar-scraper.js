/**
 * Connectify ATAR Scraper
 *
 * Scrapes course information, assessment tasks, weights, scores, and semester groupings
 * from Connect's DOM (.eds-c-tile).
 */
(() => {
  'use strict';

  if (window.ConnectifyAtarScraper) return;

  function isAtarEligible() {
    const tiles = document.querySelectorAll('.eds-c-tile__title, .eds-c-tile');
    if (tiles.length === 0) return true;
    const text = Array.from(tiles)
      .map(c => c.textContent || '')
      .join(' ');
    return /\bYear\s*(?:11|12)\b/i.test(text) || /\bATAR\b/i.test(text);
  }

  function readCourses(atarOnly = true) {
    const math = window.ConnectifyMath || {};
    const normalize = math.normalize || (t => String(t ?? '').replace(/\s+/g, ' ').trim());
    const isAtarCourse = math.isAtarCourse || (t => /\bATAR\b/i.test(t));
    const scoreValue = math.scoreValue || (v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    });
    const parseAssessment = math.parseAssessment;
    const taskProgress = math.taskProgress || (() => ({}));

    const result = [[], []];
    const seen = [new Set(), new Set()];

    for (const card of document.querySelectorAll('.eds-c-tile')) {
      const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      const semesterMatch = title.match(/\bSemester\s*([12])\b/i);
      if (!semesterMatch || (atarOnly && !isAtarCourse(title))) continue;

      const name = normalize(
        title
          .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
          .replace(/\bATAR\b/gi, '')
          .replace(/\bYear\s*\d+\b/gi, '')
      );
      const index = Number(semesterMatch[1]) - 1;
      const id = name.toLowerCase();

      if (seen[index].has(id)) continue;
      seen[index].add(id);

      const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(row => !row.closest('.cvr-c-tasks'));
      const summaryText = normalize(summaryRow?.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const markMatch = summaryText.match(/(-?\d+(?:\.\d+)?)\s*%/);

      let tasks = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'))
        .filter(r => r.closest('.eds-c-tile') === card)
        .map((r, i) => {
          const cells = r.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
          const labels = Array.from(r.querySelectorAll('.cvr-c-task__details .v-label'))
            .map(e => normalize(e.textContent))
            .filter(Boolean);
          const taskLabel = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${i + 1}`;
          return parseAssessment ? parseAssessment(cells[0]?.textContent, cells[1]?.textContent, taskLabel) : null;
        }).filter(Boolean);

      let markValue = markMatch ? scoreValue(markMatch[1]) : undefined;

      const hasFinalLetter = Array.from(
        summaryRow?.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark') || []
      ).some(c => /^[ABCDE]$/i.test(normalize(c.textContent)));

      result[index].push({
        id,
        name,
        mark: markValue,
        finalLetter: hasFinalLetter,
        progress: taskProgress(tasks, markValue, index + 1)
      });
    }

    return result;
  }

  function scanOutlineDetails(allSubjects = false, activeSemester = 0) {
    const math = window.ConnectifyMath || {};
    const normalize = math.normalize || (t => String(t ?? '').replace(/\s+/g, ' ').trim());
    const isAtarCourse = math.isAtarCourse || (t => /\bATAR\b/i.test(t));

    for (const card of document.querySelectorAll('.eds-c-tile')) {
      const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      if (
        (!allSubjects && !isAtarCourse(title)) ||
        !new RegExp(`Semester\\s*${activeSemester + 1}\\b`, 'i').test(title)
      ) {
        continue;
      }
      for (const heading of card.querySelectorAll('.eds-c-accordion__section-heading')) {
        if (/show details/i.test(heading.textContent)) {
          const btn = heading.querySelector('button, .v-button, [role="button"]');
          if (btn) btn.click();
        }
      }
    }
  }

  window.ConnectifyAtarScraper = {
    isAtarEligible,
    readCourses,
    scanOutlineDetails
  };

  window.ConnectifyAtar = window.ConnectifyAtar || {};
  window.ConnectifyAtar.readCourses = readCourses;
})();
