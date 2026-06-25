// ─── OpenProject ingest ───────────────────────────────
//   npm run op:ingest
import { loadEnv } from './env.js';
import { ingestOpenProject, today } from '../pipeline.js';
import { queryClient } from '../db/client.js';

loadEnv();

async function main() {
  const date = today();
  console.log(`Ingesting OpenProject for ${date} ...`);
  const { tasks, projects } = await ingestOpenProject(date);

  console.log(`✓ Upserted ${tasks} tasks, ${projects.length} project-daily rows\n`);
  console.log('Project'.padEnd(22), 'tasks  ip  blk  new  avg%  Δ    health');
  for (const d of projects) {
    console.log(
      d.projectName.padEnd(22),
      String(d.totalTasks).padStart(4),
      String(d.inProgress).padStart(4),
      String(d.blocked).padStart(4),
      String(d.newTasks).padStart(4),
      String(d.avgPct).padStart(5),
      String(d.pctDelta ?? '—').padStart(4),
      ` ${d.health}`,
    );
  }
  await queryClient.end();
}

main().catch((err) => {
  console.error('✗ Ingest failed:', err.message ?? err);
  process.exit(1);
});
