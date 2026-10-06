/**
 * Connectify Grade Predictor View
 *
 * Renders the Grade Predictor sub-tabs, projected mark cards,
 * and upcoming assessment task pills.
 * Exposes window.ConnectifyPredictorGradeView.
 */
(() => {
  'use strict';

  try {
    let lastSavedSubTabsScroll = 0;

    function renderGradePredictor(container, subjects, activeSubjectIndex, onSelectSubject, onRenderPanel) {
      if (!container) return;
      if (subjects.length === 0) {
        container.innerHTML = `
          <div class="cx-pred-card" style="text-align:center; padding:30px 16px;">
            <p class="cx-pred-hint" style="margin:0 0 14px 0; font-size:12.5px; line-height:1.5;">
              No enrolled subjects detected yet. Please expand your subject outlines on Connect to load course data.
            </p>
            <button type="button" id="cx-pred-expand-outlines" class="eds-c-button" style="background:#24618c; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
              Expand Subject Outlines
            </button>
          </div>
        `;
        const expandBtn = container.querySelector('#cx-pred-expand-outlines');
        if (expandBtn) {
          expandBtn.onclick = () => {
            if (window.ConnectifyData?.expandAll) {
              window.ConnectifyData.expandAll(true);
            }
          };
        }
        return;
      }

      let activeIndex = activeSubjectIndex ?? 0;
      if (activeIndex >= subjects.length) {
        activeIndex = 0;
        if (onSelectSubject) onSelectSubject(0);
      }

      // Horizontal Sub-Tabs (Up to 6 subjects)
      const subTabsBar = document.createElement('div');
      subTabsBar.className = 'cx-pred-subtabs';

      let activeTabBtn = null;
      subjects.forEach((subj, idx) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        const isActive = idx === activeIndex;
        tabBtn.className = `cx-pred-subtab ${isActive ? 'active' : ''}`;
        tabBtn.textContent = subj.cleanName;
        tabBtn.title = subj.cleanName;
        tabBtn.dataset.idx = String(idx);
        tabBtn.onclick = () => {
          lastSavedSubTabsScroll = subTabsBar.scrollLeft;
          if (onSelectSubject) onSelectSubject(idx);
          if (onRenderPanel) onRenderPanel();
        };
        if (isActive) activeTabBtn = tabBtn;
        subTabsBar.append(tabBtn);
      });

      container.append(subTabsBar);

      // Restore horizontal scroll position across tab switches
      if (lastSavedSubTabsScroll > 0) {
        subTabsBar.scrollLeft = lastSavedSubTabsScroll;
      }
      if (activeTabBtn && typeof activeTabBtn.scrollIntoView === 'function') {
        activeTabBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
      subTabsBar.addEventListener('scroll', () => {
        lastSavedSubTabsScroll = subTabsBar.scrollLeft;
      }, { passive: true });

      const activeSubject = subjects[activeIndex];
      const subjectView = document.createElement('div');
      subjectView.className = 'cx-pred-subject-view';

      // Check if subject has an average or baseline
      if (!activeSubject.hasSubjectAverage) {
        subjectView.innerHTML = `
          <div class="cx-pred-no-average-card">
            <div style="font-size:28px; margin-bottom:10px;">📋</div>
            <strong style="display:block; font-size:15px; margin-bottom:8px;">No Grades or Baselines for ${activeSubject.cleanName}</strong>
            <p style="font-size:12px; line-height:1.55; max-width:420px; margin:0 auto 18px auto; opacity:0.85;">
              Connectify needs either completed assessment marks or a previous year grade to project your final mark. Please go to <strong>Settings</strong> to enter your baseline grade, or wait for assessments to be returned.
            </p>
            <button type="button" id="cx-pred-goto-settings" class="eds-c-button" style="background:#24618c; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
              Go to Settings
            </button>
          </div>
        `;

        const gotoSettingsBtn = subjectView.querySelector('#cx-pred-goto-settings');
        if (gotoSettingsBtn) {
          gotoSettingsBtn.onclick = () => {
            const settingsToggle = document.getElementById('connectify-categories-toggle');
            if (settingsToggle) settingsToggle.click();
            else window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
          };
        }

        container.append(subjectView);
        return;
      }

      // Subject has an average or baseline: Render Projected Final Mark Header
      const headerCard = document.createElement('div');
      headerCard.className = 'cx-pred-card';

      const currentScoreLabel = activeSubject.runningMark !== null
        ? `${activeSubject.runningMark}% (Current)`
        : `${activeSubject.baselineMark}% (Baseline)`;

      headerCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <strong style="font-size:15px; font-weight:700;">${activeSubject.cleanName}</strong>
            <div style="font-size:11px; opacity:0.8; margin-top:2px;">
              ${activeSubject.completedWeight}% completed (${activeSubject.completedCount} graded) • ${currentScoreLabel}
            </div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1.25fr 1fr; gap:8px; text-align:center;">
          <div class="cx-pred-scenario-card cx-pred-scenario-card--low">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--low">Low</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--low">${activeSubject.projected.low ?? '—'}%</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--low">Relaxed pace</div>
          </div>
          <div class="cx-pred-scenario-card cx-pred-scenario-card--mid">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--mid">Middle (Expected)</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--mid">${activeSubject.projected.mid ?? '—'}%</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--mid">Current momentum</div>
          </div>
          <div class="cx-pred-scenario-card cx-pred-scenario-card--high">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--high">High</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--high">${activeSubject.projected.high ?? '—'}%</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--high">Extra effort</div>
          </div>
        </div>
      `;

      subjectView.append(headerCard);

      // Upcoming Tasks Section
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

          const taskHeader = document.createElement('div');
          taskHeader.style.display = 'flex';
          taskHeader.style.justifyContent = 'space-between';
          taskHeader.style.alignItems = 'center';
          taskHeader.style.marginBottom = '8px';

          taskHeader.innerHTML = `
            <div>
              <strong style="font-size:13px; font-weight:650;">${task?.name || 'Assessment'}</strong>
              <div style="font-size:11px; opacity:0.75; margin-top:1px;">
                ${task?.customDate || task?.dateDisplay || (window.ConnectifyProgressMath?.formatTimestamp && Number.isFinite(task?.order) ? window.ConnectifyProgressMath.formatTimestamp(task.order, task.caption) : task?.caption) || ''} • Weight: ${Number.isFinite(task?.weight) ? task.weight + '%' : '—'}
              </div>
            </div>
            <span style="font-size:10.5px; font-weight:700; color:#fff; background:${typeColor}; padding:2.5px 8px; border-radius:10px;">
              ${taskType}
            </span>
          `;

          taskCard.append(taskHeader);

          if (pred.unpredicted) {
            const notice = document.createElement('div');
            notice.className = 'cx-pred-unpredicted-notice';
            notice.innerHTML = `
              <strong>No previous tasks of this type have been done, unable to make prediction</strong>
              <div style="font-size:10.5px; opacity:0.9; margin-top:3px;">
                Tip: Enter your previous year average for "${taskType}" in Settings to predict this task.
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

      subjectView.append(upcomingContainer);
      container.append(subjectView);
    }

    window.ConnectifyPredictorGradeView = {
      renderGradePredictor
    };
  } catch (err) {
    console.error('Connectify error in predictor-grade-view.js:', err);
  }
})();
