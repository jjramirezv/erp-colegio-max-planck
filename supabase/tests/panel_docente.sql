-- Pruebas de persistencia y permisos. Todos los fixtures terminan en ROLLBACK.
begin;
do $$
declare
  director uuid := gen_random_uuid(); docente uuid := gen_random_uuid(); otro uuid := gen_random_uuid(); estudiante uuid := gen_random_uuid();
  anio bigint; nivel bigint; grado bigint; salon bigint; asignatura bigint; curso bigint; matricula bigint; periodo bigint; evaluacion bigint; escala bigint;
  hoy date := (now() at time zone 'America/Lima')::date; panel jsonb; denegado boolean;
begin
  insert into auth.users (id,email) values (director,director||'@test.invalid'),(docente,docente||'@test.invalid'),(otro,otro||'@test.invalid'),(estudiante,estudiante||'@test.invalid');
  insert into public.perfiles (id,nombre_completo,rol) values (director,'Prueba Dirección','direccion'),(docente,'Prueba Docente','docente'),(otro,'Prueba Sin asignación','docente'),(estudiante,'Prueba Estudiante','estudiante');
  perform set_config('request.jwt.claim.sub',director::text,true);
  select id into anio from public.anios_academicos where activo;
  if anio is null then
    insert into public.anios_academicos (nombre,inicia_en,termina_en,sistema_periodos,activo,estado)
    values ('Test '||left(docente::text,8),hoy-100,hoy+100,'bimestres',true,'activo') returning id into anio;
  end if;
  insert into public.niveles_educativos (nombre,orden) values ('Test '||docente,99) returning id into nivel;
  insert into public.grados (nivel_id,nombre,orden) values (nivel,'Test grado',1) returning id into grado;
  insert into public.secciones (anio_academico_id,grado_id,nombre,turno) values (anio,grado,'TEST','mañana') returning id into salon;
  insert into public.asignaturas (codigo,nombre) values (docente::text,'Test asignatura') returning id into asignatura;
  insert into public.cursos_seccion (anio_academico_id,seccion_id,asignatura_id) values (anio,salon,asignatura) returning id into curso;
  insert into public.asignaciones_docentes (curso_seccion_id,docente_id,asignado_por) values (curso,docente,director);
  insert into public.matriculas_estudiantes (anio_academico_id,seccion_id,estudiante_id) values (anio,salon,estudiante) returning id into matricula;
  select id into periodo from public.periodos_academicos where anio_academico_id=anio order by numero limit 1;
  if periodo is null then
    insert into public.periodos_academicos (anio_academico_id,numero,nombre,inicia_en,termina_en)
    values (anio,1,'Test periodo',hoy-1,hoy+1) returning id into periodo;
  end if;
  insert into public.evaluaciones_academicas (curso_seccion_id,periodo_academico_id,titulo,tipo,fecha_aplicacion,estado)
  values (curso,periodo,'Test evaluación','practica',hoy,'en_curso') returning id into evaluacion;
  insert into public.configuraciones_evaluacion (anio_academico_id,nivel_educativo_id,tipo_escala,calculo_final,valor_minimo,valor_maximo,valor_aprobatorio,decimales)
  values (anio,nivel,'numerica','promedio_periodos',0,20,11,1) returning id into escala;
  perform set_config('request.jwt.claim.sub',docente::text,true);
  execute 'set local role authenticated';
  panel := public.cargar_panel_docente();
  assert jsonb_array_length(panel)=1, 'Debe ver solamente su curso';
  assert jsonb_array_length(panel->0->'students')=1, 'Debe incluir matrícula real';
  assert panel->0->'scale'->>'type'='numerica', 'Debe cargar escala real';
  perform public.guardar_asistencia_docente(salon,hoy,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'status','tardanza','lateMinutes',8)));
  assert (select estado='tardanza' from public.asistencias_estudiantes where matricula_id=matricula and fecha=hoy), 'Debe persistir asistencia';
  perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','17.5')));
  assert (select valor='17.5' from public.calificaciones_evaluaciones where evaluacion_id=evaluacion and matricula_id=matricula), 'Debe persistir calificación';
  denegado := false;
  begin perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','21')));
  exception when sqlstate '22023' then denegado := true; end;
  assert denegado, 'Debe rechazar nota fuera de escala';
  denegado := false;
  begin perform public.guardar_asistencia_docente(salon,hoy+500,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'status','presente')));
  exception when sqlstate '22023' then denegado := true; end;
  assert denegado, 'Debe rechazar fecha inválida';
  perform set_config('request.jwt.claim.sub',otro::text,true);
  assert public.cargar_panel_docente()='[]'::jsonb, 'No debe mostrar cursos ajenos';
  assert (select count(*)=0 from public.calificaciones_evaluaciones where evaluacion_id=evaluacion), 'RLS debe ocultar notas ajenas';
  denegado := false;
  begin perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','19')));
  exception when sqlstate '42501' then denegado := true; end;
  assert denegado, 'Debe rechazar escritura de notas ajenas';
  denegado := false;
  begin perform public.guardar_asistencia_docente(salon,hoy,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'status','presente')));
  exception when sqlstate '42501' then denegado := true; end;
  assert denegado, 'Debe rechazar asistencia ajena';
  execute 'reset role';
  update public.configuraciones_evaluacion set tipo_escala='cualitativa',calculo_final='ultimo_logro',valor_minimo=null,valor_maximo=null,valor_aprobatorio=null,decimales=null where id=escala;
  insert into public.niveles_logro_evaluacion (configuracion_evaluacion_id,orden,codigo,nombre) values (escala,1,'AD','Logro destacado');
  perform set_config('request.jwt.claim.sub',docente::text,true);
  execute 'set local role authenticated';
  perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','AD')));
  assert (select valor='AD' from public.calificaciones_evaluaciones where evaluacion_id=evaluacion and matricula_id=matricula), 'Debe guardar nivel de logro';
  denegado := false;
  begin perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','INVALIDO')));
  exception when sqlstate '22023' then denegado := true; end;
  assert denegado, 'Debe rechazar logro inexistente';
  execute 'reset role';
  update public.evaluaciones_academicas set estado='cerrada' where id=evaluacion;
  execute 'set local role authenticated';
  denegado := false;
  begin perform public.guardar_calificaciones_docente(evaluacion,jsonb_build_array(jsonb_build_object('enrollmentId',matricula,'value','AD')));
  exception when sqlstate '22023' then denegado := true; end;
  assert denegado, 'No debe modificar evaluación cerrada';
  perform set_config('request.jwt.claim.sub',estudiante::text,true);
  denegado := false;
  begin perform public.cargar_panel_docente(); exception when sqlstate '42501' then denegado := true; end;
  assert denegado, 'Un estudiante no debe acceder al panel docente';
  execute 'reset role';
end;
$$;
select 'Panel, persistencia, escalas, fechas, RLS y aislamiento: OK' as resultado;
rollback;
