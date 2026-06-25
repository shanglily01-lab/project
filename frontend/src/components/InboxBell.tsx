/**
 * 行动队列 — global Action-Required inbox as a topbar bell + popover.
 * Bell shows the pending-card count; clicking opens a dropdown with the cards
 * (≤5, SLA order) + merged-overflow line + aged-out digest. Decisions:
 * 批准 / 驳回(必选理由码) → ai_feedback. Live via socket 'inbox-updated'.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { fetchInbox, approveAgentAction, rejectAgentAction, type AgentAction, type Inbox, type ReasonCode } from '@/api/agent'
import { useSyphonixStore } from '@/store/syphonixStore'
import { useCurrentUser } from '@/currentUser'
import { useI18n } from '@/i18n'

const AGENT_NAMES: Record<string, { zh: string; en: string }> = {
  score: { zh: '评分员', en: 'Score' },
  linkage: { zh: '关联员', en: 'Linkage' },
  blocker: { zh: '协调员', en: 'Blocker' },
  care: { zh: '关怀员', en: 'Care' },
  absence: { zh: '事务员', en: 'Admin' },
}
const REASONS: { code: ReasonCode; zh: string; en: string }[] = [
  { code: 'bad_params', zh: '参数不当', en: 'bad params' },
  { code: 'bad_timing', zh: '时机不当', en: 'bad timing' },
  { code: 'should_not_propose', zh: '不应提出', en: 'should not propose' },
  { code: 'data_error', zh: '数据有误', en: 'data error' },
]

function slaLabel(deadline: string | null, t: (zh: string, en: string) => string): { text: string; urgent: boolean } {
  if (!deadline) return { text: '', urgent: false }
  const ms = new Date(deadline).getTime() - Date.now()
  if (ms <= 0) return { text: t('已超时', 'overdue'), urgent: true }
  const h = Math.floor(ms / 3_600_000)
  return { text: h < 1 ? `${Math.max(1, Math.round(ms / 60_000))}m` : `${h}h`, urgent: h < 4 }
}

function Card({ a, by, onDecided }: { a: AgentAction; by: string; onDecided: () => void }) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const p = a.payload as { message?: string; severity?: string; kind?: string }
  const sla = slaLabel(a.slaDeadline, t)
  const agent = AGENT_NAMES[a.agentSlug]

  const decide = async (approve: boolean, reasonCode?: ReasonCode) => {
    setBusy(true)
    setErr(null)
    try {
      if (approve) await approveAgentAction(a.id, by)
      else await rejectAgentAction(a.id, by, reasonCode!)
      onDecided()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`inbox-card severity-${p.severity ?? 'warn'}`}>
      <div className="inbox-card-head">
        <span className="inbox-card-src">{agent ? (lang === 'zh' ? agent.zh : agent.en) : a.agentSlug} · {p.kind ?? a.actionType}</span>
        {sla.text && <span className="chip chip-grey mono" style={{ flexShrink: 0, color: sla.urgent ? '#EF4444' : 'var(--muted)' }}>⏳ {sla.text}</span>}
      </div>
      <div className="inbox-card-msg" title={p.message ?? a.actionType}>{p.message ?? a.actionType}</div>
      {a.evidence.length > 0 && (
        <div className="inbox-card-evidence">📎 {a.evidence.map((ev) => `${ev.table}#${ev.id}`).join(' · ')}</div>
      )}
      {err && <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 4 }}>{err}</div>}
      <div className="inbox-actions">
        <button className="btn btn-sm btn-accent" disabled={busy} onClick={() => decide(true)}>{t('批准', 'Approve')}</button>
        <select
          defaultValue=""
          disabled={busy}
          onChange={(e) => { if (e.target.value) decide(false, e.target.value as ReasonCode) }}
          className="form-select"
          style={{ fontSize: 11, padding: '4px 6px' }}
        >
          <option value="" disabled>{t('驳回…', 'Reject…')}</option>
          {REASONS.map((r) => <option key={r.code} value={r.code}>{t(r.zh, r.en)}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function InboxBell() {
  const { t } = useI18n()
  const { user } = useCurrentUser()
  const inboxVersion = useSyphonixStore((s) => s.inboxVersion)
  const [inbox, setInbox] = useState<Inbox | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    fetchInbox().then((r) => { setInbox(r); setFailed(false) }).catch(() => setFailed(true))
  }, [])
  useEffect(() => { load() }, [load, inboxVersion])

  // close on click outside / Escape
  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) setOpen(false) }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const by = user?.name ?? 'unknown'
  const cards = inbox?.cards ?? []
  const count = cards.length

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-sm"
        title={t('行动队列', 'Action Required')}
        style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}
      >
        <Bell size={13} />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px',
            background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700,
            borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{count}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', zIndex: 60,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)', padding: 10,
        }}>
          <div className="flex-between" style={{ marginBottom: 8 }}>
            <span className="font-heading" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>📥 {t('行动队列', 'Action Required')}</span>
            {count > 0 && <span className="chip chip-amber">{count}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {failed ? (
              <div className="inbox-empty">{t('暂不可用', 'Unavailable')}</div>
            ) : !inbox ? (
              <div className="inbox-empty">{t('加载中…', 'Loading…')}</div>
            ) : count === 0 ? (
              <div className="inbox-empty">{t('队列已清空 ✓', 'All clear ✓')}</div>
            ) : (
              cards.map((a) => <Card key={a.id} a={a} by={by} onDecided={load} />)
            )}
            {!!inbox && inbox.overflow > 0 && (
              <div className="inbox-merged">{t(`其余 ${inbox.overflow} 条已归并至日终摘要`, `${inbox.overflow} more merged into the digest`)}</div>
            )}
          </div>

          {!!inbox && inbox.digest.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {t('日终摘要(超时降级)', 'Digest (aged out)')}
              </div>
              {inbox.digest.map((d) => <div key={d.id} style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>· {d.summary}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
