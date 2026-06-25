// ─── List CodeCommit repos vs watchlist (curation helper) ──
// Read-only: only calls ListRepositories. Shows which repos are watched.
//   npm run repos:list
import { loadEnv } from './env.js';
import { CodeCommitReadClient } from '../adapters/codecommit-client.js';
import { REPO_WATCH, isWatched } from '../config/repo-watch.js';

loadEnv();

async function main() {
  const client = new CodeCommitReadClient();
  const repos = await client.listRepositories();

  const watched = repos.filter(isWatched);
  const unwatched = repos.filter((r) => !isWatched(r));

  console.log(`\n${repos.length} repos total · ${watched.length} watched · ${unwatched.length} not watched\n`);
  console.log('── WATCHED ──');
  for (const w of REPO_WATCH) {
    const exists = repos.includes(w.repo) ? '' : '  ⚠ not found in account';
    console.log(`  ${w.active ? '●' : '○'} ${w.repo.padEnd(34)} → ${w.project ?? '(no project)'}${exists}`);
  }
  console.log('\n── NOT WATCHED (sample, edit src/config/repo-watch.ts to add) ──');
  for (const r of unwatched.slice(0, 60)) console.log(`    ${r}`);
  if (unwatched.length > 60) console.log(`    … and ${unwatched.length - 60} more`);
}

main().catch((err) => {
  console.error('✗ repos:list failed:', err.message ?? err);
  process.exit(1);
});
