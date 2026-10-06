---
trigger: always_on
---

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
  - Upon grade delta detection ($\ge 0.05\%$):
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

#### [`theme.js`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme.js)
- **Role**: Instant, zero-flicker site-wide dark mode engine for Connect with dynamic surface contrast adaptation.
- **Key Functions**:
  - Injects high-contrast toggle button (`#connectea-theme-toggle`) into primary navigation header.
  - Positioning & deduplication: `cleanupDuplicateButtons()` purges duplicate toggle buttons. Uses multi-variant notification bell detection with avatar fallback to position toggle neatly to the left of the bell.
  - Instantly toggles `.connectea-dark` on `document.documentElement` without DOM traversal or layout thrashing.
  - `adaptSurfaces()`: Safely identifies unstyled neutral surfaces and dark colored text (e.g. red/purple `#7f375c`) across My Connect, Classes, and Preferences pages, tagging them with `data-connectea-surface` and `data-connectea-ink` without inline style mutations or observer feedback loops.
  - Efficient debounced `MutationObserver` ensures button persistence across client-side SPA route navigations.
  - Automatically toggles off dark mode on `https://connect.det.wa.edu.au/login` to prevent broken styles on the login selector card, and automatically toggles it back on upon successful login.
  - Enhances accordion header arrows (`▴` / `▾`).

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
- **[`sidebar.css`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar.css)** & Submodules: Modular stylesheet bundle comprising:
  - [`sidebar-drawer.css`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar-drawer.css): Drawer layout, toggle handle, and slide transitions.
  - [`sidebar-notifications.css`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar-notifications.css): Vertical stacked notification container and toasts.
  - [`sidebar-predictor.css`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar-predictor.css): Predictor layout, scenario cards (Mid `#ffffff`, High `#4ade80`), and outcome meter tooltip.
  - [`sidebar-settings.css`](file:///Users/uwong/Downloads/2.1.14_0/src/sidebar/sidebar-settings.css): Settings, baseline forms, and Weakness Analyzer labels.
- **[`theme.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme.css)** & Submodules: Site-wide dark mode modular stylesheet bundle comprising:
  - [`theme-core.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-core.css): Global variables, canvas (`#12171f`), text, and base layout.
  - [`theme-tiles.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-tiles.css): Subject tiles (`#1e2632`), card headers (`#2e3c4e`), and accordions (`#222b39`).
  - [`theme-cards.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-cards.css): Assessment task cards, summary marks box (`#161e29`), and detail rows.
  - [`theme-controls.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-controls.css): High-contrast buttons ($\ge 5:1$), custom checkboxes, and dropdowns.
  - [`theme-material.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-material.css): Angular Material class page (`.eds.cvr.ngm`) contrast normalization.
  - [`theme-feed.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-feed.css): Notices, feeds, discussion forums, and stream posts.
  - [`theme-tables.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-tables.css): Grade tables, attendance lists, and report summary tables.
  - [`theme-navigation.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-navigation.css): Top navigation, active tabs (`#3b82f6`), breadcrumbs, and menus.
  - [`theme-surfaces.css`](file:///Users/uwong/Downloads/2.1.14_0/src/theme/theme-surfaces.css): Dynamic surface contrast adapters and modal dialogs.

#### Manifest & Update Manifests
- **[`manifest.json`](file:///Users/uwong/Downloads/2.1.14_0/manifest.json)**: Extension manifest (Manifest V3) declaring permissions (`storage`), browser settings for Firefox Gecko, modular stylesheets, content scripts in dependency order, and matched URL patterns.
- **[`updates.json`](file:///Users/uwong/Downloads/2.1.14_0/updates.json)**: Self-hosted extension update manifest.
- **[`updates.xml`](file:///Users/uwong/Downloads/2.1.14_0/updates.xml)**: Gecko / Firefox update manifest.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
