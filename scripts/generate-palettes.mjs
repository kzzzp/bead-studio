import { writeFile } from 'node:fs/promises'

const REVISION = '29229889daab404fb30531d4bb785fd73f7f58e3'
const SOURCE = `https://raw.githubusercontent.com/maxcleme/beadcolors/${REVISION}/raw`

const familyFromName = (name) => {
  const value = name.toLowerCase()
  if (/black|white|grey|gray|silver|clear/.test(value)) return '黑白灰'
  if (/blue|turquoise|aqua|cyan|teal/.test(value)) return '蓝青'
  if (/green|lime|kiwi|evergreen|shamrock/.test(value)) return '绿色'
  if (/yellow|orange|gold|cheddar/.test(value)) return '黄橙'
  if (/purple|violet|lavender|plum/.test(value)) return '紫色'
  if (/pink|rose|magenta|raspberry/.test(value)) return '粉色'
  if (/red|coral/.test(value)) return '红色'
  if (/brown|tan|beige|cream|sand|butterscotch/.test(value)) return '肤棕'
  return '其他'
}

const readPalette = async (file) => {
  const response = await fetch(`${SOURCE}/${file}.csv`)
  if (!response.ok) throw new Error(`Unable to fetch ${file}: ${response.status}`)
  return (await response.text()).trim().split(/\r?\n/).map((line) => {
    const [code, name, red, green, blue] = line.split(',')
    const hex = `#${[red, green, blue].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
    return [code, name, hex, familyFromName(name)]
  })
}

const perler = await readPalette('perler')
const hama = await readPalette('hama')
const serialize = (value) => JSON.stringify(value, null, 2)
const output = `// Generated from maxcleme/beadcolors at ${REVISION}.
// Source data and generator are MIT licensed; see docs/THIRD_PARTY_NOTICES.md.
import { createBeadColor } from './palette.ts'

const PERLER_RAW: Array<[string, string, string, string]> = ${serialize(perler)}
const HAMA_RAW: Array<[string, string, string, string]> = ${serialize(hama)}

export const PERLER_PALETTE = PERLER_RAW.map(([code, name, hex, family]) => createBeadColor(code, hex, family, name))
export const HAMA_PALETTE = HAMA_RAW.map(([code, name, hex, family]) => createBeadColor(code, hex, family, name))
`

await writeFile(new URL('../src/externalPalettes.generated.ts', import.meta.url), output, 'utf8')
