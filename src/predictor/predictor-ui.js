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
  let lastSavedSubTabsScroll = 0;
  let predictorInstance = null;

  function createPredictorPanel() {
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

    let panel = document.getElementById('connectify-predictor');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'connectify-predictor';
      panel.hidden = true;
      panel.className = 'cx-workspace-panel';
      panel.setAttribute('aria-label', 'Grade and ATAR Predictor');
    }

    function renderPanel() {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const prevSubtabs = livePanel.querySelector('.cx-pred-subtabs');
      if (prevSubtabs) {
        lastSavedSubTabsScroll = prevSubtabs.scrollLeft;
      }
      const predMath = window.ConnectifyPredictorMath;
      if (!predMath) {
        livePanel.innerHTML = `
          <header class="cx-pred-header">
            <strong class="cx-pred-title">Predictor</strong>
          </header>
          <div class="cx-pred-hint" style="padding:24px; text-align:center;">Predictor mathematical engine loading...</div>
        `;
        return;
      }

      let allProjectedSubjects = [];
      try {
        allProjectedSubjects = predMath.projectSubjectGrades() || [];
      } catch (err) {
        console.error('Error projecting subject grades in Predictor:', err);
        allProjectedSubjects = [];
      }
      const displaySubjects = allProjectedSubjects.slice(0, 6);

      livePanel.innerHTML = `
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

      const gradeTabBtn = livePanel.querySelector('#cx-pred-btn-grade');
      if (gradeTabBtn) {
        gradeTabBtn.onclick = () => {
          activeMainTab = 'grade';
          renderPanel();
        };
      }
      const atarTabBtn = livePanel.querySelector('#cx-pred-btn-atar');
      if (atarTabBtn) {
        atarTabBtn.onclick = () => {
          activeMainTab = 'atar';
          renderPanel();
        };
      }

      const content = livePanel.querySelector('#cx-pred-content');
      if (!content) return;

      if (activeMainTab === 'grade') {
        renderGradePredictor(content, displaySubjects);
      } else {
        renderAtarPredictor(content, allProjectedSubjects);
      }
    }

    function renderGradePredictor(container, subjects) {
      if (window.ConnectifyPredictorGradeView?.renderGradePredictor) {
        window.ConnectifyPredictorGradeView.renderGradePredictor(
          container,
          subjects,
          activeSubjectIndex,
          idx => { activeSubjectIndex = idx; },
          renderPanel
        );
      }
    }

    function renderAtarPredictor(container, allSubjects) {
      const predMath = window.ConnectifyPredictorMath;
      const atarProj = predMath.projectATAR(allSubjects);

      if (atarProj.error || !atarProj.mid?.courses) {
        container.innerHTML = `
          <div class="cx-pred-card" style="text-align:center; padding:28px 16px;">
            <p class="cx-pred-hint" style="margin:0; font-size:12.5px; line-height:1.5;">${atarProj.error || atarProj.mid?.error || 'At least four ATAR courses are required to project ATAR.'}</p>
            <div style="font-size:11px; margin-top:6px; opacity:0.8;">
              Ensure at least four Year 11/12 ATAR course outlines are expanded on Connect.
            </div>
            <div style="margin-top:14px;">
              <button type="button" class="cx-pred-expand-outlines-btn" style="background:#24618c; color:#fff; border:none; padding:8px 18px; border-radius:6px; font-weight:600; font-size:12px; cursor:pointer;">
                Expand All Outlines
              </button>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="cx-pred-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8;">
              Predicted Final ATAR
            </div>
            <button type="button" class="cx-pred-expand-outlines-btn" style="background:transparent; border:1px solid #3b82f6; color:#60a5fa; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer; font-weight:600;">
              Expand All Outlines
            </button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1.3fr 1fr; gap:8px; text-align:center; align-items:center;">
            <div class="cx-pred-scenario-card cx-pred-scenario-card--low" style="padding:10px 6px;">
              <div class="cx-pred-scenario-label cx-pred-scenario-label--low">Low Scenario</div>
              <div class="cx-pred-scenario-value cx-pred-scenario-value--low" style="font-size:19px; margin-top:3px;">${atarProj.low?.atar ?? '—'}</div>
              <div class="cx-pred-scenario-sub cx-pred-scenario-sub--low">TEA ${atarProj.low?.tea ?? 0}</div>
            </div>
            <div class="cx-pred-scenario-card cx-pred-scenario-card--mid" style="padding:12px 6px;">
              <div class="cx-pred-scenario-label cx-pred-scenario-label--mid">Expected ATAR</div>
              <div class="cx-pred-scenario-value cx-pred-scenario-value--mid cx-pred-scenario-value--atar">${atarProj.mid?.atar ?? '—'}</div>
              <div class="cx-pred-scenario-sub cx-pred-scenario-sub--mid">TEA ${atarProj.mid?.tea ?? 0}</div>
            </div>
            <div class="cx-pred-scenario-card cx-pred-scenario-card--high" style="padding:10px 6px;">
              <div class="cx-pred-scenario-label cx-pred-scenario-label--high">High Scenario</div>
              <div class="cx-pred-scenario-value cx-pred-scenario-value--high" style="font-size:19px; margin-top:3px;">${atarProj.high?.atar ?? '—'}</div>
              <div class="cx-pred-scenario-sub cx-pred-scenario-sub--high">TEA ${atarProj.high?.tea ?? 0}</div>
            </div>
          </div>
          <div style="margin-top:12px; font-size:11px; opacity:0.8; text-align:center; line-height:1.4;">
            TEA ${atarProj.mid?.tea ?? 0} = best four ${atarProj.mid?.baseTEA ?? 0} + bonuses ${atarProj.mid?.bonusTEA ?? 0}
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
              ${(atarProj.mid.courses || []).map(c => {
                const isTop = (atarProj.mid.topCourses || []).some(t => t.id === c.id);
                const displayScore = c.score !== undefined ? (Number.isFinite(c.score) ? Math.round(c.score) : c.score) : '—';
                return `
                  <tr style="${isTop ? 'background:rgba(34,197,94,0.06);' : ''}">
                    <td style="padding:8px 4px; font-weight:600;">${c.name}</td>
                    <td style="padding:8px 4px; text-align:right; opacity:0.9;">${c.mark !== undefined ? c.mark + '%' : '—'}</td>
                    <td style="padding:8px 4px; text-align:right; font-weight:700;">${displayScore}</td>
                    <td style="padding:8px 4px; text-align:center;">
                      ${isTop
                        ? '<span class="cx-pred-top4-badge">Top 4</span>'
                        : '<span class="cx-pred-reserve-badge">Reserve</span>'}
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
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const liveBtn = document.getElementById('connectify-predictor-toggle') || toggleBtn;
      const sidebar = document.getElementById('connectify-sidebar');
      const workspace = sidebar?.querySelector('.cx-workspace');

      if (workspace && !workspace.contains(livePanel)) {
        workspace.append(livePanel);
      }

      livePanel.hidden = false;
      liveBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'predictor' }));

      renderPanel();
    }

    function closePredictor() {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const liveBtn = document.getElementById('connectify-predictor-toggle') || toggleBtn;
      livePanel.hidden = true;
      liveBtn.setAttribute('aria-pressed', 'false');
    }

    toggleBtn.onclick = (e) => {
      if (e) e.stopPropagation();
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (livePanel.hidden) {
        openPredictor();
      } else {
        closePredictor();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    document.addEventListener('click', e => {
      const toggle = e.target.closest('#connectify-predictor-toggle');
      if (toggle) {
        const livePanel = document.getElementById('connectify-predictor') || panel;
        if (livePanel.hidden) {
          openPredictor();
        } else {
          closePredictor();
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
        }
        return;
      }

      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.contains(e.target)) return;

      const gradeTab = e.target.closest('#cx-pred-btn-grade');
      if (gradeTab) {
        activeMainTab = 'grade';
        renderPanel();
        return;
      }

      const atarTab = e.target.closest('#cx-pred-btn-atar');
      if (atarTab) {
        activeMainTab = 'atar';
        renderPanel();
        return;
      }

      const subtab = e.target.closest('.cx-pred-subtab');
      if (subtab && subtab.dataset.idx !== undefined) {
        activeSubjectIndex = Number(subtab.dataset.idx);
        renderPanel();
        return;
      }

      const expandBtn = e.target.closest('#cx-pred-expand-outlines, .cx-pred-expand-outlines-btn');
      if (expandBtn) {
        if (window.ConnectifyData?.expandAll) {
          window.ConnectifyData.expandAll(true);
        }
        return;
      }

      const gotoSettingsBtn = e.target.closest('#cx-pred-goto-settings');
      if (gotoSettingsBtn) {
        const settingsToggle = document.getElementById('connectify-categories-toggle');
        if (settingsToggle) settingsToggle.click();
        else window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
        return;
      }
    });

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'predictor') closePredictor();
    });

    window.addEventListener('connectify-baselines-updated', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
    });

    window.addEventListener('connectify-results-updated', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
    });

    window.addEventListener('connectify-task-type-changed', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
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
    getInstance: () => ensurePredictorPanel(),
    get panelRefs() {
      const inst = ensurePredictorPanel();
      return {
        toggleBtn: inst.toggleBtn,
        panel: inst.panel,
        openPredictor: inst.openPredictor,
        closePredictor: inst.closePredictor,
        renderPredictor: inst.renderPredictor
      };
    }
  };

  ensurePredictorPanel();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePredictorPanel);
  }
  window.addEventListener('load', ensurePredictorPanel);
})();
