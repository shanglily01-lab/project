// ─── CodeCommit repository watchlist ──────────────────
// Curated repo → OpenProject-project mapping. The CodeCommit adapter only
// scans repos listed here with active=true (an account may hold hundreds of
// repos — scanning all daily is wasteful). MAINTAIN THIS LIST by hand.
//
// `project` should match an OpenProject project name (for project-level code
// rollup); use null if it doesn't map to a tracked project. Per-person
// attribution is by author email regardless of project.
//
// Use `npm run repos:list` to see every repo and which are watched.
// The adapter skips AccessDenied repos gracefully, so listing a repo you
// cannot yet read is harmless.
//
// Replace the examples below with your own repositories.

export interface RepoWatch {
  repo: string;
  project: string | null;
  active: boolean;
}

export const REPO_WATCH: RepoWatch[] = [
  { repo: 'example-service-api', project: 'Example Service', active: true },
  { repo: 'example-service-web', project: 'Example Service', active: true },
  { repo: 'example-platform', project: null, active: true },
];

export function watchedRepos(): RepoWatch[] {
  return REPO_WATCH.filter((w) => w.active);
}

export function repoToProject(repo: string): string | null {
  return REPO_WATCH.find((w) => w.repo === repo)?.project ?? null;
}

export function isWatched(repo: string): boolean {
  return REPO_WATCH.some((w) => w.repo === repo && w.active);
}
