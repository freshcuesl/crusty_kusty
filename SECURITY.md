# Security

## Reporting a problem

Please don't open a public issue for security problems. Email the maintainer at the address on
the GitHub profile of `freshcuesl`, with steps to reproduce.

## Principles

See the security model in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model).

## Known and accepted risks

| Date       | Package                                                            | Severity                       | Why accepted                                                                                                                                                                                        | Revisit                                                          |
| ---------- | ------------------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2026-09-27 | `decode-uri-component` ≤0.4.2 (via `react-admin` → `query-string`) | Moderate (GHSA-vcc3-ghjq-m6fr) | Only the admin panel uses it, in the admin's own browser. The worst case is one tab freezing on a crafted URL. The patched release is ESM-only and would break `query-string`'s CommonJS `require`. | When react-admin updates `query-string`; Dependabot will flag it |

CI fails on any **high** or **critical** audit finding (`npm run audit`).
