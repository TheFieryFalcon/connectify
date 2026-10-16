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
- **Category Colors**: Exam (Red `#e74c3c`), Test (Green `#2ecc71`), Application (Blue `#3498db`), Essay (Purple `#9b59b6`), Take-Home (Yellow `#f1c40f`); defined once in `src/cohort/category-store.js`. Labels bind to `--cx-cat-color` via `.cx-cat-name-label`.
- **Assessment Type Label**: Always formatted as `"Type: "` with trailing colon and space.

## 2. Contrast & Typography Standards
- **WCAG AA Threshold**: Minimum **5:1 contrast ratio** across all foreground text and backgrounds in both light and dark modes.
- **Liquid Glass & Panel Geometry**: 16px corner curvature (20px on modal dialogs) applies **only in Liquid Glass** (`[data-connectea-theme="liquid-glass"]` or `[data-connectea-glass="true"]`), on explicit panel, card, tile and modal classes, never `[class*=...]` substring matches. `overflow: hidden` is limited to tiles and cards, never popups or tooltips. All other themes keep Connect's native geometry. Tile bodies are transparent in Liquid Glass. Non-Liquid-Glass panels are strictly opaque (`var(--cx-surface-bg, #1e2632) !important;`) even with custom wallpapers active. Liquid Glass **must NOT** alter the styling, border-radius, or geometry of buttons, inputs or expansion-panel headers; positive (View) buttons stay square like native Connect. Angular panels theme.css cannot name by class are rounded in `theme-glass-panels.css`: the `cnt-stream-notice-card` host (no clip, so the elevation shadow survives), the Library table wrapper and `mat-paginator` bars (16px horizontal padding). Bars, banners and headings Connect leaves flat or surface-less on Class pages (`cnt-scope-intro-class`, `.connect-paginator-container`, category bars, Library toolbar, `p.mat-h2` headings, empty states) share one glass recipe (`theme-glass-surface.css`: 82% fill, blur + saturate, hairline edge, 16px) so no text sits bare on a wallpaper; blocks inside a glass card stay clear with hairline dividers (`theme-glass-class-pages.css`). Paginators, the Select All / Download row and their dropdowns sit on their own surface in every dark theme and in Light when a wallpaper is set (`theme-control-bars.css`: surface token, or white 90% with `#334155` text), geometry native outside Liquid Glass. Empty states are centred in every dark theme (`theme-empty-states.css`).
- **Theme Dropdown & Customizer**: Sleek 28px height with 12x12 chevron and expanded 4px 6px padding (`.connectea-theme-arrow`). In-DOM Theme Customizer (`#cx-customizer-modal`) is styled by the active theme's tokens like the rest of the site (only its live preview uses the draft palette) with Basic (6) & Full (20) modes; every token derives from the 6 Basic ones in two layers (Basic -> Full -> every other `--cx-*`, `theme-token-derive.js`) using the presets' own relationships: OKLCH lightness steps that keep the base hue and chroma/lightness ratio, flipping towards the text on light themes. Muted, disabled and placeholder text follow the presets (no 5:1 floor); primary, secondary, link and primary-button text keep >= 5:1. Live preview renders every Full token, interactive HSV/HEX color picker, custom wallpaper upload and caching, JSON import/export. Hovering over any element in the customizer preview displays a floating tooltip (`#cx-preview-tooltip`) showing the element name, the token colouring the text under the pointer (glyph hit test) and the fill tokens. Includes dual Liquid Glass sliders: **Blur Strength** (0–40px, default 16px, `--cx-glass-blur`) and **Transparency** (10%–100%, default 65%, `--cx-glass-opacity`). Custom themes in the menu have Edit (✎) and Delete (✕); editing saves by the theme's id, so a rename never duplicates it. Saving a new theme checks existing themes by name (case-insensitive), safely stores wallpapers across `localStorage` and `chrome.storage.local` quota limits, and immediately applies the theme via `ConnectifyTheme.applyTheme()`.
- **Custom Wallpaper Pass-Through (Liquid Glass only)**: With Liquid Glass on, layout containers (`#main-content`, `.cvr-c-app-layout*`, `.v-app`, `.v-ui`, `.v-scrollable`) that hold tiles (`:has(.eds-c-tile)`; detail views such as notices keep an opaque surface) and wrappers that only hold tiles (`.v-panel`, `.v-panel-content`, `.cvr-u-padding--md` with `:has(.eds-c-tile)`) are transparent. With Liquid Glass off they stay opaque.
- **Light Mode Container Panel Backgrounds**: In light mode with custom wallpapers, containers (feed tabs `.cvr-c-feed-header`, `.cvr-c-feed-header__tabs`, `mat-tab-header`, `.mat-tab-nav-bar`, `.eds-c-tabs`, subheaders `.cvr-c-sub-header`, and toolbars) receive light panel backgrounds (`rgba(255, 255, 255, 0.90)`) with crisp dark text (`#334155` / `#0f172a`) so text is never rendered directly over raw wallpapers.
- **Parity Defect & Assessment Outlines**: In Liquid Glass only, `.cvr-u-padding--md` gets `padding: 0 !important;` (never `display: none`); every other mode keeps Connect's native padding. Parity test checks button and input styling across all themes, ignoring only panels, cards, tiles, and modals under Liquid Glass.
- **Scenario Values in Dark Mode**:
  - Low: `#e1eaf3` on dark card.
  - Middle / Expected: High-contrast white `#ffffff` on `#334c65`.
  - High: High-contrast vibrant green `#4ade80` on dark card.
- **Containers & Padding**: a container and its own padding are one surface and keep very similar colours; the audit skips adjacent-contrast between an element that fills its parent's content box and that parent, and warns (`PADDING_COLOR_MISMATCH`) when their colours differ. Icon-only buttons (class containing `icon`, or `.mat-icon-button`, even when bordered) keep native padding and size so webfont glyphs are never offset (`theme-icon-buttons.css`). Dialog title, content and footer regions are transparent over the dialog's one surface (`theme-dialog-surface.css`); a `cnt-paginator` that wraps the table keeps native layout (only the paging bar is flexed).
- **Semantic Classes**: Use semantic classes (`.cx-settings-label`, `.cx-pred-scenario-value--mid`, `.cx-settings-col-header`) instead of hardcoded inline dark styles.
- **Dynamic Surface Adaptation**: Use `data-connectea-surface` and `data-connectea-ink` on unstyled surfaces. Avoid inline style mutations.
- **Typography Bolding Parity**: Dark and light modes enforce 1:1 bolding parity (`font-weight: 700 !important` on task titles `.cvr-c-task__details .v-label:first-child`, `.cvr-c-task__title`, group headers, task marks, and cohort stats `strong` tags; `font-weight: 400 !important` on secondary labels, out-of text, and subject summary marks).
- **Login Screen Dark Mode Suppression & Post-Login Restoration**: Dark mode is strictly toggled off on `https://connect.det.wa.edu.au/login` (removing `.connectea-dark` and temporarily setting storage to `light`, recording `connectea:theme:restore_dark`) to prevent broken styles on the account selector. Upon successful login and navigation to normal Connect pages, dark mode is automatically restored.

## 3. Sidebar & Workspace Geometry
- **Toggle Handle (`#connectify-sidebar-handle`)**: Sleek 30px width handle with directional chevron (`❮` / `❯`). When the drawer is closed, anchors directly to Connect's native left navigation sidebar (`height >= 120`, excluding primary top menus) scrolling in sync with Connect's sidebar via `position: absolute`, or `position: fixed` if the sidebar is fixed/sticky. Switches to `position: fixed` docked to the drawer edge when the drawer is open. Falls back to dynamic viewport vertical centering below top navigation bars (`rect.top <= 25`) if no Connect sidebar is present.
- **Drawer Width (`#connectify-sidebar`)**: Compact 310px; expands to **900px** (`.cx-tool-active`) when any tool is active.
- **Drawer Slide Synchronization**: `#connectify-sidebar` and `#connectify-sidebar-handle` animate in lockstep with matching `0.2s cubic-bezier(0.16, 1, 0.3, 1)` transitions using `transform: translateX(-100%)` to `0`, preventing clipping.
- **Left-Edge Push & Hover Dismissal**: Moving mouse to `clientX <= 12` expands the drawer. Moving mouse outside collapses it after 120ms debounce when no tool is active. When a tool is active, hover collapse is suppressed and clicking outside collapses it. Returning from an active tool panel retains the launcher menu (`justReturnedToMenu`) without hover collapse. Clicking the handle always wins over hover: after a click-close nothing reopens the drawer until the pointer leaves the handle and the edge zone, and a click within 400ms of a hover-open keeps it open.
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
  - Suppress on a subject's first *marked* assessment unless a numeric subject baseline exists: prior data means an earlier marked row in the card or, for Semester 2, a marked Semester 1 result (unmarked rows never count). First tasks of a type render normally when prior subject data exists.
  - When baselines are cleared/removed, `saveBaselines()` thoroughly purges all legacy storage candidate keys to prevent zombie baseline resurrection, strictly suppressing outcome bars on first tasks.
- **Interaction**: Segments must have `pointer-events: none !important;` to eliminate hover boundary thrashing. Handled via singleton floating tooltip (`#connectea-outcome-tooltip`) using viewport-fixed coordinates. Outcome bars and segments must **never** set the native HTML `title` attribute to prevent overlapping dual tooltips.

## 5. Cold-Start & Mathematical Modeling
- **Logarithmic Headroom Above 80%**: Taper achievable gains proportionally to remaining headroom $\frac{100 - \text{Score}}{20}$.
- **Calibrated Variance Scaling on Predictions**: Low delta scales moderately with variance ($\Delta_{\text{Low}} = \min(18, \max(1.5, \frac{\sigma^2}{20} + 0.45\sigma + \Delta_{\text{penalty}}))$) and high delta as $\Delta_{\text{High}} = \min(8.5, \max(1.5, 0.88\sigma))$, preventing excessive spread on volatile subjects while preserving realistic downside/upside bounds.
- **New School Year Baselines** (`year-rollover.js`): when every class on the outlines page has a new name and the new set is a later year (by year level or calendar year, or never seen before when titles carry neither), last year's snapshot of assessment type and subject averages (grade cache marks preferred) becomes the baselines for types that are still categories and subjects still present (matched year-independently, e.g. `11 Chemistry ATAR` -> `12 Chemistry ATAR`). Previous baselines are backed up, last year's cached results are cleared, and viewing an earlier year never triggers it.
- **Settings Cold-Start Guidance**: When a subject lacks scores or baselines, display guidance card with a direct "Go to Settings" shortcut. Dynamically inject baseline inputs when custom categories are created.

## 6. Runtime & DOM Safety
- **World Isolation**: Respect `MAIN` world data bridge (`data.js` stamps `dataset.connectifyStats`) vs `ISOLATED` world UI scripts.
- **Zero-Flicker Observers**: Page-wide observation and periodic work go through `ConnectifyScheduler` (`onMutations` with a filter and `mute`, `every` gated on activity, visibility and open panels), never a new body observer or `setInterval`; filter out `style` attribute mutations; track user activity with `ConnectifyIsUserActive()`.
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
- **Strict Line Count Constraint**: Every JS and CSS file in `src/` must be **$\le 250$ lines**. `test_suite.js` and the `scripts/` test tooling are exempt. `overview.md`, `design_rules.md`, and all modular documentation files in `docs/` must remain strictly **$\le 150$ lines each** at all times.
- **New Features, New Files**: New features go in new, self-contained files (registered in `manifest.json` in dependency order). Never append a new feature to an existing module.
- **Theme Scoping**: Every theme selector must be scoped to a theme hook (`.connectea-dark`, `data-connectea-*`, or a `cx`/`connectify` id/class). Unscoped rules that change native Connect styling are not allowed, apart from the explicit allowlist in `test_suite.js`.
- **Token-Routed Colours**: dark and glass rules write theme colours as `var(--cx-<token>, <Dark literal>)` (or `color-mix` of tokens) so custom themes reach every surface; only semantic status colours stay literal (Test 167).

## 10. Test Integrity & Direct Implementation
- **User Instruction on Test Maintenance**: "In the future, when I ask you to change something, please change any tests that explicitly assert against that thing instead of using weird workarounds which may cause many more problems later, as that test was likely created out of a misunderstanding. Please push and commit always."
- **Direct Test Updates**: When requested to change functionality, typography, markup, styling, or behavior, directly update the implementation and any tests that explicitly assert against that specific item.
- **No Workarounds to Appease Tests**: Never use indirect workarounds (such as initializing an element with an old value only to overwrite it with `.textContent`, or adding redundant attributes) just to appease an outdated test assertion. Outdated test assertions were likely written under an earlier requirement or misunderstanding and must be updated directly to assert the newly specified behavior.
