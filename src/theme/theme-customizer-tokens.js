/**
 * Connectify Theme Customizer: Full-mode overrides over the Basic tokens
 *
 * The 6 Basic tokens drive every other token (theme-token-derive.js), except the Full-mode tokens the user set
 * themselves: those are overrides and win in both modes, so switching to Basic and editing a Basic token never
 * replaces them. A theme is saved as its Basic tokens plus its overrides; whatever it leaves out is derived again
 * when it is applied or reopened. Exposes window.ConnectifyCustomizerTokens.
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

  /** Re-derives every Full token that is not an override (called on each refresh, in Basic and Full mode). */
  function apply(state) {
    const overrides = state.overrides || (state.overrides = new Set());
    const d = derived(state.tokens);
    for (const key of COLOR_KEYS()) {
      if (!isBasic(key) && !overrides.has(key) && d[key]) state.tokens[key] = d[key];
    }
    return state.tokens;
  }

  /** Takes a complete token set (a saved theme, an import) and works out which Full tokens it overrides. */
  function adopt(state, tokens) {
    state.tokens = { ...tokens };
    state.overrides = overridesOf(state.tokens);
    return apply(state);
  }

  /** A colour picked for a token; a Full token becomes an override. */
  function set(state, key, value) {
    state.tokens[key] = value;
    if (!isBasic(key)) (state.overrides || (state.overrides = new Set())).add(key);
  }

  /** Hands a Full token back to the Basic tokens. */
  function reset(state, key) {
    state.overrides?.delete(key);
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

  window.ConnectifyCustomizerTokens = { BASIC, isBasic, derived, overridesOf, apply, adopt, set, reset, savedColors };
})();
