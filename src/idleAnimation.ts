import { useEffect, useRef, useState } from 'react'
import type { IdlePattern, IdleSpeed } from './types'

export const IDLE_HOP_DURATION_MS = 480

export const IDLE_PATTERNS = ['off', 'wave', 'random', 'ripple', 'snake'] as const
export const IDLE_SPEEDS = ['slow', 'medium', 'fast'] as const

interface IdleSpeedTiming {
  stagger: number
  rowGap: number
  repeatPause: number
  randomBase: number
  randomJitter: number
  rippleStep: number
  rippleWithin: number
}

export const IDLE_SPEED_TIMING: Record<IdleSpeed, IdleSpeedTiming> = {
  slow: {
    stagger: 180,
    rowGap: 260,
    repeatPause: 1600,
    randomBase: 1400,
    randomJitter: 900,
    rippleStep: 140,
    rippleWithin: 35,
  },
  medium: {
    stagger: 120,
    rowGap: 180,
    repeatPause: 1050,
    randomBase: 720,
    randomJitter: 480,
    rippleStep: 100,
    rippleWithin: 28,
  },
  fast: {
    stagger: 75,
    rowGap: 120,
    repeatPause: 650,
    randomBase: 380,
    randomJitter: 260,
    rippleStep: 75,
    rippleWithin: 20,
  },
}

export function isIdlePattern(value: unknown): value is IdlePattern {
  return typeof value === 'string' && IDLE_PATTERNS.includes(value as IdlePattern)
}

export function isIdleSpeed(value: unknown): value is IdleSpeed {
  return typeof value === 'string' && IDLE_SPEEDS.includes(value as IdleSpeed)
}

export interface IdleGridCat {
  rescueOrder: number
  row: number
  column: number
}

interface IdleAnimationOptions {
  cats: IdleGridCat[]
  pattern: IdlePattern
  speed: IdleSpeed
  isScrolling: boolean
}

interface IdleStep {
  rescueOrder: number
  delay: number
}

function hashSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function rowsFor(cats: IdleGridCat[]) {
  const rows = new Map<number, IdleGridCat[]>()
  for (const cat of cats) {
    const row = rows.get(cat.row)
    if (row) row.push(cat)
    else rows.set(cat.row, [cat])
  }
  return [...rows.entries()].sort(([first], [second]) => first - second)
}

function sequenceFor(cats: IdleGridCat[], pattern: Exclude<IdlePattern, 'off' | 'random'>, timing: IdleSpeedTiming, random: () => number): IdleStep[] {
  if (pattern === 'wave') {
    const ordered = [...cats].sort((first, second) => first.row - second.row || first.column - second.column)
    return ordered.map((cat, index) => ({
      rescueOrder: cat.rescueOrder,
      delay: index === 0 ? 0 : cat.row === ordered[index - 1]?.row ? timing.stagger : timing.rowGap,
    }))
  }

  if (pattern === 'snake') {
    const ordered = rowsFor(cats).flatMap(([, row], rowIndex) => {
      const sortedRow = [...row].sort((first, second) => first.column - second.column)
      return rowIndex % 2 === 0 ? sortedRow : sortedRow.reverse()
    })
    return ordered.map((cat, index) => ({ rescueOrder: cat.rescueOrder, delay: index === 0 ? 0 : timing.stagger }))
  }

  const origin = cats[Math.floor(random() * cats.length)]
  if (!origin) return []
  const grouped = [...cats]
    .map((cat) => ({
      cat,
      distance: Math.abs(cat.row - origin.row) + Math.abs(cat.column - origin.column),
    }))
    .sort((first, second) => first.distance - second.distance
      || first.cat.row - second.cat.row
      || first.cat.column - second.cat.column)
  let previousStart = 0
  const distanceIndexes = new Map<number, number>()
  return grouped.map(({ cat, distance }) => {
    const distanceIndex = distanceIndexes.get(distance) ?? 0
    distanceIndexes.set(distance, distanceIndex + 1)
    const start = distance * timing.rippleStep + distanceIndex * timing.rippleWithin
    const delay = Math.max(0, start - previousStart)
    previousStart = start
    return { rescueOrder: cat.rescueOrder, delay }
  })
}

export function useIdleAnimation({ cats, pattern, speed, isScrolling }: IdleAnimationOptions) {
  const [activeOrders, setActiveOrders] = useState<ReadonlySet<number>>(() => new Set())
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  const [motionAllowed, setMotionAllowed] = useState(() => typeof window === 'undefined'
    || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const timerRef = useRef<number | null>(null)
  const hopTimersRef = useRef(new Map<number, number>())
  const catsKey = cats.map((cat) => `${cat.rescueOrder}:${cat.row}:${cat.column}`).join('|')

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = () => setMotionAllowed(!query.matches)
    query.addEventListener?.('change', handleChange)
    return () => query.removeEventListener?.('change', handleChange)
  }, [])

  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    for (const timer of hopTimersRef.current.values()) window.clearTimeout(timer)
    hopTimersRef.current.clear()
    setActiveOrders(new Set())

    if (pattern === 'off' || isScrolling || !pageVisible || !motionAllowed || cats.length === 0) return

    let cancelled = false
    const timing = IDLE_SPEED_TIMING[speed]
    const random = seededRandom(`${catsKey}:${pattern}:${speed}`)
    const trigger = (rescueOrder: number) => {
      if (cancelled) return
      setActiveOrders((current) => {
        if (current.has(rescueOrder)) return current
        const next = new Set(current)
        next.add(rescueOrder)
        return next
      })
      const previousTimer = hopTimersRef.current.get(rescueOrder)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      hopTimersRef.current.set(rescueOrder, window.setTimeout(() => {
        hopTimersRef.current.delete(rescueOrder)
        setActiveOrders((current) => {
          if (!current.has(rescueOrder)) return current
          const next = new Set(current)
          next.delete(rescueOrder)
          return next
        })
      }, IDLE_HOP_DURATION_MS))
    }
    const scheduleSequence = () => {
      const sequence = sequenceFor(cats, pattern as Exclude<IdlePattern, 'off' | 'random'>, timing, random)
      let index = 0
      const playNext = () => {
        if (cancelled) return
        const step = sequence[index]
        if (!step) {
          timerRef.current = window.setTimeout(scheduleSequence, timing.repeatPause)
          return
        }
        index += 1
        timerRef.current = window.setTimeout(() => {
          trigger(step.rescueOrder)
          playNext()
        }, step.delay)
      }
      playNext()
    }

    if (pattern === 'random') {
      let lastIndex = -1
      const scheduleRandom = () => {
        if (cancelled) return
        let nextIndex = Math.floor(random() * cats.length)
        if (cats.length > 1 && nextIndex === lastIndex) nextIndex = (nextIndex + 1) % cats.length
        lastIndex = nextIndex
        trigger(cats[nextIndex]?.rescueOrder ?? cats[0].rescueOrder)
        timerRef.current = window.setTimeout(scheduleRandom, timing.randomBase + Math.floor(random() * timing.randomJitter))
      }
      scheduleRandom()
    } else {
      scheduleSequence()
    }

    return () => {
      cancelled = true
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      for (const timer of hopTimersRef.current.values()) window.clearTimeout(timer)
      hopTimersRef.current.clear()
    }
  }, [catsKey, cats, isScrolling, motionAllowed, pageVisible, pattern, speed])

  return activeOrders
}
