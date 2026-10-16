export type IdentityStatus = 'requires_input' | 'processing' | 'verified' | 'canceled';

export interface IdentityCheck {
  status: IdentityStatus;
  last_error_code: string | null;
  updated_at: string;
}

/** Verified if any attempt passed; otherwise the newest attempt (rows arrive newest first). */
export function currentIdentity(checks: IdentityCheck[]): IdentityCheck | null {
  return checks.find((c) => c.status === 'verified') ?? checks[0] ?? null;
}

// Stripe Identity last_error codes, in plain words.
const REASONS: Record<string, string> = {
  consent_declined: 'You declined the identity check.',
  document_expired: 'Your ID has expired. Use a current one.',
  document_type_not_supported: "Use a driver's license, passport or state ID card.",
  document_unverified_other: "Stripe couldn't verify that document. Try a clearer photo.",
  selfie_document_missing_photo: "Your ID doesn't show a photo. Use a different ID.",
  selfie_face_mismatch: "The selfie didn't match the photo on your ID.",
  selfie_manipulated: 'The selfie looked edited. Take a new live selfie.',
  selfie_unverified_other: "Stripe couldn't verify the selfie. Try again in good light.",
  under_supported_age: 'Business owners must be adults.',
  country_not_supported: "Stripe can't check IDs from that country yet.",
};

export function identityReason(code: string | null): string {
  return (code && REASONS[code]) || "Stripe couldn't verify your ID.";
}
