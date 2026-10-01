-- Permite que Dirección y Coordinación Académica gestionen horarios.
-- Conserva bloques independientes por día y no crea datos de demostración.

begin;

create or replace function public.guardar_bloque_horario(
  bloque_id_solicitado bigint,
  turno_id_solicitado bigint,
  dia_solicitado smallint,
  nombre_solicitado text,
  tipo_solicitado text,
  hora_inicio_solicitada time,
  hora_fin_solicitada time
)
returns bigint language plpgsql security definer set search_path='' as $$
declare resultado bigint; anio_estado text; turno_inicio time; turno_fin time; dias smallint[];
begin
  if not (select public.es_gestor_materiales()) then raise exception 'Solo Dirección o Coordinación Académica pueden gestionar bloques horarios.' using errcode='42501'; end if;
  select a.estado,t.hora_inicio,t.hora_fin,t.dias_semana into anio_estado,turno_inicio,turno_fin,dias from public.turnos_jornadas t join public.anios_academicos a on a.id=t.anio_academico_id where t.id=turno_id_solicitado and t.activo;
  if anio_estado is null then raise exception 'El turno seleccionado no está disponible.' using errcode='22023'; end if;
  if anio_estado='cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode='22023'; end if;
  if not(dia_solicitado=any(dias)) then raise exception 'El día no pertenece a este turno.' using errcode='22023'; end if;
  if btrim(coalesce(nombre_solicitado,''))='' or tipo_solicitado not in('clase','reflexion','receso','almuerzo') then raise exception 'Completa el nombre y tipo del bloque.' using errcode='22023'; end if;
  if hora_inicio_solicitada is null or hora_fin_solicitada is null or hora_fin_solicitada<=hora_inicio_solicitada or hora_inicio_solicitada<turno_inicio or hora_fin_solicitada>turno_fin then raise exception 'El bloque debe estar dentro de las horas del turno.' using errcode='22023'; end if;
  if exists(select 1 from public.bloques_horarios b where b.turno_jornada_id=turno_id_solicitado and b.dia_semana=dia_solicitado and b.activo and b.id<>coalesce(bloque_id_solicitado,0) and hora_inicio_solicitada<b.hora_fin and hora_fin_solicitada>b.hora_inicio) then raise exception 'Este bloque se cruza con otro del mismo día.' using errcode='22023'; end if;
  if bloque_id_solicitado is null then
    insert into public.bloques_horarios(turno_jornada_id,dia_semana,nombre,tipo,hora_inicio,hora_fin) values(turno_id_solicitado,dia_solicitado,btrim(nombre_solicitado),tipo_solicitado,hora_inicio_solicitada,hora_fin_solicitada) returning id into resultado;
  else
    update public.bloques_horarios set dia_semana=dia_solicitado,nombre=btrim(nombre_solicitado),tipo=tipo_solicitado,hora_inicio=hora_inicio_solicitada,hora_fin=hora_fin_solicitada,actualizado_en=now() where id=bloque_id_solicitado and turno_jornada_id=turno_id_solicitado returning id into resultado;
  end if;
  if resultado is null then raise exception 'El bloque horario no existe.' using errcode='22023'; end if;
  return resultado;
end; $$;

create or replace function public.eliminar_bloque_horario(bloque_id_solicitado bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not (select public.es_gestor_materiales()) then raise exception 'Solo Dirección o Coordinación Académica pueden eliminar bloques horarios.' using errcode='42501'; end if;
  if exists(select 1 from public.horarios_clases where bloque_horario_id=bloque_id_solicitado and activo) then raise exception 'Primero retira las clases asignadas a este bloque.' using errcode='23503'; end if;
  delete from public.bloques_horarios where id=bloque_id_solicitado;
  if not found then raise exception 'El bloque horario no existe.' using errcode='22023'; end if;
end; $$;

create or replace function public.guardar_clase_horario(
  seccion_id_solicitada bigint,
  bloque_id_solicitado bigint,
  dia_solicitado smallint,
  curso_id_solicitado bigint
)
returns bigint language plpgsql security definer set search_path='' as $$
declare resultado bigint; anio_estado text; turno_id bigint; inicio time; fin time; docente uuid;
begin
  if not (select public.es_gestor_materiales()) then raise exception 'Solo Dirección o Coordinación Académica pueden gestionar horarios.' using errcode='42501'; end if;
  select a.estado,s.turno_jornada_id into anio_estado,turno_id from public.secciones s join public.anios_academicos a on a.id=s.anio_academico_id where s.id=seccion_id_solicitada and s.activo;
  select hora_inicio,hora_fin into inicio,fin from public.bloques_horarios where id=bloque_id_solicitado and turno_jornada_id=turno_id and dia_semana=dia_solicitado and activo and tipo='clase';
  if anio_estado='cerrado' then raise exception 'El año lectivo cerrado es solo de consulta.' using errcode='22023'; end if;
  if inicio is null then raise exception 'El bloque no pertenece al día o turno seleccionado.' using errcode='22023'; end if;
  delete from public.horarios_clases where seccion_id=seccion_id_solicitada and bloque_horario_id=bloque_id_solicitado;
  if curso_id_solicitado is null then return null; end if;
  if not exists(select 1 from public.cursos_seccion where id=curso_id_solicitado and seccion_id=seccion_id_solicitada and activo and archivado_en is null) then raise exception 'El curso no pertenece al salón.' using errcode='22023'; end if;
  select docente_id into docente from public.asignaciones_docentes where activo and archivado_en is null and curso_seccion_id=curso_id_solicitado limit 1;
  if docente is null then raise exception 'Primero asigna un docente específicamente a este curso.' using errcode='22023'; end if;
  if exists(select 1 from public.horarios_clases h join public.bloques_horarios b on b.id=h.bloque_horario_id join public.asignaciones_docentes ad on ad.curso_seccion_id=h.curso_seccion_id and ad.activo and ad.archivado_en is null where h.activo and b.dia_semana=dia_solicitado and ad.docente_id=docente and h.seccion_id<>seccion_id_solicitada and inicio<b.hora_fin and fin>b.hora_inicio) then raise exception 'El docente ya tiene otra clase durante ese horario.' using errcode='23505'; end if;
  insert into public.horarios_clases(seccion_id,bloque_horario_id,curso_seccion_id,dia_semana,creado_por) values(seccion_id_solicitada,bloque_id_solicitado,curso_id_solicitado,dia_solicitado,auth.uid()) returning id into resultado;
  return resultado;
end; $$;

revoke all on function public.guardar_bloque_horario(bigint,bigint,smallint,text,text,time,time), public.eliminar_bloque_horario(bigint), public.guardar_clase_horario(bigint,bigint,smallint,bigint) from public,anon;
grant execute on function public.guardar_bloque_horario(bigint,bigint,smallint,text,text,time,time), public.eliminar_bloque_horario(bigint), public.guardar_clase_horario(bigint,bigint,smallint,bigint) to authenticated;

commit;
