import type { GridArtMode, GridSize, GridViewMode } from '../types'

export const CONTINUOUS_SCROLL_VIEWPORTS_PER_SECOND = 1.2
export const PAGE_SCROLL_RATIO = 0.92

export function columnsForWidth(width: number, viewMode: GridViewMode, artMode: GridArtMode, gridSize: GridSize) {
  const isPhone = width <= 620
  if (artMode === 'faces') {
    const targetTileWidth = viewMode === 'compact'
      ? isPhone
        ? { small: 56, medium: 68, large: 82 }[gridSize]
        : { small: 70, medium: 84, large: 102 }[gridSize]
      : isPhone
        ? { small: 112, medium: 128, large: 148 }[gridSize]
        : { small: 118, medium: 136, large: 158 }[gridSize]
    const maxColumns = viewMode === 'compact' ? 16 : 9
    const gap = isPhone ? 7 : 11
    const calculatedColumns = Math.floor((width + gap) / (targetTileWidth + gap))
    return Math.max(1, Math.min(maxColumns, calculatedColumns))
  }
  const targetTileWidth =
    viewMode === 'compact'
      ? isPhone
        ? { small: 60, medium: 78, large: 108 }[gridSize]
        : { small: 78, medium: 96, large: 118 }[gridSize]
      : isPhone
        ? { small: 120, medium: 142, large: 166 }[gridSize]
        : { small: 122, medium: 142, large: 166 }[gridSize]
  const maxColumns = viewMode === 'compact'
    ? isPhone || gridSize === 'large' ? 14 : 16
    : 9
  const gap = isPhone ? 7 : 11
  const calculatedColumns = Math.floor((width + gap) / (targetTileWidth + gap))
  const minimumColumns = viewMode === 'compact' && gridSize === 'medium' && isPhone && width > 0 ? 4 : 1
  return Math.max(minimumColumns, Math.min(maxColumns, calculatedColumns))
}

export function rowEstimateFor(viewMode: GridViewMode, artMode: GridArtMode, gridSize: GridSize) {
  if (artMode === 'faces') {
    return viewMode === 'compact'
      ? { small: 114, medium: 126, large: 148 }[gridSize]
      : { small: 178, medium: 194, large: 224 }[gridSize]
  }
  return viewMode === 'compact'
    ? { small: 126, medium: 152, large: 178 }[gridSize]
    : { small: 205, medium: 225, large: 250 }[gridSize]
}

export function pageScrollTarget(scrollTop: number, clientHeight: number, scrollHeight: number, direction: -1 | 1) {
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  const target = Math.min(maxScroll, Math.max(0, scrollTop + direction * clientHeight * PAGE_SCROLL_RATIO))
  return { maxScroll, target }
}

export function continuousScrollTarget(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  direction: -1 | 1,
  elapsedMs: number,
) {
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  const distance = clientHeight * CONTINUOUS_SCROLL_VIEWPORTS_PER_SECOND * (elapsedMs / 1000)
  const target = Math.min(maxScroll, Math.max(0, scrollTop + direction * distance))
  return { maxScroll, target }
}

export function reachedScrollEndpoint(target: number, maxScroll: number, direction: -1 | 1) {
  return (direction < 0 && target <= 0) || (direction > 0 && target >= maxScroll)
}
