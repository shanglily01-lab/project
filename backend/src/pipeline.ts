// ─── Data ingestion pipeline ──────────────────────────
// Pulls project-tracking data from the source systems and persists it:
//   • ingestOpenProject        — work packages + relations + per-project daily
//   • ingestCodeCommit         — per-person-per-day code activity (read-only)
//   • ingestOpenProjectActivity— OpenProject journal events (edit timeline)
//
// Data-acquisition core: fetch from the source systems and persist. Higher-level
// analytics are not part of this distribution — see README.

import { commitDayLocal } from './adapters/codecommit-adapter.js';
import { OpenProjectAdapter } from './adapters/openproject-adapter.js';
import { buildIdentityIndex, resolvePerson } from './ontology/identity.js';
import { ROSTER } from './ontology/roster.js';
import { computeProjectDaily, type ProjectDaily } from './ontology/project-daily.js';
import { CodeCommitReadClient } from './adapters/codecommit-client.js';
import { scanRepos, type ScannedCommit } from './adapters/codecommit-ingest.js';
import { watchedRepos } from './config/repo-watch.js';
import { assessPersonDay, assessCommit, extractTaskRefs } from './adapters/commit-quality.js';
import { OpenProjectJournalsAdapter } from './adapters/openproject-journals-adapter.js';
import * as repo from './db/repository.js';

/** Today's date in the ingestion timezone (Asia/Shanghai). */
export function today(): string {
  return commitDayLocal(new Date().toISOString());
}

// ─── OpenProject work packages ───────────────────────

export interface IngestResult {
  tasks: number;
  projects: ProjectDaily[];
}

export async function ingestOpenProject(date: string): Promise<IngestResult> {
  const OP_TARGET = process.env.OP_TARGET || '';
  const OP_TOKEN = process.env.OP_TOKEN || '';
  if (!OP_TARGET) throw new Error('Missing OP_TARGET (set it in backend/.env)');
  if (!OP_TOKEN) throw new Error('Missing OP_TOKEN (set it in backend/.env)');

  const adapter = new OpenProjectAdapter({
    baseUrl: `${OP_TARGET}/api/v3`,
    token: OP_TOKEN,
    pollIntervalMs: 0,
  });

  const { tasks, relations } = await adapter.poll();
  const taskCount = await repo.upsertTasks(tasks);
  await repo.upsertRelations(relations);
  const prev = await repo.getPrevAvgPct(date);
  const projects = computeProjectDaily(tasks, date, prev);
  await repo.upsertProjectDaily(projects);
  return { tasks: taskCount, projects };
}

// ─── CodeCommit ingest (read-only) ───────────────────

export interface CodeIngestResult {
  scannedCommits: number;
  matchedPeople: number;
  rows: number;
}

/** Scan watched repos, attribute commits to people, persist per-person-per-day
 *  code activity (commit counts, line deltas, task-link refs) to ops_code_daily. */
export async function ingestCodeCommit(opts: { sinceMs: number; maxCommitsPerRepo?: number }): Promise<CodeIngestResult> {
  const roster = await repo.getRoster();
  const index = buildIdentityIndex(roster);
  const client = new CodeCommitReadClient();
  const repos = watchedRepos().map((w) => w.repo);

  const scanned = await scanRepos(client, repos, {
    sinceMs: opts.sinceMs,
    maxCommitsPerRepo: opts.maxCommitsPerRepo ?? 60,
  });

  // valid OpenProject task ids → a commit↔task link is only credited if real
  const validTaskIds = new Set((await repo.getAllTasks()).map((t) => t.id));

  // group by (personId, local day)
  const groups = new Map<string, { personId: number; day: string; commits: ScannedCommit[] }>();
  // Raw per-commit events retain the git timestamp the daily rollup discards.
  // Deduped by sha — idempotent across re-scans.
  const eventsBySha = new Map<string, repo.CommitEventRow>();
  for (const c of scanned) {
    const person = resolvePerson(index, { gitEmail: c.email });
    if (!person) continue;
    if (c.hash) {
      const ref = extractTaskRefs(c.input.message).find((r) => validTaskIds.has(r));
      eventsBySha.set(c.hash, {
        personId: person.personId, repo: c.repo, sha: c.hash,
        committedAt: new Date(c.dateMs), day: c.day,
        taskLinked: ref !== undefined,
        linkedTaskId: ref ?? null,
        messageSubject: c.input.message.split('\n')[0].slice(0, 200),
      });
    }
    const key = `${person.personId}|${c.day}`;
    const g = groups.get(key) ?? { personId: person.personId, day: c.day, commits: [] };
    g.commits.push(c);
    groups.set(key, g);
  }

  const rows = [...groups.values()].map((g) => {
    const q = assessPersonDay(g.commits.map((c) => c.input), { validTaskIds });
    const sampleMessages = g.commits
      .filter((c) => assessCommit(c.input).substantive)
      .map((c) => c.input.message.split('\n')[0].slice(0, 100))
      .slice(0, 6);
    return {
      personId: g.personId,
      date: g.day,
      commits: q.commits,
      substantiveCommits: q.substantiveCommits,
      rawLoc: q.rawLoc,
      effectiveLoc: q.effectiveLoc,
      taskLinkedCommits: q.taskLinkedCommits,
      confidence: q.confidence,
      flags: q.flags,
      sampleMessages,
      repos: [...new Set(g.commits.map((c) => c.repo))],
    };
  });

  const n = await repo.upsertCodeDaily(rows);
  await repo.upsertCommitEvents([...eventsBySha.values()]);
  return { scannedCommits: scanned.length, matchedPeople: new Set(rows.map((r) => r.personId)).size, rows: n };
}

// ─── OpenProject journal events (edit timeline) ──────

/**
 * Pull OpenProject journal events (real edit time + actor) for work packages
 * touched in the window, attribute to people, and persist to ops_activity_events.
 */
export async function ingestOpenProjectActivity(opts: { sinceMs: number; maxWorkPackages?: number }): Promise<{ workPackages: number; events: number; unattributed: number }> {
  const OP_TARGET = process.env.OP_TARGET || '';
  const OP_TOKEN = process.env.OP_TOKEN || '';
  if (!OP_TARGET) throw new Error('Missing OP_TARGET (set it in backend/.env)');
  if (!OP_TOKEN) throw new Error('Missing OP_TOKEN (set it in backend/.env)');

  const roster = await repo.getRoster();
  const index = buildIdentityIndex(roster.length ? roster : ROSTER);
  const tasks = await repo.getAllTasks();
  const recent = tasks
    .filter((t) => t.updatedAt && new Date(t.updatedAt).getTime() >= opts.sinceMs)
    .slice(0, opts.maxWorkPackages ?? 400);

  const adapter = new OpenProjectJournalsAdapter({ baseUrl: `${OP_TARGET}/api/v3`, token: OP_TOKEN });
  const rows: repo.ActivityEventRow[] = [];
  let unattributed = 0;
  for (const t of recent) {
    const evs = await adapter.fetchActivities(t.id, opts.sinceMs);
    for (const e of evs) {
      const person = e.userName ? resolvePerson(index, { opName: e.userName }) : null;
      if (!person) { unattributed++; continue; }
      rows.push({ personId: person.personId, taskId: e.taskId, journalId: e.journalId, activityAt: new Date(e.activityAt), day: commitDayLocal(e.activityAt), kind: 'edit' });
    }
  }
  const events = await repo.upsertActivityEvents(rows);
  return { workPackages: recent.length, events, unattributed };
}
