/**
 * Lightweight "logged-in user" — pick who you are once (persisted to
 * localStorage). Used to auto-attribute comments. No real auth backend.
 */
import { createContext, useContext, useState, type ReactNode } from 'react'

export interface CurrentUser { personId: number; name: string }

interface Ctx { user: CurrentUser | null; setUser: (u: CurrentUser | null) => void }
const C = createContext<Ctx>({ user: null, setUser: () => {} })

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || 'null') } catch { return null }
  })
  const setUser = (u: CurrentUser | null) => {
    setUserState(u)
    if (u) localStorage.setItem('currentUser', JSON.stringify(u))
    else localStorage.removeItem('currentUser')
  }
  return <C.Provider value={{ user, setUser }}>{children}</C.Provider>
}

export const useCurrentUser = () => useContext(C)
