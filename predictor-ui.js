/**
 * Connectify Grade & ATAR Predictor UI Panel
 *
 * Implements:
 * - Sidebar tool panel (`#connectify-predictor`) with launcher button
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

  function createPredictorPanel() {
    // 1. Sidebar launcher button (strictly plain text, no emoji as requested)
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Predictor';
    toggleBtn.type = 'button';
    toggleBtn.id = 'connectify-predictor-toggle';
    toggleBtn.className = 'cx-calculator-tool';
    toggleBtn.setAttribute('aria-controls', 'connectify-predictor');
    toggleBtn.setAttribute('aria-pressed', 'false');

    // 2. Workspace Panel
    const panel = document.createElement('section');
    panel.id = 'connectify-predictor';
    panel.hidden = true;
    panel.className = 'cx-workspace-panel';

    let activeMainTab = 'grade'; // 'grade' | 'atar'
    let activeSubjectIndex = 0;

    function renderPanel() {
      const predMath = window.ConnectifyPredictorMath;
      if (!predMath) {
        panel.innerHTML = `
          <header style="margin-bottom:18px;">
            <strong style="font-size:18px;">Predictor</strong>
          </header>
          <div style="padding:20px;color:#94a3b8;text-align:center;">Predictor mathematical engine loading...</div>
        `;
        return;
      }

      const allProjectedSubjects = predMath.projectSubjectGrades();
      // Cap at 6 subjects for sub-tabs as specified:
      const displaySubjects = allProjectedSubjects.slice(0, 6);

      panel.innerHTML = `
        <header style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
            <strong style="font-size:18px; color:#1e293b;" class="cx-pred-title">Predictor</strong>
            <span style="font-size:11px; color:#64748b;">Momentum & Assessment Modeling</span>
          </div>
          <div class="cx-pred-main-tabs" style="display:flex; gap:6px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
            <button type="button" id="cx-pred-btn-grade" class="cx-pred-main-tab ${activeMainTab === 'grade' ? 'active' : ''}">Grade Predictor</button>
            <button type="button" id="cx-pred-btn-atar" class="cx-pred-main-tab ${activeMainTab === 'atar' ? 'active' : ''}">ATAR Predictor</button>
          </div>
        </header>
        <div id="cx-pred-content"></div>
      `;

      // Main tab listeners
      panel.querySelector('#cx-pred-btn-grade').onclick = () => {
        activeMainTab = 'grade';
        renderPanel();
      };
      panel.querySelector('#cx-pred-btn-atar').onclick = () => {
        activeMainTab = 'atar';
        renderPanel();
      };

      const content = panel.querySelector('#cx-pred-content');

      if (activeMainTab === 'grade') {
        renderGradePredictor(content, displaySubjects);
      } else {
        renderAtarPredictor(content, allProjectedSubjects);
      }
    }

    function renderGradePredictor(container, subjects) {
      if (subjects.length === 0) {
        container.innerHTML = `
          <div style="padding:30px 16px; text-align:center; color:#94a3b8; font-size:12.5px;">
            No enrolled subjects detected yet. Please expand your subject outlines on Connect to load course data.
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
      subTabsBar.style.display = 'flex';
      subTabsBar.style.gap = '6px';
      subTabsBar.style.overflowX = 'auto';
      subTabsBar.style.paddingBottom = '10px';
      subTabsBar.style.marginBottom = '14px';

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
          <div class="cx-pred-no-average-card" style="padding:28px 20px; border:1px dashed #cbd5e1; border-radius:10px; text-align:center; background:#f8fafc; margin-top:8px;">
            <div style="font-size:26px; margin-bottom:10px;">📋</div>
            <strong style="display:block; font-size:14.5px; color:#1e293b; margin-bottom:8px;">No Grades or Baselines for ${activeSubject.cleanName}</strong>
            <p style="font-size:12px; color:#64748b; line-height:1.55; max-width:380px; margin:0 auto 16px auto;">
              Connectify needs either completed assessment marks or a previous year grade to project your final mark. Please go to <strong>Settings</strong> to enter your baseline grade, or wait for assessments to be returned.
            </p>
            <button type="button" id="cx-pred-goto-settings" class="eds-c-button" style="background:#2563eb; color:#fff; border:none; padding:7px 16px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
              Go to Settings
            </button>
          </div>
        `;

        subjectView.querySelector('#cx-pred-goto-settings').onclick = () => {
          const settingsToggle = document.getElementById('connectify-categories-toggle');
          if (settingsToggle) settingsToggle.click();
          else window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
        };

        container.append(subjectView);
        return;
      }

      // Subject has an average or baseline: Render Projected Final Mark Header
      const headerCard = document.createElement('div');
      headerCard.className = 'cx-pred-subject-header';
      headerCard.style.padding = '14px 16px';
      headerCard.style.background = '#f1f5f9';
      headerCard.style.borderRadius = '8px';
      headerCard.style.marginBottom = '18px';

      const currentScoreLabel = activeSubject.runningMark !== null
        ? `${activeSubject.runningMark}% (Current)`
        : `${activeSubject.baselineMark}% (Baseline)`;

      headerCard.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <strong style="font-size:14px; color:#0f172a;">${activeSubject.cleanName}</strong>
            <div style="font-size:11px; color:#64748b; margin-top:2px;">
              ${activeSubject.completedWeight}% completed (${activeSubject.completedCount} graded) • ${currentScoreLabel}
            </div>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1.2fr 1fr; gap:8px; text-align:center;">
          <div style="background:#ffffff; padding:8px 6px; border-radius:6px; border:1px solid #e2e8f0;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase; font-weight:600;">Low</div>
            <div style="font-size:16px; font-weight:700; color:#475569; margin-top:2px;">${activeSubject.projected.low ?? '—'}%</div>
            <div style="font-size:9.5px; color:#94a3b8;">Relaxed pace</div>
          </div>
          <div style="background:#eff6ff; padding:8px 6px; border-radius:6px; border:1px solid #bfdbfe;">
            <div style="font-size:10px; color:#2563eb; text-transform:uppercase; font-weight:700;">Middle (Expected)</div>
            <div style="font-size:18px; font-weight:800; color:#1d4ed8; margin-top:2px;">${activeSubject.projected.mid ?? '—'}%</div>
            <div style="font-size:9.5px; color:#3b82f6;">Current momentum</div>
          </div>
          <div style="background:#ffffff; padding:8px 6px; border-radius:6px; border:1px solid #e2e8f0;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase; font-weight:600;">High</div>
            <div style="font-size:16px; font-weight:700; color:#15803d; margin-top:2px;">${activeSubject.projected.high ?? '—'}%</div>
            <div style="font-size:9.5px; color:#94a3b8;">Extra effort</div>
          </div>
        </div>
      `;

      subjectView.append(headerCard);

      // Upcoming Tasks Section
      const upcomingContainer = document.createElement('div');
      upcomingContainer.className = 'cx-pred-upcoming-container';

      const upcomingTitle = document.createElement('strong');
      upcomingTitle.style.display = 'block';
      upcomingTitle.style.fontSize = '12.5px';
      upcomingTitle.style.color = '#334155';
      upcomingTitle.style.marginBottom = '10px';
      upcomingTitle.textContent = `Upcoming Assessments (${activeSubject.upcomingPredictions.length})`;

      upcomingContainer.append(upcomingTitle);

      if (activeSubject.upcomingPredictions.length === 0) {
        const doneNote = document.createElement('div');
        doneNote.style.padding = '18px';
        doneNote.style.textAlign = 'center';
        doneNote.style.color = '#64748b';
        doneNote.style.fontSize = '12px';
        doneNote.style.background = '#f8fafc';
        doneNote.style.borderRadius = '6px';
        doneNote.textContent = 'All scheduled assessments for this subject have been graded!';
        upcomingContainer.append(doneNote);
      } else {
        activeSubject.upcomingPredictions.forEach(({ task, prediction }) => {
          const taskCard = document.createElement('div');
          taskCard.className = 'cx-pred-task-card';
          taskCard.style.padding = '10px 12px';
          taskCard.style.background = '#ffffff';
          taskCard.style.border = '1px solid #e2e8f0';
          taskCard.style.borderRadius = '6px';
          taskCard.style.marginBottom = '8px';

          const taskType = prediction.taskType || 'Take-Home';
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
              <strong style="font-size:12.5px; color:#1e293b;">${task.name || 'Assessment'}</strong>
              <div style="font-size:10.5px; color:#64748b; margin-top:1px;">
                ${task.caption || ''} • Weight: ${task.weight !== null ? task.weight + '%' : '—'}
              </div>
            </div>
            <span style="font-size:10.5px; font-weight:700; color:#fff; background:${typeColor}; padding:2px 7px; border-radius:10px;">
              ${taskType}
            </span>
          `;

          taskCard.append(taskHeader);

          if (prediction.unpredicted) {
            // Cold-start warning notice
            const notice = document.createElement('div');
            notice.style.padding = '8px 10px';
            notice.style.background = '#fffbeb';
            notice.style.border = '1px solid #fef3c7';
            notice.style.borderRadius = '6px';
            notice.style.fontSize = '11.5px';
            notice.style.color = '#92400e';
            notice.style.lineHeight = '1.4';
            notice.innerHTML = `
              <strong>No previous tasks of this type have been done, unable to make prediction</strong>
              <div style="font-size:10.5px; color:#b45309; margin-top:3px;">
                Tip: Enter your previous year average for "${taskType}" in Settings to predict this task.
              </div>
            `;
            taskCard.append(notice);
          } else {
            // Low, Middle, High pills
            const predRow = document.createElement('div');
            predRow.style.display = 'grid';
            predRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
            predRow.style.gap = '6px';
            predRow.style.textAlign = 'center';

            predRow.innerHTML = `
              <div style="background:#f8fafc; padding:5px; border-radius:4px; border:1px solid #e2e8f0;">
                <span style="font-size:9.5px; color:#64748b; display:block;">Low</span>
                <strong style="font-size:13px; color:#475569;">${prediction.low}%</strong>
              </div>
              <div style="background:#eff6ff; padding:5px; border-radius:4px; border:1px solid #bfdbfe;">
                <span style="font-size:9.5px; color:#2563eb; display:block; font-weight:600;">Middle</span>
                <strong style="font-size:13.5px; color:#1d4ed8;">${prediction.mid}%</strong>
              </div>
              <div style="background:#f0fdf4; padding:5px; border-radius:4px; border:1px solid #bbf7d0;">
                <span style="font-size:9.5px; color:#15803d; display:block;">High</span>
                <strong style="font-size:13px; color:#16a34a;">${prediction.high}%</strong>
              </div>
            `;

            taskCard.append(predRow);

            if (prediction.breakoutScore) {
              const breakoutNote = document.createElement('div');
              breakoutNote.style.fontSize = '9.5px';
              breakoutNote.style.color = '#7c3aed';
              breakoutNote.style.marginTop = '5px';
              breakoutNote.style.textAlign = 'right';
              breakoutNote.style.fontStyle = 'italic';
              if (prediction.breakoutScore > 100) {
                breakoutNote.textContent = `⚡ Purple breakout threshold: >${prediction.breakoutScore}% (Unachievable)`;
              } else {
                breakoutNote.textContent = `⚡ Purple breakout threshold: >${prediction.breakoutScore}%`;
              }
              taskCard.append(breakoutNote);
            }
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
          <div style="padding:28px 16px; text-align:center; color:#94a3b8; font-size:12.5px; line-height:1.5;">
            ${atarProj.error}
            <div style="font-size:11px; margin-top:6px; color:#64748b;">
              Ensure at least four Year 11/12 ATAR course outlines are expanded on Connect.
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="cx-pred-atar-hero" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:18px;">
          <div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">
            Predicted Final ATAR
          </div>
          <div style="display:grid; grid-template-columns:1fr 1.3fr 1fr; gap:8px; text-align:center; align-items:center;">
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 6px;">
              <div style="font-size:10px; color:#64748b; text-transform:uppercase;">Low Scenario</div>
              <div style="font-size:18px; font-weight:700; color:#475569; margin-top:3px;">${atarProj.low.atar}</div>
              <div style="font-size:10px; color:#94a3b8;">TEA ${atarProj.low.tea}</div>
            </div>
            <div style="background:#eff6ff; border:1.5px solid #3b82f6; border-radius:8px; padding:12px 6px; box-shadow:0 2px 8px rgba(59,130,246,0.12);">
              <div style="font-size:10.5px; color:#1d4ed8; text-transform:uppercase; font-weight:700;">Expected ATAR</div>
              <div style="font-size:24px; font-weight:800; color:#1e40af; margin-top:2px;">${atarProj.mid.atar}</div>
              <div style="font-size:10.5px; color:#3b82f6; font-weight:600;">TEA ${atarProj.mid.tea}</div>
            </div>
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:10px 6px;">
              <div style="font-size:10px; color:#64748b; text-transform:uppercase;">High Scenario</div>
              <div style="font-size:18px; font-weight:700; color:#15803d; margin-top:3px;">${atarProj.high.atar}</div>
              <div style="font-size:10px; color:#94a3b8;">TEA ${atarProj.high.tea}</div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:11px; color:#64748b; text-align:center; line-height:1.4;">
            TEA ${atarProj.mid.tea} = best four ${atarProj.mid.baseTEA} + bonuses ${atarProj.mid.bonusTEA}
            ${atarProj.mid.yearAdjustment ? ' (Year 11 TEA scaling adjustment applied)' : ''}
          </div>
        </div>

        <div class="cx-pred-atar-table-section">
          <strong style="display:block; font-size:12.5px; color:#334155; margin-bottom:8px;">Contributing ATAR Courses</strong>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:1.5px solid #e2e8f0; color:#64748b; font-size:10.5px; text-transform:uppercase;">
                <th style="padding:6px 4px;">Course</th>
                <th style="padding:6px 4px; text-align:right;">Projected</th>
                <th style="padding:6px 4px; text-align:right;">Scaled</th>
                <th style="padding:6px 4px; text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${atarProj.mid.courses.map(c => {
                const isTop = atarProj.mid.topCourses.some(t => t.id === c.id);
                return `
                  <tr style="border-bottom:1px solid #f1f5f9; ${isTop ? 'background:rgba(34,197,94,0.04);' : ''}">
                    <td style="padding:7px 4px; font-weight:600; color:#1e293b;">${c.name}</td>
                    <td style="padding:7px 4px; text-align:right; color:#475569;">${c.mark !== undefined ? c.mark + '%' : '—'}</td>
                    <td style="padding:7px 4px; text-align:right; font-weight:600; color:#0f172a;">${c.score !== undefined ? c.score : '—'}</td>
                    <td style="padding:7px 4px; text-align:center;">
                      ${isTop
                        ? '<span style="font-size:10px; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 6px; border-radius:8px;">Top 4</span>'
                        : '<span style="font-size:10px; color:#94a3b8;">Reserve</span>'}
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

  window.ConnectifyPredictorUI = {
    createPredictorPanel
  };
})();
