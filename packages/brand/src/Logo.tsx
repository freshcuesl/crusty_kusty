import { brand, fonts } from './tokens';

export interface LogoProps {
  /** Height of the crab mark in pixels. */
  size?: number;
  /** Show the "Crusty Krustees" wordmark beside the crab. */
  withWordmark?: boolean;
  /** Hide from screen readers when a visible label already names the app. */
  decorative?: boolean;
}

const NAME = 'Crusty Krustees';

/** The Crusty Krustees crab mascot: a crust-colored shell holding a verified check. */
export function Logo({ size = 40, withWordmark = false, decorative = false }: LogoProps) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': NAME };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg width={size} height={size} viewBox="0 0 120 100" focusable="false" {...a11y}>
        <line
          x1="48"
          y1="44"
          x2="44"
          y2="24"
          stroke={brand.navy}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <line
          x1="72"
          y1="44"
          x2="76"
          y2="24"
          stroke={brand.navy}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="44" cy="22" r="7" fill={brand.cream} stroke={brand.navy} strokeWidth="4" />
        <circle cx="76" cy="22" r="7" fill={brand.cream} stroke={brand.navy} strokeWidth="4" />
        <circle cx="45" cy="23" r="3" fill={brand.navy} />
        <circle cx="77" cy="23" r="3" fill={brand.navy} />
        <ellipse cx="60" cy="66" rx="34" ry="22" fill={brand.crust} />
        <path
          d="M30 60 Q45 50 60 58 Q75 50 90 60"
          fill="none"
          stroke={brand.crustDark}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="54" r="11" fill={brand.crust} />
        <circle cx="104" cy="54" r="11" fill={brand.crust} />
        <circle cx="60" cy="72" r="10" fill={brand.navy} />
        <path
          d="M55 72 L59 76 L66 68"
          fill="none"
          stroke={brand.cream}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        // The svg already carries the accessible name, so the visible text is hidden from screen readers.
        <span
          aria-hidden="true"
          style={{
            fontFamily: fonts.display,
            fontWeight: 600,
            fontSize: size * 0.5,
            lineHeight: 1,
          }}
        >
          <span>Crusty</span> <span style={{ color: brand.crust }}>Krustees</span>
        </span>
      )}
    </span>
  );
}
