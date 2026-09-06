import { describe, expect, it } from 'vitest'
import type { ComposePlacedCat, ComposePlacedText } from '../composeExport'
import { getComposeLayerDescription, getComposeLayerLabel } from '../components/ComposeLayersPanel'

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

  it('uses each MoonCat instance number regardless of layer order', () => {
    const cat = (id: string, z: number, rescueOrder: number, instanceNumber: number): ComposePlacedCat => ({
      id,
      kind: 'cat',
      rescueOrder,
      instanceNumber,
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

    const objects = [cat('cat-back', 1, 42, 3), cat('cat-other', 2, 7, 1), cat('cat-front', 3, 42, 1)]

    expect(objects.map(getComposeLayerLabel)).toEqual(['MoonCat 42 (3)', 'MoonCat 7', 'MoonCat 42'])
    expect(getComposeLayerLabel({ ...objects[0], z: 4 })).toBe('MoonCat 42 (3)')
  })
})
