create table public.employee_webauthn_credentials (
  credential_id text primary key,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index employee_webauthn_credentials_employee_idx on public.employee_webauthn_credentials (empleado_id);

create table public.employee_webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  challenge text not null,
  operation text not null check (operation in ('register', 'authenticate')),
  credential_id text,
  admin_id uuid,
  expires_at timestamptz not null default (now() + interval '3 minutes')
);

create table public.employee_webauthn_proofs (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '60 seconds')
);

alter table public.employee_webauthn_credentials enable row level security;
alter table public.employee_webauthn_challenges enable row level security;
alter table public.employee_webauthn_proofs enable row level security;

revoke all on public.employee_webauthn_credentials from anon, authenticated;
revoke all on public.employee_webauthn_challenges from anon, authenticated;
revoke all on public.employee_webauthn_proofs from anon, authenticated;
grant all on public.employee_webauthn_credentials to service_role;
grant all on public.employee_webauthn_challenges to service_role;
grant all on public.employee_webauthn_proofs to service_role;
