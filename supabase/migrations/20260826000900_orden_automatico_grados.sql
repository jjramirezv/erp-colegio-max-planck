-- Simplifica la gestión de grados: el orden se calcula internamente.
-- No inserta datos ni modifica los grados existentes.

begin;

create or replace function public.guardar_grado(
  grado_id_solicitado bigint,
  nivel_id_solicitado bigint,
  nombre_solicitado text,
  orden_solicitado smallint,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  grado_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
  nivel_actual bigint;
  orden_calculado smallint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los grados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.niveles_educativos where id = nivel_id_solicitado) then
    raise exception 'Selecciona un nivel educativo válido.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 40 then
    raise exception 'El nombre del grado debe contener entre 1 y 40 caracteres.' using errcode = '22023';
  end if;

  if grado_id_solicitado is null then
    select (coalesce(max(orden), 0) + 1)::smallint
      into orden_calculado
      from public.grados
     where nivel_id = nivel_id_solicitado;

    insert into public.grados (nivel_id, nombre, orden, activo, creado_por, actualizado_por)
    values (nivel_id_solicitado, nombre_limpio, orden_calculado, coalesce(activo_solicitado, true), auth.uid(), auth.uid())
    returning id into grado_id_resultado;
  else
    select nivel_id into nivel_actual from public.grados where id = grado_id_solicitado;
    if nivel_actual is null then
      raise exception 'El grado no existe.' using errcode = '22023';
    end if;
    if nivel_actual <> nivel_id_solicitado and exists (select 1 from public.secciones where grado_id = grado_id_solicitado) then
      raise exception 'No puedes cambiar de nivel un grado que ya tiene salones.' using errcode = '23503';
    end if;

    update public.grados
       set nivel_id = nivel_id_solicitado,
           nombre = nombre_limpio,
           activo = coalesce(activo_solicitado, true),
           actualizado_por = auth.uid()
     where id = grado_id_solicitado
     returning id into grado_id_resultado;
  end if;

  return grado_id_resultado;
exception
  when unique_violation then
    raise exception 'Ese grado ya está registrado en el nivel seleccionado.' using errcode = '23505';
end;
$$;

revoke all on function public.guardar_grado(bigint, bigint, text, smallint, boolean) from public, anon;
grant execute on function public.guardar_grado(bigint, bigint, text, smallint, boolean) to authenticated;

commit;
