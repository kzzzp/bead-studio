import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getBuiltInPalette, parseCustomPalette, removeDisabledColors } from '../src/paletteRegistry.ts'

describe('built-in palettes', () => {
  it('ships the licensed Perler and Hama reference palettes', () => {
    assert.equal(getBuiltInPalette('perler').colors.length, 103)
    assert.equal(getBuiltInPalette('hama').colors.length, 92)
  })
})

describe('custom palette import', () => {
  it('parses JSON colors and computes matching data', () => {
    const palette = parseCustomPalette(JSON.stringify([
      { code: 'X1', name: '红', hex: '#ff0000' },
      { code: 'X2', name: '绿', hex: '#00FF00' },
    ]), 'json')

    assert.equal(palette.length, 2)
    assert.deepEqual(palette[0].rgb, [255, 0, 0])
    assert.equal(palette[0].hex, '#FF0000')
    assert.equal(palette[0].family, '自定义')
  })

  it('parses code/name/r/g/b CSV rows', () => {
    const palette = parseCustomPalette('C01,Coral,250,90,115\nC02,Black,0,0,0', 'csv')

    assert.equal(palette[0].code, 'C01')
    assert.equal(palette[0].name, 'Coral')
    assert.equal(palette[0].hex, '#FA5A73')
  })

  it('rejects duplicate codes and malformed colors', () => {
    assert.throws(() => parseCustomPalette('[{"code":"A","hex":"#fff"}]', 'json'), /颜色值/)
    assert.throws(() => parseCustomPalette('A,One,1,2,3\nA,Two,4,5,6', 'csv'), /重复色号/)
  })

  it('removes unavailable colors without mutating the palette', () => {
    const palette = parseCustomPalette('A,One,1,2,3\nB,Two,4,5,6', 'csv')
    const filtered = removeDisabledColors(palette, new Set(['A']))

    assert.deepEqual(filtered.map((color) => color.code), ['B'])
    assert.equal(palette.length, 2)
  })
})
