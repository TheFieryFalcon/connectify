/**
 * Connectify Cohort Injected Stylesheet
 *
 * Injected styles for Connect assessment rows, cohort statistics panels,
 * and responsive scaling across viewports.
 * Exposes window.ConnectifyCohortStyles.
 */
(() => {
  'use strict';

  const styles = `
    .cvr-c-task__details {
      overflow: visible !important;
    }
    .connectea-row-wrapper {
      display: flex !important;
      align-items: center !important;
      gap: 14px !important;
      flex-wrap: nowrap !important;
      margin: 4px 0 !important;
      max-width: 100% !important;
      clear: both !important;
      overflow: visible !important;
      zoom: var(--cx-display-scale, 1);
      transform-origin: left center !important;
    }
    .connectea-row-wrapper > .connectea-panel {
      flex: 0 0 auto !important;
      width: auto !important;
      max-width: fit-content !important;
      margin: 0 !important;
    }
    .connectea-panel {
      box-sizing: border-box !important;
      display: block !important;
      min-width: 0 !important;
      max-width: fit-content !important;
      width: auto !important;
      clear: both !important;
      margin: 8px 0 !important;
      padding: 10px 14px !important;
      border: 1px solid #b9cbe1 !important;
      border-radius: 8px !important;
      background: #f3f7fc !important;
      color: #253b53 !important;
      font: 12px/1.5 system-ui, -apple-system, sans-serif !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }
    .connectea-panel[hidden],
    .connectea-panel.connectea-hidden {
      display: none !important;
    }
    .connectea-type-container {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
    }
    .connectea-type-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      color: #4e6076;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
    .connectea-type-select {
      box-sizing: border-box;
      min-height: 26px;
      padding: 2px 8px;
      border: 1px solid #b9cbe1;
      border-radius: 6px;
      background: #f7f9fc;
      color: #203c5e;
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
    }
    .connectea-type-select:hover {
      border-color: #3575b9;
      background: #ffffff;
    }
    .connectea-type-select:focus {
      border-color: #3575b9;
      outline: 2px solid #3575b9;
      outline-offset: 1px;
    }
    .connectea-type-select.connectea-overridden {
      border-color: #24618c;
      background: #e9f2fb;
      color: #174c75;
      font-weight: 700;
    }
    .connectea-dark .connectea-type-label {
      color: #a0b2c6;
    }
    .connectea-dark .connectea-type-select {
      background: #2a3b4c;
      color: #e1eaf3;
      border-color: #496178;
    }
    .connectea-dark .connectea-type-select:hover {
      border-color: #6ba5d6;
      background: #33485d;
    }
    .connectea-dark .connectea-type-select:focus {
      border-color: #6ba5d6;
      outline: 2px solid #6ba5d6;
    }
    .connectea-dark .connectea-type-select.connectea-overridden {
      border-color: #6ba5d6;
      background: #364e65;
      color: #ffffff;
    }
    .connectea-distribution {
      display: block !important;
      width: 100% !important;
      font-weight: 400 !important;
      margin-bottom: 6px !important;
      line-height: 1.5 !important;
      clear: both !important;
    }
    .connectea-distribution strong,
    .connectea-result strong,
    .connectea-panel strong {
      font-weight: 700 !important;
    }
    .connectea-subject-controls {
      display: block !important;
      width: 100% !important;
      margin-top: 10px !important;
      padding-top: 8px !important;
      border-top: 1px solid #d3dfed !important;
      clear: both !important;
    }
    .connectea-title {
      display: block;
      font-size: 13px;
      color: #203c5e;
    }
    .connectea-controls {
      font-size: 11px !important;
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      margin: 4px 6px 3px 0 !important;
      font-weight: 500 !important;
    }
    .connectea-controls input {
      box-sizing: border-box;
      width: 76px;
      min-height: 24px;
      border: 1px solid #8599b1;
      border-radius: 5px;
      background: white;
      color: #203348;
      padding: 2px 6px;
      font: inherit;
    }
    .connectea-controls input:focus {
      outline: 2px solid #3575b9;
      outline-offset: 2px;
    }
    .connectea-controls input[aria-invalid=true] {
      border-color: #b62727;
    }
    .connectea-notice {
      display: block !important;
      color: #4e6076 !important;
      font-size: 11px !important;
      margin-top: 3px !important;
    }
    .connectea-result-row {
      display: flex !important;
      align-items: baseline !important;
      gap: 8px 14px !important;
      flex-wrap: wrap !important;
      width: 100% !important;
      margin-top: 6px !important;
      margin-bottom: 6px !important;
      clear: both !important;
    }
    .connectea-result {
      font-weight: 400 !important;
      line-height: 1.5 !important;
      flex: 1 1 260px !important;
    }
    .connectea-dark .connectea-panel {
      background: var(--cx-surface-elevated, #333333) !important;
      color: var(--cx-text-secondary, #cccccc) !important;
      border-color: var(--cx-border, #3a3a3a) !important;
    }
    .connectea-dark .connectea-subject-controls {
      border-top-color: var(--cx-border, #3a3a3a) !important;
    }
    .connectea-dark .connectea-notice {
      color: var(--cx-text-muted, #999999) !important;
    }
    .connectea-dark .connectea-controls input {
      background: var(--cx-input-bg, #212121) !important;
      color: var(--cx-text-primary, #dddddd) !important;
      border-color: var(--cx-input-border, #4a4a4a) !important;
    }
    @media (max-width: 1400px) { :root { --cx-display-scale: 0.92; } }
    @media (max-width: 1200px) { :root { --cx-display-scale: 0.85; } }
    @media (max-width: 1050px) { :root { --cx-display-scale: 0.76; } }
    @media (max-width: 950px)  {
      :root { --cx-display-scale: 0.62; }
      .connectea-row-wrapper { gap: 8px !important; }
      .connectea-panel { padding: 6px 10px !important; }
    }
    @media (max-width: 800px)  {
      :root { --cx-display-scale: 0.55; }
      .connectea-row-wrapper { gap: 6px !important; }
      .connectea-panel { padding: 5px 8px !important; }
    }
    @media (max-width: 650px)  {
      :root { --cx-display-scale: 0.48; }
      .connectea-row-wrapper { gap: 4px !important; }
      .connectea-panel { padding: 4px 6px !important; }
    }
  `;

  window.ConnectifyCohortStyles = styles;
})();
