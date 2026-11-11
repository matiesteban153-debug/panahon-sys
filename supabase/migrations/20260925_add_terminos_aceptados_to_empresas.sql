-- Terms acceptance is tracked per tenant/company, not per individual admin.
-- Apply this migration before deploying the Terms Wall frontend.
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS terminos_aceptados BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terminos_aceptados_at TIMESTAMPTZ;
