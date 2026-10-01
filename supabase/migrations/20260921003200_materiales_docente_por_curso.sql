-- INSERT ... RETURNING evalúa SELECT sobre la fila nueva. Las funciones
-- STABLE que vuelven a consultar esa misma tabla no ven aún esa fila.
-- Reconocer al propietario directamente conserva el alcance de sus permisos.
begin;

alter policy "usuarios autorizados leen materiales educativos"
on public.materiales_educativos using (
  public.puede_leer_material(id)
  or (
    archivado_en is null
    and origen = 'teacher_extra'
    and creado_por = (select auth.uid())
    and (
      (curso_seccion_id is not null and seccion_id is null and public.docente_tiene_curso(curso_seccion_id))
      or (seccion_id is not null and curso_seccion_id is null and public.docente_tiene_seccion(seccion_id))
    )
  )
);

alter policy "usuarios autorizados leen versiones de material"
on public.versiones_material using (
  public.puede_leer_version_material(id)
  or (archivado_en is null and public.docente_puede_gestionar_material(material_id)
    and exists (select 1 from public.materiales_educativos m where m.id = material_id and m.archivado_en is null))
);

alter policy "usuarios autorizados leen publicaciones de material"
on public.publicaciones_material using (
  public.puede_leer_publicacion(id)
  or public.docente_puede_gestionar_material(material_id)
);

-- Los cursos de Inicial también admiten materiales. El salón sigue siendo válido para su alcance original.
create or replace function public.validar_destinatario_material()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  alcance_nivel text;
  estado_publicacion text;
  asignatura_publicacion_id bigint;
  curso_seccion_material_id bigint;
  seccion_material_id bigint;
  asignatura_curso_id bigint;
begin
  select mr.estado, lm.asignatura_id, lm.curso_seccion_id, lm.seccion_id
  into estado_publicacion, asignatura_publicacion_id, curso_seccion_material_id, seccion_material_id
  from public.publicaciones_material mr
  join public.materiales_educativos lm on lm.id = mr.material_id
  where mr.id = new.publicacion_id;

  if estado_publicacion is null then
    raise exception 'La publicacion indicada no existe.';
  end if;

  if estado_publicacion <> 'draft' then
    raise exception 'Los destinatarios solo pueden modificarse mientras la publicacion es borrador.';
  end if;

  if curso_seccion_material_id is not null
     and new.curso_seccion_id is distinct from curso_seccion_material_id then
    raise exception 'El destinatario debe coincidir con el curso del material.';
  end if;

  if seccion_material_id is not null
     and (
       new.seccion_id is distinct from seccion_material_id
       or new.curso_seccion_id is not null
     ) then
    raise exception 'El destinatario debe coincidir con el salon del material.';
  end if;

  select el.alcance_material
  into alcance_nivel
  from public.secciones s
  join public.grados g on g.id = s.grado_id
  join public.niveles_educativos el on el.id = g.nivel_id
  where s.id = new.seccion_id
    and s.activo;

  if alcance_nivel is null then
    raise exception 'La seccion indicada no existe o esta inactiva.';
  end if;

  if alcance_nivel = 'course' and new.curso_seccion_id is null then
    raise exception 'En Primaria y Secundaria debe indicar una oferta de curso.';
  end if;

  if new.curso_seccion_id is not null then
    select co.asignatura_id
    into asignatura_curso_id
    from public.cursos_seccion co
    where co.id = new.curso_seccion_id
      and co.seccion_id = new.seccion_id
      and co.activo
      and co.archivado_en is null;

    if asignatura_curso_id is null then
      raise exception 'La oferta no pertenece a la seccion o esta inactiva.';
    end if;

    if asignatura_publicacion_id is not null and asignatura_publicacion_id <> asignatura_curso_id then
      raise exception 'La asignatura del material no coincide con el curso destinatario.';
    end if;
  end if;

  return new;
end;
$$;


commit;
