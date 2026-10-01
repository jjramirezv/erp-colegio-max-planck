-- Requiere la migración 032 y al menos un docente con curso vigente.
-- Todos los registros de prueba, incluidos metadatos de Storage, se revierten.
begin;
do $$
declare
  docente uuid; otro uuid := gen_random_uuid(); curso bigint; salon bigint;
  material bigint; version_archivo bigint; publicacion bigint; destino bigint;
  ruta text; denegado boolean;
begin
  select ta.docente_id, c.id, c.seccion_id into docente, curso, salon
  from public.asignaciones_docentes ta
  join public.cursos_seccion c on c.id = ta.curso_seccion_id
  join public.secciones s on s.id = c.seccion_id
  join public.anios_academicos a on a.id = s.anio_academico_id
  join public.perfiles p on p.id = ta.docente_id
  where ta.activo and ta.archivado_en is null and c.activo and c.archivado_en is null
    and s.activo and a.activo and p.activo and p.rol::text = 'docente'
    and (ta.inicia_en is null or ta.inicia_en <= (now() at time zone 'America/Lima')::date)
    and (ta.termina_en is null or ta.termina_en >= (now() at time zone 'America/Lima')::date)
  order by c.id limit 1;
  assert docente is not null, 'Se necesita un docente con curso vigente para esta prueba';
  insert into auth.users(id,email) values (otro,otro||'@test.invalid');
  insert into public.perfiles(id,nombre_completo,rol) values (otro,'Prueba aislada de materiales','docente');
  perform set_config('request.jwt.claim.sub',docente::text,true);
  execute 'set local role authenticated';

  insert into public.materiales_educativos(titulo,tipo_material,origen,curso_seccion_id,creado_por,actualizado_por)
  values ('Prueba de materiales con RETURNING','digital','teacher_extra',curso,docente,docente)
  returning id into material;
  assert material is not null, 'El docente debe poder crear y recuperar su material';
  ruta := 'teachers/'||docente||'/'||material||'/'||otro||'.pdf';
  -- Solo metadatos en una transacción: no crea un archivo físico en Storage.
  insert into storage.objects(bucket_id,name,metadata)
  values ('school-materials',ruta,'{"mimetype":"application/pdf","size":12}'::jsonb);
  insert into public.versiones_material(material_id,numero_version,etiqueta_version,ruta_almacenamiento,nombre_archivo_original,tipo_mime,tamano_bytes,creado_por)
  values(material,1,'1.0',ruta,'prueba.pdf','application/pdf',12,docente)
  returning id into version_archivo;
  assert version_archivo is not null, 'Debe registrar y recuperar la versión';
  insert into public.publicaciones_material(material_id,version_id,estado,creado_por)
  values(material,version_archivo,'draft',docente) returning id into publicacion;
  assert publicacion is not null, 'Debe crear y recuperar el borrador';
  insert into public.destinatarios_material(publicacion_id,seccion_id,curso_seccion_id,creado_por)
  values(publicacion,salon,curso,docente) returning id into destino;
  assert destino is not null, 'Debe aceptar el curso como destino incluso en Inicial';
  perform public.publicar_material(publicacion);
  assert (select estado = 'published' from public.publicaciones_material where id = publicacion), 'Debe publicar el recurso';
  assert public.puede_leer_archivo_material(ruta), 'El autor debe poder abrir el archivo';

  perform set_config('request.jwt.claim.sub',otro::text,true);
  assert not public.docente_tiene_curso(curso), 'La otra cuenta no tiene el curso';
  assert (select count(*)=0 from public.materiales_educativos where id=material), 'No debe leer materiales ajenos';
  assert (select count(*)=0 from public.versiones_material where id=version_archivo), 'No debe leer versiones ajenas';
  assert (select count(*)=0 from public.publicaciones_material where id=publicacion), 'No debe leer publicaciones ajenas';
  assert not public.puede_leer_archivo_material(ruta), 'No debe abrir archivos ajenos';
  denegado := false;
  begin
    insert into public.materiales_educativos(titulo,tipo_material,origen,curso_seccion_id,creado_por)
    values ('Intento sin asignación','digital','teacher_extra',curso,otro);
  exception when sqlstate '42501' or sqlstate 'P0001' then denegado := true;
  end;
  assert denegado, 'Debe rechazar la creación en un curso no asignado';
  perform set_config('request.jwt.claim.sub',docente::text,true);
  perform public.archivar_material(material);
  execute 'reset role';
end;
$$;
select 'Crear, versión, destino, publicar, lectura, aislamiento y archivo: OK' as resultado;
rollback;
