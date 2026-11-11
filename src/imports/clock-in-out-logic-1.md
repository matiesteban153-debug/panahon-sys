Quiero modificar la lógica del sistema de fichaje.

Actualmente el sistema determina si un empleado puede marcar entrada o salida en función del día calendario (registro del día actual). Esto está generando un problema cuando los turnos terminan después de las 00:00, porque al cambiar la fecha el sistema ya no permite marcar salida y solo muestra la opción de ingreso.

Necesitamos cambiar la lógica para que el sistema funcione con el concepto de "registro abierto" en lugar de "registro por día".

Nueva lógica requerida:

El sistema debe verificar si existe un registro abierto para el empleado.

Un registro abierto es aquel donde:

employee_id = empleado actual

clock_out IS NULL

Si existe un registro abierto:

Mostrar botón "Marcar salida"

Al marcar salida, completar el campo clock_out con timestamp actual

Si NO existe registro abierto:

Mostrar botón "Marcar ingreso"

Crear nuevo registro con:

clock_in = timestamp actual

clock_out = NULL

Condiciones importantes:

No se debe validar por fecha actual.

No se debe limitar el registro al día calendario.

El sistema debe permitir entradas antes de medianoche y salidas después de medianoche sin errores.

El cálculo de horas debe hacerse como diferencia entre clock_out y clock_in, sin importar si cambia el día.

Casos que deben funcionar correctamente:

Entrada 18:00 → Salida 01:30

Entrada 23:50 → Salida 00:20

Entrada 22:00 → Salida 22:00 del día siguiente (si ocurriera)

Verificar que:

Solo pueda existir un registro abierto por empleado.

No se pueda marcar ingreso si ya hay un registro abierto.

No se pueda marcar salida si no existe registro abierto.

No modificar la estructura de datos si ya usa timestamps completos (fecha + hora). Solo ajustar la lógica de validación y decisión de UI.

Además, agregar validación para impedir que un registro abierto supere 18 horas sin revisión administrativa, para evitar fichajes olvidados o errores.