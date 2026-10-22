/**
 * Connectify Update Reload (background; GitHub and Firefox builds, stripped from the Chrome Web Store zip)
 *
 * Browsers never load a new version into tabs that are already open: Firefox shuts the old content scripts
 * down but leaves their drawer and panels on the page with dead buttons. After an install or update every
 * open Connect tab is reloaded, so it runs the version just installed.
 */
'use strict';

const CONNECT_TABS = 'https://connect.det.wa.edu.au/*';
const ext = globalThis.browser || globalThis.chrome;

ext.runtime.onInstalled.addListener(async details => {
  if (details.reason !== 'install' && details.reason !== 'update') return;
  try {
    const tabs = await ext.tabs.query({ url: CONNECT_TABS });
    await Promise.all(tabs.map(tab => ext.tabs.reload(tab.id).catch(() => {})));
  } catch (err) {
    console.warn('Connectify could not reload open Connect tabs after the update:', err);
  }
});
