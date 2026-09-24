# Chrome Web Store Listing — Connectify

> Last Updated: 2026-09-24  
> Version: 3.1.14

This document serves as the single source of truth for the Chrome Web Store Developer Dashboard listing, permissions justifications, reviewer testing instructions, and privacy disclosures for **Connectify**.

---

## 1. Store Listing Details

**Extension Name** [REQUIRED]
```
Connectify
```

**Short Description** [REQUIRED] (max 132 chars)
```
Subject progress graphs, assessment statistics, grade planning and a site-wide Connect theme.
```

**Detailed Description** [REQUIRED]
```
Connectify is an open-source student dashboard companion that enhances the Western Australia Department of Education Connect portal with rich visual data analytics, real-time ATAR calculations, and grade tracking.

KEY FEATURES:
• Visual Assessment Analytics: Transforms raw marks into clear Highcharts boxplot cohort distributions and interactive weakness radar charts.
• Real-Time Grade Prediction: Automatically projects final ATAR and TEA using official TISC scaling models with Year 11/12 calibration.
• Grade Change Notifications: Notifies you immediately when a teacher enters a new mark or subject average updates, with 1-click jump-to-subject navigation.
• Customizable Connect Theme: Modern, accessible dark and light themes tailored for study environments.
• Course Outline Enhancements: One-click expand/collapse tools and category filtering for syllabus navigation.

HOW TO USE:
1. Install Connectify.
2. Log into Connect (connect.det.wa.edu.au).
3. Navigate to Assessment Outlines.
4. Click the Connectify sidebar handle on the right edge to view your ATAR calculator, radar charts, and progress metrics.

PRIVACY & SECURITY:
Connectify operates 100% locally on your computer. Your marks, grades, and personal data never leave your browser and are never transmitted to any external server.
```

**Category** [REQUIRED]
```
Productivity (Secondary: Developer Tools or Accessibility)
```

**Single Purpose** [REQUIRED]
```
Enhances the Western Australia Department of Education Connect student portal with visual assessment graphs, local ATAR projections, and grade tracking.
```

**Primary Language** [REQUIRED]
```
English
```

---

## 2. Permissions Justifications (CWS Submission Form)

Google Web Store reviewers require an explicit, plain-English justification for every requested permission. Copy and paste these exact justifications into the Developer Dashboard:

| Permission / Host | Type | Justification for Reviewer |
| :--- | :--- | :--- |
| **`storage`** | `permissions` | Connectify uses `chrome.storage.local` exclusively to persist user interface preferences (such as dark mode selection, auto-expand preferences), user course inclusion toggles for ATAR calculations, and a local cache of running subject averages to detect grade updates on the Connect portal. All data is strictly kept on the user's local machine. |
| **`https://connect.det.wa.edu.au/*`** | `host_permissions` / `content_scripts` | Connectify injects client-side user interface components (progress graphs, cohort boxplot statistics, and the sidebar) directly into the student's Connect assessment outlines page. No background requests are made; scripts only run to render visual aids directly in the webpage DOM. |
| **`https://login.det.wa.edu.au/*`** | `host_permissions` / `content_scripts` | Connectify runs a client-side script on the official authentication page to preserve active student session state and provide seamless navigation back to assessment outlines without session drops. |

---

## 3. Reviewer Testing Instructions (Crucial for Fast Approval)

Because Connect is an authenticated school portal for Western Australia students, Google reviewers will not have personal student logins. **Providing clear reviewer notes prevents "Cannot Test / Need Login" review rejections.**

Copy this text into the **"Instructions for the reviewer"** box in the CWS Developer Dashboard:

```text
REVIEWER TESTING INSTRUCTIONS:

Connectify is a client-side enhancement suite designed specifically for Western Australia Department of Education high school students using the Connect learning portal (https://connect.det.wa.edu.au/).

1. PURPOSE & ARCHITECTURE:
- The extension runs purely client-side content scripts on https://connect.det.wa.edu.au/ and https://login.det.wa.edu.au/.
- It reads assessment table DOM nodes and calculates running averages, cohort distributions, and ATAR estimates locally.
- NO external network requests are made. NO remote code execution (eval/Function) is used.

2. VERIFICATION WITHOUT PORTAL CREDENTIALS:
- You can inspect all content scripts in the package: every script is plain, readable JavaScript (no minification/obfuscation).
- The permissions requested are strictly minimal: only 'storage' (for local UI toggles).
- Host matches are strictly limited to the official WA Department of Education domains (*.det.wa.edu.au), completely avoiding broad permissions like <all_urls>.

3. CODE VERIFICATION:
- Manifest V3 compliant (manifest_version: 3).
- Uses standard modern DOM APIs and local storage.
```

---

## 4. Privacy & Data Use Disclosures

Complete the CWS Data Use Declaration as follows:

- **Does the extension collect user data?** `No`
- **Is user data transmitted off-device?** `No`
- **Does the extension sell user data?** `No`
- **Does the extension use user data for purposes unrelated to core functionality?** `No`
- **Does the extension use user data for creditworthiness or lending?** `No`

**Privacy Policy URL**:
```
https://github.com/TheFieryFalcon/connectify/blob/main/PRIVACY.md
```

---

## 5. Visual Assets

| Asset | Dimensions | Status | Location |
| :--- | :--- | :--- | :--- |
| **Store Icon** | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| **Toolbar Icon** | 48×48 PNG | ✅ Ready | `icons/icon-48.png` |
| **Small Icon** | 16×16 PNG | ✅ Ready | `icons/icon-16.png` |
| **Screenshot 1** | 1280×800 PNG | Recommended | In-app capture of assessment outlines with sidebar open |
| **Screenshot 2** | 1280×800 PNG | Recommended | Weakness radar chart and ATAR calculation breakdown |
| **Small Promo Tile** | 440×280 PNG | Optional | Branded tile for CWS promotion |

---

## 6. Version History

| Version | Date | Changes | Status |
| :--- | :--- | :--- | :--- |
| **3.1.14** | 2026-09-24 | Added AMO Version Create automated API, optimized icons to 16/48/128px, stripped update_url for CWS compliance, and added full CWS review expediting documentation. | Draft / Ready for Submission |
