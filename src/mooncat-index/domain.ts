export const MOONCAT_COUNT = 25_440
export const MAX_RESCUE_ORDER = MOONCAT_COUNT - 1

export function isValidRescueOrder(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_RESCUE_ORDER
}

export function isDay1RescueOrder(order: number): boolean {
  return isValidRescueOrder(order) && order <= 491
}

export function isDay2RescueOrder(order: number): boolean {
  return isValidRescueOrder(order) && order > 491 && order <= 903
}
