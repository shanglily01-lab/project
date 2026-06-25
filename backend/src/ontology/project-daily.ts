// ─── Project Daily Advancement (pure) ─────────────────
// Per-project per-day metrics + advancement delta (R2b).
// Spec: docs/PRODUCTIVITY-SCORING-DESIGN.md §3.4, §12.8

import type { TaskState } from '../types.js';

export function isBlocked(t: TaskState): boolean {
  return t.statusName === 'On hold' || t.statusName === 'Rejected' || t.statusName === 'Test failed';
}
export function isInProgress(t: TaskState): boolean {
  return t.statusName === 'In progress';
}
export function isNew(t: TaskState): boolean {
  return t.statusName === 'New';
}
export function isClosed(t: TaskState): boolean {
  return t.statusName === 'Closed';
}

export interface ProjectDaily {
  projectName: string;
  date: string;
  totalTasks: number;
  inProgress: number;
  blocked: number;
  closed: number;
  newTasks: number;
  avgPct: number;
  pctDelta: number | null; // vs previous day; null when no prior baseline
  health: 'green' | 'yellow' | 'red';
}

export function computeProjectHealth(
  totalTasks: number,
  inProgress: number,
  blocked: number,
): 'green' | 'yellow' | 'red' {
  if (totalTasks === 0) return 'green';
  const activeRate = inProgress / totalTasks;
  if (activeRate > 0.3 && blocked === 0) return 'green';
  if (activeRate > 0.1 || blocked < 2) return 'yellow';
  return 'red';
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

/**
 * Compute per-project metrics for a given day. `prevAvgPct` maps projectName →
 * previous day's avgPct so we can report advancement (pctDelta).
 */
export function computeProjectDaily(
  tasks: TaskState[],
  date: string,
  prevAvgPct: Record<string, number> = {},
): ProjectDaily[] {
  const byProject = new Map<string, TaskState[]>();
  for (const t of tasks) {
    const key = t.projectName || 'Unknown';
    const g = byProject.get(key);
    if (g) g.push(t);
    else byProject.set(key, [t]);
  }

  const out: ProjectDaily[] = [];
  for (const [projectName, group] of byProject) {
    // active = non-closed tasks → current load; closed tracked separately
    const active = group.filter((t) => !isClosed(t));
    const inProgress = active.filter(isInProgress).length;
    const blocked = active.filter(isBlocked).length;
    const avgPct = avg(active.map((t) => t.pct ?? 0));
    const prev = prevAvgPct[projectName];
    out.push({
      projectName,
      date,
      totalTasks: active.length,
      inProgress,
      blocked,
      closed: group.filter(isClosed).length,
      newTasks: active.filter(isNew).length,
      avgPct,
      pctDelta: prev === undefined ? null : avgPct - prev,
      health: computeProjectHealth(active.length, inProgress, blocked),
    });
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName));
}
