// ─── Persistence repository ───────────────────────────
// Reads/writes the project-tracking tables (tasks, relations, identity,
// per-person & per-project daily snapshots, code activity, commit/activity
// events, comments, change log).

import { sql, eq, and, asc, desc } from 'drizzle-orm';
import { db } from './client.js';
import { opsTasks, opsProjectDaily, opsPersonDaily, opsPersonIdentity, opsCodeDaily, opsTaskRelations, opsComments, opsCommitEvents, opsActivityEvents, opsChangeLog } from '../ontology/schema.js';
import type { TaskRelation } from '../types.js';
import type { TaskState } from '../types.js';
import type { ProjectDaily } from '../ontology/project-daily.js';
import type { PersonIdentity } from '../ontology/identity.js';

/** Per-person daily OpenProject snapshot (task counts + progress sum). */
export interface PersonRaw {
  personId: number;
  opName: string;
  totalTasks: number;
  inProgress: number;
  blocked: number;
  closedCount: number;
  pctSum: number;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowsOf(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows ?? []) as Record<string, unknown>[];
}

/** Split into chunks to stay under MySQL's max_allowed_packet / bind limits. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Upsert work packages by external_id. createdAt is preserved on update. */
export async function upsertTasks(tasks: TaskState[]): Promise<number> {
  if (tasks.length === 0) return 0;

  const rows = tasks.map((t) => ({
    externalId: t.id,
    subject: t.subject,
    statusName: t.statusName,
    priorityName: t.priorityName,
    assignee: t.assignee,
    author: t.author,
    projectName: t.projectName,
    typeName: t.typeName,
    pct: t.pct,
    dueDate: toDate(t.dueDate),
    createdAt: toDate(t.createdAt) ?? new Date(),
    updatedAt: toDate(t.updatedAt) ?? new Date(),
  }));

  for (const part of chunk(rows, 2000)) {
    await db
      .insert(opsTasks)
      .values(part)
      .onDuplicateKeyUpdate({
        set: {
          subject: sql`values(${opsTasks.subject})`,
          statusName: sql`values(${opsTasks.statusName})`,
          priorityName: sql`values(${opsTasks.priorityName})`,
          assignee: sql`values(${opsTasks.assignee})`,
          author: sql`values(${opsTasks.author})`,
          projectName: sql`values(${opsTasks.projectName})`,
          typeName: sql`values(${opsTasks.typeName})`,
          pct: sql`values(${opsTasks.pct})`,
          dueDate: sql`values(${opsTasks.dueDate})`,
          updatedAt: sql`values(${opsTasks.updatedAt})`,
        },
      });
  }

  return rows.length;
}

/** Previous-day avg_pct per project (latest row strictly before `date`). */
export async function getPrevAvgPct(date: string): Promise<Record<string, number>> {
  const res: unknown = await db.execute(sql`
    SELECT project_name, avg_pct
    FROM (
      SELECT project_name, avg_pct,
             ROW_NUMBER() OVER (PARTITION BY project_name ORDER BY date DESC) AS rn
      FROM ops_project_daily
      WHERE date < ${date}
    ) ranked
    WHERE rn = 1
  `);
  const out: Record<string, number> = {};
  for (const r of rowsOf(res)) out[r.project_name as string] = Number(r.avg_pct);
  return out;
}

// ─── tasks read ──────────────────────────────────────

type TaskRow = typeof opsTasks.$inferSelect;
function mapTask(r: TaskRow): TaskState {
  return {
    id: r.externalId ?? r.id,
    subject: r.subject,
    statusName: r.statusName,
    priorityName: r.priorityName,
    assignee: r.assignee ?? 'Unassigned',
    author: r.author ?? 'Unknown',
    projectName: r.projectName ?? 'Unknown',
    typeName: r.typeName ?? 'Task',
    pct: r.pct,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function getAllTasks(): Promise<TaskState[]> {
  return (await db.select().from(opsTasks)).map(mapTask);
}

export async function getTasksByAssignee(opName: string): Promise<TaskState[]> {
  return (await db.select().from(opsTasks).where(eq(opsTasks.assignee, opName))).map(mapTask);
}

export async function getTasksByProject(projectName: string): Promise<TaskState[]> {
  return (await db.select().from(opsTasks).where(eq(opsTasks.projectName, projectName))).map(mapTask);
}

// ─── task relations (inter-task dependencies) ────────

export async function upsertRelations(rels: TaskRelation[]): Promise<number> {
  const valid = rels.filter((r) => r.fromId && r.toId);
  if (valid.length === 0) return 0;
  for (const part of chunk(valid, 2000)) {
    await db
      .insert(opsTaskRelations)
      .values(part.map((r) => ({ fromId: r.fromId, toId: r.toId, type: r.type, description: r.desc })))
      .onDuplicateKeyUpdate({
        set: { description: sql`values(${opsTaskRelations.description})` },
      });
  }
  return valid.length;
}

export async function getRelations(): Promise<{ fromId: number; toId: number; type: string }[]> {
  return db
    .select({ fromId: opsTaskRelations.fromId, toId: opsTaskRelations.toId, type: opsTaskRelations.type })
    .from(opsTaskRelations);
}

// ─── comments / notes ────────────────────────────────

export async function addComment(c: {
  targetType: string; targetId: string; date: string; author?: string | null; body: string;
}): Promise<void> {
  await db.insert(opsComments).values({
    targetType: c.targetType, targetId: c.targetId, date: c.date, author: c.author ?? null, body: c.body,
  });
}

export async function getCommentsByType(targetType: string) {
  return db
    .select()
    .from(opsComments)
    .where(eq(opsComments.targetType, targetType))
    .orderBy(desc(opsComments.createdAt));
}

export async function getComments(targetType: string, targetId: string) {
  return db
    .select()
    .from(opsComments)
    .where(and(eq(opsComments.targetType, targetType), eq(opsComments.targetId, targetId)))
    .orderBy(desc(opsComments.createdAt));
}

// ─── person daily (raw OP state) ─────────────────────

export async function getPrevPersonRaw(date: string): Promise<Map<number, PersonRaw>> {
  const res: unknown = await db.execute(sql`
    SELECT person_id, op_name, total_tasks, in_progress, blocked, closed_count, pct_sum
    FROM (
      SELECT person_id, op_name, total_tasks, in_progress, blocked, closed_count, pct_sum,
             ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) AS rn
      FROM ops_person_daily
      WHERE date < ${date}
    ) ranked
    WHERE rn = 1
  `);
  const m = new Map<number, PersonRaw>();
  for (const r of rowsOf(res)) {
    m.set(Number(r.person_id), {
      personId: Number(r.person_id),
      opName: r.op_name as string,
      totalTasks: Number(r.total_tasks),
      inProgress: Number(r.in_progress),
      blocked: Number(r.blocked),
      closedCount: Number(r.closed_count),
      pctSum: Number(r.pct_sum),
    });
  }
  return m;
}

export async function upsertPersonDaily(date: string, rows: PersonRaw[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db
    .insert(opsPersonDaily)
    .values(rows.map((r) => ({
      personId: r.personId,
      date,
      opName: r.opName,
      totalTasks: r.totalTasks,
      inProgress: r.inProgress,
      blocked: r.blocked,
      closedCount: r.closedCount,
      pctSum: r.pctSum,
    })))
    .onDuplicateKeyUpdate({
      set: {
        opName: sql`values(${opsPersonDaily.opName})`,
        totalTasks: sql`values(${opsPersonDaily.totalTasks})`,
        inProgress: sql`values(${opsPersonDaily.inProgress})`,
        blocked: sql`values(${opsPersonDaily.blocked})`,
        closedCount: sql`values(${opsPersonDaily.closedCount})`,
        pctSum: sql`values(${opsPersonDaily.pctSum})`,
      },
    });
  return rows.length;
}

// ─── project daily ───────────────────────────────────

export async function getProjectDailyByDate(date: string) {
  return db.select().from(opsProjectDaily).where(eq(opsProjectDaily.date, date)).orderBy(desc(opsProjectDaily.blocked));
}

export async function getProjectDailyHistory(projectName: string) {
  return db
    .select({ date: opsProjectDaily.date, avgPct: opsProjectDaily.avgPct, blocked: opsProjectDaily.blocked, inProgress: opsProjectDaily.inProgress, totalTasks: opsProjectDaily.totalTasks })
    .from(opsProjectDaily)
    .where(eq(opsProjectDaily.projectName, projectName))
    .orderBy(asc(opsProjectDaily.date));
}

export async function getLatestProjectDate(): Promise<string | null> {
  const rows = await db
    .select({ date: opsProjectDaily.date })
    .from(opsProjectDaily)
    .orderBy(desc(opsProjectDaily.date))
    .limit(1);
  const d = rows[0]?.date;
  return d == null ? null : String(d).slice(0, 10);
}

/** Distinct snapshot dates (newest first). */
export async function getDistinctDates(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: opsProjectDaily.date })
    .from(opsProjectDaily)
    .orderBy(desc(opsProjectDaily.date));
  return rows.map((r) => String(r.date).slice(0, 10));
}

/** Upsert per-project daily rows by (project_name, date). */
export async function upsertProjectDaily(daily: ProjectDaily[]): Promise<number> {
  if (daily.length === 0) return 0;

  const rows = daily.map((d) => ({
    projectName: d.projectName,
    date: d.date,
    totalTasks: d.totalTasks,
    inProgress: d.inProgress,
    blocked: d.blocked,
    closed: d.closed,
    newTasks: d.newTasks,
    avgPct: d.avgPct,
    pctDelta: d.pctDelta,
    health: d.health,
  }));

  await db
    .insert(opsProjectDaily)
    .values(rows)
    .onDuplicateKeyUpdate({
      set: {
        totalTasks: sql`values(${opsProjectDaily.totalTasks})`,
        inProgress: sql`values(${opsProjectDaily.inProgress})`,
        blocked: sql`values(${opsProjectDaily.blocked})`,
        closed: sql`values(${opsProjectDaily.closed})`,
        newTasks: sql`values(${opsProjectDaily.newTasks})`,
        avgPct: sql`values(${opsProjectDaily.avgPct})`,
        pctDelta: sql`values(${opsProjectDaily.pctDelta})`,
        health: sql`values(${opsProjectDaily.health})`,
      },
    });

  return rows.length;
}

// ─── identity ────────────────────────────────────────

export async function listIdentities() {
  return db.select().from(opsPersonIdentity).orderBy(asc(opsPersonIdentity.personId));
}

export async function getRoster(): Promise<PersonIdentity[]> {
  const rows = await db.select().from(opsPersonIdentity).orderBy(asc(opsPersonIdentity.personId));
  return rows.map((r) => ({
    personId: r.personId,
    name: r.name,
    opName: r.opName,
    gitEmails: r.gitEmails ?? [],
    iamArn: r.iamArn,
    active: r.active,
  }));
}

export async function upsertIdentity(p: PersonIdentity): Promise<void> {
  await db
    .insert(opsPersonIdentity)
    .values({
      personId: p.personId,
      name: p.name,
      opName: p.opName,
      gitEmails: p.gitEmails,
      iamArn: p.iamArn ?? null,
      active: p.active,
    })
    .onDuplicateKeyUpdate({
      set: {
        name: p.name,
        opName: p.opName,
        gitEmails: p.gitEmails,
        iamArn: p.iamArn ?? null,
        active: p.active,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
}

/** Append a git email to a person's identity. */
export async function addGitEmailToIdentity(personId: number, email: string): Promise<boolean> {
  const [row] = await db
    .select({ gitEmails: opsPersonIdentity.gitEmails })
    .from(opsPersonIdentity)
    .where(eq(opsPersonIdentity.personId, personId));
  if (!row) return false;
  if (row.gitEmails.includes(email)) return true; // idempotent
  await db
    .update(opsPersonIdentity)
    .set({ gitEmails: [...row.gitEmails, email], updatedAt: new Date() })
    .where(eq(opsPersonIdentity.personId, personId));
  return true;
}

// ─── code daily ──────────────────────────────────────

export interface CodeDailyRow {
  personId: number;
  date: string;
  commits: number;
  substantiveCommits: number;
  rawLoc: number;
  effectiveLoc: number;
  taskLinkedCommits: number;
  confidence: string;
  flags: string[];
  sampleMessages: string[];
  repos: string[];
}

export async function upsertCodeDaily(rows: CodeDailyRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  for (const part of chunk(rows, 500)) {
    await db
      .insert(opsCodeDaily)
      .values(part)
      .onDuplicateKeyUpdate({
        set: {
          commits: sql`values(${opsCodeDaily.commits})`,
          substantiveCommits: sql`values(${opsCodeDaily.substantiveCommits})`,
          rawLoc: sql`values(${opsCodeDaily.rawLoc})`,
          effectiveLoc: sql`values(${opsCodeDaily.effectiveLoc})`,
          taskLinkedCommits: sql`values(${opsCodeDaily.taskLinkedCommits})`,
          confidence: sql`values(${opsCodeDaily.confidence})`,
          flags: sql`values(${opsCodeDaily.flags})`,
          sampleMessages: sql`values(${opsCodeDaily.sampleMessages})`,
          repos: sql`values(${opsCodeDaily.repos})`,
        },
      });
  }
  return rows.length;
}

function mapCodeDaily(r: typeof opsCodeDaily.$inferSelect): CodeDailyRow {
  return {
    personId: r.personId, date: r.date, commits: r.commits, substantiveCommits: r.substantiveCommits,
    rawLoc: r.rawLoc, effectiveLoc: r.effectiveLoc, taskLinkedCommits: r.taskLinkedCommits,
    confidence: r.confidence, flags: (r.flags ?? []) as string[],
    sampleMessages: (r.sampleMessages ?? []) as string[], repos: (r.repos ?? []) as string[],
  };
}

export async function getCodeDailyForPerson(personId: number): Promise<CodeDailyRow[]> {
  const rows = await db
    .select()
    .from(opsCodeDaily)
    .where(eq(opsCodeDaily.personId, personId))
    .orderBy(asc(opsCodeDaily.date));
  return rows.map(mapCodeDaily);
}

export async function getCodeDailyRange(from: string, to: string): Promise<CodeDailyRow[]> {
  const rows = await db
    .select()
    .from(opsCodeDaily)
    .where(and(sql`${opsCodeDaily.date} >= ${from}`, sql`${opsCodeDaily.date} <= ${to}`));
  return rows.map(mapCodeDaily);
}

export async function getCodeDailyByDate(date: string): Promise<CodeDailyRow[]> {
  const rows = await db.select().from(opsCodeDaily).where(eq(opsCodeDaily.date, date));
  return rows.map(mapCodeDaily);
}

// ─── change log ──────────────────────────────────────

export async function addChangeLog(row: { changeType: string; detail: string; taskId?: number; subject?: string }): Promise<void> {
  await db.insert(opsChangeLog).values({
    changeType: row.changeType,
    detail: row.detail,
    taskId: row.taskId ?? null,
    subject: row.subject ?? null,
  });
}

// ─── commit events ───────────────────────────────────

export interface CommitEventRow {
  personId: number;
  repo: string;
  sha: string;
  committedAt: Date;
  day: string; // YYYY-MM-DD
  taskLinked: boolean;
  messageSubject?: string | null;
  linkedTaskId?: number | null;
}

/** Idempotent on sha — re-scanning history won't duplicate rows. */
export async function upsertCommitEvents(rows: CommitEventRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  for (const part of chunk(rows, 500)) {
    await db.insert(opsCommitEvents).values(part).onDuplicateKeyUpdate({ set: { id: sql`id` } });
  }
  return rows.length;
}

// ─── activity events ─────────────────────────────────

export interface ActivityEventRow {
  personId: number;
  taskId: number | null;
  journalId: number;
  activityAt: Date;
  day: string;
  kind: string;
}

/** Idempotent on journalId — re-pulling activities won't duplicate. */
export async function upsertActivityEvents(rows: ActivityEventRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  for (const part of chunk(rows, 500)) {
    await db.insert(opsActivityEvents).values(part).onDuplicateKeyUpdate({ set: { id: sql`id` } });
  }
  return rows.length;
}
