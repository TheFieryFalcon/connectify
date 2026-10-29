(() => {
  'use strict';

  // Chromium shows a saved password in the field but keeps its value from the page (and from a submitted form)
  // until the user touches the page, so on its own auto-login never fires there. The Credential Management API
  // hands the same saved password to the page: signed in at once when Chrome's auto sign-in allows it, else
  // after the student picks the account in Chrome's chooser. Firefox and Safari have no PasswordCredential.
  const saved = () => {
    if (typeof window.PasswordCredential !== 'function' || !navigator.credentials?.get) return Promise.resolve(null);
    return navigator.credentials.get({ password: true, mediation: 'optional' })
      .then(cred => (cred && cred.type === 'password' && cred.id && cred.password ? { id: cred.id, password: cred.password } : null))
      .catch(() => null);
  };

  window.ConnectifyAutoLoginCredentials = { saved };
})();
