// ─── Seed person_identity from OpenProject users ──────
// Fetches all OP users (name + email), filters out bots/teams/system accounts,
// and upserts everyone into ops_person_identity. Existing people are matched by
// email so their personId (and score history) is preserved; new people get the
// next id. gitEmails default to the OP email (refine when CodeCommit lands).
//   npm run seed:op

import { loadEnv } from './env.js';
import * as repo from '../db/repository.js';
import { normalizeEmail, isBotAuthor } from '../ontology/identity.js';
import { aliasesFor } from '../config/git-aliases.js';
import { queryClient } from '../db/client.js';

loadEnv();

const OP_TARGET = process.env.OP_TARGET || '';
const OP_TOKEN = process.env.OP_TOKEN || '';

interface OpUser { id: number; name: string; email?: string; status?: string }

function authHeader() {
  return { Authorization: 'Basic ' + Buffer.from('apikey:' + OP_TOKEN).toString('base64') };
}

/** Full user list — requires an ADMIN api key. Non-admin tokens get 403, in
 *  which case the caller falls back to deriving the roster from task people. */
async function fetchUsers(): Promise<OpUser[]> {
  let offset = 1;
  let total = Infinity;
  const all: OpUser[] = [];
  while (all.length < total) {
    const resp = await fetch(`${OP_TARGET}/api/v3/users?pageSize=200&offset=${offset}`, { headers: authHeader() });
    if (!resp.ok) throw new Error(`users API ${resp.status}`);
    const data = (await resp.json()) as { total: number; _embedded?: { elements?: OpUser[] } };
    total = data.total;
    const els = data._embedded?.elements ?? [];
    all.push(...els);
    offset++;
    if (els.length === 0) break;
  }
  return all;
}

/** Fallback roster source when the admin users endpoint is forbidden: the
 *  distinct people who actually appear on work packages (assignee ∪ author).
 *  No emails are available this way (admin-only), so gitEmails stays empty —
 *  fill later via config/git-aliases. */
async function deriveFromTasks(): Promise<OpUser[]> {
  const tasks = await repo.getAllTasks();
  const names = new Set<string>();
  for (const t of tasks) {
    if (t.assignee && t.assignee !== 'Unassigned') names.add(t.assignee);
    if (t.author && t.author !== 'Unassigned') names.add(t.author);
  }
  return [...names].sort().map((name, i) => ({ id: i + 1, name, status: 'active' }));
}

/** Real person? exclude bots/teams. Email-based checks only apply when present. */
function nameIsPerson(name: string): boolean {
  if (isBotAuthor(name)) return false;
  if (/\bteam\b/i.test(name)) return false;
  return true;
}

/** Real person? exclude bots, teams, and non-company / system accounts.
 *  Set COMPANY_EMAIL_DOMAIN to restrict to your org's email domain. */
function isPerson(u: OpUser): boolean {
  const email = u.email ?? '';
  const companyDomain = process.env.COMPANY_EMAIL_DOMAIN || '';
  if (companyDomain && !email.endsWith(`@${companyDomain}`)) return false;
  if (isBotAuthor(email) || isBotAuthor(u.name)) return false;
  if (/\bteam\b/i.test(u.name)) return false; // group mailbox
  return true;
}

async function main() {
  if (!OP_TOKEN) { console.error('✗ Missing OP_TOKEN'); process.exit(1); }

  // prefer the authoritative users endpoint; fall back to task people if the
  // token isn't admin (403) so a non-admin key can still build the roster
  let users: OpUser[];
  let source: string;
  try {
    users = (await fetchUsers()).filter(isPerson).sort((a, b) => a.id - b.id);
    source = 'users endpoint';
  } catch (err) {
    console.warn(`⚠ users endpoint unavailable (${(err as Error).message}); deriving roster from task assignees/authors`);
    users = (await deriveFromTasks()).filter((u) => nameIsPerson(u.name));
    source = 'task people';
  }

  const existing = await repo.getRoster();
  const byEmail = new Map<string, number>();
  const byOpName = new Map<string, number>();
  const emailsOf = new Map<number, string[]>(); // personId → existing gitEmails (never clobber)
  for (const p of existing) {
    for (const e of p.gitEmails) byEmail.set(normalizeEmail(e), p.personId);
    byOpName.set(p.opName, p.personId);
    emailsOf.set(p.personId, p.gitEmails);
  }
  let maxId = existing.reduce((m, p) => Math.max(m, p.personId), 0);

  let created = 0;
  let updated = 0;
  for (const u of users) {
    const email = u.email ? normalizeEmail(u.email) : '';
    // match an existing person by email when we have one, else by OP display
    // name — preserves personId (and score history) across re-syncs
    let personId = (email ? byEmail.get(email) : undefined) ?? byOpName.get(u.name);
    if (personId === undefined) {
      personId = ++maxId;
      created++;
    } else {
      updated++;
    }
    if (email) byEmail.set(email, personId);
    byOpName.set(u.name, personId);
    // merge, never clobber: keep any emails this person already had (esp. when
    // deriving from tasks, where OP gives us no email at all)
    const gitEmails = [...new Set([
      ...(emailsOf.get(personId) ?? []),
      ...(email ? [email, ...aliasesFor(email)] : []),
    ])];
    await repo.upsertIdentity({
      personId,
      name: u.name,
      opName: u.name,
      gitEmails,
      iamArn: null,
      active: u.status === 'active',
    });
  }

  console.log(`✓ Roster synced from OpenProject (${source}): ${created} new, ${updated} updated, ${users.length} total people`);
  await queryClient.end();
}

main().catch((err) => {
  console.error('✗ seed:op failed:', err.message ?? err);
  process.exit(1);
});
