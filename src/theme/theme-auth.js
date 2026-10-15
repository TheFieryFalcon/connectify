/**
 * Connectify Theme: login & logout page detection
 *
 * Themes are switched off on Connect's login and logout pages and the dark theme comes back after
 * signing in. Shared by the theme registry and the theme engine so both agree on what counts as an auth page.
 * Exposes window.ConnectifyThemeAuth.
 */
(() => {
  'use strict';

  const currentUrl = () => (typeof window !== 'undefined' ? window.location?.href : '');

  const isLoginUrl = (url = currentUrl()) => {
    try {
      const loc = new URL(url);
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const isLoginHost = loc.hostname === 'login.det.wa.edu.au';
      const isLoginPath = loc.pathname === '/login' || loc.pathname.startsWith('/login/') || loc.pathname.includes('/portal/login');
      return (isConnect && isLoginPath) || isLoginHost;
    } catch {
      return typeof url === 'string' && (
        url === 'https://connect.det.wa.edu.au/login' ||
        url.startsWith('https://connect.det.wa.edu.au/login') ||
        url.includes('login.det.wa.edu.au')
      );
    }
  };

  const LOGOUT_PATHS = ['/portal/logout', '/c/portal/logout', '/web/guest/logout', '/signout', '/sign-out', 'loggedout', 'logged-out'];
  const LOGOUT_PARAMS = ['logout', 'logged_out', 'signed_out', 'session_expired'];

  const isLogoutUrl = (url = currentUrl()) => {
    try {
      const base = typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://connect.det.wa.edu.au';
      const loc = new URL(url, base);
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const path = loc.pathname.toLowerCase();
      const search = loc.search.toLowerCase();
      const isPath = path === '/logout' || path.startsWith('/logout/') || LOGOUT_PATHS.some(p => path.includes(p));
      const isParam = LOGOUT_PARAMS.some(p => search.includes(p));
      if ((isConnect && (isPath || isParam)) || loc.hostname === 'logout.det.wa.edu.au' || isPath) return true;
      // The logged-out page reuses ordinary URLs, so the current page is also checked by its content
      if (typeof document !== 'undefined' && (!url || url === currentUrl())) {
        if (/logged out|signed out/i.test(document.title || '')) return true;
        const msg = document.querySelector('.portlet-msg-info, .alert-info, .login-status, .cvr-c-status-message');
        if (msg && /logged out|signed out|session.*expired/i.test(msg.textContent || '')) return true;
      }
      return false;
    } catch {
      return typeof url === 'string' && /logout|signout|sign-out|loggedout/i.test(url);
    }
  };

  const isAuthDisabled = url => isLoginUrl(url) || isLogoutUrl(url);

  const STORAGE_KEY = 'connectea:theme:v1';
  const STORAGE_THEME_ID = 'connectea:theme:id';
  const RESTORE_KEY = 'connectea:theme:restore_dark';
  const RESTORE_THEME_KEY = 'connectea:theme:restore_theme';

  // On the login/logout page: remember the active dark theme so it returns after signing in
  function rememberThemeForLogin(themeId) {
    try {
      localStorage.setItem(RESTORE_KEY, 'true');
      const cur = themeId || localStorage.getItem(STORAGE_THEME_ID);
      if (cur && cur !== 'light') localStorage.setItem(RESTORE_THEME_KEY, cur);
    } catch {}
  }

  function forgetThemeForLogin() {
    try {
      localStorage.removeItem(RESTORE_KEY);
      localStorage.removeItem(RESTORE_THEME_KEY);
    } catch {}
  }

  // Back on a normal page: consumes the remembered theme and returns its id (null if none)
  function takeThemeToRestore() {
    try {
      if (localStorage.getItem(RESTORE_KEY) !== 'true') return null;
      const restored = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
      forgetThemeForLogin();
      localStorage.setItem(STORAGE_KEY, 'dark');
      localStorage.setItem(STORAGE_THEME_ID, restored);
      return restored;
    } catch { return null; }
  }

  /** Strips every theme hook from <html> and <body> and marks the page as a login/logout page. */
  function markAuthPage() {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return;
    for (const el of [root, document.body].filter(Boolean)) {
      el.classList.remove('connectea-dark');
      delete el.dataset.connecteaTheme;
      el.removeAttribute('data-connectea-theme');
    }
    root.setAttribute('data-connectea-login', 'true');
    if (isLogoutUrl()) root.setAttribute('data-connectea-logout', 'true');
    else root.removeAttribute('data-connectea-logout');
  }

  window.ConnectifyThemeAuth = { isLoginUrl, isLogoutUrl, isAuthDisabled, markAuthPage, rememberThemeForLogin, forgetThemeForLogin, takeThemeToRestore };
})();
