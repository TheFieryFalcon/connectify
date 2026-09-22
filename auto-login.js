(() => {
  'use strict';

  const isFirefox = typeof browser !== 'undefined';
  const api = isFirefox ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  if (!api || !api.storage) return;

  const storageGet = (keys, cb) => {
      if (isFirefox) api.storage.local.get(keys).then(cb);
      else api.storage.local.get(keys, cb);
  };
  const storageSet = (obj) => {
      if (isFirefox) api.storage.local.set(obj);
      else api.storage.local.set(obj);
  };
  const storageRemove = (key) => {
      if (isFirefox) api.storage.local.remove(key);
      else api.storage.local.remove(key);
  };

  storageGet(['cx-manual-logout', 'cx-autologin-enabled'], (result) => {
      // 1. Inject the toggle UI
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
          btnContainer.appendChild(toggleLabel);
      }

      // 2. Check if we just manually logged out
      if (result['cx-manual-logout'] === true) {
          storageRemove('cx-manual-logout');
          return; // Do not auto-login this time
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
