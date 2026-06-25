/** Lightweight Gantt — active project tasks on a timeline (created → due). */
import type { GanttTask } from '@/api/scoring'
import { useI18n } from '@/i18n'

const STATUS_COLOR: Record<string, string> = {
  'In progress': '#5B8DEF',
  'On hold': '#EF4444',
  'Rejected': '#EF4444',
  'Test failed': '#EF4444',
  'New': '#9CA3AF',
}

const DAY = 86400000

export default function Gantt({ tasks }: { tasks: GanttTask[] }) {
  const { t } = useI18n()
  const now = Date.now()
  const rows = tasks
    .map((tk) => {
      const s = new Date(tk.start).getTime()
      const e = tk.end ? new Date(tk.end).getTime() : now // open-ended → until today
      return { ...tk, s, e: Math.max(e, s + DAY) }
    })
    .filter((r) => !Number.isNaN(r.s))

  if (rows.length === 0) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>{t('无可绘制的任务（缺少日期）。', 'No datable tasks.')}</div>

  const min = Math.min(...rows.map((r) => r.s))
  const max = Math.max(...rows.map((r) => r.e), now)
  const span = Math.max(max - min, DAY)
  const pct = (ms: number) => ((ms - min) / span) * 100
  const fmt = (ms: number) => new Date(ms).toISOString().slice(5, 10)
  const nowLeft = pct(now)

  return (
    <div style={{ fontSize: 11 }}>
      {/* axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', marginBottom: 6 }}>
        <span>{fmt(min)}</span><span>{t('今天', 'today')}</span><span>{fmt(max)}</span>
      </div>
      <div style={{ position: 'relative', maxHeight: 360, overflow: 'auto' }}>
        {/* today marker */}
        <div style={{ position: 'absolute', left: `calc(38% + ${nowLeft * 0.62}%)`, top: 0, bottom: 0, width: 1, background: 'var(--accent)', opacity: 0.5, zIndex: 1 }} />
        {rows.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', height: 22, gap: 6 }}>
            <div style={{ width: '38%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={`#${r.id} ${r.subject} · ${r.assignee}`}>
              #{r.id} {r.subject}
            </div>
            <div style={{ flex: 1, position: 'relative', height: 12, background: 'var(--surface3)', borderRadius: 3 }}>
              <div
                title={`${fmt(r.s)} → ${r.end ? fmt(r.e) : t('进行中', 'ongoing')} · ${r.status} · ${r.pct ?? 0}%`}
                style={{
                  position: 'absolute', height: '100%', borderRadius: 3,
                  left: `${pct(r.s)}%`, width: `${Math.max(pct(r.e) - pct(r.s), 1.5)}%`,
                  background: STATUS_COLOR[r.status] ?? '#9CA3AF', opacity: 0.85,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
