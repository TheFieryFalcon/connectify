/**
 * Connectify: subsystem cache versions and clearing
 *
 * Each subsystem (predictor, results, settings, cohort) has its own version string and storage key
 * (connectify:cache_version:<subsystem>). Bumping a version clears only that subsystem's caches on the
 * next load. Loaded before assessment-cache.js, which adds the in-memory caches to this object.
 * Exposes window.ConnectifyCache.
 */
(() => {
  'use strict';

  const { removeStorageKeys, isBaselineKey } = window.ConnectifyUtils;

  const CACHE_VERSIONS = {
    PREDICTOR: 'v20_20261023_pred',
    RESULTS: 'v10_20261019_results',
    SETTINGS: 'v4_20261001_settings',
    COHORT: 'v6_20261018_cohort'
  };

  const CACHE_KEYS = {
    PREDICTOR: 'connectify:cache_version:predictor',
    RESULTS: 'connectify:cache_version:results',
    SETTINGS: 'connectify:cache_version:settings',
    COHORT: 'connectify:cache_version:cohort'
  };

  const ConnectifyCache = {
    VERSIONS: CACHE_VERSIONS,
    KEYS: CACHE_KEYS,

    clearPredictorCache() {
      try {
        if (window.ConnectifyPredictorMath?.predictionMemoryCache?.clear) {
          window.ConnectifyPredictorMath.predictionMemoryCache.clear();
        }
        removeStorageKeys(k => k.startsWith('connectify:prediction:') || k === 'connectify:prediction_version');
        // Do NOT stamp as current here — only populateChronologicalPredictions
        // should set the stamp after actually writing predictions.
        localStorage.removeItem(CACHE_KEYS.PREDICTOR);
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear predictor cache', e);
      }
    },

    clearResultsCache() {
      try {
        ConnectifyCache.subjectsCache?.clear();
        window.ConnectifyClassSemesters?.clear?.();
        removeStorageKeys(k => k.startsWith('connectify:grade_cache:') || k.startsWith('connectify:subjects_cache') || k.startsWith('connectify:class_semesters:'));
        localStorage.setItem(CACHE_KEYS.RESULTS, CACHE_VERSIONS.RESULTS);
        window.dispatchEvent(new CustomEvent('connectify-results-updated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear results cache', e);
      }
    },

    clearSettingsCache() {
      try {
        const directKeys = [
          'connectea:categories',
          'cx-categories',
          'connectea:task_type_overrides',
          'connectea:preferences',
          'connectify:preferences',
          'connectify:general_cohort_size',
          'connectify:atar_percentage',
          'connectify:auto_expand',
          'connectify:semester_filter',
          'connectify:panel_view',
          'connectify:school_terms'
        ];
        for (const k of directKeys) localStorage.removeItem(k);
        // Baselines live under singular and legacy plural prefixes (see ConnectifyUtils.BASELINE_PREFIXES)
        removeStorageKeys(k => isBaselineKey(k) || k.startsWith('connectea:class_categories:') || k.startsWith('connectify:calendar_export:'));
        localStorage.setItem(CACHE_KEYS.SETTINGS, CACHE_VERSIONS.SETTINGS);
        // Predictor modules memoise baselines; this event drops their in-memory copy
        window.dispatchEvent(new CustomEvent('connectify-baselines-updated'));
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear settings cache', e);
      }
    },

    // keepOverrides: a version bump clears derived data only; the student's cohort size overrides stay
    clearCohortCache({ keepOverrides = false } = {}) {
      try {
        ConnectifyCache.statsCache?.clear();
        removeStorageKeys(k => (!keepOverrides && k.startsWith('connectea:cohort:v3:')) || k.startsWith('connectify:stats_cache:'));
        if (window.ConnectifyCohortEstimator?.memory) {
          window.ConnectifyCohortEstimator.memory.clear();
        }
        localStorage.setItem(CACHE_KEYS.COHORT, CACHE_VERSIONS.COHORT);
        window.dispatchEvent(new CustomEvent('connectify-cohort-invalidated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear cohort cache', e);
      }
    },

    clearAllCaches() {
      this.clearPredictorCache();
      this.clearResultsCache();
      this.clearSettingsCache();
      this.clearCohortCache();
    },

    invalidateSubsystem(name) {
      const norm = String(name || '').toLowerCase().trim();
      if (norm === 'predictor' || norm === 'pred') {
        this.clearPredictorCache();
      } else if (norm === 'results' || norm === 'result' || norm === 'grades') {
        this.clearResultsCache();
      } else if (norm === 'settings' || norm === 'categories') {
        this.clearSettingsCache();
      } else if (norm === 'cohort') {
        this.clearCohortCache();
      } else if (norm === 'all') {
        this.clearAllCaches();
      }
    },

    checkAndInvalidateAll() {
      try {
        if (localStorage.getItem(CACHE_KEYS.PREDICTOR) !== CACHE_VERSIONS.PREDICTOR) {
          this.clearPredictorCache();
        }
        if (localStorage.getItem(CACHE_KEYS.RESULTS) !== CACHE_VERSIONS.RESULTS) {
          this.clearResultsCache();
        }
        const storedSettingsVer = localStorage.getItem(CACHE_KEYS.SETTINGS);
        if (storedSettingsVer === null) {
          localStorage.setItem(CACHE_KEYS.SETTINGS, CACHE_VERSIONS.SETTINGS);
        } else if (storedSettingsVer !== CACHE_VERSIONS.SETTINGS) {
          this.clearSettingsCache();
        }
        if (localStorage.getItem(CACHE_KEYS.COHORT) !== CACHE_VERSIONS.COHORT) {
          this.clearCohortCache({ keepOverrides: true });
        }
      } catch {}
    }
  };

  window.ConnectifyCache = ConnectifyCache;
  ConnectifyCache.checkAndInvalidateAll();
})();
