import { describe, expect, it } from 'vitest'
import type { ComposePlacedCat, ComposePlacedText } from '../composeExport'
import {
  getComposeLayerDescription,
  getComposeLayerLabel,
  getComposeLayerLabels,
} from '../components/ComposeLayersPanel'

const textObject: ComposePlacedText = {
  id: 'text-1',
  kind: 'text',
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flipX: false,
  flipY: false,
  z: 0,
  locked: false,
  visible: true,
  text: 'A long composition title that should stay compact',
  fill: '#ffffff',
  stroke: '#000000',
  strokeWidth: 0,
  fontSize: 56,
  fontFamily: 'Arial',
}

describe('Compose layer labels', () => {
  it('uses text content as the primary label and Text as the secondary label', () => {
    expect(getComposeLayerLabel(textObject)).toBe('Text')
    expect(getComposeLayerDescription(textObject)).toBe('A long composition title that should stay compact')
  })

  it('collapses whitespace and provides an empty-text fallback', () => {
    expect(getComposeLayerDescription({ ...textObject, text: '  hello\n  world  ' })).toBe('hello world')
    expect(getComposeLayerDescription({ ...textObject, text: ' \n\t ' })).toBe('Empty text')
  })

  it('numbers repeated MoonCat instances in front-to-back layer order', () => {
    const cat = (id: string, z: number, rescueOrder: number): ComposePlacedCat => ({
      id,
      kind: 'cat',
      rescueOrder,
      artMode: 'bodies',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
      z,
      locked: false,
      visible: true,
    })

    const labels = getComposeLayerLabels([cat('cat-back', 1, 42), cat('cat-other', 2, 7), cat('cat-front', 3, 42)])

    expect(labels.get('cat-front')).toBe('MoonCat 42')
    expect(labels.get('cat-back')).toBe('MoonCat 42 (2)')
    expect(labels.get('cat-other')).toBe('MoonCat 7')
  })
})
