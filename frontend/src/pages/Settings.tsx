/**
 * Settings — management console: roster overview + central absence management
 * (mark anyone on leave so their off-days are exempt from anomaly detection).
 */
import { useEffect, useState, useCallback } from 'react'
import { fetchRoster, fetchAbsences, addAbsence, type RosterPerson, type AbsenceRow } from '@/api/scoring'
import { useI18n } from '@/i18n'

export default function Settings() {
  const { t } = useI18n()
  const [roster, setRoster] = useState<RosterPerson[]>([])
  const [absences, setAbsences] = useState<AbsenceRow[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({ personId: 0, startDate: '', endDate: '', type: 'vacation', note: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetchRoster().then((r) => {
      setRoster(r.roster)
      setForm((f) => ({ ...f, personId: f.personId || r.roster[0]?.personId || 0 }))
    }).catch((e) => setErr(e.message))
    fetchAbsences().then((r) => setAbsences(r.absences)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const nameOf = (id: number) => roster.find((p) => p.personId === id)?.name ?? `#${id}`

  const submit = async () => {
    if (!form.personId || !form.startDate || !form.endDate) return
    setSaving(true)
    try {
      await addAbsence(form)
      setForm({ ...form, startDate: '', endDate: '', note: '' })
      load()
    } finally { setSaving(false) }
  }

  if (err) return <div className="page"><div className="card"><div className="card-body">Failed: {err}</div></div></div>

  return (
    <div className="page">
      <div className="page-title">{t('设置', 'Settings')}<span className="subtitle">{t('人员名单与请假管理', 'Roster & absence management')}</span></div>

      {/* ── 请假管理 ── */}
      <div className="card mb-16">
        <div className="card-head">{t('请假管理（标记后该时段不计入异常）', 'Absences (exempt from anomaly detection)')}</div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <select value={form.personId} onChange={(e) => setForm({ ...form, personId: Number(e.target.value) })}
              style={{ fontSize: 12, padding: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, minWidth: 140 }}>
              {roster.map((p) => <option key={p.personId} value={p.personId}>{p.name}</option>)}
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              style={{ fontSize: 12, padding: 5, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }} />
            <span style={{ color: 'var(--muted)' }}>→</span>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              style={{ fontSize: 12, padding: 5, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }} />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={{ fontSize: 12, padding: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }}>
              <option value="vacation">{t('年假', 'Vacation')}</option><option value="sick">{t('病假', 'Sick')}</option><option value="other">{t('其他', 'Other')}</option>
            </select>
            <input placeholder={t('备注(可选)', 'Note (optional)')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
              style={{ fontSize: 12, padding: 5, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, flex: 1, minWidth: 120 }} />
            <button className="btn btn-sm" disabled={saving || !form.personId || !form.startDate || !form.endDate} onClick={submit}>
              {saving ? '…' : t('添加', 'Add')}
            </button>
          </div>
          {absences.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('暂无请假记录。', 'No absences yet.')}</div> : (
            <table className="tbl">
              <thead><tr><th>{t('姓名', 'Name')}</th><th>{t('开始', 'Start')}</th><th>{t('结束', 'End')}</th><th>{t('类型', 'Type')}</th><th>{t('备注', 'Note')}</th></tr></thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{nameOf(a.personId)}</td>
                    <td className="mono">{a.startDate}</td>
                    <td className="mono">{a.endDate}</td>
                    <td><span className="chip chip-grey">{a.type}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{a.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 人员名单 ── */}
      <div className="card">
        <div className="card-head">{t('人员名单', 'Roster')}（{roster.length} {t('人 · 来自 OpenProject 同步', 'people · synced from OpenProject')}）</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>{t('姓名', 'Name')}</th><th>{t('OpenProject 显示名', 'OpenProject name')}</th></tr></thead>
            <tbody>
              {roster.map((p) => (
                <tr key={p.personId}><td style={{ fontWeight: 600 }}>{p.name}</td><td style={{ color: 'var(--muted)' }}>{p.opName}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
