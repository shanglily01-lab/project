/**
 * Project detail — progress trend, related people (who's on it / stuck),
 * concrete risk points, and in-progress / blocked task lists.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { fetchProjectDetail, type ProjectDetail as PD, type RiskSeverity } from '@/api/scoring'
import TaskList from '@/components/TaskList'
import Gantt from '@/components/Gantt'
import Comments from '@/components/Comments'
import { useI18n } from '@/i18n'

const SEV_COLOR: Record<RiskSeverity, string> = { critical: '#EF4444', high: '#F59E0B', warn: '#9CA3AF' }

export default function ProjectDetail() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const [data, setData] = useState<PD | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const KIND_LABEL: Record<string, string> = {
    blocker: t('阻塞', 'BLOCKER'), stale: t('停滞', 'STALLED'), high_pri_idle: t('高优未启动', 'IDLE HIGH-PRI'),
  }

  useEffect(() => {
    if (name) fetchProjectDetail(name, lang).then(setData).catch((e) => setErr(e.message))
  }, [name, lang])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>
  if (!data) return <div className="page"><div className="card"><div className="card-body">Loading…</div></div></div>

  const chart = data.trend.map((p) => ({ date: p.date.slice(5), avgPct: p.avgPct, blocked: p.blocked, inProgress: p.inProgress }))

  return (
    <div className="page">
      <div className="page-title">
        <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate('/projects')}>← {t('项目', 'Projects')}</span>
        &nbsp;/ {data.name}
        <span className="subtitle">
          {data.counts.active} {t('活跃', 'active')} · {data.counts.inProgress} {t('进行', 'in progress')} · {data.counts.blocked} {t('阻塞', 'blocked')} · {data.counts.closed} {t('已关闭', 'closed')}
        </span>
      </div>

      {/* 本项目概述 */}
      <div className="card mb-16">
        <div className="card-head">{t('本项目概述', 'Project summary')}</div>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>{data.summary}</div>
      </div>

      {/* 进度趋势 */}
      <div className="card mb-16">
        <div className="card-head">{t('进度趋势', 'Progress trend')}</div>
        <div className="card-body" style={{ height: 200 }}>
          {chart.length <= 1 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{t('趋势数据将随每日运行累积（当前仅 ' + chart.length + ' 天）。', `Trend builds up daily (currently ${chart.length} day).`)}</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 11 }} />
                <Line type="monotone" dataKey="avgPct" name={t('平均进度%', 'avg%')} stroke="#22C55E" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="blocked" name={t('阻塞', 'blocked')} stroke="#EF4444" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="inProgress" name={t('进行', 'wip')} stroke="#5B8DEF" strokeWidth={1} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 相关人员 */}
        <div className="card">
          <div className="card-head">{t('相关人员', 'Related people')}</div>
          <div className="card-body" style={{ padding: 0, maxHeight: 320, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>{t('姓名', 'Name')}</th><th className="num">{t('活跃', 'Active')}</th><th className="num">{t('进行', 'WIP')}</th><th className="num">{t('阻塞', 'Blocked')}</th><th className="num">{t('已关闭', 'Closed')}</th></tr></thead>
              <tbody>
                {data.people.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="num mono">{p.total}</td>
                    <td className="num mono pos">{p.inProgress}</td>
                    <td className="num mono" style={{ color: p.blocked > 0 ? '#EF4444' : 'var(--muted)' }}>{p.blocked}</td>
                    <td className="num mono" style={{ color: 'var(--muted)' }}>{p.closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 风险点 */}
        <div className="card">
          <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠ {t('风险点', 'Risk points')}</span><span className="chip chip-grey">{data.risks.length}</span>
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 320, overflow: 'auto' }}>
            {data.risks.length === 0 ? <div style={{ padding: 12, color: 'var(--muted)', fontSize: 12 }}>{t('无活跃风险。', 'No active risks.')} 🎉</div> : (
              <table className="tbl">
                <thead><tr><th>{t('级别', 'Sev')}</th><th>{t('类型', 'Type')}</th><th>{t('任务', 'Task')}</th><th>{t('负责人', 'Owner')}</th><th className="num">{t('时长', 'Age')}</th></tr></thead>
                <tbody>
                  {data.risks.map((r) => (
                    <tr key={`${r.kind}-${r.taskId}`}>
                      <td><span className="chip" style={{ background: `${SEV_COLOR[r.severity]}22`, color: SEV_COLOR[r.severity] }}>{r.severity}</span></td>
                      <td style={{ fontSize: 10, color: 'var(--muted)' }}>{KIND_LABEL[r.kind]}</td>
                      <td style={{ fontSize: 11, fontWeight: 600 }}>#{r.taskId} {r.subject}</td>
                      <td style={{ fontSize: 11 }}>{r.assignee}</td>
                      <td className="num mono" style={{ color: SEV_COLOR[r.severity] }}>{r.ageDays}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* 甘特图 */}
      <div className="card mb-16">
        <div className="card-head">{t('甘特图（活跃任务时间线）', 'Gantt (active task timeline)')}</div>
        <div className="card-body"><Gantt tasks={data.gantt} /></div>
      </div>

      {/* 任务清单 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <TaskList title={t('🔧 进行中', '🔧 In progress')} accent="#5B8DEF" tasks={data.inProgress} showAssignee emptyHint={t('无进行中。', 'Nothing in progress.')} />
        <TaskList title={t('⛔ 阻塞', '⛔ Blocked')} accent="#EF4444" tasks={data.blocked} showAssignee emptyHint={t('无阻塞。', 'No blockers.')} />
      </div>

      <Comments targetType="project" targetId={data.name} />
    </div>
  )
}
