# Flujo de Registro y Onboarding - Configuración Supabase

## Configuración necesaria en Supabase

Para que el flujo de registro funcione correctamente, necesitás configurar lo siguiente en el Dashboard de Supabase:

### 1. Email Confirmation Redirect

Ve a: **Authentication → URL Configuration** y configurá:

**Site URL:**
```
https://panahon.figma.site/onboarding
```

**Redirect URLs (whitelisted):**
```
https://panahon.figma.site/onboarding
https://panahon.figma.site/admin
```

### 2. Email Templates (opcional pero recomendado)

Ve a: **Authentication → Email Templates** y personalizá el email de confirmación con tu marca Panahon.

Variables disponibles:
- `{{ .ConfirmationURL }}` - URL de verificación
- `{{ .SiteURL }}` - Tu dominio
- `{{ .Token }}` - Token de confirmación

### 3. Trigger de Database (CRÍTICO)

El trigger `handle_new_user` debe estar configurado para crear automáticamente:
- El registro en la tabla `empresas`
- El registro en la tabla `perfiles_admin`

**El trigger DEBE leer estos campos del user_metadata:**
- `nombre_completo` (requerido)
- `empresa_nombre` (requerido)
- `rubro` (opcional)
- `cantidad_empleados` (opcional)
- `valor_hora_defecto` (opcional)

Si el trigger falla o no existe, el registro no funcionará correctamente.

---

## Flujo completo implementado

### 1. Registro (2 pasos)
- **Ruta:** `/registro`
- **Paso 1:** Datos personales (nombre, email, contraseña)
- **Paso 2:** Datos de empresa (nombre, rubro, empleados, valor hora)
- **Submit:** Ejecuta `supabase.auth.signUp()` con metadata completo

### 2. Verificación de Email
- **Ruta:** `/verificacion-email`
- **Funcionalidad:**
  - Muestra el email al que se envió el link
  - Botón para reenviar (con cooldown de 60 segundos)
  - Opción para cambiar el email
- **Después de verificar:** Supabase redirige a `/onboarding`

### 3. Onboarding
- **Ruta:** `/onboarding`
- **Step 2:** Agregar primer empleado (opcional)
- **Step 3:** Mensaje de bienvenida + referencia al kit físico
- **Auto-skip:** Si el usuario ya tiene empleados, redirige directo al dashboard

### 4. Acceso al QR
- **Ruta:** `/admin/configuracion`
- El QR se genera automáticamente en el backend al crear la empresa
- Se puede visualizar y descargar desde Configuración
- El QR usa el `qr_token` de la empresa (no el ID)

---

## Links actualizados en la Landing

Todos los CTAs ahora apuntan a `/registro`:
- Navbar → "Empezar gratis"
- Hero Section → "Empezar gratis"
- Pricing → Todos los botones "Empezar"
- CTA Final → "Crear cuenta gratis"

Los links de "Iniciar sesión" apuntan a `/admin/login`.

---

## Rutas agregadas

```typescript
/registro                  → RegistroPage (2 pasos)
/verificacion-email        → VerificacionEmailPage
/onboarding                → OnboardingPage (stepper)
```

---

## Manejo de errores

El flujo maneja estos casos:
- Email ya registrado → Muestra link a login
- Contraseñas no coinciden → Validación inline
- Contraseña muy corta (< 8 chars) → Validación inline
- Campos faltantes → Validación inline
- Error de red → Mensaje genérico
- Trigger fallido → Mensaje de error con contexto

---

## Pendiente para producción

1. **Configurar email server en Supabase** (actualmente auto-confirma emails)
2. **Personalizar templates de email** con branding de Panahon
3. **Configurar Site URL** en Supabase Auth settings
4. **Verificar que el trigger `handle_new_user` esté funcionando** correctamente
5. **Opcional:** Configurar OAuth (Google, etc.) para registro social
