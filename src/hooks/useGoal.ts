import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

interface Goal { year: number; count: number }

const LS_KEY = 'haiku_goal'

export function useGoal() {
  const currentYear = new Date().getFullYear()
  const [goal, setGoal] = useState<Goal>({ year: currentYear, count: 0 })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/settings/goal')
      .then((data: Goal) => {
        if (data.year === currentYear) {
          setGoal(data)
        } else {
          setGoal({ year: currentYear, count: 0 })
          api.put('/settings/goal', { count: 0, year: currentYear }).catch(() => {})
        }
        localStorage.setItem(LS_KEY, JSON.stringify(data))
      })
      .catch(() => {
        try {
          const stored = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
          if (stored?.year === currentYear) setGoal(stored as Goal)
        } catch {}
      })
  }, [])

  const updateCount = (n: number | string) => {
    const v = Math.max(0, parseInt(String(n)) || 0)
    const next: Goal = { year: currentYear, count: v }
    setGoal(next)
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      api.put('/settings/goal', next).catch(() => {})
    }, 600)
  }

  return { goal, updateCount }
}
