/**
 * Projects — all projects with progress & health at a glance. Click to open
 * the project detail (tasks + risk points).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProjects, type ProjectRow } from '@/api/scoring'
import { useI18n } from '@/i18n'

const HEALTH: Record<string, string> = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' }

export default function Projects() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects().then((r) => { setRows(r.projects); setDate(r.date) }).catch((e) => setErr(e.message))
  }, [])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>

  const sorted = [...rows].sort((a, b) => b.blocked - a.blocked)

  return (
    <div className="page">
      <div className="page-title">{t('项目', 'Projects')}<span className="subtitle">{rows.length} {t('个项目', 'projects')} · {date ?? '—'} · {t('点击查看进度与风险', 'click for progress & risks')}</span></div>
      <div className="card">
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
              {sorted.map((p) => (
                <tr key={p.projectName} onClick={() => navigate(`/project/${encodeURIComponent(p.projectName)}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{p.projectName}</td>
                  <td className="num mono">{p.totalTasks}</td>
                  <td className="num mono pos">{p.inProgress}</td>
                  <td className="num mono" style={{ color: p.blocked > 0 ? '#EF4444' : 'var(--muted)' }}>{p.blocked}</td>
                  <td className="num mono" style={{ color: 'var(--muted)' }}>{p.closed}</td>
                  <td className="num mono">{p.avgPct}%</td>
                  <td className="num mono" style={{ color: (p.pctDelta ?? 0) > 0 ? '#22C55E' : (p.pctDelta ?? 0) < 0 ? '#EF4444' : 'var(--muted)' }}>
                    {p.pctDelta === null ? '—' : p.pctDelta > 0 ? `+${p.pctDelta}` : p.pctDelta}
                  </td>
                  <td><span className="health-dot" style={{ background: HEALTH[p.health] }} /> {p.health}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
