/**
 * Explore — one place to search people & projects and see their relationship.
 * A people × project matrix: rows = people, cols = projects, cell = active task
 * count (red when blocked). Row/col totals express each side's situation.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMatrix, type Matrix } from '@/api/scoring'
import { useI18n } from '@/i18n'

export default function Explore() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [m, setM] = useState<Matrix | null>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { fetchMatrix().then(setM).catch((e) => setErr(e.message)) }, [])

  const cellMap = useMemo(() => {
    const map = new Map<string, { active: number; blocked: number }>()
    m?.cells.forEach((c) => map.set(`${c.personId}|${c.project}`, c))
    return map
  }, [m])

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>
  if (!m) return <div className="page"><div className="card"><div className="card-body">Loading…</div></div></div>

  const ql = q.trim().toLowerCase()
  const matchP = (n: string) => !ql || n.toLowerCase().includes(ql)
  // when searching, narrow rows/cols to matches (and keep all cols if only people match, etc.)
  const people = ql ? m.people.filter((p) => matchP(p.name)) : m.people
  const projects = ql ? m.projects.filter((p) => matchP(p.name)) : m.projects
  const showPeople = people.length ? people : m.people
  const showProjects = projects.length ? projects : m.projects

  const matchedPeople = m.people.filter((p) => matchP(p.name))
  const matchedProjects = m.projects.filter((p) => matchP(p.name))

  const cellBg = (active: number, blocked: number) => {
    if (blocked > 0) return `rgba(239,68,68,${Math.min(0.2 + blocked * 0.12, 0.7)})`
    if (active > 0) return `rgba(217,169,60,${Math.min(0.12 + active * 0.06, 0.5)})`
    return 'transparent'
  }

  return (
    <div className="page">
      <div className="page-title">{t('探索', 'Explore')}<span className="subtitle">{t('搜索人员与项目，查看两者关系', 'search people & projects, see their relationship')}</span></div>

      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('搜索人员或项目…', 'Search people or projects…')}
        className="form-input" style={{ width: '100%', padding: '8px 12px', marginBottom: 12, fontSize: 13 }} />

      {/* quick jump when searching */}
      {ql && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
          {matchedPeople.length > 0 && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t('人员', 'People')}: </span>
              {matchedPeople.slice(0, 8).map((p) => <span key={p.personId} className="chip chip-blue" style={{ cursor: 'pointer', marginRight: 4 }} onClick={() => navigate(`/scorecard/${p.personId}`)}>{p.name}</span>)}
            </div>
          )}
          {matchedProjects.length > 0 && (
            <div>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t('项目', 'Projects')}: </span>
              {matchedProjects.slice(0, 8).map((p) => <span key={p.name} className="chip chip-purple" style={{ cursor: 'pointer', marginRight: 4 }} onClick={() => navigate(`/project/${encodeURIComponent(p.name)}`)}>{p.name}</span>)}
            </div>
          )}
        </div>
      )}

      {/* matrix */}
      <div className="card">
        <div className="card-head">{t('人员 × 项目矩阵（数字=活跃任务，红=含阻塞）', 'People × Project matrix (n = active tasks, red = blocked)')}</div>
        <div className="card-body" style={{ padding: 0, overflow: 'auto', maxHeight: '70vh' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--surface3)', zIndex: 2 }}>{t('人员 \\ 项目', 'Person \\ Project')}</th>
                {showProjects.map((p) => (
                  <th key={p.name} className="num" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} title={`${p.active} active · ${p.blocked} blocked`} onClick={() => navigate(`/project/${encodeURIComponent(p.name)}`)}>
                    {p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name}
                    <div style={{ fontSize: 9, color: p.blocked ? '#EF4444' : 'var(--muted)' }}>{p.active}{p.blocked ? `·⛔${p.blocked}` : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showPeople.map((person) => (
                <tr key={person.personId}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => navigate(`/scorecard/${person.personId}`)}>
                    {person.name} <span style={{ fontSize: 9, color: person.blocked ? '#EF4444' : 'var(--muted)' }}>({person.active}{person.blocked ? `·⛔${person.blocked}` : ''})</span>
                  </td>
                  {showProjects.map((proj) => {
                    const c = cellMap.get(`${person.personId}|${proj.name}`)
                    return (
                      <td key={proj.name} className="num mono" style={{ textAlign: 'center', background: c ? cellBg(c.active, c.blocked) : 'transparent', color: c ? 'var(--text)' : 'var(--border)' }}
                        title={c ? `${person.name} · ${proj.name}: ${c.active} active, ${c.blocked} blocked` : ''}>
                        {c ? (c.blocked ? `${c.active}⛔` : c.active) : '·'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
