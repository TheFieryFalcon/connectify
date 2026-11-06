/**
 * Connectify Settings: Backup
 *
 * The Backup section's Export Data (one file of everything, backup-file.js) and Import Data. A picked file is reviewed
 * in place, never in a dialog: a tick per section it holds, with what it holds and what importing does here (adds,
 * replaces, or nothing), anything that would replace data here unticked, then Import (n) and Cancel. Importing writes
 * the ticked sections (backup-import.js) and reloads the page, as many tools keep what they read in memory.
 * Exposes window.ConnectifySettingsBackup.
 */
(() => {
  'use strict';

  const EFFECTS = { adds: 'Adds to this browser', same: 'Same as here', invalid: 'Not readable' };
  const FAILURES = {
    invalid: 'Not a Connectify backup',
    newer: 'Made by a newer Connectify',
    unreadable: 'The file could not be read',
    full: 'Not enough room, nothing was changed'
  };
  const el = (tag, className, text) => Object.assign(document.createElement(tag), { className: className || '', textContent: text || '' });
  const dateText = at => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  function bind(panel) {
    const exportBtn = panel.querySelector('#cx-backup-export');
    const importBtn = panel.querySelector('#cx-backup-import');
    const input = panel.querySelector('#cx-backup-file');
    const status = panel.querySelector('#cx-backup-status');
    const review = panel.querySelector('#cx-backup-review');
    if (!exportBtn || !importBtn || !input || !review) return () => {};
    const backup = () => window.ConnectifyBackup;
    const say = text => { if (status) status.textContent = text || ''; };

    function close() {
      review.hidden = true;
      review.replaceChildren();
      importBtn.disabled = false;
    }

    function show(parsed, name) {
      const rows = window.ConnectifyBackupImport.plan(parsed);
      if (!rows.length) { say(FAILURES.invalid); return; }
      const ticks = new Map();
      const list = el('ul', 'cx-backup-list');
      const go = el('button', 'eds-c-button cx-backup-btn');
      go.type = 'button';
      const count = () => {
        const n = [...ticks.values()].filter(box => box.checked).length;
        go.textContent = `Import (${n})`;
        go.disabled = !n;
      };
      for (const row of rows) {
        const item = el('li', `cx-backup-row cx-backup-row--${row.state}`);
        const label = el('label', 'cx-settings-check');
        const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: row.ticked });
        box.disabled = row.state === 'same' || row.state === 'invalid';
        box.addEventListener('change', count);
        ticks.set(row.id, box);
        label.append(box, ` ${row.label}`);
        item.append(label, el('span', 'cx-backup-what', row.file), el('span', 'cx-backup-effect', row.here || EFFECTS[row.state] || ''));
        list.append(item);
      }
      const head = el('p', 'cx-backup-file', [name, parsed.exportedAt ? dateText(parsed.exportedAt) : ''].filter(Boolean).join(', '));
      const parts = [head];
      const user = window.ConnectifyUtils.signedInUserId?.();
      if (parsed.user && user && parsed.user !== String(user)) parts.push(el('p', 'cx-backup-warning', 'From another Connect account'));
      const cancel = el('button', 'eds-c-button cx-backup-btn cx-backup-btn--secondary', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', () => { close(); say(''); });
      go.addEventListener('click', async () => {
        const ids = [...ticks].filter(([, box]) => box.checked).map(([id]) => id);
        go.disabled = cancel.disabled = true;
        try {
          await window.ConnectifyBackupImport.apply(parsed, ids);
          say('Imported. Reloading...');
          setTimeout(() => location.reload(), 600);
        } catch (err) {
          console.warn('Connectify could not import the backup:', err);
          say(FAILURES[err?.code] || FAILURES.full);
          go.disabled = cancel.disabled = false;
        }
      });
      const actions = el('div', 'cx-backup-actions');
      actions.append(go, cancel);
      review.replaceChildren(...parts, list, actions);
      review.hidden = false;
      importBtn.disabled = true;
      count();
    }

    exportBtn.addEventListener('click', async () => {
      say('');
      exportBtn.disabled = true;
      try {
        backup().save(await backup().collect());
      } catch (err) {
        console.warn('Connectify could not export its data:', err);
        say('The backup could not be made');
      } finally {
        exportBtn.disabled = false;
      }
    });
    importBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = ''; // picking the same file again must fire change
      if (!file) return;
      say('');
      try {
        await window.ConnectifyYearArchive?.ready();
        show(backup().parse(await backup().readFile(file)), file.name);
      } catch (err) {
        say(FAILURES[err?.code] || FAILURES.invalid);
      }
    });

    return () => {};
  }

  window.ConnectifySettingsBackup = { bind };
})();
