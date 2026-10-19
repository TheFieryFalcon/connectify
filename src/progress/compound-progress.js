/**
 * Connectify Compound Subject Progress Bars
 *
 * A segmented bar under each subject card's header: one segment per weighted task, coloured by
 * assessment type and faded until marked. Semester 1 cards show Semester 1 tasks; Semester 2 cards show
 * the whole year once Semester 2 tasks exist. Styles: compound-progress.css.
 * Exposes window.ConnectifyCompoundProgress.
 */
(() => {
  'use strict';

  if (window.ConnectifyCompoundProgress) return;

  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const HEADER_SELECTOR = '.eds-c-tile__header, .cvr-c-tile__header, .c-tile__header, [class*="tile__header"], [class*="card-header"]';
  const { normalize } = window.ConnectifyUtils;

  const getEffectiveType = (subjectName, task) => window.ConnectifyTaskTypes?.getEffectiveType?.(subjectName, task) || 'Take-Home';

  function getCategoryColor(cat) {
    if (window.ConnectifyTaskTypes?.getCategoryColor) return window.ConnectifyTaskTypes.getCategoryColor(cat);
    return window.cxCategories?.[cat]?.color || '#999';
  }

  function cleanSubject(subjectName) {
    return (subjectName || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * The subject a card shows: the same cleaned name, else the card title naming the subject in full, else
   * the closest partial match. Picking one subject per card stops "Biology" and "Human Biology" (or
   * "English" and "English Literature") from redrawing each other's bars.
   */
  function subjectForCard(titleText, subjects) {
    const tNorm = cleanSubject(titleText).toLowerCase();
    let best = null;
    let bestScore = -1;
    for (const s of subjects) {
      const sNorm = cleanSubject(s.name).toLowerCase();
      const score = sNorm === tNorm ? 3e6
        : titleText.includes(s.name) ? 2e6 + s.name.length
        : sNorm && tNorm.includes(sNorm) ? 1e6 + sNorm.length
        : tNorm && sNorm.includes(tNorm) ? 1e6 - sNorm.length
        : -1;
      if (score > bestScore) {
        best = s;
        bestScore = score;
      }
    }
    return best;
  }

  /** The card's weighted tasks in chronological order, limited to the card's semester. */
  function cardTasks(subject, cardSemester) {
    const hasSem2Tasks = subject.tasks.some(
      t => t.semester === 2 || (t.caption && /Term\s*[34]/i.test(t.caption)) || (t.order !== null && t.order >= (window.ConnectifyParseHelpers?.SEMESTER_TWO_ORDER || 19))
    );

    // Semester 1 cards display only Semester 1 tasks.
    // Semester 2 cards encapsulate tasks of BOTH semesters for cumulative annual progress,
    // motivating students by visualizing full progress to date.
    const isSem1Task = t => {
      if (t.semester === 2) return false;
      if (t.semester === 1) return true;
      if (t.caption && /Term\s*[34]/i.test(t.caption)) return false;
      if (t.caption && /Term\s*[12]/i.test(t.caption)) return true;
      return (t.semester || 1) === 1;
    };

    return [...subject.tasks]
      .filter(t => {
        if (!t || !Number.isFinite(t.weight) || t.weight <= 0) return false;
        if (cardSemester === 1) return isSem1Task(t);
        if (cardSemester === 2) {
          if (!hasSem2Tasks) return false;
          return t.semester === 1 || t.semester === 2;
        }
        return true;
      })
      .sort((a, b) => {
        const semDiff = (a.semester || 1) - (b.semester || 1);
        if (semDiff !== 0) return semDiff;
        const oA = Number.isFinite(a.order) ? a.order : null;
        const oB = Number.isFinite(b.order) ? b.order : null;
        if (oA !== null && oB !== null && oA !== oB) return oA - oB;
        return (a.sequence || 0) - (b.sequence || 0);
      });
  }

  function renderCard(card, cardTitle, subject) {
    const header = card.querySelector(HEADER_SELECTOR) || cardTitle.parentElement;
    if (!header) return;
    const normTitle = normalize(cardTitle.textContent || '');
    const cardSemesterMatch = normTitle.match(/\bSemester\s*([12])\b/i) || normTitle.match(/\bSem\s*([12])\b/i);
    const cardSemester = cardSemesterMatch ? +cardSemesterMatch[1] : null;
    const sortedTasks = cardTasks(subject, cardSemester);

    const existingContainer = card.querySelector('.cx-compound-progress-container');
    if (sortedTasks.length === 0) {
      if (existingContainer) existingContainer.remove();
      return;
    }

    // Each task's type is looked up once; the signature (primitives only) skips unchanged cards
    const typed = sortedTasks.map(t => ({ task: t, type: getEffectiveType(subject.name, t) }));
    const signature = JSON.stringify({
      card: cardTitle.textContent,
      semester: cardSemester,
      tasks: typed.map(({ task, type }) => ({ name: task.name, weight: task.weight, pending: task.pending, type }))
    });
    if (existingContainer) {
      if (existingContainer.dataset.signature === signature) return;
      existingContainer.remove();
    }

    let totalWeight = 0;
    let overallCompleted = 0;
    const labelBreakdowns = {};

    typed.forEach(({ task: t, type: cat }) => {
      if (!Number.isFinite(t.weight) || t.weight <= 0) return;
      totalWeight += t.weight;
      if (!t.pending) overallCompleted += t.weight;
      labelBreakdowns[cat] = (labelBreakdowns[cat] || 0) + t.weight;
    });

    if (!Number.isFinite(totalWeight) || totalWeight <= 0) return;

    const bar = document.createElement('div');
    bar.className = 'cx-compound-bar';

    typed.forEach(({ task: t, type: cat }) => {
      const isCompleted = !t.pending;

      const pct = (t.weight / totalWeight) * 100;
      const segment = document.createElement('div');
      segment.className = 'cx-compound-segment';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = getCategoryColor(cat);
      if (!isCompleted) {
        segment.style.opacity = '0.3';
      }
      segment.style.borderRight = '1px solid rgba(0, 0, 0, 0.15)';
      const semTag = t.semester ? `Sem ${t.semester} · ` : '';
      segment.title = `${semTag}${t.name} [${cat}]: ${t.weight}% (${isCompleted ? 'Completed' : 'Remaining'})`;
      bar.appendChild(segment);
    });

    const tooltipParts = [];
    for (const [cat, weight] of Object.entries(labelBreakdowns)) {
      tooltipParts.push(`${cat} ${Math.round((weight / totalWeight) * 100)}%`);
    }

    const label = document.createElement('div');
    label.className = 'cx-compound-label';
    label.textContent = `${tooltipParts.join(' • ')} | ${Math.round((overallCompleted / totalWeight) * 100)}% Done`;

    const container = document.createElement('div');
    container.className = 'cx-compound-progress-container';
    container.dataset.signature = signature;
    container.append(bar, label);

    header.insertAdjacentElement('afterend', container);
  }

  function updateCompoundBars() {
    if (!window.ConnectifyData?.collect) return;
    const subjects = window.ConnectifyData.collect(true);
    if (!subjects.length) return;
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      const cardTitle = card.querySelector(TITLE_SELECTOR);
      // Only the card that directly owns the title (never an outer wrapper)
      if (!cardTitle || cardTitle.closest(CARD_SELECTOR) !== card) continue;
      const subject = subjectForCard(normalize(cardTitle.textContent), subjects);
      if (subject) renderCard(card, cardTitle, subject);
    }
  }

  // Reactive updates without page reload
  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) {
      updateTimer = setTimeout(scheduleUpdate, 200);
      return;
    }
    updateTimer = setTimeout(updateCompoundBars, 150);
  }

  window.addEventListener('connectify-task-type-changed', scheduleUpdate);
  window.addEventListener('connectify-settings-updated', scheduleUpdate);
  window.addEventListener('connectify-results-updated', scheduleUpdate);
  window.addEventListener('storage', e => {
    if (e.key === 'connectea:task_type_overrides' || e.key?.startsWith('connectea:class_categories:')) {
      scheduleUpdate();
    }
  });

  // Subject tiles added outside accordion panels (task rows inside panels are left to the events above)
  const addsTiles = r => {
    if (r.type !== 'childList') return false;
    if (r.target?.classList?.contains('cx-compound-progress-container') || r.target?.closest?.('.cx-compound-progress-container')) return false;
    if (r.target?.closest?.('.eds-c-accordion__panel, .cvr-c-accordion__panel, .eds-c-accordion, .cvr-c-accordion')) return false;
    return Array.prototype.some.call(r.addedNodes, node => node.nodeType === 1 &&
      (node.matches?.('.eds-c-tile, .cvr-c-tile') || node.querySelector?.('.eds-c-tile, .cvr-c-tile')));
  };
  const scheduler = window.ConnectifyScheduler;
  scheduler.onMutations(scheduleUpdate, { filter: addsTiles, mute: true });
  scheduler.every(2500, updateCompoundBars, { mute: true });
  updateCompoundBars();

  window.ConnectifyCompoundProgress = {
    update: updateCompoundBars,
    scheduleUpdate,
    subjectForCard
  };
})();
