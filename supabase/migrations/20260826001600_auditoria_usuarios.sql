-- Registro administrativo de la gestión de credenciales del portal.
-- No crea usuarios ni datos de demostración.

begin;

create table if not exists public.auditoria_usuarios (
  id bigint generated always as identity primary key,
  accion text not null check (accion in ('crear', 'actualizar', 'eliminar')),
  usuario_objetivo_id uuid,
  usuario_objetivo_correo text,
  realizado_por uuid references public.perfiles(id) on delete set null,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists auditoria_usuarios_creado_en_idx
  on public.auditoria_usuarios (creado_en desc);

alter table public.auditoria_usuarios enable row level security;

drop policy if exists "direccion consulta auditoria de usuarios" on public.auditoria_usuarios;
create policy "direccion consulta auditoria de usuarios"
on public.auditoria_usuarios for select to authenticated
using ((select public.rol_portal_actual())::text = 'direccion');

revoke all on table public.auditoria_usuarios from public, anon, authenticated;
grant select on table public.auditoria_usuarios to authenticated;

commit;
