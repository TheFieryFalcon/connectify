# Connext 3.1.1

**Connext** is the ultimate unofficial extension for Western Australia's Department of Education Connect portal. Built for ATAR students, it instantly upgrades the default Connect interface with powerful, real-time analytics to help you track your progress, identify weaknesses, and predict your final ATAR.

---

## 🌟 What's New in Version 3?

Version 3 is a massive ground-up rebuild. We've stripped out all hardcoded, school-specific data so Connext now works universally for **every high school in WA**, while injecting an entirely new suite of ATAR tracking features directly into your LMS.

### 📈 Powerful Analytics & Predictions
- **Live ATAR Predictor**: Automatically scrapes your unscaled school marks, applies historical TISC scaling algorithms, and predicts your final ATAR. It even dynamically detects if you're in Year 11 or Year 12, applying a mathematical penalty to Year 11 unscaled marks for a more realistic projection.
- **Dynamic Cohort & Rank Estimator**: Instantly estimates your exact rank and percentile within your cohort (e.g. `Top 4.2%`) using an advanced polynomial spline applied to Connect's published boxplot data. 
- **Target Grade Planner**: Input your dream ATAR, and Connext will reverse-engineer exactly what percentage you need to score on every remaining assessment to achieve it.

### 📊 Beautiful Visualizations
- **Weakness Analyzer Radar Chart**: A brand new interactive tool that categorizes every assessment you've taken (Exams, Tests, Essays, Take-Home) and plots your performance on a sleek radar chart, instantly revealing your study weaknesses.
- **Compound Progress Bars**: Every subject card now features a vibrant, color-coded progress bar that breaks down your syllabus weighting (e.g. 50% Test, 30% Exam). It dynamically lowers the opacity of assessments you haven't completed yet, doubling as a **Weighting Tracker** so you know exactly how much of the year is left.
- **WACE Exam Countdown**: A beautifully integrated countdown widget that tracks exactly how many days are left until the WACE exams for Year 12 students.
- **Adaptive Progress Timelines**: Custom SVG line graphs that track your ATAR trajectory over the year, dynamically scaling the y-axis to match your specific performance range for maximum detail.

### 🎨 Total UI Overhaul
- **Stunning Dark Mode**: A completely redesigned, elegant dark theme that instantly applies across the entire Connect portal, dramatically improving contrast and readability.
- **Blazingly Fast**: Completely rewritten to be modular, efficient, and deeply integrated into Connect's native rendering engine, ensuring UI widgets instantly sync without lag.

---
*For legacy release notes prior to 3.0.0, see [2.0.0_changelog.md](2.0.0_changelog.md).*
