/**
 * Agent layer API — typed-action proposal cards and decisions.
 * Rejects require one of the four reason codes (enforced server-side).
 */
import { get, post } from './client'

export type ActionStatus = 'proposed' | 'approved' | 'rejected' | 'expired' | 'executed'
export type ReasonCode = 'bad_params' | 'bad_timing' | 'should_not_propose' | 'data_error'

export interface AgentAction {
  id: number
  agentSlug: string
  actionType: string
  targetType: string
  targetId: string
  payload: Record<string, unknown>
  evidence: { table: string; id: number | string; summary: string }[]
  status: ActionStatus
  visibility: 'self' | 'manager_private' | 'team'
  decidedBy: string | null
  decidedAt: string | null
  reasonCode: string | null
  slaDeadline: string | null
  createdAt: string
}

export interface LinkSuggestionPayload {
  sha: string
  repo: string
  day: string
  taskId: number
  taskSubject: string
  messageSubject: string
  confidence: 'high' | 'medium'
  basis: 'keyword' | 'llm'
}

export const fetchAgentActions = (q: { status?: ActionStatus; actionType?: string; targetType?: string; targetId?: string }) => {
  const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined) as [string, string][])
  return get<{ count: number; actions: AgentAction[] }>(`/ai/agent/actions?${params}`)
}

export interface Inbox {
  cards: AgentAction[]
  overflow: number
  digest: { id: number; agentSlug: string; actionType: string; summary: string; expiredAt: string | null }[]
}

export const fetchInbox = () => get<Inbox>(`/ai/agent/inbox`)

// ─── crew roster + autonomy (班组页) ───
export interface ActionTierStats {
  actionType: string
  tier: 'proposal' | 'autonomous' | 'self_confirm'
  promotable: boolean
  pendingApprover: string | null
  approvals: number
  rejections: number
  rate: number | null
  weeks: { approvals: number; rejections: number }[]
  verdict: 'suggest_promote' | 'demote' | 'hold'
}
export interface CrewAgent {
  slug: string
  name: string
  watches: string
  actions: string[]
  defaultTier: 'autonomous' | 'proposal'
  guardrails: string
  actionStats: ActionTierStats[]
}
export const fetchCrew = () => get<{ agents: CrewAgent[] }>(`/ai/agent/crew`)
export const promoteCrewAction = (slug: string, actionType: string, by: string) =>
  post<{ ok: boolean; promoted: boolean }>(`/ai/agent/crew/${slug}/promote`, { actionType, by })
export const demoteCrewAction = (slug: string, actionType: string, by: string) =>
  post<{ ok: boolean }>(`/ai/agent/crew/${slug}/demote`, { actionType, by })

export const approveAgentAction = (id: number, by: string) =>
  post<{ ok: boolean; action: AgentAction }>(`/ai/agent/actions/${id}/approve`, { by })

export const rejectAgentAction = (id: number, by: string, reasonCode: ReasonCode) =>
  post<{ ok: boolean; action: AgentAction }>(`/ai/agent/actions/${id}/reject`, { by, reasonCode })
