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
    const tiles = document.querySelectorAll(
      '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], .eds-c-tile, .cvr-c-tile, h1, h2, h3, h4, [data-subject-card], .c-tile'
    );
    if (tiles.length === 0) return true;
    const text = Array.from(tiles)
      .map(c => c.textContent || '')
      .join(' ');
    return /\bYear\s*(?:11|12)\b/i.test(text) || /\bATAR\b/i.test(text) || /\bYear\s*(?:11|12)\b/i.test(document.body?.textContent || '') || /\bATAR\b/i.test(document.body?.textContent || '');
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

    for (const card of document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, [class*="subject-card"]')) {
      const title = normalize(
        card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
        card.getAttribute('data-subject-title') ||
        card.getAttribute('aria-label') ||
        ''
      );
      const semesterMatch = title.match(/\bSemester\s*([12])\b/i) || title.match(/\bSem\s*([12])\b/i);
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
        .filter(r => r.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') === card)
        .map((r, i) => {
          const cells = r.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
          const labels = Array.from(r.querySelectorAll('.cvr-c-task__details .v-label'))
            .map(e => normalize(e.textContent))
            .filter(Boolean);
          const taskLabel = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${i + 1}`;
          return parseAssessment ? parseAssessment(cells[0]?.textContent, cells[1]?.textContent, taskLabel) : null;
        }).filter(Boolean);

      if (tasks.length === 0 && window.ConnectifyData?.getSubjectTasks) {
        const cachedTasks = window.ConnectifyData.getSubjectTasks(title) || window.ConnectifyData.getSubjectTasks(name);
        if (cachedTasks && cachedTasks.length > 0) {
          tasks = cachedTasks
            .filter(t => t && t.name && (t.weight > 0 || !/^Assessment\s+\d+$/i.test(t.name)))
            .map(t => {
              const isPending = Boolean(t.pending || t.score === null || t.score === undefined);
              const scorePct = isPending ? undefined : Number(t.score);
              const weightVal = Number(t.weight) || 0;
              const earnedWeight = (!isPending && Number.isFinite(scorePct)) ? (scorePct / 100) * weightVal : 0;
              return {
                name: t.name,
                weight: weightVal,
                pending: isPending,
                score: scorePct,
                earned: earnedWeight
              };
            });
        }
      }

      let markValue = markMatch ? scoreValue(markMatch[1]) : undefined;
      if (markValue === undefined && tasks.length > 0) {
        const completedTasks = tasks.filter(t => !t.pending && Number.isFinite(t.score) && t.weight > 0);
        const totalCompletedWeight = completedTasks.reduce((s, t) => s + t.weight, 0);
        if (totalCompletedWeight > 0) {
          const earnedWeight = completedTasks.reduce((s, t) => s + (t.score / 100) * t.weight, 0);
          markValue = (earnedWeight / totalCompletedWeight) * 100;
        }
      }

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

  function scanOutlineDetails() {
    // Comply with Rule 7 (No Unauthorized Auto-Expansion):
    // Programmatic accordion clicking without user action is strictly disallowed.
    // User expansion must be triggered explicitly via the "Expand Subject Outlines" button.
  }

  window.ConnectifyAtarScraper = {
    isAtarEligible,
    readCourses,
    scanOutlineDetails
  };

  window.ConnectifyAtar = window.ConnectifyAtar || {};
  window.ConnectifyAtar.readCourses = readCourses;
})();
