/**
 * ChatWidget — floating, read-only project-progress Q&A.
 * Posts to POST /chat; the backend answers only from facts retrieved out of the
 * scoring DB (grounded, gated). When the user is viewing a person scorecard or a
 * project, that entity is passed as context so answers are scoped to it.
 */

import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useI18n } from '@/i18n'
import { post } from '@/api/client'
import { useCurrentUser } from '@/currentUser'

interface ChatFact { id: string; name: string; value: string }
interface PendingAction {
  type: 'addAbsence' | 'fixIdentity'
  params: Record<string, unknown>
  confirmLabel: string
}
interface ChatResponse {
  ok: boolean
  answer: string
  cites: string[]
  facts: ChatFact[]
  subject: string
  date: string
  failures: string[]
  outputId?: number
  pendingAction?: PendingAction
}
interface Msg {
  role: 'user' | 'assistant'
  text: string
  cites?: string[]
  facts?: ChatFact[]
  subject?: string
  ok?: boolean
  outputId?: number
  rated?: 1 | -1
  pendingAction?: PendingAction
  actionDone?: boolean
}

// Derive grounding context from the current route.
function contextFromPath(pathname: string): { personId?: number; projectName?: string } {
  const sc = pathname.match(/^\/scorecard\/(\d+)/)
  if (sc) return { personId: Number(sc[1]) }
  const pr = pathname.match(/^\/project\/(.+)$/)
  if (pr) return { projectName: decodeURIComponent(pr[1]) }
  return {}
}

export default function ChatWidget() {
  const { t } = useI18n()
  const { user } = useCurrentUser()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, open])

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const ctx = contextFromPath(location.pathname)
      const res = await post<ChatResponse>('/ai/chat', { question: q, ...ctx, speakerPersonId: user?.personId })
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer, cites: res.cites, facts: res.facts, subject: res.subject, ok: res.ok, outputId: res.outputId, pendingAction: res.pendingAction }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'assistant', text: `${t('请求失败', 'Request failed')}: ${(e as Error).message}`, ok: false }])
    } finally {
      setBusy(false)
    }
  }

  // Self-service confirm: the button posts to the policy-gated /ai/agent/*
  // endpoint — the chat itself never writes anything.
  async function confirmAction(idx: number) {
    const m = msgs[idx]
    if (!m?.pendingAction || m.actionDone) return
    const url = m.pendingAction.type === 'addAbsence' ? '/ai/agent/absence' : '/ai/agent/identity'
    try {
      const res = await post<{ ok: boolean; clearedAnomalies?: string[] }>(url, m.pendingAction.params)
      setMsgs((prev) => prev.map((x, i) => (i === idx ? { ...x, actionDone: true } : x)))
      const cleared = res.clearedAnomalies?.length ? t(`已登记 ✓,且消除了 ${res.clearedAnomalies.join('、')} 的异常标记。`, `Done ✓ — cleared anomaly on ${res.clearedAnomalies.join(', ')}.`) : t('已登记 ✓', 'Done ✓')
      setMsgs((prev) => [...prev, { role: 'assistant', text: cleared, ok: true }])
    } catch (e) {
      setMsgs((prev) => [...prev, { role: 'assistant', text: `${t('登记失败', 'Failed')}: ${(e as Error).message}`, ok: false }])
    }
  }

  async function rate(idx: number, rating: 1 | -1) {
    const m = msgs[idx]
    if (!m?.outputId || m.rated) return
    setMsgs((prev) => prev.map((x, i) => (i === idx ? { ...x, rated: rating } : x)))
    try {
      await post('/ai/chat/feedback', { outputId: m.outputId, rating })
    } catch {
      /* optimistic; ignore */
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={t('问问项目进展', 'Ask about progress')}
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 50,
          width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <MessageCircle size={22} />
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 50,
      width: 360, maxWidth: 'calc(100vw - 40px)', height: 480, maxHeight: 'calc(100vh - 40px)',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <header style={{
        height: 42, minHeight: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
          {t('项目助手', 'Project Assistant')}
        </span>
        <button onClick={() => setOpen(false)} className="btn btn-sm" style={{ padding: 4 }} title={t('关闭', 'Close')}>
          <X size={14} />
        </button>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
            {t('问我某人或某项目的进展，例如「张三今天进展如何」「支付重构卡在哪」。回答只基于平台数据，无依据时会如实说明。',
              'Ask about a person or project, e.g. "How is Zhang doing today?". Answers are grounded in platform data only.')}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
            <div style={{
              padding: '8px 10px', borderRadius: 10, fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>
              {m.text}
            </div>
            {m.role === 'assistant' && m.cites && m.cites.length > 0 && m.facts && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>
                {t('依据', 'Based on')}: {m.cites.map((c) => m.facts!.find((f) => f.id === c)).filter(Boolean)
                  .map((f) => `${f!.name} ${f!.value}`).join(' · ')}
              </div>
            )}
            {m.role === 'assistant' && m.pendingAction && !m.actionDone && (
              <button onClick={() => void confirmAction(i)} className="btn btn-sm btn-accent" style={{ marginTop: 6 }}>
                {m.pendingAction.confirmLabel}
              </button>
            )}
            {m.role === 'assistant' && m.outputId && (
              <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => void rate(i, 1)} disabled={!!m.rated} title={t('有帮助', 'Helpful')}
                  style={{ background: 'none', border: 'none', cursor: m.rated ? 'default' : 'pointer', color: m.rated === 1 ? '#22C55E' : 'var(--muted)', padding: 0 }}>
                  <ThumbsUp size={13} />
                </button>
                <button onClick={() => void rate(i, -1)} disabled={!!m.rated} title={t('不准确', 'Not accurate')}
                  style={{ background: 'none', border: 'none', cursor: m.rated ? 'default' : 'pointer', color: m.rated === -1 ? '#EF4444' : 'var(--muted)', padding: 0 }}>
                  <ThumbsDown size={13} />
                </button>
                {m.rated && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{t('已反馈', 'Thanks')}</span>}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t('思考中…', 'Thinking…')}</div>}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: 8, display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
          placeholder={t('输入问题…', 'Ask a question…')}
          style={{ flex: 1, fontSize: 12, padding: '6px 8px', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8 }}
        />
        <button onClick={() => void send()} disabled={busy} className="btn btn-sm" style={{ padding: '6px 10px' }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
