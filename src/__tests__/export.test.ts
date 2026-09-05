import { describe, expect, it } from 'vitest'
import {
  exportArchiveFilename,
  exportFilename,
  exportMimeType,
  EXPORT_SCALES,
  MAX_EXPORT_CATS,
  validateExportSelectionCount,
} from '../export'

describe('MoonCat export planning', () => {
  it('uses current format, art-mode, and archive filename conventions', () => {
    expect(exportMimeType('png')).toBe('image/png')
    expect(exportMimeType('webp')).toBe('image/webp')
    expect(exportFilename(42, 'bodies', 'png')).toBe('42.png')
    expect(exportFilename(42, 'faces', 'webp')).toBe('42-face.webp')
    expect(exportArchiveFilename('bodies', 2)).toBe('catlab-bodies-2-cats.zip')
    expect(exportArchiveFilename('faces', 10)).toBe('catlab-faces-10-cats.zip')
    expect(EXPORT_SCALES).toEqual({ small: 8, medium: 16, large: 32 })
  })

  it('enforces the current single and multi-export selection bounds', () => {
    expect(() => validateExportSelectionCount(0)).toThrow('Select at least one MoonCat')
    expect(() => validateExportSelectionCount(MAX_EXPORT_CATS + 1)).toThrow(`${MAX_EXPORT_CATS} or fewer`)
    expect(() => validateExportSelectionCount(1)).not.toThrow()
    expect(() => validateExportSelectionCount(MAX_EXPORT_CATS)).not.toThrow()
  })
})
