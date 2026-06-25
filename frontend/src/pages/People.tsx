/**
 * People — company roster with at-a-glance work signals. Click anyone to open
 * their deep-dive. Built from the daily feed (latest date).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFeed, type FeedEntry } from '@/api/scoring'
import { useI18n } from '@/i18n'

type SortKey = 'score' | 'blocked' | 'commits' | 'linkage'
const CONF: Record<string, string> = { high: '#22C55E', medium: '#F59E0B', low: '#EF4444' }

export default function People() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [date, setDate] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('score')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchFeed().then((r) => { setEntries(r.entries); setDate(r.date) }).catch((e) => setErr(e.message))
  }, [])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>

  const linkage = (e: FeedEntry) => (e.code && e.code.commits > 0 ? Math.round((e.code.taskLinkedCommits / e.code.commits) * 100) : -1)
  const sorted = [...entries].sort((a, b) => {
    if (sort === 'blocked') return b.tasks.blocked - a.tasks.blocked
    if (sort === 'commits') return (b.code?.commits ?? 0) - (a.code?.commits ?? 0)
    if (sort === 'linkage') return linkage(b) - linkage(a)
    return b.score - a.score
  })

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="num" style={{ cursor: 'pointer', color: sort === k ? 'var(--accent)' : undefined }} onClick={() => setSort(k)}>{label}</th>
  )

  return (
    <div className="page">
      <div className="page-title">{t('人员', 'People')}<span className="subtitle">{entries.length} {t('人', 'people')} · {date ?? '—'} · {t('点击查看个人深度分析', 'click for deep-dive')}</span></div>
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('姓名', 'Name')}</th>
                <Th k="score" label={t('评分', 'Score')} />
                <th className="num">{t('完成', 'Done')}</th>
                <th className="num">{t('进行', 'WIP')}</th>
                <Th k="blocked" label={t('阻塞', 'Blocked')} />
                <Th k="commits" label={t('提交', 'Commits')} />
                <th className="num">{t('有效LOC', 'Eff LOC')}</th>
                <Th k="linkage" label={t('关联率', 'Link%')} />
                <th>{t('可信度', 'Conf')}</th>
                <th>{t('状态', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const lk = linkage(e)
                return (
                  <tr key={e.personId} onClick={() => navigate(`/scorecard/${e.personId}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td className="num mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.score}</td>
                    <td className="num mono">{e.completion}</td>
                    <td className="num mono pos">{e.tasks.inProgress}</td>
                    <td className="num mono" style={{ color: e.tasks.blocked > 0 ? '#EF4444' : 'var(--muted)' }}>{e.tasks.blocked}</td>
                    <td className="num mono">{e.code?.commits ?? 0}</td>
                    <td className="num mono">{e.code?.effectiveLoc?.toLocaleString() ?? 0}</td>
                    <td className="num mono" style={{ color: lk < 0 ? 'var(--muted)' : lk >= 60 ? '#22C55E' : '#F59E0B' }}>{lk < 0 ? '—' : lk + '%'}</td>
                    <td>{e.code ? <span className="chip" style={{ background: `${CONF[e.code.confidence]}22`, color: CONF[e.code.confidence] }}>{e.code.confidence}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>{e.isAnomaly ? <span className="chip" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>⚠ {e.reason}</span> : <span style={{ color: 'var(--muted)', fontSize: 11 }}>{e.reason ?? '—'}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
