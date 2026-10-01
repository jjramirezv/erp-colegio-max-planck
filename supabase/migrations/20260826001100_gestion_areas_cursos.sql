-- Gestión curricular por año y grado, integrada con los cursos por salón.
-- No inserta áreas, cursos ni información de demostración.

begin;

create table if not exists public.areas_curriculares (
  id bigint generated always as identity primary key,
  nombre text not null,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint areas_curriculares_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 80)
);

create unique index if not exists areas_curriculares_nombre_uidx
  on public.areas_curriculares (lower(btrim(nombre)));
create index if not exists areas_curriculares_activas_idx
  on public.areas_curriculares (activo, nombre);

create table if not exists public.cursos_grado (
  id bigint generated always as identity primary key,
  anio_academico_id bigint not null references public.anios_academicos(id) on delete restrict,
  grado_id bigint not null references public.grados(id) on delete restrict,
  area_curricular_id bigint references public.areas_curriculares(id) on delete restrict,
  asignatura_id bigint not null references public.asignaturas(id) on delete restrict,
  horas_semanales smallint not null,
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  actualizado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cursos_grado_horas_validas check (horas_semanales between 1 and 40),
  unique (anio_academico_id, grado_id, asignatura_id)
);

create index if not exists cursos_grado_contexto_idx
  on public.cursos_grado (anio_academico_id, grado_id, area_curricular_id, activo);
create index if not exists cursos_grado_asignatura_idx
  on public.cursos_grado (asignatura_id);

alter table public.areas_curriculares enable row level security;
alter table public.cursos_grado enable row level security;

drop policy if exists "autenticados leen areas curriculares" on public.areas_curriculares;
create policy "autenticados leen areas curriculares"
  on public.areas_curriculares for select to authenticated using (true);
drop policy if exists "direccion administra areas curriculares" on public.areas_curriculares;
create policy "direccion administra areas curriculares"
  on public.areas_curriculares for all to authenticated
  using ((select public.rol_portal_actual()) = 'direccion')
  with check ((select public.rol_portal_actual()) = 'direccion');

drop policy if exists "autenticados leen cursos por grado" on public.cursos_grado;
create policy "autenticados leen cursos por grado"
  on public.cursos_grado for select to authenticated using (true);
drop policy if exists "direccion administra cursos por grado" on public.cursos_grado;
create policy "direccion administra cursos por grado"
  on public.cursos_grado for all to authenticated
  using ((select public.rol_portal_actual()) = 'direccion')
  with check ((select public.rol_portal_actual()) = 'direccion');

grant select, insert, update, delete on table public.areas_curriculares, public.cursos_grado to authenticated;
grant usage, select on sequence public.areas_curriculares_id_seq, public.cursos_grado_id_seq to authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'areas_curriculares_actualizado' and tgrelid = 'public.areas_curriculares'::regclass) then
    create trigger areas_curriculares_actualizado before update on public.areas_curriculares
    for each row execute function public.establecer_actualizado_en();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'cursos_grado_actualizado' and tgrelid = 'public.cursos_grado'::regclass) then
    create trigger cursos_grado_actualizado before update on public.cursos_grado
    for each row execute function public.establecer_actualizado_en();
  end if;
end $$;

create or replace function public.sincronizar_cursos_de_grado(
  anio_id_solicitado bigint,
  grado_id_solicitado bigint,
  asignatura_id_solicitada bigint default null
)
returns void
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede sincronizar los cursos del grado.' using errcode = '42501';
  end if;

  update public.cursos_seccion cs
     set horas_semanales = cg.horas_semanales,
         activo = cg.activo,
         actualizado_por = auth.uid()
    from public.secciones s, public.cursos_grado cg
   where cs.seccion_id = s.id
     and s.anio_academico_id = anio_id_solicitado
     and s.grado_id = grado_id_solicitado
     and cg.anio_academico_id = anio_id_solicitado
     and cg.grado_id = grado_id_solicitado
     and cg.asignatura_id = cs.asignatura_id
     and cs.archivado_en is null
     and (asignatura_id_solicitada is null or cg.asignatura_id = asignatura_id_solicitada);

  insert into public.cursos_seccion (
    anio_academico_id, seccion_id, asignatura_id, horas_semanales,
    activo, creado_por, actualizado_por
  )
  select cg.anio_academico_id, s.id, cg.asignatura_id, cg.horas_semanales,
         true, auth.uid(), auth.uid()
    from public.cursos_grado cg
    join public.secciones s
      on s.anio_academico_id = cg.anio_academico_id
     and s.grado_id = cg.grado_id
     and s.activo
   where cg.anio_academico_id = anio_id_solicitado
     and cg.grado_id = grado_id_solicitado
     and cg.activo
     and (asignatura_id_solicitada is null or cg.asignatura_id = asignatura_id_solicitada)
     and not exists (
       select 1 from public.cursos_seccion cs
       where cs.seccion_id = s.id
         and cs.asignatura_id = cg.asignatura_id
         and cs.archivado_en is null
     );
end;
$$;

create or replace function public.sincronizar_cursos_nuevo_salon()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.activo then
    perform public.sincronizar_cursos_de_grado(new.anio_academico_id, new.grado_id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists secciones_sincronizar_cursos_grado on public.secciones;
create trigger secciones_sincronizar_cursos_grado
after insert on public.secciones
for each row execute function public.sincronizar_cursos_nuevo_salon();

create or replace function public.guardar_area_curricular(
  area_id_solicitada bigint,
  nombre_solicitado text,
  activo_solicitado boolean
)
returns bigint
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  area_id_resultado bigint;
  nombre_limpio text := btrim(nombre_solicitado);
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar las áreas curriculares.' using errcode = '42501';
  end if;
  if nombre_limpio is null or nombre_limpio = '' or char_length(nombre_limpio) > 80 then
    raise exception 'El nombre del área debe contener entre 1 y 80 caracteres.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.areas_curriculares
    where lower(btrim(nombre)) = lower(nombre_limpio)
      and id is distinct from area_id_solicitada
  ) then
    raise exception 'Ya existe un área curricular con ese nombre.' using errcode = '23505';
  end if;

  if area_id_solicitada is null then
    insert into public.areas_curriculares (nombre, activo, creado_por, actualizado_por)
    values (nombre_limpio, coalesce(activo_solicitado, true), auth.uid(), auth.uid())
    returning id into area_id_resultado;
  else
    update public.areas_curriculares
       set nombre = nombre_limpio,
           activo = coalesce(activo_solicitado, true),
           actualizado_por = auth.uid()
     where id = area_id_solicitada
     returning id into area_id_resultado;
    if area_id_resultado is null then
      raise exception 'El área curricular no existe.' using errcode = '22023';
    end if;
  end if;
  return area_id_resultado;
end;
$$;

create or replace function public.eliminar_area_curricular(area_id_solicitada bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar áreas curriculares.' using errcode = '42501';
  end if;
  if exists (select 1 from public.cursos_grado where area_curricular_id = area_id_solicitada) then
    raise exception 'No puedes eliminar un área que ya contiene cursos. Puedes desactivarla.' using errcode = '23503';
  end if;
  delete from public.areas_curriculares where id = area_id_solicitada;
  if not found then raise exception 'El área curricular no existe.' using errcode = '22023'; end if;
end;
$$;

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

create or replace function public.eliminar_curso_grado(curso_grado_id_solicitado bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  curso record;
  oferta record;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede eliminar cursos por grado.' using errcode = '42501';
  end if;
  select * into curso from public.cursos_grado where id = curso_grado_id_solicitado;
  if curso.id is null then raise exception 'El curso del grado no existe.' using errcode = '22023'; end if;
  if exists (select 1 from public.anios_academicos where id = curso.anio_academico_id and estado = 'cerrado') then
    raise exception 'Los cursos de un año cerrado son solo de consulta.' using errcode = '22023';
  end if;

  for oferta in
    select cs.id
      from public.cursos_seccion cs
      join public.secciones s on s.id = cs.seccion_id
     where s.anio_academico_id = curso.anio_academico_id
       and s.grado_id = curso.grado_id
       and cs.asignatura_id = curso.asignatura_id
       and cs.archivado_en is null
  loop
    perform public.archivar_curso_seccion(oferta.id);
  end loop;

  delete from public.cursos_grado where id = curso_grado_id_solicitado;
end;
$$;

revoke all on function public.sincronizar_cursos_de_grado(bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.sincronizar_cursos_nuevo_salon() from public, anon, authenticated;
revoke all on function public.guardar_area_curricular(bigint, text, boolean) from public, anon;
revoke all on function public.eliminar_area_curricular(bigint) from public, anon;
revoke all on function public.guardar_curso_grado(bigint, bigint, bigint, bigint, text, smallint, boolean) from public, anon;
revoke all on function public.eliminar_curso_grado(bigint) from public, anon;
grant execute on function public.guardar_area_curricular(bigint, text, boolean) to authenticated;
grant execute on function public.eliminar_area_curricular(bigint) to authenticated;
grant execute on function public.guardar_curso_grado(bigint, bigint, bigint, bigint, text, smallint, boolean) to authenticated;
grant execute on function public.eliminar_curso_grado(bigint) to authenticated;
grant execute on function public.sincronizar_cursos_de_grado(bigint, bigint, bigint) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'areas_curriculares') then
      alter publication supabase_realtime add table public.areas_curriculares;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cursos_grado') then
      alter publication supabase_realtime add table public.cursos_grado;
    end if;
  end if;
end $$;

commit;
