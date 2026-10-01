-- Gestión atómica de horas y responsable académico por curso o salón.
-- No crea información de demostración.

begin;

create or replace function public.guardar_carga_academica(
  curso_seccion_id_solicitado bigint,
  seccion_id_solicitada bigint,
  horas_semanales_solicitadas smallint,
  docente_id_solicitado uuid,
  inicia_en_solicitado date,
  termina_en_solicitado date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  anio_inicio date;
  anio_fin date;
  anio_estado text;
  alcance_nivel text;
  asignacion_id_resultado bigint;
  clave_bloqueo text;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Dirección o Coordinación Académica pueden gestionar la carga académica.' using errcode = '42501';
  end if;

  if (curso_seccion_id_solicitado is null) = (seccion_id_solicitada is null) then
    raise exception 'Selecciona un curso o un salón, no ambos.' using errcode = '22023';
  end if;

  if curso_seccion_id_solicitado is not null then
    select anio.inicia_en, anio.termina_en, anio.estado, nivel.alcance_material
      into anio_inicio, anio_fin, anio_estado, alcance_nivel
      from public.cursos_seccion curso
      join public.secciones salon on salon.id = curso.seccion_id
      join public.anios_academicos anio on anio.id = salon.anio_academico_id
      join public.grados grado on grado.id = salon.grado_id
      join public.niveles_educativos nivel on nivel.id = grado.nivel_id
     where curso.id = curso_seccion_id_solicitado
       and curso.activo
       and curso.archivado_en is null
       and salon.activo;

    if horas_semanales_solicitadas is null or horas_semanales_solicitadas not between 1 and 40 then
      raise exception 'Las horas semanales deben estar entre 1 y 40.' using errcode = '22023';
    end if;
  else
    select anio.inicia_en, anio.termina_en, anio.estado, nivel.alcance_material
      into anio_inicio, anio_fin, anio_estado, alcance_nivel
      from public.secciones salon
      join public.anios_academicos anio on anio.id = salon.anio_academico_id
      join public.grados grado on grado.id = salon.grado_id
      join public.niveles_educativos nivel on nivel.id = grado.nivel_id
     where salon.id = seccion_id_solicitada
       and salon.activo;
  end if;

  if anio_estado is null then raise exception 'El curso o salón seleccionado no está disponible.' using errcode = '22023'; end if;
  if anio_estado = 'cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode = '22023'; end if;
  if curso_seccion_id_solicitado is not null and alcance_nivel <> 'course' then
    raise exception 'En este nivel la carga se asigna directamente al salón.' using errcode = '22023';
  end if;
  if seccion_id_solicitada is not null and alcance_nivel <> 'section' then
    raise exception 'En este nivel la carga se asigna por curso.' using errcode = '22023';
  end if;
  if inicia_en_solicitado is null or termina_en_solicitado is null
     or termina_en_solicitado < inicia_en_solicitado
     or inicia_en_solicitado < anio_inicio
     or termina_en_solicitado > anio_fin then
    raise exception 'La vigencia debe estar dentro del año lectivo.' using errcode = '22023';
  end if;
  if docente_id_solicitado is not null and not exists (
    select 1 from public.perfiles
     where id = docente_id_solicitado and activo and rol::text = 'docente'
  ) then
    raise exception 'El docente seleccionado no existe o está inactivo.' using errcode = '22023';
  end if;

  clave_bloqueo := case
    when curso_seccion_id_solicitado is not null then 'academic-load:course:' || curso_seccion_id_solicitado::text
    else 'academic-load:section:' || seccion_id_solicitada::text
  end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clave_bloqueo, 0));

  if curso_seccion_id_solicitado is not null then
    update public.cursos_seccion
       set horas_semanales = horas_semanales_solicitadas,
           actualizado_por = auth.uid(),
           actualizado_en = now()
     where id = curso_seccion_id_solicitado and activo and archivado_en is null;
  end if;

  update public.asignaciones_docentes
     set activo = false,
         archivado_en = now(),
         archivado_por = auth.uid()
   where activo and archivado_en is null
     and (
       (curso_seccion_id_solicitado is not null and curso_seccion_id = curso_seccion_id_solicitado)
       or (seccion_id_solicitada is not null and seccion_id = seccion_id_solicitada)
     );

  if docente_id_solicitado is not null then
    insert into public.asignaciones_docentes (
      curso_seccion_id, seccion_id, docente_id, rol_asignacion,
      inicia_en, termina_en, activo, asignado_por
    ) values (
      curso_seccion_id_solicitado, seccion_id_solicitada, docente_id_solicitado,
      'titular', inicia_en_solicitado, termina_en_solicitado, true, auth.uid()
    ) returning id into asignacion_id_resultado;
  end if;

  return pg_catalog.jsonb_build_object(
    'curso_seccion_id', curso_seccion_id_solicitado,
    'seccion_id', seccion_id_solicitada,
    'asignacion_id', asignacion_id_resultado,
    'docente_id', docente_id_solicitado,
    'horas_semanales', horas_semanales_solicitadas
  );
end;
$$;

revoke all on function public.guardar_carga_academica(bigint, bigint, smallint, uuid, date, date) from public, anon;
grant execute on function public.guardar_carga_academica(bigint, bigint, smallint, uuid, date, date) to authenticated;

commit;
