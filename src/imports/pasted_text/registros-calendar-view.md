# PROMPT – VISTA CALENDARIO EN REGISTROS
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Reemplazar la vista agrupada por día de la sección Registros por una vista de
calendario tipo Google Calendar con tres modos: Mes, Semana y Día.

**Usar obligatoriamente la librería FullCalendar** — no construir el calendario
desde cero. Es la librería estándar de la industria para esto.

Paquetes a instalar:
```
@fullcalendar/react
@fullcalendar/core
@fullcalendar/daygrid      (vista mes)
@fullcalendar/timegrid     (vista semana y día)
@fullcalendar/interaction  (click en eventos)
```

**No modificar:** lógica de Supabase, exportación, dashboard, empleados, reportes,
app de fichaje, ni ninguna otra pantalla.

---

## ESTRUCTURA DE LA PANTALLA

### Header de la pantalla
```
Registros

[ Todos los empleados ▾ ]        ← Mes ·  Semana ·  Día →        [ Hoy ]
```

- Filtro de empleado a la izquierda (mantener el existente)
- Navegación del calendario en el centro: flechas ← → + label del período actual
- Botón "Hoy" a la derecha para volver al período actual
- Eliminar los filtros de Desde/Hasta — el calendario reemplaza esa navegación

---

## VISTA MES (daygrid)

Cada celda del mes muestra:
- **Total de horas del día** — número grande, color naranja `#F97316`
  ej: `19 hs`
- **Puntos de color por empleado** — un punto de color por cada empleado que
  trabajó ese día (máximo 4 puntos visibles, si hay más mostrar `+N`)
- **Indicador de alerta** — si hay registros sospechosos ese día, mostrar
  un pequeño `⚠️` en la esquina superior derecha de la celda

Al hacer click en un día → navegar a la **vista día** de esa fecha.

---

## VISTA SEMANA (timegrid)

- Columnas: lunes a domingo
- Filas: horas del día (eje Y con franjas horarias)
- Cada turno trabajado es un **bloque de color** en la grilla:
  - El bloque ocupa desde `hora_entrada` hasta `hora_salida`
  - Color de fondo: naranja suave `#FFF4EC`, borde izquierdo naranja `#F97316`
  - Texto dentro del bloque: nombre del empleado + horas trabajadas
  - Si el registro es sospechoso: borde izquierdo amarillo `#F59E0B`
- Si hay muchos empleados superpuestos, los bloques se muestran lado a lado

---

## VISTA DÍA (timegrid day)

- Igual que la vista semana pero solo un día
- Se llega acá al hacer click en un día del calendario mes
- Muestra todos los turnos del día con mayor detalle:
  - Nombre del empleado
  - Hora entrada → hora salida
  - Horas totales
  - Badge "⚠️ Revisar" si es sospechoso
- Al hacer click en un bloque → abrir el modal de edición existente

---

## CONFIGURACIÓN DE FULLCALENDAR

```jsx
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

<FullCalendar
  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
  initialView="timeGridWeek"        // vista semana por defecto
  locale="es"                        // español
  firstDay={1}                       // semana empieza el lunes
  headerToolbar={false}              // deshabilitar toolbar nativo — usar el custom de arriba
  allDaySlot={false}                 // sin franja "todo el día"
  slotMinTime="06:00:00"             // mostrar desde las 6am
  slotMaxTime="06:00:00"             // mostrar hasta las 6am del día siguiente (24hs)
  height="auto"
  events={eventos}                   // array de eventos mapeados desde registros
  eventClick={handleEventClick}      // abrir modal de edición
  dateClick={handleDateClick}        // click en día vacío → vista día
/>
```

---

## MAPEO DE REGISTROS A EVENTOS DE FULLCALENDAR

```js
// Convertir registros de Supabase al formato de eventos de FullCalendar
function registrosAEventos(registros) {
  return registros
    .filter(r => r.hora_entrada && r.hora_salida)  // solo registros completos
    .map(r => ({
      id: r.id,
      title: r.empleados?.nombre_completo || 'Empleado',
      start: r.hora_entrada,   // timestamptz — FullCalendar lo maneja solo
      end: r.hora_salida,
      backgroundColor: r.sospechoso ? '#FEF3C7' : '#FFF4EC',
      borderColor: r.sospechoso ? '#F59E0B' : '#F97316',
      textColor: r.sospechoso ? '#92400E' : '#EA6C0A',
      extendedProps: {
        registro: r  // guardar el registro completo para el modal
      }
    }))
}

// Para la vista mes, generar eventos de resumen por día
function registrosAEventosMes(registrosPorDia) {
  return Object.entries(registrosPorDia).map(([fecha, datos]) => ({
    id: `resumen-${fecha}`,
    start: fecha,
    allDay: true,
    display: 'background',  // evento de fondo, no bloque
    extendedProps: {
      totalHoras: datos.totalHoras,
      empleados: datos.empleados,
      tieneSospechosos: datos.tieneSospechosos
    }
  }))
}
```

---

## QUERY A SUPABASE

Cargar registros del período visible en el calendario.
Cuando el usuario navega al mes anterior/siguiente, recargar:

```js
async function cargarRegistros(fechaInicio, fechaFin) {
  let query = supabase
    .from('registros')
    .select(`
      id,
      fecha,
      hora_entrada,
      hora_salida,
      horas_totales,
      sueldo_dia,
      sospechoso,
      motivo_sospecha,
      editado_manual,
      nota_interna,
      empleados (id, nombre_completo)
    `)
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('hora_entrada', { ascending: true })

  if (empleadoFiltro) {
    query = query.eq('empleado_id', empleadoFiltro)
  }

  const { data } = await query
  return data
}

// Llamar cuando FullCalendar cambia de período:
// datesSet callback de FullCalendar provee start y end del período visible
<FullCalendar
  datesSet={(dateInfo) => {
    cargarRegistros(
      dateInfo.startStr.split('T')[0],
      dateInfo.endStr.split('T')[0]
    )
  }}
/>
```

---

## ESTILO VISUAL

Sobrescribir los estilos por defecto de FullCalendar para que coincida con Panahon:

```css
/* Variables de FullCalendar a sobrescribir */
:root {
  --fc-border-color: #E5E7EB;
  --fc-today-bg-color: #FFF4EC;        /* naranja muy suave para el día actual */
  --fc-now-indicator-color: #F97316;   /* línea de hora actual en naranja */
  --fc-button-bg-color: #F97316;
  --fc-button-active-bg-color: #EA6C0A;
  --fc-event-border-color: #F97316;
  --fc-event-bg-color: #FFF4EC;
  --fc-event-text-color: #EA6C0A;
}

/* Tipografía consistente con Panahon */
.fc {
  font-family: 'DM Sans', 'Sora', sans-serif;
}

/* Encabezados de días */
.fc-col-header-cell {
  font-weight: 600;
  color: #1A1A1A;
}
```

---

## REGISTROS INCOMPLETOS (sin hora de salida)

Los registros sin `hora_salida` no se muestran como bloques en el calendario
pero sí deben aparecer como un indicador en la celda del día:

- En vista mes: punto gris con `?` dentro
- En vista semana/día: bloque con fondo gris rayado, texto "En jornada" o "Sin salida"
- Al hacer click → abrir modal de edición igual que los completos

---

## NAVEGACIÓN ENTRE VISTAS

Botones custom sobre el calendario (no usar el toolbar de FullCalendar):

```jsx
const [vistaActual, setVistaActual] = useState('timeGridWeek')

function cambiarVista(vista) {
  setVistaActual(vista)
  calendarRef.current.getApi().changeView(vista)
}

// Botones:
// "Mes"    → changeView('dayGridMonth')
// "Semana" → changeView('timeGridWeek')
// "Día"    → changeView('timeGridDay')

// Navegación:
// "←"   → calendarRef.current.getApi().prev()
// "→"   → calendarRef.current.getApi().next()
// "Hoy" → calendarRef.current.getApi().today()
```

---

## MOBILE (390px)

- Vista semana → cambiar automáticamente a vista día en mobile
- Los bloques de eventos muestran solo las iniciales del empleado
- La navegación se simplifica: solo ← → y botón "Hoy"

---

## LO QUE NO HAY QUE TOCAR

- El modal de edición de registros (reutilizarlo tal cual)
- La lógica de badges "⚠️ Revisar"
- La exportación Excel y PDF
- El dashboard
- Ninguna otra pantalla