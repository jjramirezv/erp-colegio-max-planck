-- Horarios de clases por salón, bloques y días. Sin datos precargados.

begin;

create table public.bloques_horarios (
  id bigint generated always as identity primary key,
  turno_jornada_id bigint not null references public.turnos_jornadas(id) on delete restrict,
  nombre text not null,
  tipo text not null default 'clase' check (tipo in ('clase', 'reflexion', 'receso', 'almuerzo')),
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint bloques_horarios_nombre_valido check (btrim(nombre) <> '' and char_length(btrim(nombre)) <= 50),
  constraint bloques_horarios_horas_validas check (hora_fin > hora_inicio),
  unique (turno_jornada_id, hora_inicio, hora_fin)
);

create index bloques_horarios_turno_idx on public.bloques_horarios (turno_jornada_id, hora_inicio) where activo;

create table public.horarios_clases (
  id bigint generated always as identity primary key,
  seccion_id bigint not null references public.secciones(id) on delete restrict,
  bloque_horario_id bigint not null references public.bloques_horarios(id) on delete restrict,
  curso_seccion_id bigint not null,
  dia_semana smallint not null check (dia_semana between 1 and 6),
  activo boolean not null default true,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint horarios_curso_seccion_fkey foreign key (curso_seccion_id, seccion_id) references public.cursos_seccion(id, seccion_id) on delete restrict
);

create unique index horarios_seccion_dia_bloque_uidx on public.horarios_clases (seccion_id, dia_semana, bloque_horario_id) where activo;
create index horarios_curso_idx on public.horarios_clases (curso_seccion_id) where activo;

alter table public.bloques_horarios enable row level security;
alter table public.horarios_clases enable row level security;
create policy "autenticados leen bloques horarios" on public.bloques_horarios for select to authenticated using (true);
create policy "autenticados leen horarios" on public.horarios_clases for select to authenticated using (true);
create policy "direccion administra bloques horarios" on public.bloques_horarios for all to authenticated using ((select public.rol_portal_actual())::text = 'direccion') with check ((select public.rol_portal_actual())::text = 'direccion');
create policy "direccion administra horarios" on public.horarios_clases for all to authenticated using ((select public.rol_portal_actual())::text = 'direccion') with check ((select public.rol_portal_actual())::text = 'direccion');
grant select, insert, update, delete on public.bloques_horarios, public.horarios_clases to authenticated;
grant usage, select on sequence public.bloques_horarios_id_seq, public.horarios_clases_id_seq to authenticated;

create or replace function public.guardar_bloque_horario(bloque_id_solicitado bigint, turno_id_solicitado bigint, nombre_solicitado text, tipo_solicitado text, hora_inicio_solicitada time, hora_fin_solicitada time)
returns bigint language plpgsql security definer set search_path = '' as $$
declare resultado bigint; anio_estado text; turno_inicio time; turno_fin time;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then raise exception 'Solo Dirección puede gestionar los bloques horarios.' using errcode='42501'; end if;
  select a.estado, t.hora_inicio, t.hora_fin into anio_estado, turno_inicio, turno_fin from public.turnos_jornadas t join public.anios_academicos a on a.id=t.anio_academico_id where t.id=turno_id_solicitado and t.activo;
  if anio_estado is null then raise exception 'El turno seleccionado no está disponible.' using errcode='22023'; end if;
  if anio_estado='cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode='22023'; end if;
  if btrim(coalesce(nombre_solicitado,''))='' or tipo_solicitado not in ('clase','reflexion','receso','almuerzo') then raise exception 'Completa el nombre y tipo del bloque.' using errcode='22023'; end if;
  if hora_inicio_solicitada is null or hora_fin_solicitada is null or hora_fin_solicitada<=hora_inicio_solicitada or hora_inicio_solicitada<turno_inicio or hora_fin_solicitada>turno_fin then raise exception 'El bloque debe estar dentro de las horas del turno.' using errcode='22023'; end if;
  if exists(select 1 from public.bloques_horarios b where b.turno_jornada_id=turno_id_solicitado and b.activo and b.id<>coalesce(bloque_id_solicitado,0) and hora_inicio_solicitada<b.hora_fin and hora_fin_solicitada>b.hora_inicio) then raise exception 'Este bloque se cruza con otro horario del turno.' using errcode='22023'; end if;
  if bloque_id_solicitado is null then insert into public.bloques_horarios(turno_jornada_id,nombre,tipo,hora_inicio,hora_fin) values(turno_id_solicitado,btrim(nombre_solicitado),tipo_solicitado,hora_inicio_solicitada,hora_fin_solicitada) returning id into resultado;
  else update public.bloques_horarios set nombre=btrim(nombre_solicitado),tipo=tipo_solicitado,hora_inicio=hora_inicio_solicitada,hora_fin=hora_fin_solicitada,actualizado_en=now() where id=bloque_id_solicitado and turno_jornada_id=turno_id_solicitado returning id into resultado; end if;
  if resultado is null then raise exception 'El bloque horario no existe.' using errcode='22023'; end if; return resultado;
end; $$;

create or replace function public.eliminar_bloque_horario(bloque_id_solicitado bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then raise exception 'Solo Dirección puede eliminar bloques horarios.' using errcode='42501'; end if;
  if exists(select 1 from public.horarios_clases where bloque_horario_id=bloque_id_solicitado and activo) then raise exception 'Primero retira las clases asignadas a este bloque.' using errcode='23503'; end if;
  delete from public.bloques_horarios where id=bloque_id_solicitado;
end; $$;

create or replace function public.guardar_clase_horario(seccion_id_solicitada bigint, bloque_id_solicitado bigint, dia_solicitado smallint, curso_id_solicitado bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare resultado bigint; anio_estado text; turno_id bigint; dias smallint[]; inicio time; fin time; docente uuid;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then raise exception 'Solo Dirección puede gestionar los horarios.' using errcode='42501'; end if;
  select a.estado,s.turno_jornada_id,t.dias_semana into anio_estado,turno_id,dias from public.secciones s join public.anios_academicos a on a.id=s.anio_academico_id join public.turnos_jornadas t on t.id=s.turno_jornada_id where s.id=seccion_id_solicitada and s.activo;
  select hora_inicio,hora_fin into inicio,fin from public.bloques_horarios where id=bloque_id_solicitado and turno_jornada_id=turno_id and activo and tipo='clase';
  if anio_estado='cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode='22023'; end if;
  if inicio is null or not (dia_solicitado=any(dias)) then raise exception 'El bloque o día no pertenece a la jornada del salón.' using errcode='22023'; end if;
  delete from public.horarios_clases where seccion_id=seccion_id_solicitada and bloque_horario_id=bloque_id_solicitado and dia_semana=dia_solicitado;
  if curso_id_solicitado is null then return null; end if;
  if not exists(select 1 from public.cursos_seccion where id=curso_id_solicitado and seccion_id=seccion_id_solicitada and activo and archivado_en is null) then raise exception 'El curso no pertenece al salón seleccionado.' using errcode='22023'; end if;
  select ad.docente_id into docente from public.asignaciones_docentes ad where ad.activo and ad.archivado_en is null and (ad.curso_seccion_id=curso_id_solicitado or ad.seccion_id=seccion_id_solicitada) order by ad.curso_seccion_id nulls last limit 1;
  if docente is null then raise exception 'Primero asigna un docente responsable a este curso o salón.' using errcode='22023'; end if;
  if exists(select 1 from public.horarios_clases h join public.bloques_horarios b on b.id=h.bloque_horario_id join public.asignaciones_docentes ad on ad.activo and ad.archivado_en is null and (ad.curso_seccion_id=h.curso_seccion_id or ad.seccion_id=h.seccion_id) where h.activo and h.dia_semana=dia_solicitado and ad.docente_id=docente and h.seccion_id<>seccion_id_solicitada and inicio<b.hora_fin and fin>b.hora_inicio) then raise exception 'El docente ya tiene otra clase durante ese horario.' using errcode='23505'; end if;
  insert into public.horarios_clases(seccion_id,bloque_horario_id,curso_seccion_id,dia_semana,creado_por) values(seccion_id_solicitada,bloque_id_solicitado,curso_id_solicitado,dia_solicitado,auth.uid()) returning id into resultado; return resultado;
end; $$;

revoke all on function public.guardar_bloque_horario(bigint,bigint,text,text,time,time), public.eliminar_bloque_horario(bigint), public.guardar_clase_horario(bigint,bigint,smallint,bigint) from public,anon;
grant execute on function public.guardar_bloque_horario(bigint,bigint,text,text,time,time), public.eliminar_bloque_horario(bigint), public.guardar_clase_horario(bigint,bigint,smallint,bigint) to authenticated;

do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.bloques_horarios, public.horarios_clases; end if; exception when duplicate_object then null; end $$;

commit;
