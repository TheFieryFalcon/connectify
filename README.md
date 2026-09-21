# Connext 3.0.1

Connext enhances Western Australia's Department of Education Connect portal with local assessment analytics, dynamic progress graphs, ATAR and target grade planning, and a site-wide dark theme.

For legacy version release notes prior to 3.0.0, see [2.0.0_changelog.md](2.0.0_changelog.md).

---

## Additions

- **Dynamic ATAR Progress Graph Scaling**:
  - The ATAR progression graph y-axis dynamically scales based on the student's 2nd lowest estimated ATAR (floored to multiples of 5).
  - Adaptive grid intervals (5, 10, or 25) automatically adjust to the data range to provide high-resolution trajectory visibility rather than a static 0–100 scale.
- **Dynamic Cohort Size Estimation**:
  - Automatically estimates subject cohort sizes across all secondary school courses (STEM, Humanities, Languages, and General/Essentials) and refines estimates from Highcharts boxplot distributions when available.
  - Employs normal order-statistics ratios (sample range to interquartile range with upper/lower semi-quartile spread damping) across all outline tasks to mitigate outliers.
- **Persistent Manual Cohort Override**:
  - Subject cohort size input is now always accessible on overall subject cards.
  - User entries persist across semesters 1 and 2 and take priority over estimated sizes; clearing the input seamlessly falls back to the dynamic estimate.
- **PCHIP Monotone Spline Cohort Place Estimation**:
  - Replaced coarse step estimation with a Monotone Piecewise Cubic Hermite Interpolating Polynomial (PCHIP) spline across the five published quantiles.
  - Zero-slope boundary tails prevent overshoot and accurately reflect score density at distribution extremes.
- **Automated Multi-Browser CI/CD Workflows**:
  - `.github/workflows/publish.yml`: Automates packaging and publishing Firefox `.xpi` builds on every push and release tag.
  - `.github/workflows/publish-chrome.yml`: Automates Chromium/Chrome Web Store packaging into `.zip`, dynamically tailoring the manifest for Chrome compatibility.

---

## Removals

- **Hardcoded Cohort Presets**:
  - Removed all hardcoded school-specific cohort lookup tables (e.g. Willetton Senior High School subject lists).
- **Hardcoded Assessment Overrides**:
  - Removed school-specific task date adjustments and caption corrections (e.g. Year 11 Physics outline corrections).
- **Hardcoded Economics Calculator**:
  - Removed the Willetton Year 11 Economics average calculator button, custom outline calculations, and dedicated sidebar section.
- **Legacy Minified Source Files**:
  - Removed outdated monolithic files (`thing.js`, `atar.js`, `progress.js`, `data.js`) in favour of modular source components.

---

## Fixes

- **Dynamic Cohort Estimator Resilience**:
  - Resolved an issue where initial page loads with collapsed assessment accordions prevented Highcharts detection, causing cohort size and rank to evaluate to unavailable.
  - Integrated course-level categorization with empirical boxplot spread refinement, ensuring ranks and cohort estimates appear immediately upon page load without panel recreation or input flickering.
- **Cohort Standing Precision & Typos**:
  - Standing percentages now display with decimal precision (e.g. `top 0.4%`, `< 0.1%`), eliminating inaccurate `"top 0%"` readouts.
  - Fixed grammatical spelling error (`"You scored"` instead of `"Your scored"`).
- **Cohort Input Accessibility**:
  - Fixed an issue where preset school cohort sizes hid the subject input field, preventing students from specifying their own cohort count.
- **SVG Marker Boundary Clamping**:
  - Clamped all progress graph data points and marker coordinates to canvas boundaries `[40, 260]` to eliminate rendering overflows.

---

## Changes

- **Codebase Modularisation & Readability Refactor**:
  - Reorganized and unminified all scripts into modular, clearly named files:
    - `assessment-data.js` — Outline DOM scraping and task data extraction.
    - `cohort-stats.js` — Boxplot statistical processing, PCHIP spline, and dynamic cohort estimation.
    - `atar-calculator.js` — Scaled score modelling, ATAR estimation, and target grade calculations.
    - `progress-graph.js` — Dynamic SVG progress charts and ATAR timeline graphs.
    - `sidebar.js`, `theme.js`, and `navigation.js` — UI shell, dark mode theme management, and site navigation.
  - Fully annotated functions and classes with descriptive JSDoc documentation.
- **Uniform Course Evaluation**:
  - All courses and tasks are evaluated uniformly and dynamically based on live Connect data without school or subject biases.
- **Version Bump**:
  - Updated extension manifest version to `3.0.1`.
