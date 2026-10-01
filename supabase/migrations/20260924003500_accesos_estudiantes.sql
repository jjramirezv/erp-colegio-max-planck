begin;
-- Trazabilidad de cargas de estudiantes y accesos separados de Usuarios.
-- Las claves nunca se guardan: solo quién, cuándo y con qué resultado.

create table public.importaciones_estudiantes (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete restrict,
  seccion_id bigint references public.secciones(id) on delete set null,
  archivo text not null check (char_length(archivo) between 1 and 255),
  total integer not null check (total between 1 and 3000),
  cuentas_nuevas integer not null default 0,
  cuentas_existentes integer not null default 0,
  errores integer not null default 0,
  realizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index importaciones_estudiantes_creado_en_idx on public.importaciones_estudiantes (creado_en desc);

create table public.importaciones_estudiantes_filas (
  id bigint generated always as identity primary key,
  importacion_id bigint not null references public.importaciones_estudiantes(id) on delete cascade,
  fila integer not null,
  dni text not null,
  nombre text not null,
  correo text not null,
  salon text not null,
  estado text not null check (estado in ('done', 'error')),
  cuenta_nueva boolean not null default false,
  mensaje text not null default '',
  estudiante_id uuid references public.perfiles(id) on delete set null,
  procesado_en timestamptz not null default now(),
  unique (importacion_id, fila)
);

-- Registro de claves regeneradas desde Accesos de estudiantes (sin la clave).
create table public.credenciales_estudiantes_eventos (
  id bigint generated always as identity primary key,
  estudiante_id uuid references public.perfiles(id) on delete cascade,
  correo text not null,
  realizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index credenciales_estudiantes_eventos_estudiante_idx on public.credenciales_estudiantes_eventos (estudiante_id, creado_en desc);

alter table public.importaciones_estudiantes enable row level security;
alter table public.importaciones_estudiantes_filas enable row level security;
alter table public.credenciales_estudiantes_eventos enable row level security;

create policy "gestores consultan cargas de estudiantes" on public.importaciones_estudiantes
  for select to authenticated using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico'));
create policy "gestores consultan filas de cargas" on public.importaciones_estudiantes_filas
  for select to authenticated using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico'));
create policy "gestores consultan claves regeneradas" on public.credenciales_estudiantes_eventos
  for select to authenticated using ((select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico'));

revoke all on table public.importaciones_estudiantes, public.importaciones_estudiantes_filas, public.credenciales_estudiantes_eventos from public, anon, authenticated;
grant select on table public.importaciones_estudiantes, public.importaciones_estudiantes_filas, public.credenciales_estudiantes_eventos to authenticated;
-- Solo la Edge Function escribe el historial.
grant select, insert, update on table public.importaciones_estudiantes, public.importaciones_estudiantes_filas, public.credenciales_estudiantes_eventos to service_role;

-- Lista de accesos de estudiantes. Consulta Auth, por eso solo la usa el servidor.
create or replace function public.listar_accesos_estudiantes(actor uuid, anio bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.perfiles where id = actor and activo and rol in ('direccion', 'coordinador_academico')) then
    raise exception 'Solo Dirección o Coordinación Académica pueden ver los accesos de estudiantes.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.nombre_completo, 'dni', p.dni, 'email', u.email, 'active', p.activo,
      'lastSignInAt', u.last_sign_in_at, 'createdAt', p.creado_en,
      'sectionId', m.seccion_id, 'level', m.nivel, 'grade', m.grado, 'section', m.seccion,
      'credentialsAt', greatest(p.creado_en, (select max(e.creado_en) from public.credenciales_estudiantes_eventos e where e.estudiante_id = p.id))
    ) order by m.nivel nulls last, m.grado nulls last, m.seccion nulls last, p.nombre_completo)
    from public.perfiles p
    join auth.users u on u.id = p.id
    left join lateral (
      select me.seccion_id, n.nombre as nivel, g.nombre as grado, s.nombre as seccion
      from public.matriculas_estudiantes me
      join public.secciones s on s.id = me.seccion_id
      join public.grados g on g.id = s.grado_id
      join public.niveles_educativos n on n.id = g.nivel_id
      where me.estudiante_id = p.id and me.anio_academico_id = anio and me.archivado_en is null and me.estado in ('active', 'completed')
      order by me.id desc limit 1
    ) m on true
    where p.rol = 'estudiante'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.listar_accesos_estudiantes(uuid, bigint) from public, anon, authenticated;
grant execute on function public.listar_accesos_estudiantes(uuid, bigint) to service_role;
commit;
