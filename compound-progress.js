/**
 * Connectify Compound Subject Progress Bars
 *
 * Visualizes multi-category weighted completion per subject card.
 * Each segment reflects individual assessment weights color-coded by category
 * (Exam, Test, Application, Essay, Take-Home, or custom overrides).
 * Semester 2 cards include Semester 1 assignments for full cumulative annual progress.
 */
(() => {
  'use strict';

  if (window.ConnectifyCompoundProgress) return;

  if (!document.getElementById('cx-compound-styles')) {
    const style = document.createElement('style');
    style.id = 'cx-compound-styles';
    style.textContent = `
      .cx-compound-progress-container {
        box-sizing: border-box !important;
        width: 100% !important;
        padding: 10px 20px 0 20px !important;
        margin: 0 !important;
      }
      .cx-compound-segment {
        transition: filter 0.2s;
        cursor: pointer;
      }
      .cx-compound-segment:hover {
        filter: brightness(1.3);
      }
      .cx-compound-bar {
        display: flex;
        height: 6px;
        border-radius: 3px;
        overflow: hidden;
        margin: 0 0 3px 0;
        border: 1px solid #cbd5e1;
        background: #e2e8f0;
        box-sizing: border-box;
        width: 100%;
      }
      .cx-compound-label {
        font-size: 11px;
        line-height: 1.25;
        color: #64748b;
        text-align: right;
        margin: 0;
        font-weight: 500;
      }
      .connectea-dark .cx-compound-bar {
        border-color: #475569 !important;
        background: #1e293b !important;
      }
      .connectea-dark .cx-compound-label {
        color: #94a3b8 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getEffectiveType(subjectName, task) {
    if (window.ConnectifyTaskTypes?.getEffectiveType) {
      return window.ConnectifyTaskTypes.getEffectiveType(subjectName, task);
    }
    return 'Take-Home';
  }

  function getCategoryColor(cat) {
    if (window.ConnectifyTaskTypes?.getCategoryColor) {
      return window.ConnectifyTaskTypes.getCategoryColor(cat);
    }
    const cats = window.cxCategories || {};
    if (cats[cat]?.color) return cats[cat].color;
    return '#999';
  }

  function updateCompoundBars() {
    if (!window.ConnectifyData?.collect) return;

    const subjects = window.ConnectifyData.collect(true);
    subjects.forEach(subject => {
      const matchingTitles = Array.from(document.querySelectorAll('.eds-c-tile__title')).filter(t => (t.textContent || '').includes(subject.name));
      matchingTitles.forEach(cardTitle => {
        const card = cardTitle.closest('.eds-c-tile');
        if (!card) return;

        const header = card.querySelector('.eds-c-tile__header');
        if (!header) return;

        const cardSemesterMatch = (cardTitle.textContent || '').match(/Semester\s*([12])/i);
        const cardSemester = cardSemesterMatch ? +cardSemesterMatch[1] : null;

        // For Semester 1 cards: include Semester 1 tasks.
        // For Semester 2 cards: include BOTH Semester 1 and Semester 2 tasks for full annual weighting.
        const sortedTasks = [...subject.tasks]
          .filter(t => {
            if (!t || t.weight <= 0) return false;
            if (!cardSemester) return true;
            if (cardSemester === 1) return t.semester === 1;
            if (cardSemester === 2) return t.semester === 1 || t.semester === 2;
            return true;
          })
          .sort((a, b) => ((a.semester || 1) - (b.semester || 1)) || ((a.sequence || 0) - (b.sequence || 0)));

        if (sortedTasks.length === 0) return;

        // Clean signature using primitives only to avoid circular references
        const taskSummary = sortedTasks.map(t => ({
          name: t.name,
          weight: t.weight,
          pending: t.pending,
          type: getEffectiveType(subject.name, t)
        }));

        const signature = JSON.stringify({
          card: cardTitle.textContent,
          semester: cardSemester,
          tasks: taskSummary
        });

        const existingContainer = card.querySelector('.cx-compound-progress-container');
        if (existingContainer) {
          if (existingContainer.dataset.signature === signature) {
            return; // Unchanged, avoid DOM churn
          }
          existingContainer.remove();
        }

        let totalWeight = 0;
        let overallCompleted = 0;
        let labelBreakdowns = {};

        sortedTasks.forEach(t => {
          totalWeight += t.weight;
          if (!t.pending) overallCompleted += t.weight;
          const cat = getEffectiveType(subject.name, t);
          if (!labelBreakdowns[cat]) labelBreakdowns[cat] = 0;
          labelBreakdowns[cat] += t.weight;
        });

        if (totalWeight <= 0) return;

        const bar = document.createElement('div');
        bar.className = 'cx-compound-bar';

        sortedTasks.forEach(t => {
          const cat = getEffectiveType(subject.name, t);
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
      });
    });
  }

  // Reactive updates without page reload
  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateCompoundBars, 150);
  }

  window.addEventListener('connectify-task-type-changed', scheduleUpdate);
  window.addEventListener('connectify-settings-updated', scheduleUpdate);
  window.addEventListener('storage', e => {
    if (e.key === 'connectea:task_type_overrides' || e.key?.startsWith('connectea:class_categories:')) {
      scheduleUpdate();
    }
  });

  const observer = new MutationObserver(records => {
    let shouldRun = false;
    for (const r of records) {
      if (r.target?.classList?.contains('cx-compound-progress-container') || r.target?.closest?.('.cx-compound-progress-container')) {
        continue;
      }
      if (r.addedNodes.length > 0 || r.removedNodes.length > 0) {
        shouldRun = true;
        break;
      }
    }
    if (shouldRun) scheduleUpdate();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  setInterval(updateCompoundBars, 1500);
  updateCompoundBars();

  window.ConnectifyCompoundProgress = {
    update: updateCompoundBars,
    scheduleUpdate
  };
})();
