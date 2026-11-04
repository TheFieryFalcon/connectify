/**
 * Connectify Content: the files under a section heading of a class's Content page.
 *
 * Content is a Vaadin app: a section's file links exist only in the server's reply to its View button (FileDownloader
 * connectors, resources.dl), never in the page. So each lookup opens a Vaadin UI of its own in the student's session,
 * as a second tab would (its own window name and connector ids), and presses that section's View there. The page's
 * own UI never moves, and the lookup's UI lapses on the server when its heartbeats stop.
 * Exposes window.ConnectifyContentFiles.
 */
(() => {
  'use strict';

  if (window.ConnectifyContentFiles) return;

  const APP = '.v-app.librarylearningcontentui';
  const BUTTON_RPC = 'com.vaadin.shared.ui.button.ButtonServerRpc';
  const JSON_POST = { 'Content-Type': 'application/json;charset=UTF-8' };
  const FORM_POST = { 'Content-Type': 'application/x-www-form-urlencoded' };

  const unescapeJs = text => text.replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  /** The URLs Vaadin's bootstrap script gives the app with this id, or null. */
  function bootConfig(appId, scriptTexts) {
    const text = scriptTexts.find(t => t.includes(`initApplication("${appId}"`));
    if (!text) return null;
    const read = key => unescapeJs(text.match(new RegExp(`${key}:"([^"]*)"`))?.[1] || '');
    const config = { appId, serviceUrl: read('serviceUrl'), detailsUrl: read('browserDetailsUrl'), pathParameter: read('pathParameterName') };
    return config.serviceUrl && config.detailsUrl && config.pathParameter ? config : null;
  }

  /** One UIDL message from a reply (Vaadin guards replies with for(;;);). */
  const parseUidl = text => JSON.parse(String(text).replace(/^for\(;;\);/, ''))[0];

  /** The landing page's sections in order: { title, viewId } for each View button, titled by the heading in its card. */
  function sections(uidl) {
    const { state = {}, hierarchy = {} } = uidl;
    const parent = {};
    for (const [id, children] of Object.entries(hierarchy)) for (const child of children) parent[child] = id;
    const headingUnder = id => {
      if (state[id]?.text && (state[id].styles || []).includes('eds-c-heading')) return state[id].text;
      for (const child of hierarchy[id] || []) {
        const found = headingUnder(child);
        if (found) return found;
      }
      return '';
    };
    const isView = s => s.text === 'View' || s.caption === 'View';
    return Object.keys(state).filter(id => isView(state[id])).map(viewId => {
      let title = '';
      for (let id = parent[viewId]; id && !title; id = parent[id]) title = headingUnder(id);
      return { title, viewId };
    });
  }

  /** The download links in a section's reply, in the section's order (connector ids count up). */
  const fileUrls = uidl => Object.values(uidl.state || {}).map(s => s.resources?.dl?.uRL).filter(Boolean);

  /** The name a link saves as: Connect writes some names form-encoded ("Law+%282007%29.pdf"), others raw. */
  function fileName(url) {
    const raw = String(url).split('?')[0].split('/').pop() || '';
    let name = raw.replace(/\+/g, ' ');
    try { name = decodeURIComponent(name); } catch {}
    return name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'file';
  }

  /** Names made distinct for one archive: a.pdf, a (2).pdf. */
  function uniqueNames(names) {
    const seen = new Set();
    return names.map(name => {
      const dot = name.lastIndexOf('.');
      const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
      let out = name;
      for (let n = 2; seen.has(out.toLowerCase()); n++) out = `${stem} (${n})${ext}`;
      seen.add(out.toLowerCase());
      return out;
    });
  }

  function currentConfig() {
    const appId = document.querySelector(APP)?.id;
    return appId ? bootConfig(appId, [...document.scripts].map(s => s.textContent || '')) : null;
  }

  async function post(url, headers, body) {
    const res = await window.ConnectifyUtils.pageFetch(url, { method: 'POST', credentials: 'same-origin', headers, body });
    if (!res.ok) throw new Error(`Connect returned HTTP ${res.status}`);
    return res.text();
  }

  /** A new UI on the landing page: { uiId, uidl }. The location leaves out the hash, which names the page UI's view. */
  async function openUi(config) {
    const now = new Date();
    const zone = String(-now.getTimezoneOffset());
    const body = new URLSearchParams({
      'v-browserDetails': '1', theme: 'connect-vr', 'v-appId': config.appId,
      'v-sh': String(screen.height), 'v-sw': String(screen.width),
      'v-cw': String(innerWidth), 'v-ch': String(innerHeight), 'v-vw': String(innerWidth), 'v-vh': '0',
      'v-curdate': String(now.getTime()), 'v-tzo': zone, 'v-dstd': '0', 'v-rtzo': zone, 'v-dston': 'false',
      'v-tzid': Intl.DateTimeFormat().resolvedOptions().timeZone,
      'v-loc': location.href.split('#')[0],
      'v-wn': `${config.appId}-cx-${Math.random()}`
    });
    const reply = JSON.parse(await post(`${config.detailsUrl}&v-${now.getTime()}`, FORM_POST, body));
    return { uiId: reply['v-uiId'], uidl: JSON.parse(reply.uidl) };
  }

  function pressView(config, ui, viewId) {
    const url = `${config.serviceUrl}&${encodeURIComponent(config.pathParameter)}=${encodeURIComponent('/UIDL/')}&v-uiId=${ui.uiId}`;
    const click = { altKey: false, button: 'LEFT', clientX: 0, clientY: 0, ctrlKey: false, metaKey: false, relativeX: 0, relativeY: 0, shiftKey: false, type: 1 };
    return post(url, JSON_POST, JSON.stringify({
      csrfToken: ui.uidl['Vaadin-Security-Key'],
      rpc: [[viewId, BUTTON_RPC, 'click', [click]]],
      syncId: ui.uidl.syncId,
      clientId: ui.uidl.clientId
    }));
  }

  /** The file links under the section's heading (the nth with this title), read once per page. */
  const lookups = new Map();
  function list(title, nth = 0) {
    const key = `${nth}:${title}`;
    if (!lookups.has(key)) {
      const lookup = (async () => {
        const config = currentConfig();
        if (!config) throw new Error('Connect\'s Content page is not ready');
        const ui = await openUi(config);
        const section = sections(ui.uidl).filter(s => s.title === title)[nth];
        if (!section) throw new Error(`No section named ${title}`);
        return fileUrls(parseUidl(await pressView(config, ui, section.viewId)));
      })();
      lookup.catch(() => lookups.delete(key));
      lookups.set(key, lookup);
    }
    return lookups.get(key);
  }

  window.ConnectifyContentFiles = { APP, bootConfig, parseUidl, sections, fileUrls, fileName, uniqueNames, list };
})();
