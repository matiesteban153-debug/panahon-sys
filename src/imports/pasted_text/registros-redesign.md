# PROMPT – REDISEÑO SECCIÓN REGISTROS
## Para pegar en el chat de Figma Make

---

## CONTEXTO

La sección de Registros actualmente muestra una lista plana de todos los registros
mezclados, lo que genera mucha carga cognitiva. Hay que rediseñarla completamente
para agrupar los registros por día, con un encabezado resumen por cada día y la
posibilidad de expandir/colapsar cada grupo.

**No modificar:** lógica de Supabase fuera de esta pantalla, exportación, dashboard,
empleados, reportes, ni la app de fichaje.

---

## NUEVA ESTRUCTURA DE LA PANTALLA

### FILTROS (mantener los existentes, reorganizar visualmente)

```
[ Todos los empleados ▾ ]   Desde: [01/03/2026]   Hasta: [17/03/2026]   [Buscar]
```

- Mantener el filtro por empleado y el rango de fechas
- Cuando se filtra por un empleado específico, la vista agrupada por día se mantiene
  pero solo muestra los registros de ese empleado
- Agregar botón "Expandir todo" / "Colapsar todo" a la derecha de los filtros

---

## VISTA AGRUPADA POR DÍA

Cada día es una sección con:

### Encabezado del día (siempre visible, clickeable para expandir/colapsar)

```
▼  Lunes 16 de marzo          3 empleados  ·  19 hs 55 min  ·  $93.565   
```

Si hay registros sospechosos ese día:
```
▼  Domingo 15 de marzo         3 empleados  ·  18 hs 26 min  ·  $86.622   ⚠️ 2 para revisar
```

**Diseño del encabezado:**
- Fondo gris muy suave (`#F4F5F7`), borde inferior `1px #E5E7EB`
- Fecha en tipografía bold, tamaño 14px
- Métricas en texto secundario gris, separadas por `·`
- Badge de alerta `⚠️ X para revisar` solo si hay registros con `sospechoso = true`
  ese día — fondo `#FEF3C7`, texto `#92400E`
- Ícono de chevron (▼/▶) que rota al expandir/colapsar
- Al hacer hover: fondo levemente más oscuro (`#ECEEF1`)
- El encabezado entero es clickeable

### Contenido expandido (filas de empleados del día)

Misma tabla que existe actualmente:
| Empleado | Entrada | Salida | Horas | Estado | Acciones |
- Sin columna de fecha (ya está en el encabezado del grupo)
- Mantener badge "⚠️ Revisar" en filas sospechosas
- Mantener ícono de edición en columna Acciones

---

## COMPORTAMIENTO AL CARGAR

- El día más reciente con registros → **expandido por defecto**
- Todos los demás días → **colapsados por defecto**
- Si se aplica un filtro de empleado → mantener el mismo comportamiento
- Si hay días sin registros en el rango → no mostrarlos (solo días con al menos 1 registro)

---

## LÓGICA DE AGRUPACIÓN EN FRONTEND

La query a Supabase no cambia. Los datos se agrupan en el frontend después de recibirlos:

```js
// Agrupar registros por fecha
function agruparPorFecha(registros) {
  const grupos = {}

  registros.forEach(registro => {
    const fecha = registro.fecha  // formato YYYY-MM-DD
    if (!grupos[fecha]) {
      grupos[fecha] = {
        fecha,
        registros: [],
        totalHoras: 0,
        totalPagar: 0,
        cantidadEmpleados: 0,
        tieneSospechosos: false,
        cantidadSospechosos: 0
      }
    }
    grupos[fecha].registros.push(registro)
    grupos[fecha].totalHoras += parseFloat(registro.horas_totales || 0)
    grupos[fecha].totalPagar += parseFloat(registro.sueldo_dia || 0)
    grupos[fecha].cantidadEmpleados += 1
    if (registro.sospechoso) {
      grupos[fecha].tieneSospechosos = true
      grupos[fecha].cantidadSospechosos += 1
    }
  })

  // Ordenar por fecha descendente (más reciente primero)
  return Object.values(grupos).sort((a, b) =>
    new Date(b.fecha) - new Date(a.fecha)
  )
}
```

---

## FORMATO DEL ENCABEZADO DE CADA DÍA

```js
// Formatear fecha del encabezado
function formatearFechaGrupo(fechaStr) {
  const fecha = new Date(fechaStr + 'T12:00:00')  // noon para evitar problemas de timezone
  return fecha.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  // Resultado: "lunes 16 de marzo"
}

// Formatear horas totales del día
function formatearHorasDia(horasDecimal) {
  const horas = Math.floor(horasDecimal)
  const minutos = Math.round((horasDecimal - horas) * 60)
  if (minutos === 0) return `${horas} hs`
  return `${horas} hs ${minutos} min`
}

// Formatear total a pagar del día
function formatearPesos(monto) {
  return '$' + Math.round(monto).toLocaleString('es-AR')
}
```

---

## ESTADO DE EXPANSIÓN

```js
// Estado inicial: solo el día más reciente expandido
const [diasExpandidos, setDiasExpandidos] = useState(() => {
  if (grupos.length === 0) return {}
  return { [grupos[0].fecha]: true }  // primer grupo = más reciente
})

// Toggle de un día
function toggleDia(fecha) {
  setDiasExpandidos(prev => ({
    ...prev,
    [fecha]: !prev[fecha]
  }))
}

// Expandir todo
function expandirTodo() {
  const todos = {}
  grupos.forEach(g => { todos[g.fecha] = true })
  setDiasExpandidos(todos)
}

// Colapsar todo
function colapsarTodo() {
  setDiasExpandidos({})
}
```

---

## ESTADO VACÍO

Si no hay registros en el rango seleccionado:
- Ícono de calendario
- Texto: "No hay registros en el período seleccionado"
- Subtexto: "Probá con otro rango de fechas"

---

## DISEÑO VISUAL

Mantener el sistema de diseño de Panahon:
- Naranja: `#F97316`
- Fondo página: `#F4F5F7`
- Cards/tabla: `#FFFFFF`
- Encabezado de grupo: `#F4F5F7` con borde `#E5E7EB`
- Texto principal: `#1A1A1A`
- Texto secundario: `#6B7280`

**Animación de expand/colapsar:**
- Usar transición CSS suave (`transition: all 200ms ease`)
- El chevron rota 90° al expandir

**Mobile (390px):**
- El encabezado del día muestra fecha y métricas en dos líneas
- Las filas de empleados dentro del grupo se convierten en cards apiladas
- Mantener el badge de alerta visible

---

## LO QUE NO HAY QUE TOCAR

- La query de Supabase (`.from('registros').select(...)`)
- El modal de edición de registros
- El filtro de fechas y de empleados
- Los badges "⚠️ Revisar" y fondo amarillo en filas sospechosas
- La exportación Excel y PDF
- Ninguna otra pantalla del dashboard