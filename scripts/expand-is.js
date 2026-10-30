/**
 * Connectify :is() expander
 * Rewrites selectors so Chrome can bucket every theme rule by a class, id or tag, without changing what any rule
 * matches or its specificity.
 *
 * Chrome files a rule under its subject's class, id or tag; a subject keyed only by a multi-argument :is() or
 * :where() goes in the universal bucket and is tried on every element. An ancestor keyed only by one gives the
 * ancestor Bloom filter nothing to reject on, so every candidate walks all its ancestors. Expand All restyled the
 * outlines ~4x slower in Dark than in Light because of this (2026-10).
 *
 * Each compound keyed only by an :is() / :where() list becomes one selector per argument:
 * - :is() takes its most specific argument's specificity, so an argument already that specific stands alone
 *   (bare when it is a plain compound every browser parses, else as a single-argument :is(), which Chrome buckets
 *   by its own subject and which stays forgiving);
 * - a less specific argument is padded to exactly that specificity with :not(#cx-n) / :not(.cx-n) / :not(cx-n)
 *   (nothing carries cx-n), wrapped in :where() first when it has more of a lower-weight part than the list;
 * - :where() arguments stay in :where();
 * - complex arguments are never written out of their :is() (`P :is(A B)` is not `P A B`); their own lists are
 *   expanded inside it;
 * - #cx-specificity-anchor (an id nothing carries, written into a list to give it id weight) sets the specificity
 *   the other arguments are padded to and is then dropped.
 * The selector list as a whole matches the same elements, and every selector in it has the original specificity.
 * An ancestor list made only of <html> / <body> hooks (:is(.connectea-dark, body, html)) is left whole: those are
 * ancestors of everything, so expanding it would only add rules.
 *
 * A single complex argument is never bucketed (`.connectea-dark :is(.a span)` is tried on every element, not on
 * spans), so after root hooks that sit only on <html> / <body> it is written one compound at a time:
 * `.connectea-dark :is(.a span)` -> `.connectea-dark .a :is(span)` (:where() likewise), the same matches (every
 * element but <html> is inside <html>, and the first compound names a Connect component, never <html> / <body>)
 * and the same specificity. A compound after any other ancestor keeps its list (`.tile :is(.a span)` also matches
 * an .a outside the tile).
 *
 * Ancestor exclusions in one compound (`:not(.a *):not(#b *)`) become one `:not(:is(.a, #b) *)`, padded to the
 * same specificity: each `:not(X *)` walks every ancestor up to <html> on its own, so a text rule tried on every
 * div walked them seven times (the costliest rule of Expand All in Dark, 2026-10); one list walks them once.
 *
 * Usage: node scripts/expand-is.js [--write] file.css ...   (prints files whose rules change; --write saves them)
 */

'use strict';

const fs = require('fs');

function splitTop(str, seps) {
  const out = []; let depth = 0, quote = null, cur = '';
  for (const ch of str) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && seps.includes(ch)) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function matchClose(s, open) {
  let depth = 0, quote = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') { depth--; if (!depth) return i; }
  }
  return -1;
}

// Simple selectors of one compound: ['div', '.a', ':not(.b)', '::before']
function simples(comp) {
  const out = []; let i = 0;
  while (i < comp.length) {
    const c = comp[i];
    let j = i + 1;
    if (c === '[') j = matchClose(comp, i) + 1;
    else if (c === ':') {
      if (comp[j] === ':') j++;
      while (j < comp.length && /[\w-]/.test(comp[j])) j++;
      if (comp[j] === '(') j = matchClose(comp, j) + 1;
    } else if (c !== '*') while (j < comp.length && /[\w-]/.test(comp[j])) j++;
    if (j <= i) throw new Error(`cannot parse compound ${comp}`);
    out.push(comp.slice(i, j));
    i = j;
  }
  return out;
}

// Top-level compounds and combinators: ['a', ' ', 'b', '>', 'c']
function tokens(sel) {
  const out = []; let depth = 0, quote = null, cur = '';
  const s = sel.trim();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      let j = i, comb = ' ';
      for (; j < s.length && /[\s>+~]/.test(s[j]); j++) if (!/\s/.test(s[j])) comb = s[j];
      out.push(cur, comb); cur = ''; i = j - 1;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
const render = toks => toks.map((t, i) => (i % 2 ? (t === ' ' ? ' ' : ` ${t} `) : t)).join('');

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const maxSpec = list => list.reduce((m, s) => (cmp(s, m) > 0 ? s : m), [0, 0, 0]);
const specList = text => maxSpec(splitTop(text, ',').map(a => specificity(a.trim())));

function simpleSpec(s) {
  if (s[0] === '#') return [1, 0, 0];
  if (s[0] === '.' || s[0] === '[') return [0, 1, 0];
  if (s === '*') return [0, 0, 0];
  if (s.startsWith('::')) return [0, 0, 1];
  if (s[0] !== ':') return [0, 0, 1];
  const name = s.slice(1).match(/^[\w-]+/)[0].toLowerCase();
  const arg = s.includes('(') ? s.slice(s.indexOf('(') + 1, -1) : null;
  if (/^(before|after|first-line|first-letter)$/.test(name)) return [0, 0, 1];
  if (name === 'where') return [0, 0, 0];
  if (/^(is|not|has)$/.test(name)) return specList(arg);
  if (/^nth-(last-)?child$/.test(name) && / of /.test(arg)) return add([0, 1, 0], specList(arg.split(/ of /)[1]));
  return [0, 1, 0];
}
function specificity(sel) {
  return tokens(sel).filter((t, i) => !(i % 2) && t).reduce((total, comp) => simples(comp).reduce((t, s) => add(t, simpleSpec(s)), total), [0, 0, 0]);
}

// A compound safe to write outside a forgiving list: every supported browser parses it
const SAFE_PSEUDO = /^:(hover|focus|focus-visible|focus-within|active|checked|disabled|enabled|first-child|last-child|only-child|empty|link|visited|first-of-type|last-of-type|placeholder-shown|read-only|required|invalid|root)$/;
function plainCompound(a) {
  if (tokens(a).length !== 1) return false;
  let parts; try { parts = simples(a); } catch { return false; }
  return parts.every((p, i) => {
    if (p[0] === '.' || p[0] === '#') return /^[.#][\w-]+$/.test(p);
    if (p[0] === '[') return /^\[[\w-]+(\s*[~|^$*]?=\s*("[^"]*"|'[^']*'|[\w-]+)(\s+i)?)?\]$/.test(p);
    if (p[0] === ':') {
      if (SAFE_PSEUDO.test(p)) return true;
      const m = p.match(/^:not\((.*)\)$/);
      return !!m && splitTop(m[1], ',').every(x => plainCompound(x.trim()));
    }
    return i === 0 && (p === '*' || /^[a-z][\w-]*$/i.test(p));
  });
}
const isTag = p => p === '*' || /^[a-z]/i.test(p);

// :not()s that match everything and add exactly this specificity
const pad = d => ':not(#cx-n)'.repeat(d[0]) + ':not(.cx-n)'.repeat(d[1]) + ':not(cx-n)'.repeat(d[2]);
// Padding goes before a trailing pseudo-element
function withPad(comp, d) {
  const m = comp.match(/::[\w-]+$|:(before|after)$/);
  return m ? comp.slice(0, m.index) + pad(d) + m[0] : comp + pad(d);
}
// pre + arg + post as one compound (the type selector first); null when both name a type
function join(pre, arg, post) {
  const a = simples(arg), p = pre ? simples(pre) : [];
  const aTag = a.length && isTag(a[0]) ? a[0] : null, pTag = p.length && isTag(p[0]) ? p[0] : null;
  if (aTag && pTag) return null;
  return (aTag || pTag || '') + (pTag ? p.slice(1) : p).join('') + (aTag ? a.slice(1) : a).join('') + post;
}

const ANCHOR = '#cx-specificity-anchor';
const listArgs = p => splitTop(p.slice(p.indexOf('(') + 1, -1), ',').map(a => a.trim().replace(/\s+/g, ' '));

// The compound as alternatives, one per :is() / :where() argument, when such a list is its only key
function alternatives(comp) {
  let parts; try { parts = simples(comp); } catch { return [comp]; }
  const idx = parts.findIndex(p => /^:(is|where)\(/.test(p) && (listArgs(p).length > 1 || expandSelector(listArgs(p)[0]).length > 1));
  if (idx < 0 || parts.some((p, i) => i !== idx && /^[.#]/.test(p))) return [comp];
  const pre = parts.slice(0, idx).join(''), post = parts.slice(idx + 1).join('');
  if (/::/.test(pre)) return [comp];
  const where = parts[idx].startsWith(':where');
  const args = listArgs(parts[idx]);
  const specs = args.map(a => (where ? [0, 0, 0] : specificity(a)));
  const max = maxSpec(specs);
  const out = [];
  args.forEach((arg, i) => {
    if (arg === ANCHOR) return; // only lends the list its id weight: nothing carries it
    const deficit = sub(max, specs[i]);
    for (const e of expandSelector(arg)) {
      if (where) out.push(join(pre, `:where(${e})`, post));
      else if (deficit.every(x => x >= 0)) out.push(withPad((plainCompound(e) && join(pre, e, post)) || join(pre, `:is(${e})`, post), deficit));
      else out.push(withPad(join(pre, `:where(${e})`, post), max));
    }
  });
  return out.flatMap(alternatives);
}

// An ancestor whose every alternative sits on <html> / <body> gives the Bloom filter nothing to reject on: left whole
const ROOT_PART = /^(html|body|\.connectea-dark|\[data-connectea-[\w-]+(="[^"]*")?\]|:not\([^()]*\))$/;
function rootLevel(comp) {
  try {
    const parts = simples(comp);
    return parts.every(p => ROOT_PART.test(p) || (/^:(is|where)\(/.test(p) && listArgs(p).every(rootLevel)));
  } catch { return false; }
}

// One selector as a list of selectors with the same matches and specificity
function expandSelector(sel) {
  const toks = tokens(sel.replace(/\s+/g, ' '));
  let combos = [[]];
  toks.forEach((t, i) => {
    const alts = i % 2 || (i < toks.length - 1 && rootLevel(t)) ? [t] : alternatives(t);
    combos = combos.flatMap(c => alts.map(a => c.concat(a)));
  });
  return combos.map(render);
}

// Root hooks: only <html> and <body> carry .connectea-dark and these attributes
const ROOT_ATTR = /^\[data-connectea-(theme|glass|tone|reading-view|has-custom-bg|login|logout)(=("[^"]*"|'[^']*'))?\]$/;
function rootOnly(comp) {
  let parts; try { parts = simples(comp); } catch { return false; }
  if (parts.some(p => p === '.connectea-dark' || /^(html|body)$/i.test(p))) return true;
  return parts.every(p => ROOT_ATTR.test(p) || /^:not\([^()]*\)$/.test(p) || (/^:(is|where)\(/.test(p) && listArgs(p).every(rootOnly)));
}
// A compound naming a Connect component (class or id) or an element <html> / <body> never are
const componentKey = comp => {
  let parts; try { parts = simples(comp); } catch { return false; }
  return parts.some(p => /^[.#](cvr-|eds-c-|v-|mat-|cdk-|cnt-|c-|connect-)/.test(p)) ||
    (isTag(parts[0]) && parts[0] !== '*' && !/^(html|body)$/i.test(parts[0]));
};

// A single complex :is() / :where() argument right after root hooks, written one compound at a time
function splitSingle(sel) {
  const toks = tokens(sel);
  for (let i = 2; i < toks.length; i += 2) {
    if (toks[i - 1] !== ' ' || !toks.slice(0, i - 1).every((t, k) => (k % 2 ? t === ' ' : rootOnly(t)))) break;
    let parts; try { parts = simples(toks[i]); } catch { break; }
    const idx = parts.findIndex(p => /^:(is|where)\(/.test(p) && listArgs(p).length === 1 && tokens(listArgs(p)[0]).length > 1);
    if (idx < 0) continue;
    if (parts.some((p, k) => k !== idx && isTag(p))) break;
    const inner = tokens(listArgs(parts[idx])[0]);
    if (!componentKey(inner[0]) || inner.some((t, k) => !(k % 2) && /^:(is|where)\(.*,/.test(t))) break;
    const kind = parts[idx].startsWith(':where') ? 'where' : 'is';
    const wrap = c => (kind === 'is' && plainCompound(c) ? c : `:${kind}(${c})`);
    const last = inner.length - 1;
    // The subject's own compound takes the list's place (bare at the start of an :is() compound)
    const subject = t => parts.map((p, j) => (j !== idx ? p : kind === 'is' && j === 0 ? t : `:${kind}(${t})`)).join('');
    const pieces = inner.map((t, k) => (k % 2 ? t : k < last ? wrap(t) : subject(t)));
    return splitSingle(render([...toks.slice(0, i), ...pieces, ...toks.slice(i + 1)]));
  }
  return sel;
}

// The plain compounds an ancestor exclusion names (`:not(.a *)`, or an already merged `:not(:is(.a, #b) *)`), else null
function excluded(simple) {
  const m = simple.match(/^:not\((.*)\)$/);
  const toks = m && tokens(m[1]);
  if (!toks || toks.length !== 3 || toks[1] !== ' ' || toks[2] !== '*') return null;
  const named = /^:is\(.*\)$/.test(toks[0]) ? listArgs(toks[0]) : [toks[0]];
  return named.every(plainCompound) ? named : null;
}

// Every compound's ancestor exclusions as one :not(:is(...) *) where the first stood, padded to the same specificity
function mergeExclusions(sel) {
  const toks = tokens(sel);
  return render(toks.map((t, i) => {
    if (i % 2) return t;
    let parts; try { parts = simples(t); } catch { return t; }
    const idx = parts.map((p, k) => (excluded(p) ? k : -1)).filter(k => k >= 0);
    if (idx.length < 2) return t;
    const named = [...new Set(idx.flatMap(k => excluded(parts[k])))];
    const merged = `:not(:is(${named.join(', ')}) *)`;
    const before = idx.reduce((sum, k) => add(sum, simpleSpec(parts[k])), [0, 0, 0]);
    const kept = parts.filter((p, k) => !idx.includes(k) || k === idx[0]).map(p => (p === parts[idx[0]] ? merged : p));
    return withPad(kept.join(''), sub(before, simpleSpec(merged)));
  }));
}

function wrapList(sels) {
  const lines = []; let cur = '';
  for (const s of sels) {
    const piece = `${s},`;
    if (cur && `${cur} ${piece}`.length > 150) { lines.push(cur); cur = piece; } else cur = cur ? `${cur} ${piece}` : piece;
  }
  lines.push(cur);
  return lines.join('\n').replace(/,$/, '');
}

function matchBrace(s, open) {
  let depth = 0, quote = null;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 1; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return i; }
  }
  return -1;
}

// Rewrites every style rule's prelude (inside @media / @supports / @layer / @container too); the rest is kept as written
function transform(css) {
  const walk = src => {
    let res = '', pre = '', j = 0;
    while (j < src.length) {
      const ch = src[j];
      if (ch === '/' && src[j + 1] === '*') { const e = src.indexOf('*/', j + 2) + 2; pre += src.slice(j, e); j = e; continue; }
      if (ch === '"' || ch === "'") { const e = src.indexOf(ch, j + 1) + 1; pre += src.slice(j, e); j = e; continue; }
      if (ch === ';' || ch === '}') { res += pre + ch; pre = ''; j++; continue; }
      if (ch !== '{') { pre += ch; j++; continue; }
      const close = matchBrace(src, j);
      const body = src.slice(j + 1, close);
      const [, lead, selText, trail] = pre.match(/^((?:\s|\/\*[\s\S]*?\*\/)*)([\s\S]*?)(\s*)$/);
      if (selText.startsWith('@')) res += `${pre}{${/^@(media|supports|layer|container)\b/.test(selText) ? walk(body) : body}}`;
      else if (/\/\*/.test(selText) || /^(from|to|\d+%)/.test(selText)) res += `${pre}{${body}}`;
      else {
        const sels = splitTop(selText, ',').map(s => s.trim().replace(/\s+/g, ' '));
        const out = sels.flatMap(expandSelector).map(splitSingle).map(mergeExclusions);
        res += out.length === sels.length && out.every((s, k) => s === sels[k]) ? `${pre}{${body}}` : `${lead}${wrapList(out)}${trail || ' '}{${body}}`;
      }
      pre = ''; j = close + 1;
    }
    return res + pre;
  };
  return walk(css);
}

module.exports = { transform, expandSelector, splitSingle, mergeExclusions, specificity };

if (require.main === module) {
  const args = process.argv.slice(2);
  for (const file of args.filter(a => !a.startsWith('--'))) {
    const src = fs.readFileSync(file, 'utf8');
    const out = transform(src);
    if (out === src) continue;
    if (args.includes('--write')) fs.writeFileSync(file, out);
    console.log(`${file}: ${src.split('\n').length} -> ${out.split('\n').length} lines`);
  }
}
