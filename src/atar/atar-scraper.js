/**
 * Connectify ATAR Scraper
 *
 * Course information, assessment tasks, weights, scores and semester groupings for the ATAR tools,
 * read from the centralized cache (class registry, subjects cache, grade cache), not the tiles.
 */
(() => {
  'use strict';

  if (window.ConnectifyAtarScraper) return;

  const ELIGIBLE_TITLE = /\b(?:Year|Yr|Y)\s*(?:11|12)\b|\bATAR\b|\b(?:11|12)\s+[A-Z]|\bUnit(?:s)?\s*[1-4]\b|\bWACE\b/i;

  function isAtarEligible() {
    // Class titles the registry has seen first, then the page text
    const registry = window.ConnectifyClassSemesters?.get?.() || {};
    const titles = Object.values(registry).flatMap(s => [s?.[1]?.title, s?.[2]?.title]).filter(Boolean);
    if (titles.some(t => ELIGIBLE_TITLE.test(t))) return true;
    const tiles = document.querySelectorAll(
      '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], .eds-c-tile, .cvr-c-tile, h1, h2, h3, h4, [data-subject-card], .c-tile'
    );
    if (tiles.length === 0) return true;
    const text = Array.from(tiles)
      .map(c => c.textContent || '')
      .join(' ');
    const docText = document.body?.textContent || '';
    return /\b(?:Year|Yr|Y)\s*(?:11|12)\b/i.test(text) ||
           /\bATAR\b/i.test(text) ||
           /\b(?:11|12)\s+[A-Z]/i.test(text) ||
           /\bUnit(?:s)?\s*[1-4]\b/i.test(text) ||
           /\bWACE\b/i.test(text) ||
           /\bSemester\s*[12]\b/i.test(text) ||
           /\b(?:Year|Yr|Y)\s*(?:11|12)\b/i.test(docText) ||
           /\bATAR\b/i.test(docText);
  }

  const cleanCourseName = title => window.ConnectifyUtils.normalize(
    String(title || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
  );

  // Cached task -> the { name, weight, pending, score, earned } shape taskProgress() expects
  function toAssessment(t) {
    const isPending = Boolean(t.pending || t.score === null || t.score === undefined);
    const scorePct = isPending ? undefined : Number(t.score);
    const weightVal = Number(t.weight) || 0;
    const earnedWeight = (!isPending && Number.isFinite(scorePct)) ? (scorePct / 100) * weightVal : 0;
    return { name: t.name, weight: weightVal, pending: isPending, score: scorePct, earned: earnedWeight };
  }

  const usableTask = t => t && t.name && (t.weight > 0 || !/^Assessment\s+\d+$/i.test(t.name));

  // The subject's cached tasks, limited to those one semester's outline listed when it was scraped
  function cachedTasks(subject, entry) {
    const { normalize } = window.ConnectifyUtils;
    const exact = window.ConnectifyCache?.subjectsCache?.get?.(subject);
    const all = exact ? Array.from(exact.values()) : (window.ConnectifyData?.getSubjectTasks?.(subject) || []);
    if (!entry?.tasks?.length) return all;
    const byId = new Map(all.map(t => [t.id, t]));
    const sameName = name => all.find(t => normalize(t.name).toLowerCase() === normalize(name).toLowerCase());
    const listed = [...new Set(entry.tasks.map(([id, name]) => byId.get(id) || sameName(name)).filter(Boolean))];
    return listed.length ? listed : all;
  }

  /**
   * [[Semester 1 courses], [Semester 2 courses]] from the centralized cache: the class registry
   * (class-semesters.js) for each semester's classes, overall marks and final letters, the subjects
   * cache for tasks and the grade cache for classes not on this page. Outline tiles are never read
   * here; collect() refreshes the cache first. "Show this semester's classes only" applies.
   */
  function readCourses(atarOnly = true) {
    const math = window.ConnectifyMath || {};
    const isAtarCourse = math.isAtarCourse || (t => /\bATAR\b/i.test(t));
    const scoreValue = math.scoreValue || (v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    });
    const taskProgress = math.taskProgress || (() => ({}));

    const result = [[], []];
    const seen = [new Set(), new Set()];

    try { window.ConnectifyData?.collect?.(true); } catch {}
    const registry = window.ConnectifyClassSemesters?.get?.() || {};

    for (const [subject, semesters] of Object.entries(registry)) {
      for (const semNumber of [1, 2]) {
        const entry = semesters?.[semNumber];
        if (!entry) continue;
        const title = entry.title || subject;
        if (atarOnly && !isAtarCourse(title)) continue;
        const name = cleanCourseName(title);
        const id = name.toLowerCase();
        const index = semNumber - 1;
        if (!name || seen[index].has(id)) continue;
        seen[index].add(id);

        const tasks = cachedTasks(subject, entry).filter(usableTask).map(toAssessment);
        let markValue = entry.mark !== null && entry.mark !== undefined ? scoreValue(entry.mark) : undefined;
        if (markValue === undefined && tasks.length > 0) {
          const completedTasks = tasks.filter(t => !t.pending && Number.isFinite(t.score) && t.weight > 0);
          const totalCompletedWeight = completedTasks.reduce((sum, t) => sum + t.weight, 0);
          if (totalCompletedWeight > 0) {
            markValue = (completedTasks.reduce((sum, t) => sum + (t.score / 100) * t.weight, 0) / totalCompletedWeight) * 100;
          }
        }

        result[index].push({
          id,
          name,
          mark: markValue,
          finalLetter: Boolean(entry.finalLetter),
          progress: taskProgress(tasks, markValue, semNumber)
        });
      }
    }

    // Ingest grade cache (e.g. connectify:grade_cache:current and connectify:grade_cache:<studentId>)
    try {
      const studentId = window.ConnectifyUtils.accountKey();
      const cacheKeys = [
        'connectify:grade_cache:current',
        `connectify:grade_cache:${studentId}`
      ];
      for (const k of cacheKeys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;

        for (const [subjName, entry] of Object.entries(parsed)) {
          if (!entry || typeof entry !== 'object') continue;
          if (atarOnly && !isAtarCourse(subjName)) continue;

          const semNumber = Number(entry.semester) === 1 ? 1 : 2;
          const semIdx = semNumber - 1;
          const cleanName = cleanCourseName(subjName);
          const id = cleanName.toLowerCase();

          if (seen[semIdx].has(id)) {
            // Complement mark if the registry lacked one
            const existing = result[semIdx].find(r => r.id === id);
            if (existing && existing.mark === undefined && Number.isFinite(entry.mark)) {
              existing.mark = entry.mark;
            }
            continue;
          }

          seen[semIdx].add(id);

          const markVal = Number.isFinite(entry.mark) ? entry.mark : undefined;
          const byName = window.ConnectifyData?.getSubjectTasks?.(subjName) || [];
          const cached = byName.length ? byName : (window.ConnectifyData?.getSubjectTasks?.(cleanName) || []);
          const tasks = cached.filter(usableTask).map(toAssessment);

          result[semIdx].push({
            id,
            name: cleanName,
            mark: markVal,
            finalLetter: false,
            progress: taskProgress(tasks, markVal, semNumber)
          });
        }
      }
    } catch (e) {
      console.warn('Connectify failed to ingest grade cache into courses:', e);
    }

    const filter = window.ConnectifySemesterFilter;
    return filter ? filter.filterCourses(result) : result;
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
