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

  // An expired session signs straight back in: only a manual logout or a login in the last 30s pause it
  storageGet(['cx-manual-logout', 'cx-autologin-enabled', 'cx-last-autologin'], (result) => {
      // 1. Detect if this page was reached by logging out
      const isManualLogout = result['cx-manual-logout'] === true;
      const lastLogin = Number(result['cx-last-autologin'] || 0);
      const isRapidLoop = (Date.now() - lastLogin) < 30000; // prevent rapid looping within 30s

      const shouldBlockAutoLogin = isManualLogout || isRapidLoop;

      // Clean up one-shot flags (cx-session-expired: left by versions that paused on an expired session)
      if (isManualLogout) storageRemove('cx-manual-logout');
      storageRemove('cx-session-expired');

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
              notice.textContent = isManualLogout ? '(Paused: logged out)' : '(Paused)';
              btnContainer.appendChild(toggleLabel);
              btnContainer.appendChild(notice);
          } else {
              btnContainer.appendChild(toggleLabel);
          }

          loginBtn.addEventListener('click', () => {
              storageSet({ 'cx-last-autologin': Date.now() });
              storageRemove('cx-manual-logout');
          });
      }

      if (shouldBlockAutoLogin) {
          return; // Do not auto-login: let a manual logout take effect
      }

      // Only a saved password / browser autofill may log in: anything the user typed or pasted is left alone
      let userTyped = false;
      const markTyped = () => { userTyped = true; };
      // Chromium matches :autofill before it releases a saved password's value to the page (and to a submitted form):
      // only a readable value counts, and the release fires 'input', which retries the login
      const isFilled = el => el.value.trim() !== '';

      let submitted = false;
      const submitLogin = (user, pass) => {
        const userField = document.getElementById('ssousername');
        const passField = document.getElementById('password');
        const termsBox = document.querySelector('input[name="acceptterms"]');
        const loginBtn = document.getElementById('login');
        if (submitted || userTyped || !userField || !passField || !loginBtn) return;
        if (user !== undefined) {
          userField.value = user;
          passField.value = pass;
        }
        if (!isFilled(userField) || !isFilled(passField)) return;
        submitted = true;
        if (termsBox && !termsBox.checked) {
          termsBox.checked = true;
        }

        storageSet({ 'cx-last-autologin': Date.now() });
        loginBtn.value = 'Logging in...';
        loginBtn.style.opacity = '0.8';
        loginBtn.click();
      };

      const attemptLogin = () => {
        storageGet(['cx-autologin-enabled'], (res) => {
            if (res['cx-autologin-enabled'] === false || userTyped) return;
            submitLogin();
        });
      };

      // Chromium never releases an autofilled password untouched: ask its password manager for the saved one
      if (result['cx-autologin-enabled'] !== false) {
          window.ConnectifyAutoLoginCredentials?.saved().then(cred => {
              if (cred) submitLogin(cred.id, cred.password);
          });
      }

      // 3. Attempt instantly
      attemptLogin();
      
      // If not immediately filled, try listening to inputs
      const userField = document.getElementById('ssousername');
      const passField = document.getElementById('password');
      if (userField && passField) {
          for (const field of [userField, passField]) {
              field.addEventListener('keydown', markTyped);
              field.addEventListener('paste', markTyped);
          }
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
