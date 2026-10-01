-- Portal de familia: apoderados vinculados a sus hijos.
-- Acceso: correo DNI@familias.maxplanck.edu.pe y clave inicial = DNI del apoderado,
-- creado desde la importación de estudiantes. Un apoderado con varios hijos usa una sola cuenta.
begin;

create table public.apoderados_estudiantes (
  id bigint generated always as identity primary key,
  apoderado_id uuid not null references public.perfiles(id) on delete cascade,
  estudiante_id uuid not null references public.perfiles(id) on delete cascade,
  parentesco text not null default 'apoderado' check (parentesco in ('madre', 'padre', 'apoderado', 'otro')),
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (apoderado_id, estudiante_id)
);
create index apoderados_estudiantes_estudiante_idx on public.apoderados_estudiantes (estudiante_id);
alter table public.apoderados_estudiantes enable row level security;
create policy "apoderado ve sus vinculos" on public.apoderados_estudiantes for select to authenticated
  using (apoderado_id = auth.uid() or (select public.rol_portal_actual())::text in ('direccion', 'coordinador_academico'));
revoke all on table public.apoderados_estudiantes from public, anon, authenticated;
grant select on table public.apoderados_estudiantes to authenticated;
grant select, insert, update on table public.apoderados_estudiantes to service_role;

-- Datos académicos de un estudiante. Interna: solo la usan los paneles que ya validaron la identidad.
create or replace function public.datos_panel_estudiante(estudiante uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb;
begin
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
    where m.estudiante_id = estudiante and m.archivado_en is null and m.estado in ('active', 'completed')
  ) matriculas;
  return resultado;
end;
$$;
revoke all on function public.datos_panel_estudiante(uuid) from public, anon, authenticated;

create or replace function public.cargar_panel_estudiante()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public.rol_portal_actual() is distinct from 'estudiante'::public.rol_portal then
    raise exception 'Solo un estudiante activo puede consultar este panel.' using errcode = '42501';
  end if;
  return public.datos_panel_estudiante(auth.uid());
end;
$$;
revoke all on function public.cargar_panel_estudiante() from public, anon;
grant execute on function public.cargar_panel_estudiante() to authenticated;

-- Panel de familia: solo los hijos vinculados a la cuenta autenticada.
create or replace function public.cargar_panel_familia()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public.rol_portal_actual() is distinct from 'familia'::public.rol_portal then
    raise exception 'Solo una cuenta de familia activa puede consultar este panel.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.nombre_completo, 'relation', v.parentesco,
      'enrollments', public.datos_panel_estudiante(p.id)) order by p.nombre_completo)
    from public.apoderados_estudiantes v join public.perfiles p on p.id = v.estudiante_id
    where v.apoderado_id = auth.uid() and p.activo and p.rol = 'estudiante'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.cargar_panel_familia() from public, anon;
grant execute on function public.cargar_panel_familia() to authenticated;

-- Importación: comprueba el correo del apoderado. Consulta Auth, por eso solo la usa el servidor.
create or replace function public.preparar_apoderado(actor uuid, dni text, correo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cuenta uuid; perfil public.perfiles%rowtype;
begin
  if not exists(select 1 from public.perfiles where id = actor and activo and rol in ('direccion', 'coordinador_academico')) then
    raise exception 'No tienes permiso para registrar apoderados.' using errcode = '42501';
  end if;
  if dni is null or dni !~ '^[0-9]{8}$' then raise exception 'El DNI del apoderado debe tener 8 dígitos.'; end if;
  select id into cuenta from auth.users where lower(email) = lower(correo);
  select * into perfil from public.perfiles where perfiles.dni = preparar_apoderado.dni;
  if found and perfil.id is distinct from cuenta then raise exception 'El DNI del apoderado ya está vinculado a otra cuenta.'; end if;
  select * into perfil from public.perfiles where id = cuenta;
  if found and (perfil.rol <> 'familia' or not perfil.activo) then
    raise exception 'El correo del apoderado pertenece a otro rol o a una cuenta inactiva.';
  end if;
  return jsonb_build_object('userId', cuenta);
end;
$$;
revoke all on function public.preparar_apoderado(uuid, text, text) from public, anon, authenticated;
grant execute on function public.preparar_apoderado(uuid, text, text) to service_role;

create or replace function public.vincular_apoderado(actor uuid, estudiante uuid, apoderado uuid, nombre text, dni text, parentesco text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.perfiles where id = actor and activo and rol in ('direccion', 'coordinador_academico')) then
    raise exception 'No tienes permiso para registrar apoderados.' using errcode = '42501';
  end if;
  if not exists(select 1 from public.perfiles where id = estudiante and rol = 'estudiante') then
    raise exception 'El estudiante no existe.';
  end if;
  if char_length(btrim(coalesce(nombre, ''))) not between 3 and 160 then raise exception 'Escribe el nombre del apoderado.'; end if;
  insert into public.perfiles(id, nombre_completo, rol, activo, dni)
    values(apoderado, btrim(nombre), 'familia', true, dni)
  on conflict(id) do update set dni = coalesce(public.perfiles.dni, excluded.dni)
    where public.perfiles.rol = 'familia';
  if not exists(select 1 from public.perfiles where id = apoderado and rol = 'familia') then
    raise exception 'La cuenta del apoderado pertenece a otro rol.';
  end if;
  insert into public.apoderados_estudiantes(apoderado_id, estudiante_id, parentesco, creado_por)
    values(apoderado, estudiante, coalesce(parentesco, 'apoderado'), actor)
  on conflict(apoderado_id, estudiante_id) do update set parentesco = excluded.parentesco;
end;
$$;
revoke all on function public.vincular_apoderado(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.vincular_apoderado(uuid, uuid, uuid, text, text, text) to service_role;

commit;
