/**
 * Weekly — Week selector + project tabs + per-person activity tables.
 */

import { useState, useMemo } from 'react'
import { useSyphonixStore } from '@/store/syphonixStore'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeek(date: Date): string {
  const end = new Date(date)
  end.setDate(end.getDate() + 6)
  return `${date.toLocaleDateString()} - ${end.toLocaleDateString()}`
}

export default function Weekly() {
  const { tasks, projects, persons } = useSyphonixStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [projectTab, setProjectTab] = useState(0)

  const weekStart = useMemo(() => {
    const now = new Date()
    const start = getWeekStart(now)
    start.setDate(start.getDate() + weekOffset * 7)
    return start
  }, [weekOffset])

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 7)
    return end
  }, [weekStart])

  const projectNames = projects.map((p) => p.name)
  const currentProject = projectNames[projectTab]

  // Tasks updated this week in selected project
  const weeklyTasks = useMemo(() => {
    return tasks.filter((t) => {
      const updated = new Date(t.updatedAt)
      const inWeek = updated >= weekStart && updated < weekEnd
      const inProject = !currentProject || t.projectName === currentProject
      return inWeek && inProject
    })
  }, [tasks, weekStart, weekEnd, currentProject])

  // Tasks created this week
  const createdTasks = useMemo(() => {
    return tasks.filter((t) => {
      const created = new Date(t.createdAt)
      const inWeek = created >= weekStart && created < weekEnd
      const inProject = !currentProject || t.projectName === currentProject
      return inWeek && inProject
    })
  }, [tasks, weekStart, weekEnd, currentProject])

  // Blocked tasks
  const blockedTasks = useMemo(() => {
    return weeklyTasks.filter((t) => t.statusName.toLowerCase().includes('block'))
  }, [weeklyTasks])

  // Per-person activity
  const personActivity = useMemo(() => {
    return persons.map((p) => {
      const myTasks = weeklyTasks.filter((t) => t.assignee === p.name)
      return {
        name: p.name,
        updated: myTasks.length,
        created: createdTasks.filter((t) => t.author === p.name).length,
        blocked: myTasks.filter((t) => t.statusName.toLowerCase().includes('block')).length,
      }
    }).filter((p) => p.updated > 0 || p.created > 0)
  }, [persons, weeklyTasks, createdTasks])

  return (
    <div className="page">
      <div className="page-title">
        Weekly
        <span className="subtitle">Weekly activity report</span>
      </div>

      {/* ── Week Selector ── */}
      <div className="flex-row mb-16">
        <button className="btn btn-sm" onClick={() => setWeekOffset((w) => w - 1)}>Prev</button>
        <span className="font-mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
          {formatWeek(weekStart)}
        </span>
        <button className="btn btn-sm" onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0}>
          Next
        </button>
        {weekOffset !== 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(0)}>Current</button>
        )}
      </div>

      {/* ── Project Tabs ── */}
      <div className="tabs">
        {projectNames.map((name, i) => (
          <button
            key={name}
            className={`tab-btn${i === projectTab ? ' active' : ''}`}
            onClick={() => setProjectTab(i)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* ── Per-Person Activity ── */}
      <div className="card mb-16">
        <div className="card-head">Person Activity</div>
        <div className="card-body" style={{ padding: 0 }}>
          {personActivity.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              No activity this week
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">Updated</th>
                  <th className="num">Created</th>
                  <th className="num">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {personActivity.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="num mono">{p.updated}</td>
                    <td className="num mono pos">{p.created}</td>
                    <td className="num mono neg">{p.blocked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Updated Tasks ── */}
      <div className="card mb-16">
        <div className="card-head">Updated Tasks ({weeklyTasks.length})</div>
        <div className="card-body" style={{ padding: 0, maxHeight: 300, overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Assignee</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {weeklyTasks.map((t) => (
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
        </div>
      </div>

      {/* ── Created Tasks ── */}
      <div className="card mb-16">
        <div className="card-head">Created This Week ({createdTasks.length})</div>
        <div className="card-body" style={{ padding: 0, maxHeight: 300, overflow: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Subject</th>
                <th>Author</th>
                <th>Assignee</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {createdTasks.map((t) => (
                <tr key={t.id}>
                  <td className="mono">#{t.id}</td>
                  <td>{t.subject}</td>
                  <td>{t.author}</td>
                  <td>{t.assignee || '--'}</td>
                  <td><span className="chip chip-grey">{t.priorityName}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Blocked ── */}
      {blockedTasks.length > 0 && (
        <div className="card mb-16">
          <div className="card-head">Blocked ({blockedTasks.length})</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {blockedTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">#{t.id}</td>
                    <td>{t.subject}</td>
                    <td>{t.assignee || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
