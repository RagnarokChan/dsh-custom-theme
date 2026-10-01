import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
test('all preserved assets match the packaged inventory',()=>{
  const inventory=JSON.parse(readFileSync(new URL('../lib/assets.json',import.meta.url)))
  assert.ok(inventory.length>=16)
  for(const asset of inventory){const bytes=readFileSync(new URL('../assets/'+asset.file,import.meta.url));assert.equal(bytes.length,asset.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256)}
})
test('runtime artwork is self-contained and contains no former shell file paths',()=>{
  const bundle=readFileSync(new URL('../lib/client.js',import.meta.url),'utf8')
  assert.match(bundle,/data:image\/png;base64,/)
  assert.doesNotMatch(bundle,/G:\\|file:\/\/|ipcRenderer|require\(['"]electron/)
})
