# WebAuthn de empleados

## Activación

1. Aplicar `supabase/migrations/20261010_employee_webauthn.sql` en el proyecto Supabase. Las tablas nuevas no permiten acceso directo a `anon` ni `authenticated`; las operaciones pasan por la Edge Function con `service_role`.
2. Configurar los secretos de la Edge Function:
   - `WEBAUTHN_ORIGIN`: origen exacto de la PWA, por ejemplo `https://empleados.example.com`, sin barra final ni ruta.
   - `WEBAUTHN_RP_ID`: hostname del mismo sitio, por ejemplo `empleados.example.com`, sin protocolo ni puerto.
3. Volver a desplegar la Edge Function del servidor desde Make settings, incluyendo `webauthn.ts`. El navegador debe acceder al sitio directamente mediante HTTPS, no mediante un iframe de previsualización.
4. La primera vinculación exige una sesión vigente de un administrador de la misma empresa en el celular. Es una medida necesaria porque seleccionar un nombre en el QR público no demuestra identidad. El administrador debe supervisar el registro y cerrar su sesión al terminar. Para autoservicio se necesita implementar una autorización de enrolamiento de un solo uso o autenticación individual de empleados.

## Funcionamiento

- `navigator.credentials.create()` registra una credencial de plataforma con verificación de usuario obligatoria. Supabase guarda su ID, clave pública, contador y transportes; la clave privada permanece en el autenticador.
- `navigator.credentials.get()` firma un desafío nuevo. El servidor valida desafío, origen, RP ID, usuario verificado, firma y contador antes de emitir una autorización de fichaje.
- Los desafíos expiran a los tres minutos y se consumen una sola vez. La autorización de fichaje expira a los 60 segundos y se consume atómicamente en el endpoint de entrada o salida. Las validaciones GPS existentes se mantienen.
- El navegador conserva únicamente el ID de la credencial para seleccionar la llave de ese perfil. No se utilizan los UUID ni las RPC de la implementación simulada anterior.
- Cerrar o cancelar el diálogo cancela la operación pendiente del cliente. Un error nunca genera una autorización válida. Si se interrumpe la red después de guardar un registro, hay que revisar el resultado antes de reintentar.
- El fichaje clásico continúa disponible, sin exigir WebAuthn. Su disponibilidad es deliberada: este cambio no hace obligatoria la biometría para todos los endpoints públicos de asistencia.

## Limitaciones importantes

WebAuthn permite solicitar verificación de usuario, pero no imponer exclusivamente un sensor biométrico. El sistema puede aceptar un PIN o código de desbloqueo. No se capturan ni guardan huellas ni imágenes del rostro.

Para evitar credenciales sincronizadas en otro teléfono, el servidor rechaza credenciales de tipo `multiDevice` o respaldadas. Muchos iPhone y Android modernos ofrecen por defecto passkeys sincronizadas; en esos dispositivos puede no ser posible vincular y se debe usar el fichaje habitual. WebAuthn sin atestación de hardware no garantiza la identidad física de un teléfono: esta política impide las passkeys sincronizadas declaradas por el autenticador, no constituye atestación de hardware.

Mantener estable el dominio: cambiar el RP ID exige un nuevo enrolamiento. Borrar los datos del navegador elimina el ID local y exige recuperación supervisada por el administrador; no restaura automáticamente acceso biométrico.

Los desafíos y autorizaciones vencidos deben purgarse periódicamente en Supabase con una tarea programada que borre filas donde `expires_at < now()`.

## Prueba en un entorno desplegado

1. Registrar con supervisión administrativa y verificar el diálogo nativo y la fila con clave pública.
2. Autenticar, confirmar entrada/salida y verificar asistencia y geovalla.
3. Cancelar el diálogo, usar otro celular o una credencial de otro empleado: no debe habilitarse el fichaje biométrico.
4. Probar desafíos repetidos, firma alterada, origen incorrecto y autorización vencida/reutilizada: el servidor debe rechazarlos.
5. Probar sin red, sin soporte WebAuthn y con passkeys sincronizadas: mostrar error y mantener el fichaje clásico.
