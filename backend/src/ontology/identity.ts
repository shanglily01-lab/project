// ─── Identity Resolution ──────────────────────────────
// Maps a person across sources: CodeCommit git email / IAM ARN ↔ OpenProject
// display name. Spec: docs/PRODUCTIVITY-SCORING-DESIGN.md §12.1

export interface PersonIdentity {
  personId: number;
  name: string;
  opName: string;
  gitEmails: string[];
  iamArn?: string | null;
  active: boolean;
}

export interface IdentityIndex {
  byEmail: Map<string, PersonIdentity>;
  byOpName: Map<string, PersonIdentity>;
  byIam: Map<string, PersonIdentity>;
}

export interface PersonRef {
  gitEmail?: string;
  opName?: string;
  iamArn?: string;
}

const BOT_PATTERNS = [/\bbot\b/i, /\[bot\]/i, /noreply/i, /no-reply/i, /jenkins/i];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isBotAuthor(emailOrName: string): boolean {
  return BOT_PATTERNS.some((re) => re.test(emailOrName));
}

export function buildIdentityIndex(roster: PersonIdentity[]): IdentityIndex {
  const byEmail = new Map<string, PersonIdentity>();
  const byOpName = new Map<string, PersonIdentity>();
  const byIam = new Map<string, PersonIdentity>();

  for (const p of roster) {
    for (const e of p.gitEmails) {
      if (e && e.trim()) byEmail.set(normalizeEmail(e), p);
    }
    if (p.opName && p.opName.trim()) byOpName.set(p.opName.trim(), p);
    if (p.iamArn && p.iamArn.trim()) byIam.set(p.iamArn.trim(), p);
  }

  return { byEmail, byOpName, byIam };
}

const UNRESOLVABLE_OP_NAMES = new Set(['Unassigned', 'Unknown']);

export function resolvePerson(index: IdentityIndex, ref: PersonRef): PersonIdentity | null {
  if (ref.gitEmail && !isBotAuthor(ref.gitEmail)) {
    const p = index.byEmail.get(normalizeEmail(ref.gitEmail));
    if (p) return p;
  }
  if (ref.iamArn) {
    const p = index.byIam.get(ref.iamArn.trim());
    if (p) return p;
  }
  if (ref.opName) {
    const t = ref.opName.trim();
    if (!UNRESOLVABLE_OP_NAMES.has(t)) {
      const p = index.byOpName.get(t);
      if (p) return p;
    }
  }
  return null;
}
