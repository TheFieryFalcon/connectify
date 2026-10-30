# Connectify Navigation & Interface Features Reference

This document details user-facing visual features 1 through 10, covering direct shortcuts, dark mode, auto-login, sidebar drawers, accordion controls, exam countdowns, compound progress bars, cohort panels, and assessment type overrides.

---

## 7. Front-Facing Features Directory (Part 1: Features 1–10)

### 1. Direct Navigation Shortcut
- **Source Module**: [`navigation.js`](file:///Users/uwong/Downloads/2.1.14_0/navigation.js)
- **DOM Insertion**: Desktop: Appended after "My Connect" link in `.cvr-c-primary-navigation__links` (`.cvr-js-greedy__item`). Mobile/Drawer: Appended after "My Connect" item in `.cvr-c-primary-menu__list`.
- **UI Appearance**: Matches native Connect navigation link styling seamlessly (`[Assessment Outlines]`).
- **Functionality**: One-click direct link to `/group/students/ui/my-settings/assessment-outlines`, bypassing nested user menus. Automatically reinjects across client-side SPA route transitions. On the outlines page the shortcut is the highlighted tab: it takes Connect's own `eds-s-is-active` from My Connect (which Connect highlights there), and My Connect gets it back on any other page.

### 2. Site-Wide Multi-Theme System & In-DOM Customizer
- **Source Modules**: [`theme.js`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme.js), [`theme-registry.js`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-registry.js), [`theme-customizer.js`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-customizer.js), [`theme.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme.css)
- **DOM Insertion**: Injected into the top navigation header across all Connect pages (`#connectea-theme-toggle` + `.connectea-theme-arrow`).
- **UI Appearance**: Compact 28px toggle button with enlarged 12x12 chevron dropdown trigger; 250px popover menu (`#connectea-theme-menu`); full in-DOM designer modal (`#cx-customizer-modal`).
- **Functionality**:
  - Instant zero-flicker switching between 7 built-in themes: Dark (`dark`), Quantum Dark (`quantum` with Gruvbox bright green `#b8bb26` highlights), AMOLED Black (`amoled`), Midnight Navy (`midnight`), Emerald Forest (`forest`), Liquid Glass (`liquid-glass-clear`, grey, derived from 6 basic colours at 30% transparency) and Liquid Tinted Glass (`liquid-glass`, translucent navy). A saved selection of the removed Twilight Plum (`sunset`) falls back to Dark.
  - Preset backgrounds: Settings and the customizer offer six geometric gradient wallpapers (three dark, three light; `theme-wallpaper-presets.js`, SVG data URIs) next to Upload Background; a theme saves or exports the one picked by id (`wallpaperPreset`), never the image.
  - Import Theme: the theme menu's `Import Theme...` (below Customize Theme) saves a `.ctme` / `.json` file as a custom theme and applies it.
  - In-DOM Theme Customizer: Basic Mode (6 tokens, everything else derived from them) and Full Mode (20 tokens, rarer tokens derived) with live preview rendering every Full token in authentic Connect mockup elements (hover names the text or fill token), interactive HSV/HEX color picker (dragging never selects text or scrolls), Full-mode and preset colours kept as set until a Basic colour they derive from changes (↺ resets one), and `.ctme` import/export (a ZIP of `theme.json` and the wallpaper, named after the theme, e.g. `test_theme.ctme`; old `.json` files still import).
  - Apple Liquid Glass Mode: 16px corner curvature on Connect panels, cards, tiles and modals (buttons, inputs and expansion headers keep native geometry), frosted glass diffusion (`blur(12px)` default); a custom theme with Liquid Glass on becomes a recoloured Liquid Glass theme (translucent fills in its own colours), and Assessment Outlines wrappers that stay clear around tiles with Connect's native 15px `.cvr-u-padding--md` (as in every dark theme). Other themes keep Connect's native geometry.
  - Instant on reload: the last theme (and its wallpaper) is painted at document_start, before Connect renders, so pages never flash white (`theme-boot.js`).
  - Custom Wallpaper: User wallpaper upload (an Adjust Wallpaper prompt resizes and places it in a screen-shaped frame first, `theme-wallpaper-crop.js`; then cropped and scaled to the screen, `theme-wallpaper-fit.js`, so huge photos never lag pages; animated GIFs up to 40 MB (4 MB in the Chrome Web Store build) are kept as uploaded; wallpapers stored before this and large JSON imports are fitted too, `theme-wallpaper-migrate.js`) with local persistence and translucent accordions/tile bodies allowing wallpaper pass-through. The wallpaper is blurred 2px and dimmed (light-text themes) or brightened (dark-text themes) just enough for the text to keep 4.5:1 (`theme-wallpaper-dim.js`), so bars, toolbars, paginators and headings need no contrast panels; text has no shadow.
  - Login page suppression: Dark themes temporarily disable on `/login` and automatically restore upon successful login (`connectea:theme:restore_theme`).
  - Persists active theme in `localStorage` (`connectea:theme:id`, `connectea:theme:last_theme`).

### 3. DET SSO Auto-Login Assistant
- **Source Module**: [`auto-login.js`](file:///Users/uwong/Downloads/2.1.14_0/auto-login.js)
- **DOM Insertion**: DET Single Sign-On page (`https://login.det.wa.edu.au/*`), adjacent to `#login`.
- **UI Appearance**: Checkbox toggle labelled `[x] Auto-login` with a red status badge (`(Paused: logged out)`) when safety guards are active.
- **Functionality**: Presses Student on Connect's Staff / Parent / Student sign-in chooser (`auto-login-student.js`), automatically checks the mandatory terms box, submits saved credentials (also straight after an expired session; in Chrome, which hides an autofilled password from the page until it is touched, the browser's saved password via the Credential Management API, `auto-login-credentials.js`), pauses upon manual logout, and enforces 30-second rapid-loop protection.

### 4. Floating Tools Drawer & Sidebar
- **Source Modules**: `src/sidebar/` (`sidebar.js` and its shell, tools, page notice, handle and hover modules) and `src/sidebar/styles/`
- **Every Page**: the drawer is on every Connect page except the login and logged-out screens. Away from Assessment Outlines every launcher but Settings is greyed out under an "Assessment Outlines Only" notice with an `Open Assessment Outlines →` link; on the outlines page every tool works, filtered or not (tools read the cache).
- **DOM Insertion**: Anchored to Connect's native sidebar (`#connectify-sidebar-handle`) and fixed to viewport (`#connectify-sidebar`).
- **Touch Screens**: until a mouse or trackpad is used (a touch turns it back on), every Connectify control takes a 44px tap (it grows in the layout, so nothing overlaps); the handle is 44px wide; the theme button and its chevron take taps over the whole height of Connect's bar.
- **UI Appearance**: Compact 30px width handle (44px on touchscreens) with directional arrow icon (`❮` / `❯`) without text or excess whitespace. Anchors directly to Connect's left menu when closed; centers vertically on drawer edge when open.
- **Canonical Tools**:
  - **Goal Setter** (`#connectify-goals-toggle`): Target Grade and Target ATAR tabs.
  - **Predictor** (`#connectify-predictor-toggle`)
  - **Year Progression** (`#connectify-progress-toggle`)
  - **Estimator** (`#connectify-estimator-toggle`): Estimate Grade and Estimate ATAR tabs.
  - **Weakness Analyzer** (`#connectify-weakness-toggle`): Clean white button (`#ffffff`) in light mode with centered text.
  - **Settings & Calibration** (`#connectify-categories-toggle`): Clean white button (`#ffffff`) in light mode with centered text.
- **Functionality**:
  - **Connect Native Sidebar Anchoring**: When closed, the handle discovers Connect's native left navigation sidebar (`.cvr-c-service-menu`, `.cvr-c-side-menu`, etc., requiring `height >= 120` and excluding top primary menus) and anchors directly to it via `position: absolute` in document coordinates, or `position: fixed` if the sidebar is sticky/fixed. This scrolls synchronously with Connect's sidebar at native frame rates without floating fixed or snapping. Switches to `position: fixed` in the active viewport when the drawer opens, and falls back to dynamic viewport centering if no Connect sidebar exists.
  - **Left Edge Push Expand & Drawer Slide Animation**: On Assessment Outlines, moving the mouse cursor to the left edge of the screen (`clientX <= 12`) or hovering over the handle automatically expands the sidebar drawer; the top left corner beside Connect's top bar (at least 60px) never does, so the home logo can be clicked. Other pages open the drawer only on a handle click. Both drawer and handle animate in lockstep with synchronized `0.2s cubic-bezier(0.16, 1, 0.3, 1)` transitions (`transform: translateX(-100%)` to `0`), completely eliminating drawer clipping.
  - **Conditional Hover Collapse & Back to Menu Retention**: Moving mouse outside the sidebar collapses it after a 120ms debounce when no tool is active. When a tool panel is active (`.cx-tool-active`), hover collapse is suppressed and clicking outside collapses it. Returning from an active tool panel (`← Back to Menu`) retains the launcher menu without collapsing even if the mouse is outside the 310px width (`justReturnedToMenu`).
  - **Scoped Dynamic Vertical Centering**: Dynamically queries only top navigation bars (`.cvr-c-header`, `.cvr-c-primary-navigation` with `rect.top <= 25`), avoiding course card tile headers, and smoothly centers the handle across the visible viewport on scroll and resize.
  - **Navigation & Layout**: Expands drawer from 310px to 900px (`.cx-tool-active`) with prominent `← Back to Menu` navigation button at the top right of the header. Outside-click and Escape key handlers collapse the drawer safely.

### 5. Outline Accordion Expand / Collapse Controls
- **Source Modules**: `src/atar/outline-controls.js`, `src/atar/atar-features.js`, `src/assessment/assessment-expand.js`
- **DOM Insertion**: Floating pill button container (`#cx-expand-btn`) anchored to bottom-right; animated loading pill (`#cx-expand-progress`) on first expand.
- **UI Appearance**: Compact buttons: `Expand All` and `Collapse All`, under a Jump To row (`#cx-jump-subject`: a narrow dropdown of cleaned subject names in page order whose list opens upwards with every subject showing (no scrolling, even with seven or more), a long name shortened with an ellipsis only in the closed dropdown (the list shows full names), and a `Jump To` button that expands, scrolls to and highlights that subject's card). Progress pill shows animated spinner, percentage, and blue fill bar.
- **Functionality**: Clicks accordion headings staggered across animation frames; mounts `#cx-expand-progress` on bulk expand, freezes scroll (`.cx-freeze-scroll`), skips calculations when cache is valid, and persists pill through DOM refresh; silences background MutationObservers during animation (`window.ConnectifyIsAccordionAnimating`) and flushes deferred passes on settle; deduplicates headings per section/tile rather than outer dashboard wrappers to guarantee all cards collapse/expand; respects `connectify:auto_expand` setting on load.
- **Back to Top Button**: Injects a centered button (`#cx-back-to-top-btn` in `#cx-back-to-top-container`) at the bottom of the outlines list for smooth scrolling back to top. Styled identically across light (`#ffffff` background, `#cbd5e1` border) and dark modes (`#202c3b` surface, `#455a73` border) with 6px rounded corners, 500 font-weight, and $\ge 5:1$ contrast.

### 6. Year 12 WACE Exam Countdown Banner
- **Source Module**: [`wace-countdown.js`](file:///Users/uwong/Downloads/2.1.14_0/wace-countdown.js)
- **DOM Insertion**: Pre-pended to `#main-content` (`#connectify-wace-countdown`).
- **UI Appearance**: Centered dark gold card with gold border and countdown typography (`⏳ 142 days until WACE Exams`).
- **Functionality**: Detects Year 12 ATAR enrolment, computes days until WACE examinations (late October), and dynamically indicates exam progress during active examination weeks.

### 7. Compound Subject Progress Bars
- **Source Module**: [`compound-progress.js`](file:///Users/uwong/Downloads/2.1.14_0/compound-progress.js)
- **DOM Insertion**: Embedded in subject card headers (`.eds-c-tile__header`, `.cvr-c-tile__header`, `.c-tile__header`), below title (`.cx-compound-progress-container`).
- **UI Appearance**: Multi-segmented horizontal bar (`height: 6px; border-radius: 3px;`) color-coded by category with completion status text. Scales to 100% display width.
- **Functionality**: Proportional task weights; completed assessments opaque, pending translucent; hover tooltips; Semester 1 cards display Semester 1 tasks, while Semester 2 cards encapsulate tasks from both semesters for cumulative annual progress tracking; reactive to category changes.

### 8. Assessment Cohort Statistics & Rank Panels
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`cohort-stats.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-stats.js)
- **DOM Insertion**: Inside assessment rows (`.cvr-c-task__details`) alongside task labels. Since Connect's October 2026 Angular outlines, every card is drawn again in Connect's old Vaadin look (tiles, Show Details, Raw Score / Weighted Mark cells, Highcharts-style boxplots) from Connect's own API, so the panels, meters and every outline tool work as before; Connect's filter menu still picks the cards. The outlines appear about 2.7s after load (Auto-expand opens them then), boxplots filling in by ~7s, while Connect's own page shows nothing until ~13s (it fetches each boxplot in turn).
- **UI Appearance**: Light blue card (`.connectea-panel`) showing distribution quantiles and student percentile rank metrics. Preserves constant 1920x1080 display width scaling in a single horizontal row (`.connectea-row-wrapper`) alongside type dropdown and outcome bar (scaling smoothly down to 0.62 at $\le 950$px and 0.55 at $\le 800$px with compact spacing). Settings "Statistics Panels" can expand overall rows, or every row, into wide, short cards: Score / Rank / Average beside the five boxplot values in one row (the quantile the result has reached faintly tinted), SD · Z-Score · standing below; the Score's accent grows more vivid the further the result sits above its predicted range, and glows purple on a breakout.
- **Functionality**: Extracts Highcharts quantiles, computes weighted mean, standard deviation, PCHIP cohort percentile, $z$-score, and school rank. Unmarked tasks show a compact one-line prediction panel instead (`.connectea-forecast`: Low • **Mid** • High in the Predictor's colours, Low and High semibold under a bold Mid, the breakout threshold never shown; without results or a subject baseline it says what the prediction needs). First task of a subject strictly suppresses outcome bars when no subject baseline exists or when a baseline is cleared, thoroughly purging candidate keys to prevent resurrecting deleted baselines. A class without a final letter grade also shows its predicted class result (Low • Mid • High) under its overall statistics (`.connectea-upcoming`). Maintains constant horizontal alignment without wrapping.

### 9. Assessment Type Dropdowns & Custom Categories
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`task-types.js`](file:///Users/uwong/Downloads/2.1.14_0/task-types.js)
- **DOM Insertion**: Inline in `.connectea-row-wrapper` adjacent to statistics panel.
- **UI Appearance**: Compact dropdown selector (`Type: [ Auto (Exam) v ]`) with highlighted styling when overridden.
- **Functionality**: Automated keyword categorizing; manual overrides (`Exam`, `Test`, `Application`, `Essay`, `Take-Home`); supports `+ Custom...` category creation shared across Semester 1 and 2 in that class (new names up to 16 characters). The dropdown is as wide as the chosen type (at most 160px, longer names end in an ellipsis), never its longest option.

### 10. Overall Subject Cohort Controls
- **Source Modules**: [`cohort-view.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-view.js), [`cohort-estimator.js`](file:///Users/uwong/Downloads/2.1.14_0/cohort-estimator.js)
- **DOM Insertion**: Overall subject summary row (top row of each `.eds-c-tile` card).
- **UI Appearance**: Full-width statistics card with cohort size override input (`Cohort Size: [ ~170 ]`); the estimate appears once, already settled (from the saved boxplots, or after the subject's charts load on a first visit), never stepping. When Connect renders a class's Cumulative Percent heading with no row under it (Economics), Connectify restores the row in Connect's own markup with the average worked out from the task marks (noted as such, no boxplot), carrying the same panel.
- **Possible Final Mark**: a class without a final letter shows the lowest and highest final mark it can still reach (every unmarked weighted task at 0% or 100%): Lowest / Highest Possible cells at the end of the expanded card's row, or at the end of the compact panel's result line.
- **Functionality**: Student override for course cohort baseline; persists to `localStorage` (`connectea:cohort:v3:<student>:<year>:<subject>`); immediately recalculates rank and standing across assessments.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
