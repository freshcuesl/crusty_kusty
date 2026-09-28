import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brand } from '@ck/brand';
import { AdminApp } from './AdminApp';
import { adminTheme } from './adminTheme';

describe('<AdminApp />', () => {
  it('opens on the moderation dashboard', async () => {
    render(<AdminApp />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Moderation' }),
    ).toBeInTheDocument();
  });

  it('brands the header as the Crusty Krustees admin', async () => {
    render(<AdminApp />);
    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('img', { name: 'Crusty Krustees' })).toBeInTheDocument();
    expect(within(header).getByText('Admin')).toBeInTheDocument();
  });

  it.each(['Business verifications', 'Incident review', 'Abuse flags'])(
    'shows the "%s" queue',
    async (queue) => {
      render(<AdminApp />);
      expect(await screen.findByRole('heading', { name: queue })).toBeInTheDocument();
    },
  );
});

describe('adminTheme', () => {
  it('shares the brand palette with the main app', () => {
    expect(adminTheme.palette?.primary).toMatchObject({ main: brand.crust });
    expect(adminTheme.palette?.secondary).toMatchObject({ main: brand.navy });
  });
});
