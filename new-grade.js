/**
 * Connectify New Grade Notification Engine
 *
 * Tracks running subject averages against a persistent local cache.
 * When a subject grade update is detected:
 * 1. Automatically expands the subject card (especially when global auto-expand is off).
 * 2. Emits an actionable toast notification via `window.ConnectifyNotifications`.
 * 3. Provides a "Jump to Subject" action that smoothly scrolls to the card and pulses an outline.
 * 4. Stacks notifications vertically when multiple grades update concurrently.
 */
(() => {
  'use strict';

  if (window.ConnectifyNewGrade) return;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  function getStudentId() {
    try {
      return new URL(location.href).searchParams.get('coisp') || 'current';
    } catch {
      return 'current';
    }
  }

  function getCacheKey() {
    return `connectify:grade_cache:${getStudentId()}`;
  }

  function loadCachedGrades() {
    try {
      const raw = localStorage.getItem(getCacheKey());
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('Connectify failed to load grade cache:', err);
    }
    return null;
  }

  function saveCachedGrades(cache) {
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(cache));
    } catch (err) {
      console.warn('Connectify failed to save grade cache:', err);
    }
  }

  /**
   * Reads raw score percentage from task row (supports % and X Out of Y).
   */
  function readSubjectMark(row) {
    if (!row) return undefined;
    if (window.ConnectifyCohortView?.readMark) {
      const m = window.ConnectifyCohortView.readMark(row);
      if (Number.isFinite(m)) return m;
    }

    const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark') || row.querySelector('.cvr-c-task__mark');
    const text = normalize(cell?.textContent);

    let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (match) return Number(match[1]);

    match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    if (match && Number(match[2]) > 0) return (100 * Number(match[1])) / Number(match[2]);

    match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (match) return Number(match[1]);

    return undefined;
  }

  /**
   * Expands an individual subject tile card if collapsed.
   */
  function expandSubjectCard(card) {
    if (!card) return;
    const heading = card.querySelector('.eds-c-accordion__section-heading');
    if (heading && /show details/i.test(heading.textContent)) {
      const btn = heading.querySelector('button, .v-button, [role="button"]');
      if (btn) btn.click();
    }
  }

  /**
   * Smoothly scrolls to a subject card and plays a visual pulse highlight.
   */
  function jumpToSubject(card) {
    if (!card) return;
    expandSubjectCard(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    card.classList.remove('cx-card-jump-highlight');
    // Force DOM reflow to restart CSS keyframe animation
    void card.offsetWidth;
    card.classList.add('cx-card-jump-highlight');

    setTimeout(() => {
      card.classList.remove('cx-card-jump-highlight');
    }, 2200);
  }

  /**
   * Scans all subject cards in the DOM, compares running averages against cache,
   * emits notifications for any changes, auto-expands the changed cards,
   * and updates the grade cache.
   */
  function checkGrades() {
    if (!document.body) return;

    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(
      c => c.querySelector('.eds-c-tile__title')
    );
    if (!cards.length) return;

    let cache = loadCachedGrades();
    const isFirstRun = cache === null;
    if (isFirstRun) {
      cache = {};
    }

    const currentEntries = [];

    for (const card of cards) {
      const rawTitle = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      if (!rawTitle) continue;

      const subjectName = rawTitle
        .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
        .replace(/\bATAR\b/gi, '')
        .replace(/\bYear\s*\d+\b/gi, '')
        .trim() || rawTitle;

      const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(
        row => !row.closest('.cvr-c-tasks')
      );
      const mark = readSubjectMark(summaryRow);

      if (Number.isFinite(mark)) {
        currentEntries.push({
          card,
          rawTitle,
          subjectName,
          mark: Math.round(mark * 100) / 100
        });
      }
    }

    if (!currentEntries.length) return;

    if (isFirstRun) {
      // Seed cache on initial run without alerting
      for (const entry of currentEntries) {
        cache[entry.subjectName] = {
          mark: entry.mark,
          updatedAt: Date.now()
        };
      }
      saveCachedGrades(cache);
      return;
    }

    let cacheChanged = false;

    for (const entry of currentEntries) {
      const prev = cache[entry.subjectName];

      if (prev && Number.isFinite(prev.mark)) {
        const delta = Math.round((entry.mark - prev.mark) * 100) / 100;

        if (Math.abs(delta) >= 0.05) {
          cacheChanged = true;
          cache[entry.subjectName] = {
            mark: entry.mark,
            updatedAt: Date.now()
          };

          // 1. Auto expand this subject card
          expandSubjectCard(entry.card);

          // 2. Dispatch stacked notification
          const deltaSign = delta > 0 ? '+' : '';
          const deltaStr = `${deltaSign}${delta.toFixed(1)}%`;
          const currentMarkStr = `${entry.mark.toFixed(1)}%`;

          if (window.ConnectifyNotifications?.show) {
            window.ConnectifyNotifications.show({
              id: `connectify-grade-${entry.subjectName.replace(/\s+/g, '-').toLowerCase()}`,
              type: 'grade',
              title: `Grade Update: ${entry.subjectName}`,
              message: `Subject running average updated to ${currentMarkStr} (${deltaStr}).`,
              duration: 12000,
              dismissible: true,
              actions: [
                {
                  text: `Jump to ${entry.subjectName.length > 18 ? 'Subject' : entry.subjectName}`,
                  type: 'accent',
                  onClick: () => {
                    jumpToSubject(entry.card);
                  }
                }
              ]
            });
          }
        }
      } else {
        // Newly appeared subject
        cache[entry.subjectName] = {
          mark: entry.mark,
          updatedAt: Date.now()
        };
        cacheChanged = true;
      }
    }

    if (cacheChanged) {
      saveCachedGrades(cache);
    }
  }

  // Initial checks
  setTimeout(checkGrades, 1500);
  setTimeout(checkGrades, 4000);

  // Re-check periodically when active
  setInterval(() => {
    if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
    checkGrades();
  }, 10000);

  // Listen to hash / navigation / settings events
  window.addEventListener('hashchange', () => setTimeout(checkGrades, 1000));
  window.addEventListener('popstate', () => setTimeout(checkGrades, 1000));
  window.addEventListener('connectify-settings-updated', () => setTimeout(checkGrades, 500));

  window.ConnectifyNewGrade = {
    checkGrades,
    getCachedGrades: loadCachedGrades,
    setCachedGrade: (subjectName, mark) => {
      const c = loadCachedGrades() || {};
      c[subjectName] = { mark: Number(mark), updatedAt: Date.now() };
      saveCachedGrades(c);
    },
    clearGradeCache: () => {
      try {
        localStorage.removeItem(getCacheKey());
      } catch {}
    },
    jumpToSubject,
    expandSubjectCard
  };
})();
