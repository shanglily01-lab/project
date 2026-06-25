/** Notes / reviews on a person's or project's progress. */
import { useEffect, useState, useCallback } from 'react'
import { fetchComments, addComment, type Comment } from '@/api/scoring'
import { useI18n } from '@/i18n'
import { useCurrentUser } from '@/currentUser'

export default function Comments({ targetType, targetId }: { targetType: 'person' | 'project'; targetId: string }) {
  const { t } = useI18n()
  const { user } = useCurrentUser()
  const [items, setItems] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetchComments(targetType, targetId).then((r) => setItems(r.comments)).catch(() => {})
  }, [targetType, targetId])
  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!body.trim() || !user) return
    setSaving(true)
    try {
      await addComment({ targetType, targetId, author: user.name, body })
      setBody('')
      load()
    } finally { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-head">{t('备注与点评', 'Notes & reviews')}</div>
      <div className="card-body" style={{ fontSize: 12 }}>
        {!user ? (
          <div style={{ color: 'var(--muted)', marginBottom: 10 }}>
            {t('请先在右上角选择你的身份后再评论。', 'Pick your identity (top-right) to comment.')}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'flex-start' }}>
            <span className="chip" style={{ background: 'var(--accent-light)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>{user.name}</span>
            <textarea placeholder={t('对今天的进度备注/点评…', 'Note on today’s progress…')} value={body} onChange={(e) => setBody(e.target.value)}
              rows={2} style={{ flex: 1, fontSize: 12, padding: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, resize: 'vertical' }} />
            <button className="btn btn-sm" disabled={saving || !body.trim()} onClick={submit}>{t('发布', 'Post')}</button>
          </div>
        )}
        {items.length === 0 ? <div style={{ color: 'var(--muted)' }}>{t('暂无备注。', 'No notes yet.')}</div> : items.map((c) => (
          <div key={c.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 10, marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.author || t('匿名', 'anon')}</span>
              <span>{c.date} · {new Date(c.createdAt).toLocaleTimeString()}</span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
