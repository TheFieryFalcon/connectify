/**
 * Connectify WACE Exam Countdown
 *
 * Automatically detects whether the student is enrolled in Year 12 ATAR courses,
 * calculates days remaining until official WACE examinations, and injects a sleek
 * countdown indicator into the student view.
 */
(() => {
  'use strict';

  if (window.ConnectifyCountdown) return;

  function updateCountdown() {
    const titles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent);
    const isYear12 = titles.some(t => /12/i.test(t) || /AT[A-Z]{3}/.test(t));
    if (!isYear12) {
      document.getElementById('connectify-wace-countdown')?.remove();
      return;
    }

    const mainContent = document.getElementById('main-content') || document.body;
    let countdown = document.getElementById('connectify-wace-countdown');
    if (!countdown) {
      countdown = document.createElement('div');
      countdown.id = 'connectify-wace-countdown';
      countdown.className = 'connectea-panel';
      countdown.style.textAlign = 'center';
      countdown.style.fontWeight = 'bold';
      countdown.style.fontSize = '14px';
      countdown.style.margin = '16px auto';
      countdown.style.maxWidth = '600px';
      countdown.style.background = '#333333';
      countdown.style.color = '#d4b483';
      countdown.style.border = '1px solid #d4b483';
      countdown.style.borderRadius = '6px';
      countdown.style.padding = '8px 16px';
      mainContent.prepend(countdown);
    }

    const now = new Date();
    // Typical WACE commencement: late October (~Oct 28)
    const examDate = new Date(now.getFullYear(), 9, 28);
    if (now > examDate && now.getMonth() > 10) examDate.setFullYear(now.getFullYear() + 1);

    const days = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
    if (days >= 0 && days <= 300) {
      countdown.innerHTML = `⏳ <span>${days} days until WACE Exams</span>`;
      countdown.style.display = '';
    } else {
      countdown.style.display = 'none';
    }
  }

  window.ConnectifyCountdown = {
    update: updateCountdown
  };
})();
