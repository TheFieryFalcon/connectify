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

  const BUILTIN_THEMES = [
    {
      id: 'dark',
      name: 'Classic Dark',
      icon: '☾',
      isDark: true,
      swatch: ['#12171f', '#1e2632', '#3b82f6']
    },
    {
      id: 'amoled',
      name: 'AMOLED Black',
      icon: '🌑',
      isDark: true,
      swatch: ['#000000', '#0a0a0a', '#38bdf8']
    },
    {
      id: 'midnight',
      name: 'Midnight Navy',
      icon: '🌌',
      isDark: true,
      swatch: ['#0b132b', '#141f36', '#60a5fa']
    },
    {
      id: 'forest',
      name: 'Emerald Forest',
      icon: '🌲',
      isDark: true,
      swatch: ['#0a1914', '#11261f', '#10b981']
    },
    {
      id: 'sunset',
      name: 'Twilight Plum',
      icon: '🌅',
      isDark: true,
      swatch: ['#19111c', '#26182a', '#f43f5e']
    },
    {
      id: 'light',
      name: 'Default Light',
      icon: '☀',
      isDark: false,
      swatch: ['#f8fafc', '#ffffff', '#3b82f6']
    },
    {
      id: 'custom',
      name: 'Custom Theme',
      icon: '🎨',
      isDark: true,
      swatch: ['#111827', '#1f2937', '#6366f1']
    }
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

  if (isLoginUrl()) {
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

  function registerTheme(themeDef) {
    if (!themeDef || typeof themeDef.id !== 'string') return false;
    registry.set(themeDef.id, {
      id: themeDef.id,
      name: themeDef.name || themeDef.id,
      icon: themeDef.icon || '🎨',
      isDark: themeDef.isDark !== false,
      swatch: Array.isArray(themeDef.swatch) ? themeDef.swatch : ['#1e2632', '#3b82f6'],
      colors: themeDef.colors || null
    });
    return true;
  }

  function getCustomColors() {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_COLORS);
      if (stored) {
        return { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(stored) };
      }
    } catch {}
    return { ...DEFAULT_CUSTOM_COLORS };
  }

  function applyCustomTokens(colors) {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;
    const c = colors || getCustomColors();
    root.style.setProperty('--cx-canvas-bg', c.canvas || '#111827');
    root.style.setProperty('--cx-surface-bg', c.surface || '#1f2937');
    root.style.setProperty('--cx-surface-secondary', c.surface || '#1f2937');
    root.style.setProperty('--cx-surface-elevated', c.surface || '#1f2937');
    root.style.setProperty('--cx-border', c.border || '#374151');
    root.style.setProperty('--cx-accent', c.accent || '#6366f1');
    root.style.setProperty('--cx-text-primary', c.textPrimary || '#f9fafb');
    root.style.setProperty('--cx-text-secondary', c.textSecondary || '#d1d5db');
  }

  function clearCustomTokens() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (!root) return;
    const props = [
      '--cx-canvas-bg', '--cx-surface-bg', '--cx-surface-secondary',
      '--cx-surface-elevated', '--cx-border', '--cx-accent',
      '--cx-text-primary', '--cx-text-secondary'
    ];
    for (const prop of props) {
      root.style.removeProperty(prop);
    }
  }

  function setCustomColors(colors) {
    try {
      const merged = { ...getCustomColors(), ...colors };
      localStorage.setItem(STORAGE_CUSTOM_COLORS, JSON.stringify(merged));
      if (getTheme() === 'custom') {
        applyCustomTokens(merged);
      }
      return true;
    } catch {
      return false;
    }
  }

  function getTheme() {
    if (isLoginUrl()) return 'light';
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
    if (isLoginUrl()) return false;
    if (typeof document !== 'undefined' && document.documentElement) {
      return document.documentElement.classList.contains('connectea-dark');
    }
    const theme = registry.get(getTheme());
    return theme ? theme.isDark : true;
  }

  const listeners = new Set();
  function onThemeChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
  }

  function setTheme(themeId, customColors) {
    if (isLoginUrl()) {
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

    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
      localStorage.setItem(STORAGE_THEME_ID, theme.id);
    } catch {}

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.classList.toggle('connectea-dark', isDark);
      if (document.body) {
        document.body.classList.toggle('connectea-dark', isDark);
      }
      document.documentElement.dataset.connecteaTheme = theme.id;

      if (theme.id === 'custom' || customColors) {
        if (customColors) setCustomColors(customColors);
        applyCustomTokens(customColors || getCustomColors());
      } else {
        clearCustomTokens();
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

  window.ConnectifyThemeRegistry = {
    isLoginUrl,
    isDarkMode,
    getTheme,
    setTheme,
    getAvailableThemes,
    registerTheme,
    getCustomColors,
    setCustomColors,
    applyCustomTokens,
    onThemeChange,
    BUILTIN_THEMES
  };
})();
