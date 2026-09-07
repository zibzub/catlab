const MIN_DYNAMIC_RING_SCALE = 0.5
const MAX_DYNAMIC_RING_SCALE = 1.18

const DYNAMIC_RING_SCALE_BY_POSE: Record<string, number> = {
  standing: 0.8,
  stalking: 1.00,
  pouncing: 0.7,
  sleeping: 1.05,
}

export function getDynamicRingScale(pose: string) {
  const scale = DYNAMIC_RING_SCALE_BY_POSE[pose] ?? 1
  return Math.min(MAX_DYNAMIC_RING_SCALE, Math.max(MIN_DYNAMIC_RING_SCALE, scale))
}
