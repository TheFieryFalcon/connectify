# Connectify System & Styling Modules Reference

This document covers notifications, grade change tracking, DOM integrity monitoring, navigation injection, dark theme surface adaptation, auto-login, stylesheets, and extension manifests.

---

## 2. Module Reference: System, Theme & Styles

### System Health, Navigation & Theme

#### [`notifications.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/notifications.js)
- **Role**: Universal notification and toast manager for Connectify.
- **Key Functions**:
  - `show({ id, type, title, message, details, actions, duration, dismissible, onDismiss })`: Mounts toast notifications into `#connectify-notifications-container`.
  - Supports types (`warning`, `success`, `info`, `grade`) with tailored theme colors, icons, and smooth slide-in/dismiss animations.
  - Automatically stacks concurrent notifications vertically (`flex-direction: column-reverse`).
  - Action button dispatcher supporting custom callbacks with `{ id, element, close }`.
  - `dismiss(id)` and `clearAll()`: Smoothly animates out and cleans up DOM elements.
- **Export**: `window.ConnectifyNotifications`.

#### [`new-grade.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/new-grade.js)
- **Role**: Grade change detection engine tracking running subject averages against persistent local cache.
- **Key Functions**:
  - `checkGrades()`: Scrapes running subject marks on DOM load, groups cards by subject name with Semester 2 precedence whenever Semester 2 scores exist, and compares them against `localStorage` (`connectify:grade_cache:<student>`).
  - Empty cache handling: Quietly seeds the cache for first-time users without triggering a barrage of notifications.
  - `hasSubjectChanged(prev, entry)`: the student's running mark moved $\ge 0.05\%$, or any boxplot quantile moved by more than `STATS_CHANGE_THRESHOLD` (1 point) — small shifts from other classes uploading results are ignored.
  - Upon a detected change:
    1. Ignores auto-expand / collapse preferences to ensure **THAT SUBJECT ONLY** is definitely expanded, scraping and updating its task results into the results cache.
    2. If auto-expand is off, collapses that subject card again after scraping.
    3. Emits a stacked toast notification with title "Class Updated" and message "[Subject name] scores have been updated."
    4. Provides an interactive "Jump to Subject" action button that expands the card (if collapsed), smoothly scrolls to the course card (prioritizing Semester 2), and triggers an outline glow pulse (`.cx-card-jump-highlight`).
  - Updates the running averages cache 1 second after page load/evaluation.
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
- **`theme-custom-themes.js`**: saved custom themes (`getCustomThemes`, `saveCustomTheme` overwrites by case-insensitive name, `deleteCustomTheme` removes from both stores); re-applies a theme only found in extension storage.
- **Customizer** (`ConnectifyThemeCustomizer`): `theme-color-utils.js` (colour maths, escaping, `pickColors`, Basic-mode derivation), `theme-customizer-markup.js` (escaped modal HTML, Basic 6 / Full 14 tokens, preview with `#cx-preview-tooltip`), `theme-customizer-controls.js` (picker, wallpaper, sanitised JSON import/export, blur 0–40px and transparency 10–100% sliders), `theme-customizer.js` (state, open/save via `registry.setTheme()`).
- **Engine**: `theme-surface-adapter.js` tags unstyled light surfaces (`data-connectea-surface`/`-ink`); `theme-toggle.js` mounts `#connectea-theme-toggle`; `theme-menu.js` renders `#connectea-theme-menu`; `theme.js` (`ConnectifyTheme`) applies themes on `connectea:themechange`, disables them on login/logout and restores after sign-in.

#### [`auto-login.js`](file:///Users/uwong/Downloads/2.1.14_0/src/system/auto-login.js)
- **Role**: Auto-submits login credentials on `https://login.det.wa.edu.au/*` while respecting session expiry and manual logout.
- **Key Functions**:
  - Injects "Auto-login" toggle checkbox next to the login button.
  - Detects session timeout URLs and inactivity messages; pauses auto-login and displays warning notice `(Paused: session expired)`.
  - Prevents rapid looping via a 30-second loop guard.

---

### Style Sheets & Extension Configuration

#### Style Sheets
- **[`atar.css`](file:///Users/uwong/Downloads/2.1.14_0/src/atar/atar.css)**: Styling for calculator modal (`#connectea-atar`), target planning forms, course tables, and dark theme variants.
- **[`progress.css`](file:///Users/uwong/Downloads/2.1.14_0/src/progress/progress.css)**: Progress graph modal layout and SVG stroke/fill rules.
- **`src/sidebar/styles/`**: drawer, handle/menu, tool menu, weakness/types, outcome meter/filter, notifications, predictor and settings/progress-pill stylesheets (readable, one concern per file).
- **`src/theme/styles/`**: the theme cascade, one concern per file (<= 250 lines), loaded in manifest order: tokens and palettes (`theme-tokens.css`, `theme-surface-base.css`, `theme-component-base.css`), core and navigation, tiles, cards and task rows, controls and buttons, material, feed, tables and dialogs, navigation and discussions, surfaces and display scaling, customizer, and finally `theme.css` (Liquid Glass-only geometry, opaque solid-theme panels, glass-only outline pass-through). Every selector is scoped to a theme hook (Test 153).

#### Manifest & Update Manifests
- **[`manifest.json`](file:///Users/uwong/Downloads/2.1.14_0/manifest.json)**: Extension manifest (Manifest V3) declaring permissions (`storage`), browser settings for Firefox Gecko, modular stylesheets, content scripts in dependency order, and matched URL patterns.
- **[`updates.json`](file:///Users/uwong/Downloads/2.1.14_0/updates.json)**: Self-hosted extension update manifest.
- **[`updates.xml`](file:///Users/uwong/Downloads/2.1.14_0/updates.xml)**: Gecko / Firefox update manifest.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
