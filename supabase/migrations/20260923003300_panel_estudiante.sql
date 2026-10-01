-- Portal de consulta: la identidad proviene de la sesión, nunca del navegador.
begin;
create or replace function public.cargar_panel_estudiante()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb;
begin
  if public.rol_portal_actual() is distinct from 'estudiante'::public.rol_portal then
    raise exception 'Solo un estudiante activo puede consultar este panel.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(datos order by inicio desc), '[]'::jsonb) into resultado
  from (
    select y.inicia_en as inicio, jsonb_build_object(
      'id', m.id, 'year', y.nombre, 'yearState', y.estado,
      'classroom', concat(n.nombre, ' · ', g.nombre, ' ', s.nombre),
      'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', coalesce(c.nombre_visible, a.nombre), 'weeklyHours', c.horas_semanales,
          'teachers', coalesce((select string_agg(p.nombre_completo, ', ' order by p.nombre_completo)
            from public.asignaciones_docentes ad join public.perfiles p on p.id = ad.docente_id
            where ad.curso_seccion_id = c.id and ad.activo and ad.archivado_en is null and p.activo
              and (ad.inicia_en is null or ad.inicia_en <= (now() at time zone 'America/Lima')::date)
              and (ad.termina_en is null or ad.termina_en >= (now() at time zone 'America/Lima')::date)), ''),
          'schedule', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'day', h.dia_semana,
            'start', b.hora_inicio, 'end', b.hora_fin) order by h.dia_semana, b.hora_inicio)
            from public.horarios_clases h join public.bloques_horarios b on b.id = h.bloque_horario_id
            where h.curso_seccion_id = c.id and h.activo and b.activo), '[]'::jsonb),
          'evaluations', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.titulo,
            'date', e.fecha_aplicacion, 'period', pa.nombre, 'state', e.estado,
            'grade', ce.valor, 'note', ce.observacion) order by e.fecha_aplicacion desc, e.id)
            from public.evaluaciones_academicas e join public.periodos_academicos pa on pa.id = e.periodo_academico_id
            left join public.calificaciones_evaluaciones ce on ce.evaluacion_id = e.id and ce.matricula_id = m.id
            where e.curso_seccion_id = c.id and e.visible_estudiantes and e.estado <> 'borrador'
              and e.archivado_en is null), '[]'::jsonb)
        ) order by coalesce(c.nombre_visible, a.nombre))
        from public.cursos_seccion c join public.asignaturas a on a.id = c.asignatura_id
        where c.seccion_id = m.seccion_id and c.anio_academico_id = m.anio_academico_id
          and c.activo and c.archivado_en is null
      ), '[]'::jsonb),
      'attendance', coalesce((select jsonb_agg(jsonb_build_object('id', ae.id, 'date', ae.fecha,
        'status', ae.estado, 'lateMinutes', ae.minutos_tardanza) order by ae.fecha desc)
        from public.asistencias_estudiantes ae where ae.matricula_id = m.id), '[]'::jsonb)
    ) as datos
    from public.matriculas_estudiantes m
    join public.secciones s on s.id = m.seccion_id
    join public.grados g on g.id = s.grado_id
    join public.niveles_educativos n on n.id = g.nivel_id
    join public.anios_academicos y on y.id = m.anio_academico_id
    where m.estudiante_id = auth.uid() and m.archivado_en is null and m.estado in ('active', 'completed')
  ) matriculas;
  return resultado;
end;
$$;
revoke all on function public.cargar_panel_estudiante() from public, anon;
grant execute on function public.cargar_panel_estudiante() to authenticated;
commit;
