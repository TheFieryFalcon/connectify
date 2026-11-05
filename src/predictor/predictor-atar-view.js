/**
 * Connectify Predictor: panel and ATAR predictor markup
 *
 * The Predictor panel shell (header with the Grade / ATAR tabs), its loading state, and the ATAR
 * predictor view: low / expected / high ATAR cards and the contributing courses table.
 * Exposes window.ConnectifyPredictorAtarView.
 */
(() => {
  'use strict';

  const esc = (...args) => window.ConnectifyUtils.escapeHtml(...args);

  const loadingHtml = () => `
          <header class="cx-pred-header">
            <strong class="cx-pred-title">Predictor</strong>
          </header>
          <div class="cx-pred-hint" style="padding:24px; text-align:center;">Predictor mathematical engine loading...</div>
        `;

  const panelHtml = activeMainTab => `
        <header class="cx-pred-header">
          <div class="cx-pred-header-row">
            <strong class="cx-pred-title">Predictor</strong>
                      </div>
          <div class="cx-pred-main-tabs">
            <button type="button" id="cx-pred-btn-grade" class="cx-pred-main-tab ${activeMainTab === 'grade' ? 'active' : ''}">Predict Grade</button>
            <button type="button" id="cx-pred-btn-atar" class="cx-pred-main-tab ${activeMainTab === 'atar' ? 'active' : ''}">Predict ATAR</button>
          </div>
        </header>
        <div id="cx-pred-content"></div>
      `;

  function renderAtarPredictor(container, atarProj) {
    if (atarProj.error || !atarProj.mid?.courses) {
      container.innerHTML = `
        <div class="cx-pred-card" style="text-align:center; padding:28px 16px;">
          <p class="cx-pred-hint" style="margin:0; font-size:12.5px; line-height:1.5;">${esc(atarProj.error || atarProj.mid?.error || 'At least four ATAR subjects are required to project ATAR.')}</p>
          <div style="font-size:11px; margin-top:6px; opacity:0.8;">
            Ensure at least four Year 11/12 ATAR subject outlines are expanded on Connect.
          </div>
          <div style="margin-top:14px;">
            <button type="button" class="cx-pred-expand-outlines-btn">
              Expand Subject Outlines
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="cx-pred-card">
        <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; margin-bottom:10px;">
          Predicted Final ATAR
        </div>
        <div style="display:grid; grid-template-columns:1fr 1.3fr 1fr; gap:8px; text-align:center; align-items:center;">
          <div class="cx-pred-scenario-card cx-pred-scenario-card--low" style="padding:10px 6px;">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--low">Low</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--low" style="font-size:19px; margin-top:3px;">${atarProj.low?.atar ?? '—'}</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--low">TEA ${atarProj.low?.tea ?? 0}</div>
          </div>
          <div class="cx-pred-scenario-card cx-pred-scenario-card--mid" style="padding:12px 6px;">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--mid">Mid</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--mid cx-pred-scenario-value--atar">${atarProj.mid?.atar ?? '—'}</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--mid">TEA ${atarProj.mid?.tea ?? 0}</div>
          </div>
          <div class="cx-pred-scenario-card cx-pred-scenario-card--high" style="padding:10px 6px;">
            <div class="cx-pred-scenario-label cx-pred-scenario-label--high">High</div>
            <div class="cx-pred-scenario-value cx-pred-scenario-value--high" style="font-size:19px; margin-top:3px;">${atarProj.high?.atar ?? '—'}</div>
            <div class="cx-pred-scenario-sub cx-pred-scenario-sub--high">TEA ${atarProj.high?.tea ?? 0}</div>
          </div>
        </div>
        <div style="margin-top:12px; font-size:11px; opacity:0.8; text-align:center; line-height:1.4;">
          TEA ${atarProj.mid?.tea ?? 0} = best four ${atarProj.mid?.baseTEA ?? 0} + bonuses ${atarProj.mid?.bonusTEA ?? 0}
        </div>
      </div>

      <div class="cx-pred-atar-table-section" style="margin-top:20px;">
        <strong style="display:block; font-size:13px; font-weight:650; margin-bottom:8px;">Contributing Subjects</strong>
        <table class="cx-pred-courses-table">
          <thead>
            <tr>
              <th style="padding:7px 4px;">Subject</th>
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
                <tr class="${isTop ? 'cx-pred-top-row' : ''}">
                  <td style="padding:8px 4px; font-weight:600;">${esc(window.ConnectifyUtils.cleanSubjectName(c.name) || c.name)}</td>
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
      <p class="cx-pred-hint cx-atar-disclaimer">${esc(window.ConnectifyAtarMarkup?.ATAR_DISCLAIMER || '')}</p>
    `;
  }

  window.ConnectifyPredictorAtarView = { loadingHtml, panelHtml, renderAtarPredictor };
})();
