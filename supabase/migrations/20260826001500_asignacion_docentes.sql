-- Asignación docente por curso y salón con vigencia académica.
-- Reutiliza las tablas existentes y no inserta datos de demostración.

begin;

create or replace function public.guardar_asignacion_docente(
  curso_seccion_id_solicitado bigint,
  seccion_id_solicitada bigint,
  docente_id_solicitado uuid,
  rol_asignacion_solicitado text,
  inicia_en_solicitado date,
  termina_en_solicitado date
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  asignacion_id_resultado bigint;
  anio_id_contexto bigint;
  anio_inicio date;
  anio_fin date;
  anio_estado text;
  alcance_nivel text;
  clave_bloqueo text;
begin
  if (select public.rol_portal_actual())::text <> 'direccion' then
    raise exception 'Solo Dirección puede gestionar las asignaciones docentes.' using errcode = '42501';
  end if;

  if (curso_seccion_id_solicitado is null) = (seccion_id_solicitada is null) then
    raise exception 'Selecciona un curso o un salón, no ambos.' using errcode = '22023';
  end if;

  if curso_seccion_id_solicitado is not null then
    select a.id, a.inicia_en, a.termina_en, a.estado, n.alcance_material
      into anio_id_contexto, anio_inicio, anio_fin, anio_estado, alcance_nivel
    from public.cursos_seccion c
    join public.secciones s on s.id = c.seccion_id
    join public.anios_academicos a on a.id = s.anio_academico_id
    join public.grados g on g.id = s.grado_id
    join public.niveles_educativos n on n.id = g.nivel_id
    where c.id = curso_seccion_id_solicitado and c.activo and c.archivado_en is null and s.activo;
  else
    select a.id, a.inicia_en, a.termina_en, a.estado, n.alcance_material
      into anio_id_contexto, anio_inicio, anio_fin, anio_estado, alcance_nivel
    from public.secciones s
    join public.anios_academicos a on a.id = s.anio_academico_id
    join public.grados g on g.id = s.grado_id
    join public.niveles_educativos n on n.id = g.nivel_id
    where s.id = seccion_id_solicitada and s.activo;
  end if;

  if anio_id_contexto is null then raise exception 'El curso o salón seleccionado ya no está disponible.' using errcode = '22023'; end if;
  if anio_estado = 'cerrado' then raise exception 'Las asignaciones de un año cerrado son solo de consulta.' using errcode = '22023'; end if;
  if curso_seccion_id_solicitado is not null and alcance_nivel <> 'course' then raise exception 'En este nivel el docente responsable se asigna directamente al salón.' using errcode = '22023'; end if;
  if seccion_id_solicitada is not null and alcance_nivel <> 'section' then raise exception 'En este nivel el docente se asigna a cada curso del salón.' using errcode = '22023'; end if;

  clave_bloqueo := case when curso_seccion_id_solicitado is not null then 'teaching:course:' || curso_seccion_id_solicitado::text else 'teaching:section:' || seccion_id_solicitada::text end;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(clave_bloqueo, 0));

  update public.asignaciones_docentes
  set activo = false, archivado_en = now(), archivado_por = auth.uid()
  where activo and archivado_en is null and (
    (curso_seccion_id_solicitado is not null and curso_seccion_id = curso_seccion_id_solicitado)
    or (seccion_id_solicitada is not null and seccion_id = seccion_id_solicitada)
  );

  if docente_id_solicitado is null then return null; end if;
  if rol_asignacion_solicitado not in ('titular', 'apoyo', 'reemplazo') then raise exception 'Selecciona una función docente válida.' using errcode = '22023'; end if;
  if not exists (select 1 from public.perfiles where id = docente_id_solicitado and activo and rol::text = 'docente') then raise exception 'El docente seleccionado no existe o está inactivo.' using errcode = '22023'; end if;
  if inicia_en_solicitado is null or termina_en_solicitado is null or termina_en_solicitado < inicia_en_solicitado then raise exception 'Completa una vigencia válida para la asignación.' using errcode = '22023'; end if;
  if inicia_en_solicitado < anio_inicio or termina_en_solicitado > anio_fin then raise exception 'La vigencia docente debe estar dentro del año lectivo.' using errcode = '22023'; end if;

  insert into public.asignaciones_docentes (curso_seccion_id, seccion_id, docente_id, rol_asignacion, inicia_en, termina_en, activo, asignado_por)
  values (curso_seccion_id_solicitado, seccion_id_solicitada, docente_id_solicitado, rol_asignacion_solicitado, inicia_en_solicitado, termina_en_solicitado, true, auth.uid())
  returning id into asignacion_id_resultado;
  return asignacion_id_resultado;
end;
$$;

revoke all on function public.guardar_asignacion_docente(bigint, bigint, uuid, text, date, date) from public, anon;
grant execute on function public.guardar_asignacion_docente(bigint, bigint, uuid, text, date, date) to authenticated;

commit;
