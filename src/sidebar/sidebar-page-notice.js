/**
 * Connectify Sidebar: off-outlines notice
 *
 * The sidebar is on every Connect page, but only Settings works away from Assessment Outlines: the
 * other tools open there. Builds the notice shown above the launchers on other pages, with a link to
 * the outlines. Exposes window.ConnectifySidebarPageNotice.
 */
(() => {
  'use strict';

  // The one launcher that works on every page
  const ANYWHERE_TOOLS = new Set(['connectify-categories-toggle']);

  /** The notice with an "Open Assessment Outlines" link (hidden until the sidebar shows it). */
  function create() {
    const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
    const notice = make('div', 'cx-page-notice');
    notice.hidden = true;
    const link = Object.assign(make('a', 'cx-page-notice-link', 'Open Assessment Outlines →'), {
      id: 'cx-open-outlines-link',
      href: window.ConnectifyUtils.OUTLINES_URL
    });
    notice.append(
      make('strong', 'cx-page-notice-title', 'Assessment Outlines Only'),
      make('p', 'cx-page-notice-text', 'Connectify\'s tools open on the Assessment Outlines page. Settings works here too.'),
      link
    );
    return notice;
  }

  window.ConnectifySidebarPageNotice = { ANYWHERE_TOOLS, create };
})();
