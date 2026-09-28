import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { brand, fonts } from './tokens';

export type ColorMode = 'light' | 'dark';

/** One theme shared by the main app and the admin panel. */
export function createAppTheme(mode: ColorMode): Theme {
  return createTheme(appThemeOptions(mode));
}

/**
 * Orange used for text (links, text and outlined buttons). Bright crust is too
 * faint on cream and white, so light mode uses the darker crust.
 */
export function accentTextColor(mode: ColorMode): string {
  return mode === 'dark' ? brand.crust : brand.crustDark;
}

/** Raw theme options, for libraries such as react-admin that build the theme themselves. */
export function appThemeOptions(mode: ColorMode): ThemeOptions {
  const isDark = mode === 'dark';
  const accent = accentTextColor(mode);

  return {
    palette: {
      mode,
      primary: { main: brand.crust, dark: brand.crustDark, contrastText: brand.navy },
      secondary: { main: brand.navy, contrastText: brand.cream },
      // Incident alerts use calm orange. Red is reserved for real errors.
      warning: { main: brand.crust, contrastText: brand.navy },
      error: { main: brand.danger },
      success: { main: brand.verified, dark: brand.verifiedText },
      background: isDark
        ? { default: brand.navyDeep, paper: brand.navy }
        : { default: brand.cream, paper: brand.white },
      text: isDark
        ? { primary: brand.cream, secondary: brand.mist }
        : { primary: brand.navy, secondary: brand.slate },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: fonts.body,
      h1: { fontFamily: fonts.display, fontWeight: 600 },
      h2: { fontFamily: fonts.display, fontWeight: 600 },
      h3: { fontFamily: fonts.display, fontWeight: 600 },
      h4: { fontFamily: fonts.display, fontWeight: 600 },
      h5: { fontFamily: fonts.display, fontWeight: 600 },
      h6: { fontFamily: fonts.display, fontWeight: 600 },
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
