import assert from 'node:assert/strict'
import test from 'node:test'
import { paintMaskStroke } from '../src/maskEditor.ts'

function rgba(width: number, height: number, color: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < data.length; offset += 4) data.set(color, offset)
  return data
}

test('恢复画笔从原图取回 RGBA 像素', () => {
  const original = rgba(5, 5, [220, 120, 40, 255])
  const target = rgba(5, 5, [0, 0, 0, 0])
  paintMaskStroke(target, original, 5, 5, { x: 2.5, y: 2.5 }, { x: 2.5, y: 2.5 }, 1, 'restore')
  assert.deepEqual([...target.slice((2 * 5 + 2) * 4, (2 * 5 + 2) * 4 + 4)], [220, 120, 40, 255])
  assert.equal(target[3], 0)
})

test('擦除画笔只清除透明度', () => {
  const original = rgba(5, 5, [220, 120, 40, 255])
  const target = rgba(5, 5, [10, 20, 30, 255])
  paintMaskStroke(target, original, 5, 5, { x: 2.5, y: 2.5 }, { x: 2.5, y: 2.5 }, 1, 'erase')
  const offset = (2 * 5 + 2) * 4
  assert.deepEqual([...target.slice(offset, offset + 4)], [10, 20, 30, 0])
})

test('连续笔画会填满两个端点之间的路径', () => {
  const original = rgba(9, 3, [100, 110, 120, 255])
  const target = rgba(9, 3, [0, 0, 0, 0])
  paintMaskStroke(target, original, 9, 3, { x: 1.5, y: 1.5 }, { x: 7.5, y: 1.5 }, 0.8, 'restore')
  for (let x = 1; x <= 7; x += 1) assert.equal(target[(1 * 9 + x) * 4 + 3], 255)
})

test('像素数据尺寸不匹配时拒绝绘制', () => {
  assert.throws(
    () => paintMaskStroke(new Uint8ClampedArray(4), new Uint8ClampedArray(4), 2, 2, { x: 0, y: 0 }, { x: 1, y: 1 }, 1, 'erase'),
    /尺寸无效/,
  )
})
