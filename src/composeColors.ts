export interface ComposeEditorColors {
  foreground: string
  background: string
}

export const DEFAULT_COMPOSE_FOREGROUND = '#ffffff'
export const DEFAULT_COMPOSE_BACKGROUND = '#000000'

export const DEFAULT_COMPOSE_EDITOR_COLORS: ComposeEditorColors = {
  foreground: DEFAULT_COMPOSE_FOREGROUND,
  background: DEFAULT_COMPOSE_BACKGROUND,
}

export function swapComposeEditorColors(colors: ComposeEditorColors): ComposeEditorColors {
  return { foreground: colors.background, background: colors.foreground }
}

export function resetComposeEditorColors(): ComposeEditorColors {
  return { ...DEFAULT_COMPOSE_EDITOR_COLORS }
}

export function getComposeCreationColors(kind: 'rect', colors: ComposeEditorColors): { fill: string }
export function getComposeCreationColors(kind: 'text', colors: ComposeEditorColors): { fill: string; stroke: string }
export function getComposeCreationColors(kind: 'rect' | 'text', colors: ComposeEditorColors) {
  return kind === 'rect' ? { fill: colors.foreground } : { fill: colors.foreground, stroke: colors.background }
}
