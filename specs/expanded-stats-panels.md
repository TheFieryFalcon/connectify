# Spec: Expanded Statistics & Prediction Panels

Status: implemented (2026-10-22). Default **off**.

## 1. Summary
A Settings option that renders the assessment outlines' statistics and prediction panels as multi-row cards (labelled headline values, a quantile row and a footer) instead of today's one-line summaries. Reference: a card with *Score / Rank / Average* headline values, a *Minimum / Lower Quartile / Median / Upper Quartile / Maximum* row and an *SD · Z-Score · standing* footer.

## 2. Setting
- **Control**: a `<select class="cx-settings-select" id="cx-panel-view-select">` labelled **Statistics Panels** in General Preferences (Settings), beside Color Theme, with three options:
  | Value | Label | Overall subject rows (+ class prediction) | Task rows (marked + unmarked) |
  |---|---|---|---|
  | `compact` (default) | Compact view | compact (today) | compact (today) |
  | `subjects` | Expanded view on subject panels only | expanded, prediction merged in | compact |
  | `all` | Expanded view on all panels | expanded, prediction merged in | expanded |
- Description line (`.cx-settings-desc`): "Shows statistics as larger cards. Takes effect after reload."
- **Storage**: `connectify:panel_view` in `localStorage` (`'compact' | 'subjects' | 'all'`); missing or unknown values read as `compact` (choosing Compact removes the key). It is a preference like `connectify:auto_expand`: the Clear Cache button keeps it, and only a settings reset (`clearSettingsCache`) removes it.
- **Apply on next page load only**: the mode is read once when the outlines scripts load. Changing it writes storage and shows the hint; no live re-render, no `connectify-settings-updated` dispatch, no memo field.

## 3. Card layouts
All cards keep the `.connectea-panel` element (dom-sweeper, Test 185 and existing theme rules find it) and add `.connectea-panel--expanded`. Inner markup uses `<dl>` grids (`<div><dt>label</dt><dd>value</dd></div>`); never the `.v-label` class, so `getTaskMeta` never reads card labels as task labels. Labels are 400 weight in secondary ink; values 700 (bolding parity in light and dark).

### 3.1 Marked assessment row (`all` only)
```
┌───────────────────────────────────────────────────────────┐
│ Score        Rank          Average                   ▐ ▌ │  ← outcome meter (18×56) top-right
│ 96.7%        1 / ~219      67.84%                    ▐ ▌ │
│ Minimum   Lower Quartile   Median   Upper Quartile   Maximum │
│ 32.5%     58%              68.85%   79.9%            96.7%   │
│ SD 16.5 · Z-Score 1.75 · Top 5%              Type: [Auto (Exam) ▾] │
└───────────────────────────────────────────────────────────┘
```
- Header: **Score** (`formatPercentage(mark)%`, tinted, §4), **Rank** (`rank / total`, `~` before an estimated total; `Top of assessment` text for rank 1 as today), **Average** (`data.mean`). Outcome meter sits in the header's right column, unchanged in size and behaviour.
- Quantile row: the five boxplot values. **No highlighted cell.**
- Footer: `SD x · Z-Score y · <standing()>` (existing `math().standing` wording, e.g. "Top of cohort", "Top 5%"); the `Type:` dropdown right-aligned in the footer, under the meter.
- The card replaces the compact panel inside `.connectea-row-wrapper`; the wrapper's Type container and meter move into the card (same elements, same listeners).

### 3.2 Overall subject row (`subjects` and `all`)
```
│ Score        Rank               Average   │
│ 81.2%        12 / ~219          67.84%    │
│              Cohort Size [~219]           │
│              Original Estimate ~219 • Saved.│
│ Minimum   Lower Quartile   Median   Upper Quartile   Maximum │
│ SD 16.5 · Z-Score 0.81 · Top 20%          │
├────────────────── hairline ────────────────┤
│ Predicted class result                    │
│ Low 78.4%      Mid 81.0%      High 83.9%  │
```
- No outcome meter (as today). Rank reads `Top of subject` for rank 1.
- **Cohort Size input and its notice sit directly under the Rank value** (same input element, listeners, `noticeText` wording and small-cohort warning).
- **Merged class prediction**: below a hairline divider (`--cx-border-subtle`), "Predicted class result" with three hero cells Low / Mid / High (1 decimal, Predictor colours via existing `.connectea-forecast-value--low|mid|high`, Mid 700, Low/High 600), or the `ConnectifyCohortUpcoming.NEEDS` text. The section is omitted once the class shows a final A–E letter. In expanded modes no separate `.connectea-upcoming` line is created.

### 3.3 Unmarked task row — forecast (`all` only)
```
│ Low 71%            Mid 78%            High 84%   │
│ From your 3 earlier Exam results   Type: [Auto (Exam) ▾] │
```
- Three hero cells in Predictor colours (rounded integers as today); breakout threshold never shown; no meter.
- Footer: basis text (§5) left, Type dropdown right.
- Unpredicted: the `ConnectifyCohortForecast.NEEDS` text in place of the cells; footer keeps the Type dropdown.

### 3.4 Missing data (marked rows, overall rows)
Keep the full skeleton (stable row height); unavailable values render `—`:
- No boxplot: Average and all quantiles `—`; footer reads "Cohort statistics unavailable"; Score still shown.
- No cohort size: Rank `—`; footer appends "Cohort size needed".

## 4. Score colour ("brighter = better")
Only the **Score** value is tinted; everything else uses theme ink.
- **Position** `t = clamp((score − Low) / (High − Low), 0, 1)`:
  - Task rows: Low/High of the row's prediction (the same one the outcome meter uses). `evaluateOutcome` returns `low` and `high` alongside its current fields.
  - Overall rows: the running mark against `ConnectifyCohortUpcoming.projection()` Low/High.
  - No comparison (meter suppressed: first marked task without a baseline, no prediction; overall row with a final letter or no projection): `t = 0.5`, no glow.
- **Quantised steps, no inline styles**: `t` is rounded to 11 steps and written as `data-cx-score-step="0".."10"` (Dynamic Surface Adaptation forbids inline style mutations); CSS maps each step.
- **Base ink** = the theme accent at >= 5:1: dark themes `color-mix(in srgb, var(--cx-accent-hover, #93c5fd) 60%, var(--cx-text-primary, #ffffff))` (the Predictor Mid ink); Light `var(--cx-accent-link, #1d4ed8)`; light tone `oklch(from var(--cx-accent) 0.34 c h)`.
- **Dark themes**: higher steps are lighter and more saturated: `oklch(from <base> calc(l * (0.86 + 0.14·t)) calc(c * (0.45 + 0.55·t)) h)`.
- **Light theme and light tone (inverted)**: higher steps are darker and more saturated (lightness falls, chroma rises), so contrast only increases.
- **Floor**: step 0 must still be >= 5:1 on the panel in every preset (verified by the theme audit).
- **Breakout** (task rows only; `outcome.broken`): `data-cx-score-step="breakout"` — substantially brighter than step 10 (dark: extra lightness and full chroma; light: darkest, full chroma) plus a **static pastel purple glow** (`text-shadow` in `#c4b5fd` / `#a78bfa`, no animation). Overall rows never glow.
- Browsers without relative colour syntax fall back to the base ink (glow kept).
- **Explanation**: the outcome meter's singleton tooltip (`#connectea-outcome-tooltip`) gains one line in expanded modes: "The Score colour grows more vivid the further your result sits above your predicted range." ("vivid", not "brightens": light themes go darker). It never mentions the glow, purple or any threshold. No `title` attributes.

## 5. Prediction basis (engine change)
- `predictTask` adds `basis: { source, count }` to predicted results:
  - `type-history` — `completedTypeCount > 0` (`count` = completed tasks of the type) → "From your 3 earlier Exam results" ("From your earlier Exam result" when 1; no pluralising of custom type names).
  - `type-baseline` — previous-year type baseline used → "From your previous-year Exam average".
  - `subject-history` — type average fell back to this year's subject average → "From your results in this subject".
  - `subject-baseline` — fell back to the previous-year subject baseline → "From your previous-year subject result".
- Type names come from `prediction.type`, written with `textContent` (never parsed as HTML).
- Bump `PREDICTOR` in `cache-versions.js` (data model change) so cached predictions gain `basis`. A prediction without `basis` shows "Predicted from your <Type> results".

## 6. Theming, geometry, scaling
- **Surface**: identical to today's `.connectea-panel` in every theme (navy `#15263a` in solid dark, Light card, 7% text tint strip in Liquid Glass via `theme-glass-task-rows.css`). Inside the card everything is clear: no sub-boxes, pills or highlighted cells (one surface per block); rows separated by hairlines only.
- **Typography** (before zoom): labels 11px, headline values 20px, quantile values 14px, footer 12px. All text >= 5:1 (Score steps included).
- **Scaling**: keeps the `--cx-display-scale` zoom ladder (0.92 → 0.48) on `.connectea-row-wrapper` / the overall panel; the grid never reflows; `white-space: nowrap`.
- **Token-routed colours**: every colour is `var(--cx-…, <Dark literal>)`; only the glow purple and Predictor Low/Mid/High inks are literal (semantic).
- Selectors scoped to `.connectea-panel--expanded` (Connectify class); no `[class*=…]` ancestors (Test 219).

## 7. Architecture
New files (new feature, new files; each <= 250 lines):
- `src/cohort/cohort-panel-view.js` — `ConnectifyPanelView`: reads `connectify:panel_view` once; `mode()`, `expandsOverall()`, `expandsTasks()`. Manifest: after `cohort-row-readers.js`.
- `src/cohort/cohort-expanded.js` — `ConnectifyCohortExpanded`: builds the three card skeletons once per panel (`build(kind, ui)`), fills them by `setText`/`setHTML` only (`fillMarked`, `fillOverall`, `fillForecast`, `fillPrediction`), `scoreStep(score, low, high, broken)`. Manifest: after `cohort-panel-view.js`, before `cohort-panel.js`.
- `src/cohort/cohort-expanded.css` — layout, score steps, glow, light tone. Manifest CSS after `cohort-upcoming.css`.
- `src/predictor/settings-panel-view.js` — binds the Settings dropdown. Manifest: after `settings-semester-filter.js`.

Modified:
- `cohort-panel.js` — `createPanel` asks `ConnectifyPanelView` and builds the expanded skeleton (Type container and meter placed inside the card).
- `cohort-view.js` — `render` hands filled data to `ConnectifyCohortExpanded` when the row's kind is expanded; memo unchanged (mode is fixed per page load).
- `cohort-forecast.js` / `cohort-upcoming.js` — expanded branch fills the card / merged section instead of creating one-liners.
- `cohort-outcome.js` — tooltip line (§4); `predictor-math.js` `evaluateOutcome` returns `low`, `high`.
- `predictor-engine.js` (`basis`), `cache-versions.js` (PREDICTOR bump), `settings-markup.js` (dropdown), `manifest.json`.

Performance: skeletons are built once; repaints only touch text nodes and one data attribute; the memo fast path still skips unchanged rows; Expand All adds no extra passes.

## 8. Docs and rules to update
- `docs/modules_core.md` (cohort-view submodules), `docs/architecture.md` (load order), `docs/apis_and_storage.md` (`ConnectifyPanelView`, `ConnectifyCohortExpanded`, `connectify:panel_view`), `docs/features_navigation_ui.md` (Feature 8), `docs/modules_ui_analytics.md` (Settings).
- `design_rules.md`: the Statistics Panels option; Score colour scale; **text-shadow exception**: the breakout Score glow is the only text shadow (labels stay shadowless); the glow marks a breakout without disclosing the threshold, which stays secret.
- `CHANGELOG.md` entry.

## 9. Tests (`test_suite.js`)
- Mode parsing: missing/unknown → `compact`; each mode's `expandsOverall` / `expandsTasks`.
- Settings dropdown writes `connectify:panel_view`; Clear Cache keeps it, a settings reset clears it.
- Skeletons: marked card has Score/Rank/Average, five quantile labels (Minimum, Lower Quartile, Median, Upper Quartile, Maximum), footer with Type select; meter inside header; no `.v-label` inside cards; no highlighted cell.
- Overall card: cohort input under Rank; merged prediction present without a letter, absent with one; no `.connectea-upcoming` in expanded modes.
- Forecast card: three cells with Predictor classes, basis text per `basis.source`, NEEDS text when unpredicted.
- Missing data renders `—` and the compact wording.
- `scoreStep`: clamping, 11 steps, `0.5 → 5` when no comparison, `breakout` only for task rows with `broken`.
- `predictTask` `basis` for all four sources; PREDICTOR version changed.
- Tooltip line present in expanded modes and never contains "purple", "glow", "1.1" or "breakout".
- CSS: step 0 ink >= 5:1 on every preset's panel (light and dark); only `.connectea-panel--expanded` value selectors use `text-shadow`; Tests 153 / 167 / 219 still pass.
- Theme audit run with `connectify:panel_view = all`.

## 10. Out of scope
Per-row expand toggles; live switching without reload; quantile highlighting or position markers; raw marks (`X / Y`) under Score; glow on overall rows; a setting to disable the glow; layout reflow at narrow widths.
