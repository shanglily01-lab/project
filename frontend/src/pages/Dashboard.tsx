/**
 * Dashboard — Main overview page with KPIs, project cards, and priority tables.
 */

import { useSyphonixStore } from '@/store/syphonixStore'

function priorityChip(p: string) {
  const pl = p.toLowerCase()
  if (pl === 'immediate' || pl === 'urgent') return 'chip chip-red'
  if (pl === 'high') return 'chip chip-amber'
  if (pl === 'normal') return 'chip chip-blue'
  return 'chip chip-grey'
}

const BLOCKED_STATUSES = ['On hold', 'Rejected', 'Test failed']
const HIGH_PRIORITIES = ['High', 'Immediate']

function statusChip(s: string) {
  if (BLOCKED_STATUSES.includes(s)) return 'chip chip-red'
  if (s === 'In progress') return 'chip chip-green'
  if (s === 'New') return 'chip chip-blue'
  if (s === 'Closed') return 'chip chip-grey'
  return 'chip chip-purple'
}

export default function Dashboard() {
  const { tasks, projects, changes, decisions, loading } = useSyphonixStore()

  const totalTasks = tasks.length
  const inProgress = tasks.filter((t) => t.statusName === 'In progress').length
  const blocked = tasks.filter((t) => BLOCKED_STATUSES.includes(t.statusName)).length
  const highPri = tasks.filter((t) => HIGH_PRIORITIES.includes(t.priorityName)).length
  const pendingDecisions = decisions.filter((d) => d.status === 'PENDING').length

  const highPriorityTasks = tasks
    .filter((t) => HIGH_PRIORITIES.includes(t.priorityName))
    .slice(0, 15)

  const blockedTasks = tasks
    .filter((t) => BLOCKED_STATUSES.includes(t.statusName))
    .slice(0, 10)

  const recentChanges = changes.slice(0, 8)

  return (
    <div className="page">
      <div className="page-title">
        Dashboard
        <span className="subtitle">Operations overview</span>
      </div>

      {loading && <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 8 }}>Loading...</div>}

      {/* ── KPI Strip ── */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Total Tasks</div>
          <div className="kpi-value neutral">{totalTasks}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">In Progress</div>
          <div className="kpi-value up">{inProgress}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Blocked</div>
          <div className="kpi-value down">{blocked}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High Priority</div>
          <div className="kpi-value" style={{ color: '#F59E0B' }}>{highPri}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Changes</div>
          <div className="kpi-value neutral">{changes.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Decisions</div>
          <div className="kpi-value" style={{ color: 'var(--cta)' }}>{pendingDecisions}</div>
        </div>
      </div>

      {/* ── Project Overview ── */}
      <div className="mb-16">
        <div className="card">
          <div className="card-head">Projects</div>
          <div className="card-body">
            <div className="grid-3" style={{ gap: 10 }}>
              {projects.map((p) => (
                <div key={p.name} className="card" style={{ padding: 12 }}>
                  <div className="flex-between mb-8">
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{p.name}</span>
                    <span className={`health-dot ${p.health}`} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)' }}>
                    <span>Total: <strong style={{ color: 'var(--text)' }}>{p.totalTasks}</strong></span>
                    <span>Active: <strong className="up">{p.inProgressTasks}</strong></span>
                    <span>Blocked: <strong className="down">{p.blockedTasks}</strong></span>
                    <span>High: <strong style={{ color: '#F59E0B' }}>{p.highPriorityTasks}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── High Priority Tasks ── */}
      {highPriorityTasks.length > 0 && (
        <div className="card mb-16">
          <div className="card-head">High Priority Tasks</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Project</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {highPriorityTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">#{t.id}</td>
                    <td>{t.subject}</td>
                    <td>{t.projectName}</td>
                    <td><span className={statusChip(t.statusName)}>{t.statusName}</span></td>
                    <td><span className={priorityChip(t.priorityName)}>{t.priorityName}</span></td>
                    <td>{t.assignee || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Blocked Tasks ── */}
      {blockedTasks.length > 0 && (
        <div className="card mb-16">
          <div className="card-head">Blocked Tasks</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Project</th>
                  <th>Assignee</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {blockedTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">#{t.id}</td>
                    <td>{t.subject}</td>
                    <td>{t.projectName}</td>
                    <td>{t.assignee || '--'}</td>
                    <td className="mono">{new Date(t.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent Changes ── */}
      {recentChanges.length > 0 && (
        <div className="card mb-16">
          <div className="card-head">Recent Changes</div>
          <div className="card-body">
            {recentChanges.map((c) => (
              <div key={`${c.id}-${c.type}`} className="list-row">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`chip chip-${c.type === 'new' ? 'green' : c.type === 'removed' ? 'red' : 'blue'}`} style={{ fontSize: 9 }}>
                    {c.type.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11 }}>#{c.id} {c.subject}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{c.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
