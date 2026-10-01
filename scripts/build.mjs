import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assets = {}
const inventory = []
const embedded = new Set(['whale-girl-brand.png','whale-girl-settings-frame-v1.png','whale-girl-settings-topper-v3.png','whale-girl-composer-frame-v2.png','whale-girl-composer-topper-v4.png','whale-girl-composer-whale-v1.png'])
for (const file of readdirSync(resolve(root, 'assets')).sort()) {
  const bytes = readFileSync(resolve(root, 'assets', file))
  inventory.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  if (embedded.has(file)) assets[file] = `data:image/png;base64,${bytes.toString('base64')}`
}
for (const required of embedded) {
  if (!assets[required]) throw new Error(`Missing required artwork: ${required}`)
}
mkdirSync(resolve(root, 'lib'), {recursive:true})
// Compose a nine-slice edge map, without changing any original raster pixels.
// Actual stroke axes in the 800x700 original: left 16, right 782, top 33, bottom 670.
// Keep corner crops fixed, replace the large lower-right whale with a mirrored
// lower-left corner, and use the existing isolated whale at its own small size.
const frameSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="800" height="700" viewBox="0 0 800 700"><defs><image id="art" width="800" height="700" href="${assets['whale-girl-settings-frame-v1.png']}"/><clipPath id="tl"><rect width="64" height="64"/></clipPath><clipPath id="tr"><rect x="736" width="64" height="64"/></clipPath><clipPath id="bl"><rect y="636" width="64" height="64"/></clipPath><clipPath id="left"><rect y="64" width="64" height="572"/></clipPath><clipPath id="top"><rect x="64" y="29" width="672" height="11"/></clipPath></defs><use xlink:href="#art" clip-path="url(#tl)"/><use xlink:href="#art" clip-path="url(#tr)"/><use xlink:href="#art" clip-path="url(#bl)"/><use xlink:href="#art" clip-path="url(#left)"/><use xlink:href="#art" clip-path="url(#top)"/><g transform="translate(798 0) scale(-1 1)"><use xlink:href="#art" clip-path="url(#bl)"/></g><svg x="736" y="64" width="64" height="572" viewBox="736 64 64 430" preserveAspectRatio="none"><use xlink:href="#art"/></svg><svg x="64" y="636" width="672" height="64" viewBox="64 636 320 64" preserveAspectRatio="none"><use xlink:href="#art"/></svg></svg>`
assets['settings-edge-map.svg'] = `data:image/svg+xml;base64,${Buffer.from(frameSvg).toString('base64')}`
writeFileSync(resolve(root,'lib/settings-edge-map.svg'),frameSvg)
writeFileSync(resolve(root, 'lib/index.js'), readFileSync(resolve(root, 'src/index.js')))
const source = readFileSync(resolve(root, 'src/client.cjs'), 'utf8')
const css = readFileSync(resolve(root, 'src/theme.css'), 'utf8')
writeFileSync(resolve(root, 'lib/client.js'), `window.__ModuleLoader__.load({id:'dsh-theme-whale-girl',factory:(require)=>{const exports={};const ART=${JSON.stringify(assets)};const CSS=${JSON.stringify(css)};${source}\nreturn exports;}});\n`)
writeFileSync(resolve(root, 'lib/assets.json'), JSON.stringify(inventory, null, 2)+'\n')
console.log(`Built self-contained theme: ${inventory.length} original assets; no external asset paths.`)
