import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMPOSE_BACKGROUND,
  DEFAULT_COMPOSE_EDITOR_COLORS,
  DEFAULT_COMPOSE_FOREGROUND,
  getComposeCreationColors,
  resetComposeEditorColors,
  swapComposeEditorColors,
} from '../composeColors'

describe('Compose editor colors', () => {
  it('uses white foreground and black background defaults', () => {
    expect(DEFAULT_COMPOSE_EDITOR_COLORS).toEqual({
      foreground: DEFAULT_COMPOSE_FOREGROUND,
      background: DEFAULT_COMPOSE_BACKGROUND,
    })
  })

  it('swaps colors without mutating the source pair', () => {
    const colors = { foreground: '#123456', background: '#abcdef' }

    expect(swapComposeEditorColors(colors)).toEqual({ foreground: '#abcdef', background: '#123456' })
    expect(colors).toEqual({ foreground: '#123456', background: '#abcdef' })
  })

  it('resets to the default colors', () => {
    expect(resetComposeEditorColors()).toEqual({ foreground: '#ffffff', background: '#000000' })
  })

  it('maps foreground/background colors to new object appearance', () => {
    const colors = { foreground: '#f00f00', background: '#0011aa' }

    expect(getComposeCreationColors('rect', colors)).toEqual({ fill: '#f00f00' })
    expect(getComposeCreationColors('text', colors)).toEqual({ fill: '#f00f00', stroke: '#0011aa' })
  })
})
