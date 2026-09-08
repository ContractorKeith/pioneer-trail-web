import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

let loaded
/** Node-only evidence tooling loads the same TypeScript world that Vite bundles. */
export function loadWorldTools() {
  return (loaded ??= (async () => {
    const root = new URL('../', import.meta.url).href
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        if (
          specifier.startsWith('.') &&
          context.parentURL?.startsWith(root) &&
          !context.parentURL.includes('/node_modules/')
        ) {
          const url = new URL(specifier, context.parentURL),
            file = fileURLToPath(url)
          if (!existsSync(file) && existsSync(`${file}.ts`))
            return { url: `${url.href}.ts`, shortCircuit: true }
          if (existsSync(`${file}/index.ts`))
            return { url: `${url.href}/index.ts`, shortCircuit: true }
        }
        return next(specifier, context)
      },
      load(url, context, next) {
        if (url.startsWith(root) && !url.includes('/node_modules/') && url.endsWith('.ts'))
          return {
            format: 'module',
            shortCircuit: true,
            source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
              compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
            }).outputText,
          }
        return next(url, context)
      },
    })
    try {
      const [world, physics, navigation, crossing, three] = await Promise.all([
        import('../src/game/world/index.ts'),
        import('../src/game/physics.ts'),
        import('./walking-route.ts'),
        import('./crossing-route.ts'),
        import('three'),
      ])
      await physics.initPhysics()
      return { ...world, ...physics, ...navigation, ...crossing, Scene: three.Scene }
    } finally {
      hooks.deregister()
    }
  })())
}
