# PROMPT – FILTRO DE RANGO DE FECHAS EN REGISTROS
## Para pegar en el chat de Figma Make

---

## QUÉ HAY QUE MODIFICAR

Actualizar **únicamente** el filtro de fecha en la pantalla de Registros (`/admin/registros`).
No modificar ninguna otra pantalla, componente, ni lógica existente.

El filtro actual probablemente permite seleccionar un solo mes o una fecha puntual.
Hay que reemplazarlo por un filtro de rango con dos campos: **Desde** y **Hasta**.

---

## CAMBIO EN EL FILTRO

### Antes (eliminar):
- Selector de mes único o fecha puntual

### Después (implementar):
Dos inputs de fecha lado a lado:

```
[ Desde: dd/mm/aaaa ]   [ Hasta: dd/mm/aaaa ]   [ Buscar ]
```

**Comportamiento:**
- Ambos campos son de tipo `date` (selector nativo del navegador)
- El campo **Desde** no puede ser mayor que **Hasta** (validar antes de buscar)
- El campo **Hasta** no puede ser menor que **Desde**
- Si solo se completa **Desde** sin **Hasta** → buscar desde esa fecha hasta hoy
- Si solo se completa **Hasta** sin **Desde** → buscar desde el inicio hasta esa fecha
- Si ninguno está completo → mostrar el mes actual por defecto (comportamiento actual)
- Botón **Buscar** ejecuta el filtro
- Botón **Limpiar** (secundario, aparece solo cuando hay filtros activos) → resetea ambos campos y vuelve al mes actual

**Valores por defecto al cargar la pantalla:**
- Desde: primer día del mes actual
- Hasta: día de hoy

---

## LÓGICA DE QUERY EN SUPABASE

Reemplazar la query actual de registros por esta, que acepta rango de fechas:

```js
// Obtener los valores del filtro
const desdeDate = desde || startOfMonth(new Date())  // primer día del mes si no hay valor
const hastaDate = hasta || new Date()                 // hoy si no hay valor

// Query con rango
const { data, error } = await supabase
  .from('registros')
  .select(`
    id,
    fecha,
    hora_entrada,
    hora_salida,
    horas_totales,
    editado_manual,
    nota_interna,
    empleados (nombre_completo)
  `)
  .gte('fecha', desdeDate.toISOString().split('T')[0])   // formato YYYY-MM-DD
  .lte('fecha', hastaDate.toISOString().split('T')[0])   // formato YYYY-MM-DD
  .order('fecha', { ascending: false })
```

**Importante:** Si el filtro de empleado también existe, mantenerlo funcionando en conjunto con el rango de fechas. Los dos filtros deben aplicarse al mismo tiempo:

```js
let query = supabase
  .from('registros')
  .select(`id, fecha, hora_entrada, hora_salida, horas_totales, editado_manual, empleados (nombre_completo)`)
  .gte('fecha', desde)
  .lte('fecha', hasta)
  .order('fecha', { ascending: false })

// Agregar filtro de empleado si está seleccionado
if (empleadoId) {
  query = query.eq('empleado_id', empleadoId)
}

const { data, error } = await query
```

---

## DISEÑO VISUAL

- Mantener el estilo existente de la pantalla de Registros sin cambios
- Los dos inputs de fecha deben tener el mismo ancho y altura que los otros filtros existentes
- En **desktop**: los dos campos van en la misma fila que el filtro de empleado
- En **mobile**: los dos campos van en una fila separada, uno al lado del otro (50% de ancho cada uno)
- El botón **Limpiar** va al lado del botón **Buscar**, en outline, solo visible cuando hay filtros activos
- Mostrar un indicador de rango activo debajo de los filtros cuando el rango no es el mes actual: "Mostrando registros del 01/02/2025 al 15/02/2025"

---

## VALIDACIONES Y ERRORES

| Situación | Comportamiento |
|---|---|
| Desde > Hasta | Mostrar error inline: "La fecha 'Desde' no puede ser posterior a 'Hasta'" — no ejecutar búsqueda |
| Rango mayor a 12 meses | Mostrar advertencia: "El rango seleccionado es mayor a un año. Puede demorar un poco." — pero permitir la búsqueda |
| Sin resultados en el rango | Mostrar empty state: "No hay registros en el período seleccionado." |
| Error de Supabase | Mostrar: "No pudimos cargar los registros. Intentá de nuevo." |

---

## LO QUE NO HAY QUE TOCAR

- La tabla de registros y sus columnas
- El modal de edición de registros
- El filtro de empleado (solo extenderlo para que funcione junto al rango de fechas)
- Ninguna otra pantalla del dashboard
- La lógica de Supabase fuera de la query de registros