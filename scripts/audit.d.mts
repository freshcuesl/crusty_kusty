export interface AllowEntry {
  id: string;
  package: string;
  reason: string;
  expires: string;
}
export interface Finding {
  package: string;
  severity: string;
  ids: string[];
  titles: string[];
}
export function findingsFrom(report: unknown): Finding[];
export function blockingFindings(
  findings: Finding[],
  allowlist: AllowEntry[],
  today: Date,
): Finding[];
export function expiredEntries(allowlist: AllowEntry[], today: Date): AllowEntry[];
