/**
 * Connectify Assessment Cache & Invalidation Manager
 *
 * In-memory and persisted assessment data: subjects/tasks (connectify:subjects_cache:), boxplot
 * stats (connectify:stats_cache:) and subjects marked stale by a grade change. Extends
 * window.ConnectifyCache (created by cache-versions.js).
 */
(() => {
  'use strict';

  try {
  const { normalize } = window.ConnectifyUtils;
  const subjectsCache = new Map();
  const statsCache = new Map();

  const getStudentId = () => window.ConnectifyUtils.accountKey();

  function statsCacheKey(subjectName, taskName) {
    const s = normalize(subjectName).toLowerCase();
    const t = normalize(taskName).toLowerCase();
    return `connectify:stats_cache:${getStudentId()}:${s}:${t}`;
  }

  function getTaskStats(subjectName, taskName) {
    if (!subjectName || !taskName) return null;
    const memKey = `${normalize(subjectName).toLowerCase()}::${normalize(taskName).toLowerCase()}`;
    if (statsCache.has(memKey)) return statsCache.get(memKey);

    try {
      const raw = localStorage.getItem(statsCacheKey(subjectName, taskName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.stats) && parsed.stats.length === 5) {
          statsCache.set(memKey, parsed.stats);
          return parsed.stats;
        }
      }
    } catch {}
    return null;
  }

  function setTaskStats(subjectName, taskName, stats, n) {
    if (!subjectName || !taskName || !Array.isArray(stats) || stats.length !== 5) return;
    const memKey = `${normalize(subjectName).toLowerCase()}::${normalize(taskName).toLowerCase()}`;
    statsCache.set(memKey, stats);

    try {
      const payload = { stats, n, timestamp: Date.now() };
      localStorage.setItem(statsCacheKey(subjectName, taskName), JSON.stringify(payload));
    } catch {}
  }

  function getSubjectTasks(subjectName) {
    if (!subjectName) return [];
    const norm = normalize(subjectName)
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
      .trim().toLowerCase();

    for (const [sName, tasksMap] of subjectsCache.entries()) {
      const cleanS = normalize(sName)
        .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
        .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
        .replace(/\bATAR\b/gi, '')
        .replace(/\bYear\s*\d+\b/gi, '')
        .trim().toLowerCase();
      if (cleanS === norm || sName.toLowerCase().includes(norm) || norm.includes(cleanS)) {
        return Array.from(tasksMap.values()).filter(t => {
          if (/^Assessment\s+\d+$/i.test(t.name) && !t.caption && (t.weight === null || t.weight === 0)) return false;
          return true;
        });
      }
    }
    return [];
  }

  // --- SUBSYSTEM CACHE INVALIDATION MANAGER ---
  // ConnectifyCache (versions and clearing) is created by cache-versions.js; this file adds the caches
  const ConnectifyCache = window.ConnectifyCache;

  function getSubjectsCacheKey() {
    return `connectify:subjects_cache:${getStudentId()}`;
  }

  function serializeSubjects(sourceMapOrArray) {
    const out = {};
    if (sourceMapOrArray instanceof Map) {
      for (const [sName, tasksMap] of sourceMapOrArray.entries()) {
        const list = tasksMap instanceof Map ? Array.from(tasksMap.values()) : (Array.isArray(tasksMap) ? tasksMap : []);
        out[sName] = list.map(t => {
          const copy = { ...t };
          delete copy.row;
          return copy;
        });
      }
    } else if (Array.isArray(sourceMapOrArray)) {
      for (const item of sourceMapOrArray) {
        if (item && item.name) {
          out[item.name] = (item.tasks || []).map(t => {
            const copy = { ...t };
            delete copy.row;
            return copy;
          });
        }
      }
    }
    return out;
  }

  function saveSubjectsCache(source) {
    try {
      const serialized = serializeSubjects(source || subjectsCache);
      const json = JSON.stringify(serialized);
      localStorage.setItem(getSubjectsCacheKey(), json);
      localStorage.setItem('connectify:subjects_cache:current', json);
    } catch (e) {
      console.warn('Connectify failed to save subjects cache:', e);
    }
  }

  function loadSubjectsCache() {
    try {
      const raw = localStorage.getItem(getSubjectsCacheKey()) || localStorage.getItem('connectify:subjects_cache:current');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      subjectsCache.clear();
      for (const [subjName, tasksList] of Object.entries(parsed)) {
        const tasksMap = new Map();
        if (Array.isArray(tasksList)) {
          for (const t of tasksList) {
            if (t && t.id) tasksMap.set(t.id, t);
          }
        }
        if (tasksMap.size > 0) {
          subjectsCache.set(subjName, tasksMap);
        }
      }
      return subjectsCache.size > 0;
    } catch (e) {
      console.warn('Connectify failed to load subjects cache:', e);
      return false;
    }
  }

  loadSubjectsCache();

  const STALE_SUBJECTS_KEY = 'connectify:stale_subjects';

  function getStaleSubjects() {
    try {
      const raw = localStorage.getItem(STALE_SUBJECTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.map(s => normalize(s).toLowerCase()));
      }
    } catch {}
    return new Set();
  }

  function saveStaleSubjects(staleSet) {
    try {
      localStorage.setItem(STALE_SUBJECTS_KEY, JSON.stringify(Array.from(staleSet)));
    } catch {}
  }

  function markSubjectStale(subjectName) {
    if (!subjectName) return;
    const staleSet = getStaleSubjects();
    staleSet.add(normalize(subjectName).toLowerCase());
    saveStaleSubjects(staleSet);

    if (window.ConnectifyPredictorMath?.clearSubjectPredictionCache) {
      try {
        window.ConnectifyPredictorMath.clearSubjectPredictionCache(subjectName);
      } catch {}
    }
  }

  function unmarkSubjectStale(subjectName) {
    if (!subjectName) return;
    const staleSet = getStaleSubjects();
    const key = normalize(subjectName).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
    if (staleSet.has(key)) {
      staleSet.delete(key);
    }
    for (const item of Array.from(staleSet)) {
      const cleanItem = normalize(item).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
      if (cleanItem && (key === cleanItem || key.includes(cleanItem) || cleanItem.includes(key))) {
        staleSet.delete(item);
      }
    }
    saveStaleSubjects(staleSet);
  }

  function isSubjectStale(subjectName) {
    if (!subjectName) return false;
    const staleSet = getStaleSubjects();
    if (staleSet.size === 0) return false;
    const norm = normalize(subjectName).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
    if (!norm) return false;
    if (staleSet.has(norm)) return true;
    for (const item of staleSet) {
      const cleanItem = normalize(item).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
      if (cleanItem && (norm === cleanItem || norm.includes(cleanItem) || cleanItem.includes(norm))) {
        return true;
      }
    }
    return false;
  }

  function hasCachedSubjects() {
    if (subjectsCache.size === 0) return false;
    for (const tasks of subjectsCache.values()) {
      if (tasks && tasks.size > 0) return true;
    }
    return false;
  }


    ConnectifyCache.subjectsCache = subjectsCache;
    ConnectifyCache.statsCache = statsCache;
    ConnectifyCache.getStudentId = getStudentId;
    ConnectifyCache.statsCacheKey = statsCacheKey;
    ConnectifyCache.getTaskStats = getTaskStats;
    ConnectifyCache.setTaskStats = setTaskStats;
    ConnectifyCache.getSubjectTasks = getSubjectTasks;
    ConnectifyCache.getSubjectsCacheKey = getSubjectsCacheKey;
    ConnectifyCache.serializeSubjects = serializeSubjects;
    ConnectifyCache.saveSubjectsCache = saveSubjectsCache;
    ConnectifyCache.loadSubjectsCache = loadSubjectsCache;
    ConnectifyCache.getStaleSubjects = getStaleSubjects;
    ConnectifyCache.saveStaleSubjects = saveStaleSubjects;
    ConnectifyCache.markSubjectStale = markSubjectStale;
    ConnectifyCache.unmarkSubjectStale = unmarkSubjectStale;
    ConnectifyCache.isSubjectStale = isSubjectStale;
    ConnectifyCache.hasCachedSubjects = hasCachedSubjects;
  } catch (err) {
    console.error('Connectify error in assessment-cache.js:', err);
  }
})();
