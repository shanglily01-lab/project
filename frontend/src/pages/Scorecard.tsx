/**
 * Person Deep-Dive — what someone is working on, in detail, analysed over a
 * period (default 本周): narrative summary, score trend, task lists, code output
 * with anti-gaming confidence, inter-person dependencies, and absences.
 */
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { fetchPersonAnalysis, fetchPerson, fetchRhythm, addAbsence, type PersonAnalysis, type PersonDetail, type Rhythm } from '@/api/scoring'
import TaskList from '@/components/TaskList'
import Comments from '@/components/Comments'
import LinkSuggestions from '@/components/LinkSuggestions'
import DefenseCard from '@/components/DefenseCard'
import { useI18n } from '@/i18n'

const iso = (d: Date) => d.toISOString().slice(0, 10)
function range(kind: 'week' | 'month' | 'last30'): { from: string; to: string; label: string } {
  const now = new Date()
  const to = iso(now)
  if (kind === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to, label: '本月' }
  if (kind === 'last30') return { from: iso(new Date(now.getTime() - 29 * 86400000)), to, label: '近30天' }
  const dow = (now.getDay() + 6) % 7 // Mon=0
  return { from: iso(new Date(now.getTime() - dow * 86400000)), to, label: '本周' }
}

function DepCol({ title, edges, color }: { title: string; edges: { name: string; count: number }[]; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{title}</div>
      {edges.length === 0 ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>—</div> : edges.map((e) => (
        <div key={e.name} style={{ fontSize: 12, marginBottom: 2 }}>
          <span style={{ color }}>{e.name}</span> <span className="mono" style={{ color: 'var(--muted)' }}>×{e.count}</span>
        </div>
      ))}
    </div>
  )
}

export default function Scorecard() {
  const { id } = useParams()
  const personId = Number(id)
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [kind, setKind] = useState<'week' | 'month' | 'last30'>('week')
  const [a, setA] = useState<PersonAnalysis | null>(null)
  const [detail, setDetail] = useState<PersonDetail | null>(null)
  const [rhythm, setRhythm] = useState<Rhythm | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ startDate: '', endDate: '', type: 'vacation' })

  const load = useCallback(() => {
    const r = range(kind)
    fetchPersonAnalysis(personId, r.from, r.to, r.label, lang).then(setA).catch((e) => setErr(e.message))
    fetchPerson(personId).then(setDetail).catch(() => {})
    fetchRhythm(personId, r.from, r.to, lang).then(setRhythm).catch(() => {})
  }, [personId, kind, lang])

  useEffect(() => { load() }, [load])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>
  if (!a) return <div className="page"><div className="card"><div className="card-body">Loading…</div></div></div>

  const chart = a.scores.map((s) => ({ date: s.date.slice(5), score: s.score, completion: s.completion, workload: s.workload }))
  const c = a.code

  const submitAbsence = async () => {
    if (!form.startDate || !form.endDate) return
    await addAbsence({ personId, ...form })
    setForm({ startDate: '', endDate: '', type: 'vacation' })
    load()
  }

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate('/people')}>← {t('人员', 'People')}</span>
        &nbsp;/ {a.person.name}
        <span className="subtitle">{a.person.opName} · {a.person.gitEmails.join(', ')} · {a.from} → {a.to}</span>
      </div>

      {/* period selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {([['week', t('本周', 'This week')], ['month', t('本月', 'This month')], ['last30', t('近30天', 'Last 30d')]] as const).map(([k, lbl]) => (
          <button key={k} className="btn btn-sm" onClick={() => setKind(k as 'week' | 'month' | 'last30')}
            style={{ background: kind === k ? 'var(--accent)' : 'var(--surface)', color: kind === k ? '#fff' : 'var(--text)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* 本期概述 — the narrative */}
      <div className="card mb-16">
        <div className="card-head">{t('本期概述', 'Period summary')}</div>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>{a.summary}</div>
      </div>

      {/* score trend */}
      <div className="card mb-16">
        <div className="card-head">{t('评分趋势', 'Score trend')}</div>
        <div className="card-body" style={{ height: 200 }}>
          {chart.length === 0 ? <div style={{ color: 'var(--muted)' }}>本期暂无评分。</div> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
                <Line type="monotone" dataKey="score" stroke="#5B8DEF" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="completion" stroke="#22C55E" strokeWidth={1} dot={false} />
                <Line type="monotone" dataKey="workload" stroke="#F59E0B" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 在做什么 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <TaskList title={t('✅ 完成 (14d)', '✅ Done (14d)')} accent="#22C55E" tasks={a.tasks.completedRecent} showProject emptyHint={t('近 14 天无关闭。', 'No closures in 14d.')} />
        <TaskList title={t('🔧 进行中', '🔧 In progress')} accent="#5B8DEF" tasks={a.tasks.inProgress} showProject emptyHint={t('无进行中。', 'Nothing in progress.')} />
        <TaskList title={t('⛔ 阻塞', '⛔ Blocked')} accent="#EF4444" tasks={a.tasks.blocked} showProject emptyHint={t('无阻塞。', 'No blockers.')} />
      </div>

      {/* 自辩窗 — anomaly reaches the person before the manager */}
      <DefenseCard personId={personId} by={a.person.opName} onChanged={load} />

      {/* 待确认关联 — confirming refreshes the analysis (link rate / confidence) */}
      <LinkSuggestions personId={personId} by={a.person.opName} onApplied={load} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 代码产出 */}
        <div className="card">
          <div className="card-head">{t('代码产出', 'Code output')}</div>
          <div className="card-body" style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 20, marginBottom: 8 }}>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{c.commits}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('提交', 'commits')}</div></div>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{c.effectiveLoc.toLocaleString()}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('有效LOC', 'eff LOC')}</div></div>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700, color: (c.linkageRate ?? 0) >= 60 ? '#22C55E' : '#F59E0B' }}>{c.linkageRate ?? '—'}%</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('任务关联率', 'link rate')}</div></div>
            </div>
            {c.flags.length > 0 && <div style={{ marginBottom: 6 }}>{c.flags.map((f) => <span key={f} className="chip chip-grey" style={{ color: '#F59E0B', marginRight: 4 }}>{f}</span>)}</div>}
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{c.repos.join(' · ') || t('无提交', 'no commits')}</div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', maxHeight: 120, overflow: 'auto' }}>
              {c.sampleMessages.map((m, i) => <div key={i}>· {m}</div>)}
            </div>
          </div>
        </div>

        {/* 依赖关系 */}
        <div className="card">
          <div className="card-head">{t('同事间依赖', 'Dependencies')}</div>
          <div className="card-body" style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <DepCol title={t('🔻 依赖（在等）', '🔻 Waiting on')} edges={a.dependencies.dependsOn} color="#F59E0B" />
              <DepCol title={t('🔺 被依赖（在挡别人）', '🔺 Blocking')} edges={a.dependencies.blocking} color="#EF4444" />
              <DepCol title={t('↔ 相关', '↔ Related')} edges={a.dependencies.related} color="var(--muted)" />
            </div>
          </div>
        </div>
      </div>

      {/* 活跃时段 — 参考信号,非工时/考核 */}
      {rhythm && (
        <div className="card mb-16">
          <div className="card-head">{t('活跃时段', 'Activity rhythm')}<span className="subtitle">{rhythm.note}</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 20, marginBottom: 8, fontSize: 12 }}>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>≈{(rhythm.perDay.reduce((s, d) => s + (d.estWorkMinutes ?? 0), 0) / 60).toFixed(1)}h</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('估计工时(段内累计)', 'est. work hrs')}</div></div>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{rhythm.aggregate.days}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('活跃天数', 'active days')}</div></div>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700, color: rhythm.aggregate.nightDays > 0 ? '#F59E0B' : 'var(--text)' }}>{rhythm.aggregate.nightDays}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('夜间(0–6点)天数', 'night days')}</div></div>
              <div><div className="mono" style={{ fontSize: 18, fontWeight: 700, color: rhythm.aggregate.weekendActiveDays > 0 ? '#F59E0B' : 'var(--text)' }}>{rhythm.aggregate.weekendActiveDays}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{t('周末活跃天数', 'weekend days')}</div></div>
            </div>
            <div style={{ height: 180 }}>
              {rhythm.aggregate.hist.every((n) => n === 0) ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>{t('本期无提交活动。', 'No commit activity this period.')}</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rhythm.aggregate.hist.map((n, h) => ({ hour: String(h).padStart(2, '0'), [t('提交数', 'commits')]: n }))} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" interval={1} tick={{ fontSize: 9, fill: 'var(--muted)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
                    <Bar dataKey={t('提交数', 'commits')} fill="#5B8DEF" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t('横轴=本地时(Asia/Shanghai)0–23,纵轴=该时段提交数(整段累计)。', 'Local hour (Asia/Shanghai) 0–23; commits per hour, summed over the period.')}</div>
          </div>
        </div>
      )}

      {/* 请假 */}
      <div className="card">
        <div className="card-head">{t('请假记录（异常豁免）', 'Absences (anomaly-exempt)')}</div>
        <div className="card-body" style={{ fontSize: 12 }}>
          {(detail?.absences ?? a.absences).length === 0 && <div style={{ color: 'var(--muted)', marginBottom: 8 }}>{t('无记录。', 'None.')}</div>}
          {(detail?.absences ?? a.absences).map((ab, i) => (
            <div key={i} className="flex-between mb-8"><span>{ab.startDate} → {ab.endDate}</span><span className="chip chip-grey">{ab.type}</span></div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ fontSize: 11, padding: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }} />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={{ fontSize: 11, padding: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ fontSize: 11, padding: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }}>
              <option value="vacation">vacation</option><option value="sick">sick</option><option value="other">other</option>
            </select>
            <button className="btn btn-sm" disabled={!form.startDate || !form.endDate} onClick={submitAbsence}>{t('添加', 'Add')}</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Comments targetType="person" targetId={String(personId)} />
      </div>
    </div>
  )
}
