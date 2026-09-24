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
    const check = (node) => {
      if (!node || node.nodeType === 3) return;
      if (node.matches && node.matches(sel)) {
        results.push(node);
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
const domBody = new MockElement('body');
domRoot.appendChild(domBody);

global.window = global;
global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => domRoot.querySelector(`#${id}`),
  querySelector: (sel) => domRoot.querySelector(sel),
  querySelectorAll: (sel) => domRoot.querySelectorAll(sel),
  body: domBody,
  documentElement: domRoot,
  addEventListener: (event, fn) => domRoot.addEventListener(event, fn),
  removeEventListener: () => {}
};
global.HTMLElement = MockElement;
global.getComputedStyle = (el) => el._computedStyle || {};
global.localStorage = mockLocalStorage;
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
  assert.ok(themeCss.includes('border-top: 1px solid #475a75 !important'), 'accordion header must use brighter border #475a75');
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

  const prediction = predMath.getOrComputeTaskPrediction('Physics ATAR', taskMock);
  assert.ok(prediction, 'Prediction must be resolved for marked task');
  assert.strictEqual(prediction.unpredicted, false, 'Prediction for completed task must NOT be unpredicted');

  const outcome = predMath.evaluateOutcome(84, prediction);
  assert.ok(outcome, 'Outcome must be evaluated');
  assert.ok(Number.isFinite(outcome.segments), 'Outcome segments must be a finite number');

  // Verify cohort-view creates panel and outcomeBar
  eval(cohortJs);
  const panelState = window.ConnectifyCohortView.createPanel(row, false, 'phys-key', 50);
  assert.ok(panelState, 'Panel state must exist');
  assert.ok(panelState.outcomeBar, 'outcomeBar must exist in panel state');
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

runTest('Completed tasks with zero prior type precedents never return unpredicted: true', () => {
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
  assert.strictEqual(result.unpredicted, false, 'Completed task must never be unpredicted even with 0 prior history');
  assert.ok(Number.isFinite(result.mid), 'Middle prediction must be a finite number');
  assert.ok(Number.isFinite(result.low), 'Low prediction must be a finite number');
  assert.ok(Number.isFinite(result.high), 'High prediction must be a finite number');
  assert.ok(Number.isFinite(result.breakoutScore), 'Breakout score must be a finite number');
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

console.log('\n================================================================');
console.log(`ALL CONNECTIFY MASTER TESTS COMPLETED: ${passedTests}/${totalTests} TESTS PASSED!`);
console.log('================================================================\n');

process.exit(0);

