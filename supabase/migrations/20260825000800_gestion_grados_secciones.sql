-- Gestión real de grados y secciones.
-- No inserta registros de demostración.

begin;

alter table public.grados
  add column if not exists activo boolean not null default true,
  add column if not exists creado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists creado_en timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

alter table public.secciones
  add column if not exists creado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists creado_en timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

alter table public.grados
  drop constraint if exists grados_nombre_no_vacio,
  add constraint grados_nombre_no_vacio check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 40),
  drop constraint if exists grados_orden_positivo,
  add constraint grados_orden_positivo check (orden > 0);

alter table public.secciones
  drop constraint if exists secciones_nombre_no_vacio,
  add constraint secciones_nombre_no_vacio check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 20),
  drop constraint if exists secciones_capacidad_valida,
  add constraint secciones_capacidad_valida check (capacidad is null or capacidad between 1 and 200);

create index if not exists grados_nivel_orden_idx on public.grados (nivel_id, orden, nombre);
create index if not exists secciones_anio_grado_idx on public.secciones (anio_academico_id, grado_id, nombre);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'grados_actualizado' and tgrelid = 'public.grados'::regclass) then
    create trigger grados_actualizado before update on public.grados
    for each row execute function public.establecer_actualizado_en();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'secciones_actualizado' and tgrelid = 'public.secciones'::regclass) then
    create trigger secciones_actualizado before update on public.secciones
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

create or replace function public.guardar_grado(
  grado_id_solicitado bigint,
  nivel_id_solicitado bigint,
  nombre_solicitado text,
  orden_solicitado smallint,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  grado_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
  nivel_actual bigint;
  orden_calculado smallint;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los grados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.niveles_educativos where id = nivel_id_solicitado) then
    raise exception 'Selecciona un nivel educativo válido.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 40 then
    raise exception 'El nombre del grado debe contener entre 1 y 40 caracteres.' using errcode = '22023';
  end if;
  if grado_id_solicitado is null then
    select (coalesce(max(orden), 0) + 1)::smallint
      into orden_calculado
      from public.grados
     where nivel_id = nivel_id_solicitado;
    insert into public.grados (nivel_id, nombre, orden, activo, creado_por, actualizado_por)
    values (nivel_id_solicitado, nombre_limpio, orden_calculado, coalesce(activo_solicitado, true), auth.uid(), auth.uid())
    returning id into grado_id_resultado;
  else
    select nivel_id into nivel_actual from public.grados where id = grado_id_solicitado;
    if nivel_actual is null then raise exception 'El grado no existe.' using errcode = '22023'; end if;
    if nivel_actual <> nivel_id_solicitado and exists (select 1 from public.secciones where grado_id = grado_id_solicitado) then
      raise exception 'No puedes cambiar de nivel un grado que ya tiene secciones.' using errcode = '23503';
    end if;
    update public.grados
    set nivel_id = nivel_id_solicitado, nombre = nombre_limpio,
        activo = coalesce(activo_solicitado, true), actualizado_por = auth.uid()
    where id = grado_id_solicitado returning id into grado_id_resultado;
  end if;
  return grado_id_resultado;
exception
  when unique_violation then
    raise exception 'Ese grado ya está registrado en el nivel seleccionado.' using errcode = '23505';
end;
$$;

create or replace function public.eliminar_grado(grado_id_solicitado bigint)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar grados.' using errcode = '42501';
  end if;
  if exists (select 1 from public.secciones where grado_id = grado_id_solicitado) then
    raise exception 'No se puede eliminar un grado que ya tiene secciones.' using errcode = '23503';
  end if;
  delete from public.grados where id = grado_id_solicitado;
  if not found then raise exception 'El grado no existe.' using errcode = '22023'; end if;
end;
$$;

create or replace function public.guardar_seccion(
  seccion_id_solicitada bigint,
  anio_academico_id_solicitado bigint,
  grado_id_solicitado bigint,
  nombre_solicitado text,
  turno_solicitado text,
  capacidad_solicitada smallint,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  seccion_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar las secciones.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.anios_academicos where id = anio_academico_id_solicitado and estado <> 'cerrado') then
    raise exception 'Selecciona un año lectivo disponible. Los años cerrados son solo de consulta.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados where id = grado_id_solicitado) then
    raise exception 'Selecciona un grado válido.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 20 then
    raise exception 'El nombre de la sección debe contener entre 1 y 20 caracteres.' using errcode = '22023';
  end if;
  if turno_solicitado not in ('mañana', 'tarde') then
    raise exception 'Selecciona un turno válido.' using errcode = '22023';
  end if;
  if capacidad_solicitada is not null and (capacidad_solicitada < 1 or capacidad_solicitada > 200) then
    raise exception 'La capacidad debe estar entre 1 y 200 estudiantes.' using errcode = '22023';
  end if;

  if seccion_id_solicitada is null then
    insert into public.secciones (anio_academico_id, grado_id, nombre, turno, capacidad, activo, creado_por, actualizado_por)
    values (anio_academico_id_solicitado, grado_id_solicitado, nombre_limpio, turno_solicitado, capacidad_solicitada, coalesce(activo_solicitado, true), auth.uid(), auth.uid())
    returning id into seccion_id_resultado;
  else
    update public.secciones
    set anio_academico_id = anio_academico_id_solicitado, grado_id = grado_id_solicitado,
        nombre = nombre_limpio, turno = turno_solicitado, capacidad = capacidad_solicitada,
        activo = coalesce(activo_solicitado, true), actualizado_por = auth.uid()
    where id = seccion_id_solicitada returning id into seccion_id_resultado;
    if seccion_id_resultado is null then raise exception 'La sección no existe.' using errcode = '22023'; end if;
  end if;
  return seccion_id_resultado;
end;
$$;

create or replace function public.eliminar_seccion(seccion_id_solicitada bigint)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar secciones.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.secciones s
    join public.anios_academicos a on a.id = s.anio_academico_id
    where s.id = seccion_id_solicitada and a.estado = 'cerrado'
  ) then
    raise exception 'Las secciones de un año cerrado son solo de consulta.' using errcode = '22023';
  end if;
  delete from public.secciones where id = seccion_id_solicitada;
  if not found then raise exception 'La sección no existe.' using errcode = '22023'; end if;
exception
  when foreign_key_violation then
    raise exception 'No se puede eliminar una sección que ya tiene información académica asociada.' using errcode = '23503';
end;
$$;

revoke all on function public.guardar_grado(bigint, bigint, text, smallint, boolean) from public, anon;
revoke all on function public.eliminar_grado(bigint) from public, anon;
revoke all on function public.guardar_seccion(bigint, bigint, bigint, text, text, smallint, boolean) from public, anon;
revoke all on function public.eliminar_seccion(bigint) from public, anon;
grant execute on function public.guardar_grado(bigint, bigint, text, smallint, boolean) to authenticated;
grant execute on function public.eliminar_grado(bigint) to authenticated;
grant execute on function public.guardar_seccion(bigint, bigint, bigint, text, text, smallint, boolean) to authenticated;
grant execute on function public.eliminar_seccion(bigint) to authenticated;

create or replace function public.guardar_grado_con_salones(
  grado_id_solicitado bigint,
  nivel_id_solicitado bigint,
  nombre_solicitado text,
  orden_solicitado smallint,
  activo_solicitado boolean,
  anio_academico_id_solicitado bigint,
  salones_solicitados jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  grado_id_resultado bigint;
  salon jsonb;
  salon_id bigint;
  salon_id_resultado bigint;
  salon_ids bigint[] := array[]::bigint[];
  salon_nombre text;
  salon_turno text;
  salon_capacidad smallint;
begin
  if jsonb_typeof(salones_solicitados) <> 'array'
     or jsonb_array_length(salones_solicitados) not between 1 and 3 then
    raise exception 'Selecciona entre 1 y 3 salones para el grado.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.anios_academicos
    where id = anio_academico_id_solicitado and estado <> 'cerrado'
  ) then
    raise exception 'Selecciona un año lectivo disponible.' using errcode = '22023';
  end if;

  grado_id_resultado := public.guardar_grado(
    grado_id_solicitado, nivel_id_solicitado, nombre_solicitado,
    orden_solicitado, activo_solicitado
  );

  for salon in select value from jsonb_array_elements(salones_solicitados)
  loop
    salon_id := nullif(salon ->> 'id', '')::bigint;
    salon_nombre := btrim(salon ->> 'name');
    salon_turno := salon ->> 'shift';
    salon_capacidad := nullif(salon ->> 'capacity', '')::smallint;

    if salon_id is not null and not exists (
      select 1 from public.secciones
      where id = salon_id and grado_id = grado_id_resultado
        and anio_academico_id = anio_academico_id_solicitado
    ) then
      raise exception 'Uno de los salones no pertenece al grado seleccionado.' using errcode = '22023';
    end if;

    salon_id_resultado := public.guardar_seccion(
      salon_id, anio_academico_id_solicitado, grado_id_resultado,
      salon_nombre, salon_turno, salon_capacidad, true
    );
    salon_ids := array_append(salon_ids, salon_id_resultado);
  end loop;

  delete from public.secciones
  where grado_id = grado_id_resultado
    and anio_academico_id = anio_academico_id_solicitado
    and not (id = any(salon_ids));

  return grado_id_resultado;
exception
  when foreign_key_violation then
    raise exception 'No puedes retirar un salón que ya tiene información académica asociada.' using errcode = '23503';
end;
$$;

create or replace function public.eliminar_grado_completo(grado_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar grados.' using errcode = '42501';
  end if;
  delete from public.secciones where grado_id = grado_id_solicitado;
  delete from public.grados where id = grado_id_solicitado;
  if not found then raise exception 'El grado no existe.' using errcode = '22023'; end if;
exception
  when foreign_key_violation then
    raise exception 'No se puede eliminar un grado cuyos salones ya tienen información académica.' using errcode = '23503';
end;
$$;

revoke all on function public.guardar_grado_con_salones(bigint, bigint, text, smallint, boolean, bigint, jsonb) from public, anon;
revoke all on function public.eliminar_grado_completo(bigint) from public, anon;
grant execute on function public.guardar_grado_con_salones(bigint, bigint, text, smallint, boolean, bigint, jsonb) to authenticated;
grant execute on function public.eliminar_grado_completo(bigint) to authenticated;

commit;
