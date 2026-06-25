import type { TaskState, TaskRelation, Snapshot, Change } from '../types.js';

// ─── Raw API types ─────────────────────────────────────

interface RawWorkPackage {
  id: number;
  subject: string;
  percentageDone: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  _links: {
    status?: { title?: string };
    priority?: { title?: string };
    assignee?: { title?: string; href?: string | null };
    author?: { title?: string };
    project?: { title?: string };
    type?: { title?: string };
  };
}

interface RawRelation {
  type: string;
  description?: string;
  _links: {
    from: { href: string };
    to: { href: string };
  };
}

// ─── Processing Functions (pure, testable) ─────────────

export function extractIdFromHref(href: string | null | undefined): number | null {
  if (!href) return null;
  const m = href.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export function processWorkPackages(raw: RawWorkPackage[]): TaskState[] {
  return raw.map((w) => ({
    id: w.id,
    subject: w.subject ?? '',
    statusName: w._links.status?.title ?? 'Unknown',
    priorityName: w._links.priority?.title ?? 'Normal',
    assignee: w._links.assignee?.title ?? (w._links.assignee?.href ? 'Unknown' : 'Unassigned'),
    author: w._links.author?.title ?? 'Unknown',
    projectName: w._links.project?.title ?? 'Unknown',
    typeName: w._links.type?.title ?? 'Task',
    pct: w.percentageDone ?? null,
    dueDate: w.dueDate ?? null,
    createdAt: w.createdAt ?? '',
    updatedAt: w.updatedAt ?? '',
  }));
}

export function processRelations(raw: RawRelation[]): TaskRelation[] {
  return raw.map((r) => ({
    fromId: extractIdFromHref(r._links.from.href) ?? 0,
    toId: extractIdFromHref(r._links.to.href) ?? 0,
    type: r.type ?? 'relates',
    desc: r.description ?? '',
  }));
}

export function buildSnapshot(tasks: TaskState[]): Snapshot {
  const snap: Snapshot = {};
  for (const t of tasks) {
    snap[t.id] = {
      st: t.statusName,
      pr: t.priorityName,
      as: t.assignee,
      up: t.updatedAt,
      su: t.subject,
    };
  }
  return snap;
}

export function detectChanges(current: Snapshot, previous: Snapshot): Change[] {
  const changes: Change[] = [];

  if (!previous || Object.keys(previous).length === 0) return changes;

  for (const id in current) {
    const c = current[id];
    const p = previous[id];
    if (!p) {
      changes.push({ id: Number(id), type: 'new', detail: 'New task', subject: c.su });
      continue;
    }
    const diffs: string[] = [];
    if (c.st !== p.st) diffs.push(`${p.st} → ${c.st}`);
    if (c.pr !== p.pr) diffs.push(`Priority: ${p.pr} → ${c.pr}`);
    if (c.as !== p.as) diffs.push(`Assignee: ${p.as} → ${c.as}`);
    if (!diffs.length && c.up !== p.up) diffs.push('Content updated');
    if (diffs.length) {
      changes.push({
        id: Number(id),
        type: c.st !== p.st ? 'status' : 'updated',
        detail: diffs.join('; '),
        subject: c.su,
      });
    }
  }

  for (const id in previous) {
    if (!current[id]) {
      changes.push({ id: Number(id), type: 'removed', detail: 'Removed', subject: previous[id].su });
    }
  }

  return changes;
}

// ─── Adapter Class (I/O boundary) ──────────────────────

export interface OpenProjectConfig {
  baseUrl: string;
  token: string;
  pollIntervalMs: number;
}

export class OpenProjectAdapter {
  constructor(private config: OpenProjectConfig) {}

  private headers() {
    return { Authorization: 'Basic ' + Buffer.from('apikey:' + this.config.token).toString('base64') };
  }

  async fetchAllWorkPackages(): Promise<RawWorkPackage[]> {
    const pageSize = 200;
    let offset = 1;
    let all: RawWorkPackage[] = [];
    let total = Infinity;

    // status operator "*" → include ALL statuses (OpenProject hides closed by default)
    const filters = encodeURIComponent('[{"status":{"operator":"*","values":[]}}]');
    while (all.length < total) {
      const url = `${this.config.baseUrl}/work_packages?pageSize=${pageSize}&offset=${offset}&filters=${filters}`;
      const resp = await fetch(url, { headers: this.headers() });
      if (!resp.ok) throw new Error(`OpenProject API ${resp.status}: ${resp.statusText}`);
      const data = await resp.json() as { total?: number; _embedded?: { elements?: RawWorkPackage[] } };
      total = data.total ?? all.length;
      all = all.concat(data._embedded?.elements ?? []);
      offset++;
    }

    return all;
  }

  async fetchRelations(): Promise<RawRelation[]> {
    const url = `${this.config.baseUrl}/relations?pageSize=200`;
    const resp = await fetch(url, { headers: this.headers() });
    if (!resp.ok) return [];
    const data = await resp.json() as { _embedded?: { elements?: RawRelation[] } };
    return data._embedded?.elements ?? [];
  }

  async poll(): Promise<{ tasks: TaskState[]; relations: TaskRelation[] }> {
    const [rawWps, rawRels] = await Promise.all([
      this.fetchAllWorkPackages(),
      this.fetchRelations(),
    ]);
    return {
      tasks: processWorkPackages(rawWps),
      relations: processRelations(rawRels),
    };
  }
}
