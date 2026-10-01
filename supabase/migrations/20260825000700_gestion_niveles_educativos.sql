-- Gestión real de los niveles educativos de la institución.
-- No crea niveles ni registros de demostración.

begin;

alter table public.niveles_educativos
  add column if not exists creado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists creado_en timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

alter table public.niveles_educativos
  drop constraint if exists niveles_educativos_nombre_no_vacio,
  add constraint niveles_educativos_nombre_no_vacio
    check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 60),
  drop constraint if exists niveles_educativos_orden_positivo,
  add constraint niveles_educativos_orden_positivo
    check (orden > 0);

create index if not exists niveles_educativos_orden_nombre_idx
  on public.niveles_educativos (orden, nombre);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'niveles_educativos_actualizado'
      and tgrelid = 'public.niveles_educativos'::regclass
  ) then
    create trigger niveles_educativos_actualizado
    before update on public.niveles_educativos
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

create or replace function public.guardar_nivel_educativo(
  nivel_id_solicitado bigint,
  nombre_solicitado text,
  orden_solicitado smallint,
  alcance_material_solicitado text,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  nivel_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los niveles educativos.' using errcode = '42501';
  end if;

  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 60 then
    raise exception 'El nombre debe contener entre 1 y 60 caracteres.' using errcode = '22023';
  end if;
  if orden_solicitado is null or orden_solicitado <= 0 then
    raise exception 'El orden de presentación debe ser mayor que cero.' using errcode = '22023';
  end if;
  if alcance_material_solicitado not in ('section', 'course') then
    raise exception 'La distribución de materiales no es válida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.niveles_educativos
    where lower(btrim(nombre)) = lower(nombre_limpio)
      and id is distinct from nivel_id_solicitado
  ) then
    raise exception 'Ya existe un nivel educativo con ese nombre.' using errcode = '23505';
  end if;

  if nivel_id_solicitado is null then
    insert into public.niveles_educativos (
      nombre, orden, alcance_material, activo, creado_por, actualizado_por
    ) values (
      nombre_limpio, orden_solicitado, alcance_material_solicitado,
      coalesce(activo_solicitado, true), auth.uid(), auth.uid()
    ) returning id into nivel_id_resultado;
  else
    update public.niveles_educativos
    set nombre = nombre_limpio,
        orden = orden_solicitado,
        alcance_material = alcance_material_solicitado,
        activo = coalesce(activo_solicitado, true),
        actualizado_por = auth.uid()
    where id = nivel_id_solicitado
    returning id into nivel_id_resultado;

    if nivel_id_resultado is null then
      raise exception 'El nivel educativo no existe.' using errcode = '22023';
    end if;
  end if;

  return nivel_id_resultado;
end;
$$;

create or replace function public.eliminar_nivel_educativo(nivel_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar niveles educativos.' using errcode = '42501';
  end if;

  if exists (select 1 from public.grados where nivel_id = nivel_id_solicitado) then
    raise exception 'No se puede eliminar un nivel que ya tiene grados asociados.' using errcode = '23503';
  end if;

  delete from public.niveles_educativos where id = nivel_id_solicitado;
  if not found then
    raise exception 'El nivel educativo no existe.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.guardar_nivel_educativo(bigint, text, smallint, text, boolean) from public, anon;
revoke all on function public.eliminar_nivel_educativo(bigint) from public, anon;
grant execute on function public.guardar_nivel_educativo(bigint, text, smallint, text, boolean) to authenticated;
grant execute on function public.eliminar_nivel_educativo(bigint) to authenticated;

commit;
