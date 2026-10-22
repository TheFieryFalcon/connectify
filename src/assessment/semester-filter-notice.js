/**
 * Connectify Assessment: notice for outlines hidden by "Show this semester's classes only"
 *
 * When the option hides every outline in view (a Connect filter picked a class with no outline this
 * semester), a message takes the outlines' place naming the semester that is hidden and how to see it,
 * with "← Back to All" while a Connect filter is applied. semester-filter.js calls update() after each
 * pass. Exposes window.ConnectifySemesterFilterNotice.
 */
(() => {
  'use strict';

  if (window.ConnectifySemesterFilterNotice) return;

  const ID = 'cx-semester-notice';
  const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
  const sidebarFilter = () => window.ConnectifySidebarFilter;

  function build() {
    const notice = make('div', 'cx-semester-notice');
    notice.id = ID;
    notice.setAttribute('role', 'status');
    const backToAll = Object.assign(make('button', 'cx-semester-notice-btn', '← Back to All'), {
      type: 'button',
      onclick: e => {
        e.preventDefault();
        sidebarFilter()?.clickConnectAllButton?.();
      }
    });
    notice.append(make('strong', 'cx-semester-notice-title'), make('p', 'cx-semester-notice-text'), backToAll);
    return notice;
  }

  /** The notice's title and text for the active semester, the Connect filter and the hidden count. */
  function texts(active, filterTitle, hiddenCount) {
    const other = active === 1 ? 2 : 1;
    const outlines = hiddenCount === 1 ? `its Semester ${other} outline is` : `its ${hiddenCount} Semester ${other} outlines are`;
    return {
      title: filterTitle ? `${filterTitle} has no Semester ${active} outline` : `No Semester ${active} outlines to show`,
      text: `"Show this semester's classes only" is on, so ${filterTitle ? outlines : `the Semester ${other} outlines are`} hidden. ` +
        'Turn the option off in Connectify Settings to show hidden outlines.'
    };
  }

  /**
   * Shows the notice just before anchor (the first hidden outline, or its layout slot), or removes it
   * when anchor is null. Nodes are only written when something changed, so passes stay quiet.
   */
  function update(anchor, active, hiddenCount) {
    let notice = document.getElementById(ID);
    if (!anchor || !active || !anchor.parentNode || typeof anchor.before !== 'function') {
      notice?.remove();
      return;
    }
    notice = notice || build();
    const filterTitle = sidebarFilter()?.activeFilterTitle?.() || '';
    const { title, text } = texts(active, filterTitle, hiddenCount);
    const [titleEl, textEl, button] = notice.children;
    if (titleEl.textContent !== title) titleEl.textContent = title;
    if (textEl.textContent !== text) textEl.textContent = text;
    if (button.hidden !== !filterTitle) button.hidden = !filterTitle;
    if (anchor.previousElementSibling !== notice) anchor.before(notice);
  }

  window.ConnectifySemesterFilterNotice = { ID, texts, update };
})();
