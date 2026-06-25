// ─── Scoring API routes ───────────────────────────────
// Read-only analytics over persisted tasks + daily rollups. Derived from the
// data layer so the frontend /scoring/* pages work without a separate service.

import type { FastifyInstance } from 'fastify';
import type { TaskState } from '../types.js';
import { isBlocked, isInProgress, isClosed, computeProjectDaily } from '../ontology/project-daily.js';
import { today } from '../pipeline.js';
import * as repo from '../db/repository.js';
import type { PersonIdentity } from '../ontology/identity.js';
import type { CodeDailyRow } from '../db/repository.js';

function ageHours(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000));
}

function ageDays(iso: string): number {
  return Math.max(0, Math.round(ageHours(iso) / 24));
}

function taskLite(t: TaskState) {
  return {
    id: t.id,
    subject: t.subject,
    project: t.projectName,
    assignee: t.assignee,
    status: t.statusName,
    priority: t.priorityName,
    pct: t.pct,
    ageHours: ageHours(t.updatedAt),
  };
}

function personTasks(tasks: TaskState[], opName: string) {
  const mine = tasks.filter((t) => t.assignee === opName && !isClosed(t));
  const blocked = mine.filter(isBlocked);
  const inProgress = mine.filter(isInProgress);
  const topBlocked = blocked
    .map((t) => ({ id: t.id, subject: t.subject, ageHours: ageHours(t.updatedAt) }))
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 3);
  return {
    inProgress: inProgress.length,
    blocked: blocked.length,
    completedRecent: tasks.filter((t) => t.assignee === opName && isClosed(t)).length,
    topBlocked,
    inProgressList: inProgress.map(taskLite),
    blockedList: blocked.map(taskLite),
    completedList: tasks.filter((t) => t.assignee === opName && isClosed(t)).map(taskLite).slice(0, 10),
  };
}

function scorePerson(
  pt: ReturnType<typeof personTasks>,
  totalAssigned: number,
  pctSum: number,
  code: CodeDailyRow | undefined,
) {
  const completion = totalAssigned > 0 ? Math.round(pctSum / totalAssigned) : 0;
  const workload = pt.inProgress + pt.blocked;
  const codeBoost = (code?.substantiveCommits ?? 0) * 4 + (code?.taskLinkedCommits ?? 0) * 3;
  const score = Math.min(100, Math.round(completion * 0.55 + Math.min(30, pt.inProgress * 5) + codeBoost));
  const isAnomaly =
    pt.blocked >= 2 ||
    (totalAssigned >= 3 && pt.inProgress === 0 && pt.blocked === 0 && completion < 15 && !(code?.commits ?? 0));
  const reason = isAnomaly
    ? pt.blocked >= 2
      ? `${pt.blocked} blocked tasks`
      : 'Low progress with open workload'
    : null;
  return { score, completion, workload, isAnomaly, reason };
}

async function resolveDate(q?: string): Promise<string> {
  if (q) return q.slice(0, 10);
  return (await repo.getLatestProjectDate()) ?? today();
}

function codeFeed(c: CodeDailyRow | undefined) {
  if (!c || c.commits === 0) return null;
  return {
    commits: c.commits,
    substantiveCommits: c.substantiveCommits,
    effectiveLoc: c.effectiveLoc,
    taskLinkedCommits: c.taskLinkedCommits,
    confidence: c.confidence as 'high' | 'medium' | 'low',
    flags: c.flags,
    sampleMessages: c.sampleMessages,
    repos: c.repos,
  };
}

function buildBlockers(tasks: TaskState[]) {
  const blocked = tasks.filter((t) => isBlocked(t) && !isClosed(t));
  const byProject = new Map<string, typeof blocked>();
  for (const t of blocked) {
    const p = t.projectName || 'Unknown';
    (byProject.get(p) ?? byProject.set(p, []).get(p)!).push(t);
  }
  return [...byProject.entries()].map(([project, items]) => ({
    project,
    count: items.length,
    items: items
      .map((t) => ({
        id: t.id,
        subject: t.subject,
        assignee: t.assignee,
        ageDays: ageDays(t.updatedAt),
        severity: ageDays(t.updatedAt) >= 7 ? 'critical' : ageDays(t.updatedAt) >= 3 ? 'high' : 'warn',
      }))
      .sort((a, b) => b.ageDays - a.ageDays),
  }));
}

async function buildBoardPeople(tasks: TaskState[], roster: PersonIdentity[], date: string) {
  const codeMap = new Map((await repo.getCodeDailyByDate(date)).map((c) => [c.personId, c]));
  const people = roster.filter((p) => p.active).map((p) => {
    const mine = tasks.filter((t) => t.assignee === p.opName);
    const active = mine.filter((t) => !isClosed(t));
    const pt = personTasks(tasks, p.opName);
    const pctSum = active.reduce((s, t) => s + (t.pct ?? 0), 0);
    const m = scorePerson(pt, active.length, pctSum, codeMap.get(p.personId));
    return {
      personId: p.personId,
      name: p.name,
      opName: p.opName,
      ...m,
      signals: {
        inProgress: pt.inProgress,
        blocked: pt.blocked,
        commits: codeMap.get(p.personId)?.commits ?? 0,
      },
      totalTasks: active.length,
      inProgress: pt.inProgress,
      blocked: pt.blocked,
      pctSum,
    };
  });
  const scored = people.filter((p) => p.totalTasks! > 0 || (p.signals.commits ?? 0) > 0);
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  return {
    people: scored,
    highestId: byScore[0]?.personId ?? null,
    lowestId: byScore[byScore.length - 1]?.personId ?? null,
  };
}

export async function registerScoringRoutes(app: FastifyInstance): Promise<void> {
  app.get('/scoring/dates', async () => {
    const dates = await repo.getDistinctDates();
    if (dates.length === 0) dates.push(today());
    return { dates };
  });

  app.get('/scoring/roster', async () => {
    const roster = await repo.getRoster();
    return { roster: roster.map((p) => ({ personId: p.personId, name: p.name, opName: p.opName })) };
  });

  app.get('/scoring/absences', async () => ({ absences: [] }));
  app.post('/scoring/absences', async () => ({ ok: true }));

  app.get<{ Querystring: { date?: string } }>('/scoring/board', async (req) => {
    const date = await resolveDate(req.query.date);
    const [tasks, roster] = await Promise.all([repo.getAllTasks(), repo.getRoster()]);
    const { people, highestId, lowestId } = await buildBoardPeople(tasks, roster, date);
    return { date, people, highestId, lowestId };
  });

  app.get<{ Querystring: { date?: string } }>('/scoring/projects', async (req) => {
    const date = await resolveDate(req.query.date);
    const dbRows = await repo.getProjectDailyByDate(date);
    const projects =
      dbRows.length > 0
        ? dbRows.map((r) => ({
            projectName: r.projectName,
            date: String(r.date).slice(0, 10),
            totalTasks: r.totalTasks,
            inProgress: r.inProgress,
            blocked: r.blocked,
            closed: r.closed,
            newTasks: r.newTasks,
            avgPct: r.avgPct,
            pctDelta: r.pctDelta,
            health: r.health as 'green' | 'yellow' | 'red',
          }))
        : computeProjectDaily(await repo.getAllTasks(), date, await repo.getPrevAvgPct(date)).map((d) => ({
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
    return { date, projects };
  });

  app.get<{ Querystring: { date?: string; lang?: string } }>('/scoring/feed', async (req) => {
    const date = await resolveDate(req.query.date);
    const [tasks, roster] = await Promise.all([repo.getAllTasks(), repo.getRoster()]);
    const codeMap = new Map((await repo.getCodeDailyByDate(date)).map((c) => [c.personId, c]));
    const blockersByProject = buildBlockers(tasks);
    let anomalies = 0;
    let committers = 0;
    let noActivity = 0;
    let totalBlocked = tasks.filter((t) => isBlocked(t) && !isClosed(t)).length;
    let linked = 0;
    let totalCommits = 0;

    const entries = await Promise.all(
      roster.filter((p) => p.active).map(async (p) => {
        const mine = tasks.filter((t) => t.assignee === p.opName);
        const active = mine.filter((t) => !isClosed(t));
        const pt = personTasks(tasks, p.opName);
        const pctSum = active.reduce((s, t) => s + (t.pct ?? 0), 0);
        const code = codeMap.get(p.personId);
        const m = scorePerson(pt, active.length, pctSum, code);
        if (m.isAnomaly) anomalies++;
        if (code && code.commits > 0) committers++;
        else if (active.length === 0) noActivity++;
        if (code) {
          totalCommits += code.commits;
          linked += code.taskLinkedCommits;
        }
        const comments = await repo.getComments('person', String(p.personId));
        const latest = comments[0];
        return {
          personId: p.personId,
          name: p.name,
          opName: p.opName,
          summary: m.isAnomaly ? (m.reason ?? 'Needs attention') : `${pt.inProgress} in progress`,
          ...m,
          defense: null,
          tasks: pt,
          code: codeFeed(code),
          comments: {
            count: comments.length,
            latest: latest
              ? { author: latest.author, body: latest.body, date: String(latest.date).slice(0, 10) }
              : null,
          },
        };
      }),
    );

    const linkageRate = totalCommits > 0 ? Math.round((linked / totalCommits) * 100) : null;
    const topRisks = blockersByProject
      .flatMap((p) => p.items.map((i) => ({ kind: 'blocker', severity: i.severity, subject: i.subject, assignee: i.assignee, ageDays: i.ageDays })))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 8);

    return {
      date,
      entries,
      digest: {
        totalBlocked,
        anomalies,
        committers,
        noActivity,
        linkageRate,
        unlinkedCommitters: Math.max(0, committers - linked),
        topRisks,
      },
      blockersByProject,
    };
  });

  app.get<{ Params: { id: string } }>('/scoring/person/:id', async (req) => {
    const personId = parseInt(req.params.id, 10);
    const roster = await repo.getRoster();
    const p = roster.find((r) => r.personId === personId);
    if (!p) return { person: null, history: [], absences: [] };
    const codeHistory = await repo.getCodeDailyForPerson(personId);
    const history = codeHistory.map((c) => ({
      date: c.date,
      score: Math.min(100, c.substantiveCommits * 10 + c.taskLinkedCommits * 5),
      completion: 0,
      workload: c.commits,
      isAnomaly: false,
      reason: null,
    }));
    return {
      person: { personId: p.personId, name: p.name, opName: p.opName, gitEmails: p.gitEmails, active: p.active },
      history,
      absences: [],
    };
  });

  app.get<{ Params: { id: string } }>('/scoring/person/:id/tasks', async (req) => {
    const personId = parseInt(req.params.id, 10);
    const roster = await repo.getRoster();
    const p = roster.find((r) => r.personId === personId);
    if (!p) return { person: null, inProgress: [], blocked: [], completedRecent: [] };
    const tasks = await repo.getAllTasks();
    const pt = personTasks(tasks, p.opName);
    return {
      person: { personId: p.personId, name: p.name, opName: p.opName },
      inProgress: pt.inProgressList,
      blocked: pt.blockedList,
      completedRecent: pt.completedList,
    };
  });

  app.get<{ Querystring: { targetType: string; targetId: string } }>('/scoring/comments', async (req) => {
    const rows = await repo.getComments(req.query.targetType, req.query.targetId);
    return {
      comments: rows.map((c) => ({
        id: c.id,
        targetType: c.targetType,
        targetId: c.targetId,
        date: String(c.date).slice(0, 10),
        author: c.author,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  app.post<{ Body: { targetType: string; targetId: string; date?: string; author?: string; body: string } }>(
    '/scoring/comments',
    async (req) => {
      const b = req.body;
      await repo.addComment({
        targetType: b.targetType,
        targetId: b.targetId,
        date: b.date ?? today(),
        author: b.author ?? null,
        body: b.body,
      });
      return { ok: true };
    },
  );

  app.get<{ Querystring: { name: string; lang?: string } }>('/scoring/project', async (req) => {
    const name = req.query.name;
    const tasks = (await repo.getAllTasks()).filter((t) => t.projectName === name);
    const active = tasks.filter((t) => !isClosed(t));
    const history = await repo.getProjectDailyHistory(name);
    const byAssignee = new Map<string, TaskState[]>();
    for (const t of active) {
      (byAssignee.get(t.assignee) ?? byAssignee.set(t.assignee, []).get(t.assignee)!).push(t);
    }
    return {
      name,
      summary: `${active.length} active tasks`,
      counts: {
        active: active.length,
        inProgress: active.filter(isInProgress).length,
        blocked: active.filter(isBlocked).length,
        closed: tasks.filter(isClosed).length,
      },
      trend: history.map((h) => ({
        date: String(h.date).slice(0, 10),
        avgPct: h.avgPct,
        blocked: h.blocked,
        inProgress: h.inProgress,
        totalTasks: h.totalTasks,
      })),
      people: [...byAssignee.entries()].map(([n, ts]) => ({
        name: n,
        total: ts.length,
        inProgress: ts.filter(isInProgress).length,
        blocked: ts.filter(isBlocked).length,
        closed: 0,
      })),
      gantt: active.slice(0, 40).map((t) => ({
        id: t.id,
        subject: t.subject,
        assignee: t.assignee,
        status: t.statusName,
        pct: t.pct,
        start: t.createdAt.slice(0, 10),
        end: t.dueDate?.slice(0, 10) ?? null,
      })),
      inProgress: active.filter(isInProgress).map(taskLite),
      blocked: active.filter(isBlocked).map(taskLite),
      risks: active
        .filter(isBlocked)
        .map((t) => ({
          kind: 'blocker' as const,
          taskId: t.id,
          subject: t.subject,
          assignee: t.assignee,
          status: t.statusName,
          detail: 'Blocked',
          severity: (ageDays(t.updatedAt) >= 7 ? 'critical' : ageDays(t.updatedAt) >= 3 ? 'high' : 'warn') as 'warn' | 'high' | 'critical',
          ageDays: ageDays(t.updatedAt),
        })),
    };
  });

  app.get<{ Params: { id: string }; Querystring: { from: string; to: string; label: string; lang?: string } }>(
    '/scoring/person/:id/analysis',
    async (req) => {
      const personId = parseInt(req.params.id, 10);
      const roster = await repo.getRoster();
      const p = roster.find((r) => r.personId === personId);
      if (!p) throw new Error('Person not found');
      const tasks = await repo.getAllTasks();
      const pt = personTasks(tasks, p.opName);
      const codeRows = await repo.getCodeDailyRange(req.query.from, req.query.to);
      const commits = codeRows.reduce((s, r) => s + r.commits, 0);
      return {
        person: { personId: p.personId, name: p.name, opName: p.opName, gitEmails: p.gitEmails, active: p.active },
        from: req.query.from,
        to: req.query.to,
        label: req.query.label,
        summary: `${commits} commits in period`,
        tasks: { inProgress: pt.inProgressList, blocked: pt.blockedList, completedRecent: pt.completedList },
        code: {
          commits,
          effectiveLoc: codeRows.reduce((s, r) => s + r.effectiveLoc, 0),
          substantiveCommits: codeRows.reduce((s, r) => s + r.substantiveCommits, 0),
          taskLinkedCommits: codeRows.reduce((s, r) => s + r.taskLinkedCommits, 0),
          linkageRate: commits > 0 ? Math.round((codeRows.reduce((s, r) => s + r.taskLinkedCommits, 0) / commits) * 100) : null,
          repos: [...new Set(codeRows.flatMap((r) => r.repos))],
          flags: [...new Set(codeRows.flatMap((r) => r.flags))],
          sampleMessages: codeRows.flatMap((r) => r.sampleMessages).slice(0, 6),
          daily: codeRows.map((r) => ({
            date: r.date,
            commits: r.commits,
            effectiveLoc: r.effectiveLoc,
            confidence: r.confidence,
          })),
        },
        scores: codeRows.map((r) => ({
          date: r.date,
          score: Math.min(100, r.substantiveCommits * 10),
          completion: 0,
          workload: r.commits,
          isAnomaly: false,
          reason: null,
        })),
        dependencies: { dependsOn: [], blocking: [], related: [] },
        absences: [],
      };
    },
  );

  app.get<{ Querystring: { month?: string } }>('/scoring/monthly', async (req) => {
    const month = req.query.month ?? today().slice(0, 7);
    const tasks = await repo.getAllTasks();
    return {
      month,
      totals: { closed: tasks.filter(isClosed).length, commits: 0, effectiveLoc: 0, activePeople: (await repo.getRoster()).length },
      projects: [],
      series: [],
    };
  });

  app.get('/scoring/matrix', async () => {
    const tasks = (await repo.getAllTasks()).filter((t) => !isClosed(t));
    const roster = await repo.getRoster();
    const projects = [...new Set(tasks.map((t) => t.projectName))].map((name) => {
      const ts = tasks.filter((t) => t.projectName === name);
      return { name, active: ts.length, blocked: ts.filter(isBlocked).length };
    });
    const people = roster.filter((p) => p.active).map((p) => {
      const ts = tasks.filter((t) => t.assignee === p.opName);
      return { personId: p.personId, name: p.name, active: ts.length, blocked: ts.filter(isBlocked).length };
    });
    const cells = people.flatMap((person) =>
      projects.map((proj) => {
        const ts = tasks.filter((t) => t.assignee === roster.find((r) => r.personId === person.personId)?.opName && t.projectName === proj.name);
        return { personId: person.personId, project: proj.name, active: ts.length, blocked: ts.filter(isBlocked).length };
      }),
    );
    return { projects, people, cells };
  });

  app.get<{ Querystring: { period: string } }>('/scoring/leaderboard', async (req) => {
    const date = today();
    const tasks = await repo.getAllTasks();
    const roster = await repo.getRoster();
    const { people } = await buildBoardPeople(tasks, roster, date);
    const entries = [...people]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        personId: p.personId,
        name: p.name ?? '',
        latest: {
          period: req.query.period,
          days: 1,
          avgScore: p.score,
          medianScore: p.score,
          totalScore: p.score,
          anomalyDays: p.isAnomaly ? 1 : 0,
          best: { date, score: p.score },
          worst: { date, score: p.score },
        },
        periods: [],
      }));
    return { period: req.query.period, entries };
  });

  app.get<{ Querystring: { date?: string } }>('/scoring/rhythm/board', async (req) => {
    const date = await resolveDate(req.query.date);
    return { date, rhythms: [], note: 'Activity rhythm requires journal ingest (npm run code:ingest + activity ingest)' };
  });

  app.get<{ Params: { id: string }; Querystring: { from: string; to: string; lang?: string } }>(
    '/scoring/person/:id/rhythm',
    async (req) => {
      const personId = parseInt(req.params.id, 10);
      return {
        personId,
        from: req.query.from,
        to: req.query.to,
        note: 'Activity rhythm requires journal ingest',
        perDay: [],
        aggregate: { hist: Array(24).fill(0), nightDays: 0, weekendActiveDays: 0, days: 0 },
      };
    },
  );
}
