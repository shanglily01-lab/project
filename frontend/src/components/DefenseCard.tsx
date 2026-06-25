/**
 * 自辩窗 — the person's own anomaly notice (visibility=self, 4h SLA).
 * 确认无误 → the anomaly enters the manager view marked "本人已确认";
 * filing an absence (form below on the scorecard) clears it automatically.
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchAgentActions, approveAgentAction, type AgentAction } from '@/api/agent'
import { useI18n } from '@/i18n'

export default function DefenseCard({ personId, by, onChanged }: { personId: number; by: string; onChanged?: () => void }) {
  const { t } = useI18n()
  const [notices, setNotices] = useState<AgentAction[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetchAgentActions({ status: 'proposed', actionType: 'anomalyNotice', targetType: 'person', targetId: String(personId) })
      .then((r) => setNotices(r.actions))
      .catch(() => setNotices([]))
  }, [personId])
  useEffect(() => { load() }, [load])

  if (notices.length === 0) return null

  const confirm = async (id: number) => {
    setBusy(true)
    try {
      await approveAgentAction(id, by)
      setNotices((prev) => prev.filter((n) => n.id !== id))
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-16" style={{ borderColor: '#F59E0B' }}>
      <div className="card-head">⏳ {t('待你回应:评分异常', 'Action needed: anomaly flagged')}
        <span className="subtitle">{t('4 小时内未回应将进入经理视图', 'enters the manager view after 4h of silence')}</span>
      </div>
      <div className="card-body" style={{ fontSize: 12 }}>
        {notices.map((n) => {
          const p = n.payload as { date?: string; reason?: string; score?: number }
          return (
            <div key={n.id} className="flex-between mb-8" style={{ gap: 8 }}>
              <span>
                {p.date} {t('评分', 'score')} <b className="mono">{p.score}</b>,{t('触发', 'flagged')} <span className="chip chip-amber">{p.reason}</span>
              </span>
              <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-sm" disabled={busy} onClick={() => void confirm(n.id)}>{t('确认无误', 'Confirm')}</button>
              </span>
            </div>
          )
        })}
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {t('当天请假/外出?在下方「请假记录」补登即可自动消除该异常。', 'On leave that day? File it in the Absences section below — the flag clears automatically.')}
        </div>
      </div>
    </div>
  )
}
