-- Estructura interna del colegio: áreas, responsables y cargos.
-- No crea registros de ejemplo ni modifica los roles de acceso al portal.

begin;

create table public.areas_institucionales (
  id bigint generated always as identity primary key,
  nombre text not null,
  descripcion text,
  responsable_id uuid references public.perfiles(id) on delete set null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint areas_institucionales_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 80),
  constraint areas_institucionales_descripcion_valida check (descripcion is null or char_length(btrim(descripcion)) <= 240)
);

create unique index areas_institucionales_nombre_uidx on public.areas_institucionales (lower(btrim(nombre)));
create index areas_institucionales_activas_idx on public.areas_institucionales (activo, nombre);

create table public.cargos_institucionales (
  id bigint generated always as identity primary key,
  area_id bigint not null references public.areas_institucionales(id) on delete restrict,
  nombre text not null,
  perfil_id uuid references public.perfiles(id) on delete set null,
  descripcion text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cargos_institucionales_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 80),
  constraint cargos_institucionales_descripcion_valida check (descripcion is null or char_length(btrim(descripcion)) <= 200)
);

create unique index cargos_institucionales_area_nombre_uidx on public.cargos_institucionales (area_id, lower(btrim(nombre)));
create index cargos_institucionales_area_idx on public.cargos_institucionales (area_id, activo, nombre);
create index cargos_institucionales_perfil_idx on public.cargos_institucionales (perfil_id) where perfil_id is not null;

create trigger areas_institucionales_actualizado_en
before update on public.areas_institucionales
for each row execute function public.establecer_actualizado_en();

create trigger cargos_institucionales_actualizado_en
before update on public.cargos_institucionales
for each row execute function public.establecer_actualizado_en();

alter table public.areas_institucionales enable row level security;
alter table public.cargos_institucionales enable row level security;

create policy "autenticados leen areas institucionales" on public.areas_institucionales
for select to authenticated using (true);
create policy "autenticados leen cargos institucionales" on public.cargos_institucionales
for select to authenticated using (true);
create policy "direccion administra areas institucionales" on public.areas_institucionales
for all to authenticated using ((select public.rol_portal_actual())::text = 'direccion')
with check ((select public.rol_portal_actual())::text = 'direccion');
create policy "direccion administra cargos institucionales" on public.cargos_institucionales
for all to authenticated using ((select public.rol_portal_actual())::text = 'direccion')
with check ((select public.rol_portal_actual())::text = 'direccion');

grant select, insert, update, delete on public.areas_institucionales, public.cargos_institucionales to authenticated;
grant usage, select on sequence public.areas_institucionales_id_seq, public.cargos_institucionales_id_seq to authenticated;

create or replace function public.guardar_area_institucional(
  area_id_solicitada bigint,
  nombre_solicitado text,
  descripcion_solicitada text,
  responsable_id_solicitado uuid,
  activo_solicitado boolean
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar la estructura institucional.' using errcode = '42501';
  end if;
  if btrim(coalesce(nombre_solicitado, '')) = '' then
    raise exception 'Escribe el nombre del área.' using errcode = '22023';
  end if;
  if responsable_id_solicitado is not null and not exists (
    select 1 from public.perfiles
    where id = responsable_id_solicitado and activo
      and rol::text in ('direccion', 'coordinador_academico', 'administrativo', 'docente')
  ) then
    raise exception 'El responsable seleccionado no está disponible.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.areas_institucionales
    where lower(btrim(nombre)) = lower(btrim(nombre_solicitado))
      and id <> coalesce(area_id_solicitada, 0)
  ) then
    raise exception 'Ya existe un área con ese nombre.' using errcode = '23505';
  end if;

  if area_id_solicitada is null then
    insert into public.areas_institucionales (nombre, descripcion, responsable_id, activo)
    values (btrim(nombre_solicitado), nullif(btrim(descripcion_solicitada), ''), responsable_id_solicitado, coalesce(activo_solicitado, true))
    returning id into resultado;
  else
    update public.areas_institucionales
    set nombre = btrim(nombre_solicitado), descripcion = nullif(btrim(descripcion_solicitada), ''),
        responsable_id = responsable_id_solicitado, activo = coalesce(activo_solicitado, true)
    where id = area_id_solicitada returning id into resultado;
  end if;
  if resultado is null then raise exception 'El área ya no existe.' using errcode = '22023'; end if;
  return resultado;
end; $$;

create or replace function public.guardar_cargo_institucional(
  cargo_id_solicitado bigint,
  area_id_solicitada bigint,
  nombre_solicitado text,
  perfil_id_solicitado uuid,
  descripcion_solicitada text,
  activo_solicitado boolean
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los cargos institucionales.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.areas_institucionales where id = area_id_solicitada) then
    raise exception 'Selecciona un área disponible.' using errcode = '22023';
  end if;
  if btrim(coalesce(nombre_solicitado, '')) = '' then
    raise exception 'Escribe el nombre del cargo.' using errcode = '22023';
  end if;
  if perfil_id_solicitado is not null and not exists (
    select 1 from public.perfiles
    where id = perfil_id_solicitado and activo
      and rol::text in ('direccion', 'coordinador_academico', 'administrativo', 'docente')
  ) then
    raise exception 'La persona seleccionada no está disponible.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.cargos_institucionales
    where area_id = area_id_solicitada and lower(btrim(nombre)) = lower(btrim(nombre_solicitado))
      and id <> coalesce(cargo_id_solicitado, 0)
  ) then
    raise exception 'Este cargo ya existe dentro del área.' using errcode = '23505';
  end if;

  if cargo_id_solicitado is null then
    insert into public.cargos_institucionales (area_id, nombre, perfil_id, descripcion, activo)
    values (area_id_solicitada, btrim(nombre_solicitado), perfil_id_solicitado, nullif(btrim(descripcion_solicitada), ''), coalesce(activo_solicitado, true))
    returning id into resultado;
  else
    update public.cargos_institucionales
    set area_id = area_id_solicitada, nombre = btrim(nombre_solicitado), perfil_id = perfil_id_solicitado,
        descripcion = nullif(btrim(descripcion_solicitada), ''), activo = coalesce(activo_solicitado, true)
    where id = cargo_id_solicitado returning id into resultado;
  end if;
  if resultado is null then raise exception 'El cargo ya no existe.' using errcode = '22023'; end if;
  return resultado;
end; $$;

create or replace function public.eliminar_area_institucional(area_id_solicitada bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then raise exception 'Solo Dirección puede eliminar áreas.' using errcode = '42501'; end if;
  if exists (select 1 from public.cargos_institucionales where area_id = area_id_solicitada) then
    raise exception 'Primero elimina los cargos vinculados a esta área.' using errcode = '23503';
  end if;
  delete from public.areas_institucionales where id = area_id_solicitada;
end; $$;

create or replace function public.eliminar_cargo_institucional(cargo_id_solicitado bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then raise exception 'Solo Dirección puede eliminar cargos.' using errcode = '42501'; end if;
  delete from public.cargos_institucionales where id = cargo_id_solicitado;
end; $$;

revoke all on function public.guardar_area_institucional(bigint, text, text, uuid, boolean),
  public.guardar_cargo_institucional(bigint, bigint, text, uuid, text, boolean),
  public.eliminar_area_institucional(bigint), public.eliminar_cargo_institucional(bigint)
from public, anon;
grant execute on function public.guardar_area_institucional(bigint, text, text, uuid, boolean),
  public.guardar_cargo_institucional(bigint, bigint, text, uuid, text, boolean),
  public.eliminar_area_institucional(bigint), public.eliminar_cargo_institucional(bigint)
to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.areas_institucionales, public.cargos_institucionales;
  end if;
exception when duplicate_object then null;
end $$;

commit;
