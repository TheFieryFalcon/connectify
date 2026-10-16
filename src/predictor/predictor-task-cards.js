/**
 * Connectify Predictor: upcoming task cards
 *
 * The "Upcoming Assessments" list for a subject: one card per weighted task with its category badge
 * and low / middle / high predictions, or the cold-start notice when it cannot be predicted yet.
 * Exposes window.ConnectifyPredictorTaskCards.
 */
(() => {
  'use strict';

  const esc = (...args) => window.ConnectifyUtils.escapeHtml(...args);

  function taskDateLabel(task) {
    const progressMath = window.ConnectifyProgressMath;
    return task?.customDate || task?.dateDisplay ||
      (progressMath?.formatTimestamp && Number.isFinite(task?.order) ? progressMath.formatTimestamp(task.order, task.caption) : task?.caption) || '';
  }

  /** Returns the upcoming assessments section for a projected subject. */
  function renderUpcoming(activeSubject) {
  const upcomingContainer = document.createElement('div');
  upcomingContainer.className = 'cx-pred-upcoming-container';

  const upcomingTitle = document.createElement('strong');
  upcomingTitle.style.display = 'block';
  upcomingTitle.style.fontSize = '13px';
  upcomingTitle.style.fontWeight = '650';
  upcomingTitle.style.marginBottom = '10px';

  const validUpcoming = (activeSubject.upcomingPredictions || []).filter(({ task }) => {
    return task && task.weight > 0 && Number.isFinite(task.weight);
  });
  upcomingTitle.textContent = `Upcoming Assessments (${validUpcoming.length})`;

  upcomingContainer.append(upcomingTitle);

  if (validUpcoming.length === 0) {
    const doneNote = document.createElement('div');
    doneNote.className = 'cx-pred-card';
    doneNote.style.textAlign = 'center';
    doneNote.style.padding = '18px';
    doneNote.style.fontSize = '12px';
    doneNote.textContent = 'All scheduled assessments for this subject have been graded!';
    upcomingContainer.append(doneNote);
  } else {
    validUpcoming.forEach(({ task, prediction }) => {
      const pred = prediction || {};
      const taskCard = document.createElement('div');
      taskCard.className = 'cx-pred-task-card';

      const taskType = pred.taskType || pred.type || 'Take-Home';
      const typeColor = window.ConnectifyTaskTypes?.getCategoryColor
        ? window.ConnectifyTaskTypes.getCategoryColor(taskType)
        : '#3498db';
      const isLightType = typeColor.toLowerCase() === '#f1c40f' || typeColor.toLowerCase() === '#f39c12' || typeColor.toLowerCase() === '#2ecc71';
      const typeTextColor = isLightType ? '#111827' : '#ffffff';

      const taskHeader = document.createElement('div');
      taskHeader.style.display = 'flex';
      taskHeader.style.justifyContent = 'space-between';
      taskHeader.style.alignItems = 'center';
      taskHeader.style.marginBottom = '8px';

      taskHeader.innerHTML = `
        <div>
          <strong style="font-size:13px; font-weight:650;">${esc(task?.name || 'Assessment')}</strong>
          <div style="font-size:11px; opacity:0.75; margin-top:1px;">
            ${esc(taskDateLabel(task))} • Weight: ${Number.isFinite(task?.weight) ? task.weight + '%' : '—'}
          </div>
        </div>
        <span class="cx-pred-task-type-badge" data-cat="${esc(taskType)}" style="font-size:10.5px; font-weight:700; color:${typeTextColor}; background:${typeColor}; padding:2.5px 8px; border-radius:10px;">
          ${esc(taskType)}
        </span>
      `;

      taskCard.append(taskHeader);

      if (pred.unpredicted) {
        const notice = document.createElement('div');
        notice.className = 'cx-pred-unpredicted-notice';
        notice.innerHTML = `
          <strong>No previous tasks of this type have been done, unable to make prediction</strong>
          <div style="font-size:10.5px; opacity:0.9; margin-top:3px;">
            Tip: Enter your previous year average for "${esc(taskType)}" in Settings to predict this task.
          </div>
        `;
        taskCard.append(notice);
      } else {
        const predRow = document.createElement('div');
        predRow.style.display = 'grid';
        predRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
        predRow.style.gap = '8px';

        predRow.innerHTML = `
          <div class="cx-pred-pill cx-pred-pill--low">
            <span style="font-size:9.5px; opacity:0.75; display:block; text-transform:uppercase;">Low</span>
            <strong style="font-size:13.5px;">${pred.low ?? '—'}%</strong>
          </div>
          <div class="cx-pred-pill cx-pred-pill--mid">
            <span style="font-size:9.5px; font-weight:700; display:block; text-transform:uppercase;">Middle</span>
            <strong style="font-size:14px;">${pred.mid ?? '—'}%</strong>
          </div>
          <div class="cx-pred-pill cx-pred-pill--high">
            <span style="font-size:9.5px; font-weight:700; display:block; text-transform:uppercase;">High</span>
            <strong style="font-size:13.5px;">${pred.high ?? '—'}%</strong>
          </div>
        `;

        taskCard.append(predRow);
      }

      upcomingContainer.append(taskCard);
    });
  }
    return upcomingContainer;
  }

  window.ConnectifyPredictorTaskCards = { renderUpcoming };
})();
