# Privacy Policy for Connectify

**Effective Date:** September 24, 2026  
**Last Updated:** September 24, 2026  

Connectify ("the Extension", "we", "our") is a browser extension designed to enhance the student experience on the Western Australia Department of Education Connect portal (`connect.det.wa.edu.au`).

We believe student privacy is paramount. This Privacy Policy outlines our data practices.

---

## 1. No Data Collection or Off-Device Transmission

- **Local Operation:** Connectify operates entirely within your web browser on your local device.
- **No External Servers:** Connectify does not operate any analytics servers, tracking databases, or telemetry backends. No student marks, assessment outlines, user credentials, names, or browsing history are ever transmitted off your device.
- **No Third-Party Sharing:** We do not sell, rent, monetize, or share any user data with third parties or advertising networks.

---

## 2. Permissions & Data Storage

Connectify requests only the minimum permissions necessary to deliver its features:

- **`storage` Permission (`chrome.storage.local` / `localStorage`):**
  - **Purpose:** Used strictly to save user interface preferences (such as auto-expand toggles, dark/light theme choice), course include/exclude selections for ATAR calculation, and local cache of running subject averages to detect grade updates.
  - **Location:** All data is stored locally in your browser's private extension storage and never leaves your computer.

- **Host Permissions & Content Scripts (`connect.det.wa.edu.au`, `login.det.wa.edu.au`):**
  - **Purpose:** Content scripts run only on Western Australia Department of Education student portal pages to read assessment marks from the DOM, render statistical graphs (boxplots, radar charts, running averages), and apply optional CSS theme enhancements.

---

## 3. Children's Privacy & Education Data

Connectify complies with student privacy principles:
- No tracking or profiling of students is performed.
- No personal information is gathered, stored remotely, or requested.

---

## 4. Open Source & Transparency

Connectify is open-source. Anyone can inspect the complete source code to verify that no remote network requests are made with student data.

---

## 5. Contact & Inquiries

If you have questions about this privacy policy, please contact:
- **Developer:** TheFieryFalcon
- **Email:** thefieryfalcon95@gmail.com
- **Repository:** https://github.com/TheFieryFalcon/connectify
