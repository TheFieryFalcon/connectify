/**
 * Connectify Assessment: Connect's own outline cards without task rows or boxplots (MAIN world, document_start)
 *
 * Connectify draws every outline from Connect's API itself (outline-api.js, legacy-outlines.js) and hides
 * Connect's cards, reading only their titles (which classes Connect's filter shows) and teacher / school
 * links. Connect still built every card in full: it fetched each class's boxplots 250ms apart (~13s), then in
 * one task styled ~4,000 elements and initialised an ECharts chart per task, seconds of work on a slow laptop
 * for cards nobody sees. Its assessmentOutlines response is handed to it with each class's task rows removed
 * and its class boxplot off, so Connect fetches no boxplots and renders light cards at once (its filter menu
 * is built from the same classes and is unchanged).
 * Connect gets the trimmed response only once Connectify has its own outlines (connectify-outlines-preview,
 * which crosses worlds as a DOM event); if Connectify's request fails or takes over WAIT_MS, it gets the
 * response unchanged. The wait polls on Connect's own timers, so Angular's zone sees the result as usual.
 */
(() => {
  'use strict';

  if (window.__connectifyCardsTrim) return;
  window.__connectifyCardsTrim = true;

  const OUTLINES = /\/connectapi\/rest\/api\/v1\/app\/student\/assessmentOutlines\?/;
  const WAIT_MS = 10000;
  const POLL_MS = 50;

  // 'trim' once Connectify has drawable outlines, 'full' if it cannot get them
  let decision = null;
  const decide = value => { decision = decision || value; };
  window.addEventListener('connectify-outlines-preview', () => decide('trim'));
  window.addEventListener('connectify-outlines-failed', () => decide('full'));

  /** The response with every class's task rows removed and its class boxplot off. */
  function trim(data) {
    const item = data?.items?.[0];
    if (!item) return data;
    for (const group of [...(item.semester1Groups || []), ...(item.semester2Groups || [])]) {
      if (group?.groupResultsData) group.groupResultsData.showGroupChart = false;
      for (const outline of group?.outlines || []) outline.taskGroups = [];
    }
    return data;
  }

  const proto = XMLHttpRequest.prototype;
  const nativeOpen = proto.open;
  const nativeText = Object.getOwnPropertyDescriptor(proto, 'responseText');
  const nativeResponse = Object.getOwnPropertyDescriptor(proto, 'response');

  function watch(xhr) {
    let trimmed;
    // The trimmed text, or null to give Connect the response as it came
    const text = () => {
      if (decision !== 'trim' || xhr.readyState !== 4 || (xhr.responseType && xhr.responseType !== 'text' && xhr.responseType !== 'json')) return null;
      if (trimmed === undefined) {
        try {
          const raw = xhr.responseType === 'json' ? nativeResponse.get.call(xhr) : nativeText.get.call(xhr);
          trimmed = JSON.stringify(trim(typeof raw === 'string' ? JSON.parse(raw) : raw));
        } catch {
          trimmed = null;
        }
      }
      return trimmed;
    };
    Object.defineProperty(xhr, 'responseText', {
      configurable: true,
      get() { return text() ?? nativeText.get.call(this); }
    });
    Object.defineProperty(xhr, 'response', {
      configurable: true,
      get() {
        const t = text();
        if (t === null) return nativeResponse.get.call(this);
        return this.responseType === 'json' ? JSON.parse(t) : t;
      }
    });

    // Connect's load handler waits (polling on Connect's own timers) until Connectify has decided
    const add = xhr.addEventListener;
    const remove = xhr.removeEventListener;
    const wrapped = new Map();
    xhr.addEventListener = function (type, listener, options) {
      if (type !== 'load' || typeof listener !== 'function') return add.call(this, type, listener, options);
      const started = Date.now();
      const wrapper = function (event) {
        const run = () => {
          if (!decision && Date.now() - started < WAIT_MS) { setTimeout(run, POLL_MS); return; }
          decide('full');
          listener.call(xhr, event);
        };
        run();
      };
      wrapped.set(listener, wrapper);
      return add.call(this, type, wrapper, options);
    };
    xhr.removeEventListener = function (type, listener, options) {
      return remove.call(this, type, (type === 'load' && wrapped.get(listener)) || listener, options);
    };
  }

  proto.open = function (method, url, ...rest) {
    if (OUTLINES.test(String(url))) watch(this);
    return nativeOpen.call(this, method, url, ...rest);
  };

  window.ConnectifyCardsTrim = { trim, decision: () => decision };
})();
