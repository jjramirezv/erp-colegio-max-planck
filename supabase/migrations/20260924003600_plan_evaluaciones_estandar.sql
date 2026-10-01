-- Plan de evaluaciones estándar por periodo:
--   · examen semanal (por defecto cada viernes),
--   · semana de evaluación a mitad del periodo,
--   · semana de evaluación al final del periodo.
-- En las semanas de medio y fin de periodo no se programa examen semanal.
-- Las evaluaciones de semana se ubican en el primer día de esa semana en que el curso tiene clase.
-- Es idempotente: no duplica títulos existentes del mismo curso y periodo.

begin;

create or replace function public.generar_plan_evaluaciones(
  anio bigint,
  periodos bigint[],
  nivel bigint default null,
  seccion bigint default null,
  dia_semanal smallint default 5,
  incluir_semanales boolean default true,
  incluir_medio boolean default true,
  incluir_final boolean default true,
  solo_previsualizar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record; c record;
  palabra text; medio date; lunes_medio date; ultimo_habil date; lunes_final date;
  fecha date; lunes date; n_semana integer; semana_lunes date; nombre_eval text;
  creadas integer := 0; existentes integer := 0; filas integer;
  cursos integer := 0;
  calendario jsonb := '[]'::jsonb; semanales jsonb;
begin
  if not (select public.es_gestor_materiales()) then
    raise exception 'Solo Dirección o Coordinación Académica pueden generar el plan de evaluaciones.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.anios_academicos where id = anio and estado <> 'cerrado') then
    raise exception 'El año lectivo no está disponible o está cerrado.' using errcode = '22023';
  end if;
  if dia_semanal not between 1 and 6 then
    raise exception 'Elige un día de lunes a sábado para el examen semanal.' using errcode = '22023';
  end if;
  if coalesce(array_length(periodos, 1), 0) = 0 then
    raise exception 'Selecciona al menos un periodo.' using errcode = '22023';
  end if;

  select count(*) into cursos
  from public.cursos_seccion cs
  join public.secciones s on s.id = cs.seccion_id
  join public.grados g on g.id = s.grado_id
  where cs.anio_academico_id = anio and cs.activo and cs.archivado_en is null and s.activo
    and (seccion is null or cs.seccion_id = seccion)
    and (nivel is null or g.nivel_id = nivel);

  for p in
    select * from public.periodos_academicos
    where anio_academico_id = anio and id = any(periodos)
    order by numero
  loop
    palabra := case when p.nombre ilike '%trimestre%' then 'trimestre' when p.nombre ilike '%bimestre%' then 'bimestre' else 'periodo' end;
    medio := p.inicia_en + (p.termina_en - p.inicia_en) / 2;
    lunes_medio := medio - (extract(isodow from medio)::integer - 1);
    ultimo_habil := p.termina_en - case extract(isodow from p.termina_en)::integer when 6 then 1 when 7 then 2 else 0 end;
    lunes_final := ultimo_habil - (extract(isodow from ultimo_habil)::integer - 1);
    -- Si la última semana tiene menos de 3 días hábiles, la semana final es la anterior completa.
    if ultimo_habil - lunes_final < 2 and lunes_final - 7 >= p.inicia_en then lunes_final := lunes_final - 7; end if;

    -- Fechas de exámenes semanales del periodo (iguales para todos los cursos).
    semanales := '[]'::jsonb;
    if incluir_semanales then
      fecha := p.inicia_en + ((dia_semanal - extract(isodow from p.inicia_en)::integer + 7) % 7);
      while fecha <= p.termina_en loop
        lunes := fecha - (dia_semanal - 1);
        if not ((incluir_medio and lunes = lunes_medio) or (incluir_final and lunes = lunes_final)) then
          semanales := semanales || to_jsonb(fecha);
        end if;
        fecha := fecha + 7;
      end loop;
    end if;

    calendario := calendario || jsonb_build_object(
      'periodId', p.id, 'period', p.nombre, 'startsOn', p.inicia_en, 'endsOn', p.termina_en,
      'weekly', semanales,
      'midWeek', case when incluir_medio then jsonb_build_object('from', greatest(lunes_medio, p.inicia_en), 'to', least(lunes_medio + 4, p.termina_en)) end,
      'finalWeek', case when incluir_final then jsonb_build_object('from', greatest(lunes_final, p.inicia_en), 'to', least(lunes_final + 4, p.termina_en)) end
    );

    for c in
      select cs.id,
        coalesce((select array_agg(distinct h.dia_semana::integer) from public.horarios_clases h
          where h.curso_seccion_id = cs.id and h.activo), '{}') as dias
      from public.cursos_seccion cs
      join public.secciones s on s.id = cs.seccion_id
      join public.grados g on g.id = s.grado_id
      where cs.anio_academico_id = anio and cs.activo and cs.archivado_en is null and s.activo
        and (seccion is null or cs.seccion_id = seccion)
        and (nivel is null or g.nivel_id = nivel)
    loop
      -- Exámenes semanales.
      n_semana := 0;
      for fecha in select value::text::date from jsonb_array_elements_text(semanales) loop
        n_semana := n_semana + 1;
        if solo_previsualizar then
          if exists (select 1 from public.evaluaciones_academicas e where e.curso_seccion_id = c.id and e.periodo_academico_id = p.id and e.archivado_en is null and lower(btrim(e.titulo)) = lower('Examen semanal ' || n_semana)) then existentes := existentes + 1; else creadas := creadas + 1; end if;
        else
          insert into public.evaluaciones_academicas (curso_seccion_id, periodo_academico_id, titulo, tipo, descripcion, fecha_aplicacion, estado, visible_estudiantes, creado_por, actualizado_por)
          values (c.id, p.id, 'Examen semanal ' || n_semana, 'formativa', 'Evaluación semanal del plan estándar.', fecha, 'programada', true, auth.uid(), auth.uid())
          on conflict do nothing;
          get diagnostics filas = row_count;
          creadas := creadas + filas; existentes := existentes + 1 - filas;
        end if;
      end loop;

      -- Semanas de evaluación: primer día de la semana en que el curso tiene clase.
      for semana_lunes, nombre_eval in select * from (values
        (case when incluir_medio then lunes_medio end, 'Evaluación de mitad de ' || palabra),
        (case when incluir_final then lunes_final end, 'Evaluación final de ' || palabra)
      ) as semana(inicio, nombre) where semana.inicio is not null loop
        select coalesce(min(d::date), greatest(semana_lunes, p.inicia_en)) into fecha
        from generate_series(greatest(semana_lunes, p.inicia_en)::timestamp, least(semana_lunes + 4, p.termina_en)::timestamp, interval '1 day') as d
        where extract(isodow from d)::integer = any(c.dias);
        if solo_previsualizar then
          if exists (select 1 from public.evaluaciones_academicas e where e.curso_seccion_id = c.id and e.periodo_academico_id = p.id and e.archivado_en is null and lower(btrim(e.titulo)) = lower(nombre_eval)) then existentes := existentes + 1; else creadas := creadas + 1; end if;
        else
          insert into public.evaluaciones_academicas (curso_seccion_id, periodo_academico_id, titulo, tipo, descripcion, fecha_aplicacion, estado, visible_estudiantes, creado_por, actualizado_por)
          values (c.id, p.id, nombre_eval, 'examen', 'Semana de evaluación del plan estándar.', fecha, 'programada', true, auth.uid(), auth.uid())
          on conflict do nothing;
          get diagnostics filas = row_count;
          creadas := creadas + filas; existentes := existentes + 1 - filas;
        end if;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object('courses', cursos, 'toCreate', creadas, 'existing', existentes, 'calendar', calendario, 'preview', solo_previsualizar);
end;
$$;

revoke all on function public.generar_plan_evaluaciones(bigint, bigint[], bigint, bigint, smallint, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.generar_plan_evaluaciones(bigint, bigint[], bigint, bigint, smallint, boolean, boolean, boolean, boolean) to authenticated;

commit;
