/**
 * Connectify Theme Registry & Palette Engine
 *
 * Manages theme registration, switching, persistence, and custom palette tokens.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'connectea:theme:v1';
  const STORAGE_THEME_ID = 'connectea:theme:id';
  const RESTORE_KEY = 'connectea:theme:restore_dark';
  const STORAGE_CUSTOM_COLORS = 'connectea:theme:custom_colors';

  const DEFAULT_CUSTOM_COLORS = {
    canvas: '#111827',
    surface: '#1f2937',
    border: '#374151',
    accent: '#6366f1',
    textPrimary: '#f9fafb',
    textSecondary: '#d1d5db'
  };

  const BUILTIN_PALETTES = {
    dark: { name: 'Dark', icon: '🌙', isDark: true, swatch: ['#12171f', '#1e2632', '#3b82f6'], canvas: '#12171f', canvasSubtle: '#0a0d12', surface: '#1e2632', surfaceSecondary: '#18202b', surfaceElevated: '#263242', surfaceHover: '#263344', border: '#455a73', borderSubtle: '#2e3c4e', borderStrong: '#5a7391', accent: '#3b82f6', accentHover: '#60a5fa', textPrimary: '#f8fafc', textSecondary: '#e2e8f0', tileLinkColor: '#f8fafc', button: '#202c3b', buttonHover: '#2c3b4e', buttonText: '#f1f5f9', inputBg: '#141a22', inputBorder: '#42556d' },
    quantum: { name: 'Quantum Dark', icon: '⚛️', isDark: true, swatch: ['#282828', '#32302f', '#fabd2f'], canvas: '#282828', canvasSubtle: '#191b1c', surface: '#32302f', surfaceSecondary: '#282828', surfaceElevated: '#3c3836', surfaceHover: '#504944', border: '#5a524c', borderSubtle: '#3c3836', borderStrong: '#665c54', accent: '#fabd2f', accentHover: '#fcd34d', textPrimary: '#fbf1c7', textSecondary: '#b8bb26', tileLinkColor: '#fbf1c7', button: '#3c3836', buttonHover: '#504944', buttonText: '#fbf1c7', inputBg: '#1d2021', inputBorder: '#504944' },
    amoled: { name: 'AMOLED Black', icon: '🌑', isDark: true, swatch: ['#000000', '#0a0a0a', '#38bdf8'], canvas: '#000000', canvasSubtle: '#050505', surface: '#0d0d0d', surfaceSecondary: '#141414', surfaceElevated: '#1a1a1a', surfaceHover: '#1f1f1f', border: '#333333', borderSubtle: '#222222', borderStrong: '#444444', accent: '#38bdf8', accentHover: '#7dd3fc', textPrimary: '#ffffff', textSecondary: '#d4d4d4', tileLinkColor: '#ffffff', button: '#121212', buttonHover: '#202020', buttonText: '#ffffff', inputBg: '#050505', inputBorder: '#262626' },
    midnight: { name: 'Midnight Navy', icon: '🌌', isDark: true, swatch: ['#0b132b', '#141f36', '#60a5fa'], canvas: '#0b132b', canvasSubtle: '#050914', surface: '#121e38', surfaceSecondary: '#18284a', surfaceElevated: '#1f325c', surfaceHover: '#253c6e', border: '#355085', borderSubtle: '#233559', borderStrong: '#4568a8', accent: '#60a5fa', accentHover: '#93c5fd', textPrimary: '#f1f5f9', textSecondary: '#cbd5e1', tileLinkColor: '#f1f5f9', button: '#182642', buttonHover: '#22355c', buttonText: '#f1f5f9', inputBg: '#0e1830', inputBorder: '#2a3c61' },
    forest: { name: 'Emerald Forest', icon: '🌲', isDark: true, swatch: ['#0a1914', '#11261f', '#10b981'], canvas: '#0a1914', canvasSubtle: '#050d0a', surface: '#122820', surfaceSecondary: '#173329', surfaceElevated: '#1e4235', surfaceHover: '#244f3f', border: '#326753', borderSubtle: '#1e4235', borderStrong: '#44886f', accent: '#10b981', accentHover: '#34d399', textPrimary: '#ecfdf5', textSecondary: '#d1fae5', tileLinkColor: '#ecfdf5', button: '#132c24', buttonHover: '#1a3b30', buttonText: '#ecfdf5', inputBg: '#0d1f19', inputBorder: '#224a3b' },
    sunset: { name: 'Twilight Plum', icon: '🌅', isDark: true, swatch: ['#19111c', '#26182a', '#f43f5e'], canvas: '#19111c', canvasSubtle: '#0d080e', surface: '#28182c', surfaceSecondary: '#351f3b', surfaceElevated: '#44274c', surfaceHover: '#4e2c56', border: '#64396f', borderSubtle: '#412548', borderStrong: '#824b91', accent: '#f43f5e', accentHover: '#fb7185', textPrimary: '#fdf2f8', textSecondary: '#fce7f3', tileLinkColor: '#fdf2f8', button: '#2b1930', buttonHover: '#3a2241', buttonText: '#fdf2f8', inputBg: '#1e1322', inputBorder: '#4b2a54' },
    'liquid-glass': { name: 'Liquid Glass', icon: '🫧', isDark: true, swatch: ['#0b1120', 'rgba(56, 189, 248, 0.25)', '#38bdf8'], liquidGlass: true, canvas: '#0b1120', canvasSubtle: '#080d19', surface: 'rgba(26, 36, 52, 0.72)', surfaceSecondary: 'rgba(18, 24, 38, 0.68)', surfaceElevated: 'rgba(38, 51, 72, 0.80)', surfaceHover: 'rgba(255, 255, 255, 0.14)', border: 'rgba(255, 255, 255, 0.22)', borderSubtle: 'rgba(255, 255, 255, 0.12)', borderStrong: 'rgba(255, 255, 255, 0.32)', accent: '#38bdf8', accentHover: '#7dd3fc', textPrimary: '#ffffff', textSecondary: '#dbeafe', tileLinkColor: '#ffffff', button: 'rgba(255, 255, 255, 0.10)', buttonHover: 'rgba(255, 255, 255, 0.18)', buttonText: '#ffffff', inputBg: 'rgba(15, 23, 42, 0.60)', inputBorder: 'rgba(255, 255, 255, 0.14)' }
  };

  const BUILTIN_THEMES = [
    ...Object.entries(BUILTIN_PALETTES).map(([id, p]) => ({ id, name: p.name, icon: p.icon, isDark: p.isDark, swatch: p.swatch })),
    { id: 'light', name: 'Default', icon: '☀', isDark: false, swatch: ['#f8fafc', '#ffffff', '#3b82f6'] },
    { id: 'custom', name: 'Custom Theme', icon: '🎨', isDark: true, swatch: ['#111827', '#1f2937', '#6366f1'] }
  ];

  const registry = new Map();
  for (const theme of BUILTIN_THEMES) {
    registry.set(theme.id, { ...theme });
  }

  const isLoginUrl = (url = (typeof window !== 'undefined' ? window.location?.href : '')) => {
    try {
      const loc = new URL(url);
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const isLoginHost = loc.hostname === 'login.det.wa.edu.au';
      const isLoginPath = loc.pathname === '/login' ||
        loc.pathname.startsWith('/login/') ||
        loc.pathname.includes('/portal/login');
      return (isConnect && isLoginPath) || isLoginHost;
    } catch {
      return typeof url === 'string' && (
        url === 'https://connect.det.wa.edu.au/login' ||
        url.startsWith('https://connect.det.wa.edu.au/login') ||
        url.includes('login.det.wa.edu.au')
      );
    }
  };

  const isLogoutUrl = (url = (typeof window !== 'undefined' ? window.location?.href : '')) => {
    try {
      const loc = new URL(url, typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://connect.det.wa.edu.au');
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const path = loc.pathname.toLowerCase(), search = loc.search.toLowerCase();
      const isPath = path === '/logout' || path.startsWith('/logout/') || path.includes('/portal/logout') || path.includes('/c/portal/logout') || path.includes('/web/guest/logout') || path.includes('/signout') || path.includes('/sign-out') || path.includes('loggedout') || path.includes('logged-out');
      const isParam = search.includes('logout') || search.includes('logged_out') || search.includes('signed_out') || search.includes('session_expired');
      if ((isConnect && (isPath || isParam)) || loc.hostname === 'logout.det.wa.edu.au' || isPath) return true;
      if (typeof document !== 'undefined' && (!url || (typeof window !== 'undefined' && url === window.location?.href))) {
        if (/logged out|signed out/i.test(document.title || '')) return true;
        const msg = document.querySelector('.portlet-msg-info, .alert-info, .login-status, .cvr-c-status-message');
        if (msg && /logged out|signed out|session.*expired/i.test(msg.textContent || '')) return true;
      }
      return false;
    } catch { return typeof url === 'string' && /logout|signout|sign-out|loggedout/i.test(url); }
  };

  const isAuthDisabled = (url) => isLoginUrl(url) || isLogoutUrl(url);

  if (isAuthDisabled()) {
    try {
      const isDark = localStorage.getItem(STORAGE_KEY) === 'dark';
      if (isDark || localStorage.getItem(RESTORE_KEY) === 'true') {
        localStorage.setItem(RESTORE_KEY, 'true');
        const savedTheme = localStorage.getItem(STORAGE_THEME_ID);
        if (savedTheme && savedTheme !== 'light') {
          localStorage.setItem('connectea:theme:restore_theme', savedTheme);
        }
      }
      localStorage.setItem(STORAGE_KEY, 'light');
      localStorage.setItem(STORAGE_THEME_ID, 'light');
    } catch {}
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.remove('connectea-dark');
      delete document.documentElement.dataset.connecteaTheme;
      document.documentElement.removeAttribute('data-connectea-theme');
      document.documentElement.setAttribute('data-connectea-login', 'true');
      if (isLogoutUrl()) document.documentElement.setAttribute('data-connectea-logout', 'true');
      else document.documentElement.removeAttribute('data-connectea-logout');
      if (document.body) {
        document.body.classList.remove('connectea-dark');
        delete document.body.dataset.connecteaTheme;
        document.body.removeAttribute('data-connectea-theme');
      }
      clearCustomTokens();
    }
  }

  function getAvailableThemes() {
    return Array.from(registry.values());
  }

  const STORAGE_CUSTOM_THEMES_LIST = 'connectea:custom_themes_list';

  function getCustomThemes() {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_THEMES_LIST);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  function loadSavedCustomThemes() {
    for (const t of getCustomThemes()) {
      if (t && t.id) registerTheme(t);
    }
  }

  function saveCustomTheme(themeDef) {
    if (!themeDef) return null;
    const name = (themeDef.name || 'Custom Theme').trim();
    const existingList = getCustomThemes();
    const existing = themeDef.id
      ? existingList.find(t => t.id === themeDef.id)
      : existingList.find(t => t.name && t.name.trim().toLowerCase() === name.toLowerCase());

    const id = themeDef.id || (existing ? existing.id : `custom_${Date.now()}`);
    const entry = {
      id,
      name,
      icon: themeDef.icon || (existing ? existing.icon : '🎨'),
      isDark: themeDef.isDark !== false,
      isCustom: true,
      liquidGlass: Boolean(themeDef.liquidGlass),
      glassBlur: typeof themeDef.glassBlur === 'number' ? themeDef.glassBlur : (existing?.glassBlur ?? 16),
      glassOpacity: typeof themeDef.glassOpacity === 'number' ? themeDef.glassOpacity : (existing?.glassOpacity ?? 0.65),
      wallpaper: themeDef.wallpaper !== undefined ? themeDef.wallpaper : (existing ? existing.wallpaper : null),
      swatch: Array.isArray(themeDef.swatch) ? themeDef.swatch : [
        themeDef.colors?.canvas || '#1e2632',
        themeDef.colors?.surface || '#283444',
        themeDef.colors?.accent || '#3b82f6'
      ],
      colors: themeDef.colors || {}
    };
    registerTheme(entry);
    try {
      const list = existingList.filter(t => t.id !== id);
      list.push(entry);
      localStorage.setItem(STORAGE_CUSTOM_THEMES_LIST, JSON.stringify(list));
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try { chrome.storage.local.set({ [STORAGE_CUSTOM_THEMES_LIST]: JSON.stringify(list) }); } catch {}
      }
    } catch {}
    return entry;
  }

  function deleteCustomTheme(themeId) {
    if (!themeId || themeId === 'light' || themeId === 'dark') return false;
    registry.delete(themeId);
    try {
      const list = getCustomThemes().filter(t => t.id !== themeId);
      localStorage.setItem(STORAGE_CUSTOM_THEMES_LIST, JSON.stringify(list));
    } catch {}
    if (getTheme() === themeId) {
      setTheme('dark');
    }
    for (const fn of listeners) {
      try { fn(getTheme(), registry.get(getTheme())); } catch {}
    }
    return true;
  }

  function registerTheme(themeDef) {
    if (!themeDef || typeof themeDef.id !== 'string') return false;
    registry.set(themeDef.id, {
      id: themeDef.id,
      name: themeDef.name || themeDef.id,
      icon: themeDef.icon || '🎨',
      isDark: themeDef.isDark !== false,
      isCustom: Boolean(themeDef.isCustom),
      liquidGlass: Boolean(themeDef.liquidGlass),
      glassBlur: typeof themeDef.glassBlur === 'number' ? themeDef.glassBlur : 16,
      glassOpacity: typeof themeDef.glassOpacity === 'number' ? themeDef.glassOpacity : 0.65,
      wallpaper: themeDef.wallpaper || null,
      swatch: Array.isArray(themeDef.swatch) ? themeDef.swatch : ['#1e2632', '#3b82f6'],
      colors: themeDef.colors || null
    });
    return true;
  }

  function getCustomColors() {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_COLORS);
      if (stored) return { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(stored) };
    } catch {}
    return { ...DEFAULT_CUSTOM_COLORS };
  }

  function applyCustomTokens(colors) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;
    const c = colors || getCustomColors();
    if (c.canvas) root.style.setProperty('--cx-canvas-bg', c.canvas);
    if (c.canvasSubtle) root.style.setProperty('--cx-canvas-subtle', c.canvasSubtle);
    if (c.surface) root.style.setProperty('--cx-surface-bg', c.surface);
    if (c.surfaceSecondary) root.style.setProperty('--cx-surface-secondary', c.surfaceSecondary);
    if (c.surfaceElevated) root.style.setProperty('--cx-surface-elevated', c.surfaceElevated);
    if (c.surfaceHover) root.style.setProperty('--cx-surface-hover', c.surfaceHover);
    if (c.border) root.style.setProperty('--cx-border', c.border);
    if (c.borderSubtle) root.style.setProperty('--cx-border-subtle', c.borderSubtle);
    if (c.borderStrong) root.style.setProperty('--cx-border-strong', c.borderStrong);
    if (c.accent) root.style.setProperty('--cx-accent', c.accent);
    if (c.accentHover) root.style.setProperty('--cx-accent-hover', c.accentHover);
    if (c.textPrimary) root.style.setProperty('--cx-text-primary', c.textPrimary);
    if (c.textSecondary) root.style.setProperty('--cx-text-secondary', c.textSecondary);
    if (c.tileLinkColor || c.textPrimary) root.style.setProperty('--cx-tile-link-color', c.tileLinkColor || c.textPrimary);
    if (c.button) root.style.setProperty('--cx-button-bg', c.button);
    if (c.buttonHover) root.style.setProperty('--cx-button-hover', c.buttonHover);
    if (c.buttonText) root.style.setProperty('--cx-button-text', c.buttonText);
    if (c.inputBg) root.style.setProperty('--cx-input-bg', c.inputBg);
    if (c.inputBorder) root.style.setProperty('--cx-input-border', c.inputBorder);
  }

  function clearCustomTokens() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;
    const props = [
      '--cx-canvas-bg', '--cx-canvas-subtle', '--cx-surface-bg', '--cx-surface-secondary',
      '--cx-surface-elevated', '--cx-surface-hover', '--cx-border', '--cx-border-subtle',
      '--cx-border-strong', '--cx-accent', '--cx-accent-hover', '--cx-text-primary',
      '--cx-text-secondary', '--cx-tile-link-color', '--cx-button-bg', '--cx-button-hover',
      '--cx-button-text', '--cx-input-bg', '--cx-input-border'
    ];
    for (const prop of props) root.style.removeProperty(prop);
  }

  function setCustomColors(colors) {
    try {
      const merged = { ...getCustomColors(), ...colors };
      localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(merged));
      if (getTheme() === 'custom') applyCustomTokens(merged);
      return true;
    } catch { return false; }
  }

  function getTheme() {
    if (isAuthDisabled()) return 'light';
    try {
      const savedId = localStorage.getItem(STORAGE_THEME_ID);
      if (savedId && registry.has(savedId)) return savedId;
      const isDark = localStorage.getItem(STORAGE_KEY) === 'dark';
      return isDark ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  }

  function isDarkMode() {
    if (isAuthDisabled()) return false;
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.classList.contains('connectea-dark');
    }
    const theme = registry.get(getTheme());
    return theme ? theme.isDark : true;
  }

  const STORAGE_LAST_THEME = 'connectea:last_theme_id';
  function getLastTheme() {
    try {
      const last = localStorage.getItem(STORAGE_LAST_THEME);
      if (last && registry.has(last) && last !== 'light') return last;
      const current = localStorage.getItem(STORAGE_THEME_ID);
      if (current && registry.has(current) && current !== 'light') return current;
    } catch {}
    return 'dark';
  }

  const listeners = new Set();
  function onThemeChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
  }

  function setTheme(themeId, customColors) {
    if (isAuthDisabled()) {
      try {
        if (themeId && themeId !== 'light') {
          localStorage.setItem(RESTORE_KEY, 'true');
          localStorage.setItem('connectea:theme:restore_theme', themeId);
        } else {
          localStorage.removeItem(RESTORE_KEY);
          localStorage.removeItem('connectea:theme:restore_theme');
        }
        localStorage.setItem(STORAGE_KEY, 'light');
        localStorage.setItem(STORAGE_THEME_ID, 'light');
      } catch {}
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.classList.remove('connectea-dark');
        delete document.documentElement.dataset.connecteaTheme;
        document.documentElement.removeAttribute('data-connectea-theme');
        document.documentElement.setAttribute('data-connectea-login', 'true');
        if (isLogoutUrl()) document.documentElement.setAttribute('data-connectea-logout', 'true');
        else document.documentElement.removeAttribute('data-connectea-logout');
        if (document.body) {
          document.body.classList.remove('connectea-dark');
          delete document.body.dataset.connecteaTheme;
          document.body.removeAttribute('data-connectea-theme');
        }
        clearCustomTokens();
      }
      return false;
    }

    const theme = registry.get(themeId) || registry.get('dark');
    const isDark = theme.isDark;

    if (isDark && theme.id !== 'light') {
      try { localStorage.setItem(STORAGE_LAST_THEME, theme.id); } catch {}
    }

    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
      localStorage.setItem(STORAGE_THEME_ID, theme.id);
    } catch {}

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('connectea-dark', isDark);
      if (document.body) document.body.classList.toggle('connectea-dark', isDark);
      if (isDark) {
        document.documentElement.dataset.connecteaTheme = theme.id;
      } else {
        delete document.documentElement.dataset.connecteaTheme;
        document.documentElement.removeAttribute('data-connectea-theme');
      }

      if (theme.id === 'liquid-glass' || theme.liquidGlass || customColors?.glassDiffusion) {
        document.documentElement.setAttribute('data-connectea-glass', 'true');
        const blurVal = theme.glassBlur ?? (customColors?.glassBlur ?? 16);
        const opVal = theme.glassOpacity ?? (customColors?.glassOpacity ?? 0.65);
        document.documentElement.style.setProperty('--cx-glass-blur', `${blurVal}px`);
        document.documentElement.style.setProperty('--cx-glass-opacity', `${opVal}`);
      } else {
        document.documentElement.removeAttribute('data-connectea-glass');
      }

      if (theme.isCustom || theme.id === 'custom' || customColors) {
        if (customColors) setCustomColors(customColors);
        else if (theme.colors) setCustomColors(theme.colors);
        applyCustomTokens(customColors || theme.colors || getCustomColors());
      } else {
        clearCustomTokens();
      }
      if (theme.wallpaper !== undefined && theme.wallpaper !== null) {
        setCustomBackground(theme.wallpaper);
      } else {
        applyCustomBackground(getCustomBackground());
      }
    }

    for (const fn of listeners) {
      try { fn(theme.id, theme); } catch {}
    }

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('connectea:themechange', { detail: { themeId: theme.id, theme } }));
      } catch {}
    }
    return true;
  }

  const STORAGE_CUSTOM_BG = 'connectea:custom_background';

  function getCustomBackground() {
    try { return localStorage.getItem(STORAGE_CUSTOM_BG) || null; } catch { return null; }
  }

  function setCustomBackground(dataUrl) {
    try {
      if (dataUrl) {
        localStorage.setItem(STORAGE_CUSTOM_BG, dataUrl);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          try { chrome.storage.local.set({ [STORAGE_CUSTOM_BG]: dataUrl }); } catch {}
        }
      } else {
        clearCustomBackground();
        return;
      }
    } catch {}
    applyCustomBackground(dataUrl);
  }

  function clearCustomBackground() {
    try {
      localStorage.removeItem(STORAGE_CUSTOM_BG);
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try { chrome.storage.local.remove(STORAGE_CUSTOM_BG); } catch {}
      }
    } catch {}
    applyCustomBackground(null);
  }

  function applyCustomBackground(bgUrl = getCustomBackground()) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (bgUrl && !isAuthDisabled()) {
      document.documentElement.setAttribute('data-connectea-has-custom-bg', 'true');
      document.documentElement.style.setProperty('--cx-custom-bg-image', `url("${bgUrl}")`);
    } else {
      document.documentElement.removeAttribute('data-connectea-has-custom-bg');
      document.documentElement.style.removeProperty('--cx-custom-bg-image');
    }
  }

  function setGlassDiffusion(enable) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (enable) document.documentElement.setAttribute('data-connectea-glass', 'true');
    else document.documentElement.removeAttribute('data-connectea-glass');
  }

  loadSavedCustomThemes();
  if (typeof document !== 'undefined') {
    applyCustomBackground();
    const curTheme = registry.get(getTheme());
    if (curTheme && (curTheme.isCustom || curTheme.id === 'custom')) {
      applyCustomTokens(curTheme.colors || getCustomColors());
    }
  }

  window.ConnectifyThemeRegistry = {
    isLoginUrl,
    isLogoutUrl,
    isAuthDisabled,
    isLoginOrLogoutUrl: isAuthDisabled,
    isDarkMode,
    getTheme,
    getLastTheme,
    setTheme,
    getAvailableThemes,
    getCustomThemes,
    saveCustomTheme,
    deleteCustomTheme,
    registerTheme,
    getCustomColors,
    setCustomColors,
    applyCustomTokens,
    clearCustomTokens,
    onThemeChange,
    getCustomBackground,
    setCustomBackground,
    clearCustomBackground,
    applyCustomBackground,
    setGlassDiffusion,
    getPresetPalettes: () => ({ ...BUILTIN_PALETTES }),
    BUILTIN_PALETTES,
    BUILTIN_THEMES
  };
})();
