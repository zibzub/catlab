import { useEffect, useRef, useState } from 'react'
import type { IdlePattern, IdleSpeed } from './types'

export const IDLE_HOP_DURATION_MS = 480
export const SNAKE_MAX_LENGTH = 10
export const SNAKE_DIRECTION_MIN_MS = 2500
export const SNAKE_DIRECTION_MAX_MS = 3500

export const IDLE_PATTERNS = ['off', 'wave', 'cascade', 'random', 'popcorn', 'ripple', 'worm', 'snake-game'] as const
export const IDLE_SPEEDS = ['slow', 'medium', 'fast'] as const

interface IdleSpeedTiming {
  stagger: number
  cascadeStagger: number
  rowGap: number
  repeatPause: number
  randomBase: number
  randomJitter: number
  rippleStep: number
  rippleWithin: number
  popcornBase: number
  popcornJitter: number
  snakeStep: number
  snakeStagger: number
}

export const IDLE_SPEED_TIMING: Record<IdleSpeed, IdleSpeedTiming> = {
  slow: {
    stagger: 180,
    cascadeStagger: 85,
    rowGap: 260,
    repeatPause: 1600,
    randomBase: 1400,
    randomJitter: 900,
    rippleStep: 140,
    rippleWithin: 35,
    popcornBase: 1600,
    popcornJitter: 1100,
    snakeStep: 520,
    snakeStagger: 55,
  },
  medium: {
    stagger: 120,
    cascadeStagger: 55,
    rowGap: 180,
    repeatPause: 1050,
    randomBase: 720,
    randomJitter: 480,
    rippleStep: 100,
    rippleWithin: 28,
    popcornBase: 850,
    popcornJitter: 650,
    snakeStep: 340,
    snakeStagger: 38,
  },
  fast: {
    stagger: 75,
    cascadeStagger: 35,
    rowGap: 120,
    repeatPause: 650,
    randomBase: 380,
    randomJitter: 260,
    rippleStep: 75,
    rippleWithin: 20,
    popcornBase: 360,
    popcornJitter: 360,
    snakeStep: 220,
    snakeStagger: 26,
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

type SequencePattern = 'wave' | 'cascade' | 'ripple' | 'worm'
type SnakeDirection = 'up' | 'right' | 'down' | 'left'

const SNAKE_DIRECTIONS: SnakeDirection[] = ['up', 'right', 'down', 'left']

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

function sequenceFor(cats: IdleGridCat[], pattern: SequencePattern, timing: IdleSpeedTiming, random: () => number): IdleStep[] {
  if (pattern === 'wave' || pattern === 'cascade') {
    const ordered = [...cats].sort((first, second) => first.row - second.row || first.column - second.column)
    const stagger = pattern === 'cascade' ? timing.cascadeStagger : timing.stagger
    return ordered.map((cat, index) => ({
      rescueOrder: cat.rescueOrder,
      delay: index === 0 ? 0 : pattern === 'wave' && cat.row !== ordered[index - 1]?.row ? timing.rowGap : stagger,
    }))
  }

  if (pattern === 'worm') {
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

function popcornCluster(cats: IdleGridCat[], random: () => number, previousKey: string) {
  const targetSize = Math.min(cats.length, 3 + Math.floor(random() * 4))
  let cluster: IdleGridCat[] = []
  let clusterKey = previousKey
  for (let attempt = 0; attempt < 6 && clusterKey === previousKey; attempt += 1) {
    const origin = cats[Math.floor(random() * cats.length)]
    if (!origin) return { cluster: [], key: '' }
    const candidates = cats
      .map((cat) => ({
        cat,
        distance: Math.abs(cat.row - origin.row) + Math.abs(cat.column - origin.column),
        tie: random(),
      }))
      .sort((first, second) => first.distance - second.distance || first.tie - second.tie)
    cluster = candidates.slice(0, targetSize).map(({ cat }) => cat)
    clusterKey = cluster.map((cat) => cat.rescueOrder).sort((first, second) => first - second).join(',')
  }
  return { cluster, key: clusterKey }
}

function rowColumns(cats: IdleGridCat[]) {
  const columns = new Map<number, number[]>()
  for (const cat of cats) {
    const row = columns.get(cat.row)
    if (row) row.push(cat.column)
    else columns.set(cat.row, [cat.column])
  }
  for (const values of columns.values()) values.sort((first, second) => first - second)
  return columns
}

function nextSnakeCell(cats: IdleGridCat[], head: IdleGridCat, direction: SnakeDirection) {
  const rows = [...new Set(cats.map((cat) => cat.row))].sort((first, second) => first - second)
  const columns = rowColumns(cats)
  if (rows.length === 0) return undefined
  const currentRowIndex = Math.max(0, rows.indexOf(head.row))
  const rowDelta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0
  const targetRowIndex = (currentRowIndex + rowDelta + rows.length) % rows.length
  const targetRow = rowDelta === 0 ? head.row : rows[targetRowIndex]
  const targetColumns = columns.get(targetRow) ?? []
  if (targetColumns.length === 0) return cats[0]

  if (direction === 'left' || direction === 'right') {
    const delta = direction === 'left' ? -1 : 1
    const exact = targetColumns.find((column) => column === head.column + delta)
    const targetColumn = exact ?? (delta > 0 ? targetColumns[0] : targetColumns[targetColumns.length - 1])
    return cats.find((cat) => cat.row === targetRow && cat.column === targetColumn)
  }

  const sameColumn = targetColumns.find((column) => column === head.column)
  const nearestColumn = sameColumn ?? targetColumns.reduce((nearest, column) => (
    Math.abs(column - head.column) < Math.abs(nearest - head.column) ? column : nearest
  ), targetColumns[0])
  return cats.find((cat) => cat.row === targetRow && cat.column === nearestColumn)
}

function turnedDirection(direction: SnakeDirection, amount: number) {
  const index = SNAKE_DIRECTIONS.indexOf(direction)
  return SNAKE_DIRECTIONS[(index + amount + SNAKE_DIRECTIONS.length) % SNAKE_DIRECTIONS.length]
}

function chooseSnakeDirection(cats: IdleGridCat[], head: IdleGridCat, direction: SnakeDirection, random: () => number) {
  const opposite = turnedDirection(direction, 2)
  const candidates = SNAKE_DIRECTIONS.filter((candidate) => candidate !== opposite)
  const roll = random()
  const preferred = roll < 0.5 ? direction : roll < 0.75 ? turnedDirection(direction, -1) : turnedDirection(direction, 1)
  if (candidates.includes(preferred) && nextSnakeCell(cats, head, preferred)) return preferred
  return candidates.find((candidate) => nextSnakeCell(cats, head, candidate)) ?? direction
}

function initialSnakeState(cats: IdleGridCat[], random: () => number) {
  const head = cats[Math.floor(random() * cats.length)]
  if (!head) return undefined
  const direction = SNAKE_DIRECTIONS[Math.floor(random() * SNAKE_DIRECTIONS.length)] ?? 'right'
  const tail = nextSnakeCell(cats, head, turnedDirection(direction, 2)) ?? head
  return { body: [head, tail].slice(0, Math.min(2, cats.length)), direction }
}

function nextSnakeDirectionInterval(random: () => number) {
  return SNAKE_DIRECTION_MIN_MS + Math.floor(random() * (SNAKE_DIRECTION_MAX_MS - SNAKE_DIRECTION_MIN_MS + 1))
}

export function useIdleAnimation({ cats, pattern, speed, isScrolling }: IdleAnimationOptions) {
  const [activeOrders, setActiveOrders] = useState<ReadonlySet<number>>(() => new Set())
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')
  const [motionAllowed, setMotionAllowed] = useState(() => typeof window === 'undefined'
    || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const timerRef = useRef<number | null>(null)
  const hopTimersRef = useRef(new Map<number, number>())
  const batchTimersRef = useRef(new Set<number>())
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
    for (const timer of batchTimersRef.current) window.clearTimeout(timer)
    batchTimersRef.current.clear()
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
    const triggerBatch = (orders: number[], stagger: number) => {
      const uniqueOrders = [...new Set(orders)]
      uniqueOrders.forEach((order, index) => {
        if (index === 0 || stagger <= 0) {
          trigger(order)
          return
        }
        const timer = window.setTimeout(() => {
          batchTimersRef.current.delete(timer)
          trigger(order)
        }, index * stagger)
        batchTimersRef.current.add(timer)
      })
    }
    const scheduleSequence = () => {
      const sequence = sequenceFor(cats, pattern as SequencePattern, timing, random)
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
    } else if (pattern === 'popcorn') {
      let previousClusterKey = ''
      const schedulePopcorn = () => {
        if (cancelled) return
        const result = popcornCluster(cats, random, previousClusterKey)
        previousClusterKey = result.key
        triggerBatch(result.cluster.map((cat) => cat.rescueOrder), 0)
        timerRef.current = window.setTimeout(schedulePopcorn, timing.popcornBase + Math.floor(random() * timing.popcornJitter))
      }
      schedulePopcorn()
    } else if (pattern === 'snake-game') {
      const state = initialSnakeState(cats, random)
      if (state) {
        let body = state.body
        let direction = state.direction
        let stepCount = 0
        let nextDirectionDecisionAt = Date.now() + nextSnakeDirectionInterval(random)
        const stepsPerRun = Math.max(cats.length, SNAKE_MAX_LENGTH * 2)
        const scheduleSnake = () => {
          if (cancelled) return
          const head = body[0]
          if (!head || stepCount >= stepsPerRun) {
            stepCount = 0
            timerRef.current = window.setTimeout(() => {
              const nextState = initialSnakeState(cats, random)
              if (nextState) {
                body = nextState.body
                direction = nextState.direction
                nextDirectionDecisionAt = Date.now() + nextSnakeDirectionInterval(random)
              }
              scheduleSnake()
            }, timing.repeatPause)
            return
          }
          if (Date.now() >= nextDirectionDecisionAt) {
            direction = chooseSnakeDirection(cats, head, direction, random)
            nextDirectionDecisionAt = Date.now() + nextSnakeDirectionInterval(random)
          }
          const nextHead = nextSnakeCell(cats, head, direction) ?? head
          stepCount += 1
          const targetLength = Math.min(cats.length, SNAKE_MAX_LENGTH, 2 + Math.floor(stepCount / 4))
          body = [nextHead, ...body].slice(0, targetLength)
          triggerBatch(body.map((cat) => cat.rescueOrder), timing.snakeStagger)
          timerRef.current = window.setTimeout(scheduleSnake, timing.snakeStep)
        }
        triggerBatch(body.map((cat) => cat.rescueOrder), timing.snakeStagger)
        timerRef.current = window.setTimeout(scheduleSnake, timing.snakeStep)
      }
    } else {
      scheduleSequence()
    }

    return () => {
      cancelled = true
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      for (const timer of batchTimersRef.current) window.clearTimeout(timer)
      batchTimersRef.current.clear()
      for (const timer of hopTimersRef.current.values()) window.clearTimeout(timer)
      hopTimersRef.current.clear()
    }
  }, [catsKey, cats, isScrolling, motionAllowed, pageVisible, pattern, speed])

  return activeOrders
}
