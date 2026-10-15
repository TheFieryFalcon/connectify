# Connectify Design Rules & Style Standards

Extremely concise summary of the core visual design language, contrast standards, component geometry, and interaction patterns across Connectify.

---

## 1. Color Palette & Hierarchy
- **Canvas / Background**: Light `#f7f9fc`, Dark `#12171f`, Quantum Dark `#282828` (Gruvbox bright green `#b8bb26` highlights), AMOLED `#000000`, Midnight `#0b132b`, Forest `#0a1914`, Sunset `#20101b`, Liquid Glass diffusion.
- **Top Navigation & Menus**: Light `#ffffff` / `#e9f2fb`, Dark `#1a222d`.
- **Course Tiles (`.eds-c-tile`)**: Light `#ffffff` (border `#d8e3ee`), Dark `#1e2632` (border `#2e3c4e`, hover `#3d5066`). Translucent frosted glass (`rgba(18, 26, 40, 0.65)`) in Liquid Glass / custom background.
- **Cohort Statistics Panel (`.connectea-panel`)**: Deep navy `#15263a`, border `#264669`, text `#d6e8f8`.
- **Summary Marks Box (`.cvr-c-task__marks`)**: Box `#161e29`, divider `#2d3b4d`.
- **Accordions & Section Headers**: `#222b39`, border `#2e3c4e`; transparent over custom wallpapers or Liquid Glass.
- **Category Colors**: Exam (Gold `#d97706`), Test (Blue `#2563eb`), Application (Green `#059669`), Essay (Purple `#7c3aed`), Take-Home (Teal `#0d9488`). Labels bind to `--cx-cat-color` via `.cx-cat-name-label`.
- **Assessment Type Label**: Always formatted as `"Type: "` with trailing colon and space.

## 2. Contrast & Typography Standards
- **WCAG AA Threshold**: Minimum **5:1 contrast ratio** across all foreground text and backgrounds in both light and dark modes.
- **Liquid Glass & Panel Geometry**: Universal 16px corner curvature including bottom corners (`border-radius: 16px !important; border-bottom-left-radius: 16px !important; border-bottom-right-radius: 16px !important; overflow: hidden !important;`) across all Connect panels, cards, tiles, and modal dialogs (20px) in dark mode and Liquid Glass. Tile bodies enforce 16px bottom curvature. Tile bodies are transparent in Liquid Glass mode. Non-Liquid-Glass panels are strictly opaque (`var(--cx-surface-bg, #1e2632) !important;`) even with custom wallpapers active. Liquid Glass **must NOT** alter the styling, border-radius, or geometry of buttons or inputs.
- **Theme Dropdown & Customizer**: Sleek 28px height with 12x12 chevron and expanded 4px 6px padding (`.connectea-theme-arrow`). In-DOM Theme Customizer (`#cx-customizer-modal`) with Basic & Full modes, live preview rendering all 14 tokens, interactive HSV/HEX color picker, custom wallpaper upload and caching, JSON import/export. Hovering over any element in the customizer preview displays a floating tooltip (`#cx-preview-tooltip`) showing the element name and responsible CSS token. Includes dual Liquid Glass sliders: **Blur Strength** (0–40px, default 16px, `--cx-glass-blur`) and **Transparency** (10%–100%, default 65%, `--cx-glass-opacity`). Saving a theme checks existing themes by name (case-insensitive), safely stores wallpapers across `localStorage` and `chrome.storage.local` quota limits, and immediately applies the theme via `ConnectifyTheme.applyTheme()`.
- **Light Mode Container Panel Backgrounds**: In light mode with custom wallpapers, containers (feed tabs `.cvr-c-feed-header`, `.cvr-c-feed-header__tabs`, `mat-tab-header`, `.mat-tab-nav-bar`, `.eds-c-tabs`, subheaders `.cvr-c-sub-header`, and toolbars) receive light panel backgrounds (`rgba(255, 255, 255, 0.90)`) with crisp dark text (`#334155` / `#0f172a`) so text is never rendered directly over raw wallpapers.
- **Parity Defect & Assessment Outlines**: `.cvr-u-padding--md` enforces `padding: 0 !important;` (never `display: none`) so that Assessment Outlines subject cards render fully while preserving tight layout parity. Parity test checks button and input styling across all themes, ignoring only panels, cards, tiles, and modals under Liquid Glass.
- **Scenario Values in Dark Mode**:
  - Low: `#e1eaf3` on dark card.
  - Middle / Expected: High-contrast white `#ffffff` on `#334c65`.
  - High: High-contrast vibrant green `#4ade80` on dark card.
- **Semantic Classes**: Use semantic classes (`.cx-settings-label`, `.cx-pred-scenario-value--mid`, `.cx-settings-col-header`) instead of hardcoded inline dark styles.
- **Dynamic Surface Adaptation**: Use `data-connectea-surface` and `data-connectea-ink` on unstyled surfaces. Avoid inline style mutations.
- **Typography Bolding Parity**: Dark and light modes enforce 1:1 bolding parity (`font-weight: 700 !important` on task titles `.cvr-c-task__details .v-label:first-child`, `.cvr-c-task__title`, group headers, task marks, and cohort stats `strong` tags; `font-weight: 400 !important` on secondary labels, out-of text, and subject summary marks).
- **Login Screen Dark Mode Suppression & Post-Login Restoration**: Dark mode is strictly toggled off on `https://connect.det.wa.edu.au/login` (removing `.connectea-dark` and temporarily setting storage to `light`, recording `connectea:theme:restore_dark`) to prevent broken styles on the account selector. Upon successful login and navigation to normal Connect pages, dark mode is automatically restored.

## 3. Sidebar & Workspace Geometry
- **Toggle Handle (`#connectify-sidebar-handle`)**: Sleek 30px width handle with directional chevron (`❮` / `❯`). When the drawer is closed, anchors directly to Connect's native left navigation sidebar (`height >= 120`, excluding primary top menus) scrolling in sync with Connect's sidebar via `position: absolute`, or `position: fixed` if the sidebar is fixed/sticky. Switches to `position: fixed` docked to the drawer edge when the drawer is open. Falls back to dynamic viewport vertical centering below top navigation bars (`rect.top <= 25`) if no Connect sidebar is present.
- **Drawer Width (`#connectify-sidebar`)**: Compact 310px; expands to **900px** (`.cx-tool-active`) when any tool is active.
- **Drawer Slide Synchronization**: `#connectify-sidebar` and `#connectify-sidebar-handle` animate in lockstep with matching `0.2s cubic-bezier(0.16, 1, 0.3, 1)` transitions using `transform: translateX(-100%)` to `0`, preventing clipping.
- **Left-Edge Push & Hover Dismissal**: Moving mouse to `clientX <= 12` expands the drawer. Moving mouse outside collapses it after 120ms debounce when no tool is active. When a tool is active, hover collapse is suppressed and clicking outside collapses it. Returning from an active tool panel retains the launcher menu (`justReturnedToMenu`) without hover collapse.
- **Canonical Launcher Button Sequence**:
  1. `connectify-target-toggle` (Target ATAR)
  2. `connectify-grade-toggle` (Target Grade)
  3. `connectify-predictor-toggle` (Predictor)
  4. `connectify-progress-toggle` (Year in Progress)
  5. `connectify-estimate-toggle` (ATAR Estimate)
  6. `connectify-weakness-toggle` (Weakness Analyzer)
  7. `connectify-categories-toggle` (Settings)
- **Secondary Tool Buttons**: Settings and Weakness Analyzer feature clean white buttons (`#ffffff`) in light mode with centered text (`text-align: center !important; justify-content: center !important;`).
- **Workspace Navigation**: Dedicated `← Back to Menu` navigation header (`.cx-back-menu`) positioned at the top right of the header; single active tool policy enforced via `connectify-open` event; outside click and Escape key dismissal.

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
  - Suppress on first assessment of a subject unless cold-start baselines exist (first tasks of a type render normally when prior subject data exists).
  - When baselines are cleared/removed, `saveBaselines()` thoroughly purges all legacy storage candidate keys to prevent zombie baseline resurrection, strictly suppressing outcome bars on first tasks.
- **Interaction**: Segments must have `pointer-events: none !important;` to eliminate hover boundary thrashing. Handled via singleton floating tooltip (`#connectea-outcome-tooltip`) using viewport-fixed coordinates. Outcome bars and segments must **never** set the native HTML `title` attribute to prevent overlapping dual tooltips.

## 5. Cold-Start & Mathematical Modeling
- **Logarithmic Headroom Above 80%**: Taper achievable gains proportionally to remaining headroom $\frac{100 - \text{Score}}{20}$.
- **Calibrated Variance Scaling on Predictions**: Low delta scales moderately with variance ($\Delta_{\text{Low}} = \min(18, \max(1.5, \frac{\sigma^2}{20} + 0.45\sigma + \Delta_{\text{penalty}}))$) and high delta as $\Delta_{\text{High}} = \min(8.5, \max(1.5, 0.88\sigma))$, preventing excessive spread on volatile subjects while preserving realistic downside/upside bounds.
- **Settings Cold-Start Guidance**: When a subject lacks scores or baselines, display guidance card with a direct "Go to Settings" shortcut. Dynamically inject baseline inputs when custom categories are created.

## 6. Runtime & DOM Safety
- **World Isolation**: Respect `MAIN` world data bridge (`data.js` stamps `dataset.connectifyStats`) vs `ISOLATED` world UI scripts.
- **Zero-Flicker Observers**: Use debounced `requestAnimationFrame` loops; filter out `style` attribute mutations; track user activity with `ConnectifyIsUserActive()`.
- **Strict Deduplication**: Purge redundant DOM elements on SPA transitions. Ensure all tool launchers and panels export standard `panelRefs` (`toggleBtn`, `panel`).

## 7. Panel Lifecycle & Backwards Compatibility
- **No Unauthorized Auto-Expansion**: Panels and subject outlines are **not allowed to be automatically expanded without user involvement** (e.g. clicking a button such as "Expand All", "Expand Subject Outlines", or an individual subject accordion). The **sole exception** is initial expansion on page load if auto expand all is checked (`connectify:auto_expand`).
- **Settings Cache Backwards Compatibility**: Backwards compatibility must be maintained with cached data from previous versions. Stored user preferences, baselines, category configurations, and scaling calibrations must gracefully resolve legacy keys (`connectea:`, `cx-`, `connectify:`) without data loss.

## 8. Subsystem Cache Invalidation & Algorithm Versioning Standards
- **Independent Subsystem Invalidation Keys**: Subsystems (Predictor, Results, Settings, Cohort) must maintain separate, independent invalidation version strings (e.g. `PREDICTOR_ALGO_VERSION`, `RESULTS_ALGO_VERSION`, `SETTINGS_ALGO_VERSION`, `COHORT_ALGO_VERSION`) and corresponding storage keys (`connectify:cache_version:<subsystem>`).
- **Mandatory Version Increment on Algorithm Changes**: Whenever mathematical algorithms, scraping heuristics, or data models are modified within any subsystem, that subsystem's specific invalidation version value **must** be updated.
- **Isolated Subsystem Cache Clearing**: Clearing a subsystem cache must be strictly scoped to that subsystem's domain. Updating or invalidating the predictor cache must never purge user settings or cohort data, and vice versa.
- **Memoized Row Rendering**: Cohort panels and outcome bars must memoize render state (`_lastMark`, `_lastStatsKey`, `_lastEstimatedSize`, `taskType`, `baselinesSig`). Skip PCHIP splines, historical aggregation, and DOM rebuilds if data has not changed, preventing frame drops during user scrolling.
- **Prediction Cache Synchronization & Expansion Pipeline**: Changing a task's category, saving category settings keywords, or saving baselines immediately refreshes the prediction cache (`updatePredictionCache`). When a subject grade update is detected, the subject is marked stale, and upon subsequent expansion, its cached predictions are refreshed via the expansion pipeline without background DOM scanning.
- **Settings Save Button Styling Parity**: Assessment Categories Save Changes (`#cx-cat-save`) and Baselines Save (`saveBtn`) strictly share the identical canonical primary blue styling (`#2563eb`, white text, 6px 14px padding).

## 9. Documentation Synchronization & Brevity Standards
- **Continuous Documentation Sync**: Always update all files in `docs/` with every change made to their relevant subsystems, modules, or features.
- **Extreme Brevity & High Signal**: Documentation must be kept extremely brief, concise, and focused strictly on useful architectural, mathematical, and implementation facts. Avoid fluff or redundant prose.
- **Strict Line Count Constraint**: `overview.md`, `design_rules.md`, and all modular documentation files in `docs/` must remain strictly **$\le 150$ lines each** at all times.

## 10. Test Integrity & Direct Implementation
- **User Instruction on Test Maintenance**: "In the future, when I ask you to change something, please change any tests that explicitly assert against that thing instead of using weird workarounds which may cause many more problems later, as that test was likely created out of a misunderstanding. Please push and commit always."
- **Direct Test Updates**: When requested to change functionality, typography, markup, styling, or behavior, directly update the implementation and any tests that explicitly assert against that specific item.
- **No Workarounds to Appease Tests**: Never use indirect workarounds (such as initializing an element with an old value only to overwrite it with `.textContent`, or adding redundant attributes) just to appease an outdated test assertion. Outdated test assertions were likely written under an earlier requirement or misunderstanding and must be updated directly to assert the newly specified behavior.
