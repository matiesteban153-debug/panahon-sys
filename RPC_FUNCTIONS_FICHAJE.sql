-- =====================================================
-- PANAHON - Funciones RPC para Sistema de Fichaje
-- Sistema de "Registros Abiertos" (permite turnos que crucen medianoche)
-- =====================================================

-- 1. Función: get_empleados_por_qr
-- Devuelve la lista de empleados activos para un QR token específico
DROP FUNCTION IF EXISTS public.get_empleados_por_qr(UUID);

CREATE OR REPLACE FUNCTION public.get_empleados_por_qr(p_qr_token UUID)
RETURNS TABLE(
  id UUID,
  nombre_completo TEXT,
  activo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.nombre_completo,
    e.activo
  FROM public.empleados e
  INNER JOIN public.empresas emp ON e.empresa_id = emp.id
  WHERE emp.qr_token = p_qr_token
    AND e.activo = true
    AND e.deleted_at IS NULL
  ORDER BY e.nombre_completo;
END;
$$;

COMMENT ON FUNCTION public.get_empleados_por_qr IS 'Obtiene empleados activos para fichaje mediante QR token';

-- =====================================================

-- 2. Función: get_estado_empleado (NUEVA LÓGICA)
-- Verifica si el empleado tiene un registro abierto (hora_salida IS NULL)
DROP FUNCTION IF EXISTS public.get_estado_empleado(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_estado_empleado_hoy(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_estado_empleado(
  p_qr_token UUID,
  p_empleado_id UUID
)
RETURNS TABLE(
  estado TEXT,
  hora_entrada TIMESTAMPTZ,
  horas_abiertas NUMERIC,
  registro_id UUID,
  alerta_18_horas BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_registro RECORD;
  v_horas_transcurridas NUMERIC;
BEGIN
  -- Verificar que el QR token sea válido y obtener empresa_id
  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE qr_token = p_qr_token;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'QR token inválido';
  END IF;

  -- Buscar si existe un registro abierto (hora_salida IS NULL)
  -- Sin importar la fecha
  SELECT 
    r.id,
    r.hora_entrada,
    EXTRACT(EPOCH FROM (NOW() - r.hora_entrada)) / 3600 AS horas_transcurridas
  INTO v_registro
  FROM public.registros r
  WHERE r.empleado_id = p_empleado_id
    AND r.empresa_id = v_empresa_id
    AND r.hora_salida IS NULL
  ORDER BY r.hora_entrada DESC
  LIMIT 1;

  -- Si existe un registro abierto
  IF v_registro.id IS NOT NULL THEN
    v_horas_transcurridas := v_registro.horas_transcurridas;
    
    -- Verificar si supera las 18 horas
    IF v_horas_transcurridas > 18 THEN
      RETURN QUERY SELECT
        'en_jornada'::TEXT,
        v_registro.hora_entrada,
        v_horas_transcurridas,
        v_registro.id,
        true AS alerta_18_horas;
    ELSE
      RETURN QUERY SELECT
        'en_jornada'::TEXT,
        v_registro.hora_entrada,
        v_horas_transcurridas,
        v_registro.id,
        false AS alerta_18_horas;
    END IF;
  ELSE
    -- No hay registro abierto
    RETURN QUERY SELECT
      'sin_fichaje'::TEXT,
      NULL::TIMESTAMPTZ,
      NULL::NUMERIC,
      NULL::UUID,
      false AS alerta_18_horas;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_estado_empleado IS 'Verifica si el empleado tiene un registro abierto (sin importar el día)';

-- =====================================================

-- 3. Función: fichar_entrada (NUEVA LÓGICA)
-- Crea un nuevo registro con hora_entrada = NOW() y hora_salida = NULL
DROP FUNCTION IF EXISTS public.fichar_entrada(UUID, UUID);

CREATE OR REPLACE FUNCTION public.fichar_entrada(
  p_qr_token UUID,
  p_empleado_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_registro_abierto UUID;
  v_hora_entrada TIMESTAMPTZ;
  v_fecha_actual DATE;
BEGIN
  -- Verificar que el QR token sea válido y obtener empresa_id
  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE qr_token = p_qr_token;

  IF v_empresa_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'QR token inválido'
    );
  END IF;

  -- Verificar que NO exista un registro abierto
  SELECT id INTO v_registro_abierto
  FROM public.registros
  WHERE empleado_id = p_empleado_id
    AND empresa_id = v_empresa_id
    AND hora_salida IS NULL
  LIMIT 1;

  IF v_registro_abierto IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ya tenés un registro abierto. Primero marca la salida.'
    );
  END IF;

  -- Crear nuevo registro de entrada
  v_hora_entrada := NOW();
  v_fecha_actual := v_hora_entrada::DATE;

  INSERT INTO public.registros (
    empresa_id,
    empleado_id,
    fecha,
    hora_entrada,
    hora_salida,
    horas_totales,
    editado_manual
  ) VALUES (
    v_empresa_id,
    p_empleado_id,
    v_fecha_actual,
    v_hora_entrada,
    NULL,
    NULL,
    false
  );

  RETURN json_build_object(
    'success', true,
    'hora', v_hora_entrada
  );
END;
$$;

COMMENT ON FUNCTION public.fichar_entrada IS 'Registra entrada del empleado (crea registro abierto)';

-- =====================================================

-- 4. Función: fichar_salida (NUEVA LÓGICA)
-- Completa el registro abierto con hora_salida = NOW() y calcula las horas trabajadas
DROP FUNCTION IF EXISTS public.fichar_salida(UUID, UUID);

CREATE OR REPLACE FUNCTION public.fichar_salida(
  p_qr_token UUID,
  p_empleado_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_registro_id UUID;
  v_hora_entrada TIMESTAMPTZ;
  v_hora_salida TIMESTAMPTZ;
  v_horas_trabajadas NUMERIC;
BEGIN
  -- Verificar que el QR token sea válido y obtener empresa_id
  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE qr_token = p_qr_token;

  IF v_empresa_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'QR token inválido'
    );
  END IF;

  -- Buscar el registro abierto (hora_salida IS NULL)
  SELECT id, hora_entrada
  INTO v_registro_id, v_hora_entrada
  FROM public.registros
  WHERE empleado_id = p_empleado_id
    AND empresa_id = v_empresa_id
    AND hora_salida IS NULL
  ORDER BY hora_entrada DESC
  LIMIT 1;

  IF v_registro_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No tenés un registro de entrada abierto.'
    );
  END IF;

  -- Registrar hora de salida
  v_hora_salida := NOW();

  -- Calcular horas trabajadas (diferencia en horas decimales)
  v_horas_trabajadas := EXTRACT(EPOCH FROM (v_hora_salida - v_hora_entrada)) / 3600;

  -- Actualizar el registro
  UPDATE public.registros
  SET 
    hora_salida = v_hora_salida,
    horas_totales = v_horas_trabajadas
  WHERE id = v_registro_id;

  RETURN json_build_object(
    'success', true,
    'hora', v_hora_salida,
    'horas_trabajadas', v_horas_trabajadas
  );
END;
$$;

COMMENT ON FUNCTION public.fichar_salida IS 'Registra salida del empleado (cierra registro abierto)';

-- =====================================================

-- 5. Función auxiliar: cerrar_registros_antiguos (NUEVA)
-- Función administrativa para cerrar registros abiertos que superen las 18 horas
DROP FUNCTION IF EXISTS public.cerrar_registros_antiguos(UUID);

CREATE OR REPLACE FUNCTION public.cerrar_registros_antiguos(p_empresa_id UUID)
RETURNS TABLE(
  registros_cerrados INTEGER,
  detalles JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registros_antiguos RECORD;
  v_contador INTEGER := 0;
  v_detalles JSON[] := ARRAY[]::JSON[];
BEGIN
  -- Buscar registros abiertos con más de 18 horas
  FOR v_registros_antiguos IN
    SELECT 
      r.id,
      r.empleado_id,
      r.hora_entrada,
      e.nombre_completo,
      EXTRACT(EPOCH FROM (NOW() - r.hora_entrada)) / 3600 AS horas_transcurridas
    FROM public.registros r
    INNER JOIN public.empleados e ON r.empleado_id = e.id
    WHERE r.empresa_id = p_empresa_id
      AND r.hora_salida IS NULL
      AND EXTRACT(EPOCH FROM (NOW() - r.hora_entrada)) / 3600 > 18
  LOOP
    -- Cerrar el registro con hora de salida automática
    -- Nota: Esto marca el registro como editado_manual para que el admin lo revise
    UPDATE public.registros
    SET 
      hora_salida = hora_entrada + INTERVAL '8 hours',
      horas_totales = 8,
      editado_manual = true,
      nota_interna = 'Cerrado automáticamente por superar 18 horas sin salida'
    WHERE id = v_registros_antiguos.id;

    v_contador := v_contador + 1;
    v_detalles := array_append(v_detalles, json_build_object(
      'empleado', v_registros_antiguos.nombre_completo,
      'hora_entrada', v_registros_antiguos.hora_entrada,
      'horas_transcurridas', v_registros_antiguos.horas_transcurridas
    ));
  END LOOP;

  RETURN QUERY SELECT v_contador, array_to_json(v_detalles);
END;
$$;

COMMENT ON FUNCTION public.cerrar_registros_antiguos IS 'Cierra automáticamente registros abiertos con más de 18 horas (admin)';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
-- 
-- INSTRUCCIONES:
-- 1. Copia y pega este archivo completo en el SQL Editor de Supabase
-- 2. Ejecuta el script (Run)
-- 3. Verifica que no haya errores
-- 4. Las funciones estarán listas para usar desde el frontend
-- 
-- NOTA: No es necesario modificar el código del frontend, 
-- las funciones mantienen la misma firma y estructura de respuesta.