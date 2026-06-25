/**
 * DevPlan — Alerts, WIP Limits, Priority Review, Stale Tasks tabs.
 */

import { useState, useMemo } from 'react'
import { useSyphonixStore } from '@/store/syphonixStore'
import type { Alert } from '@/types'

const TABS = ['Alerts', 'WIP Limits', 'Priority Review', 'Stale Tasks'] as const

function severityClass(sev: Alert['severity']) {
  return `alert-card severity-${sev}`
}

function severityChip(sev: Alert['severity']) {
  const map: Record<string, string> = {
    critical: 'chip chip-red',
    high: 'chip chip-amber',
    warn: 'chip chip-warn',
    info: 'chip chip-blue',
  }
  return map[sev] ?? 'chip chip-grey'
}

export default function DevPlan() {
  const { alerts, tasks, persons } = useSyphonixStore()
  const [activeTab, setActiveTab] = useState(0)

  // WIP limits: persons with > 3 in-progress tasks
  const wipViolations = useMemo(
    () => persons.filter((p) => p.inProgressTasks > 3),
    [persons],
  )

  // High priority tasks that haven't been updated in 3+ days
  const highPriIdle = useMemo(() => {
    const now = Date.now()
    return tasks.filter((t) => {
      const isHigh = ['high', 'immediate', 'urgent'].includes(t.priorityName.toLowerCase())
      const daysSince = (now - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      return isHigh && daysSince > 3
    })
  }, [tasks])

  // Stale tasks: not updated in 7+ days
  const staleTasks = useMemo(() => {
    const now = Date.now()
    return tasks.filter((t) => {
      const daysSince = (now - new Date(t.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      const isOpen = !t.statusName.toLowerCase().includes('closed') && !t.statusName.toLowerCase().includes('done')
      return isOpen && daysSince > 7
    })
  }, [tasks])

  return (
    <div className="page">
      <div className="page-title">
        Dev Plan
        <span className="subtitle">Operational alerts and health tracking</span>
      </div>

      <div className="tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`tab-btn${i === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
            {i === 0 && alerts.length > 0 && (
              <span className="chip chip-red" style={{ marginLeft: 6, fontSize: 9 }}>{alerts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Alerts ── */}
      {activeTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>
              No active alerts
            </div>
          )}
          {alerts.map((a, i) => (
            <div key={i} className={severityClass(a.severity)}>
              <div className="alert-title">{a.message}</div>
              <div className="alert-detail">{a.detail}</div>
              <div className="alert-meta">
                <span className={severityChip(a.severity)}>{a.severity.toUpperCase()}</span>
                <span className="chip chip-grey">{a.targetType}: {a.targetId}</span>
                {a.tasks.length > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>
                    {a.tasks.length} task{a.tasks.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── WIP Limits ── */}
      {activeTab === 1 && (
        <div className="card">
          <div className="card-head">WIP Limit Violations (limit: 3)</div>
          <div className="card-body" style={{ padding: 0 }}>
            {wipViolations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No WIP limit violations
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Health</th>
                    <th className="num">In Progress</th>
                    <th className="num">Over Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {wipViolations.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td><span className={`health-dot ${p.health}`} /></td>
                      <td className="num mono neg">{p.inProgressTasks}</td>
                      <td className="num mono neg">+{p.inProgressTasks - 3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Priority Review ── */}
      {activeTab === 2 && (
        <div className="card">
          <div className="card-head">High Priority — Idle 3+ Days</div>
          <div className="card-body" style={{ padding: 0 }}>
            {highPriIdle.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No idle high-priority tasks
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {highPriIdle.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">#{t.id}</td>
                      <td>{t.subject}</td>
                      <td>{t.assignee || '--'}</td>
                      <td><span className="chip chip-grey">{t.statusName}</span></td>
                      <td className="mono">{new Date(t.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Stale Tasks ── */}
      {activeTab === 3 && (
        <div className="card">
          <div className="card-head">Stale Tasks (7+ Days Without Update)</div>
          <div className="card-body" style={{ padding: 0 }}>
            {staleTasks.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                No stale tasks
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Subject</th>
                    <th>Project</th>
                    <th>Assignee</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {staleTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">#{t.id}</td>
                      <td>{t.subject}</td>
                      <td>{t.projectName}</td>
                      <td>{t.assignee || '--'}</td>
                      <td><span className="chip chip-grey">{t.statusName}</span></td>
                      <td className="mono">{new Date(t.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
