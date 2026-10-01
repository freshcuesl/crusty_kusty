import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { brand, fonts } from './tokens';

export type ColorMode = 'light' | 'dark';

/** One theme shared by the main app and the admin panel. */
export function createAppTheme(mode: ColorMode): Theme {
  return createTheme(appThemeOptions(mode));
}

/**
 * Teal used for text (links, text and outlined buttons). Bright teal is too
 * faint on mist and white, so light mode uses the darker teal.
 */
export function accentTextColor(mode: ColorMode): string {
  return mode === 'dark' ? brand.teal : brand.tealDark;
}

/** Raw theme options, for libraries such as react-admin that build the theme themselves. */
export function appThemeOptions(mode: ColorMode): ThemeOptions {
  const isDark = mode === 'dark';
  const accent = accentTextColor(mode);

  return {
    palette: {
      mode,
      primary: { main: brand.teal, dark: brand.tealDark, contrastText: brand.midnight },
      secondary: { main: brand.midnight, contrastText: brand.mist },
      // Incident alerts use calm amber. Red is reserved for real errors.
      warning: { main: brand.amber, contrastText: brand.midnight },
      error: { main: brand.danger },
      success: { main: brand.teal, dark: brand.tealDark, contrastText: brand.midnight },
      background: isDark
        ? { default: brand.midnightDeep, paper: brand.midnightSoft }
        : { default: brand.mist, paper: brand.white },
      text: isDark
        ? { primary: brand.mist, secondary: brand.haze }
        : { primary: brand.midnight, secondary: brand.slate },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 700 },
      h2: { fontFamily: fonts.display, fontWeight: 700 },
      h3: { fontFamily: fonts.display, fontWeight: 700 },
      h4: { fontFamily: fonts.display, fontWeight: 700 },
      h5: { fontFamily: fonts.display, fontWeight: 700 },
      h6: { fontFamily: fonts.display, fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 44, borderRadius: 12 } },
        variants: [
          { props: { variant: 'text', color: 'primary' }, style: { color: accent } },
          {
            props: { variant: 'outlined', color: 'primary' },
            style: { color: accent, borderColor: accent },
          },
        ],
      },
      MuiLink: {
        defaultProps: { color: accent },
      },
      MuiIconButton: {
        styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
      },
    },
  };
}
