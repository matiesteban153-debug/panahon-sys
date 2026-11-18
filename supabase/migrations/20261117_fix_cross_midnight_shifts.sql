-- =====================================================
-- FIX PANAHON: Soporte de Turnos Nocturnos, Guardias y Cross-Midnight
-- =====================================================

-- 1. Eliminar el tope de 24 horas para permitir guardias médicas, seguridad o turnos extendidos (24h, 36h, 48h)
-- Solo se exige que las horas no sean negativas (horas_totales >= 0).
ALTER TABLE public.registros DROP CONSTRAINT IF EXISTS chk_horas_nonnegative;
ALTER TABLE public.registros ADD CONSTRAINT chk_horas_nonnegative CHECK (horas_totales IS NULL OR horas_totales >= 0);

-- 2. Actualizar 'trg_registros_calc'
-- Si la hora de salida es menor que la de entrada (ej: 01:00 < 18:00),
-- traslada automáticamente la salida al día siguiente (+ 1 día).
CREATE OR REPLACE FUNCTION public.trg_registros_calc()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  vh numeric(10,2);
  horas numeric;
BEGIN
  SELECT valor_hora INTO vh FROM public.empleados WHERE id = NEW.empleado_id;
  NEW.valor_hora_snapshot := COALESCE(vh, 0);

  -- Si la hora de salida es anterior a la entrada, el turno cruzó la medianoche: sumar 1 día
  IF NEW.hora_salida IS NOT NULL AND NEW.hora_salida < NEW.hora_entrada THEN
    NEW.hora_salida := NEW.hora_salida + INTERVAL '1 day';
  END IF;

  -- Recalcular horas totales de forma segura
  horas := calc_hours(NEW.hora_entrada, NEW.hora_salida);
  NEW.horas_totales := horas;

  IF horas IS NOT NULL THEN
    NEW.sueldo_dia := ROUND(horas * NEW.valor_hora_snapshot, 2);
  ELSE
    NEW.sueldo_dia := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 3. Actualizar 'calcular_sueldo_salida'
-- Garantiza que las horas trabajadas sean siempre positivas y contemple
-- turnos que cruzan la medianoche, guardias, feriados y tipos de jornada.
CREATE OR REPLACE FUNCTION public.calcular_sueldo_salida()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_fecha_entrada    date;
  v_es_feriado       boolean;
  v_horas_trabajadas numeric;
  v_valor_hora       numeric;
  v_valor_jornada    numeric;
  v_tipo_jornada     text;
  v_multiplicador    numeric := 1;
BEGIN
  IF NEW.hora_salida IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.hora_salida IS NULL OR OLD.hora_salida <> NEW.hora_salida) THEN

    -- Si la hora de salida es anterior a la entrada, el turno cruzó la medianoche: sumar 1 día
    IF NEW.hora_salida < NEW.hora_entrada THEN
      NEW.hora_salida := NEW.hora_salida + INTERVAL '1 day';
    END IF;

    -- Fecha en zona horaria argentina
    v_fecha_entrada := DATE(timezone('America/Argentina/Buenos_Aires', NEW.hora_entrada));

    -- Verificar si es feriado
    SELECT EXISTS (
      SELECT 1 FROM public.feriados WHERE fecha = v_fecha_entrada
    ) INTO v_es_feriado;

    -- Si es feriado, multiplicar x2
    IF v_es_feriado THEN
      v_multiplicador := 2;
    END IF;

    -- Horas trabajadas (garantizado positivo)
    v_horas_trabajadas := EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_entrada)) / 3600.0;

    -- Obtener tipo de jornada y valores del empleado
    SELECT valor_hora, valor_jornada, tipo_jornada
    INTO v_valor_hora, v_valor_jornada, v_tipo_jornada
    FROM public.empleados
    WHERE id = NEW.empleado_id;

    v_valor_hora    := COALESCE(v_valor_hora, 0);
    v_valor_jornada := COALESCE(v_valor_jornada, 0);

    -- Calcular sueldo según tipo de jornada
    IF v_tipo_jornada IN ('jornada', 'jornal') AND v_valor_jornada > 0 THEN
      -- Por jornada: valor fijo × multiplicador (feriado = doble jornal)
      NEW.sueldo_dia := v_valor_jornada * v_multiplicador;
    ELSE
      -- Por hora: horas × valor hora × multiplicador
      NEW.sueldo_dia := ROUND(v_horas_trabajadas * v_valor_hora * v_multiplicador, 2);
    END IF;

    -- Actualizar horas_totales redondeadas
    NEW.horas_totales := ROUND(v_horas_trabajadas, 2);

  END IF;

  RETURN NEW;
END;
$$;
