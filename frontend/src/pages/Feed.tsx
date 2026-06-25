/**
 * Daily Feed — standup + report replacement, organized as a TRIAGE board:
 *   1) Team KPI strip        2) Project blockers board (full width)
 *   3) People grouped by attention level — ⚠️ needs attention / ⛔ has blockers
 *      / ✅ on track (collapsible) — beside a sticky Action-Required rail.
 * The point of a standup is to surface problems, so the worst rises to the top.
 */
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFeed, fetchDates, addComment, type FeedEntry, type FeedDigest, type BlockerProject } from '@/api/scoring'
import { useI18n } from '@/i18n'
import { useCurrentUser } from '@/currentUser'

const SEV: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', warn: '#9CA3AF' }
const CONF_CHIP: Record<string, string> = { high: 'chip-green', medium: 'chip-amber', low: 'chip-red' }
const AVATAR = ['#d9a93c', '#5b8def', '#22C55E', '#8B5CF6', '#06B6D4', '#EF4444']
const days = (h: number) => (h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`)
const initials = (n: string) => n.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

// ── team KPI strip ──
function KpiStrip({ d }: { d: FeedDigest }) {
  const { t } = useI18n()
  const crit = d.topRisks.filter((r) => r.severity === 'critical').length
  const stat = (cls: string, label: string, val: number | string, color: string) => (
    <div className={`dash-stat ${cls}`}>
      <div className="ds-label">{label}</div>
      <div className="ds-val" style={{ color }}>{val}</div>
    </div>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
      {stat('s-green', t('有提交', 'Committers'), d.committers, 'var(--buy)')}
      {stat('s-amber', t('无产出', 'No activity'), d.noActivity, d.noActivity ? '#F59E0B' : 'var(--muted)')}
      {stat('s-red', t('阻塞任务', 'Blocked'), d.totalBlocked, d.totalBlocked ? 'var(--sell)' : 'var(--muted)')}
      {stat('s-red', t('严重风险', 'Critical'), crit, crit ? 'var(--sell)' : 'var(--muted)')}
      {stat('s-blue', t('任务关联率', 'Link rate'), `${d.linkageRate ?? 0}%`, 'var(--accent)')}
      {stat('s-purple', t('异常', 'Anomalies'), d.anomalies, d.anomalies ? 'var(--sell)' : 'var(--muted)')}
    </div>
  )
}

// ── project blockers board (full width) ──
function BlockerBoard({ projects }: { projects: BlockerProject[] }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  if (projects.length === 0) return null
  return (
    <div className="mb-16">
      <div className="page-title" style={{ fontSize: 12, marginBottom: 8 }}>🚨 {t('项目阻塞看板', 'Project Blockers')}
        <span className="subtitle">{t('按项目分组，需协调解决', 'grouped by project — coordinate to unblock')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
        {projects.map((p) => {
          const worst = p.items.some((i) => i.severity === 'critical') ? 'critical' : p.items.some((i) => i.severity === 'high') ? 'high' : 'warn'
          return (
            <div key={p.project} className={`alert-card severity-${worst}`}>
              <div className="flex-between" style={{ marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate(`/project/${encodeURIComponent(p.project)}`)}>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{p.project}</span>
                <span className="chip chip-red">⛔ {p.count}</span>
              </div>
              {p.items.map((it) => (
                <div key={it.id} className="list-row" style={{ padding: '3px 0' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '64%' }}>
                    <span className="health-dot" style={{ background: SEV[it.severity], marginRight: 6 }} />#{it.id} {it.subject}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{it.assignee} · <b style={{ color: SEV[it.severity] }}>{it.ageDays}d</b></span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── one person, compact triage card with inline review ──
function PersonCard({ e, lane, onPosted }: { e: FeedEntry; lane: 'attention' | 'blocked' | 'ok'; onPosted: () => void }) {
  const { t } = useI18n()
  const { user } = useCurrentUser()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const c = e.code

  const post = async () => {
    if (!body.trim() || !user) return
    setSaving(true)
    try { await addComment({ targetType: 'person', targetId: String(e.personId), author: user.name, body }); setBody(''); setOpen(false); onPosted() }
    finally { setSaving(false) }
  }

  return (
    <div className={`person-card lane-${lane}`}>
      <div className="person-card-top">
        <div className="feed-avatar" style={{ background: AVATAR[e.personId % AVATAR.length] }}>{initials(e.name)}</div>
        <span className="person-card-name" onClick={() => navigate(`/scorecard/${e.personId}`)}>{e.name}</span>
        <span className="person-card-badges">
          {e.isAnomaly && (
            <span className="chip chip-red" title={e.defense === 'unresponsive' ? t('自辩窗已过,本人未回应', 'no response') : e.defense === 'confirmed' ? t('本人已确认', 'confirmed') : undefined}>
              ⚠ {e.reason}{e.defense === 'unresponsive' ? ` · ${t('未回应', 'no resp')}` : e.defense === 'confirmed' ? ` · ${t('已确认', 'ok')}` : ''}
            </span>
          )}
          {c && <span className={`chip ${CONF_CHIP[c.confidence]}`}>{c.confidence}</span>}
          {e.score > 0 && <span className="chip chip-blue mono">{e.score}</span>}
        </span>
      </div>

      <div className="person-summary">{e.summary}</div>

      <div className="person-stats">
        {c
          ? <span>💻 <b>{c.commits}</b> {t('提交', 'commits')} · <b>{c.effectiveLoc.toLocaleString()}</b> {t('行', 'LOC')}</span>
          : <span style={{ color: 'var(--muted)' }}>💤 {t('无提交', 'no commits')}</span>}
        {e.tasks.inProgress > 0 && <span>🔧 <b>{e.tasks.inProgress}</b></span>}
        {e.tasks.blocked > 0 && <span style={{ color: '#F59E0B' }}>⛔ <b>{e.tasks.blocked}</b></span>}
        {e.tasks.completedRecent > 0 && <span style={{ color: 'var(--buy)' }}>✅ <b>{e.tasks.completedRecent}</b></span>}
      </div>

      {e.tasks.topBlocked.length > 0 && (
        <div className="person-blockers">
          {e.tasks.topBlocked.slice(0, 2).map((b) => (
            <span key={b.id} style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={b.subject}>
              <span className="health-dot" style={{ background: '#EF4444', marginRight: 6 }} />#{b.id} {b.subject} · <b style={{ color: '#EF4444' }}>{days(b.ageHours)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="person-review">
        {e.comments.latest && (
          <div style={{ color: 'var(--text2)', marginBottom: 4 }}>
            📝 <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{e.comments.latest.author}</span>: {e.comments.latest.body}
            {e.comments.count > 1 && <span style={{ color: 'var(--muted)' }}> · {e.comments.count}</span>}
          </div>
        )}
        {!open ? (
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen(true)}>+ {t('点评', 'Review')}</button>
        ) : !user ? (
          <span style={{ color: 'var(--muted)' }}>{t('请先在右上角选择身份', 'Pick identity (top-right)')}</span>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <input autoFocus value={body} onChange={(ev) => setBody(ev.target.value)} placeholder={`${user.name} — ${t('点评…', 'review…')}`}
              onKeyDown={(ev) => { if (ev.key === 'Enter') post() }}
              className="form-input" style={{ flex: 1, padding: '5px 8px', fontSize: 12 }} />
            <button className="btn btn-sm btn-accent" disabled={saving || !body.trim()} onClick={post}>{t('发布', 'Post')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>×</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── a triage lane: header (count + optional collapse) + person grid ──
function TriageGroup({ lane, icon, label, entries, defaultCollapsed, onPosted }: {
  lane: 'attention' | 'blocked' | 'ok'
  icon: string; label: string; entries: FeedEntry[]; defaultCollapsed?: boolean; onPosted: () => void
}) {
  const [collapsed, setCollapsed] = useState(!!defaultCollapsed)
  if (entries.length === 0) return null
  const collapsible = !!defaultCollapsed
  return (
    <div className="triage-group">
      <div className={`triage-head triage-${lane} ${collapsible ? 'clickable' : ''}`} onClick={collapsible ? () => setCollapsed((v) => !v) : undefined}>
        <span>{icon} {label}</span>
        <span className="triage-count">{entries.length}</span>
        {collapsible && <span className="triage-caret">{collapsed ? '▶ 展开' : '▼ 折叠'}</span>}
      </div>
      {!collapsed && (
        <div className="person-grid">
          {entries.map((e) => <PersonCard key={e.personId} e={e} lane={lane} onPosted={onPosted} />)}
        </div>
      )}
    </div>
  )
}

export default function Feed() {
  const { t, lang } = useI18n()
  const [date, setDate] = useState<string>('')
  const [dates, setDates] = useState<string[]>([])
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [digest, setDigest] = useState<FeedDigest | null>(null)
  const [blockers, setBlockers] = useState<BlockerProject[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchDates().then((r) => { setDates(r.dates); setDate(r.dates[0] ?? '') }).catch((e) => setErr(e.message))
  }, [])

  const load = useCallback(() => {
    if (!date) return
    fetchFeed(date, lang).then((r) => { setEntries(r.entries); setDigest(r.digest); setBlockers(r.blockersByProject) }).catch((e) => setErr(e.message))
  }, [date, lang])
  useEffect(() => { load() }, [load])

  // triage: a person needs attention if anomalous or fully idle; otherwise
  // blocked if they hold ≥1 blocker; otherwise on track.
  const { attention, blocked, ok } = useMemo(() => {
    const isIdle = (e: FeedEntry) => !e.code && e.tasks.inProgress === 0 && e.tasks.completedRecent === 0
    const attention: FeedEntry[] = []
    const blocked: FeedEntry[] = []
    const ok: FeedEntry[] = []
    for (const e of entries) {
      if (e.isAnomaly || isIdle(e)) attention.push(e)
      else if (e.tasks.blocked > 0) blocked.push(e)
      else ok.push(e)
    }
    attention.sort((a, b) => a.score - b.score) // worst first
    blocked.sort((a, b) => b.tasks.blocked - a.tasks.blocked)
    ok.sort((a, b) => (b.code?.commits ?? 0) - (a.code?.commits ?? 0) || b.score - a.score)
    return { attention, blocked, ok }
  }, [entries])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>
          {t('每日动态', 'Daily Feed')}
          <span className="subtitle">{entries.length} {t('人 · 按需关注程度分诊 · 替代站会与日报', 'people · triaged by attention · replaces standups')}</span>
        </div>
        <select value={date} onChange={(e) => setDate(e.target.value)} className="form-select" style={{ fontSize: 12, padding: '5px 10px' }}>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* team-wide context spans full width */}
      {digest && <KpiStrip d={digest} />}
      <BlockerBoard projects={blockers} />

      {/* triage lanes (full width; the action queue now lives in the topbar bell) */}
      <TriageGroup lane="attention" icon="⚠️" label={t('需要关注', 'Needs attention')} entries={attention} onPosted={load} />
      <TriageGroup lane="blocked" icon="⛔" label={t('有阻塞', 'Has blockers')} entries={blocked} onPosted={load} />
      <TriageGroup lane="ok" icon="✅" label={t('正常推进', 'On track')} entries={ok} defaultCollapsed onPosted={load} />
      {entries.length === 0 && <div className="card"><div className="card-body" style={{ color: 'var(--muted)' }}>{t('当日暂无动态。', 'No activity for this day.')}</div></div>}
    </div>
  )
}
