/**
 * Connectify: changelog popup
 *
 * What's new on the update notice opens CHANGELOG.md here, in the shared goal dialog, never on GitHub or in a new
 * window. The file ships with the extension (web_accessible_resources, so a content script may fetch it), so the
 * popup shows the installed version's notes, offline too. Only the changelog's own Markdown is read: ## releases,
 * ### groups, - items and paragraphs, with **bold** and `code`; a link keeps only its text. Everything goes in as
 * text, never HTML. Styles: changelog-popup.css. Exposes window.ConnectifyChangelogPopup.
 */
(() => {
  'use strict';

  if (window.ConnectifyChangelogPopup) return;

  const FILE = 'CHANGELOG.md';
  const FAILED = 'The changelog could not be loaded.';

  /** The file's lines as blocks, from the first release on (the file's own intro is about the repository). */
  function parse(markdown) {
    const blocks = [];
    for (const raw of String(markdown || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith('## ')) blocks.push({ kind: 'release', text: line.slice(3).trim() });
      else if (!blocks.length || !line || line === '---') continue;
      else if (line.startsWith('### ')) blocks.push({ kind: 'group', text: line.slice(4).trim() });
      else if (line.startsWith('- ')) blocks.push({ kind: 'item', text: line.slice(2).trim() });
      else blocks.push({ kind: 'text', text: line });
    }
    return blocks;
  }

  /** A line's runs: `{ text, bold, code }`. */
  function inline(text, bold = false) {
    const parts = [];
    let last = 0;
    const plain = value => { if (value) parts.push({ text: value, bold, code: false }); };
    for (const match of String(text).matchAll(/\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\([^)]*\)/g)) {
      plain(text.slice(last, match.index));
      if (match[1] !== undefined) parts.push(...inline(match[1], true));
      else if (match[2] !== undefined) parts.push({ text: match[2], bold, code: true });
      else plain(match[3]);
      last = match.index + match[0].length;
    }
    plain(text.slice(last));
    return parts;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function fill(node, text) {
    for (const part of inline(text)) {
      let run = part.code ? el('code', '', part.text) : document.createTextNode(part.text);
      if (part.bold) {
        const strong = el('strong');
        strong.append(run);
        run = strong;
      }
      node.append(run);
    }
    return node;
  }

  /** Puts the blocks in `body`: a section per release, a list per group. */
  function render(body, blocks) {
    let section = null;
    let list = null;
    for (const block of blocks) {
      if (block.kind === 'release') {
        section = el('section', 'cx-changelog-release');
        section.append(fill(el('h2', 'cx-changelog-version'), block.text));
        body.append(section);
        list = null;
      } else if (block.kind === 'item') {
        if (!list) {
          list = el('ul', 'cx-changelog-list');
          section.append(list);
        }
        list.append(fill(el('li', 'cx-changelog-item'), block.text));
      } else {
        section.append(block.kind === 'group' ? fill(el('h3', 'cx-changelog-group'), block.text) : fill(el('p', 'cx-changelog-text'), block.text));
        list = null;
      }
    }
  }

  async function load() {
    const url = (globalThis.browser || globalThis.chrome).runtime.getURL(FILE);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Changelog: HTTP ${response.status}`);
    return response.text();
  }

  function open() {
    return window.ConnectifyGoalModal?.open({
      id: 'cx-changelog-dialog',
      title: 'Changelog',
      build: body => load()
        .then(markdown => {
          const blocks = parse(markdown);
          if (!blocks.length) throw new Error('Changelog: no releases');
          render(body, blocks);
        })
        .catch(err => {
          console.warn('Connectify:', err);
          body.append(el('p', 'cx-changelog-text', FAILED));
        })
    });
  }

  window.ConnectifyChangelogPopup = { FILE, FAILED, parse, inline, render, load, open };
})();
