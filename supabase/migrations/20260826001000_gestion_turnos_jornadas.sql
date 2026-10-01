-- Gestión real de turnos institucionales y sus jornadas horarias.
-- No inserta turnos ni información de demostración.

begin;

create table if not exists public.turnos_jornadas (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete restrict,
  nombre text not null,
  hora_inicio time not null,
  hora_fin time not null,
  dias_semana smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint turnos_jornadas_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 40),
  constraint turnos_jornadas_horas_validas check (hora_fin > hora_inicio),
  constraint turnos_jornadas_dias_validos check (
    cardinality(dias_semana) between 1 and 7
    and dias_semana <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

create unique index if not exists turnos_jornadas_anio_nombre_uidx
  on public.turnos_jornadas (anio_academico_id, lower(btrim(nombre)));
create index if not exists turnos_jornadas_anio_activo_idx
  on public.turnos_jornadas (anio_academico_id, activo, hora_inicio);

alter table public.turnos_jornadas enable row level security;
drop policy if exists "autenticados leen turnos y jornadas" on public.turnos_jornadas;
create policy "autenticados leen turnos y jornadas"
  on public.turnos_jornadas for select to authenticated using (true);
drop policy if exists "direccion administra turnos y jornadas" on public.turnos_jornadas;
create policy "direccion administra turnos y jornadas"
  on public.turnos_jornadas for all to authenticated
  using ((select public.rol_portal_actual()) = 'direccion')
  with check ((select public.rol_portal_actual()) = 'direccion');

grant select, insert, update, delete on table public.turnos_jornadas to authenticated;
grant usage, select on sequence public.turnos_jornadas_id_seq to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'turnos_jornadas_actualizado'
      and tgrelid = 'public.turnos_jornadas'::regclass
  ) then
    create trigger turnos_jornadas_actualizado
    before update on public.turnos_jornadas
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

alter table public.secciones
  add column if not exists turno_jornada_id bigint references public.turnos_jornadas(id) on delete restrict;

alter table public.secciones
  drop constraint if exists secciones_turno_check,
  drop constraint if exists secciones_turno_no_vacio,
  add constraint secciones_turno_no_vacio check (btrim(turno) <> '' and char_length(btrim(turno)) <= 40);

create index if not exists secciones_turno_jornada_idx
  on public.secciones (turno_jornada_id)
  where turno_jornada_id is not null;

create or replace function public.sincronizar_turno_seccion()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  turno_asignado public.turnos_jornadas%rowtype;
begin
  if new.turno_jornada_id is null then
    return new;
  end if;

  select * into turno_asignado
  from public.turnos_jornadas
  where id = new.turno_jornada_id;

  if turno_asignado.id is null or turno_asignado.anio_academico_id <> new.anio_academico_id then
    raise exception 'El turno seleccionado no pertenece al año lectivo del salón.' using errcode = '22023';
  end if;

  new.turno := turno_asignado.nombre;
  return new;
end;
$$;

drop trigger if exists secciones_sincronizar_turno on public.secciones;
create trigger secciones_sincronizar_turno
before insert or update of turno_jornada_id, anio_academico_id on public.secciones
for each row execute function public.sincronizar_turno_seccion();

create or replace function public.propagar_nombre_turno()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.nombre is distinct from old.nombre then
    update public.secciones
       set turno = new.nombre
     where turno_jornada_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists turnos_jornadas_propagar_nombre on public.turnos_jornadas;
create trigger turnos_jornadas_propagar_nombre
after update of nombre on public.turnos_jornadas
for each row execute function public.propagar_nombre_turno();

create or replace function public.guardar_turno_jornada(
  turno_id_solicitado bigint,
  anio_academico_id_solicitado bigint,
  nombre_solicitado text,
  hora_inicio_solicitada time,
  hora_fin_solicitada time,
  dias_semana_solicitados smallint[],
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  turno_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
  dias_limpios smallint[];
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los turnos.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.anios_academicos
    where id = anio_academico_id_solicitado and estado <> 'cerrado'
  ) then
    raise exception 'Selecciona un año lectivo disponible.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 40 then
    raise exception 'El nombre del turno debe contener entre 1 y 40 caracteres.' using errcode = '22023';
  end if;
  if hora_inicio_solicitada is null or hora_fin_solicitada is null or hora_fin_solicitada <= hora_inicio_solicitada then
    raise exception 'La hora de salida debe ser posterior a la hora de ingreso.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct dia order by dia), array[]::smallint[])
    into dias_limpios
    from unnest(coalesce(dias_semana_solicitados, array[]::smallint[])) dia;

  if cardinality(dias_limpios) = 0 or not (dias_limpios <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]) then
    raise exception 'Selecciona al menos un día de clase válido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.turnos_jornadas
    where anio_academico_id = anio_academico_id_solicitado
      and lower(btrim(nombre)) = lower(nombre_limpio)
      and id is distinct from turno_id_solicitado
  ) then
    raise exception 'Ya existe un turno con ese nombre en el año lectivo seleccionado.' using errcode = '23505';
  end if;

  if turno_id_solicitado is not null and exists (
    select 1 from public.turnos_jornadas t
    join public.anios_academicos a on a.id = t.anio_academico_id
    where t.id = turno_id_solicitado and a.estado = 'cerrado'
  ) then
    raise exception 'Los turnos de un año cerrado son solo de consulta.' using errcode = '22023';
  end if;
  if turno_id_solicitado is not null and exists (
    select 1 from public.turnos_jornadas t
    where t.id = turno_id_solicitado
      and t.anio_academico_id <> anio_academico_id_solicitado
      and exists (select 1 from public.secciones s where s.turno_jornada_id = t.id)
  ) then
    raise exception 'No puedes cambiar de año un turno que ya está asignado a salones.' using errcode = '23503';
  end if;

  if turno_id_solicitado is null then
    insert into public.turnos_jornadas (
      anio_academico_id, nombre, hora_inicio, hora_fin, dias_semana,
      activo, creado_por, actualizado_por
    ) values (
      anio_academico_id_solicitado, nombre_limpio, hora_inicio_solicitada,
      hora_fin_solicitada, dias_limpios, coalesce(activo_solicitado, true),
      auth.uid(), auth.uid()
    ) returning id into turno_id_resultado;
  else
    update public.turnos_jornadas
       set anio_academico_id = anio_academico_id_solicitado,
           nombre = nombre_limpio,
           hora_inicio = hora_inicio_solicitada,
           hora_fin = hora_fin_solicitada,
           dias_semana = dias_limpios,
           activo = coalesce(activo_solicitado, true),
           actualizado_por = auth.uid()
     where id = turno_id_solicitado
     returning id into turno_id_resultado;

    if turno_id_resultado is null then
      raise exception 'El turno no existe.' using errcode = '22023';
    end if;
  end if;

  return turno_id_resultado;
end;
$$;

create or replace function public.eliminar_turno_jornada(turno_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar turnos.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.turnos_jornadas t
    join public.anios_academicos a on a.id = t.anio_academico_id
    where t.id = turno_id_solicitado and a.estado = 'cerrado'
  ) then
    raise exception 'Los turnos de un año cerrado son solo de consulta.' using errcode = '22023';
  end if;

  delete from public.turnos_jornadas where id = turno_id_solicitado;
  if not found then
    raise exception 'El turno no existe.' using errcode = '22023';
  end if;
exception
  when foreign_key_violation then
    raise exception 'No puedes eliminar un turno que ya está asignado a uno o más salones.' using errcode = '23503';
end;
$$;

revoke all on function public.guardar_turno_jornada(bigint, bigint, text, time, time, smallint[], boolean) from public, anon;
revoke all on function public.eliminar_turno_jornada(bigint) from public, anon;
revoke all on function public.sincronizar_turno_seccion() from public, anon, authenticated;
revoke all on function public.propagar_nombre_turno() from public, anon, authenticated;
grant execute on function public.guardar_turno_jornada(bigint, bigint, text, time, time, smallint[], boolean) to authenticated;
grant execute on function public.eliminar_turno_jornada(bigint) to authenticated;

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
  turno_limpio text := btrim(turno_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar los salones.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.anios_academicos where id = anio_academico_id_solicitado and estado <> 'cerrado') then
    raise exception 'Selecciona un año lectivo disponible. Los años cerrados son solo de consulta.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados where id = grado_id_solicitado) then
    raise exception 'Selecciona un grado válido.' using errcode = '22023';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 20 then
    raise exception 'El nombre del salón debe contener entre 1 y 20 caracteres.' using errcode = '22023';
  end if;
  if turno_limpio is null or turno_limpio = '' or char_length(turno_limpio) > 40 then
    raise exception 'Selecciona un turno válido.' using errcode = '22023';
  end if;
  if capacidad_solicitada is not null and (capacidad_solicitada < 1 or capacidad_solicitada > 200) then
    raise exception 'La capacidad debe estar entre 1 y 200 estudiantes.' using errcode = '22023';
  end if;

  if seccion_id_solicitada is null then
    insert into public.secciones (anio_academico_id, grado_id, nombre, turno, capacidad, activo, creado_por, actualizado_por)
    values (anio_academico_id_solicitado, grado_id_solicitado, nombre_limpio, turno_limpio, capacidad_solicitada, coalesce(activo_solicitado, true), auth.uid(), auth.uid())
    returning id into seccion_id_resultado;
  else
    update public.secciones
       set anio_academico_id = anio_academico_id_solicitado,
           grado_id = grado_id_solicitado,
           nombre = nombre_limpio,
           turno = turno_limpio,
           capacidad = capacidad_solicitada,
           activo = coalesce(activo_solicitado, true),
           actualizado_por = auth.uid()
     where id = seccion_id_solicitada
     returning id into seccion_id_resultado;
    if seccion_id_resultado is null then
      raise exception 'El salón no existe.' using errcode = '22023';
    end if;
  end if;
  return seccion_id_resultado;
end;
$$;

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
  salon_turno_id bigint;
  salon_turno_nombre text;
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
    salon_turno_id := nullif(salon ->> 'shiftId', '')::bigint;
    salon_capacidad := nullif(salon ->> 'capacity', '')::smallint;

    select nombre into salon_turno_nombre
      from public.turnos_jornadas
     where id = salon_turno_id
       and anio_academico_id = anio_academico_id_solicitado
       and activo;
    if salon_turno_nombre is null then
      raise exception 'Selecciona un turno activo para cada salón.' using errcode = '22023';
    end if;

    if salon_id is not null and not exists (
      select 1 from public.secciones
      where id = salon_id and grado_id = grado_id_resultado
        and anio_academico_id = anio_academico_id_solicitado
    ) then
      raise exception 'Uno de los salones no pertenece al grado seleccionado.' using errcode = '22023';
    end if;

    salon_id_resultado := public.guardar_seccion(
      salon_id, anio_academico_id_solicitado, grado_id_resultado,
      salon_nombre, salon_turno_nombre, salon_capacidad, true
    );
    update public.secciones
       set turno_jornada_id = salon_turno_id
     where id = salon_id_resultado;
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

revoke all on function public.guardar_seccion(bigint, bigint, bigint, text, text, smallint, boolean) from public, anon;
revoke all on function public.guardar_grado_con_salones(bigint, bigint, text, smallint, boolean, bigint, jsonb) from public, anon;
grant execute on function public.guardar_seccion(bigint, bigint, bigint, text, text, smallint, boolean) to authenticated;
grant execute on function public.guardar_grado_con_salones(bigint, bigint, text, smallint, boolean, bigint, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'turnos_jornadas'
     ) then
    alter publication supabase_realtime add table public.turnos_jornadas;
  end if;
end $$;

commit;
