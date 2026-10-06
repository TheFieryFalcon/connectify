/**
 * Connectify Notification Engine
 *
 * Provides a unified toast and notification banner system for Connectify.
 * Manages vertical stacking of notifications, action dispatchers, automatic
 * dismiss timers, and responsive light/dark styling.
 * Exposes `window.ConnectifyNotifications`.
 */
(() => {
  'use strict';

  if (window.ConnectifyNotifications) return;

  const NOTIFICATION_CONTAINER_ID = 'connectify-notifications-container';
  const activeNotifications = new Map();

  /**
   * Ensures the notification container exists in the DOM.
   */
  function getContainer() {
    let container = document.getElementById(NOTIFICATION_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = NOTIFICATION_CONTAINER_ID;
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Connectify Notifications');
      document.body.append(container);
    }
    return container;
  }

  /**
   * Dismisses a notification with a smooth exit animation.
   */
  function dismiss(idOrEl) {
    let el = null;
    let notifId = null;

    if (typeof idOrEl === 'string') {
      notifId = idOrEl;
      el = activeNotifications.get(idOrEl);
    } else if (idOrEl instanceof HTMLElement) {
      el = idOrEl;
      notifId = el.dataset.notificationId;
    }

    if (!el || !el.isConnected) {
      if (notifId) activeNotifications.delete(notifId);
      return;
    }

    if (el._dismissTimeout) clearTimeout(el._dismissTimeout);
    if (el._autoDismissTimer) clearTimeout(el._autoDismissTimer);

    el.classList.add('cx-notification-dismissing');
    if (typeof el._onDismissCallback === 'function') {
      try {
        el._onDismissCallback();
      } catch (err) {
        console.warn('Connectify notification onDismiss error:', err);
      }
    }

    el._dismissTimeout = setTimeout(() => {
      el.remove();
      if (notifId) activeNotifications.delete(notifId);
    }, 260);
  }

  /**
   * Clears all active notifications.
   */
  function clearAll() {
    activeNotifications.forEach((el, id) => {
      dismiss(id);
    });
  }

  /**
   * Resolves icon based on notification type.
   */
  function resolveIcon(type, customIcon) {
    if (customIcon) return customIcon;
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'grade':
        return '📈';
      case 'info':
      default:
        return 'ℹ️';
    }
  }

  /**
   * Displays a notification toast in the container.
   *
   * @param {Object} opts
   * @param {string} [opts.id] - Unique identifier to prevent duplicates or allow updating.
   * @param {string} [opts.type] - 'info' | 'warning' | 'success' | 'grade'
   * @param {string} [opts.icon] - Emoji or custom HTML string for icon.
   * @param {string} opts.title - Header text.
   * @param {string} opts.message - Body text.
   * @param {string[]} [opts.details] - Array of bullet point details.
   * @param {Array<{text: string, type?: string, onClick: Function}>} [opts.actions] - Action buttons.
   * @param {number} [opts.duration] - Auto dismiss duration in ms (0 or null to stay until dismissed).
   * @param {boolean} [opts.dismissible] - Show close button (defaults to true).
   * @param {Function} [opts.onDismiss] - Callback when notification is closed.
   * @returns {Object} Handle with { close, element }
   */
  function show(opts) {
    if (!opts || !opts.title) return null;
    const container = getContainer();

    const id = opts.id || `cx-notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const type = opts.type || 'info';
    const dismissible = opts.dismissible !== false;

    // Check if an existing notification with this ID is already mounted
    let el = activeNotifications.get(id);
    const isNew = !el;

    if (isNew) {
      el = document.createElement('div');
      el.className = `cx-notification cx-notification--${type}`;
      el.dataset.notificationId = id;
      el.setAttribute('role', 'alert');
      container.append(el);
      activeNotifications.set(id, el);
    } else {
      // Update classes in place
      el.className = `cx-notification cx-notification--${type}`;
      if (el._autoDismissTimer) clearTimeout(el._autoDismissTimer);
    }

    el._onDismissCallback = opts.onDismiss;

    // Clear previous children
    el.replaceChildren();

    // 1. Header
    const header = document.createElement('div');
    header.className = 'cx-notification-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'cx-notification-title-group';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'cx-notification-icon';
    iconSpan.innerHTML = resolveIcon(type, opts.icon);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'cx-notification-title';
    titleSpan.textContent = opts.title;

    titleGroup.append(iconSpan, titleSpan);
    header.append(titleGroup);

    el.append(header);

    // 2. Body
    if (opts.message) {
      const body = document.createElement('div');
      body.className = 'cx-notification-body';
      body.textContent = opts.message;
      el.append(body);
    }

    // 3. Details list (if any)
    if (Array.isArray(opts.details) && opts.details.length > 0) {
      const detailsList = document.createElement('ul');
      detailsList.className = 'cx-notification-details';
      opts.details.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        detailsList.append(li);
      });
      el.append(detailsList);
    }

    // 4. Actions
    if (Array.isArray(opts.actions) && opts.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'cx-notification-actions';

      opts.actions.forEach(action => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cx-notification-btn cx-notification-btn--${action.type || 'secondary'}`;
        btn.textContent = action.text;
        btn.onclick = (e) => {
          e.stopPropagation();
          if (typeof action.onClick === 'function') {
            action.onClick({
              id,
              element: el,
              close: () => dismiss(id)
            });
          }
        };
        actionsContainer.append(btn);
      });

      el.append(actionsContainer);
    }

    // Auto-dismiss setup
    if (opts.duration && opts.duration > 0) {
      el._autoDismissTimer = setTimeout(() => {
        dismiss(id);
      }, opts.duration);
    }

    return {
      id,
      element: el,
      close: () => dismiss(id)
    };
  }

  window.ConnectifyNotifications = {
    show,
    dismiss,
    clearAll
  };
})();
