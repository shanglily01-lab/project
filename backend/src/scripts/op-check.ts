// ─── OpenProject connectivity check ───────────────────
// Connects to the real OpenProject instance, summarizes what it sees, and
// cross-checks live assignees against the ROSTER identity mapping.
//   npm run op:check        (reads OP_TARGET / OP_TOKEN from backend/.env)

import { loadEnv } from './env.js';
import { OpenProjectAdapter } from '../adapters/openproject-adapter.js';
import { buildIdentityIndex, resolvePerson } from '../ontology/identity.js';
import { ROSTER } from '../ontology/roster.js';

loadEnv();

const OP_TARGET = process.env.OP_TARGET || '';
const OP_TOKEN = process.env.OP_TOKEN || '';

function tally(values: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function printTally(title: string, rows: [string, number][]) {
  console.log(`\n${title}`);
  for (const [k, n] of rows) console.log(`  ${String(n).padStart(4)}  ${k}`);
}

async function main() {
  if (!OP_TOKEN) {
    console.error('✗ Missing OP_TOKEN. Put it in backend/.env (OP_TOKEN=...) then re-run.');
    process.exit(1);
  }

  const adapter = new OpenProjectAdapter({
    baseUrl: `${OP_TARGET}/api/v3`,
    token: OP_TOKEN,
    pollIntervalMs: 0,
  });

  console.log(`Connecting to ${OP_TARGET} ...`);
  const { tasks, relations } = await adapter.poll();
  console.log(`✓ Connected — ${tasks.length} work packages, ${relations.length} relations`);

  printTally('By status:', tally(tasks.map((t) => t.statusName)));
  printTally('By project:', tally(tasks.map((t) => t.projectName)));

  const byAssignee = tally(tasks.map((t) => t.assignee));
  printTally('By assignee:', byAssignee);

  // ─── roster cross-check (validates identity mapping on real data) ───
  const index = buildIdentityIndex(ROSTER);
  const assignees = [...new Set(tasks.map((t) => t.assignee))];
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const a of assignees) {
    const p = resolvePerson(index, { opName: a });
    if (p) mapped.push(`${a} → #${p.personId} ${p.name}`);
    else unmapped.push(a);
  }
  console.log(`\nRoster mapping: ${mapped.length} matched, ${unmapped.length} unmatched`);
  for (const m of mapped) console.log(`  ✓ ${m}`);
  for (const u of unmapped) console.log(`  ✗ ${u}  (no roster match — Unassigned/Unknown are expected)`);
}

main().catch((err) => {
  console.error('✗ OpenProject check failed:', err.message ?? err);
  process.exit(1);
});
