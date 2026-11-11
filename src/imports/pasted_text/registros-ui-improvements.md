# PROMPT – MEJORAS UX VISTA AGRUPADA REGISTROS
## Para pegar en el chat de Figma Make

---

## CONTEXTO

La vista agrupada por día de Registros ya funciona bien. Hay que agregarle
4 mejoras de navegación y visualización sin cambiar la estructura base ni
instalar ninguna librería externa. Todo se resuelve con React state y CSS.

**No modificar:** query de Supabase, modal de edición, exportación, ni ninguna
otra pantalla.

---

## MEJORA 1 — Selector rápido Semana / Mes

Agregar dos botones de toggle arriba de la lista, a la derecha del filtro de empleado:

```
[ Todos los empleados ▾ ]     [ Semana ]  [ Mes ]     ← Mar 2026 →     [ Hoy ]
```

**Comportamiento:**
- **Semana:** muestra los 7 días de la semana actual (lunes a domingo)
- **Mes:** muestra todos los días del mes actual con registros
- El período activo se resalta con fondo naranja `#F97316` y texto blanco
- El inactivo tiene borde `1px #E5E7EB` y texto `#1A1A1A`
- Al cambiar entre semana/mes, actualizar el label del período:
  - Semana: "16 — 22 mar 2026"
  - Mes: "Marzo 2026"

---

## MEJORA 2 — Navegación con flechas ← →

Flechas a los lados del label del período para navegar:

```
← Mar 2026 →
```

**Comportamiento:**
- En **modo semana:** ← va a la semana anterior, → va a la semana siguiente
- En **modo mes:** ← va al mes anterior, → va al mes siguiente
- Botón **"Hoy"** vuelve a la semana/mes actual
- Al navegar, actualizar el rango de fechas y recargar los registros de Supabase

**Lógica de navegación:**

```js
const [modo, setModo] = useState('semana')  // 'semana' | 'mes'
const [fechaBase, setFechaBase] = useState(new Date())

function getRango() {
  if (modo === 'semana') {
    const lunes = startOfWeek(fechaBase, { weekStartsOn: 1 })
    const domingo = endOfWeek(fechaBase, { weekStartsOn: 1 })
    return { desde: lunes, hasta: domingo }
  } else {
    const primero = startOfMonth(fechaBase)
    const ultimo = endOfMonth(fechaBase)
    return { desde: primero, hasta: ultimo }
  }
}

function navegarAnterior() {
  if (modo === 'semana') {
    setFechaBase(prev => subWeeks(prev, 1))
  } else {
    setFechaBase(prev => subMonths(prev, 1))
  }
}

function navegarSiguiente() {
  if (modo === 'semana') {
    setFechaBase(prev => addWeeks(prev, 1))
  } else {
    setFechaBase(prev => addMonths(prev, 1))
  }
}

function irAHoy() {
  setFechaBase(new Date())
}
```

Usar las funciones de `date-fns` que ya debería estar instalada. Si no está,
usar lógica nativa de JavaScript con `new Date()`.

---

## MEJORA 3 — Resumen total del período

Mostrar un banner de resumen entre los filtros y la lista de días.
Se actualiza cada vez que cambia el período o el filtro de empleado.

**Diseño:**
```
┌─────────────────────────────────────────────────────────────┐
│   📅 Semana del 10 al 16 de marzo                           │
│                                                              │
│   5 días con registros  ·  94 hs 22 min  ·  $443.534       │
└─────────────────────────────────────────────────────────────┘
```

- Fondo blanco, borde `1px #E5E7EB`, border-radius 12px, padding 16px
- Título en gris secundario `#6B7280`, tamaño 13px
- Métricas en texto oscuro `#1A1A1A`, tamaño 14px, separadas por `·`
- Si hay registros sospechosos en el período: agregar `· ⚠️ X para revisar`

**Lógica:**
```js
const resumen = useMemo(() => {
  const diasConRegistros = grupos.length
  const totalHoras = grupos.reduce((acc, g) => acc + g.totalHoras, 0)
  const totalPagar = grupos.reduce((acc, g) => acc + g.totalPagar, 0)
  const totalSospechosos = grupos.reduce((acc, g) => acc + g.cantidadSospechosos, 0)

  return { diasConRegistros, totalHoras, totalPagar, totalSospechosos }
}, [grupos])
```

---

## MEJORA 4 — Barra visual de horas por empleado

Cuando se expande un día, cada fila de empleado muestra una mini barra
de progreso que representa visualmente las horas trabajadas respecto
a su jornada.

**Diseño de cada fila expandida:**

```
Avatar  Nombre          Entrada  Salida   ████████░░  7 hs 49 min   Completo  ✏️
                                          (barra)
```

La barra va entre la columna de salida y las horas:
- Ancho total de la barra: 80px fijo
- Relleno naranja `#F97316` proporcional a `horas_trabajadas / jornada_empleado`
- Si supera la jornada: barra completa en amarillo `#F59E0B`
- Fondo de la barra: `#F4F5F7`
- Height: 6px, border-radius: 3px

**Lógica:**
```js
function getPorcentajeBarra(horasTrabajadas, jornadaHoras) {
  const jornada = jornadaHoras || 8  // fallback a 8 si no está definida
  const porcentaje = Math.min((horasTrabajadas / jornada) * 100, 100)
  return porcentaje
}

function getColorBarra(horasTrabajadas, jornadaHoras) {
  const jornada = jornadaHoras || 8
  return horasTrabajadas > jornada ? '#F59E0B' : '#F97316'
}
```

Para que funcione, la query de registros debe incluir `jornada_horas` del empleado:

```js
supabase
  .from('registros')
  .select(`
    id, fecha, hora_entrada, hora_salida, horas_totales, sueldo_dia,
    sospechoso, motivo_sospecha, editado_manual, nota_interna,
    empleados (id, nombre_completo, jornada_horas)
  `)
```

---

## DISEÑO VISUAL GENERAL

Mantener el sistema de diseño de Panahon:
- Naranja activo: `#F97316`
- Fondo: `#F4F5F7`
- Cards: `#FFFFFF`
- Texto principal: `#1A1A1A`
- Texto secundario: `#6B7280`
- Bordes: `#E5E7EB`

Los botones de Semana/Mes deben tener el mismo alto que el selector de empleado
para que la línea de filtros quede alineada.

---

## LO QUE NO HAY QUE TOCAR

- La estructura de grupos por día (ya funciona bien)
- El modal de edición de registros
- Los badges "⚠️ Revisar" y fondo amarillo
- La exportación Excel y PDF
- El dashboard y ninguna otra pantalla