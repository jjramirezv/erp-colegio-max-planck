-- Marca institucional compartida entre el ERP y la landing.
-- Solo expone nombre visible, logo y fecha de actualización.

begin;

alter table public.configuracion_institucional
  add column if not exists nombre_publico text;

alter table public.configuracion_institucional
  drop constraint if exists configuracion_nombre_publico_no_vacio,
  add constraint configuracion_nombre_publico_no_vacio
    check (nombre_publico is null or btrim(nombre_publico) <> '');

create or replace function public.obtener_marca_institucional()
returns table (
  nombre_publico text,
  logo_path text,
  actualizado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      nullif(btrim(configuracion.nombre_publico), ''),
      nullif(btrim(configuracion.nombre_corto), ''),
      nullif(btrim(configuracion.razon_social), '')
    ),
    configuracion.logo_path,
    configuracion.actualizado_en
  from public.configuracion_institucional configuracion
  where configuracion.id = 1;
$$;

create or replace function public.guardar_marca_institucional(
  nombre_publico_solicitado text,
  logo_path_solicitado text
)
returns table (
  nombre_publico text,
  logo_path text,
  actualizado_en timestamptz
)
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  nombre_limpio text := btrim(nombre_publico_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede modificar la marca institucional.' using errcode = '42501';
  end if;

  if nombre_limpio = '' or char_length(nombre_limpio) > 120 then
    raise exception 'El nombre visible debe contener entre 1 y 120 caracteres.' using errcode = '22023';
  end if;

  insert into public.configuracion_institucional (
    id,
    razon_social,
    nombre_corto,
    nombre_publico,
    logo_path,
    actualizado_por
  ) values (
    1,
    nombre_limpio,
    nombre_limpio,
    nombre_limpio,
    nullif(btrim(logo_path_solicitado), ''),
    auth.uid()
  )
  on conflict (id) do update
  set nombre_publico = excluded.nombre_publico,
      logo_path = excluded.logo_path,
      actualizado_por = auth.uid();

  return query
  select
    configuracion.nombre_publico,
    configuracion.logo_path,
    configuracion.actualizado_en
  from public.configuracion_institucional configuracion
  where configuracion.id = 1;
end;
$$;

revoke all on function public.obtener_marca_institucional() from public;
grant execute on function public.obtener_marca_institucional() to anon, authenticated;

revoke all on function public.guardar_marca_institucional(text, text) from public, anon;
grant execute on function public.guardar_marca_institucional(text, text) to authenticated;

commit;
