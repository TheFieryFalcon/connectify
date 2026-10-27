/**
 * Connectify Weakness Radar Analyzer
 *
 * The Weaknesses panel: performance per assessment type or per subject over completed tasks,
 * drawn as a radar chart (weakness-radar-view.js), with per-subject include checkboxes.
 * Provides `window.ConnectifyWeakness`.
 */
(() => {
  'use strict';

  if (window.ConnectifyWeakness) return;

  let disabledWeaknessSubjects = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(window.ConnectifyUtils.userKey('connectify:weakness_disabled_subjects')) || '[]');
    if (Array.isArray(stored)) disabledWeaknessSubjects = new Set(stored);
  } catch (e) {}

  const saveDisabledSubjects = () => {
    try {
      localStorage.setItem(window.ConnectifyUtils.userKey('connectify:weakness_disabled_subjects'), JSON.stringify([...disabledWeaknessSubjects]));
    } catch (e) {}
  };

  const cleanSubjectName = name => {
    if (!name) return '';
    return name
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getEffectiveTaskType = (subjectName, task) => window.ConnectifyTaskTypes?.getEffectiveType?.(subjectName, task) || 'Take-Home';

  const view = () => window.ConnectifyWeaknessView;

  /** Cleaned subject name -> raw name, for the subjects collected from the outlines. */
  function subjectList(collected) {
    const subjects = new Map();
    collected.forEach(s => {
      const clean = cleanSubjectName(s.name) || s.name;
      if (clean && !subjects.has(clean)) {
        subjects.set(clean, s.name);
      }
    });
    return subjects;
  }

  // The classes "Show this semester's classes only" keeps, from the centralized cache
  const collectClasses = () => (window.ConnectifyData?.collectClasses || window.ConnectifyData?.collect || (() => []))(true);
  const getSubjectList = () => subjectList(collectClasses());

  let currentChart = null;

  function destroyChart() {
    if (currentChart && currentChart.destroy) {
      try { currentChart.destroy(); } catch (e) {}
    }
    currentChart = null;
    document.dispatchEvent(new CustomEvent('connectify-destroy-radar'));
  }

  function renderChart() {
    const chartDiv = document.getElementById('connectify-radar-chart');
    if (!chartDiv) return;
    // Opening the analyzer renders it, so a hidden panel is left alone
    if (chartDiv.closest?.('#connectify-weakness')?.hidden) return;

    const collected = collectClasses();
    const subjectMap = subjectList(collected);
    const isDisabled = (cleanName, rawName) => disabledWeaknessSubjects.has(cleanName) || (rawName && disabledWeaknessSubjects.has(rawName));
    const selectedCount = [...subjectMap].filter(([cleanName, rawName]) => !isDisabled(cleanName, rawName)).length;

    const show = html => {
      destroyChart();
      chartDiv.innerHTML = html;
    };
    if (subjectMap.size === 0) return show(view().message('No subjects detected yet. Expand course outlines in Connect to load subjects.'));
    if (selectedCount === 0) return show(view().message('All subjects deselected. Please check at least 3 subjects below to view radar analytics.'));

    // Weighted average per assessment type (or per subject) over completed tasks
    const perf = {};
    const mode = document.getElementById('cx-radar-mode')?.value || 'type';
    for (const subject of collected) {
      const cleaned = cleanSubjectName(subject.name) || subject.name;
      if (isDisabled(cleaned, subject.name)) continue;
      for (const t of subject.tasks) {
        if (!(t.weight > 0) || t.pending || t.score === null) continue;
        const label = mode === 'subject' ? cleaned : getEffectiveTaskType(subject.name, t);
        if (!perf[label]) perf[label] = { earned: 0, total: 0 };
        perf[label].earned += (t.score / 100) * t.weight;
        perf[label].total += t.weight;
      }
    }
    const labels = Object.keys(perf);
    const data = labels.map(label => (perf[label].total > 0 ? Math.round((perf[label].earned / perf[label].total) * 100) : 0));

    if (labels.length === 0) return show(view().message('No completed assessments to plot for the selected subjects.'));
    if (labels.length < 3) {
      const entityType = mode === 'type' ? 'assessment types' : 'subjects';
      return show(view().warning(`At least 3 ${entityType} must have graded tasks for radar charts!`));
    }

    chartDiv.innerHTML = view().radarSvg(labels, data);
  }

  function updateCheckboxes(panel) {
    const boxContainer = panel.querySelector('#cx-weakness-checkboxes');
    if (!boxContainer) return;
    boxContainer.innerHTML = '';
    const subjectMap = getSubjectList();

    subjectMap.forEach((rawName, cleanName) => {
      const label = document.createElement('label');
      label.className = 'cx-weakness-checkbox-label';
      label.title = cleanName;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const isOff = disabledWeaknessSubjects.has(cleanName) || disabledWeaknessSubjects.has(rawName);
      cb.checked = !isOff;

      cb.onchange = () => {
        if (cb.checked) {
          disabledWeaknessSubjects.delete(cleanName);
          disabledWeaknessSubjects.delete(rawName);
        } else {
          disabledWeaknessSubjects.add(cleanName);
        }
        saveDisabledSubjects();
        renderChart();
      };

      const textSpan = document.createElement('span');
      textSpan.textContent = cleanName;

      label.appendChild(cb);
      label.appendChild(textSpan);
      boxContainer.appendChild(label);
    });
  }

  function createWeaknessPanel() {
    if (window.ConnectifyWeakness?.panelRefs) {
      return window.ConnectifyWeakness.panelRefs;
    }
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Weakness Analyzer';
    toggleBtn.type = 'button';
    toggleBtn.id = 'connectify-weakness-toggle';

    const panel = document.createElement('section');
    panel.id = 'connectify-weakness';
    panel.hidden = true;
    panel.className = 'cx-workspace-panel';
    panel.innerHTML = view().PANEL_HTML;

    const expandAllBtn = panel.querySelector('#cx-weakness-expand-all');
    if (expandAllBtn) {
      expandAllBtn.onclick = () => {
        if (window.ConnectifyData?.expandAll) {
          window.ConnectifyData.expandAll(true);
        }
      };
    }

    panel.querySelector('#cx-radar-mode').onchange = renderChart;
    panel.querySelector('#cx-weakness-all').onclick = () => {
      disabledWeaknessSubjects.clear();
      saveDisabledSubjects();
      updateCheckboxes(panel);
      renderChart();
    };
    panel.querySelector('#cx-weakness-none').onclick = () => {
      const subjectMap = getSubjectList();
      subjectMap.forEach((rawName, cleanName) => {
        disabledWeaknessSubjects.add(cleanName);
      });
      saveDisabledSubjects();
      updateCheckboxes(panel);
      renderChart();
    };

    function openWeakness() {
      panel.hidden = false;
      toggleBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'weakness' }));
      updateCheckboxes(panel);
      setTimeout(renderChart, 50);
    }

    function closeWeakness() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-pressed', 'false');
      destroyChart();
    }

    toggleBtn.onclick = e => {
      if (e) e.stopPropagation();
      if (panel.hidden) {
        openWeakness();
      } else {
        closeWeakness();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'weakness') {
        closeWeakness();
      }
    });
    // Everything comes from the cache, so an open analyzer redraws when a type or a cached result changes
    const refreshOpen = () => { if (!panel.hidden) { updateCheckboxes(panel); renderChart(); } };
    window.addEventListener('connectify-task-type-changed', refreshOpen);
    window.addEventListener('connectify-results-updated', refreshOpen);

    const refs = {
      toggleBtn,
      panel,
      openWeakness,
      closeWeakness,
      renderChart,
      updateCheckboxes: () => updateCheckboxes(panel),
      destroyChart
    };
    window.ConnectifyWeakness.panelRefs = refs;
    return refs;
  }

  const ensureWeaknessPanel = () => window.ConnectifyWeakness.panelRefs || createWeaknessPanel();

  window.ConnectifyWeakness = {
    createWeaknessPanel,
    ensureWeaknessPanel,
    renderChart,
    destroyChart,
    panelRefs: null
  };

  // Pre-initialize so buttons and panels are ready for sidebar mounting
  try {
    ensureWeaknessPanel();
  } catch {}
})();
