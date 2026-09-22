(() => {
  'use strict';
  
  const attemptLogin = () => {
    const userField = document.getElementById('ssousername');
    const passField = document.getElementById('password');
    const termsBox = document.querySelector('input[name="acceptterms"]');
    const loginBtn = document.getElementById('login');
    
    if (userField && passField && loginBtn) {
      // Check if browser autofill has populated the fields
      if (userField.value.trim() !== '' && passField.value !== '') {
        if (termsBox && !termsBox.checked) {
          termsBox.checked = true;
        }
        
        // Add a visual indicator that auto-login is happening
        loginBtn.value = 'Auto-Logging In...';
        loginBtn.style.opacity = '0.8';
        loginBtn.click();
        return true;
      }
    }
    return false;
  };

  // The browser might take a moment to autofill the credentials.
  // We poll a few times over the first second.
  let attempts = 0;
  const maxAttempts = 10;
  
  const interval = setInterval(() => {
    if (attemptLogin() || attempts >= maxAttempts) {
      clearInterval(interval);
    }
    attempts++;
  }, 150);

  // Also listen for change events in case the user selects an account from a dropdown
  document.addEventListener('change', (e) => {
    if (e.target.id === 'ssousername' || e.target.id === 'password') {
       setTimeout(attemptLogin, 50);
    }
  });
})();
