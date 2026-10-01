-- Panel docente: asignaciones reales, resultados por evaluación y comunicados.
-- No crea usuarios ni registros de demostración.
begin;

create or replace function public.cargar_panel_docente()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb;
begin
  if public.rol_portal_actual() is distinct from 'docente'::public.rol_portal then
    raise exception 'Solo una cuenta docente activa puede consultar este panel.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(datos order by datos->>'name', datos->>'classroom'), '[]'::jsonb)
  into resultado
  from (
    select jsonb_build_object(
      'id', c.id, 'name', coalesce(c.nombre_visible, a.nombre),
      'sectionId', s.id, 'classroom', concat(n.nombre, ' · ', g.nombre, ' ', s.nombre),
      'year', y.nombre, 'yearState', y.estado, 'weeklyHours', c.horas_semanales,
      'students', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'studentId', p.id, 'name', p.nombre_completo) order by p.nombre_completo)
        from public.matriculas_estudiantes m join public.perfiles p on p.id = m.estudiante_id
        where m.seccion_id = s.id and m.estado = 'active' and m.archivado_en is null and p.activo
      ), '[]'::jsonb),
      'schedule', coalesce((
        select jsonb_agg(jsonb_build_object('id', h.id, 'day', h.dia_semana, 'start', b.hora_inicio, 'end', b.hora_fin, 'name', b.nombre) order by h.dia_semana, b.hora_inicio)
        from public.horarios_clases h join public.bloques_horarios b on b.id = h.bloque_horario_id
        where h.curso_seccion_id = c.id and h.activo and b.activo
      ), '[]'::jsonb),
      'evaluations', coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.titulo, 'state', e.estado, 'date', e.fecha_aplicacion, 'period', pa.nombre) order by e.fecha_aplicacion, e.id)
        from public.evaluaciones_academicas e join public.periodos_academicos pa on pa.id = e.periodo_academico_id
        where e.curso_seccion_id = c.id and e.archivado_en is null
      ), '[]'::jsonb),
      'scale', (
        select jsonb_build_object('type', ce.tipo_escala, 'min', ce.valor_minimo, 'max', ce.valor_maximo, 'decimals', ce.decimales,
          'levels', coalesce((select jsonb_agg(jsonb_build_object('code', l.codigo, 'name', l.nombre) order by l.orden)
            from public.niveles_logro_evaluacion l where l.configuracion_evaluacion_id = ce.id), '[]'::jsonb))
        from public.configuraciones_evaluacion ce where ce.anio_academico_id = y.id and ce.nivel_educativo_id = n.id
      )
    ) as datos
    from public.cursos_seccion c join public.asignaturas a on a.id = c.asignatura_id
    join public.secciones s on s.id = c.seccion_id join public.grados g on g.id = s.grado_id
    join public.niveles_educativos n on n.id = g.nivel_id join public.anios_academicos y on y.id = c.anio_academico_id
    where public.docente_tiene_curso(c.id)
  ) cursos;
  return resultado;
end;
$$;
revoke all on function public.cargar_panel_docente() from public, anon;
grant execute on function public.cargar_panel_docente() to authenticated;

create table public.calificaciones_evaluaciones (
  id bigint generated always as identity primary key,
  evaluacion_id bigint not null references public.evaluaciones_academicas(id) on delete restrict,
  matricula_id bigint not null references public.matriculas_estudiantes(id) on delete restrict,
  valor text not null check (char_length(btrim(valor)) between 1 and 20),
  observacion text check (observacion is null or char_length(observacion) <= 500),
  registrado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (evaluacion_id, matricula_id)
);
create index calificaciones_matricula_idx on public.calificaciones_evaluaciones(matricula_id);
alter table public.calificaciones_evaluaciones enable row level security;
create trigger calificaciones_actualizado_en before update on public.calificaciones_evaluaciones
for each row execute function public.establecer_actualizado_en();
create policy "gestores y docentes leen resultados" on public.calificaciones_evaluaciones
for select to authenticated using (
  public.es_gestor_materiales() or exists (
    select 1 from public.evaluaciones_academicas e
    where e.id = evaluacion_id and public.docente_tiene_curso(e.curso_seccion_id)
  )
);
-- La escritura solo se permite mediante la función que valida curso, matrícula y escala.
revoke all on table public.calificaciones_evaluaciones from public, anon, authenticated;
grant select on table public.calificaciones_evaluaciones to authenticated;
revoke all on sequence public.calificaciones_evaluaciones_id_seq from public, anon, authenticated;

create or replace function public.guardar_calificaciones_docente(evaluacion_id_solicitada bigint, registros_solicitados jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  evaluacion record; escala public.configuraciones_evaluacion%rowtype;
  registro jsonb; matricula bigint; valor_solicitado text; nota numeric; observacion_solicitada text; total integer := 0;
begin
  select e.*, c.seccion_id, c.anio_academico_id, g.nivel_id, y.estado as estado_anio
  into evaluacion from public.evaluaciones_academicas e
  join public.cursos_seccion c on c.id = e.curso_seccion_id
  join public.secciones s on s.id = c.seccion_id join public.grados g on g.id = s.grado_id
  join public.anios_academicos y on y.id = c.anio_academico_id
  where e.id = evaluacion_id_solicitada and e.archivado_en is null for update of e;
  if not found then raise exception 'La evaluación no está disponible.' using errcode = '22023'; end if;
  if not public.docente_tiene_curso(evaluacion.curso_seccion_id) then
    raise exception 'Solo el docente asignado puede registrar estas calificaciones.' using errcode = '42501';
  end if;
  if evaluacion.estado_anio = 'cerrado' or evaluacion.estado not in ('programada', 'en_curso') then
    raise exception 'Esta evaluación es de solo consulta.' using errcode = '22023';
  end if;
  select * into escala from public.configuraciones_evaluacion
  where anio_academico_id = evaluacion.anio_academico_id and nivel_educativo_id = evaluacion.nivel_id;
  if not found then raise exception 'Dirección debe configurar la escala de evaluación.' using errcode = '22023'; end if;
  if registros_solicitados is null or jsonb_typeof(registros_solicitados) <> 'array' then
    raise exception 'Envía una lista de calificaciones.' using errcode = '22023';
  end if;
  if jsonb_array_length(registros_solicitados) not between 1 and 500 then
    raise exception 'Registra entre 1 y 500 calificaciones.' using errcode = '22023';
  end if;
  for registro in select value from jsonb_array_elements(registros_solicitados) loop
    matricula := (registro->>'enrollmentId')::bigint;
    valor_solicitado := btrim(registro->>'value');
    observacion_solicitada := nullif(btrim(registro->>'note'), '');
    if not exists (select 1 from public.matriculas_estudiantes m join public.perfiles p on p.id = m.estudiante_id
      where m.id = matricula and m.seccion_id = evaluacion.seccion_id and m.estado = 'active' and m.archivado_en is null and p.activo) then
      raise exception 'La matrícula no pertenece al curso o no está activa.' using errcode = '22023';
    end if;
    if valor_solicitado is null or char_length(valor_solicitado) not between 1 and 20 then
      raise exception 'Ingresa una calificación válida.' using errcode = '22023';
    end if;
    if escala.tipo_escala = 'numerica' then
      if valor_solicitado !~ '^-?[0-9]+([.][0-9]+)?$' then raise exception 'La calificación debe ser numérica.' using errcode = '22023'; end if;
      nota := valor_solicitado::numeric;
      if escala.valor_minimo is null or escala.valor_maximo is null or escala.decimales is null
        or nota < escala.valor_minimo or nota > escala.valor_maximo or nota <> round(nota, escala.decimales) then
        raise exception 'La nota no respeta el rango o los decimales de la escala institucional.' using errcode = '22023';
      end if;
    elsif not exists (select 1 from public.niveles_logro_evaluacion where configuracion_evaluacion_id = escala.id and codigo = valor_solicitado) then
      raise exception 'Selecciona un nivel de logro de la escala institucional.' using errcode = '22023';
    end if;
    if char_length(observacion_solicitada) > 500 then raise exception 'La observación admite hasta 500 caracteres.' using errcode = '22023'; end if;
    insert into public.calificaciones_evaluaciones (evaluacion_id, matricula_id, valor, observacion, registrado_por, actualizado_por)
    values (evaluacion_id_solicitada, matricula, valor_solicitado, observacion_solicitada, auth.uid(), auth.uid())
    on conflict (evaluacion_id, matricula_id) do update set valor = excluded.valor, observacion = excluded.observacion, actualizado_por = auth.uid();
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke all on function public.guardar_calificaciones_docente(bigint, jsonb) from public, anon;
grant execute on function public.guardar_calificaciones_docente(bigint, jsonb) to authenticated;

create table public.comunicados_institucionales (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(btrim(titulo)) between 1 and 160),
  contenido text not null check (char_length(btrim(contenido)) between 1 and 10000),
  destinatarios public.rol_portal[] not null default array['docente']::public.rol_portal[],
  publicado boolean not null default false,
  publicado_en timestamptz not null default now(),
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table public.comunicados_institucionales enable row level security;
create policy "destinatarios leen comunicados publicados" on public.comunicados_institucionales for select to authenticated
using (publicado and publicado_en <= now() and public.rol_portal_actual() = any(destinatarios));
create policy "direccion administra comunicados" on public.comunicados_institucionales for all to authenticated
using (public.rol_portal_actual() = 'direccion') with check (public.rol_portal_actual() = 'direccion');
revoke all on public.comunicados_institucionales from public, anon, authenticated;
grant select, insert, update, delete on public.comunicados_institucionales to authenticated;
grant usage, select on sequence public.comunicados_institucionales_id_seq to authenticated;

create or replace function public.guardar_asistencia_docente(
  seccion_id_solicitada bigint,
  fecha_solicitada date,
  registros_solicitados jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  registro jsonb;
  matricula_solicitada bigint;
  estado_solicitado text;
  minutos_solicitados smallint;
  observacion_solicitada text;
  anio_inicio date;
  anio_fin date;
  anio_estado text;
  total integer := 0;
begin
  if not public.docente_tiene_seccion(seccion_id_solicitada) then
    raise exception 'Solo un docente asignado a esta sección puede registrar asistencia.' using errcode = '42501';
  end if;

  select a.inicia_en, a.termina_en, a.estado
    into anio_inicio, anio_fin, anio_estado
  from public.secciones s
  join public.anios_academicos a on a.id = s.anio_academico_id
  where s.id = seccion_id_solicitada and s.activo;

  if anio_inicio is null then
    raise exception 'El salon seleccionado no esta disponible.' using errcode = '22023';
  end if;
  if anio_estado = 'cerrado' then
    raise exception 'El ano lectivo cerrado es solo de consulta.' using errcode = '22023';
  end if;
  if fecha_solicitada is null or fecha_solicitada < anio_inicio or fecha_solicitada > anio_fin then
    raise exception 'La fecha debe pertenecer al ano lectivo seleccionado.' using errcode = '22023';
  end if;
  if fecha_solicitada > ((now() at time zone 'America/Lima')::date) then
    raise exception 'No se puede registrar asistencia en una fecha futura.' using errcode = '22023';
  end if;
  if registros_solicitados is null or jsonb_typeof(registros_solicitados) <> 'array' then
    raise exception 'Envía una lista de asistencia.' using errcode = '22023';
  end if;
  if jsonb_array_length(registros_solicitados) not between 1 and 500 then
    raise exception 'Registra al menos un estudiante.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(seccion_id_solicitada::integer, (fecha_solicitada - date '2000-01-01')::integer);

  for registro in select value from jsonb_array_elements(registros_solicitados)
  loop
    matricula_solicitada := nullif(registro->>'enrollmentId', '')::bigint;
    estado_solicitado := registro->>'status';
    minutos_solicitados := nullif(registro->>'lateMinutes', '')::smallint;
    observacion_solicitada := nullif(btrim(registro->>'note'), '');

    if not exists (
      select 1 from public.matriculas_estudiantes m
      where m.id = matricula_solicitada
        and m.seccion_id = seccion_id_solicitada
        and m.estado = 'active'
        and m.archivado_en is null
    ) then
      raise exception 'Una matricula no pertenece al salon seleccionado.' using errcode = '22023';
    end if;
    if estado_solicitado is null or estado_solicitado not in ('presente', 'tardanza', 'ausente') then
      raise exception 'Selecciona un estado valido para cada estudiante.' using errcode = '22023';
    end if;
    if estado_solicitado = 'tardanza' and coalesce(minutos_solicitados, 0) not between 1 and 240 then
      raise exception 'Indica entre 1 y 240 minutos de tardanza.' using errcode = '22023';
    end if;
    if char_length(coalesce(observacion_solicitada, '')) > 240 then
      raise exception 'La observacion no puede superar 240 caracteres.' using errcode = '22023';
    end if;

    insert into public.asistencias_estudiantes (
      matricula_id, fecha, estado, minutos_tardanza, observacion, registrado_por, actualizado_por
    ) values (
      matricula_solicitada,
      fecha_solicitada,
      estado_solicitado,
      case when estado_solicitado = 'tardanza' then minutos_solicitados else null end,
      observacion_solicitada,
      auth.uid(),
      auth.uid()
    )
    on conflict (matricula_id, fecha) do update set
      estado = excluded.estado,
      minutos_tardanza = excluded.minutos_tardanza,
      observacion = excluded.observacion,
      actualizado_por = auth.uid();
    total := total + 1;
  end loop;

  return total;
end;
$$;
revoke all on function public.guardar_asistencia_docente(bigint, date, jsonb) from public, anon;
grant execute on function public.guardar_asistencia_docente(bigint, date, jsonb) to authenticated;

commit;
