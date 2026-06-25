/**
 * 待确认关联 — Linkage Agent's pending suggestTaskLink cards for ONE person.
 * Confirm links the commit to the task (and lifts that day's confidence);
 * ignore rejects with a reason code so the flywheel learns. Visible on the
 * person's own scorecard only (visibility=self).
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchAgentActions, approveAgentAction, rejectAgentAction, type AgentAction, type LinkSuggestionPayload, type ReasonCode } from '@/api/agent'
import { useI18n } from '@/i18n'

const REASON_LABELS: { code: ReasonCode; zh: string; en: string }[] = [
  { code: 'bad_params', zh: '关联不对', en: 'wrong task' },
  { code: 'should_not_propose', zh: '不应提出', en: 'should not suggest' },
  { code: 'data_error', zh: '数据有误', en: 'data error' },
]

export default function LinkSuggestions({ personId, by, onApplied }: { personId: number; by: string; onApplied?: () => void }) {
  const { t } = useI18n()
  const [actions, setActions] = useState<AgentAction[]>([])
  const [busy, setBusy] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchAgentActions({ status: 'proposed', actionType: 'suggestTaskLink', targetType: 'person', targetId: String(personId) })
      .then((r) => setActions(r.actions))
      .catch(() => setActions([]))
  }, [personId])

  useEffect(() => { load() }, [load])

  const decide = async (id: number, approve: boolean, reasonCode?: ReasonCode) => {
    setBusy(id)
    setErr(null)
    try {
      if (approve) await approveAgentAction(id, by)
      else await rejectAgentAction(id, by, reasonCode!)
      setActions((prev) => prev.filter((a) => a.id !== id))
      if (approve) onApplied?.()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (actions.length === 0) return null

  return (
    <div className="card mb-16">
      <div className="card-head">
        {t('🔗 待确认关联', '🔗 Pending links')}
        <span className="subtitle">{t('关联员建议:确认后计入任务关联率,仅本人可见', 'Linkage Agent suggestions — confirming raises your link rate; visible to you only')}</span>
      </div>
      <div className="card-body" style={{ fontSize: 12 }}>
        {err && <div style={{ color: '#EF4444', marginBottom: 6 }}>{err}</div>}
        {actions.map((a) => {
          const p = a.payload as unknown as LinkSuggestionPayload
          return (
            <div key={a.id} className="flex-between mb-8" style={{ gap: 8, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.repo} · {p.sha.slice(0, 8)} · {p.messageSubject}
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                  → #{p.taskId} {p.taskSubject}
                  <span className="chip chip-grey" style={{ marginLeft: 6, color: p.confidence === 'high' ? '#22C55E' : '#F59E0B' }}>{p.confidence}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="btn btn-sm" disabled={busy === a.id} onClick={() => decide(a.id, true)}>
                  {t('确认', 'Confirm')}
                </button>
                <select
                  defaultValue=""
                  disabled={busy === a.id}
                  onChange={(e) => { if (e.target.value) decide(a.id, false, e.target.value as ReasonCode) }}
                  style={{ fontSize: 11, padding: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 4 }}
                >
                  <option value="" disabled>{t('忽略…', 'Ignore…')}</option>
                  {REASON_LABELS.map((r) => <option key={r.code} value={r.code}>{t(r.zh, r.en)}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
