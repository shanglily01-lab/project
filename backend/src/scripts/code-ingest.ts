// ─── CodeCommit ingest (persist) ──────────────────────
// Scans watched repos and persists per-person-per-day code activity to
// ops_code_daily.  npm run code:ingest [days]
import { loadEnv } from './env.js';
import { ingestCodeCommit } from '../pipeline.js';
import { queryClient } from '../db/client.js';

loadEnv();

async function main() {
  const days = parseInt(process.argv[2] || '14', 10);
  const sinceMs = Date.now() - days * 86_400_000;
  console.log(`Ingesting CodeCommit, last ${days} days (read-only)…`);
  const r = await ingestCodeCommit({ sinceMs });
  console.log(`✓ ${r.scannedCommits} commits · ${r.matchedPeople} people · ${r.rows} code-daily rows`);
  await queryClient.end();
}

main().catch((err) => {
  console.error('✗ code:ingest failed:', err.message ?? err);
  process.exit(1);
});
