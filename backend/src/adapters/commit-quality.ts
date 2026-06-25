// ─── Commit content quality (pure) ───────────────────
// Classifies changed files and computes effective LOC vs raw LOC, substantive
// commit counts, and task-ref linkage. Down-weights non-substantive content and raises review flags
// rather than accusing — humans decide. Spec: docs §12.10.

export type FileClass = 'source' | 'docs' | 'config' | 'vendored' | 'generated' | 'asset';

export interface CommitFile {
  path: string;
  add: number;
  del: number;
  binary?: boolean;
}

export interface CommitInput {
  hash?: string;
  message: string;
  files: CommitFile[];
}

const VENDORED = [/(^|\/)node_modules\//, /(^|\/)vendor\//, /(^|\/)third_party\//, /(^|\/)\.venv\//];
const GENERATED = [
  /(^|\/)dist\//, /(^|\/)build\//, /(^|\/)out\//, /(^|\/)\.next\//, /(^|\/)target\//,
  /(^|\/)coverage\//, /(^|\/)__generated__\//, /(^|\/)generated\//,
  /\.min\.(js|css)$/, /\.map$/, /\.pb\.(go|ts|js)$/, /_pb2\.py$/,
];
const LOCKFILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|composer\.lock|go\.sum)$/;
const ASSET = /\.(png|jpe?g|gif|svg|ico|webp|mp4|mov|pdf|woff2?|ttf|eot|zip|gz)$/i;
const DOCS = [/(^|\/)docs\//, /\.md$/i];
const CONFIG = /\.(json|ya?ml|toml|ini|cfg|conf|env)$/i;

export function classifyFile(path: string): FileClass {
  const p = path.replace(/^\.?\//, '');
  if (LOCKFILES.test(p)) return 'generated';
  if (VENDORED.some((re) => re.test(p))) return 'vendored';
  if (GENERATED.some((re) => re.test(p))) return 'generated';
  if (ASSET.test(p)) return 'asset';
  if (DOCS.some((re) => re.test(p))) return 'docs';
  if (CONFIG.test(p)) return 'config';
  return 'source';
}

/** Only source + docs count as genuine effort. */
const EFFORT_CLASSES = new Set<FileClass>(['source', 'docs']);

// generic / low-information commit messages
const GENERIC_MSG = /^(\s*(wip|update|updates|fix|fixes|fixed|test|tests|tmp|temp|misc|minor|change|changes|edit|edits|\.|,|-+)\s*)$/i;
const TASK_REF = /(?:#|wp\s?|op-?)(\d{2,})/gi;

export interface CommitAssessment {
  hash?: string;
  rawAdd: number;
  rawDel: number;
  effAdd: number;
  effDel: number;
  effortFiles: number;
  noiseFiles: number;
  substantive: boolean;
  genericMessage: boolean;
  taskRefs: number[];
}

const TRIVIAL_FLOOR = 3; // effective lines below which a commit is non-substantive

export function extractTaskRefs(message: string): number[] {
  const out: number[] = [];
  for (const m of message.matchAll(TASK_REF)) out.push(parseInt(m[1], 10));
  return [...new Set(out)];
}

export function assessCommit(c: CommitInput): CommitAssessment {
  let rawAdd = 0, rawDel = 0, effAdd = 0, effDel = 0, effortFiles = 0, noiseFiles = 0;
  for (const f of c.files) {
    if (f.binary) { noiseFiles++; continue; }
    rawAdd += f.add; rawDel += f.del;
    if (EFFORT_CLASSES.has(classifyFile(f.path))) {
      effAdd += f.add; effDel += f.del; effortFiles++;
    } else {
      noiseFiles++;
    }
  }
  const effLines = effAdd + effDel;
  return {
    hash: c.hash,
    rawAdd, rawDel, effAdd, effDel, effortFiles, noiseFiles,
    substantive: effortFiles > 0 && effLines >= TRIVIAL_FLOOR,
    genericMessage: GENERIC_MSG.test(c.message.trim()) || c.message.trim().length === 0,
    taskRefs: extractTaskRefs(c.message),
  };
}

export type Confidence = 'high' | 'medium' | 'low';

export interface DayQuality {
  commits: number;
  substantiveCommits: number;
  rawLoc: number;
  effectiveLoc: number; // source + docs only
  inflationRatio: number; // effective / raw (1 = all real, →0 = mostly noise)
  taskLinkedCommits: number;
  genericMessages: number;
  confidence: Confidence;
  flags: string[];
}

/**
 * Re-derive linkage-dependent quality after a task link changed the day's
 * linked-commit count. Only the unlinked_to_tasks flag depends on linkage;
 * thresholds mirror assessPersonDay exactly.
 */
export function relinkDayQuality(
  day: { commits: number; flags: string[] },
  taskLinkedCommits: number,
): { taskLinkedCommits: number; flags: string[]; confidence: Confidence } {
  const flags = day.flags.filter((f) => f !== 'unlinked_to_tasks');
  if (day.commits >= 3 && taskLinkedCommits / day.commits < 0.2) flags.push('unlinked_to_tasks');

  let confidence: Confidence = 'high';
  if (flags.includes('inflated_loc') || flags.includes('low_substance')) confidence = 'low';
  else if (flags.length > 0) confidence = 'medium';

  return { taskLinkedCommits, flags, confidence };
}

export function assessPersonDay(
  commits: CommitInput[],
  opts: { validTaskIds?: Set<number> } = {},
): DayQuality {
  const a = commits.map(assessCommit);
  const n = a.length;
  const rawLoc = a.reduce((s, c) => s + c.rawAdd + c.rawDel, 0);
  const effectiveLoc = a.reduce((s, c) => s + c.effAdd + c.effDel, 0);
  const substantiveCommits = a.filter((c) => c.substantive).length;
  // a commit is "linked" only if it references a task that ACTUALLY exists in
  // OpenProject (when validTaskIds is supplied) — can't game with #99999.
  const isLinked = (refs: number[]) =>
    opts.validTaskIds ? refs.some((r) => opts.validTaskIds!.has(r)) : refs.length > 0;
  const taskLinkedCommits = a.filter((c) => isLinked(c.taskRefs)).length;
  const genericMessages = a.filter((c) => c.genericMessage).length;
  const inflationRatio = rawLoc > 0 ? effectiveLoc / rawLoc : 1;

  const flags: string[] = [];
  if (rawLoc >= 200 && inflationRatio < 0.3) flags.push('inflated_loc'); // big diff, little real content
  if (n >= 2 && substantiveCommits / n < 0.34) flags.push('low_substance');
  if (n >= 3 && taskLinkedCommits / n < 0.2) flags.push('unlinked_to_tasks');
  if (n >= 3 && genericMessages / n > 0.6) flags.push('generic_messages');

  let confidence: Confidence = 'high';
  if (flags.includes('inflated_loc') || flags.includes('low_substance')) confidence = 'low';
  else if (flags.length > 0) confidence = 'medium';

  return {
    commits: n,
    substantiveCommits,
    rawLoc,
    effectiveLoc,
    inflationRatio: Math.round(inflationRatio * 100) / 100,
    taskLinkedCommits,
    genericMessages,
    confidence,
    flags,
  };
}
