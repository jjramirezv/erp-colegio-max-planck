-- Paso seguro 2: elimina exclusivamente la estructura académica 2026.
-- Se detiene sin borrar nada si detecta matrículas, docentes o materiales.

begin;

do $$
declare
  dependencias bigint;
begin
  select
    (select count(*) from public.matriculas_estudiantes m join public.anios_academicos a on a.id = m.anio_academico_id where a.nombre = '2026')
    + (select count(*) from public.asignaciones_docentes ad where ad.seccion_id in (select s.id from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id where a.nombre = '2026') or ad.curso_seccion_id in (select c.id from public.cursos_seccion c join public.anios_academicos a on a.id = c.anio_academico_id where a.nombre = '2026'))
    + (select count(*) from public.materiales_educativos m where m.seccion_id in (select s.id from public.secciones s join public.anios_academicos a on a.id = s.anio_academico_id where a.nombre = '2026') or m.curso_seccion_id in (select c.id from public.cursos_seccion c join public.anios_academicos a on a.id = c.anio_academico_id where a.nombre = '2026'))
  into dependencias;

  if dependencias > 0 then
    raise exception 'Limpieza cancelada: existen % registros reales vinculados al año 2026. Revísalos antes de borrar.', dependencias;
  end if;
end $$;

delete from public.cursos_seccion
where anio_academico_id in (select id from public.anios_academicos where nombre = '2026');

delete from public.secciones
where anio_academico_id in (select id from public.anios_academicos where nombre = '2026');

delete from public.grados g
where exists (
  select 1 from public.niveles_educativos n
  where n.id = g.nivel_id and n.nombre in ('Inicial', 'Primaria', 'Secundaria')
)
and not exists (select 1 from public.secciones s where s.grado_id = g.id);

delete from public.niveles_educativos n
where n.nombre in ('Inicial', 'Primaria', 'Secundaria')
and not exists (select 1 from public.grados g where g.nivel_id = n.id);

delete from public.asignaturas a
where a.codigo in ('MAT', 'COM', 'CYT', 'PS', 'ING', 'AYC', 'EFI', 'REL', 'CCSS', 'DPCC', 'EPT')
and a.creado_por is null
and not exists (select 1 from public.cursos_seccion c where c.asignatura_id = a.id)
and not exists (select 1 from public.materiales_educativos m where m.asignatura_id = a.id);

delete from public.anios_academicos where nombre = '2026';

commit;
