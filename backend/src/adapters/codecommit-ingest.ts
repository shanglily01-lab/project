// ─── CodeCommit ingest (read-only I/O) ────────────────
// Walks recent commits on watched repos, builds per-commit file deltas, and
// tags each with author email + local day. Reuses the tested pure helpers
// (computeLineDelta) and the commit content-quality helpers downstream.

import type { CodeCommitReadClient } from './codecommit-client.js';
import { computeLineDelta, classifyPath, commitDayLocal } from './codecommit-adapter.js';
import { classifyFile, type CommitInput } from './commit-quality.js';

export interface ScannedCommit {
  repo: string;
  hash: string;
  email: string;
  authorName: string;
  dateMs: number;
  day: string; // local YYYY-MM-DD
  input: CommitInput;
}

export interface ScanOptions {
  sinceMs: number;
  maxCommitsPerRepo?: number;
  maxFilesPerCommit?: number;
  maxBlobBytes?: number;
}

/** CodeCommit dates look like "1699564800 +0000" (epoch seconds + tz). */
export function parseCommitDate(s: string | undefined): number {
  if (!s) return 0;
  const secs = parseInt(s.trim().split(/\s+/)[0], 10);
  return Number.isNaN(secs) ? 0 : secs * 1000;
}

async function fileDelta(
  client: CodeCommitReadClient,
  repo: string,
  before: { blobId?: string; path?: string } | undefined,
  after: { blobId?: string; path?: string } | undefined,
  maxBytes: number,
): Promise<{ path: string; add: number; del: number; binary: boolean }> {
  const path = after?.path ?? before?.path ?? '';
  // Only fetch blobs for genuine-effort files; noise (vendored/generated/lock/
  // assets) is recorded with zero lines so it earns no LOC credit.
  const effort = classifyFile(path) === 'source' || classifyFile(path) === 'docs' || classifyPath(path) === 'docs';
  if (!effort) return { path, add: 0, del: 0, binary: false };

  const [b, a] = await Promise.all([
    before?.blobId ? client.getBlob(repo, before.blobId).catch(() => null) : Promise.resolve(null),
    after?.blobId ? client.getBlob(repo, after.blobId).catch(() => null) : Promise.resolve(null),
  ]);
  const d = computeLineDelta(b, a, { maxBytes });
  return { path, add: d.add, del: d.del, binary: d.binary };
}

async function commitToInput(
  client: CodeCommitReadClient,
  repo: string,
  commit: { commitId?: string; message?: string; parents?: string[] },
  opts: ScanOptions,
): Promise<CommitInput> {
  const after = commit.commitId!;
  const before = commit.parents?.[0];
  const diffs = await client.getDifferences(repo, before, after).catch(() => []);
  const limited = diffs.slice(0, opts.maxFilesPerCommit ?? 50);
  const files = await Promise.all(
    limited.map((d) => fileDelta(client, repo, d.beforeBlob, d.afterBlob, opts.maxBlobBytes ?? 200_000)),
  );
  return { hash: after, message: commit.message ?? '', files };
}

/** BFS commit history from the default branch, stopping past `sinceMs`. */
export async function scanRepo(
  client: CodeCommitReadClient,
  repo: string,
  opts: ScanOptions,
): Promise<ScannedCommit[]> {
  const tip = await client.getDefaultBranchCommit(repo);
  if (!tip) return [];

  const maxCommits = opts.maxCommitsPerRepo ?? 80;
  const visited = new Set<string>();
  let frontier = [tip];
  const out: ScannedCommit[] = [];

  while (frontier.length > 0 && out.length < maxCommits) {
    const batch = frontier.filter((id) => !visited.has(id)).slice(0, 10);
    batch.forEach((id) => visited.add(id));
    if (batch.length === 0) break;
    frontier = frontier.slice(batch.length);

    const commits = await client.batchGetCommits(repo, batch);
    for (const c of commits) {
      const dateMs = parseCommitDate(c.author?.date ?? c.committer?.date);
      if (dateMs < opts.sinceMs) continue; // too old → don't follow its parents
      for (const p of c.parents ?? []) if (!visited.has(p)) frontier.push(p);
      if (out.length >= maxCommits) break;
      const input = await commitToInput(client, repo, c, opts);
      out.push({
        repo,
        hash: c.commitId ?? '',
        email: (c.author?.email ?? '').trim(),
        authorName: c.author?.name ?? '',
        dateMs,
        day: commitDayLocal(new Date(dateMs).toISOString()),
        input,
      });
    }
  }
  return out;
}

export async function scanRepos(
  client: CodeCommitReadClient,
  repos: string[],
  opts: ScanOptions,
  onRepo?: (repo: string, count: number, skipped: boolean) => void,
): Promise<ScannedCommit[]> {
  const all: ScannedCommit[] = [];
  for (const repo of repos) {
    try {
      const commits = await scanRepo(client, repo, opts);
      all.push(...commits);
      onRepo?.(repo, commits.length, false);
    } catch {
      // AccessDenied or transient → skip this repo, keep going
      onRepo?.(repo, 0, true);
    }
  }
  return all;
}
