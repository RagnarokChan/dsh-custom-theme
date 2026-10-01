import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function fixture() {
  let api
  const changes=new Set()
  const writes=[]
  const tokens=[]
  let activeTokens=0
  let state={status:'ready',writable:true,value:{appearance:'original',decorations:false}}
  const attrs=new Map()
  const nodes=new Set()
  const doc={body:{setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},head:{append:n=>nodes.add(n)},createElement:()=>({setAttribute(){},remove(){nodes.delete(this)}})}
  const form={getSnapshot:()=>state,subscribe:fn=>{changes.add(fn);return()=>changes.delete(fn)},async set(k,v){writes.push([k,v]);state={...state,value:{...state.value,[k]:v}};for(const fn of changes)fn();return true}}
  const ctx={configForms:{get:id=>{assert.equal(id,'whale-girl-theme');return form}},theme:{overrideTokens(id,values){tokens.push([id,values]);activeTokens++;return()=>activeTokens--},setTheme(){throw Error('Must not change the native preference')},setFontSize(){throw Error('Must not change native typography')}}}
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{FileReader:class {readAsDataURL(file){this.result=file.data;this.onload()}},window:{__ModuleLoader__:{load:entry=>{api=entry.factory(()=>({}))}}}})
  const controller=api.createAppearanceController(ctx,doc,{'whale-girl-brand.png':'data:image/png;base64,AA'},'')
  return {api,controller,form,attrs,nodes,writes,tokens,changes,get activeTokens(){return activeTokens},update(value){state={...state,value};for(const fn of changes)fn()}}
}

const plain=value=>JSON.parse(JSON.stringify(value))
test('theme Save As writes through the standard file picker and closes the file',async()=>{
  const f=fixture(),events=[]
  const result=await f.api.saveThemePreset(f.controller.exportPreset(),async options=>{assert.equal(options.suggestedName,'dsh-custom-theme.json');return {createWritable:async()=>({write:async text=>events.push(JSON.parse(text).type),close:async()=>events.push('closed')})}})
  assert.equal(result.saved,true);assert.deepEqual(events,['dsh-custom-theme','closed']);f.controller.dispose()
})
test('unsupported file picker exposes a safe manual export; cancellation stays quiet',async()=>{
  const f=fixture(),preset=f.controller.exportPreset()
  assert.equal(JSON.parse((await f.api.saveThemePreset(preset)).fallback).type,'dsh-custom-theme')
  assert.equal((await f.api.saveThemePreset(preset,async()=>{throw Object.assign(Error(),{name:'SecurityError'})})).fallback,JSON.stringify(preset,null,2))
  assert.equal((await f.api.saveThemePreset(preset,async()=>{throw Object.assign(Error(),{name:'AbortError'})})).cancelled,true)
  let aborted=false;const result=await f.api.saveThemePreset(preset,async()=>({createWritable:async()=>({write:async()=>{throw Error('disk full')},abort:async()=>aborted=true})}));assert.equal(aborted,true);assert.ok(result.fallback);f.controller.dispose()
})
test('custom mode uses validated colors without mounting fish artwork by default',async()=>{
  const f=fixture();await f.controller.set('appearance','custom');assert.equal(f.activeTokens,1);assert.equal(f.attrs.has('data-wg-custom'),true)
  assert.equal(f.controller.getSnapshot().custom.artwork,false)
  await f.controller.setCustom({accent:'#FF0099',dark:'#090909'})
  assert.equal(f.activeTokens,1);assert.equal(f.tokens.at(-1)[1]['--dsw-alias-bg-base'].dark,'#090909')
  await f.controller.set('appearance','original');assert.equal(f.attrs.size,0);assert.equal(f.activeTokens,0);f.controller.dispose()
})
test('custom validation whitelists colors and drops unsafe / unknown values',()=>{
  const f=fixture();assert.deepEqual(plain(f.api.normalizeCustom({accent:'url(https://bad.test)',light:'#fff',dark:'#ABCDEF',artwork:'true',secret:'x'})),{accent:'#7c9cf5',light:'#f5f7fc',dark:'#abcdef',artwork:false});f.controller.dispose()
})
test('custom primary text remains readable against every tinted surface',()=>{
  const f=fixture()
  const light=color=>{const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722}
  for(const base of ['#000000','#ffffff','#808080','#123456','#ffff00','#00ff00','#ff00ff'])for(const accent of ['#000000','#ffffff','#7c9cf5','#ff0000']){
    const tokens=f.api.createCustomTokens({light:base,dark:base,accent})
    assert.equal(Object.keys(tokens).length,15)
    for(const mode of ['light','dark'])for(const [key,pair] of Object.entries(tokens)){
      assert.match(pair[mode],/^#[0-9a-f]{6}$/)
      if(key.includes('bg-')||key.includes('sidebar-')||key==='--dsw-specific-bubble'){
        const a=light(pair[mode]),b=light(tokens['--dsw-alias-label-primary'][mode]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,key)
      }
    }
  }
  f.controller.dispose()
})
test('rapid color edits merge without losing earlier fields; failed saves roll back',async()=>{
  const f=fixture();await Promise.all([f.controller.setCustom({accent:'#aa22bb'}),f.controller.setCustom({dark:'#020304'})])
  assert.equal(f.writes[1][1].accent,'#aa22bb');assert.equal(f.writes[1][1].dark,'#020304')
  f.form.set=async()=>false;await f.controller.setCustom({accent:'#ffffff'});assert.equal(f.controller.getSnapshot().custom.accent,'#aa22bb');f.controller.dispose()
})
test('queued color writes and preset imports cannot write after disposal',async()=>{
  const f=fixture();const pending=f.controller.setCustom({accent:'#aa22bb'});f.controller.dispose();await pending;assert.equal(f.writes.length,0);assert.equal(await f.controller.importPreset({}),false)
})
test('theme export includes only appearance settings, not user account or history',()=>{
  const f=fixture();const preset=f.api.exportThemePreset({...f.controller.getSnapshot(),account:'private',sessions:[1],apiKey:'secret',error:'private'})
  assert.deepEqual(Object.keys(preset).sort(),['appearance','background','custom','decorations','type','version']);assert.equal(preset.type,'dsh-custom-theme');assert.equal(preset.version,1);f.controller.dispose()
})
test('theme preset round-trip preserves embedded background and applies mode last',async()=>{
  const f=fixture();const preset={type:'dsh-custom-theme',version:1,appearance:'custom',decorations:false,custom:{accent:'#aa22bb',dark:'#040506',light:'#fefefe',artwork:false},background:{image:'data:image/png;base64,AAAA',name:'portable.png',fit:'contain',opacity:65}}
  const originalSet=f.form.set
  // No chat roots exist in this unit fixture; background remains inactive until original mode is restored.
  f.form.set=async(k,v)=>{if(k==='appearance')v='original';return originalSet(k,v)}
  assert.equal(await f.controller.importPreset({size:100,text:async()=>JSON.stringify(preset)}),true)
  assert.equal(f.writes.at(-1)[0],'appearance');assert.deepEqual(plain(f.controller.exportPreset().custom),preset.custom);assert.deepEqual(plain(f.controller.exportPreset().background),preset.background);f.controller.dispose()
})
test('invalid, remote-image and oversized preset files cause no writes',async()=>{
  const f=fixture();for(const value of [{type:'wrong',version:1},{type:'dsh-custom-theme',version:2},{type:'dsh-custom-theme',version:1,appearance:'evil'},{type:'dsh-custom-theme',version:1,appearance:'custom',background:{image:'https://bad.test/image.png'}}])assert.equal(await f.controller.importPreset({size:100,text:async()=>JSON.stringify(value)}),false)
  assert.equal(await f.controller.importPreset({size:50*1024*1024,text:async()=>{throw Error('Must not read')}}),false)
  assert.equal(await f.controller.importPreset({size:1,text:async()=>'{'}),false);assert.equal(f.writes.length,0);assert.equal(f.controller.getSnapshot().presetBusy,false);f.controller.dispose()
})
test('preset import reports partial failure instead of claiming success',async()=>{
  const f=fixture();const setter=f.form.set;f.form.set=(k,v)=>k==='custom'?Promise.resolve(false):setter(k,v)
  assert.equal(await f.controller.importPreset({size:100,text:async()=>JSON.stringify(f.controller.exportPreset())}),false)
  assert.match(f.controller.getSnapshot().error,/部分参数/);assert.equal(f.controller.getSnapshot().appearance,'original');f.controller.dispose()
})
test('concurrent preset imports are rejected while the first file is loading',async()=>{
  const f=fixture();let resolve;const promise=new Promise(r=>resolve=r)
  const first=f.controller.importPreset({size:100,text:()=>promise});assert.equal(await f.controller.importPreset({size:1,text:async()=>'{'}),false)
  resolve(JSON.stringify(f.controller.exportPreset()));assert.equal(await first,true);f.controller.dispose()
})

test('installation starts with original DSH and does not write native settings',()=>{
  const f=fixture(); assert.equal(f.activeTokens,0); assert.equal(f.nodes.size,0);assert.equal(f.writes.length,0); f.controller.dispose();assert.equal(f.changes.size,0)
})
test('turning theme off restores its token layer, style and body marker',async()=>{
  const f=fixture();await f.controller.set('appearance','whale-girl');assert.equal(f.activeTokens,1);assert.equal(f.nodes.size,1);assert.equal(f.attrs.has('data-whale-girl-theme'),true)
  await f.controller.set('appearance','original');assert.equal(f.activeTokens,0);assert.equal(f.nodes.size,0);assert.equal(f.attrs.size,0);assert.deepEqual(f.writes,[['appearance','whale-girl'],['appearance','original']]);f.controller.dispose()
})
test('external settings updates adopt the durable selection without writing it back',()=>{
  const f=fixture();f.update({appearance:'whale-girl',decorations:false});assert.equal(f.activeTokens,1);f.update({appearance:'original',decorations:false});assert.equal(f.activeTokens,0);assert.equal(f.writes.length,0);f.controller.dispose()
})
test('unloading an active plugin releases exactly its own theme layer',async()=>{
  const f=fixture();await f.controller.set('appearance','whale-girl');f.controller.dispose();assert.equal(f.activeTokens,0);assert.equal(f.nodes.size,0);assert.equal(f.changes.size,0)
})
test('every overridden color defines both light and dark palettes',async()=>{
  const f=fixture();await f.controller.set('appearance','whale-girl');for(const modes of Object.values(f.tokens[0][1])){assert.equal(typeof modes.light,'string');assert.equal(typeof modes.dark,'string')}f.controller.dispose()
})
test('failed persistence leaves the accepted original appearance active',async()=>{
  const f=fixture();f.form.set=async()=>false;await f.controller.set('appearance','whale-girl');assert.equal(f.activeTokens,0);assert.equal(f.controller.getSnapshot().appearance,'original');assert.match(f.controller.getSnapshot().error,/未保存/);f.controller.dispose()
})

test('custom background is one durable plugin field and does not enable itself in original mode',async()=>{
  const f=fixture();const background={image:'data:image/png;base64,AAAA',name:'portable.png',fit:'contain',opacity:60};await f.controller.set('background',background)
  assert.deepEqual(JSON.parse(JSON.stringify(f.controller.getSnapshot().background)),background);assert.equal(f.activeTokens,0);assert.equal(f.nodes.size,0);assert.deepEqual(f.writes,[['background',background]]);f.controller.dispose()
})
test('background validation rejects remote URLs, SVG and unsupported fits',()=>{
  const f=fixture();for(const image of ['https://example.com/x.png','file:///G:/image.png','data:image/svg+xml;base64,AAAA'])assert.equal(f.api.normalizeBackground({image}).image,'')
  const background=f.api.normalizeBackground({opacity:900,fit:'invalid'});assert.equal(background.opacity,100);assert.equal(background.fit,'cover');f.controller.dispose()
})
test('background import preserves uploaded bytes, is portable and keeps native preferences',async()=>{
  const f=fixture();const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);await f.controller.importBackground({size:12,name:'background.png',data:'data:application/octet-stream;base64,iVBORw0KGgo=',slice:()=>({arrayBuffer:async()=>bytes.buffer})})
  assert.equal(f.writes.length,1);assert.equal(f.writes[0][0],'background');assert.equal(f.writes[0][1].image,'data:image/png;base64,iVBORw0KGgo=');assert.equal(f.writes[0][1].name,'background.png');assert.equal(f.activeTokens,0);assert.equal(f.controller.getSnapshot().backgroundBusy,false);f.controller.dispose()
})
test('oversized background and unknown file types do not persist',async()=>{
  const f=fixture();await f.controller.importBackground({size:30*1024*1024+1});assert.match(f.controller.getSnapshot().error,/30 MB/)
  await f.controller.importBackground({size:1,slice:()=>({arrayBuffer:async()=>new Uint8Array([1]).buffer})});assert.match(f.controller.getSnapshot().error,/PNG/);assert.equal(f.writes.length,0);f.controller.dispose()
})
test('rapid background edits retain both fit and opacity in order',async()=>{
  const f=fixture();const first=f.controller.setBackground({fit:'contain'});const second=f.controller.setBackground({opacity:60});await Promise.all([first,second])
  assert.equal(f.writes.length,2);assert.equal(f.writes[0][1].fit,'contain');assert.equal(f.writes[1][1].fit,'contain');assert.equal(f.writes[1][1].opacity,60);assert.equal(f.controller.getSnapshot().background.fit,'contain');assert.equal(f.controller.getSnapshot().background.opacity,60);f.controller.dispose()
})
test('failed background save rolls controls back to durable values',async()=>{
  const f=fixture();f.form.set=async()=>false;await f.controller.setBackground({fit:'contain'});assert.equal(f.controller.getSnapshot().background.fit,'cover');assert.match(f.controller.getSnapshot().error,/未保存/);assert.equal(f.activeTokens,0);f.controller.dispose()
})
test('disposing before a queued background write prevents the write',async()=>{
  const f=fixture();const pending=f.controller.setBackground({opacity:50});f.controller.dispose();await pending;assert.equal(f.writes.length,0)
})

test('plugin options register only in an independent official settings section',()=>{
  const f=fixture();const calls=[];let removed=0
  const Component=()=>null
  const ctx={locale:{bind:ns=>{assert.equal(ns,'whale-girl-theme');return key=>{assert.equal(key,'nav');return '大肥鱼主题'}}},slots:{inject(name,register){calls.push(['inject',name]);const off=register();return ()=>off()},register(options,component){calls.push(['register',options.name]);assert.equal(options.id,'dsh-theme-whale-girl');assert.equal(options.order,80);assert.equal(options.locale,'whale-girl-theme');assert.equal(options.label(),'大肥鱼主题');assert.equal(component,Component);return ()=>removed++}}}
  const off=f.api.registerAppearanceSection(ctx,Component)
  assert.deepEqual(calls,[['inject','settings.section'],['register','settings.section']]);assert.equal(f.writes.length,0);off();assert.equal(removed,1);f.controller.dispose()
})

test('independent settings navigation resolves the current locale without altering saved appearance',()=>{
  const f=fixture();let language='zh';let options
  const ctx={locale:{bind:()=>()=>language==='zh'?'大肥鱼主题':'Big Fat Fish Theme'},slots:{inject:(_,register)=>register(),register:entry=>{options=entry;return ()=>{}}}}
  const off=f.api.registerAppearanceSection(ctx,()=>null)
  assert.equal(options.label(),'大肥鱼主题');language='en';assert.equal(options.label(),'Big Fat Fish Theme');assert.equal(f.controller.getSnapshot().appearance,'original');assert.equal(f.writes.length,0);off();f.controller.dispose()
})
