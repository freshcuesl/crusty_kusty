export const STATUS_LABELS: Record<string, string> = {
  unverified: 'Not submitted',
  pending: 'Waiting for review',
  needs_info: 'Needs more info',
  rejected: 'Rejected',
  verified: 'Verified',
  suspended: 'Suspended',
};

export const STATUS_COLORS: Record<string, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  unverified: 'default',
  pending: 'info',
  needs_info: 'warning',
  rejected: 'error',
  verified: 'success',
  suspended: 'error',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  business_license: 'Business license',
  ein_letter: 'EIN letter from the IRS',
  insurance_certificate: 'Certificate of insurance',
};

export const EVENT_LABELS: Record<string, string> = {
  details_updated: 'Details updated',
  document_added: 'Document added',
  document_removed: 'Document removed',
  submitted: 'Submitted for review',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_info: 'Asked for more info',
};
