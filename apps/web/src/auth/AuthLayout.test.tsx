import { ThemeProvider } from '@mui/material';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { brand, createAppTheme } from '@cs/brand';
import { AuthLayout } from './ui';

function renderIn(mode: 'light' | 'dark') {
  return render(
    <ThemeProvider theme={createAppTheme(mode)}>
      <MemoryRouter>
        <AuthLayout />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('<AuthLayout />', () => {
  it('shows the midnight shield on the light background', () => {
    const { container } = renderIn('light');
    expect(container.querySelector('[data-part="shield"]')).toHaveAttribute('fill', brand.midnight);
  });

  it('switches to the light shield in dark mode so it stays visible', () => {
    const { container } = renderIn('dark');
    expect(container.querySelector('[data-part="shield"]')).toHaveAttribute('fill', brand.mist);
  });
});
