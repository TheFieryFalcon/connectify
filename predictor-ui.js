/**
 * Connectify Grade & ATAR Predictor UI Panel
 *
 * Implements:
 * - Sidebar tool panel (`#connectify-predictor`) with launcher button (`#connectify-predictor-toggle`)
 * - Follows the exact design language of existing panels, expanding the sidebar drawer (.cx-tool-active)
 * - Dual primary tabs: Grade Predictor and ATAR Predictor
 * - Grade Predictor: Up to 6 subject sub-tabs with no-average guidance panel
 *   and individual upcoming task prediction sections (Low, Middle, High)
 * - Cold-start unpredicted notices ("No previous tasks of this type have been done...")
 * - ATAR Predictor: Aggregates Grade Predictor projections into Low, Medium, High ATAR
 *
 * Provides `window.ConnectifyPredictorUI`.
 */
(() => {
  'use strict';

  if (window.ConnectifyPredictorUI) return;

  let activeMainTab = 'grade'; // 'grade' | 'atar'
  let activeSubjectIndex = 0;
  let predictorInstance = null;

  function createPredictorPanel() {
    // 1. Sidebar launcher button (plain text "Predictor", no emoji)
    let toggleBtn = document.getElementById('connectify-predictor-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Predictor';
      toggleBtn.type = 'button';
      toggleBtn.id = 'connectify-predictor-toggle';
      toggleBtn.className = 'cx-calculator-tool';
      toggleBtn.setAttribute('aria-controls', 'connectify-predictor');
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    // 2. Workspace Panel
    let panel = document.getElementById('connectify-predictor');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'connectify-predictor';
      panel.hidden = true;
      panel.className = 'cx-workspace-panel';
      panel.setAttribute('aria-label', 'Grade and ATAR Predictor');
    }

    function renderPanel() {
      const predMath = window.ConnectifyPredictorMath;
      if (!predMath) {
        panel.innerHTML = `
          <header class="cx-pred-header">
            <strong class="cx-pred-title">Predictor</strong>
          </header>
          <div style="padding:24px; color:#55667a; text-align:center;">Predictor mathematical engine loading...</div>
        `;
        return;
      }

      const allProjectedSubjects = predMath.projectSubjectGrades();
      // Cap at 6 subjects for sub-tabs as specified:
      const displaySubjects = allProjectedSubjects.slice(0, 6);

      panel.innerHTML = `
        <header class="cx-pred-header">
          <div class="cx-pred-header-row">
            <strong class="cx-pred-title">Predictor</strong>
            <span class="cx-pred-subtitle">Momentum & Assessment Modeling</span>
          </div>
          <div class="cx-pred-main-tabs">
            <button type="button" id="cx-pred-btn-grade" class="cx-pred-main-tab ${activeMainTab === 'grade' ? 'active' : ''}">Grade Predictor</button>
            <button type="button" id="cx-pred-btn-atar" class="cx-pred-main-tab ${activeMainTab === 'atar' ? 'active' : ''}">ATAR Predictor</button>
          </div>
        </header>
        <div id="cx-pred-content"></div>
      `;

      // Main tab listeners
      const gradeTabBtn = panel.querySelector('#cx-pred-btn-grade');
      if (gradeTabBtn) {
        gradeTabBtn.onclick = () => {
          activeMainTab = 'grade';
          renderPanel();
        };
      }
      const atarTabBtn = panel.querySelector('#cx-pred-btn-atar');
      if (atarTabBtn) {
        atarTabBtn.onclick = () => {
          activeMainTab = 'atar';
          renderPanel();
        };
      }

      const content = panel.querySelector('#cx-pred-content');
      if (!content) return;

      if (activeMainTab === 'grade') {
        renderGradePredictor(content, displaySubjects);
      } else {
        renderAtarPredictor(content, allProjectedSubjects);
      }
    }

    function renderGradePredictor(container, subjects) {
      if (subjects.length === 0) {
        container.innerHTML = `
          <div class="cx-pred-card" style="text-align:center; padding:30px 16px;">
            <p style="margin:0; font-size:12.5px; color:#55667a;">
              No enrolled subjects detected yet. Please expand your subject outlines on Connect to load course data.
            </p>
          </div>
        `;
        return;
      }

      if (activeSubjectIndex >= subjects.length) {
        activeSubjectIndex = 0;
      }

      // Horizontal Sub-Tabs (Up to 6 subjects)
      const subTabsBar = document.createElement('div');
      subTabsBar.className = 'cx-pred-subtabs';

      subjects.forEach((subj, idx) => {
        const tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = `cx-pred-subtab ${idx === activeSubjectIndex ? 'active' : ''}`;
        tabBtn.textContent = subj.cleanName;
        tabBtn.title = subj.cleanName;
        tabBtn.onclick = () => {
          activeSubjectIndex = idx;
          renderPanel();
        };
        subTabsBar.append(tabBtn);
      });

      container.append(subTabsBar);

      const activeSubject = subjects[activeSubjectIndex];
      const subjectView = document.createElement('div');
      subjectView.className = 'cx-pred-subject-view';

      // Check if subject has an average or baseline
      if (!activeSubject.hasSubjectAverage) {
        // Guidance notice asking user to go to Settings or wait
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
          <div class="cx-pred-scenario-card">
            <div style="font-size:10px; text-transform:uppercase; font-weight:600; opacity:0.75;">Low</div>
            <div style="font-size:17px; font-weight:700; margin-top:3px;">${activeSubject.projected.low ?? '—'}%</div>
            <div style="font-size:9.5px; opacity:0.7; margin-top:1px;">Relaxed pace</div>
          </div>
          <div class="cx-pred-scenario-card cx-pred-scenario-card--mid">
            <div style="font-size:10px; text-transform:uppercase; font-weight:700; color:#174c75;">Middle (Expected)</div>
            <div style="font-size:20px; font-weight:800; color:#174c75; margin-top:2px;">${activeSubject.projected.mid ?? '—'}%</div>
            <div style="font-size:9.5px; font-weight:500; color:#24618c; margin-top:1px;">Current momentum</div>
          </div>
          <div class="cx-pred-scenario-card">
            <div style="font-size:10px; text-transform:uppercase; font-weight:600; opacity:0.75;">High</div>
            <div style="font-size:17px; font-weight:700; color:#15803d; margin-top:3px;">${activeSubject.projected.high ?? '—'}%</div>
            <div style="font-size:9.5px; opacity:0.7; margin-top:1px;">Extra effort</div>
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
      upcomingTitle.textContent = `Upcoming Assessments (${activeSubject.upcomingPredictions.length})`;

      upcomingContainer.append(upcomingTitle);

      if (activeSubject.upcomingPredictions.length === 0) {
        const doneNote = document.createElement('div');
        doneNote.className = 'cx-pred-card';
        doneNote.style.textAlign = 'center';
        doneNote.style.padding = '18px';
        doneNote.style.fontSize = '12px';
        doneNote.textContent = 'All scheduled assessments for this subject have been graded!';
        upcomingContainer.append(doneNote);
      } else {
        activeSubject.upcomingPredictions.forEach(({ task, prediction }) => {
          const taskCard = document.createElement('div');
          taskCard.className = 'cx-pred-task-card';

          const taskType = prediction.taskType || prediction.type || 'Take-Home';
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
              <strong style="font-size:13px; font-weight:650;">${task.name || 'Assessment'}</strong>
              <div style="font-size:11px; opacity:0.75; margin-top:1px;">
                ${task.caption || ''} • Weight: ${task.weight !== null ? task.weight + '%' : '—'}
              </div>
            </div>
            <span style="font-size:10.5px; font-weight:700; color:#fff; background:${typeColor}; padding:2.5px 8px; border-radius:10px;">
              ${taskType}
            </span>
          `;

          taskCard.append(taskHeader);

          if (prediction.unpredicted) {
            // Cold-start warning notice
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
            // Low, Middle, High pills
            const predRow = document.createElement('div');
            predRow.style.display = 'grid';
            predRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
            predRow.style.gap = '8px';

            predRow.innerHTML = `
              <div class="cx-pred-pill">
                <span style="font-size:9.5px; opacity:0.75; display:block; text-transform:uppercase;">Low</span>
                <strong style="font-size:13.5px;">${prediction.low}%</strong>
              </div>
              <div class="cx-pred-pill cx-pred-pill--mid">
                <span style="font-size:9.5px; font-weight:700; display:block; text-transform:uppercase;">Middle</span>
                <strong style="font-size:14px;">${prediction.mid}%</strong>
              </div>
              <div class="cx-pred-pill cx-pred-pill--high">
                <span style="font-size:9.5px; font-weight:700; display:block; text-transform:uppercase;">High</span>
                <strong style="font-size:13.5px;">${prediction.high}%</strong>
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

    function renderAtarPredictor(container, allSubjects) {
      const predMath = window.ConnectifyPredictorMath;
      const atarProj = predMath.projectATAR(allSubjects);

      if (atarProj.error) {
        container.innerHTML = `
          <div class="cx-pred-card" style="text-align:center; padding:28px 16px;">
            <p style="margin:0; font-size:12.5px; color:#55667a; line-height:1.5;">${atarProj.error}</p>
            <div style="font-size:11px; margin-top:6px; opacity:0.8;">
              Ensure at least four Year 11/12 ATAR course outlines are expanded on Connect.
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="cx-pred-card">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; opacity:0.8;">
            Predicted Final ATAR
          </div>
          <div style="display:grid; grid-template-columns:1fr 1.3fr 1fr; gap:8px; text-align:center; align-items:center;">
            <div class="cx-pred-scenario-card" style="padding:10px 6px;">
              <div style="font-size:10px; text-transform:uppercase; opacity:0.75;">Low Scenario</div>
              <div style="font-size:19px; font-weight:700; margin-top:3px;">${atarProj.low.atar}</div>
              <div style="font-size:10px; opacity:0.7; margin-top:1px;">TEA ${atarProj.low.tea}</div>
            </div>
            <div class="cx-pred-scenario-card cx-pred-scenario-card--mid" style="padding:12px 6px; box-shadow:0 2px 8px rgba(36,97,140,0.18);">
              <div style="font-size:10.5px; text-transform:uppercase; font-weight:700; color:#174c75;">Expected ATAR</div>
              <div style="font-size:26px; font-weight:800; color:#174c75; margin-top:2px;">${atarProj.mid.atar}</div>
              <div style="font-size:10.5px; color:#24618c; font-weight:600;">TEA ${atarProj.mid.tea}</div>
            </div>
            <div class="cx-pred-scenario-card" style="padding:10px 6px;">
              <div style="font-size:10px; text-transform:uppercase; opacity:0.75;">High Scenario</div>
              <div style="font-size:19px; font-weight:700; color:#15803d; margin-top:3px;">${atarProj.high.atar}</div>
              <div style="font-size:10px; opacity:0.7; margin-top:1px;">TEA ${atarProj.high.tea}</div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:11px; opacity:0.8; text-align:center; line-height:1.4;">
            TEA ${atarProj.mid.tea} = best four ${atarProj.mid.baseTEA} + bonuses ${atarProj.mid.bonusTEA}
          </div>
        </div>

        <div class="cx-pred-atar-table-section" style="margin-top:20px;">
          <strong style="display:block; font-size:13px; font-weight:650; margin-bottom:8px;">Contributing ATAR Courses</strong>
          <table class="cx-pred-courses-table">
            <thead>
              <tr>
                <th style="padding:7px 4px;">Course</th>
                <th style="padding:7px 4px; text-align:right;">Projected</th>
                <th style="padding:7px 4px; text-align:right;">Scaled</th>
                <th style="padding:7px 4px; text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${atarProj.mid.courses.map(c => {
                const isTop = atarProj.mid.topCourses.some(t => t.id === c.id);
                const displayScore = c.score !== undefined ? (Number.isFinite(c.score) ? Math.round(c.score) : c.score) : '—';
                return `
                  <tr style="${isTop ? 'background:rgba(34,197,94,0.06);' : ''}">
                    <td style="padding:8px 4px; font-weight:600;">${c.name}</td>
                    <td style="padding:8px 4px; text-align:right; opacity:0.9;">${c.mark !== undefined ? c.mark + '%' : '—'}</td>
                    <td style="padding:8px 4px; text-align:right; font-weight:700;">${displayScore}</td>
                    <td style="padding:8px 4px; text-align:center;">
                      ${isTop
                        ? '<span style="font-size:10px; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 7px; border-radius:8px;">Top 4</span>'
                        : '<span style="font-size:10px; opacity:0.65;">Reserve</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function openPredictor() {
      panel.hidden = false;
      toggleBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'predictor' }));
      renderPanel();
    }

    function closePredictor() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    toggleBtn.onclick = () => {
      if (panel.hidden) {
        openPredictor();
      } else {
        closePredictor();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'predictor') closePredictor();
    });

    window.addEventListener('connectify-baselines-updated', () => {
      if (!panel.hidden) renderPanel();
    });

    window.addEventListener('connectify-results-updated', () => {
      if (!panel.hidden) renderPanel();
    });

    window.addEventListener('connectify-task-type-changed', () => {
      if (!panel.hidden) renderPanel();
    });

    return {
      toggleBtn,
      panel,
      openPredictor,
      closePredictor,
      renderPredictor: renderPanel
    };
  }

  function ensurePredictorPanel() {
    if (!predictorInstance) {
      predictorInstance = createPredictorPanel();
    }
    const sidebar = document.getElementById('connectify-sidebar');
    const toolMenu = sidebar?.querySelector('.cx-tool-menu');
    const workspace = sidebar?.querySelector('.cx-workspace');

    if (toolMenu && !toolMenu.contains(predictorInstance.toggleBtn)) {
      toolMenu.append(predictorInstance.toggleBtn);
    }
    if (workspace && !workspace.contains(predictorInstance.panel)) {
      workspace.append(predictorInstance.panel);
    }
    return predictorInstance;
  }

  window.ConnectifyPredictorUI = {
    createPredictorPanel,
    ensurePredictorPanel,
    getInstance: () => ensurePredictorPanel()
  };

  // Self-initialize immediately so elements exist as soon as content script loads
  ensurePredictorPanel();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePredictorPanel);
  }
  window.addEventListener('load', ensurePredictorPanel);
})();
