/**
 * Connectify Settings: general preferences
 *
 * Wires the General Preferences and Developer Settings controls: auto-expand, cohort size, ATAR
 * percentage, colour theme, custom wallpaper and cache clearing. bind(panel) returns refresh(),
 * which reloads every control from storage and rebuilds the theme list from the registry (the theme
 * scripts load after the outlines scripts, and custom themes can be added or deleted at any time).
 * Exposes window.ConnectifySettingsPreferences.
 */
(() => {
  'use strict';

  const settingsChanged = () => window.dispatchEvent(new CustomEvent('connectify-settings-updated'));

  // Number input stored in localStorage; out-of-range or empty values remove the setting
  function bindNumberSetting(input, key, isValid) {
    if (!input) return () => {};
    input.addEventListener('input', () => {
      const val = input.value.trim();
      try {
        if (val && isValid(Number(val))) localStorage.setItem(key, val);
        else localStorage.removeItem(key);
      } catch {}
      settingsChanged();
    });
    return () => { input.value = localStorage.getItem(key) || ''; };
  }

  function renderThemeOptions(select) {
    const theme = window.ConnectifyTheme;
    const themes = [{ id: 'light', name: 'Default', icon: '☀' }, ...(theme?.getAvailableThemes?.() || [])];
    select.replaceChildren(...themes.map(t => Object.assign(document.createElement('option'), {
      value: t.id,
      textContent: `${t.icon || '🎨'} ${t.name}`
    })));
    select.value = theme ? theme.getTheme() : (localStorage.getItem('connectea:theme:id') || 'dark');
  }

  // Wallpapers are downscaled to 2560px JPEGs so they fit in storage
  function readWallpaper(file, onReady) {
    const reader = new FileReader();
    reader.onload = e => {
      const rawUrl = e.target?.result;
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 2560;
        const ratio = Math.min(1, maxDim / img.width, maxDim / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        onReady(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  }

  function bindWallpaper(panel) {
    const input = panel.querySelector('#cx-bg-upload-input');
    const uploadBtn = panel.querySelector('#cx-bg-upload-btn');
    const removeBtn = panel.querySelector('#cx-bg-remove-btn');
    const status = panel.querySelector('#cx-bg-status-label');
    // The theme scripts (and so the presets) load after this group, so thumbnails mount on first refresh
    const presetBox = panel.querySelector('#cx-bg-presets');
    const refresh = () => {
      const presets = window.ConnectifyWallpaperPresets;
      if (presets && presetBox && !presetBox.childElementCount) {
        presets.mount(presetBox, p => {
          window.ConnectifyTheme?.setCustomBackground(p.url);
          refresh();
        });
      }
      const current = window.ConnectifyTheme?.getCustomBackground?.();
      const preset = current && presets?.find(current);
      if (removeBtn) removeBtn.style.display = current ? 'inline-block' : 'none';
      if (status) status.textContent = preset ? `Preset: ${preset.name}` : current ? 'Custom wallpaper active' : 'No custom background set';
      panel.querySelectorAll('.cx-bg-preset').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === preset?.id)));
    };
    if (uploadBtn && input) {
      uploadBtn.onclick = () => input.click();
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        readWallpaper(file, dataUrl => {
          window.ConnectifyTheme?.setCustomBackground(dataUrl);
          refresh();
        });
      };
    }
    if (removeBtn) {
      removeBtn.onclick = () => {
        window.ConnectifyTheme?.clearCustomBackground();
        if (input) input.value = '';
        refresh();
      };
    }
    return refresh;
  }

  function bindClearCache(panel) {
    const btn = panel.querySelector('#cx-clear-cache-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      try {
        window.ConnectifyCache?.clearResultsCache?.();
        window.ConnectifyCache?.clearCohortCache?.();
        window.ConnectifyCache?.clearPredictorCache?.();
        window.ConnectifyData?.clearCache?.();
        try { localStorage.removeItem('connectify:stale_subjects'); } catch {}
        const feedback = panel.querySelector('#cx-clear-cache-feedback');
        if (feedback) {
          feedback.style.display = 'inline';
          setTimeout(() => { feedback.style.display = 'none'; }, 3000);
        }
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }
    });
  }

  /** Wires the controls in the settings panel and returns refresh(). */
  function bind(panel) {
    const autoExpand = panel.querySelector('#cx-auto-expand-toggle');
    if (autoExpand) {
      autoExpand.addEventListener('change', () => {
        try { localStorage.setItem('connectify:auto_expand', String(autoExpand.checked)); } catch {}
        settingsChanged();
      });
    }
    const refreshCohort = bindNumberSetting(panel.querySelector('#cx-general-cohort-input'), 'connectify:general_cohort_size', n => n > 0);
    const refreshAtarPct = bindNumberSetting(panel.querySelector('#cx-atar-percentage-input'), 'connectify:atar_percentage', n => n > 0 && n <= 100);
    const themeSelect = panel.querySelector('#cx-theme-select-input');
    themeSelect?.addEventListener('change', () => window.ConnectifyTheme?.setTheme(themeSelect.value));
    const refreshWallpaper = bindWallpaper(panel);
    bindClearCache(panel);

    const refresh = () => {
      try {
        if (autoExpand) autoExpand.checked = localStorage.getItem('connectify:auto_expand') !== 'false';
        refreshCohort();
        refreshAtarPct();
        if (themeSelect) renderThemeOptions(themeSelect);
        refreshWallpaper();
      } catch (e) {
        console.warn('Connectify settings preferences error:', e);
      }
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsPreferences = { bind };
})();
