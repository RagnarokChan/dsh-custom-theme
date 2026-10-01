import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {inflateRawSync} from 'node:zlib'
import {zipFolder} from '../scripts/zip.mjs'

test('portable ZIP writer preserves UTF-8 names, exact file bytes and central offsets',()=>{
  const folder=mkdtempSync(join(tmpdir(),'dsh-release-test-'))
  try {
    const content=Buffer.from('中英双语 · Theme\n')
    writeFileSync(join(folder,'说明.txt'),content)
    const zip=zipFolder(folder,'theme')
    assert.equal(zip.readUInt32LE(0),0x04034b50)
    const nameLength=zip.readUInt16LE(26),size=zip.readUInt32LE(18)
    assert.equal(zip.subarray(30,30+nameLength).toString(),'theme/说明.txt')
    assert.deepEqual(inflateRawSync(zip.subarray(30+nameLength,30+nameLength+size)),content)
    const central=30+nameLength+size;assert.equal(zip.readUInt32LE(central),0x02014b50);assert.equal(zip.readUInt32LE(central+42),0)
    const end=zip.length-22;assert.equal(zip.readUInt32LE(end),0x06054b50);assert.equal(zip.readUInt32LE(end+16),central)
  }finally {assert.ok(folder.startsWith(join(tmpdir(),'dsh-release-test-')));rmSync(folder,{recursive:true})}
})
test('installer template checks integrity, uses the official CLI and does not bypass security',()=>{
  const cmd=readFileSync(new URL('../install.cmd',import.meta.url),'utf8')
  assert.match(cmd,/certutil -hashfile/);assert.match(cmd,/resources\\runtime\\cli\\bin\\dsh.cmd/)
  assert.match(cmd,/tasklist/);assert.doesNotMatch(cmd,/ExecutionPolicy|Bypass|taskkill|app\.asar/i)
  const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');assert.match(readme,/## 中文/);assert.match(readme,/## English/)
})
