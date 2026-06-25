/**
 * Scoring API — typed fetchers for the productivity-scoring endpoints.
 */
import { get, post } from './client'

export interface BoardPerson {
  personId: number
  name: string | null
  opName: string | null
  score: number
  completion: number
  workload: number
  isAnomaly: boolean
  reason: string | null
  signals: Record<string, number>
  totalTasks: number | null
  inProgress: number | null
  blocked: number | null
  pctSum: number | null
}
export interface Board {
  date: string | null
  people: BoardPerson[]
  highestId: number | null
  lowestId: number | null
}
export const fetchBoard = (date?: string) =>
  get<Board>(`/scoring/board${date ? `?date=${date}` : ''}`)

export interface ScorePoint {
  date: string
  score: number
  completion: number
  workload: number
  isAnomaly: boolean
  reason: string | null
}
export interface AbsenceLite {
  startDate: string
  endDate: string
  type: string
}
export interface PersonDetail {
  person: { personId: number; name: string; opName: string; gitEmails: string[]; active: boolean } | null
  history: ScorePoint[]
  absences: AbsenceLite[]
}
export const fetchPerson = (id: number) => get<PersonDetail>(`/scoring/person/${id}`)

export interface ProjectRow {
  projectName: string
  date: string
  totalTasks: number
  inProgress: number
  blocked: number
  closed: number
  newTasks: number
  avgPct: number
  pctDelta: number | null
  health: 'green' | 'yellow' | 'red'
}
export const fetchProjects = (date?: string) =>
  get<{ date: string | null; projects: ProjectRow[] }>(`/scoring/projects${date ? `?date=${date}` : ''}`)

export interface PeriodSummary {
  period: string
  days: number
  avgScore: number
  medianScore: number
  totalScore: number
  anomalyDays: number
  best: { date: string; score: number } | null
  worst: { date: string; score: number } | null
}
export interface LeaderEntry {
  personId: number
  name: string
  latest: PeriodSummary | null
  periods: PeriodSummary[]
}
export const fetchLeaderboard = (period: 'month' | 'year') =>
  get<{ period: string; entries: LeaderEntry[] }>(`/scoring/leaderboard?period=${period}`)

export interface FeedCode {
  commits: number
  substantiveCommits: number
  effectiveLoc: number
  taskLinkedCommits: number
  confidence: 'high' | 'medium' | 'low'
  flags: string[]
  sampleMessages: string[]
  repos: string[]
}
export interface FeedDigest {
  totalBlocked: number
  anomalies: number
  committers: number
  noActivity: number
  linkageRate: number | null
  unlinkedCommitters: number
  topRisks: { kind: string; severity: string; subject: string; assignee: string; ageDays: number }[]
}
export interface FeedEntry {
  personId: number
  name: string
  opName: string | null
  summary: string
  score: number
  completion: number
  workload: number
  isAnomaly: boolean
  reason: string | null
  defense: 'pending' | 'confirmed' | 'unresponsive' | null
  tasks: { inProgress: number; blocked: number; completedRecent: number; topBlocked: { id: number; subject: string; ageHours: number }[] }
  code: FeedCode | null
  comments: { count: number; latest: { author: string | null; body: string; date: string } | null }
}
export interface BlockerProject {
  project: string
  count: number
  items: { id: number; subject: string; assignee: string; ageDays: number; severity: string }[]
}
export const fetchFeed = (date?: string, lang: string = 'zh') =>
  get<{ date: string | null; entries: FeedEntry[]; digest: FeedDigest; blockersByProject: BlockerProject[] }>(`/scoring/feed?lang=${lang}${date ? `&date=${date}` : ''}`)
export const fetchDates = () => get<{ dates: string[] }>(`/scoring/dates`)

export interface TaskLite {
  id: number
  subject: string
  project?: string
  assignee?: string
  status: string
  priority: string
  pct: number | null
  ageHours: number
}
export interface PersonTasks {
  person: { personId: number; name: string; opName: string }
  inProgress: TaskLite[]
  blocked: TaskLite[]
  completedRecent: TaskLite[]
}
export const fetchPersonTasks = (id: number) => get<PersonTasks>(`/scoring/person/${id}/tasks`)

export type RiskKind = 'blocker' | 'stale' | 'high_pri_idle'
export type RiskSeverity = 'warn' | 'high' | 'critical'
export interface Risk {
  kind: RiskKind
  taskId: number
  subject: string
  assignee: string
  status: string
  detail: string
  severity: RiskSeverity
  ageDays: number
}
export interface Comment { id: number; targetType: string; targetId: string; date: string; author: string | null; body: string; createdAt: string }
export const fetchComments = (targetType: string, targetId: string) =>
  get<{ comments: Comment[] }>(`/scoring/comments?targetType=${targetType}&targetId=${encodeURIComponent(targetId)}`)
export const addComment = (b: { targetType: string; targetId: string; date?: string; author?: string; body: string }) =>
  post<{ ok: boolean }>(`/scoring/comments`, b)

export interface GanttTask { id: number; subject: string; assignee: string; status: string; pct: number | null; start: string; end: string | null }
export interface ProjectPerson { name: string; total: number; inProgress: number; blocked: number; closed: number }
export interface ProjectTrendPoint { date: string; avgPct: number; blocked: number; inProgress: number; totalTasks: number }
export interface ProjectDetail {
  name: string
  summary: string
  counts: { active: number; inProgress: number; blocked: number; closed: number }
  trend: ProjectTrendPoint[]
  people: ProjectPerson[]
  gantt: GanttTask[]
  inProgress: TaskLite[]
  blocked: TaskLite[]
  risks: Risk[]
}
export const fetchProjectDetail = (name: string, lang: string = 'zh') =>
  get<ProjectDetail>(`/scoring/project?name=${encodeURIComponent(name)}&lang=${lang}`)

export interface PersonAnalysis {
  person: { personId: number; name: string; opName: string; gitEmails: string[]; active: boolean }
  from: string
  to: string
  label: string
  summary: string
  tasks: { inProgress: TaskLite[]; blocked: TaskLite[]; completedRecent: TaskLite[] }
  code: {
    commits: number; effectiveLoc: number; substantiveCommits: number; taskLinkedCommits: number
    linkageRate: number | null; repos: string[]; flags: string[]; sampleMessages: string[]
    daily: { date: string; commits: number; effectiveLoc: number; confidence: string }[]
  }
  scores: { date: string; score: number; completion: number; workload: number; isAnomaly: boolean; reason: string | null }[]
  dependencies: { dependsOn: { name: string; count: number }[]; blocking: { name: string; count: number }[]; related: { name: string; count: number }[] }
  absences: AbsenceLite[]
}
export const fetchPersonAnalysis = (id: number, from: string, to: string, label: string, lang: string = 'zh') =>
  get<PersonAnalysis>(`/scoring/person/${id}/analysis?from=${from}&to=${to}&label=${encodeURIComponent(label)}&lang=${lang}`)

export interface Monthly {
  month: string
  totals: { closed: number; commits: number; effectiveLoc: number; activePeople: number }
  projects: { name: string; closed: number; active: number; blocked: number; avgPct: number }[]
  series: { date: string; closed: number; commits: number }[]
}
export const fetchMonthly = (month?: string) => get<Monthly>(`/scoring/monthly${month ? `?month=${month}` : ''}`)

export interface Matrix {
  projects: { name: string; active: number; blocked: number }[]
  people: { personId: number; name: string; active: number; blocked: number }[]
  cells: { personId: number; project: string; active: number; blocked: number }[]
}
export const fetchMatrix = () => get<Matrix>(`/scoring/matrix`)

export interface RosterPerson { personId: number; name: string; opName: string }
export const fetchRoster = () => get<{ roster: RosterPerson[] }>(`/scoring/roster`)

export interface AbsenceRow {
  id: number
  personId: number
  startDate: string
  endDate: string
  type: string
  note: string | null
}
export const fetchAbsences = () => get<{ absences: AbsenceRow[] }>(`/scoring/absences`)
export const addAbsence = (b: {
  personId: number
  startDate: string
  endDate: string
  type: string
  note?: string
}) => post<{ ok: boolean }>(`/scoring/absences`, b)

// ─── activity rhythm (reference signal, NOT a timesheet) ──
export interface RhythmDay {
  personId: number
  date: string
  firstAt: string | null
  lastAt: string | null
  spanMinutes: number | null
  activeHours: number | null
  estWorkMinutes: number | null
  confidence: string | null
  eventCount: number
  hist: number[]
  sources: { git: number; op: number }
  nightFlag: boolean
  weekendFlag: boolean
}
export interface Rhythm {
  personId: number
  from: string
  to: string
  note: string
  perDay: RhythmDay[]
  aggregate: { hist: number[]; nightDays: number; weekendActiveDays: number; days: number }
}
export const fetchRhythm = (id: number, from: string, to: string, lang: 'zh' | 'en' = 'zh') =>
  get<Rhythm>(`/scoring/person/${id}/rhythm?from=${from}&to=${to}&lang=${lang}`)

export interface RhythmBoard {
  date: string | null
  rhythms: RhythmDay[]
  note?: string
}
export const fetchRhythmBoard = (date?: string) =>
  get<RhythmBoard>(`/scoring/rhythm/board${date ? `?date=${date}` : ''}`)
