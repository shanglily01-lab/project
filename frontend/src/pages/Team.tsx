/**
 * Scoreboard — public, transparent daily productivity board.
 * Per-person score (completion + workload), anomaly flags, rank, plus
 * project advancement. Click a person to open their scorecard.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchBoard, fetchProjects, fetchRhythmBoard, fetchDates, type Board, type ProjectRow, type RhythmDay } from '@/api/scoring'
import { useI18n } from '@/i18n'

function StatusBadge({ p, board }: { p: Board['people'][number]; board: Board }) {
  if (p.isAnomaly) {
    return <span className="chip" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>⚠ {p.reason}</span>
  }
  if (board.highestId === p.personId && p.score > 0)
    return <span className="chip" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>🔼 top</span>
  if (board.lowestId === p.personId && p.score > 0)
    return <span className="chip" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>🔽 low</span>
  const grey = p.reason === 'warmup' || p.reason === 'absent'
  return <span className="chip chip-grey" style={{ color: grey ? 'var(--muted)' : '#22C55E' }}>{p.reason ?? 'normal'}</span>
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 60 ? '#22C55E' : score >= 30 ? '#5B8DEF' : score > 0 ? '#F59E0B' : 'var(--border)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span className="mono" style={{ fontWeight: 700, minWidth: 22, textAlign: 'right' }}>{score}</span>
    </div>
  )
}

const HEALTH_COLOR: Record<string, string> = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' }

const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }) : ''

// 24-cell mini histogram of commits per local hour (night hours amber).
function MiniHist({ hist }: { hist: number[] }) {
  const max = Math.max(1, ...hist)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, height: 16, marginLeft: 8, verticalAlign: 'middle' }} title="0–23 时(本地)提交分布">
      {hist.map((n, h) => (
        <span key={h} style={{
          width: 2,
          height: `${n ? Math.max(2, Math.round((n / max) * 16)) : 1}px`,
          background: n ? (h < 6 ? '#F59E0B' : '#5B8DEF') : 'var(--border)',
          borderRadius: 1,
        }} />
      ))}
    </span>
  )
}

// Active-window cell — git commit times, Asia/Shanghai. Reference, not a timesheet.
function RhythmCell({ r }: { r?: RhythmDay }) {
  if (!r || r.eventCount === 0) return <span style={{ color: 'var(--muted)' }}>—</span>
  const estH = r.estWorkMinutes != null ? (r.estWorkMinutes / 60).toFixed(1) : null
  return (
    <span
      className="mono"
      title={`估计工时(会话法)≈${estH ?? '?'}h · 活跃 ${r.activeHours ?? 0}h · 置信度 ${r.confidence ?? '?'} · 来源 git${r.sources.git}/op${r.sources.op} — 估计值,非打卡`}
      style={{ fontSize: 12, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
    >
      {hhmm(r.firstAt)}–{hhmm(r.lastAt)}
      {estH && <span style={{ color: 'var(--muted)' }}> · ≈{estH}h</span>}
      {r.nightFlag && <span title="夜间(0–6点)提交" style={{ marginLeft: 4 }}>🌙</span>}
      {r.weekendFlag && <span title="周末活跃" style={{ marginLeft: 2 }}>📅</span>}
      <MiniHist hist={r.hist} />
    </span>
  )
}

export default function Team() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [board, setBoard] = useState<Board | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [rhythm, setRhythm] = useState<Map<number, RhythmDay>>(new Map())
  const [date, setDate] = useState<string>('')
  const [dates, setDates] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { fetchDates().then((r) => { setDates(r.dates); setDate(r.dates[0] ?? '') }).catch(() => {}) }, [])

  useEffect(() => {
    fetchBoard(date || undefined).then(setBoard).catch((e) => setErr(e.message))
    fetchProjects(date || undefined).then((r) => setProjects(r.projects)).catch(() => {})
    fetchRhythmBoard(date || undefined).then((rb) => setRhythm(new Map(rb.rhythms.map((r) => [r.personId, r])))).catch(() => {})
  }, [date])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed to load: {err}</div></div></div>
  if (!board) return <div className="page"><div className="card"><div className="card-body">Loading…</div></div></div>

  const anomalies = board.people.filter((p) => p.isAnomaly).length

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>
          {t('看板', 'Scoreboard')}
          <span className="subtitle">
            {board.date ?? '—'} · {board.people.length} {t('人', 'tracked')} · {anomalies} {t('异常', 'anomalies')} · {t('全员可见', 'transparent to all')}
          </span>
        </div>
        <select value={date} onChange={(e) => setDate(e.target.value)} className="form-select" style={{ fontSize: 12, padding: '5px 10px' }}>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* ── Score table ── */}
      <div className="card mb-16">
        <div className="card-head">{t('每日产出评分', 'Daily Productivity Score')}</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>{t('姓名', 'Person')}</th>
                <th style={{ width: 160 }}>{t('评分', 'Score')}</th>
                <th className="num">{t('完成', 'Completion')}</th>
                <th className="num">{t('工作量', 'Workload')}</th>
                <th className="num">{t('活跃', 'Active')}</th>
                <th className="num">{t('进行', 'WIP')}</th>
                <th className="num">{t('阻塞', 'Blocked')}</th>
                <th>{t('状态', 'Status')}</th>
                <th title={t('基于 git 提交时间,非工时/考核', 'from git commit times — not a timesheet')}>{t('活跃时段', 'Active hrs')}</th>
              </tr>
            </thead>
            <tbody>
              {board.people.map((p, i) => (
                <tr
                  key={p.personId}
                  onClick={() => navigate(`/scorecard/${p.personId}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="num mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{p.name ?? p.opName}</td>
                  <td><ScoreBar score={p.score} /></td>
                  <td className="num mono">{p.completion}</td>
                  <td className="num mono">{p.workload}</td>
                  <td className="num mono">{p.totalTasks ?? '—'}</td>
                  <td className="num mono pos">{p.inProgress ?? 0}</td>
                  <td className="num mono" style={{ color: (p.blocked ?? 0) > 0 ? '#EF4444' : 'var(--muted)' }}>{p.blocked ?? 0}</td>
                  <td><StatusBadge p={p} board={board} /></td>
                  <td onClick={(e) => e.stopPropagation()}><RhythmCell r={rhythm.get(p.personId)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project advancement ── */}
      <div className="card">
        <div className="card-head">{t('项目推进', 'Project Advancement')} — {board.date}</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('项目', 'Project')}</th>
                <th className="num">{t('活跃', 'Active')}</th>
                <th className="num">{t('进行', 'WIP')}</th>
                <th className="num">{t('阻塞', 'Blocked')}</th>
                <th className="num">{t('已关闭', 'Closed')}</th>
                <th className="num">{t('平均%', 'Avg%')}</th>
                <th className="num">{t('Δ今日', 'Δ today')}</th>
                <th>{t('健康度', 'Health')}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectName} onClick={() => navigate(`/project/${encodeURIComponent(p.projectName)}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{p.projectName}</td>
                  <td className="num mono">{p.totalTasks}</td>
                  <td className="num mono pos">{p.inProgress}</td>
                  <td className="num mono" style={{ color: p.blocked > 0 ? '#EF4444' : 'var(--muted)' }}>{p.blocked}</td>
                  <td className="num mono" style={{ color: 'var(--muted)' }}>{p.closed}</td>
                  <td className="num mono">{p.avgPct}%</td>
                  <td className="num mono" style={{ color: (p.pctDelta ?? 0) > 0 ? '#22C55E' : (p.pctDelta ?? 0) < 0 ? '#EF4444' : 'var(--muted)' }}>
                    {p.pctDelta === null ? '—' : (p.pctDelta > 0 ? `+${p.pctDelta}` : p.pctDelta)}
                  </td>
                  <td><span className="health-dot" style={{ background: HEALTH_COLOR[p.health] }} /> {p.health}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
