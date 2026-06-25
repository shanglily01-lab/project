/**
 * Monthly progress — how much things advanced this month: tasks closed per
 * project, daily activity (closures + commits), and totals.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { fetchMonthly, type Monthly as M } from '@/api/scoring'
import { useI18n } from '@/i18n'

function monthOptions(): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 6; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return out
}

export default function Monthly() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [month, setMonth] = useState(monthOptions()[0])
  const [data, setData] = useState<M | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { fetchMonthly(month).then(setData).catch((e) => setErr(e.message)) }, [month])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>

  const stat = (cls: string, label: string, val: number | string, color: string) => (
    <div className={`dash-stat ${cls}`}><div className="ds-label">{label}</div><div className="ds-val" style={{ color }}>{val}</div></div>
  )
  const chart = (data?.series ?? []).map((s) => ({ date: s.date.slice(8), [t('完成', 'Closed')]: s.closed, [t('提交', 'Commits')]: s.commits }))

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: 12 }}>
        <div className="page-title" style={{ marginBottom: 0 }}>{t('月度推进', 'Monthly Progress')}<span className="subtitle">{t('本月事情推进了多少', 'how much advanced this month')}</span></div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="form-select" style={{ fontSize: 12, padding: '5px 10px' }}>
          {monthOptions().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {stat('s-green', t('本月完成', 'Closed'), data.totals.closed, 'var(--buy)')}
            {stat('s-blue', t('提交', 'Commits'), data.totals.commits, 'var(--accent)')}
            {stat('s-purple', t('有效LOC', 'Eff LOC'), data.totals.effectiveLoc.toLocaleString(), 'var(--cta)')}
            {stat('s-amber', t('活跃人数', 'Active people'), data.totals.activePeople, '#F59E0B')}
          </div>

          <div className="card mb-16">
            <div className="card-head">{t('每日活动（完成 & 提交）', 'Daily activity (closures & commits)')}</div>
            <div className="card-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={t('完成', 'Closed')} fill="#22C55E" />
                  <Bar dataKey={t('提交', 'Commits')} fill="#d9a93c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-head">{t('各项目推进（按本月完成排序）', 'Project advancement (by tasks closed)')}</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table className="tbl">
                <thead><tr><th>{t('项目', 'Project')}</th><th className="num">{t('本月完成', 'Closed')}</th><th className="num">{t('活跃', 'Active')}</th><th className="num">{t('阻塞', 'Blocked')}</th><th className="num">{t('当前进度%', 'Avg%')}</th></tr></thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.name} onClick={() => navigate(`/project/${encodeURIComponent(p.name)}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="num mono pos">{p.closed}</td>
                      <td className="num mono">{p.active}</td>
                      <td className="num mono" style={{ color: p.blocked > 0 ? '#EF4444' : 'var(--muted)' }}>{p.blocked}</td>
                      <td className="num mono">{p.avgPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
