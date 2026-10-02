# Connectify System & Styling Modules Reference

This document covers notifications, grade change tracking, DOM integrity monitoring, navigation injection, dark theme surface adaptation, auto-login, stylesheets, and extension manifests.

---

## 2. Module Reference: System, Theme & Styles

### System Health, Navigation & Theme

#### [`notifications.js`](file:///Users/uwong/Downloads/2.1.14_0/notifications.js) (204 lines)
- **Role**: Universal notification and toast manager for Connectify.
- **Key Functions**:
  - `show({ id, type, title, message, details, actions, duration, dismissible, onDismiss })`: Mounts toast notifications into `#connectify-notifications-container`.
  - Supports types (`warning`, `success`, `info`, `grade`) with tailored theme colors, icons, and smooth slide-in/dismiss animations.
  - Automatically stacks concurrent notifications vertically (`flex-direction: column-reverse`).
  - Action button dispatcher supporting custom callbacks with `{ id, element, close }`.
  - `dismiss(id)` and `clearAll()`: Smoothly animates out and cleans up DOM elements.
- **Export**: `window.ConnectifyNotifications`.

#### [`new-grade.js`](file:///Users/uwong/Downloads/2.1.14_0/new-grade.js) (320 lines)
- **Role**: Grade change detection engine tracking running subject averages against persistent local cache.
- **Key Functions**:
  - `checkGrades()`: Scrapes running subject marks on DOM load, groups cards by subject name with Semester 2 precedence whenever Semester 2 scores exist, and compares them against `localStorage` (`connectify:grade_cache:<student>`).
  - Empty cache handling: Quietly seeds the cache for first-time users without triggering a barrage of notifications.
  - Upon grade delta detection ($\ge 0.05\%$):
    1. Ignores auto-expand / collapse preferences to ensure **THAT SUBJECT ONLY** is definitely expanded, scraping and updating its task results into the results cache.
    2. If auto-expand is off, collapses that subject card again after scraping.
    3. Emits a stacked toast notification displaying updated running average with signed difference percentage (e.g., `+1.8%`).
    4. Provides an interactive "Jump to Subject" action button that expands the card (if collapsed), smoothly scrolls to the course card (prioritizing Semester 2), and triggers an outline glow pulse (`.cx-card-jump-highlight`).
  - Updates the running averages cache 1 second after page load/evaluation.
- **Export**: `window.ConnectifyNewGrade`.

#### [`dom-sweeper.js`](file:///Users/uwong/Downloads/2.1.14_0/dom-sweeper.js) (195 lines)
- **Role**: Health monitor that sweeps the DOM for injected Connectify components.
- **Key Functions**:
  - `inspectDOM()`: Sweeps for sidebar, toggle handle, data bridge, and assessment row panels. Properly ignores unmarked/incomplete tasks which intentionally do not render statistics panels, and omits the WACE countdown banner from missing component notices.
  - `promptUser(missingItems)`: Dispatches warning notice via `window.ConnectifyNotifications.show()`.
  - `restoreComponents()`: Auto-triggers reinjection across `ConnectifyInitSidebar`, `ConnectifyCohort.pass()`, `ConnectifyCountdown.update()`, and `ConnectifyCompoundProgress.update()`.
- **Export**: `window.ConnectifyDomSweeper`.

#### [`navigation.js`](file:///Users/uwong/Downloads/2.1.14_0/navigation.js) (139 lines)
- **Role**: Injects direct "Assessment Outlines" shortcut into Connect navigation bar, tracks user activity, and detects session timeouts.
- **Key Functions**:
  - Injects link into desktop greedy navigation and mobile drawer.
  - Tracks user activity (`mousemove`, `keydown`, `scroll`) to update `window.__connectifyLastActive` and provide `window.ConnectifyIsUserActive()`.
  - Monitors session expiry modals and unloads while idle (> 5 min) to set `cx-session-expired`.
  - Intercepts manual logout clicks to set `cx-manual-logout`.

#### [`theme.js`](file:///Users/uwong/Downloads/2.1.14_0/theme.js) (278 lines)
- **Role**: Instant, zero-flicker site-wide dark mode engine for Connect with dynamic surface contrast adaptation.
- **Key Functions**:
  - Injects high-contrast toggle button (`#connectea-theme-toggle`) into primary navigation header.
  - Positioning & deduplication: `cleanupDuplicateButtons()` purges duplicate toggle buttons. Uses multi-variant notification bell detection with avatar fallback to position toggle neatly to the left of the bell.
  - Instantly toggles `.connectea-dark` on `document.documentElement` without DOM traversal or layout thrashing.
  - `adaptSurfaces()`: Safely identifies unstyled neutral surfaces and dark colored text (e.g. red/purple `#7f375c`) across My Connect, Classes, and Preferences pages, tagging them with `data-connectea-surface` and `data-connectea-ink` without inline style mutations or observer feedback loops.
  - Efficient debounced `MutationObserver` ensures button persistence across client-side SPA route navigations.
  - Automatically toggles off dark mode on `https://connect.det.wa.edu.au/login` to prevent broken styles on the login selector card.
  - Enhances accordion header arrows (`▴` / `▾`).

#### [`auto-login.js`](file:///Users/uwong/Downloads/2.1.14_0/auto-login.js) (155 lines)
- **Role**: Auto-submits login credentials on `https://login.det.wa.edu.au/*` while respecting session expiry and manual logout.
- **Key Functions**:
  - Injects "Auto-login" toggle checkbox next to the login button.
  - Detects session timeout URLs and inactivity messages; pauses auto-login and displays warning notice `(Paused: session expired)`.
  - Prevents rapid looping via a 30-second loop guard.

---

### Style Sheets & Extension Configuration

#### Style Sheets
- **[`atar.css`](file:///Users/uwong/Downloads/2.1.14_0/atar.css)** (67 lines): Styling for calculator modal (`#connectea-atar`), target planning forms, course tables, and dark theme variants.
- **[`progress.css`](file:///Users/uwong/Downloads/2.1.14_0/progress.css)** (4 lines): Progress graph modal layout and SVG stroke/fill rules.
- **[`sidebar.css`](file:///Users/uwong/Downloads/2.1.14_0/sidebar.css)** (971 lines): Slide-out drawer layout, toggle handle, navigation buttons, Predictor panel styles, scenario cards (with dedicated high-contrast Middle/Expected `#ffffff` and High `#4ade80` states $\ge 5:1$), Settings & Baselines form styles, Weakness Analyzer mode labels, Outcome Meter segments with `pointer-events: none !important;` to eliminate hover boundary thrashing, instant singleton floating tooltip (`#connectea-outcome-tooltip`), and universal dark mode contrast enforcement rules.
- **[`theme.css`](file:///Users/uwong/Downloads/2.1.14_0/theme.css)**: High-fidelity site-wide dark mode stylesheet preserving color difference, hierarchy, and surface borders (canvas `#12171f`, subject tile `#1e2632`, cohort `#15263a`, marks `#161e29`, accordion `#222b39`). Features card/tile header normalization to `#2e3c4e`, Angular Material class page (`.eds.cvr.ngm`) red outline and primary text contrast normalization (`#3d5066` and `#f1f5f9`), 1:1 typography bolding parity for task titles (`.cvr-c-task__details .v-label:first-child`, `.cvr-c-task__title`) and stats boxes, Reports year selector header bars (`#1e2632`), dark "View All" tile actions (`#24303f`), high-contrast role switch icons (`#cbd5e1`), horizontal navbar active tab indicators (`border-bottom: 2px solid #3b82f6`), and custom styled form controls: high-contrast checkboxes (`appearance: none`, SVG checkmark), custom dropdowns (`select` with SVG chevron, dark `<option>`), and polished button hierarchy ($\ge 5:1$ contrast).

#### Manifest & Update Manifests
- **[`manifest.json`](file:///Users/uwong/Downloads/2.1.14_0/manifest.json)** (107 lines): Extension manifest (Manifest V3) declaring permissions (`storage`), browser settings for Firefox Gecko, content scripts, and matched URL patterns.
- **[`updates.json`](file:///Users/uwong/Downloads/2.1.14_0/updates.json)** (12 lines): Self-hosted extension update manifest.
- **[`updates.xml`](file:///Users/uwong/Downloads/2.1.14_0/updates.xml)** (6 lines): Gecko / Firefox update manifest.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
