/**
 * Connectify Theme Customizer: Full-mode overrides over the Basic tokens
 *
 * The 6 Basic tokens drive every other token (theme-token-derive.js). A Full-mode token the user set, a picked
 * preset's own colour or a saved theme's own colour is an override and keeps its value, in both modes, until a
 * Basic token it derives from changes: each override remembers what the Basic tokens derived for it when it was
 * set (state.bases), and once they derive something else it is derived again. A theme is saved as its Basic
 * tokens plus its overrides; whatever it leaves out is derived again when it is applied or reopened.
 * Exposes window.ConnectifyCustomizerTokens.
 */
(() => {
  'use strict';

  const derive = () => window.ConnectifyThemeDerive;
  const COLOR_KEYS = () => window.ConnectifyThemeColors.COLOR_KEYS;
  const BASIC = ['canvas', 'surface', 'button', 'border', 'accent', 'textPrimary'];
  const isBasic = key => BASIC.includes(key);
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  /** The Full tokens the 6 Basic ones derive. */
  function derived(tokens) {
    const basics = Object.fromEntries(BASIC.filter(k => tokens[k]).map(k => [k, tokens[k]]));
    return derive()?.deriveFull({ ...basics }) || {};
  }

  /** Full tokens whose value is not what the Basic tokens derive: the ones the user (or an older save) set. */
  function overridesOf(tokens) {
    const d = derived(tokens);
    return new Set(COLOR_KEYS().filter(k => !isBasic(k) && tokens[k] && d[k] && !same(tokens[k], d[k])));
  }

  /** Makes these Full tokens the overrides, each held against what the Basic tokens derive for it now. */
  function track(state, keys) {
    const d = derived(state.tokens);
    state.overrides = new Set([...keys].filter(k => !isBasic(k) && d[k]));
    state.bases = Object.fromEntries([...state.overrides].map(k => [k, d[k]]));
    return state;
  }

  /** Re-derives every Full token that is not an override, or whose Basic tokens changed (on each refresh). */
  function apply(state) {
    const overrides = state.overrides || (state.overrides = new Set());
    const bases = state.bases || (state.bases = {});
    const d = derived(state.tokens);
    for (const key of COLOR_KEYS()) {
      if (isBasic(key) || !d[key]) continue;
      if (overrides.has(key) && bases[key] && !same(bases[key], d[key])) { overrides.delete(key); delete bases[key]; }
      if (!overrides.has(key)) state.tokens[key] = d[key];
    }
    return state.tokens;
  }

  /** Takes a complete token set (a saved theme, an import) and works out which Full tokens it overrides. */
  function adopt(state, tokens) {
    state.tokens = { ...tokens };
    track(state, overridesOf(state.tokens));
    return apply(state);
  }

  /** A preset picked as a starting point: every colour it sets is kept as set, until its Basic tokens change. */
  function fromPreset(state, preset, tokens) {
    state.tokens = { ...tokens };
    track(state, Object.keys(window.ConnectifyThemeColors.pickColors(preset)));
    return apply(state);
  }

  /** A colour picked for a token; a Full token becomes an override held against the current Basic tokens. */
  function set(state, key, value) {
    state.tokens[key] = value;
    if (isBasic(key)) return;
    (state.overrides || (state.overrides = new Set())).add(key);
    (state.bases || (state.bases = {}))[key] = derived(state.tokens)[key];
  }

  /** Hands a Full token back to the Basic tokens. */
  function reset(state, key) {
    state.overrides?.delete(key);
    if (state.bases) delete state.bases[key];
    apply(state);
  }

  /** What a theme stores: its Basic tokens and its overrides. */
  function savedColors(state) {
    const out = {};
    for (const key of COLOR_KEYS()) {
      if (state.tokens[key] && (isBasic(key) || state.overrides?.has(key))) out[key] = state.tokens[key];
    }
    return out;
  }

  window.ConnectifyCustomizerTokens = { BASIC, isBasic, derived, overridesOf, track, apply, adopt, fromPreset, set, reset, savedColors };
})();
