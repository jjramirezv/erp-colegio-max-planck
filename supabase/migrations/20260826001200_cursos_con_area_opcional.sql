-- Permite cursos directos por grado, sin obligarlos a pertenecer a un área.
-- No modifica los cursos existentes ni inserta datos de demostración.

begin;

alter table public.cursos_grado
  alter column area_curricular_id drop not null;

create or replace function public.guardar_curso_grado(
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
security invoker
set search_path = public, auth
as $$
declare
  curso_id_resultado bigint;
  asignatura_id_resultado bigint;
  nombre_limpio text := btrim(nombre_curso_solicitado);
  codigo_generado text;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los cursos por grado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.anios_academicos where id = anio_academico_id_solicitado and estado <> 'cerrado') then
    raise exception 'Selecciona un año lectivo disponible.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados where id = grado_id_solicitado) then
    raise exception 'Selecciona un grado válido.' using errcode = '22023';
  end if;
  if area_curricular_id_solicitada is not null
     and not exists (select 1 from public.areas_curriculares where id = area_curricular_id_solicitada) then
    raise exception 'Selecciona un área curricular válida.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 100 then
    raise exception 'El nombre del curso debe contener entre 1 y 100 caracteres.' using errcode = '22023';
  end if;
  if horas_semanales_solicitadas is null or horas_semanales_solicitadas not between 1 and 40 then
    raise exception 'Las horas semanales deben estar entre 1 y 40.' using errcode = '22023';
  end if;

  if curso_grado_id_solicitado is not null then
    select asignatura_id into asignatura_id_resultado
      from public.cursos_grado where id = curso_grado_id_solicitado;
    if asignatura_id_resultado is null then raise exception 'El curso del grado no existe.' using errcode = '22023'; end if;
    update public.asignaturas
       set nombre = nombre_limpio, activo = true, actualizado_por = auth.uid()
     where id = asignatura_id_resultado and archivado_en is null;
  else
    select id into asignatura_id_resultado
      from public.asignaturas
     where lower(btrim(nombre)) = lower(nombre_limpio)
       and archivado_en is null
     order by id limit 1;
    if asignatura_id_resultado is null then
      codigo_generado := 'CUR_' || upper(substr(md5(lower(nombre_limpio)), 1, 10));
      insert into public.asignaturas (codigo, nombre, activo, creado_por, actualizado_por)
      values (codigo_generado, nombre_limpio, true, auth.uid(), auth.uid())
      returning id into asignatura_id_resultado;
    else
      update public.asignaturas
         set activo = true, actualizado_por = auth.uid()
       where id = asignatura_id_resultado;
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
       and anio_academico_id = anio_academico_id_solicitado
       and grado_id = grado_id_solicitado
     returning id into curso_id_resultado;
    if curso_id_resultado is null then raise exception 'El curso no pertenece al año y grado seleccionados.' using errcode = '22023'; end if;
  end if;

  perform public.sincronizar_cursos_de_grado(anio_academico_id_solicitado, grado_id_solicitado, asignatura_id_resultado);
  return curso_id_resultado;
exception
  when unique_violation then
    raise exception 'Ese curso ya está asignado al grado seleccionado.' using errcode = '23505';
end;
$$;

revoke all on function public.guardar_curso_grado(bigint, bigint, bigint, bigint, text, smallint, boolean) from public, anon;
grant execute on function public.guardar_curso_grado(bigint, bigint, bigint, bigint, text, smallint, boolean) to authenticated;

commit;
