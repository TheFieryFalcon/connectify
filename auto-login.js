(() => {
  'use strict';
  
  // Inject the toggle UI
  const btnContainer = document.querySelector('#buttons td:nth-child(2)');
  if (btnContainer) {
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
      toggleInput.checked = localStorage.getItem('cx-autologin-enabled') !== 'false';
      
      toggleInput.addEventListener('change', () => {
          localStorage.setItem('cx-autologin-enabled', toggleInput.checked);
      });
      
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(document.createTextNode('Auto-login'));
      btnContainer.appendChild(toggleLabel);
  }

  // Check if we just manually logged out
  if (localStorage.getItem('cx-manual-logout') === 'true') {
      localStorage.removeItem('cx-manual-logout');
      return; // Do not auto-login this time
  }

  const attemptLogin = () => {
    if (localStorage.getItem('cx-autologin-enabled') === 'false') return false;
    
    const userField = document.getElementById('ssousername');
    const passField = document.getElementById('password');
    const termsBox = document.querySelector('input[name="acceptterms"]');
    const loginBtn = document.getElementById('login');
    
    if (userField && passField && loginBtn) {
      if (userField.value.trim() !== '' && passField.value !== '') {
        if (termsBox && !termsBox.checked) {
          termsBox.checked = true;
        }
        
        loginBtn.value = 'Logging In...';
        loginBtn.style.opacity = '0.8';
        loginBtn.click();
        return true;
      }
    }
    return false;
  };

  // Attempt instantly
  if (!attemptLogin()) {
      // If not immediately filled, try listening to inputs
      const userField = document.getElementById('ssousername');
      const passField = document.getElementById('password');
      if (userField && passField) {
          userField.addEventListener('input', attemptLogin);
          passField.addEventListener('input', attemptLogin);
          userField.addEventListener('change', attemptLogin);
          passField.addEventListener('change', attemptLogin);
      }
      
      // Also loop a few times very fast just in case the browser fills it immediately after load
      let attempts = 0;
      const interval = setInterval(() => {
        if (attemptLogin() || attempts++ > 20) {
          clearInterval(interval);
        }
      }, 50);
  }
})();
