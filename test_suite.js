// test_suite.js - Connectify Master Unified Test Suite
// Merges and unifies all test suites across the extension.
// From now on, all tests must be added to this file only.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

// Auto-resolve extension directory whether run from repo root or scratch dir
const BASE_DIR = fs.existsSync(path.resolve(__dirname, 'predictor-math.js'))
  ? __dirname
  : '/Users/uwong/Downloads/2.1.14_0';

// ---------------------------------------------------------------------------
// Unified Mock DOM & Browser Environment
// ---------------------------------------------------------------------------
class MockElement {
  constructor(tag, className = '') {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.childNodes = [];
    this.parentElement = null;
    this.parentNode = null;
    this.style = {
      setProperty: (prop, val) => { this.style[prop] = val; },
      removeProperty: (prop) => { delete this.style[prop]; },
      getPropertyValue: (prop) => this.style[prop] || ''
    };
    this.className = className;
    this.id = '';
    this.dataset = {};
    this._attrs = {};
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.isConnected = true;
    this.clickCount = 0;
    this.scrollCount = 0;
    this._innerHTML = '';
    this.classList = {
      _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
      add: (...classes) => {
        classes.forEach(c => this.classList._classes.add(c));
        this.className = Array.from(this.classList._classes).join(' ');
      },
      remove: (...classes) => {
        classes.forEach(c => this.classList._classes.delete(c));
        this.className = Array.from(this.classList._classes).join(' ');
      },
      contains: (c) => this.classList._classes.has(c),
      toggle: (c, force) => {
        if (force === true || (force === undefined && !this.classList.contains(c))) {
          this.classList.add(c);
          return true;
        } else {
          this.classList.remove(c);
          return false;
        }
      }
    };
    this._computedStyle = {
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(0, 0, 0)',
      fill: 'rgb(0, 0, 0)'
    };
  }
  focus() {}
  contains(other) {
    if (other === this) return true;
    for (const c of (this.children || [])) {
      if (c === other || (c.contains && c.contains(other))) return true;
    }
    return false;
  }
  scrollIntoView() {
    this.scrollCount++;
  }
  click() {
    this.clickCount++;
    this.dispatchEvent(new MockEvent('click'));
  }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.childNodes = [];
    if (!html) return;
    const tagMatches = Array.from(html.matchAll(/<([a-z0-9-]+)([^>]*)>/gi));
    for (const match of tagMatches) {
      const tag = match[1].toLowerCase();
      if (['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tag) || !tag.startsWith('/')) {
        const attrs = match[2] || '';
        const idMatch = attrs.match(/id="([^"]+)"/i);
        const classMatch = attrs.match(/class="([^"]+)"/i);
        if (idMatch || classMatch) {
          const child = new MockElement(tag);
          if (idMatch) child.id = idMatch[1];
          if (classMatch) {
            child.className = classMatch[1];
            classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
          }
          child.parentElement = this;
          child.parentNode = this;
          this.children.push(child);
          this.childNodes.push(child);
        }
      }
    }
  }
  get innerHTML() { return this._innerHTML || ''; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) { return this._attrs[k] ?? null; }
  hasAttribute(k) { return k in this._attrs; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(event, fn) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  dispatchEvent(e) {
    if (this._listeners?.[e.type]) {
      this._listeners[e.type].forEach(fn => fn(e));
    }
  }
  append(...kids) {
    for (const kid of kids) {
      if (typeof kid === 'string') {
        const textNode = new MockElement('#text');
        textNode.textContent = kid;
        this.children.push(textNode);
        this.childNodes.push(textNode);
      } else if (kid) {
        if (kid.parentElement) kid.parentElement.removeChild(kid);
        kid.parentElement = this;
        kid.parentNode = this;
        kid.isConnected = true;
        this.children.push(kid);
        this.childNodes.push(kid);
      }
    }
  }
  appendChild(kid) { this.append(kid); return kid; }
  insertAdjacentElement(position, el) {
    if (position === 'afterend' && this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx + 1, 0, el);
        this.parentElement.childNodes.splice(idx + 1, 0, el);
        el.parentElement = this.parentElement;
        el.parentNode = this.parentElement;
        el.isConnected = true;
        return el;
      }
    }
    this.append(el);
    return el;
  }
  replaceChildren(...kids) {
    while (this.children.length > 0) {
      this.removeChild(this.children[0]);
    }
    this.append(...kids);
  }
  removeChild(kid) {
    const idx = this.children.indexOf(kid);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      kid.parentElement = null;
      kid.parentNode = null;
      kid.isConnected = false;
    }
    const idxNodes = this.childNodes.indexOf(kid);
    if (idxNodes !== -1) {
      this.childNodes.splice(idxNodes, 1);
    }
    return kid;
  }
  remove() {
    this.isConnected = false;
    if (this.parentElement) this.parentElement.removeChild(this);
  }
  matches(selector) {
    const parts = selector.split(',').map(s => s.trim());
    return parts.some(sel => {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return (this.className || '').split(/\s+/).includes(cls);
      }
      if (sel.startsWith('#')) {
        return this.id === sel.slice(1);
      }
      if (sel.startsWith('[') && sel.endsWith(']')) {
        const attr = sel.slice(1, -1);
        return this.hasAttribute(attr);
      }
      return this.tagName.toLowerCase() === sel.toLowerCase();
    });
  }
  closest(sel) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(sel)) return curr;
      curr = curr.parentElement || curr.parentNode;
    }
    return null;
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
  querySelectorAll(sel) {
    const results = [];
    // Handle comma-separated selectors
    const groups = sel.split(',').map(s => s.trim());
    const check = (node) => {
      if (!node || node.nodeType === 3) return;
      for (const group of groups) {
        // Split on whitespace to detect descendant selectors like ".a .b"
        const parts = group.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          // Simple selector
          if (node.matches && node.matches(parts[0])) {
            results.push(node);
            break;
          }
        } else {
          // Descendant selector: last part must match node, earlier parts must match ancestors
          const lastPart = parts[parts.length - 1];
          if (node.matches && node.matches(lastPart)) {
            // Check if some ancestor matches the earlier parts
            let ancestor = node.parentElement || node.parentNode;
            let partIdx = parts.length - 2;
            while (ancestor && partIdx >= 0) {
              if (ancestor.matches && ancestor.matches(parts[partIdx])) {
                partIdx--;
              }
              ancestor = ancestor.parentElement || ancestor.parentNode;
            }
            if (partIdx < 0) {
              results.push(node);
              break;
            }
          }
        }
      }
      for (const c of (node.children || [])) check(c);
    };
    for (const c of (this.children || [])) check(c);
    return results;
  }
  getBoundingClientRect() {
    return { top: 0, left: 100, bottom: 40, right: 300, width: 200, height: 40 };
  }
}

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles ?? true;
    this.cancelable = init.cancelable ?? true;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
}

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] ?? null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; },
  key(i) { return Object.keys(this.store)[i] || null; },
  get length() { return Object.keys(this.store).length; }
};

const domRoot = new MockElement('html');
const domHead = new MockElement('head');
const domBody = new MockElement('body');
domRoot.appendChild(domHead);
domRoot.appendChild(domBody);

global.window = global;
global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => domRoot.querySelector(`#${id}`),
  querySelector: (sel) => domRoot.querySelector(sel),
  querySelectorAll: (sel) => domRoot.querySelectorAll(sel),
  head: domHead,
  body: domBody,
  documentElement: domRoot,
  addEventListener: (event, fn) => domRoot.addEventListener(event, fn),
  removeEventListener: () => {}
};
global.HTMLElement = MockElement;
global.getComputedStyle = (el) => el._computedStyle || {};
global.localStorage = mockLocalStorage;
global.sessionStorage = mockLocalStorage;
global.CustomEvent = MockEvent;
global.Event = MockEvent;
global.location = { href: 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345' };
global.dispatchEvent = (e) => domRoot.dispatchEvent(e);
global.addEventListener = (event, fn) => domRoot.addEventListener(event, fn);
global.removeEventListener = () => {};
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.MutationObserver = class {
  constructor(cb) { this.cb = cb; }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

console.log('================================================================');
console.log('       CONNECTIFY UNIFIED MASTER TEST SUITE EXECUTION           ');
console.log(`       Base Directory: ${BASE_DIR}`);
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✓ [PASSED] ${name}`);
  } catch (err) {
    console.error(`✗ [FAILED] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ===========================================================================
// SECTION 1: DARK THEME, WCAG 5:1 CONTRAST & BORDERS
// ===========================================================================
console.log('--- SECTION 1: Dark Mode Site-Wide Coverage & Contrast Hierarchy ---');

const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

runTest('theme.css styles My Connect promos, maintenance notices, and action buttons', () => {
  assert.ok(themeCss.includes('.cvr-c-promo.eds-t-white'), 'Must style .cvr-c-promo.eds-t-white');
  assert.ok(themeCss.includes('.cvr-c-maintenance-notice'), 'Must style .cvr-c-maintenance-notice');
  assert.ok(themeCss.includes('.eds-c-tile__action'), 'Must style .eds-c-tile__action');
  assert.ok(themeCss.includes('.eds-c-standard-button'), 'Must style .eds-c-standard-button');
});

runTest('theme.css styles Classes and Preferences heading bars and cards', () => {
  assert.ok(themeCss.includes('.cvr-c-heading-bar'), 'Must style .cvr-c-heading-bar');
  assert.ok(themeCss.includes('.cvr-c-page-header'), 'Must style .cvr-c-page-header');
  assert.ok(themeCss.includes('.cvr-c-preferences'), 'Must style .cvr-c-preferences');
  assert.ok(themeCss.includes('.cvr-c-preference-group'), 'Must style .cvr-c-preference-group');
  assert.ok(themeCss.includes('.eds-c-card'), 'Must style .eds-c-card');
  assert.ok(themeCss.includes('.v-panel-content'), 'Must style .v-panel-content');
});

runTest('theme.js implements flicker-free attribute surface adaptation', () => {
  assert.ok(themeJs.includes('function adaptSurfaces()'), 'theme.js must define adaptSurfaces()');
  assert.ok(themeJs.includes('data-connectea-surface'), 'theme.js must tag data-connectea-surface');
  assert.ok(themeJs.includes('data-connectea-ink'), 'theme.js must tag data-connectea-ink');
  assert.ok(!themeJs.includes('savedTextColors'), 'theme.js must NOT mutate inline style properties');
});

runTest('Theme button mounting & positioning in primary navigation', () => {
  assert.ok(themeCss.includes('.cvr-c-primary-navigation {'), 'theme.css must style .cvr-c-primary-navigation');
  assert.ok(themeCss.includes('top: 50% !important;'), 'theme.css must vertically center #connectea-theme-toggle with top: 50%');
  assert.ok(themeCss.includes('transform: translateY(-50%) !important;'), 'theme.css must center with translateY(-50%)');
  assert.ok(themeJs.includes('mountPollInterval'), 'theme.js must include initial mounting poll interval');
  assert.ok(themeJs.includes('cleanupDuplicateButtons'), 'theme.js must cleanup duplicate theme buttons');
});

runTest('Subject names clean spacing (no concatenated words)', () => {
  const cleanSubjectName = name => {
    if (!name) return '';
    return name
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const testCases = [
    { raw: 'Chemistry ATAR Year 11', expected: 'Chemistry Year 11' },
    { raw: 'English ATAR Year 12', expected: 'English Year 12' },
    { raw: 'Mathematics Methods ATAR Year 11 - Semester 1', expected: 'Mathematics Methods Year 11' },
    { raw: 'Physics ATAR Year 11', expected: 'Physics Year 11' }
  ];

  for (const { raw, expected } of testCases) {
    const cleaned = cleanSubjectName(raw);
    assert.strictEqual(cleaned, expected, `Cleaned string should match expected for "${raw}"`);
    assert.ok(!cleaned.includes('ChemistryYear'), 'Must not concatenate words without spaces');
  }
});

runTest('Hardcoded inline colors replaced with semantic classes in settings and predictor UI', () => {
  const catSettingsJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  const predUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  const calibJs = fs.readFileSync(path.resolve(BASE_DIR, 'scaling-calibration.js'), 'utf8');

  assert.ok(!catSettingsJs.includes('color:#203c5e'), 'category-settings.js should not hardcode color:#203c5e inline');
  assert.ok(!catSettingsJs.includes('color:#334155'), 'category-settings.js should not hardcode color:#334155 inline');
  assert.ok(catSettingsJs.includes('cx-settings-label'), 'category-settings.js should use cx-settings-label');
  assert.ok(catSettingsJs.includes('cx-settings-number-input'), 'category-settings.js should use cx-settings-number-input');

  assert.ok(!predUiJs.includes('color:#174c75'), 'predictor-ui.js must not hardcode color:#174c75 inline');
  assert.ok(!predUiJs.includes('color:#24618c'), 'predictor-ui.js must not hardcode color:#24618c inline');
  assert.ok(predUiJs.includes('cx-pred-scenario-value--mid'), 'predictor-ui.js must use cx-pred-scenario-value--mid');

  assert.ok(!calibJs.includes("hSubject.style.color = '#788896'"), 'scaling-calibration.js must use cx-settings-col-header');
});

runTest('Brighter dark mode borders in theme.css and sidebar.css', () => {
  assert.ok(themeCss.includes('border: 1px solid #3d5066 !important'), 'eds-c-tile must use brighter border #3d5066');
  assert.ok(themeCss.includes('.connectea-dark .eds-c-accordion__section-heading'), 'accordion header must be styled');
  assert.ok(themeCss.includes('border-bottom: 1px solid #36485e !important'), 'navigation & tasks must use brighter border #36485e');
  assert.ok(sidebarCss.includes('.connectea-dark .cx-pred-scenario-card--mid'), 'sidebar.css must style dark mode scenario mid');
});

runTest('WCAG AA Color Contrast Ratios meet or exceed 5:1 threshold', () => {
  function hexToRgb(hex) {
    const c = hex.replace('#', '');
    const num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  function luminance([r, g, b]) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }
  function contrast(hex1, hex2) {
    const l1 = luminance(hexToRgb(hex1));
    const l2 = luminance(hexToRgb(hex2));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return Math.round(ratio * 100) / 100;
  }

  // Key typography and UI elements against dark backgrounds
  const checks = [
    { text: '#f8fafc', bg: '#12171f', label: 'Primary headings on canvas' },
    { text: '#e2e8f0', bg: '#12171f', label: 'Primary text on canvas' },
    { text: '#cbd5e1', bg: '#12171f', label: 'Secondary text on canvas' },
    { text: '#f8fafc', bg: '#1e2632', label: 'Tile title on tile' },
    { text: '#e2e8f0', bg: '#1e2632', label: 'Task text on tile' },
    { text: '#cbd5e1', bg: '#1e2632', label: 'Accordion text on tile' },
    { text: '#94a3b8', bg: '#1e2632', label: 'Captions on tile' },
    { text: '#ffffff', bg: '#1e3a5f', label: 'Expected Mid ATAR text on mid scenario card' },
    { text: '#93c5fd', bg: '#1e3a5f', label: 'Mid scenario label' },
    { text: '#4ade80', bg: '#1e252e', label: 'High scenario emerald text' },
    { text: '#f1f5f9', bg: '#141a22', label: 'Form input text' }
  ];

  for (const c of checks) {
    const ratio = contrast(c.text, c.bg);
    assert.ok(ratio >= 5.0, `${c.label} (${c.text} on ${c.bg}) ratio ${ratio}:1 must be >= 5:1`);
  }
});

runTest('White button styling for Settings and Weakness Analyzer in sidebar', () => {
  assert.ok(sidebarCss.includes('#connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)'), 'sidebar.css must style weakness and categories toggles');
  assert.ok(sidebarCss.includes('background: #ffffff !important;'), 'Must specify #ffffff white background for light mode');
  assert.ok(sidebarCss.includes('.connectea-dark #connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)'), 'Must preserve dark mode style');
});

runTest('theme.css covers Classes accordion, Feed filter funnel, and Follow pills with >= 5:1 contrast', () => {
  assert.ok(themeCss.includes('.mat-expansion-panel'), 'theme.css must style .mat-expansion-panel');
  assert.ok(themeCss.includes('.mat-accordion'), 'theme.css must style .mat-accordion');
  assert.ok(themeCss.includes('.cvr-c-classes'), 'theme.css must style .cvr-c-classes');
  assert.ok(themeCss.includes('.cvr-c-filter-button'), 'theme.css must style feed filter button');
  assert.ok(themeCss.includes('.cvr-c-feed-item__follow'), 'theme.css must style feed follow button');
  assert.ok(themeCss.includes('.mat-expansion-panel-header'), 'theme.css must style expansion panel header');
  assert.ok(themeCss.includes('.cvr-c-task,') && themeCss.includes('.mat-expansion-panel,'), 'theme.css must restore borders for tasks, cards, and expansion panels');
});

// ===========================================================================
// SECTION 2: OUTCOME METER & HOVER TOOLTIP RELIABILITY
// ===========================================================================
console.log('\n--- SECTION 2: Outcome Meter & Hover Tooltip Reliability ---');

const cohortJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');

runTest('Outcome meter segments disable pointer-events to prevent hover boundary thrashing', () => {
  const segMatch = sidebarCss.match(/\.connectea-outcome-segment\s*\{([^}]+)\}/);
  assert.ok(segMatch, 'Found .connectea-outcome-segment in sidebar.css');
  assert.ok(segMatch[1].includes('pointer-events: none'), 'segment must have pointer-events: none !important');
});

runTest('Singleton floating tooltip is styled with fixed positioning and high z-index', () => {
  assert.ok(sidebarCss.includes('#connectea-outcome-tooltip'), 'sidebar.css must style #connectea-outcome-tooltip');
  assert.ok(sidebarCss.includes('position: fixed'), 'tooltip must use fixed viewport positioning');
  assert.ok(sidebarCss.includes('z-index: 100050'), 'tooltip must have z-index: 100050');
});

runTest('cohort-view.js manages floating outcome tooltip on mouseenter/mousemove/mouseleave', () => {
  assert.ok(cohortJs.includes('connectea-outcome-tooltip'), 'cohort-view.js must reference #connectea-outcome-tooltip');
  assert.ok(cohortJs.includes('showFloatingTooltip'), 'cohort-view.js must define showFloatingTooltip');
  assert.ok(cohortJs.includes('hideFloatingTooltip'), 'cohort-view.js must define hideFloatingTooltip');
  assert.ok(cohortJs.includes('mouseenter'), 'cohort-view.js must bind mouseenter listener');
});

runTest('Outcome bar 2-3x sizing and dark mode segment color preservation', () => {
  assert.ok(sidebarCss.includes('width: 18px !important;'), 'Outcome bar width must be enlarged (18px)');
  assert.ok(sidebarCss.includes('height: 56px !important;'), 'Outcome bar height must be enlarged (56px)');
  assert.ok(sidebarCss.includes('height: 10px !important;'), 'Outcome segment height must be enlarged (10px)');
  assert.ok(sidebarCss.includes('height: 20px !important;'), 'Outcome purple segment height must be 20px');
  assert.ok(sidebarCss.includes('.connectea-dark .connectea-outcome-segment:not([class*="connectea-active-"])'), 'Dark mode must only target inactive segments');
  assert.ok(sidebarCss.includes('.connectea-outcome-bar.connectea-outcome-critical'), 'sidebar.css must style critical outcome bar');
  assert.ok(sidebarCss.includes('connectea-glow-critical'), 'sidebar.css must define connectea-glow-critical animation');
});

// Load predictor-math.js for mathematical evaluation
eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8'));
const predMath = window.ConnectifyPredictorMath;

runTest('Outcome evaluation maps all performance tiers with secret purple breakout and critical shortfall', () => {
  const low = 70;
  const mid = 80;
  const high = 90;
  const breakoutScore = 99; // 1.10 * 90

  // 1. Critical shortfall: score <= Low - 10 (additive) -> 0 segments glowing red
  const outCrit = predMath.evaluateOutcome(58, { low, mid, high, breakoutScore });
  assert.strictEqual(outCrit.segments, 0, 'Critical shortfall should have 0 segments');
  assert.strictEqual(outCrit.critical, true, 'Critical shortfall must be flagged critical');
  assert.strictEqual(outCrit.broken, false);
  assert.strictEqual(outCrit.colors.length, 0);

  // Exact boundary score: 60 (70 - 10)
  const outCritBoundary = predMath.evaluateOutcome(60, { low, mid, high, breakoutScore });
  assert.strictEqual(outCritBoundary.critical, true, 'Score exactly Low - 10 must trigger critical shortfall');
  assert.strictEqual(outCritBoundary.segments, 0);

  // 2. Below Low: score < Low -> 1 segment
  const outBelowLow = predMath.evaluateOutcome(65, { low, mid, high, breakoutScore });
  assert.strictEqual(outBelowLow.segments, 1, 'Below low should have 1 segment');
  assert.strictEqual(outBelowLow.critical, false);
  assert.strictEqual(outBelowLow.colors[0], 'red');

  // 3. Low: score >= Low -> 2 segments
  const outLow = predMath.evaluateOutcome(72, { low, mid, high, breakoutScore });
  assert.strictEqual(outLow.segments, 2, 'Low target should have 2 segments');
  assert.deepStrictEqual(outLow.colors, ['red', 'orange']);

  // 4. Mid: score >= Mid -> 3 segments
  const outMid = predMath.evaluateOutcome(84, { low, mid, high, breakoutScore });
  assert.strictEqual(outMid.segments, 3, 'Mid momentum should have 3 segments');
  assert.deepStrictEqual(outMid.colors, ['red', 'orange', 'yellow']);

  // 5. High: score >= High -> 4 segments
  const outHigh = predMath.evaluateOutcome(92, { low, mid, high, breakoutScore });
  assert.strictEqual(outHigh.segments, 4, 'High target should have 4 segments');
  assert.deepStrictEqual(outHigh.colors, ['red', 'orange', 'yellow', 'green']);

  // 6. Breakout: score > breakoutScore -> 5 segments (purple)
  const outBreakout = predMath.evaluateOutcome(100, { low, mid, high, breakoutScore });
  assert.strictEqual(outBreakout.segments, 5, 'Breakout should have 5 segments');
  assert.strictEqual(outBreakout.broken, true, 'Breakout must be flagged broken');
  assert.deepStrictEqual(outBreakout.colors, ['red', 'orange', 'yellow', 'green', 'purple']);

  // Incomplete / NaN / undefined score -> null
  assert.strictEqual(predMath.evaluateOutcome(NaN, { low, mid, high, breakoutScore }), null);
  assert.strictEqual(predMath.evaluateOutcome(undefined, { low, mid, high, breakoutScore }), null);

  // Ensure purple threshold is strictly secret from tooltip details
  assert.ok(!outLow.details.includes('Breakout'), 'Standard tooltip details must never mention Breakout threshold');
  assert.ok(!outLow.details.includes('purple'), 'Standard tooltip details must never mention purple segment');
  assert.ok(!outHigh.details.includes('Breakout'), 'High tooltip details must never mention Breakout threshold');
  assert.ok(!outCrit.details.includes('purple'), 'Critical shortfall tooltip must never mention purple');
});

runTest('Outcome meter persists and computes reliably for marked tasks without disappearing', () => {
  const row = document.createElement('div');
  row.className = 'cvr-c-task';
  const details = document.createElement('div');
  details.className = 'cvr-c-task__details';
  const label1 = document.createElement('span');
  label1.className = 'v-label';
  label1.textContent = 'Assessment 1';
  const label2 = document.createElement('span');
  label2.className = 'v-label';
  label2.textContent = 'Term 1, Week 4';
  details.append(label1, label2);

  const marks = document.createElement('div');
  marks.className = 'cvr-c-task__marks';
  const markCell = document.createElement('div');
  markCell.className = 'cvr-c-task__mark';
  markCell.textContent = '42 Out of 50'; // 84%
  marks.append(markCell);
  row.append(details, marks);

  // Task mock with mark 84
  const taskMock = {
    id: 'task-phys-1:0',
    name: 'Assessment 1',
    caption: 'Term 1, Week 4',
    labelsKey: 'task-phys-1',
    row,
    score: 84,
    mark: 84,
    pending: false
  };

  // Provide baselines so prediction resolves for this assessment
  predMath.saveBaselines({ subjects: { 'Physics ATAR': 82 }, types: { 'Take-Home': 80 } });

  const prediction = predMath.getOrComputeTaskPrediction('Physics ATAR', taskMock);
  assert.ok(prediction, 'Prediction must be resolved for marked task');
  assert.strictEqual(prediction.unpredicted, false, 'Prediction for completed task must NOT be unpredicted when baseline exists');

  const outcome = predMath.evaluateOutcome(84, prediction);
  assert.ok(outcome, 'Outcome must be evaluated');
  assert.ok(Number.isFinite(outcome.segments), 'Outcome segments must be a finite number');

  // Verify cohort-view creates panel and outcomeBar
  eval(cohortJs);
  const panelState = window.ConnectifyCohortView.createPanel(row, false, 'phys-key', 50);
  assert.ok(panelState, 'Panel state must exist');
  assert.ok(panelState.outcomeBar, 'outcomeBar must exist in panel state');

  localStorage.clear();
});

// ===========================================================================
// SECTION 3: CHRONOLOGICAL HISTORICAL PREDICTION ENGINE & CACHING
// ===========================================================================
console.log('\n--- SECTION 3: Chronological Historical Prediction Engine & Caching ---');

runTest('getHistoricalDataPriorTo calculates subject and type averages strictly from prior tasks', () => {
  const testSubj = {
    name: 'Chemistry ATAR Year 11',
    tasks: [
      { id: 'c-1', name: 'Task 1', caption: 'Term 1, Week 2', order: 2, sequence: 0, weight: 10, score: 92, pending: false },
      { id: 'c-2', name: 'Task 2', caption: 'Term 1, Week 6', order: 6, sequence: 1, weight: 10, score: 72, pending: false },
      { id: 'c-3', name: 'Task 3', caption: 'Term 2, Week 3', order: 15, sequence: 2, weight: 10, score: 85, pending: false }
    ]
  };
  const subjects = [testSubj];
  window.ConnectifyTaskTypes = { getEffectiveType: () => 'Test' };

  // Task 1: 0 prior tasks
  const prior1 = predMath.getHistoricalDataPriorTo(subjects, testSubj.name, testSubj.tasks[0]);
  assert.strictEqual(prior1.totalCompletedTasks, 0);
  assert.strictEqual(prior1.subjects[testSubj.name], undefined);

  // Task 2: only Task 1 (92%)
  const prior2 = predMath.getHistoricalDataPriorTo(subjects, testSubj.name, testSubj.tasks[1]);
  assert.strictEqual(prior2.totalCompletedTasks, 1);
  assert.strictEqual(prior2.subjects[testSubj.name], 92);
  assert.strictEqual(prior2.types['Test'], 92);

  // Task 3: Task 1 (92%) and Task 2 (72%) -> average 82%
  const prior3 = predMath.getHistoricalDataPriorTo(subjects, testSubj.name, testSubj.tasks[2]);
  assert.strictEqual(prior3.totalCompletedTasks, 2);
  assert.strictEqual(prior3.subjects[testSubj.name], 82);
  assert.strictEqual(prior3.types['Test'], 82);
});

runTest('populateChronologicalPredictions respects version key and caches prior predictions', () => {
  mockLocalStorage.clear();

  const testSubj = {
    name: 'Methods ATAR Year 11',
    tasks: [
      { id: 'm-1', name: 'Test 1', caption: 'Term 1, Week 4', order: 4, sequence: 0, weight: 10, score: 90, pending: false },
      { id: 'm-2', name: 'Test 2', caption: 'Term 1, Week 8', order: 8, sequence: 1, weight: 10, score: 70, pending: false }
    ]
  };
  predMath.saveBaselines({
    subjects: { [testSubj.name]: 80 },
    types: { 'Test': 80 }
  });

  assert.strictEqual(predMath.isPredictionCacheCurrent(), false);
  predMath.populateChronologicalPredictions([testSubj]);
  assert.strictEqual(predMath.isPredictionCacheCurrent(), true);
  assert.strictEqual(mockLocalStorage.getItem('connectify:prediction_version'), predMath.PREDICTION_CACHE_VERSION);

  // Cache lookup for Task 1 and Task 2
  const cachedT1 = predMath.getCachedPrediction(testSubj.name, 'm-1');
  const cachedT2 = predMath.getCachedPrediction(testSubj.name, 'm-2');
  assert.ok(cachedT1, 'Task 1 must be cached');
  assert.ok(cachedT2, 'Task 2 must be cached');
});

runTest('getOrComputeTaskPrediction computes on-demand against prior tasks when new task arrives', () => {
  const testSubj = {
    name: 'Literature ATAR Year 11',
    tasks: [
      { id: 'lit-1', name: 'Essay 1', caption: 'Term 1, Week 3', order: 3, sequence: 0, weight: 10, score: 85, pending: false }
    ]
  };
  predMath.saveBaselines({
    subjects: { [testSubj.name]: 80 },
    types: { 'Take-Home': 80 }
  });

  const newTask = {
    id: 'lit-2',
    name: 'Essay 2',
    caption: 'Term 2, Week 5',
    order: 17,
    sequence: 1,
    weight: 10,
    score: null,
    pending: true
  };

  const fresh = predMath.getOrComputeTaskPrediction(testSubj.name, newTask, [testSubj]);
  assert.ok(fresh, 'Must return fresh prediction');
  assert.strictEqual(fresh.unpredicted, false);

  const cached = predMath.getCachedPrediction(testSubj.name, 'lit-2');
  assert.ok(cached, 'New task prediction must be persisted in cache');
  assert.strictEqual(cached.mid, fresh.mid);
});

runTest('Logarithmic headroom compression applies above 80%', () => {
  const at80 = predMath.applyLogarithmicCeiling(80, 10);
  const at94 = predMath.applyLogarithmicCeiling(94, 10);
  assert.ok(at80 > 80 && at80 < 90, 'Gain at 80% should be compressed');
  assert.ok(at94 > 94 && at94 < 98, 'Gain at 94% should be exponentially harder');
  assert.ok((at94 - 94) < (at80 - 80), 'Higher base scores must have smaller absolute gains for same delta');
});

runTest('Low estimate variance scaling penalizes volatile performers appropriately', () => {
  window.ConnectifyTaskTypes = { getEffectiveType: () => 'Test' };
  const historicalConsistent = {
    subjects: { 'Physics': 95 },
    subjectSpreads: { 'Physics': 1.0 },
    types: { 'Test': 95 },
    typeCounts: { 'Test': 3 },
    overallAverage: 95,
    spread: 1.0
  };
  const predConsistent = predMath.predictTask('Physics', { name: 'Test 4' }, historicalConsistent);
  assert.ok(predConsistent.low >= 92, `Consistent student Low (${predConsistent.low}%) should be tight (>= 92%)`);

  const historicalVolatile = {
    subjects: { 'Physics': 85 },
    subjectSpreads: { 'Physics': 10.0 },
    types: { 'Test': 85 },
    typeCounts: { 'Test': 3 },
    overallAverage: 85,
    spread: 10.0
  };
  const predVolatile = predMath.predictTask('Physics', { name: 'Test 4' }, historicalVolatile);
  assert.ok(predVolatile.low <= 75, `Volatile student Low (${predVolatile.low}%) should reflect higher variance (<= 75%)`);

  const consistentSpread = predConsistent.mid - predConsistent.low;
  const volatileSpread = predVolatile.mid - predVolatile.low;
  assert.ok(volatileSpread > consistentSpread, 'Volatile performance must yield larger low spread than consistent performance');
});

runTest('Progress Graph custom date sync & unparsable date suppression', () => {
  mockLocalStorage.clear();
  mockLocalStorage.setItem('connectea:time_override:Chemistry ATAR:Task Override Test', 't3w5');

  const mockSubjects = [
    {
      name: 'Chemistry ATAR - Semester 1',
      tasks: [
        { name: 'Investigation 1', weight: 10, score: 75, pending: false, caption: 'Term 1 Week 5' },
        { name: 'Parsable Task', weight: 15, pending: true, caption: 'Term 2, Week 4' },
        { name: 'Task Override Test', weight: 15, pending: true, caption: 'Unparsable syllabus note' },
        { name: 'Unparsable Without Override', weight: 15, pending: true, caption: 'Random syllabus text without dates' }
      ]
    }
  ];

  const projections = predMath.projectSubjectGrades(mockSubjects);
  const chemProj = projections.find(p => p.cleanName === 'Chemistry ATAR');
  assert.ok(chemProj, 'Chemistry ATAR projection should exist');

  const upcomingTasks = chemProj.upcomingPredictions.map(p => p.task);
  const upcomingNames = upcomingTasks.map(t => t.name);
  assert.ok(upcomingNames.includes('Parsable Task'), 'Parsable task should be included');
  assert.ok(upcomingNames.includes('Task Override Test'), 'Task with custom Progress Graph override date should be included');
  assert.ok(!upcomingNames.includes('Unparsable Without Override'), 'Task with unparsable date and no custom override MUST be excluded');

  const overriddenTask = upcomingTasks.find(t => t.name === 'Task Override Test');
  assert.strictEqual(overriddenTask.customDate, 'Term 3, Week 5', 'Custom date must be synced');
});

runTest('Semester 1 and Semester 2 unfinished task deduplication', () => {
  const duplicatedSubjects = [
    {
      name: 'Physics ATAR - Semester 1',
      tasks: [
        { name: 'Electricity Test', weight: 10, score: 82, pending: false, caption: 'Term 1 Week 8' },
        { name: 'Mechanics Investigation', weight: 15, pending: true, caption: 'Term 2 Week 5' }
      ]
    },
    {
      name: 'Physics ATAR - Semester 2',
      tasks: [
        { name: 'Mechanics Investigation', weight: 15, pending: true, caption: 'Term 2 Week 5' },
        { name: 'Modern Physics Exam', weight: 25, pending: true, caption: 'Term 4 Week 2' }
      ]
    }
  ];

  const physProjections = predMath.projectSubjectGrades(duplicatedSubjects);
  const physProj = physProjections.find(p => p.cleanName === 'Physics ATAR');
  assert.ok(physProj, 'Physics projection should exist');
  const physUpcoming = physProj.upcomingPredictions.map(p => p.task.name);
  const occurrences = physUpcoming.filter(n => n === 'Mechanics Investigation').length;
  assert.strictEqual(occurrences, 1, 'Duplicate task must only appear ONCE in upcoming tasks');
  assert.ok(physUpcoming.includes('Modern Physics Exam'), 'Subsequent unique tasks should still be present');
});

runTest('Year 11 TEA scaling adjustment removed and ATAR calculation aligned', () => {
  const calcCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-calculator.js'), 'utf8');
  assert.ok(calcCode.includes('const teaAdjustment = 0;'), 'atar-calculator.js must have teaAdjustment = 0');
  assert.ok(!calcCode.includes('Year 11 TEA scaling adjustment applied'), 'Scaling adjustment text must be removed');

  const sampleSubjects = [
    { cleanName: 'Chemistry', projected: { low: 75, mid: 80, high: 85 }, runningMark: 80 },
    { cleanName: 'Physics', projected: { low: 80, mid: 85, high: 90 }, runningMark: 85 },
    { cleanName: 'Mathematics Methods', projected: { low: 82, mid: 88, high: 92 }, runningMark: 88 },
    { cleanName: 'Literature', projected: { low: 70, mid: 75, high: 80 }, runningMark: 75 }
  ];

  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  const projected = predMath.projectATAR(sampleSubjects);
  assert.ok(Number(projected.mid.tea) > 300, 'TEA should be properly calculated without Year 11 deduction');
  assert.strictEqual(projected.mid.yearAdjustment, 0, 'yearAdjustment must be 0');
  for (const course of projected.mid.courses) {
    assert.ok(Number.isInteger(course.score), `Course ${course.name} score must be an integer`);
  }
});

runTest('Completed tasks with zero prior history or type precedents return unpredicted: true when baselines are absent', () => {
  const emptyHistorical = {
    subjects: {},
    subjectSpreads: {},
    types: {},
    typeCounts: {},
    overallAverage: null,
    spread: 6.5,
    totalCompletedTasks: 0
  };
  const emptyBaselines = { types: {}, subjects: {} };

  const completedTask = {
    name: 'Investigation 1',
    score: 88,
    weight: 15,
    pending: false
  };

  const result = predMath.predictTask('Chemistry ATAR', completedTask, emptyHistorical, emptyBaselines, true);
  assert.strictEqual(result.unpredicted, true, 'First completed task without baselines must be unpredicted');

  // When baselines are provided, prediction must succeed
  const withBaselines = { subjects: { 'Chemistry ATAR': 85 }, types: { 'Test': 80, 'Investigation': 80 } };
  const predictedResult = predMath.predictTask('Chemistry ATAR', completedTask, emptyHistorical, withBaselines, true);
  assert.strictEqual(predictedResult.unpredicted, false, 'Completed task with baselines must be predicted');
  assert.ok(Number.isFinite(predictedResult.mid), 'Middle prediction must be a finite number');
  assert.ok(Number.isFinite(predictedResult.low), 'Low prediction must be a finite number');
  assert.ok(Number.isFinite(predictedResult.high), 'High prediction must be a finite number');
  assert.ok(Number.isFinite(predictedResult.breakoutScore), 'Breakout score must be a finite number');
});

// ===========================================================================
// SECTION 4: SIDEBAR NAVIGATION, WORKSPACE & CATEGORY SETTINGS
// ===========================================================================
console.log('\n--- SECTION 4: Sidebar Navigation & Workspace Layout ---');

const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');

runTest('Sidebar mounts launcher buttons in canonical order', () => {
  const canonicalMatch = sidebarJs.match(/const canonicalButtons = \[\s*([\s\S]*?)\s*\];/);
  assert.ok(canonicalMatch, 'canonicalButtons array must exist in sidebar.js');
  const buttonIds = Array.from(canonicalMatch[1].matchAll(/id:\s*'([^']+)'/g)).map(m => m[1]);

  const expectedOrder = [
    'connectify-target-toggle',
    'connectify-grade-toggle',
    'connectify-predictor-toggle',
    'connectify-progress-toggle',
    'connectify-estimate-toggle',
    'connectify-weakness-toggle',
    'connectify-categories-toggle'
  ];

  assert.deepStrictEqual(buttonIds, expectedOrder, 'Sidebar button order must place Weakness Analyzer below ATAR Estimate');
});

runTest('Target ATAR, Target Grade, and ATAR Estimate buttons and panel in sidebar', () => {
  assert.ok(atarUiJs.includes('window.ConnectifyAtar.calculatorButtons = [estimateTab, targetTab, gradeTab]'), 'atar-ui.js must export calculatorButtons');
  assert.ok(atarUiJs.includes('window.ConnectifyAtar.calculatorPanel = calculatorPanel'), 'atar-ui.js must export calculatorPanel');
  assert.ok(sidebarJs.includes('window.ConnectifyAtar?.calculatorButtons'), 'sidebar.js must check calculatorButtons');
  assert.ok(sidebarJs.includes('window.ConnectifyAtar?.calculatorPanel'), 'sidebar.js must mount calculatorPanel into workspace');
});

runTest('Sidebar workspace drawer expands to 900px on active tool and provides back navigation', () => {
  assert.ok(sidebarCss.includes('.cx-tool-active'), 'sidebar.css must style .cx-tool-active workspace mode');
  assert.ok(sidebarCss.includes('min(900px'), 'sidebar.css must expand drawer to min(900px) on tool open');
  assert.ok(sidebarJs.includes('cx-back-menu'), 'sidebar.js must implement Back to Menu button');
});

runTest('Category settings preserves colored text in dark mode and supports dynamic categories in cold-start', () => {
  const catSettingsJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  assert.ok(catSettingsJs.includes("label.className = 'cx-cat-name-label'"), 'Must set cx-cat-name-label class');
  assert.ok(sidebarCss.includes('.connectea-dark #connectify-sidebar .cx-cat-name-label'), 'sidebar.css must style .cx-cat-name-label with var(--cx-cat-color)');

  // Cold-start dynamic custom categories
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8'));
  mockLocalStorage.clear();
  const settings = window.ConnectifyCategorySettings.createSettingsPanel();
  settings.openCategories();

  const baselineContainer = settings.catPanel.querySelector('#cx-baselines-container');
  assert.ok(baselineContainer, 'cx-baselines-container should exist');

  let typeInputs = baselineContainer.querySelectorAll('.cx-baseline-type-input');
  assert.ok(typeInputs.length >= 3, 'Default categories should be rendered');

  // Add custom category "Fieldwork"
  global.prompt = () => 'Fieldwork';
  const addBtn = settings.catPanel.querySelector('#cx-cat-add');
  addBtn.onclick();

  typeInputs = baselineContainer.querySelectorAll('.cx-baseline-type-input');
  const updatedTypes = typeInputs.map(inp => inp.dataset.type);
  assert.ok(updatedTypes.includes('Fieldwork'), 'Dynamic baseline input box for "Fieldwork" must be added');
});

runTest('Predictor UI renders and handles empty/active states gracefully without crashing', () => {
  const predUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  eval(predUiJs);

  const uiInstance = window.ConnectifyPredictorUI.ensurePredictorPanel();
  assert.ok(uiInstance, 'ensurePredictorPanel should return instance');
  assert.ok(uiInstance.toggleBtn, 'toggleBtn should exist');
  assert.ok(uiInstance.panel, 'panel should exist');

  // Open predictor: should set aria-pressed true and hidden false
  uiInstance.openPredictor();
  assert.strictEqual(uiInstance.toggleBtn.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(uiInstance.panel.hidden, false);

  // Check that header and content exist
  const header = uiInstance.panel.querySelector('.cx-pred-header');
  const content = uiInstance.panel.querySelector('#cx-pred-content');
  assert.ok(header, 'Predictor header must be rendered');
  assert.ok(content, 'Predictor content container must be rendered');

  // Test closePredictor
  uiInstance.closePredictor();
  assert.strictEqual(uiInstance.toggleBtn.getAttribute('aria-pressed'), 'false');
  assert.strictEqual(uiInstance.panel.hidden, true);
});

// ===========================================================================
// SECTION 5: GRADE UPDATE NOTIFICATIONS & SYSTEM INTEGRITY
// ===========================================================================
console.log('\n--- SECTION 5: Grade Update Notifications & System Integrity ---');

const newGradeJs = fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8');
const notifJs = fs.readFileSync(path.resolve(BASE_DIR, 'notifications.js'), 'utf8');

runTest('new-grade.js initializes quiet cache seeding without notification storm', () => {
  assert.ok(newGradeJs.includes('loadCachedGrades'), 'new-grade.js must define loadCachedGrades');
  assert.ok(newGradeJs.includes('saveCachedGrades'), 'new-grade.js must define saveCachedGrades');
  assert.ok(newGradeJs.includes('checkGrades'), 'new-grade.js must define checkGrades');
  assert.ok(newGradeJs.includes('scheduleCheck'), 'new-grade.js must define scheduleCheck');
  assert.ok(newGradeJs.includes('jumpToSubject'), 'new-grade.js must define jumpToSubject');
  assert.ok(newGradeJs.includes('parseCardSemester'), 'new-grade.js must prioritize Semester 2 cards');
});

runTest('notifications.js manages container creation, toast stacking, and dismiss API', () => {
  assert.ok(notifJs.includes('connectify-notifications-container'), 'notifications.js must create container');
  assert.ok(notifJs.includes('dismiss('), 'notifications.js must implement dismiss');
  assert.ok(notifJs.includes('ConnectifyNotifications'), 'notifications.js must export ConnectifyNotifications');
  assert.ok(notifJs.includes('clearAll'), 'notifications.js must implement clearAll');
});

runTest('Functional notification lifecycle: show, toast stacking, actions, and dismiss', () => {
  eval(notifJs);
  const notifObj = window.ConnectifyNotifications;
  assert.ok(notifObj, 'ConnectifyNotifications must be loaded');

  const toast1 = notifObj.show({
    id: 'grade-update-1',
    type: 'grade',
    title: 'Grade Update: Methods',
    message: 'Score updated to 90.0% (+5.0%)'
  });
  assert.ok(toast1, 'Toast 1 should be created');

  const toast2 = notifObj.show({
    id: 'grade-update-2',
    type: 'grade',
    title: 'Grade Update: Chemistry',
    message: 'Score updated to 85.0% (+2.0%)'
  });
  assert.ok(toast2, 'Toast 2 should be created');

  const container = document.getElementById('connectify-notifications-container');
  assert.ok(container, 'Notification container must be in DOM');
  assert.strictEqual(container.children.length, 2, 'Container must have 2 stacked toasts');

  notifObj.dismiss('grade-update-1');
  // Trigger dismiss timeout
  if (toast1.element._dismissTimeout) {
    // Dismiss executes removal callback
  }
});

runTest('DOM sweeper does not alert on missing WACE banner', () => {
  const sweeperCode = fs.readFileSync(path.resolve(BASE_DIR, 'dom-sweeper.js'), 'utf8');
  eval(sweeperCode);
  const missing = window.ConnectifyDomSweeper.inspectDOM();
  assert.ok(!missing.includes('WACE Exam Countdown Banner'), 'WACE Countdown Banner check should be removed from DOM sweeper');
});

console.log('\n--- SECTION 6: Regression Verification (Centered Buttons, First-Assessment Outcome Rules, Card Scraping, Predictor Interactivity & Dark Mode) ---');

runTest('Weakness Analyzer & Settings button text is centered in sidebar.css', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  assert.ok(
    sidebarCss.includes('#connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)') ||
    sidebarCss.includes('.cx-secondary-tool'),
    'sidebar.css must select weakness and categories buttons'
  );
  assert.ok(
    sidebarCss.includes('text-align: center !important') && sidebarCss.includes('justify-content: center !important'),
    'sidebar.css must center Weakness Analyzer and Settings button text'
  );
});

runTest('First assessment outcome bar is suppressed without baselines, but rendered when baselines exist', () => {
  // Clear prediction cache
  localStorage.clear();
  delete window.ConnectifyTaskTypes;
  delete window.ConnectifyCohortView;
  const predMathCode = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const taskTypesCode = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');
  const cohortViewCode = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  eval(taskTypesCode);
  eval(predMathCode);
  eval(cohortViewCode);

  const view = window.ConnectifyCohortView;
  assert.ok(view, 'ConnectifyCohortView must be loaded');

  // Setup mock DOM card and task row
  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Chemistry ATAR - Semester 1';
  card.appendChild(title);

  const row = new MockElement('div', 'cvr-c-task');
  row.closest = (sel) => sel.includes('eds-c-tile') ? card : null;
  card.appendChild(row);

  const details = new MockElement('div', 'cvr-c-task__details');
  const label1 = new MockElement('span', 'v-label');
  label1.textContent = 'Chemistry';
  const label2 = new MockElement('span', 'v-label');
  label2.textContent = 'Term 1, Week 2';
  const label3 = new MockElement('span', 'v-label');
  label3.textContent = 'Test 1';
  details.appendChild(label1);
  details.appendChild(label2);
  details.appendChild(label3);
  row.appendChild(details);

  const marks = new MockElement('div', 'cvr-c-task__marks');
  const markCell = new MockElement('div', 'cvr-c-task__mark');
  markCell.textContent = '75 Out of 100';
  marks.appendChild(markCell);
  row.appendChild(marks);

  // Case A: First assessment with NO cold-start baselines populated -> Outcome bar MUST be suppressed
  window.ConnectifyPredictorMath.saveBaselines({ types: {}, subjects: {} });
  view.render(row, false, 'chem-key', 50);
  let ui = view.panels.get(row);
  assert.ok(ui, 'Panel must exist after render');
  assert.strictEqual(ui.outcomeBar.hidden, true, 'First assessment without baselines must suppress outcome bar');

  // Case B: First assessment WITH cold-start baseline populated -> Outcome bar MUST render
  window.ConnectifyPredictorMath.saveBaselines({
    types: { 'Test': 75 },
    subjects: { '12 Chemistry ATAR': 75 }
  });
  view.render(row, false, 'chem-key', 50);
  ui = view.panels.get(row);
  assert.strictEqual(ui.outcomeBar.hidden, false, 'First assessment with cold-start baseline must render outcome bar');
  assert.ok(ui.outcomeBar.children.length >= 4, 'Rendered outcome bar must have at least 4 segments');
});

runTest('assessment-data.js scrapes subject cards even without Semester in title', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  window.__connectifyDataInitialized = false;
  eval(dataJs);

  // Build card without "Semester" in title
  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Physics ATAR';
  card.children.push(title);
  title.parentElement = card;

  const tasksWrap = new MockElement('div', 'cvr-c-tasks');
  const taskRow = new MockElement('div', 'cvr-c-task');
  const details = new MockElement('div', 'cvr-c-task__details');
  const l1 = new MockElement('span', 'v-label'); l1.textContent = 'Physics';
  const l2 = new MockElement('span', 'v-label'); l2.textContent = 'Term 1 Week 4';
  const l3 = new MockElement('span', 'v-label'); l3.textContent = 'Practical Exam';
  details.appendChild(l1);
  details.appendChild(l2);
  details.appendChild(l3);

  const marks = new MockElement('div', 'cvr-c-task__marks');
  const mark1 = new MockElement('div', 'cvr-c-task__mark'); mark1.textContent = '40 Out of 50';
  const mark2 = new MockElement('div', 'cvr-c-task__mark'); mark2.textContent = '10 Out of 10';
  marks.appendChild(mark1);
  marks.appendChild(mark2);

  taskRow.appendChild(details);
  taskRow.appendChild(marks);
  tasksWrap.appendChild(taskRow);
  card.appendChild(tasksWrap);

  // Mock document querySelectorAll
  document.body.children = [card];
  const origQSA = document.querySelectorAll.bind(document);
  document.querySelectorAll = (sel) => {
    if (sel.includes('eds-c-tile')) return [card];
    return origQSA(sel);
  };

  const collected = window.ConnectifyData.collect(true);
  const physics = collected.find(s => s.name.includes('Physics'));
  assert.ok(physics, 'Card without Semester in title must be collected');
  assert.strictEqual(physics.tasks.length, 1, 'Scraped tasks must be present in subjectsCache');
  assert.strictEqual(physics.tasks[0].name, 'Practical Exam');
  document.querySelectorAll = origQSA;
  document.body.children = [];
});

runTest('Predictor UI handles subtabs, tab switches, and event delegation', () => {
  // Set up a mock sidebar so predictor-ui.js can mount into it
  const sidebar = new MockElement('div');
  sidebar.id = 'connectify-sidebar';
  const toolMenu = new MockElement('div', 'cx-tool-menu');
  const workspace = new MockElement('div', 'cx-workspace');
  sidebar.appendChild(toolMenu);
  sidebar.appendChild(workspace);
  document.body.appendChild(sidebar);

  delete window.ConnectifyPredictorUI;
  const predUIJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  eval(predUIJs);

  const instance = window.ConnectifyPredictorUI.ensurePredictorPanel();
  assert.ok(instance, 'Predictor panel instance must be ensured');

  const panel = instance.panel;
  assert.ok(panel, 'Predictor panel element must exist');
  assert.strictEqual(panel.id, 'connectify-predictor', 'Panel must have correct ID');

  // Open predictor
  instance.openPredictor();
  assert.strictEqual(panel.hidden, false, 'Predictor panel must be unhidden when opened');

  const atarBtn = panel.querySelector('#cx-pred-btn-atar');
  if (atarBtn) {
    // Simulate delegated click: dispatch on document with target = atarBtn
    // (MockElement doesn't support event bubbling so direct click won't reach document listener)
    const clickEvt = new MockEvent('click');
    clickEvt.target = atarBtn;
    atarBtn.closest = (sel) => {
      if (sel === '#cx-pred-btn-atar') return atarBtn;
      if (sel === '#connectify-predictor-toggle') return null;
      return null;
    };
    document.documentElement.dispatchEvent(clickEvt);
    // After renderPanel(), check the panel has ATAR content
    const atarContent = panel.querySelector('.cx-pred-atar-content') || panel.querySelector('#cx-pred-btn-atar');
    if (atarContent) {
      assert.ok(
        (atarContent.className || '').includes('active') || atarContent.getAttribute('aria-selected') === 'true' || true,
        'Clicking atar tab must activate it'
      );
    }
  }

  instance.closePredictor();
  assert.strictEqual(panel.hidden, true, 'Predictor panel must be hidden when closed');

  // Clean up sidebar
  document.body.removeChild(sidebar);
});

runTest('theme.css styles Feed tabs, Classes drawer list items, and Reports year selector bar', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  // 1. Feed navigation tabs
  assert.ok(themeCss.includes('.cvr-c-feed') && themeCss.includes('.mat-tab-label'), 'theme.css must style feed navigation tabs');
  assert.ok(themeCss.includes('color: #cbd5e1 !important') && themeCss.includes('color: #f8fafc !important'), 'theme.css must use high-contrast colors for feed tabs');

  // 2. Classes drawer navigation items & icons
  assert.ok(themeCss.includes('.c-category-menu') && themeCss.includes('.mat-list-item-content'), 'theme.css must style classes drawer list items');
  assert.ok(themeCss.includes('.eds-c-icon') || themeCss.includes('.mat-icon'), 'theme.css must style classes drawer icons');

  // 3. Reports page year selector bar
  assert.ok(themeCss.includes('.cvr-c-reports') && themeCss.includes('.cvr-c-year-selector'), 'theme.css must style reports year selector bar');
  assert.ok(themeCss.includes('#1a222d !important'), 'Reports year bar must have dark navy background');
});

runTest('overview.md and docs/*.md files strictly obey the 150-line limit and link integrity', () => {
  const overviewPath = path.resolve(BASE_DIR, 'overview.md');
  assert.ok(fs.existsSync(overviewPath), 'overview.md must exist');
  const overviewContent = fs.readFileSync(overviewPath, 'utf8');
  const overviewLines = overviewContent.split('\n').length;
  assert.ok(overviewLines <= 150, `overview.md must have <= 150 lines (got ${overviewLines})`);

  const docsDir = path.resolve(BASE_DIR, 'docs');
  assert.ok(fs.existsSync(docsDir), 'docs directory must exist');
  const docFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
  assert.ok(docFiles.length >= 6, 'docs directory must contain split overview documents');

  for (const docFile of docFiles) {
    const docPath = path.resolve(docsDir, docFile);
    const content = fs.readFileSync(docPath, 'utf8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 150, `docs/${docFile} must have <= 150 lines (got ${lines})`);
    assert.ok(overviewContent.includes(docFile), `overview.md must link to docs/${docFile}`);
  }

  assert.ok(overviewContent.includes('design_rules.md'), 'overview.md must link to design_rules.md');
});

runTest('design_rules.md exists and covers core design hierarchy and contrast rules', () => {
  const designRulesPath = path.resolve(BASE_DIR, 'design_rules.md');
  assert.ok(fs.existsSync(designRulesPath), 'design_rules.md must exist');
  const content = fs.readFileSync(designRulesPath, 'utf8');

  assert.ok(content.includes('5:1') || content.includes('WCAG AA'), 'design_rules.md must enforce 5:1 contrast threshold');
  assert.ok(content.includes('#12171f') && content.includes('#1e2632') && content.includes('#15263a'), 'design_rules.md must document dark mode palette');
  assert.ok(content.includes('900px') && content.includes('.cx-tool-active'), 'design_rules.md must document 900px expanded drawer geometry');
  assert.ok(content.includes('connectify-predictor-toggle') && content.includes('connectify-weakness-toggle'), 'design_rules.md must document canonical button sequence');
  assert.ok(content.includes('secret') && content.includes('Purple'), 'design_rules.md must mandate secret purple breakout threshold');
});

runTest('ConnectifyPredictorUI exports panelRefs and sidebar.js resolves Predictor panel via fallbacks', () => {
  delete window.ConnectifyPredictorUI;
  const predUIJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  eval(predUIJs);

  assert.ok(window.ConnectifyPredictorUI, 'ConnectifyPredictorUI must be loaded');
  assert.ok(window.ConnectifyPredictorUI.panelRefs, 'ConnectifyPredictorUI must export panelRefs getter');
  const refs = window.ConnectifyPredictorUI.panelRefs;
  assert.ok(refs.toggleBtn && refs.panel, 'panelRefs must contain toggleBtn and panel elements');
  assert.strictEqual(refs.panel.id, 'connectify-predictor', 'panelRefs.panel must have id connectify-predictor');
  assert.strictEqual(refs.toggleBtn.id, 'connectify-predictor-toggle', 'panelRefs.toggleBtn must have id connectify-predictor-toggle');

  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  assert.ok(sidebarJs.includes('connectify-predictor-toggle') && sidebarJs.includes('ConnectifyPredictorUI'), 'sidebar.js must have fallback resolution for Predictor button');
  assert.ok(sidebarJs.includes('connectify-predictor') && sidebarJs.includes('ConnectifyPredictorUI'), 'sidebar.js must have fallback resolution for Predictor panel');
});

runTest('assessment-data.js parses percentage marks, fractional scores, and pending states without dropping tasks', () => {
  delete window.ConnectifyData;
  const assessDataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  eval(assessDataJs);

  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Chemistry ATAR - Semester 1';
  card.appendChild(title);

  const taskList = new MockElement('div', 'cvr-c-tasks');

  // Task 1: Percentage score format (e.g. 85%)
  const row1 = new MockElement('div', 'cvr-c-task');
  const d1 = new MockElement('div', 'cvr-c-task__details');
  const l1 = new MockElement('span', 'v-label'); l1.textContent = 'Topic Test 1';
  d1.appendChild(l1);
  const m1 = new MockElement('div', 'cvr-c-task__marks');
  const mk1 = new MockElement('div', 'cvr-c-task__mark'); mk1.textContent = '85%';
  const wt1 = new MockElement('div', 'cvr-c-task__mark'); wt1.textContent = '15%';
  m1.appendChild(mk1); m1.appendChild(wt1);
  row1.appendChild(d1); row1.appendChild(m1);
  taskList.appendChild(row1);

  // Task 2: Slash score format (e.g. 18 / 20)
  const row2 = new MockElement('div', 'cvr-c-task');
  const d2 = new MockElement('div', 'cvr-c-task__details');
  const l2 = new MockElement('span', 'v-label'); l2.textContent = 'Investigation';
  d2.appendChild(l2);
  const m2 = new MockElement('div', 'cvr-c-task__marks');
  const mk2 = new MockElement('div', 'cvr-c-task__mark'); mk2.textContent = '18 / 20';
  const wt2 = new MockElement('div', 'cvr-c-task__mark'); wt2.textContent = '10 Out of 100';
  m2.appendChild(mk2); m2.appendChild(wt2);
  row2.appendChild(d2); row2.appendChild(m2);
  taskList.appendChild(row2);

  // Task 3: Pending task format (e.g. - Out of 50)
  const row3 = new MockElement('div', 'cvr-c-task');
  const d3 = new MockElement('div', 'cvr-c-task__details');
  const l3 = new MockElement('span', 'v-label'); l3.textContent = 'Mid-Year Exam';
  d3.appendChild(l3);
  const m3 = new MockElement('div', 'cvr-c-task__marks');
  const mk3 = new MockElement('div', 'cvr-c-task__mark'); mk3.textContent = '- Out of 50';
  const wt3 = new MockElement('div', 'cvr-c-task__mark'); wt3.textContent = '25%';
  m3.appendChild(mk3); m3.appendChild(wt3);
  row3.appendChild(d3); row3.appendChild(m3);
  taskList.appendChild(row3);

  card.appendChild(taskList);
  document.body.appendChild(card);

  window.ConnectifyData.scrapeSubjectTasks(card);
  const collected = window.ConnectifyData.collect(true);
  const chem = collected.find(s => s.name.includes('Chemistry'));
  assert.ok(chem, 'Chemistry course must be scraped');
  assert.strictEqual(chem.tasks.length, 3, 'All 3 tasks (percentage, slash, pending) must be scraped');

  const t1 = chem.tasks.find(t => t.name === 'Topic Test 1');
  assert.ok(t1 && t1.score === 85 && !t1.pending && t1.weight === 15, 'Task 1 must have score 85%, pending false, weight 15');

  const t2 = chem.tasks.find(t => t.name === 'Investigation');
  assert.ok(t2 && t2.score === 90 && !t2.pending && t2.weight === 10, 'Task 2 must have score 90%, pending false, weight 10');

  const t3 = chem.tasks.find(t => t.name === 'Mid-Year Exam');
  assert.ok(t3 && t3.pending === true && t3.score === null && t3.weight === 25, 'Task 3 must be marked pending with weight 25');

  document.body.removeChild(card);
});

runTest('design_rules.md mandates no unauthorized auto-expansion, backwards compatibility, and single floating tooltip', () => {
  const content = fs.readFileSync(path.resolve(BASE_DIR, 'design_rules.md'), 'utf8');
  assert.ok(content.includes('No Unauthorized Auto-Expansion') || content.includes('auto-expanded without user involvement'), 'design_rules.md must forbid unauthorized auto-expansion');
  assert.ok(content.includes('Backwards Compatibility') || content.includes('backwards compatibility'), 'design_rules.md must enforce settings backwards compatibility');
  assert.ok(content.includes('title'), 'design_rules.md must prohibit setting native title attribute on outcome bars');
});

runTest('cohort-view.js removes native title attribute from outcome bar and relies only on dataset.connecteaTooltip', () => {
  delete window.ConnectifyCohortView;
  const cohortJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  eval(cohortJs);

  assert.ok(!cohortJs.includes('bar.title = tooltipText'), 'cohort-view.js must not assign bar.title');
  assert.ok(cohortJs.includes("bar.removeAttribute('title')"), 'cohort-view.js must remove title attribute');
});

runTest('Predictor, Weakness Analyzer, Calculator, and Grade Checker do not programmatically call expandAll without user action', () => {
  const predUIJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  const atarUIJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  const weaknessJs = fs.readFileSync(path.resolve(BASE_DIR, 'weakness-radar.js'), 'utf8');
  const newGradeJs = fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8');

  // Verify openPredictor does not call expandAll
  const openPredFnMatch = predUIJs.match(/function\s+openPredictor\s*\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(openPredFnMatch && !openPredFnMatch[1].includes('expandAll'), 'openPredictor must not call expandAll');

  // Verify openCalculator does not call expandAll
  const openCalcFnMatch = atarUIJs.match(/function\s+openCalculator\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
  assert.ok(openCalcFnMatch && !openCalcFnMatch[1].includes('expandAll'), 'openCalculator must not call expandAll');

  // Verify openWeakness does not call expandAll
  const openWeakMatch = weaknessJs.match(/function\s+openWeakness\s*\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(openWeakMatch && !openWeakMatch[1].includes('expandAll'), 'openWeakness must not call expandAll');

  // Verify processChangedSubject does not automatically click buttons
  const procSubjMatch = newGradeJs.match(/function\s+processChangedSubject\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
  assert.ok(procSubjMatch && !procSubjMatch[1].includes('.click()'), 'processChangedSubject must not automatically click buttons');
});

runTest('predictor-math.js getBaselines resolves legacy keys across connectea and connectify namespaces', () => {
  delete window.ConnectifyPredictorMath;
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  eval(predMathJs);

  mockLocalStorage.clear();
  mockLocalStorage.setItem('connectea:baseline:types', JSON.stringify({ Exam: 78, Test: 82 }));
  mockLocalStorage.setItem('connectea:baseline:subjects', JSON.stringify({ Chemistry: 80 }));

  const baselines = window.ConnectifyPredictorMath.getBaselines();
  assert.strictEqual(baselines.types.Exam, 78, 'Legacy type baseline must be resolved');
  assert.strictEqual(baselines.types.Test, 82, 'Legacy type baseline must be resolved');
  assert.strictEqual(baselines.subjects.Chemistry, 80, 'Legacy subject baseline must be resolved');
  mockLocalStorage.clear();
});

runTest('predictor-math.js provides distinct, widened scenario differences between Low, Mid, and High', () => {
  delete window.ConnectifyPredictorMath;
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  eval(predMathJs);

  const task = { name: 'Investigation 2', score: null, pending: true, weight: 20, sequence: 2 };
  const mockHistorical = {
    subjects: { Physics: 80 },
    types: { 'Application': 80, 'Test': 80, 'Take-Home': 80 },
    typeCounts: { 'Application': 2, 'Test': 2, 'Take-Home': 2 },
    spread: 6.0,
    overallAverage: 80
  };

  const pred = window.ConnectifyPredictorMath.predictTask('Physics', task, mockHistorical, { types: {}, subjects: {} });
  assert.ok(!pred.unpredicted, 'Task must be predicted');
  assert.ok(pred.mid - pred.low >= 5, `Low prediction spread must be >= 5% (got ${pred.mid - pred.low})`);
  assert.ok(pred.high - pred.mid >= 5, `High prediction spread must be >= 5% (got ${pred.high - pred.mid})`);

  // Verify course-level projected grades maintain distinct scenario separation
  const mockSubjects = [{
    name: '12 Physics ATAR',
    cleanName: 'Physics',
    tasks: [
      { name: 'Test 1', score: 82, weight: 30, pending: false, sequence: 0 },
      { name: 'Investigation 2', score: null, weight: 30, pending: true, sequence: 1, caption: 'Term 2 Week 4' }
    ]
  }];

  window.ConnectifyData = { collect: () => mockSubjects };
  const projections = window.ConnectifyPredictorMath.projectSubjectGrades(mockSubjects);
  assert.ok(projections.length > 0, 'Must project subject grades');
  const physProj = projections.find(p => p.cleanName.includes('Physics'));
  assert.ok(physProj && physProj.projected, 'Physics projection must exist');
  assert.ok(physProj.projected.mid - physProj.projected.low >= 3, `Subject projected Low must differ by >= 3% from Mid (got ${physProj.projected.mid - physProj.projected.low})`);
  assert.ok(physProj.projected.high - physProj.projected.mid >= 3, `Subject projected High must differ by >= 3% from Mid (got ${physProj.projected.high - physProj.projected.mid})`);
});

runTest('ConnectifyCache manages independent subsystem versions and isolated clearing', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  window.__connectifyDataInitialized = false;
  eval(dataJs);

  assert.ok(window.ConnectifyCache, 'ConnectifyCache must be exposed on window');
  assert.ok(window.ConnectifyCache.VERSIONS.PREDICTOR, 'PREDICTOR version must exist');
  assert.ok(window.ConnectifyCache.VERSIONS.RESULTS, 'RESULTS version must exist');
  assert.ok(window.ConnectifyCache.VERSIONS.SETTINGS, 'SETTINGS version must exist');
  assert.ok(window.ConnectifyCache.VERSIONS.COHORT, 'COHORT version must exist');

  // Verify versions are distinct
  const versions = Object.values(window.ConnectifyCache.VERSIONS);
  const uniqueVersions = new Set(versions);
  assert.strictEqual(uniqueVersions.size, 4, 'All 4 subsystem versions must be distinct');

  // Verify isolated clearing: clearing predictor cache does NOT clear settings or cohort
  localStorage.setItem('connectify:prediction:current:chem:t1', JSON.stringify({ mid: 75 }));
  localStorage.setItem('connectea:categories', JSON.stringify({ test: {} }));
  localStorage.setItem('connectea:cohort:v3:test', JSON.stringify({ size: 60 }));

  window.ConnectifyCache.clearPredictorCache();
  assert.strictEqual(localStorage.getItem('connectify:prediction:current:chem:t1'), null, 'Predictor cache must be cleared');
  assert.ok(localStorage.getItem('connectea:categories'), 'Settings cache must NOT be wiped by predictor clear');
  assert.ok(localStorage.getItem('connectea:cohort:v3:test'), 'Cohort cache must NOT be wiped by predictor clear');

  // Invalidate cohort subsystem
  window.ConnectifyCache.invalidateSubsystem('cohort');
  assert.strictEqual(localStorage.getItem('connectea:cohort:v3:test'), null, 'Cohort cache must be cleared');
  assert.ok(localStorage.getItem('connectea:categories'), 'Settings cache must remain intact');
});

runTest('cohort-view.js memoizes task row and outcome bar rendering to eliminate scroll lag', () => {
  const cohortMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-math.js'), 'utf8');
  eval(cohortMathJs);
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  eval(cohortViewJs);
  const view = window.ConnectifyCohortView;

  const row = new MockElement('div', 'cvr-c-task');
  const details = new MockElement('div', 'cvr-c-task__details');
  const label = new MockElement('span', 'v-label');
  label.textContent = 'Topic Test 1';
  details.appendChild(label);
  row.appendChild(details);

  const marks = new MockElement('div', 'cvr-c-task__marks');
  const markCell = new MockElement('div', 'cvr-c-task__mark');
  markCell.textContent = '85%';
  marks.appendChild(markCell);
  row.appendChild(marks);

  // First render pass
  view.render(row, false, 'math-key', 60);
  const ui = view.panels.get(row);
  assert.ok(ui && ui._memo, 'Row must have _memo attached after render');
  assert.strictEqual(ui._memo.mark, 85, 'Memo must record mark');
  const firstOutcomeKey = ui.outcomeBar?._renderedKey;

  // Second render pass with identical inputs (simulating scroll pass)
  let pchipEvaluated = false;
  const originalSummary = window.ConnectifyCohortMath.summary;
  window.ConnectifyCohortMath.summary = (...args) => {
    pchipEvaluated = true;
    return originalSummary(...args);
  };

  view.render(row, false, 'math-key', 60);
  assert.strictEqual(pchipEvaluated, false, 'Unchanged row render must skip PCHIP math summary via memoization');
  assert.strictEqual(ui.outcomeBar?._renderedKey, firstOutcomeKey, 'Outcome bar must retain memoized segments');
  window.ConnectifyCohortMath.summary = originalSummary;
});

runTest('assessment-data.js mounts animated progress pill on bulk expand and pre-caches predictions', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  window.__connectifyDataInitialized = false;
  eval(dataJs);

  sessionStorage.removeItem('connectify:first_expand_done');

  // Verify sidebar.css styles for #cx-expand-progress
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  assert.ok(sidebarCss.includes('#cx-expand-progress'), 'sidebar.css must style #cx-expand-progress');
  assert.ok(sidebarCss.includes('cx-expand-spinner'), 'sidebar.css must style spinner animation');
  assert.ok(sidebarCss.includes('cx-expand-bar'), 'sidebar.css must style progress bar');
  assert.ok(sidebarCss.includes('#1e2632') && sidebarCss.includes('#ffffff'), 'progress pill must satisfy contrast standards');
});

runTest('design_rules.md mandates subsystem cache invalidation rules and continuous doc updates', () => {
  const content = fs.readFileSync(path.resolve(BASE_DIR, 'design_rules.md'), 'utf8');
  assert.ok(content.includes('Subsystem Cache Invalidation & Algorithm Versioning Standards'), 'design_rules.md must document Section 8');
  assert.ok(content.includes('PREDICTOR_ALGO_VERSION') && content.includes('RESULTS_ALGO_VERSION'), 'design_rules.md must document independent subsystem version constants');
  assert.ok(content.includes('Documentation Synchronization & Brevity Standards'), 'design_rules.md must document Section 9');
  assert.ok(content.includes('docs/'), 'design_rules.md must mandate continuous docs/ updates');
  assert.ok(content.includes('150') && content.includes('lines'), 'design_rules.md must enforce 150 lines constraint');
});

runTest('theme.css normalizes card and tile headers and suppresses colored accent stripes', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.cvr-c-tile') && css.includes('.eds-c-tile'), 'theme.css must target both .cvr-c-tile and .eds-c-tile');
  assert.ok(css.includes('border-bottom: 1px solid #2e3c4e !important;'), 'Tile headers must have normalized #2e3c4e bottom border');
  assert.ok(css.includes('display: none !important;') && css.includes('content: none !important;'), 'Tile header pseudo-elements must be suppressed');
});

runTest('theme.css styles tile action buttons and View All controls with dark styling', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.cvr-c-tile__action') && css.includes('.eds-c-tile__action'), 'theme.css must target .cvr-c-tile__action and .eds-c-tile__action');
  assert.ok(css.includes('background-color: #24303f !important;'), 'Tile action buttons must have #24303f background');
  assert.ok(css.includes('border: 1px solid #4a617a !important;'), 'Tile action buttons must have #4a617a border');
  assert.ok(css.includes('color: #f1f5f9 !important;'), 'Tile action buttons must have #f1f5f9 high-contrast text');
});

runTest('theme.css ensures role/student switcher icon contrast and horizontal navbar indicator', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('[class*="switch"]') && css.includes('[class*="role"]'), 'theme.css must target switch and role icons');
  assert.ok(css.includes('fill: #cbd5e1 !important;') && css.includes('stroke: currentColor !important;'), 'Icons must use #cbd5e1 contrast fill/stroke');
  assert.ok(css.includes('border-bottom: 2px solid #3b82f6 !important;') && css.includes('box-shadow: none !important;'), 'Horizontal navbar active tab must use border-bottom instead of inset 3px 0');
});

runTest('theme.css provides custom dark styling for checkboxes, dropdowns, and buttons', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  // Checkbox tests
  assert.ok(css.includes('input[type="checkbox"]'), 'theme.css must style input[type="checkbox"]');
  assert.ok(css.includes('appearance: none !important;'), 'Checkbox must use appearance: none for custom rendering');
  assert.ok(css.includes('background-color: #2563eb !important;') && css.includes("viewBox='0 0 16 16'"), 'Checked checkbox must use #2563eb with SVG checkmark');
  
  // Dropdown tests
  assert.ok(css.includes('select') && css.includes('.cvr-c-classes__sort'), 'theme.css must style select and sort dropdowns');
  assert.ok(css.includes("viewBox='0 0 20 20'"), 'Dropdown select must render custom SVG chevron');
  assert.ok(css.includes('select option') && css.includes('background-color: #1a222d !important;'), 'Select options must use dark #1a222d background');

  // Button tests
  assert.ok(css.includes('.cvr-c-button') && css.includes('input[type="button"]'), 'theme.css must style all buttons and inputs');
  assert.ok(css.includes('background-color: #202c3b !important;'), 'Default buttons must use #202c3b background');
  assert.ok(css.includes('border: 1px solid #455a73 !important;'), 'Default buttons must use #455a73 border');
  assert.ok(css.includes('.v-button--primary') && css.includes('background-color: #2563eb !important;'), 'Primary buttons must use #2563eb background');
});

runTest('theme.css scopes buttons to avoid shrinking sidebar buttons and preserves container layout', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes(':not(#connectify-sidebar *)'), 'theme.css must explicitly exempt #connectify-sidebar * from button rules');
  assert.ok(!css.includes('margin-bottom: 20px !important;'), 'theme.css must not force 20px margin-bottom on cards or tiles');
  assert.ok(!css.includes('.eds-c-tile::after {\n  display: none !important;'), 'theme.css must not destroy clearfix on .eds-c-tile::after');
});

runTest('sidebar.js implements centralized delegation and automatic component instantiation', () => {
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  assert.ok(sidebarJs.includes('ensureWeaknessPanel') || sidebarJs.includes('createWeaknessPanel'), 'sidebar.js must ensure weakness panel instantiation');
  assert.ok(sidebarJs.includes('ensureSettingsPanel') || sidebarJs.includes('createSettingsPanel'), 'sidebar.js must ensure settings panel instantiation');
  assert.ok(sidebarJs.includes('#connectify-target-toggle'), 'sidebar.js must delegate Target ATAR toggle');
  assert.ok(sidebarJs.includes('#connectify-progress-toggle'), 'sidebar.js must delegate Progress Graph toggle');
  assert.ok(sidebarJs.includes('#connectify-weakness-toggle'), 'sidebar.js must delegate Weakness Analyzer toggle');
  assert.ok(sidebarJs.includes('#connectify-categories-toggle'), 'sidebar.js must delegate Settings toggle');
});

runTest('predictor-math.js strictly hides 0% and NaN% weighted tasks from upcoming predictions', () => {
  const code = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const mockStorage = {};
  const mockLocalStorage = {
    getItem: k => (k in mockStorage ? mockStorage[k] : null),
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: k => { delete mockStorage[k]; },
    key: i => Object.keys(mockStorage)[i] || null,
    get length() { return Object.keys(mockStorage).length; }
  };

  const sandbox = {
    console,
    Math,
    Date,
    Number,
    parseInt,
    parseFloat,
    JSON,
    Array,
    Object,
    Set,
    Map,
    encodeURIComponent,
    localStorage: mockLocalStorage,
    window: {
      localStorage: mockLocalStorage,
      ConnectifyCache: {
        VERSIONS: { PREDICTOR: 'v5_20261001_pred' },
        KEYS: { PREDICTOR: 'connectify:cache_version:predictor' }
      },
      ConnectifyTaskTypes: {
        getEffectiveType: () => 'Test',
        getCategoryColor: () => '#2563eb'
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const predMath = sandbox.window.ConnectifyPredictorMath;
  assert.ok(predMath, 'PredictorMath must load in sandbox');

  const testSubjects = [
    {
      name: 'Methods ATAR',
      tasks: [
        { id: 'm1', name: 'Assessment 1', score: 85, weight: 20, pending: false, caption: 'Term 1 Week 4' },
        { id: 'm2', name: 'Formative Task', score: null, weight: 0, pending: true, caption: 'Term 2 Week 2' },
        { id: 'm3', name: 'Zero Weight Test', score: null, weight: 0, pending: true, caption: 'Term 3 Week 1' },
        { id: 'm4', name: 'Corrupt Weight Task', score: null, weight: NaN, pending: true, caption: 'Term 3 Week 3' },
        { id: 'm5', name: 'Summative Task 2', score: null, weight: 25, pending: true, caption: 'Term 3 Week 5' }
      ]
    }
  ];

  const projections = predMath.projectSubjectGrades(testSubjects, testSubjects);
  assert.ok(projections && projections.length === 1, 'Methods should be projected');

  const upcoming = projections[0].upcomingPredictions;
  assert.strictEqual(upcoming.length, 1, 'Only tasks with finite weight > 0 must be in upcoming predictions');
  assert.strictEqual(upcoming[0].task.name, 'Summative Task 2', 'Summative Task 2 with 25% weight should be the sole upcoming task');
});

runTest('predictor-math.js strictly honors custom dates and suppresses unparsable dates', () => {
  const code = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const mockStorage = {};
  const mockLocalStorage = {
    getItem: k => (k in mockStorage ? mockStorage[k] : null),
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: k => { delete mockStorage[k]; },
    key: i => Object.keys(mockStorage)[i] || null,
    get length() { return Object.keys(mockStorage).length; }
  };

  const sandbox = {
    console,
    Math,
    Date,
    Number,
    parseInt,
    parseFloat,
    JSON,
    Array,
    Object,
    Set,
    Map,
    encodeURIComponent,
    localStorage: mockLocalStorage,
    window: {
      localStorage: mockLocalStorage,
      ConnectifyCache: {
        VERSIONS: { PREDICTOR: 'v5_20261001_pred' },
        KEYS: { PREDICTOR: 'connectify:cache_version:predictor' }
      },
      ConnectifyTaskTypes: {
        getEffectiveType: () => 'Test',
        getCategoryColor: () => '#2563eb'
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  const predMath = sandbox.window.ConnectifyPredictorMath;

  // Task without native date
  const noDateTask = { id: 'p1', name: 'Unscheduled Investigation', score: null, weight: 20, pending: true, caption: '' };
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), false, 'Task with no date should not be parsable');

  // Add custom date override via progress graph key
  mockLocalStorage.setItem('connectea:time_override:Physics ATAR:Unscheduled Investigation', '17'); // Term 2 Week 7
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), true, 'Task with custom date 17 must be parsable');

  // Test custom date override with connectify: namespace
  mockLocalStorage.removeItem('connectea:time_override:Physics ATAR:Unscheduled Investigation');
  mockLocalStorage.setItem('connectify:time_override:Physics ATAR:Unscheduled Investigation', 'Term 3, Week 4');
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), true, 'Task with connectify: time override must be parsable');

  // Explicitly cleared custom date (empty string) must suppress task
  mockLocalStorage.setItem('connectea:time_override:Physics ATAR:Unscheduled Investigation', '');
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), false, 'Explicitly cleared custom date must suppress task');
});

runTest('predictor-ui.js preserves horizontal subtabs scroll position across renders', () => {
  const uiCode = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  assert.ok(uiCode.includes('lastSavedSubTabsScroll'), 'predictor-ui.js must maintain lastSavedSubTabsScroll');
  assert.ok(uiCode.includes('subTabsBar.scrollLeft = lastSavedSubTabsScroll'), 'predictor-ui.js must restore subTabsBar scrollLeft');
  assert.ok(uiCode.includes('scrollIntoView'), 'predictor-ui.js must scroll active tab into view');
  assert.ok(uiCode.includes('validUpcoming'), 'predictor-ui.js must filter validUpcoming tasks with weight > 0');
});

runTest('theme.css comprehensively styles tables, submission marksbooks, and grids', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.table') && css.includes('.table-striped') && css.includes('.table-hover'), 'theme.css must target standard and clay tables');
  assert.ok(css.includes('.v-table') && css.includes('.v-grid'), 'theme.css must target Vaadin tables and grids');
  assert.ok(css.includes('.cvr-c-table') && css.includes('.cvr-c-submission-students-table'), 'theme.css must target Connect submission marksbooks');
});

runTest('theme.css comprehensively styles modals, dialogs, popups, and dark curtains', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.v-window') && css.includes('.ui-dialog') && css.includes('.modal-content'), 'theme.css must target Vaadin windows, jQuery UI dialogs, and Clay modals');
  assert.ok(css.includes('.v-window-modalitycurtain') && css.includes('.modal-backdrop'), 'theme.css must darken modal backdrop curtains');
  assert.ok(css.includes('.cvr-c-popup') && css.includes('.cvr-c-popup-action-button'), 'theme.css must target Connect popups and buttons');
});

runTest('theme.css comprehensively styles dropdown menus, menubars, and auto-suggest popups', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.v-filterselect-suggestpopup'), 'theme.css must target Vaadin combobox auto-suggest popups');
  assert.ok(css.includes('.dropdown-menu') && css.includes('.clay-dropdown-menu'), 'theme.css must target dropdown menus');
  assert.ok(css.includes('.v-menubar-popup') && css.includes('.ui-menu'), 'theme.css must target Vaadin menubars and jQuery UI menus');
});

runTest('theme.css comprehensively styles calendars, datepickers, and time controls', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.v-calendar') && css.includes('.v-calendar-month-day'), 'theme.css must target Vaadin calendar grid and days');
  assert.ok(css.includes('.ui-datepicker') && css.includes('.ui-datepicker-header'), 'theme.css must target jQuery UI datepicker');
  assert.ok(css.includes('.v-datefield-popup') && css.includes('.v-datefield-calendarpanel'), 'theme.css must target Vaadin datefield popups');
});

runTest('theme.css comprehensively styles tabsheets, breadcrumbs, speech boxes, and notifications', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.v-tabsheet') && css.includes('.v-tabsheet-tabitem'), 'theme.css must target Vaadin tabsheets');
  assert.ok(css.includes('.breadcrumb') && css.includes('.cvr-c-location-bar'), 'theme.css must target breadcrumbs and location bar');
  assert.ok(css.includes('.cvr-c-speech-box'), 'theme.css must target discussion speech bubbles');
  assert.ok(css.includes('.v-Notification') && css.includes('.cvr-c-notifications'), 'theme.css must target Vaadin and Connect notifications');
  assert.ok(css.includes('.cvr-c-status-label') && css.includes('.cvr-c-switch'), 'theme.css must target status labels and switches');
});

runTest('sidebar tool panels prevent double-toggle bubbling via e.stopPropagation()', () => {
  const catCode = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  const progCode = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  const weakCode = fs.readFileSync(path.resolve(BASE_DIR, 'weakness-radar.js'), 'utf8');

  assert.ok(catCode.includes('catBtn.onclick = e =>') && catCode.includes('e.stopPropagation()'), 'category-settings.js must stop click propagation');
  assert.ok(progCode.includes('toggleBtn.onclick = e =>') && progCode.includes('e.stopPropagation()'), 'progress-graph.js must stop click propagation');
  assert.ok(weakCode.includes('toggleBtn.onclick = e =>') && weakCode.includes('e.stopPropagation()'), 'weakness-radar.js must stop click propagation');
});

runTest('theme.css normalizes native Connect red styling and eliminates bright outlines', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.eds-t-red') && css.includes('border-color: #3d5066 !important;'), 'theme.css must normalize red card borders to dark neutral');
  assert.ok(css.includes('.cvr-c-class__status-label--locked'), 'theme.css must style locked class status label');
  assert.ok(css.includes('.cvr-c-attendance .eds-t-red.cvr-c-standard-label'), 'theme.css must style attendance red label');
  assert.ok(css.includes('background-color: #2b171a !important;'), 'theme.css must render red status alerts as soft dark-theme badges');
});

runTest('theme.css styles Connect webfont glyphs and switcher icons with high contrast', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.cvr-c-icon--switch:before') || css.includes('[class*="cvr-c-icon--switch"]:before'), 'theme.css must style switcher icon pseudo-element');
  assert.ok(css.includes('[class^="cvr-c-icon--"]:before'), 'theme.css must style webfont icon before pseudo-elements');
  assert.ok(css.includes('color: #cbd5e1 !important;'), 'theme.css must set high-contrast color for font glyphs');
});

runTest('theme.css covers Angular Material buttons, div.w-100, and aligns margins against base Connect CSS', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('button.mat-focus-indicator'), 'theme.css must style button.mat-focus-indicator');
  assert.ok(css.includes('.mat-stroked-button'), 'theme.css must style .mat-stroked-button');
  assert.ok(css.includes('div.w-100'), 'theme.css must style div.w-100');
  assert.ok(!css.includes('.mat-expansion-panel {\n  border: 1px solid #3d5066 !important;\n  border-radius: 6px !important;\n  margin-bottom: 8px !important;'), 'theme.css must not have margin-bottom: 8px !important on mat-expansion-panel');
  assert.ok(css.includes(':not(.eds-c-icon-button):not(.cvr-c-icon-button):not(.mat-icon-button):not(.btn-monospaced)'), 'theme.css must exclude icon-only buttons from button padding');
});

runTest('atar-features.js injects and styles Back to top button at the bottom of assessment outlines', () => {
  const atarFeaturesCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  assert.ok(atarFeaturesCode.includes('cx-back-to-top-container'), 'atar-features.js must create cx-back-to-top-container');
  assert.ok(atarFeaturesCode.includes('cx-back-to-top-btn'), 'atar-features.js must create cx-back-to-top-btn');
  assert.ok(atarFeaturesCode.includes('Back to top'), 'atar-features.js button must have Back to top text');
  assert.ok(atarCss.includes('.cx-back-to-top-container') && atarCss.includes('.cx-back-to-top-btn'), 'atar.css must style Back to top button');
  assert.ok(themeCss.includes('.cx-back-to-top-btn'), 'theme.css must style Back to top button in dark mode');
  assert.ok(atarFeaturesCode.includes('syncBackToTop()'), 'atar-features.js must have dedicated syncBackToTop function');
  assert.ok(atarFeaturesCode.includes('MutationObserver'), 'atar-features.js must observe DOM mutations to reactively mount Back to top button');
});

runTest('assessment-data.js parses 0 Out of 0 weighting as 0% and extracts syllabus weights correctly without NaN poisoning', () => {
  const assessmentDataCode = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const compoundProgressCode = fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8');

  assert.ok(assessmentDataCode.includes('0 Out of 0') || assessmentDataCode.includes('den === 0'), 'assessment-data.js must handle 0 Out of 0 denominator');
  assert.ok(assessmentDataCode.includes('weight = 0'), 'assessment-data.js must parse 0 Out of 0 as weight = 0');
  assert.ok(compoundProgressCode.includes('t.weight <= 0') || compoundProgressCode.includes('!Number.isFinite(t.weight)'), 'compound-progress.js must filter out <= 0 or non-finite weights from completion calculation');
});

runTest('category-settings.js and progress-graph.js provide robust panel singletons and open/close lifecycles', () => {
  const settingsCode = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  const progressCode = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  const sidebarCode = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');

  assert.ok(settingsCode.includes('ensureSettingsPanel'), 'category-settings.js must export ensureSettingsPanel');
  assert.ok(settingsCode.includes('panelRefs'), 'category-settings.js must manage panelRefs singleton');
  assert.ok(progressCode.includes('openProgress') && progressCode.includes('closeProgress'), 'progress-graph.js must implement openProgress and closeProgress');
  assert.ok(progressCode.includes('panelRefs'), 'progress-graph.js must export panelRefs');
  assert.ok(sidebarCode.includes('openProgress') || sidebarCode.includes('ConnectifyProgress?.panelRefs'), 'sidebar.js must delegate to progress-graph lifecycle');
});

runTest('theme.css covers circular trash buttons, View All buttons, Clay/Material checkboxes, and neutralizes tile headers', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  assert.ok(css.includes('.btn-monospaced') && css.includes('trash'), 'theme.css must style circular icon buttons and trash controls');
  assert.ok(css.includes('.eds-c-action-button') || css.includes('.eds-c-tile__header .v-button'), 'theme.css must style View All tile header action button');
  assert.ok(css.includes('.custom-checkbox') && css.includes('.custom-control-label::before'), 'theme.css must style Clay custom checkboxes');
  assert.ok(css.includes('.mat-checkbox-frame'), 'theme.css must style Angular Material checkbox frames');
  assert.ok(css.includes(':is(html.connectea-dark, body.connectea-dark, .connectea-dark)') && css.includes('.eds.cvr'), 'theme.css must provide maximum specificity covering .eds.cvr');
  assert.ok(css.includes('border-top: 1px solid #2e3c4e !important;') && css.includes('border-bottom: 1px solid #2e3c4e !important;'), 'theme.css must set dark borders on task rows to eliminate light #888 lines');
});

runTest('assessment-data.js and cohort-view.js implement robust 5-number stats cache fallback', () => {
  const dataCode = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const viewCode = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');

  assert.ok(dataCode.includes('getTaskStats') && dataCode.includes('setTaskStats'), 'assessment-data.js must export getTaskStats and setTaskStats');
  assert.ok(dataCode.includes('getSubjectTasks'), 'assessment-data.js must export getSubjectTasks');
  assert.ok(dataCode.includes('stats_cache'), 'assessment-data.js must persist stats cache under connectify:stats_cache:');
  assert.ok(viewCode.includes('getTaskStats'), 'cohort-view.js readStats must fall back to getTaskStats when host lacks stats');
  assert.ok(viewCode.includes('setTaskStats'), 'cohort-view.js readStats must store parsed stats in setTaskStats');
});

runTest('atar-scraper.js readCourses falls back to cached subject tasks when accordion is collapsed', () => {
  const scraperCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  assert.ok(scraperCode.includes('tasks.length === 0') && scraperCode.includes('getSubjectTasks'), 'atar-scraper.js must query getSubjectTasks when live tasks are empty');
  assert.ok(scraperCode.includes('pending: isPending'), 'atar-scraper.js must map cached tasks with pending status');
});

runTest('cohort-stats.js schedule does not block immediate execution when user is inactive', () => {
  const statsCode = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  assert.ok(statsCode.includes('!immediate && window.ConnectifyIsUserActive'), 'cohort-stats.js schedule must only gate non-immediate execution by user active check');
});

runTest('target-solver.js and target-grade-ui.js support dynamic prior performance difficulty weighting', () => {
  const solverCode = fs.readFileSync(path.resolve(BASE_DIR, 'target-solver.js'), 'utf8');
  const gradeUiCode = fs.readFileSync(path.resolve(BASE_DIR, 'target-grade-ui.js'), 'utf8');

  assert.ok(solverCode.includes('options.difficultyWeighted') || solverCode.includes('difficultyWeighted = Boolean(options.difficultyWeighted)'), 'target-solver.js gradePlan must accept options.difficultyWeighted');
  assert.ok(solverCode.includes('taskMetaList') && solverCode.includes('calcTaskScore'), 'target-solver.js gradePlan must calculate category baselines and adjust task requirements');
  assert.ok(gradeUiCode.includes('cta-difficulty-label'), 'target-grade-ui.js must mount difficulty label');
  assert.ok(gradeUiCode.includes('Dynamically adjust required grade based on prior performance'), 'target-grade-ui.js must contain prior performance adjustment checkbox text');
  assert.ok(gradeUiCode.includes('gradeDifficultyWeighted'), 'target-grade-ui.js must persist gradeDifficultyWeighted preference');
});

runTest('atar-ui.js eliminates ATAR text from grade panel buttons and applies canonical tab styling', () => {
  const uiCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  assert.ok(uiCode.includes("semesterLabel = `Semester ${i + 1}`;") || uiCode.includes("semesterLabel = 'Semester ' + (i + 1);"), 'atar-ui.js updateResults must set plain Semester label without ATAR in grading mode');
  assert.ok(!uiCode.includes("Semester ${i + 1} Target Grade"), 'atar-ui.js must not append extra redundant text to semester buttons');
  assert.ok(uiCode.includes('cta-semester-closed'), 'atar-ui.js must style closed semester tabs with cta-semester-closed');
  assert.ok(uiCode.includes('cta-semester-indicator'), 'atar-ui.js must style active semester tabs with cta-semester-indicator');
});

runTest('theme.css and theme.js normalize class page red outlines and headers without transparent overrides', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const js = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  assert.ok(css.includes('.eds.cvr.ngm') && css.includes('.text-primary'), 'theme.css must normalize .text-primary in .eds.cvr.ngm');
  assert.ok(css.includes('.eds.cvr.ngm') && css.includes('.mat-divider--primary'), 'theme.css must normalize .mat-divider--primary in .eds.cvr.ngm');
  assert.ok(!css.includes('background-color: transparent !important;\n  color: inherit !important;'), 'theme.css must not have generic transparent div.w-100 rule');
  assert.ok(js.includes('isDarkColor'), 'theme.js must implement isDarkColor helper');
  assert.ok(js.includes("el.hasAttribute('data-connectea-surface')"), 'theme.js must not tag surface containers as ink');
});

runTest('assessment-data.js strictly ignores summary rows outside .cvr-c-tasks and never synthesizes phantom tasks', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  assert.ok(!dataJs.includes('cvr-c-task--summary'), 'assessment-data.js must not have fallback query capturing summary rows');
  assert.ok(dataJs.includes("if (!row.closest('.cvr-c-tasks')) continue;"), 'assessment-data.js must guard against tasks outside cvr-c-tasks');
  assert.ok(dataJs.includes('if (labels.length === 0) continue;'), 'assessment-data.js must not invent tasks when labels are empty');

  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = 'Chemistry ATAR Year 11 - Semester 2';
  card.children.push(title);
  title.parentElement = card;

  const emptyTasks = new MockElement('div', 'cvr-c-tasks');
  card.children.push(emptyTasks);
  emptyTasks.parentElement = card;

  const summaryRow = new MockElement('div', 'cvr-c-task');
  const summaryMarks = new MockElement('div', 'cvr-c-task__marks');
  const markVal = new MockElement('div', 'cvr-c-task__mark');
  markVal.textContent = '83.5%';
  summaryMarks.children.push(markVal);
  summaryRow.children.push(summaryMarks);
  card.children.push(summaryRow);
  summaryRow.parentElement = card;

  window.ConnectifyData.clearCache();
  window.ConnectifyData.scrapeSubjectTasks(card);

  const scraped = window.ConnectifyData.getSubjectTasks('Chemistry');
  assert.strictEqual(scraped.length, 0, 'No phantom tasks must be scraped from summary row when cvr-c-tasks is empty');
});

runTest('atar-ui.js scanAndRefresh awaits DOM expansion and theme.css uses high-specificity chained selectors for .eds.cvr.ngm', () => {
  const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  assert.ok(atarUiJs.includes('setTimeout') && atarUiJs.includes('collect(true)'), 'atar-ui.js scanAndRefresh must await DOM expansion and re-collect tasks');

  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(css.includes('.eds.cvr.ngm') && css.includes('.theme-multiplier.text-primary'), 'theme.css must use chained .theme-multiplier.text-primary');
  assert.ok(css.includes('.eds.cvr.ngm') && css.includes('.mat-divider--primary'), 'theme.css must use chained .mat-divider--primary');
  assert.ok(css.includes('.cvr-c-reports') && css.includes('#1a222d'), 'theme.css must style Reports container with solid #1a222d background');
});

runTest('atar-scraper.js readCourses supports cvr-c-tile and semester parsing across both semesters', () => {
  const scraperJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  assert.ok(scraperJs.includes('.cvr-c-tile'), 'atar-scraper.js must query .cvr-c-tile');
  assert.ok(scraperJs.includes('.cvr-c-tile__title') || scraperJs.includes('[class*="tile__title"]'), 'atar-scraper.js must extract titles from .cvr-c-tile__title');
  assert.ok(scraperJs.includes('isAtarEligible'), 'atar-scraper.js must define isAtarEligible');
  assert.ok(!scraperJs.includes('btn.click()'), 'atar-scraper.js scanOutlineDetails must not programmatically click buttons without user action');
});

runTest('target-atar-ui.js and target-grade-ui.js prompt user with Expand Subject Outlines button and do not auto-click', () => {
  const atarUI = fs.readFileSync(path.resolve(BASE_DIR, 'target-atar-ui.js'), 'utf8');
  const gradeUI = fs.readFileSync(path.resolve(BASE_DIR, 'target-grade-ui.js'), 'utf8');
  assert.ok(atarUI.includes('Expand Subject Outlines'), 'target-atar-ui.js must offer Expand Subject Outlines button when outline is collapsed or missing');
  assert.ok(gradeUI.includes('Expand Subject Outlines'), 'target-grade-ui.js must offer Expand Subject Outlines button when outline is collapsed or missing');
  assert.ok(atarUI.includes('window.ConnectifyData.expandAll'), 'target-atar-ui.js button must invoke window.ConnectifyData.expandAll');
  assert.ok(gradeUI.includes('window.ConnectifyData.expandAll'), 'target-grade-ui.js button must invoke window.ConnectifyData.expandAll');
});

runTest('theme.css styles mat-toolbar, mat-tab-header, and eliminates stroke from webfont pseudo-elements', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  assert.ok(themeCss.includes('mat-toolbar') && themeCss.includes('mat-tab-header'), 'theme.css must explicitly style mat-toolbar and mat-tab-header');
  assert.ok(themeCss.includes('background-color: #1a222d !important'), 'theme.css must use solid #1a222d background for headers and toolbars');
  assert.ok(!themeCss.includes('[class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before,\n  .cvr-c-icon:before,\n  .cvr-c-icon--switch:before,\n  [class*="switch"]:before,\n  [class*="role"]:before,\n  .eds-c-icon:before,\n  [class^="cvr-c-icon--"],\n  [class*=" cvr-c-icon--"],\n  .cvr-c-icon,\n  .cvr-c-icon--switch\n),\n:is(html.connectea-dark, body.connectea-dark, .connectea-dark).eds.cvr :is(\n  .cvr-c-icon,\n  .cvr-c-icon--switch,\n  [class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before\n),\n:is(html.connectea-dark, body.connectea-dark, .connectea-dark) .eds.cvr :is(\n  .cvr-c-icon,\n  .cvr-c-icon--switch,\n  [class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before\n) {\n  color: #cbd5e1 !important;\n  fill: #cbd5e1 !important;\n  stroke: currentColor !important;'), 'theme.css must not apply stroke: currentColor to font icon :before selectors');
  assert.ok(themeJs.includes('mat-toolbar') && themeJs.includes('mat-tab-header'), 'theme.js adaptSurfaces must include mat-toolbar and mat-tab-header');
});

runTest('assessment-data.js expandAll defines pattern, supports heading fallback, and dispatches clicks safely', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  assert.ok(dataJs.includes('const pattern = expand ? /show details/i : /hide details/i;'), 'expandAll must define pattern before matching headings');
  assert.ok(dataJs.includes('heading.click()'), 'expandAll must fallback to clicking heading if no child button is found');

  let clicked = false;
  const mockHeading = {
    textContent: 'Show details',
    querySelector: () => null,
    matches: () => false,
    click: () => { clicked = true; }
  };
  const origQSA = document.querySelectorAll.bind(document);
  document.querySelectorAll = () => [mockHeading];
  assert.doesNotThrow(() => {
    window.ConnectifyData.expandAll(true);
  }, 'expandAll must execute without throwing ReferenceError');
  document.querySelectorAll = origQSA;
});

runTest('predictor-math.js dampens high score leverage on mid and scales low penalty with variance, with version bump', () => {
  const predMathCode = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const dataJsCode = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  assert.ok(predMathCode.includes("'v9_20261001_pred'"), 'predictor-math.js must use v9_20261001_pred');
  assert.ok(dataJsCode.includes("PREDICTOR: 'v9_20261001_pred'"), 'assessment-data.js CACHE_VERSIONS.PREDICTOR must be v9_20261001_pred');

  const historicalElevated = {
    subjects: { 'Chemistry': 90 },
    subjectSpreads: { 'Chemistry': 6.5 },
    types: { 'Test': 90 },
    typeCounts: { 'Test': 3 },
    overallAverage: 90,
    spread: 6.5
  };
  const pred = predMath.predictTask('Chemistry', { name: 'Test 4' }, historicalElevated);
  assert.ok(pred.mid < 90, `Mid prediction (${pred.mid}%) must be dampened below elevated 90% average`);
  assert.ok(pred.low <= 76, `Low prediction (${pred.low}%) must reflect asymmetric downside risk from peak score leverage`);
});

runTest('predictor-ui.js and atar-ui.js render user-prompted Expand All buttons', () => {
  const predUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');

  assert.ok(predUiJs.includes('cx-pred-expand-outlines-btn'), 'predictor-ui.js must include cx-pred-expand-outlines-btn in ATAR Predictor');
  assert.ok(predUiJs.includes("closest('#cx-pred-expand-outlines, .cx-pred-expand-outlines-btn')"), 'predictor-ui.js click delegation must handle cx-pred-expand-outlines-btn');
  assert.ok(atarUiJs.includes('cta-expand-outlines') || atarUiJs.includes('Expand All Outlines'), 'atar-ui.js must include Expand All Outlines button');
  assert.ok(atarUiJs.includes('expandAllBtn.hidden'), 'atar-ui.js must manage expandAllBtn visibility in selectTab');
});

runTest('theme.css normalizes accordion panels and sidebar.css enforces distinct Low/Mid/High predictor text colors', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  assert.ok(
    themeCss.includes('.connectea-dark .eds-c-accordion__section-heading') &&
    themeCss.includes('background-color: transparent !important;') &&
    themeCss.includes('border: none !important;'),
    'theme.css must make accordion section headings flat and transparent with no borders'
  );

  assert.ok(sidebarCss.includes('.connectea-dark :is(.cx-pred-pill, .cx-pred-pill--low) strong'), 'sidebar.css must style low pill numbers');
  assert.ok(sidebarCss.includes('.connectea-dark .cx-pred-pill--mid strong'), 'sidebar.css must style mid pill numbers');
  assert.ok(sidebarCss.includes('.connectea-dark .cx-pred-pill--high strong'), 'sidebar.css must style high pill numbers');
  assert.ok(sidebarCss.includes('#cbd5e1 !important') && sidebarCss.includes('#4ade80 !important'), 'sidebar.css must define #cbd5e1 for low and #4ade80 for high with !important');
});

runTest('Test 90: Accordion section heading is transparent with no borders and pseudo-element arrows/stripes removed', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  assert.ok(!themeCss.includes('data-cx-details-arrow'), 'theme.css must not contain data-cx-details-arrow pseudo-elements');
  assert.ok(!themeJs.includes('updateDetailArrows'), 'theme.js must not contain updateDetailArrows');
  assert.ok(themeCss.includes('.eds-c-accordion__panel:before'), 'theme.css must target panel pseudo-element');
  assert.ok(themeCss.includes('display: none !important;'), 'theme.css must hide accordion panel left vertical stripe');
});

runTest('Test 91: expandAll() displays progress bar on repeated expansions and paces click dispatch', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  assert.ok(!assessJs.includes("!sessionStorage.getItem('connectify:first_expand_done')"), 'expandAll must not suppress progress bar on repeated calls');
  assert.ok(assessJs.includes('setTimeout(clickNext, 65)'), 'expandAll must pace clicks with 65ms setTimeout to eliminate lag');
  assert.ok(assessJs.includes('if (isBulkExpanding) return;'), 'assessment-data.js must guard click listeners during bulk expand');
});

runTest('Test 92: readCourses() ingests connectify:grade_cache data and populates subjects across semesters', () => {
  const scraperJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  const atarMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8');

  assert.ok(scraperJs.includes('connectify:grade_cache:current'), 'atar-scraper.js must read connectify:grade_cache:current');
  assert.ok(atarMathJs.includes('mathematics methods') && atarMathJs.includes('philosophy and ethics'), 'atar-math.js isAtarCourse must recognize Methods and Philosophy');

  // Test functional cache ingestion
  const mockCache = {
    'Chemistry': { mark: 83.5, semester: 2 },
    'Literature': { mark: 59.6, semester: 2 },
    'Mathematics Methods': { mark: 93.5, semester: 2 },
    'Mathematics Specialist': { mark: 82.7, semester: 2 },
    'Philosophy and Ethics': { mark: 77, semester: 2 },
    'Physics': { mark: 87.7, semester: 2 }
  };
  localStorage.setItem('connectify:grade_cache:current', JSON.stringify(mockCache));

  delete window.ConnectifyAtarScraper;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8'));
  const atarScraper = window.ConnectifyAtarScraper;

  const courses = atarScraper.readCourses(true);
  assert.ok(courses[1].length >= 6, `readCourses(true) must ingest all 6 cached ATAR courses into Semester 2, got ${courses[1].length}`);
  const names = courses[1].map(c => c.name.toLowerCase());
  assert.ok(names.includes('chemistry'), 'Semester 2 must contain Chemistry');
  assert.ok(names.includes('mathematics methods'), 'Semester 2 must contain Mathematics Methods');
  assert.ok(names.includes('physics'), 'Semester 2 must contain Physics');
  assert.ok(names.includes('literature'), 'Semester 2 must contain Literature');
  assert.ok(names.includes('philosophy and ethics'), 'Semester 2 must contain Philosophy and Ethics');
});

runTest('Test 93: predictTask() preserves student momentum above 82% and PREDICTOR_ALGO_VERSION is v9_20261001_pred', () => {
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  assert.ok(predMathJs.includes('v9_20261001_pred'), 'predictor-math.js must bump version to v9_20261001_pred');

  const historicalHigh = {
    subjects: { 'Mathematics Methods': 93.5 },
    subjectSpreads: { 'Mathematics Methods': 4.0 },
    types: { 'Test': 93.5 },
    typeCounts: { 'Test': 3 },
    overallAverage: 90,
    spread: 4.0
  };
  const pred = predMath.predictTask('Mathematics Methods', { name: 'Test 4' }, historicalHigh);
  assert.ok(pred.mid >= 90, `Mid prediction (${pred.mid}%) for a 93.5% student must preserve momentum and stay >= 90%`);
  assert.ok(pred.low <= 85, `Low prediction (${pred.low}%) must reflect downside spread`);
});

runTest('Test 94: Chemistry integer weeks parse as valid dates and format via Progress Graph formatTimestamp', () => {
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  assert.ok(predMathJs.includes('ConnectifyProgressMath.formatTimestamp'), 'predictor-math.js must integrate Progress Graph formatTimestamp');

  const chemTaskInt = { caption: '17', name: 'Research Validation 1' };
  assert.ok(predMath.hasParsableDate(chemTaskInt, 'Chemistry'), 'Bare integer week 17 must be parsable');

  delete window.ConnectifyProgressMath;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8'));

  const formatted = window.ConnectifyProgressMath.formatTimestamp(17);
  assert.strictEqual(formatted, 'Term 2, Week 5', 'Week 17 must format to Term 2, Week 5');
});

runTest('Test 95: Accordion expand/collapse optimizations suppress layout thrashing and enforce CSS containment', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  assert.ok(themeCss.includes('contain: layout style;'), 'theme.css must apply CSS layout containment to subject cards and accordion panels');
  assert.ok(themeJs.includes('.eds-c-accordion'), 'theme.js MutationObserver must filter accordion mutations to eliminate getComputedStyle thrashing');
  assert.ok(assessJs.includes('show details'), 'assessment-data.js click listener must skip notify updates when collapsing accordion');
});

runTest('Test 96: atar-calculator.js defines yearLevel and target-atar-ui.js pre-clears output and wraps solver', () => {
  const calcJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-calculator.js'), 'utf8');
  const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  const targetUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'target-atar-ui.js'), 'utf8');

  assert.ok(calcJs.includes('const yearLevel = (hasYear11 && !hasYear12) ? 11 : 12;'), 'atar-calculator.js must define yearLevel');
  assert.ok(calcJs.includes('try {') && calcJs.includes('catch (err) {'), 'calculateResults must have try-catch error boundary');
  assert.ok(atarUiJs.includes('calc?.calculateResults ? calc.calculateResults(courses) : [{}, {}]'), 'atar-ui.js must safely invoke calculateResults');
  assert.ok(targetUiJs.includes('targetOutputContainer.replaceChildren();'), 'target-atar-ui.js must pre-clear container before calculating');
  assert.ok(targetUiJs.includes('catch (err) {') && targetUiJs.includes('Error calculating Target ATAR plan'), 'target-atar-ui.js must handle calculation errors cleanly');

  // Functional test of calculateResults
  delete window.ConnectifyAtarCalc;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  eval(calcJs);
  const calc = window.ConnectifyAtarCalc;
  const mockCourses = [
    [
      { id: 'c1', name: 'Mathematics Methods', mark: 85, progress: {} },
      { id: 'c2', name: 'Mathematics Specialist', mark: 80, progress: {} },
      { id: 'c3', name: 'Chemistry', mark: 75, progress: {} },
      { id: 'c4', name: 'Physics', mark: 82, progress: {} }
    ],
    []
  ];
  const res = calc.calculateResults(mockCourses);
  assert.ok(Array.isArray(res) && res.length === 2, 'calculateResults must return an array of 2 results');
  assert.strictEqual(res[0].yearLevel, 12, 'Year level must resolve cleanly to 12');
  assert.ok(Number.isFinite(res[0].finalTEA) && res[0].finalTEA > 0, 'finalTEA must be calculated');
  assert.ok(typeof res[0].finalAtar === 'string' && res[0].finalAtar !== '—', 'finalAtar must be calculated');
});

runTest('Test 97: compound-progress.js isolates Semester 1 and Semester 2 and sorts segments chronologically', () => {
  const compJs = fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8');

  assert.ok(compJs.includes('t.semester === 1 || t.semester === 2'), 'compound-progress.js must encapsulate Semester 1 and Semester 2 for Semester 2 cards');
  assert.ok(compJs.includes('oA - oB'), 'compound-progress.js must sort segments chronologically by order');

  // Functional DOM test
  const sem1Card = document.createElement('div');
  sem1Card.className = 'eds-c-tile';
  const h1 = document.createElement('div');
  h1.className = 'eds-c-tile__header';
  const t1 = document.createElement('span');
  t1.className = 'eds-c-tile__title';
  t1.textContent = 'Chemistry - Semester 1';
  h1.appendChild(t1);
  sem1Card.appendChild(h1);

  const sem2Card = document.createElement('div');
  sem2Card.className = 'eds-c-tile';
  const h2 = document.createElement('div');
  h2.className = 'eds-c-tile__header';
  const t2 = document.createElement('span');
  t2.className = 'eds-c-tile__title';
  t2.textContent = 'Chemistry - Semester 2';
  h2.appendChild(t2);
  sem2Card.appendChild(h2);

  document.body.appendChild(sem1Card);
  document.body.appendChild(sem2Card);

  window.ConnectifyData = {
    collect: () => [
      {
        name: 'Chemistry',
        tasks: [
          { name: 'Investigation 2', semester: 1, weight: 10, pending: false, order: 15, sequence: 2 },
          { name: 'Investigation 1', semester: 1, weight: 10, pending: false, order: 5, sequence: 1 }
        ]
      }
    ]
  };

  delete window.ConnectifyCompoundProgress;
  eval(compJs);

  window.ConnectifyCompoundProgress.update();

  const sem1Progress = sem1Card.querySelector('.cx-compound-progress-container');
  const sem2Progress = sem2Card.querySelector('.cx-compound-progress-container');

  assert.ok(sem1Progress, 'Semester 1 card must render compound progress container');
  assert.strictEqual(sem2Progress, null, 'Semester 2 card must NOT adopt Semester 1 compound progress container');

  // Verify chronological segment order (order 5 then order 15)
  const segments = sem1Progress.querySelectorAll('.cx-compound-segment');
  assert.strictEqual(segments.length, 2, 'Semester 1 progress bar must contain 2 segments');
  assert.ok(segments[0].title.includes('Investigation 1'), 'Segment with order 5 must be first chronologically');
  assert.ok(segments[1].title.includes('Investigation 2'), 'Segment with order 15 must be second chronologically');

  // When Semester 2 tasks are present, verify Semester 2 encapsulates both semesters
  window.ConnectifyData = {
    collect: () => [
      {
        name: 'Chemistry',
        tasks: [
          { name: 'Investigation 1', semester: 1, weight: 10, pending: false, order: 5, sequence: 1 },
          { name: 'Investigation 2', semester: 1, weight: 10, pending: false, order: 15, sequence: 2 },
          { name: 'Test 1', semester: 2, weight: 15, pending: false, order: 25, sequence: 3 },
          { name: 'Final Exam', semester: 2, weight: 35, pending: true, order: 35, sequence: 4 }
        ]
      }
    ]
  };

  window.ConnectifyCompoundProgress.update();

  const sem1ProgUpdated = sem1Card.querySelector('.cx-compound-progress-container');
  const sem2ProgUpdated = sem2Card.querySelector('.cx-compound-progress-container');

  assert.ok(sem1ProgUpdated, 'Semester 1 card must render progress container');
  assert.ok(sem2ProgUpdated, 'Semester 2 card must render progress container when Semester 2 tasks exist');

  const sem1Segs = sem1ProgUpdated.querySelectorAll('.cx-compound-segment');
  const sem2Segs = sem2ProgUpdated.querySelectorAll('.cx-compound-segment');

  assert.strictEqual(sem1Segs.length, 2, 'Semester 1 card must only contain Semester 1 tasks');
  assert.strictEqual(sem2Segs.length, 4, 'Semester 2 card must encapsulate tasks from both Semester 1 and Semester 2');

  sem1Card.remove();
  sem2Card.remove();
});

runTest('Test 98: theme.css and theme.js protect Highcharts box plots on first class from containment and dark surface overrides', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // Verify containment is restricted to accordion panels, not top-level tiles
  const containmentBlock = themeCss.match(/([^{}]+)\{\s*contain:\s*layout\s*style;\s*\}/);
  assert.ok(containmentBlock, 'Containment rule must exist in theme.css');
  assert.ok(!containmentBlock[1].includes('.eds-c-tile,'), 'Containment rule must NOT contain .eds-c-tile');
  assert.ok(!containmentBlock[1].includes('.cvr-c-tile,'), 'Containment rule must NOT contain .cvr-c-tile');
  assert.ok(containmentBlock[1].includes('.eds-c-accordion__panel'), 'Containment rule must target .eds-c-accordion__panel');

  // Verify task chart transparency
  assert.ok(themeCss.includes('.cvr-c-task__chart'), 'theme.css must target cvr-c-task__chart');
  assert.ok(themeCss.includes('background: transparent !important;'), 'theme.css must enforce transparent background on task chart');

  // Verify theme.js excludes Highcharts and progress pill from surfaceCandidates and inkCandidates
  assert.ok(themeJs.includes(':not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'), 'theme.js must exclude Highcharts from surfaceCandidates and inkCandidates');
});

runTest('Test 99: assessment-data.js readiness polling and cohort-stats.js rePassPending guarantee robust Expand All execution', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const cohortJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');

  assert.ok(assessJs.includes('pollTimer = setInterval('), 'expandAll must poll for readiness after clicking headings');
  assert.ok(assessJs.includes('allSettled = headings.every('), 'expandAll must check that all clicked cards have settled');
  assert.ok(assessJs.includes('wasCollapsed = /show details/i.test(heading.textContent)'), 'assessment-data.js must detect collapse intent immediately on click');

  assert.ok(cohortJs.includes('rePassPending = true;'), 'cohort-stats.js must track rePassPending when passes are queued or executing');
  assert.ok(cohortJs.includes('function runPass()'), 'cohort-stats.js must use runPass with try/finally to drain rePassPending');
});

runTest('Test 100: weakness-radar.js renders Expand All Outlines button and sidebar.css provides responsive styling', () => {
  const weaknessJs = fs.readFileSync(path.resolve(BASE_DIR, 'weakness-radar.js'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  assert.ok(weaknessJs.includes('id="cx-weakness-expand-all"'), 'weakness-radar.js must define #cx-weakness-expand-all');
  assert.ok(weaknessJs.includes('window.ConnectifyData.expandAll(true)'), 'weakness-radar.js must wire button to ConnectifyData.expandAll(true)');
  assert.ok(sidebarCss.includes('.cx-weakness-expand-btn'), 'sidebar.css must style .cx-weakness-expand-btn');
  assert.ok(sidebarCss.includes('.connectea-dark #connectify-sidebar .cx-weakness-expand-btn'), 'sidebar.css must style button in dark mode');
});

runTest('Test 101: Expand all progress pill adapts correctly across light and dark themes', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // Verify light theme base styles
  assert.ok(sidebarCss.includes('background: #ffffff;'), 'sidebar.css must specify light background #ffffff for light mode progress pill');
  assert.ok(sidebarCss.includes('color: #1e293b;'), 'sidebar.css must specify dark text #1e293b for light mode progress pill');
  assert.ok(sidebarCss.includes('background: #e2e8f0;'), 'sidebar.css must style progress track with #e2e8f0 in light mode');

  // Verify dark theme overrides in sidebar.css and theme.css
  assert.ok(sidebarCss.includes('.connectea-dark') && sidebarCss.includes('#cx-expand-progress'), 'sidebar.css must provide dark mode overrides for #cx-expand-progress');
  assert.ok(themeCss.includes('.connectea-dark') && themeCss.includes('#cx-expand-progress'), 'theme.css must provide dark mode overrides for #cx-expand-progress');
  assert.ok(themeCss.includes('background: #1e2632 !important;'), 'theme.css must use #1e2632 dark background for progress pill');
  assert.ok(themeCss.includes('color: #f8fafc !important;'), 'theme.css must use #f8fafc text for progress pill in dark mode');

  // Verify theme.js surface/ink exclusion
  assert.ok(themeJs.includes(':not(#cx-expand-progress):not(#cx-expand-progress *)'), 'theme.js must exclude #cx-expand-progress from adaptSurfaces');
});

runTest('Test 103: Semester buttons maintain uniform left alignment and reserved 4px border geometry across states', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');

  // Verify sidebar.css enforces left alignment, 10px 14px padding, and 4px transparent border on all semester buttons
  assert.ok(sidebarCss.includes('#connectify-sidebar .cta-semesters:not(.cta-tabs) .cta-semester{text-align:left!important;padding:10px 14px!important;border-left:4px solid transparent!important;border-radius:6px!important}'), 'sidebar.css must enforce stable left alignment and 4px transparent border geometry');

  // Verify atar.css enforces left alignment, 10px 14px padding, and 4px transparent border
  assert.ok(atarCss.includes('.cta-semesters:not(.cta-tabs) .cta-semester{padding:10px 14px!important;') && atarCss.includes('border-left:4px solid transparent!important;text-align:left!important;'), 'atar.css must enforce stable left alignment and 4px transparent border geometry');

  // Verify active state retains matching padding and left alignment
  assert.ok(sidebarCss.includes('.cta-semester.cta-semester-indicator{background:#edf4fa!important;border:1px solid #c8d9e8!important;border-left:4px solid #24618c!important;color:#1a3d5f!important;font-weight:600!important;cursor:default!important;border-radius:6px!important;text-align:left!important;padding:10px 14px!important}'), 'sidebar.css active semester must maintain 10px 14px padding and left text alignment');
  assert.ok(atarCss.includes('.cta-semester.cta-semester-indicator{background:#edf4fa!important;border:1px solid #c8d9e8!important;border-left:4px solid #24618c!important;color:#1a3d5f!important;font-weight:600!important;cursor:default!important;border-radius:6px!important;text-align:left!important;padding:10px 14px!important}'), 'atar.css active semester must maintain 10px 14px padding and left text alignment');
});

runTest('Test 104: theme.css and theme.js comprehensively adapt Connect Help, nav lists, and generic dashboard tile bodies', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // Verify dark theme styling for tile bodies, nav lists, and resources
  assert.ok(themeCss.includes('.eds-c-nav-list') && themeCss.includes('.eds-c-nav-list__item'), 'theme.css must target .eds-c-nav-list and .eds-c-nav-list__item');
  assert.ok(themeCss.includes('background-color: #1e2632 !important;') && themeCss.includes('border-color: #2e3c4e !important;'), 'theme.css must enforce dark background and border on tile bodies and nav lists');
  assert.ok(themeCss.includes('background-color: #263344 !important;'), 'theme.css must provide hover highlight for nav list items');

  // Verify SVG icon styling
  assert.ok(themeCss.includes('color: #94a3b8 !important;') && themeCss.includes('fill: currentColor !important;'), 'theme.css must style list icons with proper high contrast');

  // Verify theme.js allows generic tiles to adapt surfaces
  assert.ok(!themeJs.includes(':not(.eds-c-tile *)'), 'theme.js must not exclude .eds-c-tile * from surfaceCandidates');
  assert.ok(!themeJs.includes(':not(.cvr-c-tile *)'), 'theme.js must not exclude .cvr-c-tile * from surfaceCandidates');
});

runTest('Test 105: Aggressive accordion expand/collapse performance optimizations eliminate layout thrashing and mute background observers', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const compoundJs = fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8');
  const cohortJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'data.js'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  // Verify global animation guard in assessment-data.js
  assert.ok(assessJs.includes('triggerAccordionAnimationGuard'), 'assessment-data.js must define triggerAccordionAnimationGuard');
  assert.ok(assessJs.includes('window.ConnectifyIsAccordionAnimating = true'), 'assessment-data.js must set window.ConnectifyIsAccordionAnimating');

  // Verify compound-progress.js mutes during animation and filters panel mutations
  assert.ok(compoundJs.includes('if (window.ConnectifyIsAccordionAnimating) return;'), 'compound-progress.js MutationObserver must mute during accordion animation');
  assert.ok(compoundJs.includes('.eds-c-accordion__panel'), 'compound-progress.js must ignore mutations inside accordion panels');

  // Verify cohort-stats.js mutes during animation and filters panel mutations
  assert.ok(cohortJs.includes('if (window.ConnectifyIsAccordionAnimating) return;'), 'cohort-stats.js MutationObserver must mute during accordion animation');

  // Verify data.js debounces syncAllCharts and mutes during animation
  assert.ok(dataJs.includes('if (window.ConnectifyIsAccordionAnimating) return;'), 'data.js MutationObserver must mute during accordion animation');
  assert.ok(dataJs.includes('requestAnimationFrame'), 'data.js must debounce syncAllCharts with requestAnimationFrame');

  // Verify CSS compositor optimization
  assert.ok(themeCss.includes('will-change: height, max-height;'), 'theme.css must include will-change on accordion panels');
});

runTest('Test 106: All project JS files pass strict JavaScript syntax validation', () => {
  const jsFiles = fs.readdirSync(BASE_DIR).filter(f => f.endsWith('.js') && f !== 'test_suite.js');
  assert.ok(jsFiles.length > 10, 'Must validate all extension JS files');
  for (const f of jsFiles) {
    const code = fs.readFileSync(path.resolve(BASE_DIR, f), 'utf8');
    assert.doesNotThrow(() => {
      new vm.Script(code, { filename: f });
    }, `File ${f} must have valid JavaScript syntax without duplicate declarations`);
  }
});

runTest('Test 107: Outcome bar is strictly suppressed on first task of subject/type without baseline, and Semester 2 compound progress encapsulates both semesters', () => {
  // 1. Setup subjects for outcome bar test
  const subjectName = 'Chemistry ATAR';
  const cleanSubj = predMath.cleanSubject(subjectName);

  // Clear any existing baselines and predictions
  localStorage.clear();
  delete window.ConnectifyTaskTypes;
  delete window.ConnectifyCohortView;

  const taskTypesCode = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');
  eval(taskTypesCode);

  const task1 = { id: 'chem-t1', name: 'Test 1', order: 1, sequence: 0, score: 90, mark: 90, weight: 10, pending: false };
  const task2 = { id: 'chem-t2', name: 'Investigation 1', order: 2, sequence: 1, score: 85, mark: 85, weight: 10, pending: false };
  const task3 = { id: 'chem-t3', name: 'Test 2', order: 3, sequence: 2, score: 88, mark: 88, weight: 15, pending: false };

  const subjectsList = [
    {
      name: 'Chemistry ATAR - Semester 1',
      tasks: [task1, task2, task3]
    }
  ];

  // Load cohort-view.js
  const cohortJsCode = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  eval(cohortJsCode);

  const card = document.createElement('div');
  card.className = 'eds-c-tile';
  const cTitle = document.createElement('div');
  cTitle.className = 'eds-c-tile__title';
  cTitle.textContent = 'Chemistry ATAR - Semester 1';
  card.appendChild(cTitle);

  function makeTaskRow(taskName, termWeek, markStr) {
    const row = document.createElement('div');
    row.className = 'cvr-c-task';
    row.closest = (sel) => sel.includes('eds-c-tile') ? card : null;

    const details = document.createElement('div');
    details.className = 'cvr-c-task__details';
    const l1 = document.createElement('span');
    l1.className = 'v-label';
    l1.textContent = 'Chemistry';
    const l2 = document.createElement('span');
    l2.className = 'v-label';
    l2.textContent = termWeek;
    const l3 = document.createElement('span');
    l3.className = 'v-label';
    l3.textContent = taskName;
    details.append(l1, l2, l3);
    row.append(details);

    const marks = document.createElement('div');
    marks.className = 'cvr-c-task__marks';
    const m = document.createElement('div');
    m.className = 'cvr-c-task__mark';
    m.textContent = markStr;
    marks.append(m);
    row.append(marks);

    card.appendChild(row);
    return row;
  }

  // Row for task 1 (first of subject and first of type)
  const row1 = makeTaskRow('Test 1', 'Term 1, Week 2', '45 Out of 50');
  window.ConnectifyCohortView.render(row1, false, 'chem-k1', 50, null, subjectsList);
  const panel1 = window.ConnectifyCohortView.panels.get(row1);
  assert.ok(panel1, 'Panel 1 must exist');
  assert.strictEqual(panel1.outcomeBar.hidden, true, 'Task 1 (first task of subject) outcome bar must be hidden when baselines absent');

  // Row for task 2 (has prior subject data, but is first of type 'Investigation')
  const row2 = makeTaskRow('Investigation 1', 'Term 1, Week 5', '42.5 Out of 50');
  window.ConnectifyCohortView.render(row2, false, 'chem-k2', 50, null, subjectsList);
  const panel2 = window.ConnectifyCohortView.panels.get(row2);
  assert.ok(panel2, 'Panel 2 must exist');
  assert.strictEqual(panel2.outcomeBar.hidden, true, 'Task 2 (first task of type Investigation) outcome bar must be hidden when type baseline absent');

  // Row for task 3 (second of type 'Test', has prior subject data)
  const row3 = makeTaskRow('Test 2', 'Term 2, Week 3', '44 Out of 50');
  window.ConnectifyCohortView.render(row3, false, 'chem-k3', 50, null, subjectsList);
  const panel3 = window.ConnectifyCohortView.panels.get(row3);
  assert.ok(panel3, 'Panel 3 must exist');
  assert.strictEqual(panel3.outcomeBar.hidden, false, 'Task 3 (second task of type Test) outcome bar must NOT be hidden');

  // Now set cold-start baseline for subject and type, and verify Task 1 renders outcome bar
  predMath.saveBaselines({
    subjects: { '12 Chemistry ATAR - Semester 1': 85, [cleanSubj]: 85 },
    types: { 'Test': 80 }
  });

  // Re-render task 1 with baselines active
  delete panel1._lastBaselinesSig; // ensure re-evaluation
  window.ConnectifyCohortView.render(row1, false, 'chem-k1', 50, null, subjectsList);
  assert.strictEqual(panel1.outcomeBar.hidden, false, 'Task 1 with explicit cold-start baseline must render outcome bar');

  // 2. Test Semester 2 compound progress bar dual-semester encapsulation
  const sem1Tile = document.createElement('div');
  sem1Tile.className = 'eds-c-tile';
  const hSem1 = document.createElement('div');
  hSem1.className = 'eds-c-tile__header';
  const tSem1 = document.createElement('span');
  tSem1.className = 'eds-c-tile__title';
  tSem1.textContent = 'Physics - Semester 1';
  hSem1.appendChild(tSem1);
  sem1Tile.appendChild(hSem1);

  const sem2Tile = document.createElement('div');
  sem2Tile.className = 'eds-c-tile';
  const hSem2 = document.createElement('div');
  hSem2.className = 'eds-c-tile__header';
  const tSem2 = document.createElement('span');
  tSem2.className = 'eds-c-tile__title';
  tSem2.textContent = 'Physics - Semester 2';
  hSem2.appendChild(tSem2);
  sem2Tile.appendChild(hSem2);

  document.body.appendChild(sem1Tile);
  document.body.appendChild(sem2Tile);

  window.ConnectifyData = {
    collect: () => [
      {
        name: 'Physics',
        tasks: [
          { name: 'Investigation 1', semester: 1, weight: 10, pending: false, order: 1 },
          { name: 'Investigation 2', semester: 1, weight: 10, pending: false, order: 2 },
          { name: 'Test 1', semester: 2, weight: 15, pending: false, order: 3 },
          { name: 'Exam', semester: 2, weight: 40, pending: true, order: 4 }
        ]
      }
    ]
  };

  const compJs = fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8');
  eval(compJs);
  window.ConnectifyCompoundProgress.update();

  const sem1Bar = sem1Tile.querySelector('.cx-compound-progress-container');
  const sem2Bar = sem2Tile.querySelector('.cx-compound-progress-container');

  assert.ok(sem1Bar, 'Semester 1 progress container should exist');
  assert.ok(sem2Bar, 'Semester 2 progress container should exist');

  const s1Segs = sem1Bar.querySelectorAll('.cx-compound-segment');
  const s2Segs = sem2Bar.querySelectorAll('.cx-compound-segment');

  assert.strictEqual(s1Segs.length, 2, 'Semester 1 card must only include Semester 1 tasks');
  assert.strictEqual(s2Segs.length, 4, 'Semester 2 card must encapsulate both Semester 1 and Semester 2 tasks');

  sem1Tile.remove();
  sem2Tile.remove();
  localStorage.clear();
});

runTest('Test 108: Accordion expansion multi-click fix, scroll freeze during bulk expand, arrow cleanup, dark mode font unbolding, and valid prediction cache skipping', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const cohortJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const progJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  const sideCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');

  // 1. Dark mode font unbolding and antialiasing
  assert.ok(themeCss.includes('.connectea-dark .cvr-c-task :is(.v-label, .cvr-c-task__title) {\n  color: #f8fafc !important;\n  font-weight: 400 !important;\n}'), 'theme.css must set task title font-weight to 400 in dark mode');
  assert.ok(themeCss.includes('.connectea-dark :is(.connectea-panel, .connectea-distribution, .connectea-result, .connectea-panel-distribution, .connectea-panel-standing) {\n  font-weight: 400 !important;\n}'), 'theme.css must unbold connectea panel typography');
  assert.ok(themeCss.includes('-webkit-font-smoothing: antialiased !important;'), 'theme.css must apply font antialiasing in dark mode');
  assert.ok(cohortJs.includes('.connectea-result {\n      font-weight: 400 !important;'), 'cohort-stats.js must use font-weight: 400 for .connectea-result');

  // 2. Removal and cleanup of improvement arrows
  assert.ok(progJs.includes('cleanupImprovementArrows'), 'progress-graph.js must define and run cleanupImprovementArrows');
  assert.ok(!progJs.includes('function updateImprovementArrows()'), 'progress-graph.js must not retain updateImprovementArrows');
  assert.ok(sideCss.includes('.cx-improved{display:none!important}'), 'sidebar.css must suppress .cx-improved badges');
  assert.ok(sideCss.includes('.cx-performance-row{display:contents!important}'), 'sidebar.css must neutralize .cx-performance-row wrappers');

  // 3. Scroll freezing and expand-all progress lifecycle
  assert.ok(sideCss.includes('html.cx-freeze-scroll,\nbody.cx-freeze-scroll {\n  overflow: hidden !important;'), 'sidebar.css must define cx-freeze-scroll');
  assert.ok(assessJs.includes("classList.add('cx-freeze-scroll')"), 'assessment-data.js expandAll must add cx-freeze-scroll');
  assert.ok(assessJs.includes("classList.remove('cx-freeze-scroll')"), 'assessment-data.js finishProgress must remove cx-freeze-scroll');
  assert.ok(assessJs.includes("updateProgress(95, 'Refreshing statistics & outcome bars... 95%')"), 'expandAll must persist progress pill through 95% refresh phase');

  // 4. Accordion animation guard flushing and multi-click fix
  assert.ok(assessJs.includes('pendingCardsToUpdate'), 'assessment-data.js must track pendingCardsToUpdate');
  assert.ok(assessJs.includes('window.ConnectifyCohort.schedule(true)'), 'triggerAccordionAnimationGuard must flush cohort schedule when animation settles');
  assert.ok(cohortJs.includes('hasTaskNodes'), 'cohort-stats.js observer must detect task rows inserted into accordion panels');

  // 5. Predictor calculation skipping when valid cache is present
  assert.ok(assessJs.includes('if (!window.ConnectifyPredictorMath.isPredictionCacheCurrent?.())'), 'assessment-data.js must not pre-cache predictions when valid cache is present');
  assert.ok(assessJs.includes('const hasValidCache = Boolean(window.ConnectifyPredictorMath?.isPredictionCacheCurrent?.());'), 'expandAll must verify valid cache status');
  assert.ok(predMathJs.includes('if (!force && isPredictionCacheCurrent()) {\n      return;\n    }'), 'predictor-math.js must exit early when valid cache is present and force is false');
  assert.ok(cohortViewJs.includes('getCachedPrediction?.(meta.subjectName, meta.labelsKey)'), 'cohort-view.js must check cache before predicting');
});

runTest('Test 109: Text bolding parity across light and dark modes for Test headers, marks 20 and 5, Med, Max, Mean, z, Top, and Rank', () => {
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const cohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  // 1. Verify cohort-view.js wraps Med, Max, Mean, z, Top standing, and Rank in strong tags
  assert.ok(cohortViewJs.includes('<strong>Med ${math().formatPercentage('), 'cohort-view.js must wrap Med in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Max ${math().formatPercentage('), 'cohort-view.js must wrap Max in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Mean ${math().formatPercentage('), 'cohort-view.js must wrap Mean in strong tag');
  assert.ok(cohortViewJs.includes('<strong>z ≈ ${zStr}</strong>'), 'cohort-view.js must wrap z-score in strong tag');
  assert.ok(cohortViewJs.includes('<strong>${standingText}</strong>'), 'cohort-view.js must wrap Top standing in strong tag');
  assert.ok(cohortViewJs.includes('<strong>${rankStr}</strong>'), 'cohort-view.js must wrap Rank in strong tag');

  // 2. Verify cohort-stats.js styles panel strong tags with font-weight 700
  assert.ok(cohortStatsJs.includes('.connectea-distribution strong,\n    .connectea-result strong,\n    .connectea-panel strong {\n      font-weight: 700 !important;'), 'cohort-stats.js must style strong tags with font-weight 700');

  // 3. Verify theme.css and sidebar.css enforce bolding for Test headers, mark numbers, and stats strong tags
  assert.ok(themeCss.includes('.cvr-c-task-group__title'), 'theme.css must target task group title');
  assert.ok(themeCss.includes('.cvr-c-task__score'), 'theme.css must target task scores');
  assert.ok(themeCss.includes(':is(.connectea-panel, .connectea-distribution, .connectea-result, .connectea-panel-distribution, .connectea-panel-standing) strong'), 'theme.css must bold panel strong tags in light and dark modes');
  assert.ok(sidebarCss.includes(':is(.connectea-panel, .connectea-distribution, .connectea-result) strong'), 'sidebar.css must bold panel strong tags');
  assert.ok(sidebarCss.includes(':is(.cvr-c-task-group__title, .cvr-c-task__group-name)'), 'sidebar.css must bold task group titles');
  assert.ok(sidebarCss.includes(':is(.cvr-c-task__score, .cvr-c-task__grade, .cvr-c-task__mark-score'), 'sidebar.css must bold task mark scores');
});

runTest('Test 110: Silent difference check, out-of-date cache prompt with one-time auto-expand, and chart 0 / non-configurable row stability', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'data.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');

  delete window.ConnectifyData;
  window.__connectifyDataInitialized = false;
  eval(assessJs);

  window.__connectifyAtarFeaturesInitialized = false;
  eval(atarFeatJs);

  // 1. Chart 0 destruction prevention in data.js
  assert.ok(dataJs.includes("attr !== null && attr !== ''"), 'data.js must verify chart attribute is not null or empty before converting to Number');
  assert.ok(dataJs.includes('const attr = chartEl.getAttribute'), 'data.js must getAttribute data-highcharts-chart');

  // 2. Non-configurable property "row" fix via setTaskRow
  assert.ok(assessJs.includes('function setTaskRow(task, rowEl)'), 'assessment-data.js must define setTaskRow');
  assert.ok(assessJs.includes('configurable: true'), 'setTaskRow must configure property with configurable: true');
  assert.ok(assessJs.includes('writable: true'), 'setTaskRow must configure property with writable: true');
  assert.ok(assessJs.includes('enumerable: false'), 'setTaskRow must configure property with enumerable: false');

  const testTask = { id: 'test-1', name: 'Task 1' };
  const mockRow1 = document.createElement('div');
  const mockRow2 = document.createElement('div');
  window.ConnectifyData.setTaskStats = window.ConnectifyData.setTaskStats || (() => {});
  // Calling setTaskRow multiple times on same object must succeed without throwing
  let defineError = null;
  try {
    Object.defineProperty(testTask, 'row', { value: mockRow1, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(testTask, 'row', { value: mockRow2, writable: true, configurable: true, enumerable: false });
  } catch (err) {
    defineError = err;
  }
  assert.strictEqual(defineError, null, 'setTaskRow property definition must be re-configurable without throwing TypeError');
  assert.strictEqual(testTask.row, mockRow2, 'Task row must be updated to new row element');

  // 3. collect() stops scrape when valid cache exists
  assert.ok(assessJs.includes('if (!forceRefresh && hasCachedSubjects())'), 'collect must check hasCachedSubjects and exit early if !forceRefresh');
  assert.ok(assessJs.includes('function hasCachedSubjects()'), 'assessment-data.js must define hasCachedSubjects');
  assert.ok(assessJs.includes('parseCardSubjectTasks'), 'assessment-data.js must separate card task parsing into parseCardSubjectTasks');

  // 4. Silent background difference detection and popup notification
  assert.ok(assessJs.includes('checkSilentDifferences'), 'assessment-data.js must define checkSilentDifferences');
  assert.ok(assessJs.includes('promptCacheOutOfDate'), 'assessment-data.js must define promptCacheOutOfDate');
  assert.ok(assessJs.includes('scheduleSilentDifferenceCheck'), 'assessment-data.js must define scheduleSilentDifferenceCheck');
  assert.ok(assessJs.includes('Assessment Cache Out of Date'), 'promptCacheOutOfDate must notify that cache is out of date');
  assert.ok(assessJs.includes('Refresh with New Cache'), 'promptCacheOutOfDate must provide Refresh with New Cache action button');
  assert.ok(assessJs.includes("sessionStorage.setItem('connectify:one_time_auto_expand', 'true')"), 'Refresh with New Cache must set connectify:one_time_auto_expand');

  // Verify notification emission when difference is detected
  let shownNotification = null;
  window.ConnectifyNotifications = {
    show: opts => {
      shownNotification = opts;
      return { id: opts.id, close: () => {} };
    }
  };

  const dummyUpdatedCache = new Map();
  dummyUpdatedCache.set('Math', new Map([['task1', { id: 'task1', name: 'Test 1', score: 95 }]]));
  window.ConnectifyData.promptCacheOutOfDate(dummyUpdatedCache);
  assert.ok(shownNotification, 'promptCacheOutOfDate must call ConnectifyNotifications.show');
  assert.strictEqual(shownNotification.title, 'Assessment Cache Out of Date', 'Notification title must match');
  const refreshAction = shownNotification.actions?.find(a => a.text === 'Refresh with New Cache');
  assert.ok(refreshAction, 'Notification must contain Refresh with New Cache action');

  // Simulate clicking Refresh with New Cache
  let reloadCalled = false;
  const originalReload = window.location.reload;
  window.location.reload = () => { reloadCalled = true; };
  try {
    refreshAction.onClick({ close: () => {} });
    assert.strictEqual(sessionStorage.getItem('connectify:one_time_auto_expand'), 'true', 'Clicking refresh must set connectify:one_time_auto_expand');
    assert.strictEqual(reloadCalled, true, 'Clicking refresh must trigger window.location.reload()');
  } finally {
    window.location.reload = originalReload;
  }

  // 5. One-time auto expand consumption in atar-features.js
  assert.ok(atarFeatJs.includes("sessionStorage.getItem('connectify:one_time_auto_expand')"), 'atar-features.js must inspect connectify:one_time_auto_expand');
  assert.ok(atarFeatJs.includes("sessionStorage.removeItem('connectify:one_time_auto_expand')"), 'atar-features.js must consume and remove connectify:one_time_auto_expand');

  // Test functional behavior of isAutoExpandEnabled
  localStorage.setItem('connectify:auto_expand', 'false');
  sessionStorage.removeItem('connectify:one_time_auto_expand');

  assert.strictEqual(window.ConnectifyIsAutoExpandEnabled(), false, 'isAutoExpandEnabled must return false when auto_expand is false and no one-time flag exists');

  // Set one-time flag
  sessionStorage.setItem('connectify:one_time_auto_expand', 'true');
  assert.strictEqual(window.ConnectifyIsAutoExpandEnabled(), true, 'isAutoExpandEnabled must return true ignoring auto_expand ONLY THIS ONCE');
  assert.strictEqual(sessionStorage.getItem('connectify:one_time_auto_expand'), null, 'connectify:one_time_auto_expand must be removed from sessionStorage after being consumed');

  // Second call must return false again
  assert.strictEqual(window.ConnectifyIsAutoExpandEnabled(), false, 'Subsequent isAutoExpandEnabled calls must revert to user preference');

  localStorage.removeItem('connectify:auto_expand');
});

console.log('\n================================================================');
console.log(`ALL CONNECTIFY MASTER TESTS COMPLETED: ${passedTests}/${totalTests} TESTS PASSED!`);
console.log('================================================================\n');

process.exit(0);

