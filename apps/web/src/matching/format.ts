export type AlertDecision = 'continue_booking' | 'require_authorization' | 'decline_job';

export const DECISION_LABELS: Record<AlertDecision, string> = {
  continue_booking: 'Continue booking',
  require_authorization: 'Require additional authorization',
  decline_job: 'Decline job',
};

/** "2026-03" → "March 2026" */
export function formatMonth(yyyyMm: string | null): string {
  if (!yyyyMm) return '';
  const [year, month] = yyyyMm.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
