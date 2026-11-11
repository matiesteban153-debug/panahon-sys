# PROMPT – EDICIÓN CON CALENDARIO Y ALERTAS DE HORAS EXCEDIDAS
## Para pegar en el chat de Figma Make

---

## CONTEXTO

Se reemplaza la lógica de detección cross-day y el modal de "dividir registros"
por un sistema más simple y robusto:

- Un registro es **sospechoso** cuando las horas trabajadas superan la jornada
  configurada para ese empleado
- El admin puede editar cualquier registro sospechoso con un selector de
  **fecha + hora** con rango de ±3 días
- El empleado no ve ninguna alerta — la gestión es 100% del lado del admin

**Cambios a realizar:**
1. Simplificar el modal de edición — sacar la sección "dividir en dos registros"
2. Reemplazarla por un selector de fecha+hora con rango ±3 días
3. Actualizar el mensaje de alerta en registros sospechosos
4. Actualizar la alerta del dashboard

**No modificar:** tabla de registros, filtros, pantalla de fichaje, reportes.

---

## CAMBIO 1 — Modal de edición actualizado

### Estructura del modal para TODOS los registros (sospechosos o no):

```
┌─────────────────────────────────────────┐
│ Editar registro                          │
│                                          │
│ Empleado: María González  (solo lectura) │
│                                          │
│ ── Hora de entrada ─────────────────── │
│ Fecha:  [ 03/03/2026 ▾ ]               │
│ Hora:   [ 08:00      ]                  │
│                                          │
│ ── Hora de salida ──────────────────── │
│ Fecha:  [ 03/03/2026 ▾ ]               │
│ Hora:   [ 17:00      ]                  │
│                                          │
│ Horas totales: 9 hs (calculado solo)    │
│                                          │
│ Nota interna: [                      ]  │
│                                          │
│ [Cancelar]              [Guardar cambios]│
└─────────────────────────────────────────┘
```

### Comportamiento del selector de fecha:

- Mostrar un date picker (calendario) al hacer click
- **Rango permitido:** desde 3 días antes de la fecha del registro hasta 3 días después
- Fecha por defecto: la fecha original del registro
- Si se cambia la fecha de entrada o salida, recalcular y mostrar las horas totales en tiempo real
- El campo "Horas totales" es solo lectura y se actualiza automáticamente

### Validaciones antes de guardar:

| Situación | Mensaje |
|---|---|
| Hora salida anterior a hora entrada | "La hora de salida debe ser posterior a la entrada" |
| Horas totales > jornada del empleado | Mostrar advertencia amarilla: "⚠️ Estas horas superan la jornada de X hs del empleado. ¿Querés guardar igual?" — con botones "Revisar" y "Guardar igual" |
| Campos vacíos | "Completá todos los campos requeridos" |

### Al guardar:

```js
const { error } = await supabase
  .from('registros')
  .update({
    hora_entrada: `${fechaEntrada}T${horaEntrada}:00+00:00`,
    hora_salida: `${fechaSalida}T${horaSalida}:00+00:00`,
    editado_manual: true,
    nota_interna: notaInterna || null,
    // Recalcular sospechoso según las nuevas horas
    sospechoso: horasTotalesNuevas > jornadaEmpleado,
    motivo_sospecha: horasTotalesNuevas > jornadaEmpleado
      ? `Editado manualmente: ${horasTotalesNuevas} hs superan la jornada de ${jornadaEmpleado} hs`
      : null
  })
  .eq('id', registroId)
```

---

## CAMBIO 2 — Actualizar mensaje de alerta en registros sospechosos

El badge y tooltip de la tabla de registros ya existen. Solo actualizar el mensaje:

**Badge:** "⚠️ Revisar" (igual que antes)

**Tooltip:** Mostrar el `motivo_sospecha` del registro.
Ejemplos de mensajes que puede traer:
- "Se registraron 24 hs pero la jornada es de 8 hs. Revisar si las horas son correctas."
- "Editado manualmente: 10 hs superan la jornada de 8 hs"

---

## CAMBIO 3 — Actualizar alerta en el dashboard

Actualizar el mensaje de la alerta existente:

```js
// Query para contar registros sospechosos del mes actual
const { count } = await supabase
  .from('registros')
  .select('id', { count: 'exact' })
  .eq('sospechoso', true)
  .gte('fecha', inicioMes)
  .lte('fecha', finMes)
```

**Mensaje:** "⚠️ {count} registros tienen horas fuera de lo esperado este mes"
**Link:** "Revisar" → navega a `/admin/registros`

---

## CAMBIO 4 — Pantalla de empleados: mostrar jornada en el perfil

En el modal de crear/editar empleado, el campo de jornada debe mostrar claramente
que es el límite usado para detectar anomalías:

- Label: "Jornada laboral"
- Placeholder: "Ej: 8 (horas por día)"
- Texto de ayuda debajo: "Se usará para detectar registros con horas inusuales."
- Si se deja vacío, se usa el valor global de la empresa

---

## LO QUE HAY QUE ELIMINAR

- La sección "dividir en dos registros" del modal de edición (ya no aplica)
- Cualquier referencia a lógica cross-day en el código

## LO QUE NO HAY QUE TOCAR

- La tabla de registros y sus columnas
- El filtro de fechas
- La pantalla de fichaje
- La pantalla de reportes
- Las columnas `sospechoso` y `motivo_sospecha` (siguen existiendo, solo cambia cuándo se activan)