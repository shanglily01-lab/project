// ─── CodeCommit Adapter (pure parsing core) ───────────
// Spec: docs/PRODUCTIVITY-SCORING-DESIGN.md §4, §12.2–12.4
// Only the pure, testable functions live here. The AWS SDK I/O class
// (ListPullRequests / GetCommit / GetDifferences / GetBlob) wraps these.

export type PathClass = 'docs' | 'code';

export interface LineDelta {
  add: number;
  del: number;
  binary: boolean;
  skipped: boolean;
}

// ─── §12.2 path classification ───────────────────────

export function classifyPath(path: string): PathClass {
  const norm = path.replace(/^\.?\//, '').replace(/\/+$/, '');
  const segs = norm.split('/');
  // 'docs' must appear as a directory segment (not the file name itself),
  // at any depth — so monorepo paths like `projA/docs/x.md` count too. (F2)
  const dirs = segs.slice(0, -1);
  return dirs.includes('docs') ? 'docs' : 'code';
}

// ─── §12.3 line counting + diff ──────────────────────

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

export function splitLines(s: string): string[] {
  if (s === '') return [];
  const lines = normalizeNewlines(s).split('\n');
  // a trailing newline yields a trailing '' that is not a real line
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function countLines(s: string): number {
  return splitLines(s).length;
}

export function isBinary(content: string): boolean {
  return content.indexOf(String.fromCharCode(0)) !== -1;
}

/** Line-level LCS diff → added / deleted line counts (git numstat-like). */
export function diffLines(before: string, after: string): { add: number; del: number } {
  const A = splitLines(before);
  const B = splitLines(after);
  const n = A.length;
  const m = B.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lcs = dp[0][0];
  return { del: n - lcs, add: m - lcs };
}

export function computeLineDelta(
  before: string | null,
  after: string | null,
  opts: { maxBytes?: number } = {},
): LineDelta {
  const maxBytes = opts.maxBytes ?? 1_000_000;

  if ((before && before.length > maxBytes) || (after && after.length > maxBytes)) {
    return { add: 0, del: 0, binary: false, skipped: true };
  }
  if ((before && isBinary(before)) || (after && isBinary(after))) {
    return { add: 0, del: 0, binary: true, skipped: true };
  }

  if (before === null && after !== null) {
    return { add: countLines(after), del: 0, binary: false, skipped: false };
  }
  if (after === null && before !== null) {
    return { add: 0, del: countLines(before), binary: false, skipped: false };
  }
  if (before === null && after === null) {
    return { add: 0, del: 0, binary: false, skipped: false };
  }

  const { add, del } = diffLines(before as string, after as string);
  return { add, del, binary: false, skipped: false };
}

// ─── §12.4 day attribution ───────────────────────────

export function commitDayLocal(iso: string, tz = 'Asia/Shanghai'): string {
  const d = new Date(iso);
  // en-CA formats as YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}
