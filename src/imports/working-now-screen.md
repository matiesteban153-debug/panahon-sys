Contexto del producto

Estoy desarrollando Panahon, una aplicación SaaS de control horario para empleados.
Los empleados fichan su entrada y salida mediante un QR del local.

El sistema funciona con registros abiertos:

Cuando un empleado ficha entrada, se crea un registro con hora_entrada y hora_salida = NULL.

Cuando ficha salida, se completa hora_salida y se calculan horas_totales.

Esto permite turnos que cruzan medianoche.

Nueva funcionalidad a implementar

Agregar una pantalla en el panel de administración llamada:

"Quién está trabajando ahora"

El objetivo es que el dueño del negocio pueda ver qué empleados están actualmente en jornada laboral.

Lógica de datos

Un empleado está trabajando ahora si existe un registro en la tabla registros donde:

hora_salida IS NULL

Es decir, tiene un registro abierto.

Datos a mostrar:

nombre_completo (empleado)

hora_entrada

tiempo trabajado desde la entrada

UI esperada

Crear una nueva sección en el dashboard:

Menú lateral

Dashboard
Empleados
Registros
Trabajando ahora   ← nueva sección
Reportes
Configuración
Pantalla: "Trabajando ahora"

Mostrar una lista simple de empleados actualmente en jornada.

Cada item debe mostrar:

Nombre del empleado

Debajo:

Entró a las: 18:05
Trabajando hace: 2h 15m

Indicador visual:

🟢 punto verde → empleado activo

Cabecera de la pantalla

Título:

👥 Empleados trabajando ahora

Subtítulo:

Personas actualmente en jornada laboral

Mostrar contador:

3 empleados trabajando
Estados vacíos

Si no hay empleados trabajando mostrar:

No hay empleados trabajando en este momento

con icono neutral.

Opcional (si es simple)

Agregar alerta visual si alguien lleva:

más de 8 horas trabajando → amarillo

más de 12 horas trabajando → rojo

Consideraciones UX

La pantalla debe ser:

muy simple

fácil de leer desde el celular

tipo lista

optimizada para dueños de locales

Resultado esperado

Un nuevo flujo en el dashboard donde el dueño pueda:

entrar a Trabajando ahora

ver en tiempo real qué empleados están trabajando

saber desde qué hora están en el turno