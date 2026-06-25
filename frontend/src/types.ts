// ─── Frontend types mirroring backend shapes ───────────

export interface TaskState {
  id: number
  subject: string
  statusName: string
  priorityName: string
  assignee: string
  author: string
  projectName: string
  typeName: string
  pct: number | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonState {
  id: string
  name: string
  email?: string
  totalTasks: number
  inProgressTasks: number
  blockedTasks: number
  highPriorityTasks: number
  activeRate: number
  weeklyActivity: number
  health: 'green' | 'yellow' | 'red' | 'unknown'
}

export interface ProjectState {
  name: string
  totalTasks: number
  inProgressTasks: number
  blockedTasks: number
  newTasks: number
  highPriorityTasks: number
  health: 'green' | 'yellow' | 'red' | 'unknown'
}

export interface Change {
  id: number
  type: 'new' | 'status' | 'updated' | 'removed'
  detail: string
  subject: string
}

export type AlertSeverity = 'critical' | 'high' | 'warn' | 'info'

export interface Alert {
  type: string
  severity: AlertSeverity
  targetType: 'person' | 'task' | 'project'
  targetId: string
  message: string
  detail: string
  tasks: TaskState[]
}

// ─── Decision Types ───────────────────────────────────

export type DecisionType = 'ops.alert' | 'ops.escalation' | 'ops.reminder' | 'ops.weekly_report' | 'ops.daily_digest' | 'ops.reassign'
export type DecisionPriority = 'EMERGENCY' | 'HIGH' | 'NORMAL' | 'LOW'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DecisionStatus = 'PENDING' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'DISPATCHED'

export interface DecisionCard {
  type: DecisionType
  agentName: string
  confidence: number
  priority: DecisionPriority
  reasoning: string[]
  recommendation: Record<string, unknown>
  riskAssessment?: string
}

export interface Decision {
  id: string
  card: DecisionCard
  status: DecisionStatus
  riskLevel: RiskLevel
  createdAt: string
  timeoutAt?: string
  respondedAt?: string
  respondedBy?: string
  rejectReason?: string
}

export interface AgentResult {
  agent: string
  cards: DecisionCard[]
  cost: number
}
