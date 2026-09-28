import { ThemeProvider } from '@mui/material';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { createAppTheme } from '@ck/brand';

interface Options {
  route?: string;
}

/** Renders UI inside the same theme and router the real app uses. */
export function renderWithProviders(ui: ReactElement, { route = '/' }: Options = {}): RenderResult {
  return render(
    <ThemeProvider theme={createAppTheme('light')}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}
