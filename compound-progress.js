/**
 * Connectify Compound Subject Progress Bars
 *
 * Visualizes multi-category weighted completion per subject card.
 * Each segment reflects individual assessment weights color-coded by category
 * (Exam, Test, Application, Essay, Take-Home, or custom overrides).
 */
(() => {
  'use strict';

  if (window.ConnectifyCompoundProgress) return;

  if (!document.getElementById('cx-compound-styles')) {
    const style = document.createElement('style');
    style.id = 'cx-compound-styles';
    style.textContent = `
      .cx-compound-segment { transition: filter 0.2s; cursor: pointer; }
      .cx-compound-segment:hover { filter: brightness(1.5); }
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
      const matchingTitles = Array.from(document.querySelectorAll('.eds-c-tile__title')).filter(t => t.textContent.includes(subject.name));
      matchingTitles.forEach(cardTitle => {
        const card = cardTitle.closest('.eds-c-tile');
        if (!card) return;

        const header = card.querySelector('.eds-c-tile__header');
        if (!header) return;

        const cardSemesterMatch = cardTitle.textContent.match(/Semester\s*([12])/i);
        const cardSemester = cardSemesterMatch ? +cardSemesterMatch[1] : null;

        const sortedTasks = [...subject.tasks]
          .filter(t => t.weight > 0 && (!cardSemester || t.semester === cardSemester))
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

        if (sortedTasks.length === 0) return;

        const taskTypes = sortedTasks.map(t => getEffectiveType(subject.name, t));
        const signature = JSON.stringify({ tasks: subject.tasks, cats: window.cxCategories, types: taskTypes });

        if (header.nextElementSibling && header.nextElementSibling.classList.contains('cx-compound-progress-container')) {
          if (header.nextElementSibling.dataset.signature === signature) {
            return; // Unchanged, don't destroy DOM!
          }
          header.nextElementSibling.remove();
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
        bar.style.display = 'flex';
        bar.style.height = '6px';
        bar.style.borderRadius = '3px';
        bar.style.overflow = 'hidden';
        bar.style.margin = '8px 0 4px 0';
        bar.style.border = '1px solid #3a3a3a';

        sortedTasks.forEach(t => {
          const cat = getEffectiveType(subject.name, t);
          const isCompleted = !t.pending;

          const pct = (t.weight / totalWeight) * 100;
          const segment = document.createElement('div');
          segment.className = 'cx-compound-segment';
          segment.style.width = `${pct}%`;
          segment.style.backgroundColor = getCategoryColor(cat);
          if (!isCompleted) {
            segment.style.opacity = '0.25';
          }
          segment.style.borderRight = '1px solid #1e1e1e';
          segment.title = `${t.name} [${cat}]: ${t.weight}% (${isCompleted ? 'Completed' : 'Remaining'})`;
          bar.appendChild(segment);
        });

        const tooltipParts = [];
        for (const [cat, weight] of Object.entries(labelBreakdowns)) {
          tooltipParts.push(`${cat} ${Math.round((weight / totalWeight) * 100)}%`);
        }

        const label = document.createElement('div');
        label.style.fontSize = '10px';
        label.style.color = '#999';
        label.style.textAlign = 'right';
        label.textContent = `${tooltipParts.join(' • ')} | ${Math.round((overallCompleted / totalWeight) * 100)}% Done`;

        const container = document.createElement('div');
        container.className = 'cx-compound-progress-container';
        container.dataset.signature = signature;
        container.append(bar, label);

        header.insertAdjacentElement('afterend', container);
      });
    });
  }

  window.ConnectifyCompoundProgress = {
    update: updateCompoundBars
  };
})();
