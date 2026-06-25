/**
 * Minimal i18n — inline bilingual strings: t('中文', 'English').
 * Language is persisted to localStorage. No key dictionary to maintain.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'zh' | 'en'

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  toggle: () => void
  t: (zh: string, en: string) => string
}

const Ctx = createContext<I18nCtx>({ lang: 'zh', setLang: () => {}, toggle: () => {}, t: (zh) => zh })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lang') as Lang) || 'zh')
  useEffect(() => { localStorage.setItem('lang', lang) }, [lang])
  const t = (zh: string, en: string) => (lang === 'en' ? en : zh)
  const toggle = () => setLang(lang === 'en' ? 'zh' : 'en')
  return <Ctx.Provider value={{ lang, setLang, toggle, t }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)
