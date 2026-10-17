/**
 * Connectify Grade Predictor View
 *
 * Renders the Grade Predictor subject sub-tabs, the guidance card for subjects without marks or
 * baselines, and the projected final mark card. Upcoming task cards come from predictor-task-cards.js.
 * Exposes window.ConnectifyPredictorGradeView.
 */
(() => {
  'use strict';

  try {
    const esc = (...args) => window.ConnectifyUtils.escapeHtml(...args);
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

      // Horizontal Sub-Tabs, one per subject (the bar scrolls; a dropped and a replacement course make 7+)
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
            <strong style="display:block; font-size:15px; margin-bottom:8px;">No Grades or Baselines for ${esc(activeSubject.cleanName)}</strong>
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
            <strong style="font-size:15px; font-weight:700;">${esc(activeSubject.cleanName)}</strong>
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

      const upcomingContainer = window.ConnectifyPredictorTaskCards.renderUpcoming(activeSubject);
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
