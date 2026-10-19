/**
 * Connectify Cohort: outcome meter evaluation for a task row
 *
 * Builds the predictor's view of a marked task row (semester, position in the card, school week and
 * weight), hides the meter on a subject's first marked result without a baseline, and evaluates the mark
 * against the cached or freshly computed prediction. Unmarked rows get their prediction pre-cached.
 * Exposes window.ConnectifyCohortOutcomeEval.
 */
(() => {
  'use strict';

  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const { normalize, customWeekOrder, readTimeOverride } = window.ConnectifyUtils;

  /** The card's task rows, memoised on the card and re-queried once a row is missing. */
  function cardTaskRows(card, row) {
    if (card._cxTaskRows && card._cxTaskRows.includes(row)) return card._cxTaskRows;
    const insideTasks = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
    card._cxTaskRows = insideTasks.length > 0 ? Array.from(insideTasks) : Array.from(card.querySelectorAll('.cvr-c-task'));
    return card._cxTaskRows;
  }

  function rowWeight(row) {
    const text = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1]?.textContent?.trim() || '';
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/i) || text.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : 10;
  }

  /** The marked task as the predictor sees it. */
  function taskFromRow(row, meta, mark) {
    const card = row.closest(CARD_SELECTOR);
    const cardTitle = normalize(card?.querySelector(TITLE_SELECTOR)?.textContent);
    const semMatch = cardTitle.match(/Semester\s*([12])/i);
    const id = meta.labelsKey ? `${meta.labelsKey}:0` : undefined;
    const caption = meta.labels?.[1] || '';
    // A week typed in the Progress Graph wins over the week in the caption
    const overrideOrder = customWeekOrder(readTimeOverride([meta.subjectName, cardTitle], [id, meta.taskName]));
    // A Semester 1 task listed on a Semester 2 panel is still a Semester 1 task
    const cardSemester = semMatch ? Number(semMatch[1]) : 1;
    const taskSemester = window.ConnectifyParseHelpers?.taskSemester;
    return {
      id,
      name: meta.taskName,
      caption,
      labelsKey: meta.labelsKey,
      row,
      score: mark,
      mark,
      pending: false,
      semester: taskSemester ? taskSemester(cardSemester, caption, overrideOrder) : cardSemester,
      sequence: card ? Math.max(0, cardTaskRows(card, row).indexOf(row)) : 0,
      order: overrideOrder ?? window.ConnectifyData?.orderHint?.(caption) ?? null,
      weight: rowWeight(row)
    };
  }

  const hasMark = row => Number.isFinite(window.ConnectifyCohortRows?.readMark?.(row));
  const isFiniteBaseline = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));

  /**
   * Whether the subject has a marked result before this one: an earlier marked row in this card, or for
   * a Semester 2 task a marked Semester 1 task (collected results first, then a Semester 1 card on the page).
   * A Semester 1 task listed on a Semester 2 panel is a Semester 1 task (taskSemester), so only rows above
   * it count. Unmarked and pending rows don't count, so the first marked assessment of a class has no precedent.
   */
  function hasPriorMarkedWork(task, row, meta, subjects, predMath) {
    const card = row.closest(CARD_SELECTOR);
    if (card && cardTaskRows(card, row).slice(0, task.sequence).some(hasMark)) return true;
    if (task.semester <= 1) return false;
    const clean = name => (predMath.cleanSubject ? predMath.cleanSubject(name) : normalize(name).replace(/\s*[-–—]\s*(Semester|Sem)\s*[12].*$/i, ''));
    const subjectKey = clean(meta.subjectName);
    const subject = (subjects || []).find(s => s.name === meta.subjectName || clean(s.name) === subjectKey);
    if (subject?.tasks?.some(t => !t.pending && Number.isFinite(t.score) && (t.semester || 1) < task.semester)) return true;
    for (const other of document.querySelectorAll(CARD_SELECTOR)) {
      if (other === card) continue;
      const title = normalize(other.querySelector(TITLE_SELECTOR)?.textContent);
      if (!/Semester\s*1\b/i.test(title) || clean(title) !== subjectKey) continue;
      if (Array.from(other.querySelectorAll('.cvr-c-tasks .cvr-c-task')).some(hasMark)) return true;
    }
    return false;
  }

  /** The outcome for a marked row, or null when the meter stays hidden. */
  function evaluateRow(row, mark, meta, precollectedSubjects) {
    const predMath = window.ConnectifyPredictorMath;
    if (!predMath || !Number.isFinite(mark)) return null;
    const task = taskFromRow(row, meta, mark);
    const cleanSubj = predMath.cleanSubject ? predMath.cleanSubject(meta.subjectName) : meta.subjectName;
    const baselines = predMath.getBaselines ? predMath.getBaselines() : { subjects: {}, types: {} };
    const hasSubjectBaseline = isFiniteBaseline(baselines?.subjects?.[cleanSubj]) || isFiniteBaseline(baselines?.subjects?.[meta.subjectName]);

    // The first marked assessment of a class has nothing to be measured against unless a baseline is set
    const hasPriorSubjectData = hasPriorMarkedWork(task, row, meta, precollectedSubjects, predMath);
    const isFirstOfSubject = !hasPriorSubjectData && !hasSubjectBaseline;
    if (isFirstOfSubject) return null;

    let prediction = predMath.getCachedPrediction
      ? (predMath.getCachedPrediction(meta.subjectName, task.id) ||
         predMath.getCachedPrediction(meta.subjectName, meta.labelsKey) ||
         predMath.getCachedPrediction(meta.subjectName, meta.taskName))
      : null;
    if (!prediction || prediction.unpredicted) {
      const allSubjects = precollectedSubjects || (window.ConnectifyData?.hasCachedSubjects?.() ? window.ConnectifyData.collect(true) : []);
      prediction = predMath.getOrComputeTaskPrediction
        ? predMath.getOrComputeTaskPrediction(meta.subjectName, task, allSubjects)
        : predMath.predictTask(meta.subjectName, task, null, baselines, true);
    }
    if (!prediction || prediction.unpredicted) return null;
    return predMath.evaluateOutcome(mark, prediction);
  }

  /** Unmarked rows: makes sure the upcoming task has a cached prediction. */
  function precacheUpcoming(row, meta, precollectedSubjects) {
    const predMath = window.ConnectifyPredictorMath;
    if (!predMath) return;
    try {
      const cached = predMath.getCachedPrediction?.(meta.subjectName, meta.labelsKey) ||
                     predMath.getCachedPrediction?.(meta.subjectName, meta.taskName);
      if (cached) return;
      const task = { id: meta.labelsKey ? `${meta.labelsKey}:0` : undefined, name: meta.taskName, caption: meta.labels?.[1] || '', labelsKey: meta.labelsKey, row };
      if (predMath.getOrComputeTaskPrediction) {
        predMath.getOrComputeTaskPrediction(meta.subjectName, task, precollectedSubjects);
      } else {
        const pred = predMath.predictTask(meta.subjectName, task);
        if (!pred.unpredicted) predMath.cachePrediction(meta.subjectName, meta.labelsKey || meta.taskName, pred);
      }
    } catch {}
  }

  window.ConnectifyCohortOutcomeEval = { taskFromRow, evaluateRow, precacheUpcoming, cardTaskRows };
})();
