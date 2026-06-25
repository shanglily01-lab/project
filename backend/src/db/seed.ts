// ─── Roster seed ──────────────────────────────────────
// Inserts the ROSTER into ops_person_identity. Idempotent.
//   npm run db:seed

import { sql } from 'drizzle-orm';
import { db, queryClient } from './client.js';
import { opsPersonIdentity } from '../ontology/schema.js';
import { ROSTER } from '../ontology/roster.js';

async function seed() {
  for (const p of ROSTER) {
    await db
      .insert(opsPersonIdentity)
      .values({
        personId: p.personId,
        name: p.name,
        opName: p.opName,
        gitEmails: p.gitEmails,
        iamArn: p.iamArn ?? null,
        active: p.active,
      })
      .onDuplicateKeyUpdate({
        set: {
          name: p.name,
          opName: p.opName,
          gitEmails: p.gitEmails,
          iamArn: p.iamArn ?? null,
          active: p.active,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }
  console.log(`Seeded/updated ${ROSTER.length} people in ops_person_identity`);
  await queryClient.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
