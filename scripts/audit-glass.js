/**
 * Connectify theme audit: Liquid Glass transparency and blur
 *
 * measureGlass runs in the page and only measures: every painted layer's fill (element, gradient and opacity), the
 * fills stacked under it and its blur, plus what the theme asks for (--cx-surface-*, --cx-glass-blur). judgeGlass runs
 * in Node and decides, so the limits are tested without a browser. They come from the theme's own tokens, so both
 * presets and any Transparency / Blur Strength a custom theme picks are judged by what they set:
 * - GLASS_TOO_TRANSPARENT: a surface under the theme's lowest surface alpha, or blurring with no fill of its own.
 * - GLASS_TOO_OPAQUE: a surface over the theme's highest surface alpha, fills stacking past it, or a solid slab.
 * - GLASS_WITHOUT_BLUR: a translucent outermost surface with no blur (or blur(0)).
 * - GLASS_BLUR_TOO_WEAK / GLASS_TOO_BLURRY: another radius than the theme's (layers over text: the 12px floor token).
 * - NESTED_BACKDROP_BLUR: a blur under a backdrop root only sees that root, so it never reaches the page.
 * Dialogs that are solid by design must be opaque; content itself never takes filter: blur().
 */

'use strict';

const GLASS_THEMES = ['liquid-glass', 'liquid-glass-clear'];

const LIMITS = {
  tint: 0.12, // A fill up to this is a tint on a surface, not a surface (design_rules.md, one surface per block)
  alphaSlack: 0.1, // Beyond the theme's lowest and highest surface tokens
  solid: 0.95,
  blurSlack: 0.5,
  backdrop: [0.2, 0.85],
  wallpaperBlur: 2
};

// What each kind of layer must be. Outermost surfaces not named here are judged as soon as they paint more than a tint.
const ROLES = {
  solid: '.cx-goal-modal, #cx-customizer-modal > div, .cx-crop-dialog',
  backdrop: '.cx-goal-overlay, #cx-customizer-modal, #cx-wallpaper-crop, .v-window-modalitycurtain, .modal-backdrop, .yui3-widget-mask, .ui-widget-overlay, .cdk-overlay-dark-backdrop, .mat-drawer-backdrop, .eds-c-modal-overlay, .eds-c-overlay, .cvr-c-overlay, .cx-overlay',
  // The layers covering other text, as theme-overlay-blur.css lists them
  overlay: '#connectify-sidebar, #connectea-theme-menu, #connectea-outcome-tooltip, #cx-jump-subject-list, .cx-dates-filter-list, .cx-notification, .cvr-c-primary-navigation, .cvr-c-location-bar, .cvr-c-service-bar__container, .cvr-c-service-bar, .cvr-c-service-menu, .cvr-c-category-menu, .c-category-menu, .js-pos-category-toolbar-container::before, .v-popupview-popup, .modal-content, .ui-dialog, .mat-menu-panel, .mat-select-panel',
  surface: '.eds-c-tile, .cvr-c-tile, .c-tile, .eds-c-card, .cvr-c-card, mat-card, .mat-card'
};

// Controls, marks and labels are never glass surfaces: their fills are their meaning
// (the Weaknesses plot is dark by rule outside light tone, design_rules.md)
const NOT_SURFACES = '#connectify-radar-chart, button, a, input, select, textarea, option, [role="button"], [role="option"], [role="tab"], mat-chip, .mat-chip, .mat-progress-bar, mat-progress-bar, svg, .highcharts-container, ' +
  '.cvr-c-task__chart, .cx-compound-progress-container, .connectea-outcome-bar, .cx-goal-bars, .cx-goal-hbar, .cx-goal-tier, .card-scope, #cx-expand-progress, #cx-expand-btn, ' +
  '.eds-s-is-active, .v-selected, [aria-selected="true"], .mat-calendar-body-selected, .cx-progress-chart-tooltip, #cx-preview-tooltip, #connectea-theme-toggle';
const NOT_SURFACE_CLASS = /badge|avatar|^connect-(red|green|blue|purple|orange|yellow|grey|gray|teal|pink)|^cx-pred-pill|^cx-pred-scenario-card--|^cx-notification--|^cx-cat-/;

/** Runs in the page. scope: 'sidebar' (the drawer and any dialog it opened), 'page', or a selector (one layer). */
function measureGlass({ scope, roles, notSurfaces, notSurfaceClass, canvasTolerance = 3 }) {
  const notClass = new RegExp(notSurfaceClass);
  const color = str => {
    const srgb = String(str).match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\s*\)/i);
    if (srgb) return { r: srgb[1] * 255, g: srgb[2] * 255, b: srgb[3] * 255, a: srgb[4] === undefined ? 1 : Number(srgb[4]) };
    const rgb = String(str).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    return rgb ? { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) } : null;
  };
  const rootStyle = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  document.body.append(probe);
  const tokenColor = name => {
    const value = rootStyle.getPropertyValue(name).trim();
    if (!value) return null;
    probe.style.color = '';
    probe.style.color = value;
    return color(getComputedStyle(probe).color);
  };
  const surfaces = ['--cx-surface-bg', '--cx-card-bg', '--cx-surface-secondary', '--cx-surface-elevated', '--cx-nav-bg']
    .map(tokenColor).filter(Boolean).map(c => c.a);
  const canvas = tokenColor('--cx-canvas-bg');
  probe.remove();
  const hasWallpaper = document.documentElement.getAttribute('data-connectea-has-custom-bg') === 'true';
  const tokens = {
    surfaces,
    blur: parseFloat(rootStyle.getPropertyValue('--cx-glass-blur')),
    overlayBlur: parseFloat(rootStyle.getPropertyValue('--cx-glass-blur-overlay'))
  };

  const blurOf = value => {
    const match = String(value || 'none').match(/blur\(([\d.]+)px\)/);
    return match ? Number(match[1]) : 0;
  };
  const isCanvas = c => c && canvas && c.a >= 0.95 && ['r', 'g', 'b'].every(k => Math.abs(c[k] - canvas[k]) <= canvasTolerance);
  // Fill, gradient stops and opacity as one alpha; an opaque canvas fill is the page, not a surface, unless it hides a wallpaper
  function paintOf(cs) {
    const bg = color(cs.backgroundColor);
    const stops = String(cs.backgroundImage).includes('gradient')
      ? (String(cs.backgroundImage).match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) || []).map(s => color(s)?.a ?? 0) : [];
    const gradient = stops.length ? stops.reduce((a, b) => a + b, 0) / stops.length : 0;
    const opacity = parseFloat(cs.opacity);
    const canvasFill = isCanvas(bg) && !gradient && !hasWallpaper;
    const alpha = canvasFill ? 0 : (1 - (1 - (bg?.a || 0)) * (1 - gradient)) * (Number.isFinite(opacity) ? opacity : 1);
    return { alpha, opacity, blur: blurOf(cs.backdropFilter), hasBlur: cs.backdropFilter !== 'none' && Boolean(cs.backdropFilter), contentBlur: blurOf(cs.filter) };
  }
  const paints = new WeakMap();
  const paintOfEl = el => {
    if (!paints.has(el)) paints.set(el, paintOf(getComputedStyle(el)));
    return paints.get(el);
  };
  const inTopLayer = el => {
    try { return el.matches(':popover-open') || el.matches(':modal'); } catch { return false; }
  };
  const nameOf = (el, pseudo) => {
    if (el.id) return `#${el.id}${pseudo}`;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(c => c && !/^(ng-|v-)/.test(c)).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${pseudo}`;
  };
  const roleOf = (el, pseudo) => {
    for (const role of Object.keys(roles)) {
      const list = roles[role].split(',').map(s => s.trim()).filter(s => s.endsWith('::before') === (pseudo === '::before'));
      const plain = list.map(s => s.replace(/::before$/, '')).join(', ');
      if (plain && el.matches(plain)) return role;
    }
    return 'generic';
  };
  // A clear wrapper whose child fills it is one surface painted by the child (the service bar's container)
  const paintedByChild = (el, rect) => Array.from(el.querySelectorAll('*')).some(child => {
    const box = child.getBoundingClientRect();
    if (box.width < rect.width * 0.9 || box.height < rect.height * 0.9) return false;
    const paint = paintOfEl(child);
    return paint.alpha >= 0.05 || paint.hasBlur;
  });
  // Backdrop roots: a blur under any of these sees only what that ancestor painted (top-layer elements escape them)
  const makesBackdropRoot = cs => (cs.backdropFilter && cs.backdropFilter !== 'none') || (cs.filter && cs.filter !== 'none') || parseFloat(cs.opacity) < 1 ||
    (cs.mixBlendMode && cs.mixBlendMode !== 'normal') || (cs.clipPath && cs.clipPath !== 'none') || (cs.maskImage && cs.maskImage !== 'none');

  function walkUp(el, floats) {
    let keep = 1, nestedIn = null, backdropRoot = null;
    if (inTopLayer(el)) return { stackBelow: 0, nestedIn, backdropRoot, topLayer: true };
    for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (!backdropRoot && makesBackdropRoot(cs)) backdropRoot = nameOf(node, '');
      if (floats) continue;
      if (node.closest(notSurfaces)) continue;
      const paint = paintOfEl(node);
      if (paint.alpha >= 0.05 || paint.hasBlur) {
        if (!nestedIn) nestedIn = nameOf(node, '');
        keep *= 1 - paint.alpha;
      }
    }
    return { stackBelow: 1 - keep, nestedIn, backdropRoot, topLayer: false };
  }

  let elements;
  if (scope === 'page') {
    elements = Array.from(document.querySelectorAll('body *')).filter(el => !el.closest('#connectify-sidebar, #connectify-sidebar-handle'));
  } else if (scope === 'sidebar') {
    elements = ['#connectify-sidebar', '#connectify-sidebar-handle', '.cx-goal-overlay']
      .flatMap(sel => Array.from(document.querySelectorAll(sel)).flatMap(root => [root, ...root.querySelectorAll('*')]));
  } else {
    elements = Array.from(document.querySelectorAll(scope)).flatMap(root => [root, ...root.querySelectorAll('*')]);
  }

  const layers = [];
  for (const el of elements) {
    if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'IMG', 'VIDEO', 'CANVAS'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    if (el.closest(notSurfaces) || Array.from(el.classList || []).some(c => notClass.test(c)) || el.matches(':hover')) continue;
    const rect = el.getBoundingClientRect();
    for (const pseudo of ['', '::before', '::after']) {
      let box = rect, style = cs;
      if (pseudo) {
        style = getComputedStyle(el, pseudo);
        if (!style.content || style.content === 'none' || style.content === 'normal' || style.display === 'none') continue;
        box = { width: parseFloat(style.width) || 0, height: parseFloat(style.height) || 0 };
      }
      if (box.width < 80 || box.height < 20) continue;
      const paint = pseudo ? paintOf(style) : paintOfEl(el);
      const role = roleOf(el, pseudo);
      if (paint.contentBlur > 0 && !pseudo && (el.innerText || '').trim()) {
        layers.push({ selector: nameOf(el, pseudo), role: 'content', contentBlur: paint.contentBlur });
      }
      if (paint.alpha < 0.05 && !paint.hasBlur && role === 'generic') continue;
      const floats = style.position === 'fixed';
      const up = walkUp(el, floats);
      // A pseudo-element paints inside its own element
      if (pseudo && (paintOfEl(el).alpha >= 0.05 || paintOfEl(el).hasBlur)) up.nestedIn = up.nestedIn || nameOf(el, '');
      layers.push({
        selector: nameOf(el, pseudo), role, alpha: paint.alpha, stack: 1 - (1 - paint.alpha) * (1 - up.stackBelow),
        blur: paint.blur, hasBlur: paint.hasBlur, nestedIn: up.nestedIn, backdropRoot: up.backdropRoot, topLayer: up.topLayer,
        paintedByChild: !pseudo && paint.alpha < 0.05 && !paint.hasBlur && role !== 'generic' && paintedByChild(el, rect)
      });
    }
  }

  // The wallpaper is one layer under the page, blurred a fixed 2px (theme-wallpaper-layer.css)
  if (hasWallpaper) {
    const wall = getComputedStyle(document.documentElement, '::before');
    layers.push({ selector: 'html::before', role: 'wallpaper', contentBlur: blurOf(wall.filter) });
  }
  return { tokens, layers };
}

const round = v => Math.round(v * 100) / 100;
const pct = v => `${Math.round(v * 100)}%`;

/** Decides on measureGlass's result in Node: issues in the audit's format, one per kind of layer. */
function judgeGlass({ tokens, layers }, limits = LIMITS) {
  const alphas = tokens.surfaces || [];
  const lo = alphas.length ? Math.min(...alphas) : 0.3;
  const hi = alphas.length ? Math.max(...alphas) : 0.8;
  const minAlpha = Math.max(limits.tint, lo - limits.alphaSlack);
  const maxAlpha = hi + limits.alphaSlack;
  // Inside a surface one tint is allowed: fills stacking past the theme's highest surface plus a tint are a slab
  const maxStack = 1 - (1 - hi) * (1 - limits.tint);
  const blurFor = role => {
    const value = role === 'overlay' || role === 'backdrop' ? tokens.overlayBlur : tokens.blur;
    return Number.isFinite(value) ? value : 12;
  };

  const issues = new Map();
  const report = (type, selector, details) => {
    const key = `${type}:${selector}:${details}`;
    if (!issues.has(key)) issues.set(key, { category: 'STYLE', type, severity: 'HIGH', selector, details });
  };

  function judgeBlur(layer) {
    const want = blurFor(layer.role);
    if (!layer.hasBlur || layer.blur === 0) {
      report('GLASS_WITHOUT_BLUR', layer.selector, `Translucent layer (fill ${pct(layer.alpha)}) with no blur: the theme asks for ${want}px`);
    } else if (layer.blur < want - limits.blurSlack) {
      report('GLASS_BLUR_TOO_WEAK', layer.selector, `Blur ${round(layer.blur)}px under the theme's ${want}px`);
    } else if (layer.blur > want + limits.blurSlack) {
      report('GLASS_TOO_BLURRY', layer.selector, `Blur ${round(layer.blur)}px over the theme's ${want}px`);
    }
  }

  for (const layer of layers) {
    if (layer.role === 'content') {
      report('GLASS_TOO_BLURRY', layer.selector, `Content itself is blurred ${round(layer.contentBlur)}px: only backdrops blur`);
      continue;
    }
    if (layer.role === 'wallpaper') {
      if (layer.contentBlur !== limits.wallpaperBlur) report('GLASS_TOO_BLURRY', layer.selector, `Wallpaper blurred ${round(layer.contentBlur)}px, not ${limits.wallpaperBlur}px`);
      continue;
    }

    // A blur under a backdrop root never reaches the page, whatever its radius
    if (layer.hasBlur && layer.blur > 0 && layer.backdropRoot && !layer.topLayer) {
      report('NESTED_BACKDROP_BLUR', layer.selector, `backdrop-filter under ${layer.backdropRoot} only sees that layer: only the outermost surface blurs (or a top-layer popover)`);
    }

    if (layer.role === 'solid') {
      if (layer.alpha < limits.solid) report('GLASS_TOO_TRANSPARENT', layer.selector, `Solid dialog is ${pct(layer.alpha)} opaque: it must hide the page`);
      continue;
    }
    if (layer.role === 'backdrop') {
      const [min, max] = limits.backdrop;
      if (layer.alpha < min) report('GLASS_TOO_TRANSPARENT', layer.selector, `Dialog backdrop dims ${pct(layer.alpha)}, under ${pct(min)}`);
      if (layer.alpha > max) report('GLASS_TOO_OPAQUE', layer.selector, `Dialog backdrop dims ${pct(layer.alpha)}, over ${pct(max)}`);
      judgeBlur(layer);
      continue;
    }

    if (layer.nestedIn) {
      // Inside a surface: clear or a tint, and stacked fills must stay glass
      if (layer.alpha > limits.tint && layer.stack > maxStack) {
        report('GLASS_TOO_OPAQUE', layer.selector, `Fill ${pct(layer.alpha)} on ${layer.nestedIn} stacks to ${pct(layer.stack)}, over the theme's ${pct(hi)} surfaces`);
      }
      continue;
    }

    const paints = layer.alpha > limits.tint;
    const mustPaint = (layer.role === 'overlay' || layer.role === 'surface') && !layer.paintedByChild;
    if (paints && layer.alpha >= limits.solid && hi < limits.solid - limits.alphaSlack) {
      report('GLASS_TOO_OPAQUE', layer.selector, `Solid ${pct(layer.alpha)} surface in a theme whose surfaces are ${pct(lo)}-${pct(hi)}`);
    } else if (layer.alpha > maxAlpha) {
      report('GLASS_TOO_OPAQUE', layer.selector, `Fill ${pct(layer.alpha)} over the theme's ${pct(hi)} surfaces`);
    } else if ((paints || mustPaint) && layer.alpha < minAlpha) {
      report('GLASS_TOO_TRANSPARENT', layer.selector, `Fill ${pct(layer.alpha)} under the theme's ${pct(lo)} surfaces`);
    } else if (!paints && layer.hasBlur && layer.blur > 0) {
      report('GLASS_TOO_TRANSPARENT', layer.selector, `Blurs ${round(layer.blur)}px with a fill of only ${pct(layer.alpha)}: it shows as a band`);
    }
    if (paints && layer.alpha < limits.solid) judgeBlur(layer);
  }
  return Array.from(issues.values());
}

/** One theme's glass issues for a view. opts.scope: 'sidebar', 'page' or one layer's selector. */
async function auditGlass(page, scope) {
  const measured = await page.evaluate(measureGlass, { scope, roles: ROLES, notSurfaces: NOT_SURFACES, notSurfaceClass: NOT_SURFACE_CLASS.source });
  return judgeGlass(measured);
}

// Layers that exist only while open: each opened, measured and closed again on the page's first view
const FLOATING_LAYERS = [
  { open: '.connectea-theme-arrow', layer: '#connectea-theme-menu' },
  { open: '#cx-jump-subject-select', layer: '#cx-jump-subject-list' }
];

async function auditFloatingGlass(page) {
  const issues = [];
  // Each closes by its own button: Escape or a click elsewhere would also close a dialog the audit opened on the page
  const pressOpener = sel => page.evaluate((openSel, layerSel) => {
    const button = document.querySelector(openSel);
    if (!button) return false;
    button.click();
    const list = document.querySelector(layerSel);
    return Boolean(list && list.getBoundingClientRect().height > 0);
  }, sel.open, sel.layer).catch(() => false);
  for (const layer of FLOATING_LAYERS) {
    if (!await pressOpener(layer)) continue;
    await new Promise(r => setTimeout(r, 150));
    issues.push(...await auditGlass(page, layer.layer).catch(() => []));
    await pressOpener(layer);
  }
  return issues;
}

module.exports = { GLASS_THEMES, LIMITS, ROLES, FLOATING_LAYERS, measureGlass, judgeGlass, auditGlass, auditFloatingGlass };
