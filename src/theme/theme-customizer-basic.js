/**
 * Connectify Theme Customizer: Basic mode's plain words
 *
 * Basic mode's six colours named for what they paint, never for how the stylesheets call them, and the preview
 * tooltip in the same words: what the pointer is over and which of the six colours change it.
 * Exposes window.ConnectifyCustomizerBasic.
 */
(() => {
  'use strict';

  const TOKENS = [
    { key: 'canvas', label: 'Page Background' }, { key: 'surface', label: 'Cards and Panels' },
    { key: 'textPrimary', label: 'Text' }, { key: 'button', label: 'Buttons' },
    { key: 'border', label: 'Outlines' }, { key: 'accent', label: 'Highlights and Links' }
  ];

  // The Basic colour each Full token is derived from (theme-token-derive.js)
  const SOURCES = {
    canvasSubtle: 'canvas', inputBg: 'canvas',
    surfaceSecondary: 'surface', surfaceElevated: 'surface', surfaceHover: 'surface',
    borderSubtle: 'border', borderStrong: 'border', inputBorder: 'border',
    accentHover: 'accent',
    textSecondary: 'textPrimary', textMuted: 'textPrimary', tileLinkColor: 'textPrimary', buttonText: 'textPrimary',
    buttonHover: 'button'
  };

  // The preview's element names (data-cx-elem) that only make sense to someone who knows the tokens
  const ELEMENTS = {
    'Canvas Background': 'Page', 'Subtle Bar': 'Top Bar', 'Card Surface': 'Card', 'Elevated Badge': 'Badge',
    'Progress Track': 'Progress Bar', 'Progress Fill': 'Progress Bar', 'Accent Indicator': 'Progress Bar',
    'Secondary Text': 'Small Text', 'Muted Text': 'Small Text', 'Statistics Panel': 'Statistics', 'Highlighted Value': 'Statistics',
    'Hovered Row': 'Row Under the Pointer', 'Input Field': 'Search Box',
    'Action Button': 'Button', 'Button Hover': 'Button Under the Pointer'
  };

  const labelOf = key => TOKENS.find(t => t.key === (SOURCES[key] || key))?.label;

  /** The Basic colours behind a preview data-cx-text / data-cx-fill value, e.g. "--cx-border (border)". */
  const colorsIn = attr => [...String(attr || '').matchAll(/\((?:from )?(\w+)\)/g)].map(m => labelOf(m[1])).filter(Boolean);

  function tooltipHtml(elem, textAttr, fillAttr) {
    const esc = window.ConnectifyThemeColors.escapeHtml;
    const names = [...new Set([...colorsIn(textAttr), ...colorsIn(fillAttr)])];
    return `<div class="cx-tooltip-elem">${esc(ELEMENTS[elem] || elem)}</div>` +
      (names.length ? `<div class="cx-tooltip-plain">${names.length > 1 ? 'Colours' : 'Colour'}: ${esc(names.join(', '))}</div>` : '');
  }

  window.ConnectifyCustomizerBasic = { TOKENS, SOURCES, labelOf, colorsIn, tooltipHtml };
})();
