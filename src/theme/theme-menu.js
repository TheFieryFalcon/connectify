/**
 * Connectify Theme: theme menu popover
 *
 * Lists the registered dark themes (with Edit ✎ and Delete ✕ buttons on custom ones), Customize Theme and Import Theme,
 * anchored under the navbar toggle. Selecting a theme goes through the registry, whose
 * connectify:themechange event lets theme.js apply it. Exposes window.ConnectifyThemeMenu.
 */
(() => {
  'use strict';

  let themeMenu = null;
  const toggleButton = () => window.ConnectifyThemeToggle?.button || null;

  function close() {
    if (themeMenu) {
      themeMenu.remove();
      themeMenu = null;
    }
    toggleButton()?.setAttribute('aria-expanded', 'false');
  }

  function createOption(theme, activeId, anchorEl) {
    const reg = window.ConnectifyThemeRegistry;
    const opt = document.createElement('button');
    opt.type = 'button';
    opt.className = `connectify-theme-option${theme.id === activeId ? ' eds-s-is-active' : ''}`;
    opt.setAttribute('role', 'menuitem');
    const swatch = document.createElement('span');
    swatch.className = 'connectify-theme-swatch';
    swatch.style.backgroundColor = (theme.swatch && theme.swatch[1]) || '#1e2632';
    const icon = document.createElement('span');
    icon.className = 'connectify-theme-icon';
    icon.textContent = theme.icon;
    const name = document.createElement('span');
    name.className = 'connectify-theme-name';
    name.textContent = theme.name;
    opt.append(swatch, icon, name);
    if (theme.isCustom) {
      const actionButton = (className, text, title, onClick) => {
        const btn = document.createElement('span');
        btn.className = className;
        btn.textContent = text;
        btn.title = title;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', `${title}: ${theme.name}`);
        btn.onclick = ev => {
          ev.stopPropagation();
          onClick();
        };
        return btn;
      };
      const actions = document.createElement('span');
      actions.className = 'connectify-theme-actions';
      actions.append(
        // Opens the customizer on this theme; saving updates it in place, even after a rename
        actionButton('connectify-theme-edit-btn', '✎', 'Edit theme', () => {
          close();
          window.ConnectifyThemeCustomizer?.open(reg?.getThemeDefinition?.(theme.id) || theme);
        }),
        actionButton('connectify-theme-delete-btn', '✕', 'Delete theme', () => {
          if (reg?.deleteCustomTheme) { reg.deleteCustomTheme(theme.id); open(anchorEl); }
        })
      );
      opt.append(actions);
    }
    opt.onclick = e => {
      e.stopPropagation();
      reg?.setTheme(theme.id);
      close();
    };
    return opt;
  }

  function open(anchorEl) {
    close();
    const reg = window.ConnectifyThemeRegistry;
    if (!reg || window.ConnectifyThemeAuth?.isAuthDisabled()) return;
    toggleButton()?.setAttribute('aria-expanded', 'true');
    themeMenu = document.createElement('div');
    themeMenu.id = 'connectify-theme-menu';
    themeMenu.setAttribute('role', 'menu');

    const activeId = reg.getTheme();
    for (const theme of reg.getAvailableThemes().filter(t => t.id !== 'light' && t.id !== 'custom')) {
      themeMenu.appendChild(createOption(theme, activeId, anchorEl));
    }

    const action = (id, icon, label, run) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = id;
      btn.className = 'connectify-theme-customize-btn connectify-customize-action';
      btn.setAttribute('role', 'menuitem');
      btn.innerHTML = `<span class="connectify-customize-icon">${icon}</span><span class="connectify-theme-name">${label}</span>`;
      btn.onclick = e => {
        e.stopPropagation();
        close();
        run();
      };
      themeMenu.appendChild(btn);
    };
    action('connectify-theme-customize', '✨', 'Customize Theme...', () => window.ConnectifyThemeCustomizer?.open());
    // A .ctme (or older .json) file is saved as a custom theme and applied (theme-import.js)
    action('connectify-theme-import', '📥', 'Import Theme...', () => window.ConnectifyThemeImport?.pick());

    const rect = (anchorEl || toggleButton()).getBoundingClientRect();
    themeMenu.style.position = 'fixed';
    themeMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    themeMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    // Attached to <body>, never inside the toggle button, so menu buttons are not nested in it
    document.body.appendChild(themeMenu);
  }

  function toggle(anchorEl) {
    if (themeMenu) close();
    else open(anchorEl);
  }

  document.addEventListener('click', e => {
    if (themeMenu && !themeMenu.contains(e.target) && !toggleButton()?.contains(e.target)) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && themeMenu) close();
  });

  window.ConnectifyThemeMenu = { open, close, toggle, isOpen: () => Boolean(themeMenu) };
})();
