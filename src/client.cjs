const React = require('react')
const ID = 'dsh-theme-whale-girl'
const NS = 'whale-girl-theme'
const OWNER = 'data-whale-girl-owned'

const TOKENS = {
  '--dsw-alias-bg-base': {light:'#e9f2ff', dark:'#0b1429'},
  '--dsw-alias-bg-layer-1': {light:'#f8fbff', dark:'#101b34'},
  '--dsw-alias-bg-layer-2': {light:'#f2f7ff', dark:'#131f3b'},
  '--dsw-alias-bg-overlay': {light:'#f5f8ff', dark:'#172746'},
  '--dsw-alias-bg-module-platform': {light:'#d1def8', dark:'#365087'},
  '--dsw-alias-label-primary': {light:'#1d2c55', dark:'#f1f4fd'},
  '--dsw-alias-label-secondary': {light:'#52658f', dark:'#c1cfec'},
  '--dsw-alias-label-tertiary': {light:'#7182a7', dark:'#8fa2cb'},
  '--dsw-alias-border-l2': {light:'rgba(63,91,156,.22)', dark:'rgba(127,152,215,.25)'},
  '--dsw-alias-interactive-bg-hover': {light:'rgba(93,121,198,.1)', dark:'rgba(127,152,215,.12)'},
  '--dsw-alias-interactive-bg-hover-solid': {light:'#dce8fb', dark:'#21365f'},
  '--dsw-specific-sidebar-fill': {light:'#eaf2ff', dark:'#0b1429'},
  '--dsw-specific-bubble': {light:'#d7e5ff', dark:'#203967'},
  '--dsw-specific-sidebar-nav-item-active': {light:'#cfddf6', dark:'#263f70'},
  '--dsw-specific-sidebar-nav-item-hover': {light:'rgba(93,121,198,.1)', dark:'rgba(127,152,215,.12)'},
}

function mountDecorations(doc, notify) {
  const saved = new Map()
  const owned = new Set()
  let disposed = false
  let pending = false
  let signature = ''
  function tag(el, attr, value='') {
    if (!saved.has(el)) saved.set(el, new Map())
    const attrs = saved.get(el)
    if (!attrs.has(attr)) attrs.set(attr, el.getAttribute(attr))
    if (el.getAttribute(attr) !== value) el.setAttribute(attr, value)
  }
  function add(parent, role) {
    let el = parent.querySelector(`:scope > [${OWNER}="${role}"]`)
    if (!el) {
      el = doc.createElement('div')
      el.setAttribute(OWNER, role)
      el.setAttribute('aria-hidden', 'true')
      parent.append(el)
      owned.add(el)
    }
    return el
  }
  function scan() {
    pending = false
    if (disposed) return
    // Prefer native data contracts; no hashed class names or global tag matching.
    const cards = [...doc.querySelectorAll('[data-composer-card]')].filter(el =>
      el.querySelector('[data-composer-input],textarea,[contenteditable="true"]'))
    for (const card of cards) {
      tag(card, 'data-wg-composer')
      add(card, 'composer-rim')
      add(card, 'composer-topper')
    }
    const settings = [...doc.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(el =>
      el.querySelector(':scope > nav') && el.querySelector('[data-slot="settings.section"]'))
    for (const panel of settings) {
      const nav = panel.querySelector(':scope > nav')
      const content = nav.nextElementSibling
      const section = panel.querySelector('[data-slot="settings.section"]')
      const options = section?.closest('[class$="_options"]')
      // A partial match never receives layout overrides.
      if (!content || !options || !content.contains(options)) continue
      tag(panel,'data-wg-settings')
      tag(nav,'data-wg-nav')
      tag(content,'data-wg-content')
      tag(options,'data-wg-options')
      add(panel,'settings-frame')
      add(panel,'settings-topper')
      add(panel,'settings-whale')
    }
    for (const brand of doc.querySelectorAll('[class$="_brandIdentity"]')) tag(brand,'data-wg-brand')
    for (const hero of doc.querySelectorAll('[class$="_fishHitbox"]')) tag(hero,'data-wg-hero')
    for (const el of saved.keys()) if (!el.isConnected) saved.delete(el)
    for (const el of owned) if (!el.isConnected) owned.delete(el)
    const next = `${cards.length}:${doc.querySelectorAll('[data-wg-settings]').length}`
    if (next !== signature) { signature=next; notify({composer:cards.length,settings:doc.querySelectorAll('[data-wg-settings]').length}) }
  }
  const observer = new MutationObserver(() => {
    if (!pending && !disposed) { pending=true; queueMicrotask(scan) }
  })
  observer.observe(doc.body, {subtree:true,childList:true})
  scan()
  return () => {
    disposed=true
    observer.disconnect()
    for (const node of owned) node.remove()
    for (const [el, attrs] of saved) for (const [attr, value] of attrs) {
      if (value === null) el.removeAttribute(attr); else el.setAttribute(attr,value)
    }
    // No native styles are changed by this adapter.
  }
}

const BACKGROUND_LIMIT = 30 * 1024 * 1024
const CUSTOM_DEFAULTS = {accent:'#7c9cf5',light:'#f5f7fc',dark:'#101828',artwork:false}
function normalizeCustom(value) {
  const color=(key)=>typeof value?.[key]==='string'&&/^#[0-9a-fA-F]{6}$/.test(value[key])?value[key].toLowerCase():CUSTOM_DEFAULTS[key]
  return {accent:color('accent'),light:color('light'),dark:color('dark'),artwork:value?.artwork===true}
}
function mixColor(a,b,weight) {
  const bytes=color=>[1,3,5].map(start=>parseInt(color.slice(start,start+2),16))
  const left=bytes(a),right=bytes(b)
  return '#'+left.map((value,index)=>Math.round(value+(right[index]-value)*weight).toString(16).padStart(2,'0')).join('')
}
function luminance(color) {
  const channels=[1,3,5].map(start=>parseInt(color.slice(start,start+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
}
function createCustomTokens(value) {
  const custom=normalizeCustom(value),tokens={}
  for(const mode of ['light','dark']) {
    const base=custom[mode],ink=luminance(base)>.179?'#152033':'#f8faff'
    const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    // Keep readable text, even when a user chooses a very bright/dark surface.
    const foreground=contrast(base,ink)>=4.5?ink:(luminance(base)>.179?'#000000':'#ffffff')
    const tint=(weight)=>{let result=mixColor(base,custom.accent,weight);while(contrast(result,foreground)<4.5&&weight>.005){weight/=2;result=mixColor(base,custom.accent,weight)}return result}
    const palette={
      '--dsw-alias-bg-base':base,'--dsw-alias-bg-layer-1':tint(.08),'--dsw-alias-bg-layer-2':tint(.12),
      '--dsw-alias-bg-overlay':tint(.16),'--dsw-alias-bg-module-platform':tint(.3),
      '--dsw-alias-label-primary':foreground,'--dsw-alias-label-secondary':mixColor(foreground,base,.14),'--dsw-alias-label-tertiary':mixColor(foreground,base,.26),
      '--dsw-alias-border-l2':mixColor(base,foreground,.22),'--dsw-alias-interactive-bg-hover':tint(.12),'--dsw-alias-interactive-bg-hover-solid':tint(.2),
      '--dsw-specific-sidebar-fill':base,'--dsw-specific-bubble':tint(.24),'--dsw-specific-sidebar-nav-item-active':tint(.3),'--dsw-specific-sidebar-nav-item-hover':tint(.14),
    }
    for(const [token,color] of Object.entries(palette)){tokens[token]??={};tokens[token][mode]=color}
  }
  return tokens
}
function parseThemePreset(value) {
  if(!value||value.type!=='dsh-custom-theme'||value.version!==1)throw Error('不支持的主题文件 / Unsupported theme file')
  if(!['original','whale-girl','custom'].includes(value.appearance))throw Error('主题模式无效 / Invalid theme mode')
  const background=normalizeBackground(value.background)
  if(value.background?.image&&!background.image)throw Error('主题包含不支持的图片 / Unsupported background image')
  return {appearance:value.appearance,decorations:value.decorations!==false,custom:normalizeCustom(value.custom),background}
}
function exportThemePreset(snapshot) {
  return {type:'dsh-custom-theme',version:1,appearance:snapshot.appearance,decorations:snapshot.decorations,custom:normalizeCustom(snapshot.custom),background:normalizeBackground(snapshot.background)}
}
async function saveThemePreset(preset,picker) {
  const text=JSON.stringify(preset,null,2)
  if(typeof picker!=='function')return {fallback:text}
  let writable
  try {
    const file=await picker({suggestedName:'dsh-custom-theme.json',types:[{description:'DSH Theme JSON',accept:{'application/json':['.json']}}]})
    writable=await file.createWritable()
    await writable.write(text);await writable.close()
    return {saved:true}
  }catch(error){
    if(writable)try{await writable.abort()}catch{}
    if(error.name==='AbortError')return {cancelled:true}
    return {fallback:text}
  }
}
function normalizeBackground(value) {
  const image=typeof value?.image==='string' && value.image.length<=BACKGROUND_LIMIT*4/3+100 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image) ? value.image : ''
  return {image,name:typeof value?.name==='string'?value.name.slice(0,256):'',fit:value?.fit==='contain'?'contain':'cover',opacity:Number.isFinite(value?.opacity)?Math.max(0,Math.min(100,value.opacity)):100}
}

function mountBackground(doc, background) {
  const saved=new Map(), owned=new Set()
  let disposed=false
  function scan() {
    if (disposed) return
    for (const root of doc.querySelectorAll('[data-phase][class$="_root"]')) {
      if (!root.querySelector('[data-composer-card]') || saved.has(root)) continue
      saved.set(root,root.getAttribute('data-wg-background'))
      root.setAttribute('data-wg-background','')
      const layer=doc.createElement('div')
      layer.setAttribute(OWNER,'background')
      layer.setAttribute('aria-hidden','true')
      layer.style.backgroundImage=`url(${JSON.stringify(background.image)})`
      layer.style.backgroundSize=background.fit
      layer.style.opacity=String(background.opacity/100)
      root.prepend(layer)
      owned.add(layer)
    }
    for (const root of saved.keys()) if (!root.isConnected) saved.delete(root)
    for (const node of owned) if (!node.isConnected) owned.delete(node)
  }
  const observer=new MutationObserver(scan)
  observer.observe(doc.body,{subtree:true,childList:true})
  scan()
  return ()=>{disposed=true;observer.disconnect();for(const layer of owned)layer.remove();for(const [root,value] of saved){if(value===null)root.removeAttribute('data-wg-background');else root.setAttribute('data-wg-background',value)}}
}

function createAppearanceController(ctx, doc, assets, css) {
  const listeners = new Set()
  const form = ctx.configForms.get(NS)
  let tokenOff
  let tokenKey=''
  let decorationOff
  let backgroundOff
  let backgroundKey=''
  let importTicket=0
  let backgroundQueue=Promise.resolve()
  let backgroundPending=0
  let desiredBackground=normalizeBackground()
  let customQueue=Promise.resolve()
  let customPending=0
  let desiredCustom=normalizeCustom()
  let style
  let disposed=false
  let enabled=false
  let snapshot={appearance:'original',decorations:true,custom:normalizeCustom(),background:normalizeBackground(),backgroundBusy:false,presetBusy:false,status:'loading',writable:false,composer:0,settings:0,error:null}
  const publish = next => {
    if (disposed) return
    snapshot={...snapshot,...next}
    for (const listener of listeners) listener()
  }
  function stop() {
    decorationOff?.(); decorationOff=undefined
    backgroundOff?.(); backgroundOff=undefined; backgroundKey=''
    style?.remove(); style=undefined
    doc.body.removeAttribute('data-whale-girl-theme')
    doc.body.removeAttribute('data-wg-custom')
    enabled=false
    tokenKey=''
    const off=tokenOff; tokenOff=undefined; off?.()
  }
  function sync() {
    if (disposed) return
    const state=form.getSnapshot()
    const appearance=['whale-girl','custom'].includes(state.value?.appearance)?state.value.appearance:'original'
    const decorations=state.value?.decorations !== false
    const custom=normalizeCustom(state.value?.custom)
    const background=normalizeBackground(state.value?.background)
    if(!backgroundPending)desiredBackground=background
    if(!customPending)desiredCustom=custom
    publish({appearance,decorations,custom:customPending?desiredCustom:custom,background:backgroundPending?desiredBackground:background,status:state.status,writable:state.writable})
    if (appearance === 'original') { stop(); return }
    const tokens=appearance==='custom'?createCustomTokens(custom):TOKENS
    const nextTokenKey=JSON.stringify(tokens)
    if (typeof ctx.theme.overrideTokens !== 'function') { stop();publish({error:'此版本缺少主题覆盖接口，已保留原版外观。 / Theme API unavailable; original appearance retained.'}); return }
    if(nextTokenKey!==tokenKey){tokenOff?.();tokenOff=ctx.theme.overrideTokens(ID,tokens);tokenKey=nextTokenKey}
    if (!enabled) {
      enabled=true
      style=doc.createElement('style')
      style.setAttribute(OWNER,'style')
      const variables=Object.entries({brand:'whale-girl-brand.png',settings:'settings-edge-map.svg',settingsTopper:'whale-girl-settings-topper-v3.png',composer:'whale-girl-composer-frame-v2.png',topper:'whale-girl-composer-topper-v4.png',whale:'whale-girl-composer-whale-v1.png'}).map(([key,file])=>`--wg-${key}-image:url(${JSON.stringify(assets[file])});`).join('')
      style.textContent=`body[data-whale-girl-theme]{${variables}}\n${css}`
      doc.head.append(style)
      doc.body.setAttribute('data-whale-girl-theme','')
    }
    if(appearance==='custom')doc.body.setAttribute('data-wg-custom','');else doc.body.removeAttribute('data-wg-custom')
    const showArtwork=appearance==='custom'?custom.artwork:decorations
    if (showArtwork && !decorationOff) decorationOff=mountDecorations(doc,publish)
    if (!showArtwork && decorationOff) { decorationOff(); decorationOff=undefined; publish({composer:0,settings:0}) }
    const key=background.image?JSON.stringify(background):''
    if(key!==backgroundKey){backgroundOff?.();backgroundOff=undefined;backgroundKey=key;if(key)backgroundOff=mountBackground(doc,background)}
  }
  const unsubscribe=form.subscribe(sync)
  sync()
  async function save(field,value) {
    if(disposed)return false
    publish({error:null})
    try {const accepted=await form.set(field,value);if(!accepted)publish({error:'设置未保存；仍使用已保存的外观。'});return accepted}
    catch {publish({error:'设置保存失败，请重试。'});return false}
  }
  function saveBackground(patch) {
    if(disposed)return Promise.resolve(false)
    const next=normalizeBackground({...desiredBackground,...patch})
    desiredBackground=next
    backgroundPending++
    publish({background:next})
    // Queue one atomic background object per edit, merging against the latest
    // intended values rather than an older React render's accepted snapshot.
    const job=backgroundQueue.then(()=>disposed?false:save('background',next))
    backgroundQueue=job.catch(()=>false)
    return job.finally(()=>{
      backgroundPending--
      if(!backgroundPending&&!disposed){desiredBackground=normalizeBackground(form.getSnapshot().value?.background);publish({background:desiredBackground})}
    })
  }
  function saveCustom(patch) {
    if(disposed)return Promise.resolve(false)
    const next=normalizeCustom({...desiredCustom,...patch})
    desiredCustom=next;customPending++;publish({custom:next})
    const job=customQueue.then(()=>disposed?false:save('custom',next))
    customQueue=job.catch(()=>false)
    return job.finally(()=>{customPending--;if(!customPending&&!disposed){desiredCustom=normalizeCustom(form.getSnapshot().value?.custom);publish({custom:desiredCustom})}})
  }
  return {
    getSnapshot:()=>snapshot,
    subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},
    set:save,
    setBackground:saveBackground,
    setCustom:saveCustom,
    exportPreset:()=>exportThemePreset(snapshot),
    async importPreset(file) {
      if(!file||disposed||snapshot.presetBusy)return false
      importTicket++
      publish({backgroundBusy:false})
      publish({error:null,presetBusy:true})
      let changed=false
      try {
        if(file.size>BACKGROUND_LIMIT*4/3+8192)throw Error('主题文件太大 / Theme file is too large')
        const preset=parseThemePreset(JSON.parse(await file.text()))
        await Promise.all([backgroundQueue,customQueue])
        if(disposed)return false
        for(const [field,value] of Object.entries(preset).sort(([a],[b])=>a==='appearance'?1:b==='appearance'?-1:0)) {
          if(!await save(field,value))throw Error(changed?'导入未完成，部分参数已保存 / Import incomplete; some settings were saved':'主题未保存 / Theme was not saved')
          changed=true
        }
        return true
      }catch(error){publish({error:error.message||'主题导入失败 / Theme import failed'});return false}
      finally{publish({presetBusy:false})}
    },
    async importBackground(file) {
      if (!file) return
      const ticket=++importTicket
      publish({error:null,backgroundBusy:true})
      try {
        if(file.size>BACKGROUND_LIMIT)throw Error('背景图不能超过 30 MB。')
        const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer())
        const ascii=(start,end)=>String.fromCharCode(...bytes.slice(start,end))
        const mime=bytes[0]===137&&ascii(1,4)==='PNG'?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':ascii(0,6)==='GIF87a'||ascii(0,6)==='GIF89a'?'image/gif':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP'?'image/webp':null
        if(!mime)throw Error('请选择 PNG、JPG、WEBP 或 GIF 图片。')
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败。'));reader.readAsDataURL(file)})
        if(disposed||ticket!==importTicket)return
        const image=`data:${mime};base64,${String(data).slice(String(data).indexOf(',')+1)}`
        if(!await saveBackground({image,name:file.name}))publish({error:'背景图未保存，请重试。'})
      } catch(error) {if(ticket===importTicket)publish({error:error.message||'背景图保存失败。'})}
      finally {if(ticket===importTicket)publish({backgroundBusy:false})}
    },
    dispose() { disposed=true; importTicket++; unsubscribe(); stop(); listeners.clear() },
  }
}

function registerAppearanceSection(ctx, Component) {
  const t=ctx.locale.bind(NS)
  return ctx.slots.inject('settings.section',()=>ctx.slots.register({
    name:'settings.section',id:ID,order:80,label:()=>t('nav'),locale:NS,
  },Component))
}

exports.inject=['theme','slots','configForms','locale']
exports.apply=function apply(ctx) {
  ctx.effect(() => {
    const controller=createAppearanceController(ctx,document,ART,CSS)
    const h=React.createElement
    function AppearanceSection() {
      const state=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
      const [exportText,setExportText]=React.useState('')
      const [exportStatus,setExportStatus]=React.useState('')
      const [exportBusy,setExportBusy]=React.useState(false)
      const zh=!(document.documentElement.lang||'zh').startsWith('en')
      const locked=!state.writable||state.presetBusy
      const buttonStyle={font:'inherit',color:'var(--dsw-alias-label-primary)',background:'var(--dsw-alias-bg-module-platform)',border:'1px solid var(--dsw-alias-border-l2)',borderRadius:8,padding:'8px 12px',cursor:'pointer'}
      async function downloadPreset() {
        setExportBusy(true);setExportText('');setExportStatus('')
        try {
          const result=await saveThemePreset(controller.exportPreset(),window.showSaveFilePicker?.bind(window))
          if(result.saved)setExportStatus(zh?'主题文件已保存。':'Theme file saved.')
          if(result.fallback){setExportText(result.fallback);setExportStatus(zh?'此桌面不支持直接另存为。可复制下方内容，保存为 .json 文件。':'Direct Save As is unavailable. Copy the text below and save it as a .json file.')}
        }finally{setExportBusy(false)}
      }
      return h('section',{'data-whale-girl-controls':'',style:{padding:'16px 0'}},
        h('h2',{style:{fontSize:18,lineHeight:'26px',margin:'0 0 8px'}},zh?'自定义主题':'Custom Themes'),
        h('p',{style:{margin:'0 0 16px',fontSize:13,color:'var(--dsw-alias-label-secondary)'}},zh?'选一个主题即可使用；调整自动保存。随时切回原版，不改动聊天记录或 DSH 通用设置。':'Choose a theme to begin. Changes save automatically. Return to Original anytime; chat history and DSH general settings stay intact.'),
        h('div',{style:{display:'flex',flexWrap:'wrap',gap:8}},['original','whale-girl','custom'].map(value=>h('button',{
          key:value,type:'button','data-whale-girl-choice':value,'aria-pressed':state.appearance===value,
          disabled:locked,onClick:()=>controller.set('appearance',value),
          style:{...buttonStyle,flex:'1 1 120px',borderRadius:12,padding:14,background:state.appearance===value?'var(--dsw-alias-interactive-bg-hover-solid)':'transparent'},
        },value==='original'?(zh?'原版 DSH':'Original DSH'):value==='custom'?(zh?'自定义':'Custom'):(zh?'大肥鱼主题':'Big Fat Fish Theme'),
        h('span',{style:{display:'block',fontSize:11,marginTop:6,opacity:.8}},value==='original'?(zh?'不使用插件外观':'No theme overrides'):value==='custom'?(zh?'你的颜色与背景':'Your colors and background'):(zh?'内置素材 · 开箱即用':'Built-in artwork · Ready to use'))))),
        state.appearance==='whale-girl'?h('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:12,fontSize:13}},h('input',{type:'checkbox','data-custom-theme-artwork':'',checked:state.decorations,disabled:locked,onChange:e=>controller.set('decorations',e.target.checked)}),zh?'显示大肥鱼边框与角色装饰':'Show Big Fat Fish frames and artwork'):null,
        state.appearance==='custom'?h('div',{'data-custom-theme-palette':'',style:{marginTop:16}},
          h('h3',{style:{fontSize:14,margin:'0 0 12px'}},zh?'配色（即时预览）':'Colors (live preview)'),
          ...[['accent',zh?'强调色':'Accent'],['light',zh?'浅色模式背景':'Light surface'],['dark',zh?'深色模式背景':'Dark surface']].map(([key,label])=>h('label',{key,style:{display:'flex',alignItems:'center',gap:12,marginBottom:10}},h('input',{type:'color',value:state.custom[key],disabled:locked,'data-custom-theme-color':key,'aria-label':label,onChange:e=>controller.setCustom({[key]:e.target.value}),style:{width:48,height:32,border:0,padding:0,background:'transparent',cursor:'pointer'}}),h('span',{},label),h('code',{style:{fontSize:12,marginLeft:'auto'}},state.custom[key]))),
          h('button',{type:'button',style:buttonStyle,disabled:locked,'data-custom-theme-reset':'',onClick:()=>controller.setCustom(CUSTOM_DEFAULTS)},zh?'重置配色和装饰':'Reset colors and artwork'),
          h('label',{style:{display:'flex',alignItems:'center',gap:8,marginTop:12,fontSize:13}},h('input',{type:'checkbox','data-custom-theme-artwork':'',checked:state.custom.artwork,disabled:locked,onChange:e=>controller.setCustom({artwork:e.target.checked})}),zh?'搭配大肥鱼边框与角色装饰':'Include Big Fat Fish frames and artwork'),
          h('p',{style:{fontSize:12,opacity:.8}},zh?'文字颜色自动适配背景。浅色／深色的切换仍由 DSH 管理。':'Text adapts to the surface color. Light/dark switching is still managed by DSH.')):null,
        state.appearance==='original'?h('p',{style:{fontSize:13,marginTop:16}},zh?'原版外观已恢复；你的主题参数仍然保留。选择“大肥鱼主题”或“自定义”后即可调整背景。':'Original appearance restored; your theme settings are retained. Choose Big Fat Fish or Custom to adjust the background.'):null,
        state.appearance!=='original'?h('details',{'data-whale-girl-background-controls':'',style:{marginTop:12}},
          h('summary',{style:{cursor:'pointer',padding:'8px 0'}},zh?'自定义聊天背景':'Custom chat background'),
          h('p',{style:{fontSize:12}},state.background.name||(zh?'尚未选择聊天背景':'No image selected')),
          state.background.image?h('img',{src:state.background.image,alt:zh?'聊天背景预览':'Background preview',style:{width:'100%',height:100,objectFit:'contain',borderRadius:8}}):null,
          h('label',{style:{display:'block',fontSize:13}},zh?'选择图片（PNG／JPG／WEBP／GIF，最大 30 MB）':'Choose image (PNG/JPG/WEBP/GIF, max 30 MB)',
            h('input',{type:'file',accept:'image/png,image/jpeg,image/webp,image/gif','data-whale-girl-background-file':'',disabled:locked||state.backgroundBusy,onChange:e=>{controller.importBackground(e.target.files?.[0]);e.target.value=''},style:{display:'block',maxWidth:'100%',marginTop:8}})),
          h('button',{type:'button',disabled:locked||!state.background.image||state.backgroundBusy,onClick:()=>controller.setBackground({image:'',name:''}),style:{...buttonStyle,marginTop:10}},zh?'清除背景':'Clear background'),
          h('label',{style:{display:'block',marginTop:12}},zh?'图片适配 ':'Image fit ',h('select',{value:state.background.fit,disabled:locked,onChange:e=>controller.setBackground({fit:e.target.value})},h('option',{value:'cover'},zh?'铺满':'Cover'),h('option',{value:'contain'},zh?'完整显示':'Contain'))),
          h('label',{style:{display:'block',marginTop:12}},zh?`背景不透明度 ${state.background.opacity}%`:`Background opacity ${state.background.opacity}%`,h('input',{type:'range',min:0,max:100,value:state.background.opacity,disabled:locked,onChange:e=>controller.setBackground({opacity:Number(e.target.value)}),style:{display:'block',width:'100%'}})),
          h('p',{style:{fontSize:12}},zh?'背景图片保存在此插件的 DSH 配置中，不依赖原图片路径。切回原版会隐藏背景，图片设置仍保留。':'The image is saved with this plugin, independent of its original path. Original DSH hides it without deleting your selection.'),
          state.backgroundBusy?h('p',{role:'status'},zh?'正在保存背景…':'Saving background…'):null):null,
        h('details',{'data-custom-theme-portability':'',style:{marginTop:16}},
          h('summary',{style:{cursor:'pointer',padding:'8px 0'}},zh?'备份／分享主题':'Back up / share a theme'),
          h('p',{style:{fontSize:12}},zh?'导出包含配色、装饰开关和背景图片，不包含聊天、账号或密钥。分享前请确认背景不含隐私。导入会替换当前主题参数。':'Export includes colors, artwork switches and the background image, never chats, accounts or keys. Check your image for private information before sharing. Import replaces current theme settings.'),
          h('button',{type:'button',style:buttonStyle,'data-custom-theme-export':'',disabled:locked||state.backgroundBusy||exportBusy,onClick:downloadPreset},zh?'导出主题 JSON':'Export theme JSON'),
          exportStatus?h('p',{role:'status',style:{fontSize:12}},exportStatus):null,
          exportText?h('div',{},h('textarea',{'data-custom-theme-export-text':'',readOnly:true,value:exportText,'aria-label':zh?'主题 JSON 内容':'Theme JSON content',style:{width:'100%',height:100,fontSize:12,boxSizing:'border-box'}}),h('button',{type:'button',style:buttonStyle,'data-custom-theme-copy':'',onClick:async()=>{try{await navigator.clipboard.writeText(exportText);setExportStatus(zh?'已复制，粘贴到文本文件并保存为 .json。':'Copied. Paste into a text file and save as .json.')}catch{setExportStatus(zh?'复制失败，请选中上方内容手动复制。':'Copy failed. Select the text above and copy manually.')}}},zh?'复制主题 JSON':'Copy theme JSON')):null,
          h('label',{style:{display:'block',marginTop:12,fontSize:13}},zh?'导入主题 JSON':'Import theme JSON',h('input',{type:'file',accept:'.json,application/json','data-custom-theme-import':'',disabled:locked||state.backgroundBusy,onChange:e=>{controller.importPreset(e.target.files?.[0]);e.target.value=''},style:{display:'block',maxWidth:'100%',marginTop:8}})),
          state.presetBusy?h('p',{role:'status'},zh?'正在导入主题…':'Importing theme…'):null),
        h('p',{style:{margin:'8px 0 0',fontSize:12,color:'var(--dsw-alias-label-secondary)'}},zh?'浅色／深色／跟随系统及字体继续使用 DSH 原生设置。':'Color scheme and font size continue to use DSH settings.'),
        state.appearance==='whale-girl' && state.decorations && state.composer===0 ? h('p',{role:'status',style:{fontSize:12}},zh?'当前页面没有匹配的输入框，未改动其布局。':'No matching composer on this page; its layout remains unchanged.'):null,
        state.error?h('p',{role:'alert'},state.error):null)
    }
    const localeOff=ctx.locale.register(NS,{zh:{nav:'自定义主题'},en:{nav:'Custom Themes'}})
    const slotOff=registerAppearanceSection(ctx,AppearanceSection)
    return ()=>{slotOff();localeOff();controller.dispose()}
  },'whale-girl: appearance and reversible decorations')
}
// Export small lifecycle seams for real-behavior tests; these are not a DSH service.
exports.createAppearanceController=createAppearanceController
exports.mountDecorations=mountDecorations
exports.normalizeBackground=normalizeBackground
exports.mountBackground=mountBackground
exports.registerAppearanceSection=registerAppearanceSection
exports.normalizeCustom=normalizeCustom
exports.createCustomTokens=createCustomTokens
exports.parseThemePreset=parseThemePreset
exports.exportThemePreset=exportThemePreset
exports.saveThemePreset=saveThemePreset
