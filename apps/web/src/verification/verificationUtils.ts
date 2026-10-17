export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

/** Returns a plain-language problem with the file, or null when it can be uploaded. */
export function checkDocumentFile(file: File, maxBytes = MAX_DOCUMENT_BYTES): string | null {
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
    return 'Upload a PDF or a photo (JPG, PNG, WEBP or HEIC).';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `That file is over ${mb} MB. Try a smaller photo or a scanned PDF.`;
  }
  return null;
}

/**
 * Builds <business id>/<random>.<ext>. The original name is kept only in the
 * database, so names can't collide or reveal anything in storage paths.
 */
export function storagePathFor(
  businessId: string,
  fileName: string,
  randomId: () => string = () => crypto.randomUUID(),
): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1]?.toLowerCase();
  return `${businessId}/${randomId()}${ext ? `.${ext}` : ''}`;
}
