// Minimal .env loader (no dependency). Loads backend/.env into process.env
// without overriding values already present in the environment.
import { readFileSync } from 'node:fs';

export function loadEnv(): void {
  try {
    const txt = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // no .env file — rely on real environment
  }
}
