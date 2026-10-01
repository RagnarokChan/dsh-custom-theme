import z from '@deepseek-ai/schemastery'

export const name = 'dsh-theme-whale-girl'
export const Config = z.object({
  appearance: z.union(['original', 'whale-girl', 'custom']).default('original').volatile(),
  decorations: z.boolean().default(true).volatile(),
  custom: z.object({
    accent: z.string().default('#7c9cf5'),
    light: z.string().default('#f5f7fc'),
    dark: z.string().default('#101828'),
    artwork: z.boolean().default(false),
  }).default({accent:'#7c9cf5',light:'#f5f7fc',dark:'#101828',artwork:false}).volatile(),
  background: z.object({
    image: z.string().default(''),
    name: z.string().default(''),
    fit: z.union(['cover', 'contain']).default('cover'),
    opacity: z.number().min(0).max(100).default(100),
  }).default({image:'',name:'',fit:'cover',opacity:100}).volatile(),
})

export function apply(ctx) {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
}
