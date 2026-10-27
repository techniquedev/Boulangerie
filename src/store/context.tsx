import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../data/types'
import type { DemoState } from '../data/state'
import { loadState, initialState, STORAGE_KEY } from './initial'
import { nowStamp } from '../lib/format'
import { deviceFor } from '../data/trace'

type Ctx = {
  user: User | null
  setUser: (u: User | null) => void
  state: DemoState
  update: (fn: (s: DemoState) => DemoState) => void
  audit: (action: string, detail: string) => void
  toast: string
  say: (m: string) => void
  reset: () => void
}

const C = createContext<Ctx | null>(null)

export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState)
  const [user, setUser] = useState<User | null>(null)
  const [toast, say] = useState('')

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }, [state])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => say(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const update = (fn: (s: DemoState) => DemoState) => setState(fn)
  const audit = (action: string, detail: string) => {
    const at = nowStamp()
    setState(s => ({
      ...s,
      audit: [{ at, localAt: at, author: user?.name || 'Système', device: user?.group === 'DIRECTION GÉNÉRALE' ? 'PC-DIR' : deviceFor(user?.sites[0] || 'SIT-01'), site: user?.sites[0] || 'SIT-01', action, detail }, ...s.audit],
    }))
  }
  const reset = () => { setState(initialState()); say('Données de démonstration restaurées') }

  return <C.Provider value={{ user, setUser, state, update, audit, toast, say, reset }}>{children}</C.Provider>
}

export function useApp() {
  const c = useContext(C)
  if (!c) throw new Error('useApp hors Provider')
  return c
}
