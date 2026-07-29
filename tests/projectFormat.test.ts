import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { duplicateProjectSnapshot, validateProjectSnapshot, type ProjectSnapshot } from '../src/projectFormat.ts'
import { DEFAULT_IMAGE_TRANSFORM } from '../src/imageComposition.ts'

const snapshot: ProjectSnapshot = {
  version: 1,
  id: 'project-1',
  name: '橘猫 40 格',
  savedAt: '2026-07-29T10:00:00.000Z',
  sourceName: 'cat.png',
  sourceDataUrl: 'data:image/png;base64,AAAA',
  options: {
    width: 40, height: 40, maxColors: 18, brightness: 0, contrast: 8, saturation: 105,
    removeBackground: false, backgroundTolerance: 22, dither: false, fit: 'contain',
    transform: DEFAULT_IMAGE_TRANSFORM, mode: 'cartoon',
  },
  paletteId: 'mard',
  disabledPaletteColors: [],
  customPalette: null,
  pattern: { width: 1, height: 1, cells: [{ color: null }], usage: [], totalBeads: 0 },
  completedProgress: [],
}

describe('project snapshot format', () => {
  it('accepts a complete version 1 snapshot', () => {
    assert.equal(validateProjectSnapshot(snapshot).name, '橘猫 40 格')
  })

  it('rejects unsafe or incomplete project files', () => {
    assert.throws(() => validateProjectSnapshot({ ...snapshot, sourceDataUrl: 'https://example.com/cat.png' }), /图片数据/)
    assert.throws(() => validateProjectSnapshot({ ...snapshot, version: 9 }), /版本/)
  })

  it('duplicates a project as an independent version', () => {
    const copy = duplicateProjectSnapshot(snapshot, 'project-2', '2026-07-29T11:00:00.000Z')
    assert.equal(copy.id, 'project-2')
    assert.equal(copy.name, '橘猫 40 格 · 副本')
    assert.equal(copy.sourceDataUrl, snapshot.sourceDataUrl)
    assert.notEqual(copy, snapshot)
  })
})
