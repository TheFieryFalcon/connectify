# Connectify Context & Development Rules

All development in this repository must strictly adhere to `design_rules.md` and all architectural specifications in `docs/`. This rule is always active across all conversations. Refer to `docs/` for architectural questions instead of searching the codebase.

The full rule set is always loaded into context via these imports:

@design_rules.md
@docs/architecture.md
@docs/apis_and_storage.md
@docs/modules_core.md
@docs/modules_system.md
@docs/modules_ui_analytics.md
@docs/features_navigation_ui.md
@docs/features_analytics_publishing.md

---

## 1. Core Design Rules (`design_rules.md`)
- **Palette**: Canvas `#12171f` (Dark) / `#f7f9fc` (Light), Nav `#1a222d` / `#ffffff`, Tiles `#1e2632` (border `#2e3c4e`), Cohort Panel `#15263a` (border `#264669`, text `#d6e8f8`), Summary marks `#161e29`.
- **Contrast & Typography**: WCAG AA $\ge 5:1$ contrast ratio on all foreground/backgrounds. 1:1 bolding parity between light/dark modes (`700` on task titles, marks, stats headers; `400` on secondary labels). Dark mode disabled on login page (`/login`) and restored after login.
- **Sidebar & Handle**: 30px handle (`#connectify-sidebar-handle`), anchors directly to Connect native sidebar (`height >= 120`) scrolling synchronously; falls back to dynamic viewport vertical centering (`rect.top <= 25`). Drawer expands to 900px (`.cx-tool-active`) with `← Back to Menu`. Left-edge expand (`clientX <= 12`), outside click dismiss.
- **Outcome Meter**: Width 18px, height 56px. 4 baseline segments (Red, Orange, Yellow, Green). Secret Purple breakout segment (height 20px) when score $> 1.10 \times \text{High}$ (strictly secret threshold). Critical shortfall: 0 segments with red pulsing alarm glow (`.connectea-outcome-critical`). Suppressed on unmarked tasks and first task lacking baseline. Singleton floating tooltip (`#connectea-outcome-tooltip`), `pointer-events: none !important;` on segments.
- **Math Modeling**: Logarithmic headroom compression above 80% ($\frac{100 - \text{Score}}{20}$). Calibrated variance scaling preventing spread explosion on volatile subjects.
- **Runtime & Safety**: World isolation (MAIN `data.js` stamps dataset vs ISOLATED content scripts). Zero-flicker observers with activity tracking (`ConnectifyIsUserActive`).
- **Subsystem Invalidation**: Independent invalidation keys (`connectify:cache_version:<subsystem>`). Increment version on math changes. Isolated clearing.
- **Brevity & Size Standards**: `src/` JS/CSS files $\le 250$ lines (`test_suite.js` and `scripts/` test tooling exempt). Markdown docs $\le 150$ lines each. New features go in new files.
- **Geometry**: Panel rounding, 0px `.cvr-u-padding--md` padding and wallpaper pass-through apply only in Liquid Glass.

---

## 2. Architecture & Script Pipeline (`docs/architecture.md`)
Main world `src/system/data.js` extracts Highcharts boxplot quantiles onto DOM `dataset.connectifyStats`.
Isolated world content scripts run in the exact dependency order listed in `manifest.json` and `docs/architecture.md` (imported above), starting with `src/system/utils.js` (`ConnectifyUtils`: `normalize`, storage key scans, baseline keys). Reuse it instead of re-implementing helpers.

---

## 3. Core & UI Submodules Summary (`docs/modules_core.md`, `docs/modules_ui_analytics.md`)
- `assessment-data.js` & submodules (`assessment-cache.js`, `assessment-parser.js`, `assessment-expand.js`): In-memory subjects/task cache, card scraping, paced bulk expansion with non-blocking chunked finalization (90%->95%->98%->100%), 450ms animation guard.
- `cohort-view.js` & submodules (`cohort-outcome.js`, `cohort-row-readers.js`, `cohort-panel.js`, `cohort-outcome-eval.js`): Stats panel injection, row memoization (`ui._memo`), outcome meter rendering with secret purple breakout.
- `cohort-stats.js`, `cohort-styles.js` & `cohort-observer.js`: Two-pass coordinator, `card._cxTaskRows` query caching, debounced scheduler, page observer.
- `category-settings.js` & `category-baselines.js`: Category keywords, custom categories, previous-year baselines with candidate key purging.
- `predictor-math.js` & submodules (`predictor-engine.js`, `predictor-dates.js`, `predictor-cache.js`): `predictionMemoryCache` Map for zero-disk lookups, task prediction, grade/ATAR projections.
- `predictor-ui.js` & `predictor-grade-view.js`: Predictor drawer panel, 6 subject tabs, upcoming task projections, ATAR hero cards.
- `sidebar.js` & `sidebar-handle.js`: Canonical launcher sequence (Target ATAR, Target Grade, Predictor, Progress, Estimate, Weakness, Settings).

---

## 4. System & Styling Summary (`docs/modules_system.md`, `docs/apis_and_storage.md`)
- `notifications.js`: Universal vertical stacked toast manager (`#connectify-notifications-container`).
- `new-grade.js`: Running average grade delta detection ($\ge 0.05\%$; boxplot stats must move by more than 1 point) with single-card expand and "Jump to Subject" glow.
- `dom-sweeper.js`: SPA DOM monitor and health restorer; panel mutation filter suppresses collapse loops.
- Theme (`src/theme/`): `theme-auth.js`, `theme-custom-tokens.js`, `theme-palettes.js`, `theme-registry.js`, `theme-custom-themes.js`, customizer modules and `theme.js` engine (see `docs/modules_system.md`): 7 preset palettes, in-DOM customizer, wallpaper upload/caching, Liquid Glass, unstyled surface adaptation (`data-connectea-surface`).
- Modular styles: `src/sidebar/sidebar-*.css`, `src/atar/atar.css` (+ `atar-compact.css`, `atar-planner.css`), `src/progress/progress.css`, and the theme cascade in `src/theme/styles/` (one concern per file, ending with `theme.css`).
- Connect CSS reference: `./connect_css/` contains upstream Connect portal stylesheets (`main_aDnd.css`, `clay_aDnd.css`, etc.) providing native DOM selectors, layout classes, and UI structures.
- Storage keys: `connectea:theme:v1`, `connectea:theme:id`, `connectea:theme:last_theme`, `connectea:theme:custom_themes`, `connectea:theme:wallpaper`, `connectea:theme:liquid_glass`, `connectea:task_type_overrides`, `connectea:class_categories:`, `cx-categories`, `connectify:prediction:`, `connectify:stats_cache:`, `connectify:grade_cache:`, `connectify:cache_version:<subsystem>`.
 
---
 
## 5. Git & Remote Workflow
- Always commit and push all verified changes to remote (`origin main`) after completing every task. Never leave working trees uncommitted or unpushed.

---

## 6. Test Integrity & Direct Implementation
- **User Instruction on Test Maintenance**: "In the future, when I ask you to change something, please change any tests that explicitly assert against that thing instead of using weird workarounds which may cause many more problems later, as that test was likely created out of a misunderstanding. Please push and commit always."
- When requested to change functionality, typography, markup, styling, or behavior, directly update the implementation and any tests that explicitly assert against that specific item. Never use indirect workarounds (such as initializing an element with an old value only to overwrite it with `.textContent`, or adding redundant attributes) just to appease an outdated test assertion. Outdated test assertions were likely written under an earlier requirement or misunderstanding and must be updated directly to assert the newly specified behavior.
