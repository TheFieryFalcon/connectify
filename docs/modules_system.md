# Connectify System & Styling Modules Reference

This document covers notifications, grade change tracking, DOM integrity monitoring, navigation injection, dark theme surface adaptation, auto-login, stylesheets, and extension manifests.

---

## 2. Module Reference: System, Theme & Styles

### System Health, Navigation & Theme

#### `scheduler.js` (`ConnectifyScheduler`)
- **Role**: One page-wide MutationObserver and one heartbeat shared by every isolated script; loaded first in each isolated group (first copy wins); disconnects on `pagehide`, resumes on a back/forward `pageshow`.
- **Key Functions**: `onMutations(callback, { filter, mute = true })` (records batched per animation frame, per 100ms while hidden); `every(ms, fn, { whenActive = true, whenVisible = true, mute = false, when })`; `isMuted()`.

#### [`notifications.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/notifications.js)
- **Role**: Universal notification and toast manager for Connectify.
- **Key Functions**:
  - `show({ id, type, title, message, details, actions, duration, dismissible, onDismiss })`: Mounts toast notifications into `#connectify-notifications-container`.
  - Supports types (`warning`, `success`, `info`, `grade`) with tailored theme colors, icons, and smooth slide-in/dismiss animations.
  - Automatically stacks concurrent notifications vertically (`flex-direction: column-reverse`).
  - Action button dispatcher supporting custom callbacks with `{ id, element, close }`.
  - `dismiss(id)` and `clearAll()`: Smoothly animates out and cleans up DOM elements.
- **Export**: `window.ConnectifyNotifications`.

#### [`new-grade.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/new-grade.js) & `grade-snapshot.js`
- **Role**: Grade change detection against `connectify:grade_cache:<student>`, once per page.
- **Key Functions**:
  - `grade-snapshot.js` (`ConnectifyGradeSnapshot`): `currentEntries()` reads each subject's running mark and summary boxplot (cohort row readers), Semester 2 card first once it has results; `hasSubjectChanged(prev, entry)`: own mark moved $\ge 0.05\%$ or a quantile moved by more than `STATS_CHANGE_THRESHOLD` (1 point), so other classes uploading results stay quiet; boxplots appearing for the first time count.
  - `checkGrades()`: an empty cache is seeded quietly; each changed subject is marked stale (re-scraped on its next expansion) and announced with a stacked "Class Updated" toast ("[Subject name] scores have been updated."). The cache is rewritten 1 second later.
  - `jumpToSubject(card)`: on the student's click, expands the card if collapsed, re-scrapes it, refreshes its predictions, scrolls to it and pulses `.cx-card-jump-highlight`.
- **Export**: `window.ConnectifyNewGrade`.

#### [`dom-sweeper.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/dom-sweeper.js)
- **Role**: Health monitor that sweeps the DOM for injected Connectify components.
- **Key Functions**:
  - `inspectDOM()`: Sweeps for sidebar, toggle handle, data bridge, and assessment row panels. Properly ignores unmarked/incomplete tasks which intentionally do not render statistics panels, and omits the WACE countdown banner from missing component notices.
  - `promptUser(missingItems)`: Dispatches warning notice via `window.ConnectifyNotifications.show()`.
  - `restoreComponents()`: Auto-triggers reinjection across `ConnectifyInitSidebar`, `ConnectifyCohort.pass()`, `ConnectifyCountdown.update()`, and `ConnectifyCompoundProgress.update()`.
- **Export**: `window.ConnectifyDomSweeper`.

#### [`navigation.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/navigation.js)
- **Role**: Injects direct "Assessment Outlines" shortcut into Connect navigation bar, tracks user activity, and detects session timeouts.
- **Key Functions**:
  - Injects link into desktop greedy navigation and mobile drawer.
  - Tracks user activity (`mousemove`, `keydown`, `scroll`) to update `window.__connectifyLastActive` and provide `window.ConnectifyIsUserActive()`.
  - Monitors session expiry modals and unloads while idle (> 5 min) to set `cx-session-expired`.
  - Intercepts manual logout clicks to set `cx-manual-logout`.

#### Theme scripts (`src/theme/`, manifest order)
- **`theme-auth.js`** (`ConnectifyThemeAuth`): login/logout URL detection, `markAuthPage()`, and `rememberThemeForLogin()` / `forgetThemeForLogin()` / `takeThemeToRestore()` for restoring the dark theme after sign-in.
- **`theme-custom-tokens.js`** (`ConnectifyThemeTokens`): custom tokens (incl. `--cx-card-bg`, `--cx-nav-bg`) written inline on `<html>` and `<body>`, cleared before each apply; wallpaper stored in `localStorage` with a `chrome.storage.local` fallback for over-quota images (restored on load); glass toggle.
- **`theme-palettes.js`** (`ConnectifyThemePalettes`): the 7 preset palettes (Dark, Quantum Dark, AMOLED, Midnight, Forest, Twilight Plum, Liquid Glass).
- **`theme-registry.js`** (`ConnectifyThemeRegistry`): registry, `getTheme()`/`setTheme()`/`getLastTheme()`; `setTheme()` stamps classes and `data-connectea-theme` on `<html>` and `<body>` and fires `connectea:themechange`.
- **`theme-custom-themes.js`**: saved custom themes (`getCustomThemes`, `saveCustomTheme` overwrites by case-insensitive name, `deleteCustomTheme` removes from both stores; saves are stamped `tokenVersion: 2`, and older themes drop the six tokens the 14-token Full mode could not edit so they are re-derived instead of keeping preset leftovers); re-applies a theme only found in extension storage.
- **`theme-oklch.js`** (`ConnectifyThemeOklch`): hex <-> OKLCH, `shiftL` (lightness step keeping hue and chroma/lightness ratio, gamut clamped), WCAG `contrast`, `ensureContrast`, `readable`.
- **`theme-token-derive.js`** (`ConnectifyThemeDerive`): fitted to the presets. `deriveFull()` maps the 6 Basic tokens to the 20 Full ones (e.g. surfaceHover = surface +11 L, borderSubtle = border -10.5, inputBg = canvas +1.5 towards the surface, textMuted = text -26 in the surface hue); `complete()` fills only missing ones; `cssProps()` derives every rarer `--cx-*` from the Full tokens (nav, table, badge, scrollbar, focus, primary button darkened until white text reaches 5:1). Applied by `applyCustomTokens` and the customizer preview.
- **`theme-glass-tokens.js`** (`ConnectifyThemeGlassTokens`): `props(c, opacity)` turns a custom theme with Liquid Glass on into a recoloured Liquid Glass theme (fills = its surface/canvas at the Transparency opacity scaled like the preset; overlays = its text colour at the preset's strengths; glass shadows). Default blur 12px.
- **Customizer** (`ConnectifyThemeCustomizer`): `theme-color-utils.js` (colour parsing, escaping, `pickColors`), `theme-customizer-markup.js` (escaped modal HTML, Basic 6 / Full 20 tokens, preview elements tagged `data-cx-fill` / `data-cx-text`; `#cx-preview-tooltip` names the text token when the pointer is over glyphs), `theme-customizer-controls.js` (picker, wallpaper, sanitised JSON import/export, blur 0–40px and transparency 10–100% sliders), `theme-customizer.js` (state, open/save via `registry.setTheme()`).
- **Engine**: `theme-surface-adapter.js` tags unstyled light surfaces (`data-connectea-surface`/`-ink`); `theme-toggle.js` mounts `#connectea-theme-toggle`; `theme-menu.js` renders `#connectea-theme-menu` (custom themes get Edit ✎, which reopens the customizer on that theme and saves in place by id, and Delete ✕; styles in `theme-menu-actions.css`); `theme.js` (`ConnectifyTheme`) applies themes on `connectea:themechange`, disables them on login/logout and restores after sign-in.

#### [`auto-login.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/auto-login.js)
- **Role**: Auto-submits login credentials on `https://login.det.wa.edu.au/*` while respecting session expiry and manual logout.
- **Key Functions**:
  - Injects "Auto-login" toggle checkbox next to the login button.
  - Detects session timeout URLs and inactivity messages; pauses auto-login and displays warning notice `(Paused: session expired)`.
  - Prevents rapid looping via a 30-second loop guard.
  - Fires only for a saved password / browser autofill (`:autofill`, `:-webkit-autofill`, or prefilled values); typing or pasting in a credential field disables it for that page.

---

### Style Sheets & Extension Configuration

#### Style Sheets
- **`src/progress/progress.css`, `compound-progress.css`**: progress graph modal; compound subject bars.
- **`src/atar/atar.css`, `atar-compact.css`, `atar-planner.css`** (in that order): calculator modal (`#connectea-atar`) base and dark mode; subject select, grade table and compact layout; planner controls, top-four selector and Back to top button.
- **[`progress.css`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/progress.css)**: Progress graph modal layout and SVG stroke/fill rules.
- **`src/sidebar/styles/`**: drawer, handle/menu, tool menu, weakness/types, outcome meter/filter, notifications, predictor and settings/progress-pill stylesheets (readable, one concern per file).
- **`src/theme/styles/`**: the theme cascade, one concern per file (<= 250 lines), loaded in manifest order: tokens and palettes (`theme-tokens.css`, `theme-surface-base.css`, `theme-component-base.css`), core and navigation, tiles, cards and task rows, controls and buttons, icon buttons, dialog surface, material, feed, tables and dialogs, navigation and discussions, surfaces and display scaling, customizer, `theme-glass-panels.css` (Liquid Glass curvature for the notice card host, Library table wrapper and paginator bars), `theme-empty-states.css` and `theme-control-bars.css` (all themes: centred empty states, paginator/checkbox-row surfaces), `theme-glass-surface.css` and `theme-glass-class-pages.css` (shared glass recipe and Class page rules: banner, Page N of M, category bars, headings, empty states, Learners table, Summary tiles/calendar), and finally `theme.css` (Liquid Glass-only geometry, opaque solid-theme panels, glass-only outline pass-through). Every selector is scoped to a theme hook (Test 153).

#### Manifest & Update Manifests
- **[`manifest.json`](file:///Users/uwong/Downloads/2.1.14_0/manifest.json)**: Extension manifest (Manifest V3) declaring permissions (`storage`), browser settings for Firefox Gecko, modular stylesheets, content scripts in dependency order, and matched URL patterns.
- **[`updates.json`](file:///Users/uwong/Downloads/2.1.14_0/updates.json)**: Self-hosted extension update manifest.
- **[`updates.xml`](file:///Users/uwong/Downloads/2.1.14_0/updates.xml)**: Gecko / Firefox update manifest.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
