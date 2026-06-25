/** Compact task list used in scorecards and project detail. */
import type { TaskLite } from '@/api/scoring'

function age(h: number): string {
  if (h >= 48) return `${Math.round(h / 24)}d`
  return `${h}h`
}

export default function TaskList({
  tasks, title, accent, showAssignee, showProject, emptyHint,
}: {
  tasks: TaskLite[]
  title: string
  accent: string
  showAssignee?: boolean
  showProject?: boolean
  emptyHint?: string
}) {
  return (
    <div className="card">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        <span className="chip chip-grey" style={{ color: accent }}>{tasks.length}</span>
      </div>
      <div className="card-body" style={{ padding: 0, maxHeight: 320, overflow: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--muted)', fontSize: 12 }}>{emptyHint ?? 'None.'}</div>
        ) : (
          <table className="tbl">
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 600 }}>
                      #{t.id} {t.subject}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>
                      {showProject && <span>{t.project} · </span>}
                      {showAssignee && <span>{t.assignee} · </span>}
                      <span>{t.status}</span>
                      {t.priority && ['High', 'Immediate'].includes(t.priority) && (
                        <span style={{ color: '#F59E0B' }}> · {t.priority}</span>
                      )}
                      {t.pct != null && <span> · {t.pct}%</span>}
                    </div>
                  </td>
                  <td className="num mono" style={{ fontSize: 10, color: t.ageHours > 168 ? '#EF4444' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {age(t.ageHours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
