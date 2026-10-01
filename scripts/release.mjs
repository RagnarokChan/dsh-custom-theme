import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync,cpSync} from 'node:fs'
import {resolve,dirname,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {zipFolder} from './zip.mjs'

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
const expected=`${pkg.name}-${pkg.version}.tgz`
const input=resolve(process.argv[2]||resolve(root,expected))
if(basename(input)!==expected)throw Error(`Expected ${expected}`)
const folder=resolve(root,'release',`dsh-custom-theme-${pkg.version}`)
if(existsSync(folder)&&readdirSync(folder).length)throw Error('Release folder already exists; use a fresh version or archive it first.')
mkdirSync(folder,{recursive:true})
const bytes=readFileSync(input)
const sha256=createHash('sha256').update(bytes).digest('hex')
copyFileSync(input,resolve(folder,expected))
for(const file of ['install.ps1','README.md','ASSET_NOTICE.md','CHANGELOG.md','compatibility.json'])copyFileSync(resolve(root,file),resolve(folder,file))
cpSync(resolve(root,'docs'),resolve(folder,'docs'),{recursive:true})
writeFileSync(resolve(folder,'install.cmd'),readFileSync(resolve(root,'install.cmd'),'utf8').replaceAll('__THEME_PACKAGE__',expected).replaceAll('__THEME_SHA256__',sha256).replace(/\r?\n/g,'\r\n'))
writeFileSync(resolve(folder,'release-manifest.json'),JSON.stringify({version:pkg.version,package:expected,sha256,qualifiedDesktop:'0.2.0-rc.2'},null,2)+'\n')
writeFileSync(resolve(folder,'SHA256SUMS.txt'),`${sha256}  ${expected}\n`)
{
  const zip=resolve(root,'release',`dsh-custom-theme-${pkg.version}-windows.zip`)
  if(existsSync(zip))throw Error('Release ZIP already exists; refusing to overwrite.')
  writeFileSync(zip,zipFolder(folder,basename(folder)))
  console.log(zip)
}
console.log(`Release ${pkg.version}: ${sha256}`)
