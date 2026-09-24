# Connectify 3.1.14 - Making Study Rewarding with Data Visualization

### Thanks to Yanxi Li, Arya Byndoor, Hiruja Basnayaka, Lodinu Kalugalge, Oscar Ingram, Gemini 3.8 Flash, GPT-5.5, and Amrut Deshpande for making this extension possible. Thank you for all who crowdfunded our launch to the Chrome Web Store.

**Connectify** is the ultimate unofficial extension for Western Australia's Department of Education Connect portal. Built for ATAR students, it instantly upgrades the default Connect interface with powerful, real-time analytics to help you track your progress, identify weaknesses, and predict your final ATAR.

---

## Installation instructions
1. Click on the latest release.
2. Download the file that corresponds to your browser, .xpi for Firefox (and forks) and .zip for everything else (except Safari).
3. Drag the file from your downloads to the browser's extension tab.
4. Confirm everything.
5. Enjoy your new academic performance!

## 🌟 What's New in Version 3?

Version 3 is a massive ground-up rebuild. We've stripped out all hardcoded, school-specific data so Connectify now works universally for **every high school in WA**, while injecting an entirely new suite of ATAR tracking features directly into your LMS. Now updates automatically and quickly! 
*(NOTE: Because of anti-competitive Google policies (Google reviews), the Chrome Web Store version will only update every major version (e.g. 3.1.0 -> 3.2.0, skipping 3.1.1 - 3.1.14). If you want the latest release, you will have to download the .zip file and load it unpacked straight onto your browser. Note that an extension installed this way will not have auto-update functionality, as Chrome and Chromium blocks all auto-updates not from the Chrome Web Store. Install Firefox if you want to have nice things.)*

### 📈 Powerful Analytics & Predictions
- **Live ATAR Predictor**: Automatically scrapes your unscaled school marks, applies historical TISC scaling algorithms, and predicts your final ATAR. It even dynamically detects if you're in Year 11 or Year 12, applying a mathematical penalty to Year 11 unscaled marks for a more realistic projection. Also allows you to input your known Semester 1 scaled marks and shifting the interpolation to align with official data.
- **Dynamic Cohort & Rank Estimator**: Instantly estimates your exact rank and percentile within your cohort (e.g. `Top 4.2%`) using an advanced polynomial spline applied to Connect's published boxplot data. 
- **Target Grade Planner**: Input your dream ATAR, and Connectify will reverse-engineer exactly what percentage you need to score on every remaining assessment to achieve it.
- **Estimated Grade**: Connectify can predict your future assessment grades based on data about not only that subject, but also how well you did on assessments like that in the past.

### 📊 Beautiful Visualizations
- **Weakness Analyzer Radar Chart**: A brand new interactive tool that categorizes every assessment you've taken (Exams, Tests, Essays, Take-Home) and plots your performance on a sleek radar chart, instantly revealing your study weaknesses.
- **Compound Progress Bars**: Every subject card now features a vibrant, color-coded progress bar that breaks down your syllabus weighting (e.g. 50% Test, 30% Exam). It dynamically lowers the opacity of assessments you haven't completed yet, doubling as a **Weighting Tracker** so you know exactly how much of the year is left.
- **WACE Exam Countdown**: A beautifully integrated countdown widget that tracks exactly how many days are left until the WACE exams for Year 12 students.
- **Adaptive Progress Timelines**: Custom SVG line graphs that track your ATAR trajectory over the year, dynamically scaling the y-axis to match your specific performance range for maximum detail.

### 🎨 Total UI Overhaul
- **Stunning Dark Mode**: A completely redesigned, elegant dark theme that instantly applies across the entire Connect portal, dramatically improving contrast and readability.
- **Blazingly Fast**: Completely rewritten to be modular, efficient, and deeply integrated into Connect's native rendering engine, ensuring UI widgets instantly sync without lag.

### ⚡ Seamless SSO Auto-Login
- **Instant Authentication**: Automatically detects when you are redirected to the Department of Education Single Sign-On portal, reads your natively saved credentials, checks the terms box, and submits the login form in a fraction of a millisecond. It seamlessly bypasses manual logouts.

---
*For legacy release notes prior to 3.0.0, see [2.0.0_changelog.md](2.0.0_changelog.md).*
