# Connectify Past Years & Backup Reference

Past Years shows a finished school year as it stood at its end: Assessment Outlines and every tool, read-only. Backup exports everything Connectify keeps in this browser to one file and imports it, in Settings.

---

## 1. Saving the year

### Kept records (`year-capsule.js`, `ConnectifyYearCapsule`, outlines group)
- **Why**: Connect never shows last year's marks again, so Connect's own outline records are kept through the year: `connectify:outline_records:<account>` (`{ classNames, records, savedAt }`), written on `connectify-outlines-loaded` when they changed. No cache version bump or Clear Cache removes them.
- **Merged** (`mergeRecords`): Connect hides outlines at times (exam weeks), so a load never drops a class the year's records hold, and a record without tasks never replaces one with them; Connect's order first. `takeRecords` leaves out next year's classes (Year 12 courses shown in Term 4).
- **New year first**: a load whose classes are all new waits until the rollover has taken last year's (`takeRecords(classNames)`), unless the year snapshot already names the new classes.
- `settings()`: the year's per-student keys the rollover archives with it (task types, class categories, week overrides, calibration and calculators, baselines, cohort sizes), `{account}`-templated (`backup-sections.js`).

### Archive (`year-archive.js`, `ConnectifyYearArchive`, both groups)
- `connectify:year_archive:<account>`: a list of years, each `{ classNames, averages, subjects, grades, classSemesters, records, settings, goals, year, archivedAt }`, written by `year-rollover.js` (`archiveYear`) and by import.
- **Two stores**: localStorage and extension storage (a large wallpaper never fills it; clearing the site's data never empties it). `read()` merges both (`ready()` reads extension storage once, `connectify-archive-ready`); over quota, localStorage keeps the years without their task lists. Parsed again only when the stored text changes.
- `merge(...lists)`: one entry per class set, the copy with more tasks wins and is filled in from the other, the last three years (`MAX_YEARS`).
- `yearOf(entry)`: saved `year`, else a year named in the classes, else `archivedAt` (January to June: the year before). `label`: `Year 11, 2026` (level from `yearMarker`, shared with the rollover), else the year.
- `years()`: newest first, leaving out an entry that shares a class with this year's registry or snapshot (a backup's year in progress). Always the student's own account (`ConnectifyUtils.liveAccountKey`), also while a past year is viewed.

## 2. Viewing a past year

### Switch (`past-year-mode.js`, `ConnectifyPastYearMode`, after the scheduler, before `utils.js`)
- Per tab: `sessionStorage` `connectify:past_year` (`{ id, year, label, savedAt }`). Any page but Assessment Outlines ends it, so the notice can never be wrong.
- `accountKey()` carries `suffix()` (`~p<id>`), so every per-student key (`userKey` too) is the year's copy; `liveAccountKey()` stays the student's own.
- `year()` and `today()` (31 December of that year) stand for the clock wherever the date decides something: term weeks and Early Easter (`school-terms.js`, `assessment-parse-helpers.js`), semester detection (`class-semesters.js`, so a finished year reads as Semester 2), Next Up, Task Dates, the week editor, the export, the year-keyed calculator and cohort size keys. No `new Date().getFullYear()` is read without it (Test 345).
- `data-cx-past-year` on `<html>` for `past-year.css`.

### Opening (`past-year-open.js`, `ConnectifyPastYearOpen`, both groups)
- `view(id)`: writes the year's copy (`materialize`: the records, results cache, class registry, marks, goals and verdicts, snapshot, and its settings, only keys the backup sections allow in the shape they need), sets the tab's choice, then reloads or opens the outlines. `'full'` when it does not fit (nothing left behind), `'missing'`.
- `recordsFrom(entry)`: years archived before records were kept get records rebuilt from the cached tasks. A task id is `JSON [labels, out-of mark]:<n>`, so the rebuilt record gives every task its old id.
- `back()`: ends the view, removes every copy (`clearCopies`), reloads.

### The page
- `outline-api.js`: the copy's records stand in for Connect's (`pastRecords`, after the rest of the group has loaded); nothing is fetched.
- `legacy-outlines.js`: every record is drawn, after Connect's cards, which `past-year.css` hides with its filter bar, the fixed All bar, its "No Assessment Outlines available." (`cnt-no-content-panel`), the semester notice and the countdown. Teacher and school names link nowhere.
- `past-year-bar.js` (`#cx-past-year-bar`): above the drawn outlines, sticky under Connect's fixed top bars (`--cx-past-year-top`, measured again after each scroll, since Connect moves its service bar up as the page scrolls): the year, `Marks as of <date>`, Back to This Year.

### Off and locked
- Off: the rollover (`handleClassChange` returns `'past-year'`), grade and goal toasts, new results, the update and overhaul notices, the WACE countdown, Connect's filter (`isOutlinesFilterRestricted` false), the semester filter, the settings move, the record capture, Next Up and Awaiting Results.
- Locked in place: Type dropdowns (`disabled`), the week ✎ (week shown, no editor), Set as Goal, goal Edit and Delete, cohort size inputs, Export (hidden), and Settings (its launcher is disabled: it would change the copy). Estimator inputs stay: what-ifs, gone with the copy.

### Launcher (`sidebar-past-years.js`, `ConnectifyPastYears`, both groups)
- `#connectify-past-years-toggle` between Weakness Analyzer and Settings, a secondary (white) tool; hidden until `available()` (a past year, or one being viewed); works on every Connect page (`ANYWHERE_TOOLS`).
- `#connectify-past-years`: each year, its cleaned class names and View; the year being viewed reads Back to This Year. A failed View says why under the list. Styles: `sidebar-past-years.css`.

## 3. Backup

### Sections (`backup-sections.js`, `ConnectifyBackupSections`, both groups)
- `SECTIONS`: Goals, Task Types, Week Overrides, Calibration and Calculators, Baselines, Categories, Past Years, Themes, Preferences. `sectionOf(key, acct)` is the allowlist: nothing else is ever exported or written (never caches, cache versions, account maps, theme boot or auto-login flags).
- Past Years also carries this year's records, results cache, class registry, grade cache, snapshot and new-year mark. Themes: `connectify:custom_themes_list`, `connectify:custom_background`, `connectify:theme:id`.
- `template` / `untemplate`: the account as `{account}`; `collect(ids, acct)`; `check(key, raw)`: the shape each key needs.

### File (`backup-file.js`, `ConnectifyBackup`)
- `{ format: 'connectify-backup', version: 1, exportedAt, appVersion, user, sections: { <id>: { <templated key>: raw string } } }`, saved as `connectify_backup_<YYYY-MM-DD>.json` (`<a download>`, no permission).
- `collect()`: extension storage first for categories and themes (whole wallpapers), the archive from `read()`; `build(ext, years)` is the synchronous part.
- `readFile(file)`: `FileReader.readAsText` (Firefox MV3 content scripts may not read page-owned buffers). `parse(text)`: code `invalid` (not JSON, wrong format) or `newer`; per section `{ values, invalid }`, a key of another section or a value of the wrong shape marking it invalid.

### Import (`backup-import.js`, `ConnectifyBackupImport`)
- `plan(parsed)`: a row per section the file holds: what it holds (`2 goals`, `Year 10, 2025, Year 11, 2026`), and `adds` (ticked), `replaces` (`Replaces 1 type here`, unticked), `same` or `invalid` (both disabled). Past Years and Themes merge; a theme of the same name counts as a replacement.
- `applyStored`: replaced sections lose this browser's keys and take the file's; the archive merges, adding the file's year in progress (`currentYear`: classes from its snapshot, as the rollover names them); a snapshot or new-year mark only where this browser has none (an older one would start a second rollover). Any localStorage failure puts every key back: code `full`.
- `apply`: then baselines through `saveBaselines` (purges legacy keys), categories through `saveCategories`, themes through `ConnectifyThemeImport.saveTheme` (sanitised, by name) with the Settings wallpaper and the theme in use, then the prediction cache is cleared.
- Exported in Year 11 and imported in Year 12: the year joins the archive and is listed once this browser's snapshot names the new classes (on the new browser, the restored snapshot lets the rollover carry baselines over; `merge` keeps the richer copy).

### Settings (`settings-backup.js`, `ConnectifySettingsBackup`; markup in `settings-markup.js`, before Developer Settings)
- Export Data and Import Data (`.cx-backup-btn`, Settings' primary blue), status beside them: `Not a Connectify backup`, `Made by a newer Connectify`, `Not enough room, nothing was changed`.
- A picked file is reviewed in place (`#cx-backup-review`): the file name and date, `From another Connect account` when its user differs, a tick per row, Import (n) and Cancel. Importing reloads the page. Styles: `sidebar-backup.css`.

---

*Back to [Overview](file:///Users/uwong/Downloads/2.1.14_0/overview.md)*
