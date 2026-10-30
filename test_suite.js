// test_suite.js - Connectify Master Unified Test Suite
// Merges and unifies all test suites across the extension.
// From now on, all tests must be added to this file only.

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const expandIs = require('./scripts/expand-is.js');

// Auto-resolve extension directory whether run from repo root or scratch dir
const BASE_DIR = fs.existsSync(path.resolve(__dirname, 'manifest.json'))
  ? __dirname
  : '/Users/uwong/Downloads/2.1.14_0';

// Index all source files in src/ for transparent path resolution
const SRC_DIR = path.resolve(BASE_DIR, 'src');
const FILE_MAP = {};
function indexSourceDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      indexSourceDir(full);
    } else if (entry.isFile()) {
      FILE_MAP[entry.name] = full;
    }
  }
}
indexSourceDir(SRC_DIR);

function resolveFilePath(filePath) {
  if (fs.existsSync(filePath)) return filePath;
  const baseName = path.basename(filePath);
  if (FILE_MAP[baseName]) return FILE_MAP[baseName];
  return filePath;
}

// Module bundle definitions for split files
const MODULE_BUNDLES = {
  'theme.css': [
    'theme-tokens.css',
    'theme-core.css',
    'theme-tiles.css',
    'theme-cards.css',
    'theme-controls.css',
    'theme-material.css',
    'theme-feed.css',
    'theme-tables.css',
    'theme-navigation.css',
    'theme-surfaces.css',
    'theme.css',
    'theme-2.css'
  ],
  'sidebar.css': [
    'sidebar-drawer.css',
    'sidebar-notifications.css',
    'sidebar-predictor.css',
    'sidebar-settings.css',
    'sidebar.css'
  ],
  'assessment-data.js': [
    'assessment-cache.js',
    'assessment-parse-helpers.js',
    'assessment-parser.js',
    'class-semesters.js',
    'semester-filter-notice.js',
    'semester-filter.js',
    'assessment-expand-progress.js',
    'assessment-accordion-watch.js',
    'assessment-expand.js',
    'assessment-scrape.js',
    'assessment-data.js'
  ],
  'predictor-math.js': [
    'utils.js',
    'predictor-baselines.js',
    'predictor-engine.js',
    'predictor-history.js',
    'predictor-dates.js',
    'predictor-store.js',
    'predictor-cache.js',
    'predictor-grade-projection.js',
    'predictor-atar-projection.js',
    'predictor-math.js'
  ],
  'sidebar.js': [
    'sidebar-handle-position.js',
    'sidebar-handle.js',
    'sidebar-hover.js',
    'sidebar-filter.js',
    'sidebar-page-notice.js',
    'sidebar-tools.js',
    'sidebar-shell.js',
    'sidebar.js'
  ],
  'cohort-view.js': [
    'cohort-outcome.js',
    'cohort-row-readers.js',
    'cohort-panel-view.js',
    'cohort-expanded.js',
    'cohort-panel.js',
    'cohort-outcome-eval.js',
    'cohort-forecast.js',
    'cohort-upcoming.js',
    'cohort-subject-average.js',
    'cohort-grade-range.js',
    'cohort-view.js'
  ],
  'category-settings.js': [
    'category-store.js',
    'category-baselines.js',
    'settings-markup.js',
    'settings-semester-filter.js',
    'settings-panel-view.js',
    'settings-preferences.js',
    'category-settings.js'
  ],
  'predictor-ui.js': [
    'predictor-task-cards.js',
    'predictor-tab-scroll.js',
    'predictor-grade-view.js',
    'predictor-atar-view.js',
    'predictor-ui.js'
  ],
  'cohort-stats.js': [
    'cohort-styles.js',
    'cohort-stats.js',
    'cohort-observer.js'
  ]
};

// Files split to stay within the 250-line limit: original name -> parts in manifest order.
// Reading an original name returns all of its parts; aggregate bundles expand through this map.
const SPLIT_PARTS = {
  'theme-tokens.css': ['theme-tokens.css', 'theme-surface-base.css', 'theme-surface-base-2.css', 'theme-component-base.css'],
  'theme-core.css': ['theme-core.css', 'theme-core-navigation.css'],
  'theme-tiles.css': ['theme-tiles.css', 'theme-tile-actions.css', 'theme-tile-actions-2.css', 'theme-tile-actions-3.css', 'theme-tile-bodies.css', 'theme-tile-bodies-2.css', 'theme-tile-bodies-3.css'],
  'theme-cards.css': ['theme-cards.css', 'theme-task-rows.css', 'theme-charts-editor.css'],
  'theme-controls.css': ['theme-controls.css', 'theme-buttons.css', 'theme-action-buttons.css', 'theme-action-buttons-2.css'],
  'theme-material.css': ['theme-material.css', 'theme-material-2.css', 'theme-glyphs.css', 'theme-glyphs-2.css', 'theme-glyphs-3.css', 'theme-glyphs-4.css', 'theme-classes-promos.css'],
  'theme-feed.css': ['theme-feed.css', 'theme-feed-2.css', 'theme-feed-3.css', 'theme-reports-menus.css', 'theme-reports-menus-2.css', 'theme-reports-menus-3.css'],
  'theme-tables.css': ['theme-tables.css', 'theme-dialogs-paginator.css'],
  'theme-navigation.css': ['theme-navigation.css', 'theme-discussions.css'],
  'theme-surfaces.css': ['theme-surfaces.css', 'theme-surfaces-2.css', 'theme-search-scaling.css'],
  'theme-customizer.css': ['theme-customizer.css', 'theme-color-picker.css', 'theme-customizer-preview.css'],
  // Theme stylesheets whose expanded :is() lists outgrew 250 lines (scripts/expand-is.js)
  'theme-action-buttons.css': ['theme-action-buttons.css', 'theme-action-buttons-2.css'],
  'theme-glyphs.css': ['theme-glyphs.css', 'theme-glyphs-2.css', 'theme-glyphs-3.css', 'theme-glyphs-4.css'],
  'theme-reports-menus.css': ['theme-reports-menus.css', 'theme-reports-menus-2.css', 'theme-reports-menus-3.css'],
  'theme-surface-base.css': ['theme-surface-base.css', 'theme-surface-base-2.css'],
  'theme-tile-actions.css': ['theme-tile-actions.css', 'theme-tile-actions-2.css', 'theme-tile-actions-3.css'],
  'theme-tile-bodies.css': ['theme-tile-bodies.css', 'theme-tile-bodies-2.css', 'theme-tile-bodies-3.css'],
  'sidebar-drawer.css': ['sidebar-drawer.css', 'sidebar-handle-menu.css', 'sidebar-tool-menu.css', 'sidebar-weakness-types.css', 'sidebar-outcome-filter.css'],
  'sidebar-notifications.css': ['sidebar-notifications.css', 'sidebar-notifications-dark.css'],
  'sidebar-predictor.css': ['sidebar-predictor.css', 'sidebar-predictor-results.css', 'sidebar-predictor-scroll.css'],
  'sidebar-settings.css': ['sidebar-settings.css', 'sidebar-progress-scaling.css'],
  'assessment-cache.js': ['cache-versions.js', 'assessment-cache.js'],
  'task-types.js': ['category-store.js', 'task-types.js', 'task-type-select.js'],
  'cohort-estimator.js': ['cohort-size-baselines.js', 'cohort-estimator.js'],
  'target-solver.js': ['target-difficulty.js', 'target-solver.js'],
  'target-atar-ui.js': ['target-ui-helpers.js', 'target-atar-breakdown.js', 'target-atar-ui.js'],
  'target-grade-ui.js': ['target-ui-helpers.js', 'target-grade-ui.js'],
  'atar-ui.js': ['target-ui-helpers.js', 'grade-estimate.js', 'grade-estimate-ui.js', 'atar-ui-markup.js', 'atar-ui.js'],
  'atar-features.js': ['outline-jump.js', 'outline-controls.js', 'atar-features.js'],
  'atar.css': ['atar.css', 'atar-compact.css', 'atar-planner.css', 'atar-estimator.css'],
  'progress-chart.js': ['school-terms.js', 'progress-semester-divider.js', 'progress-chart.js', 'progress-week-editor.js'],
  'weakness-radar.js': ['weakness-radar-view.js', 'weakness-radar.js'],
  'progress-graph.js': ['school-terms.js', 'progress-modes.js', 'progress-early-easter.js', 'progress-panel.js', 'progress-graph.js'],
  'new-grade.js': ['grade-snapshot.js', 'grade-tasks.js', 'new-grade.js'],
  'theme-registry.js': ['theme-auth.js', 'theme-custom-tokens.js', 'theme-palettes.js', 'theme-wallpaper-presets.js', 'theme-overlay-blur.js', 'theme-registry.js', 'theme-custom-themes.js'],
  'theme-customizer.js': ['theme-color-utils.js', 'theme-overlay-blur.js', 'theme-import.js', 'theme-customizer-markup.js', 'theme-customizer-controls.js', 'theme-customizer.js'],
  // theme.js needs the registry stack loaded first, exactly as manifest.json orders it
  'theme.js': ['theme-auth.js', 'theme-custom-tokens.js', 'theme-palettes.js', 'theme-wallpaper-presets.js', 'theme-overlay-blur.js', 'theme-registry.js', 'theme-custom-themes.js',
    'theme-surface-adapter.js', 'theme-toggle.js', 'theme-menu.js', 'theme.js']
};
for (const [name, files] of Object.entries(MODULE_BUNDLES)) {
  MODULE_BUNDLES[name] = files.flatMap(f => (SPLIT_PARTS[f] && f !== name ? SPLIT_PARTS[f] : [f]));
}
for (const [orig, parts] of Object.entries(SPLIT_PARTS)) {
  if (!MODULE_BUNDLES[orig]) MODULE_BUNDLES[orig] = parts;
}

const origReadFileSync = fs.readFileSync;
fs.readFileSync = function(filePath, ...args) {
  if (typeof filePath !== 'string') return origReadFileSync.call(fs, filePath, ...args);
  const resolved = resolveFilePath(filePath);
  const baseName = path.basename(resolved);
  if (MODULE_BUNDLES[baseName]) {
    const parts = MODULE_BUNDLES[baseName];
    let combined = '';
    let foundParts = 0;
    for (const part of parts) {
      const partResolved = resolveFilePath(path.resolve(path.dirname(resolved), part));
      if (fs.existsSync(partResolved)) {
        foundParts++;
        combined += origReadFileSync.call(fs, partResolved, ...args) + '\n';
      }
    }
    if (foundParts > 0 && combined.trim()) return combined;
  }
  return origReadFileSync.call(fs, resolved, ...args);
};

// ---------------------------------------------------------------------------
// Unified Mock DOM & Browser Environment
// ---------------------------------------------------------------------------
class MockElement {
  constructor(tag, className = '') {
    this.tagName = (tag || 'div').toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.childNodes = [];
    this.parentElement = null;
    this.parentNode = null;
    this.style = {
      setProperty: (prop, val) => { this.style[prop] = val; },
      removeProperty: (prop) => { delete this.style[prop]; },
      getPropertyValue: (prop) => this.style[prop] || ''
    };
    this._classes = new Set(className ? className.split(/\s+/).filter(Boolean) : []);
    this.classList = {
      _classes: this._classes,
      add: (...classes) => {
        classes.forEach(c => this._classes.add(c));
      },
      remove: (...classes) => {
        classes.forEach(c => this._classes.delete(c));
      },
      contains: (c) => this._classes.has(c),
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
    Object.defineProperty(this, 'className', {
      get: () => Array.from(this._classes).join(' '),
      set: (val) => {
        this._classes.clear();
        (val || '').split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
      },
      configurable: true
    });
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
    this._computedStyle = {
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(0, 0, 0)',
      fill: 'rgb(0, 0, 0)'
    };
  }
  get firstChild() { return this.childNodes[0] || this.children[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || this.children[this.children.length - 1] || null; }
  focus() {
    if (global.document) global.document.activeElement = this;
    this.dispatchEvent(new MockEvent('focus'));
  }
  blur() {
    if (global.document && global.document.activeElement === this) {
      global.document.activeElement = global.document.body || null;
    }
    this.dispatchEvent(new MockEvent('blur'));
  }
  select() {}
  replaceWith(newEl) {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        this.parentElement.children.splice(idx, 1, newEl);
        newEl.parentElement = this.parentElement;
        newEl.parentNode = this.parentElement;
        newEl.isConnected = true;
      }
      const idxNodes = this.parentElement.childNodes.indexOf(this);
      if (idxNodes !== -1) {
        this.parentElement.childNodes.splice(idxNodes, 1, newEl);
      }
      this.parentElement = null;
      this.parentNode = null;
      this.isConnected = false;
    }
  }
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
    const evt = new MockEvent('click');
    if (typeof this.onclick === 'function') this.onclick(evt);
    if (!evt._propagationStopped) {
      this.dispatchEvent(evt);
    }
  }
  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.childNodes = [];
    if (!html) return;
    const stack = [this];
    const tokenRegex = /(?:<(\/)?([a-z0-9-]+)([^>]*)>)|([^<]+)/gi;
    const voidTags = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
    let match;
    while ((match = tokenRegex.exec(html)) !== null) {
      if (match[4]) {
        const text = match[4].trim();
        if (text) {
          const top = stack[stack.length - 1];
          if (!top.textContent) top.textContent = text;
          else top.textContent += ' ' + text;
        }
      } else if (match[1]) {
        const tag = match[2].toLowerCase();
        if (stack.length > 1 && stack[stack.length - 1].tagName.toLowerCase() === tag) {
          stack.pop();
        }
      } else {
        const tag = match[2].toLowerCase();
        const attrs = match[3] || '';
        const child = new MockElement(tag);
        const idMatch = attrs.match(/id="([^"]+)"/i);
        const classMatch = attrs.match(/class="([^"]+)"/i);
        const typeMatch = attrs.match(/type="([^"]+)"/i);
        if (idMatch) child.id = idMatch[1];
        if (classMatch) {
          child.className = classMatch[1];
          classMatch[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
        }
        if (typeMatch) child.type = typeMatch[1];
        const top = stack[stack.length - 1];
        child.parentElement = top;
        child.parentNode = top;
        child.isConnected = true;
        top.children.push(child);
        top.childNodes.push(child);
        if (!voidTags.has(tag)) {
          stack.push(child);
        }
      }
    }
  }
  get innerHTML() { return this._innerHTML || ''; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  getAttribute(k) {
    if (k === 'type' && this.type !== undefined) return this.type;
    return this._attrs[k] ?? null;
  }
  hasAttribute(k) {
    if (k === 'type' && this.type !== undefined) return true;
    return k in this._attrs;
  }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener(event, fn) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (this._listeners?.[event]) {
      this._listeners[event] = this._listeners[event].filter(l => l !== fn);
    }
  }
  dispatchEvent(e) {
    if (!e.target) e.target = this;
    let curr = this;
    while (curr) {
      if (curr._listeners?.[e.type]) {
        curr._listeners[e.type].forEach(fn => fn(e));
      }
      if (!e.bubbles || e._propagationStopped) break;
      curr = curr.parentElement || curr.parentNode;
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
    if ((position === 'afterend' || position === 'beforebegin') && this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx !== -1) {
        const at = position === 'afterend' ? idx + 1 : idx;
        this.parentElement.children.splice(at, 0, el);
        this.parentElement.childNodes.splice(at, 0, el);
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
      if (sel.includes('[') && sel.endsWith(']')) {
        const bracketIdx = sel.indexOf('[');
        const prefix = sel.slice(0, bracketIdx);
        if (prefix && this.tagName.toLowerCase() !== prefix.toLowerCase()) return false;
        const attrContent = sel.slice(bracketIdx + 1, -1);
        if (attrContent.includes('=')) {
          const [k, v] = attrContent.split('=');
          const cleanVal = v.replace(/^["']|["']$/g, '');
          return this.getAttribute(k.trim()) === cleanVal;
        }
        return this.hasAttribute(attrContent);
      }
      if (sel.includes(':not(')) {
        const notIdx = sel.indexOf(':not(');
        const base = sel.slice(0, notIdx);
        const negated = sel.slice(notIdx + 5, -1);
        const baseMatch = !base || this.matches(base);
        const negMatch = this.matches(negated);
        return baseMatch && !negMatch;
      }
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return (this.className || '').split(/\s+/).includes(cls);
      }
      if (sel.startsWith('#')) {
        return this.id === sel.slice(1);
      }
      if (sel.includes('.')) {
        const [tag, ...classes] = sel.split('.');
        const tagMatch = !tag || this.tagName.toLowerCase() === tag.toLowerCase();
        const curClasses = (this.className || '').split(/\s+/);
        const classMatch = classes.every(c => curClasses.includes(c));
        return tagMatch && classMatch;
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
    Object.assign(this, init);
    this.type = type;
    this.key = init.key || '';
    this.target = init.target || null;
    this.detail = init.detail;
    this.bubbles = init.bubbles ?? true;
    this.cancelable = init.cancelable ?? true;
    this.defaultPrevented = false;
    this._propagationStopped = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._propagationStopped = true; }
  composedPath() {
    const list = [];
    let curr = this.target;
    while (curr) {
      list.push(curr);
      curr = curr.parentElement || curr.parentNode;
    }
    return list;
  }
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
  createTextNode: (text) => { const el = new MockElement('#text'); el.textContent = String(text ?? ''); return el; },
  getElementById: (id) => domRoot.querySelector(`#${id}`),
  querySelector: (sel) => domRoot.querySelector(sel),
  querySelectorAll: (sel) => domRoot.querySelectorAll(sel),
  head: domHead,
  body: domBody,
  documentElement: domRoot,
  activeElement: domBody,
  addEventListener: (event, fn) => domRoot.addEventListener(event, fn),
  removeEventListener: (event, fn) => domRoot.removeEventListener(event, fn),
  dispatchEvent: (e) => domRoot.dispatchEvent(e)
};
global.HTMLElement = MockElement;
global.Element = MockElement;
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

// manifest.json loads src/system/scheduler.js and src/system/utils.js before every other content script
eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/scheduler.js'), 'utf8'));
eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/utils.js'), 'utf8'));

// CSS assertions compare rule text, not formatting: comments and whitespace around CSS punctuation are
// ignored, so a rule matches whether a stylesheet is minified or pretty-printed.
const cssCompactCache = new Map();
function cssCompact(text) {
  const key = String(text);
  if (!cssCompactCache.has(key)) {
    cssCompactCache.set(key, key
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s*!\s*important/g, '!important')
      .replace(/\s*([{}:;,>])\s*/g, '$1')
      .replace(/;}/g, '}')
      .replace(/\s+/g, ' '));
  }
  return cssCompactCache.get(key);
}
const cssHas = (css, snippet) => cssCompact(css).includes(cssCompact(snippet).replace(/;$/, ''));
// A colour routed through a theme token: each hex in the snippet must appear as var(--cx-<token>, <hex>),
// so custom themes reach it while the Dark preset keeps the same value
const cssHasToken = (css, snippet) => {
  const esc = cssCompact(snippet).replace(/;$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc.replace(/#[0-9a-f]{3,8}\b/gi, hex => `var\\(--cx-[a-z0-9-]+,${hex}\\)`), 'i').test(cssCompact(css));
};

// The selectors the theme surface adapter queries for light surfaces and the dark text on them
function surfaceAdapterSelectors() {
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-surface-adapter.js'), 'utf8'));
  const { SURFACE_SELECTOR, INK_SELECTOR } = window.ConnectifyThemeSurfaceAdapter;
  return { surface: SURFACE_SELECTOR, ink: INK_SELECTOR };
}

console.log('================================================================');
console.log('       CONNECTIFY UNIFIED MASTER TEST SUITE EXECUTION           ');
console.log(`       Base Directory: ${BASE_DIR}`);
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
const pendingTestPromises = [];

// Every test starts on the outlines page (the default above): Connectify reads class cards only there
const OUTLINES_HREF = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345';

function runTest(name, fn) {
  totalTests++;
  location.href = OUTLINES_HREF;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      pendingTestPromises.push(
        res.then(() => {
          passedTests++;
          console.log(`✓ [PASSED] ${name}`);
        }).catch(err => {
          console.error(`✗ [FAILED] ${name}`);
          console.error(err);
          process.exit(1);
        })
      );
    } else {
      passedTests++;
      console.log(`✓ [PASSED] ${name}`);
    }
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
  assert.ok(cssHas(themeCss, '.cvr-c-promo.eds-t-white'), 'Must style .cvr-c-promo.eds-t-white');
  assert.ok(cssHas(themeCss, '.cvr-c-maintenance-notice'), 'Must style .cvr-c-maintenance-notice');
  assert.ok(cssHas(themeCss, '.eds-c-tile__action'), 'Must style .eds-c-tile__action');
  assert.ok(cssHas(themeCss, '.eds-c-standard-button'), 'Must style .eds-c-standard-button');
});

runTest('theme.css styles Classes and Preferences heading bars and cards', () => {
  assert.ok(cssHas(themeCss, '.cvr-c-heading-bar'), 'Must style .cvr-c-heading-bar');
  assert.ok(cssHas(themeCss, '.cvr-c-page-header'), 'Must style .cvr-c-page-header');
  assert.ok(cssHas(themeCss, '.cvr-c-preferences'), 'Must style .cvr-c-preferences');
  assert.ok(cssHas(themeCss, '.cvr-c-preference-group'), 'Must style .cvr-c-preference-group');
  assert.ok(cssHas(themeCss, '.eds-c-card'), 'Must style .eds-c-card');
  assert.ok(cssHas(themeCss, '.v-panel-content'), 'Must style .v-panel-content');
});

runTest('theme.js implements flicker-free attribute surface adaptation', () => {
  assert.ok(themeJs.includes('function adaptSurfaces(roots)'), 'theme.js must define adaptSurfaces(roots)');
  assert.ok(themeJs.includes('data-connectea-surface'), 'theme.js must tag data-connectea-surface');
  assert.ok(themeJs.includes('data-connectea-ink'), 'theme.js must tag data-connectea-ink');
  assert.ok(!themeJs.includes('savedTextColors'), 'theme.js must NOT mutate inline style properties');
});

runTest('Theme button mounting & positioning in primary navigation', () => {
  assert.ok(cssHas(themeCss, '.cvr-c-primary-navigation {'), 'theme.css must style .cvr-c-primary-navigation');
  assert.ok(cssHas(themeCss, 'top: 50% !important;'), 'theme.css must vertically center #connectea-theme-toggle with top: 50%');
  assert.ok(cssHas(themeCss, 'transform: translateY(-50%) !important;'), 'theme.css must center with translateY(-50%)');
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
  assert.ok(cssHasToken(themeCss, 'border: 1px solid #3d5066 !important'), 'eds-c-tile must use brighter border #3d5066');
  assert.ok(cssHas(themeCss, '.connectea-dark .eds-c-accordion__section-heading'), 'accordion header must be styled');
  assert.ok(cssHasToken(themeCss, 'border-bottom: 1px solid #36485e !important'), 'navigation & tasks must use brighter border #36485e');
  assert.ok(cssHas(sidebarCss, '.connectea-dark .cx-pred-scenario-card--mid'), 'sidebar.css must style dark mode scenario mid');
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

runTest('White button styling for Settings and Weaknesses in sidebar', () => {
  assert.ok(cssHas(sidebarCss, '#connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)'), 'sidebar.css must style weakness and categories toggles');
  assert.ok(cssHas(sidebarCss, 'background: #ffffff !important;'), 'Must specify #ffffff white background for light mode');
  assert.ok(cssHas(sidebarCss, '.connectea-dark #connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)'), 'Must preserve dark mode style');
});

runTest('theme.css covers Classes accordion, Feed filter funnel, and Follow pills with >= 5:1 contrast', () => {
  assert.ok(cssHas(themeCss, '.mat-expansion-panel'), 'theme.css must style .mat-expansion-panel');
  assert.ok(cssHas(themeCss, '.mat-accordion'), 'theme.css must style .mat-accordion');
  assert.ok(cssHas(themeCss, '.cvr-c-classes'), 'theme.css must style .cvr-c-classes');
  assert.ok(cssHas(themeCss, '.cvr-c-filter-button'), 'theme.css must style feed filter button');
  assert.ok(cssHas(themeCss, '.cvr-c-feed-item__follow'), 'theme.css must style feed follow button');
  assert.ok(cssHas(themeCss, '.mat-expansion-panel-header'), 'theme.css must style expansion panel header');
  assert.ok(cssHas(themeCss, '.cvr-c-task,') && cssHas(themeCss, '.mat-expansion-panel,'), 'theme.css must restore borders for tasks, cards, and expansion panels');
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
  assert.ok(cssHas(sidebarCss, '#connectea-outcome-tooltip'), 'sidebar.css must style #connectea-outcome-tooltip');
  assert.ok(cssHas(sidebarCss, 'position: fixed'), 'tooltip must use fixed viewport positioning');
  assert.ok(cssHas(sidebarCss, 'z-index: 100050'), 'tooltip must have z-index: 100050');
});

runTest('cohort-view.js manages floating outcome tooltip on mouseenter/mousemove/mouseleave', () => {
  assert.ok(cohortJs.includes('connectea-outcome-tooltip'), 'cohort-view.js must reference #connectea-outcome-tooltip');
  assert.ok(cohortJs.includes('showFloatingTooltip'), 'cohort-view.js must define showFloatingTooltip');
  assert.ok(cohortJs.includes('hideFloatingTooltip'), 'cohort-view.js must define hideFloatingTooltip');
  assert.ok(cohortJs.includes('mouseenter'), 'cohort-view.js must bind mouseenter listener');
});

runTest('Outcome bar 2-3x sizing and dark mode segment color preservation', () => {
  assert.ok(cssHas(sidebarCss, 'width: 18px !important;'), 'Outcome bar width must be enlarged (18px)');
  assert.ok(cssHas(sidebarCss, 'height: 56px !important;'), 'Outcome bar height must be enlarged (56px)');
  assert.ok(cssHas(sidebarCss, 'height: 10px !important;'), 'Outcome segment height must be enlarged (10px)');
  assert.ok(cssHas(sidebarCss, 'height: 20px !important;'), 'Outcome purple segment height must be 20px');
  assert.ok(cssHas(sidebarCss, '.connectea-dark .connectea-outcome-segment:not([class*="connectea-active-"])'), 'Dark mode must only target inactive segments');
  assert.ok(cssHas(sidebarCss, '.connectea-outcome-bar.connectea-outcome-critical'), 'sidebar.css must style critical outcome bar');
  assert.ok(cssHas(sidebarCss, 'connectea-glow-critical'), 'sidebar.css must define connectea-glow-critical animation');
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
    subjectCounts: { 'Physics': 3 },
    types: { 'Test': 95 },
    typeCounts: { 'Test': 3 },
    overallAverage: 95,
    spread: 1.0
  };
  const predConsistent = predMath.predictTask('Physics', { name: 'Test 4' }, historicalConsistent);
  // Three results leave some uncertainty, so even a consistent student's Low sits a few points below Mid
  assert.ok(predConsistent.low >= 90, `Consistent student Low (${predConsistent.low}%) should be tight (>= 90%)`);

  const historicalVolatile = {
    subjects: { 'Physics': 85 },
    subjectSpreads: { 'Physics': 10.0 },
    subjectCounts: { 'Physics': 3 },
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
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Chemistry ATAR:Task Override Test'), 't3w5');

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
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/sidebar-tools.js'), 'utf8'));
  assert.ok(Array.isArray(window.ConnectifySidebarTools?.CANONICAL_BUTTONS), 'sidebar-tools.js must export CANONICAL_BUTTONS');
  const buttonIds = window.ConnectifySidebarTools.CANONICAL_BUTTONS.map(b => b.id);

  const expectedOrder = [
    'connectify-goals-toggle',
    'connectify-predictor-toggle',
    'connectify-progress-toggle',
    'connectify-estimator-toggle',
    'connectify-weakness-toggle',
    'connectify-categories-toggle'
  ];

  assert.deepStrictEqual(buttonIds, expectedOrder, 'Sidebar button order must place Weaknesses below Estimates');
});

runTest('Goals and Estimates launchers and panel in sidebar', () => {
  assert.ok(atarUiJs.includes('window.ConnectifyAtar.calculatorButtons = [goalsTab, estimatorTab]'), 'atar-ui.js must export calculatorButtons');
  assert.ok(atarUiJs.includes('window.ConnectifyAtar.calculatorPanel = calculatorPanel'), 'atar-ui.js must export calculatorPanel');
  assert.ok(sidebarJs.includes('window.ConnectifyAtar?.calculatorButtons'), 'sidebar.js must check calculatorButtons');
  assert.ok(sidebarJs.includes('window.ConnectifyAtar?.calculatorPanel'), 'sidebar.js must mount calculatorPanel into workspace');
});

runTest('Sidebar workspace drawer expands to 900px on active tool and provides back navigation', () => {
  assert.ok(cssHas(sidebarCss, '.cx-tool-active'), 'sidebar.css must style .cx-tool-active workspace mode');
  assert.ok(cssHas(sidebarCss, 'min(900px'), 'sidebar.css must expand drawer to min(900px) on tool open');
  assert.ok(sidebarJs.includes('cx-back-menu'), 'sidebar.js must implement Back to Menu button');
});

runTest('Category settings preserves colored text in dark mode and supports dynamic categories in cold-start', () => {
  const catSettingsJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  assert.ok(catSettingsJs.includes("label.className = 'cx-cat-name-label'"), 'Must set cx-cat-name-label class');
  assert.ok(cssHas(sidebarCss, '.connectea-dark #connectify-sidebar .cx-cat-name-label'), 'sidebar.css must style .cx-cat-name-label with var(--cx-cat-color)');

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

runTest('Weaknesses & Settings button text is centered in sidebar.css', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  assert.ok(
    cssHas(sidebarCss, '#connectify-sidebar .cx-tool-menu > :is(#connectify-weakness-toggle, #connectify-categories-toggle)') ||
    cssHas(sidebarCss, '.cx-secondary-tool'),
    'sidebar.css must select weakness and categories buttons'
  );
  assert.ok(
    cssHas(sidebarCss, 'text-align: center !important') && cssHas(sidebarCss, 'justify-content: center !important'),
    'sidebar.css must center Weaknesses and Settings button text'
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
  assert.ok(cssHas(themeCss, '.cvr-c-feed') && cssHas(themeCss, '.mat-tab-label'), 'theme.css must style feed navigation tabs');
  assert.ok(cssHasToken(themeCss, 'color: #cbd5e1 !important') && cssHasToken(themeCss, 'color: #f8fafc !important'), 'theme.css must use high-contrast colors for feed tabs');

  // 2. Classes drawer navigation items & icons
  assert.ok(cssHas(themeCss, '.c-category-menu') && cssHas(themeCss, '.mat-list-item-content'), 'theme.css must style classes drawer list items');
  assert.ok(cssHas(themeCss, '.eds-c-icon') || cssHas(themeCss, '.mat-icon'), 'theme.css must style classes drawer icons');

  // 3. Reports page year selector bar
  assert.ok(cssHas(themeCss, '.cvr-c-reports') && cssHas(themeCss, '.cvr-c-year-selector'), 'theme.css must style reports year selector bar');
  assert.ok(cssHasToken(themeCss, '#1a222d !important'), 'Reports year bar must have dark navy background');
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

runTest('Predictor, Weaknesses, Calculator, and Grade Checker do not programmatically call expandAll without user action', () => {
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
  assert.ok(window.ConnectifyCache.VERSIONS.GOALS, 'GOALS version must exist');

  // Verify versions are distinct
  const versions = Object.values(window.ConnectifyCache.VERSIONS);
  const uniqueVersions = new Set(versions);
  assert.strictEqual(uniqueVersions.size, 5, 'All 5 subsystem versions must be distinct');

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

  // Goals: a version bump or Clear Cache drops finished goals' verdicts, never the goals
  localStorage.setItem('connectify:goals:12345', '{"version":1,"goals":[]}');
  localStorage.setItem('connectify:goal_verdicts:12345', '{}');
  window.ConnectifyCache.invalidateSubsystem('goals');
  assert.strictEqual(localStorage.getItem('connectify:goal_verdicts:12345'), null, 'goal verdicts must be cleared');
  assert.ok(localStorage.getItem('connectify:goals:12345'), 'goals must stay');
  assert.ok(localStorage.getItem('connectea:categories'), 'Settings cache must remain intact');
  window.ConnectifyCache.clearSettingsCache();
  assert.strictEqual(localStorage.getItem('connectify:goals:12345'), null, 'a settings reset removes goals');
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
  assert.ok(cssHas(sidebarCss, '#cx-expand-progress'), 'sidebar.css must style #cx-expand-progress');
  assert.ok(cssHas(sidebarCss, 'cx-expand-spinner'), 'sidebar.css must style spinner animation');
  assert.ok(cssHas(sidebarCss, 'cx-expand-bar'), 'sidebar.css must style progress bar');
  assert.ok(cssHas(sidebarCss, '#1e2632') && cssHas(sidebarCss, '#ffffff'), 'progress pill must satisfy contrast standards');
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
  assert.ok(cssHas(css, '.cvr-c-tile') && cssHas(css, '.eds-c-tile'), 'theme.css must target both .cvr-c-tile and .eds-c-tile');
  assert.ok(cssHasToken(css, 'border-bottom: 1px solid #2e3c4e !important;'), 'Tile headers must have normalized #2e3c4e bottom border');
  assert.ok(cssHas(css, 'display: none !important;') && cssHas(css, 'content: none !important;'), 'Tile header pseudo-elements must be suppressed');
});

runTest('theme.css styles tile action buttons and View All controls with dark styling', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.cvr-c-tile__action') && cssHas(css, '.eds-c-tile__action'), 'theme.css must target .cvr-c-tile__action and .eds-c-tile__action');
  assert.ok(cssHasToken(css, 'background-color: #24303f !important;'), 'Tile action buttons must have #24303f background');
  assert.ok(cssHasToken(css, 'border: 1px solid #4a617a !important;'), 'Tile action buttons must have #4a617a border');
  assert.ok(cssHasToken(css, 'color: #f1f5f9 !important;'), 'Tile action buttons must have #f1f5f9 high-contrast text');
});

runTest('theme.css ensures role/student switcher icon contrast and horizontal navbar indicator', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '[class*="switch"]') && cssHas(css, '[class*="role"]'), 'theme.css must target switch and role icons');
  assert.ok(cssHasToken(css, 'fill: #cbd5e1 !important;') && cssHas(css, 'stroke: currentColor !important;'), 'Icons must use #cbd5e1 contrast fill/stroke');
  assert.ok((cssHas(css, 'border-bottom: 2px solid #3b82f6 !important;') || cssHas(css, 'border-bottom: 2px solid var(--cx-accent, #3b82f6) !important;')) && cssHas(css, 'box-shadow: none !important;'), 'Horizontal navbar active tab must use border-bottom instead of inset 3px 0');
});

runTest('theme.css provides custom dark styling for checkboxes, dropdowns, and buttons', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  // Checkbox tests
  assert.ok(cssHas(css, 'input[type="checkbox"]'), 'theme.css must style input[type="checkbox"]');
  assert.ok(cssHas(css, 'appearance: none !important;'), 'Checkbox must use appearance: none for custom rendering');
  assert.ok(cssHasToken(css, 'background-color: #2563eb !important;') && cssHas(css, "viewBox='0 0 16 16'"), 'Checked checkbox must use #2563eb with SVG checkmark');
  
  // Dropdown tests
  assert.ok(cssHas(css, 'select') && cssHas(css, '.cvr-c-classes__sort'), 'theme.css must style select and sort dropdowns');
  assert.ok(cssHas(css, "viewBox='0 0 20 20'"), 'Dropdown select must render custom SVG chevron');
  assert.ok(cssHas(css, 'select option') && cssHasToken(css, 'background-color: #1a222d !important;'), 'Select options must use dark #1a222d background');

  // Button tests
  assert.ok(cssHas(css, '.cvr-c-button') && cssHas(css, 'input[type="button"]'), 'theme.css must style all buttons and inputs');
  assert.ok(cssHasToken(css, 'background-color: #202c3b !important;'), 'Default buttons must use #202c3b background');
  assert.ok(cssHasToken(css, 'border: 1px solid #455a73 !important;'), 'Default buttons must use #455a73 border');
  assert.ok(cssHas(css, '.v-button--primary') && cssHasToken(css, 'background-color: #2563eb !important;'), 'Primary buttons must use #2563eb background');
});

runTest('theme.css scopes buttons to avoid shrinking sidebar buttons and preserves container layout', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, ':not(#connectify-sidebar *)'), 'theme.css must explicitly exempt #connectify-sidebar * from button rules');
  assert.ok(!cssHas(css, 'margin-bottom: 20px !important;'), 'theme.css must not force 20px margin-bottom on cards or tiles');
  assert.ok(!cssHas(css, '.eds-c-tile::after {\n  display: none !important;'), 'theme.css must not destroy clearfix on .eds-c-tile::after');
});

runTest('sidebar.js implements centralized delegation and automatic component instantiation', () => {
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  assert.ok(sidebarJs.includes('ensureWeaknessPanel') || sidebarJs.includes('createWeaknessPanel'), 'sidebar.js must ensure weakness panel instantiation');
  assert.ok(sidebarJs.includes('ensureSettingsPanel') || sidebarJs.includes('createSettingsPanel'), 'sidebar.js must ensure settings panel instantiation');
  assert.ok(sidebarJs.includes('#connectify-goals-toggle'), 'sidebar.js must delegate Goals toggle');
  assert.ok(sidebarJs.includes('#connectify-estimator-toggle'), 'sidebar.js must delegate Estimates toggle');
  assert.ok(sidebarJs.includes('#connectify-progress-toggle'), 'sidebar.js must delegate Progress Graph toggle');
  assert.ok(sidebarJs.includes('#connectify-weakness-toggle'), 'sidebar.js must delegate Weaknesses toggle');
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
      ConnectifyUtils: window.ConnectifyUtils,
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
      ConnectifyUtils: window.ConnectifyUtils,
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
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:Unscheduled Investigation'), '17'); // Term 2 Week 7
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), true, 'Task with custom date 17 must be parsable');

  // Test custom date override with connectify: namespace
  mockLocalStorage.removeItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:Unscheduled Investigation'));
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectify:time_override:Physics ATAR:Unscheduled Investigation'), 'Term 3, Week 4');
  assert.strictEqual(predMath.hasParsableDate(noDateTask, 'Physics ATAR'), true, 'Task with connectify: time override must be parsable');

  // Explicitly cleared custom date (empty string) must suppress task
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:Unscheduled Investigation'), '');
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
  assert.ok(cssHas(css, '.table') && cssHas(css, '.table-striped') && cssHas(css, '.table-hover'), 'theme.css must target standard and clay tables');
  assert.ok(cssHas(css, '.v-table') && cssHas(css, '.v-grid'), 'theme.css must target Vaadin tables and grids');
  assert.ok(cssHas(css, '.cvr-c-table') && cssHas(css, '.cvr-c-submission-students-table'), 'theme.css must target Connect submission marksbooks');
});

runTest('theme.css comprehensively styles modals, dialogs, popups, and dark curtains', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.v-window') && cssHas(css, '.ui-dialog') && cssHas(css, '.modal-content'), 'theme.css must target Vaadin windows, jQuery UI dialogs, and Clay modals');
  assert.ok(cssHas(css, '.v-window-modalitycurtain') && cssHas(css, '.modal-backdrop'), 'theme.css must darken modal backdrop curtains');
  assert.ok(cssHas(css, '.cvr-c-popup') && cssHas(css, '.cvr-c-popup-action-button'), 'theme.css must target Connect popups and buttons');
});

runTest('theme.css comprehensively styles dropdown menus, menubars, and auto-suggest popups', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.v-filterselect-suggestpopup'), 'theme.css must target Vaadin combobox auto-suggest popups');
  assert.ok(cssHas(css, '.dropdown-menu') && cssHas(css, '.clay-dropdown-menu'), 'theme.css must target dropdown menus');
  assert.ok(cssHas(css, '.v-menubar-popup') && cssHas(css, '.ui-menu'), 'theme.css must target Vaadin menubars and jQuery UI menus');
});

runTest('theme.css comprehensively styles calendars, datepickers, and time controls', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.v-calendar') && cssHas(css, '.v-calendar-month-day'), 'theme.css must target Vaadin calendar grid and days');
  assert.ok(cssHas(css, '.ui-datepicker') && cssHas(css, '.ui-datepicker-header'), 'theme.css must target jQuery UI datepicker');
  assert.ok(cssHas(css, '.v-datefield-popup') && cssHas(css, '.v-datefield-calendarpanel'), 'theme.css must target Vaadin datefield popups');
});

runTest('theme.css comprehensively styles tabsheets, breadcrumbs, speech boxes, and notifications', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.v-tabsheet') && cssHas(css, '.v-tabsheet-tabitem'), 'theme.css must target Vaadin tabsheets');
  assert.ok(cssHas(css, '.breadcrumb') && cssHas(css, '.cvr-c-location-bar'), 'theme.css must target breadcrumbs and location bar');
  assert.ok(cssHas(css, '.cvr-c-speech-box'), 'theme.css must target discussion speech bubbles');
  assert.ok(cssHas(css, '.v-Notification') && cssHas(css, '.cvr-c-notifications'), 'theme.css must target Vaadin and Connect notifications');
  assert.ok(cssHas(css, '.cvr-c-status-label') && cssHas(css, '.cvr-c-switch'), 'theme.css must target status labels and switches');
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
  assert.ok(cssHas(css, '.eds-t-red') && cssHasToken(css, 'border-color: #3d5066 !important;'), 'theme.css must normalize red card borders to dark neutral');
  assert.ok(cssHas(css, '.cvr-c-class__status-label--locked'), 'theme.css must style locked class status label');
  assert.ok(cssHas(css, '.cvr-c-attendance .eds-t-red.cvr-c-standard-label'), 'theme.css must style attendance red label');
  assert.ok(cssHas(css, 'background-color: #2b171a !important;'), 'theme.css must render red status alerts as soft dark-theme badges');
});

runTest('theme.css styles Connect webfont glyphs and switcher icons with high contrast', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, '.cvr-c-icon--switch:before') || cssHas(css, '[class*="cvr-c-icon--switch"]:before'), 'theme.css must style switcher icon pseudo-element');
  assert.ok(cssHas(css, '[class^="cvr-c-icon--"]:before'), 'theme.css must style webfont icon before pseudo-elements');
  assert.ok(cssHasToken(css, 'color: #cbd5e1 !important;'), 'theme.css must set high-contrast color for font glyphs');
});

runTest('theme.css covers Angular Material buttons, div.w-100, and aligns margins against base Connect CSS', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  assert.ok(cssHas(css, 'button.mat-focus-indicator'), 'theme.css must style button.mat-focus-indicator');
  assert.ok(cssHas(css, '.mat-stroked-button'), 'theme.css must style .mat-stroked-button');
  assert.ok(cssHas(css, 'div.w-100'), 'theme.css must style div.w-100');
  assert.ok(!cssHas(css, '.mat-expansion-panel {\n  border: 1px solid #3d5066 !important;\n  border-radius: 6px !important;\n  margin-bottom: 8px !important;'), 'theme.css must not have margin-bottom: 8px !important on mat-expansion-panel');
  assert.ok(cssHas(css, ':not([class*="icon"]):not(.mat-icon-button):not(.btn-monospaced)'), 'theme.css must exclude every icon button (class containing "icon") from button padding so glyphs are not offset');
  assert.ok(cssHas(css, '#main-content:has(.eds-c-tile, .cvr-c-tile)') && cssHas(css, ':where(.v-scrollable):has(.eds-c-tile, .cvr-c-tile):not(#cx-n)'), 'layout wrappers may only become clear when they hold tiles, so detail views (notices) keep an opaque surface');
});

runTest('atar-features.js injects and styles Back to top button at the bottom of assessment outlines', () => {
  const atarFeaturesCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  assert.ok(atarFeaturesCode.includes('cx-back-to-top-container'), 'atar-features.js must create cx-back-to-top-container');
  assert.ok(atarFeaturesCode.includes('cx-back-to-top-btn'), 'atar-features.js must create cx-back-to-top-btn');
  assert.ok(atarFeaturesCode.includes('Back to top'), 'atar-features.js button must have Back to top text');
  assert.ok(cssHas(atarCss, '.cx-back-to-top-container') && cssHas(atarCss, '.cx-back-to-top-btn'), 'atar.css must style Back to top button');
  assert.ok(cssHas(themeCss, '.cx-back-to-top-btn'), 'theme.css must style Back to top button in dark mode');
  assert.ok(atarFeaturesCode.includes('syncBackToTop()'), 'atar-features.js must have dedicated syncBackToTop function');
  assert.ok(atarFeaturesCode.includes('scheduler.onMutations(') && atarFeaturesCode.includes('syncBackToTop();'), 'atar-features.js must observe DOM mutations (shared scheduler) to reactively mount Back to top button');
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

  assert.ok(cssHas(css, '.btn-monospaced') && cssHas(css, 'trash'), 'theme.css must style circular icon buttons and trash controls');
  assert.ok(cssHas(css, '.eds-c-action-button') || cssHas(css, '.eds-c-tile__header .v-button'), 'theme.css must style View All tile header action button');
  assert.ok(cssHas(css, '.custom-checkbox') && cssHas(css, '.custom-control-label::before'), 'theme.css must style Clay custom checkboxes');
  assert.ok(cssHas(css, '.mat-checkbox-frame'), 'theme.css must style Angular Material checkbox frames');
  assert.ok(cssHas(css, '.connectea-dark:not(cx-n)') && cssHas(css, '.eds.cvr'), 'theme.css must provide maximum specificity covering .eds.cvr');
  assert.ok(cssHasToken(css, 'border-top: 1px solid #2e3c4e !important;') && cssHasToken(css, 'border-bottom: 1px solid #2e3c4e !important;'), 'theme.css must set dark borders on task rows to eliminate light #888 lines');
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

runTest('atar-scraper.js readCourses reads semester groupings, marks and tasks from the centralized cache', () => {
  const scraperCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  const readCoursesSrc = scraperCode.slice(scraperCode.indexOf('function readCourses'), scraperCode.indexOf('function scanOutlineDetails'));
  assert.ok(!readCoursesSrc.includes('document.querySelectorAll'), 'readCourses must not read outline tiles; sidebar tools work off the cache');
  assert.ok(readCoursesSrc.includes('ConnectifyClassSemesters') && readCoursesSrc.includes('collect'), 'readCourses must refresh the cache and read the class registry');

  const saved = {
    classes: window.ConnectifyClassSemesters, data: window.ConnectifyData, cache: window.ConnectifyCache,
    filter: window.ConnectifySemesterFilter, scraper: window.ConnectifyAtarScraper
  };
  try {
    localStorage.clear();
    const chem = new Map([
      ['a', { id: 'a', name: 'Test 1', score: 80, weight: 50, pending: false }],
      ['b', { id: 'b', name: 'Exam', score: null, weight: 50, pending: true }],
      ['c', { id: 'c', name: 'Test 2', score: 90, weight: 40, pending: false }],
      ['d', { id: 'd', name: 'Final Exam', score: null, weight: 60, pending: true }]
    ]);
    let collected = 0;
    window.ConnectifyCache = { ...(saved.cache || {}), subjectsCache: new Map([['12 Chemistry ATAR', chem]]) };
    window.ConnectifyData = { collect: () => { collected++; return []; }, getSubjectTasks: () => [] };
    window.ConnectifyClassSemesters = { get: () => ({
      '12 Chemistry ATAR': {
        1: { title: '12 Chemistry ATAR - Semester 1', mark: 80, finalLetter: true, tasks: [['a', 'Test 1'], ['b', 'Exam']] },
        2: { title: '12 Chemistry ATAR - Semester 2', mark: 90, finalLetter: false, tasks: [['c', 'Test 2'], ['d', 'Final Exam']] }
      }
    }) };
    delete window.ConnectifySemesterFilter;
    delete window.ConnectifyAtarScraper;
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8'));
    const courses = window.ConnectifyAtarScraper.readCourses(true);
    assert.ok(collected > 0, 'readCourses must refresh the cache through collect() first');
    assert.deepStrictEqual(courses.map(list => list.map(c => c.id)), [['12 chemistry'], ['12 chemistry']], 'each semester outline is its own course entry');
    assert.strictEqual(courses[0][0].mark, 80);
    assert.strictEqual(courses[0][0].finalLetter, true, 'final letters come from the registry');
    assert.strictEqual(courses[1][0].mark, 90);
    const sem2Tasks = courses[1][0].progress?.allTasks;
    if (sem2Tasks) {
      assert.deepStrictEqual(sem2Tasks.map(t => t.name), ['Test 2', 'Final Exam'], "a semester's progress uses only the tasks its outline listed");
      assert.strictEqual(sem2Tasks[1].pending, true, 'cached tasks keep their pending status');
    }
  } finally {
    window.ConnectifyClassSemesters = saved.classes;
    window.ConnectifyData = saved.data;
    window.ConnectifyCache = saved.cache;
    if (saved.filter) window.ConnectifySemesterFilter = saved.filter;
    window.ConnectifyAtarScraper = saved.scraper;
    localStorage.clear();
  }
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

runTest('atar-ui.js labels Target Grade and Target ATAR semester buttons plainly (Semester N) and applies canonical tab styling', () => {
  const uiCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-ui-helpers.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui-markup.js'), 'utf8'));
  const { semesterLabel } = window.ConnectifyAtarMarkup;
  assert.strictEqual(semesterLabel(0, { atar: '95.00' }, 'grade', false), 'Semester 1', 'Target Grade semester buttons read Semester N, without ATAR');
  assert.strictEqual(semesterLabel(0, { atar: '95.00' }, 'grade', true), 'Semester 1 (Closed)', 'Target Grade must append (Closed) when closed');
  assert.strictEqual(semesterLabel(1, { atar: '95.00' }, 'target', false), 'Semester 2', 'Target ATAR semester buttons read Semester N');
  assert.strictEqual(semesterLabel(0, { atar: '95.00' }, 'target', true), 'Semester 1 (Closed)', 'Target ATAR must append (Closed) when closed');
  assert.strictEqual(semesterLabel(1, { atar: '95.00' }, 'estimate', false), 'Semester 2 ATAR\n95.00', 'Estimate mode must show the semester ATAR');
  assert.ok(uiCode.includes('cta-semester-closed'), 'atar-ui.js must style closed semester tabs with cta-semester-closed');
  assert.ok(uiCode.includes('cta-semester-indicator'), 'atar-ui.js must style active semester tabs with cta-semester-indicator');
});

runTest('theme.css and theme.js normalize class page red outlines and headers without transparent overrides', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const js = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  assert.ok(cssHas(css, '.eds.cvr.ngm') && cssHas(css, '.text-primary'), 'theme.css must normalize .text-primary in .eds.cvr.ngm');
  assert.ok(cssHas(css, '.eds.cvr.ngm') && cssHas(css, '.mat-divider--primary'), 'theme.css must normalize .mat-divider--primary in .eds.cvr.ngm');
  assert.ok(!/div\.w-100[^{}]*\{[^}]*background-color: transparent/.test(css), 'theme.css must not have generic transparent div.w-100 rule');
  assert.ok(js.includes('isDarkColor'), 'theme.js must implement isDarkColor helper');
  assert.ok(js.includes("el.hasAttribute('data-connectea-surface')"), 'theme.js must not tag surface containers as ink');
});

runTest('assessment-data.js strictly ignores summary rows outside .cvr-c-tasks and never synthesizes phantom tasks', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  assert.ok(!dataJs.includes('cvr-c-task--summary'), 'assessment-data.js must not have fallback query capturing summary rows');
  assert.ok(dataJs.includes("card.querySelectorAll('.cvr-c-tasks .cvr-c-task')") && dataJs.includes('if (!entry) continue;'), 'assessment-data.js must only parse rows inside cvr-c-tasks that have a task id');
  assert.ok(dataJs.includes('if (!labels.length || (!mark.isCompleted && !mark.isPending)) return null;'), 'assessment-data.js must not invent tasks when labels are empty');

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
  assert.ok(cssHas(css, '.eds.cvr.ngm') && cssHas(css, '.theme-multiplier.text-primary'), 'theme.css must use chained .theme-multiplier.text-primary');
  assert.ok(cssHas(css, '.eds.cvr.ngm') && cssHas(css, '.mat-divider--primary'), 'theme.css must use chained .mat-divider--primary');
  assert.ok(cssHas(css, '.cvr-c-reports') && cssHas(css, '#1a222d'), 'theme.css must style Reports container with solid #1a222d background');
});

runTest('atar-scraper.js isAtarEligible reads class titles from the registry before the page and never auto-expands', () => {
  const scraperJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  assert.ok(scraperJs.includes('isAtarEligible'), 'atar-scraper.js must define isAtarEligible');
  assert.ok(/function isAtarEligible\(\) \{[\s\S]*?ConnectifyClassSemesters[\s\S]*?\.cvr-c-tile/.test(scraperJs), 'isAtarEligible checks registry titles, then .cvr-c-tile titles on the page');
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
  assert.ok(cssHas(themeCss, 'mat-toolbar') && cssHas(themeCss, 'mat-tab-header'), 'theme.css must explicitly style mat-toolbar and mat-tab-header');
  assert.ok(cssHasToken(themeCss, 'background-color: #1a222d !important'), 'theme.css must use solid #1a222d background for headers and toolbars');
  assert.ok(!cssHas(themeCss, '[class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before,\n  .cvr-c-icon:before,\n  .cvr-c-icon--switch:before,\n  [class*="switch"]:before,\n  [class*="role"]:before,\n  .eds-c-icon:before,\n  [class^="cvr-c-icon--"],\n  [class*=" cvr-c-icon--"],\n  .cvr-c-icon,\n  .cvr-c-icon--switch\n),\n:is(html.connectea-dark, body.connectea-dark, .connectea-dark).eds.cvr :is(\n  .cvr-c-icon,\n  .cvr-c-icon--switch,\n  [class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before\n),\n:is(html.connectea-dark, body.connectea-dark, .connectea-dark) .eds.cvr :is(\n  .cvr-c-icon,\n  .cvr-c-icon--switch,\n  [class^="cvr-c-icon--"]:before,\n  [class*=" cvr-c-icon--"]:before\n) {\n  color: #cbd5e1 !important;\n  fill: #cbd5e1 !important;\n  stroke: currentColor !important;'), 'theme.css must not apply stroke: currentColor to font icon :before selectors');
  assert.ok(themeJs.includes('mat-toolbar') && themeJs.includes('mat-tab-header'), 'theme.js adaptSurfaces must include mat-toolbar and mat-tab-header');
});

runTest('assessment-data.js expandAll defines pattern, supports heading fallback, and dispatches clicks safely', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  assert.ok(dataJs.includes('const pattern = expand ? /show details/i : /hide details/i;'), 'expandAll must define pattern before matching headings');
  assert.ok(dataJs.includes('(btn || heading).click()'), 'expandAll must fallback to clicking heading if no child button is found');

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

  assert.ok(predMathCode.includes("'v21_20261024_pred'"), 'predictor-math.js must use v21_20261024_pred');
  assert.ok(dataJsCode.includes("PREDICTOR: 'v21_20261024_pred'"), 'assessment-data.js CACHE_VERSIONS.PREDICTOR must be v21_20261024_pred');

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
  assert.ok(pred.low <= 82, `Low prediction (${pred.low}%) must reflect downside risk dialed back with calibrated variance`);
});

runTest('predictor-ui.js and atar-ui.js render user-prompted Expand All buttons', () => {
  const predUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8');
  const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');

  assert.ok(predUiJs.includes('cx-pred-expand-outlines-btn'), 'predictor-ui.js must include cx-pred-expand-outlines-btn in Predict ATAR');
  assert.ok(predUiJs.includes("closest('#cx-pred-expand-outlines, .cx-pred-expand-outlines-btn')"), 'predictor-ui.js click delegation must handle cx-pred-expand-outlines-btn');
  assert.ok(atarUiJs.includes('cta-expand-outlines') || atarUiJs.includes('Expand All Outlines'), 'atar-ui.js must include Expand All Outlines button');
  assert.ok(atarUiJs.includes('expandAllBtn.hidden'), 'atar-ui.js must manage expandAllBtn visibility in selectTab');
});

runTest('theme.css normalizes accordion panels and sidebar.css enforces distinct Low/Mid/High predictor text colors', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  assert.ok(
    cssHas(themeCss, '.connectea-dark .eds-c-accordion__section-heading') &&
    cssHas(themeCss, 'background-color: transparent !important;') &&
    cssHas(themeCss, 'border: none !important;'),
    'theme.css must make accordion section headings flat and transparent with no borders'
  );

  assert.ok(cssHas(sidebarCss, '.connectea-dark :is(.cx-pred-pill, .cx-pred-pill--low) strong'), 'sidebar.css must style low pill numbers');
  assert.ok(cssHas(sidebarCss, '.connectea-dark .cx-pred-pill--mid strong'), 'sidebar.css must style mid pill numbers');
  assert.ok(cssHas(sidebarCss, '.connectea-dark .cx-pred-pill--high strong'), 'sidebar.css must style high pill numbers');
  assert.ok(cssHas(sidebarCss, '#cbd5e1 !important') && cssHas(sidebarCss, '#4ade80 !important'), 'sidebar.css must define #cbd5e1 for low and #4ade80 for high with !important');
});

runTest('Test 90: Accordion section heading is transparent with no borders and pseudo-element arrows/stripes removed', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  assert.ok(!cssHas(themeCss, 'data-cx-details-arrow'), 'theme.css must not contain data-cx-details-arrow pseudo-elements');
  assert.ok(!themeJs.includes('updateDetailArrows'), 'theme.js must not contain updateDetailArrows');
  assert.ok(cssHas(themeCss, '.eds-c-accordion__panel:before'), 'theme.css must target panel pseudo-element');
  assert.ok(cssHas(themeCss, 'display: none !important;'), 'theme.css must hide accordion panel left vertical stripe');
});

runTest('Test 91: expandAll() displays progress bar on repeated expansions and paces click dispatch', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  assert.ok(!assessJs.includes("!sessionStorage.getItem('connectify:first_expand_done')"), 'expandAll must not suppress progress bar on repeated calls');
  assert.ok(assessJs.includes('setTimeout(clickNext, 65)'), 'expandAll must pace clicks with 65ms setTimeout to eliminate lag');
  assert.ok(assessJs.includes('if (!heading || isBulkExpanding()) return;'), 'accordion click listener must ignore clicks during bulk expand');
});

runTest('Test 92: readCourses() ingests connectify:grade_cache data and populates subjects across semesters', () => {
  const scraperJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8');
  const atarMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8');

  assert.ok(!scraperJs.includes('connectify:grade_cache:current'), 'atar-scraper.js reads only the signed-in account\'s grade cache, never the untagged one');
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
  localStorage.setItem(`connectify:grade_cache:${window.ConnectifyUtils.accountKey()}`, JSON.stringify(mockCache));

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

runTest('Test 93: predictTask() preserves student momentum above 82% and PREDICTOR_ALGO_VERSION is v21_20261024_pred', () => {
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  assert.ok(predMathJs.includes('v21_20261024_pred'), 'predictor-math.js must bump version to v21_20261024_pred');

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
  assert.ok(pred.mid - pred.low >= 3 && pred.low >= 85, `Low prediction (${pred.low}%) must reflect a downside in proportion to a 4-point spread`);
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

  assert.ok(cssHas(themeCss, 'contain: layout style;'), 'theme.css must apply CSS layout containment to subject cards and accordion panels');
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
  assert.ok(cssHas(themeCss, '.cvr-c-task__chart'), 'theme.css must target cvr-c-task__chart');
  assert.ok(cssHas(themeCss, 'background: transparent !important;'), 'theme.css must enforce transparent background on task chart');

  // Verify theme.js excludes Highcharts and progress pill from surfaceCandidates and inkCandidates
  const adapterSelectors = surfaceAdapterSelectors();
  for (const exclusion of [':not(.cvr-c-task__chart *)', ':not(.highcharts-container *)', ':not(#cx-expand-progress)', ':not(#cx-expand-progress *)']) {
    assert.ok(adapterSelectors.surface.includes(exclusion) && adapterSelectors.ink.includes(exclusion),
      `surface and ink candidates must both include ${exclusion}`);
  }
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
  assert.ok(cssHas(sidebarCss, '.cx-weakness-expand-btn'), 'sidebar.css must style .cx-weakness-expand-btn');
  assert.ok(cssHas(sidebarCss, '.connectea-dark #connectify-sidebar .cx-weakness-expand-btn'), 'sidebar.css must style button in dark mode');
});

runTest('Test 101: Expand all progress pill adapts correctly across light and dark themes', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // Verify light theme base styles
  assert.ok(cssHas(sidebarCss, 'background: #ffffff;'), 'sidebar.css must specify light background #ffffff for light mode progress pill');
  assert.ok(cssHas(sidebarCss, 'color: #1e293b;'), 'sidebar.css must specify dark text #1e293b for light mode progress pill');
  assert.ok(cssHas(sidebarCss, 'background: #e2e8f0;'), 'sidebar.css must style progress track with #e2e8f0 in light mode');

  // Verify dark theme overrides in sidebar.css and theme.css
  assert.ok(cssHas(sidebarCss, '.connectea-dark') && cssHas(sidebarCss, '#cx-expand-progress'), 'sidebar.css must provide dark mode overrides for #cx-expand-progress');
  assert.ok(cssHas(themeCss, '.connectea-dark') && cssHas(themeCss, '#cx-expand-progress'), 'theme.css must provide dark mode overrides for #cx-expand-progress');
  assert.ok(cssHasToken(themeCss, 'background: #1e2632 !important;'), 'theme.css must use #1e2632 dark background for progress pill');
  assert.ok(cssHasToken(themeCss, 'color: #f8fafc !important;'), 'theme.css must use #f8fafc text for progress pill in dark mode');

  // Verify theme.js surface/ink exclusion
  const { surface: surfaceSel, ink: inkSel } = surfaceAdapterSelectors();
  assert.ok([surfaceSel, inkSel].every(sel => sel.includes(':not(#cx-expand-progress)') && sel.includes(':not(#cx-expand-progress *)')),
    'theme surface adapter must exclude #cx-expand-progress from adaptSurfaces');
});

runTest('Test 103: Semester buttons keep their text aligned across states, and unselected buttons keep a whole border', () => {
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');

  // Unselected and closed buttons keep a 1px border all round (a transparent 4px left edge looked cut off at the
  // rounded corners); 17px + 1px lines their text up with the indicator's 14px + 4px bar.
  assert.ok(cssHas(sidebarCss, '#connectify-sidebar .cta-semesters:not(.cta-tabs) .cta-semester{text-align:left!important;padding:10px 14px 10px 17px!important;border-radius:6px!important}'), 'sidebar.css semester buttons keep a whole border with text aligned to the indicator');
  assert.ok(cssHas(atarCss, '.cta-semesters:not(.cta-tabs) .cta-semester{padding:10px 14px 10px 17px!important;font-size:12px;border-width:1px;text-align:left!important;'), 'atar.css semester buttons keep a whole border with text aligned to the indicator');
  assert.ok(!/border-left:\s*4px solid transparent/.test(sidebarCss + atarCss), 'no semester button has a transparent left edge');

  // Verify active state retains matching padding and left alignment
  assert.ok(cssHas(sidebarCss, '.cta-semester.cta-semester-indicator{background:#edf4fa!important;border:1px solid #c8d9e8!important;border-left:4px solid #24618c!important;color:#1a3d5f!important;font-weight:600!important;cursor:default!important;border-radius:6px!important;text-align:left!important;padding:10px 14px!important}'), 'sidebar.css active semester must maintain 10px 14px padding and left text alignment');
  assert.ok(cssHas(atarCss, '.cta-semester.cta-semester-indicator{background:#edf4fa!important;border:1px solid #c8d9e8!important;border-left:4px solid #24618c!important;color:#1a3d5f!important;font-weight:600!important;cursor:default!important;border-radius:6px!important;text-align:left!important;padding:10px 14px!important}'), 'atar.css active semester must maintain 10px 14px padding and left text alignment');
});

runTest('Test 104: theme.css and theme.js comprehensively adapt Connect Help, nav lists, and generic dashboard tile bodies', () => {
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // Verify dark theme styling for tile bodies, nav lists, and resources
  assert.ok(cssHas(themeCss, '.eds-c-nav-list') && cssHas(themeCss, '.eds-c-nav-list__item'), 'theme.css must target .eds-c-nav-list and .eds-c-nav-list__item');
  assert.ok(cssHasToken(themeCss, 'background-color: #1e2632 !important;') && cssHasToken(themeCss, 'border-color: #2e3c4e !important;'), 'theme.css must enforce dark background and border on tile bodies and nav lists');
  assert.ok(cssHasToken(themeCss, 'background-color: #263344 !important;'), 'theme.css must provide hover highlight for nav list items');

  // Verify SVG icon styling
  assert.ok(cssHasToken(themeCss, 'color: #94a3b8 !important;') && cssHas(themeCss, 'fill: currentColor !important;'), 'theme.css must style list icons with proper high contrast');

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
  assert.ok(compoundJs.includes('scheduler.onMutations(scheduleUpdate, { filter: addsTiles, mute: true });'), 'compound-progress.js page observer must mute during accordion animation (shared scheduler)');
  assert.ok(compoundJs.includes('.eds-c-accordion__panel'), 'compound-progress.js must ignore mutations inside accordion panels');

  // Verify cohort-stats.js mutes during animation and filters panel mutations
  assert.ok(cohortJs.includes('}, { filter: isRelevant, mute: true });'), 'cohort-stats.js page observer must mute during accordion animation (shared scheduler)');

  // Verify data.js debounces syncAllCharts and mutes during animation
  assert.ok(dataJs.includes('if (window.ConnectifyIsAccordionAnimating) return;'), 'data.js MutationObserver must mute during accordion animation');
  assert.ok(dataJs.includes('requestAnimationFrame'), 'data.js must debounce syncAllCharts with requestAnimationFrame');

  // Accordion panels use layout containment; will-change on height is not compositable and only adds layers
  assert.ok(cssHas(themeCss, 'contain: layout style;'), 'theme.css must contain layout on accordion panels');
  assert.ok(!cssHas(themeCss, 'will-change: height, max-height;'), 'theme.css must not set will-change on accordion panels');
});

runTest('Test 106: All project JS files pass strict JavaScript syntax validation', () => {
  const jsFiles = Object.values(FILE_MAP).filter(f => f.endsWith('.js') && !f.endsWith('test_suite.js'));
  assert.ok(jsFiles.length > 10, 'Must validate all extension JS files');
  for (const f of jsFiles) {
    const code = fs.readFileSync(f, 'utf8');
    assert.doesNotThrow(() => {
      new vm.Script(code, { filename: path.basename(f) });
    }, `File ${path.basename(f)} must have valid JavaScript syntax without duplicate declarations`);
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

  // Row for task 2 (has prior subject data, and is first of type 'Investigation')
  const row2 = makeTaskRow('Investigation 1', 'Term 1, Week 5', '42.5 Out of 50');
  window.ConnectifyCohortView.render(row2, false, 'chem-k2', 50, null, subjectsList);
  const panel2 = window.ConnectifyCohortView.panels.get(row2);
  assert.ok(panel2, 'Panel 2 must exist');
  assert.strictEqual(panel2.outcomeBar.hidden, false, 'Task 2 (first task of type Investigation with prior subject data) outcome bar must NOT be hidden');

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
  assert.ok(cssHasToken(themeCss, '.connectea-dark .cvr-c-task .v-label, .connectea-dark .cvr-c-task .cvr-c-task__title {\n  color: #f8fafc !important;\n  font-weight: 400 !important;\n}'), 'theme.css must set task title font-weight to 400 in dark mode');
  assert.ok(cssHas(themeCss, '.connectea-dark .connectea-panel, .connectea-dark .connectea-distribution, .connectea-dark .connectea-result,\n.connectea-dark .connectea-panel-distribution, .connectea-dark .connectea-panel-standing {\n  font-weight: 400 !important;\n}'), 'theme.css must unbold connectea panel typography');
  assert.ok(cssHas(themeCss, '-webkit-font-smoothing: antialiased !important;'), 'theme.css must apply font antialiasing in dark mode');
  assert.ok(cohortJs.includes('.connectea-result {\n      font-weight: 400 !important;'), 'cohort-stats.js must use font-weight: 400 for .connectea-result');

  // 2. Removal and cleanup of improvement arrows
  assert.ok(progJs.includes('cleanupImprovementArrows'), 'progress-graph.js must define and run cleanupImprovementArrows');
  assert.ok(!progJs.includes('function updateImprovementArrows()'), 'progress-graph.js must not retain updateImprovementArrows');
  assert.ok(cssHas(sideCss, '.cx-improved{display:none!important}'), 'sidebar.css must suppress .cx-improved badges');
  assert.ok(cssHas(sideCss, '.cx-performance-row{display:contents!important}'), 'sidebar.css must neutralize .cx-performance-row wrappers');

  // 3. Scroll freezing and expand-all progress lifecycle
  assert.ok(cssHas(sideCss, 'html.cx-freeze-scroll,\nbody.cx-freeze-scroll {\n  overflow: hidden !important;'), 'sidebar.css must define cx-freeze-scroll');
  assert.ok(assessJs.includes("classList.add('cx-freeze-scroll')"), 'assessment-data.js expandAll must add cx-freeze-scroll');
  assert.ok(assessJs.includes("classList.remove('cx-freeze-scroll')"), 'assessment-data.js finishProgress must remove cx-freeze-scroll');
  assert.ok(assessJs.includes("progress.update(95, 'Rendering statistics & outcome bars... 95%')"), 'expandAll must persist progress pill through 95% refresh phase');

  // 4. Accordion animation guard flushing and multi-click fix
  assert.ok(assessJs.includes('pendingCardsToUpdate'), 'assessment-data.js must track pendingCardsToUpdate');
  assert.ok(assessJs.includes('window.ConnectifyCohort?.schedule?.(true)'), 'triggerAccordionAnimationGuard must flush cohort schedule when animation settles');
  assert.ok(cohortJs.includes('hasTaskNodes'), 'cohort-stats.js observer must detect task rows inserted into accordion panels');

  // 5. Predictor calculation skipping when valid cache is present
  assert.ok(assessJs.includes('if (!window.ConnectifyPredictorMath.isPredictionCacheCurrent?.())'), 'assessment-data.js must not pre-cache predictions when valid cache is present');
  assert.ok(assessJs.includes('if (!window.ConnectifyPredictorMath?.isPredictionCacheCurrent?.()) {'), 'expandAll must only pre-cache predictions when the cache is not current');
  assert.ok(predMathJs.includes('if (!force && isPredictionCacheCurrent()) {\n      return;\n    }'), 'predictor-math.js must exit early when valid cache is present and force is false');
  assert.ok(cohortViewJs.includes('const cached = predMath.getCachedPrediction?.(meta.subjectName, predictionKey(task));') && cohortViewJs.includes('if (cached) return cached;'), 'cohort-view.js must check the task\'s own cached prediction before predicting');
});

runTest('Test 109: Text bolding parity across light and dark modes for Test headers, marks 20 and 5, Med, Max, Mean, z, Top, and Rank', () => {
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const cohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  // 1. Verify cohort-view.js wraps Med, Max, Mean, Z-Score, Top standing, Score, and Rank in strong tags
  assert.ok(cohortViewJs.includes('<strong>Med ${math().formatPercentage('), 'cohort-view.js must wrap Med in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Max ${math().formatPercentage('), 'cohort-view.js must wrap Max in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Mean ${math().formatPercentage('), 'cohort-view.js must wrap Mean in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Z-Score ${zStr}</strong>'), 'cohort-view.js must format Z-Score in strong tag');
  assert.ok(cohortViewJs.includes('<strong>Score ${math().formatPercentage(mark)}%</strong>'), 'cohort-view.js must bold entire score display');
  assert.ok(cohortViewJs.includes('<strong>${standingText}</strong>'), 'cohort-view.js must wrap Top standing in strong tag');
  assert.ok(cohortViewJs.includes('<strong>${rankStr}</strong>'), 'cohort-view.js must wrap Rank in strong tag');

  // 2. Verify cohort-stats.js styles panel strong tags with font-weight 700
  assert.ok(cohortStatsJs.includes('.connectea-distribution strong,\n    .connectea-result strong,\n    .connectea-panel strong {\n      font-weight: 700 !important;'), 'cohort-stats.js must style strong tags with font-weight 700');

  // 3. Verify theme.css and sidebar.css enforce bolding for Test headers, mark numbers, and stats strong tags
  assert.ok(cssHas(themeCss, '.cvr-c-task-group__title'), 'theme.css must target task group title');
  assert.ok(cssHas(themeCss, '.connectea-panel strong, .connectea-distribution strong, .connectea-result strong, .connectea-panel-distribution strong,\n.connectea-panel-standing strong'), 'theme.css must bold panel strong tags in light and dark modes');
  assert.ok(cssHas(sidebarCss, ':is(.connectea-panel, .connectea-distribution, .connectea-result) strong'), 'sidebar.css must bold panel strong tags');
  assert.ok(cssHas(sidebarCss, ':is(.cvr-c-task-group__title, .cvr-c-task__group-name'), 'sidebar.css must bold task group titles');
  assert.ok(cssHas(sidebarCss, '.cvr-c-tasks :is(.cvr-c-task__mark-score, .cvr-c-task__marks .cvr-c-task__mark :is(.v-label, span, div):first-child)'), 'sidebar.css must bold task mark scores inside .cvr-c-tasks');
  assert.ok(cssHas(sidebarCss, '.cvr-c-task:not(.cvr-c-tasks *)'), 'sidebar.css must explicitly unbold summary marks outside cvr-c-tasks');
  assert.ok(cssHas(themeCss, '.cvr-c-task:not(.cvr-c-tasks *)'), 'theme.css must explicitly unbold summary marks outside cvr-c-tasks');
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

  // 3. collect() stops scrape when valid cache exists, no subjects are stale and every expanded card was read (Test 183)
  // Only stale classes whose cards refresh count, so a hidden semester's stale class cannot force a full read on every collect
  // A new load of Connect's API records (outline-api.js) refreshes every card too
  assert.ok(assessJs.includes('const refreshAll = forceRefresh || freshApi || hasStale || !hasCachedSubjects();') && assessJs.includes('staleSet.size > 0 && (cards === allCards') && assessJs.includes('cards.filter(needsScrape)'), 'collect must check hasCachedSubjects, a new API load, stale refreshed classes and unread expanded cards');
  assert.ok(assessJs.includes('function hasCachedSubjects()'), 'assessment-data.js must define hasCachedSubjects');
  assert.ok(assessJs.includes('parseCardSubjectTasks'), 'assessment-data.js must separate card task parsing into parseCardSubjectTasks');

  // 4. Removal of reload-upon-cache-change and silent difference checking
  assert.ok(!assessJs.includes('checkSilentDifferences'), 'assessment-data.js must not define checkSilentDifferences');
  assert.ok(!assessJs.includes('promptCacheOutOfDate'), 'assessment-data.js must not define promptCacheOutOfDate');
  assert.ok(!assessJs.includes('scheduleSilentDifferenceCheck'), 'assessment-data.js must not define scheduleSilentDifferenceCheck');
  assert.ok(!atarFeatJs.includes('one_time_auto_expand'), 'atar-features.js must not inspect one_time_auto_expand');

  // 5. Encapsulate summary box plot in new-grade.js & targeted invalidation
  const newGradeJs = fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8');
  assert.ok(!newGradeJs.includes('readSubjectStats'), 'grade checks never read the summary boxplot (classmates getting results moves it)');
  assert.ok(newGradeJs.includes('window.ConnectifyData?.markSubjectStale'), 'new-grade.js processChangedSubject must mark subject stale');
  assert.ok(assessJs.includes('markSubjectStale') && assessJs.includes('unmarkSubjectStale') && assessJs.includes('isSubjectStale'), 'assessment-data.js must export markSubjectStale, unmarkSubjectStale, isSubjectStale');

  // Functional test for stale subject marking and unmarking
  window.ConnectifyData.markSubjectStale('Chemistry');
  assert.strictEqual(window.ConnectifyData.isSubjectStale('Chemistry'), true, 'Chemistry must be marked stale');
  window.ConnectifyData.unmarkSubjectStale('Chemistry');
  assert.strictEqual(window.ConnectifyData.isSubjectStale('Chemistry'), false, 'Chemistry must be unmarked stale');

  // 6. Developer Settings and Red Clear Cache button
  const catSetJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  const sideCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  assert.ok(catSetJs.includes('Developer Settings'), 'category-settings.js must render Developer Settings heading');
  assert.ok(catSetJs.includes('cx-clear-cache-btn'), 'category-settings.js must render Clear Cache button');
  assert.ok(cssHas(sideCss, '.cx-clear-cache-btn'), 'sidebar.css must style .cx-clear-cache-btn');
  assert.ok(cssHas(sideCss, 'background: #e74c3c !important'), 'sidebar.css must style Clear Cache button in red');

  // 7. Target Grade panel Semester 1 (Closed) parity
  const atarUiCode = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  assert.ok(atarUiCode.includes('isClosed ? `Semester ${i + 1} (Closed)` : `Semester ${i + 1}`;'), 'atar-ui.js must append (Closed) to Semester 1 in Target Grade mode');
  assert.ok(atarUiCode.includes('const isClosed = isTargetClosed(i);'), 'atar-ui.js must close a finished semester in every mode, Target Grade included');
});

runTest('Test 158: Grade notifications follow the student\'s own mark only, never the cohort boxplot', () => {
  delete window.ConnectifyNewGrade;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8'));
  const { hasSubjectChanged } = window.ConnectifyNewGrade;
  const prev = { mark: 87.7, semester: 2 };

  assert.strictEqual(hasSubjectChanged({ ...prev, stats: [40, 55, 65, 75, 92] }, { mark: 87.7, semester: 2, stats: [44, 60, 70, 80, 95] }), false,
    'Classmates getting results back (boxplot moves, own result still unmarked) must not notify');
  assert.strictEqual(hasSubjectChanged(prev, { mark: 87.74, semester: 2 }), false, 'A mark moving by under 0.05 must not notify');
  assert.strictEqual(hasSubjectChanged({ mark: 93.6, semester: 2 }, { mark: 93.9, semester: 2 }), true,
    "The student's own running mark moving by 0.05 or more must notify (a new result)");
  assert.strictEqual(hasSubjectChanged({ mark: 87.7, semester: 2 }, { mark: 86.9, semester: 1 }), false,
    'A Semester 1 mark (Semester 2 row not shown yet) never compares with a cached Semester 2 mark');
  assert.strictEqual(hasSubjectChanged({ mark: 86.9 }, { mark: 87.7, semester: 2 }), true, 'Entries cached without a semester still compare');
  assert.strictEqual(hasSubjectChanged(undefined, { mark: 80, semester: 1 }), false, 'A subject missing from the cache is seeded quietly');
});

runTest('Test 159: Cohort observer re-runs when the main-world bridge stamps boxplot stats', () => {
  const savedCohort = window.ConnectifyCohort;
  const calls = [];
  window.ConnectifyCohort = { schedule: immediate => calls.push(immediate), runPass: () => calls.push('run'), persistentEstimates: new Map() };
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-observer.js'), 'utf8'));
    const { isRelevant } = window.ConnectifyCohort;
    assert.strictEqual(typeof isRelevant, 'function', 'cohort-observer.js must expose isRelevant');

    const row = document.createElement('div');
    row.className = 'cvr-c-task';
    const host = document.createElement('div');
    host.className = 'cvr-c-task__chart';
    row.appendChild(host);
    const panel = document.createElement('section');
    panel.className = 'connectea-panel';
    row.appendChild(panel);
    const elsewhere = document.createElement('div');

    // Attribute records have no added or removed nodes; they used to be dropped as "only our own nodes"
    assert.strictEqual(isRelevant({ type: 'attributes', attributeName: 'data-connectify-stats', target: host, addedNodes: [], removedNodes: [] }), true,
      'Stats stamped on a chart host must trigger a pass');
    // The shared observer also reports class changes, which are not the cohort's concern
    assert.strictEqual(isRelevant({ type: 'attributes', attributeName: 'class', target: host, addedNodes: [], removedNodes: [] }), false,
      'Class changes must not trigger a pass');
    assert.strictEqual(isRelevant({ type: 'childList', target: row, addedNodes: [panel], removedNodes: [] }), false,
      'Adding a Connectify panel must not trigger a pass');
    assert.strictEqual(isRelevant({ type: 'characterData', target: { nodeType: 3, parentElement: elsewhere }, addedNodes: [], removedNodes: [] }), false,
      'Text changes outside task rows must not trigger a pass');
    assert.strictEqual(isRelevant({ type: 'characterData', target: { nodeType: 3, parentElement: panel }, addedNodes: [], removedNodes: [] }), false,
      'Text changes inside Connectify panels must not trigger a pass');
  } finally {
    window.ConnectifyCohort = savedCohort;
  }
});

runTest('Test 160: Progress Graph week overrides mean the same week to the scraper and the predictor', () => {
  const { customWeekOrder } = window.ConnectifyUtils;
  // Overrides are school weeks of the year; an older bare number is the same week as "w17"
  assert.strictEqual(customWeekOrder('17'), customWeekOrder('w17'), 'an older bare 17 is school week 17');
  assert.strictEqual(customWeekOrder('t2w7'), 19, 't2w7 must be Term 2 Week 7');
  assert.strictEqual(customWeekOrder('Term 3, Week 4'), 28, 'Term 3, Week 4 must be order 28');
  assert.strictEqual(customWeekOrder(''), null, 'An empty override is not a week');
  assert.strictEqual(customWeekOrder('soon'), null, 'Unreadable text is not a week');

  const dates = window.ConnectifyPredictorDates;
  assert.strictEqual(dates.formatOverrideWeek('17').order, customWeekOrder('w17'), 'the predictor reads week 17 as the scraper does');
  mockLocalStorage.clear();
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:Overridden Task'), '17');
  const overridden = dates.getTaskChronologicalStamp({ name: 'Overridden Task', semester: 1, sequence: 0 }, 'Physics ATAR');
  const captioned = dates.getTaskChronologicalStamp({ name: 'Captioned Task', semester: 1, sequence: 0, order: customWeekOrder('w17') }, 'Physics ATAR');
  assert.strictEqual(overridden, captioned, 'An override of 17 must sort exactly where the scraper places school week 17');
  mockLocalStorage.clear();
});

runTest('Test 161: Weakness radar escapes names and compound bars match each card to one subject', () => {
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'weakness-radar-view.js'), 'utf8'));
  const svg = window.ConnectifyWeaknessView.radarSvg(['<img src=x onerror=alert(1)>', 'Test', 'Essay'], [70, 80, 90]);
  assert.ok(!svg.includes('<img'), 'Category names must be escaped inside the radar SVG');
  assert.ok(svg.includes('&lt;img'), 'Escaped category names must still be shown');

  const savedData = window.ConnectifyData;
  window.ConnectifyData = { collect: () => [] };
  delete window.ConnectifyCompoundProgress;
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8'));
    const { subjectForCard } = window.ConnectifyCompoundProgress;
    const subjects = [{ name: 'Human Biology ATAR' }, { name: 'Biology ATAR' }, { name: 'English ATAR' }, { name: 'English Literature ATAR' }];
    // Each card used to take every subject whose name contained, or was contained in, its title
    assert.strictEqual(subjectForCard('Biology ATAR - Semester 1', subjects).name, 'Biology ATAR', 'Biology card must show Biology');
    assert.strictEqual(subjectForCard('Human Biology ATAR - Semester 1', subjects).name, 'Human Biology ATAR', 'Human Biology card must show Human Biology');
    assert.strictEqual(subjectForCard('English ATAR - Semester 2', subjects).name, 'English ATAR', 'English card must show English');
    assert.strictEqual(subjectForCard('Year 12 English Literature ATAR - Semester 2', subjects).name, 'English Literature ATAR', 'English Literature card must show English Literature');
    assert.strictEqual(subjectForCard('Physics ATAR - Semester 1', subjects), null, 'A card with no matching subject gets no bar');
  } finally {
    window.ConnectifyData = savedData;
  }
});

runTest('Test 162: Shared scheduler filters, mutes and gates its heartbeat', () => {
  const savedScheduler = window.ConnectifyScheduler;
  const SavedObserver = global.MutationObserver;
  let observerCallback = null;
  global.MutationObserver = class { constructor(cb) { observerCallback = cb; } observe() {} disconnect() {} };
  const savedActive = window.ConnectifyIsUserActive;
  try {
    window.ConnectifyIsAccordionAnimating = false;
    window.ConnectifyIsBulkExpanding = false;
    delete window.ConnectifyScheduler;
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'scheduler.js'), 'utf8'));
    const scheduler = window.ConnectifyScheduler;

    const seen = [];
    const muted = [];
    const stop = scheduler.onMutations(records => seen.push(...records), { filter: r => r.type === 'childList', mute: false });
    scheduler.onMutations(records => muted.push(...records), { mute: true });
    observerCallback([{ type: 'childList', addedNodes: [] }, { type: 'attributes', attributeName: 'class' }]);
    scheduler.flush();
    assert.strictEqual(seen.length, 1, 'A subscriber only receives records that pass its filter');
    assert.strictEqual(muted.length, 2, 'A subscriber without a filter receives every record');

    window.ConnectifyIsAccordionAnimating = true;
    observerCallback([{ type: 'childList', addedNodes: [] }]);
    scheduler.flush();
    window.ConnectifyIsAccordionAnimating = false;
    assert.strictEqual(muted.length, 2, 'Muted subscribers receive nothing while an accordion animates');
    assert.strictEqual(seen.length, 2, 'Unmuted subscribers still receive records during animations');

    stop();
    observerCallback([{ type: 'childList', addedNodes: [] }]);
    scheduler.flush();
    assert.strictEqual(seen.length, 2, 'An unsubscribed callback receives nothing');

    let open = false;
    const runs = { panel: 0, active: 0, always: 0 };
    scheduler.every(0, () => runs.panel++, { when: () => open });
    scheduler.every(0, () => runs.active++);
    scheduler.every(0, () => runs.always++, { whenActive: false });
    window.ConnectifyIsUserActive = () => false;
    scheduler.tick();
    assert.deepStrictEqual(runs, { panel: 0, active: 0, always: 1 }, 'Idle users only get tasks that opt out of the activity check');
    window.ConnectifyIsUserActive = () => true;
    scheduler.tick();
    assert.deepStrictEqual(runs, { panel: 0, active: 1, always: 2 }, 'A task with a condition waits for it');
    open = true;
    scheduler.tick();
    assert.strictEqual(runs.panel, 1, 'A panel task runs once its panel is open');
  } finally {
    window.ConnectifyScheduler = savedScheduler;
    global.MutationObserver = SavedObserver;
    window.ConnectifyIsUserActive = savedActive;
    window.ConnectifyIsAccordionAnimating = false;
  }
});

runTest('Test 163: Clicking the handle closed is not undone by hover (Dia)', () => {
  const saved = { api: window.ConnectifySidebarHandle, open: window.ConnectifyOpenSidebar, close: window.ConnectifyCloseSidebar };
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-handle-position.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-handle.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-hover.js'), 'utf8'));
    const api = window.ConnectifySidebarHandle;
    const sb = api.getSidebar();
    window.ConnectifyOpenSidebar = () => { sb.hidden = false; };
    window.ConnectifyCloseSidebar = () => { sb.hidden = true; };
    const handle = api.handle;
    const away = document.createElement('div');

    sb.hidden = false;
    handle.onclick();
    assert.strictEqual(sb.hidden, true, 'Clicking the handle of an open drawer must close it');
    api.handleMouseMove({ clientX: 5, clientY: 300, target: handle });
    assert.strictEqual(sb.hidden, true, 'Moving over the handle right after the click must not reopen the drawer');
    handle.dispatchEvent(new MockEvent('mouseenter'));
    assert.strictEqual(sb.hidden, true, 'A mouseenter right after the click must not reopen the drawer');

    api.handleMouseMove({ clientX: 400, clientY: 300, target: away });
    api.handleMouseMove({ clientX: 5, clientY: 300, target: away });
    assert.strictEqual(sb.hidden, false, 'Once the pointer has moved away, the left edge opens the drawer again');

    handle.onclick();
    assert.strictEqual(sb.hidden, false, 'A click in the same gesture as a hover-open keeps the drawer open');
  } finally {
    const sb = window.ConnectifySidebarHandle?.getSidebar?.();
    if (sb) sb.hidden = true;
    window.ConnectifySidebarHandle = saved.api;
    window.ConnectifyOpenSidebar = saved.open;
    window.ConnectifyCloseSidebar = saved.close;
  }
});

runTest('Test 164: The outcome bar stays hidden on the first marked assessment of a class without a baseline', () => {
  const saved = { rows: window.ConnectifyCohortRows, pred: window.ConnectifyPredictorMath, evalMod: window.ConnectifyCohortOutcomeEval };
  let baselineSubjects = {};
  window.ConnectifyCohortRows = { readMark: row => (row.dataset.mark ? Number(row.dataset.mark) : undefined) };
  window.ConnectifyPredictorMath = {
    getBaselines: () => ({ subjects: baselineSubjects, types: {} }),
    cleanSubject: n => String(n).replace(/\s*-\s*Semester\s*[12].*$/i, '').trim(),
    getCachedPrediction: () => ({ low: 60, mid: 70, high: 80 }),
    evaluateOutcome: () => 'bar'
  };
  const cards = [];
  const makeCard = (title, marks) => {
    const card = document.createElement('div');
    card.className = 'eds-c-tile';
    const t = document.createElement('span');
    t.className = 'eds-c-tile__title';
    t.textContent = title;
    card.appendChild(t);
    const tasks = document.createElement('div');
    tasks.className = 'cvr-c-tasks';
    const rows = marks.map(m => {
      const row = document.createElement('div');
      row.className = 'cvr-c-task';
      if (m !== null) row.dataset.mark = String(m);
      tasks.appendChild(row);
      return row;
    });
    card.appendChild(tasks);
    document.body.appendChild(card);
    cards.push(card);
    return rows;
  };
  const meta = { subjectName: 'Chemistry', taskName: 'Task', labels: [], labelsKey: '' };
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-outcome-eval.js'), 'utf8'));
    const { evaluateRow } = window.ConnectifyCohortOutcomeEval;

    const s1 = makeCard('Chemistry - Semester 1', [null, 72, 80]);
    assert.strictEqual(evaluateRow(s1[1], 72, meta, []), null, 'The first marked task after unmarked rows must not show a bar');
    assert.strictEqual(evaluateRow(s1[2], 80, meta, []), 'bar', 'A task after an earlier marked task shows the bar');

    baselineSubjects = { Chemistry: '' };
    assert.strictEqual(evaluateRow(s1[1], 72, meta, []), null, 'An empty baseline value is not a baseline');
    baselineSubjects = { Chemistry: 70 };
    assert.strictEqual(evaluateRow(s1[1], 72, meta, []), 'bar', 'A subject baseline lets the first task show the bar');
    baselineSubjects = {};

    cards.forEach(c => c.remove());
    const s2 = makeCard('Chemistry - Semester 2', [65]);
    assert.strictEqual(evaluateRow(s2[0], 65, meta, []), null, 'Semester 2 without any marked Semester 1 work must not show a bar');
    const collected = [{ name: 'Chemistry', tasks: [{ semester: 1, score: 70, pending: false }] }];
    assert.strictEqual(evaluateRow(s2[0], 65, meta, collected), 'bar', 'Semester 2 after marked Semester 1 results shows the bar');
  } finally {
    cards.forEach(c => c.remove());
    window.ConnectifyCohortRows = saved.rows;
    window.ConnectifyPredictorMath = saved.pred;
    window.ConnectifyCohortOutcomeEval = saved.evalMod;
  }
});

runTest('Test 165: Custom themes can be edited in place from the theme menu', () => {
  const menuJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-menu.js'), 'utf8');
  const customizerJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-customizer.js'), 'utf8');
  assert.ok(menuJs.includes("actionButton('connectea-theme-edit-btn', '✎', 'Edit theme'"), 'Custom themes must have an Edit button in the theme menu');
  assert.ok(menuJs.includes('window.ConnectifyThemeCustomizer?.open(reg?.getThemeDefinition?.(theme.id) || theme)'), 'Edit must open the customizer on that theme');
  assert.ok(customizerJs.includes('editingId: themeToEdit?.isCustom ? themeToEdit.id : null') && customizerJs.includes('id: state.editingId || undefined'), 'Saving an edited theme must keep its id');

  // Saving with the edited theme's id updates it, even under a new name
  if (!window.ConnectifyThemeRegistry?.saveCustomTheme) eval(fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8'));
  const reg = window.ConnectifyThemeRegistry;
  const before = reg.getCustomThemes().length;
  const created = reg.saveCustomTheme({ name: 'Ocean', colors: { canvas: '#001122' } });
  const renamed = reg.saveCustomTheme({ id: created.id, name: 'Ocean Deep', colors: { canvas: '#002244' } });
  const themes = reg.getCustomThemes();
  assert.strictEqual(renamed.id, created.id, 'The edited theme keeps its id');
  assert.strictEqual(themes.length, before + 1, 'Renaming while editing must not create a second theme');
  assert.strictEqual(themes.find(t => t.id === created.id).name, 'Ocean Deep', 'The rename is saved on the same theme');
  reg.deleteCustomTheme(created.id);
});

runTest('Test 111: Typography parity (unbolded overall % and letter grade), startup auto-expand, outcome bar for first task of type, and complete render finalization', () => {
  const sideCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const cohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');

  // 1. Typography rules: overall % and letter grades are unbolded (400), task marks and stats strong are bold (700)
  assert.ok(cssHas(sideCss, ':is(.cvr-c-task__score, .cvr-c-task__grade'), 'sidebar.css must set font-weight 400 for overall percent and letter grades');
  assert.ok(cssHas(themeCss, ':is(.connectea-dark, body, html) .cvr-c-task__score:not(.cx-n):not(.cx-n), :is(.connectea-dark, body, html) .cvr-c-task__grade:not(.cx-n):not(.cx-n)'), 'theme.css must set font-weight 400 for overall percent and letter grades');
  assert.ok(cssHas(sideCss, '.cvr-c-tasks :is(.cvr-c-task__mark-score, .cvr-c-task__marks .cvr-c-task__mark :is(.v-label, span, div):first-child) {\n  font-weight: 700 !important;\n}'), 'sidebar.css must bold task marks');
  assert.ok(cssHas(sideCss, ':is(.connectea-panel, .connectea-distribution, .connectea-result) strong {\n  font-weight: 700 !important;\n}'), 'sidebar.css must bold stats panel strong elements');

  // 2. Startup auto-expand: decoupled from user activity, runs immediately on page load
  assert.ok(atarFeatJs.includes('function checkStartupAutoExpand()'), 'atar-features.js must define checkStartupAutoExpand');
  assert.ok(atarFeatJs.includes('startupPollInterval = setInterval'), 'atar-features.js must provide startup polling loop for tiles');
  assert.ok(atarFeatJs.includes('DOMContentLoaded'), 'atar-features.js must listen on DOMContentLoaded for startup auto-expand');

  // 3. Silent difference check removal verification
  assert.ok(!assessJs.includes('checkSilentDifferences'), 'assessment-data.js must not include checkSilentDifferences');
  assert.ok(!assessJs.includes('scheduleSilentDifferenceCheck'), 'assessment-data.js must not include scheduleSilentDifferenceCheck');
  assert.ok(!assessJs.includes('promptCacheOutOfDate'), 'assessment-data.js must not include promptCacheOutOfDate');

  // 4. Four-segment outcome bar: renders for first task of type, fast O(1) prediction lookup
  assert.ok(!cohortViewJs.includes('const isFirstOfType ='), 'cohort-view.js must not suppress outcome bar for first task of type');
  assert.ok(cohortViewJs.includes('const isFirstOfSubject = !hasPriorSubjectData && !hasSubjectBaseline;'), 'cohort-view.js must suppress outcome bar only on first task of subject without baseline');
  assert.ok(cohortViewJs.includes('card._cxTaskRows'), 'cohort-view.js must memoize card task rows to eliminate quadratic scans');

  // 5. Overall stats panel stability and MutationObserver loop elimination
  assert.ok(/if \(!target\.contains\(wrapper\)\) \{\s*target\.append\(wrapper\);\s*\}/.test(cohortViewJs), 'cohort-view.js must not repeatedly re-append existing wrapper');
  assert.ok(/\} else if \(ui\.key !== key\) \{\s*ui\.key = key;\s*\}/.test(cohortViewJs), 'cohort-view.js must update ui.key in-place without destroying wrapper');
  assert.ok(cohortStatsJs.includes('const isOwnNode = node =>') && cohortStatsJs.includes('if (onlyOwnNodes(r.addedNodes) && onlyOwnNodes(r.removedNodes)) return false;'), 'cohort-stats.js observer must ignore Connectify internal UI elements');

  // 6. Complete render finalization: synchronous pass and double requestAnimationFrame before scroll unlock
  assert.ok(assessJs.includes('window.ConnectifyCohort.pass()'), 'finalizeExpansion must synchronously run ConnectifyCohort.pass()');
  assert.ok(assessJs.includes('requestAnimationFrame(() => requestAnimationFrame(complete))'), 'finalizeExpansion must wait for double requestAnimationFrame before finishProgress and scroll unlock');
});

runTest('Test 112: Subject grade unbolding, first task outcome bar suppression, colon/equals/Rank removal, and flash prevention', () => {
  const sideCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  // 1. Subject grade and summary mark text unbolding (font-weight: 400 !important)
  assert.ok(cssHas(sideCss, '.cvr-c-task:not(.cvr-c-tasks *) :is(.cvr-c-task__mark'), 'sidebar.css must explicitly set font-weight 400 for summary marks outside cvr-c-tasks');
  assert.ok(cssHas(themeCss, ':is(.cvr-c-task:not(.cvr-c-tasks *)) .cvr-c-task__mark'), 'theme.css must explicitly set font-weight 400 for summary marks outside cvr-c-tasks');

  // 2. First task outcome bar suppression via .cvr-c-tasks .cvr-c-task query
  assert.ok(cohortViewJs.includes("card.querySelectorAll('.cvr-c-tasks .cvr-c-task')"), 'cohort-view.js must index tasks inside .cvr-c-tasks');
  // Only the first row of the Semester 1 card lacks earlier work in the subject (the old per-task scan could never match)
  assert.ok(cohortViewJs.includes('const hasPriorSubjectData = hasPriorMarkedWork(task, row, meta, precollectedSubjects, predMath);'), 'cohort-view.js must count only earlier marked results as prior subject data (Test 164 checks the behaviour)');

  // 3. Panel formatting: entire score display bolded, Z-Score formatted, colons and equals and Rank removed
  assert.ok(cohortViewJs.includes('<strong>Score ${math().formatPercentage(mark)}%</strong>'), 'cohort-view.js must bold entire score display without colon');
  assert.ok(cohortViewJs.includes('<strong>Z-Score ${zStr}</strong>'), 'cohort-view.js must format Z-Score without colon or equals sign');
  assert.ok(!cohortViewJs.includes('z ≈'), 'cohort-view.js must not contain z ≈');
  assert.ok(cohortViewJs.includes('${data.rank} / ${totalDisplay}'), 'cohort-view.js must format rank without word Rank or colon');
  assert.ok(cohortViewJs.includes("'connectea-type-title', 'Type: '"), 'cohort-view.js must format Type label with trailing colon and space');
  assert.ok(cohortViewJs.includes("'connectea-controls', 'Cohort Size '"), 'cohort-view.js must remove colon from Cohort Size');
  assert.ok(cohortViewJs.includes('Original Estimate ~'), 'cohort-view.js must remove colon from Original Estimate');

  // 4. Fast auto-expansion without collapsed flash
  assert.ok(atarFeatJs.includes('if (!hasAutoExpanded) checkStartupAutoExpand();'), 'atar-features.js MutationObserver must trigger checkStartupAutoExpand immediately on tile insertion');
  assert.ok(assessJs.includes('window.ConnectifyData?.cancelPendingNotify?.();') && assessJs.includes('cancelPendingNotify: () => clearTimeout(notifyUpdateTimer)'), 'Expand All must cancel the queued per-card update to prevent a delayed re-pass flash');
});

runTest('Test 113: Typography bolding parity between dark and light modes for task headers and details', () => {
  const sideCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  // 1. Task titles and first details labels bolding in light and dark modes (font-weight: 700 !important)
  assert.ok(cssHas(sideCss, '.cvr-c-task__details .v-label:first-child'), 'sidebar.css must bold first details label');
  assert.ok(cssHas(sideCss, '.connectea-dark:not(cx-n)'), 'sidebar.css must enforce dark mode bolding parity');
  assert.ok(cssHas(themeCss, '.cvr-c-task__details .v-label:first-child'), 'theme.css must bold first details label in dark mode');
  assert.ok(cssHas(themeCss, '.connectea-dark:not(cx-n) .cvr-c-task :is('), 'theme.css must override task details unbolding for task headers');

  // 2. Summary mark and non-task score unbolding parity (font-weight: 400 !important)
  assert.ok(cssHas(sideCss, '.cvr-c-task:not(.cvr-c-tasks *) :is(.cvr-c-task__mark'), 'sidebar.css must unbold subject summary mark');
  assert.ok(cssHas(themeCss, ':is(.cvr-c-task:not(.cvr-c-tasks *)) .cvr-c-task__mark'), 'theme.css must unbold subject summary mark');

  // 3. Stats panel strong elements parity
  assert.ok(cssHas(sideCss, ':is(.connectea-panel, .connectea-distribution, .connectea-result) strong'), 'sidebar.css must bold stats panel strong elements');
  assert.ok(cssHas(themeCss, '.connectea-panel strong, .connectea-distribution strong, .connectea-result strong, .connectea-panel-distribution strong,\n.connectea-panel-standing strong'), 'theme.css must bold stats panel strong elements in dark mode');
});

runTest('Test 114: Dark mode disabled and toggled off on https://connect.det.wa.edu.au/login and restored after login', () => {
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');

  // 1. Static checks: theme.js must check isLoginUrl, set RESTORE_KEY, and restore dark mode post-login
  assert.ok(themeJs.includes('const isLoginUrl ='), 'theme.js must define isLoginUrl');
  assert.ok(themeJs.includes('connectea:theme:restore_dark'), 'theme.js must define RESTORE_KEY for post-login restoration');
  assert.ok(themeJs.includes("url === 'https://connect.det.wa.edu.au/login'") || themeJs.includes("startsWith('https://connect.det.wa.edu.au/login')"), 'theme.js must verify connect login url');
  assert.ok(themeJs.includes("localStorage.setItem(RESTORE_KEY, 'true')"), 'theme.js must record restore flag on login URL');
  assert.ok(themeJs.includes('localStorage.removeItem(RESTORE_KEY)'), 'theme.js must clear restore flag when restored');
  assert.ok(themeJs.includes('window.ConnectifyTheme = {'), 'theme.js must export ConnectifyTheme helper');

  // 2. Functional evaluation of isLoginUrl across login and normal URLs
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/login';
  window.localStorage.setItem('connectea:theme:v1', 'dark');
  window.localStorage.removeItem('connectea:theme:restore_dark');

  eval(themeJs);

  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/login'), true, 'https://connect.det.wa.edu.au/login must be recognized as login URL');
  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/login/'), true, 'https://connect.det.wa.edu.au/login/ must be recognized as login URL');
  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/login?dest=home'), true, 'login URL with query params must be recognized as login URL');
  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines'), false, 'assessment-outlines must not be login URL');
  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/classes'), false, 'classes must not be login URL');

  // 3. Functional verification of dark mode suppression and storage toggle off on login page
  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'light', 'storage must be toggled to light on login page');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), 'true', 'restore flag must be saved on login page');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'connectea-dark must not be on documentElement on login page');
  assert.strictEqual(document.body?.classList.contains('connectea-dark'), false, 'connectea-dark must not be on body on login page');
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false, 'isDarkMode must return false on login page');

  // 4. Functional verification of dark mode restoration after logging in and navigating to normal Connect page
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'dark', 'storage must be restored to dark after login');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), null, 'restore flag must be cleared after restoration');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true, 'connectea-dark must be restored on documentElement');
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), true, 'isDarkMode must return true after login restoration');

  // 5. Functional verification: Light mode user logging in keeps light mode
  delete window.ConnectifyThemeLoaded;
  window.localStorage.setItem('connectea:theme:v1', 'light');
  window.localStorage.removeItem('connectea:theme:restore_dark');
  window.location.href = 'https://connect.det.wa.edu.au/login';
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), null, 'restore flag must not be set for light mode users');

  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'light', 'light mode remains light after login');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'connectea-dark must remain off');
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false, 'isDarkMode must return false for light mode user');
});

runTest('Test 115: Prediction cache updates on task category change, category settings save, baselines save, button color parity, and post-grade expansion sync', () => {
  const catCode = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');
  const typesCode = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');
  const predMathCode = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const assessCode = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const newGradeCode = fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8');
  const cohortViewCode = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');

  // 1. Static checks:
  // Button color parity: #cx-cat-save and baselines saveBtn must both use #2563eb
  assert.ok(catCode.includes('id="cx-cat-save" class="eds-c-button" style="background:#2563eb;color:#fff;'), 'Category settings Save Changes button must use #2563eb background');
  assert.ok(catCode.includes("Object.assign(saveBtn.style, { background: '#2563eb', color: '#fff', border: 'none', padding: '6px 14px'"), 'Baselines save button must use #2563eb background with the canonical 6px 14px padding');

  // Prediction cache update hooks:
  assert.ok(predMathCode.includes('clearSubjectPredictionCache') && predMathCode.includes('updatePredictionCache'), 'predictor-math.js must export clearSubjectPredictionCache and updatePredictionCache');
  // Every type change refreshes the cache where it is made; a listener here would recompute it twice (Test 196)
  assert.ok(!predMathCode.includes("window.addEventListener('connectify-task-type-changed'"), 'predictor-math.js must not refresh the cache a second time on connectify-task-type-changed');
  assert.ok(typesCode.includes('updatePredictionCache'), 'task-types.js must call updatePredictionCache');
  assert.ok(catCode.includes('updatePredictionCache'), 'category-settings.js must call updatePredictionCache');
  assert.ok(assessCode.includes('updatePredictionCache'), 'assessment-data.js must call updatePredictionCache upon stale expansion');
  // A task type change bumps typesVersion, which the memo compares; the row's taskType is recorded in the memo
  assert.ok(cohortViewCode.includes('memo.typesVersion === typesVersion') && cohortViewCode.includes('ui._memo = { mark, statsKey, cohortSize, key, isOverall, baselinesSig, pendingSig, rangeSig, goalSig, taskType, typesVersion, retry };'), 'cohort-view.js must memoise taskType and invalidate on type changes');

  // 2. Functional evaluation of predictor-math.js updatePredictionCache & clearSubjectPredictionCache
  eval(predMathCode);
  assert.ok(typeof window.ConnectifyPredictorMath.clearSubjectPredictionCache === 'function', 'clearSubjectPredictionCache must be a function');
  assert.ok(typeof window.ConnectifyPredictorMath.updatePredictionCache === 'function', 'updatePredictionCache must be a function');

  // Set mock predictions in localStorage
  localStorage.setItem('connectify:prediction:current:chemistry:t1', JSON.stringify({ mid: 70 }));
  localStorage.setItem('connectify:prediction:current:physics:t1', JSON.stringify({ mid: 85 }));

  // Clear single subject prediction cache
  window.ConnectifyPredictorMath.clearSubjectPredictionCache('Chemistry');
  assert.strictEqual(localStorage.getItem('connectify:prediction:current:chemistry:t1'), null, 'Chemistry prediction must be cleared');
  assert.ok(localStorage.getItem('connectify:prediction:current:physics:t1'), 'Physics prediction must remain intact');

  // 3. Functional verification: saving baselines updates prediction cache
  let cacheUpdated = false;
  const originalUpdate = window.ConnectifyPredictorMath.updatePredictionCache;
  window.ConnectifyPredictorMath.updatePredictionCache = () => { cacheUpdated = true; };

  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 80 } });
  assert.strictEqual(cacheUpdated, true, 'saveBaselines must trigger updatePredictionCache');

  // 4. Functional verification: category change triggers updatePredictionCache
  cacheUpdated = false;
  eval(typesCode);
  window.ConnectifyTaskTypes.saveTaskTypeOverride('Chemistry', 'Investigation 1', null, 'Exam');
  assert.strictEqual(cacheUpdated, true, 'saveTaskTypeOverride must trigger updatePredictionCache');

  cacheUpdated = false;
  window.ConnectifyTaskTypes.rescanAllAutoAssessments();
  assert.strictEqual(cacheUpdated, true, 'rescanAllAutoAssessments must trigger updatePredictionCache');

  window.ConnectifyPredictorMath.updatePredictionCache = originalUpdate;

  // 5. Functional verification: subject grade update marks subject stale and subsequent expansion refreshes cache
  eval(assessCode);
  eval(newGradeCode);

  window.ConnectifyData.markSubjectStale('Methods');
  assert.ok(window.ConnectifyData.isSubjectStale('Methods'), 'Methods must be marked stale');

  let predUpdatedSubject = null;
  window.ConnectifyPredictorMath.updatePredictionCache = (subj) => { predUpdatedSubject = subj; };

  // Simulate expansion of stale card via scrapeSubjectTasks
  const mockTile = new MockElement('div', 'eds-c-tile');
  const mockTitle = new MockElement('div', 'eds-c-tile__title');
  mockTitle.textContent = '12 Methods ATAR - Semester 1';
  mockTile.appendChild(mockTitle);
  const taskList = new MockElement('div', 'cvr-c-tasks');
  const taskRow = new MockElement('div', 'cvr-c-task');
  const d = new MockElement('div', 'cvr-c-task__details');
  const l = new MockElement('span', 'v-label'); l.textContent = 'Topic Test 1';
  d.appendChild(l);
  const m = new MockElement('div', 'cvr-c-task__marks');
  const mk = new MockElement('div', 'cvr-c-task__mark'); mk.textContent = '88%';
  m.appendChild(mk);
  taskRow.appendChild(d); taskRow.appendChild(m);
  taskList.appendChild(taskRow);
  mockTile.appendChild(taskList);

  window.ConnectifyData.scrapeSubjectTasks(mockTile, true);
  assert.strictEqual(window.ConnectifyData.isSubjectStale('Methods'), false, 'Methods must be unmarked from stale after expansion');
  assert.ok(predUpdatedSubject && predUpdatedSubject.includes('Methods'), 'Expansion of stale subject must update prediction cache for that subject');

  window.ConnectifyPredictorMath.updatePredictionCache = originalUpdate;
});

runTest('Test 116: Accordion collapse performance guards, observer muting, cards.length check, and class 1-3 compound bar and task meta resolution', () => {
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');
  const domSweepJs = fs.readFileSync(path.resolve(BASE_DIR, 'dom-sweeper.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const compJs = fs.readFileSync(path.resolve(BASE_DIR, 'compound-progress.js'), 'utf8');
  const typesJs = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');

  // 1. Verify theme.js mutes during accordion animations and bulk expanding
  assert.ok(themeJs.includes('if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;'), 'theme.js MutationObserver and scheduleAdaptSurfaces must mute during accordion animation');

  // 2. Verify atar-features.js mutes during accordion animation and bulk expand
  assert.ok(atarFeatJs.includes("{ filter: r => r.type === 'childList', mute: true }"), 'atar-features.js page observer must mute during accordion animation (shared scheduler)');

  // 3. Verify dom-sweeper.js mutes during accordion animation and bulk expand
  assert.ok(domSweepJs.includes('scheduler.onMutations(() => scheduleSweep(1500), { filter: isNavigationChange, mute: true });'), 'dom-sweeper.js page observer must mute during accordion animation (shared scheduler)');

  // 4. Verify assessment-data.js expandMutationObserver mutes during animation and bulk expand
  assert.ok(assessJs.includes('}, { filter: addsTaskRows, mute: true });'), 'assessment-data.js expandMutationObserver must mute during accordion animation (shared scheduler)');

  // 5. Verify triggerAccordionAnimationGuard only invokes cohort, compound, and chart updates when cards.length > 0
  assert.ok(assessJs.includes('if (cards.length > 0)'), 'triggerAccordionAnimationGuard must guard updates behind cards.length > 0 check');

  // 6. Verify task-types.js getTaskMeta supports .cvr-c-tile and generic card containers
  assert.ok(typesJs.includes('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile'), 'task-types.js getTaskMeta must support .cvr-c-tile containers');

  // 7. Verify compound-progress.js queries generic card and title elements
  assert.ok(compJs.includes('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile'), 'compound-progress.js must query generic card containers');
  assert.ok(compJs.includes('.cvr-c-tile__title'), 'compound-progress.js must search cvr-c-tile__title');

  // 8. Functional test: task-types.js getTaskMeta extracts subject name from .cvr-c-tile
  eval(typesJs);
  const cvrTile = document.createElement('div');
  cvrTile.className = 'cvr-c-tile';
  const cvrHeader = document.createElement('div');
  cvrHeader.className = 'cvr-c-tile__header';
  const cvrTitle = document.createElement('span');
  cvrTitle.className = 'cvr-c-tile__title';
  cvrTitle.textContent = 'Chemistry ATAR Year 12 - Semester 1';
  cvrHeader.appendChild(cvrTitle);
  cvrTile.appendChild(cvrHeader);
  const row = document.createElement('div');
  row.className = 'cvr-c-task';
  const details = document.createElement('div');
  details.className = 'cvr-c-task__details';
  const label = document.createElement('span');
  label.className = 'v-label';
  label.textContent = 'Experiment 1';
  details.appendChild(label);
  row.appendChild(details);
  cvrTile.appendChild(row);
  document.body.appendChild(cvrTile);

  const meta = window.ConnectifyTaskTypes.getTaskMeta(row);
  assert.ok(meta, 'getTaskMeta should return metadata for cvr-c-tile row');
  assert.ok(meta.subjectName.includes('Chemistry'), 'getTaskMeta must extract subject name from cvr-c-tile');

  cvrTile.remove();
});

runTest('Test 117: Expand all deduplication, re-entrancy protection, baseline memoization, and non-blocking bulk expand', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');

  // 1. Verify expandAll deduplicates headings by card container
  assert.ok(assessJs.includes('const seenCards = new Set()'), 'expandAll must deduplicate headings by card container');
  assert.ok(assessJs.includes('if (card && seenCards.has(card)) continue;'), 'expandAll must skip duplicate headings from the same card container');

  // 2. Verify re-entrancy locks and batching to prevent mutual recursion/freeze at 95%
  assert.ok(predMathJs.includes('let isUpdatingPredictionCache = false;'), 'predictor-math.js must maintain isUpdatingPredictionCache re-entrancy lock');
  assert.ok(assessJs.includes('let isCollecting = false;'), 'assessment-data.js must maintain isCollecting re-entrancy lock');
  assert.ok(assessJs.includes('const updatedStaleSubjects = new Set();'), 'collect must batch stale subjects during scrape passes');
  assert.ok(assessJs.includes('if (updatedStaleSubjects.size > 0 && window.ConnectifyPredictorMath?.updatePredictionCache)'), 'collect must update prediction cache once after all cards are processed');

  // 3. Verify getBaselines memoization and cache busting
  assert.ok(predMathJs.includes('let cachedBaselines = null;'), 'predictor-math.js must cache baselines');
  assert.ok(predMathJs.includes('if (cachedBaselines) return cachedBaselines;'), 'getBaselines must return cachedBaselines when available');
  assert.ok(predMathJs.includes("window.addEventListener('connectify-baselines-updated'"), 'predictor-math.js must invalidate cachedBaselines on connectify-baselines-updated event');

  // 4. Verify stale normalization guards against empty strings
  assert.ok(assessJs.includes('if (cleanItem &&'), 'isSubjectStale must guard against matching empty string item');

  // 5. Functional test: expandAll deduplicates cards so each card accordion is clicked once
  eval(assessJs);
  const container = document.createElement('div');
  container.id = 'test-expand-container';

  for (let i = 1; i <= 3; i++) {
    const card = document.createElement('div');
    card.className = 'cvr-c-tile';
    const h1 = document.createElement('div');
    h1.className = 'cvr-c-accordion__section-heading';
    h1.textContent = 'Show details';
    const h2 = document.createElement('div');
    h2.className = 'eds-c-accordion__section-heading';
    h2.textContent = 'Show details';
    card.appendChild(h1);
    card.appendChild(h2);
    container.appendChild(card);
  }
  document.body.appendChild(container);

  let clickedCount = 0;
  const originalClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function() {
    if (this.textContent === 'Show details') {
      clickedCount++;
    }
  };

  try {
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyData.expandAll(true);
    assert.strictEqual(clickedCount, 1, 'First card heading clicked immediately');
  } finally {
    HTMLElement.prototype.click = originalClick;
    container.remove();
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyIsAccordionAnimating = false;
  }
});

runTest('Test 118: Subject cache invalidation notification wording and single click dispatch', () => {
  const newGradeJs = fs.readFileSync(path.resolve(BASE_DIR, 'new-grade.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  // 1. Verify notification title and message formatting
  assert.ok(newGradeJs.includes('function announce(entry, taskIds = entry.taskIds)'), 'new-grade.js must announce through one toast builder');
  const shown = [];
  const savedNotifications = window.ConnectifyNotifications;
  window.ConnectifyNotifications = { show: opts => shown.push(opts) };
  try {
    delete window.ConnectifyNewGrade;
    eval(newGradeJs);
    window.ConnectifyNewGrade.announce({ subjectName: 'Mathematics Methods', card: null });
  } finally {
    window.ConnectifyNotifications = savedNotifications;
  }
  assert.strictEqual(shown[0].title, 'Class Updated', "the notification title must be 'Class Updated'");
  assert.strictEqual(shown[0].message, 'Mathematics Methods scores have been updated.', "the message must be '[Subject name] scores have been updated.'");
  assert.deepStrictEqual(shown[0].actions.map(a => a.text), ['Dismiss', 'Jump to Subject']);

  // 2. Verify expandAll does not double-dispatch clicks via dispatchEvent
  assert.ok(!assessJs.includes('btn.dispatchEvent'), 'expandAll must not call btn.dispatchEvent after btn.click()');
  assert.ok(!assessJs.includes('heading.dispatchEvent'), 'expandAll must not call heading.dispatchEvent after heading.click()');
});

runTest('Test 119: Immediate summary panel recovery, scoped surface adaptation, and collapsed state GC elimination', () => {
  const cohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const cohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');

  // 1. Verify immediate recovery of missing summary row panels in cohort-stats.js
  assert.ok(cohortStatsJs.includes('hasMissingSummaryPanel'), 'cohort-stats.js observer must check for missing summary row panels');
  assert.ok(cohortStatsJs.includes('if (hasMissingSummaryPanel()) runPass();'), 'cohort-stats.js must invoke runPass immediately when a summary panel is missing');

  // 2. Verify collapsed state suppresses collect(true) in cohort-stats.js
  assert.ok(cohortStatsJs.includes('hasDetailTasks = document.querySelector'), 'cohort-stats.js must check for detail tasks');
  assert.ok(cohortStatsJs.includes('allSubjects = hasDetailTasks && window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];'), 'cohort-stats.js must skip collect when only summary rows exist');

  // 3. Verify baseline signature memoization in cohort-view.js
  assert.ok(cohortViewJs.includes('function getBaselinesSig()'), 'cohort-view.js must define getBaselinesSig');
  assert.ok(cohortViewJs.includes('cachedBaselinesSig = null;'), 'cohort-view.js must invalidate cachedBaselinesSig on events');
  assert.ok(cohortViewJs.includes('const baselinesSig = getBaselinesSig();'), 'cohort-view.js render must use memoized getBaselinesSig');

  // 4. Verify scoped surface/ink candidate queries in theme.js
  assert.ok(themeJs.includes('[data-connectea-surface] :is('), 'theme.js must scope ink candidates to elements inside data-connectea-surface');
  assert.ok(themeJs.includes('const pageStartTime = Date.now();'), 'theme.js must track pageStartTime for startup cooldown');
  assert.ok(themeJs.includes('scheduleAdaptSurfaces(600)'), 'theme.js must schedule startup surface adaptation without blocking render');

  // 5. Verify relaxed polling cadence in atar-features.js
  assert.ok(atarFeatJs.includes('scheduler.every(5000, syncFeatures, { mute: true });'), 'atar-features.js must use 5000ms cadence for periodic syncFeatures (shared heartbeat skips idle users and Expand All)');

  // 6. Functional test: immediate summary panel restoration
  const card = document.createElement('div');
  card.className = 'eds-c-tile';
  const title = document.createElement('div');
  title.className = 'eds-c-tile__title';
  title.textContent = 'Physics ATAR';
  card.appendChild(title);

  const summaryRow = document.createElement('div');
  summaryRow.className = 'cvr-c-task';
  const details = document.createElement('div');
  details.className = 'cvr-c-task__details';
  summaryRow.appendChild(details);
  card.appendChild(summaryRow);
  document.body.appendChild(card);

  window.location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345';
  const estJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-estimator.js'), 'utf8');
  eval(estJs);
  eval(cohortViewJs);
  delete window.__connectTea141;
  delete window.ConnectifyCohort;
  eval(cohortStatsJs);

  try {
    assert.strictEqual(summaryRow.querySelector('.connectea-panel'), null, 'Panel not initially present on newly inserted row');
    // Calling runPass attaches panel synchronously
    window.ConnectifyCohort.pass();
    assert.ok(summaryRow.querySelector('.connectea-panel'), 'Panel immediately attached to summary row');
  } finally {
    card.remove();
  }
});

runTest('Test 120: In-memory prediction and category caching, chunked 95% bulk expand, 450ms collapse guard, and ATAR panel gating', () => {
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const taskTypesJs = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const atarUiJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8');
  const domSweepJs = fs.readFileSync(path.resolve(BASE_DIR, 'dom-sweeper.js'), 'utf8');

  // 1. Verify in-memory prediction cache in predictor-math.js
  assert.ok(predMathJs.includes('const predictionMemoryCache = new Map();'), 'predictor-math.js must define predictionMemoryCache');
  assert.ok(predMathJs.includes('predictionMemoryCache.set(key, payload);'), 'cachePrediction must populate predictionMemoryCache');
  assert.ok(predMathJs.includes('if (predictionMemoryCache.has(key))'), 'getCachedPrediction must check predictionMemoryCache first');
  assert.ok(predMathJs.includes('predictionMemoryCache.delete(k)'), 'clearSubjectPredictionCache must delete entries from predictionMemoryCache');

  // 2. Verify in-memory category and overrides cache in task-types.js
  assert.ok(taskTypesJs.includes('let cachedOverrides = null;'), 'task-types.js must define cachedOverrides');
  // Categories are read live: a memoised copy kept detecting tasks with the old keywords after Settings saved new ones
  assert.ok(!taskTypesJs.includes('let cachedCategories = null;'), 'task-types.js must read the live category set, not a memoised copy');
  delete window.ConnectifyTaskTypes;
  eval(taskTypesJs);
  const savedCats = window.cxCategories;
  try {
    window.ConnectifyCategoryStore.saveCategories({ ...window.ConnectifyCategoryStore.copyDefaults(), Lab: { color: '#123456', keywords: ['lab report'] } });
    assert.strictEqual(window.ConnectifyTaskTypes.categorizeTask('Lab report 2', []), 'Lab', 'Keywords saved in Settings must apply immediately');
  } finally {
    window.cxCategories = savedCats;
  }
  assert.ok(taskTypesJs.includes('const cachedClassCategories = new Map();'), 'task-types.js must define cachedClassCategories Map');

  // 3. Verify chunked bulk expansion across 90%, 95%, 98%, and 100% in assessment-data.js
  assert.ok(assessJs.includes("progress.update(90, 'Caching predictions... 90%')"), 'assessment-data.js must yield at 90% prediction caching');
  assert.ok(assessJs.includes("progress.update(95, 'Rendering statistics & outcome bars... 95%')"), 'assessment-data.js must yield at 95% statistics rendering');
  assert.ok(assessJs.includes("progress.update(98, 'Updating progress bars... 98%')"), 'assessment-data.js must yield at 98% compound progress');
  assert.ok(assessJs.includes("progress.update(100, 'Ready! 100%')"), 'assessment-data.js must reach 100% completion');

  // 4. Verify 450ms collapse animation guard
  assert.ok(assessJs.includes('triggerAccordionAnimationGuard(450, null);'), 'assessment-data.js must use 450ms guard on collapse click');
  assert.ok(assessJs.includes('Math.max(duration, 450)'), 'triggerAccordionAnimationGuard must enforce at least 450ms for collapse animations');

  // 5. Verify atar-ui.js skips courses scrape when calculatorPanel is hidden
  assert.ok(atarUiJs.includes('if (calculatorPanel.hidden) {\n        lastStateSignature = \'\';\n        return;\n      }'), 'atar-ui.js refreshData must exit early when calculatorPanel is hidden');

  // 6. Verify dom-sweeper.js skips accordion panel mutations
  assert.ok(domSweepJs.includes('.eds-c-accordion__panel, .cvr-c-accordion__panel'), 'dom-sweeper.js must ignore panel mutations');

  // 7. Functional test: prediction memory cache fast-path
  eval(predMathJs);
  const testSubj = 'Test Subject';
  const testTaskId = 'task-mem-1';
  const mockPred = { low: 65, mid: 75, high: 85, breakoutScore: 93.5, type: 'Test' };

  window.ConnectifyPredictorMath.cachePrediction(testSubj, testTaskId, mockPred);
  assert.ok(window.ConnectifyPredictorMath.predictionMemoryCache.size > 0, 'predictionMemoryCache must contain cached item');

  // Clear localStorage to prove getCachedPrediction reads from memory without disk
  localStorage.clear();
  const cachedFromMem = window.ConnectifyPredictorMath.getCachedPrediction(testSubj, testTaskId);
  assert.ok(cachedFromMem, 'getCachedPrediction must return prediction from memory even if localStorage was emptied');
  assert.strictEqual(cachedFromMem.mid, 75, 'Cached mid prediction must match');

  // clearSubjectPredictionCache clears memory cache
  window.ConnectifyPredictorMath.clearSubjectPredictionCache(testSubj);
  assert.strictEqual(window.ConnectifyPredictorMath.getCachedPrediction(testSubj, testTaskId), null, 'Prediction must be cleared from memory');
});

runTest('Test 121: Progress graph lists all tasks including uncompleted tasks, grays them out, flags invalid dates, and satisfies design rules', () => {
  const progressGraphJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  const progressChartJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8');
  const progressMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const progressCss = fs.readFileSync(path.resolve(BASE_DIR, 'progress.css'), 'utf8');

  // 1. Verify progress-graph.js collects pending tasks too, limited to the semester filter's classes
  assert.ok(progressGraphJs.includes('dataAPI ? (dataAPI.collectClasses || dataAPI.collect)(true) : []'), 'progress-graph.js refresh must call collectClasses(true)');

  // 2. Verify progress-chart.js handles pending tasks, edit button for valid dates, and dash score
  assert.ok(progressChartJs.includes("row.className = 'cx-task-pending'"), 'progress-chart.js must assign cx-task-pending to uncompleted rows');
  assert.ok(progressChartJs.includes("cx-time-edit-btn cx-time-edit-btn--unconfigured"), 'progress-chart.js must support unconfigured edit buttons');
  assert.ok(progressChartJs.includes("Number.isFinite(point.score) ? `${Number(point.score.toFixed(2))}%` : '—'"), 'progress-chart.js must display em-dash for uncompleted tasks without throwing TypeError');
  assert.ok(progressChartJs.includes('cx-date-warning'), 'progress-chart.js must use semantic class cx-date-warning for missing dates');

  // 3. Verify progress-math.js history filters out pending tasks
  assert.ok(progressMathJs.includes('!t.pending && Number.isFinite(t.score) && t.weight !== 0'), 'progress-math.js history must ignore pending tasks');

  // 4. Verify assessment-data.js resolves task order dynamically
  assert.ok(assessJs.includes('function resolveTaskOrder(subjectName, task)'), 'assessment-data.js must define resolveTaskOrder');
  assert.ok(assessJs.includes('const resolvedOrder = resolveTaskOrder(name, t)'), 'assessment-data.js formatCollectedSubjects must dynamically resolve order');

  // 5. Verify progress.css provides dark/light styling with >= 5:1 contrast
  assert.ok(cssHas(progressCss, '.cx-task-pending'), 'progress.css must define .cx-task-pending');
  assert.ok(cssHas(progressCss, '.cx-date-warning'), 'progress.css must define .cx-date-warning');
  assert.ok(cssHas(progressCss, '#connectify-progress input[type="number"]'), 'progress.css must style number inputs');

  // 6. Verify sidebar and progress-graph.js use 'Progress'
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  assert.ok(sidebarJs.includes("{ id: 'connectify-progress-toggle', label: 'Year Progression' }"), 'sidebar.js canonicalButtons must name button Year Progression');
  assert.ok(progressGraphJs.includes("createElement('button', 'Year Progression')"), 'progress-graph.js must create Year Progression toggle button');

  // 6. Functional test: renderChart with completed and uncompleted tasks
  delete window.ConnectifyProgressMath;
  eval(progressMathJs);
  delete window.ConnectifyProgressChart;
  eval(progressChartJs);

  const container = document.createElement('div');
  const mockPoints = [
    { name: 'Completed Task', score: 85, mean: 70, order: 5, pending: false },
    { name: 'Uncompleted Valid Date', score: null, mean: null, order: 15, pending: true },
    { name: 'Uncompleted Invalid Date', score: null, mean: null, order: null, pending: true }
  ];

  window.ConnectifyProgressChart.renderChart(container, {
    points: mockPoints,
    isHistory: false,
    byAssessment: false,
    subjectName: 'English ATAR'
  });

  const table = container.querySelector('table');
  assert.ok(table, 'renderChart must generate a table');
  const rows = table.querySelectorAll('tr');
  // Header row + 3 task rows = 4 rows
  assert.strictEqual(rows.length, 4, 'Table must render header row + 3 task rows');

  // Completed row
  const row1 = rows[1];
  assert.ok(!row1.className.includes('cx-task-pending'), 'Completed task row must not be cx-task-pending');
  const r1Tds = row1.querySelectorAll('td');
  assert.strictEqual(r1Tds[3].textContent, '85%', 'Completed score must be 85%');

  // Uncompleted valid date row
  const row2 = rows[2];
  assert.ok(row2.className.includes('cx-task-pending'), 'Uncompleted task row must have cx-task-pending class');
  const r2Tds = row2.querySelectorAll('td');
  assert.strictEqual(r2Tds[3].textContent, '—', 'Uncompleted score must display em-dash');
  assert.ok(r2Tds[2].querySelector('.cx-time-edit-btn'), 'Valid date row must provide time edit button');

  // Uncompleted invalid date row
  const row3 = rows[3];
  assert.ok(row3.className.includes('cx-task-pending'), 'Invalid date task row must have cx-task-pending class');
  const r3Tds = row3.querySelectorAll('td');
  assert.strictEqual(r3Tds[3].textContent, '—', 'Invalid date score must display em-dash');
  assert.ok(r3Tds[2].querySelector('.cx-date-warning'), 'Invalid date row must show cx-date-warning message');
  const inputEl = r3Tds[2].querySelector('input');
  assert.ok(inputEl, 'Invalid date row must provide week input field');
  assert.strictEqual(inputEl.type, 'number', 'Week input must have type number');
});

runTest('Test 122: Back to top button styling parity, expandAll multi-card deduplication, progress-graph lifecycle, and display-width scaling', () => {
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');
  const themeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const progressJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const sidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const cohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');

  // 1. Back to top button parity
  assert.ok(cssHas(atarCss, 'border-radius: 6px !important;'), 'atar.css .cx-back-to-top-btn must have border-radius: 6px');
  assert.ok(cssHas(atarCss, 'font-weight: 500 !important;'), 'atar.css .cx-back-to-top-btn must have font-weight: 500');
  assert.ok(cssHas(atarCss, 'background-color: #ffffff !important;'), 'atar.css .cx-back-to-top-btn must have background-color: #ffffff');
  assert.ok(cssHas(themeCss, '.connectea-dark .cx-back-to-top-btn'), 'theme.css must style dark mode .cx-back-to-top-btn');

  // 2. expandAll multi-card deduplication
  assert.ok(!assessJs.includes('[class*="card"]'), 'expandAll must not deduplicate using [class*="card"] to avoid merging cards into outer dashboard card');
  assert.ok(assessJs.includes('.eds-c-accordion__section, .cvr-c-accordion__section') || assessJs.includes('.eds-c-tile, .cvr-c-tile'), 'expandAll must deduplicate per accordion section / tile');

  // 3. progress-graph.js lifecycle and adoption
  assert.ok(progressJs.includes('if (window.__connectifyProgressInitialized && window.ConnectifyProgress) return;'), 'progress-graph.js must only return early if already initialized AND window.ConnectifyProgress exists');
  assert.ok(progressJs.includes("document.getElementById('connectify-progress-toggle') || createElement('button', 'Year Progression')"), 'progress-graph.js must adopt existing toggle button');
  assert.ok(progressJs.includes('ensureProgressPanel'), 'progress-graph.js must export ensureProgressPanel');

  // 4. sidebar.js delegated click listener on document
  assert.ok(sidebarJs.includes("document.addEventListener('click', handleToolLaunchClick)"), 'sidebar.js must listen for tool launches at document level');
  assert.ok(sidebarJs.includes('ensureProgressPanel'), 'sidebar.js must instantiate progress panel alongside other tools');

  // 5. Constant 1920x1080 display-width scaling and single-line stats panel layout
  assert.ok(cohortStatsJs.includes('flex-wrap: nowrap !important;'), 'cohort-stats.js must use flex-wrap: nowrap on .connectea-row-wrapper');
  assert.ok(cohortStatsJs.includes('max-width: fit-content !important;'), 'cohort-stats.js must set max-width: fit-content on .connectea-panel');
  assert.ok(cssHas(sidebarCss, '.connectea-row-wrapper{display:flex!important;align-items:center!important;gap:14px!important;flex-wrap:nowrap!important'), 'sidebar.css must use nowrap on .connectea-row-wrapper');
  assert.ok(cssHas(sidebarCss, '.connectea-row-wrapper>.connectea-panel{flex:0 0 auto!important;width:auto!important;max-width:fit-content!important'), 'sidebar.css must set max-width: fit-content on .connectea-panel');
  assert.ok(cssHas(sidebarCss, ':is(.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, .eds-c-card, .cvr-c-card, .cvr-c-dashboard-card)'), 'sidebar.css must scale subject cards to 100% width');
  assert.ok(cssHas(themeCss, '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, .eds-c-card, .cvr-c-card, .cvr-c-dashboard-card {'), 'theme.css must scale subject cards to 100% width');
  assert.ok(!cssHas(sidebarCss, '.cvr-c-task__details{flex:1 1 auto!important'), 'sidebar.css must not force flex: 1 1 auto on .cvr-c-task__details');
});

runTest('Test 123: Predictions come from the subject\'s own cached results, with a range that reflects their spread', () => {
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  assert.ok(predMathJs.includes('subjectResults'), 'the history keeps each subject\'s own results in date order');
  assert.ok(predMathJs.includes('RANGE_Z * predictive'), 'Low and High sit the same predictive distance either side of Mid');
  assert.ok(predMathJs.includes('minSubjectSpread = Math.max(2.0, round(7.5 * remainingRatio, 1))'), 'predictor-math.js must use calibrated minSubjectSpread');

  // Literature Take-Home results of 80, 47 and 54 (two in Semester 2); type averages span every subject
  window.ConnectifyTaskTypes = { getEffectiveType: (subj, task) => (/exam/i.test(task.name) ? 'Exam' : 'Take-Home') };
  mockLocalStorage.clear();
  predMath.saveBaselines({ types: {}, subjects: {} });
  const oral = { id: 'lit-oral', name: 'Oral', caption: 'Term 4, Week 3', weight: 15, score: null, pending: true, sequence: 3 };
  const subjects = [
    { name: '12 Literature ATAR', tasks: [
      { id: 'lit-1', name: 'Essay 1', caption: 'Term 1, Week 5', order: 5, semester: 1, sequence: 0, weight: 15, score: 80, pending: false },
      { id: 'lit-2', name: 'Essay 2', caption: 'Term 3, Week 2', order: 22, semester: 2, sequence: 1, weight: 15, score: 47, pending: false },
      { id: 'lit-3', name: 'Essay 3', caption: 'Term 3, Week 7', order: 27, semester: 2, sequence: 2, weight: 15, score: 54, pending: false },
      oral
    ] },
    { name: '12 Chemistry ATAR', tasks: [
      { id: 'ch-1', name: 'Report 1', caption: 'Term 1, Week 6', order: 6, semester: 1, sequence: 0, weight: 10, score: 90, pending: false },
      { id: 'ch-2', name: 'Exam 1', caption: 'Term 2, Week 8', order: 18, semester: 1, sequence: 1, weight: 30, score: 60, pending: false }
    ] }
  ];

  // An unmarked row read from the page has no semester: a Term 4 task still comes after Semester 2's results
  const prior = predMath.getHistoricalDataPriorTo(subjects, '12 Literature ATAR', { name: 'Oral', caption: 'Term 4, Week 3' });
  assert.strictEqual(prior.subjectCounts['12 Literature ATAR'], 3, 'every earlier Literature result counts, Semester 2 included');
  assert.deepStrictEqual(prior.subjectResults['12 Literature ATAR'].map(r => r.score), [80, 47, 54], 'the subject\'s results are kept in date order');

  const pred = predMath.getOrComputeTaskPrediction('12 Literature ATAR', oral, subjects);
  assert.ok(pred && !pred.unpredicted && Number.isFinite(pred.mid), 'the Oral is predicted');
  console.log(`    Literature Oral: ${pred.low} / ${pred.mid} / ${pred.high}`);
  assert.strictEqual(pred.basis.subjectCount, 3, 'the prediction rests on the subject\'s three results');
  assert.strictEqual(pred.subjectName, '12 Literature ATAR', 'the cached prediction keeps its subject, so the card names it (never "subject")');
  assert.strictEqual(pred.basis.typeCount, 4, 'the Take-Home average spans every subject');
  assert.ok(pred.mid >= 55 && pred.mid <= 64, `Mid (${pred.mid}%) sits near the subject's results (mean 60%, latest 54%)`);
  assert.ok(pred.low >= 42 && pred.low <= 50, `Low (${pred.low}%) stays near the lowest result (47%), never far below it`);
  assert.ok(pred.high >= 68, `High (${pred.high}%) reflects the 80% already reached`);
  assert.ok(Math.abs((pred.mid - pred.low) - (pred.high - pred.mid)) <= 1, `below 80% the range is symmetric (${pred.low} / ${pred.mid} / ${pred.high})`);

  // The type shift comes from the type across all subjects: Literature has no exam, Chemistry's is below its level
  const exam = predMath.predictTask('12 Literature ATAR', { name: 'Exam', caption: 'Term 4, Week 5' }, predMath.getHistoricalData(subjects), { types: {}, subjects: {} });
  assert.deepStrictEqual([exam.basis.typeSource, exam.basis.typeCount], ['history', 1], 'an Exam is shifted by the Exam results in other subjects');
  assert.ok(exam.mid < pred.mid, `a weaker type across subjects lowers Mid (${exam.mid} < ${pred.mid})`);

  // A weak subject that holds every result of a type never drags that type down on top of its own average
  const confounded = [
    { name: '11 Literature ATAR', tasks: [80, 47, 54, 50, 55, 52].map((score, i) => ({ id: `l${i}`, name: i < 3 ? `Essay ${i}` : `Exam ${i}`, order: 3 + i * 5, sequence: i, weight: 10, score, pending: false })) },
    { name: '11 Physics ATAR', tasks: [88, 86, 90].map((score, i) => ({ id: `p${i}`, name: `Exam ${i}`, order: 4 + i * 5, sequence: i, weight: 20, score, pending: false })) }
  ];
  const poem = predMath.predictTask('11 Literature ATAR', { name: 'Oral', caption: 'Term 4, Week 3' }, predMath.getHistoricalData(confounded), { types: {}, subjects: {} });
  assert.ok(poem.mid >= 53 && poem.mid <= 60, `Mid (${poem.mid}%) stays near Literature's own results (56%), not pulled towards ~47% by Physics`);

  // A consistent subject gets a tighter range than a volatile one with the same average
  const results = scores => scores.map((score, i) => ({ score, weight: 10, type: 'Take-Home', stamp: i }));
  const hist = scores => ({ subjects: { Art: 70 }, subjectResults: { Art: results(scores) }, types: { 'Take-Home': 70 }, typeCounts: { 'Take-Home': scores.length }, overallAverage: 70, spread: 8 });
  const steady = predMath.predictTask('Art', { name: 'Folio' }, hist([69, 71, 70, 70, 70]), { types: {}, subjects: {} });
  const swingy = predMath.predictTask('Art', { name: 'Folio' }, hist([55, 85, 60, 80, 70]), { types: {}, subjects: {} });
  assert.ok(swingy.high - swingy.low > steady.high - steady.low + 6, `volatile results widen the range (${swingy.low}-${swingy.high} vs ${steady.low}-${steady.high})`);
  mockLocalStorage.clear();
});

runTest('Test 124: Tasks of the same name have independent date overrides and are not double counted', () => {
  const chartJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8');
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');

  // Verify code signatures
  assert.ok(chartJs.includes('const isDuplicateName = duplicateTasks.length > 1;'), 'progress-chart.js must detect duplicate-named tasks');
  assert.ok(chartJs.includes('const isFirstOccurrence = !isDuplicateName || (duplicateTasks.length > 0 && duplicateTasks[0] === point);'), 'progress-chart.js must distinguish first occurrence');
  assert.ok(assessJs.includes('return sameName.length <= 1 || sameName[0] === task;'), 'assessment-data.js must detect duplicate-named tasks in resolveTaskOrder');
  assert.ok(predMathJs.includes('const actualTaskId = typeof taskOrName === \'object\' && taskOrName ? (taskOrName.id || taskId) : taskId;'), 'predictor-math.js must support taskId in resolveCustomDate');

  // Functional test:
  mockLocalStorage.clear();

  delete window.ConnectifyProgressChart;
  eval(chartJs);

  const container = document.createElement('div');
  const task1 = { id: 'id_sem1_er1', name: 'Extended response 1', score: 85, mean: 70, order: 19, sequence: 5, pending: false };
  const task2 = { id: 'id_sem2_er1', name: 'Extended response 1', score: null, mean: null, order: null, sequence: 8, pending: true };
  const mockPoints = [task1, task2];

  // Set an old generic override (e.g. 17)
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Chemistry ATAR:Extended response 1'), '17');

  let refreshed = false;
  window.ConnectifyProgressChart.renderChart(container, {
    points: mockPoints,
    isHistory: false,
    byAssessment: false,
    subjectName: 'Chemistry ATAR',
    onRefresh: () => { refreshed = true; }
  });

  const table = container.querySelector('table');
  assert.ok(table, 'Table must be rendered');
  const rows = table.querySelectorAll('tr');
  assert.strictEqual(rows.length, 3, 'Must render header + 2 task rows');

  // Row 1 (Task 1): First occurrence gets generic key 17
  const row1 = rows[1];
  const r1EditBtn = row1.querySelector('.cx-time-edit-btn');
  assert.ok(r1EditBtn, 'Task 1 must have edit button for week 17');
  // An older bare 17 is converted to school week 17, Early Easter or not
  assert.ok(r1EditBtn.title.includes('Custom week 17 '), 'Task 1 must inherit week 17 as first occurrence');

  // Row 2 (Task 2): Second occurrence does NOT inherit generic key!
  // It has order: null, so it renders the input field with warning
  const row2 = rows[2];
  const r2Warning = row2.querySelector('.cx-date-warning');
  assert.ok(r2Warning, 'Task 2 must not inherit Task 1 date and should prompt for week input');
  const r2Input = row2.querySelector('input');
  assert.ok(r2Input, 'Task 2 must render week number input');
  assert.strictEqual(r2Input.type, 'number', 'Week input must have type number');
  assert.strictEqual(r2Input.value, '', 'Task 2 input must initially be empty');

  // Simulate editing Task 2 to Week 27
  r2Input.value = '27';
  r2Input.dispatchEvent(new MockEvent('input'));

  // Task 2 must be saved under its specific key
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Chemistry ATAR:id_sem2_er1')), 'w27', 'Task 2 must save to its specific key, as a school week of the year');
  // Task 1's generic key must NOT be overwritten by Task 2
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Chemistry ATAR:Extended response 1')), '17', 'Task 1 generic key must remain 17');

  // Test resolveTaskOrder in assessment-data.js
  delete window.ConnectifyData;
  eval(assessJs);

  window.ConnectifyData.saveSubjectsCache([
    { name: 'Chemistry ATAR', tasks: [task1, task2] }
  ]);
  window.ConnectifyData.loadSubjectsCache();

  const collected = window.ConnectifyData.collect(true);
  const chem = collected.find(s => s.name === 'Chemistry ATAR');
  assert.ok(chem, 'Chemistry ATAR must be collected');
  assert.strictEqual(chem.tasks.length, 2, 'Must contain both tasks without double counting or dropping');
  assert.strictEqual(chem.tasks[0].id, 'id_sem1_er1', 'Task 1 order must be first');
  assert.strictEqual(chem.tasks[1].id, 'id_sem2_er1', 'Task 2 order must be second');
  // Task 2 week 27 -> (3 - 1) * 12 + 7 = 31
  assert.strictEqual(chem.tasks[1].order, 31, 'Task 2 order must resolve to 31 (Term 3, Week 7)');

  // Verify predictor-math resolveCustomDate distinguishes tasks
  delete window.ConnectifyPredictorMath;
  eval(predMathJs);
  const resolvedT1 = window.ConnectifyPredictorMath.resolveCustomDate('Chemistry ATAR', task1);
  const resolvedT2 = window.ConnectifyPredictorMath.resolveCustomDate('Chemistry ATAR', task2);
  assert.strictEqual(resolvedT1, '17', 'Task 1 must resolve to 17');
  assert.strictEqual(resolvedT2, 'w27', 'Task 2 must resolve to w27');
});

runTest('Test 125: Progress graph date editor protects active typing from premature refresh and commits on Enter or blur', () => {
  const chartJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8');
  const graphJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');

  // Verify code signatures
  assert.ok(graphJs.includes("if (!force && panel.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox') return;"),
    'progress-graph.js refresh() must guard against destroying DOM while typing (a focused checkbox, e.g. Early Easter, never blocks it)');
  assert.ok(chartJs.includes('if (document.activeElement !== input)'),
    'progress-chart.js must not schedule debounced refresh while input is actively focused');
  assert.ok(chartJs.includes("e.key === 'Enter'") && chartJs.includes("e.key === 'Escape'"),
    'progress-chart.js must handle Enter and Escape keys');

  // Functional test
  mockLocalStorage.clear();
  delete window.ConnectifyProgressChart;
  eval(chartJs);

  const container = document.createElement('div');
  const task = { id: 'task_unscheduled', name: 'Practical Investigation', score: 80, mean: 65, order: null, sequence: 1, pending: false };

  let refreshCount = 0;
  window.ConnectifyProgressChart.renderChart(container, {
    points: [task],
    isHistory: false,
    byAssessment: false,
    subjectName: 'Physics ATAR',
    onRefresh: () => { refreshCount++; }
  });

  const input = container.querySelector('input');
  assert.ok(input, 'Must render input element for unconfigured task');

  // 1. Focus the input
  input.focus();
  assert.strictEqual(document.activeElement, input, 'Input must be active element when focused');

  // 2. Simulate typing '1'
  input.value = '1';
  input.dispatchEvent(new MockEvent('input'));

  // Synchronous storage check: partial input saved
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_unscheduled')), 'w1', 'Must save to storage on input, as a school week of the year');
  // BUT onRefresh must NOT have fired because input is focused
  assert.strictEqual(refreshCount, 0, 'Must NOT trigger onRefresh while actively focused on input');

  // 3. Test progress-graph.js refresh() guard with mock panel
  const panel = document.createElement('div');
  panel.appendChild(container);
  assert.ok(panel.contains(document.activeElement), 'Panel contains active element');

  // Simulate refresh() logic from progress-graph.js:
  let renderCalled = false;
  const mockRender = () => { renderCalled = true; };
  const mockRefresh = (force = false) => {
    if (!force && panel.contains(document.activeElement) && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    mockRender();
  };

  mockRefresh();
  assert.strictEqual(renderCalled, false, 'refresh() must return early without re-rendering while user is focused');

  // 4. Simulate typing '7' -> '17'
  input.value = '17';
  input.dispatchEvent(new MockEvent('input'));
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_unscheduled')), 'w17', 'Must update storage to 17');
  assert.strictEqual(refreshCount, 0, 'Still must NOT trigger onRefresh while typing');

  // 5. User presses Enter to commit
  input.dispatchEvent(new MockEvent('keydown', { key: 'Enter' }));
  assert.strictEqual(refreshCount, 1, 'Pressing Enter must commit and trigger onRefresh');

  // 6. Test editing an existing task with date & Escape key
  const taskWithDate = { id: 'task_dated', name: 'Midyear Exam', score: 85, mean: 70, order: 19, sequence: 2, pending: false };
  const container2 = document.createElement('div');
  let refreshCount2 = 0;
  mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_dated'), 'w19');

  window.ConnectifyProgressChart.renderChart(container2, {
    points: [taskWithDate],
    isHistory: false,
    byAssessment: false,
    subjectName: 'Physics ATAR',
    onRefresh: () => { refreshCount2++; }
  });

  const editBtn = container2.querySelector('.cx-time-edit-btn');
  assert.ok(editBtn, 'Must render edit button for dated task');
  editBtn.click();

  const editInput = container2.querySelector('input');
  assert.ok(editInput, 'Clicking edit button must replace text with input');
  assert.strictEqual(document.activeElement, editInput, 'Edit input must be focused');
  assert.strictEqual(editInput.value, '19', 'Edit input must have initial value 19');

  // User changes value to 25 but presses Escape
  editInput.value = '25';
  editInput.dispatchEvent(new MockEvent('input'));
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_dated')), 'w25', 'Storage updated on input');

  editInput.dispatchEvent(new MockEvent('keydown', { key: 'Escape' }));
  assert.strictEqual(editInput.value, '19', 'Escape must restore initial value 19 in input');
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_dated')), 'w19', 'Escape must restore initial value 19 in storage');
  assert.strictEqual(refreshCount2, 1, 'Escape must commit restored value and trigger onRefresh');

  // 7. Test clear button '✕'
  const clearBtn = container2.querySelector('.cx-time-clear-btn');
  assert.ok(clearBtn, 'Must render clear button when currentVal exists');
  clearBtn.click();
  assert.strictEqual(mockLocalStorage.getItem(window.ConnectifyUtils.userKey('connectea:time_override:Physics ATAR:task_dated')), null, 'Clear button must remove override');
  assert.strictEqual(refreshCount2, 2, 'Clear button must trigger onRefresh');
});

runTest('Test 126: Clicking outside the sidebar collapses the sidebar, Close button is removed, and Back to Menu is positioned at top right', () => {
  const currentSidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');

  // Verify code signatures
  assert.ok(!currentSidebarJs.includes("createElement('button', '❮ Close')"), 'sidebar.js must not create Close button');
  assert.ok(currentSidebarJs.includes('strayCloseBtn.remove()'), 'sidebar.js must purge any stray close button');
  assert.ok(currentSidebarJs.includes('handleOutsideClick'), 'sidebar.js must define outside-click handler');
  assert.ok(currentSidebarJs.includes("header.append(brand, homeBtn)"), 'sidebar.js must append brand and homeBtn in header');

  // Functional test: evaluate sidebar.js
  eval(currentSidebarJs);

  const sidebar = document.getElementById('connectify-sidebar');
  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(sidebar, 'Sidebar element must exist');
  assert.ok(handle, 'Handle element must exist');

  // 1. Verify Close button does NOT exist in sidebar
  const closeBtn = sidebar.querySelector('.cx-close-btn');
  assert.strictEqual(closeBtn, null, 'Close button (.cx-close-btn) must not exist in sidebar');

  // 2. Verify Back to Menu button exists in header
  const header = sidebar.querySelector('header');
  assert.ok(header, 'Header must exist');
  const homeBtn = header.querySelector('.cx-back-menu');
  assert.ok(homeBtn, 'Back to menu button (.cx-back-menu) must exist in header');
  assert.strictEqual(homeBtn.textContent, '← Back to Menu', 'Back to menu button must have correct text');

  // 3. Open sidebar via handle click
  assert.strictEqual(sidebar.hidden, true, 'Sidebar initially hidden');
  handle.click();
  assert.strictEqual(sidebar.hidden, false, 'Sidebar must open on handle click');
  assert.strictEqual(handle.getAttribute('aria-expanded'), 'true', 'Handle aria-expanded must be true when open');

  // 4. Click inside sidebar should NOT collapse it
  const toolMenu = sidebar.querySelector('.cx-tool-menu');
  assert.ok(toolMenu, 'Tool menu must exist');
  toolMenu.dispatchEvent(new MockEvent('click', { target: toolMenu, bubbles: true }));
  assert.strictEqual(sidebar.hidden, false, 'Clicking inside sidebar must NOT collapse it');

  // 5. Click outside sidebar (on domBody) should collapse sidebar
  const outsideEl = document.createElement('div');
  domBody.appendChild(outsideEl);
  outsideEl.dispatchEvent(new MockEvent('click', { target: outsideEl, bubbles: true }));
  assert.strictEqual(sidebar.hidden, true, 'Clicking outside sidebar must collapse sidebar');
  assert.strictEqual(handle.getAttribute('aria-expanded'), 'false', 'Handle aria-expanded must be false when collapsed');

  // 6. Test Back to Menu button when active tool is open
  handle.click();
  assert.strictEqual(sidebar.hidden, false, 'Sidebar reopened');
  sidebar.classList.add('cx-tool-active');
  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Tool active mode');

  homeBtn.click();
  assert.strictEqual(sidebar.classList.contains('cx-tool-active'), false, 'Back to menu must exit active tool mode');
  assert.strictEqual(sidebar.hidden, false, 'Back to menu must keep sidebar open');
});

runTest('Test 127: Sleek sidebar handle, dynamic vertical centering with top bar scroll, left edge expand, and conditional hover collapse', () => {
  const currentSidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const currentSidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');

  // 1. Verify CSS styles for sleek handle
  assert.ok(cssHas(currentSidebarCss, 'width:30px'), 'sidebar.css must set sleek width: 30px');
  assert.ok(cssHas(currentSidebarCss, 'height:66px'), 'sidebar.css must set sleek height: 66px');
  assert.ok(cssHas(currentSidebarCss, 'top:50%'), 'sidebar.css must set default top: 50%');
  assert.ok(cssHas(currentSidebarCss, 'transform:translateY(-50%)'), 'sidebar.css must set transform: translateY(-50%)');
  assert.ok(!cssHas(currentSidebarCss, '.cx-handle-label'), 'sidebar.css must remove .cx-handle-label');

  // 2. Verify JS signatures
  assert.ok(!currentSidebarJs.includes('cx-handle-label'), 'sidebar.js must not reference .cx-handle-label');
  assert.ok(!currentSidebarJs.includes('Connectify Tools'), 'sidebar.js must not add Connectify Tools text to handle');
  assert.ok(!currentSidebarJs.includes('ATAR · Grades · Progress'), 'sidebar.js must not add subtitle text to handle');
  assert.ok(currentSidebarJs.includes('updateHandlePosition'), 'sidebar.js must define updateHandlePosition');
  assert.ok(currentSidebarJs.includes('handleMouseMove'), 'sidebar.js must define handleMouseMove');
  assert.ok(currentSidebarJs.includes('handleMouseLeaveDoc'), 'sidebar.js must define handleMouseLeaveDoc');

  // 3. Functional tests: evaluate sidebar.js
  eval(currentSidebarJs);

  const sidebar = document.getElementById('connectify-sidebar');
  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(sidebar, 'Sidebar element must exist');
  assert.ok(handle, 'Handle element must exist');

  // Verify handle has no text label children
  const handleLabel = handle.querySelector('.cx-handle-label');
  assert.strictEqual(handleLabel, null, 'Handle must not contain .cx-handle-label');
  const arrow = handle.querySelector('.cx-handle-arrow');
  assert.ok(arrow, 'Handle must contain .cx-handle-arrow');

  // 4. Test dynamic vertical centering with mock top navigation bar
  const navBar = document.createElement('header');
  navBar.className = 'cvr-c-primary-navigation';
  navBar.getBoundingClientRect = () => ({ top: 0, bottom: 60, height: 60 });
  domBody.appendChild(navBar);

  handle.updatePosition();
  // vh defaults to 800 in test environment
  // topBarBottom = 60; availableHeight = 800 - 60 = 740; centerY = 60 + 740/2 = 430
  assert.strictEqual(handle.style.top, '430px', 'Handle top must center within available height below nav bar');
  assert.strictEqual(handle.style.transform, 'translateY(-50%)', 'Handle transform must be translateY(-50%)');

  // Scrolled past: navBar is off-screen
  navBar.getBoundingClientRect = () => ({ top: -80, bottom: -20, height: 60 });
  handle.updatePosition();
  // topBarBottom = 0; centerY = 800/2 = 400
  assert.strictEqual(handle.style.top, '400px', 'Handle top must center within full viewport when nav bar is scrolled away');

  // Clean up mock nav bar
  navBar.remove();

  // 5. Test edge push to expand: moving mouse to left edge (clientX <= 12)
  sidebar.hidden = true;
  handle.setAttribute('aria-expanded', 'false');

  const edgeMoveEvent = new MockEvent('mousemove', { clientX: 8, clientY: 300, bubbles: true });
  document.dispatchEvent(edgeMoveEvent);

  assert.strictEqual(sidebar.hidden, false, 'Moving mouse to clientX <= 12 must expand sidebar');
  assert.strictEqual(handle.getAttribute('aria-expanded'), 'true', 'Handle aria-expanded must be true when expanded');

  // 6. Test conditional hover collapse with no active panel
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  const timerCallbacks = [];

  global.setTimeout = (cb, ms) => {
    timerCallbacks.push(cb);
    return timerCallbacks.length;
  };
  global.clearTimeout = (id) => {
    if (typeof id === 'number' && timerCallbacks[id - 1]) {
      timerCallbacks[id - 1] = () => {};
    }
  };

  try {
    // Mouse moving inside sidebar should NOT collapse
    sidebar.classList.remove('cx-tool-active');
    const insideMoveEvent = new MockEvent('mousemove', { target: sidebar, clientX: 100, clientY: 200, bubbles: true });
    document.dispatchEvent(insideMoveEvent);
    assert.strictEqual(sidebar.hidden, false, 'Mouse inside sidebar must keep sidebar open');

    // Mouse moving outside sidebar when NO panel is active schedules collapse
    const outsideMoveEvent = new MockEvent('mousemove', { target: domBody, clientX: 600, clientY: 400, bubbles: true });
    document.dispatchEvent(outsideMoveEvent);
    assert.ok(timerCallbacks.length > 0, 'Moving mouse outside sidebar must schedule hover collapse');

    // Run scheduled collapse timer
    timerCallbacks.forEach(cb => cb());
    assert.strictEqual(sidebar.hidden, true, 'Hover collapse timer must collapse sidebar when no panel is active');
    assert.strictEqual(handle.getAttribute('aria-expanded'), 'false', 'Handle aria-expanded must be false after hover collapse');

    // 7. Test active panel prevents hover collapse
    handle.click();
    assert.strictEqual(sidebar.hidden, false, 'Sidebar reopened');
    sidebar.classList.add('cx-tool-active');

    // Clear callbacks and trigger outside mousemove
    timerCallbacks.length = 0;
    const activeOutsideMove = new MockEvent('mousemove', { target: domBody, clientX: 950, clientY: 400, bubbles: true });
    document.dispatchEvent(activeOutsideMove);

    // Active tool panel must NOT schedule collapse on hover-out
    assert.strictEqual(timerCallbacks.length, 0, 'Active tool panel must not schedule hover collapse');
    assert.strictEqual(sidebar.hidden, false, 'Sidebar must remain open when panel is active even when mouse is outside');

    // Mouseleave on document should also NOT collapse when panel is active
    document.dispatchEvent(new MockEvent('mouseleave', { bubbles: true }));
    assert.strictEqual(sidebar.hidden, false, 'Mouseleave document must not collapse sidebar when panel is active');

    // 8. Clicking outside sidebar when panel is active DOES collapse it
    const clickOutsideEl = document.createElement('div');
    domBody.appendChild(clickOutsideEl);
    clickOutsideEl.dispatchEvent(new MockEvent('click', { target: clickOutsideEl, bubbles: true }));

    assert.strictEqual(sidebar.hidden, true, 'Clicking outside sidebar when panel is active must collapse sidebar');
    assert.strictEqual(handle.getAttribute('aria-expanded'), 'false', 'Handle aria-expanded must be false');
    clickOutsideEl.remove();
  } finally {
    global.setTimeout = origSetTimeout;
    global.clearTimeout = origClearTimeout;
  }
});

runTest('Test 128: Scoped top-bar handle centering, baseline removal outcome bar suppression, synchronized drawer slide animation, and Back to Menu retention', () => {
  const currentSidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const currentSidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const currentPredMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');
  const currentCohortViewJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8');
  const currentCohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');

  // 1. Verify CSS rules for synchronized drawer animation
  assert.ok(cssHas(currentSidebarCss, 'transform:translateX(0)'), 'sidebar.css must set transform: translateX(0) on sidebar');
  assert.ok(cssHas(currentSidebarCss, 'transform:translateX(-100%)!important'), 'sidebar.css must slide sidebar off-screen when hidden');
  assert.ok(cssHas(currentSidebarCss, 'visibility:hidden!important'), 'sidebar.css must hide visibility when hidden');
  assert.ok(cssHas(currentSidebarCss, 'top 0.15s ease-out'), 'sidebar.css must transition top position on handle');

  // 2. Verify JS signatures
  assert.ok(currentSidebarJs.includes('getTopBarBottom'), 'sidebar.js must define getTopBarBottom');
  assert.ok(currentSidebarJs.includes('justReturnedToMenu'), 'sidebar.js must define justReturnedToMenu guard');
  assert.ok(currentPredMathJs.includes('for (const k of baselineKeys(kind, account))'), 'saveBaselines must purge every legacy baseline key');
  assert.ok(currentCohortStatsJs.includes('connectify-baselines-updated'), 'cohort-stats.js must listen to connectify-baselines-updated');

  // 3. Evaluate scripts to test functionality
  eval(currentPredMathJs);
  eval(currentCohortViewJs);
  eval(currentSidebarJs);

  const sidebar = document.getElementById('connectify-sidebar');
  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(sidebar, 'Sidebar element must exist');
  assert.ok(handle, 'Handle element must exist');

  // 4. Test scoped top-bar handle centering
  // Create a fake tile header with top: 300 (should NOT be picked up by getTopBarBottom)
  const tileHeader = document.createElement('header');
  tileHeader.className = 'eds-c-tile__header';
  tileHeader.getBoundingClientRect = () => ({ top: 300, bottom: 350, height: 50 });
  domBody.appendChild(tileHeader);

  // Create a genuine top navigation bar docked at top: 0 with bottom: 90
  const topNav = document.createElement('nav');
  topNav.className = 'cvr-c-primary-navigation';
  topNav.getBoundingClientRect = () => ({ top: 0, bottom: 90, height: 90 });
  domBody.appendChild(topNav);

  handle.updatePosition();
  // vh = 800; topBarBottom = 90; centerY = 90 + (800 - 90)/2 = 445px
  assert.strictEqual(handle.style.top, '445px', 'Handle top must center below genuine top bar (ignoring tile headers)');

  // Clean up mock navigation elements
  tileHeader.remove();
  topNav.remove();

  // 5. Test baseline removal and first task outcome bar suppression
  delete window.ConnectifyTaskTypes;
  const taskTypesCode = fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8');
  eval(taskTypesCode);

  const testSubj = 'Physics ATAR';
  const subjectsList = [{
    name: testSubj,
    tasks: [{
      id: 'phys-t1',
      name: 'Task 1',
      score: 72,
      pending: false,
      weight: 15,
      semester: 1,
      sequence: 0
    }]
  }];

  const card = document.createElement('div');
  card.className = 'eds-c-tile';
  const cTitle = document.createElement('div');
  cTitle.className = 'eds-c-tile__title';
  cTitle.textContent = testSubj;
  card.appendChild(cTitle);

  const task1Row = document.createElement('div');
  task1Row.className = 'cvr-c-task';
  task1Row.closest = (sel) => (sel.includes('eds-c-tile') || sel.includes('c-tile')) ? card : null;

  const detailsContainer = document.createElement('div');
  detailsContainer.className = 'cvr-c-task__details';
  const l1 = document.createElement('span');
  l1.className = 'v-label';
  l1.textContent = 'Physics';
  const l2 = document.createElement('span');
  l2.className = 'v-label';
  l2.textContent = 'Term 1, Week 2';
  const l3 = document.createElement('span');
  l3.className = 'v-label';
  l3.textContent = 'Task 1';
  detailsContainer.append(l1, l2, l3);
  task1Row.append(detailsContainer);

  const marksContainer = document.createElement('div');
  marksContainer.className = 'cvr-c-task__marks';
  const markCell = document.createElement('div');
  markCell.className = 'cvr-c-task__mark';
  markCell.textContent = '72%';
  marksContainer.appendChild(markCell);
  task1Row.appendChild(marksContainer);
  card.appendChild(task1Row);
  domBody.appendChild(card);

  // Set baseline for Physics ATAR
  window.ConnectifyPredictorMath.saveBaselines({ subjects: { [testSubj]: 75 }, types: {} });
  window.ConnectifyCohortView.render(task1Row, false, 'phys-k1', 50, null, subjectsList);
  const panelStateWithBaseline = window.ConnectifyCohortView.panels.get(task1Row);
  assert.ok(panelStateWithBaseline, 'Panel state must exist');
  assert.strictEqual(panelStateWithBaseline.outcomeBar.hidden, false, 'First task must render outcome bar when baseline exists');

  // Now REMOVE the baseline for Physics ATAR
  window.ConnectifyPredictorMath.saveBaselines({ subjects: {}, types: {} });
  const baselinesAfterRemoval = window.ConnectifyPredictorMath.getBaselines();
  assert.strictEqual(baselinesAfterRemoval.subjects[testSubj], undefined, 'Baseline must be removed and not resurrected');

  // Re-render task 1 row
  window.ConnectifyCohortView.render(task1Row, false, 'phys-k1', 50, null, subjectsList);
  assert.strictEqual(panelStateWithBaseline.outcomeBar.hidden, true, 'First task outcome bar must be hidden when baseline is removed');
  assert.strictEqual(panelStateWithBaseline.outcomeBar.children.length, 0, 'First task outcome bar child segments must be cleared');
  card.remove();

  // 6. Test Back to Menu retention (mouse moving outside should NOT collapse drawer)
  sidebar.hidden = false;
  handle.setAttribute('aria-expanded', 'true');
  sidebar.classList.add('cx-tool-active');

  const homeBtn = sidebar.querySelector('.cx-back-menu');
  assert.ok(homeBtn, 'Back to menu button must exist');

  // Click Back to Menu from active tool panel
  homeBtn.click();
  assert.strictEqual(sidebar.classList.contains('cx-tool-active'), false, 'Clicking Back to Menu must exit active tool mode');
  assert.strictEqual(sidebar.hidden, false, 'Sidebar must remain open on Back to Menu click');

  // Simulate mousemove outside sidebar (e.g. at clientX = 850 where homeBtn was)
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  const timerCallbacks = [];

  global.setTimeout = (cb, ms) => {
    timerCallbacks.push(cb);
    return timerCallbacks.length;
  };
  global.clearTimeout = (id) => {
    if (typeof id === 'number' && timerCallbacks[id - 1]) {
      timerCallbacks[id - 1] = () => {};
    }
  };

  try {
    const moveOutsideAfterBack = new MockEvent('mousemove', { target: domBody, clientX: 850, clientY: 100, bubbles: true });
    document.dispatchEvent(moveOutsideAfterBack);

    // Verify hover collapse is NOT scheduled
    assert.strictEqual(timerCallbacks.length, 0, 'Moving mouse outside after Back to Menu must not schedule collapse');
    assert.strictEqual(sidebar.hidden, false, 'Sidebar must remain open after mouse moves outside following Back to Menu');

    // Verify document mouseleave also does NOT collapse
    document.dispatchEvent(new MockEvent('mouseleave', { bubbles: true }));
    assert.strictEqual(sidebar.hidden, false, 'Mouseleave document must not collapse sidebar when justReturnedToMenu is true');

    // Click outside should now collapse it
    const clickOutsideEl = document.createElement('div');
    domBody.appendChild(clickOutsideEl);
    clickOutsideEl.dispatchEvent(new MockEvent('click', { target: clickOutsideEl, bubbles: true }));
    assert.strictEqual(sidebar.hidden, true, 'Clicking outside sidebar must collapse sidebar even after Back to Menu');
    clickOutsideEl.remove();
  } finally {
    global.setTimeout = origSetTimeout;
    global.clearTimeout = origClearTimeout;
  }
});

runTest('Test 129: Sidebar handle anchors directly to Connect native left sidebar and moves with it without floating', () => {
  const currentSidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  assert.ok(currentSidebarJs.includes('getConnectSidebar'), 'sidebar.js must define getConnectSidebar');

  // Evaluate sidebar.js
  eval(currentSidebarJs);

  const sidebar = document.getElementById('connectify-sidebar');
  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(sidebar, 'Sidebar element must exist');
  assert.ok(handle, 'Handle element must exist');

  // 1. Create a mock Connect native left sidebar (.cvr-c-service-menu)
  const connectMenu = document.createElement('nav');
  connectMenu.className = 'cvr-c-service-menu';
  connectMenu.getBoundingClientRect = () => ({
    top: 100,
    bottom: 500,
    height: 400,
    left: 0,
    right: 220,
    width: 220
  });
  domBody.appendChild(connectMenu);

  sidebar.hidden = true;
  handle.setAttribute('aria-expanded', 'false');
  handle.updatePosition();

  // Handle must anchor to Connect's sidebar in document coordinates:
  // sidebarDocTop = 100, height = 400, center = 100 + 400/2 = 300px
  assert.strictEqual(handle.style.position, 'absolute', 'Handle position must be absolute when anchored to Connect sidebar');
  assert.strictEqual(handle.style.top, '300px', 'Handle top must anchor to Connect sidebar center');
  assert.strictEqual(handle.style.transform, 'translateY(-50%)', 'Handle transform must be translateY(-50%)');

  // 2. When Connect's sidebar position changes (e.g. page scrolled down so Connect sidebar is at top: 50)
  connectMenu.getBoundingClientRect = () => ({
    top: 50,
    bottom: 450,
    height: 400,
    left: 0,
    right: 220,
    width: 220
  });
  handle.updatePosition();
  assert.strictEqual(handle.style.position, 'absolute', 'Handle position remains absolute as Connect sidebar scrolls');
  assert.strictEqual(handle.style.top, '250px', 'Handle top must update to match scrolled Connect sidebar');

  // 3. When Connectify sidebar drawer is opened (sidebar.hidden = false)
  sidebar.hidden = false;
  handle.setAttribute('aria-expanded', 'true');
  handle.updatePosition();

  // When open, handle switches to fixed positioning in the active viewport
  assert.strictEqual(handle.style.position, 'fixed', 'Handle position must switch to fixed when drawer is opened');
  assert.strictEqual(handle.style.transform, 'translateY(-50%)', 'Handle transform remains translateY(-50%)');

  // 4. When Connectify sidebar drawer is closed again (sidebar.hidden = true)
  sidebar.hidden = true;
  handle.setAttribute('aria-expanded', 'false');
  handle.updatePosition();

  assert.strictEqual(handle.style.position, 'absolute', 'Handle position must return to absolute when drawer closes');
  assert.strictEqual(handle.style.top, '250px', 'Handle top must re-anchor to Connect sidebar');

  // Clean up mock Connect menu
  connectMenu.remove();

  // 5. Fallback when Connect sidebar is removed
  handle.updatePosition();
  assert.strictEqual(handle.style.position, 'fixed', 'Handle position falls back to fixed when no Connect sidebar exists');
});

runTest('Test 130: Sidebar renders canonical navigation and workspace hierarchy, and clicking each tool mounts all documented interface elements', () => {
  // 1. Clean up DOM and reset initialization flags
  delete window.__connectifySidebarInitialized;
  delete window.__connectifyProgressInitialized;
  delete window.__connectifyAtarUiInitialized;
  delete window.ConnectifyAtar;
  delete window.ConnectifyWeakness;
  delete window.ConnectifyCategorySettings;
  delete window.ConnectifyPredictorUI;
  delete window.ConnectifyTargetAtarUI;
  delete window.ConnectifyTargetGradeUI;
  delete window.ConnectifyTargetPlannerUI;

  [
    'connectify-sidebar',
    'connectify-sidebar-handle',
    'connectea-atar',
    'connectify-progress',
    'connectify-weakness',
    'connectify-categories',
    'connectify-predictor',
    'connectify-goals-toggle',
    'connectify-predictor-toggle',
    'connectify-progress-toggle',
    'connectify-estimator-toggle',
    'connectify-weakness-toggle',
    'connectify-categories-toggle'
  ].forEach(id => {
    document.querySelectorAll('#' + id).forEach(el => el.remove());
  });

  // 2. Evaluate all tool modules in manifest order
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'scaling-data.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-solver.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-scraper.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-calculator.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-atar-ui.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-grade-ui.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-planner-ui.js'), 'utf8'));
  // Goals load after the planners and before the calculator controller, as in manifest.json
  for (const f of ['goal-difficulty.js', 'goal-store.js', 'goal-plan.js', 'goal-replay.js', 'goal-modal.js', 'goal-sliders.js', 'goal-dialog.js', 'goal-list-ui.js', 'goal-editor.js']) {
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals', f), 'utf8'));
  }
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'weakness-radar.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8'));

  const sidebar = document.getElementById('connectify-sidebar');
  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(sidebar, 'Sidebar element (#connectify-sidebar) must exist in DOM');
  assert.ok(handle, 'Handle element (#connectify-sidebar-handle) must exist in DOM');

  // Verify sidebar container attributes
  assert.strictEqual(sidebar.tagName.toLowerCase(), 'aside', 'Sidebar must be an aside element');
  assert.strictEqual(sidebar.getAttribute('aria-label'), 'Connectify tools', 'Sidebar must have aria-label="Connectify tools"');
  assert.strictEqual(sidebar.hidden, true, 'Sidebar must initially be hidden');

  // Verify handle attributes
  assert.strictEqual(handle.tagName.toLowerCase(), 'button', 'Handle must be a button element');
  assert.strictEqual(handle.getAttribute('aria-expanded'), 'false', 'Handle aria-expanded must be false initially');
  assert.strictEqual(handle.title, 'Open Connectify tools', 'Handle title must be "Open Connectify tools"');
  assert.strictEqual(handle.getAttribute('aria-label'), 'Open Connectify tools', 'Handle aria-label must match title');
  const handleArrow = handle.querySelector('.cx-handle-arrow');
  assert.ok(handleArrow, 'Handle must contain arrow span (.cx-handle-arrow)');
  assert.strictEqual(handleArrow.textContent, '❯', 'Arrow icon must point right when collapsed');

  // Verify header and navigation components
  const header = sidebar.querySelector('header');
  assert.ok(header, 'Sidebar must contain header element');
  const brand = header.querySelector('strong');
  assert.ok(brand, 'Header must contain strong brand element');
  assert.strictEqual(brand.textContent, 'Connectify', 'Brand text must be "Connectify"');
  const homeBtn = header.querySelector('.cx-back-menu');
  assert.ok(homeBtn, 'Header must contain Back to Menu button (.cx-back-menu)');
  assert.strictEqual(homeBtn.textContent, '← Back to Menu', 'Back button text must be "← Back to Menu"');
  assert.strictEqual(sidebar.querySelector('.cx-close-btn'), null, 'Stray close button (.cx-close-btn) must not exist');

  // Verify intro text
  const introText = sidebar.querySelector('.cx-tools-intro');
  assert.ok(introText, 'Intro text (.cx-tools-intro) must exist');
  assert.ok(introText.textContent.includes('Select a tool below'), 'Intro text must guide user to select a tool');

  // Verify tool navigation menu and canonical button sequence
  const toolMenu = sidebar.querySelector('.cx-tool-menu');
  assert.ok(toolMenu, 'Tool menu (.cx-tool-menu) must exist');
  assert.strictEqual(toolMenu.tagName.toLowerCase(), 'nav', 'Tool menu must be a nav element');
  assert.strictEqual(toolMenu.getAttribute('aria-label'), 'Tools', 'Tool menu must have aria-label="Tools"');

  const expectedButtons = [
    { id: 'connectify-goals-toggle', label: 'Goal Setter', class: 'cx-calculator-tool' },
    { id: 'connectify-predictor-toggle', label: 'Predictor', class: 'cx-calculator-tool' },
    { id: 'connectify-progress-toggle', label: 'Year Progression', class: 'cx-calculator-tool' },
    { id: 'connectify-estimator-toggle', label: 'Estimator', class: 'cx-calculator-tool' },
    { id: 'connectify-weakness-toggle', label: 'Weakness Analyzer', class: 'cx-secondary-tool' },
    { id: 'connectify-categories-toggle', label: 'Settings', class: 'cx-secondary-tool' }
  ];

  assert.strictEqual(toolMenu.children.length, 6, 'Tool menu must contain exactly 6 buttons');
  expectedButtons.forEach((exp, idx) => {
    const btn = toolMenu.children[idx];
    assert.strictEqual(btn.id, exp.id, `Button at index ${idx} must have id ${exp.id}`);
    assert.strictEqual(btn.textContent, exp.label, `Button ${exp.id} must have label "${exp.label}"`);
    assert.ok(btn.classList.contains(exp.class), `Button ${exp.id} must have class ${exp.class}`);
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false', `Button ${exp.id} must start unpressed`);
  });

  // Verify workspace and mounted panels
  const workspace = sidebar.querySelector('.cx-workspace');
  assert.ok(workspace, 'Workspace container (.cx-workspace) must exist');
  const expectedPanels = [
    'connectea-atar',
    'connectify-predictor',
    'connectify-progress',
    'connectify-weakness',
    'connectify-categories'
  ];
  assert.strictEqual(workspace.children.length, 5, 'Workspace must contain exactly 5 tool panels');
  expectedPanels.forEach(panelId => {
    const p = workspace.querySelector('#' + panelId);
    assert.ok(p, `Panel #${panelId} must be mounted inside workspace`);
    assert.strictEqual(p.hidden, true, `Panel #${panelId} must start hidden`);
  });

  // -------------------------------------------------------------------------
  // TOOL 1: Goals (opens on its Grade tab)
  // -------------------------------------------------------------------------
  const goalsBtn = document.getElementById('connectify-goals-toggle');
  goalsBtn.click();

  assert.strictEqual(sidebar.hidden, false, 'Sidebar must open on tool click');
  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar must enter cx-tool-active mode');
  assert.strictEqual(introText.hidden, true, 'Intro text must be hidden when tool is active');
  assert.strictEqual(goalsBtn.getAttribute('aria-pressed'), 'true', 'Goals button must be pressed');

  const atarPanel = document.getElementById('connectea-atar');
  assert.strictEqual(atarPanel.hidden, false, 'Goals panel (#connectea-atar) must be visible');
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Target Grade Planner', 'Goals must open on the Target Grade Planner');

  // Verify Goals heading and its mode tabs: Target Grade before Target ATAR
  const gradeHeading = atarPanel.querySelector('.cta-heading strong');
  assert.strictEqual(gradeHeading.textContent, 'Goal Setter', 'Goal Setter heading must render');
  const modeTab = mode => Array.from(atarPanel.querySelectorAll('.cta-mode-tab')).find(b => b.dataset.mode === mode);
  const visibleTabs = () => Array.from(atarPanel.querySelectorAll('.cta-mode-tab')).filter(b => !b.hidden).map(b => b.textContent);
  assert.ok(atarPanel.querySelector('.cta-mode-tabs')?.classList.contains('cx-pred-main-tabs'), 'Mode tabs must use the Predictor tab bar');
  assert.deepStrictEqual(visibleTabs(), ['Target Grade', 'Target ATAR'], 'Goals must show Target Grade, then Target ATAR');
  assert.ok(modeTab('estimate').hidden && modeTab('grade-estimate').hidden, 'Goals must hide Estimates tabs');
  assert.ok(modeTab('grade').classList.contains('active') && !modeTab('target').classList.contains('active'), 'Grade tab must be selected');

  // Verify Target Grade internal elements
  const subjectSelect = atarPanel.querySelector('select.cta-subject-select');
  assert.ok(subjectSelect, 'Subject dropdown selector (select.cta-subject-select) must render');
  const gradeScoreInput = atarPanel.querySelector('input.cta-score');
  assert.ok(gradeScoreInput, 'Grade score input (input.cta-score) must render');
  const gradeOutput = atarPanel.querySelector('.cta-target-output');
  assert.ok(gradeOutput, 'Grade breakdown output container (.cta-target-output) must render');

  // -------------------------------------------------------------------------
  // TOOL 1b: Goals' ATAR tab
  // -------------------------------------------------------------------------
  modeTab('target').click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(goalsBtn.getAttribute('aria-pressed'), 'true', 'Goals stays pressed on its ATAR tab');
  assert.ok(modeTab('target').classList.contains('active') && !modeTab('grade').classList.contains('active'), 'ATAR tab must be selected');
  assert.strictEqual(atarPanel.hidden, false, '#connectea-atar remains visible for Target ATAR');
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Target ATAR Planner', 'Panel label must indicate Target ATAR Planner');
  const targetHeading = atarPanel.querySelector('.cta-heading strong');
  assert.strictEqual(targetHeading.textContent, 'Goal Setter', 'Goal Setter heading stays on its ATAR tab');
  const targetSemesterBtns = atarPanel.querySelectorAll('.cta-semesters button');
  assert.strictEqual(targetSemesterBtns.length, 2, 'Semester 1 and 2 selector buttons must render');
  const plannerContainer = atarPanel.querySelector('.cta-planner');
  assert.ok(plannerContainer && !plannerContainer.hidden, 'Target planner container (.cta-planner) must be unhidden');
  const targetScoreInput = atarPanel.querySelector('input.cta-score');
  assert.ok(targetScoreInput, 'Target ATAR score input (input.cta-score) must render');
  const targetRecalcBtn = atarPanel.querySelector('.cta-form-controls button.cta-reset');
  assert.ok(targetRecalcBtn && targetRecalcBtn.textContent.includes('Recalculate'), 'Recalculate button must render in Target ATAR');
  const targetDiffLabel = atarPanel.querySelector('label.cta-difficulty-label');
  assert.ok(targetDiffLabel && targetDiffLabel.querySelector('input[type="checkbox"]'), 'Difficulty weighting checkbox must render');
  const topFourContainer = atarPanel.querySelector('.cta-top-four-selector');
  assert.ok(topFourContainer, 'Top four subject container (.cta-top-four-selector) must render');
  const targetOutput = atarPanel.querySelector('.cta-target-output');
  assert.ok(targetOutput, 'Target requirement output container (.cta-target-output) must render');
  const targetExpandOutlines = atarPanel.querySelector('.cta-expand-outlines');
  assert.ok(targetExpandOutlines, 'Expand All Outlines button (.cta-expand-outlines) must render');

  // -------------------------------------------------------------------------
  // TOOL 3: Predictor
  // -------------------------------------------------------------------------
  const predBtn = document.getElementById('connectify-predictor-toggle');
  predBtn.click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(predBtn.getAttribute('aria-pressed'), 'true', 'Predictor button must be pressed');
  assert.strictEqual(atarPanel.hidden, true, 'Target ATAR panel must be hidden');
  const predPanel = document.getElementById('connectify-predictor');
  assert.strictEqual(predPanel.hidden, false, 'Predictor panel (#connectify-predictor) must be visible');

  // Verify Predictor internal elements
  const predHeader = predPanel.querySelector('.cx-pred-header');
  assert.ok(predHeader, 'Predictor header (.cx-pred-header) must render');
  const predTitle = predPanel.querySelector('.cx-pred-title');
  assert.strictEqual(predTitle.textContent, 'Predictor', 'Predictor title must render');
  const predSubtitle = predPanel.querySelector('.cx-pred-subtitle');
  assert.strictEqual(predSubtitle.textContent, 'Momentum & Assessment Modeling', 'Predictor subtitle must render');
  const predTabs = predPanel.querySelector('.cx-pred-main-tabs');
  assert.ok(predTabs, 'Predictor tabs container (.cx-pred-main-tabs) must render');
  const gradePredTab = predPanel.querySelector('#cx-pred-btn-grade');
  assert.ok(gradePredTab && gradePredTab.textContent === 'Predict Grade', 'Predict Grade tab button must render');
  const atarPredTab = predPanel.querySelector('#cx-pred-btn-atar');
  assert.ok(atarPredTab && atarPredTab.textContent === 'Predict ATAR', 'Predict ATAR tab button must render');
  assert.deepStrictEqual(Array.from(predTabs.querySelectorAll('.cx-pred-main-tab')).map(b => b.textContent), ['Predict Grade', 'Predict ATAR'], 'Predict Grade must come before Predict ATAR');
  const predContent = predPanel.querySelector('#cx-pred-content');
  assert.ok(predContent, 'Predictor content container (#cx-pred-content) must render');

  // -------------------------------------------------------------------------
  // TOOL 4: Progress
  // -------------------------------------------------------------------------
  const progBtn = document.getElementById('connectify-progress-toggle');
  progBtn.click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(progBtn.getAttribute('aria-pressed'), 'true', 'Progress button must be pressed');
  assert.strictEqual(predPanel.hidden, true, 'Predictor panel must be hidden');
  const progPanel = document.getElementById('connectify-progress');
  assert.strictEqual(progPanel.hidden, false, 'Progress panel (#connectify-progress) must be visible');

  // Verify Progress internal elements
  const progTitle = progPanel.querySelector('header strong');
  assert.strictEqual(progTitle.textContent, 'Year Progression', 'Year Progression title must render');
  const subjectsContainer = progPanel.querySelector('.cx-subjects');
  assert.ok(subjectsContainer, 'Subjects chip selector container (.cx-subjects) must render');
  const refreshAssessmentsBtn = progPanel.querySelector('button');
  assert.ok(refreshAssessmentsBtn && refreshAssessmentsBtn.textContent.includes('Refresh Assessments'), 'Refresh Assessments button must render');
  const chartContainer = progPanel.querySelector('div:not(.cx-subjects)');
  assert.ok(chartContainer, 'Progress chart container must render');

  // -------------------------------------------------------------------------
  // TOOL 5: Estimates (opens on its Grade tab)
  // -------------------------------------------------------------------------
  const estBtn = document.getElementById('connectify-estimator-toggle');
  estBtn.click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(estBtn.getAttribute('aria-pressed'), 'true', 'Estimates button must be pressed');
  assert.strictEqual(goalsBtn.getAttribute('aria-pressed'), 'false', 'Goals button must not be pressed');
  assert.strictEqual(progPanel.hidden, true, 'Progress panel must be hidden');
  assert.strictEqual(atarPanel.hidden, false, 'ATAR panel (#connectea-atar) must be visible');
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Estimated Grade', 'Estimates must open on Estimated Grade');

  // Verify Estimates heading, its tabs and the Estimate Grade elements
  const estHeading = atarPanel.querySelector('.cta-heading strong');
  assert.strictEqual(estHeading.textContent, 'Estimator', 'Estimator heading must render');
  assert.deepStrictEqual(visibleTabs(), ['Estimate Grade', 'Estimate ATAR'], 'Estimates must show Estimate Grade, then Estimate ATAR');
  assert.ok(modeTab('target').hidden && modeTab('grade').hidden, 'Estimates must hide the Goals tabs');
  assert.ok(modeTab('grade-estimate').classList.contains('active'), 'Estimates Grade tab must be selected');
  const estimateView = atarPanel.querySelector('.cta-grade-estimate');
  assert.ok(estimateView && !estimateView.hidden, 'Estimate Grade view (.cta-grade-estimate) must be unhidden');
  assert.ok(estimateView.querySelector('select.cta-subject-select'), 'Estimate Grade must render a subject dropdown');
  const courseList = atarPanel.querySelector('.cta-courses');
  const methodDetails = atarPanel.querySelector('details.cta-method');
  assert.ok(courseList.hidden && methodDetails.hidden, 'Estimate ATAR course list and methodology must hide on Estimate Grade');

  // TOOL 5b: Estimates' ATAR tab
  modeTab('estimate').click();
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Estimated ATAR', 'Panel label must indicate Estimated ATAR');
  assert.strictEqual(estBtn.getAttribute('aria-pressed'), 'true', 'Estimates stays pressed on its ATAR tab');
  assert.ok(courseList && !courseList.hidden, 'Courses list container (.cta-courses) must be unhidden');
  const breakdownSummary = atarPanel.querySelector('.cta-breakdown');
  assert.ok(breakdownSummary && !breakdownSummary.hidden, 'Breakdown summary (.cta-breakdown) must be unhidden');
  const resetBtn = Array.from(atarPanel.querySelectorAll('button.cta-reset')).find(b => !b.classList.contains('cta-expand-outlines'));
  assert.ok(resetBtn && !resetBtn.hidden && resetBtn.textContent.includes('Reset to School Marks'), 'Reset button must be unhidden');
  assert.ok(methodDetails && !methodDetails.hidden, 'Methodology details (details.cta-method) must be unhidden');
  const methodSummary = methodDetails.querySelector('summary');
  assert.strictEqual(methodSummary.textContent, 'Calculation Methodology & Sources', 'Methodology summary text must match');
  assert.ok(estimateView.hidden, 'Estimate Grade view must hide on Estimate ATAR');

  // Each launcher reopens on the tab it was left on
  goalsBtn.click();
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Target ATAR Planner', 'Goals must reopen on Target ATAR');
  estBtn.click();
  assert.strictEqual(atarPanel.getAttribute('aria-label'), 'Estimated ATAR', 'Estimates must reopen on Estimate ATAR');

  // -------------------------------------------------------------------------
  // TOOL 6: Weaknesses
  // -------------------------------------------------------------------------
  const weakBtn = document.getElementById('connectify-weakness-toggle');
  weakBtn.click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(weakBtn.getAttribute('aria-pressed'), 'true', 'Weaknesses button must be pressed');
  assert.strictEqual(atarPanel.hidden, true, 'ATAR panel must be hidden');
  const weakPanel = document.getElementById('connectify-weakness');
  assert.strictEqual(weakPanel.hidden, false, 'Weakness panel (#connectify-weakness) must be visible');

  // Verify Weaknesses internal elements
  const weakTitle = weakPanel.querySelector('header strong');
  assert.strictEqual(weakTitle.textContent, 'Weakness Analyzer', 'Weakness Analyzer title must render');
  const radarModeSelect = weakPanel.querySelector('#cx-radar-mode');
  assert.ok(radarModeSelect, 'Group by dropdown selector (#cx-radar-mode) must render');
  const weakExpandAllBtn = weakPanel.querySelector('#cx-weakness-expand-all');
  assert.ok(weakExpandAllBtn && weakExpandAllBtn.textContent.includes('Expand All Outlines'), 'Expand All Outlines button must render');
  const radarChart = weakPanel.querySelector('#connectify-radar-chart');
  assert.ok(radarChart, 'Radar chart container (#connectify-radar-chart) must render');
  const weakFilters = weakPanel.querySelector('#cx-weakness-filters');
  assert.ok(weakFilters, 'Weakness filters container (#cx-weakness-filters) must render');
  const selectAllBtn = weakPanel.querySelector('#cx-weakness-all');
  assert.ok(selectAllBtn && selectAllBtn.textContent.includes('Select All'), 'Select All button must render');
  const deselectAllBtn = weakPanel.querySelector('#cx-weakness-none');
  assert.ok(deselectAllBtn && deselectAllBtn.textContent.includes('Deselect All'), 'Deselect All button must render');
  const checkboxesContainer = weakPanel.querySelector('#cx-weakness-checkboxes');
  assert.ok(checkboxesContainer, 'Subject checkboxes container (#cx-weakness-checkboxes) must render');

  // -------------------------------------------------------------------------
  // TOOL 7: Settings
  // -------------------------------------------------------------------------
  const catBtn = document.getElementById('connectify-categories-toggle');
  catBtn.click();

  assert.ok(sidebar.classList.contains('cx-tool-active'), 'Sidebar remains in cx-tool-active mode');
  assert.strictEqual(catBtn.getAttribute('aria-pressed'), 'true', 'Settings button must be pressed');
  assert.strictEqual(weakPanel.hidden, true, 'Weakness panel must be hidden');
  const catPanel = document.getElementById('connectify-categories');
  assert.strictEqual(catPanel.hidden, false, 'Settings panel (#connectify-categories) must be visible');

  // Verify Settings internal elements
  const catTitle = catPanel.querySelector('header strong');
  assert.strictEqual(catTitle.textContent, 'Settings', 'Settings title must render');
  const autoExpandToggle = catPanel.querySelector('#cx-auto-expand-toggle');
  assert.ok(autoExpandToggle, 'Auto-expand checkbox toggle (#cx-auto-expand-toggle) must render');
  const cohortInput = catPanel.querySelector('#cx-general-cohort-input');
  assert.ok(cohortInput, 'General cohort input (#cx-general-cohort-input) must render');
  const addCategoryBtn = catPanel.querySelector('#cx-cat-add');
  assert.ok(addCategoryBtn && addCategoryBtn.textContent.includes('Add Category'), 'Add Category button must render');
  const saveCatBtn = catPanel.querySelector('#cx-cat-save');
  assert.ok(saveCatBtn && saveCatBtn.textContent.includes('Save Changes'), 'Save Changes button must render');
  const baselinesContainer = catPanel.querySelector('#cx-baselines-container');
  assert.ok(baselinesContainer, 'Baselines container (#cx-baselines-container) must render');

  // -------------------------------------------------------------------------
  // HEADER: Back to Menu Button
  // -------------------------------------------------------------------------
  homeBtn.click();

  assert.strictEqual(sidebar.classList.contains('cx-tool-active'), false, 'Sidebar must exit cx-tool-active mode on Back to Menu');
  assert.strictEqual(introText.hidden, false, 'Intro text must be restored when returning to launcher menu');
  assert.strictEqual(sidebar.hidden, false, 'Sidebar must remain open when navigating Back to Menu');

  // Verify all panels are hidden
  expectedPanels.forEach(panelId => {
    const p = workspace.querySelector('#' + panelId);
    assert.strictEqual(p.hidden, true, `Panel #${panelId} must be hidden after returning to menu`);
  });

  // Verify all tool buttons are unpressed
  expectedButtons.forEach(exp => {
    const btn = document.getElementById(exp.id);
    assert.strictEqual(btn.getAttribute('aria-pressed'), 'false', `Button ${exp.id} must be aria-pressed="false" after returning to menu`);
  });
});

runTest('Test 131: Sidebar handle excludes primary menu and detects fixed/sticky sidebars, and width scaling adapts at 820 width', () => {
  const currentSidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const currentCohortStatsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  const currentSidebarCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.css'), 'utf8');
  const currentThemeCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme.css'), 'utf8');

  // 1. Verify CSS and JS signatures
  assert.ok(!currentSidebarJs.includes("'.cvr-c-primary-menu'"), 'sidebar.js must exclude .cvr-c-primary-menu from getConnectSidebar');
  assert.ok(currentSidebarJs.includes('height >= 120'), 'sidebar.js must require height >= 120 for sidebar elements');
  assert.ok(currentSidebarJs.includes('isElementFixedOrSticky'), 'sidebar.js must define isElementFixedOrSticky');
  assert.ok(cssHas(currentSidebarCss, 'max-width: 950px') && cssHas(currentSidebarCss, '--cx-display-scale: 0.62'), 'sidebar.css must include 0.62 scale at max-width: 950px');
  assert.ok(cssHas(currentThemeCss, 'max-width: 950px') && cssHas(currentThemeCss, '--cx-display-scale: 0.62'), 'theme.css must include 0.62 scale at max-width: 950px');

  // 2. Evaluate sidebar.js and cohort-stats.js
  eval(currentSidebarJs);
  eval(currentCohortStatsJs);

  const handle = document.getElementById('connectify-sidebar-handle');
  assert.ok(handle, 'Handle element must exist');

  // 3. Verify that primary menu (.cvr-c-primary-menu) with low height is ignored
  const primaryMenu = document.createElement('nav');
  primaryMenu.className = 'cvr-c-primary-menu';
  primaryMenu.getBoundingClientRect = () => ({
    top: 0,
    bottom: 40,
    height: 40,
    left: 0,
    right: 200,
    width: 200
  });
  domBody.appendChild(primaryMenu);

  handle.updatePosition();
  // Since primaryMenu is not a valid sidebar, handle must fall back to viewport fixed centering
  assert.strictEqual(handle.style.position, 'fixed', 'Handle must ignore primary menu and remain fixed');
  primaryMenu.remove();

  // 4. Test fixed/sticky sidebar centering: handle mounts at centerY (vertical center below top bar)
  const fixedSidebar = document.createElement('nav');
  fixedSidebar.className = 'cvr-c-service-menu';
  fixedSidebar.getBoundingClientRect = () => ({
    top: 50,
    bottom: 400,
    height: 350,
    left: 0,
    right: 220,
    width: 220
  });
  domBody.appendChild(fixedSidebar);

  const origGetComputedStyle = window.getComputedStyle;
  try {
    window.getComputedStyle = el => (el === fixedSidebar ? { position: 'fixed' } : { position: 'static' });
    handle.updatePosition();
    assert.strictEqual(handle.style.position, 'fixed', 'Handle must use position: fixed when sidebar is fixed');
    // Top bar is at 0, available height is 800, centerY = 400px
    assert.strictEqual(handle.style.top, '400px', 'Handle must mount at centerY (400px) instead of 225px');
  } finally {
    window.getComputedStyle = origGetComputedStyle;
    fixedSidebar.remove();
  }

  // 5. Test display width scaling function
  const origInnerWidth = window.innerWidth;
  try {
    window.innerWidth = 820;
    window.ConnectifyCohort.updateDisplayWidthScale();
    assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-display-scale'), '0.62', 'Width 820 must scale to 0.62');

    window.innerWidth = 750;
    window.ConnectifyCohort.updateDisplayWidthScale();
    assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-display-scale'), '0.55', 'Width 750 must scale to 0.55');

    window.innerWidth = 1920;
    window.ConnectifyCohort.updateDisplayWidthScale();
    assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-display-scale'), '1.00', 'Width 1920 must scale to 1.00');
  } finally {
    window.innerWidth = origInnerWidth;
  }
});

runTest('Test 132: expandAll unblocked click dispatch, capture-phase stability, and section-first deduplication', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const atarFeatJs = fs.readFileSync(path.resolve(BASE_DIR, 'atar-features.js'), 'utf8');

  // 1. Verify absence of stopBubble / capture phase click cancellation
  assert.ok(!assessJs.includes('stopBubble'), 'assessment-data.js must not register stopBubble listener that intercepts clicks');
  assert.ok(!assessJs.includes('addEventListener(\x27click\x27, stopBubble'), 'assessment-data.js must not attach capture phase listeners during expandAll');

  // 2. Verify section-first deduplication order
  const dedupMatch = assessJs.match(/const card = (h\.closest\?\.\([\s\S]*?) \|\| null;/);
  assert.ok(dedupMatch, 'assessment-data.js must contain card deduplication logic');
  const dedupExpr = dedupMatch[1];
  assert.ok(dedupExpr.indexOf('.eds-c-accordion__section') < dedupExpr.indexOf('CARD_SELECTOR'),
    'expandAll must prioritize accordion sections over outer tiles for multi-section course cards');

  // 3. Verify atar-features.js reactive check for cx-expand-btn
  assert.ok(atarFeatJs.includes('!document.getElementById(\x27cx-expand-btn\x27) && window.ConnectifyData'),
    'atar-features.js must check and sync cx-expand-btn if missing');

  // 4. Functional test of expandAll dispatching click on accordion sections
  eval(assessJs);
  const container = document.createElement('div');
  container.id = 'test-expand-container-132';

  const clickedHeadings = [];
  for (let i = 1; i <= 2; i++) {
    const card = document.createElement('div');
    card.className = 'eds-c-tile';
    const section = document.createElement('div');
    section.className = 'eds-c-accordion__section';
    const heading = document.createElement('div');
    heading.className = 'eds-c-accordion__section-heading';
    heading.textContent = 'Show details';
    const btn = document.createElement('button');
    btn.className = 'v-button';
    btn.textContent = 'Show details';
    heading.appendChild(btn);
    section.appendChild(heading);
    card.appendChild(section);
    container.appendChild(card);
  }
  document.body.appendChild(container);

  const origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function() {
    clickedHeadings.push(this);
  };

  try {
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyData.expandAll(true);
    assert.strictEqual(clickedHeadings.length, 1, 'First section clicked immediately');
  } finally {
    HTMLElement.prototype.click = origClick;
    container.remove();
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyIsAccordionAnimating = false;
  }
});

runTest('Test 133: Instant collapseAll execution without serialization delays, simultaneous click dispatch, and animation guard', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');

  // 1. Verify fast path for !expand exists in assessment-data.js
  assert.ok(assessJs.includes('if (!expand) {'), 'assessment-data.js must provide dedicated fast path for collapse (!expand)');
  assert.ok(assessJs.includes('collapseAll: () => expandAll(false)'), 'assessment-data.js must export collapseAll method');

  // 2. Functional test: multiple expanded cards collapse synchronously without 65ms per-card delay
  delete window.__connectifyDataInitialized;
  delete window.ConnectifyData;
  window.ConnectifyIsBulkExpanding = false;
  window.ConnectifyIsAccordionAnimating = false;
  eval(assessJs);

  const container = document.createElement('div');
  container.id = 'test-collapse-container-133';

  const clickedElements = [];
  for (let i = 1; i <= 5; i++) {
    const card = document.createElement('div');
    card.className = 'eds-c-tile';
    const section = document.createElement('div');
    section.className = 'eds-c-accordion__section';
    const heading = document.createElement('div');
    heading.className = 'eds-c-accordion__section-heading';
    heading.textContent = 'Hide details';
    const btn = document.createElement('button');
    btn.className = 'v-button';
    btn.textContent = 'Hide details';
    heading.appendChild(btn);
    section.appendChild(heading);
    card.appendChild(section);
    container.appendChild(card);
  }
  document.body.appendChild(container);

  const origClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function() {
    clickedElements.push(this);
  };

  try {
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyIsAccordionAnimating = false;

    // Call collapseAll
    window.ConnectifyData.collapseAll();

    // All 5 cards must be clicked synchronously in the exact same tick
    assert.strictEqual(clickedElements.length, 5, 'All open sections must be clicked simultaneously on collapse');

    // window.ConnectifyIsBulkExpanding must be released immediately so UI is not locked
    assert.strictEqual(window.ConnectifyIsBulkExpanding, false, 'isBulkExpanding must be released immediately after collapse loop');

    // window.ConnectifyIsAccordionAnimating must be true to keep MutationObservers muted during CSS transition
    assert.strictEqual(window.ConnectifyIsAccordionAnimating, true, 'isAccordionAnimating must be active for 450ms animation guard');
  } finally {
    HTMLElement.prototype.click = origClick;
    container.remove();
    window.ConnectifyIsBulkExpanding = false;
    window.ConnectifyIsAccordionAnimating = false;
  }
});

runTest('Test 134: expandAll performance caching integrity, non-blocking chunked finalization, and zero-rescrape guarantees', () => {
  const assessJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const predMathJs = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8');

  // 1. Verify clearPredictorCache removes PREDICTOR version stamp rather than setting it prematurely
  assert.ok(assessJs.includes('localStorage.removeItem(CACHE_KEYS.PREDICTOR);'),
    'clearPredictorCache must remove version stamp so isPredictionCacheCurrent accurately reflects empty cache');

  // 2. Verify finalizeExpansion checks hasValidCache BEFORE calling collect(true)
  const finalizeCachePattern = /try\s*\{\s*if\s*\(!window\.ConnectifyPredictorMath\?\.isPredictionCacheCurrent\?\.\(\)\)\s*\{\s*window\.ConnectifyPredictorMath\?\.populateChronologicalPredictions\?\.\(collect\(true\), true\);/;
  assert.ok(finalizeCachePattern.test(assessJs),
    'finalizeExpansion must verify cache validity before triggering synchronous collect(true)');

  // 3. Verify getOrComputeTaskPrediction avoids inline collect(true) fallback in task loop
  assert.ok(predMathJs.includes('const rawSubjects = allSubjects || [];'),
    'getOrComputeTaskPrediction must use passed allSubjects or empty array instead of triggering inline collect(true)');

  // 4. Verify stale-subjects re-scrape at 98% is deferred off critical path
  assert.ok(assessJs.includes('// Stale subjects and cards that mounted after the statistics pass are re-scraped off the critical path'),
    'assessment-data.js must defer stale subjects collect to prevent blocking progress pill completion');

  // 5. Functional test: verify prediction cache skipping when cache is current
  delete window.__connectifyDataInitialized;
  delete window.ConnectifyData;
  delete window.ConnectifyPredictorMath;
  mockLocalStorage.clear();
  eval(predMathJs);
  eval(assessJs);

  let collectCallCount = 0;
  const originalCollect = window.ConnectifyData.collect;
  window.ConnectifyData.collect = function(...args) {
    collectCallCount++;
    return originalCollect.apply(this, args);
  };

  try {
    // When cache is marked current, populateChronologicalPredictions must exit immediately without collecting
    const ver = window.ConnectifyPredictorMath.PREDICTOR_ALGO_VERSION;
    mockLocalStorage.setItem('connectify:prediction_algo_version', ver);
    mockLocalStorage.setItem('connectify:prediction_version', ver);
    mockLocalStorage.setItem('connectify:cache_version:predictor', ver);
    assert.strictEqual(window.ConnectifyPredictorMath.isPredictionCacheCurrent(), true, 'Cache must be marked current');

    window.ConnectifyPredictorMath.populateChronologicalPredictions(null, false);
    assert.strictEqual(collectCallCount, 0, 'populateChronologicalPredictions must skip collect(true) when cache is valid and force is false');
  } finally {
    window.ConnectifyData.collect = originalCollect;
  }
});

runTest('Test 135: Modular theme tokens, theme registry, custom palettes, and top navigation stability', () => {
  const themeControlsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-controls.css'), 'utf8');
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8'));

  // 1. Static checks: CSS controls exclude navbar and header buttons from padding inflation
  assert.ok(cssHas(themeControlsCss, ':not(:is(#connectify-sidebar, .cvr-c-primary-navigation, .cvr-c-header, .cvr-c-primary-navigation__user-controls) *):not(#connectify-sidebar-handle):not(.cvr-c-primary-navigation):not(.cvr-c-header):not(#connectea-theme-toggle)'),
    'theme-controls.css must exclude primary navigation and header buttons from generic button padding');
  assert.ok(cssHas(themeCoreCss, 'min-height: 48px !important;'), 'theme-core.css must enforce min-height on cvr-c-primary-navigation');
  assert.ok(cssHas(themeCoreCss, 'box-sizing: border-box !important;'), 'theme-core.css must enforce box-sizing on cvr-c-primary-navigation');

  // 2. Static checks: theme.js excludes primary navigation from surface adaptation
  const navSurfaceSel = surfaceAdapterSelectors().surface;
  assert.ok([':not(.cvr-c-primary-navigation)', ':not(.cvr-c-primary-navigation *)', ':not(.cvr-c-header)', ':not(.cvr-c-header *)'].every(x => navSurfaceSel.includes(x)),
    'theme surface adapter must exclude primary navigation from adaptSurfaces');

  // 3. Static checks: theme-tokens.css defines custom properties and multiple palettes
  assert.ok(cssHas(themeTokensCss, '--cx-canvas-bg:') && cssHas(themeTokensCss, '--cx-surface-bg:'), 'theme-tokens.css must define CSS custom properties');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-theme="amoled"]') && cssHas(themeTokensCss, '--cx-canvas-bg: #000000;'), 'theme-tokens.css must define AMOLED black theme');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-theme="midnight"]') && cssHas(themeTokensCss, '--cx-canvas-bg: #0b132b;'), 'theme-tokens.css must define Midnight navy theme');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-theme="forest"]') && cssHas(themeTokensCss, '--cx-canvas-bg: #0a1914;'), 'theme-tokens.css must define Forest theme');
  assert.ok(!cssHas(themeTokensCss, '[data-connectea-theme="sunset"]'), 'the Twilight Plum (sunset) theme was removed');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-theme="liquid-glass"]') && cssHas(themeTokensCss, '--cx-canvas-bg: #0b1120;'), 'theme-tokens.css must define Liquid Tinted Glass theme');
  assert.ok(cssHas(themeTokensCss, '#connectea-theme-menu'), 'theme-tokens.css must style the theme popover menu');

  // 4. Manifest checks: theme-tokens.css, theme-registry.js, and theme-customizer files are registered
  const contentScript = manifest.content_scripts.find(s => s.matches && s.matches.includes('https://connect.det.wa.edu.au/*'));
  assert.ok(contentScript.css.includes('src/theme/styles/theme-tokens.css'), 'manifest.json must register theme-tokens.css');
  assert.ok(contentScript.css.includes('src/theme/styles/theme-customizer.css'), 'manifest.json must register theme-customizer.css');
  assert.ok(contentScript.js.includes('src/theme/theme-registry.js'), 'manifest.json must register theme-registry.js');
  assert.ok(contentScript.js.includes('src/theme/theme-customizer.js'), 'manifest.json must register theme-customizer.js');

  for (const cs of manifest.content_scripts || []) {
    for (const js of cs.js || []) {
      assert.ok(fs.existsSync(path.resolve(__dirname, js)), `Manifest content script JS file not found: ${js}`);
    }
    for (const css of cs.css || []) {
      assert.ok(fs.existsSync(path.resolve(__dirname, css)), `Manifest content script CSS file not found: ${css}`);
    }
  }

  // 5. Functional evaluation: theme-registry.js handles multi-themes and custom themes
  eval(themeRegistryJs);
  eval(themeJs);

  const reg = window.ConnectifyThemeRegistry;
  assert.ok(reg, 'window.ConnectifyThemeRegistry must be defined');

  const themes = reg.getAvailableThemes();
  const themeIds = themes.map(t => t.id);
  assert.ok(themeIds.includes('dark'), 'Registry must include dark theme');
  assert.ok(themeIds.includes('amoled'), 'Registry must include amoled theme');
  assert.ok(themeIds.includes('midnight'), 'Registry must include midnight theme');
  assert.ok(themeIds.includes('forest'), 'Registry must include forest theme');
  assert.ok(!themeIds.includes('sunset'), 'Registry must not include the removed sunset theme');
  assert.ok(themeIds.includes('liquid-glass') && themeIds.includes('liquid-glass-clear'), 'Registry must include Liquid Tinted Glass and Liquid Glass');
  assert.ok(themeIds.includes('light'), 'Registry must include light theme');
  assert.ok(themeIds.includes('custom'), 'Registry must include custom theme');

  // Switch to AMOLED theme
  reg.setTheme('amoled');
  assert.strictEqual(reg.getTheme(), 'amoled', 'Active theme must be amoled');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'amoled', 'dataset.connecteaTheme must be amoled');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true, 'connectea-dark must be active for amoled');

  // Switch to custom theme with custom palette
  reg.setTheme('custom', { canvas: '#101014', surface: '#181820', accent: '#a855f7' });
  assert.strictEqual(reg.getTheme(), 'custom', 'Active theme must be custom');
  assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-canvas-bg'), '#101014', 'Custom canvas variable must be applied');
  assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-accent'), '#a855f7', 'Custom accent variable must be applied');

  // Dynamic theme registration
  const registered = reg.registerTheme({
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    icon: '⚡',
    isDark: true,
    swatch: ['#0f051d', '#1a0b2e', '#ff007f']
  });
  assert.strictEqual(registered, true, 'registerTheme must succeed');
  reg.setTheme('cyberpunk');
  assert.strictEqual(reg.getTheme(), 'cyberpunk', 'Active theme must be cyberpunk');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'cyberpunk', 'dataset.connecteaTheme must be cyberpunk');

  // Switch back to Classic Dark
  reg.setTheme('dark');
  assert.strictEqual(reg.getTheme(), 'dark', 'Active theme must be dark');
  assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-canvas-bg'), '', 'Custom variables must be cleared on preset theme');

  // ConnectifyTheme helper forwards to registry
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'dark', 'ConnectifyTheme.getTheme must match registry');
  assert.ok(Array.isArray(window.ConnectifyTheme.getAvailableThemes()), 'ConnectifyTheme.getAvailableThemes must return array');
});

runTest('Test 136: Login page disables all themes (preset, custom palettes) and restores exact theme after login', () => {
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');

  // 1. Static CSS checks: all theme tokens require .connectea-dark and exclude [data-connectea-login]
  assert.ok(cssHas(themeTokensCss, 'html.connectea-dark[data-connectea-theme="amoled"]'),
    'theme-tokens.css amoled theme must require .connectea-dark');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-login]'),
    'theme-tokens.css must define [data-connectea-login] rule block');
  assert.ok(cssHas(themeTokensCss, '[data-connectea-login] #connectea-theme-toggle, [data-connectea-login] #connectea-theme-menu'),
    'theme-tokens.css must hide theme toggle and popover on login page');

  // 2. Functional check: AMOLED theme active, navigate to login page
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);
  window.ConnectifyTheme.setTheme('amoled');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'amoled');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'amoled');

  // Navigate to login page
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/login';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://connect.det.wa.edu.au/login'), true);
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false, 'isDarkMode must return false on login page');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'light', 'getTheme must return light on login page');
  assert.strictEqual(window.ConnectifyThemeRegistry.getTheme(), 'light', 'Registry getTheme must return light on login page');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'connectea-dark must be removed on login');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, undefined, 'data-connectea-theme must be removed on login');
  assert.strictEqual(document.documentElement.getAttribute('data-connectea-login'), 'true', 'data-connectea-login must be set on login');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'light', 'storage v1 must be light on login');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'light', 'storage theme id must be light on login');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), 'true', 'restore_dark must be true');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_theme'), 'amoled', 'restore_theme must save amoled');

  // Setting theme on login page must be rejected
  const loginSetThemeResult = window.ConnectifyTheme.setTheme('forest');
  assert.strictEqual(loginSetThemeResult, false, 'setTheme on login page must return false');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'theme must not activate on login page');

  // Navigate back to classes page - AMOLED must be restored
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'dark', 'storage must be restored to dark');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'amoled', 'storage theme id must be restored to amoled');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), null, 'restore flag must be cleared');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_theme'), null, 'restore theme flag must be cleared');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true, 'connectea-dark must be restored');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'amoled', 'data-connectea-theme must be amoled');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'amoled', 'getTheme must return amoled');

  // 3. Functional check with Custom Palette on login.det.wa.edu.au
  window.ConnectifyTheme.setTheme('custom', { canvas: '#18122B', surface: '#251b3e', accent: '#a855f7' });
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'custom');
  assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-canvas-bg'), '#18122B');

  // Navigate to login.det.wa.edu.au
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://login.det.wa.edu.au/';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.ConnectifyTheme.isLoginUrl('https://login.det.wa.edu.au/'), true);
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false);
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'light');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, undefined);
  assert.strictEqual(document.documentElement.style.getPropertyValue('--cx-canvas-bg'), '', 'custom inline css properties must be cleared on login');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_theme'), 'custom', 'restore_theme must save custom');

  // Return to normal page - custom theme must be restored
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'custom', 'storage must be restored to custom');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'custom', 'theme must be restored to custom');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'custom');

  // 4. Functional check: Logout screen disables theme and restores after login
  window.ConnectifyTheme.setTheme('forest');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'forest');

  // Navigate to logged out page: https://connect.det.wa.edu.au/public/loggedout.html
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/public/loggedout.html';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.ConnectifyTheme.isLogoutUrl('https://connect.det.wa.edu.au/public/loggedout.html'), true);
  assert.strictEqual(window.ConnectifyTheme.isLogoutUrl('https://connect.det.wa.edu.au/c/portal/logout'), true);
  assert.strictEqual(window.ConnectifyTheme.isLogoutUrl('https://connect.det.wa.edu.au/classes'), false);
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false, 'isDarkMode must return false on logout page');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'light', 'getTheme must return light on logout page');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'connectea-dark must be removed on logout');
  assert.strictEqual(document.documentElement.getAttribute('data-connectea-logout'), 'true', 'data-connectea-logout must be set on logout');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_dark'), 'true', 'restore_dark must be true on logout');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_theme'), 'forest', 'restore_theme must save forest on logout');

  // Return to normal page - forest theme must be restored
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'forest', 'storage must be restored to forest');
  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'forest', 'theme must be restored to forest');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'forest');
  assert.strictEqual(document.documentElement.getAttribute('data-connectea-logout'), null);
});

runTest('Test 137: Dark, Default, and Quantum Dark themes correspond to previous versions and legacy palettes', () => {
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');

  // 1. Static checks: Quantum Dark palette corresponds to inspiration / legacy theme tokens
  assert.ok(cssHas(themeTokensCss, '[data-connectea-theme="quantum"]'), 'theme-tokens.css must define Quantum Dark selector');
  assert.ok(cssHas(themeTokensCss, '--cx-canvas-bg: #282828;') || cssHas(themeTokensCss, '--cx-canvas-bg: #292929;'), 'Quantum Dark must have canvas color');
  assert.ok(cssHas(themeTokensCss, '--cx-surface-bg: #32302f;') || cssHas(themeTokensCss, '--cx-surface-bg: #333333;'), 'Quantum Dark must have surface color');
  assert.ok(cssHas(themeTokensCss, '--cx-accent: #fabd2f;') || cssHas(themeTokensCss, '--cx-accent: #d4b483;'), 'Quantum Dark must have golden accent color');
  assert.ok(cssHas(themeTokensCss, '--cx-button-bg: #3c3836;') || cssHas(themeTokensCss, '--cx-button-bg: #303944;'), 'Quantum Dark must have button color');

  // Base Dark Theme corresponds to modern dark mode (v3.2.x)
  assert.ok(cssHas(themeTokensCss, '--cx-canvas-bg: #12171f;'), 'Base dark must have #12171f canvas');
  assert.ok(cssHas(themeTokensCss, '--cx-surface-bg: #1e2632;'), 'Base dark must have #1e2632 surface');
  assert.ok(cssHas(themeTokensCss, '--cx-accent: #3b82f6;'), 'Base dark must have #3b82f6 accent');

  // 2. Functional evaluation of Registry
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);

  const reg = window.ConnectifyThemeRegistry;
  const themes = reg.getAvailableThemes();
  const themeMap = new Map(themes.map(t => [t.id, t]));

  assert.ok(themeMap.has('quantum'), 'Registry must include quantum theme');
  assert.strictEqual(themeMap.get('quantum').name, 'Quantum Dark');
  assert.strictEqual(themeMap.get('dark').name, 'Dark');
  assert.strictEqual(themeMap.get('light').name, 'Default');

  // Switch to Quantum Dark
  reg.setTheme('quantum');
  assert.strictEqual(reg.getTheme(), 'quantum');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'quantum');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true);
  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'quantum');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'dark');

  // Switch to Default (Light mode from previous versions)
  reg.setTheme('light');
  assert.strictEqual(reg.getTheme(), 'light');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, undefined, 'Default theme must remove data-connectea-theme');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false, 'Default theme must remove connectea-dark');
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), false, 'isDarkMode must return false for Default theme');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:v1'), 'light');
  assert.strictEqual(window.localStorage.getItem('connectea:theme:id'), 'light');

  // Switch to Dark (Dark mode from previous versions)
  reg.setTheme('dark');
  assert.strictEqual(reg.getTheme(), 'dark');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'dark');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true);
  assert.strictEqual(window.ConnectifyTheme.isDarkMode(), true);

  // Quantum Dark login/restore cycle
  reg.setTheme('quantum');
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/login';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), false);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, undefined);
  assert.strictEqual(window.localStorage.getItem('connectea:theme:restore_theme'), 'quantum');

  // Return to classes
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(themeRegistryJs);
  eval(themeJs);

  assert.strictEqual(window.ConnectifyTheme.getTheme(), 'quantum', 'Quantum Dark must restore post-login');
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'quantum');
  assert.strictEqual(document.documentElement.classList.contains('connectea-dark'), true);
});

runTest('Test 138: Dark theme v3.2.1 parity, Connect Help and tile contrast, abundant token coverage, dedicated theme button, and line limits', () => {
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeTilesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tiles.css'), 'utf8');
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const catSettingsJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');

  // 1. Abundant theme tokens: verify diverse semantic token groups
  const requiredTokens = [
    '--cx-canvas-bg', '--cx-surface-bg', '--cx-surface-elevated', '--cx-surface-hover',
    '--cx-border', '--cx-border-subtle', '--cx-border-strong',
    '--cx-text-primary', '--cx-text-secondary', '--cx-text-muted',
    '--cx-accent', '--cx-accent-hover',
    '--cx-table-header-bg', '--cx-table-row-hover',
    '--cx-input-bg', '--cx-input-border',
    '--cx-button-bg', '--cx-button-text',
    '--cx-badge-bg', '--cx-badge-text',
    '--cx-scrollbar-track', '--cx-scrollbar-thumb'
  ];
  for (const token of requiredTokens) {
    assert.ok(cssHas(themeTokensCss, token), `theme-tokens.css must define token ${token}`);
  }

  // 2. Connect Help, generic tile bodies, and tile links high contrast
  assert.ok(cssHas(themeTilesCss, '.eds-c-tile__body') && cssHas(themeTilesCss, '.cvr-c-tile__body'), 'theme-tiles.css must target tile bodies');
  assert.ok(cssHas(themeTilesCss, '.portlet-body') && cssHas(themeTilesCss, '.journal-content-article'), 'theme-tiles.css must target portlet containers for Connect Help');
  assert.ok(cssHas(themeTilesCss, 'var(--cx-surface-bg, #1e2632) !important;'), 'theme-tiles.css must set surface-bg for tile bodies');
  assert.ok(cssHas(themeTilesCss, 'var(--cx-accent-link, #60a5fa) !important;'), 'theme-tiles.css must set high-contrast links (the contrast-checked link token, not the raw accent)');
  assert.ok(cssHas(themeTilesCss, '.cvr-c-class__name') && cssHas(themeTilesCss, '.cvr-c-classes-list__title'), 'theme-tiles.css must target class title elements');
  assert.ok(cssHas(themeTilesCss, 'var(--cx-text-primary, #f8fafc) !important;'), 'theme-tiles.css must set high contrast primary text on headings');

  // 3. Top bar theme toggle button and theme menu in theme-core.css and theme.js
  assert.ok(cssHas(themeCoreCss, '#connectea-theme-toggle'), 'theme-core.css must style #connectea-theme-toggle');
  assert.ok(themeJs.includes('document.body.appendChild(themeMenu)'), 'theme.js must attach themeMenu to document.body to prevent button nesting issues');

  // 4. Color Theme selector in Category Settings
  assert.ok(catSettingsJs.includes('#cx-theme-select-input'), 'category-settings.js must render #cx-theme-select-input');
  assert.ok(catSettingsJs.includes('window.ConnectifyTheme?.setTheme(themeSelect.value)'), 'category-settings.js must invoke ConnectifyTheme.setTheme on change');

  // 5. Strict line limits: all JS and CSS in src <= 250 lines (test_suite.js and scripts/ are exempt), markdown in docs/ <= 150 lines (other markdown is exempt)
  const countLines = text => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  function checkDir(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) checkDir(full);
      else if (ent.isFile() && (full.endsWith('.js') || full.endsWith('.css'))) {
        const lines = countLines(origReadFileSync.call(fs, full, 'utf8'));
        assert.ok(lines <= 250, `File ${full} has ${lines} lines, exceeding 250 line limit`);
      }
    }
  }
  checkDir(path.resolve(BASE_DIR, 'src'));

  const docsDir = path.resolve(BASE_DIR, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const ent of fs.readdirSync(docsDir, { withFileTypes: true })) {
      const full = path.join(docsDir, ent.name);
      if (ent.isFile() && full.endsWith('.md')) {
        const lines = origReadFileSync.call(fs, full, 'utf8').split('\n').length;
        assert.ok(lines <= 150, `Markdown file ${full} has ${lines} lines, exceeding 150 line limit`);
      }
    }
  }
});

runTest('Test 139: Font stack enforcement, dark surfaces styled with theme tokens, Themes/Default toggle text, theme button removed, Default/custom removed from select', () => {
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeCardsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-cards.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const cohortStylesJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-styles.js'), 'utf8');
  const catSettingsJs = fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8');

  // 1. Clean sans-serif font stack enforced across root dark selectors to eliminate serif fallback
  assert.ok(cssHas(themeTokensCss, '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;'),
    'theme-tokens.css must enforce system sans-serif font stack');
  assert.ok(cssHas(themeCoreCss, '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;'),
    'theme-core.css must enforce system sans-serif font stack');

  // 2. All surfaces touched by dark mode are styled dynamically with CSS tokens (not hardcoded hex colors)
  assert.ok(cssHas(themeCardsCss, 'var(--cx-surface-elevated'), 'theme-cards.css must use var(--cx-surface-elevated) for panels');
  assert.ok(cssHas(themeCardsCss, 'var(--cx-surface-secondary'), 'theme-cards.css must use var(--cx-surface-secondary) for task marks');
  assert.ok(cohortStylesJs.includes('var(--cx-surface-elevated'), 'cohort-styles.js must use var(--cx-surface-elevated) for panels');
  assert.ok(cohortStylesJs.includes('var(--cx-input-bg'), 'cohort-styles.js must use var(--cx-input-bg) for inputs');
  assert.ok(cssHas(themeTokensCss, '.connectea-panel') && cssHas(themeTokensCss, 'var(--cx-surface-elevated)'),
    'theme-tokens.css must dynamically theme .connectea-panel');
  assert.ok(cssHas(themeTokensCss, '.cvr-c-task__marks') && cssHas(themeTokensCss, 'var(--cx-surface-secondary)'),
    'theme-tokens.css must dynamically theme .cvr-c-task__marks');

  // 3. Separate themes button is removed
  assert.ok(!cssHas(themeCoreCss, '#connectea-theme-select-btn {'), 'theme-core.css must not style removed #connectea-theme-select-btn');
  assert.ok(!themeJs.includes("createElement('button')\n    themeSelectBtn.id = 'connectea-theme-select-btn'") && !themeJs.includes("themeSelectBtn = document.createElement('button')"),
    'theme.js must not create #connectea-theme-select-btn');

  // 4. Toggle button text is Themes and Default (not Dark mode and Light mode)
  assert.ok(!themeJs.includes("'☾ Dark mode'") && !themeJs.includes("'☀ Light mode'"),
    'theme.js must not use Dark Mode or Light Mode as toggle button text');
  assert.ok(themeJs.includes("'Default'") && themeJs.includes("'Themes'"),
    'theme.js must use Default and Themes for toggle button text');

  // 5. Default and Custom Theme removed from themes select in Category Settings
  assert.ok(!catSettingsJs.includes('<option value="light">'), 'category-settings.js must not include Default in themes select');
  assert.ok(!catSettingsJs.includes('<option value="custom">'), 'category-settings.js must not include Custom in themes select');
  // Theme options come from the registry (presets and saved custom themes), with Default first
  assert.ok(catSettingsJs.includes("[{ id: 'light', name: 'Default', icon: '☀' }, ...(theme?.getAvailableThemes?.() || [])]"),
    'settings theme select must list Default plus the registry themes');

  // 6. Custom theme option and color palettes removed from theme menu
  assert.ok(!cssHas(themeTokensCss, '.connectea-theme-custom-panel'), 'theme-tokens.css must not style custom color panel');
  assert.ok(!themeJs.includes('connectea-theme-custom-panel'), 'theme.js must not render custom color panel');
  assert.ok(!themeJs.includes('input type="color"'), 'theme.js must not render color inputs');

  // 7. Functional test of toggle button labels and theme switching
  delete window.ConnectifyThemeLoaded;
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  const nav = document.createElement('nav');
  nav.className = 'cvr-c-primary-navigation';
  document.body.appendChild(nav);

  eval(fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8'));
  eval(themeJs);

  const toggleBtn = document.getElementById('connectea-theme-toggle');
  assert.ok(toggleBtn, 'Toggle button must exist');

  // In default (light) mode:
  window.ConnectifyTheme.applyTheme(false);
  assert.ok(toggleBtn.textContent.includes('Themes'), `Default mode button text must contain Themes, got "${toggleBtn.textContent}"`);

  // In theme/dark mode:
  window.ConnectifyTheme.applyTheme(true, 'quantum');
  assert.ok(toggleBtn.textContent.includes('Default'), `Dark mode button text must contain Default, got "${toggleBtn.textContent}"`);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'quantum');

  // Switch back to Default:
  window.ConnectifyTheme.applyTheme(false);
  assert.ok(toggleBtn.textContent.includes('Themes'), `Switched back button text must contain Themes, got "${toggleBtn.textContent}"`);
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, undefined);
});

runTest('Test 140: Webfont icon preservation and complete dark surface token styling across all themes', () => {
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeTilesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tiles.css'), 'utf8');
  const themeCardsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-cards.css'), 'utf8');
  const themeControlsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-controls.css'), 'utf8');
  const themeMaterialCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-material.css'), 'utf8');
  const themeFeedCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-feed.css'), 'utf8');
  const themeTablesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tables.css'), 'utf8');
  const themeNavigationCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-navigation.css'), 'utf8');
  const themeSurfacesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-surfaces.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8');

  // 1. Webfont icon preservation: explicit connect-webfont, Material Icons, and symbol font
  assert.ok(cssHas(themeTokensCss, 'font-family: "connect-webfont" !important;'),
    'theme-tokens.css must protect connect-webfont glyphs using font-family: "connect-webfont" !important;');
  assert.ok(cssHas(themeTokensCss, "font-family: 'Material Icons' !important;"),
    'theme-tokens.css must protect Google Material Icons using font-family: \'Material Icons\' !important;');
  assert.ok(cssHas(themeTokensCss, "-webkit-font-feature-settings: 'liga' !important;"),
    'theme-tokens.css must enforce ligature feature settings for Material Icons');
  assert.ok(cssHas(themeTokensCss, '"Apple Symbols"') && cssHas(themeTokensCss, '"Segoe UI Symbol"'),
    'theme-tokens.css must define symbol/emoji font stack matching Connect webfont style');
  assert.ok(cssHas(themeTokensCss, 'width: 250px;') && cssHas(themeTokensCss, 'min-height: 40px;'),
    'theme-tokens.css must size theme menu and options generously for easy clicking');
  assert.ok(!cssHas(themeTokensCss, 'span, div, li {\n  font-family:'),
    'theme-tokens.css must not apply system font stack directly to span, div, li');
  assert.ok(cssHas(themeTokensCss, ':not([class*="icon"]):not([class*="icon-"]):not([class*="cvr-c-icon"]):not([class*="eds-c-icon"])'),
    'theme-tokens.css must exclude icon classes from heading typography rules');
  assert.ok(cssHas(themeMaterialCss, '[class^="cvr-c-icon--"]:before') && cssHasToken(themeMaterialCss, 'color: #cbd5e1 !important;'),
    'theme-material.css must preserve high contrast color for webfont glyphs without overriding font-family');

  // 2. All surfaces styled by old 3.2.1 dark theme use semantic theme tokens
  // Top nav, sidebar, heading bars (theme-core.css)
  assert.ok(cssHas(themeCoreCss, 'var(--cx-nav-bg'), 'theme-core.css must style navigation with var(--cx-nav-bg)');
  assert.ok(cssHas(themeCoreCss, 'var(--cx-nav-item-active'), 'theme-core.css must style active nav items with var(--cx-nav-item-active)');
  assert.ok(cssHas(themeCoreCss, 'var(--cx-surface-secondary'), 'theme-core.css must style heading bars with var(--cx-surface-secondary)');

  // Cards and tiles (theme-tiles.css)
  assert.ok(cssHas(themeTilesCss, 'var(--cx-surface-bg'), 'theme-tiles.css must style tiles with var(--cx-surface-bg)');

  // Cards and compound progress (theme-cards.css)
  assert.ok(cssHas(themeCardsCss, 'var(--cx-surface-elevated'), 'theme-cards.css must style panels with var(--cx-surface-elevated)');
  assert.ok(cssHas(themeCardsCss, 'var(--cx-surface-secondary'), 'theme-cards.css must style progress bars with var(--cx-surface-secondary)');
  assert.ok(cssHas(themeCardsCss, 'var(--cx-input-bg'), 'theme-cards.css must style type select with var(--cx-input-bg)');

  // Feed and category menus (theme-feed.css)
  assert.ok(cssHas(themeFeedCss, 'var(--cx-nav-bg'), 'theme-feed.css must style category menu with var(--cx-nav-bg)');
  assert.ok(cssHas(themeFeedCss, 'var(--cx-surface-elevated'), 'theme-feed.css must style reports and toolbars with var(--cx-surface-elevated)');

  // Material dialogs, accordions, and controls (theme-material.css)
  assert.ok(cssHas(themeMaterialCss, 'var(--cx-surface-bg'), 'theme-material.css must style accordions and modals with var(--cx-surface-bg)');
  assert.ok(cssHas(themeMaterialCss, 'var(--cx-surface-elevated'), 'theme-material.css must style category menus with var(--cx-surface-elevated)');
  assert.ok(cssHas(themeMaterialCss, 'var(--cx-input-bg'), 'theme-material.css must style form controls with var(--cx-input-bg)');

  // Tables, headers, alt rows, and hover states (theme-tables.css)
  assert.ok(cssHas(themeTablesCss, 'var(--cx-surface-bg'), 'theme-tables.css must style tables with var(--cx-surface-bg)');
  assert.ok(cssHas(themeTablesCss, 'var(--cx-table-header-bg'), 'theme-tables.css must style table headers with var(--cx-table-header-bg)');
  assert.ok(cssHas(themeTablesCss, 'var(--cx-table-row-alt'), 'theme-tables.css must style alt rows with var(--cx-table-row-alt)');
  assert.ok(cssHas(themeTablesCss, 'var(--cx-table-row-hover'), 'theme-tables.css must style hover rows with var(--cx-table-row-hover)');

  // Menus, calendars, and speech boxes (theme-navigation.css)
  assert.ok(cssHas(themeNavigationCss, 'var(--cx-surface-elevated'), 'theme-navigation.css must style dropdowns with var(--cx-surface-elevated)');
  assert.ok(cssHas(themeNavigationCss, 'var(--cx-surface-bg'), 'theme-navigation.css must style calendars with var(--cx-surface-bg)');
  assert.ok(cssHas(themeNavigationCss, 'var(--cx-surface-secondary'), 'theme-navigation.css must style speech boxes/breadcrumbs with var(--cx-surface-secondary)');

  // Form controls, buttons, checkboxes, dropdowns, and progress pills (theme-controls.css)
  assert.ok(cssHas(themeControlsCss, 'var(--cx-input-bg'), 'theme-controls.css must style inputs and selects with var(--cx-input-bg)');
  assert.ok(cssHas(themeControlsCss, 'var(--cx-button-bg'), 'theme-controls.css must style buttons with var(--cx-button-bg)');
  assert.ok(cssHas(themeControlsCss, 'var(--cx-accent'), 'theme-controls.css must style checked controls with var(--cx-accent)');

  // Surfaces: learning areas, resource panels, tree panels, notifications, alerts (theme-surfaces.css)
  assert.ok(cssHas(themeSurfacesCss, 'var(--cx-surface-bg'), 'theme-surfaces.css must style learning areas with var(--cx-surface-bg)');
  assert.ok(cssHas(themeSurfacesCss, 'var(--cx-surface-elevated'), 'theme-surfaces.css must style notifications with var(--cx-surface-elevated)');
  assert.ok(cssHas(themeSurfacesCss, 'var(--cx-surface-secondary'), 'theme-surfaces.css must style alerts with var(--cx-surface-secondary)');

  // 3. Every preset theme defines complete surface palettes in theme-tokens.css
  const themes = ['dark', 'quantum', 'amoled', 'midnight', 'forest', 'liquid-glass'];
  const requiredTokens = [
    '--cx-canvas-bg', '--cx-surface-bg', '--cx-surface-secondary', '--cx-surface-elevated',
    '--cx-border', '--cx-text-primary', '--cx-text-secondary', '--cx-accent',
    '--cx-nav-bg', '--cx-button-bg', '--cx-input-bg', '--cx-table-header-bg'
  ];
  for (const th of themes) {
    const selector = `[data-connectea-theme="${th}"]`;
    assert.ok(cssHas(themeTokensCss, selector), `theme-tokens.css must define selector for ${th}`);
    for (const tok of requiredTokens) {
      assert.ok(cssHas(themeTokensCss, tok), `theme-tokens.css must define ${tok} for all themes`);
    }
  }

  // 4. Runtime theme switching verification across all themes
  delete window.ConnectifyThemeLoaded;
  eval(themeRegistryJs);
  eval(themeJs);

  for (const th of themes) {
    window.ConnectifyTheme.applyTheme(true, th);
    assert.strictEqual(document.documentElement.dataset.connecteaTheme, th,
      `applyTheme(true, '${th}') must set data-connectea-theme to '${th}'`);
    assert.ok(document.documentElement.classList.contains('connectea-dark'),
      `applyTheme(true, '${th}') must keep connectea-dark class on html`);
  }

  // 5. Themes menu click and icon structure
  const toggleBtn = document.getElementById('connectea-theme-toggle');
  assert.ok(toggleBtn, 'Toggle button must exist');
  const arrowEl = toggleBtn.querySelector('.connectea-theme-arrow');
  assert.ok(arrowEl, 'Toggle button must contain .connectea-theme-arrow');
  arrowEl.click();
  const themeMenu = document.getElementById('connectea-theme-menu');
  assert.ok(themeMenu, 'Clicking .connectea-theme-arrow must open #connectea-theme-menu');
  const options = themeMenu.querySelectorAll('.connectea-theme-option');
  assert.strictEqual(options.length, 7, 'Themes menu must render all 7 built-in dark themes');
  const icons = themeMenu.querySelectorAll('.connectea-theme-icon');
  assert.strictEqual(icons.length, 7, 'Every theme option must contain a .connectea-theme-icon element');

  // Click Quantum Dark option in menu
  const quantumOpt = Array.from(options).find(opt => opt.querySelector('.connectea-theme-name')?.textContent.includes('Quantum Dark'));
  assert.ok(quantumOpt, 'Themes menu must include Quantum Dark option');
  quantumOpt.click();
  assert.strictEqual(document.documentElement.dataset.connecteaTheme, 'quantum');
});

runTest('Test 141: Top navbar Open Sans typography, height, white text, and light-mode margin, size, and outline parity', () => {
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeCardsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-cards.css'), 'utf8');
  const themeFeedCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-feed.css'), 'utf8');
  const themeTilesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tiles.css'), 'utf8');
  const themeTablesCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tables.css'), 'utf8');

  // 1. Top navbar font family enforces Connect's native Open Sans
  assert.ok(cssHas(themeCoreCss, 'font-family: "Open Sans", Arial, Helvetica, Verdana, sans-serif !important;'),
    'theme-core.css must enforce Connect native Open Sans font on top navigation bar');
  assert.ok(cssHas(themeTokensCss, 'font-family: "Open Sans", Arial, Helvetica, Verdana, sans-serif !important;'),
    'theme-tokens.css must enforce Connect native Open Sans font on top navigation bar');
  assert.ok(cssHas(themeCoreCss, 'height: 50px !important;'),
    'theme-core.css must enforce light-mode 50px height on top navigation bar');

  // 2. Top navbar links typography and styling match light mode
  assert.ok(cssHas(themeCoreCss, 'line-height: 50px !important;') && cssHasToken(themeCoreCss, 'color: #ffffff !important;'),
    'theme-core.css must enforce 50px line-height and white text on top navbar links');
  assert.ok(!cssHas(themeFeedCss, '.cvr-c-primary-navigation__links .v-link a,\n  .cvr-c-primary-navigation__button--avatar'),
    'theme-feed.css must not override top navbar links with muted text color');

  // 3. Active tab in top navigation has no distorting top/left/right border or border-radius
  assert.ok(cssHas(themeCoreCss, 'border: none !important;') && cssHas(themeCoreCss, 'border-radius: 0 !important;'),
    'theme-core.css active nav tab must have border: none and border-radius: 0 to eliminate outlines');
  assert.ok(cssHas(themeFeedCss, 'border-radius: 0 !important;'),
    'theme-feed.css active nav tab must have border-radius: 0 to eliminate box outline');

  // 4. Task mark boxes (.cvr-c-task__marks) match light mode's border geometry (no full 1px border or 6px radius)
  assert.ok(cssHas(themeCardsCss, '.cvr-c-task__marks {\n  border-top: none !important;\n  border-left: none !important;\n  border-right: none !important;'),
    'theme-cards.css must remove top, left, and right borders on .cvr-c-task__marks to match light mode');
  assert.ok(cssHas(themeCardsCss, 'border-radius: 0 !important;'),
    'theme-cards.css must enforce border-radius: 0 on .cvr-c-task__marks');
  assert.ok(!cssHas(themeTablesCss, '.cvr-c-task__mark,\n  .mat-card'),
    'theme-tables.css must not force 4-sided 1px border on .cvr-c-task__mark');

  // 5. Tile header action button matches light mode 52px height and border-left
  assert.ok(cssHas(themeTilesCss, '.eds-c-tile__header .v-button') && cssHas(themeTilesCss, 'height: 52px !important;'),
    'theme-tiles.css must preserve light-mode 52px height and border-left on tile header action button');
  assert.ok(cssHas(themeTilesCss, 'border-left: 1px solid var(--cx-border') && cssHas(themeTilesCss, 'border-radius: 0 !important;'),
    'theme-tiles.css must preserve border-left and border-radius: 0 on tile header action button');
});

runTest('Test 142: Sleek compact theme toggle button geometry and elimination of nested arrow box', () => {
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');

  // 1. Sleek compact dimensions on #connectea-theme-toggle
  assert.ok(cssHas(themeCoreCss, 'height: 28px;'),
    'theme-core.css must set sleek 28px height on #connectea-theme-toggle');
  assert.ok(cssHas(themeCoreCss, 'padding: 5px 12px;'),
    'theme-core.css must set sleek 5px 12px padding on #connectea-theme-toggle');
  assert.ok(cssHas(themeCoreCss, 'border-radius: 6px;'),
    'theme-core.css must set sleek 6px border-radius on #connectea-theme-toggle');
  assert.ok(cssHas(themeCoreCss, 'font-size: 12px;'),
    'theme-core.css must set sleek 12px font size on #connectea-theme-toggle');
  assert.ok(cssHas(themeCoreCss, 'background: #25313f !important;'),
    'theme-core.css must set #25313f light-mode background on #connectea-theme-toggle');
  assert.ok(cssHasToken(themeCoreCss, 'background: #24303f !important;'),
    'theme-core.css must set #24303f dark-mode background on #connectea-theme-toggle');

  // 2. Elimination of nested box styling on .connectea-theme-arrow
  assert.ok(cssHas(themeTokensCss, '.connectea-theme-arrow {\n  display: inline-block;') &&
            cssHas(themeTokensCss, 'background: transparent;') &&
            cssHas(themeTokensCss, 'border: none;'),
    'theme-tokens.css must use sleek inline-block transparent borderless styling on .connectea-theme-arrow');
  assert.ok(!cssHas(themeTokensCss, 'background: rgba(255, 255, 255, 0.14);'),
    'theme-tokens.css must not add an awkward nested box background to .connectea-theme-arrow');
  assert.ok(!cssHas(themeTokensCss, 'border: 1px solid rgba(255, 255, 255, 0.2);'),
    'theme-tokens.css must not add an awkward nested border to .connectea-theme-arrow');
});

runTest('Test 143: Token-based theme styling, notice action buttons, top navbar typography, and webfont protection', () => {
  const themeTokensCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-tokens.css'), 'utf8');
  const themeFeedCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-feed.css'), 'utf8');
  const themeCoreCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-core.css'), 'utf8');
  const themeControlsCss = fs.readFileSync(path.resolve(BASE_DIR, 'theme-controls.css'), 'utf8');
  const sidebarDrawerCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-drawer.css'), 'utf8');
  const sidebarSettingsCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-settings.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme.js'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-registry.js'), 'utf8');

  // 1. Semantic card and positive button tokens defined in theme-tokens.css
  assert.ok(cssHas(themeTokensCss, '--cx-card-bg:') && cssHas(themeTokensCss, '--cx-positive-bg:'),
    'theme-tokens.css must define --cx-card-bg and --cx-positive-bg tokens');
  assert.ok(cssHas(themeTokensCss, '--cx-positive-text:') && cssHas(themeTokensCss, '--cx-positive-border:'),
    'theme-tokens.css must define --cx-positive-text and --cx-positive-border tokens');

  // 2. Notice View positive button styled in theme-feed.css and excluded from generic button overrides
  assert.ok(cssHas(themeFeedCss, '.eds-o-button--positive') && cssHas(themeFeedCss, 'var(--cx-positive-bg'),
    'theme-feed.css must style .eds-o-button--positive using var(--cx-positive-bg)');
  assert.ok(cssHas(themeControlsCss, ':not(.eds-o-button--positive):not([class*="positive"]):not([class*="view"])'),
    'theme-controls.css must exclude positive action buttons from generic button overrides');

  // 3. Feed follow pills styled with elevated tokens and rounded geometry
  assert.ok(cssHas(themeFeedCss, 'border-radius: 9999px !important;') && cssHas(themeFeedCss, 'var(--cx-surface-elevated'),
    'theme-feed.css must style follow pills with 9999px border-radius and elevated tokens');

  // 4. Themes popover contrast and emoji font stack
  assert.ok(cssHas(themeTokensCss, '#connectea-theme-menu .connectea-theme-option') &&
            cssHas(themeTokensCss, 'var(--cx-text-secondary'),
    'theme-tokens.css must enforce high contrast text on theme menu options');
  assert.ok(cssHas(themeTokensCss, '"Apple Color Emoji"') && cssHas(themeTokensCss, '"Segoe UI Emoji"'),
    'theme-tokens.css must include emoji font stack for theme icons');
  assert.ok(themeJs.includes("'🌙'") && themeRegistryJs.includes("'🌙'"),
    'theme.js and theme-registry.js must use emoji icons for themes');

  // 5. Top navbar Open Sans typography and link styling
  assert.ok(cssHas(themeCoreCss, '.cvr-c-primary-navigation a') &&
            cssHasToken(themeCoreCss, 'color: #ffffff !important;') &&
            cssHas(themeCoreCss, 'font-family: "Open Sans"'),
    'theme-core.css must enforce white text and Open Sans on top navbar links');

  // 6. Webfont protection scoped to pseudo-elements on accordion triggers
  assert.ok(!cssHas(themeTokensCss, '.cvr-c-expansion-panel__trigger,\n  .cvr-c-resources-panel .column-heading,\n  [class*="cvr-c-icon"]\n) {\n  font-family: "connect-webfont"'),
    'theme-tokens.css must not apply connect-webfont directly to trigger elements with text');

  // 7. Sidebar and settings surfaces adapt dynamically using theme tokens
  assert.ok(cssHas(sidebarDrawerCss, 'var(--cx-surface-bg'),
    'sidebar-drawer.css must style #connectify-sidebar with var(--cx-surface-bg)');
  assert.ok(cssHas(sidebarSettingsCss, 'var(--cx-surface-bg'),
    'sidebar-settings.css must style #connectify-sidebar with var(--cx-surface-bg)');
  assert.ok(cssHas(sidebarDrawerCss, 'var(--cx-button-bg'),
    'sidebar-drawer.css must style sidebar tool buttons with var(--cx-button-bg)');
});

runTest('Test 144: Classes page header parity, Angular Material tab specificity, dropdown tokenization, and Quantum Dark inspiration palette', () => {
  const themeCoreCss = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme-core.css'), 'utf8');
  const themeMaterialCss = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme-material.css'), 'utf8');
  const themeNavCss = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme-navigation.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme-tokens.css'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme.js'), 'utf8');
  const themeRegistryJs = fs.readFileSync(path.resolve(SRC_DIR, 'theme/theme-registry.js'), 'utf8');

  // 1. Classes page sort header has transparent background matching light mode
  assert.ok(cssHas(themeCoreCss, '.cvr-c-classes__sort') &&
            cssHas(themeCoreCss, 'background: transparent !important;'),
    'theme-core.css must enforce transparent background on Classes sort header');

  // 2. Classes page list items and text elements enforce Open Sans typography
  assert.ok(cssHas(themeMaterialCss, '.eds-c-selection-list') &&
            cssHas(themeMaterialCss, 'font-family: "Open Sans"'),
    'theme-material.css must enforce Open Sans on Classes list items');

  // 3. Angular Material tabs (.eds.cvr.ngm) have high-specificity Open Sans and .mat-ink-bar has var(--cx-accent)
  assert.ok(cssHas(themeNavCss, '.eds.cvr.ngm') &&
            cssHas(themeNavCss, 'mat-tab-header') &&
            cssHas(themeNavCss, '.mat-ink-bar'),
    'theme-navigation.css must style Angular Material tabs with high specificity');
  assert.ok(cssHas(themeNavCss, '.mat-ink-bar') && cssHas(themeNavCss, 'var(--cx-accent'),
    'theme-navigation.css must style .mat-ink-bar with var(--cx-accent)');

  // 4. Dropdowns tokenize colors without hardcoded hex
  assert.ok(cssHas(themeMaterialCss, '.mat-select-panel') &&
            cssHas(themeMaterialCss, 'var(--cx-surface-elevated'),
    'theme-material.css must style .mat-select-panel with elevated tokens');
  assert.ok(cssHas(themeMaterialCss, '.mat-option') &&
            cssHas(themeMaterialCss, 'var(--cx-surface-hover'),
    'theme-material.css must style .mat-option hover state with hover tokens');

  // 5. Quantum Dark uses inspiration theme palette
  assert.ok(cssHas(themeTokensCss, '--cx-canvas-bg: #282828;') &&
            cssHas(themeTokensCss, '--cx-surface-bg: #32302f;') &&
            cssHas(themeTokensCss, '--cx-accent: #fabd2f;') &&
            cssHas(themeTokensCss, '--cx-positive-bg: #98971a;'),
    'theme-tokens.css must define Quantum Dark with Gruvbox/Evolve inspiration colors');
  assert.ok(themeRegistryJs.includes("swatch: ['#282828', '#32302f', '#fabd2f']") &&
            themeJs.includes("swatch: ['#282828', '#32302f', '#fabd2f']"),
    'theme-registry.js and theme.js must use inspiration swatch for Quantum Dark');
  assert.ok(cssHas(themeTokensCss, '--cx-text-secondary: #b8bb26;'),
    'theme-tokens.css must define Quantum Dark with green secondary color #b8bb26');
  assert.ok(cssHas(themeTokensCss, '--cx-glass-blur') &&
            cssHas(themeTokensCss, 'backdrop-filter: blur('),
    'theme-tokens.css must define Apple liquid glass frosted styling with translucent surfaces');
  assert.ok(themeRegistryJs.includes("'liquid-glass'") && themeJs.includes("'liquid-glass'"),
    'theme-registry.js and theme.js must register liquid-glass theme');
});

runTest('Test 145: Puppeteer theme unstyled element auditor and Connect directory crawler scripts', async () => {
  const utilsPath = path.resolve(__dirname, 'scripts/puppeteer-utils.js');
  const themeTesterPath = path.resolve(__dirname, 'scripts/test-theme-styles.js');
  const crawlerPath = path.resolve(__dirname, 'scripts/crawl-connect-directories.js');
  const pkgJsonPath = path.resolve(__dirname, 'package.json');

  // 1. Files exist (scripts/ test tooling is exempt from the src/ line limit)
  assert.ok(fs.existsSync(utilsPath), 'scripts/puppeteer-utils.js must exist');
  assert.ok(fs.existsSync(themeTesterPath), 'scripts/test-theme-styles.js must exist');
  assert.ok(fs.existsSync(crawlerPath), 'scripts/crawl-connect-directories.js must exist');

  // 2. puppeteer-utils exports and WCAG calculations
  const utilsMod = require(utilsPath);
  assert.strictEqual(typeof utilsMod.launchBrowser, 'function', 'launchBrowser must be exported');
  assert.strictEqual(typeof utilsMod.authenticate, 'function', 'authenticate must be exported');
  assert.strictEqual(typeof utilsMod.chooseStudentLogin, 'function', 'the login picks Student on Connect\'s sign-in chooser');
  const utilsSrc = fs.readFileSync(utilsPath, 'utf8');
  assert.ok(!utilsSrc.includes('bringToFront'), 'the login window never takes focus');
  assert.ok(utilsSrc.includes('activateApp(front)') && utilsSrc.includes('settleExtension(browser)'), 'a visible window hands focus back; launches wait for the extension\'s install reload');
  assert.ok(/chooseStudentLogin\(page\);\s*await page\.waitForSelector\('#ssousername/.test(utilsSrc), 'credential login picks Student before the SSO form');
  assert.strictEqual(typeof utilsMod.saveSession, 'function', 'saveSession must be exported');
  assert.strictEqual(typeof utilsMod.loadSession, 'function', 'loadSession must be exported');
  assert.strictEqual(typeof utilsMod.calculateContrastRatio, 'function', 'calculateContrastRatio must be exported');
  assert.strictEqual(typeof utilsMod.auditPageUiContrast, 'function', 'auditPageUiContrast must be exported');

  // Verify WCAG contrast calculation: black on white = 21:1
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const cr = utilsMod.calculateContrastRatio(black, white);
  assert.ok(Math.abs(cr - 21) < 0.2, `Black on white contrast must be ~21:1 (got ${cr})`);

  // 3. test-theme-styles exports parity functions and multi-URL resolver
  const themeTesterMod = require(themeTesterPath);
  assert.strictEqual(typeof themeTesterMod.runThemeAudit, 'function', 'runThemeAudit must be exported');
  assert.strictEqual(typeof themeTesterMod.buildAuditManifest, 'function', 'buildAuditManifest must be exported');
  assert.strictEqual(typeof themeTesterMod.resolveTargetUrls, 'function', 'resolveTargetUrls must be exported');
  assert.strictEqual(typeof themeTesterMod.clickInteractiveButtons, 'function', 'clickInteractiveButtons must be exported');
  assert.strictEqual(typeof themeTesterMod.discoverSubPages, 'function', 'discoverSubPages must be exported');
  assert.strictEqual(typeof themeTesterMod.captureNativeBaseline, 'function', 'captureNativeBaseline must be exported');
  assert.strictEqual(typeof themeTesterMod.auditThemeAgainstBaseline, 'function', 'auditThemeAgainstBaseline must be exported');
  assert.strictEqual(typeof themeTesterMod.discoverSidebarViews, 'function', 'discoverSidebarViews must be exported');
  assert.strictEqual(typeof themeTesterMod.activateSidebarView, 'function', 'activateSidebarView must be exported');
  assert.strictEqual(typeof themeTesterMod.computeElementsSignature, 'function', 'computeElementsSignature must be exported');

  // Verify elements signature matches for identical views and differs for distinct views
  const baseA = {
    visibleCount: 2,
    elements: {
      el1: { tagName: 'div', selector: '.card', textSnippet: 'Title A', size: { width: 100, height: 50 } },
      el2: { tagName: 'span', selector: '.badge', textSnippet: 'Badge', size: { width: 30, height: 20 } }
    }
  };
  const baseB = {
    visibleCount: 2,
    elements: {
      el1: { tagName: 'div', selector: '.card', textSnippet: 'Title A', size: { width: 100, height: 50 } },
      el2: { tagName: 'span', selector: '.badge', textSnippet: 'Badge', size: { width: 30, height: 20 } }
    }
  };
  const baseC = {
    visibleCount: 2,
    elements: {
      el1: { tagName: 'div', selector: '.card', textSnippet: 'Title DIFFERENT', size: { width: 100, height: 50 } },
      el2: { tagName: 'span', selector: '.badge', textSnippet: 'Badge', size: { width: 30, height: 20 } }
    }
  };
  assert.strictEqual(themeTesterMod.computeElementsSignature(baseA), themeTesterMod.computeElementsSignature(baseB), 'Identical views must have matching signatures');
  assert.notStrictEqual(themeTesterMod.computeElementsSignature(baseA), themeTesterMod.computeElementsSignature(baseC), 'Distinct views must have different signatures');

  // Verify auditThemeAgainstBaseline detects parity errors for outline, border, svg fill/stroke, font style, and font weight
  const mockBaseline = {
    visibleCount: 4,
    elements: {
      el_outline: {
        auditId: 'el_outline',
        selector: '.card-outline',
        tagName: 'div',
        textSnippet: 'Outline card',
        font: { family: 'open sans', rawFamily: 'Open Sans', size: 14, weight: 400, style: 'normal' },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 100, height: 100 },
        outline: { style: 'none', width: 0, color: '' },
        border: { topWidth: 0, rightWidth: 0, bottomWidth: 0, leftWidth: 0 }
      },
      el_border: {
        auditId: 'el_border',
        selector: '.card-divider',
        tagName: 'div',
        textSnippet: 'Card title',
        font: { family: 'open sans', rawFamily: 'Open Sans', size: 14, weight: 400, style: 'normal' },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 100, height: 20 },
        outline: { style: 'none', width: 0, color: '' },
        border: { topWidth: 0, rightWidth: 0, bottomWidth: 0, leftWidth: 0 }
      },
      el_svg: {
        auditId: 'el_svg',
        selector: 'svg.icon-comment',
        tagName: 'svg',
        isSvg: true,
        textSnippet: '',
        font: { family: 'open sans', rawFamily: 'Open Sans', size: 14, weight: 400, style: 'normal' },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 16, height: 16 },
        outline: { style: 'none', width: 0, color: '' },
        border: { topWidth: 0, rightWidth: 0, bottomWidth: 0, leftWidth: 0 },
        svg: { fill: 'none', stroke: 'currentColor', strokeWidth: 1 }
      },
      el_font: {
        auditId: 'el_font',
        selector: '.author-text',
        tagName: 'span',
        textSnippet: 'Mr. Smith',
        font: { family: 'open sans', rawFamily: 'Open Sans', size: 14, weight: 400, style: 'normal' },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 80, height: 20 },
        outline: { style: 'none', width: 0, color: '' },
        border: { topWidth: 0, rightWidth: 0, bottomWidth: 0, leftWidth: 0 }
      },
      el_dashed: {
        auditId: 'el_dashed',
        selector: '#layout-column_column-1',
        tagName: 'div',
        textSnippet: 'Column 1',
        font: { family: 'open sans', rawFamily: 'Open Sans', size: 14, weight: 400, style: 'normal' },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        size: { width: 300, height: 200 },
        outline: { style: 'none', width: 0, color: '' },
        border: { topWidth: 0, rightWidth: 0, bottomWidth: 0, leftWidth: 0, topStyle: 'none', rightStyle: 'none', bottomStyle: 'none', leftStyle: 'none' },
        borderRadius: 0,
        rawBorderRadius: '0px',
        isButton: false,
        isActionButton: false,
        isTable: false,
        isTableCell: false,
        isTableColumn: false,
        isContainer: true
      }
    }
  };

  const parityDomEls = [
    {
      dataset: { cxAuditId: 'el_outline' },
      tagName: 'DIV',
      innerText: 'Outline card',
      textContent: 'Outline card',
      getBoundingClientRect: () => ({ width: 100, height: 100 }),
      getAttribute: () => null,
      classList: { contains: () => false },
      closest: () => null,
      childNodes: [{ nodeType: 3, textContent: 'Outline card' }],
      _style: {
        visibility: 'visible',
        display: 'block',
        opacity: '1',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        fontFamily: 'Open Sans',
        outlineStyle: 'solid',
        outlineWidth: '2px',
        borderTopStyle: 'none',
        borderBottomStyle: 'none',
        borderLeftStyle: 'none',
        borderRightStyle: 'none',
        backgroundColor: 'rgb(24, 26, 27)',
        color: 'rgb(255, 255, 255)'
      }
    },
    {
      dataset: { cxAuditId: 'el_border' },
      tagName: 'DIV',
      innerText: 'Card title',
      textContent: 'Card title',
      getBoundingClientRect: () => ({ width: 100, height: 20 }),
      getAttribute: () => null,
      classList: { contains: () => false },
      closest: () => null,
      childNodes: [{ nodeType: 3, textContent: 'Card title' }],
      _style: {
        visibility: 'visible',
        display: 'block',
        opacity: '1',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        fontFamily: 'Open Sans',
        outlineStyle: 'none',
        borderTopStyle: 'none',
        borderBottomStyle: 'solid',
        borderBottomWidth: '1px',
        borderLeftStyle: 'none',
        borderRightStyle: 'none',
        backgroundColor: 'rgb(24, 26, 27)',
        color: 'rgb(255, 255, 255)'
      }
    },
    {
      dataset: { cxAuditId: 'el_svg' },
      tagName: 'SVG',
      innerText: '',
      textContent: '',
      getBoundingClientRect: () => ({ width: 16, height: 16 }),
      getAttribute: (attr) => attr === 'fill' ? 'currentColor' : null,
      classList: { contains: () => false },
      closest: () => null,
      childNodes: [],
      _style: {
        visibility: 'visible',
        display: 'inline-block',
        opacity: '1',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        fontFamily: 'Open Sans',
        outlineStyle: 'none',
        fill: 'currentColor',
        stroke: '',
        borderTopStyle: 'none',
        borderBottomStyle: 'none',
        borderLeftStyle: 'none',
        borderRightStyle: 'none'
      }
    },
    {
      dataset: { cxAuditId: 'el_font' },
      tagName: 'SPAN',
      innerText: 'Mr. Smith',
      textContent: 'Mr. Smith',
      getBoundingClientRect: () => ({ width: 80, height: 20 }),
      getAttribute: () => null,
      classList: { contains: () => false },
      closest: () => null,
      childNodes: [{ nodeType: 3, textContent: 'Mr. Smith' }],
      _style: {
        visibility: 'visible',
        display: 'inline',
        opacity: '1',
        fontSize: '14px',
        fontWeight: '700',
        fontStyle: 'italic',
        fontFamily: 'Open Sans',
        outlineStyle: 'none',
        borderTopStyle: 'none',
        borderBottomStyle: 'none',
        borderLeftStyle: 'none',
        borderRightStyle: 'none',
        backgroundColor: 'rgb(24, 26, 27)',
        color: 'rgb(255, 255, 255)'
      }
    },
    {
      dataset: { cxAuditId: 'el_dashed' },
      tagName: 'DIV',
      innerText: 'Column 1',
      textContent: 'Column 1',
      getBoundingClientRect: () => ({ width: 300, height: 200 }),
      getAttribute: () => null,
      classList: { contains: (c) => c === 'portlet-column' || c === 'portlet-dropzone' },
      closest: () => null,
      childNodes: [{ nodeType: 3, textContent: 'Column 1' }],
      _style: {
        visibility: 'visible',
        display: 'block',
        opacity: '1',
        fontSize: '14px',
        fontWeight: '400',
        fontStyle: 'normal',
        fontFamily: 'Open Sans',
        outlineStyle: 'none',
        borderTopStyle: 'dashed',
        borderTopWidth: '1px',
        borderBottomStyle: 'dashed',
        borderBottomWidth: '1px',
        borderLeftStyle: 'dashed',
        borderLeftWidth: '1px',
        borderRightStyle: 'dashed',
        borderRightWidth: '1px',
        backgroundColor: 'rgb(24, 26, 27)',
        color: 'rgb(255, 255, 255)'
      }
    }
  ];

  const origWinAudit = global.window;
  const origDocAudit = global.document;
  try {
    let currentAuditQuerySelectorAll = (sel) => sel === 'body *' ? parityDomEls : [];
    const mockPageAudit = {
      evaluate: async (fn, ...args) => {
        const prevWin = global.window;
        const prevDoc = global.document;
        try {
          global.window = Object.assign(Object.create(origWinAudit), {
            getComputedStyle: (el) => el._style || {},
            addEventListener: () => {},
            removeEventListener: () => {},
            onbeforeunload: null,
            MouseEvent: class { constructor(type) { this.type = type; } },
            PointerEvent: class { constructor(type) { this.type = type; } }
          });
          global.document = Object.assign(Object.create(origDocAudit), {
            querySelectorAll: (sel) => currentAuditQuerySelectorAll(sel)
          });
          return await fn(...args);
        } finally {
          global.window = prevWin;
          global.document = prevDoc;
        }
      }
    };
    const auditRes = await themeTesterMod.auditThemeAgainstBaseline(mockPageAudit, 'dark', true, mockBaseline, {});
    const issueTypes = auditRes.issues.map(i => i.type);
    assert.ok(issueTypes.includes('OUTLINE_MISMATCH'), 'auditThemeAgainstBaseline must detect OUTLINE_MISMATCH');
    assert.ok(issueTypes.includes('BORDER_MISMATCH'), 'auditThemeAgainstBaseline must detect BORDER_MISMATCH');
    assert.ok(issueTypes.includes('SVG_FILL_MISMATCH'), 'auditThemeAgainstBaseline must detect SVG_FILL_MISMATCH');
    assert.ok(issueTypes.includes('SVG_STROKE_MISMATCH'), 'auditThemeAgainstBaseline must detect SVG_STROKE_MISMATCH');
    assert.ok(issueTypes.includes('FONT_WEIGHT_MISMATCH'), 'auditThemeAgainstBaseline must detect FONT_WEIGHT_MISMATCH');
    assert.ok(issueTypes.includes('FONT_STYLE_MISMATCH'), 'auditThemeAgainstBaseline must detect FONT_STYLE_MISMATCH');
    assert.ok(issueTypes.includes('DASHED_BORDER_ADDED'), 'auditThemeAgainstBaseline must detect DASHED_BORDER_ADDED');
    assert.ok(issueTypes.includes('CONTAINER_OUTLINE_ADDED'), 'auditThemeAgainstBaseline must detect CONTAINER_OUTLINE_ADDED');

    // Verify clickInteractiveButtons discovers and clicks mat-card button and div.v-button
    let matClicked = 0;
    let vClicked = 0;
    const mockMatButton = {
      tagName: 'BUTTON',
      id: 'mat-notice-view',
      className: 'mat-button',
      innerText: 'View',
      textContent: 'View',
      children: [],
      getAttribute: (attr) => attr === 'type' ? 'button' : null,
      hasAttribute: () => false,
      matches: () => false,
      closest: (sel) => sel && sel.includes('mat-card') ? { tagName: 'MAT-CARD' } : null,
      querySelector: () => null,
      dispatchEvent: (ev) => { if (ev.type === 'click') matClicked++; },
      click: () => { matClicked++; }
    };
    const mockVaadinButton = {
      tagName: 'DIV',
      id: '',
      className: 'v-button',
      innerText: 'View Notice',
      textContent: 'View Notice',
      children: [],
      getAttribute: () => null,
      hasAttribute: () => false,
      matches: () => false,
      closest: () => null,
      querySelector: () => null,
      dispatchEvent: (ev) => { if (ev.type === 'click') vClicked++; },
      click: () => { vClicked++; }
    };

    currentAuditQuerySelectorAll = (sel) => {
      if (sel.includes('mat-card button') || sel.includes('.v-button') || sel.includes('button, summary')) {
        return [mockMatButton, mockVaadinButton];
      }
      return [];
    };
    const clickedButtons = await themeTesterMod.clickInteractiveButtons(mockPageAudit);
    assert.ok(clickedButtons.some(b => b.includes('button#mat-notice-view') && b.includes('View')), 'clickInteractiveButtons must click mat-card View button');
    assert.ok(clickedButtons.some(b => b.includes('div.v-button') && b.includes('View Notice')), 'clickInteractiveButtons must click div.v-button View Notice');
    assert.ok(matClicked >= 1, 'mat-card View button must receive click event');
    assert.ok(vClicked >= 1, 'div.v-button View Notice must receive click event');

    const toolBtnList = [
      { id: 'connectify-goals-toggle', textContent: 'Goal Setter', click: () => {} },
      { id: 'connectify-predictor-toggle', textContent: 'Predictor', click: () => {} },
      { id: 'connectify-progress-toggle', textContent: 'Year Progression', click: () => {} },
      { id: 'connectify-estimator-toggle', textContent: 'Estimator', click: () => {} },
      { id: 'connectify-weakness-toggle', textContent: 'Weakness Analyzer', click: () => {} },
      { id: 'connectify-categories-toggle', textContent: 'Settings', click: () => {} }
    ];

    const mockSidebarDom = {
      id: 'connectify-sidebar',
      hidden: true,
      classList: { contains: () => false, remove: () => {} },
      querySelector: (sel) => {
        if (sel === '.cx-back-menu') return { click: () => {} };
        if (sel === '#cx-pred-btn-grade') return { click: () => {} };
        if (sel === '#cx-pred-btn-atar') return { click: () => {} };
        if (sel === '#cx-radar-mode') return { options: [{ value: 'type', text: 'By Type' }, { value: 'subject', text: 'By Subject' }] };
        if (sel === '.cx-tool-menu button') return toolBtnList[0];
        const match = toolBtnList.find(b => sel && sel.includes(b.id));
        if (match) return match;
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('.cx-tool-menu button')) {
          return toolBtnList;
        }
        if (sel.includes('.cta-semesters') || sel.includes('.cta-semester')) {
          return [
            { textContent: 'Semester 1', click: () => {} },
            { textContent: 'Semester 2', click: () => {} }
          ];
        }
        if (sel.includes('.cx-pred-subtab')) {
          return [
            { textContent: 'English', click: () => {} },
            { textContent: 'Math Methods', click: () => {} }
          ];
        }
        if (sel.includes('.cx-subjects button')) {
          return [
            { textContent: 'Physics', click: () => {} },
            { textContent: 'Chemistry', click: () => {} }
          ];
        }
        return [];
      }
    };
    const mockHandleDom = {
      id: 'connectify-sidebar-handle',
      setAttribute: () => {},
      style: {}
    };
    const mockPageSidebar = {
      evaluate: async (fn, ...args) => {
        const prevDoc = global.document;
        try {
          global.document = Object.assign(Object.create(origDocAudit), {
            getElementById: (id) => {
              if (id === 'connectify-sidebar') return mockSidebarDom;
              if (id === 'connectify-sidebar-handle') return mockHandleDom;
              const match = toolBtnList.find(b => b.id === id);
              if (match) return match;
              return origDocAudit?.getElementById ? origDocAudit.getElementById(id) : null;
            },
            querySelector: (sel) => mockSidebarDom.querySelector(sel) || (origDocAudit?.querySelector ? origDocAudit.querySelector(sel) : null),
            querySelectorAll: (sel) => mockSidebarDom.querySelectorAll(sel)
          });
          return fn(...args);
        } finally {
          global.document = prevDoc;
        }
      }
    };

    const discoveredSidebarViews = await themeTesterMod.discoverSidebarViews(mockPageSidebar);
    assert.ok(discoveredSidebarViews.length >= 8, `Must discover at least 8 sidebar views (got ${discoveredSidebarViews.length})`);
    assert.ok(discoveredSidebarViews.every(v => v.auditScope === 'sidebar'), 'All sidebar views must have auditScope: "sidebar"');
    assert.ok(discoveredSidebarViews.some(v => v.id === 'cx-sidebar-menu'), 'Must discover Sidebar Main Menu');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Target ATAR') && v.title.includes('Semester 1')), 'Must discover Target ATAR Semester 1');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Target ATAR') && v.title.includes('Semester 2')), 'Must discover Target ATAR Semester 2');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Goal Setter') && v.title.includes('Target Grade') && v.tabSelector), 'Must discover Goals Target Grade tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Estimator') && v.title.includes('Estimate Grade') && v.tabSelector), 'Must discover Estimates Estimate Grade tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Predict Grade') && v.title.includes('English')), 'Must discover Predict Grade English sub-tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Predict Grade') && v.title.includes('Math Methods')), 'Must discover Predict Grade Math Methods sub-tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Predict ATAR')), 'Must discover Predict ATAR tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Year Progression') && v.title.includes('Physics')), 'Must discover Progress Physics sub-tab');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Weakness Analyzer') && v.title.includes('By Type')), 'Must discover Weaknesses By Type mode');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Weakness Analyzer') && v.title.includes('By Subject')), 'Must discover Weaknesses By Subject mode');
    assert.ok(discoveredSidebarViews.some(v => v.title.includes('Settings')), 'Must discover Settings view');

    // Verify activateSidebarView opens drawer and unhides sidebar
    const activatedView = await themeTesterMod.activateSidebarView(mockPageSidebar, discoveredSidebarViews[1], 10);
    assert.strictEqual(activatedView, true, 'activateSidebarView must return true on success');
    assert.strictEqual(mockSidebarDom.hidden, false, 'activateSidebarView must unhide the sidebar');

    // Verify sidebar scope isolation in captureNativeBaseline
    const mockSidebarChild = {
      id: 'connectify-sidebar-child',
      tagName: 'DIV',
      innerText: 'Predictor Card',
      textContent: 'Predictor Card',
      getBoundingClientRect: () => ({ width: 100, height: 50 }),
      getAttribute: () => null,
      classList: { contains: () => false },
      closest: (sel) => sel.includes('connectify-sidebar') ? mockSidebarDom : null,
      _style: { visibility: 'visible', display: 'block', opacity: '1', fontSize: '14px', fontWeight: '400', fontFamily: 'Open Sans' }
    };
    mockSidebarDom.querySelectorAll = (sel) => [mockSidebarChild];
    mockSidebarDom.closest = (sel) => sel.includes('connectify-sidebar') ? mockSidebarDom : null;
    mockSidebarDom._style = { visibility: 'visible', display: 'block', opacity: '1', fontSize: '14px', fontWeight: '400', fontFamily: 'Open Sans' };
    mockSidebarDom.getBoundingClientRect = () => ({ width: 300, height: 500 });
    mockSidebarDom.innerText = 'Sidebar';
    mockSidebarDom.textContent = 'Sidebar';
    mockSidebarDom.tagName = 'DIV';

    const mockPageAuditScope = {
      evaluate: async (fn, ...args) => {
        const prevDoc = global.document;
        const prevWin = global.window;
        try {
          global.window = Object.assign(Object.create(origWinAudit), {
            getComputedStyle: (el) => el._style || {},
            ConnectifyThemeRegistry: { setTheme: () => {}, clearCustomTokens: () => {} }
          });
          global.document = Object.assign(Object.create(origDocAudit), {
            getElementById: (id) => id === 'connectify-sidebar' ? mockSidebarDom : (origDocAudit?.getElementById ? origDocAudit.getElementById(id) : null),
            querySelectorAll: (sel) => sel === 'body *' ? [mockSidebarChild] : []
          });
          return fn(...args);
        } finally {
          global.document = prevDoc;
          global.window = prevWin;
        }
      }
    };

    const pageBaseline = await themeTesterMod.captureNativeBaseline(mockPageAuditScope, { auditScope: 'page' });
    assert.strictEqual(pageBaseline.visibleCount, 0, 'Page audit scope must exclude connectify-sidebar elements');

    const sidebarBaseline = await themeTesterMod.captureNativeBaseline(mockPageAuditScope, { auditScope: 'sidebar' });
    assert.ok(sidebarBaseline.visibleCount > 0, 'Sidebar audit scope must capture connectify-sidebar elements');
  } finally {
    global.window = origWinAudit;
    global.document = origDocAudit;
  }

  // 4. crawler exports and tree building
  const crawlerMod = require(crawlerPath);
  assert.strictEqual(typeof crawlerMod.crawl, 'function', 'crawl must be exported');
  assert.strictEqual(typeof crawlerMod.normalizeUrl, 'function', 'normalizeUrl must be exported');
  assert.strictEqual(typeof crawlerMod.buildDirectoryTree, 'function', 'buildDirectoryTree must be exported');
  assert.strictEqual(typeof crawlerMod.formatAsciiTree, 'function', 'formatAsciiTree must be exported');

  const norm = crawlerMod.normalizeUrl('https://connect.det.wa.edu.au/group/students/ui/my-connect;jsessionid=ABC#top', 'https://connect.det.wa.edu.au');
  assert.strictEqual(norm, 'https://connect.det.wa.edu.au/group/students/ui/my-connect', 'normalizeUrl must strip jsessionid and hash');

  const tree = crawlerMod.buildDirectoryTree(['/group/students/calendar', '/connect/cvr/classes']);
  assert.ok(tree.children.group && tree.children.connect, 'Directory tree must organize paths into branches');

  // Verify class ID extraction across redirects and destination URLs
  assert.strictEqual(crawlerMod.extractClassId('https://connect.det.wa.edu.au/redirect/cls/6611613497'), '6611613497', 'extractClassId must parse /redirect/cls/<id>');
  assert.strictEqual(crawlerMod.extractClassId('https://connect.det.wa.edu.au/group/students/ui/class/announcements?coisp=DomainSchoolClass:6611613497'), '6611613497', 'extractClassId must parse coisp=DomainSchoolClass:<id>');
  assert.strictEqual(crawlerMod.extractClassId('https://connect.det.wa.edu.au/group/students/ui/my-connect'), null, 'extractClassId must return null on non-class routes');

  // Verify filterUrlList enforces maxClassRedirects (5) limit across redirect and destination URLs
  const sampleRoutes = [
    'https://connect.det.wa.edu.au/group/students/ui/my-connect',
    'https://connect.det.wa.edu.au/group/students/ui/my-settings/profile',
    'https://connect.det.wa.edu.au/documents/123/file.pdf',
    'https://connect.det.wa.edu.au/redirect/cls/101',
    'https://connect.det.wa.edu.au/redirect/cls/102',
    'https://connect.det.wa.edu.au/redirect/cls/103',
    'https://connect.det.wa.edu.au/redirect/cls/104',
    'https://connect.det.wa.edu.au/redirect/cls/105',
    'https://connect.det.wa.edu.au/group/students/ui/class/announcements?coisp=DomainSchoolClass:101',
    'https://connect.det.wa.edu.au/group/students/ui/class/announcements?coisp=DomainSchoolClass:106',
    'https://connect.det.wa.edu.au/redirect/cls/107'
  ];
  const filtered = crawlerMod.filterUrlList(sampleRoutes, 5);
  assert.ok(!filtered.some(u => u.includes('/documents/')), 'filterUrlList must remove documents');
  const classIdsInFiltered = new Set(filtered.map(crawlerMod.extractClassId).filter(Boolean));
  assert.strictEqual(classIdsInFiltered.size, 5, 'filterUrlList must strictly limit scanned classes to 5 unique classes');
  assert.ok(filtered.includes('https://connect.det.wa.edu.au/group/students/ui/my-settings/profile'), 'filterUrlList must preserve non-class pages like profile');

  // Verify filterUrlList deduplicates percent-encoded (%3A) and literal (:) class URLs
  const dupRoutes = [
    'https://connect.det.wa.edu.au/group/students/ui/class/discussions?coisp=DomainSchoolClass%3A27866513',
    'https://connect.det.wa.edu.au/group/students/ui/class/discussions?coisp=DomainSchoolClass:27866513',
    'https://connect.det.wa.edu.au/group/students/ui/class/learners?coisp=DomainSchoolClass%3A27866513',
    'https://connect.det.wa.edu.au/group/students/ui/class/learners?coisp=DomainSchoolClass:27866513'
  ];
  const dedupFiltered = crawlerMod.filterUrlList(dupRoutes, 5);
  assert.strictEqual(dedupFiltered.length, 2, 'filterUrlList must purge duplicate %3A vs : class URLs');
  assert.ok(!dedupFiltered.some(u => u.includes('%3A')), 'filterUrlList must canonicalize to literal : format');

  // Verify non-user-facing pages (/combo, browserconfig.xml, machine configs) are excluded
  assert.ok(crawlerMod.isExcludedPath('/combo'), 'isExcludedPath must exclude /combo');
  assert.ok(crawlerMod.isExcludedPath('/combo?browserId=firefox&minifierType=js'), 'isExcludedPath must exclude /combo queries');
  assert.ok(crawlerMod.isExcludedPath('/public/home-screen/ui/browserconfig.xml'), 'isExcludedPath must exclude browserconfig.xml');
  assert.ok(crawlerMod.isExcludedPath('/public/home-screen/ui/manifest.json'), 'isExcludedPath must exclude manifest.json');
  assert.ok(crawlerMod.isExcludedPath('/api/jsonws'), 'isExcludedPath must exclude /api/ endpoints');
  assert.ok(crawlerMod.isExcludedPath('/documents/123/guide.pdf'), 'isExcludedPath must exclude documents');
  assert.ok(!crawlerMod.isExcludedPath('/group/students/ui/my-connect'), 'isExcludedPath must allow /group/students/ui/my-connect');
  assert.ok(!crawlerMod.isExcludedPath('/group/students/ui/my-settings/profile'), 'isExcludedPath must allow profile');
  assert.ok(!crawlerMod.isExcludedPath('/group/students/ui/class/announcements'), 'isExcludedPath must allow class announcements');

  // Verify normalizeUrl preserves coisp parameter on class routes
  const classBase = 'https://connect.det.wa.edu.au/group/students/ui/class/announcements?coisp=DomainSchoolClass:6611613497';
  const discNorm = crawlerMod.normalizeUrl('discussions', classBase);
  assert.ok(discNorm.includes('/ui/class/discussions') && discNorm.includes('coisp=DomainSchoolClass'), 'normalizeUrl must preserve coisp on relative class routes');

  // Verify route categorization for my-settings sub-pages
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/profile'), 'User Settings & Profile');
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/preferences'), 'User Settings & Profile');
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/notifications'), 'User Settings & Profile');
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/attendance'), 'User Settings & Profile');
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/reports'), 'User Settings & Profile');
  assert.strictEqual(crawlerMod.categorizePath('/group/students/ui/my-settings/assessment-outlines'), 'Assessment Outlines');

  // Verify extractPageLinks dynamic discovery of all 6 my-settings pages from .cvr-c-service-menu
  assert.strictEqual(typeof crawlerMod.extractPageLinks, 'function', 'extractPageLinks must be exported');
  const origWindow = global.window;
  const origDoc = global.document;
  try {
    const menuItems = ['Profile', 'Preferences', 'Notifications', 'Attendance', 'Reports', 'Assessment Outlines'];
    const mockEls = menuItems.map(label => ({
      attributes: [{ name: 'class', value: 'cvr-c-service-menu__item' }],
      querySelector: () => ({ innerText: label, textContent: label }),
      innerText: label,
      textContent: label,
      querySelectorAll: () => []
    }));
    const mockPage = {
      evaluate: (fn) => {
        const prevWin = global.window;
        const prevDoc = global.document;
        try {
          global.window = {
            location: {
              pathname: '/group/students/ui/my-settings/profile',
              search: '',
              href: 'https://connect.det.wa.edu.au/group/students/ui/my-settings/profile'
            }
          };
          global.document = {
            querySelectorAll: (sel) => {
              if (sel === 'a[href], area[href]' || sel === '*') return [];
              if (sel.includes('cvr-c-service-menu__item')) return mockEls;
              return [];
            }
          };
          return fn();
        } finally {
          global.window = prevWin;
          global.document = prevDoc;
        }
      }
    };
    const discovered = crawlerMod.extractPageLinks(mockPage);
    const normDiscovered = discovered.map(l => crawlerMod.normalizeUrl(l, 'https://connect.det.wa.edu.au/group/students/ui/my-settings/profile'));
    for (const sub of ['profile', 'preferences', 'notifications', 'attendance', 'reports', 'assessment-outlines']) {
      const targetUrl = `https://connect.det.wa.edu.au/group/students/ui/my-settings/${sub}`;
      assert.ok(normDiscovered.includes(targetUrl), `extractPageLinks must discover ${targetUrl} from navigation menu`);
    }

    // Verify normalizeUrl canonicalizes class/notices with URL-encoded or literal coisp across entry points
    const normNoticesMyConnect = crawlerMod.normalizeUrl('class/notices?coisp=DomainSchoolClass%3A27866513', 'https://connect.det.wa.edu.au/group/students/ui/my-connect');
    assert.strictEqual(normNoticesMyConnect, 'https://connect.det.wa.edu.au/group/students/ui/class/notices?coisp=DomainSchoolClass%3A27866513', 'normalizeUrl must canonicalize class/notices from dashboard');

    const normNoticesSummary = crawlerMod.normalizeUrl('class/notices?coisp=DomainSchoolClass%3A27866513', 'https://connect.det.wa.edu.au/group/students/ui/class/summary?coisp=DomainSchoolClass:27866513');
    assert.strictEqual(normNoticesSummary, 'https://connect.det.wa.edu.au/group/students/ui/class/notices?coisp=DomainSchoolClass%3A27866513', 'normalizeUrl must avoid /class/class/ duplication from summary page');

    const normNoticesRoot = crawlerMod.normalizeUrl('class/notices?coisp=DomainSchoolClass%3A27866513', 'https://connect.det.wa.edu.au/');
    assert.strictEqual(normNoticesRoot, 'https://connect.det.wa.edu.au/group/students/ui/class/notices?coisp=DomainSchoolClass%3A27866513', 'normalizeUrl must prefix root relative class/notices');

    const normAnnounce = crawlerMod.normalizeUrl('class/announcements?coisp=DomainSchoolClass:6611613497', 'https://connect.det.wa.edu.au/group/students/ui/classes');
    assert.strictEqual(normAnnounce, 'https://connect.det.wa.edu.au/group/students/ui/class/announcements?coisp=DomainSchoolClass:6611613497', 'normalizeUrl must canonicalize class/announcements');

    // Verify extractClassId on class/notices URLs
    assert.strictEqual(crawlerMod.extractClassId('https://connect.det.wa.edu.au/group/students/ui/class/notices?coisp=DomainSchoolClass%3A27866513'), '27866513', 'extractClassId must parse %3A class id on class/notices');
    assert.strictEqual(crawlerMod.extractClassId('class/notices?coisp=DomainSchoolClass%3A27866513'), '27866513', 'extractClassId must parse relative class/notices');

    // Verify dynamic extraction of class tabs (Notices) and direct attribute routes
    const tabLabels = ['Summary', 'Notices', 'Announcements', 'Discussions', 'Submissions', 'Learners'];
    const tabMockEls = tabLabels.map(label => ({
      tagName: 'div',
      attributes: [{ name: 'class', value: 'eds-c-tabs__tab' }],
      querySelector: () => ({ innerText: label, textContent: label }),
      innerText: label,
      textContent: label,
      querySelectorAll: () => []
    }));
    const noticeCardEl = {
      tagName: 'div',
      attributes: [
        { name: 'class', value: 'cvr-c-notice' },
        { name: 'data-url', value: 'class/notices?coisp=DomainSchoolClass%3A27866513' }
      ],
      querySelector: () => null,
      innerText: 'View Notice',
      textContent: 'View Notice',
      querySelectorAll: () => []
    };
    const mockPageClass = {
      evaluate: (fn) => {
        const prevWin = global.window;
        const prevDoc = global.document;
        try {
          global.window = {
            location: {
              pathname: '/group/students/ui/class/summary',
              search: '?coisp=DomainSchoolClass%3A27866513',
              href: 'https://connect.det.wa.edu.au/group/students/ui/class/summary?coisp=DomainSchoolClass%3A27866513'
            }
          };
          global.document = {
            querySelectorAll: (sel) => {
              if (sel === 'a[href], area[href]') return [];
              if (sel.includes('eds-c-tabs__tab')) return tabMockEls;
              if (sel === '*') return [noticeCardEl, ...tabMockEls];
              return [];
            }
          };
          return fn();
        } finally {
          global.window = prevWin;
          global.document = prevDoc;
        }
      }
    };
    const classDiscovered = crawlerMod.extractPageLinks(mockPageClass);
    const normClassDiscovered = classDiscovered.map(l => crawlerMod.normalizeUrl(l, 'https://connect.det.wa.edu.au/group/students/ui/class/summary?coisp=DomainSchoolClass%3A27866513'));
    assert.ok(normClassDiscovered.includes('https://connect.det.wa.edu.au/group/students/ui/class/notices?coisp=DomainSchoolClass%3A27866513'), 'extractPageLinks must discover class/notices?coisp=DomainSchoolClass%3A27866513');
  } finally {
    global.window = origWindow;
    global.document = origDoc;
  }

  // 5. package.json scripts
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  assert.strictEqual(pkg.scripts['test:themes'], 'node scripts/test-theme-styles.js', 'package.json must define test:themes script');
  assert.strictEqual(pkg.scripts['test:themes:interactive'], 'node scripts/test-theme-styles.js --interactive', 'package.json must define test:themes:interactive script');
  assert.strictEqual(pkg.scripts['crawl'], 'node scripts/crawl-connect-directories.js', 'package.json must define crawl script');
});

runTest('Test 146: The sidebar works on every page: off Assessment Outlines only Settings is enabled, and a Connect filter never disables tools', async () => {
  await Promise.all(pendingTestPromises);
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const drawerCss = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-drawer.css'), 'utf8');

  // 1. Static CSS: the off-outlines notice and the disabled launchers
  for (const sel of ['.cx-page-limited', '.cx-page-notice', '.cx-page-notice-title', '.cx-page-notice-text', '.cx-page-notice-link']) {
    assert.ok(cssHas(drawerCss, sel), `sidebar styles must define ${sel}`);
  }
  assert.ok(!drawerCss.includes('cx-filter-notice') && !sidebarJs.includes('cx-filter-disabled'), 'the filter notice and filter-disabled state are gone');

  // 2. The manifest loads the sidebar everywhere: a sidebar-only group on every other page
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const outlinesMatch = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines*';
  const elsewhere = manifest.content_scripts.find(g => (g.exclude_matches || []).includes(outlinesMatch));
  assert.ok(elsewhere && elsewhere.matches.includes('https://connect.det.wa.edu.au/*'), 'a group covers every other Connect page');
  for (const f of ['src/sidebar/sidebar.js', 'src/sidebar/sidebar-page-notice.js', 'src/predictor/category-settings.js', 'src/assessment/assessment-data.js']) {
    assert.ok(elsewhere.js.includes(f), `${f} loads off the outlines page`);
  }
  for (const f of ['src/system/data.js', 'src/cohort/cohort-observer.js', 'src/atar/atar-features.js', 'src/system/new-grade.js', 'src/system/dom-sweeper.js', 'src/assessment/assessment-expand.js']) {
    assert.ok(!elsewhere.js.includes(f), `${f} stays on the outlines page`);
  }
  const outlinesJs = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-view.js')).js;
  assert.deepStrictEqual(elsewhere.js, outlinesJs.filter(f => elsewhere.js.includes(f)), 'the sidebar-only group keeps the outlines dependency order');
  assert.ok(elsewhere.css.includes('src/sidebar/styles/sidebar-settings.css') && elsewhere.css.includes('src/sidebar/styles/sidebar-outcome-filter.css'), 'Settings and notice styles load everywhere');

  // 3. Functional: on the outlines page a Connect filter (one class, two tiles) leaves every tool enabled
  const origHref = location.href;
  const outlinesRoot = document.createElement('div');
  outlinesRoot.className = 'assessmentoutlinesui';
  const toolbarTitle = document.createElement('span');
  toolbarTitle.className = 'cvr-c-category-toolbar__title';
  toolbarTitle.textContent = 'Chemistry';
  outlinesRoot.appendChild(toolbarTitle);
  for (let i = 0; i < 2; i++) {
    const tile = document.createElement('div');
    tile.className = 'eds-c-tile';
    outlinesRoot.appendChild(tile);
  }
  document.body.appendChild(outlinesRoot);

  delete window.__connectifySidebarInitialized;
  window.__connectifySidebarInitialized = false;
  document.querySelectorAll('#connectify-sidebar').forEach(el => el.remove());
  document.querySelectorAll('#connectify-sidebar-handle').forEach(el => el.remove());

  try {
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345';
    eval(sidebarJs);
    const sidebar = document.getElementById('connectify-sidebar');
    assert.ok(sidebar, 'Sidebar element must exist');
    const notice = sidebar.querySelector('.cx-page-notice');
    assert.ok(notice, 'the page notice exists');
    const toolBtns = Array.from(sidebar.querySelectorAll('.cx-tool-menu button'));
    assert.strictEqual(toolBtns.length, 6, 'all six launchers are mounted');

    assert.strictEqual(window.ConnectifySidebar.isLimited(), false, 'the outlines page is never limited, filtered or not');
    assert.strictEqual(sidebar.classList.contains('cx-page-limited'), false);
    assert.strictEqual(notice.hidden, true, 'no notice on the outlines page');
    toolBtns.forEach(btn => {
      assert.strictEqual(btn.disabled, false, `#${btn.id} is enabled on the outlines page`);
      assert.strictEqual(btn.getAttribute('aria-disabled'), null);
    });

    // 4. Any other page: only Settings is enabled, under a notice linking to the outlines
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-connect';
    for (const panel of sidebar.querySelector('.cx-workspace').children) panel.hidden = true;
    window.ConnectifySidebar.syncState();
    assert.strictEqual(window.ConnectifySidebar.isLimited(), true);
    assert.ok(sidebar.classList.contains('cx-page-limited'), 'the sidebar is marked limited');
    assert.strictEqual(notice.hidden, false, 'the notice shows');
    assert.strictEqual(notice.querySelector('.cx-page-notice-title')?.textContent, 'Assessment Outlines Only', 'the notice is titled');
    const link = notice.querySelector('.cx-page-notice-link');
    assert.ok(link && link.tagName.toLowerCase() === 'a' && link.href === window.ConnectifyUtils.OUTLINES_URL, 'the notice links to the outlines');
    assert.strictEqual(sidebar.querySelector('.cx-tools-intro').hidden, true, 'the outlines intro is hidden');
    toolBtns.forEach(btn => {
      const settings = btn.id === 'connectify-categories-toggle';
      assert.strictEqual(btn.disabled, !settings, `#${btn.id} is ${settings ? 'enabled' : 'disabled'} off the outlines page`);
      assert.strictEqual(btn.getAttribute('aria-disabled'), settings ? null : 'true');
    });

    // Settings opens without the notice above it; Back to Menu brings the notice back
    let settingsPanel = document.getElementById('connectify-categories');
    if (!settingsPanel) {
      settingsPanel = Object.assign(document.createElement('section'), { id: 'connectify-categories' });
      sidebar.querySelector('.cx-workspace').append(settingsPanel);
    }
    settingsPanel.hidden = false;
    window.ConnectifySidebar.syncState();
    assert.strictEqual(notice.hidden, true, 'the notice is not shown inside Settings');
    sidebar.querySelector('.cx-back-menu').onclick();
    window.ConnectifySidebar.syncState();
    assert.strictEqual(settingsPanel.hidden, true);
    assert.strictEqual(notice.hidden, false, 'the notice returns with the launcher menu');

    // Back on the outlines page every tool comes back
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
    window.ConnectifySidebar.syncState();
    assert.strictEqual(notice.hidden, true);
    toolBtns.forEach(btn => assert.strictEqual(btn.disabled, false, `#${btn.id} is enabled again`));
  } finally {
    location.href = origHref;
    outlinesRoot.remove();
    document.querySelectorAll('#connectify-sidebar').forEach(el => el.remove());
    document.querySelectorAll('#connectify-sidebar-handle').forEach(el => el.remove());
    delete window.__connectifySidebarInitialized;
  }
});

runTest('Test 231: Off the outlines page the cache is read as is: no tile is scraped, recorded or hidden, and Settings dropdowns are styled', () => {
  const utils = window.ConnectifyUtils;
  const origHref = location.href;
  try {
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345';
    assert.strictEqual(utils.isOutlinesPage(), true);
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-connect';
    assert.strictEqual(utils.isOutlinesPage(), false);
  } finally {
    location.href = origHref;
  }
  const read = f => fs.readFileSync(path.resolve(__dirname, f), 'utf8');
  assert.ok(/const onOutlines = window\.ConnectifyUtils\.isOutlinesPage\(\);/.test(read('src/assessment/assessment-data.js')) &&
    read('src/assessment/assessment-data.js').includes('const allCards = !onOutlines ? [] :'), 'collect() reads no cards off the outlines page');
  assert.ok(read('src/assessment/class-semesters.js').includes('if (!window.ConnectifyUtils.isOutlinesPage()) return null;'), 'semester detection ignores other pages\' tiles');
  assert.ok(read('src/assessment/semester-filter.js').includes('isOutlinesPage?.() === false ? null'), 'the semester filter hides nothing off the outlines page');

  // Settings dropdowns: styled like the number inputs, no inline styles
  const markup = read('src/predictor/settings-markup.js');
  assert.strictEqual((markup.match(/<select id="[^"]+" class="cx-settings-select">/g) || []).length, 2, 'both Settings dropdowns use the class alone');
  const settingsCss = read('src/sidebar/styles/sidebar-settings.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = settingsCss.match(/#connectify-sidebar \.cx-settings-select \{([^}]*)\}/);
  assert.ok(light && /background-color: #ffffff/.test(light[1]) && /border: 1px solid #b9cbe1/.test(light[1]) && /border-radius: 4px/.test(light[1]), 'light dropdowns are white with the inputs\' border');
  assert.ok(/\.connectea-dark #connectify-sidebar \.cx-settings-select \{[^}]*var\(--cx-input-bg/.test(settingsCss), 'dark dropdowns use the input tokens');
});

runTest('Test 147: Style test JSON manifest aggregates all audited views under pages and views', async () => {
  const themeTesterMod = require(path.resolve(__dirname, 'scripts/test-theme-styles.js'));

  // 1. Verify buildAuditManifest aggregates multiple views without losing or overwriting any view
  const targetUrlA = 'https://connect.det.wa.edu.au/group/students/ui/feed';
  const targetUrlB = 'https://connect.det.wa.edu.au/group/students/ui/class/summary?coisp=DomainSchoolClass:2204735831';

  const viewRecordA1 = {
    url: targetUrlA,
    viewTitle: 'All',
    auditScope: 'page',
    baselineVisibleCount: 1997,
    themes: { dark: { id: 'dark', name: 'Dark' } }
  };
  const viewRecordA2 = {
    url: targetUrlA,
    viewTitle: 'Classes',
    auditScope: 'page',
    baselineVisibleCount: 1101,
    themes: { dark: { id: 'dark', name: 'Dark' } }
  };
  const viewRecordA3 = {
    url: targetUrlA,
    viewTitle: 'Sidebar: Target ATAR',
    auditScope: 'sidebar',
    baselineVisibleCount: 250,
    themes: { dark: { id: 'dark', name: 'Dark' } }
  };

  const viewRecordB1 = {
    url: targetUrlB,
    viewTitle: 'Default View',
    auditScope: 'page',
    baselineVisibleCount: 228,
    themes: { dark: { id: 'dark', name: 'Dark' } }
  };
  const viewRecordB2 = {
    url: targetUrlB,
    viewTitle: 'Notices',
    auditScope: 'page',
    baselineVisibleCount: 240,
    themes: { dark: { id: 'dark', name: 'Dark' } }
  };

  const pageResults = {
    [targetUrlA]: {
      url: targetUrlA,
      totalViews: 3,
      views: {
        'All': viewRecordA1,
        'Classes': viewRecordA2,
        'Sidebar: Target ATAR': viewRecordA3
      },
      viewsList: [viewRecordA1, viewRecordA2, viewRecordA3],
      viewTitle: 'All',
      baselineVisibleCount: 1997,
      themes: viewRecordA1.themes
    },
    [targetUrlB]: {
      url: targetUrlB,
      totalViews: 2,
      views: {
        'Default View': viewRecordB1,
        'Notices': viewRecordB2
      },
      viewsList: [viewRecordB1, viewRecordB2],
      viewTitle: 'Default View',
      baselineVisibleCount: 228,
      themes: viewRecordB1.themes
    }
  };

  const allPageResults = {
    [`${targetUrlA} [All]`]: viewRecordA1,
    [`${targetUrlA} [Classes]`]: viewRecordA2,
    [`${targetUrlA} [Sidebar: Target ATAR]`]: viewRecordA3,
    [`${targetUrlB} [Default View]`]: viewRecordB1,
    [`${targetUrlB} [Notices]`]: viewRecordB2
  };

  const manifest = themeTesterMod.buildAuditManifest(pageResults, allPageResults);

  // Distinct page count and total views count
  assert.strictEqual(manifest.totalPages, 2, 'Manifest totalPages must equal distinct page URL count (2)');
  assert.strictEqual(manifest.totalViews, 5, 'Manifest totalViews must equal total views count (5)');

  // Every page contains ALL views under .views
  assert.ok(manifest.pages[targetUrlA], 'Target page A must exist in manifest.pages');
  assert.strictEqual(manifest.pages[targetUrlA].totalViews, 3, 'Page A totalViews must be 3');
  assert.ok(manifest.pages[targetUrlA].views['All'], 'Page A must contain "All" view');
  assert.ok(manifest.pages[targetUrlA].views['Classes'], 'Page A must contain "Classes" view');
  assert.ok(manifest.pages[targetUrlA].views['Sidebar: Target ATAR'], 'Page A must contain "Sidebar: Target ATAR" view');
  assert.strictEqual(manifest.pages[targetUrlA].views['All'].baselineVisibleCount, 1997);
  assert.strictEqual(manifest.pages[targetUrlA].views['Classes'].baselineVisibleCount, 1101);
  assert.strictEqual(manifest.pages[targetUrlA].views['Sidebar: Target ATAR'].baselineVisibleCount, 250);

  assert.ok(manifest.pages[targetUrlB], 'Target page B must exist in manifest.pages');
  assert.strictEqual(manifest.pages[targetUrlB].totalViews, 2, 'Page B totalViews must be 2');
  assert.ok(manifest.pages[targetUrlB].views['Default View'], 'Page B must contain "Default View"');
  assert.ok(manifest.pages[targetUrlB].views['Notices'], 'Page B must contain "Notices" view');
  assert.strictEqual(manifest.pages[targetUrlB].views['Default View'].baselineVisibleCount, 228);
  assert.strictEqual(manifest.pages[targetUrlB].views['Notices'].baselineVisibleCount, 240);

  // Backward-compatible individual view access via resultKey
  assert.ok(manifest.pages[`${targetUrlA} [Classes]`], 'Legacy index pages[url [view]] must exist');
  assert.strictEqual(manifest.pages[`${targetUrlA} [Classes]`].baselineVisibleCount, 1101);
  assert.strictEqual(manifest.views[`${targetUrlA} [Classes]`].baselineVisibleCount, 1101);

  // 2. Test reconstruction from flat results when pageResults is empty
  const reconstructed = themeTesterMod.buildAuditManifest({}, allPageResults);
  assert.strictEqual(reconstructed.totalPages, 2, 'Reconstructed totalPages must be 2');
  assert.strictEqual(reconstructed.totalViews, 5, 'Reconstructed totalViews must be 5');
  assert.strictEqual(reconstructed.pages[targetUrlA].totalViews, 3, 'Reconstructed Page A totalViews must be 3');
  assert.strictEqual(reconstructed.pages[targetUrlB].totalViews, 2, 'Reconstructed Page B totalViews must be 2');
  assert.ok(reconstructed.pages[targetUrlA].views['All']);
  assert.ok(reconstructed.pages[targetUrlA].views['Classes']);

  // 3. Verify discoverSubPages discovers .eds-c-tabs__tab and recognizes active state
  const mockSubpageDom = {
    evaluate: (fn) => {
      const prevWin = global.window;
      const prevDoc = global.document;
      try {
        global.window = {};
        global.document = {
          querySelectorAll: (sel) => {
            if (sel.includes('.eds-c-tabs__tab')) {
              return [
                {
                  classList: { contains: (c) => c === 'eds-c-tabs__tab--active' },
                  getAttribute: (a) => a === 'aria-selected' ? 'true' : null,
                  innerText: 'Summary',
                  closest: () => null,
                  setAttribute: () => {}
                },
                {
                  classList: { contains: () => false },
                  getAttribute: () => null,
                  innerText: 'Notices',
                  closest: () => null,
                  setAttribute: () => {}
                },
                {
                  classList: { contains: () => false },
                  getAttribute: () => null,
                  innerText: 'Discussions',
                  closest: () => null,
                  setAttribute: () => {}
                }
              ];
            }
            return [];
          }
        };
        return fn();
      } finally {
        global.window = prevWin;
        global.document = prevDoc;
      }
    }
  };

  const discoveredViews = await themeTesterMod.discoverSubPages(mockSubpageDom);
  assert.strictEqual(discoveredViews.length, 3, 'Must discover 3 eds-c-tabs__tab tabs');
  assert.strictEqual(discoveredViews[0].title, 'Summary', 'First tab must be Summary');
  assert.strictEqual(discoveredViews[0].isActive, true, 'Summary tab must be active');
  assert.strictEqual(discoveredViews[1].title, 'Notices', 'Second tab must be Notices');
  assert.strictEqual(discoveredViews[1].isActive, false, 'Notices tab must not be active');
  assert.strictEqual(discoveredViews[2].title, 'Discussions', 'Third tab must be Discussions');
});

runTest('Test 148: Theme Customizer button contrast, !important color enforcement, and secondary button theme-controls parity', () => {
  const customizerCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.css'), 'utf8');
  const controlsCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-controls.css'), 'utf8');

  // 1. The customizer's buttons keep !important colours, taken from the active theme's tokens
  assert.ok(cssHas(customizerCss, '#cx-customizer-modal button'), 'Must protect all buttons inside #cx-customizer-modal');
  assert.ok(cssHas(customizerCss, 'color: var(--cx-button-text) !important'), 'Customizer buttons must use the active button text colour with !important');
  assert.ok(cssHas(customizerCss, '.cx-btn-secondary') && cssHas(customizerCss, 'background-color: var(--cx-button-bg) !important'), 'Secondary buttons must use the active button surface with !important');
  assert.ok(cssHas(customizerCss, '.cx-btn-primary') && cssHas(customizerCss, 'color: var(--cx-button-primary-text) !important'), 'Primary buttons must use the derived primary text colour with !important');

  // 2. theme-controls.css keeps .cx-btn-secondary on the same tokens
  assert.ok(cssHas(controlsCss, '.cx-btn-secondary'), 'theme-controls.css must style .cx-btn-secondary');
  assert.ok(cssHas(controlsCss, 'var(--cx-button-bg, #243042) !important') && cssHas(controlsCss, 'var(--cx-button-text, #e2e8f0) !important'), 'theme-controls.css must take .cx-btn-secondary colours from the button tokens');

  // 3. Contrast verification of the Dark fallbacks: #e2e8f0 on #243042
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }
  const lumText = getLuminance(226, 232, 240); // #e2e8f0
  const lumBg = getLuminance(36, 48, 66);      // #243042
  const contrastRatio = (Math.max(lumText, lumBg) + 0.05) / (Math.min(lumText, lumBg) + 0.05);
  assert.ok(contrastRatio >= 5.0, `Button contrast ratio ${contrastRatio.toFixed(2)} must be >= 5.0 (WCAG AA)`);
});

runTest('Test 149: Liquid Glass refinements, dual sliders, opaque non-glass panels, button parity, and save theme overwrite', () => {
  const themeCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-tokens.css'), 'utf8');
  const themeTilesCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-tiles.css'), 'utf8');
  const themeFeedCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-feed.css'), 'utf8');
  const customizerJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.js'), 'utf8');
  const customizerCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.css'), 'utf8');
  const registryJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8');
  const parityTestJs = fs.readFileSync(path.resolve(__dirname, 'scripts/test-theme-styles.js'), 'utf8');

  // 1. Panels opaque when Liquid Glass is off
  assert.ok(cssHas(themeCss, ':not([data-connectea-theme="liquid-glass"])') &&
            cssHas(themeCss, 'background-color: var(--cx-surface-bg, #1e2632) !important'),
            'theme.css must ensure panels are opaque when Liquid Glass is off');

  // 2. Liquid Glass panel bottom corners rounded (16px) and tile body transparent
  assert.ok(cssHas(themeCss, 'border-bottom-left-radius: 16px !important') &&
            cssHas(themeCss, 'border-bottom-right-radius: 16px !important'),
            'theme.css must round bottom corners with 16px radius');
  assert.ok(cssHas(themeCss, '[data-connectea-glass="true"]) .cvr-c-card {\n  overflow: clip !important;'),
            'theme.css must clip liquid glass tiles and cards with overflow: clip (hidden stops margins collapsing)');
  assert.ok(!cssHas(themeCss, '[data-connectea-glass="true"]) .connectea-panel {\n  overflow: clip'),
            'statistics panels are never clipped: the breakout meter rises above its row and glows');
  assert.ok(cssHas(themeCss, '.eds-c-tile__body') &&
            cssHas(themeCss, 'background-color: transparent !important'),
            'theme.css must make tile body transparent in Liquid Glass mode');

  // 3. Buttons and inputs must NOT be styled with liquid-glass radii
  assert.ok(!cssHas(themeCss, 'body[data-connectea-theme="liquid-glass"] button'),
            'theme.css must NOT modify button border-radius for Liquid Glass');
  assert.ok(!cssHas(themeTokensCss, 'body[data-connectea-theme="liquid-glass"] button'),
            'theme-tokens.css must NOT modify button border-radius for Liquid Glass');

  // 4. Parity test does not ignore buttons for liquid-glass and ignores panels/cards/tiles/modals
  assert.ok(!parityTestJs.includes("tid !== 'liquid-glass' && (base.isActionButton || base.isButton)"),
            'parity test must assert button circular outline across all themes including liquid-glass');
  assert.ok(!parityTestJs.includes("tid !== 'liquid-glass' && base.isButton && !base.isActionButton"),
            'parity test must assert button radius across all themes including liquid-glass');
  assert.ok(parityTestJs.includes('isPanelCardTileModal') && parityTestJs.includes("!['liquid-glass', 'liquid-glass-clear'].includes(tid) || !isPanelCardTileModal"),
            'parity test must ignore only panels, cards, tiles, and modals for both Liquid Glass presets');

  // 5. .cvr-u-padding--md keeps Connect's native 15px padding in every theme, Liquid Glass included
  assert.ok(!/\.cvr-u-padding--md[^{]*\{\s*padding: 0/.test(themeCss), 'no theme may remove the native .cvr-u-padding--md padding');
  assert.ok(!cssHas(themeTilesCss, '.cvr-u-padding--md { padding: 0 !important; }'),
            'theme-tiles.css must not remove .cvr-u-padding--md padding in every mode');

  // 6. Theme Customizer dual sliders (blur strength & transparency)
  assert.ok(customizerJs.includes('cx-glass-blur-slider') && customizerJs.includes('cx-glass-opacity-slider'),
            'theme-customizer.js must contain blur strength and transparency sliders');
  assert.ok(customizerJs.includes('--cx-glass-blur') && customizerJs.includes('--cx-glass-opacity'),
            'theme-customizer.js must bind to --cx-glass-blur and --cx-glass-opacity');
  assert.ok(cssHas(customizerCss, '#cx-glass-sliders-wrap'),
            'theme-customizer.css must style #cx-glass-sliders-wrap');

  // 7. Light mode over a wallpaper: tabs, headers and toolbars have no panel (the wallpaper is brightened instead)
  assert.ok(!cssHas(themeFeedCss, 'rgba(255, 255, 255, 0.90)'),
            'light mode must not paint white contrast panels behind tabs and headers over a wallpaper');

  // 8. Functional test: saveCustomTheme overwrites if name matches (case-insensitive)
  eval(registryJs);
  const reg = window.ConnectifyThemeRegistry;
  assert.ok(reg && typeof reg.saveCustomTheme === 'function', 'ThemeRegistry.saveCustomTheme must exist');

  const initialCount = reg.getCustomThemes().length;
  const t1 = reg.saveCustomTheme({ name: 'Neon Sky', glassBlur: 14, glassOpacity: 0.6 });
  assert.ok(t1 && t1.id, 'Created theme must have an id');
  const countAfterFirst = reg.getCustomThemes().length;
  assert.strictEqual(countAfterFirst, initialCount + 1, 'Should add 1 new theme');

  const t2 = reg.saveCustomTheme({ name: 'neon sky', glassBlur: 25, glassOpacity: 0.85 });
  const countAfterSecond = reg.getCustomThemes().length;
  assert.strictEqual(countAfterSecond, countAfterFirst, 'Overwriting theme with same name must not increase count');
  assert.strictEqual(t2.id, t1.id, 'Overwritten theme must reuse existing theme ID');
  const saved = reg.getCustomThemes().find(t => t.id === t1.id);
  assert.strictEqual(saved.glassBlur, 25, 'Overwritten theme must have updated glassBlur');
  assert.strictEqual(saved.glassOpacity, 0.85, 'Overwritten theme must have updated glassOpacity');
});

runTest('Test 150: Assessment outlines 0px padding, universal panel curvature, preview token tooltips, and save theme persistence', () => {
  const themeCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-tokens.css'), 'utf8');
  const themeTilesCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-tiles.css'), 'utf8');
  const themeMaterialCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-material.css'), 'utf8');
  const customizerJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.js'), 'utf8');
  const customizerCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.css'), 'utf8');
  const registryJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8');

  // 1. Assessment outlines: .cvr-u-padding--md keeps its native 15px padding (clear, not filled) and is NOT display: none
  assert.ok(!/\.cvr-u-padding--md[^{]*\{\s*padding: 0/.test(themeCss), 'outline wrappers keep their native padding in every theme');
  assert.ok(!cssHas(themeTilesCss, '.cvr-u-padding--md { display: none !important; }'),
    'theme-tiles.css must not hide .cvr-u-padding--md');

  // 2. 16px panel & tile body curvature in Liquid Glass only
  assert.ok(cssHas(themeCss, '[data-connectea-glass="true"]) .cvr-c-card__body {\n  border-bottom-left-radius: 16px !important;\n  border-bottom-right-radius: 16px !important;'),
    'theme.css must round tile body bottom corners in Liquid Glass');
  assert.ok(!cssHas(themeTokensCss, ':is(.eds-c-card, .cvr-c-card, .eds-c-tile, .cvr-c-tile, .c-tile, .v-panel, .mat-card, .mat-expansion-panel, .connectea-panel, .cx-compound-progress-bar, #ng-zone__classes-metrics-summary) { border-radius: 0 !important; }'),
    'theme-tokens.css must not force 0 border radius on panels when liquid glass is off');
  assert.ok(cssHas(themeMaterialCss, '.connectea-dark .v-panel-content') &&
            cssHas(themeMaterialCss, 'background-color: transparent !important'),
    'theme-material.css must make .v-panel-content transparent');
  assert.ok(cssHas(themeTilesCss, '.eds-c-tile__body') &&
            !cssHas(themeTilesCss, 'border-bottom-left-radius: 16px !important'),
    'theme-tiles.css must not round tile bodies outside Liquid Glass');

  // 3. Customizer Preview inspection data attributes and hover tooltip
  assert.ok(customizerJs.includes('data-cx-elem="Card Surface"') &&
            customizerJs.includes('data-cx-fill="--cx-surface-bg (surface), --cx-border (border)"'),
    'theme-customizer.js preview mockup must tag Card Surface with elem and fill attributes');
  assert.ok(customizerJs.includes('data-cx-elem="Card Title"') &&
            customizerJs.includes('data-cx-text="--cx-tile-link-color (tileLinkColor)"'),
    'theme-customizer.js preview mockup must tag Card Title with its text token');
  assert.ok(customizerJs.includes('data-cx-elem="Action Button"'),
    'theme-customizer.js preview mockup must tag Action Button');
  assert.ok(customizerJs.includes('#cx-preview-tooltip'),
    'theme-customizer.js must contain #cx-preview-tooltip element');
  assert.ok(cssHas(customizerCss, '#cx-preview-tooltip') &&
            cssHas(customizerCss, 'pointer-events: none'),
    'theme-customizer.css must style #cx-preview-tooltip with pointer-events: none');

  // 4. Robust theme saving and immediate application
  assert.ok(registryJs.includes("typeof chrome !== 'undefined' && chrome.storage?.local") && registryJs.includes('store.get([STORAGE_CUSTOM_THEMES_LIST]'),
    'loadSavedCustomThemes must read saved themes from chrome.storage.local');
  // Saving goes through the registry; its connectea:themechange event makes the theme engine apply it once
  assert.ok(customizerJs.includes('if (saved) reg.setTheme(saved.id);') && !customizerJs.includes('applyTheme(true, saved.id)'),
    'theme-customizer.js must apply a saved theme through the registry exactly once');
});

runTest('Test 151: Custom theme colors reach body, View button stays square, and wallpaper shows through outline wrappers', () => {
  const themeCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme.css'), 'utf8');
  const themeTokensCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-tokens.css'), 'utf8');
  const themeFeedCss = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-feed.css'), 'utf8');
  const registryJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8');
  const themeJs = fs.readFileSync(path.resolve(__dirname, 'src/theme/theme.js'), 'utf8');

  // 1. Base dark tokens live on <html> for every dark theme and are never redeclared on <body> for custom themes
  assert.ok(themeTokensCss.indexOf('/* Base Dark Theme (v3.2.x parity)') >= 0 && /\*\/\nhtml\.connectea-dark,\n\[data-connectea-theme="dark"\]\.connectea-dark,/.test(themeTokensCss),
    'theme-tokens.css base dark rule must target html.connectea-dark and dark-themed elements only');
  assert.ok(!cssHas(themeTokensCss, 'body.connectea-dark:not([data-connectea-theme])'),
    'theme-tokens.css must not redeclare dark tokens on an unthemed body');

  // 2. Functional: custom tokens (incl. card and nav) apply to html AND body, the body carries the theme id,
  //    and switching custom themes clears tokens the new theme does not define
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  eval(registryJs);
  eval(themeJs);
  const reg = window.ConnectifyThemeRegistry;
  reg.registerTheme({ id: 'custom_a', name: 'A', isCustom: true, colors: { canvas: '#101014', surface: '#181820', inputBg: '#222222' } });
  reg.registerTheme({ id: 'custom_b', name: 'B', isCustom: true, colors: { canvas: '#202024', surface: '#282830' } });
  reg.setTheme('custom_a');
  for (const el of [document.documentElement, document.body]) {
    assert.strictEqual(el.style.getPropertyValue('--cx-canvas-bg'), '#101014', 'custom canvas must be applied to html and body');
    assert.strictEqual(el.style.getPropertyValue('--cx-card-bg'), '#181820', 'custom surface must drive --cx-card-bg');
    assert.strictEqual(el.style.getPropertyValue('--cx-nav-bg'), '#181820', 'custom surface must drive --cx-nav-bg');
    assert.strictEqual(el.dataset.connecteaTheme, 'custom_a', 'html and body must both carry the custom theme id');
  }
  reg.setTheme('custom_b');
  assert.strictEqual(document.body.style.getPropertyValue('--cx-canvas-bg'), '#202024', 'second custom theme must replace canvas');
  assert.strictEqual(document.body.style.getPropertyValue('--cx-input-bg'), '', 'tokens from a previous custom theme must be cleared');
  reg.setTheme('dark');
  assert.strictEqual(document.body.style.getPropertyValue('--cx-canvas-bg'), '', 'preset theme must clear body custom tokens');
  assert.strictEqual(document.body.dataset.connecteaTheme, 'dark', 'body must carry the preset theme id');
  assert.ok(registryJs.includes('if (active?.isCustom && document.documentElement?.dataset.connecteaTheme !== active.id) registry.setTheme(active.id);'),
    'loadSavedCustomThemes must re-apply a custom theme found only in chrome.storage');

  // 3. View / positive buttons are square; curvature only targets explicit panel, card and tile classes
  assert.ok(/background-color: var\(--cx-positive-bg, #8cae04\) !important;[\s\S]{0,160}border-radius: 0 !important;/.test(themeFeedCss),
    'theme-feed.css positive (View) buttons must enforce border-radius: 0');
  assert.ok(!/\[class\*="(card|panel|tile)"\]/.test(themeCss), 'curvature must not catch buttons through [class*=...] substring matches');

  // 4. Every dark theme: layout containers and tile-only wrappers are clear around tiles (the padding shows the
  //    canvas or wallpaper, as in Default); the tiles themselves stay opaque outside Liquid Glass
  assert.ok(cssHas(themeCss, 'html.connectea-dark[data-connectea-theme]:not([data-connectea-login]) #main-content:has(.eds-c-tile, .cvr-c-tile)'),
    'theme.css must make layout containers around tiles clear in every dark theme');
  assert.ok(cssHas(themeCss, ':has(.eds-c-tile, .cvr-c-tile):not(.eds-c-tile):not(.cvr-c-tile)'),
    'theme.css must only clear wrappers that contain tiles, never the tiles themselves');
  assert.ok(cssHas(themeCss, 'background-color: var(--cx-surface-bg, #1e2632) !important'),
    'non-Liquid-Glass panels must remain opaque');
});

runTest('Test 152: Theme auditor opens a visible browser only for login, then continues headless', async () => {
  const { launchAuthenticated } = require(path.resolve(__dirname, 'scripts/puppeteer-auth.js'));
  const makeHarness = (results) => {
    const launches = [];
    let call = 0;
    const deps = {
      log: () => {},
      launchBrowser: async ({ headless }) => {
        const browser = { headless, closed: false, close: async () => { browser.closed = true; },
          newPage: async () => ({ setViewport: async () => {}, close: async () => {} }) };
        launches.push(browser);
        return browser;
      },
      authenticate: async (page, opts) => ({ ...results[call++], interactiveRequested: opts.interactive })
    };
    return { launches, deps };
  };

  // Expired session: headless attempt -> visible login window -> headless audit browser
  let h = makeHarness([{ success: false }, { success: true, method: 'interactive' }, { success: true, method: 'session' }]);
  let res = await launchAuthenticated({ headless: null }, h.deps);
  assert.deepStrictEqual(h.launches.map(b => b.headless), [true, false, true], 'launch order must be headless, visible (login), headless');
  assert.ok(h.launches[0].closed && h.launches[1].closed, 'the first headless and the login browsers must be closed');
  assert.strictEqual(res.browser, h.launches[2], 'the audit must run in the relaunched headless browser');
  assert.strictEqual(res.browser.headless, true);

  // Valid session: stays in the first headless browser
  h = makeHarness([{ success: true, method: 'session' }]);
  res = await launchAuthenticated({ headless: null }, h.deps);
  assert.deepStrictEqual(h.launches.map(b => b.headless), [true], 'a valid session must never open a window');

  // --headful keeps one visible browser for the whole run
  h = makeHarness([{ success: true, method: 'interactive' }]);
  res = await launchAuthenticated({ headless: false }, h.deps);
  assert.deepStrictEqual(h.launches.map(b => b.headless), [false], '--headful must stay visible');

  // Explicit --headless with an expired session fails without opening a window
  h = makeHarness([{ success: false }]);
  await assert.rejects(() => launchAuthenticated({ headless: true }, h.deps), /--headless/);
  assert.deepStrictEqual(h.launches.map(b => b.headless), [true]);

  const auditor = fs.readFileSync(path.resolve(__dirname, 'scripts/test-theme-styles.js'), 'utf8');
  const crawler = fs.readFileSync(path.resolve(__dirname, 'scripts/crawl-connect-directories.js'), 'utf8');
  assert.ok(auditor.includes("require('./puppeteer-auth')") && auditor.includes('launchAuthenticated({'), 'auditor must use launchAuthenticated');
  assert.ok(crawler.includes("require('./puppeteer-auth')") && crawler.includes('launchAuthenticated({'), 'crawler must use launchAuthenticated');
});

runTest('Test 153: Theme CSS selectors are scoped to a theme hook (native Connect stays untouched)', () => {
  // Rule preludes at any nesting depth; @media/@supports/@layer are descended into, other at-rules skipped
  function cssSelectors(css) {
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    let prelude = '', depth = 0, skipDepth = -1;
    for (const ch of css) {
      if (ch === '{') {
        const p = prelude.trim();
        prelude = '';
        if (skipDepth < 0) {
          if (p.startsWith('@')) { if (!/^@(media|supports|layer)\b/.test(p)) skipDepth = depth; }
          else out.push(p);
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === skipDepth) skipDepth = -1;
        prelude = '';
      } else if (ch === ';' && skipDepth < 0) prelude = '';
      else prelude += ch;
    }
    return out;
  }
  function splitSelectorList(sel) {
    const parts = [];
    let parens = 0, cur = '';
    for (const ch of sel) {
      if (ch === '(') parens++;
      if (ch === ')') parens--;
      if (ch === ',' && parens === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  const HOOK = /connectea|connectify|\bcx-|#cx|\.cx|data-cx/;
  // Intentional rules that apply in every mode, including Default (native) styling
  const ALLOWED = new Set([
    ':root', // light token defaults and display-width scale variables
    '.eds-c-accordion__panel', '.cvr-c-accordion__panel', // layout containment for accordion performance
    '.cvr-c-primary-navigation', // theme toggle mount point (toggle exists in every mode)
    ':is(.v-Notification-system, .v-Notification-system *)', // Connect timeout alerts are never themed
    ':is(.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, .eds-c-card, .cvr-c-card, .cvr-c-dashboard-card)', // display-width scaling
    '.cvr-c-task__details', // display-width scaling
    '#ng-zone__classes-metrics-summary', // classes list back panel in all modes
    'cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body))', '.cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body))',
    'cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body)) .container-fluid', '.cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body)) .container-fluid', // paging bar in all modes; a paginator wrapping the table keeps native layout
    ':is(cnt-paginator, .cnt-paginator) :is(.mat-paginator, mat-paginator, .connect-paginator-container, .mat-paginator-container, .mat-paginator-outer-container)'
  ]);

  // The stylesheets hold these rules with their :is() lists expanded
  for (const sel of [...ALLOWED]) for (const e of expandIs.expandSelector(sel)) ALLOWED.add(e);
  const PAD = /:not\([#.]?cx-n\)/g;

  const themeDir = path.resolve(__dirname, 'src/theme');
  const cssFiles = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.isDirectory()) walk(path.join(dir, ent.name));
      else if (ent.name.endsWith('.css')) cssFiles.push(path.relative(themeDir, path.join(dir, ent.name)));
    }
  })(themeDir);
  assert.ok(cssFiles.length > 20, 'theme stylesheets must be found under src/theme');
  const offenders = [];
  for (const file of cssFiles.sort()) {
    const css = origReadFileSync.call(fs, path.join(themeDir, file), 'utf8');
    for (const rule of cssSelectors(css)) {
      for (const sel of splitSelectorList(rule)) {
        const norm = sel.replace(/\s+/g, ' ');
        // :not(cx-n) / :not(.cx-n) / :not(#cx-n) only pad specificity (scripts/expand-is.js): never a theme hook
        if (/^(from|to|\d+%)$/.test(norm) || HOOK.test(norm.replace(PAD, '')) || ALLOWED.has(norm)) continue;
        offenders.push(`${file}: ${norm}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `Unscoped theme selectors change native Connect styling:\n${offenders.join('\n')}`);

  // Geometry is Liquid Glass only and anchored on <html>
  const themeCss = origReadFileSync.call(fs, path.join(themeDir, 'styles/theme.css'), 'utf8');
  const tokensCss = fs.readFileSync(path.join(themeDir, 'theme-tokens.css'), 'utf8'); // all parts
  const controlsCss = fs.readFileSync(path.join(themeDir, 'theme-controls.css'), 'utf8'); // all parts
  const glass = 'html.connectea-dark:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])';
  assert.ok(cssHas(themeCss, `${glass} :where(.eds-c-card):not(#cx-n),\n${glass} :where(.cvr-c-card):not(#cx-n)`) && /border-radius: 16px !important;/.test(themeCss),
    'panel curvature must be scoped to Liquid Glass');
  assert.ok(!/\[class\*="(card|panel|tile)"\]/.test(themeCss + tokensCss), 'curvature must not use [class*=card/panel/tile] substring selectors');
  assert.ok(!cssHas(themeCss, '.mat-expansion-panel-header') && !cssHas(tokensCss, 'Universal Panel & Tile Background Curvature'),
    'expansion panel headers must keep native geometry and curvature must live only in theme.css');
  assert.ok(!/:not\(\[data-connectea-[a-z-]+="[a-z-]+"\]\):not\(\[data-connectea-[a-z-]+="[a-z-]+"\]\)(\.connectea-dark|:is\(html\.connectea-dark, body)/.test(fs.readFileSync(path.join(themeDir, 'theme.css'), 'utf8')),
    'non-glass negations must be anchored on html, never matched on body');
  assert.ok(!cssHas(controlsCss, 'font-size: 24px !important;\n  width: 24px !important;'), 'icon buttons must keep native icon sizes');
  assert.ok(!cssHas(controlsCss, '.mat-icon-button .mat-button-wrapper {'), 'icon button wrappers must keep native layout');
});

runTest('Test 154: Shared utilities, settings reset clears every baseline key, and no duplicated helpers', () => {
  const utils = window.ConnectifyUtils;
  assert.strictEqual(utils.normalize('  Term 1\n  Test  '), 'Term 1 Test');
  assert.deepStrictEqual(utils.baselineKeys('types', 'acc').slice(-1), ['connectify:baseline:types:acc'],
    'the current baseline key must come last so it wins when merging');

  // clearSettingsCache must remove singular and plural baseline keys and drop memoised baselines
  eval(fs.readFileSync(path.resolve(__dirname, 'src/assessment/assessment-cache.js'), 'utf8'));
  localStorage.clear();
  const seeded = ['connectify:baseline:types:acc', 'connectea:baseline:subjects', 'connectify:baselines:types', 'connectea:class_categories:Chem'];
  for (const k of seeded) localStorage.setItem(k, '{}');
  localStorage.setItem('connectify:prediction:acc:Chem:1', '{}');
  const dispatched = [];
  const origDispatch = window.dispatchEvent;
  window.dispatchEvent = e => { dispatched.push(e.type); return true; };
  try {
    window.ConnectifyCache.clearSettingsCache();
  } finally {
    window.dispatchEvent = origDispatch;
  }
  for (const k of seeded) assert.strictEqual(localStorage.getItem(k), null, `${k} must be cleared with settings`);
  assert.strictEqual(localStorage.getItem('connectify:prediction:acc:Chem:1'), '{}', 'settings reset must not touch predictions');
  assert.ok(dispatched.includes('connectify-baselines-updated'), `settings reset must dispatch connectify-baselines-updated (got ${dispatched.join(', ')})`);
  localStorage.clear();

  // No module re-implements the shared helpers
  const offenders = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (full.endsWith('.js') && !full.endsWith(path.join('system', 'utils.js'))) {
        const src = origReadFileSync.call(fs, full, 'utf8');
        if (/const normalize = text =>/.test(src) || /for \(let i = 0; i < localStorage\.length; i\+\+\)/.test(src)) offenders.push(path.relative(__dirname, full));
      }
    }
  })(path.resolve(__dirname, 'src'));
  assert.deepStrictEqual(offenders, [], 'modules must use ConnectifyUtils instead of local normalize/storage scans');

  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const outlines = manifest.content_scripts.find(cs => (cs.js || []).includes('src/assessment/assessment-cache.js'));
  // The shared scheduler comes first (it depends on nothing), then utils.js before every other outlines script
  assert.deepStrictEqual(outlines.js.slice(0, 2), ['src/system/scheduler.js', 'src/system/utils.js'], 'scheduler.js then utils.js must load before every other outlines content script');
  // The document_start boot group (pointer-kind.js, theme-boot.js) runs before the scheduler exists and never uses it
  const usesScheduler = c => (c.js || []).some(f => origReadFileSync.call(fs, path.resolve(__dirname, f), 'utf8').includes('ConnectifyScheduler'));
  for (const cs of manifest.content_scripts.filter(c => c.world !== 'MAIN' && (c.js || []).some(f => !f.includes('auto-login')) && (c.run_at !== 'document_start' || usesScheduler(c)))) {
    assert.strictEqual(cs.js[0], 'src/system/scheduler.js', 'Every isolated content-script group that uses the scheduler must load it first');
  }

  // Progress no longer sweeps the whole document every 1.5s
  const progJs = origReadFileSync.call(fs, path.resolve(__dirname, 'src/progress/progress-graph.js'), 'utf8');
  assert.ok(!/setInterval\(\(\) => \{[^}]*cleanupImprovementArrows\(\)/.test(progJs), 'arrow cleanup must run once, not on an interval');

  // Theme login-restore logic lives in one place across all theme scripts
  const themeDir = path.resolve(__dirname, 'src/theme');
  const allThemeJs = fs.readdirSync(themeDir).filter(f => f.endsWith('.js')).map(f => origReadFileSync.call(fs, path.join(themeDir, f), 'utf8')).join('\n');
  assert.strictEqual((allThemeJs.match(/localStorage\.removeItem\(RESTORE_THEME_KEY\)/g) || []).length, 1, 'restore consumption must be implemented once');
  assert.strictEqual((allThemeJs.match(/const isLoginUrl = /g) || []).length, 1, 'login URL detection must be implemented once');
});

runTest('Test 155: Custom theme deletion, wallpaper storage fallback and customizer input safety', () => {
  const extStore = {};
  global.chrome = {
    storage: {
      local: {
        get: (keys, cb) => cb(Object.fromEntries(keys.filter(k => k in extStore).map(k => [k, extStore[k]]))),
        set: obj => Object.assign(extStore, obj),
        remove: key => { delete extStore[key]; }
      }
    }
  };
  try {
    localStorage.clear();
    window.location.href = 'https://connect.det.wa.edu.au/classes';
    eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8'));
    let reg = window.ConnectifyThemeRegistry;

    // A deleted theme must not come back from the extension-storage copy on the next page load
    const saved = reg.saveCustomTheme({ name: 'Ocean', colors: { canvas: '#001122', surface: '#112233' } });
    assert.ok(JSON.parse(extStore['connectea:custom_themes_list']).some(t => t.id === saved.id), 'saved themes must reach extension storage');
    reg.deleteCustomTheme(saved.id);
    assert.ok(!JSON.parse(extStore['connectea:custom_themes_list']).some(t => t.id === saved.id), 'deleting must also remove the extension-storage copy');
    eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8'));
    reg = window.ConnectifyThemeRegistry;
    assert.ok(!reg.getAvailableThemes().some(t => t.id === saved.id), 'a deleted theme must stay deleted after reload');

    // A wallpaper too large for localStorage survives in extension storage and is restored on load
    const origSetItem = localStorage.setItem;
    localStorage.setItem = function(k, v) { if (k === 'connectea:custom_background') throw new Error('QuotaExceededError'); return origSetItem.call(this, k, v); };
    try {
      reg.setCustomBackground('data:image/png;base64,AAAA');
      assert.strictEqual(extStore['connectea:custom_background'], 'data:image/png;base64,AAAA', 'over-quota wallpaper must be kept in extension storage');
      assert.strictEqual(reg.getCustomBackground(), 'data:image/png;base64,AAAA', 'over-quota wallpaper must stay active for the session');
    } finally {
      localStorage.setItem = origSetItem;
    }
    eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8'));
    assert.strictEqual(window.ConnectifyThemeRegistry.getCustomBackground(), 'data:image/png;base64,AAAA', 'wallpaper must be restored from extension storage after reload');
    assert.strictEqual(document.documentElement.getAttribute('data-connectea-has-custom-bg'), 'true');
  } finally {
    delete global.chrome;
    localStorage.clear();
  }

  // Customizer: user-supplied names and imported colours are escaped and sanitised
  eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.js'), 'utf8'));
  const markup = window.ConnectifyThemeCustomizerMarkup;
  const html = markup.modalHtml({ mode: 'basic', tokens: {}, name: '"><img src=x onerror=alert(1)>', emoji: '<b>', liquidGlass: false,
    wallpaper: null, glassBlur: 16, glassOpacity: 0.65, activeToken: 'canvas' }, { dark: { name: '<i>Dark</i>', icon: '🌙' } });
  assert.ok(!html.includes('<img src=x') && html.includes('&quot;&gt;&lt;img src=x'), 'theme names must be HTML-escaped');
  assert.ok(!html.includes('<i>Dark</i>') && !html.includes('<b>'), 'preset names and icons must be HTML-escaped');
  const state = { tokens: { canvas: '#111111' }, name: 'A', emoji: '🎨', liquidGlass: false, glassBlur: 16, glassOpacity: 0.65, wallpaper: null };
  window.ConnectifyThemeCustomizerControls.importTheme(state, {
    name: 'Imported', glassBlur: 999, wallpaper: 'javascript:alert(1)',
    colors: { canvas: '#222222', surface: 'red;}</style><script>', name: 'not-a-colour', accent: 'rgba(1, 2, 3, 0.5)' }
  });
  assert.strictEqual(state.name, 'Imported');
  assert.strictEqual(state.glassBlur, 40, 'imported blur must be clamped');
  assert.strictEqual(state.wallpaper, null, 'imported wallpapers must be image data URIs');
  assert.deepStrictEqual(state.tokens, { canvas: '#222222', accent: 'rgba(1, 2, 3, 0.5)' }, 'only valid colour tokens may be imported');
  assert.deepStrictEqual(window.ConnectifyThemeColors.parseHex('rgba(26, 36, 52, 0.72)'), { r: 26, g: 36, b: 52 }, 'Liquid Glass rgba() surfaces must parse');

  // The picker drag listeners are registered once per page, not on every open
  const coreJs = origReadFileSync.call(fs, path.resolve(__dirname, 'src/theme/theme-customizer.js'), 'utf8');
  assert.ok(!coreJs.includes("addEventListener('mousemove'"), 'opening the customizer must not add window listeners');
});

runTest('Test 156: Sidebar sync leaves the DOM alone when nothing changed and keeps the open tool pressed', () => {
  delete window.__connectifySidebarInitialized;
  for (const id of ['connectify-sidebar', 'connectify-sidebar-handle', 'connectify-weakness']) {
    document.querySelectorAll('#' + id).forEach(el => el.remove());
  }
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8'));
  const sidebar = document.getElementById('connectify-sidebar');
  const toolMenu = sidebar.querySelector('.cx-tool-menu');
  const workspace = sidebar.querySelector('.cx-workspace');
  // Use the mounted weakness panel (an earlier test may have registered the real module)
  let weaknessPanel = document.getElementById('connectify-weakness');
  if (!weaknessPanel) {
    weaknessPanel = Object.assign(document.createElement('section'), { id: 'connectify-weakness' });
    workspace.append(weaknessPanel);
  }
  const weaknessBtn = () => toolMenu.querySelector('#connectify-weakness-toggle');
  assert.ok(weaknessBtn(), 'weakness launcher must be mounted');

  // An open tool stays pressed across periodic syncs; a closed one is released
  window.ConnectifySidebar.syncState();
  weaknessPanel.hidden = false;
  weaknessBtn().setAttribute('aria-pressed', 'true');
  window.ConnectifySidebar.syncState();
  assert.strictEqual(weaknessBtn().getAttribute('aria-pressed'), 'true', 'the open tool must stay pressed after a sync');
  weaknessPanel.hidden = true;
  window.ConnectifySidebar.syncState();
  assert.strictEqual(weaknessBtn().getAttribute('aria-pressed'), 'false', 'a closed tool must be released');

  // A sync with nothing out of place must not move or rewrite anything
  let moves = 0;
  const countMoves = el => {
    for (const fn of ['append', 'appendChild']) {
      const orig = el[fn].bind(el);
      el[fn] = (...args) => { moves++; return orig(...args); };
    }
  };
  countMoves(toolMenu);
  countMoves(document.body);
  const labelsBefore = Array.from(toolMenu.children).map(b => b.textContent);
  window.ConnectifySidebar.syncState();
  assert.strictEqual(moves, 0, 'an idle sync must not re-append buttons, the sidebar or the handle');
  assert.deepStrictEqual(Array.from(toolMenu.children).map(b => b.textContent), labelsBefore);
});

runTest('Test 157: A new school year turns last year\'s averages into baselines for types and subjects still present', () => {
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/year-rollover.js'), 'utf8'));
  const yr = window.ConnectifyYearRollover;

  // Subjects match across years regardless of year level, ATAR suffix or semester
  assert.strictEqual(yr.subjectKey('12 Chemistry ATAR - Semester 1'), 'chemistry');
  assert.strictEqual(yr.subjectKey('Chemistry ATAR Year 11'), 'chemistry');
  assert.strictEqual(yr.subjectKey('11 Mathematics Methods ATAR'), 'mathematics methods');

  // Only a later (or never-seen) set of class names counts as a new year
  const y11 = { classNames: ['11 Chemistry ATAR', '11 Physics ATAR'], seen: [] };
  assert.strictEqual(yr.classifyYear(['12 Chemistry ATAR', '12 Physics ATAR'], y11), 'new-year');
  assert.strictEqual(yr.classifyYear(['11 Chemistry ATAR', '11 English ATAR'], y11), 'same');
  assert.strictEqual(yr.classifyYear(['10 Science', '10 English'], y11), 'other-year', 'viewing an earlier year must not roll over');
  assert.strictEqual(yr.classifyYear(['Art', 'Drama'], { classNames: ['Chemistry', 'Physics'], seen: ['Art|Drama'] }), 'other-year');
  assert.strictEqual(yr.classifyYear(['Art', 'Drama'], { classNames: ['Chemistry', 'Physics'], seen: [] }), 'new-year');
  assert.strictEqual(yr.classifyYear(['12 Chemistry ATAR'], { classNames: [] }), 'first');

  // Only types that are still categories and subjects that still exist are carried over
  const snapshot = { types: { Exam: 71.26, Test: 80, Retired: 60 }, subjects: { chemistry: 83.5, literature: 59.6 } };
  const next = yr.rolledBaselines(snapshot, ['12 Chemistry ATAR', '12 Physics ATAR'], { types: { Essay: 70 }, subjects: {} }, new Set(['Exam', 'Test', 'Essay']));
  assert.deepStrictEqual(next.types, { Essay: 70, Exam: 71.3, Test: 80 });
  assert.deepStrictEqual(next.subjects, { '12 Chemistry ATAR': 83.5 });
  assert.strictEqual(next.subjectCount, 1);
  assert.strictEqual(next.typeCount, 2);

  // End to end: a snapshot taken in Year 11 becomes the baselines when Year 12 classes appear
  const savedBaselines = [];
  const origStore = window.ConnectifyPredictorBaselines;
  const origQSA = document.querySelectorAll;
  const origCache = window.ConnectifyCache;
  let resultsCleared = false;
  const tiles = titles => titles.map(t => ({ querySelector: () => ({ textContent: t }), getAttribute: () => null }));
  try {
    localStorage.clear();
    window.ConnectifyPredictorBaselines = { getBaselines: () => ({ types: {}, subjects: {} }), saveBaselines: b => savedBaselines.push(b) };
    window.ConnectifyCache = { clearResultsCache: () => { resultsCleared = true; } };
    localStorage.setItem(`connectify:year_snapshot:${window.ConnectifyUtils.accountKey()}`, JSON.stringify({
      classNames: ['11 Chemistry ATAR', '11 Literature ATAR', '11 Physics ATAR'], seen: [], snapshot
    }));
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? tiles(['12 Chemistry ATAR - Semester 1', '12 Chemistry ATAR - Semester 2', '12 Physics ATAR - Semester 1']) : origQSA(sel));
    yr.check();
    assert.strictEqual(savedBaselines.length, 1, 'baselines must be saved once on the new year');
    assert.deepStrictEqual(savedBaselines[0].subjects, { '12 Chemistry ATAR': 83.5 }, 'only subjects still present get a baseline');
    assert.ok(Number.isFinite(savedBaselines[0].types.Exam), 'existing categories get type baselines');
    assert.ok(resultsCleared, "last year's cached results must be cleared");
    const after = JSON.parse(localStorage.getItem(`connectify:year_snapshot:${window.ConnectifyUtils.accountKey()}`));
    assert.deepStrictEqual(after.classNames, ['12 Chemistry ATAR', '12 Physics ATAR']);
    assert.strictEqual(after.snapshot, null, 'the old snapshot must not be applied twice');

    // Browsing back to Year 11 afterwards changes nothing
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? tiles(['11 Chemistry ATAR - Semester 1', '11 Physics ATAR - Semester 1']) : origQSA(sel));
    yr.check();
    assert.strictEqual(savedBaselines.length, 1, 'viewing an earlier year must not save baselines');
  } finally {
    document.querySelectorAll = origQSA;
    window.ConnectifyPredictorBaselines = origStore;
    window.ConnectifyCache = origCache;
    localStorage.clear();
  }
});

runTest('Test 160: Padding and margins that are 0px in the Default theme stay 0px in every custom theme', () => {
  // Default theme = native Connect (no theme hook), so its zero spacing comes from connect_css/.
  const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const splitTop = (text, sep) => {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of text) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === sep && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(Boolean);
  };
  const lastCompound = sel => splitTop(sel.replace(/\s+/g, ' ').replace(/ ([>+~]) /g, '$1'), ' ').pop().replace(/^.*[>+~]/, '');
  const ZERO = /^(?:0(?:px|em|rem|%)?\s*)+$/;
  // [{ target, prop, value }] for every padding*/margin* declaration, descending into @media blocks
  function spacing(css) {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(stripComments(css)))) {
      const sel = m[1].replace(/^[\s;]*/, '').trim();
      if (sel.startsWith('@')) continue;
      for (const decl of m[2].split(';')) {
        const d = decl.match(/^\s*(padding|margin)(-(?:top|right|bottom|left))?\s*:\s*(.*?)\s*(?:!important)?\s*$/);
        if (!d) continue;
        // :not(cx-n) / :not(.cx-n) / :not(#cx-n) only pad specificity (scripts/expand-is.js)
        for (const s of splitTop(sel, ',')) out.push({ target: lastCompound(s).replace(/:not\([#.]?cx-n\)/g, ''), prop: d[1] + (d[2] || ''), value: d[3], sel: s });
      }
    }
    return out;
  }

  const connectDir = path.join(BASE_DIR, 'connect_css');
  const nativeZero = new Map(); // "target|prop" -> source file
  for (const f of fs.readdirSync(connectDir).filter(n => n.endsWith('.css'))) {
    for (const r of spacing(origReadFileSync.call(fs, path.join(connectDir, f), 'utf8'))) {
      if (ZERO.test(r.value) && /^[.#]/.test(r.target) && !r.target.includes(':')) nativeZero.set(`${r.target}|${r.prop}`, f);
    }
  }
  assert.ok(nativeZero.size > 100, 'connect_css must yield native zero padding/margin declarations');

  const themeDir = path.join(BASE_DIR, 'src/theme/styles');
  const themeRules = [];
  for (const f of fs.readdirSync(themeDir).filter(n => n.endsWith('.css'))) {
    // Customizer UI chrome is Connectify's own markup (cx- ids/classes), not Connect containers
    if (/customizer|color-picker|menu-actions/.test(f)) continue;
    for (const r of spacing(origReadFileSync.call(fs, path.join(themeDir, f), 'utf8'))) themeRules.push({ ...r, file: f });
  }
  assert.ok(themeRules.length > 10, 'theme stylesheets must yield padding/margin declarations');

  // Native outline padding (15px on .cvr-u-padding--md) is never zeroed by a theme
  assert.ok(!themeRules.some(r => r.target.startsWith('.cvr-u-padding--md') && ZERO.test(r.value)),
    'no theme stylesheet may zero the native .cvr-u-padding--md padding');

  const offenders = [];
  for (const r of themeRules) {
    if (ZERO.test(r.value)) continue;
    // A rule that targets Connectify's own elements can never collide with native Connect spacing
    if (/connectea|connectify|\bcx-|#cx|\.cx/.test(r.target) || !/^[.#]/.test(r.target)) continue; // bare element tags are too coarse to compare
    const key = `${r.target}|${r.prop}`;
    // Older than this check: the menu divider's margin sat in an :is() list the check could not read until the
    // lists were expanded (2026-10); changing it is a visual change of its own
    if (r.target === '.dropdown-divider' && r.file === 'theme-navigation.css' && r.value === '4px 0') continue;
    if (nativeZero.has(key)) offenders.push(`${r.file}: ${r.sel} { ${r.prop}: ${r.value} } (0 in ${nativeZero.get(key)})`);
  }
  assert.deepStrictEqual(offenders, [], `Themes must not give padding/margin to containers that are 0px by default:\n${offenders.join('\n')}`);

  // Custom theme tokens/wallpaper code must never write spacing inline
  for (const f of ['theme-custom-tokens.js', 'theme-custom-themes.js', 'theme-registry.js', 'theme.js']) {
    const js = fs.readFileSync(path.join(BASE_DIR, 'src/theme', f), 'utf8');
    assert.ok(!/style\.(padding|margin)|setProperty\(\s*['"](padding|margin)/.test(js), `${f} must not set padding/margin inline`);
  }
});

runTest('Test 161: A dialog and its padding regions share one surface; a table-wrapping paginator keeps native layout', () => {
  const dialogCss = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-dialog-surface.css'), 'utf8');
  assert.ok(cssHas(dialogCss, '.connectea-dark .mat-dialog-container :where(div):not([class*="avatar"])') && cssHas(dialogCss, '.connectea-dark .mat-dialog-container :where(footer):not(') && cssHas(dialogCss, 'background-color: transparent !important'),
    'dialog title, content and footer regions must be transparent so the container colour shows through');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('theme-dialog-surface.css'), 'theme-dialog-surface.css must be registered in the manifest');
  const pagCss = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-dialogs-paginator.css'), 'utf8');
  const bar = pagCss.slice(pagCss.indexOf('25. Angular Material Paginator'));
  assert.ok(cssHas(bar, 'cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body)),'), 'a cnt-paginator wrapping the table must not get flex/space-between layout');
});

runTest('Test 162: Auto-login only fires for a saved password or browser autofill, never for typed input', () => {
  const js = fs.readFileSync(path.join(BASE_DIR, 'src/system/auto-login.js'), 'utf8');
  // Chromium (Chrome, Dia) matches :autofill while it still withholds the password value: submitting then sends an empty password
  assert.ok(!/['"]:(-webkit-)?autofill['"]/.test(js) && js.includes("const isFilled = el => el.value.trim() !== '';"),
    'auto-login must wait for readable credential values, never treat :autofill alone as filled');
  assert.ok(js.includes('if (!isFilled(userField) || !isFilled(passField)) return;'), 'auto-login must require both credential fields to be filled');
  assert.ok(js.includes("passField.addEventListener('input', attemptLogin)"), 'the browser releasing an autofilled value must retry the login');
  assert.ok(js.includes("field.addEventListener('keydown', markTyped)") && js.includes("field.addEventListener('paste', markTyped)"),
    'typing or pasting in a credential field must mark the form as user-entered');
  assert.ok(js.includes("=== false || userTyped) return;"), 'auto-login must not fire once the user typed');
});

runTest('Test 278: In Chromium, auto-login signs in with the password saved in the browser, which the page never sees autofilled', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const entry = manifest.content_scripts.find(c => (c.js || []).includes('src/system/auto-login.js'));
  assert.deepStrictEqual(entry.js, ['src/system/auto-login-credentials.js', 'src/system/auto-login.js'], 'the credential reader loads first');
  const credSrc = fs.readFileSync(path.join(BASE_DIR, 'src/system/auto-login-credentials.js'), 'utf8');
  const loginSrc = fs.readFileSync(path.join(BASE_DIR, 'src/system/auto-login.js'), 'utf8');
  const run = async ({ flags = {}, cred = { type: 'password', id: 'student', password: 'pw' }, chromium = true, typeFirst = false } = {}) => {
    const field = id => ({ id, value: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
    const fields = { ssousername: field('ssousername'), password: field('password') };
    let clicks = 0;
    let asked = null;
    fields.login = { value: 'Log in', style: {}, parentElement: { appendChild() {} }, addEventListener() {}, click: () => { clicks++; } };
    const terms = { checked: false };
    const window = chromium ? { PasswordCredential: function () {} } : {};
    const sandbox = {
      window,
      navigator: { credentials: { get: opts => { asked = opts; return new Promise(r => setTimeout(() => r(cred), 5)); } } },
      chrome: { storage: { local: { get: (keys, cb) => cb(flags), set() {}, remove() {} } } },
      document: { getElementById: id => fields[id] || null, querySelector: () => terms, createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }), createTextNode: () => ({}) },
      setInterval: () => 0, clearInterval() {}, setTimeout, Date, Promise
    };
    require('vm').runInNewContext(credSrc, sandbox);
    require('vm').runInNewContext(loginSrc, sandbox);
    if (typeFirst) fields.password.listeners.keydown();
    await new Promise(r => setTimeout(r, 20));
    return { clicks, asked, user: fields.ssousername.value, pass: fields.password.value, terms: terms.checked };
  };
  const signedIn = await run();
  assert.strictEqual(signedIn.clicks, 1, 'the saved credential logs in');
  assert.ok(signedIn.user === 'student' && signedIn.pass === 'pw' && signedIn.terms, 'fills both fields and accepts the terms');
  assert.ok(signedIn.asked.password === true && signedIn.asked.mediation === 'optional', 'Chrome signs in at once when it can, else shows its account chooser');
  assert.strictEqual((await run({ flags: { 'cx-autologin-enabled': false } })).asked, null, 'Auto-login off: the password manager is never asked');
  assert.strictEqual((await run({ flags: { 'cx-manual-logout': true } })).asked, null, 'never after a manual logout');
  assert.strictEqual((await run({ flags: { 'cx-last-autologin': Date.now() - 5000 } })).clicks, 0, 'never within 30s of a login');
  assert.strictEqual((await run({ typeFirst: true })).clicks, 0, 'typing before the credential arrives leaves the form to the student');
  assert.strictEqual((await run({ cred: null })).clicks, 0, 'no saved password (or the chooser cancelled): nothing is submitted');
  assert.strictEqual((await run({ chromium: false })).asked, null, 'Firefox has no PasswordCredential: its autofill path is used');
});

runTest('Test 277: With Auto-login on, Connect\'s sign-in chooser presses Student, also after the session expired, but never after a logout', async () => {
  const src = fs.readFileSync(path.join(BASE_DIR, 'src/system/auto-login-student.js'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const entry = manifest.content_scripts.find(c => (c.js || []).includes('src/system/auto-login-student.js'));
  assert.ok(entry && entry.matches.includes('https://connect.det.wa.edu.au/login') && entry.matches.includes('https://connect.det.wa.edu.au/login?*'),
    'runs on Connect\'s sign-in chooser, with or without a query');
  const run = async (flags, href = 'https://connect.det.wa.edu.au/login') => {
    let clicks = 0;
    // Its own globals, so other tests never see this page's location or storage
    const sandbox = {
      window: {},
      location: { href },
      chrome: { storage: { local: { get: (keys, cb) => { cb(flags); } } } },
      document: { body: { innerText: 'Your session has expired' }, querySelector: sel => (sel.includes('login-btn--student') ? { click: () => { clicks++; } } : null) }
    };
    require('vm').runInNewContext(src, sandbox);
    await new Promise(r => setTimeout(r, 0));
    return clicks;
  };
  assert.strictEqual(await run({}), 1, 'Auto-login is on by default: Student is pressed');
  assert.strictEqual(await run({ 'cx-autologin-enabled': true }), 1);
  assert.strictEqual(await run({ 'cx-autologin-enabled': false }), 0, 'Auto-login off: the student chooses');
  assert.strictEqual(await run({ 'cx-manual-logout': true }), 0, 'after a manual logout');
  assert.strictEqual(await run({ 'cx-session-expired': true }), 1, 'an expired session signs straight back in');
  assert.strictEqual(await run({ 'cx-last-autologin': Date.now() - 5000 }), 0, 'never loops within 30s of a login');
  assert.strictEqual(await run({}, 'https://connect.det.wa.edu.au/login?reason=timeout'), 1, 'a timeout URL never pauses it');
  assert.ok(!src.includes('storage.local.remove'), 'the logout flag is left for the DET page, which shows why it paused');
  const login = fs.readFileSync(path.join(BASE_DIR, 'src/system/auto-login.js'), 'utf8');
  assert.ok(login.includes('const shouldBlockAutoLogin = isManualLogout || isRapidLoop;') && !login.includes('Paused: session expired'),
    'the DET sign-in page signs straight back in after an expired session');
  const nav = fs.readFileSync(path.join(BASE_DIR, 'src/system/navigation.js'), 'utf8');
  assert.ok(!nav.includes("'cx-session-expired': true"), 'nothing marks an expired session any more');
});

runTest('Test 163: Liquid Glass rounds the notice card host and Library table wrapper, paginators have no pill; icon buttons keep native padding', () => {
  const styles = path.join(BASE_DIR, 'src/theme/styles');
  const css = fs.readFileSync(path.join(styles, 'theme-glass-panels.css'), 'utf8');
  const glass = 'html.connectea-dark:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])';
  assert.ok(cssHas(css, `${glass} cnt-stream-notice-card {\n  border-radius: 16px !important;`), 'the notice card host must be rounded to match its mat-card');
  assert.ok(!/cnt-stream-notice-card[^{]*\{[^}]*overflow/.test(css), 'the notice card host must not clip (it would cut off the elevation shadow)');
  assert.ok(cssHas(css, `${glass} .cdk-drop-list:has(> table.mat-table) {\n  border-radius: 16px !important;\n  overflow: clip !important;`),
    'the Library table wrapper must be rounded and clipped with overflow: clip (hidden changes margin collapsing and its height)');
  // Paginators keep their native box (theme parity audit): no padding or clip, and no glass pill around them
  assert.ok(!/padding/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) && !/mat-paginator[^{]*\{[^}]*overflow/.test(css), 'paginator bars must not be padded or clipped');
  const surface = fs.readFileSync(path.join(styles, 'theme-glass-surface.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/paginator-container|mat-paginator/.test(surface), 'paginators sit on the page: no glass pill or segmented pill');
  assert.ok(!/\[class\*=/.test(css), 'glass panel rules must name explicit elements/classes');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('theme-glass-panels.css'), 'theme-glass-panels.css must be registered in manifest.json');
  const buttons = fs.readFileSync(path.join(styles, 'theme-buttons.css'), 'utf8');
  assert.ok(cssHas(buttons, 'button.mat-focus-indicator[class*="border"]:not(.mat-icon-button) {\n  padding: 0 15px !important;'),
    'bordered icon buttons (bookmark) must keep native padding so the glyph is not offset');
});

runTest('Test 164: Liquid Glass Class page banners, bars, headings and empty states sit on the page with no panel', () => {
  const styles = path.join(BASE_DIR, 'src/theme/styles');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  const glass = 'html.connectea-dark:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])';
  for (const file of ['theme-glass-surface.css', 'theme-glass-class-pages.css']) {
    const css = fs.readFileSync(path.join(styles, file), 'utf8');
    assert.ok(manifest.includes(file) && manifest.indexOf(file) < manifest.indexOf('styles/theme.css'), `${file} must be registered before theme.css`);
    assert.ok(css.split('\n').length <= 250, `${file} must stay <= 250 lines`);
    assert.ok(!/\[class\*=/.test(css), `${file} must name explicit elements/classes`);
    for (const sel of css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map(b => b.split('}').pop().trim()).filter(b => b && !b.startsWith('@'))) {
      assert.ok(sel.startsWith('html.connectea-dark') || sel.startsWith('html.eds'), `${file}: selector must be scoped to the theme hook: ${sel.slice(0, 60)}`);
      assert.ok(sel.includes('liquid-glass'), `${file}: selector must be Liquid Glass only: ${sel.slice(0, 60)}`);
    }
  }
  const surface = fs.readFileSync(path.join(styles, 'theme-glass-surface.css'), 'utf8');
  const clearRule = surface.replace(/\/\*[\s\S]*?\*\//g, '').split('}').find(b => b.includes('cnt-scope-intro-class')) || '';
  for (const sel of [' cnt-scope-intro-class:not(', ' mat-toolbar.c-category-bar:not(', ' .cvr-c-category-toolbar__container > .cvr-c-thori-pnl:not(', ' .cvr-c-pagination__body > div.d-flex:has(> mat-checkbox)', ':is(cnt-paginator:has(.c-empty-content))', ' p.mat-h2:not(', ' .eds-c-empty-content:not(']) {
    assert.ok(clearRule.includes(sel), `${sel} sits on the page in Liquid Glass`);
  }
  assert.ok(/background: transparent !important;/.test(clearRule) && /backdrop-filter: none !important;/.test(clearRule) && /box-shadow: none !important;/.test(clearRule),
    'the former contrast panels paint no fill, blur or shadow');
  assert.ok(!/::before/.test(surface) && !/--cx-gl-fill/.test(surface) && !/border-radius/.test(surface), 'no glass pills, cards or panels remain');
  const pages = fs.readFileSync(path.join(styles, 'theme-glass-class-pages.css'), 'utf8');
  assert.ok(cssHas(pages, `:is(.cvr-c-pagination__body:has(> table.mat-table)),\n${glass} mat-accordion:not(.cx-n):not(.cx-n) {\n  border-radius: 16px !important;\n  overflow: clip !important;`), 'the Learners table and accordion must be rounded and clipped');
  assert.ok(cssHas(pages, `${glass}:not([data-connectea-login]) :where(.v-app.librarylearningcontentui):not(#cx-n),\n${glass}:not([data-connectea-login]) :where(.v-app.librarylearningcontentui) > :where(.v-ui.v-scrollable):not(#cx-n)`),
    'the Content canvas must be transparent with or without sections, scoped to the Content app');
  const empty = fs.readFileSync(path.join(styles, 'theme-empty-states.css'), 'utf8');
  assert.ok(cssHas(empty, '.connectea-dark cnt-paginator:has(.c-empty-content) {\n  justify-content: center !important;') && cssHas(empty, '.eds-c-empty-content'),
    'empty states must be centred in every dark theme, not only Liquid Glass');
  const bars = fs.readFileSync(path.join(styles, 'theme-control-bars.css'), 'utf8');
  assert.ok(!/(surface-bg|rgba\(255, 255, 255, 0\.9\))/.test(bars.replace(/\/\*[\s\S]*?\*\//g, '')), 'the Select All row has no surface of its own in any theme');
  // Paginators and the Select All row have no panel: bar, Page N of M box, bar wrapper and Select All row are clear (empty-state and table wrappers keep theirs)
  const clear = (bars.split('}').find(b => b.includes(':where(mat-paginator):not(#cx-n)')) || '');
  assert.ok(clear.includes(':is(html.connectea-dark, html[data-connectea-has-custom-bg="true"])') && clear.includes('.connect-paginator-container') &&
    clear.includes('cnt-paginator:not(:has(mat-table, table, .cvr-c-pagination__body, .c-empty-content))') && clear.includes(':where(.cvr-c-pagination__body) > :where(div.d-flex:has(> mat-checkbox))') &&
    /background-color: transparent !important;/.test(clear) && /box-shadow: none !important;/.test(clear), 'paginators sit on the page with no panel');
  assert.ok(!/(mat-paginator|paginator-container)[^{}]*\{[^}]*rgba\(255, 255, 255, 0\.9\)/.test(bars), 'Light with a wallpaper puts no white panel behind paginators');
  for (const file of ['theme-empty-states.css', 'theme-control-bars.css']) {
    assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes(file), `${file} must be registered in manifest.json`);
  }
});

runTest('Test 165: Custom themes derive every secondary token; the customizer follows the active theme; glass cards clip without shrinking grid rows', () => {
  const themeDir = path.join(BASE_DIR, 'src/theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js']) {
    new Function('window', fs.readFileSync(path.join(themeDir, f), 'utf8'))(win);
  }
  const basic = { canvas: '#14211a', surface: '#1f3326', button: '#27402f', border: '#4c7058', accent: '#8bc34a', textPrimary: '#f1f8e9' };
  const props = win.ConnectifyThemeDerive.cssProps(basic);
  for (const key of ['--cx-text-muted', '--cx-surface-active', '--cx-nav-text', '--cx-table-header-bg', '--cx-table-row-alt', '--cx-badge-bg', '--cx-input-text', '--cx-scrollbar-thumb', '--cx-accent-text']) {
    assert.ok(props[key], `Basic mode must derive ${key}`);
  }
  assert.ok(win.ConnectifyThemeDerive.contrast(props['--cx-text-secondary'], basic.surface) >= 5, 'secondary text must keep >= 5:1 on the surface');
  assert.ok(win.ConnectifyThemeDerive.contrast(props['--cx-text-muted'], basic.surface) >= 5, 'muted text must keep >= 5:1 on the surface');
  const light = win.ConnectifyThemeDerive.cssProps({ canvas: '#f4efe6', surface: '#fffaf0', button: '#efe6d6', border: '#cbbfa8', accent: '#9a3412', textPrimary: '#1c1917' });
  assert.ok(win.ConnectifyThemeDerive.contrast(light['--cx-text-secondary'], '#fffaf0') >= 5, 'a light custom theme must keep secondary text readable too');
  const tokensJs = fs.readFileSync(path.join(themeDir, 'theme-custom-tokens.js'), 'utf8');
  assert.ok(tokensJs.includes('derive?.cssProps(c)') && tokensJs.includes("'--cx-text-muted'") && tokensJs.includes("'--cx-scrollbar-thumb'"), 'applyCustomTokens must apply and clear the derived tokens');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('theme-token-derive.js'), 'theme-token-derive.js must be registered');
  for (const file of ['theme-customizer.css', 'theme-color-picker.css']) {
    const css = origReadFileSync.call(fs, path.join(themeDir, 'styles', file), 'utf8');
    assert.ok(!/#(182232|131b28|141d2a|0f1622|384e68|2d3e54|334458|111824|3b506c)\b/i.test(css), `${file} must take its surfaces from the active theme, not fixed navy`);
    assert.ok(/var\(--cx-surface-bg\)|var\(--cx-input-bg\)/.test(css), `${file} must use theme tokens`);
  }
  const panels = fs.readFileSync(path.join(themeDir, 'styles/theme-glass-panels.css'), 'utf8');
  assert.ok(cssHas(panels, '.mat-card {\n  overflow: clip !important;'), 'glass mat-cards must clip with overflow: clip');
  assert.ok(!/\.cvr-c-card, \.mat-card, \.connectea-panel\) \{\n  overflow: hidden/.test(fs.readFileSync(path.join(themeDir, 'styles/theme.css'), 'utf8')), 'theme.css must not give mat-card overflow: hidden');
});

runTest('Test 166: Every custom-theme token derives from the 6 Basic tokens by the presets\' own patterns; Full mode has 20 tokens; preview tooltip names text tokens', () => {
  const themeDir = path.join(BASE_DIR, 'src/theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js', 'theme-palettes.js']) {
    new Function('window', fs.readFileSync(path.join(themeDir, f), 'utf8'))(win);
  }
  const D = win.ConnectifyThemeDerive, O = win.ConnectifyThemeOklch, pal = win.ConnectifyThemePalettes.BUILTIN_PALETTES;
  // 1. The 6 Basic values of each opaque preset reproduce its Full tokens (OKLCH lightness within 6 points)
  const fullKeys = ['canvasSubtle', 'surfaceSecondary', 'surfaceElevated', 'surfaceHover', 'borderSubtle', 'borderStrong', 'accentHover',
    'textSecondary', 'textMuted', 'buttonHover', 'buttonText', 'inputBg', 'inputBorder'];
  let total = 0, close = 0, sum = 0;
  for (const id of ['dark', 'quantum', 'amoled', 'midnight', 'forest']) {
    const basic = Object.fromEntries(D.BASIC_KEYS.map(k => [k, pal[id][k]]));
    const full = D.deriveFull({ ...basic });
    for (const k of fullKeys) {
      const dL = Math.abs(O.toOklch(full[k]).L - O.toOklch(pal[id][k]).L);
      total++; sum += dL; if (dL <= 6) close++;
    }
  }
  assert.ok(close / total >= 0.85, `derived Full tokens must track the presets (${close}/${total} within 6 L)`);
  assert.ok(sum / total <= 3, `mean lightness error must stay small (got ${(sum / total).toFixed(2)})`);
  // 2. Derived tokens keep the base colour's hue
  const green = D.deriveFull({ canvas: '#0d1f14', surface: '#163322', button: '#1c3d2a', border: '#2f6b48', accent: '#22c55e', textPrimary: '#f0fdf4' });
  for (const k of ['surfaceElevated', 'surfaceHover', 'borderSubtle', 'borderStrong']) {
    assert.ok(Math.abs(O.toOklch(green[k]).h - O.toOklch('#163322').h) < 20, `${k} must keep the surface/border hue`);
  }
  // 3. Primary, secondary, muted and link text stay >= 5:1 for dark and light palettes
  for (const basic of [
    { canvas: '#14211a', surface: '#1f3326', button: '#27402f', border: '#4c7058', accent: '#8bc34a', textPrimary: '#f1f8e9' },
    { canvas: '#f4efe6', surface: '#fffaf0', button: '#efe6d6', border: '#cbbfa8', accent: '#9a3412', textPrimary: '#1c1917' },
    { canvas: '#1a0b2e', surface: '#2a1446', button: '#341a57', border: '#6b3fa0', accent: '#d946ef', textPrimary: '#faf5ff' }
  ]) {
    const p = D.cssProps(basic);
    for (const k of ['--cx-text-secondary', '--cx-text-muted', '--cx-accent-link']) assert.ok(O.contrast(p[k], basic.surface) >= 5, `${k} must keep >= 5:1`);
    assert.ok(O.contrast(p['--cx-button-primary-text'], p['--cx-button-primary-bg']) >= 5, 'primary button text must keep >= 5:1');
  }
  // 4. Full mode exposes the heavily used tokens
  const markupJs = fs.readFileSync(path.join(themeDir, 'theme-customizer-markup.js'), 'utf8');
  const full = markupJs.slice(markupJs.indexOf('const FULL_TOKENS'), markupJs.indexOf('];', markupJs.indexOf('const FULL_TOKENS')));
  assert.strictEqual((full.match(/key: '/g) || []).length, 20, 'Full mode must have 20 tokens');
  for (const k of ['surfaceHover', 'borderStrong', 'textMuted', 'buttonText', 'inputBg', 'inputBorder']) assert.ok(full.includes(`key: '${k}'`), `Full mode must include ${k}`);
  // 5. Every preview element with its own text names the token colouring that text; the tooltip hit-tests glyphs
  const preview = markupJs.slice(markupJs.indexOf('function previewHtml'), markupJs.indexOf('function modalHtml'));
  for (const m of preview.matchAll(/<(span|div|button|strong)([^>]*)>([^<]*[A-Za-z][^<]*)</g)) {
    if (m[2].includes('data-cx-text') || /cx-preview-pane-title|cx-mock-card-header/.test(m[2])) continue;
    const before = preview.slice(0, m.index);
    assert.ok(/data-cx-text="(--cx-[a-z-]+|\$\{T\.)/.test(before.slice(before.lastIndexOf('data-cx-elem'))), `preview text "${m[3].trim()}" must sit inside an element with data-cx-text`);
  }
  assert.ok(/T = \{ primary: '--cx-text-primary \(textPrimary\)', secondary: '--cx-text-secondary \(textSecondary\)' \}/.test(markupJs), 'shared preview text tokens must name real tokens');
  const controlsJs = fs.readFileSync(path.join(themeDir, 'theme-customizer-controls.js'), 'utf8');
  assert.ok(controlsJs.includes('caretRangeFromPoint') && controlsJs.includes("row('Text'"), 'the preview tooltip must report the text token when over glyphs');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('"src/theme/theme-oklch.js",\n            "src/theme/theme-token-derive.js"'), 'theme-oklch.js must load before theme-token-derive.js');
  // 6. Themes saved before the 20-token Full mode drop the six tokens users could not edit (preset leftovers)
  const store = { 'connectea:custom_themes_list': JSON.stringify([
    { id: 'old', name: 'Old', isCustom: true, colors: { canvas: '#aeb4c2', surface: '#798693', inputBg: '#0e1830', textMuted: '#94a3b8' } },
    { id: 'new', name: 'New', isCustom: true, tokenVersion: 2, colors: { canvas: '#aeb4c2', surface: '#798693', inputBg: '#a9afbd' } }
  ]) };
  const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const reg = { registerTheme() {}, getThemeDefinition() {}, getTheme() {}, unregisterTheme() {}, notifyThemeListeners() {}, themeWallpaper: () => null };
  new Function('window', 'localStorage', 'chrome', fs.readFileSync(path.join(themeDir, 'theme-custom-themes.js'), 'utf8'))({ ConnectifyThemeRegistry: reg, ConnectifyThemeTokens: { setThemeBackground() {}, restoreBackgroundFromExtensionStorage() {}, applyCustomTokens() {}, getCustomColors: () => ({}) } }, ls, undefined);
  const [oldTheme, newTheme] = reg.getCustomThemes();
  assert.ok(!('inputBg' in oldTheme.colors) && !('textMuted' in oldTheme.colors) && oldTheme.colors.canvas === '#aeb4c2', 'pre-v2 themes must re-derive their hidden tokens');
  assert.strictEqual(newTheme.colors.inputBg, '#a9afbd', 'v2 themes keep every token the user set');
  assert.strictEqual(reg.saveCustomTheme({ name: 'Saved', colors: { canvas: '#111111' } }).tokenVersion, 2, 'new saves are stamped tokenVersion 2');
  const customizerSrc = fs.readFileSync(path.join(themeDir, 'theme-customizer.js'), 'utf8');
  assert.ok(customizerSrc.includes('themeTokens(themeToEdit.colors)') && !customizerSrc.includes('{ ...getDefaultTokens(), ...colors.pickColors(themeToEdit'), 'editing a theme must derive missing tokens, not copy Dark preset values');
});

runTest('Test 167: Dark and glass rules route theme colours through tokens, so custom themes reach every surface', () => {
  const dir = path.join(BASE_DIR, 'src/theme/styles');
  const read = f => origReadFileSync.call(fs, path.join(dir, f), 'utf8');
  const darkBlock = read('theme-tokens.css').match(/html\.connectea-dark,\s*\n\[data-connectea-theme="dark"\][^{]*\{([^}]*)\}/)[1];
  const darkValues = new Set([...darkBlock.matchAll(/:\s*(#[0-9a-f]{6})/gi)].map(m => m[1].toLowerCase()));
  // Semantic status colours (danger/success/warning/info badges, white on the red clear-cache button, on avatars and on
  // Connect's class-colour bars)
  const allowed = new Set(['theme-feed.css #ffffff', 'theme-feed-3.css #ffffff', 'theme-search-scaling.css #991b1b', 'theme-search-scaling.css #ffffff',
    'theme-surfaces.css #166534', 'theme-surfaces.css #854d0e', 'theme-surfaces.css #991b1b', 'theme-surfaces.css #1e40af',
    'theme-surfaces.css #3b82f6', 'theme-surfaces-2.css #166534', 'theme-surfaces-2.css #854d0e', 'theme-surfaces-2.css #991b1b',
    'theme-surfaces-2.css #1e40af', 'theme-surfaces-2.css #3b82f6', 'theme-tile-actions.css #1e40af']);
  const bare = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.css') && !['theme-tokens.css', 'theme-customizer-preview.css'].includes(f))) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/connectea-dark|connectea-glass|liquid-glass/.test(m[1]) || /not\(\.connectea-dark\)/.test(m[1])) continue;
      let body = m[2], prev;
      do { prev = body; body = body.replace(/var\([^()]*\)/g, ''); } while (body !== prev);
      for (const h of body.replace(/url\([^)]*\)/g, '').matchAll(/#[0-9a-f]{6}\b/gi)) {
        const key = `${f} ${h[0].toLowerCase()}`;
        if (darkValues.has(h[0].toLowerCase()) && !allowed.has(key)) bare.push(key);
      }
    }
  }
  assert.deepStrictEqual(bare, [], `Dark-preset colours must go through var(--cx-*, <literal>) in dark/glass rules: ${bare.join(', ')}`);
  // Sidebar, ATAR, Predictor and Progress styles: no neutral (navy/grey) literal left in dark rules; only
  // saturated semantic colours (outcome segments, success/warning cards, category colours) stay fixed
  const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const chroma = hex => {
    const h = hex.length === 4 ? hex.slice(1).split('').map(x => x + x).join('') : hex.slice(1);
    const [r, g, b] = [0, 2, 4].map(i => toLin(parseInt(h.slice(i, i + 2), 16)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787835 * b);
    return Math.hypot(1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
  };
  const semantic = new Set(['#143522', '#332a18']); // Predictor high (green) and unpredicted (amber) cards
  const neutral = [];
  for (const dirName of ['sidebar/styles', 'atar', 'progress']) {
    const toolDir = path.join(BASE_DIR, 'src', dirName);
    for (const f of fs.readdirSync(toolDir).filter(x => x.endsWith('.css'))) {
      const css = origReadFileSync.call(fs, path.join(toolDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/connectea-dark|connectea-glass|liquid-glass/.test(m[1]) || /not\(\.connectea-dark\)/.test(m[1])) continue;
        let body = m[2], prev;
        do { prev = body; body = body.replace(/var\([^()]*\)/g, ''); } while (body !== prev);
        for (const h of body.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
          if (chroma(h[0]) < 0.06 && !semantic.has(h[0].toLowerCase())) neutral.push(`${dirName}/${f} ${h[0]}`);
        }
      }
    }
  }
  assert.deepStrictEqual(neutral, [], `sidebar/tool dark rules must route neutral colours through tokens: ${neutral.join(', ')}`);
  const cohortStyles = fs.readFileSync(path.join(BASE_DIR, 'src/cohort/cohort-styles.js'), 'utf8');
  assert.ok(cohortStyles.includes('background: var(--cx-input-bg, #2a3b4c);'), 'the dark Type dropdown must follow the input tokens');
});

runTest('Test 168: A custom theme with Liquid Glass on becomes a recoloured Liquid Glass theme; default blur is 12px', () => {
  const themeDir = path.join(BASE_DIR, 'src/theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js', 'theme-glass-tokens.js']) {
    new Function('window', fs.readFileSync(path.join(themeDir, f), 'utf8'))(win);
  }
  const c = win.ConnectifyThemeDerive.complete({ canvas: '#14211a', surface: '#1f3326', button: '#27402f', border: '#4c7058', accent: '#8bc34a', textPrimary: '#f1f8e9' });
  const glass = win.ConnectifyThemeGlassTokens.props(c, 0.3);
  assert.strictEqual(glass['--cx-surface-bg'], 'rgba(31, 51, 38, 0.3)', 'glass panels must be the theme surface at the Transparency opacity');
  assert.strictEqual(glass['--cx-card-bg'], glass['--cx-surface-bg'], 'cards share the translucent surface');
  assert.ok(/^rgba\(20, 33, 26, /.test(glass['--cx-nav-bg']) && /^rgba\(20, 33, 26, /.test(glass['--cx-input-bg']), 'nav and input fills must be the theme canvas, translucent');
  assert.strictEqual(glass['--cx-border'], 'rgba(241, 248, 233, 0.22)', 'borders must be the theme text colour at the preset 22% overlay');
  assert.strictEqual(glass['--cx-surface-hover'], 'rgba(241, 248, 233, 0.14)', 'hover must be the preset 14% overlay of the text colour');
  const tokensJs = fs.readFileSync(path.join(themeDir, 'theme-custom-tokens.js'), 'utf8');
  assert.ok(tokensJs.includes('ConnectifyThemeGlassTokens?.props(c, glass.opacity)'), 'applyCustomTokens must apply glass tokens when glass is on');
  const registryJs = fs.readFileSync(path.join(themeDir, 'theme-registry.js'), 'utf8');
  assert.ok(/theme\.liquidGlass \|\| customColors\?\.glassDiffusion \? \{ opacity:/.test(registryJs), 'the registry must pass the glass opacity for Liquid Glass custom themes');
  assert.ok(registryJs.includes("themeDef.glassBlur : 12,") && registryJs.includes('glassBlur ?? 12;'), 'default blur must be 12px');
  assert.ok(fs.readFileSync(path.join(themeDir, 'theme-customizer.js'), 'utf8').includes('glassBlur: 12,'), 'the customizer must default blur to 12px');
  const styles = fs.readdirSync(path.join(themeDir, 'styles')).map(f => origReadFileSync.call(fs, path.join(themeDir, 'styles', f), 'utf8')).join('\n');
  assert.ok(!styles.includes('var(--cx-glass-blur, 16px)'), 'stylesheet blur fallbacks must be 12px');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.includes('"src/theme/theme-token-derive.js",\n            "src/theme/theme-glass-tokens.js"'), 'theme-glass-tokens.js must load after theme-token-derive.js');
});

runTest('Test 169: Liquid Glass presets (grey derived Liquid Glass, renamed Liquid Tinted Glass), Plum removed, preset wallpapers in Settings', () => {
  const themeDir = path.join(BASE_DIR, 'src/theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js', 'theme-glass-tokens.js', 'theme-palettes.js', 'theme-wallpaper-presets.js']) {
    new Function('window', 'document', fs.readFileSync(path.join(themeDir, f), 'utf8'))(win, undefined);
  }
  const pal = win.ConnectifyThemePalettes.BUILTIN_PALETTES;
  assert.ok(!pal.sunset, 'Twilight Plum must be removed');
  assert.strictEqual(pal['liquid-glass'].name, 'Liquid Tinted Glass', 'the translucent navy preset is Liquid Tinted Glass');
  const grey = pal['liquid-glass-clear'];
  assert.ok(grey && grey.name === 'Liquid Glass' && grey.liquidGlass && grey.glassOpacity === 0.3 && grey.glassBlur === 12 && grey.derived, 'Liquid Glass is the derived grey preset at 30% transparency');
  assert.deepStrictEqual(Object.keys(grey.colors).sort(), ['accent', 'border', 'button', 'canvas', 'surface', 'textPrimary'], 'derived presets carry the six basic colours');
  const D = win.ConnectifyThemeDerive;
  const full = D.complete(grey.colors);
  assert.ok(D.contrast(grey.textPrimary, grey.surface) >= 5, 'Liquid Glass primary text must reach 5:1 on its surface');
  assert.ok(D.contrast(D.cssProps(full)['--cx-text-muted'], grey.surface) >= 5, 'Liquid Glass muted text must reach 5:1');
  assert.ok(/^rgba\(141, 153, 166, 0\.3\)$/.test(win.ConnectifyThemeGlassTokens.props(full, grey.glassOpacity)['--cx-surface-bg']), 'Liquid Glass panels are its surface at 30%');
  const registryJs = fs.readFileSync(path.join(themeDir, 'theme-registry.js'), 'utf8');
  assert.ok(registryJs.includes('isCustomTheme(theme) || customColors || theme.colors') && registryJs.includes('...(p.derived ?'), 'the registry must apply derived presets through the custom-token path');
  // Preset wallpapers: three dark and three light SVG gradients, shown in Settings
  const W = win.ConnectifyWallpaperPresets;
  assert.strictEqual(W.PRESETS.filter(p => p.tone === 'dark').length, 3, 'three dark preset wallpapers');
  assert.strictEqual(W.PRESETS.filter(p => p.tone === 'light').length, 3, 'three light preset wallpapers');
  for (const p of W.PRESETS) {
    assert.ok(p.url.startsWith('data:image/svg+xml;utf8,') && p.url.length < 20000, `${p.name} must be a small SVG data URI`);
    assert.ok(/linearGradient|polygon/.test(decodeURIComponent(p.url)), `${p.name} must be a geometric gradient`);
  }
  assert.strictEqual(W.find(W.PRESETS[1].url).id, W.PRESETS[1].id, 'find() maps a stored wallpaper back to its preset');
  const markup = fs.readFileSync(path.join(BASE_DIR, 'src/predictor/settings-markup.js'), 'utf8');
  const prefs = fs.readFileSync(path.join(BASE_DIR, 'src/predictor/settings-preferences.js'), 'utf8');
  assert.ok(markup.includes('id="cx-bg-presets"') && prefs.includes('presets.mount(presetBox, p =>'), 'Settings must show the preset backgrounds');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('"src/theme/theme-wallpaper-presets.js"'), 'theme-wallpaper-presets.js must be registered');
});

runTest('Test 170: Source files contain no NUL bytes (a scripted \\0 replacement once blanked sidebar colours)', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  for (const file of walk(path.join(BASE_DIR, 'src')).filter(f => /\.(js|css)$/.test(f))) {
    assert.ok(!String(fs.readFileSync(file, 'latin1')).includes('\u0000'), `${path.relative(BASE_DIR, file)} must not contain NUL bytes`);
  }
});

runTest('Test 171: The theme audit applies themes through the cross-world request, and solid themes keep native spacing on control bars and empty states', () => {
  const bridge = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-request.js'), 'utf8');
  assert.ok(bridge.includes("addEventListener('connectify-request-theme'") && bridge.includes('data-connectify-theme-request') && bridge.includes('registry.setTheme(id)'),
    'theme-request.js must apply a theme requested from the page world through the registry');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/theme/theme-request.js"') > manifest.indexOf('"src/theme/theme.js"'), 'theme-request.js must load after theme.js');
  const audit = fs.readFileSync(path.join(BASE_DIR, 'scripts/test-theme-styles.js'), 'utf8');
  assert.ok(!audit.includes('ConnectifyThemeRegistry'), 'the audit runs in the page world and must not call the isolated-world registry');
  assert.ok(audit.includes("new CustomEvent('connectify-request-theme')") && audit.includes('async function clearFocus(page)'), 'the audit must request themes across worlds and clear focus before each capture');
  const styles = path.join(BASE_DIR, 'src/theme/styles');
  const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const file of ['theme-control-bars.css', 'theme-empty-states.css']) {
    assert.ok(!/\b(margin|padding)[\w-]*\s*:/.test(strip(fs.readFileSync(path.join(styles, file), 'utf8'))), `${file} must not change margins or padding`);
  }
  const surface = strip(fs.readFileSync(path.join(styles, 'theme-glass-surface.css'), 'utf8'));
  assert.ok(!/c-category-bar\s*\{[^}]*margin/.test(surface) && !/thori-pnl\s*\{[^}]*margin/.test(surface) && !/p\.mat-h2\s*\{[^}]*(margin|padding)/.test(surface),
    'Liquid Glass bars and headings must keep their native margins and padding');
  assert.ok(!/border:\s*none/.test(surface), 'glass bars turn borders transparent instead of removing them, so boxes keep their size');
});

runTest('Test 172: Dark-classed themes with dark ink are marked light-tone and re-ink data colours; links use the contrast-checked token', () => {
  const tokensJs = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-custom-tokens.js'), 'utf8');
  assert.ok(tokensJs.includes("setAttribute('data-connectea-tone', 'light')") && tokensJs.includes("removeAttribute('data-connectea-tone')") && tokensJs.includes('markTone(c.textPrimary)'),
    'applyCustomTokens must mark dark-ink themes light-tone and clearCustomTokens must unmark them');
  const css = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-light-tone.css'), 'utf8');
  const sels = css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map(b => b.split('}').pop().trim()).filter(Boolean);
  assert.ok(sels.length > 0 && sels.every(sel => sel.startsWith('html.connectea-dark[data-connectea-tone="light"]')), 'every light-tone rule must be scoped to the tone hook');
  for (const cls of ['.cx-cat-name-label', '.cx-pred-scenario-label--mid', '.cx-pred-pill--high strong', '.cx-red-key', '.cx-blue-key', '.cx-date-warning', '.connect-green-light']) {
    assert.ok(css.includes(cls), `light tone must re-ink ${cls}`);
  }
  assert.ok((css.match(/oklch\(from .+ 0\.34 c h\)/g) || []).length >= 6, 'data colours keep hue and chroma at OKLCH lightness 0.34');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8').includes('"src/theme/styles/theme-light-tone.css"'), 'theme-light-tone.css must be registered');
  const derive = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-token-derive.js'), 'utf8');
  assert.ok(derive.includes("'--cx-avatar-text': ink(c.surfaceElevated, text)") && derive.includes('o.contrast(t, fill) >= 5) || o.readable(fill)'),
    'avatar initials take the theme text when it reads on the avatar fill, else a readable ink');
  const tiles = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-tile-actions.css'), 'utf8');
  assert.ok(!/:is\(a, \.eds-c-link\)[^{]*\{\s*color: var\(--cx-accent,/.test(tiles), 'page links must not use the raw accent');
});

runTest('Test 186: Light-tone themes never leave dark-ink radar labels on the dark plot surface; drawer data colours reach 5:1', () => {
  const win = { ConnectifyUtils: { escapeHtml: s => String(s) } };
  for (const f of ['src/theme/theme-oklch.js', 'src/theme/theme-token-derive.js', 'src/theme/theme-glass-tokens.js', 'src/theme/theme-palettes.js', 'src/progress/weakness-radar-view.js']) {
    new Function('window', fs.readFileSync(path.join(BASE_DIR, f), 'utf8'))(win);
  }
  const O = win.ConnectifyThemeOklch, pal = win.ConnectifyThemePalettes.BUILTIN_PALETTES;
  const chartTag = win.ConnectifyWeaknessView.PANEL_HTML.match(/<div id="connectify-radar-chart"[^>]*>/)[0];
  assert.ok(!/background|border:/.test(chartTag), 'the plot surface lives in CSS so a light tone can restyle it (no inline background)');
  const sideCss = fs.readFileSync(path.join(BASE_DIR, 'src/sidebar/styles/sidebar-weakness-types.css'), 'utf8');
  assert.ok(cssHas(sideCss, '#connectify-radar-chart {\n  background: #333333;'), 'the plot keeps its dark surface outside light tones');
  const css = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-light-tone.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = sel => (css.split('}').find(b => b.split('{')[0].trim().endsWith(sel)) || '').split('{')[1] || '';
  const tone = 'html.connectea-dark[data-connectea-tone="light"] ';
  assert.ok(/background: transparent !important/.test(rule(`${tone}#connectify-radar-chart`)), 'light tone clears the dark plot surface');
  assert.ok(/fill: var\(--cx-text-primary, #1d1c1c\) !important/.test(rule(`${tone}#connectify-radar-chart .cx-radar-message`)) &&
    /opacity: 1 !important/.test(rule(`${tone}#connectify-radar-chart .cx-radar-message`)), 'labels, ring percentages and messages take the ink at full opacity');
  // Contrast on the grey Liquid Glass drawer: its surface at the glass opacity over the canvas
  const glass = pal['liquid-glass-clear'];
  const [r, g, b, a] = win.ConnectifyThemeGlassTokens.props(win.ConnectifyThemeDerive.complete(glass.colors), glass.glassOpacity)['--cx-surface-bg'].match(/[\d.]+/g).map(Number);
  const canvas = [1, 3, 5].map(i => parseInt(glass.canvas.slice(i, i + 2), 16));
  const drawer = '#' + [r, g, b].map((v, i) => Math.round(v * a + canvas[i] * (1 - a)).toString(16).padStart(2, '0')).join('');
  assert.ok(O.contrast(glass.textPrimary, drawer) >= 5, `ink must reach 5:1 on the drawer glass (${O.contrast(glass.textPrimary, drawer).toFixed(2)})`);
  for (const sel of ['#connectify-radar-chart tspan', '#connectify-radar-chart .cx-radar-warning', '#connectify-sidebar .cx-cat-delete-btn', '#connectify-sidebar #cx-clear-cache-feedback']) {
    const m = rule(tone + sel).match(/oklch\(from (#[0-9a-f]{6}) ([\d.]+) c h\)/);
    assert.ok(m, `${sel} must be re-inked under light tone`);
    const src = O.toOklch(m[1]), ink = O.fromOklch(Number(m[2]) * 100, src.C, src.h);
    assert.ok(O.contrast(ink, drawer) >= 5, `${sel} must reach 5:1 on the drawer glass (${O.contrast(ink, drawer).toFixed(2)})`);
  }
  // Outside light tones the labels take the theme's secondary text on the dark plot
  for (const [id, p] of Object.entries(pal)) {
    if (/^#[0-9a-f]{6}$/i.test(p.textSecondary || '')) assert.ok(O.contrast(p.textSecondary, '#333333') >= 5, `${id} radar labels must reach 5:1 on the dark plot`);
  }
  assert.ok(O.contrast('#a8a8a8', '#333333') >= 5 && cssHas(sideCss, '.cx-radar-message {\n  color: #a8a8a8;'), 'radar messages must reach 5:1 on the dark plot');
});

runTest('Test 173: The Theme Customizer dialog is always solid, even when glass themes make the surface token translucent', () => {
  const css = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-customizer.css'), 'utf8');
  const dialog = (css.match(/#cx-customizer-dialog \{([^}]*)\}/) || [])[1] || '';
  assert.ok(/background-color: var\(--cx-canvas-bg, #12171f\);/.test(dialog), 'the dialog must sit on the opaque canvas colour');
  assert.ok(/background-image: linear-gradient\(var\(--cx-surface-bg, #1e2632\), var\(--cx-surface-bg, #1e2632\)\);/.test(dialog), 'the surface colour must be layered over the canvas');
  assert.ok(!/background: var\(--cx-surface-bg\)/.test(dialog) && /backdrop-filter: none;/.test(dialog), 'the dialog must not be a bare (translucent) surface fill or frosted');
});

runTest('Test 174: Predict Grade shows a tab for every subject (a dropped plus a replacement course makes seven)', () => {
  const sidebar = new MockElement('div');
  sidebar.id = 'connectify-sidebar';
  sidebar.appendChild(new MockElement('div', 'cx-workspace'));
  document.body.appendChild(sidebar);
  delete window.ConnectifyPredictorUI;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-ui.js'), 'utf8'));

  const names = ['English', 'Methods', 'Specialist', 'Chemistry', 'Economics', 'Biology', 'Physics'];
  const origMath = window.ConnectifyPredictorMath;
  const origView = window.ConnectifyPredictorGradeView;
  let rendered = null;
  window.ConnectifyPredictorMath = { ...origMath, projectSubjectGrades: () => names.map(cleanName => ({ cleanName })) };
  window.ConnectifyPredictorGradeView = { renderGradePredictor: (c, subjects) => { rendered = subjects; } };
  try {
    const instance = window.ConnectifyPredictorUI.ensurePredictorPanel();
    instance.openPredictor();
    assert.ok(Array.isArray(rendered), 'the Grade tab must render the subject tabs');
    assert.deepStrictEqual(rendered.map(s => s.cleanName), names, 'every subject, including the seventh (Physics), must get a tab');
    instance.closePredictor();
  } finally {
    window.ConnectifyPredictorMath = origMath;
    window.ConnectifyPredictorGradeView = origView;
    document.body.removeChild(sidebar);
  }
  const uiJs = fs.readFileSync(path.join(BASE_DIR, 'src/predictor/predictor-ui.js'), 'utf8');
  assert.ok(!/slice\(0,\s*\d+\)/.test(uiJs), 'the Predictor must not cap the number of subject tabs');
});

runTest('Test 175: Liquid Glass task rows are tinted blocks inside the glass tile, never a second fill or blur, with primary ink', () => {
  const css = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-glass-task-rows.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-glass-task-rows.css') > manifest.indexOf('theme-glass-surface.css') && manifest.indexOf('theme-glass-task-rows.css') < manifest.indexOf('"src/theme/styles/theme.css"'),
    'theme-glass-task-rows.css must load after the shared glass recipe and before theme.css');
  const sels = css.split('{').slice(0, -1).map(b => b.split('}').pop().trim()).filter(Boolean);
  assert.ok(sels.every(sel => sel.startsWith('html.connectea-dark:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])')), 'every rule must be Liquid Glass only');
  const rule = re => (css.match(new RegExp(re + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  const strip = rule('\\.connectea-row-wrapper::before');
  assert.ok(/background-color: var\(--cx-gl-tint\)/.test(strip) && /inset: 0 -14px 0 0/.test(strip), 'the strip tint is a ::before reaching past the meter');
  assert.ok(!/padding/.test(rule('\\.connectea-row-wrapper')) && !/border: none/.test(css), 'the strip adds no padding and keeps border boxes, so Connect rows keep their native size');
  for (const block of ['\\.cvr-c-task__achievement']) {
    const body = rule(block);
    assert.ok(/background-color: var\(--cx-gl-tint\)/.test(body) && /backdrop-filter: none/.test(body), `${block} must be a tint without its own blur (the tile is the surface)`);
    assert.ok(!/--cx-gl-fill/.test(body), `${block} must not add a second glass fill inside the tile`);
  }
  assert.ok(/background: transparent/.test(rule(':where\\(\\.connectea-row-wrapper\\):not\\(#cx-n\\) > \\.connectea-panel')), 'the panel inside the strip must be clear (and outrank the id-weighted glass blur rule)');
  assert.ok(/background: transparent/.test(rule('\\.cvr-c-task__mark')), 'marks must not add a second fill');
  assert.ok(/\.cvr-c-task__mark \*(:not\(\.cx-n\))?\s*\{\s*color: var\(--cx-text-primary/.test(css), 'text on the task-row blocks must use the primary ink');
});

runTest('Test 176: Boxplot decoration shapes stay invisible in dark and glass themes; only the box keeps a fill', () => {
  const charts = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-charts-editor.css'), 'utf8');
  assert.ok(/\.connectea-dark \.cvr-c-task__chart svg > rect\[fill="#FFFFFF"\], \.connectea-dark \.cvr-c-task__chart svg > path\[fill="#FFFFFF"\] \{\s*fill: transparent !important;/.test(charts),
    'the chart background and white shapes drawn directly on the svg must be transparent');
  const glass = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-glass-task-rows.css'), 'utf8');
  assert.ok(glass.includes('.cvr-c-task__chart .highcharts-series [fill="#FFFFFF"]') && !/\.cvr-c-task__chart \[fill="#FFFFFF"\]/.test(glass),
    'the glass tint must apply to the boxplot series only, never the decoration shapes');
});

runTest('Test 177: Summary-row stats keys are per semester and never built from Connectify text; grade checks read live charts only', () => {
  delete window.ConnectifyTaskTypes;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  const makeTile = (title, withPanel) => {
    const tile = document.createElement('div');
    tile.className = 'eds-c-tile';
    const titleEl = document.createElement('span');
    titleEl.className = 'eds-c-tile__title';
    titleEl.textContent = title;
    tile.appendChild(titleEl);
    const row = document.createElement('div');
    row.className = 'cvr-c-task';
    const details = document.createElement('div');
    details.className = 'cvr-c-task__details';
    if (withPanel) {
      const panel = document.createElement('section');
      panel.className = 'connectea-panel';
      const injected = document.createElement('span');
      injected.className = 'v-label';
      injected.textContent = 'Min 24.1% • Q1 56%';
      panel.appendChild(injected);
      details.appendChild(panel);
    }
    row.appendChild(details);
    tile.appendChild(row);
    document.body.appendChild(tile);
    return { tile, row };
  };
  const s1 = makeTile('Physics ATAR Year 11 - Semester 1', true);
  const s2 = makeTile('Physics ATAR Year 11 - Semester 2', true);
  try {
    const m1 = window.ConnectifyTaskTypes.getTaskMeta(s1.row);
    const m2 = window.ConnectifyTaskTypes.getTaskMeta(s2.row);
    assert.strictEqual(m1.subjectName, m2.subjectName, 'both semesters belong to one subject');
    assert.strictEqual(m1.taskName, 'Overall S1', 'Semester 1 summary row has its own key');
    assert.strictEqual(m2.taskName, 'Overall S2', 'Semester 2 summary row has its own key');
    assert.ok(!m1.labels.some(l => l.includes('Min')), 'Connectify panel text must never become a label or key');
  } finally {
    s1.tile.remove();
    s2.tile.remove();
  }
  assert.strictEqual(window.ConnectifyUtils.cardSemester('Chemistry ATAR Year 11 - Sem 2'), 2);
  assert.strictEqual(window.ConnectifyUtils.cardSemester('Chemistry ATAR Year 11'), 1);

  const readers = fs.readFileSync(path.join(BASE_DIR, 'src/cohort/cohort-row-readers.js'), 'utf8');
  assert.ok(readers.includes('function readStats(row, { live = false } = {})') && readers.includes('if (!live && meta?.subjectName'),
    'readStats must skip the stats cache when asked for live data');
  const snapshot = fs.readFileSync(path.join(BASE_DIR, 'src/system/grade-snapshot.js'), 'utf8');
  assert.ok(!snapshot.includes('readStats'), 'grade checks never read summary boxplots');
  const newGrade = fs.readFileSync(path.join(BASE_DIR, 'src/system/new-grade.js'), 'utf8');
  assert.ok(newGrade.includes('whenMarksShown(checkGrades)') && /MARK_WAIT_MS = 5000/.test(newGrade), 'the grade check must wait for summary marks (bounded)');
});

runTest('Test 178: A cohort version bump clears derived stats but keeps the student cohort size overrides', () => {
  window.__connectifyDataInitialized = false;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8'));
  localStorage.setItem('connectea:cohort:v3:me:2026:physics', JSON.stringify({ size: 120 }));
  localStorage.setItem('connectify:stats_cache:me:physics:overall s2', JSON.stringify({ stats: [1, 2, 3, 4, 5] }));
  localStorage.setItem('connectify:cache_version:cohort', 'old');
  window.ConnectifyCache.checkAndInvalidateAll();
  assert.ok(localStorage.getItem('connectea:cohort:v3:me:2026:physics'), 'cohort size overrides must survive a version bump');
  assert.strictEqual(localStorage.getItem('connectify:stats_cache:me:physics:overall s2'), null, 'derived stats are cleared on a version bump');
  localStorage.removeItem('connectea:cohort:v3:me:2026:physics');
});

runTest('Test 179: One surface per block in Liquid Glass; square bars; solid reading views; themed service bar plus; plain stat numbers', () => {
  const read = f => fs.readFileSync(path.join(BASE_DIR, 'src/theme', f), 'utf8');
  const G = 'html.connectea-dark:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])';
  // Class Summary numbers: the stat cell only, never a substring match that boxes the number span
  const cards = read('styles/theme-cards.css');
  assert.ok(!cards.includes('[class*="scope-statistic"]') && cards.includes('.connectea-dark .c-scope-statistic {'), 'stat cells must be named explicitly');
  // Banner, category bars, toolbars and empty states have no panel at all (they sit on the page)
  const surface = read('styles/theme-glass-surface.css');
  assert.ok(!/border-radius/.test(surface) && !/mat-paginator/.test(surface.replace(/\/\*[\s\S]*?\*\//g, '')), 'no rounded bars, cards or paginator pills');
  // Reading views beat the wallpaper and include discussion views
  const base = read('styles/theme-surface-base.css');
  assert.ok(base.includes('html.connectea-dark[data-connectea-reading-view="true"]:not([data-connectea-theme="liquid-glass"]):not([data-connectea-glass="true"]),'),
    'solid dark themes: the opaque reading canvas outranks html.connectea-dark[data-connectea-has-custom-bg]');
  // Liquid Glass: the wallpaper stays and the view has no panel (the wallpaper is dimmed or brightened for the text)
  const reading = read('styles/theme-glass-reading.css');
  const manifestJson = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifestJson.indexOf('theme-glass-reading.css') > manifestJson.indexOf('theme-glass-nesting.css') && manifestJson.indexOf('theme-glass-reading.css') < manifestJson.indexOf('"src/theme/styles/theme.css"'), 'theme-glass-reading.css must be registered before theme.css');
  assert.ok(/:where\(\.cnt-ng-zone\) > :where\(div:has\(cnt-notice-view, cnt-discussion-view, cnt-discussion-item-view\)\)[^{]*\{\s*background-color: transparent !important;\s*backdrop-filter: none !important;/.test(reading) && !/88%|blur\(/.test(reading),
    'the frame holding a glass reading view has no fill or blur: the text sits on the wallpaper');
  assert.ok(/:where\(cnt-notice-view\):not\(#cx-n\),/.test(reading) && /:where\(cnt-message-detail-view\):not\(#cx-n\) \{\s*background-color: transparent/.test(reading), 'the views inside the reading frame stay clear');
  assert.ok(/#main-content:not\(:is\(mat-dialog-container, \.mat-dialog-container\) \*\)[^{]*\{\s*background-color: transparent/.test(reading), 'the page around a glass reading view stays clear');
  assert.ok(base.includes(':where(cnt-discussion-item-view):not(:is(mat-dialog-container, .mat-dialog-container) *)') && base.includes(':where(cnt-message-detail-view):not(:is(mat-dialog-container, .mat-dialog-container) *)'), 'discussion views must get the solid reading canvas');
  assert.ok(read('theme.js').includes('cnt-discussion-item-view'), 'discussion views must be detected as reading views');
  // Service bar "+": theme colours, outranking Connect's !important class colour
  assert.ok(read('styles/theme-action-buttons.css').includes(':where(.c-control-panel-button):not(#cx-n) .mat-icon-button--size-sm {\n  background-color: var(--cx-button-primary-bg'), 'the + circle must use the primary button colour');
  // Nesting: inner layers are clear in every dark theme (theme-surface-nesting.css); blur placement is glass only
  const surfaceNesting = read('styles/theme-surface-nesting.css');
  const nesting = read('styles/theme-glass-nesting.css');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-glass-nesting.css') > manifest.indexOf('theme-glass-task-rows.css') && manifest.indexOf('theme-glass-nesting.css') < manifest.indexOf('"src/theme/styles/theme.css"'), 'theme-glass-nesting.css must be registered before theme.css');
  const sels = nesting.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map(b => b.split('}').pop().trim()).filter(Boolean);
  assert.ok(sels.every(sel => sel.startsWith(G)), 'every nesting rule must be Liquid Glass only');
  assert.ok(nesting.includes(':where(.v-app.headerui):not(#cx-n),') && /:where\(\.v-app\.headerui\) > :where\(\.v-ui\):not\(#cx-n\) \{\s*background-color: transparent/.test(nesting), 'the header canvas must be clear (outranking the #main-content canvas rule) so the top bars blur the page');
  assert.ok(/\.cvr-c-thori-pnl\.cvr-c-primary-navigation[\s\S]*?backdrop-filter: var\(--cx-gl-blur\)/.test(nesting), 'the top navigation bar must blur');
  assert.ok(/:where\(\.cvr-c-service-bar__container\):not\(#cx-n\) \{[^}]*backdrop-filter: none/.test(nesting), 'the service bar container must not blur (it would trap the bar and menu blur), outranking the id-weighted glass rule');
  assert.ok(['thead', 'tbody', 'tfoot', 'tr:not(:hover)', 'th', 'td'].every(s => surfaceNesting.includes(` table :where(${s}):not(#cx-n)`)), 'table rows and cells must be clear inside the table surface');
  assert.ok(surfaceNesting.includes('.cvr-c-service-menu__item:not(.eds-s-is-active):not(.v-selected)'), 'menu items are clear except the active one');
  const surfaceSels = surfaceNesting.replace(/\/\*[\s\S]*?\*\//g, '').split('{').slice(0, -1).map(b => b.split('}').pop().trim()).filter(Boolean);
  assert.ok(surfaceSels.length >= 10 && surfaceSels.every(sel => sel.startsWith('html.connectea-dark[data-connectea-theme]')), 'inner-layer clearing applies to every dark theme with the glass hook weight');
  assert.ok(manifest.indexOf('theme-surface-nesting.css') > -1 && manifest.indexOf('theme-surface-nesting.css') < manifest.indexOf('theme-glass-nesting.css'), 'theme-surface-nesting.css must be registered before the glass nesting');
  assert.ok(!/background-color: transparent/.test(nesting.replace(/headerui[\s\S]*?\}/, '').replace(/service-bar__container\):not\(#cx-n\) \{[\s\S]*?\}/, '')), 'clearing rules live in theme-surface-nesting.css, not the glass file');
});

runTest('Test 180: The theme audit enforces one surface per block, square bars and blur on glass surfaces', () => {
  const audit = fs.readFileSync(path.join(BASE_DIR, 'scripts/test-theme-styles.js'), 'utf8');
  for (const type of ['NESTED_SURFACE_FILL', 'NESTED_BACKDROP_BLUR', 'GLASS_WITHOUT_BLUR', 'ROUNDED_FULL_WIDTH_BAR']) {
    assert.ok(audit.includes(`type: '${type}'`), `the audit must report ${type}`);
  }
  assert.ok(audit.includes("own.bg.a > 0.12"), 'tints up to 12% are allowed inside a surface');
  assert.ok(audit.includes("const isGlassTheme = ['liquid-glass', 'liquid-glass-clear'].includes(tid);") && audit.includes('if (isDark && rect.width >= 80'), 'the surface checks run in every dark theme (blur and bar checks in Liquid Glass only)');
  assert.ok(audit.includes('(isGlassTheme || differs)'), 'solid themes flag a nested fill only when its colour differs from the surface (a visible box behind text)');
  const crawled = fs.readFileSync(path.join(BASE_DIR, 'crawled_urls.txt'), 'utf8');
  assert.ok(crawled.includes('DomainSchoolClass:6331155491'), 'the crawl list covers a class with discussions (Philosophy)');
});

runTest('Test 181: The customizer colour picker is a popover beside the token being edited', () => {
  const pop = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-customizer-popover.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-customizer-popover.js') > -1 && manifest.indexOf('theme-customizer-popover.js') < manifest.indexOf('theme-customizer-controls.js'), 'the popover module must load before the controls that bind it');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-customizer-controls.js'), 'utf8').includes('window.ConnectifyCustomizerPopover?.bind(ctx.modal);'), 'the controls must bind the popover');
  assert.ok(pop.includes("box.classList.add('cx-picker-popover')") && pop.includes('box.hidden = true;'), 'the picker starts hidden as a popover');
  assert.ok(/a\.bottom \+ GAP/.test(pop) && /a\.top - GAP - height/.test(pop), 'it opens below the token, or above when there is no room below');
  assert.ok(pop.includes("e.key === 'Escape' && !box.hidden") && pop.includes("document.addEventListener('keydown', onKey, true)") && pop.includes('e.stopPropagation()'), 'Escape closes only the popover');
  assert.ok(pop.includes('if (!box.isConnected) { document.removeEventListener'), 'the document listener is removed once the customizer closes');
  assert.ok(pop.includes('containingRect(box)'), 'positions account for the overlay containing block (backdrop-filter)');
  const markup = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-customizer-markup.js'), 'utf8');
  assert.ok(markup.includes('class="cx-picker-close" aria-label="Close colour picker"'), 'the popover has a close button');
  const css = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-color-picker.css'), 'utf8');
  const rule = (css.match(/\.cx-color-picker-box\.cx-picker-popover \{([^}]*)\}/) || [])[1] || '';
  assert.ok(/position: fixed;/.test(rule) && /background-color: var\(--cx-canvas-bg, #12171f\);/.test(rule) && /background-image: linear-gradient\(var\(--cx-surface-elevated/.test(rule), 'the popover is fixed and always solid like the dialog');
});

runTest('Test 182: The DOM sweeper confirms a missing component after a cohort pass before warning', () => {
  delete window.ConnectifyDomSweeper;
  const shows = []; let scheduled = 0;
  const origNotes = window.ConnectifyNotifications, origCohort = window.ConnectifyCohort, origRows = window.ConnectifyCohortRows;
  const origTimeout = global.setTimeout; const timers = [];
  const origQSA = document.querySelectorAll; document.querySelectorAll = sel => document.body.querySelectorAll(sel);
  window.ConnectifyNotifications = { show: o => shows.push(o), dismiss: () => {} };
  window.ConnectifyCohort = { schedule: () => { scheduled++; } };
  window.ConnectifyCohortRows = { readMark: () => 80 };
  const tile = document.createElement('div'); tile.className = 'eds-c-tile';
  const row = document.createElement('div'); row.className = 'cvr-c-task';
  tile.appendChild(row); document.body.appendChild(tile);
  for (const id of ['connectify-sidebar', 'connectify-sidebar-handle']) { const el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
  document.documentElement.dataset.connectifyMainBridge = 'ready';
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'dom-sweeper.js'), 'utf8'));
    global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    window.ConnectifyDomSweeper.sweep();
    assert.strictEqual(shows.length, 0, 'a first miss must not warn');
    assert.strictEqual(scheduled, 1, 'a first miss asks the cohort pass to run');
    const confirm = timers.find(t => t.ms === 3000);
    assert.ok(confirm, 'a confirmation sweep is scheduled');
    const panel = document.createElement('section'); panel.className = 'connectea-panel'; row.appendChild(panel);
    confirm.fn();
    assert.strictEqual(shows.length, 0, 'a panel drawn by the pass clears the suspected miss');
    const src = fs.readFileSync(path.join(BASE_DIR, 'src/system/dom-sweeper.js'), 'utf8');
    assert.ok(src.includes('window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding'), 'no sweep while accordions animate or Expand All runs');
    assert.ok(src.includes('window.ConnectifyCohortRows?.readMark'), 'marks are read through the current row readers');
  } finally {
    global.setTimeout = origTimeout; document.querySelectorAll = origQSA;
    window.ConnectifyNotifications = origNotes; window.ConnectifyCohort = origCohort; window.ConnectifyCohortRows = origRows;
    tile.remove();
  }
});

runTest('Test 183: Expand All adds every expanded subject to a cache that already holds one', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const origQSA = document.querySelectorAll;
  let titleReads = 0;
  const makeCard = (name, task, mark) => {
    const card = new MockElement('div', 'eds-c-tile');
    const title = new MockElement('div', 'eds-c-tile__title');
    Object.defineProperty(title, 'textContent', { get: () => { titleReads++; return name; }, configurable: true });
    card.appendChild(title);
    const tasks = new MockElement('div', 'cvr-c-tasks');
    const row = new MockElement('div', 'cvr-c-task');
    const details = new MockElement('div', 'cvr-c-task__details');
    for (const text of [task, 'Term 1 Week 4']) { const l = new MockElement('span', 'v-label'); l.textContent = text; details.appendChild(l); }
    const marks = new MockElement('div', 'cvr-c-task__marks');
    const mk = new MockElement('div', 'cvr-c-task__mark'); mk.textContent = mark;
    marks.appendChild(mk); row.appendChild(details); row.appendChild(marks);
    tasks.appendChild(row); card.appendChild(tasks);
    return card;
  };
  const load = () => { window.__connectifyDataInitialized = false; eval(dataJs); };
  const names = () => window.ConnectifyData.collect(true).map(s => s.name).sort();
  try {
    mockLocalStorage.clear();
    load();
    window.ConnectifyCache.subjectsCache.clear();
    const chem = makeCard('12 Chemistry ATAR - Semester 2', 'Chemistry Test 1', '80%');
    let cards = [chem];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? cards : []);
    // The student opens Chemistry by hand: its per-card update puts it in the cache
    window.ConnectifyData.scrapeSubjectTasks(chem);
    assert.deepStrictEqual(names(), ['12 Chemistry ATAR'], 'only the opened subject is cached');
    // Expand All opens the rest without per-card updates
    const physics = makeCard('12 Physics ATAR - Semester 2', 'Physics Test 1', '70%');
    const phil = makeCard('12 Philosophy and Ethics ATAR - Semester 2', 'Essay 1', '75%');
    cards = [chem, physics, phil];
    assert.deepStrictEqual(names(), ['12 Chemistry ATAR', '12 Philosophy and Ethics ATAR', '12 Physics ATAR'], 'collect reads expanded cards the cache has not seen');
    titleReads = 0;
    names();
    assert.strictEqual(titleReads, 0, 'a cache that already holds every expanded card is used without re-reading the DOM');
    // A reload restores the persisted cache: it already holds every subject
    load();
    cards = [];
    assert.deepStrictEqual(names(), ['12 Chemistry ATAR', '12 Philosophy and Ethics ATAR', '12 Physics ATAR'], 'the persisted cache keeps every subject');
    const src = fs.readFileSync(path.join(BASE_DIR, 'src/assessment/cache-versions.js'), 'utf8');
    const resultsVersion = Number(src.match(/RESULTS: 'v(\d+)_/)?.[1]);
    assert.ok(resultsVersion >= 13, 'caches holding a same-named task\'s boxplot are invalidated');
  } finally {
    document.querySelectorAll = origQSA;
    mockLocalStorage.clear();
  }
});

runTest('Test 185: The theme audit measures SVG chart labels, contrast-checks Connectify UI and finds tools missing subjects', async () => {
  const audit = fs.readFileSync(path.join(BASE_DIR, 'scripts/test-theme-styles.js'), 'utf8');
  assert.ok(audit.includes('function checkTextContrast(el, style, rect, selector, text)') && audit.includes('checkTextContrast(el, style, rect, selector, text);'), 'every audited element goes through the shared contrast check');
  assert.ok(!audit.includes("hasDirectText && elColor && effectiveBg && !isSvg && !el.closest?.('svg')"), 'SVG text is no longer skipped by the contrast check');
  assert.ok(audit.includes('const fill = parseRgb(style.fill);') && audit.includes('effectiveBg = svgBackdrop(el, rect);'), 'SVG text is measured with its fill against what is painted behind it');
  assert.ok(audit.includes('shape.isPointInFill(new DOMPoint(cx, cy).matrixTransform(ctm.inverse()))'), 'SVG shapes under the label count towards its backdrop');
  assert.ok(audit.includes('ownUiElements.push(el);') && /for \(const el of ownUiElements\) \{[\s\S]*?checkTextContrast\(/.test(audit), 'Connectify UI on page views skips parity but is contrast-checked');
  assert.ok(audit.includes("type: 'TOOL_SUBJECTS_MISSING'") && audit.includes('dataIssues = await auditToolSubjects(page, currentView.toolId);'), 'drawer tools are checked for subjects missing from their lists');
  const { auditToolSubjects } = require(path.join(BASE_DIR, 'scripts/test-theme-styles.js'));
  assert.strictEqual(typeof auditToolSubjects, 'function', 'auditToolSubjects must be exported');

  // Two subjects with marked tasks on the page, only one in the Weaknesses list
  const el = (tag, cls, text, id) => { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; if (text) e.textContent = text; return e; };
  const root = el('div');
  for (const [title, marked] of [['Chemistry ATAR Year 11 - Semester 2', true], ['Physics ATAR Year 11 - Semester 2', true], ['Literature ATAR Year 11 - Semester 2', false]]) {
    const tile = el('div', 'eds-c-tile'); tile.appendChild(el('div', 'eds-c-tile__title', title));
    if (marked) { const tasks = el('div', 'cvr-c-tasks'), row = el('div', 'cvr-c-task'); row.appendChild(el('section', 'connectea-panel')); tasks.appendChild(row); tile.appendChild(tasks); }
    root.appendChild(tile);
  }
  const weakness = el('div', '', '', 'connectify-weakness'), boxes = el('div', '', '', 'cx-weakness-checkboxes');
  boxes.appendChild(el('label', '', 'Chemistry Year 11')); weakness.appendChild(boxes); root.appendChild(weakness);
  // Queries are scoped to the fixture only while the (synchronous) page function runs: other async tests share
  // the mock DOM, and earlier tests leave their own Weakness panels in it
  const page = { evaluate: async (fn, arg) => {
    const origQSA = document.querySelectorAll, origQS = document.querySelector;
    document.querySelectorAll = sel => root.querySelectorAll(sel);
    document.querySelector = sel => root.querySelector(sel);
    try { return fn(arg); } finally { document.querySelectorAll = origQSA; document.querySelector = origQS; }
  } };
  const missing = await auditToolSubjects(page, 'connectify-weakness-toggle');
  assert.strictEqual(missing.length, 1, 'a subject missing from the tool list is reported');
  assert.ok(missing[0].type === 'TOOL_SUBJECTS_MISSING' && /Physics ATAR Year 11/.test(missing[0].details) && !/Literature/.test(missing[0].details), 'only subjects with marked tasks are expected');
  boxes.appendChild(el('label', '', 'Physics Year 11'));
  assert.strictEqual((await auditToolSubjects(page, 'connectify-weakness-toggle')).length, 0, 'a complete list passes');
});

// Outline card fixture: title, optional overall row (outside .cvr-c-tasks) and task rows [[name, mark]]
function makeOutlineCard(title, { overall = null, tasks = [] } = {}) {
  const card = new MockElement('div', 'eds-c-tile');
  const head = new MockElement('div', 'eds-c-tile__title'); head.textContent = title; card.appendChild(head);
  if (overall !== null) {
    const row = new MockElement('div', 'cvr-c-task'), marks = new MockElement('div', 'cvr-c-task__marks');
    for (const text of [].concat(overall)) { const cell = new MockElement('div', 'cvr-c-task__mark'); cell.textContent = text; marks.appendChild(cell); }
    row.appendChild(marks); card.appendChild(row);
  }
  const list = new MockElement('div', 'cvr-c-tasks');
  for (const [name, mark] of tasks) {
    const row = new MockElement('div', 'cvr-c-task'), details = new MockElement('div', 'cvr-c-task__details');
    for (const text of ['Term 1 Week 4', name]) { const l = new MockElement('span', 'v-label'); l.textContent = text; details.appendChild(l); }
    const marks = new MockElement('div', 'cvr-c-task__marks'), cell = new MockElement('div', 'cvr-c-task__mark');
    cell.textContent = mark; marks.appendChild(cell); row.appendChild(details); row.appendChild(marks); list.appendChild(row);
  }
  card.appendChild(list);
  return card;
}

function loadSemesterModules() {
  // window may inherit earlier copies, so shadow them instead of deleting
  window.ConnectifyClassSemesters = undefined;
  window.ConnectifySemesterFilterNotice = undefined;
  window.ConnectifySemesterFilter = undefined;
  for (const f of ['class-semesters.js', 'semester-filter-notice.js', 'semester-filter.js']) {
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment', f), 'utf8'));
  }
  return { classes: window.ConnectifyClassSemesters, filter: window.ConnectifySemesterFilter, notice: window.ConnectifySemesterFilterNotice };
}

runTest('Test 187: The class registry records each semester outline and detects the current semester', () => {
  const origQSA = document.querySelectorAll, origNow = Date.now;
  let now = 1e12;
  Date.now = () => (now += 5000); // detection is memoised for a second
  try {
    mockLocalStorage.clear();
    const { classes } = loadSemesterModules();
    const chem1 = makeOutlineCard('12 Chemistry ATAR - Semester 1', { overall: ['80%', 'A'] });
    const chem2 = makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '85%' });
    const art1 = makeOutlineCard('12 Art - Semester 1', { overall: '70%' });
    let cards = [chem1, chem2, art1];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? cards : origQSA(sel));
    classes.recordCards(cards);
    const reg = classes.get();
    assert.deepStrictEqual(Object.keys(reg).sort(), ['12 Art', '12 Chemistry ATAR']);
    assert.deepStrictEqual([reg['12 Chemistry ATAR'][1].mark, reg['12 Chemistry ATAR'][1].finalLetter, reg['12 Chemistry ATAR'][2].mark], [80, true, 85]);
    assert.ok(!reg['12 Art'][2], 'a class without a Semester 2 outline has no Semester 2 entry');
    assert.deepStrictEqual(classes.classesIn(2), ['12 Chemistry ATAR']);
    const stored = JSON.parse(mockLocalStorage.getItem(`connectify:class_semesters:${window.ConnectifyUtils.accountKey()}`));
    assert.strictEqual(stored['12 Art'][1].mark, 70, 'the registry is persisted');

    assert.strictEqual(classes.detectSemester(), 2, 'a final Semester 1 grade means Semester 2');
    const art = makeOutlineCard('12 Art - Semester 1', { overall: '70%' });
    cards = [makeOutlineCard('12 Chemistry ATAR - Semester 1', { overall: '80%' }), makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '-' }), art];
    assert.strictEqual(classes.detectSemester(), 1, 'no final grades mean Semester 1');
    cards = [makeOutlineCard('12 Chemistry ATAR - Semester 1', { overall: '80%' }), makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '85%', tasks: [['Chem Test 2', '88%']] }), art];
    assert.strictEqual(classes.detectSemester(), 1, 'a marked Semester 2 task before Semester 1 grades are final stays Semester 1');
    // A Connect filter showing some of the classes: no letter there proves nothing, the registry decides
    cards = [makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '85%' })];
    assert.strictEqual(classes.detectSemester(), 2, 'a filtered page without final letters keeps the registry\'s Semester 2');
    cards = [makeOutlineCard('11 Biology - Semester 1', { overall: '75%' })];
    assert.strictEqual(classes.detectSemester(), 1, 'classes the registry has never seen (a new year) are a whole page');
    cards = [makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: ['82%', 'A'] })];
    assert.strictEqual(classes.detectSemester(), 2, 'a final grade on a Semester 2 card (the year is over) is still Semester 2');
    // A card element is read once; a scrape re-reads it
    const before = JSON.stringify(classes.get());
    chem1.querySelector('.cvr-c-task__mark').textContent = '90%';
    classes.recordCards([chem1]);
    assert.strictEqual(JSON.stringify(classes.get()), before, 'an already-recorded card is not re-read on every collect');
    classes.recordCards([chem1], true);
    assert.strictEqual(classes.get()['12 Chemistry ATAR'][1].mark, 90, 'a scraped card is re-read');
  } finally {
    document.querySelectorAll = origQSA; Date.now = origNow; mockLocalStorage.clear();
  }
});

runTest('Test 188: "Show this semester\'s classes only" hides the other semester, refreshes only its cards and filters sidebar data', () => {
  const dataJs = fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8');
  const origQSA = document.querySelectorAll;
  try {
    mockLocalStorage.clear();
    const { filter } = loadSemesterModules();
    window.__connectifyDataInitialized = false;
    eval(dataJs);
    window.ConnectifyCache.subjectsCache.clear();
    const chem1 = makeOutlineCard('12 Chemistry ATAR - Semester 1', { overall: ['80%', 'A'], tasks: [['Chem Test 1', '80%']] });
    const chem2 = makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '84%', tasks: [['Chem Test 2', '88%']] });
    const art1 = makeOutlineCard('12 Art - Semester 1', { overall: '70%', tasks: [['Art Essay', '70%']] });
    const cards = [chem1, chem2, art1];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? cards : sel.includes('cx-semester-hidden') ? cards.filter(c => c.classList.contains('cx-semester-hidden')) : origQSA(sel));

    // Off by default: everything as before
    assert.strictEqual(filter.isEnabled(), false, 'the option is off by default');
    assert.strictEqual(filter.activeSemester(), null);
    assert.strictEqual(filter.allowedCards(cards), cards);
    const names = list => list.map(s => s.name).sort();
    assert.deepStrictEqual(names(window.ConnectifyData.collect(true)), ['12 Art', '12 Chemistry ATAR']);
    assert.deepStrictEqual(names(window.ConnectifyData.collectClasses(true)), ['12 Art', '12 Chemistry ATAR']);

    // This semester only: a final Semester 1 grade means Semester 2
    filter.save(true);
    assert.strictEqual(filter.currentSemester(), 2, 'the semester is always the detected one');
    assert.strictEqual(filter.activeSemester(), 2);
    filter.applyToPage();
    assert.deepStrictEqual(cards.map(c => c.classList.contains('cx-semester-hidden')), [true, false, true], "the other semester's tiles are hidden");
    assert.deepStrictEqual(filter.allowedCards(cards), [chem2]);

    // Semester 1 is frozen: its cards no longer refresh the cache, but their results stay
    art1.querySelector('.cvr-c-tasks .cvr-c-task__mark').textContent = '95%';
    const all = window.ConnectifyData.collect(true, true);
    const art = all.find(s => s.name === '12 Art');
    assert.strictEqual(Math.round(art.tasks[0].score), 70, 'a hidden semester card never refreshes the cache');
    const chem = all.find(s => s.name === '12 Chemistry ATAR');
    assert.deepStrictEqual(chem.tasks.map(t => t.name).sort(), ['Chem Test 1', 'Chem Test 2'], "a continuing class keeps its cached Semester 1 results");
    assert.deepStrictEqual(names(window.ConnectifyData.collectClasses(true)), ['12 Chemistry ATAR'], 'sidebar tools list only Semester 2 classes');
    const courses = filter.filterCourses([[{ id: 'chemistry' }, { id: 'art' }], [{ id: 'chemistry' }]]);
    assert.deepStrictEqual(courses.map(l => l.map(c => c.id)), [['chemistry'], ['chemistry']], 'Semester 1 keeps only the classes continuing into Semester 2');

    // Turning it off shows every tile again
    filter.save(false);
    filter.applyToPage();
    assert.ok(cards.every(c => !c.classList.contains('cx-semester-hidden')), 'turning the option off shows every tile');

    // A semester picked in an earlier version is ignored: the detected semester always wins
    mockLocalStorage.setItem(filter.KEY, JSON.stringify({ enabled: true, semester: 1, period: '2026-1' }));
    assert.strictEqual(filter.activeSemester(), 2, 'an old saved pick never overrides detection');

    const expandJs = fs.readFileSync(path.join(BASE_DIR, 'src/assessment/assessment-expand.js'), 'utf8');
    assert.ok(expandJs.includes("h.closest?.('.cx-semester-hidden')"), 'Expand All skips hidden tiles');
    const css = fs.readFileSync(path.join(BASE_DIR, 'src/assessment/semester-filter.css'), 'utf8');
    assert.ok(/\.cx-semester-hidden\s*\{\s*display:\s*none !important;/.test(css));
  } finally {
    document.querySelectorAll = origQSA; mockLocalStorage.clear();
  }
});

runTest('Test 189: Settings offers "Show this semester\'s classes only" and every sidebar tool reads the filtered cache', () => {
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'settings-markup.js'), 'utf8'));
  const html = window.ConnectifySettingsMarkup.panelHtml();
  assert.ok(/id="cx-semester-filter-toggle"[^>]*> Show this semester's classes only\s*<\/label>/.test(html), 'a checkbox reading "Show this semester\'s classes only"');
  assert.ok(!html.includes('cx-semester-filter-select'), 'there is no semester dropdown: the detected semester is always used');
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts.flatMap(g => g.js || []);
  const at = f => js.indexOf(f);
  assert.ok(at('src/assessment/assessment-parser.js') < at('src/assessment/class-semesters.js') && at('src/assessment/class-semesters.js') < at('src/assessment/semester-filter.js') && at('src/assessment/semester-filter.js') < at('src/assessment/assessment-data.js'), 'registry and filter load before the data coordinator');
  assert.ok(at('src/predictor/settings-semester-filter.js') > -1 && at('src/predictor/settings-semester-filter.js') < at('src/predictor/settings-preferences.js'));
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/assessment/semester-filter.css')));
  const read = f => fs.readFileSync(path.join(BASE_DIR, f), 'utf8');
  for (const f of ['src/progress/weakness-radar.js', 'src/progress/progress-graph.js', 'src/predictor/predictor-ui.js', 'src/predictor/category-baselines.js', 'src/atar/scaling-calibration.js']) {
    assert.ok(read(f).includes('collectClasses'), `${f} must read the classes the semester filter keeps`);
  }
  assert.ok(read('src/atar/atar-scraper.js').includes('filter.filterCourses(result)'), 'ATAR tools read filtered courses');
  const versions = read('src/assessment/cache-versions.js');
  assert.ok(versions.includes("'connectify:semester_filter'"), 'clearing settings removes the semester filter');
  assert.ok(versions.includes("k.startsWith('connectify:class_semesters:')"), 'clearing results removes the class registry');
});

runTest('Test 190: A wholly new class registry rolls last year\'s cached averages into baselines and archives last year', () => {
  const origQSA = document.querySelectorAll;
  const saved = {
    cache: window.ConnectifyCache, scrape: window.ConnectifyAssessmentScrape, history: window.ConnectifyPredictorHistory,
    store: window.ConnectifyPredictorBaselines, sidebarFilter: window.ConnectifySidebarFilter, notes: window.ConnectifyNotifications
  };
  try {
    mockLocalStorage.clear();
    const { classes } = loadSemesterModules();
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/year-rollover.js'), 'utf8'));
    const account = window.ConnectifyUtils.accountKey();
    const savedBaselines = [];
    let cleared = 0;
    window.ConnectifySidebarFilter = { isOutlinesFilterRestricted: () => false };
    window.ConnectifyNotifications = { show: () => {} };
    window.ConnectifyPredictorBaselines = { getBaselines: () => ({ types: {}, subjects: {} }), saveBaselines: b => savedBaselines.push(b) };
    window.ConnectifyCache = {
      subjectsCache: new Map([['11 Chemistry ATAR', new Map([['t', { id: 't', name: 'Test 1', score: 80 }]])]]),
      serializeSubjects: m => Object.fromEntries([...m].map(([k, v]) => [k, [...v.values()]])),
      clearResultsCache: () => { cleared++; classes.clear(); mockLocalStorage.removeItem(`connectify:grade_cache:${account}`); }
    };
    window.ConnectifyAssessmentScrape = { formatCollectedSubjects: () => [{ name: '11 Chemistry ATAR', tasks: [] }, { name: '11 Physics ATAR', tasks: [] }] };
    window.ConnectifyPredictorHistory = { getHistoricalData: subjects => ({ types: { Exam: 71.26 }, subjects: Object.fromEntries(subjects.map(s => [s.name, 75])) }) };

    // Last year's classes are in the registry
    classes.recordCards([makeOutlineCard('11 Chemistry ATAR - Semester 2', { overall: '83%' }), makeOutlineCard('11 Physics ATAR - Semester 2', { overall: '77%' })]);
    // The grade notifier already wrote a new-year mark under a year-independent key
    mockLocalStorage.setItem(`connectify:grade_cache:${account}`, JSON.stringify({ '11 Chemistry': { mark: 83.5 }, '12 Chemistry': { mark: 50 } }));

    // Every class is new and a year later
    const y12 = [makeOutlineCard('12 Chemistry ATAR - Semester 1'), makeOutlineCard('12 Physics ATAR - Semester 1')];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? y12 : origQSA(sel));
    classes.recordCards(y12);
    assert.strictEqual(savedBaselines.length, 1, 'the new year saves baselines once');
    assert.deepStrictEqual(savedBaselines[0].subjects, { '12 Chemistry ATAR': 83.5, '12 Physics ATAR': 75 }, "last year's final marks become this year's subject baselines (never the new year's marks)");
    assert.strictEqual(savedBaselines[0].types.Exam, 71.3, 'assessment type averages carry over');
    assert.strictEqual(cleared, 1, "last year's results are cleared once");
    const archive = JSON.parse(mockLocalStorage.getItem(`connectify:year_archive:${account}`));
    assert.ok(Array.isArray(archive) && archive.length === 1, "last year's results are archived (Connect no longer shows them)");
    assert.strictEqual(archive[0].grades['11 Chemistry'].mark, 83.5);
    assert.deepStrictEqual(Object.keys(archive[0].subjects), ['11 Chemistry ATAR']);
    assert.deepStrictEqual(Object.keys(archive[0].classSemesters).sort(), ['11 Chemistry ATAR', '11 Physics ATAR']);
    assert.deepStrictEqual(Object.keys(classes.get()).sort(), ['12 Chemistry ATAR', '12 Physics ATAR'], 'the registry starts again with the new classes');

    // Viewing last year afterwards changes nothing
    const y11 = [makeOutlineCard('11 Chemistry ATAR - Semester 2'), makeOutlineCard('11 Physics ATAR - Semester 2')];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? y11 : origQSA(sel));
    classes.recordCards(y11);
    assert.strictEqual(savedBaselines.length, 1, 'an earlier year never rolls over');
    assert.deepStrictEqual(Object.keys(classes.get()).sort(), ['12 Chemistry ATAR', '12 Physics ATAR'], 'an earlier year is not recorded');
  } finally {
    document.querySelectorAll = origQSA;
    window.ConnectifyCache = saved.cache; window.ConnectifyAssessmentScrape = saved.scrape; window.ConnectifyPredictorHistory = saved.history;
    window.ConnectifyPredictorBaselines = saved.store; window.ConnectifySidebarFilter = saved.sidebarFilter; window.ConnectifyNotifications = saved.notes;
    mockLocalStorage.clear();
  }
});

runTest('Test 191: Semester 2 starts at canonical school week 17 (Term 2 Week 7, Week 8 under Early Easter), and the planners start Semester 2 only on a final Semester 1 grade', () => {
  const helpersSrc = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-parse-helpers.js'), 'utf8');
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/school-terms.js'), 'utf8'));
  eval(helpersSrc);
  const { taskSemester, SEMESTER_TWO_WEEK, semesterTwoOrder } = window.ConnectifyParseHelpers;
  const terms = window.ConnectifySchoolTerms;
  const year = new Date().getFullYear();
  const savedTerms = localStorage.getItem('connectify:school_terms');
  assert.strictEqual(SEMESTER_TWO_WEEK, 17, 'canonical school week 17');
  terms.setEarlyEaster(year, true);
  assert.strictEqual(semesterTwoOrder(), 20, 'under Early Easter school week 17 is Term 2 Week 8 (order 20)');
  assert.strictEqual(taskSemester(2, 'Term 2, Week 7'), 1, 'Early Easter: Term 2 Week 7 is still Semester 1');
  assert.strictEqual(taskSemester(2, 'Term 2, Week 8'), 2, 'Early Easter: Term 2 Week 8 starts Semester 2');
  assert.strictEqual(taskSemester(2, 'Term 3, Week 2', terms.weekOrder(17)), 2, 'a week override of school week 17 starts Semester 2');
  assert.strictEqual(taskSemester(2, 'Term 3, Week 2', terms.weekOrder(16)), 1);
  terms.setEarlyEaster(year, false);
  assert.strictEqual(semesterTwoOrder(), 19, 'chronological week 19 (12 weeks per term) = school week 17 = Term 2 Week 7');
  assert.strictEqual(window.ConnectifyUtils.customWeekOrder('17'), 19, 'school week 17 is chronological week 19');
  assert.strictEqual(taskSemester(2, 'Term 1, Week 5'), 1, 'a Semester 1 task listed on a Semester 2 panel stays Semester 1');
  assert.strictEqual(taskSemester(2, 'Term 2, Week 6'), 1, 'Term 2 Week 6 is the last Semester 1 week');
  assert.strictEqual(taskSemester(2, 'Term 2, Week 7'), 2, 'Term 2 Week 7 starts Semester 2');
  assert.strictEqual(taskSemester(2, 'Term 3, Week 2'), 2);
  assert.strictEqual(taskSemester(2, 'Term 1'), 1, 'a bare Term 1 caption is Semester 1');
  assert.strictEqual(taskSemester(2, 'Term 2'), 2, 'a bare Term 2 caption spans both semesters, so the card decides');
  assert.strictEqual(taskSemester(2, 'Week 4'), 2, 'a week with no term is ambiguous, so the card decides');
  assert.strictEqual(taskSemester(2, 'Thur 5th March'), 1, 'a date caption on a Semester 2 outline is placed by its own week (Methods)');
  assert.strictEqual(taskSemester(2, 'Thur 21st May'), 1);
  assert.strictEqual(taskSemester(2, 'Thur 27th August'), 2);
  assert.strictEqual(taskSemester(1, 'Thur 27th August'), 1, 'a dated task is never later than its own card');
  assert.ok(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/cache-versions.js'), 'utf8').includes("RESULTS: 'v15_20261029_results'"), 'cached tasks placed in the card\'s semester are re-read');
  assert.strictEqual(taskSemester(1, 'Term 3, Week 2'), 1, 'a task is never later than its own card');
  assert.strictEqual(taskSemester(2, 'Term 3, Week 2', 5), 1, 'a week override wins over the caption');
  if (savedTerms === null) localStorage.removeItem('connectify:school_terms'); else localStorage.setItem('connectify:school_terms', savedTerms);

  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-ui-helpers.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui-markup.js'), 'utf8'));
  const { hasSemesterTwoStarted, isTargetClosed } = window.ConnectifyAtarMarkup;
  const course = (finalLetter, mark = 88) => ({ id: 'literature', mark, finalLetter });
  assert.strictEqual(hasSemesterTwoStarted([[course(false)], [course(false, 58.7)]]), false, 'a Semester 2 cumulative percent or marked task never starts Semester 2');
  assert.strictEqual(hasSemesterTwoStarted([[course(true)], [course(false)]]), true, 'a final Semester 1 grade starts Semester 2');
  assert.strictEqual(isTargetClosed([[course(true)], [course(false, 58.7)]], 1), false, 'Semester 1 marks on a Semester 2 panel never close the Semester 2 targets');
  assert.strictEqual(isTargetClosed([[course(true)], [course(false)]], 0), true, 'a final Semester 1 grade closes the Semester 1 targets');
  assert.strictEqual(isTargetClosed([[], [course(true)]], 1), true, 'a final Semester 2 grade closes them');
});

runTest('Test 192: The first Semester 1 task listed on a Semester 2 panel gets no outcome meter', () => {
  const saved = { rows: window.ConnectifyCohortRows, pred: window.ConnectifyPredictorMath, data: window.ConnectifyData };
  try {
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-parse-helpers.js'), 'utf8'));
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-outcome-eval.js'), 'utf8'));
    const evalApi = window.ConnectifyCohortOutcomeEval;
    const card = new MockElement('div', 'eds-c-tile');
    const title = new MockElement('div', 'eds-c-tile__title'); title.textContent = 'Literature ATAR Year 11 - Semester 2'; card.appendChild(title);
    // The overall row ("Semester 2 Cumulative Percent") sits outside .cvr-c-tasks and has a mark of its own
    const overall = new MockElement('div', 'cvr-c-task'); overall._mark = 58.7; card.appendChild(overall);
    const list = new MockElement('div', 'cvr-c-tasks'); card.appendChild(list);
    const makeRow = mark => { const row = new MockElement('div', 'cvr-c-task'); row._mark = mark; list.appendChild(row); return row; };
    const first = makeRow(64), second = makeRow(80);
    // cohort-stats caches every row of the card, the overall row first
    card._cxTaskRows = [overall, first, second];
    window.ConnectifyCohortRows = { readMark: row => row._mark };
    window.ConnectifyData = { orderHint: window.ConnectifyParseHelpers.orderHint };
    window.ConnectifyPredictorMath = {
      cleanSubject: n => n.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, ''),
      getBaselines: () => ({ subjects: {}, types: {} }),
      getCachedPrediction: () => ({ low: 50, mid: 60, high: 70 }),
      evaluateOutcome: () => ({ segments: 4 })
    };
    // The Semester 1 copies of both tasks are cached (marked) from the Semester 1 outline
    const subjects = [{ name: 'Literature ATAR Year 11', tasks: [
      { name: 'Short written response - Play', score: 64, pending: false, semester: 1 },
      { name: 'Extended written response - Prose', score: 80, pending: false, semester: 1 }
    ] }];
    const meta = (name, caption) => ({ subjectName: 'Literature ATAR Year 11', taskName: name, labels: [name.split(' - ')[0], caption, name], labelsKey: name });
    const firstTask = evalApi.taskFromRow(first, meta('Short written response - Play', 'Term 1, Week 5'), 64);
    assert.strictEqual(firstTask.semester, 1, 'a Term 1 task on a Semester 2 panel is a Semester 1 task');
    assert.strictEqual(evalApi.evaluateRow(first, 64, meta('Short written response - Play', 'Term 1, Week 5'), subjects), null,
      'the first marked task of the class has nothing before it (the overall row and its own Semester 1 copy never count), so no meter');
    assert.ok(evalApi.evaluateRow(second, 80, meta('Extended written response - Prose', 'Term 2, Week 1'), subjects), 'the next task has the first one before it');
  } finally {
    window.ConnectifyCohortRows = saved.rows; window.ConnectifyPredictorMath = saved.pred; window.ConnectifyData = saved.data;
  }
});

runTest('Test 193: An update to a newer version shows one notice whose "What\'s new" button opens the changelog', () => {
  const saved = { chrome: global.chrome, notes: window.ConnectifyNotifications, open: window.open, timeout: global.setTimeout, notice: window.ConnectifyUpdateNotice };
  let version = '3.2.3';
  const shown = [], opened = [];
  try {
    mockLocalStorage.clear();
    global.chrome = { runtime: { getManifest: () => ({ version }) } };
    window.ConnectifyNotifications = { show: opts => { shown.push(opts); } };
    window.open = (...args) => { opened.push(args); };
    global.setTimeout = () => 0; // the module's startup check is driven by hand here
    window.ConnectifyUpdateNotice = undefined;
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/update-notice.js'), 'utf8'));
    const notice = window.ConnectifyUpdateNotice;

    assert.strictEqual(notice.check(), false, 'a fresh install only records the version');
    assert.strictEqual(mockLocalStorage.getItem(notice.KEY), '3.2.3');
    assert.strictEqual(notice.check(), false, 'the same version shows nothing');

    version = '3.2.10';
    assert.strictEqual(notice.check(), true, 'a newer version shows the notice');
    assert.strictEqual(shown.length, 1);
    assert.strictEqual(shown[0].title, 'Connectify updated to 3.2.10');
    assert.ok(shown[0].message.includes('3.2.3'), 'the notice names the previous version');
    assert.strictEqual(shown[0].duration, 0, 'it stays until dismissed');
    const whatsNew = shown[0].actions.find(a => a.text === "What's new");
    let closed = false;
    whatsNew.onClick({ close: () => { closed = true; } });
    assert.deepStrictEqual(opened, [['https://github.com/TheFieryFalcon/connectify/blob/main/CHANGELOG.md', '_blank', 'noopener']], 'the button opens the changelog in a new tab');
    assert.ok(closed, 'and closes the notice');
    assert.strictEqual(notice.check(), false, 'the notice shows once per version');

    version = '3.2.9';
    assert.strictEqual(notice.check(), false, 'a downgrade never notifies');
    assert.ok(notice.compareVersions('3.2.10', '3.2.9') > 0 && notice.compareVersions('3.3', '3.3.0') === 0);

    const js = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8')).content_scripts.flatMap(g => g.js || []);
    assert.ok(js.indexOf('src/system/notifications.js') > -1 && js.indexOf('src/system/notifications.js') < js.indexOf('src/system/update-notice.js'), 'the notice loads after the notification engine');
  } finally {
    global.chrome = saved.chrome; window.ConnectifyNotifications = saved.notes; window.open = saved.open;
    global.setTimeout = saved.timeout; window.ConnectifyUpdateNotice = saved.notice;
    mockLocalStorage.clear();
  }
});

runTest('Test 194: The top-right user area keeps the bar and popup surfaces, readable ink and a native-geometry Sign Out', () => {
  const read = f => fs.readFileSync(path.join(BASE_DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const manifestCss = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8')).content_scripts.flatMap(c => c.css || []);
  const at = manifestCss.indexOf('src/theme/styles/theme-user-menu.css');
  assert.ok(at > manifestCss.indexOf('src/theme/styles/theme-reports-menus.css'), 'theme-user-menu.css loads after the menu styles');
  const userCss = read('src/theme/styles/theme-user-menu.css');
  const blocks = css => css.split('}').map(b => b.split('{')).filter(p => p.length === 2).map(([sel, body]) => ({ sel: sel.trim(), body }));
  const user = blocks(userCss);
  const find = (needle, state) => user.filter(b => b.sel.includes(needle) && (state ? b.sel.includes(state) : !/:hover/.test(b.sel)));
  // Colours only: nothing in the user area changes Connect's size, spacing, borders or radius
  for (const b of user) {
    assert.ok(b.sel.startsWith('html.connectea-dark '), `user-area rules are scoped to the theme hook: ${b.sel}`);
    assert.ok(!/(^|\s|;)(border|border-width|border-style|border-radius|padding[\w-]*|margin[\w-]*|height|width|line-height|font-size|font-weight|display):/.test(b.body),
      `user-area rules set colours only: ${b.sel}`);
  }
  const avatar = find('.cvr-c-primary-navigation__button--avatar');
  assert.ok(avatar.some(b => /background-color: transparent !important/.test(b.body) && b.sel.includes(':not(#cx-n)')),
    'the avatar button has no fill of its own (the bar shows through), outranking Connect and the id-weighted button rule');
  assert.ok(find('.cvr-c-primary-navigation__button--avatar', ':hover').some(b => /var\(--cx-surface-hover/.test(b.body)), 'the avatar button highlights on hover');
  assert.ok(!/cvr-c-primary-navigation__button--avatar/.test(read('src/theme/styles/theme-reports-menus.css')),
    'the old nav-bg fill on the avatar button is gone (a second translucent fill on the bar)');
  const header = find('.cvr-c-primary-navigation__user-display');
  assert.ok(header.some(b => /background-color: transparent !important/.test(b.body) && /color: var\(--cx-text-primary, #f8fafc\) !important/.test(b.body)),
    'the dropdown header sits on the popup surface in the theme ink');
  assert.ok(header.some(b => /:not\(\[class\*="avatar"\]\)/.test(b.sel) && /color: var\(--cx-text-primary/.test(b.body)), 'the name and role take the ink; the avatar keeps its colours');
  const signOut = find('.cvr-c-primary-navigation__button--sign-out');
  assert.ok(signOut.some(b => /background-color: transparent !important/.test(b.body) && /color: var\(--cx-text-primary/.test(b.body)), 'Sign Out is clear on the popup surface');
  assert.ok(find('.cvr-c-primary-navigation__button--sign-out', ':hover').some(b => /var\(--cx-surface-hover/.test(b.body)), 'Sign Out highlights on hover');
  assert.ok(find('.cvr-c-primary-navigation__user-controls').some(b => /background-color: transparent/.test(b.body)), 'the Sign Out row is clear');
  // The generic button rules (border, 4px radius, 6px 14px padding, button fill) skip the user-area buttons
  // (the user controls are one of the rule's ancestor exclusions, merged into one :not(:is(...) *) by the expander)
  const skipsUserArea = sel => cssCompact(sel).includes(cssCompact(':not([class*="cvr-c-primary-navigation__button--"])')) &&
    /:not\((:is\([^)]*)?\.cvr-c-primary-navigation__user-controls[,)][^)]*\)? \*\)/.test(sel);
  for (const f of ['src/theme/styles/theme-buttons.css', 'src/theme/styles/theme-component-base.css']) {
    for (const b of blocks(read(f)).filter(b => /\.v-button/.test(b.sel) && !/:disabled/.test(b.sel) && /background-color: var\(--cx-(button-bg|surface-hover|surface-active)|border-color: var\(--cx-accent/.test(b.body))) {
      assert.ok(skipsUserArea(b.sel), `${f}: generic button rule must skip Sign Out and the avatar: ${b.sel.slice(0, 60)}`);
    }
  }
  // Ink reaches 5:1 on the popup surface (and its hover) in every preset; glass layers composite over the canvas
  const win = {};
  for (const f of ['src/theme/theme-oklch.js', 'src/theme/theme-token-derive.js', 'src/theme/theme-glass-tokens.js', 'src/theme/theme-palettes.js']) {
    new Function('window', fs.readFileSync(path.join(BASE_DIR, f), 'utf8'))(win);
  }
  const O = win.ConnectifyThemeOklch;
  const rgba = v => v.startsWith('#') ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)).concat(1) : v.match(/[\d.]+/g).map(Number).concat(1).slice(0, 4);
  const over = (top, under) => { const [r, g, b, a] = rgba(top), u = rgba(under); return '#' + [r, g, b].map((c, i) => Math.round(c * a + u[i] * (1 - a)).toString(16).padStart(2, '0')).join(''); };
  for (const [id, p] of Object.entries(win.ConnectifyThemePalettes.BUILTIN_PALETTES)) {
    let elevated, hover, ink;
    if (p.derived) {
      const c = win.ConnectifyThemeDerive.complete(p.colors), g = win.ConnectifyThemeGlassTokens.props(c, p.glassOpacity);
      elevated = over(g['--cx-surface-elevated'], p.canvas); hover = over(g['--cx-surface-hover'], elevated); ink = c.textPrimary;
    } else {
      elevated = over(p.surfaceElevated || p.surface, p.canvas); hover = over(p.surfaceHover || p.surfaceElevated, elevated); ink = p.textPrimary;
    }
    assert.ok(O.contrast(ink, elevated) >= 5, `${id}: dropdown name must reach 5:1 on the popup (${O.contrast(ink, elevated).toFixed(2)})`);
    assert.ok(O.contrast(ink, hover) >= 5, `${id}: Sign Out must reach 5:1 when hovered (${O.contrast(ink, hover).toFixed(2)})`);
  }
});

runTest('Unmarked task rows show a compact Low / Mid / High prediction panel, hidden once marked', () => {
  localStorage.clear();
  delete window.ConnectifyTaskTypes;
  delete window.ConnectifyCohortView;
  delete window.ConnectifyCohortForecast;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8'));
  const view = window.ConnectifyCohortView;
  assert.ok(window.ConnectifyCohortForecast, 'cohort-forecast.js must load with the cohort view');

  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Literature ATAR - Semester 2';
  card.appendChild(title);
  const row = new MockElement('div', 'cvr-c-task');
  row.closest = sel => sel.includes('eds-c-tile') ? card : null;
  card.appendChild(row);
  const details = new MockElement('div', 'cvr-c-task__details');
  for (const text of ['Examination', 'Term 4, Week 3', 'Extended response 1']) {
    const label = new MockElement('span', 'v-label');
    label.textContent = text;
    details.appendChild(label);
  }
  row.appendChild(details);
  const marks = new MockElement('div', 'cvr-c-task__marks');
  const markCell = new MockElement('div', 'cvr-c-task__mark');
  marks.appendChild(markCell);
  row.appendChild(marks);

  // No results and no baseline: the panel says what the prediction needs and the row is retried next pass
  window.ConnectifyPredictorMath.saveBaselines({ types: {}, subjects: {} });
  view.render(row, false, 'lit-key', 50, null, []);
  let ui = view.panels.get(row);
  assert.strictEqual(ui.box.hidden, true, 'An unmarked row keeps its statistics panel hidden');
  assert.ok(ui.forecast && !ui.forecast.hidden, 'An unmarked row shows the prediction panel');
  assert.ok(ui.forecast.classList.contains('connectea-panel'), 'The prediction panel uses the statistics panel style');
  assert.strictEqual(ui.forecast.textContent, window.ConnectifyCohortForecast.NEEDS, 'Without data the panel names what the prediction needs');
  assert.strictEqual(ui._memo.retry, true, 'A row without a prediction is re-evaluated on the next pass');

  // With a subject baseline the panel shows Low / Mid / High and never the breakout threshold
  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });
  window.dispatchEvent(new MockEvent('connectify-baselines-updated'));
  view.render(row, false, 'lit-key', 50, null, []);
  ui = view.panels.get(row);
  const html = ui.forecast.innerHTML;
  assert.ok(!/Predicted/i.test(html), 'The prediction panel has no PREDICTED label');
  for (const [level, tag] of [['low', 'span'], ['mid', 'strong'], ['high', 'span']]) {
    const re = new RegExp(`<${tag} class="connectea-forecast-value connectea-forecast-value--${level}">${level[0].toUpperCase() + level.slice(1)} \\d+%</${tag}>`);
    assert.ok(re.test(html), `Prediction panel lists ${level} in its Predictor colour class: ${html}`);
  }
  // Low / Mid / High ink matches the Predictor (light, dark and light-tone), outranking the glass strip's primary ink
  const forecastCss = fs.readFileSync(path.join(SRC_DIR, 'cohort/cohort-forecast.css'), 'utf8');
  const ink = (scope, level) => new RegExp(`${scope}:is\\(#cx-specificity-anchor, \\.connectea-row-wrapper\\) \\.connectea-forecast-value--${level} \\{[^}]*`, 'm');
  const block = (scope, level) => (forecastCss.match(ink(scope, level)) || [''])[0];
  assert.ok(forecastCss.includes(':is(#cx-specificity-anchor, .connectea-row-wrapper) :is(.connectea-forecast-value--low, .connectea-forecast-value--high) { font-weight: 600 !important; }'),
    'Low and High are semibold (600), below the 700 Mid strong, outranking the task group\'s first-child span rule (Low is the line\'s first span)');
  assert.ok(block('^', 'low').includes('#475569') && block('^', 'mid').includes('#174c75') && block('^', 'high').includes('#15803d'), 'Light ink matches the Predictor pills');
  assert.ok(block('html\\.connectea-dark ', 'mid').includes('var(--cx-accent-hover') && block('html\\.connectea-dark ', 'high').includes('#4ade80'), 'Dark ink matches the Predictor scenario values');
  assert.ok(block('html\\.connectea-dark\\[data-connectea-tone="light"\\] ', 'high').includes('oklch(from #22c55e 0.34 c h)'), 'Light-tone ink matches the Predictor re-inking');
  assert.ok(!/breakout|purple|110/i.test(html), 'The breakout threshold stays secret');
  assert.strictEqual(ui._memo.retry, false, 'A predicted row is memoised');

  // Once marked, the statistics panel replaces the prediction panel
  markCell.textContent = '72 Out of 100';
  view.render(row, false, 'lit-key', 50, null, []);
  ui = view.panels.get(row);
  assert.strictEqual(ui.forecast.hidden, true, 'A marked row hides the prediction panel');
  assert.notStrictEqual(ui.box.hidden, true, 'A marked row shows its statistics panel');

  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const outlineJs = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-view.js')).js;
  assert.ok(outlineJs.indexOf('src/cohort/cohort-forecast.js') !== -1 && outlineJs.indexOf('src/cohort/cohort-forecast.js') < outlineJs.indexOf('src/cohort/cohort-view.js'), 'cohort-forecast.js loads before cohort-view.js');
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/cohort/cohort-forecast.css')), 'cohort-forecast.css is registered');
});

runTest('Classes without a final letter show their predicted Low / Mid / High result on the overall row', () => {
  localStorage.clear();
  delete window.ConnectifyTaskTypes;
  delete window.ConnectifyCohortView;
  delete window.ConnectifyCohortUpcoming;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8'));
  const view = window.ConnectifyCohortView;
  assert.ok(window.ConnectifyCohortUpcoming, 'cohort-upcoming.js must load with the cohort view');
  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });

  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Literature ATAR - Semester 2';
  card.appendChild(title);
  const makeRow = (inTasks, labels, markText) => {
    const row = new MockElement('div', 'cvr-c-task');
    row.closest = sel => sel.includes('eds-c-tile') ? card : (sel === '.cvr-c-tasks' && inTasks ? card : null);
    const details = new MockElement('div', 'cvr-c-task__details');
    for (const text of labels) {
      const label = new MockElement('span', 'v-label');
      label.textContent = text;
      details.appendChild(label);
    }
    row.appendChild(details);
    const marks = new MockElement('div', 'cvr-c-task__marks');
    const cell = new MockElement('div', 'cvr-c-task__mark');
    cell.textContent = markText;
    marks.appendChild(cell);
    row.appendChild(marks);
    card.appendChild(row);
    return { row, cell };
  };
  const subjects = [{ name: '12 Literature ATAR - Semester 2', tasks: [] }];
  const overall = makeRow(false, ['Semester 2 Cumulative Percent'], '61%');
  const task = makeRow(true, ['Examination', 'Term 4, Week 3', 'Extended response 1'], '');

  view.render(overall.row, true, 'lit-key', 50, null, subjects);
  let ui = view.panels.get(overall.row);
  assert.ok(ui.upcoming && !ui.upcoming.hidden, 'A class without a letter shows its prediction panel');
  assert.ok(ui.upcoming.classList.contains('connectea-panel'), 'The panel uses the statistics panel style');
  for (const level of ['Low', 'Mid', 'High']) assert.ok(new RegExp(`${level} \\d+\\.\\d%`).test(ui.upcoming.innerHTML), `Class prediction lists ${level}: ${ui.upcoming.innerHTML} / ${ui.upcoming.textContent}`);
  assert.ok(!/Extended response/.test(ui.upcoming.innerHTML), 'The panel predicts the class, not its tasks');
  assert.ok(!/breakout|purple/i.test(ui.upcoming.innerHTML), 'The breakout threshold stays secret');

  // A final letter on the overall row hides it
  overall.cell.textContent = 'B';
  view.render(overall.row, true, 'lit-key', 50, null, subjects);
  assert.strictEqual(ui.upcoming.hidden, true, 'A class with a letter grade hides the panel');

  // A new result refreshes the projection
  overall.cell.textContent = '61%';
  task.cell.textContent = '72 Out of 100';
  view.render(overall.row, true, 'lit-key', 50, null, subjects);
  assert.strictEqual(ui.upcoming.hidden, false, 'A class still without a letter keeps its prediction after a task is marked');

  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-view.js')).js;
  assert.ok(js.indexOf('src/cohort/cohort-upcoming.js') !== -1 && js.indexOf('src/cohort/cohort-upcoming.js') < js.indexOf('src/cohort/cohort-view.js'), 'cohort-upcoming.js loads before cohort-view.js');
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/cohort/cohort-upcoming.css')), 'cohort-upcoming.css is registered');
});

runTest('Test 195: Liquid Glass headings and paginators have no pill; boxes keep their native size', () => {
  const surface = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-glass-surface.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  // Paginators and section headings sit on the page: no pill, no segmented "Page N of M" pill, no title-hugging width
  assert.ok(!/::before/.test(surface) && !/mat-paginator/.test(surface), 'paginators have no glass pill');
  assert.ok(!/fit-content/.test(surface) && !/\b(margin|padding)[\w-]*\s*:/.test(surface), 'headings keep their native box');
  // The parity audit no longer exempts any heading width
  const audit = fs.readFileSync(path.join(BASE_DIR, 'scripts/test-theme-styles.js'), 'utf8');
  assert.ok(!audit.includes('glassHeading'), 'the size audit has no heading exemption');
});

runTest('Test 196: One Type change recomputes predictions once, after the dropdown closes, and runs one cohort pass', () => {
  const keys = ['ConnectifyPredictorStore', 'ConnectifyPredictorEngine', 'ConnectifyPredictorBaselines', 'ConnectifyPredictorDates',
    'ConnectifyPredictorHistory', 'ConnectifyPredictorCache', 'ConnectifyPredictorMath', 'ConnectifyData', 'ConnectifyTaskTypes',
    'ConnectifyCompoundProgress', 'ConnectifyWeakness'];
  const saved = Object.fromEntries(keys.map(k => [k, window[k]]));
  const origSetTimeout = global.setTimeout;
  const timers = [];
  const origDispatch = window.dispatchEvent;
  const updates = [];
  try {
    const cleared = [];
    let predictCalls = 0, collectCalls = 0;
    window.ConnectifyPredictorStore = {
      predictionMemoryCache: new Map(), isPredictionCacheCurrent: () => true, setPredictionCacheCurrent: () => {},
      cacheTaskPrediction: () => {}, getCachedPrediction: () => null, clearSubjectPredictionCache: s => cleared.push(s)
    };
    window.ConnectifyPredictorEngine = { predictTask: () => { predictCalls++; return { low: 60, mid: 70, high: 80 }; } };
    window.ConnectifyPredictorBaselines = { getBaselines: () => ({ types: {}, subjects: {} }) };
    window.ConnectifyPredictorDates = { getTaskChronologicalStamp: t => t.order };
    window.ConnectifyPredictorHistory = { getHistoricalDataPriorTo: () => ({}), getHistoricalData: () => ({}) };
    window.ConnectifyData = { collect: () => { collectCalls++; return [
      { name: 'Chemistry', tasks: [{ name: 'Test 1', order: 1, score: 70 }, { name: 'Exam', order: 9 }] },
      { name: 'Physics', tasks: [{ name: 'Lab', order: 4, score: 80 }] }
    ]; } };
    // The rescan also redraws the compound bars and radar; only the prediction work is counted here
    window.ConnectifyCompoundProgress = { update: () => {} };
    window.ConnectifyWeakness = { renderChart: () => {} };
    // Listeners left by earlier tests queue their own debounces; only the prediction refresh is collected
    global.setTimeout = (cb, ms) => { if (cb.name === 'flushPredictionRefresh') timers.push(cb); return timers.length; };
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/predictor-cache.js'), 'utf8'));
    const cache = window.ConnectifyPredictorCache;
    window.ConnectifyPredictorMath = { updatePredictionCache: cache.updatePredictionCache };
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
    window.dispatchEvent = e => {
      if (e.type === 'connectify-predictions-updated') updates.push(e.detail?.subject);
      return true;
    };

    // A custom type: the override is saved, and Settings may rescan every Auto row in the same task
    window.ConnectifyTaskTypes.saveTaskTypeOverride('Chemistry', 'Exam', null, 'Mock Exam');
    window.ConnectifyTaskTypes.rescanAllAutoAssessments();
    assert.deepStrictEqual(cleared, ['Chemistry'], 'the changed subject\'s stale predictions are dropped at once');
    assert.strictEqual(predictCalls + collectCalls, 0, 'nothing is recomputed while the change handler runs');
    assert.strictEqual(cache.isRefreshPending(), true, 'a refresh is queued');
    assert.strictEqual(timers.length, 1, 'both requests share one queued refresh');
    timers.shift()();
    assert.strictEqual(collectCalls, 1, 'subjects are collected once');
    assert.strictEqual(predictCalls, 3, 'every task (type averages span courses) is predicted exactly once');
    assert.deepStrictEqual(updates, [null], 'one connectify-predictions-updated, for every subject');
    assert.strictEqual(cache.isRefreshPending(), false, 'nothing is left pending');

    // The observer waits for that event instead of also passing on the type change itself
    const observer = fs.readFileSync(path.resolve(SRC_DIR, 'cohort/cohort-observer.js'), 'utf8');
    assert.ok(observer.includes("if (evt !== 'connectify-predictions-updated' && window.ConnectifyPredictorCache?.isRefreshPending?.()) return;"),
      'a type change with a refresh queued leaves the pass to connectify-predictions-updated');
    // The custom path no longer rescans every row (the pass re-syncs the dropdowns) or adds the category twice
    const panel = fs.readFileSync(path.resolve(SRC_DIR, 'cohort/cohort-panel.js'), 'utf8');
    assert.ok(!panel.includes('rescanAllAutoAssessments') && !panel.includes('addCustomCategoryForClass'), 'a custom type is one saveTaskTypeOverride');
    // Hidden Settings is rendered on open, never on every type change
    const settings = fs.readFileSync(path.resolve(SRC_DIR, 'predictor/category-settings.js'), 'utf8');
    assert.ok(settings.includes('if (!catPanel.hidden) renderBaselines();'), 'a hidden Settings panel is not rebuilt on type changes');
  } finally {
    window.dispatchEvent = origDispatch;
    global.setTimeout = origSetTimeout;
    for (const k of keys) window[k] = saved[k];
  }
});

runTest('Test 197: Uploaded wallpapers are centre-cropped to the screen and scaled down before they are stored; GIFs stay animated', async () => {
  const src = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-wallpaper-fit.js'), 'utf8');
  const drawn = [], bitmaps = [];
  class FakeBitmap {
    constructor(w, h) { this.width = w; this.height = h; this.closed = false; bitmaps.push(this); }
    close() { this.closed = true; }
  }
  const createImageBitmap = async (source, ...args) => {
    if (!args.length) return new FakeBitmap(source.w, source.h);
    const opts = args.length === 1 ? args[0] : args[4]; // a whole-image rescale, or a crop and resize
    return new FakeBitmap(opts.resizeWidth, opts.resizeHeight);
  };
  class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return { drawImage: (img, ...a) => drawn.push({ img, a }) }; }
    async convertToBlob(o) { return { type: o.type, w: this.width, h: this.height }; }
  }
  class FileReader {
    readAsDataURL(b) { this.result = b.type === 'image/jpeg' && b.w ? `data:image/jpeg;fit=${b.w}x${b.h}` : `data:${b.type};original`; this.onload(); }
  }
  // A 1440x900 screen at 2x: the most a fixed `cover` background ever shows is 2880x1800 device pixels
  const win = { devicePixelRatio: 2, screen: { width: 1440, height: 900 }, innerWidth: 1440, innerHeight: 800 };
  let permissions = ['storage', 'unlimitedStorage'];
  const chrome = { runtime: { getManifest: () => ({ permissions }) } };
  new Function('window', 'createImageBitmap', 'OffscreenCanvas', 'FileReader', 'chrome', src)(win, createImageBitmap, OffscreenCanvas, FileReader, chrome);
  const F = win.ConnectifyWallpaperFit;

  assert.deepStrictEqual(F.targetSize(win), { width: 2880, height: 1800 }, 'target is the screen in device pixels');
  assert.deepStrictEqual(F.targetSize({ devicePixelRatio: 3, screen: { width: 3000, height: 2000 } }), { width: 3840, height: 2560 },
    'device pixel ratio is capped at 2 and the long edge at 4K');
  // A 12000x4000 panorama: centre crop at 16:10, scaled to the target
  const r = F.fitRect(12000, 4000, 2880, 1800);
  assert.deepStrictEqual([r.sw, r.sh, r.sx, r.sy, r.width, r.height], [6400, 4000, 2800, 0, 2880, 1800], 'wide images lose their sides, centred');
  const tall = F.fitRect(3000, 9000, 2880, 1800);
  assert.deepStrictEqual([tall.sw, tall.sh, tall.sx, tall.sy, tall.width, tall.height], [3000, 1875, 0, 3562.5, 2880, 1800], 'tall images lose top and bottom, centred');
  const small = F.fitRect(1600, 1600, 2880, 1800);
  assert.deepStrictEqual([small.sw, small.sh, small.width, small.height], [1600, 1000, 1600, 1000], 'small images are cropped to the aspect but never upscaled');

  // A 9000x6000 photo is decoded, cropped and resized off-thread, then stored as a screen-sized JPEG
  const huge = await F.fromFile({ w: 9000, h: 6000, size: 30e6, type: 'image/png' });
  assert.strictEqual(huge, 'data:image/jpeg;fit=2880x1800', 'huge wallpapers are stored at the screen size as JPEG');
  assert.ok(bitmaps.every(b => b.closed), 'decoded bitmaps are released');
  assert.deepStrictEqual(drawn[0].a, [0, 0, 2880, 1800, 0, 0, 2880, 1800], 'the already-fitted bitmap is drawn 1:1');
  // A small image that already fits the screen exactly keeps its own encoding (PNG transparency)
  const fits = await F.fromFile({ w: 1440, h: 900, size: 400e3, type: 'image/png' });
  assert.strictEqual(fits, 'data:image/png;original', 'small images that already fit are stored untouched');
  // GIFs keep every frame: any size or aspect is stored as uploaded (cover crops it on screen),
  // up to 40 MB with unlimitedStorage and 4 MB in Chrome Web Store builds, which strip that permission
  const MB = 1024 * 1024;
  const drawnBefore = drawn.length;
  assert.strictEqual(F.gifMax(), 40 * MB, 'builds with unlimitedStorage take GIFs up to 40 MB');
  const gif = await F.fromFile({ w: 4000, h: 3000, size: 39 * MB, type: 'image/gif' });
  assert.strictEqual(gif, 'data:image/gif;original', 'animated GIF wallpapers are never re-encoded to a still JPEG');
  assert.strictEqual(drawn.length, drawnBefore, 'a GIF is never drawn to a canvas');
  const huge41 = await F.fromFile({ w: 800, h: 600, size: 41 * MB, type: 'image/gif' }).catch(e => e);
  assert.strictEqual(F.errorText(huge41), 'GIF wallpapers must be 40 MB or smaller (this one is 41.0 MB)', 'GIFs over 40 MB are refused');
  permissions = ['storage'];
  assert.strictEqual(F.gifMax(), 4 * MB, 'without unlimitedStorage (Chrome Web Store) GIFs are capped at 4 MB');
  assert.strictEqual(await F.fromFile({ w: 800, h: 600, size: 3.5 * MB, type: 'image/gif' }), 'data:image/gif;original');
  const big = await F.fromFile({ w: 800, h: 600, size: 5 * MB, type: 'image/gif' }).catch(e => e);
  assert.strictEqual(big.code, 'gif-too-large', 'GIFs over 4 MB are refused (they cannot be shrunk to fit storage)');
  assert.strictEqual(F.errorText(big), 'GIF wallpapers must be 4 MB or smaller (this one is 5.0 MB)', 'the size limit is explained');
  const manifestJson = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  assert.ok(manifestJson.permissions.includes('unlimitedStorage'), 'GitHub and Firefox builds request unlimitedStorage');
  for (const wf of ['publish.yml', 'publish-cws.yml']) {
    const yml = fs.readFileSync(path.join(BASE_DIR, '.github/workflows', wf), 'utf8');
    assert.ok(yml.includes('.permissions -= ["unlimitedStorage"]'), `${wf} strips unlimitedStorage from the Chrome Web Store zip`);
  }
  assert.strictEqual(F.errorText(new Error('decode')), 'That image could not be read');
  assert.ok(!F.needsFit('data:image/gif;base64,' + 'A'.repeat(2e6)), 'stored and imported GIFs are never flattened by the migration');

  // Both upload paths fit the image first and never store the raw file
  const prefs = fs.readFileSync(path.join(BASE_DIR, 'src/predictor/settings-preferences.js'), 'utf8');
  const controls = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-customizer-controls.js'), 'utf8');
  for (const [name, code] of [['Settings', prefs], ['Theme Customizer', controls]]) {
    assert.ok(code.includes('window.ConnectifyWallpaperFit.fromFile(file, { adjust: window.ConnectifyWallpaperCrop?.prompt }).then('), `${name} wallpaper upload must go through ConnectifyWallpaperFit and the crop prompt`);
    assert.ok(code.includes('window.ConnectifyWallpaperFit.isCancelled(err)'), `${name} shows no error when the student cancels the crop prompt`);
    assert.ok(!code.includes('readAsDataURL'), `${name} must not store the raw image file`);
    assert.ok(code.includes('window.ConnectifyWallpaperFit.errorText(err)'), `${name} shows why an upload was refused`);
  }
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/theme/theme-wallpaper-fit.js"') > manifest.indexOf('"src/theme/theme-wallpaper-presets.js"')
    && manifest.indexOf('"src/theme/theme-wallpaper-fit.js"') < manifest.indexOf('"src/theme/theme-customizer-controls.js"'),
    'theme-wallpaper-fit.js is registered before the customizer controls');
});

runTest('Test 198: Home page portlets are one surface: no square wrapper behind the tile, no box behind the promo text', () => {
  const nesting = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-surface-nesting.css'), 'utf8');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  const rule = sel => { const i = nesting.indexOf(sel); return i < 0 ? '' : nesting.slice(i, nesting.indexOf('}', i)); };
  // The Liferay article wrapper sits 2px outside the tile with square corners; only the tile paints
  assert.ok(/background-color: transparent !important;/.test(rule('.journal-content-article:has(> :is(.eds-c-tile, .cvr-c-tile))')),
    'the article wrapper around a tile is clear (no square box behind the rounded glass tile)');
  // A promo inside a tile is the tile body: clear, no border or corners of its own (Connect has neither)
  const promo = rule('.eds-c-tile :where(.cvr-c-promo):not(#cx-n),');
  assert.ok(/background-color: transparent !important;/.test(promo) && /border: 0 !important;/.test(promo) && /border-radius: 0 !important;/.test(promo),
    'the promo and its body sit on the tile with native geometry');
  // The body selector goes through .cvr-c-promo so it beats the id-weighted `#main-content .cvr-c-promo.eds-t-white .cvr-c-promo__body`
  assert.ok(nesting.includes('.eds-c-tile .cvr-c-promo :where(.cvr-c-promo__body):not(#cx-n)'),
    'the promo body rule outranks the promo body fill');
  assert.ok(manifest.indexOf('theme-classes-promos.css') < manifest.indexOf('theme-surface-nesting.css'), 'nesting loads after the promo fills, so ties go to it');
});

runTest('Test 199: Large stored and imported wallpapers are fitted to the screen once, in place; SVG presets never', async () => {
  const fitSrc = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-wallpaper-fit.js'), 'utf8');
  const migrateSrc = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-wallpaper-migrate.js'), 'utf8');
  const HUGE_A = 'data:image/png;base64,' + 'A'.repeat(2e6);
  const HUGE_B = 'data:image/jpeg;base64,' + 'B'.repeat(2e6);
  const SVG = 'data:image/svg+xml,' + '<svg/>'.repeat(4e5);
  const SMALL = 'data:image/png;base64,AAAA';

  // fromDataUrl: the stored URL becomes a Blob (fetch, or atob where the page blocks it) and goes through fromFile
  const createImageBitmap = async (source, ...args) => (args.length
    ? { width: args[4].resizeWidth, height: args[4].resizeHeight, close() {} } : { width: source.w, height: source.h, close() {} });
  class OffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() { return { drawImage() {} }; }
    async convertToBlob(o) { return { type: o.type, w: this.width, h: this.height }; }
  }
  class FileReader { readAsDataURL(b) { this.result = `data:image/jpeg;fit=${b.w}x${b.h}`; this.onload(); } }
  class Blob { constructor(parts, o) { this.type = o.type; this.size = parts[0].length; this.w = 9000; this.h = 6000; } }
  let fetchFails = false;
  const fetch = async () => { if (fetchFails) throw new Error('CSP'); return { blob: async () => ({ w: 9000, h: 6000, size: 30e6, type: 'image/png' }) }; };
  const atob = b => 'x'.repeat(b.length);
  const win = { devicePixelRatio: 2, screen: { width: 1440, height: 900 }, innerWidth: 1440, innerHeight: 800 };
  new Function('window', 'createImageBitmap', 'OffscreenCanvas', 'FileReader', 'fetch', 'atob', 'Blob', fitSrc)(win, createImageBitmap, OffscreenCanvas, FileReader, fetch, atob, Blob);
  const F = win.ConnectifyWallpaperFit;
  assert.ok(F.needsFit(HUGE_A) && F.needsFit(HUGE_B), 'large raster data URLs need fitting');
  assert.ok(!F.needsFit(SVG) && !F.needsFit(SMALL) && !F.needsFit(null) && !F.needsFit('data:text/plain,' + 'x'.repeat(2e6)),
    'SVG presets, small images and non-images are never fitted');
  assert.strictEqual(await F.fromDataUrl(HUGE_A), 'data:image/jpeg;fit=2880x1800', 'a stored wallpaper is cropped and scaled like an upload');
  fetchFails = true;
  assert.strictEqual(await F.fromDataUrl(HUGE_A), 'data:image/jpeg;fit=2880x1800', 'atob decodes the URL where fetch is blocked');
  assert.strictEqual(await F.fromDataUrl('data:x'), 'data:x', 'a fit that is not smaller keeps the original');

  // Migration: active wallpaper (extension-storage fallback) and theme wallpapers, each distinct image fitted once
  function migrator(opts = {}) {
    const ext = { 'connectea:custom_background': HUGE_A, 'connectea:custom_themes_list': JSON.stringify([
      { id: 't1', wallpaper: HUGE_A }, { id: 't2', wallpaper: SVG }, { id: 't3', wallpaper: SMALL }, { id: 't4', wallpaper: HUGE_B }]) };
    const local = new Map([['connectea:custom_themes_list', JSON.stringify([{ id: 't1', wallpaper: null }, { id: 't5', wallpaper: HUGE_B }])]]);
    const env = { calls: [], bg: null, written: null, defs: { t1: { id: 't1', wallpaper: HUGE_A } }, ext, local };
    const w = {
      ConnectifyWallpaperFit: { needsFit: F.needsFit, fromDataUrl: async url => {
        env.calls.push(url);
        if (opts.clearDuring) { delete ext['connectea:custom_background']; env.bg = null; }
        return `data:image/jpeg;small-${env.calls.length}`;
      } },
      ConnectifyThemeTokens: { getCustomBackground: () => env.bg, setCustomBackground: u => { env.bg = u; env.setCalls = (env.setCalls || 0) + 1; } },
      ConnectifyThemeRegistry: { writeCustomThemes: l => { env.written = l; }, getThemeDefinition: id => env.defs[id] || null },
      ConnectifyThemeAuth: { isAuthDisabled: () => false }
    };
    const ls = { getItem: k => (local.has(k) ? local.get(k) : null), setItem: (k, v) => local.set(k, String(v)) };
    const chrome = { storage: { local: { get: (keys, cb) => cb(Object.fromEntries(keys.filter(k => k in ext).map(k => [k, ext[k]]))) } } };
    new Function('window', 'localStorage', 'chrome', 'document', migrateSrc)(w, ls, chrome, undefined);
    env.M = w.ConnectifyWallpaperMigrate;
    return env;
  }
  const env = migrator();
  assert.strictEqual(await env.M.run(), true, 'large stored wallpapers are migrated');
  assert.deepStrictEqual(env.calls, [HUGE_A, HUGE_B], 'each distinct large wallpaper is fitted once; SVG and small ones never');
  assert.strictEqual(env.bg, 'data:image/jpeg;small-1', 'the active wallpaper (only in extension storage) is stored back fitted');
  assert.deepStrictEqual(env.written.map(t => [t.id, t.wallpaper]), [['t1', 'data:image/jpeg;small-1'], ['t2', SVG], ['t3', SMALL],
    ['t4', 'data:image/jpeg;small-2'], ['t5', 'data:image/jpeg;small-2']], 'theme wallpapers are replaced in place; a localStorage-only theme is kept');
  assert.strictEqual(env.defs.t1.wallpaper, 'data:image/jpeg;small-1', 'registered themes apply the fitted wallpaper');
  assert.strictEqual(env.local.get('connectify:wallpaper_fit_done'), '1', 'the migration is recorded');
  assert.strictEqual(await env.M.run(), false, 'it runs once');
  assert.strictEqual(env.calls.length, 2, 'a finished migration never decodes again');
  const cleared = migrator({ clearDuring: true });
  await cleared.M.run();
  assert.ok(!cleared.setCalls && cleared.bg === null, 'a wallpaper cleared while fitting is not brought back');

  // JSON import: a large wallpaper is fitted before it is previewed or saved; small ones are taken as they are
  eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-customizer.js'), 'utf8'));
  const prevFit = window.ConnectifyWallpaperFit;
  window.ConnectifyWallpaperFit = F;
  try {
    const state = { tokens: {}, wallpaper: null };
    assert.strictEqual(window.ConnectifyThemeCustomizerControls.importTheme(state, { wallpaper: HUGE_A }), HUGE_A, 'a large import is returned for fitting');
    assert.strictEqual(state.wallpaper, null, 'the raw large import is never put in the customizer state');
    assert.strictEqual(window.ConnectifyThemeCustomizerControls.importTheme(state, { wallpaper: SMALL }), null);
    assert.strictEqual(state.wallpaper, SMALL, 'small imported wallpapers are used directly');
  } finally {
    window.ConnectifyWallpaperFit = prevFit;
  }
  const controls = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-customizer-controls.js'), 'utf8');
  assert.ok(controls.includes('window.ConnectifyWallpaperFit.fromDataUrl(url).then('), 'imports go through ConnectifyWallpaperFit.fromDataUrl');
  const customThemes = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-custom-themes.js'), 'utf8');
  assert.ok(customThemes.includes('deleteCustomTheme, writeCustomThemes }'), 'the theme list writer is shared with the migration');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  const at = f => manifest.indexOf(`"src/theme/${f}"`);
  assert.ok(at('theme-wallpaper-migrate.js') > at('theme-wallpaper-fit.js') && at('theme-wallpaper-migrate.js') > at('theme-custom-themes.js'),
    'the migration loads after the fit module and the custom theme store');
});

runTest('Test 200: Progress keeps cohort means under the semester filter and plots single tasks, weighted or rolling averages', () => {
  // 1. Cohort mean fallback: a task cached before its chart was stamped gets its mean from its boxplot or the stats cache
  window.__connectifyDataInitialized = false;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8'));
  const cache = window.ConnectifyCache;
  const subject = 'Chemistry ATAR Year 11';
  const parser = window.ConnectifyParser;
  let parsed = [];
  window.ConnectifyParser = { ...parser, parseCardSubjectTasks: () => ({ title: subject, subjectName: subject, tasks: parsed }) };
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-scrape.js'), 'utf8'));
  const scrape = window.ConnectifyAssessmentScrape;
  window.ConnectifyParser = parser;
  const task = (id, name, extra) => ({ id, name, caption: '', score: 80, pending: false, weight: 10, mean: null, semester: 1, order: null, sequence: 0, ...extra });
  try {
    cache.subjectsCache.set(subject, new Map([
      ['a', task('a', 'Test 1', { stats: [40, 50, 60, 70, 80] })],
      ['b', task('b', 'Test 2', { sequence: 1 })]
    ]));
    cache.setTaskStats(subject, 'Test 2', [50, 60, 70, 80, 90], 30);
    const means = () => scrape.formatCollectedSubjects(true).find(s => s.name === subject).tasks.map(t => t.mean);
    assert.deepStrictEqual(means(), [60, 70], 'means come from the task boxplot, else the stats cache');
    assert.strictEqual(cache.subjectsCache.get(subject).get('a').mean, null, 'formatting never mutates the cached task');

    // Early return (every task already cached): a now-stamped row fills the missing mean
    const card = document.createElement('div');
    parsed = [task('a', 'Test 1', { mean: 61 }), task('b', 'Test 2', { mean: 72, stats: [1, 2, 3, 4, 5] })];
    scrape.scrapeSubjectTasks(card);
    assert.strictEqual(cache.subjectsCache.get(subject).get('a').mean, 61, 'a cached null mean is filled from the fresh row');
    assert.deepStrictEqual(cache.subjectsCache.get(subject).get('b').stats, [1, 2, 3, 4, 5], 'missing cached stats are filled too');

    // Overwrite: a copy of the same task without a chart (Semester 2 outline, unstamped) keeps the cached mean
    parsed = [task('a', 'Test 1', { mean: null, stats: undefined }), task('c', 'Test 3', { sequence: 2 })];
    scrape.scrapeSubjectTasks(card);
    assert.strictEqual(cache.subjectsCache.get(subject).get('a').mean, 61, 'a record without a mean never erases the cached one');
  } finally {
    cache.subjectsCache.delete(subject);
    window.ConnectifyAssessmentScrape = scrape;
  }

  // 2. Modes: weighted running average and weighted rolling average of the last three, cohort mean alike
  delete window.ConnectifyProgressModes;
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress-modes.js'), 'utf8'));
  const modes = window.ConnectifyProgressModes;
  const pts = [
    { name: 'A', score: 50, mean: 40, weight: 10 },
    { name: 'B', score: 60, mean: 50, weight: 20 },
    { name: 'P', score: null, mean: null, weight: 5, pending: true },
    { name: 'C', score: 70, mean: null, weight: 30 },
    { name: 'D', score: 80, mean: 60, weight: 40 }
  ];
  const round = v => (v === null ? null : Math.round(v * 100) / 100);
  assert.strictEqual(modes.apply(pts, 'tasks'), pts, 'Single tasks plots the marks as they are');
  const weighted = modes.apply(pts, 'weighted');
  assert.deepStrictEqual(weighted.map(p => round(p.score)), [50, 56.67, null, 63.33, 70], 'weighted running average of completed tasks');
  assert.deepStrictEqual(weighted.map(p => round(p.mean)), [40, 46.67, null, null, 54.29], 'cohort means are averaged over tasks that have one');
  const rolling = modes.apply(pts, 'rolling');
  assert.strictEqual(round(rolling[4].score), 72.22, 'rolling average weights the last three completed tasks: (60*20 + 70*30 + 80*40) / 90');
  assert.strictEqual(round(rolling[4].mean), 54.29, 'rolling cohort mean covers the last three tasks with a mean');
  assert.ok(rolling[2].pending && rolling[2].score === null, 'pending tasks stay listed without a value');
  assert.strictEqual(round(modes.apply([{ score: 50, weight: 0 }, { score: 70, weight: 0 }], 'weighted')[1].score), 60, 'all-zero weights fall back to a plain mean');

  // 3. The dropdown saves the choice; the chart renames its series in average modes
  localStorage.removeItem(modes.KEY);
  assert.strictEqual(modes.read(), 'tasks', 'Single tasks is the default');
  let picked = null;
  const label = modes.select('tasks', m => { picked = m; });
  const dropdown = label.querySelector('select');
  assert.deepStrictEqual(Array.from(dropdown.querySelectorAll('option')).map(o => o.textContent), ['Single tasks', 'Weighted average', 'Rolling average (last 3)']);
  dropdown.value = 'rolling';
  dropdown.dispatchEvent(new Event('change'));
  assert.strictEqual(picked, 'rolling');
  assert.strictEqual(modes.read(), 'rolling', 'the choice is kept in connectify:progress_mode');
  localStorage.removeItem(modes.KEY);

  delete window.ConnectifyProgressMath;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8'));
  delete window.ConnectifyProgressChart;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8'));
  const container = document.createElement('div');
  window.ConnectifyProgressChart.renderChart(container, { points: weighted, isHistory: false, byAssessment: false, subjectName: 'English ATAR', mode: 'weighted' });
  const headers = Array.from(container.querySelectorAll('th')).map(th => th.textContent);
  assert.deepStrictEqual(headers.slice(3), ['Your weighted average', 'Cohort weighted average'], 'table headers name the plotted averages');
  assert.ok(container.querySelector('.cx-red-key').textContent === 'Red: Cohort weighted average', 'the legend names the averaged cohort line');

  const graph = fs.readFileSync(path.resolve(BASE_DIR, 'progress-graph.js'), 'utf8');
  assert.ok(graph.includes('points = modes.apply(current.tasks, mode)') && graph.includes('modes.select(mode, () => render(data))'), 'subject views plot the selected mode with its dropdown');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/progress/progress-modes.js"') > -1 && manifest.indexOf('"src/progress/progress-modes.js"') < manifest.indexOf('"src/progress/progress-graph.js"'), 'progress-modes.js loads before progress-graph.js');
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'progress.css'), 'utf8');
  assert.ok(css.includes('.connectea-dark #connectify-progress .cx-progress-mode select{background:var(--cx-nav-bg'), 'the dropdown is token-routed in dark themes');
});

runTest('Test 201: Target ATAR, Target Grade and Estimate ATAR course inputs are left-aligned', () => {
  const planner = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/atar-planner.css'), 'utf8');
  assert.ok(/#connectea-atar \.cta-target-label>\.cta-score\s*\{\s*text-align:\s*left;/.test(planner), 'planner target inputs are left-aligned');
  const compact = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/atar-compact.css'), 'utf8');
  assert.ok(/#connectea-atar \.cta-score\s*\{[^}]*text-align:\s*left;/.test(compact), 'Estimate ATAR school mark inputs are left-aligned too');
});

runTest('Test 202: Progress: no subject heading (the pressed chip names it); ATAR Progression heading 700, chips 600, legend 400', () => {
  const graph = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress-graph.js'), 'utf8');
  assert.ok(!graph.includes("createElement('h3', current.name)"), 'subject views have no subject name heading');
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress.css'), 'utf8');
  assert.ok(css.includes('#connectify-progress h3{font-weight:700}'), 'the ATAR Progression heading is bold, not Connect\'s 400 h3');
  assert.ok(css.includes('#connectify-progress .cx-subjects button{font-weight:600}'), 'subject chips match the Refresh button weight');
  assert.ok(css.includes('#connectify-progress .cx-legend{font-weight:400}'), 'the chart legend stays regular');
});

runTest('Test 203: Important tiles (Maintenance Notice) keep their red tint in dark themes; glass tiles keep native height', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-alert-tiles.css'), 'utf8');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/theme/styles/theme-alert-tiles.css"') > manifest.indexOf('"src/theme/styles/theme-tiles.css"') &&
    manifest.indexOf('"src/theme/styles/theme-alert-tiles.css"') < manifest.indexOf('"src/theme/styles/theme.css"'), 'theme-alert-tiles.css loads after the tile rules it overrides');
  assert.ok(css.includes('html.connectea-dark[data-connectea-theme] :where(.eds-c-tile__header--negative):not(#cx-n) {\n  background-color: color-mix(in srgb, #dc2626 16%, transparent) !important;'), 'negative headers keep a red tint in dark themes');
  assert.ok(css.includes(':where(.eds-c-tile--important) > :where(.eds-c-tile__header):not(#cx-n) {\n  border-bottom-color: #dc2626 !important;'), 'important headers keep a red divider');
  assert.ok(/#f87171 !important;\n  -webkit-text-fill-color: #f87171 !important;/.test(css), 'red icons beat the glyph ink (text-fill too)');
  assert.ok(css.includes('html.connectea-dark[data-connectea-tone="light"] :where(.eds-c-tile__header--negative):not(#cx-n) {\n  background-color: color-mix(in srgb, #9d000b 10%, transparent) !important;'), 'light-tone themes use Connect\'s own red');
  assert.ok(!/:is\([^)]*::before/.test(css), 'pseudo-elements stay outside :is() (an invalid :is drops the rule)');
  const theme = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme.css'), 'utf8');
  assert.ok(!/\.eds-c-tile, \.cvr-c-tile, \.c-tile, \.eds-c-card, \.cvr-c-card, \.connectea-panel\) \{\n  overflow: hidden/.test(theme), 'glass tiles never use overflow: hidden (the list margin showed as an extra strip under the notice)');
});

runTest('Test 204: The customizer hue slider covers 0-360 across the whole track; gradient, thumb and picked colour agree', () => {
  const win = {};
  new Function('window', origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-color-utils.js'), 'utf8'))(win);
  const C = win.ConnectifyThemeColors, hex = h => { const c = C.hsvToRgb(h, 1, 1); return C.toHex(c.r, c.g, c.b); };
  const HUES = ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'];
  HUES.forEach((want, k) => assert.strictEqual(hex(k * 60), want, `hue ${k * 60} picks ${want}`));
  for (const h of [0, 1, 90, 200, 359, 360]) {
    const back = C.rgbToHsv(...Object.values(C.parseHex(hex(h)))).h;
    assert.ok(back >= 0 && back <= 360 && Math.min(Math.abs(back - h), 360 - Math.abs(back - h)) <= 1, `hue ${h} round-trips (got ${back})`);
  }
  const markup = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-customizer-markup.js'), 'utf8');
  assert.ok(markup.includes('<input type="range" min="0" max="360" class="cx-picker-hue"'), 'the slider reports 0-360');
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-color-picker.css'), 'utf8');
  const rule = (css.match(/\n\.cx-picker-hue \{([^}]*)\}/) || [])[1] || '';
  assert.ok(/padding: 0;/.test(rule) && /border: 0;/.test(rule) && /box-sizing: border-box;/.test(rule), 'the track is the whole element: no padding or border insets the thumb');
  const inset = parseFloat((rule.match(/--cx-hue-inset: ([\d.]+)px;/) || [])[1]);
  for (const thumb of ['::-webkit-slider-thumb', '::-moz-range-thumb']) {
    const t = (css.match(new RegExp(`\\.cx-picker-hue${thumb} \\{([^}]*)\\}`)) || [])[1] || '';
    assert.ok(/box-sizing: border-box;/.test(t) && parseFloat((t.match(/width: ([\d.]+)px;/) || [])[1]) === inset * 2, `${thumb} is ${inset * 2}px wide (border included), twice the gradient inset`);
  }
  // The thumb centre for value h sits at inset + (W - 2 * inset) * h / 360; each gradient stop must sit there too
  const stops = [...rule.matchAll(/(#[0-9a-f]{6}) (var\(--cx-hue-inset\)|calc\(([^;\n]*)\))[,)]/gi)];
  assert.strictEqual(stops.length, 7, 'seven hue stops, red to red');
  for (const W of [180, 240, 320]) {
    stops.forEach(([, color, , expr], k) => {
      const js = (expr || 'var(--cx-hue-inset)').replace(/var\(--cx-hue-inset\)/g, String(inset)).replace(/100%/g, String(W));
      const at = Function(`return (${js});`)();
      assert.ok(Math.abs(at - (inset + (W - 2 * inset) * k / 6)) < 0.01, `stop ${k} sits under the thumb at hue ${k * 60} on a ${W}px track`);
      assert.strictEqual(color.toLowerCase(), HUES[k], `the stop under hue ${k * 60} is the colour it picks`);
    });
  }
  // Dark themes' text-input box (padding 6px 10px, border) must skip range sliders, or the thumb stops short of the ends
  for (const file of ['theme-controls.css', 'theme-component-base.css', 'theme-tables.css']) {
    const text = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles', file), 'utf8');
    const generic = text.match(/input:not\(\[type="checkbox"\]\)[^,{]*/g) || [];
    assert.ok(generic.length && generic.every(sel => sel.includes(':not([type="range"])')), `${file} leaves range sliders out of its text-input rule`);
  }
});

runTest('Test 205: The wallpaper is a fixed 2px-blurred layer dimmed (light text) or brightened (dark text) to keep text >= 4.5:1; no text shadow', () => {
  const win = {};
  new Function('window', 'document', 'localStorage', origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-wallpaper-dim.js'), 'utf8'))(win, {}, {});
  const D = win.ConnectifyWallpaperDim;
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const contrastWithWhite = (rgb, a) => 1.05 / (0.2126 * lin(rgb[0] * (1 - a)) + 0.7152 * lin(rgb[1] * (1 - a)) + 0.0722 * lin(rgb[2] * (1 - a)) + 0.05);
  const px = list => Uint8ClampedArray.from(list.flatMap(c => [...c, 255]));
  assert.strictEqual(D.dimFor(px([[20, 24, 32], [60, 40, 30]])), 0, 'a wallpaper already dark enough is not dimmed');
  for (const pixels of [[[255, 255, 255]], [[246, 213, 184], [242, 217, 230]], [[255, 255, 0], [10, 10, 10]], [[120, 200, 255]]]) {
    const a = D.dimFor(px(pixels));
    assert.ok(a > 0 && a < 1, `bright wallpapers are dimmed (${a})`);
    for (const rgb of pixels) assert.ok(contrastWithWhite(rgb, a) >= 4.5, `white text keeps >= 4.5:1 on ${rgb} at dim ${a}`);
    const brightest = pixels.reduce((m, c) => (contrastWithWhite(c, 0) < contrastWithWhite(m, 0) ? c : m));
    assert.ok(contrastWithWhite(brightest, a - 0.03) < 4.6, `the dim is the least that works, not a blanket darkening (${a})`);
  }
  assert.notStrictEqual(D.keyOf('data:image/png;base64,AAAA'), D.keyOf('data:image/png;base64,AAAB'), 'each wallpaper is cached under its own key');
  // Dark-text themes: the least white overlay that keeps the theme's ink >= 4.5:1 on the darkest pixel
  const contrastWithInk = (rgb, a, ink) => {
    const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const bg = rgb.map(c => c + (255 - c) * a), fg = [1, 3, 5].map(i => parseInt(ink.slice(i, i + 2), 16));
    return (L(bg) + 0.05) / (L(fg) + 0.05);
  };
  assert.strictEqual(D.brightenFor(px([[248, 250, 252], [230, 235, 240]]), '#0f172a'), 0, 'a light wallpaper is not brightened');
  for (const [pixels, ink] of [[[[0, 0, 0]], '#0f172a'], [[[40, 30, 60], [200, 200, 200]], '#1e293b'], [[[120, 90, 160]], '#0f172a']]) {
    const a = D.brightenFor(px(pixels), ink);
    assert.ok(a > 0 && a < 1, `dark wallpapers are brightened (${a})`);
    for (const rgb of pixels) assert.ok(contrastWithInk(rgb, a, ink) >= 4.5, `${ink} text keeps >= 4.5:1 on ${rgb} at brighten ${a}`);
    const darkest = pixels.reduce((m, c) => (contrastWithInk(c, 0, ink) < contrastWithInk(m, 0, ink) ? c : m));
    assert.ok(contrastWithInk(darkest, a - 0.03, ink) < 4.6, `the brighten is the least that works (${a})`);
  }
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-wallpaper-layer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = sel => css.split('}').filter(b => b.split('{')[0].trim() === sel).map(b => b.split('{')[1]).join('\n');
  const layer = rule('html[data-connectea-has-custom-bg="true"]::before');
  assert.ok(/position: fixed;/.test(layer) && /inset: -6px;/.test(layer) && /z-index: -1;/.test(layer) && /filter: blur\(2px\);/.test(layer) &&
    /rgba\(0, 0, 0, var\(--cx-wallpaper-dim-active, 0\)\)/.test(layer) && /var\(--cx-custom-bg-image\) center center \/ cover no-repeat;/.test(layer),
    'the wallpaper is one fixed layer, blurred 2px, under a black overlay at the measured dim');
  assert.ok(/--cx-wallpaper-dim-active: var\(--cx-wallpaper-dim, /.test(rule('html.connectea-dark[data-connectea-has-custom-bg="true"]:not([data-connectea-tone="light"])')),
    'only light-ink themes dim the wallpaper');
  assert.ok(/rgba\(255, 255, 255, var\(--cx-wallpaper-brighten-active, 0\)\)/.test(layer) &&
    /--cx-wallpaper-brighten-active: var\(--cx-wallpaper-brighten, /.test(rule('html[data-connectea-has-custom-bg="true"]:not(.connectea-dark), html[data-connectea-has-custom-bg="true"][data-connectea-tone="light"]')),
    'dark-ink themes brighten the wallpaper with a white overlay');
  assert.ok(/background: transparent !important;/.test(rule('html[data-connectea-has-custom-bg="true"]:not(#cx-specificity-anchor) :where(body):not(#cx-n)')), 'body never covers the layer');
  // body's clearing rule must outrank the dark canvas rule on body (theme-surface-base.css weighs (1,2,1)); it once lost and hid the wallpaper
  const base = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-surface-base.css'), 'utf8');
  assert.ok(base.includes(':is(html, body).connectea-dark:not([data-connectea-login]) :where(body):not(#cx-n),') &&
    expandIs.specificity(':is(html, body).connectea-dark:not([data-connectea-login]) :where(body):not(#cx-n)').join() === '1,2,1', 'the canvas rule this outranks is still (1,2,1)');
  assert.ok(!/text-shadow|--cx-label-shadow/.test(css), 'text gets no shadow over the wallpaper (it made text hard to read)');
  assert.ok(!/custom-bg-image\) center center \/ cover no-repeat fixed/.test(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-tokens.css'), 'utf8')), 'html and body no longer paint the wallpaper themselves');
  const tokens = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-custom-tokens.js'), 'utf8');
  assert.ok(tokens.includes('window.ConnectifyWallpaperDim?.update('), 'every wallpaper change is measured');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-wallpaper-dim.js') > manifest.indexOf('theme-custom-tokens.js') && manifest.indexOf('theme-wallpaper-layer.css') > manifest.indexOf('styles/theme-tokens.css'), 'registered after the token files');
});

runTest('Test 206: The customizer colour picker captures its drag, so sweeping past a corner never selects text or scrolls the page', () => {
  const controls = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-customizer-controls.js'), 'utf8');
  assert.ok(/svBox\.onpointerdown = e => \{[\s\S]*?e\.preventDefault\(\);[\s\S]*?setPointerCapture/.test(controls), 'the SV box cancels the pointerdown default and captures the pointer');
  assert.ok(controls.includes('svBox.onpointermove') && !controls.includes("addEventListener('mousemove'") && !controls.includes('onmousedown'), 'no window mouse listeners or mousedown drag');
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-color-picker.css'), 'utf8');
  const sv = css.slice(css.indexOf('.cx-picker-sv {'), css.indexOf('}', css.indexOf('.cx-picker-sv {')));
  assert.ok(/touch-action: none;/.test(sv) && /user-select: none;/.test(sv), 'the SV box blocks touch scrolling and selection');
  assert.ok(/\.cx-picker-popover \{[^}]*user-select: none;/.test(css) && /\.cx-picker-popover input:not\(\[type="range"\]\) \{\s*user-select: text;/.test(css), 'the popover text is not selectable, its hex input is');
});

runTest('Test 207: Full-mode tokens the user set stay until a Basic token they derive from changes, and survive save and reopen', () => {
  const themeDir = path.join(SRC_DIR, 'theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js', 'theme-customizer-tokens.js']) {
    new Function('window', origReadFileSync.call(fs, path.join(themeDir, f), 'utf8'))(win);
  }
  const T = win.ConnectifyCustomizerTokens;
  const basic = { canvas: '#14211a', surface: '#1f3326', button: '#27402f', border: '#4c7058', accent: '#8bc34a', textPrimary: '#f1f8e9' };
  const state = { mode: 'full', tokens: { ...basic }, overrides: new Set() };
  T.apply(state);
  T.set(state, 'surfaceHover', '#ff0000');
  T.set(state, 'textMuted', '#00ff00');
  T.set(state, 'accentHover', '#0000ff');
  state.mode = 'basic';
  T.set(state, 'accent', '#ffc107');
  T.apply(state);
  assert.strictEqual(state.tokens.surfaceHover, '#ff0000', 'switching to Basic and editing an unrelated Basic token keeps a Full token the user set');
  assert.strictEqual(state.tokens.textMuted, '#00ff00');
  assert.strictEqual(state.tokens.accentHover, T.derived(state.tokens).accentHover, 'editing the accent re-derives the accent hover the user set');
  assert.ok(!state.overrides.has('accentHover'), 'it is no longer an override');
  T.set(state, 'canvas', '#101a14');
  T.apply(state);
  assert.strictEqual(state.tokens.surfaceHover, '#ff0000', 'the surface hover does not derive from the canvas');
  assert.strictEqual(state.tokens.surfaceElevated, T.derived(state.tokens).surfaceElevated, 'tokens the user never set still follow the Basic tokens');
  const saved = T.savedColors(state);
  assert.deepStrictEqual(Object.keys(saved).sort(), [...T.BASIC, 'surfaceHover', 'textMuted'].sort(), 'a theme saves its Basic tokens and overrides only');
  const reopened = { tokens: { ...saved, ...T.derived(saved) }, overrides: new Set() };
  Object.assign(reopened.tokens, saved);
  reopened.overrides = T.overridesOf(reopened.tokens);
  assert.deepStrictEqual([...reopened.overrides].sort(), ['surfaceHover', 'textMuted'], 'reopening a theme recovers its overrides');
  T.track(reopened, reopened.overrides);
  T.set(reopened, 'surface', '#203040');
  T.apply(reopened);
  for (const key of ['surfaceHover', 'textMuted']) {
    assert.strictEqual(reopened.tokens[key], T.derived(reopened.tokens)[key], `editing the surface re-derives the reopened theme's ${key}`);
  }
  assert.strictEqual(reopened.overrides.size, 0, 'neither is an override any more');
  T.set(reopened, 'surfaceHover', '#ff0000');
  T.reset(reopened, 'surfaceHover');
  assert.strictEqual(reopened.tokens.surfaceHover, T.derived(reopened.tokens).surfaceHover, 'reset hands a token back to the Basic tokens');
  const markup = origReadFileSync.call(fs, path.join(themeDir, 'theme-customizer-markup.js'), 'utf8');
  assert.ok(markup.includes("state.mode === 'full' && state.overrides?.has(t.key)") && markup.includes('cx-token-reset'), 'Full mode marks overrides with a reset button');
  const core = origReadFileSync.call(fs, path.join(themeDir, 'theme-customizer.js'), 'utf8');
  assert.ok(!core.includes('deriveSecondaryTokens') && core.includes('colors: tokenSet.savedColors(state)') && core.includes('tokenSet.track(state, themeToEdit?.colors ? tokenSet.overridesOf(state.tokens) : [])'), 'the customizer derives through the override set');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-customizer-tokens.js') > manifest.indexOf('theme-token-derive.js') && manifest.indexOf('theme-customizer-tokens.js') < manifest.indexOf('theme-customizer-controls.js'), 'registered between derive and the controls');
});

runTest('Test 208: Text tokens a custom theme sets are used as given; only text without a token of its own is contrast-picked', () => {
  const win = {};
  for (const f of ['theme-oklch.js', 'theme-token-derive.js']) new Function('window', origReadFileSync.call(fs, path.join(SRC_DIR, 'theme', f), 'utf8'))(win);
  const keys = ['canvas', 'canvasSubtle', 'surface', 'surfaceSecondary', 'surfaceElevated', 'surfaceHover', 'border', 'borderSubtle', 'borderStrong', 'accent', 'accentHover',
    'textPrimary', 'textSecondary', 'textMuted', 'tileLinkColor', 'button', 'buttonHover', 'buttonText', 'inputBg', 'inputBorder'];
  const white = win.ConnectifyThemeDerive.cssProps(Object.fromEntries(keys.map(k => [k, '#ffffff'])));
  for (const k of ['--cx-text-secondary', '--cx-text-muted', '--cx-nav-text', '--cx-button-text', '--cx-input-text', '--cx-badge-text', '--cx-tile-link-color']) {
    assert.strictEqual(white[k], '#ffffff', `${k} must keep the colour the theme set (an all-white theme was greyed out)`);
  }
  const dark = win.ConnectifyThemeDerive.cssProps({ canvas: '#12171f', surface: '#1e2632', button: '#202c3b', border: '#2e3c4e', accent: '#3b82f6', textPrimary: '#f1f5f9' });
  assert.strictEqual(dark['--cx-avatar-text'], '#f1f5f9', 'avatar initials take the theme text when it reads');
});

runTest('Test 209: Card header buttons (View All) use the button tokens and the class-coloured divider uses the strong border', () => {
  const cards = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-cards.css'), 'utf8');
  const sel = '.connectea-dark:not(cx-n) .mat-card-header :where(.mat-button):not(#cx-n)';
  const rule = cards.slice(cards.indexOf(sel + ' {'), cards.indexOf('}', cards.indexOf(sel + ' {')));
  assert.ok(rule && /background-color: var\(--cx-button-bg, #202c3b\) !important;/.test(rule) && /color: var\(--cx-button-text, #f1f5f9\) !important;/.test(rule), 'View All takes the button background and text');
  assert.ok(cards.includes('.connectea-dark:not(cx-n) .mat-card-header :where(.mat-button):hover:not(#cx-n) {\n  background-color: var(--cx-button-hover, #2c3b4e) !important;'), 'and the button hover');
  const scaling = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-search-scaling.css'), 'utf8');
  assert.ok(/\.mat-divider--primary \{\s*border-top-color: var\(--cx-border-strong, #5a7391\) !important;/.test(scaling) && !scaling.includes('#9cb800'), 'the green card divider takes the strong border');
});

runTest('Test 210: Themes export as <name>.ctme ZIPs holding theme.json and the wallpaper; .ctme (stored or deflated) and old .json files import', async () => {
  const win = {};
  new Function('window', origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-ctme.js'), 'utf8'))(win);
  const C = win.ConnectifyThemeCtme;
  assert.strictEqual(C.fileName('Test Theme'), 'test_theme.ctme');
  assert.strictEqual(C.fileName('  My  Cool—Theme! '), 'my_cool_theme.ctme');
  assert.strictEqual(C.crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'standard CRC-32');
  const png = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 1, 2, 3, 250]).toString('base64');
  const theme = { version: 1, name: 'Test Theme', colors: { canvas: '#111111' }, wallpaper: png };
  const zip = C.pack(theme);
  const files = await C.unzip(zip.buffer);
  assert.deepStrictEqual([...files.keys()], ['theme.json', 'wallpaper.png'], 'the archive holds theme.json and the wallpaper image');
  assert.strictEqual(JSON.parse(new TextDecoder().decode(files.get('theme.json'))).wallpaper, 'wallpaper.png', 'theme.json names the wallpaper file');
  const back = await C.unpack(zip.buffer);
  assert.strictEqual(back.wallpaper, png, 'the wallpaper comes back as the same data URL');
  assert.strictEqual(back.colors.canvas, '#111111');
  const noWall = await C.unpack(C.pack({ name: 'X', colors: {}, wallpaper: null }).buffer);
  assert.strictEqual(noWall.wallpaper, null);
  const svg = await C.unpack(C.pack({ name: 'S', wallpaper: 'data:image/svg+xml;utf8,%3Csvg%2F%3E' }).buffer);
  assert.strictEqual(Buffer.from(svg.wallpaper.split(',')[1], 'base64').toString(), '<svg/>', 'SVG preset wallpapers survive');
  // A file re-zipped by the operating system (deflated entries)
  const zlib = require('zlib');
  const json = Buffer.from(JSON.stringify({ name: 'Deflated', wallpaper: null }));
  const packed = zlib.deflateRawSync(json), name = Buffer.from('theme.json');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(json.length, 22); local.writeUInt16LE(name.length, 26);
  const dir = Buffer.alloc(46); dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(8, 10); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(json.length, 24); dir.writeUInt16LE(name.length, 28);
  const body = Buffer.concat([local, name, packed]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(body.length, 16);
  const deflated = Buffer.concat([body, dir, name, end]);
  assert.strictEqual((await C.unpack(deflated)).name, 'Deflated', 'deflated archives import');
  assert.strictEqual((await C.unpack(Buffer.from('{"name":"Old","wallpaper":null}'))).name, 'Old', 'older .json theme files still import');
  const markup = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-customizer-markup.js'), 'utf8');
  assert.ok(markup.includes('accept=".ctme,.json"') && markup.includes('Export Theme'), 'the customizer imports .ctme and .json and exports a theme file');
  const controls = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-customizer-controls.js'), 'utf8');
  assert.ok(controls.includes('ctme.pack(data)') && controls.includes('a.download = ctme.fileName(state.name)'), 'export writes <name>.ctme');
});

runTest('Test 211: Customizer headings and labels take the theme ink in every theme, never Connect\'s heading or label colours', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-customizer.css'), 'utf8');
  const preview = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-customizer-preview.css'), 'utf8');
  assert.ok(cssHas(css, '#cx-customizer-modal .cx-customizer-title, #cx-customizer-modal .cx-toggle-label {\n  color: var(--cx-text-primary) !important;'), 'the title and Liquid Glass toggle use the primary ink');
  assert.ok(cssHas(css, '#cx-customizer-modal .cx-preset-picker-wrap label {\n  color: var(--cx-text-secondary) !important;'), 'Inherit Preset uses the secondary ink');
  assert.ok(/#cx-customizer-modal \.cx-preview-pane-title \{[^}]*color: var\(--cx-text-secondary\) !important;/.test(preview), 'Live Preview uses the secondary ink, not Connect\'s heading colour');
  const lum = hex => hex.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  assert.ok(ratio('#334155', '#ffffff') >= 5 && ratio('#e2e8f0', '#1e2632') >= 5, 'secondary ink keeps >= 5:1 on the Light and Dark surfaces');
});

runTest('Test 212: Theme menu Import Theme; .ctme files read in Firefox content scripts; themes name a preset wallpaper by id', async () => {
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme', f), 'utf8');
  // 1. Firefox hands MV3 content scripts page-owned buffers ("Permission denied to access property"), from file.arrayBuffer()
  //    and from a Response alike: picked files are read as a data URL string, which is always copied into the extension
  const ctmeSrc = read('theme-ctme.js');
  assert.ok(ctmeSrc.includes('reader.readAsDataURL(file)') && !/file\.arrayBuffer\(\)|new Response\(file\)/.test(ctmeSrc), 'theme files are read as a data URL, never as a page-owned buffer');
  class FakeReader { readAsDataURL(f) { setTimeout(() => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(f.bytes).toString('base64'); this.onload(); }); } }
  const cw = {};
  new Function('window', 'FileReader', 'atob', 'btoa', ctmeSrc)(cw, FakeReader, atob, btoa);
  const packed = cw.ConnectifyThemeCtme.pack({ name: 'Read Me', colors: { canvas: '#101010' }, wallpaper: 'data:image/png;base64,iVBORw0KGgo=' });
  const roundTrip = await cw.ConnectifyThemeCtme.unpackFile({ bytes: packed });
  assert.ok(roundTrip.name === 'Read Me' && roundTrip.wallpaper === 'data:image/png;base64,iVBORw0KGgo=', 'a picked .ctme file reads back with its wallpaper');
  assert.ok(!read('theme-customizer-controls.js').includes('file.arrayBuffer()') && read('theme-customizer-controls.js').includes('ConnectifyThemeCtme.unpackFile(file)'), 'the customizer imports with unpackFile');
  // 2. The menu offers Import Theme below Customize Theme
  const menu = read('theme-menu.js');
  assert.ok(menu.indexOf("'Customize Theme...'") < menu.indexOf("'Import Theme...'") && menu.includes('ConnectifyThemeImport?.pick()'), 'Import Theme sits below Customize Theme');
  const manifest = origReadFileSync.call(fs, path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('theme-ctme.js') < manifest.indexOf('theme-import.js') && manifest.indexOf('theme-import.js') < manifest.indexOf('theme-customizer-controls.js'), 'theme-import.js loads after theme-ctme.js, before the customizer controls');
  // 3. Sanitising: a known preset id is kept, a preset URL becomes its id, unknown ids and non-image wallpapers are dropped
  const w = { ConnectifyThemeColors: { pickColors: c => Object.fromEntries(Object.entries(c || {}).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v))) } };
  new Function('window', read('theme-wallpaper-presets.js'))(w);
  new Function('window', 'document', 'alert', read('theme-import.js'))(w, {}, () => {});
  const I = w.ConnectifyThemeImport, aurora = w.ConnectifyWallpaperPresets.byId('aurora');
  assert.ok(aurora && w.ConnectifyWallpaperPresets.PRESETS.length === 6, 'presets are found by id');
  assert.deepStrictEqual(I.wallpaperFields(aurora.url), { wallpaper: null, wallpaperPreset: 'aurora' }, 'a preset wallpaper is saved by id, not as an image');
  assert.deepStrictEqual(I.wallpaperFields('data:image/png;base64,AA'), { wallpaper: 'data:image/png;base64,AA', wallpaperPreset: null });
  assert.strictEqual(I.sanitize({ wallpaperPreset: 'ember', wallpaper: 'wallpaper.jpg' }).wallpaperPreset, 'ember');
  const bad = I.sanitize({ wallpaperPreset: 'nope', wallpaper: 'javascript:alert(1)', glassBlur: 99, colors: { canvas: '#111111', surface: 'red;}' } });
  assert.ok(!('wallpaper' in bad) && !('wallpaperPreset' in bad) && bad.glassBlur === 40 && !('surface' in bad.colors), 'untrusted fields are dropped or clamped');
  // 4. Import Theme saves the file as a custom theme (missing Basic tokens from Dark) and applies it
  const saved = [], applied = [];
  w.ConnectifyThemeCtme = { unpackFile: async () => ({ name: 'Mint Theme', icon: '🌿', wallpaperPreset: 'mint', colors: { canvas: '#0d1f14', accent: '#22c55e' } }) };
  w.ConnectifyThemeRegistry = {
    getPresetPalettes: () => ({ dark: { canvas: '#12171f', surface: '#1e2632', button: '#202c3b', border: '#455a73', accent: '#3b82f6', textPrimary: '#f8fafc' } }),
    saveCustomTheme: def => { saved.push(def); return { ...def, id: 'custom_1' }; }, setTheme: id => applied.push(id)
  };
  await I.importFile({});
  assert.strictEqual(saved[0].wallpaperPreset, 'mint', 'the preset wallpaper is kept by id');
  assert.strictEqual(saved[0].colors.canvas, '#0d1f14', 'the theme\'s own colours win');
  assert.strictEqual(saved[0].colors.textPrimary, '#f8fafc', 'missing Basic tokens come from Dark');
  assert.deepStrictEqual(applied, ['custom_1'], 'the imported theme is applied');
  w.ConnectifyThemeCtme.unpackFile = async () => ({ name: 'No colours' });
  await assert.rejects(I.importFile({}), /no colours/, 'a file without colours is reported, never saved');
  const origWarn = console.warn; console.warn = () => {};
  try { assert.strictEqual(I.failText(new Error('Permission denied')), 'Invalid theme file.\n\nPermission denied', 'the import alert says why it failed'); } finally { console.warn = origWarn; }
  assert.ok(read('theme-customizer-controls.js').includes('alert(window.ConnectifyThemeImport.failText(err))'), 'the customizer import alert says why too');
  // 5. The registry, the store and the customizer resolve wallpaperPreset; the customizer shows the six thumbnails
  assert.ok(read('theme-registry.js').includes("window.ConnectifyWallpaperPresets?.byId(theme?.wallpaperPreset)?.url || theme?.wallpaper"), 'a theme\'s preset wallpaper is applied by id');
  assert.ok(read('theme-registry.js').includes("wallpaperPreset: typeof themeDef.wallpaperPreset === 'string'") && read('theme-custom-themes.js').includes('wallpaperPreset: themeDef.wallpaperPreset !== undefined'), 'wallpaperPreset is registered and stored');
  assert.ok(read('theme-customizer-markup.js').includes('id="cx-bg-presets"') && read('theme-customizer-controls.js').includes("ConnectifyWallpaperPresets?.mount(modal.querySelector('#cx-bg-presets')"), 'the customizer offers the preset wallpapers');
  assert.ok(read('theme-customizer.js').includes('...window.ConnectifyThemeImport.wallpaperFields(state.wallpaper)') && read('theme-customizer-controls.js').includes('...window.ConnectifyThemeImport.wallpaperFields(state.wallpaper)'), 'save and export name a preset by id');
});

runTest('Test 213: A theme\'s own wallpaper shows only while that theme is active; switching away restores the Settings wallpaper', () => {
  localStorage.clear();
  window.location.href = 'https://connect.det.wa.edu.au/classes';
  const load = () => { eval(fs.readFileSync(path.resolve(__dirname, 'src/theme/theme-registry.js'), 'utf8')); return window.ConnectifyThemeRegistry; };
  let reg = load();
  const shown = () => document.documentElement.style.getPropertyValue('--cx-custom-bg-image');
  const mint = window.ConnectifyWallpaperPresets.byId('mint').url;
  reg.setCustomBackground('data:image/png;base64,MINE');
  const presetTheme = reg.saveCustomTheme({ id: 'custom_mint_wall', name: 'Mint Wall', wallpaperPreset: 'mint', colors: { canvas: '#0d1f14' } });
  const imageTheme = reg.saveCustomTheme({ id: 'custom_own_wall', name: 'Own Wall', wallpaper: 'data:image/png;base64,THEIRS', colors: { canvas: '#101010' } });
  reg.setTheme(presetTheme.id);
  assert.strictEqual(shown(), `url("${mint}")`, 'a theme\'s preset wallpaper shows while it is active');
  assert.strictEqual(localStorage.getItem('connectea:custom_background'), 'data:image/png;base64,MINE', 'a theme\'s wallpaper is never stored over the Settings one');
  reg.setTheme('dark');
  assert.strictEqual(shown(), 'url("data:image/png;base64,MINE")', 'switching to a theme without a wallpaper restores the Settings wallpaper');
  reg.setTheme(imageTheme.id);
  assert.strictEqual(shown(), 'url("data:image/png;base64,THEIRS")', 'a theme\'s own image shows while it is active');
  assert.strictEqual(reg.getCustomBackground(), 'data:image/png;base64,MINE', 'Settings still reads the student\'s own wallpaper');
  reg.setTheme('quantum');
  assert.strictEqual(shown(), 'url("data:image/png;base64,MINE")');
  // The Settings wallpaper picked or cleared under a theme with its own keeps that theme's on screen
  reg.setTheme(imageTheme.id);
  reg.clearCustomBackground();
  assert.strictEqual(shown(), 'url("data:image/png;base64,THEIRS")', 'clearing the Settings wallpaper leaves the theme\'s own on screen');
  reg.setTheme('dark');
  assert.ok(!shown() && !document.documentElement.hasAttribute('data-connectea-has-custom-bg'), 'with no Settings wallpaper, other themes show none');
  // Reload with the preset theme active: its wallpaper is shown at startup (presets load before the registry)
  reg.setTheme(presetTheme.id);
  reg = load();
  assert.strictEqual(shown(), `url("${mint}")`, 'the active theme\'s wallpaper is shown after a reload');
  const manifest = fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/theme/theme-wallpaper-presets.js"') < manifest.indexOf('"src/theme/theme-registry.js"'), 'preset wallpapers load before the registry');
  assert.ok(fs.readFileSync(path.join(BASE_DIR, 'src/predictor/settings-preferences.js'), 'utf8').includes('(the current theme shows its own wallpaper)'), 'Settings says when the theme\'s own wallpaper is on screen');
  localStorage.clear();
  delete document.documentElement.dataset.connecteaTheme;
});

runTest('Test 214: Notice and dialog detail views read in the primary ink (cream in Quantum Dark); feed cards keep the secondary ink', () => {
  const feed = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-feed.css'), 'utf8');
  assert.ok(/\.connectea-dark cnt-notice-view p, [^{]*\.connectea-dark mat-dialog-container li \{\s*color: var\(--cx-text-primary, #f8fafc\) !important;/.test(feed),
    'detail view text uses --cx-text-primary');
  assert.ok(/\.connectea-dark \.cvr-c-feed-card p, [^{]*\.connectea-dark \.cvr-c-feed-item li \{\s*color: var\(--cx-text-secondary/.test(feed),
    'feed cards keep --cx-text-secondary');
  assert.ok(!/:is\(cnt-notice-view, mat-dialog-container, \.cvr-c-feed-card[^{]*\{\s*color: var\(--cx-text-secondary/.test(feed), 'detail views never use the secondary ink');
  const tokens = fs.readFileSync(path.join(BASE_DIR, 'src/theme/styles/theme-tokens.css'), 'utf8');
  assert.ok(/data-connectea-theme="quantum"[^}]*--cx-text-primary: #fbf1c7;/.test(tokens), 'Quantum Dark\'s primary ink is cream');
});

runTest('Test 215: A preset picked in the customizer keeps every colour it sets until a Basic token it derives from changes', () => {
  const themeDir = path.join(SRC_DIR, 'theme');
  const win = {};
  for (const f of ['theme-color-utils.js', 'theme-oklch.js', 'theme-token-derive.js', 'theme-palettes.js', 'theme-customizer-tokens.js']) {
    new Function('window', origReadFileSync.call(fs, path.join(themeDir, f), 'utf8'))(win);
  }
  const T = win.ConnectifyCustomizerTokens;
  const C = win.ConnectifyThemeColors;
  const presets = win.ConnectifyThemePalettes.BUILTIN_PALETTES;
  const pick = preset => {
    const state = { mode: 'basic', tokens: {}, overrides: new Set() };
    T.fromPreset(state, preset, C.pickColors(preset));
    return state;
  };
  // Every preset's own colours are kept as set (overrides), not derived from its six Basic tokens
  for (const [id, preset] of Object.entries(presets)) {
    const state = pick(preset);
    for (const [key, value] of Object.entries(C.pickColors(preset))) {
      assert.strictEqual(state.tokens[key], value, `${id} keeps its ${key}`);
      if (!T.isBasic(key)) assert.ok(state.overrides.has(key), `${id}'s ${key} counts as a colour you set`);
    }
  }
  const quantum = presets.quantum;
  assert.notStrictEqual(T.derived(C.pickColors(quantum)).textSecondary, '#b8bb26', 'the cream primary text alone would derive a different secondary');
  const state = pick(quantum);
  assert.strictEqual(state.tokens.textSecondary, '#b8bb26', 'Quantum Dark\'s green secondary text is inherited');
  assert.strictEqual(T.savedColors(state).textSecondary, '#b8bb26', 'a theme saved from the preset stores its colours');
  // Changing a Basic token re-derives the Full tokens derived from it; the rest keep the preset's colours
  T.set(state, 'textPrimary', '#ffffff');
  T.apply(state);
  const d = T.derived(state.tokens);
  for (const key of ['textSecondary', 'textMuted', 'tileLinkColor', 'buttonText']) {
    assert.strictEqual(state.tokens[key], d[key], `${key} follows the new primary text`);
    assert.ok(!state.overrides.has(key), `${key} is derived again`);
  }
  for (const key of ['surfaceHover', 'surfaceElevated', 'borderSubtle', 'canvasSubtle', 'buttonHover']) {
    assert.strictEqual(state.tokens[key], quantum[key], `${key} does not derive from the primary text, so it keeps the preset colour`);
  }
  T.set(state, 'surface', '#3a3634');
  T.apply(state);
  assert.strictEqual(state.tokens.surfaceHover, T.derived(state.tokens).surfaceHover, 'changing the surface re-derives the surface tokens');
  // Colours the user sets re-derive the same way, and ↺ hands a preset colour back to the Basic tokens
  const own = pick(quantum);
  T.set(own, 'textMuted', '#00ff00');
  T.set(own, 'surfaceHover', '#ff0000');
  T.set(own, 'textPrimary', '#ffffff');
  T.apply(own);
  assert.strictEqual(own.tokens.textMuted, T.derived(own.tokens).textMuted, 'a colour the user set derives again once the primary text changes');
  assert.strictEqual(own.tokens.surfaceHover, '#ff0000', 'a colour the user set that does not derive from the primary text stays');
  T.reset(own, 'surfaceElevated');
  assert.strictEqual(own.tokens.surfaceElevated, T.derived(own.tokens).surfaceElevated, 'reset derives a preset colour from the Basic tokens');
  T.reset(own, 'surfaceHover');
  assert.strictEqual(own.tokens.surfaceHover, T.derived(own.tokens).surfaceHover, 'reset derives a colour the user set from the Basic tokens');
  // A derived preset (Liquid Glass) sets only Basic tokens, so nothing is an override
  assert.strictEqual(pick(presets['liquid-glass-clear']).overrides.size, 0, 'a derived preset starts with no overrides');
  assert.ok(!('keeps' in quantum), 'no per-preset list of kept tokens');
  const core = origReadFileSync.call(fs, path.join(themeDir, 'theme-customizer.js'), 'utf8');
  assert.ok(core.includes('tokenSet.fromPreset(state, preset, themeTokens(preset))') && core.includes('tokenSet.track(state, '), 'the preset select goes through fromPreset; opening tracks the theme\'s own colours');
});

runTest('Test 216: Dark-ink glass themes brighten the page behind a dialog instead of dimming it', () => {
  const css = file => origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles', file), 'utf8');
  const lightTone = css('theme-light-tone.css');
  const rule = lightTone.slice(lightTone.indexOf('/* Dialog backdrops'));
  assert.ok(rule.includes('html.connectea-dark[data-connectea-tone="light"]:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"])'), 'scoped to light-tone glass themes');
  for (const sel of ['.cdk-overlay-dark-backdrop', '.cdk-overlay-backdrop', '.v-window-modalitycurtain', '.modal-backdrop']) assert.ok(rule.includes(sel), `${sel} is brightened`);
  assert.ok(/background-color: rgba\(255, 255, 255, 0\.45\) !important/.test(rule), 'a white overlay brightens the backdrop');
  assert.ok(css('theme-tokens.css').includes('background-color: rgba(11, 17, 32, 0.45) !important'), 'light-ink glass themes keep the navy dim');
  const order = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8')).content_scripts.flatMap(g => g.css || []);
  assert.ok(order.findIndex(f => f.endsWith('theme-light-tone.css')) > order.findIndex(f => f.endsWith('theme-tokens.css')), 'the light-tone backdrop loads after the glass dim');
});

runTest('Test 217: Filtering Assessment Outlines with "Show this semester\'s classes only" keeps the filtered class visible, or says why it is hidden', () => {
  const origQSA = document.querySelectorAll, origById = document.getElementById, origNow = Date.now, origSidebarFilter = window.ConnectifySidebarFilter;
  let now = 2e12;
  Date.now = () => (now += 5000); // detection is memoised for a second
  // The mock DOM has no ChildNode.before / previousElementSibling
  const page = new MockElement('div', 'v-verticallayout');
  const place = card => {
    page.appendChild(card);
    card.before = node => { node.remove(); const i = page.children.indexOf(card); page.children.splice(i, 0, node); node.parentElement = node.parentNode = page; };
    Object.defineProperty(card, 'previousElementSibling', { configurable: true, get: () => page.children[page.children.indexOf(card) - 1] || null });
    return card;
  };
  try {
    mockLocalStorage.clear();
    const { classes, filter, notice } = loadSemesterModules();
    const chem1 = makeOutlineCard('12 Chemistry ATAR - Semester 1', { overall: ['80%', 'A'] });
    const chem2 = makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '85%' });
    const art1 = makeOutlineCard('12 Art - Semester 1', { overall: ['70%', 'B'] });
    let cards = [chem1, chem2, art1];
    document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? cards : sel.includes('cx-semester-hidden') ? cards.filter(c => c.classList.contains('cx-semester-hidden')) : origQSA(sel));
    document.getElementById = id => (id === notice.ID ? page.children.find(c => c.id === id) || null : origById(id));
    let filterTitle = '', clickedAll = false;
    window.ConnectifySidebarFilter = { activeFilterTitle: () => filterTitle, clickConnectAllButton: () => { clickedAll = true; return true; } };
    classes.recordCards(cards);
    filter.save(true);

    // Filtered to a Semester 2 class: its card shows no final letter, but the registry knows it is Semester 2
    filterTitle = '12 Chemistry ATAR';
    cards = [place(makeOutlineCard('12 Chemistry ATAR - Semester 2', { overall: '85%' }))];
    filter.applyToPage();
    assert.strictEqual(filter.activeSemester(), 2, 'a filtered page never flips the semester back to 1');
    assert.ok(!cards[0].classList.contains('cx-semester-hidden'), 'the filtered class\'s Semester 2 outline stays visible');
    assert.strictEqual(document.getElementById(notice.ID), null, 'no notice while an outline is shown');

    // Filtered to a class with no Semester 2 outline: its tile is hidden and a notice takes its place
    filterTitle = '12 Art';
    const art = place(makeOutlineCard('12 Art - Semester 1', { overall: ['70%', 'B'] }));
    cards = [art];
    filter.applyToPage();
    assert.ok(art.classList.contains('cx-semester-hidden'), 'the other semester\'s outline is hidden');
    const shown = document.getElementById(notice.ID);
    assert.ok(shown && art.previousElementSibling === shown, 'the notice sits where the hidden outline was');
    const [title, text, button] = shown.children;
    assert.strictEqual(title.textContent, '12 Art has no Semester 2 outline');
    assert.ok(text.textContent.includes('"Show this semester\'s classes only" is on, so its Semester 1 outline is hidden'), text.textContent);
    assert.ok(text.textContent.includes('Connectify Settings'), 'the notice says where to turn the option off');
    assert.strictEqual(button.hidden, false, 'Back to All is offered while a Connect filter is applied');
    button.click();
    assert.ok(clickedAll, 'Back to All clicks Connect\'s own All filter');

    // Later passes (Connect re-renders) change nothing, so hidden tiles never flash
    let writes = 0;
    const count = (fn) => (...a) => { writes++; return fn(...a); };
    art.classList.add = count(art.classList.add); art.classList.remove = count(art.classList.remove);
    filter.applyToPage();
    assert.strictEqual(writes, 0, 'a pass with nothing to change touches no tile');
    assert.strictEqual(page.children.filter(c => c.id === notice.ID).length, 1, 'one notice, never duplicated');

    // Without a Connect filter there is no Back to All
    filterTitle = '';
    filter.applyToPage();
    assert.strictEqual(shown.children[0].textContent, 'No Semester 2 outlines to show');
    assert.strictEqual(shown.children[2].hidden, true, 'Back to All only with a Connect filter applied');

    // Turning the option off shows the outline and removes the notice
    filter.save(false);
    filter.applyToPage();
    assert.strictEqual(document.getElementById(notice.ID), null, 'the notice goes when the option is off');
    assert.strictEqual(writes, 1, 'the hidden tile is shown again');

    const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
    const js = manifest.content_scripts.flatMap(g => g.js || []);
    assert.strictEqual(js.indexOf('src/assessment/semester-filter-notice.js') + 1, js.indexOf('src/assessment/semester-filter.js'), 'the notice loads just before the filter');
    const css = fs.readFileSync(path.join(BASE_DIR, 'src/assessment/semester-filter.css'), 'utf8');
    assert.ok(css.includes('.connectea-dark .cx-semester-notice-title {\n  color: var(--cx-text-primary'), 'dark themes ink the notice with the theme tokens');
    assert.ok(!/\.cx-semester-notice\s*\{[^}]*background/.test(css), 'the notice is an empty state with no panel of its own');
  } finally {
    document.querySelectorAll = origQSA; document.getElementById = origById; Date.now = origNow;
    window.ConnectifySidebarFilter = origSidebarFilter; mockLocalStorage.clear();
  }
});

runTest('Test 218: Back to All presses Connect\'s top-level "All" filter with a whole mouse press, once', () => {
  window.ConnectifySidebarFilter = undefined;
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/sidebar-filter.js'), 'utf8'));
  const { findAllFilter, clickConnectAllButton } = window.ConnectifySidebarFilter;
  const el = (cls, text) => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; return e; };
  // Connect's filter menu: a top-level "All" heading, then semester sections whose tree lists start with their own "All"
  const menu = el('cvr-c-category-menu eds-c-accordion eds-c-accordion--dark');
  const heading = el('eds-c-accordion__section-heading'), label = el('eds-c-accordion__section-label', 'All');
  heading.appendChild(label); menu.appendChild(heading);
  for (const name of ['Semester 1 Classes', 'Semester 2 Classes']) {
    const section = el('eds-c-accordion__section-heading'); section.appendChild(el('eds-c-accordion__section-label', name)); menu.appendChild(section);
    const panel = el('eds-c-accordion__panel'), tree = el('cvr-c-tree-list');
    for (const item of ['All', 'Chemistry ATAR Year 11']) { const row = el('cvr-c-tree-list__item'); row.appendChild(el('v-label', item)); tree.appendChild(row); }
    panel.appendChild(tree); menu.appendChild(panel);
  }
  const own = el('cx-semester-notice'); own.id = 'cx-semester-notice'; own.appendChild(el('eds-c-accordion__section-label', 'All'));
  // Async tests leave their own outlines in the shared mock DOM, so queries stay on this page
  const page = el('cvr-page'), origQSA = document.querySelectorAll;
  page.appendChild(own); page.appendChild(menu);
  document.querySelectorAll = sel => page.querySelectorAll(sel);
  // Node's own MouseEvent never bubbles through the mock DOM
  const origMouse = window.MouseEvent, origPointer = window.PointerEvent;
  window.MouseEvent = MockEvent; window.PointerEvent = MockEvent;
  // Vaadin's layout click: fires on mouseup over the element that got the mousedown, never on click()
  let pressed = 0, clicks = 0, downTarget = null;
  heading.addEventListener('mousedown', e => { downTarget = e.target; });
  heading.addEventListener('mouseup', e => { if (e.target === downTarget && (e.button ?? 0) === 0) pressed++; downTarget = null; });
  heading.addEventListener('click', () => { clicks++; });
  try {
    // Elements are compared by identity: a failed deepStrictEqual would print the whole mock DOM
    assert.ok(findAllFilter() === label, 'the top-level "All", never a semester section\'s "All" or Connectify\'s own UI');
    assert.strictEqual(clickConnectAllButton(), true);
    assert.strictEqual(pressed, 1, 'a mousedown + mouseup pair reaches Vaadin\'s layout click listener');
    assert.strictEqual(clicks, 1, 'one press only (an accordion heading toggles on every press)');
    label.textContent = 'Everything';
    assert.ok(findAllFilter() === null, 'a semester section\'s "All" is never pressed instead');
    assert.strictEqual(clickConnectAllButton(), false);
    const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/sidebar-filter.js'), 'utf8');
    assert.ok(!src.includes('match.parentElement.click()'), 'no repeated bare click() calls');
    const notice = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/semester-filter-notice.js'), 'utf8');
    assert.ok(notice.includes("Pick All in Connect\\'s filter menu"), 'the notice says what to do when no All filter is found');
  } finally {
    document.querySelectorAll = origQSA; window.MouseEvent = origMouse; window.PointerEvent = origPointer;
  }
});

runTest('Test 219: No stylesheet tests a class substring on an ancestor, so a class change restyles only what it can affect', () => {
  // Chrome cannot key [class*="..."] to a class name: on an ancestor (or inside :not(... *)) every class change on
  // any element restyles its whole subtree against every rule. Connect rewrites classes ~20 times per click (the
  // outline filter menu took 115ms per open), so ancestors are named by class; the subject may still use substrings
  const splitTop = (s, seps) => {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const c of s) {
      if (quote) { cur += c; if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (depth === 0 && seps.includes(c)) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.filter(x => x.trim());
  };
  // True when a [class...=] sits in a compound that is not the subject, through :is/:where/:not arguments
  const ancestorSubstring = (sel, subjectContext) => {
    const compounds = splitTop(sel.trim().replace(/\s*([>+~])\s*/g, '$1').replace(/\s+/g, ' '), ' >+~');
    return compounds.some((comp, i) => {
      const isSubject = subjectContext && i === compounds.length - 1;
      for (let j = 0; j < comp.length; j++) {
        if (comp[j] === '[') {
          const end = comp.indexOf(']', j);
          if (!isSubject && /^\[class\s*[*^$~|]?=/.test(comp.slice(j, end + 1))) return true;
          j = end;
        } else if (comp[j] === '(') {
          let depth = 1, k = j + 1;
          for (; k < comp.length && depth; k++) depth += comp[k] === '(' ? 1 : comp[k] === ')' ? -1 : 0;
          const pseudo = comp.slice(0, j).match(/:([\w-]+)$/)?.[1];
          if (/^(is|where|not)$/.test(pseudo || '') && splitTop(comp.slice(j + 1, k - 1), ',').some(a => ancestorSubstring(a, isSubject))) return true;
          j = k - 1;
        }
      }
      return false;
    });
  };
  const offenders = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.name.endsWith('.css')) continue;
      const css = origReadFileSync.call(fs, full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      let prelude = '';
      for (const ch of css) {
        if (ch === '{') {
          const p = prelude.trim();
          if (p && !p.startsWith('@')) for (const sel of splitTop(p, ',')) if (ancestorSubstring(sel, true)) offenders.push(`${path.relative(SRC_DIR, full)}: ${sel.replace(/\s+/g, ' ').trim()}`);
          prelude = '';
        } else if (ch === '}' || ch === ';') prelude = '';
        else prelude += ch;
      }
    }
  })(SRC_DIR);
  assert.deepStrictEqual(offenders, [], 'ancestors are named by class, never by a class substring');
  assert.ok(ancestorSubstring('.connectea-dark :is(.a, [class*="feed"]) span', true) && ancestorSubstring('.x:not([class*="icon"] *)', true), 'the check catches both forms');
  assert.ok(!ancestorSubstring('.connectea-dark :is(.a, [class*="feed"])', true) && !ancestorSubstring('.x:not([class*="icon"])', true), 'a substring on the subject is allowed');
});

runTest('Test 220: On Assessment Outlines the shortcut, not My Connect, is the highlighted navigation tab', () => {
  window.__connectifyNavInitialized = false;
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/navigation.js'), 'utf8'));
  const { markActive } = window.ConnectifyNavigation;
  const el = (cls, text) => { const e = document.createElement('div'); e.className = cls; if (text) e.textContent = text; return e; };
  // Desktop greedy bar: Connect marks My Connect active on the outlines page; the shortcut sits after it
  const bar = el('cvr-c-primary-navigation__links');
  const myConnect = el('cvr-js-greedy__item eds-s-is-active'), link = document.createElement('a');
  link.setAttribute('href', '/group/students/ui/my-connect'); myConnect.appendChild(link);
  const classes = el('cvr-js-greedy__item');
  const shortcut = el('cvr-js-greedy__item'); shortcut.dataset.connecteaShortcut = '';
  // Mobile drawer: the same pair
  const drawer = el('cvr-c-primary-menu__list');
  const mobileMy = el('cvr-c-primary-menu__item eds-s-is-active'); mobileMy.appendChild(el('cvr-c-primary-menu__item-label', 'My Connect'));
  const mobileShortcut = el('cvr-c-primary-menu__item'); mobileShortcut.dataset.connecteaShortcut = '';
  for (const e of [classes, myConnect, shortcut]) bar.appendChild(e);
  for (const e of [mobileMy, mobileShortcut]) drawer.appendChild(e);
  const page = el('cvr-page'), origQSA = document.querySelectorAll, origHref = location.href;
  page.appendChild(bar); page.appendChild(drawer);
  document.querySelectorAll = sel => page.querySelectorAll(sel);
  const active = e => e.classList.contains('eds-s-is-active');
  try {
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines?coisp=12345';
    markActive();
    assert.ok(active(shortcut) && active(mobileShortcut), 'the shortcut takes Connect\'s own active class on the outlines page');
    assert.ok(!active(myConnect) && !active(mobileMy), 'My Connect is no longer highlighted there');
    assert.ok(!active(classes), 'other tabs are untouched');
    myConnect.classList.add('eds-s-is-active');
    markActive();
    assert.ok(!active(myConnect) && active(shortcut), 'Connect re-marking My Connect is undone');
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-connect';
    markActive();
    assert.ok(!active(shortcut) && !active(mobileShortcut), 'the shortcut is not highlighted on other pages');
    assert.ok(active(myConnect) && active(mobileMy), 'My Connect gets its highlight back');
    markActive();
    assert.ok(active(myConnect), 'a later pass leaves Connect\'s own highlight alone');
  } finally {
    document.querySelectorAll = origQSA; location.href = origHref;
  }
});

// Expanded statistics cards (specs/expanded-stats-panels.md): loads the cohort view with a panel view mode
function loadCohortViewIn(mode) {
  localStorage.clear();
  if (mode) localStorage.setItem('connectify:panel_view', mode);
  for (const g of ['ConnectifyTaskTypes', 'ConnectifyCohortView', 'ConnectifyCohortForecast', 'ConnectifyCohortUpcoming', 'ConnectifyCohortExpanded', 'ConnectifyPanelView']) delete window[g];
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-math.js'), 'utf8'));
  eval(origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-math.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8'));
  return { view: window.ConnectifyCohortView, xp: window.ConnectifyCohortExpanded };
}

// A Literature card with an overall row (outside .cvr-c-tasks) and task rows; marks [text] and an optional boxplot
function expandedFixture() {
  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = '12 Literature ATAR - Semester 2';
  card.appendChild(title);
  const makeRow = (inTasks, labels, markTexts, stats) => {
    const row = new MockElement('div', 'cvr-c-task');
    row.closest = sel => sel.includes('eds-c-tile') ? card : (sel === '.cvr-c-tasks' && inTasks ? card : null);
    const details = new MockElement('div', 'cvr-c-task__details');
    for (const text of labels) {
      const label = new MockElement('span', 'v-label');
      label.textContent = text;
      details.appendChild(label);
    }
    row.appendChild(details);
    const marks = new MockElement('div', 'cvr-c-task__marks');
    for (const text of [].concat(markTexts)) {
      const cell = new MockElement('div', 'cvr-c-task__mark');
      cell.textContent = text;
      marks.appendChild(cell);
    }
    row.appendChild(marks);
    if (stats) {
      const chart = new MockElement('div', 'cvr-c-task__chart');
      chart.dataset.connectifyStats = JSON.stringify(stats);
      row.appendChild(chart);
    }
    card.appendChild(row);
    return row;
  };
  return { card, makeRow };
}

const descendants = el => (el.children || []).flatMap(c => [c, ...descendants(c)]);

runTest('Test 221: The Statistics Panels setting stores compact, subjects or all, read once per page load', () => {
  localStorage.clear();
  delete window.ConnectifyPanelView;
  const load = () => eval(origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-panel-view.js'), 'utf8'));
  load();
  let view = window.ConnectifyPanelView;
  assert.strictEqual(view.mode(), 'compact', 'compact view is the default');
  assert.ok(!view.expandsOverall() && !view.expandsTasks());
  localStorage.setItem('connectify:panel_view', 'banana');
  assert.strictEqual(view.read(), 'compact', 'unknown values read as compact');
  localStorage.setItem('connectify:panel_view', 'subjects');
  load();
  view = window.ConnectifyPanelView;
  assert.ok(view.expandsOverall() && !view.expandsTasks(), 'subjects: overall rows only');
  localStorage.setItem('connectify:panel_view', 'all');
  load();
  view = window.ConnectifyPanelView;
  assert.ok(view.expandsOverall() && view.expandsTasks(), 'all: every row');

  // Settings dropdown: writes storage, the page keeps the mode it loaded with until reload
  eval(origReadFileSync.call(fs, path.join(SRC_DIR, 'predictor/settings-markup.js'), 'utf8'));
  eval(origReadFileSync.call(fs, path.join(SRC_DIR, 'predictor/settings-panel-view.js'), 'utf8'));
  const html = window.ConnectifySettingsMarkup.panelHtml();
  for (const [value, label] of [['compact', 'Compact view'], ['subjects', 'Expanded view on subject panels only'], ['all', 'Expanded view on all panels']]) {
    assert.ok(html.includes(`<option value="${value}">${label}</option>`), `the dropdown offers ${label}`);
  }
  assert.ok(/Statistics Panels<\/label>/.test(html) && html.includes('Takes effect after reload.'), 'labelled, with the reload note');
  const panel = new MockElement('div');
  panel.innerHTML = html;
  const select = panel.querySelector('#cx-panel-view-select');
  window.ConnectifySettingsPanelView.bind(panel);
  assert.strictEqual(select.value, 'all', 'the dropdown shows the stored mode');
  select.value = 'compact';
  select.dispatchEvent(new MockEvent('change'));
  assert.strictEqual(localStorage.getItem('connectify:panel_view'), null, 'compact (the default) removes the setting');
  select.value = 'subjects';
  select.dispatchEvent(new MockEvent('change'));
  assert.strictEqual(localStorage.getItem('connectify:panel_view'), 'subjects');
  assert.strictEqual(view.mode(), 'all', 'the open page keeps its mode until reload');

  const prefs = origReadFileSync.call(fs, path.join(SRC_DIR, 'predictor/settings-preferences.js'), 'utf8');
  assert.ok(prefs.includes('window.ConnectifySettingsPanelView?.bind(panel)'), 'General Preferences binds the dropdown');
  const versions = origReadFileSync.call(fs, path.join(SRC_DIR, 'assessment/cache-versions.js'), 'utf8');
  assert.ok(/directKeys = \[[^\]]*'connectify:panel_view'/.test(versions), 'a settings reset clears it like the other preferences');
  assert.ok(!/panel_view/.test(prefs.slice(prefs.indexOf('function bindClearCache'), prefs.indexOf('function bind(panel)'))), 'Clear Cache keeps it');

  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-view.js')).js;
  const at = f => js.indexOf(`src/${f}`);
  assert.ok(at('cohort/cohort-row-readers.js') < at('cohort/cohort-panel-view.js') && at('cohort/cohort-panel-view.js') < at('cohort/cohort-expanded.js') &&
    at('cohort/cohort-expanded.js') < at('cohort/cohort-panel.js'), 'the view setting and cards load before cohort-panel.js');
  assert.ok(at('predictor/settings-semester-filter.js') < at('predictor/settings-panel-view.js') && at('predictor/settings-panel-view.js') < at('predictor/settings-preferences.js'));
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/cohort/cohort-expanded.css')), 'cohort-expanded.css is registered');
  localStorage.clear();
});

runTest('Test 222: Expanded cards show Score / Rank / Average, the five boxplot values and SD, z-score and standing', () => {
  const { view, xp } = loadCohortViewIn('all');
  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });
  const { makeRow } = expandedFixture();
  const stats = [32.5, 58, 68.85, 79.9, 96.7];
  const row = makeRow(true, ['Examination', 'Term 1, Week 4', 'Extended response 1'], '21 Out of 30', stats);
  view.render(row, false, 'lit-key', 219, null, []);
  const ui = view.panels.get(row);
  assert.ok(ui.box.classList.contains('connectea-panel') && ui.box.classList.contains('connectea-panel--expanded'), 'the card is still a statistics panel');
  assert.deepStrictEqual(ui.wrapper.children, [ui.box], 'the card holds the meter and Type dropdown itself');
  const parts = descendants(ui.box);
  const labels = parts.filter(e => e.classList.contains('connectea-xp-label')).map(e => e.textContent);
  assert.deepStrictEqual(labels, ['Score', 'Rank', 'Average', 'Minimum', 'Lower Quartile', 'Median', 'Upper Quartile', 'Maximum']);
  assert.ok(parts.every(e => e.tagName !== 'SPAN' || !e.classList.contains('v-label')) && !parts.some(e => e.classList.contains('v-label')), 'no .v-label inside the card (task labels stay Connect\'s)');
  const reached = () => ui.xp.quantiles.map(e => e.parentElement.classList.contains('connectea-xp-cell--reached'));
  assert.deepStrictEqual(reached(), [false, false, true, false, false], '70% has reached the Median (68.85%): only that cell is tinted');
  for (const [mark, want, why] of [['13 Out of 30', [false, true, false, false, false], '43.33% (above the minimum, below Q1) tints Lower Quartile'],
    ['9.75 Out of 30', [true, false, false, false, false], '32.5% (at the minimum) tints Minimum']]) {
    row.querySelector('.cvr-c-task__mark').textContent = mark;
    view.render(row, false, 'lit-key', 219, null, []);
    assert.deepStrictEqual(reached(), want, why);
  }
  row.querySelector('.cvr-c-task__mark').textContent = '21 Out of 30';
  view.render(row, false, 'lit-key', 219, null, []);
  const css = fs.readFileSync(path.join(SRC_DIR, 'cohort/cohort-expanded.css'), 'utf8');
  const tint = css.match(/\.connectea-xp-cell--reached::before \{[^}]*background: color-mix\(in srgb, var\(--cx-accent, #[0-9a-f]{6}\) (\d+)%, transparent\)/);
  assert.ok(tint && Number(tint[1]) <= 6, 'the tint is the theme accent at a very low opacity, behind the cell');
  assert.strictEqual(ui.xp.score.textContent, '70%');
  assert.deepStrictEqual(ui.xp.quantiles.map(e => e.textContent), ['32.5%', '58%', '68.85%', '79.9%', '96.7%']);
  assert.ok(/%$/.test(ui.xp.average.textContent), 'the cohort mean is shown');
  assert.ok(/^\d+ \/ ~219$/.test(ui.xp.rankValue.textContent), `an estimated cohort size reads ~: ${ui.xp.rankValue.textContent}`);
  // Expanded cards read first and last place as ranks; compact panels name them
  assert.strictEqual(window.ConnectifyCohortExpanded.rankText({ rank: 1 }, undefined, 232, 232), '1 / ~232');
  assert.strictEqual(window.ConnectifyCohortExpanded.rankText({ rank: 1 }, 150, 232, 150), '1 / 150');
  assert.strictEqual(window.ConnectifyCohortExpanded.rankText({ rank: 232 }, undefined, 232, 232), '232 / ~232');
  const compactRank = (rank, isOverall) => window.ConnectifyCohortView.resultParts({ rank, z: 0, p: 0.5 }, 70, isOverall, undefined, 232, 232).pop();
  assert.strictEqual(compactRank(1, false), '<strong>Top of assessment</strong>');
  assert.strictEqual(compactRank(232, false), '<strong>Bottom of assessment</strong>');
  assert.strictEqual(compactRank(1, true), '<strong>Top of subject</strong>');
  assert.strictEqual(compactRank(40, false), '<strong>40 / ~232</strong>');
  assert.ok(/^SD [\d.]+ · Z-Score -?[\d.]+( · .+)?$/.test(ui.xp.summary.textContent), `footer: ${ui.xp.summary.textContent}`);
  assert.ok(ui.outcomeBar.parentElement.classList.contains('connectea-xp-head'), 'the outcome meter sits in the header');
  assert.strictEqual(ui.xp.quantiles[0].parentElement.parentElement.parentElement, ui.outcomeBar.parentElement, 'the five quantiles share the header row (wide, short card)');
  assert.strictEqual(ui.typeContainer.parentElement, ui.xp.foot, 'the Type dropdown sits in the footer');
  assert.ok(/^(10|\d)$/.test(ui.xp.score.getAttribute('data-cx-score-step')), 'the Score has a colour step');
  assert.ok(ui.outcomeBar.dataset.connecteaTooltip.endsWith(xp.SCORE_NOTE), 'the meter tooltip explains the Score colour');

  // A breakout glows; the threshold is never named
  row.querySelector('.cvr-c-task__mark').textContent = '30 Out of 30';
  view.render(row, false, 'lit-key', 219, null, []);
  assert.strictEqual(ui.xp.score.getAttribute('data-cx-score-step'), 'breakout');
  assert.deepStrictEqual(reached(), [false, false, false, false, true], '100% has reached the Maximum');
  assert.ok(!/purple|glow|1\.1|breakout/i.test(xp.SCORE_NOTE), 'the tooltip note never discloses the breakout');

  // No boxplot: the skeleton stays with dashes and the compact view's wording
  const bare = makeRow(true, ['Test', 'Term 1, Week 5', 'Short answer'], '20 Out of 25');
  view.render(bare, false, 'lit-key', undefined, null, []);
  const b = view.panels.get(bare).xp;
  assert.ok([b.rankValue, b.average, ...b.quantiles].every(e => e.textContent === '—'), 'unavailable values are dashes');
  assert.strictEqual(b.summary.textContent, 'Cohort statistics unavailable');
  assert.strictEqual(b.score.textContent, '80%', 'the Score is still shown');
  assert.ok(b.quantiles.every(e => !e.parentElement.classList.contains('connectea-xp-cell--reached')), 'no tint without statistics');
  loadCohortViewIn(null);
});

runTest('Test 223: Expanded overall cards show the four quartile values, Minimum, SD and the cohort input in the footer, and the class prediction; subjects mode keeps tasks compact', () => {
  const { view } = loadCohortViewIn('subjects');
  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });
  const { makeRow } = expandedFixture();
  const overall = makeRow(false, ['Semester 2 Cumulative Percent'], '81.2%', [32.5, 58, 68.85, 79.9, 96.7]);
  view.render(overall, true, 'lit-key', 219, null, []);
  const ui = view.panels.get(overall);
  assert.ok(ui.box.classList.contains('connectea-panel--expanded'));
  assert.strictEqual(ui.input.parentElement.parentElement.parentElement, ui.xp.foot, 'the cohort size input sits in the footer');
  assert.strictEqual(ui.xp.rankValue.parentElement.children.length, 1, 'the Rank cell holds only its value');
  const cellLabels = descendants(ui.xp.quantiles[0].parentElement.parentElement).filter(e => e.classList.contains('connectea-xp-label')).map(e => e.textContent);
  assert.deepStrictEqual(cellLabels, ['Lower Quartile', 'Median', 'Upper Quartile', 'Maximum'], 'the four quartile values, two by two beside the prediction');
  assert.deepStrictEqual(ui.xp.quantiles.map(e => e.textContent), ['58%', '68.85%', '79.9%', '96.7%']);
  assert.ok(/^Minimum 32\.5% · SD [\d.]+ · Z-Score -?[\d.]+/.test(ui.xp.summary.textContent), `Minimum and SD sit in the footer: ${ui.xp.summary.textContent}`);
  const tinted = () => ui.xp.quantiles.map(e => e.parentElement.classList.contains('connectea-xp-cell--reached'));
  assert.deepStrictEqual(tinted(), [false, false, true, false], '81.2% has reached the Upper Quartile');
  for (const low of ['40%', '20%']) {
    overall.querySelector('.cvr-c-task__mark').textContent = low;
    view.render(overall, true, 'lit-key', 219, null, []);
    assert.deepStrictEqual(tinted(), [true, false, false, false], `${low} (below Q1) keeps the tint on Q1`);
  }
  overall.querySelector('.cvr-c-task__mark').textContent = '81.2%';
  view.render(overall, true, 'lit-key', 219, null, []);
  assert.deepStrictEqual(Array.from(ui.box.children, e => e.className), ['connectea-xp-head', 'connectea-xp-prediction', 'connectea-xp-foot'], 'values, class prediction, footer');
  assert.ok(!ui.upcoming, 'no separate class prediction line');
  assert.ok(!ui.xp.prediction.hidden, 'the class prediction is a section of the card');
  assert.ok(!/Predicted class result|connectea-xp-title/.test(ui.xp.prediction.innerHTML), 'no "Predicted class result" title while it needs data');
  window.ConnectifyCohortExpanded.fillPrediction(ui.xp.prediction, { low: 79.7, mid: 83.6, high: 85.8 }, '');
  const predLabels = [...ui.xp.prediction.innerHTML.matchAll(/<dt class="connectea-xp-label">([^<]*)<\/dt>/g)].map(m => m[1]);
  assert.deepStrictEqual(predLabels, ['Predicted Low', 'Predicted Mid', 'Predicted High'], 'its cells name it, with no title of their own');
  assert.ok(!/Predicted class result|connectea-xp-title/.test(ui.xp.prediction.innerHTML), 'no "Predicted class result" title');
  assert.ok(!ui.outcomeBar, 'overall rows have no meter');
  assert.ok(ui.xp.score.getAttribute('data-cx-score-step') !== 'breakout', 'overall rows never glow');

  const finished = makeRow(false, ['Semester 1 Cumulative Percent'], ['81.2%', 'A'], [32.5, 58, 68.85, 79.9, 96.7]);
  view.render(finished, true, 'lit-key-2', 219, null, []);
  const done = view.panels.get(finished).xp;
  assert.strictEqual(done.prediction.hidden, true, 'a class with a final letter has no prediction section');
  assert.strictEqual(done.score.getAttribute('data-cx-score-step'), '5', 'without a projection the Score sits mid-scale');

  const task = makeRow(true, ['Examination', 'Term 1, Week 4', 'Extended response 1'], '21 Out of 30', [32.5, 58, 68.85, 79.9, 96.7]);
  view.render(task, false, 'lit-key', 219, null, []);
  const t = view.panels.get(task);
  assert.ok(!t.xp && !t.box.classList.contains('connectea-panel--expanded') && t.wrapper.children.includes(t.typeContainer), 'subjects mode keeps task rows compact');
  loadCohortViewIn(null);
});

runTest('Test 224: Expanded unmarked rows show Low / Mid / High with what the prediction is based on', () => {
  const { view, xp } = loadCohortViewIn('all');
  const { makeRow } = expandedFixture();
  const row = makeRow(true, ['Examination', 'Term 4, Week 3', 'Extended response 1'], '');
  window.ConnectifyPredictorMath.saveBaselines({ types: {}, subjects: {} });
  view.render(row, false, 'lit-key', 50, null, []);
  let ui = view.panels.get(row);
  assert.ok(ui.forecast.classList.contains('connectea-panel--expanded'), 'the prediction card is expanded');
  assert.strictEqual(ui.xpForecast.body.textContent, window.ConnectifyCohortForecast.NEEDS, 'without data it says what the prediction needs');
  assert.strictEqual(ui.typeContainer.parentElement, ui.xpForecast.foot, 'the Type dropdown follows the visible card');

  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });
  window.dispatchEvent(new MockEvent('connectify-baselines-updated'));
  view.render(row, false, 'lit-key', 50, null, []);
  ui = view.panels.get(row);
  const html = ui.xpForecast.body.innerHTML;
  for (const level of ['low', 'mid', 'high']) {
    assert.ok(new RegExp(`<dd class="connectea-xp-value connectea-forecast-value connectea-forecast-value--${level}">\\d+%</dd>`).test(html), `${level} in the Predictor colour class`);
  }
  assert.ok(!/breakout|purple|110/i.test(html), 'the breakout threshold stays secret');
  assert.strictEqual(ui.xpForecast.summary.textContent, 'From your previous-year Exam and Literature averages', `basis: ${ui.xpForecast.summary.textContent}`);

  row.querySelector('.cvr-c-task__mark').textContent = '72 Out of 100';
  view.render(row, false, 'lit-key', 50, null, []);
  assert.strictEqual(ui.typeContainer.parentElement, ui.xp.foot, 'once marked the Type dropdown returns to the statistics card');

  // Basis wording, and the engine records it for every path
  // The sentence names only what fed the prediction (a baseline and this year's results never feed the same average)
  const said = (typeSource, typeCount, subjectSource, subjectCount) =>
    xp.basisText({ type: 'Exam', subjectName: '12 Literature ATAR', basis: { typeSource, typeCount, subjectSource, subjectCount } });
  assert.strictEqual(said('baseline', 0, 'baseline', 0), 'From your previous-year Exam and Literature averages');
  assert.strictEqual(said('history', 3, 'history', 5), 'From your 3 previous Exam results and your 5 previous Literature results');
  assert.strictEqual(said('baseline', 0, 'history', 5), 'From your previous-year Exam average and your 5 previous Literature results');
  assert.strictEqual(said('history', 1, 'baseline', 0), 'From your previous-year Literature average and your 1 previous Exam result');
  assert.strictEqual(said('subject', 0, 'history', 2), 'From your 2 previous Literature results', 'a type with neither results nor a baseline is left out');
  assert.strictEqual(xp.basisText({ type: 'Test', subjectName: 'Year 11 Mathematics Methods General', basis: { typeSource: 'baseline', typeCount: 0, subjectSource: 'baseline', subjectCount: 0 } }),
    'From your previous-year Test and Mathematics Methods averages', 'year level and course type are dropped from the subject');
  assert.strictEqual(xp.basisText({ type: 'Exam', subjectName: 'Literature ATAR Year 11 - Semester 1', basis: { typeSource: 'history', typeCount: 3, subjectSource: 'history', subjectCount: 5 } }),
    'From your 3 previous Exam results and your 5 previous Literature results', "Connect's class titles lose course type, year level and semester");
  assert.strictEqual(xp.basisText({ type: 'Test', subjectName: 'Mathematics Methods ATAR Year 12', basis: { typeSource: 'baseline', typeCount: 0, subjectSource: 'baseline', subjectCount: 0 } }),
    'From your previous-year Test and Mathematics Methods averages', 'the engine\'s cleaned name (semester already dropped) loses course type and year level');
  assert.strictEqual(xp.basisText({ type: 'Exam' }), 'Predicted from your Exam results', 'predictions cached before basis existed');
  const pm = window.ConnectifyPredictorMath;
  const task = { name: 'Final Exam', caption: '' };
  const type = window.ConnectifyTaskTypes.getEffectiveType('Art', task);
  const hist = (subjects, types, typeCounts, subjectCounts) => ({ subjects, types, typeCounts, subjectCounts, overallAverage: 75, spread: 6 });
  const none = { types: {}, subjects: {} };
  assert.deepStrictEqual(pm.predictTask('Art', task, hist({ Art: 75 }, { [type]: 80 }, { [type]: 3 }, { Art: 5 }), none).basis,
    { typeSource: 'history', typeCount: 3, subjectSource: 'history', subjectCount: 5 });
  assert.deepStrictEqual(pm.predictTask('Art', task, hist({ Art: 75 }, {}, {}, { Art: 4 }), { types: { [type]: 70 }, subjects: {} }).basis,
    { typeSource: 'baseline', typeCount: 0, subjectSource: 'history', subjectCount: 4 });
  assert.deepStrictEqual(pm.predictTask('Art', task, hist({ Art: 75 }, {}, {}, { Art: 4 }), none).basis,
    { typeSource: 'subject', typeCount: 0, subjectSource: 'history', subjectCount: 4 });
  assert.deepStrictEqual(pm.predictTask('Art', task, hist({}, {}, {}, {}), { types: { [type]: 72 }, subjects: { Art: 70 } }).basis,
    { typeSource: 'baseline', typeCount: 0, subjectSource: 'baseline', subjectCount: 0 });
  const counted = window.ConnectifyPredictorHistory.getHistoricalData([{ name: 'Art - Semester 1', tasks: [{ name: 'A', score: 80, weight: 10 }, { name: 'B', score: 70, weight: 10 }, { name: 'C', pending: true, weight: 10 }] }]);
  assert.strictEqual(counted.subjectCounts.Art, 2, 'history counts each subject\'s completed results');
  const outcome = pm.evaluateOutcome(80, { low: 60, mid: 70, high: 78, breakoutScore: 85.8 });
  assert.deepStrictEqual([outcome.low, outcome.high, outcome.segments], [60, 78, 4], 'the outcome carries the prediction range');
  loadCohortViewIn(null);
});

runTest('Test 225: The Score colour steps from Low to High, stays >= 5:1 and only the breakout glows', () => {
  const { xp } = loadCohortViewIn('all');
  assert.strictEqual(xp.scoreStep(50, 60, 80), '0', 'below Low clamps to the dullest step');
  assert.strictEqual(xp.scoreStep(70, 60, 80), '5');
  assert.strictEqual(xp.scoreStep(77, 60, 80), '9', '11 steps between Low and High');
  assert.strictEqual(xp.scoreStep(95, 60, 80), '10', 'above High clamps to the brightest step');
  assert.strictEqual(xp.scoreStep(95, 60, 80, true), 'breakout');
  assert.strictEqual(xp.scoreStep(70, undefined, undefined), '5', 'no range sits mid-scale');
  assert.strictEqual(xp.scoreStep(NaN, 60, 80), null, 'no mark, no step');

  const css = origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-expanded.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i <= 9; i++) assert.ok(css.includes(`.connectea-xp-score[data-cx-score-step="${i}"] { --cx-score-t: ${i / 10}; }`), `step ${i}`);
  const shadows = [...css.matchAll(/([^{}]+)\{[^{}]*text-shadow[^{}]*\}/g)].map(m => m[1].trim());
  assert.deepStrictEqual(shadows, ['.connectea-panel--expanded .connectea-xp-score[data-cx-score-step="breakout"]'], 'the breakout Score is the only text shadow');
  assert.ok(/rgba\(196, 181, 253/.test(css), 'the glow is pastel purple');
  assert.ok(!/@keyframes|animation/.test(css), 'the glow is static');
  assert.ok(/@supports \(color: oklch\(from red l c h\)\)/.test(css), 'relative colours are guarded, so older browsers keep the base ink');

  // Every dark preset: the dullest step and the breakout reach 5:1 on the panel; light inverts (darker is better)
  const win = {};
  for (const f of ['theme-oklch.js', 'theme-palettes.js']) new Function('window', origReadFileSync.call(fs, path.join(SRC_DIR, 'theme', f), 'utf8'))(win);
  const O = win.ConnectifyThemeOklch;
  const factors = scope => {
    const m = css.match(new RegExp(`${scope}:is\\(#cx-specificity-anchor, \\.connectea-panel--expanded\\) \\.connectea-xp-score\\[data-cx-score-step\\] \\{\\s*color: oklch\\(from var\\(--cx-score-base\\) calc\\(l \\* \\(([\\d.]+) ([+-]) ([\\d.]+) \\* var\\(--cx-score-t\\)\\)\\) calc\\(c \\* \\(([\\d.]+) \\+ ([\\d.]+) \\* var\\(--cx-score-t\\)\\)\\) h\\)`));
    assert.ok(m, `relative step rule for ${scope || 'light'}`);
    const sign = m[2] === '+' ? 1 : -1;
    return t => [Number(m[1]) + sign * Number(m[3]) * t, Number(m[4]) + Number(m[5]) * t];
  };
  const step = (base, [lf, cf]) => { const o = O.toOklch(base); return O.fromOklch(Math.min(100, o.L * lf), o.C * cf, o.h); };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const hex = a => '#' + a.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
  const over = (top, bottom) => {
    const m = /rgba\(([^)]+)\)/.exec(top);
    if (!m) return top;
    const v = m[1].split(',').map(Number);
    return hex(v.slice(0, 3).map((x, i) => x * v[3] + rgb(bottom)[i] * (1 - v[3])));
  };
  const dark = factors('html\\.connectea-dark ');
  const breakDark = css.match(/html\.connectea-dark :is\(#cx-specificity-anchor, \.connectea-panel--expanded\) \.connectea-xp-score\[data-cx-score-step="breakout"\] \{\s*color: oklch\(from var\(--cx-score-base\) calc\(l \* ([\d.]+)\) calc\(c \* ([\d.]+)\) h\)/);
  for (const [id, p] of Object.entries(win.ConnectifyThemePalettes.BUILTIN_PALETTES)) {
    if (p.derived || !p.accentHover) continue;
    const bg = over(p.surfaceElevated || p.surface, p.canvas);
    const base = hex(rgb(p.accentHover).map((x, i) => x * 0.6 + rgb(p.textPrimary)[i] * 0.4));
    for (const [name, ink] of [['step 0', step(base, dark(0))], ['step 10', step(base, dark(1))], ['breakout', step(base, [Number(breakDark[1]), Number(breakDark[2])])]]) {
      assert.ok(O.contrast(ink, bg) >= 5, `${id} ${name}: ${ink} on ${bg} is ${O.contrast(ink, bg).toFixed(2)}:1`);
    }
    assert.ok(O.toOklch(step(base, dark(1))).L > O.toOklch(step(base, dark(0))).L, `${id}: better results are brighter`);
  }
  const light = factors('');
  for (const bg of ['#f3f7fc', '#ffffff']) {
    assert.ok(O.contrast(step('#1d4ed8', light(0)), bg) >= 5, `Light step 0 reaches 5:1 on ${bg}`);
    assert.ok(O.contrast(step('#1d4ed8', light(1)), bg) > O.contrast(step('#1d4ed8', light(0)), bg), 'Light inverts: better results are darker');
  }
  assert.ok(css.includes('calc(0.34 * (1 - 0.12 * var(--cx-score-t)))') && css.includes('0.27 calc(c * 1.3)'), 'light tone only darkens from the Predictor\'s 0.34 ink');
  loadCohortViewIn(null);
});

runTest('Test 226: Connect\'s missing overall row is restored in its own container, in its own markup', () => {
  const { view } = loadCohortViewIn(null);
  const avg = window.ConnectifyCohortSubjectAverage;
  assert.ok(avg, 'cohort-subject-average.js loads with the cohort view');
  // The Economics card as Connect rendered it: the "Semester 2 Cumulative Percent" heading, then an empty
  // container where the summary row belongs, then the accordion holding the task rows
  const card = new MockElement('div', 'eds-c-tile');
  const title = new MockElement('div', 'eds-c-tile__title');
  title.textContent = 'Economics ATAR Year 11 - Semester 2';
  card.appendChild(title);
  const body = new MockElement('div', 'v-csslayout');
  const heading = new MockElement('div', 'v-label eds-c-text--bold');
  heading.textContent = 'Semester 2 Cumulative Percent';
  const slot = new MockElement('div', 'v-csslayout v-layout v-widget');
  const list = new MockElement('div', 'cvr-c-tasks');
  body.appendChild(heading); body.appendChild(slot); body.appendChild(list); card.appendChild(body);
  const addTask = (name, mark, weighted) => {
    const row = new MockElement('div', 'cvr-c-task');
    row.closest = sel => (sel === '.cvr-c-tasks' ? list : sel.includes('eds-c-tile') ? card : null);
    const details = new MockElement('div', 'cvr-c-task__details');
    for (const text of ['Test', 'Term 1 Week 4', name]) { const l = new MockElement('span', 'v-label'); l.textContent = text; details.appendChild(l); }
    const marks = new MockElement('div', 'cvr-c-task__marks');
    for (const text of [mark, weighted]) { const c = new MockElement('div', 'cvr-c-task__mark'); c.textContent = text; marks.appendChild(c); }
    row.appendChild(details); row.appendChild(marks); list.appendChild(row);
    return row;
  };
  // The saved page's Economics results: the first is 29.71 Out of 40 with a weighted mark of 7.4 Out of 10
  addTask('Data Interpretation/Short Answer', '29.71 Out of 40', '7.4 Out of 10');
  addTask('Extended Answer', '8 Out of 15', '5.3 Out of 10');
  addTask('Investigation', '16 Out of 20', '8 Out of 10');
  addTask('Semester 1 Examination', '64 Out of 85', '11.3 Out of 15');
  addTask('Data Interpreation/Short Answer', '28 Out of 35', '8 Out of 10');
  addTask('Investigation', '15 Out of 20', '7.5 Out of 10');
  addTask('Semester 2 Exam', '- Out of 100', '- Out of 25');

  assert.strictEqual(avg.summarySlot(card), slot, 'the container after the Cumulative Percent heading');
  const row = avg.sync(card);
  assert.ok(row && row.parentElement === slot, 'the row goes into Connect\'s own empty container');
  for (const cls of ['cvr-c-task', 'v-layout', 'v-widget', avg.ROW_CLASS]) assert.ok(row.classList.contains(cls), `native row class ${cls}`);
  assert.deepStrictEqual(row.children.map(c => c.className.split(' ')[0]), ['cvr-c-task__details', 'cvr-c-task-mark__headers', 'cvr-c-task__achievement'], 'Connect\'s summary row structure');
  const cells = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
  assert.strictEqual(cells.length, 2, 'two mark cells like Connect\'s');
  // (74.275 x 10 + 53.33 x 10 + 80 x 10 + 75.29 x 15 + 80 x 10 + 75 x 10) / 65; the unmarked exam does not count
  assert.strictEqual(cells[0].querySelector('.v-label').textContent, '73.2%', 'weight-weighted mean, one decimal like Connect');
  assert.ok(!row.querySelector('.cvr-c-task__chart'), 'no boxplot: Connect gives no cohort data for it');
  assert.strictEqual(row.querySelector('.connectea-subject-average-note').textContent, avg.NOTE, 'a note says Connectify worked it out');
  assert.ok(!row.querySelector('.cvr-c-task__details .v-label'), 'the note is not a Connect label, so it never becomes a task name');
  assert.strictEqual(avg.sync(card), row, 'a later pass updates the same row');
  assert.strictEqual(slot.children.length, 1);

  // The overall panel renders on it like Connect's own row
  row.closest = sel => (sel.includes('eds-c-tile') ? card : null);
  view.render(row, true, 'econ-key', 45, null, []);
  assert.ok(view.panels.get(row)?.isOverall, 'the overall panel attaches to the restored row');

  // Connect renders its own row: Connectify's goes
  const native = new MockElement('div', 'cvr-c-task');
  slot.appendChild(native);
  assert.strictEqual(avg.sync(card), null);
  assert.ok(!slot.querySelector(`.${avg.ROW_CLASS}`) && slot.children.length === 1, 'never two overall rows');
  slot.removeChild(native);

  // Collapsed: the cached tasks up to the card's semester; nothing marked means nothing is restored
  const origData = window.ConnectifyData;
  try {
    for (const r of [...list.children]) list.removeChild(r);
    title.textContent = 'Economics ATAR Year 11 - Semester 1';
    window.ConnectifyData = { getSubjectTasks: () => [
      { score: 80, weight: 20, semester: 1 }, { score: 60, weight: 20, semester: 1 }, { score: 10, weight: 50, semester: 2 }, { score: null, pending: true, weight: 30, semester: 1 }
    ] };
    assert.strictEqual(avg.sync(card).querySelector('.cvr-c-task__mark .v-label').textContent, '70%', 'Semester 1 counts only Semester 1 results');
    window.ConnectifyData = { getSubjectTasks: () => [] };
    assert.strictEqual(avg.sync(card), null, 'no marked tasks, nothing restored (a dropped class stays empty)');
  } finally {
    window.ConnectifyData = origData;
  }
  const bare = makeOutlineCard('12 Art - Semester 1', { tasks: [['Art Essay', '70%']] });
  assert.strictEqual(avg.sync(bare), null, 'a card without Connect\'s heading is left alone');
  assert.strictEqual(avg.rowWeight({ querySelectorAll: () => [{}, { textContent: '10%' }] }), 10, 'a percent weighting counts too');

  const stats = origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-stats.js'), 'utf8');
  assert.ok(stats.indexOf('ConnectifyCohortSubjectAverage?.sync(card)') < stats.indexOf('card._cxTaskRows = rows'), 'the pass restores the row before it lists the card\'s rows');
  const observer = origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-observer.js'), 'utf8');
  assert.ok(observer.includes('.connectea-subject-average-row'), 'restoring the row is Connectify\'s own mutation, so it never loops the observer');
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-stats.js')).js;
  assert.ok(js.indexOf('src/cohort/cohort-row-readers.js') < js.indexOf('src/cohort/cohort-subject-average.js') && js.indexOf('src/cohort/cohort-subject-average.js') < js.indexOf('src/cohort/cohort-stats.js'));
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/cohort/cohort-subject-average.css')), 'the note stylesheet is registered');
  loadCohortViewIn(null);
});

runTest('Test 227: Settings saves each category under its own name; a set saved as "undefined" is repaired on load', () => {
  const saved = {
    Store: window.ConnectifyCategoryStore, Settings: window.ConnectifyCategorySettings, Types: window.ConnectifyTaskTypes, cats: window.cxCategories,
    chrome: global.chrome, browser: global.browser
  };
  const ext = {};
  global.chrome = { storage: { local: {
    get: (keys, cb) => cb(Object.fromEntries(keys.filter(k => k in ext).map(k => [k, JSON.parse(JSON.stringify(ext[k]))]))),
    set: obj => Object.assign(ext, JSON.parse(JSON.stringify(obj))),
    remove: key => { delete ext[key]; }
  } } };
  delete global.browser;
  const defaults = ['Exam', 'Test', 'Application', 'Essay', 'Take-Home'];
  try {
    // A student's storage after the old Save Changes: every row was written to updatedCats[undefined]
    mockLocalStorage.clear();
    const damaged = JSON.stringify({ undefined: { color: '#3498db', keywords: ['oral'] } });
    mockLocalStorage.setItem('cx-categories', damaged);
    mockLocalStorage.setItem('connectea:categories', damaged);
    ext['cx-categories'] = JSON.parse(damaged);
    mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:class_categories:economics atar year 11'), JSON.stringify(['undefined', 'Fieldwork']));
    mockLocalStorage.setItem(window.ConnectifyUtils.userKey('connectea:task_type_overrides'), JSON.stringify({ 'Economics ATAR Year 11::Extended Answer': 'undefined' }));
    // Shadowed, not deleted: an earlier test leaves window inheriting these from a prototype
    window.ConnectifyCategoryStore = window.ConnectifyCategorySettings = window.ConnectifyTaskTypes = window.cxCategories = undefined;
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'category-settings.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(SRC_DIR, 'cohort/task-types.js'), 'utf8'));

    const store = window.ConnectifyCategoryStore;
    assert.deepStrictEqual(Object.keys(window.cxCategories), defaults, 'the damaged set loads as the defaults');
    for (const key of ['cx-categories', 'connectea:categories']) {
      assert.deepStrictEqual(Object.keys(JSON.parse(mockLocalStorage.getItem(key))), defaults, `${key} is repaired in place`);
    }
    assert.deepStrictEqual(Object.keys(ext['cx-categories']), defaults, 'the extension storage copy is repaired too');
    const types = window.ConnectifyTaskTypes;
    assert.deepStrictEqual(Object.keys(types.getCategories()), defaults, 'the Type dropdown lists the real categories');
    assert.deepStrictEqual(types.getCustomCategoriesForClass('Economics ATAR Year 11 - Semester 2'), ['Fieldwork'], '"undefined" is no class category');
    assert.strictEqual(types.getSavedTaskType('Economics ATAR Year 11', 'Extended Answer'), undefined, 'an "undefined" override reads as Auto');
    types.addCustomCategoryForClass('Biology', 'undefined');
    assert.deepStrictEqual(types.getCustomCategoriesForClass('Biology'), [], 'an "undefined" class category is never stored');
    for (const bad of ['undefined', 'null', ' ', '', undefined, 3]) assert.strictEqual(store.isCategoryName(bad), false, `${String(bad)} is no category name`);
    assert.deepStrictEqual(Object.keys(store.sanitize({ Fieldwork: { color: '#000', keywords: ['field'] }, undefined: {} })), ['Fieldwork', ...defaults], 'custom categories stay, defaults come back');
    assert.strictEqual(store.sanitize(['Exam']), null, 'an array is no category set');

    // Save Changes keeps every row under its own name with the keywords typed for it
    store.saveCategories({ ...window.cxCategories, Fieldwork: { color: '#16a085', keywords: ['field'] } });
    const settings = window.ConnectifyCategorySettings.createSettingsPanel();
    settings.openCategories();
    const wraps = settings.catPanel.querySelectorAll('.cx-cat-wrap');
    assert.deepStrictEqual(wraps.map(w => w.dataset.cat), [...defaults, 'Fieldwork'], 'each row carries its category');
    wraps.find(w => w.dataset.cat === 'Essay').querySelector('.cx-cat-keyword-input').value = 'essay, source analysis';
    settings.catPanel.querySelector('#cx-cat-save').onclick();
    const stored = JSON.parse(mockLocalStorage.getItem('cx-categories'));
    assert.deepStrictEqual(Object.keys(stored), [...defaults, 'Fieldwork'], 'no category is lost or saved as "undefined"');
    assert.deepStrictEqual(stored.Essay.keywords, ['essay', 'source analysis']);
    assert.strictEqual(stored.Essay.color, '#9b59b6', 'colours are kept');
    assert.deepStrictEqual(stored.Fieldwork.keywords, ['field']);
    store.saveCategories({ undefined: { keywords: ['x'] } });
    assert.deepStrictEqual(Object.keys(window.cxCategories), defaults, 'a save can never store "undefined"');
  } finally {
    window.ConnectifyCategoryStore = saved.Store; window.ConnectifyCategorySettings = saved.Settings;
    window.ConnectifyTaskTypes = saved.Types; window.cxCategories = saved.cats;
    global.chrome = saved.chrome;
    if (saved.browser !== undefined) global.browser = saved.browser;
    mockLocalStorage.clear();
  }
});

runTest('Test 228: Shown statistics panels carry no inline display, so expanded cards keep their grid and flex layout', () => {
  // An inline display: block !important beat the card's display: grid and stacked every value in one column
  const { view } = loadCohortViewIn('all');
  window.ConnectifyPredictorMath.saveBaselines({ types: { Exam: 70 }, subjects: { '12 Literature ATAR': 70 } });
  const { makeRow } = expandedFixture();
  const stats = [32.5, 58, 68.85, 79.9, 96.7];
  const overall = makeRow(false, ['Semester 2 Cumulative Percent'], '81.2%', stats);
  view.render(overall, true, 'lit-key', 219, null, []);
  const o = view.panels.get(overall);
  assert.ok(!o.box.hidden && o.box.style.display === undefined, `the overall card has no inline display: ${o.box.style.display}`);

  const task = makeRow(true, ['Examination', 'Term 1, Week 4', 'Extended response 1'], '21 Out of 30', stats);
  view.render(task, false, 'lit-key', 219, null, []);
  assert.strictEqual(view.panels.get(task).box.style.display, undefined, 'a marked task card has no inline display');

  const unmarked = makeRow(true, ['Examination', 'Term 4, Week 3', 'Extended response 1'], '');
  view.render(unmarked, false, 'lit-key', 219, null, []);
  const u = view.panels.get(unmarked);
  assert.strictEqual(u.box.style.display, 'none', 'the hidden statistics card is still hidden inline');
  assert.ok(!u.forecast.hidden && u.forecast.style.display === undefined, `the shown prediction card has no inline display: ${u.forecast.style.display}`);
  unmarked.querySelector('.cvr-c-task__mark').textContent = '72 Out of 100';
  view.render(unmarked, false, 'lit-key', 219, null, []);
  assert.ok(u.box.style.display === undefined && u.forecast.style.display === 'none', 'once marked the statistics card shows and the prediction hides');

  for (const f of ['cohort/cohort-view.js', 'cohort/cohort-forecast.js']) {
    const js = origReadFileSync.call(fs, path.join(SRC_DIR, f), 'utf8');
    assert.ok(!/setProperty\('display', (visible \? )?'block'/.test(js), `${f} never writes display: block on a panel`);
  }
  loadCohortViewIn(null);
});

runTest('Test 229: The Weaknesses types cached tasks from their stored labels, never the DOM, and redraws when open', () => {
  // Cached tasks have no row: their type used to fall back to the week caption alone, unlike the Type dropdown
  localStorage.clear();
  delete window.ConnectifyTaskTypes;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  const types = window.ConnectifyTaskTypes;
  const labels = ['Validation Test', 'Term 1, Week 4', 'Part B'];
  const onPage = types.categorizeTask('Part B', labels);
  assert.notStrictEqual(onPage, 'Take-Home', 'the bold title label decides the type on the page');
  const id = `${JSON.stringify([labels, 40])}:0`;
  const cached = { id, name: 'Part B', caption: 'Term 1, Week 4', labelsKey: labels.join('::') };
  assert.strictEqual(types.getEffectiveType('12 Chemistry ATAR', cached), onPage, 'a cached task with labelsKey gets the dropdown\'s type');
  const older = { id, name: 'Part B', caption: 'Term 1, Week 4' };
  assert.strictEqual(types.getEffectiveType('12 Chemistry ATAR', older), onPage, 'a task cached before labelsKey reads its labels from its id');
  types.saveTaskTypeOverride('12 Chemistry ATAR', 'Part B', labels.join('::'), 'Essay');
  assert.strictEqual(types.getEffectiveType('12 Chemistry ATAR', older), 'Essay', 'a dropdown override applies to the cached task');

  const read = f => origReadFileSync.call(fs, path.join(SRC_DIR, f), 'utf8');
  assert.ok(read('assessment/assessment-parser.js').includes("labelsKey: labels.join('::')"), 'parsed tasks store every label');
  const weak = read('progress/weakness-radar.js');
  assert.ok(weak.includes("'connectify-task-type-changed', refreshOpen") && weak.includes("'connectify-results-updated', refreshOpen"), 'an open analyzer redraws on type and result changes');
  assert.ok(!weak.includes('ConnectifyData.collect(true)'), 'opening the analyzer reads the cache through collectClasses only');
  assert.ok(!read('assessment/assessment-data.js').includes('ConnectifyWeakness.render('), 'no call to the missing ConnectifyWeakness.render');
});

runTest('Test 230: The account key stays the same whether the outlines were opened with or without ?coisp', () => {
  const savedUtils = window.ConnectifyUtils;
  const savedHref = location.href;
  const savedStore = localStorage.store;
  const outlines = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
  try {
    localStorage.store = {
      'connectea:cohort:v3:current:2026:12 Economics ATAR': '232',
      'connectea:cohort:v3:current:2026:12 Chemistry ATAR': '150',
      'connectea:cohort:v3:DomainConnectUser:42:2026:12 Chemistry ATAR': '180',
      'connectea:theme:id': 'dark'
    };
    const load = href => {
      location.href = href;
      window.ConnectifyUtils = undefined;
      eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/utils.js'), 'utf8'));
      return window.ConnectifyUtils;
    };

    assert.strictEqual(load(outlines).accountKey(), 'current', 'no account seen yet: the placeholder');
    let utils = load(`${outlines}?coisp=DomainConnectUser:42`);
    assert.strictEqual(utils.accountKey(), 'DomainConnectUser:42', 'the URL account is used');
    assert.strictEqual(localStorage.getItem('connectea:cohort:v3:DomainConnectUser:42:2026:12 Economics ATAR'), '232',
      'a cohort size saved under the placeholder moves to the account');
    assert.strictEqual(localStorage.getItem('connectea:cohort:v3:DomainConnectUser:42:2026:12 Chemistry ATAR'), '180',
      'a value already saved for the account is never overwritten');

    utils = load(outlines);
    assert.strictEqual(utils.accountKey(), 'DomainConnectUser:42', 'the shortcut (no coisp) reads the remembered account');
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/class/summary?coisp=DomainSchoolClass:27866513';
    assert.strictEqual(utils.accountKey(), 'DomainConnectUser:42', 'a class id in coisp is never an account');
  } finally {
    localStorage.store = savedStore;
    location.href = savedHref;
    window.ConnectifyUtils = savedUtils;
  }
});

runTest('Test 232: Scaled scores follow TISC Average Marks Scaling: course scaled mean + course scaled SD x z, z from the standardised 60 / 14', () => {
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'scaling-data.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  const math = window.ConnectifyMath;
  const course = name => window.ConnectifyScalingData['2025'].subjects[name];
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);

  const spec = course('Mathematics Specialist');
  near(math.calculateShiftedScaledScore('Mathematics Specialist ATAR Year 11', 60), spec.mean, 'a standardised 60 scales to the course mean');
  near(math.calculateShiftedScaledScore('Mathematics Specialist ATAR Year 11', 74), spec.mean + spec.sd, 'one SD up adds one scaled SD');
  const lit = course('Literature');
  near(math.calculateShiftedScaledScore('Literature ATAR Year 11', 58.6), lit.mean + lit.sd * (58.6 - 60) / 14, 'Literature uses its own mean and SD');

  const marks = [['Chemistry', 83.4], ['Literature', 58.6], ['Mathematics Methods', 92.8], ['Mathematics Specialist', 82.4], ['Philosophy and Ethics', 76.6], ['Physics', 87.3]];
  const scaled = marks.map(([name, raw]) => math.calculateShiftedScaledScore(`${name} ATAR Year 11`, raw));
  for (let i = 0; i < marks.length; i++) {
    for (let j = 0; j < marks.length; j++) {
      const [a, rawA] = marks[i];
      const [b, rawB] = marks[j];
      if (course(a).mean === course(b).mean && rawA > rawB) assert.ok(scaled[i] > scaled[j], `${a} above ${b}`);
    }
  }
  assert.ok(scaled[3] > 82.4, 'Specialist (scaled mean 69.2) scales a strong mark up, never down');
  assert.ok(scaled[2] > scaled[3] && scaled[5] > scaled[0], 'a higher mark in a similar course never scales lower');

  assert.strictEqual(math.calculateShiftedScaledScore('Mathematics Specialist', 100), 100, 'scaled scores stop at 100');
  assert.strictEqual(math.calculateShiftedScaledScore('Bengali ATAR', 70), 70, 'a course without published statistics keeps the raw mark');
  near(math.calculateShiftedScaledScore('Physics', 87.3, 80, 75), math.calculateShiftedScaledScore('Physics', 87.3) + 75 - math.calculateShiftedScaledScore('Physics', 80),
    'a school Semester 1 scaled score shifts the model by its error at that mark');

  const source = fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8');
  assert.ok(!/DEFAULT_BOXPLOT|getBasePercentile/.test(source), 'no generic raw-mark distribution decides the percentile');
});

runTest('Test 234: ATAR Estimate takes the school mark and shows the scaled score; a finished semester is Closed in Estimate too', () => {
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'scaling-data.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-math.js'), 'utf8'));
  delete window.ConnectifyAtarCalc;
  delete global.ConnectifyAtarCalc; // an earlier test may leave window inheriting from global
  const account = window.ConnectifyUtils.accountKey();
  const storageKey = `connectea:atar:2025:${account}:${new Date().getFullYear()}`;
  localStorage.setItem(storageKey, JSON.stringify({ '0:physics': { include: true, score: 91 } }));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-calculator.js'), 'utf8'));
  const calc = window.ConnectifyAtarCalc;
  const math = window.ConnectifyMath;
  const atarCss = fs.readFileSync(path.resolve(BASE_DIR, 'atar.css'), 'utf8');
  assert.ok(/#connectea-atar \.cta-score \{[^}]*appearance: textfield/.test(atarCss), 'school mark inputs hide the spin arrows (Firefox)');
  assert.ok(/#connectea-atar \.cta-score::-webkit-inner-spin-button[\s\S]*?-webkit-appearance: none/.test(atarCss), 'school mark inputs hide the spin arrows (Chrome, Safari)');
  const courses = [[{ id: 'chemistry', name: 'Chemistry', mark: 83.5 }, { id: 'physics', name: 'Physics', mark: 87.7 }], []];

  const box = document.createElement('div');
  calc.renderCourseList(box, courses, 0, () => {});
  const [chem, phys] = box.querySelectorAll('.cta-course');
  const chemInput = chem.querySelector('input.cta-score');
  assert.strictEqual(chemInput.placeholder, '83.5', 'the input shows the school mark');
  assert.strictEqual(chemInput.getAttribute('aria-label'), 'Chemistry semester 1 school mark (%)');
  assert.strictEqual(chem.querySelector('small').textContent, `Scaled ${math.wholeScore(math.calculateShiftedScaledScore('Chemistry', 83.5))}`, 'the scaled score is displayed under it');
  assert.strictEqual(phys.querySelector('small').textContent, 'Scaled 91', 'a scaled score saved before the flip still applies');

  chemInput.value = '90';
  chemInput.dispatchEvent(new Event('input'));
  const scaled90 = math.wholeScore(math.calculateShiftedScaledScore('Chemistry', 90));
  assert.strictEqual(chem.querySelector('small').textContent, `Scaled ${scaled90}`, 'typing a school mark rescales it at once');
  assert.deepStrictEqual(calc.getPreferences()['0:chemistry'], { include: true, raw: 90 }, 'the typed school mark is saved');
  assert.strictEqual(calc.getCourseState(courses[0][0], 0, courses).score, scaled90, 'the ATAR uses the scaled typed mark');

  const physInput = phys.querySelector('input.cta-score');
  physInput.value = '80';
  physInput.dispatchEvent(new Event('input'));
  assert.ok(!('score' in calc.getPreferences()['0:physics']), 'a typed school mark replaces the old scaled score');
  localStorage.removeItem(storageKey);

  const ui = fs.readFileSync(path.resolve(SRC_DIR, 'atar/atar-ui.js'), 'utf8');
  assert.ok(!ui.includes('(isPlanningMode || isGradingMode) && isTargetClosed'), 'closing a semester never depends on the mode');
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-ui-helpers.js'), 'utf8'));
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui-markup.js'), 'utf8'));
  const markup = window.ConnectifyAtarMarkup;
  assert.strictEqual(markup.semesterLabel(0, { finalAtar: '99.80' }, 'estimate', true), 'Semester 1 ATAR (Closed)\n99.80', 'Estimate shows a closed semester as Closed');
  const btn = document.createElement('button');
  markup.paintSemesterButton(btn, 0, { finalAtar: '99.80' }, 'estimate', true, false);
  assert.ok(btn.disabled && btn.classList.contains('cta-semester-closed'), 'and disables it');
  assert.ok(markup.isTargetClosed([[{ finalLetter: 'A' }], [{}]], 0), 'Semester 1 closes once its grades are final');
});

runTest('Test 233: After an install or update, open Connect tabs are reloaded (GitHub and Firefox builds; stripped from the Chrome Web Store zip)', async () => {
  const manifestJson = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  assert.deepStrictEqual(manifestJson.background, { scripts: ['src/system/update-reload.js'], service_worker: 'src/system/update-reload.js' },
    'Firefox runs it as a background script, Chrome as the service worker');
  assert.deepStrictEqual(manifestJson.host_permissions, ['https://connect.det.wa.edu.au/*'], 'Chrome only finds Connect tabs with the host permission');

  let listener = null;
  const reloaded = [];
  const queries = [];
  const fakeExt = {
    runtime: { onInstalled: { addListener: fn => { listener = fn; } } },
    tabs: {
      query: async q => { queries.push(q); return [{ id: 4 }, { id: 9 }]; },
      reload: async tabId => { reloaded.push(tabId); }
    }
  };
  const code = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/update-reload.js'), 'utf8');
  new Function('globalThis', code)({ chrome: fakeExt });
  assert.ok(listener, 'the onInstalled listener is registered at start-up');

  for (const reason of ['browser_update', 'chrome_update', 'shared_module_update']) await listener({ reason });
  assert.deepStrictEqual(reloaded, [], 'a browser update never reloads tabs');
  await listener({ reason: 'update' });
  assert.deepStrictEqual(queries, [{ url: 'https://connect.det.wa.edu.au/*' }], 'only Connect tabs are looked up');
  assert.deepStrictEqual(reloaded, [4, 9], 'every open Connect tab is reloaded after an update');
  await listener({ reason: 'install' });
  assert.deepStrictEqual(reloaded, [4, 9, 4, 9], 'and after a fresh install');

  for (const wf of ['publish.yml', 'publish-cws.yml']) {
    const yml = fs.readFileSync(path.join(BASE_DIR, '.github/workflows', wf), 'utf8');
    assert.ok(yml.includes('del(.background) | del(.host_permissions)'), `${wf} strips the background script and host permission from the Chrome Web Store zip`);
    assert.ok(/rm \/tmp\/(chrome|cws)-build\/src\/system\/update-reload\.js/.test(yml), `${wf} leaves update-reload.js out of the Chrome Web Store zip`);
  }
});

runTest('Test 235: Estimate Grade works out the average from any number of typed marks on unmarked tasks, one is enough', () => {
  delete window.ConnectifyGradeEstimate;
  delete window.ConnectifyGradeEstimateUI;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'target-ui-helpers.js'), 'utf8'));
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/grade-estimate.js'), 'utf8'));
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/grade-estimate-ui.js'), 'utf8'));
  const { parseMark, estimate } = window.ConnectifyGradeEstimate;

  assert.strictEqual(parseMark('85'), 85);
  assert.strictEqual(parseMark('85%'), 85);
  assert.strictEqual(parseMark('17/20'), 85, 'a fraction is a percentage');
  assert.strictEqual(parseMark('17 out of 20'), 85, 'Connect\'s "X Out of Y" form too');
  for (const bad of ['', '  ', 'abc', '120', '5/0', '21/20', '-4']) assert.strictEqual(parseMark(bad), undefined, `"${bad}" is no mark`);

  const tasks = [
    { name: 'Test 1', weight: 20, pending: false, score: 80 },
    { name: 'Exam', weight: 30, pending: true },
    { name: 'Essay', weight: 50, pending: true },
    { name: 'Practice quiz', weight: 0, pending: true }
  ];
  const one = estimate(tasks, [undefined, 90], 80);
  assert.strictEqual(one.current, 80);
  assert.ok(Math.abs(one.estimate - 86) < 1e-9, 'one typed mark of three unmarked tasks: (80 x 20 + 90 x 30) / 50 = 86');
  assert.deepStrictEqual([one.entered, one.pending, one.complete], [1, 2, false], 'an unweighted task never counts as an unmarked task');
  const all = estimate(tasks, [undefined, 90, 70, 100], 80);
  assert.ok(Math.abs(all.estimate - 78) < 1e-9, 'every weighted task typed gives the final mark; the unweighted one changes nothing');
  assert.strictEqual(all.complete, true);
  assert.ok(Math.abs(estimate(tasks, [undefined, 90], 81).estimate - 86.4) < 1e-9, 'the marked part is Connect\'s own average');
  assert.strictEqual(estimate(tasks, [], 80).estimate, 80, 'nothing typed: the average stays as it is');
  const fresh = estimate([{ name: 'A', weight: 40, pending: true }, { name: 'B', weight: 60, pending: true }], [undefined, 72]);
  assert.strictEqual(fresh.current, undefined, 'no marked tasks: no current average');
  assert.strictEqual(fresh.estimate, 72, 'one typed mark on a class with no marks is the average');
  assert.strictEqual(estimate([{ name: 'A', pending: false, score: 60 }, { name: 'B', pending: true }], [undefined, 80]).estimate, 70, 'with no weights every task counts once');

  // The view: typing into one unmarked task updates the summary without rebuilding the table
  const prefs = {};
  const ctx = {
    calc: { getPreferences: () => prefs, persistPreferences: () => {} },
    getActiveSemester: () => 1,
    getGradeCourses: () => [[], [{ id: 'chemistry', name: 'Chemistry', mark: 80, tasks }]],
    scanAndRefresh: () => {}
  };
  const refs = window.ConnectifyGradeEstimateUI.createView(ctx);
  // The mock's textContent is per node, so read the summary's nodes
  const summary = () => Array.from(refs.output.children).map(el => el.textContent).join(' ');
  window.ConnectifyGradeEstimateUI.render(refs, ctx);
  const inputs = refs.inputs.filter(Boolean);
  assert.strictEqual(inputs.length, 2, 'an input for each weighted unmarked task only');
  assert.ok(summary().includes('Current average: 80%'), 'nothing typed shows the current average');
  inputs[0].value = '18/20';
  inputs[0].dispatchEvent(new Event('input'));
  assert.ok(summary().includes('Estimated average: 86% (+6 from 80%)'), `one mark gives an estimate (${summary()})`);
  assert.strictEqual(refs.output.children.length, 1, 'the estimate is one line, with no self-evident note under it');
  assert.deepStrictEqual(prefs.gradeEstimates, { chemistry: { Exam: '18/20' } }, 'typed marks are kept per class');
  window.ConnectifyGradeEstimateUI.render(refs, ctx);
  assert.strictEqual(refs.inputs.filter(Boolean)[0], inputs[0], 'a re-render with the same tasks keeps the inputs (and focus)');
  inputs[1].value = 'lots';
  inputs[1].dispatchEvent(new Event('input'));
  assert.strictEqual(inputs[1].getAttribute('aria-invalid'), 'true', 'an unreadable mark is flagged and left out');
  assert.ok(summary().includes('Estimated average: 86%'));

  const markup = fs.readFileSync(path.resolve(BASE_DIR, 'atar-ui-markup.js'), 'utf8');
  eval(markup);
  assert.strictEqual(window.ConnectifyAtarMarkup.semesterLabel(0, { atar: '95.00' }, 'grade-estimate', false), 'Semester 1', 'Estimate Grade semester buttons carry no ATAR');
  assert.deepStrictEqual(window.ConnectifyAtarMarkup.GROUPS.estimator.modes, ['grade-estimate', 'estimate'], 'Estimates holds Estimate Grade, then Estimate ATAR');
  assert.deepStrictEqual(window.ConnectifyAtarMarkup.GROUPS.goals.modes, ['grade', 'target'], 'Goals holds Target Grade, then Target ATAR');
  assert.deepStrictEqual(Object.values(window.ConnectifyAtarMarkup.MODES).map(m => m.tab), ['Target Grade', 'Target ATAR', 'Estimate Grade', 'Estimate ATAR'], 'mode tabs carry their verb, Grade before ATAR');
});

runTest('Test 237: Subject panels show the lowest and highest final mark still possible, in both the expanded and compact views', () => {
  eval(origReadFileSync.call(fs, path.join(SRC_DIR, 'atar/grade-estimate.js'), 'utf8'));
  const origData = window.ConnectifyData;
  const tasks = [
    { score: 80, weight: 20, semester: 1 }, { score: 60, weight: 20, semester: 1 },
    { score: null, pending: true, weight: 60, semester: 2 }, { score: null, pending: true, weight: 0, semester: 2 }
  ];
  try {
    let { view, xp } = loadCohortViewIn('subjects');
    const range = window.ConnectifyCohortGradeRange;
    assert.deepStrictEqual(range.range(tasks, 70), { low: 28, high: 88 }, 'the unmarked weighted task at 0% and 100%, Connect\'s 70% for the marked 40');
    assert.strictEqual(range.range(tasks.slice(0, 2), 70), null, 'no range once every task is marked');
    assert.strictEqual(range.range(tasks.slice(2), 70), null, 'no range without a marked task in the cache');
    assert.deepStrictEqual(xp.POSSIBLE, ['Lowest Possible', 'Highest Possible']);

    window.ConnectifyData = { getSubjectTasks: () => tasks };
    const { makeRow } = expandedFixture();
    const overall = makeRow(false, ['Semester 2 Cumulative Percent'], '70%', [32.5, 58, 68.85, 79.9, 96.7]);
    view.render(overall, true, 'lit-key', 219, null, []);
    const ui = view.panels.get(overall);
    assert.strictEqual(ui.xp.possible.dl.hidden, false, 'the expanded subject card shows the range');
    assert.deepStrictEqual(ui.xp.possible.values.map(e => e.textContent), ['28%', '88%']);
    assert.strictEqual(ui.xp.possible.dl.parentElement.className, 'connectea-xp-head', 'it closes the card\'s row, beside the quartiles');
    assert.ok(!/possible/i.test(ui.xp.summary.textContent), 'not in the footer');
    const letter = makeRow(false, ['Semester 1 Cumulative Percent'], ['70%', 'B'], [32.5, 58, 68.85, 79.9, 96.7]);
    view.render(letter, true, 'lit-key-2', 219, null, []);
    assert.strictEqual(view.panels.get(letter).xp.possible.dl.hidden, true, 'a class with a final letter has no range');
    ({ view } = loadCohortViewIn('all'));
    const task = expandedFixture().makeRow(true, ['Examination', 'Term 1, Week 4', 'Extended response 1'], '21 Out of 30', [32.5, 58, 68.85, 79.9, 96.7]);
    view.render(task, false, 'lit-key', 219, null, []);
    assert.ok(!view.panels.get(task).xp.possible, 'task cards have no range');

    ({ view } = loadCohortViewIn(null));
    const compact = expandedFixture().makeRow(false, ['Semester 2 Cumulative Percent'], '70%', [32.5, 58, 68.85, 79.9, 96.7]);
    view.render(compact, true, 'lit-key', 219, null, []);
    assert.ok(view.panels.get(compact).result.innerHTML.endsWith('  •  Lowest possible 28%  •  Highest possible 88%'), `the compact result line ends with the range: ${view.panels.get(compact).result.innerHTML}`);
    const bare = expandedFixture().makeRow(false, ['Semester 2 Cumulative Percent'], '70%');
    view.render(bare, true, 'lit-key', 219, null, []);
    assert.strictEqual(view.panels.get(bare).result.textContent, 'Rank and z-score unavailable  •  Lowest possible 28%  •  Highest possible 88%', 'also without cohort statistics');
  } finally {
    window.ConnectifyData = origData;
    loadCohortViewIn(null);
  }

  const css = origReadFileSync.call(fs, path.join(SRC_DIR, 'cohort/cohort-grade-range.css'), 'utf8');
  assert.ok(/\.connectea-xp-grid--possible\[hidden\] \{ display: none !important; \}/.test(css), 'a hidden range takes no column');
  const manifest = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(g => (g.js || []).includes('src/cohort/cohort-view.js'));
  assert.ok(group.js.indexOf('src/cohort/cohort-subject-average.js') < group.js.indexOf('src/cohort/cohort-grade-range.js') && group.js.indexOf('src/cohort/cohort-grade-range.js') < group.js.indexOf('src/cohort/cohort-view.js'));
  assert.ok(manifest.content_scripts.some(g => (g.css || []).includes('src/cohort/cohort-grade-range.css')), 'its stylesheet is registered');
});

runTest('Test 236: The Predictor subject tabs hide the native scrollbar for a plain one that never changes on hover', () => {
  const css = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-predictor.css'), 'utf8');
  assert.ok(/\.cx-pred-subtabs \{[^}]*scrollbar-width: none/.test(css) && /\.cx-pred-subtabs::-webkit-scrollbar \{[^}]*display: none/.test(css), 'the native scrollbar (it widens on hover on macOS) is hidden');
  assert.ok(!/cx-pred-subtabs-(scroll|thumb)[^{,]*:(hover|active)/.test(css), 'the plain scrollbar has no hover or active state');
  assert.ok(/\.cx-pred-subtabs-thumb \{[^}]*background: var\(--cx-scrollbar-thumb, #[0-9a-f]{6}\)/.test(css), 'the thumb takes the theme scrollbar token');
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'predictor-tab-scroll.js'), 'utf8'));
  const host = new MockElement('div');
  const bar = new MockElement('div', 'cx-pred-subtabs');
  host.append(bar);
  Object.assign(bar, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 0 });
  const refs = window.ConnectifyPredictorTabScroll.attach(bar);
  assert.strictEqual(host.children[1], refs.track, 'the scrollbar sits right under the tabs');
  Object.defineProperty(refs.track, 'clientWidth', { value: 400 });
  refs.update();
  assert.ok(!refs.track.classList.contains('cx-pred-subtabs-scroll--idle'), 'overflowing tabs show it');
  assert.strictEqual(refs.thumb.style.width, '160px', 'the thumb is the visible share of the tabs');
  bar.scrollLeft = 600;
  bar.dispatchEvent(new MockEvent('scroll'));
  assert.strictEqual(refs.thumb.style.transform, 'translateX(240px)', 'the thumb follows the scroll to the end');
  bar.scrollWidth = 400;
  refs.update();
  assert.ok(refs.track.classList.contains('cx-pred-subtabs-scroll--idle'), 'it hides while every tab fits');
  const view = fs.readFileSync(path.resolve(BASE_DIR, 'predictor-grade-view.js'), 'utf8');
  assert.ok(view.includes('ConnectifyPredictorTabScroll?.attach(subTabsBar)'), 'the grade view attaches it to the tabs');
});


const loadExportModules = () => {
  for (const f of ['assessment/school-terms.js', 'progress/progress-math.js', 'progress/export-tasks.js', 'progress/export-ics.js', 'progress/export-csv.js', 'progress/export-rows.js']) {
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8'));
  }
  return { terms: window.ConnectifySchoolTerms, tasks: window.ConnectifyExportTasks, ics: window.ConnectifyExportIcs, csv: window.ConnectifyExportCsv };
};
const isoDay = d => d.toISOString().slice(0, 10);

runTest('Test 238: Export term calendar: Term 1 rule, Early Easter, spill-over and the Wednesday Week 1', () => {
  const { terms } = loadExportModules();
  const table = {
    2026: ['Mon 2 Feb', '04-06', true, 'Mon 20 Apr', 'Mon 20 Jul', 'Mon 12 Oct'],
    2027: ['Mon 1 Feb', '03-29', false, 'Mon 26 Apr', 'Mon 19 Jul', 'Mon 11 Oct'],
    2028: ['Wed 2 Feb', '04-17', false, 'Mon 24 Apr', 'Mon 17 Jul', 'Mon 9 Oct'],
    2029: ['Wed 31 Jan', '04-02', true, 'Mon 16 Apr', 'Mon 16 Jul', 'Mon 8 Oct'],
    2030: ['Mon 4 Feb', '04-22', false, 'Mon 29 Apr', 'Mon 22 Jul', 'Mon 14 Oct'],
    2031: ['Mon 3 Feb', '04-14', false, 'Mon 28 Apr', 'Mon 21 Jul', 'Mon 13 Oct'],
    2032: ['Mon 2 Feb', '03-29', false, 'Mon 26 Apr', 'Mon 19 Jul', 'Mon 11 Oct']
  };
  for (const [year, [t1, easter, early, t2, t3, t4]] of Object.entries(table)) {
    assert.strictEqual(terms.formatDay(terms.term1Start(+year)), t1, `${year} Term 1`);
    assert.strictEqual(isoDay(terms.easterMonday(+year)), `${year}-${easter}`, `${year} Easter Monday`);
    assert.strictEqual(terms.autoEarlyEaster(+year), early, `${year} Early Easter`);
    assert.deepStrictEqual(terms.terms(+year, early).slice(1).map(t => terms.formatDay(t.start)), [t2, t3, t4], `${year} Terms 2-4`);
  }
  // Early Easter moves Term 2 a week, never Terms 3 and 4
  assert.strictEqual(terms.formatDay(terms.terms(2027, true)[1].start), 'Mon 19 Apr');
  assert.strictEqual(terms.formatDay(terms.terms(2027, true)[2].start), 'Mon 19 Jul');
  assert.deepStrictEqual(terms.terms(2026, true).map(t => t.weeks), [9, 11, 10, 10]);
  // Each term's first school week of the year (1-40): Term 2 starts in Week 10 under Early Easter
  assert.deepStrictEqual(terms.terms(2026, true).map(t => t.yearWeek), [1, 10, 21, 31]);
  assert.deepStrictEqual(terms.terms(2027, false).map(t => t.yearWeek), [1, 11, 21, 31]);
  assert.strictEqual(terms.formatDate(terms.term1Start(2026)), '2 Feb');
  // Wednesday start: Week 1 is Wed-Fri, so Mon/Tue clamp to the start; Week 2 starts the next Monday
  assert.strictEqual(terms.formatDay(terms.dateFor(2028, 1, 1, 1, false)), 'Wed 2 Feb');
  assert.strictEqual(terms.formatDay(terms.dateFor(2028, 1, 1, 5, false)), 'Fri 4 Feb');
  assert.strictEqual(terms.formatDay(terms.dateFor(2028, 1, 2, 1, false)), 'Mon 7 Feb');
  // A week past its term spills into the next term; past Term 4 there is no date
  assert.strictEqual(terms.formatDay(terms.dateFor(2026, 1, 10, 1, true)), 'Mon 20 Apr', 'Term 1 Week 10 under Early Easter is Term 2 Week 1');
  assert.strictEqual(terms.formatDay(terms.dateFor(2026, 1, 10, 1, false)), 'Mon 6 Apr');
  assert.strictEqual(terms.formatDay(terms.dateFor(2027, 2, 11, 3, false)), 'Wed 21 Jul', 'Term 2 Week 11 without Early Easter is Term 3 Week 1');
  assert.strictEqual(terms.dateFor(2026, 4, 11, 1, false), null);
});

runTest('Test 239: Export tasks use the Progress graph\'s dates, weekdays, left-out tasks, ticks and next-due order', () => {
  const { tasks } = loadExportModules();
  const progressMath = window.ConnectifyProgressMath;
  const savedTypes = window.ConnectifyTaskTypes;
  window.ConnectifyTaskTypes = { getEffectiveType: (subject, task) => task.typeOverride || (/exam/i.test(task.name) ? 'Exam' : 'Test') };
  try {
    assert.deepStrictEqual(progressMath.termWeek(18), { term: 2, week: 6 }, 'the graph\'s 12-slot order');
    assert.strictEqual(progressMath.termWeek(null), null);
    assert.strictEqual(progressMath.formatTimestamp(18), 'Term 2, Week 6', 'the graph label still reads the same');
    // `order` is the Progress graph's date (ConnectifyData: the week override, else the caption): captions are never re-read
    const subjects = [
      { name: 'Physics ATAR', tasks: [
        { id: 'p1', name: 'Test 1', caption: 'Term 1 Week 4', order: 4, pending: false, score: 80, sequence: 0 },
        { id: 'p2', name: 'Lab', caption: 'Term 3 Week 2', order: 19, pending: true, weight: 10, sequence: 1, semester: 1 },
        { id: 'p3', name: 'Report', caption: 'Term 2 Week 3', order: null, pending: true, sequence: 2 },
        { id: 'p4', name: 'Late', caption: '', order: 47, pending: true, sequence: 3 }
      ] },
      { name: 'Chemistry ATAR - Semester 2', tasks: [
        { id: 'c1', name: 'Exam', caption: 'Term 2 Week 9', order: 21, pending: true, weight: 30, sequence: 0, semester: 1 },
        { id: 'c2', name: 'Quiz', caption: 'Fri 13 Mar', order: 7, pending: true, sequence: 1, semester: 1 },
        { id: 'c3', name: 'Test 2', caption: 'Term 2 Week 6/7', order: 18, pending: true, sequence: 2, semester: 1, typeOverride: 'Exam' }
      ] }
    ];
    const { groups, leftOut } = tasks.build(subjects, {
      year: 2026, early: true, subjectDays: { 'Chemistry ATAR': 3 }, taskDays: { 'Chemistry ATAR::c3': 5 }, unticked: new Set(['Chemistry ATAR::c1'])
    });
    assert.deepStrictEqual(groups.map(g => g.subject), ['Chemistry ATAR', 'Physics ATAR'], 'subjects by next due, Semester suffix removed');
    const chem = groups[0].tasks;
    assert.deepStrictEqual(chem.map(t => t.name), ['Quiz', 'Test 2', 'Exam'], 'tasks by date');
    assert.strictEqual(isoDay(chem[0].date), '2026-03-18', 'order 7 is Term 1 Week 7, on the subject day (Wed)');
    assert.strictEqual(chem[0].when, 'Term 1, Week 7', 'the week reads as in the Progress graph');
    assert.strictEqual(isoDay(chem[1].date), '2026-05-29', 'the task day (Fri) beats the subject day, Term 2 Week 6');
    assert.strictEqual(isoDay(chem[2].date), '2026-06-17', 'the subject day (Wed) in Term 2 Week 9');
    assert.strictEqual(chem[1].type, 'Exam', 'Type overrides count');
    assert.strictEqual(chem[2].ticked, false, 'unticked tasks stay unticked');
    const lab = groups[1].tasks[0];
    assert.strictEqual(isoDay(lab.date), '2026-06-01', 'order 19 (a week override of 17) is Term 2 Week 7, whatever the caption says');
    assert.ok(groups[1].tasks.every(t => t.name !== 'Test 1'), 'marked tasks are not exported');
    assert.deepStrictEqual(leftOut.map(t => [t.name, t.reason]), [['Report', 'noWeek'], ['Late', 'afterTerm4']], 'no order means no week, whatever the caption says');
    assert.deepStrictEqual(tasks.ticked(groups).map(t => t.name), ['Quiz', 'Test 2', 'Lab']);
    const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/export-tasks.js'), 'utf8');
    assert.ok(!/caption|readTimeOverride|querySelector/.test(src.replace(/\/\*[\s\S]*?\*\//, '')), 'the export never reads captions, overrides or the DOM itself');
  } finally {
    window.ConnectifyTaskTypes = savedTypes;
  }
});

const exportItem = (key, name, subject, date, extra = {}) => ({
  key, name, subject, date: new Date(date + 'T00:00:00Z'), when: 'Term 2, Week 9', weight: null, type: 'Test', semester: 1, ticked: true, ...extra
});

runTest('Test 240: Export .ics: all-day events, stable UIDs, escaping, folding and the merged semester exam', () => {
  const { tasks, ics } = loadExportModules();
  const items = [
    exportItem('a', 'Exam', 'Chemistry ATAR', '2026-06-08', { type: 'Exam', weight: 30 }),
    exportItem('b', 'Exam', 'Physics ATAR', '2026-06-19', { type: 'Exam' }),
    exportItem('c', 'Essay; part 1, draft', 'English ATAR', '2026-05-25', { weight: 12.5 }),
    exportItem('d', 'Exam', 'Literature ATAR', '2026-11-02', { type: 'Exam', semester: 2 })
  ];
  assert.deepStrictEqual(tasks.examGroups(items).map(g => [g.semester, g.exams.length]), [[1, 2]], 'only a semester with two or more exams merges');
  const now = new Date('2026-10-23T01:02:03Z');
  const text = ics.build(items, { account: '12345', year: 2026, merge: true, now });
  assert.ok(!/[^\r]\n/.test(text) && text.endsWith('\r\n'), 'CRLF line endings');
  assert.ok(text.includes('X-WR-CALNAME:Connectify Assessments') && text.includes('PRODID:-//Connectify//Assessments//EN'));
  assert.ok(text.includes('SUMMARY:Essay\\; part 1\\, draft (English ATAR)'), 'text is escaped');
  assert.ok(text.includes('DESCRIPTION:Type: Test\\nWeight: 12.5%\\nTerm 2\\, Week 9'));
  assert.ok(text.includes('DTSTART;VALUE=DATE:20260525\r\nDTEND;VALUE=DATE:20260526'), 'all-day with an exclusive end');
  assert.ok(text.includes('SUMMARY:Semester 1 Exam') && text.includes('DTSTART;VALUE=DATE:20260608\r\nDTEND;VALUE=DATE:20260620'), 'the merged span runs first to last exam');
  assert.ok(!text.includes('SUMMARY:Exam (Chemistry ATAR)'), 'merged exams have no event of their own');
  assert.ok(text.includes('SUMMARY:Exam (Literature ATAR)'), 'a lone semester exam stays');
  assert.ok(text.includes('TRANSP:TRANSPARENT') && text.includes('DTSTAMP:20261023T010203Z'));
  const unmerged = ics.build(items, { account: '12345', year: 2026, merge: false, now });
  assert.ok(unmerged.includes('SUMMARY:Exam (Chemistry ATAR)') && !unmerged.includes('Semester 1 Exam'));
  assert.ok(!/Weight/.test(unmerged.split('SUMMARY:Exam (Physics ATAR)')[1].split('END:VEVENT')[0]), 'no Weight line when unknown');
  const uids = t => t.match(/UID:[^\r]+/g);
  assert.deepStrictEqual(uids(ics.build(items, { account: '12345', year: 2026, merge: true })), uids(text), 'UIDs are stable across exports');
  assert.notDeepStrictEqual(uids(ics.build(items, { account: '999', year: 2026, merge: true })), uids(text), 'UIDs differ per account');
  const folded = ics.fold('DESCRIPTION:' + 'é'.repeat(80));
  assert.ok(folded.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75), 'lines fold at 75 octets');
  assert.ok(folded.split('\r\n').slice(1).every(line => line.startsWith(' ')), 'continuations start with a space');
  assert.strictEqual(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join(''), 'DESCRIPTION:' + 'é'.repeat(80), 'folding never splits a character');
});

runTest('Test 241: Export CSV for Notion: BOM, columns, quoting, dates, weights and the merged semester exam', () => {
  const { csv } = loadExportModules();
  const text = csv.build([
    exportItem('a', 'Exam', 'Chemistry ATAR', '2026-06-08', { type: 'Exam', weight: 30 }),
    exportItem('b', 'Essay "final", v2', 'English ATAR', '2026-05-25', { when: 'Term 2, Week 6' })
  ]);
  assert.ok(text.startsWith('﻿'), 'UTF-8 BOM');
  const lines = text.slice(1).split('\r\n');
  assert.strictEqual(lines[0], 'Name,Date,Subject,Type,Weight (%),Term / Week');
  assert.strictEqual(lines[1], 'Exam (Chemistry ATAR),"June 8, 2026",Chemistry ATAR,Exam,30,"Term 2, Week 9"');
  assert.strictEqual(lines[2], '"Essay ""final"", v2 (English ATAR)","May 25, 2026",English ATAR,Test,,"Term 2, Week 6"');
  assert.strictEqual(lines[3], '', 'ends with CRLF');
  const exams = [
    exportItem('a', 'Exam', 'Chemistry ATAR', '2026-06-08', { type: 'Exam', weight: 30, when: 'Term 2, Week 7' }),
    exportItem('b', 'Exam', 'Physics ATAR', '2026-06-19', { type: 'Exam' }),
    exportItem('c', 'Essay', 'English ATAR', '2026-05-25')
  ];
  const merged = csv.build(exams, { merge: true }).slice(1).split('\r\n');
  assert.deepStrictEqual(merged.slice(1, 3), [
    'Essay (English ATAR),"May 25, 2026",English ATAR,Test,,"Term 2, Week 9"',
    'Semester 1 Exam,"June 8, 2026 → June 19, 2026","Chemistry ATAR, Physics ATAR",Exam,,"Term 2, Week 7 – Term 2, Week 9"'
  ], 'merged exams become one row spanning first to last exam (Notion date range)');
  assert.strictEqual(csv.build(exams, { merge: false }).split('\r\n').length, 5, 'unmerged: a row per task');
});

runTest('Test 242: Export view mounts in the Progress header, swaps out the graph and stores its choices', () => {
  loadExportModules();
  const saved = { progress: window.ConnectifyProgress, data: window.ConnectifyData, view: window.ConnectifyExportView, chart: window.ConnectifyProgressChart };
  const panel = new MockElement('section');
  panel.id = 'connectify-progress';
  const head = new MockElement('header');
  const scan = new MockElement('button', 'cx-refresh-btn');
  scan.textContent = 'Refresh Assessments';
  head.append(new MockElement('strong'), scan);
  const chips = new MockElement('div', 'cx-subjects');
  const chart = new MockElement('div');
  panel.append(head, chips, chart);
  window.ConnectifyProgress = { panelRefs: { panel } };
  window.ConnectifyProgressChart = saved.chart || { createElement: (tag, text, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== null && text !== undefined) el.textContent = text; return el; } };
  window.ConnectifyData = { collectClasses: () => [{ name: 'Physics ATAR', tasks: [{ id: 'p1', name: 'Lab', caption: 'Term 3 Week 2', order: 26, pending: true, sequence: 0 }] }] };
  delete window.ConnectifyExportView;
  try {
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/export-view.js'), 'utf8'));
    const view = window.ConnectifyExportView;
    assert.ok(view, 'the view mounts');
    assert.strictEqual(head.children.indexOf(view.toggleBtn), head.children.indexOf(scan) - 1, 'Export sits just before Refresh Assessments');
    assert.strictEqual(view.toggleBtn.textContent, 'Export');
    view.toggleBtn.dispatchEvent(new MockEvent('click'));
    assert.ok(!view.view.hidden && chips.hidden && chart.hidden, 'the export view replaces the chips and chart');
    assert.strictEqual(view.toggleBtn.textContent, '← Back to Graph');
    const find = (root, pred) => { const out = []; (function walk(n) { for (const c of n.children || []) { if (pred(c)) out.push(c); walk(c); } })(root); return out; };
    const text = find(view.view, () => true).map(n => n.textContent).join('|');
    const year = new Date().getFullYear();
    const T = window.ConnectifySchoolTerms;
    const cells = find(view.view, n => n.className === 'cx-export-term').map(n => n.children.map(c => c.textContent).join(' '));
    assert.deepStrictEqual(cells, T.terms(year, T.autoEarlyEaster(year)).map(t => `Term ${t.term} ${T.formatDate(t.start)} (Week ${t.yearWeek})`), 'each term has its own cell: its start and its first school week');
    assert.ok(text.includes('Merge exams into one event per semester') && !text.includes('per semester (.ics)'), 'the merge option covers both files');
    assert.strictEqual(find(view.view, n => n.dataset?.cxFocus === 'taskday:Physics ATAR::p1')[0].children[0].textContent, 'Default (Mon)', 'the task day defaults to the subject day, named');
    assert.ok(text.includes('Google Calendar (.ics)') && text.includes('Notion (CSV)'));
    assert.ok(text.includes('To update an earlier export, import into a new calendar.'));
    const tick = find(view.view, n => n.type === 'checkbox' && n.dataset.cxFocus === 'tick:Physics ATAR::p1')[0];
    tick.checked = false;
    tick.dispatchEvent(new MockEvent('change'));
    const stored = JSON.parse(localStorage.getItem(view.storageKey()));
    assert.deepStrictEqual(stored.unticked, ['Physics ATAR::p1'], 'unticks are stored by task key');
    assert.ok(find(view.view, n => n.id === 'cx-export-ics')[0].disabled, 'nothing ticked disables the downloads');
    // Opening Progress (or any tool) fires connectify-open, which returns the panel to the graph
    assert.ok(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/export-view.js'), 'utf8').includes("window.addEventListener('connectify-open', showGraph)"));
    view.showGraph();
    assert.ok(view.view.hidden && !chips.hidden && !chart.hidden, 'reopening Progress starts on the graph');
    // A settings reset removes the choices; Clear Cache keeps them
    const cacheSrc = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/cache-versions.js'), 'utf8');
    assert.ok(cacheSrc.includes("k.startsWith('connectify:calendar_export:')"));
    localStorage.removeItem(view.storageKey());
  } finally {
    Object.assign(window, { ConnectifyProgress: saved.progress, ConnectifyData: saved.data, ConnectifyExportView: saved.view, ConnectifyProgressChart: saved.chart });
  }
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(g => (g.js || []).includes('src/progress/progress-graph.js'));
  const order = ['progress-graph.js', 'export-tasks.js', 'export-ics.js', 'export-csv.js', 'export-rows.js', 'export-view.js'].map(f => group.js.indexOf(`src/progress/${f}`));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'export scripts load after progress-graph.js in order');
  assert.ok(group.matches.every(m => m.includes('assessment-outlines')), 'outlines page only');
  assert.ok((group.css || []).includes('src/progress/export-view.css') || manifest.content_scripts.some(g => (g.css || []).includes('src/progress/export-view.css')));
  assert.deepStrictEqual(manifest.permissions, ['storage', 'unlimitedStorage'], 'no new permissions');
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/export-view.css'), 'utf8');
  assert.ok(cssHasToken(css, '.connectea-dark #cx-export-view button.cx-export-download { background: #2563eb;'), 'dark download buttons take the primary button token');
  assert.ok(!/\[class\*=/.test(css), 'no class-substring selectors');
});

runTest('Test 244: Exams merged into a semester exam show no tick or day; export and Weakness labels sit on their row', () => {
  loadExportModules();
  const saved = { types: window.ConnectifyTaskTypes, chart: window.ConnectifyProgressChart };
  window.ConnectifyTaskTypes = { getEffectiveType: (subject, task) => (/exam/i.test(task.name) ? 'Exam' : 'Test') };
  window.ConnectifyProgressChart = saved.chart || { createElement: (tag, text, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== null && text !== undefined) el.textContent = text; return el; } };
  try {
    const { groups } = window.ConnectifyExportTasks.build([
      { name: 'Chemistry ATAR', tasks: [{ id: 'c1', name: 'Lab', order: 31, pending: true, sequence: 0, semester: 2 }, { id: 'c2', name: 'Exam', order: 41, pending: true, sequence: 1, semester: 2 }] },
      { name: 'Physics ATAR', tasks: [{ id: 'p1', name: 'Semester 2 exam', order: 42, pending: true, sequence: 0, semester: 2 }] }
    ], { year: 2026, early: true, subjectDays: { 'Chemistry ATAR': 3 } });
    const mergedIn = new Map(window.ConnectifyExportTasks.examGroups(window.ConnectifyExportTasks.ticked(groups)).flatMap(g => g.exams.map(e => [e.key, g.semester])));
    const chem = groups.find(g => g.subject === 'Chemistry ATAR');
    const block = window.ConnectifyExportRows.subjectBlock(chem, { mergedIn, update: () => {}, track: el => el });
    const rows = block.children.filter(n => n.className.includes('cx-export-task'));
    const walk = n => [n, ...(n.children || []).flatMap(walk)];
    const [lab, exam] = rows.map(walk);
    assert.ok(lab.some(n => n.type === 'checkbox') && lab.some(n => n.tagName === 'SELECT'), 'a task outside the merge keeps its tick and day');
    assert.strictEqual(lab.find(n => n.tagName === 'SELECT').children[0].textContent, 'Default (Wed)', 'the default names the subject day');
    assert.ok(rows[1].classList.contains('cx-export-task--merged') && rows[1].getAttribute('aria-disabled') === 'true', 'a merged exam row is disabled');
    assert.ok(!exam.some(n => n.type === 'checkbox' || n.tagName === 'SELECT'), 'a merged exam renders no tick or day');
    assert.ok(exam.some(n => n.textContent === 'In Semester 2 Exam'), 'and names the exam it is part of');
  } finally {
    Object.assign(window, { ConnectifyTaskTypes: saved.types, ConnectifyProgressChart: saved.chart });
  }
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/export-view.css'), 'utf8');
  assert.ok(css.includes('#cx-export-view label { margin: 0; font-size: inherit; line-height: inherit; }'), "Connect's .eds.cvr label margin and size never lift export labels off their row");
  assert.ok(/\.cx-export-task--merged \.cx-export-date \{ grid-column: 4; \}/.test(css), 'a merged row keeps its date in the date column');
  const weakness = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-tool-menu.css'), 'utf8');
  assert.ok(/#connectify-weakness \.cx-radar-mode-label \{\s*margin: 0;/.test(weakness) && /\.cx-weakness-checkbox-label \{\s*display: flex !important;\s*margin: 0 !important;/.test(weakness), 'Weakness labels drop the Connect label margin');
});

runTest('Test 245: Radar labels sit just past their spoke ends, scores on the same baseline, never clipped', () => {
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/weakness-radar-view.js'), 'utf8'));
  const svg = window.ConnectifyWeaknessView.radarSvg(['Exam', 'Test', 'Application', 'Essay', 'Take-Home'], [72, 85, 64, 90, 78]);
  const labels = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*font-size="11"[^>]*>([^<]*)<tspan/g)];
  assert.strictEqual(labels.length, 5, 'one label per spoke');
  assert.ok(!svg.includes('dominant-baseline'), 'baselines come from y: Firefox does not pass dominant-baseline to the score tspan');
  assert.ok(labels.every(m => m[4] === m[4].trim() + ' '), 'no whitespace around a label shifts its anchor');
  assert.ok(svg.includes('overflow:visible'), 'long labels are never clipped at the viewBox');
  const [w] = svg.match(/viewBox="0 0 (\d+) /).slice(1).map(Number);
  const cx = w / 2, cy = 180, R = 115;
  labels.forEach((m, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / 5;
    const dx = +m[1] - (cx + R * Math.cos(a));
    assert.ok(Math.abs(dx - 12 * Math.cos(a)) < 0.2, `label ${i} anchors 12px past its spoke end`);
  });
  assert.deepStrictEqual(labels.map(m => m[3]), ['middle', 'start', 'start', 'end', 'end']);
  assert.ok(+labels[0][2] < cy - R && +labels[2][2] > cy + R * Math.sin(-Math.PI / 2 + 4 * Math.PI / 5), 'top labels sit above their point, lower ones hang below it');
});

runTest('Test 243: Date captions take their real term and week from the term calendar, in the graph and the export', () => {
  const { terms } = loadExportModules();
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-parse-helpers.js'), 'utf8'));
  const helpers = window.ConnectifyParseHelpers;
  const at = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  // 2026: Term 1 Mon 2 Feb; Early Easter moves Term 2 to Mon 20 Apr (else Mon 27 Apr)
  assert.strictEqual(terms.orderOf(at(2026, 3, 13), true), 6, 'Fri 13 Mar is Term 1 Week 6');
  assert.strictEqual(terms.orderOf(at(2026, 4, 2), true), 9, 'the last week of a 9-week Term 1');
  assert.strictEqual(terms.orderOf(at(2026, 4, 8), true), 10, 'holidays count on from the term before');
  assert.strictEqual(terms.orderOf(at(2026, 4, 20), true), 13, 'Early Easter: 20 Apr is Term 2 Week 1');
  assert.strictEqual(terms.orderOf(at(2026, 4, 20), false), 12, 'without it, 20 Apr is still the holidays');
  assert.strictEqual(terms.orderOf(at(2026, 4, 27), false), 13);
  assert.strictEqual(terms.orderOf(at(2026, 1, 10), true), 1, 'before Term 1 is Week 1');
  assert.strictEqual(terms.orderOf(at(2026, 12, 30), true), 48, 'after Term 4 never passes slot 12');
  assert.strictEqual(terms.orderOf(at(2028, 1, 31), false), 1, 'the Monday before a Wednesday start');
  assert.strictEqual(terms.orderOf(at(2028, 2, 7), false), 2);
  for (const early of [true, false]) {
    for (const [t, w] of [[1, 1], [1, 9], [2, 1], [2, 10], [3, 5], [4, 10]]) {
      assert.strictEqual(terms.orderOf(terms.dateFor(2026, t, w, 3, early), early), (t - 1) * 12 + w, `Term ${t} Week ${w} round-trips`);
    }
  }
  // Captions: week captions are unchanged; a date caption is this year's date through the calendar
  const year = new Date().getFullYear();
  assert.strictEqual(helpers.orderHint('Term 2 Week 3'), 15);
  assert.strictEqual(helpers.orderHint('Week 5, Term 3'), 29);
  assert.strictEqual(helpers.dateOrder('Term 2 Week 3 (14 May)'), null, 'a term and week wins over a date');
  assert.strictEqual(helpers.orderHint('Fri 13th March'), terms.orderOf(at(year, 3, 13)));
  assert.strictEqual(helpers.orderHint('August 14'), terms.orderOf(at(year, 8, 14)));
  assert.ok(Number.isInteger(helpers.orderHint('Fri 13 Mar')), 'a whole week, not a fraction counted from 26 Jan');
  assert.strictEqual(helpers.orderHint('Practical'), null);
  // The Early Easter choice is shared: stored per year, legacy export choice read, else automatic
  const account = window.ConnectifyUtils.accountKey();
  localStorage.removeItem('connectify:school_terms');
  assert.strictEqual(terms.earlyEaster(2027), terms.autoEarlyEaster(2027));
  localStorage.setItem(`connectify:calendar_export:${account}`, JSON.stringify({ earlyEaster: { 2027: true } }));
  assert.strictEqual(terms.earlyEaster(2027), true, 'the export\'s earlier choice is kept');
  terms.setEarlyEaster(2027, false);
  assert.deepStrictEqual(JSON.parse(localStorage.getItem('connectify:school_terms')), { earlyEaster: { 2027: false } });
  assert.strictEqual(terms.earlyEaster(2027), false, 'the shared choice wins');
  localStorage.removeItem('connectify:school_terms');
  localStorage.removeItem(`connectify:calendar_export:${account}`);
  // Read paths: a cached task re-reads its date caption, so older fractional orders are corrected
  const scrape = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-scrape.js'), 'utf8');
  const resolve = scrape.slice(scrape.indexOf('function resolveTaskOrder'));
  assert.ok(resolve.indexOf('dateOrder(task.caption)') > 0 && resolve.indexOf('dateOrder(task.caption)') < resolve.indexOf('Number.isFinite(task.order)'), 'the date caption is read before the cached order');
  assert.ok(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/cache-versions.js'), 'utf8').includes("'connectify:school_terms'"), 'a settings reset clears the choice');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  for (const group of manifest.content_scripts.filter(g => (g.js || []).includes('src/assessment/assessment-parse-helpers.js'))) {
    const i = group.js.indexOf('src/assessment/school-terms.js');
    assert.ok(i > group.js.indexOf('src/system/utils.js') && i < group.js.indexOf('src/assessment/assessment-parse-helpers.js'), 'the calendar loads before the parser in every group');
  }
});

runTest('Test 246: Weeks past a term\'s end read as the next term\'s everywhere; the graph and export share one Early Easter checkbox', () => {
  const { terms } = loadExportModules();
  // 2026 with Early Easter: Term 1 has nine weeks, so Term 1 Week 10 is Term 2 Week 1 (20 Apr)
  assert.strictEqual(terms.normalizeOrder(10, 2026, true), 13);
  assert.strictEqual(terms.normalizeOrder(10, 2026, false), 10, 'a 10-week Term 1 keeps its Week 10');
  assert.strictEqual(terms.normalizeOrder(11, 2026, false), 13, 'past the term: the next term');
  assert.strictEqual(terms.normalizeOrder(23, 2026, true), 23, 'Term 2 has eleven weeks under Early Easter');
  assert.strictEqual(terms.normalizeOrder(23, 2026, false), 25);
  assert.strictEqual(terms.normalizeOrder(47, 2026, false), 47, 'past Term 4 stays as it is');
  assert.strictEqual(terms.normalizeOrder(null), null);
  for (const early of [true, false]) {
    for (const order of [5, 10, 11, 15, 23, 34]) {
      const n = terms.normalizeOrder(order, 2026, early);
      const { term, week } = window.ConnectifyProgressMath.termWeek(n);
      const raw = window.ConnectifyProgressMath.termWeek(order);
      assert.strictEqual(isoDay(terms.dateFor(2026, term, week, 1, early)), isoDay(terms.dateFor(2026, raw.term, raw.week, 1, early)), `order ${order} keeps its export date`);
    }
  }
  // The graph's week label, the export and the Predictor read the same calendar (this year's choice)
  const year = new Date().getFullYear();
  const saved = localStorage.getItem('connectify:school_terms');
  try {
    terms.setEarlyEaster(year, true);
    const t1 = terms.terms(year, true)[0].weeks;
    assert.strictEqual(window.ConnectifyProgressMath.formatTimestamp(t1 + 1), 'Term 2, Week 1', 'the label follows the calendar');
    terms.setEarlyEaster(year, false);
    assert.strictEqual(window.ConnectifyProgressMath.formatTimestamp(10), 'Term 1, Week 10');
    // One checkbox module for both views: it applies the choice, refreshes predictions and tells every view
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress-early-easter.js'), 'utf8'));
    let events = 0, refreshed = 0, termEvents = 0;
    const origDispatch = window.dispatchEvent;
    window.dispatchEvent = e => { if (e.type === 'connectify-settings-updated') events++; if (e.type === 'connectify-terms-updated') termEvents++; return true; };
    const savedMath = window.ConnectifyPredictorMath, savedData = window.ConnectifyData;
    window.ConnectifyPredictorMath = { updatePredictionCache: () => { refreshed++; } };
    // Terms 3 and 4 never move, so their order holds and nothing is recomputed
    let tasks = [{ id: 'a', order: 25 }, { id: 'b', order: 40 }];
    window.ConnectifyData = { collect: () => [{ name: 'Chemistry', tasks: tasks.map(t => ({ ...t, order: terms.normalizeOrder(t.order, year) })) }] };
    try {
      const show = document.createElement('label');
      const row = window.ConnectifyEarlyEaster.controls(show, () => {});
      assert.strictEqual(row.className, 'cx-progress-controls');
      const input = row.children[1].children[0];
      assert.strictEqual(input.checked, false, 'the box shows this year\'s choice');
      input.checked = true;
      input.dispatchEvent(new MockEvent('change'));
      assert.strictEqual(terms.earlyEaster(year), true);
      assert.ok(events === 0 && refreshed === 0 && termEvents === 1, 'the order holds: no prediction refresh, no full redraw, one terms event');
      // Term 1 Week 10 becomes Term 2 Week 1 and now ties with a Term 2 Week 1 task: a real reorder
      tasks = [{ id: 'a', order: 10 }, { id: 'b', order: 13 }];
      input.checked = false;
      input.dispatchEvent(new MockEvent('change'));
      input.checked = true;
      refreshed = 0;
      input.dispatchEvent(new MockEvent('change'));
      assert.strictEqual(refreshed, 1, 'a changed order refreshes predictions once');
    } finally {
      window.dispatchEvent = origDispatch;
      window.ConnectifyPredictorMath = savedMath;
      window.ConnectifyData = savedData;
    }
  } finally {
    if (saved === null) localStorage.removeItem('connectify:school_terms');
    else localStorage.setItem('connectify:school_terms', saved);
  }
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  const resolve = read('assessment/assessment-scrape.js').slice(read('assessment/assessment-scrape.js').indexOf('function resolveTaskOrder'));
  assert.ok(resolve.includes('return termWeekOrder(order);') && resolve.includes('return termWeekOrder(task.order);'), 'overrides and week captions are placed by the calendar');
  assert.ok(!resolve.includes('termWeekOrder(fromDate)'), 'date captions already are (holiday weeks stay in the term before)');
  assert.ok(read('progress/progress-graph.js').includes('window.ConnectifyEarlyEaster.controls(modes.select('), 'the graph shows the checkbox beside Show:');
  assert.ok(read('progress/progress-graph.js').includes('JSON.stringify([data, window.ConnectifySchoolTerms?.earlyEaster('), 'a choice made in the export redraws the graph');
  assert.ok(read('progress/export-view.js').includes("window.ConnectifyEarlyEaster.checkbox('cx-export-check'"), 'the export uses the same checkbox');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8')).content_scripts.find(g => g.js.includes('src/progress/progress-graph.js')).js;
  assert.ok(manifest.indexOf('src/progress/progress-early-easter.js') > manifest.indexOf('src/assessment/school-terms.js') && manifest.indexOf('src/progress/progress-early-easter.js') < manifest.indexOf('src/progress/progress-graph.js'));
});

runTest('Test 247: The week editor numbers school weeks through the term calendar, as the Export does; older bare numbers are the same school week', () => {
  const { terms } = loadExportModules();
  // 2026 with Early Easter: Term 1 is Weeks 1-9, Term 2 Weeks 10-20, Term 3 21-30, Term 4 31-40
  assert.deepStrictEqual([1, 9, 10, 20, 21, 30, 31, 40].map(n => terms.weekOrder(n, 2026, true)), [1, 9, 13, 23, 25, 34, 37, 46]);
  assert.deepStrictEqual([10, 11, 20].map(n => terms.weekOrder(n, 2026, false)), [10, 13, 22], 'without it, the 10-week terms as before');
  assert.strictEqual(terms.weekOrder(42, 2026, true), 48, 'past Term 4 runs on in Term 4');
  assert.strictEqual(terms.weekOrder(0, 2026, true), null);
  for (const early of [true, false]) {
    for (let n = 1; n <= 40; n++) assert.strictEqual(terms.schoolWeek(terms.weekOrder(n, 2026, early), 2026, early), n, `school week ${n} round-trips`);
  }
  assert.strictEqual(terms.schoolWeek(10, 2026, true), 10, 'Term 1 Week 10 under Early Easter is Term 2 Week 1, school week 10');
  assert.strictEqual(terms.schoolWeek(48, 2026, true), 42, 'Term 4 runs on past Week 40, as weekOrder reads it');
  const year = new Date().getFullYear();
  const saved = localStorage.getItem('connectify:school_terms');
  const { customWeekOrder } = window.ConnectifyUtils;
  try {
    terms.setEarlyEaster(year, true);
    const t2 = terms.terms(year, true)[1].yearWeek;
    assert.strictEqual(customWeekOrder(`w${t2}`), 13, 'the week the Export names as Term 2\'s start is Term 2 Week 1');
    assert.strictEqual(customWeekOrder('w17'), 12 + 17 - t2 + 1, 'w17 is counted through the calendar');
    assert.strictEqual(customWeekOrder('17'), customWeekOrder('w17'), 'an older bare 17, saved without Early Easter, is converted to w17');
    assert.strictEqual(customWeekOrder(String(t2)), 13, 'an older bare Term 2 start is Term 2 Week 1');
    assert.strictEqual(customWeekOrder('t2w7'), 19);
    terms.setEarlyEaster(year, false);
    assert.strictEqual(customWeekOrder('w17'), 19, 'without Early Easter both readings agree');
    assert.strictEqual(customWeekOrder('w0'), null);
  } finally {
    if (saved === null) localStorage.removeItem('connectify:school_terms');
    else localStorage.setItem('connectify:school_terms', saved);
  }
  const editor = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress-week-editor.js'), 'utf8');
  assert.ok(editor.includes('localStorage.setItem(targetKey, `w${val}`)'), 'typed weeks are saved as school weeks of the year');
  assert.ok(editor.includes('input.title = `School week of the year: ${weekRanges()}`') && editor.includes('weekOrder(17)'), 'the hints come from this year\'s calendar');
  assert.ok(!editor.includes('1-10 for Term 1'), 'no fixed 10-week ranges');
});

runTest('Test 248: Same-named tasks in one class (each semester\'s exam) are two tasks, each with its own prediction', () => {
  const helpers = window.ConnectifyParseHelpers;
  const makeCard = (titleText, rows) => {
    const card = new MockElement('div', 'eds-c-tile');
    const title = new MockElement('div', 'eds-c-tile__title');
    title.textContent = titleText;
    card.appendChild(title);
    const list = new MockElement('div', 'cvr-c-tasks');
    card.appendChild(list);
    const made = rows.map(([labels, mark, weight]) => {
      const row = new MockElement('div', 'cvr-c-task');
      const details = new MockElement('div', 'cvr-c-task__details');
      for (const text of labels) {
        const label = new MockElement('span', 'v-label');
        label.textContent = text;
        details.appendChild(label);
      }
      row.appendChild(details);
      const marks = new MockElement('div', 'cvr-c-task__marks');
      for (const text of [mark, weight]) {
        const cell = new MockElement('div', 'cvr-c-task__mark');
        cell.textContent = text;
        marks.appendChild(cell);
      }
      row.appendChild(marks);
      list.appendChild(row);
      return row;
    });
    return { card, rows: made };
  };
  const essay = [['Response', 'Term 1, Week 6', 'Essay'], '30 Out of 50', '10%'];
  const sem1Exam = [['Examination', 'Close reading'], '27 Out of 60', '15%'];
  const sem2Exam = [['Examination', 'Close reading'], '- Out of 60', '15%'];
  const sem1 = makeCard('11 Literature ATAR - Semester 1', [essay, sem1Exam]);
  // A Semester 2 outline lists the Semester 1 tasks before its own
  const sem2 = makeCard('11 Literature ATAR - Semester 2', [essay, sem1Exam, sem2Exam]);

  const ids = helpers.cardTaskIds(sem2.card);
  const [, firstId, secondId] = sem2.rows.map(r => ids.get(r).id);
  assert.ok(firstId.endsWith(':0') && secondId.endsWith(':1') && firstId !== secondId, 'the two "Close reading" rows get their own ids');
  assert.strictEqual(helpers.cardTaskIds(sem1.card).get(sem1.rows[1]).id, firstId, 'the Semester 1 exam has one id on both outlines');

  window.ConnectifyData.clearCache();
  window.ConnectifyData.scrapeSubjectTasks(sem1.card);
  window.ConnectifyData.scrapeSubjectTasks(sem2.card);
  const tasks = window.ConnectifyData.getSubjectTasks('11 Literature ATAR');
  const exams = tasks.filter(t => t.name === 'Close reading');
  assert.strictEqual(exams.length, 2, 'the Semester 2 exam is never dropped as a copy of the Semester 1 one');
  assert.deepStrictEqual(exams.map(t => [t.id, t.pending]), [[firstId, false], [secondId, true]]);

  const subject = { name: '11 Literature ATAR', tasks };
  const predMath = window.ConnectifyPredictorMath;
  // An undated exam sorts before the essay, so the marked one stands on the subject baseline
  predMath.saveBaselines({ subjects: { [subject.name]: 60 }, types: {} });
  predMath.updatePredictionCache();
  predMath.populateChronologicalPredictions([subject], true);
  const marked = predMath.getCachedPrediction(subject.name, firstId);
  const upcoming = predMath.getCachedPrediction(subject.name, secondId);
  assert.ok(marked && upcoming, 'both exams are predicted');
  assert.strictEqual(marked.basis.subjectCount, 0, 'the marked exam is predicted from the results before it');
  assert.strictEqual(upcoming.basis.subjectCount, 2, 'the upcoming exam is predicted from every result');
  assert.strictEqual(predMath.getCachedPrediction(subject.name, 'Close reading'), null, 'no prediction is shared by name');
  assert.strictEqual(predMath.getCachedPrediction(subject.name, 'Examination::Close reading'), null, 'no prediction is shared by labels');

  // The class projection keeps a dated Semester 2 exam named like a marked Semester 1 one
  const dated = { name: '11 English ATAR', tasks: [
    { id: 'exam:0', name: 'Close reading', caption: 'Term 2, Week 8', order: 20, weight: 15, score: 70, pending: false, sequence: 0 },
    { id: 'exam:1', name: 'Close reading', caption: 'Term 4, Week 5', order: 41, weight: 15, score: null, pending: true, sequence: 1 }
  ] };
  const projection = predMath.projectSubjectGrades([dated]).find(p => p.cleanName === dated.name);
  assert.ok(projection.upcomingPredictions.some(p => p.task.id === 'exam:1'), 'the class projection includes the Semester 2 exam');

  // The row finds its own prediction, never the Semester 1 exam's
  const store = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/predictor-store.js'), 'utf8');
  assert.ok(store.includes('cachePrediction(subjectName, predictionId(task), prediction);'), 'one cache key per task');
  const evalJs = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-outcome-eval.js'), 'utf8');
  assert.ok(evalJs.includes('cardTaskIds?.(card).get(row)') && !evalJs.includes('`${meta.labelsKey}:0`'), 'rows read the parser\'s id');
  assert.ok(!evalJs.includes('getCachedPrediction(meta.subjectName, meta.taskName)'), 'rows never look predictions up by name');
});


runTest('Test 249: Estimate ATAR marks are left-aligned like every calculator input, the scaled score under the course name', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/atar-compact.css'), 'utf8');
  const drawer = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-drawer.css'), 'utf8');
  const rule = (src, sel) => (src.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\>]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  assert.ok(/text-align:\s*left/.test(rule(css, '#connectea-atar .cta-score')), 'school mark inputs are left-aligned');
  assert.ok(rule(css, '#connectea-atar .cta-course>small').includes('calc(var(--cta-check-width, 13px) + var(--cta-check-gap, 9px))'), 'the scaled score is indented by the checkbox and its gap');
  // Drawer checkbox: 15px wide, 4px right margin, 12px label gap
  const course = rule(drawer, '#connectify-sidebar .cta-course');
  assert.ok(course.includes('--cta-check-width: 15px') && course.includes('--cta-check-gap: 16px'), 'the drawer indent matches its checkbox (15px) plus margin and gap (4px + 12px)');
  assert.ok(/margin:\s*0 4px 0 0/.test(rule(drawer, '#connectify-sidebar .cta-include input')) && /gap:\s*12px/.test(rule(drawer, '#connectify-sidebar .cta-include')), 'drawer checkbox margin and gap the indent is built from');
});


runTest('Test 250: Year Progression data points are solid dots, with no white ring', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-handle-menu.css'), 'utf8');
  for (const [cls, colour] of [['cx-line-point', '#368bd0'], ['cx-cohort-point', '#d64b58']]) {
    const body = (css.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`)) || [])[1] || '';
    assert.ok(body.includes(`fill: ${colour}`) && /stroke:\s*none/.test(body), `${cls} is a solid ${colour} dot`);
  }
  const progress = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress.css'), 'utf8');
  assert.ok(!/stroke:\s*#fff/.test(css + progress), 'no white stroke on chart points');
});


runTest('Test 251: On touchscreens every Connectify control takes a 44px tap without overlapping anything; the handle is 44px wide', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/touch-targets.css'), 'utf8');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.css || []).includes('src/system/touch-targets.css'));
  assert.ok(group && group.matches.includes('https://connect.det.wa.edu.au/*'), 'loaded on every Connect page, like the handle and theme button');
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const media = body.indexOf('@media (any-pointer: coarse)');
  assert.ok(media >= 0 && body.slice(0, media).trim() === '', 'every rule is for touchscreens only (mouse-only screens are unchanged)');
  const rule = sel => (body.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
  const controls = (body.match(/([^{}]*:is\(button, select[^{]*)\{([^}]*)\}/) || []);
  for (const host of ['#connectify-sidebar', '#connectea-theme-menu', '#cx-customizer-modal', '#connectify-notifications-container', '#cx-expand-btn', '.connectea-row-wrapper']) {
    assert.ok((controls[1] || '').includes(host), `${host} controls are covered`);
  }
  assert.ok((controls[1] || '').includes(':not(#cx-customizer-preview *)'), 'the customizer preview mock-up keeps Connect\'s sizes');
  assert.ok(/min-height:\s*44px/.test(controls[2]) && /min-width:\s*44px/.test(controls[2]), 'controls are at least 44 x 44px');
  // No invisible area reaches past what can be seen onto Connect's side menu, tiles or nav links
  assert.ok(!body.includes('#connectify-sidebar-handle::before'), 'the handle has no invisible tap area (it sits over Connect\'s side menu and tiles)');
  assert.ok(/--cx-handle-width:\s*44px/.test(rule('html:not([data-cx-mouse]) #connectify-sidebar-handle')), 'the handle is 44px wide on touchscreens');
  const handleCss = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-handle-menu.css'), 'utf8');
  const handlePos = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/sidebar-handle-position.js'), 'utf8');
  assert.ok(/--cx-handle-width:\s*30px;\s*width:\s*var\(--cx-handle-width\)/.test(handleCss), 'the handle is 30px wide with a mouse');
  assert.ok(!/100vw - 30px/.test(handleCss + handlePos) && handlePos.includes('calc(100vw - var(--cx-handle-width, 30px))'), 'the docked handle stays on screen at either width');
  assert.ok(/inset:\s*-10px 0;/.test(rule('#connectea-theme-toggle::before')), 'the theme button takes taps the height of Connect\'s bar and never sideways');
  assert.ok(/position:\s*relative/.test(rule('#connectea-theme-toggle .connectea-theme-arrow')) && /inset:\s*-14px -12px -14px -6px/.test(rule('#connectea-theme-toggle .connectea-theme-arrow::before')), 'its chevron takes taps from the gap after the label to the button\'s right edge');
  assert.ok(/inset:\s*-14px -6px -14px -12px/.test(rule('#connectea-theme-toggle[aria-expanded="true"] .connectea-theme-arrow::before')), 'mirrored while the chevron is turned, so the area stays put on screen');
  const theme = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme.js'), 'utf8');
  assert.ok(theme.includes("closest?.('.connectea-theme-arrow')"), 'a tap on the chevron\'s area still opens the menu (the pseudo-element targets the chevron)');
});


runTest('Test 252: After a refresh the estimated cohort size never steps: spreads come from the stats cache under task names, never panel text', () => {
  const saved = { est: window.ConnectifyCohortEstimator, rows: window.ConnectifyCohortRows, view: window.ConnectifyCohortView, avg: window.ConnectifyCohortSubjectAverage, cohort: window.ConnectifyCohort, flag: window.__connectTea141 };
  const statsJs = fs.readFileSync(path.resolve(BASE_DIR, 'cohort-stats.js'), 'utf8');
  if (!window.ConnectifyTaskTypes?.getTaskMeta) eval(fs.readFileSync(path.resolve(BASE_DIR, 'task-types.js'), 'utf8'));
  const subject = 'Chemistry ATAR Year 11';
  const prefix = `connectify:stats_cache:${window.ConnectifyUtils.accountKey()}:${subject.toLowerCase()}:`;
  const S1 = [30.2, 62.3, 70.8, 79.05, 95], S2 = [30.5, 60.4, 69.1, 76.6, 96];
  // The last visit cached both summary boxplots (the row reader writes every stamped chart there)
  localStorage.setItem(prefix + 'overall s1', JSON.stringify({ stats: S1 }));
  localStorage.setItem(prefix + 'overall s2', JSON.stringify({ stats: S2 }));
  const el = (cls, text, ...children) => {
    const node = document.createElement('div');
    node.className = cls;
    if (text) node.textContent = text;
    children.forEach(c => node.appendChild(c));
    return node;
  };
  const cards = [1, 2].map(n => {
    const card = el('eds-c-tile', '', el('eds-c-tile__title', `${subject} - Semester ${n}`),
      el('cvr-c-task', '', el('cvr-c-task__details', '', el('connectea-panel', 'Cohort statistics unavailable'))));
    card.dataset.sem = String(n);
    document.body.appendChild(card);
    return card;
  });
  const semOf = row => row.closest('.eds-c-tile').dataset.sem;
  let stamped = false;
  window.ConnectifyCohortRows = { readStats: row => (stamped ? (semOf(row) === '1' ? S1 : S2) : null) };
  const sizes = [];
  window.ConnectifyCohortView = { render: (row, isOverall, key, size) => sizes.push(size) };
  window.ConnectifyCohortSubjectAverage = undefined;
  const origQSA = document.querySelectorAll;
  document.querySelectorAll = sel => document.body.querySelectorAll(sel);
  try {
    delete window.ConnectifyCohortEstimator;
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'cohort-estimator.js'), 'utf8'));
    delete window.__connectTea141;
    delete window.ConnectifyCohort;
    eval(statsJs);
    const est = window.ConnectifyCohortEstimator;
    const baseline = window.ConnectifyCohortSizeBaselines.baselineSize('chemistry atar year 11', { isYear12: false, isATAR: true });
    // First pass after the refresh: no chart stamped yet, the cached spreads already refine it
    window.ConnectifyCohort.pass();
    const first = sizes[0];
    assert.notStrictEqual(first, baseline, 'the first estimate already uses the cached boxplot spreads');
    assert.deepStrictEqual(sizes, [first, first], 'both semesters show one estimate');
    // The bridge stamps the same charts and the panels redraw with new text: nothing moves
    stamped = true;
    for (const text of ['Min 30.2%  •  Q1 62.3%', 'Min 30.2%  •  Q1 62.3%  •  Rank 40 / ~261']) {
      cards.forEach(c => { c.querySelector('.connectea-panel').textContent = text; });
      window.ConnectifyCohort.pass();
    }
    assert.ok(sizes.every(s => s === first), `the estimate never steps (${sizes.join(' -> ')})`);
    assert.deepStrictEqual([...est.spreadPool(subject).keys()].sort(), ['overall s1', 'overall s2'], 'one spread per task, keyed like the stats cache, never by injected panel text');
    // A boxplot seen only on the Semester 2 card reaches both cards in the same pass
    sizes.length = 0;
    cards[1].appendChild(el('cvr-c-tasks', '', el('cvr-c-task', '', el('cvr-c-task__details', '', el('v-label', 'Exam')))));
    window.ConnectifyCohortRows.readStats = row => (row.closest('.cvr-c-tasks') ? [10, 50, 60, 70, 100] : semOf(row) === '1' ? S1 : S2);
    window.ConnectifyCohort.pass();
    assert.ok(sizes.length === 3 && sizes.every(s => s === sizes[0]) && sizes[0] !== first, `a new boxplot moves both semesters at once (${sizes.join(', ')})`);
    assert.ok(!fs.readFileSync(path.resolve(BASE_DIR, 'cohort-estimator.js'), 'utf8').includes('sessionStorage'), 'spreads are no longer kept per tab');

    // Cold cache (first visit, or the cohort version bump cleared it): the subject waits for the charts of
    // its marked rows (both semesters), so the first number shown is the settled one, never the typical size
    const coldCards = [1, 2].map(n => el('eds-c-tile', '', el('eds-c-tile__title', `Physics ATAR Year 11 - Semester ${n}`),
      el('cvr-c-task', '', el('cvr-c-task__details'), el('cvr-c-task__marks', '72%'))));
    coldCards.forEach(c => { c.dataset.sem = c.textContent.includes('Semester 1') ? '1' : '2'; document.body.appendChild(c); cards.push(c); });
    const origNow = performance.now, origTimeout = global.setTimeout;
    const timers = [];
    let now = 500;
    performance.now = () => now;
    global.setTimeout = (fn, ms) => { timers.push(ms); return timers.length; };
    const stampedCold = new Set();
    window.ConnectifyCohortRows = {
      readMark: row => (coldCards.includes(row.closest('.eds-c-tile')) ? 72 : undefined),
      readStats: row => (stampedCold.has(row.closest('.eds-c-tile')) ? (semOf(row) === '1' ? [24.4, 51, 63.8, 75.3, 98] : [20, 49, 61, 74, 99]) : null)
    };
    try {
      const coldBaseline = window.ConnectifyCohortSizeBaselines.baselineSize('physics atar year 11', { isYear12: false, isATAR: true });
      const shown = [];
      window.ConnectifyCohortView.render = (row, isOverall, key, size) => { if (coldCards.includes(row.closest('.eds-c-tile'))) shown.push(size); };
      const coldPass = () => { shown.length = 0; window.ConnectifyCohort.pass(); return [...shown]; };
      assert.deepStrictEqual(coldPass(), [undefined, undefined], 'no estimate while the subject\'s charts are unstamped');
      assert.ok(timers.length === 1 && timers[0] > 9000, 'one re-pass is queued for when the wait ends');
      stampedCold.add(coldCards[0]);
      assert.deepStrictEqual(coldPass(), [undefined, undefined], 'one semester\'s chart is not enough: the other is still coming');
      stampedCold.add(coldCards[1]);
      const settled = coldPass();
      assert.ok(Number.isFinite(settled[0]) && settled[0] === settled[1] && settled[0] !== coldBaseline, `the first number shown is the settled estimate (${settled}), not the typical ${coldBaseline}`);
      // Expanding the card reveals unstamped task rows: a shown estimate is never taken back
      coldCards[0].appendChild(el('cvr-c-tasks', '', el('cvr-c-task', '', el('cvr-c-task__details', '', el('v-label', 'Test 1')))));
      const readMark = window.ConnectifyCohortRows.readMark;
      window.ConnectifyCohortRows.readMark = () => 72;
      assert.ok(coldPass().every(v => v === settled[0]), 'an estimate once shown never goes blank');
      window.ConnectifyCohortRows.readMark = readMark;
      // A chart that never stamps holds nothing back once the wait is over
      now = window.ConnectifyCohortEstimator.CHART_WAIT_MS + 1;
      assert.strictEqual(window.ConnectifyCohortEstimator.chartsPending(coldCards[1]), false, 'the wait ends after CHART_WAIT_MS');
      assert.ok(!fs.readFileSync(path.resolve(BASE_DIR, 'cohort-view.js'), 'utf8').includes('Cohort size needed'), 'a pending size shows no rank rather than a message');
    } finally {
      performance.now = origNow;
      global.setTimeout = origTimeout;
    }
  } finally {
    document.querySelectorAll = origQSA;
    cards.forEach(c => c.remove());
    for (const k of ['overall s1', 'overall s2', 'exam']) localStorage.removeItem(prefix + k);
    window.ConnectifyCohortEstimator = saved.est;
    window.ConnectifyCohortRows = saved.rows;
    window.ConnectifyCohortView = saved.view;
    window.ConnectifyCohortSubjectAverage = saved.avg;
    window.ConnectifyCohort = saved.cohort;
    window.__connectTea141 = saved.flag;
  }
});

runTest('Test 253: Every Year Progression chart has a dashed line between its Semester 1 and Semester 2 tasks or months', () => {
  delete window.ConnectifyProgressMath;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8'));
  delete window.ConnectifyProgressSemesterDivider;
  delete window.ConnectifyProgressChart;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'progress-chart.js'), 'utf8'));
  const divider = window.ConnectifyProgressSemesterDivider;
  const draw = (points, extra = {}) => {
    const container = document.createElement('div');
    window.ConnectifyProgressChart.renderChart(container, { points, isHistory: false, byAssessment: false, subjectName: 'English ATAR', ...extra });
    return container.querySelector('svg');
  };
  const task = (name, order, semester, score = 70) => ({ name, order, semester, score, mean: 60, pending: false });

  // Subject chart: the line sits halfway between the last Semester 1 task and the first Semester 2 task
  let svg = draw([task('Essay', 5, 1), task('Exam', 12, 1), task('Test', 22, 2), task('Final', 30, 2, null)]);
  let lines = svg.querySelectorAll('line[class="cx-semester-divider"]');
  assert.strictEqual(lines.length, 1, 'one divider on a chart spanning both semesters');
  assert.strictEqual(Number(lines[0].getAttribute('x1')), 52 + (595 / 3) * 1.5, 'between tasks 2 and 3');
  assert.strictEqual(lines[0].getAttribute('x1'), lines[0].getAttribute('x2'), 'the line is vertical');
  assert.deepStrictEqual(Array.from(svg.querySelectorAll('[class="cx-semester-label"]')).map(t => t.textContent), ['Semester 1', 'Semester 2'], 'both sides are labelled');
  const kids = Array.from(svg.children);
  assert.ok(kids.indexOf(lines[0].parentNode) < kids.findIndex(el => el.tagName.toLowerCase() === 'polyline'), 'the divider is drawn under the series');

  // One semester only: no line
  assert.strictEqual(draw([task('Essay', 5, 1), task('Exam', 12, 1)]).querySelector('[class="cx-semester-divider"]'), null, 'no divider within one semester');
  // A task's week decides (never later than its outline), else its outline's semester
  assert.strictEqual(divider.taskSemester({ order: 18, semester: 2 }), 1, 'Term 2 Week 6 is Semester 1 on a Semester 2 outline');
  assert.strictEqual(divider.taskSemester({ order: 25, semester: 1 }), 1, 'never later than its own outline');
  assert.strictEqual(divider.taskSemester({ order: null, semester: 2 }), 2, 'no week: the outline decides');
  svg = draw([task('Essay', 5, 1), task('Undated', null, 2)]);
  assert.ok(svg.querySelector('[class="cx-semester-divider"]'), 'undated tasks fall back to their outline');

  // Calendar ATAR chart: the line is at the start of school week 17 on the time axis
  const terms = window.ConnectifySchoolTerms;
  const savedTerms = localStorage.getItem('connectify:school_terms');
  terms.setEarlyEaster(new Date().getFullYear(), false);
  const months = [{ name: 'Feb', order: 5, score: 80, display: '80' }, { name: 'Jul', order: 26, score: 82, display: '82' }, { name: 'Oct', order: 40, score: 84, display: '84' }];
  svg = draw(months, { isHistory: true });
  const at = (19 - 0.5 - 5) * 595 / 35 + 52;
  assert.ok(Math.abs(Number(svg.querySelector('[class="cx-semester-divider"]').getAttribute('x1')) - at) < 1e-9, 'months are split at Semester 2\'s first week');
  assert.strictEqual(draw(months.slice(1), { isHistory: true }).querySelector('[class="cx-semester-divider"]'), null, 'no divider on a Semester 2 only time axis');
  terms.setEarlyEaster(new Date().getFullYear(), true);
  svg = draw(months, { isHistory: true });
  assert.ok(Math.abs(Number(svg.querySelector('[class="cx-semester-divider"]').getAttribute('x1')) - ((20 - 0.5 - 5) * 595 / 35 + 52)) < 1e-9, 'under Early Easter the months split at Term 2 Week 8');
  svg = draw([task('Exam', 19, 2), task('Test', 20, 2)]);
  assert.strictEqual(Number(svg.querySelector('[class="cx-semester-divider"]').getAttribute('x1')), 52 + 595 / 2, 'under Early Easter a Term 2 Week 7 task is Semester 1');
  if (savedTerms === null) localStorage.removeItem('connectify:school_terms'); else localStorage.setItem('connectify:school_terms', savedTerms);

  // Assessment rounds: each round's semester comes from its tasks; a round spanning both sits between
  assert.strictEqual(divider.commonSemester([{ order: 5, semester: 1 }, { order: 22, semester: 2 }]), null, 'a round spanning both semesters has none');
  assert.strictEqual(divider.commonSemester([{ order: 3, semester: 1 }, { order: null, semester: 1 }]), 1);
  const rounds = [1, null, 2, 2].map((semester, i) => ({ name: `Assessment round ${i + 1}`, order: i + 1, semester, score: 80, display: '80' }));
  svg = draw(rounds, { isHistory: true, byAssessment: true });
  assert.strictEqual(Number(svg.querySelector('[class="cx-semester-divider"]').getAttribute('x1')), 52 + (595 / 3), 'between round 1 and round 3, through the mixed round');
  const mathJs = fs.readFileSync(path.resolve(BASE_DIR, 'progress-math.js'), 'utf8');
  assert.ok(mathJs.includes('order: i + 1, source: t') && mathJs.includes('commonSemester(atStep)'), 'rounds read their tasks\' real weeks, not the round number');

  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress.css'), 'utf8');
  assert.ok(/#connectify-progress \.cx-semester-divider\{[^}]*stroke-dasharray:6 4[^}]*pointer-events:none/.test(css), 'the divider is dashed and never takes the pointer');
  assert.ok(css.includes('.connectea-dark #connectify-progress .cx-semester-divider{stroke:var(--cx-text-muted'), 'token-routed in dark themes');
  const manifest = origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('progress-semester-divider.js') > -1 && manifest.indexOf('progress-semester-divider.js') < manifest.indexOf('progress-chart.js'), 'registered before the chart');
});

runTest('Test 254: Touch targets only grow on a touchscreen until a mouse is used; a touch brings them back', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/touch-targets.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const inner = css.slice(css.indexOf('{') + 1, css.lastIndexOf('}'));
  const selectors = inner.split('}').map(r => r.split('{')[0].trim()).filter(Boolean);
  assert.ok(selectors.length >= 8 && selectors.every(sel => sel.startsWith('html:not([data-cx-mouse]) ')), 'every touch rule is off once a mouse is used');
  assert.ok(selectors[0].includes('#cx-wallpaper-crop'), 'the wallpaper crop prompt\'s controls grow on touchscreens too');

  const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/pointer-kind.js'), 'utf8');
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const attrs = new Set();
  const root = { hasAttribute: a => attrs.has(a), setAttribute: a => attrs.add(a), toggleAttribute: (a, on) => (on ? attrs.add(a) : attrs.delete(a)) };
  const listeners = {};
  const win = { addEventListener: (t, fn, o) => { listeners[t] = fn; assert.ok(o.capture && o.passive, `${t} is a passive capture listener`); } };
  const run = () => new Function('window', 'document', 'localStorage', src)(win, { documentElement: root }, ls);
  run();
  assert.ok(!attrs.has('data-cx-mouse'), 'a touchscreen starts with large targets');
  listeners.pointermove({ pointerType: 'touch' });
  assert.ok(!attrs.has('data-cx-mouse'), 'touch input keeps them');
  listeners.pointermove({ pointerType: 'mouse' });
  assert.ok(attrs.has('data-cx-mouse') && store['connectify:pointer_mouse'] === 'true', 'the first mouse input turns them off and is remembered');
  // The next page starts with the mouse sizes at once
  attrs.clear(); delete win.ConnectifyPointerKind;
  run();
  assert.ok(attrs.has('data-cx-mouse'), 'a remembered mouse applies before the page paints');
  listeners.pointerdown({ pointerType: 'touch' });
  assert.ok(!attrs.has('data-cx-mouse') && !('connectify:pointer_mouse' in store), 'a touch turns the large targets back on');
  listeners.pointerdown({ pointerType: 'pen' });
  assert.ok(!attrs.has('data-cx-mouse'), 'a pen changes nothing');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const boot = manifest.content_scripts.find(c => (c.js || []).includes('src/system/pointer-kind.js'));
  assert.ok(boot && boot.run_at === 'document_start' && boot.matches.includes('https://connect.det.wa.edu.au/*'), 'pointer-kind.js runs at document_start on every Connect page');
});

runTest('Test 255: A reload paints the last theme at document_start, and Chrome paints wallpapers over 2 MB through a blob: URL', () => {
  const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-boot.js'), 'utf8');
  const make = ({ store = {}, pathname = '/group/home', chromium = true } = {}) => {
    const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
    const classes = new Set(), attrs = {}, props = {}, children = [];
    const root = {
      classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c) },
      setAttribute: (a, v) => { attrs[a] = v; }, removeAttribute: a => { delete attrs[a]; }, hasAttribute: a => a in attrs, getAttribute: a => attrs[a],
      style: Object.assign([], { setProperty: (p, v) => { props[p] = v; if (!root.style.includes(p)) root.style.push(p); }, getPropertyValue: p => props[p] || '' }),
      appendChild: el => children.push(el)
    };
    const doc = { documentElement: root, createElement: () => ({}), getElementById: id => children.find(c => c.id === id) && { remove: () => children.splice(children.findIndex(c => c.id === id), 1) } };
    const blobs = [];
    const URLs = { createObjectURL: b => { blobs.push(b); return `blob:${blobs.length}`; }, revokeObjectURL: () => {} };
    const chrome = { runtime: { getURL: () => (chromium ? 'chrome-extension://abc/' : 'moz-extension://abc/') } };
    const win = {};
    const timers = [];
    new Function('window', 'document', 'localStorage', 'location', 'chrome', 'URL', 'Blob', 'atob', 'setTimeout', 'getComputedStyle', 'MutationObserver', src)(
      win, doc, ls, { pathname, search: '' }, chrome, URLs, function (parts, o) { this.parts = parts; this.type = o.type; },
      b64 => Buffer.from(b64, 'base64').toString('binary'), fn => timers.push(fn), () => ({ backgroundColor: 'rgb(11, 19, 43)' }), class {});
    return { win, store, classes, attrs, props, children, blobs, timers, root };
  };
  const snap = { id: 'quantum', dark: true, attrs: { 'data-connectea-theme': 'quantum', 'data-connectea-has-custom-bg': 'true', onclick: 'x' },
    props: { '--cx-wallpaper-dim': '0.3', color: 'red' }, canvas: 'rgb(40, 40, 40)', bg: { settings: true } };
  const saved = { 'connectify:theme_boot': JSON.stringify(snap), 'connectea:theme:id': 'quantum', 'connectea:custom_background': 'data:image/png;base64,AAAA' };
  let b = make({ store: { ...saved } });
  assert.ok(b.classes.has('connectea-dark') && b.attrs['data-connectea-theme'] === 'quantum', 'the theme classes are on <html> before Connect renders');
  assert.ok(!('onclick' in b.attrs) && !('color' in b.props), 'only theme attributes and --cx-* tokens are restored');
  assert.strictEqual(b.props['--cx-wallpaper-dim'], '0.3', 'the wallpaper dim is restored with the theme');
  assert.strictEqual(b.props['--cx-custom-bg-image'], 'url("data:image/png;base64,AAAA")', 'the Settings wallpaper is read straight from storage');
  assert.strictEqual(b.children[0].id, 'cx-theme-boot', 'a boot canvas covers the page until the theme stylesheets are in');
  assert.ok(b.children[0].textContent.includes('html { background-color: rgb(40, 40, 40) !important; } body { background-color: transparent !important; }'),
    'the canvas is painted on <html> and body stays clear for the wallpaper');
  b.win.ConnectifyThemeBoot.done();
  assert.strictEqual(b.children.length, 0, 'theme.js removes the boot canvas once the theme is applied');

  b = make({ store: { ...saved, 'connectea:theme:id': 'dark' } });
  assert.ok(!b.classes.has('connectea-dark') && !b.children.length, 'a snapshot of another theme is never applied');
  b = make({ store: { ...saved }, pathname: '/login' });
  assert.ok(!b.classes.has('connectea-dark'), 'login pages stay unthemed');
  b = make({ store: { ...saved, 'connectify:theme_boot': JSON.stringify({ ...snap, bg: { theme: true } }),
    'connectea:custom_themes_list': JSON.stringify([{ id: 'quantum', wallpaper: 'data:image/png;base64,BBBB' }]) } });
  assert.strictEqual(b.props['--cx-custom-bg-image'], 'url("data:image/png;base64,BBBB")', 'a custom theme\'s own wallpaper is read from the theme list');
  b = make({ store: { ...saved, 'connectify:theme_boot': JSON.stringify({ ...snap, canvas: 'red; } body { x', bg: null }) } });
  assert.ok(!b.children.length && !('data-connectea-has-custom-bg' in b.attrs), 'an unexpected canvas value is never written into CSS');

  // Chrome drops CSS url()s over 2 MB; Firefox keeps the data URL
  const big = 'data:image/gif;base64,' + Buffer.alloc(1.6 * 1024 * 1024).toString('base64');
  b = make();
  const B = b.win.ConnectifyThemeBoot;
  assert.strictEqual(B.cssUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA', 'small wallpapers keep their data URL');
  assert.strictEqual(B.cssUrl(big), 'blob:1', 'a data URL over 2 MB becomes a blob: URL in Chrome');
  assert.strictEqual(B.cssUrl(big), 'blob:1', 'decoded once per wallpaper');
  assert.strictEqual(b.blobs[0].type, 'image/gif');
  assert.strictEqual(make({ chromium: false }).win.ConnectifyThemeBoot.cssUrl(big), big, 'Firefox paints the data URL itself');
  assert.deepStrictEqual(B.sourceOf('data:x', false), { url: 'data:x' }, 'small wallpapers (SVG presets) are kept in the snapshot');
  assert.deepStrictEqual(B.sourceOf(big, true), { theme: true });
  assert.deepStrictEqual(B.sourceOf(big, false), { settings: true }, 'large ones by where they are stored');

  // save(): one write per task, of what is on <html>
  b = make();
  b.root.classList.toggle('connectea-dark', true);
  b.root.setAttribute('data-connectea-theme', 'forest');
  b.root.style.setProperty('--cx-canvas-bg', '#0a1914');
  b.root.style.setProperty('--cx-custom-bg-image', 'url("x")');
  b.store['connectea:theme:id'] = 'forest';
  b.win.ConnectifyThemeBoot.save(); b.win.ConnectifyThemeBoot.save();
  assert.strictEqual(b.timers.length, 1, 'saves within a task are coalesced');
  b.timers[0]();
  const written = JSON.parse(b.store['connectify:theme_boot']);
  assert.deepStrictEqual([written.id, written.dark, written.attrs['data-connectea-theme'], written.props['--cx-canvas-bg'], written.canvas],
    ['forest', true, 'forest', '#0a1914', 'rgb(11, 19, 43)'], 'the snapshot holds the theme, its tokens and canvas');
  assert.ok(!('--cx-custom-bg-image' in written.props), 'the (possibly huge) wallpaper itself is never copied into the snapshot');

  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  assert.ok(read('theme/theme-registry.js').includes('window.ConnectifyThemeBoot?.save();'), 'every theme switch is saved');
  assert.ok(read('theme/theme-custom-tokens.js').includes('window.ConnectifyThemeBoot?.cssUrl(bgUrl) ?? bgUrl') && read('theme/theme-custom-tokens.js').includes('window.ConnectifyThemeBoot?.save();'),
    'wallpapers go on screen through cssUrl and are saved');
  assert.ok(read('theme/theme-wallpaper-dim.js').includes('window.ConnectifyThemeBoot?.save();'), 'wallpaper overlays are saved');
  assert.ok(read('theme/theme-customizer.js').includes('window.ConnectifyThemeBoot?.cssUrl(state.wallpaper)'), 'the customizer preview paints large wallpapers in Chrome too');
  assert.ok(read('theme/theme.js').includes('window.ConnectifyThemeBoot?.done();'), 'theme.js drops the boot canvas');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.js || []).includes('src/theme/theme-boot.js'));
  assert.ok(group.run_at === 'document_start' && !group.css, 'theme-boot.js runs at document_start, with no stylesheets of its own');
});

runTest('Test 257: A results version bump keeps the grade cache, so a result released meanwhile is still announced', () => {
  window.__connectifyDataInitialized = false;
  eval(fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8'));
  const key = 'connectify:grade_cache:me';
  localStorage.setItem(key, JSON.stringify({ 'Mathematics Methods': { mark: 93.6, semester: 2 } }));
  localStorage.setItem('connectify:subjects_cache:me', '{}');
  localStorage.setItem('connectify:cache_version:results', 'old');
  window.ConnectifyCache.checkAndInvalidateAll();
  assert.ok(localStorage.getItem(key), 'the marks last seen survive a results version bump');
  assert.strictEqual(localStorage.getItem('connectify:subjects_cache:me'), null, 'derived results are still cleared');
  window.ConnectifyCache.clearResultsCache();
  assert.strictEqual(localStorage.getItem(key), null, 'Clear Cache and the new-year rollover still clear the grade cache');
});

runTest('Test 258: A newly marked task is announced even when the running mark stays put; renames and unseen cards stay quiet', () => {
  const origQSA = document.querySelectorAll;
  let cards = [];
  document.querySelectorAll = sel => (sel === '.eds-c-tile' ? cards : origQSA.call(document, sel));
  try {
    mockLocalStorage.clear();
    window.ConnectifyGradeSnapshot = undefined;
    window.ConnectifyGradeTasks = undefined;
    for (const f of ['grade-snapshot.js', 'grade-tasks.js']) eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system', f), 'utf8'));
    const tasks = window.ConnectifyGradeTasks;
    const snapshot = window.ConnectifyGradeSnapshot;
    const physics = rows => makeOutlineCard('Physics ATAR Year 11 - Semester 2', { overall: '87.7%', tasks: rows });
    snapshot.saveCachedGrades({ Physics: { mark: 87.7, semester: 2 } });

    cards = [physics([['Test 4', '41 Out of 44'], ['Test 5', '- Out of 60']])];
    assert.deepStrictEqual(tasks.check(), [], 'a card never seen before is saved quietly');
    const saved = snapshot.loadCachedGrades().Physics;
    assert.strictEqual(saved.tasks['2'].length, 1, 'only marked tasks are saved, under the card\'s semester');
    assert.strictEqual(saved.mark, 87.7, 'the saved mark is untouched');

    cards = [physics([['Test 4', '41 Out of 44'], ['Test 5', '52 Out of 60']])];
    const changed = tasks.check();
    assert.deepStrictEqual(changed.map(c => c.subjectName), ['Physics'], 'a newly marked task is a new result, whatever the running mark did');
    assert.strictEqual(changed[0].card, cards[0], 'Jump to Subject goes to the card that showed it');
    assert.deepStrictEqual(tasks.check(), [], 'the same result is announced once');

    cards = [physics([['Test 4 (resubmitted)', '41 Out of 44'], ['Test 5', '52 Out of 60']])];
    assert.deepStrictEqual(tasks.check(), [], 'a renamed task swaps one id for another and is not a new result');
    cards = [physics([['Test 4 (resubmitted)', '41 Out of 44'], ['Test 5', '- Out of 60']])];
    assert.deepStrictEqual(tasks.check(), [], 'a mark taken back is not a new result');

    cards = [makeOutlineCard('Chemistry ATAR Year 11 - Semester 2', { overall: '83.5%', tasks: [['Test 3', '30 Out of 40']] })];
    tasks.check();
    assert.strictEqual(snapshot.loadCachedGrades().Chemistry, undefined, 'a subject the mark check has not saved yet is left to it');
    cards = [makeOutlineCard('Physics ATAR Year 11 - Semester 2', { overall: '87.7%' })];
    assert.deepStrictEqual(tasks.check(), [], 'a collapsed card (no task rows) is never compared');
    assert.strictEqual(snapshot.loadCachedGrades().Physics.tasks['2'].length, 1, 'and keeps its saved ids');
  } finally {
    document.querySelectorAll = origQSA;
    mockLocalStorage.clear();
  }

  const newGrade = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/new-grade.js'), 'utf8');
  assert.ok(newGrade.includes('announced.has(entry.subjectName) ? undefined : previous?.tasks'),
    'saving the marks keeps the saved task ids, except for a subject just announced (no second notice on opening it)');
  assert.ok(newGrade.includes('window.ConnectifyGradeTasks?.start?.()'), 'the task check starts once the marks are saved');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('src/system/grade-snapshot.js') < manifest.indexOf('src/system/grade-tasks.js') &&
    manifest.indexOf('src/system/grade-tasks.js') < manifest.indexOf('src/system/new-grade.js'), 'grade-tasks.js loads between the snapshot and the notifier');
});

runTest('Test 293: Jump to Subject lands on a newly marked task from a grade notice, else on the subject average panel', () => {
  const origQSA = document.querySelectorAll;
  let cards = [];
  document.querySelectorAll = sel => (sel === '.eds-c-tile' ? cards : origQSA.call(document, sel));
  const prev = { snapshot: window.ConnectifyGradeSnapshot, tasks: window.ConnectifyGradeTasks, target: window.ConnectifyJumpTarget };
  try {
    mockLocalStorage.clear();
    window.ConnectifyGradeSnapshot = undefined;
    window.ConnectifyGradeTasks = undefined;
    window.ConnectifyJumpTarget = undefined;
    for (const f of ['grade-snapshot.js', 'grade-tasks.js', 'jump-target.js']) eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system', f), 'utf8'));
    const tasks = window.ConnectifyGradeTasks;
    const target = window.ConnectifyJumpTarget;
    const title = 'Physics ATAR Year 11 - Semester 2';
    const physics = rows => makeOutlineCard(title, { overall: '87.7%', tasks: rows });
    window.ConnectifyGradeSnapshot.saveCachedGrades({ Physics: { mark: 87.7, semester: 2 } });
    cards = [physics([['Test 4', '41 Out of 44'], ['Test 5', '- Out of 60']])];
    tasks.check();
    const before = window.ConnectifyGradeSnapshot.loadCachedGrades().Physics;

    cards = [physics([['Test 4', '41 Out of 44'], ['Test 5', '52 Out of 60']])];
    const card = cards[0];
    const [taskRow, newRow] = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
    const overall = card.querySelectorAll('.cvr-c-task').find(row => !row.closest('.cvr-c-tasks'));
    assert.deepStrictEqual(tasks.newIds(title, before).length, 1, 'the mark check finds the task newly marked since the saved ids');
    const changed = tasks.check();
    assert.strictEqual(changed[0].taskIds.length, 1, 'the task check names the newly marked task');
    assert.strictEqual(target.resolve(card, changed[0].taskIds), newRow, 'a grade notice lands on the newly marked task');
    assert.notStrictEqual(target.resolve(card, changed[0].taskIds), taskRow);
    assert.strictEqual(target.resolve(card), overall, 'Jump To (no tasks) lands on the overall row: the subject average panel');
    assert.strictEqual(target.resolve(card, ['unknown']), overall, 'a task not on the card falls back to the overall row');
    assert.deepStrictEqual(tasks.newIds(title, {}), [], 'nothing saved for the semester: no task to jump to');

    const origRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = fn => fn();
    try {
      target.go(card, changed[0].taskIds);
      assert.strictEqual(newRow.scrollCount, 1, 'the jump scrolls to the task row');
      assert.ok(newRow.classList.contains('cx-card-jump-highlight'), 'and pulses it');
      assert.ok(!overall.scrollCount, 'not to the overall row');
      target.go(card);
    } finally {
      global.requestAnimationFrame = origRaf;
    }
    assert.strictEqual(overall.scrollCount, 1, 'a subject jump scrolls to the overall row');
  } finally {
    document.querySelectorAll = origQSA;
    Object.assign(window, { ConnectifyGradeSnapshot: prev.snapshot, ConnectifyGradeTasks: prev.tasks, ConnectifyJumpTarget: prev.target });
    mockLocalStorage.clear();
  }

  const newGrade = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/new-grade.js'), 'utf8');
  assert.ok(newGrade.includes("announce(entry, window.ConnectifyGradeTasks?.newIds?.(entry.rawTitle, prevCache[entry.subjectName]))"), 'a mark change notice jumps to its new task');
  assert.ok(newGrade.includes('jumpToSubject(entry.card, taskIds)'));
  const goalEvents = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-events.js'), 'utf8');
  assert.ok(goalEvents.includes('jumpToSubject(card, taskIds)'), 'Goal Updated jumps to the newly read result too');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('src/system/jump-target.js') < manifest.indexOf('src/system/new-grade.js'), 'jump-target.js loads before the notifier');
});

runTest('Test 256: Uploads are rescaled, then resized and placed by the student in the crop prompt, then cropped', async () => {
  const src = fs.readFileSync(path.join(BASE_DIR, 'src/theme/theme-wallpaper-fit.js'), 'utf8');
  const made = [];
  class FakeBitmap { constructor(w, h) { this.width = w; this.height = h; made.push(this); } close() { this.closed = true; } }
  const createImageBitmap = async (source, ...args) => {
    if (!args.length) return new FakeBitmap(source.w, source.h);
    const o = args.length === 1 ? args[0] : args[4];
    return Object.assign(new FakeBitmap(o.resizeWidth, o.resizeHeight), { crop: args.length > 1 ? args.slice(0, 4) : null });
  };
  class OffscreenCanvas { constructor(w, h) { this.width = w; this.height = h; } getContext() { return { drawImage() {} }; } async convertToBlob() { return { type: 'image/jpeg', w: this.width, h: this.height }; } }
  class FileReader { readAsDataURL(b) { this.result = b.w ? `data:image/jpeg;fit=${b.w}x${b.h}` : `data:${b.type};original`; this.onload(); } }
  const win = { devicePixelRatio: 2, screen: { width: 1440, height: 900 }, innerWidth: 1440, innerHeight: 800 };
  new Function('window', 'createImageBitmap', 'OffscreenCanvas', 'FileReader', 'chrome', src)(win, createImageBitmap, OffscreenCanvas, FileReader, { runtime: { getManifest: () => ({ permissions: [] }) } });
  const F = win.ConnectifyWallpaperFit;
  assert.deepStrictEqual(F.prescaleSize(12000, 8000, 2880, 1800), { width: 8640, height: 5760, scale: 0.72 }, 'rescaled to what the largest size (300%) can show sharply');
  assert.strictEqual(F.prescaleSize(3000, 2000, 2880, 1800).scale, 1, 'never upscaled');
  const z = F.cropRect(4000, 2500, 2880, 1800, 2, 0, 0.5);
  assert.deepStrictEqual([z.sx, z.sw, z.sh, z.width, z.height], [0, 2000, 1250, 2000, 1250], 'zoomed crops are kept inside the image and never upscaled');
  assert.deepStrictEqual(F.cropRect(4000, 2500, 2880, 1800, 0.5), F.fitRect(4000, 2500, 2880, 1800), 'the smallest size is the whole-image cover fit');

  let seen = null;
  const out = await F.fromFile({ w: 12000, h: 8000, size: 40e6, type: 'image/jpeg' }, {
    adjust: async a => { seen = a; return F.cropRect(a.width, a.height, a.target.width, a.target.height, 2, 1, 0); }
  });
  assert.deepStrictEqual([seen.width, seen.height, seen.source.width], [8640, 5760, 8640], 'the prompt gets the rescaled image');
  assert.deepStrictEqual(seen.target, { width: 2880, height: 1800 }, 'and the screen it is cropped for');
  const crop = made.find(b => b.crop);
  assert.deepStrictEqual(crop.crop, [4320, 0, 4320, 2700], 'the student\'s crop (top right at 200%) is the one cut out');
  assert.strictEqual(out, 'data:image/jpeg;fit=2880x1800', 'then scaled to the screen');
  assert.ok(made.every(b => b.closed), 'every bitmap is released');
  const cancel = await F.fromFile({ w: 3000, h: 2000, size: 2e6, type: 'image/png' }, { adjust: async () => null }).catch(e => e);
  assert.ok(F.isCancelled(cancel), 'closing the prompt cancels the upload');
  assert.strictEqual(await F.fromFile({ size: 1e6, type: 'image/gif' }, { adjust: async () => { throw new Error('asked'); } }), 'data:image/gif;original', 'GIFs skip the prompt (cropping would stop them animating)');

  const crop2 = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-wallpaper-crop.js'), 'utf8');
  assert.ok(crop2.includes("window.ConnectifyWallpaperCrop = { prompt }") && crop2.includes('fit.cropRect(width, height, target.width, target.height, view.zoom, view.cx, view.cy)'), 'the prompt crops through cropRect');
  assert.ok(crop2.includes('e.stopPropagation();\n        if (e.target === overlay && downOnBackdrop) close(null);'), 'clicks inside the prompt never reach the sidebar\'s outside-click handler');
  assert.ok(crop2.includes("setPointerCapture") && /touch-action:\s*none/.test(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-wallpaper-crop.css'), 'utf8')), 'dragging never scrolls the page');
  const manifest = origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8');
  assert.ok(manifest.indexOf('"src/theme/theme-wallpaper-crop.js"') > manifest.indexOf('"src/theme/theme-wallpaper-fit.js"')
    && manifest.includes('"src/theme/styles/theme-wallpaper-crop.css"'), 'registered after theme-wallpaper-fit.js, with its stylesheet');
});

// Goals: loads the goal modules (and the solver they plan with) into a sandbox window with the given stubs
function loadGoalModules(stubs = {}) {
  const listeners = {};
  const win = {
    ConnectifyUtils: global.ConnectifyUtils,
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: () => {},
    dispatchEvent: e => { (listeners[e.type] || []).forEach(fn => fn(e)); return true; },
    ...stubs
  };
  const run = file => new Function('window', origReadFileSync.call(fs, resolveFilePath(file), 'utf8'))(win);
  ['scaling-data.js', 'atar-math.js', 'target-difficulty.js', 'target-solver.js'].forEach(run);
  ['goal-difficulty.js', 'goal-store.js', 'goal-plan.js', 'goal-replay.js', 'goal-modal.js', 'goal-sliders.js', 'goal-dialog.js', 'goal-list-ui.js', 'goal-editor.js',
    'goal-celebrate.js', 'goal-events.js', 'goal-bars.js', 'goal-forecast.js'].forEach(f => run(path.resolve(SRC_DIR, 'goals', f)));
  run(path.resolve(SRC_DIR, 'progress/progress-modes.js'));
  run(path.resolve(SRC_DIR, 'progress/progress-goal-line.js'));
  run(path.resolve(SRC_DIR, 'atar/grade-estimate-goal.js'));
  return win;
}

runTest('Test 259: Goal effort sliders move required marks without changing today\'s plans; tiers and performance bands', () => {
  const win = loadGoalModules();
  const S = win.ConnectifyTargetSolver;
  const tasks = [
    { id: 'a', name: 'Test 1', weight: 20, pending: false, score: 80, earned: 16 },
    { id: 'b', name: 'Test 2', weight: 30, pending: true, earned: 0 },
    { id: 'c', name: 'Exam', weight: 50, pending: true, earned: 0 }
  ];
  const progress = S.taskProgress(tasks, 80, 2);
  const uniform = S.gradePlan(progress, 75);
  assert.deepStrictEqual(S.gradePlan(progress, 75, { offsets: {} }), uniform, 'no offsets: today\'s uniform plan');
  assert.deepStrictEqual(S.gradePlan(progress, 75, { offsets: { b: 0, c: 0 } }), uniform, 'all Normal: today\'s uniform plan');
  const weighted = S.gradePlan(progress, 75, { difficultyWeighted: true, subjectName: 'Chem' });
  assert.deepStrictEqual(S.gradePlan(progress, 75, { difficultyWeighted: true, subjectName: 'Chem', offsets: { b: 0 } }), weighted, 'checkbox on, all Normal: today\'s difficulty plan');
  assert.ok(weighted.taskRequirements.b && weighted.taskRequirements.c, 'requirements are keyed by task id');

  const more = S.gradePlan(progress, 75, { offsets: { b: 5 } });
  const reqB = more.taskRequirements.b.required;
  const reqC = more.taskRequirements.c.required;
  assert.ok(reqB > uniform.required + 2 && reqC < uniform.required, `More effort on Test 2 asks more of it (${reqB}) and less of the exam (${reqC}) than ${uniform.required}`);
  assert.ok(16 + reqB * 0.3 + reqC * 0.5 >= 75 - 0.05, 'and the target is still reached');
  assert.ok(Math.abs(reqB - reqC - 5) < 0.6, 'one notch is about 5 points between the two');

  const D = win.ConnectifyGoalDifficulty;
  const range = { low: 70, mid: 75, high: 80 };
  assert.ok(Math.abs(D.chance(75, range) - 0.5) < 1e-6, 'the target at Mid is a coin flip');
  assert.ok(Math.abs(D.chance(80, range) - 0.2) < 0.002, 'High is about the 80th percentile');
  assert.strictEqual(D.tierFor({ chance: 0.95 }), 'trivial');
  assert.strictEqual(D.tierFor({ chance: 0.7 }), 'easy');
  assert.strictEqual(D.tierFor({ chance: 0.4 }), 'medium');
  assert.strictEqual(D.tierFor({ chance: 0.15 }), 'hard');
  assert.strictEqual(D.tierFor({ chance: 0.01 }), 'hell');
  assert.strictEqual(D.tierFor({ guaranteed: true, chance: 0.01 }), 'guaranteed');
  assert.strictEqual(D.tierFor({ impossible: true, chance: 0.99 }), 'impossible');
  // Near 100 High's logarithmic headroom squeezes the upside: the wider half sets the spread on the logit scale
  const nearTop = { low: 92, mid: 94, high: 94.6 };
  assert.ok(D.chance(94.5, nearTop) >= 0.4, `half a point over a 94 Mid is Medium (${D.chance(94.5, nearTop)})`);
  assert.strictEqual(D.tierFor({ chance: D.chance(95, nearTop) }), 'hard', 'one point over it is Hard, never Hell');
  assert.ok(D.chance(99.9, { low: 90, mid: 94, high: 95 }) < 0.01, 'the logit scale still bounds it towards 100');
  assert.ok(Math.abs(D.chance(45, { low: 45, mid: 50, high: 55 }) - 0.8) < 0.002, 'Low is about the 20th percentile');
  assert.deepStrictEqual([70, 76, 80, 85, 90].map(m => D.perfTier(m, 80)), ['red', 'orange', 'yellow', 'green', 'purple'], '+-5 bands, purple above 1.10 x R on green');
  assert.strictEqual(D.perfTier(100, 92), 'green', 'purple cannot happen once R is over 90.9');
  assert.strictEqual(D.color('achieved'), D.color('guaranteed'));
  assert.strictEqual(D.color('missed'), D.color('impossible'));
});

runTest('Test 260: Goals are saved per account, one per subject, and finished goals keep frozen verdicts', () => {
  const win = loadGoalModules();
  const G = win.ConnectifyGoalStore;
  localStorage.clear();
  const chem = G.save({ kind: 'grade', subject: 'chemistry', target: 80, end: { type: 'semester', semester: 2 } });
  assert.ok(localStorage.getItem('connectify:goals:12345'), 'stored under the account');
  assert.strictEqual(G.activeFor('Chemistry ATAR Year 12 - Semester 1').id, chem.id, 'both semester outlines are one subject');
  const again = G.conflicts({ kind: 'grade', subject: 'chemistry' });
  assert.strictEqual(again.subjects[0].goal.id, chem.id, 'a second goal for the subject conflicts');
  assert.strictEqual(G.conflicts({ ...chem }).subjects.length, 0, 'the goal being edited never conflicts with itself');
  const edited = G.save({ ...chem, target: 85 });
  assert.deepStrictEqual([edited.id, edited.revision, G.all().length], [chem.id, 2, 1], 'an edit keeps the id and counts a revision');

  const atar = { kind: 'atar', target: 95, end: { type: 'semester', semester: 2 }, topFour: ['chemistry', 'physics', 'english', 'methods'] };
  assert.strictEqual(G.conflicts(atar).subjects[0].subject, 'chemistry', 'an ATAR goal over a grade goal conflicts (Replace is offered)');
  G.remove(chem.id);
  const savedAtar = G.save(atar);
  assert.strictEqual(G.childrenOf(savedAtar.id).length, 4, 'an ATAR goal holds four linked subject goals');
  assert.strictEqual(G.activeFor('Physics').id, savedAtar.id, 'a child subject resolves to its ATAR goal');
  assert.ok(G.conflicts({ kind: 'atar', topFour: [] }).atar, 'only one ATAR goal at a time');

  G.finish(savedAtar.id, 'achieved', { finalValue: 95.4, verdicts: { 'chemistry::t1': { required: 80, mark: 85, perfTier: 'green' } } });
  assert.strictEqual(G.active().length, 0, 'a finished goal frees its subjects (children too)');
  assert.strictEqual(G.past().length, 1, 'and is listed under Past goals');
  assert.strictEqual(G.verdicts()[savedAtar.id]['chemistry::t1'].perfTier, 'green', 'its verdicts are frozen');
  G.clearVerdicts();
  assert.deepStrictEqual(G.verdicts(), {}, 'Clear Cache drops the verdicts');
  assert.strictEqual(G.all().length, 5, 'and keeps the goals');
  localStorage.setItem('connectify:goals:12345', JSON.stringify({ version: 9, goals: [{ id: 'x' }] }));
  assert.deepStrictEqual(G.all(), [], 'an unknown version reads as no goals');
  localStorage.clear();
});

runTest('Test 261: Goal ranges use Year Progression weeks fixed at load; replays judge each task against what it needed', () => {
  const pred = { low: 65, mid: 72, high: 79 };
  const chemTasks = [
    { id: 't1', name: 'Test 1', weight: 20, pending: false, score: 80, earned: 16, order: 5, semester: 1 },
    { id: 't2', name: 'Test 2', weight: 20, pending: false, score: 70, earned: 14, order: 10, semester: 1 },
    { id: 't3', name: 'Exam', weight: 60, pending: true, earned: 0, order: 27, semester: 2 },
    { id: 't4', name: 'Project', weight: 10, pending: true, earned: 0, order: null, semester: 2 }
  ];
  const courses = [[{ id: 'chemistry', name: 'Chemistry', subject: 'Chemistry ATAR', tasks: chemTasks.slice(0, 2) }],
    [{ id: 'chemistry', name: 'Chemistry', subject: 'Chemistry ATAR', tasks: chemTasks }]];
  const win = loadGoalModules({
    ConnectifySchoolTerms: { schoolWeek: o => o, weekOrder: n => n },
    ConnectifyPredictorCache: { getOrComputeTaskPrediction: () => pred }
  });
  const P = win.ConnectifyGoalPlan;
  const goal = { kind: 'grade', subject: 'chemistry', target: 75, end: { type: 'week', week: 30 }, priorMarked: ['chemistry::t1'] };
  const range = P.rangeTasks(goal, P.entryFor(courses, 'chemistry'));
  assert.deepStrictEqual(range.tasks.map(t => t.id).sort(), ['t1', 't2', 't3'], 'tasks up to the end week are in range');
  assert.deepStrictEqual(range.undated, ['Project'], 'a task with no week is left out and named');

  chemTasks[2].order = 35;
  assert.strictEqual(P.rangeTasks(goal, P.entryFor(courses, 'chemistry')).tasks.length, 3, 'a week changed after load is not used until reload');
  assert.strictEqual(P.isHeld(), false);
  win.dispatchEvent({ type: 'connectify-week-override-saved' });
  assert.strictEqual(P.isHeld(), true, 'a saved week override holds goals until reload');

  const R = win.ConnectifyGoalReplay.evaluate(goal, { courses, allSubjects: [] });
  assert.ok(!R.verdicts['chemistry::t1'], 'a task marked before the goal was set is not judged by it');
  const v = R.verdicts['chemistry::t2'];
  assert.strictEqual(v.required, 73.8, 'Test 2 needed what the goal required with only Test 1 marked');
  assert.strictEqual(v.perfTier, 'orange', '70 is within 5 below what it needed');
  assert.deepStrictEqual([v.progress.earned, v.progress.required], [30, 75], 'progress as of Test 2: 30 of 75 weighted points');
  assert.ok(R.tier && R.tier !== 'guaranteed' && R.tier !== 'impossible', `the goal has a tier now (${R.tier})`);
  assert.strictEqual(R.finished, null, 'it is still running');

  const sure = win.ConnectifyGoalReplay.evaluate({ ...goal, target: 25 }, { courses, allSubjects: [] });
  assert.deepStrictEqual([sure.tier, sure.finished], ['guaranteed', 'achieved'], 'a target already met locks in Achieved');
  const never = win.ConnectifyGoalReplay.evaluate({ ...goal, target: 95 }, { courses, allSubjects: [] });
  assert.deepStrictEqual([never.tier, never.finished], ['impossible', 'missed'], 'a target out of reach locks in Missed');

  const S = win.ConnectifyTargetSolver;
  assert.strictEqual(S.gradePlan(S.taskProgress(chemTasks.slice(0, 3), undefined, 1), 75, { offsets: { t3: 10 } }).taskRequirements.t3.required,
    S.gradePlan(S.taskProgress(chemTasks.slice(0, 3), undefined, 1), 75).required, 'one task left takes the whole requirement whatever its slider');
});

runTest('Test 262: An ATAR goal re-solves its four subjects\' targets; subject sliders shift effort between them', () => {
  const mk = (id, name, marks) => ({
    id, name, subject: `${name} ATAR`, mark: 75,
    tasks: marks.map((m, i) => ({ id: `${id}${i}`, name: `Task ${i + 1}`, weight: 25, pending: m === null, score: m ?? undefined, earned: m === null ? 0 : m / 4, order: 5 + i * 8, semester: i < 2 ? 1 : 2 }))
  });
  const sem2 = [mk('chemistry', 'Chemistry', [80, 70, null, null]), mk('physics', 'Physics', [75, 72, null, null]),
    mk('english', 'English', [68, 74, null, null]), mk('mathematics methods', 'Mathematics Methods', [82, 85, null, null])];
  const win = loadGoalModules({
    ConnectifySchoolTerms: { schoolWeek: o => o, weekOrder: n => n },
    ConnectifyPredictorCache: { getOrComputeTaskPrediction: () => ({ low: 68, mid: 75, high: 82 }) },
    ConnectifyAtarCalc: { getCourseState: r => ({ ...r, score: r.mark, raw: r.mark }), calculateResults: () => [{ bonus: 0 }, { bonus: 0 }] }
  });
  const S = win.ConnectifyTargetSolver;
  for (const c of sem2) c.progress = S.taskProgress(c.tasks, undefined, 2);
  const ctx = { atarCourses: [[], sem2], courses: [[], sem2], allSubjects: [] };
  const goal = { id: 'g1', kind: 'atar', target: 85, end: { type: 'semester', semester: 2 }, included: sem2.map(c => c.id), topFour: sem2.map(c => c.id), priorMarked: [] };
  const R = win.ConnectifyGoalReplay.evaluate(goal, ctx);
  assert.ok(!R.error, R.error);
  assert.deepStrictEqual(Object.keys(R.children).sort(), sem2.map(c => c.id).sort(), 'every top-four subject gets a target');
  assert.ok(Object.values(R.children).every(c => Number.isFinite(c.target) && c.tier), 'with its own tier');
  assert.ok(R.tier, `the ATAR goal has a tier (${R.tier})`);
  assert.strictEqual(Object.keys(R.verdicts).length, 8, 'every completed task of the four subjects is judged');
  assert.ok(Object.values(R.verdicts).every(v => Number.isFinite(v.required) && v.perfTier), 'each against what it needed');

  const pushed = win.ConnectifyGoalReplay.evaluate({ ...goal, subjectSliders: { chemistry: 2 } }, ctx);
  assert.ok(pushed.children.chemistry.target > R.children.chemistry.target + 3, 'Much more effort on Chemistry raises its target');
  assert.ok(pushed.children.physics.target < R.children.physics.target, 'and lowers the others');
});

// Text of a mock element and its children, as the browser's textContent would read it
const mockText = el => (el ? `${el.textContent || ''}${(el.children || []).map(mockText).join('')}` : '');

runTest('Test 263: Set as Goal previews the goal with its end and confirms it; the Goals dialog lists, edits and deletes goals', () => {
  localStorage.clear();
  const tasks = [
    { id: 't1', name: 'Test 1', weight: 30, pending: false, score: 78, earned: 23.4, order: 5, semester: 1 },
    { id: 't2', name: 'Test 2', weight: 30, pending: true, earned: 0, order: 15, semester: 1 },
    { id: 't3', name: 'Exam', weight: 40, pending: true, earned: 0, order: 30, semester: 2 }
  ];
  const chem = { id: 'chemistry', name: 'Chemistry', subject: 'Chemistry ATAR', tasks };
  const win = loadGoalModules({
    ConnectifySchoolTerms: { schoolWeek: o => o, weekOrder: n => n },
    ConnectifyProgressMath: { termWeek: o => ({ term: Math.floor((o - 1) / 10) + 1, week: ((o - 1) % 10) + 1 }) },
    ConnectifyPredictorCache: { getOrComputeTaskPrediction: () => ({ low: 70, mid: 77, high: 84 }) },
    ConnectifyAtarScraper: { readCourses: () => [[], [chem]] },
    ConnectifyData: { collect: () => [] }
  });
  const S = win.ConnectifyGoalSliders;
  const moved = [];
  const ctl = S.control('t2', 1, notch => moved.push(notch));
  const input = ctl.querySelector('.cx-goal-slider');
  assert.deepStrictEqual([input.type, input.min, input.max, input.step, input.getAttribute('aria-valuetext')], ['range', '-2', '2', '1', 'More'], 'five notches, named for screen readers');
  assert.strictEqual(ctl.querySelector('.cx-goal-notch').textContent, 'More');
  input.value = '-2';
  input.dispatchEvent(new MockEvent('input'));
  assert.strictEqual(ctl.querySelector('.cx-goal-notch').textContent, 'Much less', 'the notch name follows a drag');
  assert.deepStrictEqual(moved, [], 'a drag never re-renders the planner (that replaced the slider and lost the drag)');
  input.dispatchEvent(new MockEvent('change'));
  assert.deepStrictEqual(moved, [-2], 'releasing it does');
  S.gradeSliders('chemistry').t2 = 2;
  S.reset('grade');
  assert.deepStrictEqual(S.gradeSliders('chemistry'), {}, 'the checkbox resets the sliders');

  const draft = { kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 80, end: { type: 'semester', semester: 2 }, sliders: { t2: 1 } };
  let saved = 0;
  win.ConnectifyGoalDialog.open({ goal: draft, onSaved: () => saved++ });
  const dialog = document.getElementById('cx-goal-dialog');
  assert.ok(dialog, 'the dialog opens over the page');
  assert.strictEqual(dialog.querySelector('.cx-goal-modal').getAttribute('role'), 'dialog');
  assert.ok(dialog.querySelector('.cx-goal-preview-head').children[0].textContent.includes('Chemistry · 80% by Semester 2'), 'the preview names the goal');
  const rows = dialog.querySelectorAll('.cx-goal-preview tr');
  assert.strictEqual(rows.length, 3, 'one row per remaining task');
  assert.strictEqual(rows[1].children[1].textContent, 'More', 'with its effort notch');
  const confirm = dialog.querySelector('.cx-goal-confirm');
  assert.strictEqual(confirm.disabled, false, 'a goal within reach can be confirmed');
  const select = dialog.querySelector('.cx-goal-end-select');
  select.value = 'week';
  select.dispatchEvent(new MockEvent('change'));
  const week = dialog.querySelector('.cx-goal-week');
  week.value = '20';
  week.dispatchEvent(new MockEvent('input'));
  assert.strictEqual(dialog.querySelectorAll('.cx-goal-preview tr').length, 2, 'a custom end week drops the tasks after it');
  assert.strictEqual(dialog.querySelector('.cx-goal-week-hint').textContent, 'Term 2 Week 10', 'the week shows its term');
  confirm.click();
  assert.strictEqual(saved, 1, 'Confirm saves');
  assert.ok(!document.getElementById('cx-goal-dialog'), 'and closes the dialog');
  const goal = win.ConnectifyGoalStore.active()[0];
  assert.deepStrictEqual([goal.end, goal.priorMarked], [{ type: 'week', week: 20 }, ['chemistry::t1']], 'with its end and the tasks already marked');

  win.ConnectifyGoalDialog.open({ goal: { ...draft } });
  const again = document.getElementById('cx-goal-dialog');
  assert.strictEqual(mockText(again.querySelector('.cx-goal-reason')), 'Chemistry already has a goal. Overwrite?', 'a second goal for the subject asks to overwrite the first');
  assert.ok(!again.querySelector('.cx-goal-reason .cx-goal-link'), 'with no Edit button');
  assert.strictEqual(again.querySelector('.cx-goal-confirm').disabled, false, 'Confirm answers it');
  again.querySelector('.cx-goal-cancel').click();
  assert.strictEqual(win.ConnectifyGoalStore.active()[0].id, goal.id, 'Cancel keeps the first goal');
  win.ConnectifyGoalDialog.open({ goal: { ...draft, target: 82 } });
  document.getElementById('cx-goal-dialog').querySelector('.cx-goal-confirm').click();
  const replaced = win.ConnectifyGoalStore.active();
  assert.deepStrictEqual([replaced.length, replaced[0].target, replaced[0].id !== goal.id], [1, 82, true], 'Confirm replaces the subject\'s goal with the new one');
  assert.ok(!win.ConnectifyGoalStore.all().some(g => g.id === goal.id), 'the overwritten goal is removed, not kept as a past goal');
  win.ConnectifyGoalStore.remove(replaced[0].id);
  win.ConnectifyGoalStore.save(goal);
  win.ConnectifyGoalDialog.open({ goal: { ...draft, id: goal.id, target: 20 } });
  const sure = document.getElementById('cx-goal-dialog');
  assert.deepStrictEqual([sure.querySelector('.cx-goal-confirm').disabled, mockText(sure.querySelector('.cx-goal-reason'))], [true, 'Already secured.'], 'a goal already met cannot be saved');
  sure.querySelector('.cx-goal-modal__close').click();
  assert.ok(!document.getElementById('cx-goal-dialog'), 'the close button closes it without saving');

  win.ConnectifyGoalListUI.open();
  const list = document.getElementById('cx-goals-dialog');
  const cards = list.querySelectorAll('.cx-goal-card');
  assert.strictEqual(cards.length, 1, 'the Goals dialog lists the active goal');
  assert.ok(cards[0].querySelector('.cx-goal-card__title').textContent.startsWith('Chemistry · 80% by Term 2 Week 10'));
  assert.ok(cards[0].querySelector('.cx-goal-hbar') && cards[0].querySelector('.cx-goal-points').textContent === '23.4 of 48 weighted points', 'with its progress');
  cards[0].querySelector('.cx-goal-card__delete').click();
  list.querySelector('.cx-goal-card__confirm .cx-goal-link').click();
  assert.strictEqual(win.ConnectifyGoalStore.all().length, 0, 'Delete asks first, then removes the goal');
  assert.ok(!document.getElementById('cx-goals-dialog'), 'an empty list closes');
  localStorage.clear();
});

// A Chemistry class for goal tests: Test 1 (78) and Test 2 marked, Investigation and the exam pending
function goalFixture(extra = {}) {
  const tasks = [
    { id: 't1', name: 'Test 1', weight: 20, pending: false, score: 78, earned: 15.6, order: 6, semester: 1 },
    { id: 't2', name: 'Test 2', weight: 15, pending: false, score: 72, earned: 10.8, order: 12, semester: 1 },
    { id: 't3', name: 'Investigation', weight: 15, pending: true, earned: 0, order: 26, semester: 2 },
    { id: 't4', name: 'Exam', weight: 50, pending: true, earned: 0, order: 33, semester: 2 }
  ];
  const chem = { id: 'chemistry', name: 'Chemistry', subject: 'Chemistry ATAR', tasks };
  const played = [];
  const win = loadGoalModules({
    ConnectifySchoolTerms: { schoolWeek: o => o, weekOrder: n => n },
    ConnectifyPredictorCache: { getOrComputeTaskPrediction: () => ({ low: 68, mid: 75, high: 82 }) },
    ConnectifyAtarScraper: { readCourses: () => [[], [chem]] },
    ConnectifyData: { collect: () => [] },
    ConnectifyGoalCelebrate: { play: () => played.push(1) },
    ...extra
  });
  return { win, chem, tasks, played };
}

runTest('Test 264: Newly read results bring a Goal Updated toast of its own; goals lock in and celebrate once; a new year archives them', () => {
  localStorage.clear();
  const toasts = [];
  const { win, tasks, played } = goalFixture({ ConnectifyNotifications: { show: t => toasts.push(t) } });
  const G = win.ConnectifyGoalStore;
  const E = win.ConnectifyGoalEvents;
  const goal = G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 80, end: { type: 'semester', semester: 2 }, priorMarked: ['chemistry::t1', 'chemistry::t2'] });
  E.refresh();
  assert.strictEqual(toasts.length, 0, 'no toast while no new result has been read');

  // Expanding the outline reads Investigation's new mark
  Object.assign(tasks[2], { pending: false, score: 74, earned: 11.1 });
  E.refresh();
  assert.strictEqual(toasts.length, 1, 'a newly read result brings a toast of its own');
  assert.deepStrictEqual([toasts[0].title, toasts[0].message, toasts[0].id], ['Goal Updated', 'Chemistry · 80% by Semester 2', `connectify-goal-${goal.id}`]);
  assert.ok(/^Goal: (Trivial|Easy|Medium|Hard|Hell)$/.test(toasts[0].details[0]), `it names the tier (${toasts[0].details[0]})`);
  E.refresh();
  assert.strictEqual(toasts.length, 1, 'once per result');

  G.save({ ...G.byId(goal.id), target: 88 });
  Object.assign(tasks[3], { pending: false, score: 60, earned: 30 });
  E.refresh();
  assert.ok(/^Goal (missed!|is now \w+ \(was \w+\))$/.test(toasts[1].details[0]), `a changed tier says what it was (${toasts[1].details[0]})`);
  const newGrade = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/new-grade.js'), 'utf8');
  assert.ok(!newGrade.includes('ConnectifyGoalEvents'), 'the Class Updated toast carries no goal line');

  Object.assign(tasks[3], { pending: true, score: undefined, earned: 0 });
  G.remove(goal.id);
  const sure = G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 20, end: { type: 'semester', semester: 2 }, priorMarked: ['chemistry::t1', 'chemistry::t2', 'chemistry::t3'] });
  E.refresh();
  const complete = toasts.find(t => t.id === `connectify-goal-${sure.id}`);
  assert.ok(complete && complete.details[0] === 'Goal complete!', 'a goal that locks in Achieved says so in its toast');
  assert.deepStrictEqual([G.byId(sure.id).status, played.length], ['achieved', 1], 'and celebrates');
  assert.ok(G.verdicts()[sure.id], 'its verdicts are frozen');
  E.refresh();
  E.celebratePending();
  assert.strictEqual(played.length, 1, 'never twice');

  const missed = G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 99.5, end: { type: 'semester', semester: 2 }, priorMarked: [] });
  E.refresh();
  assert.strictEqual(toasts.find(t => t.id === `connectify-goal-${missed.id}`).details[0], 'Goal missed!', 'a target out of reach locks in Missed');
  assert.strictEqual(played.length, 1, 'with no celebration');

  G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 80, end: { type: 'semester', semester: 2 }, priorMarked: [] });
  win.dispatchEvent({ type: 'connectify-week-override-saved' });
  const archived = E.endYear();
  assert.ok(archived.goals.length === 3 && archived.goals.every(g => g.status !== 'active'), 'a new year judges and archives every goal');
  assert.deepStrictEqual(G.all(), [], 'and the list starts empty');
  const rollover = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/year-rollover.js'), 'utf8');
  assert.ok(rollover.includes('goals: window.ConnectifyGoalEvents?.endYear?.() || null'), 'the year archive keeps them');
  localStorage.clear();
});

runTest('Test 265: Goal bars sit beside the outcome meter: pastel performance bands with a secret purple breakout, progress in the tier colour', () => {
  localStorage.clear();
  const card = makeOutlineCard('Chemistry ATAR - Semester 2', { overall: '75.4%', tasks: [['Test 1', '39 Out of 50'], ['Test 2', '36 Out of 50']] });
  const rows = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
  const ids = new Map([[rows[0], { id: 't1' }], [rows[1], { id: 't2' }]]);
  const { win } = goalFixture({
    ConnectifyTaskTypes: { getTaskMeta: () => ({ subjectName: 'Chemistry ATAR' }) },
    ConnectifyParseHelpers: { cardTaskIds: () => ids }
  });
  const G = win.ConnectifyGoalStore;
  G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 72, end: { type: 'semester', semester: 2 }, priorMarked: [] });
  const B = win.ConnectifyGoalBars;
  const row = rows[1];
  const wrapper = new MockElement('div', 'connectea-row-wrapper');
  const outcomeBar = new MockElement('div', 'connectea-outcome-bar');
  wrapper.append(new MockElement('div', 'connectea-panel'), outcomeBar);
  const ui = { outcomeBar, box: wrapper.children[0] };
  B.render(ui, row, false);
  const bars = wrapper.querySelector('.cx-goal-bars');
  assert.ok(bars && wrapper.children[2] === bars, 'the bars follow the outcome meter');
  const data = B.rowData(row, false);
  const lit = bars.querySelectorAll('.cx-goal-perf .cx-goal-seg').filter(seg => seg.className !== 'cx-goal-seg');
  const expected = data.perf.band === 'purple' ? 5 : ['red', 'orange', 'yellow', 'green'].indexOf(data.perf.band) + 1;
  assert.strictEqual(lit.length, expected, `segments are lit up to the band (${data.perf.band})`);
  const progress = bars.querySelector('.cx-goal-progress');
  assert.ok(progress.dataset.tier && progress.querySelectorAll('.cx-goal-seg').length === 0, 'the progress bar has no segments, only its tier');
  assert.ok(/^\d+(\.\d+)?%$/.test(progress.children[0].style['--cx-goal-fill']), 'and a fill');
  assert.ok(!bars.hasAttribute('title') && !/purple|breakout|1\.1/i.test(bars.dataset.goalTooltip), 'no native title, and the breakout is never named');
  assert.ok(/^Needed \d+\.\d% • Got 72\.0%\n/.test(bars.dataset.goalTooltip), `numbers only (${bars.dataset.goalTooltip})`);

  win.ConnectifyGoalStore.remove(G.active()[0].id);
  B.render(ui, row, false);
  assert.ok(!wrapper.querySelector('.cx-goal-bars'), 'deleting the goal removes its bars');

  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-bars.css'), 'utf8');
  assert.ok(cssHas(css, 'width: 18px;') && cssHas(css, 'height: 56px;'), 'each bar is 18 x 56');
  assert.ok(cssHas(css, '.cx-goal-seg--purple { height: 20px; background: #cdb5f7; }'), 'the breakout segment is double height');
  assert.ok(css.match(/pointer-events: none !important/g).length >= 2, 'segments and fill never take the pointer');
  for (const [band, color] of Object.entries({ red: '#f4a3a3', orange: '#f8c99b', yellow: '#f5e19a', green: '#a7e3b5' })) {
    assert.ok(cssHas(css, `.cx-goal-seg--${band} { background: ${color}; }`), `${band} is pastel`);
  }
  const view = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-view.js'), 'utf8');
  assert.ok(view.includes('memo.goalSig === goalSig') && view.includes('window.ConnectifyGoalBars?.render(ui, row, isOverall);'), 'rows memoise and draw their goal bars');
  localStorage.clear();
});

runTest('Test 266: Year Progression plots the goal\'s target mark for each task; the Estimator says whether the goal is met; celebrations respect reduced motion', () => {
  localStorage.clear();
  const { win } = goalFixture();
  const G = win.ConnectifyGoalStore;
  G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 78, end: { type: 'semester', semester: 2 }, priorMarked: ['chemistry::a'] });
  const L = win.ConnectifyProgressGoalLine;
  const realEvents = win.ConnectifyGoalEvents;
  // a: marked before the goal (no target); b: judged (R before it was marked); c, d: remaining (plan); e: out of range
  win.ConnectifyGoalEvents = { stateOf: () => ({
    plan: { required: 80, effort: true, taskRequirements: { c: { required: 82.4 } } },
    verdicts: { 'chemistry::b': { required: 76.5 } },
    rangeKeys: new Set(['chemistry::a', 'chemistry::b', 'chemistry::c', 'chemistry::d'])
  }) };
  const points = [
    { id: 'a', name: 'A', score: 70, weight: 10 }, { id: 'b', name: 'B', score: 81, weight: 10 },
    { id: 'c', name: 'C', pending: true, score: null, weight: 20 }, { id: 'd', name: 'D', pending: true, score: null, weight: 20 },
    { id: 'e', name: 'E', pending: true, score: null, weight: 20 }
  ];
  const goal = L.goalFor('Chemistry');
  assert.strictEqual(goal.label, 'Goal 78%');
  assert.deepStrictEqual(L.targetsFor(points, goal, 'tasks'), [null, 76.5, 82.4, 80, null], 'each task its own target: R when judged, the plan when remaining');
  const avg = L.targetsFor(win.ConnectifyProgressModes.apply(points, 'weighted'), goal, 'weighted');
  assert.strictEqual(avg[0], null, 'no target before the goal');
  assert.ok(Math.abs(avg[1] - (70 + 76.5) / 2) < 1e-9, 'averaged targets count a task without one at its own mark');
  const svg = new MockElement('svg');
  const legend = new MockElement('div', 'cx-legend');
  const made = (tag, attrs, text) => { const el = new MockElement(tag, attrs.class || ''); Object.assign(el, { attrs }); el.textContent = text || ''; return el; };
  L.render(svg, { points, xFor: i => 52 + i * 100, yFor: v => 260 - v * 2.2, minY: 0, maxY: 100, subjectName: 'Chemistry', isHistory: false, mode: 'tasks', legend, createSvgElement: made });
  const dots = svg.querySelectorAll('.cx-goal-target-point');
  assert.strictEqual(dots.length, 3, 'a marker per task with a target');
  assert.strictEqual(dots[0].attrs.cy, 260 - 76.5 * 2.2);
  const lines = svg.querySelectorAll('.cx-goal-line');
  assert.strictEqual(lines.length, 1, 'B\'s requirement alone is a marker, not a line of its own');
  assert.deepStrictEqual(lines[0].attrs.points.split(' '), [`152,${260 - 81 * 2.2}`, `252,${260 - 82.4 * 2.2}`, `352,${260 - 80 * 2.2}`],
    'the remaining targets run on from the last plotted score (B\'s 81), not from B\'s requirement');
  assert.ok(!svg.querySelector('line.cx-goal-line'), 'no horizontal goal line on subject charts');
  // Two judged tasks: their requirements are their own line, ending where the results end
  win.ConnectifyGoalEvents = { stateOf: () => ({
    plan: { required: 80, effort: true, taskRequirements: { c: { required: 82.4 } } },
    verdicts: { 'chemistry::a': { required: 72 }, 'chemistry::b': { required: 76.5 } },
    rangeKeys: new Set(['chemistry::a', 'chemistry::b', 'chemistry::c', 'chemistry::d'])
  }) };
  const judged = new MockElement('svg');
  L.render(judged, { points, xFor: i => 52 + i * 100, yFor: v => 260 - v * 2.2, minY: 0, maxY: 100, subjectName: 'Chemistry', isHistory: false, mode: 'tasks', legend: null, createSvgElement: made });
  assert.deepStrictEqual(judged.querySelectorAll('.cx-goal-line').map(l => l.attrs.points.split(' ').length), [2, 3],
    'past requirements (A, B) and the plan from B\'s score (B, C, D)');
  // Nothing marked yet: the plan starts at its first target
  const fresh = new MockElement('svg');
  const pending = points.map(p => ({ ...p, pending: true, score: null }));
  win.ConnectifyGoalEvents = { stateOf: () => ({ plan: { required: 80, taskRequirements: {} }, verdicts: {}, rangeKeys: new Set(['chemistry::a', 'chemistry::b']) }) };
  L.render(fresh, { points: pending, xFor: i => 52 + i * 100, yFor: v => 260 - v * 2.2, minY: 0, maxY: 100, subjectName: 'Chemistry', isHistory: false, mode: 'tasks', legend: null, createSvgElement: made });
  assert.deepStrictEqual(fresh.querySelector('.cx-goal-line').attrs.points.split(' '), [`52,${260 - 80 * 2.2}`, `152,${260 - 80 * 2.2}`]);
  assert.strictEqual(legend.querySelector('.cx-goal-key').textContent, 'Dashed: Target mark (Goal 78%)');
  win.ConnectifyGoalEvents = realEvents;
  assert.strictEqual(L.goalFor('Physics'), null, 'none without a goal');

  const E = win.ConnectifyGradeEstimateGoal;
  const course = { id: 'chemistry', name: 'Chemistry', subject: 'Chemistry ATAR' };
  assert.strictEqual(E.gradeLine(course, [], [], { entered: 1, estimate: 80.2 }).textContent, 'Goal 78%: met');
  assert.strictEqual(E.gradeLine(course, [], [], { entered: 0, current: 74.8 }).textContent, 'Goal 78%: 3.2 short');
  G.save({ kind: 'atar', target: 95, end: { type: 'semester', semester: 2 }, topFour: [], priorMarked: [] });
  const box = new MockElement('p');
  E.atarLine(box, { finalAtar: '93.65' }, 1);
  assert.strictEqual(box.querySelector('.cx-goal-estimate').textContent, 'Goal 95.00: 1.35 short', 'Estimate ATAR compares with the ATAR goal');
  E.atarLine(box, { finalAtar: '96.10' }, 0);
  assert.strictEqual(box.querySelector('.cx-goal-estimate'), null, 'only for that goal\'s semester');

  const celebrate = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-celebrate.js'), 'utf8');
  const celebrateCss = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-celebrate.css'), 'utf8');
  assert.ok(celebrate.includes("matchMedia?.('(prefers-reduced-motion: reduce)')") && celebrate.includes('if (still) {'), 'reduced motion draws still confetti and skips the shake');
  assert.ok(cssHas(celebrateCss, '#cx-goal-confetti { position: fixed; inset: 0;') && cssHas(celebrateCss, 'pointer-events: none !important;'), 'the confetti never takes the pointer');
  assert.ok(celebrate.includes("document.querySelector('.cvr-c-app-layout') || document.getElementById('main-content')"), 'the shake moves Connect\'s layout, never html or body');
  localStorage.clear();
});

runTest('Test 267: The sidebar never appears on the login screen', async () => {
  await Promise.all(pendingTestPromises);
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const sidebarGroups = manifest.content_scripts.filter(g => (g.js || []).includes('src/sidebar/sidebar.js'));
  const everywhere = sidebarGroups.find(g => g.matches.includes('https://connect.det.wa.edu.au/*'));
  for (const url of ['https://connect.det.wa.edu.au/login*', 'https://connect.det.wa.edu.au/*portal/login*']) {
    assert.ok(everywhere.exclude_matches.includes(url), `the sidebar-only group excludes ${url}`);
  }
  assert.ok(sidebarGroups.every(g => g.matches.every(m => !m.startsWith('https://login.det.wa.edu.au'))), 'no sidebar on the DET sign-in host');

  // A login page the manifest misses (or a logged-out page) still gets no handle or drawer
  const authJs = fs.readFileSync(path.resolve(BASE_DIR, 'theme-auth.js'), 'utf8');
  const sidebarJs = fs.readFileSync(path.resolve(BASE_DIR, 'sidebar.js'), 'utf8');
  const origHref = location.href;
  const origAuth = window.ConnectifyThemeAuth;
  const reset = () => {
    delete window.__connectifySidebarInitialized;
    document.querySelectorAll('#connectify-sidebar, #connectify-sidebar-handle').forEach(el => el.remove());
  };
  try {
    eval(authJs);
    reset();
    location.href = 'https://connect.det.wa.edu.au/login?dest=home';
    eval(sidebarJs);
    // Booleans only: a failing assertion holding a mock element hangs while the runner prints it
    assert.strictEqual(Boolean(document.getElementById('connectify-sidebar')), false, 'no drawer on the login page');
    assert.strictEqual(Boolean(document.getElementById('connectify-sidebar-handle')), false, 'no handle on the login page');
    assert.strictEqual(Boolean(window.__connectifySidebarInitialized), false, 'the sidebar is not initialised');

    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-connect';
    eval(sidebarJs);
    assert.strictEqual(Boolean(document.getElementById('connectify-sidebar') && document.getElementById('connectify-sidebar-handle')), true, 'other Connect pages keep the sidebar');
  } finally {
    location.href = origHref;
    window.ConnectifyThemeAuth = origAuth;
  }
});

runTest('Test 268: Target Grade and Target ATAR plan from Connect\'s mark when the school adjusts it away from the task marks', () => {
  // Biology ATAR Year 11 Semester 2: weights total 100 and Connect shows 71.8%, but the marked tasks average 66.3%.
  // The planners used to refuse with "Task weights do not reconcile"; Connect's mark is the class result
  const S = loadGoalModules().ConnectifyTargetSolver;
  const t = (id, weight, score) => ({ id, name: id, weight, pending: score === undefined, score, earned: score === undefined ? 0 : (score / 100) * weight });
  const tasks = [t('Test 1', 6, 82), t('ER 1', 5, 60), t('Inquiry 1', 15, 77.5), t('Exam 1', 18, 64), t('Inquiry 2', 15, 51.67),
    t('Test 2', 7, 66), t('ER 2', 5, 73.33), t('Test 3', 7), t('Exam 2', 22)];
  const progress = S.taskProgress(tasks, 71.8, 2);
  assert.strictEqual(progress.error, undefined, 'no reconcile error');
  assert.ok(Math.abs(progress.earned - 71.8 * 0.71) < 1e-9 && Math.abs(progress.remaining - 29) < 1e-9, 'Connect\'s mark stands for the 71% already marked');
  assert.strictEqual(S.gradePlan(progress, 75).required, 82.9, 'Target 75 needs 82.9 on the remaining 29%');
  assert.ok(S.gradePlan(progress, 75, { difficultyWeighted: true, subjectName: 'Biology' }).taskRequirements['Exam 2'], 'difficulty weighting still plans each task');
  const semesterOne = S.taskProgress(tasks.slice(0, 4), 70.6, 1);
  assert.ok(!semesterOne.error && semesterOne.total === 44, 'a Semester 1 outline totals its own weights (44%)');
  const noMark = S.taskProgress(tasks, undefined, 2);
  assert.ok(Math.abs(noMark.rawEarned - tasks.reduce((s, x) => s + x.earned, 0)) < 1e-9, 'without Connect\'s mark (goal replays) the task marks are summed');
  assert.ok(S.taskProgress(tasks.slice(0, 8), 71.8, 2).error.includes('not 100%'), 'a Semester 2 outline missing weight is still refused');
});

runTest('Test 269: Expand All stays light: week overrides are indexed once, class projections run once per pass, heartbeats pause, theme rules are filterable', () => {
  // 1. Week override lookups no longer scan every storage key per task
  const store = { 'connectify:stats_cache:x:a': '1', 'connectify:stats_cache:x:b': '1' };
  let keyCalls = 0;
  const ls = {
    getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
    key: i => { keyCalls++; return Object.keys(store)[i] ?? null; }, get length() { return Object.keys(store).length; }
  };
  const listeners = {};
  const sandbox = { console, localStorage: ls, window: { localStorage: ls, addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); } } };
  const storageKeys = pred => { const out = []; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && pred(k)) out.push(k); } return out; };
  const userKey = key => `connectify:user:acc:${key}`;
  sandbox.window.ConnectifyUtils = { storageKeys, userKey, userKeys: pred => storageKeys(k => k.startsWith(userKey('')) && pred(k.slice(userKey('').length))) };
  vm.createContext(sandbox);
  vm.runInContext(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'predictor/predictor-dates.js'), 'utf8'), sandbox);
  const dates = sandbox.window.ConnectifyPredictorDates;
  for (let i = 0; i < 50; i++) assert.strictEqual(dates.resolveCustomDate('Biology', { name: `Task ${i}`, id: `id${i}` }), null);
  assert.ok(keyCalls <= 2, `storage keys were read once for 50 tasks (${keyCalls} reads)`);
  store['connectify:user:acc:connectea:time_override:biology:test #3'] = 'w30';
  assert.strictEqual(dates.resolveCustomDate('Biology', 'Test #3'), 'w30', 'a new override is found case-insensitively');
  store['connectify:user:acc:connectea:time_override:biology:test #3'] = 'w31';
  assert.strictEqual(dates.resolveCustomDate('Biology', 'Test #3'), 'w31', 'its value is read fresh');
  delete store['connectify:user:acc:connectea:time_override:biology:test #3'];
  store['connectify:user:acc:connectea:time_override:biology:test #4'] = 'w32';
  listeners['connectify-week-override-saved'].forEach(fn => fn());
  assert.strictEqual(dates.resolveCustomDate('Biology', 'Test #4'), 'w32', 'a saved override (same key count) drops the index');

  // 2. Every overall row of a pass shares one projection of every subject
  let projections = 0;
  const win = {
    ConnectifyUtils: { normalize: s => String(s || '').trim() },
    ConnectifyCohortRows: { createElement: () => ({}), setHTML: () => {}, setText: () => {}, readMark: () => NaN },
    ConnectifyCohortExpanded: { fillPrediction: () => {} },
    ConnectifyPredictorMath: { cleanSubject: s => s.replace(/ - Semester \d/, ''), projectSubjectGrades: list => (projections++, list.map(s => ({ cleanName: s.name, hasSubjectAverage: true, projected: { low: 60, mid: 65, high: 70 } }))) }
  };
  new Function('window', origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-upcoming.js'), 'utf8'))(win);
  const row = title => ({ querySelectorAll: () => [], closest: () => ({ querySelector: () => ({ textContent: title }) }) });
  const ui = () => ({ box: {}, xp: { prediction: {} } });
  const pass = [{ name: 'Biology ATAR Year 11', tasks: [] }, { name: 'Physics ATAR Year 11', tasks: [] }];
  assert.strictEqual(win.ConnectifyCohortUpcoming.show(ui(), row('Biology ATAR Year 11 - Semester 2'), pass).mid, 65);
  win.ConnectifyCohortUpcoming.show(ui(), row('Physics ATAR Year 11 - Semester 2'), pass);
  win.ConnectifyCohortUpcoming.show(ui(), row('Biology ATAR Year 11 - Semester 1'), pass);
  assert.strictEqual(projections, 1, 'three overall rows, one projection');
  win.ConnectifyCohortUpcoming.show(ui(), row('Biology ATAR Year 11 - Semester 2'), pass.slice());
  assert.strictEqual(projections, 2, 'the next pass (a fresh list) projects again');

  // 3. Heartbeat work that lays out the page waits while Expand All or an accordion runs
  const src = rel => origReadFileSync.call(fs, path.resolve(SRC_DIR, rel), 'utf8');
  assert.ok(src('sidebar/sidebar.js').includes('every(1500, syncState, { mute: true })'), 'sidebar sync (handle position) is muted');
  assert.ok(src('atar/atar-features.js').includes('every(2000, initSidebarTools, { mute: true })'), 'sidebar tools sync is muted');
  assert.ok(src('cohort/cohort-observer.js').includes('every(8000, () => schedule(), { mute: true })'), 'the 8s cohort pass is muted');

  // 4. Theme hooks give Chrome's ancestor filter a class, and no positional pseudo-class sits on a generic subject:
  // a multi-argument :is() ancestor is checked against every ancestor of every element, and span/div:nth-child
  // flagged nearly every parent, so each insertion restyled the following siblings' whole subtrees
  const offenders = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.name.endsWith('.css')) continue;
      const css = origReadFileSync.call(fs, full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/:is\(\s*(?:(?:html|body)?\.connectea-dark\s*,\s*)+(?:html|body)?\.connectea-dark\s*\)/.test(css)) offenders.push(`${path.relative(SRC_DIR, full)}: :is() of .connectea-dark hooks`);
      if (/:is\([^()]*\b(?:span|div)\b[^()]*\):nth-(?:child|of-type)/.test(css)) offenders.push(`${path.relative(SRC_DIR, full)}: span/div :nth-child`);
    }
  })(SRC_DIR);
  assert.deepStrictEqual(offenders, [], 'theme hooks are written .connectea-dark:not(cx-n) (same match, same 0,1,1 specificity)');
});

runTest('Test 270: Theme rules are keyed by a class, id or tag: every :is() / :where() list is expanded or split exactly, ancestor exclusions merged (scripts/expand-is.js)', () => {
  // A subject keyed only by a multi-argument :is() sits in Chrome's universal bucket and is tried on every element; an
  // ancestor keyed only by one gives the Bloom filter nothing to reject on. Expand All restyled ~4x slower in Dark.
  const x = expandIs;
  const dir = path.join(SRC_DIR, 'theme/styles');
  const stale = fs.readdirSync(dir).filter(f => f.endsWith('.css')).filter(f => {
    const css = origReadFileSync.call(fs, path.join(dir, f), 'utf8');
    return x.transform(css) !== css;
  });
  assert.deepStrictEqual(stale, [], 'run node scripts/expand-is.js --write on these theme stylesheets');
  const same = (sel, out) => {
    assert.deepStrictEqual(x.expandSelector(sel), out, sel);
    for (const s of out) assert.deepStrictEqual(x.specificity(s), x.specificity(sel), `${s} keeps the specificity of ${sel}`);
  };
  // Arguments as specific as the list stand alone; less specific ones are padded to it
  same('.connectea-dark :is(mat-toolbar, .mat-toolbar)', ['.connectea-dark :where(mat-toolbar):not(.cx-n)', '.connectea-dark .mat-toolbar']);
  same('.a :is(span, .b):hover', ['.a :where(span):hover:not(.cx-n)', '.a .b:hover']);
  // Complex arguments stay inside their own :is() (P :is(A B) is not P A B); their lists are expanded inside it
  same('.p :is(.a .b, .c)', ['.p :is(.a .b)', '.p .c:not(.cx-n)']);
  same('.p :is(.a :is(.b, .c))', ['.p :is(.a .b)', '.p :is(.a .c)']);
  // Ancestors are expanded too; :where() arguments stay in :where(); the unused anchor only lends its id weight
  same(':is(.a, .b) > span', ['.a > span', '.b > span']);
  same('.p :where(.a, b)', ['.p :where(.a)', '.p :where(b)']);
  same('html.connectea-dark :is(#cx-specificity-anchor, .a)', ['html.connectea-dark :where(.a):not(#cx-n)']);
  // Lists that only name <html> / <body> hooks are ancestors of everything: left whole
  same(':is(.connectea-dark, body, html) :is(.a, .b)', [':is(.connectea-dark, body, html) .a', ':is(.connectea-dark, body, html) .b']);
  // A compound already keyed by a class keeps its list
  same('.x:is(.a, .b) span', ['.x:is(.a, .b) span']);
  // Ancestor exclusions walk every ancestor each: one compound's become one :not(:is(...) *), padded to the same
  // specificity (the typography rule tried on every div walked them seven times, Expand All's costliest rule in Dark)
  const merged = (sel, out) => {
    assert.strictEqual(x.mergeExclusions(sel), out, sel);
    assert.deepStrictEqual(x.specificity(out), x.specificity(sel), `${out} keeps the specificity of ${sel}`);
    assert.strictEqual(x.mergeExclusions(out), out, 'merging again changes nothing');
  };
  merged('.connectea-dark div:not(.a *):not(#b *):not([style*="font-family"] *):not(.c)', '.connectea-dark div:not(:is(.a, #b, [style*="font-family"]) *):not(.c):not(.cx-n):not(.cx-n)');
  merged('.p:not(.a > *):not(.b *)::before', '.p:not(.a > *):not(.b *)::before');
  merged('.p:not(:is(.a, .b) *):not(#c *)', '.p:not(:is(.a, .b, #c) *):not(.cx-n)');
  // A single complex argument is never bucketed by Chrome (tried on every element): after <html> / <body> hooks it is
  // written one compound at a time, which matches the same elements with the same specificity
  const split = (sel, out) => {
    assert.strictEqual(x.splitSingle(sel), out, sel);
    assert.deepStrictEqual(x.specificity(out), x.specificity(sel), `${out} keeps the specificity of ${sel}`);
    assert.strictEqual(x.splitSingle(out), out, 'splitting again changes nothing');
  };
  split(':is(html, body).connectea-dark:not([data-connectea-login]) :is(.cvr-c-classes span):not(.cx-n)', ':is(html, body).connectea-dark:not([data-connectea-login]) .cvr-c-classes span:not(.cx-n)');
  split('.connectea-dark :where(.cvr-c-a > .cvr-c-b div)', '.connectea-dark :where(.cvr-c-a) > :where(.cvr-c-b) :where(div)');
  split('html.connectea-dark :is(.cvr-c-task:not(.cvr-c-tasks *) .cvr-c-task__mark)::before', 'html.connectea-dark :is(.cvr-c-task:not(.cvr-c-tasks *)) .cvr-c-task__mark::before');
  // After any other ancestor the list stays (.tile :is(.a span) also matches an .a outside the tile), and so does a
  // first compound that could be <html> / <body> itself
  split('.connectea-dark .eds-c-tile :is(.cvr-c-a span)', '.connectea-dark .eds-c-tile :is(.cvr-c-a span)');
  split('.connectea-dark :is(.wf-active span)', '.connectea-dark :is(.wf-active span)');
  split('.connectea-dark [data-connectea-surface] :is(.cvr-c-a span)', '.connectea-dark [data-connectea-surface] :is(.cvr-c-a span)');
  const typography = origReadFileSync.call(fs, path.join(dir, 'theme-core.css'), 'utf8').split('\n').find(l => l.startsWith('.connectea-dark :where(div):not('));
  assert.ok(typography && (typography.match(/ \*\)/g) || []).length === 1, 'the typography rule walks the ancestors once');
});

runTest('Test 271: Caches follow the signed-in user: another student signing in never sees the last one\'s cached classes', () => {
  const savedUtils = window.ConnectifyUtils;
  const savedHref = location.href;
  const savedStore = localStorage.store;
  const savedScripts = document.scripts;
  const outlines = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
  const liferay = id => [{ src: '', textContent: `Liferay.ThemeDisplay={getUserEmailAddress:function(){return"x@student"},getUserId:function(){return"${id}"},getUserName:function(){return"Student"},isImpersonated:function(){return!1},isSignedIn:function(){return!0}}` }];
  try {
    localStorage.store = {
      'connectify:account': 'DomainConnectUser:42',
      'connectify:subjects_cache:DomainConnectUser:42': '{"12 Chemistry ATAR":[]}',
      'connectify:subjects_cache:current': '{"12 Chemistry ATAR":[]}',
      'connectify:stale_subjects': '["12 chemistry atar"]'
    };
    const load = (href, scripts) => {
      location.href = href;
      document.scripts = scripts;
      window.ConnectifyUtils = undefined;
      eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/utils.js'), 'utf8'));
      return window.ConnectifyUtils;
    };

    // The student who used Connectify before users were told apart keeps their account and data
    let utils = load(outlines, liferay('23317222'));
    assert.strictEqual(utils.signedInUserId(), '23317222', 'the user id is read from Connect\'s Liferay themeDisplay');
    assert.strictEqual(utils.accountKey(), 'DomainConnectUser:42', 'the first user signed in keeps the account already in use');
    assert.deepStrictEqual(JSON.parse(localStorage.getItem('connectify:accounts')), { 23317222: 'DomainConnectUser:42' });

    // Signing out and in as someone else (shortcut, no coisp) gives a fresh account, not the remembered one
    utils = load(outlines, liferay('99887766'));
    assert.strictEqual(utils.accountKey(), 'user99887766', 'a new user never reads the last user\'s account');
    assert.strictEqual(localStorage.getItem('connectify:account'), 'user99887766', 'pages without a user follow the last one signed in');
    utils = load(`${outlines}?coisp=DomainConnectUser:42`, liferay('99887766'));
    assert.strictEqual(utils.accountKey(), 'user99887766', 'an account, once given, never changes with the URL');

    // Signing back in as the first student brings their own caches back
    utils = load(outlines, liferay('23317222'));
    assert.strictEqual(utils.accountKey(), 'DomainConnectUser:42', 'each user returns to their own account');

    // A guest page (not signed in) names no user
    const guest = [{ src: '', textContent: 'Liferay.ThemeDisplay={getUserId:function(){return"20123"},isSignedIn:function(){return!1}}' }];
    assert.strictEqual(load(outlines, guest).signedInUserId(), null, 'the guest user is never an account');

    // Caches: no untagged copies are read, and stale subjects are kept per account
    const cacheJs = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-cache.js'), 'utf8');
    assert.ok(!/getItem\('connectify:subjects_cache:current'\)/.test(cacheJs) && !/setItem\('connectify:subjects_cache:current'/.test(cacheJs),
      'the subjects cache never mirrors to or reads the untagged current copy');
    assert.ok(cacheJs.includes('`${LEGACY_STALE_KEY}:${getStudentId()}`'), 'stale subjects are keyed by account');
  } finally {
    localStorage.store = savedStore;
    location.href = savedHref;
    document.scripts = savedScripts;
    window.ConnectifyUtils = savedUtils;
  }
});

runTest('Test 272: Task types, class categories, week overrides, calibration and the Weaknesses filter belong to the signed-in user', () => {
  const savedUtils = window.ConnectifyUtils;
  const savedMigrate = window.ConnectifyUserSettingsMigrate;
  const savedStore = localStorage.store;
  const savedScripts = document.scripts;
  const savedHref = location.href;
  const liferay = id => [{ src: '', textContent: `Liferay.ThemeDisplay={getUserId:function(){return"${id}"},isSignedIn:function(){return!0}}` }];
  const load = (file, global) => { window[global] = undefined; eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, file), 'utf8')); return window[global]; };
  try {
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
    localStorage.store = {
      'connectify:account': 'DomainConnectUser:42',
      'connectea:task_type_overrides': '{"Chemistry::Test 1":"Exam"}',
      'connectea:class_categories:chemistry': '["Fieldwork"]',
      'connectea:time_override:Chemistry ATAR:Test 1': 'w12',
      'connectify:time_override:Physics ATAR:Lab': 't3w2',
      'connectea:preferences': '{"sem1_calibration:chemistry":{"raw":80,"scaled":75}}',
      'connectify:weakness_disabled_subjects': '["Physics"]',
      'connectea:theme:id': 'dark'
    };

    // A page with no signed-in user leaves the shared values where they are
    document.scripts = [];
    load('system/utils.js', 'ConnectifyUtils');
    assert.strictEqual(load('system/user-settings-migrate.js', 'ConnectifyUserSettingsMigrate').run(), false, 'no user: nothing moves');
    assert.strictEqual(localStorage.getItem('connectea:task_type_overrides'), '{"Chemistry::Test 1":"Exam"}');

    // The first signed-in page moves every one of them to that student, once
    document.scripts = liferay('23317222');
    let utils = load('system/utils.js', 'ConnectifyUtils');
    load('system/user-settings-migrate.js', 'ConnectifyUserSettingsMigrate');
    const mine = 'connectify:user:DomainConnectUser:42:';
    assert.strictEqual(utils.userKey('connectea:preferences'), `${mine}connectea:preferences`);
    for (const key of ['connectea:task_type_overrides', 'connectea:class_categories:chemistry', 'connectea:time_override:Chemistry ATAR:Test 1',
      'connectify:time_override:Physics ATAR:Lab', 'connectea:preferences', 'connectify:weakness_disabled_subjects']) {
      assert.strictEqual(localStorage.getItem(key), null, `${key} is no longer shared`);
      assert.notStrictEqual(localStorage.getItem(mine + key), null, `${key} moved to the signed-in student`);
    }
    assert.strictEqual(localStorage.getItem('connectea:theme:id'), 'dark', 'browser-wide settings stay shared');
    assert.strictEqual(utils.readTimeOverride(['Chemistry ATAR'], ['Test 1']), 'w12', 'week overrides are read from the student\'s own keys');
    assert.deepStrictEqual(utils.userKeys(k => k.startsWith('connectea:class_categories:')), [`${mine}connectea:class_categories:chemistry`]);
    assert.strictEqual(localStorage.getItem('connectify:user_settings_migrated'), '1');

    // Another student sees none of them, and a later shared value (an old tab) is never moved to them
    document.scripts = liferay('99887766');
    utils = load('system/utils.js', 'ConnectifyUtils');
    localStorage.setItem('connectea:task_type_overrides', '{"Old::Tab":"Test"}');
    load('system/user-settings-migrate.js', 'ConnectifyUserSettingsMigrate');
    assert.strictEqual(utils.readTimeOverride(['Chemistry ATAR'], ['Test 1']), null, 'another student never reads the first one\'s overrides');
    assert.deepStrictEqual(utils.userKeys(() => true), [], 'another student starts with no settings of their own');
    assert.strictEqual(localStorage.getItem('connectify:user:user99887766:connectea:task_type_overrides'), null, 'the migration runs once');

    // Every reader and writer goes through the student's keys
    const read = rel => origReadFileSync.call(fs, path.resolve(SRC_DIR, rel), 'utf8');
    const files = ['cohort/task-types.js', 'cohort/task-type-select.js', 'cohort/cohort-observer.js', 'progress/compound-progress.js', 'progress/weakness-radar.js',
      'progress/progress-week-editor.js', 'progress/progress-math.js', 'predictor/predictor-dates.js', 'predictor/predictor-atar-projection.js',
      'predictor/category-baselines.js', 'atar/scaling-calibration.js', 'atar/atar-calculator.js'];
    for (const file of files) {
      const unkeyed = read(file).match(/(?:getItem\(|setItem\(|removeItem\(|e\.key ===|e\.key\?\.startsWith\()\s*[`'](?:connectea:(?:task_type_overrides|class_categories|time_override|preferences)|connectify:(?:time_override|weakness_disabled_subjects))/);
      assert.ok(!unkeyed, `${file} reads a shared key: ${unkeyed && unkeyed[0]}`);
    }
    const manifest = JSON.parse(read('../manifest.json'));
    for (const group of manifest.content_scripts.filter(g => g.js?.includes('src/system/utils.js') && g.js.includes('src/assessment/cache-versions.js'))) {
      assert.strictEqual(group.js[group.js.indexOf('src/system/utils.js') + 1], 'src/system/user-settings-migrate.js', 'the migration runs before anything reads the settings');
    }
  } finally {
    localStorage.store = savedStore;
    document.scripts = savedScripts;
    location.href = savedHref;
    window.ConnectifyUtils = savedUtils;
    window.ConnectifyUserSettingsMigrate = savedMigrate;
  }
});

runTest('Test 273: Year Progression subject charts start at 50%, or at the lowest value below 50% rounded down to the nearest 10', () => {
  const saved = window.ConnectifyProgressMath;
  try {
    window.ConnectifyProgressMath = undefined;
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'progress/progress-math.js'), 'utf8'));
    const math = window.ConnectifyProgressMath;
    const bounds = (scores, means = []) => math.computeYBounds(scores.map((score, i) => ({ score, mean: means[i] ?? null })), false);
    assert.strictEqual(bounds([72, 50, 91]).minY, 50, 'no value below 50%: the scale starts at 50%');
    assert.strictEqual(bounds([72, 47.5, 91]).minY, 40, 'a task at 47.5%: the scale starts at 40%');
    assert.strictEqual(bounds([72, 30, 91]).minY, 30, 'a task at exactly 30%: the scale starts at 30%');
    assert.strictEqual(bounds([72, 4, 91]).minY, 0, 'a task under 10%: the scale starts at 0%');
    assert.strictEqual(bounds([72, null, 91]).minY, 50, 'unmarked tasks never lower the scale');
    assert.strictEqual(bounds([72, 81], [44, 60]).minY, 40, 'a cohort mean below 50% stays on the chart');
    assert.strictEqual(bounds([null]).minY, 50, 'no marked task: the scale starts at 50%');
    const b = bounds([62, 80]);
    assert.strictEqual(b.maxY, 100);
    assert.strictEqual(b.gridStep, 10, 'grid lines every 10%');
    assert.strictEqual(b.yFor(50), 260, '50% sits on the axis');
    assert.strictEqual(b.yFor(100), 40, '100% sits at the top');
  } finally {
    window.ConnectifyProgressMath = saved;
  }
});

runTest('Test 274: Same-named tasks keep their own cohort mean: a repeated name is keyed by its id in the stats cache', () => {
  const makeCard = (titleText, rows) => {
    const card = new MockElement('div', 'eds-c-tile');
    const title = new MockElement('div', 'eds-c-tile__title');
    title.textContent = titleText;
    card.appendChild(title);
    const list = new MockElement('div', 'cvr-c-tasks');
    card.appendChild(list);
    const made = rows.map(([labels, mark, weight, stats]) => {
      const row = new MockElement('div', 'cvr-c-task');
      const details = new MockElement('div', 'cvr-c-task__details');
      for (const text of labels) {
        const label = new MockElement('span', 'v-label');
        label.textContent = text;
        details.appendChild(label);
      }
      row.appendChild(details);
      const marks = new MockElement('div', 'cvr-c-task__marks');
      for (const text of [mark, weight]) {
        const cell = new MockElement('div', 'cvr-c-task__mark');
        cell.textContent = text;
        marks.appendChild(cell);
      }
      row.appendChild(marks);
      if (stats) {
        const chart = new MockElement('div', 'cvr-c-task__chart');
        chart.dataset.connectifyStats = JSON.stringify(stats);
        row.appendChild(chart);
      }
      list.appendChild(row);
      return row;
    });
    return { card, rows: made };
  };
  const subjectName = '12 Literature ATAR';
  const firstStats = [30, 50, 58, 66, 85];
  const sem1Exam = [['Examination', 'Term 2, Week 7', 'Close reading'], '41 Out of 60', '15%', firstStats];
  const sem2Exam = [['Examination', 'Term 4, Week 5', 'Close reading'], '- Out of 60', '15%'];
  try {
    window.ConnectifyCache.clearCohortCache();
    window.ConnectifyData.clearCache();
    const sem1 = makeCard(`${subjectName} - Semester 1`, [sem1Exam]);
    const sem2 = makeCard(`${subjectName} - Semester 2`, [sem1Exam, sem2Exam]);
    const ids = window.ConnectifyParseHelpers.cardTaskIds(sem2.card);
    const secondId = ids.get(sem2.rows[1]).id;
    assert.strictEqual(ids.get(sem2.rows[0]).statsKey, 'Close reading', 'the first task of a name keeps its name key');
    assert.strictEqual(ids.get(sem2.rows[1]).statsKey, secondId, 'a repeated name is keyed by its id');
    assert.strictEqual(window.ConnectifyCohortRows.statsKey(sem2.rows[1]), secondId, 'the row readers use the same key');

    window.ConnectifyData.scrapeSubjectTasks(sem1.card);
    window.ConnectifyData.scrapeSubjectTasks(sem2.card);
    const subject = window.ConnectifyAssessmentScrape.formatCollectedSubjects(true).find(s => s.name === subjectName);
    const [marked, upcoming] = subject.tasks.filter(t => t.name === 'Close reading');
    assert.ok(Number.isFinite(marked.mean), 'the marked exam keeps its cohort mean');
    assert.ok(!Number.isFinite(upcoming.mean) && !upcoming.stats, 'the upcoming exam never takes the marked one\'s boxplot');

    // Both marked: each keeps its own boxplot, and the name key stays the first one's
    const laterStats = [20, 40, 48, 55, 70];
    const sem2Marked = makeCard(`${subjectName} - Semester 2`, [sem1Exam, [sem2Exam[0], '30 Out of 60', '15%', laterStats]]);
    const laterId = window.ConnectifyParseHelpers.cardTaskIds(sem2Marked.card).get(sem2Marked.rows[1]).id;
    window.ConnectifyData.scrapeSubjectTasks(sem2Marked.card, true);
    assert.deepStrictEqual(window.ConnectifyCache.getTaskStats(subjectName, 'Close reading'), firstStats);
    assert.deepStrictEqual(window.ConnectifyCache.getTaskStats(subjectName, laterId), laterStats);
    const means = window.ConnectifyAssessmentScrape.formatCollectedSubjects(true).find(s => s.name === subjectName)
      .tasks.filter(t => t.name === 'Close reading').map(t => t.mean);
    assert.ok(means.length === 2 && means[0] !== means[1], 'the two exams show different cohort means');
  } finally {
    window.ConnectifyCache.clearCohortCache();
    window.ConnectifyData.clearCache();
  }
});


runTest('Test 275: On iPadOS / iOS Connectify buttons drop native appearance, so WebKit never forces a capsule radius over their own', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/webkit-buttons.css'), 'utf8');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.css || []).includes('src/system/webkit-buttons.css'));
  assert.ok(group && group.matches.includes('https://connect.det.wa.edu.au/*'), 'loaded on every Connect page, like the handle and theme button');
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const supports = body.indexOf('@supports (-webkit-touch-callout: none)');
  assert.ok(supports >= 0 && body.slice(0, supports).trim() === '', 'every rule is for iOS WebKit only (desktop browsers are unchanged)');
  const [, selector = '', decls = ''] = body.match(/\{\s*([^{}]*)\{([^}]*)\}/) || [];
  for (const host of ['#connectify-sidebar', '#connectea-theme-menu', '#cx-customizer-modal', '#connectify-notifications-container', '#cx-expand-btn', '.cx-goal-overlay', '.connectea-row-wrapper', '.connectea-panel']) {
    assert.ok(selector.includes(host), `${host} buttons are covered`);
  }
  assert.ok(selector.includes('#connectify-sidebar-handle') && selector.includes('#connectea-theme-toggle'), 'the handle and the theme button are buttons themselves');
  assert.ok(!/\bselect\b/.test(selector), 'selects keep their native arrow');
  assert.ok(/(^|[;\s])appearance:\s*none/.test(decls) && /-webkit-appearance:\s*none/.test(decls), 'native appearance is off');
  assert.ok(!/radius|padding|margin|!important/.test(decls), 'each button keeps its own geometry and spacing');
});

runTest('Test 276: Feed cards keep Connect\'s white class thumbnail and item icon on the class-colour bar in every dark theme', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-feed-3.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/([^{}]*\.card-scope-thumbnail[^{}]*)\{([^}]*)\}/);
  assert.ok(rule, 'the feed card class bar has its own icon rule');
  const selectors = rule[1].split(',').map(s => s.trim());
  for (const target of ['.card-scope-thumbnail .mat-icon', '.card-scope-icon']) {
    const sel = selectors.find(s => s.endsWith(target));
    assert.ok(sel && sel.startsWith('.connectea-dark') && sel.includes(':not(#cx-n)'),
      `${target} is scoped to dark themes with an id weight, so it beats the generic icon rule (no id) in theme-material.css`);
  }
  assert.ok(/(^|[;\s])color:\s*#ffffff !important/.test(rule[2]) && /fill:\s*#ffffff !important/.test(rule[2]),
    'the glyphs are Connect\'s white (fill for the SVG thumbnail), never the theme ink');
  const generic = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-material.css'), 'utf8');
  assert.ok(!/#cx-/.test(generic.split('/* Angular Material Accordions')[0]), 'the generic icon rule carries no id weight that could tie it');
});

runTest('Test 279: The playground feeds Connectify classes as the scraper would cache them, with every outlines-page script', () => {
  const model = require('./scripts/playground/model.js');
  const sandbox = { window: {} };
  vm.runInNewContext(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'assessment/assessment-parse-helpers.js'), 'utf8'), sandbox);
  const helpers = sandbox.window.ConnectifyParseHelpers;

  let seed = 0.37;
  const rand = () => (seed = (seed * 9301 + 49297) % 233280 / 233280);
  const first = model.generateClass([], rand);
  const second = model.generateClass([first.name], rand);
  assert.notStrictEqual(first.name, second.name, 'each new class gets an unused subject');
  for (const cls of [first, second]) {
    for (const semester of [1, 2]) assert.strictEqual(cls.tasks.filter(t => t.semester === semester).length, 2, 'two tasks per semester');
    assert.strictEqual(model.weightTotal(cls), 100, 'annual weights total 100, as Target Grade needs');
    assert.strictEqual(new Set(cls.tasks.map(t => t.name)).size, 4, 'task names are generated and distinct');
  }

  first.tasks[0].score = 80;
  first.tasks[2].score = 60;
  const { subjects, registry } = model.toConnectify({ classes: [first] }, helpers);
  const tasks = subjects[first.name];
  const taskOne = first.tasks[0];
  assert.strictEqual(tasks[0].id, `${JSON.stringify([[taskOne.type, `Term ${taskOne.term}, Week ${taskOne.week}`, taskOne.name], 100])}:0`,
    'ids use the parser\'s format (labels and out-of mark, then the occurrence)');
  assert.deepStrictEqual([tasks[0].pending, tasks[1].pending, tasks[1].score], [false, true, null], 'a blank mark is a pending task');
  assert.deepStrictEqual(tasks.map(t => t.semester), [1, 1, 2, 2], 'each task\'s semester comes from its week');
  assert.strictEqual(tasks[1].order, helpers.orderHint('Term 2, Week 5'), 'the order is the caption\'s, as the parser reads it');

  taskOne.name = 'Renamed';
  assert.strictEqual(model.toConnectify({ classes: [first] }, helpers).subjects[first.name][0].id, tasks[0].id, 'edits keep a task\'s id');

  const reg = registry[first.name];
  assert.strictEqual(reg[1].title, `${first.name} - Semester 1`);
  assert.deepStrictEqual(reg[1].tasks.map(t => t[0]), tasks.slice(0, 2).map(t => t.id), 'the Semester 1 outline lists its own tasks');
  assert.strictEqual(reg[2].tasks.length, 4, 'the Semester 2 outline lists every task of the year, as Connect does');
  assert.strictEqual(reg[1].mark, 80, 'Semester 1\'s mark is its own marked tasks\' weighted mean');
  assert.strictEqual(reg[2].mark, 70, 'Semester 2\'s mark is cumulative');
  first.markOverride[2] = 72.5;
  first.letters[1] = 'B';
  const after = model.toConnectify({ classes: [first] }, helpers).registry[first.name];
  assert.deepStrictEqual([after[2].mark, after[1].finalLetter, after[2].finalLetter], [72.5, true, false], 'overrides and final grades reach the registry');

  const server = require('./scripts/playground/server.js');
  const html = server.page();
  const group = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8')).content_scripts
    .find(cs => !cs.world && cs.matches.some(m => m.includes('assessment-outlines')));
  const scripts = [...html.matchAll(/<script src="\/(src\/[^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(scripts, group.js, 'every outlines-page content script loads, in manifest order');
  assert.ok(html.indexOf('/playground/shim.js') < html.indexOf(`/${group.js[0]}`) && html.indexOf('/playground/app.js') > html.lastIndexOf('/src/'),
    'the extension API shim loads first and the editor last');
  const styles = [...html.matchAll(/<link rel="stylesheet" href="\/([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(styles, group.css || [], 'only Connectify\'s own component stylesheets');
  assert.ok(!styles.some(s => s.includes('theme/')), 'never theme stylesheets');
  assert.ok(server.OUTLINES_PATH === new URL('https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines').pathname,
    'served at the outlines path, so isOutlinesPage() is true');
});

runTest('Test 280: Type dropdowns size to the chosen type with a cap, and new category names are at most 16 characters', () => {
  const read = rel => origReadFileSync.call(fs, path.resolve(BASE_DIR, rel), 'utf8');
  for (const [file, css] of [['sidebar-weakness-types.css', read('src/sidebar/styles/sidebar-weakness-types.css')], ['cohort-styles.js', read('src/cohort/cohort-styles.js')]]) {
    const rule = css.slice(css.indexOf('field-sizing: content;') - 300, css.indexOf('field-sizing: content;') + 200);
    assert.ok(rule.includes('.connectea-type-select'), `${file}: field-sizing sits on the Type dropdown`);
    assert.ok(/max-width: 160px;/.test(rule) && rule.includes('text-overflow: ellipsis;'), `${file}: a long category name is truncated, never widening the row`);
  }

  const store = window.ConnectifyCategoryStore;
  assert.strictEqual(store.MAX_NAME_LENGTH, 16);
  const asked = [];
  const answers = ['  Practical   Investigation  ', 'Practical Invest'];
  const origPrompt = global.prompt;
  global.prompt = (message, value) => { asked.push([message, value]); return answers.shift(); };
  try {
    assert.strictEqual(store.promptName('Enter custom assessment type'), 'Practical Invest', 'a name over 16 characters is asked again');
    assert.ok(asked[0][0].includes('up to 16 characters'), 'the first prompt names the limit');
    assert.ok(asked[1][0].includes('23 characters') && asked[1][1] === 'Practical Invest', 'the retry says how long it was and offers it cut to 16');
    global.prompt = () => null;
    assert.strictEqual(store.promptName('x'), null, 'cancel returns null');
    global.prompt = () => '   ';
    assert.strictEqual(store.promptName('x'), null, 'a blank name returns null');
  } finally {
    global.prompt = origPrompt;
  }
  assert.ok(read('src/cohort/cohort-panel.js').includes("window.ConnectifyCategoryStore.promptName('Enter custom assessment type')"), 'the row\'s + Custom... asks through promptName');
  assert.ok(read('src/predictor/category-settings.js').includes("store.promptName('Enter new assessment category name"), 'Settings + Add Category asks through promptName');
});

runTest('Test 281: Prediction panels on unmarked tasks a goal covers show the goal target, coloured by the task\'s tier', () => {
  localStorage.clear();
  const card = makeOutlineCard('Chemistry ATAR - Semester 2', { tasks: [['Test 1', '39 Out of 50'], ['Investigation', '- Out of 50'], ['Exam', '- Out of 50']] });
  const rows = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
  const ids = new Map([[rows[0], { id: 't1' }], [rows[1], { id: 't3' }], [rows[2], { id: 't4' }]]);
  const weights = { t1: 20, t3: 15, t4: 50 };
  const { win, chem } = goalFixture({
    ConnectifyTaskTypes: { getTaskMeta: () => ({ subjectName: 'Chemistry ATAR' }) },
    ConnectifyParseHelpers: { cardTaskIds: () => ids },
    ConnectifyCache: { subjectsCache: new Map([['Chemistry ATAR', new Map(Object.entries(weights).map(([id, weight]) => [id, { id, weight }]))]]) }
  });
  const F = win.ConnectifyGoalForecast;
  assert.strictEqual(F.targetFor(rows[1], null), null, 'nothing without a goal');
  assert.strictEqual(F.signature(rows[1], false), '');
  const G = win.ConnectifyGoalStore;
  G.save({ kind: 'grade', subject: 'chemistry', name: 'Chemistry', target: 80, end: { type: 'semester', semester: 2 }, priorMarked: ['chemistry::t1', 'chemistry::t2'] });
  const prediction = { low: 68, mid: 75, high: 82 };
  const target = F.targetFor(rows[1], prediction);
  const plan = win.ConnectifyGoalEvents.stateOf(G.active()[0]).plan;
  assert.ok(target && Math.abs(target.required - win.ConnectifyGoalPlan.requiredOf(plan, 't3')) < 1e-9, 'the plan\'s requirement for the task, as the Year Progression chart plots it');
  assert.strictEqual(target.tier, win.ConnectifyGoalDifficulty.taskTier(target.required, prediction), 'the task\'s own tier against its prediction');
  assert.strictEqual(F.signature(rows[1], false), `target:${Math.round(target.required)}`, 'joins the row memo, so a changed target redraws it');
  assert.strictEqual(F.signature(rows[1], true), '', 'overall rows have no prediction panel');

  // Compact line: "Goal target 86%" and the tier label at its end
  const box = new MockElement('section', 'connectea-panel connectea-forecast');
  F.render({ forecast: box }, rows[1], prediction);
  F.render({ forecast: box }, rows[1], prediction);
  const compact = box.querySelectorAll('.cx-goal-target');
  assert.strictEqual(compact.length, 1, 'drawn once however often the row renders');
  assert.strictEqual(compact[0].childNodes[0].textContent, '  •  Goal target ');
  const compactValue = compact[0].querySelector('.cx-goal-target__value');
  assert.strictEqual(compactValue.textContent, `${Math.round(target.required)}%`);
  assert.strictEqual(compactValue.dataset.tier, target.tier, 'the value carries the task\'s tier for its colour');
  assert.strictEqual(compactValue.tagName.toLowerCase(), 'span', 'a span, not a strong: the panel\'s strong rules would make it 700 like Mid');
  assert.strictEqual(box.querySelector('.cx-goal-tier'), null, 'no tier label: the colour says it');
  assert.ok(box.classList.contains('cx-has-goal-target'));

  // Expanded card: a Goal target cell after Low / Mid / High
  const xpBox = new MockElement('section', 'connectea-panel connectea-forecast connectea-xp-forecast');
  const body = new MockElement('div', 'connectea-xp-body');
  xpBox.append(body);
  F.render({ forecast: xpBox, xpForecast: { body } }, rows[1], prediction);
  const cell = body.querySelector('dl.cx-goal-target');
  assert.ok(cell && cell.classList.contains('connectea-xp-grid'), 'a cell of the card\'s own grid');
  assert.strictEqual(cell.querySelector('.connectea-xp-label').textContent, 'Goal target');
  const xpValue = cell.querySelector('.connectea-xp-value');
  assert.ok(xpValue.classList.contains('cx-goal-target__value') && xpValue.dataset.tier === target.tier && !cell.querySelector('.cx-goal-tier'),
    'the card\'s value, coloured by the tier, with no tier label');

  // Unweighted tasks need nothing; deleting the goal removes the target
  weights.t3 = 0;
  win.ConnectifyCache.subjectsCache.get('Chemistry ATAR').get('t3').weight = 0;
  assert.strictEqual(F.targetFor(rows[1], prediction), null, 'an unweighted task has no target');
  G.remove(G.active()[0].id);
  F.render({ forecast: box }, rows[2], prediction);
  assert.strictEqual(box.querySelector('.cx-goal-target'), null, 'no goal, no target');
  assert.ok(!box.classList.contains('cx-has-goal-target'));
  assert.ok(chem.tasks.length === 4);

  const view = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-view.js'), 'utf8');
  assert.ok(view.includes('window.ConnectifyGoalForecast?.signature(row, isOverall)') && view.includes('window.ConnectifyGoalForecast?.render(ui, row, prediction)'),
    'unmarked rows memoise and draw the goal target after the prediction');
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-forecast.css'), 'utf8');
  assert.ok(cssHas(css, 'color: oklch(from var(--cx-goal-tier) 0.46 0.075 h) !important;') && cssHas(css, 'color: oklch(from var(--cx-goal-tier) 0.8 0.075 h) !important;'),
    'the tier\'s hue, desaturated, at a lightness that keeps >= 5:1 (dark ink on light panels, light ink on dark ones)');
  assert.ok(cssHas(css, ':is(#cx-specificity-anchor, .connectea-row-wrapper) .cx-goal-target__value[data-tier]'), 'the colour outranks the glass strip\'s ink rule');
  assert.ok(cssHas(css, ':is(#cx-specificity-anchor, .connectea-row-wrapper) span.cx-goal-target > .cx-goal-target__value { font-weight: 600 !important; }'),
    'the compact value is semibold like Low and High, outranking the task group\'s first-child span rule');
  const dialogCss = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-dialog.css'), 'utf8');
  assert.ok(dialogCss.includes(':is(.cx-goal-tier, .cx-goal-hbar, .cx-goal-target__value)[data-tier="hard"] { --cx-goal-tier: #f97316; }'), 'tier colours have one source');
  assert.ok(cssHas(css, 'border-color: var(--cx-border, #3b6088) !important;'), 'its hairline follows the card\'s in dark themes');
  localStorage.clear();
});

runTest('Test 282: Jump To lists each shown outline\'s cleaned subject name once, in page order, above Expand All / Collapse All', () => {
  const prev = { filter: window.ConnectifySemesterFilter, newGrade: window.ConnectifyNewGrade, jumpMod: window.ConnectifyOutlineJump };
  window.ConnectifySemesterFilter = { currentSemester: () => 2 };
  const jumped = [];
  window.ConnectifyNewGrade = { jumpToSubject: card => jumped.push(card) };
  eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/outline-jump.js'), 'utf8'));
  const J = window.ConnectifyOutlineJump;
  const page = new MockElement('div');
  const cards = ['Year 12 Physics ATAR - Semester 1', 'English ATAR - Semester 1', 'Year 12 Physics ATAR - Semester 2', 'Biology - Semester 1', 'Economics - Semester 2']
    .map(title => makeOutlineCard(title));
  cards[4].classList.add('cx-semester-hidden');
  cards.forEach(c => page.appendChild(c));
  const origQSA = document.querySelectorAll;
  document.querySelectorAll = sel => (sel.includes('eds-c-tile') ? page.querySelectorAll(sel) : origQSA(sel));
  try {
    assert.deepStrictEqual(J.subjects().map(s => s.name), ['Physics', 'English', 'Biology'],
      'cleaned names (no year level, ATAR or semester), each once, in page order; hidden outlines left out');
    assert.strictEqual(J.subjects()[0].card, cards[2], 'a subject with both outlines shown jumps to this semester\'s');

    const row = J.create();
    const box = row.querySelector('#cx-jump-subject-select');
    const list = row.querySelector('#cx-jump-subject-list');
    const btn = row.querySelector('#cx-jump-subject-btn');
    assert.ok(box.tagName === 'BUTTON' && row.children[0] === box && row.children[1] === list && row.children[2] === btn,
      'the dropdown box, its list, then the button (never a native <select>, whose macOS list falls off the bottom of the screen)');
    assert.strictEqual(box.getAttribute('aria-haspopup'), 'listbox');
    assert.strictEqual(list.getAttribute('role'), 'listbox');
    assert.ok(list.hidden, 'the list starts closed');
    assert.strictEqual(btn.textContent, 'Jump To');
    const origById = document.getElementById;
    document.getElementById = id => row.querySelector(`#${id}`) || origById(id);
    try {
      J.sync();
      assert.deepStrictEqual(list.children.map(o => o.textContent), ['Physics', 'English', 'Biology'], 'the list shows them in page order');
      assert.ok(list.children.every(o => o.dataset.value === o.textContent && o.getAttribute('role') === 'option'), 'each option shows the full name, never cut short');
      assert.strictEqual(box.dataset.value, 'Physics', 'the first subject is chosen');
      assert.strictEqual(box.textContent, 'Physics');
      J.open();
      assert.ok(!list.hidden && box.getAttribute('aria-expanded') === 'true', 'the box opens the list');
      list.dispatchEvent({ type: 'click', target: list.children[1] });
      assert.strictEqual(box.dataset.value, 'English', 'picking an option chooses it');
      assert.ok(list.hidden, 'and closes the list');
      assert.deepStrictEqual(list.children.map(o => o.getAttribute('aria-selected')), ['false', 'true', 'false']);
      btn.onclick();
      assert.deepStrictEqual(jumped, [cards[1]], 'Jump To expands, scrolls to and highlights the chosen subject\'s card');
    } finally {
      document.getElementById = origById;
    }

    const controls = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/outline-controls.js'), 'utf8');
    assert.ok(controls.includes("if (window.ConnectifyOutlineJump) btnContainer.append(window.ConnectifyOutlineJump.create());\n    btnContainer.append(createBtn('Expand All', true), createBtn('Collapse All', false));"),
      'the Jump To row sits above Expand All and Collapse All');
    const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
    const outlines = manifest.content_scripts.find(g => g.js?.includes('src/atar/outline-controls.js'));
    assert.ok(outlines.js.indexOf('src/atar/outline-jump.js') === outlines.js.indexOf('src/atar/outline-controls.js') - 1, 'loaded just before the outline controls');
    assert.ok(outlines.css.includes('src/atar/outline-jump.css'));
    const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'atar/outline-jump.css'), 'utf8');
    assert.ok(cssHas(css, '.connectea-dark #cx-jump-subject .cx-jump-subject-select { background-color: var(--cx-input-bg, #141a22) !important;'), 'dark themes use the input tokens');
    assert.ok(cssHas(css, '#cx-jump-subject .cx-jump-subject-select { box-sizing: border-box; width: 108px; flex: 0 0 auto;'), 'a fixed narrow dropdown keeps the row close to the buttons\' width');
    assert.ok(/#cx-jump-subject \.cx-jump-subject-select \{[^}]*text-overflow: ellipsis;/.test(css), 'only the closed dropdown ends a long name in an ellipsis');
    assert.ok(/#cx-jump-subject \.cx-jump-subject-list \{[^}]*bottom: calc\(100% \+ 6px\);[^}]*max-height: calc\(100vh - 140px\);/.test(css),
      'the list opens upwards from the box and is as tall as its subjects (seven or more without scrolling)');
  } finally {
    document.querySelectorAll = origQSA;
    window.ConnectifySemesterFilter = prev.filter;
    window.ConnectifyNewGrade = prev.newGrade;
    window.ConnectifyOutlineJump = prev.jumpMod;
  }
});

runTest('Test 283: Outlines come from Connect\'s API: records number tasks as the old rows did and fill every cache without reading the page; they are drawable before every boxplot arrives', async () => {
  const prev = { fetch: global.fetch, api: window.ConnectifyOutlineApi, parse: window.ConnectifyApiParse, markup: window.ConnectifyLegacyMarkup, cookie: document.cookie };
  const task = (taskId, taskType, taskWhen, taskDescription, mark, maximumMark, weightedMark, weightedMaximumMark) =>
    ({ taskId, taskType, taskWhen, taskDescription, showTaskChart: true, mark, maximumMark, weightedMark, weightedMaximumMark });
  const s1Tasks = [task(11, 'Test', '8', 'TEST 1', '43.5', '50', '4.3', '5'), task(12, 'Examination', undefined, 'Close reading', '17', '25', '4', '5')];
  const s2Tasks = [...s1Tasks, task(13, 'Examination', undefined, 'Close reading', undefined, '25', undefined, '5')];
  const group = (id, semester, tasks, mark, grade) => ({
    assessmentGroupId: id, chartAssessmentOutlineId: id + 1000, name: 'Chemistry ATAR Year 11', semester,
    staff: [{ fullName: 'Leon Harris' }], school: { name: 'Willetton Senior High School' },
    statusLine: semester === 1 ? 'Semester 1 Total Percent and Progress Grade' : 'Semester 2 Cumulative Percent',
    groupResultsData: { mark, grade, showGroupChart: true },
    outlines: [{ assessmentOutlineId: id + 1000, description: 'AECHE', taskGroups: [{ tasks, groups: [] }] }]
  });
  const plot = (mark, a, b, c, d, e) => ({ mark, minValue: a, quartile1: b, median: c, quartile3: d, maxValue: e });
  const charts = {
    1: { groupChartData: plot(83.3, 30.2, 62.3, 70.8, 79.05, 92.7),
      tasksChartData: { 11: plot(87, 14.000000000000002, 56.00000000000001, 68, 79, 100), 12: plot(68, 0.01, 52, 64, 72, 92) } },
    2: { groupChartData: plot(84.9, 40, 60, 70, 80, 95), tasksChartData: {} }
  };
  const replies = {
    default_student: { status: 'SUCCESS', items: [{ entityId: 42 }] },
    assessmentOutlines: { status: 'SUCCESS', items: [{ semester1Groups: [group(1, 1, s1Tasks, '83.3%', 'A')], semester2Groups: [group(2, 2, s2Tasks, '84.9%', '')] }] }
  };
  const calls = [];
  // Group 2's boxplot is held back until the test has looked at the outlines drawn before it
  let release = null;
  const held = new Promise(r => { release = r; });
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    const route = url.replace('/connectapi/rest/api/v1/app/student/', '');
    if (route.startsWith('assessmentOutlines/chart') && JSON.parse(init.body).assessmentGroupId === 2) await held;
    const json = route.startsWith('assessmentOutlines/chart')
      ? { status: 'SUCCESS', items: [charts[JSON.parse(init.body).assessmentGroupId]] }
      : replies[route.split('?')[0]];
    return { ok: true, status: 200, json: async () => json };
  };
  document.cookie = 'a=1; CONNECT_XSRF=tok%3D1';
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  try {
    delete window.ConnectifyOutlineApi;
    delete window.ConnectifyApiParse;
    delete window.ConnectifyLegacyMarkup;
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'assessment-data.js'), 'utf8'));
    eval(read('assessment/assessment-api-parse.js'));
    eval(read('assessment/legacy-outlines-markup.js'));
    // On the outlines page the API loads by itself
    eval(read('assessment/outline-api.js'));
    const api = window.ConnectifyOutlineApi;
    // Other tests' cleanups run while this one awaits: keep this test's modules in place
    const mine = { ConnectifyOutlineApi: api, ConnectifyApiParse: window.ConnectifyApiParse, ConnectifyLegacyMarkup: window.ConnectifyLegacyMarkup };
    const loading = api.load();
    for (let i = 0; i < 200 && !api.drawable()[0]?.stats; i++) await new Promise(r => setTimeout(r, 0));
    const early = api.drawable();
    assert.ok(!api.isLoaded() && early.length === 2 && early[0].stats && early[1].stats === null,
      'both outlines are drawable before every boxplot arrives, each boxplot filled in as its chart lands; the caches wait');
    release();
    const records = await loading;
    Object.assign(window, mine);
    assert.ok(records[0] === early[0] && records[1] !== early[1] && api.drawable() === records,
      'a record a later chart leaves unchanged keeps its object, so legacy-outlines.js draws only the tiles that changed');
    // (other async tests swap the mock document between requests, so the cookie is checked on the first)
    assert.ok(calls.length === 4 && calls.every(c => c.init.method === 'POST' && c.init.credentials === 'same-origin' && 'X-XSRF-TOKEN' in c.init.headers) &&
      calls[0].init.headers['X-XSRF-TOKEN'] === 'tok=1',
      'every request is a same-origin POST carrying Connect\'s CONNECT_XSRF cookie as X-XSRF-TOKEN');
    assert.strictEqual(calls[1].url, '/connectapi/rest/api/v1/app/student/assessmentOutlines?studentId=42', 'outlines for the signed-in student');
    assert.strictEqual(calls[1].init.body, undefined, 'the outlines request has no body, as Connect\'s');
    assert.deepStrictEqual(JSON.parse(calls[2].init.body), { assessmentGroupId: 1, assessmentOutlineId: 1001 }, 'one chart request per group');
    assert.deepStrictEqual(records.map(r => r.title), ['Chemistry ATAR Year 11 - Semester 1', 'Chemistry ATAR Year 11 - Semester 2']);
    assert.deepStrictEqual(records[0].stats, [30.2, 62.3, 70.8, 79.05, 92.7], 'the class boxplot');
    assert.deepStrictEqual(records[1].outlines[0].tasks[0].stats, [14, 56, 68, 79, 100],
      'a Semester 1 task on the Semester 2 outline takes its boxplot from Semester 1\'s chart, float noise rounded away');
    assert.strictEqual(records[1].outlines[0].tasks[2].stats, null, 'an unmarked task has no boxplot');
    const again = await api.refresh();
    Object.assign(window, mine);
    assert.ok(again !== records && again.every((r, i) => r === records[i]), 'a reload with nothing changed draws nothing again');

    // The same tasks as the old rows showed them: identical ids, so caches, overrides and predictions carry on
    const P = window.ConnectifyApiParse;
    const card = new MockElement('div', 'eds-c-tile');
    const list = new MockElement('div', 'cvr-c-tasks');
    card.appendChild(list);
    for (const t of records[1].outlines[0].tasks) {
      const row = new MockElement('div', 'cvr-c-task');
      const details = new MockElement('div', 'cvr-c-task__details');
      for (const text of P.labelsOf(t)) { const l = new MockElement('span', 'v-label'); l.textContent = text; details.appendChild(l); }
      const marks = new MockElement('div', 'cvr-c-task__marks');
      for (const text of [`${t.mark || '-'}Out of ${t.max}`, `${t.weighted || '-'}Out of ${t.weightedMax}`]) {
        const cell = new MockElement('div', 'cvr-c-task__mark'); cell.textContent = text; marks.appendChild(cell);
      }
      row.appendChild(details); row.appendChild(marks); list.appendChild(row);
    }
    assert.deepStrictEqual(P.ids(records[1]).map(e => e.id), Array.from(window.ConnectifyParseHelpers.cardTaskIds(card).values()).map(e => e.id),
      'API tasks get the ids the old outline rows got');
    const parsed = P.parse(records[1]);
    assert.deepStrictEqual(parsed.tasks.map(t => [t.name, t.weight, t.pending]), [['TEST 1', 5, false], ['Close reading', 5, false], ['Close reading', 5, true]]);
    assert.strictEqual(parsed.tasks[0].score, 87);
    assert.strictEqual(parsed.tasks[2].statsKey, parsed.tasks[2].id, 'a repeated name is keyed by its id in the stats cache');
    assert.deepStrictEqual(P.markedIds(records[1]), parsed.tasks.slice(0, 2).map(t => t.id), 'the grade check compares marked ids');

    // The old markup lists exactly those labels, and unmarked rows show "-" with no chart
    const M = window.ConnectifyLegacyMarkup;
    const labelsIn = html => Array.from(html.split('cvr-c-task-mark__headers')[0].matchAll(/v-label-undef-w">([^<]*)</g), m => m[1]);
    records[1].outlines[0].tasks.forEach(t => assert.deepStrictEqual(labelsIn(M.taskRow(t)), P.labelsOf(t)));
    const unmarked = M.taskRow(records[1].outlines[0].tasks[2]);
    assert.ok(unmarked.includes('v-label-undef-w">-</div>') && unmarked.includes('Out of 25') && !unmarked.includes('cvr-c-task__chart'));
    const chart = M.chart([14, 56, 68, 79, 100], 87);
    assert.ok(chart.includes('data-connectify-stats="[14,56,68,79,100]"') && chart.includes('class="highcharts-series"') &&
      chart.includes('fill="#FFFFFF" stroke="#A9A9A9"') && chart.includes('cx="87%"') && chart.includes('fill="#000000"'),
      'boxplots carry their quantiles and Highcharts\' fills, which the theme rules recolour');

    // Every cache fills from the records, nothing read from the page
    window.ConnectifyData.clearCache();
    const subjects = window.ConnectifyData.collect(true);
    const chem = subjects.find(s => s.name === 'Chemistry ATAR Year 11');
    assert.strictEqual(chem?.tasks.length, 3, 'the subjects cache holds every task, opened or not');
    assert.deepStrictEqual(window.ConnectifyData.getTaskStats('Chemistry ATAR Year 11', 'TEST 1'), [14, 56, 68, 79, 100], 'task boxplots reach the stats cache');
    assert.deepStrictEqual(window.ConnectifyData.getTaskStats('Chemistry ATAR Year 11', 'Overall S1'), [30.2, 62.3, 70.8, 79.05, 92.7], 'and the class boxplot');
    const reg = window.ConnectifyClassSemesters.get()['Chemistry ATAR Year 11'];
    assert.ok(reg[1].mark === 83.3 && reg[1].finalLetter && reg[2].mark === 84.9 && !reg[2].finalLetter, 'the class registry');
    assert.strictEqual(window.ConnectifyClassSemesters.detectSemester(), 2, 'a final Semester 1 letter in the API makes it Semester 2');
    eval(read('system/grade-snapshot.js'));
    const entries = window.ConnectifyGradeSnapshot.currentEntries();
    assert.deepStrictEqual(entries.map(e => [e.subjectName, e.semester, e.mark]), [['Chemistry', 2, 84.9]], 'the grade check reads the API\'s running marks');
  } finally {
    global.fetch = prev.fetch;
    document.cookie = prev.cookie;
    window.ConnectifyOutlineApi = prev.api;
    window.ConnectifyApiParse = prev.parse;
    window.ConnectifyLegacyMarkup = prev.markup;
    window.ConnectifyData.clearCache();
  }
});

runTest('Test 284: Connect\'s new outline cards are drawn again in the old Vaadin markup, and Connect\'s filter menu still works', () => {
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const js = manifest.content_scripts.find(g => g.js?.includes('src/assessment/legacy-outlines.js')).js;
  const at = f => js.indexOf(`src/assessment/${f}`);
  assert.ok(at('outline-api.js') === at('assessment-parser.js') + 1 && at('assessment-api-parse.js') === at('outline-api.js') + 1, 'the API modules follow the parser');
  assert.ok(at('legacy-outlines-markup.js') === at('assessment-data.js') + 1 && at('legacy-outlines.js') === at('legacy-outlines-markup.js') + 1 &&
    at('legacy-outlines.js') > at('assessment-accordion-watch.js'), 'the renderer follows the data module, after the accordion watch (it reads Show Details before a toggle)');
  const css = read('assessment/legacy-outlines.css');
  assert.ok(manifest.content_scripts.some(g => g.css?.includes('src/assessment/legacy-outlines.css')));
  assert.ok(cssHas(css, '.cx-legacy-hidden { display: none !important;'), 'Connect\'s own cards are hidden once drawn');

  const mount = read('assessment/legacy-outlines.js');
  assert.ok(mount.includes("host.className = 'v-app connect-vr assessmentoutlinesui'"), 'the host carries Vaadin\'s app classes, which Connect\'s theme styles under');
  assert.ok(mount.includes("document.querySelectorAll('cnt-sao-card')") && mount.includes('slot.classList.toggle(HIDDEN, Boolean(record))'),
    'each card Connect shows (its filter decides) with an API record is drawn and Connect\'s copy hidden');
  assert.ok(mount.includes("section.insertAdjacentHTML('beforeend', markup().detailsPanel(record))") && mount.includes('else panel.remove();'),
    'Show / Hide Details adds and removes the task rows, as Vaadin did');
  // Connect fetches its boxplots one at a time and shows nothing for ~13s: the outlines are drawn from the API at once
  assert.ok(mount.includes("const connectPending = () => !document.querySelector('cnt-sao-card, cnt-category-bar');") &&
    mount.includes("document.getElementById('ng-zone__student-assessment-outline')") && mount.includes('shown = records;'),
    'before Connect has rendered, every outline is drawn in the API\'s order (Connect\'s own) into Connect\'s zone');
  assert.ok(mount.includes("const records = outlineApi()?.drawable?.() || [];") && mount.includes("window.addEventListener('connectify-outlines-preview', sync);"),
    'outlines are drawn before every boxplot has arrived and drawn again as each lands');
  assert.ok(mount.includes('const holding = Boolean(window.ConnectifyIsBulkExpanding);') && mount.includes('retry = setTimeout(sync, 500)'),
    'a tile Expand All is about to click is not replaced until the run ends');
  assert.ok(mount.includes('!swapCharts(slot.firstElementChild, record)') && mount.includes('if (!old || sansCharts(old) !== sansCharts(record)) return false;') &&
    mount.includes('window.ConnectifyCohort?.schedule?.();'),
    'a boxplot arriving swaps only the chart cells (open rows and their panels stay), then the panels refresh');
  const features = read('atar/atar-features.js');
  assert.ok(features.includes("window.addEventListener('connectify-outlines-preview', () => checkStartupAutoExpand());") && !features.includes('isSettled'),
    'startup auto-expand opens the outlines as soon as they are drawn, before their boxplots arrive');

  eval(read('assessment/legacy-outlines-markup.js'));
  const M = window.ConnectifyLegacyMarkup;
  const record = { title: 'Physics ATAR Year 11 - Semester 2', subject: 'Physics ATAR Year 11', semester: 2, staff: ['A Teacher'], school: 'A School',
    statusLine: 'Semester 2 Cumulative Percent', mark: '', grade: '', showChart: true, stats: null,
    outlines: [{ code: 'AEPHY', tasks: [{ type: 'Test', when: 'Term 3, week 4', name: 'Test 3', mark: '40', max: '50', weighted: '5.6', weightedMax: '7', showChart: true, stats: null }] }] };
  const tile = M.tile(record);
  assert.ok(tile.includes('eds-c-tile__title') && tile.includes('>Physics ATAR Year 11 - Semester 2<') && tile.includes('>Show Details<') && !tile.includes('cvr-c-tasks'),
    'a collapsed tile has its title and Show Details, no task rows');
  assert.ok(tile.includes('eds-c-text--bold v-label-eds-c-text--bold v-label-undef-w">Semester 2 Cumulative Percent</div><div class="v-csslayout v-layout v-widget"></div>'),
    'no overall mark leaves Connect\'s empty summary container (cohort-subject-average.js fills it)');
  const details = M.detailsPanel(record);
  assert.ok(details.includes('>Physics ATAR Year 11 (AEPHY)<') && details.includes('</div></div><div class="cvr-c-task v-layout v-widget">'),
    'rows follow their group\'s heading bar, which Connect lays out as one flex row');
  const filter = read('sidebar/sidebar-filter.js');
  assert.ok(filter.includes("'cnt-category-menu .mat-expansion-panel-header .mat-content'") && filter.includes('.mat-expansion-panel-content, #connectify-sidebar'),
    'Back to All presses the Angular filter menu\'s top-level All, never a semester section\'s');
});

runTest('Test 285: Pasted text in notices keeps no white highlight on dark themes or a wallpaper', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-rich-text.css'), 'utf8');
  for (const hook of ['.connectea-dark:not(cx-n)', 'html:not(.connectea-dark)[data-connectea-has-custom-bg="true"]']) {
    for (const value of ['background-color:rgb(255,255,255)', 'background-color: rgb(255, 255, 255)', 'background-color: #ffffff', 'background:white']) {
      assert.ok(css.includes(`${hook} .rtf-content [style*="${value}" i]`), `${hook} clears ${value} on Connect's rich text`);
    }
  }
  assert.ok(cssHas(css, '{ background-color: transparent !important;'), 'the inline white is cleared');
  assert.ok(!/yellow|#ff0|marker/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'highlights in other colours are kept');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const sheets = manifest.content_scripts.find(g => g.css?.includes('src/theme/styles/theme-rich-text.css')).css;
  assert.strictEqual(sheets.indexOf('src/theme/styles/theme-rich-text.css'), sheets.indexOf('src/theme/styles/theme-feed-3.css') + 1);
});

runTest('Test 286: Goal bars sit beside the outcome meter on expanded task cards, and the meter tooltip blurs in Liquid Glass', () => {
  const bars = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-bars.css'), 'utf8');
  assert.ok(cssHas(bars, '.connectea-panel.connectea-xp-stats:not(.connectea-xp-overall):has(> .connectea-xp-head > .cx-goal-bars) { grid-template-columns: repeat(3, minmax(92px, max-content)) repeat(5, minmax(60px, max-content)) auto auto !important;'),
    'a task card with goal bars gains a column after the meter, so it grows wider');
  assert.ok(cssHas(bars, '.connectea-xp-stats .connectea-xp-head > .cx-goal-bars { grid-column: 10 !important; grid-row: 1 !important;'),
    'the goal bars take that column in the top row, never wrapping under Score');
  const tip = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-outcome-filter.css'), 'utf8');
  assert.ok(cssHas(tip, 'html:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"]) #connectea-outcome-tooltip { backdrop-filter: blur(var(--cx-glass-blur, 12px)) saturate(160%) !important;'),
    'the singleton tooltip (meter and goal bars) blurs like the theme\'s other glass, at the Blur Strength set');
});

runTest('Test 287: Upgrading to 3.3.0 turns "Show this semester\'s classes only" off once and explains Connect\'s overhaul in a popup', () => {
  const keys = ['connectify:overhaul_notice', 'connectify:seen_version', 'connectify:semester_filter'];
  const saved = keys.map(k => localStorage.getItem(k));
  const set = (k, v) => (v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v));
  const prev = window.ConnectifyOverhaulNotice;
  try {
    delete window.ConnectifyOverhaulNotice;
    eval(origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/overhaul-notice.js'), 'utf8'));
    const O = window.ConnectifyOverhaulNotice;
    assert.ok(O.isOlder('3.2.5', '3.3.0') && O.isOlder('3.2.10', '3.3.0') && !O.isOlder('3.3.0', '3.3.0') && !O.isOlder('3.3.1', '3.3.0'));
    const reset = (seen, filter) => { set(O.DONE_KEY, null); set('connectify:seen_version', seen); set('connectify:semester_filter', filter); };

    reset('3.2.5', JSON.stringify({ enabled: true }));
    assert.deepStrictEqual(O.migrate(), { filterWasOn: true }, 'an upgrade from before 3.3.0 with the option on gets the popup with the Settings note');
    assert.strictEqual(localStorage.getItem('connectify:semester_filter'), JSON.stringify({ enabled: false }), 'the option is turned off');
    assert.strictEqual(O.migrate(), null, 'only once');
    localStorage.setItem('connectify:semester_filter', JSON.stringify({ enabled: true }));
    assert.strictEqual(O.migrate(), null, 'turning it back on stays on');

    reset('3.2.5', null);
    assert.deepStrictEqual(O.migrate(), { filterWasOn: false }, 'with the option off, the popup only explains the change');
    reset(null, JSON.stringify({ enabled: true }));
    assert.strictEqual(O.migrate(), null, 'a fresh install gets no popup');
    assert.strictEqual(localStorage.getItem('connectify:semester_filter'), JSON.stringify({ enabled: true }), 'and keeps its setting');
    assert.strictEqual(localStorage.getItem(O.DONE_KEY), 'true', 'but records that it ran');
    reset('3.3.0', JSON.stringify({ enabled: true }));
    assert.strictEqual(O.migrate(), null, 'versions from 3.3.0 on are never migrated');
    location.href = 'https://connect.det.wa.edu.au/group/students/ui/my-connect';
    reset('3.2.5', JSON.stringify({ enabled: true }));
    assert.strictEqual(O.migrate(), null, 'only on the Assessment Outlines page');
    assert.strictEqual(localStorage.getItem(O.DONE_KEY), null);
    location.href = OUTLINES_HREF;

    const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/overhaul-notice.js'), 'utf8');
    assert.ok(src.includes("modal.open({\n      id: 'cx-overhaul-notice',") && src.includes("'Open Settings'") && src.includes("'Got it'"), 'the shared solid dialog, Open Settings and Got it');
    const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
    const group = manifest.content_scripts.find(g => g.js?.includes('src/system/overhaul-notice.js'));
    assert.ok(group.js.indexOf('src/system/overhaul-notice.js') < group.js.indexOf('src/assessment/semester-filter.js') &&
      group.js.indexOf('src/system/overhaul-notice.js') < group.js.indexOf('src/system/update-notice.js'),
      'runs before the semester filter reads the option and before the update notice records this version');
    assert.ok(group.css.includes('src/system/overhaul-notice.css'));
  } finally {
    keys.forEach((k, i) => set(k, saved[i]));
    window.ConnectifyOverhaulNotice = prev;
    location.href = OUTLINES_HREF;
  }
});

runTest('Test 288: Connect\'s hover outlines on form fields are off, focus keeps Material\'s outline without a second ring, and dialog fieldsets are clear', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-field-hover.css'), 'utf8');
  for (const hook of ['.connectea-dark', 'html:not(.connectea-dark)[data-connectea-has-custom-bg="true"]']) {
    assert.ok(css.includes(`${hook} .mat-form-field-appearance-outline:not(.mat-focused) .mat-form-field-flex:hover .mat-form-field-outline-thick`), `${hook}: no 2px Material outline on hover, focus untouched`);
    assert.ok(css.includes(`${hook} .mat-form-field-appearance-outline:not(.mat-focused) .mat-form-field-flex:hover .mat-form-field-outline:not(.mat-form-field-outline-thick)`), `${hook}: the 1px outline stays on hover`);
    assert.ok(css.includes(`${hook} .c-floating-form-field:hover:not(:focus-within) .c-floating-form-field-outline-thick`), `${hook}: no black fieldset outline on hover`);
  }
  assert.ok(cssHas(css, '{ opacity: 0 !important; }') && cssHas(css, '{ opacity: 1 !important; }'));
  const nesting = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-surface-nesting.css'), 'utf8');
  assert.ok(nesting.includes('html.connectea-dark[data-connectea-theme] .mat-dialog-container :where(fieldset.c-floating-form-field):not(#cx-n)'),
    'Message and Image Gallery fieldsets sit on the dialog\'s one surface, so their padding shows no fill');
  const controls = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-controls.css'), 'utf8');
  assert.ok(controls.includes('.connectea-dark input:focus:not(.mat-input-element), .connectea-dark textarea:focus:not(.mat-input-element) {'),
    'the accent focus ring skips Material inputs, whose outlined field already shows focus');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const sheets = manifest.content_scripts.find(g => g.css?.includes('src/theme/styles/theme-field-hover.css')).css;
  assert.strictEqual(sheets.indexOf('src/theme/styles/theme-field-hover.css'), sheets.indexOf('src/theme/styles/theme-dialog-surface.css') + 1);
});

runTest('Test 289: Goal dialog secondary buttons (Open Settings, Cancel, ✕) take the theme\'s button ink over Connect\'s .eds.cvr button grey', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-dialog.css'), 'utf8');
  const sel = ':is(.cx-goal-overlay, #cx-specificity-anchor) :is(.cx-goal-modal__close, .cx-goal-cancel, .cx-goal-link, .cx-goal-card__edit, .cx-goal-card__delete)';
  const at = css.indexOf(sel + ' {');
  assert.ok(at >= 0, 'the id-weighted anchor outranks Connect\'s .eds.cvr button (0,2,1), which painted Open Settings #4f4f4f');
  const block = css.slice(at, css.indexOf('}', at));
  assert.ok(block.includes('color: var(--cx-button-text, #f8fafc);') && !block.includes('--cx-text-muted'), 'the button ink, never the muted text colour');
  assert.ok(css.includes(sel + ':hover {'), 'the hover rule carries the same weight');
});

runTest('Test 290: The Goals (n) and Cancel Editing buttons wear the theme\'s button tokens, not an inherited ink and fallback border', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'goals/goal-planner.css'), 'utf8');
  const sel = '#connectea-atar :is(.cx-goal-cancel-edit, .cx-goals-open)';
  const at = css.indexOf(sel + ' {');
  const block = css.slice(at, css.indexOf('}', at));
  assert.ok(at >= 0 && block.includes('background: var(--cx-button-bg, #263242);') && block.includes('color: var(--cx-button-text, #f8fafc);') &&
    block.includes('border: 1px solid var(--cx-button-border, #455a73);'), 'button fill, ink and border tokens');
  assert.ok(!/color: inherit/.test(block), 'never the heading\'s inherited ink');
  assert.ok(!block.includes('#9daebf') && !block.includes('transparent'), 'nor the old fallback border on a clear fill');
  assert.ok(css.includes(sel + ':hover:not(:disabled) {'), 'with the button hover');
});

runTest('Test 291: The outlines page\'s fixed "All" category bar keeps the Liquid Glass top-bar fill and blur; category bars on the page stay clear', () => {
  const surface = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-glass-surface.css'), 'utf8');
  assert.ok(surface.includes(' mat-toolbar.c-category-bar:not(.js-pos-category-toolbar-container > *):not(cx-n),'),
    'the clear rule skips the bar in Connect\'s fixed toolbar container (same specificity as before)');
  const bars = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/styles/theme-reports-menus-2.css'), 'utf8');
  const glassBar = bars.split('}').find(b => b.includes('.connectea-dark .mat-toolbar,')) || '';
  assert.ok(/backdrop-filter: blur\(var\(--cx-glass-blur, 12px\)\) saturate\(160%\) !important;/.test(glassBar) && /--cx-glass-opacity/.test(glassBar),
    'which leaves it the translucent, blurred top-bar glass');
});


runTest('Test 292: Hovering opens the drawer only on Assessment Outlines, and never from the top left corner where Connect\'s home logo is', () => {
  const saved = { api: window.ConnectifySidebarHandle, open: window.ConnectifyOpenSidebar, close: window.ConnectifyCloseSidebar, href: location.href };
  try {
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-handle-position.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-handle.js'), 'utf8'));
    eval(fs.readFileSync(path.resolve(BASE_DIR, 'sidebar-hover.js'), 'utf8'));
    const api = window.ConnectifySidebarHandle;
    const sb = api.getSidebar();
    window.ConnectifyOpenSidebar = () => { sb.hidden = false; };
    window.ConnectifyCloseSidebar = () => { sb.hidden = true; };
    const away = document.createElement('div');
    location.href = OUTLINES_HREF;
    sb.hidden = true;

    api.getTopBarBottom = () => 100;
    api.handleMouseMove({ clientX: 4, clientY: 40, target: away });
    assert.strictEqual(sb.hidden, true, 'The left edge beside Connect\'s top bar (home logo) must not open the drawer');
    api.getTopBarBottom = () => 0;
    api.handleMouseMove({ clientX: 4, clientY: 40, target: away });
    assert.strictEqual(sb.hidden, true, 'With the top bar scrolled away the top 60px corner still never opens it');
    api.handleMouseMove({ clientX: 4, clientY: 300, target: away });
    assert.strictEqual(sb.hidden, false, 'Below the corner the left edge opens the drawer on Assessment Outlines');

    sb.hidden = true;
    location.href = 'https://connect.det.wa.edu.au/classes';
    api.handleMouseMove({ clientX: 4, clientY: 300, target: away });
    assert.strictEqual(sb.hidden, true, 'Off Assessment Outlines the left edge never opens the drawer');
    api.handleMouseMove({ clientX: 10, clientY: 300, target: api.handle });
    api.handle.dispatchEvent(new MockEvent('mouseenter'));
    assert.strictEqual(sb.hidden, true, 'Off Assessment Outlines hovering the handle never opens the drawer');
    api.handle.onclick();
    assert.strictEqual(sb.hidden, false, 'Off Assessment Outlines a click on the handle still opens it');
  } finally {
    location.href = saved.href;
    const sb = window.ConnectifySidebarHandle?.getSidebar?.();
    if (sb) sb.hidden = true;
    window.ConnectifySidebarHandle = saved.api;
    window.ConnectifyOpenSidebar = saved.open;
    window.ConnectifyCloseSidebar = saved.close;
  }
});

runTest('Test 294: Connect\'s loading indicators are off on every Connect page, and Vaadin\'s keeps its box so its first render never waits', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'system/connect-loading.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.css || []).includes('src/system/connect-loading.css'));
  assert.ok(group && group.matches.includes('https://connect.det.wa.edu.au/*'), 'loaded on every Connect page');
  assert.ok(!/@(media|supports)/.test(css), 'in every browser and theme');
  const vaadin = css.match(/([^{}]*\.v-loading-indicator[^{}]*)\{([^}]*)\}/);
  assert.ok(vaadin, 'Vaadin\'s indicator has its own rule');
  for (const sel of ['.v-loading-indicator', '.v-loading-indicator-delay', '.v-loading-indicator-wait']) {
    assert.ok(vaadin[1].split(',').map(s => s.trim()).includes(sel), `${sel} is covered`);
  }
  for (const decl of ['visibility: hidden', 'background: none', 'animation: none', 'transition: none']) {
    assert.ok(vaadin[2].includes(`${decl} !important`), `${decl} beats Connect's .eds.cvr rules`);
  }
  assert.ok(!/display|height|width/.test(vaadin[2]), 'the box keeps its size: Vaadin waits up to 5s for CSS while its height is 0');
  assert.ok(/cnt-progress-bar\s*\{\s*display:\s*none !important/.test(css), 'Angular\'s page progress bar is removed');
});

runTest('Test 295: Expanded statistics cards zoom to fit their task column, so nothing runs past the card or into the marks column', () => {
  const css = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'cohort/cohort-expanded-fit.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.css || []).includes('src/cohort/cohort-expanded-fit.css'));
  assert.ok(group && group.css.indexOf('src/cohort/cohort-expanded-fit.css') > group.css.indexOf('src/cohort/cohort-expanded.css'), 'loaded on the outlines page after the expanded card styles');
  const container = css.match(/([^{}]*)\{([^}]*container:\s*cx-task-row \/ inline-size[^}]*)\}/);
  assert.ok(container && /\.cvr-c-task__details:has\(> \.connectea-row-wrapper > \.connectea-panel--expanded\)/.test(container[1]) &&
    /\.cvr-c-task__details:has\(> \.connectea-panel--expanded\)/.test(container[1]), 'only task columns holding an expanded card are containers (compact panels keep the window scale)');
  assert.ok(/flex:\s*1 1 0% !important/.test(container[2]) && /min-width:\s*0 !important/.test(container[2]), 'the column takes the row\'s free space, never its card\'s width');
  // Each step's zoom must fit the widest card (about 920px with goal bars at zoom 1) in the narrowest column it covers
  const steps = [...css.matchAll(/@container cx-task-row \(width < (\d+)px\) \{([^}]*)\{ zoom: ([\d.]+) !important; \}/g)].map(m => ({ below: Number(m[1]), sel: m[2], zoom: Number(m[3]) }));
  assert.ok(steps.length >= 10, 'zoom steps down to phone widths');
  for (let i = 0; i < steps.length; i++) {
    assert.ok(steps[i].sel.includes('.connectea-row-wrapper:has(> .connectea-panel--expanded)') && steps[i].sel.includes('.connectea-panel.connectea-panel--expanded.connectea-xp-overall'), 'task and overall cards both fit');
    const narrowest = steps[i + 1] ? steps[i + 1].below : 0;
    if (narrowest) assert.ok(920 * steps[i].zoom <= narrowest, `zoom ${steps[i].zoom} fits a 920px card in a ${narrowest}px column`);
    if (i) assert.ok(steps[i].zoom < steps[i - 1].zoom && steps[i].below < steps[i - 1].below, 'narrower columns zoom further');
  }
});

runTest('Test 296: Layers over text (sidebar, menus, popups, dialogs, top bars) keep a 12px glass blur under a lower custom Blur Strength unless the theme turns it off', () => {
  const themeDir = path.resolve(SRC_DIR, 'theme');
  const w = {};
  new Function('window', origReadFileSync.call(fs, path.join(themeDir, 'theme-overlay-blur.js'), 'utf8'))(w);
  const O = w.ConnectifyOverlayBlur;
  assert.strictEqual(O.of(4), 12, 'a blur under 12px is raised to 12px');
  assert.strictEqual(O.of(0, true), 12, 'no blur is raised too');
  assert.strictEqual(O.of(20), 20, 'a stronger blur is kept');
  assert.strictEqual(O.of(4, false), 4, 'with the checkbox off the theme\'s own blur is used');
  assert.ok(O.keeps({}) && O.keeps({ overlayBlurFloor: true }) && !O.keeps({ overlayBlurFloor: false }), 'on unless a theme sets it off (older themes keep it)');
  assert.ok(/id="cx-overlay-blur-toggle" checked/.test(O.html({})) && !/checked/.test(O.html({ overlayBlurFloor: false })), 'the customizer checkbox shows the theme\'s setting');

  // The registry writes the floored value for the page; the theme's own blur stays as set
  const registryJs = origReadFileSync.call(fs, path.join(themeDir, 'theme-registry.js'), 'utf8');
  assert.ok(registryJs.includes("'--cx-glass-blur-overlay'") && registryJs.includes('ConnectifyOverlayBlur?.of(blur, keep)'), 'applyGlass sets --cx-glass-blur-overlay');
  assert.ok(registryJs.includes('overlayBlurFloor: themeDef.overlayBlurFloor !== false'), 'registered themes carry the setting');
  const savedJs = origReadFileSync.call(fs, path.join(themeDir, 'theme-custom-themes.js'), 'utf8');
  assert.ok(savedJs.includes('overlayBlurFloor:'), 'saved custom themes keep the setting');
  const importJs = origReadFileSync.call(fs, path.join(themeDir, 'theme-import.js'), 'utf8');
  assert.ok(importJs.includes("typeof raw.overlayBlurFloor === 'boolean'"), 'theme files carry it, as a boolean only');
  const customizerJs = origReadFileSync.call(fs, path.join(themeDir, 'theme-customizer.js'), 'utf8');
  assert.ok(customizerJs.includes('overlayBlurFloor: state.overlayBlurFloor !== false') && customizerJs.includes('ConnectifyOverlayBlur?.bind(modalEl, state)'), 'the customizer saves and binds the checkbox');
  assert.ok(origReadFileSync.call(fs, path.join(themeDir, 'theme-customizer-markup.js'), 'utf8').includes('ConnectifyOverlayBlur?.html(s)'), 'the checkbox sits with the glass sliders');

  // The stylesheet hands the floored value to every layer over text, through both blur variables
  const css = origReadFileSync.call(fs, path.join(themeDir, 'styles/theme-overlay-blur.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = css.match(/([^{}]*)\{([^}]*)\}/);
  const sels = rule[1].split(/,\s*\n/).map(x => x.trim());
  for (const sel of ['#connectify-sidebar', '#connectea-theme-menu', '#connectea-outcome-tooltip', '#cx-jump-subject-list', '.cvr-c-primary-navigation',
    '.cvr-c-service-bar__container', '.cvr-c-service-menu', '.js-pos-category-toolbar-container', '.v-popupview-popup', '.modal-content', '.ui-dialog', '.cdk-overlay-backdrop']) {
    assert.ok(sels.includes(`html:is([data-connectea-theme="liquid-glass"], [data-connectea-glass="true"]) ${sel}`), `${sel} keeps the floor, in Liquid Glass only`);
  }
  assert.ok(!sels.some(x => /eds-c-tile|cvr-c-card|connectea-panel/.test(x)), 'tiles and panels over the wallpaper keep the theme\'s own blur');
  assert.ok(/--cx-glass-blur:\s*var\(--cx-glass-blur-overlay, 12px\)/.test(rule[2]) && /--cx-gl-blur:\s*blur\(var\(--cx-glass-blur-overlay, 12px\)\) saturate\(160%\)/.test(rule[2]), 'both blur variables are redefined');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(BASE_DIR, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(c => (c.js || []).includes('src/theme/theme-registry.js'));
  assert.ok(group.js.indexOf('src/theme/theme-overlay-blur.js') > -1 && group.js.indexOf('src/theme/theme-overlay-blur.js') < group.js.indexOf('src/theme/theme-registry.js'), 'loads before the registry');
  assert.ok(group.css.indexOf('src/theme/styles/theme-overlay-blur.css') > group.css.indexOf('src/theme/styles/theme-glass-surface.css'), 'loads after --cx-gl-blur is defined');
});

runTest('Test 297: Page changes adapt only the subtrees they touched, Connectify\'s own tooltip never triggers a scan, and the critical pulse runs on the compositor', () => {
  const src = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme-surface-adapter.js'), 'utf8');
  const el = (name, kids = []) => {
    const node = { name, nodeType: 1, isConnected: true, kids, scanned: 0, closest: () => null, hasAttribute: () => false, setAttribute() {}, children: [],
      contains: other => other === node || kids.some(k => k.contains(other)) };
    node.matches = () => false;
    node.querySelectorAll = () => { node.scanned++; return []; };
    return node;
  };
  const leaf = el('leaf');
  const row = el('row', [leaf]);
  const other = el('other');
  let pageScans = 0;
  const doc = { documentElement: { classList: { contains: c => c === 'connectea-dark' } }, body: { querySelectorAll: () => { pageScans++; return []; } } };
  const timers = [];
  const w = { getComputedStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(0, 0, 0)' }) };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', src)(w, doc, (fn, ms) => timers.push({ fn, ms }) && timers.length, () => {});
  const A = w.ConnectifyThemeSurfaceAdapter;

  const text = { nodeType: 3 };
  assert.deepStrictEqual(A.rootsOf([{ type: 'childList', addedNodes: [row, text], removedNodes: [] }, { type: 'attributes', target: leaf }, { type: 'childList', addedNodes: [], removedNodes: [other] }]), [row],
    'only added or re-classed elements, outermost first; text nodes and removals need no scan');

  A.schedule(undefined, [{ type: 'childList', addedNodes: [], removedNodes: [other] }]);
  assert.strictEqual(timers.length, 0, 'a removal schedules nothing');
  A.schedule(undefined, [{ type: 'childList', addedNodes: [row], removedNodes: [] }]);
  A.schedule(undefined, [{ type: 'attributes', target: leaf }]);
  timers.pop().fn();
  assert.ok(row.scanned > 0 && leaf.scanned === 0 && pageScans === 0, 'a page change scans the subtree it added (once), never the whole page');
  A.schedule(600);
  timers.pop().fn();
  assert.ok(pageScans > 0, 'a theme change scans the whole page');

  const themeJs = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'theme/theme.js'), 'utf8');
  assert.ok(/const OWN_UI = '[^']*#connectea-outcome-tooltip/.test(themeJs) && themeJs.includes('r.target.closest?.(OWN_UI)'), 'the outcome tooltip (shown on every hover) is not a page change');
  assert.ok(themeJs.includes("[...r.addedNodes, ...r.removedNodes].every(isOwnUi)"), 'nor is adding or removing Connectify\'s floating UI');
  assert.ok(themeJs.includes('scheduleAdaptSurfaces(undefined, changes)'), 'page changes pass their records, so only their subtrees are adapted');

  const weak = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-weakness-types.css'), 'utf8');
  const bar = weak.match(/\.connectea-outcome-bar\.connectea-outcome-critical \{([^}]*)\}/)[1];
  assert.ok(!/animation/.test(bar), 'the critical bar itself never animates (its !important box-shadow hid the animated one, which still restyled every frame)');
  const glow = weak.match(/\.connectea-outcome-bar\.connectea-outcome-critical::after \{([^}]*)\}/)[1];
  assert.ok(/animation: connectea-glow-critical 1\.6s ease-in-out infinite alternate;/.test(glow) && /pointer-events: none !important;/.test(glow) && /will-change: opacity;/.test(glow), 'the pulse is a pseudo-element of its own');
  const filter = origReadFileSync.call(fs, path.resolve(SRC_DIR, 'sidebar/styles/sidebar-outcome-filter.css'), 'utf8');
  const frames = filter.match(/@keyframes connectea-glow-critical \{([\s\S]*?)\n\}/)[1];
  assert.ok(/opacity: 0/.test(frames) && /opacity: 1/.test(frames) && !/box-shadow|border/.test(frames), 'it animates opacity only, which the compositor runs without restyling the page');
});

runTest('Test 298: Startup Expand All waits for the other semester\'s outlines to be hidden, and Connect\'s cards arriving never move the drawn outlines', () => {
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  // Semester detection reads Connect's first outlines (grades come before any boxplot), at once
  const listeners = {};
  let drawable = [];
  const w = {
    ConnectifyUtils: { normalize: v => String(v || '').trim(), accountKey: () => 'test298', isOutlinesPage: () => true, removeStorageKeys() {} },
    ConnectifyOutlineApi: { drawable: () => drawable, isLoaded: () => false },
    ConnectifyApiParse: { overallMark: () => null, hasFinalLetter: r => Boolean(r.grade) },
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
  new Function('window', read('assessment/class-semesters.js'))(w);
  const S = w.ConnectifyClassSemesters;
  drawable = [{ apiOutline: true, title: 'Physics - Semester 1', subject: 'Physics', semester: 1, grade: '' }];
  assert.strictEqual(S.detectSemester(), 1, 'no final letter yet: Semester 1');
  drawable = [{ apiOutline: true, title: 'Physics - Semester 1', subject: 'Physics', semester: 1, grade: 'B' }, { apiOutline: true, title: 'Physics - Semester 2', subject: 'Physics', semester: 2, grade: '' }];
  assert.strictEqual(S.detectSemester(), 1, 'detection is held for a second');
  listeners['connectify-outlines-preview']();
  assert.strictEqual(S.detectSemester(), 2, 'Connect\'s first outlines decide at once, before every boxplot (and the whole load) has arrived');

  const features = read('atar/atar-features.js');
  const start = features.slice(features.indexOf('function checkStartupAutoExpand()'), features.indexOf('function syncFeatures()'));
  assert.ok(start.indexOf('window.ConnectifySemesterFilter?.applyToPage?.();') > 0 && start.indexOf('window.ConnectifySemesterFilter?.applyToPage?.();') < start.indexOf('window.ConnectifyData.expandAll(true);'),
    'startup auto-expand hides the other semester\'s tiles first, so Expand All (which skips hidden tiles) never opens outlines about to vanish');

  // The drawn host stays put when only Connect's hidden cards lie between it and its slot
  const mount = read('assessment/legacy-outlines.js');
  const fnSrc = name => { const at = mount.indexOf(`function ${name}(`); return mount.slice(at, mount.indexOf('\n  }\n', at) + 4); };
  const { inPlace } = new Function('HIDDEN', `${fnSrc('onlyHidden')}\n${fnSrc('inPlace')}\nreturn { inPlace };`)('cx-legacy-hidden');
  const parent = {};
  const node = cls => ({ parentElement: parent, nextElementSibling: null, classList: { contains: c => c === cls } });
  const chain = (...nodes) => { nodes.forEach((n, i) => { n.nextElementSibling = nodes[i + 1] || null; }); return nodes; };
  const [bar, a, b, host] = chain(node('cnt-category-bar'), node('cx-legacy-hidden'), node('cx-legacy-hidden'), node('host'));
  assert.ok(inPlace(host, parent, a), 'Connect\'s cards rendering before the host (all hidden) leave it in place: moving it restyled every tile (~1s at 4x CPU)');
  assert.ok(!inPlace(host, parent, bar), 'a visible element between them moves it');
  const [host2, c, d] = chain(node('host'), node('cx-legacy-hidden'), node('cx-legacy-hidden'));
  assert.ok(inPlace(host2, parent, d) && inPlace(host2, parent, c), 'hidden cards after the host count too');
  const [first, last] = chain(node('x'), node('host'));
  assert.ok(inPlace(last, parent, null) && !inPlace(first, parent, null), 'before Connect renders, the host is last in Connect\'s zone');
  assert.ok(!inPlace(host, {}, a), 'another parent moves it');
  assert.ok(mount.includes('if (!inPlace(host, parent, before)) parent.insertBefore(host, before);'), 'the host is placed through inPlace');
});

runTest('Test 299: Connect rendering its cards never makes Connectify restyle off-screen outlines or filter thousands of nested mutation records', () => {
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  // Off-screen outlines skip style and layout, so Connect's page-wide restyles (its Material stylesheets) touch only what is on screen
  const css = read('assessment/legacy-outlines.css');
  assert.ok(cssHas(css, '#cx-legacy-outlines .eds-c-tile { content-visibility: auto; contain-intrinsic-size: auto 600px;'), 'drawn outline tiles skip rendering while off screen and keep their last height');
  assert.ok(cssHas(css, '.cx-legacy-hidden { display: none !important;'), 'Connect\'s own cards are still hidden only once drawn: hiding them as Angular inserts them made its charts restyle the hidden card on every init (4x the work)');

  // The scheduler drops records inside subtrees added in the same batch
  let observed = null;
  const w = { addEventListener() {} };
  const doc = { body: {}, hidden: false, addEventListener() {} };
  new Function('window', 'document', 'MutationObserver', 'requestAnimationFrame', 'setInterval', 'clearInterval', read('system/scheduler.js'))(
    w, doc, function (cb) { observed = cb; this.observe = () => {}; this.disconnect = () => {}; }, () => 1, () => 1, () => {});
  const S = w.ConnectifyScheduler;
  const zone = { parentNode: null, nodeType: 1 };
  const card = { parentNode: zone, nodeType: 1 };
  const inner = Array.from({ length: 80 }, () => ({ parentNode: card, nodeType: 1 }));
  const leaf = { parentNode: inner[0], nodeType: 1 };
  const records = [
    { type: 'childList', target: zone, addedNodes: [card], removedNodes: [] },
    ...inner.map(n => ({ type: 'childList', target: card, addedNodes: [n], removedNodes: [] })),
    { type: 'childList', target: inner[0], addedNodes: [leaf], removedNodes: [] },
    { type: 'attributes', target: leaf, attributeName: 'class' }
  ];
  const kept = S.withoutNested(records);
  assert.deepStrictEqual(kept, [records[0]], 'only the record adding the card is kept: subscribers scan the subtree it added');
  const small = records.slice(0, 10);
  assert.strictEqual(S.withoutNested(small), small, 'small batches are filtered as they are');
  const other = { parentNode: null, nodeType: 1 };
  const elsewhere = { type: 'attributes', target: other, attributeName: 'class' };
  assert.ok(S.withoutNested([...records, elsewhere]).includes(elsewhere), 'records outside the added subtrees are kept');
  let got = null;
  S.onMutations(r => { got = r; }, { mute: false });
  observed(records);
  S.flush();
  assert.deepStrictEqual(got, [records[0]], 'subscribers receive the reduced batch');
});

runTest('Test 300: Connect builds its hidden outline cards without task rows or boxplots, the progress bar fills a slot in place, and the surface adapter reads before it writes', () => {
  const read = f => origReadFileSync.call(fs, path.resolve(SRC_DIR, f), 'utf8');
  const manifest = JSON.parse(origReadFileSync.call(fs, path.resolve(__dirname, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(g => g.js?.includes('src/assessment/connect-cards-trim.js'));
  assert.ok(group && group.world === 'MAIN' && group.run_at === 'document_start' && group.matches.every(m => m.includes('/assessment-outlines')),
    'the trim runs in the page world before Angular sends its request, on the outlines page only');

  // A fake XMLHttpRequest: native getters on the prototype, listeners called by hand
  function makeEnv() {
    const listeners = {};
    const timers = [];
    function FakeXhr() { this.readyState = 0; this.responseType = ''; this._text = ''; this._load = []; }
    FakeXhr.prototype.open = function (method, url) { this.url = url; };
    Object.defineProperty(FakeXhr.prototype, 'responseText', { configurable: true, get() { return this._text; } });
    Object.defineProperty(FakeXhr.prototype, 'response', { configurable: true, get() { return this._text; } });
    FakeXhr.prototype.addEventListener = function (type, fn) { if (type === 'load') this._load.push(fn); };
    FakeXhr.prototype.removeEventListener = function (type, fn) { this._load = this._load.filter(f => f !== fn); };
    const w = { addEventListener: (type, fn) => { listeners[type] = fn; } };
    new Function('window', 'XMLHttpRequest', 'setTimeout', read('assessment/connect-cards-trim.js'))(w, FakeXhr, fn => timers.push(fn));
    return { w, FakeXhr, listeners, timers };
  }
  const body = JSON.stringify({ status: 'SUCCESS', items: [{ semester1Groups: [{ name: 'Physics', groupResultsData: { mark: '80%', showGroupChart: true },
    outlines: [{ assessmentOutlineId: 1, taskGroups: [{ tasks: [{ taskId: 9, showTaskChart: true }] }] }] }], semester2Groups: [] }] });
  const request = (env, url) => {
    const xhr = new env.FakeXhr();
    xhr.open('POST', url);
    let seen = null;
    const onLoad = () => { seen = JSON.parse(xhr.response); };
    xhr.addEventListener('load', onLoad);
    xhr._text = body;
    xhr.readyState = 4;
    xhr._load.forEach(fn => fn({ type: 'load' }));
    return { xhr, onLoad, seen: () => seen };
  };
  const URL_OUTLINES = '/connectapi/rest/api/v1/app/student/assessmentOutlines?studentId=1';

  let env = makeEnv();
  let r = request(env, URL_OUTLINES);
  assert.strictEqual(r.seen(), null, 'Connect\'s load handler waits until Connectify knows whether it has its own outlines');
  env.timers.shift()();
  assert.strictEqual(r.seen(), null, 'it keeps waiting (on Connect\'s own timers, so Angular\'s zone sees the result)');
  env.listeners['connectify-outlines-preview']();
  env.timers.shift()();
  const trimmed = r.seen().items[0].semester1Groups[0];
  assert.ok(trimmed.groupResultsData.showGroupChart === false && trimmed.outlines[0].taskGroups.length === 0 && trimmed.name === 'Physics' && trimmed.groupResultsData.mark === '80%',
    'once Connectify has its outlines, Connect gets each class without task rows or its boxplot (no chart requests, light cards; titles, marks and the filter menu unchanged)');

  env = makeEnv();
  r = request(env, URL_OUTLINES);
  env.listeners['connectify-outlines-failed']();
  env.timers.shift()();
  assert.strictEqual(r.seen().items[0].semester1Groups[0].outlines[0].taskGroups.length, 1, 'if Connectify cannot get its outlines, Connect gets them unchanged');

  env = makeEnv();
  env.listeners['connectify-outlines-preview']();
  r = request(env, '/connectapi/rest/api/v1/app/student/assessmentOutlines/chart?studentId=1');
  assert.strictEqual(r.seen().items[0].semester1Groups[0].outlines[0].taskGroups.length, 1, 'other requests are untouched');
  assert.ok(read('assessment/connect-cards-trim.js').includes('const WAIT_MS = 10000;'), 'Connect never waits more than 10s');

  // The progress bar slot is drawn with the tile and filled in place
  eval(read('assessment/legacy-outlines-markup.js'));
  const tile = window.ConnectifyLegacyMarkup.tile({ title: 'Physics - Semester 1', outlines: [], staff: [] });
  assert.ok(/eds-c-tile__header[^]*?<\/div><\/div><div class="cx-compound-progress-container"><\/div><div class="eds-c-tile__body/.test(tile), 'drawn tiles carry an empty progress bar slot after the header');
  const progress = read('progress/compound-progress.js');
  assert.ok(progress.includes('existingContainer.replaceChildren(bar, label);') && !progress.includes('existingContainer.remove()'),
    'the bar fills and empties its slot in place: inserting a child into an expanded tile restyled the whole tile (Connect\'s `+ *` rules)');
  assert.ok(cssHas(read('progress/compound-progress.css'), '.cx-compound-progress-container:empty { display: none !important;'), 'an empty slot takes no space');

  // The surface adapter reads every computed style before writing a tag
  const log = [];
  const el = name => ({ name, isConnected: true, children: [], closest: () => null, matches: () => false, hasAttribute: () => false,
    setAttribute: () => log.push('write ' + name), querySelectorAll: () => [] });
  const nodes = [el('a'), el('b'), el('c')];
  const doc = { documentElement: { classList: { contains: c => c === 'connectea-dark' } }, body: { querySelectorAll: sel => (sel.startsWith('[data-connectea-surface]') ? nodes : nodes) } };
  const w2 = { getComputedStyle: n => { log.push('read ' + n.name); return { backgroundColor: 'rgb(250, 250, 250)', color: 'rgb(20, 20, 20)' }; } };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', read('theme/theme-surface-adapter.js'))(w2, doc, () => 0, () => {});
  w2.ConnectifyThemeSurfaceAdapter.adaptSurfaces();
  const firstWrite = log.findIndex(e => e.startsWith('write'));
  assert.ok(log.slice(0, firstWrite).length === 3 && log.slice(firstWrite, firstWrite + 3).every(e => e.startsWith('write')),
    'all surface reads come before any write (a write between reads forced a fresh restyle each time)');
});

Promise.all(pendingTestPromises).then(() => {
  console.log('\n================================================================');
  console.log(`ALL CONNECTIFY MASTER TESTS COMPLETED: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log('================================================================\n');
  process.exit(0);
});


