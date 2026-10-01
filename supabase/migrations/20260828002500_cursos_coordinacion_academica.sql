-- Gestión de cursos por Dirección y Coordinación Académica.
-- No inserta datos de demostración.

begin;

create or replace function public.guardar_curso_academico(
  curso_grado_id_solicitado bigint,
  anio_academico_id_solicitado bigint,
  grado_id_solicitado bigint,
  area_curricular_id_solicitada bigint,
  nombre_curso_solicitado text,
  horas_semanales_solicitadas smallint,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  curso_id_resultado bigint;
  asignatura_id_resultado bigint;
  nombre_limpio text := pg_catalog.btrim(nombre_curso_solicitado);
  codigo_generado text;
begin
  if (select public.rol_portal_actual())::text not in ('direccion', 'coordinador_academico') then
    raise exception 'Solo Dirección o Coordinación Académica pueden gestionar cursos.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.anios_academicos
    where id = anio_academico_id_solicitado and estado <> 'cerrado'
  ) then
    raise exception 'Selecciona un año lectivo disponible.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados where id = grado_id_solicitado and activo) then
    raise exception 'Selecciona un grado activo.' using errcode = '22023';
  end if;
  if area_curricular_id_solicitada is not null and not exists (
    select 1 from public.areas_curriculares where id = area_curricular_id_solicitada and activo
  ) then
    raise exception 'Selecciona un área curricular activa.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or pg_catalog.char_length(nombre_limpio) > 100 then
    raise exception 'El nombre del curso debe contener entre 1 y 100 caracteres.' using errcode = '22023';
  end if;
  if horas_semanales_solicitadas is null or horas_semanales_solicitadas not between 1 and 40 then
    raise exception 'Las horas sugeridas deben estar entre 1 y 40.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('academic-course:' || anio_academico_id_solicitado::text || ':' || grado_id_solicitado::text, 0)
  );

  if curso_grado_id_solicitado is not null then
    select asignatura_id into asignatura_id_resultado
    from public.cursos_grado
    where id = curso_grado_id_solicitado
      and anio_academico_id = anio_academico_id_solicitado
      and grado_id = grado_id_solicitado;
    if asignatura_id_resultado is null then
      raise exception 'El curso no pertenece al año y grado seleccionados.' using errcode = '22023';
    end if;
    update public.asignaturas
       set nombre = nombre_limpio, activo = true, actualizado_por = auth.uid()
     where id = asignatura_id_resultado and archivado_en is null;
  else
    select id into asignatura_id_resultado
    from public.asignaturas
    where pg_catalog.lower(pg_catalog.btrim(nombre)) = pg_catalog.lower(nombre_limpio)
      and archivado_en is null
    order by id limit 1;
    if asignatura_id_resultado is null then
      codigo_generado := 'CUR_' || pg_catalog.upper(pg_catalog.substr(pg_catalog.md5(pg_catalog.lower(nombre_limpio)), 1, 10));
      insert into public.asignaturas (codigo, nombre, activo, creado_por, actualizado_por)
      values (codigo_generado, nombre_limpio, true, auth.uid(), auth.uid())
      returning id into asignatura_id_resultado;
    end if;
  end if;

  if curso_grado_id_solicitado is null then
    insert into public.cursos_grado (
      anio_academico_id, grado_id, area_curricular_id, asignatura_id,
      horas_semanales, activo, creado_por, actualizado_por
    ) values (
      anio_academico_id_solicitado, grado_id_solicitado, area_curricular_id_solicitada,
      asignatura_id_resultado, horas_semanales_solicitadas,
      coalesce(activo_solicitado, true), auth.uid(), auth.uid()
    ) returning id into curso_id_resultado;
  else
    update public.cursos_grado
       set area_curricular_id = area_curricular_id_solicitada,
           horas_semanales = horas_semanales_solicitadas,
           activo = coalesce(activo_solicitado, true),
           actualizado_por = auth.uid()
     where id = curso_grado_id_solicitado
     returning id into curso_id_resultado;
  end if;

  update public.cursos_seccion oferta
     set horas_semanales = plan.horas_semanales,
         activo = plan.activo,
         actualizado_por = auth.uid()
    from public.secciones salon, public.cursos_grado plan
   where oferta.seccion_id = salon.id
     and salon.anio_academico_id = anio_academico_id_solicitado
     and salon.grado_id = grado_id_solicitado
     and plan.id = curso_id_resultado
     and oferta.asignatura_id = plan.asignatura_id
     and oferta.archivado_en is null;

  insert into public.cursos_seccion (
    anio_academico_id, seccion_id, asignatura_id, horas_semanales,
    activo, creado_por, actualizado_por
  )
  select plan.anio_academico_id, salon.id, plan.asignatura_id, plan.horas_semanales,
         true, auth.uid(), auth.uid()
  from public.cursos_grado plan
  join public.secciones salon
    on salon.anio_academico_id = plan.anio_academico_id
   and salon.grado_id = plan.grado_id
   and salon.activo
  where plan.id = curso_id_resultado
    and plan.activo
    and not exists (
      select 1 from public.cursos_seccion oferta
      where oferta.seccion_id = salon.id
        and oferta.asignatura_id = plan.asignatura_id
        and oferta.archivado_en is null
    );

  return curso_id_resultado;
exception
  when unique_violation then
    raise exception 'Este curso ya pertenece al grado seleccionado.' using errcode = '23505';
end;
$$;

revoke all on function public.guardar_curso_academico(bigint, bigint, bigint, bigint, text, smallint, boolean) from public, anon;
grant execute on function public.guardar_curso_academico(bigint, bigint, bigint, bigint, text, smallint, boolean) to authenticated;

commit;
