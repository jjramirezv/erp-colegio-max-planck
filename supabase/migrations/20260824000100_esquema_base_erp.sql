-- 01 · Esquema base del ERP del Colegio Max Planck.
-- Las contraseñas pertenecen exclusivamente a auth.users de Supabase.
create type public.rol_portal as enum (
  'direccion',
  'coordinador_academico',
  'administrativo',
  'docente',
  'estudiante',
  'familia'
);
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol public.rol_portal not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index perfiles_rol_activo_idx on public.perfiles (rol, activo);
alter table public.perfiles enable row level security;
create or replace function public.rol_portal_actual() returns public.rol_portal
language sql stable security definer set search_path = ''
as $$ select rol from public.perfiles where id = auth.uid() and activo; $$;

create or replace function public.proteger_identidad_perfil()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'El identificador del perfil no puede modificarse.';
  end if;

  if new.creado_en is distinct from old.creado_en then
    raise exception 'La fecha de creacion del perfil no puede modificarse.';
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

create trigger perfiles_proteger_identidad
before update on public.perfiles
for each row execute function public.proteger_identidad_perfil();

create policy "usuarios leen su propio perfil" on public.perfiles for select to authenticated using (id = (select auth.uid()));
create policy "direccion lee todos los perfiles" on public.perfiles for select to authenticated using ((select public.rol_portal_actual()) = 'direccion');
create policy "direccion actualiza perfiles" on public.perfiles for update to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');
-- Crear/eliminar auth.users únicamente desde una Edge Function con service_role.

-- Área 1: configuración institucional. La interfaz usa localStorage durante la
-- demostración; estas tablas permiten conectarla sin cambiar el diseño.
create table public.configuracion_institucional (
  id smallint primary key default 1 check (id = 1),
  razon_social text not null,
  nombre_corto text not null,
  codigo_modular text,
  ruc text,
  direccion text,
  telefono text,
  correo text,
  zona_horaria text not null default 'America/Lima',
  idioma text not null default 'es-PE',
  escala_evaluacion text not null default '0-20',
  nota_aprobatoria numeric(4,2) default 11,
  parametros_sistema jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now()
);
alter table public.configuracion_institucional enable row level security;
create policy "autenticados leen configuracion institucional" on public.configuracion_institucional for select to authenticated using (true);
create policy "direccion inserta configuracion institucional" on public.configuracion_institucional for insert to authenticated with check ((select public.rol_portal_actual()) = 'direccion');
create policy "direccion actualiza configuracion institucional" on public.configuracion_institucional for update to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');

create table public.anios_academicos (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  inicia_en date not null,
  termina_en date not null,
  sistema_periodos text not null check (sistema_periodos in ('bimestres', 'trimestres', 'semestres')),
  activo boolean not null default false,
  creado_en timestamptz not null default now()
);
create table public.niveles_educativos (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  orden smallint not null,
  activo boolean not null default true
);
create table public.grados (
  id bigint generated always as identity primary key,
  nivel_id bigint not null references public.niveles_educativos(id) on delete restrict,
  nombre text not null,
  orden smallint not null,
  unique (nivel_id, nombre)
);
create table public.secciones (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete restrict,
  grado_id bigint not null references public.grados(id) on delete restrict,
  nombre text not null,
  turno text not null check (turno in ('mañana', 'tarde')),
  capacidad smallint check (capacidad > 0),
  activo boolean not null default true,
  unique (anio_academico_id, grado_id, nombre)
);
alter table public.anios_academicos enable row level security;
alter table public.niveles_educativos enable row level security;
alter table public.grados enable row level security;
alter table public.secciones enable row level security;
create policy "autenticados leen anios academicos" on public.anios_academicos for select to authenticated using (true);
create policy "autenticados leen niveles educativos" on public.niveles_educativos for select to authenticated using (true);
create policy "autenticados leen grados" on public.grados for select to authenticated using (true);
create policy "autenticados leen secciones" on public.secciones for select to authenticated using (true);
create policy "direccion administra anios academicos" on public.anios_academicos for all to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');
create policy "direccion administra niveles educativos" on public.niveles_educativos for all to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');
create policy "direccion administra grados" on public.grados for all to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');
create policy "direccion administra secciones" on public.secciones for all to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');

create table public.permisos_modulo_rol (
  rol public.rol_portal not null,
  clave_modulo text not null,
  habilitado boolean not null default true,
  actualizado_en timestamptz not null default now(),
  primary key (rol, clave_modulo)
);
alter table public.permisos_modulo_rol enable row level security;
create policy "autenticados leen permisos de rol" on public.permisos_modulo_rol for select to authenticated using (true);
create policy "direccion administra permisos de rol" on public.permisos_modulo_rol for all to authenticated using ((select public.rol_portal_actual()) = 'direccion') with check ((select public.rol_portal_actual()) = 'direccion');

-- Privilegios explicitos: RLS decide las filas visibles y estos GRANT limitan
-- las operaciones disponibles para cada sesion autenticada.
revoke all on table
  public.perfiles,
  public.configuracion_institucional,
  public.anios_academicos,
  public.niveles_educativos,
  public.grados,
  public.secciones,
  public.permisos_modulo_rol
from public, anon, authenticated;

grant select on table public.perfiles to authenticated;
grant update (nombre_completo, rol, activo) on table public.perfiles to authenticated;
grant select, insert, update on table public.configuracion_institucional to authenticated;
grant select, insert, update, delete on table
  public.anios_academicos,
  public.niveles_educativos,
  public.grados,
  public.secciones,
  public.permisos_modulo_rol
to authenticated;

revoke all on sequence
  public.anios_academicos_id_seq,
  public.niveles_educativos_id_seq,
  public.grados_id_seq,
  public.secciones_id_seq
from public, anon, authenticated;

grant usage, select on sequence
  public.anios_academicos_id_seq,
  public.niveles_educativos_id_seq,
  public.grados_id_seq,
  public.secciones_id_seq
to authenticated;

revoke all on function public.rol_portal_actual() from public, anon, authenticated;
revoke all on function public.proteger_identidad_perfil() from public, anon, authenticated;
grant execute on function public.rol_portal_actual() to authenticated;
