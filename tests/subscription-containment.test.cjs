const assert = require("node:assert/strict")
const { test } = require("node:test")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const loadTypescript = require("./helpers/load-typescript.cjs")

const HOOK = "src/app/lib/use-empresa-suscripcion.ts"
const AUTH = "src/app/lib/auth-context.tsx"
const CLIENT = "src/app/lib/supabase.ts"
const DON_PICOTEO = "5d3eae51-b92d-47e7-8a63-cf4b45af2a79"
const BEYCA = "b45eeaf9-fdad-4a69-a6b1-819cbe97a7e1"
const CANONICAL = "a2c3aec8cc914c659a23676cbdd831d5"
const BEYCA_SUBSCRIPTION = "35a3485efbe34107a2b9039749ceb4eb"

// Read fixtures only. The fake client intentionally has no insert/update/delete.
const empresa = (overrides = {}) => ({
  exento_pago: false,
  fecha_vencimiento: null,
  plan_activo: false,
  plan_estado: null,
  mp_preapproval_id: null,
  mp_subscription_id: null,
  deleted_at: null,
  created_at: "2025-01-01T00:00:00Z",
  nombre: "Empresa de prueba",
  email_contacto: "",
  ...overrides,
})
const linkedEmpresa = (overrides = {}) =>
  empresa({
    mp_preapproval_id: CANONICAL,
    mp_subscription_id: CANONICAL,
    ...overrides,
  })

function fakeClient(respond) {
  const calls = []
  return {
    calls,
    from(table) {
      calls.push(["from", table])
      const query = {
        select(fields) {
          calls.push(["select", fields])
          return query
        },
        eq(field, value) {
          calls.push(["eq", field, value])
          return query
        },
        single() {
          return respond()
        },
      }
      return query
    },
  }
}

// Minimal hook lifecycle driver: tests render, commit, and settle explicitly.
// Effects and cleanup run; rendering itself is covered separately with React SSR.
function mountHook(client, loadClient = async () => client) {
  const state = []
  let cursor = 0
  let deps
  let cleanup
  let pendingEffect
  let currentId
  const fakeReact = {
    useState(initial) {
      const index = cursor++
      if (!(index in state)) state[index] = initial
      return [
        state[index],
        (value) => {
          state[index] =
            typeof value === "function" ? value(state[index]) : value
        },
      ]
    },
    useEffect(effect, nextDeps) {
      if (!deps || nextDeps.some((value, i) => value !== deps[i])) {
        pendingEffect = () => {
          cleanup?.()
          cleanup = effect()
        }
        deps = nextDeps
      }
    },
  }
  const { useEmpresaSuscripcion } = loadTypescript(HOOK, {
    react: fakeReact,
    [CLIENT]: { loadClient },
  })
  const harness = {
    render(id = currentId) {
      currentId = id
      cursor = 0
      return useEmpresaSuscripcion(id)
    },
    commit() {
      const effect = pendingEffect
      pendingEffect = null
      effect?.()
    },
    async settle() {
      harness.commit()
      await new Promise(setImmediate)
      return harness.render()
    },
    unmount() {
      cleanup?.()
    },
  }
  return harness
}

test("la lectura solicita ambos IDs y plan_estado; BEYCA vinculada/inactiva no puede dar otra alta", async () => {
  const client = fakeClient(async () => ({
    data: linkedEmpresa({
      mp_preapproval_id: BEYCA_SUBSCRIPTION,
      mp_subscription_id: BEYCA_SUBSCRIPTION,
    }),
  }))
  const hook = mountHook(client)
  assert.equal(hook.render(BEYCA).canCheckout, false)
  const result = await hook.settle()
  assert.equal(result.canCheckout, false)
  assert.equal(result.hasLinkedSubscription, true)
  assert.deepEqual(
    client.calls.find(([method]) => method === "eq"),
    ["eq", "id", BEYCA],
  )
  const fields = client.calls
    .find(([method]) => method === "select")[1]
    .split(", ")
  for (const field of [
    "mp_preapproval_id",
    "mp_subscription_id",
    "plan_estado",
  ]) {
    assert.ok(fields.includes(field))
  }
})

for (const [name, data] of [
  ["ambos IDs y plan activo", linkedEmpresa({ plan_activo: true })],
  ["solo mp_preapproval_id", empresa({ mp_preapproval_id: CANONICAL })],
  ["solo mp_subscription_id", empresa({ mp_subscription_id: CANONICAL })],
  ["plan_estado activo sin IDs", empresa({ plan_estado: "activo" })],
  ["conflicto entre los IDs", linkedEmpresa({ mp_subscription_id: "otro-id" })],
  [
    "empresa eliminada sin IDs",
    empresa({ deleted_at: "2026-10-01T00:00:00Z" }),
  ],
]) {
  test(`bloquea alta: ${name}`, async () => {
    const hook = mountHook(fakeClient(async () => ({ data })))
    hook.render(DON_PICOTEO)
    assert.equal((await hook.settle()).canCheckout, false)
  })
}

for (const [name, response] of [
  ["error de consulta", { data: null, error: new Error("consulta fallida") }],
  [
    "error con datos parciales",
    { data: empresa(), error: new Error("consulta fallida") },
  ],
  ["empresa no encontrada", { data: null, error: null }],
  ["faltan campos de suscripción", { data: { plan_activo: false } }],
]) {
  test(`falla cerrado: ${name}`, async () => {
    const hook = mountHook(fakeClient(async () => response))
    hook.render(DON_PICOTEO)
    const result = await hook.settle()
    assert.equal(result.fetchError, true)
    assert.equal(result.canCheckout, false)
    assert.equal(result.empresa, null)
  })
}

test("fallo al cargar el cliente no habilita checkout", async () => {
  const hook = mountHook(null, async () => {
    throw new Error("cliente no disponible")
  })
  hook.render(DON_PICOTEO)
  const result = await hook.settle()
  assert.equal(result.fetchError, true)
  assert.equal(result.canCheckout, false)
})

test("sin empresa identificada no consulta ni habilita checkout", async () => {
  const client = fakeClient(() => {
    throw new Error("no debe consultar")
  })
  const hook = mountHook(client)
  hook.render()
  const result = await hook.settle()
  assert.equal(result.fetchError, true)
  assert.equal(result.canCheckout, false)
  assert.equal(client.calls.length, 0)
})

test("error y reintento conservan el bloqueo hasta una nueva lectura correcta", async () => {
  let fail = true
  const client = fakeClient(async () =>
    fail
      ? { error: new Error("lectura fallida"), data: null }
      : { data: empresa() },
  )
  const hook = mountHook(client)
  hook.render(DON_PICOTEO)
  const failure = await hook.settle()
  assert.equal(failure.canCheckout, false)
  assert.equal(failure.fetchError, true)
  fail = false
  failure.reload()
  const retrying = hook.render()
  assert.equal(retrying.isLoading, true)
  assert.equal(retrying.canCheckout, false)
  assert.equal((await hook.settle()).canCheckout, true)
})

test("recomprobar invalida inmediatamente datos previos y no los reutiliza si falla", async () => {
  let fail = false
  const hook = mountHook(
    fakeClient(async () =>
      fail
        ? { data: null, error: new Error("fallo posterior") }
        : { data: empresa() },
    ),
  )
  hook.render(DON_PICOTEO)
  const ready = await hook.settle()
  assert.equal(ready.canCheckout, true)
  fail = true
  ready.reload()
  const refreshing = hook.render()
  assert.equal(refreshing.empresa, null)
  assert.equal(refreshing.canCheckout, false)
  assert.equal(refreshing.isLoading, true)
  const failed = await hook.settle()
  assert.equal(failed.fetchError, true)
  assert.equal(failed.canCheckout, false)
})

test("cambiar de empresa invalida la anterior antes de ejecutar el efecto", async () => {
  const hook = mountHook(fakeClient(async () => ({ data: empresa() })))
  hook.render(BEYCA)
  assert.equal((await hook.settle()).canCheckout, true)
  const switched = hook.render(DON_PICOTEO)
  assert.equal(switched.isLoading, true)
  assert.equal(switched.empresa, null)
  assert.equal(switched.canCheckout, false)
})

test("ignora una respuesta tardía de la empresa anterior", async () => {
  let finishFirst
  let count = 0
  const hook = mountHook(
    fakeClient(() =>
      ++count === 1
        ? new Promise((resolve) => {
            finishFirst = resolve
          })
        : Promise.resolve({ data: linkedEmpresa() }),
    ),
  )
  hook.render(BEYCA)
  await hook.settle()
  hook.render(DON_PICOTEO)
  assert.equal((await hook.settle()).hasLinkedSubscription, true)
  finishFirst({ data: empresa() })
  const result = await hook.settle()
  assert.equal(result.empresa.mp_subscription_id, CANONICAL)
  assert.equal(result.canCheckout, false)
})

function readySubscription(data, overrides = {}) {
  return {
    empresa: data,
    isLoading: false,
    fetchError: false,
    hasLinkedSubscription: Boolean(
      data &&
        (data.mp_preapproval_id ||
          data.mp_subscription_id ||
          data.plan_estado === "activo"),
    ),
    canCheckout: false,
    reload() {},
    ...overrides,
  }
}

function renderComponent(file, exportName, subscription) {
  const { LINKED_SUBSCRIPTION_MESSAGE } = loadTypescript(HOOK, {
    [CLIENT]: {
      loadClient() {
        throw new Error("No se permiten llamadas reales")
      },
    },
  })
  const exports = loadTypescript(file, {
    "src/app/lib/use-checkout.ts": { useCheckout: () => ({ busy:false, error:"", openCheckout: () => { globalThis.window.location.href = "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=individual"; } }) },
    [AUTH]: {
      useAuth: () => ({
        admin: { empresa_id: DON_PICOTEO },
        signOut: async () => {},
      }),
    },
    [HOOK]: {
      useEmpresaSuscripcion: () => subscription,
      LINKED_SUBSCRIPTION_MESSAGE,
    },
    "react-router": { useNavigate: () => () => {} },
  })
  const element = exports[exportName]({})
  return {
    element,
    html: renderToStaticMarkup(element),
    LINKED_SUBSCRIPTION_MESSAGE,
  }
}

function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (typeof node === "string" || typeof node === "number") return String(node)
  return React.isValidElement(node) ? textOf(node.props.children) : ""
}

function findButton(node, label) {
  if (Array.isArray(node)) {
    return node.map((child) => findButton(child, label)).find(Boolean)
  }
  if (!React.isValidElement(node)) return undefined
  if (node.props.onClick && textOf(node).trim() === label) return node
  if (
    typeof node.type === "function" &&
    node.type.name === "SubscriptionNotice"
  ) {
    return findButton(node.type(node.props), label)
  }
  return findButton(node.props.children, label)
}

for (const [file, name, checkoutLabel] of [
  [
    "src/app/components/admin/SuscripcionPage.tsx",
    "SuscripcionContent",
    "Activar suscripción",
  ],
  [
    "src/app/components/admin/PaywallScreen.tsx",
    "PaywallScreen",
    "Activar plan por $30.000 / mes",
  ],
]) {
  for (const [scenario, subscription] of [
    ["vinculada e inactiva", readySubscription(linkedEmpresa())],
    [
      "vinculada y activa",
      readySubscription(linkedEmpresa({ plan_activo: true })),
    ],
    [
      "vinculada en prueba",
      readySubscription(
        linkedEmpresa({
          plan_activo: true,
          created_at: new Date().toISOString(),
        }),
      ),
    ],
    [
      "estado activo sin IDs",
      readySubscription(empresa({ plan_estado: "activo" })),
    ],
    ["error de lectura", readySubscription(null, { fetchError: true })],
    ["cargando", readySubscription(null, { isLoading: true })],
    [
      "empresa eliminada",
      readySubscription(empresa({ deleted_at: "2026-10-01T00:00:00Z" })),
    ],
  ]) {
    test(`${name}: ${scenario} no ofrece ningún botón de alta`, () => {
      const { html, LINKED_SUBSCRIPTION_MESSAGE } = renderComponent(
        file,
        name,
        subscription,
      )
      assert.doesNotMatch(
        html,
        /Suscribirme ahora|Activar suscripción|Activar plan por|subscriptions\/checkout/,
      )
      assert.doesNotMatch(html, />Actualizar</)
      assert.doesNotMatch(html, /Sí, cancelar|Cancelar suscripción/)
      if (subscription.hasLinkedSubscription) {
        assert.ok(html.includes(LINKED_SUBSCRIPTION_MESSAGE))
      }
      if (subscription.fetchError) assert.match(html, /Reintentar/)
      if (subscription.isLoading) assert.match(html, /Cargando información/)
    })
  }

  test(`${name}: recomprobar estado no abre checkout`, () => {
    let reloads = 0
    const subscription = readySubscription(
      linkedEmpresa({ plan_activo: true }),
      {
        reload() {
          reloads++
        },
      },
    )
    const { element, html } = renderComponent(file, name, subscription)
    const button = findButton(element, "Volver a comprobar estado")
    assert.ok(button)
    // No window is supplied: navigation would fail this test.
    button.props.onClick()
    assert.equal(reloads, 1)
    assert.match(html, /no consulta Mercado Pago/)
  })

  test(`${name}: el error conserva un reintento real`, () => {
    let reloads = 0
    const { element } = renderComponent(
      file,
      name,
      readySubscription(null, {
        fetchError: true,
        reload() {
          reloads++
        },
      }),
    )
    findButton(element, "Reintentar").props.onClick()
    assert.equal(reloads, 1)
  })

  test(`${name}: solo la lectura sin vinculación permite el checkout`, () => {
    const { element } = renderComponent(
      file,
      name,
      readySubscription(empresa(), { canCheckout: true }),
    )
    const button = findButton(element, checkoutLabel)
    assert.ok(button)
    const previousWindow = globalThis.window
    globalThis.window = { location: { href: "" } }
    try {
      button.props.onClick()
      assert.match(globalThis.window.location.href, /subscriptions\/checkout/)
    } finally {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
    }
  })
}

test(
  "servidor pendiente: cancelación del duplicado bc98dac035bb4069b759cdc1c9c8c968 no cambia Don Picoteo",
  { todo: "El receptor de Mercado Pago no está en este repositorio" },
)
test(
  "servidor pendiente: authorized del duplicado no modifica columnas ni IDs",
  { todo: "Falta el receptor real" },
)
test("servidor pendiente: cambio concurrente de ID impide el UPDATE", {
  todo: "Falta el receptor real",
})
test(
  "servidor pendiente: conflicto entre mp_preapproval_id y mp_subscription_id no muta",
  { todo: "Falta el receptor real" },
)
test("servidor pendiente: empresa eliminada no se restaura", {
  todo: "Falta el receptor real",
})
test(
  "servidor pendiente: evento canónico sigue su lógica sin equiparar authorized con pago",
  { todo: "Falta el receptor real" },
)
test(
  "servidor pendiente: coincidencia solo por correo requiere conciliación, sin mutar",
  { todo: "Falta el receptor real" },
)

for(const [name,data,expected] of [
 ['own pending',linkedEmpresa({plan_estado:'pendiente'}),true],
 ['active',linkedEmpresa({plan_estado:'activo'}),false],
 ['exempt pending',linkedEmpresa({plan_estado:'pendiente',exento_pago:true}),false],
 ['conflicting pending',linkedEmpresa({plan_estado:'pendiente',mp_subscription_id:'other'}),false],
])test('resume checkout: '+name,async()=>{const h=mountHook(fakeClient(async()=>({data})));h.render(DON_PICOTEO);assert.equal((await h.settle()).canResumeCheckout,expected)});
test('exempt company cannot start subscription',async()=>{const h=mountHook(fakeClient(async()=>({data:empresa({exento_pago:true})})));h.render(DON_PICOTEO);assert.equal((await h.settle()).canCheckout,false)});
