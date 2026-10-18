import Facebook from '@mui/icons-material/Facebook';
import Instagram from '@mui/icons-material/Instagram';
import X from '@mui/icons-material/X';
import type { SvgIconComponent } from '@mui/icons-material';
import { IconButton, Stack } from '@mui/material';

interface Network {
  name: string;
  icon: SvgIconComponent;
  url: string | undefined;
}

/** Only https links count, so a typo in a setting can never become an unsafe link. */
function safeUrl(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Social media icons. Each shows once its VITE_SOCIAL_* address is set. */
export function SocialLinks({ color }: { color: string }) {
  const networks: Network[] = [
    { name: 'Facebook', icon: Facebook, url: import.meta.env.VITE_SOCIAL_FACEBOOK },
    { name: 'Instagram', icon: Instagram, url: import.meta.env.VITE_SOCIAL_INSTAGRAM },
    { name: 'X', icon: X, url: import.meta.env.VITE_SOCIAL_X },
  ];
  const links = networks
    .map((n) => ({ ...n, href: safeUrl(n.url) }))
    .filter((n): n is Network & { href: string } => n.href !== null);
  if (links.length === 0) return null;

  return (
    <Stack
      component="ul"
      direction="row"
      aria-label="ClientShield on social media"
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {links.map(({ name, icon: Icon, href }) => (
        <li key={name}>
          <IconButton
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`ClientShield on ${name}`}
            sx={{ color }}
          >
            <Icon fontSize="small" />
          </IconButton>
        </li>
      ))}
    </Stack>
  );
}
