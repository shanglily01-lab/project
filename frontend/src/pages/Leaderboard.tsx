/**
 * Leaderboard — month / year rollup of scores per person (R9 / R10).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchLeaderboard, type LeaderEntry } from '@/api/scoring'
import { useI18n } from '@/i18n'

export default function Leaderboard() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [periodKey, setPeriodKey] = useState<string>('')

  useEffect(() => {
    fetchLeaderboard(period).then((r) => {
      setEntries(r.entries)
      setPeriodKey(r.entries[0]?.latest?.period ?? '')
    })
  }, [period])

  return (
    <div className="page">
      <div className="page-title">
        {t('排行', 'Leaderboard')}
        <span className="subtitle">{t('全员产出量化', 'Quantified output per person')} · {periodKey || '—'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['month', 'year'] as const).map((p) => (
          <button key={p} className="btn btn-sm"
            style={{ background: period === p ? 'var(--accent)' : 'var(--surface)', color: period === p ? '#fff' : 'var(--text)' }}
            onClick={() => setPeriod(p)}>
            {p === 'month' ? t('按月', 'Monthly') : t('按年', 'Yearly')}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">{t('排名', 'Ranking')} — {period === 'month' ? t('本月', 'this month') : t('本年', 'this year')}</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 28 }}>#</th>
                <th>{t('姓名', 'Person')}</th>
                <th className="num">{t('均分', 'Avg')}</th>
                <th className="num">{t('中位', 'Median')}</th>
                <th className="num">{t('总分', 'Total')}</th>
                <th className="num">{t('天数', 'Days')}</th>
                <th className="num">{t('异常天', 'Anomaly days')}</th>
                <th className="num">{t('最佳', 'Best')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.personId} onClick={() => navigate(`/scorecard/${e.personId}`)} style={{ cursor: 'pointer' }}>
                  <td className="num mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{e.name}</td>
                  <td className="num mono" style={{ fontWeight: 700 }}>{e.latest?.avgScore ?? 0}</td>
                  <td className="num mono">{e.latest?.medianScore ?? 0}</td>
                  <td className="num mono">{e.latest?.totalScore ?? 0}</td>
                  <td className="num mono">{e.latest?.days ?? 0}</td>
                  <td className="num mono" style={{ color: (e.latest?.anomalyDays ?? 0) > 0 ? '#EF4444' : 'var(--muted)' }}>
                    {e.latest?.anomalyDays ?? 0}
                  </td>
                  <td className="num mono">{e.latest?.best?.score ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
