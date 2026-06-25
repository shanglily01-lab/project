/**
 * Syphonix Layout — Fixed sidebar (220px) + topbar + main content.
 */

import { useEffect, useState, useCallback } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Kanban, Users,
  ClipboardCheck, Settings,
  RefreshCw, Trophy, Activity, Search,
} from 'lucide-react'
import { useSocket } from '@/hooks/useSocket'
import { useSyphonixStore } from '@/store/syphonixStore'
import { LogoLockup } from '@/components/Logo'
import { useI18n } from '@/i18n'
import { useCurrentUser } from '@/currentUser'
import { fetchRoster, type RosterPerson } from '@/api/scoring'
import ChatWidget from '@/components/ChatWidget'
import InboxBell from '@/components/InboxBell'

const REFRESH_INTERVAL = 60

interface NavItem {
  path: string
  label: string
  en: string
  icon: React.ComponentType<{ size?: number }>
  badgeKey?: 'blocked' | 'pending' | 'alerts'
}

interface NavGroup {
  label: string
  en: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: '总览', en: 'Overview',
    items: [
      { path: '/', label: '每日动态', en: 'Daily Feed', icon: Activity },
      { path: '/explore', label: '探索', en: 'Explore', icon: Search },
    ],
  },
  {
    label: '团队管理', en: 'Team',
    items: [
      { path: '/people', label: '人员', en: 'People', icon: Users, badgeKey: 'blocked' },
      { path: '/team', label: '看板', en: 'Scoreboard', icon: LayoutDashboard },
      { path: '/leaderboard', label: '排行', en: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    label: '项目', en: 'Projects',
    items: [
      { path: '/projects', label: '项目', en: 'Projects', icon: ClipboardCheck },
      { path: '/openproject', label: 'OpenProject', en: 'OpenProject', icon: Kanban },
    ],
  },
  {
    label: '系统', en: 'System',
    items: [
      { path: '/settings', label: '设置', en: 'Settings', icon: Settings },
    ],
  },
]

const PAGE_TITLES: Record<string, [string, string]> = {
  '/': ['每日动态', 'Daily Feed'],
  '/explore': ['探索', 'Explore'],
  '/people': ['人员', 'People'],
  '/team': ['看板', 'Scoreboard'],
  '/leaderboard': ['排行', 'Leaderboard'],
  '/monthly': ['月度推进', 'Monthly'],
  '/projects': ['项目', 'Projects'],
  '/openproject': ['OpenProject', 'OpenProject'],
  '/settings': ['设置', 'Settings'],
}

export default function SyphonixLayout() {
  useSocket()
  const location = useLocation()
  const { isConnected, lastRefresh, loading, refresh, tasks, decisions } = useSyphonixStore()
  const { t, lang, toggle } = useI18n()
  const { user, setUser } = useCurrentUser()
  const [roster, setRoster] = useState<RosterPerson[]>([])
  useEffect(() => { fetchRoster().then((r) => setRoster(r.roster)).catch(() => {}) }, [])
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)

  useEffect(() => { void refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void refresh()
          return REFRESH_INTERVAL
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [refresh])

  const handleRefresh = useCallback(() => {
    void refresh()
    setCountdown(REFRESH_INTERVAL)
  }, [refresh])

  const pt = PAGE_TITLES[location.pathname]
  const pageTitle = pt ? t(pt[0], pt[1]) : 'Syphonix'
  const blockedCount = tasks.filter((t) =>
    t.statusName === 'On hold' || t.statusName === 'Rejected' || t.statusName === 'Test failed'
  ).length
  const pendingCount = decisions.filter((d) => d.status === 'PENDING').length
  // Alert count: high-pri new > 3d + blocker > 24h
  const alertCount = tasks.filter((t) => {
    const isHighNew = ['High','Immediate'].includes(t.priorityName) && t.statusName === 'New' &&
      (Date.now() - new Date(t.createdAt).getTime()) > 3 * 86400000
    const isBlockedLong = (t.statusName === 'On hold' || t.statusName === 'Rejected') &&
      (Date.now() - new Date(t.updatedAt).getTime()) > 24 * 3600000
    return isHighNew || isBlockedLong
  }).length

  const badgeCounts: Record<string, number> = {
    blocked: blockedCount,
    pending: pendingCount,
    alerts: alertCount,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <nav style={{
        width: 220, minWidth: 220, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <LogoLockup size={24} />
        </div>

        <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <div style={{
                padding: '8px 16px 4px', fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)',
              }}>
                {t(group.label, group.en)}
              </div>
              {group.items.map(({ path, label, en, icon: Icon, badgeKey }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 16px', textDecoration: 'none',
                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    fontSize: 12, fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.15s', position: 'relative',
                  })}
                >
                  <Icon size={16} />
                  <span>{t(label, en)}</span>
                  {badgeKey && badgeCounts[badgeKey] > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: badgeKey === 'blocked' ? 'rgba(239,68,68,0.15)' :
                        badgeKey === 'pending' ? 'rgba(139,92,246,0.15)' : 'rgba(245,158,11,0.15)',
                      color: badgeKey === 'blocked' ? '#EF4444' :
                        badgeKey === 'pending' ? '#8B5CF6' : '#F59E0B',
                      fontSize: 9, fontWeight: 700, padding: '1px 6px',
                      borderRadius: 99, minWidth: 18, textAlign: 'center',
                    }}>
                      {badgeCounts[badgeKey]}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isConnected ? '#22C55E' : '#EF4444',
              boxShadow: isConnected ? '0 0 6px #22C55E' : '0 0 6px #EF4444',
            }} />
            <span>{isConnected ? t('已连接', 'Connected') : t('未连接', 'Disconnected')}</span>
          </div>
          {lastRefresh && (
            <span style={{ fontSize: 9 }}>
              Last: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}
        </div>
      </nav>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          height: 48, minHeight: 48, display: 'flex', alignItems: 'center',
          padding: '0 20px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          justifyContent: 'space-between',
        }}>
          <div className="font-heading" style={{
            fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: 1,
          }}>
            {pageTitle}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* identity (acts as login for comments) */}
            <select
              value={user?.personId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                const p = roster.find((r) => r.personId === id)
                setUser(p ? { personId: p.personId, name: p.name } : null)
              }}
              title={t('选择你的身份（用于评论署名）', 'Your identity (for comment authorship)')}
              style={{ fontSize: 11, padding: '3px 6px', background: user ? 'var(--accent-light)' : 'var(--surface)', color: user ? 'var(--accent)' : 'var(--muted)', border: '1px solid var(--border)', borderRadius: 99, fontWeight: 600 }}
            >
              <option value="">{t('未登录', 'Sign in')}</option>
              {roster.map((p) => <option key={p.personId} value={p.personId}>{p.name}</option>)}
            </select>
            <button
              onClick={toggle}
              className="btn btn-sm"
              title="切换语言 / Switch language"
              style={{ fontWeight: 700, minWidth: 34 }}
            >
              {lang === 'en' ? '中' : 'EN'}
            </button>
            <InboxBell />
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
              {t('下次', 'Next')}: {countdown}s
            </span>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={11} style={loading ? { animation: 'pulse-dot 1s infinite' } : undefined} />
              {t('刷新', 'Refresh')}
            </button>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {tasks.length} {t('任务', 'tasks')}
            </span>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <Outlet />
        </main>
      </div>

      {/* Floating grounded Q&A assistant */}
      <ChatWidget />
    </div>
  )
}
