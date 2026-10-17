export type AbuseFlagKind =
  'high_check_volume' | 'many_unsaved_checks' | 'high_report_volume' | 'repeated_rejections';

/** What each flag means and what a moderator should look for. */
export const ABUSE_FLAGS: Record<AbuseFlagKind, { label: string; lookFor: string }> = {
  high_check_volume: {
    label: 'Many customer checks',
    lookFor:
      'Over 100 checks in a day. Compare with the size of the business: bulk lookups that do not match real bookings are not allowed.',
  },
  many_unsaved_checks: {
    label: 'Checks of unsaved people',
    lookFor:
      'Many checks of people never saved as customers can mean someone is searching for people rather than checking bookings.',
  },
  high_report_volume: {
    label: 'Many incident reports',
    lookFor:
      'Ten or more reports in a week. Check they describe different, real jobs and are not one dispute reported many times.',
  },
  repeated_rejections: {
    label: 'Repeated rejected reports',
    lookFor:
      'Three or more reports rejected in 90 days. Look for a pattern of weak or retaliatory reports.',
  },
};

export function flagLabel(kind: unknown): string {
  return ABUSE_FLAGS[kind as AbuseFlagKind]?.label ?? String(kind);
}
