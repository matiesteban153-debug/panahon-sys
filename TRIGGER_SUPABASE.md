# SQL: Trigger para creación automática de empresa y perfil admin

Este trigger se ejecuta automáticamente cuando un usuario se registra via `auth.signUp()`.

## Instrucciones de instalación

1. Ve al **SQL Editor** en el Dashboard de Supabase
2. Copia y ejecuta el siguiente código SQL
3. Verifica que no haya errores en la consola

---

## SQL del Trigger

```sql
-- Función que se ejecuta después de crear un nuevo usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_empresa_id UUID;
  new_qr_token UUID;
BEGIN
  -- Generar IDs únicos
  new_empresa_id := gen_random_uuid();
  new_qr_token := gen_random_uuid();
  
  -- Crear empresa
  INSERT INTO public.empresas (
    id,
    nombre,
    rubro,
    email_contacto,
    qr_token,
    plan,
    plan_activo,
    valor_hora_default,
    jornada_default,
    created_at
  ) VALUES (
    new_empresa_id,
    COALESCE(NEW.raw_user_meta_data->>'empresa_nombre', 'Mi Empresa'),
    COALESCE(NEW.raw_user_meta_data->>'rubro', 'Servicios'),
    NEW.email,
    new_qr_token,
    'base',
    true,
    COALESCE((NEW.raw_user_meta_data->>'valor_hora_defecto')::integer, 3000),
    8,
    NOW()
  );
  
  -- Crear perfil admin
  INSERT INTO public.perfiles_admin (
    id,
    empresa_id,
    nombre_completo,
    email,
    rol,
    created_at
  ) VALUES (
    NEW.id,
    new_empresa_id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    'admin',
    NOW()
  );
  
  -- Actualizar user_metadata con el empresa_id (opcional pero útil)
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('empresa_id', new_empresa_id)
  WHERE id = NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentario descriptivo
COMMENT ON FUNCTION public.handle_new_user() IS 'Crea automáticamente empresa y perfil admin cuando un usuario se registra';
```

---

## Verificación del Trigger

Después de instalar el trigger, podés verificar que funciona correctamente:

### 1. Ver triggers activos
```sql
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

### 2. Probar el registro
Ve a `/registro` en tu app y crea una cuenta de prueba.

### 3. Verificar datos creados
```sql
-- Ver la última empresa creada
SELECT * FROM empresas ORDER BY created_at DESC LIMIT 1;

-- Ver el último perfil admin creado
SELECT * FROM perfiles_admin ORDER BY created_at DESC LIMIT 1;

-- Ver metadata del último usuario creado
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'nombre_completo' as nombre,
  raw_user_meta_data->>'empresa_nombre' as empresa,
  raw_user_meta_data->>'empresa_id' as empresa_id
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## Troubleshooting

### Error: "permission denied for table empresas"
**Solución:** El trigger necesita permisos de SECURITY DEFINER. Ya está incluido en el código de arriba.

### Error: "empresa_nombre no existe en metadata"
**Solución:** El frontend DEBE enviar ese campo en el signUp. Ya está implementado en `/src/app/lib/auth-context.tsx`.

### El trigger no se ejecuta
**Solución:** 
1. Verifica que el trigger esté creado: `\dS auth.users` en psql
2. Verifica los logs: Ve a **Database → Logs** en Supabase Dashboard
3. Asegúrate de que las tablas `empresas` y `perfiles_admin` existan

### Empresa creada pero perfil admin no
**Solución:** Verifica que la tabla `perfiles_admin` tenga una foreign key a `empresas(id)` con `ON DELETE CASCADE`.

---

## Esquema de tablas requerido

```sql
-- Tabla empresas (debe existir antes del trigger)
CREATE TABLE IF NOT EXISTS public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  rubro TEXT,
  email_contacto TEXT,
  qr_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  plan TEXT DEFAULT 'base',
  plan_activo BOOLEAN DEFAULT true,
  valor_hora_default INTEGER DEFAULT 3000,
  jornada_default INTEGER DEFAULT 8,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla perfiles_admin (debe existir antes del trigger)
CREATE TABLE IF NOT EXISTS public.perfiles_admin (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices recomendados
CREATE INDEX IF NOT EXISTS idx_empresas_qr_token ON public.empresas(qr_token);
CREATE INDEX IF NOT EXISTS idx_perfiles_admin_empresa_id ON public.perfiles_admin(empresa_id);
```

---

## Políticas RLS (Row Level Security)

Si tenés RLS habilitado, necesitás estas políticas:

```sql
-- Política para empresas
CREATE POLICY "Admins pueden ver su propia empresa"
ON public.empresas
FOR SELECT
USING (
  id IN (
    SELECT empresa_id 
    FROM public.perfiles_admin 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Admins pueden actualizar su propia empresa"
ON public.empresas
FOR UPDATE
USING (
  id IN (
    SELECT empresa_id 
    FROM public.perfiles_admin 
    WHERE id = auth.uid()
  )
);

-- Política para perfiles_admin
CREATE POLICY "Admins pueden ver su propio perfil"
ON public.perfiles_admin
FOR SELECT
USING (id = auth.uid());

-- IMPORTANTE: El trigger necesita poder INSERT sin RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_admin ENABLE ROW LEVEL SECURITY;

-- Permitir inserts al trigger (usa SECURITY DEFINER)
CREATE POLICY "Permitir inserts del trigger"
ON public.empresas
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir inserts del trigger"
ON public.perfiles_admin
FOR INSERT
WITH CHECK (true);
```
