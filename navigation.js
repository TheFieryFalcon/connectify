(() => {
  'use strict';
  const destination = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
  const label = 'Assessment Outlines';
  function addShortcut() {
    if (location.pathname.includes('/assessment-outlines')) {document.querySelectorAll('[data-connectea-shortcut]').forEach(e=>e.remove());return;}
    for (const menu of document.querySelectorAll('.cvr-c-primary-navigation__links')) {
      if (menu.querySelector('[data-connectea-shortcut]')) continue;
      const original = menu.querySelector('a[href="/group/students/ui/my-connect"]');
      const item = original?.closest('.cvr-js-greedy__item');
      if (!item) continue;
      const shortcut = document.createElement('div');
      shortcut.className = 'v-csslayout v-layout v-widget cvr-js-greedy__item v-csslayout-cvr-js-greedy__item';
      shortcut.dataset.connecteaShortcut = '';
      shortcut.style.display = 'inline-block';
      const wrapper = document.createElement('div');
      wrapper.className = 'v-link v-widget';
      const link = document.createElement('a');
      link.href = destination;
      const text = document.createElement('span');
      text.textContent = label;
      link.append(text); wrapper.append(link); shortcut.append(wrapper);
      item.after(shortcut);
    }
    // Connect uses a separate menu on smaller screens.
    for (const menu of document.querySelectorAll('.cvr-c-primary-menu__list')) {
      if (menu.querySelector('[data-connectea-shortcut]')) continue;
      const original = Array.from(menu.querySelectorAll('.cvr-c-primary-menu__item-label')).find(e => e.textContent.trim() === 'My Connect');
      const item = original?.closest('.cvr-c-primary-menu__item');
      if (!item) continue;
      const link = document.createElement('a');
      link.dataset.connecteaShortcut = '';
      link.href = destination;
      link.className = 'cvr-c-primary-menu__item';
      link.style.cssText = 'display:block;color:inherit;text-decoration:none';
      const text = document.createElement('div');
      text.className = original.className;
      text.textContent = label;
      link.append(text); item.after(link);
    }
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; addShortcut(); });
  }).observe(document.documentElement, {childList:true, subtree:true});
  addShortcut();
})();
