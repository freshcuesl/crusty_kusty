import { createFakeSupabase } from '@cs/core/testing';
import { ThemeProvider, createTheme } from '@mui/material';
import { render } from '@testing-library/react';
import { AdminContext } from 'react-admin';
import { describe, expect, it } from 'vitest';
import { appThemeOptions, brand } from '@cs/brand';
import { createLoginPage } from './LoginPage';

describe('admin login page', () => {
  it.each([
    ['light', brand.midnight],
    ['dark', brand.mist],
  ] as const)('uses the right shield color in %s mode', (mode, fill) => {
    const LoginPage = createLoginPage(createFakeSupabase().client);
    const { container } = render(
      <AdminContext>
        <ThemeProvider theme={createTheme(appThemeOptions(mode))}>
          <LoginPage />
        </ThemeProvider>
      </AdminContext>,
    );
    expect(container.querySelector('[data-part="shield"]')).toHaveAttribute('fill', fill);
  });
});
