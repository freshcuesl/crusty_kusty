import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, EVIDENCE_LABELS, INCIDENT_STATUS_LABELS } from './incidentLabels';

// Must stay in step with the enums in supabase/migrations/20261018000000_incidents.sql.
describe('incident labels', () => {
  it('cover every dispute category from the product spec', () => {
    expect(Object.keys(CATEGORY_LABELS)).toEqual([
      'false_workmanship_complaint',
      'refund_after_completed_service',
      'chargeback',
      'threatened_bad_review',
      'repeated_callbacks_no_defect',
      'fraud',
      'other_documented_dispute',
    ]);
  });

  it('cover every status and evidence type', () => {
    expect(Object.keys(INCIDENT_STATUS_LABELS)).toHaveLength(6); // + expired (20261020000000_retention_statuses.sql)
    expect(Object.keys(EVIDENCE_LABELS)).toHaveLength(9);
  });

  it('never call anyone a bad customer', () => {
    const all = [
      ...Object.values(CATEGORY_LABELS),
      ...Object.values(INCIDENT_STATUS_LABELS),
      ...Object.values(EVIDENCE_LABELS),
    ].join(' ');
    expect(all).not.toMatch(/bad customer|blacklist|scam/i);
  });
});
