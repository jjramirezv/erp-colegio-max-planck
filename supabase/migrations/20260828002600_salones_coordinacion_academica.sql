-- Gestión operativa de salones por Coordinación Académica.
-- Los grados continúan siendo definidos únicamente por Alta Dirección.
-- No inserta datos de demostración.

begin;

create or replace function public.guardar_salones_academicos(
  grado_id_solicitado bigint,
  anio_academico_id_solicitado bigint,
  salones_solicitados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  salon jsonb;
  salon_id bigint;
  salon_nombre text;
  salon_turno_id bigint;
  salon_turno_nombre text;
  salon_capacidad smallint;
  salon_ids bigint[] := array[]::bigint[];
  salon_id_resultado bigint;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Dirección o Coordinación Académica pueden administrar salones.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.grados
    where id = grado_id_solicitado and activo
  ) then
    raise exception 'El grado seleccionado no está disponible.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.anios_academicos
    where id = anio_academico_id_solicitado and estado <> 'cerrado'
  ) then
    raise exception 'Selecciona un año lectivo disponible.' using errcode = '22023';
  end if;

  if jsonb_typeof(salones_solicitados) <> 'array'
     or jsonb_array_length(salones_solicitados) not between 1 and 3 then
    raise exception 'Selecciona entre 1 y 3 salones para el grado.' using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct lower(btrim(value ->> 'name')))
    from jsonb_array_elements(salones_solicitados)
  ) then
    raise exception 'Los salones del grado deben tener nombres diferentes.' using errcode = '23505';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    anio_academico_id_solicitado::text || ':' || grado_id_solicitado::text,
    0
  ));

  for salon in select value from jsonb_array_elements(salones_solicitados)
  loop
    salon_id := nullif(salon ->> 'id', '')::bigint;
    salon_nombre := btrim(salon ->> 'name');
    salon_turno_id := nullif(salon ->> 'shiftId', '')::bigint;
    salon_capacidad := nullif(salon ->> 'capacity', '')::smallint;

    if salon_nombre is null or salon_nombre = '' or char_length(salon_nombre) > 20 then
      raise exception 'El nombre de cada salón debe contener entre 1 y 20 caracteres.' using errcode = '22023';
    end if;
    if salon_capacidad is null or salon_capacidad not between 1 and 200 then
      raise exception 'La capacidad de cada salón debe estar entre 1 y 200 estudiantes.' using errcode = '22023';
    end if;

    select nombre into salon_turno_nombre
    from public.turnos_jornadas
    where id = salon_turno_id
      and anio_academico_id = anio_academico_id_solicitado
      and activo;

    if salon_turno_nombre is null then
      raise exception 'Selecciona un turno activo del año lectivo para cada salón.' using errcode = '22023';
    end if;

    if salon_id is null then
      insert into public.secciones (
        anio_academico_id, grado_id, nombre, turno_jornada_id, turno,
        capacidad, activo, creado_por, actualizado_por
      ) values (
        anio_academico_id_solicitado, grado_id_solicitado, salon_nombre,
        salon_turno_id, salon_turno_nombre, salon_capacidad, true,
        auth.uid(), auth.uid()
      )
      returning id into salon_id_resultado;
    else
      update public.secciones
         set nombre = salon_nombre,
             turno_jornada_id = salon_turno_id,
             turno = salon_turno_nombre,
             capacidad = salon_capacidad,
             activo = true,
             actualizado_por = auth.uid()
       where id = salon_id
         and anio_academico_id = anio_academico_id_solicitado
         and grado_id = grado_id_solicitado
      returning id into salon_id_resultado;

      if salon_id_resultado is null then
        raise exception 'Uno de los salones no pertenece al grado y año seleccionados.' using errcode = '22023';
      end if;
    end if;

    salon_ids := array_append(salon_ids, salon_id_resultado);
  end loop;

  delete from public.secciones
   where anio_academico_id = anio_academico_id_solicitado
     and grado_id = grado_id_solicitado
     and not (id = any(salon_ids));

  return jsonb_build_object(
    'gradoId', grado_id_solicitado,
    'anioAcademicoId', anio_academico_id_solicitado,
    'salones', salon_ids
  );
exception
  when unique_violation then
    raise exception 'Ya existe un salón con ese nombre para el grado seleccionado.' using errcode = '23505';
  when foreign_key_violation then
    raise exception 'No puedes retirar un salón que ya tiene información académica asociada.' using errcode = '23503';
end;
$$;

revoke all on function public.guardar_salones_academicos(bigint, bigint, jsonb) from public, anon;
grant execute on function public.guardar_salones_academicos(bigint, bigint, jsonb) to authenticated;

commit;
