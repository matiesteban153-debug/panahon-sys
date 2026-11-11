const fs = require("node:fs")
const path = require("node:path")
const { createRequire } = require("node:module")
const ts = require("typescript")

// Transpile the current source using the existing compiler, without a new test dependency.
// Overrides isolate auth/network imports; no production services are contacted.
module.exports = function loadTypescript(entry, overrides = {}) {
  const root = path.resolve(__dirname, "../..")
  const cache = new Map()

  function load(file) {
    const relative = path.relative(root, file).split(path.sep).join("/")
    if (Object.hasOwn(overrides, relative)) return overrides[relative]
    if (cache.has(file)) return cache.get(file).exports

    const module = { exports: {} }
    cache.set(file, module)
    const nativeRequire = createRequire(file)
    const localRequire = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier]
      if (!specifier.startsWith(".")) return nativeRequire(specifier)
      const base = path.resolve(path.dirname(file), specifier)
      const target = [base, `${base}.ts`, `${base}.tsx`].find(
        (candidate) =>
          fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (!target) throw new Error(`Unresolved test import: ${specifier}`)
      return load(target)
    }
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: file,
    })
    new Function("require", "module", "exports", outputText)(
      localRequire,
      module,
      module.exports,
    )
    return module.exports
  }

  return load(path.resolve(root, entry))
}
