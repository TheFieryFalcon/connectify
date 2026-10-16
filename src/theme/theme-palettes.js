/**
 * Connectify Theme: built-in palettes
 *
 * Colour sets for the preset themes, also used by the theme customizer to inherit colours.
 * The CSS custom properties for each preset live in styles/theme-tokens.css.
 * Exposes window.ConnectifyThemePalettes.
 */
(() => {
  'use strict';

  const BUILTIN_PALETTES = {
    dark: {
      name: 'Dark', icon: '🌙', isDark: true, swatch: ['#12171f', '#1e2632', '#3b82f6'],
      canvas: '#12171f', canvasSubtle: '#0a0d12', surface: '#1e2632', surfaceSecondary: '#18202b', surfaceElevated: '#263242', surfaceHover: '#263344',
      border: '#455a73', borderSubtle: '#2e3c4e', borderStrong: '#5a7391', accent: '#3b82f6', accentHover: '#60a5fa',
      textPrimary: '#f8fafc', textSecondary: '#e2e8f0', textMuted: '#94a3b8', tileLinkColor: '#f8fafc',
      button: '#202c3b', buttonHover: '#2c3b4e', buttonText: '#f1f5f9', inputBg: '#141a22', inputBorder: '#42556d'
    },
    quantum: {
      name: 'Quantum Dark', icon: '⚛️', isDark: true, swatch: ['#282828', '#32302f', '#fabd2f'],
      canvas: '#282828', canvasSubtle: '#191b1c', surface: '#32302f', surfaceSecondary: '#282828', surfaceElevated: '#3c3836', surfaceHover: '#504944',
      border: '#5a524c', borderSubtle: '#3c3836', borderStrong: '#665c54', accent: '#fabd2f', accentHover: '#fcd34d',
      textPrimary: '#fbf1c7', textSecondary: '#b8bb26', textMuted: '#bdae93', tileLinkColor: '#fbf1c7',
      button: '#3c3836', buttonHover: '#504944', buttonText: '#fbf1c7', inputBg: '#1d2021', inputBorder: '#504944'
    },
    amoled: {
      name: 'AMOLED Black', icon: '🌑', isDark: true, swatch: ['#000000', '#0a0a0a', '#38bdf8'],
      canvas: '#000000', canvasSubtle: '#050505', surface: '#0d0d0d', surfaceSecondary: '#141414', surfaceElevated: '#1a1a1a', surfaceHover: '#1f1f1f',
      border: '#333333', borderSubtle: '#222222', borderStrong: '#444444', accent: '#38bdf8', accentHover: '#7dd3fc',
      textPrimary: '#ffffff', textSecondary: '#d4d4d4', textMuted: '#a3a3a3', tileLinkColor: '#ffffff',
      button: '#121212', buttonHover: '#202020', buttonText: '#ffffff', inputBg: '#050505', inputBorder: '#262626'
    },
    midnight: {
      name: 'Midnight Navy', icon: '🌌', isDark: true, swatch: ['#0b132b', '#141f36', '#60a5fa'],
      canvas: '#0b132b', canvasSubtle: '#050914', surface: '#121e38', surfaceSecondary: '#18284a', surfaceElevated: '#1f325c', surfaceHover: '#253c6e',
      border: '#355085', borderSubtle: '#233559', borderStrong: '#4568a8', accent: '#60a5fa', accentHover: '#93c5fd',
      textPrimary: '#f1f5f9', textSecondary: '#cbd5e1', textMuted: '#94a3b8', tileLinkColor: '#f1f5f9',
      button: '#182642', buttonHover: '#22355c', buttonText: '#f1f5f9', inputBg: '#0e1830', inputBorder: '#2a3c61'
    },
    forest: {
      name: 'Emerald Forest', icon: '🌲', isDark: true, swatch: ['#0a1914', '#11261f', '#10b981'],
      canvas: '#0a1914', canvasSubtle: '#050d0a', surface: '#122820', surfaceSecondary: '#173329', surfaceElevated: '#1e4235', surfaceHover: '#244f3f',
      border: '#326753', borderSubtle: '#1e4235', borderStrong: '#44886f', accent: '#10b981', accentHover: '#34d399',
      textPrimary: '#ecfdf5', textSecondary: '#d1fae5', textMuted: '#6ee7b7', tileLinkColor: '#ecfdf5',
      button: '#132c24', buttonHover: '#1a3b30', buttonText: '#ecfdf5', inputBg: '#0d1f19', inputBorder: '#224a3b'
    },
    sunset: {
      name: 'Twilight Plum', icon: '🌅', isDark: true, swatch: ['#19111c', '#26182a', '#f43f5e'],
      canvas: '#19111c', canvasSubtle: '#0d080e', surface: '#28182c', surfaceSecondary: '#351f3b', surfaceElevated: '#44274c', surfaceHover: '#4e2c56',
      border: '#64396f', borderSubtle: '#412548', borderStrong: '#824b91', accent: '#f43f5e', accentHover: '#fb7185',
      textPrimary: '#fdf2f8', textSecondary: '#fce7f3', textMuted: '#f472b6', tileLinkColor: '#fdf2f8',
      button: '#2b1930', buttonHover: '#3a2241', buttonText: '#fdf2f8', inputBg: '#1e1322', inputBorder: '#4b2a54'
    },
    'liquid-glass': {
      name: 'Liquid Glass', icon: '🫧', isDark: true, liquidGlass: true, swatch: ['#0b1120', 'rgba(56, 189, 248, 0.25)', '#38bdf8'],
      canvas: '#0b1120', canvasSubtle: '#080d19', surface: 'rgba(26, 36, 52, 0.72)', surfaceSecondary: 'rgba(18, 24, 38, 0.68)', surfaceElevated: 'rgba(38, 51, 72, 0.80)', surfaceHover: 'rgba(255, 255, 255, 0.14)',
      border: 'rgba(255, 255, 255, 0.22)', borderSubtle: 'rgba(255, 255, 255, 0.12)', borderStrong: 'rgba(255, 255, 255, 0.32)', accent: '#38bdf8', accentHover: '#7dd3fc',
      textPrimary: '#ffffff', textSecondary: '#dbeafe', textMuted: '#93c5fd', tileLinkColor: '#ffffff',
      button: 'rgba(255, 255, 255, 0.10)', buttonHover: 'rgba(255, 255, 255, 0.18)', buttonText: '#ffffff', inputBg: 'rgba(15, 23, 42, 0.60)', inputBorder: 'rgba(255, 255, 255, 0.14)'
    }
  };

  window.ConnectifyThemePalettes = { BUILTIN_PALETTES };
})();
