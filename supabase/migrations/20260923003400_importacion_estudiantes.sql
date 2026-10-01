begin;
alter table public.perfiles add column dni text check (dni is null or dni ~ '^[0-9]{8}$');
create unique index perfiles_dni_unico on public.perfiles(dni) where dni is not null;

create or replace function public.catalogo_importacion_estudiantes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not coalesce(public.es_gestor_materiales(), false) then
    raise exception 'Solo Dirección o Coordinación Académica pueden importar estudiantes.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'years', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', nombre) order by inicia_en desc)
      from public.anios_academicos where estado <> 'cerrado'), '[]'::jsonb),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'yearId', s.anio_academico_id,
      'level', n.nombre, 'grade', g.nombre, 'section', s.nombre, 'capacity', s.capacidad))
      from public.secciones s join public.grados g on g.id = s.grado_id
      join public.niveles_educativos n on n.id = g.nivel_id
      where s.activo and g.activo and n.activo), '[]'::jsonb));
end;
$$;
revoke all on function public.catalogo_importacion_estudiantes() from public, anon;
grant execute on function public.catalogo_importacion_estudiantes() to authenticated;

-- Solo el servidor puede consultar Auth. El navegador nunca recibe una clave administrativa.
create or replace function public.preparar_fila_estudiante(fila jsonb, anio bigint, actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  dni_s text := btrim(fila->>'dni'); correo text := lower(btrim(fila->>'email'));
  nombre text := btrim(fila->>'name'); salon bigint; coincidencias integer;
  cuenta uuid; perfil public.perfiles%rowtype; matricula public.matriculas_estudiantes%rowtype;
  capacidad_s smallint; ocupados integer;
begin
  if not exists(select 1 from public.perfiles where id = actor and activo and rol in ('direccion', 'coordinador_academico')) then
    raise exception 'No tienes permiso para importar estudiantes.' using errcode = '42501';
  end if;
  if dni_s is null or dni_s !~ '^[0-9]{8}$' then raise exception 'El DNI debe contener 8 dígitos.'; end if;
  if nombre is null or char_length(nombre) not between 3 and 160 then raise exception 'Revisa nombres y apellidos.'; end if;
  if correo is null or correo !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or char_length(correo) > 254 then raise exception 'Correo inválido.'; end if;
  if not exists(select 1 from public.anios_academicos where id = anio and estado <> 'cerrado') then raise exception 'El año no está disponible.'; end if;
  select count(*), min(s.id) into coincidencias, salon
  from public.secciones s join public.grados g on g.id = s.grado_id join public.niveles_educativos n on n.id = g.nivel_id
  where s.anio_academico_id = anio and s.activo and g.activo and n.activo
    and lower(btrim(n.nombre)) = lower(btrim(fila->>'level'))
    and lower(btrim(g.nombre)) = lower(btrim(fila->>'grade'))
    and lower(btrim(s.nombre)) = lower(btrim(fila->>'section'));
  if coincidencias <> 1 then raise exception 'Nivel, grado y sección no identifican un salón activo único.'; end if;
  select id into cuenta from auth.users where lower(email) = correo;
  select * into perfil from public.perfiles where dni = dni_s;
  if found and perfil.id is distinct from cuenta then raise exception 'El DNI ya está vinculado a otro correo.'; end if;
  select * into perfil from public.perfiles where id = cuenta;
  if found and (perfil.rol <> 'estudiante' or not perfil.activo or (perfil.dni is not null and perfil.dni <> dni_s)) then
    raise exception 'El correo pertenece a otro rol, otro DNI o una cuenta inactiva.';
  end if;
  if exists(select 1 from auth.users where id = cuenta and (banned_until > now() or deleted_at is not null)) then raise exception 'La cuenta no está habilitada.'; end if;
  if exists(select 1 from auth.users where id = cuenta and email_confirmed_at is null) then raise exception 'Confirma primero el correo de la cuenta existente en Supabase.'; end if;
  select * into matricula from public.matriculas_estudiantes
  where estudiante_id = cuenta and anio_academico_id = anio and archivado_en is null and estado in ('active', 'completed')
  order by id desc limit 1;
  if found and (matricula.seccion_id <> salon or matricula.estado <> 'active') then
    raise exception 'Ya tiene matrícula en otra sección o matrícula completada. Revisa su traslado manualmente.';
  end if;
  if matricula.id is null then
    select capacidad into capacidad_s from public.secciones where id = salon;
    select count(*) into ocupados from public.matriculas_estudiantes where seccion_id = salon and estado = 'active' and archivado_en is null;
    if capacidad_s is not null and ocupados >= capacidad_s then raise exception 'La sección no tiene vacantes.'; end if;
  end if;
  return jsonb_build_object('userId', cuenta, 'sectionId', salon, 'enrolled', matricula.id is not null);
end;
$$;
revoke all on function public.preparar_fila_estudiante(jsonb, bigint, uuid) from public, anon, authenticated;
grant execute on function public.preparar_fila_estudiante(jsonb, bigint, uuid) to service_role;

create or replace function public.confirmar_fila_estudiante(fila jsonb, anio bigint, actor uuid, usuario uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan jsonb; matricula public.matriculas_estudiantes%rowtype; nuevo boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('import-student:' || coalesce(fila->>'dni', ''), 0));
  perform 1 from public.perfiles where id = usuario for update;
  perform 1 from public.anios_academicos where id = anio for share;
  plan := public.preparar_fila_estudiante(fila, anio, actor);
  if (plan->>'userId')::uuid is distinct from usuario then raise exception 'La cuenta no coincide con la fila.'; end if;
  -- Reutiliza las validaciones, auditoría y bloqueo de aforo de la matrícula existente.
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  nuevo := not exists(select 1 from public.perfiles where id = usuario);
  insert into public.perfiles(id, nombre_completo, rol, activo, dni)
    values(usuario, btrim(fila->>'name'), 'estudiante', true, fila->>'dni')
  on conflict(id) do update set nombre_completo = excluded.nombre_completo, dni = excluded.dni;
  if not (plan->>'enrolled')::boolean then
    matricula := public.matricular_estudiante_en_seccion(anio, (plan->>'sectionId')::bigint, usuario);
  end if;
  insert into public.auditoria_usuarios(accion, usuario_objetivo_id, usuario_objetivo_correo, realizado_por, detalle)
    values(case when nuevo then 'crear' else 'actualizar' end, usuario, fila->>'email', actor,
      jsonb_build_object('origen', 'importacion_estudiantes', 'anio', anio, 'seccion', plan->>'sectionId'));
  return jsonb_build_object('userId', usuario, 'sectionId', plan->>'sectionId', 'alreadyEnrolled', (plan->>'enrolled')::boolean);
end;
$$;
revoke all on function public.confirmar_fila_estudiante(jsonb, bigint, uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirmar_fila_estudiante(jsonb, bigint, uuid, uuid) to service_role;
commit;
