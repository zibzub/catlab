import { describe, expect, it } from 'vitest'
import {
  COMPOSE_DOCUMENT_FORMAT,
  COMPOSE_DOCUMENT_V1_VERSION,
  COMPOSE_DOCUMENT_VERSION,
  parseComposeDocument,
  serializeComposeDocument,
} from '../composeDocument'
import type { ComposePlacedObject } from '../composeExport'

const transform = {
  x: 0.25,
  y: 0.75,
  scale: 1.5,
  rotation: 15,
  opacity: 0.8,
  flipX: true,
  flipY: false,
  z: 4,
  locked: true,
  visible: false,
}

const document = {
  format: COMPOSE_DOCUMENT_FORMAT,
  version: COMPOSE_DOCUMENT_VERSION,
  background: { kind: 'reference', url: './background.png', width: 1200, height: 900, name: 'Background' },
  objects: [
    { kind: 'cat', rescueOrder: 25_439, artMode: 'faces', ...transform },
    {
      kind: 'text',
      text: 'MoonCats',
      fill: '#abc',
      stroke: '#000000',
      strokeWidth: 3,
      fontSize: 72,
      fontFamily: 'Arial',
      ...transform,
      z: 5,
    },
    { kind: 'rect', width: 0.5, height: 0.25, fill: '#123456', ...transform, z: 6 },
  ],
} as const

const legacyDocument = {
  format: COMPOSE_DOCUMENT_FORMAT,
  version: COMPOSE_DOCUMENT_V1_VERSION,
  background: null,
  objects: [
    {
      kind: 'cat',
      rescueOrder: 25_439,
      artMode: 'faces',
      x: transform.x,
      y: transform.y,
      scale: transform.scale,
      rotation: transform.rotation,
      opacity: transform.opacity,
      flipX: transform.flipX,
      flipY: transform.flipY,
      z: transform.z,
    },
  ],
} as const

describe('Compose document parsing', () => {
  it('restores all persisted object kinds and normalizes CSS colors', () => {
    const loaded = parseComposeDocument(document)
    expect(loaded.background).toEqual({ url: './background.png', width: 1200, height: 900, name: 'Background' })
    expect(loaded.placedObjects).toHaveLength(3)
    expect(loaded.placedObjects[0]).toMatchObject({ kind: 'cat', rescueOrder: 25_439, artMode: 'faces', ...transform })
    expect(loaded.placedObjects[1]).toMatchObject({
      kind: 'text',
      text: 'MoonCats',
      fill: '#aabbcc',
      stroke: '#000000',
      fontSize: 72,
    })
    expect(loaded.placedObjects[2]).toMatchObject({ kind: 'rect', width: 0.5, height: 0.25, fill: '#123456' })
    expect(loaded.placedObjects.every((object) => object.locked === true && object.visible === false)).toBe(true)
    expect(loaded.placedObjects.every((object) => object.id.startsWith(`compose-${object.kind}-`))).toBe(true)
  })

  it('loads version-1 objects with unlocked and visible defaults', () => {
    const loaded = parseComposeDocument(legacyDocument)
    expect(loaded.placedObjects[0]).toMatchObject({ locked: false, visible: true })
  })

  it('rejects unsupported versions and malformed persisted data', () => {
    expect(() => parseComposeDocument({ ...document, version: 3 })).toThrow('Unsupported CatLab composition version')
    expect(() =>
      parseComposeDocument({ ...document, objects: [{ ...document.objects[0], rescueOrder: 25_440 }] }),
    ).toThrow('Invalid MoonCat rescue order')
    expect(() =>
      parseComposeDocument({
        ...document,
        background: { ...document.background, url: 'https://example.com/image.png' },
      }),
    ).toThrow('local path')
    expect(() => parseComposeDocument({ ...document, objects: [{ ...document.objects[1], fill: 'red' }] })).toThrow(
      'Invalid text fill',
    )
    expect(() =>
      parseComposeDocument({ ...document, objects: [{ ...document.objects[0], visible: undefined }] }),
    ).toThrow('Invalid object visibility or lock state')
  })
})

describe('Compose document serialization', () => {
  it('round-trips placed objects and local reference backgrounds without runtime ids', async () => {
    const placedObjects: ComposePlacedObject[] = parseComposeDocument(document).placedObjects
    const serialized = await serializeComposeDocument(placedObjects, {
      url: './background.png',
      width: 1200,
      height: 900,
      name: 'Background',
    })
    expect(serialized).toMatchObject({
      format: COMPOSE_DOCUMENT_FORMAT,
      version: COMPOSE_DOCUMENT_VERSION,
      background: document.background,
    })
    expect(serialized.objects).toEqual([
      document.objects[0],
      { ...document.objects[1], fill: '#aabbcc' },
      document.objects[2],
    ])
    expect(JSON.stringify(serialized)).not.toContain('compose-cat-')
  })

  it('keeps embedded image backgrounds self-contained', async () => {
    const serialized = await serializeComposeDocument([], {
      url: 'data:image/png;base64,AA==',
      width: 1,
      height: 1,
      name: 'Pixel',
    })
    expect(serialized.background).toEqual({
      kind: 'embedded',
      dataUrl: 'data:image/png;base64,AA==',
      width: 1,
      height: 1,
      name: 'Pixel',
    })
  })
})
