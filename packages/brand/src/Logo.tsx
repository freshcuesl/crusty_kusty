import { brand, fonts } from './tokens';

export interface LogoProps {
  /** Height of the shield in pixels. */
  size?: number;
  /** Show the "ClientShield" wordmark beside the shield. */
  withWordmark?: boolean;
  /** Hide from screen readers when a visible label already names the app. */
  decorative?: boolean;
  /** Set when the logo sits on a dark surface (the midnight header), for contrast. */
  onDark?: boolean;
}

const NAME = 'ClientShield';

/** The ClientShield mark: a shield holding a "C", with a teal "verified" dot. */
export function Logo({
  size = 40,
  withWordmark = false,
  decorative = false,
  onDark = false,
}: LogoProps) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': NAME };
  const shield = onDark ? brand.mist : brand.midnight;
  const letter = onDark ? brand.midnight : brand.mist;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.25 }}>
      <svg
        width={Math.round(size * (100 / 114))}
        height={size}
        viewBox="0 0 100 114"
        focusable="false"
        {...a11y}
      >
        <path
          data-part="shield"
          d="M50 4 L92 18 V54 C92 82 74 100 50 110 C26 100 8 82 8 54 V18 Z"
          fill={shield}
        />
        <path
          d="M66 40 A20 20 0 1 0 66 70"
          fill="none"
          stroke={letter}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle cx="70" cy="55" r="6" fill={brand.teal} />
      </svg>
      {withWordmark && (
        // The svg already carries the accessible name, so the visible text is hidden from screen readers.
        <span
          aria-hidden="true"
          style={{
            fontFamily: fonts.display,
            fontWeight: 700,
            fontSize: size * 0.52,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          <span>Client</span>
          <span style={{ color: onDark ? brand.teal : brand.tealDark }}>Shield</span>
        </span>
      )}
    </span>
  );
}
