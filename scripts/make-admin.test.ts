import { describe, expect, it } from 'vitest';
import { assertLocalUrl, parseMakeAdminArgs } from './make-admin.mjs';

describe('parseMakeAdminArgs', () => {
  it('defaults to the moderator role', () => {
    expect(parseMakeAdminArgs(['Mod@Krustees.test'])).toEqual({
      email: 'mod@krustees.test',
      role: 'moderator',
    });
  });

  it('accepts --admin for full admins', () => {
    expect(parseMakeAdminArgs(['boss@krustees.test', '--admin'])).toEqual({
      email: 'boss@krustees.test',
      role: 'admin',
    });
  });

  it('explains how to use it when the email is missing or invalid', () => {
    expect(() => parseMakeAdminArgs([])).toThrow(/npm run make-admin -- you@example.com/);
    expect(() => parseMakeAdminArgs(['not-an-email'])).toThrow(/npm run make-admin/);
  });
});

describe('assertLocalUrl', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321'])('allows %s', (url) => {
    expect(() => assertLocalUrl(url)).not.toThrow();
  });

  it('refuses to touch a hosted project', () => {
    expect(() => assertLocalUrl('https://abcd.supabase.co')).toThrow(/local/);
  });
});
