-- Integración sobre la cuenta estudiante de prueba ya creada por el propietario.
-- Todos los cambios de perfil, matrícula y auditoría se revierten.
begin;
do $$
declare actor uuid; estudiante uuid; salon record; fila jsonb; plan jsonb; panel jsonb;
  conteo integer; rechazado boolean := false; dni_s text;
begin
  if has_function_privilege('authenticated', 'public.preparar_fila_estudiante(jsonb,bigint,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.confirmar_fila_estudiante(jsonb,bigint,uuid,uuid)', 'EXECUTE') then
    raise exception 'Las funciones privadas no deben estar expuestas.';
  end if;
  select id into actor from public.perfiles where rol = 'direccion' and activo limit 1;
  select p.id, coalesce(p.dni, '00000001') into estudiante, dni_s from public.perfiles p
    join auth.users u on u.id = p.id where u.email = 'estudiante@maxplanck.edu.pe' and p.rol = 'estudiante' and p.activo;
  if actor is null or estudiante is null then raise exception 'Faltan las cuentas de prueba existentes.'; end if;
  select s.id, s.anio_academico_id, n.nombre as nivel, g.nombre as grado, s.nombre as seccion into salon
    from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id
    join public.grados g on g.id = s.grado_id join public.niveles_educativos n on n.id = g.nivel_id
    where s.activo and g.activo and n.activo and a.estado <> 'cerrado'
    order by exists(select 1 from public.matriculas_estudiantes m where m.estudiante_id = estudiante and m.seccion_id = s.id and m.estado = 'active' and m.archivado_en is null) desc, s.id limit 1;
  if salon.id is null then raise exception 'Falta un salón disponible.'; end if;
  fila := jsonb_build_object('dni', dni_s, 'name', 'Validación de importación', 'email', 'estudiante@maxplanck.edu.pe', 'level', salon.nivel, 'grade', salon.grado, 'section', salon.seccion);
  begin
    perform public.preparar_fila_estudiante(fila, salon.anio_academico_id, estudiante);
  exception when insufficient_privilege then rechazado := true;
  end;
  if not rechazado then raise exception 'Un estudiante logró preparar una importación.'; end if;
  plan := public.preparar_fila_estudiante(fila, salon.anio_academico_id, actor);
  if (plan->>'userId')::uuid <> estudiante then raise exception 'La cuenta existente no coincide.'; end if;
  perform public.confirmar_fila_estudiante(fila, salon.anio_academico_id, actor, estudiante);
  perform public.confirmar_fila_estudiante(fila, salon.anio_academico_id, actor, estudiante);
  select count(*) into conteo from public.matriculas_estudiantes where estudiante_id = estudiante
    and anio_academico_id = salon.anio_academico_id and estado = 'active' and archivado_en is null;
  if conteo <> 1 then raise exception 'La importación no es idempotente.'; end if;
  if not exists(select 1 from public.perfiles where id = estudiante and dni = dni_s and nombre_completo = 'Validación de importación') then
    raise exception 'No se guardaron nombre y DNI.';
  end if;
  perform set_config('request.jwt.claim.sub', estudiante::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', estudiante, 'role', 'authenticated')::text, true);
  panel := public.cargar_panel_estudiante();
  if jsonb_array_length(panel) = 0 then raise exception 'La matrícula no aparece en el portal estudiante.'; end if;
end;
$$;
rollback;
