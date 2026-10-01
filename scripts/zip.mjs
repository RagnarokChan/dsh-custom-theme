import {deflateRawSync} from 'node:zlib'
import {readFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'

function crc32(bytes) {
  let crc=0xffffffff
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  return (crc^0xffffffff)>>>0
}
// Small classic ZIP writer: no external tooling, UTF-8 names, deflate, fixed dates.
export function zipFolder(folder,prefix) {
  const local=[],central=[];let offset=0,count=0
  function visit(path,relative) {
    for(const item of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=relative+item.name
      if(item.isDirectory()){visit(join(path,item.name),name+'/');continue}
      if(!item.isFile())throw Error('Only regular release files are supported')
      const bytes=readFileSync(join(path,item.name)),compressed=deflateRawSync(bytes),filename=Buffer.from(name),checksum=crc32(bytes)
      if(bytes.length>0xffffffff||offset>0xffffffff||filename.length>65535)throw Error('Release exceeds classic ZIP limits')
      const header=Buffer.alloc(30)
      header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(8,8);header.writeUInt16LE(33,12)
      header.writeUInt32LE(checksum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26)
      const directory=Buffer.alloc(46)
      directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt16LE(0x800,8);directory.writeUInt16LE(8,10);directory.writeUInt16LE(33,14)
      directory.writeUInt32LE(checksum,16);directory.writeUInt32LE(compressed.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42)
      local.push(header,filename,compressed);central.push(directory,filename);offset+=header.length+filename.length+compressed.length;count++
    }
  }
  visit(folder,prefix+'/')
  if(count>65535)throw Error('Too many release files')
  const directory=Buffer.concat(central),end=Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16)
  return Buffer.concat([...local,directory,end])
}
