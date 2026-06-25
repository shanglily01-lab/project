/**
 * OpenProject — Tab per project with task tables.
 */

import { useState } from 'react'
import { useSyphonixStore } from '@/store/syphonixStore'

function priorityChip(p: string) {
  const pl = p.toLowerCase()
  if (pl === 'immediate' || pl === 'urgent') return 'chip chip-red'
  if (pl === 'high') return 'chip chip-amber'
  if (pl === 'normal') return 'chip chip-blue'
  return 'chip chip-grey'
}

function statusChip(s: string) {
  const sl = s.toLowerCase()
  if (sl.includes('block')) return 'chip chip-red'
  if (sl.includes('progress') || sl.includes('active')) return 'chip chip-green'
  if (sl.includes('new') || sl.includes('open')) return 'chip chip-blue'
  if (sl.includes('closed') || sl.includes('done')) return 'chip chip-grey'
  return 'chip chip-grey'
}

export default function OpenProject() {
  const { tasks, projects } = useSyphonixStore()
  const projectNames = projects.map((p) => p.name)
  const [activeTab, setActiveTab] = useState(0)

  const currentProject = projectNames[activeTab]
  const filteredTasks = currentProject
    ? tasks.filter((t) => t.projectName === currentProject)
    : tasks

  return (
    <div className="page">
      <div className="page-title">
        OpenProject
        <span className="subtitle">Task management across projects</span>
      </div>

      {/* ── Project Tabs ── */}
      <div className="tabs">
        {projectNames.map((name, i) => (
          <button
            key={name}
            className={`tab-btn${i === activeTab ? ' active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* ── Task Table ── */}
      <div className="card">
        <div className="card-head">
          {currentProject ?? 'All'} — {filteredTasks.length} tasks
        </div>
        <div className="card-body" style={{ padding: 0, maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>%</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id}>
                  <td className="mono">#{t.id}</td>
                  <td>{t.subject}</td>
                  <td><span className="chip chip-grey">{t.typeName}</span></td>
                  <td><span className={statusChip(t.statusName)}>{t.statusName}</span></td>
                  <td><span className={priorityChip(t.priorityName)}>{t.priorityName}</span></td>
                  <td>{t.assignee || '--'}</td>
                  <td className="mono">{t.pct != null ? `${t.pct}%` : '--'}</td>
                  <td className="mono">{new Date(t.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
