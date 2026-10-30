import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_CUSTOMER, dbContainerName, demoErrorMessage } from './dev-demo.mjs';

const sql = readFileSync(new URL('./dev-demo.sql', import.meta.url), 'utf8');

describe('dev:demo', () => {
  it('finds the local database container from the project id', () => {
    expect(dbContainerName('[api]\nproject_id = "clientshield"\n')).toBe(
      'supabase_db_clientshield',
    );
    expect(() => dbContainerName('nothing here')).toThrow(/project_id/);
  });

  it('passes the email as a psql variable, never pasted into the SQL', () => {
    expect(sql).toContain(":'email'");
    expect(sql).not.toMatch(/\$\{|%s/);
  });

  it('stops on the first error and runs as one transaction', () => {
    expect(sql).toMatch(/\\set ON_ERROR_STOP on/);
    expect(sql).toMatch(/^begin;/m);
    expect(sql).toMatch(/^commit;/m);
  });

  it('makes the sample customer match the demo incident on two details', () => {
    expect(sql).toContain(`'${DEMO_CUSTOMER.name}'`);
    expect(sql).toContain('+12065550142');
    expect(DEMO_CUSTOMER.phone.replace(/\D/g, '')).toBe('2065550142');
    expect(sql).toContain('private.store_identifiers');
  });

  it('can be run again without making duplicates', () => {
    const inserts = sql.match(/^insert into /gm)?.length ?? 0;
    const guarded = (sql.match(/on conflict|where not exists/g) ?? []).length;
    expect(guarded).toBeGreaterThanOrEqual(inserts);
  });

  it('explains problems in plain words', () => {
    expect(demoErrorMessage('ERROR:  NO_BUSINESS')).toMatch(/create the business first/);
    expect(demoErrorMessage('Error: No such container: supabase_db_x')).toMatch(/Docker/);
    expect(demoErrorMessage('ERROR: relation does not exist')).toMatch(/migration up/);
  });
});
