(() => {
  'use strict';

  if (window.__connectifyAutoLoginInitialized) return;
  window.__connectifyAutoLoginInitialized = true;

  const api = (typeof browser !== 'undefined' && browser?.storage)
    ? browser
    : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
  if (!api || !api.storage || !api.storage.local) return;

  const storageGet = (keys, cb) => {
    try {
      let handled = false;
      const callback = res => {
        if (handled) return;
        handled = true;
        if (res) cb(res);
      };
      const p = api.storage.local.get(keys, callback);
      if (p && typeof p.then === 'function') {
        p.then(callback).catch(() => {});
      }
    } catch (e) {}
  };
  const storageSet = (obj) => {
    try {
      const p = api.storage.local.set(obj);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  };
  const storageRemove = (key) => {
    try {
      const p = api.storage.local.remove(key);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  };

  storageGet(['cx-manual-logout', 'cx-session-expired', 'cx-autologin-enabled', 'cx-last-autologin'], (result) => {
      // 1. Detect if this page was reached due to session expiry or logout
      const isManualLogout = result['cx-manual-logout'] === true;
      const isStoredExpired = result['cx-session-expired'] === true;
      const isTimeoutUrl = /timeout|expired|logout|inactivity|reason=/i.test(window.location.href);
      const bodyText = (document.body?.innerText || '').toLowerCase();
      const isTimeoutPage = /session\s*(has\s*)?(expired|timed\s*out)|logged\s*out\s*due\s*to\s*inactivity|inactivity\s*timeout|session\s*timeout/i.test(bodyText);
      const lastLogin = Number(result['cx-last-autologin'] || 0);
      const isRapidLoop = (Date.now() - lastLogin) < 30000; // prevent rapid looping within 30s

      const isSessionExpired = isStoredExpired || isTimeoutUrl || isTimeoutPage;
      const shouldBlockAutoLogin = isManualLogout || isSessionExpired || isRapidLoop;

      // Clean up one-shot flags
      if (isManualLogout) storageRemove('cx-manual-logout');
      if (isStoredExpired) storageRemove('cx-session-expired');

      // 2. Inject the toggle UI and status feedback
      const loginBtn = document.getElementById('login');
      if (loginBtn && loginBtn.parentElement) {
          const btnContainer = loginBtn.parentElement;
          
          const toggleLabel = document.createElement('label');
          toggleLabel.style.display = 'inline-flex';
          toggleLabel.style.alignItems = 'center';
          toggleLabel.style.marginLeft = '16px';
          toggleLabel.style.fontSize = '12px';
          toggleLabel.style.color = '#333';
          toggleLabel.style.cursor = 'pointer';
          
          const toggleInput = document.createElement('input');
          toggleInput.type = 'checkbox';
          toggleInput.style.marginRight = '6px';
          toggleInput.checked = result['cx-autologin-enabled'] !== false;
          
          toggleInput.addEventListener('change', () => {
              storageSet({'cx-autologin-enabled': toggleInput.checked});
          });
          
          toggleLabel.appendChild(toggleInput);
          toggleLabel.appendChild(document.createTextNode('Auto-login'));

          if (shouldBlockAutoLogin) {
              const notice = document.createElement('span');
              notice.style.marginLeft = '10px';
              notice.style.fontSize = '11.5px';
              notice.style.color = '#c0392b';
              notice.style.fontWeight = '500';
              notice.textContent = isSessionExpired
                ? '(Paused: session expired)'
                : isManualLogout
                ? '(Paused: logged out)'
                : '(Paused)';
              btnContainer.appendChild(toggleLabel);
              btnContainer.appendChild(notice);
          } else {
              btnContainer.appendChild(toggleLabel);
          }

          loginBtn.addEventListener('click', () => {
              storageSet({ 'cx-last-autologin': Date.now() });
              storageRemove('cx-manual-logout');
              storageRemove('cx-session-expired');
          });
      }

      if (shouldBlockAutoLogin) {
          return; // Do not auto-login: let session expiry or manual logout take effect
      }

      const attemptLogin = () => {
        storageGet(['cx-autologin-enabled'], (res) => {
            if (res['cx-autologin-enabled'] === false) return;
            
            const userField = document.getElementById('ssousername');
            const passField = document.getElementById('password');
            const termsBox = document.querySelector('input[name="acceptterms"]');
            const loginBtn = document.getElementById('login');
            
            if (userField && passField && loginBtn) {
              if (userField.value.trim() !== '' && passField.value !== '') {
                if (termsBox && !termsBox.checked) {
                  termsBox.checked = true;
                }
                
                storageSet({ 'cx-last-autologin': Date.now() });
                loginBtn.value = 'Logging in...';
                loginBtn.style.opacity = '0.8';
                loginBtn.click();
              }
            }
        });
      };

      // 3. Attempt instantly
      attemptLogin();
      
      // If not immediately filled, try listening to inputs
      const userField = document.getElementById('ssousername');
      const passField = document.getElementById('password');
      if (userField && passField) {
          userField.addEventListener('input', attemptLogin);
          passField.addEventListener('input', attemptLogin);
          userField.addEventListener('change', attemptLogin);
          passField.addEventListener('change', attemptLogin);
      }
      
      // Also loop a few times very fast just in case the browser fills it asynchronously
      let attempts = 0;
      const interval = setInterval(() => {
        attemptLogin();
        if (attempts++ > 20) {
          clearInterval(interval);
        }
      }, 50);
  });
})();
