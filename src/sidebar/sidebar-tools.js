/**
 * Connectify Sidebar: tool launchers and panels
 *
 * Mounts the canonical launcher buttons and the tool panels into the sidebar, and opens or closes a
 * tool when its launcher is clicked. Mounting only touches the DOM when something is actually out of
 * place, so the periodic sync does not churn the page. Exposes window.ConnectifySidebarTools.
 */
(() => {
  'use strict';

  const CANONICAL_BUTTONS = [
    { id: 'connectify-target-toggle', label: 'Target ATAR' }, { id: 'connectify-grade-toggle', label: 'Target Grade' },
    { id: 'connectify-predictor-toggle', label: 'Predictor' }, { id: 'connectify-progress-toggle', label: 'Year in Progress' },
    { id: 'connectify-estimate-toggle', label: 'ATAR Estimate' }, { id: 'connectify-weakness-toggle', label: 'Weakness Analyzer' },
    { id: 'connectify-categories-toggle', label: 'Settings' }
  ];
  const SECONDARY_TOOLS = new Set(['connectify-weakness-toggle', 'connectify-categories-toggle']);
  const LAUNCHER_SELECTOR = '#connectify-target-toggle, #connectify-grade-toggle, #connectify-estimate-toggle, #connectify-predictor-toggle, ' +
    '#connectify-progress-toggle, #connectify-weakness-toggle, #connectify-categories-toggle';
  const CALCULATOR_MODES = { 'connectify-target-toggle': 'target', 'connectify-grade-toggle': 'grade', 'connectify-estimate-toggle': 'estimate' };

  const TOOL_MAP = {
    'connectify-predictor-toggle': {
      getRefs: () => window.ConnectifyPredictorUI?.panelRefs || window.ConnectifyPredictorUI?.ensurePredictorPanel?.(),
      panelId: 'connectify-predictor', open: r => r?.openPredictor?.(), close: r => r?.closePredictor?.(), detail: 'predictor'
    },
    'connectify-progress-toggle': {
      getRefs: () => window.ConnectifyProgress?.panelRefs || window.ConnectifyProgress?.ensureProgressPanel?.(),
      panelId: 'connectify-progress', open: r => r?.openProgress?.(), close: r => r?.closeProgress?.(), detail: 'progress'
    },
    'connectify-weakness-toggle': {
      getRefs: () => window.ConnectifyWeakness?.panelRefs || window.ConnectifyWeakness?.ensureWeaknessPanel?.(),
      panelId: 'connectify-weakness', open: r => r?.openWeakness?.(), close: r => r?.closeWeakness?.(), detail: 'weakness'
    },
    'connectify-categories-toggle': {
      getRefs: () => window.ConnectifyCategorySettings?.panelRefs || window.ConnectifyCategorySettings?.ensureSettingsPanel?.(),
      panelId: 'connectify-categories', open: r => r?.openCategories?.(), close: r => r?.closeCategories?.(), detail: 'categories'
    }
  };

  const PANEL_DEFS = [
    ['connectea-atar', () => window.ConnectifyAtar?.calculatorPanel],
    ['connectify-predictor', () => window.ConnectifyPredictorUI?.panelRefs?.panel || window.ConnectifyPredictorUI?.getInstance?.()?.panel],
    ['connectify-progress', () => document.getElementById('connectify-progress') || window.ConnectifyProgress?.panelRefs?.panel],
    ['connectify-weakness', () => window.ConnectifyWeakness?.panelRefs?.panel || (window.ConnectifyWeakness?.ensureWeaknessPanel && window.ConnectifyWeakness.ensureWeaknessPanel().panel)],
    ['connectify-categories', () => window.ConnectifyCategorySettings?.panelRefs?.catPanel || (window.ConnectifyCategorySettings?.ensureSettingsPanel && window.ConnectifyCategorySettings.ensureSettingsPanel().catPanel)]
  ];

  const openEvent = detail => window.dispatchEvent(new CustomEvent('connectify-open', { detail }));

  function ensurePanels() {
    if (!window.ConnectifyWeakness?.panelRefs) (window.ConnectifyWeakness?.ensureWeaknessPanel || window.ConnectifyWeakness?.createWeaknessPanel)?.();
    if (!window.ConnectifyCategorySettings?.panelRefs) (window.ConnectifyCategorySettings?.ensureSettingsPanel || window.ConnectifyCategorySettings?.createSettingsPanel)?.();
    if (!window.ConnectifyProgress?.panelRefs) window.ConnectifyProgress?.ensureProgressPanel?.();
    if (!document.getElementById('connectify-predictor-toggle')) window.ConnectifyPredictorUI?.ensurePredictorPanel?.();
  }

  function findLauncher(item) {
    const atarBtns = window.ConnectifyAtar?.calculatorButtons || window.ConnectifyAtar?.toolButtons || [];
    return atarBtns.find(b => b && b.id === item.id) ||
      (item.id === 'connectify-predictor-toggle' && (window.ConnectifyPredictorUI?.panelRefs?.toggleBtn || window.ConnectifyPredictorUI?.getInstance?.()?.toggleBtn)) ||
      (item.id === 'connectify-progress-toggle' && (document.getElementById('connectify-progress-toggle') || window.ConnectifyProgress?.panelRefs?.toggleBtn)) ||
      (item.id === 'connectify-weakness-toggle' && window.ConnectifyWeakness?.panelRefs?.toggleBtn) ||
      (item.id === 'connectify-categories-toggle' && window.ConnectifyCategorySettings?.panelRefs?.catBtn) || null;
  }

  function resolveButton(item, toolMenu) {
    let matches = Array.from(document.querySelectorAll('#' + item.id));
    if (matches.length === 0) {
      const found = findLauncher(item);
      if (found) matches = [found];
    }
    let btn = matches.find(m => m.parentElement === toolMenu) || matches[0];
    matches.forEach(m => { if (m !== btn && m.parentElement) m.remove(); });
    if (!btn) {
      btn = Object.assign(document.createElement('button'), { id: item.id, type: 'button' });
    }
    // Only write when something differs: this runs on every sync
    if (btn.textContent !== item.label) btn.textContent = item.label;
    const className = SECONDARY_TOOLS.has(item.id) ? 'cx-secondary-tool' : 'cx-calculator-tool';
    if (btn.className !== className) btn.className = className;
    return btn;
  }

  /** Puts the launcher buttons (in canonical order) and the tool panels into the sidebar. */
  function mountTools(toolMenu, workspace) {
    ensurePanels();
    const buttons = CANONICAL_BUTTONS.map(item => resolveButton(item, toolMenu));
    const wanted = new Set(buttons);
    Array.from(toolMenu.children).forEach(child => { if (!wanted.has(child)) child.remove(); });
    const inOrder = buttons.every((btn, i) => toolMenu.children[i] === btn);
    if (!inOrder) for (const btn of buttons) toolMenu.append(btn);

    for (const [panelId, getter] of PANEL_DEFS) {
      let matches = Array.from(document.querySelectorAll('#' + panelId));
      if (matches.length === 0) {
        const fallback = getter();
        if (fallback) matches = [fallback];
      }
      if (matches.length === 0) continue;
      const panel = matches.find(m => m.parentElement === workspace) || matches[0];
      matches.forEach(m => { if (m !== panel && m.parentElement) m.remove(); });
      if (panel.parentElement !== workspace) workspace.append(panel);
    }
  }

  const setPressed = (btn, pressed) => {
    if (btn && btn.getAttribute('aria-pressed') !== String(pressed)) btn.setAttribute('aria-pressed', String(pressed));
  };

  /**
   * Launchers are pressed only while their tool is open. The calculator's three launchers keep the
   * mode-specific state atar-ui gives them while the calculator is open, and are all released when it closes.
   */
  function syncPressedState(toolMenu) {
    const calculatorPanel = document.getElementById('connectea-atar');
    const calculatorOpen = Boolean(calculatorPanel && !calculatorPanel.hidden);
    for (const btn of toolMenu.children) {
      if (CALCULATOR_MODES[btn.id]) {
        if (!calculatorOpen) setPressed(btn, false);
      } else if (TOOL_MAP[btn.id]) {
        const panel = document.getElementById(TOOL_MAP[btn.id].panelId);
        setPressed(btn, Boolean(panel && !panel.hidden));
      }
    }
  }

  /** Opens (or, if already open, closes) the tool behind a launcher button. */
  function launchTool(toggle) {
    const id = toggle.id;
    if (CALCULATOR_MODES[id]) {
      for (const tid of Object.keys(CALCULATOR_MODES)) {
        document.getElementById(tid)?.setAttribute('aria-pressed', tid === id ? 'true' : 'false');
      }
      if (window.ConnectifyAtar?.openCalculator) window.ConnectifyAtar.openCalculator(CALCULATOR_MODES[id]);
      else openEvent('calculator');
      return;
    }
    const cfg = TOOL_MAP[id];
    if (!cfg) return;
    const refs = cfg.getRefs();
    const panel = refs?.panel || refs?.catPanel || document.getElementById(cfg.panelId);
    if (panel && !panel.hidden) {
      cfg.close(refs);
      openEvent('home');
    } else if (refs && (refs.openPredictor || refs.openProgress || refs.openWeakness || refs.openCategories)) {
      cfg.open(refs);
    } else if (panel) {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-pressed', 'true');
      openEvent(cfg.detail);
      if (id === 'connectify-progress-toggle') refs?.refresh?.();
    } else {
      openEvent(cfg.detail);
    }
  }

  window.ConnectifySidebarTools = { CANONICAL_BUTTONS, LAUNCHER_SELECTOR, mountTools, syncPressedState, launchTool };
})();
