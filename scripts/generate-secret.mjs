#!/usr/bin/env node
// Prints a long random secret, for example PURGE_FILES_SECRET.
// Usage: npm run generate-secret
import { randomBytes } from 'node:crypto';

console.log(randomBytes(32).toString('base64url'));
