import {
  mysqlTable,
  int,
  text,
  varchar,
  index,
  json,
  boolean,
  date,
  unique,
  timestamp,
} from 'drizzle-orm/mysql-core';

// ─── ops_tasks ────────────────────────────────────────
// OpenProject work packages.

export const opsTasks = mysqlTable('ops_tasks', {
  id: int('id').autoincrement().primaryKey(),
  externalId: int('external_id').unique(),
  subject: text('subject').notNull(),
  statusName: varchar('status_name', { length: 128 }).notNull(),
  priorityName: varchar('priority_name', { length: 64 }).notNull(),
  assignee: varchar('assignee', { length: 255 }),
  author: varchar('author', { length: 255 }),
  projectName: varchar('project_name', { length: 255 }),
  typeName: varchar('type_name', { length: 64 }),
  pct: int('pct'),
  dueDate: timestamp('due_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_tasks_assignee').on(table.assignee),
  index('idx_tasks_project').on(table.projectName),
  index('idx_tasks_status').on(table.statusName),
]);

// ─── ops_task_relations ───────────────────────────────
// Inter-task dependencies (blocks / precedes / relates …).

export const opsTaskRelations = mysqlTable('ops_task_relations', {
  id: int('id').autoincrement().primaryKey(),
  fromId: int('from_id').notNull(),
  toId: int('to_id').notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('uq_relation').on(table.fromId, table.toId, table.type),
]);

// ─── ops_change_log ───────────────────────────────────
// Audit trail of task changes detected between polls.

export const opsChangeLog = mysqlTable('ops_change_log', {
  id: int('id').autoincrement().primaryKey(),
  taskId: int('task_id'),
  changeType: varchar('change_type', { length: 32 }).notNull(),
  detail: text('detail').notNull(),
  subject: text('subject'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_changelog_task').on(table.taskId),
  index('idx_changelog_type').on(table.changeType),
]);

// ─── ops_person_identity ──────────────────────────────
// Cross-source identity: CodeCommit git email / IAM ↔ OpenProject name.

export const opsPersonIdentity = mysqlTable('ops_person_identity', {
  personId: int('person_id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  opName: varchar('op_name', { length: 255 }).notNull(),
  gitEmails: json('git_emails').$type<string[]>().notNull(),
  iamArn: varchar('iam_arn', { length: 512 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_identity_op_name').on(table.opName),
]);

// ─── ops_person_daily ─────────────────────────────────
// One row per person per day — task counts + progress sum, for day-over-day
// flow (closures / progress delta).

export const opsPersonDaily = mysqlTable('ops_person_daily', {
  id: int('id').autoincrement().primaryKey(),
  personId: int('person_id').notNull(),
  date: date('date').notNull(),
  opName: varchar('op_name', { length: 255 }).notNull(),
  totalTasks: int('total_tasks').notNull(),
  inProgress: int('in_progress').notNull(),
  blocked: int('blocked').notNull(),
  closedCount: int('closed_count').notNull(),
  pctSum: int('pct_sum').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_person_daily_person').on(table.personId),
  unique('uq_person_daily_person_date').on(table.personId, table.date),
]);

// ─── ops_comments ─────────────────────────────────────
// Free-text notes on a person's or project's progress (by date).

export const opsComments = mysqlTable('ops_comments', {
  id: int('id').autoincrement().primaryKey(),
  targetType: varchar('target_type', { length: 16 }).notNull(), // person | project
  targetId: varchar('target_id', { length: 255 }).notNull(), // personId or projectName
  date: date('date').notNull(),
  author: varchar('author', { length: 128 }),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_comments_target').on(table.targetType, table.targetId),
]);

// ─── ops_code_daily ───────────────────────────────────
// One row per person per day — aggregated CodeCommit activity.

export const opsCodeDaily = mysqlTable('ops_code_daily', {
  id: int('id').autoincrement().primaryKey(),
  personId: int('person_id').notNull(),
  date: date('date').notNull(),
  commits: int('commits').notNull(),
  substantiveCommits: int('substantive_commits').notNull(),
  rawLoc: int('raw_loc').notNull(),
  effectiveLoc: int('effective_loc').notNull(),
  taskLinkedCommits: int('task_linked_commits').notNull(),
  confidence: varchar('confidence', { length: 8 }).notNull(),
  flags: json('flags').$type<string[]>().notNull(),
  sampleMessages: json('sample_messages').$type<string[]>().notNull(),
  repos: json('repos').$type<string[]>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_code_daily_person').on(table.personId),
  unique('uq_code_daily_person_date').on(table.personId, table.date),
]);

// ─── ops_project_daily ────────────────────────────────
// One row per project per day — task counts, advancement, blocker history.

export const opsProjectDaily = mysqlTable('ops_project_daily', {
  id: int('id').autoincrement().primaryKey(),
  projectName: varchar('project_name', { length: 255 }).notNull(),
  date: date('date').notNull(),
  totalTasks: int('total_tasks').notNull(),
  inProgress: int('in_progress').notNull(),
  blocked: int('blocked').notNull(),
  closed: int('closed').notNull(),
  newTasks: int('new_tasks').notNull(),
  avgPct: int('avg_pct').notNull(),
  pctDelta: int('pct_delta'), // advancement vs previous day; null on first day
  health: varchar('health', { length: 16 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_project_daily_name').on(table.projectName),
  index('idx_project_daily_date').on(table.date),
  unique('uq_project_daily_name_date').on(table.projectName, table.date),
]);

// ─── ops_commit_events ────────────────────────────────
// Raw per-commit events with the git timestamp retained. Idempotent on sha.

export const opsCommitEvents = mysqlTable('ops_commit_events', {
  id: int('id').autoincrement().primaryKey(),
  personId: int('person_id').notNull(),
  repo: varchar('repo', { length: 128 }).notNull(),
  sha: varchar('sha', { length: 64 }).notNull(),
  committedAt: timestamp('committed_at').notNull(),
  day: date('day').notNull(), // Asia/Shanghai attribution (matches commitDayLocal)
  taskLinked: boolean('task_linked').notNull().default(false),
  messageSubject: varchar('message_subject', { length: 200 }), // first line of the commit message
  linkedTaskId: int('linked_task_id'), // set when a task ref is matched
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('uq_commit_events_sha').on(table.sha), // idempotent re-scan
  index('idx_commit_events_person_day').on(table.personId, table.day),
]);

// ─── ops_activity_events ──────────────────────────────
// OpenProject journal events — real edit time + actor. Idempotent on journal_id.

export const opsActivityEvents = mysqlTable('ops_activity_events', {
  id: int('id').autoincrement().primaryKey(),
  personId: int('person_id').notNull(),
  taskId: int('task_id'),
  journalId: int('journal_id').notNull(),
  activityAt: timestamp('activity_at').notNull(),
  day: date('day').notNull(), // Asia/Shanghai attribution
  kind: varchar('kind', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('uq_activity_events_journal').on(table.journalId),
  index('idx_activity_events_person_day').on(table.personId, table.day),
]);
