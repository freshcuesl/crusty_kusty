import type { Plugin } from 'vite';

export interface SecurityHeaderOptions {
  supabaseUrl?: string | undefined;
  sentryDsn?: string | undefined;
  admin?: boolean;
  webAnalytics?: boolean;
}

export function cspSources(options: Omit<SecurityHeaderOptions, 'admin'>): {
  connect: string[];
  img: string[];
};
export function buildSecurityHeaders(options: SecurityHeaderOptions): string;
export function securityHeaders(options: SecurityHeaderOptions): Plugin;
