# Connectify APIs, Storage & Events Reference

This document indexes global namespace APIs, persistent storage keys, custom DOM events, and critical DOM selectors used by the Connectify extension.

---

## 3. Global Namespaces & API Index

| Global Object | Module | Primary Purpose |
|---|---|---|
| `window.ConnectifyScheduler` | `scheduler.js` | Shared page observer (`onMutations`) and heartbeat (`every`) |
| `window.ConnectifyUtils` | `utils.js` | Shared `normalize`, `accountKey` (the signed-in user's own account, `connectify:accounts`; on pages naming no user, URL `coisp`, else the remembered account, else `current`), `signedInUserId()` (Connect's Liferay `getUserId`, null for guests), `userKey(key)` / `userKeys(predicate)` (the student's own settings: `connectify:user:<account>:` + the old key; `user-settings-migrate.js` moved the shared ones to the first signed-in student once, `connectify:user_settings_migrated`), `storageKeys`/`removeStorageKeys`, `baselineKeys`/`isBaselineKey`, `customWeekOrder`/`readTimeOverride`, `OUTLINES_URL`/`isOutlinesPage()` (load first) |
| `window.ConnectifyData` | `assessment-data.js` | Caches tasks from Connect's API records (cards only without them), expands accordions; `collectClasses()` for sidebar tools |
| `window.ConnectifyOutlineApi` / `ConnectifyApiParse` / `ConnectifyLegacyOutlines` / `ConnectifyLegacyMarkup` | `outline-api.js` / `assessment-api-parse.js` / `legacy-outlines.js` / `legacy-outlines-markup.js` | Connect's outlines API (`load`, `records`, `drawable` (drawn before every boxplot arrives), `version`, `isSettled`, `recordOf`; events `connectify-outlines-preview` / `connectify-outlines-loaded` / `connectify-outlines-failed`); records as parser tasks (`ids`, `parse`, `markedIds`); the old outline markup (`sync`, `setExpanded`, `tileFor`; `tile`, `detailsPanel`, `chart`) |
| `window.ConnectifyCache` | `cache-versions.js` | Subsystem cache versioning (predictor, results, settings, cohort, goals) and clearing |
| `window.ConnectifyCohortMath` | `cohort-math.js` | PCHIP cubic Hermite interpolation, variance, z-score |
| `window.ConnectifyCohortEstimator` | `cohort-estimator.js` | Baseline and empirical cohort size estimation |
| `window.ConnectifyCohortSizeBaselines` | `cohort-size-baselines.js` | Typical cohort size per subject and year level |
| `window.ConnectifyCohortRows` | `cohort-row-readers.js` | Task row mark and boxplot readers, DOM helpers |
| `window.ConnectifyCohortOutcomeEval` | `cohort-outcome-eval.js` | Outcome meter evaluation and prediction pre-caching for a row |
| `window.ConnectifyCohortView` / `ConnectifyCohortForecast` / `ConnectifyCohortUpcoming` | `cohort-view.js` / `cohort-forecast.js` / `cohort-upcoming.js` | Injects stats panels and type selectors into assessment rows; Low / Mid / High prediction panel on unmarked rows; class Low / Mid / High prediction on the overall row of a class without a letter; `ConnectifyPanelView` (`cohort-panel-view.js`: `mode()`, `expandsOverall()`, `expandsTasks()`, read once per load) and `ConnectifyCohortExpanded` (`cohort-expanded.js`: expanded cards, `scoreStep`, `basisText`); `ConnectifyCohortSubjectAverage` (`cohort-subject-average.js`: `sync(card)`, `average(card)`); `ConnectifyCohortGradeRange` (`cohort-grade-range.js`: `range`, `forRow`, `compactText`: lowest / highest final mark still possible) |
| `window.ConnectifyCohort` | `cohort-stats.js` | Controller orchestrating passes, mutation observer, styles |
| `window.ConnectifyTaskTypes` | `task-types.js` | Category keyword detection, overrides, class category sharing |
| `window.ConnectifyScalingData` | `scaling-data.js` | TISC scaled-score statistics per course (mean, SD, percentiles) |
| `window.ConnectifyMath` | `atar-math.js` | TEA-to-ATAR conversion, 10% bonus rules, TISC Average Marks Scaling model |
| `window.ConnectifyTargetDifficulty` | `target-difficulty.js` | Difficulty-weighted task baselines, effort model and bisection |
| `window.ConnectifyTargetSolver` | `target-solver.js` | Target Grade and difficulty-weighted Target ATAR solver |
| `window.ConnectifyAtarScraper` | `atar-scraper.js` | ATAR courses per semester from the cache (registry, subjects, grade cache); `readCourses` never reads tiles |
| `window.ConnectifyClassSemesters` | `class-semesters.js` | Class registry per semester (title, mark, final letter, tasks), `detectSemester()`, new-year trigger |
| `window.ConnectifySemesterFilter` | `semester-filter.js` | "Show this semester's classes only": `currentSemester`, `activeSemester`, `allowedCards`, `filterSubjects`, `filterCourses`, `applyToPage`; `ConnectifySemesterFilterNotice` (`semester-filter-notice.js`): `update(anchor, active, hidden)` |
| `window.ConnectifyAtarCalc` | `atar-calculator.js` | Course state modeling and ATAR calculation results |
| `window.ConnectifyTargetAtarUI` | `target-atar-ui.js` | Target ATAR planner modal form and breakdown view |
| `window.ConnectifyTargetGradeUI` | `target-grade-ui.js` | Target Grade planner modal form and breakdown view |
| `window.ConnectifyTargetUiHelpers` | `target-ui-helpers.js` | Planner element, rounding and preference helpers |
| `window.ConnectifyTargetPlannerUI` / `ConnectifyGradeEstimate` / `ConnectifyGradeEstimateUI` | `target-planner-ui.js` / `grade-estimate.js` / `grade-estimate-ui.js` | Planner facade delegating to Atar and Grade UI modules; Estimate Grade: `parseMark`, `estimate`; `createView`, `render` |
| `window.ConnectifyAtarMarkup` | `atar-ui-markup.js` | Calculator panel markup, `GROUPS` / `MODES` (Goals, Estimates) and semester rules |
| `window.ConnectifyAtar` | `atar-ui.js` | Calculator shell and mode coordinator (`openCalculator('goals' \| 'estimator' \| mode)`) |
| `window.ConnectifyOutlineControls` / `ConnectifyOutlineJump` | `outline-controls.js` / `outline-jump.js` | Floating Expand/Collapse All and Back to top button; Jump To row (`subjects()`: shown outlines' cleaned names once, page order; `create`, `sync`, `jump`, `open`, `close`: the upward subject list) |
| `window.ConnectifyProgressMath` | `progress-math.js` | Historical ATAR trajectory and monthly aggregation; `termWeek(order)` / `formatTimestamp`: the graph's date system, shared with the export |
| `window.ConnectifyProgressChart` / `ConnectifyProgressSemesterDivider` / `ConnectifyProgressModes` / `ConnectifyEarlyEaster` | `progress-chart.js` / `progress-semester-divider.js` / `progress-modes.js` / `progress-early-easter.js` | SVG polyline line chart and plotted data table renderer; dashed Semester 1 / Semester 2 line (`taskSemester`, `commonSemester`, `boundaryX`, `render`); single task / weighted / rolling average data points; `checkbox(className, onChange)`, `controls(showLabel, onChange)` (the year's Early Easter choice, applied and broadcast) |
| `window.ConnectifyProgressWeekEditor` | `progress-week-editor.js` | Week override cells in the progress table |
| `window.ConnectifyProgressPanel` | `progress-panel.js` | Progress launcher and panel markup |
| `window.ConnectifyProgress` / `ConnectifySchoolTerms` / `ConnectifyExportTasks` / `ConnectifyExportIcs` / `ConnectifyExportCsv` / `ConnectifyExportRows` / `ConnectifyExportView` | `progress-graph.js` / `school-terms.js` / `export-tasks.js` / `export-ics.js` / `export-csv.js` / `export-rows.js` / `export-view.js` | Progress graph modal controller; term calendar (`src/assessment/`, shared with the caption parser): `terms(year, early)` (each with `yearWeek`, its first school week 1–40), `dateFor`, `normalizeOrder` (a week past its term's end -> the next term's), `weekOrder` / `schoolWeek` (school week of the year <-> order), `formatDate`, `orderOf(date)`, `autoEarlyEaster`, `earlyEaster` / `setEarlyEaster`; `build(subjects, opts)`, `examGroups`; `.ics` / CSV `build(items, { merge })`; `subjectBlock(group, ctx)`; the Export view |
| `window.ConnectifyCompoundProgress` | `compound-progress.js` | Weighted category progress bars on subject cards |
| `window.ConnectifyWeaknessView` | `weakness-radar-view.js` | Radar SVG and panel markup |
| `window.ConnectifyWeakness` | `weakness-radar.js` | SVG spider/radar chart analyzer |
| `window.ConnectifyCalibration` | `scaling-calibration.js` | Semester 1 scaled scores calibration table |
| `window.ConnectifyCategorySettings` | `category-settings.js` | Category keyword settings and custom category management |
| `window.ConnectifyPredictorMath` | `predictor-math.js` | Logarithmic ceiling modeling, task prediction, outcome evaluation, ATAR projections |
| `window.ConnectifyPredictorUI` | `predictor-ui.js` | Predictor sidebar tool panel coordinator (Predict Grade and Predict ATAR tabs) |
| `window.ConnectifyCountdown` | `wace-countdown.js` | Year 12 WACE exam countdown timer |
| `window.ConnectifyNotifications` / `ConnectifyUpdateNotice` / `ConnectifyOverhaulNotice` | `notifications.js` / `update-notice.js` / `overhaul-notice.js` | Stacked toast engine; one "Connectify updated" toast per newer version, "What's new" opens CHANGELOG.md; once, on an upgrade to 3.3.0, the semester filter off and a Connect overhaul popup (`migrate`, `show`) |
| `window.ConnectifyGradeSnapshot` / `ConnectifyGradeTasks` | `grade-snapshot.js` / `grade-tasks.js` | Subject running marks vs the grade cache (own mark only, same semester); newly marked task ids on shown outlines (`check`, `hasNewResult`, `start`) |
| `window.ConnectifyNewGrade` | `new-grade.js` | Grade change notifications and jump-to-card navigation |
| `window.ConnectifyDomSweeper` | `dom-sweeper.js` | DOM health monitor and component restoration |
| `window.ConnectifyThemeAuth` | `theme-auth.js` | Login/logout detection and post-login theme restore |
| `window.ConnectifyThemeTokens` / `ConnectifyWallpaperDim` / `ConnectifyThemeBoot` / `ConnectifyPointerKind` | `theme-custom-tokens.js` / `theme-wallpaper-dim.js` / `theme-boot.js` / `pointer-kind.js` | Custom tokens, wallpaper (with extension-storage fallback, `backgroundSource()`), glass; boot: `cssUrl(url)` (blob: URL for data URLs over Chrome's 2 MB), `save()`, `done()`, `sourceOf`; `isMouse()`, `setMouse`; `update(url)` measures the wallpaper's least dim for white text and least brighten for dark text, each >= 4.5:1 (`dimFor(pixels)`, `brightenFor(pixels, ink)`) |
| `window.ConnectifyThemeRegistry` | `theme-registry.js` / `theme-custom-themes.js` | Theme registry, switching, saved custom themes |
| `window.ConnectifyThemeCustomizer` / `ConnectifyCustomizerTokens` / `ConnectifyThemeCtme` / `ConnectifyThemeImport` / `ConnectifyWallpaperFit` / `ConnectifyWallpaperCrop` / `ConnectifyWallpaperMigrate` | `theme-customizer.js` / `theme-customizer-tokens.js` / `theme-ctme.js` / `theme-wallpaper-fit.js` / `theme-wallpaper-crop.js` / `theme-wallpaper-migrate.js` | In-DOM theme designer modal, 20-token Full mode (user-set and preset Full tokens are overrides until a Basic token they derive from changes: `set`, `reset`, `fromPreset`, `track`, `overridesOf`, `savedColors`), `.ctme` theme files (`pack(theme)`, `unpack(buffer)`, `unpackFile(file)` (read as a data URL string: Firefox MV3 content scripts may not read page-owned buffers from `arrayBuffer()` or a `Response`), `fileName(name)`), theme import (`sanitize`, `wallpaperFields`, `importFile`, `pick`), preview naming text/fill tokens, wallpaper upload; `fromFile(file, { adjust })` (rescale, then `adjust` = `ConnectifyWallpaperCrop.prompt` resizes and places, then crop; `cropRect`, `prescaleSize`, `isCancelled`) / `fromDataUrl(url)` crop and scale wallpapers to the screen before storing, `needsFit(url)` (raster data URL > 1.5 MB); `run()` fits large stored wallpapers once |
| `window.ConnectifyIsUserActive` / `ConnectifyNavigation` | `navigation.js` | Returns boolean indicating recent user interaction (<90s); `markActive()`: the Assessment Outlines shortcut, not My Connect, is the active nav tab on its page |

---

## 4. Storage Key Taxonomy

| Key Pattern | Storage Type | Module | Description |
|---|---|---|---|
| `connectea:theme:v1` | `localStorage` | `theme.js` | Current theme (`'dark'` or `'light'`) |
| `connectea:theme:id` | `localStorage` | `theme-registry.js` | Active theme identifier (`'dark'`, `'quantum'`, `'amoled'`, `'midnight'`, `'forest'`, `'liquid-glass-clear'`, `'liquid-glass'`, `'custom'`, `'light'`) |
| `connectea:theme:last_theme` | `localStorage` | `theme.js` | Identifier of active theme restored on startup |
| `connectea:theme:custom_themes` | `localStorage` & `storage.local` | `theme-registry.js` | Array of custom theme configurations (tokens, `tokenVersion`, glassBlur, glassOpacity, wallpaper, or `wallpaperPreset`: a preset wallpaper id) with name-based overwrite |
| `connectea:custom_background` | `localStorage` & `storage.local` | `theme-custom-tokens.js` | Data URI of the wallpaper picked in Settings (extension storage keeps it when over quota); a theme's own wallpaper is shown over it only while that theme is active, never stored here; `connectify:wallpaper_fit_done` (`theme-wallpaper-migrate.js`) is set once large stored wallpapers were fitted; `connectify:wallpaper_dim` (`theme-wallpaper-dim.js`) caches `{ key, dim, brighten: { <ink>: value } }` for the active wallpaper |
| `connectea:theme:liquid_glass` | `localStorage` | `theme.js` | Boolean flag enabling Liquid Glass diffusion mode |
| `connectea:theme:restore_dark` / `restore_theme` / `custom_colors` | `localStorage` | `theme.js` / `theme-registry.js` | Dark-mode flag and saved theme ID restored after navigating away from the login page; custom theme JSON palette (`canvas`, `surface`, `accent`) |
| `connectea:cohort:v3:<student>:<year>:<subject>` | `localStorage` | `cohort-estimator.js` | Custom user-override cohort size |
| `connectea:observed_spreads:<key>` | `sessionStorage` | `cohort-estimator.js` | Legacy (no longer read; removed by `clearCohortCache`): spreads now come from `connectify:stats_cache:` |
| `connectea:task_type_overrides` (per user, `userKey`) | `localStorage` | `task-types.js` | Map of assessment manual category overrides |
| `connectea:class_categories:<subjectKey>` (per user) | `localStorage` | `task-types.js` | Custom categories shared across Sem 1 & 2 for a class |
| `cx-categories` / `connectea:categories` | `localStorage` & `browser.storage.local` | `category-settings.js` | Custom category definitions, keywords, colors |
| `connectea:atar:2025:<account>:<year>` | `localStorage` | `atar-calculator.js` | `<semester>:<course>`: `{ include, raw }` (typed school mark; older entries hold a scaled `score`), `gradeEstimates` (`{ <course>: { <task>: typed mark } }`, Estimate Grade), top four selections, targets |
| `connectea:preferences` (per user) | `localStorage` | `scaling-calibration.js` | Calibration table (`sem1_calibration:<courseId>`) |
| `connectify:weakness_disabled_subjects` (per user) / `connectify:progress_mode` / `connectify:calendar_export:<account>` | `localStorage` | `weakness-radar.js` / `progress-modes.js` / `export-view.js` | Subjects excluded from Weaknesses; Progress data point mode (`tasks`, `weighted`, `rolling`); export choices `{ unticked, subjectDays, taskDays, mergeExams }` (older ones also hold `earlyEaster`, still read); `connectify:school_terms` (`school-terms.js`): `{ earlyEaster: { <year>: bool } }`, shared by the graph and export (both settings: Clear Cache keeps them) |
| `connectea:time_override:<subject>:<task|taskId>` (per user) | `localStorage` | `progress-chart.js` | Manual school week overrides: `w17` (school week of the year through the term calendar, as the Export numbers term starts; Early Easter: Term 2 starts at Week 10), older bare numbers (saved before Early Easter was known) read as the same school week (`17` = `w17`) or `t2w7`, read via `ConnectifyUtils.customWeekOrder` (disambiguated by task ID for duplicate names) |
| `connectify:auto_expand` | `localStorage` | `category-settings.js` / `atar-features.js` | Boolean setting to auto-expand course outlines on load |
| `connectify:stale_subjects:<account>` | `localStorage` | `assessment-data.js` / `new-grade.js` | Set of subjects whose collapsed grade/stats changed, awaiting targeted re-scrape upon expansion (the untagged legacy key moves to the first account that reads it) |
| `connectify:subjects_cache:<student>` | `localStorage` | `assessment-data.js` | Persisted scraped subjects and tasks for instant collection without DOM rescrape |
| `connectify:general_cohort_size` | `localStorage` | `category-settings.js` / `cohort-estimator.js` | Estimated year level cohort size (default: 500) |
| `connectify:atar_percentage` | `localStorage` | `category-settings.js` / `cohort-estimator.js` | Estimated ATAR pathway participation percentage (default: 60) |
| `connectify:grade_cache:<student>` | `localStorage` | `new-grade.js` | Last seen running mark and semester per subject, and `tasks: { <semester>: [marked task ids] }` from the last time each outline's rows were shown, for grade update notifications (kept across results version bumps) |
| `connectify:baseline:types:<account>` | `localStorage` | `category-settings.js` / `predictor-math.js` | Previous-year assessment category percentage averages |
| `connectify:baseline:subjects:<account>` | `localStorage` | `category-settings.js` / `predictor-math.js` | Previous-year enrolled subject final grade averages |
| `connectify:year_snapshot:<account>` | `localStorage` | `year-rollover.js` | Class names seen this year and this year's type/subject averages, applied as baselines when a new year starts |
| `connectify:baseline_backup:<account>` | `localStorage` | `year-rollover.js` | Baselines as they were before a new-year rollover replaced them |
| `connectify:year_archive:<account>` | `localStorage` | `year-rollover.js` | Last two years' cached results (subjects, grade cache, registry, averages): Connect no longer shows them |
| `connectify:class_semesters:<student>` | `localStorage` | `class-semesters.js` | Each class's outlines per semester: title, overall mark, final letter, task ids (results cache) |
| `connectify:semester_filter` / `connectify:panel_view` | `localStorage` | `semester-filter.js` / `cohort-panel-view.js` | `{ enabled }`; off by default; the semester is always the detected one (settings). Statistics Panels: `subjects` or `all` (missing = `compact`); applies on next load |
| `connectify:prediction:<account>:<subject>:<taskId>` | `localStorage` | `predictor-math.js` / `cohort-view.js` | Cached task prediction object (`{ low, mid, high, breakoutScore, type, basis, subjectName }`), one per task under its parser id (`predictionId`: labels or name only without one), so same-named tasks never share one |
| `connectify:prediction_version` | `localStorage` | `predictor-math.js` | Calculation version incrementer tracking when chronological prediction cache must be re-populated |
| `connectify:cache_version:<subsystem>` | `localStorage` | `assessment-data.js` | Independent invalidation keys (`predictor`, `results`, `settings`, `cohort`, `goals`: goal verdicts only; goals: `modules_goals.md`) |
| `connectify:stats_cache:<student>:<subject>:<task>` | `localStorage` | `assessment-data.js` | Cached 5-number boxplot quantiles and sample size; summary rows use task `Overall S1` / `Overall S2`; a name repeated on a card (each semester's exam "Close reading") is keyed by the later row's task id, the first keeps the name (`statsKey` from `cardTaskIds`), so it never shows the other's cohort mean (keys never include Connectify's own panel text) |
| `cx-autologin-enabled` / `cx-session-expired` | `browser.storage.local` | `auto-login.js` | Boolean flag for auto-login on sign-in page; legacy (no longer set; removed on the sign-in page): an expired session used to pause auto-login |
| `cx-manual-logout` | `browser.storage.local` | `navigation.js` / `auto-login.js` | Flag set when user explicitly clicks logout |
| `cx-last-autologin` | `browser.storage.local` | `auto-login.js` | Timestamp to prevent rapid login loops (<30s) |
| `connectify:account` / `connectify:accounts` | `localStorage` | `utils.js` | Last account in use (pages that name no user fall back to it); the first account seen copies keys saved under `current` it lacks. `{ <Connect user id>: <account> }`: each signed-in user's account, fixed when first seen (Connect's `coisp`, else for the first user only the account already in use, else `user<id>`), so signing in as someone else never shows the last user's caches and signing back in brings them back |
| `connectify:seen_version` / `connectify:overhaul_notice` / `connectify:theme_boot` / `connectify:pointer_mouse` | `localStorage` | `update-notice.js` / `overhaul-notice.js` / `theme-boot.js` / `pointer-kind.js` | Last extension version seen; `'true'` once the 3.3.0 overhaul migration ran (or a fresh install skipped it); a newer manifest version shows the update notice once (fresh installs only record it); `{ id, dark, attrs, props, canvas, bg }` snapshot of the applied theme (`bg`: `{ url }` small, `{ settings }`, `{ theme }`), applied at document_start; `'true'` once a mouse was used (touch clears it) |

---

## 5. Custom DOM Events

| Event Name | Dispatcher | Listener(s) | Payload / Purpose |
|---|---|---|---|
| `connectify-open` | Tool toggles / sidebar | Tool panels | `detail: 'calculator' \| 'progress' \| 'weakness' \| 'categories' \| 'predictor' \| 'home'` — enforces single active tool |
| `connectify-baselines-updated` | `category-settings.js` / `predictor-math.js` | `predictor-ui.js` | Emitted when previous-year baseline averages are saved in Settings |
| `connectify-rescan-auto-types` | `category-store.js` | `task-type-select.js` | Re-detect Auto rows (extension storage returned different categories) |
| `connectify-task-type-changed` | `task-types.js` | `cohort-stats.js`, `compound-progress.js`, `weakness-radar.js` | Dispatched when assessment category override changes |
| `connectify-settings-updated` | `scaling-calibration.js` | `atar-ui.js`, `compound-progress.js`, `progress-graph.js` | Dispatched when calibration scores or categories change |
| `connectify-cohort-invalidated` | `assessment-data.js` | `cohort-stats.js` | Dispatched when cohort caches are cleared to trigger refresh |
| `connectify-request-theme` | Page-world code (theme audit) | `theme-request.js` | Applies the theme id in `<html data-connectify-theme-request>` through the registry |
| `connectify-sync-charts` | `ConnectifyDataSyncCharts()` (`utils.js`) | `data.js` (`MAIN` world) | Re-read every chart's boxplot (after accordions open, on the heartbeat) |
| `connectify-render-radar` | `weakness-radar.js` | `data.js` (`MAIN` world) | Highcharts chart options payload |
| `connectify-destroy-radar` | `weakness-radar.js` | `data.js` (`MAIN` world) | Cleans up Highcharts radar instance |

---

## 6. Critical DOM Selectors & Anchors

- **Course Tile**: `.eds-c-tile` (contains `.eds-c-tile__title`, `.eds-c-tile__header`, `.eds-c-accordion__section-heading`).
- **Assessment Task Row**: `.cvr-c-task` (overall row is outside `.cvr-c-tasks`; individual tasks are inside `.cvr-c-tasks`).
- **Task Details & Marks**:
  - Marks cell: `.cvr-c-task__marks .cvr-c-task__mark`
  - Highcharts host: `[data-highcharts-chart]` or `.cvr-c-task__chart`
  - Task labels: `.cvr-c-task__details .v-label`
- **Injected Containers**:
  - `#connectify-sidebar` & `#connectify-sidebar-handle`
  - `.connectea-panel` & `.connectea-row-wrapper`
  - `#cx-expand-progress` (Animated bulk outline expansion loading pill)
  - `#connectea-atar` (Calculator modal)
  - `#connectify-progress` (Progress graph modal)
  - `#connectify-weakness` (Weaknesses panel)
  - `#connectify-categories` (Settings & Calibration panel)
  - `#connectify-wace-countdown` (Year 12 countdown banner)
  - `.cx-compound-progress-container` (Subject header progress bar)
  - `#cx-back-to-top-container` (Back to top button at bottom of outlines)
  - `#connectify-health-prompt` (Component restore banner)

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
