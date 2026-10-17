// Plain-language labels for incident values, shared by the app and the admin panel.

export type IncidentCategory =
  | 'false_workmanship_complaint'
  | 'refund_after_completed_service'
  | 'chargeback'
  | 'threatened_bad_review'
  | 'repeated_callbacks_no_defect'
  | 'fraud'
  | 'other_documented_dispute';

export type IncidentStatus = 'draft' | 'submitted' | 'needs_info' | 'evidence_verified' | 'rejected';

export type EvidenceKind =
  | 'before_after_photo'
  | 'invoice'
  | 'work_authorization'
  | 'customer_messages'
  | 'technician_notes'
  | 'inspection_results'
  | 'refund_documentation'
  | 'review_screenshot'
  | 'other';

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  false_workmanship_complaint: 'False workmanship complaint',
  refund_after_completed_service: 'Refund demanded after completed service',
  chargeback: 'Chargeback',
  threatened_bad_review: 'Threatened or posted bad review',
  repeated_callbacks_no_defect: 'Repeated callbacks with no verified defect',
  fraud: 'Fraud',
  other_documented_dispute: 'Other documented dispute',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  draft: 'Draft',
  submitted: 'Waiting for review',
  needs_info: 'Needs more info',
  evidence_verified: 'Evidence verified',
  rejected: 'Not verified',
};

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  before_after_photo: 'Before and after photos',
  invoice: 'Invoice',
  work_authorization: 'Signed work authorization',
  customer_messages: 'Customer messages',
  technician_notes: 'Technician notes',
  inspection_results: 'Inspection results',
  refund_documentation: 'Refund documentation',
  review_screenshot: 'Review screenshot',
  other: 'Other',
};

export const INCIDENT_EVENT_LABELS: Record<string, string> = {
  created: 'Report started',
  updated: 'Details updated',
  evidence_added: 'Evidence added',
  evidence_removed: 'Evidence removed',
  submitted: 'Submitted for review',
  evidence_verified: 'Evidence verified',
  needs_info: 'Asked for more info',
  rejected: 'Not verified',
};
