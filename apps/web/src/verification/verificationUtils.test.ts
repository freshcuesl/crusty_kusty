import { describe, expect, it } from 'vitest';
import { checkDocumentFile, storagePathFor } from './verificationUtils';

describe('checkDocumentFile', () => {
  const file = (name: string, type: string, size: number) =>
    new File([new Uint8Array(size)], name, { type });

  it('accepts PDFs and photos up to 10 MB', () => {
    expect(checkDocumentFile(file('license.pdf', 'application/pdf', 1000))).toBeNull();
    expect(checkDocumentFile(file('photo.jpg', 'image/jpeg', 1000))).toBeNull();
    expect(checkDocumentFile(file('photo.heic', 'image/heic', 1000))).toBeNull();
  });

  it('refuses other file types', () => {
    expect(checkDocumentFile(file('notes.docx', 'application/msword', 10))).toBe(
      'Upload a PDF or a photo (JPG, PNG, WEBP or HEIC).',
    );
  });

  it('refuses files over 10 MB', () => {
    expect(checkDocumentFile(file('huge.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toBe(
      'That file is over 10 MB. Try a smaller photo or a scanned PDF.',
    );
  });

  it('refuses empty files', () => {
    expect(checkDocumentFile(file('empty.pdf', 'application/pdf', 0))).toBe('That file is empty.');
  });
});

describe('storagePathFor', () => {
  it('stores files in the business folder under a random name', () => {
    const path = storagePathFor('b1', 'My License (2026).PDF', () => 'abc-123');
    expect(path).toBe('b1/abc-123.pdf');
  });

  it('keeps no extension when the file has none', () => {
    expect(storagePathFor('b1', 'scan', () => 'abc')).toBe('b1/abc');
  });
});
