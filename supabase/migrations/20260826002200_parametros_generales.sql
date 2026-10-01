-- Preferencias operativas generales almacenadas en la configuración existente.
-- No inserta filas ni modifica identidad, evaluación o calendario.

begin;

create or replace function public.obtener_parametros_generales()
returns table (
  minutos_inactividad smallint,
  registros_por_pagina smallint,
  limite_archivo_mb smallint,
  actualizado_en timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    coalesce((configuracion.parametros_sistema ->> 'minutos_inactividad')::smallint, 30),
    coalesce((configuracion.parametros_sistema ->> 'registros_por_pagina')::smallint, 10),
    coalesce((configuracion.parametros_sistema ->> 'limite_archivo_mb')::smallint, 100),
    configuracion.actualizado_en
  from public.configuracion_institucional configuracion
  where configuracion.id = 1;
$$;

create or replace function public.guardar_parametros_generales(
  minutos_inactividad_solicitados smallint,
  registros_por_pagina_solicitados smallint,
  limite_archivo_mb_solicitado smallint
)
returns table (
  minutos_inactividad smallint,
  registros_por_pagina smallint,
  limite_archivo_mb smallint,
  actualizado_en timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede modificar los parámetros generales.' using errcode = '42501';
  end if;
  if minutos_inactividad_solicitados not in (15, 30, 60, 120) then
    raise exception 'Selecciona un tiempo de sesión permitido.' using errcode = '22023';
  end if;
  if registros_por_pagina_solicitados not in (10, 20, 50) then
    raise exception 'Selecciona una cantidad de resultados permitida.' using errcode = '22023';
  end if;
  if limite_archivo_mb_solicitado not in (5, 10, 25, 50, 100) then
    raise exception 'Selecciona un límite de archivo permitido.' using errcode = '22023';
  end if;

  update public.configuracion_institucional
  set parametros_sistema = coalesce(parametros_sistema, '{}'::jsonb) || jsonb_build_object(
        'minutos_inactividad', minutos_inactividad_solicitados,
        'registros_por_pagina', registros_por_pagina_solicitados,
        'limite_archivo_mb', limite_archivo_mb_solicitado
      ),
      actualizado_por = auth.uid()
  where id = 1;

  if not found then
    raise exception 'Primero configura la identidad institucional.' using errcode = '22023';
  end if;

  return query select * from public.obtener_parametros_generales();
end; $$;

revoke all on function public.obtener_parametros_generales(),
  public.guardar_parametros_generales(smallint, smallint, smallint) from public, anon;
grant execute on function public.obtener_parametros_generales(),
  public.guardar_parametros_generales(smallint, smallint, smallint) to authenticated;

commit;
