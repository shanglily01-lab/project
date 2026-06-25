// ─── Git email aliases ────────────────────────────────
// People often commit under git emails that differ from their primary email
// (personal domains, user@hostname defaults, etc). Map each person's PRIMARY
// email (lowercased) → the extra git emails seen in CodeCommit so that commits
// attribute to the right person. `seed:op` merges these into the roster.
//
// MAINTAIN THIS by hand. Example shape below — replace with your own.

export const GIT_ALIASES: Record<string, string[]> = {
  // 'alice@example.com': ['alice@personal.example', 'alice@alices-laptop.local'],
  // 'bob@example.com':   ['bob.builder@example.org'],
};

export function aliasesFor(primaryEmail: string): string[] {
  return GIT_ALIASES[primaryEmail.trim().toLowerCase()] ?? [];
}
