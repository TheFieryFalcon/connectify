# Connectify Design Rules & Style Standards

Extremely concise summary of the core visual design language, contrast standards, component geometry, and interaction patterns across Connectify.

---

## 1. Color Palette & Hierarchy
- **Canvas / Background**: Light `#f7f9fc`, Dark `#12171f`.
- **Top Navigation & Menus**: Light `#ffffff` / `#e9f2fb`, Dark `#1a222d`.
- **Course Tiles (`.eds-c-tile`)**: Light `#ffffff` (border `#d8e3ee`), Dark `#1e2632` (border `#2e3c4e`, hover `#3d5066`).
- **Cohort Statistics Panel (`.connectea-panel`)**: Deep navy `#15263a`, border `#264669`, text `#d6e8f8`.
- **Summary Marks Box (`.cvr-c-task__marks`)**: Box `#161e29`, divider `#2d3b4d`.
- **Accordions & Section Headers**: `#222b39`, border `#2e3c4e`.
- **Category Colors**: Exam (Gold `#d97706`), Test (Blue `#2563eb`), Application (Green `#059669`), Essay (Purple `#7c3aed`), Take-Home (Teal `#0d9488`). Labels bind to `--cx-cat-color` via `.cx-cat-name-label`.

## 2. Contrast & Typography Standards
- **WCAG AA Threshold**: Minimum **5:1 contrast ratio** across all foreground text and backgrounds in both light and dark modes.
- **Scenario Values in Dark Mode**:
  - Low: `#e1eaf3` on dark card.
  - Middle / Expected: High-contrast white `#ffffff` on `#334c65`.
  - High: High-contrast vibrant green `#4ade80` on dark card.
- **Semantic Classes**: Use semantic classes (`.cx-settings-label`, `.cx-pred-scenario-value--mid`, `.cx-settings-col-header`) instead of hardcoded inline dark styles.
- **Dynamic Surface Adaptation**: Use `data-connectea-surface` and `data-connectea-ink` on unstyled surfaces. Avoid inline style mutations.

## 3. Sidebar & Workspace Geometry
- **Toggle Handle (`#connectify-sidebar-handle`)**: Viewport edge, width 38px, height 74px (expanded handle: 205px wide, 76px high).
- **Drawer Width (`#connectify-sidebar`)**: Compact 310px; expands to **900px** (`.cx-tool-active`) when any tool is active.
- **Canonical Launcher Button Sequence**:
  1. `connectify-target-toggle` (Target ATAR)
  2. `connectify-grade-toggle` (Target Grade)
  3. `connectify-predictor-toggle` (Predictor)
  4. `connectify-progress-toggle` (Progress Graph)
  5. `connectify-estimate-toggle` (ATAR Estimate)
  6. `connectify-weakness-toggle` (Weakness Analyzer)
  7. `connectify-categories-toggle` (Settings)
- **Secondary Tool Buttons**: Settings and Weakness Analyzer feature clean white buttons (`#ffffff`) in light mode with centered text (`text-align: center !important; justify-content: center !important;`).
- **Workspace Navigation**: Dedicated `← Back to Menu` navigation header (`.cx-back-menu`); single active tool policy enforced via `connectify-open` event; Escape key dismissal.

## 4. Outcome Meter & Tooltip Architecture
- **Bar Dimensions**: Width **18px**, total height **56px** (2–3x scale).
- **Segments**:
  - Baseline track: 4 segments (10px height each).
  - Tier mapping: Red ($< \text{Low}$), Orange ($\text{Low} \le S < \text{Mid}$), Yellow ($\text{Mid} \le S < \text{High}$), Green ($S \ge \text{High}$).
  - Active segment opacity: 100% in dark mode against inactive track `#334155`.
- **Secret Purple Breakout**: When score $> 1.10 \times \text{High}$, bar erupts with a double-height 5th Purple segment (`.connectea-active-purple`, height 20px). **The purple breakout threshold is strictly secret**—never disclosed in legends or tooltips.
- **Critical Shortfall**: When score $\le \text{Low} - 10\%$ (additive), bar renders 0 segments (empty) with pulsing red alarm glow (`.connectea-outcome-critical`).
- **Suppression Rules**:
  - Suppress outcome bars on incomplete or unmarked assessments (`Number.isFinite(mark)` check).
  - Suppress on first assessment of a subject or type unless cold-start baselines exist.
- **Interaction**: Segments must have `pointer-events: none !important;` to eliminate hover boundary thrashing. Handled via singleton floating tooltip (`#connectea-outcome-tooltip`) using viewport-fixed coordinates. Outcome bars and segments must **never** set the native HTML `title` attribute to prevent overlapping dual tooltips.

## 5. Cold-Start & Mathematical Modeling
- **Logarithmic Headroom Above 80%**: Taper achievable gains proportionally to remaining headroom $\frac{100 - \text{Score}}{20}$.
- **Quadratic Variance Penalty on Low Estimate**: Low delta scales quadratically with variance ($\Delta_{\text{Low}} = \min(18, \max(5, \frac{\sigma^2}{10} + 0.6\sigma))$).
- **Settings Cold-Start Guidance**: When a subject lacks scores or baselines, display guidance card with a direct "Go to Settings" shortcut. Dynamically inject baseline inputs when custom categories are created.

## 6. Runtime & DOM Safety
- **World Isolation**: Respect `MAIN` world data bridge (`data.js` stamps `dataset.connectifyStats`) vs `ISOLATED` world UI scripts.
- **Zero-Flicker Observers**: Use debounced `requestAnimationFrame` loops; filter out `style` attribute mutations; track user activity with `ConnectifyIsUserActive()`.
- **Strict Deduplication**: Purge redundant DOM elements on SPA transitions. Ensure all tool launchers and panels export standard `panelRefs` (`toggleBtn`, `panel`).

## 7. Panel Lifecycle & Backwards Compatibility
- **No Unauthorized Auto-Expansion**: Panels and subject outlines are **not allowed to be automatically expanded without user involvement** (e.g. clicking a button such as "Expand All", "Expand Subject Outlines", or an individual subject accordion). The **sole exceptions** are initial expansion on page load if auto expand all is checked (`connectify:auto_expand`), or a one-time auto-expansion when user confirms a cache update (`connectify:one_time_auto_expand`).
- **Settings Cache Backwards Compatibility**: Backwards compatibility must be maintained with cached data from previous versions. Stored user preferences, baselines, category configurations, and scaling calibrations must gracefully resolve legacy keys (`connectea:`, `cx-`, `connectify:`) without data loss.

## 8. Subsystem Cache Invalidation & Algorithm Versioning Standards
- **Independent Subsystem Invalidation Keys**: Subsystems (Predictor, Results, Settings, Cohort) must maintain separate, independent invalidation version strings (e.g. `PREDICTOR_ALGO_VERSION`, `RESULTS_ALGO_VERSION`, `SETTINGS_ALGO_VERSION`, `COHORT_ALGO_VERSION`) and corresponding storage keys (`connectify:cache_version:<subsystem>`).
- **Mandatory Version Increment on Algorithm Changes**: Whenever mathematical algorithms, scraping heuristics, or data models are modified within any subsystem, that subsystem's specific invalidation version value **must** be updated.
- **Isolated Subsystem Cache Clearing**: Clearing a subsystem cache must be strictly scoped to that subsystem's domain. Updating or invalidating the predictor cache must never purge user settings or cohort data, and vice versa.
- **Memoized Row Rendering**: Cohort panels and outcome bars must memoize render state (`_lastMark`, `_lastStatsKey`, `_lastEstimatedSize`). Skip PCHIP splines, historical aggregation, and DOM rebuilds if data has not changed, preventing frame drops during user scrolling.

## 9. Documentation Synchronization & Brevity Standards
- **Continuous Documentation Sync**: Always update all files in `docs/` with every change made to their relevant subsystems, modules, or features.
- **Extreme Brevity & High Signal**: Documentation must be kept extremely brief, concise, and focused strictly on useful architectural, mathematical, and implementation facts. Avoid fluff or redundant prose.
- **Strict Line Count Constraint**: `overview.md`, `design_rules.md`, and all modular documentation files in `docs/` must remain strictly **$\le 150$ lines each** at all times.

